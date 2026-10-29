// Stage C acceptance test: mission 1 ("picking up Avraham") from start to finish with real driving,
// the reward, saving, failing and retrying, and playing it again. Headless Chromium, phone emulation.
// usage: node tests/stage-c.test.mjs [url] [screenshot dir]
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
    await wait(80);
  }
}
// tap the caption to move the conversation on, until it is over
async function skipTalk(maxSec = 60) {
  return until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.dialogue; }, maxSec, 'the conversation to end');
}
// walk with the stick toward a point, turning the camera toward it as we go
async function walkTo(p, r = 2.5, maxSec = 25) {
  const aim = () => G((p) => { const g = window.__game, s = g.state.player; g.setCamera(Math.atan2(-(p.x - s.x), -(p.z - s.z)), 0.25); }, p);
  await aim();
  await touch('touchStart', [{ x: 150, y: 290, id: 1 }]);
  await touch('touchMove', [{ x: 150, y: 228, id: 1 }]);
  const s = await until(async (s) => { await aim(); await touch('touchMove', [{ x: 150, y: 228, id: 1 }]); return Math.hypot(s.player.x - p.x, s.player.z - p.z) < r; }, maxSec, 'walking there');
  await touch('touchEnd', []);
  return s;
}

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('a new game offers "start" (nothing saved yet)', (await page.textContent('#startBtn')) === 'להתחיל' && (await page.isHidden('#newGameBtn')));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.setTimeScale(3));
const L = await G(() => window.__game.layout), P = await G(() => window.__game.places);

