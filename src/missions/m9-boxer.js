// Chapter two, mission 2, "New York at the gym": Hadar rides along to the gym, everyone is happy to
// see him, he shows Nehorai a punch he brought back (the uppercut, the fourth in the combination), and
// they spar a round in the ring, by agreement. Then the crew tells him the speaker story and he wants a
// word at the kiosk. The lines are written for the game and do not describe the real people.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { gymCrowd } from './m1-pickup.js';

const UPPERS = 3;
const ARRIVE = [
  ['ארז', 'מי זה? זה... הדר?! מה אתה עושה פה, אמריקאי?'],
  ['הדר', 'מה אני עושה? חזרתי הביתה, אחי. איפה הבמבה?'],
  ['יונתי', 'הדר! תגיד שאני נראה גדול יותר. הרבה יותר.'],
  ['הדר', 'אתה נראה... יונתי. כמו תמיד.'],
  ['מולר', 'אהלן.'],
  ['הדר', 'מולר! אמרת מילה שלמה. ניו יורק שינתה גם אותך?'],
];
const TEACH = [
  ['הדר', 'בברוקלין למדתי משהו. ג׳אב, קרוס, הוק, ואז מלמטה. אפרקאט.'],
  ['הדר', 'ארבע מכות ברצף על השק. הרביעית עולה מלמטה. שלוש פעמים, ואני מאמין לך.'],
  ['הדר', 'ובין סט לסט נושמים. בלי אוויר אין אפרקאט.'],
];
const SPAR = [
  ['הדר', 'יפה. עכשיו בזירה. ספרינג, בהסכמה. אני לא מוריד הילוך.'],
  ['ארז', 'שתי דקות. מי שנופל קונה שתייה לכולם.'],
];
const STORY = [
  ['הדר', 'אוקיי, אוקיי! למדת. מי לימד אותך לסגור ככה?'],
  ['ארז', 'אני. חינם. עד עכשיו.'],
  ['אברהם', 'אז ספרו לו. על הרמקול, על המגרש. ואני דיברתי. בסוף.'],
  ['הדר', 'שמעתי. ומה שלא שמעתי, ארז שלח לי בהקלטות.'],
  ['הדר', 'רק שמעתי עוד משהו. בקיוסק אומרים שהיה לכם מזל. שהבחור הגדול שלהם לא היה שם.'],
  ['אברהם', 'בולדוזר. הוא היה בחו״ל. גם הוא חזר.'],
  ['הדר', 'אז גם אני חזרתי. בואו ניסע לקיוסק. רק לדבר.'],
  ['נהוראי', 'כשאומרים "רק לדבר" בחבורה הזאת, זה אף פעם לא רק לדבר.'],
];
const LOSE = 'הדר לקח את הסיבוב. חוסמים כשהעיגול האדום נסגר, ומחזירים כשהוא צהוב. עוד אחד?';

const at = (game, lx, lz) => { const g = game.world.places.gym, p = g.toWorld(lx, lz); return { x: p.x, z: p.z, y: g.floorY }; };
const ringPoint = (game, dz) => { const R = game.world.places.gym.ring; return at(game, R.x, R.z + dz); };
const gymInside = (game) => game.world.places.gymInside;

function endFight(m) { m.fight?.dispose(); m.fight = null; }

// Hadar and Nehorai in their corners, both fresh
function toCorners(game) {
  const g = game.world.places.gym, h = game.npc('hadar'), you = ringPoint(game, 1.3), them = ringPoint(game, -1.3);
  game.hadarBuddy.held = true; // in the ring he is the other corner, not a follower
  if (h.inCar) h.stepOut(-1);
  h.place(them.x, them.z, g.yaw);
  h.idle = null;
  h.model.setPose(null);
  h.show(true);
  game.exitCar();
  game.player.place(you.x, you.z, g.yaw + Math.PI);
  game.follow.snapBehind(g.yaw + Math.PI);
  game.fighter.revive();
}

