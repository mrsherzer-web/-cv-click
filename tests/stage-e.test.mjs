// Stage E acceptance test: the road to Hadera and back, mission 3 ("going down to Hadera": the drive past
// Gan Shmuel, Erez's call, the gas station, parking by the boulevard kiosk) and mission 4 ("we don't
// fold": the talk at the kiosk, two rounds at the court, a retry after losing, the speaker back in the
// car), the quick trip from the pause menu, traffic and passers-by.
// Driving is done by the test autopilot on the real roads; the fights by the in-page test bot.
// usage: node tests/stage-e.test.mjs [url] [screenshot dir]
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
const skipTalk = (maxSec = 80) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.dialogue; }, maxSec, 'the conversation to end');
const talkThrough = (done, maxSec, what) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);

// a game saved after mission 2
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 150, done: ['pickup', 'gym'], unlocks: ['gym', 'friends', 'combo', 'hadera'], car: { color: '#f4f4f2', health: 100, upgrades: [] }, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(500);
const P = await G(() => window.__game.debug.world.places);
const L = await G(() => window.__game.layout);
const roadLen = async (name) => (await G((n) => window.__game.roadAt(n, 0).length, name));
const ACC = await roadLen('כביש הגישה'), WEST = await roadLen('דרך גן שמואל');
// quiet roads while the autopilot drives; traffic gets its own check at the end
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(3));

// ---------- mission 3 starts at the Renault ----------
let s = await state();
check('after mission 2 the next one is "going down to Hadera"', /יורדים לחדרה/.test(await page.textContent('#objText')), await page.textContent('#objText'));
check('its blue marker is by the Renault', !!s.target && Math.hypot(s.target.x - s.car.x, s.target.z - s.car.z) < 3);
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'hadera', 6, 'mission 3');
check('stepping on it starts mission 3', !!s && (await page.textContent('#bannerTitle')) === 'יורדים לחדרה');
s = await until((s) => s.prompt === 'להיכנס לרכב', 4, 'the get-in button');
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 1, 30, 'both in the car');
check('Nehorai and Avraham get in', !!s && s.mode === 'car' && s.npcs.avraham.inCar);

// ---------- down the hill ----------
await G((L) => window.__game.drivePath([['דרך הגבעה', L.homeS - 4, 3, 1.8], ['כביש הגישה', 2, -2, 1.9]], 14), L);
s = await until((s) => s.mission?.step === 2, 160, 'the foot of the hill');
check('driving down the hill to the plain', !!s, s ? `at ${s.car.x.toFixed(0)},${s.car.z.toFixed(0)}` : '');
s = await until(async () => page.isVisible('#callCard'), 6, 'the call');
check('Erez calls: a card with his name and an answer button', !!s && /ארז/.test(await page.textContent('#callCard')));
await page.screenshot({ path: `${shots}/e1-call.png` });
await page.dispatchEvent('#callAnswer', 'pointerdown');
await wait(300);
const callLine = await page.textContent('#caption');
check('answering plays the call, over the phone', /📞/.test(callLine), callLine);

// ---------- the gas station ----------
// into the forecourt straight down the lane between the pump islands
await G(({ entry, stop }) => window.__game.drivePath([['דרך גן שמואל', 2, 150, 1.9], ['points', [entry, stop]]], 13), { entry: { x: P.stationEntry.x, z: P.stationEntry.z }, stop: { x: P.stationStop.x, z: P.stationStop.z } });
s = await talkThrough((s) => s.autopilot?.done || s.mission?.step >= 4, 140, 'the station');
check('the call ends and the station is next', !!s && s.mission?.step >= 3);
s = await until((s) => s.mission?.step >= 4, 90, 'Avraham coming back from the shop');
check('stopping at the station: Avraham goes in for Erez\'s snack and comes back', !!s && s.npcs.avraham.inCar);
await G(() => window.__game.stopDriving());
await page.screenshot({ path: `${shots}/e2-station.png` });

