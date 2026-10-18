import mediapipe as mp, numpy as np
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
_det = None
def detector():
    global _det
    if _det is None:
        _det = vision.ObjectDetector.create_from_options(vision.ObjectDetectorOptions(
            base_options=mpt.BaseOptions(model_asset_path='/tmp/claude-0/models/efficientdet_lite2.tflite'),
            running_mode=vision.RunningMode.IMAGE, score_threshold=0.18, max_results=25,
            category_allowlist=['car', 'truck', 'bus', 'motorcycle']))
    return _det
def cars(rgb8):
    r = detector().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb8)))
    out = []
    for d in r.detections:
        b = d.bounding_box
        out.append([b.origin_x, b.origin_y, b.width, b.height, round(d.categories[0].score, 2)])
    # tiles: also run on two overlapping halves to catch small/partial cars
    H, W = rgb8.shape[:2]
    for x0 in (0, W // 2 - W // 8):
        sub = np.ascontiguousarray(rgb8[:, x0:x0 + W // 2 + W // 8])
        r = detector().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=sub))
        for d in r.detections:
            b = d.bounding_box
            out.append([b.origin_x + x0, b.origin_y, b.width, b.height, round(d.categories[0].score, 2)])
    return out
