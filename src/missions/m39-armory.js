// Chapter nine, mission 6, "מחזירים את הרובים!". With the Hammer's access card, east along the iron corridor
// to the armory: two of the Order's men who ran from the arena's stands (a fist fight, still bare-handed),
// the heavy door and its card reader (the two inside come at them), the bars across the room and their
// keypad — the code is on the quartermaster's clipboard, written back to front. The gate slides open and the
// camera finds the wall: every marker the Order took from the gang, each in its owner's colour. Ido's and
// Erez's lines, Nehorai lifts his own ("עכשיו מתחילה המסיבה."), and each of them takes his own marker off the
// wall (the stash given back one by one, the wall emptying, the fire button back, all of it saved). Paint and
// fists only; the gang stays loyal to the last man. Invented, all of it.
import { near, say } from './missions.js';
import { COLORS } from '../combat/paint.js';
import { TEAM, NAMES, endCrew, attempt, handsOver, armCrew } from './phoenix.js';
import { FAC, L, underground, unarmed, disarmAll, rearmed, stand, away, keepBeaten, walkPath, brawl, endBrawl, beats, clearStage, gangAt } from './phoenix-b.js';

const HALL = ['og14', 'og15'];   // ran from the arena's stands to the armory
const INSIDE = ['og16', 'og3'];  // the quartermaster and the man with him
const ALL = [...HALL, ...INSIDE];
const CODE = '4719';
const CLIP = ['נשקייה · משמרת לילה', 'קוד הסורגים — לקרוא', 'מהסוף להתחלה:', '9 · 1 · 7 · 4', 'לא להשאיר פתוח'];
const DOORS = { arena: true, cage: true, armory: 'locked', rackGate: 'locked', t1Corridor: 'locked', shutter: 'locked', machA: true, machB: true, guardRoom2: false, guardRoom2Back: 'locked', guardRoom1Back: 'locked' };

const START = [['עידו', 'מחסן הנשקים. מזרחה, במסדרון.'], ['ארז', 'והפעם יש לנו כרטיס.']];
const HALL_SEE = [['שומר', 'הם יצאו מהזירה! לעצור אותם!'], ['נהוראי', 'עוד שניים. בלי רובים, כמו קודם.']];
const READER = [['נהוראי', 'הכרטיס של הפטיש.']];
const DOOR_OPEN = [['שומר', 'מי פתח את הדלת?!']];
const BARS = [['עידו', 'סורגים. ומקלדת עם קוד.'], ['ארז', 'לאחראי יש לוח על הקיר. אולי הוא רשם את הקוד.']];
const READ = [['נהוראי', 'מהסוף להתחלה. ארבע, שבע, אחת, תשע.']];
// the user's lines, exactly
const WALL = [['עידו', 'סוף סוף! מצאתי את האהבה של החיים שלי!'], ['ארז', 'עידו, תתאפס על עצמך.']];
const PARTY = [['נהוראי', 'עכשיו מתחילה המסיבה.']];
const KAI = [['ליאם', 'ניקח גם את של קאי. שיהיה לו כשנחזור.']];
const ARMED = [['ארז', 'כולם חמושים. כל אחד עם שלו.'], ['עידו', 'עכשיו זה משחק אחר.']];
const LOST = 'השומרים הפילו את נהוראי. ארז: "עוד קצת, אחי. לחסום כשהטבעת אדומה, ומכה חזקה על מי שמחזיק ידיים למעלה."';

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
const HALL_AT = (game) => [L(game, 40, -27.2, 0, -Math.PI / 2), L(game, 41.6, -29, 0, -Math.PI / 2)];
const INSIDE_AT = (game) => [L(game, 52, -44, 0, 0), L(game, 60, -46, 0, 0)];
function doors(game) { const f = FAC(game); f.reset(); f.setDoors(DOORS); f.snapDoors(); f.armory.clipboard.setText(CLIP); f.armory.reader.light(false); f.armory.keypad.light(false); }
// the scene at a checkpoint: who is beaten where, who waits where, which door is open
function people(m, game, cp) {
  const f = FAC(game);
  away(game, ALL);
  keepBeaten(game, ['hammer'], [f.arena.hammer]);
  if (cp >= 2) keepBeaten(game, HALL, HALL_AT(game)); else HALL_AT(game).forEach((p, i) => stand(game, HALL[i], p));
  if (cp >= 3) keepBeaten(game, INSIDE, INSIDE_AT(game).map((p) => ({ ...p, yaw: 2.6 }))); else INSIDE_AT(game).forEach((p, i) => stand(game, INSIDE[i], p, { idle: i ? 'arms' : null }));
}
// the friends off to the wall, each to his own marker; he takes it when he gets there
function rearmGang(m, game) {
  const rack = FAC(game).armory.rack, live = attempt(game, m);
  m.s.going = {}; m.s.armed = m.s.armed || {};
  TEAM.forEach((id, k) => {
    if (m.s.armed[id]) return;
    const mk = rack.of(id); if (!mk) return;
    m.s.going[id] = game.time + 9 + k * 0.4;
    game.squad.send(id, mk.at, { label: 'מצטייד', onArrive: () => { if (live()) takeMarker(m, game, id); } });
  });
}
function takeMarker(m, game, id) {
  if (m.s.armed[id]) return;
  const rack = FAC(game).armory.rack, mk = rack.of(id);
  m.s.armed[id] = true;
  game.paint.unstash(id);
  if (!game.paint.allies.some((a) => a.npc.id === id)) game.paint.addAlly(game.npc(id), COLORS[id]); // nothing of his was in the stash: his own colour all the same
  if (mk) rack.take(mk.i);
  game.sound?.hit?.('block', 0.35);
  game.hud.toast(`${NAMES[id]} חמוש`, 1000);
  game.squad.release(id);
  if (id === 'liam') { const kai = rack.of('kai'); if (kai && !kai.taken) { rack.take(kai.i); game.dialogue.play(KAI); } }
}

