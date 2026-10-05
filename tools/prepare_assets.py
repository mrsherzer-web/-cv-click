#!/usr/bin/env python3
"""
Asset pipeline for "הסנוקר של גפן".

Builds every processed image the game uses from the original photos in
assets/source/ (photos + segmentation masks + face landmarks):

  * transparent cut-outs of every character (for the 3D world and dialogues)
  * "possessed" versions of the red-bottle duo (dark sockets, glowing eyes,
    veins, blood) in the style of the scary Gefen photo
  * glow masks (R = eyes, G = the red bottle) used by the 3D shader
  * jump-scare faces, blurred backgrounds and decor textures
  * src/generated/assets-meta.js with sizes and eye positions

Run:  python3 tools/prepare_assets.py
Needs: pillow numpy opencv-python-headless pymatting
(The masks were produced with rembg / BiRefNet-portrait, see tools/segment.py)
"""
import json
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pymatting import estimate_foreground_ml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "source")
OUT = os.path.join(ROOT, "assets", "img")
GEN = os.path.join(ROOT, "src", "generated")
os.makedirs(OUT, exist_ok=True)
os.makedirs(GEN, exist_ok=True)

LM = json.load(open(os.path.join(SRC, "landmarks.json")))["faces"]
META = {}


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def log(*a):
    print("[assets]", *a, flush=True)


def load(name):
    img = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    m = Image.open(os.path.join(SRC, "masks", name + ".png")).convert("L").resize(img.size, Image.LANCZOS)
    a = np.asarray(m).astype(np.float32) / 255.0
    return rgb, a


def tighten(alpha, lo=0.06, hi=0.94):
    t = np.clip((alpha - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def foreground(rgb, alpha):
    """Matting-based foreground colour estimation -> no light halos at edges."""
    fg = estimate_foreground_ml(rgb.astype(np.float64), alpha.astype(np.float64))
    return np.clip(fg, 0, 1).astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(h, w, octaves=5, seed=0, base=4):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        n = rng.random((max(2, int(cells * h / max(h, w))) + 1, cells + 1)).astype(np.float32)
        n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
        acc += n * amp
        tot += amp
        amp *= 0.55
    return acc / tot


def poly_mask(shape, pts, feather=0.0, ss=1):
    h, w = shape
    m = np.zeros((h, w), np.uint8)
    p = np.round(np.array(pts, np.float64) * 16).astype(np.int32)
    cv2.fillPoly(m, [p], 255, lineType=cv2.LINE_AA, shift=4)
    m = m.astype(np.float32) / 255.0
    if feather > 0:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m


def bbox(alpha, thr=0.04, pad=8):
    ys, xs = np.where(alpha > thr)
    x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad + 1)
    return x0, y0, x1, y1


def to_img(rgb, alpha=None):
    rgb8 = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(rgb8, "RGB")
    a8 = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb8, a8]), "RGBA")


def save(img, name, max_h=None, quality=86, max_w=None):
    if max_h and img.height > max_h:
        img = img.resize((round(img.width * max_h / img.height), max_h), Image.LANCZOS)
    if max_w and img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    if name.endswith(".webp"):
        img.save(path, "WEBP", quality=quality, method=6)
    elif name.endswith(".png"):
        img.save(path, "PNG", optimize=True)
    else:
        img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    log("wrote", name, img.size, f"{os.path.getsize(path) // 1024} KB")
    return img.size


def shift_lm(lm, dx, dy, s=1.0):
    """Translate/scale every landmark of a face dict."""
    out = {}
    for k, v in lm.items():
        if isinstance(v, list) and v and isinstance(v[0], list):
            out[k] = [[(p[0] - dx) * s, (p[1] - dy) * s] for p in v]
        else:
            out[k] = [(v[0] - dx) * s, (v[1] - dy) * s]
    return out


def eye_geom(lm, side):
    poly = np.array(lm["eye%s_poly" % side], np.float32)
    iris = np.array(lm["iris" + side], np.float32)
    ew = float(poly[:, 0].max() - poly[:, 0].min())
    return poly, iris, ew


def radial(shape, cx, cy, rx, ry=None, y0=0, x0=0):
    ry = ry or rx
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return ((xx + x0 - cx) / rx) ** 2 + ((yy + y0 - cy) / ry) ** 2


