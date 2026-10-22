import numpy as np, cv2, subprocess, sys
c, t0, t1, step = int(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
out = sys.argv[5]; cols = int(sys.argv[6]) if len(sys.argv) > 6 else 5
W, H = 384, 216
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t0}', '-i', f'../cc/inter/c{c}.mov', '-t', f'{t1 - t0}', '-vf', f'fps={1/step},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
tiles = []
for i, im in enumerate(fr):
    im = im.copy(); cv2.rectangle(im, (0, 0), (130, 20), (0, 0, 0), -1)
    cv2.putText(im, f'c{c} {t0 + i * step:6.2f}', (4, 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA); tiles.append(im)
while len(tiles) % cols: tiles.append(np.zeros_like(tiles[0]))
cv2.imwrite(out, np.vstack([np.hstack(tiles[r * cols:(r + 1) * cols]) for r in range(len(tiles) // cols)]), [cv2.IMWRITE_JPEG_QUALITY, 80])
print(len(fr))