// ---------- 1-2: to the Renault and in ----------
let s = await state();
check('mission 1 starts: get to the white Renault', s.mission?.id === 'pickup' && s.mission.step === 0 && s.target && Math.hypot(s.target.x - s.car.x, s.target.z - s.car.z) < 1, s.mission?.objective);
const banner = await page.textContent('#bannerTitle');
check('a title card names the mission', banner === 'אוספים את אברהם', banner);
const mapInk = await G(() => { const c = document.getElementById('minimap'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
check('the minimap is drawn', mapInk > 5000, `${mapInk} pixels`);
// through the driveway, not over the front wall: first its mouth by the street, then the driver's door
{
  const c = P.carSpot, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), st = (await state()).player;
  const ends = [1, -1].map((k) => ({ x: c.x + fx * 5.2 * k, z: c.z + fz * 5.2 * k }));
  const mouth = ends.sort((a, b) => Math.hypot(a.x - st.x, a.z - st.z) - Math.hypot(b.x - st.x, b.z - st.z))[0];
  await walkTo(mouth, 1.0);
  await walkTo({ x: c.x + Math.cos(c.yaw) * 1.8, z: c.z - Math.sin(c.yaw) * 1.8 }, 1.2);
}
s = await until((s) => s.prompt === 'להיכנס לרכב', 5, 'the get-in button');
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 2, 5, 'step 2');
check('in the car the objective is Avraham\'s house', !!s && s.mode === 'car' && /אברהם/.test(s.mission.objective), s?.mission?.objective);

// ---------- 3: driving there on the roads ----------
await G((L) => window.__game.drivePath([['דרך הגבעה', L.homeS + 6, L.sideS - 7, -1.8], ['רחוב הרימון', 9, L.avS - 2, -1.6]], 11), L);
s = await until((s) => s.autopilot?.done, 120, 'arriving at Avraham\'s');
await page.screenshot({ path: `${shots}/c1-at-avraham.png` });
check('drove to Avraham\'s house without crashing', !!s && s.car.impacts === 0 && s.mission.step === 3, s ? `step ${s.mission.step}, impacts ${s.car.impacts}, car health ${s.car.health.toFixed(0)}` : 'did not arrive');
await G(() => window.__game.stopDriving());

// ---------- 4-5: the call, and Avraham gets in ----------
s = await until((s) => s.prompt === 'התקשר לאברהם', 5, 'the call button');
check('stopped at the marker: the button says "call Avraham"', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
await wait(300);
const callLine = await page.textContent('#caption');
check('the call is spoken with names', /אברהם:|נהוראי:/.test(callLine), callLine);
await skipTalk();
s = await until((s) => s.npcs.avraham?.visible, 6, 'Avraham coming out');
check('Avraham comes out of his house', !!s);
await page.screenshot({ path: `${shots}/c2-avraham-walks.png` });
s = await until((s) => s.mission?.step === 5, 40, 'Avraham in the car');
check('Avraham walks to the car and gets in', !!s && s.npcs.avraham.inCar);

// ---------- 6: to the gym, chatting on the way ----------
await G((L) => {
  const g = window.__game, end = g.roadAt('רחוב הרימון', -1), c = L.turn;
  const a0 = Math.atan2(end.z - c.z, end.x - c.x);
  const lot = g.places.gymParking, entry = g.roadAt('כביש הגישה', L.lotS - 4, -1.9);
  return g.drivePath([
    ['רחוב הרימון', L.avS - 2, -2, -1.6], ['circle', c, 5.6, a0], ['רחוב הרימון', -3, 9, -1.6],
    ['דרך הגבעה', L.sideS - 7, 3, -1.8], ['כביש הגישה', 3, L.lotS - 12, -1.9],
    ['points', [{ x: entry.x, z: entry.z }, { x: (entry.x + lot.x) / 2, z: (entry.z + lot.z) / 2 }, { x: lot.x, z: lot.z }]],
  ], 12);
}, L);
let chat = false;
s = await until(async (s) => { if (s.dialogue && /אברהם:/.test(await page.textContent('#caption'))) chat = true; return s.autopilot?.done; }, 200, 'arriving at the gym');
await page.screenshot({ path: `${shots}/c3-at-gym.png` });
check('they chat on the way', chat);
check('drove to the gym and parked', !!s && s.mission.step === 6, s ? `step ${s.mission.step}, impacts ${s.car.impacts}` : 'did not arrive');
await G(() => window.__game.stopDriving());

// ---------- 7-8: out of the car, into the gym, meet the friends ----------
await page.dispatchEvent('#btnExit', 'pointerdown');
s = await until((s) => s.mission?.step === 7, 6, 'step 7');
check('getting out: Avraham gets out too', !!s && s.mode === 'foot' && !s.npcs.avraham.inCar && s.npcs.avraham.visible);
s = await walkTo(P.gymInside, 3.2, 40);
s = await until((s) => s.mission?.step === 8, 6, 'the meeting');
check('walking into the gym starts the meeting', !!s && s.cutscene);
await wait(1500);
await page.screenshot({ path: `${shots}/c4-meeting.png` });
const voices = new Set();
await until(async (s) => { const t = await page.textContent('#caption'); for (const n of ['ארז', 'יונתי', 'מולר']) if (t.includes(`${n}:`)) voices.add(n); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.mission; }, 90, 'the mission to end');
check('Yonati, Erez and Muller each speak', voices.size === 3, [...voices].join(', '));
s = await state();
await page.screenshot({ path: `${shots}/c5-done.png` });
check('mission complete: reward paid and unlocks recorded', !s.mission && s.progress.done.includes('pickup') && s.progress.money === 150 && s.progress.unlocks.includes('gym') && s.progress.unlocks.includes('friends'), `money ${s.progress.money}, unlocks ${s.progress.unlocks}`);
check('the reward shows on screen', /המשימה הושלמה/.test(await page.textContent('#bannerKicker')) && (await page.textContent('#moneyText')) === '150');

// ---------- saving ----------
const saved = await G(() => JSON.parse(localStorage.getItem('nehorai-game:save:v1') || 'null'));
check('progress is saved in the browser', saved?.done?.includes('pickup') && saved.money === 150);

// ---------- play again, fail, retry ----------
await page.tap('#pauseBtn');
const row = await page.textContent('#missionRows');
check('the pause menu lists the finished mission to play again', /אוספים את אברהם/.test(row) && /לשחק שוב/.test(row), row);
await page.tap('#missionRows button');
s = await until((s) => s.mission?.id === 'pickup' && s.mission.step === 0 && !s.paused, 5, 'the replay');
check('playing it again starts from the beginning at home', !!s && Math.hypot(s.player.x - P.start.x, s.player.z - P.start.z) < 3 && Math.hypot(s.car.x - P.carSpot.x, s.car.z - P.carSpot.z) < 1.5);
await G(() => { const g = window.__game; g.enterCar(); g.damageCar(500); });
s = await until((s) => s.hold, 4, 'the failure screen');
check('wrecking the car fails the mission with a reason', !!s && (await page.isVisible('#failMenu')) && (await page.textContent('#failReason')).length > 10);
await page.tap('#retryBtn');
s = await until((s) => !s.hold, 4, 'the retry');
check('retry: back at the checkpoint with the car repaired', !!s && s.mission?.id === 'pickup' && s.mission.step === 0 && s.car.health === 100);
// finish the replay quickly: the reward is not paid twice
await G(() => { const g = window.__game; g.enterCar(); const p = g.places.avrahamPickup; g.placeCar(p.x, p.z, p.yaw); });
s = await until((s) => s.prompt === 'התקשר לאברהם', 6, 'the call button (replay)');
await page.dispatchEvent('#btnInteract', 'pointerdown');
await skipTalk();
s = await until((s) => s.mission?.step === 5, 40, 'Avraham (replay)');
await G(() => { const g = window.__game, p = g.places.gymParking; g.placeCar(p.x, p.z, p.yaw); });
s = await until((s) => s.mission?.step === 6, 6, 'parked (replay)');
await page.dispatchEvent('#btnExit', 'pointerdown');
await until((s) => s.mission?.step === 7, 6, 'out (replay)');
await G(() => { const g = window.__game, p = g.places.gymInside; g.teleport(p.x, p.z); });
await until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.mission; }, 90, 'replay end');
s = await state();
check('a replayed mission does not pay twice', s.progress.money === 150, `money ${s.progress.money}`);

// ---------- a saved game continues ----------
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('after reloading, the start screen offers to continue', (await page.textContent('#startBtn')) === 'להמשיך' && (await page.isVisible('#newGameBtn')));
await page.tap('#startBtn');
await wait(400);
s = await state();
check('continuing keeps the money and finished missions', s.progress.money === 150 && s.progress.done.includes('pickup'));

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
