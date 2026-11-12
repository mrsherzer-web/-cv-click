// Chapter ten's moves in headless Chromium: crawling (speed, the pose, the low camera, running and standing
// refused), helped up by a friend, a leap over a 3 m gap and a climb up a 1.6 m ledge driven by the real
// #btnInteract, a timed leap missed and made, a friend given a hand, a phasing platform that carries and
// drops (the rift guard puts the player back), a stasis field that holds whoever is inside when it fires, a
// disturbance that knocks back and marks once a second at most. Disposing everything leaves the renderer's
// geometry and texture counts, the scene, the pads and the floors as they were, and the page reports no
// errors. The moves stand on a rig of decks the test lays over the open plain (walk-only pads, 3 m up).
// The loop is held and stepped here (game.hold, game.update) so game time is exact at 1-2 frames a second.
// usage: node tests/moves.test.mjs [url] [screenshot dir]
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
ctx.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const snap = (name) => page.screenshot({ path: `${shots}/moves-${name}.png` });
const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));
// a real tap on a real button (a button under another layer would not take it: that is counted at the end)
let taps = 0, missedTaps = 0;
async function press(sel) { taps++; try { await page.tap(sel, { timeout: 15000 }); } catch { missedTaps++; await page.dispatchEvent(sel, 'pointerdown', { button: 0 }); } }

// a finished game: a quiet open world, no mission beginning by itself
await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify(window.__game.debug.game.progressForChapter(11))));
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
await G(() => {
  const W = window.__game, g = W.debug.game, T = W.debug.THREE, world = W.debug.world;
  g.missions.stop(); g.cutscene = false; g.setPopulation({ traffic: 0, people: 0 });
  document.getElementById('banner').hidden = true;
  g.hold = true; // the loop stops; the test steps the game itself
  g.daylight.set(0.35, 0);
  // n steps of 1/30 s of game time, then (if asked) one picture from the game's own camera
  window.__step = (n = 1, render = false) => {
    const d = g.daylight;
    for (let i = 0; i < n; i++) { g.update(1 / 30); d.update(1 / 30); }
    if (render) window.__draw();
  };
  window.__draw = () => { const d = g.daylight; d.sky.follow(W.debug.camera, g.nehorai.root.position); world.tick(W.debug.camera, 1 / 30); W.debug.renderer.render(W.debug.scene, W.debug.camera); return W.debug.renderer.info.render.calls; };
  // a picture from a chosen place
  window.__view = (from, look) => { const c = W.debug.camera; c.position.set(from.x, from.y, from.z); c.lookAt(look.x, look.y, look.z); return window.__draw(); };
  // the stick pushed toward a direction of the world (null lets go); `run` is the run button held by a bot
  window.__go = (dx, dz, run = false) => {
    g.botInput = dx == null ? null : (input) => { const c = g.follow.yaw, l = Math.hypot(dx, dz) || 1, x = dx / l, z = dz / l; return { ...input, move: { x: x * Math.cos(c) - z * Math.sin(c), y: -x * Math.sin(c) - z * Math.cos(c) }, run: run || input.run }; };
  };
  window.__mem = () => { const m = W.debug.renderer.info.memory; return { geo: m.geometries, tex: m.textures, kids: W.debug.scene.children.length, pads: world.net.pads.length, floors: world.cols.floors.length, statics: world.cols.count }; };
  // the rig: decks 3 m over the plain
  const x0 = 1120, z0 = -200, y0 = world.groundHeight(x0, z0), top = y0 + 3, rig = [];
  const deck = (x, z, hx, hz, y, color = '#7d8794') => {
    const pad = world.net.addPad({ x, z, hx, hz, yaw: 0, h: y - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'rig' });
    const m = new T.Mesh(new T.BoxGeometry(hx * 2, 0.4, hz * 2), new T.MeshStandardMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y - 0.2, z); W.debug.scene.add(m); rig.push({ pad, m });
    return { x, z, y, hx, hz };
  };
  const R = (window.R = { y0, top });
  R.A = deck(x0, z0, 4, 4, top);                              // where it starts
  R.B = deck(x0 + 11, z0, 4, 4, top);                         // across a 3 m gap (A ends at +4, B begins at +7)
  R.C = deck(x0 + 11, z0 - 7, 4, 3, top + 1.6, '#93856f');    // a ledge 1.6 m up, north of B (its face at z0 - 4)
  world.cols.addBox(R.C.x, R.C.z, 4, 3, 0, y0 - 1, top + 1.4);  // ...a solid block: nobody walks in under it
  R.D = deck(x0 + 22, z0, 3, 4, top);                         // beyond B (B ends at +15, D begins at +19): platforms bridge it
  const e = (window.E = g.npc('erez'));
  e.idle = null; e.floorY = null; e.model.setPose(null); e.show(true);
  window.__start = (x, z, yaw, y = top) => { W.teleport(x, z, y); g.player.yaw = yaw; g.follow.snapBehind(yaw); g.follow.pitch = 0.2; g.follow.idle = 0; };
  // the kit's prompts through the game's own prompt (the mission's step would forward them the same way)
  const K = (window.K = new g.moves.Kit());
  window.__act = { update(dt) { K.update(dt); }, interaction: (game) => K.interaction(game) };
  g.activities.push(window.__act);
});
const moves = await G(() => Object.keys(window.__game.debug.game.moves).sort().join(' '));
check('the moves are on the game (game.moves)', ['Climb', 'Disturbance', 'Kit', 'Leap', 'PhasePlatform', 'StasisField', 'Switch', 'giveHand', 'helpUp', 'riftGuard'].every((k) => moves.includes(k)), moves);

