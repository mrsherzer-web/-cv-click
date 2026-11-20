// Chapter eight acceptance test, part one (missions 1–4), played as Nehorai: the opening at the hideout,
// the escape through the burning hall (the beams, the mezzanine, the rubble, a blast that warns, the
// office door and the first-aid kit, the wheel), the big chase (blasts by the road, helicopters, the fork,
// the tunnel and the rubble; a wreck and a retry), the Iron Base (the gate, the yard, the ground floor,
// the lockdown: a shutter that shuts in front of you and a retry, then the control room in time), the
// betrayal (Kotzi on the screens, the blackout, the note, Erez and the shelf, breaker B, the keypad, the
// levers in the wrong order and then the right one, the generator, everyone together).
// usage: node tests/stage-o.test.mjs [url] [screenshot dir]
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
// (a line that starts in the very frame the awaited thing happens is heard too: one more listen after it)
const talkThrough = async (done, maxSec, what) => { const r = await until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what); if (r) { await wait(250); await listen(); } return r; };
const text = (sel) => page.textContent(sel);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });
const markAll = (filter) => G((f) => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) if (!x.marked && (!f || f.includes(x.npc.id))) P.markGuard(x, 'test'); }, filter);
const press = async (label, maxSec = 10) => { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`); if (s) await page.dispatchEvent('#btnInteract', 'pointerdown'); return !!s; };
const tp = (p, dx = 0, dz = 0) => G(({ p, dx, dz }) => window.__game.teleport(p.x + dx, p.z + dz, p.y), { p, dx, dz });
const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))) } : null; });
const said = (needle) => heard.some((l) => l.includes(needle));
const healthy = () => G(() => { const g = window.__game.debug.game; g.car.repair(); });

// a game saved at the end of chapter seven
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => { const p = window.__game.debug.game.progressForChapter(8); p.savedAt = Date.now(); localStorage.setItem('nehorai-game:save:v1', JSON.stringify(p)); });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
check('the start screen counts ten chapters and fifty-nine missions', /עשרה פרקים · חמישים ותשע משימות/.test(await text('#startScreen')));
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
const P = await G(() => {
  const p = window.__game.debug.world.places, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw };
  return {
    plaza: p.plaza,
    hide: { table: pt(p.hideout.table), y: p.hideout.y, x: p.hideout.x, z: p.hideout.z, exitAt: pt(p.hideout.exitAt), wheel: pt(p.hideout.wheel), outside: pt(p.hideout.outside), car: pt(p.hideout.car), mezzMid: pt(p.hideout.mezz.mid), mezzWest: pt(p.hideout.mezz.west), rubbleTop: pt(p.hideout.rubble.top), stairsWb: pt(p.hideout.stairsW.bottom), officeDoor: pt(p.hideout.officeDoor.pos), kit: pt(p.hideout.kit) },
    road: { forkS: p.ironRoad.fork.s, tout: p.ironRoad.tunnel.out, branchLen: p.ironRoad.branch.length, end: pt(p.ironRoad.end) },
    base: { gateOutside: pt(p.ironBase.gateOutside), lobby: pt(p.ironBase.main.lobby), corridor: pt(p.ironBase.main.corridor), s1top: pt(p.ironBase.main.s1.top), f1: pt(p.ironBase.main.f1), stairwell: pt(p.ironBase.main.stairwell), s2top: pt(p.ironBase.main.s2.top), control: pt(p.ironBase.control.inside), note: pt(p.ironBase.control.desk), hiddenOut: pt(p.ironBase.hidden.out), s3top: pt(p.ironBase.main.s3.top), breakerB: { ...pt(p.ironBase.main.breakerB) }, keypad: pt(p.ironBase.generator.keypadAt), levers: p.ironBase.generator.levers.map((l) => ({ x: l.x, z: l.z, y: p.ironBase.y, i: l.i })), machine: pt(p.ironBase.generator.machine), lockOut: pt(p.ironBase.lockRoom.outside), y: p.ironBase.y, F1: p.ironBase.F1, F2: p.ironBase.F2 },
  };
});

// ---------- mission 26: the quiet before the storm ----------
check('after chapter seven the next mission is chapter eight\'s first', (await G(() => window.__game.debug.game.missions.next()?.id)) === 'firestorm');
await markNow();
await G((p) => window.__game.teleport(p.x + p.dx * 3, p.z + p.dz * 3), P.plaza);
let s = await until((s) => s.mission?.id === 'firestorm', 10, 'the first mission');
check('"השקט שלפני הסערה" begins at the lookout', !!s && /פרק 8 · משימה 1 מתוך 8/.test(await text('#objective')), (await text('#objective')).slice(0, 80));
const booms0 = await G(() => window.__game.debug.game.fx.booms);
s = await talkThrough((s) => s.mission?.step === 1, 120, 'the opening');
check('the table: "קוצי עוד ישלם" and "הרגע הוצאנו אותך משם"', said('אני נשבע לכם, קוצי עוד ישלם על מה שהוא עשה.') && said('אחי, קודם תירגע. הרגע הוצאנו אותך משם.'), heard.slice(0, 3).join(' / ').slice(0, 120));
check('Ido: "נהוראי! תתכופף!" and the blast at the main door', said('נהוראי! תתכופף!') && (await G(() => window.__game.debug.game.fx.booms)) > booms0);
check('control comes back to Nehorai, on foot, with the whole gang', !!s && s.mode === 'foot' && !s.cutscene && (await G(() => window.__game.debug.game.squad.ids.length)) === 8);
check('the fire clock on the pill', /הלהבות/.test(await text('#pursuit')), await text('#pursuit'));
await snap('o1-escape');
// the office: a door that opens, a kit that takes a mark away
await G(() => { const g = window.__game.debug.game; g.paint.hits = 1; g.hud.paintHit('#ffb070', 1); });
await tp(P.hide.officeDoor, 1.0, 0);
check('the office door opens', await press('לפתוח את הדלת'));
await tp(P.hide.kit, 1.0, 0);
check('the first-aid kit takes a mark away', (await press('לקחת ערכת עזרה')) && (await G(() => window.__game.debug.game.paint.hits)) === 0);
// toward the east on the ground: the first beam comes down
await G((h) => window.__game.teleport(h.x - 7, h.z + 2, h.y), P.hide);
s = await talkThrough(async () => (await M())?.s.beamSaid?.[0], 20, 'the first beam');
check('the first beam comes down and closes the ground: "למעלה, במדרגות המערביות"', !!s && said('למטה סגור'));
const tgt = await G(() => window.__game.debug.game.target);
check('the arrow now points at the west stairs', !!tgt && Math.hypot(tgt.x - P.hide.stairsWb.x, tgt.z - P.hide.stairsWb.z) < 1.5);
// a blast warns, then goes off; standing in its ring costs a mark
const hits0 = await G(() => window.__game.debug.game.paint.hits);
s = await until(async () => (await G(() => window.__game.debug.game.fx.booms)) > booms0 + 2, 12, 'the first blast');
check('a blast with a warning ring goes off near the route', !!s);
// up the stairs and along the mezzanine: the second beam
await tp(P.hide.mezzWest); await wait(400);
await G((h) => window.__game.teleport(h.x + 5, h.z - 10.5, h.y + 3.2), P.hide);
s = await talkThrough(async () => (await M())?.s.beamSaid?.[1], 20, 'the second beam');
check('on the mezzanine the second beam closes the way east: down the rubble', !!s && said('דרך ההריסות'));
check('Nehorai is on the mezzanine (3.2 m up)', Math.abs((await state()).player.y - (P.hide.y + 3.2)) < 0.4, String((await state()).player.y));
await tp(P.hide.rubbleTop); await wait(300);
await G((h) => window.__game.teleport(h.x + 9, h.z - 0.6, h.y), P.hide);
await tp(P.hide.exitAt);
s = await until((s) => s.mission?.step === 2, 10, 'the exit door');
check('at the exit door with Ido: the wheel', !!s);
check('the hits stayed fair (no mark from a blast he was not in)', (await G(() => window.__game.debug.game.paint.hits)) <= hits0 + 1);
await G((p) => window.__game.teleport(p.x - 0.6, p.z, p.y), P.hide.wheel);
check('"לסובב את הגלגל עם עידו" (once Ido is at the door with him)', await press('לסובב את הגלגל עם עידו', 20) && (await G(() => { const g = window.__game.debug.game, w = g.world.places.hideout.wheelMate, i = g.npc('ido').pos; return Math.hypot(i.x - w.x, i.z - w.z) < 2.2; })));
s = await until(async () => (await M())?.s.open, 20, 'the door opening');
check('the wheel turns, the exit door opens: "פתוח! החוצה, כולם!"', !!s && (await G(() => window.__game.debug.world.places.hideout.exitDoor.open)));
s = await until((s) => s.mission?.step === 3, 10, 'outside');
const booms1 = await G(() => window.__game.debug.game.fx.booms);
await tp(P.hide.outside, 2, 0);
s = await until(async () => (await G(() => window.__game.debug.game.fx.booms)) > booms1, 10, 'the big blast');
check('out of the door: the big blast behind them', !!s);
await snap('o2-outside');
await G((c) => { const g = window.__game; g.teleport(c.x - 1.8, c.z + 1.2); g.enterCar(); }, P.hide.car);
s = await until((s) => s.mission?.id === 'ironroad', 15, 'the second mission');
check('in the Renault: mission 26 done, "המרדף הגדול" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('firestorm'))));

// ---------- mission 27: the big chase ----------
s = await until(async () => (await G(() => window.__game.debug.game.helis.length)) >= 2, 10, 'the helicopters');
check('two helicopters overhead', !!s);
const drive = (legs, cruise = 14) => G(({ legs, cruise }) => window.__game.drivePath(legs, cruise), { legs, cruise });
await drive([['כביש הברזל', 6, P.road.forkS - 2, 1.8], ['הדרך הישנה', 2, P.road.branchLen - 4, 1.8]]);
s = await until(async (s) => { await healthy(); return s.mission?.step >= 1; }, 120, 'the fork step');
check('east on the iron road, the chase on, things go up beside the road', !!s && (await G(() => window.__game.debug.game.fx.booms)) > booms1 + 2);
// a wreck at the fork: the fail screen, a retry from the checkpoint with a car that drives
await G(() => window.__game.debug.game.car.hurt(999));
s = await until(async () => page.isVisible('#failMenu'), 10, 'the fail screen');
check('the Renault wrecked: the fail screen', !!s && /הרנו נפגעה/.test(await text('#failReason')));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 1 && s.mode === 'car' && s.car.health > 90, 10, 'the retry');
check('retry: in the Renault again, repaired, before the fork', !!s);
await markNow();
await drive([['כביש הברזל', P.road.forkS - 118, P.road.forkS - 2, 1.8], ['הדרך הישנה', 2, P.road.branchLen - 4, 1.8]]);
s = await talkThrough(async (s) => { await healthy(); return s.mission?.step >= 2; }, 120, 'the branch');
check('at the fork: "נהוראי, שמאלה! עכשיו!" — the old road', !!s && said('נהוראי, שמאלה! עכשיו!'));
s = await talkThrough(async (s) => { await healthy(); return (await M())?.s.sealed; }, 120, 'the tunnel');
await talkThrough(async () => said('הם לא עוברים את זה'), 8, 'Erez\'s line at the rubble'); // the line starts in the frame the tunnel seals: listen once more
const noChase = await G(() => !window.__game.debug.game.chase);
check('through the tunnel: the rubble closes it behind them, the chase is over', !!s && noChase && said('הם לא עוברים את זה'), `sealed ${!!s} · chase over ${noChase} · line ${said('הם לא עוברים את זה')} · ${heard.slice(-4).join(' / ')}`);
await snap('o3-tunnel');
s = await until(async (s) => { await healthy(); return s.mission?.id === 'ironbase'; }, 120, 'the third mission');
check('mission 27 done; "בסיס הברזל" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('ironroad'))));

// ---------- mission 28: the Iron Base ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the gate');
check('at the gate, on foot: "אני מוביל. אחריי."', !!s && s.mode === 'foot' && said('אני מוביל. אחריי.'));
check('the orders button is on the screen', !!(await until(async () => page.isVisible('#btnSquad'), 5, 'the orders button')));
await page.dispatchEvent('#btnSquad', 'pointerdown');
check('an order: the team holds ("תישארו כאן!")', (await G(() => window.__game.debug.game.squad.mode)) === 'hold');
for (let k = 0; k < 3; k++) await page.dispatchEvent('#btnSquad', 'pointerdown');
check('...and back to following ("אחריי!")', (await G(() => window.__game.debug.game.squad.mode)) === 'follow');
s = await until(async () => (await M())?.s.gateUnlocked, 30, 'Ido at the lock');
check('Ido picks the gate\'s lock', !!s && !(await G(() => window.__game.debug.world.places.ironBase.gate.open)));
await tp(P.base.gateOutside);
check('"לפתוח את השער": Nehorai swings it open', (await press('לפתוח את השער', 10)) && !!(await until(() => G(() => window.__game.debug.world.places.ironBase.gate.open), 5, 'the gate open')));
await markAll(['guard1', 'guard2', 'guard3', 'guard4', 'vg1', 'vg2', 'vg3', 'vg4']);
s = await talkThrough((s) => s.mission?.step === 2, 30, 'the ground floor');
check('the yard and the towers clear', !!s);
await tp(P.base.lobby);
await markAll(['vg5', 'vg6', 'vg7', 'vg8']);
s = await talkThrough((s) => s.mission?.step === 3, 30, 'the stairs');
check('the ground floor clear', !!s);
// up: the lockdown; stay on the first floor and the second shutter shuts in front of him
await tp(P.base.s1top);
s = await talkThrough(async () => (await M())?.s.lockAt != null, 10, 'the lockdown');
check('on the first floor: the lockdown, the clock on the pill', !!s && /נעילה/.test(await text('#pursuit')), await text('#pursuit'));
check('Nehorai is on the first floor (3.6 m up)', Math.abs((await state()).player.y - (P.base.y + P.base.F1)) < 0.5);
await markAll(['vg9', 'kg1', 'kg2', 'kg3', 'kg4']); await G(() => { window.__game.debug.game.paint.hits = 0; }); // only the shutter can stop him here
s = await until(async () => page.isVisible('#failMenu'), 70, 'the shutter closing in front of him');
check('he waited: the shutter shut in front of him — the fail screen', !!s && /התריס נסגר/.test(await text('#failReason')), (await text('#failReason')).slice(0, 60));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 3 && !s.hold, 10, 'the retry');
check('retry: back on the ground floor, the shutters up again', !!s && (await G(() => window.__game.debug.world.places.ironBase.shutters.every((d) => d.open))));
await tp(P.base.s1top);
s = await until(async () => (await M())?.s.lockAt != null, 10, 'the lockdown again');
await tp(P.base.stairwell); await wait(300);
await tp(P.base.s2top); await wait(300);
await tp(P.base.control);
await markNow();
s = await talkThrough((s) => s.mission?.id === 'blackout', 30, 'the control room');
check('into the control room in time: mission 28 done, "הבגידה הגדולה" begins', !!s);
check('Nehorai is on the second floor (7.2 m up)', Math.abs((await state()).player.y - (P.base.y + P.base.F2)) < 0.5);

// ---------- mission 29: the betrayal ----------
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the screens');
check('Kotzi on the screens: "באמת חשבת שתוכל להיכנס לבסיס שלי ולצאת חי?"', said('נהוראי פרחי… באמת חשבת שתוכל להיכנס לבסיס שלי ולצאת חי?'));
check('the lights go out, the control room door is locked', (await state()).night > 0.95 && (await G(() => window.__game.debug.world.places.ironBase.control.door.locked)));
check('Ido on the radio: "אתה חייב להפעיל את הגנרטור!"', said('נהוראי, אני בקומה התחתונה. אני יכול לפתוח לך את הדרך, אבל אתה חייב להפעיל את הגנרטור!'));
check('the team split: Erez with him, three locked in the store room', (await G(() => window.__game.debug.game.squad.ids.join(','))) === 'erez' && (await G(() => window.__game.debug.world.places.ironBase.lockRoom.door.locked)));
await snap('o4-blackout');
await tp(P.base.note);
check('the note on the desk', await press('לקרוא את הפתק'));
await talkThrough(() => said('2-5-8-0'), 10, 'the code');
check('the code: 2-5-8-0', said('2-5-8-0'));
s = await talkThrough(async () => (await M())?.s.open, 40, 'Erez and the shelf');
check('Erez moves the shelf: the hidden door opens', !!s && (await G(() => window.__game.debug.world.places.ironBase.hidden.door.open)));
await tp(P.base.hiddenOut);
s = await until((s) => s.mission?.step === 2, 10, 'the back stairs');
check('through the hidden door', !!s);
await tp(P.base.s3top); await wait(300);
await G((p) => window.__game.teleport(p.x - 0.8, p.z, p.y), { x: P.base.breakerB.x, z: P.base.breakerB.z, y: P.base.y + P.base.F1 });
check('breaker B on the first floor', await press('להרים את המפסק'));
s = await until(() => G(() => window.__game.debug.world.places.ironBase.shutters[0].open), 15, 'the shutter lifting');
check('breaker B lifts the ground-floor shutter; Ido on the radio', !!s);
s = await until((s) => s.mission?.step === 3, 10, 'the yard');
await markAll(['kg5', 'kg6', 'kg7', 'kg8']);
await tp(P.base.keypad);
check('the keypad on the generator room', await press('להקיש את הקוד'));
await G(() => window.__game.debug.game.keypad.enter('1111'));
check('a wrong code is refused', !(await G(() => window.__game.debug.world.places.ironBase.generator.door.open)));
await G(() => window.__game.debug.game.keypad.enter('2580'));
s = await until((s) => s.mission?.step === 4, 10, 'the levers');
check('2-5-8-0: the door opens, Ido is there', !!s && (await G(() => window.__game.debug.world.places.ironBase.generator.door.open)));
// the levers: the wrong one first, then the order on the sign
const lever = async (i) => { const l = P.base.levers[i]; await G((l) => window.__game.teleport(l.x, l.z + 0.5, l.y), l); return press(`להוריד את הידית (${['ירוק', 'אדום', 'כחול'][i]})`); };
await lever(1);
check('a lever out of order: back to the start', (await M()).s.down.length === 0);
for (const i of [0, 2, 1]) await lever(i);
check('green, blue, red: the levers down', (await M()).s.down.length === 3);
await tp(P.base.machine);
check('"להפעיל את הגנרטור"', await press('להפעיל את הגנרטור'));
await markNow();
s = await talkThrough((s) => s.mission?.step === 5, 20, 'the power');
const lit = await until((s) => s.night < 0.95, 8, 'the lights');
check('the power back: the lights, the doors, the store room open', !!s && !!lit && (await G(() => window.__game.debug.world.places.ironBase.lockRoom.door.open)));
await until(async () => /מהמחסן|יונתי, דולב והדר/.test(await text('#objText')), 4, 'the store-room goal');
check('the others come over; the three wait in the store room for Nehorai', (await G(() => window.__game.debug.game.squad.ids.length)) === 5 && /מהמחסן|יונתי, דולב והדר/.test(await text('#objText')), await text('#objText'));
await tp({ ...P.base.lockOut, y: P.base.y });
s = await until(async () => (await M())?.s.freed, 10, 'the store room');
check('at the store room: out they come, the whole gang together again', !!s && (await G(() => window.__game.debug.game.squad.ids.length)) === 8);
await tp(P.base.gateOutside);
s = await until((s) => s.mission?.id === 'bridge', 20, 'the fifth mission');
check('out of the gate: mission 29 done, "הקרב על הגשר" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('blackout'))));
await snap('o5-bridge');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
