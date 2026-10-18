"""Turn agent-reported plate misses into tracked manual blur boxes."""
import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
misses = json.load(open(os.path.join(D, sys.argv[1])))
man_path = os.path.join(D, 'plate_manual.json')
MAN = json.load(open(man_path)) if os.path.exists(man_path) else {}
COLS = 'ABCDEFGHIJKLMNOP'
CELL = 120   # full-res pixels per grid cell
SPAN = 7     # track +- frames around each reported time

def load(clip):
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, path), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE, bufsize=1 << 26)
    fr = []
    while True:
        b = p.stdout.read(1920 * 1080 * 3)
        if len(b) < 1920 * 1080 * 3: break
        fr.append(np.frombuffer(b, np.uint8).reshape(1080, 1920, 3))
    return fr

def seed(img_bgr, region):
    x0, y0, x1, y1 = region
    sub = np.ascontiguousarray(img_bgr[y0:y1, x0:x1])
    hsv = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    yel = ((h >= 12) & (h <= 28) & (s >= int(os.environ.get('SMIN', 70))) & (v >= 70)).astype(np.uint8)
    m = cv2.morphologyEx(yel, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    cx0, cy0 = (x1 - x0) / 2, (y1 - y0) / 2
    best, bs = None, 0
    for i in range(1, n):
        x, y, w, hh, a = st[i]
        if a < 6 or w < 4: continue
        ar = w / max(1, hh)
        if not (1.5 <= ar <= 8) or w > int(os.environ.get('WMAX', 140)) or hh > int(os.environ.get('HMAX', 36)): continue
        comp = (lab[y:y + hh, x:x + w] == i)
        if comp.sum() / max(1, w * hh) < 0.45: continue
        sm = s[y:y + hh, x:x + w][comp].mean()
        d = np.hypot(x + w / 2 - cx0, y + hh / 2 - cy0)
        score = sm / 255 * np.sqrt(a) / (1 + d / 160) * (1.4 if 2.2 <= ar <= 6 else 1.0)
        if score > bs: best, bs = [x + x0, y + y0, w, hh], score
    return best

def track(frames, f0, box, f1, step):
    out = {}
    x, y, w, h = box
    tr = cv2.TrackerCSRT_create()
    pad = 3
    try: tr.init(frames[f0], (int(x - pad), int(y - pad), int(max(8, w + 2 * pad)), int(max(6, h + 2 * pad))))
    except Exception: return out
    f = f0
    while f != f1:
        f += step
        if f < 0 or f >= len(frames): break
        ok, r = tr.update(frames[f])
        if not ok: break
        out[f] = [r[0] + pad, r[1] + pad, max(4, r[2] - 2 * pad), max(3, r[3] - 2 * pad)]
    return out

unresolved = []
by_clip = {}
for m in misses: by_clip.setdefault(int(m['clip'][1:]), []).append(m)
for clip, ms in sorted(by_clip.items()):
    frames = load(clip)
    cm = MAN.setdefault(str(clip), {})
    for m in ms:
        idx = min(len(frames) - 1, round(m['t'] * 30))
        cs = [(COLS.index(c[0]), int(c[1:]) - 1) for c in m['cells'] if c[0] in COLS]
        if not cs: continue
        MG = int(os.environ.get('MARGIN', 20))
        x0 = min(c for c, r in cs) * CELL - MG; x1 = (max(c for c, r in cs) + 1) * CELL + MG
        y0 = min(r for c, r in cs) * CELL - MG; y1 = (max(r for c, r in cs) + 1) * CELL + MG
        region = (max(0, x0), max(0, y0), min(1920, x1), min(1080, y1))
        b = seed(frames[idx], region)
        if b is None:
            print('UNRESOLVED', clip, m['t'], m['cells']); unresolved.append(m); continue
        boxes = {idx: b}
        boxes.update(track(frames, idx, b, idx + SPAN, 1))
        boxes.update(track(frames, idx, b, idx - SPAN, -1))
        for f, bb in boxes.items():
            cm.setdefault(str(f), []).append([float(v) for v in bb])
        print(clip, m['t'], m['cells'], 'seed', [round(v) for v in b], 'frames', len(boxes))
    del frames
json.dump(MAN, open(man_path, 'w'))
json.dump(unresolved, open(os.path.join(D, 'unresolved.json'), 'w'))