// ---------- crawling ----------
await G(() => { const R = window.R; window.__start(R.A.x - 3, R.A.z, Math.PI / 2); window.E.place(R.A.x - 3, R.A.z + 3, Math.PI, R.top); window.__go(1, 0); window.__step(60); });
const stand = await G(() => { const g = window.__game.debug.game, P = g.player; return { speed: P.speed, cam: window.__game.debug.camera.position.y - P.pos.y, dist: g.follow.dist, low: g.follow.low, crawling: P.crawling, height: P.height }; });
check('standing: he walks at his own pace, the camera where it always was', Math.abs(stand.speed - 2.4) < 0.1 && stand.low === 0 && stand.cam > 1.9 && !stand.crawling && stand.height === 1.8, `speed ${f2(stand.speed)}, camera ${f2(stand.cam)} m up, ${f2(stand.dist)} m back`);
await G(() => { const g = window.__game.debug.game; window.__go(null); window.__step(10); g.player.crawl(true); window.__step(45, true); });
await snap('crawl-rest');
await press('#btnRun'); // the run button, pressed for real
const crawl = await G(() => {
  const g = window.__game.debug.game, P = g.player, x0 = P.pos.x;
  window.__go(1, 0, true); // ...and held by the bot too
  window.__step(60);
  const p = P.pos;
  window.__view({ x: p.x + 0.3, y: p.y + 0.9, z: p.z + 2.4 }, { x: p.x + 0.2, y: p.y + 0.25, z: p.z });
  return { speed: P.speed, went: p.x - x0, running: P.running, runBtn: g.controls.run, pressed: document.getElementById('btnRun').getAttribute('aria-pressed'), pose: g.nehorai.pose, crawling: P.crawling, cam: 0, low: g.follow.low, height: P.height, action: g.nehorai.action };
});
await snap('crawl-side');
const crawlCam = await G(() => { const g = window.__game.debug.game, P = g.player; window.__step(2, true); return { cam: window.__game.debug.camera.position.y - P.pos.y, dist: g.follow.dist }; });
await snap('crawl-move');
check('crawling: slow (0.9 m/s), down in the prone pose, the flag up', crawl.crawling && crawl.pose === 'prone' && Math.abs(crawl.speed - 0.9) < 0.06 && crawl.went > 1.5 && crawl.went < 1.9 && crawl.height < 1, `speed ${f2(crawl.speed)}, ${f2(crawl.went)} m in 2 s, pose ${crawl.pose}, reaching with ${crawl.action}`);
check('crawling: the run button does nothing (pressed for real and held by a bot)', !crawl.running && crawl.runBtn === false && crawl.pressed === 'false', `running ${crawl.running}, button ${crawl.pressed}`);
check('crawling: the camera low and close', crawlCam.cam < stand.cam - 0.8 && crawlCam.cam < 1.3 && crawlCam.dist < 2.7 && crawl.low === 1, `${f2(crawlCam.cam)} m up (standing ${f2(stand.cam)}), ${f2(crawlCam.dist)} m back`);
const refused = await G(() => {
  const g = window.__game.debug.game, P = g.player;
  g.nehorai.setPose(null); window.__step(3); const a = g.nehorai.pose;          // someone asks him to stand
  g.nehorai.setPose('guard'); window.__step(3); const b = g.nehorai.pose;       // ...or to put his fists up
  window.__go(-1, 0, true);                                                      // (back the way he came: the deck is 8 m long)
  P.speedScale = 0.5; window.__step(30); const slow = P.speed; P.speedScale = 1; // the slow walk of the wounded scales the crawl too
  P.crawl(true, { speed: 1.2 }); window.__step(30); const fast = P.speed; P.crawl(true, { speed: 0.9 });
  return { a, b, slow, fast, still: P.crawling };
});
check('crawling: standing is refused until crawl(false)', refused.a === 'prone' && refused.b === 'prone' && refused.still, `after setPose(null): ${refused.a}, after setPose('guard'): ${refused.b}`);
check('crawling works with speedScale, and its own speed can be set', Math.abs(refused.slow - 0.45) < 0.05 && Math.abs(refused.fast - 1.2) < 0.08, `speedScale 0.5 → ${f2(refused.slow)} m/s; crawl speed 1.2 → ${f2(refused.fast)}`);
await G(() => { window.__go(null); window.__step(10); window.__game.debug.game.player.crawl(false); window.__go(-1, 0); window.__step(30); });
await press('#btnRun');
const up = await G(() => { const g = window.__game.debug.game, P = g.player; const walk = P.speed; window.__step(15); const r = { walk, run: P.speed, running: P.running, pose: g.nehorai.pose, low: g.follow.low, cam: window.__game.debug.camera.position.y - P.pos.y, x: P.pos.x - window.R.A.x }; g.controls.setRun(false); window.__go(null); window.__step(10); return r; });
check('crawl(false): on his feet, walking and running again, the camera back up', up.pose === null && Math.abs(up.walk - 2.4) < 0.1 && up.running && up.run > 5.5 && up.low === 0 && Math.abs(up.cam - stand.cam) < 0.15 && Math.abs(up.x) < 4, `walk ${f2(up.walk)}, run ${f2(up.run)}, camera ${f2(up.cam)} m up, pose ${up.pose}, low ${up.low}, x ${f2(up.x)}`);

