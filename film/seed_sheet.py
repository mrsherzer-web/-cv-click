import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
misses = json.load(open(os.path.join(D, sys.argv[1]))); out = sys.argv[2]
MAN = json.load(open(os.path.join(D, 'plate_manual.json')))
PB = json.load(open(os.path.join(D, 'plate_boxes.json')))
COLS = 'ABCDEFGHIJKLMNOP'
def frame(clip, idx):
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, (idx - 0.4) / 30):.4f}', '-i', os.path.join(D, path), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(1080, 1920, 3).copy()
tiles = []
for k, m in enumerate(misses):
    clip = int(m['clip'][1:]); idx = round(m['t'] * 30)
    f = frame(clip, idx)
    cs = [(COLS.index(c[0]), int(c[1:]) - 1) for c in m['cells']]
    x0 = max(0, min(c for c, r in cs) * 120 - 120); x1 = min(1920, (max(c for c, r in cs) + 1) * 120 + 120)
    y0 = max(0, min(r for c, r in cs) * 120 - 90); y1 = min(1080, (max(r for c, r in cs) + 1) * 120 + 90)
    g = f.copy()
    for b in PB.get(str(clip), {}).get(str(idx), []):
        cv2.rectangle(g, (int(b[0]), int(b[1])), (int(b[0] + b[2]), int(b[1] + b[3])), (0, 255, 0), 1)
    for b in MAN.get(str(clip), {}).get(str(idx), []):
        cv2.rectangle(g, (int(b[0]), int(b[1])), (int(b[0] + b[2]), int(b[1] + b[3])), (255, 0, 255), 1)
    crop = g[y0:y1, x0:x1]
    sc = min(480 / crop.shape[1], 300 / crop.shape[0])
    crop = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_NEAREST)
    tile = np.zeros((330, 480, 3), np.uint8); tile[30:30 + crop.shape[0], :crop.shape[1]] = crop
    cv2.putText(tile, f'#{k} {m["clip"]} t={m["t"]} {",".join(m["cells"])}', (4, 22), 0, 0.6, (255, 255, 0), 2)
    tiles.append(tile)
os.makedirs(out, exist_ok=True)
for k in range(0, len(tiles), 12):
    grp = tiles[k:k + 12]
    while len(grp) < 12: grp.append(np.zeros_like(tiles[0]))
    img = np.vstack([np.hstack(grp[r * 4:(r + 1) * 4]) for r in range(3)])
    cv2.imwrite(os.path.join(out, f's_{k // 12:02d}.jpg'), img[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
print(len(tiles))
