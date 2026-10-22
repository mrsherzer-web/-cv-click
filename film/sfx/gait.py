import mediapipe as mp, numpy as np, subprocess, json, os, sys
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
M = '/tmp/claude-0/models/pose_landmarker_heavy.task'
det = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=M), running_mode=vision.RunningMode.VIDEO, num_poses=1,
    min_pose_detection_confidence=0.3, min_pose_presence_confidence=0.3, min_tracking_confidence=0.3))
path, t0, t1, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
W, H = 960, 540
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', f'{t0}', '-i', path, '-t', f'{t1 - t0}', '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
res = []; n = 0
while True:
    b = p.stdout.read(W * H * 3)
    if len(b) < W * H * 3: break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3).copy()
    r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=f), int(n * 1000 / 30))
    t = t0 + n / 30
    if r.pose_landmarks:
        lm = r.pose_landmarks[0]
        res.append(dict(t=round(t, 4), pts=[[round(l.x * 1920, 1), round(l.y * 1080, 1), round(l.visibility, 2)] for l in lm]))
    else:
        res.append(dict(t=round(t, 4), pts=None))
    n += 1
json.dump(res, open(out, 'w'))
print('frames', n, 'with pose', sum(1 for r in res if r['pts']))
os._exit(0)
