// Chapter nine, mission 10, "ההסתערות על המגדל השחור". Up from the facility to the Black Order's tower, floor by
// floor, each with its own job: the plaza's gate (Erez's charge, the warning, the blast), the plaza and its cars
// (the Order's people behind them, jerrycans that go up), Dolev running in after one of them; the lobby, where the
// shutter comes down and four of them come at the gang with bare hands (fists, by the rules: no paint on a man
// without a marker); the security floor, where the alarm keeps calling more of them until it is turned off (and
// the lockdown downstairs lifts), the monitors that show Dolev shut in on the storage floor, and the card to the
// command room in the security office; the server floor, its emergency gate shut, Ido breaking into server room C
// while the player keeps the Order off him, and the terminal inside that opens the gate; the storage floor, its
// guards, and Dolev's door forced open; the stairs above on fire, the elevator (two of them inside); the command
// floor's corridors and the card reader — the door stays shut, and a helicopter is coming for the Shadow; the roof,
// its guards and the landing lights shot out, the helicopter turning away; and back down to the door, which opens.
// Blasts always warn first; paint, never blood. The whole gang stays loyal; every threat is the Black Order's.
// Invented, all of it.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { TEAM, Work, Job, failOut, handsOver, endCrew } from './phoenix.js';
import {
  TW, FAC, T, ORDER, ids, onFloor, hush, armed, gangAt, freshMarks, wipeOff, stay, unarm, rearm, post, offBoard, standing,
  nearestOf, TBlast, fuelCan, towerRed, beats, later, talkOn, blackout, bandage, clearAll, towerReset,
} from './phoenix-d.js';
import * as THREE from 'three';

const W = (list) => list.map(([id, key]) => ({ id, key }));
const PLAZA = W([['og1', 'gate'], ['og2', 'booth'], ['og3', 'plazaW'], ['og4', 'plazaMid'], ['og5', 'cars'], ['og6', 'plazaE'], ['og7', 'entrance'], ['og8', 'southFence']]);
const BRAWL = ['og9', 'og10', 'og11', 'og12'];
const F1 = W([['og13', 'f1hall'], ['og14', 'f1monitor'], ['og15', 'f1alarm'], ['og16', 'f1lockers']]);
const F1MORE = ['og2', 'og3'];          // what the alarm calls up, one at a time while it rings
const OFFICE = W([['og1', 'f1office']]);
const F2 = W([['og3', 'f2hall'], ['og4', 'f2corr'], ['og5', 'f2A']]);
const BREACH = ['og6', 'og7', 'og8', 'og9'];    // two waves of two, from the south end and rooms B and D
const F3 = W([['og10', 'f3hall'], ['og11', 'f3aisle'], ['og12', 'f3west'], ['og13', 'f3east'], ['og14', 'f3trap']]);
const LIFT = ['og15', 'og16'];
const F4 = W([['og1', 'f4hall'], ['og2', 'f4guard'], ['og3', 'f4archive'], ['og4', 'f4ante']]);
const ROOF = W([['og5', 'roofE'], ['og6', 'roofW'], ['og7', 'roofPad'], ['og8', 'roofDeck']]);
const routes = (game, list) => list.map((g) => ({ id: g.id, at: TW(game).patrols[g.key] }));
const BREACH_TIME = 14;
const IDO_OUT = 3;

const INTRO = [['עידו', 'זה המגדל השחור. המסדר כולו שם למעלה.'], ['ארז', 'רחבה, לובי, ועוד ארבע קומות עד חדר הפיקוד. ואז הגג.'], ['נהוראי', 'אז עולים קומה אחרי קומה. ביחד.']];
const GATE = [['ארז', 'השער נעול. אני שם מטען על המנעול — תחפו עליי.']];
const BACK = [['ארז', 'מטען מוכן! כולם אחורה!']];
const BOOM = [['עידו', 'השער פתוח! הם יוצאים מאחורי המכוניות!'], ['מולר', 'ג׳ריקנים אדומים על המכוניות. שתי יריות וזה עולה באוויר.']];
const DOLEV_RUN = [['דולב', 'אחד בורח לתוך המגדל! אני אחריו!'], ['ארז', 'דולב! חכה לנו!']];
const LOBBY_IN = [['עידו', 'דולב? דולב!'], ['ארז', 'הוא לא עונה.']];
const SHUTTER = [['קול ברמקול', 'נעילה כללית. כל הדלתות ננעלות.']];
const AMBUSH = [['ארז', 'הם בלי מרקרים!'], ['עידו', 'ולפי החוקים, לא יורים במי שאין לו מרקר.'], ['נהוראי', 'אז בידיים. ארז, עידו — איתי.']];
const BRAWL_WON = [['ארז', 'התריס לא זז. הנעילה מחוברת לאזעקה, בקומת האבטחה.'], ['נהוראי', 'אז למעלה. במדרגות המזרחיות.']];
const FLOOR1 = [['עידו', 'האזעקה! כל עוד היא פועלת, עוד ועוד מהם יגיעו!'], ['ארז', 'הלוח בחדר הבקרה, בצד המזרחי.']];
const ALARM_OFF = [['עידו', 'האזעקה כבויה. והתריס בלובי עלה.']];
const MONITORS = [['עידו', 'רגע… מצלמה שבע. זה דולב! סגור במחסן, בקומה השלישית.'], ['ארז', 'אז אנחנו באים אליו. אף אחד לא נשאר מאחור.'], ['עידו', 'וחדר הפיקוד נפתח רק בכרטיס. יש אחד במשרד הביטחון, מעבר לקיר.']];
const CARD = [['נהוראי', 'יש כרטיס. עכשיו לקומת השרתים, במדרגות המערביות.']];
const FLOOR2 = [['עידו', 'שער החירום סגור. הבקרה שלו בחדר השרתים C.'], ['עידו', 'אני פורץ את הדלת. תחזיקו אותם רחוק ממני!']];
const BREACH_GO = [['עידו', 'מתחיל! ארבע־עשרה שניות!']];
const WAVE = [['ארז', 'עוד מהם! מהקצה הדרומי של המסדרון!']];
const BREACHED = [['עידו', 'פתוח! הטרמינל בפנים — תפתח את השער.']];
const GATE_OPEN = [['ארז', 'השער נפתח. המדרגות המזרחיות, לקומת המחסנים.']];
const FLOOR3 = [['דולב', 'אחים! אני פה! במחסן בפינה!'], ['ארז', 'מחזיק מעמד, דולב! אנחנו באים!']];
const DOLEV = [['דולב', 'למה זה תמיד אני?!'], ['נהוראי', 'כי אתה תמיד רץ ראשון, אחי.'], ['דולב', 'נכון. מעכשיו אני רץ אחרון.']];
const FIRE = [['ארז', 'המדרגות לקומת הפיקוד בוערות!'], ['עידו', 'המעלית! באמצע המסדרון הצפוני!']];
const LIFT_IN = [['ליאם', 'אחים, יש בפנים אורחים!']];
const LIFT_UP = [['עידו', 'קומה ארבע. חדר הפיקוד.']];
const FLOOR4 = [['ארז', 'מסדרונות. אחד בכל פינה. לאט ובשקט.']];
const READER = [['נהוראי', 'הכרטיס עובד… והדלת לא זזה.'], ['הצל', 'כרטיס יפה, נהוראי. אבל הדלת הזאת נפתחת רק כשאני רוצה.', 'phone'], ['עידו', 'שומעים? מסוק. הוא מתכונן לברוח דרך הגג!'], ['ארז', 'אז ניקח לו את הגג.']];
const ROOFTOP = [['עידו', 'האורות של מנחת המסוקים! בלי אורות הוא לא יכול לנחות!']];
const NO_HELI = [['ארז', 'הוא מסתובב… הוא עף מפה!'], ['נהוראי', 'אין לך יותר מסוק, צל.'], ['עידו', 'עכשיו הוא תקוע בחדר הפיקוד. למטה!']];
const OPENS = [['הצל', 'אז בוא, נהוראי. אני מחכה לך.', 'phone']];
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "מההתחלה, אחי. מאחורי המכוניות והעמודים, ולא באמצע."';
const BRAWL_LOST = 'השומרים בלובי הפילו אותך. עידו: "שוב, אחי. לחסום כשהם מתנופפים, דחיפה לעצור אותם, ומכה חזקה כשהם פתוחים."';
const IDO_LOST = 'עידו סומן שלוש פעמים והפריצה נכשלה. ארז: "מההתחלה. הפעם מסמנים אותם לפני שהם מגיעים אליו."';
const NO_GANG = TEAM.filter((id) => id !== 'dolev');

