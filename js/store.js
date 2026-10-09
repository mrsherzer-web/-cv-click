// מצב האפליקציה – נשמר מקומית במכשיר בלבד.
const KEY = 'smartpantry:v1';

const DEFAULT_STATE = {
  onboarded: false,
  name: '',
  diets: [],
  allergens: [],
  pantry: [],          // [{ key, id?, name, emoji, cat, addedAt, expiresAt, note? }]
  likes: {},           // { cuisine: score } – לומד מה אוהבים
  cooked: [],          // [{ recipeId, title, at, saved }]
  favorites: [],
  mode: { energy: 'ok', maxTime: 15, cuisine: null, noDishes: false },
  apiKey: '',
  aiRecipes: true,
  deliveryCost: 80,    // כמה עולה בממוצע הזמנה בוולט
  lastScanAt: null,
  lastAiRecipes: [],
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed, mode: { ...DEFAULT_STATE.mode, ...(parsed.mode || {}) } };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export const state = load();
const listeners = new Set();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* מצב פרטי / אחסון מלא */ }
  listeners.forEach((fn) => fn(state));
}

export function update(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  save();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, structuredClone(DEFAULT_STATE));
  save();
}
