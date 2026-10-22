"""Score + sound design for the flashback (the real film). All times are flashback-relative (F seconds)."""
import numpy as np

SR = 48000
rng = np.random.default_rng(23)
A4 = 440.0 * (295.03 / 293.665)      # tune to Rafael's flute (~+8 cents)


def hz(n):  # midi note -> Hz, tuned to the flute
    return A4 * 2 ** ((n - 69) / 12)


def note(name):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
             'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    p, o = (name[:-1], int(name[-1]))
    return 12 * (o + 1) + names[p]


def T(n): return np.arange(int(n * SR)) / SR


def st(m): return np.stack([m, m], 1).astype(np.float32)


def pan(m, p):  # p in [-1, 1]
    return np.stack([m * np.sqrt((1 - p) / 2), m * np.sqrt((1 + p) / 2)], 1).astype(np.float32)


def fft_filter(x, H_of_f):
    n = len(x); m = 1 << (n - 1).bit_length()
    f = np.fft.rfftfreq(m, 1 / SR) + 1e-3
    Hf = H_of_f(f)
    if x.ndim == 1: return np.fft.irfft(np.fft.rfft(x, m) * Hf, m)[:n].astype(np.float32)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], m) * Hf, m)[:n] for c in range(x.shape[1])], 1).astype(np.float32)


def bp(x, lo, hi): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / hi) ** 6) / np.sqrt(1 + (lo / f) ** 6))
def lp(x, fc): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** 6))
def hp(x, fc): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** 6))


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.05, total=None):
    t = np.arange(n) / SR; total = total or n / SR
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-3)))
    rel = np.clip((total - t) / r, 0, 1)
    return (e * rel).astype(np.float32)


def saw(f, n, fc=3000, detune=0.0, phase=None):
    t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    f = f * 2 ** (detune / 1200)
    ph = rng.uniform(0, 6.28) if phase is None else phase
    K = int(min(60, (SR / 2 - 200) / f))
    for k in range(1, K + 1):
        g = 1 / k / np.sqrt(1 + (k * f / fc) ** 4)
        if g < 1e-4: break
        out += g * np.sin(2 * np.pi * k * f * t + ph * k)
    return out


# ---------------- drums ----------------
def kick(gain=1.0):
    t = T(0.45); f = 46 + 110 * np.exp(-t * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
    click = hp(rng.standard_normal(len(t)).astype(np.float32) * np.exp(-t * 900), 1500) * 0.4
    return st(np.tanh((s + click) * 1.5) * 0.9 * gain)


def snare(gain=1.0):
    t = T(0.35)
    tone = (np.sin(2 * np.pi * 186 * t) + 0.5 * np.sin(2 * np.pi * 332 * t)) * np.exp(-t * 22) * 0.6
    nz = bp(rng.standard_normal(len(t)).astype(np.float32), 1200, 9000) * np.exp(-t * 15)
    return st((tone + nz * 0.9) * 0.7 * gain)


def clap(gain=1.0):
    t = T(0.35); x = np.zeros(len(t), np.float32)
    for d in (0, 0.011, 0.022):
        i = int(d * SR); x[i:] += np.exp(-(t[:len(t) - i]) * 60)
    x += np.exp(-t * 14) * 0.5
    return st(bp(rng.standard_normal(len(t)).astype(np.float32) * x, 900, 6000) * 0.6 * gain)


def hat(open_=False, gain=1.0):
    t = T(0.4 if open_ else 0.06)
    nz = bp(rng.standard_normal(len(t)).astype(np.float32), 6500, 15000) * np.exp(-t * (11 if open_ else 70))
    return st(nz * 0.35 * gain)


def tom(f0=110, gain=1.0):
    t = T(0.5); f = f0 * (0.75 + 0.25 * np.exp(-t * 12))
    return st(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.8 * gain)


def crash(gain=1.0):
    t = T(2.6)
    nz = bp(rng.standard_normal((len(t), 2)).astype(np.float32), 3000, 14000) * np.exp(-t * 1.6)[:, None]
    return nz * 0.28 * gain


def timpani(f=73.4, gain=1.0):
    t = T(2.5)
    s = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 2.2)
    s += lp(rng.standard_normal(len(t)).astype(np.float32) * np.exp(-t * 30), 400) * 0.6
    return st(s * 0.8 * gain)


