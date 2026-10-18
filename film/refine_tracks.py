import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
keep = set(json.load(open(os.path.join(D, 'plate_keep.json'))))
final = json.load(open(os.path.join(D, 'plate_boxes.json')))
EXT = 14

def load(clip):
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, path), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE, bufsize=1 << 26)
    fr = []
    while True:
        b = p.stdout.read(1920 * 1080 * 3)
        if len(b) < 1920 * 1080 * 3: break
        fr.append(np.frombuffer(b, np.uint8).reshape(1080, 1920, 3))
    return fr

def run_tracker(frames, f0, box, f_end, step):
    """track from f0 (box) to f_end inclusive, step +1/-1. returns {f: box}"""
    x, y, w, h = box
    pad = 2
    tr = cv2.TrackerCSRT_create()
    bb = (int(x - pad), int(y - pad), int(w + 2 * pad), int(h + 2 * pad))
    if bb[2] < 6 or bb[3] < 4: return {}
    try: tr.init(frames[f0], bb)
    except Exception: return {}
    out = {}; f = f0
    while f != f_end:
        f += step
        if f < 0 or f >= len(frames): break
        ok, r = tr.update(frames[f])
        if not ok: break
        rx, ry, rw, rh = r
        if rx + rw < 0 or ry + rh < 0 or rx > 1920 or ry > 1080: break
        out[f] = [rx + pad, ry + pad, max(4, rw - 2 * pad), max(3, rh - 2 * pad)]
    return out

for clip in sorted({int(k.split('-')[0][1:]) for k in keep}):
    P = json.load(open(os.path.join(D, f'plates_c{clip}.json')))
    frames = load(clip)
    fb = {}
    for tid, t in enumerate(P['tracks']):
        if f'c{clip}-T{tid}' not in keep: continue
        rf, rb = t['raw_f'], t['raw_b']
        boxes = {f: b for f, b in zip(rf, rb)}
        for (fa, ba), (fz, bz) in zip(zip(rf, rb), list(zip(rf, rb))[1:]):
            if fz - fa <= 1: continue
            tr = run_tracker(frames, fa, ba, fz, 1)
            end = tr.get(fz)
            for f in range(fa + 1, fz):
                lin = [ba[k] + (bz[k] - ba[k]) * (f - fa) / (fz - fa) for k in range(4)]
                if f in tr and end is not None:
                    u = (f - fa) / (fz - fa)
                    corr = [tr[f][k] + (bz[k] - end[k]) * u for k in range(4)]
                    # trust tracker for position, interpolate size
                    boxes[f] = [corr[0], corr[1], (corr[2] + lin[2]) / 2, (corr[3] + lin[3]) / 2]
                else:
                    boxes[f] = lin
        for f, b in run_tracker(frames, rf[-1], rb[-1], rf[-1] + EXT, 1).items(): boxes.setdefault(f, b)
        for f, b in run_tracker(frames, rf[0], rb[0], rf[0] - EXT, -1).items(): boxes.setdefault(f, b)
        fs = sorted(boxes)
        arr = np.array([boxes[f] for f in fs], np.float32)
        sm = arr.copy()
        for i in range(len(fs)):
            a, b = max(0, i - 1), min(len(fs), i + 2)
            sm[i, 2:] = arr[a:b, 2:].mean(0)
        for f, b in zip(fs, sm.tolist()): fb.setdefault(f, []).append(b)
    final[str(clip)] = {str(k): v for k, v in fb.items()}
    print('clip', clip, 'frames with boxes', len(fb))
    del frames
json.dump(final, open(os.path.join(D, 'plate_boxes.json'), 'w'))