// ---------- into Hadera and park by the kiosk ----------
const park = P.safeParking;
await G(({ W, park }) => {
  const g = window.__game, out = g.roadAt('דרך גן שמואל', 205, 1.9);
  return g.drivePath([
    ['points', [{ x: out.x, z: out.z }]], ['דרך גן שמואל', 210, W - 12, 1.9], ['שדרות הים', 4, 1168 - 940 - 40, 4.6],
    ['points', [{ x: park.x + 9, z: -124.4 }, { x: park.x + 3, z: -127 }, { x: park.x, z: park.z + 9 }, { x: park.x, z: park.z }]],
  ], 13);
}, { W: WEST, park });
s = await talkThrough((s) => s.mission?.step >= 5, 160, 'the city');
check('arriving in Hadera: a title card names the new area', !!s && /חדרה/.test(await page.textContent('#bannerTitle')));
await page.screenshot({ path: `${shots}/e3-hadera.png` });
s = await talkThrough((s) => s.autopilot?.done || s.mission?.step >= 6, 150, 'the car park');
await G(() => window.__game.stopDriving());
s = await until((s) => s.mission?.step >= 6, 10, 'parked');
check('parked in the safe car park by the boulevard', !!s, s ? `car at ${s.car.x.toFixed(1)},${s.car.z.toFixed(1)}` : '');
await page.dispatchEvent('#btnExit', 'pointerdown');
s = await talkThrough((s) => !s.mission, 60, 'mission 3 to end');
s = await state();
check('mission 3 complete: Hadera\'s car park is unlocked', !s.mission && s.progress.done.includes('hadera') && s.progress.unlocks.includes('hadera-parking'), s.progress.unlocks.join(','));

// ---------- mission 4: the kiosk ----------
const K = await G(() => { const k = window.__game.debug.world.places.kiosk; return { front: k.front, y: k.y }; });
s = await until((s) => !!s.target, 4, 'the next marker');
check('the next marker is at the kiosk', !!s && Math.hypot(s.target.x - K.front.x, s.target.z - K.front.z) < 2);
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'crew', 6, 'mission 4');
check('mission 4 "we don\'t fold" starts at the kiosk', !!s);
s = await until((s) => s.mission?.step === 1, 15, 'the talk');
check('walking up to them starts the talk', !!s && s.cutscene);
await wait(800);
await page.screenshot({ path: `${shots}/e4-kiosk.png` });
const voices = new Set();
s = await until(async (s) => { const t = await page.textContent('#caption'); for (const n of ['קוצי', 'שפיץ', 'אברהם', 'נהוראי']) if (t.includes(`${n}:`)) voices.add(n); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return s.mission?.step >= 2; }, 120, 'the dare');
check('the talk ends in a dare: Kotzi, Shpitz, Avraham and Nehorai speak', !!s && voices.size === 4, [...voices].join(', '));

// ---------- the court ----------
const C = P.court;
await G((c) => window.__game.teleport(c.x, c.z + 3), C);
s = await until((s) => s.mission?.step === 3 && s.fight, 10, 'round one');
check('inside the court, round one: three of them', !!s && s.fight.opponents.length === 3);
await G(() => window.__game.setTimeScale(1));
await wait(1500);
await page.screenshot({ path: `${shots}/e5-round1.png` });
// losing first: the retry puts everyone back
await G(() => window.__game.hurtPlayer(500));
s = await until((s) => s.hold, 5, 'the failure screen');
check('knocked down: the mission fails, with advice in the reason', !!s && /חוסמים/.test(await page.textContent('#failReason')));
await page.tap('#retryBtn');
s = await until((s) => !s.hold && s.fight && !s.fight.over, 5, 'the retry');
check('retry: round one again, everyone back on their feet', !!s && s.fight.opponents.every((o) => !o.down) && s.fighter.hp === 100);
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
let allyLanded = 0, sitting = 0;
s = await until(async (s) => {
  const f = await G(() => { const g = window.__game.debug.game; return g.fight ? { a: g.fight.allies[0]?.fighter.landed ?? 0, down: g.fight.opponents.filter((o) => o.fighter.down && o.npc.model.pose === 'down').length } : null; });
  if (f) { allyLanded = Math.max(allyLanded, f.a); sitting = Math.max(sitting, f.down); }
  return s.mission?.step >= 4;
}, 240, 'round one to end');
check('round one won; each beaten rival sits down out of the fight', !!s && sitting >= 2, `${sitting} sitting out before the last one fell`);
check('Avraham fights alongside and lands punches', allyLanded > 0, `${allyLanded} punches`);
s = await until((s) => s.fight && s.fight.opponents[0]?.name === 'קוצי', 20, 'round two');
check('round two: Kotzi alone', !!s);
s = await talkThrough((s) => s.mission?.step >= 5, 240, 'round two to end');
await G(() => window.__game.fightBot(null));
check('Kotzi beaten fair and square', !!s);
s = await talkThrough((s) => s.mission?.step >= 6, 90, 'the speaker');
check('the speaker is handed over: Nehorai carries it', !!s && (await G(() => window.__game.debug.game.nehorai.pose)) === 'carry');
await page.screenshot({ path: `${shots}/e6-speaker.png` });

