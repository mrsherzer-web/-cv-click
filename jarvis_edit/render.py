"""JARVIS-style HUD edit renderer.

usage: render.py SCRATCH part K0 K1 OUT.mp4     (render frame range to a video part)
       render.py SCRATCH preview K [K ...]      (write JPG stills to frames/)
"""
import json
import math
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from mediapipe.tasks.python import vision

S = sys.argv[1]
MODE = sys.argv[2]
W, H, FPS = 1080, 1920, 30
TL = json.load(open(f"{S}/work/timeline.json"))
TOTAL = TL["total"]
NF = int(round(TOTAL * FPS))
KICKS = np.array(TL["kicks"])
CAPS = TL["captions"]
BANDS = np.load(f"{S}/work/bands.npy")

A = np.memmap(f"{S}/work/a.rgb", dtype=np.uint8, mode="r").reshape(-1, 1920, 1080, 3)
BSR = np.load(f"{S}/work/b_sr.npy", mmap_mode="r")
A_TRK = np.load(f"{S}/work/a_track.npy")
B_TRK = np.load(f"{S}/work/b_track.npy")
B_CURLY = np.load(f"{S}/work/b_curly.npy")
A_WATCH = np.load(f"{S}/work/a_watch.npy")
FB = 122  # freeze frame of clip B for the scan

C = vision.FaceLandmarksConnections
TESS = np.array([(c.start, c.end) for c in C.FACE_LANDMARKS_TESSELATION])
CONT = np.array([(c.start, c.end) for c in C.FACE_LANDMARKS_CONTOURS])
LIPS = sorted({i for c in C.FACE_LANDMARKS_LIPS for i in (c.start, c.end)})


def chain(conns):
    nxt = {}
    for c in conns:
        nxt.setdefault(c.start, []).append(c.end)
        nxt.setdefault(c.end, []).append(c.start)
    start = conns[0].start
    order, prev, cur = [start], None, start
    while True:
        cand = [n for n in nxt[cur] if n != prev]
        if not cand or cand[0] == start:
            break
        prev, cur = cur, cand[0]
        order.append(cur)
    return order


OVAL = chain(C.FACE_LANDMARKS_FACE_OVAL)

# ------------------------------------------------------------------ palette
CY = (0, 214, 255)
CY2 = (150, 240, 255)
WHT = (235, 250, 255)
ORG = (255, 150, 30)
RED = (255, 55, 70)
GRN = (70, 255, 150)
DIM = (0, 110, 140)

# ------------------------------------------------------------------ fonts / text
FONTS = {
    "orb": f"{S}/fonts/Orbitron%5Bwght%5D.ttf",
    "raj": f"{S}/fonts/Rajdhani-SemiBold.ttf",
    "mono": f"{S}/fonts/ShareTechMono-Regular.ttf",
    "sym": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}
_fc, _sc = {}, {}


def font(kind, size, wght=None):
    key = (kind, size, wght)
    if key not in _fc:
        f = ImageFont.truetype(FONTS[kind], size)
        if kind == "orb":
            f.set_variation_by_axes([wght or 700])
        _fc[key] = f
    return _fc[key]


def sprite(s, kind, size, wght=None, track=0):
    key = (s, kind, size, wght, track)
    if key in _sc:
        return _sc[key]
    f = font(kind, size, wght)
    asc, desc = f.getmetrics()
    widths = [f.getlength(ch) for ch in s]
    width = sum(widths) + track * max(0, len(s) - 1) if track else f.getlength(s)
    img = Image.new("L", (int(math.ceil(width)) + 8, asc + desc + 8))
    d = ImageDraw.Draw(img)
    if track:
        x = 4
        for ch, wd in zip(s, widths):
            d.text((x, 4 + asc), ch, font=f, fill=255, anchor="ls")
            x += wd + track
    else:
        d.text((4, 4 + asc), s, font=f, fill=255, anchor="ls")
    m = np.asarray(img, np.float32) / 255
    if len(_sc) > 6000:
        _sc.clear()
    _sc[key] = m
    return m


def blit(L, m, x0, y0, col, a, clip=None):
    h, w = m.shape
    xa, xb = (0, W) if clip is None else clip
    xs, ys = max(xa, x0), max(0, y0)
    xe, ye = min(xb, x0 + w), min(H, y0 + h)
    if xe <= xs or ye <= ys:
        return
    sub = m[ys - y0:ye - y0, xs - x0:xe - x0]
    val = (sub[..., None] * (np.array(col, np.float32) * a)).astype(np.uint8)
    np.maximum(L[ys:ye, xs:xe], val, out=L[ys:ye, xs:xe])


def text(L, s, x, y, kind="raj", size=30, col=CY, a=1.0, ax="l", ay="t", wght=None, track=0,
         SH=None, pad=0, sa=0.55, clip=None):
    if a <= 0.01 or not s:
        return 0, 0
    m = sprite(s, kind, size, wght, track)
    h, w = m.shape
    x0 = x - (w / 2 if ax == "c" else w if ax == "r" else 0)
    y0 = y - (h / 2 if ay == "m" else h if ay == "b" else 0)
    x0, y0 = int(round(x0)), int(round(y0))
    if SH is not None:
        shade(SH, x0 - pad, y0 - pad + 2, x0 + w + pad, y0 + h + pad - 2, sa * a)
    blit(L, m, x0, y0, col, a, clip)
    return w, h


def text_w(s, kind, size, wght=None, track=0):
    return sprite(s, kind, size, wght, track).shape[1]


GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$"


def decode(s, t, t0, dur, seed=0):
    """Characters scramble then settle left to right."""
    if t < t0:
        return ""
    r = np.random.default_rng(int(t * FPS) * 31 + seed)
    out = []
    for i, ch in enumerate(s):
        settle = t0 + dur * (i + 1) / len(s)
        if t >= settle or ch == " ":
            out.append(ch)
        elif t >= t0 + dur * i / len(s) * 0.5:
            out.append(GLYPHS[r.integers(len(GLYPHS))])
        else:
            out.append(" ")
    return "".join(out)


def typed(s, t, t0, cps=45.0, cursor=True):
    if t < t0:
        return ""
    n = int((t - t0) * cps)
    if n >= len(s):
        return s
    return s[:n] + ("_" if cursor and int(t * 12) % 2 == 0 else "")


# ------------------------------------------------------------------ drawing helpers
def ip(p):
    return int(round(p[0] * 16)), int(round(p[1] * 16))


def ca(c, a):
    a = max(0.0, min(1.0, a))
    return (c[0] * a, c[1] * a, c[2] * a)


def line(L, p0, p1, col, a=1.0, th=2):
    if a > 0.01:
        cv2.line(L, ip(p0), ip(p1), ca(col, a), th, cv2.LINE_AA, 4)


def circle(L, c, r, col, a=1.0, th=2):
    if a > 0.01 and r > 0:
        cv2.circle(L, ip(c), int(round(r * 16)), ca(col, a), th, cv2.LINE_AA, 4)


def arc(L, c, r, a0, a1, col, a=1.0, th=2):
    if a > 0.01 and r > 0 and abs(a1 - a0) > 0.1:
        rr = int(round(r * 16))
        cv2.ellipse(L, ip(c), (rr, rr), 0, a0, a1, ca(col, a), th, cv2.LINE_AA, 4)


def rect(L, p0, p1, col, a=1.0, th=2):
    if a > 0.01:
        cv2.rectangle(L, ip(p0), ip(p1), ca(col, a), th, cv2.LINE_AA, 4)


def poly(L, pts, col, a=1.0, th=2, closed=True):
    if a > 0.01 and len(pts):
        cv2.polylines(L, [np.round(np.asarray(pts) * 16).astype(np.int32)], closed, ca(col, a), th, cv2.LINE_AA, 4)


