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
    up = np.sin(np.linspace(0, np.pi / 2, k)) ** 2; dn = 1 - up
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
    air = bp(rng.standard_normal((n, 2)), 300, 2500) * 0.02
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
    """lub-dub; the 'lub' has some 90-220 Hz body so it survives small speakers"""
    tot = t_beats[-1] + 0.8
    out = np.zeros(int(tot * SR), np.float32)
    for k, tb in enumerate(t_beats):
        for off, f0, a in ((0.0, 52, 1.0), (0.26, 60, 0.62)):
            t = T(0.32)
            f = f0 * (1 + 0.5 * np.exp(-t * 40))
            ph = 2 * np.pi * np.cumsum(f) / SR
            x = (np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.22 * np.sin(3.1 * ph)) * np.exp(-t * 16) * np.clip(t / 0.006, 0, 1)
            x += lp(rng.standard_normal(len(t)), 260) * np.exp(-t * 35) * 0.5
            x = fade(x, 0, 0.12)
            i = int((tb + off) * SR); out[i:i + len(t)] += (x * a).astype(np.float32)
    out = fade(lp(out, 600), 0.005, 0.2)
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
        t = T(0.075); f = 2650
        x = np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t)
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
CHASE = 58.4
SLAM = F5(7.502)                  # door shuts (real slam onset in the sync sound)

STEPS = [0.80, 1.28, 1.80, 2.32, 2.88, 3.38]       # heel strikes (pose: max stride separation)
STEP_FILES = [3, 2, 7, 4, 5, 6]
G = dict(amb=2.0, amb_in=-1.0, sync5=-5.0, sync6=-1.0, sync7=-7.0, step=-11.0, keys=-28.0, chirp=-22.0,
         slam=-5.0, thump=-9.0, latch=-12.0, creak=-25.0, seat=-21.0, cloth=-25.0, room=-30.0,
         buzz=-17.0, heart=-13.0, crank=-11.0, catch=-9.0, idle=-16.0, other=-17.0)


def onset(x, frac=0.12):
    a = np.abs(x if x.ndim == 1 else x.mean(1)); return max(0, int(np.argmax(a > frac * a.max())) - int(0.004 * SR))


def lib(rel, mono=True): return load(os.path.join(LIB, rel), mono=mono)


