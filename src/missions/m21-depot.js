// Chapter seven, mission 3, "מחסן 1". Kotzi's depot: cameras over the yard, two in the guard house
// at the gate, four more in the warehouse, a locked office with the laptop that names the fort, and
// — Ido's find — a door behind the last shelf that lets the team out the back toward the fort. Cover,
// teamwork, paint. Invented place and people.
import { near, say } from './missions.js';
import { asErez, asNehorai, arriveTeam, armTeam, postGuards, hideGuards, left, radio, failOut, team } from './rescue.js';

const PLAN = [
  ['עידו', 'מחסן 1. שתי מצלמות על החצר, שומרים בבית השומר ליד השער, ועוד בפנים.'],
  ['ארז', 'קודם בית השומר: מסמנים את השניים ומכבים את המצלמות מהמסך. אחר כך החצר, אחר כך המחסן.'],
  ['יונתי', 'ואם המצלמה רואה אותי, שתראה אותי יפה.'],
  ['ארז', 'מולר, אברהם: החצר מימין. דולב, הדר: שמאל. ליאם, עידו: איתי. צבע.'],
];
const CAMS_OFF = [['עידו', 'המסך. "מצלמות: פעיל". לא עוד.'], ['ארז', 'כבוי. החצר שלנו.']];
const YARD_CLEAR = [['אברהם', 'החצר נקייה. גם דיברתי עם אחד מהם, הוא התחרט על הכול.'], ['ארז', 'המחסן. דלת ראשית. ליאם, אתה ראשון.']];
const HALL_CLEAR = [['ליאם', 'נקי, אחים. יש פה משרד נעול בפינה.'], ['עידו', 'נעול זה הקטע שלי. שתי דקות.'], ['דולב', 'שתי דקות? אצלי זה חמש. בלי מפתח.']];
const LAPTOP = [['עידו', 'המחשב הנייד שלו. "המצודה: הכניסה דרך המנהרה, מחסן הכלים בסוף הדרך". ו"האורח בתא 2".'], ['ארז', '"האורח". נהוראי. עידו, איפה המנהרה?'], ['עידו', 'סוף דרך המחצבה. אבל רגע — המדף הזה. הוא לא צמוד לקיר.']];
const HIDDEN = [['עידו', 'דלת. מאחורי המדפים. קוצי מחביא דלתות כמו שאברהם מחביא מילים.'], ['אברהם', 'אני לא מחביא, אני שומר לאחר כך.'], ['ארז', 'החוצה מאחור. לרכבים, ולסוף הדרך.']];
const NEHORAI_2 = 'ארז? אני שומע רכבים. הם העבירו אותי. יש פה מנהרה, ריח של בטון רטוב. תביאו את עידו, הוא יודע לפתוח דברים.';

const D = (game) => game.world.places.depot;
const HOUSE = [['kg1', 'house'], ['kg2', 'gate']];
const YARD = [['kg3', 'yard'], ['kg4', 'yard']];
const HALL = [['kg5', 'hallN'], ['kg6', 'hallS'], ['kg7', 'office'], ['kg8', 'hallN']];
const ALL = [...HOUSE, ...YARD, ...HALL];

function cameras(game, m, dt) {
  const d = D(game);
  if (m.s.camsOff) return;
  const p = game.player.pos;
  let seen = false;
  for (const c of d.cameras) if (c.sees(game.world, p.x, p.z)) seen = true;
  if (seen) {
    game.alert.raise(dt * 22);
    if (!m.s.camWarn || m.t - m.s.camWarn > 10) { m.s.camWarn = m.t; game.hud.toast('מצלמה! אל תיכנס לקונוס האדום', 1800); }
    if (game.alert.level >= 70) for (const g of game.paint.guards) if (!g.marked) { g.seen = 1; g.alerted = true; }
  }
}

