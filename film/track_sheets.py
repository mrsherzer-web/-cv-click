import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(D, 'cc/tracksheets'); os.makedirs(out, exist_ok=True)
items = []
for clip in range(1, 11):
    P = json.load(open(os.path.join(D, f'plates_c{clip}.json')))
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    want = {}
    for tid, t in enumerate(P['tracks']):
        k = len(t['frames']) // 2
        want.setdefault(t['frames'][k], []).append((tid, t['boxes'][k], len(t['frames'])))
    if not want: continue
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=1 << 26)
    i = 0
    while True:
        b = p.stdout.read(1920 * 1080 * 3)
        if len(b) < 1920 * 1080 * 3: break
        if i in want:
            f = np.frombuffer(b, np.uint8).reshape(1080, 1920, 3)
            for tid, (x, y, w, h), L in want[i]:
                cw, ch = max(220, w * 4), max(130, h * 6)
                cx, cy = x + w / 2, y + h / 2
                x0, y0 = int(max(0, cx - cw / 2)), int(max(0, cy - ch / 2)); x1, y1 = int(min(1920, cx + cw / 2)), int(min(1080, cy + ch / 2))
                crop = f[y0:y1, x0:x1].copy()
                sc = 300 / max(1, crop.shape[1]); crop = cv2.resize(crop, (300, max(40, int(crop.shape[0] * sc))))
                crop = cv2.resize(crop, (300, 180))
                bx0 = int((x - x0) * 300 / max(1, x1 - x0)); by0 = int((y - y0) * 180 / max(1, y1 - y0))
                bx1 = int((x + w - x0) * 300 / max(1, x1 - x0)); by1 = int((y + h - y0) * 180 / max(1, y1 - y0))
                cv2.rectangle(crop, (bx0 - 2, by0 - 2), (bx1 + 2, by1 + 2), (255, 0, 255), 1)
                tile = np.zeros((210, 300, 3), np.uint8); tile[30:] = crop
                cv2.putText(tile, f'c{clip}-T{tid}  ({L}f, {w:.0f}px)', (4, 21), 0, 0.6, (255, 255, 0), 2)
                items.append(((clip, tid), tile))
        i += 1
    p.kill()
items.sort(key=lambda a: a[0])
for k in range(0, len(items), 20):
    grp = [t for _, t in items[k:k + 20]]
    while len(grp) < 20: grp.append(np.zeros((210, 300, 3), np.uint8))
    img = np.vstack([np.hstack(grp[r * 5:(r + 1) * 5]) for r in range(4)])
    cv2.imwrite(os.path.join(out, f'tracks_{k // 20:02d}.jpg'), img[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
json.dump([f'c{c}-T{t}' for (c, t), _ in items], open(os.path.join(out, 'index.json'), 'w'))
print('tracks', len(items), 'sheets', (len(items) + 19) // 20)
