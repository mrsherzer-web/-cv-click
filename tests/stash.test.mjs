// Chapter nine: the gang's markers taken and given back (src/combat/paint.js stash() / unstash(), kept in
// progress.stash). Nehorai and three friends armed (Ido with a colour of his own, so "his own" is not just
// the default), Muller on overwatch, a guard of the Black Order posted: everyone fires; then the stash:
// no gun in any hand, the fire, reload and mark buttons gone, a press of fire says "אין נשק", nobody of the
// gang fires, the guard keeps his; again (nothing lost), paint disposed (nothing lost), the page reloaded
// (still unarmed, the same list); then unstash: each one his own colour back, the buttons back, everyone
// fires again; again (nothing happens); a marker handed out on purpose while stashed is no longer owed;
// a stash named on a fresh page; markers given back one at a time.
// usage: node tests/stash.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });

const GANG = { erez: '#ff9180', ido: '#00e08a', dolev: '#f5d04a' }; // Ido's is not his default: his own is what he had
const PINK = '#ff5c8a';
const KEY = 'nehorai-game:save:v1';

async function boot() {
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
  await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
}

// an open spot (no wall on the lines between the gang and a guard 9 m ahead), the gang formed there, Muller
// on a post beside it and a guard of the Order standing ahead with his back to them
const stage = () => G(({ GANG }) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = g.paint;
  const open = (x, z) => {
    const y = W.groundHeight(x, z);
    for (const [ax, az] of [[0, 0], [-1.6, -1], [1.6, -1], [-1.6, -2.4], [1.6, -2.4], [0, -2.6]]) {
      for (const [bx, bz] of [[0, 9], [-1, 9], [1, 9]]) if (W.cols.raycast(x + ax, y + 1.3, z + az, x + bx, y + 1.2, z + bz, null) !== null) return false;
      if (W.cols.blocks(x + ax, y + 0.9, z + az, null)) return false;
    }
    return Math.abs(W.groundHeight(x, z + 9) - y) < 1 && Math.abs(W.groundHeight(x - 1.6, z - 2.4) - y) < 1;
  };
  let at = null;
  for (let x = 1260; x <= 1400 && !at; x += 12) for (let z = -120; z <= 120 && !at; z += 15) if (open(x, z)) at = { x, z };
  if (!at) return null;
  g.player.place(at.x, at.z, 0); g.follow.snapBehind(0);
  g.squad.form(Object.keys(GANG), { near: { x: at.x, z: at.z, y: g.player.pos.y }, yaw: 0, leader: 'nehorai' });
  g.squad.command('hold', { quiet: true });
  const mu = g.npc('muller'); mu.place(at.x + 3, at.z - 1, 0); mu.show(true);
  const gd = g.npc('og1'); gd.place(at.x, at.z + 9, 0); gd.show(true);
  if (!P.guards.some((q) => q.npc === gd)) P.addGuard(gd, [{ x: at.x, z: at.z + 9 }], undefined, { still: true });
  return at;
}, { GANG });

// whose pellets flew (shooter ids, 'player' for Nehorai) while the world was stepped by hand; for the
// count nobody goes down meanwhile (a mark is logged, not taken), so everyone who can fire keeps firing
const stepShots = (seconds) => G((seconds) => {
  const g = window.__game.debug.game, P = g.paint, log = [], proto = Object.getPrototypeOf(P);
  P.pellet = function (from, to, shooter, o) { log.push(shooter === g.player ? 'player' : shooter?.id); return proto.pellet.call(this, from, to, shooter, o); };
  P.markGuard = (gd, by) => { log.push(`marked-by:${by === 'player' ? 'player' : by?.npc?.id || by}`); };
  P.markAlly = () => {}; P.markPlayer = () => {};
  g.hold = true;
  for (let i = 0; i < Math.round(seconds * 30); i++) g.update(1 / 30);
  g.hold = false;
  for (const k of ['pellet', 'markGuard', 'markAlly', 'markPlayer']) delete P[k];
  g.update(1 / 30); // one frame free: the buttons follow what is in hand
  return log;
}, seconds);

const look = () => G(({ KEY }) => {
  const g = window.__game.debug.game, P = g.paint;
  const guns = (model) => { const out = []; model.root.traverse((o) => { if (o.name === 'paint-gun') out.push(o); }); return out; };
  const colours = (gun) => { const c = []; gun.traverse((o) => { if (o.isMesh) c.push(`#${o.material.color.getHexString()}`); }); return c; };
  const hand = (model) => guns(model).map(colours);
  const shown = (id) => !!document.getElementById(id).offsetParent;
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY)).stash; } catch { /* none */ }
  const gd = P.guards.find((q) => q.npc.id === 'og1');
  return {
    stashed: P.stashed, contents: P.stashContents, saved,
    player: P.player ? { color: P.player.color, ammo: P.player.ammo } : null,
    allies: Object.fromEntries(P.allies.map((a) => [a.npc.id, a.color])),
    overwatch: P.overwatch ? { id: P.overwatch.npc.id, post: P.overwatch.post } : null,
    hands: { nehorai: hand(g.nehorai), erez: hand(g.npc('erez').model), ido: hand(g.npc('ido').model), dolev: hand(g.npc('dolev').model) },
    guard: gd ? { guns: guns(gd.npc.model).length, gunShown: gd.gun.visible, marked: gd.marked } : null,
    buttons: { fire: shown('btnFire'), reload: shown('btnReload'), mark: shown('btnMark') },
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
    shots: P.shots,
  };
}, { KEY });
const press = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await wait(120); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const gangFired = (log) => Object.keys(GANG).filter((id) => log.includes(id));