# ----------------------------------------------------------------------------
# "possession" effect
# ----------------------------------------------------------------------------
def draw_layer(shape, ss=2):
    h, w = shape
    im = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im), ss


def finish_layer(im, shape, blur=0.6):
    h, w = shape
    im = im.resize((w, h), Image.LANCZOS)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    arr = np.asarray(im).astype(np.float32) / 255.0
    return arr[..., :3], arr[..., 3]


def blood_streak(draw, ss, x, y, length, w0, w1, rng, color, wobble=0.06):
    pts = []
    steps = 14
    cx = x
    for i in range(steps + 1):
        t = i / steps
        cx += rng.normal(0, length * wobble / steps * 3)
        pts.append((cx, y + t * length, w0 + (w1 - w0) * t))
    for (x0_, y0_, r0), (x1_, y1_, r1) in zip(pts[:-1], pts[1:]):
        poly = [((x0_ - r0) * ss, y0_ * ss), ((x0_ + r0) * ss, y0_ * ss), ((x1_ + r1) * ss, y1_ * ss), ((x1_ - r1) * ss, y1_ * ss)]
        draw.polygon(poly, fill=color)
        draw.ellipse(((x1_ - r1) * ss, (y1_ - r1) * ss, (x1_ + r1) * ss, (y1_ + r1) * ss), fill=color)
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
    for _ in range(rng.integers(1, 4)):  # drips running down
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
            veins(draw, ss, pts[i][0], pts[i][1], ang + rng.choice([-1, 1]) * (0.5 + rng.random() * 0.6),
                  length * 0.45, width * 0.6, rng, color, depth + 1)


