"""Tracking-driven 'French Dubi' look: fatter body and face, flies and stink lines."""
import numpy as np, cv2, json, math, os

D = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080


def load_track(clip, max_gap=8, win=7):
    raw = json.load(open(os.path.join(D, f'track_c{clip}.json')))
    frames = sorted(int(k) for k in raw if k != 'all')
    pts = {n: np.array(raw[str(n)]['pts'], np.float32) for n in frames if raw[str(n)]}
    if not pts: return {}
    lo, hi = min(pts), max(pts)
    # fill short gaps by linear interpolation
    keys = sorted(pts)
    for a, b in zip(keys, keys[1:]):
        if 1 < b - a <= max_gap:
            for n in range(a + 1, b):
                u = (n - a) / (b - a); pts[n] = pts[a] * (1 - u) + pts[b] * u
    keys = sorted(pts)
    # contiguous segments
    segs, cur = [], [keys[0]]
    for n in keys[1:]:
        if n == cur[-1] + 1: cur.append(n)
        else: segs.append(cur); cur = [n]
    segs.append(cur)
    out = {}
    for seg in segs:
        if len(seg) < 4: continue
        arr = np.stack([pts[n] for n in seg])
        sm = arr.copy()
        k = win // 2
        for i in range(len(seg)):
            a, b = max(0, i - k), min(len(seg), i + k + 1)
            sm[i, :, :2] = arr[a:b, :, :2].mean(0)
        L = len(seg)
        for i, n in enumerate(seg):
            edge = min(i + 1, L - i) / 6.0
            out[n] = (sm[i], min(1.0, edge))
    return out


def geometry(lm):
    p = lm[:, :2]
    sh = (p[11] + p[12]) / 2; hp = (p[23] + p[24]) / 2
    th = float(np.linalg.norm(hp - sh)) + 1e-3
    sw = float(np.linalg.norm(p[11] - p[12]))
    bw = max(sw, 0.55 * th)
    u = (hp - sh) / th; v = np.array([-u[1], u[0]], np.float32)
    ears = (p[7] + p[8]) / 2
    hs = max(float(np.linalg.norm(p[7] - p[8])), 0.33 * sw, 0.24 * th)
    head = ears * 0.5 + p[0] * 0.5
    return dict(sh=sh, hp=hp, th=th, bw=bw, u=u, v=v, head=head, hs=hs)


def _bulge(mx, my, X, Y, c, u, v, rw, rh, k, vert=0.3):
    dx = X - c[0]; dy = Y - c[1]
    a = (dx * v[0] + dy * v[1]); b = (dx * u[0] + dy * u[1])
    r2 = (a / rw) ** 2 + (b / rh) ** 2
    f = np.where(r2 < 1, (1 - r2) ** 2, 0).astype(np.float32) * k
    mx -= f * (a * v[0] + vert * b * u[0])
    my -= f * (a * v[1] + vert * b * u[1])


