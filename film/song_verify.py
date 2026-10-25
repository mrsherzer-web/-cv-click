"""Read the QR back out of a song's spectrogram. usage: song_verify.py MOVIEDIR AUDIOFILE"""
import json, subprocess, sys
import cv2, numpy as np, scipy.signal as sg
M, path = sys.argv[1], sys.argv[2]
tl = json.load(open(f"{M}/work/song_timeline.json"))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "48000", "-f", "s16le", "-"],
                     capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
f, t, Z = sg.stft(x, 48000, nperseg=1024, noverlap=768)
db = 20 * np.log10(np.abs(Z) + 1e-9)
t0, t1, (f0, f1) = tl["qr"]
img = db[(f >= f0) & (f < f1)][::-1][:, (t >= t0 - 0.3) & (t <= t1 + 0.3)]
img = cv2.GaussianBlur(img, (0, 0), 1.0)
img = np.clip((img - (np.percentile(img, 99) - 45)) / 45, 0, 1)
img = cv2.resize((img * 255).astype(np.uint8), (1000, 1000), interpolation=cv2.INTER_AREA)
img = cv2.copyMakeBorder(img, 80, 80, 80, 80, cv2.BORDER_CONSTANT, value=0)
cv2.imwrite(f"{M}/frames/spec_qr.png", img)
print(path, "-> QR in spectrogram decodes to:", repr(cv2.QRCodeDetector().detectAndDecode(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))[0]))
