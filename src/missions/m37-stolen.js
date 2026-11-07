// Chapter nine, mission 4, "גנבו לנו את כל הרובים!". After the sleeping gas in the port's elevator: Nehorai
// wakes on the floor of the big cell in the Order's underground facility, the gang around him, all of them
// alive and every marker gone (the stash: who carried what is kept, nobody can fire). He wakes the four still
// out on the floor, the lines about the guns and the fists, then the cell doors open and the guards come in:
// the first fist fight (FIST COMBAT: the punches and the three-hit combination, the heavy punch, the shove,
// the block and the dodge), Erez, Ido, Muller and Liam fighting alongside. The guards' door locks behind
// them. Paint and fists: beaten men sit down. Invented, all of it; the gang stays loyal to the last man.
import { near, say } from './missions.js';
import { TEAM, NAMES, endCrew, attempt, handsOver } from './phoenix.js';
import { FAC, L, underground, unarmed, disarmAll, rearmed, replayDone, stand, away, walkPath, brawl, endBrawl, beats, clearStage, gangAt } from './phoenix-b.js';

const GUARDS = ['og1', 'og2', 'og3', 'og4'];
const FIGHTERS = ['erez', 'ido', 'muller', 'liam'];      // awake on the bench: they fight alongside
const SLEEPERS = ['yonati', 'avraham', 'dolev', 'hadar']; // out on the floor: Nehorai wakes them
// where each one comes to (the cell's wake spots: 0..4 on the bench, 5..9 on the floor)
const WAKE = { muller: 0, ido: 1, erez: 2, liam: 3, yonati: 5, avraham: 6, nehorai: 7, dolev: 8, hadar: 9 };
const GROGGY = {
  yonati: ['יונתי', 'מה… מישהו צילם את זה?'],
  avraham: ['אברהם', 'אני חי. אני חושב. תנו לי רגע לדבר על זה.'],
  dolev: ['דולב', 'שוב חטפו אותי? רגע… הפעם את כולנו.'],
  hadar: ['הדר', 'Bro… איפה אנחנו?'],
};
const OPEN = [['ארז', 'נהוראי… נהוראי. אתה איתנו?']];
const WHERE = [['נהוראי', 'איפה… איפה אנחנו?'], ['ארז', 'מתחת לאדמה. הגז במעלית, ואז חושך. הם הביאו אותנו לפה.'], ['נהוראי', 'כולם פה? צריך להעיר את כולם.']];
const ALIVE = [['ארז', 'כולם בחיים. כולם פה.']];
// the user's lines, exactly
const GUNS1 = [['עידו', 'רגע… איפה הרובה שלי?!'], ['ארז', 'לקחו לנו את כל הציוד!']];
const GUNS2 = [['נהוראי', 'אז נסתדר עם מה שיש.'], ['ארז', 'ומה בדיוק יש לנו?']];
const GUNS3 = [['נהוראי', 'את אלה.']];
const IN = [['שומר', 'האסירים ערים! להכניס אותם לסדר!']];
const AFTER = [['ארז', 'לא רע בשביל מישהו בלי רובה.'], ['עידו', 'הדלת שלהם ננעלה מאחוריהם. אבל לשומר הראשי יש צרור מפתחות.'], ['נהוראי', 'אז יוצאים מפה. ומוצאים את הרובים שלנו.']];
const TIPS = ['אגרוף: שלוש מכות ברצף — קומבו', 'טבעת אדומה: הוא מניף · לחסום או להתחמק', 'דחיפה עוצרת את ההנפה ופותחת אותו', 'מכה חזקה: איטית, אבל שוברת חסימה', 'טבעת צהובה: הוא פתוח · עכשיו להכות'];
const LOST = 'השומרים הפילו את נהוראי. ארז: "קום, אחי. טבעת אדומה — לחסום או להתחמק. טבעת צהובה — להכות, שלוש ברצף."';

const C = (game) => FAC(game).cells;
// the guards come in from the iron corridor, through their door, along the hallway and into the big cell
const ENTRY = (game) => [L(game, -61.5, -28.8), L(game, -61.5, -27.2), L(game, -59.5, -28.8), L(game, -59.5, -27.2)];
const PATH = (game, i) => [L(game, -63.2, -28), L(game, -66.8, -28), L(game, -68, -31.6), L(game, -69.4, -34), L(game, -72.8, -34), [L(game, -76, -36), L(game, -76, -32), L(game, -74.5, -38), L(game, -74.5, -30)][i]];

