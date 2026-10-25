"""Render a frame range of song_video.py to a video-only part: song_parts.py MOVIEDIR SHOWN URI A B OUT."""
import runpy
import subprocess
import sys

M, SHOWN, URI, A, B, OUT = sys.argv[1:7]
sys.argv = ["song_video.py", M, SHOWN, URI, "preview"]
G = runpy.run_path(f"{M}/src/song_video.py", run_name="lib")["frame"].__globals__
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{G['W']}x{G['H']}",
                       "-r", str(G["FPS"]), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                       "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
for k in range(int(A), min(int(B), G["NF"])):
    ff.stdin.write(G["frame"](k).tobytes())
ff.stdin.close()
ff.wait()
print("done", A, B)
