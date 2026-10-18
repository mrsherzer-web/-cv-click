import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
misses = json.load(open(os.path.join(D, sys.argv[1]))); out = os.path.join(D, sys.argv[2]); os.makedirs(out, exist_ok=True)
COLS = 'ABCDEFGHIJKLMNOP'
def frame(clip, idx):
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, (idx - 0.4) / 30):.4f}', '-i', os.path.join(D, path), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(1080, 1920, 3).copy()
index = []
for k, m in enumerate(misses):
    clip = int(m['clip'][1:]); idx = round(m['t'] * 30)
    f = frame(clip, idx)
    cs = [(COLS.index(c[0]), int(c[1:]) - 1) for c in m['cells']]
    x0 = max(0, min(c for c, r in cs) * 120 - 160); x1 = min(1920, (max(c for c, r in cs) + 1) * 120 + 160)
    y0 = max(0, min(r for c, r in cs) * 120 - 140); y1 = min(1080, (max(r for c, r in cs) + 1) * 120 + 140)
    crop = f[y0:y1, x0:x1]
    sc = min(1100 / crop.shape[1], 800 / crop.shape[0])
    big = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_CUBIC)
    M = 60
    canvas = np.full((big.shape[0] + M, big.shape[1] + M, 3), 20, np.uint8); canvas[M:, M:] = big
    for X in range((x0 // 20 + 1) * 20, x1, 20):
        px = M + int((X - x0) * sc)
        major = X % 100 == 0
        cv2.line(canvas, (px, M - (14 if major else 6)), (px, M), (255, 255, 255), 1)
        if X % 20 == 0: cv2.line(canvas, (px, M), (px, canvas.shape[0]), (0, 255, 255) if major else (0, 140, 140), 1)
        if major: cv2.putText(canvas, str(X), (px - 18, 22), 0, 0.5, (255, 255, 255), 1)
    for Y in range((y0 // 20 + 1) * 20, y1, 20):
        py = M + int((Y - y0) * sc)
        major = Y % 100 == 0
        cv2.line(canvas, (M - (14 if major else 6), py), (M, py), (255, 255, 255), 1)
        cv2.line(canvas, (M, py), (canvas.shape[1], py), (0, 255, 255) if major else (0, 140, 140), 1)
        if major: cv2.putText(canvas, str(Y), (2, py + 5), 0, 0.42, (255, 255, 255), 1)
    name = f'loc_{k:02d}.jpg'
    cv2.imwrite(os.path.join(out, name), canvas[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 92])
    index.append(dict(k=k, file=name, clip=m['clip'], t=m['t'], note=m['note']))
json.dump(index, open(os.path.join(out, 'index.json'), 'w'), ensure_ascii=False)
print(len(index))
