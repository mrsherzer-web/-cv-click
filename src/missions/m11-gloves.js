// Chapter two, mission 4, "after the gloves": Bulldozer, Shpitz and Kotzi drive off with Hadar's bag in
// their green hatchback, out of Hadera and up the road past Gan Shmuel. Nehorai and Hadar keep up in the
// Renault until they pull in at the gas station, where it gets talked out and a proper boxing night is
// set for next week. A chase between friends and an invented crew: no police, no crashes asked for.
// The lines are written for the game and do not describe the real people.
import { near, say } from './missions.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot, roadPath } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';

const RIDERS = ['bulldozer', 'shpitz', 'kotzi'];
const GO = [
  ['הדר', 'סע, סע, סע! הירוקה שם!'],
  ['נהוראי', 'אני רואה אותם. תחגור.'],
];
const ON_ROAD = [
  ['הדר', 'הם יוצאים מהעיר. לכיוון גן שמואל.'],
  ['נהוראי', 'הם נוסעים לתחנת הדלק. בולדוזר לא עובר עשרה קילומטר בלי לאכול.'],
];
// Hadar in the passenger seat, every few seconds of the chase
const SHOUTS = [
  ['הדר', 'יאללה, יאללה! הם לא יודעים לנהוג, הם רק יודעים לברוח!'],
  ['הדר', 'שמאלה! לא, ימינה! לא משנה, אחריהם!'],
  ['הדר', 'בניו יורק היינו כבר תקועים בפקק. פה יש לנו כביש פתוח. תנצל!'],
  ['הדר', 'שפיץ מסתכל אחורה. הוא מפחד. מצוין.'],
];
const BEHIND = [['הדר', 'הם מתרחקים! תלחץ על הגז, אחי!']];
const END = [
  ['בולדוזר', 'אוקיי, אוקיי! הנה התיק. לא נגענו בכפפות.'],
  ['קוצי', 'סליחה, הדר. בולדוזר לא ישן שלושה ימים מהג׳ט לג.'],
  ['הדר', 'גם אני לא, אחי. ובכל זאת לא לקחתי לאף אחד תיק.'],
  ['בולדוזר', 'אתה מתאגרף טוב, אמריקאי. רציני.'],
  ['הדר', 'אני מקציר. תגיד את זה שוב.'],
  ['בולדוזר', '...אתה מתאגרף טוב, מקציר.'],
  ['קוצי', 'בואו נעשה את זה כמו שצריך. ערב אגרוף במגרש, שישי הבא. כפפות, שופט, כל החבר׳ה.'],
  ['הדר', 'סגור. ונהוראי בפינה שלי.'],
  ['נהוראי', 'סגור. רק שמישהו יגיד לי מתי אני מסדר את החדר.'],
  ['הדר', 'Bro. זה כבר פרק שלוש.'],
];
const LOST = 'הם ברחו עם הכפפות. נסו שוב, ולהישאר צמודים אליהם.';

// the way the green hatchback goes: east along the court's street, north on the eastmost street to the
// boulevard, out of the city, and up the road toward Gan Shmuel to the gas station
function route(game) {
  const W = game.world, P = W.places, road = (name) => W.net.roads.find((r) => r.name === name);
  const gate = P.court.gate, H = P.hadera, east = road('רחוב התאנה');
  const street = W.net.nearest(gate.x, gate.z + 12, 40, (r) => H && r.name !== east.name && Math.abs(r.at(0).z - r.at(r.length).z) < 1)?.road
    || road('רחוב המלאכה');
  const s0 = street.nearest(gate.x, gate.z).s, zStreet = street.at(0).z;
  const ns = (z) => east.nearest(east.at(0).x, z).s;
  const blvd = road('שדרות הים'), west = P.westRoad, stop = P.stationStop;
  const sStation = west.nearest(stop.x, stop.z).s;
  const pts = [
    ...roadPath(street, s0, 6, 1.8),
    ...roadPath(east, ns(zStreet), ns(H.ZS[H.BLVD]) , 1.8),
    ...roadPath(blvd, blvd.nearest(east.at(0).x, H.ZS[H.BLVD]).s, 2, 4.6),
    ...roadPath(west, west.length - 12, sStation + 14, 1.9),
    { x: stop.x + (P.stationEntry.x - stop.x) * 0.2, z: stop.z + (P.stationEntry.z - stop.z) * 0.2 },
    { x: stop.x, z: stop.z },
  ];
  return pts;
}