// ---------- the tower as the story has it at each checkpoint ----------
function doors(game, cp) {
  const t = TW(game);
  t.gate.setVisible(true);
  if (cp <= 1) t.gate.lock(); else { t.gate.unlock(); t.gate.setOpen(true); t.gate.setVisible(false); } // blown out of its rails
  t.exitGate.lock();
  if (cp === 4) t.lobby.door.lock(); else { t.lobby.door.unlock(); t.lobby.door.setOpen(true); } // the lockdown: from the brawl until the alarm is off
  for (const d of [t.security.monitorDoor, t.security.alarmDoor]) { d.unlock(); d.setOpen(true); }
  t.alarm.set(cp <= 4);
  if (cp === 6 || cp === 7) t.escape.gate.lock(); else { t.escape.gate.unlock(); t.escape.gate.setOpen(true); }
  if (cp >= 7) { t.breach.door.unlock(); t.breach.door.setOpen(true); } else t.breach.door.lock();
  if (cp >= 9) { t.trapped.door.unlock(); t.trapped.door.setOpen(true); } else t.trapped.door.lock();
  t.command.door.lock(); t.command.reader.set(cp >= 11); t.command.escapeDoor.lock();
  t.elevator.closeAll();
  if (cp >= 6) t.card.take(); else t.card.reset();
  t.escape.mark(false);
  t.security.screen.show('cams'); t.command.screen.show('map');
  for (const v of t.cars) v.reset();
}
// where each checkpoint begins (where the step before it left the player)
function startAt(game, cp) {
  const t = TW(game);
  return [
    { ...FAC(game).exit.outside, yaw: Math.PI / 2 }, t.approach, t.gateOutside, T(game, 0, 30, 0, Math.PI),
    { ...t.stairs[0].foot, yaw: Math.PI }, { ...t.alarmAt, yaw: -Math.PI / 2 }, { ...t.card.pickAt, yaw: Math.PI }, { ...t.breach.cover, yaw: 0 },
    { ...T(game, 15.6, -13.6, 3), yaw: -Math.PI / 2 }, { ...t.trapped.at, yaw: Math.PI }, { ...t.elevator.front[4], yaw: 0 }, { ...t.command.readerAt, yaw: Math.PI },
    { ...T(game, 6, 2, 5), yaw: Math.PI },
  ][cp];
}
// Dolev: with the gang until he runs into the lobby (step 3), shut in the storage floor's store room until he is
// let out (step 8)
const dolevGone = (cp) => cp >= 3 && cp <= 8;
function dolevShut(game) {
  const t = TW(game), n = game.npc('dolev');
  game.paint.removeAlly(n);
  game.squad.ids = game.squad.ids.filter((id) => id !== 'dolev'); game.squad.tasks.delete('dolev'); game.squad.refresh(true);
  n.target = null; n.idle = 'arms'; n.posed = false; n.floorY = null; n.face = null;
  n.place(t.trapped.inside.x, t.trapped.inside.z, Math.PI, t.trapped.inside.y); n.model.setPose(null); n.show(true);
}
function fireBlock(m, game) {
  const p = T(game, -18.5, -3.2, 3);
  (m.blocks ||= []).push(game.world.cols.addBox(p.x, p.z, 1.4, 1.0, 0, p.y - 0.3, p.y + 2.6));
  (m.smoke ||= []).push(game.fx.burn(p.x, p.y + 0.05, p.z, { r: 1.1, strength: 1.4, seconds: 1800 }), game.fx.smokeColumn(p.x - 0.4, p.y + 0.4, p.z + 0.6, { r: 0.8, seconds: 1800 }));
}
function stage(m, game, cp) {
  clearAll(m, game);
  const t = TW(game);
  game.daylight?.set(1, 0);
  doors(game, cp);
  game.paint.dispose(); offBoard(game, ORDER); offBoard(game, ['shadow']);
  const who = dolevGone(cp) ? NO_GANG : TEAM;
  gangAt(game, startAt(game, cp), { ids: who });
  if (dolevGone(cp)) dolevShut(game);
  bandage(game.nehorai, true);
  if (cp >= 9) fireBlock(m, game);
  if (cp === 4) { towerRed(game, 1); m.stopSiren = game.sound?.siren?.(600) || null; }
  if (cp === 11) heliOrbit(m, game);
  game.sound?.music?.(cp >= 2 ? 'action' : null, { fade: 0.4 });
  m.s = { cp, posted: false };
  void t;
}

