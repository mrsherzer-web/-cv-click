// Chapter two acceptance test: the morning after in Nehorai's messy room, the call with Erez (the two
// lines word for word), tidying up and meeting Hadar at his gate on Rimon street; Hadar at the gym (the
// uppercut on the bag with the real button, a sparring round); the kiosk, the two-on-two bout and the
// bag; and the chase after the green hatchback to the gas station, failed once on purpose and retried.
// usage: node tests/stage-i.test.mjs [url] [screenshot dir] [first mission: 8 (default) or 10]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
const FROM = Number(process.argv[4] || 8); // 10: start at the kiosk with a save that has 8 and 9 done
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
// tap through a conversation; every line shown is kept by the game itself, so none is missed between looks.
// mark() before whatever starts a conversation; heard is then everything said since
const heard = [];
let mark = 0;
const markNow = async () => { mark = await page.evaluate(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
const listen = async () => {
  const { h, said } = await page.evaluate(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said }));
  heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark))));
};
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const center = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const text = (sel) => page.textContent(sel);

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G((from) => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: from >= 10 ? 1150 : 900,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', ...(from >= 10 ? ['morning', 'boxer'] : [])],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', ...(from >= 10 ? ['hadar', 'uppercut'] : [])],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})), FROM);
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { room: { front: p.room.front, door: p.room.door, bed: p.room.bed, center: p.room.center, heaps: p.room.heaps.map((h) => ({ id: h.id, x: h.x, z: h.z, label: h.label })) }, gate: p.hadarGate, gym: p.gymInside, parking: p.gymParking, court: p.court, kiosk: p.kiosk.front }; });

