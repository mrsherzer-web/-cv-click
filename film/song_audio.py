"""A song that is a phone number.

  * intro: the real DTMF dial tones of the number
  * hook: each digit is a note of A natural minor
  * hidden layer: the high band of the spectrogram draws the number, then a scannable tel: QR code
    (energy where the QR is light, silence where it is dark, so a spectrogram shows it the right way)

usage: song_audio.py MOVIEDIR "<digits-with-dashes>" "<tel: uri>"
"""
import json
import sys
import wave

import numpy as np
import scipy.signal as sg

M, SHOWN, URI = sys.argv[1:4]
src = open(f"{M}/src/audio_film.py").read().split("# ---------------------------------------------------------------- arrangement")[0]
ns = {"__name__": "lib"}
sys.argv = [sys.argv[0], M]
exec(compile(src, "audio_film_instruments", "exec"), ns)
sys.path.insert(0, M + "/src")
from sculpture import FONT5x7, qr_matrix  # noqa: E402

SR = 48000
DIG = [c for c in SHOWN if c.isdigit()]
BPM = 120
B = 60 / BPM
T_MUSIC = 2.6
T_TEXT0 = 6.6
CELL = 0.125                      # seconds per image column
T_QR0 = 10.1
F_TEXT = (5000.0, 10600.0)
F_QR = (4500.0, 12500.0)
END = 21.5
N = int(END * SR)
ns["N"] = N
put, track, filt, hz = ns["put"], ns["track"], ns["filt"], ns["hz"]
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- 1. DTMF dialing
DTMF = {"1": (697, 1209), "2": (697, 1336), "3": (697, 1477), "4": (770, 1209), "5": (770, 1336), "6": (770, 1477),
        "7": (852, 1209), "8": (852, 1336), "9": (852, 1477), "0": (941, 1336)}
dial = track()
dial_times = []
for k, d in enumerate(DIG):
    t0 = 0.45 + k * 0.18
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    lo, hi = DTMF[d]
    x = (np.sin(2 * np.pi * lo * t) + np.sin(2 * np.pi * hi * t)) * 0.22
    ramp = int(0.004 * SR)
    x[:ramp] *= np.linspace(0, 1, ramp)
    x[-ramp:] *= np.linspace(1, 0, ramp)
    put(dial, x.astype(np.float32), t0)
    dial_times.append(t0)
ring_t = dial_times[-1] + 0.3
n = int(0.42 * SR)
t = np.arange(n) / SR
put(dial, (np.sin(2 * np.pi * 425 * t) * 0.16 * np.minimum(1, np.minimum(t / 0.01, (n / SR - t) / 0.02))).astype(np.float32),
    ring_t)

# ---------------------------------------------------------------- 2. the number as a song
SCALE = {"0": "A4", "1": "B4", "2": "C5", "3": "D5", "4": "E5", "5": "F5", "6": "G5", "7": "A5", "8": "B5", "9": "C6"}
groups = SHOWN.split("-")
RHY = []  # beat lengths: short-short-long per group, last note of the phrase held
for gi, g in enumerate(groups):
    for k in range(len(g)):
        RHY.append(1.0 if k == len(g) - 1 else 0.5)
RHY[-1] = 1.5
assert len(RHY) == len(DIG)

WT = ns["WT"]


def lead(f, dur, vel=0.7):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    ph = (np.cumsum(np.full(n, f / SR))) % 1.0
    ph2 = (np.cumsum(np.full(n, f * 1.004 / SR))) % 1.0
    x = WT[(ph * 4096).astype(np.int64)] + 0.6 * WT[(ph2 * 4096).astype(np.int64)]
    x += 0.5 * np.sin(2 * np.pi * f / 2 * t)
    env = np.minimum(1, t / 0.006) * np.exp(-t / (0.25 + 0.3 * dur)) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.06))
    y = filt(x * env, "low", 3200)
    return (y * 0.16 * vel).astype(np.float32)


music, drums = track(), track()
melody_events = []
CH = [["A2", "E3", "A3", "C4"], ["F2", "C3", "F3", "A3"], ["C3", "G3", "C4", "E4"], ["G2", "D3", "G3", "B3"]]
ROOT = ["A1", "F1", "C2", "G1"]
bar = 4 * B
nbars = int((END - 0.8 - T_MUSIC) / bar)
for b in range(nbars):
    t0 = T_MUSIC + b * bar
    put(music, ns["pad"]([n_[:-1] + str(int(n_[-1]) + 1) for n_ in CH[b % 4][1:]], bar, cutoff=1500, att=0.15, g=0.9), t0)
    for e in range(8):
        put(music, ns["bass"](hz(ROOT[b % 4]) * 2, 0.45 * B, 0.8), t0 + e * B / 2)
    for q in range(4):
        put(drums, ns["kick"](0.9), t0 + q * B)
        if q % 2 == 1:
            put(drums, ns["snare"](0.7), t0 + q * B)
        for h in range(2):
            put(drums, ns["hat"](0.55 if h else 0.3), t0 + q * B + h * B / 2)
    if b % 2 == 0:  # the hook every two bars
        tt = t0
        for d, r in zip(DIG, RHY):
            put(music, lead(hz(SCALE[d]), r * B * 0.92, 0.75), tt)
            put(music, lead(hz(SCALE[d]) * 0.5, r * B * 0.92, 0.35), tt + 0.002)
            melody_events.append((round(tt, 4), d))
            tt += r * B

# ---------------------------------------------------------------- 3. pictures in the spectrogram
NPER, HOP = 1024, 256


