"""Sound design for the no-music stretch: Rafael walks to the car, Yahli's message, the pursuer pulls up.
Ambience + foley + spot FX only (the director asked for no music until the chase).
Real recordings come from sfx/lib (ESC-50 clips, CC BY-NC) and the clips' own sync sound; the rest is synthesized here."""
import numpy as np, wave, os, json

SR = 48000
D = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(D, 'sfx', 'lib')
rng = np.random.default_rng(11)


def T(n): return np.arange(int(n * SR)) / SR
def db(v): return 10 ** (v / 20)
def st(m): return np.stack([m, m], 1).astype(np.float32)


def pan(m, p):  # p in [-1, 1], equal power
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], 1).astype(np.float32)


def fft_filter(x, H_of_f):
    n = len(x); m = 1 << int(np.ceil(np.log2(n + 1)))
    f = np.fft.rfftfreq(m, 1 / SR); f[0] = 1e-3
    X = np.fft.rfft(x, m, axis=0)
    H = H_of_f(f)
    return np.fft.irfft(X * (H[:, None] if X.ndim == 2 else H), m, axis=0)[:n].astype(np.float32)


def lp(x, fc, o=3): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * o)))
def hp(x, fc, o=3): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * o)))
def bp(x, lo, hi, o=3): return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / hi) ** (2 * o)) / np.sqrt(1 + (lo / f) ** (2 * o)))


def peak_eq(x, f0, gain_db, q=1.0):
    g = db(gain_db) - 1
    return fft_filter(x, lambda f: 1 + g / (1 + ((f / f0 - f0 / f) * q) ** 2))


def load(path, mono=False):
    w = wave.open(path); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    x = x.reshape(-1, w.getnchannels())
    if sr != SR:
        pos = np.arange(0, len(x) - 1, sr / SR)
        x = np.stack([np.interp(pos, np.arange(len(x)), x[:, k]) for k in range(x.shape[1])], 1).astype(np.float32)
    if mono: return x.mean(1)
    return x if x.shape[1] == 2 else np.repeat(x, 2, 1)


def fade(x, fin=0.0, fout=0.0):
    x = x.copy(); n = len(x)
    if fin > 0:
        k = min(n, int(fin * SR)); r = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
        x[:k] *= r[:, None] if x.ndim == 2 else r
    if fout > 0:
        k = min(n, int(fout * SR)); r = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
        x[n - k:] *= r[:, None] if x.ndim == 2 else r
    return x


def place(bus, x, t):
    if x.ndim == 1: x = st(x)
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(len(bus), i + len(x))
    if j > i: bus[i:j] += x[: j - i]


def loop_to(x, n, xf=0.4):
    """repeat x (with equal-power crossfades) to length n"""
    k = int(xf * SR); out = np.zeros((n,) + x.shape[1:], np.float32); pos = 0
    up = np.sin(np.linspace(0, np.pi / 2, k)); dn = np.cos(np.linspace(0, np.pi / 2, k))   # noise beds: equal power
    if x.ndim == 2: up, dn = up[:, None], dn[:, None]
    seg = x.copy(); first = True
    while pos < n:
        s = seg.copy()
        if not first: s[:k] *= up
        s[-k:] *= dn
        j = min(n, pos + len(s)); out[pos:j] += s[: j - pos]
        pos += len(s) - k; first = False
    return out


# ---------------- synthesized elements ----------------
def room_tone(dur, gain=1.0):
    """closed car, engine off: soft low rumble of the world outside + cabin air"""
    n = int(dur * SR)
    b = np.cumsum(rng.standard_normal((n, 2)), 0); b -= lp(b, 2.0)
    b = lp(b, 220) / (np.abs(b).max() + 1e-9)
    air = lp(bp(rng.standard_normal((n, 2)), 200, 1500), 700, 1) * 0.12
    return (b * 0.6 + air) * gain


