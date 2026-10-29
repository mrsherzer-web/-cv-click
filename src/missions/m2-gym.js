// Mission 2, "the crew at the gym": Erez's practice (the bag, covering up, stepping out of a wide
// punch), an agreed sparring round with Yonati in the ring, and a talk that sends everyone to Hadera
// after the gym's speaker. Friends practicing by agreement; the lines are written for the game and do
// not describe the real people.
import { near } from './missions.js';
import { Fight } from '../combat/fight.js';
import { gymCrowd } from './m1-pickup.js';

const BAG_HITS = 6, BLOCKS = 3, DODGES = 3;

const INTRO = [
  ['ארז', 'לפני שמדברים על הרמקול, נראה מה נשאר לך בידיים.'],
  ['ארז', 'שק. שש מכות נקיות. הכפתור האדום.'],
  ['יונתי', 'הוא אומר "נקיות" כאילו מישהו מנקה פה.'],
];
const BLOCK = [
  ['ארז', 'עכשיו אני זורק ואתה סוגר.'],
  ['ארז', 'רואה עיגול אדום מתחתיי? מחזיקים "הגנה". לא לפני ולא אחרי.'],
];
const DODGE = [
  ['ארז', 'יפה. עכשיו מכה רחבה. אותה לא חוסמים, יוצאים ממנה.'],
  ['ארז', '"התחמקות" ברגע האחרון. ואם נשארתי פתוח, עיגול צהוב, מחזירים לי.'],
];
const SPAR = [
  ['יונתי', 'נהוראי! סיבוב אחד בזירה. ספרינג, בהסכמה, בלי לבכות אחר כך.'],
  ['נהוראי', 'מי בדיוק הולך לבכות?'],
  ['יונתי', 'נראה. מולר, תצלם לי את זה לסטורי.'],
  ['מולר', 'לא.'],
];
const AFTER = [
  ['יונתי', 'אוקיי, אוקיי! נתתי לך לנצח כי אתה האורח.'],
  ['ארז', 'הוא לא אורח. הוא פה כל יום.'],
  ['יונתי', 'אז נתתי לך לנצח כי אני נדיב.'],
];
const TALK = [
  ['מולר', 'חבר׳ה. תסתכלו רגע.'],
  ['מולר', 'הדרבנים העלו סטורי. עם הרמקול שלנו. ליד קיוסק בחדרה.'],
  ['ארז', 'הרמקול של המכון. שקניתי מהכסף שלי. שמנגן רק את הפלייליסט שלי.'],
  ['אברהם', 'רגע, הדרבנים? אלה שקוראים לעצמם על שם חיה עם קוצים?'],
  ['יונתי', 'דרבן זאת חיה רצינית, אחי. אל תזלזל.'],
  ['נהוראי', 'מחר יורדים לחדרה ומחזירים אותו. בדיבור.'],
  ['ארז', 'בדיבור. ואם לא, לפחות עכשיו אתה יודע להחזיק ידיים.'],
  ['אברהם', 'אני בא. מישהו צריך לדבר שם, ונהוראי מדבר כמו הודעה של מולר.'],
  ['מולר', 'פה.'],
];

const SPAR_FAIL = 'יונתי לקח את הסיבוב. בספרינג מותר להפסיד, ומותר גם לבקש עוד אחד.';

// a point in the hall, by its own coordinates (x along the hall, z toward the door)
const at = (game, lx, lz) => { const g = game.world.places.gym, p = g.toWorld(lx, lz); return { x: p.x, z: p.z, y: g.floorY }; };
const ringPoint = (game, dz) => { const R = game.world.places.gym.ring; return at(game, R.x, R.z + dz); };

function count(m, game, label, n, total) {
  if (m.s.shown === n) return;
  m.s.shown = n;
  game.hud.setObjective(`${label} (${Math.min(n, total)}/${total})`);
}

