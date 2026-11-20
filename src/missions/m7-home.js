// Mission 7, "coming home": everyone is waiting at Nehorai's place. A drive against the clock from the
// beach through the city, past Gan Shmuel and up the hill, with the Sharks' cars after the Renault if
// they are still angry; then the Renault in its driveway and the friends together to close the chapter.
// The friends' lines are written for the game and do not describe the real people.
import { near, say } from './missions.js';
import { Chase } from '../vehicle/chaser.js';

const CALL = [
  ['אברהם', 'איפה אתם? כולם אצלך בבית. ארז הביא במבה. הרבה במבה.', 'phone'],
  ['נהוראי', 'כמה זה הרבה?'],
  ['אברהם', 'מספיק בשביל שיונתי יצלם את זה לסטורי. בואו מהר, לפני שמולר מסיים הכל.', 'phone'],
];
const CHASE = [['דולב', 'יש לנו חברים מאחורה. הכרישים עוד כועסים. תאבד אותם בדרך.']];
const END = [
  ['ארז', 'הגעתם. שבע דקות איחור. אבל הבאתם רמקול, אז אני סולח.'],
  ['יונתי', 'אני רוצה שתדעו שבסרטון של היום אני הגיבור. ערכתי.'],
  ['אברהם', 'אני דיברתי. אני רוצה שיירשם שבסוף, אני דיברתי.'],
  ['דולב', 'חבורה טובה. אני נשאר. יש פה במבה ויש פה רנו.'],
  ['מולר', 'פה.'],
  ['נהוראי', 'יאללה. מחר בבוקר מכון. ובערב... נראה.'],
];
const LIMIT = 190; // seconds for the drive home
const LATE = 'לא הספקתם להגיע בזמן, והחבר׳ה כבר גמרו את כל הבמבה. עוד ניסיון: קצת פחות ברקס.';

// the way home, as places to pass on the road
function checkpoints(game) {
  const P = game.world.places, w = P.westRoad, a = P.accessRoad, m = P.mainRoad;
  const on = (road, s) => { const p = road.at(s < 0 ? road.length + s : s); return { x: p.x, z: p.z, y: p.h, r: 10 }; };
  return [
    { ...P.haderaEntry, r: 12, name: 'יציאה מחדרה' },
    { ...on(w, 196), name: 'גן שמואל' },
    { ...on(a, -6), name: 'מרגלות הגבעה' },
    { ...on(m, 6), name: 'השער של קציר' },
  ];
}

