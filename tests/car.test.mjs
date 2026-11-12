// The Renault never drives backwards by itself. After a head-on hit it stays by the wall (a short jolt, no
// rebound run, on a hill too); a brake held through a stop or a hit does not turn into reverse at once; a
// scene holds the car still; reverse is still there when asked for; and a thumb that steers on the stick
// does not brake under a held gas pedal.
// usage: node tests/car.test.mjs [url]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(120000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
const state = () => page.evaluate(() => window.__game.state);
const G = (fn, arg) => page.evaluate(fn, arg);
const center = (sel) => page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
const wait = (ms) => page.waitForTimeout(ms);
async function play(sec, during) {
  const t0 = (await state()).time;
  while ((await state()).time - t0 < sec) { if (during) await during(); await wait(50); }
}
async function carOnRoad(name, s, offset = -1.8) {
  await G(([name, s, offset]) => { const g = window.__game, p = g.roadAt(name, s, offset); g.placeCar(p.x, p.z, p.yaw); }, [name, s, offset]);
  await wait(200);
}
// the car's travel along its own heading since `from` (negative: backwards)
const along = (s, from) => (s.car.x - from.car.x) * Math.sin(from.car.yaw) + (s.car.z - from.car.z) * Math.cos(from.car.yaw);

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
// the open world of a finished game: no mission starts by itself
await G(() => { const g = window.__game.debug.game; g.save = () => true; localStorage.setItem('nehorai-game:save:v1', JSON.stringify(g.progressForChapter(11))); });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 120000 });
await page.tap('#startBtn');
await wait(400);
await G(() => { const g = window.__game; g.debug.game.setPopulation({ traffic: 0, people: 0 }); g.debug.game.missions.stop?.(); g.enterCar(); g.setTimeScale(1); });
let s = await state();
await G(() => { const c = window.__game.debug.game.car, prev = c.onCrash; window.__hardest = 0; c.onCrash = (v) => { window.__hardest = Math.max(window.__hardest, v); prev?.(v); }; });
check('in the Renault, in the open world', s.mode === 'car' && !s.mission, `${s.mode} ${s.mission?.id || ''}`);

// ---------- 1. head-on into a wall at 80 km/h, hands off the pedals ----------
// (in front of Nehorai's house, as in the Renault's own test; the speed is set so the run-up needs no clear road)
const house = await G(() => ({ ...window.__game.home }));
const toWall = async (speed) => {
  await G(([h, speed]) => { const g = window.__game, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); g.placeCar(h.x + fx * 16, h.z + fz * 16, h.yaw + Math.PI); const c = g.debug.game.car; c.repair(); c.speed = speed; }, [house, speed]);
};
let hits0 = (await state()).car.impacts, atHit = null, back = 0, minSpeed = 0;
await toWall(22);
await play(5, async () => { const q = await state(); if (!atHit && q.car.impacts > hits0) atHit = q; if (atHit) { back = Math.min(back, along(q, atHit)); minSpeed = Math.min(minSpeed, q.car.speed); } });
s = await state();
const hard = await G(() => window.__hardest);
check('the car hits the wall hard', !!atHit && hard > 12, `an impact of ${hard?.toFixed(1)} m/s`);
check('after the hit, hands off: it does not run backwards (under 1.5 m from where it hit, never faster than 1 m/s backwards)', !!atHit && back > -1.5 && minSpeed > -1, `${back.toFixed(2)} m back at most, ${minSpeed.toFixed(2)} m/s at most`);
check('...and it is at rest a few seconds later', Math.abs(s.car.speed) < 0.05, `${s.car.speed.toFixed(2)} m/s`);

// ---------- 2. knocked backwards on a hill: it comes to rest, it does not run away down the slope ----------
// the steepest stretch of Katzir's hill road, facing up it
const hill = await G(() => {
  const g = window.__game; let best = null;
  for (let d = 10; d < 400; d += 6) {
    let a, b; try { a = g.roadAt('דרך הגבעה', d, -1.8); b = g.roadAt('דרך הגבעה', d + 6, -1.8); } catch (e) { break; }
    if (!a || !b) break;
    const rise = g.groundAt(b.x, b.z) - g.groundAt(a.x, a.z);
    if (!best || Math.abs(rise) > Math.abs(best.rise)) best = { d, rise, a, b };
  }
  return best;
});
await G((h) => { const g = window.__game, up = h.rise > 0, p = up ? h.a : h.b, q = up ? h.b : h.a; g.placeCar(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z)); g.debug.game.car.repair(); }, hill);
await play(0.6);
const h0 = await state();
await G(() => { window.__game.debug.game.car.speed = -5; }); // as a hit from the front leaves it
let hillBack = 0, hillMin = 0;
await play(4, async () => { const q = await state(); hillBack = Math.min(hillBack, along(q, h0)); hillMin = Math.min(hillMin, q.car.speed); });
s = await state();
check(`thrown backwards on the hill road (a rise of ${Math.abs(hill.rise).toFixed(2)} m over 6 m): it stops within 4 m`, hillBack > -4 && Math.abs(s.car.speed) < 0.05, `${hillBack.toFixed(2)} m back, now ${s.car.speed.toFixed(2)} m/s`);
await play(3);
const h1 = await state();
check('...and stays there with no pedal: no rolling back down the slope', Math.abs(along(h1, s)) < 0.3 && Math.abs(h1.car.speed) < 0.05, `${along(h1, s).toFixed(2)} m in 3 s`);

