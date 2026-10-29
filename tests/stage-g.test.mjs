// Stage G acceptance test: mission 6 ("the first strike": past the lookout, the generator lifted with a
// held button, the clock, the Sharks' cars giving chase, losing them, the delivery), the garage
// (repair, paint, an upgrade), and mission 7 ("coming home": the drive against the clock and the end of
// the chapter with the friends). Driving by the test autopilot, on the real roads.
// usage: node tests/stage-g.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

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
ctx.setDefaultTimeout(120000); // software rendering on a busy machine can take a while over one frame
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
const talkThrough = (done, maxSec, what) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const alert = () => G(() => { const a = window.__game.debug.game.alert; return { level: a.level, chasing: a.chasing, state: a.state }; });

// a game saved after mission 5
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 500, done: ['pickup', 'gym', 'hadera', 'crew', 'dolev'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { yard: p.sharksYard, lot: p.beachLot, garage: p.garage, carSpot: p.carSpot, entry: p.haderaEntry }; });

// ---------- mission 6 ----------
await page.tap('#pauseBtn');
await page.tap('#travelBtn');
await until((s) => !s.paused, 3, 'the trip');
let s = await until((s) => !!s.target, 4, 'the marker');
check('the next marker is at Nissim\'s truck', !!s && Math.hypot(s.target.x - P.lot.truck.x, s.target.z - P.lot.truck.z) < 3);
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'heist', 6, 'mission 6');
check('mission 6 "the first strike" starts', !!s && (await page.textContent('#bannerTitle')) === 'המכה הראשונה');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the plan');
// to the yard: the Renault parked on the street beside it
await G((Y) => { const g = window.__game; g.placeCar(Y.street.x, Y.street.z, Math.PI); g.teleport(Y.entry.x + 3, Y.entry.z); }, P.yard);
s = await until((s) => s.mission?.step === 2, 8, 'the yard');
check('at the yard: the lookout walks his round, his view drawn on the ground', !!s && (await G(() => window.__game.debug.game.missions.active.watch?.cone.visible)));
await talkThrough((s) => !s.dialogue, 30, 'Dolev\'s advice');
await page.screenshot({ path: `${shots}/g1-yard.png` });
// stepping into his view for a moment raises the alert; out of it, it stops
const seen = await G(() => { const g = window.__game.debug.game, w = g.missions.active.watch, n = w.npc; const f = { x: Math.sin(n.yaw), z: Math.cos(n.yaw) }; window.__game.teleport(n.pos.x + f.x * 4, n.pos.z + f.z * 4); return true; });
await until(async () => (await alert()).level > 20, 3, 'the alert');
const a1 = await alert();
check('in the lookout\'s view the alert rises', seen && a1.level > 20 && a1.level < 100, `alert ${a1.level.toFixed(0)}`);
check('the alert meter shows', await page.isVisible('#alertMeter'));
// behind him: the generator, unseen
await G(() => { const g = window.__game.debug.game, w = g.missions.active.watch, c = g.world.places.sharksYard.crate; w.npc.yaw = Math.atan2(w.npc.pos.x - c.x, w.npc.pos.z - c.z); w.pause = 6; w.npc.target = null; window.__game.teleport(c.x + 1, c.z + 0.6); });
s = await until((s) => s.prompt === 'להרים את הגנרטור', 4, 'the lift button');
check('by the generator: a button to lift it', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 3, 6, 'lifting');
check('holding still a moment: Nehorai lifts it and carries it', !!s && (await G(() => window.__game.debug.game.nehorai.pose)) === 'carry');
check('a clock starts: they will notice soon', /שניות/.test(await page.textContent('#objText')), await page.textContent('#objText'));
await G(() => { const g = window.__game, c = g.debug.game.car, q = c.local(1.8, 0.3); g.teleport(q.x, q.z); });
s = await until((s) => s.prompt === 'להעמיס את הגנרטור', 4, 'the load button');
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 4, 4, 'loaded');
check('loaded into the Renault', !!s);
check('the arrow now points to Nissim at the beach car park, with the clock in the objective', !!s?.target && Math.hypot(s.target.x - P.lot.parking.x, s.target.z - P.lot.parking.z) < 1 && /ניסים.*שניות/.test(await page.textContent('#objText')), await page.textContent('#objText'));
// wait by the yard until they notice: the chase
await G(() => window.__game.enterCar());
s = await until(async () => (await alert()).chasing, 80, 'the chase');
check('the clock runs out nearby: the Sharks\' cars give chase', !!s);
const chasers = await G(() => window.__game.debug.game.chase?.chasers.length ?? 0);
check('two rival cars, no police', chasers === 2);
const d0 = await G(() => window.__game.debug.game.chase.nearest);
await until(() => false, 6, 'them to come closer');
const d1 = await G(() => window.__game.debug.game.chase?.nearest ?? Infinity);
check('they come after the Renault', d1 < d0, `${d0.toFixed(0)} m → ${d1.toFixed(0)} m`);
await page.screenshot({ path: `${shots}/g2-chase.png` });
// getting away: far up the road toward Gan Shmuel
await G(() => { const g = window.__game, p = g.roadAt('דרך גן שמואל', 200, 1.9); g.placeCar(p.x, p.z, p.yaw + Math.PI); });
s = await until(async (s) => s.mission?.step >= 5, 30, 'losing them');
check('far from them for a few seconds: lost them', !!s && !(await alert()).chasing);
// to Nissim
await G((L) => { const g = window.__game; g.placeCar(L.parking.x, L.parking.z, L.parking.yaw); }, P.lot);
s = await talkThrough((s) => !s.mission, 60, 'mission 6 to end');
s = await state();
check('mission 6 complete: 400 and an engine tune', !s.mission && s.progress.done.includes('heist') && s.progress.unlocks.includes('engine') && s.progress.money === 900, `money ${s.progress.money}`);
check('the tuned engine is in the car', (await G(() => window.__game.debug.game.car.maxSpeed)) === 33);
await G(() => { window.__game.debug.game.alert.level = 0; }); // the Sharks have calmed down: no chase on the way home
check('between the missions the panel says what is next and how it begins', (await page.textContent('#objLabel')) === 'המשימה הבאה' && /חוזרים הביתה · אברהם יתקשר/.test(await page.textContent('#objText')), await page.textContent('#objText'));