// ---------- helped up ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R;
  window.__start(R.A.x - 1, R.A.z, Math.PI / 2);
  window.E.place(R.A.x - 3.5, R.A.z + 2.5, 0, R.top);
  g.player.crawl(true); window.__step(20);
  window.help = { done: 0 };
  window.H = g.moves.helpUp(g, window.E, { onDone: () => window.help.done++ });
});
const h1 = await G(() => {
  const g = window.__game.debug.game, P = g.player, x0 = P.pos.x, z0 = P.pos.z;
  window.__go(1, 0); // the stick is pushed all the way through: it must do nothing
  window.__step(45);
  const p = P.pos;
  window.__view({ x: p.x + 2.7, y: p.y + 1.5, z: p.z + 1.5 }, { x: p.x, y: p.y + 0.6, z: p.z - 0.3 });
  return { state: window.H.state, t: window.H.t, busy: P.busy, moved: Math.hypot(p.x - x0, p.z - z0), friend: Math.hypot(window.E.pos.x - p.x, window.E.pos.z - p.z), crawling: P.crawling, hipsF: window.E.model.bones.hips.position.y };
});
await snap('help-1-kneel');
check('helped up: the friend comes to his side and goes down on a knee; the stick does nothing meanwhile', h1.state === 'lift' && h1.busy && h1.moved < 0.01 && h1.friend < 0.75 && h1.hipsF < 0.75, `friend ${f2(h1.friend)} m away, his hips at ${f2(h1.hipsF)} m, the player moved ${f2(h1.moved)} m`);
const h2 = await G(() => { const g = window.__game.debug.game, P = g.player, p = P.pos; window.__step(28); window.__view({ x: p.x + 2.7, y: p.y + 1.5, z: p.z + 1.5 }, { x: p.x, y: p.y + 0.75, z: p.z - 0.3 }); return { t: window.H.t, crawling: P.crawling, hips: g.nehorai.bones.hips.position.y, armL: Math.max(Math.abs(g.nehorai.bones.shL.rotation.z), Math.abs(g.nehorai.bones.shR.rotation.z)) }; });
await snap('help-2-lift');
check('helped up: he comes up onto his knees with an arm over the friend (the crawl ends as the lift begins)', !h2.crawling && h2.hips > 0.4 && h2.hips < 0.8 && Math.abs(h2.armL) > 1, `hips ${f2(h2.hips)} m, arm out ${f2(h2.armL)} rad`);
await G(() => { const p = window.__game.debug.game.player.pos; window.__step(34); window.__view({ x: p.x + 2.7, y: p.y + 1.5, z: p.z + 1.5 }, { x: p.x, y: p.y + 0.9, z: p.z - 0.3 }); });
await snap('help-3-rise');
const h3 = await G(() => {
  const g = window.__game.debug.game, P = g.player;
  let n = 0; while (window.H.active && n < 240) { window.__step(1); n++; }
  const x0 = P.pos.x; window.__step(45, true);
  const r = { done: window.help.done, hdone: window.H.done, active: window.H.active, busy: P.busy, crawling: P.crawling, pose: g.nehorai.pose, hips: g.nehorai.bones.hips.position.y, went: P.pos.x - x0, speed: P.speed, frames: n, friendTask: g.squad.tasks.size, friendBody: window.E.body.enabled };
  window.__go(null); window.__step(5);
  return r;
});
await snap('help-4-after');
check('helped up: it ends standing, with control (he walks off), onDone once', h3.done === 1 && h3.hdone && !h3.active && !h3.busy && !h3.crawling && h3.pose === null && h3.hips > 0.9 && h3.went > 2.5 && Math.abs(h3.speed - 2.4) < 0.1, `hips ${f2(h3.hips)} m, walked ${f2(h3.went)} m in 1.5 s, onDone ×${h3.done}`);

// ---------- the other way round: a friend who is down is lifted by the player ----------
const lifted = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, E = window.E;
  E.place(R.A.x + 1, R.A.z + 1, Math.PI / 2, R.top); E.model.setPose('down'); E.target = null;
  window.__start(R.A.x + 0.2, R.A.z + 2.4, 0); window.__step(20);
  window.help.lift = 0;
  const L = g.moves.liftUp(g, E, { onDone: () => window.help.lift++ });
  window.__go(1, 0);
  window.__step(40);
  const mid = { state: L.state, busy: P.busy, d: Math.hypot(E.pos.x - P.pos.x, E.pos.z - P.pos.z), kneeling: g.nehorai.bones.hips.position.y, pose: E.model.pose };
  let n = 0; while (L.active && n++ < 240) window.__step(1);
  const x0 = P.pos.x; window.__step(30); window.__go(null);
  return { mid, done: L.done, cb: window.help.lift, busy: P.busy, pose: E.model.pose, hips: E.model.bones.hips.position.y, went: P.pos.x - x0, ex: E.pos.x - (R.A.x + 1), ez: E.pos.z - (R.A.z + 1), body: E.body.enabled };
});
check('liftUp: the player kneels by a friend who is down and gets him on his feet; control back, onDone once', lifted.mid.state === 'lift' && lifted.mid.busy && lifted.mid.d < 0.75 && lifted.mid.kneeling < 0.75 && lifted.done && lifted.cb === 1 && !lifted.busy && lifted.pose === null && lifted.hips > 0.9 && lifted.went > 1.5 && Math.hypot(lifted.ex, lifted.ez) < 0.05, `the player's hips at ${f2(lifted.mid.kneeling)} m beside him; the friend's at ${f2(lifted.hips)} m at the end`);

// ---------- a leap over the 3 m gap, by the real button; Erez (in the squad) follows by himself ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  window.__start(R.A.x + 1.4, R.A.z, Math.PI / 2);
  g.squad.form(['erez'], { near: { x: R.A.x + 1.4, z: R.A.z, y: R.top }, yaw: Math.PI / 2, leader: 'nehorai' });
  window.leap = { land: 0, miss: 0, start: 0 };
  window.L = window.K.add(new M.Leap(g, { from: { x: R.A.x + 3.6, z: R.A.z, y: R.top }, to: { x: R.B.x - 3.4, z: R.B.z, y: R.top }, friendsFollow: [window.E], onStart: () => window.leap.start++, onLand: () => window.leap.land++, onMiss: () => window.leap.miss++ }));
  window.__step(3);
});
const far = await G(() => window.__game.state.prompt);
await G(() => { window.__go(1, 0); let n = 0; while (window.__game.debug.game.player.pos.x < window.R.A.x + 3.3 && n++ < 90) window.__step(1); window.__go(null); window.__step(6); });
const nearEdge = await G(() => ({ prompt: window.__game.state.prompt, shown: !document.getElementById('btnInteract').hidden, x: window.__game.debug.game.player.pos.x - window.R.A.x }));
check('a leap: the prompt "לקפוץ" only at the edge', far !== 'לקפוץ' && nearEdge.prompt === 'לקפוץ' && nearEdge.shown, `2 m back: ${far}; at the edge: ${nearEdge.prompt}`);
await press('#btnInteract');
const air = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  window.__go(1, 0); // the stick pushed in the air does nothing
  window.__step(14);
  const p = P.pos, r = { state: window.L.state, x: p.x - R.A.x, y: p.y - R.top, busy: P.busy, started: window.leap.start, erez: window.E.pos.x - R.A.x, held: g.squad.tasks.has('erez') };
  window.__view({ x: R.A.x + 5.5, y: R.top + 1.5, z: R.A.z + 6.5 }, { x: R.A.x + 5.5, y: R.top + 0.9, z: R.A.z });
  return r;
});
await snap('leap-air');
check('a leap: in the air over the gap, in an arc, the friend held back meanwhile', air.state === 'air' && air.x > 4.2 && air.x < 6.8 && air.y > 0.5 && air.busy && air.started === 1 && air.erez < 4 && air.held, `${f2(air.x - 4)} m out over the gap, ${f2(air.y)} m up`);
const landed = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  let n = 0; while (window.L.active && n < 90) { window.__step(1); n++; }
  const at = { x: P.pos.x - (R.B.x - 3.4), z: P.pos.z - R.B.z, y: P.pos.y - R.top, busy: P.busy, land: window.leap.land, miss: window.leap.miss, respawns: P.respawns };
  window.__step(40); const went = P.pos.x - (R.B.x - 3.4); window.__go(null);
  let m = 0; while (window.L.holding && m < 200) { window.__step(1); m++; }
  window.__step(20);
  return { ...at, went, friend: { x: window.E.pos.x - R.A.x, y: window.E.pos.y - R.top, held: g.squad.tasks.has('erez'), frames: m } };
});
check('a leap: he lands where he should on the far deck and has control again', Math.abs(landed.x) < 0.05 && Math.abs(landed.z) < 0.05 && Math.abs(landed.y) < 0.02 && !landed.busy && landed.land === 1 && landed.miss === 0 && landed.went > 2 && landed.respawns === 0, `${f2(landed.x)}, ${f2(landed.z)} from the spot; then walked ${f2(landed.went)} m`);
check('a leap: the friend follows by himself a moment later and is with the squad again', landed.friend.x > 7 && Math.abs(landed.friend.y) < 0.05 && !landed.friend.held, `Erez ${f2(landed.friend.x - 7)} m onto the far deck after ${f2(landed.friend.frames / 30)} s`);