def phone_buzz(gain=1.0, pulses=((0.0, 0.30), (0.42, 0.30))):
    """phone vibrating on the hand / leg: rough ~170 Hz motor buzz with a little rattle"""
    tot = max(a + d for a, d in pulses) + 0.05
    out = np.zeros(int(tot * SR), np.float32)
    for a, d in pulses:
        t = T(d); f = 172 + 6 * np.sin(2 * np.pi * 7 * t)
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = np.tanh(3.0 * np.sin(ph)) + 0.35 * np.sin(2 * ph + 0.5)
        x += 0.25 * bp(rng.standard_normal(len(t)), 1500, 6000) * (0.5 + 0.5 * np.sin(ph) ** 8)
        env = np.clip(t / 0.015, 0, 1) * np.clip((d - t) / 0.03, 0, 1)
        i = int(a * SR); out[i:i + len(t)] += (x * env).astype(np.float32)
    out = peak_eq(hp(out, 120), 340, 4, 1.2)
    return out / (np.abs(out).max() + 1e-9) * gain


def heartbeat(t_beats, gain=1.0):
    """lub-dub as a chest thud (not a kick drum): low sine body, 80-250 Hz thud noise, small jitter,
    plus a saturated 300-1200 Hz copy so it is still heard on phone speakers"""
    tot = t_beats[-1] + 0.9
    out = np.zeros(int(tot * SR), np.float32)
    for k, tb in enumerate(t_beats):
        tb = max(0.0, tb + rng.uniform(-0.02, 0.02))
        for off, f0, a in ((0.0, 55, 1.0), (0.25 + rng.uniform(-0.01, 0.01), 62, 0.6)):
            t = T(0.32)
            f = f0 * (1 + 0.08 * np.exp(-t * 40))
            ph = 2 * np.pi * np.cumsum(f) / SR
            x = 0.5 * (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.exp(-t * 18) * np.clip(t / 0.008, 0, 1)
            x += bp(rng.standard_normal(len(t)), 80, 250) * np.exp(-t * 30) * np.clip(t / 0.004, 0, 1) * 1.2
            x = fade(x, 0, 0.12)
            i = int((tb + off) * SR); out[i:i + len(t)] += (x * a * rng.uniform(0.9, 1.0)).astype(np.float32)
    out = fade(lp(out, 700), 0.005, 0.2)
    out /= np.abs(out).max() + 1e-9
    sat = np.tanh(6 * out)
    phone = bp(sat, 300, 1200, 2); phone2 = bp(sat, 600, 1500, 2)
    out = out + phone / (np.abs(phone).max() + 1e-9) * db(-6) + phone2 / (np.abs(phone2).max() + 1e-9) * db(-3)
    return out / (np.abs(out).max() + 1e-9) * gain


def tink(f0=None, dur=0.25, gain=1.0):
    f0 = f0 or rng.uniform(2300, 4200)
    t = T(dur); x = np.zeros(len(t), np.float32)
    for r, a, dk in ((1.0, 1.0, 22), (2.76, 0.6, 30), (5.40, 0.35, 45), (8.93, 0.2, 60)):
        x += a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6.28)) * np.exp(-t * dk * rng.uniform(0.8, 1.3))
    x *= np.clip(t / 0.0008, 0, 1)
    return fade(lp(x, 11000), 0, 0.06) * gain


def keys_jingle(dur=0.5, density=28, gain=1.0):
    n = int((dur + 0.3) * SR); out = np.zeros(n, np.float32)
    for _ in range(max(2, int(density * dur))):
        tt = abs(rng.normal(dur * 0.35, dur * 0.3)); tt = min(tt, dur)
        x = tink(dur=0.22, gain=rng.uniform(0.25, 1.0)); i = int(tt * SR)
        j = min(n, i + len(x)); out[i:j] += x[: j - i]
    out += bp(rng.standard_normal(n), 3000, 9000) * 0.05 * np.exp(-np.arange(n) / SR / max(0.1, dur))
    return out / (np.abs(out).max() + 1e-9) * gain


def unlock_chirp(gain=1.0):
    """remote unlock: two short chirps from the car + the lock actuators"""
    out = np.zeros(int(0.9 * SR), np.float32)
    for k, a in enumerate((0.0, 0.16)):
        t = T(0.075); f = 2150 - 250 * t / 0.075                       # electronic: square-ish, slight downward sweep
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = np.sign(np.sin(ph)) * 0.6 + np.sin(ph)
        x *= np.clip(t / 0.004, 0, 1) * np.clip((0.075 - t) / 0.01, 0, 1)
        i = int(a * SR); out[i:i + len(t)] += x.astype(np.float32)
    out = lp(out, 5000) * 0.5
    t = T(0.12); thk = fade(np.sin(2 * np.pi * 140 * t) * np.exp(-t * 45) + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 60) * 0.6, 0, 0.04)
    i = int(0.34 * SR); out[i:i + len(t)] += thk.astype(np.float32) * 0.7
    return out / (np.abs(out).max() + 1e-9) * gain


