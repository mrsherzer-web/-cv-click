import numpy as np, cv2, subprocess, sys, os, math

D = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1920, 1080, 30
AH = 818                      # active picture height (2.35:1)
BAR = (H - AH) // 2           # 131
FL_OFF = 1.0                  # flute src 0 -> T 1.0
TALK_OFF = 25.0               # talk src 0 -> T 25.0
REW0, REW1 = 9.4, 10.4        # talk-relative rewind window; flash at REW1
TOTAL = TALK_OFF + 16.0
rng = np.random.default_rng(11)
cv2.setNumThreads(4)

def clamp(v, a, b): return max(a, min(b, v))
def lin(t, a, b): return clamp((t - a) / (b - a), 0.0, 1.0) if b != a else float(t >= a)
def smooth(u): return u * u * (3 - 2 * u)
def ease_out(u): return 1 - (1 - u) ** 3
def ease_in(u): return u ** 3
def env(t, a, b, c, d):
    """0 before a, ramps to 1 by b, holds, ramps to 0 from c to d"""
    return smooth(lin(t, a, b)) * (1 - smooth(lin(t, c, d)))

# ---------------- sources ----------------
class Src:
    def __init__(self, path, w, h, n):
        self.path, self.w, self.h, self.n = path, w, h, n
        self.p = None; self.idx = -1; self.cur = None
    def _open(self, idx):
        if self.p: self.p.kill()
        ss = max(0.0, (idx - 0.4) / FPS)
        self.p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', f'{ss:.4f}', '-i', self.path,
                                   '-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-'],
                                  stdout=subprocess.PIPE, bufsize=1 << 27)
        self.idx = idx - 1
    def _next(self):
        b = self.p.stdout.read(self.w * self.h * 6)
        if len(b) < self.w * self.h * 6: return None
        self.idx += 1
        return np.frombuffer(b, np.uint16).reshape(self.h, self.w, 3)
    def get(self, idx):
        idx = int(clamp(idx, 0, self.n - 1))
        if idx == self.idx and self.cur is not None: return self.cur
        if self.p is None or idx < self.idx or idx - self.idx > 45: self._open(idx)
        while self.idx < idx:
            f = self._next()
            if f is None: break
            self.cur = f
        return self.cur

flute = Src(os.path.join(D, 'inter/flute.mkv'), 1620, 1500, 686)
talk = Src(os.path.join(D, 'inter/talk.mkv'), 2560, 1440, 336)