// ---------- the speaker into the car ----------
await G(() => window.__game.setTimeScale(2));
await G(() => { const g = window.__game, c = g.debug.game.car, q = c.local(1.8, 0.3); g.teleport(q.x, q.z); });
s = await until((s) => s.prompt === 'לשים את הרמקול ברכב', 6, 'the button');
check('by the car the button offers to put the speaker in', !!s);
const money0 = (await state()).progress.money;
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => !s.mission, 6, 'mission 4 to end');
s = await state();
check('mission 4 complete: 200 from the bet, the speaker is back, Dolev is next', !s.mission && s.progress.money === money0 + 200 && s.progress.unlocks.includes('speaker') && s.progress.unlocks.includes('dolev'), `money ${s.progress.money}`);

// ---------- back to Katzir on the road (from the boulevard's eastbound lanes) ----------
await G(() => window.__game.setTimeScale(3));
await G(() => { const g = window.__game; g.enterCar(); g.placeCar(-1150, -115.4, Math.PI / 2); });
await G(({ W, ACC, L }) => window.__game.drivePath([
  ['שדרות הים', 1146 - 940, 2, 4.6], ['דרך גן שמואל', W - 12, 2, 1.9], ['כביש הגישה', ACC - 2, L.lotS - 4, 1.9],
], 14), { W: WEST, ACC, L });
s = await until((s) => s.autopilot?.done, 260, 'Katzir');
await G(() => window.__game.stopDriving());
check('and back: from Hadera up the hill to the commercial lot by Katzir\'s gate', !!s && Math.hypot(s.car.x - P.lot.x, s.car.z - P.lot.z) < 40, s ? `car at ${s.car.x.toFixed(0)},${s.car.z.toFixed(0)}` : '');

// ---------- the quick trip ----------
await G(() => window.__game.exitCar());
await until((s) => s.mode === 'foot', 5, 'out of the car');
await page.tap('#pauseBtn');
check('the pause menu offers the trip to Hadera\'s car park', await page.isVisible('#travelBtn'));
await page.tap('#travelBtn');
s = await until((s) => !s.paused, 3, 'the trip');
check('the trip puts Nehorai and the Renault at the car park', !!s && Math.hypot(s.car.x - park.x, s.car.z - park.z) < 2 && Math.hypot(s.player.x - park.x, s.player.z - park.z) < 4);

// ---------- traffic and passers-by ----------
await G(() => window.__game.debug.game.setPopulation({ traffic: 8, people: 10 }));
await G(() => window.__game.setTimeScale(2));
const t0 = await G(() => window.__game.debug.game.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })));
await until(() => false, 6, 'traffic to move');
const t1 = await G(() => window.__game.debug.game.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })));
const moved = t1.filter((p, i) => Math.hypot(p.x - t0[i].x, p.z - t0[i].z) > 5).length;
check('light traffic drives on its routes', t1.length === 8 && moved >= 5, `${moved} of ${t1.length} moved`);
const people = await G(() => window.__game.debug.game.pedestrians.people.filter((p) => p.visible).length);
check('passers-by walk the sidewalks near Nehorai', people >= 6, `${people} people`);
const punchable = await G(() => { const g = window.__game.debug.game; return g.targets.some((t) => g.pedestrians.people.some((p) => p.pos === t.pos)); });
check('passers-by are never something to punch', !punchable);
const stopTest = await G(() => {
  const g = window.__game.debug.game, c = g.traffic.cars.find((q) => q.route !== g.traffic.routes[0] && q.speed > 3);
  if (!c) return null;
  const f = { x: Math.sin(c.yaw), z: Math.cos(c.yaw) };
  window.__game.teleport(c.pos.x + f.x * 10, c.pos.z + f.z * 10);
  return c.id;
});
await until(() => false, 5, 'the car to stop');
const stopped = stopTest === null ? null : await G((id) => { const g = window.__game.debug.game, c = g.traffic.cars[id]; return { v: c.speed, d: Math.hypot(c.pos.x - g.player.pos.x, c.pos.z - g.player.pos.z) }; }, stopTest);
check('a car stops for Nehorai standing in the street', !!stopped && stopped.v < 0.5 && stopped.d > 2.5, stopped ? `speed ${stopped.v.toFixed(2)}, ${stopped.d.toFixed(1)} m away` : 'no moving car found');
await page.screenshot({ path: `${shots}/e7-traffic.png` });
const calls = (await state()).drawCalls;
check('draw calls in the city stay within the phone budget', calls < 150, `${calls} calls`);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
