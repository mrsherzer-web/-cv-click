// Mission 3, "going down to Hadera": Nehorai and Avraham take the Renault down the hill and along the
// road past Gan Shmuel, Erez calls on the way, a stop at the gas station for his snack, and into the
// city to park near the boulevard kiosk where the crew in the photo hangs out. No fighting yet.
// The lines are written for the game and do not describe the real people.
import { near } from './missions.js';

const RIDE = [
  ['אברהם', 'אז מה התוכנית? נכנסים, אומרים שלום, לוקחים רמקול?'],
  ['נהוראי', 'נכנסים, מדברים, לוקחים רמקול.'],
  ['אברהם', 'אני אדבר. יש לי פנים של אחד שמחזירים לו דברים.'],
  ['נהוראי', 'יש לך פנים של אחד שמאחר.'],
  ['אברהם', 'זה אותו פרצוף, רק בשעות אחרות.'],
];
const CALL = [
  ['ארז', 'איפה אתם?', 'phone'],
  ['נהוראי', 'יורדים לחדרה. ליד גן שמואל.'],
  ['ארז', 'מולר אומר שהם יושבים כל ערב ליד הקיוסק בשדרה.', 'phone'],
  ['ארז', 'אל תתחילו עם אף אחד. ותעצרו בתחנת דלק, תביאו לי במבה.', 'phone'],
  ['אברהם', 'אתה מתאמן חמש שעות ביום ואוכל במבה?'],
  ['ארז', 'במבה זה חלבון. בערך. ביי.', 'phone'],
];
const SHOP = [
  ['אברהם', 'רגע, אני קופץ. במבה לארז, ומשהו לי, כי אני לא חיה.'],
];
const BACK = [
  ['אברהם', 'הבאתי שתי במבות. אחת לארז ואחת לדרך.'],
  ['נהוראי', 'ואיפה השנייה?'],
  ['אברהם', 'זה היה הדרך.'],
];
const CITY = [
  ['אברהם', 'חדרה. תמשיך ישר בשדרה, הקיוסק ליד הצומת השלישי.'],
];
const PARKED = [
  ['אברהם', 'הנה הם. ליד הקיוסק. ותקשיב... זה הרמקול שלנו על השולחן.'],
  ['נהוראי', 'עם המדבקה של ארז.'],
  ['אברהם', 'הם אפילו לא הורידו את המדבקה. זה כבר עלבון.'],
  ['נהוראי', 'יאללה. הולכים לדבר.'],
];

// Avraham gets in on the passenger side, walking if he is close, or he is simply already there
function boardAvraham(game) {
  const av = game.npc('avraham'), car = game.car;
  if (av.inCar) return;
  if (!av.visible || Math.hypot(av.pos.x - car.pos.x, av.pos.z - car.pos.z) > 40) { av.enter(car); return; }
  av.idle = null;
  const door = car.local(-1.45, 0.25);
  av.walkTo(door.x, door.z, { near: 0.9, onArrive: () => av.enter(car) });
}