// the cell as the gang wakes in it: every door shut and locked, nobody else in the block, each of them at
// his wake spot (on the bench, or out on the floor), kept there until Nehorai has them all on their feet
function stageCell(m, game, { asleep = true } = {}) {
  const f = FAC(game), c = C(game);
  f.reset();
  f.setDoors({ bigCell: 'locked', cell1: 'locked', cell2: 'locked', cell3: 'locked', guardDoor: 'locked', arrivalDoor: 'locked', shutter: 'locked' });
  f.snapDoors();
  away(game, GUARDS);
  const me = c.wake[WAKE.nehorai];
  gangAt(game, me, me.yaw);
  for (const id of TEAM) {
    const s = c.wake[WAKE[id]], n = game.npc(id), out = SLEEPERS.includes(id) && asleep && !m.s.awake?.[id];
    n.idle = null; n.posed = false; n.target = null;
    n.place(s.x, s.z, s.yaw, s.y);
    game.squad.send(id, { x: s.x, z: s.z, yaw: s.yaw }, { label: out ? 'מעולף' : 'מתעורר' }); n.target = null;
    n.model.setPose(out ? 'floored' : s.pose === 'sit' && asleep ? 'sit' : null);
  }
  unarmed(game);
}
function releaseAll(game) { for (const id of TEAM) { const n = game.npc(id); n.model.setPose(null); n.target = null; game.squad.release(id); } }
// the gang as the guards come in: Nehorai and the four who fight in the middle of the cell (the step's start
// holds the four still shaky by the bench, out of the way of the fight)
function stageFight(m, game) {
  const f = FAC(game);
  f.reset();
  f.setDoors({ bigCell: 'locked', cell1: 'locked', cell2: 'locked', cell3: 'locked', guardDoor: 'locked', arrivalDoor: 'locked', shutter: 'locked' });
  f.snapDoors();
  const me = L(game, -79.5, -34, 0, Math.PI / 2);
  gangAt(game, me, me.yaw);
  const spots = { erez: L(game, -80.5, -31.8), ido: L(game, -80.5, -36.2), muller: L(game, -82.5, -38.5), liam: L(game, -82.5, -29.5) };
  for (const id of FIGHTERS) { const n = game.npc(id), s = spots[id]; n.place(s.x, s.z, Math.PI / 2, s.y); n.model.setPose(null); }
  away(game, GUARDS);
  ENTRY(game).forEach((p, i) => stand(game, GUARDS[i], p, { yaw: -Math.PI / 2, idle: null }));
  unarmed(game);
}

