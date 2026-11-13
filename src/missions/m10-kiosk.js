// Chapter two, mission 3, "a visit to the kiosk": Hadar wants a word with the Porcupines (invented for
// the game), the crew that took the speaker in chapter one. Their heavyweight, Bulldozer, is back and
// says the speaker was luck. A bout at the court settles it, two on two, by agreement: Nehorai and Hadar
// against Bulldozer and Shpitz. Bulldozer does not take losing well: he grabs Hadar's bag, with the
// gloves Hadar brought back from New York, and they drive off. No blood, no weapons; beaten fighters
// sit out. The lines are written for the game and do not describe the real people.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';

const CREW = ['kotzi', 'shpitz', 'roller', 'tosti'];
const TALK = [
  ['קוצי', 'וואלה. נהוראי. והבאת... מי זה? האמריקאי?'],
  ['הדר', 'הדר. מקציר. אני לא אמריקאי, אחי, הייתי שם שנה.'],
  ['בולדוזר', 'אז זה הוא? ששמעתי שניצחתם במזל?'],
  ['נהוראי', 'במזל? היית פה בכלל?'],
  ['בולדוזר', 'לא. בגלל זה היה לכם מזל.'],
  ['הדר', 'אוקיי. בוא נעשה את זה כמו בניו יורק. סיבוב אחד, במגרש. שניים על שניים.'],
  ['קוצי', 'ואם אתם מפסידים?'],
  ['הדר', 'אני קונה שווארמה לכל הקיוסק.'],
  ['בולדוזר', 'ואם אנחנו מפסידים?'],
  ['הדר', 'אז אתם מפסיקים לספר על מזל. ומחזירים לארז את המדבקה שלו מהשולחן.'],
  ['קוצי', 'סגור. למגרש.'],
];
const BAG = [
  ['הדר', 'יפה, נהוראי! ככה בדיוק!'],
  ['בולדוזר', '...טוב. ניצחתם.'],
  ['בולדוזר', 'אבל התיק הזה? זה נראה כמו תיק של מישהו שהפסיד.'],
  ['הדר', 'רגע. זה התיק שלי. הכפפות שלי שם! הבאתי אותן מניו יורק!'],
  ['בולדוזר', 'אז תבוא לקחת! שפיץ, לאוטו!'],
  ['קוצי', 'בולדוזר, לא ככה... יא אללה. אני הולך איתם לפני שהם עושים שטויות.'],
  ['הדר', 'נהוראי! לרנו! הם לא בורחים לי עם הכפפות!'],
];
const LOSE = 'בולדוזר ושפיץ לקחו את הסיבוב. חוסמים כשהעיגול האדום נסגר, מחזירים כשהוא צהוב, ושומרים כוח לאפרקאט.';

const court = (game) => game.world.places.court;
const spot = (game, lx, lz) => { const c = court(game); return { x: c.x + lx, z: c.z + lz }; };

// the crew at their kiosk tables, Bulldozer standing by them
function atKiosk(game) {
  const K = game.world.places.kiosk;
  CREW.forEach((id, i) => {
    const n = game.npc(id), s = K.seats[[0, 1, 3, 4][i]];
    n.place(s.x, s.z, s.yaw);
    n.idle = null;
    n.model.setPose('sit');
    n.show(true);
  });
  const b = game.npc('bulldozer'), f = K.front;
  b.place(f.x - 1.6, f.z - 1.8, 0);
  b.idle = 'arms';
  b.model.setPose(null);
  b.show(true);
}

// the court before the bout: the two of them across from Nehorai and Hadar, the other two watching
function lineUp(game, movePlayer = true) {
  const c = court(game), h = game.npc('hadar');
  game.exitCar();
  game.hadarBuddy.held = true;
  if (h.inCar) h.stepOut(-1);
  if (movePlayer) { game.player.place(c.x - 1.4, c.z + 4, Math.PI); game.follow.snapBehind(Math.PI); }
  game.fighter.revive();
  game.nehorai.setPose(null);
  const hp = spot(game, 1.4, 4);
  h.place(hp.x, hp.z, Math.PI);
  h.idle = null;
  h.model.setPose(null);
  h.show(true);
  ['bulldozer', 'shpitz'].forEach((id, i) => { const n = game.npc(id), p = spot(game, (i ? -1.6 : 1.6), -3); n.place(p.x, p.z, 0); n.idle = null; n.model.setPose(null); n.show(true); });
  ['kotzi', 'roller', 'tosti'].forEach((id, i) => { const n = game.npc(id), p = spot(game, c.hx - 1.2, -3 + i * 2.2); n.place(p.x, p.z, -Math.PI / 2); n.idle = 'arms'; n.model.setPose(null); n.show(true); });
}

function bout(m, game) {
  m.s.won = m.s.lost = false;
  m.fight = new Fight(game, {
    maxAttackers: 2,
    opponents: [
      { npc: game.npc('bulldozer'), hp: 110, power: 1.05, aggression: 1.0, windup: 0.62, moves: ['swing', 'cross', 'swing', 'jab'], name: 'בולדוזר' },
      { npc: game.npc('shpitz'), hp: 55, power: 0.8, aggression: 0.95, windup: 0.68, moves: ['jab', 'cross', 'swing'] },
    ],
    allies: [{ npc: game.npc('hadar'), hp: 110, power: 1.0 }],
    onWin: () => { m.s.won = true; },
    onLose: () => { m.s.lost = true; },
  });
}

function endFight(m) { m.fight?.dispose(); m.fight = null; }

