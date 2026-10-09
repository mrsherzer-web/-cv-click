"""Soundtrack: synthesized beat + SFX + JARVIS voice + original clip audio."""
import json
import sys
import wave

import numpy as np
import scipy.signal as sg

S = sys.argv[1]
SR = 48000
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- timeline
VOICE = [  # (file, start, caption)
    ("v1", 0.30, "Good evening, sir. All systems online."),
    ("v2", 4.10, "Subject detected."),
    ("v3", 6.75, "Scanning the crowd."),
    ("v4", 9.05, "Target acquired."),
    ("v5", 10.35, "Running full facial analysis."),
    ("v6", 13.10, "Beard density. Off the charts."),
    ("v7", 15.80, "Classification: absolute legend. Enjoy the party, sir."),
]


def read_wav(path):
    w = wave.open(path)
    sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
    x = np.frombuffer(w.readframes(n), np.int16).astype(np.float32) / 32768
    return x.reshape(-1, ch), sr


def trim(x, thr=0.02):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - 200): idx[-1] + 2400]


voices = []
for name, start, cap in VOICE:
    x, sr = read_wav(f"{S}/voice/{name}.wav")
    x = trim(x[:, 0])
    x = sg.resample_poly(x, SR, sr).astype(np.float32)
    voices.append((x, start, cap))

TOTAL = round(voices[-1][1] + len(voices[-1][0]) / SR + 0.75, 2)
N = int(TOTAL * SR)
t_all = np.arange(N) / SR


def track():
    return np.zeros((N, 2), np.float32)


def put(buf, x, t, gain=1.0, pan=0.0):
    """Mix mono/stereo x into buf at time t (s)."""
    i = int(t * SR)
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    if i >= N:
        return
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), N - i)
    buf[i:i + n] += x[:n] * gain


def sos(kind, f, order=2):
    return sg.butter(order, f, kind, fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return sg.sosfilt(sos(kind, f, order), x, axis=0).astype(np.float32)


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return (np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)).astype(np.float32)


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


def ir(dur=1.6, decay=0.5, pre=0.012):
    n = int(dur * SR)
    t = np.arange(n) / SR
    l = noise(n) * np.exp(-t / decay)
    r = noise(n) * np.exp(-t / decay)
    l, r = filt(l, "low", 6000), filt(r, "low", 6000)
    out = np.zeros((n + int(pre * SR), 2), np.float32)
    out[int(pre * SR):, 0], out[int(pre * SR):, 1] = l, r
    return out / np.sqrt((out ** 2).sum() / 2)


IR_ROOM, IR_HALL = ir(0.7, 0.18), ir(3.0, 0.9)


def reverb(x, irr, wet):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([sg.fftconvolve(x[:, c], irr[:, c])[:len(x) + len(irr) - 1] for c in range(2)], 1)
    out = np.zeros_like(y)
    out[:len(x)] += x
    return (out + y * wet).astype(np.float32)


# ---------------------------------------------------------------- instruments
def kick(g=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 44 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.28)
    click = filt(noise(n), "high", 3000) * np.exp(-t / 0.004) * 0.35
    return np.tanh((body + click) * 1.6) * 0.9 * g


def hat(g=1.0, d=0.035):
    n = int(0.15 * SR)
    return filt(noise(n), "high", 7500) * env(n, 0.0005, d) * 0.35 * g


def clap(g=1.0):
    n = int(0.4 * SR)
    x = filt(noise(n), "band", [900, 3500])
    e = np.zeros(n, np.float32)
    for k, o in enumerate([0, 0.011, 0.022]):
        i = int(o * SR)
        e[i:] += env(n - i, 0.0005, 0.012 if k < 2 else 0.11)
    return reverb(x * e * 0.8 * g, IR_ROOM, 0.35)


