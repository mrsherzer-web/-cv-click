// Chapter five acceptance test: Ido's call at home (17:00), the four-hour skip to 21:00 and the night,
// out of the house, the walk to the pub, the entrance, the bar with Kai and Yahli, Liam from behind;
// then the villa: the plan at the pub, the drive, Muller on the roof opposite, the mark button (a guard
// Muller can see goes out from the roof), the yard and the rooms, the two bags, the two cars, the chase
// back to the pub, the 120 km/h reward; the radio in the car; the new contacts on the phone.
// usage: node tests/stage-l.test.mjs [url] [screenshot dir]
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
ctx.setDefaultTimeout(240000);
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
const heard = [];
let mark = 0;
const markNow = async () => { mark = await page.evaluate(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
const listen = async () => {
  const { h, said } = await page.evaluate(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said }));
  heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark))));
};
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const text = (sel) => page.textContent(sel);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });

// a game saved at the end of chapter four
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 2550,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves', 'fightnight', 'mainevent', 'ido', 'bank'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2', 'fightnight', 'chapter-3', 'ido', 'ido-crew', 'paintball', 'chapter-4'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('the start screen counts six chapters and eighteen missions', /שישה פרקים · שמונה עשרה משימות/.test(await text('#startScreen')));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { home: p.home.interior ? { door: p.home.interior.door, living: p.home.interior.living, outside: p.home.interior.outside, floorY: p.home.interior.floorY } : null, pub: { entrance: p.pub.entrance, doorInside: p.pub.doorInside, bar: p.pub.bar, parking: p.pub.parking, parkingY: p.pub.parkingY, liamSpot: p.pub.liamSpot }, villa: { parking: p.villa.parking, gate: p.villa.gate, door: p.villa.door, bags: p.villa.bags, cars: p.villa.cars, post: p.villa.mullerPost, roofSpots: p.villa.roofSpots } }; });
check('the house has an interior, the pub and the villa are in the world', !!P.home && !!P.pub.bar && !!P.villa.post);

