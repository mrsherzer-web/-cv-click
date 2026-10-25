"""Ray-traced film of the two-shadow sculpture (one shadow is a tel: QR, the other the number).

usage: shadow_film.py MOVIEDIR URI GROUPS SHOWN part K0 K1 OUT.mp4 | preview K [K ...]
"""
import math
import subprocess
import sys

import cv2
import numpy as np

M, URI, GROUPS, SHOWN, MODE = sys.argv[1:6]
ARGS = sys.argv[6:]
sys.argv = [sys.argv[0], M, "lib"]
sys.path.insert(0, M + "/src")
import film_render as fr  # noqa: E402
from sculpture import build, shadows  # noqa: E402

W, H, FPS = 1080, 1920, 30
SS = 1.5                     # supersampling factor
RW, RH = int(W * SS), int(H * SS)
END = 14.5
NF = int(END * FPS)

V, QRM, NUMM = build(URI, GROUPS.split(","))
n = V.shape[0]
HALF = n / 2
FRONT, SIDE = shadows(V)
TOP = V.any(axis=1)  # [ix, iz]
# per-voxel "this face sees its light" flags
LIT_Z = np.flip(np.cumsum(np.flip(V, 2), 2), 2) - V == 0   # nothing in front along +z
LIT_X = np.flip(np.cumsum(np.flip(V, 0), 0), 0) - V == 0
LIT_Y = np.flip(np.cumsum(np.flip(V, 1), 1), 1) - V == 0

ZW, XW, YF = -55.0, -55.0, -34.0            # back wall, side wall, floor
L_FRONT = np.array([1.0, 0.8, 0.58], np.float32) * 1.15   # warm, from +z
L_SIDE = np.array([0.52, 0.76, 1.0], np.float32) * 1.15   # cool, from +x
L_TOP = np.array([0.62, 0.62, 0.68], np.float32) * 0.55
AMB = np.array([0.055, 0.06, 0.07], np.float32)
TEX = 24


def shadow_tex(mask2d):
    t = np.kron(mask2d.astype(np.float32), np.ones((TEX, TEX), np.float32))
    return cv2.GaussianBlur(t, (0, 0), 1.6)


TEX_FRONT = shadow_tex(FRONT)            # rows: top (y=+HALF) -> bottom, cols: x from -HALF
TEX_SIDE = shadow_tex(SIDE)              # rows: top -> bottom, cols: reading order (z from +HALF down)
TEX_TOP = shadow_tex(TOP.T[::-1, :])     # rows: z from +HALF down, cols: x from -HALF
rng = np.random.default_rng(4)
PLASTER = cv2.GaussianBlur(rng.standard_normal((512, 512)).astype(np.float32), (0, 0), 1.2)


def sample(tex, u, v):
    """Bilinear lookup; u,v in texel units (texel centres at +0.5), outside -> 0 (lit)."""
    h, w = tex.shape
    pad = np.pad(tex, 1)
    x = np.clip(u - 0.5 + 1, 0, w + 0.999)
    y = np.clip(v - 0.5 + 1, 0, h + 0.999)
    x0, y0 = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    x1, y1 = np.minimum(x0 + 1, w + 1), np.minimum(y0 + 1, h + 1)
    fx, fy = (x - x0).astype(np.float32), (y - y0).astype(np.float32)
    top = pad[y0, x0] * (1 - fx) + pad[y0, x1] * fx
    bot = pad[y1, x0] * (1 - fx) + pad[y1, x1] * fx
    return top * (1 - fy) + bot * fy


def camera_rays(C, T, vfov):
    fwd = T - C
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0.0, 1.0, 0.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    th = math.tan(math.radians(vfov) / 2)
    tw = th * RW / RH
    px = (np.arange(RW) + 0.5) / RW * 2 - 1
    py = 1 - (np.arange(RH) + 0.5) / RH * 2
    D = (fwd[None, None, :] + px[None, :, None] * tw * right[None, None, :] +
         py[:, None, None] * th * up[None, None, :])
    D /= np.linalg.norm(D, axis=2, keepdims=True)
    return D.reshape(-1, 3).astype(np.float64)