def snare(g=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    nz = filt(noise(n), "band", [1200, 7000]) * np.exp(-t / 0.07)
    return (tone + nz) * 0.55 * g


WT = np.zeros(2048, np.float32)
for k in range(1, 40):
    WT += np.sin(2 * np.pi * k * np.arange(2048) / 2048) / k
WT /= np.abs(WT).max()


def saw(freq, n, detune=0.0):
    ph = (np.cumsum(np.full(n, freq * (1 + detune) / SR)) + rng.random()) % 1.0
    return WT[(ph * 2048).astype(int)]


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "Bb": 10, "B": 11}
    nm, octv = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[nm] + 12 * (octv + 1) - 69) / 12)


def pad(chord, dur, cutoff=1400, att=0.4, rel=0.6):
    n = int(dur * SR)
    x = np.zeros((n, 2), np.float32)
    for nn in chord:
        f = note(nn)
        for d, side in [(-0.006, 0), (0.0, None), (0.006, 1)]:
            v = saw(f, n, d)
            if side is None:
                x += v[:, None] * 0.5
            else:
                x[:, side] += v
    x = filt(x, "low", cutoff, 2)
    t = np.arange(n) / SR
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel)
    return x * e[:, None] * 0.06


def sub(freq, dur, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    e = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.7))
    return np.tanh(x * e * 1.4) * 0.45 * g


def impact(g=1.0, big=True):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    f = 28 + 70 * np.exp(-t / 0.12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 if big else 0.45))
    crack = filt(noise(n), "low", 2500) * np.exp(-t / 0.06) * 0.6
    x = np.tanh((boom + crack) * 1.8) * 0.8
    return reverb(x * g, IR_HALL, 0.25 if big else 0.12)


def riser(dur, g=1.0, f0=300, f1=7000):
    n = int(dur * SR)
    out = np.zeros(n, np.float32)
    nz = noise(n)
    blk = 1024
    for i in range(0, n, blk):
        p = i / n
        fc = f0 * (f1 / f0) ** p
        seg = nz[max(0, i - 2048):i + blk]
        y = sg.sosfilt(sos("band", [fc * 0.7, min(fc * 1.4, 20000)]), seg)
        out[i:i + blk] = y[-len(out[i:i + blk]):]
    t = np.arange(n) / SR
    tone_f = 120 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * 0.15
    e = (t / dur) ** 2
    return ((out * 0.9 + tone) * e * g).astype(np.float32)


def whoosh(dur=0.5, g=1.0, up=True):
    n = int(dur * SR)
    x = riser(dur, 1.0, 400 if up else 5000, 5000 if up else 400)
    t = np.arange(n) / SR
    bell = np.sin(np.pi * t / dur) ** 2
    return reverb(x / (np.abs(x).max() + 1e-6) * bell * 0.5 * g, IR_ROOM, 0.3)


def blip(f=1800, dur=0.07, g=1.0, harm=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) + harm * np.sin(4 * np.pi * f * t)) * env(n, 0.001, dur / 3)
    return x * 0.22 * g


def tick(g=1.0):
    n = int(0.006 * SR)
    return filt(noise(n), "high", 4000) * env(n, 0.0002, 0.0015) * 0.3 * g


def buzz(dur=0.18, f=110, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sign(np.sin(2 * np.pi * f * 1.5 * t)) * 0.3
    return filt(x * env(n, 0.002, dur), "low", 2500) * 0.25 * g


def glitch(dur=0.3, g=1.0):
    n = int(dur * SR)
    x = np.zeros(n, np.float32)
    i = 0
    while i < n:
        L = int(rng.uniform(0.008, 0.04) * SR)
        kind = rng.integers(3)
        t = np.arange(L) / SR
        if kind == 0:
            seg = np.sign(np.sin(2 * np.pi * rng.uniform(200, 3000) * t)) * 0.4
        elif kind == 1:
            seg = np.round(noise(L) * 3) / 3 * 0.4
        else:
            seg = np.zeros(L)
        x[i:i + L] = seg[: n - i]
        i += L
    return filt(x, "high", 150) * g * 0.6


def hum(dur, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 110 * t + 2.5 * np.sin(2 * np.pi * 3 * t)) * 0.5
    x += np.sin(2 * np.pi * 220.7 * t) * 0.3
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * 14 * t)
    e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15)
    return (x * trem * e * 0.18 * g).astype(np.float32)


