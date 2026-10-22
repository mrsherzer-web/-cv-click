import numpy as np, cv2, subprocess, sys, os
U = '/root/.claude/uploads/a46df76c-a2d4-5dfa-aac8-5fdc99a883d9'
TM = "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
clips = [(11, '4be6bc1a-IMG_9022.mov'), (12, '80df809e-IMG_9023.mov'), (13, '24a0b8ee-IMG_9024.mov'), (14, '76965b62-IMG_9026.mov'), (15, '3dc7a5d6-IMG_9025.mov'), (16, 'a4a6a9ed-IMG_9025.mov')]
W, H = 384, 216; STEP = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
for c, f in clips:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(U, f), '-vf', f'fps={1/STEP},{TM},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    tiles = []
    for i, im in enumerate(fr):
        im = im.copy(); cv2.rectangle(im, (0, 0), (120, 20), (0, 0, 0), -1)
        cv2.putText(im, f'c{c} {i * STEP:5.1f}s', (4, 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA); tiles.append(im)
    cols = 5
    while len(tiles) % cols: tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[r * cols:(r + 1) * cols]) for r in range(len(tiles) // cols)]
    sheet = np.vstack(rows)
    cv2.imwrite(f'sheets/c{c}.jpg', sheet, [cv2.IMWRITE_JPEG_QUALITY, 82]); print(c, len(fr), sheet.shape)
