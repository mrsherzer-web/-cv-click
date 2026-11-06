// Chapter eight acceptance test, part two (missions 5–8): the bridge (a guard marked with real paint, the
// waves, the turret that marks whoever stays in its sight, the three sensors shot, three marks and a
// retry, the span that falls, Erez pulled up), the chase after Kotzi (the industrial strip, a jump off a
// ramp, the ruins, the headquarters' gate), the last war (the gate, the yard, the note, the keypad, the
// shelf, the passage, Kotzi's flight with the doors he shuts and Ido opens, the defences and the three
// breakers, the fist fight won), and the escape (the clock, the west door blown shut, the centre door
// under the beams, the east door, Dolev under a beam, the Renault, the blast, the ending, chapter eight
// done). usage: node tests/stage-p.test.mjs [url] [screenshot dir]
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
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const text = (sel) => page.textContent(sel);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });
const markAll = (filter) => G((f) => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) if (!x.marked && (!f || f.includes(x.npc.id))) P.markGuard(x, 'test'); }, filter);
const press = async (label, maxSec = 10) => { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`); if (s) await page.dispatchEvent('#btnInteract', 'pointerdown'); return !!s; };
const tp = (p, dx = 0, dz = 0) => G(({ p, dx, dz }) => window.__game.teleport(p.x + dx, p.z + dz, p.y), { p, dx, dz });
const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))) } : null; });
const said = (needle) => heard.some((l) => l.includes(needle));
const healthy = () => G(() => window.__game.debug.game.car.repair());
const drive = (legs, cruise = 14) => G(({ legs, cruise }) => window.__game.drivePath(legs, cruise), { legs, cruise });

// a game saved after the blackout (chapter eight, mission 4)
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => { const p = window.__game.debug.game.progressForChapter(8); p.done.push('firestorm', 'ironroad', 'ironbase', 'blackout'); p.unlocks.push('firestorm', 'ironroad', 'ironbase', 'blackout'); p.savedAt = Date.now(); localStorage.setItem('nehorai-game:save:v1', JSON.stringify(p)); });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
const P = await G(() => {
  const p = window.__game.debug.world.places, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw };
  const q = p.hq;
  return {
    bridge: { y: p.bridge.y, x: p.bridge.x, z: p.bridge.z, west: pt(p.bridge.west), edgeEast: pt(p.bridge.edge.east), east: pt(p.bridge.east), armour: pt(p.bridge.armour), sensors: p.bridge.armour.sensors.map((s) => ({ x: s.x, y: s.y, z: s.z })) },
    road: { k1: p.kotziRoad.k1.length, k2: p.kotziRoad.k2.length, k3: p.kotziRoad.k3.length, end: pt(p.kotziRoad.end), start: pt(p.kotziRoad.start) },
    hq: { y: q.y, gateOutside: pt(q.gateOutside), gateInside: pt(q.gateInside), note: pt(q.garage.desk), keypad: pt(q.server.keypadAt), inside: pt(q.server.inside), shelfAt: pt(q.server.shelfAt), strip: pt(q.server.hidden.strip), pSouth: pt(q.passage.south), backAt: pt(q.command.backAt), command: pt(q.command.inside), rooms: q.rooms.map((r) => ({ inside: pt(r.inside), doorAt: pt(r.doorAt) })), b: q.security.breakers.map(pt), controlAt: pt(q.control.doorAt), control: pt(q.control.inside), Win: pt(q.inner.Win), Ein: pt(q.inner.Ein), Eout: pt(q.inner.Eout), pinned: pt(q.escape.pinned), gate: pt(q.escape.gate), car: pt(q.car) },
  };
});

// ---------- mission 30: the bridge ----------
await markNow();
let s = await talkThrough((s) => s.mission?.id === 'bridge' && s.mission?.step === 1, 90, 'the bridge');
check('"הקרב על הגשר" follows on: "הם חוסמים את המעבר" / "אז נעבור דרכם"', !!s && said('הם חוסמים את המעבר.') && said('אז נעבור דרכם.'));
// one of them marked with real paint: Nehorai close, facing him, pulling the trigger
const shoot = async (id) => G(async (id) => {
  const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => x.npc.id === id);
  const n = gd.npc; g.player.place(n.pos.x - 6, n.pos.z, Math.PI / 2, n.pos.y); g.player.yaw = Math.PI / 2;
  for (let k = 0; k < 16 && !gd.marked; k++) { P.lock = gd; P.fire(); await new Promise((r) => setTimeout(r, 120)); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
  return gd.marked;
}, id);
check('a guard marked with real paint (aim, fire)', await shoot('fg1'));
await markAll(['fg2', 'fg3', 'fg4', 'fg5']);
s = await until((s) => s.mission?.step === 2, 15, 'the second wave');
check('the first wave down: the second', !!s);
await markAll(['fg6', 'fg7', 'fg8', 'fg9', 'fg10', 'fg11']);
s = await until((s) => s.mission?.step === 3, 15, 'the armoured car');
check('the second wave down: the armoured car, its turret on', !!s && (await G(() => window.__game.debug.world.places.bridge.armour.gun.on)));
// stand in the turret's sight: it marks
await G((b) => { const g = window.__game.debug.game; g.player.place(b.x - 14, b.z, Math.PI / 2, b.y); g.paint.hits = 0; }, P.bridge.armour);
s = await until(() => G(() => window.__game.debug.game.paint.hits >= 1), 12, 'the turret');
check('in the turret\'s sight for three seconds: a mark', !!s);
// three marks: out, and a retry from the checkpoint
await G(() => { window.__game.debug.game.paint.hits = 3; });
s = await until(async () => page.isVisible('#failMenu'), 8, 'the fail screen');
check('three marks: the fail screen', !!s && /סומן שלוש פעמים/.test(await text('#failReason')));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 3 && !s.hold && s.paint?.hits === 0, 10, 'the retry');
check('retry: back at the armoured car, marks cleared, the span in place', !!s && !(await G(() => window.__game.debug.world.places.bridge.span.down)));
// the three sensors, each shot from where it can be seen
for (let k = 0; k < 3; k++) {
  const ok = await G(async (k) => {
    const g = window.__game.debug.game, P = g.paint, pr = P.props[k], A = window.__game.debug.world.places.bridge.armour;
    const dx = pr.x - A.x, dz = pr.z - A.z, l = Math.hypot(dx, dz) || 1, from = { x: pr.x + (dx / l) * 5, z: pr.z + (dz / l) * 5 };
    g.player.place(from.x, from.z, 0, A.y); g.player.yaw = Math.atan2(pr.x - from.x, pr.z - from.z); P.lock = null;
    for (let i = 0; i < 6 && !pr.done; i++) { P.fire(); g.paint.hits = 0; await new Promise((r) => setTimeout(r, 150)); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
    return pr.done;
  }, k);
  check(`sensor ${k + 1} hit with paint`, ok);
}
s = await talkThrough((s) => s.mission?.step === 4, 20, 'the last wave');
check('the three sensors: the armoured car goes up, the turret off', !!s && !(await G(() => window.__game.debug.world.places.bridge.armour.gun.on)));
await markAll(['fg12', 'guard1', 'guard2', 'guard3', 'guard4', 'vg1']);
await markNow();
s = await talkThrough((s) => s.mission?.step === 5, 40, 'the collapse');
s = await talkThrough(async () => (await G(() => window.__game.debug.world.places.bridge.span.down)) && !(await state()).cutscene, 30, 'the span falling');
check('the last wave down: the span falls; Erez at the edge', !!s && (await G(() => window.__game.debug.game.npc('erez').model.pose)) === 'down');
await snap('p1-collapse');
await tp(P.bridge.edgeEast);
check('"לחלץ את ארז"', await press('לחלץ את ארז', 15));
s = await talkThrough(async () => said('לא אחי, אתה עדיין חייב לי.'), 30, 'the rescue');
check('Erez up: "זהו, אנחנו תיקו על החילוץ שלך." / "לא אחי, אתה עדיין חייב לי."', !!s && said('זהו, אנחנו תיקו על החילוץ שלך.'));
s = await talkThrough((s) => s.mission?.id === 'kotzichase', 40, 'the sixth mission');
check('mission 30 done; "המרדף אחרי קוצי" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('bridge'))));

// ---------- mission 31: after Kotzi ----------
s = await talkThrough(() => G(() => !!window.__game.debug.game.missions.active?.kc), 30, 'Kotzi\'s car');
check('Kotzi\'s black car tears off', !!s);
await G(() => { const g = window.__game; g.debug.game.dialogue.stop(); g.enterCar(); });
s = await until((s) => s.mission?.step === 1 && s.mode === 'car', 15, 'the chase');
check('into the Renault: the chase', !!s);
await drive([['דרך התעשייה', 3, P.road.k1 - 2, 0], ['הכביש המהיר', 2, P.road.k2 - 2, -2.4], ['דרך המתחם', 2, P.road.k3 - 1, 0]], 15);
let maxGap = 0;
s = await until(async (s) => { await healthy(); const r = await G(() => { const g = window.__game.debug.game, m = g.missions.active, kc = m?.kc; return { d: kc ? Math.hypot(kc.pos.x - g.car.pos.x, kc.pos.z - g.car.pos.z) : 0 }; }); maxGap = Math.max(maxGap, r.d); return s.mission?.step >= 2; }, 300, 'the ruins');
check('the industrial strip and the highway: Kotzi stays ahead (he waits, he never vanishes)', !!s && maxGap < 220, `max ${Math.round(maxGap)} m`);
check('off a ramp: the Renault in the air', ((await M())?.s.jumps || 0) > 0, `jumps ${(await M())?.s.jumps || 0}`);
s = await until(async (s) => { await healthy(); return s.mission?.id === 'lastwar'; }, 200, 'the seventh mission');
check('Kotzi in at the gate; at the gate: mission 31 done, "המלחמה האחרונה" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('kotzichase'))));

// ---------- mission 32: the last war ----------
await markNow();
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the gate');
check('at the headquarters\' gate, on foot', !!s && s.mode === 'foot');
s = await until(() => G(() => window.__game.debug.world.places.hq.gate.open), 30, 'Ido at the gate');
check('Ido opens the gate', !!s);
await markAll(['guard1', 'guard2', 'guard3', 'guard4', 'vg1', 'vg2', 'vg3', 'vg4']);
s = await talkThrough((s) => s.mission?.step === 2, 30, 'the garage');
check('the yard clear: the garage', !!s);
await markAll(['vg5', 'vg6', 'vg7']);
await tp(P.hq.note);
check('the note in the garage office', await press('לקרוא את הפתק'));
s = await talkThrough((s) => s.mission?.step === 3, 20, 'the server hall');
check('the code: 7-3-9-1', said('7-3-9-1'));
await tp(P.hq.keypad);
check('the keypad at the server hall', await press('להקיש את הקוד'));
await G(() => window.__game.debug.game.keypad.enter('7391'));
s = await until(() => G(() => window.__game.debug.world.places.hq.server.door.open), 8, 'the door');
check('7-3-9-1: the server hall opens', !!s);
await tp(P.hq.inside);
await markAll(['vg8', 'vg9', 'kg1']);
s = await talkThrough(async () => (await M())?.s.shelfOpen, 40, 'Ido and the shelf');
check('Ido moves the shelf: a hidden door, a passage north', !!s);
await tp(P.hq.strip); await wait(200);
await tp(P.hq.pSouth);
s = await until((s) => s.mission?.step === 4, 10, 'the passage');
check('into the passage', !!s);
await markAll(['kg5', 'kg6']);
await tp(P.hq.backAt);
s = await until(() => G(() => window.__game.debug.world.places.hq.command.back.open), 25, 'the back door');
check('Ido opens the command room\'s back door', !!s);
await tp(P.hq.command);
s = await talkThrough(async () => (await M())?.s.met && said('עוד לא.'), 30, 'Kotzi');
check('Kotzi in the command room: "נגמר, קוצי." / "עוד לא."', !!s);
s = await until(() => G(() => window.__game.debug.world.places.hq.command.front.locked), 30, 'Kotzi shutting the door');
check('he runs and shuts the door behind him', !!s);
for (const k of [0, 1, 2]) {
  if (k > 0) await markAll([['kg2', 'kg3', 'kg4'][k - 1]]);
  await tp(P.hq.rooms[k].doorAt);
  const r = await until(async () => (await M())?.s.opened?.[k], 40, `door ${k + 1}`);
  check(`door ${k + 1}: Ido opens what Kotzi shut`, !!r);
  await tp(P.hq.rooms[k].inside);
}
await markAll(['kg4']);
s = await talkThrough((s) => s.mission?.step === 5, 40, 'the defences');
check('Kotzi into the control room: the defences on (cameras, laser gates)', !!s && (await G(() => window.__game.debug.world.places.hq.security.cameras.every((c) => c.on) && window.__game.debug.world.places.hq.security.gates.every((g) => g.locked))));
await tp(P.hq.b[0]);
check('breaker 1 (in the third room)', await press('להוריד את המפסק'));
s = await until(async () => (await M())?.s.b?.[1], 40, 'Erez at breaker 2');
check('breaker 1 opens the first gate; Erez takes breaker 2, the second gate opens', !!s);
await G(() => { window.__game.debug.game.paint.hits = 0; });
await tp(P.hq.b[2]);
check('breaker 3 (by the control room)', await press('להוריד את המפסק'));
s = await until(async () => (await M())?.s.b?.[2], 10, 'breaker 3');
check('the cameras off, the control room open', !!s && (await G(() => window.__game.debug.world.places.hq.control.door.open)));
await tp(P.hq.controlAt);
await markNow();
s = await talkThrough(() => G(() => !!window.__game.debug.game.missions.active?.fight), 40, 'the fight');
const fists = await until(async () => page.isVisible('#btnPunch'), 5, 'the fight buttons');
check('the control room: "רק אתה ואני, פרחי." — the fight (fists)', !!s && said('רק אתה ואני, פרחי.') && !!fists);
await snap('p2-fight');
// the fight, won with the buttons (the two of them tired)
await G(() => { for (const o of window.__game.debug.game.missions.active.fight.opponents) o.fighter.hp = 6; });
s = await until(async () => { const won = await G(() => window.__game.debug.game.missions.active?.s?.won); if (!won) { await G(() => { const g = window.__game.debug.game, f = g.missions.active?.fight; const o = f?.standing?.[0]; if (o) { g.player.place(o.npc.pos.x, o.npc.pos.z + 1.2, Math.PI, o.npc.pos.y); g.player.yaw = Math.PI; } }); await page.dispatchEvent('#btnPunch', 'pointerdown'); await wait(150); await page.dispatchEvent('#btnPunch', 'pointerup').catch(() => {}); } return won; }, 90, 'the win');
check('Kotzi and Shpitz down: the fight won', !!s);
s = await talkThrough((s) => s.mission?.id === 'inferno', 40, 'the last mission');
check('Kotzi: "אתה חושב שאני האויב הכי גדול שלך? אין לך מושג מה מחכה לך…"', said('אתה חושב שאני האויב הכי גדול שלך? אין לך מושג מה מחכה לך…'));
check('mission 32 done; the clock: "הבריחה מהפיצוץ"', !!s && (await G(() => window.__game.debug.game.progress.done.includes('lastwar'))));

// ---------- mission 33: out before it goes up ----------
s = await until(() => G(() => /המפקדה/.test(document.getElementById('pursuit').textContent)), 10, 'the clock');
check('the clock on the pill: two minutes', !!s, await text('#pursuit'));
await markNow();
s = await talkThrough(async () => (await M())?.s.route === 'C', 40, 'the west door');
check('Ido opens the west door — a blast shuts it again: "חסום! מזרחה"', !!s && said('חסום! מזרחה'));
await tp(P.hq.rooms[2].inside);
s = await talkThrough(async () => (await M())?.s.route === 'E', 20, 'the centre door');
check('in the third room: beams down on the centre door — "לאולם המזרחי"', !!s && said('לאולם המזרחי'));
await tp(P.hq.rooms[1].inside); await wait(200);
await tp(P.hq.Ein, 0, -2);
s = await until(async () => (await M())?.s.eOpen, 30, 'the east door');
check('Ido opens the east door', !!s);
await tp(P.hq.Eout); await wait(200);
await tp(P.hq.pinned, 1.0, 0);
check('Dolev under a beam: "להרים את הקורה מדולב"', await press('להרים את הקורה מדולב', 15));
s = await until(async () => (await M())?.s.dolev, 15, 'Dolev free');
check('Dolev free', !!s);
await tp(P.hq.gate);
s = await until((s) => s.mission?.step === 1, 10, 'the gate');
check('out of the gate in time', !!s);
await G((c) => { const g = window.__game; g.teleport(c.x - 1.8, c.z); g.enterCar(); }, P.hq.car);
// away down the road: far enough, and the headquarters goes up behind them
await G(() => { const g = window.__game, r = window.__game.roadAt('הכביש המהיר', -30, -2.4); g.placeCar(r.x, r.z, r.yaw); });
await markNow();
s = await talkThrough(async () => said('אני לא חושב שזה נגמר'), 60, 'the last lines');
check('the blast; "זהו, נגמר הסיפור." / "נהוראי… אני לא חושב שזה נגמר."', !!s && said('זהו, נגמר הסיפור.'));
await snap('p3-blast');
s = await talkThrough(async () => said('קוצי היה רק ההתחלה.'), 20, 'the radio');
check('the radio: "קוצי היה רק ההתחלה."', !!s);
s = await until(() => G(() => /STAGE 8 COMPLETE/.test(document.body.textContent)), 30, 'STAGE 8 COMPLETE');
check('"STAGE 8 COMPLETE – OPERATION FIRESTORM" on the screen', !!s);
s = await until((s) => !s.mission, 60, 'the end of the chapter');
check('"TO BE CONTINUED IN STAGE 9…" and chapter eight done (the unlock saved)', !!s && (await G(() => { const p = window.__game.debug.game.progress; return p.done.includes('inferno') && p.unlocks.includes('chapter-8'); })));
check('back at the lookout in Katzir, as Nehorai, the gang gone home', (await G(() => { const g = window.__game.debug.game, p = window.__game.debug.world.places.plaza; return g.playingAs === 'nehorai' && Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z) < 20 && !g.squad.active; })));
await snap('p4-home');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