// ---------- a timed leap onto a phasing platform: missed, then made ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  window.K.remove(window.L);
  g.squad.dismiss();
  window.E.place(R.B.x - 2, R.B.z + 2, Math.PI / 2, R.top);
  window.__start(R.B.x + 3.5, R.B.z, Math.PI / 2);
  // B ends at +4 (world R.B.x + 4); the platform floats 2 m out: there 2 s of every 4
  window.PL = window.K.add(new M.PhasePlatform(g, { x: R.B.x + 6, z: R.B.z, hx: 1, hz: 1.2, y: R.top, period: 4, on: 2 }));
  window.L2 = window.K.add(new M.Leap(g, { from: { x: R.B.x + 3.6, z: R.B.z, y: R.top }, to: { x: R.B.x + 6, z: R.B.z, y: R.top }, onto: window.PL, twoWay: true, onMiss: (n) => { window.leap.miss = n; } }));
  window.leap.miss = 0;
  window.__step(48); // 1.6 s in: it goes in 0.4 s, sooner than a leap takes
});
const before = await G(() => ({ prompt: window.__game.state.prompt, left: window.PL.left, solid: window.PL.solid, open: window.L2.open, x: window.__game.debug.game.player.pos.x }));
await press('#btnInteract');
const missed = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  let n = 0, low = 0; while ((window.L2.active || P.busy) && n < 120) { window.__step(1); n++; low = Math.min(low, P.pos.y - R.top); }
  window.__step(5);
  return { misses: window.L2.misses, cb: window.leap.miss, leaps: window.L2.leaps, x: P.pos.x - (R.B.x + 3.5), z: P.pos.z - R.B.z, y: P.pos.y - R.top, low, busy: P.busy, respawns: P.respawns, hits: g.paint.hits, frames: n };
});
check('a timed leap, too late: a miss, and he is back at the near edge (never down the hole for good, never a fail)', before.prompt === 'לקפוץ' && before.solid && missed.misses === 1 && missed.cb === 1 && missed.leaps === 0 && Math.abs(missed.x) < 0.3 && Math.abs(missed.z) < 0.3 && Math.abs(missed.y) < 0.02 && missed.low < -0.3 && !missed.busy && missed.respawns === 0 && missed.hits === 0, `pressed ${f2(before.left)} s before it went; fell ${f2(-missed.low)} m, back ${f2(Math.hypot(missed.x, missed.z))} m from where he jumped`);
await G(() => { let n = 0; while (!(window.PL.solid && window.PL.left > 1.9) && n++ < 200) window.__step(1); });
await press('#btnInteract');
const made = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  let n = 0; while (window.L2.active && n < 90) { window.__step(1); n++; }
  return { leaps: window.L2.leaps, misses: window.L2.misses, x: P.pos.x - (R.B.x + 6), y: P.pos.y - R.top, solid: window.PL.solid, ground: window.__game.debug.world.groundHeight(P.pos.x, P.pos.z, P.pos.y) - R.top, prompt: (window.__step(2), window.__game.state.prompt) };
});
check('a timed leap, in time: he lands on the platform (and is offered the way back)', made.leaps === 1 && made.misses === 1 && Math.abs(made.x) < 0.05 && Math.abs(made.y) < 0.02 && made.solid && Math.abs(made.ground) < 0.02 && made.prompt === 'לקפוץ', `${f2(made.x)} m from its middle`);