export default {
  id: 'depot', chapter: 7, number: 3, title: 'מחסן 1', requires: ['quarry'],
  follows: true, secret: true,
  where: 'בשער של מחסן 1',
  startAt: (game) => { const d = D(game); return d ? { x: d.gate.x, z: d.gate.z, y: d.y } : null; },
  reward: { money: 350, unlocks: ['fort-tunnel'], text: 'הדרך למצודה · 350 ₪' },

  setup(m, game) { m.s = {}; asErez(game); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const d = D(game); game.car.place(d.parking.x, d.parking.z, d.parking.yaw); game.start(d.gate.x, d.gate.z, d.gate.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3]); },
  restore(m, game, checkpoint) {
    const d = D(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    asErez(game); game.exitCar();
    const at = checkpoint >= 3 ? d.warehouse.door : d.gate;
    game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
    team(game, game.player.pos, game.player.yaw);
    postGuards(game, d, ALL); armTeam(game);
    if (checkpoint >= 2) { for (const g of game.paint.guards) if (HOUSE.some(([id]) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore'); m.s.camsOff = true; for (const c of d.cameras) c.setOn(false); }
    if (checkpoint >= 3) for (const g of game.paint.guards) if (YARD.some(([id]) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore');
  },
  cleanup(m, game) {
    const d = D(game);
    game.cutscene = false; game.follow.override = null;
    game.paint.dispose();
    hideGuards(game, ALL.map((g) => g[0]));
    for (const c of d.cameras) c.setOn(true);
    d.office.door.lock(); d.hidden.door.lock();
    if (!m.done) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: the plan at the gate
      objective: 'מחסן 1 · התוכנית',
      enter(m, game) {
        const d = D(game);
        game.cutscene = true;
        arriveTeam(game, d.gate);
        postGuards(game, d, ALL);
        game.follow.shot({ x: d.gate.x - 7, y: d.y + 4, z: d.gate.z - 6 }, { x: d.x, y: d.y + 1.5, z: d.z - 6 }, 9999);
        game.hud.banner('מחסן 1', '00:30', 'מצלמות · שומרים · משרד נעול', 3000);
        game.dialogue.play(PLAN).then(() => { m.s.planned = true; });
      },
      update: (m) => (m.s.planned ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); armTeam(game); },
    },
    { // 1: the guard house and the cameras
      objective: 'בית השומר: לסמן את השניים ולכבות את המצלמות מהמסך', checkpoint: true,
      target(m, game) { const d = D(game); return left(game, HOUSE.map((g) => g[0])) ? { ...d.guardHouse.door, y: d.y, r: 2 } : { ...d.guardHouse.monitor, r: 1.5 }; },
      interaction(m, game) { const d = D(game); if (game.mode === 'foot' && !m.s.camsOff && !left(game, HOUSE.map((g) => g[0])) && near(game.player.pos, d.guardHouse.monitor, 2.2)) return { label: 'לכבות את המצלמות', priority: 5, run: () => { m.s.camsOff = true; for (const c of d.cameras) c.setOn(false); game.dialogue.play(CAMS_OFF); game.hud.toast('המצלמות כבויות', 1600); } }; return null; },
      update(m, game, dt) {
        cameras(game, m, dt);
        const n = left(game, HOUSE.map((g) => g[0]));
        say(m, game, n ? `בית השומר ליד השער: לסמן את השניים (${2 - n}/2) · להתחמק מהמצלמות · סומנת ${game.paint.hits}/3` : m.s.camsOff ? 'המצלמות כבויות' : 'לכבות את המצלמות מהמסך בבית השומר');
        return m.s.camsOff && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 2: the yard
      objective: 'החצר: לסמן את השומרים (0/2)', checkpoint: true,
      update(m, game) {
        const n = left(game, YARD.map((g) => g[0]));
        say(m, game, n ? `החצר: לסמן את השומרים (${2 - n}/2) · סומנת ${game.paint.hits}/3` : 'החצר נקייה · למחסן');
        if (!n && !m.s.yardClear) { m.s.yardClear = true; game.dialogue.play(YARD_CLEAR); radio(game, NEHORAI_2); }
        return n === 0 && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 3: the warehouse
      objective: 'המחסן: לסמן את הארבעה שבפנים (0/4)', checkpoint: true,
      target: (m, game) => { const d = D(game); return !d.warehouse.inside || game.world.places.depot.toWorld && Math.hypot(game.player.pos.x - d.warehouse.center.x, game.player.pos.z - d.warehouse.center.z) > 12 ? { ...d.warehouse.door, y: d.y, r: 2 } : null; },
      update(m, game) {
        const n = left(game, HALL.map((g) => g[0]));
        say(m, game, n ? `המחסן: לסמן את הארבעה שבפנים (${4 - n}/4) · סומנת ${game.paint.hits}/3` : 'המחסן נקי');
        if (!n && !m.s.hallClear) { m.s.hallClear = true; game.dialogue.play(HALL_CLEAR).then(() => { m.s.hallSaid = true; }); }
        return m.s.hallSaid ? 'next' : null;
      },
    },
    { // 4: the office: Ido picks the lock; the laptop
      objective: 'המשרד הנעול: עידו פורץ · המחשב הנייד', checkpoint: true,
      enter(m, game) {
        const d = D(game);
        game.paint.disarmPlayer();
        game.squad.send('ido', d.office.at, { label: 'פורץ', onArrive: () => { m.s.picking = m.t; game.hud.toast('עידו פורץ את המנעול...', 2200); } });
      },
      target: (m, game) => { const d = D(game); return m.s.open ? { ...d.office.laptop, r: 1.5 } : { ...d.office.at, y: d.y, r: 2.5 }; },
      interaction(m, game) { const d = D(game); if (game.mode === 'foot' && m.s.open && !m.s.read && near(game.player.pos, d.office.laptop, 2.2)) return { label: 'לקרוא במחשב הנייד', priority: 5, run: () => { m.s.read = true; game.dialogue.play(LAPTOP).then(() => { m.s.laptop = true; }); } }; return null; },
      update(m, game) {
        const d = D(game);
        if (m.s.picking != null && !m.s.open && m.t - m.s.picking > 4) { m.s.open = true; d.office.door.unlock(); d.office.door.setOpen(true); game.squad.release('ido'); game.hud.toast('המשרד פתוח', 1400); game.sound?.chime?.(true); }
        say(m, game, !m.s.open ? 'עידו פורץ את דלת המשרד · לחפות עליו' : !m.s.read ? 'המחשב הנייד על השולחן במשרד' : 'המחשב הנייד');
        return m.s.laptop ? 'next' : null;
      },
    },
    { // 5: the door behind the shelves, and out the back
      objective: 'עידו מצא דלת מאחורי המדפים · לצאת מאחור', checkpoint: true,
      enter(m, game) {
        const d = D(game);
        game.dialogue.play(HIDDEN);
        game.squad.send('ido', d.hidden.at, { label: 'דלת', onArrive: () => { d.hidden.door.unlock(); d.hidden.door.setOpen(true); game.squad.release('ido'); game.hud.toast('הדלת הנסתרת פתוחה', 1400); m.s.hiddenOpen = true; } });
      },
      target: (m, game) => { const d = D(game); return m.s.hiddenOpen ? { ...d.back, y: d.y, r: 3 } : { ...d.hidden.at, y: d.y, r: 2.5 }; },
      update(m, game) {
        const d = D(game);
        say(m, game, m.s.hiddenOpen ? 'לצאת דרך הדלת הנסתרת, מאחורי המחסן' : 'עידו פותח את הדלת שמאחורי המדפים');
        return m.s.hiddenOpen && near(game.player.pos, d.back, 4) ? 'next' : null;
      },
    },
    { // 6: to the end of the road
      objective: 'לנסוע לסוף דרך המחצבה, למחסן הכלים', checkpoint: true,
      target: (m, game) => { const P = game.world.places.passage; return game.mode === 'car' ? { ...P.parking, r: 6 } : { ...game.car.pos, r: 2.6 }; },
      update(m, game) { const P = game.world.places.passage; say(m, game, game.mode === 'car' ? 'לנסוע עד סוף דרך המחצבה' : 'לחזור לרנו · החבורה מאחוריך'); return game.mode === 'car' && near(game.car.pos, P.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
