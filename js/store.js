/* Katzir FC — player profile (coins, collection, lineup, settings) kept in localStorage. */
window.KFC = window.KFC || {};

KFC.Store = (function () {
  'use strict';
  const KEY = 'katzir-fc-profile-v1';
  const D = KFC.DATA;

  function fresh() {
    return {
      coins: 2500,
      owned: {},            // special card id -> count
      lineup: D.DEFAULT_LINEUP.slice(),
      use: {},              // player id -> special card id chosen for matches
      kit: 'auto',
      difficulty: 'normal',
      minutes: 3,           // real minutes per half
      sound: true,
      voice: true,
      welcomed: false,
      cup: null,            // { round, opponents:[ids], results:[] }
      cups: 0,
      record: { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
      scorers: {}           // player id -> goals
    };
  }

  let profile = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) profile = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) { /* storage unavailable: play with an in-memory profile */ }

  // Validate the lineup against the current squad.
  if (!Array.isArray(profile.lineup) || profile.lineup.length !== 8 || profile.lineup.some(id => !D.byId[id])) {
    profile.lineup = D.DEFAULT_LINEUP.slice();
  }

  const listeners = new Set();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
    listeners.forEach(fn => { try { fn(profile); } catch (e) { console.error(e); } });
  }

  // Best card a player can use: chosen special if owned, else the best owned, else the base card.
  function cardFor(playerId) {
    const p = D.byId[playerId];
    const chosen = profile.use[playerId];
    if (chosen && profile.owned[chosen] && D.specialById[chosen]) return specialCard(chosen);
    let best = null;
    D.SPECIALS.forEach(s => {
      if (s.player === playerId && profile.owned[s.id] && (!best || s.ovr > best.ovr)) best = s;
    });
    return best ? specialCard(best.id) : baseCard(p.id);
  }

  function baseCard(playerId) {
    const p = D.byId[playerId];
    return { cardId: playerId + '_base', player: p, edition: p.edition, ovr: p.ovr, stats: p.stats };
  }

  function specialCard(specialId) {
    const s = D.specialById[specialId];
    return { cardId: s.id, player: D.byId[s.player], edition: s.edition, ovr: s.ovr, stats: s.stats, special: true };
  }

  return {
    get: () => profile,
    save,
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    addCoins(n) { profile.coins = Math.max(0, Math.round(profile.coins + n)); save(); },
    spend(n) { if (profile.coins < n) return false; profile.coins -= n; save(); return true; },
    own(specialId) {
      const dup = !!profile.owned[specialId];
      profile.owned[specialId] = (profile.owned[specialId] || 0) + 1;
      save();
      return dup;
    },
    owns: id => !!profile.owned[id],
    cardFor, baseCard, specialCard,
    reset() { profile = fresh(); save(); }
  };
})();
