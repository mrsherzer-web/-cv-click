// Chapter seven acceptance test, played as Erez: the kidnapping scene at the lookout, the team at the
// gym, the quarry's clues and ambush, the depot (cameras, the guard house, the locked office, the
// hidden door), the passage of traps (plates, the door that locks, the clock, the switches, the
// valves), the fort (the way in, the yard, the control room's code, the halls, the tunnel), the last
// fight (Kotzi runs, Ido saves Erez, the keypad), the rescue, the alarm, the escape, MISSION COMPLETE.
// usage: node tests/stage-n.test.mjs [url] [screenshot dir]
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
const markAll = (filter) => G((f) => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) if (!x.marked && (!f || f.includes(x.npc.id))) P.markGuard(x, 'test'); }, filter);
const press = async (label, maxSec = 8) => { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`); if (s) await page.dispatchEvent('#btnInteract', 'pointerdown'); return !!s; };
const tp = (p, dx = 0, dz = 0) => G(({ p, dx, dz }) => window.__game.teleport(p.x + dx, p.z + dz), { p, dx, dz });
const playingAs = () => G(() => window.__game.debug.game.playingAs);

// a game saved at the end of chapter six
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 4950,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves', 'fightnight', 'mainevent', 'ido', 'bank', 'pub', 'villa', 'cipher'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2', 'fightnight', 'chapter-3', 'ido', 'ido-crew', 'paintball', 'chapter-4', 'pub-crew', 'liam', 'kai', 'yahli', 'chapter-5a', 'turbo', 'chapter-5', 'chapter-6', 'cipher-laptop'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('the start screen counts seven chapters and twenty-five missions', /שבעה פרקים · עשרים וחמש משימות/.test(await text('#startScreen')));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places, pt = (q) => q && { x: q.x, z: q.z, yaw: q.yaw, y: q.y }; return {
  plaza: p.plaza, gymInside: pt(p.gymInside),
  quarry: { entrance: pt(p.quarry.entrance), parking: pt(p.quarry.parking), office: { desk: pt(p.quarry.office.desk), map: pt(p.quarry.office.map) }, truck: { keys: pt(p.quarry.truck.keys) }, shed: { radios: pt(p.quarry.shed.radios) } },
  depot: { parking: pt(p.depot.parking), guardHouse: { monitor: pt(p.depot.guardHouse.monitor) }, office: { laptop: pt(p.depot.office.laptop) }, back: pt(p.depot.back) },
  passage: { parking: pt(p.passage.parking), plates: p.passage.plates.map((q) => ({ c: q.c, r: q.r, x: q.x, z: q.z })), platesEnd: pt(p.passage.platesEnd), afterDoor: pt(p.passage.afterDoor), clock: { start: pt(p.passage.clock.start), end: pt(p.passage.clock.end) }, panels: p.passage.panels.map((q) => ({ i: q.i, color: q.color, x: q.x, z: q.z })), afterPuzzle: pt(p.passage.afterPuzzle), valves: p.passage.valves.map((q) => ({ x: q.x, z: q.z })), out: pt(p.passage.out) },
  fort: { generator: { breaker: pt(p.fort.generator.breaker) }, control: { note: pt(p.fort.control.note) }, main: { centre: pt(p.fort.main.centre) }, holding: { door: pt(p.fort.holding.door), keypadAt: pt(p.fort.holding.keypadAt), cell: pt(p.fort.holding.cell) }, gateInside: pt(p.fort.gateInside) },
}; });
check('the quarry, the depot, the passage and the fort are in the world', !!P.quarry?.office?.desk && !!P.depot?.office?.laptop && P.passage?.plates?.length === 15 && !!P.fort?.holding?.cell);

// ---------- mission 19: taken ----------
check('after chapter six the panel points at chapter seven, at the lookout', /פרק 7 · המשימה הבאה/.test(await text('#objLabel')) && /נהוראי נחטף · /.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
const start = await G(() => { const p = window.__game.debug.world.places.plaza; return { x: p.x + p.dx * -3, z: p.z + p.dz * -3 }; });
await tp(start, 3, 3); await tp(start);
let s = await until((s) => s.mission?.id === 'taken', 10, 'the mission');
check('"Nehorai taken" begins at the lookout', !!s && /פרק 7 · משימה 1 מתוך 7/.test(await text('#objLabel')), await text('#objLabel'));
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 120, 'the kidnapping');
check('the kidnapping: the van, "Kotzi sends his regards", Nehorai taken', !!s && heard.some((l) => l.includes('דרישת שלום')), heard.join(' / ').slice(0, 120));
check('now playing as Erez', (await playingAs()) === 'erez');
await snap('n1-gym');
s = await talkThrough((s) => s.mission?.step === 2, 120, 'the team');
check('the team arrives one by one; Erez: nobody gets left behind', !!s && heard.some((l) => l.includes('לא משאירים אף אחד מאחור')) && heard.some((l) => l.includes('מומחה בלהיחטב') || l.includes('להיחטף')), heard.join(' / ').slice(0, 160));
const strip = await G(() => [...document.querySelectorAll('#squadBar .mate')].map((e) => e.textContent));
check('the team strip shows Erez and seven friends', strip.length === 8 && strip[0] === 'ארז', strip.join(','));
await G(() => window.__game.enterCar());
await G((p) => window.__game.placeCar(p.x, p.z, p.yaw), P.quarry.parking);
s = await until((s) => s.mission === null || s.mission.id !== 'taken', 12, 'the quarry');
check('mission 19 done', !!s && (await state()).progress.done.includes('taken'));

// ---------- mission 20: the quarry ----------
s = await until((s) => s.mission?.id === 'quarry', 15, 'the quarry mission');
check('"the quarry" begins (the team forms up)', !!s);
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the arrival');
await tp(P.quarry.office.desk, 0, 0.9); check('the documents', await press('לקרוא את רשימת המשלוחים'));
await talkThrough((s) => !s.dialogue, 30, 'the desk line');
await tp(P.quarry.truck.keys, 0, 1.2); check('the key in the dumper', await press('לקחת את המפתח מהמשאית'));
await talkThrough((s) => !s.dialogue, 30, 'the key line');
await tp(P.quarry.shed.radios, 0, 0.9); check('the radios', await press('להדליק את מכשיר הקשר'));
s = await talkThrough((s) => s.mission?.step === 2, 60, 'Nehorai on the radio and the ambush');
check("Nehorai's voice on the radio, then the ambush", !!s && heard.some((l) => l.includes('אני לא יודע איפה אני')), heard.join(' / ').slice(0, 120));
await snap('n2-quarry');
await markAll(['kg5', 'kg6']);
s = await talkThrough((s) => s.mission?.step === 3, 20, 'the map step');
await tp(P.quarry.office.map, 0.9, 0); check('the map on the wall', await press('להסתכל במפה'));
s = await talkThrough((s) => s.mission?.step === 4, 30, 'the drive');
await G(() => window.__game.enterCar());
await G((p) => window.__game.placeCar(p.x, p.z, p.yaw), P.depot.parking);
s = await until((s) => s.mission?.id === 'depot', 20, 'the depot mission');
check('mission 20 done, "depot 1" begins', !!s && (await state()).progress.done.includes('quarry'));

// ---------- mission 21: the depot ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the plan');
check('the plan at the gate: cameras, the guard house first', heard.some((l) => l.includes('בית השומר')), heard.join(' / ').slice(0, 100));
const cams = await G(() => window.__game.debug.world.places.depot.cameras.map((c) => c.on));
check('two cameras on in the yard', cams.length === 2 && cams.every(Boolean));
await markAll(['kg1', 'kg2']);
await tp(P.depot.guardHouse.monitor, 0, 1.0); check('the monitor: cameras off', await press('לכבות את המצלמות'));
s = await talkThrough((s) => s.mission?.step === 2, 30, 'the yard step');
check('cameras off', (await G(() => window.__game.debug.world.places.depot.cameras.map((c) => c.on))).every((v) => !v));
await markAll(['kg3', 'kg4']);
s = await talkThrough((s) => s.mission?.step === 3, 40, 'the warehouse step');
check("Nehorai on the radio: they moved him, a tunnel", heard.some((l) => l.includes('מנהרה')), heard.join(' / ').slice(0, 100));
await markAll(['kg5', 'kg6', 'kg7', 'kg8']);
s = await talkThrough((s) => s.mission?.step === 4, 40, 'the office step');
check('the hall is clear; Ido goes for the lock', !!s && heard.some((l) => l.includes('נעול זה הקטע שלי')), heard.join(' / ').slice(0, 100));
s = await until(() => G(() => window.__game.debug.world.places.depot.office.door.open), 20, 'Ido opening the office');
check('Ido picks the lock: the office door opens', !!s);
await tp(P.depot.office.laptop, 0, 1.0); check('the laptop', await press('לקרוא במחשב הנייד'));
s = await talkThrough((s) => s.mission?.step === 5, 40, 'the hidden door step');
check('the laptop names the fort and the tunnel; Ido notices the shelf', heard.some((l) => l.includes('המצודה')) && heard.some((l) => l.includes('המדף')), heard.join(' / ').slice(0, 120));
s = await until(() => G(() => window.__game.debug.world.places.depot.hidden.door.open), 20, 'the hidden door');
check('the door behind the shelves opens', !!s);
await snap('n3-depot');
await tp(P.depot.back);
s = await talkThrough((s) => s.mission?.step === 6, 20, 'out the back');
await G(() => window.__game.enterCar());
await G((p) => window.__game.placeCar(p.x, p.z, p.yaw), P.passage.parking);
s = await until((s) => s.mission?.id === 'passage', 20, 'the passage mission');
check('mission 21 done, "Kotzi\'s traps" begins', !!s && (await state()).progress.done.includes('depot'));

// ---------- mission 22: the traps ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the shed');
check('the plates: Ido says only the left column is safe', (await talkThrough(() => heard.some((l) => l.includes('הטור השמאלי')), 20, 'the plates line')) !== null, heard.join(' / ').slice(0, 100));
// a wrong plate: the alarm and two guards behind
const bad = P.passage.plates.find((p) => p.c === 1);
await tp(bad);
s = await until(() => G(() => window.__game.debug.game.missions.active?.s?.trips >= 1), 6, 'the alarm');
check('a wrong plate: alarm, two guards behind', !!s && (await G(() => window.__game.debug.game.paint.guards.length)) >= 2);
await markAll(['kg1', 'kg2']);
await tp(P.passage.platesEnd);
s = await until((s) => s.mission?.step === 2, 10, 'past the plates');
check('through the plates (left column)', !!s);
await tp(P.passage.afterDoor);
s = await until(() => G(() => window.__game.debug.world.places.passage.trapDoor.locked), 8, 'the door locking');
check('the door shuts and locks behind Erez; the team is cut off', !!s);
s = await until(() => G(() => window.__game.debug.world.places.passage.sideIn.open), 30, 'Ido opening the side door');
check('Ido opens the side door', !!s);
s = await until((s) => s.mission?.step === 3, 60, 'the team coming through');
check('the team comes through the side room', !!s);
await snap('n4-passage');
await tp(P.passage.clock.start, 0, 1);
s = await until(() => G(() => window.__game.debug.game.missions.active?.s?.clockAt != null), 8, 'the clock');
check('the clock room: the countdown starts (a pill)', !!s && /התריס/.test(await text('#pursuit')), await text('#pursuit'));
await tp(P.passage.clock.end);
s = await until((s) => s.mission?.step === 4, 10, 'past the shutter');
check('through before the shutter', !!s);
const pans = P.passage.panels;
await tp(pans[0], 0, 1.0); check('the red button first: wrong, resets', await press('ללחוץ על הכפתור האדום'));
await wait(500);
for (const i of [1, 2, 0]) { await tp(pans[i], 0, 1.0); await press(`ללחוץ על הכפתור ה${pans[i].color}`); await wait(300); }
s = await until(() => G(() => window.__game.debug.world.places.passage.puzzleDoor.open), 8, 'the puzzle door');
check('green, blue, red: the door opens', !!s);
await tp(P.passage.afterPuzzle);
s = await until((s) => s.mission?.step === 5, 10, 'the valves step');
s = await until(() => G(() => window.__game.debug.game.missions.active?.s?.yonatiThere), 40, 'Yonati at the far valve');
check('Yonati reaches the far valve', !!s);
await tp(P.passage.valves[0], 0, 1.0); check('the valves, together', await press('לסובב יחד: שלוש, שתיים, אחת'));
await tp(P.passage.out);
s = await talkThrough((s) => s.mission?.id === 'fort', 60, 'the fort mission');
check('mission 22 done, "the fort" begins', !!s && (await state()).progress.done.includes('passage'));

// ---------- mission 23: the fort ----------
await markNow();
s = await talkThrough(async () => page.isVisible('#choice'), 40, 'the choice');
check('the way in: a choice', !!s && /איך נכנסים/.test(await text('#choiceTitle')));
await page.tap('#choiceOptions button[data-id="quiet"]');
s = await talkThrough((s) => s.mission?.step === 1, 40, 'the yard');
check('quiet way: in through the hatch; the yard with seven guards', !!s && (await G(() => window.__game.debug.game.paint.guards.length)) >= 13);
await tp(P.fort.generator.breaker, 1.0, 0); check('the generator: cut the cameras', await press('לנתק את החשמל למצלמות'));
await markAll(['guard1', 'guard2', 'guard3', 'guard4', 'vg1', 'vg2', 'vg3']);
s = await talkThrough((s) => s.mission?.step === 2, 40, 'the control room step');
await snap('n5-fort');
await markAll(['vg4', 'vg5']);
await tp(P.fort.control.note, 0, -1.0);
check('the note with the code', await press('לקרוא את הפתק'));
s = await talkThrough((s) => s.mission?.step === 3, 40, 'the halls step');
check('the code is 4-7-1-9', heard.some((l) => l.includes('4-7-1-9')), heard.join(' / ').slice(0, 100));
await tp(P.fort.main.centre);
await markAll(['vg6', 'vg7', 'vg8']);
s = await until(() => G(() => window.__game.debug.world.places.fort.main.eastDoor.open), 40, 'Ido opening the hall doors');
check('Ido opens the doors between the halls', !!s);
s = await talkThrough((s) => s.mission?.step === 4, 40, 'the tunnel step');
await markAll(['vg9']);
await tp(P.fort.holding.door);
s = await talkThrough((s) => s.mission?.id === 'kotzi', 40, 'the last fight');
check('mission 23 done, "the last fight" begins', !!s && (await state()).progress.done.includes('fort'));

// ---------- mission 24: Kotzi ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the door talk');
check('Kotzi from inside: "you brought everyone? so did I"', heard.some((l) => l.includes('גם אני')), heard.join(' / ').slice(0, 100));
await markAll(['shpitz', 'roller', 'tosti']);
s = await until(() => G(() => window.__game.debug.game.missions.active?.s?.kotziRan), 10, 'Kotzi running');
check('half his crew out: Kotzi runs into the cell', !!s);
// pinned: two marks on Erez
await G(() => { const g = window.__game.debug.game; g.paint.hits = 2; });
s = await until(() => G(() => window.__game.debug.game.missions.active?.s?.saved), 8, 'Ido saving Erez');
check('two marks on Erez: Ido saves him (a mark erased)', !!s && (await G(() => window.__game.debug.game.paint.hits)) === 1);
await snap('n6-saved');
await markAll(['bulldozer', 'kg1', 'kg2']);
s = await talkThrough((s) => s.mission?.step === 2, 40, 'the keypad step');
await tp(P.fort.holding.keypadAt);
check('the keypad', await press('להקיש את הקוד'));
await G(() => window.__game.debug.game.keypad.enter('1111'));
await wait(900);
check('a wrong code is refused', !(await G(() => window.__game.debug.world.places.fort.holding.cellDoor.open)));
await G(() => window.__game.debug.game.keypad.enter('4719'));
s = await until(() => G(() => window.__game.debug.world.places.fort.holding.cellDoor.open), 8, 'the cell door');
check('4719 opens the cell', !!s);
s = await until((s) => s.mission?.step === 3, 8, 'Kotzi cornered');
await markAll(['kotzi']);
s = await talkThrough((s) => s.mission?.id === 'rescue', 60, 'the rescue mission');
check('Kotzi marked ("it was business", "one sandwich in three days"); mission 24 done', !!s && heard.some((l) => l.includes('כריך')), heard.join(' / ').slice(0, 120));

// ---------- mission 25: the rescue ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 90, 'the reunion');
check('"I knew you wouldn\'t leave me here!"; Ido: a hand; everyone', heard.some((l) => l.includes('ידעתי שלא תשאירו אותי פה')) && heard.some((l) => l.includes('יד.')), heard.join(' / ').slice(0, 140));
await snap('n7-reunion');
check('the alarm: a clock on the pill', /אזעקה/.test(await text('#pursuit')), await text('#pursuit'));
await tp(P.fort.gateInside);
s = await until(() => G(() => window.__game.debug.world.places.fort.gate.open), 30, 'Ido opening the gate');
check('Ido opens the north gate', !!s);
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); g.teleport(p.x + 2, p.z); }, P.passage.parking);
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.step === 2, 10, 'the escape');
check('in the Renault before the time runs out', !!s);
s = await until(() => G(() => !!window.__game.debug.game.chase), 14, "Kotzi's vans");
check("Kotzi's vans come after the Renault (after a moment)", !!s);
await markNow();
await G((p) => window.__game.placeCar(p.x + p.dx * -4, p.z + p.dz * -4, 0), P.plaza);
s = await until((s) => s.mission?.step === 3, 12, 'the lookout');
check('at the lookout: the ending', !!s);
await wait(1500);
await snap('n8-ending');
s = await talkThrough((s) => s.mission === null, 120, 'the end');
check('Nehorai thanks them; Erez: "we don\'t leave friends behind"', heard.some((l) => l.includes('לא משאירים חברים מאחור')), heard.join(' / ').slice(0, 140));
s = await state();
check('chapter seven complete: 25 missions done, the chapter unlocked', s.progress.done.includes('rescue') && s.progress.unlocks.includes('chapter-7'), `${s.progress.done.length}`);
check('back to playing Nehorai', (await playingAs()) === 'nehorai');
check('the panel says the seventh chapter is complete', /הפרק השביעי הושלם/.test(await text('#objLabel')), await text('#objLabel'));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
await writeFile(`${shots}/stage-n.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(passed === results.length ? 0 : 1);
