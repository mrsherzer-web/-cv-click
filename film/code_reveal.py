"""Matrix-style "decrypt" reveal of a phone number that ends on a scannable tel: QR code.

usage: code_reveal.py SCRATCH OUTDIR "<number as shown>" "<tel: uri>"
"""
import math
import subprocess
import sys

import cv2
import numpy as np
import segno
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S, OUT, SHOWN, URI = sys.argv[1:5]
M = S + "/movie"
W, H, FPS = 1080, 1920, 30
END = 9.5
NF = int(END * FPS)
DIGITS = "".join(ch for ch in SHOWN if ch.isdigit())

FONT = {"mono": f"{S}/fonts/ShareTechMono-Regular.ttf", "orb": f"{S}/fonts/Orbitron%5Bwght%5D.ttf",
        "heb": f"{M}/fonts/Heebo%5Bwght%5D.ttf"}
CY = np.array([0.0, 0.85, 1.0], np.float32)
GR = np.array([0.25, 1.0, 0.55], np.float32)
WH = np.array([0.92, 1.0, 1.0], np.float32)
_cache = {}


def font(kind, size, wght=None):
    k = (kind, size, wght)
    if k not in _cache:
        f = ImageFont.truetype(FONT[kind], size)
        if wght:
            f.set_variation_by_axes([wght])
        _cache[k] = f
    return _cache[k]


_sc = {}


def sprite(s, kind, size, wght=None):
    key = (s, kind, size, wght)
    if key not in _sc:
        f = font(kind, size, wght)
        heb = any("֐" <= c <= "׿" for c in s)
        kw = dict(direction="rtl", language="he") if heb else {}
        bb = ImageDraw.Draw(Image.new("L", (4, 4))).textbbox((0, 0), s, font=f, anchor="ls", **kw)
        asc, desc = f.getmetrics()
        img = Image.new("L", (bb[2] - bb[0] + 24, asc + desc + 24))
        ImageDraw.Draw(img).text((12 - bb[0], 12 + asc), s, font=f, fill=255, anchor="ls", **kw)
        _sc[key] = np.asarray(img, np.float32) / 255
    return _sc[key]


def text(img, s, x, y, kind, size, col, a=1.0, ax="c", wght=None):
    if a <= 0.01 or not s:
        return
    m = sprite(s, kind, size, wght)
    h, w = m.shape
    x0 = int(x - (w / 2 if ax == "c" else w if ax == "r" else 0))
    y0 = int(y - h / 2)
    xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xe <= xs or ye <= ys:
        return
    sub = m[ys - y0:ye - y0, xs - x0:xe - x0][..., None] * a
    roi = img[ys:ye, xs:xe]
    roi[:] = roi * (1 - sub) + np.asarray(col, np.float32) * sub


def prog(t, a, b):
    return min(1.0, max(0.0, (t - a) / (b - a)))


def eo(x):
    return 1 - (1 - min(1.0, max(0.0, x))) ** 3


# ------------------------------------------------------------------ digital rain made of the number's digits
CELL = 36
COLS, ROWS = W // CELL, H // CELL + 1
rg = np.random.default_rng(58)
GLYPHS = [sprite(c, "mono", 30) for c in "0123456789"]
heads = rg.uniform(-ROWS, ROWS, COLS)
speeds = rg.uniform(9, 22, COLS)
lengths = rg.uniform(8, 22, COLS)
cellchar = rg.integers(0, 10, (ROWS, COLS))
pool = [int(c) for c in DIGITS] or list(range(10))