// Erez as a sparring coach: slow, honest wind-ups, light punches, and he never goes down
function drill(m, game, move) {
  const erez = game.npc('erez');
  m.fight = new Fight(game, {
    safe: true,
    opponents: [{ npc: erez, hp: 100, power: 0.3, moves: [move], windup: 0.95, aggression: 0.85, drill: true, name: 'ארז' }],
  });
}

function endFight(m) {
  m.fight?.dispose();
  m.fight = null;
}

// sparring partners at their corners, both fresh
function toCorners(game) {
  const g = game.world.places.gym, yon = game.npc('yonati'), you = ringPoint(game, 1.3), them = ringPoint(game, -1.3);
  yon.place(them.x, them.z, g.yaw);
  yon.show(true);
  yon.idle = null;
  game.exitCar();
  game.player.place(you.x, you.z, g.yaw + Math.PI);
  game.follow.snapBehind(g.yaw + Math.PI);
  game.fighter.revive();
}

function spar(m, game) {
  const yon = game.npc('yonati');
  m.s.won = m.s.lost = false;
  m.fight = new Fight(game, {
    opponents: [{ npc: yon, hp: 60, power: 0.55, moves: ['jab', 'cross', 'swing'], windup: 0.72, aggression: 0.9, name: 'יונתי' }],
    onWin: () => { m.s.won = true; },
    onLose: () => { m.s.lost = true; },
  });
}

