// Chapter three, mission 1, "boxing night": a week after the chase, the court in Hadera is set up as
// a ring for one evening, as agreed at the gas station: gloves, a referee, both crews watching. Hadar
// calls; Nehorai opens the evening against Shpitz, two rounds, with Hadar in his corner and one tip
// between the rounds. By agreement, no blood, a fighter who goes down is out of the bout. The lines
// are written for the game and do not describe the real people.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { ROUND, twoShot } from '../combat/bout.js';

export const FRIENDS = ['erez', 'yonati', 'avraham', 'dolev'];
export const PORCUPINES = ['kotzi', 'roller', 'tosti'];
const CALL = [
  ['הדר', 'Bro! שישי. הערב. כל החבר׳ה כבר במגרש בחדרה, וגם הדרבנים.', 'phone'],
  ['נהוראי', 'אני בא. להביא משהו?'],
  ['הדר', 'מים, מגבת, ואת הפנים שלך. אתה פותח את הערב.', 'phone'],
  ['נהוראי', 'אני... מה?'],
  ['הדר', 'קוצי סידר קרב פתיחה. אתה מול שפיץ, שני סיבובים. הוא רוצה סיבוב חוזר מהמגרש.', 'phone'],
  ['נהוראי', 'שפיץ? הוא זז כמו זבוב אחרי אספרסו.'],
  ['הדר', 'בגלל זה אני בפינה שלך. יאללה, למגרש.', 'phone'],
];
const DRIVE = [['נהוראי', 'שפיץ. בסדר. ג׳אב, קרוס, לנשום. ולא להסתכל על בולדוזר.']];
const EVENING = [
  ['קוצי', 'גבירותיי ורבותיי! ערב האגרוף הראשון של המגרש! כפפות, שופט, חוקים. בעיקר חוקים.'],
  ['ארז', 'הבאתי במבה לכל השורה הראשונה. גם זה חוק.'],
  ['יונתי', 'אני מצלם הכל. מי שנופל, נופל בהילוך איטי.'],
  ['מולר', 'שופט.'],
  ['הדר', 'נהוראי, לפינה האדומה. אני שם לך את הכפפות.'],
  ['שפיץ', 'הפעם בלי בולדוזר לידי. רק אני ואתה.'],
  ['נהוראי', 'ואתה בטוח שזה רעיון טוב, שפיץ?'],
  ['קוצי', 'קרב הפתיחה! שני סיבובים! נהוראי מקציר, מול שפיץ מהקיוסק!'],
];
// Hadar in the corner: what Nehorai needs for round two (each one changes the round)
const TIPS = [
  { id: 'air', label: 'אוויר', note: 'יותר כוח לאורך כל הסיבוב', line: 'תנשום. סיבוב שני על ריאות מלאות. יש לך יותר כוח ממה שאתה חושב.' },
  { id: 'wait', label: 'לחכות לשתיים', note: 'שפיץ נשאר פתוח יותר זמן אחרי מכה', line: 'הוא זורק שתיים ונפתח. תחכה לשתיים, ואז הכל שלך.' },
  { id: 'heavy', label: 'יד כבדה', note: 'כל מכה שלך חזקה יותר', line: 'אחת טובה במקום שלוש. תשים משקל על הרגל האחורית.' },
];
const KO = [
  ['מולר', 'נהוראי.'],
  ['שפיץ', 'אוקיי. היית טוב. אבל רק כי הדר צעק כל הזמן.'],
  ['הדר', 'צעקתי כי אהבתי, אחי.'],
];
const POINTS = [
  ['מולר', 'נקודות. נהוראי.'],
  ['שפיץ', 'נקודות זה לא נחשב. ...טוב, זה נחשב.'],
  ['הדר', 'שני סיבובים על הרגליים מול זבוב עם אספרסו. אני גאה בך.'],
];
const AFTER = [
  ['קוצי', 'נהוראי מנצח! הפסקה של חמש דקות, ואז, האירוע המרכזי!'],
  ['הדר', 'נהוראי. עכשיו תורי. אתה בפינה שלי.'],
];
const LOSE = 'שפיץ לקח את הקרב. הוא מהיר: חוסמים כשהעיגול האדום נסגר, ומחזירים מיד כשהוא צהוב.';
const POINTS_LOST = 'שפיץ ניצח בנקודות. כדי לנצח צריך להוריד לו יותר ממה שהוא מוריד לך: לחסום, ולהחזיר כשהוא פתוח.';

const ring = (game) => game.world.places.courtRing;

