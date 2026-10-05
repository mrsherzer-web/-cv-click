// Progress + settings in localStorage (safe if storage is blocked)
import { SAVE_KEY, NIGHTS } from '../config.js';

const defaults = { night: 1, beaten: false, introSeen: false, settings: { volume: 0.85, voice: true, flashing: true } };

function read() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (d) return { ...defaults, ...d, settings: { ...defaults.settings, ...(d.settings || {}) } };
  } catch (e) {}
  return structuredClone(defaults);
}

export const save = {
  data: read(),
  write() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  },
  reachNight(n) {
    this.data.night = Math.min(NIGHTS, Math.max(this.data.night, n));
    this.write();
  },
  beat() {
    this.data.beaten = true;
    this.write();
  },
};
