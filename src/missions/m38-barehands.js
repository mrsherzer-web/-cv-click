// Chapter nine, mission 5, "הבריחה בלי הנשקים". Out of the cells with bare hands, through three zones:
// the iron corridor (the chief guard's keys open his door; two out of the guard room, three more at the
// shutter, one of them covering up so only a heavy punch goes through), the machine room (a group fight on
// the floor where the steam vents burst and the presses come down — each warns first, and whoever stands in
// it is hit, guards included; then across it, the machines stopped at their panel or passed in time), and the
// detention arena: a fight in the cage against "הפטיש", huge, strong and slow — light punches do nothing to
// him, so blocks, dodges, the shove, heavy punches and combinations; Erez and Ido in the cage with Nehorai.
// At the end, the access card to the armory from his belt. Fists only, no markers anywhere. Invented.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { TEAM, endCrew, attempt, handsOver, Work, gone } from './phoenix.js';
import { FAC, L, underground, unarmed, rearmed, stand, beaten, away, keepBeaten, walkPath, brawl, endBrawl, machineHits, beats, clearStage, gangAt } from './phoenix-b.js';

const CELL = ['og1', 'og2', 'og3', 'og4'];          // beaten in the cell (mission 37); og1 has the keys
const ROOM = ['og5', 'og6'];                        // out of the first guard room
const SHUT = ['og7', 'og8', 'og9'];                 // at the shutter; og9 covers up
const MACH = ['og10', 'og11', 'og12', 'og13'];      // in the machine room
const CROWD = ['og14', 'og15', 'og16'];             // on the arena's stands
const ALL = [...CELL, ...ROOM, ...SHUT, ...MACH, ...CROWD];
const DOORS = { bigCell: true, cell1: true, cell2: true, cell3: true, guardDoor: 'locked', arrivalDoor: 'locked', shutter: 'locked', guardRoom1: false, guardRoom1Back: 'locked', guardRoom2: false, guardRoom2Back: 'locked', machA: true, machB: true, arena: true, cage: true, armory: 'locked', rackGate: 'locked', t1Corridor: 'locked' };

