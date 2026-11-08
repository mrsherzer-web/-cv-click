// Chapter nine, mission 8, "נהוראי נפצע!". The hangar, still in the fight: Erez is shut in the side room behind
// the door the Order's charge buckled, and Nehorai gets to it under fire and wrenches it open. A moment later
// the burning jeep's fuel goes up: a warning, Nehorai shoves Erez clear, and the blast throws him to the floor.
// The picture blurs, the sound goes dull (only a heartbeat), he tries to sit up and falls back; Ido's shout,
// Erez over him, his last words, the eyes close, black. Nothing of it is a Game Over: no mark counts, no fail
// screen. The player is Ido now — SAVE NAHORAI — and the seven goals are done for real: reach him; hold off the
// Order's men who come for him; the first-aid kit on the hangar's west wall; the treatment; Ido and Erez carry
// him to the safe room (the player walks it, slowly, the friends ahead to secure the room); the security
// door's wheel; and the doorway held against the last of them until Erez's treatment is done and the heavy
// door seals. Then the quiet: Nehorai on the cot, Erez on a stool beside him, two lines, the music fading to
// nothing, a few seconds where nothing happens. A knock-out, a bandage; nothing graphic. Paint for everyone
// else: a marked man sits down. The whole gang stays loyal. Invented, all of it.
import { near, say, nearestGuard } from './missions.js';
import { OUT_AT } from '../combat/paint.js';
import { TEAM, endCrew, failOut, Work } from './phoenix.js';
import {
  FAC, L, zone, handsTo, underground, hush, become, nehoraiDown, nehoraiAway, gangAt, armed, upAgain, freshMarks, offBoard, Wave,
  FBlast, wrecks, truss, rumble, redLight, beats, later, talkOn, clearAll, Carry, bandage, cot, roomSpots, stool, stay,
  exitClear, shutExit,
} from './phoenix-c.js';

const ORDER = Array.from({ length: 16 }, (_, i) => `og${i + 1}`);
const OTHERS = TEAM.filter((id) => id !== 'erez' && id !== 'ido');
// where things happen (local points)
const ND = (g) => L(g, 66.6, 12.4, 0, -2.2);    // where the blast throws Nehorai
const ERZ = (g) => L(g, 65.4, 11.4, 0, 2.0);    // Erez over him
const IDO_AT = (g) => L(g, 50.5, 31, 0, 2.43);  // where Ido is in the fight when it happens (facing the blast)
const OUTSIDE = (g) => L(g, 58, 16, 0, Math.PI * 0.8);
// the Order's men: at the side room while Nehorai works the door; the ones who come for him; the last at the safe room
const AT_DOOR = (g) => [
  { id: 'og1', from: L(g, 79, 40), post: L(g, 74, 24) }, { id: 'og2', from: L(g, 33, 47), post: L(g, 50, 16) }, { id: 'og4', from: L(g, 80, 47), post: L(g, 72, 18) },
];
// (those by the great door come in just inside it as it rises: from out on the ramp the straight way to him runs
// into the corner of its walls, and the door comes down again only once every one of them is in)
const FOR_HIM = (g) => [
  { id: 'og13', from: L(g, 84.3, 29.2), post: L(g, 74, 16) }, { id: 'og5', from: L(g, 33, 20), post: L(g, 56, 14) },
  { id: 'og6', from: L(g, 84.3, 31.2), post: L(g, 72, 22) }, { id: 'og3', from: L(g, 33, 47), post: L(g, 60, 20) },
  { id: 'og14', from: L(g, 84.3, 30.2), post: L(g, 70, 10) },
];
// the last of them, in through the two west doors (the great door is shut by now)
const AT_ROOM = (g) => [
  { id: 'og7', from: L(g, 33, 20), post: L(g, 42, 44) }, { id: 'og8', from: L(g, 33.6, 46), post: L(g, 54, 46) },
  { id: 'og9', from: L(g, 33, 47.4), post: L(g, 38, 50) }, { id: 'og10', from: L(g, 33.6, 22), post: L(g, 52, 50) },
  { id: 'og11', from: L(g, 33, 21), post: L(g, 44, 48) }, { id: 'og12', from: L(g, 33, 48.8), post: L(g, 50, 44) },
];
// the friends holding the hangar side of the safe room's door
const HOLD = (g) => [L(g, 43.6, 52, 0, 0), L(g, 50.4, 52, 0, 0), L(g, 41.4, 50.2, 0, 0.4), L(g, 52.6, 50.2, 0, -0.4), L(g, 45.6, 50.6, 0, 0), L(g, 48.4, 50.6, 0, 0)];
const TREAT = 35;      // seconds of Erez's treatment behind the doorway