def fatten(img, lm, amount=1.0):
    """img: HxWx3 (any dtype). Returns warped copy."""
    g = geometry(lm)
    bw, th, hs = g['bw'], g['th'], g['hs']
    belly = g['sh'] * 0.38 + g['hp'] * 0.62
    face = g['head'] + g['u'] * hs * 0.45
    R = max(1.7 * bw, 1.5 * th)
    x0 = int(max(0, min(belly[0], face[0]) - R)); x1 = int(min(W, max(belly[0], face[0]) + R))
    y0 = int(max(0, face[1] - 2 * hs - 10)); y1 = int(min(H, g['hp'][1] + 1.0 * th))
    if x1 - x0 < 8 or y1 - y0 < 8: return img
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    mx = X.copy(); my = Y.copy()
    _bulge(mx, my, X, Y, belly, g['u'], g['v'], 1.15 * bw, 0.95 * th, 0.42 * amount, 0.35)
    _bulge(mx, my, X, Y, (g['sh'] + g['hp']) / 2, g['u'], g['v'], 1.75 * bw, 1.35 * th, 0.17 * amount, 0.1)
    _bulge(mx, my, X, Y, face, g['u'], g['v'], 1.05 * hs, 0.95 * hs, 0.34 * amount, 0.25)
    out = img.copy()
    out[y0:y1, x0:x1] = cv2.remap(img, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return out


_rng = np.random.default_rng(5)
FLY = [dict(r=_rng.uniform(0.9, 1.6), fx=_rng.uniform(2.1, 3.3), fy=_rng.uniform(2.6, 4.1), ph=_rng.uniform(0, 6.3)) for _ in range(4)]


def fly_positions(lm, t):
    g = geometry(lm); hs = g['hs']; c = g['head'] - g['u'] * hs * 0.2
    out = []
    for i, f in enumerate(FLY):
        a = t * f['fx'] * 2 + f['ph']; b = t * f['fy'] * 2 + f['ph'] * 1.7
        x = c[0] + math.sin(a) * hs * f['r'] * 1.2 + math.sin(t * 13 + i) * hs * 0.05
        y = c[1] + math.sin(b) * hs * f['r'] * 0.7 - hs * 0.4
        out.append((x, y, hs))
    return out


def draw_flies(frame, lm, t, amount=1.0, sx=1.0, sy=1.0, ox=0.0, oy=0.0):
    """frame float RGB in output space; (sx,sy,ox,oy) maps source px -> output px"""
    if amount <= 0.01: return frame
    for i, (x, y, hs) in enumerate(fly_positions(lm, t)):
        X = x * sx + ox; Y = y * sy + oy
        s = max(3.0, hs * sx * 0.10)
        if not (-20 < X < frame.shape[1] + 20 and -20 < Y < frame.shape[0] + 20): continue
        wing = 0.5 + 0.5 * math.sin(t * 90 + i * 2)
        ov = frame.copy()
        cv2.ellipse(ov, (int(X - s * 0.9), int(Y - s * 0.7)), (int(s * 1.2), int(max(1, s * 0.6 * wing + 1))), 30, 0, 360, (0.85, 0.88, 0.92), -1, cv2.LINE_AA)
        cv2.ellipse(ov, (int(X + s * 0.9), int(Y - s * 0.7)), (int(s * 1.2), int(max(1, s * 0.6 * (1 - wing) + 1))), -30, 0, 360, (0.85, 0.88, 0.92), -1, cv2.LINE_AA)
        frame[:] = frame * (1 - 0.45 * amount) + ov * 0.45 * amount
        cv2.ellipse(frame, (int(X), int(Y)), (int(s), int(s * 0.7)), 0, 0, 360, (0.04, 0.04, 0.03), -1, cv2.LINE_AA)
    return frame


def stink(frame, lm, t, amount=1.0, sx=1.0, sy=1.0, ox=0.0, oy=0.0):
    if amount <= 0.01: return frame
    g = geometry(lm); hs = g['hs']; bw = g['bw']
    layer = np.zeros(frame.shape[:2], np.float32)
    base_pts = [g['sh'] + g['v'] * bw * 0.55, (g['sh'] + g['hp']) / 2 - g['v'] * bw * 0.65, g['head'] + g['v'] * hs * 0.9]
    for j, b in enumerate(base_pts):
        for k in range(2):
            ph = (t * 0.9 + j * 0.37 + k * 0.5) % 1.0
            pts = []
            for i in range(14):
                q = i / 13
                yy = b[1] - (q + ph) * hs * 2.6
                xx = b[0] + math.sin(q * 7 + t * 5 + j + k) * hs * 0.22
                pts.append((xx * sx + ox, yy * sy + oy))
            al = math.sin(math.pi * ph)
            cv2.polylines(layer, [np.array(pts, np.int32)], False, float(al), max(3, int(hs * sx * 0.09)), cv2.LINE_AA)
    layer = cv2.GaussianBlur(layer, (0, 0), 3.0)[..., None] * 0.75 * amount
    col = np.array([0.72, 0.95, 0.35], np.float32)
    frame[:] = frame * (1 - layer) + col * layer
    return frame
