// Mission 56, THE LAST STAND, played on the stage harness from a placed save (chapter ten, 47-55 done): the energy
// hall's three waves (a shield bearer shoved, one flanked by the gang on the "advance" order, a heavy marked by the
// cell he stood by, runners), the tower bridge (out over bridge A and up the bridgehead with the stick, two runners
// with fists, the segment that falls, the leap, Erez's hand, the detour on the yellow catwalk, the emitters shot
// out), the machine room (the north corridor held, both breakers thrown while Muller's bar fills, a reload in the
// middle picked up at that checkpoint), the fist fight at the last hall's door beside Erez and Ido, the walk in and
// the door shutting; mission 57 begins. Each checkpoint with a fail is failed once on purpose and retried. The spec
// has no quoted line for this mission: the friends' own lines are checked as heard.
import { openStage } from './lib/stage.mjs';

const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return'];
// FROM=n (a checkpoint) begins there from a saved resume instead of at the start (for working on one arena)
const FROM = Number(process.env.FROM || 0);
const t = await openStage({ chapter: 10, done: DONE, first: 'laststand', progress: FROM ? `p.resume = { id: 'laststand', checkpoint: ${FROM} };` : null });
const { check, S, G, step, until, talkThrough, said, tp, snap, reload, interact, shoot, shootProp, fight, press, page } = t;

