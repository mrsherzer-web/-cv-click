// Chapter two, mission 1, "the morning after": Nehorai wakes up in a room that looks like the party
// happened in it, calls Erez, hears that Hadar is back from New York, tidies up just enough to find the
// door, and walks over to Hadar's on Rimon street. The lines are written for the game and do not
// describe the real people.
import { near, say } from './missions.js';

const WAKE = [
  ['נהוראי', 'אוף. מה השעה?'],
  ['נהוראי', 'רגע. מה קרה פה? זה חדר או זירת אירוע של חטיפים?'],
  ['נהוראי', 'לפחות הרמקול בבית. על השולחן. עם המדבקה של ארז.'],
];
// the first two lines as the player asked for them, word for word
const CALL = [
  ['נהוראי', 'אחי, איזה כיף שטיפלנו בקטע של הרמקול, יא אללק!'],
  ['ארז', 'כן אחי, אני שמח רצח, אחי.', 'phone'],
  ['ארז', 'ועוד משהו. הדר חזר מניו יורק. נחת אתמול בלילה.', 'phone'],
  ['נהוראי', 'הדר בן עמי? מה אתה אומר!'],
  ['ארז', 'הוא אצלו, ברחוב הרימון. לך תגיד לו שלום לפני שהוא מוצא מכון בלעדינו.', 'phone'],
  ['ארז', 'ושתה מים. אתה נשמע כמו מישהו שלא שתה מים.', 'phone'],
];
const OUT = [['נהוראי', 'מספיק סידרתי. אמא תגיד שזה כלום, אבל זה התחלה.']];
const MEET = [
  ['הדר', 'נהוראייי! Bro! בוא לפה!'],
  ['נהוראי', 'הדר! חזרת! איך ניו יורק?'],
  ['הדר', 'גדולה, אחי. רועשת. מתאגרפים שם במרתפים עם מוזיקה בווליום של חתונה.'],
  ['הדר', 'אבל אין שם את הנוף הזה. ואין שם אותך.'],
  ['נהוראי', 'שמעת על הרמקול?'],
  ['הדר', 'שמעתי הכול. ארז שלח לי תשעה עשר הודעות קוליות. הקשבתי לשתיים.'],
  ['הדר', 'ניצחתם אותם בהתערבות? Respect. רק שמעתי שבקיוסק אומרים שהיה לכם מזל.'],
  ['נהוראי', 'מזל? בוא נראה להם מזל.'],
  ['הדר', 'קודם מכון. אני רוצה לראות מה למדת בלעדיי. אחר כך, נראה.'],
];

const room = (game) => game.world.places.room;

