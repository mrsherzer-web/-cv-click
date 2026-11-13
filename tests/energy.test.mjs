// Chapter ten's energy fights and the cast (combat/energy.js, paint.js, fight.js, characters). Checked:
// the three kinds of marker fire at their own rate and reach (measured), the choice is kept through a
// reload; the marker dropped on the floor disarms Nehorai and comes back with the same paint in it; a
// ring, a beam and a bolt warn for their full time and mark him only when he stays in them, cover stops a
// bolt and a beam; an energy foe teleports, its copies pop on a hit, its shields stop pellets until the
// generators are down (one shot, one overloaded with a bolt, one switched off), its weak point takes hits
// only while open; the special people of the Order (shield, heavy, runner); the last fight's special
// attack charges with landed hits and lands with the real button, a timed opening's counter lands when the
// punch is pressed in time. The game's own loop is held and the game is stepped from here at 30 frames a
// second, so every timing is the game's own (a held game refuses to fire, so the hold is lifted inside
// each check that fires and put back before the page gets a frame).
// usage: node tests/energy.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const r2 = (v) => Math.round(v * 100) / 100;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const KEY = 'nehorai-game:save:v1';

// a finished game (no mission begins by itself), the real loop frozen, helpers for the checks
async function boot() {
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
  return G(() => {
    const D = window.__game.debug, g = D.game, W = D.world, P = g.paint;
    g.hold = true;
    g.setPopulation?.({ traffic: 0, people: 0 });
    const $ = (id) => document.getElementById(id), vis = (id) => !!$(id)?.offsetParent;
    // an open, flat place with nothing solid for 34 m ahead (+z) and 12 m round
    const open = (x, z) => {
      const y = W.groundHeight(x, z);
      for (let d = 0; d <= 34; d += 2) if (Math.abs(W.groundHeight(x, z + d) - y) > 0.6 || W.cols.blocks(x, y + 0.9, z + d, null)) return false;
      for (let a = 0; a < 6.28; a += 0.4) for (const r of [3, 7, 12]) { const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (Math.abs(W.groundHeight(px, pz) - y) > 0.5 || W.cols.blocks(px, y + 0.9, pz, null)) return false; }
      return W.cols.raycast(x, y + 1.3, z, x, y + 1.3, z + 34, null) === null;
    };
    let at = null;
    for (let x = 1170; x <= 1290 && !at; x += 10) for (let z = 40; z <= 130 && !at; z += 10) if (open(x, z)) at = { x, z };
    if (!at) for (const [x, z] of [[1900, -300], [1880, -250], [1300, -150], [1350, -300]]) if (!at && open(x, z)) at = { x, z };
    if (!at) return null;
    const home = () => { g.player.place(at.x, at.z, 0); g.follow.snapBehind(0); };
    home();
    const pellets = [];
    const proto = Object.getPrototypeOf(P);
    P.pellet = function (from, to, shooter, o) { const h = proto.pellet.call(this, from, to, shooter, o); if (shooter === g.player) pellets.push({ t: g.time, reach: Math.hypot(h.point.x - from.x, h.point.z - from.z), hit: h.target ? 'target' : h.prop ? 'prop' : h.wall ? 'wall' : 'air' }); return h; };
    const tap = (id) => { const el = $(id); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9 })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 9 })); };
    window.__t = {
      at: { ...at, y: g.player.pos.y }, home, vis, pellets, tap,
      // run a check with the hold lifted (markers fire), and put it back
      run(fn) { g.hold = false; try { return fn(); } finally { g.hold = true; } },
      step(sec, each) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { each?.(i); g.update(1 / 30); } },
      // step until cond() or for max seconds; returns the seconds it took, or -1
      until(cond, max) { for (let t = 0; t <= max; t += 1 / 30) { if (cond()) return t; g.update(1 / 30); } return -1; },
      hud() { return { kind: vis('markerKind') ? $('markerKind').textContent : null, pips: $('ammo').children.length, fire: vis('btnFire'), special: vis('btnSpecial'), ready: $('btnSpecial').classList.contains('ready'), opening: vis('opening'), boss: vis('bossBar') ? $('bossName').textContent : null, tag: $('bossTag').textContent, bossW: parseFloat($('bossFill').style.width), pop: $('pop').textContent }; },
      render(px, py, pz, lx, ly, lz) { if (px !== undefined) { D.camera.position.set(px, py, pz); D.camera.lookAt(lx, ly, lz); } D.renderer.render(D.scene, D.camera); },
    };
    return window.__t.at;
  });
}
const snap = async (name) => { await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/${name}.png` }); };

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 240000 });
await G((KEY) => { const p = window.__game.debug.game.progressForChapter(11); p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, KEY);
await page.reload();
let at = await boot();
check('an open, flat place for the checks', !!at, JSON.stringify(at));

// ---------- the marker before the rack: as it always was ----------
let r = await G(() => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t;
  P.armPlayer(); t.step(0.3);
  return { kind: P.kind, marker: g.progress.marker ?? null, clip: P.player.clip, ammo: P.player.ammo, hud: t.hud(), energy: !!g.energy, slowmo: typeof g.slowmo };
}));
check('before a kind is chosen: the balanced marker of chapters 4-9, 8 pellets, no kind on the HUD', r.kind === 'balanced' && r.marker === null && r.clip === 8 && r.ammo === 8 && r.hud.kind === null && r.hud.pips === 8 && r.hud.fire, JSON.stringify(r));
check('game.energy and game.slowmo are there', r.energy && r.slowmo === 'function');

// ---------- each kind: its rate (the real fire button held, and tapped five times a second) and its reach ----------
const measure = (kind) => G((kind) => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t, fire = document.getElementById('btnFire');
  const down = () => fire.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9 })), up = () => fire.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 9 }));
  t.home(); P.setKind(kind); P.reset(); t.step(0.2);
  const out = { kind: P.player.kind, clip: P.player.clip, name: t.hud().kind, pips: t.hud().pips };
  t.pellets.length = 0; down(); t.step(6); up();
  out.held = t.pellets.length;
  out.reach = Math.max(...t.pellets.map((p) => p.reach));
  P.reset(); t.step(2); t.pellets.length = 0;
  t.step(6, (i) => { if (i % 6 === 0) { down(); up(); } });
  out.tapped = t.pellets.length;
  // the gaps between pellets of one hopper, tapping every frame: the kind's own pause
  P.reset(); t.step(2); t.pellets.length = 0;
  t.step(1.2, () => { down(); up(); });
  const ts = t.pellets.map((p) => p.t), gaps = ts.slice(1, P.player.clip).map((v, i) => v - ts[i]);
  out.gap = gaps.length ? Math.min(...gaps) : null;
  // a target 13 m off: how many of twelve pellets land (the spread), and one 25 m off (the reach)
  const board = (d) => { const b = { board: true, pos: { x: t.at.x, y: t.at.y, z: t.at.z + d }, done: false, hits: 0, onHit() { b.hits++; b.done = false; } }; P.boards.push(b); return b; };
  let b = board(13); P.reset(); t.step(1.5);
  out.lock13 = P.lock === b;
  for (let i = 0; i < 12; i++) { b.done = false; P.player.ammo = P.player.clip; P.player.reloading = 0; P.player.cool = 0; t.step(0.05); P.fire(); }
  out.hits13 = b.hits; P.boards.length = 0;
  b = board(25); P.reset(); t.step(1.5);
  out.lock25 = P.lock === b;
  P.fire(); t.step(0.1); out.hits25 = b.hits; P.boards.length = 0;
  // a thing that takes four pellets: how many it takes with this kind
  const pr = P.addProp({ x: t.at.x, y: t.at.y + 1.2, z: t.at.z + 6, r: 0.5, hits: 4 }); P.reset(); let n = 0;
  while (!pr.done && n < 8) { P.player.ammo = P.player.clip; P.player.reloading = 0; P.player.cool = 0; P.fire(); n++; }
  out.propPellets = n; P.removeProp(pr);
  return out;
}), kind);
const M = {};
for (const k of ['quick', 'balanced', 'long']) M[k] = await measure(k);
const brief = (m) => `${m.kind}: held ${m.held}/6s, tapped ${m.tapped}/6s, gap ${m.gap == null ? '-' : r2(m.gap)}s, reach ${r2(m.reach)} m, 13 m ${m.hits13}/12, 25 m ${m.hits25}, prop ${m.propPellets}`;
console.log(`  ${brief(M.quick)}\n  ${brief(M.balanced)}\n  ${brief(M.long)}`);
check('each kind is in hand with its own hopper and its Hebrew name on the HUD', M.quick.clip === 6 && M.balanced.clip === 8 && M.long.clip === 5 && M.quick.name === 'מהיר' && M.balanced.name === 'מאוזן' && M.long.name === 'ארוך ומדויק' && M.long.pips === 5, `${M.quick.name}/${M.balanced.name}/${M.long.name}`);
check('rate: the quick one keeps firing while the button is held; the others fire once a press', M.quick.held >= 24 && M.balanced.held === 1 && M.long.held === 1, `held: ${M.quick.held} / ${M.balanced.held} / ${M.long.held}`);
check('rate over six seconds: quick held > balanced tapped five times a second > long tapped', M.quick.held > M.balanced.tapped * 1.3 && M.balanced.tapped > M.long.tapped * 1.5, `quick held ${M.quick.held}, tapped: ${M.quick.tapped} / ${M.balanced.tapped} / ${M.long.tapped}`);
check('the long one waits 0.8 s between pellets, the balanced one not at all (as before)', Math.abs(M.long.gap - 0.8) < 0.07 && M.balanced.gap < 0.05 && Math.abs(M.quick.gap - 0.1) < 0.05, `gaps ${r2(M.quick.gap)} / ${r2(M.balanced.gap)} / ${r2(M.long.gap)}`);
check('reach: 14 m, 18 m and 30 m', Math.abs(M.quick.reach - 14) < 0.3 && Math.abs(M.balanced.reach - 18) < 0.2 && Math.abs(M.long.reach - 30) < 0.2, `${r2(M.quick.reach)} / ${r2(M.balanced.reach)} / ${r2(M.long.reach)}`);
check('spread: at 13 m the balanced and the long one always land, the quick one goes wide now and then', M.balanced.hits13 === 12 && M.long.hits13 === 12 && M.quick.hits13 < 12, `${M.quick.hits13} / ${M.balanced.hits13} / ${M.long.hits13} of 12`);
check('only the long one locks on and lands at 25 m', M.long.lock25 && M.long.hits25 === 1 && !M.balanced.lock25 && M.balanced.hits25 === 0 && M.quick.hits25 === 0);
check('a thing that takes four pellets: four from the quick and the balanced one, two from the long one', M.quick.propPellets === 4 && M.balanced.propPellets === 4 && M.long.propPellets === 2, `${M.quick.propPellets} / ${M.balanced.propPellets} / ${M.long.propPellets}`);

// the three markers side by side (each dropped once, for the picture) and the one in his hand
await G(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t;
  t.home(); let i = 0;
  for (const k of ['quick', 'balanced', 'long']) { P.setKind(k); const d = P.drop({ x: t.at.x - 0.9 + i * 0.9, z: t.at.z + 1.6, yaw: Math.PI / 2 }); P.fallen = null; (window.__keep ||= []).push(d); P.armPlayer(); i++; }
  t.step(0.4); t.render(t.at.x, t.at.y + 1.3, t.at.z + 0.2, t.at.x, t.at.y + 0.05, t.at.z + 1.6);
});
await snap('energy-markers');
await G(() => { const P = window.__game.debug.game.paint; for (const d of window.__keep) { P.fallen = d; P.takeFallen(); } window.__keep = []; });

// ---------- the choice is kept: a restore, and a reload ----------
r = await G((KEY) => {
  const g = window.__game.debug.game, P = g.paint;
  P.setKind('long');
  P.disarmPlayer(); P.armPlayer(); // what a checkpoint's restore does
  return { kind: P.player.kind, clip: P.player.clip, saved: JSON.parse(localStorage.getItem(KEY)).marker, bad: P.setKind('cannon') };
}, KEY);
check('setKind is kept in the progress and saved; a restore re-arms with it; an unknown kind is refused', r.kind === 'long' && r.clip === 5 && r.saved === 'long' && r.bad === false, JSON.stringify(r));
await page.reload();
at = await boot();
r = await G(() => window.__t.run(() => { const g = window.__game.debug.game, P = g.paint, t = window.__t; P.armPlayer(); t.step(0.3); return { kind: P.kind, clip: P.player.clip, hud: t.hud() }; }));
check('after a reload: still the long marker (5 pellets, its name on the HUD)', r.kind === 'long' && r.clip === 5 && r.hud.kind === 'ארוך ומדויק' && r.hud.pips === 5, JSON.stringify(r));

// ---------- the dropped marker ----------
r = await G(() => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t, out = {};
  P.setKind('balanced'); P.reset(); t.step(0.2);
  for (let i = 0; i < 3; i++) { P.fire(); t.step(0.1); }
  out.before = { ammo: P.player.ammo, color: P.player.color };
  const d = P.drop({ x: t.at.x + 2, z: t.at.z + 2 });
  t.step(0.3);
  out.dropped = { armed: P.armed, rec: P.dropped && { x: P.dropped.x, z: P.dropped.z, kind: P.dropped.kind, ammo: P.dropped.ammo, color: P.dropped.color }, same: d === P.dropped, inScene: !!d.mesh.parent, fire: t.hud().fire, fired: P.fire(), near: P.nearDropped(), again: P.drop() === d };
  g.player.place(t.at.x + 1.2, t.at.z + 1.6, 0); t.step(0.1);
  out.near = P.nearDropped();
  out.picked = P.pickUp(); t.step(0.3);
  out.after = { armed: P.armed, ammo: P.player?.ammo, color: P.player?.color, kind: P.player?.kind, dropped: P.dropped, gone: !d.mesh.parent, fire: t.hud().fire, twice: P.pickUp(), fires: P.fire() };
  // with chapter nine's stash: a marker on the floor is taken with the rest, and comes back from the stash
  P.drop(); const st = P.stash(); out.stash = { player: st?.player?.color, dropped: P.dropped, armed: P.armed };
  out.unstash = P.unstash(); out.back = { armed: P.armed, color: P.player?.color };
  // a marker handed to him while his lies on the floor: there is only the one
  P.drop(); P.armPlayer(); out.handed = { armed: P.armed, dropped: P.dropped };
  t.home();
  return out;
}));
check('drop(): the marker lies on the floor where it was put, he is unarmed, no fire button, no firing', !r.dropped.armed && r.dropped.same && r.dropped.inScene && !r.dropped.fire && r.dropped.fired === false && r.dropped.again && Math.abs(r.dropped.rec.x - at.x - 2) < 0.01 && r.dropped.near === false && r.near === true, JSON.stringify(r.dropped));
check('pickUp(): armed again with the same kind, colour and the paint that was left', r.picked && r.after.armed && r.after.ammo === r.before.ammo - 0 && r.before.ammo === 5 && r.after.color === r.before.color && r.after.kind === 'balanced' && r.after.dropped === null && r.after.gone && r.after.fire && r.after.twice === false && r.after.fires === true, JSON.stringify({ before: r.before, after: r.after }));
check('with the stash: a marker on the floor goes into it and comes back from it; a marker handed to him replaces the one on the floor', r.stash.player === r.before.color && r.stash.dropped === null && !r.stash.armed && r.unstash === true && r.back.armed && r.back.color === r.before.color && r.handed.armed && r.handed.dropped === null, JSON.stringify({ stash: r.stash, back: r.back, handed: r.handed }));

// ---------- the ring ----------
r = await G(() => {
  const g = window.__game.debug.game, P = g.paint, E = g.energy, t = window.__t, out = {};
  P.reset(); E.clear(); t.home();
  let a = E.ringAttack({ at: { x: t.at.x, z: t.at.z }, r: 3, warn: 1.4 });
  out.stayed = { t: t.until(() => a.struck || a.done, 4), struck: a.struck, hits: P.hits, shown: !!a.o || a.done };
  t.step(1.5);
  out.left = E.active;
  // again, and he walks out before it bursts
  P.reset();
  a = E.ringAttack({ at: { x: t.at.x, z: t.at.z }, r: 3, warn: 1.4 });
  t.step(1.0); out.mid = { struck: a.struck, hits: P.hits };
  g.player.place(t.at.x + 4.5, t.at.z, 0); t.step(1.2);
  out.walked = { struck: a.struck, hits: P.hits, done: a.done };
  // a knock-back instead of a mark
  P.reset(); t.home(); t.step(1.1);
  a = E.ringAttack({ at: { x: t.at.x + 1, z: t.at.z }, r: 3, warn: 0.6, hit: 'knock' });
  t.step(1.2);
  out.knock = { struck: a.struck, hits: P.hits, moved: Math.hypot(g.player.pos.x - t.at.x, g.player.pos.z - t.at.z) };
  t.home(); t.step(1.1);
  return out;
});
check('a ring warns for its full time (1.4 s), then marks him once if he stayed', r.stayed.struck && r.stayed.t >= 1.4 - 0.04 && r.stayed.t < 1.6 && r.stayed.hits === 1 && r.left === 0, JSON.stringify(r.stayed));
check('a ring he walks out of does nothing', !r.mid.struck && r.mid.hits === 0 && !r.walked.struck && r.walked.hits === 0 && r.walked.done, JSON.stringify(r.walked));
check('a ring set to knock back throws him clear and leaves no mark', r.knock.struck && r.knock.hits === 0 && r.knock.moved > 1.5, JSON.stringify(r.knock));

// ---------- the beam ----------
r = await G(() => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = g.paint, E = g.energy, t = window.__t, out = {};
  const from = { x: t.at.x, z: t.at.z + 9 };
  const sweep = () => E.beamSweep({ from, angle0: Math.PI - 0.8, angle1: Math.PI + 0.8, len: 14, warn: 1.2, seconds: 2 }); // he stands at yaw π from it, in the middle of the arc
  P.reset(); E.clear(); t.home();
  let a = sweep();
  out.stayed = { t: t.until(() => a.struck || a.done, 5), struck: a.struck, hits: P.hits };
  t.step(2.5);
  // clear of the arc
  P.reset(); g.player.place(t.at.x + 13, t.at.z + 9, 0);
  a = sweep(); t.step(3.6);
  out.clear = { struck: a.struck, hits: P.hits, done: a.done };
  // behind cover: a wall between him and where it comes from
  P.reset(); t.home();
  const wall = W.cols.addBox(t.at.x, t.at.z + 2, 1.6, 0.3, 0, t.at.y - 1, t.at.y + 2.4);
  a = sweep(); t.step(3.6);
  out.cover = { struck: a.struck, hits: P.hits, done: a.done };
  W.cols.remove(wall);
  return out;
});
check('a beam shows its line for the full warning (1.2 s), then marks him as it sweeps over him', r.stayed.struck && r.stayed.t >= 1.2 - 0.04 && r.stayed.t < 3.3 && r.stayed.hits === 1, JSON.stringify(r.stayed));
check('a beam does nothing to him clear of its arc, or behind cover', !r.clear.struck && r.clear.hits === 0 && r.clear.done && !r.cover.struck && r.cover.hits === 0 && r.cover.done, JSON.stringify({ clear: r.clear, cover: r.cover }));

// ---------- the bolt ----------
r = await G(() => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = g.paint, E = g.energy, t = window.__t, out = {};
  const from = { x: t.at.x, z: t.at.z + 12 };
  P.reset(); E.clear(); t.home(); t.step(1.1);
  let a = E.bolt({ from, target: 'player', speed: 6, warn: 0.5 });
  t.step(0.4); out.gather = { flying: a.flying, struck: a.struck };
  out.stayed = { t: 0.4 + t.until(() => a.struck || a.done, 6), struck: a.struck, hits: P.hits };
  // he steps aside while it flies
  P.reset(); t.home(); t.step(1.1);
  a = E.bolt({ from, target: 'player', speed: 6, warn: 0.5 });
  t.step(1.2); g.player.place(t.at.x + 3, t.at.z, 0); t.step(6);
  out.dodged = { struck: a.struck, hits: P.hits, done: a.done };
  // cover stops it
  P.reset(); t.home(); t.step(1.1);
  const wall = W.cols.addBox(t.at.x, t.at.z + 3, 1.6, 0.3, 0, t.at.y - 1, t.at.y + 2.4);
  a = E.bolt({ from, target: 'player', speed: 6, warn: 0.5 });
  t.step(4);
  out.cover = { struck: a.struck, hits: P.hits, done: a.done, stopZ: a.stopped && a.stopped.z - t.at.z };
  W.cols.remove(wall);
  // three marks are three marks, as everywhere
  P.reset(); t.home(); t.step(1.1);
  for (let i = 0; i < 3; i++) { E.ringAttack({ at: { x: t.at.x, z: t.at.z }, r: 2, warn: 0.3 }); t.step(1.4); }
  out.three = P.hits;
  P.reset(); t.step(1.1);
  return out;
});
check('a bolt gathers for its warning, flies slowly (6 m/s over 12 m), and marks him once if he stands still', !r.gather.flying && !r.gather.struck && r.stayed.struck && r.stayed.t > 0.5 + 1.6 && r.stayed.t < 0.5 + 2.4 && r.stayed.hits === 1, JSON.stringify(r.stayed));
check('a bolt he steps away from passes; cover stops it short of him', !r.dodged.struck && r.dodged.hits === 0 && r.dodged.done && !r.cover.struck && r.cover.hits === 0 && r.cover.done && r.cover.stopZ > 2.9, JSON.stringify({ dodged: r.dodged, cover: r.cover }));
check('three energy marks are three marks on Nehorai (out, as elsewhere)', r.three === 3, `hits ${r.three}`);

// the three warnings in one picture
await G(() => {
  const g = window.__game.debug.game, E = g.energy, t = window.__t;
  g.player.place(t.at.x, t.at.z - 3, 0);
  E.ringAttack({ at: { x: t.at.x - 4, z: t.at.z + 5 }, r: 3, warn: 2 });
  E.beamSweep({ from: { x: t.at.x + 6, z: t.at.z + 11 }, angle0: Math.PI + 0.5, angle1: Math.PI - 0.9, len: 12, warn: 1.5, seconds: 4 });
  E.bolt({ from: { x: t.at.x + 1, z: t.at.z + 11 }, to: { x: t.at.x + 1, z: t.at.z - 12 }, speed: 5, warn: 0.3 });
  t.step(1.2); t.render(t.at.x, t.at.y + 5, t.at.z - 8, t.at.x, t.at.y + 0.5, t.at.z + 5);
});
await snap('energy-warnings');
await G(() => { const t = window.__t; t.step(1.0); t.render(t.at.x, t.at.y + 5, t.at.z - 8, t.at.x, t.at.y + 0.5, t.at.z + 5); });
await snap('energy-live');
await G(() => { const g = window.__game.debug.game; g.energy.clear(); g.paint.reset(); window.__t.home(); window.__t.step(1.1); });

// ---------- an energy foe: the Keeper ----------
r = await G(() => window.__t.run(() => {
  const D = window.__game.debug, g = D.game, P = g.paint, E = g.energy, t = window.__t, out = {};
  const kp = g.npc('keeper'); kp.show(true);
  const log = [];
  const foe = E.foe({ npc: kp, hp: 4, at: { x: t.at.x, z: t.at.z + 8, yaw: Math.PI }, onHurt: () => log.push('hurt'), onDown: () => log.push('down'), onCopy: (f, left) => log.push(`copy${left}`), onFound: () => log.push('found'), onShield: (f, i, left) => log.push(`shield${i}:${left}`), onWeak: (f, on) => log.push(`weak${on}`) });
  window.__foe = foe; window.__log = log;
  P.setKind('balanced'); P.reset(); t.step(0.6);
  out.model = { energy: !!kp.model.energy, name: kp.spec.name, height: foe.height, meshes: (() => { let n = 0; kp.model.root.traverse((o) => { if (o.isMesh) n++; }); return n; })() };
  out.bar = t.hud();
  out.lock = P.lock === foe.body;
  // pellets on the body do nothing until the weak point is open
  for (let i = 0; i < 3; i++) { P.fire(); t.step(0.15); }
  out.closed = { hp: foe.hp, pop: t.hud().pop };
  foe.exposeWeak(3); t.step(0.3);
  out.open = { exposed: foe.exposed, lock: P.lock === foe.weakTarget, tag: t.hud().tag };
  P.fire(); t.step(0.15); P.fire(); t.step(0.15);
  out.hurt = { hp: foe.hp, bossW: t.hud().bossW };
  t.step(3); // it closes by itself
  out.shut = { exposed: foe.exposed };
  P.reset(); t.step(0.2); P.fire(); t.step(0.15);
  out.shutHp = foe.hp;
  // teleporting: gone, a shimmer where it will appear, then there
  const to = { x: t.at.x + 6, z: t.at.z + 10 };
  out.tpStart = foe.teleport(to, { out: 0.4, wait: 0.7, into: 0.4 });
  t.step(0.2); out.tp1 = { alpha: foe.alpha, teleporting: foe.teleporting, second: foe.teleport(to), shimmer: !!foe.tp?.sh.root.parent, sx: foe.tp?.sh.root.position.x };
  t.step(0.5); out.tp2 = { visible: kp.visible, x: kp.pos.x, bodyOn: foe.body.on };
  P.fire(); t.step(0.1); out.tpHit = foe.hp;
  t.step(1.2); out.tp3 = { visible: kp.visible, x: kp.pos.x, z: kp.pos.z, alpha: foe.alpha, teleporting: foe.teleporting, n: foe.teleports, bodyOn: foe.body.on };
  return out;
}));
check('the Keeper is an energy being (its own model, no person), named "שומר הסף", on the boss bar', r.model.energy && r.model.name === 'שומר הסף' && r.model.height >= 2.8 && r.model.meshes <= 6 && r.bar.boss === 'שומר הסף' && r.lock, JSON.stringify({ model: r.model, tag: r.bar.tag }));
check('pellets on its body do not count while the weak point is closed', r.closed.hp === 4 && r.shutHp === 2 && !r.shut.exposed, JSON.stringify({ closed: r.closed, shutHp: r.shutHp }));
check('exposeWeak: a target the marker locks on to, and pellets on it count (4 -> 2), shown on the bar', r.open.exposed && r.open.lock && r.hurt.hp === 2 && r.hurt.bossW === 50 && r.open.tag === 'נקודת התורפה חשופה!', JSON.stringify({ open: r.open, hurt: r.hurt }));
check('teleport: it fades out with a shimmer at the place it will appear, pellets find nothing meanwhile, then it is there', r.tpStart && r.tp1.teleporting && r.tp1.alpha < 1 && r.tp1.second === false && r.tp1.shimmer && Math.abs(r.tp1.sx - at.x - 6) < 0.01 && !r.tp2.visible && !r.tp2.bodyOn && r.tpHit === 2 && r.tp3.visible && Math.abs(r.tp3.x - at.x - 6) < 0.01 && r.tp3.alpha === 1 && !r.tp3.teleporting && r.tp3.n === 1 && r.tp3.bodyOn, JSON.stringify({ tp1: r.tp1, tp2: r.tp2, tp3: r.tp3 }));

await G(() => { const t = window.__t, f = window.__foe; f.place(t.at.x, t.at.z + 8, Math.PI); f.exposeWeak(4); t.step(0.4); t.render(t.at.x + 1.5, t.at.y + 2.2, t.at.z + 1.5, t.at.x, t.at.y + 1.8, t.at.z + 8); });
await snap('energy-keeper');

// copies
r = await G(() => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t, foe = window.__foe, log = window.__log, out = {};
  foe.hideWeak(); P.reset(); log.length = 0;
  const spots = [{ x: t.at.x - 5, z: t.at.z + 9 }, { x: t.at.x, z: t.at.z + 10 }, { x: t.at.x + 5, z: t.at.z + 9 }];
  out.made = foe.spawnCopies(2, spots);
  t.step(1.4);
  const real = spots.findIndex((s) => Math.hypot(s.x - foe.pos.x, s.z - foe.pos.z) < 0.1);
  out.after = { copies: foe.copies, real, tag: t.hud().tag, shadows: foe.copyList.map((c) => c.model.body.castShadow), inScene: foe.copyList.every((c) => !!c.model.root.parent) };
  // a pellet on a copy pops it
  const c = foe.copyList[0];
  g.player.place(c.pos.x, c.pos.z - 7, 0); g.follow.snapBehind(0); t.step(0.6);
  out.lockCopy = P.lock === c.target;
  P.fire(); t.step(0.2);
  out.popped = { copies: foe.copies, alive: c.alive, inScene: !!c.model.root.parent, hp: foe.hp, log: log.slice() };
  // a pellet on the real one pops the rest
  g.player.place(foe.pos.x, foe.pos.z - 7, 0); g.follow.snapBehind(0); t.step(0.6);
  P.fire(); t.step(0.2);
  out.found = { copies: foe.copies, log: log.slice(), hp: foe.hp };
  return out;
}));
check('spawnCopies: two copies, the real one at the spot left over, "who is the real one?" on the bar', r.made === 2 && r.after.copies === 2 && r.after.real >= 0 && r.after.tag === 'מי האמיתי?' && r.after.inScene && r.after.shadows.every((s) => s === false), JSON.stringify(r.after));
check('a pellet on a copy pops it; a pellet on the real one pops the rest (and costs it nothing by itself)', r.lockCopy && r.popped.copies === 1 && !r.popped.alive && !r.popped.inScene && r.popped.log.includes('copy1') && r.found.copies === 0 && r.found.log.includes('found') && r.found.hp === 2, JSON.stringify({ popped: r.popped, found: r.found }));

// shields: one generator to shoot, one to overload with a bolt, one switched off by the mission
r = await G(() => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, E = g.energy, t = window.__t, foe = window.__foe, log = window.__log, out = {};
  t.home(); foe.place(t.at.x, t.at.z + 8, Math.PI); P.reset(); log.length = 0; foe.vulnerable = true;
  const y = t.at.y + 1.2;
  const a = foe.addShield({ generator: { x: t.at.x - 9, y, z: t.at.z + 2 }, kind: 'shoot', hits: 3 }); // out of the marker's view from where he stands
  const b = foe.addShield({ generator: { x: t.at.x + 5, y, z: t.at.z + 6 }, kind: 'overload' });
  const c = foe.addShield({ generator: { x: t.at.x, y, z: t.at.z + 13 }, kind: 'switch' });
  t.step(0.5);
  out.up = { shielded: foe.shielded, n: foe.shieldsUp, tag: t.hud().tag, bubble: foe.bubble.visible, ids: [a, b, c] };
  for (let i = 0; i < 3; i++) { P.fire(); t.step(0.15); }
  out.blocked = { hp: foe.hp, log: log.filter((l) => l.startsWith('shield-1')).length };
  // the first: three pellets on its generator
  g.player.place(t.at.x - 9, t.at.z - 4, 0); g.follow.snapBehind(0); P.reset(); t.step(0.4);
  out.lockGen = P.lock === foe.shields[a].target;
  let n = 0; while (foe.shields[a].up && n < 6) { P.player.ammo = 8; P.fire(); t.step(0.1); n++; }
  out.shot = { pellets: n, up: foe.shieldsUp };
  // the second: a bolt lured into its generator
  E.bolt({ from: { x: t.at.x + 5, y, z: t.at.z - 4 }, to: { x: t.at.x + 5, y, z: t.at.z + 6 }, speed: 8, warn: 0.2 });
  t.step(2);
  out.overloaded = { up: foe.shieldsUp, bUp: foe.shields[b].up };
  // the third: the mission's console
  out.switched = foe.shieldDown(c); out.twice = foe.shieldDown(c);
  t.step(0.3);
  out.down = { shielded: foe.shielded, bubble: foe.bubble.visible, log: log.filter((l) => /^shield\d/.test(l)) };
  // now pellets count
  t.home(); P.reset(); t.step(0.5);
  P.fire(); t.step(0.15);
  out.after = { hp: foe.hp };
  P.fire(); t.step(0.3);
  out.end = { hp: foe.hp, down: foe.down, log: log.slice(-2), bar: t.hud().boss, pose: foe.model.pose };
  foe.dispose(); t.step(0.2);
  out.disposed = { targets: P.extra.length, foes: E.foes.size, catchers: E.catchers.length, props: P.props.length, visible: g.npc('keeper').visible };
  g.npc('keeper').show(false);
  return out;
}));
check('three shields up: pellets splash on the shield and cost it nothing', r.up.shielded && r.up.n === 3 && r.up.bubble && r.up.tag === 'מגן · 3 מחוללים' && r.blocked.hp === 2 && r.blocked.log === 3, JSON.stringify({ up: r.up, blocked: r.blocked }));
check('each generator its own way: three pellets (the marker locks on to it), a bolt lured into it, the mission\'s switch', r.lockGen && r.shot.pellets === 3 && r.shot.up === 2 && r.overloaded.up === 1 && !r.overloaded.bUp && r.switched === true && r.twice === false && !r.down.shielded && !r.down.bubble && r.down.log.length === 3, JSON.stringify({ shot: r.shot, overloaded: r.overloaded, down: r.down }));
check('shields down: pellets count, and at nothing left it is beaten (onDown, off the bar)', r.after.hp === 1 && r.end.hp === 0 && r.end.down && r.end.log.includes('down') && r.end.bar === null && r.end.pose === 'down', JSON.stringify(r.end));
check('dispose() leaves nothing behind (targets, generators, catchers)', r.disposed.targets === 0 && r.disposed.foes === 0 && r.disposed.catchers === 0 && r.disposed.props === 0, JSON.stringify(r.disposed));

// ---------- the cast: the armoured Shadow, the shield bearer, the heavy, the runner ----------
r = await G(() => {
  const g = window.__game.debug.game, P = g.paint, E = g.energy, t = window.__t, out = {};
  const count = (m) => { let n = 0; m.root.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; };
  const sh = g.npc('shadow'); sh.place(t.at.x - 2, t.at.z + 5, Math.PI); sh.show(true);
  out.shadow = { off: sh.model.armor, meshesOff: count(sh.model) };
  sh.model.setArmor(true); out.shadow.on = sh.model.armor; out.shadow.meshesOn = count(sh.model);
  const foe = E.foe({ npc: sh, hp: 3, bar: false });
  out.shadow.broke = foe.breakArmor(); out.shadow.after = sh.model.armor; out.shadow.again = foe.breakArmor();
  foe.dispose(); sh.model.setArmor(true);
  const ids = { sh: ['sh1', 'sh2', 'sh3'], hv: ['hv1', 'hv2'], rn: ['rn1', 'rn2', 'rn3', 'rn4'], og: ['og1', 'og17', 'og18'] };
  out.ids = Object.fromEntries(Object.entries(ids).map(([k, list]) => [k, list.filter((id) => { try { return !!g.npc(id)?.spec; } catch { return false; } }).length]));
  out.names = [g.npc('sh1').spec.name, g.npc('hv1').spec.name, g.npc('rn1').spec.name];
  let i = 0;
  for (const id of ['sh1', 'hv1', 'rn1', 'keeper']) { const n = g.npc(id); n.place(t.at.x + i * 1.7, t.at.z + 5, Math.PI); n.show(true); i++; }
  out.shield = g.npc('sh1').model.shield;
  t.step(0.5); t.render(t.at.x + 1.6, t.at.y + 1.9, t.at.z - 0.5, t.at.x + 1.6, t.at.y + 1.3, t.at.z + 5);
  return out;
});
await snap('energy-cast');
check('the Shadow\'s energy suit goes on (two more meshes) and breaks off', r.shadow.off === false && r.shadow.on === true && r.shadow.meshesOn === r.shadow.meshesOff + 2 && r.shadow.broke === true && r.shadow.after === false && r.shadow.again === false, JSON.stringify(r.shadow));
check('the Order\'s special people exist: 3 shield bearers, 2 heavies, 4 runners (and og1..og18)', r.ids.sh === 3 && r.ids.hv === 2 && r.ids.rn === 4 && r.ids.og === 3 && r.shield === true, `${JSON.stringify(r.ids)} ${r.names.join(' / ')}`);
await G(() => { const g = window.__game.debug.game, t = window.__t; g.npc('shadow').model.setPose('guard'); t.step(0.4); t.render(t.at.x - 2.9, t.at.y + 1.75, t.at.z + 2.6, t.at.x - 2, t.at.y + 1.25, t.at.z + 5); });
await snap('energy-shadow');

r = await G(() => window.__t.run(() => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t, out = {};
  for (const id of ['shadow', 'keeper', 'hv1', 'rn1']) g.npc(id).show(false);
  P.setKind('balanced'); P.reset(); t.home();
  const face = (n, x, z) => { n.place(x, z, Math.atan2(g.player.pos.x - x, g.player.pos.z - z)); n.show(true); };
  // the shield bearer: from the front the pellet splashes, from behind it marks
  const s1 = g.npc('sh1'); face(s1, t.at.x, t.at.z + 7);
  const gs = P.addGuard(s1, [{ x: t.at.x, z: t.at.z + 7 }], undefined, { still: true });
  const mute = (gd) => { gd.cool = 99; }; // nobody shoots back in these checks
  mute(gs); t.step(0.3); s1.yaw = Math.PI; mute(gs);
  P.fire(); t.step(0.1);
  out.front = { marked: gs.marked, blocked: gs.blocked, pop: t.hud().pop };
  g.player.place(t.at.x, t.at.z + 13, Math.PI); g.follow.snapBehind(Math.PI); s1.yaw = Math.PI; gs.seen = 0; gs.alerted = false; t.step(0.1); s1.yaw = Math.PI; t.step(0.1);
  P.lock = gs; P.fire(); t.step(0.1);
  out.back = { marked: gs.marked, shieldUp: s1.model.shield };
  P.removeGuard(s1); s1.show(false);
  // the heavy: three marks (two from the long marker)
  t.home();
  const h1 = g.npc('hv1'); face(h1, t.at.x, t.at.z + 7);
  const gh = P.addGuard(h1, [{ x: t.at.x, z: t.at.z + 7 }], undefined, { still: true });
  mute(gh); t.step(0.4); mute(gh);
  let n = 0; while (!gh.marked && n < 6) { P.player.ammo = 8; P.lock = gh; P.fire(); t.step(0.1); mute(gh); n++; }
  out.heavy = { pellets: n, tough: gh.toughMax };
  P.revive(gh); mute(gh); P.setKind('long'); t.step(0.2);
  n = 0; while (!gh.marked && n < 6) { P.player.ammo = 5; P.player.cool = 0; P.lock = gh; P.fire(); t.step(0.1); mute(gh); n++; }
  out.heavyLong = n;
  P.removeGuard(h1); h1.show(false); P.setKind('balanced');
  // the runner: no marker; he sprints in, winds up, shoves (a mark and a step back) unless marked first
  t.home(); P.reset();
  const r1 = g.npc('rn1'); face(r1, t.at.x, t.at.z + 11);
  const gr = P.addGuard(r1, [{ x: t.at.x, z: t.at.z + 11 }], undefined, { still: true });
  out.runner = { rush: gr.rush, gun: gr.gun.children.length };
  const t0 = g.time; let windAt = -1;
  const took = t.until(() => { if (gr.wind > 0 && windAt < 0) windAt = g.time - t0; return P.hits > 0; }, 8);
  out.runner.shoved = { took, windAt, hits: P.hits, pushed: t.at.z - g.player.pos.z, pellets: P.shots };
  // again: he is marked on the way in
  P.reset(); t.home(); r1.place(t.at.x, t.at.z + 11, Math.PI); P.revive(gr); t.step(1.0);
  P.lock = gr; P.fire(); t.step(0.2);
  out.runner.marked = { marked: gr.marked, hits: P.hits };
  P.removeGuard(r1); r1.show(false); P.reset();
  return out;
}));
check('the shield bearer: a pellet from the front splashes on his shield, one from behind marks him', !r.front.marked && r.front.blocked === 1 && r.front.pop.includes('המגן בולם') && r.back.marked, JSON.stringify({ front: r.front, back: r.back }));
check('the heavy takes three marks, two from the long marker', r.heavy.pellets === 3 && r.heavy.tough === 3 && r.heavyLong === 2, JSON.stringify({ heavy: r.heavy, long: r.heavyLong }));
check('the runner carries no marker: he sprints in, winds up (a warning of 0.6 s) and shoves: one mark and a step back', r.runner.rush && r.runner.gun === 0 && r.runner.shoved.took > 0 && r.runner.shoved.hits === 1 && r.runner.shoved.windAt > 0 && r.runner.shoved.took - r.runner.shoved.windAt >= 0.55 && r.runner.shoved.pushed > 0.8, JSON.stringify(r.runner.shoved));
check('the runner marked on his way in sits down and shoves nobody', r.runner.marked.marked && r.runner.marked.hits === 0, JSON.stringify(r.runner.marked));

// ---------- the last fist fight: the special attack and the timed openings (the real buttons) ----------
const fight = (opts) => G((opts) => {
  const g = window.__game.debug.game, P = g.paint, t = window.__t;
  P.disarmPlayer(); t.home();
  const n = g.npc('shadow'); n.model.setArmor(false); n.place(t.at.x, t.at.z + 2.2, Math.PI); n.show(true);
  window.__win = null;
  new g.Fight(g, { opponents: [{ npc: n, name: 'הצל', hp: opts.hp ?? 260, boss: !!opts.boss, phases: [], aggression: 0.01, windup: 3 }], onWin: () => { window.__win = true; }, onLose: () => { window.__win = false; }, ...opts.fight });
  t.step(0.5);
  const F = g.fight;
  return { special: t.hud().special, charge: F.charge, opts: F.opts };
}, opts);
const FS = () => G(() => {
  const g = window.__game.debug.game, F = g.fight, t = window.__t, o = F?.opponents[0], f = o?.fighter;
  return F ? { charge: F.charge, specials: F.specials, counters: F.counters, shown: F.openingsShown, opening: !!F.opening, over: F.over, hp: f.hp, state: f.state, floors: f.floors, d: Math.hypot(o.npc.pos.x - g.player.pos.x, o.npc.pos.z - g.player.pos.z), me: g.fighter.state, hud: t.hud(), fov: window.__game.debug.camera.fov, slow: g.slowScale ?? 1, combo: g.fighter.combo, landed: g.fighter.landed } : null;
});
const stepG = (sec) => G((s) => window.__t.step(s), sec);
const tapBtn = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await page.dispatchEvent(`#${id}`, 'pointerup'); };
// keep him in reach: walk back to arm's length after a knock-back
const close = () => G(() => { const g = window.__game.debug.game, o = g.fight?.opponents[0]; if (!o) return; const dx = o.npc.pos.x - g.player.pos.x, dz = o.npc.pos.z - g.player.pos.z, d = Math.hypot(dx, dz); if (d > 1.5) { g.player.place(o.npc.pos.x - (dx / d) * 1.3, o.npc.pos.z - (dz / d) * 1.3, Math.atan2(dx, dz)); } });

// a fight as chapter nine makes it: no special button, no openings
r = await fight({ boss: true, fight: {} });
check('a Fight without the options is as it was: no special button, no meter', r.special === false && r.charge === 0 && !r.opts.special && !r.opts.openings && !r.opts.impact, JSON.stringify(r));
await tapBtn('btnHeavy'); await stepG(1.2);
let fs = await FS();
check('...and a heavy punch there opens no "now!" and charges nothing', fs.shown === 0 && !fs.hud.opening && fs.charge === 0 && fs.hud.special === false, JSON.stringify({ shown: fs.shown, charge: fs.charge }));
await G(() => window.__game.debug.game.fight.dispose());

r = await fight({ boss: true, hp: 300, fight: { finale: true } });
const fov0 = (await FS()).fov;
check('the last fight (finale): the special button is on screen with an empty meter', r.special === true && r.charge === 0 && r.opts.special && r.opts.openings && r.opts.impact, JSON.stringify(r));
// layout: the six fight buttons clear of each other and of the stick, landscape and portrait
const layout = async (label) => {
  const L = await G(() => { const c = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { id, x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2, r: b.width / 2, l: b.left, t: b.top, rt: b.right, b: b.bottom }; }; return { buttons: ['btnPunch', 'btnHeavy', 'btnShove', 'btnBlock', 'btnDodge', 'btnSpecial'].map(c), stick: c('stick'), w: innerWidth, h: innerHeight }; });
  const bad = [];
  for (const b of L.buttons) { if (b.l < 0 || b.t < 0 || b.rt > L.w || b.b > L.h || b.r < 20) bad.push(`${b.id} off screen`); if (Math.hypot(b.x - L.stick.x, b.y - L.stick.y) < b.r + L.stick.r + 4) bad.push(`${b.id} over the stick`); }
  for (let i = 0; i < L.buttons.length; i++) for (let j = i + 1; j < L.buttons.length; j++) { const a = L.buttons[i], b = L.buttons[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 2) bad.push(`${a.id} touches ${b.id}`); }
  check(`${label}: the six fight buttons fit the screen, clear of each other and of the stick`, !bad.length, bad.join('; ') || L.buttons.map((b) => `${b.id.slice(3)} ${Math.round(b.x)},${Math.round(b.y)}`).join(' · '));
};
await layout('landscape');
await page.setViewportSize({ width: 390, height: 844 }); await stepG(0.1);
await layout('portrait');
await page.setViewportSize({ width: 844, height: 390 }); await stepG(0.1);

