// Chapter seven, mission 2, "המחצבה". The abandoned quarry Kotzi's trucks used to run from: the team
// spreads out for clues — a shipping list in the office container, a tagged key in the dumper, the
// radios in the shed (and on one of them, Nehorai), the map on the office wall. Two of Kotzi's people
// come back for something they forgot and find the team instead. Ido reads the clues; the map says
// where to go next. Invented place, invented rival; paint.
import { near, say, nearestGuard } from './missions.js';
import { asErez, asNehorai, arriveTeam, armTeam, postGuards, hideGuards, left, radio, failOut, team } from './rescue.js';

const ARRIVE = [
  ['עידו', 'המחצבה. הוואן נסע לכאן, ומכאן — לא יודעים. מתפזרים: משרד, סככה, המשאית.'],
  ['ארז', 'מי שמוצא משהו, צועק. אברהם, אתה לא צועק סתם.'],
  ['אברהם', 'אני אף פעם לא צועק סתם. אני צועק בכוונה.'],
];
const CLUES = {
  desk: [['עידו', 'רשימת משלוחים. "מחסן 1, דרך המחצבה". קוצי מסמן הכול כמו פקיד.'], ['ארז', 'פקיד שחוטף אנשים.']],
  keys: [['דולב', 'מפתח! עם תג: "מחסן 1 · שער". מי שם מפתח במשאית נטושה?'], ['מולר', 'קוצי.']],
  radios: [['עידו', 'מכשירי קשר. התדר שלהם עדיין מכוון... רגע. שקט.']],
  map: [['עידו', 'המפה. המחצבה, ומזרחה: "מחסן 1". ומעבר לו משהו שמחוק. זה המקום.'], ['ארז', 'מחסן 1. נוסעים.']],
};
const NEHORAI_1 = 'זה... נהוראי. אני לא יודע איפה אני. חדר, בלי חלון. קוצי אומר שזה "עסקים". אם אתם שומעים: תביאו את כולם.';
const AMBUSH = [['שומר', 'מי זה שם?! זה ארז! קוצי יהרוג אותנו—'], ['יונתי', 'שני שומרים ליד הבור!'], ['ארז', 'מחסה! צבע!']];
const CLEARED = [['הדר', 'Bro, שניהם בחוץ. ניו יורק הייתה גאה.'], ['ארז', 'המפה. עידו, במשרד.']];

const Q = (game) => game.world.places.quarry;
const GUARDS = [['kg5', 'pit'], ['kg6', 'ramp']];