// ---------- the garage ----------
await G((G0) => { const g = window.__game; g.damageCar(30); g.placeCar(G0.bay.x, G0.bay.z, G0.bay.yaw); }, P.garage);
s = await until((s) => s.prompt === 'להיכנס למוסך', 5, 'the garage button');
check('in the garage forecourt: a button to go in', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
await wait(300);
check('the garage opens and the game waits', await page.isVisible('#garage'));
await page.tap('#repairBtn');
s = await state();
check('repair: the car is whole, the price paid', s.car.health === 100 && s.progress.money === 900 - 75, `money ${s.progress.money}`);
await page.tap('.upgrade button[data-id="tires"]');
await page.tap('.swatch[aria-label^="אדום"]');
s = await state();
check('new tires and red paint, each at its price', s.progress.money === 825 - 350 - 200 && s.progress.car.upgrades.includes('tires') && s.progress.car.color === '#b8322a', `money ${s.progress.money}`);
check('the engine shows as installed', (await page.textContent('#upgrades')).includes('מותקן'));
await page.screenshot({ path: `${shots}/g3-garage.png` });
await page.tap('#garageClose');
check('leaving the garage', !(await page.isVisible('#garage')) && (await G(() => window.__game.debug.game.car.tune.grip)) > 1);

// ---------- mission 7: home ----------
await G((L) => window.__game.placeCar(L.parking.x, L.parking.z, L.parking.yaw), P.lot); // driving off from the garage
s = await until((s) => s.mission?.id === 'home', 12, 'mission 7');
const rang = !!s && !!(await until(async () => page.isVisible('#callCard'), 6, 'the call'));
check('mission 7 "coming home" starts by itself: Avraham calls, wherever Nehorai is', rang);
check('the panel is headed by the mission', /משימה 7 מתוך 7 · חוזרים הביתה/.test(await page.textContent('#objLabel')), await page.textContent('#objLabel'));
await page.dispatchEvent('#callAnswer', 'pointerdown');
s = await talkThrough((s) => s.mission?.step === 1, 40, 'the drive');
check('Avraham calls: everyone is waiting at Nehorai\'s', !!s);
await G(() => window.__game.enterCar());
await G(() => window.__game.setTimeScale(3));
const L = await G(() => window.__game.layout);
const W = await G(() => window.__game.roadAt('דרך גן שמואל', 0).length), ACC = await G(() => window.__game.roadAt('כביש הגישה', 0).length);
await G(({ W, ACC, L, spot }) => {
  const g = window.__game;
  g.placeCar(-1150, -115.4, Math.PI / 2);
  return g.drivePath([
    ['שדרות הים', 1146 - 940, 2, 4.6], ['דרך גן שמואל', W - 12, 2, 1.9], ['כביש הגישה', ACC - 2, 2, 1.9],
    ['דרך הגבעה', 3, L.homeS - 4, 1.8],
  ], 16);
}, { W, ACC, L, spot: P.carSpot });
s = await until((s) => s.mission?.step >= 2, 280, 'the checkpoints');
check('the drive home passes every checkpoint in time', !!s, s ? '' : (await page.textContent('#objText')));
s = await until((s) => s.autopilot?.done, 60, 'the house');
await G(() => window.__game.stopDriving());
// the last few meters into the narrow driveway: placed by the test (the autopilot only follows roads)
await G((c) => window.__game.placeCar(c.x, c.z, c.yaw), P.carSpot);
s = await until((s) => s.mission?.step >= 3, 15, 'parked');
check('the Renault in its driveway ends the drive', !!s);
// the friends speak in turn: listen from the first line (the drive ran at three times the speed)
await G(() => window.__game.setTimeScale(1));
const voices = new Set();
let shot = false;
await until(async (s) => {
  const t = await page.textContent('#caption');
  for (const n of ['ארז', 'יונתי', 'אברהם', 'דולב', 'מולר']) if (t.includes(`${n}:`)) voices.add(n);
  if (!shot && voices.size) { shot = true; await page.screenshot({ path: `${shots}/g4-home.png` }); }
  if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {});
  return !s.mission;
}, 120, 'the end');
s = await state();
check('everyone is there at the end: Erez, Yonati, Avraham, Dolev and Muller', voices.size === 5, [...voices].join(', '));
check('mission 7 complete: the end of chapter one, free roam', !s.mission && s.progress.unlocks.includes('free-roam') && /סוף הפרק/.test(await page.textContent('#bannerSub')));
await page.tap('#pauseBtn');
const rows = await page.$$eval('#missionRows button', (b) => b.length);
check('every mission can be played again from the pause menu', rows === 7, `${rows} missions`);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
// every objective line the run showed, and the distance when an arrow went with it
await writeFile(`${shots}/guide-log.json`, JSON.stringify(await page.evaluate(() => window.__game.guideLog), null, 1));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
