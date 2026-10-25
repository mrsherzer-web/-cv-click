"""Sound design for code_reveal.py (same timeline constants)."""
import sys
import wave

import numpy as np

M = sys.argv[1]
src = open(f"{M}/src/audio_film.py").read().split("# ---------------------------------------------------------------- arrangement")[0]
ns = {"__name__": "lib"}
sys.argv = [sys.argv[0], M]
exec(compile(src, "audio_film_instruments", "exec"), ns)
SR = ns["SR"]
END = 9.5
N = int(END * SR)
ns["N"] = N
put, track, filt, rng = ns["put"], ns["track"], ns["filt"], ns["rng"]
hz, pad, piano, kick = ns["hz"], ns["pad"], ns["piano"], ns["kick"]
blip, tick, impact, crash, whoosh = None, ns.get("tick"), ns["impact"], ns["crash"], ns["whoosh"]


def beep(f, dur=0.06, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / 0.002) * np.exp(-t / (dur / 3))
    return (x * 0.2 * g).astype(np.float32)


def key_tick(g=1.0):
    n = int(0.012 * SR)
    t = np.arange(n) / SR
    return filt(ns["noise"](n), "band", [2500, 7000]) * np.exp(-t / 0.002) * 0.35 * g


T_TERM, T_DEC0, T_DEC1, T_GRANT, T_QR0, T_QR1 = 1.0, 2.0, 3.8, 3.95, 4.7, 5.7
LOCKS = 12
sfx, music = track(), track()
# digital rain bed
tt = np.arange(N) / SR
hum = (np.sin(2 * np.pi * 55 * tt) * 0.5 + np.sin(2 * np.pi * 110.4 * tt) * 0.25) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * tt))
put(sfx, (hum * 0.05 * np.minimum(1, tt / 1.0)).astype(np.float32), 0.0)
for st in np.arange(0.1, END - 0.6, 0.11):
    if rng.random() < 0.5:
        put(sfx, beep(rng.uniform(1800, 4200), 0.03, 0.25), st, pan=rng.uniform(-0.8, 0.8))
# typing
for s, ts in (("> INCOMING SIGNAL", 1.0), ("> TRACING NUMBER ...", 1.35), ("> DECRYPTING", 1.75)):
    for k in range(len(s)):
        put(sfx, key_tick(0.9), ts + k / 40, pan=-0.2)
# scramble chatter + digit locks
for st in np.arange(T_DEC0, T_DEC1, 0.035):
    put(sfx, beep(rng.uniform(900, 2400), 0.02, 0.18), st)
for k in range(LOCKS):
    tl = T_DEC0 + (T_DEC1 - T_DEC0) * (k + 1) / LOCKS
    put(sfx, beep(880 * 2 ** (k / 12), 0.09, 0.8), tl)
put(sfx, ns["riser"](T_DEC1 - T_DEC0, 0.35, 400, 7000), T_DEC0)
# access granted
put(sfx, impact(0.9, 0.9), T_GRANT)
for i, nm in enumerate(("C5", "E5", "G5", "C6")):
    put(sfx, beep(hz(nm), 0.35, 0.9), T_GRANT + 0.05 + i * 0.06)
put(sfx, ns["glitch"](0.18, 0.6) if "glitch" in ns else whoosh(0.2, 0.4), 3.85)
# QR scan
n = int((T_QR1 - T_QR0) * SR)
t2 = np.arange(n) / SR
f = 300 * (8 ** (t2 / (T_QR1 - T_QR0)))
sweep = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t2 / 0.05) * np.minimum(1, (n / SR - t2) / 0.1) * 0.12
put(sfx, sweep.astype(np.float32), T_QR0)
put(sfx, whoosh(0.5, 0.5), T_QR0 - 0.3)
put(sfx, crash(0.35, 2.0), T_QR1)
for i, nm in enumerate(("A4", "C5", "E5")):
    put(sfx, beep(hz(nm), 0.25, 0.6), T_QR1 + i * 0.08)
# music bed
put(music, pad(["A3", "C4", "E4", "A4"], 4.0, cutoff=1500, att=1.0, g=0.8), 0.0)
put(music, pad(["F3", "A3", "C4", "F4"], T_QR1 - 4.0, cutoff=1800, att=0.3, g=0.9), 4.0)
put(music, pad(["C4", "E4", "G4", "C5"], END - T_QR1, cutoff=2000, att=0.4, rel=1.0, g=1.0), T_QR1)
for b in np.arange(2.0, T_GRANT, 0.6667 / 2):
    put(music, kick(0.35), b)
for b in np.arange(T_QR1, END - 0.8, 0.6667):
    put(music, kick(0.5), b)
music = ns["reverb"](music, ns["HALL"], 0.3)[:N]
mix = music * 0.7 + sfx
mix = filt(mix, "high", 30)
mix = mix / (np.abs(mix).max() + 1e-9) * 1.15
mix = np.tanh(mix) / np.tanh(1.15)
fo = int(0.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.92
with wave.open(f"{M}/work/code_mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", [round(20 * np.log10(np.sqrt((mix[i * SR:(i + 1) * SR] ** 2).mean()) + 1e-9), 1) for i in range(int(END))])
