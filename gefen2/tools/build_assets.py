#!/usr/bin/env python3
"""
GEFEN 2 asset pipeline (local).  Builds every sprite the game needs from the
real photos and writes src/generated/manifest.js.

  pip install "rembg[cpu]" mediapipe pymatting pillow numpy scipy
  python3 gefen2/tools/build_assets.py            # everything
  python3 gefen2/tools/build_assets.py ido dolev  # only some parts

Sources
  gefen2/assets/source/*.jpg        reference photos (ido.jpg is already cropped)
  assets/img/*                      cut-outs made for game 1 (reused, never modified)
  gefen2/assets/hf/<key>.png|webp   optional art from Higgsfield; when a file with
                                    the sprite key exists it replaces the local one
"""
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "source")
OUT = os.path.join(ROOT, "assets", "img")
HF = os.path.join(ROOT, "assets", "hf")
G1 = os.path.join(os.path.dirname(ROOT), "assets", "img")
MASKS = os.path.join(SRC, "masks")
os.makedirs(OUT, exist_ok=True)
os.makedirs(MASKS, exist_ok=True)

EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
EYE_L = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LUM = np.array([0.299, 0.587, 0.114], np.float32)
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]


def log(*a):
    print("[assets]", *a, flush=True)


# ----------------------------------------------------------------- helpers
def mask_for(name):
    """Person mask via rembg (one process per image: the model is memory hungry)."""
    out = os.path.join(MASKS, name + ".png")
    if not os.path.exists(out):
        code = (
            "import sys; from PIL import Image; from rembg import new_session, remove;"
            "s=new_session('birefnet-portrait');"
            "m=remove(Image.open(sys.argv[1]).convert('RGB'), session=s, only_mask=True); m.save(sys.argv[2])"
        )
        subprocess.run([sys.executable, "-c", code, os.path.join(SRC, name + ".jpg"), out], check=True)
        log("mask", name)
    return np.asarray(Image.open(out).convert("L")).astype(np.float32) / 255.0


def landmarks(name, rgb8, cached=True):
    """MediaPipe face points in image pixels (cached in landmarks2.json)."""
    cache = os.path.join(SRC, "landmarks2.json")
    data = json.load(open(cache)) if os.path.exists(cache) else {}
    if cached and name in data and "lips" in data[name]:
        return {k: np.array(v, np.float32) for k, v in data[name].items()}
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision

    opts = vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=os.path.expanduser("~/.models/face_landmarker.task")), num_faces=1)
    det = vision.FaceLandmarker.create_from_options(opts)
    h, w, _ = rgb8.shape
    res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb8)))
    if not res.face_landmarks:
        raise RuntimeError("no face found in " + name)
    pts = np.array([[p.x * w, p.y * h] for p in res.face_landmarks[0]], np.float32)
    lm = {
        "irisA": pts[468], "irisB": pts[473], "eyeA": pts[EYE_R], "eyeB": pts[EYE_L],
        "oval": pts[OVAL], "chin": pts[152], "forehead": pts[10], "nose": pts[1],
        "mouthL": pts[61], "mouthR": pts[291], "lips": pts[LIPS],
    }
    if cached:
        data[name] = {k: v.tolist() for k, v in lm.items()}
        json.dump(data, open(cache, "w"))
        log("landmarks", name)
    return lm


def fg_colors(rgb, alpha):
    try:
        from pymatting import estimate_foreground_ml

        return np.clip(estimate_foreground_ml(rgb.astype(np.float64), alpha.astype(np.float64)), 0, 1).astype(np.float32)
    except Exception:
        return rgb


def to_img(rgb, alpha=None):
    a = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(a, "RGB")
    return Image.fromarray(np.dstack([a, (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)]), "RGBA")


def arr(img):
    a = np.asarray(img.convert("RGBA")).astype(np.float32) / 255.0
    return a[..., :3].copy(), a[..., 3].copy()


def save(img, name, max_h=None, quality=86):
    if max_h and img.height > max_h:
        img = img.resize((round(img.width * max_h / img.height), max_h), Image.LANCZOS)
    p = os.path.join(OUT, name)
    if name.endswith(".webp"):
        img.save(p, "WEBP", quality=quality, method=6)
    elif name.endswith(".png"):
        img.save(p, "PNG", optimize=True)
    else:
        img.convert("RGB").save(p, "JPEG", quality=quality, optimize=True)
    log("wrote", name, img.size, f"{os.path.getsize(p) // 1024} KB")
    return img.size


