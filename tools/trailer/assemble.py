#!/usr/bin/env python3
"""
Cuts the trailer for "הסנוקר של גפן" from frames recorded by capture.js,
synthesizes a matching soundtrack and writes one MP4.

  python3 tools/trailer/assemble.py <framesDir> <out.mp4>
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FR = sys.argv[1]
OUT = sys.argv[2]
W, H, FPS = 1280, 720, 30
SR = 44100
VIDEO = os.path.join(ROOT, "assets", "video", "possession.mp4")
rng = np.random.default_rng(13)

# ----------------------------------------------------------------------------
# timeline: (kind, source, duration, start-offset, sound cue)
# ----------------------------------------------------------------------------
T = [
    ("card", "card_invite", 2.8, 0, "box"),
    ("seq", "menu", 3.8, 0.9, None),
    ("seq", "menu", 1.5, 9.3, None),
    ("seq", "menu_start", 1.0, 0, None),
    ("seq", "tapestop", 0.9, 0, "tapestop"),
    ("video", VIDEO, 6.6, 2.4, "video"),
    ("flash", "#ff0000", 0.12, 0, None),
    ("seq", "demon", 3.8, 0.4, "braam"),
    ("seq", "duo_calm", 1.6, 0.4, "drone"),
    ("seq", "duo_possess", 3.0, 1.9, "possess"),
    ("card", "card_nights", 2.3, 0, "boom"),
    ("seq", "escape_turn", 1.9, 0.2, "whoosh"),
    ("seq", "escape_run", 3.0, 0.4, "run"),
    ("flash", "#ffffff", 0.08, 0, None),
    ("seq", "cam_main0", 1.3, 0.2, "static"),
    ("seq", "cam_main2", 1.8, 0.0, "static"),
    ("seq", "cam_cornerL", 1.3, 0.2, "static"),
    ("seq", "cam_restroom", 1.2, 0.2, "static"),
    ("seq", "cam_run", 2.1, 0.2, "static_run"),
    ("card", "card_power", 2.2, 0, "boom"),
    ("seq", "door_dark", 0.8, 0.2, None),
    ("seq", "door_light", 1.9, 0.0, "sting"),
    ("seq", "door_close", 1.0, 0.0, "slam"),
    ("seq", "outage", 3.6, 0.4, "outage"),
    ("seq", "jumpscare", 1.4, 0.0, "scream"),
    ("black", None, 0.9, 0, None),
    ("card", "card_title", 5.0, 0, "title"),
]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


# ----------------------------------------------------------------------------
# video
# ----------------------------------------------------------------------------
def build_video(tmp):
    clips = []
    venc = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS)]
    for i, (kind, src, dur, off, _) in enumerate(T):
        out = os.path.join(tmp, f"c{i:02d}.mp4")
        if kind == "seq":
            d = os.path.join(FR, src)
            fps = float(open(os.path.join(d, "fps.txt")).read())
            start = int(round(off * fps))
            vf = f"scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p"
            run(["ffmpeg", "-y", "-framerate", str(fps), "-start_number", str(start), "-i", os.path.join(d, "%04d.jpg"),
                 "-t", f"{dur:.3f}", "-vf", vf, *venc, out])
        elif kind == "card":
            n = int(round(dur * FPS))
            vf = (f"scale={W * 2}:{H * 2},zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS},"
                  f"fade=t=in:st=0:d=0.35,fade=t=out:st={dur - 0.35:.2f}:d=0.35,format=yuv420p")
            run(["ffmpeg", "-y", "-loop", "1", "-i", os.path.join(FR, "cards", src + ".png"), "-t", f"{dur:.3f}", "-vf", vf, *venc, out])
        elif kind == "video":
            vf = f"scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p"
            run(["ffmpeg", "-y", "-ss", f"{off}", "-i", src, "-t", f"{dur:.3f}", "-an", "-vf", vf, *venc, out])
        elif kind in ("flash", "black"):
            color = src if kind == "flash" else "black"
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={color}:s={W}x{H}:r={FPS}", "-t", f"{dur:.3f}", *venc, out])
        clips.append(out)
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    silent = os.path.join(tmp, "video.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    # real length of every clip (frame rounding) for the audio cues
    starts, t = [], 0.0
    for c in clips:
        starts.append(t)
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", c]).decode())
        t += d
    return silent, starts, t


# ----------------------------------------------------------------------------
# sound design (numpy)
# ----------------------------------------------------------------------------
def tt(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, d=1.0, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4))
    return e


def lp(x, f, order=2):
    sos = signal.butter(order, min(f, SR / 2 - 100), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def saw(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR)
    return 2 * (ph % 1) - 1


def noise(d):
    return rng.standard_normal(int(d * SR))


def bell(f, d=2.2, amp=0.25):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return x * env(len(t), 0.002, d * 0.45, 3) * amp


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def music_box(dur, creepy=False):
    out = np.zeros(int(dur * SR))
    mel = [(76, 1), (81, 1), (84, 1), (83, 2), (81, 1), (80, 1), (76, 1), (77, 1), (76, 3),
           (74, 1), (77, 1), (81, 1), (80, 2), (77, 1), (76, 1), (72, 1), (71, 1), (69, 3)]
    beat = 60 / (120 if creepy else 150)
    t = 0.0
    i = 0
    while t < dur - 0.2:
        m, l = mel[i % len(mel)]
        f = midi(m) * (0.985 + 0.02 * math.sin(t * 1.3) if creepy else 1)
        b = bell(f, 2.0, 0.18)
        s = int(t * SR)
        e = min(len(out), s + len(b))
        out[s:e] += b[: e - s]
        t += l * beat
        i += 1
    return out


def braam(d=3.2, amp=0.9):
    t = tt(d)
    x = sum(saw(f, t) for f in (43.65, 43.9, 65.4, 87.3, 87.55)) / 5
    x = np.tanh(x * 3)
    cut = 180 + 1400 * np.exp(-t * 2.5)
    y = np.zeros_like(x)
    for k in range(0, len(x), 2048):  # time-varying low-pass, block by block
        seg = x[k:k + 2048]
        y[k:k + 2048] = lp(seg, float(cut[k]), 1)
    sub = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-t * 0.8) + 25) / SR)
    return (y * 0.9 + sub * 0.8) * env(len(t), 0.03, d * 0.6, 2.2) * amp


def boom(amp=0.9):
    t = tt(1.6)
    sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 3) + 28) / SR) * env(len(t), 0.002, 0.7, 2.5)
    n = lp(noise(1.6), 600) * env(len(t), 0.001, 0.2, 5)
    return (sub + n * 0.6) * amp


def static_burst(d=0.25, amp=0.35):
    return hp(noise(d), 1200) * env(int(d * SR), 0.001, d, 3) * amp


def heartbeat(dur, bpm0, bpm1, amp=0.7):
    out = np.zeros(int(dur * SR))
    t = 0.0
    while t < dur:
        bpm = bpm0 + (bpm1 - bpm0) * t / dur
        for off, a in ((0, 1.0), (0.17, 0.6)):
            s = int((t + off) * SR)
            b = np.sin(2 * np.pi * np.cumsum(60 * np.exp(-tt(0.25) * 6) + 35) / SR) * env(int(0.25 * SR), 0.005, 0.12, 4) * a * amp
            e = min(len(out), s + len(b))
            if s < len(out):
                out[s:e] += b[: e - s]
        t += 60 / bpm
    return out


def steps(dur, rate=4.8, amp=0.5):
    out = np.zeros(int(dur * SR))
    t = 0.0
    while t < dur:
        s = int(t * SR)
        b = lp(noise(0.12), 400) * env(int(0.12 * SR), 0.003, 0.05, 4) * amp
        e = min(len(out), s + len(b))
        out[s:e] += b[: e - s]
        t += 1 / rate * rng.uniform(0.9, 1.1)
    return out


def sting(amp=0.6):
    t = tt(1.8)
    x = sum(saw(f, t) for f in (220, 233, 311, 466)) / 4 + 0.3 * np.sign(np.sin(2 * np.pi * 1864 * t))
    return lp(x, 3000) * env(len(t), 0.004, 0.8, 3) * amp


def slam(amp=0.9):
    t = tt(1.2)
    x = boom(1.0)[: len(t)] + lp(noise(1.2), 900) * env(len(t), 0.001, 0.25, 5)
    for f in (310, 467, 893):
        x += np.sin(2 * np.pi * f * t) * env(len(t), 0.002, 0.8, 4) * 0.08
    return x * amp


def scream(amp=0.9):
    d = 1.4
    t = tt(d)
    x = np.zeros_like(t)
    for f in (370, 523, 698, 1046, 1396):
        fm = f * (1.25 - 0.3 * t / d) + f * 0.12 * np.sign(np.sin(2 * np.pi * rng.uniform(21, 37) * t))
        x += saw(fm, t)
    x += bp(noise(d), 1800, 3500) * 3
    x = np.tanh(x * 1.5)
    x = hp(lp(x, 7000), 180)
    e = np.minimum(1, t / 0.015) * np.where(t > d - 0.3, np.maximum(0, (d - t) / 0.3), 1)
    return x * e * amp


def tapestop(amp=0.4):
    d = 1.0
    t = tt(d)
    f = 220 * np.exp(-t * 3)
    x = lp(saw(f, t), 900) * (1 - t / d) * amp
    return x


def whoosh(d=0.5, amp=0.4):
    n = noise(d)
    x = bp(n, 400, 3000) * np.sin(np.linspace(0, np.pi, len(n))) ** 2
    return x * amp


def drone(dur, amp=0.25):
    t = tt(dur)
    x = sum(saw(f, t) for f in (41.2, 41.45, 61.7, 82.6)) / 4
    x = lp(x, 160)
    x *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t)
    return x * amp


def reverb(x, secs=2.2, mix=0.25):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3)
    ir /= np.sqrt((ir ** 2).sum())
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix * 3


def build_audio(starts, total, tmp):
    L = np.zeros(int((total + 0.5) * SR))

    def put(x, at, gain=1.0):
        s = int(at * SR)
        e = min(len(L), s + len(x))
        if s < len(L):
            L[s:e] += x[: e - s] * gain

    cue_t = {}
    for (kind, src, dur, off, cue), st in zip(T, starts):
        if cue:
            cue_t.setdefault(cue, []).append((st, dur))
    # innocent music box under Gefen's friendly intro
    intro_end = cue_t["tapestop"][0][0]
    mb = music_box(intro_end + 0.2) * 0.9
    mb *= np.minimum(1, np.arange(len(mb)) / SR / 0.6)
    put(reverb(mb, 2.0, 0.3), 0, 0.9)
    put(tapestop(0.5), intro_end)
    # the original video's own sound
    vst, vdur = cue_t["video"][0]
    wav = os.path.join(tmp, "v.wav")
    voff = [x for x in T if x[0] == "video"][0][3]
    run(["ffmpeg", "-y", "-ss", str(voff), "-i", VIDEO, "-t", f"{vdur:.3f}", "-ac", "1", "-ar", str(SR), wav])
    sr, va = wavfile.read(wav)
    va = va.astype(np.float32) / 32768
    va *= np.minimum(1, np.arange(len(va)) / SR / 0.15)
    put(va, vst, 0.9)
    # horror bed from the demon on
    dst = cue_t["braam"][0][0]
    put(drone(total - dst), dst, 1.0)
    put(braam(3.5, 1.0), dst)
    put(static_burst(0.3, 0.4), dst)
    for st, d in cue_t.get("possess", []):
        put(scream(0.45), st + 0.75)
        put(braam(3.0, 0.8), st + 1.1)
        put(static_burst(0.6, 0.3), st + 0.75)
    for st, d in cue_t.get("boom", []):
        put(boom(1.0), st)
    for st, d in cue_t.get("whoosh", []):
        put(whoosh(0.5, 0.6), st + 1.25)
    for st, d in cue_t.get("run", []):
        put(steps(d, 4.8, 0.6), st)
        put(heartbeat(d, 120, 150, 0.6), st)
    run_ends = cue_t["run"][0][0] + cue_t["run"][0][1]
    put(heartbeat(cue_t["outage"][0][0] - run_ends, 100, 170, 0.45), run_ends)
    for st, d in cue_t.get("static", []) + cue_t.get("static_run", []):
        put(static_burst(0.22, 0.4), st)
    for st, d in cue_t.get("static_run", []):
        put(steps(d, 5.5, 0.7) * np.linspace(0.3, 1.2, int(d * SR) + 1)[: int(d * SR)], st)
    for st, d in cue_t.get("sting", []):
        put(sting(0.7), st + 0.05)
    for st, d in cue_t.get("slam", []):
        put(slam(1.0), st + 0.05)
    for st, d in cue_t.get("outage", []):
        t = tt(1.5)
        put(lp(saw(240 * np.exp(-t * 2.2), t), 1500) * (1 - t / 1.5) * 0.5, st)
        put(reverb(music_box(d, creepy=True), 2.5, 0.45), st + 0.5, 1.0)
    for st, d in cue_t.get("scream", []):
        put(scream(1.0), st)
        put(boom(1.0), st)
    for st, d in cue_t.get("title", []):
        put(braam(4.5, 1.0), st + 0.1)
    # duck the drone in the silence before the title
    bst = [s for (k, *_), s in zip(T, starts) if k == "black"][0]
    a, b = int(bst * SR), int((bst + T[-2][2]) * SR)
    L[a:b] *= np.linspace(1, 0.05, b - a) ** 2
    # master: soft clip + normalize, fade out
    L = np.tanh(L * 0.9)
    L /= max(1e-6, np.abs(L).max()) / 0.92
    fo = int(1.2 * SR)
    L[-fo:] *= np.linspace(1, 0, fo)
    st = np.stack([L, L], 1)
    out = os.path.join(tmp, "audio.wav")
    wavfile.write(out, SR, (st * 32767).astype(np.int16))
    return out


def main():
    with tempfile.TemporaryDirectory() as tmp:
        print("video...", flush=True)
        silent, starts, total = build_video(tmp)
        print(f"length {total:.1f}s; audio...", flush=True)
        audio = build_audio(starts, total, tmp)
        run(["ffmpeg", "-y", "-i", silent, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT])
    print("wrote", OUT)


if __name__ == "__main__":
    main()