def trace_voxels(C, D):
    N = len(D)
    hit_t = np.full(N, np.inf)
    hit_ax = np.zeros(N, np.int8)
    hit_sg = np.zeros(N, np.int8)
    hit_cell = np.zeros((N, 3), np.int32)
    Ds = np.where(np.abs(D) < 1e-12, 1e-12, D)
    inv = 1.0 / Ds
    t1, t2 = (-HALF - C) * inv, (HALF - C) * inv
    tn, tf = np.minimum(t1, t2), np.maximum(t1, t2)
    tmin, tmax = tn.max(1), tf.min(1)
    ok = np.where(tmax > np.maximum(tmin, 0))[0]
    if not len(ok):
        return hit_t, hit_ax, hit_sg, hit_cell
    d, iv = D[ok], inv[ok]
    t0 = np.maximum(tmin[ok], 0) + 1e-6
    ax = np.argmax(tn[ok], 1).astype(np.int8)
    P = C + d * t0[:, None]
    cell = np.clip(np.floor(P + HALF).astype(np.int32), 0, n - 1)
    step = np.where(d > 0, 1, -1).astype(np.int32)
    tdel = np.abs(iv)
    tmx = (cell + (step > 0) - HALF - C) * iv
    tcur = t0.copy()
    act = np.arange(len(ok))
    for _ in range(3 * n + 3):
        if not len(act):
            break
        c = cell[act]
        occ = V[c[:, 0], c[:, 1], c[:, 2]]
        h = act[occ]
        g = ok[h]
        hit_t[g] = tcur[h]
        hit_ax[g] = ax[h]
        hit_sg[g] = -step[h, ax[h]]
        hit_cell[g] = cell[h]
        act = act[~occ]
        if not len(act):
            break
        k = np.argmin(tmx[act], 1)
        r = np.arange(len(act))
        tcur[act] = tmx[act, k]
        tmx[act, k] += tdel[act, k]
        cell[act, k] += step[act, k]
        ax[act] = k
        inside = ((cell[act] >= 0) & (cell[act] < n)).all(1)
        act = act[inside]
        _ = r
    return hit_t, hit_ax, hit_sg, hit_cell


def spot(a, b, cx, cy, s):
    return np.exp(-(((a - cx) ** 2 + (b - cy) ** 2) / (2 * s * s)))


