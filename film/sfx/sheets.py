import numpy as np, cv2, subprocess, sys, os
D = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(D, '..', 'out', 'rafael_hasrat_hagadol_v4.mp4')
FPS = 6
shots = [('c5', 79.4, 86.7, 0.3), ('c6', 86.7, 95.1, 0.2), ('c7', 95.1, 98.0, 0.0)]
W, H = 480, 270
for name, t0, t1, a in shots:
    n = int(round((t1 - t0) * 30))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-i', V, '-frames:v', str(n), '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    idx = list(range(0, len(fr), 30 // FPS))
    tiles = []
    for i in idx:
        im = fr[i].copy()
        ft = t0 + i / 30; st = a + i / 30
        cv2.rectangle(im, (0, 0), (300, 26), (0, 0, 0), -1)
        cv2.putText(im, f'{name} src {st:5.2f}  film {ft:6.2f}', (5, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        tiles.append(im)
    per = 16
    for k in range(0, len(tiles), per):
        page = tiles[k:k + per]
        while len(page) < per: page.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(page[r * 4:(r + 1) * 4]) for r in range(4)]
        cv2.imwrite(os.path.join(D, 'sheets', f'{name}_{k // per}.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(name, len(fr), 'frames', len(tiles), 'tiles')
