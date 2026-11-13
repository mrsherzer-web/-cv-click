// Chapter ten's finale (engine piece 4): the crowd of Katzir (friends/crowd.js), the ending cards and the
// credits (ui/ending.js), the finished mark (save/progress.js) and the way back to the main menu (main.js).
// Checked: a crowd of 36 at Katzir's way in is varied (children, skin tones, clothes), cheers (clapping,
// arms up, hops), turns to the walkers, holds up the three signs of the spec word for word (read back from
// the texture's own canvas), costs one draw call and a few hundredths of a millisecond a frame (measured and
// printed), leaves the walking lane clear (no colliders, nobody within the lane, people step back from a
// walker) and disposes cleanly (the renderer's geometries and textures back to where they were); the cards
// show the three texts in order on black over a held world; the credits run by themselves (a short test
// speed) over live moments of the chapters' places, roll the gang's names and end on THANK YOU FOR
// PLAYING. with the button; 'דלג' works during the cards, a live moment and the roll; the button brings the
// start screen back without a reload and 'להמשיך' returns to the free roam; markFinished saves the mark, a
// reload shows the finished line, 'להמשיך' opens the free roam with no mission, a new game clears the mark
// (from the menu's button and from the start screen after a reload).
// usage: node tests/finale.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/finale/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const KEY = 'nehorai-game:save:v1';
const shot = (name) => page.screenshot({ path: `${shots}${name}.png` });
const ready = () => page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });

// a finished story (every mission of chapters 1-10 done, the free roam): no mission begins by itself
await page.goto(url);
await ready();
await G((k) => localStorage.setItem(k, JSON.stringify(window.__game.debug.game.progressForChapter(11))), KEY);
await page.reload();
await ready();
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });

