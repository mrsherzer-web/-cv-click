// Stage H acceptance test: sound and the mute button (remembered), the side activities (bag challenge,
// sparring rematch, kiosk delivery, time trial) paid each time with records kept, saving that brings
// back the same state after a reload, and starting over with a confirmation on the page.
// usage: node tests/stage-h.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(120000); // software rendering on a busy machine can take a while over one frame
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
const state = () => page.evaluate(() => window.__game.state);
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
async function until(cond, maxSec, what) {
  const t0 = (await state()).time;
  for (;;) {
    const s = await state();
    if (await cond(s)) return s;
    if (s.time - t0 > maxSec) { console.log(`  (timed out waiting for ${what})`); return null; }
    await wait(100);
  }
}
const talkThrough = (done, maxSec, what) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const center = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function load(save) {
  await page.goto(url);
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.evaluate((save) => { localStorage.clear(); if (save) localStorage.setItem('nehorai-game:save:v1', JSON.stringify(save)); }, save);
  await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
}
const progress = (o) => ({ v: 1, money: 1000, done: [], unlocks: [], car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(), ...o });
const ALL = ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves'];
const UNLOCKS = ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2'];

// ---------- sound and mute ----------
await load(progress({ done: ALL, unlocks: UNLOCKS }));
await page.tap('#startBtn');
await wait(600);
const audio = await G(() => { const s = window.__game.debug.game.sound; return { ctx: !!s.ctx, state: s.ctx?.state }; });
check('sound starts with the first tap', audio.ctx, audio.state);
check('free roam after the chapter: the objective says so', /שיטוט חופשי/.test(await page.textContent('#objText')));
await page.dispatchEvent('#muteBtn', 'pointerdown');
check('the mute button mutes', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'true' && (await G(() => window.__game.debug.game.sound.muted)));
await G(() => window.__game.setTimeScale(2));

// ---------- the side activities ----------
const sides = await G(() => window.__game.debug.game.missions.sides.filter((d) => d.available(window.__game.debug.game)).map((d) => d.id));
check('all four activities are open in free roam', sides.length === 4, sides.join(', '));
const startSide = async (id) => {
  const p = await G((id) => { const g = window.__game.debug.game, d = g.missions.sides.find((q) => q.id === id), q = d.startAt(g); return { x: q.x, z: q.z }; }, id);
  await G((p) => window.__game.teleport(p.x, p.z), p);
  return until((s) => s.mission?.id === id, 6, id);
};
let money = (await state()).progress.money;

// the bag challenge, with the real punch button
let s = await startSide('bag-challenge');
check('stepping on the green marker starts the bag challenge', !!s);
await G(() => window.__game.faceBag(2));
await G(() => window.__game.setTimeScale(1));
const pc = await center('#btnPunch');
for (let i = 0; i < 40 && (await state()).mission?.id === 'bag-challenge'; i++) { await touch('touchStart', [{ ...pc, id: 3 }]); await wait(40); await touch('touchEnd', []); await wait(110); }
s = await until((s) => !s.mission, 20, 'the challenge to end');
s = await state();
check('15 punches in time: paid, and the time is kept as a record', !!s && s.progress.money === money + 40 && s.progress.records?.bag > 0, `money ${s.progress.money}, record ${s.progress.records?.bag?.toFixed?.(1)}`);
money = s.progress.money;

// the rematch: the fight bot plays Nehorai's side
await G(() => window.__game.setTimeScale(2));
await wait(3000);
s = await startSide('rematch');
check('the rematch starts in the ring', !!s);
await G(() => window.__game.setTimeScale(1));
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
s = await until((s) => !s.mission, 240, 'the rematch to end');
await G(() => window.__game.fightBot(null));
s = await state();
check('rematch won: paid again', !s.mission && s.progress.money === money + 50 && s.progress.records?.rematches === 1, `money ${s.progress.money}`);
money = s.progress.money;
await G(() => window.__game.setTimeScale(2));

// a delivery from the kiosk
await page.tap('#pauseBtn');
await page.tap('#travelBtn');
await until((s) => !s.paused, 3, 'the trip');
s = await startSide('delivery');
check('the kiosk delivery starts with a clock', !!s && /משלוח/.test(await page.textContent('#objText')));
const dest = await G(() => window.__game.debug.game.missions.active.s.dest);
await G((d) => window.__game.teleport(d.x, d.z), dest);
s = await until((s) => !s.mission, 6, 'the delivery to end');
s = await state();
check('delivered in time: paid', !!s && s.progress.money === money + 60 && s.progress.records?.deliveries === 1, `money ${s.progress.money}`);
money = s.progress.money;

// the time trial: a quick (placed) run to the beach
s = await startSide('time-trial');
check('the time trial puts Nehorai in the Renault at the gym', !!s && s.mode === 'car');
const L = await G(() => window.__game.debug.world.places.beachLot.parking);
await until(() => false, 5, 'a few seconds on the clock');
await G((L) => window.__game.placeCar(L.x, L.z, L.yaw), L);
s = await until((s) => !s.mission, 6, 'the finish');
s = await state();
check('at the beach in time: paid, best time kept', !!s && s.progress.money === money + 80 && s.progress.records?.trial > 0, `money ${s.progress.money}, ${s.progress.records?.trial?.toFixed?.(1)} s`);
money = s.progress.money;

// ---------- saving ----------
await page.tap('#pauseBtn');
await wait(200);
const saved = await G(() => JSON.parse(localStorage.getItem('nehorai-game:save:v1')));
check('pausing saves', saved.money === money && saved.records.trial > 0);
await page.tap('#resumeBtn');
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('after a reload the start screen offers to continue', (await page.textContent('#startBtn')) === 'להמשיך');
await page.tap('#startBtn');
await wait(500);
s = await state();
check('the same money, missions and records come back', s.progress.money === money && s.progress.done.length === ALL.length && s.progress.records.deliveries === 1 && s.progress.records.rematches === 1);
check('the mute choice is remembered', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'true');

// ---------- starting over ----------
await page.tap('#pauseBtn');
await page.tap('#resetBtn');
check('starting over asks first, on the page', await page.isVisible('#resetConfirm'));
await page.tap('#resetNo');
check('"no" goes back to the pause menu with nothing lost', (await page.isVisible('#pauseMenu')) && (await G(() => JSON.parse(localStorage.getItem('nehorai-game:save:v1')).money)) === money);
await page.tap('#resetBtn');
await Promise.all([page.waitForEvent('load'), page.tap('#resetYes')]);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('"yes": a new game from the beginning', (await page.textContent('#startBtn')) === 'להתחיל' && (await page.isHidden('#newGameBtn')));
await page.screenshot({ path: `${shots}/h1-new.png` });

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
// every objective line the run showed, and the distance when an arrow went with it
await writeFile(`${shots}/guide-log.json`, JSON.stringify(await page.evaluate(() => window.__game.guideLog), null, 1));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
