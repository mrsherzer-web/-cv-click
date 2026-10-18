import mediapipe as mp, numpy as np, cv2, subprocess, sys, json, os
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
M = '/tmp/claude-0/models/pose_landmarker_heavy.task'
def mk(mode, n):
    return vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=M), running_mode=mode, num_poses=n,
        min_pose_detection_confidence=0.25, min_pose_presence_confidence=0.25, min_tracking_confidence=0.3))
vid = mk(vision.RunningMode.VIDEO, 3)
img = mk(vision.RunningMode.IMAGE, 2)
path, out, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
DARK = float(os.environ.get('DARK', 80))
W, H = 1920, 1080

def poses_from(r, f8, ox=0, oy=0, sx=1.0, sy=1.0, cw=W, ch=H):
    out = []
    for lm in r.pose_landmarks:
        pts = [(ox + l.x * cw * sx, oy + l.y * ch * sy, l.visibility) for l in lm]
        quad = np.array([pts[11][:2], pts[12][:2], pts[24][:2], pts[23][:2]], np.int32)
        m = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(m, quad, 1)
        g = f8[m > 0].mean(axis=1) if m.sum() > 30 else None
        med = float(np.median(g)) if g is not None else 999
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        out.append(dict(pts=[[round(a, 1), round(b, 1), round(c, 2)] for a, b, c in pts], med=round(med, 1),
                        box=[min(xs), min(ys), max(xs), max(ys)]))
    return out

p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', f'{t0}', '-i', path, '-t', f'{t1 - t0}', '-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-'],
                     stdout=subprocess.PIPE, bufsize=1 << 26)
res = {}; n = round(t0 * 30); last = None; lastn = -99
while True:
    b = p.stdout.read(W * H * 6)
    if len(b) < W * H * 6: break
    f8 = np.ascontiguousarray((np.frombuffer(b, np.uint16).reshape(H, W, 3) >> 8).astype(np.uint8))
    r = vid.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=f8), int(n * 1000 / 30))
    ps = poses_from(r, f8)
    dub = [q for q in ps if q['med'] < DARK]
    src = 'full'
    if not dub and last is not None and n - lastn < 20:
        bx = last['box']; cx = (bx[0] + bx[2]) / 2; cy = (bx[1] + bx[3]) / 2
        hh = max(bx[3] - bx[1], 150) * 1.6; ww = hh * 1.2
        x0 = int(max(0, cx - ww / 2)); y0 = int(max(0, cy - hh / 2)); x1 = int(min(W, cx + ww / 2)); y1 = int(min(H, cy + hh / 2))
        if x1 - x0 > 60 and y1 - y0 > 60:
            crop = np.ascontiguousarray(f8[y0:y1, x0:x1])
            r2 = img.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=crop))
            ps2 = poses_from(r2, f8, x0, y0, 1, 1, x1 - x0, y1 - y0)
            dub = [q for q in ps2 if q['med'] < DARK]; src = 'crop'
    if dub:
        best = max(dub, key=lambda q: (q['box'][3] - q['box'][1]))
        best['src'] = src; last = best; lastn = n
        res[n] = best
    else:
        res[n] = None
    res.setdefault('all', {})[n] = [(q['med'], round(q['pts'][0][0]), round(q['pts'][0][1])) for q in ps]
    n += 1
json.dump(res, open(out, 'w'))
fr = [k for k in res if k != 'all']
print('frames', len(fr), 'dubi', sum(1 for k in fr if res[k]), 'crop', sum(1 for k in fr if res[k] and res[k]['src'] == 'crop'))
os._exit(0)