def door_thump(gain=1.0):
    """low body of a car door shutting (layer under the real/latch sound)"""
    t = T(0.6)
    f = 68 * (1 + 0.6 * np.exp(-t * 30))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.5 * np.sin(2.03 * ph) + 0.25 * np.sin(3.1 * ph)) * np.exp(-t * 11) * np.clip(t / 0.002, 0, 1)
    x += lp(rng.standard_normal(len(t)), 500) * np.exp(-t * 28) * 0.8
    x += bp(rng.standard_normal(len(t)), 1800, 7000) * np.exp(-t * 90) * 0.35        # latch
    rattle = bp(rng.standard_normal(len(t)), 900, 3000) * np.exp(-((t - 0.05) / 0.05) ** 2) * 0.12
    x = fade(x + rattle, 0, 0.25)
    return x / (np.abs(x).max() + 1e-9) * gain


def cloth(dur=0.6, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.zeros(n); k = 0
    while k < 4:
        c = rng.uniform(0.1, 0.9) * dur; w = rng.uniform(0.05, 0.18) * dur
        env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2); k += 1
    x = bp(rng.standard_normal(n), 900, 7000) * env
    x = peak_eq(x, 2500, -4, 0.8)
    return fade(x / (np.abs(x).max() + 1e-9), 0.02, 0.05).astype(np.float32) * gain


def starter_and_catch(crank=0.75, gain=1.0):
    """starter motor cranking ~8 Hz compression pulses, the engine catches, flares and settles to idle (~27 Hz firing)"""
    tot = crank + 2.6; n = int(tot * SR); t = np.arange(n) / SR
    # firing / compression frequency over time
    f = np.where(t < crank, 8.5 + 1.5 * t / crank,
                 27 + 22 * np.exp(-(t - crank) / 0.35) * np.clip((t - crank) / 0.08, 0, 1))
    ph = np.cumsum(f) / SR
    pulse = (np.cos(2 * np.pi * ph) * 0.5 + 0.5) ** 6
    eng = np.zeros(n, np.float32)
    # each firing excites exhaust/body resonances -> filtered noise + harmonic body
    nz = rng.standard_normal(n).astype(np.float32)
    body = bp(nz * pulse, 60, 700) * 1.2
    harm = sum(np.sin(2 * np.pi * k * ph + k) / k for k in range(1, 7))
    caught = np.clip((t - crank) / 0.06, 0, 1)
    eng += (body * (0.5 + 0.5 * caught) + lp(harm, 400) * 0.6 * caught).astype(np.float32)
    # starter motor whine + gear grind only while cranking
    wph = 2 * np.pi * np.cumsum(820 + 60 * np.sin(2 * np.pi * ph)) / SR
    whine = (np.sin(wph) * 0.5 + np.sin(2 * wph) * 0.25) * (t < crank) * np.clip(t / 0.03, 0, 1)
    grind = bp(nz, 1200, 5000) * pulse * (t < crank) * 0.5
    eng += lp(whine, 3000).astype(np.float32) * 0.35 + grind.astype(np.float32)
    # the 'vroom' of the catch: upper-mid growl so it reads on small speakers
    growl = bp(nz * pulse, 250, 1400) * caught * (0.4 + 0.8 * np.exp(-(t - crank) / 0.5))
    eng += growl.astype(np.float32)
    eng = fade(eng, 0.01, 0.0)
    return eng / (np.abs(eng).max() + 1e-9) * gain


