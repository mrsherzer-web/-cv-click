// Chapter ten acceptance test, group d (missions 57–59), played in ONE session from a placed save (chapter ten with
// 47–56 done) on a phone page, each mission carrying straight on to the next with no save placed between them:
// 57 END OF THE SHADOW — the meeting and its four lines; phase one, the armoured Shadow (three marks and a retry, then
// the core shot through its shutters with the real fire button, Muller's code on the keypad, his own bolt let by into
// the rods); phase two, the broken dimension (three marks and a retry, then the real one among his copies marked
// until his system gives); phase three, the last fist fight with the real buttons (knocked out once and a retry, then
// won); the end: the five lines, the portal system dead, the Shadow tied — and 58 begins in the same frame.
// 58 ZERO HOUR, live from 57 — the engine going, Muller's three lines, "04:00 – FINAL ESCAPE"; then the escape played
// in ONE go against the real clock (no fail, no reload, the clock never touched): out by the emergency door, down
// the fire stairs, the gap in bridge B leapt, the service door's switch, Liam under the frame lifted with Erez, the
// armoured car, the shield, the drive out with the stick, the blast; then a reload in the middle of the group (after
// the blast: picked up at the last checkpoint, the yard and the car), the clock let run out for real there (its
// time-out, a reason and a tip) and the retry; the car again, the blast, the roll call — and 59 begins.
// 59 HOMEWARD BOUND, live from 58 — what the citadel left put away, a fail (walking off from the gang) and its retry,
// the pit beside the road, the three talks with the interact button, the walk home with the stick, the people of
// Katzir and their signs, the lane (a fail and a retry at its checkpoint), the last moment, the cards, the credits,
// THANK YOU FOR PLAYING.; the start screen says the game is finished and "continue" opens the free roam.
// Every quoted line is compared with lines10.js; every step's goal is read off the screen; every leg on foot is walked
// with the stick. Shortcuts, said plainly: the test zeroes Nehorai's paint marks while it works a deed or shoots in
// 57 (dodging is not what is tested there), aims by turning the player, and runs the ending's clock faster.
// usage: node tests/stage-x.test.mjs [first mission: 57 | 58 | 59, or its id]
import { openStage, KEY } from './lib/stage.mjs';
import { L, CARDS, SIGNS } from '../src/missions/lines10.js';

const IDS = ['endshadow', 'zerohour', 'homeward'];
const arg = process.argv[2] || '57';
const FROM = IDS.includes(arg) ? 57 + IDS.indexOf(arg) : Math.min(59, Math.max(57, Number(arg) || 57));
const BEFORE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return', 'laststand'];
const t = await openStage({ chapter: 10, done: [...BEFORE, ...IDS.slice(0, FROM - 57)], first: IDS[FROM - 57] });
const { check, S, G, step, until, talkThrough, said, interact, tp, fight, snap, press, page, text, objective, listen, heard, holdLoop, reload, jump } = t;
// the real fire button: the marker refuses to fire while the game is held, so the loop is let go for the press; the
// retry button lets the loop go too (the fail screen's onRetry), so it is held again after the tap
const fire = async () => { await holdLoop(false); await press('btnFire'); await holdLoop(true); };
const retry = async () => { if (await G(() => !window.__game.debug.game.hud.el.fail.hidden)) await page.tap('#retryBtn'); await holdLoop(true); };
const heardLine = (l) => said(l[1], l[0]);
const clean = (s) => (s || '').replace(/[⁦-⁩]/g, '');
const secs = (pill) => { const q = /(\d\d):(\d\d)/.exec(clean(pill)); return q ? +q[1] * 60 + +q[2] : -1; };
const TEAM = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];