# ---------------- tonal ----------------
def bass(n_midi, dur, gain=1.0, fc=900):
    n = int(dur * SR)
    s = saw(hz(n_midi), n, fc) * 0.9 + np.sin(2 * np.pi * hz(n_midi) * np.arange(n) / SR) * 0.6
    return st(np.tanh(s * env_adsr(n, 0.004, 0.12, 0.55, 0.03) * 1.3) * 0.55 * gain)


def keys(notes, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for m in notes:
        f = hz(m)
        out += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)) * np.exp(-t * 1.6)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    out *= trem * env_adsr(n, 0.005, 1.0, 1.0, 0.08)
    return pan(out * 0.16 * gain, -0.2) + pan(out * 0.12 * gain, 0.3)


def brass(notes, dur, gain=1.0, attack=0.012, fc=2600):
    n = int(dur * SR); out = np.zeros((n, 2), np.float32)
    e = env_adsr(n, attack, 0.22, 0.45, 0.08)
    for m in notes:
        for c, det in enumerate((-7, 7)):
            out[:, c] += saw(hz(m), n, fc, det) * e
    return np.tanh(out * 0.6) * 0.32 * gain


def strings_note(m, dur, gain=1.0):
    n = int(dur * SR)
    e = env_adsr(n, 0.004, 0.05, 0.3, 0.02)
    s = saw(hz(m), n, 3500) * e
    return pan(s * 0.18 * gain, 0.35)


def accordion(m, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros((n, 2), np.float32)
    f = hz(m)
    for c, det in enumerate((-9, 9)):
        ff = f * 2 ** (det / 1200)
        x = np.zeros(n, np.float32)
        for k, a in ((1, 1), (2, 0.5), (3, 0.55), (4, 0.25), (5, 0.3), (6, 0.12), (7, 0.15)):
            x += a * np.sin(2 * np.pi * k * ff * t)
        out[:, c] = x
    e = env_adsr(n, 0.02, 0.2, 0.8, 0.04) * (1 + 0.15 * np.sin(2 * np.pi * 6 * t))
    return out * e[:, None] * 0.11 * gain


def trombone(m, dur, gain=1.0, vib=False):
    n = int(dur * SR); t = np.arange(n) / SR
    f0 = hz(m) * (1 + (0.012 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.3) / 0.3, 0, 1) if vib else 0))
    f0 = f0 * (1 - 0.02 * np.exp(-t * 25))                     # scoop into the note
    ph = 2 * np.pi * np.cumsum(f0 * np.ones(n)) / SR
    wah = 350 + 1500 * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    out = np.zeros(n, np.float32)
    for k in range(1, 25):
        out += np.sin(k * ph) / k * 1 / np.sqrt(1 + (k * f0 / wah) ** 4)
    e = env_adsr(n, 0.03, 0.4, 0.85, 0.08)
    return st(np.tanh(out * e * 1.4) * 0.3 * gain)


def flybuzz(dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 205 + 35 * np.sin(2 * np.pi * 0.9 * t) + 18 * np.sin(2 * np.pi * 7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.zeros(n, np.float32)
    for k in range(1, 18): x += np.sin(k * ph) / k
    x = bp(x, 300, 4000) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.3 * t) ** 2)
    p = np.sin(2 * np.pi * 0.45 * t) * 0.8
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], 1).astype(np.float32) * 0.07 * gain