// ---------- the crowd ----------
const C = await G(() => {
  const W = window.__game, D = W.debug, g = D.game, F = W.finale, R = D.renderer, cam = D.camera;
  g.hold = true;
  g.setPopulation?.({ traffic: 0, people: 0 });
  // Katzir's way in: the last 25 m of the access road (it starts at the village) and the first 20 m of the main street
  const pts = [];
  for (let s = 25; s > 0; s -= 5) { const p = W.roadAt('כביש הגישה', s); pts.push({ x: p.x, z: p.z }); }
  for (let s = 0; s <= 20; s += 5) { const p = W.roadAt('דרך הגבעה', s); pts.push({ x: p.x, z: p.z }); }
  window.PTS = pts;
  const a = pts[0], gy = (p) => D.world.groundHeight(p.x, p.z);
  g.player.place(a.x, a.z, Math.atan2(pts[1].x - a.x, pts[1].z - a.z));
  const view = () => { const m = pts[5]; cam.position.set(m.x + 24, gy(m) + 22, m.z + 18); cam.lookAt(m.x, gy(m), m.z); cam.updateMatrixWorld(); };
  window.VIEW = view;
  // the lane's centre and 2.5 m to each side, every 2.5 m: what blocks a body there before the crowd comes
  const lanePts = [];
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < 2; k++) { const p = pts[i - 1], q = pts[i], x = p.x + (q.x - p.x) * k / 2, z = p.z + (q.z - p.z) * k / 2, l = Math.hypot(q.x - p.x, q.z - p.z), nx = (q.z - p.z) / l, nz = -(q.x - p.x) / l; for (const o of [-2.5, 0, 2.5]) lanePts.push({ x: x + nx * o, z: z + nz * o }); }
  const blocksAt = () => lanePts.map((p) => !!W.blocks(p.x, gy(p) + 0.9, p.z)).join('');
  const blockedBefore = blocksAt();
  const t0 = performance.now();
  const crowd = new F.Crowd(g, { along: pts, count: 36 });
  const build = performance.now() - t0;
  window.CROWD = crowd;
  // what kinds of people
  const P = crowd.people, kids = P.filter((p) => p.h < 0.75).length, skins = new Set(P.map((p) => p.colors[0])).size, tops = new Set(P.map((p) => p.colors[2])).size;
  const holders = P.filter((p) => p.style === 'sign'), held = [0, 1, 2].map((r) => holders.filter((p) => p.sign === r).length);
  const canvas = crowd.texture.image, fromCanvas = JSON.parse(canvas.dataset.signs || '[]');
  // standing quietly, then clapping, then the loudest
  crowd.cheer(0); for (let i = 0; i < 30; i++) crowd.update(1 / 30);
  const arm = (i) => [crowd.anim[i * 4], crowd.anim[i * 4 + 1]];
  const still = P.filter((p) => p.style !== 'sign').every((p, i) => Math.abs(crowd.anim[P.indexOf(p) * 4]) < 0.3);
  crowd.cheer(0.3); for (let i = 0; i < 90; i++) crowd.update(1 / 30);
  const clapping = P.filter((p, i) => p.style !== 'sign' && crowd.anim[i * 4 + 1] < -0.8).length;
  crowd.cheer(1); for (let i = 0; i < 120; i++) crowd.update(1 / 30);
  const up = P.filter((p, i) => crowd.anim[i * 4] > 1.9 || crowd.anim[i * 4 + 2] > 1.9).length;
  let hops = 0; const m = new D.THREE.Matrix4(), v = new D.THREE.Vector3();
  for (let f = 0; f < 20; f++) { crowd.update(1 / 30); P.forEach((p, i) => { crowd.mesh.getMatrixAt(i, m); v.setFromMatrixPosition(m); if (v.y > p.y + 0.05) hops++; }); }
  // turning to a point down the road (a walker), and back
  const look = { x: pts[4].x, z: pts[4].z };
  crowd.lookAt(look); for (let i = 0; i < 60; i++) crowd.update(1 / 30);
  const facing = P.filter((p) => { const a = Math.atan2(look.x - p.x, look.z - p.z), d = Math.atan2(Math.sin(a - p.yaw), Math.cos(a - p.yaw)); return Math.abs(d) < 0.35 || Math.abs(Math.atan2(Math.sin(p.yaw - p.face), Math.cos(p.yaw - p.face))) > 1.2; }).length;
  // the lane: nobody in it, no colliders put in it, and a walker right up against someone gets room
  const minLane = Math.min(...P.map((p) => crowd.laneDistance(p.x, p.z)));
  const blockedAfter = blocksAt();
  const near = P[0], wk = { x: near.x + near.nx * 0.3, z: near.z + near.nz * 0.3 };
  crowd.walkers.push(wk); for (let i = 0; i < 30; i++) crowd.update(1 / 30);
  const pushed = near.push; crowd.walkers.pop(); for (let i = 0; i < 120; i++) crowd.update(1 / 30);
  const back = near.push;
  // draw calls and frame cost (the sun's shadow box put over the crowd, as the game's frame does round Nehorai)
  const sun = [];
  D.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun.push(o); });
  for (const l of sun) { const off = l.position.clone().sub(l.target.position); l.target.position.copy(crowd.center); l.position.copy(crowd.center).add(off); l.target.updateMatrixWorld(); l.updateMatrixWorld(); }
  view();
  crowd.mesh.visible = false; R.render(D.scene, cam); const callsWithout = R.info.render.calls, trisWithout = R.info.render.triangles;
  crowd.mesh.visible = true; crowd.update(1 / 30); R.render(D.scene, cam); const callsWith = R.info.render.calls, trisWith = R.info.render.triangles;
  const shadows = R.shadowMap.enabled && sun.length > 0;
  let t1 = performance.now(); for (let i = 0; i < 3000; i++) crowd.update(1 / 60); const frameMs = (performance.now() - t1) / 3000;
  return {
    n: crowd.size, kids, skins, tops, holders: holders.length, held, fromCanvas, signs: crowd.signs, canvasIs: canvas === crowd.canvas && canvas.tagName,
    still, clapping, up, hops, facing, minLane, lane: crowd.lane, sameBlocks: blockedBefore === blockedAfter, blockedLane: blockedAfter.includes('1'), pushed, back,
    calls: callsWith - callsWithout, tris: trisWith - trisWithout, shadows, frameMs, build, inScene: crowd.mesh.parent === D.scene, inActs: g.activities.includes(crowd.activity),
  };
});
console.log(`crowd: ${C.n} people, ${C.kids} children, ${C.skins} skin tones, ${C.tops} shirt colours, ${C.holders} signs (${C.held.join('/')}), +${C.calls} draw call(s), +${C.tris} triangles, ${C.frameMs.toFixed(4)} ms a frame, built in ${C.build.toFixed(1)} ms, shadows ${C.shadows ? 'on' : 'off'}`);
check('a crowd of 36 at Katzir\'s way in', C.n === 36 && C.inScene && C.inActs, `${C.n}`);
check('varied: children, skin tones, clothes', C.kids >= 4 && C.skins >= 5 && C.tops >= 8, `${C.kids} children, ${C.skins} skins, ${C.tops} tops`);
const SIGNS = ['תודה שהצלתם אותנו!', 'הגיבורים של קציר!', 'נהוראי והחבורה!'];
check('the three signs, word for word, read back from the texture\'s canvas', JSON.stringify(C.fromCanvas) === JSON.stringify(SIGNS) && JSON.stringify(C.signs) === JSON.stringify(SIGNS) && C.canvasIs === 'CANVAS', C.fromCanvas.join(' | '));
check('some hold the signs up, every text held', C.holders >= 6 && C.held.every((k) => k >= 1), `${C.holders}: ${C.held.join('/')}`);
check('cheer(0): standing quietly, arms down', C.still);
check('cheer(0.3): clapping in front of the chest', C.clapping >= 18, `${C.clapping}`);
check('cheer(1): arms up, waving, signs pumped, hops', C.up >= 15 && C.hops >= 10, `${C.up} arms up, ${C.hops} hop frames`);
check('lookAt: they turn to face the walkers (never their backs to the road)', C.facing >= 30, `${C.facing}/36`);
check('the walking lane is clear: nobody within it, no colliders added', C.minLane > C.lane + 0.3 && C.sameBlocks && !C.blockedLane, `nearest ${C.minLane.toFixed(2)} m from the centre, lane ${C.lane}`);
check('a walker right up against someone gets room, and he comes back', C.pushed > 0.3 && C.back < 0.08, `${C.pushed.toFixed(2)} m, then ${C.back.toFixed(2)}`);
check('a few draw calls at most', C.calls >= 1 && C.calls <= 2, `+${C.calls} (shadows ${C.shadows ? 'on' : 'off'})`);
check('little frame time', C.frameMs < 0.3, `${C.frameMs.toFixed(4)} ms`);