def noise(h, w, seed=0, scale=8):
    rng = np.random.default_rng(seed)
    small = rng.random((h // scale + 2, w // scale + 2)).astype(np.float32)
    return np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 255.0


def radial(shape, cx, cy, rx, ry=None):
    ry = ry or rx
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2


def grade_possessed(rgb, alpha, eyes, eye_w, seed=1, strength=1.0):
    """Corpse-like grade + dark sockets. eyes: [(x,y),(x,y)]. Returns (rgb, glow)."""
    h, w, _ = rgb.shape
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    col = rgb * (1 - 0.55 * strength) + lum * (0.55 * strength)
    col = col * np.array([0.88, 0.97, 0.93], np.float32)
    col = np.clip((col - 0.5) * (1 + 0.28 * strength) + 0.5 - 0.09 * strength, 0, 1)
    n = noise(h, w, seed, 10)[..., None]
    col *= 0.86 + 0.24 * n
    glow = np.zeros((h, w), np.float32)
    for ex, ey in eyes:
        r = radial((h, w), ex, ey, eye_w * 1.5, eye_w * 1.15)
        socket = np.clip(1 - r, 0, 1) ** 1.3
        col *= (1 - 0.72 * socket * strength)[..., None]
        core = np.clip(1 - radial((h, w), ex, ey, eye_w * 0.34), 0, 1) ** 0.6
        halo = np.clip(1 - radial((h, w), ex, ey, eye_w * 0.95), 0, 1) ** 2.2
        glow = np.maximum(glow, np.clip(core + halo * 0.4, 0, 1))
    glow *= alpha > 0.02
    return np.clip(col, 0, 1), glow


def glow_img(glow):
    g = np.zeros(glow.shape + (3,), np.float32)
    g[..., 0] = glow
    return to_img(g)


# ----------------------------------------------------------------- small tools
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(m, r):
    return cv2.GaussianBlur(m, (0, 0), r) if r > 0 else m


def fbm(h, w, octaves=5, seed=0, base=4):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        n = rng.random((max(2, int(cells * h / max(h, w))) + 1, cells + 1)).astype(np.float32)
        acc += cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC) * amp
        tot += amp
        amp *= 0.55
    return acc / tot


def poly_mask(shape, pts, feather=0.0):
    h, w = shape
    m = np.zeros((h, w), np.uint8)
    p = np.round(np.array(pts, np.float64) * 16).astype(np.int32)
    cv2.fillPoly(m, [p], 255, lineType=cv2.LINE_AA, shift=4)
    m = m.astype(np.float32) / 255.0
    return blur(m, feather)


def skin_mask(rgb, alpha, dark_ok=None):
    """Warm, saturated, lit pixels (the white shirt and the grey knit are neither).

    dark_ok: region where deep shadow still counts as skin (under the chin)."""
    hsv = cv2.cvtColor(np.clip(blur(rgb, 1.6), 0, 1).astype(np.float32), cv2.COLOR_RGB2HSV)
    hue = hsv[..., 0] / 360.0
    hue = np.where(hue > 0.5, hue - 1, hue)
    lit = smoothstep(0.2, 0.3, hsv[..., 2])
    if dark_ok is not None:
        lit = np.maximum(lit, dark_ok * (hsv[..., 2] > 0.06))
    sat, val = hsv[..., 1], hsv[..., 2]
    # skin is clearly saturated; only its highlights may be paler (shadowed folds of the shirt are not)
    rich = np.maximum(smoothstep(0.33, 0.39, sat), smoothstep(0.26, 0.31, sat) * smoothstep(0.55, 0.65, val))
    if dark_ok is not None:
        rich = np.maximum(rich, dark_ok * smoothstep(0.2, 0.3, sat))
    m = smoothstep(0.099, 0.091, hue) * rich * lit * (hue > -0.08) * (alpha > 0.3)
    m8 = cv2.medianBlur((m * 255).astype(np.uint8), 9)
    m8 = cv2.morphologyEx(m8, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    from scipy import ndimage

    m8 = (ndimage.binary_fill_holes(cv2.morphologyEx(m8, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 127) * 255).astype(np.uint8)

    lab, n = ndimage.label(m8 > 127)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, np.arange(1, n + 1))
        keep = np.concatenate([[False], sizes > 0.008 * float((alpha > 0.5).sum())])
        m8 = np.where(keep[lab], m8, 0).astype(np.uint8)
    return blur(m8.astype(np.float32) / 255.0, 1.4)


# ----------------------------------------------------------------- possession (the look of game 1)
def draw_layer(shape, ss=2):
    h, w = shape
    im = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im), ss


def finish_layer(im, shape, r=0.6):
    h, w = shape
    im = im.resize((w, h), Image.LANCZOS)
    if r:
        im = im.filter(ImageFilter.GaussianBlur(r))
    a = np.asarray(im).astype(np.float32) / 255.0
    return a[..., :3], a[..., 3]


def blood_streak(draw, ss, x, y, length, w0, w1, rng, color, wobble=0.06):
    pts = []
    steps = 14
    cx = x
    for i in range(steps + 1):
        t = i / steps
        cx += rng.normal(0, length * wobble / steps * 3)
        pts.append((cx, y + t * length, w0 + (w1 - w0) * t))
    for (xa, ya, ra), (xb, yb, rb) in zip(pts[:-1], pts[1:]):
        draw.polygon([((xa - ra) * ss, ya * ss), ((xa + ra) * ss, ya * ss), ((xb + rb) * ss, yb * ss), ((xb - rb) * ss, yb * ss)], fill=color)
        draw.ellipse(((xb - rb) * ss, (yb - rb) * ss, (xb + rb) * ss, (yb + rb) * ss), fill=color)
    ex, ey, er = pts[-1]
    dr = max(er * 1.9, w0 * 1.1)
    draw.ellipse(((ex - dr) * ss, (ey - dr * 0.8) * ss, (ex + dr) * ss, (ey + dr * 1.25) * ss), fill=color)


def splat(draw, ss, cx, cy, R, rng, color):
    n = 28
    pts = []
    base = rng.random() * 6.28
    for i in range(n):
        a = base + i / n * 2 * math.pi
        r = R * (0.62 + 0.55 * rng.random() ** 2)
        if rng.random() < 0.18:
            r *= 1.6
        pts.append(((cx + math.cos(a) * r) * ss, (cy + math.sin(a) * r * 0.85) * ss))
    draw.polygon(pts, fill=color)
    for _ in range(rng.integers(10, 24)):
        a = rng.random() * 2 * math.pi
        d = R * (1.1 + rng.random() * 1.8)
        r = R * (0.05 + 0.16 * rng.random() ** 2)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.85
        draw.ellipse(((x - r) * ss, (y - r) * ss, (x + r) * ss, (y + r) * ss), fill=color)
    for _ in range(rng.integers(1, 4)):
        x = cx + (rng.random() - 0.5) * R
        blood_streak(draw, ss, x, cy, R * (0.8 + rng.random() * 1.8), R * 0.16, R * 0.07, rng, color, 0.02)


def veins(draw, ss, x, y, ang, length, width, rng, color, depth=0):
    steps = 10
    pts = [(x, y)]
    for _ in range(steps):
        ang += rng.normal(0, 0.35)
        x += math.cos(ang) * length / steps
        y += math.sin(ang) * length / steps
        pts.append((x, y))
    for i in range(len(pts) - 1):
        wdt = max(1, int(width * ss * (1 - i / len(pts)) + 0.5))
        draw.line([(pts[i][0] * ss, pts[i][1] * ss), (pts[i + 1][0] * ss, pts[i + 1][1] * ss)], fill=color, width=wdt)
        if depth < 2 and rng.random() < 0.18:
            veins(draw, ss, pts[i][0], pts[i][1], ang + rng.choice([-1, 1]) * (0.5 + rng.random() * 0.6), length * 0.45, width * 0.6, rng, color, depth + 1)


def possess(rgb, alpha, lm, seed=1, vein=(25, 8, 30), blood=(66, 0, 4), tears=1.0, splats=6, cloth=None, strength=1.0):
    """Corpse grade, grime, veins, black eyes, blood. Returns (rgb, eye glow map)."""
    rng = np.random.default_rng(seed)
    h, w, _ = rgb.shape
    lum = (rgb @ LUM)[..., None]
    fh = float(lm["chin"][1] - lm["forehead"][1])
    col = rgb * 0.34 + lum * 0.66
    col = col * np.array([0.90, 1.0, 0.88], np.float32)
    col = np.clip((col - 0.5) * 1.22 + 0.44, 0, 1)
    col *= 0.78 + 0.32 * fbm(h, w, 5, seed + 3, base=6)[..., None]
    if cloth is not None:
        dirt = smoothstep(0.5, 0.68, fbm(h, w, 6, seed + 9, base=9))[..., None] * cloth[..., None]
        col = col * (1 - 0.5 * dirt) + np.array([0.2, 0.17, 0.12], np.float32) * dirt * 0.22
    eyes = []
    for key in "AB":
        poly = np.array(lm["eye" + key], np.float32)
        eyes.append((poly, np.array(lm["iris" + key], np.float32), float(np.ptp(poly[:, 0]))))
    # sunken sockets
    shade = np.zeros((h, w), np.float32)
    for poly, iris, ew in eyes:
        c = poly.mean(0)
        shade = np.maximum(shade, np.exp(-radial((h, w), c[0], c[1] + ew * 0.05, ew * 1.05, ew * 0.78) * 1.6))
    col *= 1 - shade[..., None] * np.array([0.78, 0.84, 0.76], np.float32) * strength
    # veins around the eyes and down the neck
    layer, draw, ss = draw_layer((h, w))
    for n, (poly, iris, ew) in enumerate(eyes):
        c = poly.mean(0)
        outward = -1 if n == 0 else 1
        for _ in range(9):
            a = rng.uniform(-math.pi, math.pi)
            sx, sy = c[0] + math.cos(a) * ew * 0.75, c[1] + math.sin(a) * ew * 0.55
            ang = a + rng.normal(0, 0.3) + (0.4 * outward if abs(math.cos(a)) > 0.3 else 0)
            veins(draw, ss, sx, sy, ang, ew * rng.uniform(0.5, 1.2), max(1.0, ew * 0.035), rng, vein + (120,))
    for _ in range(7):
        sx = lm["chin"][0] + rng.normal(0, fh * 0.25)
        veins(draw, ss, sx, lm["chin"][1] + fh * rng.uniform(0.12, 0.4), math.pi / 2 + rng.normal(0, 0.6), fh * rng.uniform(0.25, 0.5), max(1.0, fh * 0.012), rng, vein + (95,))
    vrgb, va = finish_layer(layer, (h, w), 0.7)
    va *= alpha
    col = col * (1 - va[..., None]) + vrgb * va[..., None]
    # black eyes; the glow itself is added by the game (and flickers)
    glow = np.zeros((h, w), np.float32)
    for poly, iris, ew in eyes:
        c = poly.mean(0)
        em = poly_mask((h, w), c + (poly - c) * 1.18, max(0.6, ew * 0.035))
        col = col * (1 - em[..., None]) + np.array([0.02, 0.0, 0.01], np.float32) * em[..., None]
        d = radial((h, w), iris[0], iris[1], ew * 0.21)
        glow = np.maximum(glow, np.clip(np.exp(-d * 0.5) * 1.1 + np.exp(-d * 0.07) * 0.22, 0, 1))
    if "lips" in lm:
        lp = poly_mask((h, w), lm["lips"], 1.2)[..., None] * 0.85
        col = col * (1 - lp) + (col @ LUM)[..., None] * np.array([0.5, 0.46, 0.56], np.float32) * lp
    # blood: tears, the corner of the mouth, the clothes
    layer, draw, ss = draw_layer((h, w))
    dark = blood + (215,)
    long_side = int(rng.random() < 0.5)
    for n, (poly, iris, ew) in enumerate(eyes):
        lid = poly[np.argmax(poly[:, 1])]
        length = fh * (rng.uniform(0.38, 0.52) if n == long_side else rng.uniform(0.12, 0.2)) * tears
        if length > 2:
            blood_streak(draw, ss, lid[0] + rng.normal(0, ew * 0.05), lid[1] + ew * 0.04, length, ew * 0.06, ew * 0.03, rng, dark, 0.05)
    mc = lm["mouthL"] if rng.random() < 0.5 else lm["mouthR"]
    if tears > 0:
        blood_streak(draw, ss, mc[0], mc[1], fh * 0.3, fh * 0.02, fh * 0.01, rng, dark, 0.04)
    if cloth is not None and splats:
        ys, xs = np.where(cloth > 0.6)
        ok = ys < np.percentile(ys, 70)
        ys, xs = ys[ok], xs[ok]
        for _ in range(splats):
            i = rng.integers(0, len(ys))
            c2 = (int(blood[0] * rng.uniform(1.0, 1.7)), int(blood[1] + rng.uniform(0, 8)), int(blood[2] + rng.uniform(0, 8)), int(rng.uniform(170, 235)))
            splat(draw, ss, float(xs[i]), float(ys[i]), fh * rng.uniform(0.07, 0.2), rng, c2)
    brgb, ba = finish_layer(layer, (h, w), 0.5)
    ba *= alpha
    col = col * (1 - ba[..., None]) + brgb * ba[..., None]
    return np.clip(col, 0, 1) ** 1.08, glow * (alpha > 0.02)


# ----------------------------------------------------------------- body donor
def head_mask(shape, lm, grow=1.05, side=0.12):
    """1 on the head (hair, ears, the face down to the jaw line), 0 on the neck and below."""
    h, w = shape
    oval = np.array(lm["oval"], np.float32)
    c = oval.mean(0)
    fh = float(lm["chin"][1] - lm["forehead"][1])
    m = poly_mask(shape, (oval - c) * grow + c)
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    top = ((yy < float(lm["nose"][1]) + side * fh) & (np.abs(xx - c[0]) < 1.05 * fh)).astype(np.float32)
    return np.maximum(m, top), fh


def donor_body(top, pants, skin_target, flip=False, gamma=1.0, wide=1.0):
    """A real photographed body (game 1's standing photo, head removed), re-dressed.

    Returns rgb, alpha, cloth mask, chin (x, y) and face height in the returned image."""
    G1SRC = os.path.join(os.path.dirname(ROOT), "assets", "source")
    img = Image.open(os.path.join(G1SRC, "gefen_normal.jpg")).convert("RGB")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    alpha = np.asarray(Image.open(os.path.join(G1SRC, "masks", "gefen_normal.png")).convert("L").resize(img.size, Image.LANCZOS)).astype(np.float32) / 255.0
    lm = json.load(open(os.path.join(G1SRC, "landmarks.json")))["faces"]["gefen"]
    chin = np.array(lm["chin"], np.float32)
    fh = float(chin[1] - lm["forehead"][1])
    rgb = fg_colors(rgb, alpha)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ys, xs = np.where(alpha > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # the face turns into shadowed neck (the new head covers it); all above the ear lobes goes
    box = rgb[int(chin[1] + 0.03 * fh):int(chin[1] + 0.34 * fh), int(chin[0] - 0.3 * fh):int(chin[0] + 0.3 * fh)].reshape(-1, 3)
    box = box[(box.max(1) - box.min(1)) / np.maximum(box.max(1), 1e-3) > 0.24]
    neck = np.median(box, axis=0) if len(box) > 40 else np.array([0.45, 0.3, 0.22], np.float32)
    fill = poly_mask((h, w), lm["oval"], 1.5)
    rgb = rgb * (1 - fill[..., None]) + neck * 0.9 * fill[..., None]
    y_side = float(lm["nose"][1]) + 0.12 * fh
    alpha = alpha * smoothstep(y_side, y_side + 0.1 * fh, yy)
    # regions: skin (warm), shirt (upper, pale), trousers (lower; the hem is almost level)
    neck_box = ((np.abs(xx - chin[0]) < 0.55 * fh) & (yy < chin[1] + 0.42 * fh)).astype(np.float32)
    skin = np.maximum(skin_mask(rgb, alpha, neck_box), fill) * (yy < y0 + (y1 - y0) * 0.87)
    under = 1 - (1 - smoothstep(0.45 * fh, 0.85 * fh, np.abs(xx - chin[0]))) * (1 - (0.6 + 0.4 * smoothstep(chin[1] - 0.1 * fh, chin[1] + 0.5 * fh, yy)))
    rgb = rgb * under[..., None]
    waist = y0 + (y1 - y0) * 0.784
    lower = np.clip((yy - waist + 5) / 10.0, 0, 1)
    lum = rgb @ LUM

    def cloth(color, region, top=1.7):
        sel = (region > 0.5) & (alpha > 0.8) & (skin < 0.2)
        med = np.median(lum[sel]) if np.any(sel) else 0.6
        k = np.clip(lum / max(med, 1e-3), 0, top) ** (1.15 * gamma)
        return k[..., None] * (np.array(color, np.float32) / 255.0)

    donor_skin = np.median(rgb[(skin > 0.8) & (alpha > 0.9)], axis=0)
    skin_rgb = rgb * (np.array(skin_target, np.float32) / 255.0 / np.maximum(donor_skin, 1e-3))
    shirt = cloth(top, 1 - lower) if top is not None else rgb
    out = shirt * (1 - lower)[..., None] + cloth(pants, lower, 1.3) * lower[..., None]
    out = out * (1 - skin)[..., None] + skin_rgb * skin[..., None]
    cm = (1 - skin) * (alpha > 0.5)
    out, a, cm = out[y0:y1, x0:x1], alpha[y0:y1, x0:x1], cm[y0:y1, x0:x1]
    cx, cy = chin[0] - x0, chin[1] - y0
    if flip:
        out, a, cm = out[:, ::-1], a[:, ::-1], cm[:, ::-1]
        cx = (x1 - x0) - cx
    if abs(wide - 1) > 0.01:
        nw = int(round(out.shape[1] * wide))
        rs = lambda m: cv2.resize(np.ascontiguousarray(m), (nw, m.shape[0]), interpolation=cv2.INTER_CUBIC)
        out, a, cm = rs(out), np.clip(rs(a), 0, 1), np.clip(rs(cm), 0, 1)
        cx *= wide
    return np.clip(out, 0, 1), a, cm, (float(cx), float(cy)), fh


def head_cut(rgb, alpha, lm, feather=0.035):
    """The head alone, cut along the jaw. Returns rgb, alpha, landmarks in crop coords, face height."""
    m, fh = head_mask(alpha.shape, lm)
    a = smoothstep(0.04, 0.8, alpha) * smoothstep(0.35, 0.8, blur(m, max(1.0, feather * fh)))
    # the head only: no stray hand or shoulder that happens to be next to it
    from scipy import ndimage

    lab, n = ndimage.label(a > 0.5)
    if n > 1:
        big = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, np.arange(1, n + 1))))
        a = a * blur((lab == big).astype(np.float32), 2.0).clip(0, 0.5) * 2
    ys, xs = np.where(a > 0.03)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    sh = lambda p: np.array(p, np.float32) - np.array([x0, y0], np.float32)
    lm2 = {k: sh(v) for k, v in lm.items()}
    return rgb[y0:y1, x0:x1], a[y0:y1, x0:x1], lm2, fh