def render(C, T, vfov):
    D = camera_rays(np.asarray(C, float), np.asarray(T, float), vfov)
    C = np.asarray(C, float)
    N = len(D)
    col = np.zeros((N, 3), np.float32) + np.array([0.012, 0.014, 0.02], np.float32)
    best = np.full(N, np.inf)
    # --- walls and floor
    for kind in ("back", "side", "floor"):
        if kind == "back":
            t = (ZW - C[2]) / np.where(np.abs(D[:, 2]) < 1e-9, 1e-9, D[:, 2])
        elif kind == "side":
            t = (XW - C[0]) / np.where(np.abs(D[:, 0]) < 1e-9, 1e-9, D[:, 0])
        else:
            t = (YF - C[1]) / np.where(np.abs(D[:, 1]) < 1e-9, 1e-9, D[:, 1])
        P = C + D * t[:, None]
        if kind == "back":
            ok = (t > 0) & (P[:, 0] > XW) & (P[:, 0] < 75) & (P[:, 1] > YF) & (P[:, 1] < 160)
        elif kind == "side":
            ok = (t > 0) & (P[:, 2] > ZW) & (P[:, 2] < 75) & (P[:, 1] > YF) & (P[:, 1] < 160)
        else:
            ok = (t > 0) & (P[:, 0] > XW) & (P[:, 0] < 75) & (P[:, 2] > ZW) & (P[:, 2] < 75)
        ok &= t < best
        idx = np.where(ok)[0]
        if not len(idx):
            continue
        p = P[idx]
        if kind == "back":
            u, v = (p[:, 0] + HALF) * TEX, (HALF - p[:, 1]) * TEX
            sh = sample(TEX_FRONT, u, v)
            fall = spot(p[:, 0], p[:, 1], 0, 0, 34)
            light = L_FRONT[None] * ((1 - sh) * (0.25 + 0.75 * fall))[:, None]
            tu, tv = p[:, 0], p[:, 1]
        elif kind == "side":
            u, v = (HALF - p[:, 2]) * TEX, (HALF - p[:, 1]) * TEX
            sh = sample(TEX_SIDE, u, v)
            fall = spot(p[:, 2], p[:, 1], 0, 0, 34)
            light = L_SIDE[None] * ((1 - sh) * (0.25 + 0.75 * fall))[:, None]
            tu, tv = p[:, 2], p[:, 1]
        else:
            u, v = (p[:, 0] + HALF) * TEX, (HALF - p[:, 2]) * TEX
            sh = sample(TEX_TOP, u, v)
            fall = spot(p[:, 0], p[:, 2], 0, 0, 40)
            light = L_TOP[None] * ((1 - 0.75 * sh) * (0.2 + 0.8 * fall))[:, None]
            tu, tv = p[:, 0], p[:, 2]
        grain = PLASTER[(tv * 6).astype(int) % 512, (tu * 6).astype(int) % 512][:, None] * 0.02
        alb = 0.82 + grain
        col[idx] = alb * (AMB[None] + light)
        best[idx] = t[idx]
    # --- sculpture
    ht, hax, hsg, hcell = trace_voxels(C, D)
    idx = np.where(ht < best)[0]
    if len(idx):
        P = C + D[idx] * ht[idx, None]
        nrm = np.zeros((len(idx), 3))
        nrm[np.arange(len(idx)), hax[idx]] = hsg[idx]
        cx, cy, cz = hcell[idx].T
        lz = ((hax[idx] == 2) & (hsg[idx] > 0) & LIT_Z[cx, cy, cz]).astype(np.float32)
        lx = ((hax[idx] == 0) & (hsg[idx] > 0) & LIT_X[cx, cy, cz]).astype(np.float32)
        ly = ((hax[idx] == 1) & (hsg[idx] > 0) & LIT_Y[cx, cy, cz]).astype(np.float32)
        fr_ = P + HALF - np.floor(P + HALF)
        a0 = np.take_along_axis(fr_, ((hax[idx] + 1) % 3)[:, None].astype(int), 1)[:, 0]
        a1 = np.take_along_axis(fr_, ((hax[idx] + 2) % 3)[:, None].astype(int), 1)[:, 0]
        edge = np.minimum(np.minimum(a0, 1 - a0), np.minimum(a1, 1 - a1))
        seam = 0.55 + 0.45 * np.clip(edge / 0.07, 0, 1)
        vd = -D[idx]
        spec = np.zeros(len(idx))
        for Ldir, on in (((0, 0, 1.0), lz), ((1.0, 0, 0), lx)):
            Ld = np.array(Ldir)
            R = 2 * (nrm @ Ld)[:, None] * nrm - Ld
            spec += on * np.clip((R * vd).sum(1), 0, 1) ** 40 * 0.6
        alb = np.array([0.7, 0.71, 0.74], np.float32)
        c = alb[None] * (AMB[None] * 3.2 + lz[:, None] * L_FRONT[None] + lx[:, None] * L_SIDE[None] +
                         ly[:, None] * L_TOP[None])
        c = c * seam[:, None] + spec[:, None]
        col[idx] = c
        best[idx] = ht[idx]
    img = col.reshape(RH, RW, 3)
    img = 1 - np.exp(-img * 1.35)
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


# ------------------------------------------------------------------ camera
def arc(p0, p1, u, radius):
    a0, a1 = math.atan2(p0[2], p0[0]), math.atan2(p1[2], p1[0])
    if a1 - a0 > math.pi:
        a1 -= 2 * math.pi
    if a0 - a1 > math.pi:
        a1 += 2 * math.pi
    a = a0 + (a1 - a0) * u
    r = radius
    return np.array([r * math.cos(a), p0[1] + (p1[1] - p0[1]) * u, r * math.sin(a)])