def rain(t, a=1.0):
    lay = np.zeros((H, W), np.float32)
    rs = np.random.default_rng(int(t * FPS))
    flip = rs.random((ROWS, COLS)) < 0.06
    cellchar[flip] = rs.choice(pool, flip.sum())
    for c in range(COLS):
        head = (heads[c] + speeds[c] * t) % (ROWS + lengths[c]) - 2
        for r in range(int(max(0, head - lengths[c])), int(min(ROWS, head + 1))):
            d = head - r
            br = max(0.0, 1 - d / lengths[c]) ** 1.6 if d >= 0 else 0
            if br <= 0.03:
                continue
            g = GLYPHS[cellchar[r, c]]
            gh, gw = g.shape
            y0, x0 = r * CELL - 6, c * CELL - 6
            ys, xs = max(0, y0), max(0, x0)
            ye, xe = min(H, y0 + gh), min(W, x0 + gw)
            np.maximum(lay[ys:ye, xs:xe], g[ys - y0:ye - y0, xs - x0:xe - x0] * br * (1.6 if d < 1 else 1.0),
                       out=lay[ys:ye, xs:xe])
    glow = cv2.GaussianBlur(cv2.resize(lay, (W // 4, H // 4)), (0, 0), 3)
    glow = cv2.resize(glow, (W, H))
    col = lay[..., None] * GR * 0.9 + glow[..., None] * GR * 0.8
    head_white = np.clip(lay - 0.95, 0, 1)[..., None] * 8
    return (col + head_white * WH) * a


# ------------------------------------------------------------------ QR code
qr = segno.make(URI, error="m")
MAT = np.array([[1 if v else 0 for v in row] for row in qr.matrix], np.uint8)
N = MAT.shape[0]
QUIET = 4
MOD = 720 // (N + 2 * QUIET)
QSIZE = MOD * (N + 2 * QUIET)
QX, QY = (W - QSIZE) // 2, 520


def qr_image(reveal_y=None):
    q = np.ones((QSIZE, QSIZE, 3), np.float32) * np.array([0.93, 1.0, 0.97], np.float32)
    dark = np.array([0.02, 0.06, 0.08], np.float32)
    for r in range(N):
        for c in range(N):
            if MAT[r, c]:
                y0, x0 = (r + QUIET) * MOD, (c + QUIET) * MOD
                q[y0:y0 + MOD, x0:x0 + MOD] = dark
    return q


QIMG = qr_image()


def rounded_mask(w, h, r):
    m = np.zeros((h, w), np.float32)
    cv2.rectangle(m, (r, 0), (w - r, h), 1.0, -1)
    cv2.rectangle(m, (0, r), (w, h - r), 1.0, -1)
    for (cx, cy) in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)):
        cv2.circle(m, (cx, cy), r, 1.0, -1, cv2.LINE_AA)
    return m


QMASK = rounded_mask(QSIZE, QSIZE, 26)[..., None]


def corners(img, x0, y0, x1, y1, ln, col, a, th=4):
    c = tuple(float(v) * a for v in col)
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        cv2.line(img, (int(cx), int(cy)), (int(cx + dx * ln), int(cy)), c, th, cv2.LINE_AA)
        cv2.line(img, (int(cx), int(cy)), (int(cx), int(cy + dy * ln)), c, th, cv2.LINE_AA)


# ------------------------------------------------------------------ timeline
T_TERM, T_DEC0, T_DEC1, T_GRANT, T_QR0, T_QR1 = 1.0, 2.0, 3.8, 3.95, 4.7, 5.7
LOCK = [T_DEC0 + (T_DEC1 - T_DEC0) * (k + 1) / len(SHOWN) for k in range(len(SHOWN))]


def terminal(img, t, a):
    if a <= 0.01:
        return
    x0, y0, x1, y1 = 70, 560, 1010, 1180
    shade = np.zeros((H, W), np.float32)
    cv2.rectangle(shade, (x0, y0), (x1, y1), 0.78 * a, -1)
    img *= 1 - shade[..., None]
    cv2.rectangle(img, (x0, y0), (x1, y1), tuple(float(v) * 0.6 * a for v in CY), 2, cv2.LINE_AA)
    corners(img, x0, y0, x1, y1, 40, CY, a)
    lines = [("> INCOMING SIGNAL", 1.0), ("> TRACING NUMBER ...", 1.35), ("> DECRYPTING", 1.75)]
    for k, (s, ts) in enumerate(lines):
        if t >= ts:
            n = int((t - ts) * 40)
            text(img, s[:n], x0 + 40, y0 + 60 + k * 56, "mono", 38, CY, a, ax="l")
    # big number: scramble, then lock digit by digit
    if t >= T_DEC0:
        rs = np.random.default_rng(int(t * FPS) * 7)
        f = font("mono", 112)
        cw = f.getlength("0")
        total = cw * len(SHOWN)
        xs = W / 2 - total / 2
        for k, ch in enumerate(SHOWN):
            locked = t >= LOCK[k]
            c = ch if (locked or not ch.isdigit()) else str(rs.integers(0, 10))
            col = WH if locked else CY * 0.8
            text(img, c, xs + cw * (k + 0.5), y0 + 330, "mono", 112, col, a)
            if locked and t < LOCK[k] + 0.15:
                g = np.exp(-(((np.arange(W) - (xs + cw * (k + 0.5))) / 40) ** 2))[None, :, None]
                img[y0 + 260:y0 + 400] += g * CY * 0.35 * a
        p = prog(t, T_DEC0, T_DEC1)
        bx0, bx1, by = x0 + 40, x1 - 40, y0 + 470
        cv2.rectangle(img, (bx0, by), (bx1, by + 22), tuple(float(v) * 0.5 * a for v in CY), 2, cv2.LINE_AA)
        if p > 0:
            cv2.rectangle(img, (bx0 + 4, by + 4), (int(bx0 + 4 + (bx1 - bx0 - 8) * p), by + 18),
                          tuple(float(v) * a for v in CY), -1)
        text(img, f"DECRYPTION {int(p * 100):3d}%", x1 - 40, by + 70, "mono", 34, CY, a, ax="r")
    if t >= T_GRANT:
        ga = (1.0 if int((t - T_GRANT) * 10) % 2 == 0 or t > T_GRANT + 0.4 else 0.4) * a
        text(img, "ACCESS GRANTED", W / 2, y1 + 110, "orb", 64, GR, ga, wght=900)


def qr_stage(img, t):
    a = eo(prog(t, T_QR0, T_QR0 + 0.4))
    if a <= 0:
        return
    sweep = prog(t, T_QR0, T_QR1)
    ys = int(QSIZE * sweep)
    card = QIMG.copy()
    if ys < QSIZE:
        card[ys:] = card[ys:] * 0.0 + np.array([0.02, 0.05, 0.06], np.float32)
    roi = img[QY:QY + QSIZE, QX:QX + QSIZE]
    m = QMASK * a
    roi[:] = roi * (1 - m) + card * m
    if 0 < sweep < 1:
        yl = QY + ys
        img[max(0, yl - 4):yl + 4, QX - 30:QX + QSIZE + 30] = WH
        band = np.exp(-((np.arange(-120, 0)) / 60.0) ** 2)[:, None, None]
        y0 = max(0, yl - 120)
        img[y0:yl, QX - 30:QX + QSIZE + 30] += band[-(yl - y0):] * CY * 0.4
    # glowing frame + scanning brackets
    pad = 34 + 8 * math.sin(t * 4)
    corners(img, QX - pad, QY - pad, QX + QSIZE + pad, QY + QSIZE + pad, 70, CY, a, 5)
    ta = eo(prog(t, T_QR1 - 0.2, T_QR1 + 0.4))
    text(img, "SECURE LINE", W / 2, QY - 110, "mono", 40, CY, ta)
    text(img, SHOWN, W / 2, QY + QSIZE + 130, "orb", 84, WH, ta, wght=800)
    text(img, "סרקו לחיוג", W / 2, QY + QSIZE + 240, "heb", 64, GR, ta, wght=600)


def frame(k):
    t = k / FPS
    img = np.zeros((H, W, 3), np.float32) + np.array([0.0, 0.015, 0.02], np.float32)
    ra = 0.55 + 0.45 * eo(prog(t, 0, 1.2))
    if t > T_QR0:
        ra *= 1 - 0.65 * eo(prog(t, T_QR0, T_QR0 + 0.6))
    img += rain(t, ra)
    term_a = eo(prog(t, T_TERM - 0.15, T_TERM + 0.25)) * (1 - eo(prog(t, T_QR0 - 0.25, T_QR0 + 0.15)))
    terminal(img, t, term_a)
    qr_stage(img, t)
    fl = 0.0
    for ht, s in ((T_GRANT, 0.7), (T_QR0, 0.35)):
        if t >= ht:
            fl += s * math.exp(-(t - ht) / 0.09)
    img = img + (1 - img) * min(1.0, fl)
    if 3.85 < t < 4.0 or 4.55 < t < 4.7:
        sh = int(18 * math.sin(t * 90))
        img[..., 0] = np.roll(img[..., 0], sh, 1)
        img[..., 2] = np.roll(img[..., 2], -sh, 1)
    img *= 1 - prog(t, END - 0.5, END)
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    img *= 0.92 + 0.08 * (np.sin(yy * math.pi / 2) ** 2)
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def card_png(path):
    """Still image to share: the QR on a dark card with the number."""
    img = np.zeros((1350, 1080, 3), np.float32) + np.array([0.0, 0.03, 0.04], np.float32)
    global H
    H0 = H
    H = 1350
    roi = img[200:200 + QSIZE, QX:QX + QSIZE]
    roi[:] = roi * (1 - QMASK) + QIMG * QMASK
    corners(img, QX - 34, 166, QX + QSIZE + 34, 234 + QSIZE, 70, CY, 1.0, 5)
    text(img, "SECURE LINE", W / 2, 110, "mono", 40, CY)
    text(img, SHOWN, W / 2, 200 + QSIZE + 130, "orb", 84, WH, wght=800)
    text(img, "סרקו לחיוג", W / 2, 200 + QSIZE + 235, "heb", 64, GR, wght=600)
    H = H0
    cv2.imwrite(path, cv2.cvtColor((np.clip(img, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))


if __name__ == "__main__":
    card_png(f"{OUT}/qr_card.png")
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r",
                           str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt",
                           "yuv420p", f"{S}/movie/work/code_video.mp4"], stdin=subprocess.PIPE)
    for k in range(NF):
        ff.stdin.write(frame(k).tobytes())
    ff.stdin.close()
    ff.wait()
    print("done", NF, "QR version", qr.version, "modules", N, "module px", MOD)