export default {
  id: 'boxer', chapter: 2, number: 2, title: 'ניו יורק במכון',
  requires: ['morning'],
  where: 'לגשת לרנו, הסימון הכחול. הדר בא איתך',
  reward: { money: 150, unlocks: ['uppercut'], text: 'נלמד אפרקאט: המכה הרביעית ברצף עולה מלמטה · 150 ₪ משתייה שארז הפסיד' },

  // like the trip down to Hadera: at the Renault, or by getting in
  startAt: (game) => (game.mode === 'car' ? null : { ...game.car.local(1.6, 0.3), y: game.car.pos.y }),
  startInCar: true,

  setup(m, game) {
    game.hadarBuddy.held = false;
    if (!game.hadarBuddy.active) game.hadarBuddy.join();
  },

  prepareReplay(game) {
    const P = game.world.places, spot = P.hadarCurb;
    game.exitCar();
    game.car.repair();
    game.car.place(spot.x, spot.z, spot.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, spot.yaw);
    game.hadarBuddy.join();
  },

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי. הדר אומר שבניו יורק נוהגים גרוע יותר, אבל עדיין.';
    return null;
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    game.follow.override = null;
    if (checkpoint === 4) toCorners(game);
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    game.follow.override = null;
    game.hadarBuddy.held = false;
    const h = game.npc('hadar');
    if (h.model.pose === 'down') h.model.setPose(null);
    game.populate({ walk: true });
  },

  steps: [
    { // 0: in the car, Hadar along
      objective: 'להיכנס לרנו, הדר בא איתך',
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        const h = game.npc('hadar');
        if (game.mode === 'car' && !h.inCar && m.t > 20) h.enter(game.car); // he took the long way round: he is in
        say(m, game, game.mode === 'car' ? 'לחכות שהדר ייכנס לרכב' : 'להיכנס לרנו, הדר בא איתך');
        return game.mode === 'car' && h.inCar ? 'next' : null;
      },
    },
    { // 1: to the gym
      objective: 'לנסוע לחדר הכושר, ליד השער', checkpoint: true,
      target: (m, game) => (game.mode === 'car' ? { ...game.world.places.gymParking, r: 3.6 } : { ...gymInside(game), r: 3 }),
      update(m, game) {
        if (!m.s.ride && m.t > 3 && !game.dialogue.busy && game.mode === 'car') {
          m.s.ride = true;
          game.dialogue.play([['הדר', 'נהוראי, הרנו עדיין חיה? בניו יורק היא הייתה עולה על מדרכה כבר.'], ['נהוראי', 'היא עולה על מדרכות גם פה. רק כשאני רוצה.']]);
        }
        say(m, game, game.mode === 'car' ? 'לנסוע לחדר הכושר, ליד השער' : 'להיכנס לחדר הכושר');
        return game.mode === 'foot' && near(game.player.pos, gymInside(game), 3.8) ? 'next' : null;
      },
    },
    { // 2: everyone says hello
      objective: 'החבר׳ה במכון',
      enter(m, game) {
        const g = game.world.places.gym, h = game.npc('hadar');
        game.cutscene = true;
        game.hadarBuddy.held = true; // in the gym he does his own thing until the mission is over
        gymCrowd(game);
        if (h.inCar) h.stepOut(-1);
        const hp = g.toWorld(1.2, 1.2);
        h.place(hp.x, hp.z, g.yaw + Math.PI);
        h.show(true);
        h.idle = null;
        h.model.play('wave');
        const me = g.toWorld(0, 1.6);
        game.player.place(me.x, me.z, g.yaw + Math.PI);
        const from = g.toWorld(2.4, 4.6), look = g.toWorld(0, -0.5);
        game.follow.shot({ x: from.x, y: g.floorY + 2.4, z: from.z }, { x: look.x, y: g.floorY + 1.2, z: look.z }, 60);
        game.dialogue.play(ARRIVE).then(() => { m.s.hello = true; });
      },
      update: (m) => (m.s.hello ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
    { // 3: the uppercut, on the bag
      objective: `ארבע מכות ברצף בשק: הרביעית אפרקאט (0/${UPPERS})`,
      enter(m, game) {
        const h = game.npc('hadar'), b = game.world.places.gymBags[1];
        if (!game.has('uppercut')) game.progress.unlocks.push('uppercut'); // shown now, kept with the reward
        m.s.ups0 = game.bagUppercuts;
        h.walkTo(b.x + 1.4, b.z + 0.6, { onArrive: () => { h.lookAt(b.x, b.z); h.model.setPose('arms_crossed'); } });
        game.dialogue.play(TEACH);
      },
      target: (m, game) => { const b = game.world.places.gymBags[1]; return { x: b.x, z: b.z, y: game.world.places.gym.floorY, r: 1.3 }; },
      update(m, game) {
        const ups = game.bagUppercuts - m.s.ups0;
        say(m, game, `ארבע מכות ברצף בשק: הרביעית אפרקאט (${Math.min(ups, UPPERS)}/${UPPERS})`);
        return ups >= UPPERS && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { game.npc('hadar').model.setPose(null); game.dialogue.play(SPAR); },
    },
    { // 4: a round with Hadar in the ring
      objective: 'ספרינג מול הדר: להפיל אותו לפני שהוא מפיל אותך', checkpoint: true,
      enter(m, game) {
        toCorners(game);
        m.s.won = m.s.lost = false;
        m.fight = new Fight(game, {
          opponents: [{ npc: game.npc('hadar'), hp: 80, power: 0.62, aggression: 1.0, windup: 0.66, moves: ['jab', 'cross', 'jab', 'swing', 'cross'], name: 'הדר' }],
          onWin: () => { m.s.won = true; },
          onLose: () => { m.s.lost = true; },
        });
      },
      update(m) {
        if (m.s.lost) return `fail:${LOSE}`;
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 5: the speaker story, and the kiosk
      objective: 'לשמוע מה הדר חושב',
      enter(m, game) {
        const g = game.world.places.gym, h = game.npc('hadar'), av = game.npc('avraham');
        game.cutscene = true;
        h.model.setPose(null);
        h.model.play('getup');
        const meet = ringPoint(game, 3.2), S = game.world.places.gymSpots;
        game.player.place(meet.x, meet.z, g.yaw + Math.PI);
        av.place(S.avraham.x, S.avraham.z, S.avraham.yaw);
        av.show(true);
        av.idle = null;
        const from = at(game, -2.4, 3.6), look = ringPoint(game, 1.4);
        game.follow.shot({ x: from.x, y: g.floorY + 2.4, z: from.z }, { x: look.x, y: g.floorY + 1.3, z: look.z }, 90);
        game.dialogue.play(STORY).then(() => { m.s.told = true; });
      },
      update: (m) => (m.s.told ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
  ],

  complete(m, game) {
    game.hadarBuddy.held = false;
    game.hadarBuddy.join({ near: game.npc('hadar').pos });
  },
};