// ---------- 3. the brake held through a stop: reverse waits a beat; then it is there ----------
await carOnRoad('דרך הגבעה', 30);
await page.keyboard.down('w'); await play(2); await page.keyboard.up('w');
const brake = await center('#btnBrake'), gas = await center('#btnGas');
await touch('touchStart', [{ ...brake, id: 4 }]);
let stopped = null, early = 0;
await play(6, async () => { const q = await state(); if (!stopped && q.car.speed < 0.5) stopped = q; else if (stopped && q.time - stopped.time < 0.45) early = Math.min(early, q.car.speed); });
s = await state();
await touch('touchEnd', []);
check('braking to a stop with the pedal kept down: no reverse in the first half second', !!stopped && early > -0.3, `${early.toFixed(2)} m/s at most`);
check('...kept down longer, the car reverses (reverse is still there)', s.car.speed < -1.5 && s.car.speed > -6.5, `${(s.car.speed * 3.6).toFixed(0)} km/h`);
const rel0 = await state();
let relBack = 0;
await play(2.5, async () => { relBack = Math.min(relBack, along(await state(), rel0)); });
s = await state();
check('the reverse pedal let go: the car stops within a few metres', Math.abs(s.car.speed) < 0.05 && relBack > -5, `${relBack.toFixed(2)} m more, now ${s.car.speed.toFixed(2)} m/s`);
// from rest, a fresh press reverses at once
await touch('touchStart', [{ ...brake, id: 5 }]);
await play(0.8);
s = await state();
await touch('touchEnd', []);
check('from rest, pressing the brake pedal reverses at once', s.car.speed < -1.5, `${(s.car.speed * 3.6).toFixed(0)} km/h after 0.8 s`);
await play(2);

// ---------- 4. the brake held into a wall ----------
hits0 = (await state()).car.impacts; atHit = null; let afterHit = 0;
await touch('touchStart', [{ ...brake, id: 6 }]);
await toWall(22);
let later = 0;
await play(4, async () => { const q = await state(); if (!atHit && q.car.impacts > hits0) atHit = q; else if (atHit && q.time - atHit.time < 0.9) afterHit = Math.min(afterHit, q.car.speed); else if (atHit) later = Math.min(later, q.car.speed); });
await touch('touchEnd', []);
check('the brake held through a hit: no reverse for most of a second', !!atHit && afterHit > -0.3, `${afterHit.toFixed(2)} m/s at most in 0.9 s`);
check('...kept down after that, it backs away from the wall (asked for)', later < -1, `${(later * 3.6).toFixed(0)} km/h at most`);
await play(2);

// ---------- 5. a scene with Nehorai at the wheel: the car stops and stays ----------
await carOnRoad('דרך הגבעה', 30);
await page.keyboard.down('w'); await play(2.2); await page.keyboard.up('w');
await G(() => { window.__game.debug.game.cutscene = true; });
let sceneStop = null, sceneMin = 0;
await play(6, async () => { const q = await state(); sceneMin = Math.min(sceneMin, q.car.speed); if (!sceneStop && Math.abs(q.car.speed) < 0.05) sceneStop = q; });
s = await state();
await G(() => { window.__game.debug.game.cutscene = false; });
check('a scene while driving: the car brakes to a stop', !!sceneStop, sceneStop ? `stopped after ${(sceneStop.time - (s.time - 6)).toFixed(1)} s` : 'never stopped');
check('...and stays where it stopped for the rest of the scene (it used to back away at 20 km/h)', !!sceneStop && Math.abs(along(s, sceneStop)) < 0.3 && sceneMin > -0.3, sceneStop ? `${along(s, sceneStop).toFixed(2)} m, ${sceneMin.toFixed(2)} m/s at most` : '');

// ---------- 6. the touch stick: steering with a thumb that drifts down, the gas pedal held ----------
await carOnRoad('דרך הגבעה', 30);
const stick = await page.evaluate(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await touch('touchStart', [{ ...stick, id: 1 }, { ...gas, id: 3 }]);
for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: stick.x - i * 9, y: stick.y + i * 9, id: 1 }, { ...gas, id: 3 }]); // down and to the left
const d0 = await state();
let top = 0;
await play(1.6, async () => { top = Math.max(top, (await state()).car.speed); });
s = await state();
const input = await G(() => { const c = window.__game.debug.game.controls; return { x: +c.move.x.toFixed(2), y: +c.move.y.toFixed(2) }; });
await touch('touchEnd', []);
check('gas held, the stick pushed down-left: the car drives off and turns (no brake from the stick)', top > 5 && Math.abs(s.car.yaw - d0.car.yaw) > 0.1, `stick ${input.x},${input.y} · up to ${(top * 3.6).toFixed(0)} km/h · turned ${(s.car.yaw - d0.car.yaw).toFixed(2)}`);
// the stick alone, pulled straight down from rest, still reverses
await carOnRoad('דרך הגבעה', 30);
await play(0.5);
await touch('touchStart', [{ ...stick, id: 1 }]);
for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: stick.x, y: stick.y + i * 10, id: 1 }]);
await play(1.2);
s = await state();
await touch('touchEnd', []);
check('the stick alone, pulled straight down from rest: reverse', s.car.speed < -1, `${(s.car.speed * 3.6).toFixed(0)} km/h`);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