// where the beaten sit when a checkpoint is staged on a fresh page (a mission carried straight on keeps them where they fell)
const AT = {
  cell: (game) => [L(game, -76, -36, 0, 2.2), L(game, -76, -32, 0, 1.2), L(game, -74.5, -38, 0, 2.6), L(game, -74.5, -30, 0, 0.6)],
  room: (game) => [L(game, -44, -27, 0, 1.4), L(game, -41.5, -29.5, 0, 2.2)],
  shut: (game) => [L(game, -37.5, -26.6, 0, 1.6), L(game, -36.8, -29.4, 0, 2.4), L(game, -39.5, -28, 0, 1.2)],
  mach: (game) => [L(game, -49, -44.6, 0, 3.0), L(game, -46, -43.2, 0, 2.6), L(game, -52, -43.8, 0, -2.8), L(game, -44.6, -45.6, 0, 2.0)],
};
const START = [['ארז', 'יאללה, החוצה מפה לפני שיבואו עוד.'], ['עידו', 'לשומר הראשי יש את המפתחות. זה עם הפס האדום על השרוול.']];
const KEYS = [['נהוראי', 'מפתחות. דלת השומרים.']];
const CORR = [['ארז', 'מסדרון הברזל. ארוך, ואין איפה להתחבא.'], ['עידו', 'בלי רובים. רק אגרופים.']];
const ROOM_OUT = [['שומר', 'האסירים בחוץ!']];
const SHUT_SEE = [['עידו', 'שלושה ליד התריס. האמצעי מחזיק את הידיים למעלה — רק מכה חזקה עוברת אותו.']];
const SHUT_CLOSED = [['ארז', 'התריס נעול. אין דרך מזרחה במסדרון.'], ['עידו', 'חדר המכונות. נכנסים בדלת המערבית, יוצאים במזרחית.']];
const MACH_IN = [['ארז', 'המכבשים! והקיטור! לא לעמוד מתחתם!'], ['נהוראי', 'אז נדחוף אותם לשם.']];
const PANEL = [['עידו', 'לוח הבקרה של המכונות — ליד הדוודים. אפשר לעצור את הכול. או לעבור בתזמון.']];
const STOPPED = [['עידו', 'שקט. אפשר לעבור.']];
const ARENA = [['ארז', 'זירה. כלוב באמצע ויציעים מסביב.'], ['עידו', 'ומישהו ענק מחכה בפנים.']];
const HAMMER = [['הפטיש', 'אז אתם החבורה של נהוראי. בלי הרובים אתם סתם ילדים.'], ['נהוראי', 'בוא נבדוק.'], ['עידו', 'הוא ענק, אבל איטי. לחסום, להתחמק, ואז קומבו.'], ['ארז', 'אגרופים קלים לא מזיזים אותו — רק מכה חזקה או סוף של קומבו. אנחנו איתך.']];
const PHASE = [[['הפטיש', 'עכשיו אני מתחיל להתעצבן.'], ['ארז', 'הוא קם! להמשיך!']], [['הפטיש', 'מספיק משחקים!'], ['עידו', 'הוא מהיר יותר עכשיו! להתחמק!']]];
const DOWN = [['ארז', 'הפטיש על הרצפה!'], ['עידו', 'יש לו משהו על החגורה. כרטיס.']];
const CARD = [['נהוראי', 'כרטיס גישה. מחסן הנשקים.'], ['עידו', 'הרובים שלנו שם. אני מרגיש את זה.'], ['ארז', 'אז קדימה. לפני שהם מתארגנים.']];
const LOST = {
  fight: 'השומרים הפילו את נהוראי. ארז: "אחי, לחסום כשהטבעת אדומה, ולהכות כשהיא צהובה. ומכה חזקה על מי שמחזיק ידיים למעלה."',
  machine: 'המכונות תפסו את נהוראי. עידו: "המנורה הכתומה מהבהבת לפני כל מכה. לחכות שתירגע ולעבור — או לעצור הכול בלוח."',
  hammer: 'הפטיש הפיל את נהוראי. עידו: "הוא איטי. לחכות להנפה, להתחמק או לדחוף, ואז מכה חזקה או קומבו. אגרופים קלים לא מזיזים אותו."',
};
const TIP_MACH = ['קיטור ומכבשים: המנורה הכתומה מהבהבת לפני כל מכה', 'דחיפה לתוך הקיטור — הוא נתפס בו', 'גם אתה: לא לעמוד שם כשהמנורה מהבהבת'];
const TIP_BOSS = ['הוא איטי: כשהטבעת אדומה — להתחמק או לדחוף', 'אגרוף קל לא מזיז לו · מכה חזקה או סיום קומבו', 'אחרי שהוא מניף הוא פתוח (צהוב) · שלוש ברצף'];

const local = (game, p = game.player.pos) => { const f = FAC(game); return { x: p.x - f.x, z: p.z - f.z }; };
function nearestFoe(m, game, ids) {
  const me = game.player.pos;
  let best = null, bd = Infinity;
  for (const id of ids) {
    const n = game.npc(id), o = m.fight?.opponents.find((q) => q.npc === n);
    if (!n.visible || o?.fighter.down || (!o && n.model.pose === 'down')) continue;
    const d = Math.hypot(n.pos.x - me.x, n.pos.z - me.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best ? { x: best.pos.x, z: best.pos.z, y: best.pos.y, r: 1.2 } : null;
}
const standing = (m, ids) => (m.fight ? m.fight.opponents.filter((o) => ids.includes(o.npc.id) && !o.fighter.down).length : ids.length);
function doors(game) { const f = FAC(game); f.reset(); f.setDoors(DOORS); f.snapDoors(); }
// the Order's people for a checkpoint: who sits beaten where, who waits where (and in what state)
function people(m, game, cp) {
  const f = FAC(game);
  away(game, ALL); away(game, ['hammer']);
  keepBeaten(game, CELL, AT.cell(game));
  if (cp >= 2) keepBeaten(game, ROOM, AT.room(game)); else ROOM.forEach((id, i) => stand(game, id, L(game, -40 + (i ? 1 : -1), -17.5), { yaw: Math.PI, idle: null }));
  if (cp >= 3) keepBeaten(game, SHUT, AT.shut(game)); else [L(game, -37.2, -26.6), L(game, -37.2, -29.4), L(game, -38.6, -28)].forEach((p, i) => stand(game, SHUT[i], p, { yaw: -Math.PI / 2 }));
  if (cp >= 4) keepBeaten(game, MACH, AT.mach(game)); else [L(game, -48, -53), L(game, -44.5, -55), L(game, -51.5, -56), L(game, -47, -58.6)].forEach((p, i) => stand(game, MACH[i], p, { yaw: 0 }));
  // the crowd on the stands round the cage, and the Hammer in it
  CROWD.forEach((id, i) => { const r = f.arena.rail[[1, 6, 9][i]]; stand(game, id, r, { yaw: r.yaw, idle: 'cheer', floor: true }); });
  const h = stand(game, 'hammer', f.arena.hammer, { yaw: 0, idle: 'arms' });
  h.body.enabled = true;
}
// the gang at a spot (Nehorai leading), unarmed
function gang(game, at, yaw) { gangAt(game, at, yaw); unarmed(game); }
function dropCard(m, game) {
  if (m.card) return;
  const h = game.npc('hammer');
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.07), new THREE.MeshStandardMaterial({ color: '#dfe9f5', emissive: '#4aa8ff', emissiveIntensity: 0.9, roughness: 0.5 }));
  const yaw = h.yaw, x = h.pos.x + Math.cos(yaw) * 0.7, z = h.pos.z - Math.sin(yaw) * 0.7;
  card.position.set(x, h.pos.y + 0.02, z); card.rotation.y = yaw + 0.4;
  game.scene.add(card);
  m.card = card; m.s.cardAt = { x, z, y: h.pos.y };
}