// pictures: the walkers' eye level, from above, a sign up close
await G(() => { const D = window.__game.debug, cam = D.camera, a = PTS[1], b = PTS[6], y = D.world.groundHeight(a.x, a.z); CROWD.lookAt(D.game.player.pos); for (let i = 0; i < 40; i++) CROWD.update(1 / 30); cam.position.set(a.x, y + 1.65, a.z); cam.lookAt(b.x, y + 1.7, b.z); D.renderer.render(D.scene, cam); });
await shot('crowd-eye');
await G(() => { const D = window.__game.debug; VIEW(); D.renderer.render(D.scene, D.camera); });
await shot('crowd-above');
await G(() => {
  const D = window.__game.debug, cam = D.camera, P = CROWD.people, i = P.findIndex((p) => p.style === 'sign' && p.sign === 0), p = P[i];
  CROWD.lookAt(null); CROWD.cheer(0.3); for (let k = 0; k < 90; k++) CROWD.update(1 / 30);
  const top = p.y + 2.2 * p.h;
  cam.position.set(p.x + p.nx * 3.2 * Math.cos(0) , top - 0.2, p.z + p.nz * 3.2); cam.lookAt(p.x, top, p.z); D.renderer.render(D.scene, cam);
});
await shot('crowd-sign');

// dispose: the crowd of the pictures goes; then a second one, only ever drawn from the same view, is
// built and disposed, and the renderer's memory is back where it was before it
const D1 = await G(() => {
  const D = window.__game.debug, R = D.renderer, g = D.game, F = window.__game.finale;
  const acts = g.activities.length;
  CROWD.dispose();
  const first = { inScene: !!CROWD.mesh.parent, acts: acts - g.activities.length };
  VIEW(); R.render(D.scene, D.camera); R.render(D.scene, D.camera);
  const mem0 = { geo: R.info.memory.geometries, tex: R.info.memory.textures }, scene0 = D.scene.children.length, acts0 = g.activities.length;
  const c2 = new F.Crowd(g, { along: PTS, count: 36 });
  c2.cheer(1); c2.update(1 / 30); R.render(D.scene, D.camera);
  const mem1 = { geo: R.info.memory.geometries, tex: R.info.memory.textures };
  c2.dispose();
  R.render(D.scene, D.camera);
  const mem2 = { geo: R.info.memory.geometries, tex: R.info.memory.textures };
  return { first, mem0, mem1, mem2, scene: D.scene.children.length === scene0, acts: g.activities.length === acts0 };
});
check('dispose: out of the scene and the game\'s frame, the renderer\'s memory back to the start', !D1.first.inScene && D1.first.acts === 1 && D1.scene && D1.acts && D1.mem1.geo > D1.mem0.geo && D1.mem1.tex > D1.mem0.tex && D1.mem2.geo === D1.mem0.geo && D1.mem2.tex === D1.mem0.tex, `geometries ${D1.mem0.geo}→${D1.mem1.geo}→${D1.mem2.geo}, textures ${D1.mem0.tex}→${D1.mem1.tex}→${D1.mem2.tex}`);

