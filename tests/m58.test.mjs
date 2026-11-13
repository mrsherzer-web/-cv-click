// Mission 58, ZERO HOUR, played on a phone page from a placed save (chapter ten with 47–57 done): the engine going,
// Muller's three lines, the loudspeakers and "04:00 – FINAL ESCAPE" on the pill; out of the last hall by the
// emergency door (Ido's switch) and down the fire stairs with the stick; the gap in bridge B leapt with the real
// button (the friends and the tied Shadow after him); through the plant house to the service door that slams and
// locks, its switch worked with the button; a reload in the middle picked up at its checkpoint; Liam under the
// frame, "נהוראי! אין זמן!" / "אמרתי שכולם חוזרים הביתה!", the frame lifted with Erez and Liam helped up; across the
// yard to the armoured car, everyone in (the Shadow tied in the back), the shield, the drive out of the service
// gate and down the road with the stick; the blast, the tower down, the car on its side; black; Nehorai out, every
// friend answers, the Shadow tied by the car; mission 59 begins. Every quoted line is compared with lines10.js.
// Each checkpoint (1–4) is failed once by its clock (the test runs the clock down: the only fail the script has)
// and retried. Shortcuts, said plainly: the clock is run down by the test, not by walking slowly.
import { openStage } from './lib/stage.mjs';
import { L, CARDS } from '../src/missions/lines10.js';

