// Stage B acceptance test: the white Renault. Headless Chromium with phone emulation and real touches.
// usage: node tests/stage-b.test.mjs [url] [screenshot dir]
// default url: the single-file build (run `npm run build` first)
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
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
const state = () => page.evaluate(() => window.__game.state);
const G = (fn, arg) => page.evaluate(fn, arg);
const center = (sel) => page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
const wait = (ms) => page.waitForTimeout(ms);
// wait until at least `sec` seconds of game time have passed
async function play(sec, during) {
  const t0 = (await state()).time;
  while ((await state()).time - t0 < sec) { if (during) await during(); await wait(60); }
}
// put the car at arc length s of a road, on the right-hand lane, facing along the road
async function carOnRoad(name, s, offset = -1.8) {
  await G(([name, s, offset]) => { const g = window.__game, p = g.roadAt(name, s, offset); g.placeCar(p.x, p.z, p.yaw); }, [name, s, offset]);
  await wait(200);
}
const holdKey = async (key, sec) => { await page.keyboard.down(key); await play(sec); await page.keyboard.up(key); };

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(400);
await G(() => window.__game.setTimeScale(2)); // headless runs at about 10 frames a second

// ---------- the car is home, and getting in ----------
let s = await state();
const home = await G(() => window.__game.home);
check('the white Renault is parked at Nehorai\'s house', Math.hypot(s.car.x - home.x, s.car.z - home.z) < 16, `${Math.hypot(s.car.x - home.x, s.car.z - home.z).toFixed(1)} m from the house`);
const spot = await G(() => window.__game.carSpot);
await G(([x, z]) => window.__game.teleport(x, z), [spot.x + Math.cos(spot.yaw) * 1.7, spot.z - Math.sin(spot.yaw) * 1.7]);
await play(0.3);
s = await state();
check('next to the door the button offers to get in', s.prompt === 'להיכנס לרכב', String(s.prompt));
await page.dispatchEvent('#btnInteract', 'pointerdown');
await play(0.2);
s = await state();
const ui = await G(() => ({ pedals: !document.getElementById('carActions').hidden, run: !document.getElementById('btnRun').hidden, speed: !document.getElementById('carHud').hidden }));
check('getting in switches to driving', s.mode === 'car' && ui.pedals && ui.speed && !ui.run, JSON.stringify(ui));
await page.screenshot({ path: `${shots}/b1-in-car.png` });

// ---------- gas, steering, brakes, reverse on the main street ----------
await carOnRoad('דרך הגבעה', 30);
const gas = await center('#btnGas'), brake = await center('#btnBrake');
const a0 = await state();
await touch('touchStart', [{ ...gas, id: 3 }]);
await play(2);
s = await state();
await touch('touchEnd', []);
const fwd = Math.hypot(s.car.x - a0.car.x, s.car.z - a0.car.z);
check('holding gas drives forward', s.car.speed > 6 && fwd > 8, `${s.car.kmh.toFixed(0)} km/h after 2 s, ${fwd.toFixed(1)} m`);
await page.screenshot({ path: `${shots}/b2-driving.png` });
// the brake: from speed to a stop, then (still held) into reverse
await carOnRoad('דרך הגבעה', 30);
await holdKey('w', 2);
const v0 = (await state()).car.speed, tb = (await state()).time;
await touch('touchStart', [{ ...brake, id: 4 }]);
let stopAt = null;
await play(2.6, async () => { const q = await state(); if (stopAt === null && q.car.speed < 0.5) stopAt = q.time - tb; });
const r1 = await state();
await touch('touchEnd', []);
check('the brake stops the car', stopAt !== null && stopAt < 1.6, `from ${(v0 * 3.6).toFixed(0)} km/h in ${stopAt?.toFixed(2)} s`);
check('holding the brake when stopped reverses', r1.car.speed < -1 && r1.car.speed > -6.5, `${(r1.car.speed * 3.6).toFixed(0)} km/h`);
// stick to the left while the right thumb holds gas: the car turns left (its heading grows)
await carOnRoad('דרך הגבעה', 30);
const y0 = (await state()).car.yaw;
await touch('touchStart', [{ x: 160, y: 280, id: 1 }, { ...gas, id: 3 }]);
for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: 160 - i * 12, y: 280, id: 1 }, { ...gas, id: 3 }]);
await play(1.4, () => touch('touchMove', [{ x: 112, y: 280, id: 1 }, { ...gas, id: 3 }]));
await touch('touchEnd', []);
s = await state();
let turn = s.car.yaw - y0;
turn = Math.atan2(Math.sin(turn), Math.cos(turn));
check('steering left with one thumb while the other holds gas', turn > 0.15, `heading changed by ${turn.toFixed(2)} rad`);
await play(1);