def noise_riser(dur, gain=1.0, lo=300, hi=9000):
    n = int(dur * SR); W = 2048; Hh = W // 2; win = np.hanning(W).astype(np.float32)
    nz = rng.standard_normal((n + W, 2)).astype(np.float32); out = np.zeros_like(nz)
    f = np.fft.rfftfreq(W, 1 / SR) + 1e-3
    for i in range(0, n, Hh):
        q = i / n; fc = lo * (hi / lo) ** (q ** 1.5)
        Hf = 1 / np.sqrt(1 + (f / (fc * 1.6)) ** 4) / np.sqrt(1 + ((fc / 1.6) / f) ** 4)
        for c in range(2): out[i:i + W, c] += np.fft.irfft(np.fft.rfft(nz[i:i + W, c] * win) * Hf, W) * win
    return out[:n] * (np.linspace(0, 1, n) ** 2)[:, None] * 0.6 * gain


def whoosh(dur=0.6, gain=1.0):
    n = int(dur * SR); W = 1024; Hh = W // 2; win = np.hanning(W).astype(np.float32)
    nz = rng.standard_normal((n + W, 2)).astype(np.float32); out = np.zeros_like(nz)
    f = np.fft.rfftfreq(W, 1 / SR) + 1e-3
    for i in range(0, n, Hh):
        q = i / n; fc = 500 + 4000 * np.sin(np.pi * q) ** 2
        Hf = 1 / np.sqrt(1 + (f / (fc * 1.5)) ** 4) / np.sqrt(1 + ((fc / 1.5) / f) ** 4)
        for c in range(2): out[i:i + W, c] += np.fft.irfft(np.fft.rfft(nz[i:i + W, c] * win) * Hf, W) * win
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out[:n] * e[:, None] * 0.5 * gain


# ---------------- bus utilities ----------------
def place(bus, x, t):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(len(bus), i + len(x))
    if j > i: bus[i:j] += x[:j - i]


def tv_lowpass(seg, fc0, fc1):
    n = len(seg); W = 4096; Hh = W // 4; win = np.hanning(W).astype(np.float32)
    pad = np.concatenate([np.zeros((W, 2), np.float32), seg, np.zeros((W, 2), np.float32)])
    out = np.zeros_like(pad); norm = np.zeros(len(pad), np.float32)
    f = np.fft.rfftfreq(W, 1 / SR) + 1e-3
    for i in range(0, len(pad) - W, Hh):
        q = np.clip((i - W / 2) / n, 0, 1); fc = fc0 * (fc1 / fc0) ** q
        Hf = 1 / np.sqrt(1 + (f / fc) ** 4)
        for c in range(2): out[i:i + W, c] += np.fft.irfft(np.fft.rfft(pad[i:i + W, c] * win) * Hf, W) * win
        norm[i:i + W] += win ** 2
    out = out / np.maximum(norm, 1e-3)[:, None]
    return out[W:W + n]


def tape_stop(bus, t0, dur):
    i0 = int(t0 * SR); n = int(dur * SR)
    seg = bus[i0:i0 + int(dur * SR * 1.2)].copy()
    u = np.linspace(0, 1, n); rate = (1 - u) ** 1.6
    pos = np.cumsum(rate); pos = pos / pos[-1] * (n * 0.45)
    out = np.stack([np.interp(pos, np.arange(len(seg)), seg[:, c]) for c in range(2)], 1).astype(np.float32)
    out *= (1 - u ** 3)[:, None]
    bus[i0:i0 + n] = out
    bus[i0 + n:] = 0


def scratch(src, dur=0.32):
    n = int(dur * SR); t = np.arange(n) / SR
    pos = len(src) * 0.5 + np.sin(2 * np.pi * 7.5 * t) * SR * 0.06 + t * SR * 0.3
    out = np.stack([np.interp(pos, np.arange(len(src)), src[:, c]) for c in range(2)], 1)
    out = bp(out.astype(np.float32), 300, 6000)
    return out * np.sin(np.pi * t / dur)[:, None] ** 0.5 * 1.4