// ---------- the page's helpers (installed again after the reload) ----------
const helpers = () => G((TEAM) => {
  const W = window.__game, g = W.debug.game, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw };
  // every fail the missions call, counted (the escape in one go must have none)
  if (!g.missions.__counted) { const f0 = g.missions.fail; window.__fails = []; g.missions.fail = function (r) { window.__fails.push(`${this.active?.def.id}:${this.active?.stepIndex}: ${r}`); return f0.call(this, r); }; g.missions.__counted = true; }
  const flat = (m) => (m ? { id: m.def.id, step: m.stepIndex, ...Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) } : null);
  const Z = () => g.world.places.citadel, hall = () => Z().lastHall;
  const inHall = (p) => { const lx = p.x - Z().x, lz = p.z - Z().z; return lx > 32 && lx < 112 && Math.abs(lz) < 36 && Math.abs(p.y - hall().y) < 2; };
  const tied = () => !!g.npc('shadow').model.bones?.chest?.getObjectByName('ropes');
  const def59 = g.missions.defs.find((d) => d.id === 'homeward');
  window.__x = {
    m: () => g.missions.active,
    ms: () => { const m = g.missions.active, o = flat(m); if (o && m.def.id === 'zerohour') o.erezSet = !!m.erezSet; if (o && m.def.id === 'homeward') o.heard = Object.keys(m.s.heard || {}).filter((k) => m.s.heard[k]); return o; },
    fails: () => window.__fails.slice(),
    aim(p) { const me = g.player.pos, yaw = Math.atan2(p.x - me.x, p.z - me.z); g.player.yaw = yaw; g.follow.snapBehind(yaw); },
    zero() { g.paint.hits = 0; g.hud.paintClear(); },
    // 57
    hall() { const h = hall(), Gn = h.generators; return { y: h.y, from: pt(Gn[0].from), core: pt(Gn[0]), console: pt(Gn[1].consoleAt), lure: pt(Gn[2].lureAt) }; },
    foe() { const f = g.missions.active?.foe, sh = g.npc('shadow'); return { armor: !!sh.model.armor, visible: sh.visible, ...(f ? { x: f.pos.x, z: f.pos.z, y: f.pos.y, hp: f.hp, down: f.down, shields: f.shields.map((s) => s.up), copies: f.copies, tp: f.teleporting } : {}) }; },
    lock() { const Lk = g.paint.lock, f = g.missions.active?.foe; if (!Lk) return null; if (!f) return 'other'; return Lk === f.body ? 'body' : f.shields.some((s) => s.target === Lk) ? 'gen' : 'other'; },
    end57() { const sh = g.npc('shadow'); return { engine: hall().engine.mode, tied: tied(), shadow: sh.visible, armed: !!g.paint.armed, allies: g.paint.allies.length }; },
    // what 57 leaves for 58, read the moment 58 has begun
    carried() { const sh = g.npc('shadow'); return { me: inHall(g.player.pos), shadow: sh.visible && inHall(sh.pos), tied: tied(), gang: TEAM.filter((id) => g.npc(id).visible && inHall(g.npc(id).pos)).length, armed: !!g.paint.armed, bandage: !!g.nehorai.bones?.head?.getObjectByName('bandage'), as: g.playingAs, dim: g.dimensionName ?? null, mode: g.mode }; },
    // 58
    P58() { const Wo = Z().wayOut; return { route: Wo.route.map(pt), leapFrom: pt(Wo.leap.from), leapTo: pt(Wo.leap.to), sw: pt(Wo.doors[1].switchAt), before: pt(Wo.doors[1].before), after: pt(Wo.doors[1].after), fallenAt: pt(Wo.fallenAt), boardAt: pt(Z().armoured.boardAt), exitIn: pt(Wo.doors[0].before) }; },
    doors() { const Wo = Z().wayOut; return { exit: Wo.doors[0].door.open && !Wo.doors[0].door.locked, service: Wo.doors[1].door.open && !Wo.doors[1].door.locked, gate: !!Z().gates.service.isOpen, marked: Wo.marked }; },
    gang() { return TEAM.map((id) => { const n = g.npc(id); return { id, vis: n.visible, inCar: !!n.inCar, x: n.pos.x, z: n.pos.z, y: n.pos.y }; }); },
    car() { const c = g.car; return { name: c.name, x: c.pos.x, z: c.pos.z, y: c.pos.y, lean: c.lean, speed: c.speed, occupants: c.occupants.size, shield: !!g.missions.active?.shield, mode: g.mode }; },
    end58() { const sh = g.npc('shadow'); return { destroyed: !!Z().destroyed, shadow: sh.visible, shadowIn: !!sh.inCar, tied: tied(), gang: TEAM.filter((id) => g.npc(id).visible && !g.npc(id).inCar).length, lean: g.car.lean ?? null, carName: g.car.name }; },
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
    // 59: the way home as the mission measures it (u = metres still to go to Katzir's way in)
    way: (u, off = 0) => def59.way(g, u, off),
    where() { const w = def59.onWay(g); return { u: Math.round(w.u), d: +w.d.toFixed(1) }; },
    scene() {
      const m = g.missions.active, c = m?.crowd, sh = g.npcs.get('shadow');
      return {
        as: g.playingAs, mode: g.mode, armed: !!g.paint.player, allies: g.paint.allies.length, guards: g.paint.guards.filter((x) => x.npc.visible && !x.marked).length,
        gang: TEAM.filter((id) => g.npc(id).visible && !g.npc(id).inCar).length, squad: g.squad.active ? g.squad.ids.length : 0, errands: g.squad.tasks.size,
        bandage: !!g.nehorai.bones?.head?.getObjectByName('bandage'), preset: g.daylight?.presetName ?? null, dim: g.dimensionName ?? null,
        shadow: !!sh?.visible, armoured: g.vehicles.some((v) => v.name === 'armoured') || !!g.scene.getObjectByName('armoured'), car: g.car.name,
        carHome: Math.hypot(g.car.pos.x - g.world.places.carSpot.x, g.car.pos.z - g.world.places.carSpot.z), alarm: !!Z().alarm?.active,
        crowd: c ? { size: c.people.length, level: +(c.target ?? c.level ?? 0).toFixed(2), signs: c.signs, painted: JSON.parse(c.canvas?.dataset?.signs || '[]'), holders: c.people.filter((p) => p.style === 'sign').length } : null,
      };
    },
    near(id) { const n = g.npc(id), p = g.player.pos; return Math.hypot(n.pos.x - p.x, n.pos.z - p.z); },
    pos(id) { const n = g.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y }; },
    cam() { const m = g.missions.active; return m?.cam ? { t: m.cam.t, dur: m.cam.dur } : null; },
    ending() { const E = W.finale.ENDING; return { phase: E.phase, log: E.log.slice(), skipped: E.skipped }; },
  };
}, TEAM);
await helpers();
await G(() => { window.__session = 'stage-x'; }); // gone only if the page is reloaded
const X = (name, arg) => G(({ name, arg }) => window.__x[name](arg), { name, arg });
const ms = () => X('ms');
const foe = () => X('foe');
const zero = () => X('zero');
const fails = () => X('fails');
let s, r, f;

