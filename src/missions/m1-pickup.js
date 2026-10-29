// Mission 1, "picking up Avraham": a lesson in walking, driving and the context button. From Nehorai's
// house to the white Renault, to Avraham's (fictional) house on Rimon street, a call from the car,
// Avraham rides along chatting, and both drive to the gym by the gate to meet Yonati, Erez and Muller.
// No fighting here. The friends' lines are written for the game and do not describe the real people.
import { near } from './missions.js';

const CALL = [
  ['נהוראי', 'אברהם, אני למטה.'],
  ['אברהם', 'שתי דקות, אחי. אני כבר בנעליים.'],
  ['נהוראי', 'אמרת את זה גם לפני עשר דקות.'],
  ['אברהם', 'זה היה בנעל אחת. יורד!'],
];
const RIDE = [
  ['אברהם', 'תגיד, למה תמיד אתה נוהג?'],
  ['נהוראי', 'כי זה הרכב שלי.'],
  ['אברהם', 'זה לא תירוץ, זאת עובדה. אני מכבד עובדות.'],
  ['אברהם', 'יונתי שלח תמונה מהמכון. מול המראה.'],
  ['נהוראי', 'כמה תמונות?'],
  ['אברהם', 'שבע. בשש מהן הוא מכווץ את אותו שריר.'],
  ['נהוראי', 'ומולר?'],
  ['אברהם', 'מולר כתב "פה". זאת כל ההודעה.'],
  ['נהוראי', 'זה מולר.'],
  ['אברהם', 'שים לב, ארז יגיד שאיחרנו.'],
  ['נהוראי', 'אנחנו לא מאחרים.'],
  ['אברהם', 'אנחנו בזמן של ארז פחות עשר דקות. אצלו זה איחור.'],
];
const PARKED = [
  ['אברהם', 'הנה, 150 לדלק. שלא תגיד שאני לא תורם.'],
  ['נהוראי', 'אתה לא תורם.'],
  ['אברהם', 'עכשיו אני תורם.'],
];
const GYM = [
  ['ארז', 'שבע דקות איחור. זה שלושה סטים של שכיבות סמיכה לכל אחד.'],
  ['אברהם', 'אמרתי לך.'],
  ['יונתי', 'הנה הם! הנהג הכי איטי בצפון והנוסע הכי מדבר!'],
  ['מולר', 'סוף סוף. אפשר להדליק מוזיקה... אה. רגע.'],
  ['נהוראי', 'מה רגע?'],
  ['מולר', 'הרמקול של המכון. הוא לא פה מאתמול.'],
  ['ארז', 'על זה נדבר אחרי האימון. קודם שק אגרוף. בלי לבכות.'],
  ['יונתי', 'אני כבר בוכה, תתחילו בלעדיי.'],
];

// the gym crowd at their usual spots, doing their usual thing; with `walk`, whoever is already in
// the hall walks back to their spot instead of appearing there
export function gymCrowd(game, { walk = false } = {}) {
  const S = game.world.places.gymSpots;
  for (const [id, idle] of [['erez', 'bag'], ['yonati', 'mirror'], ['muller', 'arms']]) {
    const n = game.npc(id), p = S[id];
    if (n.inCar) continue;
    if (walk && n.visible && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 20) {
      n.idle = null;
      n.walkTo(p.x, p.z, { onArrive: () => { n.yaw = p.yaw; n.idle = idle; } });
    } else {
      n.place(p.x, p.z, p.yaw);
      n.idle = idle;
    }
    n.face = null;
    n.show(true);
  }
}

function resetStart(game) {
  const P = game.world.places, av = game.npc('avraham');
  game.exitCar();
  game.car.repair();
  game.car.place(P.carSpot.x, P.carSpot.z, P.carSpot.yaw);
  game.start(P.start.x, P.start.z, P.start.yaw);
  if (av.inCar) av.stepOut();
  av.place(P.avrahamDoor.x, P.avrahamDoor.z, P.avraham.yaw + Math.PI);
  av.show(false);
  av.idle = null;
  gymCrowd(game);
}

