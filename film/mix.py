import numpy as np, wave, sys, os

SR = 48000
D = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

# ---- timeline (must match compose.py) ----
FL_OFF = 1.0        # flute src 0 -> T 1.0
FL_END = 21.6       # flute src end used
TALK_OFF = 25.0     # talk src 0 -> T 25.0
LINE_END = 9.30     # talk src: end of "...היה פעם"
REW0, REW1 = 9.4, 10.4   # talk-relative: rewind window
FLASH = TALK_OFF + REW1  # white flash
FB_START = TALK_OFF + 14.6
sys.path.insert(0, D)
import edl
FB_LEN = edl.FB_LEN
TOTAL = FB_START + FB_LEN
N = int(TOTAL * SR)

def load(path):
    w = wave.open(path)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    x = x.reshape(-1, w.getnchannels())
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x

def db(v): return 10 ** (v / 20)

def fade(x, fin=0.0, fout=0.0):
    x = x.copy(); n = len(x)
    if fin > 0:
        k = min(n, int(fin * SR)); x[:k] *= np.linspace(0, 1, k)[:, None] ** 2
    if fout > 0:
        k = min(n, int(fout * SR)); x[n - k:] *= np.linspace(1, 0, k)[:, None] ** 2
    return x

def place(bus, x, t):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(len(bus), i + len(x))
    bus[i:j] += x[:j - i]

def fftconv(x, ir):
    n = len(x) + len(ir) - 1; m = 1 << (n - 1).bit_length()
    out = np.zeros((n, 2), np.float32)
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], m) * np.fft.rfft(ir[:, c], m), m)[:n]
    return out

def make_ir(rt60=2.8, pre=0.02, bright=0.5):
    n = int((rt60 + pre) * SR); t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60)
    ir = rng.standard_normal((n, 2)).astype(np.float32) * env[:, None]
    # darken tail: one-pole lowpass whose cutoff falls over time (approx by blending)
    lp = ir.copy()
    a = 0.6 + 0.35 * (1 - bright)
    for c in range(2):
        y = 0.0; col = lp[:, c]
        # vectorised one-pole via cumulative filter on blocks
        col[:] = onepole(col, a)
    mix = np.clip(t / rt60 * 2, 0, 1)[:, None]
    ir = ir * (1 - mix) + lp * mix
    ir[: int(pre * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir

def onepole(x, a):
    # y[n] = (1-a) x[n] + a y[n-1]
    y = np.empty_like(x); acc = 0.0; b = 1 - a
    for i in range(0, len(x), 8192):
        seg = x[i:i + 8192]
        out = np.empty_like(seg)
        for k in range(len(seg)):
            acc = b * seg[k] + a * acc; out[k] = acc
        y[i:i + 8192] = out
    return y

def lowpass(x, fc):
    # FFT brickwall-ish smooth lowpass
    n = len(x); m = 1 << (n - 1).bit_length()
    f = np.fft.rfftfreq(m, 1 / SR); H = 1 / np.sqrt(1 + (f / fc) ** 8)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], m) * H, m)[:n] for c in range(x.shape[1])], 1).astype(np.float32)

def bandpass(x, lo, hi):
    n = len(x); m = 1 << (n - 1).bit_length()
    f = np.fft.rfftfreq(m, 1 / SR) + 1e-3
    H = 1 / np.sqrt(1 + (f / hi) ** 6) * 1 / np.sqrt(1 + (lo / f) ** 6)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], m) * H, m)[:n] for c in range(x.shape[1])], 1).astype(np.float32)

def stereo(m): return np.stack([m, m], 1).astype(np.float32)

# ---- synthesis ----
ROOT = 295.03 / 4   # flute tonic D (measured ~D4 +8c) -> D2

def drone(dur, root=ROOT):
    t = np.arange(int(dur * SR)) / SR
    sig = np.zeros((len(t), 2), np.float32)
    parts = [(1, 0.55), (1.5, 0.28), (2, 0.30), (3, 0.10), (4, 0.06), (0.5, 0.35)]
    for mul, amp in parts:
        for c, det in enumerate((-0.15, 0.15)):
            f = root * mul + det * mul
            lfo = 1 + 0.25 * np.sin(2 * np.pi * (0.07 + 0.03 * mul) * t + c + mul)
            sig[:, c] += amp * lfo * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    air = lowpass(stereo(rng.standard_normal(len(t))) * 0.05, 700)
    return (sig * 0.22 + air).astype(np.float32)

