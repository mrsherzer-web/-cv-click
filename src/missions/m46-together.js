// Chapter nine, mission 13, "סוף השלב". Back at the safe house a few hours after the tower: the gang on the sofas
// round the TV, Nehorai in with a bandage on his head and a wrap on his arm (nothing more than that), and he sits
// down with them. Erez, Nehorai, Ido — and everyone laughs. Then the TV comes on by itself: the Shadow, his lines,
// the map of the Order's other bases, "now I am coming for you". Nehorai gets up off the sofa; Erez and Ido stand at
// his side; the whole gang joins them; his last line. The screen goes dark: STAGE 9 COMPLETE – OPERATION PHOENIX,
// then STAGE 10 – THE FINAL HUNT, each on the black for several seconds before anything else comes up. The whole
// gang stays loyal; every threat is the Black Order's. Invented, all of it.
import { near, say } from './missions.js';
import { TEAM, endCrew, attempt } from './phoenix.js';
import { HOME, hush, beats, talkOn, bandage, armWrap, clearAll, offBoard, ORDER } from './phoenix-d.js';

// the user's lines, exactly
const EREZ = [['ארז', 'אחי, חשבתי שלא נראה אותך יותר.']];
const NEHORAI = [['נהוראי', 'אתם לא נפטרים ממני כל כך מהר.']];
const IDO = [['עידו', 'בפעם הבאה שאתה מתפוצץ, תודיע לי מראש!']];
const LAUGH = [{ who: '', text: 'כולם צוחקים.', ms: 2400 }];
const SHADOW1 = [['הצל', 'אתם חושבים שזה נגמר? מה שהרסתם היה רק מתקן אחד.']];
const SHADOW2 = [['הצל', 'עכשיו אני בא אליכם.']];
const LAST = [['נהוראי', 'אז תבוא. אנחנו מחכים לך.']];
const CARD1 = 'STAGE 9 COMPLETE – OPERATION PHOENIX';
const CARD2 = 'STAGE 10 – THE FINAL HUNT';
const ON_TV = [['יונתי', 'מה… הטלוויזיה נדלקה לבד.']];
const LEFT = 'עזבת את בית המסתור. ארז: "לאן, אחי? כולם פה, בסלון. חוזרים פנימה."';
const FAR = 120;

// the gang on the sofas (each in his own seat), sitting
function seat(game, id) {
  const h = HOME(game), s = h.seatFor(id), n = game.npc(id);
  if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; }
  n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null;
  n.place(s.x, s.z, s.yaw, s.y); n.model.setPose('sit'); n.show(true); n.body.enabled = false;
  return n;
}
function sitDown(game) { const s = HOME(game).seats[0]; game.player.place(s.x, s.z, s.yaw, s.y); game.nehorai.setPose('sit'); game.follow.snapBehind(s.yaw); }
// the place as the scene needs it at each checkpoint: the house lit (or only by the TV), the Renault in the yard,
// the gang seated, Nehorai bandaged — at the door (the start) or on the sofa between Erez and Ido
function stage(m, game, cp) {
  clearAll(m, game);
  const h = HOME(game);
  game.daylight?.set(1, 0);
  h.reset();
  game.squad.dismiss(); game.paint.dispose(); offBoard(game, ORDER); game.npc('shadow').show(false);
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; }
  if (game.mode === 'car') game.exitCar();
  for (const id of TEAM) { const n = game.npc(id); if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } }
  game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
  for (const id of TEAM) seat(game, id);
  bandage(game.nehorai, true); armWrap(game.nehorai, true);
  if (cp >= 2) { sitDown(game); h.lights(false); h.screen.show('map'); }
  else { game.nehorai.setPose(null); game.player.place(h.outside.x, h.outside.z, h.outside.yaw ?? -Math.PI / 2, h.y); game.follow.snapBehind(h.outside.yaw ?? -Math.PI / 2); h.screen.show('off'); h.lights(true); }
  game.sound?.music?.('calm', { fade: 1.2 });
  m.s = { cp };
}
const sofaShot = (game) => { const h = HOME(game), tv = h.tv, sofa = h.sofa; game.follow.shot({ x: tv.x + 1.4, y: tv.y + 0.2, z: tv.z + 2.4 }, { x: sofa.x, y: sofa.y + 0.6, z: sofa.z }, 9999); };
const tvShot = (game) => { const h = HOME(game), tv = h.tv, sofa = h.sofa; game.follow.shot({ x: sofa.x + 1.8, y: sofa.y + 1.6, z: sofa.z + 1.2 }, { x: tv.x, y: tv.y, z: tv.z }, 9999); };