// ---------- the platform carries him while it is there and drops him when it goes; the rift guard puts him back ----------
const carried = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, M = g.moves, W = window.__game.debug.world;
  window.rift = { falls: 0 };
  window.RG = window.K.add(M.riftGuard(g, { minY: R.top - 1.5, safe: () => ({ x: R.B.x + 3, z: R.B.z, y: R.top, yaw: Math.PI / 2 }), friends: [window.E], onFall: (n) => { window.rift.falls = n; } }));
  const on = [], PL = window.PL;
  let n = 0, wentAt = -1, minY = 0, back = -1;
  while (n < 150) {
    window.__step(1); n++;
    if (PL.solid && wentAt < 0) on.push(P.pos.y - R.top);
    if (!PL.solid && wentAt < 0) wentAt = n;
    minY = Math.min(minY, P.pos.y - R.top);
    if (window.rift.falls && back < 0) { back = n; break; }
  }
  return { stood: on.length, steady: Math.max(...on.map(Math.abs)), wentAt, back, minY, gravity: P.gravity, falls: window.RG.falls, x: P.pos.x - (R.B.x + 3), z: P.pos.z - R.B.z, y: P.pos.y - R.top, respawns: P.respawns, hits: g.paint.hits, frozen: P.frozen,
    covered: PL.pad.covered, under: W.groundHeight(PL.x, PL.z, R.top) - R.top, floor: W.cols.floorBetween(PL.x, PL.z, R.top - 1, R.top + 1) };
});
check('a phasing platform carries him while it is there', carried.stood > 20 && carried.steady < 0.02, `${carried.stood} frames standing on it, never more than ${f2(carried.steady)} m off its top`);
check('...and drops him when it goes: its walking surface and its floor are really gone', carried.wentAt > 0 && !carried.covered && carried.under < -2.5 && !carried.floor && carried.minY < -1, `gone at frame ${carried.wentAt}; the ground under it ${f2(carried.under)} m; he fell ${f2(-carried.minY)} m`);
check('the rift guard: he falls through the air and is put back on the safe stone, no fail, held still for a beat', carried.gravity && carried.falls === 1 && carried.back > carried.wentAt && carried.back - carried.wentAt < 20 && Math.abs(carried.x) < 0.05 && Math.abs(carried.z) < 0.05 && Math.abs(carried.y) < 0.02 && carried.respawns === 0 && carried.hits === 0 && carried.frozen > 0, `back ${carried.back - carried.wentAt} frames after it went`);
const solidAgain = await G(() => {
  const g = window.__game.debug.game, R = window.R, W = window.__game.debug.world, PL = window.PL;
  let n = 0; while (!PL.solid && n++ < 150) window.__step(1);
  const r = { covered: PL.pad.covered, under: W.groundHeight(PL.x, PL.z, R.top) - R.top, floor: W.cols.floorBetween(PL.x, PL.z, R.top - 1, R.top + 1), left: PL.left };
  PL.lock(true); window.__step(150); r.locked = PL.solid && PL.left === Infinity; PL.lock(null); window.__step(1); r.unlocked = PL.left < 4;
  // Erez walks off the edge by himself: the guard brings him back beside the player
  const E = window.E; E.place(R.B.x + 3.9, R.B.z + 1, 0, R.top); E.walkTo(R.B.x + 6, R.B.z + 3, { run: true });
  window.__step(60);
  r.erez = { brought: window.RG.brought, y: E.pos.y - R.top, d: Math.hypot(E.pos.x - g.player.pos.x, E.pos.z - g.player.pos.z), stopped: !E.target };
  return r;
});
check('...and it is back with its surface and its floor; a switch can hold it there (lock)', solidAgain.covered && Math.abs(solidAgain.under) < 0.02 && solidAgain.floor && solidAgain.locked && solidAgain.unlocked, `back for ${f2(solidAgain.left)} s; locked: ${solidAgain.locked}`);
check('the rift guard: a friend who falls is put beside the player', solidAgain.erez.brought === 1 && Math.abs(solidAgain.erez.y) < 0.05 && solidAgain.erez.d < 1.6 && solidAgain.erez.stopped, `brought back ×${solidAgain.erez.brought}; now ${f2(solidAgain.erez.d)} m from the player`);
// the pictures: there, and gone
await G(() => { const R = window.R, PL = window.PL; let n = 0; while (!(PL.solid && PL.left > 1.2) && n++ < 200) window.__step(1); window.__view({ x: R.B.x + 4.6, y: R.top + 3, z: R.B.z + 6 }, { x: R.B.x + 5.4, y: R.top + 0.3, z: R.B.z }); });
await snap('platform-solid');
await G(() => { const R = window.R, PL = window.PL; let n = 0; while (!(PL.solid && PL.left < 0.35) && n++ < 200) window.__step(1); window.__view({ x: R.B.x + 4.6, y: R.top + 3, z: R.B.z + 6 }, { x: R.B.x + 5.4, y: R.top + 0.3, z: R.B.z }); });
await snap('platform-warning');
await G(() => { const R = window.R, PL = window.PL; let n = 0; while (PL.solid && n++ < 200) window.__step(1); window.__step(12); window.__view({ x: R.B.x + 4.6, y: R.top + 3, z: R.B.z + 6 }, { x: R.B.x + 5.4, y: R.top + 0.3, z: R.B.z }); });
await snap('platform-gone');