# ---------------- the score ----------------
def score(length, flute):
    """flute: mono float32 at SR (cleaned flute recording). returns stereo music bus + fx bus"""
    mus = np.zeros((int(length * SR), 2), np.float32)
    fx = np.zeros_like(mus)

    # --- groove A: F 1.7 -> 13.6, 5 bars of 2.38 s (≈100.8 BPM)
    def groove(t0, bars, bar, chords, fill_last=True, gain=1.0, flute_seg=None):
        stp = bar / 16
        for b in range(bars):
            tb = t0 + b * bar; root, ch = chords[b % len(chords)]
            for s_ in (0, 6, 8) + ((10,) if b % 2 else ()):
                place(mus, kick(0.95 * gain), tb + s_ * stp)
            for s_ in (4, 12): place(mus, snare(0.75 * gain) + clap(0.25 * gain), tb + s_ * stp)
            for s_ in range(0, 16, 2):
                sw = stp * 0.18 if s_ % 4 == 2 else 0
                place(mus, hat(s_ == 14, 0.8 * gain if s_ % 4 == 0 else 0.55 * gain), tb + s_ * stp + sw)
            for s_, off, d in ((0, 0, 3), (6, 0, 2), (8, 0, 2), (11, 12, 2), (14, 7, 2)):
                place(mus, bass(root + off, d * stp * 0.95, 0.9 * gain), tb + s_ * stp)
            place(mus, keys(ch, bar * 0.5, gain), tb)
            place(mus, keys(ch, bar * 0.25, 0.7 * gain), tb + 10 * stp)
        if fill_last:
            tb = t0 + (bars - 1) * bar
            for k, s_ in enumerate((12, 13, 14, 15)): place(mus, tom(140 - 18 * k, 0.6 * gain), tb + s_ * stp)

    D2, F2, G2, A2, Bb1 = note('D2'), note('F2'), note('G2'), note('A2'), note('Bb1')
    CH_A = [(D2, [note('D4'), note('F4'), note('A4'), note('E5')]),
            (Bb1, [note('Bb3'), note('D4'), note('F4'), note('A4')]),
            (note('G1'), [note('Bb3'), note('D4'), note('F4'), note('A4')]),
            (D2, [note('A3'), note('D4'), note('F4'), note('E5')])]
    BAR_A = (13.6 - 1.7) / 5
    groove(1.7, 5, BAR_A, CH_A)
    # intro: flute phrase A + reverse cymbal into the drop
    rc = crash(0.9)[::-1][-int(1.6 * SR):]
    place(fx, rc, 1.7 - len(rc) / SR)
    place(mus, st(flute[: int(1.33 * SR)]) * np.linspace(0, 1, int(1.33 * SR))[:, None] ** 0.5 * 0.55, 0.2)
    place(mus, crash(0.7), 1.7)
    # Rafael's flute over the groove
    fl = flute[int(2.2 * SR): int(9.6 * SR)]
    fl = st(fl) * np.minimum(1, np.minimum(np.arange(len(fl)) / (0.3 * SR), (len(fl) - np.arange(len(fl))) / (0.8 * SR)))[:, None]
    place(mus, fl * 0.45, 2.9)
    # Dubi approaching: groove gets muffled
    a, b = int(11.3 * SR), int(13.6 * SR)
    mus[a:b] = tv_lowpass(mus[a:b], 9000, 350) * np.linspace(1, 0.7, b - a)[:, None]
    place(fx, noise_riser(2.2, 0.35, 200, 3000), 11.4)
    # --- freeze: scratch + dun dun DUNNN + accordion
    grab = mus[int(12.6 * SR): int(13.6 * SR)].copy()
    mus[int(13.6 * SR):] = 0
    place(fx, scratch(grab), 13.55)
    dm = [note('D3'), note('F3'), note('A3'), note('D4')]
    place(mus, brass(dm, 0.32, 1.1, 0.006) + timpani(hz(note('D2')), 0.8)[: int(0.32 * SR)], 13.6)
    place(mus, brass(dm, 0.32, 1.1, 0.006) + timpani(hz(note('D2')), 0.8)[: int(0.32 * SR)], 13.95)
    big = brass([note('D2'), note('D3'), note('F3'), note('A3'), note('Eb4')], 1.4, 1.35, 0.01)
    place(mus, big, 14.3); place(mus, timpani(hz(note('D2')), 1.2), 14.3); place(mus, crash(0.8), 14.3)
    stp = 60 / 168 / 2
    mel = ['A4', 'D5', 'E5', 'F5', 'E5', 'D5', 'C#5', 'D5', 'F5', 'A5', 'G5', 'F5', 'E5', 'D5']
    for k, nm in enumerate(mel):
        d = stp * (2.2 if k == len(mel) - 1 else 0.95)
        place(mus, accordion(note(nm), d, 1.0), 14.95 + k * stp)
    for k in range(0, len(mel), 3):    # oom-pah-pah
        place(mus, bass(note('D2') if (k // 3) % 2 == 0 else note('A1'), stp * 0.9, 0.5), 14.95 + k * stp)
        for j in (1, 2):
            place(mus, accordion(note('F4'), stp * 0.6, 0.45) + accordion(note('A4'), stp * 0.6, 0.45), 14.95 + (k + j) * stp)
    place(fx, flybuzz(3.0, 1.0), 13.7)
    # --- Dubi walks in shouting: pulse + heartbeat
    t = 16.8; gap = 0.75
    while t < 20.5:
        place(mus, kick(0.55), t); place(mus, kick(0.35), t + 0.16)
        place(mus, strings_note(note('D2'), 0.25, 0.8), t)
        t += gap; gap = max(0.42, gap * 0.9)
    place(mus, brass([note('D3'), note('Ab3'), note('D4')], 0.6, 1.1, 0.005), 20.6)
    place(fx, whoosh(0.5, 0.8), 20.65)
    # --- chase: 150 BPM from F 21.1 to 30.16
    BAR_C = 1.6; stc = BAR_C / 16; t0 = 21.1
    roots = [note('D2'), note('D2'), note('F2'), note('G2'), note('D2'), note('Bb1')]
    arps = [['D4', 'A3', 'F4', 'A3'], ['D4', 'A3', 'F4', 'A3'], ['F4', 'C4', 'A4', 'C4'], ['G4', 'D4', 'Bb4', 'D4'], ['D4', 'A3', 'F4', 'A3'], ['Bb3', 'F3', 'D4', 'F3']]
    for b in range(6):
        tb = t0 + b * BAR_C
        if tb > 30.16: break
        for s_ in (0, 4, 8, 12): place(mus, kick(1.0), tb + s_ * stc)
        for s_ in (4, 12): place(mus, snare(0.9), tb + s_ * stc)
        for s_ in (7, 15): place(mus, snare(0.25), tb + s_ * stc)
        for s_ in range(16): place(mus, hat(False, 0.6 if s_ % 2 == 0 else 0.35), tb + s_ * stc)
        r = roots[b]
        for s_ in range(0, 16, 2):
            place(mus, bass(r + (12 if s_ % 4 == 2 else 0), stc * 1.8, 1.0, 1300), tb + s_ * stc)
        for s_ in range(16):
            place(mus, strings_note(note(arps[b][s_ % 4]), stc * 0.9, 0.9), tb + s_ * stc)
        chord = [r + 12, r + 15 if b != 2 else r + 16, r + 19, r + 24]
        for s_, d in ((0, 0.35), (6, 0.18), (10, 0.18)):
            place(mus, brass(chord, d, 0.85, 0.008), tb + s_ * stc)
    for tc in (21.1, 24.06, 28.86):
        place(mus, crash(0.8), tc); place(fx, whoosh(0.45, 0.6), tc - 0.3)
    for k, s_ in enumerate((8, 10, 12, 13, 14, 15)):
        place(mus, tom(150 - 15 * k, 0.8), 24.06 - (16 - s_) * stc)
    # --- Dubi gets tired: tape stop, sad trombone, flies
    tape_stop(mus, 30.16, 0.7)
    for k, (nm, d) in enumerate((('A3', 0.42), ('G#3', 0.42), ('G3', 0.42), ('F#3', 1.5))):
        place(mus, trombone(note(nm), d, 1.0, vib=(k == 3)), 30.95 + k * 0.46)
    place(fx, flybuzz(3.3, 1.2), 30.4)
    # --- Rafael walks off: groove returns, flute on top
    groove(33.54, 3, BAR_A, CH_A, fill_last=False, gain=0.9)
    fl2 = flute[int(10.98 * SR): int(17.4 * SR)]
    fl2 = st(fl2) * np.minimum(1, np.minimum(np.arange(len(fl2)) / (0.3 * SR), (len(fl2) - np.arange(len(fl2))) / (1.5 * SR)))[:, None]
    place(mus, fl2 * 0.5, 34.0)
    # music ends with Rafael's walk: soft fade, then silence until the car chase
    a0, a1 = int(38.4 * SR), int(39.9 * SR)
    mus[a0:a1] *= np.linspace(1, 0, a1 - a0)[:, None] ** 1.5
    mus[a1:] = 0.0
    chase_score(mus, fx)
    return mus, fx


# ---------------- car chase: tense and serious ----------------
def braam(notes, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros((n, 2), np.float32)
    for m in notes:
        for c, det in enumerate((-9, 9)):
            out[:, c] += saw(hz(m), n, 900 + 1400 * np.exp(-0.0), det)
    e = (1 - np.exp(-t * 30)) * np.exp(-t * 0.7)
    out = lp(out * e[:, None], 1300)
    return np.tanh(out * 0.9) * 0.4 * gain


def taiko(f0=62, gain=1.0):
    t = T(1.2); f = f0 * (1 + 0.6 * np.exp(-t * 18))
    s_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    sk = lp(rng.standard_normal(len(t)).astype(np.float32) * np.exp(-t * 40), 1200) * 0.5
    return st(np.tanh((s_ + sk) * 1.4) * 0.8 * gain)


def tick(gain=1.0):
    t = T(0.05)
    return st(bp(rng.standard_normal(len(t)).astype(np.float32), 4000, 12000) * np.exp(-t * 120) * 0.5 * gain)


def pad_cluster(notes, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros((n, 2), np.float32)
    for m in notes:
        for c, det in enumerate((-6, 6)):
            out[:, c] += saw(hz(m), n, 1600, det) * (1 + 0.2 * np.sin(2 * np.pi * (5.5 + c) * t))
    e = np.clip(t / (dur * 0.7), 0, 1) ** 2 * np.clip((dur - t) / 0.15, 0, 1)
    return lp(out * e[:, None], 2500) * 0.06 * gain


def chase_score(mus, fx, t0=58.4, t1=79.23, passes=(63.41, 64.1, 69.73, 70.33), cuts=(60.25, 62.01, 63.21, 64.71, 66.24, 68.63, 69.43, 70.83, 71.73, 73.73, 76.73)):
    BPM = 128.0; beat = 60 / BPM; bar = 4 * beat; s16 = beat / 4
    nb = int((t1 - t0) / bar) + 1
    D1, D2, D3 = note('D1'), note('D2'), note('D3')
    # opening hit
    place(mus, braam([D1, D2, note('A2')], 4.0, 1.3), t0)
    place(mus, taiko(55, 1.3), t0); place(mus, crash(0.6), t0)
    place(fx, whoosh(0.4, 0.7), t0 - 0.15)          # after Rafael's last syllable, peaks on the cut
    prog = [D2, D2, note('Bb1'), note('C2'), D2, D2, note('Bb1'), note('A1'), D2, D2, note('Bb1'), note('A1')]
    for b in range(nb):
        tb = t0 + b * bar
        if tb >= t1 - 0.4: break
        root = prog[b % len(prog)]
        inten = min(1.0, 0.45 + b * 0.08)
        # ostinato: low strings 16ths, accents 3+3+2
        for k in range(16):
            acc = 1.0 if k in (0, 3, 6, 8, 11, 14) else 0.55
            m = root + 12 if k % 8 in (3, 6) else root + 12 + (0 if k % 2 == 0 else 0)
            place(mus, strings_note(m, s16 * 0.85, 0.9 * acc * inten), tb + k * s16)
        # pulse bass 8ths
        for k in range(8):
            place(mus, bass(root, beat / 2 * 0.9, 0.75 * inten, 500), tb + k * beat / 2)
        # clock ticks
        for k in range(16):
            place(mus, tick(0.7 if k % 4 == 0 else 0.4), tb + k * s16)
        # drums build in
        if b >= 1:
            for k in (0, 6, 10): place(mus, taiko(60, 0.9 * inten), tb + k * s16)
        if b >= 3:
            for k in (4, 12): place(mus, snare(0.55 * inten) + clap(0.3 * inten), tb + k * s16)
            for k in (0, 8): place(mus, kick(0.8 * inten), tb + k * s16)
        if b >= 4 and b % 2 == 0:
            place(mus, brass([root + 12, root + 15, root + 19], beat * 1.5, 0.7 * inten, 0.01, 1800), tb)
            place(mus, brass([root + 12, root + 15, root + 19], beat * 0.5, 0.55 * inten, 0.008, 1800), tb + 2.5 * beat)
        if b % 4 == 0:
            place(mus, pad_cluster([note('D3'), note('Eb3'), note('A3')], bar * 4, 1.0), tb)
        if b >= 6:
            for k in range(0, 16, 2): place(mus, strings_note(root + 36 + (1 if k % 4 == 2 else 0), s16 * 1.8, 0.35 * inten), tb + k * s16)
    for tc in cuts:
        place(fx, whoosh(0.35, 0.35), tc - 0.22)
    for tp in passes:
        place(fx, carpass(1.4, 1.0), tp - 0.7)
    # final hit and tail as the cars disappear
    th = t1 - 1.9
    a = int(th * SR); mus[a:] *= np.linspace(1, 0, len(mus) - a)[:, None] ** 3
    place(mus, braam([D1, D2, note('F2'), note('A2')], 3.0, 1.2), th)
    place(mus, taiko(50, 1.3), th); place(mus, crash(0.7), th)


def carpass(dur=1.4, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f = 95 * (1.12 - 0.24 / (1 + np.exp(-(u - 0.5) * 14)))      # doppler drop
    ph = 2 * np.pi * np.cumsum(f) / SR
    eng = np.zeros(n, np.float32)
    for k in range(1, 9): eng += np.sin(k * ph + k) / k * (1 + 0.3 * np.sin(2 * np.pi * 31 * t * k))
    nz = rng.standard_normal(n).astype(np.float32)
    road = bp(nz, 300, 5000) * 0.5
    env = np.exp(-((u - 0.5) / 0.18) ** 2)
    p = np.tanh((u - 0.5) * 5)
    m = (lp(eng, 900) * 0.6 + road) * env
    return np.stack([m * np.sqrt((1 - p) / 2), m * np.sqrt((1 + p) / 2)], 1).astype(np.float32) * 0.6 * gain


def chime(gain=1.0):
    out = np.zeros((int(0.9 * SR), 2), np.float32)
    for k, (f, d) in enumerate(((1318.5, 0.0), (1760.0, 0.11))):
        t = T(0.9 - d)
        x = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 6) * np.clip(t / 0.004, 0, 1)
        out[int(d * SR):, :] += st(x)[: len(out) - int(d * SR)]
    return out * 0.25 * gain
