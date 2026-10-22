import numpy as np, wave, sys
from scipy.signal import lfilter
def kw(x, sr=48000):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
def load(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x.reshape(-1, w.getnchannels())
def short_term(x, sr=48000, win=3.0, hop=0.1):
    y = kw(x, sr); p = (y ** 2).sum(1)
    c = np.concatenate([[0], np.cumsum(p)]); k = int(win * sr); h = int(hop * sr)
    t = np.arange(0, len(p) - k, h); return (t + k / 2) / sr, -0.691 + 10 * np.log10((c[t + k] - c[t]) / k + 1e-12)
def phone_floor(x, sr=48000):
    from scipy.signal import butter, sosfiltfilt
    sos = butter(8, [350, 8000], 'bandpass', fs=sr, output='sos'); y = sosfiltfilt(sos, x.mean(1))
    h = sr // 20; r = np.array([20 * np.log10(np.sqrt((y[i:i + h] ** 2).mean()) + 1e-9) for i in range(0, len(y) - h, h)])
    return r
if __name__ == '__main__':
    x = load(sys.argv[1]); sr = 48000
    t, L = short_term(x)
    for name, a, b in [('dubi end 70-79.4', 70, 79.4), ('walk 79.4-86.6', 79.4, 86.6), ('car 86.7-91', 86.7, 91), ('keys 91-95.1', 91, 95.1), ('pursuer 95.1-98', 95.1, 98), ('chase 98-110', 98, 110)]:
        m = (t >= a + 1.5) & (t <= b - 1.5) if b - a > 3.5 else (abs(t - (a + b) / 2) < 0.2)
        print(f'{name:18s} short-term median {np.median(L[m]):6.1f} LUFS  min {L[m].min():6.1f}  max {L[m].max():6.1f}')
    r = phone_floor(x[int(79.4 * sr): int(98 * sr)])
    low = r < -45
    print('phone band 50ms: min %.1f  p10 %.1f  median %.1f  frames < -45: %d (%.2fs)' % (r.min(), np.percentile(r, 10), np.median(r), low.sum(), low.sum() * 0.05))
