"""Sound for the standalone Corvette ride: V8, rain, original voices, beat."""
import sys
import wave

import numpy as np

M = sys.argv[1]
src = open(f"{M}/src/audio_film.py").read().split("# ---------------------------------------------------------------- arrangement")[0]
ns = {"__name__": "lib"}
sys.argv = [sys.argv[0], M]
exec(compile(src, "audio_film_instruments", "exec"), ns)

SR = ns["SR"]
B = 60 / 90
T_EXT1, T_EXT2, T_END = 10 * B, 13.5 * B, 18 * B
END = 22 * B + 0.4
N = int(END * SR)
ns["N"] = N
put, track, filt = ns["put"], ns["track"], ns["filt"]
music, drums, sfx, orig = track(), track(), track(), track()

# ---------------------------------------------------------------- engine
eng_t = [0.0, 0.55, 0.85, 1.1, 3.3, 3.5, 3.7, 5.0, 5.5, 6.2, 6.55, 6.75, T_EXT2 - 0.1, T_EXT2 + 0.1, T_END, END]
eng_r = [2600, 2700, 4600, 3100, 3000, 4200, 2800, 2700, 3000, 2900, 5400, 3400, 3700, 4300, 3300, 2500]
eng, _ = ns["engine"](eng_t, eng_r, 0.0, END, 1.0)
eng = eng[:N]
tt = np.arange(len(eng)) / SR
# inside: muffled cabin sound; outside: distance (quiet, approaching / leaving)
g = np.interp(tt, [0, T_EXT1 - 0.05, T_EXT1, T_EXT1 + 0.3, T_EXT2 - 0.05, T_EXT2, T_END - 0.5, T_END, END],
              [0.55, 0.55, 0.9, 0.35, 0.8, 1.0, 0.45, 0.2, 0.0])
cabin = filt(eng, "low", 900)
mixed = np.where((tt < T_EXT1)[:, None], cabin, eng)
put(sfx, mixed * g[:, None], 0.0, 0.75)
put(sfx, ns["rain"](END, 1.0), 0.0, 1.0)
tires = filt(np.stack([ns["noise"](N), ns["noise"](N)], 1), "band", [500, 3000]) * 0.05
gt = np.interp(tt, [0, T_EXT1, T_EXT1 + 0.2, T_EXT2, T_END, END], [0.4, 0.4, 0.6, 1.0, 0.4, 0.0])
put(sfx, tires * gt[:, None], 0.0)

# ---------------------------------------------------------------- original voices
w = wave.open(f"{M}/work/c9eac.wav")
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
EDIT = [(0.0, 0.62, 0.00), (0.62, 1.10, 0.62), (1.10, 3.45, 1.10), (3.45, 3.95, 3.45), (3.95, 4.62, 3.95),
        (4.62, 5.09, 5.08), (5.09, 5.52, 7.12), (5.52, T_EXT1, 8.62)]
for o0, o1, s0 in EDIT:
    seg = x[int(s0 * SR): int(s0 * SR) + int((o1 - o0) * SR)].copy()
    f = int(0.012 * SR)
    seg[:f] *= np.linspace(0, 1, f)[:, None]
    seg[-f:] *= np.linspace(1, 0, f)[:, None]
    put(orig, seg, o0, 0.75)

# ---------------------------------------------------------------- beat
CH = ns["CH"] if "CH" in ns else None
hz, piano, pad, bass = ns["hz"], ns["piano"], ns["pad"], ns["bass"]
kick, snare, hat, crash, impact, whoosh = ns["kick"], ns["snare"], ns["hat"], ns["crash"], ns["impact"], ns["whoosh"]
PADV = {"Am": ["A3", "C4", "E4", "A4"], "F": ["F3", "A3", "C4", "F4"], "C": ["C4", "E4", "G4", "C5"],
        "G": ["G3", "B3", "D4", "G4"]}