const ms = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, ...Object.fromEntries(Object.entries(a.s).filter(([, v]) => v == null || typeof v !== 'object')) } : null; });
// a point in the citadel's own frame on one of its floors
const at = (lx, lz, k = 'hall') => G(({ lx, lz, k }) => { const Z = window.__game.debug.world.places.citadel, p = Z.toWorld(lx, lz); return { x: p.x, z: p.z, y: { hall: Z.energyHall.y, roof: Z.bridges.y, bridge: Z.towerBridge.y, machine: Z.machine.y, last: Z.lastHall.y }[k] }; }, { lx, lz, k });
const place = (expr) => G((expr) => { const W = window.__game.debug.world, Z = W.places.citadel; const q = new Function('Z', `return (${expr});`)(Z); return { x: q.x, z: q.z, y: q.y }; }, expr);
const standing = (ids = null) => G((ids) => window.__game.debug.game.paint.guards.filter((g) => !g.marked && g.npc.visible && (!ids || ids.includes(g.npc.id))).map((g) => g.npc.id), ids);
const guardAt = (id) => G((id) => { const n = window.__game.debug.game.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y }; }, id);
// an order to the gang with the real squad button (it cycles follow, hold, cover, advance)
const order = async (mode) => { for (let i = 0; i < 4 && (await G(() => window.__game.debug.game.squad.mode)) !== mode; i++) { await press('btnSquad'); await step(0.1); } return (await G(() => window.__game.debug.game.squad.mode)) === mode; };
// a line heard (the dialogue's history read again first)
const heard = async (text, who) => { await t.listen(); return said(text, who); };
// the stick pushed straight at a point (a narrow gap the half-metre path grid cannot thread): the real left thumb
async function stick(p, maxSec = 8) {
  await G((p) => { const g = window.__game.debug.game; g.botInput = (input) => { const me = g.player.pos, dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz) || 1, cy = g.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy); return { ...input, move: d < 0.25 ? { x: 0, y: 0 } : { x: (dx * rx + dz * rz) / d, y: (dx * fx + dz * fz) / d }, run: false }; }; }, p);
  const r = await until((s) => Math.hypot(s.me.x - p.x, s.me.z - p.z) < 0.4, maxSec, 'the stick');
  await G(() => { window.__game.debug.game.botInput = null; });
  return !!r;
}
// a guard of the Order taken out the way a player would: a shield bearer shoved aside first, then marked
async function takeOut(id) {
  if (id.startsWith('sh')) { const g = await guardAt(id); await tp(g, 0, 0, null, { near: 1.6 }); await interact('לדחוף את המגן', 3); await step(0.1); }
  return shoot(id);
}
const forceFail = async (what) => {
  await G(() => { window.__game.debug.game.paint.hits = 3; });
  let s = await until((s) => s.fail, 6, 'the fail screen');
  const why = await page.textContent('#failReason');
  check(`${what}: three marks fail it, with a reason and a tip`, !!s && /סומן שלוש פעמים/.test(why) && /"/.test(why), why);
  await page.tap('#retryBtn');
  s = await until((s) => !s.fail, 8, 'the retry');
  return s;
};

let s = await S(), m, st, ok, f, res;
if (FROM <= 0) {
// ---------- 0: the energy hall ----------
check('the save is placed and "laststand" begins', s.mission?.id === 'laststand' && s.mission.step === 0, JSON.stringify(s.mission));
st = await G(() => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos;
  const ids = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  return { y: me.y - Z.energyHall.y, as: g.playingAs, armed: !!g.paint.armed, kind: g.paint.kind, gang: ids.filter((id) => g.npc(id).visible && Math.abs(g.npc(id).pos.y - me.y) < 1.5).length, dim: g.dimensionName, door: Z.energyHall.door.locked, music: g.sound?.musicMode };
});
check('staged on a fresh page: Nehorai on the energy hall\'s floor, armed, the whole gang with him, the hall\'s west door locked', Math.abs(st.y) < 1 && st.as === 'nehorai' && st.armed && st.gang === 8 && st.dim === null && st.door, JSON.stringify(st));
check('a goal is on screen', /אולם האנרגיה/.test(s.objective), s.objective);
// a forced fail before the first wave, and its retry from the checkpoint
s = await forceFail('the energy hall');
m = await ms();
check('the retry: the energy hall again, the marks wiped', m?.step === 0 && s.hits === 0 && m.k === 0, JSON.stringify(m));
s = await talkThrough((s) => s.mission?.s?.k === 0 && false, 3, 'the hall\'s lines'); // (taps the opening lines through)
check('the friends\' lines as the hall goes to emergency', said('הוא הפעיל את כל מערכות ההגנה. המצודה במצב חירום.', 'מולר'), t.heard.slice(-3).join(' | '));

const HEAVY_CELL = { hv1: 3 };
let shoved = false, flanked = false, celled = false, gaveOrder = false;
async function clearWave(k) {
  for (let i = 0; i < 160; i++) {
    m = await ms();
    if (!m || m.step !== 0 || m.k > k) return true;
    s = await S(); if (s.fail) { console.log(`  (failed in wave ${k + 1}: ${s.hits} marks)`); return false; }
    const ids = await standing();
    for (const id of ids) {
      if (id === 'sh1' || id === 'sh3') {
        // shoved: walked up to him with the stick, the real button, then marked from in front
        const g = await guardAt(id);
        await tp(g, 0, 0, null, { near: 1.6 });
        if (await interact('לדחוף את המגן', 3)) { if (id === 'sh1') shoved = true; await step(0.1); }
        await shoot(id);
      } else if (id === 'sh2') {
        // the order: "advance!" (the squad button three times: hold, cover, advance) and two of them flank him
        if (!gaveOrder) { gaveOrder = true; await order('advance'); }
        const ok = await until(async () => !(await standing(['sh2'])).length, 25, 'the flank');
        flanked = !!ok && (await G(() => window.__game.debug.game.paint.guards.find((g) => g.npc.id === 'sh2')?.markedBy !== 'player'));
        await order('follow'); // back to "follow me"
      } else if (HEAVY_CELL[id] != null && !celled) {
        // the heavy at his post by an energy cell: the cell shot from out of its ring
        await until(async () => { const p = await guardAt(id), c = await at(58, -28); return Math.hypot(p.x - c.x, p.z - c.z) < 4.6; }, 15, 'the heavy by the cell');
        const from = await at(68, -28);
        await shootProp(`m.cells[${HEAVY_CELL[id]}].pr`, from);
        await step(2.6);
        const r = await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel; return { cell: Z.energyHall.cells[3].blown, hv: g.paint.guards.find((x) => x.npc.id === 'hv1')?.marked }; });
        celled = r.cell && r.hv;
        if (!r.hv) await shoot(id);
      } else await shoot(id);
      if ((await S()).fail) return false;
    }
    await step(0.4);
  }
  console.log('  (wave stuck)', JSON.stringify(await ms()), JSON.stringify(await G(() => window.__game.debug.game.paint.guards.filter((g) => !g.marked).map((g) => [g.npc.id, g.npc.visible, Math.round(g.npc.pos.x), Math.round(g.npc.pos.z), Math.round(g.npc.pos.y)]))));
  return false;
}
ok = await clearWave(0);
check('wave 1 cleared: a shield bearer shoved with the real button and marked, one flanked by the gang on the "advance" order', ok && shoved && flanked, `ok ${ok} shoved ${shoved} flanked ${flanked}`);
await step(1);
await snap('m56-0-hall');
check('the "cover" order given with the squad button for the heavies and the runners', await order('cover'));
ok = await clearWave(1);
check('wave 2 cleared: a heavy marked by the energy cell he stood by (shot from outside its warning ring)', ok && celled, `ok ${ok} cell ${celled}`);
ok = await clearWave(2);
check('wave 3 (runners and a shield bearer) cleared', ok, JSON.stringify(await ms()));
await order('follow');
s = await talkThrough((s) => s.mission?.step >= 1, 40, 'Muller at the door');
const open1 = await G(() => !window.__game.debug.world.places.citadel.energyHall.door.locked);
check('the hall clear: Muller opens the west door onto bridge A, the next goal', s?.mission?.step === 1 && open1 && said('אחים יקרים, האולם נקי.', 'ליאם'), `${s?.objective} open ${open1}`);

}
if (FROM <= 1) {
// ---------- 1: the tower bridge ----------
s = await forceFail('the tower bridge');
m = await ms();
st = await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos; return { y: me.y - Z.energyHall.y, d: Math.hypot(me.x - Z.energyHall.doorInside.x, me.z - Z.energyHall.doorInside.z), open: !Z.energyHall.door.locked, drops: Z.towerBridge.dropped().length }; });
check('the retry: at the hall\'s west door, the door open, the bridge whole, the marks wiped', m?.step === 1 && st.open && st.d < 2 && Math.abs(st.y) < 1 && st.drops === 0 && s.hits === 0, JSON.stringify(st));
res = await tp(await place('Z.energyHall.doorOutside'));
res = await tp(await place('Z.bridges.a[0]'), 0, 0, null, { near: 1.2 });
check('out over bridge A with the stick', res === 'ok', res);
res = await tp(await place('Z.towerBridge.head.foot'), 0, 0, null, { near: 1.2 });
res = await tp(await place('Z.towerBridge.head.top'), 2, 0, null, { near: 1.5 });
s = await until((s) => !!s.fight, 10, 'the runners');
check('up the bridgehead with the stick: two runners come over the bridge, fists', !!s?.fight && /רצים/.test(s.objective), `${res} ${s?.objective}`);
await step(0.6);
f = await fight(120, 'the runners');
check('the runners beaten with the fist buttons (Hadar and Liam beside him)', f.won, JSON.stringify(f.s?.mission));
s = await until((s) => !s.fight && s.armed, 6, 'the marker back');
check('the marker back in his hands after the fists', !!s?.armed);
res = await tp(await place('Z.towerBridge.segments[1].centre'));
m = await until(async () => (await ms()).phase === 'leap', 8, 'the third segment falling');
const drop2 = await G(() => window.__game.debug.world.places.citadel.towerBridge.dropped());
check('a warned segment falls ahead of him (Muller\'s call first)', !!m && drop2.includes(2) && await heard('נהוראי! הקטע שלפניך נופל! לעצור!', 'מולר'), JSON.stringify(drop2));
res = await tp(await place('Z.towerBridge.segments[2].from'), 0, 0, null, { near: 0.6 });
ok = await interact('לקפוץ', 4);
m = await until(async () => (await ms()).phase === 'hand', 6, 'the landing');
check('the leap over the hole with the real button', ok && !!m, JSON.stringify(m));
s = await until(async () => (await S()).prompt === 'לתת יד לארז', 10, 'Erez at the edge');
await step(0.3);
await snap('m56-1-hand');
ok = await interact('לתת יד לארז', 6);
m = await until(async () => (await ms()).handDone, 8, 'Erez up');
const erez = await G(() => { const g = window.__game.debug.game, n = g.npc('erez'); return { dy: n.pos.y - g.player.pos.y, visible: n.visible }; });
check('Erez short at the broken edge, hauled up with Nehorai\'s hand', ok && !!m && Math.abs(erez.dy) < 0.5 && erez.visible && await heard('נהוראי!!! היה לי קצת קצר פה!', 'ארז'), JSON.stringify(erez));
res = await tp(await place('Z.towerBridge.segments[3].centre'), 1.2, 0);
m = await until(async () => (await ms()).phase === 'detour', 8, 'two more falling');
check('two more segments fall (warned): the detour', !!m && (await G(() => window.__game.debug.world.places.citadel.towerBridge.dropped().length)) === 3);
// through the gap in the rail at the fourth joint, along the catwalk, back in at the sixth
const L4 = await place('Z.towerBridge.detour.links[3]'), L6 = await place('Z.towerBridge.detour.links[5]');
res = await tp({ ...L4, z: L4.z + 2.4 }, 0, 0, null, { near: 0.5 });
let walked = await stick({ ...L4, z: L4.z + 0.2 }) && await stick({ ...L4, z: L4.z - 1.6 });
res = await tp({ ...L6, z: L6.z - 1.6 }, 0, 0, null, { near: 0.5 });
walked = walked && res === 'ok' && await stick({ ...L6, z: L6.z - 0.2 }) && await stick({ ...L6, z: L6.z + 1.6 });
check('round the broken part on the yellow catwalk with the stick', walked, res);
m = await ms();
check('the emitters by the upper door wake up (Ido\'s call)', m.phase === 'emit' && await heard('פולטים ליד הדלת! כשהכדור נאסף, לזוז הצידה ולירות בהם!', 'עידו'), m.phase);
await snap('m56-1-emitters');
const from = await place('Z.towerBridge.segments[7].centre');
for (let i = 0; i < 3; i++) await shootProp(`m.emit.list[${i}].pr`, from);
m = await until(async () => (await ms()).phase === 'door', 6, 'the emitters out');
check('the three emitters shot out', !!m && (await ms()).emitLeft === 0, JSON.stringify(await ms()));
s = await talkThrough((s) => s.mission?.s?.open, 20, 'Ido at the upper door');
res = await tp(await place('Z.machine.doorInside'));
s = await until((s) => s.mission?.step === 2, 10, 'the machine room');
check('Ido opens the upper door, in with the stick: the machine room', s?.mission?.step === 2 && await heard('פתוח! חדר המכונה, בבקשה, תיכנסו.', 'עידו'), s?.objective);

}
if (FROM <= 2) {
// ---------- 2: the machine room ----------
s = await forceFail('the machine room');
m = await ms();
check('the retry: the machine room from the start, the bar empty', m?.step === 2 && m.bar === 0 && s.hits === 0, JSON.stringify(m));
const NORTH = ['og7', 'og8', 'sh1', 'og9', 'hv1', 'rn1', 'og10', 'og11', 'rn2', 'og12'];
let breakers = 0, reloaded = false, snapped = false;
for (let i = 0; i < 500; i++) {
  m = await ms(); s = await S();
  if (s.fail) console.log(`  (failed in the machine room: ${await page.textContent('#failReason')})`);
  if (s.fail || !m || m.step !== 2) break;
  if (m.wait >= 0) {
    const b = await at(m.wait === 0 ? 56 : 92, -33.3, 'machine');
    await tp(b, 0, 0, null, { near: 0.5 });
    if (await interact('להרים את המפסק', 4)) breakers++;
    if (breakers === 1 && !reloaded) {
      // a reload in the middle: picked up at the machine room's checkpoint
      reloaded = true;
      s = await reload();
      s = await until((s) => s.mission?.id === 'laststand' && s.mission?.step === 2, 30, 'the machine room after the reload');
      st = await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos, a = g.missions.active; return { y: me.y - Z.machine.y, armed: !!g.paint.armed, bar: a?.s.bar, door: !Z.machine.upperDoor.locked, drops: Z.towerBridge.dropped().length, muller: g.npc('muller').visible, bandage: !!g.nehorai.userData?.bandage || true }; });
      check('a reload is picked up at the machine room: on its floor, armed, the bridge broken behind them, the upper door open, the bar from 0', !!s && Math.abs(st.y) < 1 && st.armed && st.door && st.drops === 3 && st.bar < 0.05 && st.muller, JSON.stringify(st));
      breakers = 0;
    }
    continue;
  }
  if (!snapped && m.bar > 0.2) { snapped = true; await snap('m56-2-machine'); }
  const north = await standing(NORTH);
  if (north.length) { for (const id of north) await takeOut(id); }
  else { const w = await at(72, -26, 'machine'); const me = (await S()).me; if (Math.hypot(me.x - w.x, me.z - w.z) > 3) await tp(w); }
  await step(0.5);
}
m = await ms();
check('the machine room held: both breakers thrown, Muller\'s bar full, the source off', breakers === 2 && m?.step >= 3 || (m?.step === 2 && m.off), `breakers ${breakers} ${JSON.stringify(m)}`);
check('Muller\'s lines at the source', await heard('מקור האנרגיה כבוי. המכונה שלו על סוללות עכשיו.', 'מולר') || (await talkThrough((s) => s.mission?.step >= 3, 20, 'the source off')) && said('מקור האנרגיה כבוי. המכונה שלו על סוללות עכשיו.', 'מולר'));

}
// ---------- 3: the last hall's door ----------
s = await talkThrough((s) => s.mission?.step === 3 && !!s.fight, 30, 'the heavies at the door');
check('two heavies at the door: fists, Erez and Ido beside him', !!s?.fight && s.opp.length === 2 && said('בלי מרקרים. ביחד, כמו פעם.', 'ארז'), `${s?.objective} ${s?.opp.length}`);
// a forced fail (the fight lost) and its retry
await G(() => { window.__game.debug.game.missions.active.s.lost = true; });
s = await until((s) => s.fail, 6, 'the fail screen');
const why = await page.textContent('#failReason');
check('the door fight lost fails with a reason and a tip', !!s && /הכבדים בדלת הפילו אותך/.test(why), why);
await page.tap('#retryBtn');
s = await talkThrough((s) => !s.fail && s.mission?.step === 3 && !!s.fight, 30, 'the retry');
check('the retry: the door fight again', !!s?.fight);
await step(0.5);
f = await fight(180, 'the heavies', { done: (s) => s.mission?.step >= 4 });
check('the two heavies beaten with the fist buttons', f.won || (await ms())?.step >= 4, JSON.stringify(f.s?.mission));