// ---------- a climb up the 1.6 m ledge, by the real button; then Erez is given a hand ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  window.K.remove(window.L2); window.K.remove(window.PL); window.K.remove(window.RG);
  g.squad.form(['erez'], { near: { x: R.B.x, z: R.B.z - 1, y: R.top }, yaw: Math.PI, leader: 'nehorai' });
  window.__start(R.B.x, R.B.z - 1.5, Math.PI);
  window.climb = { top: 0, down: 0, hand: 0 };
  window.C = window.K.add(new M.Climb(g, { bottom: { x: R.B.x, z: R.B.z - 3.6, y: R.top }, top: { x: R.B.x, z: R.B.z - 4.9, y: R.top + 1.6 }, onTop: () => window.climb.top++, onDown: () => window.climb.down++ }));
  window.HH = window.K.add(M.giveHand(g, window.E, { from: { x: R.B.x + 1.3, z: R.B.z - 3.6, y: R.top }, to: { x: R.B.x + 1.3, z: R.B.z - 5, y: R.top + 1.6 }, onDone: () => window.climb.hand++ }));
  window.__step(3);
});
const noClimb = await G(() => window.__game.state.prompt);
await G(() => { window.__go(0, -1); let n = 0; while (window.__game.debug.game.player.pos.z > window.R.B.z - 3.3 && n++ < 90) window.__step(1); window.__go(null); window.__step(6); });
const atFoot = await G(() => window.__game.state.prompt);
check('a climb: the prompt "לטפס" only at the foot of the ledge', noClimb !== 'לטפס' && atFoot === 'לטפס', `2 m back: ${noClimb}; at its foot: ${atFoot}`);
await press('#btnInteract');
const pull = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  window.__go(0, -1); window.__step(22);
  const r = { state: window.C.state, y: P.pos.y - R.top, z: P.pos.z - R.B.z, busy: P.busy, arms: g.nehorai.bones.shL.rotation.x };
  window.__view({ x: R.B.x + 4.6, y: R.top + 2.4, z: R.B.z - 1.6 }, { x: R.B.x + 0.4, y: R.top + 1.2, z: R.B.z - 4.2 });
  return r;
});
await snap('climb-pull');
check('a climb: he hangs on the edge and pulls himself up', pull.state === 'up' && pull.y > 0.2 && pull.y < 1.5 && Math.abs(pull.z + 3.6) < 0.05 && pull.busy, `${f2(pull.y)} m up the face`);
const topped = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  let n = 0; while (window.C.active && n < 120) { window.__step(1); n++; }
  const at = { x: P.pos.x - R.B.x, z: P.pos.z - (R.B.z - 4.9), y: P.pos.y - (R.top + 1.6), busy: P.busy, cb: window.climb.top };
  window.__step(30); const went = (R.B.z - 4.9) - P.pos.z; window.__go(null); window.__step(4);
  return { ...at, went, y2: P.pos.y - (R.top + 1.6), respawns: P.respawns };
});
check('a climb: he stands on top where he should and has control again', Math.abs(topped.x) < 0.05 && Math.abs(topped.z) < 0.05 && Math.abs(topped.y) < 0.02 && !topped.busy && topped.cb === 1 && topped.went > 1.5 && Math.abs(topped.y2) < 0.02 && topped.respawns === 0, `${f2(topped.x)}, ${f2(topped.z)} from the spot; then walked ${f2(topped.went)} m on the ledge`);
// back to the edge: the friend has been kept at the foot of the ledge (the squad would have brought him round)
const waiting = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  window.__go(0, 1); let n = 0; while (P.pos.z < R.B.z - 5.1 && n++ < 90) window.__step(1); window.__go(null);
  window.__step(150); // five seconds: longer than the squad waits before it moves a stuck friend
  return { prompt: window.__game.state.prompt, erezY: window.E.pos.y - R.top, d: Math.hypot(window.E.pos.x - (R.B.x + 1.3), window.E.pos.z - (R.B.z - 3.6)), held: g.squad.tasks.has('erez'), parked: window.HH.parked };
});
check('giving a hand: the friend waits at the foot of the ledge and the player on top is offered "לתת יד לארז"', waiting.prompt === 'לתת יד לארז' && Math.abs(waiting.erezY) < 0.05 && waiting.d < 0.6 && waiting.held && waiting.parked, `Erez ${f2(waiting.d)} m from his spot, still below`);
await press('#btnInteract');
await G(() => { const R = window.R; window.__step(20); window.__view({ x: R.B.x + 4.6, y: R.top + 2.4, z: R.B.z - 2.4 }, { x: R.B.x + 1, y: R.top + 1.3, z: R.B.z - 4.2 }); });
await snap('hand-pull');
const handed = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, E = window.E;
  const mid = { y: E.pos.y - R.top, busy: P.busy, state: window.HH.state };
  let n = 0; while (window.HH.active && n < 150) { window.__step(1); n++; }
  const r = { mid, done: window.HH.done, cb: window.climb.hand, ex: E.pos.x - (R.B.x + 1.3), ez: E.pos.z - (R.B.z - 5), ey: E.pos.y - (R.top + 1.6), busy: P.busy, py: P.pos.y - (R.top + 1.6), held: g.squad.tasks.has('erez'), prompt: (window.__step(3), window.__game.state.prompt) };
  window.__step(60); r.after = E.pos.y - (R.top + 1.6);
  return r;
});
check('giving a hand: the friend is pulled up onto the ledge beside him; both free again', handed.mid.state === 'pull' && handed.mid.busy && handed.mid.y > 0.05 && handed.done && handed.cb === 1 && Math.abs(handed.ex) < 0.1 && Math.abs(handed.ez) < 0.1 && Math.abs(handed.ey) < 0.03 && !handed.busy && Math.abs(handed.py) < 0.03 && !handed.held && handed.prompt !== 'לתת יד לארז' && Math.abs(handed.after) < 0.05, `Erez ${f2(Math.hypot(handed.ex, handed.ez))} m from his spot on top`);
const downed = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  g.squad.dismiss();
  window.__start(R.B.x, R.B.z - 4.9, 0, R.top + 1.6); window.__step(4);
  const prompt = window.__game.state.prompt;
  g.prompt.run();
  let n = 0; while (window.C.active && n < 120) { window.__step(1); n++; }
  return { prompt, y: P.pos.y - R.top, z: P.pos.z - (R.B.z - 3.6), busy: P.busy, cb: window.climb.down };
});
check('a climb: the way back down is offered from the top ("לרדת")', downed.prompt === 'לרדת' && Math.abs(downed.y) < 0.02 && Math.abs(downed.z) < 0.05 && !downed.busy && downed.cb === 1, `at the foot again, ${f2(downed.z)} m from the spot`);

