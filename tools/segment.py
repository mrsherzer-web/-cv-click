#!/usr/bin/env python3
"""
How the masks and landmarks in assets/source/ were made (only needed if you
add new photos; the game itself never runs this).

  pip install "rembg[cpu]" mediapipe pillow numpy
  python3 tools/segment.py photo.jpg out_mask.png

* people:      rembg with the BiRefNet-portrait model
* gaming chair: rembg 'sam' (sam_vit_l_0b3195) with point prompts on the chair
* face points: MediaPipe FaceLandmarker (face_landmarker.task), run on a crop
               around the face; results are stored in assets/source/landmarks.json
"""
import sys

from PIL import Image
from rembg import new_session, remove


def main():
    src, out = sys.argv[1], sys.argv[2]
    session = new_session("birefnet-portrait")
    mask = remove(Image.open(src).convert("RGB"), session=session, only_mask=True)
    mask.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