def idle_synth(dur, gain=1.0, rpm=820):
    n = int(dur * SR); t = np.arange(n) / SR
    f = rpm / 60 * 2 * (1 + 0.01 * np.sin(2 * np.pi * 0.7 * t))
    ph = np.cumsum(f) / SR
    pulse = (np.cos(2 * np.pi * ph) * 0.5 + 0.5) ** 5
    nz = rng.standard_normal(n).astype(np.float32)
    x = bp(nz * pulse, 60, 600) + lp(sum(np.sin(2 * np.pi * k * ph) / k for k in range(1, 6)), 300) * 0.5
    x += bp(nz * pulse, 300, 1500) * 0.25
    return x / (np.abs(x).max() + 1e-9) * gain



# ---------------- the section ----------------
# F = seconds from the flashback start (edl). src -> F per shot:
def F5(s): return s + 39.5        # c5 src 0.30 -> F 39.80 (walk to the car)
def F6(s): return s + 46.9        # c6 src 0.20 -> F 47.10 (in the car, Yahli's message)
def F7(s): return s + 55.5        # c7 src 0.00 -> F 55.50 (the pursuer pulls up)
CUT7 = 55.52                      # first c7 frame
CHASE = 58.4
SLAM = F5(7.482)                  # door shuts (real slam onset, nudged to the frame the door seats)
MSG = (1.07, 3.23)                # c6 src: notification banners pop (see compose.py msg overlay)

STEPS = [0.30, 0.76, 1.28, 1.80, 2.32, 2.88, 3.38]   # heel strikes (pose: max stride separation); 0.30 = the cut
STEP_FILES = [5, 3, 2, 7, 4, 5, 6]
G = dict(amb=0.5, amb_in=-3.0, sync5=6.5, sync6=8.0, sync7=-7.0, step=-3.5, keys=-28.0, chirp=-19.0,
         slam=-1.0, thump=-9.0, latch=-6.0, slam_latch=-3.0, creak=-17.0, seat=-13.0, cloth=-16.0, room=-14.0,
         buzz=-17.0, heart=-8.0, crank=-11.0, catch=-3.0, flare=-12.0, idle=-13.0, other=-9.0)


def onset(x, frac=0.12):
    a = np.abs(x if x.ndim == 1 else x.mean(1)); return max(0, int(np.argmax(a > frac * a.max())) - int(0.004 * SR))


def lib(rel, mono=True): return load(os.path.join(LIB, rel), mono=mono)


def env_limit(x, thr_db, win=0.05, rel=0.25):
    """smooth RMS-envelope limiter (tames bird bursts / transients without pumping the rest)"""
    m = x if x.ndim == 1 else x.mean(1)
    k = int(win * SR); e = np.sqrt(np.convolve(m ** 2, np.ones(k) / k, 'same')) + 1e-9
    g = np.minimum(1.0, db(thr_db) / e)
    a = np.exp(-1 / (rel * SR)); gs = g.copy()
    for i in range(1, len(gs)): gs[i] = min(g[i], a * gs[i - 1] + (1 - a) * g[i])        # instant attack, slow release
    gs = np.convolve(gs, np.ones(int(0.01 * SR)) / int(0.01 * SR), 'same')
    return x * (gs[:, None] if x.ndim == 2 else gs)


def peak_limit(x, ceil_db, look=0.002, rel=0.06):
    """look-ahead peak limiter for a single stem (catches a lone transient before the master)"""
    from scipy.ndimage import minimum_filter1d
    a = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    k = int(look * SR)
    g = minimum_filter1d(np.minimum(1.0, db(ceil_db) / np.maximum(a, 1e-9)), 2 * k + 1)
    r = np.exp(-1 / (rel * SR))
    for i in range(1, len(g)): g[i] = min(g[i], r * g[i - 1] + (1 - r))
    g = np.convolve(g, np.ones(k) / k, 'same')
    return x * (g[:, None] if x.ndim == 2 else g)


def clipgain(x, t0, t1, g_db, ramp=0.015):
    """gain change on a window of a buffer (seconds relative to the buffer start)"""
    e = np.ones(len(x), np.float32); i0, i1 = int(t0 * SR), int(t1 * SR); r = max(1, int(ramp * SR))
    e[i0:i1] = db(g_db); e[max(0, i0 - r):i0] = np.linspace(1, db(g_db), i0 - max(0, i0 - r))
    e[i1:i1 + r] = np.linspace(db(g_db), 1, len(e[i1:i1 + r]))
    return x * (e[:, None] if x.ndim == 2 else e)