let s;
if (FROM <= 8) {
// ---------- mission 8: the morning after ----------
s = await state();
check('after chapter one the panel says chapter two is next, and how it starts', /פרק 2/.test(await text('#objLabel')) && /בוקר אחרי · להיכנס הביתה לישון/.test(await text('#objText')), await text('#objText'));
check('its blue marker is at Nehorai\'s front door', !!s.target && Math.hypot(s.target.x - P.room.front.x, s.target.z - P.room.front.z) < 1.5);
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'morning', 8, 'chapter two');
check('stepping on it starts "the morning after"', !!s);
await wait(2600); // the fade to the next morning
s = await until(async () => G(() => { const g = window.__game.debug.game, R = g.world.places.room; return R.inside(g.player.pos.x, g.player.pos.z) && R.group.visible; }), 10, 'the room');
check('the next morning: Nehorai is in his room, and the room is drawn', !!s);
check('...sitting up on the bed', (await G(() => window.__game.debug.game.nehorai.pose)) === 'sit');
await wait(800);
await page.screenshot({ path: `${shots}/i1-room.png` });
s = await talkThrough((s) => s.mission?.step === 1, 40, 'waking up');
check('the panel heading is chapter two, mission 1 of 4', /פרק 2 · משימה 1 מתוך 4 · בוקר אחרי/.test(await text('#objLabel')), await text('#objLabel'));
check('then: call Erez from the phone, and the phone shows a dot', /להתקשר לארז/.test(await text('#objText')) && (await page.isVisible('#phoneBadge')));
const ground = await G(() => { const g = window.__game.debug.game; return { y: g.player.pos.y, floor: g.world.places.room.floorY }; });
check('Nehorai stands on the room\'s floor', Math.abs(ground.y - ground.floor) < 0.05, `${ground.y.toFixed(2)} / ${ground.floor.toFixed(2)}`);
await page.tap('#phoneBtn');
check('in the phone, Erez is the one to call', (await page.getAttribute('#contacts button[data-id="erez"]', 'class'))?.includes('wanted'));
await markNow();
await page.tap('#contacts button[data-id="erez"]');
s = await talkThrough((s) => s.mission?.step === 2, 60, 'the call');
check('Nehorai: "אחי, איזה כיף שטיפלנו בקטע של הרמקול, יא אללק!"', heard.some((t) => t.includes('נהוראי:') && t.includes('אחי, איזה כיף שטיפלנו בקטע של הרמקול, יא אללק!')), heard[0]);
check('Erez: "כן אחי, אני שמח רצח, אחי."', heard.some((t) => t.includes('ארז:') && t.includes('כן אחי, אני שמח רצח, אחי.')), heard[1]);
check('and Erez says Hadar is back from New York', heard.some((t) => /הדר חזר מניו יורק/.test(t)));
// tidying up: the three heaps, each with the context button
for (const h of P.room.heaps) {
  // a step from the heap toward the middle of the room, where there is floor to stand on
  const c = P.room.center, l = Math.hypot(c.x - h.x, c.z - h.z) || 1;
  await G((p) => window.__game.teleport(p.x, p.z), { x: h.x + ((c.x - h.x) / l) * 0.5, z: h.z + ((c.z - h.z) / l) * 0.5 });
  const got = await until((s) => s.prompt === h.label, 4, `the button by ${h.id}`);
  if (got) await page.dispatchEvent('#btnInteract', 'pointerdown');
  await wait(300);
}
s = await until((s) => s.mission?.step === 3, 20, 'the tidying');
check('three heaps picked up with the context button: next, the door', !!s && /לצאת מהחדר/.test(await text('#objText')), await text('#objText'));
await G((d) => window.__game.teleport(d.x, d.z), P.room.door);
s = await until((s) => s.prompt === 'לצאת מהבית', 4, 'the door button');
check('at the door: a button to go out', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 4, 10, 'outside');
check('out of the front door: Nehorai is in the street, the room is not drawn', !!s && Math.hypot(s.player.x - P.room.front.x, s.player.z - P.room.front.z) < 2 && !(await G(() => window.__game.debug.world.places.room.group.visible)));
check('the arrow points to Hadar\'s gate on Rimon street', !!s?.target && Math.hypot(s.target.x - P.gate.x, s.target.z - P.gate.z) < 1 && /הדר ברחוב הרימון/.test(await text('#objText')));
await G((g) => window.__game.teleport(g.x + Math.sin(g.yaw) * 2.6, g.z + Math.cos(g.yaw) * 2.6), P.gate);
s = await until((s) => s.mission?.step === 5, 8, 'Hadar');
check('at the gate: Hadar, introduced as a new character', !!s && (await text('#bannerTitle')) === 'הדר בן עמי');
await wait(900);
await page.screenshot({ path: `${shots}/i2-hadar.png` });
s = await talkThrough((s) => !s.mission || s.mission.id !== 'morning', 60, 'the meeting');
s = await state();
check('mission 8 complete: Hadar in the crew and in the phone, 100 on the table', s.progress.done.includes('morning') && s.progress.unlocks.includes('hadar') && s.progress.money === 1000, `money ${s.progress.money}`);
await page.tap('#phoneBtn');
check('the phone lists Hadar', await page.isVisible('#contacts button[data-id="hadar"]'));
await page.tap('#phoneClose');

