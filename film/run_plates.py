import sys, os, json, numpy as np, cv2, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fb'))
import plates, dubi, cars
D = os.path.dirname(os.path.abspath(__file__))
clip = sys.argv[1]
path = {'1': 'fb/inter/c1.mkv', '2': 'fb/inter/c2.mkv', '3': 'fb/inter/c3.mkv', '4': 'fb/inter/c4.mkv'}.get(clip, f'cc/inter/c{clip}.mov')
tr = dubi.load_track(int(clip)) if clip in ('1', '2', '3') else {}
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', os.path.join(D, path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=1 << 26)
dets = {}; n = 0; cb = []
while True:
    b = p.stdout.read(1920 * 1080 * 3)
    if len(b) < 1920 * 1080 * 3: break
    f = np.frombuffer(b, np.uint8).reshape(1080, 1920, 3)
    ex = None
    if n in tr:
        lm = tr[n][0][:, :2]
        pts = lm[[11, 12, 13, 14, 15, 16, 23, 24, 0, 7, 8]].astype(np.float32)
        g = dubi.geometry(tr[n][0]); pad = g['bw'] * 0.6
        hull = cv2.convexHull(pts)
        ex = np.zeros((1080, 1920), np.uint8); cv2.fillConvexPoly(ex, hull.astype(np.int32), 1)
        ex = cv2.dilate(ex, np.ones((int(pad) * 2 + 1, int(pad) * 2 + 1), np.uint8))
    cb = cars.cars(f) if n % 2 == 0 else cb
    d = plates.detect_all(f, cb, ex)
    if d: dets[n] = d
    n += 1
linked = plates.link(dets, max_gap=10, min_len=3)
json.dump(dict(raw={str(k): v for k, v in dets.items()}, boxes={str(k): v for k, v in linked.items()}, tracks=plates.link.tracks, n=n), open(os.path.join(D, f'plates_c{clip}.json'), 'w'))
print('clip', clip, 'tracks', len(plates.link.tracks), 'frames', n, 'raw-frames', len(dets), 'box-frames', len(linked), 'max boxes/frame', max([len(v) for v in linked.values()] or [0]))
