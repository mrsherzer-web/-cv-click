// Game progress kept in this browser: money, finished missions, what has been unlocked, the car.
// Every read and write is guarded: in a private window or with storage blocked the game still runs.
const KEY = 'nehorai-game:save:v1';

export const newProgress = () => ({
  v: 1, money: 0, done: [], unlocks: [],
  car: { color: '#f3f4f6', health: 100, upgrades: [] },
  alert: 0, savedAt: 0,
});

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.v === 1 && Array.isArray(p.done)) return { ...newProgress(), ...p, car: { ...newProgress().car, ...p.car } };
  } catch { /* unreadable: start fresh */ }
  return null;
}

export function saveProgress(p) {
  try {
    p.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