export default {
  id: 'gloves', chapter: 2, number: 4, title: 'מרדף אחרי הכפפות',
  requires: ['kiosk'],
  follows: true, // straight on from the court; after a reload or a retreat, from the court's gate
  where: 'לסימון הכחול בשער של המגרש מאחורי המוסכים, בחדרה',
  startAt: (game) => (game.mode === 'car' ? null : { ...game.world.places.court.gate, y: game.world.places.court.y }),
  reward: { money: 300, unlocks: ['hadar-crew', 'chapter-2'], text: 'סוף הפרק השני · הכפפות חזרו להדר · בשישי הבא ערב אגרוף במגרש' },

  setup(m, game) {
    const P = game.world.places, c = P.court;
    // the Renault was left by the kiosk: it is brought round to the court's street
    if (Math.hypot(game.car.pos.x - c.gate.x, game.car.pos.z - c.gate.z) > 70) {
      const s = game.world.roadSpot(c.gate.x + 8, c.gate.z + 12);
      if (s) game.car.place(s.x, s.z, s.yaw);
    }
    game.hadarBuddy.held = false;
    if (!game.hadarBuddy.active) game.hadarBuddy.join();
    m.s.pts = route(game);
    const a = m.s.pts[0], b = m.s.pts[3];
    m.van = new Vehicle(game.world, makeHatchback({ color: '#2f5d3a' }), { maxSpeed: 21, accel: 6.8, name: 'porcupines' });
    game.scene.add(m.van.model);
    m.van.place(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), game.world.groundHeight(a.x, a.z) + 0.05);
    for (const id of RIDERS) { const n = game.npc(id); n.model.setPose(null); n.enter(m.van); }
    game.chaseCars = [m.van];
  },

  prepareReplay(game) {
    const c = game.world.places.court;
    game.exitCar();
    const s = game.world.roadSpot(c.gate.x + 8, c.gate.z + 12);
    if (s) game.car.place(s.x, s.z, s.yaw);
    game.start(c.gate.x, c.gate.z + 2, 0);
    game.hadarBuddy.join();
  },

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי. במרדף, נוסעים אחריהם, לא לתוכם.';
    return null;
  },

  restore(m, game) {
    m.van.place(m.s.pts[0].x, m.s.pts[0].z, Math.atan2(m.s.pts[3].x - m.s.pts[0].x, m.s.pts[3].z - m.s.pts[0].z), game.world.groundHeight(m.s.pts[0].x, m.s.pts[0].z) + 0.05);
    m.van.repair();
    m.ap = null;
    game.exitCar();
    game.car.repair();
    const c = game.world.places.court, s = game.world.roadSpot(c.gate.x + 8, c.gate.z + 12);
    if (s) game.car.place(s.x, s.z, s.yaw);
    const q = game.car.local(1.8, 0.3);
    game.player.place(q.x, q.z, game.car.yaw);
    game.follow.snapBehind(game.car.yaw);
    game.hadarBuddy.join();
    m.s = { pts: m.s.pts };
  },

  cleanup(m, game) {
    if (m.van) {
      for (const id of RIDERS) { const n = game.npc(id); if (n.inCar === m.van) n.stepOut(-1); n.show(false); }
      game.scene.remove(m.van.model);
      game.world.cols.dynamic.delete(m.van.box);
      m.van = null;
    }
    game.chaseCars = [];
    game.cutscene = false;
    game.follow.override = null;
    game.hadarBuddy.held = false;
  },

  // every frame of the mission: the green hatchback drives (or waits), and brakes for traffic ahead
  tick(m, game, dt) {
    const v = m.van;
    if (!v) return;
    if (!m.ap) { v.update(dt, { throttle: 0, brake: 1, steer: 0 }); return; }
    const input = m.ap.drive(v), f = { x: Math.sin(v.yaw), z: Math.cos(v.yaw) };
    for (const c of game.traffic?.cars || []) {
      const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z, ahead = dx * f.x + dz * f.z, side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 2 && ahead < 9 + v.speed * 0.8 && side < 2.2) { input.throttle = 0; input.brake = Math.max(input.brake || 0, 0.8); }
    }
    v.update(dt, input);
  },

  steps: [
    { // 0: to the Renault
      objective: 'לרנו! הם בורחים עם התיק של הדר',
      enter(m, game) { game.dialogue.play(GO); },
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        const h = game.npc('hadar');
        if (game.mode === 'car' && !h.inCar && m.t > 12) h.enter(game.car);
        say(m, game, game.mode === 'car' ? 'הדר נכנס...' : 'לרנו! הם בורחים עם התיק של הדר');
        return game.mode === 'car' && h.inCar ? 'next' : null;
      },
    },
    { // 1: keep up
      objective: 'לא לאבד את הירוקה', checkpoint: true,
      enter(m, game) { m.ap = new Autopilot(m.s.pts, { cruise: 17 }); m.s.far = 0; },
      target: (m) => (m.van ? { x: m.van.pos.x, z: m.van.pos.z, y: m.van.pos.y, r: 2.2 } : null),
      update(m, game, dt) {
        const v = m.van, d = Math.hypot(v.pos.x - game.car.pos.x, v.pos.z - game.car.pos.z);
        m.s.far = d > 160 ? m.s.far + dt : 0;
        if (m.s.far > 8) return `fail:${LOST}`;
        if (!m.s.road && v.pos.x > game.world.places.hadera.CITY.x1 + 20) { m.s.road = true; game.dialogue.play(ON_ROAD); }
        // Hadar keeps up the commentary, more urgent when they pull away
        m.s.talk = (m.s.talk ?? 6) - dt;
        if (m.s.talk <= 0 && !game.dialogue.busy) {
          m.s.talk = 11;
          game.dialogue.play(d > 110 ? BEHIND : [SHOUTS[(m.s.shout = ((m.s.shout ?? -1) + 1) % SHOUTS.length)]]);
        }
        say(m, game, game.mode !== 'car' ? 'לחזור לרנו! הם מתרחקים' : `לא לאבד את הירוקה · ${Math.round(d)} מ׳${d > 110 ? ' · הם מתרחקים!' : ''}`);
        return m.ap.done ? 'next' : null;
      },
    },
    { // 2: they pulled in at the gas station
      objective: 'הם עצרו בתחנת הדלק. לעצור לידם',
      target: (m) => ({ x: m.van.pos.x, z: m.van.pos.z, y: m.van.pos.y, r: 3 }),
      update: (m, game) => (near(game.pos, m.van.pos, 14) && (game.mode === 'foot' || Math.abs(game.car.speed) < 1) ? 'next' : null),
    },
    { // 3: talked out
      objective: 'הכפפות חוזרות',
      enter(m, game) {
        const v = m.van, h = game.npc('hadar');
        game.cutscene = true;
        game.hadarBuddy.held = true;
        game.exitCar();
        if (h.inCar) h.stepOut(1);
        RIDERS.forEach((id, i) => { const n = game.npc(id); if (n.inCar) n.stepOut(i % 2 ? 1 : -1); n.lookAt(game.player.pos.x, game.player.pos.z); });
        const b = game.npc('bulldozer');
        b.model.setPose('carry');
        const mid = { x: (v.pos.x + game.car.pos.x) / 2, z: (v.pos.z + game.car.pos.z) / 2 };
        game.follow.shot({ x: mid.x + 6, y: v.pos.y + 3, z: mid.z + 6 }, { x: mid.x, y: v.pos.y + 1.2, z: mid.z }, 80);
        game.dialogue.play(END).then(() => { m.s.done = true; });
      },
      update(m, game) {
        if (m.t > 2 && !m.s.handed) { m.s.handed = true; game.npc('bulldozer').model.setPose(null); game.npc('hadar').model.setPose('carry'); }
        return m.s.done ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.npc('hadar').model.setPose(null);
      },
    },
  ],
};