export default {
  id: 'stolen', chapter: 9, number: 4, title: 'גנבו לנו את כל הרובים!', requires: ['blackport'], follows: true,
  where: 'במתקן הכליאה',
  startAt: (game) => { const c = FAC(game)?.cells; return c ? { ...c.big.inside, r: 2 } : null; },
  reward: { money: 400, unlocks: ['stolen'], text: 'קרב האגרופים הראשון · 400 ₪' },

  setup(m, game) { m.s = { awake: {} }; m.fightAllies = []; disarmAll(game); underground(game); },
  // a fresh page (or a replay from the menu): in the big cell, under the ground
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const s = FAC(game).cells.wake[WAKE.nehorai]; game.player.place(s.x, s.z, s.yaw, s.y); game.follow.snapBehind(s.yaw); },
  failIf(m, game) { return m.s.lost ? LOST : null; },
  restore(m, game, checkpoint) {
    clearStage(m, game); underground(game);
    game.fists(false);
    if (checkpoint <= 1) {
      m.s = { awake: {}, k: 0 };
      stageCell(m, game);
      for (const id of FIGHTERS) { const n = game.npc(id), s = C(game).wake[WAKE[id]]; n.model.setPose(null); n.place(s.x + 0.7, s.z, s.yaw, s.y); } // already up, by the bench
      game.overlay?.daze(0.45, 0); game.player.speedScale = 0.7;
      game.sound?.music?.('calm');
    } else {
      m.s = { awake: Object.fromEntries(SLEEPERS.map((id) => [id, true])), k: 4 };
      stageFight(m, game);
    }
  },
  cleanup(m, game) {
    clearStage(m, game);
    game.fists(false);
    replayDone(m, game);
    const f = FAC(game);
    if (!m.done || !handsOver(game)) {
      // left without the next mission taking over: the block as it was, the guards gone, the gang home
      away(game, GUARDS); f.reset(); f.snapDoors();
      if (game.missions.done('armory')) rearmed(game); // a replay long after the wall: nobody left without his marker
      endCrew(game); for (const id of TEAM) game.npc(id).model.setPose(null);
    } else underground(game); // handed straight on: still under the ground, the map still covered
  },

  steps: [
    { // 0: waking: the eyes open on the cell's ceiling, the blur fades a little, Erez's voice
      objective: 'מתעוררים',
      enter(m, game) {
        game.cutscene = true; game.hud.setCinematic(true);
        game.overlay?.eyes(1, 0); game.overlay?.daze(1, 0);
        m.s.awake = {};
        stageCell(m, game);
        game.nehorai.setPose('floored');
        game.player.speedScale = 0.6;
        const me = game.player.pos, c = C(game);
        game.follow.shot({ x: me.x + 2.2, y: me.y + 2.9, z: me.z + 1.6 }, { x: me.x, y: me.y + 0.3, z: me.z }, 9999);
        m.beats = beats(game, [
          ['do', () => { game.overlay?.eyes(0, 2.8); game.overlay?.daze(0.75, 3.2); game.sound?.heartbeat?.(true, { bpm: 54, level: 0.45 }); }],
          ['wait', 2.4],
          ['say', OPEN],
          ['do', () => { game.nehorai.setPose(null); game.nehorai.play('getup', { speed: 0.8 }); game.overlay?.daze(0.55, 2); }],
          ['wait', 1.2],
          ['do', () => { const e = game.npc('erez'); game.follow.shot({ x: me.x + 3.4, y: me.y + 2.3, z: me.z - 2.6 }, { x: (me.x + e.pos.x) / 2, y: me.y + 1.0, z: (me.z + e.pos.z) / 2 }, 9999); }],
          ['say', WHERE],
          ['do', () => { game.hud.banner('מתחת לאדמה', 'המתקן התת-קרקעי', 'תא המעצר הגדול · הנשקים נעלמו', 3200); game.follow.shot({ x: c.big.doorIn.x - 1, y: me.y + 3.0, z: c.big.doorIn.z + 6 }, { x: c.big.inside.x - 4, y: me.y + 0.6, z: c.big.inside.z }, 9999); game.sound?.heartbeat?.(false); game.sound?.music?.('calm'); }],
          ['wait', 2.4],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) {
        m.beats = null;
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        game.nehorai.setPose(null);
        // the four on the bench are up: they wait by it while he goes round the others
        for (const id of FIGHTERS) { const n = game.npc(id); n.model.setPose(null); n.model.play('getup', { speed: 1.2 }); }
      },
    },
    { // 1: the four still out on the floor: wake each one (all of them alive)
      objective: 'להעיר את החבורה', checkpoint: true,
      enter(m, game) { m.s.k = SLEEPERS.filter((id) => m.s.awake[id]).length; game.overlay?.daze(0.45 * (1 - m.s.k / 4), 1); },
      target(m, game) {
        const me = game.player.pos;
        let best = null, bd = Infinity;
        for (const id of SLEEPERS) { if (m.s.awake[id]) continue; const n = game.npc(id), d = Math.hypot(n.pos.x - me.x, n.pos.z - me.z); if (d < bd) { bd = d; best = n; } }
        return best ? { x: best.pos.x, z: best.pos.z, y: best.pos.y, r: 1.1 } : null;
      },
      interaction(m, game) {
        if (game.mode !== 'foot' || m.s.alive) return null;
        const me = game.player.pos;
        for (const id of SLEEPERS) {
          if (m.s.awake[id]) continue;
          const n = game.npc(id);
          if (!near(me, n.pos, 1.9)) continue;
          return { label: `להעיר את ${NAMES[id]}`, priority: 6, run: () => {
            m.s.awake[id] = true; m.s.k = SLEEPERS.filter((q) => m.s.awake[q]).length;
            n.model.setPose(null); n.model.play('getup', { speed: 0.9 }); n.lookAt(me.x, me.z);
            game.overlay?.daze(0.45 * (1 - m.s.k / 4), 1.4);
            game.player.speedScale = Math.min(1, 0.7 + m.s.k * 0.075);
            game.dialogue.play([GROGGY[id]]);
          } };
        }
        return null;
      },
      update(m, game) {
        say(m, game, m.s.k < 4 ? `להעיר את החבורה · ארבעה עדיין על הרצפה (${m.s.k}/4)` : 'כולם בחיים');
        if (m.s.k >= 4 && !m.s.alive) {
          m.s.alive = true;
          game.hud.toast('כולם בחיים', 2000);
          const live = attempt(game, m);
          game.dialogue.play(ALIVE).then(() => { if (live()) m.s.go = true; });
        }
        return m.s.go ? 'next' : null;
      },
      exit(m, game) { game.overlay?.daze(0, 1.5); game.player.speedScale = 1; },
    },
    { // 2: the guns are gone; "את אלה."
      objective: 'הציוד נעלם',
      enter(m, game) {
        game.cutscene = true; game.hud.setCinematic(true);
        // the gang round Nehorai in the middle of the cell, facing him
        const me = L(game, -79.5, -34, 0, -Math.PI / 2);
        game.player.place(me.x, me.z, me.yaw, me.y); game.nehorai.setPose(null);
        const ring = { ido: [-82.4, -36.0], erez: [-82.4, -32.0], muller: [-83.6, -38.2], liam: [-83.6, -29.8], yonati: [-85.6, -35.2], avraham: [-85.6, -32.8], dolev: [-86.8, -37.4], hadar: [-86.8, -30.6] };
        for (const id of TEAM) { const n = game.npc(id), [lx, lz] = ring[id], p = L(game, lx, lz); n.target = null; n.place(p.x, p.z, Math.PI / 2, p.y); n.model.setPose(null); n.lookAt(me.x, me.z); game.squad.send(id, { x: p.x, z: p.z, yaw: Math.PI / 2 }, { label: 'מקשיב' }); n.target = null; }
        const at = (id, h = 1.5) => { const n = game.npc(id); return { x: n.pos.x, y: n.pos.y + h, z: n.pos.z }; };
        const shot = (from, look) => game.follow.shot(from, look, 9999);
        m.beats = beats(game, [
          ['do', () => { shot(L(game, -80.0, -37.6, 1.75), at('ido', 1.5)); game.npc('ido').model.play('shrug'); }],
          ['say', GUNS1.slice(0, 1)],
          ['do', () => { shot(L(game, -80.0, -30.4, 1.75), at('erez', 1.5)); }],
          ['say', GUNS1.slice(1)],
          // he looks down at his hands
          ['do', () => { game.nehorai.setPose('carry'); shot(L(game, -81.3, -34.9, 1.45), { x: me.x, y: me.y + 1.0, z: me.z }); }],
          ['wait', 1.6],
          ['say', GUNS2.slice(0, 1)],
          ['do', () => { shot(L(game, -80.0, -30.4, 1.75), at('erez', 1.5)); }],
          ['say', GUNS2.slice(1)],
          // he raises his fists
          ['do', () => { game.nehorai.setPose('guard'); shot(L(game, -81.6, -33.4, 1.25), { x: me.x, y: me.y + 1.45, z: me.z }); }],
          ['wait', 1.0],
          ['say', GUNS3],
          ['wait', 0.6],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 3: the cell doors open, the guards come in: the first fist fight
      objective: 'דלתות התא נפתחות', checkpoint: true,
      enter(m, game) {
        const f = FAC(game), c = C(game);
        // the gang where the scene left them; the four by the bench held there, the four who fight free
        const me = game.player.pos;
        game.player.place(me.x, me.z, Math.PI / 2, me.y); game.follow.snapBehind(Math.PI / 2);
        for (const id of SLEEPERS) { const n = game.npc(id), s = c.wake[{ yonati: 0, avraham: 2, dolev: 1, hadar: 3 }[id]]; n.place(s.x + 0.6, s.z, Math.PI / 2, s.y); n.model.setPose(null); game.squad.send(id, { x: s.x + 0.6, z: s.z, yaw: Math.PI / 2 }, { label: 'מחכה' }); n.target = null; }
        for (const id of FIGHTERS) { game.squad.release(id); }
        away(game, GUARDS);
        ENTRY(game).forEach((p, i) => stand(game, GUARDS[i], p, { yaw: -Math.PI / 2, idle: null }));
        f.doors.guardDoor.unlock(); f.doors.guardDoor.setOpen(true);
        game.sound?.hit?.('block', 0.8);
        game.fists(true);
        m.s = { ...m.s, inT: 0, open: false, fighting: false, won: false, lost: false, tip: 0, tipT: 0, end: false, arrived: 0 };
        const live = attempt(game, m);
        GUARDS.forEach((id, i) => walkPath(game.npc(id), PATH(game, i), { onDone: () => { if (live()) m.s.arrived++; } }));
        game.dialogue.play(IN);
      },
      target(m, game) {
        const me = game.player.pos, F = m.fight;
        let best = null, bd = Infinity;
        for (const id of GUARDS) {
          const n = game.npc(id);
          if (!n.visible) continue;
          const o = F?.opponents.find((q) => q.npc === n);
          if (o?.fighter.down) continue;
          const d = Math.hypot(n.pos.x - me.x, n.pos.z - me.z);
          if (d < bd) { bd = d; best = n; }
        }
        return best ? { x: best.pos.x, z: best.pos.z, y: best.pos.y, r: 1.2 } : null;
      },
      update(m, game, dt) {
        const f = FAC(game), c = C(game), me = game.player.pos;
        m.s.inT += dt;
        // the first one in the hallway: every cell door slides open
        if (!m.s.open && (GUARDS.some((id) => game.npc(id).pos.x < -66.5) || m.s.inT > 6)) {
          m.s.open = true;
          c.openAll();
          game.sound?.hit?.('crash', 0.5);
          game.hud.banner('מערכת לחימה חדשה', 'FIST COMBAT', 'אגרוף · מכה חזקה · קומבו · חסימה · התחמקות · דחיפה', 3400);
        }
        // the fight: once they are all in the cell (or one is on Nehorai, or they took too long getting there);
        // whoever is still outside the bars then is through the door, so nobody fights the bars
        const inside = (n) => n.pos.x - f.x < -71.3;
        if (m.s.open && !m.s.fighting && (GUARDS.every((id) => inside(game.npc(id))) || GUARDS.some((id) => near(game.npc(id).pos, me, 3)) || m.s.inT > 12)) {
          m.s.fighting = true;
          GUARDS.forEach((id, i) => { const n = game.npc(id); if (!inside(n)) { const p = L(game, -72.8, -34 + (i - 1.5) * 0.8); n.place(p.x, p.z, -Math.PI / 2, p.y); } });
          brawl(m, game, {
            foes: [
              { id: 'og1', hp: 75, power: 0.85, aggression: 0.95, windup: 0.7, moves: ['jab', 'cross', 'swing'] },
              { id: 'og2', hp: 60, power: 0.75, aggression: 0.9, windup: 0.75, moves: ['swing', 'cross'] },
              { id: 'og3', hp: 70, power: 0.8, aggression: 0.9, windup: 0.7, guard: 0.35, moves: ['cross', 'jab', 'swing'] },
              { id: 'og4', hp: 60, power: 0.75, aggression: 0.85, windup: 0.8, moves: ['swing', 'jab'] },
            ],
            allies: FIGHTERS, max: 2, allyHp: 80, allyPower: 0.3,
          });
          m.s.tipT = 0.5;
        }
        // what the buttons do, one line at a time while the fight is on
        if (m.fight && !m.fight.over && (m.s.tipT -= dt) <= 0 && m.s.tip < TIPS.length) { game.hud.toast(TIPS[m.s.tip++], 2800); m.s.tipT = 4.2; }
        const down = m.fight ? m.fight.opponents.filter((o) => o.fighter.down).length : 0;
        say(m, game, !m.s.fighting ? 'השומרים נכנסים · אגרופים למעלה' : m.s.won ? 'השומרים על הרצפה' : `FIST COMBAT · להפיל את השומרים (${down}/4)`);
        if (m.s.won && !m.s.end) {
          m.s.end = true;
          endBrawl(m, game);
          game.fists(false);
          for (const id of SLEEPERS) game.squad.release(id);
          f.doors.guardDoor.lock(); game.sound?.hit?.('block', 0.7);
          game.hud.toast('דלת השומרים ננעלה', 1800);
          return 'next';
        }
        return null;
      },
    },
    { // 4: after the fight
      objective: 'השומרים על הרצפה',
      enter(m, game) { m.beats = beats(game, [['wait', 0.8], ['say', AFTER], ['wait', 0.4]]); },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; releaseAll(game); for (const id of TEAM) game.squad.release(id); },
    },
  ],
  complete(m, game) { m.done = true; },
};