def boom(dur=4.5, f0=62, f1=30, gain=1.0):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 3.0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t * 1.1)
    sub = np.tanh(sub * 1.6) * 0.8
    att = int(0.004 * SR); sub[:att] *= np.linspace(0, 1, att)
    nz = rng.standard_normal(len(t)) * np.exp(-t * 7)
    body = lowpass(stereo(nz), 900)[:, 0] * 0.9
    crack = bandpass(stereo(rng.standard_normal(len(t)) * np.exp(-t * 30)), 1500, 7000)[:, 0] * 0.35
    m = stereo(sub + body + crack)
    return m * gain

def braam(dur=5.0, gain=1.0):
    # brassy low hit: sawtooth stack on D, lowpassed, with fast attack
    t = np.arange(int(dur * SR)) / SR
    x = np.zeros((len(t), 2), np.float32)
    for mul in (0.5, 1, 1.5, 2):
        for c, det in enumerate((-0.6, 0.6)):
            f = ROOT * mul + det
            saw = 2 * ((f * t + rng.uniform()) % 1) - 1
            x[:, c] += saw * (0.5 if mul < 2 else 0.25)
    env = (1 - np.exp(-t * 40)) * np.exp(-t * 0.9)
    x = lowpass(x * env[:, None], 1100) * 0.35
    return x * gain

def tv_band(n, fc_of_p, width=1.6):
    # time-varying band-passed noise via windowed overlap-add
    W = 2048; H = W // 2; win = np.hanning(W).astype(np.float32)
    nz = rng.standard_normal((n + W, 2)).astype(np.float32)
    out = np.zeros((n + W, 2), np.float32)
    f = np.fft.rfftfreq(W, 1 / SR) + 1e-3
    for i in range(0, n, H):
        fc = fc_of_p(i / n)
        Hf = 1 / np.sqrt(1 + (f / (fc * width)) ** 4) / np.sqrt(1 + ((fc / width) / f) ** 4)
        for c in range(2):
            out[i:i + W, c] += np.fft.irfft(np.fft.rfft(nz[i:i + W, c] * win) * Hf, W) * win
    return out[:n] * 0.7

def riser(dur, gain=1.0, f_lo=300, f_hi=6000):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    out = tv_band(n, lambda q: f_lo * (f_hi / f_lo) ** (q ** 1.6))
    tone = np.sin(2 * np.pi * np.cumsum(ROOT * 4 * (1 + p ** 2)) / SR) * 0.15
    out = out * 0.7 + stereo(tone)
    env = p ** 2.2
    return out * env[:, None] * gain