def compose(body_rgb, body_a, cloth, head_rgb, head_a, lm, face_h, target_face, chin_y, cx):
    """Paste a head on a body so the chin lands at (cx, chin_y). Returns canvas, landmarks, cloth mask."""
    s = target_face / face_h
    hh, hw = head_a.shape
    nh, nw = max(1, round(hh * s)), max(1, round(hw * s))
    him = to_img(head_rgb, head_a).resize((nw, nh), Image.LANCZOS)
    ox = round(cx - lm["chin"][0] * s)
    oy = round(chin_y - lm["chin"][1] * s)
    padT = max(0, -oy) + 4
    padL = max(0, -ox) + 4
    padR = max(0, ox + nw - body_a.shape[1]) + 4
    W, H = body_a.shape[1] + padL + padR, body_a.shape[0] + padT
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(to_img(body_rgb, body_a), (padL, padT))
    canvas.alpha_composite(him, (ox + padL, oy + padT))
    cm = np.zeros((H, W), np.float32)
    cm[padT:, padL:padL + body_a.shape[1]] = cloth
    ha = np.zeros((H, W), np.float32)
    ha[oy + padT:oy + padT + nh, ox + padL:ox + padL + nw] = np.asarray(him)[..., 3].astype(np.float32) / 255.0
    cm *= 1 - ha
    tr = lambda p: np.array(p, np.float32) * s + np.array([ox + padL, oy + padT], np.float32)
    return canvas, {k: tr(v) for k, v in lm.items()}, cm


