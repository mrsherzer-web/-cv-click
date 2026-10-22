import sys, os, json, numpy as np, cv2, subprocess
D = '/tmp/claude-0/-home-user--cv-click/a46df76c-a2d4-5dfa-aac8-5fdc99a883d9/scratchpad'
sys.path.insert(0, D); import plates
# usage: zoom.py clip x0 y0 x1 y1 t0 t1 step out [noblur]
c = int(sys.argv[1]); x0, y0, x1, y1 = map(int, sys.argv[2:6]); t0, t1, st = map(float, sys.argv[6:9]); out = sys.argv[9]
blur = len(sys.argv) < 11
BOX = json.load(open(os.path.join(D, 'plate_boxes.json'))); MAN = json.load(open(os.path.join(D, 'plate_manual.json')))
want = set(); t = t0
while t <= t1 + 1e-6: want.add(round(t * 30)); t += st
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, f'cc/inter/c{c}.mov'), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
tiles = []; i = 0
sc = min(3.0, 640 / (x1 - x0))
while i <= max(want):
    b = p.stdout.read(1920 * 1080 * 3)
    if len(b) < 1920 * 1080 * 3: break
    if i in want:
        f = np.frombuffer(b, np.uint8).reshape(1080, 1920, 3)
        bx = BOX.get(str(c), {}).get(str(i), []) + MAN.get(str(c), {}).get(str(i), [])
        if blur: f = plates.blur_boxes(f, [tuple(x[:4]) for x in bx])
        cr = cv2.resize(np.ascontiguousarray(f[y0:y1, x0:x1]), (int((x1 - x0) * sc), int((y1 - y0) * sc)), interpolation=cv2.INTER_CUBIC)
        cv2.rectangle(cr, (0, 0), (150, 22), (0, 0, 0), -1); cv2.putText(cr, f'{i} {i/30:.2f}s', (4, 16), 0, 0.5, (255, 255, 255), 1)
        tiles.append(cr)
    i += 1
p.kill()
cols = 4
while len(tiles) % cols: tiles.append(np.zeros_like(tiles[0]))
cv2.imwrite(out, np.vstack([np.hstack(tiles[r * cols:(r + 1) * cols]) for r in range(len(tiles) // cols)])[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
print(len(tiles))
