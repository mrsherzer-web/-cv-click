import sys, os, json, numpy as np, cv2, subprocess
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
import plates
OUT = os.path.join(D, sys.argv[1]); os.makedirs(OUT, exist_ok=True)
RANGES = {1: [(12.9, 22.46, 0.2)], 2: [(0, 4.8, 0.2)], 3: [(0, 4.68, 0.2)], 4: [(0, 6.26, 0.25)], 5: [(0.3, 7.6, 0.2)], 6: [(0.2, 8.6, 0.5)],
          7: [(0, 5.4, 0.2), (10.2, 12.7, 0.2)], 8: [(0, 2.0, 0.2), (6.1, 9.9, 0.2)], 9: [(0.2, 7.6, 0.2)], 10: [(4.2, 8.7, 0.2), (9.4, 11.9, 0.2)],
          11: [(9.0, 14.8, 0.2)], 12: [(1.8, 4.6, 0.2), (5.0, 11.2, 0.5)], 13: [(1.2, 17.3, 0.5)], 14: [(0, 9.2, 0.5)], 15: [(0, 9.75, 0.5)], 16: [(0, 18.05, 0.5)]}
BOX = json.load(open(os.path.join(D, 'plate_boxes.json')))
MAN = json.load(open(os.path.join(D, 'plate_manual.json'))) if os.path.exists(os.path.join(D, 'plate_manual.json')) else {}
COLS = 'ABCDEFGHIJKLMNOP'
def grid(t):
    for i in range(1, 16): cv2.line(t, (i * 60, 0), (i * 60, 540), (0, 255, 255), 1)
    for j in range(1, 9): cv2.line(t, (0, j * 60), (960, j * 60), (0, 255, 255), 1)
    for i in range(16):
        for j in range(9):
            cv2.putText(t, f'{COLS[i]}{j + 1}', (i * 60 + 2, j * 60 + 11), 0, 0.32, (0, 255, 255), 1)
tiles = []
ONLY = [int(x) for x in os.environ.get('CLIPS', '').split(',') if x]
for clip, rngs in RANGES.items():
    if ONLY and clip not in ONLY: continue
    path = {1: 'fb/inter/c1.mkv', 2: 'fb/inter/c2.mkv', 3: 'fb/inter/c3.mkv', 4: 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
    want = set()
    for a, b, st in rngs:
        t = a
        while t <= b + 1e-6: want.add(round(t * 30)); t += st
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=1 << 26)
    i = 0
    while True:
        b = p.stdout.read(1920 * 1080 * 3)
        if len(b) < 1920 * 1080 * 3: break
        if i in want:
            f = np.frombuffer(b, np.uint8).reshape(1080, 1920, 3)
            bx = BOX.get(str(clip), {}).get(str(i), []) + MAN.get(str(clip), {}).get(str(i), [])
            f = plates.blur_boxes(f, [tuple(x[:4]) for x in bx])
            t = cv2.resize(f, (960, 540), interpolation=cv2.INTER_AREA)
            grid(t)
            cv2.rectangle(t, (0, 0), (190, 30), (0, 0, 0), -1)
            cv2.putText(t, f'c{clip} t={i / 30:.2f}s', (6, 22), 0, 0.75, (255, 255, 255), 2)
            tiles.append(t)
        i += 1
    p.kill()
for k in range(0, len(tiles), 6):
    grp = tiles[k:k + 6]
    while len(grp) < 6: grp.append(np.zeros_like(tiles[0]))
    img = np.vstack([np.hstack(grp[0:2]), np.hstack(grp[2:4]), np.hstack(grp[4:6])])
    cv2.imwrite(os.path.join(OUT, f'v_{k // 6:03d}.jpg'), img[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
print('tiles', len(tiles), 'sheets', (len(tiles) + 5) // 6)