// ---------- handbrake slide ----------
await carOnRoad('כביש הגישה', 120);
await holdKey('w', 2.5);
await page.keyboard.down('w'); await page.keyboard.down('a'); await page.keyboard.down(' ');
let maxSlip = 0;
await play(0.8, async () => { maxSlip = Math.max(maxSlip, Math.abs((await state()).car.slip)); });
await page.keyboard.up(' '); await page.keyboard.up('a'); await page.keyboard.up('w');
check('the handbrake lets the back slide out', maxSlip > 0.08, `slip up to ${maxSlip.toFixed(2)} rad`);

// ---------- collisions: a house stops the car and nothing passes through ----------
const house = await G(() => ({ ...window.__game.home, hx: window.__game.home.hx }));
await G(([h]) => { const g = window.__game, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); g.placeCar(h.x + fx * 16, h.z + fz * 16, h.yaw + Math.PI); }, [house]);
const hp0 = (await state()).car.health;
await holdKey('w', 3);
s = await state();
const rel = { x: s.car.x - house.x, z: s.car.z - house.z }, depth = Math.abs(rel.x * Math.sin(house.yaw) + rel.z * Math.cos(house.yaw));
check('driving into a house: the car stops at the wall', depth > house.hz + 1.2, `car center ${depth.toFixed(2)} m from the house center, wall at ${house.hz} m`);
check('a crash damages the car', s.car.health < hp0, `health ${hp0.toFixed(0)} → ${s.car.health.toFixed(0)}`);
await page.screenshot({ path: `${shots}/b3-crash.png` });

// ---------- slopes: down the access road the car stays on the road ----------
await carOnRoad('כביש הגישה', 300);
let off = 0;
await page.keyboard.down('w');
await play(5, async () => { const q = await state(); off = Math.max(off, Math.abs(q.car.y - q.car.ground)); });
await page.keyboard.up('w');
s = await state();
check('down the hill the wheels stay on the road', off < 0.35, `largest gap ${off.toFixed(2)} m, now ${s.car.kmh.toFixed(0)} km/h`);
await page.screenshot({ path: `${shots}/b4-hill.png` });
const camOk = !(await G(() => { const s = window.__game.state; return window.__game.blocks(s.camera.x, s.camera.y, s.camera.z); }));
check('the chase camera is never inside a wall', camOk);
check('draw calls and triangles within phone budget while driving', s.drawCalls < 150 && s.triangles < 250000, `${s.drawCalls} calls, ${s.triangles} triangles`);

// ---------- getting out: at speed it stops first; a blocked door uses the other side ----------
await carOnRoad('דרך הגבעה', 60);
await holdKey('w', 1.5);
await page.dispatchEvent('#btnExit', 'pointerdown');
await play(3);
s = await state();
check('getting out while moving: the car stops, then Nehorai steps out', s.mode === 'foot' && Math.abs(s.car.speed) < 1.6 && Math.hypot(s.player.x - s.car.x, s.player.z - s.car.z) < 3.5, `mode ${s.mode}, car ${s.car.kmh.toFixed(1)} km/h`);
const solid = await G(() => { const s = window.__game.state; return window.__game.blocks(s.player.x, s.player.y + 0.5, s.player.z); });
check('he lands on open ground, not inside anything', !solid);
// driver's door against the front wall of a yard (the car's left side faces the wall)
await G(() => { const g = window.__game, p = g.roadAt('דרך הגבעה', 70, 4.75), q = g.roadAt('דרך הגבעה', 70); g.placeCar(p.x, p.z, q.yaw); });
await page.dispatchEvent('#btnInteract', 'pointerdown');
await play(0.3);
s = await state();
if (s.mode !== 'car') await G(() => window.__game.enterCar());
await play(0.3);
await page.dispatchEvent('#btnExit', 'pointerdown');
await play(0.5);
s = await state();
const inWall = await G(() => { const s = window.__game.state; return window.__game.blocks(s.player.x, s.player.y + 0.5, s.player.z); });
check('with the driver\'s door blocked he gets out the other side', s.mode === 'foot' && !inWall, `mode ${s.mode}`);
await page.screenshot({ path: `${shots}/b5-out.png` });

// ---------- stuck: put the car back on the road ----------
await G(() => { const g = window.__game; g.placeCar(g.home.x + 40, g.home.z - 60, 0); g.resetCar(); });
await play(0.3);
s = await state();
const onRoad = await G(() => { const s = window.__game.state; return window.__game.groundAt(s.car.x, s.car.z); });
check('"put the car back on the road" puts it on a road', Math.abs(onRoad - s.car.y) < 0.4, `${s.car.x.toFixed(0)}, ${s.car.z.toFixed(0)}`);
await page.tap('#pauseBtn');
check('the pause menu has the "back on the road" button', await page.isVisible('#resetCarBtn'));
await page.tap('#resumeBtn');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