export default {
  id: 'kiosk', chapter: 2, number: 3, title: 'ביקור בקיוסק',
  requires: ['boxer'],
  where: 'לסימון הכחול ליד הקיוסק בשדרה, בחדרה. הדר בא איתך',
  reward: { money: 100, text: 'בולדוזר הפסיד, ולקח את התיק של הדר' },

  startAt: (game) => ({ ...game.world.places.kiosk.front, y: game.world.places.kiosk.y }),

  setup(m, game) {
    atKiosk(game);
    game.hadarBuddy.held = false;
    if (!game.hadarBuddy.active) game.hadarBuddy.join();
  },

  prepareReplay(game) {
    const p = game.world.places.safeParking;
    game.exitCar();
    game.car.place(p.x, p.z, p.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, p.yaw);
    game.hadarBuddy.join();
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    game.follow.override = null;
    if (checkpoint === 2) lineUp(game);
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    game.follow.override = null;
    game.hadarBuddy.held = false;
    for (const id of [...CREW, 'bulldozer']) { const n = game.npc(id); if (n.model.pose === 'down') n.model.setPose(null); }
  },

  steps: [
    { // 0: the talk at the kiosk
      objective: 'לדבר עם הדרבנים',
      enter(m, game) {
        const K = game.world.places.kiosk, h = game.npc('hadar');
        game.cutscene = true;
        game.hadarBuddy.held = true;
        game.exitCar();
        if (h.inCar) h.stepOut(-1);
        const hp = { x: game.player.pos.x + 1.2, z: game.player.pos.z + 0.8 };
        h.place(hp.x, hp.z, 0);
        h.show(true);
        h.lookAt(K.front.x - 1.6, K.front.z - 1.8);
        game.player.yaw = Math.atan2(K.x - game.player.pos.x, K.z - game.player.pos.z);
        game.follow.shot({ x: K.front.x + 4.5, y: K.y + 2.2, z: K.front.z + 3.5 }, { x: K.front.x - 1.5, y: K.y + 1.1, z: K.front.z - 2.5 }, 60);
        game.dialogue.play(TALK).then(() => { m.s.talked = true; });
      },
      update: (m) => (m.s.talked ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.hadarBuddy.held = false;
        game.hadarBuddy.join({ near: game.npc('hadar').pos });
        // they head off to the court; whoever is out of sight is simply there already
        [...CREW, 'bulldozer'].forEach((id, i) => {
          const n = game.npc(id), p = spot(game, (i - 2) * 2.6, -3);
          n.model.setPose(null);
          n.idle = null;
          n.walkTo(p.x, p.z, { run: true });
        });
      },
    },
    { // 1: to the court
      objective: 'ללכת למגרש מאחורי המוסכים',
      target: (m, game) => ({ ...court(game).gate, y: court(game).y, r: 3 }),
      update(m, game) {
        const c = court(game), p = game.player.pos;
        [...CREW, 'bulldozer'].forEach((id, i) => {
          const n = game.npc(id);
          if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 60 && n.target) { const q = spot(game, (i - 2) * 2.6, -3); n.place(q.x, q.z, 0); }
        });
        say(m, game, game.mode === 'car' && near(game.car.pos, c.gate, 50) ? 'לצאת מהרכב ולהיכנס למגרש ברגל' : 'ללכת למגרש מאחורי המוסכים');
        const inside = Math.abs(p.x - c.x) < c.hx && Math.abs(p.z - c.z) < c.hz;
        return game.mode === 'foot' && inside ? 'next' : null;
      },
    },
    { // 2: the bout
      objective: 'שניים על שניים: נהוראי והדר מול בולדוזר ושפיץ', checkpoint: true,
      enter(m, game) {
        lineUp(game, false);
        game.hud.banner('סיבוב אחד', 'בולדוזר ושפיץ', 'הדר לצידך', 2200);
        bout(m, game);
      },
      update(m, game) {
        if (m.s.lost) return `fail:${LOSE}`;
        if (m.fight && m.s.left !== m.fight.standing.length) { m.s.left = m.fight.standing.length; say(m, game, `שניים על שניים: עוד ${m.s.left} על הרגליים`); }
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 3: the bag
      objective: 'בולדוזר לא אוהב להפסיד',
      enter(m, game) {
        const c = court(game), b = game.npc('bulldozer'), h = game.npc('hadar');
        game.cutscene = true;
        for (const id of ['bulldozer', 'shpitz']) { const n = game.npc(id); if (n.model.pose === 'down') { n.model.setPose(null); n.model.play('getup'); } }
        h.model.setPose('cheer');
        const from = spot(game, 5, 6);
        game.follow.shot({ x: from.x, y: c.y + 2.6, z: from.z }, { x: c.x, y: c.y + 1.1, z: c.z - 1 }, 60);
        game.dialogue.play(BAG).then(() => { m.s.gone = true; });
        b.model.setPose('carry'); // Hadar's bag in his arms
      },
      update(m, game) {
        if (m.t > 2.5 && !m.s.calmed) { m.s.calmed = true; game.npc('hadar').model.setPose(null); }
        // as the last lines are said, the three of them make for the street
        if (m.t > 6 && !m.s.ran) {
          m.s.ran = true;
          const c = court(game);
          for (const id of ['bulldozer', 'shpitz', 'kotzi']) game.npc(id).walkTo(c.gate.x, c.gate.z + 4, { run: true });
        }
        return m.s.gone ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.npc('bulldozer').model.setPose(null);
        game.npc('hadar').model.setPose(null);
      },
    },
  ],
};