def add_legs(img, frac=0.265, shoe=(22, 20, 19), extra=()):
    """The photos end at the knees: grow shins and shoes so the figure stands on the floor.

    extra: other same-size arrays (glow, masks) that get padded the same way. Returns (image, extras)."""
    rgb, a = arr(img)
    H, W = a.shape
    N = int(round(H * frac / (1 - frac)))
    T = max(10, int(H * 0.06))
    inside = a[H - T:].mean(0) > 0.5
    cols = np.where(inside)[0]
    x0, x1 = int(cols.min()), int(cols.max()) + 1
    gaps = [x for x in range(x0, x1) if not inside[x]]
    split = (gaps[0] + gaps[-1] + 1) / 2 if gaps else (x0 + x1) / 2
    gw = len(gaps)
    legs = [(float(x0), split - gw / 2), (split + gw / 2, float(x1))]
    ergb = np.zeros((N, W, 3), np.float32)
    ea = np.zeros((N, W), np.float32)
    xs = np.arange(W, dtype=np.float32)
    sh = int(round((H + N) * 0.04))
    hem = N - int(sh * 0.75)
    ankles = []
    for i in range(N):
        t = i / max(1, N - 1)
        k = i % (2 * T)
        src = H - 1 - (k if k < T else 2 * T - 1 - k)
        sc = 1 - 0.2 * t
        for l, r in legs:
            c = (l + r) / 2
            c2 = c + (c - split) * 0.12 * t
            sx = c + (xs - c2) / sc
            edge = np.minimum(sx - l, r - 1 - sx)
            ok = edge > -1
            si = np.clip(np.round(sx).astype(int), int(l) + 2, max(int(l) + 2, int(r) - 3))
            if i < hem:
                ergb[i][ok] = rgb[src, si[ok]] * (1 - 0.34 * t)
                ea[i][ok] = np.clip((edge[ok] + 1) / 2.0, 0, 1)
            if i == N - 1:
                ankles.append((c2, (r - l) / 2 * sc))
    ergb[max(0, hem - 3):hem] *= 0.6
    ext = to_img(ergb, ea)
    d = ImageDraw.Draw(ext)
    for c2, hw in ankles:
        bw = hw * 1.12
        d.rounded_rectangle((c2 - bw, N - sh, c2 + bw, N - 1), radius=sh * 0.45, fill=shoe + (255,))
        d.rectangle((c2 - bw, N - 1 - max(2, sh * 0.2), c2 + bw, N - 1), fill=tuple(min(255, v + 42) for v in shoe) + (255,))
    out = Image.new("RGBA", (W, H + N), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    out.paste(ext, (0, H))
    more = [np.pad(e, ((0, N), (0, 0)) + (((0, 0),) if e.ndim == 3 else ())) for e in extra]
    return out, more


def eye_info(lm):
    ew = float(np.ptp(lm["eyeA"][:, 0]) + np.ptp(lm["eyeB"][:, 0])) / 2
    return [tuple(lm["irisA"]), tuple(lm["irisB"])], ew


def trim(img, pad=6):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > 8)
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad), img.height)
    return img.crop(box), box