// ---------- the ending ----------
// helpers in the page (again after every reload): the ending's state, the overlay's parts
const helpers = () => G(() => {
  const F = window.__game.finale;
  window.END = () => { const r = document.getElementById('ending'), q = (c) => r?.querySelector(c), op = (n) => (n ? Number(getComputedStyle(n).opacity) : 0); return { open: !!r, phase: F.ENDING.phase, log: F.ENDING.log.slice(), card: q('.ending-card')?.textContent ?? null, cardOp: op(q('.ending-card')), black: op(q('.ending-black')), moment: q('.ending-moment')?.dataset.chapter ?? null, momentOp: op(q('.ending-moment')), ch: q('.ending-ch')?.textContent, line: q('.ending-line')?.textContent, thanks: q('.ending-thanks-text')?.textContent ?? null, thanksOp: op(q('.ending-thanks')), menu: q('.ending-menu') && !q('.ending-menu').hidden ? q('.ending-menu').textContent : null, skip: q('.ending-skip') && !q('.ending-skip').hidden ? q('.ending-skip').textContent : null, dir: q('.ending-card') ? getComputedStyle(q('.ending-card')).direction : null }; };
  window.GS = () => { const g = window.__game.debug.game; return { hold: g.hold, cutscene: g.cutscene, time: g.time, hud: !document.getElementById('hud').hidden, start: !document.getElementById('startScreen').hidden, controls: g.controls.enabled, mission: g.missions.active?.def.id ?? null }; };
});
await helpers();
const end = () => G(() => window.END());

// the cards, one after the other, on black over a held world (a picture of each)
await G(() => { const g = window.__game.debug.game, F = window.__game.finale; g.hold = false; F.ENDING.speed = 4; window.CARDS_DONE = null; F.endingCards(g).then((r) => { window.CARDS_DONE = r; }); });
const seen = [];
for (let i = 0; i < 3; i++) {
  await page.waitForFunction((k) => { const e = window.END(); if (e.card === window.__game.finale.CARDS[k] && e.black > 0.97) { window.__game.finale.ENDING.speed = 0; return true; } return false; }, i, { timeout: 120000 });
  await page.waitForTimeout(700);
  const e = await end(), gs = await G(() => window.GS());
  seen.push(e.card);
  if (i === 0) check('the world is held under the black, the HUD hidden', gs.hold && !gs.hud && !gs.controls, JSON.stringify(gs));
  await shot(`card-${i + 1}`);
  await G(() => { window.__game.finale.ENDING.speed = 4; });
}
await page.waitForFunction(() => window.CARDS_DONE, null, { timeout: 120000 });
let e = await end();
check('the cards: NAHORAI FARHI / THE END / LEGENDS NEVER FIGHT ALONE, in order, left to right', JSON.stringify(seen) === JSON.stringify(['NAHORAI FARHI', 'THE END', 'LEGENDS NEVER FIGHT ALONE']) && JSON.stringify(e.log) === JSON.stringify(seen) && e.dir === 'ltr', seen.join(' / '));

