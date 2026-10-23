"""Score + sound design + original audio for the film."""
import sys
import wave

import numpy as np
import scipy.signal as sg

sys.path.insert(0, sys.argv[1] + "/src")
from spec import B, END, FPS, HITS, O, SHUTTERS, bt  # noqa: E402

M = sys.argv[1]
SR = 48000
N = int(END * SR)
rng = np.random.default_rng(11)


def track():
    return np.zeros((N, 2), np.float32)


def put(buf, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.stack([x * np.cos(a), x * np.sin(a)], 1) * 1.414
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


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


def env_ad(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return (np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)).astype(np.float32)


def make_ir(dur, decay, hp=200, lp=7000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.stack([noise(n), noise(n)], 1) * np.exp(-t / decay)[:, None]
    ir = filt(filt(ir, "low", lp), "high", hp)
    ir[: int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum() / 2)


HALL, ROOM = make_ir(3.6, 1.1), make_ir(0.9, 0.22)


def reverb(x, ir, wet):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([sg.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1).astype(np.float32)
    y[: len(x)] *= wet
    y[len(x):] *= wet
    y[: len(x)] += x
    return y


NAMES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "Ab": 8,
         "A": 9, "A#": 10, "Bb": 10, "B": 11}


def hz(name):
    nm, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((NAMES[nm] + 12 * (o + 1) - 69) / 12)


# ---------------------------------------------------------------- instruments
def piano(f, dur, vel=0.6):
    tail = 1.6
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    T1 = 3.0 * (220 / f) ** 0.4
    K = int(min(14, 7000 // f))
    x = np.zeros(n, np.float32)
    for k in range(1, K + 1):
        fk = f * k * np.sqrt(1 + 0.00025 * k * k)
        ak = (1 / k ** 1.25) * (vel ** (0.4 * (k - 1) / 3 + 0.6))
        Tk = T1 / (1 + 0.45 * (k - 1))
        ph = rng.uniform(0, 2 * np.pi)
        x += ak * np.sin(2 * np.pi * fk * t + ph) * np.exp(-t / Tk)
        if k <= 3:  # second string, slightly detuned -> warmth
            x += ak * 0.6 * np.sin(2 * np.pi * fk * 1.0006 * t + ph) * np.exp(-t / Tk)
    x *= (0.55 * np.exp(-t / 0.35) + 0.45)
    x *= 1 - np.exp(-t / 0.0025)
    ham = filt(noise(n), "band", [1500, 5000]) * np.exp(-t / 0.006) * 0.08 * vel
    x = x + ham
    damp = np.ones(n, np.float32)
    di = int(dur * SR)
    damp[di:] = np.exp(-(t[di:] - dur) / 0.18)
    x = x * damp
    x = filt(x, "low", 2500 + 3500 * vel)
    return (x / 3.2 * vel).astype(np.float32)


WT = np.zeros(4096, np.float32)
for k in range(1, 48):
    WT += np.sin(2 * np.pi * k * np.arange(4096) / 4096) / k
WT /= np.abs(WT).max()


def saw(f, n, det=0.0):
    ph = (np.cumsum(np.full(n, f * (1 + det) / SR)) + rng.random()) % 1.0
    return WT[(ph * 4096).astype(np.int64)]


def pad(notes, dur, cutoff=1800, att=0.9, rel=1.2, g=1.0):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    x = np.zeros((n, 2), np.float32)
    vib = 1 + 0.0018 * np.sin(2 * np.pi * 4.8 * t)
    for nm in notes:
        f = hz(nm)
        for d, side in [(-0.0045, 0), (-0.0015, 1), (0.0015, 0), (0.0045, 1)]:
            ph = (np.cumsum(f * (1 + d) * vib / SR) + rng.random()) % 1.0
            x[:, side] += WT[(ph * 4096).astype(np.int64)]
    x = filt(x, "low", cutoff, 2)
    e = np.minimum(1, t / att) * np.where(t < dur, 1, np.exp(-(t - dur) / (rel / 3)))
    return x * e[:, None] * 0.035 * g


def bass(f, dur, g=1.0):
    n = int((dur + 0.1) * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * saw(f, n)
    e = np.minimum(1, t / 0.008) * np.where(t < dur, np.exp(-t / (dur * 2.5)), 0)
    e = e.astype(np.float32)
    return filt(np.tanh(x * 1.3) * e, "low", 900) * 0.32 * g


def kick(g=1.0):
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    click = filt(noise(n), "high", 2500) * np.exp(-t / 0.004) * 0.3
    return (np.tanh((body + click) * 1.5) * 0.85 * g).astype(np.float32)


def snare(g=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.06) * 0.6
    nz = filt(noise(n), "band", [1000, 8000]) * np.exp(-t / 0.11)
    return reverb((tone + nz) * 0.5 * g, ROOM, 0.35)


def hat(g=1.0, d=0.03):
    n = int(0.12 * SR)
    return filt(noise(n), "high", 7000) * env_ad(n, 0.0005, d) * 0.28 * g


def shaker(g=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    e = np.sin(np.pi * np.minimum(1, t / 0.07)) ** 2
    return filt(noise(n), "band", [4000, 11000]) * e * 0.12 * g


def tom(f=95, g=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    ff = f * (1 + 0.6 * np.exp(-t / 0.05))
    x = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.45)
    x += filt(noise(n), "low", 1200) * np.exp(-t / 0.03) * 0.4
    return reverb(np.tanh(x * 1.6) * 0.7 * g, HALL, 0.25)


def crash(g=1.0, dur=2.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = filt(noise(n), "high", 4500)
    for fr in (3150, 4270, 5340, 6810):
        x += 0.15 * np.sign(np.sin(2 * np.pi * fr * t + rng.random() * 6))
    x = filt(x, "high", 3000) * np.exp(-t / (dur / 3.5)) * (1 - np.exp(-t / 0.002))
    return reverb(x * 0.22 * g, HALL, 0.3)


def impact(g=1.0, size=1.0):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    f = 30 + 80 * np.exp(-t / 0.1)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.6 + 0.8 * size))
    crack = filt(noise(n), "low", 3000) * np.exp(-t / 0.05) * 0.5
    x = np.tanh((boom + crack) * 2.0) * 0.8
    return reverb(x * g, HALL, 0.3 * size)


def riser(dur, g=1.0, f0=250, f1=8000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = noise(n + 4096)
    out = np.zeros(n, np.float32)
    blk = 1024
    for i in range(0, n, blk):
        fc = f0 * (f1 / f0) ** (i / n)
        y = sg.sosfilt(sos("band", [fc * 0.7, min(fc * 1.4, 22000)]), nz[i:i + blk + 4096])[-blk:]
        out[i:i + blk] = y[: len(out[i:i + blk])]
    tone = np.sin(2 * np.pi * np.cumsum(110 * 6 ** (t / dur)) / SR) * 0.12
    return reverb(((out + tone) * (t / dur) ** 2.2 * g).astype(np.float32), HALL, 0.25)


def whoosh(dur=0.5, g=1.0, up=True):
    x = riser(dur, 1.0, 400 if up else 6000, 6000 if up else 400)[: int(dur * SR)]
    t = np.arange(len(x)) / SR
    bell = (np.sin(np.pi * t / dur) ** 2)[:, None]
    return x / (np.abs(x).max() + 1e-6) * bell * 0.45 * g


def shutter(g=1.0):
    n = int(0.12 * SR)
    x = np.zeros(n, np.float32)
    for o, a in ((0.0, 1.0), (0.045, 0.7)):
        i = int(o * SR)
        m = int(0.012 * SR)
        x[i:i + m] += filt(noise(m), "band", [1500, 7000]) * env_ad(m, 0.0003, 0.003) * a
    return reverb(x * 0.6 * g, ROOM, 0.25)


def shimmer(dur, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n, np.float32)
    for nm in ("C6", "E6", "G6", "C7"):
        f = hz(nm)
        x += np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * 5.5 * t)) * 0.25
    e = np.minimum(1, t / 0.4) * np.exp(-t / (dur / 2))
    return reverb(x * e * 0.08 * g, HALL, 0.6)


# ---------------------------------------------------------------- V8 engine
def engine(times, rpms, t0, t1, g=1.0):
    n = int((t1 - t0) * SR)
    tt = t0 + np.arange(n) / SR
    rpm = np.interp(tt, times, rpms)
    fire = rpm / 60 * 4
    ph = np.cumsum(fire / SR)
    idx = np.where(np.floor(ph[1:]) > np.floor(ph[:-1]))[0] + 1
    pat = np.array([1.0, 0.62, 0.86, 0.55, 0.95, 0.7, 0.6, 0.9])
    p = np.zeros(n, np.float32)
    for j, i in enumerate(idx):
        jit = int(rng.normal() * 0.012 * SR / max(fire[i], 1))
        k = min(n - 1, max(0, i + jit))
        p[k] += pat[j % 8] * (0.8 + 0.4 * rng.random())
    load = np.clip((rpm - 800) / 5500, 0, 1)
    lo = filt(p, "low", 700)
    hi = filt(p, "low", 2600)
    y = lo * (1 - load) + hi * load
    for f0, q in ((95, 0.35), (190, 0.25), (380, 0.15)):
        y = y + filt(p, "band", [f0 * 0.8, f0 * 1.25]) * q * 6
    d = int(0.0045 * SR)
    y[d:] += 0.5 * y[:-d]
    intake = filt(noise(n), "band", [1800, 5000]) * load * 0.05
    y = np.tanh(y * 2.2) + intake
    fade = np.minimum(1, np.minimum(np.arange(n) / (0.08 * SR), (n - np.arange(n)) / (0.25 * SR)))
    y = y * fade
    st = np.stack([y, np.roll(y, int(0.0007 * SR))], 1)
    return reverb(st * 0.22 * g, ROOM, 0.15), rpm


def rain(dur, g=1.0):
    n = int(dur * SR)
    w = np.stack([noise(n), noise(n)], 1)
    pink = filt(filt(w, "low", 4000, 1), "high", 350, 2)
    pink += filt(w, "high", 6000) * 0.35
    drops = np.zeros((n, 2), np.float32)
    for _ in range(int(dur * 25)):
        i = rng.integers(0, n - 600)
        c = rng.integers(0, 2)
        drops[i:i + 600, c] += filt(noise(600), "band", [2500, 7000]) * env_ad(600, 0.0002, 0.002) * rng.uniform(0.2, 1)
    t = np.arange(n) / SR
    e = np.minimum(1, np.minimum(t / 0.6, (dur - t) / 0.8))[:, None]
    return (pink * 0.06 + drops * 0.15) * e * g


# ---------------------------------------------------------------- arrangement
music, drums, sfx = track(), track(), track()

CH = {
    "Am": (["A2", "E3", "A3", "C4", "E4"], "A1"),
    "F": (["F2", "C3", "F3", "A3", "C4"], "F1"),
    "C": (["C3", "G3", "C4", "E4", "G4"], "C2"),
    "G": (["G2", "D3", "G3", "B3", "D4"], "G1"),
}
PADV = {"Am": ["A3", "C4", "E4", "A4"], "F": ["F3", "A3", "C4", "F4"], "C": ["C4", "E4", "G4", "C5"],
        "G": ["G3", "B3", "D4", "G4"]}


def rb(n):
    """Un-warped beat grid used by section A (the edit inserts beats there)."""
    return O + n * B


def real_beat(t):
    return (t - O) / B


RA_TITLE, RA_COUCH = real_beat(bt(6)), real_beat(bt(11))
RA_DOG, RA_END = real_beat(bt(18.5)), real_beat(bt(46.5))


def chords_A():
    seq = ["Am", "F", "C", "G"]
    out, b = [], 0
    while b < RA_END - 1e-6:
        out.append((b, min(4, RA_END - b), seq[(b // 4) % 4]))
        b += 4
    return out


SEC_A = chords_A()
SECTIONS = [
    (46.5, 3.5, "Am"), (50, 4, "Am"), (54, 4, "F"), (58, 3, "G"),
    (61, 4, "F"), (65, 4, "C"), (69, 3, "G"),
    (73, 4, "Am"), (77, 4, "F"), (81, 2, "G"),
    (83, 4, "C"), (87, 4, "G"), (91, 1, "F"),
    (92, 4, "F"), (96, 4.75, "C"),
]


def arp(b0, nb, ch, vel, step=0.5, pattern=(0, 1, 2, 3, 4, 3, 2, 1), jit=True, grid=bt):
    notes = CH[ch][0]
    k = 0
    b = b0
    while b < b0 + nb - 1e-6:
        nm = notes[pattern[k % len(pattern)]]
        v = vel * (1.0 if k % 4 == 0 else 0.82) * (1 + (rng.normal() * 0.06 if jit else 0))
        dt = rng.normal() * 0.006 if jit else 0
        put(music, piano(hz(nm), step * B * 1.9, float(np.clip(v, 0.1, 1.0))), grid(b) + dt, 1.0,
            pan=-0.3 + 0.15 * pattern[k % len(pattern)])
        b += step
        k += 1


# --- section A: intro, chapters, dog (real-time beat grid) ------------------
for b0, nb, ch in SEC_A:
    g = 0.55 if b0 < RA_TITLE else (1.0 if b0 < RA_DOG else 0.6)
    put(music, pad(PADV[ch], nb * B, cutoff=1400 if b0 < RA_DOG else 1000, att=1.2, g=g), rb(b0))
intro_motif = [(0, "A3", 2, 0.42), (0, "E4", 2, 0.35), (1.5, "C5", 1, 0.38), (2.5, "B4", 1, 0.32), (3.5, "E4", 1, 0.3),
               (4, "F3", 2, 0.4), (4, "C4", 2, 0.34), (4.5, "A4", 1, 0.36), (5.25, "G4", 0.75, 0.3)]
for b, nm, d, v in intro_motif:
    put(music, piano(hz(nm), d * B, v), rb(b))
for b0, nb, ch in SEC_A:
    if RA_TITLE <= b0 + nb and b0 < RA_DOG:
        s0 = max(b0, RA_TITLE + 2)
        if s0 < min(b0 + nb, RA_DOG):
            arp(s0, min(b0 + nb, RA_DOG) - s0, ch, 0.42 if b0 < RA_COUCH else 0.48, grid=rb)
        if b0 >= RA_TITLE:
            put(music, bass(hz(CH[ch][1]) * 2, nb * B * 0.9, 0.55), rb(b0))
    if b0 >= RA_DOG - 0.5:
        for k in range(int(nb // 2)):
            nm = CH[ch][0][[2, 3][k % 2]]
            put(music, piano(hz(nm), 2 * B, 0.22), rb(b0 + 2 * k))
for b in np.arange(RA_COUCH, RA_DOG, 0.25):
    put(drums, shaker(0.9 if (b * 4) % 2 == 0 else 0.6), rb(b))
put(sfx, impact(0.45, 0.6), bt(6))
put(sfx, crash(0.35, 3.0)[::-1].copy()[-int(1.2 * SR):], bt(6) - 1.2)
put(sfx, whoosh(0.5, 0.5), bt(11) - 0.3)
put(sfx, whoosh(0.4, 0.35), bt(15) - 0.2)

# --- section B: the drive --------------------------------------------------
put(sfx, rain(bt(61) - bt(46.5) + 0.8, 1.0), bt(46.5))
for b in np.arange(46.5, 50, 0.5):  # pulsing bass build
    put(music, bass(hz("A1") * 2, 0.45 * B, 0.35 + 0.15 * (b - 46.5) / 3.5), bt(b))
put(music, pad(PADV["Am"], 3.5 * B, cutoff=900, att=0.4, g=0.7), bt(46.5))
put(sfx, riser(3.4 * B, 0.55), bt(46.9))
put(sfx, crash(0.5, 2.0)[::-1].copy()[-int(2.0 * SR):], bt(50) - 2.0)
put(sfx, whoosh(0.4, 0.8), bt(49.5) - 0.12)
for b0, nb, ch in [s for s in SECTIONS if 50 <= s[0] < 61]:
    put(music, pad(PADV[ch], nb * B, cutoff=2200, att=0.25, g=0.9), bt(b0))
    for b in np.arange(b0, b0 + nb, 0.5):
        if b >= 60:
            break
        put(music, bass(hz(CH[ch][1]) * 2, 0.45 * B, 0.85), bt(b))
for b in np.arange(50, 60, 1):
    put(drums, kick(1.0), bt(b))
    if int(b - 50) % 2 == 1:
        put(drums, snare(0.8), bt(b))
    for h in range(4):
        put(drums, hat(0.7 if h == 2 else 0.4), bt(b + h * 0.25))
for k, b in enumerate([59, 59.25, 59.5, 59.75]):
    put(drums, tom(110 - 12 * k, 0.6), bt(b))
drive_motif = [(50, "A4", 1), (51, "E5", 1), (52, "D5", 0.5), (52.5, "C5", 1.5), (54, "A4", 1), (55, "C5", 1),
               (56, "F5", 0.5), (56.5, "E5", 1.5), (58, "D5", 1), (59, "B4", 1)]
for b, nm, d in drive_motif:
    put(music, piano(hz(nm), d * B, 0.62), bt(b))
    put(music, piano(hz(nm) / 2, d * B, 0.4), bt(b))
for tt, s in HITS.items():
    if bt(49) < tt < bt(61):
        put(sfx, impact(0.9 * s, 0.6 + 0.4 * s), tt)
        if s >= 0.5:
            put(sfx, crash(0.6 * s), tt)
for b in (51.5, 52.5, 54, 58):
    put(sfx, whoosh(0.3, 0.5), bt(b) - 0.15)
# engine: rev on the reveal, cruise during the driver shot, blip on the last shot
eng_t = [bt(50) - 0.05, bt(50) + 0.05, bt(50) + 0.4, bt(51.5), bt(52.5), bt(53), bt(54), bt(57.8),
         bt(58) + 0.05, bt(58) + 0.35, bt(59.5), bt(60.3)]
eng_r = [900, 1500, 6100, 4200, 3600, 5200, 3300, 2900, 3200, 5600, 3500, 1200]
eng, rpm = engine(eng_t, eng_r, bt(50) - 0.05, bt(60.3), 1.0)
put(sfx, eng, bt(50) - 0.05, 0.6)

# --- section C: field + bar -------------------------------------------------
put(sfx, impact(0.35, 0.5), bt(61))
for b0, nb, ch in [s for s in SECTIONS if 61 <= s[0] < 72]:
    put(music, pad(PADV[ch], nb * B, cutoff=1700, att=0.8, g=1.0), bt(b0))
    arp(b0, nb, ch, 0.5)
    put(music, bass(hz(CH[ch][1]) * 2, nb * B * 0.95, 0.7), bt(b0))
    for b in np.arange(b0, b0 + nb, 2):
        put(drums, kick(0.55), bt(b))
        put(drums, snare(0.35), bt(b + 1))
put(sfx, whoosh(0.45, 0.4), bt(65.5) - 0.25)
put(music, piano(hz("G4"), 1.0 * B, 0.4), bt(71))

# --- section D: build (dream + photos) -------------------------------------
put(sfx, impact(0.6, 0.8), bt(73))
for b0, nb, ch in [s for s in SECTIONS if 73 <= s[0] < 83]:
    put(music, pad(PADV[ch], nb * B, cutoff=1500 + 400 * (b0 - 73) / 4, att=0.6, g=1.0 + 0.15 * (b0 - 73) / 4),
        bt(b0))
    put(music, bass(hz(CH[ch][1]) * 2, nb * B, 0.8), bt(b0))
    for b in np.arange(b0, b0 + nb, 0.5):
        nm = CH[ch][0][4]
        put(music, piano(hz(nm) * 2, 0.45 * B, 0.28 + 0.25 * (b - 73) / 10), bt(b))
for b in (73, 75, 76, 77, 78.5, 79, 79.5, 80, 80.5, 81, 81.5, 82):
    put(drums, tom(80 if b < 79 else 95, 0.55 + 0.035 * (b - 73)), bt(b))
for k, b in enumerate(np.arange(81, 83, 0.125)):
    put(drums, snare(0.15 + 0.55 * k / 16), bt(b))
put(sfx, riser(2.4 * B, 0.6), bt(80.6))
for st in SHUTTERS:
    put(sfx, shutter(1.0), st)

# --- section E: climax (beret) ------------------------------------------------
put(sfx, impact(1.0, 1.0), bt(83))
put(sfx, crash(0.9, 3.5), bt(83))
put(sfx, shimmer(5.0, 1.0), bt(83))
for b0, nb, ch in [s for s in SECTIONS if 83 <= s[0] < 92]:
    put(music, pad(PADV[ch], nb * B, cutoff=2600, att=0.15, g=1.35), bt(b0))
    put(music, pad([nm[:-1] + str(int(nm[-1]) + 1) for nm in PADV[ch][:3]], nb * B, cutoff=3000, att=0.3, g=0.6),
        bt(b0))
    arp(b0, nb, ch, 0.5, step=0.5)
    for b in np.arange(b0, b0 + nb, 1):
        put(music, bass(hz(CH[ch][1]) * 2, 0.95 * B, 0.95), bt(b))
for b in np.arange(83, 91, 1):
    put(drums, kick(0.9), bt(b))
    if int(b - 83) % 2 == 1:
        put(drums, snare(0.75), bt(b))
    for h in range(2):
        put(drums, hat(0.45), bt(b + 0.5 * h))
melody = [(83, "E5", 1.5), (84.5, "D5", 0.5), (85, "C5", 1), (86, "G5", 1), (87, "D5", 1.5), (88.5, "C5", 0.5),
          (89, "B4", 1), (90, "G4", 1), (91, "A4", 1)]
for b, nm, d in melody:
    put(music, piano(hz(nm), d * B, 0.75), bt(b), pan=0.1)
    put(music, piano(hz(nm) * 2, d * B, 0.35), bt(b), pan=0.25)

# --- section F: outro ------------------------------------------------------------
for b0, nb, ch in [s for s in SECTIONS if s[0] >= 92]:
    put(music, pad(PADV[ch], nb * B, cutoff=1300, att=1.0, rel=2.0, g=0.8), bt(b0))
arp(92, 4, "F", 0.36)
for b, nm, d, v in [(96, "C3", 4, 0.5), (96, "G3", 4, 0.42), (96, "E4", 4, 0.42), (96, "C5", 4, 0.45),
                    (97.5, "G4", 2.5, 0.3), (98.5, "E5", 2, 0.32)]:
    put(music, piano(hz(nm), d * B, v), bt(b))
put(sfx, whoosh(0.6, 0.35), bt(92) - 0.3)
put(sfx, impact(0.35, 0.7), bt(96))

music = reverb(music, HALL, 0.32)[:N]
drums = reverb(drums, ROOM, 0.12)[:N]


# ---------------------------------------------------------------- original audio
def read(name):
    w = wave.open(f"{M}/work/{name}.wav")
    return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768


orig = track()
duck = np.ones(N, np.float32)


def put_src(name, s0, t0, t1, gain, fade=0.06, lp=None, hp=None):
    x = read(name)
    seg = x[int(s0 * SR): int(s0 * SR) + int((t1 - t0) * SR)].copy()
    if hp:
        seg = filt(seg, "high", hp)
    if lp:
        seg = filt(seg, "low", lp)
    n = len(seg)
    f = int(fade * SR)
    e = np.ones(n, np.float32)
    e[:f] = np.linspace(0, 1, f)
    e[-f:] = np.minimum(e[-f:], np.linspace(1, 0, f))
    put(orig, seg * e[:, None], t0, gain)


def set_duck(t0, t1, level, ramp=0.25):
    tt = np.arange(N) / SR
    d = np.clip(np.minimum((tt - t0) / ramp, (t1 - tt) / ramp), 0, 1)
    np.minimum(duck, 1 - (1 - level) * d, out=duck)


put_src("c3360", 0.0, bt(11), bt(15), 0.32)
put_src("c5875", 0.08, bt(15), bt(18.5), 0.3)
put_src("gem", 0.95, bt(18.5), bt(46.5), 1.45, fade=0.12)
set_duck(bt(18.5) + 0.2, bt(46.5), 0.16, 0.6)
put_src("c9eac", 8.4, bt(46.5), bt(48.5), 0.22)
put_src("c9eac", 0.0, bt(48.5), bt(50), 0.55)
set_duck(bt(48.5), bt(49.6), 0.55, 0.15)
put_src("c9eac", 1.0, bt(54), bt(58), 0.22)
put_src("c1138", 0.3, bt(61), bt(65.5), 0.3)
put_src("bar", 0.37, bt(65.5), bt(72), 0.32)

mix = (music * 0.85 + drums * 0.62) * duck[:, None] + sfx * 0.8 + orig
mix = filt(mix, "high", 28)
# leveler: slow RMS follower pulls sections toward a common loudness
pw = (mix ** 2).mean(1)
win = int(1.2 * SR)
ker = np.hanning(win) / np.hanning(win).sum()
rms = np.sqrt(sg.fftconvolve(pw, ker, mode="same").clip(1e-10))
ref = np.sqrt(np.mean(pw))
lev = np.clip((ref / rms) ** 0.45, 10 ** (-6 / 20), 10 ** (7 / 20)).astype(np.float32)
mix = mix * lev[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 1.25
mix = np.tanh(mix) / np.tanh(1.25)
fo = int(1.2 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.93

with wave.open(f"{M}/work/film_mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

nf = int(END * FPS)
tt = np.arange(nf) / FPS
rpm_f = np.interp(tt, eng_t, eng_r)
np.save(f"{M}/work/rpm.npy", rpm_f.astype(np.float32))
for a in range(0, int(END)):
    s = mix[a * SR:(a + 1) * SR]
    print(f"{a:3d}s {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB", end="  " if (a + 1) % 6 else "\n")
print("\nEND", END)