// ---------- mission 9: New York at the gym ----------
s = await until((s) => !!s.target, 4, 'the next marker');
check('next: the Renault, Hadar along', /ניו יורק במכון · לגשת לרנו/.test(await text('#objText')) && !!s && Math.hypot(s.target.x - s.car.x, s.target.z - s.car.z) < 3);
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.id === 'boxer', 6, 'mission 9');
check('getting into the Renault starts "New York at the gym"', !!s);
s = await until((s) => s.mission?.step === 1 && s.npcs.hadar?.inCar, 30, 'Hadar in the car');
check('Hadar gets in too', !!s);
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); }, P.parking);
await G(() => window.__game.exitCar());
await until((s) => s.mode === 'foot', 6, 'on foot');
await G((p) => window.__game.teleport(p.x, p.z), P.gym);
s = await until((s) => s.mission?.step === 2, 8, 'the gym');
check('into the gym: everyone says hello to Hadar', !!s);
s = await talkThrough((s) => s.mission?.step === 3, 60, 'hellos');
check('Hadar\'s lesson: four in a row on the bag, the fourth an uppercut', !!s && /אפרקאט \(0\/3\)/.test(await text('#objText')), await text('#objText'));
await talkThrough((s) => !s.dialogue, 30, 'the lesson');
await G(() => window.__game.faceBag(1));
await G(() => window.__game.setTimeScale(1));
await until((s) => s.buttons.btnPunch, 6, 'the punch button');
const pc = await center('#btnPunch');
// four quick taps (jab, cross, hook, uppercut), then a breather for the stamina, as Hadar says
for (let set = 0; set < 12 && (await state()).mission?.step === 3; set++) {
  for (let i = 0; i < 4; i++) { await touch('touchStart', [{ ...pc, id: 3 }]); await wait(40); await touch('touchEnd', []); await wait(140); }
  await until((s) => s.fighter.stamina > 90, 8, 'a breather');
}
s = await until((s) => s.mission?.step === 4, 20, 'three uppercuts');
check('three uppercuts on the bag, with the real punch button', !!s, await text('#objText'));
check('the uppercut is the fourth punch of the combination now', (await G(() => window.__game.debug.game.bagUppercuts)) >= 3);
// the sparring round: the fight bot plays Nehorai's side
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
s = await until((s) => s.mission?.step === 5 || !!s.hold, 240, 'the round');
if (s?.hold) { await page.tap('#retryBtn'); s = await until((s) => s.mission?.step === 5, 240, 'the round, again'); }
await G(() => window.__game.fightBot(null));
check('sparring with Hadar in the ring: Nehorai wins the round', !!s);
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => !s.mission || s.mission.id !== 'boxer', 60, 'the story');
s = await state();
check('mission 9 complete: the uppercut learned, 150 more', s.progress.done.includes('boxer') && s.progress.unlocks.includes('uppercut') && s.progress.money === 1150, `money ${s.progress.money}`);
}

// ---------- mission 10: the kiosk ----------
await page.tap('#pauseBtn');
await page.tap('#travelBtn');
await until((s) => !s.paused, 3, 'the trip');
s = await until((s) => !!s.target, 4, 'the kiosk marker');
check('next: the kiosk on the boulevard', /ביקור בקיוסק/.test(await text('#objText')) && !!s && Math.hypot(s.target.x - P.kiosk.x, s.target.z - P.kiosk.z) < 2);
await markNow();
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'kiosk', 6, 'mission 10');
check('"a visit to the kiosk" starts: the crew and Bulldozer are there', !!s && (await G(() => window.__game.debug.game.npc('bulldozer').visible)));
s = await talkThrough((s) => s.mission?.step === 1, 80, 'the talk');
check('Bulldozer says it was luck; Hadar sets a two-on-two at the court', heard.some((t) => t.includes('בולדוזר:') && /מזל/.test(t)) && heard.some((t) => t.includes('הדר:') && /שניים על שניים/.test(t)));
await G((c) => window.__game.teleport(c.x, c.z + 4), P.court);
s = await until((s) => s.mission?.step === 2, 8, 'the court');
check('at the court: Nehorai and Hadar against Bulldozer and Shpitz', !!s && s.fight && s.fight.opponents.map((o) => o.name).join(',') === 'בולדוזר,שפיץ');
await G(() => window.__game.setTimeScale(1));
await markNow();
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
s = await until((s) => s.mission?.step === 3 || !!s.hold, 300, 'the bout');
if (s?.hold) { await page.tap('#retryBtn'); s = await until((s) => s.mission?.step === 3, 300, 'the bout, again'); }
await G(() => window.__game.fightBot(null));
check('the bout is won', !!s);
await page.screenshot({ path: `${shots}/i3-bout.png` });
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => s.mission?.id === 'gloves', 80, 'the bag');
check('Bulldozer grabs Hadar\'s bag with the gloves from New York', heard.some((t) => /הכפפות שלי/.test(t)));
check('mission 10 complete, and the chase starts straight away', !!s && (await G(() => window.__game.debug.game.progress.done.includes('kiosk'))));