def finish(name, canvas, lm, possessed, h_world, seed=1, max_h=960, extra=None, cloth=None, look=None):
    """Grade (optional), save sprite + glow, return manifest entry."""
    canvas, box = trim(canvas)
    lm = {k: np.array(v, np.float32) - np.array([box[0], box[1]], np.float32) for k, v in lm.items()}
    rgb, a = arr(canvas)
    if cloth is not None:
        cloth = cloth[box[1]:box[3], box[0]:box[2]]
    entry = {"img": f"img/{name}.webp", "aspect": round(canvas.width / canvas.height, 4), "h": h_world}
    if possessed:
        rgb, glow = possess(rgb, a, lm, seed, cloth=cloth, **(look or {}))
        save(glow_img(glow), name + "_glow.png", max_h=max_h)
        entry["glow"] = f"img/{name}_glow.png"
    save(to_img(rgb, a), name + ".webp", max_h=max_h)
    if extra:
        entry.update(extra)
    return entry


def face_card(name, rgb, alpha, lm, eye_rgb, seed=2, look=None):
    """Square close-up for the jump scare overlay (glow baked in)."""
    fh = float(lm["chin"][1] - lm["forehead"][1])
    cx = float((lm["irisA"][0] + lm["irisB"][0]) / 2)
    cy = float(lm["forehead"][1] + fh * 0.52)
    half = fh * 0.92
    h, w = alpha.shape
    x0, y0 = int(max(0, cx - half)), int(max(0, cy - half * 1.05))
    x1, y1 = int(min(w, cx + half)), int(min(h, cy + half * 1.15))
    c = rgb[y0:y1, x0:x1]
    a = alpha[y0:y1, x0:x1]
    sh = lambda p: np.array(p, np.float32) - np.array([x0, y0], np.float32)
    lm2 = {k: sh(v) for k, v in lm.items()}
    col, glow = possess(c, a, lm2, seed, **(look or {}))
    col = np.clip(col * 1.2 + glow[..., None] * np.array(eye_rgb, np.float32) * 1.9 + (glow[..., None] ** 3) * 0.6, 0, 1)
    # fade the bottom and the sides into nothing
    hh, ww = a.shape
    yy = np.linspace(0, 1, hh, dtype=np.float32)[:, None]
    a = a * np.clip((1 - yy) / 0.12, 0, 1)
    img = to_img(col, a).resize((900, round(900 * hh / ww)), Image.LANCZOS)
    card = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    card.alpha_composite(img, ((1024 - img.width) // 2, max(0, 1024 - img.height)), (0, max(0, img.height - 1024)))
    save(card, f"face_{name}.webp", quality=84)
    return f"img/face_{name}.webp"


# ----------------------------------------------------------------- characters
def build_person(name, top, pants, flip, eye_rgb, look, expose=0.0, wb=0.0):
    """Ido / Dolev: their real head on a real photographed body.

    expose: target cheek brightness (0 = leave the photo alone); wb: 0..1 pull towards neutral skin."""
    img = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
    rgb8 = np.asarray(img)
    rgb = rgb8.astype(np.float32) / 255.0
    alpha = mask_for(name)
    lm = landmarks(name, rgb8)
    rgb = fg_colors(rgb, alpha)
    # skin tone from the cheeks
    cx, cy = lm["nose"]
    fh = float(lm["chin"][1] - lm["forehead"][1])
    box = (slice(int(cy - fh * 0.05), int(cy + fh * 0.1)), slice(int(cx - fh * 0.3), int(cx + fh * 0.3)))
    med = np.median(rgb[box].reshape(-1, 3), axis=0)
    if wb:
        want = np.array([1.0, 0.76, 0.63], np.float32)
        k = np.clip(want / (med / med[0]), 0.82, 1.22)
        rgb = np.clip(rgb * (1 + (k - 1) * wb), 0, 1)
        med = np.median(rgb[box].reshape(-1, 3), axis=0)
    if expose:
        g = float(np.clip(expose / max(1e-3, float(med @ LUM)), 0.9, 1.9))
        rgb = np.clip(1 - (1 - np.clip(rgb * g, 0, 1.6) / 1.6) ** 1.25, 0, 1) * 1.0 if g > 1.02 else rgb
        med = np.median(rgb[box].reshape(-1, 3), axis=0)
    skin = tuple(int(v * 255 * 0.9) for v in med)
    hr, ha, hlm, face_h = head_cut(rgb, alpha, lm)
    out = {}
    body_rgb, body_a, cloth, (bx, by), bfh = donor_body(top, pants, skin, flip=flip)
    canvas, clm, cm = compose(body_rgb, body_a, cloth, hr, ha, hlm, face_h, target_face=bfh * 1.07, chin_y=by + 0.03 * bfh, cx=bx)
    full, (cm2,) = add_legs(canvas, extra=(cm,))
    out["idle"] = finish(f"{name}_idle", full.copy(), clm, True, 1.8, seed=len(name) + 1, cloth=cm2, look=look)
    out["normal"] = finish(f"{name}_normal", full.copy(), clm, False, 1.8)
    card = face_card(name, rgb, alpha, lm, eye_rgb, look=dict(look, splats=0))
    return out, card, (canvas, clm, cm)


IDO_LOOK = dict(vein=(20, 6, 26), blood=(34, 2, 6), tears=1.15, splats=4)
DOLEV_LOOK = dict(vein=(8, 22, 60), blood=(20, 6, 14), tears=0.55, splats=3)


def build_ido():
    out, card, (canvas, clm, cm) = build_person("ido", (52, 60, 44), (30, 32, 38), False, (1.0, 0.62, 0.1), IDO_LOOK)
    # in the vent mouth: head and shoulders, close
    fh = float(clm["chin"][1] - clm["forehead"][1])
    top = max(0, int(clm["forehead"][1] - fh * 0.75))
    bot = int(clm["chin"][1] + fh * 1.25)
    cx = float(clm["chin"][0])
    half = fh * 1.7
    box = (int(max(0, cx - half)), top, int(min(canvas.width, cx + half)), bot)
    rgb, a = arr(canvas.crop(box))
    hh = a.shape[0]
    a *= np.clip((hh - np.arange(hh, dtype=np.float32)[:, None]) / (hh * 0.16), 0, 1)
    lm2 = {k: np.array(v, np.float32) - np.array([box[0], box[1]], np.float32) for k, v in clm.items()}
    out["crawl"] = finish("ido_crawl", to_img(rgb, a), lm2, True, 0.66, seed=9, max_h=640, cloth=cm[box[1]:box[3], box[0]:box[2]], look=dict(IDO_LOOK, splats=1))
    return out, card


def build_dolev():
    out, card, _ = build_person("dolev", (24, 24, 28), (38, 44, 60), True, (0.25, 0.65, 1.0), DOLEV_LOOK, expose=0.5, wb=0.7)
    return out, card


def build_gefen():
    out = {}
    # possessed (game 1 art), now down to the floor
    im = Image.open(os.path.join(G1, "char_gefen.webp")).convert("RGBA")
    gl = np.asarray(Image.open(os.path.join(G1, "char_gefen_glow.png")).convert("RGB").resize(im.size)).astype(np.float32) / 255.0
    im, (gl,) = add_legs(im, extra=(gl,))
    gl = to_img(gl)
    save(im, "gefen_idle.webp", max_h=960)
    save(gl, "gefen_idle_glow.png", max_h=960)
    out["idle"] = {"img": "img/gefen_idle.webp", "glow": "img/gefen_idle_glow.png", "aspect": round(im.width / im.height, 4), "h": 1.82}
    # freed
    nm0 = Image.open(os.path.join(G1, "vn_gefen_normal.webp")).convert("RGBA")
    nm, _ = add_legs(nm0)
    save(nm, "gefen_normal.webp", max_h=960)
    out["normal"] = {"img": "img/gefen_normal.webp", "aspect": round(nm.width / nm.height, 4), "h": 1.8}
    # seen from behind: the face is painted over with his own hair, the whole figure darker
    rgb, a = arr(nm)
    h, w = a.shape
    lmg = json.load(open(os.path.join(os.path.dirname(ROOT), "assets", "source", "landmarks.json")))["faces"]["gefen"]
    sc = nm0.height / (1195 - 363)
    oval = (np.array(lmg["oval"], np.float32) - np.array([235, 363], np.float32)) * sc
    c = oval.mean(0)
    fh = float(lmg["chin"][1] - lmg["forehead"][1]) * sc
    ty, tx = slice(max(0, int(c[1] - fh * 0.72)), int(c[1] - fh * 0.52)), slice(int(c[0] - fh * 0.25), int(c[0] + fh * 0.25))
    top = rgb[ty, tx][a[ty, tx] > 0.9]
    hair = np.median(top, axis=0) if len(top) > 20 else np.array([0.5, 0.4, 0.28], np.float32)
    m = poly_mask((h, w), (oval - c) * np.array([1.12, 1.14], np.float32) + c + np.array([0, -0.03 * fh], np.float32), 3.0)[..., None]
    # the back of his head: his own fringe, combed all the way down
    bx0, bx1 = int(c[0] - fh * 0.62), int(c[0] + fh * 0.62)
    by0, by1 = int(c[1] - fh * 0.75), int(c[1] + fh * 0.72)
    src = rgb[max(0, int(c[1] - fh * 0.70)):int(c[1] - fh * 0.5), int(c[0] - fh * 0.3):int(c[0] + fh * 0.3)]
    tex = np.clip(cv2.resize(src, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_CUBIC), 0, 1) if len(top) > 20 else np.tile(hair, (by1 - by0, bx1 - bx0, 1))
    tex = blur(tex, 0.8) * 0.6 + hair * 0.4
    back = rgb.copy()
    back[by0:by1, bx0:bx1] = tex
    yy = np.arange(h, dtype=np.float32)[:, None, None]
    shade = 1.0 - 0.42 * smoothstep(c[1] - fh * 0.3, c[1] + fh * 0.62, yy)
    rgb = rgb * (1 - m) + back * shade * m
    rgb, a = rgb[:, ::-1] * 0.6, a[:, ::-1]
    save(to_img(rgb, a), "gefen_back.webp", max_h=960)
    out["back"] = {"img": "img/gefen_back.webp", "aspect": round(w / h, 4), "h": 1.8}
    # final form: darker, glowing cracks, taller, smoke around him
    rgb, a = arr(im)
    g = np.asarray(gl).astype(np.float32)[..., 0] / 255.0
    h, w = a.shape
    pad = 46
    P = lambda x, v=0: np.pad(x, ((pad, pad), (pad, pad)) + (((0, 0),) if x.ndim == 3 else ()), constant_values=v)
    rgb, a, g = P(rgb), P(a), P(g)
    H2, W2 = a.shape
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    rgb = np.clip((rgb * 0.5 + lum * 0.5) * np.array([0.9, 0.72, 0.72], np.float32) * 0.78, 0, 1)
    rng = np.random.default_rng(11)
    cr = Image.new("L", (W2, H2), 0)
    dr = ImageDraw.Draw(cr)
    for _ in range(26):
        x, y = rng.uniform(pad, W2 - pad), rng.uniform(pad + h * 0.14, H2 - pad - h * 0.1)
        pts = [(x, y)]
        ang = rng.uniform(0, 6.28)
        for _ in range(rng.integers(4, 9)):
            ang += rng.uniform(-0.9, 0.9)
            x += np.cos(ang) * rng.uniform(8, 22)
            y += np.sin(ang) * rng.uniform(8, 22)
            pts.append((x, y))
        dr.line(pts, fill=int(rng.uniform(140, 255)), width=int(rng.integers(1, 3)))
    cracks = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255.0 * (a > 0.6)
    g2 = np.clip(np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.4))).astype(np.float32) / 255.0 * 2.2 + cracks * 0.85, 0, 1)
    smoke = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16))).astype(np.float32) / 255.0
    smoke = np.clip(smoke * 1.3, 0, 1) * (0.55 + 0.45 * noise(H2, W2, 7, 14))
    a2 = np.maximum(a, smoke * 0.72)
    rgb = rgb * (a[..., None] > 0.02) * np.clip(a / np.maximum(a2, 1e-3), 0, 1)[..., None]
    save(to_img(rgb, a2), "gefen_final.webp", max_h=960)
    save(glow_img(g2), "gefen_final_glow.png", max_h=960)
    out["final"] = {"img": "img/gefen_final.webp", "glow": "img/gefen_final_glow.png", "aspect": round(W2 / H2, 4), "h": 2.06}
    # jump scare faces
    js = Image.open(os.path.join(G1, "js_gefen.webp")).convert("RGBA")
    save(js, "face_gefen.webp", quality=84)
    return out