// ---------- 4: everyone walks in; the door shuts behind them ----------
s = await until((s) => s.mission?.step === 4 && s.armed, 10, 'the walk in');
check('the door at the top opens by itself; the goal: everyone up together', /כולם/.test(s?.objective || ''), s?.objective);
const en = await place('Z.lastHall.entry');
res = await tp(en, 0, 0, null, { near: 1.5 });
check('up the stairs with the stick into the last hall', res === 'ok' || res === 'a scene', res);
await step(1.8);
await snap('m56-4-shut');
s = await talkThrough((s) => s.mission?.id !== 'laststand', 30, 'the door shutting');
check('the door shuts behind them, the lines', said('זהו. הדלת נסגרה. רק אנחנו והוא.', 'ארז') && said('והוא לבד. אנחנו לא.', 'עידו'), t.heard.slice(-3).join(' | '));
s = await until((s) => s.mission?.id === 'endshadow', 20, 'mission 57');
check('mission 57 begins', s?.mission?.id === 'endshadow', JSON.stringify(s?.mission));
const handed = await G(() => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos;
  const ids = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  return { y: me.y - Z.lastHall.y, as: g.playingAs, armed: !!g.paint.armed, gang: ids.filter((id) => g.npc(id).visible && Math.abs(g.npc(id).pos.y - me.y) < 1.5 && Math.hypot(g.npc(id).pos.x - me.x, g.npc(id).pos.z - me.z) < 14).length };
});
check('handed over in the last hall, armed, the whole gang with him', Math.abs(handed.y) < 1 && handed.as === 'nehorai' && handed.gang >= 7, JSON.stringify(handed));
await t.finish();
