// Game progress kept in this browser: money, finished missions, what has been unlocked, the car,
// the best results of the side activities, the story mission left at a checkpoint, and the gang's
// markers when they have been taken away (chapter nine), the kind of marker chosen at the rack (chapter
// ten). Saved after every mission and activity, at each
// checkpoint, on pause and when the page goes into the background.
// Every read and write is guarded: in a private window or with storage blocked the game still runs.
const KEY = 'nehorai-game:save:v1';

export const newProgress = () => ({
  v: 1, money: 0, done: [], unlocks: [],
  car: { color: '#f3f4f6', health: 100, upgrades: [] },
  records: {},               // best results of the side activities
  resume: null,              // { id, checkpoint }: the story mission running when the page was left
  stash: null,               // the markers taken from the gang (combat/paint.js stash()): { player: { color } | null,
                             // allies: [{ id, color }], overwatch: { id, post, range } | null }; null while everyone has his own
  marker: null,              // the kind of marker chosen at chapter ten's rack ('quick' | 'balanced' | 'long', see
                             // combat/paint.js KINDS); null until one is chosen: the marker of chapters four to nine
  alert: 0, savedAt: 0,
});

const isColor = (c) => typeof c === 'string' && c.length > 0 && c.length < 40; // a colour as paint was given it
// a saved stash as paint expects it, or null when there is none (or it cannot be read)
export function cleanStash(s) {
  if (!s || typeof s !== 'object') return null;
  const player = s.player && isColor(s.player.color) ? { color: s.player.color } : null;
  const allies = Array.isArray(s.allies) ? s.allies.filter((a) => a && typeof a.id === 'string' && isColor(a.color)).map((a) => ({ id: a.id, color: a.color })) : [];
  const o = s.overwatch, post = o?.post;
  const overwatch = o && typeof o.id === 'string' && post && [post.x, post.y, post.z].every(Number.isFinite) ? { id: o.id, post: { x: post.x, y: post.y, z: post.z }, range: Number.isFinite(o.range) ? o.range : 70 } : null;
  return player || allies.length || overwatch ? { player, allies, overwatch } : null;
}

// a saved marker kind as a short word, or null (paint checks it against the kinds it knows)
export const cleanMarker = (k) => (typeof k === 'string' && /^[a-z]{1,16}$/.test(k) ? k : null);

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.v === 1 && Array.isArray(p.done)) return { ...newProgress(), ...p, car: { ...newProgress().car, ...p.car }, stash: cleanStash(p.stash), marker: cleanMarker(p.marker) };
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