G1SRC = os.path.join(os.path.dirname(ROOT), "assets", "source")
ALLIES = {
    # src photo, landmark key, top colour (None = the white tee as it is), trousers, mirror, body width, height
    "yahali": dict(src="yahali", lm="yahali", top=(27, 27, 31), pants=(36, 38, 46), flip=False, wide=1.0, h=1.76),
    "maayan": dict(src="maayan", lm="maayan", top=(23, 23, 25), pants=(50, 52, 58), flip=True, wide=1.15, h=1.8),
    "cap": dict(src="duo_poster", lm="cap", top=None, pants=(104, 132, 170), flip=False, wide=1.1, h=1.78),
    "smiler": dict(src="duo_poster", lm="smiler", top=None, pants=(62, 76, 108), flip=True, wide=1.0, h=1.8),
}
BOTTLE = [(770, 1880), (850, 1890), (845, 2060), (820, 2200), (812, 2400), (700, 2420), (615, 2350), (640, 2150), (720, 2040), (760, 1990)]


def g1_photo(src):
    img = Image.open(os.path.join(G1SRC, src + ".jpg")).convert("RGB")
    alpha = Image.open(os.path.join(G1SRC, "masks", src + ".png")).convert("L").resize(img.size, Image.LANCZOS)
    return np.asarray(img).astype(np.float32) / 255.0, np.asarray(alpha).astype(np.float32) / 255.0