KEYS = [  # time, position, target, vfov, how to travel to the next key
    (0.0, (98, 30, 52), (-20, -4, -20), 66, "lin"),
    (4.2, (56, 36, 100), (-20, -4, -20), 66, "lin"),
    (5.3, (6, 46, 4), (0, -2, -40), 60, "lin"),
    (6.4, (0, 0, -14), (0, 0, -55), 70, "lin"),
    (8.6, (0, 0, -15.5), (0, 0, -55), 70, "arc"),
    (9.8, (-14, 0, 0), (-55, 0, 0), 70, "lin"),
    (11.8, (-15.5, 0, 0), (-55, 0, 0), 70, "lin"),
    (13.0, (-6, 52, 44), (-20, -4, -20), 66, "lin"),
    (14.5, (90, 34, 84), (-20, -4, -20), 66, "lin"),
]


def cam(t):
    for k in range(len(KEYS) - 1):
        t0, p0, q0, f0, how = KEYS[k]
        t1, p1, q1, f1, _ = KEYS[k + 1]
        if t <= t1 or k == len(KEYS) - 2:
            u = fr.eio(fr.prog(t, t0, t1))
            p0, p1, q0, q1 = map(np.array, (p0, p1, q0, q1))
            if how == "arc":
                p = arc(p0, p1, u, np.linalg.norm(p0[[0, 2]]))
                q = arc(q0, q1, u, np.linalg.norm(q0[[0, 2]]))
            else:
                p, q = p0 + (p1 - p0) * u, q0 + (q1 - q0) * u
            return p, q, f0 + (f1 - f0) * u
    return np.array(KEYS[-1][1]), np.array(KEYS[-1][2]), KEYS[-1][3]


# ------------------------------------------------------------------ titles
def caption(img, t, s, t0, t1, y, size=78, kind="serif", wght=500, col=fr.WARM):
    a = fr.eo(fr.prog(t, t0, t0 + 0.5)) * (1 - fr.prog(t, t1 - 0.4, t1))
    fr.draw_text(img, s, 540, y, kind, size, wght, col, a, shadow=14)


def frame(k):
    t = k / FPS
    C, T, f = cam(t)
    img = render(C, T, f).astype(np.float32)
    caption(img, t, "פסל אחד.", 0.5, 4.1, 300)
    caption(img, t, "שני צללים.", 1.9, 4.1, 410)
    caption(img, t, "הצל הראשון — קוד.", 6.5, 8.6, 260, 66)
    caption(img, t, "סרקו את הצל", 6.9, 8.6, 1680, 58, "sans", 600, fr.AMBER)
    caption(img, t, "הצל השני — המספר.", 9.9, 11.8, 260, 66)
    a = fr.eo(fr.prog(t, 13.0, 13.6))
    fr.draw_text(img, SHOWN, 540, 300, "mont", 86, 700, (1, 1, 1), a, track=6, shadow=16)
    fr.draw_text(img, "פסל אחד. שני צללים. מספר אחד.", 540, 400, "serif", 52, 500, fr.WARM, a, shadow=12)
    img = img * (fr.eo(min(1.0, t / 0.6))) * (1 - fr.prog(t, END - 0.5, END))
    rs = np.random.default_rng(k)
    img = img + cv2.resize(rs.standard_normal((H // 2, W // 2)).astype(np.float32), (W, H))[..., None] * 0.012
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    if MODE == "preview":
        for k in map(int, ARGS):
            cv2.imwrite(f"{M}/frames/s_{k:04d}.jpg", cv2.cvtColor(frame(k), cv2.COLOR_RGB2BGR),
                        [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        k0, k1, outp = int(ARGS[0]), min(int(ARGS[1]), NF), ARGS[2]
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                               "-pix_fmt", "yuv420p", outp], stdin=subprocess.PIPE)
        for k in range(k0, k1):
            ff.stdin.write(frame(k).tobytes())
        ff.stdin.close()
        ff.wait()
        print("done", k0, k1)
