"""Per-frame person masks (MediaPipe selfie multiclass) for the drive clip."""
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

M = sys.argv[1]
v = np.memmap(f"{M}/work/c9eac.rgb", dtype=np.uint8, mode="r").reshape(-1, 1920, 1080, 3)
opts = vision.ImageSegmenterOptions(
    base_options=mpt.BaseOptions(model_asset_path=f"{M}/models/selfie_multiclass.tflite"),
    running_mode=vision.RunningMode.IMAGE, output_confidence_masks=True, output_category_mask=False)
seg = vision.ImageSegmenter.create_from_options(opts)
out = np.lib.format.open_memmap(f"{M}/work/c9eac_person.npy", mode="w+", dtype=np.uint8, shape=(len(v), 960, 540))
for i in range(len(v)):
    fr = np.ascontiguousarray(cv2.resize(np.asarray(v[i]), (540, 960), interpolation=cv2.INTER_AREA))
    res = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=fr))
    bg = res.confidence_masks[0].numpy_view()
    person = 1.0 - cv2.resize(bg, (540, 960))
    out[i] = (np.clip(person, 0, 1) * 255).astype(np.uint8)
    if i % 50 == 0:
        print(i, flush=True)
out.flush()
print("done", len(v))