// the evening at the court: the ring up, the friends on the gate side, the Porcupines across, Kotzi at
// the bell, Muller by a neutral corner, Bulldozer and Hadar outside their corners
export function setTheNight(game, { bout = 'opening' } = {}) {
  const R = ring(game), C = R.center;
  R.show(true);
  const put = (id, lx, lz, idle, faceIn = true) => {
    const n = game.npc(id), p = R.at(lx, lz);
    if (n.inCar) n.stepOut(-1);
    n.place(p.x, p.z, faceIn ? Math.atan2(C.x - p.x, C.z - p.z) : 0);
    n.target = null; n.face = null;
    n.idle = idle;
    n.model.setPose(null);
    n.show(true);
  };
  FRIENDS.forEach((id, i) => put(id, -1.8 + i * 1.3, 4.7, id === 'yonati' ? 'phone' : 'cheer'));
  put('roller', -0.8, -4.7, 'cheer');
  put('tosti', 0.8, -4.8, 'arms');
  put('kotzi', R.table.x - C.x + 0.2, R.table.z - C.z + 0.8, 'arms');
  put('muller', 3.6, 3.6, 'arms');
  if (bout === 'opening') { put('bulldozer', 4.2, -2.4, 'arms'); put('shpitz', 2.4, -3.9, 'arms'); put('hadar', -3.9, 2.3, null); }
  else { put('shpitz', 4.2, -2.4, 'arms'); }
}

// the two fighters in their corners, inside the ropes
function toCorners(game, red, blue) {
  const R = ring(game), a = R.at(-1.7, 1.7), b = R.at(1.7, -1.7), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  if (red === 'player') {
    game.exitCar();
    game.player.place(a.x, a.z, yaw);
    game.follow.snapBehind(yaw);
    game.nehorai.setPose(null);
  } else { const n = game.npc(red); n.place(a.x, a.z, yaw); n.show(true); }
  const n = game.npc(blue);
  n.place(b.x, b.z, yaw + Math.PI);
  n.idle = null; n.target = null;
  n.model.setPose(null);
  n.show(true);
}

function endFight(m) { m.fight?.dispose(); m.fight = null; }

function startRound(m, game) {
  const s = m.s, tip = s.tip;
  game.fighter.maxStamina = tip === 'air' ? 140 : 100;
  game.fighter.power = tip === 'heavy' ? 1.25 : 1;
  m.fight = new Fight(game, {
    opponents: [{ npc: game.npc('shpitz'), hp: 90, power: 0.85, aggression: 1.12, windup: 0.56, open: tip === 'wait' ? 1.3 : 0.8, moves: ['jab', 'cross', 'jab', 'swing'], name: 'שפיץ' }],
    onWin: () => { s.won = true; },
    onLose: () => { s.lost = true; },
  });
  // round two goes on from where round one left them, with a minute in the corner in between
  if (s.round > 1) { game.fighter.hp = s.hp.me; m.fight.opponents[0].fighter.hp = s.hp.him; }
  s.clock = ROUND;
  s.phase = 'round';
  game.sound?.bell(1);
  game.hud.banner('ערב אגרוף', `סיבוב ${s.round}`, '', 1300);
  board(m, game); // the round board with the bell
}

function board(m, game) {
  const s = m.s, o = m.fight?.opponents[0]?.fighter;
  game.hud.setBout({ round: s.round, of: 2, clock: s.clock, red: { name: 'נהוראי', frac: game.fighter.hpFrac }, blue: { name: 'שפיץ', frac: o ? o.hpFrac : s.hp.him / 90 } });
}