def build(F0=39.3, F1=59.4):
    n = int((F1 - F0) * SR)
    sync = np.zeros((n, 2), np.float32); fx = np.zeros((n, 2), np.float32)
    def put(bus, x, f, g, p=0.0):
        if x.ndim == 1: x = pan(x, p)
        place(bus, x * db(g), f - F0)

    # --- outside: ambience bed until the door shuts, then the world goes muffled
    bed = lib('amb/amb_ext.wav', mono=False)
    ext = bed[: int((SLAM + 0.04 - 39.55) * SR)]
    put(fx, fade(ext, 0.35, 0.04), 39.55, G['amb'])
    muf = loop_to(np.roll(lp(bed, 3000, 2), -int(9.0 * SR), 0), int((CHASE + 0.6 - SLAM) * SR), 0.5)   # the world through closed windows (denser part of the bed)
    put(fx, fade(muf, 0.02, 0.5), SLAM, G['amb_in'])

    # --- real sync sound, cleaned (sfx/lib/raw): every real event of the shot
    s5 = hp(lib('raw/c5_range_lev.wav'), 140)
    k = int((7.47 - 0.30) * SR); s5 = fade(s5[:k], 0.15, 0.03)                 # the slam comes from its own file below
    put(sync, s5, F5(0.30), G['sync5'], 0.1)
    s6 = hp(lib('raw/c6_range_lev.wav'), 70)
    put(sync, fade(s6, 0.03, 0.05), F6(0.20), G['sync6'], 0.15)
    s7 = lib('raw/c7_range_lev.wav')
    put(sync, fade(s7, 0.03, 0.08), F7(0.0), G['sync7'], 0.0)

    # --- footsteps + keys swinging in his hand
    for t, k in zip(STEPS, STEP_FILES):
        st_ = peak_eq(lib(f'footsteps/step_{k:02d}.wav'), 2800, 3.5, 0.9)
        put(fx, st_ * rng.uniform(0.85, 1.0), F5(t) - 0.015, G['step'], 0.12)
        put(fx, keys_jingle(0.18, 22), F5(t) + 0.02, G['keys'] + rng.uniform(-3, 0), -0.05)
    put(fx, lib('footsteps/step_01.wav') * 0.55, F5(3.72) - 0.015, G['step'], 0.1)        # slowing at the car
    put(fx, lib('footsteps/step_06.wav') * 0.5, F5(4.66) - 0.015, G['step'], 0.05)        # steps back from the door
    put(fx, lib('footsteps/step_09.wav') * 0.45, F5(5.38) - 0.015, G['step'], 0.0)        # foot into the car
    put(fx, unlock_chirp(), F5(2.45), G['chirp'], -0.45)                                    # remote: his car
    put(fx, keys_jingle(0.35, 30), F5(3.40), G['keys'] + 7, 0.0)                            # reaching for the handle

    # --- door: handle, unlatch, hinge; sitting in
    put(fx, lib('foley/click_05.wav'), F5(3.79), G['latch'] - 4, 0.0)
    put(fx, lib('foley/latch_thunk_02.wav'), F5(4.007) - 0.01, G['latch'], 0.0)
    put(fx, lib('foley/creak_01.wav'), F5(4.12), G['creak'], 0.05)
    put(fx, lib('foley/creak_03.wav'), F5(5.72), G['seat'], 0.0)
    put(fx, cloth(0.55), F5(5.62), G['cloth'], 0.0)

    # --- the door shuts: real slam + heavier body + latch
    sl = lib('raw/c5_7.502_door_slam.wav'); sl = sl[onset(sl):]
    put(fx, fade(sl, 0.0, 0.08), SLAM, G['slam'], 0.0)
    put(fx, door_thump(), SLAM, G['thump'], 0.0)
    lt = lib('foley/latch_thunk_03.wav'); lt = lt[onset(lt):]
    put(fx, lt, SLAM + 0.004, G['latch'] + 2, 0.0)

    # --- inside the closed car
    rt = fade(room_tone(CHASE + 0.6 - SLAM), 0.01, 0.4)
    put(fx, rt, SLAM, G['room'])
    for tm in (1.0, 3.2):                                                                  # Yahli's messages
        put(fx, phone_buzz(), F6(tm) - 0.02, G['buzz'], 0.25)
    # heartbeat: starts under the first message, races after 'run!', gone when he grabs the keys
    hb0, msg2, hb1 = F6(1.55), F6(3.2), F6(6.75)
    beats = [hb0]
    while beats[-1] < hb1 - 0.5:
        beats.append(beats[-1] + (0.95 if beats[-1] < msg2 else max(0.64, 0.80 - 0.04 * sum(b > msg2 for b in beats))))
    hb = heartbeat([b - hb0 for b in beats])
    tt = hb0 + np.arange(len(hb)) / SR
    env = np.where(tt < msg2, 0.6, 1.0) * np.clip((tt - hb0) / 1.0, 0, 1) * np.clip((hb1 - tt) / 0.8, 0, 1)
    env = np.convolve(env, np.ones(2400) / 2400, 'same')
    put(fx, hb * env, hb0, G['heart'], 0.0)
    put(fx, keys_jingle(0.25, 26), F6(6.78), G['keys'] + 5, 0.2)
    put(fx, keys_jingle(0.45, 18), F6(8.40), G['keys'] + 4, 0.2)                           # keys dangling after the turn

    # --- engine: starter right after the key turn, catches over the cut, idles
    t_turn = F6(8.34); crank = 0.42
    sc = starter_and_catch(crank)
    sc_crank = fade(sc[: int((crank + 0.05) * SR)], 0.01, 0.05)
    put(fx, lp(sc_crank, 3500), t_turn + 0.05, G['crank'], 0.0)
    t_catch = t_turn + 0.05 + crank
    ru = lib('raw/c7_3.95_engine_runup_OUTSIDE_RANGE.wav')                               # his own engine, from later in c7
    ru = fade(ru[: int(1.6 * SR)], 0.03, 1.0)
    put(fx, ru, t_catch, G['catch'], 0.0)
    flare = sc[int(crank * SR): int((crank + 1.2) * SR)]                                   # synth 'vroom' body under it
    put(fx, fade(lp(flare, 1800), 0.02, 0.8), t_catch, G['catch'] - 9, 0.0)
    idl = lib('engine/idle_loop.wav')
    pos = np.arange(0, len(idl) - 1, 1.18); idl = np.interp(pos, np.arange(len(idl)), idl).astype(np.float32)   # a bit above idle: rolling slowly
    idl = loop_to(idl, int((CHASE + 0.6 - t_catch) * SR), 0.3)
    idl = lp(idl, 1600)
    put(fx, fade(idl, 0.25, 0.6), t_catch + 0.1, G['idle'], 0.0)

    # --- the other car rolls up on his right
    oc = lib('engine/car_approach_alt_steady.wav')
    oc = lp(oc[: int(3.4 * SR)], 1800)
    e = np.clip(np.arange(len(oc)) / SR / 1.0, 0, 1) ** 1.5
    put(fx, fade(oc * (0.4 + 0.6 * e), 0.2, 0.5), F7(0.0) - 0.1, G['other'], 0.55)

    # make room for the voices in c7 (the other driver 0.54-1.51, Rafael 1.74-2.95)
    i0, i1 = int((F7(0.5) - F0) * SR), int((F7(2.95) - F0) * SR); r = int(0.15 * SR)
    du = np.ones(n, np.float32); du[i0:i1] = db(-5)
    du[i0 - r:i0] = np.linspace(1, db(-5), r); du[i1:i1 + r] = np.linspace(db(-5), 1, r)
    fx *= du[:, None]
    # hand over to the chase
    j = int((CHASE + 0.15 - F0) * SR); m = int(0.5 * SR)
    fx[j:j + m] *= np.linspace(1, 0, m)[:, None] ** 2; fx[j + m:] = 0
    sync[j + m:] = 0
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