def shade(SH, x0, y0, x1, y1, a):
    x0, y0, x1, y1 = int(max(0, x0)), int(max(0, y0)), int(min(W, x1)), int(min(H, y1))
    if x1 > x0 and y1 > y0 and a > 0:
        np.maximum(SH[y0:y1, x0:x1], np.uint8(min(255, a * 255)), out=SH[y0:y1, x0:x1])


def corners(L, x0, y0, x1, y1, ln, col, a=1.0, th=3):
    ln = min(ln, (x1 - x0) / 2, (y1 - y0) / 2)
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        line(L, (cx, cy), (cx + dx * ln, cy), col, a, th)
        line(L, (cx, cy), (cx, cy + dy * ln), col, a, th)


def dashed_ring(L, c, r, n, duty, rot, col, a=1.0, th=2):
    step = 360 / n
    for i in range(n):
        s = rot + i * step
        arc(L, c, r, s, s + step * duty, col, a, th)


def ticks_ring(L, c, r, n, ln, rot, col, a=1.0, th=1, major=0):
    for i in range(n):
        ang = math.radians(rot + i * 360 / n)
        l2 = ln * (2 if major and i % major == 0 else 1)
        p0 = (c[0] + r * math.cos(ang), c[1] + r * math.sin(ang))
        p1 = (c[0] + (r + l2) * math.cos(ang), c[1] + (r + l2) * math.sin(ang))
        line(L, p0, p1, col, a, th)


def panel(L, SH, x0, y0, x1, y1, a, title=None, col=CY):
    if a <= 0.01:
        return
    shade(SH, x0, y0, x1, y1, 0.62 * a)
    rect(L, (x0, y0), (x1, y1), col, 0.35 * a, 1)
    corners(L, x0, y0, x1, y1, 26, col, a, 3)
    if title:
        tw = text_w(title, "raj", 24, track=3)
        shade(SH, x0, y0 - 34, x0 + tw + 24, y0, 0.75 * a)
        line(L, (x0, y0 - 34), (x0 + tw + 24, y0 - 34), ORG, a, 2)
        text(L, title, x0 + 12, y0 - 34, "raj", 24, ORG, a, track=3)


def clamp01(x):
    return max(0.0, min(1.0, x))


def prog(t, a, b):
    return clamp01((t - a) / (b - a))


