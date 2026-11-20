// Mission 4, "we don't fold": the crew from the photo, the Porcupines (invented for the game), sit at
// the boulevard kiosk with the gym's speaker. Talking gets a dare instead: a fist fight at the court
// behind the garages, winner takes the speaker. Three of them first, with Avraham alongside, then their
// leader alone. Beaten fighters sit out; no blood, no weapons. All the people here are fictional.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { makeSpeaker } from '../world/props.js';

const CREW = ['shpitz', 'roller', 'tosti'];
const TALK = [
  ['נהוראי', 'ערב טוב. זה הרמקול של המכון שלנו.'],
  ['קוצי', 'רמקול? אה, זה? מצאנו אותו. ליד פח.'],
  ['אברהם', 'הוא היה על דוכן במכון. יש עליו מדבקה "של ארז".'],
  ['שפיץ', 'מי זה ארז בכלל?'],
  ['קוצי', 'אנחנו לא מחזירים דברים. אנחנו מתערבים.'],
  ['קוצי', 'המגרש מאחורי המוסכים. מי שעומד בסוף, הרמקול שלו.'],
  ['אברהם', 'ואם אנחנו לא עומדים בסוף?'],
  ['קוצי', 'אז אתם קונים לנו פרגיות. חודש.'],
  ['נהוראי', 'לא מתקפלים. יאללה, למגרש.'],
];
const ROUND2 = [
  ['קוצי', 'יפה. עכשיו אני.'],
  ['אברהם', 'אני בחוץ, אחי. קוצי שלך. אני מעודד.'],
];
const END = [
  ['קוצי', 'טוב. טוב! לא מתקפלים, אה?'],
  ['קוצי', 'קחו את הרמקול. ותגידו לארז שהפלייליסט שלו נורא.'],
  ['רולר', 'והנה מאתיים. התערבנו, נכון? אנחנו מכבדים התערבות.'],
  ['אברהם', 'רואה? דיברנו. בסוף.'],
];
const LOSE = 'הדרבנים לקחו את הסיבוב. חוסמים כשהעיגול האדום נסגר, מחזירים כשהוא צהוב, ומנסים שוב.';

const court = (game) => game.world.places.court;
const spot = (game, lx, lz) => { const c = court(game); return { x: c.x + lx, z: c.z + lz }; };

// everyone at the kiosk: the four of them sitting around the tables, the speaker on one of them
function atKiosk(m, game) {
  const K = game.world.places.kiosk;
  ['kotzi', ...CREW].forEach((id, i) => {
    const n = game.npc(id), s = K.seats[[0, 1, 3, 4][i]];
    n.place(s.x, s.z, s.yaw);
    n.idle = null;
    n.model.setPose('sit');
    n.show(true);
  });
  if (!m.speaker) { m.speaker = makeSpeaker(); game.scene.add(m.speaker); }
  m.speaker.position.set(K.seats[0].x + 0.55, K.y + 0.75, K.seats[0].z + 0.6);
  m.speaker.rotation.set(0, Math.PI, 0);
}

// the court before a round: friends and rivals where they stand (and Nehorai in the middle, on a retry)
function lineUp(m, game, round, movePlayer = true) {
  const c = court(game), av = game.npc('avraham');
  game.exitCar();
  if (movePlayer) { game.player.place(c.x, c.z + 4, Math.PI); game.follow.snapBehind(Math.PI); }
  game.fighter.revive();
  game.nehorai.setPose(null);
  const a = spot(game, 2.2, 4.6);
  av.place(a.x, a.z, Math.PI);
  av.show(true);
  av.model.setPose(null);
  const kotzi = game.npc('kotzi');
  CREW.forEach((id, i) => {
    const n = game.npc(id);
    n.show(true);
    if (round === 1) { const p = spot(game, (i - 1) * 3.2, -3); n.place(p.x, p.z, 0); n.model.setPose(null); }
    else { const p = spot(game, -c.hx + 1.5, -4 + i * 2.4); n.place(p.x, p.z, Math.PI / 2); n.model.setPose('down'); } // sitting out at the side
  });
  const k = round === 1 ? spot(game, c.hx - 1, -c.hz + 1) : spot(game, 0, -3.5);
  kotzi.place(k.x, k.z, round === 1 ? -Math.PI / 2 : 0);
  kotzi.model.setPose(null);
  kotzi.idle = round === 1 ? 'arms' : null;
  kotzi.show(true);
  if (round === 2) { const f = spot(game, c.hx - 1.5, 5); av.place(f.x, f.z, -Math.PI / 2); }
}