// ---------- a chapter-nine game, the gang armed ----------
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(({ KEY }) => { const p = window.__game.debug.game.progressForChapter(9); p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, { KEY });
await page.reload();
await boot();
check('page boots without errors', errors.length === 0, errors[0] || '');
let at = await stage();
check('an open spot for the gang and a guard ahead', !!at, at ? `${at.x}, ${at.z}` : 'none found');
await G(({ GANG, PINK }) => {
  const g = window.__game.debug.game, P = g.paint, at = g.player.pos;
  P.armPlayer(PINK);
  for (const [id, c] of Object.entries(GANG)) P.addAlly(g.npc(id), c);
  P.setOverwatch({ npc: g.npc('muller'), post: { x: at.x + 3, y: at.y, z: at.z - 1 } });
  g.update(1 / 30);
}, { GANG, PINK });
let L = await look();
check('armed: Nehorai and his friends each hold a marker in their colour', L.player?.color === PINK && same(L.allies, GANG) && L.hands.nehorai.length === 1 && L.hands.nehorai[0].includes(PINK) && Object.keys(GANG).every((id) => L.hands[id].length === 1 && L.hands[id][0].includes(GANG[id])), JSON.stringify(L.allies));
check('armed: fire, reload and the overwatch mark button on screen', L.buttons.fire && L.buttons.reload && L.buttons.mark, JSON.stringify(L.buttons));
await G(() => window.__game.debug.game.paint.reset());
let log = await stepShots(6);
check('armed: the friends shoot at the guard they can see', gangFired(log).length === Object.keys(GANG).length, `pellets by ${[...new Set(log)].join(', ')}`);
await press('btnFire');
L = await look();
check('armed: a press of fire shoots (a pellet out of the hopper)', L.player?.ammo === 7, `ammo ${L.player?.ammo}`);
await wait(1500);
await snap('stash-1-armed');

// ---------- the stash ----------
// (everyone back on his feet first, the guard too: whatever the paint did meanwhile)
const before = await G(() => { const P = window.__game.debug.game.paint; P.reset(); return P.stash(); });
L = await look();
check('stash: it remembers who carried what (Nehorai\'s colour, each friend by id and colour, the overwatch at his post)',
  same(before?.player, { color: PINK }) && same(Object.fromEntries((before?.allies || []).map((a) => [a.id, a.color])), GANG) && before?.overwatch?.id === 'muller' && Number.isFinite(before?.overwatch?.post?.x),
  JSON.stringify(before));
check('stash: nobody holds a marker (no gun in any hand), the overwatch is off', !L.player && same(L.allies, {}) && !L.overwatch && Object.values(L.hands).every((h) => h.length === 0), JSON.stringify(L.hands));
check('stash: paint.stashed, and the list is in progress.stash and saved', L.stashed && same(L.contents, before) && same(L.saved, before));
check('stash: the fire, reload and mark buttons are hidden', !L.buttons.fire && !L.buttons.reload && !L.buttons.mark, JSON.stringify(L.buttons));
check('stash: the guard of the Order keeps his marker', L.guard && L.guard.guns === 1 && L.guard.gunShown && !L.guard.marked, JSON.stringify(L.guard));
const shots0 = L.shots;
await press('btnFire');
L = await look();
check('stash: a press of fire says "אין נשק" and shoots nothing', L.toast === 'אין נשק' && L.shots === shots0, `toast "${L.toast}", shots ${shots0} → ${L.shots}`);
await G(() => document.getElementById('toast').classList.remove('show'));
await press('btnReload');
L = await look();
check('stash: a press of reload says "אין נשק" too, nothing to reload', L.toast === 'אין נשק' && !L.player);
const direct = await G(() => { const P = window.__game.debug.game.paint; return { fire: P.fire(), mark: P.mark() }; });
check('stash: fire() and mark() do nothing', direct.fire === false && direct.mark === false);
log = await stepShots(6);
check('stash: nobody of the gang fires (and the guard has nobody armed to shoot at)', gangFired(log).length === 0 && !log.includes('player') && !log.includes('muller'), `pellets by ${[...new Set(log)].join(', ') || 'nobody'}`);
L = await look();
check('stash: the guard is still on the board, marker in hand', L.guard && L.guard.guns === 1 && L.guard.gunShown);
const again = await G(() => window.__game.debug.game.paint.stash());
check('stash again: nothing changes, nothing is lost', same(again, before));
await G(() => window.__game.debug.game.paint.dispose());
L = await look();
check('paint disposed: the stash is kept (still stashed, the same list)', L.stashed && same(L.contents, before) && same(L.saved, before));
await stage();
await wait(1500);
await snap('stash-2-stashed');

// ---------- a reload in the middle ----------
await page.reload();
await boot();
at = await stage();
await G(() => window.__game.debug.game.update(1 / 30));
L = await look();
check('after a reload: still stashed, the same list, nobody armed', L.stashed && same(L.contents, before) && !L.player && same(L.allies, {}) && Object.values(L.hands).every((h) => h.length === 0), JSON.stringify(L.contents));
check('after a reload: the fire, reload and mark buttons stay hidden', !L.buttons.fire && !L.buttons.reload && !L.buttons.mark, JSON.stringify(L.buttons));
await press('btnFire');
L = await look();
check('after a reload: fire still says "אין נשק"', L.toast === 'אין נשק');

// ---------- unstash ----------
const gave = await G(() => window.__game.debug.game.paint.unstash());
await G(() => window.__game.debug.game.update(1 / 30));
L = await look();
check('unstash: Nehorai gets his own marker back, in his colour', gave === true && L.player?.color === PINK && L.hands.nehorai.length === 1 && L.hands.nehorai[0].includes(PINK), JSON.stringify(L.player));
check('unstash: every friend gets exactly his own back (Ido his own green, not the default)', same(L.allies, GANG) && Object.keys(GANG).every((id) => L.hands[id].length === 1 && L.hands[id][0].includes(GANG[id])), JSON.stringify(L.allies));
check('unstash: the overwatch is back at his post', L.overwatch?.id === 'muller' && same(L.overwatch.post, before.overwatch.post));
check('unstash: nothing left in the stash, and that is saved', !L.stashed && L.contents === null && L.saved === null);
check('unstash: the fire, reload and mark buttons are back', L.buttons.fire && L.buttons.reload && L.buttons.mark, JSON.stringify(L.buttons));
await G(() => window.__game.debug.game.paint.reset()); // the guard on his feet, whatever the paint did since
log = await stepShots(8);
check('unstash: every friend fires again', gangFired(log).length === Object.keys(GANG).length, `pellets by ${[...new Set(log)].join(', ')}`);
await press('btnFire');
L = await look();
check('unstash: a press of fire shoots again', L.player?.ammo === 7, `ammo ${L.player?.ammo}`);
const twice = await G(() => window.__game.debug.game.paint.unstash());
L = await look();
check('unstash again: nothing happens', twice === false && L.player?.color === PINK && same(L.allies, GANG));
await G(() => window.__game.debug.game.paint.reset());
await wait(1500);
await snap('stash-3-unstashed');

// ---------- a marker handed out on purpose while stashed ----------
const handed = await G(({ PINK }) => {
  const P = window.__game.debug.game.paint;
  P.stash();
  P.armPlayer(PINK);
  const mid = P.stashContents;
  const back = P.unstash();
  return { mid, back, stashed: P.stashed, allies: P.allies.map((a) => a.npc.id).sort() };
}, { PINK });
check('armed on purpose while stashed: his entry is no longer owed, the others still are; unstash gives theirs', handed.mid && handed.mid.player === null && handed.mid.allies.length === 3 && handed.back && !handed.stashed && same(handed.allies, ['dolev', 'erez', 'ido']), JSON.stringify(handed));

// ---------- a stash named on a fresh page, given back one at a time ----------
const parts = await G(({ GANG }) => {
  const P = window.__game.debug.game.paint, out = {};
  P.dispose(); P.setOverwatch(null);
  out.none = P.stashed;
  out.named = P.stash({ player: true, allies: ['erez', { id: 'ido', color: GANG.ido }] });
  P.unstash('ido'); out.afterIdo = { allies: P.allies.map((a) => [a.npc.id, a.color]), player: !!P.player, left: P.stashContents };
  P.unstash('player'); out.afterPlayer = { player: P.player?.color, left: P.stashContents };
  P.unstash(); out.afterAll = { allies: P.allies.map((a) => [a.npc.id, a.color]).sort(), stashed: P.stashed };
  return out;
}, { GANG });
check('a stash named on a fresh page: the player and the friends named are in it, in their colours', parts.none === false && same(parts.named?.player, { color: PINK }) && same(parts.named?.allies, [{ id: 'erez', color: GANG.erez }, { id: 'ido', color: GANG.ido }]), JSON.stringify(parts.named));
check('given back one at a time: Ido first, then the player, then the rest', same(parts.afterIdo.allies, [['ido', GANG.ido]]) && !parts.afterIdo.player && parts.afterIdo.left?.player && parts.afterPlayer.player === PINK && parts.afterPlayer.left?.allies.length === 1 && same(parts.afterAll.allies, [['erez', GANG.erez], ['ido', GANG.ido]]) && !parts.afterAll.stashed, JSON.stringify(parts));

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