export default {
  id: 'together', chapter: 9, number: 13, title: 'סוף השלב', requires: ['meltdown'], follows: true,
  where: 'בבית המסתור',
  startAt: (game) => { const h = HOME(game); return h ? { x: h.outside.x, z: h.outside.z, y: h.y } : null; },
  reward: { money: 2500, unlocks: ['chapter-9'], text: 'סוף הפרק התשיעי · 2,500 ₪' },

  setup(m, game) { m.s = {}; m.talk = []; game.overlay?.mapHidden(false); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const h = HOME(game); game.player.place(h.outside.x, h.outside.z, h.outside.yaw ?? 0, h.y); game.follow.snapBehind(h.outside.yaw ?? 0); },
  failIf(m, game) { const h = HOME(game), p = game.pos; return m.s.staged && Math.hypot(p.x - h.x, p.z - h.z) > FAR ? LEFT : null; },
  restore(m, game, cp) { stage(m, game, cp); m.s.staged = true; },
  tick(m, game) { hush(game); talkOn(m, game); },
  cleanup(m, game) {
    const h = HOME(game);
    clearAll(m, game);
    game.nehorai.setPose(null);
    for (const id of TEAM) { const n = game.npc(id); n.model.setPose(null); n.posed = false; n.body.enabled = n.visible; }
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    h.reset();
    endCrew(game);
    for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) if (game[b]) game[b].held = false;
  },

  steps: [
    { // 0: a few hours later, the safe house: in, and down on the sofa with them
      objective: 'בית המסתור · לשבת עם החבורה',
      enter(m, game) {
        const live = attempt(game, m);
        m.s.staged = false;
        game.cutscene = true; game.hud.setCinematic(true);
        game.hud.fade('כמה שעות אחר כך · בית המסתור', () => {
          if (!live()) return;
          stage(m, game, 0); m.s.staged = true;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
          game.hud.banner('בית המסתור', 'סוף השלב', 'החבורה בסלון', 2600);
        }, 1600);
      },
      interaction(m, game) {
        const h = HOME(game);
        if (!m.s.staged || game.cutscene || game.mode !== 'foot' || !near(game.player.pos, h.seats[0].stand, 1.3)) return null;
        return { label: 'לשבת עם החבורה', priority: 6, run: () => { m.s.sat = true; sitDown(game); } };
      },
      target(m, game) { const h = HOME(game); return m.s.staged && !m.s.sat ? { ...h.seats[0].stand, y: h.y, r: 1.0 } : null; },
      update(m, game) {
        say(m, game, m.s.sat ? 'על הספה, בין ארז לעידו' : 'בית המסתור · להיכנס ולשבת עם החבורה על הספה');
        return m.s.sat ? 'next' : null;
      },
    },
    { // 1: the lines, the laugh; the TV comes on: the Shadow, the map of bases
      objective: 'החבורה',
      enter(m, game) {
        const h = HOME(game);
        game.cutscene = true; game.hud.setCinematic(true);
        sofaShot(game);
        const laugh = () => { for (const id of TEAM) { const n = game.npc(id); n.model.play(Math.random() < 0.5 ? 'nod' : 'shrug', { speed: 1.3 + Math.random() * 0.6 }); } game.nehorai.play('nod', { speed: 1.5 }); };
        m.beats = beats(game, [
          ['wait', 0.8],
          ['say', EREZ],
          ['say', NEHORAI],
          ['say', IDO],
          ['do', () => { laugh(); game.hud.toast('כולם צוחקים', 2200); }],
          ['say', LAUGH],
          ['do', laugh],
          ['wait', 1.2],
          // suddenly the screen comes on by itself
          ['do', () => { h.lights(false); h.screen.show('shadow', { caption: 'המסדר השחור' }); game.sound?.beep?.(2, 330, 0.3); game.sound?.music?.(null, { fade: 0.6 }); tvShot(game); game.hud.banner('המסדר השחור', 'הצל', 'שידור חי', 1600); }],
          ['wait', 1.4],
          ['say', ON_TV],
          ['say', SHADOW1],
          ['do', () => { h.screen.show('map'); game.sound?.beep?.(1, 260, 0.3); game.hud.toast('מפה: הבסיסים של המסדר השחור', 2400); }],
          ['wait', 2.6],
          ['do', () => { h.screen.show('shadow', { caption: 'המסדר השחור' }); }],
          ['say', SHADOW2],
          ['do', () => { h.screen.show('map'); sofaShot(game); }],
          ['wait', 0.6],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(HOME(game).seats[0].yaw); },
    },
    { // 2: Nehorai gets up; Erez and Ido at his side; the whole gang; his line; the screen goes dark
      objective: 'לקום', checkpoint: true,
      enter(m, game) { m.s.up = false; m.s.said = false; },
      interaction(m, game) {
        if (m.s.up || game.cutscene) return null;
        return { label: 'לקום מהספה', priority: 6, run: () => { m.s.up = true; standUp(m, game); } };
      },
      target(m, game) { const h = HOME(game); return m.s.up ? null : { ...h.seats[0].stand, y: h.y, r: 1.0 }; },
      update(m, game, dt) {
        const s0 = HOME(game).seats[0];
        // a push of the stick off the sofa is getting up too
        if (!m.s.up && !game.cutscene && Math.hypot(game.player.pos.x - s0.x, game.player.pos.z - s0.z) > 0.45) { m.s.up = true; standUp(m, game); }
        m.beats?.update(dt);
        say(m, game, m.s.up ? 'כולם עומדים' : 'הצל על המסך · לקום מהספה');
        return m.s.said ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; },
    },
    { // 3: black; the two cards
      objective: 'סוף השלב',
      enter(m, game) {
        const live = attempt(game, m), h = HOME(game);
        game.cutscene = true; game.hud.setCinematic(true);
        game.sound?.music?.('calm', { fade: 2 });
        game.hud.fade(CARD1, () => {
          if (!live()) return;
          // under the black: the night goes on; the gang up and about, Nehorai by the sofa
          h.screen.show('off'); h.lights(true);
          for (const id of TEAM) { const n = game.npc(id); n.target = null; }
          game.follow.override = null; game.follow.snapBehind(h.seats[0].yaw);
        }, 11500);
        setTimeout(() => { if (live()) game.hud.fade(CARD2, null, 5300); }, 5600);
        setTimeout(() => { if (live()) m.s.fin = true; }, 12300); // both cards read, the black lifted: only then the mission completes
      },
      update(m) { return m.s.fin ? 'next' : null; },
      exit(m, game) { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
  ],
  complete(m, game) { m.done = true; },
};

// Nehorai up off the sofa, Erez and Ido at his side, the rest of the gang round them, facing the screen
function standUp(m, game) {
  const h = HOME(game), s0 = h.seats[0], st = s0.stand, yaw = s0.yaw;
  game.cutscene = true; game.hud.setCinematic(true);
  game.nehorai.setPose(null);
  game.player.place(st.x, st.z, yaw, h.y);
  game.nehorai.play('getup', { speed: 1.4 });
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const spot = (side, back) => ({ x: st.x + rx * side - fx * back, z: st.z + rz * side - fz * back });
  m.beats = beats(game, [
    ['wait', 0.6],
    ['do', () => {
      for (const [id, side] of [['erez', -1.1], ['ido', 1.1]]) { const n = game.npc(id), q = spot(side, 0.2), s = h.seatFor(id).stand; n.model.setPose(null); n.posed = false; n.place(s.x, s.z, yaw, h.y); n.walkTo(q.x, q.z, { near: 0.3, onArrive: () => { n.yaw = yaw; n.lookAt(n.pos.x + fx * 4, n.pos.z + fz * 4); } }); }
      game.follow.shot({ x: h.tv.x + 0.6, y: h.y + 1.7, z: h.tv.z + 0.4 }, { x: st.x, y: h.y + 1.4, z: st.z }, 9999);
    }],
    ['wait', 1.4],
    ['do', () => {
      TEAM.filter((id) => id !== 'erez' && id !== 'ido').forEach((id, i) => {
        const n = game.npc(id), s = h.seatFor(id).stand, q = spot(-3 + (i % 6) * 1.2, 1.3 + Math.floor(i / 6) * 1.0);
        n.model.setPose(null); n.posed = false; n.place(s.x, s.z, yaw, h.y);
        n.walkTo(q.x, q.z, { near: 0.35, onArrive: () => n.lookAt(n.pos.x + fx * 4, n.pos.z + fz * 4) });
      });
    }],
    ['wait', 2.2],
    ['do', () => { for (const id of TEAM) { const n = game.npc(id); n.target = null; n.lookAt(n.pos.x + fx * 4, n.pos.z + fz * 4); } game.follow.shot({ x: h.tv.x + 0.8, y: h.y + 1.5, z: h.tv.z - 0.6 }, { x: st.x, y: h.y + 1.35, z: st.z }, 9999); }],
    ['say', LAST],
    ['wait', 0.6],
    ['do', () => { h.screen.show('off'); game.sound?.beep?.(1, 180, 0.3); m.s.said = true; }],
  ]);
}