// ---------- mission 16: the pub ----------
let s = await state();
check('after chapter four the panel says chapter five is next, and how it starts', /פרק 5 · המשימה הבאה/.test(await text('#objLabel')) && /הפאב בקציר · /.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
s = await until((s) => s.mission?.id === 'pub', 25, 'the mission');
check('a few quiet seconds later "the pub in Katzir" begins', !!s);
await wait(1800);
const inside = await G(() => { const g = window.__game, I = g.debug.world.places.home.interior; return I.inside(g.debug.game.player.pos.x, g.debug.game.player.pos.z); });
check('it begins inside the house, by day', inside && (await state()).night < 0.1);
check('the panel heading is chapter five, mission 1 of 2', /פרק 5 · משימה 1 מתוך 2 · הפאב בקציר/.test(await text('#objLabel')), await text('#objLabel'));
await snap('l1-home-17');
s = await until(async () => page.isVisible('#callCard'), 15, 'Ido ringing');
check('Ido calls: a card with his name', !!s && (await text('#callName')) === 'עידו');
await markNow();
await page.tap('#callAnswer');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the call');
check('the call: the pub opened in Katzir, and Nehorai is in', heard.some((l) => l.includes('פתחו את הפאב בקציר')) && heard.some((l) => l.includes('בטח שאני בא')), heard.join(' / ').slice(0, 160));
s = await until((s) => s.night > 0.9, 12, 'the night');
check('four hours pass: it is 21:00 and night', !!s && /21:00/.test(await text('#objText')), await text('#objText'));
await snap('l2-home-night');
await G((d) => { const g = window.__game; g.teleport(d.x, d.z); }, P.home.door);
s = await until((s) => s.prompt === 'לצאת החוצה', 8, 'the door');
check('at the door: a button to go out', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 2, 8, 'outside');
check('outside: the way to the pub is the goal', !!s && /לפאב/.test(await text('#objText')), await text('#objText'));
await G((e) => { const g = window.__game; g.teleport(e.x + 2.5, e.z + 2); }, P.pub.entrance);
await G((e) => { const g = window.__game; g.teleport(e.x, e.z); }, P.pub.entrance);
s = await until((s) => s.mission?.step === 3, 10, 'the entrance');
check('at the pub door: the entrance scene plays (a cutscene)', !!s && (await until((s) => s.cutscene, 4, 'cutscene')) !== null);
await wait(1500);
await snap('l3-pub-enter');
s = await until((s) => s.mission?.step === 4, 30, 'the bar step');
check('then the bar: Kai and Yahli are the goal', !!s && /קאי ויהלי/.test(await text('#objText')), await text('#objText'));
const crowd = await G(() => (window.__game.debug.game.pubCrowd || []).filter((n) => n.visible).length);
check('the pub is full: two dozen people inside', crowd >= 20, `${crowd}`);
await markNow();
await G((b) => { const g = window.__game; g.teleport(b.x, b.z); }, P.pub.bar.player);
s = await talkThrough((s) => s.mission === null || s.mission.id !== 'pub', 120, 'the bar talk');
check('the bar talk: Kai welcomes him, Yahli says Liam is coming, Liam is behind him, the ask', heard.some((l) => l.includes('ברוך הבא לפאב')) && heard.some((l) => l.includes('גם ליאם מגיע היום')) && heard.some((l) => l.includes('אני פה מאחוריך')) && heard.some((l) => l.includes('אני צריך אתכם')), `${heard.length} lines`);
const liamSeen = await G(() => window.__game.debug.game.npc('liam').visible);
check('Liam is there', liamSeen);
await snap('l4-bar');
s = await state();
check('mission 16 done: Liam, Kai and Yahli unlocked, 300 shekels', s.progress.done.includes('pub') && ['liam', 'kai', 'yahli', 'pub-crew'].every((u) => s.progress.unlocks.includes(u)) && s.progress.money === 2850, `${s.progress.money}`);
await page.tap('#phoneBtn');
await wait(300);
const contacts = await text('#contacts');
check('the phone lists Liam, Kai and Yahli', /ליאם/.test(contacts) && /קאי/.test(contacts) && /יהלי/.test(contacts), contacts.replace(/\s+/g, ' ').slice(0, 80));
await page.tap('#phoneClose');

// ---------- mission 17: the villa ----------
check('the panel says the next mission begins at the pub door', /המשימה הבאה/.test(await text('#objLabel')) && /הווילה של יניב · /.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
await G((e) => { const g = window.__game; g.teleport(e.x + 3, e.z + 3); }, P.pub.entrance);
await markNow();
await G((e) => { const g = window.__game; g.teleport(e.x, e.z); }, P.pub.entrance);
s = await until((s) => s.mission?.id === 'villa', 10, 'the villa mission');
check('"Yaniv\'s villa" begins at the pub door', !!s);
await wait(1200);
await snap('l5-brief');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the plan');
check('the plan: Muller in the building opposite, Nehorai leads in the Renault', heard.some((l) => l.includes('בבניין ממול')) && heard.some((l) => l.includes('אתה מוביל')), heard.join(' / ').slice(0, 120));
check('the goal: drive to the villa', /לווילה/.test(await text('#objText')), await text('#objText'));
await G(() => window.__game.enterCar());
await markNow();
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); }, P.villa.parking);
s = await until((s) => s.mission?.step === 2, 12, 'the villa');
check('at the villa: Muller goes up (a cutscene)', !!s);
await wait(2500);
await snap('l6-muller-up');
s = await talkThrough((s) => s.mission?.step === 3, 90, 'the post');
check('Muller is in position; the rules', heard.some((l) => l.includes('בעמדה')) && heard.some((l) => l.includes('מולר רואה')), heard.join(' / ').slice(0, 120));
const ow = await G(() => { const g = window.__game.debug.game, P = g.paint, m = g.npc('muller'); return { set: !!P.overwatch, guards: P.guards.length, allies: P.allies.length, armed: P.armed, mullerY: m.pos.y, postY: g.world.places.villa.mullerPost.y, roof: g.npc('vg5').pos.y - g.world.places.villa.y }; });
check('nine guards on their posts, the crew with markers, Muller on the roof opposite', ow.set && ow.guards === 9 && ow.allies >= 6 && ow.armed && Math.abs(ow.mullerY - ow.postY) < 0.3 && ow.roof > 2.5, JSON.stringify(ow));
s = await until(async () => !(await page.getAttribute('#btnMark', 'hidden') !== null), 5, 'the mark button');
check('the mark button is on screen', !!s);
check('the yard is the goal, with the count', /בחצר ועל הגג \(0\/6\)/.test(await text('#objText')), await text('#objText'));
// mark for Muller: a guard he can see goes out from the roof
const marked = await G(() => { const g = window.__game.debug.game, P = g.paint; const t = P.guards.find((x) => !x.marked && P.overwatchSees(x)); if (!t) return { ok: false, reason: 'no guard in sight' }; P.lock = t; const ok = P.mark(); return { ok, marked: t.marked, who: t.npc.spec?.id || t.npc.id, pose: t.npc.model.pose }; });
check('"mark": Muller marks a guard he can see from the roof, who sits down', marked.ok && marked.marked, JSON.stringify(marked));
await wait(600);
await snap('l7-overwatch');
const noSight = await G(() => { const g = window.__game.debug.game, P = g.paint; const t = P.guards.find((x) => !x.marked && !P.overwatchSees(x)); if (!t) return null; P.lock = t; return { ok: P.mark(), marked: t.marked }; });
check('a guard Muller cannot see is not marked from the roof', noSight === null || (!noSight.ok && !noSight.marked), JSON.stringify(noSight));
await G(() => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) { const id = x.npc.spec?.id || ''; if (/^vg[1-6]$/.test(id) && !x.marked) P.markGuard(x, 'test'); } });
s = await until((s) => s.mission?.step === 4, 8, 'the rooms');
check('the yard is clear: into the villa, room by room', !!s && /לווילה|חדר/.test(await text('#objText')), await text('#objText'));
await G((d) => { const g = window.__game; g.teleport(d.x, d.z - 2.5); }, P.villa.door);
await wait(800);
check('inside: the goal names the room to clear', /לנקות את/.test(await text('#objText')), await text('#objText'));
await snap('l8-inside');
await G(() => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) { const id = x.npc.spec?.id || ''; if (/^vg[7-9]$/.test(id) && !x.marked) P.markGuard(x, 'test'); } });
s = await until((s) => s.mission?.step === 5, 8, 'the bags');
check('all rooms clear: the bags are the goal', !!s && /תיקים/.test(await text('#objText')), await text('#objText'));
const bagsTaken = () => G(() => (window.__game.debug.game.missions.active?.bags || []).filter((b) => b.taken).length);
for (const [i, b] of P.villa.bags.entries()) {
  await G((b) => { const g = window.__game; g.teleport(b.x - 1.2, b.z); }, b);
  for (let tries = 0; tries < 3 && (await bagsTaken()) < i + 1; tries++) {
    s = await until((s) => s.prompt === 'לקחת תיק', 6, 'the bag button');
    if (!s) break;
    await page.dispatchEvent('#btnInteract', 'pointerdown');
    await until(async () => (await bagsTaken()) >= i + 1, 2, 'the bag taken');
  }
}
s = await until((s) => s.mission?.step === 6, 6, 'two bags');
check('two bags taken: out to the cars', !!s && /לרנו/.test(await text('#objText')), await text('#objText'));
await G((c) => { const g = window.__game; g.teleport(c.x + 1.8, c.z); }, P.villa.cars.nehorai);
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.step === 7, 8, 'the chase');
check('in the Renault: the escape to the pub begins', !!s, await text('#objText'));
s = await until(() => G(() => !!window.__game.debug.game.chase), 14, 'the cars behind');
check('after a moment of grace, cars behind', !!s);
await wait(1500);
await snap('l9-chase');
const seat = await G(() => { const g = window.__game.debug.game; const c = g.chaseCars.find((v) => v.name === 'seat'); return c ? { x: c.pos.x, z: c.pos.z, speed: c.speed } : null; });
check("Liam's Seat is on the road too", !!seat, JSON.stringify(seat));
await markNow();
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); }, P.pub.parking);
s = await until((s) => s.mission?.step === 8, 12, 'the pub');
check('at the pub: the end scene', !!s);
await wait(1200);
await snap('l10-end');
s = await talkThrough((s) => s.mission === null, 90, 'the end');
check('the end: the pot is home, the garage tunes the Renault to 120', heard.some((l) => l.includes('הקופה חזרה')) && heard.some((l) => l.includes('מאה ועשרים')), heard.join(' / ').slice(0, 120));
s = await state();
const car = await G(() => window.__game.debug.game.car.maxSpeed);
check('mission 17 done: chapter five complete, 1,200 shekels, the turbo (38 m/s on the clock = 120 km/h)', s.progress.done.includes('villa') && s.progress.unlocks.includes('chapter-5') && s.progress.unlocks.includes('turbo') && s.progress.money === 4050 && car === 38, `${s.progress.money} / ${car}`);
check('the panel says the fifth chapter is complete (or that chapter six is next)', /הפרק החמישי הושלם|פרק 6 · המשימה הבאה/.test(await text('#objLabel')), await text('#objLabel'));
s = await until((s) => s.night < 0.2, 20, 'day');
check('day comes back', !!s);

// ---------- the radio ----------
await G(() => window.__game.enterCar());
await wait(500);
check('in the car: the radio pill', await page.isVisible('#radio'), await text('#radio'));
await page.tap('#radio');
await wait(300);
check('a tap turns the radio on: hip-hop', /היפ-הופ/.test(await text('#radio')), await text('#radio'));
await page.tap('#radio'); await wait(200); await page.tap('#radio'); await wait(200);
check('the stations: Mizrahi, house', /האוס/.test(await text('#radio')), await text('#radio'));
await page.tap('#radio'); await wait(200);
check('then off', /כבוי/.test(await text('#radio')), await text('#radio'));
await G(() => window.__game.exitCar());
await wait(500);
check('on foot the radio pill goes', !(await page.isVisible('#radio')));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
await writeFile(`${shots}/stage-l.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(passed === results.length ? 0 : 1);