export default {
  id: 'barehands', chapter: 9, number: 5, title: 'הבריחה בלי הנשקים', requires: ['stolen'], follows: true,
  where: 'בתאי המעצר',
  startAt: (game) => { const c = FAC(game)?.cells; return c ? { ...c.big.inside, r: 2 } : null; },
  reward: { money: 700, unlocks: ['barehands'], text: 'הפטיש על הרצפה · כרטיס גישה · 700 ₪' },

  setup(m, game) { m.s = {}; m.fightAllies = []; unarmed(game); underground(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const s = FAC(game).cells.big.inside; game.player.place(s.x, s.z, Math.PI / 2, s.y); game.follow.snapBehind(Math.PI / 2); },
  failIf(m, game) {
    if (m.s.lost) return m.stepIndex === 6 ? LOST.hammer : LOST.fight;
    if (game.fighter.down && !m.fight) return LOST.machine; // the presses or the steam, out of a fight
    return null;
  },
  restore(m, game, cp) {
    const f = FAC(game);
    clearStage(m, game); underground(game);
    if (m.card) { gone(m.card); m.card = null; }
    doors(game);
    f.machines.reset();
    m.s = { keys: cp >= 1, open: cp >= 1, fightA: false, fightB: false, stopped: false, tipT: 0, tip: 0 };
    people(m, game, cp);
    const at = [f.cells.big.inside, f.cells.guardOut, L(game, -55, -28, 0, Math.PI / 2), f.machines.outA, f.machines.inA, f.machines.outB, f.arena.gateOut, f.arena.gateOut][cp] || f.cells.big.inside;
    const yaw = [Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI, Math.PI, Math.PI / 2, Math.PI, Math.PI][cp];
    gang(game, at, yaw);
    if (cp >= 1) { f.doors.guardDoor.unlock(); f.doors.guardDoor.setOpen(true); f.doors.guardDoor.snap(); }
  },
  cleanup(m, game) {
    clearStage(m, game);
    if (m.card) { gone(m.card); m.card = null; }
    const f = FAC(game);
    for (const id of TEAM) { const n = game.npc(id); if (n.idle === 'cheer') n.idle = null; }
    if (!m.done || !handsOver(game)) {
      away(game, [...ALL, 'hammer']); f.reset(); f.snapDoors();
      if (game.missions.done('armory')) rearmed(game);
      endCrew(game); for (const id of TEAM) game.npc(id).model.setPose(null);
    }
  },

  steps: [
    { // 0: the chief guard's keys, his door
      objective: 'צרור המפתחות',
      enter(m, game) {
        const f = FAC(game);
        // carried straight on from the cell fight: everyone where they are; a fresh page stages the cell
        if (!game.squad.active || game.squad.ids.length < TEAM.length) gang(game, f.cells.big.inside, Math.PI / 2);
        const me = { ...game.player.pos };
        doors(game);
        people(m, game, 0);
        unarmed(game);
        m.s = { keys: false, open: false };
        game.player.place(me.x, me.z, game.player.yaw, me.y);
        m.beats = beats(game, [['say', START]]);
      },
      target(m, game) {
        const f = FAC(game);
        if (!m.s.keys) { const n = game.npc('og1'); return { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 1.0 }; }
        return { ...f.cells.guardIn, r: 1.2 };
      },
      interaction(m, game) {
        const f = FAC(game), me = game.player.pos;
        if (game.mode !== 'foot') return null;
        if (!m.s.keys && near(me, game.npc('og1').pos, 1.9)) return { label: 'לקחת את המפתחות', priority: 6, run: () => { m.s.keys = true; game.sound?.chime?.(true); game.hud.toast('צרור המפתחות של השומר הראשי', 1800); game.dialogue.play(KEYS); } };
        if (m.s.keys && !m.s.open && near(me, f.cells.guardIn, 2.0)) return { label: 'לפתוח את דלת השומרים', priority: 6, run: () => { m.s.open = true; f.doors.guardDoor.unlock(); f.doors.guardDoor.setOpen(true); game.sound?.hit?.('block', 0.7); } };
        return null;
      },
      update(m, game, dt) {
        m.beats?.update(dt);
        say(m, game, !m.s.keys ? 'לקחת את המפתחות מהשומר הראשי' : !m.s.open ? 'לפתוח את דלת השומרים במסדרון התאים' : 'החוצה, למסדרון הברזל');
        return m.s.open ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.dialogue.play(CORR); },
    },
    { // 1: the iron corridor: two come out of the guard room
      objective: 'מסדרון הברזל', checkpoint: true,
      enter(m, game) { m.s.fightA = false; m.s.out = false; m.s.endA = false; },
      target(m, game) { return m.s.fightA ? nearestFoe(m, game, ROOM) : { ...L(game, -50, -28), r: 2.5 }; },
      update(m, game, dt) {
        const f = FAC(game), l = local(game);
        const start = () => {
          if (m.s.fightA) return;
          m.s.fightA = true;
          for (const id of ROOM) { const n = game.npc(id), p = local(game, n.pos); if (p.z > -24) { const q = L(game, -40, -26); n.place(q.x, q.z, -Math.PI / 2, q.y); } }
          brawl(m, game, { foes: [{ id: 'og5', hp: 70, power: 0.85, aggression: 1.0, windup: 0.68, moves: ['jab', 'cross', 'swing'] }, { id: 'og6', hp: 70, power: 0.85, aggression: 0.95, windup: 0.7, moves: ['swing', 'jab', 'cross'] }], allies: ['erez', 'ido'], max: 2 });
        };
        // past the cells' door, the guard room opens and the two come out into the corridor
        if (!m.s.out && f.zoneAt(game.player.pos.x, game.player.pos.z) === 'corridor' && l.x > -61) {
          m.s.out = true; m.s.outT = 0;
          f.doors.guardRoom1.setOpen(true); game.sound?.hit?.('block', 0.6);
          game.dialogue.play(ROOM_OUT);
          const live = attempt(game, m);
          ROOM.forEach((id, i) => walkPath(game.npc(id), [L(game, -40, -20), L(game, -40 + (i ? 0.8 : -0.8), -23.6), L(game, -42 + i * 1.4, -27.5)], { onDone: () => { if (live() && !m.s.fightA) start(); } }));
        }
        if (m.s.out && !m.s.fightA && (m.s.outT += dt) > 6) start(); // slow on the way out: they are in the corridor now
        say(m, game, !m.s.out ? 'מסדרון הברזל · מזרחה' : m.s.won ? 'השניים על הרצפה' : `שומרים מחדר השמירה · להפיל אותם (${ROOM.length - standing(m, ROOM)}/${ROOM.length})`);
        if (m.s.won && !m.s.endA) { m.s.endA = true; endBrawl(m, game); return 'next'; }
        return null;
      },
    },
    { // 2: three at the shutter, one of them covering up
      objective: 'מסדרון הברזל · ליד התריס', checkpoint: true,
      enter(m, game) { m.s.fightB = false; m.s.endB = false; m.s.seen = false; m.s.closed = false; m.s.won = false; },
      target(m, game) { return m.s.closed ? { ...FAC(game).machines.outA, r: 1.4 } : nearestFoe(m, game, SHUT) || { ...FAC(game).corridor.shutterAt.west, r: 1.4 }; },
      update(m, game) {
        const f = FAC(game), l = local(game);
        if (!m.s.seen && l.x > -56) { m.s.seen = true; game.dialogue.play(SHUT_SEE); }
        if (!m.s.fightB && l.x > -49) {
          m.s.fightB = true;
          brawl(m, game, {
            foes: [
              { id: 'og7', hp: 65, power: 0.85, aggression: 1.0, windup: 0.68, moves: ['cross', 'swing'] },
              { id: 'og8', hp: 65, power: 0.85, aggression: 1.0, windup: 0.7, moves: ['jab', 'swing', 'cross'] },
              { id: 'og9', hp: 80, power: 0.95, aggression: 0.9, windup: 0.75, guard: 0.7, moves: ['swing', 'cross'] },
            ],
            allies: ['erez', 'ido', 'avraham'], max: 2,
          });
          game.hud.toast('אחד מהם חוסם: מכה חזקה שוברת את החסימה', 3000);
        }
        say(m, game, m.s.closed ? 'התריס נעול · לדלת המערבית של חדר המכונות' : !m.s.fightB ? 'מזרחה, אל התריס' : `שלושה ליד התריס · מכה חזקה שוברת חסימה (${SHUT.length - standing(m, SHUT)}/${SHUT.length})`);
        if (m.s.won && !m.s.endB) { m.s.endB = true; endBrawl(m, game); m.s.closed = true; game.hud.toast('התריס נעול', 1600); game.dialogue.play(SHUT_CLOSED); }
        return m.s.closed && near(game.player.pos, f.machines.outA, 2.6) ? 'next' : null;
      },
    },
    { // 3: the machine room: a group fight among the presses and the steam
      objective: 'חדר המכונות', checkpoint: true,
      enter(m, game) { m.s.fightM = false; m.s.endM = false; m.s.won = false; m.s.tip = 0; m.s.tipT = 0; FAC(game).machines.reset(); },
      target(m, game) { return m.s.fightM ? nearestFoe(m, game, MACH) : { ...FAC(game).machines.inA, r: 1.4 }; },
      update(m, game, dt) {
        const f = FAC(game);
        if (!m.s.fightM && f.zoneAt(game.player.pos.x, game.player.pos.z) === 'machines') {
          m.s.fightM = true;
          game.dialogue.play(MACH_IN);
          brawl(m, game, {
            foes: [
              { id: 'og10', hp: 65, power: 0.85, aggression: 1.0, windup: 0.7, moves: ['jab', 'cross', 'swing'] },
              { id: 'og11', hp: 65, power: 0.85, aggression: 1.0, windup: 0.7, moves: ['swing', 'cross'] },
              { id: 'og12', hp: 70, power: 0.9, aggression: 0.95, windup: 0.72, guard: 0.3, moves: ['cross', 'swing'] },
              { id: 'og13', hp: 65, power: 0.85, aggression: 1.0, windup: 0.7, moves: ['swing', 'jab'] },
            ],
            allies: ['erez', 'ido', 'liam'], max: 2,
          });
          m.s.tipT = 1.5;
        }
        // the presses and the steam hit whoever is in them: Nehorai, the friends who fight, the guards
        if (m.fight) machineHits(m, game, [game.fighter, ...m.fight.allies.map((a) => a.fighter), ...m.fight.opponents.map((o) => o.fighter)]);
        if (m.fight && !m.fight.over && (m.s.tipT -= dt) <= 0 && m.s.tip < TIP_MACH.length) { game.hud.toast(TIP_MACH[m.s.tip++], 3000); m.s.tipT = 5; }
        say(m, game, !m.s.fightM ? 'בדלת המערבית, לחדר המכונות' : m.s.won ? 'חדר המכונות נקי' : `קרב קבוצתי · להיזהר מהמכבשים והקיטור (${MACH.length - standing(m, MACH)}/${MACH.length})`);
        if (m.s.won && !m.s.endM) { m.s.endM = true; endBrawl(m, game); return 'next'; }
        return null;
      },
    },
    { // 4: across the machine room: stop the machines at the panel, or pass them in time
      objective: 'לעבור את חדר המכונות', checkpoint: true,
      enter(m, game) {
        const f = FAC(game), H = f.machines;
        m.s.stopped = false;
        H.panel.light(false);
        m.work = new Work(game, { at: H.panel.at, seconds: 3, label: 'לעצור את המכונות', pill: 'עוצר את המכונות', near: 1.8, onDone: () => { m.s.stopped = true; H.setAll(false); H.panel.light(true); game.hud.toast('המכונות עצרו', 1600); game.dialogue.play(STOPPED); } });
        game.dialogue.play(PANEL);
      },
      target(m, game) { const H = FAC(game).machines; return !m.s.stopped && near(game.player.pos, H.panel.at, 9) && local(game).z > -50 ? { ...H.panel.at, r: 1.0 } : { ...H.outB, r: 1.6 }; },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      update(m, game, dt) {
        const f = FAC(game);
        m.work?.update(dt);
        machineHits(m, game, [game.fighter]);
        say(m, game, m.s.stopped ? 'המכונות עצרו · לדלת המזרחית ולמסדרון' : 'לעצור את המכונות בלוח · או לעבור בתזמון לדלת המזרחית');
        return near(game.player.pos, f.machines.outB, 2.4) ? 'next' : null;
      },
      exit(m, game) { m.work?.cancel(); m.work = null; game.dialogue.play(ARENA); },
    },
    { // 5: to the arena and the cage
      objective: 'זירת המעצר', checkpoint: true,
      target(m, game) { const a = FAC(game).arena; return FAC(game).zoneAt(game.player.pos.x, game.player.pos.z) === 'arena' ? { ...a.gateOut, r: 1.4 } : { ...a.doorAt, r: 1.6 }; },
      update(m, game) {
        const a = FAC(game).arena;
        say(m, game, FAC(game).zoneAt(game.player.pos.x, game.player.pos.z) === 'arena' ? 'לשער הכלוב' : 'לזירת המעצר · בהמשך מסדרון הברזל');
        return near(game.player.pos, a.gateOut, 2.4) ? 'next' : null;
      },
    },
    { // 6: "הפטיש"
      objective: 'הפטיש', checkpoint: true,
      enter(m, game) {
        const f = FAC(game), a = f.arena;
        game.cutscene = true; game.hud.setCinematic(true);
        m.s.fightH = false; m.s.won = false; m.s.lost = false; m.s.endH = false; m.s.tip = 0; m.s.tipT = 0;
        // into the cage: Nehorai, Erez and Ido; the rest at the cage's south side, watching
        game.player.place(a.player.x, a.player.z, Math.PI, a.player.y); game.follow.snapBehind(Math.PI);
        ['erez', 'ido'].forEach((id, i) => { const n = game.npc(id), p = a.allies[i]; n.target = null; n.place(p.x, p.z, Math.PI, p.y); n.model.setPose(null); game.squad.send(id, { x: p.x, z: p.z, yaw: Math.PI }, { label: 'בכלוב' }); n.target = null; });
        const out = [[9.6, -41.6], [11.6, -41.0], [16.4, -41.0], [18.4, -41.6], [10.6, -39.8], [17.4, -39.8]];
        TEAM.filter((id) => id !== 'erez' && id !== 'ido').forEach((id, i) => { const n = game.npc(id), p = L(game, ...out[i]); n.target = null; n.place(p.x, p.z, Math.PI, p.y); n.model.setPose(null); game.squad.send(id, { x: p.x, z: p.z, yaw: Math.PI }, { label: 'צופה' }); n.target = null; n.idle = 'cheer'; });
        const h = stand(game, 'hammer', a.hammer, { yaw: 0, idle: 'arms' });
        h.body.enabled = true;
        f.doors.cage.lock(); // shut behind them
        const hp = h.pos;
        m.beats = beats(game, [
          ['do', () => { game.follow.shot({ x: a.gateIn.x + 1.2, y: a.gateIn.y + 2.4, z: a.gateIn.z + 0.6 }, { x: hp.x, y: hp.y + 1.9, z: hp.z }, 9999); game.sound?.hit?.('crash', 0.6); }],
          ['wait', 1.0],
          ['do', () => { game.hud.banner('מיני-בוס', 'הפטיש', 'זירת המעצר', 2600); game.follow.shot({ x: hp.x + 1.6, y: hp.y + 0.9, z: hp.z + 3.6 }, { x: hp.x, y: hp.y + 2.0, z: hp.z }, 9999); }],
          ['say', HAMMER.slice(0, 1)],
          ['do', () => { const me = game.player.pos; game.follow.shot({ x: me.x - 1.6, y: me.y + 1.8, z: me.z - 2.6 }, { x: me.x, y: me.y + 1.5, z: me.z }, 9999); }],
          ['say', HAMMER.slice(1, 2)],
          ['do', () => { const me = game.player.pos; game.follow.shot({ x: me.x + 0.4, y: me.y + 3.2, z: me.z + 5.2 }, { x: hp.x, y: hp.y + 1.2, z: hp.z }, 9999); }],
          ['say', HAMMER.slice(2)],
        ]);
      },
      target(m, game) { const h = game.npc('hammer'); return m.s.won ? null : { x: h.pos.x, z: h.pos.z, y: h.pos.y, r: 1.6 }; },
      update(m, game, dt) {
        const f = FAC(game);
        m.beats?.update(dt);
        if (m.beats?.done && !m.s.fightH) {
          m.beats = null; m.s.fightH = true;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(Math.PI);
          const live = attempt(game, m);
          brawl(m, game, {
            foes: [{ id: 'hammer', boss: true, name: 'הפטיש', hp: 240, power: 1.15, windup: 1.1, armor: 0.8, phases: [0.6, 0.3] }],
            allies: ['erez', 'ido'], max: 1, allyHp: 140, allyPower: 0.8,
            onPhase: (o, k) => { if (live()) game.dialogue.play(PHASE[k - 1] || []); },
          });
          m.s.tipT = 1;
        }
        if (m.fight && !m.fight.over && (m.s.tipT -= dt) <= 0 && m.s.tip < TIP_BOSS.length) { game.hud.toast(TIP_BOSS[m.s.tip++], 3200); m.s.tipT = 6; }
        const b = m.fight?.opponents[0];
        say(m, game, !m.s.fightH ? 'הפטיש' : m.s.won ? 'הפטיש על הרצפה' : `הפטיש · לחסום, להתחמק, קומבו ומכה חזקה · ${Math.round((b?.fighter.hpFrac ?? 1) * 100)}%`);
        if (m.s.won && !m.s.endH) {
          m.s.endH = true;
          endBrawl(m, game);
          game.npc('hammer').model.setPose('down');
          f.doors.cage.unlock(); f.doors.cage.setOpen(true);
          for (const id of TEAM) { const n = game.npc(id); if (n.idle === 'cheer') n.idle = null; n.model.setPose(null); game.squad.release(id); }
          // the crowd on the stands runs for it
          CROWD.forEach((id, i) => { const n = game.npc(id); n.idle = null; n.model.setPose(null); const to = f.arena.stands[['west', 'east', 'north'][i]]; n.walkTo(to.x, to.z, { run: true }); });
          m.s.fled = game.time + 3.5;
          dropCard(m, game);
          game.dialogue.play(DOWN);
          return 'next';
        }
        return null;
      },
    },
    { // 7: the access card
      objective: 'כרטיס הגישה',
      enter(m, game) { dropCard(m, game); m.s.taken = false; },
      target(m, game) { return m.s.taken || !m.s.cardAt ? null : { ...m.s.cardAt, r: 0.8 }; },
      interaction(m, game) {
        if (game.mode !== 'foot' || m.s.taken || !m.s.cardAt || !near(game.player.pos, m.s.cardAt, 1.8)) return null;
        return { label: 'לקחת את כרטיס הגישה', priority: 6, run: () => {
          m.s.taken = true; if (m.card) { gone(m.card); m.card = null; }
          game.sound?.chime?.(true);
          game.hud.banner('נמצא', 'כרטיס גישה', 'מחסן הנשקים', 2600);
          m.beats = beats(game, [['say', CARD], ['wait', 0.3]]);
        } };
      },
      update(m, game, dt) {
        if (m.s.fled && game.time > m.s.fled) { m.s.fled = null; away(game, CROWD); }
        m.beats?.update(dt);
        say(m, game, m.s.taken ? 'כרטיס גישה למחסן הנשקים' : 'לקחת את כרטיס הגישה מהפטיש');
        return m.s.taken && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; if (m.s.fled) away(game, CROWD); },
    },
  ],
  complete(m, game) { m.done = true; },
};
