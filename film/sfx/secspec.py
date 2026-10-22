import sys, numpy as np, wave, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
p, out, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
marks = [float(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else []
w = wave.open(p); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
x = x.reshape(-1, w.getnchannels()).mean(1)[int(t0 * sr): int(t1 * sr)]
fig, ax = plt.subplots(2, 1, figsize=(18, 7), sharex=True, gridspec_kw=dict(height_ratios=[3, 1]))
ax[0].specgram(x + 1e-7, NFFT=2048, Fs=sr, noverlap=1536, cmap='magma', vmin=-120, vmax=-20, xextent=(t0, t1))
ax[0].set_yscale('symlog', linthresh=200); ax[0].set_ylim(30, 16000)
h = sr // 20; r = [20 * np.log10(np.sqrt((x[i:i + h] ** 2).mean()) + 1e-9) for i in range(0, len(x) - h, h)]
ax[1].plot(t0 + np.arange(len(r)) * 0.05 + 0.025, r); ax[1].set_ylim(-70, 0); ax[1].grid(alpha=0.3); ax[1].set_ylabel('50ms RMS dBFS')
for m in marks:
    for a in ax: a.axvline(m, color='c', lw=0.8, alpha=0.7)
ax[1].set_xticks(np.arange(np.ceil(t0), t1, 1.0))
plt.tight_layout(); plt.savefig(out, dpi=60)