def whoosh(dur=1.2, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    out = tv_band(n, lambda q: 400 + 3500 * np.sin(np.pi * q) ** 2, 1.4)
    env = np.sin(np.pi * p) ** 2
    pan = np.stack([1 - 0.5 * p, 0.5 + 0.5 * p], 1)
    return out * env[:, None] * pan * gain

def shimmer(dur=3.5, gain=1.0):
    t = np.arange(int(dur * SR)) / SR
    x = np.zeros((len(t), 2), np.float32)
    for i, mul in enumerate((8, 12, 16, 24, 32)):
        f = ROOT * mul
        for c in range(2):
            x[:, c] += np.sin(2 * np.pi * (f + (c - 0.5) * 2) * t + i) * np.exp(-t * (1.0 + 0.3 * i)) / (1 + i * 0.5)
    att = int(0.01 * SR); x[:att] *= np.linspace(0, 1, att)[:, None]
    return x * 0.12 * gain

def crackle(dur, density=30, gain=1.0):
    n = int(dur * SR)
    x = np.zeros((n, 2), np.float32)
    k = rng.poisson(density * dur)
    pos = rng.integers(0, n - 200, k)
    for p in pos:
        L = rng.integers(10, 120); a = rng.uniform(0.05, 0.5) * rng.choice([-1, 1])
        x[p:p + L, :] += (a * np.exp(-np.arange(L) / (L / 4)) * rng.standard_normal(L))[:, None]
    hiss = bandpass(stereo(rng.standard_normal(n)) * 0.02, 1500, 8000)
    return (bandpass(x, 400, 9000) + hiss) * gain

# ---- build buses ----
music = np.zeros((N, 2), np.float32)
dia = np.zeros((N, 2), np.float32)
fx = np.zeros((N, 2), np.float32)

ir_big = make_ir(3.2, 0.03, 0.4)
ir_mid = make_ir(1.6, 0.015, 0.6)

# flute (opening): starts mid-note -> short fade in; plate-ish reverb
fl = load(os.path.join(D, 'audio/flute_clean.wav'))
fl_main = fade(fl[: int(FL_END * SR)], 0.25, 0.4)
fl_wet = fftconv(fl_main, ir_big)
fl_bus = np.zeros((len(fl_wet), 2), np.float32)
fl_bus[: len(fl_main)] += fl_main * 0.85
fl_bus += fl_wet * 0.30
place(music, fl_bus * db(5), FL_OFF)

# drone under opening
dr = fade(drone(25.0), 3.0, 2.5)
place(music, dr * db(-12), 0.0)
# low drone continues very quietly under the dialog and swells into the flashback
dr2 = drone(TALK_OFF + REW1 - (TALK_OFF - 0.5) + 0.5)
env = np.ones(len(dr2), np.float32)
tt = np.arange(len(dr2)) / SR
env *= np.clip(tt / 1.5, 0, 1)                       # fade in
sw0 = (TALK_OFF + 6.6) - (TALK_OFF - 0.5)
env *= 0.35 + 0.65 * np.clip((tt - sw0) / 3.5, 0, 1) ** 2   # swell during the line
env *= np.clip((tt[-1] - tt) / 0.6, 0, 1)
place(music, dr2 * env[:, None] * db(-20), TALK_OFF - 0.5)

# opening film crackle in the dark
place(fx, fade(crackle(3.0, 15, 0.5), 0.5, 1.5), 0.0)

# logo: boom + braam at 3.2, soft whoosh for light sweep at 4.6
place(fx, boom(5.0, 58, 30, 0.75), 3.2)
bl = braam(4.0, 0.6)
place(fx, np.pad(bl, ((0, len(ir_mid) - 1), (0, 0))) + fftconv(bl, ir_mid) * 0.6, 3.2)
place(fx, whoosh(1.4, 0.18), 4.5)
place(fx, shimmer(3.0, 0.5), 4.7)

# title: riser 17.4 -> 19.4, then big hit
place(fx, riser(2.0, 0.35), 17.4)
place(fx, boom(6.0, 70, 28, 0.9), 19.4)
bh = braam(5.5, 0.8)
place(fx, bh + fftconv(bh, ir_big)[: len(bh)] * 0.5, 19.4)
place(fx, shimmer(4.0, 0.6), 19.45)

# dialog
tk = load(os.path.join(D, 'audio/talk_clean.wav'))
line = fade(tk[: int(LINE_END * SR)], 0.12, 0.08)
place(dia, line * db(0.5), TALK_OFF)

# echo on the last word ("פעם")
w0, w1 = 8.62, 9.25
word = fade(tk[int(w0 * SR): int(w1 * SR)], 0.02, 0.12) * db(0.5)
for i, (dly, g) in enumerate([(0.55, 0.55), (1.05, 0.36), (1.5, 0.22)]):
    e = word
    e = lowpass(e, 3500 - i * 900)
    wet = fftconv(e, ir_big)
    pan = np.array([[1 - 0.3 * (i % 2), 0.7 + 0.3 * (i % 2)]], np.float32)
    place(dia, (np.pad(e, ((0, len(wet) - len(e)), (0, 0))) * 0.7 + wet * 0.5) * g * pan, TALK_OFF + w0 + dly)

# flashback riser + reverse swell
place(fx, riser(REW1 - 7.2, 0.45, 200, 9000), TALK_OFF + 7.2)
sw = fftconv(fade(tk[int(6.8 * SR): int(9.25 * SR)], 0.05, 0.1), ir_big)[::-1]
sw = fade(sw[-int(2.2 * SR):], 1.5, 0.05)
place(fx, sw * db(-2), FLASH - 2.2)

# tape rewind: dialog reversed and sped up ~ 6-10x with a pitch sweep
rev = tk[: int(REW0 * SR)][::-1]
outn = int((REW1 - REW0) * SR)
u = np.linspace(0, 1, outn)
pos = (u ** 1.5) * (len(rev) - 1)
idx = pos.astype(int)
tape = rev[idx]
tape = bandpass(tape, 500, 5000) * (0.3 + 0.7 * u)[:, None]
place(fx, tape * db(-8), TALK_OFF + REW0)
place(fx, whoosh(1.1, 0.5), TALK_OFF + REW0 - 0.05)

# flash impact
place(fx, boom(5.0, 80, 32, 0.7), FLASH)
place(fx, shimmer(5.0, 1.0), FLASH)
place(fx, fftconv(shimmer(2.0, 0.8), ir_big) * 0.6, FLASH)

# vintage memory: flute reprise as an old record
rep = fl[int(2.2 * SR): int((2.2 + FB_START + 0.2 - FLASH - 0.4) * SR)]
rep = bandpass(rep, 450, 3200)
rep = rep + fftconv(rep, ir_big)[: len(rep)] * 0.45
rep = np.tanh(rep * 2.0) * 0.5
rep = fade(rep, 1.2, 1.0)
place(music, rep * db(-2), FLASH + 0.4)
place(fx, fade(crackle(FB_START + 0.3 - FLASH, 40, 0.45), 0.8, 0.6), FLASH)
pad = fade(drone(FB_START + 0.3 - FLASH, ROOT * 2), 1.5, 0.8)
place(music, lowpass(pad, 1200) * db(-24), FLASH)

# ---- flashback: the real film ----
sys.path.insert(0, D)
import fbmusic
place(fx, whoosh(1.0, 0.5), FB_START - 0.8)
place(fx, boom(4.0, 70, 30, 0.45), FB_START)
fmus, ffx = fbmusic.score(FB_LEN, fl[:, 0].copy())
place(music, fmus * db(-9.5), FB_START)
place(fx, ffx * db(-6), FB_START)
# sync sound from the clips, cut exactly like the picture
CLIPG = {1: db(9), 2: db(9), 3: db(13), 4: db(6), 5: db(14), 6: db(11), 7: db(3), 8: db(8), 9: db(6), 10: db(6)}
clips = {c: load(os.path.join(D, f'fb/audio/c{c}_clean.wav')) for c in (1, 2, 3, 4)}
clips.update({c: load(os.path.join(D, f'cc/audio/c{c}_clean.wav')) for c in (5, 6, 7, 8, 9, 10)})
CHASE0 = edl.shot('chase')['f0']
for sh in edl.FB_SHOTS:
    if 'freeze' in sh or sh.get('mute'): continue
    if sh['c'] in (5, 6) or sh.get('tag') == 'pursuer': continue      # carsfx carries their (cleaned) sync sound
    c, a, b, sp = sh['c'], sh['a'], sh['b'], sh['sp']
    seg = clips[c][int(a * SR): int(b * SR)]
    if sp != 1.0:
        pos = np.arange(0, len(seg) - 1, sp)
        seg = np.stack([np.interp(pos, np.arange(len(seg)), seg[:, k]) for k in range(2)], 1).astype(np.float32)
    seg = fade(seg, 0.012, 0.012) * CLIPG[c]
    if sh['f0'] >= CHASE0: seg = seg * db(-7)          # sync sound sits under the chase music
    place(dia, seg, FB_START + sh['f0'])
# walk to the car / Yahli's message / the pursuer: ambience, foley and spot FX (no music here)
import carsfx
cs_sync, cs_fx, cs_F0 = carsfx.build()
place(dia, cs_sync, FB_START + cs_F0)
place(fx, cs_fx, FB_START + cs_F0)
# Yahli's message: notification chimes
m = edl.shot('msg')
place(fx, fbmusic.chime(1.0) * db(-5), FB_START + m['f0'] + (carsfx.MSG[0] - m['a']))    # on the banner pop
place(fx, fbmusic.chime(1.2) * db(-4), FB_START + m['f0'] + (carsfx.MSG[1] - m['a']))
# duck the music while Dubi shouts
i0, i1 = int((FB_START + 17.3) * SR), int((FB_START + 21.0) * SR)
duck = np.ones(i1 - i0, np.float32); r = int(0.2 * SR)
duck[:] = 0.5; duck[:r] = np.linspace(1, 0.5, r); duck[-r:] = np.linspace(0.5, 1, r)
music[i0:i1] *= duck[:, None]
dia[int((FB_START + 16.8) * SR): int((FB_START + 21.8) * SR)] *= db(4)

# ---- master ----
mix = music * db(-1) + dia + fx * db(-2)
# gentle bus compression / limiting
peak = np.max(np.abs(mix))
rms = np.sqrt(np.mean(mix ** 2))
print('pre peak', peak, 'rms dB', 20 * np.log10(rms + 1e-9))
# peak limiter (block envelope, fast attack / smooth release), then gentle soft clip
blk = 240
pk = np.abs(mix).max(axis=1)
nb = len(pk) // blk + 1
bpk = np.array([pk[i * blk:(i + 1) * blk].max() if i * blk < len(pk) else 0 for i in range(nb)])
bpk = np.maximum(bpk, np.concatenate([bpk[1:], [0]]))          # one block look-ahead
g = np.minimum(1.0, 0.89 / np.maximum(bpk, 1e-6))
for i in range(1, nb):                                           # release ~80 ms
    g[i] = min(g[i], g[i - 1] + (1 - g[i - 1]) * 0.06)
gs = np.interp(np.arange(len(pk)), np.arange(nb) * blk + blk / 2, g)
mix = mix * gs[:, None]
mix = np.tanh(mix / 0.95) * 0.95
# fade ends
k = int(0.5 * SR); mix[-k:] *= np.linspace(1, 0, k)[:, None]
out = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
w = wave.open(os.path.join(D, 'audio/mix.wav'), 'wb')
w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('wrote', len(out) / SR, 's')
