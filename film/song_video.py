"""Video for song_audio.py: a live spectrogram of the song's own audio, which writes the number and a tel: QR.

usage: song_video.py MOVIEDIR "<shown number>" "<tel: uri>" OUT.mp4 | preview K...
"""
import json
import math
import subprocess
import sys
import wave

import cv2
import numpy as np
import scipy.signal as sg

M, SHOWN, URI, OUTP = sys.argv[1:5]
ARGS = sys.argv[5:]
sys.argv = [sys.argv[0], M, "lib"]
sys.path.insert(0, M + "/src")
import film_render as fr  # noqa: E402

W, H, FPS = 1080, 1920, 30
TL = json.load(open(f"{M}/work/song_timeline.json"))
END = TL["end"]
NF = int(END * FPS)
w = wave.open(f"{M}/work/song_mix.wav")
SR = w.getframerate()
AUD = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).mean(1).astype(np.float32) / 32768

# ------------------------------------------------------------------ spectrogram of the real audio
NPER, HOP = 1024, 128
f_, t_, Z = sg.stft(AUD, SR, nperseg=NPER, noverlap=NPER - HOP, boundary=None, padded=False)
FMAX = 16000
SPEC = 20 * np.log10(np.abs(Z[f_ < FMAX]) + 1e-9)
SPEC = (SPEC - (np.percentile(SPEC, 99.7) - 62))[::-1]   # dB above the display floor; rows: high -> low frequency
RANGE = 62.0
SPEC_T0 = t_[0]
FR_PER_S = SR / HOP
WIN = 8.25
PX0, PY0, PS = 0, 420, 1080    # spectrogram panel

stops = [(0.0, (0, 0, 0)), (0.15, (0.06, 0.0, 0.16)), (0.32, (0.5, 0.05, 0.45)), (0.45, (0.95, 0.38, 0.15)),
         (0.6, (1.0, 0.8, 0.32)), (0.8, (1.0, 0.96, 0.8)), (1.0, (1.0, 1.0, 1.0))]
LUT = np.zeros((256, 3), np.float32)
for i in range(256):
    x = i / 255
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        if a <= x <= b:
            u = (x - a) / (b - a)
            LUT[i] = np.array(ca) * (1 - u) + np.array(cb) * u
            break


def spec_window(t_end, win=WIN, size=(PS, PS), gain=0.0):
    c1 = int((t_end - SPEC_T0) * FR_PER_S)
    c0 = c1 - int(win * FR_PER_S)
    sl = np.zeros((SPEC.shape[0], c1 - c0), np.float32)
    a, b = max(0, c0), min(SPEC.shape[1], c1)
    if b > a:
        sl[:, a - c0:b - c0] = np.clip((SPEC[:, a:b] + gain) / RANGE, 0, 1)
    img = cv2.resize(sl, size, interpolation=cv2.INTER_AREA)
    img = cv2.blur(img, (1, max(1, int(size[1] / SPEC.shape[0] * 1.6))))  # hide the line between frequency bins
    return LUT[(np.clip(img, 0, 1) * 255).astype(np.uint8)]


T_FREEZE = TL["qr"][1] + 0.1
FROZEN = spec_window(T_FREEZE)
FROZEN_HOT = spec_window(T_FREEZE, gain=14.0)   # the "enhance": more display gain while zooming in
T_SCAN = T_FREEZE + 1.1                         # sweep done, code read
T_CALL = 16.5
OVERVIEW = spec_window(END, win=END, size=(PS, PS))
q0, q1, (qf0, qf1) = TL["qr"]


def qr_box():
    x0 = (q0 - (T_FREEZE - WIN)) / WIN * PS
    x1 = (q1 - (T_FREEZE - WIN)) / WIN * PS
    y0 = (FMAX - qf1) / FMAX * PS
    y1 = (FMAX - qf0) / FMAX * PS
    return x0, y0, x1, y1


QB = qr_box()