export default {
  id: 'armory', chapter: 9, number: 6, title: 'מחזירים את הרובים!', requires: ['barehands'], follows: true,
  where: 'בזירת המעצר',
  startAt: (game) => { const a = FAC(game)?.arena; return a ? { ...a.gateOut, r: 2 } : null; },
  reward: { money: 600, unlocks: ['armory'], text: 'הנשקים חזרו לחבורה · 600 ₪' },

  setup(m, game) { m.s = {}; m.fightAllies = []; disarmAll(game); underground(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const s = FAC(game).arena.gateOut; game.player.place(s.x, s.z, 0, s.y); game.follow.snapBehind(0); },
  failIf(m, game) { return m.s.lost ? LOST : null; },
  restore(m, game, cp) {
    const f = FAC(game), A = f.armory;
    clearStage(m, game); underground(game);
    doors(game);
    m.s = { armed: {}, read: false, gate: false };
    people(m, game, cp);
    if (cp >= 3) { A.door.unlock(); A.door.setOpen(true); A.door.snap(); A.reader.light(true); }
    if (cp >= 5) { A.gate.unlock(); A.gate.setOpen(true); A.gate.snap(); A.keypad.light(true); m.s.read = true; m.s.gate = true; }
    A.rack.reset();
    const at = [f.arena.gateOut, L(game, 9, -28, 0, Math.PI / 2), L(game, 49, -28, 0, Math.PI / 2), A.inside, A.inside, A.behind][cp] || f.arena.gateOut;
    const yaw = [0, Math.PI / 2, Math.PI / 2, Math.PI, Math.PI, Math.PI][cp] ?? 0;
    gangAt(game, at, yaw);
    unarmed(game); // before the wall nobody holds a marker (a fresh page, a retry, a reload)
  },
  cleanup(m, game) {
    clearStage(m, game);
    const f = FAC(game);
    if (!m.done || !handsOver(game)) {
      away(game, [...ALL, 'hammer']); f.reset(); f.snapDoors();
      if (m.done || game.missions.done('armory')) rearmed(game);
      endCrew(game); for (const id of TEAM) game.npc(id).model.setPose(null);
    } else underground(game); // handed straight on: still under the ground, the map still covered
  },

  steps: [
    { // 0: out of the arena
      objective: 'מחסן הנשקים',
      enter(m, game) {
        const f = FAC(game);
        if (!game.squad.active || game.squad.ids.length < TEAM.length) gangAt(game, f.arena.gateOut, 0);
        const me = { ...game.player.pos }, yaw = game.player.yaw;
        doors(game);
        people(m, game, 0);
        unarmed(game);
        game.player.place(me.x, me.z, yaw, me.y);
        m.s = { armed: {} };
        m.beats = beats(game, [['say', START]]);
      },
      target(m, game) { const f = FAC(game); return f.zoneAt(game.player.pos.x, game.player.pos.z) === 'arena' ? { ...f.arena.doorAt, r: 1.6 } : { ...f.armory.reader.at, r: 1.4 }; },
      update(m, game, dt) {
        const f = FAC(game);
        m.beats?.update(dt);
        say(m, game, 'למחסן הנשקים · מהזירה למסדרון, ומזרחה');
        return f.zoneAt(game.player.pos.x, game.player.pos.z) === 'corridor' ? 'next' : null;
      },
      exit(m, game) { m.beats = null; },
    },
    { // 1: two in the corridor
      objective: 'שומרים במסדרון', checkpoint: true,
      enter(m, game) { m.s.fight1 = false; m.s.end1 = false; m.s.won = false; },
      target(m, game) { return nearestFoe(m, game, HALL) || { ...FAC(game).armory.reader.at, r: 1.4 }; },
      update(m, game) {
        const l = local(game);
        if (!m.s.fight1 && (l.x > 22 || HALL.some((id) => near(game.npc(id).pos, game.player.pos, 11)))) {
          m.s.fight1 = true;
          game.dialogue.play(HALL_SEE);
          brawl(m, game, { foes: [{ id: 'og14', hp: 75, power: 0.9, aggression: 1.0, windup: 0.66, moves: ['jab', 'cross', 'swing'] }, { id: 'og15', hp: 75, power: 0.9, aggression: 1.0, windup: 0.68, guard: 0.35, moves: ['swing', 'cross'] }], allies: ['erez', 'ido', 'hadar'], max: 2 });
        }
        say(m, game, !m.s.fight1 ? 'מזרחה במסדרון הברזל' : m.s.won ? 'המסדרון נקי' : `שניים מהיציעים · להפיל אותם (${HALL.length - standing(m, HALL)}/${HALL.length})`);
        if (m.s.won && !m.s.end1) { m.s.end1 = true; endBrawl(m, game); return 'next'; }
        return null;
      },
    },
    { // 2: the heavy door: the card; the two inside come at them
      objective: 'הדלת של המחסן', checkpoint: true,
      enter(m, game) { m.s.card = false; m.s.out2 = false; m.s.outN = 0; m.s.fight2 = false; m.s.end2 = false; m.s.won = false; },
      target(m, game) { return !m.s.card ? { ...FAC(game).armory.reader.at, r: 1.0 } : nearestFoe(m, game, INSIDE); },
      interaction(m, game) {
        const A = FAC(game).armory;
        if (game.mode !== 'foot' || m.s.card || !near(game.player.pos, A.reader.at, 1.7)) return null;
        return { label: 'להעביר את כרטיס הגישה', priority: 6, run: () => {
          m.s.card = true;
          A.reader.light(true); game.sound?.beep?.(2, 1400); game.hud.toast('הכרטיס התקבל', 1500);
          A.door.unlock(); A.door.setOpen(true);
          game.dialogue.play(READER);
          m.s.cardT = game.time;
        } };
      },
      update(m, game) {
        // the two inside heard the door: out through it at them (anyone slow is in the doorway when it starts)
        if (m.s.card && !m.s.out2 && game.time - m.s.cardT > 0.8) {
          m.s.out2 = true;
          const live = attempt(game, m);
          INSIDE.forEach((id, i) => { const n = game.npc(id); n.idle = null; n.model.setPose(null); walkPath(n, [L(game, 56 + (i ? 0.5 : -0.5), -39), L(game, 56 + (i ? 0.8 : -0.8), -33.6)], { run: true, onDone: () => { if (live()) m.s.outN = (m.s.outN || 0) + 1; } }); });
        }
        if (m.s.out2 && !m.s.fight2 && ((m.s.outN || 0) >= INSIDE.length || game.time - m.s.cardT > 6)) {
          INSIDE.forEach((id, i) => { const n = game.npc(id); if (local(game, n.pos).z < -36.4) { const p = L(game, 56 + (i ? 0.8 : -0.8), -34.6); n.place(p.x, p.z, 0, p.y); } });
          m.s.fight2 = true;
          game.dialogue.play(DOOR_OPEN);
          brawl(m, game, { foes: [{ id: 'og16', hp: 90, power: 0.95, aggression: 0.95, windup: 0.72, guard: 0.6, moves: ['swing', 'cross', 'jab'] }, { id: 'og3', hp: 65, power: 0.85, aggression: 1.0, windup: 0.68, moves: ['jab', 'cross', 'swing'] }], allies: ['erez', 'ido', 'muller'], max: 2 });
          game.hud.toast('האחראי חוסם: מכה חזקה שוברת את החסימה', 3000);
        }
        say(m, game, !m.s.card ? 'הדלת של מחסן הנשקים · להעביר את הכרטיס בקורא' : m.s.won ? 'המחסן פתוח' : `האחראי ועוד אחד · להפיל אותם (${INSIDE.length - standing(m, INSIDE)}/${INSIDE.length})`);
        if (m.s.won && !m.s.end2) { m.s.end2 = true; endBrawl(m, game); game.dialogue.play(BARS); return 'next'; }
        return null;
      },
    },
    { // 3: the bars: the clipboard, the code back to front, the keypad
      objective: 'הסורגים', checkpoint: true,
      enter(m, game) { m.s.read = !!m.s.read; m.s.gate = false; m.s.typing = false; FAC(game).armory.clipboard.setText(CLIP); },
      target(m, game) { const A = FAC(game).armory; return !m.s.read ? { ...A.clipboard.at, r: 1.0 } : { ...A.keypad.at, r: 1.0 }; },
      interaction(m, game) {
        const A = FAC(game).armory, me = game.player.pos;
        if (game.mode !== 'foot' || m.s.gate || m.s.typing) return null;
        if (near(me, A.clipboard.at, 1.8)) return { label: 'לקרוא את הלוח', priority: 6, run: () => { m.s.read = true; game.hud.toast(CLIP.slice(1, 4).join(' '), 4200); game.dialogue.play(READ); } };
        if (near(me, A.keypad.at, 1.6)) return { label: 'להקיש את הקוד', priority: 6, run: () => {
          m.s.typing = true;
          const live = attempt(game, m);
          game.keypad.open(CODE, m.s.read ? 'הקוד מהלוח · לקרוא מהסוף להתחלה' : 'הקוד רשום על הלוח שליד השולחן').then((ok) => {
            if (!live()) return;
            m.s.typing = false;
            if (!ok) return;
            m.s.gate = true; A.keypad.light(true); A.gate.unlock(); A.gate.setOpen(true); game.sound?.hit?.('crash', 0.4);
          });
        } };
        return null;
      },
      update(m, game) {
        say(m, game, m.s.gate ? 'הסורגים נפתחים' : !m.s.read ? 'הקוד לסורגים · הלוח של האחראי על הקיר' : 'להקיש את הקוד במקלדת שעל הסורגים');
        return m.s.gate ? 'next' : null;
      },
    },
    { // 4: the wall of weapons
      objective: 'קיר הנשקים',
      enter(m, game) {
        const f = FAC(game), A = f.armory;
        game.cutscene = true; game.hud.setCinematic(true);
        const wall = L(game, 56, -61.6, 1.55);
        m.beats = beats(game, [
          // through the bars as they slide (the name of the place first), then in: the wall, clear of any caption
          ['do', () => { game.follow.shot(L(game, 56, -51.4, 1.9), wall, 9999); game.hud.banner('נמצא', 'קיר הנשקים', 'כל מה שנלקח מהחבורה', 1300); }],
          ['wait', 1.5],
          ['do', () => { game.follow.shot(L(game, 56, -56.6, 1.65), wall, 9999); }],
          ['wait', 2.6],
          ['do', () => {
            // Ido at the wall, Erez behind him
            const ido = game.npc('ido'), erez = game.npc('erez'), a = A.rack.of('ido').at, b = L(game, 54.6, -57.2);
            game.squad.send('ido', a, { label: 'בקיר' }); ido.target = null; ido.place(a.x, a.z + 0.6, Math.PI, a.y); ido.model.setPose('cheer');
            game.squad.send('erez', b, { label: 'מאחוריו' }); erez.target = null; erez.place(b.x, b.z, Math.PI, b.y); erez.lookAt(ido.pos.x, ido.pos.z);
            game.follow.shot(L(game, 51.4, -57.0, 1.8), { x: ido.pos.x, y: ido.pos.y + 1.4, z: ido.pos.z }, 9999);
          }],
          ['say', WALL.slice(0, 1)],
          ['do', () => { const erez = game.npc('erez'); game.follow.shot(L(game, 51.8, -55.6, 1.7), { x: erez.pos.x, y: erez.pos.y + 1.5, z: erez.pos.z }, 9999); game.npc('ido').model.setPose(null); }],
          ['say', WALL.slice(1)],
          ['wait', 0.5],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; for (const id of ['ido', 'erez']) { game.npc(id).model.setPose(null); game.squad.release(id); } },
    },
    { // 5: his own marker off the wall; then each of them takes his own
      objective: 'לקחת את הרובה שלך', checkpoint: true,
      enter(m, game) { m.s.mine = false; m.s.armed = {}; m.s.allArmed = false; m.s.going = null; FAC(game).armory.rack.reset(); unarmed(game); },
      target(m, game) { const mk = FAC(game).armory.rack.of('nehorai'); return !m.s.mine && mk ? { ...mk.at, r: 0.9 } : null; },
      interaction(m, game) {
        const mk = FAC(game).armory.rack.of('nehorai');
        if (game.mode !== 'foot' || m.s.mine || !mk || !near(game.player.pos, mk.at, 1.7)) return null;
        return { label: 'לקחת את הרובה שלך', priority: 6, run: () => {
          m.s.mine = true;
          FAC(game).armory.rack.take(mk.i);
          game.paint.unstash('player');
          if (!game.paint.armed) game.paint.armPlayer(COLORS.nehorai); // nothing of his in the stash: his own colour all the same
          game.sound?.chime?.(true);
          game.cutscene = true; game.hud.setCinematic(true);
          const me = game.player.pos;
          game.follow.shot({ x: me.x + Math.sin(game.player.yaw) * 2.2 + 0.6, y: me.y + 1.6, z: me.z + Math.cos(game.player.yaw) * 2.2 }, { x: me.x, y: me.y + 1.45, z: me.z }, 9999);
          m.beats = beats(game, [
            ['do', () => game.nehorai.setPose('aim')],
            ['wait', 0.8],
            ['say', PARTY],
            ['do', () => { game.nehorai.setPose(null); game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); rearmGang(m, game); }],
          ]);
        } };
      },
      update(m, game, dt) {
        m.beats?.update(dt);
        // a friend who cannot find the way to his marker is put there: every one of them gets his own
        if (m.s.going) for (const id of TEAM) if (!m.s.armed[id] && m.s.going[id] && game.time > m.s.going[id]) { const mk = FAC(game).armory.rack.of(id); const n = game.npc(id); n.target = null; if (mk) n.place(mk.at.x, mk.at.z, Math.PI, mk.at.y); takeMarker(m, game, id); }
        const k = TEAM.filter((id) => m.s.armed[id]).length;
        if (m.s.mine && k === TEAM.length && !m.s.allArmed) {
          m.s.allArmed = true;
          game.paint.unstash(); armCrew(game); game.paint.reset(); // the stash empty (and saved so), nobody left without his own
          game.hud.toast('כל החבורה חמושה', 2000);
          m.beats = beats(game, [['wait', 0.6], ['say', ARMED], ['wait', 0.4]]);
        }
        say(m, game, !m.s.mine ? 'הרובה שלך על הקיר · לקחת אותו' : k < TEAM.length ? `החבורה מצטיידת מחדש (${k}/${TEAM.length})` : 'כל החבורה חמושה');
        return m.s.allArmed && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; for (const id of TEAM) game.squad.release(id); },
    },
  ],
  complete(m, game) { m.done = true; },
};
