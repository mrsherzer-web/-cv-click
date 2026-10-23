"""Renderer for the film "הדרך".

usage: film_render.py MOVIEDIR part K0 K1 OUT.mp4
       film_render.py MOVIEDIR preview K [K ...]
"""
import math
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

M = sys.argv[1]
MODE = sys.argv[2]
sys.path.insert(0, M + "/src")
import spec  # noqa: E402
from spec import END, FPS, H, HITS, SHOTS, SHUTTERS, W, bt  # noqa: E402

NF = int(END * FPS)
RPM = np.load(f"{M}/work/rpm.npy")


def load(n, w, h):
    return np.memmap(f"{M}/work/{n}.rgb", dtype=np.uint8, mode="r").reshape(-1, h, w, 3)


CLIPS = {"c3360": load("c3360", 1080, 1920), "c1138": load("c1138", 1080, 1920), "c9eac": load("c9eac", 1080, 1920),
         "c5875": load("c5875", 480, 880), "gem": load("gem", 1280, 720), "bar": load("bar", 1080, 1920)}

# ------------------------------------------------------------------ helpers
def clamp01(x):
    return max(0.0, min(1.0, x))


def prog(t, a, b):
    return clamp01((t - a) / (b - a)) if b > a else float(t >= a)


def eo(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def eio(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def lerp(a, b, x):
    return a + (b - a) * x


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
RR = np.sqrt(((xx - W / 2) / (W * 0.72)) ** 2 + ((yy - H / 2) / (H * 0.72)) ** 2)
VIG = np.clip(1 - 0.42 * RR ** 2.4, 0, 1)[..., None].astype(np.float32)
BOTTOM_SHADE = smooth((yy - 1180) / 520)[..., None].astype(np.float32)
del RR


def warp(src, M2, size=(W, H)):
    return cv2.warpAffine(np.asarray(src), M2, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)


def affine(scale, src_c, dst_c, rot=0.0):
    c, s = math.cos(rot) * scale, math.sin(rot) * scale
    return np.array([[c, -s, dst_c[0] - (c * src_c[0] - s * src_c[1])],
                     [s, c, dst_c[1] - (s * src_c[0] + c * src_c[1])]], np.float32)


def grade(x, expo=1.0, warm=0.0):
    """Unified film look: gentle S-curve, teal shadows / warm highlights."""
    x = x.astype(np.float32) / 255 if x.dtype == np.uint8 else x
    x = np.clip(x * expo, 0, 1)
    x = x + 0.12 * (x - x * x * (3 - 2 * x)) * -1  # soft S
    lum = x @ np.array([0.299, 0.587, 0.114], np.float32)
    sh = ((1 - lum) ** 2)[..., None]
    hi = (lum ** 2)[..., None]
    x = x + sh * np.array([-0.025, 0.005, 0.03], np.float32) + hi * np.array([0.03 + warm, 0.012, -0.02],
                                                                           np.float32)
    x = lum[..., None] + (x - lum[..., None]) * 1.06
    return np.clip(x * 0.97 + 0.012, 0, 1)


def cover_crop(img):
    h, w = img.shape[:2]
    if w / h > W / H:
        cw = int(h * W / H)
        return img[:, (w - cw) // 2:(w - cw) // 2 + cw]
    ch = int(w * H / W)
    return img[(h - ch) // 2:(h - ch) // 2 + ch]


def blur_cover(img, sigma=4, dark=0.42):
    small = cv2.resize(cover_crop(img), (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    return cv2.resize(cv2.GaussianBlur(small, (0, 0), sigma), (W, H), interpolation=cv2.INTER_LINEAR) * dark


# ------------------------------------------------------------------ text
FONTS = {"serif": f"{M}/fonts/FrankRuhlLibre%5Bwght%5D.ttf", "sans": f"{M}/fonts/Heebo%5Bwght%5D.ttf",
         "bebas": f"{M}/fonts/BebasNeue-Regular.ttf", "mont": f"{M}/fonts/Montserrat%5Bwght%5D.ttf"}
_fc, _sc = {}, {}


def font(kind, size, wght):
    k = (kind, size, wght)
    if k not in _fc:
        f = ImageFont.truetype(FONTS[kind], size)
        if kind in ("serif", "sans", "mont"):
            f.set_variation_by_axes([wght])
        _fc[k] = f
    return _fc[k]


def sprite(s, kind, size, wght=400, track=0, shadow=10):
    """Returns (alpha, shadow_alpha) float arrays, RTL-aware."""
    key = (s, kind, size, wght, track, shadow)
    if key in _sc:
        return _sc[key]
    f = font(kind, size, wght)
    heb = any("֐" <= ch <= "׿" for ch in s)
    kw = dict(direction="rtl", language="he") if heb else {}
    pad = shadow * 3 + 10
    if track and not heb:
        widths = [f.getlength(ch) for ch in s]
        tw = sum(widths) + track * (len(s) - 1)
        asc, desc = f.getmetrics()
        img = Image.new("L", (int(tw) + 2 * pad, asc + desc + 2 * pad))
        d = ImageDraw.Draw(img)
        x = pad
        for ch, wd in zip(s, widths):
            d.text((x, pad + asc), ch, font=f, fill=255, anchor="ls")
            x += wd + track
    else:
        tmp = ImageDraw.Draw(Image.new("L", (8, 8)))
        bb = tmp.textbbox((0, 0), s, font=f, anchor="ls", **kw)
        asc, desc = f.getmetrics()
        tw = bb[2] - bb[0]
        img = Image.new("L", (int(tw) + 2 * pad, asc + desc + 2 * pad))
        ImageDraw.Draw(img).text((pad - bb[0], pad + asc), s, font=f, fill=255, anchor="ls", **kw)
    a = np.asarray(img, np.float32) / 255
    sh = np.asarray(img.filter(ImageFilter.GaussianBlur(shadow)), np.float32) / 255 if shadow else None
    _sc[key] = (a, sh, pad)
    return _sc[key]


def draw_text(img, s, x, y, kind="serif", size=60, wght=400, col=(1, 1, 1), a=1.0, ax="c", track=0,
              shadow=10, sh_a=0.75, glow=0.0):
    """Anchor (x, y): ax in l/c/r is horizontal, y is the vertical centre of the line."""
    if a <= 0.01 or not s:
        return
    al, sh, pad = sprite(s, kind, size, wght, track, shadow)
    h, w = al.shape
    x0 = x - pad - (0 if ax == "l" else (w - 2 * pad) / 2 if ax == "c" else (w - 2 * pad))
    y0 = y - h / 2
    x0, y0 = int(round(x0)), int(round(y0))
    xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xe <= xs or ye <= ys:
        return
    sub = (slice(ys - y0, ye - y0), slice(xs - x0, xe - x0))
    roi = img[ys:ye, xs:xe]
    if sh is not None:
        roi *= 1 - (sh[sub] * sh_a * a)[..., None]
    if glow > 0 and sh is not None:
        roi += (sh[sub] * glow * a)[..., None] * np.array(col, np.float32) * 0.6
    aa = (al[sub] * a)[..., None]
    roi[:] = roi * (1 - aa) + np.array(col, np.float32) * aa


def text_width(s, kind, size, wght=400, track=0):
    al, _, pad = sprite(s, kind, size, wght, track, 10)
    return al.shape[1] - 2 * pad


WARM = (1.0, 0.95, 0.88)
AMBER = (1.0, 0.77, 0.43)


def chapter_tag(img, t, t0, t1, date, line, y=1470):
    a_out = 1 - prog(t, t1 - 0.42, t1 - 0.12)
    a1 = eo(prog(t, t0 + 0.12, t0 + 0.55)) * a_out
    a2 = eo(prog(t, t0 + 0.35, t0 + 0.8)) * a_out
    if a1 <= 0:
        return
    img *= 1 - BOTTOM_SHADE * 0.55 * max(a1, a2)
    xr = W - 86
    draw_text(img, date, xr + 26 * (1 - a1), y, "sans", 44, 700, AMBER, a1, ax="r", shadow=8)
    ln = 170 * eo(prog(t, t0 + 0.2, t0 + 0.7))
    if ln > 1:
        cv2.line(img, (int(xr), y + 40), (int(xr - ln), y + 40), (AMBER[0] * a1, AMBER[1] * a1, AMBER[2] * a1), 3,
                 cv2.LINE_AA)
    draw_text(img, line, xr, y + 108 + 14 * (1 - a2), "serif", 60, 500, WARM, a2, ax="r", shadow=12)


# ------------------------------------------------------------------ procedural layers
rg = np.random.default_rng(3)
DUST = [(rg.uniform(0, W), rg.uniform(0, H), rg.uniform(0.6, 2.2), rg.uniform(0.2, 0.7), rg.uniform(-14, 14),
         rg.uniform(-24, -6)) for _ in range(90)]


def dust(img, t, a=1.0):
    for (x, y, r, br, vx, vy) in DUST:
        px, py = (x + vx * t) % W, (y + vy * t) % H
        tw = 0.6 + 0.4 * math.sin(t * 2 + x)
        cv2.circle(img, (int(px * 16), int(py * 16)), int(r * 16), (br * tw * a * 0.5,) * 3, -1, cv2.LINE_AA, 4)


RAIN = [(rg.uniform(-200, W + 200), rg.uniform(0, H), rg.uniform(40, 130), rg.uniform(0.25, 1.0)) for _ in range(420)]


def rain_layer(img, t, a=1.0, speed=2600, ang=0.22):
    lay = np.zeros((H, W), np.float32)
    for (x, y, ln, br) in RAIN:
        yy0 = (y + speed * br * t) % (H + 200) - 100
        xx0 = x - ang * (yy0 - y) * 0.0
        dx, dy = ang * ln, ln
        th = 2 if br > 0.8 else 1
        cv2.line(lay, (int(xx0 * 16), int(yy0 * 16)), (int((xx0 - dx) * 16), int((yy0 - dy) * 16)), br * 0.55, th,
                 cv2.LINE_AA, 4)
    lay = cv2.GaussianBlur(lay, (0, 0), 0.8)
    img += (lay * a)[..., None] * np.array([0.8, 0.88, 1.0], np.float32)


BOKEH = np.zeros((H + 200, W + 200, 3), np.float32)
for _ in range(34):
    c = np.array(rg.choice([[1.0, 0.66, 0.32], [1.0, 0.66, 0.32], [0.8, 0.85, 1.0], [1.0, 0.3, 0.22]]))
    c = c * 0.65 + 0.35 * c.mean()
    k = rg.uniform(0.1, 0.3)
    cv2.circle(BOKEH, (int(rg.uniform(0, W + 200)), int(rg.uniform(0, 900))), int(rg.uniform(18, 64)),
               [float(v) * k for v in c], -1, cv2.LINE_AA)
BOKEH = cv2.GaussianBlur(BOKEH, (0, 0), 10)

# warm drifting bokeh for the title and the ending
WARMBK = np.zeros((H + 600, W, 3), np.float32)
for _ in range(70):
    c = np.array(rg.choice([[1.0, 0.72, 0.4], [1.0, 0.6, 0.3], [1.0, 0.85, 0.6], [0.7, 0.8, 1.0]]))
    r0 = int(rg.uniform(10, 90))
    k = rg.uniform(0.05, 0.22) * (40 / (r0 + 20)) ** 0.5
    cv2.circle(WARMBK, (int(rg.uniform(-60, W + 60)), int(rg.uniform(0, H + 600))), r0,
               [float(v) * k for v in c], -1, cv2.LINE_AA)
WARMBK = cv2.GaussianBlur(WARMBK, (0, 0), 7)


def warm_bg(t, dark=1.0):
    img = np.zeros((H, W, 3), np.float32)
    img += np.linspace(0.035, 0.008, H, dtype=np.float32)[:, None, None] * np.array([1.0, 0.8, 0.65], np.float32)
    oy = int(600 - (t * 22) % 600)
    img += WARMBK[oy:oy + H]
    return img * dark


def light_leak(img, t, t0, dur, seed=0):
    p = prog(t, t0, t0 + dur)
    if p <= 0 or p >= 1:
        return img
    a = math.sin(math.pi * p) * 0.55
    r = np.random.default_rng(seed)
    cx = lerp(r.uniform(-200, 300), r.uniform(700, 1300), p)
    cy = r.uniform(300, 1500)
    g = np.exp(-(((xx - cx) / 520) ** 2 + ((yy - cy) / 900) ** 2))[..., None]
    col = np.array([1.0, 0.55, 0.22], np.float32)
    return 1 - (1 - img) * (1 - g * col * a)


# ------------------------------------------------------------------ Corvette layers
def car_layer(name, plate=False, kill=None):
    rgb = cv2.cvtColor(cv2.imread(f"{M}/vette_cut/{name}_rgb.png"), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    mk = cv2.imread(f"{M}/vette_cut/{name}_mask.png", cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    if kill:
        x0, y0, x1, y1 = kill
        mk[y0:y1, x0:x1] = 0
    mk = cv2.erode(mk, np.ones((3, 3), np.uint8))
    mk = cv2.GaussianBlur(mk, (0, 0), 1.0)
    if plate:
        rgb = israeli_plate(rgb, plate)
    return rgb, mk


def israeli_plate(rgb, box):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    S = 6
    im = Image.new("RGB", (w * S, h * S), (248, 204, 18))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w * S - 1, h * S - 1], outline=(15, 15, 15), width=int(1.6 * S))
    bw = int(w * S * 0.13)
    d.rectangle([int(1.6 * S), int(1.6 * S), bw, h * S - int(1.6 * S)], fill=(0, 56, 168))
    fs = ImageFont.truetype(FONTS["mont"], int(h * S * 0.27))
    fs.set_variation_by_axes([700])
    d.text((bw / 2 + S, h * S * 0.68), "IL", font=fs, fill=(255, 255, 255), anchor="mm")
    avail = w * S - bw - 6 * S
    fsz = int(h * S * 0.62)
    fn = ImageFont.truetype(FONTS["bebas"], fsz)
    while fn.getlength("20-101-10") > avail and fsz > 10:
        fsz -= 2
        fn = ImageFont.truetype(FONTS["bebas"], fsz)
    d.text(((bw + w * S) / 2, h * S * 0.54), "20-101-10", font=fn, fill=(12, 12, 12), anchor="mm")
    pl = np.asarray(im.resize((w, h), Image.LANCZOS), np.float32) / 255
    shade = rgb[y0:y1, x0:x1].mean() / max(pl.mean(), 1e-3)
    out = rgb.copy()
    out[y0:y1, x0:x1] = pl * min(1.0, 0.75 * shade + 0.25)
    return out


CARS = {
    "004481": car_layer("004481"),
    "004504": car_layer("004504", kill=(1620, 540, 1940, 710)),
    "004475": car_layer("004475", plate=(738, 494, 867, 556)),
}
CARS["004481b"] = CARS["004481"]


def car_scene(t, name, Mc, expo=1.0, sweep=None, flares=(), tail=(), refl_y=None, cam_bob=0.0):
    """Car cut-out on a dark wet stage with reflection, bokeh and rain."""
    rgb, mk = CARS[name]
    base = np.zeros((H, W, 3), np.float32)
    grad = np.linspace(0.06, 0.012, H, dtype=np.float32)[:, None, None]
    base += grad * np.array([0.55, 0.7, 1.0], np.float32)
    ox = int(30 * t) % 200
    base += BOKEH[100:100 + H, ox:ox + W] * 0.6
    car = cv2.warpAffine(rgb, Mc, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    am = cv2.warpAffine(mk, Mc, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)[..., None]
    # reflection: mirror the warped car about its lowest point
    rows = np.where(am[..., 0].max(1) > 0.5)[0]
    if len(rows):
        yb = int(rows.max()) if refl_y is None else int(refl_y)
        hgt = min(H - yb, yb)
        if hgt > 10:
            ref = car[yb - hgt:yb][::-1] * am[yb - hgt:yb][::-1]
            fall = np.exp(-np.arange(hgt) / (hgt * 0.22))[:, None, None].astype(np.float32)
            ref = cv2.GaussianBlur(ref, (0, 0), 5) * fall * 0.32
            base[yb:yb + hgt] += ref
    car = car * expo
    if sweep is not None:
        sx = sweep
        band = np.exp(-(((xx - sx) + (yy - 960) * 0.45) / 140) ** 2)[..., None]
        car = car + band * 0.55 * np.clip(car * 2.5 + 0.1, 0, 1)
    out = base * (1 - am) + car * am
    for (fx, fy, s) in flares:
        g = np.exp(-(((xx - fx) / 30) ** 2 + ((yy - fy) / 30) ** 2))[..., None]
        streak = np.exp(-(((xx - fx) / 420) ** 2 + ((yy - fy) / 5) ** 2))[..., None]
        out += (g * 1.2 + streak * 0.7) * s * np.array([0.85, 0.92, 1.0], np.float32)
    for (fx, fy, s) in tail:
        g = np.exp(-(((xx - fx) / 70) ** 2 + ((yy - fy) / 55) ** 2))[..., None]
        out += g * s * np.array([1.0, 0.12, 0.08], np.float32) * 0.6
        if refl_y is not None or len(rows):
            ry = 2 * (rows.max() if len(rows) else fy) - fy
            st = np.exp(-(((xx - fx) / 26) ** 2 + ((yy - ry) / 200) ** 2))[..., None]
            out += st * s * np.array([1.0, 0.1, 0.06], np.float32) * 0.35
    rain_layer(out, t, 0.55)
    return np.clip(out, 0, 1.2)


def tf_pt(Mc, p):
    return Mc[:, :2] @ np.array(p, np.float32) + Mc[:, 2]


def shot_vette(sh, t):
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"])
    n = sh["img"]
    if n == "004481":
        sc = 1.2 * lerp(1.0, 1.06, u)
        Mc = affine(sc, (450, 270), (540, 1010))
        expo = lerp(0.12, 1.0, eo(prog(t, sh["t0"], sh["t0"] + 0.35)))
        sweep = lerp(-300, 1400, prog(t, sh["t0"] + 0.15, sh["t1"]))
        fl = [(*tf_pt(Mc, (86, 256)), 0.8 * eo(prog(t, sh["t0"] + 0.2, sh["t0"] + 0.45))),
              (*tf_pt(Mc, (318, 262)), 0.8 * eo(prog(t, sh["t0"] + 0.25, sh["t0"] + 0.5)))]
        img = car_scene(t, n, Mc, expo, sweep, fl)
        a = eo(prog(t, sh["t0"] + 0.12, sh["t0"] + 0.45))
        draw_text(img, "CHEVROLET", 540, 560, "mont", 50, 600, (0.92, 0.94, 1.0), a, track=22, shadow=10)
        return img
    if n == "004504":
        sc = 1.42 * lerp(1.0, 1.07, u)
        Mc = affine(sc, (1080, 930), (540, 960))
        sweep = lerp(-200, 1300, u)
        return car_scene(t, n, Mc, 1.0, sweep)
    if n == "004475":
        sc = 1000 / 1280 * lerp(1.05, 1.0, eo(u))
        bob = math.sin(t * 70) * 1.5
        Mc = affine(sc, (640, 430), (540, 1000 + bob))
        tails = [(*tf_pt(Mc, p), 0.9) for p in ((520, 448), (617, 445), (972, 433), (1063, 433))]
        img = car_scene(t, n, Mc, 0.92, None, (), tails)
        a = eo(prog(t, sh["t0"] + 0.1, sh["t0"] + 0.4))
        draw_text(img, "CORVETTE", 540, 470, "bebas", 230, 400, (1.0, 1.0, 1.0), a, track=18, shadow=14,
                  glow=0.4)
        a2 = eo(prog(t, sh["t0"] + 0.3, sh["t0"] + 0.6))
        draw_text(img, "2010", 540, 1560, "mont", 72, 300, (0.95, 0.95, 1.0), a2, track=40, shadow=10)
        return img
    if n == "004481b":
        z = lerp(2.0, 1.0, eio(prog(t, sh["t0"], sh["t0"] + 1.15)))
        sc = 1040 / 900 * z
        cx = lerp(170, 450, eio(prog(t, sh["t0"], sh["t0"] + 1.15)))
        cy = lerp(262, 270, eio(prog(t, sh["t0"], sh["t0"] + 1.15)))
        Mc = affine(sc, (cx, cy), (540, 1010))
        fl = [(*tf_pt(Mc, (86, 256)), 0.7), (*tf_pt(Mc, (318, 262)), 0.7)]
        img = car_scene(t, n, Mc, 0.95, None, fl)
        a = eo(prog(t, sh["t0"] + 0.35, sh["t0"] + 0.75)) * (1 - prog(t, sh["t1"] - 0.3, sh["t1"]))
        draw_text(img, spec.VETTE4_LINE, 540, 1560, "serif", 76, 600, WARM, a, shadow=12)
        return img
    raise ValueError(n)


# ------------------------------------------------------------------ HUD gauge
def gauge(img, t, a):
    if a <= 0.01:
        return
    k = min(NF - 1, max(0, int(t * FPS)))
    rpm = float(RPM[k])
    cx, cy, r = 540, 1690, 165
    lay = np.zeros((H, W, 3), np.uint8)
    a0, a1 = 150, 390
    cv2.ellipse(lay, (cx * 16, cy * 16), (r * 16, r * 16), 0, a0, a1, (230, 230, 242), 3, cv2.LINE_AA, 4)
    red0 = a0 + (a1 - a0) * 6.5 / 7
    cv2.ellipse(lay, (cx * 16, cy * 16), ((r - 8) * 16, (r - 8) * 16), 0, red0, a1, (255, 38, 25), 7,
                cv2.LINE_AA, 4)
    for i in range(0, 15):
        ang = math.radians(a0 + (a1 - a0) * i / 14)
        r2 = r - (22 if i % 2 == 0 else 12)
        p0 = (cx + r * math.cos(ang), cy + r * math.sin(ang))
        p1 = (cx + r2 * math.cos(ang), cy + r2 * math.sin(ang))
        cv2.line(lay, (int(p0[0] * 16), int(p0[1] * 16)), (int(p1[0] * 16), int(p1[1] * 16)), (230, 230, 242),
                 2, cv2.LINE_AA, 4)
    frac = min(1.0, rpm / 7000)
    ang = math.radians(a0 + (a1 - a0) * frac)
    p1 = (cx + (r - 18) * math.cos(ang), cy + (r - 18) * math.sin(ang))
    cv2.line(lay, (cx * 16, cy * 16), (int(p1[0] * 16), int(p1[1] * 16)), (255, 115, 25), 4, cv2.LINE_AA, 4)
    cv2.circle(lay, (cx * 16, cy * 16), 9 * 16, (255, 115, 25), -1, cv2.LINE_AA, 4)
    img *= 1 - (np.exp(-(((xx - cx) / 260) ** 2 + ((yy - cy) / 220) ** 2)) * 0.55 * a)[..., None]
    lf = lay.astype(np.float32) / 255
    img[:] = img * (1 - lf.max(2, keepdims=True) * a) + lf * a
    for i in range(0, 8):
        ang2 = math.radians(a0 + (a1 - a0) * i / 7)
        draw_text(img, str(i), cx + (r - 44) * math.cos(ang2), cy + (r - 44) * math.sin(ang2), "mont", 26, 500,
                  (0.9, 0.9, 0.95), a, shadow=0)
    kmh = int(round(rpm / 2900 * 92))
    draw_text(img, f"{kmh}", cx, cy + 62, "mont", 64, 600, (1, 1, 1), a, shadow=6)
    draw_text(img, "KM/H", cx, cy + 112, "mont", 22, 500, (0.85, 0.85, 0.9), a, track=6, shadow=0)
    draw_text(img, "RPM x1000", cx, cy - 66, "mont", 18, 500, (0.85, 0.85, 0.9), a * 0.8, track=4, shadow=0)


# ------------------------------------------------------------------ shot renderers
def src_time(sh, t):
    segs = sh["seg"]
    total = sum(s[2] for s in segs)
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"]) * total
    u = min(max(u, 0), total - 1e-4)
    for s0, s1, d in segs:
        if u < d:
            return s0 + (s1 - s0) * u / d
        u -= d
    return segs[-1][1]


def clip_frame(sh, t):
    v = CLIPS[sh["src"]]
    st = src_time(sh, t)
    i = int(min(len(v) - 1, max(0, round(st * sh["fps"]))))
    fr = v[i]
    h, w = fr.shape[:2]
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"])
    push = lerp(1.0, 1.045, u)
    if "zoom" in sh:
        z, cx, cy = sh["zoom"]
    else:
        z, cx, cy = 1.0, 0.5, 0.5
    cover = max(W / w, H / h)
    Mc = affine(cover * z * push, (cx * w, cy * h), (W / 2, H / 2))
    img = warp(fr, Mc)
    if sh.get("whip"):
        k = int(lerp(20, 140, u))
        img = cv2.blur(img, (k, 1))
    return grade(img, sh.get("expo", 1.0))


def shot_clip(sh, t):
    img = clip_frame(sh, t)
    if sh["id"] in ("rain", "selfie"):
        d, line = spec.CHAPTERS["rain"]
        chapter_tag(img, t, bt(46.5), bt(49.5), d, line)
    elif sh["id"] in spec.CHAPTERS:
        d, line = spec.CHAPTERS[sh["id"]]
        chapter_tag(img, t, sh["t0"], sh["t1"], d, line)
    if sh.get("hud"):
        a = eo(prog(t, sh["t0"] + 0.1, sh["t0"] + 0.4)) * (1 - prog(t, sh["t1"] - 0.15, sh["t1"]))
        gauge(img, t, a)
        top, sub = spec.DRIVER_TAG
        a1 = eo(prog(t, sh["t0"] + 0.25, sh["t0"] + 0.6)) * (1 - prog(t, sh["t1"] - 0.3, sh["t1"] - 0.05))
        img *= 1 - BOTTOM_SHADE * 0.35 * a1
        draw_text(img, top, W - 86, 1290, "mont", 34, 600, AMBER, a1, ax="r", track=6, shadow=8)
        draw_text(img, sub, W - 86, 1356, "sans", 50, 500, WARM, a1, ax="r", shadow=10)
    return img


def rain_bokeh_bg(t, speed=0.45, dark=0.55):
    v = CLIPS["c9eac"]
    st = 8.3 + (t * speed) % 1.3
    fr = np.asarray(v[int(st * 30)])
    Mc = affine(2.3, (0.62 * 1080, 0.28 * 1920), (W / 2, H / 2))
    img = warp(fr, Mc).astype(np.float32) / 255
    small = cv2.resize(img, (W // 6, H // 6), interpolation=cv2.INTER_AREA)
    img = cv2.resize(cv2.GaussianBlur(small, (0, 0), 5), (W, H), interpolation=cv2.INTER_LINEAR)
    lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
    img = lum[..., None] * 0.4 + img * 0.6
    return np.clip(img * dark * np.array([0.85, 0.92, 1.05], np.float32), 0, 1)


def shot_intro(sh, t):
    img = np.zeros((H, W, 3), np.float32)
    g = np.exp(-(((xx - 540) / 700) ** 2 + ((yy - 940) / 900) ** 2))[..., None]
    img += g * np.array([0.05, 0.035, 0.025], np.float32) * prog(t, 0, 1.2)
    dust(img, t, prog(t, 0.2, 1.5))
    y0 = 900
    for i, (s, ts) in enumerate(spec.INTRO_LINES):
        a = eo(prog(t, ts, ts + 0.8)) * (1 - prog(t, sh["t1"] - 0.6, sh["t1"] - 0.1))
        draw_text(img, s, 540, y0 + i * 118 + 10 * (1 - a), "serif", 80, 500, WARM, a, shadow=12)
    return img


def shot_title(sh, t):
    img = warm_bg(t)
    dust(img, t, 0.8)
    a = eo(prog(t, sh["t0"] + 0.1, sh["t0"] + 1.2))
    sc = lerp(1.08, 1.0, eo(prog(t, sh["t0"], sh["t0"] + 1.6)))
    draw_text(img, spec.TITLE, 540, 880, "serif", int(270 * sc), 700, WARM, a, shadow=24, sh_a=0.8, glow=0.25)
    a2 = eo(prog(t, sh["t0"] + 0.7, sh["t0"] + 1.4))
    draw_text(img, spec.TITLE_SUB, 540, 1080, "sans", 48, 300, WARM, a2, shadow=10)
    draw_text(img, spec.TITLE_YEARS, 540, 1150, "mont", 34, 300, AMBER, a2, track=8, shadow=8)
    return img


def shot_dog(sh, t):
    v = CLIPS["gem"]
    st = src_time(sh, t)
    fr = np.asarray(v[int(min(len(v) - 1, st * 24))])
    full = grade(fr)
    img = np.ascontiguousarray(blur_cover(full, 3, 0.38))
    bw, bh = 1000, 562
    band = cv2.resize(full, (bw, bh), interpolation=cv2.INTER_AREA)
    x0, y0 = (W - bw) // 2, 700
    sh_mask = np.zeros((H, W), np.float32)
    cv2.rectangle(sh_mask, (x0, y0 + 14), (x0 + bw, y0 + bh + 14), 1.0, -1)
    sh_mask = cv2.GaussianBlur(sh_mask, (0, 0), 22)
    img *= 1 - sh_mask[..., None] * 0.6
    rm = np.zeros((bh, bw), np.float32)
    cv2.rectangle(rm, (0, 0), (bw - 1, bh - 1), 1.0, -1)
    rr = 26
    for (cx, cy) in ((rr, rr), (bw - rr - 1, rr), (rr, bh - rr - 1), (bw - rr - 1, bh - rr - 1)):
        rm[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1] = 0
        cv2.circle(rm, (cx, cy), rr, 1.0, -1, cv2.LINE_AA)
    cv2.rectangle(rm, (rr, 0), (bw - rr, bh), 1.0, -1)
    cv2.rectangle(rm, (0, rr), (bw, bh - rr), 1.0, -1)
    roi = img[y0:y0 + bh, x0:x0 + bw]
    roi[:] = roi * (1 - rm[..., None]) + band * rm[..., None]
    a = eo(prog(t, sh["t0"] + 0.25, sh["t0"] + 0.8)) * (1 - prog(t, sh["t0"] + 4.2, sh["t0"] + 4.8))
    draw_text(img, spec.DOG_LINE, 540, 560, "serif", 64, 500, WARM, a, shadow=12)
    return img


def tile(i):
    c = cv2.cvtColor(cv2.imread(f"{M}/in/collage.jpg"), cv2.COLOR_BGR2RGB)
    boxes = [(29, 0, 449, 403), (473, 0, 880, 403), (29, 427, 449, 847), (473, 427, 880, 847)]
    x0, y0, x1, y1 = boxes[i]
    ins = 12
    return c[y0 + ins:y1 - ins, x0 + ins:x1 - ins].copy()


TILES = [tile(i) for i in range(4)]


def framed(img, ph, cx, cy, wd, rot_deg, a, border=(18, 18, 18, 18), bcol=(0.96, 0.95, 0.92), zoom=1.0):
    """Paste a photo with a paper border, drop shadow and rotation."""
    if a <= 0.01:
        return
    h0, w0 = ph.shape[:2]
    pw = int(wd)
    phh = int(wd * h0 / w0)
    src = ph
    if zoom != 1.0:
        cw, ch = int(w0 / zoom), int(h0 / zoom)
        src = ph[(h0 - ch) // 2:(h0 - ch) // 2 + ch, (w0 - cw) // 2:(w0 - cw) // 2 + cw]
    pimg = grade(cv2.resize(src, (pw, phh), interpolation=cv2.INTER_CUBIC))
    l, tp, r, b = border
    card = np.zeros((phh + tp + b, pw + l + r, 3), np.float32) + np.array(bcol, np.float32)
    card[tp:tp + phh, l:l + pw] = pimg
    ch_, cw_ = card.shape[:2]
    Mc = affine(1.0, (cw_ / 2, ch_ / 2), (cx, cy), math.radians(rot_deg))
    warped = cv2.warpAffine(card, Mc, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    m = cv2.warpAffine(np.ones((ch_, cw_), np.float32), Mc, (W, H), flags=cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_CONSTANT)
    shm = cv2.GaussianBlur(np.roll(m, 18, axis=0), (0, 0), 20)
    img *= 1 - (shm * 0.65 * a)[..., None]
    img[:] = img * (1 - (m * a)[..., None]) + warped * (m * a)[..., None]


def shot_dream(sh, t):
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"])
    ph = TILES[0]
    bg = blur_cover(grade(ph), 4, 0.35)
    img = np.ascontiguousarray(bg * np.array([0.8, 0.9, 1.1], np.float32))
    dust(img, t, 0.6)
    a = eo(prog(t, sh["t0"], sh["t0"] + 0.5))
    framed(img, ph, 540, 1010 + 20 * (1 - a), 880, -1.5, a, zoom=lerp(1.0, 1.12, u))
    a2 = eo(prog(t, sh["t0"] + 0.4, sh["t0"] + 1.0)) * (1 - prog(t, sh["t1"] - 0.25, sh["t1"]))
    draw_text(img, spec.DREAM_LINE, 540, 420, "serif", 70, 500, WARM, a2, shadow=12)
    return img


def shot_real(sh, t):
    order = [1, 2, 3]
    times = SHUTTERS
    cur = max(0, sum(1 for s in times if t >= s) - 1)
    ph = TILES[order[cur]]
    bg = blur_cover(grade(ph), 4, 0.33)
    img = np.ascontiguousarray(bg)
    spots = [(530, 1000, -5.0), (560, 1020, 4.0), (520, 1030, -2.0)]
    for k in range(cur + 1):
        st = times[k]
        a = eo(prog(t, st, st + 0.18))
        sc = lerp(1.22, 1.0, eo(prog(t, st, st + 0.22)))
        cx, cy, rot = spots[k]
        framed(img, TILES[order[k]], cx, cy, 640 * sc, rot, a, border=(22, 22, 22, 92))
    a2 = eo(prog(t, sh["t0"] + 0.25, sh["t0"] + 0.8))
    draw_text(img, spec.REAL_LINE, 540, 400, "serif", 70, 500, WARM, a2, shadow=12)
    return img


BERET = cv2.cvtColor(cv2.imread(f"{M}/in/beret.jpg"), cv2.COLOR_BGR2RGB)


def shot_beret(sh, t):
    u = (t - sh["t0"]) / (sh["t1"] - sh["t0"])
    h0, w0 = BERET.shape[:2]
    sc = max(W / w0, H / h0) * lerp(1.0, 1.1, eio(u))
    Mc = affine(sc, (0.47 * w0, 0.47 * h0), (W / 2, H / 2 + 20))
    img = grade(warp(BERET, Mc), 1.0, 0.02)
    bx, by = tf_pt(Mc, (490, 605))
    g = np.exp(-(((xx - bx) / 260) ** 2 + ((yy - by) / 260) ** 2))[..., None]
    img = 1 - (1 - img) * (1 - g * np.array([1.0, 0.85, 0.6], np.float32) * 0.35)
    img = light_leak(img, t, sh["t0"], 2.2, 7)
    a1 = eo(prog(t, sh["t0"] + 0.9, sh["t0"] + 1.6)) * (1 - prog(t, sh["t1"] - 0.6, sh["t1"] - 0.15))
    a2 = eo(prog(t, sh["t0"] + 2.4, sh["t0"] + 3.1)) * (1 - prog(t, sh["t1"] - 0.6, sh["t1"] - 0.15))
    img *= 1 - BOTTOM_SHADE * 0.75 * max(a1, a2)
    draw_text(img, spec.BERET_LINE, 540, 1450, "serif", 160, 700, WARM, a1, shadow=20, sh_a=0.8, glow=0.2)
    draw_text(img, spec.BERET_SUB, 540, 1650, "serif", 56, 500, WARM, a2, shadow=12)
    return img


def shot_ending(sh, t):
    img = warm_bg(t)
    dust(img, t, 0.8)
    a1 = eo(prog(t, sh["t0"] + 0.4, sh["t0"] + 1.2)) * (1 - prog(t, bt(95.6), bt(96)))
    draw_text(img, spec.ENDING_LINE, 540, 930, "serif", 92, 500, WARM, a1, shadow=14)
    a2 = eo(prog(t, bt(96) + 0.1, bt(96) + 1.0))
    sc = lerp(1.06, 1.0, eo(prog(t, bt(96), bt(96) + 1.8)))
    draw_text(img, spec.TITLE, 540, 880, "serif", int(240 * sc), 700, WARM, a2, shadow=24, sh_a=0.8, glow=0.25)
    draw_text(img, spec.TITLE_YEARS, 540, 1080, "mont", 34, 300, AMBER, a2, track=8, shadow=8)
    out = 1 - prog(t, END - 1.5, END - 0.35)
    return img * out


def shot_black(sh, t):
    return np.zeros((H, W, 3), np.float32)


RENDER = {"intro": shot_intro, "title": shot_title, "clip": shot_clip, "dog": shot_dog, "vette": shot_vette,
          "black": shot_black, "dream": shot_dream, "real": shot_real, "beret": shot_beret, "ending": shot_ending}

# transition into shot id: (type, duration)
TRANS = {"title": ("dissolve", 0.6), "couch": ("dissolve", 0.4), "train": ("dissolve", 0.25),
         "dog": ("dip", 0.5), "rain": ("dip", 0.5), "black1": ("dip", 0.6), "field": ("dip", 0.5),
         "bar": ("dissolve", 0.3), "black2": ("dip", 0.6), "dream": ("dip", 0.4), "ending": ("dissolve", 0.9)}


def render_shot(i, t):
    sh = SHOTS[i]
    return RENDER[sh["kind"]](sh, t)


def compose(t):
    i = next(k for k, s in enumerate(SHOTS) if s["t0"] <= t < s["t1"]) if t < SHOTS[-1]["t1"] else len(SHOTS) - 1
    sh = SHOTS[i]
    img = None
    # incoming transition at the start of this shot
    tr = TRANS.get(sh["id"])
    if tr and i > 0 and t < sh["t0"] + tr[1] / 2:
        typ, d = tr
        if typ == "dissolve":
            s = (t - (sh["t0"] - d / 2)) / d
            img = render_shot(i - 1, t) * (1 - eio(s)) + render_shot(i, t) * eio(s)
        else:
            img = render_shot(i, t) * eio((t - sh["t0"]) / (d / 2))
    # outgoing transition at the end of this shot
    if img is None and i + 1 < len(SHOTS):
        nxt = SHOTS[i + 1]
        tr = TRANS.get(nxt["id"])
        if tr and t >= nxt["t0"] - tr[1] / 2:
            typ, d = tr
            if typ == "dissolve":
                s = (t - (nxt["t0"] - d / 2)) / d
                img = render_shot(i, t) * (1 - eio(s)) + render_shot(i + 1, t) * eio(s)
            else:
                img = render_shot(i, t) * (1 - eio((t - (nxt["t0"] - d / 2)) / (d / 2)))
    if img is None:
        img = render_shot(i, t)
    if sh["id"] == "couch":
        img = light_leak(img, t, sh["t0"] - 0.3, 1.0, 2)
    if sh["id"] == "field":
        img = light_leak(img, t, sh["t0"] - 0.1, 0.9, 4)
    return img


def flash_amt(t):
    f = 0.0
    for ht, s in HITS.items():
        if t >= ht:
            f += s * (0.9 if ht in (bt(50), bt(83)) else 0.6) * math.exp(-(t - ht) / 0.1)
    for st in SHUTTERS:
        if t >= st:
            f += 0.55 * math.exp(-(t - st) / 0.07)
    return min(1.0, f)


def frame(k):
    t = k / FPS
    img = compose(t)
    fl = flash_amt(t)
    if fl > 0.01:
        img = img + (1 - img) * fl
    rs = np.random.default_rng(k)
    gn = cv2.resize(rs.standard_normal((H // 2, W // 2)).astype(np.float32), (W, H))[..., None]
    img = img * VIG + gn * 0.018
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    if MODE == "preview":
        for k in map(int, sys.argv[3:]):
            cv2.imwrite(f"{M}/frames/f_{k:04d}.jpg", cv2.cvtColor(frame(k), cv2.COLOR_RGB2BGR),
                        [cv2.IMWRITE_JPEG_QUALITY, 88])
            print("frame", k, flush=True)
    else:
        k0, k1, outp = int(sys.argv[3]), min(int(sys.argv[4]), NF), sys.argv[5]
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                               "-pix_fmt", "yuv420p", outp], stdin=subprocess.PIPE)
        for k in range(k0, k1):
            ff.stdin.write(frame(k).tobytes())
            if k % 50 == 0:
                print("frame", k, flush=True)
        ff.stdin.close()
        ff.wait()
        print("done", k0, k1)