# ---------------- grading ----------------
def make_luts(pin, pout, gain=1.0):
    x = np.arange(65536, dtype=np.float64) / 65535.0
    y = np.interp(np.clip(x * gain, 0, 1), pin, pout)
    k = 401; g = np.exp(-0.5 * (np.arange(k) - k // 2) ** 2 / (k / 6) ** 2); g /= g.sum()
    y = np.convolve(np.pad(y, k // 2, mode='edge'), g, mode='valid')
    sh = (1 - y) ** 3; hi = 4 * y * y * (1 - y)
    R = y - 0.012 * sh + 0.035 * hi
    G = y + 0.006 * sh + 0.006 * hi
    B = y + 0.030 * sh - 0.040 * hi
    return [np.clip(c, 0, 1).astype(np.float32) for c in (R, G, B)]

PIN = [0, 0.006, 0.015, 0.03, 0.05, 0.08, 0.11, 0.15, 0.22, 0.35, 0.6, 1.0]
POUT = [0, 0.008, 0.030, 0.08, 0.16, 0.29, 0.41, 0.53, 0.67, 0.83, 0.95, 1.0]
GAIN = {'flute': float(os.environ.get('GF', 1.0)), 'talk': float(os.environ.get('GT', 1.0))}
LUT = {k: make_luts(PIN, POUT, g) for k, g in GAIN.items()}

def grade(img16, which, sat=0.88):
    L = LUT[which]
    out = np.empty(img16.shape, np.float32)
    for c in range(3): out[..., c] = L[c][img16[..., c]]
    if sat != 1.0:
        lum = out @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        out = lum[..., None] + sat * (out - lum[..., None])
    return out

def vignette_mask(w, h, strength, power=2.2, aspect=1.0):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2); ny = (yy - h / 2) / (h / 2) * aspect
    r = np.sqrt(nx * nx + ny * ny) / math.sqrt(1 + aspect * aspect)
    return (1 - strength * np.clip(r, 0, 1) ** power)[..., None].astype(np.float32)

VIG = vignette_mask(W, AH, 0.55, 2.0, AH / W * 1.4)
VIG_STRONG = vignette_mask(W, AH, 0.9, 1.6, AH / W * 1.4)

def make_grain(n, w, h, sigma):
    out = []
    for _ in range(n):
        g = rng.standard_normal((h, w)).astype(np.float32)
        g = cv2.GaussianBlur(g, (0, 0), sigma); g /= g.std()
        out.append(g.astype(np.float16))
    return out
GRAIN = make_grain(10, W, H, 0.65)
GRAIN_BIG = make_grain(8, W, H, 1.3)

def add_grain(img, amt, big=False):
    g = (GRAIN_BIG if big else GRAIN)[rng.integers(0, 8 if big else 10)][:img.shape[0], :img.shape[1]].astype(np.float32)
    lum = img.mean(axis=2, keepdims=True)
    w = 0.35 + 2.6 * lum * (1 - lum)
    return img + g[..., None] * amt * w

def view(img, cx, cy, scale, ow, oh, rot=0.0, interp=cv2.INTER_CUBIC, ocx=None, ocy=None):
    """sample img so that point (cx,cy) lands at output centre with given scale/rotation"""
    ocx = ow / 2 if ocx is None else ocx; ocy = oh / 2 if ocy is None else ocy
    a = math.radians(rot); ca, sa = math.cos(a) * scale, math.sin(a) * scale
    M = np.array([[ca, -sa, ocx - ca * cx + sa * cy], [sa, ca, ocy - sa * cx - ca * cy]], np.float32)
    return cv2.warpAffine(img, M, (ow, oh), flags=interp, borderMode=cv2.BORDER_REFLECT)

def glow(img, sigma=6, k=0.4):
    sm = cv2.resize(img, (img.shape[1] // 4, img.shape[0] // 4), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (0, 0), sigma)
    sm = cv2.resize(sm, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    return 1 - (1 - img) * (1 - np.clip(sm, 0, 1) * k)   # screen

# ---------------- title layers ----------------
class Layer:
    def __init__(self, name):
        im = cv2.imread(os.path.join(D, 'titles', name + '.png'), cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
        rgb = im[..., 2::-1].copy(); a = im[..., 3:4]
        self.pm = np.concatenate([rgb * a, a], axis=2)    # premultiplied RGBA
        ys, xs = np.nonzero(a[..., 0] > 0.004)
        self.cx = (xs.min() + xs.max()) / 2; self.cy = (ys.min() + ys.max()) / 2
        self.box = (xs.min(), ys.min(), xs.max(), ys.max())
    def render(self, scale=1.0, dx=0, dy=0, blur=0.0, sx=1.0):
        if scale == 1 and dx == 0 and dy == 0 and sx == 1:
            out = self.pm
        else:
            M = np.array([[scale * sx, 0, self.cx + dx - scale * sx * self.cx],
                          [0, scale, self.cy + dy - scale * self.cy]], np.float32)
            out = cv2.warpAffine(self.pm, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
        if blur > 0.3:
            out = cv2.GaussianBlur(out, (0, 0), blur)
        return out

def sweep(rgba, pos, width=90, angle=0.35, strength=0.9, color=(1.0, 0.95, 0.85)):
    """additive light band across the layer's alpha; pos in px along x"""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) if not hasattr(sweep, 'g') else sweep.g
    sweep.g = (yy, xx)
    d = xx + angle * yy - pos
    band = np.exp(-0.5 * (d / width) ** 2) * strength
    return band[..., None] * rgba[..., 3:4] * np.array(color, np.float32)

def comp(frame, rgba, opacity=1.0, shadow=0.0, add=None):
    """frame: full HxW float RGB. rgba premultiplied full-frame."""
    if opacity <= 0.001: return frame
    a = rgba[..., 3:4] * opacity
    if shadow > 0:
        sh = cv2.GaussianBlur(rgba[..., 3], (0, 0), 10)[..., None] * opacity * shadow
        frame = frame * (1 - sh)
    frame = frame * (1 - a) + rgba[..., :3] * opacity
    if add is not None: frame = frame + add * opacity
    return frame

L = {n: Layer(n) for n in ['emblem', 'studio', 'presents', 'credit1', 'credit2', 'title', 'titleglow', 'tagR', 'tagY', 'past']}

# ---------------- embers / sparks ----------------
NE = 140
E = dict(x=rng.uniform(0, W, NE), y=rng.uniform(0, H, NE), v=rng.uniform(18, 70, NE),
         s=rng.uniform(1.2, 3.6, NE), ph=rng.uniform(0, 6.28, NE), f=rng.uniform(0.3, 1.2, NE),
         b=rng.uniform(0.35, 1.0, NE))

def embers(t, amount, speed=1.0, count=NE):
    if amount <= 0.001: return None
    cw, ch = W // 2, H // 2
    can = np.zeros((ch, cw), np.float32)
    for i in range(count):
        y = (E['y'][i] - E['v'][i] * speed * t) % (H + 40) - 20
        x = E['x'][i] + 25 * math.sin(E['ph'][i] + t * E['f'][i])
        fl = 0.6 + 0.4 * math.sin(E['ph'][i] * 3 + t * 6 * E['f'][i])
        cv2.circle(can, (int(x / 2), int(y / 2)), max(1, int(E['s'][i] / 2 + 0.5)), float(E['b'][i] * fl), -1, cv2.LINE_AA)
    can = cv2.GaussianBlur(can, (0, 0), 1.2) * 1.4 + cv2.GaussianBlur(can, (0, 0), 6) * 2.0
    can = cv2.resize(can, (W, H), interpolation=cv2.INTER_LINEAR)
    return can[..., None] * np.array([1.0, 0.52, 0.16], np.float32) * amount

# ---------------- opening ----------------
SHOTS = [  # flute shots (intermediate coords 1620x1500), output times T
    dict(t0=8.2, t1=12.4, cx=810, cy=440, w=1620, z0=1.0, z1=1.06, dx=0, dy=0),
    dict(t0=11.8, t1=15.8, cx=990, cy=425, w=1250, z0=1.0, z1=1.07, dx=-25, dy=0),
    dict(t0=15.2, t1=18.6, cx=690, cy=1100, w=1300, z0=1.06, z1=1.0, dx=40, dy=-20),
    dict(t0=18.0, t1=24.6, cx=810, cy=460, w=1620, z0=1.12, z1=1.0, dx=0, dy=0),
]
XF = 0.6

def opening(T):
    frame = np.zeros((H, W, 3), np.float32)
    act = frame[BAR:BAR + AH]
    # footage
    vis = [s for s in SHOTS if s['t0'] - 1e-6 <= T < s['t1']]
    if vis:
        src = flute.get(round((T - FL_OFF) * FPS))
        pic = None
        for s in vis:
            u = lin(T, s['t0'], s['t1'])
            z = s['z0'] + (s['z1'] - s['z0']) * smooth(u)
            sc = W * z / s['w']
            img = view(src, s['cx'] + s['dx'] * u, s['cy'] + s['dy'] * u, sc, W, AH)
            a = 1.0 if s is SHOTS[0] else smooth(lin(T, s['t0'], s['t0'] + XF))
            pic = img.astype(np.float32) if pic is None else pic * (1 - a) + img.astype(np.float32) * a
        g = grade(np.clip(pic, 0, 65535).astype(np.uint16), 'flute')
        g = glow(g, 5, 0.25) * VIG
        fade_in = smooth(lin(T, 8.2, 9.8))
        dim = 1 - 0.62 * smooth(lin(T, 19.25, 19.6))
        if T > 19.2:
            b = 7 * smooth(lin(T, 19.2, 19.6))
            g = cv2.GaussianBlur(g, (0, 0), b)
        fade_out = 1 - smooth(lin(T, 23.5, 24.4))
        act[:] = g * fade_in * dim * fade_out
    # logo
    if 2.2 < T < 8.8:
        grp = 1.0 + 0.035 * lin(T, 2.4, 8.6)
        go = 1 - smooth(lin(T, 7.5, 8.6))
        u = lin(T, 2.4, 3.8)
        em = L['emblem'].render(scale=grp * (0.9 + 0.1 * ease_out(u)), blur=10 * (1 - ease_out(u)))
        sw_pos = -600 + 3200 * smooth(lin(T, 4.5, 6.2))
        frame = comp(frame, em, smooth(u) * go, add=sweep(em, sw_pos, 70, 0.4, 0.9) if 4.5 < T < 6.2 else None)
        u2 = lin(T, 3.2, 4.7)
        st = L['studio'].render(scale=grp * (1.06 - 0.06 * ease_out(u2)), blur=14 * (1 - ease_out(u2)))
        frame = comp(frame, st, smooth(u2) * go, add=sweep(st, sw_pos - 250, 90, 0.4, 1.1) if 4.5 < T < 6.4 else None)
        u3 = lin(T, 5.5, 6.9)
        pr = L['presents'].render(scale=grp, sx=0.94 + 0.06 * ease_out(u3), blur=4 * (1 - u3))
        frame = comp(frame, pr, smooth(u3) * go)
    # credits
    for name, a, b in (('credit1', 12.6, 15.3), ('credit2', 15.9, 18.6)):
        if a < T < b:
            u = lin(T, a, a + 0.9)
            ly = L[name].render(dx=12 * (lin(T, a, b) - 0.5), blur=6 * (1 - ease_out(u)))
            frame = comp(frame, ly, env(T, a, a + 0.9, b - 0.7, b), shadow=0.6)
    # title
    if T >= 19.4:
        u = lin(T, 19.4, 19.68)
        push = 1.0 + 0.06 * lin(T, 19.7, 24.4)
        sc = (1.32 - 0.32 * ease_out(u)) * push
        op = smooth(lin(T, 19.4, 19.52)) * (1 - smooth(lin(T, 23.5, 24.3)))
        gl = L['titleglow'].render(scale=sc)
        pulse = 0.55 + 0.25 * math.sin((T - 19.4) * 2.4) + 0.6 * math.exp(-(T - 19.4) * 3)
        frame = frame + gl[..., :3] * op * pulse * 0.8
        ti = L['title'].render(scale=sc, blur=3 * (1 - u))
        swp = -500 + 3400 * smooth(lin(T, 20.4, 21.6))
        frame = comp(frame, ti, op, add=sweep(ti, swp, 80, 0.45, 0.8) if 20.4 < T < 21.6 else None)
        fl = math.exp(-(T - 19.4) * 11) * 0.55
        frame[BAR:BAR + AH] = frame[BAR:BAR + AH] + fl * np.array([1.0, 0.75, 0.5], np.float32)
    # embers
    am = 0.55 * env(T, 0.3, 2.5, 7.8, 8.8) + 1.0 * env(T, 19.4, 19.9, 23.4, 24.4)
    sp = 1.0 if T < 12 else 2.6
    e = embers(T, am, sp)
    if e is not None: frame = frame + e
    frame = add_grain(frame, 0.022)
    return frame

# ---------------- talk + flashback ----------------
VSTILL = None
REW_CACHE = {}

def talk_view(s):
    e = smooth(lin(s, 6.6, REW0))
    z = 1.0 + 0.45 * e
    cx = 1280 + (885 - 1280) * e
    cy = 665 + (540 - 665) * e
    hw = 1280 / z; hh = (AH / 0.75 / z) / 2
    return z, clamp(cx, hw, 2560 - hw), clamp(cy, hh, 1440 - hh)

def talk_scene(s):
    frame = np.zeros((H, W, 3), np.float32)
    act = frame[BAR:BAR + AH]
    idx = round(s * FPS)
    src = talk.get(idx)
    REW_CACHE[idx] = cv2.resize(src, (1280, 720), interpolation=cv2.INTER_AREA)
    z, cx, cy = talk_view(s)
    img = view(src, cx, cy, 0.75 * z, W, AH)
    e = smooth(lin(s, 6.6, REW0))
    g = grade(img, 'talk', sat=0.88 - 0.38 * e)
    g = glow(g, 6 + 4 * e, 0.22 + 0.55 * e)
    g = g * (VIG * (1 - e) + VIG_STRONG * e)
    g = g + e * 0.06 * np.array([1.0, 0.8, 0.55], np.float32)       # dreamy warm haze
    act[:] = g * smooth(lin(s, 0.0, 0.8))
    for name, a, b, side in (('tagR', 0.9, 4.3, -1), ('tagY', 1.4, 4.8, 1)):
        if a < s < b:
            u = ease_out(lin(s, a, a + 0.7))
            ly = L[name].render(dx=side * 40 * (1 - u), blur=5 * (1 - u))
            frame = comp(frame, ly, env(s, a, a + 0.5, b - 0.6, b), shadow=0.5)
    return add_grain(frame, 0.022)

def rewind(s):
    u = lin(s, REW0, REW1)
    i0 = round(REW0 * FPS)
    idx = int(round(i0 * (1 - u ** 1.4)))
    near = min(REW_CACHE.keys(), key=lambda k: abs(k - idx)) if REW_CACHE else None
    if near is None or abs(near - idx) > 1:
        REW_CACHE[idx] = cv2.resize(talk.get(idx), (1280, 720), interpolation=cv2.INTER_AREA); near = idx
    src = REW_CACHE[near]
    z0, cx, cy = talk_view(REW0)
    z = z0 * (1 + 0.65 * ease_in(u))
    rot = 9 * ease_in(u)
    acc = None
    for k in range(4):                                   # zoom blur
        zk = z * (1 + 0.035 * k * (0.2 + u))
        im = view(src, cx / 2, cy / 2, 1.5 * zk, W, AH, rot=rot, interp=cv2.INTER_LINEAR).astype(np.float32)
        acc = im if acc is None else acc + im
    img = (acc / 4).astype(np.uint16)
    g = grade(img, 'talk', sat=0.5)
    g = glow(g, 10, 0.77) * VIG_STRONG + 0.06 * np.array([1.0, 0.8, 0.55], np.float32)
    # rgb split
    d = int(4 + 34 * u * u)
    g[..., 0] = np.roll(g[..., 0], -d, axis=1); g[..., 2] = np.roll(g[..., 2], d, axis=1)
    # VHS tracking: row offsets in bands
    off = np.zeros(AH, np.float32)
    for _ in range(3 + int(6 * u)):
        y0 = rng.integers(0, AH); hgt = rng.integers(6, 60)
        off[y0:y0 + hgt] += rng.uniform(-1, 1) * (6 + 40 * u)
    mx = (np.arange(W, dtype=np.float32)[None, :] + off[:, None]).astype(np.float32)
    my = np.repeat(np.arange(AH, dtype=np.float32)[:, None], W, axis=1)
    g = cv2.remap(g, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    scan = (1 - 0.18 * u * ((np.arange(AH) // 2) % 2))[:, None, None].astype(np.float32)
    g = g * scan * (1 + rng.uniform(-0.1, 0.1) * u)
    g = glow(g, 8, 0.6)
    wv = u ** 2.2
    g = g * (1 - wv) + wv
    frame = np.zeros((H, W, 3), np.float32)
    frame[BAR:BAR + AH] = g
    if u > 0.75:   # bars dissolve into the white
        frame = frame * (1 - (u - 0.75) / 0.25) + ((u - 0.75) / 0.25)
    return add_grain(frame, 0.03)

def vintage_base():
    src = talk.get(90)
    g = grade(src, 'talk', sat=0.0)
    lum = np.clip(g[..., 0], 0, 1) ** 0.72
    lum = np.clip(0.08 + 0.86 * lum, 0, 1)
    sep = np.stack([lum * 1.08 + 0.02, lum * 0.93 + 0.015, lum * 0.72 + 0.0], 2)
    sep = cv2.GaussianBlur(sep, (0, 0), 4.5)
    return np.clip(sep, 0, 1).astype(np.float32)

GX0, GW = (W - 1440) // 2, 1440
GATE = None

def gate_mask():
    m = np.zeros((H, GW), np.float32)
    cv2.rectangle(m, (18, 14), (GW - 19, H - 15), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), 7)
    return m[..., None]

WEAVE = cv2.GaussianBlur(rng.standard_normal((800, 2)).astype(np.float32), (1, 0), 1.5) * 2.5

def vintage(s):
    global VSTILL, GATE
    if VSTILL is None: VSTILL = vintage_base()
    if GATE is None: GATE = gate_mask()
    t = s - REW1; fi = int(t * FPS)
    z = 1.0 + 0.09 * lin(t, 0, 5.6)
    wx, wy = WEAVE[fi % 800]
    img = view(VSTILL, 1290 + wx, 430 + wy, 1.5 * z, GW, H, rot=0.15 * math.sin(t * 1.7), interp=cv2.INTER_LINEAR)
    flick = 1 + 0.06 * rng.standard_normal() * 0.6 + 0.03 * math.sin(t * 23)
    img = img * flick
    vg = vignette_mask(GW, H, 0.95, 1.5, 1.0) if not hasattr(vintage, 'vg') else vintage.vg
    vintage.vg = vg
    img = img * vg
    # light leak
    lk = np.zeros((H // 4, GW // 4), np.float32)
    cx = GW // 4 * (1.0 - 0.12 * lin(t, 0, 5.6)); cy = H // 4 * (0.12 + 0.08 * math.sin(t * 0.8))
    cv2.circle(lk, (int(cx), int(cy)), 100, 1.0, -1)
    lk = cv2.resize(cv2.GaussianBlur(lk, (0, 0), 45), (GW, H))
    leak = (0.22 + 0.35 * math.exp(-t * 1.5)) * (0.85 + 0.15 * math.sin(t * 2.3))
    img = 1 - (1 - img) * (1 - lk[..., None] * leak * np.array([1.0, 0.45, 0.15], np.float32))
    # text
    if s > 11.3:
        u = lin(s, 11.3, 12.6)
        ly = L['past'].render(scale=1.03 - 0.03 * ease_out(u), dy=wy, dx=wx, blur=6 * (1 - ease_out(u)))
        ly = np.ascontiguousarray(ly[:, GX0:GX0 + GW])
        if not hasattr(vintage, 'halo'):
            hm = np.zeros((H, GW), np.float32)
            cv2.ellipse(hm, (GW // 2, H // 2), (520, 110), 0, 0, 360, 1.0, -1)
            vintage.halo = cv2.GaussianBlur(hm, (0, 0), 60)[..., None]
        img = img * (1 - 0.45 * smooth(u) * vintage.halo)
        img = comp(img, ly, smooth(u) * flick, shadow=0.6)
    # dust & scratches
    for _ in range(rng.integers(2, 9)):
        x, y = rng.integers(0, GW), rng.integers(0, H)
        c = 0.0 if rng.random() < 0.6 else 0.95
        cv2.circle(img, (int(x), int(y)), int(rng.integers(1, 4)), (c, c * 0.95, c * 0.85), -1, cv2.LINE_AA)
    if rng.random() < 0.35:
        x = int(rng.integers(40, GW - 40))
        cv2.line(img, (x, 0), (x + int(rng.integers(-15, 15)), H), (0.9, 0.85, 0.7) if rng.random() < 0.5 else (0.1, 0.08, 0.05), 1, cv2.LINE_AA)
    gimg = np.zeros((H, W, 3), np.float32)
    gimg[:, GX0:GX0 + GW] = img * GATE
    gimg = add_grain(gimg, 0.045, big=True)
    gimg[:, :GX0] = 0; gimg[:, GX0 + GW:] = 0
    wv = math.exp(-t / 0.32)
    out = gimg * (1 - wv) + wv
    out = out * (1 - smooth(lin(s, 15.0, 15.95)))
    return out

def frame_at(T):
    if T < TALK_OFF: return opening(T)
    s = T - TALK_OFF
    if s < REW0: return talk_scene(s)
    if s < REW1: return rewind(s)
    return vintage(s)

def to8(f):
    return (np.clip(f, 0, 1) * 255 + rng.uniform(-0.5, 0.5, f.shape[:2])[..., None] + 0.5).clip(0, 255).astype(np.uint8)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'preview':
        outdir = sys.argv[2]; os.makedirs(outdir, exist_ok=True)
        ts = [float(x) for x in sys.argv[3:]]
        for T in sorted(ts):
            f = frame_at(T)
            cv2.imwrite(os.path.join(outdir, f'f_{T:06.2f}.jpg'), to8(f)[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
            print('ok', T, flush=True)
    else:
        out = sys.argv[2]
        nfr = int(round(TOTAL * FPS))
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                                '-i', os.path.join(D, 'audio/mix.wav'),
                                '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                                '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'grain',
                                '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                                '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out],
                               stdin=subprocess.PIPE)
        import time; t0 = time.time()
        for n in range(nfr):
            f = frame_at(n / FPS)
            enc.stdin.write(to8(f).tobytes())
            if n % 60 == 0: print(f'{n}/{nfr} {time.time() - t0:.0f}s', flush=True)
        enc.stdin.close(); enc.wait()
        print('done', time.time() - t0)