function roundOne(m, game) {
  m.s.won = m.s.lost = false;
  m.fight = new Fight(game, {
    maxAttackers: 2,
    opponents: CREW.map((id, i) => ({ npc: game.npc(id), hp: 48, power: 0.8, aggression: 0.85 + i * 0.08, windup: 0.68, moves: [['swing', 'cross'], ['cross', 'jab', 'swing'], ['jab', 'swing']][i] })),
    allies: [{ npc: game.npc('avraham'), hp: 80, power: 0.75 }],
    onWin: () => { m.s.won = true; },
    onLose: () => { m.s.lost = true; },
  });
}

function roundTwo(m, game) {
  m.s.won = m.s.lost = false;
  const av = game.npc('avraham');
  av.idle = null;
  av.model.setPose('cheer');
  m.fight = new Fight(game, {
    opponents: [{ npc: game.npc('kotzi'), hp: 95, power: 1.1, aggression: 1.08, windup: 0.56, moves: ['swing', 'cross', 'jab', 'swing', 'cross'] }],
    onWin: () => { m.s.won = true; },
    onLose: () => { m.s.lost = true; },
  });
}

function endFight(m) { m.fight?.dispose(); m.fight = null; }

// the speaker goes back to wherever it belongs; the crew stays where it is until Nehorai is gone
function tidy(m, game) {
  for (const id of ['kotzi', ...CREW]) { const n = game.npc(id); if (n.model.pose === 'down' || n.model.pose === 'sit') n.model.setPose(null); }
  if (m.speaker) { m.speaker.removeFromParent(); m.speaker = null; }
  game.nehorai.setPose(null);
}