// ---------- the helicopter that comes for the Shadow, and the roof's landing lights ----------
function heliOrbit(m, game) {
  const t = TW(game);
  if (!m.heli) { m.heli = new game.Heli(game); game.helis.push(m.heli); }
  m.heli.orbit(t.x, t.z, { r: 36, h: 46, speed: 0.22 });
}
const beaconGeo = new THREE.BoxGeometry(0.42, 0.3, 0.42), postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8);
function landingLights(m, game) {
  const t = TW(game), pad = t.roof.helipad, R = t.roof.padR + 0.9;
  m.lights = [];
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const x = pad.x + dx * R, z = pad.z + dz * R, y = t.floorY(5);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffb02e', emissive: '#ffb02e', emissiveIntensity: 2.2 });
    const g = new THREE.Group(); g.position.set(x, y, z);
    const p = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color: '#2a2d33' })); p.position.y = 0.2; g.add(p);
    const b = new THREE.Mesh(beaconGeo, mat); b.position.y = 0.55; g.add(b);
    game.scene.add(g);
    const L = { g, mat, done: false };
    L.prop = game.paint.addProp({ x, y: y + 0.55, z, r: 0.34, hits: 1, label: 'אור נחיתה', onHit: () => { L.done = true; mat.emissiveIntensity = 0; mat.color.set('#3a2a14'); game.fx.sparks(x, y + 0.6, z, 14); } });
    m.lights.push(L);
  }
}
function clearLights(m, game) { for (const L of m.lights || []) { game.paint.removeProp(L.prop); L.g.removeFromParent(); L.g.traverse((o) => { if (o.isMesh) o.material.dispose(); }); } m.lights = []; }

// the lobby's brawl: four of the Order without markers, Erez and Ido at Nehorai's side, the rest at the door
function brawlSpots(game) { return [T(game, -5.5, 0.5, 0, 0), T(game, 5.5, 0.5, 0, 0), T(game, -8, 6, 0, 0), T(game, 8, 6, 0, 0)]; }
function startBrawl(m, game) {
  const sp = brawlSpots(game);
  game.paint.disarmPlayer(); unarm(game, 'erez'); unarm(game, 'ido');
  // Nehorai a few steps into the lobby (the camera behind him clear of the shutter), Erez and Ido either side
  const me = T(game, 0, 11.5, 0); game.player.place(me.x, me.z, Math.PI, me.y); game.follow.snapBehind(Math.PI);
  for (const [id, dx] of [['erez', -1.8], ['ido', 1.8]]) { const n = game.npc(id); n.target = null; n.place(me.x + dx, me.z + 0.6, Math.PI, me.y); }
  const opp = BRAWL.map((id, i) => { const n = game.npc(id); n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null); n.place(sp[i].x, sp[i].z, Math.PI, sp[i].y); n.show(true); return n; });
  for (const id of ['erez', 'ido']) { const n = game.npc(id); game.squad.send(id, { x: n.pos.x, z: n.pos.z }, { label: 'בקרב' }); n.target = null; }
  m.fight = new Fight(game, {
    opponents: [
      { npc: opp[0], hp: 60, power: 0.85, aggression: 1.0, moves: ['jab', 'cross', 'swing'], name: 'שומר' },
      { npc: opp[1], hp: 70, power: 0.9, guard: 0.5, moves: ['cross', 'swing'], name: 'שומר' },
      { npc: opp[2], hp: 60, power: 0.85, moves: ['jab', 'swing'], name: 'שומר' },
      { npc: opp[3], hp: 75, power: 0.95, aggression: 1.05, moves: ['swing', 'cross', 'swing'], name: 'שומר' },
    ],
    allies: [{ npc: game.npc('erez'), hp: 90, power: 0.8 }, { npc: game.npc('ido'), hp: 90, power: 0.8 }],
    maxAttackers: 2,
    onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; },
  });
  game.hud.banner('FIST COMBAT', 'בלי מרקרים', 'אגרוף · מכה חזקה · דחיפה · חסימה · התחמקות', 2600);
}
function endBrawl(m, game) {
  m.fight?.dispose(); m.fight = null;
  for (const id of ['erez', 'ido']) game.squad.release(id);
  armed(game, game.squad.ids); rearm(game, 'erez'); rearm(game, 'ido');
}

// Ido at server room C's door while the Order comes up the corridor: his job stops while he wipes off a mark
function idoMarked(game) { return game.paint.allies.find((a) => a.npc === game.npc('ido'))?.marked; }
function idoUp(game) { const a = game.paint.allies.find((q) => q.npc === game.npc('ido')); if (!a) return; a.marked = false; a.gun.visible = true; a.npc.model.setPose(null); }

