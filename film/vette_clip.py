"""Standalone "Corvette ride" edit of the drive clip.

usage: vette_clip.py MOVIEDIR part K0 K1 OUT.mp4 | preview K [K ...]
"""
import math
import subprocess
import sys

import cv2
import numpy as np

M, MODE = sys.argv[1], sys.argv[2]
ARGS = sys.argv[3:]
sys.argv = [sys.argv[0], M, "lib"]
sys.path.insert(0, M + "/src")
import film_render as fr  # noqa: E402

from vette_spec import DRIVER_TAG, EDIT, END, T_END, T_EXT1, T_EXT2, VETTE_TAG, YONTI_TAG  # noqa: E402

W, H, FPS = 1080, 1920, 30
NF = int(END * FPS)

# real 2010 Corvette C6 cabin photo (sent by the user); windshield replaced by the rainy street
C6 = cv2.cvtColor(cv2.imread(f"{M}/c6int/main.png"), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
C6_WIN = np.load(f"{M}/c6int/winmask.npy")[..., None]
C6H, C6W = C6.shape[:2]

V = fr.CLIPS["c9eac"]
PM = np.load(f"{M}/work/c9eac_person.npy", mmap_mode="r")
RPM = np.load(f"{M}/work/vette_rpm.npy")
fr.RPM, fr.NF = RPM, NF
xx, yy = fr.xx, fr.yy
WARM, AMBER = fr.WARM, fr.AMBER
eo, prog, lerp, eio = fr.eo, fr.prog, fr.lerp, fr.eio


def lowres_blur(img, k, sigma):
    small = cv2.resize(img, (W // k, H // k), interpolation=cv2.INTER_AREA)
    return cv2.resize(cv2.GaussianBlur(small, (0, 0), sigma), (W, H), interpolation=cv2.INTER_LINEAR)


def desat(img, s):
    lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
    return lum[..., None] * s + img * (1 - s)


def person_mask(i):
    m = cv2.resize(np.asarray(PM[i]), (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    m = np.clip((m - 0.35) / 0.4, 0, 1)
    return cv2.GaussianBlur(m, (0, 0), 3)[..., None]


# global camera motion of the windshield shot, for pinning the HUD to the glass
def wind_offsets():
    idx = range(int(8.6 * 30), min(len(V), int(9.9 * 30)))
    prev, acc, out = None, np.zeros(2), {}
    for i in idx:
        g = cv2.cvtColor(cv2.resize(np.asarray(V[i]), (270, 480)), cv2.COLOR_RGB2GRAY).astype(np.float32)
        if prev is not None:
            (dx, dy), _ = cv2.phaseCorrelate(prev, g)
            acc = acc + np.array([dx, dy]) * 4
        out[i] = acc.copy()
        prev = g
    return out


WOFF = wind_offsets()


def hud_c6(img, t, off):
    """C6-style windshield head-up display: digital speed + tach bar."""
    k = min(NF - 1, int(t * FPS))
    rpm = float(RPM[k])
    kmh = int(round(rpm / 2900 * 92))
    x0, y0 = 330 + off[0] * 0.9, 560 + off[1] * 0.9
    lay = np.zeros((H, W, 3), np.uint8)
    col = (120, 255, 220)
    segs = 24
    lit = int(segs * min(1.0, rpm / 7000))
    for s_ in range(segs):
        ang = math.radians(200 + s_ * 140 / segs)
        r0, r1 = 120, 142
        c = col if s_ < lit else (40, 80, 70)
        if s_ >= segs - 3 and s_ < lit:
            c = (255, 90, 80)
        p0 = (x0 + r0 * math.cos(ang), y0 + 40 + r0 * math.sin(ang))
        p1 = (x0 + r1 * math.cos(ang), y0 + 40 + r1 * math.sin(ang))
        cv2.line(lay, (int(p0[0] * 16), int(p0[1] * 16)), (int(p1[0] * 16), int(p1[1] * 16)), c, 5, cv2.LINE_AA, 4)
    lf = lay.astype(np.float32) / 255
    glow = cv2.GaussianBlur(lf, (0, 0), 6)
    img[:] = 1 - (1 - img) * (1 - (lf * 0.85 + glow * 0.6))
    a = 0.85
    fr.draw_text(img, f"{kmh}", x0, y0 + 40, "mont", 92, 600, (0.55, 1.0, 0.88), a, shadow=0)
    fr.draw_text(img, "KM/H", x0, y0 + 108, "mont", 24, 500, (0.55, 1.0, 0.88), a * 0.9, track=6, shadow=0)


def name_tag(img, t, t0, t1, name, role):
    a1 = eo(prog(t, t0, t0 + 0.35)) * (1 - prog(t, t1 - 0.3, t1))
    a2 = eo(prog(t, t0 + 0.15, t0 + 0.5)) * (1 - prog(t, t1 - 0.3, t1))
    if a1 <= 0:
        return
    img *= 1 - fr.BOTTOM_SHADE * 0.5 * a1
    xr = W - 86
    fr.draw_text(img, name, xr + 24 * (1 - a1), 1440, "sans", 64, 700, WARM, a1, ax="r", shadow=10)
    ln = 150 * eo(prog(t, t0 + 0.1, t0 + 0.5))
    if ln > 1:
        cv2.line(img, (int(xr), 1492), (int(xr - ln), 1492), (AMBER[0] * a1, AMBER[1] * a1, AMBER[2] * a1), 3,
                 cv2.LINE_AA)
    fr.draw_text(img, role, xr, 1540, "serif", 46, 500, AMBER, a2, ax="r", shadow=8)


_rd = np.random.default_rng(21)
C6_DROPS = np.zeros((C6H, C6W), np.float32)
for _ in range(900):
    cx_, cy_, r_ = int(_rd.uniform(0, C6W)), int(_rd.uniform(30, 140)), int(_rd.uniform(1, 4))
    cv2.circle(C6_DROPS, (cx_, cy_), r_, float(_rd.uniform(0.3, 1.0)), -1, cv2.LINE_AA)
C6_DROPS = cv2.GaussianBlur(C6_DROPS, (0, 0), 0.8)[..., None]


def cockpit(t, o0, o1, variant):
    """The real C6 cabin photo, its windshield showing the same rainy street, with a camera move."""
    u = (t - o0) / (o1 - o0)
    p = PLATES[int((t * 12) % len(PLATES))]
    view = fr.grade(cv2.resize(p, (C6W, C6H), interpolation=cv2.INTER_LINEAR))
    view = lowres_blur(cv2.resize(view, (W, H)), 4, 3)
    view = cv2.resize(view, (C6W, C6H)) * 1.05
    c6 = C6 * (1 - C6_WIN) + view * C6_WIN
    c6 = c6 + C6_DROPS * C6_WIN * 0.18
    c6 = desat(c6 * 0.84, 0.12) * np.array([0.95, 0.98, 1.04], np.float32)
    if variant == 1:
        e = eio(prog(u, 0.0, 0.9))
        z, cx, cy = lerp(1.65, 1.0, e), lerp(215, 470, e), lerp(330, 441, e)
    else:
        z, cx, cy = lerp(1.0, 1.08, u), lerp(640, 735, u), 441
    Mc = fr.affine(H / C6H * z, (cx, cy), (540, 960))
    img = cv2.warpAffine(c6, Mc, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT101)
    img = fr.grade(np.clip(img, 0, 1))
    # nav screen and gauge glow
    for (sx, sy, rw, rh, col, s) in ((598, 312, 90, 50, (0.9, 0.5, 0.4), 0.25), (300, 205, 150, 70, (1.0, 0.45, 0.3), 0.12)):
        gx, gy = fr.tf_pt(Mc, (sx, sy))
        g = np.exp(-(((xx - gx) / (rw * H / C6H * z)) ** 2 + ((yy - gy) / (rh * H / C6H * z)) ** 2))[..., None]
        img = img + g * np.array(col, np.float32) * s
    return np.clip(img, 0, 1)


def vette_tag(img, t, t0, t1):
    a1 = eo(prog(t, t0, t0 + 0.3)) * (1 - prog(t, t1 - 0.25, t1))
    a2 = eo(prog(t, t0 + 0.15, t0 + 0.45)) * (1 - prog(t, t1 - 0.25, t1))
    if a1 <= 0:
        return
    img *= 1 - fr.BOTTOM_SHADE * 0.55 * a1
    fr.draw_text(img, "CHEVROLET CORVETTE 2010", W - 86, 1450, "mont", 36, 600, AMBER, a1, ax="r", track=6, shadow=8)
    fr.draw_text(img, "מנוע V8 · 6.2 ליטר", W - 86, 1520, "sans", 54, 500, WARM, a2, ax="r", shadow=10)


def interior(t):
    seg = next(s for s in EDIT if s[0] <= t < s[1]) if t < EDIT[-1][1] else EDIT[-1]
    o0, o1, kind, s0, s1 = seg
    if kind in ("cockpit", "cockpit2"):
        img = cockpit(t, o0, o1, 1 if kind == "cockpit" else 2)
        vette_tag(img, t, *VETTE_TAG)
        return img
    st = s0 + (s1 - s0) * (t - o0) / (o1 - o0)
    i = int(min(len(V) - 1, round(st * 30)))
    raw = np.asarray(V[i])
    z = {"selfie": 1.1, "driver": 1.06, "whip": 1.08, "wind": 1.12}[kind]
    Mc = fr.affine(z * lerp(1.0, 1.03, (t - o0) / (o1 - o0)), (540, 960), (540, 960))
    img = fr.grade(fr.warp(raw, Mc))
    if kind in ("selfie", "driver"):
        pm = fr.warp(person_mask(i), Mc)[..., None]
        bg = lowres_blur(img, 6, 5 if kind == "selfie" else 2.2)
        bg = desat(bg, 0.35) * (0.5 if kind == "selfie" else 0.72)
        img = bg * (1 - pm) + img * pm
    elif kind == "whip":
        k = int(lerp(30, 120, math.sin(math.pi * (t - o0) / (o1 - o0))))
        img = cv2.blur(img, (k, 1)) * 0.85
    elif kind == "wind":
        lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
        sat = img.max(2) - img.min(2)
        w = fr.smooth((0.66 - lum) / 0.13) * fr.smooth((0.16 - sat) / 0.08)
        img = img * (1 - 0.6 * w[..., None])
        img = desat(img, 0.3 * w[..., None])
        off = WOFF.get(i, np.zeros(2))
        hud_c6(img, t, off)
    if kind == "driver":
        fr.gauge(img, t, eo(prog(t, o0 + 0.05, o0 + 0.3)) * (1 - prog(t, o1 - 0.12, o1)))
    name_tag(img, t, *DRIVER_TAG, "דולב דורון", "הנהג")
    name_tag(img, t, *YONTI_TAG, "יונתי", "האח היקר")
    return img


# ------------------------------------------------------------------ exterior
def plate_frames():
    out = []
    for i in range(int(9.0 * 30), int(9.4 * 30)):
        fr_ = np.asarray(V[i])
        crop = fr_[140:780, 330:1000]
        out.append(crop)
    return out


PLATES = plate_frames()


def street_bg(t, dark=0.8):
    k = int((t * 12) % (2 * len(PLATES) - 2))
    k = k if k < len(PLATES) else 2 * len(PLATES) - 2 - k
    p = PLATES[k]
    big = cv2.resize(p, (W, H), interpolation=cv2.INTER_LINEAR)
    img = fr.grade(big)
    img = lowres_blur(img, 4, 6)
    img = desat(img, 0.2) * dark * np.array([0.92, 0.97, 1.05], np.float32)
    return img


def spin_wheel(car, am, c, rx, ry, ang):
    """Rotational blur on one wheel (ellipse normalised to a circle)."""
    cx, cy = c
    R = int(max(rx, ry) * 1.15)
    x0, y0, x1, y1 = int(cx - R), int(cy - R), int(cx + R), int(cy + R)
    if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
        return car
    patch = car[y0:y1, x0:x1].copy()
    sx = ry / rx
    norm = cv2.resize(patch, (int(patch.shape[1] * sx), patch.shape[0]))
    hc = (norm.shape[1] / 2, norm.shape[0] / 2)
    acc = np.zeros_like(norm)
    n = 9
    for j in range(n):
        Mr = cv2.getRotationMatrix2D(hc, ang * (j / (n - 1) - 0.5), 1.0)
        acc += cv2.warpAffine(norm, Mr, (norm.shape[1], norm.shape[0]), borderMode=cv2.BORDER_REFLECT)
    acc /= n
    back = cv2.resize(acc, (patch.shape[1], patch.shape[0]))
    m = np.zeros(patch.shape[:2], np.float32)
    cv2.ellipse(m, (R, R), (int(rx * 0.92), int(ry * 0.92)), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    m = cv2.GaussianBlur(m, (0, 0), 2)[..., None]
    car = car.copy()
    car[y0:y1, x0:x1] = patch * (1 - m) + back * m
    return car


def ext_car(t, name, Mc, expo, wheels=(), tails=(), heads=()):
    rgb, mk = fr.CARS[name]
    base = street_bg(t)
    car = cv2.warpAffine(rgb, Mc, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    am = cv2.warpAffine(mk, Mc, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)[..., None]
    car = fr.grade(np.clip(car, 0, 1)) * expo
    car = desat(car, 0.25) * np.array([0.93, 0.97, 1.04], np.float32)
    for (c, rx, ry) in wheels:
        car = spin_wheel(car, am, c, rx, ry, 70)
    rows = np.where(am[..., 0].max(1) > 0.5)[0]
    yb = int(rows.max()) if len(rows) else H // 2
    cols = np.where(am[..., 0].max(0) > 0.5)[0]
    xa, xb = (int(cols.min()), int(cols.max())) if len(cols) else (0, W)
    # wet road around the car: darker, glossy band + contact shadow + reflection
    band = np.exp(-(((yy - yb) / 260) ** 2))[..., None] * fr.smooth((yy - (yb - 120)) / 120)[..., None]
    base = base * (1 - 0.45 * band)
    sh = np.exp(-(((xx - (xa + xb) / 2) / ((xb - xa) * 0.55)) ** 2 + ((yy - yb + 6) / 22) ** 2))[..., None]
    base = base * (1 - 0.7 * sh)
    hgt = min(H - yb, yb)
    if hgt > 10:
        ref = car[yb - hgt:yb][::-1] * am[yb - hgt:yb][::-1]
        fall = np.exp(-np.arange(hgt) / (hgt * 0.18))[:, None, None].astype(np.float32)
        base[yb:yb + hgt] += cv2.GaussianBlur(ref, (0, 0), 4) * fall * 0.3
    out = base * (1 - am) + car * am
    for (fx, fy, s) in tails:
        g = np.exp(-(((xx - fx) / 45) ** 2 + ((yy - fy) / 36) ** 2))[..., None]
        out += g * s * np.array([1.0, 0.12, 0.08], np.float32) * 0.6
        st = np.exp(-(((xx - fx) / 18) ** 2 + ((yy - (2 * yb - fy)) / 140) ** 2))[..., None]
        out += st * s * np.array([1.0, 0.1, 0.06], np.float32) * 0.35
    for (fx, fy, s) in heads:
        g = np.exp(-(((xx - fx) / 22) ** 2 + ((yy - fy) / 22) ** 2))[..., None]
        streak = np.exp(-(((xx - fx) / 300) ** 2 + ((yy - fy) / 4) ** 2))[..., None]
        beam = np.exp(-(((xx - fx) / 90) ** 2 + ((yy - fy - 60) / 70) ** 2))[..., None]
        out += (g * 1.1 + streak * 0.6 + beam * 0.12) * s * np.array([0.9, 0.95, 1.0], np.float32)
        st = np.exp(-(((xx - fx) / 16) ** 2 + ((yy - (2 * yb - fy)) / 160) ** 2))[..., None]
        out += st * s * np.array([0.9, 0.95, 1.0], np.float32) * 0.25
    fr.rain_layer(out, t, 0.5)
    haze = np.linspace(0.05, 0.0, H, dtype=np.float32)[:, None, None]
    out = out + haze
    return np.clip(out, 0, 1.3), (xa, xb, int(rows.min()) if len(rows) else 0, yb)


def viewfinder(img, t, a=1.0):
    col = (0.95, 0.95, 0.95)
    m, ln = 70, 80
    for (cx, cy, dx, dy) in [(m, 200, 1, 1), (W - m, 200, -1, 1), (m, H - 260, 1, -1), (W - m, H - 260, -1, -1)]:
        cv2.line(img, (cx, cy), (cx + dx * ln, cy), (col[0] * a,) * 3, 2, cv2.LINE_AA)
        cv2.line(img, (cx, cy), (cx, cy + dy * ln), (col[0] * a,) * 3, 2, cv2.LINE_AA)
    if int(t * 2) % 2 == 0:
        cv2.circle(img, (m + 22, 252), 9, (0.95 * a, 0.15 * a, 0.12 * a), -1, cv2.LINE_AA)
    fr.draw_text(img, "REC", m + 44, 252, "mont", 28, 600, col, a, ax="l", shadow=4)
    fr.draw_text(img, "x8.0", W - m - 10, 252, "mont", 28, 500, col, a, ax="r", shadow=4)


def corners(img, x0, y0, x1, y1, ln, col, a=1.0, th=2):
    c = tuple(float(v) * a for v in col)
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        cv2.line(img, (int(cx), int(cy)), (int(cx + dx * ln), int(cy)), c, th, cv2.LINE_AA)
        cv2.line(img, (int(cx), int(cy)), (int(cx), int(cy + dy * ln)), c, th, cv2.LINE_AA)


def callout(img, p_anchor, p_text, name, role, a, side):
    if a <= 0.01:
        return
    col = (1.0, 1.0, 1.0)
    cv2.circle(img, (int(p_anchor[0] * 16), int(p_anchor[1] * 16)), 7 * 16, (a, a, a), 2, cv2.LINE_AA, 4)
    cv2.line(img, (int(p_anchor[0]), int(p_anchor[1])), (int(p_text[0]), int(p_text[1])), (a * 0.9,) * 3, 2,
             cv2.LINE_AA)
    fr.draw_text(img, name, p_text[0], p_text[1] - 62, "sans", 54, 700, col, a, ax=side, shadow=10)
    fr.draw_text(img, role, p_text[0], p_text[1] - 12, "serif", 40, 500, AMBER, a, ax=side, shadow=8)


def exterior(t):
    if t < T_EXT2:  # E1: the Corvette comes toward the camera, seen from far away
        u = (t - T_EXT1) / (T_EXT2 - T_EXT1)
        sc = lerp(0.86, 1.04, eio(u))
        Mc = fr.affine(sc, (450, 300), (540 + 30 * (1 - u), 1060 + 40 * u))
        wh = [(fr.tf_pt(Mc, (435, 335)), 58 * sc, 72 * sc), (fr.tf_pt(Mc, (800, 305)), 38 * sc, 64 * sc)]
        hd = [(*fr.tf_pt(Mc, (86, 256)), 0.9), (*fr.tf_pt(Mc, (318, 262)), 0.9)]
        img, box = ext_car(t, "004481", Mc, 0.95, wheels=wh, heads=hd)
        viewfinder(img, t)
        xa, xb, ya, yb = box
        corners(img, xa - 20, ya - 30, xb + 20, yb + 24, 34, (0.9, 0.9, 0.9), 1.0, 2)
        a = eo(prog(t, T_EXT1 + 0.3, T_EXT1 + 0.8)) * (1 - prog(t, T_EXT2 - 0.25, T_EXT2))
        img *= 1 - fr.BOTTOM_SHADE * 0.5 * a
        fr.draw_text(img, "מבט מרחוק", 540, 1560, "serif", 46, 500, AMBER, a, shadow=8)
        fr.draw_text(img, "עידו הידנה", 540, 1630, "sans", 70, 700, WARM, a, shadow=12)
        return img
    if t < T_END:  # E2: driving away, names on the two seats
        u = (t - T_EXT2) / (T_END - T_EXT2)
        sc = lerp(0.78, 0.6, eo(u))
        bob = math.sin(t * 60) * 1.2
        Mc = fr.affine(sc, (640, 430), (540, lerp(1080, 1010, u) + bob))
        tl = [(*fr.tf_pt(Mc, p), 0.9) for p in ((520, 448), (617, 445), (972, 433), (1063, 433))]
        img, box = ext_car(t, "004475", Mc, 0.9, tails=tl)
        viewfinder(img, t)
        a1 = eo(prog(t, T_EXT2 + 0.35, T_EXT2 + 0.8)) * (1 - prog(t, T_END - 0.3, T_END))
        a2 = eo(prog(t, T_EXT2 + 0.6, T_EXT2 + 1.05)) * (1 - prog(t, T_END - 0.3, T_END))
        drv = fr.tf_pt(Mc, (555, 335))
        pas = fr.tf_pt(Mc, (790, 335))
        top = box[2]
        callout(img, drv, (280, top - 170), "דולב דורון", "הנהג", a1, "c")
        callout(img, pas, (800, top - 170), "יונתי", "האח היקר", a2, "c")
        a3 = eo(prog(t, T_EXT2 + 0.2, T_EXT2 + 0.6)) * (1 - prog(t, T_END - 0.3, T_END))
        fr.draw_text(img, "מבט מרחוק: עידו הידנה", 540, 1640, "serif", 44, 500, WARM, a3, shadow=10)
        return img
    # end card
    img = fr.warm_bg(t) * 0.9
    fr.rain_layer(img, t, 0.25)
    a = eo(prog(t, T_END + 0.15, T_END + 0.8))
    fr.draw_text(img, "CHEVROLET", 540, 720, "mont", 46, 600, (0.92, 0.94, 1.0), a, track=22, shadow=10)
    fr.draw_text(img, "CORVETTE", 540, 850, "bebas", 220, 400, (1, 1, 1), a, track=18, shadow=14, glow=0.3)
    fr.draw_text(img, "2010", 540, 1000, "mont", 64, 300, AMBER, a, track=40, shadow=8)
    rows = [("הנהג", "דולב דורון"), ("לידו", "יונתי, האח היקר"), ("מבט מרחוק", "עידו הידנה")]
    for k, (role, nm) in enumerate(rows):
        ak = eo(prog(t, T_END + 0.6 + 0.25 * k, T_END + 1.0 + 0.25 * k))
        fr.draw_text(img, role, 540, 1180 + k * 130, "serif", 38, 500, AMBER, ak, shadow=8)
        fr.draw_text(img, nm, 540, 1232 + k * 130, "sans", 54, 600, WARM, ak, shadow=10)
    return img * (1 - prog(t, END - 0.9, END - 0.1))


def frame(k):
    t = k / FPS
    img = interior(t) if t < T_EXT1 else exterior(t)
    for ht, s in ((0.62, 0.3), (1.10, 0.55), (EDIT[7][0], 0.4), (T_EXT1, 0.9), (T_EXT2, 0.5), (T_END, 0.6)):
        if t >= ht:
            f = s * math.exp(-(t - ht) / 0.09)
            img = img + (1 - img) * min(1, f)
    if t < 0.25:
        img = img * eo(t / 0.25)
    rs = np.random.default_rng(k)
    gn = cv2.resize(rs.standard_normal((H // 2, W // 2)).astype(np.float32), (W, H))[..., None]
    img = img * fr.VIG + gn * 0.016
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    if MODE == "preview":
        for k in map(int, ARGS):
            cv2.imwrite(f"{M}/frames/v_{k:04d}.jpg", cv2.cvtColor(frame(k), cv2.COLOR_RGB2BGR),
                        [cv2.IMWRITE_JPEG_QUALITY, 88])
    else:
        k0, k1, outp = int(ARGS[0]), min(int(ARGS[1]), NF), ARGS[2]
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                               "-pix_fmt", "yuv420p", outp], stdin=subprocess.PIPE)
        for k in range(k0, k1):
            ff.stdin.write(frame(k).tobytes())
        ff.stdin.close()
        ff.wait()
        print("done", k0, k1)