export default {
  id: 'quarry', chapter: 7, number: 2, title: 'המחצבה', requires: ['taken'],
  follows: true, secret: true,
  where: 'במחצבה הנטושה, מזרחה',
  startAt: (game) => { const q = Q(game); return q ? { x: q.entrance.x, z: q.entrance.z, y: q.y } : null; },
  reward: { money: 200, unlocks: ['depot-key'], text: 'המפתח למחסן 1 · 200 ₪' },

  setup(m, game) { m.s = { found: {} }; asErez(game); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const q = Q(game); game.car.place(q.parking.x, q.parking.z, q.parking.yaw); game.start(q.entrance.x, q.entrance.z, q.entrance.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) { return failOut(m, game, [2]); },
  restore(m, game, checkpoint) {
    const q = Q(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    if (checkpoint >= 1) { asErez(game); game.exitCar(); game.player.place(q.entrance.x, q.entrance.z, q.entrance.yaw); game.follow.snapBehind(q.entrance.yaw); team(game, game.player.pos, game.player.yaw); }
    if (checkpoint === 2) { q.patrols = q.patrols || { pit: [q.pit, { x: q.pit.x + 8, z: q.pit.z }], ramp: [q.truck.cab, { x: q.truck.cab.x - 6, z: q.truck.cab.z + 4 }] }; postGuards(game, q, GUARDS); armTeam(game); }
  },
  cleanup(m, game) {
    game.cutscene = false; game.follow.override = null;
    game.paint.dispose();
    hideGuards(game, GUARDS.map((g) => g[0]));
    if (!m.done) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: in
      objective: 'המחצבה',
      enter(m, game) {
        const q = Q(game);
        game.cutscene = true;
        arriveTeam(game, q.entrance);
        game.follow.shot({ x: q.entrance.x + 7, y: q.y + 3.5, z: q.entrance.z + 6 }, { x: q.x, y: q.y + 1.2, z: q.z + 10 }, 9999);
        game.hud.banner('המחצבה', '23:50', 'ארבעה רמזים · הצוות מתפזר', 3000);
        game.dialogue.play(ARRIVE).then(() => { m.s.in = true; });
      },
      update: (m) => (m.s.in ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the clues (three of the four; the map comes after the ambush)
      objective: 'לחפש רמזים: המשרד, המשאית, הסככה (0/3)', checkpoint: true,
      enter(m, game) {
        const q = Q(game);
        // the team spreads: Ido to the office, Dolev to the dumper, Muller to the shed, the rest hold the entrance
        game.squad.send('ido', q.office.door, { label: 'משרד' });
        game.squad.send('dolev', q.truck.cab, { label: 'משאית' });
        game.squad.send('muller', q.shed.inside, { label: 'סככה' });
      },
      target(m, game) { const q = Q(game), f = m.s.found; if (!f.desk) return { ...q.office.desk, r: 1.6 }; if (!f.keys) return { ...q.truck.keys, r: 1.8 }; if (!f.radios) return { ...q.shed.radios, r: 1.6 }; return null; },
      interaction(m, game) {
        const q = Q(game), f = m.s.found, p = game.player.pos;
        if (game.mode !== 'foot' || game.dialogue.busy) return null;
        if (!f.desk && near(p, q.office.desk, 2.2)) return { label: 'לקרוא את רשימת המשלוחים', priority: 5, run: () => { f.desk = true; game.dialogue.play(CLUES.desk); } };
        if (!f.keys && near(p, q.truck.keys, 2.4)) return { label: 'לקחת את המפתח מהמשאית', priority: 5, run: () => { f.keys = true; game.dialogue.play(CLUES.keys); game.hud.toast('מפתח · מחסן 1', 1600); } };
        if (!f.radios && near(p, q.shed.radios, 2.2)) return { label: 'להדליק את מכשיר הקשר', priority: 5, run: () => { f.radios = true; game.dialogue.play(CLUES.radios).then(() => radio(game, NEHORAI_1)).then(() => { m.s.heard = true; }); } };
        return null;
      },
      update(m, game) {
        const f = m.s.found, n = ['desk', 'keys', 'radios'].filter((k) => f[k]).length;
        say(m, game, `לחפש רמזים: המשרד, המשאית, הסככה (${n}/3)`);
        return n === 3 && m.s.heard && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { for (const id of ['ido', 'dolev', 'muller']) game.squad.release(id); },
    },
    { // 2: the ambush at the pit
      objective: 'שני השומרים של קוצי חזרו · לסמן אותם (0/2)', checkpoint: true,
      target: (m, game) => nearestGuard(game, GUARDS.map((g) => g[0])),
      enter(m, game) {
        const q = Q(game);
        q.patrols = { pit: [q.pit, { x: q.pit.x + 8, z: q.pit.z }], ramp: [q.truck.cab, { x: q.truck.cab.x - 6, z: q.truck.cab.z + 4 }] };
        postGuards(game, q, GUARDS); armTeam(game);
        for (const g of game.paint.guards) { g.seen = 1; g.alerted = true; } // they came looking
        game.dialogue.play(AMBUSH);
      },
      update(m, game) {
        const n = left(game, GUARDS.map((g) => g[0]));
        say(m, game, n ? `לסמן את שני השומרים של קוצי (${2 - n}/2) · סומנת ${game.paint.hits}/3` : 'נקי · המפה במשרד');
        if (!n && !m.s.cleared) { m.s.cleared = true; game.dialogue.play(CLEARED); }
        return n === 0 ? 'next' : null;
      },
    },
    { // 3: the map
      objective: 'המפה על קיר המשרד',
      target: (m, game) => ({ ...Q(game).office.map, r: 1.6 }),
      interaction(m, game) { const q = Q(game); if (game.mode === 'foot' && !m.s.found.map && near(game.player.pos, q.office.map, 2.4)) return { label: 'להסתכל במפה', priority: 5, run: () => { m.s.found.map = true; game.dialogue.play(CLUES.map).then(() => { m.s.mapped = true; }); } }; return null; },
      update(m, game) { say(m, game, 'להסתכל במפה על קיר המשרד'); return m.s.mapped ? 'next' : null; },
    },
    { // 4: to the depot
      objective: 'לנסוע למחסן 1, בהמשך דרך המחצבה', checkpoint: true,
      enter(m, game) { game.paint.disarmPlayer(); },
      target: (m, game) => { const D = game.world.places.depot; return game.mode === 'car' ? { ...D.parking, r: 6 } : { ...game.car.pos, r: 2.6 }; },
      update(m, game) { const D = game.world.places.depot; say(m, game, game.mode === 'car' ? 'לנסוע למחסן 1 (דרך המחצבה, חזרה מערבה)' : 'להיכנס לרנו · החבורה מאחוריך'); return game.mode === 'car' && near(game.car.pos, D.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
