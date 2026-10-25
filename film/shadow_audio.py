"""Score for shadow_film.py (same key times)."""
import sys
import wave

import numpy as np

M = sys.argv[1]
src = open(f"{M}/src/audio_film.py").read().split("# ---------------------------------------------------------------- arrangement")[0]
ns = {"__name__": "lib"}
sys.argv = [sys.argv[0], M]
exec(compile(src, "audio_film_instruments", "exec"), ns)
SR = ns["SR"]
END = 14.5
N = int(END * SR)
ns["N"] = N
put, track, filt, hz = ns["put"], ns["track"], ns["filt"], ns["hz"]
piano, pad, impact, crash, riser, whoosh, shimmer = (ns[k] for k in
                                                      ("piano", "pad", "impact", "crash", "riser", "whoosh", "shimmer"))
music, sfx = track(), track()
tt = np.arange(N) / SR

# low drone that breathes
drone = (np.sin(2 * np.pi * 55 * tt) * 0.5 + np.sin(2 * np.pi * 82.4 * tt) * 0.3 + np.sin(2 * np.pi * 110.2 * tt) * 0.2)
drone *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.18 * tt)) * np.minimum(1, tt / 1.5)
put(music, filt(drone.astype(np.float32), "low", 400) * 0.12, 0.0)
# chords following the camera
for t0, dur, notes, g in ((0.0, 4.4, ["A3", "C4", "E4"], 0.7), (4.2, 2.3, ["F3", "A3", "C4"], 0.8),
                          (6.4, 3.4, ["C4", "E4", "G4", "C5"], 1.0), (9.8, 3.2, ["G3", "B3", "D4", "G4"], 1.0),
                          (13.0, 1.5, ["A3", "C4", "E4", "A4"], 1.1)):
    put(music, pad(notes, dur, cutoff=1600, att=0.8, rel=1.2, g=g), t0)
# sparse piano: a question, then the answer
for t0, nm, d, v in ((0.5, "E5", 1.2, 0.4), (1.5, "A4", 1.2, 0.32), (2.5, "C5", 1.2, 0.36), (3.4, "B4", 1.0, 0.3),
                     (6.4, "G5", 1.5, 0.5), (6.4, "C5", 1.5, 0.4), (7.4, "E5", 1.0, 0.36), (9.8, "D5", 1.5, 0.48),
                     (9.8, "G4", 1.5, 0.4), (10.8, "B4", 1.0, 0.34), (13.0, "A4", 1.5, 0.5), (13.0, "E5", 1.5, 0.45),
                     (13.4, "C6", 1.1, 0.3)):
    put(music, piano(hz(nm), d, v), t0)
# camera moves and reveals
put(sfx, riser(2.0, 0.45, 300, 6000), 4.4)
put(sfx, whoosh(0.9, 0.6), 5.5)
put(sfx, impact(0.8, 0.9), 6.4)
put(sfx, shimmer(3.0, 1.0), 6.4)


def beep(f, dur=0.12, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.003) * np.exp(-t / (dur / 3)) * 0.22 * g).astype(np.float32)


for k, t0 in enumerate((7.0, 7.18)):
    put(sfx, beep(1760 + 440 * k, 0.12, 0.8), t0)
put(sfx, whoosh(1.0, 0.6, up=False), 8.7)
put(sfx, impact(0.9, 1.0), 9.8)
put(sfx, riser(1.2, 0.4, 400, 7000), 11.8)
put(sfx, impact(0.7, 0.9), 13.0)
put(sfx, crash(0.4, 2.0), 13.0)
music = ns["reverb"](music, ns["HALL"], 0.35)[:N]
mix = music * 0.9 + sfx
mix = filt(mix, "high", 28)
sg = ns["sg"]
pw = (mix ** 2).mean(1)
win = int(1.0 * SR)
rms = np.sqrt(sg.fftconvolve(pw, np.hanning(win) / np.hanning(win).sum(), mode="same").clip(1e-10))
lev = np.clip((np.sqrt(pw.mean()) / rms) ** 0.5, 10 ** (-5 / 20), 10 ** (9 / 20)).astype(np.float32)
mix = mix * lev[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 1.15
mix = np.tanh(mix) / np.tanh(1.15)
fo = int(0.8 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.92
with wave.open(f"{M}/work/shadow_mix.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", [round(float(20 * np.log10(np.sqrt((mix[i * SR:(i + 1) * SR] ** 2).mean()) + 1e-9)), 1)
             for i in range(int(END))])