def eo(x):  # ease out cubic
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def eio(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def fade(t, a, b, fi=0.2, fo=0.2):
    if t < a or t > b:
        return 0.0
    return min(clamp01((t - a) / fi) if fi else 1, clamp01((b - t) / fo) if fo else 1)


def lerp(a, b, x):
    return a + (b - a) * x


def flicker(t, t0, dur=0.25, seed=0):
    """On/off flicker when an element powers up."""
    if t < t0:
        return 0.0
    if t > t0 + dur:
        return 1.0
    r = np.random.default_rng(int(t * FPS) + seed * 977)
    return float(r.random() > 0.35) * prog(t, t0, t0 + dur) + 0.2


# ------------------------------------------------------------------ image fx
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rr = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
VIG = np.clip(1 - 0.55 * rr ** 2.2, 0, 1)[..., None].astype(np.float32)
SCANL = np.ones((H, 1, 1), np.float32)
SCANL[::4] = 0.8
SCANL[1::4] = 0.92
GRID = np.zeros((H, W, 3), np.float32)
for gy in range(30, H, 60):
    for gx in range(30, W, 60):
        cv2.circle(GRID, (gx, gy), 2, (0.0, 0.25, 0.32), -1, cv2.LINE_AA)
glow = np.exp(-(((xx - 540) / 700) ** 2 + ((yy - 760) / 700) ** 2))[..., None]
GRID += glow * np.array([0.0, 0.05, 0.08], np.float32)
del yy, xx, rr, glow


def grade(x, kind):
    x = x.astype(np.float32) / 255
    if kind == "A":
        x = np.clip((x - 0.5) * 1.1 + 0.5, 0, 1)
        lum = x @ np.array([0.299, 0.587, 0.114], np.float32)
        x = x + ((1 - lum) ** 2)[..., None] * np.array([-0.04, 0.012, 0.05], np.float32)
        x = lum[..., None] + (x - lum[..., None]) * 1.08
    else:
        x = np.clip(x, 0, 1) ** 0.82
        x = x * np.array([0.96, 1.0, 1.08], np.float32)
        lum = x @ np.array([0.299, 0.587, 0.114], np.float32)
        x = lum[..., None] + (x - lum[..., None]) * 1.05
        x = np.clip((x - 0.5) * 1.06 + 0.52, 0, 1)
    return np.clip(x * VIG, 0, 1)


def scan_look(x, amt):
    if amt <= 0:
        return x
    lum = x @ np.array([0.299, 0.587, 0.114], np.float32)
    tint = np.clip(lum[..., None] * np.array([0.45, 0.95, 1.15], np.float32) * 1.12, 0, 1)
    y = x * (1 - 0.7 * amt) + tint * 0.7 * amt
    return y * (1 - amt + amt * SCANL)


def glitch(x, amt, seed):
    if amt <= 0.01:
        return x
    r = np.random.default_rng(seed)
    out = x.copy()
    k = int(3 + 26 * amt)
    out[..., 0] = np.roll(x[..., 0], k, axis=1)
    out[..., 2] = np.roll(x[..., 2], -k, axis=1)
    for _ in range(int(3 + 14 * amt)):
        y0 = int(r.integers(0, H - 10))
        h = int(r.integers(6, int(20 + 160 * amt)))
        dx = int(r.integers(-int(220 * amt) - 4, int(220 * amt) + 5))
        out[y0:y0 + h] = np.roll(out[y0:y0 + h], dx, axis=1)
    for _ in range(int(7 * amt)):
        bx, by = int(r.integers(0, W - 60)), int(r.integers(0, H - 30))
        bw, bh = int(r.integers(40, 320)), int(r.integers(8, 70))
        out[by:by + bh, bx:bx + bw] = out[by:by + bh, bx:bx + bw][..., ::-1] * 1.3
    return np.clip(out, 0, 1)


def warp(src, P, Q, z, rot=0.0, off=(0.0, 0.0)):
    c, s = math.cos(rot) * z, math.sin(rot) * z
    M = np.array([[c, -s, Q[0] + off[0] - (c * P[0] - s * P[1])],
                  [s, c, Q[1] + off[1] - (s * P[0] + c * P[1])]], np.float32)
    out = cv2.warpAffine(np.asarray(src), M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
    return out, M


def tf(M, pts):
    pts = np.asarray(pts, np.float32)
    return pts @ M[:, :2].T + M[:, 2]


# ------------------------------------------------------------------ timing helpers
IMPACTS = [(1.8, 0.35, 6), (6.5, 0.55, 14), (9.0, 0.75, 28), (13.0, 0.6, 24), (15.5, 0.7, 22)]


def flash_amt(t):
    return sum(f * math.exp(-(t - ti) / 0.09) for ti, f, _ in IMPACTS if t >= ti)


def shake_amt(t):
    return sum(s * math.exp(-(t - ti) / 0.14) for ti, _, s in IMPACTS if t >= ti)


def pulse(t):
    past = KICKS[KICKS <= t]
    if not len(past):
        return 0.0
    return math.exp(-(t - past[-1]) / 0.11)


def glitch_amt(t):
    g = 0.0
    g = max(g, fade(t, 6.30, 6.70, 0.2, 0.2))
    g = max(g, fade(t, 15.22, 15.72, 0.28, 0.22))
    g = max(g, 0.5 * fade(t, 0.0, 0.14, 0.01, 0.13))
    g = max(g, 0.35 * fade(t, 9.0, 9.1, 0.01, 0.09))
    g = max(g, 0.3 * fade(t, 13.0, 13.08, 0.01, 0.07))
    for gt in (3.2, 5.15, 7.55, 14.25):
        g = max(g, 0.28 * fade(t, gt, gt + 0.07, 0.01, 0.06))
    return g


def b_src(t):
    if t < 8.25:
        u = t - 6.5
        if u < 16 / 24.83:
            return u * 24.83
        return 16 + (u - 16 / 24.83) / (1.75 - 16 / 24.83) * (91 - 16)
    if t < 9.5:
        return 91 + (t - 8.25) * 24.83
    if t < 13.4:
        return FB
    return min(184, FB + (t - 13.4) * 24.83)


def face_ok(trk, i):
    return 0 <= i < len(trk) and not np.isnan(trk[i, 0, 0])


def lm_at(trk, f):
    """Landmarks at fractional frame f (linear blend)."""
    i0 = int(math.floor(f))
    i1 = i0 + 1
    if face_ok(trk, i0) and face_ok(trk, i1):
        w = f - i0
        return trk[i0] * (1 - w) + trk[i1] * w
    if face_ok(trk, i0):
        return trk[i0]
    return None


def bbox(p):
    mn, mx = p.min(0), p.max(0)
    return mn[0], mn[1], mx[0], mx[1]


# ------------------------------------------------------------------ HUD widgets
def reactor(L, c, R, t, a, build=1.0, inner=True):
    """Arc-reactor style animated rings. build 0..1 draws rings in progressively."""
    if a <= 0.01:
        return
    parts = [
        lambda b: circle(L, c, R * 0.17, CY2, a * b, 3),
        lambda b: [arc(L, c, R * 0.30, t * 40 + i * 36, t * 40 + i * 36 + 26 * b, CY, a, 9) for i in range(10)],
        lambda b: (circle(L, c, R * 0.40, CY, a * 0.6 * b, 1), ticks_ring(L, c, R * 0.42, 60, 6 * b, -t * 10, CY, a * 0.8, 1, 5)),
        lambda b: [arc(L, c, R * 0.56, -t * 60 + i * 120, -t * 60 + i * 120 + 80 * b, CY2, a, 5) for i in range(3)],
        lambda b: dashed_ring(L, c, R * 0.70, 72, 0.5 * b, t * 15, CY, a * 0.7, 2),
        lambda b: [arc(L, c, R * 0.82, t * 25 + i * 180, t * 25 + i * 180 + 120 * b, ORG, a * 0.9, 3) for i in range(2)],
        lambda b: arc(L, c, R * 0.95, -t * 8, -t * 8 + 360 * b, CY, a * 0.35, 1),
    ]
    if not inner:
        parts = parts[2:]
    n = len(parts)
    for i, fn in enumerate(parts):
        b = clamp01(build * n - i)
        if b > 0:
            fn(eo(b))


def radar(L, SH, c, r, t, a):
    if a <= 0.01:
        return
    shade(SH, c[0] - r - 10, c[1] - r - 10, c[0] + r + 10, c[1] + r + 10, 0.0)
    for k in (1, 0.66, 0.33):
        circle(L, c, r * k, CY, a * (0.55 if k == 1 else 0.3), 1)
    line(L, (c[0] - r, c[1]), (c[0] + r, c[1]), CY, a * 0.25, 1)
    line(L, (c[0], c[1] - r), (c[0], c[1] + r), CY, a * 0.25, 1)
    th = t * 2.6
    for i in range(14):
        ang = th - i * 0.045
        line(L, c, (c[0] + r * math.cos(ang), c[1] + r * math.sin(ang)), CY, a * 0.7 * (1 - i / 14), 2)
    rg = np.random.default_rng(5)
    for _ in range(7):
        ang, rad = rg.uniform(0, 2 * math.pi), rg.uniform(0.25, 0.92) * r
        d = (th - ang) % (2 * math.pi)
        br = math.exp(-d / 1.4)
        circle(L, (c[0] + rad * math.cos(ang), c[1] + rad * math.sin(ang)), 3, ORG, a * br, -1)
    text(L, "PROXIMITY", c[0], c[1] + r + 8, "mono", 16, CY, a * 0.7, ax="c")


def ecg(L, x0, y0, w, h, t, col, a):
    pts = []
    for i in range(60):
        u = (i / 60 + t * 0.9) % 1.0
        ph = u * 3 % 1.0
        v = 0
        if 0.40 < ph < 0.44:
            v = -0.3
        elif 0.44 < ph < 0.48:
            v = 1.0
        elif 0.48 < ph < 0.52:
            v = -0.6
        elif 0.6 < ph < 0.7:
            v = 0.18 * math.sin((ph - 0.6) / 0.1 * math.pi)
        pts.append((x0 + w * i / 59, y0 + h / 2 - v * h / 2))
    poly(L, pts, col, a, 2, closed=False)


def hud_base(L, SH, t, cam, a, show_radar=True, show_spec=True):
    if a <= 0.01:
        return
    inset = (1 - eo(prog(t, 1.8, 2.3))) * 120 if t < 2.3 else 0
    m = 40 + inset
    corners(L, m, m, W - m, H - m, 90, CY, a, 3)
    for (cx, cy, dx, dy) in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        line(L, (cx + dx * 14, cy + dy * 14), (cx + dx * 40, cy + dy * 14), CY, a * 0.6, 1)
    fa = a * flicker(t, 1.85, 0.3, 1)
    text(L, "J.A.R.V.I.S", 88, 74, "orb", 30, CY2, fa, wght=800, track=4)
    text(L, cam, 90, 116, "raj", 24, CY, fa * 0.9, track=2)
    line(L, (88, 152), (420, 152), CY, fa * 0.5, 1)
    fb = a * flicker(t, 1.95, 0.3, 2)
    if int(t * 2) % 2 == 0:
        circle(L, (W - 196, 92), 9, RED, fb, -1)
    text(L, "REC", W - 90, 76, "orb", 28, WHT, fb, ax="r", wght=700)
    fr = int(round(t * FPS))
    tc = f"00:{fr // (FPS * 60):02d}:{(fr // FPS) % 60:02d}:{fr % FPS:02d}"
    text(L, tc, W - 90, 114, "mono", 26, CY, fb * 0.9, ax="r")
    line(L, (W - 420, 152), (W - 88, 152), CY, fb * 0.5, 1)
    # left ruler
    fl = a * flicker(t, 2.05, 0.3, 3)
    off = (t * 37) % 20
    for i in range(36):
        y = 620 + i * 20 + off
        if y > 1300:
            break
        major = int((t * 37) // 20 + 36 - i) % 5 == 0
        line(L, (62, y), (62 + (22 if major else 10), y), CY, fl * (0.7 if major else 0.4), 1)
    line(L, (62, 610), (62, 1310), CY, fl * 0.3, 1)
    text(L, f"ALT {1240 + 37 * t:6.1f}", 94, 948, "mono", 18, CY, fl * 0.7)
    text(L, f"ZOOM {1 + 0.4 * pulse(t):.2f}x", 94, 972, "mono", 18, CY, fl * 0.6)
    # center crosshair
    cc = (W / 2, H / 2)
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        line(L, (cc[0] + dx * 16, cc[1] + dy * 16), (cc[0] + dx * 38, cc[1] + dy * 38), CY, a * 0.35, 1)
    if show_radar:
        radar(L, SH, (W - 150, 300), 78, t, a * flicker(t, 2.1, 0.3, 4))
    if show_spec:
        fs = a * flicker(t, 2.15, 0.3, 5)
        k = min(NF - 1, int(t * FPS))
        bands = BANDS[k]
        for j in range(32):
            hgt = 6 + 64 * min(1.0, bands[j]) ** 1.6
            x = 145 + j * 25
            cv2.rectangle(L, (x, int(1866 - hgt)), (x + 14, 1866), ca(CY, fs * 0.75), -1)
            line(L, (x, 1866 - hgt - 5), (x + 14, 1866 - hgt - 5), CY2, fs, 2)
        tick = ("SYSTEMS NOMINAL  //  CORE TEMP 36.6C  //  PARTY PROTOCOL: ACTIVE  //  "
                "OPTICS 4K  //  NEURAL NET ONLINE  //  ")
        m2 = sprite(tick * 3, "mono", 18)
        ofs = int((t * 120) % text_w(tick, "mono", 18))
        blit(L, m2, 110 - ofs, 1872, CY, fs * 0.55, clip=(110, W - 110))


def caption(L, SH, t, y=1712):
    for cp in CAPS:
        st, en = cp["start"], cp["end"] - 0.65
        if st <= t <= en + 0.45:
            a = fade(t, st, en + 0.45, 0.08, 0.3)
            n = int(len(cp["text"]) * clamp01((t - st) / max(0.3, (en - st) * 0.82)))
            s = cp["text"][:max(1, n)].upper()
            sz = 36
            while sz > 24 and text_w(cp["text"].upper(), "raj", sz, track=1) > 820:
                sz -= 2
            full_w = text_w(cp["text"].upper(), "raj", sz, track=1)
            lab_w = text_w("JARVIS", "orb", 22, wght=800, track=2)
            x0 = W / 2 - (full_w + lab_w + 24) / 2
            shade(SH, x0 - 22, y - 8, x0 + full_w + lab_w + 46, y + 54, 0.6 * a)
            line(L, (x0 - 22, y - 8), (x0 - 22, y + 54), ORG, a, 3)
            text(L, "JARVIS", x0, y + 14, "orb", 22, ORG, a, wght=800, track=2)
            text(L, s, x0 + lab_w + 24, y + 2 + (36 - sz) // 2, "raj", sz, WHT, a, track=1)


def face_reticle(L, SH, box, t, col, a, label=None, sub=None, rot_speed=60, ring=True, lab_col=None):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    corners(L, x0, y0, x1, y1, 46, col, a, 4)
    rect(L, (x0, y0), (x1, y1), col, a * 0.22, 1)
    if ring:
        rad = 0.62 * max(x1 - x0, y1 - y0)
        dashed_ring(L, (cx, cy), rad, 48, 0.45, t * rot_speed, col, a * 0.55, 2)
        for i in range(4):
            arc(L, (cx, cy), rad + 14, -t * rot_speed * 0.6 + i * 90, -t * rot_speed * 0.6 + i * 90 + 30, col, a * 0.8, 3)
    line(L, (cx - 10, cy), (cx + 10, cy), col, a * 0.6, 1)
    line(L, (cx, cy - 10), (cx, cy + 10), col, a * 0.6, 1)
    if label:
        lx, ly = max(70, x0), max(190, y0 - 74)
        lw = text_w(label, "orb", 30, wght=800, track=2)
        shade(SH, lx - 8, ly - 4, lx + max(lw, 220) + 16, ly + 70, 0.55 * a)
        text(L, label, lx, ly, "orb", 30, lab_col or col, a, wght=800, track=2)
        if sub:
            text(L, sub, lx, ly + 40, "mono", 22, WHT, a * 0.9)


# ------------------------------------------------------------------ segment renderers
def intro(L, SH, t):
    """Boot sequence overlay (0 -> 2.2s)."""
    a = 1.0 if t < 1.8 else 1 - eo(prog(t, 1.8, 2.15))
    if a <= 0.01:
        return
    c = (540, 760)
    R = 330 * (1 + 1.4 * eo(prog(t, 1.8, 2.2)))
    reactor(L, c, R, t, a * (1 + 0.6 * fade(t, 1.55, 1.85, 0.1, 0.2)), build=prog(t, 0.05, 1.0))
    ta = a * (1 - prog(t, 1.62, 1.8))
    s = decode("J.A.R.V.I.S", t, 0.42, 0.5, 1)
    text(L, s, 540, 1130, "orb", 92, WHT, ta, ax="c", wght=900, track=16)
    text(L, typed("JUST A RATHER VERY INTELLIGENT SYSTEM", t, 0.75, 70, False), 540, 1252, "raj", 30,
         CY, ta, ax="c", track=5)
    rows = [("BOOT SEQUENCE", "INIT", CY2), ("NEURAL CORE", "OK", GRN), ("OPTICAL SENSORS", "OK", GRN),
            ("FACE RECOGNITION", "OK", GRN), ("PARTY PROTOCOL", "ARMED", ORG), ("WELCOME BACK, SIR.", "", WHT)]
    for i, (lab, st, col) in enumerate(rows):
        t0 = 0.36 + 0.17 * i
        if t < t0:
            continue
        y = 1360 + 40 * i
        if st:
            dots = "." * (24 - len(lab))
            text(L, typed(f"> {lab} {dots}", t, t0, 160, False), 92, y, "mono", 26, CY, ta)
            if t > t0 + 0.12:
                text(L, st, 988, y, "mono", 26, col, ta * flicker(t, t0 + 0.12, 0.1, i), ax="r")
        else:
            text(L, typed(f"> {lab}", t, t0, 120), 92, y, "mono", 26, col, ta)
    p = eio(prog(t, 0.2, 1.6))
    rect(L, (92, 1636), (988, 1656), CY, ta * 0.6, 1)
    if p > 0:
        cv2.rectangle(L, ip((96, 1640)), ip((96 + 888 * p, 1652)), ca(CY, ta), -1, cv2.LINE_AA, 4)
    text(L, f"LOADING {int(p * 100):3d}%", 988, 1600, "mono", 22, CY2, ta, ax="r")


def a_segment(L, SH, t, M, ai):
    # smartwatch tag
    if 16 <= ai <= 62 and not np.isnan(A_WATCH[ai, 0]):
        x, y, w, h = A_WATCH[ai]
        p0, p1 = tf(M, [[x - 10, y - 10], [x + w + 10, y + h + 10]])
        aa = fade(ai, 16, 62, 4, 6) * flicker(t, 2.33, 0.2, 9)
        corners(L, p0[0], p0[1], p1[0], p1[1], 26, ORG, aa, 3)
        lx, ly = p1[0] + 40, p0[1] - 40
        line(L, (p1[0], p0[1]), (lx - 6, ly + 30), ORG, aa, 2)
        shade(SH, lx - 10, ly - 6, lx + 300, ly + 120, 0.55 * aa)
        text(L, "SMARTWATCH", lx, ly, "orb", 24, ORG, aa, wght=800, track=2)
        text(L, typed("LINKED // HR 72 BPM", t, 2.42, 50), lx, ly + 34, "mono", 22, WHT, aa)
        ecg(L, lx, ly + 72, 280, 36, t, GRN, aa)
    # face reticle on subject 01
    if face_ok(A_TRK, ai):
        p = tf(M, A_TRK[ai][:, :2])
        x0, y0, x1, y1 = bbox(p)
        padx, pady = (x1 - x0) * 0.12, (y1 - y0) * 0.12
        x0, y0, x1, y1 = max(70, x0 - padx), max(200, y0 - pady), min(W - 70, x1 + padx), min(1650, y1 + pady)
        aa = fade(ai, 64, 139, 3, 4) * flicker(t, 3.93, 0.2, 11)
        conv = 1 - eo(prog(t, 3.93, 4.2))
        cxx, cyy = (x0 + x1) / 2, (y0 + y1) / 2
        g = 1 + conv * 0.8
        box = (cxx - (cxx - x0) * g, cyy - (cyy - y0) * g, cxx + (x1 - cxx) * g, cyy + (y1 - cyy) * g)
        face_reticle(L, SH, box, t, CY, aa, "SUBJECT 01", typed("FACE LOCK 97.3%", t, 4.0, 40), ring=False)
        nose = p[1]
        circle(L, nose, 8, ORG, aa, 2)
        circle(L, nose, 3, ORG, aa, -1)
        # info panel
        pa = fade(t, 4.3, 6.45, 0.2, 0.1)
        if pa > 0:
            px0, py0 = 590, 1380
            panel(L, SH, px0, py0, 1010, py0 + 250, pa * flicker(t, 4.3, 0.2, 12), "SUBJECT 01 // PROFILE")
            rows = [("STATUS", "FOCUSED", CY2), ("BEARD", "CERTIFIED", ORG), ("HEART RATE", "72 BPM", GRN),
                    ("MOOD", "DEEP THOUGHT", WHT)]
            for i, (k, v, col) in enumerate(rows):
                t0 = 4.45 + i * 0.22
                yy = py0 + 22 + i * 56
                text(L, typed(k, t, t0, 60, False), px0 + 22, yy, "raj", 30, CY, pa)
                text(L, typed(v, t, t0 + 0.1, 50, False), 990, yy, "orb", 24, col, pa, ax="r", wght=700)


def search_overlay(L, SH, t, M, bf):
    # "no match" on the first face
    bi = int(bf)
    if t < 7.2 and face_ok(B_CURLY, bi):
        p = tf(M, B_CURLY[bi][:, :2] * 4)
        x0, y0, x1, y1 = bbox(p)
        x0, y0, x1, y1 = max(60, x0), max(190, y0), min(W - 60, x1), min(H - 300, y1)
        aa = fade(t, 6.62, 7.2, 0.05, 0.08) * flicker(t, 6.62, 0.12, 3)
        corners(L, x0, y0, x1, y1, 40, RED, aa, 4)
        line(L, (x0 + 30, y0 + 30), (x1 - 30, y1 - 30), RED, aa * 0.5, 2)
        line(L, (x1 - 30, y0 + 30), (x0 + 30, y1 - 30), RED, aa * 0.5, 2)
        shade(SH, x0, y1 + 8, x0 + 290, y1 + 60, 0.6 * aa)
        text(L, "NO MATCH", x0 + 10, y1 + 12, "orb", 32, RED, aa, wght=900, track=2)
    # random candidate boxes
    slot = int((t - 6.5) / 0.12)
    rg = np.random.default_rng(100 + slot)
    for i in range(4):
        cx, cy = rg.uniform(180, W - 180), rg.uniform(420, 1450)
        sz = rg.uniform(90, 170)
        aa = 0.8 * fade(t, 7.05, 8.25, 0.1, 0.1)
        corners(L, cx - sz / 2, cy - sz / 2, cx + sz / 2, cy + sz / 2, 18, CY, aa, 2)
        text(L, f"ID-{rg.integers(1000, 9999)}  {rg.integers(5, 48)}%", cx - sz / 2, cy + sz / 2 + 6, "mono", 18,
             CY, aa)
    # sweeping search ring
    sa = fade(t, 6.65, 8.3, 0.15, 0.2)
    dashed_ring(L, (540, 900), 330, 36, 0.5, t * 140, CY, sa * 0.5, 2)
    arc(L, (540, 900), 352, t * 300, t * 300 + 50, ORG, sa, 4)
    arc(L, (540, 900), 352, t * 300 + 180, t * 300 + 230, ORG, sa, 4)
    dots = "." * (int(t * 6) % 4)
    blink = 1.0 if int(t * 5) % 2 == 0 else 0.55
    text(L, "SEARCHING FOR TARGET" + dots, 540 - text_w("SEARCHING FOR TARGET", "orb", 36, 800, 3) / 2, 1450,
         "orb", 36, ORG, sa * blink, wght=800, track=3, SH=SH, pad=14)
    n = int(lerp(3, 61, prog(t, 6.6, 8.25)))
    text(L, f"FACES ANALYZED: {n:03d}   MATCHES: 0", 540, 1520, "mono", 26, CY2, sa, ax="c")


def lock_overlay(L, SH, t, M, bf):
    lm = lm_at(B_TRK, bf)
    if lm is None:
        return
    p = tf(M, lm[:, :2] * 4)
    x0, y0, x1, y1 = bbox(p)
    pad = (x1 - x0) * 0.18
    fb = (x0 - pad, y0 - pad * 1.2, x1 + pad, y1 + pad * 0.8)
    q = eio(prog(t, 8.25, 9.0))
    if t < 9.0:
        cx, cy = lerp(540, (fb[0] + fb[2]) / 2, q), lerp(900, (fb[1] + fb[3]) / 2, q)
        half = lerp(460, (fb[2] - fb[0]) / 2, q)
        rot = math.radians(lerp(45, 0, q))
        pts = []
        for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
            pts.append((cx + half * (dx * math.cos(rot) - dy * math.sin(rot)),
                        cy + half * (dx * math.sin(rot) + dy * math.cos(rot))))
        col = CY if q < 0.6 else ORG
        poly(L, pts, col, 0.9, 2)
        for pt in pts:
            circle(L, pt, 8, col, 1, 2)
        dashed_ring(L, (cx, cy), half * 1.25, 40, 0.4, -t * 200, col, 0.5, 2)
        pct = int(100 * q)
        text(L, f"LOCKING TARGET  {pct:3d}%", 540, 1450, "orb", 34, ORG, 1.0, ax="c", wght=800, track=2,
             SH=SH, pad=14)
    else:
        aa = 1.0
        face_reticle(L, SH, fb, t, ORG, aa, "PRIMARY TARGET", "SUBJECT 02 // LOCKED", rot_speed=90)
        # acquired banner
        ba = fade(t, 9.0, 9.62, 0.0, 0.18)
        if ba > 0:
            sc = 1 + 0.14 * (1 - eo(prog(t, 9.0, 9.15)))
            shade(SH, 0, 1338, W, 1468, 0.75 * ba)
            line(L, (0, 1338), (W, 1338), ORG, ba, 3)
            line(L, (0, 1468), (W, 1468), ORG, ba, 3)
            size = int(74 * sc)
            text(L, "TARGET ACQUIRED", 540, 1403, "orb", size, ORG, ba * flicker(t, 9.0, 0.12, 5), ax="c",
                 ay="m", wght=900, track=4)


# --- scan (freeze frame) -------------------------------------------------
FREEZE_LM = B_TRK[FB].copy()
FACE_C_SR = np.array([(FREEZE_LM[:, 0].min() + FREEZE_LM[:, 0].max()) / 2,
                      (FREEZE_LM[:, 1].min() + FREEZE_LM[:, 1].max()) / 2]) * 4
SCAN_Q, SCAN_Z = (540, 650), 1.3

M3 = FREEZE_LM.copy()
M3[:, :2] -= M3[:, :2].mean(0)
M3[:, 2] -= M3[:, 2].mean()
M3 /= (M3[:, 1].max() - M3[:, 1].min())


def head3d(L, c, size, ang, a):
    th = math.radians(ang)
    tilt = math.radians(-8)
    x, y, z = M3[:, 0], M3[:, 1], M3[:, 2]
    xr = x * math.cos(th) + z * math.sin(th)
    zr = -x * math.sin(th) + z * math.cos(th)
    yr = y * math.cos(tilt) - zr * math.sin(tilt)
    zr2 = y * math.sin(tilt) + zr * math.cos(tilt)
    px = c[0] + xr * size
    py = c[1] + yr * size
    pts = np.stack([px, py], 1)
    zz = zr2[TESS].mean(1)
    lo, hi = zz.min(), zz.max()
    br = 1 - (zz - lo) / (hi - lo + 1e-6)
    for lvl, (blo, bhi) in enumerate([(0, 0.35), (0.35, 0.7), (0.7, 1.01)]):
        sel = TESS[(br >= blo) & (br < bhi)]
        segs = [np.round(pts[e] * 16).astype(np.int32) for e in sel]
        cv2.polylines(L, segs, False, ca(CY, a * (0.25 + 0.35 * lvl)), 1, cv2.LINE_AA, 4)
    for i in range(0, 478, 9):
        circle(L, pts[i], 1.5, CY2, a * 0.8, -1)


def beard_zone(L, pts, col, a, t):
    oval = pts[OVAL].astype(np.float32)
    ycut = pts[2][1] - 6
    x0, y0 = int(oval[:, 0].min()) - 4, int(ycut)
    x1, y1 = int(oval[:, 0].max()) + 4, int(oval[:, 1].max()) + 4
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return
    mk = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(mk, [np.round(oval - [x0, y0]).astype(np.int32)], 255, cv2.LINE_AA)
    hull = cv2.convexHull(np.round(pts[LIPS] - [x0, y0]).astype(np.int32))
    cv2.fillPoly(mk, [hull], 0, cv2.LINE_AA)
    gy, gx = np.mgrid[y0:y1, x0:x1]
    hatch = (((gx + gy + int(t * 60)) % 16) < 3).astype(np.float32)
    m = mk.astype(np.float32) / 255
    val = (m * (0.18 + 0.5 * hatch))[..., None] * np.array(col, np.float32) * a
    np.maximum(L[y0:y1, x0:x1], val.astype(np.uint8), out=L[y0:y1, x0:x1])
    cnts, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cn in cnts:
        poly(L, cn[:, 0, :] + [x0, y0], col, a, 2)


STATS = [("BEARD DENSITY", 0.97, "97%", ORG), ("DRIP LEVEL", 1.0, "MAX", CY2), ("VIBE CHECK", None, "PASSED", GRN),
         ("CHARISMA", 0.98, "9.8/10", CY2), ("BEVERAGE", None, "DETECTED", ORG), ("PARTY MODE", None, "ACTIVE", GRN),
         ("THREAT LEVEL", 0.04, "ZERO", GRN)]
STAT_T = [10.45 + 0.3 * i for i in range(len(STATS))]


def scan_overlay(L, SH, t, M):
    pts = tf(M, FREEZE_LM[:, :2] * 4)
    x0, y0, x1, y1 = bbox(pts)
    fc = ((x0 + x1) / 2, (y0 + y1) / 2)
    out_a = 1 - prog(t, 13.15, 13.4)
    zin = eo(prog(t, 9.5, 9.85))
    # enhance label
    ea = fade(t, 9.78, 10.32, 0.04, 0.1)
    if ea > 0:
        text(L, "ENHANCING IMAGE", 540, 1290, "orb", 40, CY2, ea * (1 if int(t * 14) % 2 else 0.6), ax="c",
             wght=900, track=4, SH=SH, pad=14)
        text(L, f"NEURAL UPSCALE x4  //  {int(prog(t, 9.85, 10.25) * 100):3d}%", 540, 1352, "mono", 24, CY, ea,
             ax="c")
    if t < 9.85:
        return
    a = out_a
    # rings + progress
    R = 0.58 * max(x1 - x0, y1 - y0) * lerp(1.4, 1.0, eo(prog(t, 9.85, 10.3)))
    ra = a * fade(t, 9.85, 99, 0.25, 0)
    dashed_ring(L, fc, R, 90, 0.5, t * 20, CY, ra * 0.55, 2)
    ticks_ring(L, fc, R + 10, 120, 6, -t * 6, CY, ra * 0.5, 1, 10)
    pr = eio(prog(t, 10.25, 12.75))
    arc(L, fc, R + 34, -90, -90 + 360 * pr, ORG, ra, 6)
    arc(L, fc, R + 34, -90 + 360 * pr, 270, DIM, ra * 0.5, 2)
    for i in range(3):
        arc(L, fc, R - 22, t * 70 + i * 120, t * 70 + i * 120 + 40, CY2, ra * 0.8, 3)
    lbl = "ANALYSIS COMPLETE" if pr >= 1 else f"ANALYZING  {int(pr * 100):3d}%"
    text(L, lbl, fc[0], fc[1] - R - 92, "orb", 30, ORG if pr < 1 else GRN, ra, ax="c", wght=800, track=3,
         SH=SH, pad=10)
    # scan line + mesh
    top, bot = y0 - 40, y1 + 40
    if t < 11.75:
        ys = lerp(top, bot, eio(prog(t, 10.25, 11.75)))
        reveal = ys
    else:
        ys = lerp(bot, top, eio(prog(t, 11.75, 12.55)))
        reveal = 1e9
    ma = a * fade(t, 10.25, 99, 0.05, 0)
    if t >= 10.25:
        ey = pts[TESS][:, :, 1]
        vis = ey.max(1) <= reveal
        dist = np.abs(ey.mean(1) - ys)
        near = vis & (dist < 70)
        far = vis & ~near
        cv2.polylines(L, [np.round(pts[e] * 16).astype(np.int32) for e in TESS[far]], False, ca(CY, ma * 0.42), 1,
                      cv2.LINE_AA, 4)
        cv2.polylines(L, [np.round(pts[e] * 16).astype(np.int32) for e in TESS[near]], False, ca(CY2, ma), 2,
                      cv2.LINE_AA, 4)
        cv2.polylines(L, [np.round(pts[e] * 16).astype(np.int32) for e in CONT if pts[e][:, 1].max() <= reveal],
                      False, ca(CY2, ma * 0.85), 2, cv2.LINE_AA, 4)
        for i in range(0, 478, 3):
            if pts[i][1] <= reveal:
                circle(L, pts[i], 1.8, WHT, ma * 0.7, -1)
        if t < 12.6:
            xa, xb = int(max(0, x0 - 80)), int(min(W, x1 + 80))
            yi = int(ys)
            trail = 130
            if t < 11.75:
                ya, yb = max(0, yi - trail), max(0, yi)
                ramp = np.linspace(0, 1, yb - ya, dtype=np.float32) if yb > ya else None
            else:
                ya, yb = min(H, yi), min(H, yi + trail)
                ramp = np.linspace(1, 0, yb - ya, dtype=np.float32) if yb > ya else None
            if ramp is not None:
                val = (ramp[:, None, None] ** 2 * np.array(CY, np.float32) * 0.45 * ma).astype(np.uint8)
                np.maximum(L[ya:yb, xa:xb], np.broadcast_to(val, (yb - ya, xb - xa, 3)), out=L[ya:yb, xa:xb])
            line(L, (xa, ys), (xb, ys), WHT, ma, 3)
            line(L, (xa - 30, ys), (xa, ys), ORG, ma, 3)
            line(L, (xb, ys), (xb + 30, ys), ORG, ma, 3)
    # key points
    kp = [(468, "OCULAR R", -1, 11.0), (473, "OCULAR L", 1, 11.15), (1, "NASAL APEX", 1, 11.3),
          (152, "MANDIBLE", -1, 11.45)]
    for idx, name, side, t0 in kp:
        ka = a * fade(t, t0, 99, 0.12, 0) * flicker(t, t0, 0.15, idx)
        if ka <= 0:
            continue
        p = pts[idx]
        circle(L, p, 16, ORG, ka, 2)
        line(L, (p[0] - 24, p[1]), (p[0] - 8, p[1]), ORG, ka, 2)
        line(L, (p[0] + 8, p[1]), (p[0] + 24, p[1]), ORG, ka, 2)
        ex = p[0] + side * 150
        ey2 = p[1] - 50
        ex = min(W - 80, max(80, ex))
        line(L, (p[0] + side * 16, p[1] - 6), (ex, ey2), ORG, ka * 0.8, 1)
        line(L, (ex, ey2), (ex + side * 120, ey2), ORG, ka * 0.8, 1)
        text(L, name, ex + (side * 4 if side > 0 else -4), ey2 - 30, "mono", 22, WHT, ka,
             ax="l" if side > 0 else "r", SH=SH, pad=4)
    ia = a * fade(t, 11.2, 99, 0.15, 0)
    if ia > 0:
        pr_, pl_ = pts[468], pts[473]
        line(L, pr_, pl_, CY2, ia, 1)
        mid = (pr_ + pl_) / 2
        text(L, "IPD 63.8mm", mid[0], mid[1] + 26, "mono", 20, CY2, ia, ax="c")
    ba = a * fade(t, 11.5, 99, 0.2, 0)
    if ba > 0:
        beard_zone(L, pts, ORG, ba * (0.75 + 0.25 * math.sin(t * 12)), t)
        chin = pts[152]
        text(L, "BEARD ZONE // 97%", chin[0], chin[1] + 24, "orb", 26, ORG, ba, ax="c", wght=800, track=2,
             SH=SH, pad=8)
    # 3D model panel
    pa = a * eo(prog(t, 10.0, 10.3))
    if pa > 0:
        slide = (1 - pa) * -120
        px0, py0, px1, py1 = 60 + slide, 1150, 470 + slide, 1545
        panel(L, SH, px0, py0, px1, py1, pa, "3D FACE MODEL")
        head3d(L, ((px0 + px1) / 2, py0 + 190), 300, 25 * math.sin((t - 10.0) * 1.6) + (t - 10) * 40, pa)
        circle(L, ((px0 + px1) / 2, py0 + 360), 6, CY, pa * 0.5, 1)
        cv2.ellipse(L, ip(((px0 + px1) / 2, py0 + 355)), (16 * 140, 16 * 22), 0, 0, 360, ca(CY, pa * 0.4), 1,
                    cv2.LINE_AA, 4)
        text(L, "478 PTS // MESH OK", px0 + 16, py1 - 36, "mono", 20, CY, pa)
        # database
        dx0, dy0, dx1, dy1 = 60 + slide, 1590, 470 + slide, 1690
        panel(L, SH, dx0, dy0, dx1, dy1, pa, "DATABASE")
        if t < 12.3:
            rg = np.random.default_rng(int(t * FPS))
            text(L, "CROSS-REFERENCING...", dx0 + 16, dy0 + 12, "mono", 22, CY, pa)
            text(L, " ".join(f"{rg.integers(0, 16 ** 4):04X}" for _ in range(4)), dx0 + 16, dy0 + 48, "mono", 22,
                 DIM, pa)
        else:
            fa2 = pa * flicker(t, 12.3, 0.15, 77)
            text(L, "MATCH: 1 OF 1", dx0 + 16, dy0 + 12, "mono", 22, CY2, fa2)
            text(L, "UNIQUE SPECIMEN", dx0 + 16, dy0 + 46, "orb", 24, ORG, fa2, wght=800, track=1)
    # stats panel
    sa = a * eo(prog(t, 10.15, 10.45))
    if sa > 0:
        slide = (1 - sa) * 120
        qx0, qy0, qx1 = 500 + slide, 1150, 1020 + slide
        qy1 = qy0 + 70 + 66 * len(STATS)
        panel(L, SH, qx0, qy0, qx1, qy1, sa, "FACIAL ANALYSIS // SUBJECT 02")
        for i, (lab, val, vs, col) in enumerate(STATS):
            t0 = STAT_T[i]
            if t < t0:
                continue
            ra2 = sa * flicker(t, t0, 0.1, i + 40)
            y = qy0 + 22 + 66 * i
            text(L, typed(lab, t, t0, 80, False), qx0 + 22, y, "raj", 30, CY, ra2, track=1)
            text(L, decode(vs, t, t0 + 0.05, 0.25, i), qx1 - 22, y + 2, "orb", 26, col, ra2, ax="r", wght=800)
            if val is not None:
                fill = val * eo(prog(t, t0 + 0.05, t0 + 0.4))
                bx0, bx1 = qx0 + 22, qx1 - 22
                cv2.rectangle(L, ip((bx0, y + 44)), ip((bx1, y + 50)), ca(DIM, ra2 * 0.7), -1, cv2.LINE_AA, 4)
                segs = int(40 * fill)
                sw = (bx1 - bx0) / 40
                for s_ in range(segs):
                    cv2.rectangle(L, ip((bx0 + s_ * sw, y + 42)), ip((bx0 + s_ * sw + sw - 3, y + 52)), ca(col, ra2),
                                  -1, cv2.LINE_AA, 4)
            else:
                line(L, (qx0 + 22, y + 47), (qx1 - 22, y + 47), DIM, ra2 * 0.6, 1)


def stamp(L, SH, t):
    st = fade(t, 13.0, 13.85, 0.0, 0.25)
    if st > 0:
        sc = 1 + 0.14 * (1 - eo(prog(t, 13.0, 13.12)))
        cy_ = 960
        shade(SH, 0, cy_ - 80, W, cy_ + 80, 0.7 * st)
        line(L, (0, cy_ - 80), (W, cy_ - 80), GRN, st, 3)
        line(L, (0, cy_ + 80), (W, cy_ + 80), GRN, st, 3)
        text(L, "SCAN COMPLETE", 540, cy_, "orb", int(80 * sc), GRN, st, ax="c", ay="m", wght=900, track=5)


def post_overlay(L, SH, t, M, bf):
    a = fade(t, 13.55, 15.4, 0.25, 0.15)
    lm = lm_at(B_TRK, bf)
    if lm is not None:
        p = tf(M, lm[:, :2] * 4)
        x0, y0, x1, y1 = bbox(p)
        pad = (x1 - x0) * 0.16
        box = (x0 - pad, y0 - pad * 1.2, x1 + pad, y1 + pad * 0.8)
        face_reticle(L, SH, box, t, GRN, a, "SUBJECT 02", "STATUS: LEGEND", rot_speed=50)
    elif t < 15.2:
        p = tf(M, B_TRK[149][:, :2] * 4)
        x0, y0, x1, y1 = bbox(p)
        pad = (x1 - x0) * 0.16
        box = (x0 - pad, y0 - pad * 1.2, x1 + pad, y1 + pad * 0.8)
        blink = 1.0 if int(t * 8) % 2 == 0 else 0.25
        corners(L, *box, 46, RED, a * blink, 3)
        text(L, "SIGNAL LOST", (box[0] + box[2]) / 2, box[3] + 16, "orb", 28, RED, a * blink, ax="c", wght=800,
             track=3, SH=SH, pad=8)
    ra = fade(t, 13.75, 15.4, 0.2, 0.15) * flicker(t, 13.75, 0.2, 31)
    if ra > 0:
        y0 = 1420
        panel(L, SH, 110, y0, 970, y0 + 240, ra, "SCAN RESULT")
        text(L, "CERTIFIED LEGEND", 540, y0 + 34, "orb", 58, ORG, ra, ax="c", wght=900, track=3)
        text(L, "BEARD 97%   //   DRIP MAX   //   VIBE PASSED", 540, y0 + 128, "mono", 26, CY2, ra, ax="c")
        text(L, "★★★★★", 540, y0 + 168, "sym", 40, ORG, ra, ax="c")


OUT_C, OUT_R = (540, 640), 400


def outro(L, SH, t):
    c = OUT_C
    a = 1 - prog(t, TOTAL - 0.35, TOTAL - 0.1)
    reactor(L, c, OUT_R, t, a, build=prog(t, 15.5, 16.2), inner=False)
    circle(L, c, OUT_R * 0.36, CY2, a, 3)
    tt = fade(t, 15.65, 99, 0.1, 0)
    text(L, typed("SUBJECT CLASSIFICATION", t, 15.65, 60, False), 540, 1060, "raj", 36, CY, a * tt, ax="c",
         track=6)
    text(L, decode("ABSOLUTE", t, 16.0, 0.45, 3), 540, 1108, "orb", 104, WHT, a, ax="c", wght=900, track=6)
    text(L, decode("LEGEND", t, 16.2, 0.45, 4), 540, 1228, "orb", 150, ORG, a, ax="c", wght=900, track=10)
    for i in range(5):
        st = 16.65 + i * 0.12
        if t >= st:
            sc = 1 + 0.8 * (1 - eo(prog(t, st, st + 0.15)))
            text(L, "★", 540 + (i - 2) * 92, 1478, "sym", int(64 * sc), ORG, a, ax="c", ay="m")
    text(L, typed("BEARD 97%  //  DRIP MAX  //  VIBE PASSED", t, 17.3, 70, False), 540, 1548, "mono", 28, CY2, a,
         ax="c")
    sa = fade(t, 19.2, 99, 0.2, 0) * flicker(t, 19.2, 0.2, 61)
    text(L, "J.A.R.V.I.S  //  SESSION ENDED", 540, 1620, "raj", 28, CY, a * sa, ax="c", track=4)


# ------------------------------------------------------------------ frame
FREEZE_RAW = np.asarray(BSR[FB])


FACE_W_SR = (FREEZE_LM[:, 0].max() - FREEZE_LM[:, 0].min()) * 4


def outro_bg(t):
    z = 1.55 + 0.1 * prog(t, 15.5, TOTAL)
    img, M = warp(FREEZE_RAW, FACE_C_SR, OUT_C, z)
    small = cv2.resize(grade(img, "B"), (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.GaussianBlur(small, (0, 0), 3), (W, H), interpolation=cv2.INTER_LINEAR)
    bg = scan_look(bg, 1.0) * 0.3
    # sharp face inside the reactor core
    rad = OUT_R * 0.36
    zf = (rad * 1.7) / FACE_W_SR * (1 + 0.06 * prog(t, 15.5, TOTAL))
    fimg, MF = warp(FREEZE_RAW, FACE_C_SR, OUT_C, zf)
    face = scan_look(grade(fimg, "B"), 0.45)
    mask = np.zeros((H, W), np.float32)
    cv2.circle(mask, OUT_C, int(rad), 1.0, -1, cv2.LINE_AA)
    mask = cv2.GaussianBlur(mask, (0, 0), 2)[..., None]
    return bg * (1 - mask) + face * mask, MF


def render(k):
    t = k / FPS
    L = np.zeros((H, W, 3), np.uint8)
    SH = np.zeros((H, W), np.uint8)
    rs = np.random.default_rng(k)
    sh = shake_amt(t)
    off = (rs.normal() * sh, rs.normal() * sh)
    rot = rs.normal() * sh * 0.0004
    pz = pulse(t)

    if t < 1.8:
        base = GRID * clamp01(t / 0.5)
        intro(L, SH, t)
    elif t < 6.5:
        ai = min(140, int((t - 1.8) * 30))
        img, M = warp(A[ai], (540, 960), (540, 960), 1.0 + 0.016 * pz + 0.02 * prog(t, 1.8, 6.5), rot, off)
        base = grade(img, "A")
        if t < 2.2:
            rad = 1300 * eo(prog(t, 1.8, 2.15))
            mk = np.zeros((H, W), np.float32)
            cv2.circle(mk, (540, 760), int(rad), 1.0, -1, cv2.LINE_AA)
            mk = cv2.GaussianBlur(mk, (0, 0), 6)[..., None]
            base = base * mk + GRID * (1 - mk)
            circle(L, (540, 760), rad, CY2, 1 - prog(t, 2.0, 2.2), 6)
            intro(L, SH, t)
        hud_base(L, SH, t, "CAM 01 // LIVE FEED", 1.0)
        a_segment(L, SH, t, M, ai)
    elif t < 15.5:
        bf = b_src(t)
        bi = int(min(184, bf))
        follow = 720
        if t >= 8.25:
            lm = lm_at(B_TRK, min(bf, 149))
            fx = (lm[:, 0].min() + lm[:, 0].max()) / 2 * 4
            follow = lerp(720, min(900, max(540, fx)), eio(prog(t, 8.25, 8.9)))
        P0, Q0, z0 = np.array([follow, 960.0]), np.array([540.0, 960.0]), 1.0
        if 9.5 <= t < 13.75:
            zi = eio(prog(t, 9.5, 9.85)) if t < 13.4 else 1 - eio(prog(t, 13.4, 13.75))
            P = P0 + (FACE_C_SR - P0) * zi
            Q = Q0 + (np.array(SCAN_Q) - Q0) * zi
            z = z0 + (SCAN_Z - z0) * zi
            src_img = BSR[FB] if t < 13.4 else BSR[bi]
        else:
            P, Q, z = P0, Q0, z0
            src_img = BSR[bi]
        z *= 1 + 0.014 * pz
        img, M = warp(src_img, P, Q, z, rot, off)
        if 9.85 <= t < 10.25:
            blk = int(lerp(30, 1, eo(prog(t, 9.85, 10.25))))
            if blk > 1:
                img = cv2.resize(cv2.resize(img, (W // blk, H // blk), interpolation=cv2.INTER_AREA), (W, H),
                                 interpolation=cv2.INTER_NEAREST)
        base = grade(img, "B")
        if 9.5 <= t < 13.75:
            amt = eo(prog(t, 9.5, 9.8)) * (1 - prog(t, 13.4, 13.75))
            base = scan_look(base, amt)
        cam = "CAM 02 // CROWD SCAN" if t < 9.0 else "CAM 02 // FACIAL ANALYSIS" if t < 13.4 else "CAM 02 // LIVE"
        radar_on = not (9.5 <= t < 13.6)
        hud_base(L, SH, t, cam, 1.0, show_radar=radar_on)
        if t < 8.25:
            search_overlay(L, SH, t, M, bf)
        elif t < 9.5:
            lock_overlay(L, SH, t, M, bf)
        elif t < 13.4:
            scan_overlay(L, SH, t, M)
        else:
            post_overlay(L, SH, t, M, bf)
        stamp(L, SH, t)
    else:
        base, M = outro_bg(t)
        outro(L, SH, t)

    caption(L, SH, t, 1712 if t < 15.5 else 1745)

    # grain
    gn = rs.standard_normal((H // 2, W // 2)).astype(np.float32)
    gn = cv2.resize(gn, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    base = np.clip(base + gn * 0.022, 0, 1)

    # composite: darken behind panels, then screen-blend HUD + glow
    out = base * (1 - SH.astype(np.float32)[..., None] / 255 * 0.85)
    Lf = L.astype(np.float32) / 255
    g1 = cv2.resize(cv2.GaussianBlur(cv2.resize(L, (W // 4, H // 4), interpolation=cv2.INTER_AREA), (0, 0), 4),
                    (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    g2 = cv2.resize(cv2.GaussianBlur(cv2.resize(L, (W // 8, H // 8), interpolation=cv2.INTER_AREA), (0, 0), 6),
                    (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    hud = np.clip(Lf + g1 * 0.9 + g2 * 0.7, 0, 1)
    out = 1 - (1 - out) * (1 - hud)

    fl = flash_amt(t)
    if fl > 0.01:
        out = out + (1 - out) * min(0.9, fl)
    out = glitch(out, glitch_amt(t), k)

    # CRT power-off at the very end
    if t > TOTAL - 0.5:
        u = prog(t, TOTAL - 0.5, TOTAL - 0.12)
        img = np.zeros_like(out)
        if u < 0.6:
            hh = min(H, max(2, int(H * (1 - eio(u / 0.6)) + 2)))
            sq = cv2.resize(out, (W, hh), interpolation=cv2.INTER_AREA)
            sq = np.clip(sq * (1 + 2 * u), 0, 1)
            img[H // 2 - hh // 2:H // 2 - hh // 2 + hh] = sq
        elif u < 1:
            ww = max(2, int(W * (1 - eio((u - 0.6) / 0.4))))
            img[H // 2 - 2:H // 2 + 2, W // 2 - ww // 2:W // 2 + ww // 2] = 1.0
        out = img
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    if MODE == "preview":
        for k in map(int, sys.argv[3:]):
            fr = render(k)
            cv2.imwrite(f"{S}/frames/p_{k:04d}.jpg", cv2.cvtColor(fr, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
            print("frame", k, flush=True)
    else:
        k0, k1, outp = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        k1 = min(k1, NF)
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                               "-pix_fmt", "yuv420p", "-x264-params", "keyint=30", outp], stdin=subprocess.PIPE)
        for k in range(k0, k1):
            ff.stdin.write(render(k).tobytes())
            if k % 25 == 0:
                print("frame", k, flush=True)
        ff.stdin.close()
        ff.wait()
        print("done", k0, k1)