const OPEN = [['ארז', 'נהוראי, הדלת לא זזה! משהו נפל עליה מבחוץ!', 'phone'], ['נהוראי', 'אני בא, אחי. תחזיק מעמד.'], ['עידו', 'נחפה עליך! תגיע לדלת!']];
const FREED = [['ארז', 'אחי… חשבתי שאני נשאר שם.'], ['נהוראי', 'אף אחד לא נשאר מאחור.']];
const MOVE = [['נהוראי', 'ארז, זוז!']];
// the user's lines, exactly
const SHOUT = [['עידו', 'נהוראיייי!!!']];
const LOOK = [['ארז', 'אחי, תסתכל עליי! אל תעצום עיניים!']];
const LAST = [['נהוראי', 'תוציאו… את כולם…']];
const QUIET = [['ארז', 'נהוראי, אחי… אתה לא יכול לעזוב אותנו עכשיו.'], ['עידו', 'הוא לא עוזב אותנו. אני מכיר אותו.']];
const REACHED = [['ארז', 'עידו! הוא נושם, אבל הוא לא איתנו. הם באים לקחת אותו!']];
const KIT = [['ארז', 'ערכת עזרה ראשונה! על הקיר המערבי של ההאנגר!']];
const GOT_KIT = [['עידו', 'יש ערכה! חוזר אליו!']];
const TREATED = [['ארז', 'הוא נושם. הדופק חלש, אבל הוא נושם.'], ['עידו', 'צריך להוציא אותו מפה. החדר הבטוח — בקיר הדרומי!']];
const LIFT = [['ליאם', 'אחים, אנחנו מאבטחים את החדר הבטוח! תביאו אותו!']];
const WHEEL = [['ארז', 'הדלת נסגרת לאט. ואני צריך עוד כמה דקות איתו.'], ['עידו', 'אז אני מחזיק את הכניסה.']];
const IN = [['עידו', 'סיימת? כולם פנימה!']];
const IDO_OUT = 'עידו סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "מההתחלה, עידו. נהוראי צריך אותך עומד — מאחורי מחסה."';
const DOOR_OUT = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "מההתחלה, אחי. קודם שלושת אלה שבאים לדלת — ואז מושכים אותה."';

// the doors by checkpoint: the side room shut on Erez until he is out, the safe room open until its door is sealed
function doors(game, cp) {
  const f = FAC(game);
  f.setDoors({ armory: true, rackGate: true, t1Corridor: true, t1Stores: true, t2Stores: true, hangarW: true, t2Hangar: true, t1Hangar: 'locked', trap: cp <= 1 ? 'locked' : true, saferoom: true, exit: 'locked' });
  f.snapDoors();
  f.armory.rack.all();
}
// the fire and the smoke of the fight so far: the buckled door, the vehicles that went up, and the big blast
function scars(m, game, cp, blown) {
  const H = FAC(game).hangar, door = L(game, 63, 8);
  wrecks(m, game, blown);
  truss(game, true); // the crane's truss, where it came down in the fight before
  m.smoke.push(game.fx.smokeColumn(door.x - 1.5, door.y + 0.3, door.z + 1.5, { r: 1, seconds: 900 }), game.fx.burn(door.x - 2.2, door.y + 0.1, door.z + 2.2, { r: 0.8, strength: 0.7, seconds: 900 }));
  if (cp >= 3) { const b = H.blast; m.smoke.push(game.fx.burn(b.x, b.y + 0.1, b.z, { r: 1.6, strength: 1.3, seconds: 900 }), game.fx.smokeColumn(b.x, b.y + 0.5, b.z, { r: 1.4, strength: 1.4, seconds: 900 })); }
}
// who plays and where everyone is, at a checkpoint (a retry, a reload): the whole scene
function stage(m, game, cp) {
  const f = FAC(game), H = f.hangar, T = H.trap, C = cot(game);
  const blown = H.vehicles.map((v, i) => (v.blown ? i : -1)).filter((i) => i >= 0);
  clearAll(m, game); underground(game);
  stool(game, null);
  doors(game, cp);
  game.paint.dispose(); offBoard(game, ORDER);
  const ido = cp >= 3;
  become(game, ido ? 'ido' : 'nehorai');
  if (cp >= 6) f.medkit.take(); else f.medkit.reset();
  const me = [OUTSIDE(game), OUTSIDE(game), OUTSIDE(game), IDO_AT(game), L(game, 63.5, 15, 0, -0.6), L(game, 63.5, 15, 0, -2.4), L(game, 33.2, 38, 0, Math.PI / 2), L(game, 64.5, 14.2, 0, -0.6), L(game, 50.6, 61, 0, -Math.PI / 2), L(game, 47, 57.6, 0, Math.PI)][cp] || OUTSIDE(game);
  if (!ido) {
    nehoraiAway(game);
    gangAt(game, me, me.yaw, { ids: TEAM, lead: 'nehorai' });
    if (cp <= 1) stay(game, 'erez', T.room, { label: 'לכוד' });
  } else {
    gangAt(game, me, me.yaw, { ids: TEAM.filter((id) => id !== 'ido'), lead: 'ido' });
    const n = cp >= 8 ? nehoraiDown(game, C.lie, { y: C.lie.y }) : nehoraiDown(game, ND(game));
    bandage(n.model, cp >= 7);
    if (cp <= 7) stay(game, 'erez', ERZ(game), { label: 'שומר עליו' }); else stay(game, 'erez', C.by[0], { pose: 'carry', label: 'מטפל בו' });
    if (cp >= 8) roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => stay(game, OTHERS[i], cp >= 9 ? HOLD(game)[i] : p, { label: cp >= 9 ? 'בכניסה' : 'בחדר' }));
  }
  armed(game, game.squad.ids);
  game.paint.reset(); freshMarks(game);
  scars(m, game, cp, blown.length ? blown : [2]);
  redLight(game, ['hangar']);
  game.sound?.music?.(cp === 2 ? null : 'action', { fade: 0.4 });
  m.w = {}; m.s = { cp, injured: cp >= 2 };
}
const done = (w) => (w ? w.total - w.left : 0);
const nehorai = (game) => game.npc('nehorai');

