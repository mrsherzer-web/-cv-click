"""Run MediaPipe face landmarker over decoded raw frames; dump per-frame faces to JSON."""
import json
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

S = sys.argv[1]
name, w, h, upscale = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])

raw = np.fromfile(f"{S}/work/{name}.rgb", dtype=np.uint8).reshape(-1, h, w, 3)
opts = vision.FaceLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=f"{S}/models/face_landmarker.task"),
    running_mode=vision.RunningMode.IMAGE,
    num_faces=4,
    min_face_detection_confidence=0.2,
    min_face_presence_confidence=0.2,
    output_face_blendshapes=False,
)
lmk = vision.FaceLandmarker.create_from_options(opts)
clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

out = []
for i, fr in enumerate(raw):
    img = fr
    if upscale != 1:
        img = cv2.resize(img, None, fx=upscale, fy=upscale, interpolation=cv2.INTER_CUBIC)
    # brighten dark club footage for the detector only
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    lab[..., 0] = clahe.apply(lab[..., 0])
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    res = lmk.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)))
    faces = []
    for f in res.face_landmarks:
        pts = [[p.x * w, p.y * h, p.z * w] for p in f]
        faces.append(pts)
    out.append(faces)
    if i % 20 == 0:
        print(name, i, len(faces), flush=True)

json.dump(out, open(f"{S}/work/{name}_faces.json", "w"))
print("done", name, sum(1 for f in out if f), "/", len(out))