// pressed before it has charged: nothing but a word
await tapBtn('btnSpecial'); await stepG(0.3);
fs = await FS();
check('the special pressed before it has charged does nothing ("עוד לא טעון")', fs.specials === 0 && fs.me !== 'attack' && fs.hud.pop === 'עוד לא טעון' && !fs.hud.ready, fs.hud.pop);
// landed hits charge it: punches and heavy punches with the real buttons
let presses = 0, sawOpening = 0, counters0 = 0;
for (let i = 0; i < 60 && (await FS()).charge < 1; i++) {
  await close();
  await tapBtn(i % 4 === 3 ? 'btnHeavy' : 'btnPunch'); presses++;
  await stepG(i % 4 === 3 ? 1.5 : 0.45);
}
fs = await FS();
check('landed hits fill the meter; full, the button lights up', fs.charge >= 1 && fs.hud.ready && fs.landed >= 5, `charge ${r2(fs.charge)} after ${presses} presses, ${fs.landed} landed, counters ${fs.counters}`);
await G(() => { const t = window.__t, g = window.__game.debug.game; t.render(); });
await snap('energy-special-ready');
await stepG(1.2); await close(); await stepG(0.2);
const before = await FS();
await tapBtn('btnSpecial');
let minSlow = 1, minFov = fov0, landedAt = -1;
for (let i = 0; i < 60; i++) {
  await stepG(1 / 30);
  const q = await FS();
  if (!q) break;
  minSlow = Math.min(minSlow, q.slow); minFov = Math.min(minFov, q.fov);
  if (q.specials === 1 && landedAt < 0) { landedAt = i / 30; await G(() => window.__t.render()); await snap('energy-special-hit'); }
}
fs = await FS();
check('the special lands with its real button: a big hit, he is thrown back and floored, the meter is spent', fs.specials === 1 && before.hp - fs.hp >= 50 && fs.floors >= before.floors + 1 && fs.charge < 0.5 && fs.d > before.d + 0.5 && landedAt > 0.3, JSON.stringify({ dmg: r2(before.hp - fs.hp), floors: fs.floors, charge: r2(fs.charge), d0: r2(before.d), d1: r2(fs.d), landedAt: r2(landedAt) }));
check('...as a short film: time slows as it lands and the camera pushes in, then both are back', minSlow <= 0.25 && minFov < fov0 * 0.8 && fs.slow === 1 && Math.abs(fs.fov - fov0) < 0.01, `slowest ${r2(minSlow)}, fov ${r2(minFov)} of ${fov0}, now ${r2(fs.slow)} / ${r2(fs.fov)}`);

