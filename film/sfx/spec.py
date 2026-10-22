import sys, numpy as np, wave, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
def load(p):
    w = wave.open(p); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x.reshape(-1, w.getnchannels()).mean(1), sr
files = sys.argv[2:]; out = sys.argv[1]
fig, axs = plt.subplots(len(files), 1, figsize=(14, 2.6 * len(files)))
axs = np.atleast_1d(axs)
for ax, f in zip(axs, files):
    x, sr = load(f)
    ax.specgram(x + 1e-7, NFFT=2048, Fs=sr, noverlap=1792, cmap='magma', vmin=-130, vmax=-20)
    ax.set_yscale('symlog', linthresh=200); ax.set_ylim(30, 16000); ax.set_title(f.split('/')[-1], fontsize=9)
plt.tight_layout(); plt.savefig(out, dpi=70)