def possess(rgb, alpha, lm, seed=1, keep=None, shirt_box=None, grin=False):
    """Turn a normal photo of a person into a possessed version.

    rgb/alpha: float arrays of the (cropped) cut-out. lm: landmarks in the same
    coordinates. keep: mask of pixels to keep colourful (the red bottle).
    Returns (rgb, glow) where glow is the eye-glow intensity map.
    """
    rng = np.random.default_rng(seed)
    h, w, _ = rgb.shape
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    face_h = abs(lm["chin"][1] - lm["forehead"][1])

    # 1) corpse grade: desaturate, sickly green-grey, contrast, darker
    col = rgb * 0.32 + lum * 0.68
    col = col * np.array([0.90, 1.0, 0.86], np.float32)
    col = np.clip((col - 0.5) * 1.22 + 0.44, 0, 1)
    grime = fbm(h, w, 5, seed + 3, base=6)[..., None]
    col *= 0.78 + 0.32 * grime
    if keep is not None:
        k = keep[..., None]
        col = col * (1 - k) + np.clip(rgb * 1.12, 0, 1) * k

    # 2) shirt grime + darker cloth (soft: everything white below the chin)
    if shirt_box is not None:
        sat = rgb.max(-1) - rgb.min(-1)
        shirt = ((lum[..., 0] > 0.5) & (sat < 0.2) & (alpha > 0.6)).astype(np.float32)
        yy = np.arange(h, dtype=np.float32)[:, None]
        below = smoothstep(lm["chin"][1] + face_h * 0.05, lm["chin"][1] + face_h * 0.45, yy)
        sm = cv2.GaussianBlur(shirt, (0, 0), 1.5) * below
        dirt = fbm(h, w, 6, seed + 9, base=10)
        brown = np.array([0.42, 0.40, 0.30], np.float32)
        col = col * (1 - sm[..., None] * 0.55) + (brown * (0.55 + 0.6 * dirt[..., None])) * sm[..., None] * 0.55

    # 3) sunken dark eye sockets + mouth shadow
    shade = np.zeros((h, w), np.float32)
    for side in "AB":
        poly, iris, ew = eye_geom(lm, side)
        c = poly.mean(0)
        d = radial((h, w), c[0], c[1] + ew * 0.05, ew * 1.05, ew * 0.78)
        shade = np.maximum(shade, np.exp(-d * 1.6))
    col *= 1 - shade[..., None] * np.array([0.78, 0.84, 0.76], np.float32)

    # 4) veins
    layer, draw, ss = draw_layer((h, w))
    for side in "AB":
        poly, iris, ew = eye_geom(lm, side)
        c = poly.mean(0)
        outward = -1 if side == "A" else 1
        for _ in range(9):
            a = rng.uniform(-math.pi, math.pi)
            sx, sy = c[0] + math.cos(a) * ew * 0.75, c[1] + math.sin(a) * ew * 0.55
            ang = a + rng.normal(0, 0.3) + (0.4 * outward if abs(math.cos(a)) > 0.3 else 0)
            veins(draw, ss, sx, sy, ang, ew * rng.uniform(0.5, 1.2), max(1.0, ew * 0.035), rng, (25, 8, 30, 120))
    neck_y = lm["chin"][1] + face_h * 0.15
    for _ in range(6):
        sx = lm["chin"][0] + rng.normal(0, face_h * 0.25)
        veins(draw, ss, sx, neck_y + rng.uniform(0, face_h * 0.25), math.pi / 2 + rng.normal(0, 0.6),
              face_h * rng.uniform(0.25, 0.5), max(1.0, face_h * 0.012), rng, (25, 8, 30, 90))
    vrgb, va = finish_layer(layer, (h, w), blur=0.7)
    va *= alpha
    col = col * (1 - va[..., None]) + vrgb * va[..., None]

    # 5) black eyes with a glowing iris
    glow = np.zeros((h, w), np.float32)
    for side in "AB":
        poly, iris, ew = eye_geom(lm, side)
        c = poly.mean(0)
        grown = c + (poly - c) * 1.18
        em = poly_mask((h, w), grown, feather=max(0.6, ew * 0.035))
        col = col * (1 - em[..., None]) + np.array([0.02, 0.0, 0.01], np.float32) * em[..., None]
        r = ew * 0.2
        d = radial((h, w), iris[0], iris[1], r)
        core = np.exp(-d * 2.2)
        halo = np.exp(-d * 0.22)
        add = core[..., None] * np.array([1.0, 0.55, 0.35], np.float32) * 1.15
        add += (core * 0.0 + halo)[..., None] * np.array([0.85, 0.05, 0.02], np.float32) * 0.45
        col = col + add * np.clip(em[..., None] + halo[..., None] * 0.35, 0, 1)
        glow = np.maximum(glow, np.clip(np.exp(-d * 0.5) * 1.1, 0, 1))

    # 6) a darker, wider grin: darken lip line + mouth interior
    mouth = poly_mask((h, w), lm["lips_poly"], feather=1.2)
    col *= 1 - mouth[..., None] * np.array([0.35, 0.55, 0.55], np.float32)
    if grin:
        inner = poly_mask((h, w), lm["mouth_inner"], feather=0.8)
        col *= 1 - inner[..., None] * 0.3

    # 7) blood: tears from both eyes, mouth corner, splatter on the shirt
    layer, draw, ss = draw_layer((h, w))
    dark = (66, 0, 4, 215)
    long_side = "A" if rng.random() < 0.5 else "B"
    for side in "AB":
        poly, iris, ew = eye_geom(lm, side)
        lid = lm["lid%s_dn" % side]
        length = face_h * (rng.uniform(0.38, 0.52) if side == long_side else rng.uniform(0.12, 0.2))
        blood_streak(draw, ss, lid[0] + rng.normal(0, ew * 0.05), lid[1] + ew * 0.04,
                     length, ew * 0.06, ew * 0.03, rng, dark, 0.05)
    mc = lm["mouthL"] if rng.random() < 0.5 else lm["mouthR"]
    blood_streak(draw, ss, mc[0], mc[1], face_h * 0.3, face_h * 0.02, face_h * 0.01, rng, dark, 0.04)
    if shirt_box is not None:
        x0, y0, x1, y1 = shirt_box
        for _ in range(rng.integers(5, 8)):
            cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y0 + (y1 - y0) * 0.75)
            col_ = (int(rng.uniform(70, 120)), int(rng.uniform(0, 8)), int(rng.uniform(4, 12)), int(rng.uniform(170, 235)))
            splat(draw, ss, cx, cy, face_h * rng.uniform(0.07, 0.2), rng, col_)
    brgb, ba = finish_layer(layer, (h, w), blur=0.5)
    ba *= alpha
    col = col * (1 - ba[..., None]) + brgb * ba[..., None]

    # 8) final crush of the shadows
    col = np.clip(col, 0, 1) ** 1.08
    return np.clip(col, 0, 1), glow