def build_ally(name, cfg, lms):
    """A friend standing up: his real head on the photographed body, in his own colours."""
    rgb, alpha = g1_photo(cfg["src"])
    lm = {k: np.array(v, np.float32) for k, v in lms[cfg["lm"]].items()}
    fh = float(lm["chin"][1] - lm["forehead"][1])
    # work on the head area only (the poster is huge)
    cx, cy = lm["nose"]
    x0, x1 = int(max(0, cx - 1.5 * fh)), int(min(rgb.shape[1], cx + 1.5 * fh))
    y0, y1 = int(max(0, cy - 1.7 * fh)), int(min(rgb.shape[0], cy + 1.3 * fh))
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    lm = {k: v - np.array([x0, y0], np.float32) for k, v in lm.items()}
    rgb = fg_colors(rgb, alpha)
    cx, cy = lm["nose"]
    med = np.median(rgb[int(cy - fh * 0.05):int(cy + fh * 0.1), int(cx - fh * 0.3):int(cx + fh * 0.3)].reshape(-1, 3), axis=0)
    skin = tuple(int(v * 255 * 0.9) for v in med)
    hr, ha, hlm, face_h = head_cut(rgb, alpha, lm)
    body_rgb, body_a, cloth, (bx, by), bfh = donor_body(cfg["top"], cfg["pants"], skin, flip=cfg["flip"], wide=cfg["wide"])
    canvas, clm, cm = compose(body_rgb, body_a, cloth, hr, ha, hlm, face_h, target_face=bfh * 1.07, chin_y=by + 0.03 * bfh, cx=bx)
    if name == "cap":
        canvas = hold_bottle(canvas, cm, bfh)
    full, _ = add_legs(canvas)
    return finish(f"{name}_idle", full, clm, False, cfg["h"])