const E = L.zerohour;
const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return', 'laststand', 'endshadow'];
const t = await openStage({ chapter: 10, done: DONE, first: 'zerohour' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, page, text, objective, listen, heard, holdLoop } = t;
const retry = async () => { await page.tap('#retryBtn'); await holdLoop(true); };
const heardLine = (l) => said(l[1], l[0]);
const clean = (s) => (s || '').replace(/[⁦-⁩]/g, '');
const secs = (pill) => { const q = /(\d\d):(\d\d)/.exec(clean(pill)); return q ? +q[1] * 60 + +q[2] : -1; };

const helpers = () => G(() => {
  const g = window.__game.debug.game, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw };
  const TEAM = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  window.__m58 = {
    m() { return g.missions.active; },
    P() { const Z = g.world.places.citadel, W = Z.wayOut; return { route: W.route.map(pt), leapFrom: pt(W.leap.from), leapTo: pt(W.leap.to), sw: pt(W.doors[1].switchAt), before: pt(W.doors[1].before), after: pt(W.doors[1].after), fallenAt: pt(W.fallenAt), boardAt: pt(Z.armoured.boardAt), exitIn: pt(W.doors[0].before) }; },
    ms() { const m = g.missions.active; return m ? { id: m.def.id, step: m.stepIndex, erezSet: !!m.erezSet, ...Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) } : null; },
    starve(left = 1.5) { const m = g.missions.active; m.s.t0 = g.time - (240 - left); },
    doors() { const Z = g.world.places.citadel, W = Z.wayOut; return { exit: W.doors[0].door.open && !W.doors[0].door.locked, service: W.doors[1].door.open && !W.doors[1].door.locked, gate: !!Z.gates.service.isOpen, marked: W.marked }; },
    gang() { return TEAM.map((id) => { const n = g.npc(id); return { id, vis: n.visible, inCar: !!n.inCar, x: n.pos.x, z: n.pos.z, y: n.pos.y }; }); },
    car() { const c = g.car; return { name: c.name, x: c.pos.x, z: c.pos.z, y: c.pos.y, yaw: c.yaw, lean: c.lean, speed: c.speed, occupants: c.occupants.size, shield: !!g.missions.active?.shield, mode: g.mode }; },
    end() { const Z = g.world.places.citadel, sh = g.npc('shadow'); return { destroyed: !!Z.destroyed, shadow: sh.visible, tied: !!sh.model.bones?.chest?.getObjectByName('ropes'), pose: sh.model.pose ?? null, gang: TEAM.filter((id) => g.npc(id).visible && !g.npc(id).inCar).length, lean: g.car.lean ?? null, carName: g.car.name }; },
    // the left thumb in the car: the stick pushed up (gas) and over toward the arrow (the mission's own target)
    drive(on) {
      if (!on) { g.botInput = null; return; }
      g.botInput = (input) => {
        if (g.mode !== 'car' || g.cutscene || !g.target) return input;
        const c = g.car, tg = g.target, want = Math.atan2(tg.x - c.pos.x, tg.z - c.pos.z);
        let err = want - c.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
        const v = Math.abs(err) > 0.5 ? 5 : 13, sp = c.speed;
        return { ...input, steer: Math.max(-1, Math.min(1, -err * 2.4)), throttle: sp < v ? 1 : 0, brake: sp > v + 2 ? 0.7 : 0 };
      };
    },
  };
});
await helpers();
const ms = () => G(() => window.__m58.ms());
const doors = () => G(() => window.__m58.doors());
const gang = () => G(() => window.__m58.gang());
const car = () => G(() => window.__m58.car());
const starve = () => G(() => window.__m58.starve());
let P = await G(() => window.__m58.P());
// a forced fail by the clock at a checkpoint, the retry, and the clock it starts again with
async function clockFail(cp, minSecs) {
  await starve();
  const s = await until((s) => s.fail, 8, 'the clock running out');
  const why = s ? await text('#failReason') : '';
  check(`checkpoint ${cp}: the clock runs out → a fail with a reason and a tip`, !!s && /הזמן נגמר/.test(why) && /"/.test(why), why);
  await retry();
  const r = await until((s) => s.mission?.step === cp && !s.fail, 15, 'the retry');
  check(`checkpoint ${cp}: the retry starts there again with a fair clock (≥ ${minSecs} s)`, !!r && secs(r.pill) >= minSecs - 2, clean(r?.pill));
  return r;
}

// ---------- 0: the engine going ----------
let s = await until((s) => s.mission?.id === 'zerohour' && s.mission.step === 0, 30, 'mission 58');
check('mission 58 begins by itself from the save (47–57 done)', !!s);
check('its first goal on screen', /המנוע קורס/.test(s?.objective || ''), s?.objective);
await step(1.0);
await snap('m58-engine');
let pills = new Set();
s = await until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); if (s.pill) pills.add(clean(s.pill)); return s.mission?.step === 1; }, 150, 'the scene');
await listen();
for (const k of ['mullerProblem', 'howBad', 'mullerForever']) check(`the start: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
check('the loudspeakers send the Order\'s people out', said('כל הכוחות, לפנות את המצודה.', 'קול ברמקול'));
check(`the clock on the pill: "${CARDS.escape}"`, pills.has(CARDS.escape), [...pills].slice(0, 3).join(' | '));
check('the way out marked (green chevrons)', (await doors()).marked);

// ---------- 1: out of the hall, down the fire stairs ----------
check('step 1: its goal', await objective(1, /לברוח · אחרי החצים הירוקים/));
check('step 1 is a checkpoint (saved)', (await G(() => window.__game.debug.game.progress.resume)).checkpoint === 1);
s = await S();
check('the clock is running', secs(s.pill) > 200 && secs(s.pill) <= 240, clean(s.pill));
await clockFail(1, 240);
await tp(P.exitIn);
s = await until(async () => (await doors()).exit, 15, 'Ido at the switch');
await listen();
check('Ido throws the emergency door\'s switch: the door opens', !!s && said('פתוח! כולם החוצה, ולמטה במדרגות!', 'עידו'));
for (const k of [1, 2, 3, 4, 5, 6]) { const r = await tp(P.route[k]); if (r !== 'ok') break; }
s = await until((s) => s.mission?.step === 2, 10, 'the foot of the fire stairs');
check('down the fire stairs to bridge B: step 2', !!s, JSON.stringify((await S()).me));

// ---------- 2: the gap, the plant house, the service door; a reload in the middle ----------
check('step 2: its goal', await objective(2, /לקפוץ מעל הפער/));
s = await t.reload();
await helpers();
s = await until((s) => s.mission?.id === 'zerohour' && s.mission.step === 2, 30, 'the pick-up');
check('a reload at bridge B picks up at its checkpoint, the clock still on (≥ 190 s)', !!s && secs(s.pill) >= 188, clean(s?.pill));
await clockFail(2, 190);
await tp(P.leapFrom);
check('"לקפוץ מעל הפער" at the gap', await interact('לקפוץ מעל הפער'));
s = await until(async () => (await ms())?.leapt, 6, 'the landing');
check('the leap over the gap in bridge B', !!s);
await step(0.3);
await snap('m58-leap');
await until(async () => { const q = await gang(); return q.filter((f) => f.vis && f.x < P.leapTo.x + 3).length >= 8; }, 25, 'the friends\' leaps');
const across = (await gang()).filter((f) => f.vis && f.x < P.leapTo.x + 3).length;
const shAcross = await G((x) => { const n = window.__game.debug.game.npc('shadow'); return n.pos.x < x + 3; }, P.leapTo.x);
check(`the friends leap after him (${across}/8) and the tied Shadow too`, across === 8 && shAcross, JSON.stringify((await gang()).map((f) => [f.id, Math.round(f.x)])));
for (const k of [9, 10, 11, 12, 13, 14]) { const r = await tp(P.route[k]); if (r !== 'ok') break; }
s = await until(async () => (await ms())?.slam === 'shut', 6, 'the door slamming');
await listen();
check('the service door slams and locks ahead of them', !!s && !(await doors()).service && said('דלת השירות נטרקה וננעלה! יש מתג על הקיר של המתקן — שם!', 'הדר'));
await tp(P.sw);
check('"להפעיל את מתג הדלת" at its switch', await interact('להפעיל את מתג הדלת'));
s = await until((s) => s.mission?.step === 3, 8, 'the switch');
check('the switch opens the service door: step 3', !!s && (await doors()).service);

// ---------- 3: Liam under the frame ----------
s = await talkThrough((s) => s.mission?.step === 3 && !s.cutscene && !s.dialogue, 60, 'the crash');
check(`Liam under the frame: "${E.erezNoTime[1]}" / "${E.iSaid[1]}"`, heardLine(E.erezNoTime) && heardLine(E.iSaid));
check('step 3: its goal', /ליאם לכוד/.test((await S()).objective), (await S()).objective);
await clockFail(3, 150);
await talkThrough((s) => s.mission?.step === 3 && !s.cutscene, 40, 'the scene again');
await until(async () => (await ms())?.erezSet, 12, 'Erez at the frame');
await tp(P.fallenAt);
check('"להרים את המסגרת עם ארז" once Erez is at his end', await interact('להרים את המסגרת עם ארז', 10));
s = await until(async () => (await ms())?.frame === 'up', 6, 'the frame up');
check('the frame lifted with Erez', !!s);
await step(1.2);
check('"לעזור לליאם לקום" by him', await interact('לעזור לליאם לקום', 6));
s = await until(async () => (await ms())?.liam === 'up', 12, 'Liam up');
check('Nehorai gets Liam on his feet', !!s);
await tp(P.before); await tp(P.after);
s = await until((s) => s.mission?.step === 4, 8, 'the yard');
check('through the service door: step 4', !!s);

// ---------- 4: the armoured car, the drive ----------
check('step 4: its goal', await objective(4, /לרכב המשוריין/));
await clockFail(4, 110);
await listen();
for (const k of [17, 18, 19]) { const r = await tp(P.route[k]); if (r !== 'ok') break; }
await tp(P.boardAt);
const bay = await gang();
check('the friends sent on wait at the car (Muller, Ido, Hadar, Yonati, Avraham, Dolev)', bay.filter((f) => ['muller', 'ido', 'hadar', 'yonati', 'avraham', 'dolev'].includes(f.id) && f.vis).length === 6, JSON.stringify(bay.map((f) => [f.id, f.vis])));
check('"לעלות לרכב המשוריין · כולם בפנים" at its door', await interact('לעלות לרכב המשוריין · כולם בפנים'));
await step(0.5);
let c = await car();
check('everyone in the armoured car, the Shadow tied in the back (10 aboard)', c.mode === 'car' && c.name === 'armoured' && c.occupants === 10, JSON.stringify(c));
s = await talkThrough((s) => heard.some((l) => l.startsWith('עידו: דרך שער השירות')), 30, 'the shield');
c = await car();
check('Muller raises its shield; the service gate open', c.shield && (await doors()).gate && said('מגן הרכב — למעלה. הוא יחזיק. אני כמעט בטוח.', 'מולר'));
check('step 4 now says "לנסוע! להתרחק מהמצודה"', /לנסוע! להתרחק מהמצודה/.test((await S()).objective), (await S()).objective);
await G(() => window.__m58.drive(true));
let last = 0;
s = await until(async (s) => { if (s.mission?.step !== 4) return true; const q = await car(); if (Math.abs(q.speed) > last) last = Math.abs(q.speed); return false; }, 120, 'the drive');
await G(() => window.__m58.drive(false));
check(`driven out of the service gate and down the road with the stick (top ${Math.round(last * 3.6)} km/h)`, s?.mission?.step === 5, JSON.stringify(await car()));

// ---------- 5: the blast ----------
s = await until(async () => (await ms())?.black === 'on' || (await S()).mission?.step === 6 || (await G(() => !!window.__m58.m()?.wave)), 40, 'the wave');
await step(0.4);
await snap('m58-blast');
s = await talkThrough((s) => s.mission?.step === 6, 60, 'the black');
await listen();
let end = await G(() => window.__m58.end());
check('the blast: the citadel destroyed, the car thrown onto its side', end.destroyed && Math.abs((end.lean ?? 0) - Math.PI / 2) < 0.05, JSON.stringify(end));

// ---------- 6: alive ----------
check('step 6: its goal', await objective(6, /לצאת מהרכב/));
check('"לצאת מהרכב"', await interact('לצאת מהרכב', 12));
s = await talkThrough((s) => s.mission?.id !== 'zerohour' || heard.some((l) => l === `${E.weWon[0]}: ${E.weWon[1]}`), 120, 'the roll call');
await step(0.6);
await snap('m58-alive');
s = await talkThrough((s) => s.mission?.id !== 'zerohour', 30, 'the hand-over');
for (const k of ['calling', 'erezHere', 'idoSwear', 'allHere', 'all', 'weWon']) check(`the end: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
check('Muller and the rest answer, a word each', ['מולר', 'יונתי', 'הדר', 'אברהם', 'דולב', 'ליאם'].every((who) => heard.some((l) => l.startsWith(`${who}: פה`))));
check('Muller has sent the Shadow\'s position', said('שלחתי את המיקום שלו. יבואו לאסוף אותו.', 'מולר'));
end = await G(() => window.__m58.end());
check('everyone alive by the car; the Shadow sits tied beside it; the Renault given back', end.gang === 8 && end.shadow && end.tied && end.carName === 'renault', JSON.stringify(end));
check('the friends did their jobs: Yonati opened the gate, Avraham put the Shadow in, Erez lifted the frame', said('שער השירות פתוח! עכשיו רק תביאו את עצמכם!', 'יונתי') && said('הצל מאחור, קשור לספסל. מישהו רוצה לשבת לידו?', 'אברהם') && said('אני מהצד הזה. בשלוש — מרימים!', 'ארז'));
s = await until((s) => s.mission?.id === 'homeward', 20, 'mission 59');
check('mission 59 (homeward) begins: the hand-over', !!s, s?.mission?.id);
check('58 is saved as done', await G(() => window.__game.debug.game.progress.done.includes('zerohour')));

await t.finish();