export default {
  id: 'crew', number: 4, title: 'לא מתקפלים',
  requires: ['hadera'],
  where: 'לסימון הכחול ליד הקיוסק בשדרה',
  reward: { money: 200, unlocks: ['speaker', 'dolev'], text: 'הרמקול חזר למכון · 200 ₪ מההתערבות · מישהו בשם דולב שמע על המגרש' },

  startAt: (game) => ({ ...game.world.places.kiosk.front, y: game.world.places.kiosk.y }),

  setup(m, game) {
    atKiosk(m, game);
    const av = game.npc('avraham'), p = game.player.pos;
    if (av.inCar) av.stepOut(-1);
    if (!av.visible || Math.hypot(av.pos.x - p.x, av.pos.z - p.z) > 25) { av.place(p.x + 1.4, p.z + 1.2, game.player.yaw); av.show(true); }
    av.idle = null;
  },

  prepareReplay(game) {
    const K = game.world.places.kiosk;
    game.exitCar();
    game.start(K.front.x + 4, K.front.z + 3, Math.PI);
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    game.follow.override = null;
    lineUp(m, game, checkpoint === 4 ? 2 : 1);
    m.restored = checkpoint;
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    tidy(m, game);
  },

  steps: [
    { // 0
      objective: 'לגשת לקיוסק עם אברהם',
      target: (m, game) => ({ ...game.world.places.kiosk.front, y: game.world.places.kiosk.y, r: 2 }),
      update(m, game) {
        const av = game.npc('avraham'), p = game.player.pos;
        if (!av.target && Math.hypot(av.pos.x - p.x, av.pos.z - p.z) > 3) av.walkTo(p.x + 1, p.z + 1, { near: 1.6, run: true });
        return game.mode === 'foot' && near(p, game.world.places.kiosk.front, 3) ? 'next' : null;
      },
    },
    { // 1: the talk
      objective: 'לדבר איתם',
      enter(m, game) {
        const K = game.world.places.kiosk, kotzi = game.npc('kotzi');
        game.cutscene = true;
        kotzi.model.setPose(null);
        kotzi.walkTo(K.front.x - 0.3, K.front.z - 2.2, { onArrive: () => kotzi.lookAt(game.player.pos.x, game.player.pos.z) });
        game.player.yaw = Math.atan2(K.x - game.player.pos.x, K.z - game.player.pos.z);
        const from = { x: K.front.x + 4.5, y: K.y + 2.2, z: K.front.z + 3.5 };
        game.follow.shot(from, { x: K.front.x - 1.5, y: K.y + 1.1, z: K.front.z - 3 }, 60);
        game.dialogue.play(TALK).then(() => { m.s.talked = true; });
      },
      update: (m) => (m.s.talked ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        // they head off to the court; whoever is out of sight is simply there already
        ['kotzi', ...CREW].forEach((id, i) => {
          const n = game.npc(id), p = spot(game, (i - 1.5) * 3, -3);
          n.model.setPose(null);
          n.walkTo(p.x, p.z, { run: true });
        });
        if (m.speaker) { m.speaker.removeFromParent(); m.speaker = null; } // they take it with them
      },
    },
    { // 2: to the court
      objective: 'ללכת למגרש מאחורי המוסכים',
      target: (m, game) => ({ ...court(game).gate, y: court(game).y, r: 3 }),
      update(m, game) {
        const c = court(game), p = game.player.pos, av = game.npc('avraham');
        // the crew does not keep Nehorai waiting: far from view, they are already at the court
        ['kotzi', ...CREW].forEach((id, i) => {
          const n = game.npc(id);
          if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 60 && n.target) { const q = spot(game, (i - 1.5) * 3, -3); n.place(q.x, q.z, 0); }
        });
        if (game.mode === 'foot' && !av.inCar && Math.hypot(av.pos.x - p.x, av.pos.z - p.z) > 4 && !av.target) av.walkTo(p.x + 1, p.z + 1, { near: 1.8, run: true });
        say(m, game, game.mode === 'car' && near(game.car.pos, c.gate, 50) ? 'לצאת מהרכב ולהיכנס למגרש ברגל' : 'ללכת למגרש מאחורי המוסכים');
        const inside = Math.abs(p.x - c.x) < c.hx && Math.abs(p.z - c.z) < c.hz;
        if (game.mode === 'foot' && inside) {
          if (Math.hypot(av.pos.x - p.x, av.pos.z - p.z) > 25) { const q = spot(game, 2.2, 4.6); av.place(q.x, q.z, Math.PI); av.show(true); }
          return 'next';
        }
        return null;
      },
    },
    { // 3: round one
      objective: 'סיבוב ראשון: שלושה מהדרבנים, אברהם איתך', checkpoint: true,
      enter(m, game) {
        if (m.restored !== 3) lineUp(m, game, 1, false);
        m.restored = null;
        game.hud.banner('לא מתקפלים', 'סיבוב ראשון', 'שפיץ, רולר וטוסטי · אברהם איתך', 2000);
        roundOne(m, game);
      },
      update(m, game) {
        if (m.s.lost) return `fail:${LOSE}`;
        const left = m.fight ? m.fight.standing.length : 0;
        if (m.s.shown !== left) { m.s.shown = left; game.hud.setObjective(`סיבוב ראשון: עוד ${left} מהדרבנים על הרגליים`); }
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 4: round two
      objective: 'סיבוב אחרון: קוצי', checkpoint: true,
      enter(m, game) {
        const retry = m.restored === 4;
        m.restored = null;
        if (!retry) {
          const c = court(game), kotzi = game.npc('kotzi'), av = game.npc('avraham');
          kotzi.idle = null;
          const k = spot(game, 0, -3.5);
          kotzi.walkTo(k.x, k.z);
          const f = spot(game, c.hx - 1.5, 5);
          av.walkTo(f.x, f.z, { onArrive: () => { av.lookAt(c.x, c.z); av.model.setPose('cheer'); } });
        }
        game.dialogue.play(ROUND2);
        game.hud.banner('לא מתקפלים', 'סיבוב אחרון', 'קוצי', 1800);
      },
      update(m, game) {
        if (!m.fight && m.t > 1.6) roundTwo(m, game); // a breather between the rounds, then Kotzi
        if (m.s.lost) return `fail:${LOSE}`;
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 5: the speaker comes back
      objective: 'לשמוע מה קוצי אומר',
      enter(m, game) {
        const kotzi = game.npc('kotzi'), p = game.player.pos;
        game.cutscene = true;
        kotzi.model.setPose(null);
        kotzi.model.play('getup');
        kotzi.lookAt(p.x, p.z);
        game.nehorai.setPose(null);
        const roller = game.npc('roller');
        roller.model.setPose(null);
        roller.model.play('getup');
        game.dialogue.play(END).then(() => { m.s.talked = true; });
      },
      update: (m) => (m.s.talked ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        // Nehorai carries the speaker in both hands
        m.speaker = makeSpeaker();
        m.speaker.position.set(0, 0.78, 0.42);
        game.nehorai.root.add(m.speaker);
        game.nehorai.setPose('carry');
        for (const id of CREW) game.npc(id).model.setPose(null);
      },
    },
    { // 6: into the car with it
      objective: 'להחזיר את הרמקול לרנו',
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      interaction(m, game) {
        if (game.mode !== 'foot' || game.car.doorDistance(game.player.pos.x, game.player.pos.z) > 2.2) return null;
        return { label: 'לשים את הרמקול ברכב', priority: 5, run: () => { m.s.loaded = true; } };
      },
      update(m, game) {
        if (game.nehorai.pose !== 'carry' && !m.s.loaded && game.mode === 'foot' && !game.combat) game.nehorai.setPose('carry');
        if (!m.s.loaded) return null;
        if (m.speaker) { m.speaker.removeFromParent(); m.speaker = null; }
        game.nehorai.setPose(null);
        return 'next';
      },
    },
  ],
};