// ===================================================== mission 57 =====================================================
if (FROM <= 57) {
  const E = L.endshadow;
  s = await until((s) => s.mission?.id === 'endshadow' && s.mission.step === 0, 30, 'mission 57');
  check('57: begins by itself from the save (47–56 done)', !!s);
  check('57 step 0: its goal "הצל באולם האחרון"', /הצל באולם האחרון/.test(s?.objective || ''), s?.objective);
  await step(1.2);
  await snap('x57-meet');
  s = await talkThrough((s) => s.mission?.step === 1, 150, 'the meeting');
  for (const k of ['shadowPower', 'forgot', 'shadowWhat', 'notAlone']) check(`57 the meeting: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
  f = await foe();
  check('57: the suit closes over him', f.armor && f.visible, JSON.stringify(f));

  // ---------- phase one: a fail (three marks) and its retry, then the three shields ----------
  check('57 step 1: its goal "שלב 1 · הצל המשוריין · מגנים (0/3)"', await objective(1, /שלב 1 · הצל המשוריין · מגנים \(0\/3\)/));
  check('57 phase one is a checkpoint (saved)', (await G(() => window.__game.debug.game.progress.resume))?.checkpoint === 1);
  await G(() => { window.__game.debug.game.paint.hits = 2; });
  s = await until((s) => s.fail, 40, 'the third mark');
  const why1 = s ? await text('#failReason') : '';
  check('57: three marks fail phase one, with a reason and a tip', !!s && /שלוש פעמים/.test(why1) && /טבעת/.test(why1), why1);
  await retry();
  s = await until((s) => s.mission?.step === 1 && !s.fail && s.hits === 0, 15, 'the retry');
  check('57: the retry starts phase one again at its checkpoint', !!s);
  const Hh = await X('hall');
  await tp(Hh.from);
  let shots = 0, sawShut = false, sawOpen = false;
  for (let i = 0; i < 80; i++) {
    await zero();
    const st = await G(() => { const m = window.__x.m(); return { open: !!m.s.shutter, up: m.foe.shields[0].up }; });
    if (!st.up) break;
    if (st.open) sawOpen = true; else sawShut = true;
    await X('aim', Hh.core);
    await step(0.1);
    if (st.open && (await X('lock')) === 'gen') { await fire(); shots++; }
    await step(0.25);
  }
  f = await foe();
  check(`57 shield 1/3: the core shot with the fire button while its shutters were open (${shots} pellets)`, f.shields && !f.shields[0] && sawShut && sawOpen, JSON.stringify(f.shields));
  check('57: the goal counts it (1/3)', /מגנים \(1\/3\)/.test((await S()).objective), (await S()).objective);
  await zero();
  await tp(Hh.console);
  check('57: "לעבוד על הקונסולה" at the console', await interact('לעבוד על הקונסולה'));
  const code = (await ms()).code;
  await step(0.3); await listen();
  check(`57: Muller reads the code (${code}) over the radio`, !!code && heard.some((l) => l.startsWith('מולר: ') && l.includes(code.split('').join(', '))), heard.slice(-2).join(' | '));
  for (const d of code || '') { await page.dispatchEvent(`#keypad button[data-d="${d}"]`, 'pointerdown'); await step(0.05); }
  await page.waitForTimeout(900); await step(0.3);
  f = await foe();
  check('57 shield 2/3: the caged generator off with the keypad', f.shields && !f.shields[1], JSON.stringify(f.shields));
  await zero();
  await tp(Hh.lure);
  check('57: on the plate he comes round and gathers a bolt (its lane warned on the floor)', !!(await until(async () => (await ms())?.lure === 'bolt', 20, 'his bolt lined up')));
  await tp(Hh.lure, 2.8, 0);
  await zero();
  check('57 shield 3/3: his own bolt let by into the conductor rods', !!(await until(async () => { const q = await foe(); return !q.shields || !q.shields[2]; }, 10, 'the rods')));
  s = await talkThrough((s) => s.mission?.step === 2, 30, 'phase two');
  check('57: Erez and Ido had their say in phase one', said('הליבה למעלה נפתחת כל כמה שניות. כשהתריסים עולים — לירות!', 'ארז') && said('המחולל השני בכלוב, והקונסולה נעולה בקוד. מולר, תן לו ספרות!', 'עידו'));

  // ---------- phase two: a fail and its retry, then the real one among the copies ----------
  check('57 step 2: its goal "שלב 2 · הממד השבור"', await objective(2, /שלב 2 · הממד השבור/));
  const st2 = await G(() => { const m = window.__x.m(); return { portals: m.portals.length, fields: m.fields.length, engine: window.__game.debug.game.world.places.citadel.lastHall.engine.mode }; });
  check('57: rifts torn in the hall, fields that stop time, the engine overloaded', st2.portals === 4 && st2.fields === 2 && st2.engine === 'overload', JSON.stringify(st2));
  await until(async () => (await foe()).copies > 0, 12, 'his copies');
  await G(() => { window.__game.debug.game.paint.hits = 2; });
  s = await until((s) => s.fail, 40, 'the third mark');
  const why2 = s ? await text('#failReason') : '';
  check('57: three marks fail phase two, with a reason and a tip', !!s && /צל/.test(why2) && /מולר/.test(why2), why2);
  await retry();
  check('57: the retry starts phase two again at its checkpoint', !!(await until((s) => s.mission?.step === 2 && !s.fail && s.hits === 0, 15, 'the retry')));
  await step(1.0);
  await snap('x57-copies');
  let fired = 0;
  for (let i = 0; i < 400; i++) {
    await zero();
    const m = await ms(); if (!m || m.step !== 2 || m.p !== 'fight') break;
    const q = await foe(); if (!q.x || q.down) break;
    if (q.tp) { await step(0.2); continue; }
    const me = (await S()).me, d = Math.hypot(q.x - me.x, q.z - me.z);
    if (d > 13) { await tp({ x: q.x + (me.x - q.x) / d * 8, z: q.z + (me.z - q.z) / d * 8, y: q.y }, 0, 0, null, { max: 12 }); continue; }
    await X('aim', q);
    await step(0.1);
    if ((await X('lock')) === 'body') { await fire(); fired++; }
    await step(0.3);
  }
  s = await talkThrough((s) => s.mission?.step === 3, 30, 'phase three');
  check(`57 phase two: the real one marked with the fire button until his system gave (${fired} pellets)`, !!s);
  check('57: Muller marked the real one; Erez and Ido popped copies', said('האמיתי — זה שסימנתי לכם! החתימה שלו לא משקרת.', 'מולר') && (said('מזויף! הבא בתור.', 'ארז') || said('גם זה מזויף. כמה הוא צריך?', 'עידו')));

  // ---------- phase three: knocked out once and a retry, then the fist fight won with the buttons ----------
  check('57 step 3: its goal "שלב 3 · פנים אל פנים"', await objective(3, /שלב 3 · פנים אל פנים/));
  s = await until((s) => !!s.fight, 30, 'the fight');
  f = await foe();
  check('57: the suit broken off, fists up (no marker in hand)', !!s && !f.armor && !(await S()).armed);
  await G(() => { window.__game.debug.game.fighter.hp = 1; });
  s = await until((s) => s.fail, 40, 'his punch');
  const why3 = s ? await text('#failReason') : '';
  check('57: knocked out — the fight fails with a reason and a tip', !!s && /הצל הפיל אותך/.test(why3), why3);
  await retry();
  check('57: the retry starts the fist fight again at its checkpoint', !!(await until((s) => s.mission?.step === 3 && !!s.fight && !s.fail, 30, 'the retry')));
  await step(0.6);
  await snap('x57-fight');
  r = await fight(420, 'the last fight', { boss: true });
  check(`57: the last fist fight won with the buttons (combos ${r.combos}, heavies ${r.heavies}, specials ${r.specials}, counters ${r.counters})`, r.won, JSON.stringify(r.s?.mission));
  await listen();
  check('57: Erez and Ido stepped in for a moment each', said('תפסתי לו את היד — עכשיו!', 'ארז') && said('סליחה שאני מפריע. תמשיך!', 'עידו'));

  // ---------- the end, and 58 straight on ----------
  s = await until((s) => s.mission?.step === 4 || s.mission?.id !== 'endshadow', 20, 'the end');
  check('57 step 4: its goal "הצל על הרצפה"', s?.mission?.step === 4 && /הצל על הרצפה/.test(s.objective), s?.objective);
  s = await talkThrough((s) => s.mission?.id !== 'endshadow' || heard.some((l) => l.startsWith('אברהם: ')), 120, 'the tying');
  await step(0.4);
  await snap('x57-tied');
  s = await talkThrough((s) => s.mission?.id !== 'endshadow' || said('קשור. הוא לא הולך לשום מקום.', 'אברהם'), 60, 'the ropes');
  const end57 = await X('end57'); // (once he is tied, before 58 begins: it overloads the engine again the moment it takes the hall)
  s = await talkThrough((s) => s.mission?.id !== 'endshadow', 60, 'the hand-over');
  for (const k of ['shadowHow', 'separate', 'didntWork', 'badEnemies', 'over']) check(`57 the end: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
  check('57: Muller kills the portal system; Avraham and Dolev tie him', said('מערכת הפורטלים — מושבתת. אין לו לאן לברוח.', 'מולר') && said('קשור. הוא לא הולך לשום מקום.', 'אברהם'));
  check('57: beaten for good — tied, the portal engine dead, the gang armed again', end57.tied && end57.engine === 'dead' && end57.shadow && end57.armed && end57.allies >= 6, JSON.stringify(end57));
  s = await until((s) => s.mission?.id === 'zerohour', 20, 'mission 58');
  const live = await X('carried');
  check('57 → 58: a live carry-on (no reload, no save placed): 58 begins in the same session', !!s && (await G(() => window.__session === 'stage-x')) && (await G(() => window.__game.debug.game.progress.done.includes('endshadow'))));
  check('58 takes the scene as 57 left it: in the last hall, the Shadow tied there, the gang round them, Nehorai armed and bandaged, himself, in the normal world', live.me && live.shadow && live.tied && live.gang === 8 && live.armed && live.bandage && live.as === 'nehorai' && !live.dim && live.mode === 'foot', JSON.stringify(live));
}

// ===================================================== mission 58 =====================================================
if (FROM <= 58) {
  const E = L.zerohour;
  const P = await X('P58');
  const doors = () => X('doors');
  const gang = () => X('gang');
  const car = () => X('car');
  s = await until((s) => s.mission?.id === 'zerohour' && s.mission.step === 0, 30, 'mission 58');
  check('58 step 0: its goal "המנוע קורס"', /המנוע קורס/.test(s?.objective || ''), s?.objective);
  await step(1.0);
  await snap('x58-engine');
  const pills = new Set();
  s = await until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); if (s.pill) pills.add(clean(s.pill)); return s.mission?.step === 1; }, 150, 'the scene');
  await listen();
  for (const k of ['mullerProblem', 'howBad', 'mullerForever']) check(`58 the start: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
  check('58: the loudspeakers send the Order\'s people out', said('כל הכוחות, לפנות את המצודה.', 'קול ברמקול'));
  check(`58: the clock on the pill: "${CARDS.escape}"`, pills.has(CARDS.escape), [...pills].slice(0, 3).join(' | '));
  check('58: the way out marked (green chevrons)', (await doors()).marked);

  // ---------- the escape in ONE go against the real clock: no fail, no reload, the clock never touched ----------
  check('58 step 1: its goal "לברוח · אחרי החצים הירוקים"', await objective(1, /לברוח · אחרי החצים הירוקים|דלת החירום/));
  check('58 step 1 is a checkpoint (saved)', (await G(() => window.__game.debug.game.progress.resume))?.checkpoint === 1);
  const f0 = (await fails()).length, clock = [];
  s = await S();
  clock.push(secs(s.pill));
  check('58: the clock is running from 04:00', secs(s.pill) > 225 && secs(s.pill) <= 240, clean(s.pill));
  await tp(P.exitIn);
  s = await until(async () => (await doors()).exit, 15, 'Ido at the switch');
  const idoSaid = await until(async () => { await listen(); return said('פתוח! כולם החוצה, ולמטה במדרגות!', 'עידו'); }, 8, 'Ido\'s word'); // (said once the line before it is over)
  check('58: Ido throws the emergency door\'s switch: the door opens, "פתוח! כולם החוצה, ולמטה במדרגות!"', !!s && !!idoSaid);
  for (const k of [1, 2, 3, 4, 5, 6]) { r = await tp(P.route[k]); if (r !== 'ok') break; }
  s = await until((s) => s.mission?.step === 2, 10, 'the foot of the fire stairs');
  check('58: down the fire stairs to bridge B (step 2)', !!s, JSON.stringify((await S()).me));
  clock.push(secs((await S()).pill));
  check('58 step 2: its goal "לקפוץ מעל הפער · אל דלת השירות"', await objective(2, /הפער בגשר · לקפוץ|לקפוץ מעל הפער/));
  await tp(P.leapFrom);
  check('58: "לקפוץ מעל הפער" at the gap', await interact('לקפוץ מעל הפער'));
  check('58: the leap over the gap in bridge B', !!(await until(async () => (await ms())?.leapt, 6, 'the landing')));
  await step(0.3);
  await snap('x58-leap');
  await until(async () => { const q = await gang(); return q.filter((f) => f.vis && f.x < P.leapTo.x + 3).length >= 8 && await G((x) => window.__game.debug.game.npc('shadow').pos.x < x + 3, P.leapTo.x); }, 25, 'the friends\' leaps');
  const across = (await gang()).filter((f) => f.vis && f.x < P.leapTo.x + 3).length;
  const shAcross = await G((x) => window.__game.debug.game.npc('shadow').pos.x < x + 3, P.leapTo.x);
  check(`58: the friends leap after him (${across}/8) and the tied Shadow too`, across === 8 && shAcross, JSON.stringify((await gang()).map((f) => [f.id, Math.round(f.x)])));
  for (const k of [9, 10, 11, 12, 13, 14]) { r = await tp(P.route[k]); if (r !== 'ok') break; }
  s = await until(async () => (await ms())?.slam === 'shut', 6, 'the door slamming');
  await listen();
  check('58: the service door slams and locks ahead of them (Hadar sees the switch)', !!s && !(await doors()).service && said('דלת השירות נטרקה וננעלה! יש מתג על הקיר של המתקן — שם!', 'הדר'));
  await tp(P.sw);
  check('58: "להפעיל את מתג הדלת" at its switch', await interact('להפעיל את מתג הדלת'));
  s = await until((s) => s.mission?.step === 3, 8, 'the switch');
  check('58: the switch opens the service door (step 3)', !!s && (await doors()).service);
  clock.push(secs((await S()).pill));
  s = await talkThrough((s) => s.mission?.step === 3 && !s.cutscene && !s.dialogue, 60, 'the crash');
  check(`58: Liam under the frame: "${E.erezNoTime[1]}" / "${E.iSaid[1]}"`, heardLine(E.erezNoTime) && heardLine(E.iSaid));
  check('58 step 3: its goal "ליאם לכוד · להרים את המסגרת עם ארז"', /המסגרת עם ארז|ארז בדרך למסגרת/.test((await S()).objective), (await S()).objective);
  await until(async () => (await ms())?.erezSet, 12, 'Erez at the frame');
  await tp(P.fallenAt);
  check('58: "להרים את המסגרת עם ארז" once Erez is at his end', await interact('להרים את המסגרת עם ארז', 10));
  check('58: the frame lifted with Erez', !!(await until(async () => (await ms())?.frame === 'up', 6, 'the frame up')));
  await step(1.2);
  check('58: "לעזור לליאם לקום" by him', await interact('לעזור לליאם לקום', 6));
  check('58: Nehorai gets Liam on his feet', !!(await until(async () => (await ms())?.liam === 'up', 12, 'Liam up')));
  await listen();
  check('58: Erez took his end of the frame', said('אני מהצד הזה. בשלוש — מרימים!', 'ארז'));
  await tp(P.before); await tp(P.after);
  s = await until((s) => s.mission?.step === 4, 8, 'the yard');
  check('58: through the service door into the yard (step 4)', !!s);
  clock.push(secs((await S()).pill));
  check('58 step 4: its goal "לרכב המשוריין"', await objective(4, /לרכב המשוריין/));
  for (const k of [17, 18, 19]) { r = await tp(P.route[k]); if (r !== 'ok') break; }
  // into the bay by its open side, clear of the car (the walker's planner does not see the car)
  const toCar = async () => { await tp({ x: P.boardAt.x - 1.5, z: P.boardAt.z - 9, y: P.boardAt.y }); await tp(P.boardAt); };
  await toCar();
  const bay = await gang();
  check('58: the friends sent on wait at the car (Muller, Ido, Hadar, Yonati, Avraham, Dolev)', bay.filter((f) => ['muller', 'ido', 'hadar', 'yonati', 'avraham', 'dolev'].includes(f.id) && f.vis).length === 6, JSON.stringify(bay.map((f) => [f.id, f.vis])));
  // everyone in, the shield, the gate, the drive: the same after the reload below
  async function boardAndDrive(tag) {
    check(`58${tag}: "לעלות לרכב המשוריין · כולם בפנים" at its door`, await interact('לעלות לרכב המשוריין · כולם בפנים'));
    await step(0.5);
    let c = await car();
    check(`58${tag}: everyone in the armoured car, the Shadow tied in the back (10 aboard)`, c.mode === 'car' && c.name === 'armoured' && c.occupants === 10, JSON.stringify(c));
    await talkThrough((s) => heard.some((l) => l.startsWith('עידו: דרך שער השירות')), 30, 'the shield');
    c = await car();
    check(`58${tag}: Muller raises its shield; the service gate open`, c.shield && (await doors()).gate && said('מגן הרכב — למעלה. הוא יחזיק. אני כמעט בטוח.', 'מולר'));
    check(`58${tag}: step 4 now says "לנסוע! להתרחק מהמצודה"`, /לנסוע! להתרחק מהמצודה/.test((await S()).objective), (await S()).objective);
    await X('drive', true);
    let top = 0;
    const d = await until(async (s) => { if (s.mission?.step !== 4) return true; clock.last = secs(s.pill); const q = await car(); top = Math.max(top, Math.abs(q.speed)); return false; }, 120, 'the drive');
    await X('drive', false);
    check(`58${tag}: driven out of the service gate and down the road with the stick (top ${Math.round(top * 3.6)} km/h)`, d?.mission?.step === 5, JSON.stringify(await car()));
    return d;
  }
  s = await boardAndDrive('');
  check('58: the friends did their jobs on the way: Yonati opened the service gate, Avraham put the Shadow in the back', said('שער השירות פתוח! עכשיו רק תביאו את עצמכם!', 'יונתי') && said('הצל מאחור, קשור לספסל. מישהו רוצה לשבת לידו?', 'אברהם'));
  const left = clock.last;
  clock.push(left);
  const oneGo = (await fails()).slice(f0);
  check(`58: the escape played in ONE go against the real clock — no fail, the clock at each checkpoint ${clock.join(' → ')} s, ${left} s left at the end`, oneGo.length === 0 && clock.every((c, i) => c > 0 && (i === 0 || c <= clock[i - 1])), oneGo.join(' | '));
  check('58 step 5: its goal "הפיצוץ"', await objective(5, /הפיצוץ/, 10));
  await until(async () => (await S()).mission?.step === 6 || !!(await G(() => window.__x.m()?.wave)), 40, 'the wave');
  await step(0.4);
  await snap('x58-blast');
  s = await talkThrough((s) => s.mission?.step === 6, 60, 'the black');
  let end = await X('end58');
  check('58: the blast — the citadel destroyed, the car thrown onto its side', !!s && end.destroyed && Math.abs((end.lean ?? 0) - Math.PI / 2) < 0.05, JSON.stringify(end));
  check('58 step 6: its goal "לצאת מהרכב"', await objective(6, /לצאת מהרכב/));

  // ---------- a reload in the middle of the group: picked up at the last checkpoint (the yard), the clock on ----------
  const resume = await G(() => window.__game.debug.game.progress.resume);
  s = await reload();
  await helpers();
  s = await until((s) => s.mission?.id === 'zerohour' && s.mission.step === 4, 40, 'the pick-up');
  const after = s && { car: await car(), gang: await gang(), end: await X('end58'), pill: secs(s.pill) };
  check('58: a reload after the blast picks up at the last checkpoint (4: the yard) on a fresh page', resume?.id === 'zerohour' && resume?.checkpoint === 4 && !!s && !(await G(() => window.__session)), JSON.stringify(resume));
  check('58: ...the citadel standing again, the armoured car in its bay (not on its side), the Shadow tied (in its back), the clock running (≥ 110 s)', !!after && !after.end.destroyed && after.car.name === 'armoured' && Math.abs(after.car.lean ?? 0) < 0.05 && (after.end.shadow || after.end.shadowIn) && after.end.tied && after.pill >= 108, JSON.stringify(after && { car: after.car, end: after.end, pill: after.pill }));
  check('58: ...the whole gang there (eight, on foot), the friends at the car', !!after && after.gang.filter((f) => f.vis).length === 8, JSON.stringify(after?.gang.map((f) => [f.id, f.vis])));
  // ---------- its time-out, reached for real: the clock let run down in the yard ----------
  const t0 = Date.now();
  s = await until((s) => s.fail || s.mission?.step !== 4, after ? after.pill + 15 : 130, 'the clock running out', 1);
  const why = s?.fail ? await text('#failReason') : '';
  check(`58: the clock runs out for real (${after?.pill} s of game time stood in the yard, ${((Date.now() - t0) / 1000).toFixed(0)} s real): a fail with a reason and a tip`, !!s?.fail && /הזמן נגמר/.test(why) && /"/.test(why), why);
  await retry();
  s = await until((s) => s.mission?.step === 4 && !s.fail, 15, 'the retry');
  check('58: the retry starts the yard again with a fair clock (≥ 110 s)', !!s && secs(s.pill) >= 108, clean(s?.pill));
  await snap('x58-yard');
  await toCar();
  s = await boardAndDrive(' (again)');
  await until(async () => (await S()).mission?.step === 6 || !!(await G(() => window.__x.m()?.wave)), 40, 'the wave');
  s = await talkThrough((s) => s.mission?.step === 6, 60, 'the black');
  check('58: the blast again; step 6', !!s);
  check('58: "לצאת מהרכב"', await interact('לצאת מהרכב', 12));
  s = await talkThrough((s) => s.mission?.id !== 'zerohour' || heard.some((l) => l === `${E.weWon[0]}: ${E.weWon[1]}`), 120, 'the roll call');
  await step(0.6);
  await snap('x58-alive');
  s = await talkThrough((s) => s.mission?.id !== 'zerohour', 30, 'the hand-over');
  for (const k of ['calling', 'erezHere', 'idoSwear', 'allHere', 'all', 'weWon']) check(`58 the end: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
  check('58: Muller and the rest answer, a word each', ['מולר', 'יונתי', 'הדר', 'אברהם', 'דולב', 'ליאם'].every((who) => heard.some((l) => l.startsWith(`${who}: פה`))));
  check('58: Muller has sent the Shadow\'s position', said('שלחתי את המיקום שלו. יבואו לאסוף אותו.', 'מולר'));
  end = await X('end58');
  s = await until((s) => s.mission?.id === 'homeward', 20, 'mission 59');
  check('58 → 59: a live carry-on (no reload, no save placed): 59 begins, 58 saved as done', !!s && (await G(() => window.__game.debug.game.progress.done.includes('zerohour'))), s?.mission?.id);
  check('58 left everyone alive by the car, the Shadow tied beside it, the Renault given back', end.gang === 8 && end.shadow && end.tied && end.carName === 'renault', JSON.stringify(end));
}

// ===================================================== mission 59 =====================================================
{
  const H = L.homeward;
  const way = (u, off = 0) => G(({ u, off }) => window.__x.way(u, off), { u, off });
  const where = () => X('where');
  const scene = () => X('scene');
  const staged = (cp, max = 20) => until(async () => { const m = await ms(); return m?.id === 'homeward' && m.staged && m.cp === cp; }, max, `the scene at checkpoint ${cp}`);
  const walkTo = async (us, { stop = null } = {}) => { for (const u of us) { const q = await tp(await way(u)); if (q !== 'ok') return q; if (stop && (await stop())) return 'stopped'; } return 'ok'; };
  async function walkOff(cp) {
    const w = await where();
    await jump(await way(w.u, 60));
    const s = await until((s) => s.fail, 6, 'the fail');
    const why = s ? await text('#failReason') : '';
    check(`59 checkpoint ${cp}: walking off from the gang fails, with a reason and a tip`, !!s && /התרחקת מהחבורה/.test(why) && /ארז/.test(why), why);
    await retry();
    const ok = await staged(cp, 25);
    const w2 = await where(), sc = await scene();
    check(`59 checkpoint ${cp}: the retry stages it again (on the road, the gang with him, no markers)`, !!ok && w2.d < 4 && sc.gang === 8 && !sc.armed && sc.allies === 0, JSON.stringify({ w2, gang: sc.gang, armed: sc.armed }));
  }
  s = await staged(0, 40);
  let w = await where(), sc = await scene();
  check(`59: ${FROM <= 58 ? 'follows straight on from 58 and' : 'begins by itself from the save, and'} stages the walk after its own fade`, !!s);
  check('59 step 0: its goal "ללכת הביתה · לדבר עם החברים (0/3)"', await objective(0, /ללכת הביתה · לדבר עם החברים \(0\/3\)/));
  check('59: on the access road, some 250 m before the way in', Math.abs(w.u - 250) < 4 && w.d < 3, JSON.stringify(w));
  check('59: sunset; the normal world; Nehorai on foot, himself, bandaged', sc.preset === 'sunset' && !sc.dim && sc.as === 'nehorai' && sc.mode === 'foot' && sc.bandage, JSON.stringify(sc));
  check('59: the whole gang with him, nobody on an errand; no markers out, nobody to fight', sc.gang === 8 && sc.squad === 8 && sc.errands === 0 && !sc.armed && sc.allies === 0 && sc.guards === 0, JSON.stringify(sc));
  check('59: what the citadel left put away — no Shadow, no armoured wreck, no siren; the Renault home', !sc.shadow && !sc.armoured && !sc.alarm && sc.car === 'renault' && sc.carHome < 3, JSON.stringify(sc));
  check('59: the people of Katzir already at the way in (quiet), the three signs painted', sc.crowd && sc.crowd.size >= 60 && sc.crowd.level === 0 && JSON.stringify(sc.crowd.painted) === JSON.stringify(SIGNS) && sc.crowd.holders >= 9, JSON.stringify(sc.crowd));
  await step(0.3);
  check('59: the arrow points at a friend to talk to', await G(() => { const g = window.__game.debug.game, tg = g.target; return !!tg && ['ido', 'erez', 'muller'].some((id) => Math.hypot(g.npc(id).pos.x - tg.x, g.npc(id).pos.z - tg.z) < 0.5); }));
  await snap('x59-road');
  await walkOff(0);
  // the pit beside the road (the way goes round it): a fail with Muller's tip
  await jump(await G(() => { const q = window.__game.debug.game.world.places.quarry; return { x: q.x + 2, z: q.z + 8, y: q.y }; }));
  s = await until((s) => s.fail, 6, 'the pit');
  const pit = s ? await text('#failReason') : '';
  check('59: down in the old quarry\'s pit — a fail with a reason and Muller\'s tip', !!s && /המחצבה הישנה/.test(pit) && /מולר/.test(pit), pit);
  await retry();
  check('59: the retry — back at the start of the walk', !!(await staged(0, 25)) && Math.abs((await where()).u - 250) < 3);
  // the talks: whoever is nearest first, with the real button
  const order = [];
  for (let k = 0; k < 3; k++) {
    let ok = await interact(/^לדבר עם /, 6);
    if (!ok) {
      const rest = ['ido', 'erez', 'muller'].filter((id) => !order.includes(id));
      const near = await G((ids) => ids.map((id) => window.__x.near(id)), rest);
      await tp(await X('pos', rest[near.indexOf(Math.min(...near))]), 0, 0, null, { near: 1.5 });
      ok = await interact(/^לדבר עם /, 6);
    }
    const before = (await ms()).heard;
    s = await talkThrough(async () => (await ms()).heard.length > before.length, 30, `talk ${k + 1}`);
    const who = (await ms()).heard.find((id) => !before.includes(id));
    order.push(who);
    check(`59 talk ${k + 1}: "לדבר עם …" pressed, ${who} talked to; the goal counts it`, ok && !!s && !!who && new RegExp(`\\(${k + 1}/3\\)|אל הכניסה לקציר`).test((await S()).objective), (await S()).objective);
  }
  for (const k of ['idoDone', 'erezHome', 'mullerPortal', 'iWasThere']) check(`59 the way home: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
  check('59: everybody laughs', said('כולם צוחקים.'));
  check('59: step 0 now says "ללכת הביתה · אל הכניסה לקציר"', /אל הכניסה לקציר/.test((await S()).objective), (await S()).objective);
  r = await walkTo([228, 205, 182, 160, 140, 120, 100, 86], { stop: async () => (await S()).mission?.step !== 0 });
  check(`59: walked home along the road with the stick (${r})`, r === 'ok' || r === 'a scene', r);
  s = await talkThrough((s) => s.mission?.step === 1 || s.cutscene, 40, 'the noise ahead');
  if (!s) { await tp(await way(86)); await talkThrough((s) => s.mission?.step === 1 || s.cutscene, 30, 'the noise ahead'); }
  check('59: Erez shows the way round the old quarry', said('שם הכביש שבור, ליד המחצבה הישנה. עוקפים משמאל, על העשב.', 'ארז'));
  for (const [who, re] of [['יונתי', /צילמתי/], ['אברהם', /נואם/], ['דולב', /לקנות לחם/], ['הדר', /פנסיה/], ['ליאם', /הגלידה עליי/]]) check(`59 on the way: ${who} has his word`, heard.some((l) => l.startsWith(`${who}: `) && re.test(l)));
  check('59 step 1: its goal "רעש מלפנים", near the way in', (await objective(1, /רעש מלפנים/, 3)) && (await where()).u <= 92, JSON.stringify(await where()));
  s = await talkThrough(async (s) => s.mission?.step !== 1 || ((await X('cam'))?.t ?? 0) > 2.6, 40, 'the camera rising');
  await snap('x59-crowd');
  sc = await scene();
  check('59: the people of Katzir clapping, the signs up, exactly the spec\'s signs', sc.crowd && sc.crowd.level >= 0.5 && sc.crowd.size >= 60 && JSON.stringify(sc.crowd.signs) === JSON.stringify(SIGNS) && JSON.stringify(sc.crowd.painted) === JSON.stringify(SIGNS), JSON.stringify(sc.crowd));
  s = await talkThrough((s) => s.mission?.step === 2, 40, 'step 2');
  for (const k of ['noise', 'erezLook']) check(`59 the noise: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
  check('59 step 2: its goal "ללכת בין האנשים"', await objective(2, /ללכת בין האנשים/));
  check('59 step 2 is a checkpoint (saved)', (await G(() => window.__game.debug.game.progress.resume))?.checkpoint === 2);
  await tp(await way(62));
  await walkOff(2);
  r = await walkTo([56, 40, 26, 12, 0, -12, -24]);
  check(`59: through the cheering lane with the stick (${r})`, r === 'ok', r);
  await snap('x59-lane');
  await tp(await way(-37));
  s = await talkThrough((s) => s.mission?.step === 3, 30, 'the end of the lane');
  check('59 step 3: the last moment begins at the end of the lane ("הרגע האחרון")', !!s && /הרגע האחרון/.test((await S()).objective), (await S()).objective);
  for (const k of ['idoFamous', 'allHere']) check(`59 the lane: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
  s = await talkThrough(async (s) => s.mission?.step !== 3 || (heard.some((l) => l === `${H.together[0]}: ${H.together[1]}`) && ((await X('cam'))?.t ?? 0) > 4.5), 60, 'the pull-away');
  await snap('x59-last');
  const ring = await G((ids) => { const g = window.__game.debug.game, p = g.player.pos; return ids.map((id) => Math.hypot(g.npc(id).pos.x - p.x, g.npc(id).pos.z - p.z)); }, TEAM);
  check('59: the gang together round Nehorai before the crowd', ring.every((d) => d < 5.5), JSON.stringify(ring.map((d) => d.toFixed(1))));
  for (const k of ['bestThing', 'erezWhat', 'notWon', 'together']) check(`59 the last moment: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
  check('59: the sun going down', await G(() => (window.__game.debug.game.daylight.target ?? 0) > 0.3));

  // ---------- the end: the cards, the credits, the thanks; the start screen; the free roam ----------
  s = await until((s) => s.mission?.step === 4 || s.mission == null, 30, 'black');
  check('59 step 4: its goal "סוף"', !!s && (s.mission == null || /סוף/.test(s.objective)), s?.objective);
  await G(() => { window.__game.finale.ENDING.speed = 8; });
  check('59: the game is saved as finished before the cards', await G((k) => window.__game.debug.game.progress.finished === true && JSON.parse(localStorage.getItem(k) || 'null')?.finished === true, KEY));
  await page.waitForFunction((c) => window.__game.finale.ENDING.log.includes(c), CARDS.legends, { timeout: 240000 });
  let EN = await X('ending');
  const iN = EN.log.indexOf(CARDS.nahorai), iE = EN.log.indexOf(CARDS.theEnd), iL = EN.log.indexOf(CARDS.legends);
  check(`59: the cards on black, in order: "${CARDS.nahorai}", "${CARDS.theEnd}", "${CARDS.legends}"`, iN >= 0 && iE > iN && iL > iE, JSON.stringify(EN.log));
  await page.waitForFunction(() => window.__game.finale.ENDING.log.some((l) => /^moment:/.test(l)), null, { timeout: 240000 });
  await snap('x59-credits');
  await G(() => { window.__game.finale.ENDING.speed = 14; });
  await page.waitForFunction(() => window.__game.finale.ENDING.phase === 'thanks', null, { timeout: 600000 });
  EN = await X('ending');
  check('59: the credits — live moments of the chapters, the cast, then the thanks', EN.log.filter((l) => /^moment:/.test(l)).length >= 5 && EN.log.includes('cast') && EN.log.at(-1) === CARDS.thanks && !EN.skipped, JSON.stringify(EN.log));
  check(`59: "${CARDS.thanks}" on the screen`, (await text('.ending-thanks-text')) === CARDS.thanks, await text('.ending-thanks-text'));
  s = await until((s) => s.mission == null, 20, 'the mission completing behind the thanks');
  const prog = await G((k) => { const p = window.__game.debug.game.progress, sv = JSON.parse(localStorage.getItem(k) || 'null'); return { done: p.done.includes('homeward'), unl: p.unlocks.includes('chapter-10'), fin: p.finished, saved: sv?.finished === true && sv.done.includes('homeward') && sv.unlocks.includes('chapter-10'), resume: p.resume }; }, KEY);
  check('59: completes behind the thanks — done, chapter-10 unlocked, the finished mark saved', !!s && prog.done && prog.unl && prog.fin && prog.saved && !prog.resume, JSON.stringify(prog));
  await step(4);
  check('59: no mission begins after it', (await S()).mission == null, JSON.stringify((await S()).mission));
  await snap('x59-thanks', { black: true });
  await page.waitForSelector('.ending-menu:not([hidden])', { timeout: 120000 });
  check('the button back to the main menu', (await text('.ending-menu')) === 'חזרה לתפריט הראשי', await text('.ending-menu'));
  await page.tap('.ending-menu');
  await page.waitForFunction(() => !document.getElementById('startScreen').hidden && !document.getElementById('ending'), null, { timeout: 30000 });
  check('the start screen shows the game finished', /המשחק הושלם/.test((await text('#finishedLine')) || ''), await text('#finishedLine'));
  sc = await G(() => { const g = window.__game.debug.game; return { crowd: !!g.scene.getObjectByName('crowd'), squad: g.squad.active, bandage: !!g.nehorai.bones?.head?.getObjectByName('bandage'), preset: g.daylight?.presetName ?? null, night: g.daylight?.target ?? 0 }; });
  check('the ending gone: the crowd let go, the gang off duty, the bandage off, the light of the day back', !sc.crowd && !sc.squad && !sc.bandage && !sc.preset && sc.night === 0, JSON.stringify(sc));
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state?.started && document.getElementById('startScreen').hidden, null, { timeout: 30000 });
  await holdLoop(true);
  await step(4);
  s = await S();
  check('"continue" opens the free roam: on foot, no mission running', s.mission == null && s.mode === 'foot' && !s.cutscene, JSON.stringify({ m: s.mission, mode: s.mode, cut: s.cutscene }));
  await snap('x-freeroam');
}

check('fails seen since the last page load (each forced or reached on purpose)', true, (await fails()).join(' | '));
await t.finish();