def hold_bottle(canvas, cloth, fh):
    """The red bottle from his photo, in the clasped hands."""
    rgb, alpha = g1_photo("duo_poster")
    pts = np.array(BOTTLE, np.float32)
    x0, y0, x1, y1 = int(pts[:, 0].min()) - 6, int(pts[:, 1].min()) - 6, int(pts[:, 0].max()) + 6, int(pts[:, 1].max()) + 6
    m = poly_mask(alpha.shape, BOTTLE, 2)[y0:y1, x0:x1] * alpha[y0:y1, x0:x1]
    b = to_img(fg_colors(rgb[y0:y1, x0:x1], m), m)
    bh = int(fh * 2.15)
    b = b.resize((max(1, round(b.width * bh / b.height)), bh), Image.LANCZOS)
    crgb, ca = arr(canvas)
    H, W = ca.shape
    hands = (ca > 0.5) & (cloth < 0.5)
    hands[: int(H * 0.62)] = False
    ys, xs = np.where(hands)
    if not len(ys):
        return canvas
    hx, hy = float(xs.mean()), float(ys.min() + (ys.max() - ys.min()) * 0.35)
    out = canvas.copy()
    out.alpha_composite(b, (int(hx - b.width * 0.5), int(hy - bh * 0.7)))
    # the fingers go back on top of the glass
    top = to_img(crgb, ca * blur(hands.astype(np.float32), 1.0))
    out.alpha_composite(top)
    return out


def build_allies():
    out = {}
    lms = json.load(open(os.path.join(G1SRC, "landmarks.json")))["faces"]
    for name, cfg in ALLIES.items():
        out[name] = {"idle": build_ally(name, cfg, lms)}
    # Yahali at the monitors: his own photo, in his gaming chair
    im = Image.open(os.path.join(G1, "vn_yahali.webp")).convert("RGBA")
    im, _ = trim(im, 2)
    save(im, "yahali_sit.webp", max_h=820)
    out["yahali"]["sit"] = {"img": "img/yahali_sit.webp", "aspect": round(im.width / im.height, 4), "h": 1.5, "fade": 0.2}
    return out


def hf_glow(name, im):
    """Eye glow map for art that came without one: find the eyes in the picture itself."""
    try:
        lm = landmarks(name, np.asarray(im.convert("RGB")), cached=False)
    except Exception as e:  # no face found (seen from behind, too dark): no glow
        log("no eyes found in", name, "-", e)
        return None
    h, w = im.height, im.width
    glow = np.zeros((h, w), np.float32)
    for key in "AB":
        ew = float(np.ptp(lm["eye" + key][:, 0]))
        d = radial((h, w), lm["iris" + key][0], lm["iris" + key][1], ew * 0.21)
        glow = np.maximum(glow, np.clip(np.exp(-d * 0.5) * 1.1 + np.exp(-d * 0.07) * 0.22, 0, 1))
    return glow_img(glow * (np.asarray(im)[..., 3] > 8))


def apply_hf(manifest):
    """Art dropped into assets/hf/ replaces the local art with the same key.

    sprites:  <who>_<pose>.png|webp  (transparent background, whole figure, feet on the bottom edge)
              <who>_<pose>_glow.png  optional: red channel = how much the eyes glow
    faces:    face_<who>.png|webp    (square jump scare close-up, transparent or black around it)"""
    if not os.path.isdir(HF):
        return
    for who, poses in manifest["sprites"].items():
        for pose, e in list(poses.items()):
            for ext in ("png", "webp"):
                p = os.path.join(HF, f"{who}_{pose}.{ext}")
                if not os.path.exists(p):
                    continue
                im = Image.open(p).convert("RGBA")
                im, _ = trim(im, 4)
                save(im, f"{who}_{pose}.webp", max_h=1000)
                e["aspect"] = round(im.width / im.height, 4)
                gp = os.path.join(HF, f"{who}_{pose}_glow.png")
                had = "glow" in e
                if os.path.exists(gp):
                    g = Image.open(gp).convert("RGB").resize(im.size)
                elif had:
                    g = hf_glow(f"{who}_{pose}", im)
                else:
                    g = None
                if g is not None:
                    save(g, f"{who}_{pose}_glow.png", max_h=1000)
                    e["glow"] = f"img/{who}_{pose}_glow.png"
                else:
                    e.pop("glow", None)
                log("using Higgsfield art for", who, pose)
                break
    for key in list(manifest["images"]):
        for ext in ("png", "webp"):
            p = os.path.join(HF, f"{key}.{ext}")
            if os.path.exists(p) and key.startswith("face_"):
                im = Image.open(p).convert("RGBA").resize((1024, 1024), Image.LANCZOS)
                save(im, f"{key}.webp", quality=84)
                log("using Higgsfield art for", key)
                break


def main():
    only = set(sys.argv[1:])
    want = lambda k: not only or k in only
    mpath = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {"sprites": {}, "images": {}, "videos": {}, "audio": {}, "voice": {}}
    if want("gefen"):
        manifest["sprites"]["gefen"] = build_gefen()
        manifest["images"]["face_gefen"] = "img/face_gefen.webp"
        photo = Image.open(os.path.join(SRC, "gefen_normal.jpg")).convert("RGB")
        save(photo, "gefen_photo.jpg", max_h=640, quality=82)
        manifest["images"]["gefen_photo"] = "img/gefen_photo.jpg"
    if want("ido"):
        manifest["sprites"]["ido"], manifest["images"]["face_ido"] = build_ido()
    if want("dolev"):
        manifest["sprites"]["dolev"], manifest["images"]["face_dolev"] = build_dolev()
    if want("allies"):
        manifest["sprites"].update(build_allies())
    apply_hf(manifest)
    # media that is simply present on disk
    for sub, key, exts in (("video", "videos", (".mp4", ".webm")), ("audio", "audio", (".mp3", ".ogg", ".m4a"))):
        d = os.path.join(ROOT, "assets", sub)
        found = {}
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                b, e = os.path.splitext(f)
                if e in exts:
                    found.setdefault(b, []).append(f"{sub}/{f}")
        if key == "videos":
            manifest[key] = {b: sorted(v, key=lambda p: p.endswith(".webm")) for b, v in found.items()}
        else:
            manifest[key] = {b: v[0] for b, v in found.items()}
    vd = os.path.join(ROOT, "assets", "audio", "v")
    manifest["voice"] = {os.path.splitext(f)[0]: f"audio/v/{f}" for f in sorted(os.listdir(vd))} if os.path.isdir(vd) else {}
    json.dump(manifest, open(mpath, "w"), indent=1)
    gen = os.path.join(ROOT, "src", "generated", "manifest.js")
    with open(gen, "w") as f:
        f.write("// Generated by tools/build_assets.py - do not edit by hand.\nexport const MANIFEST = ")
        json.dump(manifest, f, indent=1)
        f.write(";\n")
    log("manifest:", {k: len(v) for k, v in manifest.items()})


if __name__ == "__main__":
    main()