def film(t): return t - 39.6       # film seconds -> F


def chain(segs, xf=0.5):
    """join segments with equal-power crossfades"""
    out = segs[0]
    k = int(xf * SR); up = np.sin(np.linspace(0, np.pi / 2, k)); dn = np.cos(np.linspace(0, np.pi / 2, k))
    if out.ndim == 2: up, dn = up[:, None], dn[:, None]
    for sg in segs[1:]:
        out = np.concatenate([out[:-k], out[-k:] * dn + sg[:k] * up, sg[k:]])
    return out


def build(F0=39.3, F1=59.4):
    n = int((F1 - F0) * SR)
    sync = np.zeros((n, 2), np.float32); fx = np.zeros((n, 2), np.float32)
    def put(bus, x, f, g, p=0.0):
        if x.ndim == 1: x = pan(x, p)
        place(bus, x * db(g), f - F0)

    # --- outside: ambience bed (bird bursts tamed so the action reads) until the door shuts
    bed = lib('amb/amb_ext.wav', mono=False)
    lo = lp(bed, 1200, 4); hi = bed - lo
    hi = clipgain(env_limit(hi, -36.0), film(80.0) - 39.35, film(80.7) - 39.35, -8.0, 0.04)   # room for the unlock chirp
    bed_t = lo + hi
    ext = bed_t[: int((SLAM + 0.04 - 39.35) * SR)]
    put(fx, fade(ext, 0.5, 0.04), 39.35, G['amb'])
    # inside the closed car: the world through glass = breeze body only, no birds
    inner = chain([bed[int(9.6 * SR):], bed[: int(9.6 * SR)]], 0.5)
    inner = lp(inner, 1200, 4)[: int((CUT7 + 0.4 - SLAM) * SR)]
    put(fx, fade(inner, 0.4, 0.4), SLAM + 0.10, G['amb_in'])

    # --- real sync sound, cleaned (sfx/lib/raw)
    s5 = hp(lib('raw/c5_range.wav'), 140)                                                     # natural dynamics: events up, rumble bed down
    k = int((SLAM - 0.03 - F5(0.30)) * SR); s5 = fade(s5[:k], 0.15, 0.03)                  # the slam comes from its own file
    s5 = clipgain(s5, 82.86 - 79.40, 83.08 - 79.40, -9.0)                                   # camera-handling boom under the reach
    put(sync, peak_limit(s5, -6.0), F5(0.30), G['sync5'], 0.1)
    s6 = hp(lib('raw/c6_range_lev.wav'), 70) * db(G['sync6'])                                  # key foley up
    s6 = clipgain(s6, 94.400 - 86.70, 94.430 - 86.70, -8.0, 0.003)                            # the clack, before the limiter
    s6 = clipgain(s6, 94.76 - 86.70, 94.92 - 86.70, -5.0, 0.02)                               # key turn under the catch
    s6 = peak_limit(s6, -6.0, rel=0.010)
    put(sync, fade(s6, 0.03, 0.05), F6(0.20), 0.0, 0.15)
    s7 = lib('raw/c7_range_lev.wav')
    d7 = np.ones(len(s7), np.float32)
    d7[: int(0.12 * SR)] = db(-4)                                                             # room for the engine catch at the cut
    d7[int(0.12 * SR): int(0.30 * SR)] = np.linspace(db(-4), 1, int(0.30 * SR) - int(0.12 * SR))
    s7 = clipgain(s7 * d7, 95.56 - 95.10, 96.00 - 95.10, 5.0, 0.03)                           # his first words
    put(sync, fade(s7, 0.03, 0.08), F7(0.0), G['sync7'], 0.0)

    # --- footsteps (feet are never in frame: body bob / stride drive the timing)
    for idx, (t, k) in enumerate(zip(STEPS, STEP_FILES)):
        st_ = peak_eq(peak_eq(lib(f'footsteps/step_{k:02d}.wav'), 2800, 3.5, 0.9), 2100, 5.0, 0.7)
        g = G['step'] - (4 if idx == 0 else 0)
        put(fx, st_ * rng.uniform(0.85, 1.0), F5(t) - 0.015, g, 0.12)
    put(fx, peak_eq(lib('footsteps/step_01.wav'), 2100, 4.0, 0.7) * 0.5, F5(3.79) - 0.015, G['step'], 0.1)   # feet come together at the car
    put(fx, lib('footsteps/step_06.wav') * 0.5, F5(4.66) - 0.015, G['step'], 0.05)          # steps back from the door
    put(fx, lib('footsteps/step_09.wav') * 0.5, F5(5.38) - 0.015, G['step'], 0.0)           # foot into the car
    put(fx, unlock_chirp(), F5(1.15), G['chirp'], -0.6)                                       # remote, car still off-screen left
    put(fx, keys_jingle(0.35, 30), F5(3.40), G['keys'] + 7, 0.0)                              # hand with keys reaching for the handle

    # --- door: handle, unlatch, hinge; sitting in
    put(fx, lib('foley/click_05.wav'), F5(3.90), G['latch'] - 4, 0.0)
    put(fx, lib('foley/latch_thunk_02.wav'), F5(3.964) - 0.01, G['latch'], 0.0)
    put(fx, lib('foley/creak_01.wav'), F5(4.16), G['creak'], 0.05)
    put(fx, lib('foley/creak_03.wav'), F5(5.72), G['seat'], 0.0)
    put(fx, cloth(0.55), F5(5.62), G['cloth'], 0.0)

    # --- the door shuts: real slam + heavier body + latch; the world is cut off
    sl = lib('raw/c5_7.502_door_slam.wav'); sl = sl[onset(sl):]
    put(fx, fade(peak_eq(sl, 2000, 3.0, 0.8), 0.0, 0.08), SLAM, G['slam'], 0.0)
    mid = bp(np.tanh(4 * sl / (np.abs(sl).max() + 1e-9)), 500, 2000, 2)
    put(fx, fade(mid / (np.abs(mid).max() + 1e-9) * np.abs(sl).max(), 0.0, 0.08), SLAM, G['slam'] - 6, 0.0)
    put(fx, door_thump(), SLAM, G['thump'], 0.0)
    lt = lib('foley/latch_thunk_03.wav'); lt = lt[onset(lt):]
    put(fx, lt, SLAM + 0.004, G['slam_latch'], 0.0)

    # --- inside the closed car
    rt = fade(room_tone(CUT7 + 0.5 - SLAM), 0.05, 0.4)
    put(fx, rt, SLAM, G['room'])
    for tm in MSG:                                                                             # Yahli's messages
        put(fx, phone_buzz(), F6(tm) - 0.02, G['buzz'], 0.25)
    # heartbeat: starts under the first message, races after 'run!', gone when he grabs the keys
    hb0, msg2, hb1 = F6(1.55), F6(MSG[1]), F6(6.75)
    beats = [hb0]
    while beats[-1] < hb1 - 0.5:
        beats.append(beats[-1] + (0.95 if beats[-1] < msg2 else max(0.66, 0.82 - 0.035 * sum(b > msg2 for b in beats))))
    hb = heartbeat([b - hb0 for b in beats])
    tt = hb0 + np.arange(len(hb)) / SR
    env = np.where(tt < msg2, 0.6, 1.0) * np.clip((tt - hb0) / 1.0, 0, 1) * np.clip((hb1 - tt) / 0.8, 0, 1)
    env = np.convolve(env, np.ones(2400) / 2400, 'same')
    put(fx, hb * env, hb0, G['heart'], 0.0)
    put(fx, keys_jingle(0.25, 26), F6(6.78), G['keys'] + 5, 0.2)
    put(fx, keys_jingle(0.45, 18), F6(8.40), G['keys'] + 4, 0.2)                              # keys dangling after the turn

    # --- engine: short crank right after the key turn, catches on the cut, idles
    t_turn = F6(8.34); t_catch = CUT7; crank = t_catch - (t_turn + 0.03)
    sc = starter_and_catch(crank)
    put(fx, lp(fade(sc[: int((crank + 0.04) * SR)], 0.01, 0.04), 3500), t_turn + 0.03, G['crank'], 0.0)
    ru = lib('raw/c7_3.95_engine_runup_OUTSIDE_RANGE.wav')                                    # his own engine, from later in c7
    ru = peak_eq(hp(fade(ru[: int(0.8 * SR)], 0.02, 0.45), 50, 4), 1200, 8.0, 0.7)
    put(fx, ru, t_catch, G['catch'], 0.0)
    flare = sc[int(crank * SR): int((crank + 1.2) * SR)]
    fl = hp(fade(lp(flare, 1800), 0.02, 0.8), 50, 4)
    fe = np.ones(len(fl), np.float32); a, b = int(0.6 * SR), int(0.9 * SR)
    fe[:a] = db(8); fe[a:b] = np.linspace(db(8), 1, b - a)
    put(fx, fl * fe, t_catch, G['flare'], 0.0)
    idl = lib('engine/idle_loop.wav')
    idl = loop_to(idl, int((CHASE + 0.6 - t_catch) * SR), 0.3)
    idl = hp(lp(idl, 1600), 50, 4)
    put(fx, fade(idl, 0.25, 0.6), t_catch + 0.1, G['idle'], 0.0)

    # --- the other car: faintly heard coming while he turns the key, then right beside him (window open)
    oc = lib('engine/car_approach_alt_steady.wav')
    pre = hp(lp(oc[: int(1.3 * SR)], 700, 4), 50, 4)
    put(fx, fade(pre, 0.5, 0.1), CUT7 - 1.3, -10.0, 0.6)
    oc2 = peak_eq(hp(lp(oc[int(1.3 * SR): int(4.8 * SR)], 4500), 60, 4), 1500, 4.0, 0.8)
    tt2 = np.arange(len(oc2)) / SR
    e = np.where(tt2 < 0.35, db(-6), db(-6) + (1 - db(-6)) * np.clip((tt2 - 0.35) / 0.2, 0, 1))     # the catch is heard first
    put(fx, fade(oc2 * e, 0.08, 0.5), CUT7, G['other'], 0.55)

    # make room for the voices in c7: the other driver 95.64-96.61 (-9 dB), Rafael 96.84-98.05 (-5 dB)
    du = np.ones(n, np.float32); r = int(0.12 * SR)
    def duck(fa, fb, g):
        i0, i1 = int((fa - F0) * SR), int((fb - F0) * SR)
        seg = np.full(i1 - i0, db(g), np.float32); seg[:r] = np.linspace(1, db(g), r); seg[-r:] = np.linspace(db(g), 1, r)
        du[i0:i1] = np.minimum(du[i0:i1], seg)
    duck(film(95.45), film(95.95), -12.0); duck(film(95.95), film(96.61), -9.0); duck(film(96.55), film(98.0), -7.0)
    fx *= du[:, None]
    lift = np.full(n, db(2.0), np.float32); i = int((55.3 - F0) * SR); k = int(0.3 * SR)
    lift[i:i + k] = np.linspace(db(2.0), 1, k); lift[i + k:] = 1
    fx *= lift[:, None]; sync *= lift[:, None]
    # hand over to the chase
    j = int((CHASE + 0.15 - F0) * SR); m = int(0.5 * SR)
    fx[j:j + m] *= np.linspace(1, 0, m)[:, None] ** 2; fx[j + m:] = 0
    sync[j + m:] = 0
    fx = hp(fx, 35, 4)
    return sync, fx, F0


if __name__ == '__main__':
    out = os.path.join(D, 'sfx', 'synth'); os.makedirs(out, exist_ok=True)
    def wr(name, x):
        x = np.asarray(x, np.float32)
        if x.ndim == 1: x = st(x)
        x = x / (np.abs(x).max() + 1e-9) * 0.89
        w = wave.open(os.path.join(out, name), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
    wr('room_tone.wav', room_tone(4)); wr('phone_buzz.wav', phone_buzz()); wr('heartbeat.wav', heartbeat([0, 0.85, 1.65, 2.42]))
    wr('keys.wav', keys_jingle(0.6)); wr('unlock.wav', unlock_chirp()); wr('door_thump.wav', door_thump())
    wr('cloth.wav', cloth()); wr('starter.wav', starter_and_catch()); wr('idle.wav', idle_synth(3))
    sy, f, F0 = build(); wr('section_sync.wav', sy); wr('section_fx.wav', f)
    w = wave.open(os.path.join(out, 'section_mix.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(sy + f * db(-2), -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    print('ok', len(sy) / SR)