ROOT = {"Am": "A1", "F": "F1", "C": "C2", "G": "G1"}
chords = [(0, 4, "Am"), (4, 4, "F"), (8, 2, "C"), (10, 4, "G"), (14, 4, "Am"), (18, 2, "F"), (20, 2.6, "C")]
for b0, nb, ch in chords:
    put(music, pad(PADV[ch], nb * B, cutoff=2000, att=0.2, g=0.8), b0 * B)
    if b0 < 18:
        for b in np.arange(b0, b0 + nb, 0.5):
            put(music, bass(hz(ROOT[ch]) * 2, 0.45 * B, 0.7), b * B)
for b in np.arange(0, 18, 1):
    put(drums, kick(0.85), b * B)
    if int(b) % 2 == 1:
        put(drums, snare(0.6), b * B)
    for h in range(4):
        put(drums, hat(0.55 if h == 2 else 0.3), (b + h * 0.25) * B)
for k, b in enumerate([9.0, 9.25, 9.5, 9.75]):
    put(drums, ns["tom"](110 - 12 * k, 0.55), b * B)
motif = [(0, "A4", 1), (1, "E5", 1), (2, "D5", 0.5), (2.5, "C5", 1.5), (4, "A4", 1), (5, "C5", 1), (6, "F5", 0.5),
         (6.5, "E5", 1.5), (10, "D5", 1.5), (11.5, "B4", 0.5), (12, "G4", 2), (14, "E5", 1.5), (15.5, "D5", 0.5),
         (16, "C5", 2)]
for b, nm, d in motif:
    put(music, piano(hz(nm), d * B, 0.55), b * B)
for b, nm, d, v in [(20, "C3", 2.6, 0.5), (20, "G3", 2.6, 0.42), (20, "E4", 2.6, 0.42), (20, "C5", 2.6, 0.45)]:
    put(music, piano(hz(nm), d * B, v), b * B)
put(sfx, impact(0.8, 0.8), T_EXT1)
put(sfx, crash(0.6), T_EXT1)
put(sfx, whoosh(0.5, 0.8), T_EXT1 - 0.3)
put(sfx, whoosh(0.4, 0.6, up=False), T_EXT2 - 0.15)
put(sfx, impact(0.5, 0.6), T_EXT2)
put(sfx, impact(0.6, 0.9), T_END)
put(sfx, whoosh(0.35, 0.4), 0.62 - 0.1)
put(sfx, whoosh(0.3, 0.35), 3.45 - 0.05)
music = ns["reverb"](music, ns["HALL"], 0.3)[:N]

# duck music under speech in the selfie shots
duck = np.ones(N, np.float32)
for a, b in ((0.0, 0.62), (3.95, 5.09)):
    d = np.clip(np.minimum((tt[:N] - a) / 0.1, (b - tt[:N]) / 0.1), 0, 1)
    duck = np.minimum(duck, 1 - 0.45 * d)
mix = (music * 0.75 + drums * 0.6) * duck[:, None] + sfx * 0.85 + orig
mix = filt(mix, "high", 28)
mix = mix / (np.abs(mix).max() + 1e-9) * 1.2
mix = np.tanh(mix) / np.tanh(1.2)
fo = int(0.8 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mix[:int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.93
with wave.open(f"{M}/work/vette_mix.wav", "wb") as wv:
    wv.setnchannels(2)
    wv.setsampwidth(2)
    wv.setframerate(SR)
    wv.writeframes((mix * 32767).astype(np.int16).tobytes())
nf = int(END * 30)
np.save(f"{M}/work/vette_rpm.npy", np.interp(np.arange(nf) / 30, eng_t, eng_r).astype(np.float32))
for a in range(int(END) + 1):
    s = mix[a * SR:(a + 1) * SR]
    print(f"{a:2d}s {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f}dB", end="  ")
print("\nEND", END, "peak", np.abs(mix).max())