def sweep_tone(dur, f0, f1, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    e = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * e * 0.12 * g


# ---------------------------------------------------------------- arrangement
music = track()
sfx = track()
drums = track()

BEAT = 0.5
# pads / sub following chords
CH = {
    "Dm": ["D3", "F3", "A3", "D4"], "Bb": ["Bb2", "D3", "F3", "Bb3"],
    "Gm": ["G2", "Bb2", "D3", "G3"], "A": ["A2", "C#3", "E3", "A3"],
}
ROOT = {"Dm": note("D1") * 2, "Bb": note("Bb1"), "Gm": note("G1"), "A": note("A1")}
prog = [(0.0, 1.8, "Dm", 700), (1.8, 4.0, "Dm", 1100), (4.0, 6.5, "Bb", 1200),
        (6.5, 8.0, "Gm", 1500), (8.0, 9.0, "A", 1800), (9.0, 11.0, "Dm", 2200),
        (11.0, 13.0, "Bb", 2200), (13.0, 14.25, "Gm", 2000), (14.25, 15.5, "A", 2000),
        (15.5, TOTAL - 0.3, "Dm", 900)]
for a, b, c, cut in prog:
    put(music, pad(CH[c], b - a + 0.5, cut, att=0.15 if a > 0 else 0.8, rel=0.5), a, 1.0)


def chord_at(t):
    for a, b, c, _ in prog:
        if a <= t < b:
            return c
    return "Dm"


def beat_times(a, b, step=BEAT):
    return [round(a + i * step, 4) for i in range(int(round((b - a) / step)))]


kicks = []
# A section (muffled groove)
for bt in beat_times(2.0, 6.5):
    put(drums, kick(0.75), bt)
    put(drums, hat(0.6), bt + 0.25)
    put(music, sub(ROOT[chord_at(bt)], 0.45, 0.7), bt)
    kicks.append(bt)
# search: busier hats
for bt in beat_times(6.5, 8.5):
    put(drums, kick(0.9), bt)
    for k in range(4):
        put(drums, hat(0.45 if k % 2 else 0.25), bt + k * 0.125)
    put(music, sub(ROOT[chord_at(bt)], 0.45, 0.8), bt)
    kicks.append(bt)
# snare roll build into the drop
for i, st in enumerate(np.arange(8.0, 9.0, 0.0625)):
    put(drums, snare(0.25 + 0.6 * (st - 8.0)), st)
# drop
for bt in beat_times(9.0, 12.5):
    put(drums, kick(1.0), bt)
    for k in range(4):
        put(drums, hat(0.55 if k == 2 else 0.3), bt + k * 0.125)
    put(music, sub(ROOT[chord_at(bt)], 0.48, 1.0), bt)
    kicks.append(bt)
for ct in [9.5, 10.5, 11.5, 12.5]:
    put(drums, clap(0.9), ct)
# post-scan groove
for bt in beat_times(13.0, 15.5):
    put(drums, kick(1.0), bt)
    for k in range(4):
        put(drums, hat(0.55 if k == 2 else 0.3), bt + k * 0.125)
    put(music, sub(ROOT[chord_at(bt)], 0.48, 1.0), bt)
    kicks.append(bt)
for ct in [13.5, 14.5, 15.0]:
    put(drums, clap(0.9), ct)
# outro heartbeat
for bt in [16.5, 16.75, 18.0, 18.25]:
    put(drums, kick(0.35 if bt % 1 else 0.5), bt)

# muffle the A-section drums (opens up at the cut to clip B)
cut_i = int(6.5 * SR)
drums[:cut_i] = filt(drums[:cut_i], "low", 900)

# ---------------------------------------------------------------- SFX
put(sfx, sweep_tone(0.45, 60, 900, 1.6), 0.02)
put(sfx, glitch(0.12, 0.6), 0.0)
for i in range(6):
    put(sfx, blip(1400 + 180 * i, 0.06, 0.7), 0.36 + 0.17 * i, pan=-0.4)
for i, st in enumerate(np.linspace(0.1, 1.0, 5)):
    put(sfx, blip(900 + 300 * i, 0.09, 0.5, 0.1), st, pan=0.3)
put(sfx, riser(0.85, 0.5), 0.95)
put(sfx, impact(0.6, big=False), 1.8)
put(sfx, whoosh(0.5, 0.9), 1.65)
put(sfx, blip(2200, 0.08, 0.8), 2.35, pan=-0.5)          # watch tag
put(sfx, blip(2600, 0.06, 0.6), 2.45, pan=-0.5)
put(sfx, blip(1900, 0.08, 0.9), 3.95, pan=0.2)            # face reticle
put(sfx, blip(2500, 0.06, 0.6), 4.05, pan=0.2)
for k in range(10):
    put(sfx, tick(0.8), 4.1 + k * 0.035)
# A -> B transition
put(sfx, glitch(0.32, 1.0), 6.32)
put(sfx, impact(0.7, big=False), 6.5)
put(sfx, whoosh(0.4, 0.7, up=False), 6.4)
# crowd search
put(sfx, buzz(0.2, 98, 1.0), 6.72, pan=-0.2)              # "no match"
for st in np.arange(6.62, 8.2, 0.14):
    put(sfx, blip(rng.uniform(1500, 3200), 0.035, 0.35), st, pan=rng.uniform(-0.7, 0.7))
# lock-on beeps accelerating
st = 8.25
gap = 0.2
while st < 8.98:
    put(sfx, blip(2100, 0.045, 0.7), st)
    st += gap
    gap = max(0.035, gap * 0.8)
put(sfx, riser(0.75, 0.45, 600, 9000), 8.25)
put(sfx, impact(1.0, big=True), 9.0)
put(sfx, blip(2793, 0.25, 0.9, 0.1), 9.0)
put(sfx, blip(3520, 0.25, 0.7, 0.1), 9.08)
# scan
put(sfx, whoosh(0.45, 0.9), 9.4)
put(sfx, glitch(0.35, 0.35), 9.85)
for i in range(8):
    put(sfx, blip(800 + 260 * i, 0.04, 0.4), 9.88 + i * 0.045)
put(sfx, hum(2.4, 1.0), 10.25)
put(sfx, sweep_tone(1.5, 500, 1600, 0.9), 10.25)
put(sfx, sweep_tone(0.85, 1600, 600, 0.7), 11.75)
for st in np.arange(10.3, 12.7, 0.05):
    if rng.random() < 0.55:
        put(sfx, tick(0.7), st, pan=rng.uniform(-0.6, 0.6))
for i, st in enumerate([10.45, 10.75, 11.05, 11.35, 11.65, 11.95, 12.25]):
    put(sfx, blip(1500 + 120 * i, 0.06, 0.6), st, pan=0.5)
put(sfx, riser(0.3, 0.3, 2000, 9000)[::-1].copy(), 12.7)
put(sfx, impact(1.0, big=True), 13.0)
for i, f in enumerate([1174.7, 1480.0, 1760.0, 2349.3]):
    put(sfx, reverb(blip(f, 0.22, 0.8, 0.05), IR_ROOM, 0.5), 13.02 + i * 0.07)
put(sfx, whoosh(0.4, 0.8, up=False), 13.35)
# exit to outro
put(sfx, glitch(0.25, 0.9), 15.27)
put(sfx, impact(1.0, big=True), 15.5)
put(sfx, blip(1300, 0.08, 0.7), 15.62)
put(sfx, whoosh(0.6, 0.6), 15.8)
put(sfx, impact(0.45, big=False), 16.0)
for i in range(5):
    put(sfx, blip(1760 * 2 ** (i / 12 * 2), 0.09, 0.7), 16.65 + i * 0.12, pan=-0.6 + 0.3 * i)
put(sfx, blip(1200, 0.07, 0.5), 17.3)
put(sfx, blip(1000, 0.07, 0.5), 19.3)
put(sfx, sweep_tone(0.5, 900, 50, 1.6), TOTAL - 0.65)

# ---------------------------------------------------------------- voice
voice = track()
caps = []
for x, start, cap in voices:
    v = filt(x, "high", 110)
    v = v + filt(v, "band", [2500, 5000]) * 0.4
    n = len(v)
    tt = np.arange(n) / SR
    dl = (0.011 + 0.0015 * np.sin(2 * np.pi * 0.7 * tt)) * SR
    idx = np.clip(np.arange(n) - dl, 0, n - 1)
    dbl = np.interp(idx, np.arange(n), v)
    ring = v * np.sin(2 * np.pi * 42 * tt) * 0.06
    st = np.stack([v + ring + dbl * 0.22, v + ring * 0.8 + dbl * 0.3], 1)
    st = reverb(st, IR_ROOM, 0.16)
    st = st / (np.abs(st).max() + 1e-6) * 0.92
    put(voice, st, start)
    caps.append({"start": start, "end": start + n / SR, "text": cap})

# ---------------------------------------------------------------- original audio
orig = track()


def src(name):
    x, sr = read_wav(f"{S}/work/{name}.wav")
    return x


A, B = src("a"), src("b")


def put_src(x, s0, t0, t1, gain, lp=None, fade=0.03):
    seg = x[int(s0 * SR): int(s0 * SR) + int((t1 - t0) * SR)].copy()
    if lp:
        seg = filt(seg, "low", lp, 4)
    n = len(seg)
    f = int(fade * SR)
    e = np.ones(n, np.float32)
    e[:f] = np.linspace(0, 1, f)
    e[-f:] = np.linspace(1, 0, f)
    put(orig, seg * e[:, None], t0, gain)


put_src(A, 0.0, 1.8, 6.5, 0.55)
put_src(B, 0.0, 6.5, 8.25, 0.45)
put_src(B, 91 / 24.83, 8.25, 9.5, 0.45)
put_src(B, 122 / 24.83, 9.5, 13.4, 0.35, lp=500)
put_src(B, 122 / 24.83, 13.4, 15.5, 0.5)

# ---------------------------------------------------------------- mix
venv = np.abs(voice).max(1)
venv = sg.sosfilt(sos("low", 6), venv)
venv = np.clip(venv / (venv.max() + 1e-6) * 3, 0, 1)[:, None]
duck = 1 - 0.45 * venv

mix = (music * 0.9 + drums * 0.8 + orig) * duck + sfx * 0.85 + voice * 1.0
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fo = int(0.25 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / (np.abs(mix).max() + 1e-6) * 0.95

with wave.open(f"{S}/work/mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

# per-video-frame spectrum bands for the HUD visualizer
FPS = 30
nf = int(round(TOTAL * FPS))
mono = mix.mean(1)
bands = np.zeros((nf, 32), np.float32)
edges = np.geomspace(40, 12000, 33)
freqs = np.fft.rfftfreq(2048, 1 / SR)
win = np.hanning(2048)
for k in range(nf):
    c = int(k / FPS * SR)
    seg = mono[max(0, c - 1024): c + 1024]
    if len(seg) < 2048:
        seg = np.pad(seg, (0, 2048 - len(seg)))
    mag = np.abs(np.fft.rfft(seg * win))
    for j in range(32):
        m = mag[(freqs >= edges[j]) & (freqs < edges[j + 1])]
        bands[k, j] = np.log1p(m.mean() if len(m) else 0)
bands = bands / (np.percentile(bands, 99) + 1e-6)
np.save(f"{S}/work/bands.npy", np.clip(bands, 0, 1.2))
# loudness envelope (for beat-reactive visuals)
rms = np.array([np.sqrt((drums[int(k / FPS * SR): int(k / FPS * SR) + 1600] ** 2).mean() + 1e-9) for k in range(nf)])
np.save(f"{S}/work/drum_env.npy", rms / rms.max())
json.dump({"total": TOTAL, "captions": caps, "kicks": kicks}, open(f"{S}/work/timeline.json", "w"), indent=1)
print("TOTAL", TOTAL, "frames", nf, "peak", np.abs(mix).max())
