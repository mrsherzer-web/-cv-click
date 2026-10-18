"""Agent-read plate boxes -> CSRT-tracked manual blur boxes (plate_manual.json)."""
import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from fix_misses import load, track
loc = json.load(open(os.path.join(D, sys.argv[1])))          # [{k, plates:[{x0..}]}]
index = {it['k']: it for it in json.load(open(os.path.join(D, sys.argv[2])))}
SPAN = int(sys.argv[3]) if len(sys.argv) > 3 else 8
man_path = os.path.join(D, 'plate_manual.json')
MAN = json.load(open(man_path)) if os.path.exists(man_path) else {}
by_clip = {}
for r in loc:
    it = index[r['k']]
    for p in r['plates']:
        x0, y0, x1, y1 = p['x0'], p['y0'], p['x1'], p['y1']
        if x1 <= x0 or y1 <= y0: continue
        by_clip.setdefault(int(it['clip'][1:]), []).append((round(it['t'] * 30), [x0, y0, x1 - x0, y1 - y0]))
for clip, items in sorted(by_clip.items()):
    frames = load(clip)
    cm = MAN.setdefault(str(clip), {})
    for idx, b in items:
        idx = min(idx, len(frames) - 1)
        boxes = {idx: b}
        fw = track(frames, idx, b, idx + SPAN, 1); bw = track(frames, idx, b, idx - SPAN, -1)
        # trust the tracker only while the box keeps a sane size
        for d in (fw, bw):
            for f, bb in d.items():
                if bb[2] < 0.4 * b[2] or bb[2] > 2.5 * b[2] + 10: continue
                boxes[f] = bb
        for f, bb in boxes.items(): cm.setdefault(str(f), []).append([float(v) for v in bb])
        print(clip, idx / 30, [round(v) for v in b], 'frames', len(boxes))
    del frames
json.dump(MAN, open(man_path, 'w'))
