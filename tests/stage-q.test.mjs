// Chapter nine acceptance test, part one (missions 34–36), played as Nehorai: the night it all began (a save
// at the end of chapter eight, the sofas, the lines, the lights out, the Shadow on the TV and the video of the
// compound; the fuse box, the gear from the rack, Ido and Erez, into the Renault while the gang gets into the
// other two cars), the death road (real driving with Erez and Ido in the Renault and the gang behind in two
// cars; the lorry head-on — driven into once for a fail and a retry, dodged the second time — with its three
// lines, the barriers' gap, rivals and the Order's cars behind, the blasts, the fork and the dirt track over the
// ditch, the radio between the cars, the gate of the port), and the Black Port at night in the rain (out of the
// car, Ido at the gate, the search light that raises the alarm, a guard marked with real paint, the five goals
// in order with their prompts, a charge that warns, the chase after the card, three marks and a retry, a reload
// picked up at the checkpoint, the friends gathered at the entrance, the elevator, the Shadow on the speakers,
// the gas, the black screen) — and mission 37 beginning under it.
// usage: node tests/stage-q.test.mjs [url] [screenshot dir] [34|35|36: begin at that mission, from a save just before it]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
const FROM = Number(process.argv[4]) || 34;
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
const listen = async () => { const { h, said } = await page.evaluate(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said })); heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark)))); };
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const text = (sel) => page.textContent(sel);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });
const markAll = (filter) => G((f) => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) if (!x.marked && x.npc.visible && (!f || f.includes(x.npc.id))) P.markGuard(x, 'test'); }, filter);
const press = async (label, maxSec = 10) => { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`); if (s) await page.dispatchEvent('#btnInteract', 'pointerdown'); return !!s; };
const tp = (p, dx = 0, dz = 0) => G(({ p, dx, dz }) => window.__game.teleport(p.x + dx, p.z + dz, p.y), { p, dx, dz });
const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))) } : null; });
const said = (needle) => heard.some((l) => l.includes(needle));
const healthy = () => G(() => window.__game.debug.game.car.repair());
const objective = () => text('#objText');
const settle = () => G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });

// a game saved at the end of chapter eight
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G((from) => { const p = window.__game.debug.game.progressForChapter(9), before = ['phoenix', 'deathroad'].slice(0, from - 34); p.done.push(...before); p.unlocks.push(...before); p.savedAt = Date.now(); localStorage.setItem('nehorai-game:save:v1', JSON.stringify(p)); }, FROM);
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await markNow();
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
await settle();
const P = await G(() => {
  const p = window.__game.debug.world.places, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw }, h = p.safehouse, o = p.port;
  return {
    house: { y: h.y, breaker: pt(h.breaker.at), gear: { x: h.gear.x, z: h.gear.z, y: h.gear.y }, car: pt(h.car) },
    road: { end: pt(p.deathRoad.end), ditchS: p.deathRoad.ditch.s, gate: pt(p.deathRoad.gate) },
    port: { y: o.y, gateOutside: pt(o.gateOutside), foot: pt(o.tower.foot), alarmAt: pt(o.alarmAt), side: pt(o.warehouses[0].side), desk: pt(o.cardOffice.desk), back: pt(o.passage.back), out: pt(o.passage.out), entrance: pt(o.entrance), inside: pt(o.elevator.inside), approach: { ...o.toWorld(-88, 60), y: o.y } },
  };
});

let s = null;
if (FROM <= 34) {
// ---------- mission 34: the night it all began ----------
s = await until((s) => s.mission?.id === 'phoenix', 10, 'the first mission');
check('after chapter eight the save opens chapter nine with "הלילה שבו הכול התחיל"', !!s && /פרק 9 · משימה 1 מתוך 13/.test(await text('#objective')), (await text('#objective')).slice(0, 80));
let tv = { dark: false, shadow: false, video: false };
s = await talkThrough(async (s) => {
  const r = await G(() => { const h = window.__game.debug.world.places.safehouse; return { lights: h.lightsOn, mode: h.screen.mode }; });
  if (!r.lights) tv.dark = true;
  if (r.mode === 'shadow' && !tv.shadow) { tv.shadow = true; await snap('q1-shadow'); }
  if (r.mode === 'video') tv.video = true;
  return s.mission?.step === 1;
}, 150, 'the opening');
check('on the sofas: "סוף סוף קצת שקט." / Ido laughs: "אחי, אצלך שקט מחזיק שלוש דקות."', said('נהוראי: סוף סוף קצת שקט.') && said('עידו: אחי, אצלך שקט מחזיק שלוש דקות.'), heard.slice(0, 3).join(' / '));
check('the lights go out; on the TV the Shadow of the Black Order: "נהוראי פרחי. אתה ניצחת את קוצי, אבל קוצי היה רק ההתחלה."', tv.dark && tv.shadow && said('הצל: נהוראי פרחי. אתה ניצחת את קוצי, אבל קוצי היה רק ההתחלה.'));
check('the video of the huge compound, then Erez: "זה ברור שזו מלכודת." / Nehorai: "אז בואו נראה מה הוא הכין לנו."', tv.video && said('ארז: זה ברור שזו מלכודת.') && said('נהוראי: אז בואו נראה מה הוא הכין לנו.'));
check('control back to Nehorai, on foot, the house dark: the fuse box', !!s && s.mode === 'foot' && !s.cutscene && /להחזיר את החשמל/.test(await objective()), await objective());
await tp(P.house.breaker);
check('"להרים את המפסקים" at the fuse box: the lights come back', (await press('להרים את המפסקים')) && !!(await until(() => G(() => window.__game.debug.world.places.safehouse.lightsOn), 5, 'the lights')));
s = await until((s) => s.mission?.step === 2, 10, 'the gear');
check('the gear: "לקחת את הציוד"', !!s && /לקחת את הציוד/.test(await objective()), await objective());
await tp(P.house.gear);
check('"לקחת את הציוד" at the rack: every one of them his own marker', (await press('לקחת את הציוד')) && !!(await until((s) => s.paint?.allies?.length === 8, 5, 'the markers')));
await snap('q2-gear');
s = await until((s) => s.mission?.step === 3, 10, 'Ido and Erez');
check('then: "לדבר עם עידו ועם ארז"', !!s && /לדבר עם עידו/.test(await objective()), await objective());
for (const [id, label, line] of [['ido', 'לדבר עם עידו', 'השידור הגיע מבחוץ'], ['erez', 'לדבר עם ארז', 'אף אחד לא נשאר מאחור']]) {
  await until(() => G((id) => { const n = window.__game.debug.game.npc(id); return !n.target; }, id), 20, `${id} at his place`);
  await G((id) => { const g = window.__game, n = g.debug.game.npc(id); g.teleport(n.pos.x - 1.1, n.pos.z + 0.3, n.pos.y); }, id);
  await markNow();
  const ok = await press(label);
  s = await talkThrough(async () => !(await M())?.s.talking && said(line), 40, label);
  check(`"${label}": ${line}`, ok && !!s);
}
s = await until((s) => s.mission?.step === 4, 10, 'the cars');
check('"לרנו · כולם לרכבים": the gang walks out to the yard and into the cars', !!s && /לרנו/.test(await objective()), await objective());
await G(() => { const g = window.__game.debug.game, q = g.car.local(-1.8, 0.25); window.__game.teleport(q.x, q.z, g.car.pos.y); });
check('"להיכנס לרכב" at the Renault', await press('להיכנס לרכב'));
s = await until((s) => s.mission?.id === 'deathroad', 30, 'the second mission');
check('everyone in the three cars (Erez and Ido in the Renault): mission 34 done, "מרדף בכביש המוות" begins', !!s && (await G(() => { const g = window.__game.debug.game; return g.progress.done.includes('phoenix') && g.npc('ido').inCar === g.car && g.npc('erez').inCar === g.car && ['yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'].every((id) => g.npc(id).inCar && g.npc(id).inCar !== g.car); })));

}

if (FROM <= 35) {
// ---------- mission 35: the death road ----------
// the way out of the yard: through the gap in the barriers at s 105, then `lane` (the lorry's lane, +2.4, or
// the free one, -2.4) up the straight, then the rest along `route`
const roadPts = (lane, route) => G(({ lane, route }) => {
  const D = window.__game.debug.world.places.deathRoad, R = D.roads.main;
  const run = (s0, s1, o) => { const out = []; for (let s = s0; s <= s1; s += 3) { const p = R.at(s); out.push({ x: p.x + p.nx * o, z: p.z + p.nz * o }); } return out; };
  const q = R.at(345);
  return [...run(8, 92, 2.4), ...run(96, 114, 0), ...run(120, route ? 330 : 300, lane), ...(route ? D.pathFrom(route, q.x + q.nx * 2.4, q.z + q.nz * 2.4) : [])];
}, { lane, route });
const drive = (pts, cruise = 17) => G(({ pts, cruise }) => window.__game.drivePath([['points', pts]], cruise), { pts, cruise });
await markNow();
s = await until((s) => s.mode === 'car' && /כביש המוות/.test(s.mission?.objective || ''), 10, 'the drive');
check('Nehorai drives; the convoy: the two other cars behind the Renault', !!s && (await G(() => window.__game.debug.game.missions.active.convoy?.cars.length === 2)));
// first: straight on in the lane, into the lorry
await drive(await roadPts(2.4, null), 15);
s = await talkThrough(async () => said('אז למה אתה נוסע ישר אליה?!') || (await page.isVisible('#failMenu')), 120, 'the lorry');
check('the lorry head-on in their lane: "נהוראי, אתה רואה את המשאית הזאת?!" / "ברור שאני רואה!" / "אז למה אתה נוסע ישר אליה?!"', said('עידו: נהוראי, אתה רואה את המשאית הזאת?!') && said('נהוראי: ברור שאני רואה!') && said('עידו: אז למה אתה נוסע ישר אליה?!'), heard.slice(-5).join(' / '));
await snap('q3-lorry');
s = await until(async () => page.isVisible('#failMenu'), 60, 'the crash');
check('driven straight into the lorry: the fail screen with a tip', !!s && /המשאית/.test(await text('#failReason')), await text('#failReason'));
await G(() => { window.__game.stopDriving(); });
await page.tap('#retryBtn');
s = await until((s) => s.mission?.id === 'deathroad' && s.mission?.step === 0 && !s.hold && s.mode === 'car', 10, 'the retry');
check('retry: back in the safe house\'s yard in the Renault, the car whole, the gang in the cars', !!s && s.car.health > 90 && Math.hypot(s.car.x - P.house.car.x, s.car.z - P.house.car.z) < 6 && (await G(() => window.__game.debug.game.npc('ido').inCar === window.__game.debug.game.car)), `health ${s?.car.health}`);
// now the free lane for the lorry, and the dirt track at the fork
await markNow();
const booms0 = await G(() => window.__game.debug.game.fx.booms);
await drive(await roadPts(-2.4, 'dirt'), 17);
let rivals = 0, chased = false;
s = await talkThrough(async (s) => {
  await healthy();
  const r = await G(() => { const m = window.__game.debug.game.missions.active; return m?.def.id === 'deathroad' ? { rivals: Object.keys(m.rivals || {}).length, chase: !!m.pursuit?.chase } : null; });
  if (r) { rivals = Math.max(rivals, r.rivals); chased ||= r.chase; }
  return (await M())?.s.dodged && said('עברנו בסנטימטרים');
}, 120, 'the dodge');
check('in the free lane: Nehorai slips past the lorry ("וואו. עברנו בסנטימטרים.")', !!s && !(await M())?.s.crash, `dodged ${(await M())?.s.dodged}`);
check('through the gap in the barriers (the roadblock at the start of the straight)', (await G(() => window.__game.debug.world.places.deathRoad.roadblocks[0].kind)) === 'barriers' && !(await page.isVisible('#failMenu')));
s = await talkThrough(async (s) => { await healthy(); const r = await G(() => { const m = window.__game.debug.game.missions.active; return m?.def.id === 'deathroad' ? { rivals: Object.keys(m.rivals || {}).length, chase: !!m.pursuit?.chase } : null; }); if (r) { rivals = Math.max(rivals, r.rivals); chased ||= r.chase; } return s.mission?.step >= 1; }, 120, 'the fork');
check('the fork: "שלוש דרכים לנמל" — three ways', !!s && said('שלוש דרכים לנמל'), await objective());
s = await talkThrough(async (s) => { await healthy(); const r = await G(() => { const m = window.__game.debug.game.missions.active; return m?.def.id === 'deathroad' ? { rivals: Object.keys(m.rivals || {}).length, chase: !!m.pursuit?.chase } : null; }); if (r) { rivals = Math.max(rivals, r.rivals); chased ||= r.chase; } return s.mission?.step >= 2; }, 60, 'the dirt track');
check('the dirt track taken (the right-hand way)', !!s && (await M())?.s.route === 'dirt', (await M())?.s.route);
s = await talkThrough(async (s) => { await healthy(); const r = await G(() => { const m = window.__game.debug.game.missions.active; return m?.def.id === 'deathroad' ? { rivals: Object.keys(m.rivals || {}).length, chase: !!m.pursuit?.chase } : null; }); if (r) { rivals = Math.max(rivals, r.rivals); chased ||= r.chase; } return ((await M())?.s.jumps || 0) > 0; }, 120, 'the jump');
check('over the ditch off the ramp: a jump', !!s, `jumps ${(await M())?.s.jumps}`);
await snap('q4-jump');
s = await talkThrough(async (s) => { await healthy(); const r = await G(() => { const m = window.__game.debug.game.missions.active; return m?.def.id === 'deathroad' ? { rivals: Object.keys(m.rivals || {}).length, chase: !!m.pursuit?.chase } : null; }); if (r) { rivals = Math.max(rivals, r.rivals); chased ||= r.chase; } return s.mission?.id === 'blackport'; }, 300, 'the port');
check('cars of the Order cut in from the side roads and chase them', rivals > 0 && chased, `rivals ${rivals} · chase ${chased}`);
check('blasts by the road (they warn first) and charges on it', (await G(() => window.__game.debug.game.fx.booms)) > booms0 + 2, `booms ${(await G(() => window.__game.debug.game.fx.booms)) - booms0}`);
check('the friends on the radio between the cars', said('רכב שתיים פה') && said('רכב שלוש פה'));
check('at the port\'s gate: the chasers stop ("הם לא רודפים אחרינו לנמל"); mission 35 done, "הנמל השחור" begins', !!s && said('הם לא רודפים אחרינו לנמל.') && (await G(() => window.__game.debug.game.progress.done.includes('deathroad'))));
await G(() => window.__game.stopDriving());

}

// ---------- mission 36: the Black Port ----------
await markNow();
s = await until(async (s) => s.mission?.id === 'blackport' && (await G(() => window.__game.debug.game.fx.raining)), 10, 'the rain');
check('night and rain at the port; still in the Renault: "לצאת מהרנו"', !!s && s.night > 0.5 && /לצאת מהרנו/.test(await objective()), await objective());
await snap('q5-port');
await until((s) => Math.abs(s.car.speed) < 0.5, 10, 'the Renault stopped');
await page.dispatchEvent('#btnExit', 'pointerdown');
s = await until((s) => s.mode === 'foot' && s.mission?.step === 1, 10, 'out of the car');
check('out of the Renault: everyone out of the cars; "1. להגיע למגדל הבקרה"', !!s && /1\. להגיע למגדל הבקרה/.test(await objective()) && (await G(() => window.__game.debug.game.npcs.get('liam')?.inCar == null)), await objective());
s = await talkThrough(async () => G(() => window.__game.debug.world.places.port.gate.open), 60, 'the gate');
check('Ido opens the locked gate; the plan: three go in, the six wait by the wall, five goals', !!s && said('חמישה דברים, לפי הסדר') && said('נכנסים שלושה'));
// the search light: stand in its circle and the alarm goes
await G(() => { window.__game.debug.game.paint.hits = 0; });
s = await until(async () => { await G(() => { const g = window.__game.debug.game, o = window.__game.debug.world.places.port, t = o.searchLights[0].target; g.player.place(t.x, t.z, 0, o.y); g.paint.hits = 0; }); return (await M())?.s.alarm; }, 10, 'the alarm');
check('caught in the search light\'s circle: the alarm, the siren, two of the Order hunting him', !!s && (await G(() => ['og11', 'og12'].every((id) => window.__game.debug.game.npc(id).visible))) && (await G(() => window.__game.debug.game.fx.redAlertOn)));
await snap('q6-alarm');
// one of them marked with real paint: Nehorai close, facing him, pulling the trigger
const shoot = (id) => G(async (id) => {
  const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => x.npc.id === id);
  const n = gd.npc; g.player.place(n.pos.x - 6, n.pos.z, Math.PI / 2, n.pos.y); g.player.yaw = Math.PI / 2;
  for (let k = 0; k < 16 && !gd.marked; k++) { P.lock = gd; P.fire(); await new Promise((r) => setTimeout(r, 120)); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } g.paint.hits = 0; }
  return gd.marked;
}, id);
check('a guard of the Order marked with real paint (aim, fire)', await shoot('og11'));
await markAll(); await G(() => { window.__game.debug.game.paint.hits = 0; });
await tp(P.port.foot, 0.5, 1.6);
s = await until((s) => s.mission?.step === 2, 10, 'the tower');
check('at the foot of the control tower: "2. להשבית את האזעקה"', !!s && /2\. להשבית את האזעקה/.test(await objective()), await objective());
await markAll(['og5']);
await tp(P.port.alarmAt);
check('"להשבית את האזעקה" at the panel at the top of the tower', await press('להשבית את האזעקה'));
s = await until((s) => s.mission?.step === 3, 15, 'the panel');
check('the alarm off (the siren, the red light and the tower\'s search light with it); "3. להשיג כרטיס גישה"', !!s && /3\. להשיג כרטיס גישה/.test(await objective()) && (await G(() => { const o = window.__game.debug.world.places.port; return !o.alarm.on && !o.searchLights[0].on && !window.__game.debug.game.fx.redAlertOn; })), await objective());
// toward warehouse 3: a charge with a red ring, then the blast
await markAll();
await tp(P.port.foot, 0.5, 1.6); await wait(300);
const booms1 = await G(() => window.__game.debug.game.fx.booms);
await tp(P.port.approach);
s = await talkThrough(async () => (await G(() => window.__game.debug.game.fx.booms)) > booms1, 15, 'the charge');
check('a charge on the way to the warehouse: "עיגול אדום! מטען — אחורה!", then the blast', !!s && said('עיגול אדום! מטען'));
await G(() => { window.__game.debug.game.paint.hits = 0; });
await tp(P.port.desk);
check('"לקחת את כרטיס הגישה" on the office desk', await press('לקחת את כרטיס הגישה'));
s = await talkThrough((s) => s.mission?.step === 4, 20, 'the passage');
check('the card taken; two of them run in after it: "מישהו במשרד!"; "4. לפתוח את המעבר למתקן התת-קרקעי"', !!s && said('מישהו במשרד!') && /4\. לפתוח את המעבר/.test(await objective()) && (await G(() => ['og13', 'og14'].every((id) => { const g = window.__game.debug.game.paint.guards.find((x) => x.npc.id === id); return g && g.alerted; }))), await objective());
// three marks: out, and a retry from the checkpoint
await G(() => { window.__game.debug.game.paint.hits = 3; });
s = await until(async () => page.isVisible('#failMenu'), 8, 'the fail screen');
check('three marks: the fail screen, with a tip', !!s && /סומן שלוש פעמים/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 4 && !s.hold && s.paint?.hits === 0, 10, 'the retry');
check('retry: back in the office with the card, marks cleared, the two after him again', !!s && (await G(() => window.__game.debug.world.places.port.card.taken)) && (await G(() => ['og13', 'og14'].every((id) => window.__game.debug.game.npc(id).visible))));
// a reload: "continue" picks it up at this checkpoint
await G(() => window.__game.debug.game.save());
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
check('a reload: the start screen offers to continue in the middle of "הנמל השחור"', /באמצע הנמל השחור/.test(await text('#startScreen')));
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
await settle();
s = await until((s) => s.mission?.id === 'blackport' && s.mission?.step === 4, 10, 'the checkpoint');
check('"continue": back at the passage goal, in the rain, the card in hand, the gang armed', !!s && /ממשיכים מנקודת השמירה/.test(await G(() => window.__game.debug.game.hud.el.toast.textContent)) && (await G(() => window.__game.debug.game.fx.raining)) && s.paint?.allies?.length === 8);
await markAll(); await G(() => { window.__game.debug.game.paint.hits = 0; });
await markNow();
await tp(P.port.back);
check('"להעביר את כרטיס הגישה" at the reader on the blue container\'s false back', await press('להעביר את כרטיס הגישה'));
s = await talkThrough((s) => s.mission?.step === 5, 20, 'the friends');
check('the back opens: "ירוק! הגב נפתח!"; a siren in the corner; "5. לאסוף את החברים בכניסה"', !!s && said('ירוק! הגב נפתח!') && /5\. לאסוף את החברים בכניסה/.test(await objective()) && (await G(() => window.__game.debug.world.places.port.passage.door.open)), await objective());
await tp(P.port.entrance);
s = await talkThrough(async () => { await G(() => { window.__game.debug.game.paint.hits = 0; }); return G(() => ['og15', 'og16'].every((id) => window.__game.debug.game.npc(id).visible)); }, 60, 'the raid');
check('the friends run the length of the quay; two of the Order after them: "שניים מהרציף המזרחי!"', !!s && said('שניים מהרציף המזרחי!') && said('אחים, רצים!'));
await markAll(['og15', 'og16']);
s = await talkThrough(async (s) => { await G(() => { window.__game.debug.game.paint.hits = 0; }); return s.mission?.step === 6; }, 120, 'all at the entrance');
check('all eight at the entrance with Nehorai: "כולם פה. תשעה."; then "למעלית"', !!s && said('כולם פה. תשעה.') && /למעלית/.test(await objective()), await objective());
await tp(P.port.inside);
s = await talkThrough(async () => (await M())?.s.inCage, 60, 'everyone in the cage');
check('everyone into the elevator (the friends walk in to their places); the door shuts and locks', !!s && (await G(() => window.__game.debug.world.places.port.elevator.door.locked)));
s = await talkThrough(async () => said('ברוכים הבאים לשלב הבא.'), 60, 'the Shadow');
check('it goes down, stops, the doors locked: the Shadow on the speakers: "ברוכים הבאים לשלב הבא."', !!s && said('הצל: ברוכים הבאים לשלב הבא.') && said('למה עצרנו?!') && said('נעולות'));
await snap('q7-speakers');
s = await talkThrough(async () => (await G(() => window.__game.debug.game.overlay?.state?.daze)) > 0.3, 30, 'the gas');
check('the sleeping gas fills the cage (the hiss, the mist, the blur)', !!s && said('גז! תכסו את הפה!'));
await snap('q8-gas');
s = await talkThrough(async (s) => s.mission?.id === 'stolen', 60, 'the next mission');
check('the screen goes black; mission 36 done and mission 37 begins under the black screen', !!s && (await G(() => { const g = window.__game.debug.game; return g.progress.done.includes('blackport') && g.overlay.state.eyes > 0.9; })));
await snap('q9-black');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