// a timed opening: a heavy punch staggers him, "now!" shows, the punch pressed in time is a counter
const openOnce = async () => {
  for (let i = 0; i < 12; i++) {
    await stepG(0.6); await close(); await stepG(0.1);
    const a = await FS(); if (a.state !== 'idle' || a.me !== 'idle') { await stepG(0.5); continue; }
    await tapBtn('btnHeavy');
    for (let k = 0; k < 40; k++) { await stepG(1 / 30); const q = await FS(); if (q.opening) return q; }
  }
  return null;
};
let o1 = await openOnce();
check('a heavy punch that staggers him shows "עכשיו!" for a moment', !!o1 && o1.hud.opening, o1 ? `shown ${o1.shown}` : 'never opened');
await G(() => window.__t.render()); await snap('energy-opening');
await stepG(0.42); // the heavy punch's own time runs out; the window (0.85 s) is still open
let mid = await FS();
const hpBefore = mid.hp, cBefore = mid.counters;
await tapBtn('btnPunch'); await stepG(0.6);
fs = await FS();
check('the punch pressed in time lands a counter (through his guard, double)', mid.opening && fs.counters === cBefore + 1 && hpBefore - fs.hp >= 25 && !fs.hud.opening, JSON.stringify({ counters: fs.counters, dmg: r2(hpBefore - fs.hp), pop: fs.hud.pop }));
// missed: the window closes by itself and the late punch is an ordinary one
o1 = await openOnce();
await stepG(1.0);
mid = await FS();
const c2 = mid.counters;
await close(); await tapBtn('btnPunch'); await stepG(0.5);
fs = await FS();
check('missing the moment costs nothing: the prompt goes, the late punch is an ordinary one', !!o1 && !mid.opening && !mid.hud.opening && fs.counters === c2, JSON.stringify({ counters: fs.counters }));