// the credits run to the end by themselves; two moments held still for a picture
const places = await G(() => window.__game.finale.creditMoments(window.__game.debug.game).map((m) => m.chapter));
await G(() => { const g = window.__game.debug.game, F = window.__game.finale; F.ENDING.speed = 5; window.CREDITS_DONE = null; F.credits(g).then((r) => { window.CREDITS_DONE = r; }); });
const momentShots = [places[3] ?? places[1], places[places.length - 1]];
const camAt = [];
for (const [k, ch] of momentShots.entries()) {
  // the moment's shot on screen: its clock stopped, then the fades (wall-clock) let finish
  await page.waitForFunction((c) => { if (window.__game.finale.ENDING.moment === c) { window.__game.finale.ENDING.speed = 0; return true; } return false; }, ch, { timeout: 240000 });
  await page.waitForFunction(() => { const e = window.END(); return e.black < 0.03 && e.momentOp > 0.97; }, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  camAt.push(await G((c) => { const D = window.__game.debug, g = D.game, m = window.__game.finale.creditMoments(g).find((q) => q.chapter === c), cam = D.camera.position; return { d: Math.min(...m.shots.map((s) => Math.hypot(cam.x - s.pos.x, cam.z - s.pos.z) / (s.r || 50))), gs: window.GS(), title: document.querySelector('.ending-ch').textContent }; }, ch));
  await shot(`credits-${k + 1}-chapter-${ch}`);
  await G(() => { window.__game.finale.ENDING.speed = 5; });
}
check('live moments: the game\'s own camera over the chapter\'s place, the world running as a cutscene', camAt.every((c) => c.d < 1.4 && !c.gs.hold && c.gs.cutscene && !c.gs.hud), camAt.map((c) => `${c.title} ${c.d.toFixed(2)}`).join(', '));
await page.waitForFunction(() => window.__game.finale.ENDING.phase === 'cast' && document.querySelector('.ending-roll-in').textContent.length > 20, null, { timeout: 240000 });
const roll = await G(() => document.querySelector('.ending-roll-in').textContent);
check('the gang as the story\'s characters ("דמויות בדיוניות")', roll.includes('דמויות בדיוניות') && ['נהוראי פרחי', 'ארז פור', 'מולר', 'עידו הידנה'].every((n) => roll.includes(n)));
await page.waitForFunction(() => window.CREDITS_DONE && window.END().menu, null, { timeout: 240000 });
await page.waitForTimeout(1600);
e = await end();
const wantLog = [...seen, ...places.map((c) => `moment:${c}`), 'cast', 'THANK YOU FOR PLAYING.'];
check('the credits ran to the end by themselves: every chapter that has its place, the cast, the thanks', JSON.stringify(e.log) === JSON.stringify(wantLog), `${places.length} moments: ${places.join(',')}`);
check('THANK YOU FOR PLAYING. and the button back to the main menu', e.thanks === 'THANK YOU FOR PLAYING.' && e.menu === 'חזרה לתפריט הראשי' && e.thanksOp > 0.9 && !e.skip);
await shot('thanks');

// the button: the start screen, no reload; 'להמשיך' back into the free roam
const tag = await G(() => (window.__tag = Math.random()));
await page.tap('.ending-menu');
await page.waitForFunction(() => !document.getElementById('startScreen').hidden, null, { timeout: 30000 });
let gs = await G(() => ({ ...window.GS(), tag: window.__tag, ending: !!document.getElementById('ending'), btn: document.getElementById('startBtn').textContent, neu: !document.getElementById('newGameBtn').hidden, fin: document.getElementById('finishedLine') && !document.getElementById('finishedLine').hidden }));
check('the button returns to the start screen (no reload)', gs.tag === tag && gs.start && !gs.ending && !gs.hud && !gs.hold && !gs.cutscene && gs.btn === 'להמשיך' && gs.neu, JSON.stringify(gs));
const toGame = async () => {
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state.started && !document.getElementById('hud').hidden, null, { timeout: 30000 });
  const t0 = await G(() => window.__game.debug.game.time);
  await page.waitForFunction((t) => window.__game.debug.game.time > t + 0.05, t0, { timeout: 60000 });
  return G(() => window.GS());
};
gs = await toGame();
check('\'להמשיך\' goes back into the free roam (the world runs, the HUD and controls back, no mission)', gs.hud && gs.controls && !gs.hold && !gs.cutscene && !gs.mission, JSON.stringify(gs));