export default {
  id: 'home', number: 7, title: 'חוזרים הביתה',
  requires: ['heist'],
  reward: { unlocks: ['free-roam'], text: 'סוף הפרק הראשון · שיטוט חופשי: כל משימה אפשר לשחק שוב מתפריט ההשהיה, והחברים בטלפון' },

  // it begins with Avraham calling, a few quiet seconds after mission 6, wherever Nehorai is
  incoming: true,
  where: 'אברהם יתקשר עוד רגע',

  setup(m, game) {
    if (!game.companion.active) game.companion.join();
  },

  prepareReplay(game) {
    const L = game.world.places.beachLot;
    game.exitCar();
    game.car.repair();
    game.car.place(L.parking.x, L.parking.z, L.parking.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, L.parking.yaw);
  },

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי. הביתה מגיעים עם רכב שלם.';
    return null;
  },

  restore(m, game) {
    m.chase?.dispose(); m.chase = null; game.chase = null;
    game.alert.chasing = false;
    game.dialogue.stop();
    const L = game.world.places.beachLot;
    game.exitCar();
    game.car.repair();
    game.car.place(L.parking.x, L.parking.z, L.parking.yaw);
    game.enterCar();
    game.companion.join();
    m.s = { angry: m.s.angry };
  },

  cleanup(m, game) {
    m.chase?.dispose(); m.chase = null; game.chase = null;
    game.cutscene = false;
    game.follow.override = null;
  },

  steps: [
    { // 0: Avraham calls
      objective: 'אברהם מתקשר. לענות',
      enter(m, game) {
        m.s.angry = game.alert.level >= 35; // the Sharks are still after them: a chase on the way
      },
      update(m, game) {
        // it rings once the mission's title has had its moment on screen
        if (!m.s.rang && m.t > 2.7) { m.s.rang = true; game.hud.showCall('אברהם', () => { game.dialogue.play(CALL).then(() => { m.s.talked = true; }); }); }
        return m.s.talked ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 1: the drive, against the clock
      objective: 'לנסוע הביתה לקציר לפני שהזמן נגמר', checkpoint: true,
      enter(m, game) { m.s.k = 0; m.s.clock = LIMIT; m.s.cps = checkpoints(game); },
      target: (m, game) => (game.mode === 'car' ? m.s.cps?.[m.s.k] || null : { ...game.car.pos, r: 2.4 }),
      update(m, game, dt) {
        if (game.mode !== 'car') { say(m, game, 'להיכנס לרנו ולנסוע הביתה'); return null; }
        m.s.clock -= dt;
        if (m.s.clock <= 0) return `fail:${LATE}`;
        if (m.s.angry && !m.chase && m.t > 6) { m.chase = new Chase(game, { cars: 2 }); game.chase = m.chase; game.dialogue.play(CHASE); }
        if (m.chase?.over) { m.chase.dispose(); m.chase = null; game.chase = null; }
        const cp = m.s.cps[m.s.k];
        if (near(game.car.pos, cp, cp.r)) {
          m.s.k++;
          game.hud.toast(`${cp.name} ✓`, 1600);
          if (m.s.k >= m.s.cps.length) return 'next';
        }
        const left = Math.ceil(m.s.clock);
        say(m, game, `הביתה לקציר · ${m.s.k + 1}/${m.s.cps.length}: ${m.s.cps[m.s.k].name} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
        return null;
      },
    },
    { // 2: into the driveway
      objective: 'לחנות את הרנו בחניה בבית',
      enter(m, game) { m.chase?.dispose(); m.chase = null; game.chase = null; game.alert.chasing = false; game.alert.level = 0; },
      target: (m, game) => ({ ...game.world.places.carSpot, r: 2.6 }),
      update: (m, game) => (game.mode === 'car' && near(game.car.pos, game.world.places.carSpot, 2.8) && Math.abs(game.car.speed) < 0.6 ? 'next' : null),
    },
    { // 3: everyone at the house
      objective: 'החבר׳ה מחכים',
      enter(m, game) {
        const P = game.world.places, h = P.home, f = { x: Math.sin(h.yaw), z: Math.cos(h.yaw) }, side = { x: f.z, z: -f.x };
        game.exitCar();
        game.cutscene = true;
        // in front of the house, between the door and the street
        const base = { x: h.house.x + f.x * 8.2, z: h.house.z + f.z * 8.2 };
        game.player.place(base.x + f.x * 1.6, base.z + f.z * 1.6, h.yaw + Math.PI);
        const spots = { erez: -2.4, yonati: -1.2, avraham: 0, muller: 1.2, dolev: 2.4 };
        for (const [id, k] of Object.entries(spots)) {
          const n = game.npc(id);
          if (n.inCar) n.stepOut(-1);
          n.place(base.x + side.x * k - f.x * 0.6 * Math.abs(k) * 0.4, base.z + side.z * k - f.z * 0.6 * Math.abs(k) * 0.4, h.yaw);
          n.idle = null;
          n.model.setPose(null);
          n.show(true);
          n.lookAt(game.player.pos.x, game.player.pos.z);
        }
        game.npc('yonati').model.play('wave');
        const from = { x: base.x + f.x * 7 + side.x * 2.5, y: h.y + 2.2, z: base.z + f.z * 7 + side.z * 2.5 };
        game.follow.shot(from, { x: base.x, y: h.y + 1.3, z: base.z }, 80);
        game.dialogue.play(END).then(() => { m.s.done = true; });
      },
      update: (m) => (m.s.done ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
  ],
};
