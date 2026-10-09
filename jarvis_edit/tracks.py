"""Build smoothed, gap-filled face tracks (and a watch track for clip A)."""
import json
import sys

import cv2
import numpy as np

S = sys.argv[1]


def build(name, n, start, end, seed, max_jump, ymax=None):
    d = json.load(open(f"{S}/work/{name}_faces.json"))
    pts = np.full((n, 478, 3), np.nan, np.float32)
    prev = np.array(seed, np.float32)
    for i in range(start, end + 1):
        best, bd = None, 1e9
        for f in d[i]:
            p = np.array(f, np.float32)
            c = (p[:, :2].min(0) + p[:, :2].max(0)) / 2
            if ymax is not None and c[1] > ymax:
                continue
            dist = np.linalg.norm(c - prev)
            if dist < bd:
                best, bd = p, dist
        if best is not None and bd < max_jump:
            pts[i] = best
            prev = (best[:, :2].min(0) + best[:, :2].max(0)) / 2
    valid = ~np.isnan(pts[:, 0, 0])
    idx = np.where(valid)[0]
    # linear interpolation over gaps inside the tracked range
    for k in range(478):
        for c in range(3):
            pts[start:end + 1, k, c] = np.interp(np.arange(start, end + 1), idx, pts[idx, k, c])
    # temporal gaussian smoothing
    sm = pts.copy()
    ker = np.exp(-0.5 * (np.arange(-3, 4) / 1.3) ** 2)
    for i in range(start, end + 1):
        lo, hi = max(start, i - 3), min(end, i + 3)
        w = ker[lo - i + 3:hi - i + 4]
        sm[i] = (pts[lo:hi + 1] * w[:, None, None]).sum(0) / w.sum()
    print(name, "valid raw", valid[start:end + 1].sum(), "of", end - start + 1)
    return sm


b = build("b", 185, 81, 149, (215, 170), 90, ymax=300)
b_curly = build("b", 185, 0, 15, (190, 200), 120)
a = build("a", 141, 64, 139, (480, 720), 260)
np.save(f"{S}/work/b_track.npy", b)
np.save(f"{S}/work/b_curly.npy", b_curly)
np.save(f"{S}/work/a_track.npy", a)

# watch tracker on clip A (CSRT), forward from frame 30 and backward to 14
frames = np.memmap(f"{S}/work/a.rgb", dtype=np.uint8, mode="r").reshape(-1, 1920, 1080, 3)
box0 = (225, 1090, 140, 140)
watch = np.full((141, 4), np.nan, np.float32)


def run(order):
    tr = cv2.TrackerCSRT.create()
    tr.init(cv2.cvtColor(np.array(frames[order[0]]), cv2.COLOR_RGB2BGR), box0)
    watch[order[0]] = box0
    for i in order[1:]:
        ok, bx = tr.update(cv2.cvtColor(np.array(frames[i]), cv2.COLOR_RGB2BGR))
        if not ok:
            break
        watch[i] = bx


run(list(range(30, 141)))
run(list(range(30, 13, -1)))
np.save(f"{S}/work/a_watch.npy", watch)
for i in range(14, 141, 8):
    print(i, watch[i])