# ------------------------------------------------------------------ overlays
def keypad(img, t, a):
    if a <= 0.01:
        return
    keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]
    pressed = None
    for tt, d in zip(TL["dial"], TL["digits"]):
        if tt <= t < tt + 0.11:
            pressed = d
    cw, ch = 210, 150
    x0, y0 = (W - 3 * cw) / 2, PY0 + 190
    for k, key in enumerate(keys):
        cx, cy = x0 + (k % 3 + 0.5) * cw, y0 + (k // 3 + 0.5) * ch
        on = key == pressed
        r = 58
        col = (0.3, 1.0, 0.85) if on else (0.85, 0.9, 0.95)
        cv2.circle(img, (int(cx * 16), int(cy * 16)), r * 16, tuple(float(v) * a * (0.9 if on else 0.35) for v in col),
                   -1 if on else 3, cv2.LINE_AA, 4)
        fr.draw_text(img, key, cx, cy, "mont", 52, 600, (0.02, 0.05, 0.06) if on else (0.92, 0.95, 1.0), a, shadow=0)


def header(img, t):
    lit = None
    for i, tt in enumerate(TL["dial"]):
        if tt <= t < tt + 0.16:
            lit = i
    for i, (tt, _) in enumerate(TL["melody"]):
        if tt <= t < tt + 0.22:
            lit = i % len(TL["digits"])
    f = fr.font("mont", 92, 600)
    chars = list(SHOWN)
    cw = f.getlength("0") + 4
    x = W / 2 - cw * len(chars) / 2
    di = 0
    for ch in chars:
        cx = x + cw / 2
        if ch.isdigit():
            on = lit == di
            col = (0.35, 1.0, 0.85) if on else (0.92, 0.95, 1.0)
            if on:
                g = np.exp(-(((fr.xx - cx) / 40) ** 2 + ((fr.yy - 230) / 50) ** 2))[..., None]
                img += g * np.array([0.1, 0.5, 0.42], np.float32)
            fr.draw_text(img, ch, cx, 230, "mont", 92, 600, col, 1.0, shadow=8)
            di += 1
        else:
            fr.draw_text(img, ch, cx, 230, "mont", 92, 600, (0.5, 0.55, 0.6), 1.0, shadow=8)
        x += cw
    fr.draw_text(img, "LIVE SPECTROGRAM · 0–16 kHz", 540, 345, "mont", 24, 500, (0.5, 0.7, 0.75), 0.9, track=4,
                 shadow=0)


def scope(img, t, a=1.0):
    i = int(t * SR)
    seg = AUD[max(0, i - 1440):i]
    if len(seg) < 2:
        return
    xs = np.linspace(80, W - 80, len(seg))
    ys = 1610 - seg * 260
    pts = np.stack([xs, ys], 1)
    cv2.polylines(img, [np.round(pts * 16).astype(np.int32)], False, (0.3 * a, 0.95 * a, 0.85 * a), 2, cv2.LINE_AA, 4)


def caption(img, t, s, t0, t1, y=1760, size=58):
    a = fr.eo(fr.prog(t, t0, t0 + 0.35)) * (1 - fr.prog(t, t1 - 0.3, t1))
    fr.draw_text(img, s, 540, y, "serif", size, 500, fr.WARM, a, shadow=12)


def corners(img, x0, y0, x1, y1, ln, col, a, th=5):
    c = tuple(float(v) * a for v in col)
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        cv2.line(img, (int(cx), int(cy)), (int(cx + dx * ln), int(cy)), c, th, cv2.LINE_AA)
        cv2.line(img, (int(cx), int(cy)), (int(cx), int(cy + dy * ln)), c, th, cv2.LINE_AA)


def call_card(img, t, t0):
    a = fr.eo(fr.prog(t, t0, t0 + 0.35))
    img *= 1 - 0.75 * a
    cx, cy = 540, 840
    for k in range(3):
        ph = ((t - t0) * 0.9 + k / 3) % 1.0
        r = 120 + ph * 260
        cv2.circle(img, (cx * 16, cy * 16), int(r * 16), (0.3 * a * (1 - ph), 1.0 * a * (1 - ph), 0.8 * a * (1 - ph)), 3,
                   cv2.LINE_AA, 4)
    cv2.circle(img, (cx * 16, cy * 16), 120 * 16, (0.2 * a, 0.85 * a, 0.6 * a), -1, cv2.LINE_AA, 4)
    # handset glyph
    pts = np.array([[-48, -40], [-22, -60], [-6, -30], [-20, -18], [8, 22], [22, 8], [52, 26], [34, 56],
                    [6, 58], [-34, 20], [-56, -14]], np.float32) + [cx, cy]
    cv2.fillPoly(img, [np.round(pts * 16).astype(np.int32)], (a, a, a), cv2.LINE_AA, 4)
    fr.draw_text(img, "מחייג...", 540, 1100, "sans", 64, 600, (0.85, 0.95, 0.9), a, shadow=10)
    fr.draw_text(img, SHOWN, 540, 1200, "mont", 88, 700, (1, 1, 1), a, track=4, shadow=12)
    fr.draw_text(img, "הקוד נסרק מתוך הצליל", 540, 1300, "serif", 46, 500, fr.AMBER, a, shadow=10)


def frame(k):
    t = k / FPS
    img = np.zeros((H, W, 3), np.float32) + np.array([0.0, 0.01, 0.015], np.float32)
    if t < T_FREEZE:
        panel = spec_window(t)
        pa = fr.eo(fr.prog(t, 0.1, 0.6))
    elif t < 17.8:
        e = fr.eio(fr.prog(t, T_FREEZE + 0.05, T_FREEZE + 0.6))
        panel = FROZEN * (1 - e) + FROZEN_HOT * e
        pa = 1.0
    else:
        panel = OVERVIEW
        pa = fr.eo(fr.prog(t, 17.8, 18.3))
    glow = cv2.GaussianBlur(cv2.resize(panel, (PS // 4, PS // 4)), (0, 0), 3)
    panel = np.clip(panel + cv2.resize(glow, (PS, PS)) * 0.35, 0, 1)
    if T_FREEZE <= t < 17.8:
        z = 1 + (1000 / (QB[2] - QB[0]) - 1) * fr.eio(fr.prog(t, T_FREEZE + 0.05, T_FREEZE + 0.6))
        qcx, qcy = (QB[0] + QB[2]) / 2 + PX0, (QB[1] + QB[3]) / 2 + PY0
        canvas = np.zeros_like(img)
        canvas[PY0:PY0 + PS, PX0:PX0 + PS] = panel
        e = fr.eio(fr.prog(t, T_FREEZE + 0.05, T_FREEZE + 0.6))
        Mz = fr.affine(z, (qcx, qcy), (fr.lerp(qcx, 540, e), fr.lerp(qcy, 960, e)))
        img = cv2.warpAffine(canvas, Mz, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        img *= 1 - 0.88 * e * np.clip((fr.yy[..., None] - 1490) / 90, 0, 1)   # quiet floor for the captions
        if t >= T_FREEZE + 0.6:
            half = 500 * 1.0
            sa = fr.eo(fr.prog(t, T_FREEZE + 0.6, T_FREEZE + 0.9))
            corners(img, 540 - half - 14, 960 - half - 14, 540 + half + 14, 960 + half + 14, 90,
                    (0.3, 1.0, 0.85), sa, 6)
            sweep = fr.prog(t, T_FREEZE + 0.65, T_SCAN)
            if 0 < sweep < 1:
                yl = int(960 - half + 2 * half * sweep)
                img[yl - 3:yl + 3, 40:W - 40] = (0.4, 1.0, 0.9)
            if t >= T_SCAN:
                fr.draw_text(img, URI, 540, 1560, "mont", 40, 600, (0.4, 1.0, 0.85),
                             fr.eo(fr.prog(t, T_SCAN, T_SCAN + 0.2)), shadow=8)
        caption(img, t, "סורקים את הצליל...", T_FREEZE + 0.6, T_SCAN + 0.1, 1700)
        caption(img, t, "אפשר לסרוק גם מהמסך.", T_SCAN + 0.15, T_CALL, 1700, 50)
        if t >= T_CALL:
            call_card(img, t, T_CALL)
    else:
        img[PY0:PY0 + PS, PX0:PX0 + PS] = panel * pa
        # frequency ticks
        for khz in (4, 8, 12):
            y = PY0 + (FMAX - khz * 1000) / FMAX * PS
            cv2.line(img, (W - 40, int(y)), (W - 18, int(y)), (0.5, 0.6, 0.65), 2, cv2.LINE_AA)
            fr.draw_text(img, f"{khz}k", W - 50, y, "mont", 20, 500, (0.55, 0.65, 0.7), 0.9, ax="r", shadow=0)
        if t < 17.8:
            header(img, t)
            scope(img, t)
            keypad(img, t, fr.eo(fr.prog(t, 0.2, 0.5)) * (1 - fr.eo(fr.prog(t, 2.55, 2.9))))
            caption(img, t, "אלה הצלילים האמיתיים של החיוג.", 0.5, 2.6)
            caption(img, t, "כל ספרה — תו.", 2.8, 6.5)
            caption(img, t, "ובתדרים הגבוהים, הצליל כותב...", 6.6, 9.9)
            caption(img, t, "...ועכשיו הוא מצייר קוד.", 10.0, T_FREEZE)
        else:
            # whole song at once, with labels
            a = fr.eo(fr.prog(t, 18.2, 18.7))
            spans = [(TL["dial"][0], TL["dial"][-1] + 0.12, "חיוג"), (TL["music"], TL["text"][0], "מנגינה"),
                     (TL["text"][0], TL["text"][1], "המספר"), (TL["qr"][0], TL["qr"][1], "הקוד")]
            for s0, s1, lab in spans:
                x0, x1 = s0 / END * PS, s1 / END * PS
                cv2.line(img, (int(x0) + 4, PY0 - 30), (int(x1) - 4, PY0 - 30), (0.4 * a, 1.0 * a, 0.85 * a), 3,
                         cv2.LINE_AA)
                fr.draw_text(img, lab, (x0 + x1) / 2, PY0 - 75, "sans", 40, 600, (0.85, 0.95, 0.9), a, shadow=6)
            b = fr.eo(fr.prog(t, 18.8, 19.4))
            fr.draw_text(img, "שיר שהוא מספר טלפון.", 540, 200, "serif", 72, 600, fr.WARM, b, shadow=14)
            fr.draw_text(img, SHOWN, 540, 1640, "mont", 84, 700, (1, 1, 1), b, track=4, shadow=12)
            fr.draw_text(img, "השמיעו את השיר מול אפליקציית ספקטרוגרמה —", 540, 1745, "sans", 36, 400,
                         (0.8, 0.85, 0.9), b, shadow=6)
            fr.draw_text(img, "והקוד יופיע.", 540, 1800, "sans", 36, 400, (0.8, 0.85, 0.9), b, shadow=6)
    img *= 1 - fr.prog(t, END - 0.6, END)
    rs = np.random.default_rng(k)
    img += cv2.resize(rs.standard_normal((H // 2, W // 2)).astype(np.float32), (W, H))[..., None] * 0.01
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == "__main__":
    if OUTP == "preview":
        for k in map(int, ARGS):
            cv2.imwrite(f"{M}/frames/g_{k:04d}.jpg", cv2.cvtColor(frame(k), cv2.COLOR_RGB2BGR),
                        [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-i", f"{M}/work/song_mix.wav", "-c:v", "libx264", "-preset",
                               "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest",
                               "-movflags", "+faststart", OUTP], stdin=subprocess.PIPE)
        for k in range(NF):
            ff.stdin.write(frame(k).tobytes())
        ff.stdin.close()
        ff.wait()
        print("done", NF)