// ---------- mission 11: after the gloves ----------
check('"after the gloves": the green hatchback is there, with the three of them inside', await G(() => { const g = window.__game.debug.game, m = g.missions.active; return !!m.van && ['bulldozer', 'shpitz', 'kotzi'].every((id) => g.npc(id).inCar === m.van); }));
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.step === 1, 30, 'both in the car');
check('Nehorai and Hadar in the Renault: the chase is on', !!s);
const van = () => G(() => { const v = window.__game.debug.game.missions.active?.van; return v ? { x: v.pos.x, z: v.pos.z, yaw: v.yaw, speed: v.speed } : null; });
const v0 = await van();
await until(() => false, 6, 'the hatchback to drive off');
const v1 = await van();
check('they drive off', !!v1 && Math.hypot(v1.x - v0.x, v1.z - v0.z) > 20, v1 ? `${Math.hypot(v1.x - v0.x, v1.z - v0.z).toFixed(0)} m` : '');
check('the arrow follows them, with the distance in the objective', /לא לאבד את הירוקה · \d+ מ׳/.test(await text('#objText')), await text('#objText'));
// on purpose: staying put until they are gone
s = await until((s) => !!s.hold, 120, 'losing them');
check('left far behind for a while: the mission fails, with advice', !!s && /להישאר צמודים/.test(await text('#failReason')));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 0 && !s.hold, 10, 'the retry');
const v2 = await van(), start = await G(() => window.__game.debug.game.missions.active.s.pts[0]);
check('retry: the hatchback is back at the start, waiting until Nehorai is in the Renault', !!s && Math.hypot(v2.x - start.x, v2.z - start.z) < 3, `${Math.hypot(v2.x - start.x, v2.z - start.z).toFixed(1)} m from the start`);
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.step === 1, 30, 'both in the car again');
// this time keeping up: the Renault stays about twenty meters behind them
await G(() => window.__game.setTimeScale(3));
for (let k = 0; k < 400; k++) {
  const st = await state();
  if (st.mission?.step !== 1) break;
  const v = await van();
  await G((v) => { const g = window.__game, b = 22; g.placeCar(v.x - Math.sin(v.yaw) * b, v.z - Math.cos(v.yaw) * b, v.yaw); }, v);
  await until(() => false, 1.5, 'a little driving');
}
s = await until((s) => s.mission?.step === 2, 20, 'the gas station');
check('kept up all the way: they pull in at the gas station', !!s);
const v3 = await van();
await markNow();
await G((v) => { const g = window.__game; g.placeCar(v.x - Math.sin(v.yaw) * 8, v.z - Math.cos(v.yaw) * 8, v.yaw); }, v3);
s = await until((s) => s.mission?.step === 3, 10, 'stopping by them');
check('stopping by them', !!s);
await G(() => window.__game.setTimeScale(1));
await wait(1500);
await page.screenshot({ path: `${shots}/i4-station.png` });
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => !s.mission, 120, 'the end');
s = await state();
check('talked out: the gloves back, a boxing night set for next week', heard.some((t) => /ערב אגרוף/.test(t)) && heard.some((t) => /הנה התיק/.test(t)), heard.join(' / ').slice(0, 400));
check('mission 11 complete: the end of chapter two', !s.mission && s.progress.unlocks.includes('chapter-2') && s.progress.money === 1150 + 100 + 300, `money ${s.progress.money}`);
check('the panel: chapter two is done, chapter three is next', /פרק 3 · המשימה הבאה/.test(await text('#objLabel')) && /ערב אגרוף/.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
await page.tap('#pauseBtn');
const rows = await page.$$eval('#missionRows .mission-row', (r) => r.map((x) => x.textContent));
check('the pause menu lists the chapters, chapter two\'s four missions among them', rows.length === 13 && rows.filter((r) => /פרק 2/.test(r)).length === 4, `${rows.length} rows`);
await page.tap('#resumeBtn');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await writeFile(`${shots}/guide-log.json`, JSON.stringify(await page.evaluate(() => window.__game.guideLog), null, 1));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