export default {
  id: 'pickup', number: 1, title: 'אוספים את אברהם',
  reward: { money: 150, unlocks: ['gym', 'friends'], text: 'חדר הכושר נפתח · אברהם, יונתי, ארז ומולר נוספו לטלפון · 150 ₪ לדלק' },

  setup(m, game) {
    const av = game.npc('avraham'), P = game.world.places;
    if (!av.inCar) { av.place(P.avrahamDoor.x, P.avrahamDoor.z, P.avraham.yaw + Math.PI); av.show(false); }
    gymCrowd(game);
  },
  prepareReplay: resetStart,

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי בדרך. צריך להגיע עם הרכב שלם.';
    return null;
  },

  restore(m, game, checkpoint) {
    if (checkpoint === 0) { resetStart(game); return; }
    // after the pickup: back at Avraham's gate, both in the car, the car fixed
    const P = game.world.places, av = game.npc('avraham'), pick = P.avrahamPickup;
    game.exitCar();
    game.car.repair();
    game.car.place(pick.x, pick.z, pick.yaw);
    if (!av.inCar) av.enter(game.car);
    game.enterCar();
    gymCrowd(game);
    m.s.ride = false;
  },

  cleanup(m, game) {
    const av = game.npc('avraham');
    game.cutscene = false;
    if (av.inCar && game.mode !== 'car') av.stepOut();
  },

  steps: [
    { // 0
      objective: 'להגיע לרנו הלבנה שבחניה', checkpoint: true,
      target: (m, game) => ({ ...game.car.pos, r: 2.4 }),
      update: (m, game) => (game.mode === 'car' || near(game.player.pos, game.car.pos, 4) ? 'next' : null),
    },
    { // 1
      objective: 'להיכנס לרכב',
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      update: (m, game) => (game.mode === 'car' ? 'next' : null),
    },
    { // 2
      objective: 'לנסוע לבית של אברהם ברחוב הרימון',
      target: (m, game) => (game.mode === 'car' ? { ...game.world.places.avrahamPickup, r: 3.4 } : { ...game.car.pos, r: 2.4 }),
      update: (m, game) => (game.mode === 'car' && near(game.car.pos, game.world.places.avrahamPickup, 8) ? 'next' : null),
    },
    { // 3
      objective: 'לעצור בסימון וללחוץ על "התקשר לאברהם"',
      target: (m, game) => ({ ...game.world.places.avrahamPickup, r: 3.4 }),
      interaction(m, game) {
        if (m.s.calling || game.mode !== 'car' || Math.abs(game.car.speed) > 1.5 || !near(game.car.pos, game.world.places.avrahamPickup, 8)) return null;
        return { label: 'התקשר לאברהם', priority: 5, run: () => { m.s.calling = true; game.dialogue.play(CALL).then(() => { m.s.called = true; }); } };
      },
      update: (m) => (m.s.called ? 'next' : null),
    },
    { // 4
      objective: 'לחכות שאברהם ייכנס לרכב',
      enter(m, game) {
        const av = game.npc('avraham'), d = game.world.places.avrahamDoor;
        av.place(d.x, d.z, game.world.places.avraham.yaw + Math.PI);
        av.show(true);
      },
      update(m, game) {
        const av = game.npc('avraham'), car = game.car, door = car.local(-1.45, 0.25);
        if (!av.inCar) av.walkTo(door.x, door.z, { near: 0.8 });
        if (!av.inCar && (near(av.pos, door, 0.9) || m.t > 30)) {
          av.enter(car);
          game.dialogue.play([['אברהם', 'יאללה, למכון. ארז כבר שלח שלוש הודעות.']]);
          return 'next';
        }
        return null;
      },
    },
    { // 5
      objective: 'לנסוע לחדר הכושר, ליד השער', checkpoint: true,
      target: (m, game) => (game.mode === 'car' ? { ...game.world.places.gymParking, r: 3.6 } : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        if (!m.s.ride && m.t > 4 && !game.dialogue.busy) { m.s.ride = true; game.dialogue.play(RIDE); }
        return game.mode === 'car' && near(game.car.pos, game.world.places.gymParking, 6) && Math.abs(game.car.speed) < 1 ? 'next' : null;
      },
    },
    { // 6
      objective: 'לצאת מהרכב',
      update(m, game) {
        if (game.mode !== 'foot') return null;
        const av = game.npc('avraham'), S = game.world.places.gymSpots;
        if (av.inCar) av.stepOut(-1);
        av.walkTo(S.avraham.x, S.avraham.z, { onArrive: () => av.lookAt(game.player.pos.x, game.player.pos.z) });
        game.dialogue.play(PARKED);
        return 'next';
      },
    },
    { // 7
      objective: 'להיכנס לחדר הכושר',
      target: (m, game) => ({ ...game.world.places.gymInside, r: 3 }),
      update: (m, game) => (game.mode === 'foot' && near(game.player.pos, game.world.places.gymInside, 3.8) ? 'next' : null),
    },
    { // 8
      objective: 'להכיר את החבר׳ה',
      enter(m, game) {
        const g = game.world.places.gym;
        game.cutscene = true;
        // Nehorai just inside the door, the four of them coming over to stand around him
        const me = g.toWorld(0, 1.4);
        game.player.place(me.x, me.z, g.yaw + Math.PI);
        const spots = { erez: [-1.5, -0.5], yonati: [1.4, -0.7], muller: [2.5, 0.8], avraham: [-2.3, 1.3] };
        for (const [id, [lx, lz]] of Object.entries(spots)) {
          const n = game.npc(id), q = g.toWorld(lx, lz);
          n.idle = null;
          n.model.setPose(null);
          n.walkTo(q.x, q.z, { onArrive: () => n.lookAt(me.x, me.z) });
        }
        // over Nehorai's shoulder toward the group
        const from = g.toWorld(2.6, 4.4), look = g.toWorld(-0.4, -0.3);
        game.follow.shot({ x: from.x, y: g.floorY + 2.4, z: from.z }, { x: look.x, y: g.floorY + 1.25, z: look.z }, 60);
        game.dialogue.play(GYM).then(() => { m.s.met = true; });
      },
      update: (m) => (m.s.met ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.npc('erez').idle = 'bag';
      },
    },
  ],
};