// ---------- the stasis field ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  window.K.remove(window.C); window.K.remove(window.HH);
  window.field = { fired: [] };
  // on deck D: every 5 s it winds up for 1.4 s and holds whoever is inside for 2 s
  window.F = window.K.add(new M.StasisField(g, { x: R.D.x, z: R.D.z, r: 2.2, y: R.top, period: 5, hold: 2, onFire: (n) => window.field.fired.push(n) }));
  window.__start(R.D.x - 0.5, R.D.z, Math.PI / 2); // inside it
  window.E.place(R.D.x + 0.6, R.D.z + 1.2, 0, R.top); // Erez inside too, on his way somewhere
  window.__step(48); // 1.6 s: it has begun to wind up (it fires at 3 s)
  window.__view({ x: R.D.x - 5, y: R.top + 3.2, z: R.D.z + 6 }, { x: R.D.x, y: R.top + 0.9, z: R.D.z });
});
const wind = await G(() => ({ winding: window.F.winding, firesIn: window.F.firesIn, opacity: window.F.mat.opacity, ring: window.F.ring.scale.x / window.F.r, frozen: window.__game.debug.game.player.frozen }));
await snap('stasis-winding');
check('a stasis field winds up before it fires (it can be timed): brighter, the ring closing in', wind.winding && wind.firesIn > 1.2 && wind.firesIn < 1.5 && wind.ring > 1.05 && wind.frozen === 0, `fires in ${f2(wind.firesIn)} s, the ring at ${f2(wind.ring)}× its edge`);
const held = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, E = window.E;
  window.__step(40); // 2.93 s: just before it fires
  E.walkTo(R.D.x + 0.6, R.D.z - 1.4, { near: 0.3 }); // Erez sets off across it
  window.__go(1, 0); // the stick pushed the whole time
  let n = 0; while (!window.F.fired && n++ < 20) window.__step(1);
  const x0 = P.pos.x, ez0 = E.pos.z, t0 = g.time;
  window.__step(30); // one second into the hold
  const mid = { frozen: P.frozen, moved: Math.abs(P.pos.x - x0), erez: Math.abs(E.pos.z - ez0), emissive: g.nehorai.body.material.emissive.b, frost: document.getElementById('frost')?.style.opacity, caught: window.field.fired[0] };
  window.__draw();
  return { mid, x0, t0 };
});
await snap('stasis-held');
const freed = await G(({ x0, t0 }) => {
  const g = window.__game.debug.game, P = g.player, R = window.R, E = window.E;
  let n = 0; while (P.frozen > 0 && n++ < 90) window.__step(1);
  const heldFor = g.time - t0, at = Math.abs(P.pos.x - x0);
  window.__step(30);
  const r = { heldFor, at, went: P.pos.x - x0, emissive: g.nehorai.body.material.emissive.b, frost: document.getElementById('frost')?.style.opacity, holding: window.F.holding };
  window.__go(null);
  let m = 0; while (E.target && m++ < 120) window.__step(1);
  r.erez = { z: E.pos.z - (R.D.z - 1.4), emissive: E.model.body.material.emissive.b };
  return r;
}, held);
check('a stasis field holds whoever is inside when it fires: the player (the stick does nothing, a frost on him and on the screen) and a friend', held.mid.frozen > 0.8 && held.mid.moved < 0.01 && held.mid.erez < 0.01 && held.mid.emissive > 0.3 && held.mid.frost === '1' && held.mid.caught === 2, `caught ${held.mid.caught}; in a second of pushing the player moved ${f2(held.mid.moved)} m and Erez ${f2(held.mid.erez)} m`);
check('...for its hold time, and then they go on', Math.abs(freed.heldFor - 2) < 0.1 && freed.at < 0.02 && freed.went > 1.5 && freed.emissive === 0 && freed.frost === '0' && !freed.holding && Math.abs(freed.erez.z) < 0.4 && freed.erez.emissive === 0, `held ${f2(freed.heldFor)} s; then walked ${f2(freed.went)} m; Erez reached his spot`);
const outside = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R;
  window.__start(R.D.x - 2.6, R.D.z + 3.2, Math.PI / 2); // on the deck, outside the field
  window.E.place(R.A.x - 3, R.A.z + 3, 0, R.top);
  let n = 0; while (window.F.fired < 2 && n++ < 200) window.__step(1);
  const frozen = P.frozen, x0 = P.pos.x;
  window.__go(1, 0); window.__step(20); const went = P.pos.x - x0; window.__go(null);
  // walking in after it fired is safe
  window.__start(R.D.x, R.D.z, Math.PI / 2); window.__step(10);
  return { frozen, went, caught: window.field.fired[1], inAfter: P.frozen, still: window.F.frozen };
});
check('...and not otherwise: outside it he is not held, and walking in after it fired is safe', outside.frozen === 0 && outside.went > 1 && outside.caught === 0 && outside.inAfter === 0 && outside.still, `outside: walked ${f2(outside.went)} m while it fired`);

// ---------- the disturbance ----------
await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  g.paint.reset(); window.dist = { touches: [] };
  // along deck A, up and down past the player
  window.D = window.K.add(new M.Disturbance(g, { path: [{ x: R.A.x - 3, z: R.A.z - 2, y: R.top }, { x: R.A.x + 3, z: R.A.z - 2, y: R.top }], speed: 3, r: 0.9, onTouch: (n) => window.dist.touches.push(n) }));
  window.__start(R.A.x + 1.5, R.A.z - 2, Math.PI); // standing on its way, 4.5 m along
  window.__step(20);
  window.__view({ x: R.A.x - 1, y: R.top + 2.6, z: R.A.z + 4.5 }, { x: R.A.x + 0.5, y: R.top + 0.8, z: R.A.z - 2 });
});
await snap('disturbance');
const hit = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, D = window.D;
  const before = { hits: g.paint.hits, trail: !!D.trail, x: D.pos.x - R.A.x };
  let n = 0; while (!D.touches && n++ < 90) window.__step(1);
  const at = { ball: { x: D.pos.x, z: D.pos.z }, me: { x: P.pos.x, z: P.pos.z }, hits: g.paint.hits, t: g.time };
  window.__step(12);
  const knocked = Math.hypot(P.pos.x - at.me.x, P.pos.z - at.me.z), away = Math.hypot(P.pos.x - D.pos.x, P.pos.z - D.pos.z);
  // put straight back into it, again and again, until 0.93 s after the first mark: it may not mark twice in a second
  let again = 0; for (let i = 0; i < 16; i++) { window.__game.teleport(D.pos.x + 0.2, D.pos.z, R.top); window.__step(1); again = g.paint.hits; }
  const within = { hits: again, touches: D.touches };
  let m = 0; while (g.paint.hits < 2 && m++ < 60) { window.__game.teleport(D.pos.x + 0.2, D.pos.z, R.top); window.__step(1); }
  return { before, hits: at.hits, knocked, away, within, later: { hits: g.paint.hits, after: g.time - at.t }, y: P.pos.y - R.top, respawns: P.respawns, marks: document.getElementById('paintHits').children.length, cb: window.dist.touches.slice() };
});
check('a disturbance drifts along a path drawn on the ground and knocks him back on touch', hit.before.trail && hit.hits === 1 && hit.knocked > 1.6 && hit.knocked < 3, `knocked ${f2(hit.knocked)} m back`);
check('...and counts one mark: once, never more than once a second however long he stays in it', hit.before.hits === 0 && hit.within.hits === 1 && hit.within.touches === 1 && hit.later.hits === 2 && hit.later.after >= 1 && hit.later.after < 1.3 && hit.marks === 2 && hit.cb.join() === '1,2', `put back into it for half a second: ${hit.within.hits} mark; the second ${f2(hit.later.after)} s after the first`);
const cold = await G(() => {
  const g = window.__game.debug.game, P = g.player, R = window.R, M = g.moves;
  g.paint.reset();
  window.__start(R.D.x - 2.6, R.D.z + 3.4, 0);
  // a ball that hangs inside the field: held when it fires, and harmless while it is
  const D2 = window.K.add(new M.Disturbance(g, { path: [{ x: R.D.x - 1, z: R.D.z, y: R.top }, { x: R.D.x + 1, z: R.D.z, y: R.top }], speed: 1.5, r: 0.8 }));
  const fired = window.F.fired; let n = 0; while (window.F.fired === fired && n++ < 200) window.__step(1);
  const x0 = D2.pos.x, s0 = D2.s; window.__step(20);
  const r = { frozen: D2.frozen, drift: Math.abs(D2.pos.x - x0) + Math.abs(D2.s - s0) };
  window.__game.teleport(D2.pos.x + 0.2, D2.pos.z, R.top); window.__step(5); r.hits = g.paint.hits; r.touches = D2.touches;
  window.__start(R.D.x - 2.6, R.D.z + 3.4, 0);
  let m = 0; while (D2.frozen > 0 && m++ < 90) window.__step(1);
  const s1 = D2.s; window.__step(20); r.after = D2.s - s1;
  window.K.remove(D2);
  return r;
});
check('a disturbance inside a stasis field when it fires is held too, and harmless meanwhile', cold.frozen > 0 && cold.drift < 0.001 && cold.hits === 0 && cold.touches === 0 && cold.after > 0.5, `held: drifted ${f2(cold.drift)} m; then ${f2(cold.after)} m along its path in 0.67 s`);

