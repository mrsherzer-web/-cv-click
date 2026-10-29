// Stage A acceptance test in headless Chromium with phone emulation and real touch events.
// usage: node tests/stage-a.test.mjs [url] [screenshot dir]
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
const wait = (ms) => page.waitForTimeout(ms);

// hold a touch at `from`, slide to `to`, keep it there for `ms`, then lift
async function hold(from, to, ms, id = 1) {
  await touch('touchStart', [{ ...from, id }]);
  const steps = 6;
  for (let i = 1; i <= steps; i++) await touch('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id }]);
  const end = Date.now() + ms;
  while (Date.now() < end) { await touch('touchMove', [{ ...to, id }]); await wait(100); }
  await touch('touchEnd', []);
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// hold the stick fully forward, then measure distance over game time once the speed has settled
async function measureSpeed() {
  await page.evaluate(() => { const g = window.__game; g.teleport(g.home.x + Math.sin(g.home.yaw) * 9, g.home.z + Math.cos(g.home.yaw) * 9); });
  // camera behind the player looking down the street toward the lookout
  await page.evaluate(() => { const g = window.__game, st = g.state; g.setCamera(Math.atan2(-(g.lookout.x - st.player.x), -(g.lookout.z - st.player.z)), 0.2); });
  await touch('touchStart', [{ x: 150, y: 290, id: 1 }]);
  await touch('touchMove', [{ x: 150, y: 215, id: 1 }]);
  await frames(4);
  const a = await state();
  const end = Date.now() + 1500;
  while (Date.now() < end) { await touch('touchMove', [{ x: 150, y: 215, id: 1 }]); await wait(100); }
  const b = await state();
  await touch('touchEnd', []);
  return dist(a.player, b.player) / Math.max(1e-3, b.time - a.time);
}

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
const timings = await page.evaluate(() => window.__game.timings);
check('page boots without errors', errors.length === 0, `world ${timings.world} ms, first frame ${timings.firstFrame} ms in software rendering`);
await page.screenshot({ path: `${shots}/a1-start.png` });

// joystick before pressing start must do nothing
const s0 = await state();
await hold({ x: 150, y: 290 }, { x: 150, y: 220 }, 500);
check('controls are inactive behind the start screen', dist(s0.player, (await state()).player) < 0.01);

await page.tap('#startBtn');
await wait(600);
let s = await state();
check('start screen hides and the game runs', s.started && !(await page.isVisible('#startScreen')) && (await page.isVisible('#hud')));
check('player stands on the ground at start', Math.abs(s.player.y - s.ground) < 0.01, `y=${s.player.y.toFixed(3)} ground=${s.ground.toFixed(3)}`);

// game time passes at the frame rate; headless software rendering is slow, so compare against game time
const frames = async (n = 3) => { const t = (await state()).time; await page.waitForFunction((t0) => window.__game.state.time > t0 + 0.0001, t, { timeout: 30000 }); for (let i = 1; i < n; i++) { const t1 = (await state()).time; await page.waitForFunction((t0) => window.__game.state.time > t0, t1, { timeout: 30000 }); } };
// walk: left thumb pushed up for 2 s
const p0 = s.player;
await hold({ x: 150, y: 290 }, { x: 150, y: 215 }, 2000);
await frames();
s = await state();
const walked = dist(p0, s.player);
check('joystick walks the player forward', walked > 1.5, `${walked.toFixed(2)} m; headless frame rate ${s.fps ?? '?'} FPS`);
const walkSpeed = await measureSpeed();
check('walking speed matches the design (2.4 m/s)', Math.abs(walkSpeed - 2.4) < 0.35, `${walkSpeed.toFixed(2)} m/s in game time`);
check('feet stay on the ground while walking', Math.abs(s.player.y - s.ground) < 0.01);
await page.screenshot({ path: `${shots}/a2-walk.png` });

// run: tap the run button, push again
await page.tap('#btnRun');
check('run button toggles on', (await page.getAttribute('#btnRun', 'aria-pressed')) === 'true');
const runSpeed = await measureSpeed();
check('running is faster than walking (6.2 m/s)', Math.abs(runSpeed - 6.2) < 0.8, `${runSpeed.toFixed(2)} m/s in game time`);
s = await state();
await page.tap('#btnRun');
check('run button toggles off', (await page.getAttribute('#btnRun', 'aria-pressed')) === 'false');

// objective arrow: straight up when the camera looks at the target, clockwise when the target is to the right
const arrowAngle = () => page.evaluate(() => parseFloat((document.getElementById('objArrow').style.transform.match(/rotate\(([-\d.e]+)rad\)/) || [0, NaN])[1]));
await page.evaluate(() => { const g = window.__game, s = g.state, p = s.player, t = s.target; g.setCamera(Math.atan2(-(t.x - p.x), -(t.z - p.z)), 0.2); });
await frames(2);
const ahead = await arrowAngle();
await page.evaluate(() => { const g = window.__game; g.setCamera(g.state.camera.yaw + 0.6, 0.2); }); // camera turns left
await frames(2);
const right = await arrowAngle();
check('objective arrow points at the target', Math.abs(ahead) < 0.15 && right > 0.4, `ahead ${ahead.toFixed(2)} rad, after turning left ${right.toFixed(2)} rad`);
s = await state();

// camera: drag on the right side
const yaw0 = s.camera.yaw;
await hold({ x: 620, y: 200 }, { x: 470, y: 200 }, 300, 2);
s = await state();
check('dragging on the right turns the camera', Math.abs(s.camera.yaw - yaw0) > 0.5, `yaw ${yaw0.toFixed(2)} → ${s.camera.yaw.toFixed(2)}`);

// two thumbs at once: walking while looking
const p2 = s.player;
await touch('touchStart', [{ x: 150, y: 290, id: 1 }, { x: 620, y: 200, id: 2 }]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [{ x: 150, y: 290 - i * 7, id: 1 }, { x: 620 - i * 8, y: 200, id: 2 }]); await wait(80); }
await touch('touchEnd', []);
s = await state();
check('walking and looking work together (multi-touch)', dist(p2, s.player) > 0.5 && Math.abs(s.camera.yaw - yaw0) > 0.5);

// the run button answers a second finger while the first one holds the stick
const runBtn = await page.evaluate(() => { const b = document.getElementById('btnRun').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await touch('touchStart', [{ x: 150, y: 290, id: 1 }]);
await touch('touchMove', [{ x: 150, y: 230, id: 1 }]);
await touch('touchStart', [{ x: 150, y: 230, id: 1 }, { ...runBtn, id: 2 }]);
await touch('touchEnd', [{ x: 150, y: 230, id: 1 }]);
await wait(200);
const runWhileMoving = await page.getAttribute('#btnRun', 'aria-pressed');
await touch('touchEnd', []);
await page.tap('#btnRun');
check('run button works while the other thumb holds the stick', runWhileMoving === 'true' && (await page.getAttribute('#btnRun', 'aria-pressed')) === 'false');

// collision: face the front wall of Nehorai's house and push into it
const home = await page.evaluate(() => window.__game.home);
const fx = Math.sin(home.yaw), fz = Math.cos(home.yaw);   // the facade faces the street
await page.evaluate(([x, z]) => window.__game.teleport(x, z), [home.x + fx * (home.hz + 1.2), home.z + fz * (home.hz + 1.2)]);
await page.evaluate((yaw) => window.__game.setCamera(yaw, 0.2), home.yaw);   // camera on the street side, looking at the house
await hold({ x: 150, y: 290 }, { x: 150, y: 215 }, 2500);
s = await state();
const lx = s.player.x - home.x, lz = s.player.z - home.z;
const localZ = lx * Math.sin(home.yaw) + lz * Math.cos(home.yaw);
check('walls stop the player (no walking into the house)', localZ > home.hz, `distance from house center along its depth: ${localZ.toFixed(2)} m, wall at ${home.hz} m`);

// camera with the house behind it: it must pull in instead of going through the wall
await page.evaluate(([x, z]) => window.__game.teleport(x, z), [home.x + fx * (home.hz + 1.0), home.z + fz * (home.hz + 1.0)]);
await page.evaluate((yaw) => window.__game.setCamera(yaw, 0.15), home.yaw + Math.PI);
await frames(8);
s = await state();
const cx = s.camera.x - home.x, cz = s.camera.z - home.z;
const camLocalZ = cx * Math.sin(home.yaw) + cz * Math.cos(home.yaw);
check('camera pulls in rather than entering a wall', s.camera.dist < 1.5 && camLocalZ > home.hz, `camera distance ${s.camera.dist.toFixed(2)} m, camera ${(camLocalZ - home.hz).toFixed(2)} m outside the facade`);

// falling through the ground is caught and corrected
await page.evaluate(() => { const p = window.__game.state.player; window.__game.teleport(p.x, p.z, -60); });
await frames(2);
s = await state();
check('falling below the world returns the player to the ground', Math.abs(s.player.y - s.ground) < 0.01 && s.player.respawns >= 1, `respawns=${s.player.respawns}`);

// pause menu and quality
await page.tap('#pauseBtn');
check('pause button opens the menu', await page.isVisible('#pauseMenu'));
await page.tap('[data-quality="low"]');
s = await state();
check('quality "low" applies (pixel ratio 1, no shadows)', s.quality === 'low' && s.pixelRatio === 1, `pixelRatio=${s.pixelRatio}`);
await page.tap('[data-quality="medium"]');
s = await state();
check('quality "medium" applies', s.quality === 'medium' && s.pixelRatio === 1.5, `pixelRatio=${s.pixelRatio}`);
const before = (await state()).player;
await hold({ x: 150, y: 290 }, { x: 150, y: 215 }, 600);
check('nothing moves while paused', dist(before, (await state()).player) < 0.01);
await page.tap('#resumeBtn');
check('resume closes the menu', !(await page.isVisible('#pauseMenu')));

// the stage A objective: reach the lookout and use the viewer
const tele = await page.evaluate(() => window.__game.telescope);
await page.evaluate(([x, z]) => window.__game.teleport(x, z), [tele.x - tele.dx * 1.6, tele.z - tele.dz * 1.6]);
await frames(2);
s = await state();
check('next to the viewer the context button offers to look', s.prompt === 'להסתכל', s.prompt);
check('the context button appears next to the viewer', s.interactVisible);
await page.tap('#btnInteract');
await wait(1500);
s = await state();
check('using the viewer shows the view over the plain', s.lookout === 1 && (await page.isVisible('#caption')), `uses ${s.lookout}`);
await page.screenshot({ path: `${shots}/a3-lookout.png` });
await wait(5000);
await page.evaluate(() => window.__game.setCamera(window.__game.state.camera.yaw + 3.1, 0.25));
await wait(400);
await page.screenshot({ path: `${shots}/a4-back-from-lookout.png` });

const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY, sw: document.documentElement.scrollWidth, iw: innerWidth }));
check('the page never scrolls or zooms out of place', scroll.x === 0 && scroll.y === 0 && scroll.sw <= scroll.iw);
s = await state();
check('draw calls and triangles within phone budget', s.drawCalls < 150 && s.triangles < 250000, `${s.drawCalls} calls, ${s.triangles} triangles`);
check('no console errors during play', errors.length === 0, errors.slice(0, 3).join(' | '));

// portrait layout
const portrait = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pp = await portrait.newPage();
await pp.goto(url);
await pp.waitForFunction(() => window.__game, null, { timeout: 90000 });
await pp.tap('#startBtn');
await pp.waitForTimeout(800);
await pp.screenshot({ path: `${shots}/a5-portrait.png` });
check('portrait: start works and the rotate hint shows', await pp.isVisible('#rotateHint'));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