export default {
  id: 'hadera', number: 3, title: 'יורדים לחדרה',
  requires: ['gym'],
  reward: { unlocks: ['hadera-parking'], text: 'חדרה נפתחה · חנייה בטוחה בשדרות הים: אפשר לנסוע אליה מתפריט ההשהיה' },

  // the blue marker by the Renault's driver door, wherever it is parked
  startAt: (game) => (game.mode === 'car' ? null : { ...game.car.local(1.6, 0.3), y: game.car.pos.y }),

  setup(m, game) {
    boardAvraham(game);
  },

  prepareReplay(game) {
    const P = game.world.places, spot = P.gymParking, av = game.npc('avraham');
    game.exitCar();
    if (av.inCar) av.stepOut();
    game.car.repair();
    game.car.place(spot.x, spot.z, spot.yaw);
    game.start(spot.x + 3, spot.z, spot.yaw);
    const S = P.gymSpots.avraham;
    av.place(S.x, S.z, S.yaw);
    av.show(true);
  },

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי. בפעם הבאה, פחות קירות ויותר כביש.';
    return null;
  },

  restore(m, game, checkpoint) {
    const P = game.world.places, av = game.npc('avraham');
    game.hud.showCall(null);
    game.exitCar();
    game.car.repair();
    // back at the last checkpoint, both already in the car: by the gym, or on the road past the station
    if (checkpoint >= 4) { const at = P.westRoad.at(P.westRoad.length * 0.62); game.car.place(at.x + at.nx * 1.9, at.z + at.nz * 1.9, Math.atan2(at.tx, at.tz)); }
    else game.car.place(P.gymParking.x, P.gymParking.z, P.gymParking.yaw);
    if (!av.inCar) av.enter(game.car);
    game.enterCar();
    m.s = {};
  },

  cleanup(m, game) {
    game.hud.showCall(null);
  },

  steps: [
    { // 0
      objective: 'להיכנס לרנו, אברהם בא איתך',
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        const av = game.npc('avraham');
        if (!av.inCar && m.t > 25) av.enter(game.car); // he took the long way round: he is in
        return game.mode === 'car' && av.inCar ? 'next' : null;
      },
    },
    { // 1
      objective: 'לנסוע במורד הגבעה, לכיוון גן שמואל', checkpoint: true,
      target: (m, game) => { const a = game.world.places.accessRoad, p = a.at(a.length); return { x: p.x, z: p.z, r: 6 }; },
      enter(m, game) { m.s.ride = false; },
      update(m, game) {
        if (!m.s.ride && m.t > 3 && !game.dialogue.busy) { m.s.ride = true; game.dialogue.play(RIDE); }
        const a = game.world.places.accessRoad, p = a.at(a.length);
        return game.mode === 'car' && near(game.car.pos, p, 26) ? 'next' : null;
      },
    },
    { // 2: Erez calls
      objective: 'ארז מתקשר. לענות',
      enter(m, game) {
        game.dialogue.stop();
        game.hud.showCall('ארז', () => { m.s.answered = true; game.dialogue.play(CALL).then(() => { m.s.talked = true; }); });
      },
      target: (m, game) => ({ ...game.world.places.stationStop, r: 5 }),
      update: (m) => (m.s.talked ? 'next' : null),
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 3: the gas station
      objective: 'לעצור בתחנת הדלק של גן שמואל',
      target: (m, game) => ({ ...game.world.places.stationStop, r: 5 }),
      update(m, game) {
        const P = game.world.places, av = game.npc('avraham'), car = game.car;
        if (!m.s.stopped) {
          if (game.mode === 'car' && near(car.pos, P.stationStop, 7) && Math.abs(car.speed) < 0.8) {
            m.s.stopped = m.t;
            game.dialogue.play(SHOP);
            av.stepOut(-1);
            av.walkTo(P.stationShop.x, P.stationShop.z, { onArrive: () => { av.show(false); m.s.inShop = m.t; } });
          }
          return null;
        }
        if (m.s.inShop === undefined && m.t - m.s.stopped > 20) { av.show(false); m.s.inShop = m.t; } // the long way round: he is in the shop
        if (m.s.inShop !== undefined && !m.s.out && m.t - m.s.inShop > 4) {
          m.s.out = true;
          av.place(P.stationShop.x, P.stationShop.z, P.stationShop.yaw);
          av.show(true);
          const door = car.local(-1.45, 0.25);
          av.walkTo(door.x, door.z, { near: 0.9, onArrive: () => { av.enter(car); m.s.back = true; } });
        }
        if (m.s.out && !m.s.back && m.t - m.s.inShop > 30) { av.enter(car); m.s.back = true; }
        if (m.s.back && !m.s.chat) { m.s.chat = true; game.dialogue.play(BACK); }
        return m.s.back && game.mode === 'car' ? 'next' : null;
      },
    },
    { // 4: into Hadera
      objective: 'להמשיך לחדרה', checkpoint: true,
      target: (m, game) => ({ ...game.world.places.haderaEntry, r: 6 }),
      update(m, game) {
        if (game.mode === 'car' && near(game.car.pos, game.world.places.haderaEntry, 14)) {
          game.hud.banner('אזור חדש', 'חדרה', 'שדרות הים, השוק, המוסכים והחוף', 3000);
          game.dialogue.play(CITY);
          return 'next';
        }
        return null;
      },
    },
    { // 5: park near the kiosk
      objective: 'לחנות בחנייה ליד הקיוסק בשדרות הים',
      target: (m, game) => ({ ...game.world.places.safeParking }),
      update: (m, game) => (game.mode === 'car' && near(game.car.pos, game.world.places.safeParking, 3.6) && Math.abs(game.car.speed) < 0.6 ? 'next' : null),
    },
    { // 6: what they see from the car
      objective: 'לצאת מהרכב',
      enter(m, game) { game.dialogue.play(PARKED).then(() => { m.s.seen = true; }); },
      update(m, game) {
        if (game.mode !== 'foot') return null;
        const av = game.npc('avraham');
        if (av.inCar) av.stepOut(-1);
        return m.s.seen ? 'next' : null;
      },
    },
  ],
};