// ---------- a switch ----------
const sw = await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves;
  window.sw = { used: [] };
  window.S = window.K.add(new M.Switch(g, { at: { x: R.A.x - 2, z: R.A.z + 2, y: R.top, yaw: 0 }, label: 'לייצב את האבן', onUse: (on) => window.sw.used.push(on) }));
  window.__start(R.A.x - 2, R.A.z + 2, 0); window.__step(3);
  return { prompt: window.__game.state.prompt };
});
await press('#btnInteract');
const sw2 = await G(() => { window.__step(3); return { used: window.sw.used.join(), on: window.S.on, prompt: window.__game.state.prompt }; });
check('a switch: a prompt at it, thrown by the real button, once', sw.prompt === 'לייצב את האבן' && sw2.used === 'true' && sw2.on && sw2.prompt !== 'לייצב את האבן', `onUse(${sw2.used})`);

// ---------- everything made and disposed: nothing left behind ----------
const leak = await G(() => {
  const g = window.__game.debug.game, R = window.R, M = g.moves, W = window.__game.debug.world;
  window.K.dispose();
  g.paint.reset();
  window.__start(R.A.x, R.A.z, Math.PI / 2);
  window.__step(90); window.__draw();
  window.__view({ x: R.A.x + 6, y: R.top + 9, z: R.A.z + 16 }, { x: R.A.x + 9, y: R.top, z: R.A.z + 1 });
  const before = window.__mem(), calls0 = window.__draw();
  let callsWith = 0;
  for (let round = 0; round < 3; round++) {
    const K = new M.Kit();
    for (let i = 0; i < 6; i++) K.add(new M.PhasePlatform(g, { x: R.B.x + 5 + i * 2.2, z: R.B.z + 6, hx: 0.9, hz: 1.1, y: R.top, period: 4, on: 2, offset: i * 0.7 }));
    K.add(new M.StasisField(g, { x: R.A.x + 1, z: R.A.z, r: 2, y: R.top, period: 2, hold: 0.8, warn: 0.6 }));
    K.add(new M.StasisField(g, { x: R.B.x, z: R.B.z, r: 2, y: R.top, period: 3, hold: 1 }));
    K.add(new M.Disturbance(g, { path: [{ x: R.A.x - 3, z: R.A.z - 3, y: R.top }, { x: R.A.x + 3, z: R.A.z - 3, y: R.top }, { x: R.A.x + 3, z: R.A.z + 3, y: R.top }], loop: true }));
    K.add(new M.Disturbance(g, { path: [{ x: R.B.x - 3, z: R.B.z - 2, y: R.top }, { x: R.B.x + 3, z: R.B.z - 2, y: R.top }] }));
    K.add(new M.Switch(g, { at: { x: R.A.x - 3, z: R.A.z - 3, y: R.top, yaw: 0 } }));
    const leap = K.add(new M.Leap(g, { from: { x: R.A.x + 3.6, z: R.A.z, y: R.top }, to: { x: R.B.x - 3.4, z: R.B.z, y: R.top } }));
    K.add(new M.Climb(g, { bottom: { x: R.B.x, z: R.B.z - 3.6, y: R.top }, top: { x: R.B.x, z: R.B.z - 4.9, y: R.top + 1.6 } }));
    K.add(M.giveHand(g, window.E, { from: { x: R.B.x + 1.3, z: R.B.z - 3.6, y: R.top }, to: { x: R.B.x + 1.3, z: R.B.z - 5, y: R.top + 1.6 } }));
    K.add(M.riftGuard(g, { minY: R.top - 1.5 }));
    for (let i = 0; i < 110; i++) { g.update(1 / 30); K.update(1 / 30); } // the player stands in the first field: caught twice, and still held at the end
    window.__view({ x: R.A.x + 6, y: R.top + 9, z: R.A.z + 16 }, { x: R.A.x + 9, y: R.top, z: R.A.z + 1 });
    callsWith = window.__draw();
    if (round === 1) { leap.start(); for (let i = 0; i < 8; i++) { g.update(1 / 30); K.update(1 / 30); } } // disposed in the middle of a leap
    K.dispose();
  }
  window.__step(30);
  window.__view({ x: R.A.x + 6, y: R.top + 9, z: R.A.z + 16 }, { x: R.A.x + 9, y: R.top, z: R.A.z + 1 });
  const calls1 = window.__draw(), after = window.__mem(), P = g.player;
  return { before, after, calls0, callsWith, calls1, busy: P.busy, gravity: P.gravity, crawling: P.crawling, frost: !!document.getElementById('frost'), y: P.pos.y - R.top, emissive: g.nehorai.body.material.emissive.b, acts: g.activities.length };
});
check('dispose leaves the renderer\'s geometries and textures, the scene, the pads, the floors and the colliders as they were (three rounds of the whole kit)', JSON.stringify(leak.before) === JSON.stringify(leak.after) && !leak.frost, `${JSON.stringify(leak.before)} → ${JSON.stringify(leak.after)}`);
check('...and the player as he was: free, on the deck, no gravity, no frost (one of the rounds was cut in the middle of a leap)', !leak.busy && !leak.gravity && !leak.crawling && Math.abs(leak.y) < 0.02 && leak.emissive === 0, `y ${f2(leak.y)}`);
check('the whole kit in view costs a handful of draw calls (6 platforms, 2 fields, 2 balls with their paths, a switch: 16 at most)', leak.callsWith - leak.calls1 <= 16 && leak.calls1 <= leak.calls0, `${leak.calls1} → ${leak.callsWith} draw calls from the same place (${leak.calls0} before the three rounds)`);

check('every tap landed on its button (nothing lies over the run and interact buttons)', missedTaps === 0, `${taps - missedTaps}/${taps}`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