export default {
  id: 'fightnight', chapter: 3, number: 1, title: 'ערב אגרוף',
  requires: ['gloves'],
  incoming: true,
  where: 'הדר יתקשר עוד רגע',
  reward: { money: 200, unlocks: ['fightnight'], text: 'נהוראי ניצח בקרב הפתיחה · 200 ₪ פרס' },

  setup(m, game) {
    game.hadarBuddy.held = true; // tonight he is at the court, getting ready
    if (game.hadarBuddy.active) game.hadarBuddy.leave();
    if (game.companion.active) game.companion.leave();
  },

  prepareReplay(game) {
    const c = game.world.places.court, s = game.world.roadSpot(c.gate.x + 8, c.gate.z + 12);
    game.exitCar();
    game.car.repair();
    if (s) game.car.place(s.x, s.z, s.yaw);
    game.start(c.gate.x + 4, c.gate.z + 6, Math.PI);
  },

  failIf(m, game) {
    if (m.stepIndex === 1 && game.car.disabled) return 'הרנו נפגעה יותר מדי בדרך. לערב האגרוף מגיעים שלמים.';
    return null;
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    game.follow.override = null;
    game.hud.hideChoice();
    game.hud.setBout(null);
    if (checkpoint === 1) game.car.repair(); // the drive again, in a car that drives
    if (checkpoint === 3) {
      setTheNight(game);
      toCorners(game, 'player', 'shpitz');
      game.fighter.revive();
      m.s = {};
    }
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    game.follow.override = null;
    game.hud.hideChoice();
    game.hud.setBout(null);
    game.fighter.maxStamina = 100;
    game.fighter.power = 1;
    game.hadarBuddy.held = false;
    for (const id of ['shpitz', ...FRIENDS, ...PORCUPINES, 'muller', 'bulldozer']) { const n = game.npc(id); if (n.model.pose === 'down') n.model.setPose(null); }
    if (!m.s.follows) ring(game).show(false); // it stays up when the main event follows
  },

  complete(m, game) { m.s.follows = !game.missions.done('mainevent'); },

  steps: [
    { // 0: a week later, Hadar calls
      objective: 'הדר מתקשר. לענות',
      enter(m, game) {
        game.hud.fade('שבוע אחרי · יום שישי', () => { setTheNight(game); }, 900);
      },
      update(m, game) {
        if (!m.s.rang && m.t > 3.2 && !game.hud.fading) { m.s.rang = true; game.hud.showCall('הדר', () => { game.dialogue.play(CALL).then(() => { m.s.talked = true; }); }); }
        return m.s.talked ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 1: to the court
      objective: 'לנסוע למגרש בחדרה, מאחורי המוסכים', checkpoint: true,
      target: (m, game) => ({ ...game.world.places.court.gate, y: game.world.places.court.y, r: 3 }),
      update(m, game) {
        const c = game.world.places.court, p = game.player.pos;
        if (!m.s.drove && game.mode === 'car' && m.t > 4 && !game.dialogue.busy) { m.s.drove = true; game.dialogue.play(DRIVE); }
        say(m, game, game.mode === 'car' && near(game.car.pos, c.gate, 50) ? 'לצאת מהרכב ולהיכנס למגרש ברגל' : 'לנסוע למגרש בחדרה, מאחורי המוסכים');
        const inside = Math.abs(p.x - c.x) < c.hx && Math.abs(p.z - c.z) < c.hz;
        return game.mode === 'foot' && inside ? 'next' : null;
      },
    },
    { // 2: the evening begins
      objective: 'ערב האגרוף',
      enter(m, game) {
        const R = ring(game), C = R.center, h = game.npc('hadar');
        game.cutscene = true;
        game.exitCar();
        const me = R.at(-2.4, 4.4);
        game.player.place(me.x, me.z, Math.atan2(C.x - me.x, C.z - me.z));
        h.place(me.x - 0.9, me.z - 0.5, Math.atan2(C.x - me.x, C.z - me.z));
        h.idle = null;
        game.follow.shot({ x: C.x - 2, y: C.y + 3.4, z: C.z + 8.5 }, { x: C.x, y: C.y + 1, z: C.z }, 90);
        game.hud.banner('ערב אגרוף', 'המגרש · חדרה', 'קרב הפתיחה: נהוראי מול שפיץ', 3000);
        game.sound?.cheer(0.8);
        game.dialogue.play(EVENING).then(() => { m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        toCorners(game, 'player', 'shpitz');
        const h = game.npc('hadar'), q = ring(game).at(-3.9, 2.3);
        h.place(q.x, q.z, Math.PI * 0.75);
        h.idle = 'cheer';
        game.fighter.revive();
      },
    },
    { // 3: two rounds against Shpitz, the corner in between
      objective: 'סיבוב 1 מתוך 2: להפיל את שפיץ', checkpoint: true,
      enter(m, game) {
        m.s = { round: 1, hp: { me: 100, him: 90 } };
        startRound(m, game);
      },
      update(m, game, dt) {
        const s = m.s;
        if (s.phase === 'round') {
          if (s.lost) return `fail:${LOSE}`;
          if (s.won) { s.wonAt ??= m.t; if (!s.bellRung) { s.bellRung = true; game.sound?.bell(3); game.sound?.cheer(1); } board(m, game); if (m.t - s.wonAt > 1.4) { s.result = 'ko'; return 'next'; } return null; }
          s.clock -= dt;
          board(m, game);
          say(m, game, `סיבוב ${s.round} מתוך 2 · להפיל את שפיץ, או לסיים עם יותר כוח ממנו`);
          if (s.clock > 0) return null;
          // the bell
          const him = m.fight.opponents[0].fighter;
          s.hp = { me: game.fighter.hp, him: him.hp };
          endFight(m);
          game.sound?.bell(2);
          if (s.round === 2) { // the distance: who has more left
            if (s.hp.me / game.fighter.maxHp >= s.hp.him / 90) { s.result = 'points'; return 'next'; }
            return `fail:${POINTS_LOST}`;
          }
          // the corner: a stool, water, and what Hadar has to say
          s.phase = 'corner';
          const R = ring(game), st = R.stools.red, h = game.npc('hadar');
          game.cutscene = true;
          const hp = { x: st.x - 0.1, z: st.z - 0.9 }; // Hadar in front of the stool, outside the ropes
          game.player.place(st.x, st.z, Math.atan2(hp.x - st.x, hp.z - st.z));
          game.nehorai.setPose('sit');
          h.place(hp.x, hp.z, Math.atan2(st.x - hp.x, st.z - hp.z));
          h.idle = null;
          h.model.setPose(null);
          const sh = game.npc('shpitz'), b = R.at(1.9, -1.9);
          sh.place(b.x, b.z, Math.PI * 0.75 + Math.PI);
          sh.model.setPose(null);
          twoShot(game, st, hp, R.at(0, 4.7));
          say(m, game, 'בפינה: מה הדר אומר לסיבוב השני?');
          // (a conversation that is cut short still resolves: only the corner that is still on goes on)
          const still = () => game.missions.active === m && m.s === s && s.phase === 'corner';
          game.dialogue.play([['הדר', 'שב, תשתה. שפיץ מהיר, אבל אתה חכם יותר. מה אתה צריך לסיבוב השני?']]).then(() => {
            if (!still()) return;
            game.hud.choose('בפינה · מה אתה צריך לסיבוב השני?', TIPS).then((id) => {
              if (!still()) return;
              s.tip = id;
              game.dialogue.play([['הדר', TIPS.find((t) => t.id === id).line]]).then(() => { s.cornerDone = true; });
            });
          });
          return null;
        }
        if (s.phase === 'corner') {
          board(m, game);
          if (!s.cornerDone) return null;
          // round two: back in, a little better for the minute in the corner
          game.cutscene = false;
          game.follow.override = null;
          game.nehorai.setPose(null);
          s.hp.me = Math.min(game.fighter.maxHp, s.hp.me + 30);
          s.hp.him = Math.min(90, s.hp.him + 13);
          toCorners(game, 'player', 'shpitz');
          const h = game.npc('hadar'), q = ring(game).at(-3.9, 2.3);
          h.place(q.x, q.z, Math.PI * 0.75);
          h.idle = 'cheer';
          s.round = 2;
          s.won = s.lost = false;
          startRound(m, game);
          say(m, game, 'סיבוב 2 מתוך 2 · להפיל את שפיץ, או לסיים עם יותר כוח ממנו');
        }
        return null;
      },
      exit: endFight,
    },
    { // 4: Muller raises Nehorai's hand
      objective: 'נהוראי מנצח',
      enter(m, game) {
        const R = ring(game), C = R.center, sh = game.npc('shpitz'), mu = game.npc('muller'), h = game.npc('hadar');
        game.cutscene = true;
        game.hud.setBout(null);
        if (sh.model.pose === 'down') { sh.model.setPose(null); sh.model.play('getup'); }
        game.nehorai.setPose('cheer');
        const p = game.player.pos;
        mu.place(p.x + 0.8, p.z + 0.4, Math.atan2(p.x - mu.pos.x, p.z - mu.pos.z));
        mu.idle = null;
        h.idle = 'cheer';
        for (const id of FRIENDS) game.npc(id).idle = 'cheer';
        game.follow.shot({ x: C.x - 1.5, y: C.y + 2.6, z: C.z + 6.5 }, { x: p.x, y: C.y + 1.3, z: p.z }, 60);
        game.dialogue.play([...(m.s.result === 'ko' ? KO : POINTS), ...AFTER]).then(() => { m.s.told = true; });
      },
      update(m, game) {
        if (m.t > 2.4 && !m.s.down) { m.s.down = true; game.nehorai.setPose(null); }
        return m.s.told ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.nehorai.setPose(null);
      },
    },
  ],
};