export default {
  id: 'gym', number: 2, title: 'החבורה במכון',
  requires: ['pickup'],
  reward: { unlocks: ['combo', 'hadera'], text: 'נלמדה קומבינציה: ג׳אב, קרוס והוק. המכה השלישית ברצף חזקה במיוחד.' },

  // the blue marker between the bags, where Erez is waiting
  startAt: (game) => at(game, -7, -2.4),

  setup(m, game) {
    game.exitCar();
    gymCrowd(game);
    const av = game.npc('avraham'), S = game.world.places.gymSpots;
    av.place(S.avraham.x, S.avraham.z, S.avraham.yaw);
    av.show(true);
    av.idle = 'phone';
    game.fighter.revive();
    game.nehorai.setPose(null);
  },

  prepareReplay(game) {
    const p = at(game, -7, 0);
    game.exitCar();
    game.start(p.x, p.z, game.world.places.gym.yaw + Math.PI);
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    if (checkpoint === 4) toCorners(game);
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    game.follow.override = null;
    for (const id of ['erez', 'yonati']) { const n = game.npc(id); if (n.model.pose === 'down') n.model.setPose(null); }
    game.populate({ walk: true });
  },

  steps: [
    { // 0: six on the bag
      objective: `לתת ${BAG_HITS} מכות בשק`,
      enter(m, game) {
        const erez = game.npc('erez'), stand = at(game, -7.2, -2.2);
        erez.idle = 'arms';
        erez.walkTo(stand.x, stand.z, { onArrive: () => erez.lookAt(game.player.pos.x, game.player.pos.z) });
        m.s.bag0 = game.bagHits;
        game.dialogue.play(INTRO);
      },
      target: (m, game) => { const b = game.world.places.gymBags[0]; return { x: b.x, z: b.z, y: game.world.places.gym.floorY, r: 1.3 }; },
      update(m, game) {
        const n = game.bagHits - m.s.bag0;
        count(m, game, `לתת ${BAG_HITS} מכות בשק`, n, BAG_HITS);
        return n >= BAG_HITS ? 'next' : null;
      },
    },
    { // 1: cover up against Erez's straight punches
      objective: `לחסום ${BLOCKS} מכות של ארז`,
      enter(m, game) {
        m.s.shown = -1;
        game.dialogue.play(BLOCK);
        m.s.b0 = game.fighter.blocks;
        drill(m, game, 'cross');
      },
      target: (m, game) => ({ ...game.npc('erez').pos, r: 0.9 }),
      update(m, game) {
        const n = game.fighter.blocks - m.s.b0;
        count(m, game, `לחסום ${BLOCKS} מכות של ארז, להחזיק "הגנה"`, n, BLOCKS);
        return n >= BLOCKS ? 'next' : null;
      },
      exit: endFight,
    },
    { // 2: step out of a wide one
      objective: `להתחמק מ־${DODGES} מכות רחבות`,
      enter(m, game) {
        m.s.shown = -1;
        game.dialogue.play(DODGE);
        m.s.d0 = game.fighter.dodges;
        drill(m, game, 'swing');
      },
      target: (m, game) => ({ ...game.npc('erez').pos, r: 0.9 }),
      update(m, game) {
        const n = game.fighter.dodges - m.s.d0;
        count(m, game, `להתחמק מ־${DODGES} מכות רחבות של ארז`, n, DODGES);
        return n >= DODGES ? 'next' : null;
      },
      exit(m, game) {
        endFight(m);
        const erez = game.npc('erez'), S = game.world.places.gymSpots;
        erez.model.setPose(null);
        erez.walkTo(S.erez.x + 1.2, S.erez.z + 2.4, { onArrive: () => { erez.idle = 'arms'; erez.lookAt(game.player.pos.x, game.player.pos.z); } });
      },
    },
    { // 3: into the ring
      objective: 'להיכנס לזירה',
      enter(m, game) {
        const yon = game.npc('yonati'), them = ringPoint(game, -1.3);
        yon.idle = null;
        yon.model.setPose(null);
        yon.walkTo(them.x, them.z, { onArrive: () => yon.lookAt(game.player.pos.x, game.player.pos.z) });
        game.dialogue.play(SPAR);
      },
      target: (m, game) => ({ ...ringPoint(game, 1.0), r: 1.2 }),
      update: (m, game) => (game.mode === 'foot' && game.world.places.gym.inRing(game.player.pos.x, game.player.pos.z) ? 'next' : null),
    },
    { // 4: the sparring round
      objective: 'ספרינג מול יונתי: להפיל אותו לפני שהוא מפיל אותך', checkpoint: true,
      enter(m, game) {
        game.dialogue.stop();
        game.hud.banner('ספרינג', 'נהוראי מול יונתי', 'בהסכמה, עם כפפות דמיוניות', 1800);
        spar(m, game);
      },
      update(m, game) {
        if (m.s.lost) return `fail:${SPAR_FAIL}`;
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 5: the speaker, and Hadera
      objective: 'לשמוע מה מולר מצא',
      enter(m, game) {
        const g = game.world.places.gym, yon = game.npc('yonati');
        game.cutscene = true;
        yon.model.setPose(null);
        yon.model.play('getup');
        const meet = at(game, 1.2, 0.6);
        game.player.place(meet.x, meet.z, g.yaw + Math.PI * 0.5);
        game.nehorai.setPose(null);
        const spots = { yonati: [2.6, -0.6], erez: [0.2, -1.4], muller: [2.8, 1.2], avraham: [-0.4, 1.6] };
        for (const [id, [lx, lz]] of Object.entries(spots)) {
          const n = game.npc(id), p = at(game, lx, lz);
          n.idle = id === 'muller' ? 'phone' : null;
          n.show(true);
          if (near(n.pos, p, 8)) n.walkTo(p.x, p.z, { onArrive: () => n.lookAt(meet.x, meet.z) });
          else { n.place(p.x, p.z, 0); n.lookAt(meet.x, meet.z); }
        }
        const from = at(game, -2.4, 3.6), look = at(game, 1.6, 0);
        game.follow.shot({ x: from.x, y: g.floorY + 2.4, z: from.z }, { x: look.x, y: g.floorY + 1.2, z: look.z }, 90);
        game.dialogue.play([...AFTER, ...TALK]).then(() => { m.s.talked = true; });
      },
      update: (m) => (m.s.talked ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
  ],
};