export default {
  id: 'blacktower', chapter: 9, number: 10, title: 'ההסתערות על המגדל השחור', requires: ['comeback'], follows: true,
  where: 'ברחבת המגדל',
  startAt: (game) => { const X = FAC(game)?.exit?.outside; return X ? { x: X.x, z: X.z, y: X.y } : null; },
  reward: { money: 1500, unlocks: ['blacktower'], text: 'המגדל נכבש קומה אחרי קומה · 1,500 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.beams = []; m.smoke = []; m.talk = []; m.blocks = []; m.cans = []; game.overlay?.mapHidden(false); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const p = FAC(game).exit.outside; game.player.place(p.x, p.z, Math.PI / 2, p.y); game.follow.snapBehind(Math.PI / 2); },
  failIf(m, game) {
    if (m.s.idoMarks >= IDO_OUT) return IDO_LOST;
    return failOut(m, game, [2, 4, 5, 6, 7, 8, 9, 10, 11]) ? LOST : null;
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live || []) x.update(dt);
    wipeOff(m, game, dt);
  },
  cleanup(m, game) {
    clearLights(m, game);
    clearAll(m, game);
    for (const id of BRAWL) { const n = game.npc(id); n.model.setPose(null); }
    if (m.done && handsOver(game)) { // at the command room's door, armed, the gang with him: the Shadow's mission takes it from here
      game.paint.dispose(); offBoard(game, ORDER); armed(game, game.squad.ids);
      return;
    }
    game.paint.dispose(); offBoard(game, ORDER);
    towerReset(game);
    game.npc('dolev').idle = null;
    bandage(game.nehorai, false);
    endCrew(game);
  },

  steps: [
    { // 0: out of the ground by the tower's plaza; the tower over them
      objective: 'המגדל השחור',
      enter(m, game) {
        const t = TW(game), X = FAC(game).exit.outside;
        stage(m, game, 0);
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: X.x + 4, y: X.y + 1.6, z: X.z + 6 }, { x: t.x, y: t.y + 30, z: t.z }, 9999);
        game.hud.banner('המגדל השחור', 'ההסתערות', 'רחבה · לובי · ארבע קומות · גג', 3200);
        game.sound?.music?.('calm', { fade: 1 });
        m.beats = beats(game, [['wait', 1.2], ['say', INTRO], ['wait', 0.3]]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the plaza's gate: Erez's charge, back, the blast
      objective: 'השער של הרחבה · ארז שם מטען', checkpoint: true,
      enter(m, game) {
        const t = TW(game), at = { x: t.gateOutside.x + 1.6, z: t.gateOutside.z + 1.4, yaw: Math.PI / 2 };
        m.s.phase = 'job';
        later(m, GATE);
        m.job = new Job(game, { who: 'erez', at, seconds: 4, near: 16, pill: 'ארז מצמיד מטען לשער', onDone: () => {
          m.job = null; m.s.phase = 'back'; game.dialogue.play(BACK);
          const g = { x: t.gateOutside.x + 4, z: t.gateOutside.z, y: t.y };
          m.s.blast = new TBlast(game, { at: g, size: 2.6, warn: 3.2, radius: 6, fire: 25, flash: true, debris: true, onBoom: () => {
            t.gate.unlock(); t.gate.setOpen(true); t.gate.setVisible(false);
            m.s.phase = 'open'; game.follow.shake(1.0); game.sound?.music?.('action', { fade: 0.6 });
          } });
          m.live.push(m.s.blast);
        } });
      },
      target(m, game) {
        const t = TW(game);
        if (m.s.phase === 'job') return { ...t.gateOutside, r: 3 };
        if (m.s.phase === 'back') return { ...t.approach, r: 2.4 }; // out of the ring
        return null;
      },
      update(m, game, dt) {
        m.job?.update(dt);
        say(m, game, m.s.phase === 'job' ? 'השער · לחפות על ארז בזמן שהוא מצמיד מטען' : m.s.phase === 'back' ? 'אחורה! מחוץ לטבעת האדומה' : 'השער פרוץ');
        return m.s.phase === 'open' ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 2: the plaza: the Order behind its cars
      objective: 'הרחבה · לסמן את אנשי המסדר', checkpoint: true,
      enter(m, game) {
        const t = TW(game);
        freshMarks(game);
        post(game, routes(game, PLAZA));
        later(m, BOOM);
        m.cans = [0, 2, 4].map((i) => fuelCan(m, game, t.cars[i]));
        m.s.boomT = 9;
      },
      target: (m, game) => nearestOf(game, ids(PLAZA)) || { ...TW(game).lobby.outside, r: 2 },
      update(m, game, dt) {
        const t = TW(game), me = game.player.pos, n = standing(game, ids(PLAZA));
        // now and then one of the Order's charges by the cars: a ring, the beeps, then the blast
        if (m.t > m.s.boomT && n) { m.s.boomT = m.t + 12 + Math.random() * 6; const a = Math.random() * Math.PI * 2, p = { x: me.x + Math.cos(a) * 11, y: t.y, z: me.z + Math.sin(a) * 11 }; if (t.onPlaza(p.x, p.z)) m.live.push(new TBlast(game, { at: p, size: 1.6, warn: 1.8, radius: 3.2, fire: 12, debris: true })); }
        say(m, game, n ? `הרחבה: לסמן אותם (${PLAZA.length - n}/${PLAZA.length}) · הג׳ריקנים על המכוניות · סומנת ${game.paint.hits}/3` : 'הרחבה נקייה');
        return n === 0 ? 'next' : null;
      },
    },
    { // 3: Dolev runs in after one of them; the lobby, the shutter, four of them with bare hands
      objective: 'הלובי · אחרי דולב', checkpoint: true,
      enter(m, game) {
        const t = TW(game);
        m.s.phase = 'walk';
        if (m.s.cp !== 3 && game.npc('dolev').visible && game.squad.ids.includes('dolev')) {
          // he runs for the door and is gone inside
          const n = game.npc('dolev');
          game.squad.send('dolev', t.lobby.inside, { label: 'רץ פנימה', onArrive: () => { dolevShut(game); } });
          n.walkTo(t.lobby.inside.x, t.lobby.inside.z, { run: true, near: 1.2, onArrive: () => dolevShut(game) });
          m.s.dolevT = 0;
          game.dialogue.play(DOLEV_RUN);
        } else dolevShut(game);
        for (const id of BRAWL) { const n = game.npc(id); n.show(false); }
      },
      target(m, game) { const t = TW(game); return m.s.phase === 'walk' ? { ...t.lobby.inside, r: 2 } : null; },
      update(m, game, dt) {
        const t = TW(game), me = game.player.pos;
        m.beats?.update(dt);
        // Dolev never lingers on the plaza: he is in the tower before the gang is
        if (m.s.dolevT != null) { m.s.dolevT += dt; if (m.s.dolevT > 9 && game.squad.ids.includes('dolev')) dolevShut(game); }
        if (m.s.phase === 'walk') {
          say(m, game, 'הלובי · דולב רץ פנימה');
          if (t.inTower(me.x, me.z) && me.z < t.lobby.door.pos.z - 1.2 && onFloor(game, 0)) {
            m.s.phase = 'shut';
            if (game.squad.ids.includes('dolev')) dolevShut(game);
            // the gang in behind him, and the shutter comes down
            game.cutscene = true; game.hud.setCinematic(true);
            const door = t.lobby.door.pos;
            game.player.place(me.x, Math.min(me.z, door.z - 3), Math.PI, t.y);
            game.squad.ids.forEach((id, i) => { const n = game.npc(id); n.target = null; n.place(door.x - 4 + (i % 4) * 2.6, door.z - 2.2 - Math.floor(i / 4) * 1.6, Math.PI, t.y); });
            game.follow.shot({ x: door.x + 5, y: t.y + 2.2, z: door.z - 8 }, { x: door.x, y: t.y + 2, z: door.z }, 9999);
            m.beats = beats(game, [
              ['say', LOBBY_IN],
              ['do', () => { t.lobby.door.lock(); game.sound?.hit?.('crash', 1); game.follow.shake(0.5); towerRed(game, 0); m.stopSiren = game.sound?.siren?.(4) || null; }],
              ['say', SHUTTER],
              ['do', () => {
                const sp = brawlSpots(game);
                BRAWL.forEach((id, i) => { const n = game.npc(id); n.floorY = null; n.target = null; n.idle = null; n.model.setPose(null); n.place(sp[i].x, sp[i].z, Math.PI, t.y); n.show(true); });
                game.follow.shot({ x: me.x + 3, y: t.y + 2.4, z: me.z + 4 }, { x: t.x, y: t.y + 1.2, z: t.z + 3 }, 9999);
              }],
              ['say', AMBUSH],
            ]);
          }
        }
        if (m.s.phase === 'shut' && m.beats?.done) {
          m.s.phase = 'fight'; m.beats = null;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(Math.PI);
          // the rest of the gang at the door, cheering them on
          const door = t.lobby.door.pos;
          game.squad.ids.filter((id) => id !== 'erez' && id !== 'ido').forEach((id, i) => { const n = stay(game, id, { x: door.x - 5 + i * 2, z: door.z - 1.6, y: t.y, yaw: Math.PI }, { label: 'בדלת' }); n.idle = 'cheer'; });
          startBrawl(m, game);
        }
        if (m.s.phase === 'fight') {
          say(m, game, m.s.won ? 'הלובי נקי' : 'FIST COMBAT · ארבעה בלי מרקרים · ארז ועידו איתך');
          if (m.s.lost) return `fail:${BRAWL_LOST}`;
          if (m.s.won) return 'next';
        }
        return null;
      },
      exit(m, game) {
        m.beats?.cancel(); m.beats = null;
        endBrawl(m, game);
        for (const id of TEAM) { const n = game.npc(id); if (n.idle === 'cheer') { n.idle = null; n.model.setPose(null); } game.squad.tasks.delete(id); }
        game.squad.refresh(true);
        game.fx.redAlert(false, { id: 'tower-0' });
        later(m, BRAWL_WON);
      },
    },
    { // 4: the security floor: the alarm calls more of them until it is off
      objective: 'קומת האבטחה · לנטרל את האזעקה', checkpoint: true,
      enter(m, game) {
        const t = TW(game);
        t.lobby.door.lock();
        towerRed(game, 1);
        if (!m.stopSiren) m.stopSiren = game.sound?.siren?.(600) || null;
        m.s.more = 0; m.s.moreT = 0;
        m.work = new Work(game, { at: t.alarmAt, seconds: 3, label: 'לנטרל את האזעקה', pill: 'מנטרל את האזעקה', near: 1.8, onDone: () => {
          m.s.off = true; t.alarm.set(false); towerRed(game, 1, false); m.stopSiren?.(); m.stopSiren = null;
          t.lobby.door.unlock(); t.lobby.door.setOpen(true);
          game.hud.toast('האזעקה כבויה · התריס בלובי עלה', 2200);
        } });
      },
      interaction(m, game) { return m.s.posted && !m.s.off ? m.work?.interaction(game) || null : null; },
      target(m, game) { const t = TW(game); return onFloor(game, 1) ? { ...t.alarmAt, r: 1.2 } : { ...t.stairs[0].bottom, r: 1.6 }; },
      update(m, game, dt) {
        const t = TW(game);
        if (!m.s.posted && onFloor(game, 1)) { m.s.posted = true; freshMarks(game); post(game, routes(game, F1)); later(m, FLOOR1); }
        m.work?.update(dt);
        // while it rings, one more comes down the west stairs every so often (two at most)
        if (m.s.posted && !m.s.off) {
          m.s.moreT += dt;
          if (m.s.moreT > 16 && m.s.more < F1MORE.length) { m.s.moreT = 0; post(game, [{ id: F1MORE[m.s.more++], at: [t.stairs[1].bottom, T(game, -12, -14, 1)] }], { hot: true }); game.hud.toast('האזעקה הזעיקה עוד אחד', 1500); }
        }
        const n = standing(game, ids(F1));
        say(m, game, !m.s.posted ? 'קומת האבטחה · במדרגות המזרחיות למעלה' : m.s.off ? 'האזעקה כבויה' : `האזעקה · הלוח בחדר הבקרה · אנשי המסדר (${F1.length - n}/${F1.length}) · סומנת ${game.paint.hits}/3`);
        return m.s.off ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 5: the monitors (Dolev shut in upstairs), then the card in the security office
      objective: 'הכרטיס לחדר הפיקוד · משרד הביטחון', checkpoint: true,
      enter(m, game) {
        const t = TW(game), S = t.security;
        if (!m.s.posted) { m.s.posted = true; post(game, routes(game, F1)); for (const g of game.paint.guards) if (ids(F1).includes(g.npc.id)) game.paint.markGuard(g, 'restore'); }
        S.screen.show('cams');
        const D = t.trapped.inside, cam = { x: D.x - 3.2, y: D.y + 2.5, z: D.z - 2.4 };
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: S.monitorsAt.x + 2.2, y: S.monitorsAt.y + 1.8, z: S.monitorsAt.z + 1.2 }, { x: S.monitorsAt.x - 4, y: S.monitorsAt.y + 1.9, z: S.monitorsAt.z }, 9999);
        m.beats = beats(game, [
          ['say', ALARM_OFF],
          ['say', [MONITORS[0]]],
          ['do', () => { game.follow.shot(cam, { x: D.x, y: D.y + 1.1, z: D.z }, 9999); }],
          ['wait', 1.6],
          ['do', () => { game.follow.shot({ x: S.monitorsAt.x + 2.2, y: S.monitorsAt.y + 1.8, z: S.monitorsAt.z + 1.2 }, { x: S.monitorsAt.x - 4, y: S.monitorsAt.y + 1.9, z: S.monitorsAt.z }, 9999); }],
          ['say', MONITORS.slice(1)],
          ['do', () => { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); post(game, routes(game, OFFICE)); }],
        ]);
        m.s.card = false;
      },
      interaction(m, game) {
        const t = TW(game);
        if (game.cutscene || m.s.card || game.mode !== 'foot' || !t.near(game.player.pos, t.card.pickAt, 1.6)) return null;
        return { label: 'לקחת את הכרטיס', priority: 6, run: () => { m.s.card = true; t.card.take(); game.sound?.chime?.(true); game.hud.toast('כרטיס הגישה של חדר הפיקוד', 2000); later(m, CARD); } };
      },
      target(m, game) { const t = TW(game); if (m.beats && !m.beats.done) return null; return standing(game, ids(OFFICE)) ? nearestOf(game, ids(OFFICE)) : { ...t.card.pickAt, r: 1.1 }; },
      update(m, game, dt) {
        m.beats?.update(dt);
        say(m, game, m.s.card ? 'יש כרטיס' : standing(game, ids(OFFICE)) ? 'משרד הביטחון · קצין המשמרת בפנים' : 'הכרטיס על השולחן במשרד');
        return m.s.card && !game.cutscene ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 6: the server floor: the emergency gate shut; Ido breaks into server room C, the player keeps them off him
      objective: 'קומת השרתים · לחפות על עידו', checkpoint: true,
      enter(m, game) {
        const t = TW(game);
        t.escape.gate.lock(); t.breach.door.lock();
        m.s.posted = false; m.s.wave = 0; m.s.idoMarks = 0; m.s.wipe = 0;
      },
      target(m, game) {
        const t = TW(game), B = t.breach;
        if (!onFloor(game, 2)) return onFloor(game, 1) ? { ...t.stairs[1].bottom, r: 1.6 } : { ...t.stairs[1].top, r: 1.6 };
        const g = nearestOf(game, [...ids(F2), ...BREACH]);
        if (!m.job) return g || { ...B.at, r: 1.4 };
        return g || { ...B.cover, r: 1.4 };
      },
      update(m, game, dt) {
        const t = TW(game), B = t.breach;
        if (!m.s.posted && onFloor(game, 2)) { m.s.posted = true; freshMarks(game); post(game, routes(game, F2)); later(m, FLOOR2); }
        if (!m.s.posted) { say(m, game, 'קומת השרתים · במדרגות המערביות למעלה'); return null; }
        const n2 = standing(game, ids(F2));
        if (!m.job && !n2 && !m.s.breached) {
          later(m, BREACH_GO);
          m.s.jobT = 0; freshMarks(game);
          m.job = new Job(game, { who: 'ido', at: B.at, seconds: BREACH_TIME, near: 14, pill: 'עידו פורץ את חדר השרתים', onDone: () => { m.s.breached = true; B.door.unlock(); B.door.setOpen(true); game.dialogue.play(BREACHED); } });
        }
        if (m.job && !m.s.breached) {
          const out = idoMarked(game);
          if (out && !m.s.wipe) { m.s.wipe = 2.4; m.s.idoMarks++; game.hud.toast(`עידו סומן (${m.s.idoMarks}/${IDO_OUT}) · מנגב וממשיך`, 1800); }
          if (m.s.wipe > 0) { m.s.wipe -= dt; if (m.s.wipe <= 0) { m.s.wipe = 0; idoUp(game); } }
          else m.job.update(dt);
          m.s.jobT += m.job.phase === 'work' ? dt : 0;
          // two waves of two from the south end and rooms B and D
          if (m.job.phase === 'work' && m.s.wave === 0 && m.s.jobT > 2) { m.s.wave = 1; post(game, comers(game, BREACH.slice(0, 2), 0), { hot: true }); later(m, WAVE); }
          if (m.job.phase === 'work' && m.s.wave === 1 && m.s.jobT > 7) { m.s.wave = 2; post(game, comers(game, BREACH.slice(2), 2), { hot: true }); }
        }
        const nb = standing(game, BREACH), left = m.job ? Math.max(0, Math.ceil(BREACH_TIME - (m.job.phase === 'work' ? m.job.t : 0))) : BREACH_TIME;
        say(m, game, n2 ? `קומת השרתים: לסמן אותם (${F2.length - n2}/${F2.length}) · סומנת ${game.paint.hits}/3` : m.s.breached ? 'חדר השרתים פתוח' : `לחפות על עידו · ${left} שניות · מגיעים מדרום (${nb}) · עידו סומן ${m.s.idoMarks}/${IDO_OUT}`);
        return m.s.breached ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; idoUp(game); },
    },
    { // 7: the terminal in room C opens the emergency gate; up the east stairs to the storage floor
      objective: 'הטרמינל בחדר השרתים · לפתוח את שער החירום', checkpoint: true,
      enter(m, game) {
        const t = TW(game), at = T(game, 12, -6.6, 2, 0);
        m.s.open = !t.escape.gate.locked;
        for (const id of BREACH) { const gd = game.paint.guards.find((g) => g.npc.id === id); if (gd && !gd.marked) game.paint.markGuard(gd, 'restore'); }
        m.work = new Work(game, { at, seconds: 2, label: 'לפתוח את שער החירום', pill: 'פותח את שער החירום', near: 1.6, onDone: () => { m.s.open = true; t.escape.gate.unlock(); t.escape.gate.setOpen(true); game.sound?.hit?.('crash', 0.5); game.dialogue.play(GATE_OPEN); } });
        m.s.at = at;
      },
      interaction(m, game) { return m.s.open ? null : m.work?.interaction(game) || null; },
      target(m, game) { const t = TW(game); return !m.s.open ? { ...m.s.at, r: 1.0 } : onFloor(game, 2) ? { ...t.stairs[2].bottom, r: 1.6 } : { ...t.stairs[2].top, r: 1.6 }; },
      update(m, game, dt) {
        m.work?.update(dt);
        say(m, game, !m.s.open ? 'הטרמינל בחדר השרתים C · לפתוח את שער החירום' : 'שער החירום פתוח · במדרגות המזרחיות לקומת המחסנים');
        return m.s.open && onFloor(game, 3) ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 8: the storage floor: its guards, and Dolev's door forced open
      objective: 'קומת המחסנים · לשחרר את דולב', checkpoint: true,
      enter(m, game) {
        const t = TW(game);
        freshMarks(game);
        offBoard(game, [...ids(F2), ...BREACH]);
        post(game, routes(game, F3));
        later(m, FLOOR3);
        m.s.freed = false;
        // a charge on a shelf of the Order's: the ring, the beeps, then fire
        m.live.push(new TBlast(game, { at: T(game, 8.5, -6.2, 3), size: 1.8, warn: 2.4, radius: 3, fire: 120 }));
        m.work = new Work(game, { at: t.trapped.at, seconds: 4, label: 'לפרוץ את דלת המחסן', pill: 'פורץ את הדלת', near: 1.7, onDone: () => {
          m.s.freed = true; t.trapped.door.unlock(); t.trapped.door.setOpen(true); game.sound?.hit?.('crash', 0.7);
          const n = game.npc('dolev'); n.idle = null; n.model.setPose(null);
          game.squad.form([...game.squad.ids, 'dolev'].filter((id, i, a) => a.indexOf(id) === i), { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
          armed(game, game.squad.ids);
          game.dialogue.play(DOLEV);
        } });
      },
      interaction(m, game) { return standing(game, ids(F3)) || m.s.freed ? null : m.work?.interaction(game) || null; },
      target(m, game) { const t = TW(game); return standing(game, ids(F3)) ? nearestOf(game, ids(F3)) : m.s.freed ? null : { ...t.trapped.at, r: 1.2 }; },
      update(m, game, dt) {
        m.work?.update(dt);
        const n = standing(game, ids(F3));
        say(m, game, n ? `קומת המחסנים: לסמן אותם (${F3.length - n}/${F3.length}) · סומנת ${game.paint.hits}/3` : m.s.freed ? 'דולב בחוץ' : 'דולב במחסן הנעול · לפרוץ את הדלת');
        return m.s.freed && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 9: the stairs above on fire; the elevator (and two of them in it); up to the command floor
      objective: 'לקומת הפיקוד', checkpoint: true,
      enter(m, game) {
        const t = TW(game), f = T(game, -17.6, -3.2, 3);
        m.s.phase = m.s.cp === 9 ? 'lift' : 'blast';
        if (m.s.phase === 'blast') {
          later(m, [['עידו', 'המדרגות לקומת הפיקוד במערב.']]);
          m.s.blastT = 2.5;
        } else later(m, [FIRE[1]]);
        m.work = new Work(game, { at: t.elevator.front[3], seconds: 3, label: 'להזעיק את המעלית', pill: 'המעלית בדרך', near: 1.8, onDone: () => {
          m.s.phase = 'ambush'; t.elevator.open(3); game.sound?.beep?.(2, 660);
          post(game, LIFT.map((id, i) => ({ id, at: [T(game, i ? 1.1 : -1.1, -18.4, 3)], yaw: Math.PI, hot: true })));
          game.dialogue.play(LIFT_IN);
        } });
        m.s.fireAt = f;
      },
      interaction(m, game) {
        const t = TW(game);
        if (m.s.phase === 'lift') return m.work?.interaction(game) || null;
        if (m.s.phase === 'ambush' && !standing(game, LIFT) && t.near(game.player.pos, t.elevator.front[3], 2.6)) return { label: 'לעלות לקומת הפיקוד', priority: 6, run: () => { m.s.phase = 'up'; liftUp(m, game); } };
        return null;
      },
      target(m, game) {
        const t = TW(game);
        if (m.s.phase === 'blast') return null;
        if (m.s.phase === 'ambush') return nearestOf(game, LIFT) || { ...t.elevator.front[3], r: 1.4 };
        if (m.s.phase === 'up') return null;
        return { ...t.elevator.front[3], r: 1.4 };
      },
      update(m, game, dt) {
        const t = TW(game);
        m.beats?.update(dt);
        if (m.s.phase === 'blast' && (m.s.blastT -= dt) <= 0) {
          m.s.phase = 'boom';
          const f = m.s.fireAt;
          game.cutscene = true; game.hud.setCinematic(true);
          game.follow.shot({ x: f.x + 7, y: f.y + 2.2, z: f.z - 6 }, { x: f.x, y: f.y + 1, z: f.z }, 9999);
          const bl = new TBlast(game, { at: f, size: 2.2, warn: 1.6, radius: 2.6, fire: 0, onBoom: () => fireBlock(m, game) });
          m.live.push(bl);
          m.beats = beats(game, [['until', () => bl.done], ['wait', 0.8], ['say', [FIRE[0]]], ['do', () => { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); }], ['say', [FIRE[1]]]]);
        }
        if (m.s.phase === 'boom' && !game.cutscene) m.s.phase = 'lift';
        m.work?.update(dt);
        say(m, game, m.s.phase === 'lift' ? 'המדרגות בוערות · המעלית באמצע המסדרון הצפוני' : m.s.phase === 'ambush' ? (standing(game, LIFT) ? `שניים במעלית · לסמן אותם (${LIFT.length - standing(game, LIFT)}/${LIFT.length})` : 'כולם למעלית · לעלות לקומת הפיקוד') : 'לקומת הפיקוד');
        return m.s.phase === 'there' ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.work = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 10: the command floor's corridors and the card reader: the door stays shut, a helicopter is coming
      objective: 'קומת הפיקוד · המסדרונות', checkpoint: true,
      enter(m, game) {
        freshMarks(game);
        offBoard(game, [...ids(F3), ...LIFT]);
        post(game, routes(game, F4));
        later(m, FLOOR4);
        m.s.swiped = false; m.s.told = false;
      },
      interaction(m, game) {
        const t = TW(game);
        if (m.s.swiped || standing(game, ids(F4)) || game.mode !== 'foot' || !t.near(game.player.pos, t.command.readerAt, 1.6)) return null;
        return { label: 'להעביר את הכרטיס', priority: 6, run: () => {
          m.s.swiped = true; t.command.reader.set(true); game.sound?.beep?.(2, 990);
          heliOrbit(m, game);
          m.beats = beats(game, [['say', READER], ['do', () => { m.s.told = true; }]]);
        } };
      },
      target(m, game) { const t = TW(game); return standing(game, ids(F4)) ? nearestOf(game, ids(F4)) : m.s.swiped ? null : { ...t.command.readerAt, r: 1.1 }; },
      update(m, game, dt) {
        m.beats?.update(dt);
        const n = standing(game, ids(F4));
        say(m, game, n ? `המסדרונות של קומת הפיקוד: לסמן אותם (${F4.length - n}/${F4.length}) · סומנת ${game.paint.hits}/3` : !m.s.swiped ? 'קורא הכרטיסים ליד דלת חדר הפיקוד' : 'הדלת לא נפתחת · מסוק?');
        return m.s.told ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; },
    },
    { // 11: the roof: its guards, the landing lights shot out, the helicopter turning away
      objective: 'הגג · לא לתת למסוק לנחות', checkpoint: true,
      enter(m, game) { m.s.posted = false; m.s.gone = false; heliOrbit(m, game); },
      target(m, game) {
        const t = TW(game);
        if (!onFloor(game, 5)) return onFloor(game, 4) ? { ...t.stairs[4].bottom, r: 1.6 } : null;
        const g = nearestOf(game, ids(ROOF));
        const L = (m.lights || []).find((q) => !q.done);
        return L ? { x: L.prop.x, z: L.prop.z, y: L.prop.y - 0.55, r: 1.0 } : g;
      },
      update(m, game, dt) {
        const t = TW(game);
        m.beats?.update(dt);
        if (!m.s.posted && onFloor(game, 5)) {
          m.s.posted = true; freshMarks(game);
          offBoard(game, ids(F4));
          post(game, routes(game, ROOF));
          landingLights(m, game);
          m.beats = beats(game, [['say', ROOFTOP]]);
          m.s.fly = 'in';
        }
        if (!m.s.posted) { say(m, game, 'הגג · במדרגות המזרחיות למעלה'); return null; }
        flyHeli(m, game, dt);
        const lit = (m.lights || []).filter((L) => !L.done).length, n = standing(game, ids(ROOF));
        if (!lit && !m.s.gone) {
          m.s.gone = true;
          m.s.fly = 'out';
          m.beats?.cancel(); m.talk = []; // nothing older cuts in after this
          m.beats = beats(game, [['say', NO_HELI], ['do', () => { m.s.told = true; }]]);
        }
        say(m, game, lit ? `אורות הנחיתה (${4 - lit}/4) · אנשי המסדר על הגג (${ROOF.length - n}/${ROOF.length}) · סומנת ${game.paint.hits}/3` : n ? `המסוק מסתובב · נשארו על הגג (${ROOF.length - n}/${ROOF.length})` : 'הגג שלנו');
        return m.s.gone && !n && m.s.told ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; clearLights(m, game); if (m.heli) { m.heli.dispose(); game.helis = game.helis.filter((h) => h !== m.heli); m.heli = null; } },
    },
    { // 12: back down to the command room's door, which opens
      objective: 'בחזרה לדלת של חדר הפיקוד', checkpoint: true,
      enter(m, game) { m.s.open = false; },
      target(m, game) {
        const t = TW(game);
        if (onFloor(game, 5)) return { ...t.stairs[4].top, r: 1.6 };
        return { ...t.command.doorAt, r: 1.6 };
      },
      update(m, game, dt) {
        const t = TW(game);
        m.beats?.update(dt);
        if (!m.s.open && onFloor(game, 4) && t.near(game.player.pos, t.command.doorAt, 3)) {
          m.s.open = true;
          game.cutscene = true; game.hud.setCinematic(true);
          const d = t.command.door.pos;
          game.follow.shot({ x: d.x + 3.4, y: d.y + 2.2, z: d.z - 4.5 }, { x: d.x, y: d.y + 1.4, z: d.z }, 9999);
          m.beats = beats(game, [['wait', 0.6], ['do', () => { t.command.door.unlock(); t.command.door.setOpen(true); game.sound?.hit?.('block', 0.6); }], ['say', OPENS], ['do', () => { m.s.in = true; }]]);
        }
        say(m, game, m.s.open ? 'הדלת של חדר הפיקוד נפתחת' : 'לדלת של חדר הפיקוד · קומה ארבע');
        return m.s.in ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
  complete(m, game) { m.done = true; },
};

// the second wave up the corridor: from its south end, where the gang can see them come
function comers(game, who, k) { const S = [[0, 16], [-0.8, 18.4], [0.8, 14.5], [0, 18.8]]; return who.map((id, i) => { const [lx, lz] = S[(k + i) % S.length]; return { id, from: T(game, lx, lz, 2), at: [T(game, lx, lz, 2), T(game, 0, 1, 2)] }; }); }

// the helicopter: in over the helipad, hanging there while the lights are on, then up and away for good
function flyHeli(m, game, dt) {
  const h = m.heli, t = TW(game); if (!h || !m.s.fly) return;
  const pad = t.roof.helipad, to = m.s.fly === 'in' ? { x: pad.x + 2, y: pad.y + 10, z: pad.z + 3 } : { x: pad.x - 380, y: pad.y + 70, z: pad.z - 240 };
  h.mode = null;
  const k = 1 - Math.exp(-(m.s.fly === 'in' ? 0.7 : 0.35) * dt), ox = h.pos.x, oz = h.pos.z;
  h.pos.x += (to.x - h.pos.x) * k; h.pos.y += (to.y - h.pos.y) * k; h.pos.z += (to.z - h.pos.z) * k;
  const vx = (h.pos.x - ox) / Math.max(dt, 1e-4), vz = (h.pos.z - oz) / Math.max(dt, 1e-4);
  if (Math.hypot(vx, vz) > 0.6) h.yaw = Math.atan2(vx, vz);
  h.root.position.copy(h.pos); h.root.rotation.set(Math.min(0.2, Math.hypot(vx, vz) * 0.01), h.yaw, 0);
  if (m.s.fly === 'out' && Math.hypot(h.pos.x - pad.x, h.pos.z - pad.z) > 300) { h.dispose(); game.helis = game.helis.filter((q) => q !== h); m.heli = null; }
}

// the elevator up: a fade; the doors shut on floor three and open on the command floor, everyone out
function liftUp(m, game) {
  const t = TW(game);
  blackout(game, m, 'קומה 4 · חדר הפיקוד', () => {
    t.elevator.close(3); t.elevator.open(4);
    offBoard(game, LIFT);
    gangAt(game, { ...t.elevator.front[4], yaw: 0 }, { ids: game.squad.ids.includes('dolev') ? TEAM : TEAM });
    game.dialogue.play(LIFT_UP);
    m.s.phase = 'there';
  }, 1300);
}