// 'דלג' at three moments: during a card, during a live moment, during the roll
const skipRun = async (label, startCards, until) => {
  await G((c) => { const g = window.__game.debug.game, F = window.__game.finale; F.ENDING.speed = 5; window.CARDS_DONE = null; window.CREDITS_DONE = null; window.CLOSED = 0; const run = c ? F.endingCards(g, { onClose: () => { window.CLOSED++; } }).then((r) => { window.CARDS_DONE = r; return F.credits(g); }) : F.credits(g); run.then((r) => { window.CREDITS_DONE = r; }); }, startCards);
  await page.waitForFunction(until, null, { timeout: 240000 });
  await page.tap('.ending-skip');
  await page.waitForFunction(() => window.CREDITS_DONE && window.END().menu, null, { timeout: 60000 });
  const r = await G(() => ({ e: window.END(), done: window.CREDITS_DONE, cards: window.CARDS_DONE, gs: window.GS(), skipped: window.__game.finale.ENDING.skipped }));
  const ok = r.e.phase === 'thanks' && r.e.thanks === 'THANK YOU FOR PLAYING.' && r.e.menu && r.done.skipped && r.skipped && !r.gs.hold && r.gs.cutscene && (!startCards || r.cards?.skipped);
  await page.tap('.ending-menu');
  await page.waitForFunction(() => !document.getElementById('startScreen').hidden && !document.getElementById('ending'), null, { timeout: 30000 });
  const closed = await G(() => window.CLOSED);
  const back = await toGame();
  check(`'דלג' ${label}: straight to the thanks, and the game plays on after it`, ok && back.hud && back.controls && !back.hold && !back.cutscene && (!startCards || closed === 1), `${r.e.log.join(' > ')}${startCards ? `; onClose called ${closed} time(s)` : ''}`);
};
await skipRun('during the first card', true, () => window.END().card === 'NAHORAI FARHI' && window.END().cardOp > 0.5);
await skipRun('during a live moment', false, () => window.__game.finale.ENDING.moment === 2 || window.__game.finale.ENDING.moment === 3);
await skipRun('during the roll of names', false, () => window.__game.finale.ENDING.phase === 'cast');

// ---------- the finished mark ----------
const mk = await G((k) => { const g = window.__game.debug.game, ok = window.__game.finale.markFinished(g); return { ok, mem: g.progress.finished, saved: JSON.parse(localStorage.getItem(k) || 'null')?.finished }; }, KEY);
check('markFinished saves the mark', mk.ok && mk.mem === true && mk.saved === true, JSON.stringify(mk));
await page.reload();
await ready();
await helpers();
const fin = await G(() => { const l = document.getElementById('finishedLine'); return { shown: !!l && !l.hidden && !!l.offsetParent, text: l?.textContent ?? '', star: !!l?.querySelector('.star'), btn: document.getElementById('startBtn').textContent, loaded: window.__game.debug.game.progress.finished }; });
check('a reload: the start screen says the game is finished (a star and the line)', fin.shown && fin.star && fin.text.includes('המשחק הושלם · עשרה פרקים') && fin.btn === 'להמשיך' && fin.loaded === true, fin.text);
await shot('start-finished');
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
await page.waitForTimeout(3000);
gs = await G(() => ({ ...window.GS(), objective: document.getElementById('objText').textContent, label: document.getElementById('objLabel').textContent }));
check('\'להמשיך\' after a reload opens the free roam with no mission starting', !gs.mission && gs.hud && gs.controls, `${gs.label} · ${gs.objective}`);
// a new game from the main menu's button: a clean reload with nothing saved
await G(() => { const g = window.__game.debug.game; g.mainMenu(); });
await page.waitForFunction(() => !document.getElementById('startScreen').hidden, null, { timeout: 30000 });
await page.tap('#newGameBtn');
await page.waitForFunction(() => window.__game && document.getElementById('startBtn').textContent === 'להתחיל' && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
const fresh = await G((k) => ({ saved: localStorage.getItem(k), line: !!document.getElementById('finishedLine'), finished: window.__game.debug.game.progress.finished }), KEY);
check('a new game (from the menu) clears the mark', fresh.saved === null && !fresh.line && fresh.finished === false, JSON.stringify(fresh));
// and a new game from the start screen after a reload
await G((k) => { const p = window.__game.debug.game.progressForChapter(11); p.finished = true; localStorage.setItem(k, JSON.stringify(p)); }, KEY);
await page.reload();
await ready();
const before = await G(() => !!document.getElementById('finishedLine') && !document.getElementById('finishedLine').hidden);
await page.tap('#newGameBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const cleared = await G((k) => ({ mem: window.__game.debug.game.progress.finished, saved: JSON.parse(localStorage.getItem(k) || 'null')?.finished ?? null }), KEY);
check('a new game (from the start screen) clears the mark', before && cleared.mem === false && cleared.saved !== true, JSON.stringify(cleared));

check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