def paint(img, t0, f0, f1, cell=CELL, level=1.0):
    """img rows top->bottom = high->low frequency, columns = time cells; 1 = energy."""
    R, C = img.shape
    nfr = int(C * cell * SR / HOP) + 2
    freqs = np.arange(NPER // 2 + 1) * SR / NPER
    times = np.arange(nfr) * HOP / SR
    col = np.clip((times / cell).astype(int), 0, C - 1)
    inside_t = times < C * cell
    rows = np.full(len(freqs), -1)
    band = (freqs >= f0) & (freqs < f1)
    rows[band] = np.clip(((f1 - freqs[band]) / (f1 - f0) * R).astype(int), 0, R - 1)
    mag = np.zeros((len(freqs), nfr), np.float32)
    ok = rows >= 0
    mag[ok] = img[rows[ok]][:, col] * inside_t[None, :]
    # steady, bin-centred tones (coherent phase) instead of noise: a speckle-free picture
    phi0 = rng.uniform(0, 2 * np.pi, len(freqs))[:, None]
    Z = mag * np.exp(1j * (phi0 + 2 * np.pi * freqs[:, None] * (np.arange(nfr)[None, :] * HOP / SR)))
    _, x = sg.istft(Z, SR, nperseg=NPER, noverlap=NPER - HOP)
    x = x[: int(C * cell * SR) + NPER]
    return (x / (np.abs(x).max() + 1e-9) * level).astype(np.float32)


def text_image(groups):
    w = max(len(g) * 6 - 1 for g in groups)
    img = np.zeros((len(groups) * 8 - 1, w), np.float32)
    for gi, g in enumerate(groups):
        c0 = (w - (len(g) * 6 - 1)) // 2
        for k, ch in enumerate(g):
            for rr, line in enumerate(FONT5x7[ch]):
                for cc, bit in enumerate(line):
                    if bit == "1":
                        img[gi * 8 + rr, c0 + k * 6 + cc] = 1
    return img


import cv2  # noqa: E402

SUB = 8  # sub-cells per cell, so the window's smear can be pre-compensated


def pre_comp(img, kt, kf):
    """Upsample and shrink the lit areas by the STFT smear (kt sub-cells in time, kf in frequency)."""
    up = np.kron(img, np.ones((SUB, SUB), np.float32))
    return cv2.erode(up, np.ones((2 * kf + 1, 2 * kt + 1), np.uint8))


TXT = text_image(groups)
QR = np.pad(qr_matrix(URI), 4)          # quiet zone of 4 modules
QR_LIGHT = (1 - QR).astype(np.float32)  # energy where the code is light
hidden = track()
xt = paint(pre_comp(TXT, 1, 1), T_TEXT0, *F_TEXT, cell=CELL / SUB, level=0.32)
put(hidden, xt, T_TEXT0)
xq = paint(pre_comp(QR_LIGHT, 1, 3), T_QR0, *F_QR, cell=CELL / SUB, level=0.30)
put(hidden, xq, T_QR0)
T_TEXT1 = T_TEXT0 + TXT.shape[1] * CELL
T_QR1 = T_QR0 + QR.shape[1] * CELL

# ---------------------------------------------------------------- mix: keep the picture band clean while it is drawn
tt = np.arange(N) / SR
quiet = np.clip(np.minimum((tt - (T_TEXT0 - 0.25)) / 0.25, ((T_QR1 + 0.05) - tt) / 0.1), 0, 1)
full = music * 0.8 + drums * 0.75
low = sg.sosfiltfilt(sg.butter(10, 2400, "low", fs=SR, output="sos"), full, axis=0).astype(np.float32)
bed = full * (1 - quiet[:, None]) + low * quiet[:, None]
sfx = track()
put(sfx, ns["impact"](0.9, 0.9), T_QR1 + 0.05)
put(sfx, ns["crash"](0.5, 2.5), T_QR1 + 0.05)
put(sfx, ns["glitch"](0.25, 0.6) if "glitch" in ns else ns["whoosh"](0.3, 0.5), ring_t + 0.42)
put(sfx, ns["impact"](0.6, 0.7), T_MUSIC)
T_SCAN = T_QR1 + 0.1 + 1.1   # song_video: the sweep reads the code
for k, f in enumerate((1320, 1760)):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    put(sfx, (np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.003) * np.exp(-t / 0.03) * 0.5).astype(np.float32),
        T_SCAN + k * 0.09)
T_CALL = 16.5                # song_video: the call card, with a ringback tone
n = int(0.6 * SR)
t = np.arange(n) / SR
put(sfx, (np.sin(2 * np.pi * 425 * t) * 0.3 * np.minimum(1, np.minimum(t / 0.01, (n / SR - t) / 0.03))).astype(np.float32),
    T_CALL + 0.15)
for t0, nm in ((17.6, "A4"), (17.6, "E5"), (17.6, "C5")):
    put(sfx, ns["piano"](hz(nm), 2.5, 0.5), t0)
mix = bed + dial + hidden + sfx * 0.6
end_fade = int(1.0 * SR)
mix[-end_fade:] *= np.linspace(1, 0, end_fade)[:, None] ** 1.5
mix = mix / (np.abs(mix).max() + 1e-9) * 0.92   # linear: no limiter, so the hidden band stays clean
with wave.open(f"{M}/work/song_mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
json.dump({"end": END, "dial": dial_times, "digits": DIG, "ring": ring_t, "music": T_MUSIC, "melody": melody_events,
           "text": [T_TEXT0, T_TEXT1, F_TEXT], "qr": [T_QR0, T_QR1, F_QR], "cell": CELL},
          open(f"{M}/work/song_timeline.json", "w"), indent=1)
print("text", T_TEXT0, T_TEXT1, "qr", T_QR0, T_QR1,
      [round(float(20 * np.log10(np.sqrt((mix[i * SR:(i + 1) * SR] ** 2).mean()) + 1e-9)), 1) for i in range(int(END))])