export default {
  id: 'morning', chapter: 2, number: 1, title: 'בוקר אחרי',
  requires: ['home'],
  where: 'להיכנס הביתה לישון, הסימון הכחול בדלת. מחר בבוקר מתחיל הפרק השני',
  reward: { money: 100, unlocks: ['hadar'], text: 'הדר בן עמי בחבורה, ובטלפון · 100 ₪ שאמא השאירה על השולחן' },

  // the blue marker at Nehorai's front door: going in to sleep is how the next morning starts
  startAt: (game) => (game.mode === 'car' ? null : { ...room(game).front, y: room(game).floorY }),

  setup(m, game) {
    game.companion.leave(); // Dolev went home after the party
  },

  prepareReplay(game) {
    const F = room(game).front;
    game.exitCar();
    game.car.place(game.world.places.carSpot.x, game.world.places.carSpot.z, game.world.places.carSpot.yaw);
    game.start(F.x, F.z, F.yaw);
  },

  restore(m, game) {
    game.dialogue.stop();
    game.cutscene = false;
    game.follow.override = null;
    game.nehorai.setPose(null);
  },

  cleanup(m, game) {
    game.cutscene = false;
    game.follow.override = null;
    game.nehorai.setPose(null);
    for (const h of room(game).heaps) h.obj.visible = true; // the room gets messy again for a replay
  },

  steps: [
    { // 0: to black, the next morning, sitting up in bed
      objective: 'בוקר. הפרק השני',
      enter(m, game) {
        game.exitCar();
        game.cutscene = true;
        game.hud.fade('למחרת בבוקר', () => {
          const R = room(game), B = R.bed;
          for (const h of R.heaps) h.obj.visible = true;
          game.player.place(B.x, B.z, B.yaw);
          game.nehorai.setPose('sit');
          // from the corner by the door, over the mess, to the bed
          const from = { x: R.door.x + (R.center.x - R.door.x) * 0.2, y: R.floorY + 1.85, z: R.door.z + (R.center.z - R.door.z) * 0.2 };
          game.follow.shot(from, { x: B.x, y: R.floorY + 0.75, z: B.z }, 30);
          m.s.inRoom = true;
        }, 1400);
      },
      update(m, game) {
        if (m.s.inRoom && !m.s.talking && !game.hud.fading) { m.s.talking = true; game.dialogue.play(WAKE).then(() => { m.s.awake = true; }); }
        return m.s.awake ? 'next' : null;
      },
      exit(m, game) {
        const R = room(game), B = R.bed;
        game.cutscene = false;
        game.follow.override = null;
        game.nehorai.setPose(null);
        game.player.place(B.x + (R.center.x - B.x) * 0.45, B.z + (R.center.z - B.z) * 0.45, B.yaw); // up, and off the bed
        game.follow.snapBehind(game.player.yaw);
      },
    },
    { // 1: Erez on the phone
      objective: 'להתקשר לארז מהטלפון (הכפתור למעלה משמאל)',
      call: 'erez',
      onCall(m, game) {
        if (m.s.calling) return;
        m.s.calling = true;
        game.nehorai.setPose('phone');
        game.dialogue.play(CALL).then(() => { m.s.called = true; game.nehorai.setPose(null); });
      },
      update: (m) => (m.s.called ? 'next' : null),
    },
    { // 2: just enough tidying to find the door
      objective: 'לסדר קצת לפני שיוצאים (0/3)',
      target(m, game) {
        const left = room(game).heaps.filter((h) => h.obj.visible), p = game.player.pos;
        if (!left.length) return null;
        const h = left.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
        return { x: h.x, z: h.z, y: h.y, r: 0.6 };
      },
      interaction(m, game) {
        if (game.mode !== 'foot') return null;
        // the nearest heap still on the floor, within reach
        const p = game.player.pos, d = (q) => Math.hypot(q.x - p.x, q.z - p.z);
        const h = room(game).heaps.filter((q) => q.obj.visible && d(q) < 1.2).sort((a, b) => d(a) - d(b))[0];
        if (!h) return null;
        return {
          label: h.label, priority: 5,
          run: () => {
            if (!h.obj.visible) return;
            h.obj.visible = false;
            game.dialogue.play([['נהוראי', h.line]]);
            game.sound?.hit('bag', 0.5);
          },
        };
      },
      update(m, game) {
        const done = room(game).heaps.filter((h) => !h.obj.visible).length;
        say(m, game, `לסדר קצת לפני שיוצאים (${done}/3)`);
        return done >= 3 && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 3: out through the door
      objective: 'לצאת מהחדר',
      enter(m, game) { game.dialogue.play(OUT); },
      target: (m, game) => ({ ...room(game).door, r: 0.7 }),
      interaction(m, game) {
        if (game.mode !== 'foot' || m.s.out || !near(game.player.pos, room(game).door, 1.4)) return null;
        return {
          label: 'לצאת מהבית', priority: 5,
          run: () => {
            m.s.out = true;
            game.hud.fade('', () => {
              const F = room(game).front;
              game.player.place(F.x, F.z, F.yaw);
              game.follow.snapBehind(F.yaw);
              m.s.outside = true;
            }, 500);
          },
        };
      },
      update: (m) => (m.s.outside ? 'next' : null),
    },
    { // 4: over to Hadar's
      objective: 'ללכת לבית של הדר ברחוב הרימון',
      enter(m, game) {
        const G = game.world.places.hadarGate, h = game.npc('hadar');
        h.place(G.x, G.z, G.yaw);
        h.idle = 'phone';
        h.model.setPose(null);
        h.show(true);
      },
      target: (m, game) => ({ ...game.world.places.hadarGate, r: 2 }),
      update(m, game) {
        const G = game.world.places.hadarGate;
        say(m, game, game.mode === 'car' && near(game.car.pos, G, 25) ? 'לצאת מהרכב ולגשת להדר' : 'ללכת לבית של הדר ברחוב הרימון');
        return game.mode === 'foot' && near(game.player.pos, G, 3.5) ? 'next' : null;
      },
    },
    { // 5: Hadar
      objective: 'הדר חזר',
      enter(m, game) {
        const h = game.npc('hadar'), p = game.player.pos;
        game.cutscene = true;
        h.idle = null;
        h.lookAt(p.x, p.z);
        h.model.play('wave');
        game.player.yaw = Math.atan2(h.pos.x - p.x, h.pos.z - p.z);
        const mid = { x: (h.pos.x + p.x) / 2, z: (h.pos.z + p.z) / 2 }, side = { x: Math.cos(game.player.yaw), z: -Math.sin(game.player.yaw) };
        game.follow.shot({ x: mid.x + side.x * 3.6, y: p.y + 1.9, z: mid.z + side.z * 3.6 }, { x: mid.x, y: p.y + 1.4, z: mid.z }, 60);
        game.hud.banner('דמות חדשה', 'הדר בן עמי', 'חזר מניו יורק · גר בקציר · מתאגרף', 3200);
        game.dialogue.play(MEET).then(() => { m.s.met = true; });
      },
      update: (m) => (m.s.met ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
  ],

  complete(m, game) {
    game.hadarBuddy.held = false;
    game.hadarBuddy.join({ near: game.npc('hadar').pos }); // he comes along from here
  },
};