def glow_png(eyes, bottle, alpha, name, max_h):
    g = np.zeros(eyes.shape + (3,), np.float32)
    g[..., 0] = eyes
    if bottle is not None:
        g[..., 1] = bottle
    g *= alpha[..., None] > 0.01
    return save(to_img(g), name, max_h=max_h)


# ----------------------------------------------------------------------------
# 1. Gefen (normal + scary)
# ----------------------------------------------------------------------------
def build_gefen():
    for key, name in (("normal", "gefen_normal"), ("scary", "gefen_scary")):
        rgb, a = load(name)
        a = tighten(a)
        fg = foreground(rgb, a)
        lm = LM["gefen" if key == "normal" else "gefen_scary"]
        x0, y0, x1, y1 = bbox(a, pad=6)
        crop_rgb, crop_a = fg[y0:y1, x0:x1], a[y0:y1, x0:x1]
        clm = shift_lm(lm, x0, y0)
        # full photo for the intro screen + blurred backdrop for wide screens
        img = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
        save(img, f"{name}.jpg", quality=90)
        bg = img.resize((img.width // 4, img.height // 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(10))
        save(bg, f"{name}_blur.jpg", quality=80)
        # cut-out for dialogues
        save(to_img(crop_rgb, crop_a), f"vn_gefen_{key}.webp", max_h=1200)
        if key == "scary":
            # in-world billboard with glowing eyes (eyes baked a bit + mask)
            glow = np.zeros(crop_a.shape, np.float32)
            baked = crop_rgb.copy()
            for side in "AB":
                poly, iris, ew = eye_geom(clm, side)
                d = radial(crop_a.shape, iris[0], iris[1], ew * 0.22)
                core = np.exp(-d * 2.0)
                baked += core[..., None] * np.array([0.9, 0.35, 0.25], np.float32) * 0.6
                glow = np.maximum(glow, np.clip(np.exp(-d * 0.45) * 1.15, 0, 1))
            baked = np.clip(baked, 0, 1)
            size = save(to_img(baked, crop_a), "char_gefen.webp", max_h=1024, quality=88)
            glow_png(glow, None, crop_a, "char_gefen_glow.png", max_h=512)
            h, w = crop_a.shape
            META["char_gefen"] = meta_for(clm, w, h, size, cut_bottom=True)
            # jump-scare face: head & shoulders, red eyes, sharpened
            jumpscare(baked, crop_a, clm, "js_gefen.webp", red=True, boost_eyes=1.1)
        else:
            h, w = crop_a.shape
            META["vn_gefen_normal"] = meta_for(clm, w, h, (w, h), cut_bottom=True)


def meta_for(lm, w, h, size, cut_bottom=False):
    eyes = []
    for side in "AB":
        ir = lm["iris" + side]
        eyes.append([round(ir[0] / w, 4), round(ir[1] / h, 4)])
    return {
        "w": size[0], "h": size[1], "aspect": round(w / h, 4),
        "eyes": eyes,
        "head": [round(lm["forehead"][0] / w, 4), round(lm["forehead"][1] / h, 4)],
        "chin": [round(lm["chin"][0] / w, 4), round(lm["chin"][1] / h, 4)],
        "cutBottom": cut_bottom,
    }


def jumpscare(rgb, alpha, lm, name, red=True, size=1024, boost_eyes=0.0):
    face_h = abs(lm["chin"][1] - lm["forehead"][1])
    if boost_eyes > 0:
        rgb = rgb.copy()
        for side in "AB":
            poly, iris, ew = eye_geom(lm, side)
            d = radial(alpha.shape, iris[0], iris[1], ew * 0.2)
            rgb += np.exp(-d * 2.4)[..., None] * np.array([1.0, 0.25, 0.12], np.float32) * boost_eyes
            rgb += np.exp(-d * 0.35)[..., None] * np.array([0.6, 0.02, 0.0], np.float32) * boost_eyes * 0.35
        rgb = np.clip(rgb, 0, 1)
    cx = (lm["forehead"][0] + lm["chin"][0]) / 2
    top = lm["forehead"][1] - face_h * 0.75
    bot = lm["chin"][1] + face_h * 1.25
    half_w = (bot - top) * 0.5
    x0, x1 = int(cx - half_w), int(cx + half_w)
    y0, y1 = int(top), int(bot)
    h, w = alpha.shape
    pad = ((max(0, -y0), max(0, y1 - h)), (max(0, -x0), max(0, x1 - w)))
    rgbp = np.pad(rgb, pad + ((0, 0),), mode="edge")
    ap = np.pad(alpha, pad, mode="constant")
    oy, ox = pad[0][0], pad[1][0]
    c_rgb = rgbp[y0 + oy:y1 + oy, x0 + ox:x1 + ox]
    c_a = ap[y0 + oy:y1 + oy, x0 + ox:x1 + ox]
    # fade the bottom edge so the cut is never visible
    hh = c_a.shape[0]
    ramp = smoothstep(0.0, 0.16, (hh - np.arange(hh, dtype=np.float32)) / hh)[:, None]
    c_a = c_a * ramp
    img = to_img(c_rgb, c_a).resize((size, size), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    save(img, name, quality=88)


# ----------------------------------------------------------------------------
# 2. The red-bottle duo (one poster -> two people)
# ----------------------------------------------------------------------------
SPLIT = [(795, 0), (795, 1960), (838, 2005), (842, 2160), (835, 2400), (835, 2752)]
TEXT_CUT_Y = 2530  # "TRY IT NOW" lives below this line


def build_duo():
    rgb, a = load("duo_poster")
    H, W = a.shape
    a[TEXT_CUT_Y:, :] = 0
    a = tighten(a)
    log("estimating duo foreground (slow)...")
    fg = foreground(rgb, a)

    left_poly = [(0, 0)] + SPLIT + [(0, H)]
    left = poly_mask((H, W), left_poly, feather=1.0)
    a_cap, a_smi = a * left, a * (1 - left)

    # the red bottle (keep it vivid, and make it glow in the dark)
    hsv = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0], hsv[..., 1] / 255, hsv[..., 2] / 255
    region = poly_mask((H, W), [(770, 1880), (850, 1890), (845, 2060), (820, 2200), (812, 2400), (700, 2420),
                                 (615, 2350), (640, 2150), (720, 2040), (760, 1990)], feather=2)
    redness = ((hue < 9) | (hue > 170)) & (sat > 0.45) & (val > 0.2)
    bottle_keep = np.clip(region * 1.0, 0, 1)
    bottle_glow = cv2.GaussianBlur(redness.astype(np.float32) * region, (0, 0), 3) * 0.9

    lm_cap, lm_smi = LM["cap"], LM["smiler"]
    shirt_cap = (lm_cap["chin"][0] - 330, lm_cap["chin"][1] + 120, lm_cap["chin"][0] + 260, lm_cap["chin"][1] + 640)
    shirt_smi = (lm_smi["chin"][0] - 260, lm_smi["chin"][1] + 120, lm_smi["chin"][0] + 330, lm_smi["chin"][1] + 640)

    # possessed versions (computed on the full poster, per person)
    log("possessing the duo...")
    pc, glow_c = possess(fg, a_cap, lm_cap, seed=11, keep=bottle_keep, shirt_box=shirt_cap)
    ps, glow_s = possess(fg, a_smi, lm_smi, seed=23, shirt_box=shirt_smi, grin=True)
    left3 = left[..., None]
    poss = pc * left3 + ps * (1 - left3)
    poss_glow = np.maximum(glow_c * left, glow_s * (1 - left))

    # dialogue portraits (both together)
    x0, y0, x1, y1 = bbox(a, pad=10)
    save(to_img(fg[y0:y1, x0:x1], a[y0:y1, x0:x1]), "vn_duo.webp", max_h=1200)
    save(to_img(poss[y0:y1, x0:x1], a[y0:y1, x0:x1]), "vn_duo_possessed.webp", max_h=1200)

    # in-world billboards: each one alone, upper body down to the thighs
    for key, alpha, img, glow, lm, ycut in (("cap", a_cap, pc, glow_c, lm_cap, 2330),
                                             ("smiler", a_smi, ps, glow_s, lm_smi, 2260)):
        al = alpha.copy()
        al[ycut:, :] = 0
        x0, y0, x1, y1 = bbox(al, pad=6)
        c_rgb, c_a = img[y0:y1, x0:x1], al[y0:y1, x0:x1]
        clm = shift_lm(lm, x0, y0)
        size = save(to_img(c_rgb, c_a), f"char_{key}.webp", max_h=1024, quality=88)
        bg = bottle_glow[y0:y1, x0:x1] if key == "cap" else None
        glow_png(glow[y0:y1, x0:x1], bg, c_a, f"char_{key}_glow.png", max_h=512)
        h, w = c_a.shape
        META[f"char_{key}"] = meta_for(clm, w, h, size, cut_bottom=True)
        jumpscare(c_rgb, c_a, clm, f"js_{key}.webp")
        # normal (not possessed) single portrait too
        n_rgb = fg[y0:y1, x0:x1]
        save(to_img(n_rgb, c_a), f"vn_{key}.webp", max_h=1000)

    # the poster itself, as a wall decoration
    poster = Image.open(os.path.join(SRC, "duo_poster.jpg")).convert("RGB")
    save(poster, "tex_poster_duo.jpg", max_w=560, quality=84)


# ----------------------------------------------------------------------------
# 3. Yahali (with his red gaming chair) and Maayan
# ----------------------------------------------------------------------------
def build_allies():
    rgb, a = load("yahali")
    chair = Image.open(os.path.join(SRC, "masks", "yahali_chair.png")).convert("L").resize((a.shape[1], a.shape[0]))
    chair = cv2.GaussianBlur(np.asarray(chair).astype(np.float32) / 255.0, (0, 0), 1.2)
    a2 = np.maximum(tighten(a), tighten(chair, 0.3, 0.7))
    fg = foreground(rgb, a2)
    x0, y0, x1, y1 = bbox(a2, pad=10)
    save(to_img(fg[y0:y1, x0:x1], a2[y0:y1, x0:x1]), "vn_yahali.webp", max_h=1200)

    rgb, a = load("maayan")
    a = tighten(a)
    solid = cv2.morphologyEx((a > 0.5).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    solid = cv2.dilate(solid, np.ones((5, 5), np.uint8)).astype(np.float32)
    a = a * cv2.GaussianBlur(solid, (0, 0), 1.5)
    # a semi-transparent corduroy scrap of the bean bag above the thumb:
    # inside that area keep only fully opaque pixels (the thumb itself)
    region = poly_mask(a.shape, [(420, 760), (720, 760), (720, 1000), (420, 1000)], feather=6)
    a = a * (1 - region) + a * smoothstep(0.86, 0.97, a) * region
    fg = foreground(rgb, a)
    x0, y0, x1, y1 = bbox(a, pad=10)
    save(to_img(fg[y0:y1, x0:x1], a[y0:y1, x0:x1]), "vn_maayan.webp", max_h=1200)


# ----------------------------------------------------------------------------
def main():
    import sys
    only = set(sys.argv[1:])  # e.g. "python3 tools/prepare_assets.py allies"
    meta_path = os.path.join(GEN, "assets-meta.js")
    if only and os.path.exists(meta_path):  # keep metadata of parts we skip
        txt = open(meta_path).read()
        META.update(json.loads(txt[txt.index("{"):txt.rindex("}") + 1]))
    if not only or "gefen" in only:
        build_gefen()
    if not only or "duo" in only:
        build_duo()
    if not only or "allies" in only:
        build_allies()
    if not only or "decor" in only:
        gefen = Image.open(os.path.join(SRC, "gefen_normal.jpg")).convert("RGB")
        save(gefen.crop((150, 220, 750, 1020)), "tex_gefen_photo.jpg", max_w=360, quality=84)
        scary = Image.open(os.path.join(SRC, "gefen_scary.jpg")).convert("RGB")
        save(scary.crop((150, 220, 750, 1020)), "tex_gefen_scary_photo.jpg", max_w=360, quality=84)
    with open(meta_path, "w") as f:
        f.write("// Generated by tools/prepare_assets.py - do not edit by hand.\n")
        f.write("export const ASSET_META = " + json.dumps(META, indent=2) + ";\n")
    log("done")


if __name__ == "__main__":
    main()
