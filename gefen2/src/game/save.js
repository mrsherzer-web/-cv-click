// Progress + settings in localStorage
import { SAVE_KEY, NIGHTS } from '../config.js';

const DEFAULT = {
  night: 1, // highest unlocked night
  cont: null, // { night, stage } last checkpoint
  allies: { cap: 'ok', smiler: 'ok' },
  beaten: false,
  movedOnce: false,
  settings: { volume: 0.85, voice: true, subs: true, flashing: true, quality: null, sens: 1 },
};

export const save = {
  data: JSON.parse(JSON.stringify(DEFAULT)),
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw) {
        this.data = { ...DEFAULT, ...raw, settings: { ...DEFAULT.settings, ...(raw.settings || {}) }, allies: { ...DEFAULT.allies, ...(raw.allies || {}) } };
      }
    } catch (e) {}
    return this.data;
  },
  write() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  },
  checkpoint(night, stage) {
    this.data.cont = { night, stage };
    if (night > this.data.night) this.data.night = night;
    this.write();
  },
  finishNight(n, flags = {}) {
    if (flags.cap) this.data.allies.cap = flags.cap;
    if (flags.smiler) this.data.allies.smiler = flags.smiler;
    if (n >= NIGHTS) {
      this.data.beaten = true;
      this.data.cont = null;
    } else {
      this.data.night = Math.max(this.data.night, n + 1);
      this.data.cont = { night: n + 1, stage: 0 };
    }
    this.write();
  },
  reset() {
    const s = this.data.settings;
    this.data = JSON.parse(JSON.stringify(DEFAULT));
    this.data.settings = s;
    this.write();
  },
};