// win it with the buttons (the special again when it is charged)
let won = null;
for (let i = 0; i < 260 && won === null; i++) {
  const q = await FS(); if (!q || q.over) break;
  await close();
  if (q.charge >= 1 && q.state !== 'floored' && q.state !== 'rising') { await tapBtn('btnSpecial'); await stepG(1.6); } else if (q.opening) { await tapBtn('btnPunch'); await stepG(0.5); } else { await tapBtn(i % 3 === 2 ? 'btnHeavy' : 'btnPunch'); await stepG(i % 3 === 2 ? 1.3 : 0.45); }
  won = await G(() => window.__win);
}
fs = await G(() => { const g = window.__game.debug.game, t = window.__t; t.step(1.5); return { hud: t.hud(), fov: window.__game.debug.camera.fov, slow: g.slowScale ?? 1, own: Object.prototype.hasOwnProperty.call(g, 'update'), specials: g.fight?.specials, counters: g.fight?.counters }; });
check('the fight is won with the buttons; afterwards the special button, the prompt, the camera and time are as before', won === true && !fs.hud.special && !fs.hud.opening && Math.abs(fs.fov - fov0) < 0.01 && fs.slow === 1 && fs.own === false, JSON.stringify({ won, specials: fs.specials, counters: fs.counters, fov: fs.fov, slow: fs.slow, wrapped: fs.own }));
await G(() => { const g = window.__game.debug.game; g.fight?.dispose(); g.npc('shadow').show(false); });

// game.slowmo by itself: the game runs slower for a moment, then as before
r = await G(() => {
  const g = window.__game.debug.game, t = window.__t;
  const t0 = g.time; g.slowmo(0.25, 1.0); t.step(0.6); const mid = g.time - t0, k = g.slowScale;
  t.step(1.0); const t1 = g.time; t.step(1.0);
  return { mid, k, after: g.time - t1, own: Object.prototype.hasOwnProperty.call(g, 'update') };
});
check('game.slowmo(0.25, 1): a quarter speed for a second, then full speed and nothing left behind', Math.abs(r.mid - 0.15) < 0.02 && r.k === 0.25 && Math.abs(r.after - 1) < 0.01 && r.own === false, JSON.stringify(r));

check('no errors in the console', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