export default {
  id: 'wounded', chapter: 9, number: 8, title: 'נהוראי נפצע!', requires: ['portwar'], follows: true, secret: true,
  where: 'בהאנגר',
  startAt: (game) => { const t = FAC(game)?.hangar.trap; return t ? { ...t.at, r: 2 } : null; },
  reward: { money: 1000, unlocks: ['wounded'], text: 'עידו וארז הצילו את נהוראי · 1,000 ₪' },

  setup(m, game) { m.s = {}; m.w = {}; m.live = []; m.beams = []; m.smoke = []; m.talk = []; underground(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); if (game.playingAs !== 'nehorai') become(game, 'nehorai'); const p = OUTSIDE(game); game.player.place(p.x, p.z, p.yaw, p.y); game.follow.snapBehind(p.yaw); underground(game); },
  // the blast and Nehorai on the floor are never a Game Over: no mark of his counts from the moment it warns;
  // only Ido marked three times, while he is played, ends a stretch (a retry from its checkpoint)
  failIf(m, game) {
    if (m.stepIndex === 1 && !m.s.injured) return failOut(m, game, [1]) && DOOR_OUT;
    if (m.stepIndex >= 3 && m.stepIndex <= 9 && game.playingAs === 'ido' && game.paint.hits >= OUT_AT) return IDO_OUT;
    return null;
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live || []) x.update(dt);
    m.carry?.update(dt);
    if (m.stepIndex !== 2 && m.stepIndex < 10) rumble(m, game, dt, { every: 14 });
    // he lies where he is: nobody walks him off his spot, nobody stands him up (a friend's habit, a reset)
    const n = game.npcs.get('nehorai');
    if (n?.visible && !m.carry && m.s.injured && n.model.pose !== 'floored' && m.stepIndex >= 3 && m.stepIndex <= 10) n.model.setPose('floored');
    // the great door, raised for the men who come for him, comes down again once they are all in and nobody is
    // out on the ramp or under it (whichever goal that is by then)
    const f = FAC(game);
    if (m.s.exitOpen && (m.s.exitT += dt) > 10 && m.w.him?.done && exitClear(game)) { m.s.exitOpen = false; shutExit(game); game.sound?.hit?.('crash', 0.5); }
    // the security door creeping shut once its wheel is turned: the heavy leaf swung partway in, its lamp amber,
    // until it seals (the facility's tick leaves an open door's leaf alone while it stands fully open)
    const D = f.saferoom.door;
    if (m.s.ajar != null && D.open) { D.pose(m.s.ajar); D.lamp.set('amber'); }
  },
  cleanup(m, game) {
    const f = FAC(game);
    clearAll(m, game);
    if (m.done && handsTo(game, 'comeback')) { underground(game); return; } // the safe room, as it is, for the next mission
    stool(game, null); truss(game, false);
    if (game.playingAs !== 'nehorai') become(game, 'nehorai');
    bandage(nehorai(game).model, false); nehoraiAway(game);
    game.paint.dispose(); offBoard(game, ORDER);
    f.reset(); f.snapDoors(); f.armory.rack.all();
    for (const id of TEAM) game.npc(id).model.setPose(null);
    endCrew(game);
    game.overlay?.mapHidden(false);
  },

  steps: [
    { // 0: Erez behind the buckled door
      objective: 'ארז לכוד',
      enter(m, game) {
        const T = FAC(game).hangar.trap, p = game.player.pos;
        const keep = game.playingAs === 'nehorai' && zone(game) === 'hangar' && game.squad.active && game.paint.armed;
        stage(m, game, 0);
        if (keep) game.player.place(p.x, p.z, game.player.yaw, p.y);
        game.cutscene = true; game.hud.setCinematic(true);
        const door = L(game, 63, 8);
        game.follow.shot({ x: door.x + 5, y: door.y + 2.4, z: door.z + 7 }, { x: door.x, y: door.y + 1.3, z: door.z }, 9999);
        void T;
        m.beats = beats(game, [['wait', 0.6], ['say', OPEN], ['wait', 0.2]]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the damaged door, under fire
      objective: 'לחלץ את ארז · הדלת הפגועה', checkpoint: true,
      enter(m, game) {
        const T = FAC(game).hangar.trap;
        freshMarks(game); upAgain(game);
        m.w.door = new Wave(game, AT_DOOR(game), { gap: 1.6, hot: true, delay: 2 });
        m.s.freed = false;
        m.work = new Work(game, { at: T.at, seconds: 4, label: 'לשחרר את הדלת הפגועה', pill: 'מושך את הדלת', near: 2.2, onDone: () => {
          T.open(); m.s.freed = true;
          const e = game.npc('erez'), out = L(game, 61.4, 10.6);
          e.target = null; e.walkTo(out.x, out.z, { run: true, near: 0.4 });
          game.hud.toast('ארז בחוץ', 1500);
        } });
        later(m, game, [['ארז', 'אני לא מצליח לפתוח מבפנים! תמשוך מבחוץ!', 'phone']]);
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) { return m.s.freed ? null : { ...FAC(game).hangar.trap.at, r: 1.2 }; },
      update(m, game, dt) {
        m.w.door?.update(dt); m.work?.update(dt);
        say(m, game, m.s.freed ? 'ארז בחוץ' : m.work?.started ? 'מושך את הדלת · להישאר צמוד' : `לחלץ את ארז · הדלת הפגועה בקיר הצפוני · סומנת ${game.paint.hits}/3`);
        if (m.s.freed && !m.s.freedSaid) { m.s.freedSaid = true; m.s.free = beats(game, [['say', FREED]]); }
        m.s.free?.update(dt);
        return m.s.free?.done ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 2: the blast: Nehorai thrown down, the daze, the lines, the eyes close — and Ido at the controls
      objective: 'פיצוץ!',
      enter(m, game) {
        const f = FAC(game), H = f.hangar, b = H.blast, nd = ND(game), e = game.npc('erez'), P = game.paint;
        m.s.injured = true; // from here no mark counts and nothing fails: this is a story, not a defeat
        game.cutscene = true; game.hud.setCinematic(true);
        P.hits = 0; game.hud.paintClear();
        // the last of the Order here are down or gone: the blast is the story's, not a fight's
        for (const gd of P.guards) if (!gd.marked && gd.npc.visible) P.markGuard(gd, 'blast');
        const me = game.player.pos, tr = H.trap.at;
        if (Math.hypot(me.x - tr.x, me.z - tr.z) > 1.5) game.player.place(tr.x + 0.6, tr.z + 0.6, Math.PI, tr.y);
        game.follow.shot({ x: b.x - 9, y: b.y + 3.2, z: b.z + 6 }, { x: b.x + 1, y: b.y + 1.0, z: b.z - 2 }, 9999);
        // Ido is across the hangar in the fight (out of this shot): it is from there that he sees it, shouts, and
        // is played from (the controls come to him where he stands)
        const ia = IDO_AT(game); stay(game, 'ido', ia, { label: 'בקרב' }); game.npc('ido').lookAt(nd.x, nd.z);
        const C = { x: b.x, y: b.y, z: b.z };
        m.beats = beats(game, [
          // the warning: the ring, the beeps; he shoves Erez clear
          ['do', () => {
            m.live.push(new FBlast(game, { at: C, size: 3.4, warn: 1.7, radius: 5, fire: 0, hurts: false, marks: false, onBoom: () => {
              game.fx.burn(C.x, C.y + 0.1, C.z, { r: 1.6, strength: 1.3, seconds: 900 }); game.fx.smokeColumn(C.x, C.y + 0.5, C.z, { r: 1.4, strength: 1.4, seconds: 900 });
              game.follow.shake(1.4); game.sound?.boom?.(1.4);
              // thrown: down on the floor three metres off, dazed, the sound gone dull
              game.player.place(nd.x, nd.z, nd.yaw, nd.y); game.nehorai.setPose('floored');
              P.disarmPlayer();
              game.overlay?.flash('#fff3dc', 520, 0.9); game.overlay?.daze(0.85, 0.5);
              game.sound?.music?.(null, { fade: 0.2 }); m.stopSiren?.(); m.stopSiren = null;
              game.sound?.heartbeat?.(true, { bpm: 72, level: 0.6 });
              e.target = null; e.place(L(game, 58.6, 10.4).x, L(game, 58.6, 10.4).z, Math.PI / 2, nd.y); e.model.setPose('down');
              game.follow.shot({ x: nd.x - 3.4, y: nd.y + 1.3, z: nd.z + 2.6 }, { x: nd.x, y: nd.y + 0.4, z: nd.z }, 9999);
            } }));
            game.nehorai.play('shove');
            e.target = null; e.walkTo(L(game, 58.6, 10.4).x, L(game, 58.6, 10.4).z, { run: true, near: 0.3 });
          }],
          ['say', MOVE],
          ['until', () => m.live.every((x) => x.done)],
          ['wait', 1.4],
          // he tries to get up, and falls back
          ['do', () => { game.nehorai.setPose('down'); game.sound?.hit?.('block', 0.3); }],
          ['wait', 1.0],
          ['do', () => { game.nehorai.setPose('floored'); game.sound?.hit?.('crash', 0.35); game.follow.shake(0.25); game.overlay?.daze(0.95, 0.6); }],
          ['wait', 0.6],
          // Ido, where he stands across the hangar, turned to it: the camera on him as he shouts
          ['do', () => {
            const a = IDO_AT(game), i = game.npc('ido'), fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
            stay(game, 'ido', a, { label: 'בקרב' }); i.lookAt(nd.x, nd.z);
            game.follow.shot({ x: a.x + fx * 3.2 - fz * 1.3, y: a.y + 1.75, z: a.z + fz * 3.2 + fx * 1.3 }, { x: a.x, y: a.y + 1.5, z: a.z }, 9999);
          }],
          ['say', SHOUT],
          // Erez gets up and runs to him
          ['do', () => {
            const p = ERZ(game);
            e.model.setPose(null); game.squad.send('erez', p, { label: 'לידו', run: true }); m.s.runT = m.t;
            game.follow.shot({ x: nd.x + 1.0, y: nd.y + 1.6, z: nd.z + 3.4 }, { x: (nd.x + e.pos.x) / 2, y: nd.y + 0.9, z: (nd.z + e.pos.z) / 2 }, 9999);
          }],
          ['until', () => near(e.pos, ERZ(game), 1.1) || m.t - m.s.runT > 4],
          // his face over him
          ['do', () => { const p = ERZ(game); e.target = null; e.place(p.x, p.z, p.yaw, p.y); e.lookAt(nd.x, nd.z); game.follow.shot({ x: nd.x + 0.35, y: nd.y + 0.55, z: nd.z + 0.2 }, { x: p.x, y: p.y + 1.45, z: p.z }, 9999); }],
          ['say', LOOK],
          ['say', LAST],
          // the eyes close; black
          ['do', () => { game.overlay?.eyes(1, 2.4); game.overlay?.daze(1, 2.4); game.sound?.heartbeat?.(true, { bpm: 50, level: 0.55 }); }],
          ['wait', 2.8],
          // under the black: the controls to Ido
          ['do', () => {
            become(game, 'ido');
            const at = IDO_AT(game); // where he shouted from
            game.player.place(at.x, at.z, at.yaw, at.y); game.follow.snapBehind(at.yaw);
            const n = nehoraiDown(game, nd);
            bandage(n.model, false);
            for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) if (game[b]) game[b].held = true;
            game.squad.form(TEAM.filter((id) => id !== 'ido'), { near: game.player.pos, yaw: at.yaw, leader: 'ido' });
            stay(game, 'erez', ERZ(game), { label: 'שומר עליו' });
            armed(game, game.squad.ids); upAgain(game); freshMarks(game);
            game.sound?.heartbeat?.(false);
            game.follow.override = null;
            m.stopSiren = game.sound?.siren?.(600, 0.03) || null;
          }],
          ['wait', 1.0],
          ['do', () => {
            game.overlay?.eyes(0, 1.2); game.overlay?.daze(0, 1.4);
            game.sound?.music?.('action', { fade: 2 });
            game.cutscene = false; game.hud.setCinematic(false);
            game.hud.banner('', 'SAVE NAHORAI – הצילו את נהוראי!', 'כעת אתה משחק בתור עידו', 4200);
            game.hud.toast('כעת אתה משחק בתור עידו', 2600);
          }],
          ['wait', 0.4],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 3: 1. reach him
      objective: '1. להגיע לנהוראי', checkpoint: true,
      enter(m, game) { m.s.injured = true; },
      target: (m, game) => ({ ...ND(game), r: 1.6 }),
      update(m, game) {
        say(m, game, '1. להגיע לנהוראי · הוא שוכב ליד הדלת הפגועה');
        return near(game.player.pos, ND(game), 2.6) ? 'next' : null;
      },
      exit(m, game) { later(m, game, REACHED); },
    },
    { // 4: 2. hold them off him
      objective: '2. להגן עליו', checkpoint: true,
      enter(m, game) {
        const f = FAC(game);
        freshMarks(game); upAgain(game);
        m.w.him = new Wave(game, FOR_HIM(game), { gap: 1.5, hot: true, delay: 2.5 });
        f.doors.exit.unlock(); f.doors.exit.setOpen(true); m.s.exitOpen = true; m.s.exitT = 0;
      },
      target(m, game) { return nearestGuard(game, m.w.him?.ids) || { ...ND(game), r: 1.6 }; },
      update(m, game, dt) {
        const w = m.w.him, n = nehorai(game);
        w.update(dt);
        // they come for him: once in, each goes for where he lies
        for (const gd of w.out) if (!gd.him) { gd.him = true; gd.foe = { player: true, pos: n.pos, yaw: 0 }; }
        say(m, game, w.left ? `2. להגן עליו · לסמן אותם (${done(w)}/${w.total}) · סומנת ${game.paint.hits}/3` : '2. להגן עליו · הם בחוץ');
        return w.done && !w.left ? 'next' : null;
      },
      exit(m, game) { later(m, game, KIT); },
    },
    { // 5: 3. the first-aid kit
      objective: '3. למצוא ערכת עזרה ראשונה', checkpoint: true,
      enter(m, game) { freshMarks(game); upAgain(game); FAC(game).medkit.reset(); m.s.kit = false; },
      target: (m, game) => ({ ...FAC(game).medkit.at, r: 1.2 }),
      interaction(m, game) {
        const K = FAC(game).medkit;
        if (game.mode !== 'foot' || m.s.kit || K.taken || !near(game.player.pos, K.at, 1.8)) return null;
        return { label: 'לקחת את ערכת העזרה הראשונה', priority: 6, run: () => { m.s.kit = true; K.take(); game.sound?.chime?.(true); game.hud.toast('ערכת עזרה ראשונה', 1600); later(m, game, GOT_KIT); } };
      },
      update(m, game) {
        say(m, game, m.s.kit ? 'הערכה אצלך' : '3. למצוא ערכת עזרה ראשונה · על הקיר המערבי של ההאנגר');
        return m.s.kit ? 'next' : null;
      },
    },
    { // 6: 4. the treatment
      objective: '4. לטפל בנהוראי', checkpoint: true,
      enter(m, game) {
        freshMarks(game);
        m.s.treated = false;
        m.work = new Work(game, { at: ND(game), seconds: 4, label: 'לטפל בנהוראי', pill: 'חובש את נהוראי', near: 2.2, onStart: () => game.nehorai.setPose('carry'), onDone: () => {
          m.s.treated = true; game.nehorai.setPose(null);
          bandage(nehorai(game).model, true);
          later(m, game, TREATED);
        } });
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) { return m.s.treated ? null : { ...ND(game), r: 1.6 }; },
      update(m, game, dt) {
        m.work?.update(dt);
        if (m.work && !m.work.started && game.nehorai.pose === 'carry') game.nehorai.setPose(null);
        say(m, game, m.s.treated ? 'הוא חבוש' : m.work?.started ? '4. מטפל בנהוראי · להישאר לידו' : '4. לבצע טיפול · הערכה אצלך, לחזור אליו');
        return m.s.treated ? 'next' : null;
      },
      exit(m, game) { m.work = null; if (game.nehorai.pose === 'carry') game.nehorai.setPose(null); },
    },
    { // 7: 5. Ido and Erez carry him to the safe room
      objective: '5. להעביר את נהוראי לחדר הבטוח', checkpoint: true,
      enter(m, game) { m.s.lifted = false; m.s.laid = false; m.s.watch = null; m.s.placed = false; freshMarks(game); },
      interaction(m, game) {
        if (m.s.lifted || game.mode !== 'foot' || !near(game.player.pos, ND(game), 2.4)) return null;
        return { label: 'להרים את נהוראי עם ארז', priority: 6, run: () => {
          m.s.lifted = true;
          game.paint.disarmPlayer(); // both hands under him
          m.carry = new Carry(game, { by: 'erez' });
          game.player.speedScale = 0.55;
          roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => game.squad.send(OTHERS[i], p, { label: 'מאבטח' }));
          later(m, game, LIFT);
          game.hud.toast('עידו וארז נושאים את נהוראי · לאט', 2400);
        } };
      },
      target(m, game) {
        const R = FAC(game).saferoom;
        if (!m.s.lifted) return { ...ND(game), r: 1.6 };
        return zone(game) === 'saferoom' ? { ...cot(game).by[0], r: 1.2 } : { ...R.doorAt, r: 1.4 };
      },
      update(m, game) {
        const C = cot(game);
        // the friends sent ahead to the room: one who cannot find the way in a while is put there
        if (m.s.lifted && !m.s.watch) m.s.watch = m.t;
        if (m.s.watch != null && m.t - m.s.watch > 14 && !m.s.placed) { m.s.placed = true; roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => { const n = game.npc(OTHERS[i]); if (!near(n.pos, p, 2)) { n.target = null; n.place(p.x, p.z, p.yaw ?? 0, p.y); } }); }
        if (m.s.lifted && !m.s.laid && zone(game) === 'saferoom' && near(game.player.pos, C.by[0], 2.4)) {
          m.s.laid = true;
          m.carry.stop(); m.carry = null;
          const n = nehoraiDown(game, C.lie, { y: C.lie.y }); bandage(n.model, true);
          stay(game, 'erez', C.by[0], { pose: 'carry', label: 'מטפל בו' });
          const p = game.player.pos; game.player.place(p.x - 0.4, p.z - 1.0, -Math.PI / 2, p.y);
          game.player.speedScale = 1;
          armed(game, game.squad.ids);
          game.hud.toast('נהוראי על המיטה', 1600);
        }
        say(m, game, !m.s.lifted ? '5. להעביר את נהוראי לחדר הבטוח · להרים אותו עם ארז' : m.s.laid ? 'הוא על המיטה' : '5. לחדר הבטוח · בקיר הדרומי של ההאנגר · לאט');
        return m.s.laid ? 'next' : null;
      },
    },
    { // 8: 6. the security door's wheel
      objective: '6. להפעיל את דלת הביטחון', checkpoint: true,
      enter(m, game) {
        const R = FAC(game).saferoom;
        freshMarks(game);
        m.s.wheel = false;
        // the wheel sets the heavy door closing: its leaf starts in, its lamp goes amber (the tick moves it)
        m.work = new Work(game, { at: R.wheel, seconds: 2.5, label: 'לסובב את גלגל הדלת', pill: 'מפעיל את דלת הביטחון', near: 1.9, onDone: () => { m.s.wheel = true; m.s.ajar = 1; R.door.lamp.set('amber'); game.sound?.hit?.('crash', 0.4); later(m, game, WHEEL); } });
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) { return m.s.wheel ? null : { ...FAC(game).saferoom.wheel, r: 1.0 }; },
      update(m, game, dt) {
        m.work?.update(dt);
        say(m, game, m.s.wheel ? 'הדלת נסגרת לאט' : '6. להפעיל את דלת הביטחון · הגלגל ליד הדלת, מבפנים');
        return m.s.wheel ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 9: 7. the doorway held until the treatment is done; the door seals
      objective: '7. להחזיק את הכניסה עד שהטיפול מסתיים', checkpoint: true,
      enter(m, game) {
        freshMarks(game); upAgain(game);
        HOLD(game).forEach((p, i) => { if (OTHERS[i]) { const n = game.npc(OTHERS[i]); game.squad.send(OTHERS[i], p, { label: 'בכניסה' }); n.lookAt(p.x, p.z - 6); } });
        m.w.room = new Wave(game, AT_ROOM(game), { gap: 2.2, hot: true, delay: 3 });
        m.s.left = TREAT; m.s.sealed = false; m.s.inT = null; m.s.under = false;
        m.s.ajar ??= 0.9; // (a retry here: the wheel was turned, the door already on its way in)
      },
      target(m, game) {
        const R = FAC(game).saferoom;
        if (m.s.left <= 0) return zone(game) === 'saferoom' ? null : { ...R.doorIn, r: 1.2 };
        return nearestGuard(game, m.w.room?.ids) || { ...R.doorAt, r: 1.4 };
      },
      update(m, game, dt) {
        const R = FAC(game).saferoom, w = m.w.room;
        w.update(dt);
        for (const gd of w.out) if (!gd.door) { gd.door = true; gd.foe = { player: true, pos: { x: R.doorAt.x, y: R.doorAt.y, z: R.doorAt.z - 1 }, yaw: 0 }; }
        // the treatment runs while nobody of the Order is at the doorway
        m.s.under = w.out.some((gd) => !gd.marked && gd.npc.visible && near(gd.npc.pos, R.doorAt, 10));
        if (m.s.left > 0 && !m.s.under) m.s.left = Math.max(0, m.s.left - dt);
        // the leaf creeps in as the treatment runs (never so far that it stands in the way of the doorway)
        if (m.s.ajar != null) { const want = 0.84 + 0.06 * (m.s.left / TREAT); m.s.ajar += (want - m.s.ajar) * Math.min(1, dt * 1.2); }
        game.hud.setPursuit(m.s.left > 0 ? `הטיפול · ${Math.ceil(m.s.left)} שנ׳${m.s.under ? ' · נעצר' : ''}` : null);
        if (m.s.left <= 0 && !m.s.inT) {
          m.s.inT = m.t;
          later(m, game, IN);
          roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => game.squad.send(OTHERS[i], p, { label: 'בחדר' }));
        }
        // everyone in (whoever is still on the way is put there), and the heavy door shuts on the rest of them
        if (m.s.inT != null && !m.s.sealed && zone(game) === 'saferoom' && m.t - m.s.inT > 2.5) {
          m.s.sealed = true;
          roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => { const n = game.npc(OTHERS[i]); if (FAC(game).zoneAt(n.pos.x, n.pos.z) !== 'saferoom') { n.target = null; n.place(p.x, p.z, p.yaw ?? 0, p.y); } });
          if (m.s.ajar != null) { R.door.k = Math.min(R.door.k, m.s.ajar); m.s.ajar = null; } // it shuts the rest of the way from where it stood
          R.door.lock(); game.sound?.hit?.('crash', 0.9); game.follow.shake(0.4);
          game.fx.redAlert(false); FAC(game).alarm(false); // behind the sealed door the red light and the siren stay outside
          for (const gd of w.out) if (!gd.marked) { gd.npc.show(false); gd.npc.target = null; }
          m.stopSiren?.(); m.stopSiren = null;
          game.hud.setPursuit(null);
          game.hud.banner('', 'דלת הביטחון נסגרה', 'הטיפול הושלם', 2200);
        }
        say(m, game, m.s.left > 0 ? (m.s.under ? `7. הם בכניסה — ארז לא יכול לטפל · לסמן אותם (${done(w)}/${w.total}) · סומנת ${game.paint.hits}/3` : `7. להחזיק את הכניסה · הטיפול: ${Math.ceil(m.s.left)} שנ׳ · סומנת ${game.paint.hits}/3`) : m.s.sealed ? 'הדלת סגורה' : 'הטיפול הסתיים · פנימה, לחדר הבטוח!');
        return m.s.sealed && m.t - m.s.inT > 3.4 ? 'next' : null;
      },
    },
    { // 10: the quiet
      objective: 'בחדר הבטוח',
      enter(m, game) {
        const C = cot(game), e = game.npc('erez'), P = game.paint;
        game.cutscene = true; game.hud.setCinematic(true);
        game.hud.setPursuit(null);
        for (const gd of [...P.guards]) if (!gd.marked) { P.markGuard(gd, 'outside'); gd.npc.show(false); }
        game.nehorai.setPose(null); // Ido's marker down
        stool(game, C.stool);
        e.model.setPose(null);
        m.beats = beats(game, [
          ['do', () => {
            const s = C.stool; stay(game, 'erez', s, { pose: 'sit', label: 'לידו' });
            e.lookAt(C.lie.x, C.lie.z + 0.5);
            const b = C.by[1]; game.player.place(b.x - 0.6, b.z + 0.3, b.yaw, b.y);
            game.follow.shot({ x: C.lie.x - 2.6, y: C.lie.y + 1.4, z: C.lie.z - 2.2 }, { x: C.lie.x - 0.4, y: C.lie.y + 0.4, z: C.lie.z + 0.2 }, 9999);
            game.sound?.music?.('calm', { fade: 2.5 });
          }],
          ['wait', 1.6],
          ['say', QUIET],
          ['do', () => { game.sound?.music?.(null, { fade: 3 }); game.follow.shot({ x: C.lie.x - 1.8, y: C.lie.y + 1.9, z: C.lie.z + 1.4 }, { x: C.lie.x, y: C.lie.y + 0.2, z: C.lie.z }, 9999); }],
          ['wait', 5.5], // a few seconds where nothing happens
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
