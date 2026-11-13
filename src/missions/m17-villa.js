// Chapter five, mission 2, "הווילה של יניב". Liam's ask: Yaniv (invented for the game) won the summer's
// card pot with a marked deck and keeps it in two bags at his villa, on the new street past the end of
// Rimon street, with people in the yard, two on the roof and three inside. By the rules the crews play
// by — paint, never blood — whoever is marked is out and sits down. Muller takes the roof of the
// building opposite: whatever Nehorai marks, Muller marks from there, but only what he can see.
// The crew (everyone but Muller) comes in behind Nehorai, marker up, and the villa is cleared room by
// room, a shooting-game beat with their colours; the bags go out; Liam's Seat and Nehorai's Renault
// leave with Yaniv's friends (rival cars, never police) behind them, back to the pub. The garage tunes
// the Renault to 120 as the reward. No real place, no real weapon and nothing that shows how any real
// building is got into. The lines are written for the game and do not describe the real people.
import { near, say, nearestGuard } from './missions.js';
import { Pursuit } from './pursuit.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot, roadPath } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';
import { makeMoneyBag } from '../world/bank.js';
import { OUT_AT } from '../combat/paint.js';

const BRIEF = [
  ['ליאם', 'כולם פה? יופי. מולר, אתה בבניין ממול. כל השאר איתי ועם נהוראי.'],
  ['מולר', 'קיבלתי. תסמנו, אני מוריד.'],
  ['ליאם', 'נהוראי, אתה מוביל ברנו. אני בסיאט, נפגשים בחניה של הווילה. סע.'],
];
const ARRIVE = [['ליאם', 'הנה הווילה. שומרים בחצר, שניים על הגג. מולר, עלה.']];
const POST = [['מולר', 'בעמדה. רואה את החצר האחורית ואת הגג.']];
const RULES = [['ליאם', 'מה שמולר רואה — תסמן, והוא מוריד. מה שהוא לא רואה — שלך. בצבע.']];
const SPOTTED = [['שומר', 'היי! יש פה מישהו! יניב, יש לנו אורחים!']];
const INSIDE = [['ליאם', 'חדר-חדר. אני מאחוריך.'], ['יונתי', 'שמאל נקי!'], ['עידו', 'ימין נקי.']];
const BAGS = [['ליאם', 'הנה הקופה. שני תיקים. קח אחד, אני לוקח אחד.']];
const OUT = [['ליאם', 'לרכבים! נפגשים בפאב!']];
const RUN = {
  start: [['עידו', 'סע! הם עוד מחפשים את המפתחות. יש לנו כמה שניות.']],
  arrive: [[['עידו', 'יש לנו חברה מאחור. האדומה של יניב.']], [['עידו', 'ועוד אחת. תאבד אותם בפניות, הם לא מכירים את קציר.']]],
  close: [['עידו', 'הם צמודים! תחתוך פנימה!'], ['עידו', 'אל תיתן לו לעקוף!']],
  hit: [['עידו', 'מכה! תתרחק.'], ['עידו', 'הרנו ספגה. תיזהר על התיקים.']],
  lost: [['עידו', 'איבדנו אותם. לפאב, רגוע.']],
};
const END = [
  ['ליאם', 'יא מלכים. הקופה חזרה הביתה.'],
  ['קאי', 'הסיבוב הזה על הבית.'],
  ['נהוראי', 'ומה עם הרנו?'],
  ['ליאם', 'דיברתי עם המוסך. מחר היא נוסעת מאה ועשרים.'],
  ['מולר', 'מאה ועשרים.'],
];
const MARKED_OUT = 'סומנת שלוש פעמים. לפי החוקים, אתה בחוץ. בפעם הבאה: לסמן למולר את מי שהוא רואה, ולהישאר מאחורי העציצים.';

const CREW = ['ido', 'yonati', 'erez', 'avraham', 'dolev', 'hadar']; // with Nehorai inside; Liam walks in too; Muller is on the roof
const YARD = [['vg1', 'yardS'], ['vg2', 'yardN'], ['vg3', 'yardE'], ['vg4', 'yardW']];
const ROOF = ['vg5', 'vg6'];
const INS = [['vg7', 'salon'], ['vg8', 'kitchen'], ['vg9', 'study']];
const ROOMS = { salon: 'הסלון', kitchen: 'המטבח', study: 'החדר האחורי', hall: 'הכניסה' };

const villa = (game) => game.world.places.villa;
const pub = (game) => game.world.places.pub;

function endChase(m, game) { m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; }

// Liam's Seat, red, parked where a mission puts it
function seat(m, game, at) {
  if (!m.seat) {
    m.seat = new Vehicle(game.world, makeHatchback({ color: '#b8322a' }), { name: 'seat', maxSpeed: 32, accel: 8 });
    game.scene.add(m.seat.model);
    game.chaseCars.push(m.seat);
  }
  m.seat.place(at.x, at.z, at.yaw, game.world.groundHeight(at.x, at.z) + 0.05);
  m.seat.model.updateMatrixWorld(true);
  m.seatAp = null;
  return m.seat;
}
function dropSeat(m, game) {
  if (!m.seat) return;
  game.scene.remove(m.seat.model);
  game.world.cols.dynamic.delete(m.seat.box);
  game.chaseCars = game.chaseCars.filter((c) => c !== m.seat);
  m.seat = null; m.seatAp = null;
}

// the guards, fresh: four rounds in the yard, two still on the roof, three inside
function postGuards(game) {
  const V = villa(game), P = game.paint;
  for (const [id, route] of [...YARD, ...INS]) {
    const n = game.npc(id), pts = V.patrols[route];
    n.floorY = null; n.place(pts[0].x, pts[0].z, 0); n.show(true);
    if (!P.guards.some((g) => g.npc === n)) P.addGuard(n, pts, undefined, { quick: true });
  }
  V.roofSpots.forEach((rs, i) => {
    const n = game.npc(ROOF[i]);
    n.floorY = rs.y; n.place(rs.x, rs.z, rs.yaw); n.show(true);
    if (!P.guards.some((g) => g.npc === n)) P.addGuard(n, [{ x: rs.x, z: rs.z }], undefined, { quick: true, still: true });
  });
  P.reset();
}
// Nehorai, the crew and Liam with markers; Muller on the roof opposite
function armUp(game) {
  const V = villa(game), P = game.paint;
  P.armPlayer();
  for (const id of [...CREW, 'liam']) { const n = game.npc(id); if (n.inCar) n.stepOut(-1); n.show(true); if (!P.allies.some((a) => a.npc === n)) P.addAlly(n); }
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy']) game[b].held = false;
  if (!game.liamBuddy.active) game.liamBuddy.join({ near: V.gate });
  if (!game.idoBuddy.active) game.idoBuddy.join({ near: V.gate });
  const muller = game.npc('muller'), post = V.mullerPost;
  muller.floorY = post.y; muller.place(post.x, post.z, Math.atan2(post.look.x - post.x, post.look.z - post.z)); muller.lookAt(post.look.x, post.look.z); muller.show(true);
  P.setOverwatch({ npc: muller, post: { x: post.x, y: post.y, z: post.z } });
}
// the crew gathered at a spot, in a loose half circle facing it
function gather(game, ids, spot, facing, r = 2.6) {
  ids.forEach((id, i) => {
    const n = game.npc(id), a = -Math.PI / 2 + (i / Math.max(1, ids.length - 1)) * Math.PI;
    if (n.inCar) n.stepOut(-1);
    n.floorY = null;
    n.place(spot.x + Math.sin(a) * r, spot.z + Math.cos(a) * r, Math.atan2(facing.x - spot.x, facing.z - spot.z));
    n.idle = null; n.target = null; n.model.setPose(null); n.show(true);
  });
}
function guardsLeft(game, ids) { return game.paint.guards.filter((g) => ids.some((id) => game.npc(id) === g.npc) && !g.marked); }

export default {
  id: 'villa', chapter: 5, number: 2, title: 'הווילה של יניב', requires: ['pub'],
  where: 'בכניסה לפאב, אחרי חצות',
  startAt: (game) => { const P = pub(game); return P ? { x: P.entrance.x, z: P.entrance.z, y: P.floorY } : null; },
  reward: { money: 1200, unlocks: ['turbo', 'chapter-5'], text: 'סוף הפרק החמישי · הקופה חזרה · 1,200 ₪ · הרנו: מנוע 120' },

  setup(m, game) {
    m.s = {};
    game.daylight?.set(1, 0);
    for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy']) { if (game[b].active) game[b].leave(); game[b].held = true; }
    game.radio?.stopAmbient();
    for (const n of game.pubCrowd || []) n.show(false);
  },
  prepareReplay(game) {
    game.daylight?.set(1, 0);
    if (game.mode === 'car') game.exitCar();
    game.car.repair();
    const P = pub(game);
    game.car.place(P.parking.x, P.parking.z, P.parking.yaw, P.parkingY + 0.05);
    game.start(P.entrance.x, P.entrance.z, P.entrance.yaw);
  },
  failIf(m, game) {
    if ([1, 7].includes(m.stepIndex) && game.car.disabled) return 'הרנו נפגעה יותר מדי. ליאם: "בלי רנו אין יציאה שנייה."';
    if ([3, 4].includes(m.stepIndex) && game.paint.hits >= OUT_AT) return MARKED_OUT;
    return null;
  },
  restore(m, game, checkpoint) {
    const V = villa(game);
    endChase(m, game);
    game.dialogue.stop();
    game.cutscene = false; game.follow.override = null;
    game.car.repair();
    game.hud.showCall(null);
    if (checkpoint === 1) { game.car.place(pub(game).parking.x, pub(game).parking.z, pub(game).parking.yaw, pub(game).parkingY + 0.05); game.enterCar(); }
    if (checkpoint === 3 || checkpoint === 4) {
      game.exitCar();
      game.car.place(V.cars.nehorai.x, V.cars.nehorai.z, V.cars.nehorai.yaw, game.world.groundHeight(V.cars.nehorai.x, V.cars.nehorai.z) + 0.05);
      seat(m, game, V.cars.liam);
      const at = checkpoint === 3 ? V.gate : V.door;
      game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
      postGuards(game); armUp(game);
      m.s = { ...m.s, spotted: false, lined: false };
      if (checkpoint === 4) for (const g of game.paint.guards) if ([...YARD.map((y) => y[0]), ...ROOF].some((id) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore');
    }
    if (checkpoint === 6) { game.exitCar(); game.car.place(V.cars.nehorai.x, V.cars.nehorai.z, V.cars.nehorai.yaw); seat(m, game, V.cars.liam); game.player.place(V.door.x, V.door.z, 0); game.paint.disarmPlayer(); }
  },
  cleanup(m, game) {
    endChase(m, game);
    game.paint.dispose();
    game.cutscene = false; game.follow.override = null;
    game.nehorai.setPose(null);
    game.hud.setMark?.(false, false);
    for (const [id] of [...YARD, ...INS]) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
    for (const id of ROOF) { const n = game.npc(id); n.floorY = null; n.model.setPose(null); n.show(false); }
    const muller = game.npc('muller'); muller.floorY = null; muller.model.setPose(null);
    for (const b of m.bags || []) b.obj.removeFromParent();
    m.bags = null;
    dropSeat(m, game);
    for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy']) game[b].held = false;
    for (const id of [...CREW, 'liam', 'muller']) { const n = game.npc(id); if (n.model.pose === 'carry' || n.model.pose === 'aim') n.model.setPose(null); }
    if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3);
    game.populate({ walk: true });
  },

  steps: [
    { // 0: the plan, at the pub's door
      objective: 'ליאם מסביר את התוכנית',
      enter(m, game) {
        const P = pub(game);
        game.daylight?.set(1, 0);
        game.cutscene = true;
        game.player.place(P.entrance.x, P.entrance.z, P.entrance.yaw);
        gather(game, [...CREW, 'liam', 'muller'], { x: P.entrance.x, z: P.entrance.z + 2.6 }, P.entrance, 3);
        seat(m, game, P.parkingSlots?.[0] || P.parking);
        game.follow.shot({ x: P.entrance.x + 5, y: P.floorY + 3, z: P.entrance.z + 7 }, { x: P.entrance.x, y: P.floorY + 1.3, z: P.entrance.z + 1.5 }, 9999);
        game.hud.banner('הווילה של יניב', '02:40', 'צבע, לא דם · מי שמסומן, בחוץ', 3000);
        if (!m.s.briefed) game.dialogue.play(BRIEF).then(() => { m.s.briefed = true; });
      },
      update: (m) => (m.s.briefed ? 'next' : null),
      exit(m, game) {
        game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        for (const id of [...CREW, 'liam', 'muller']) game.npc(id).show(false); // they go in the Seat and Erez's car
      },
    },
    { // 1: drive to the villa
      objective: 'לנסוע לווילה של יניב, בסוף רחוב הרימון ומזרחה', checkpoint: true,
      enter(m, game) { game.daylight?.set(1, 0); },
      target: (m, game) => { const V = villa(game); return game.mode === 'car' ? { ...V.parking, r: 6 } : { ...game.car.pos, r: 2.4 }; },
      update(m, game) {
        const V = villa(game);
        say(m, game, game.mode === 'car' ? 'לנסוע לווילה: עד סוף רחוב הרימון, ואז מזרחה בדרך הכרמים' : 'להיכנס לרנו ולנסוע לווילה');
        return game.mode === 'car' && near(game.car.pos, V.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
    },
    { // 2: at the gate; Muller takes the roof opposite
      objective: 'מולר תופס עמדה בבניין ממול',
      enter(m, game) {
        const V = villa(game);
        game.cutscene = true;
        game.exitCar();
        game.car.place(V.cars.nehorai.x, V.cars.nehorai.z, V.cars.nehorai.yaw, game.world.groundHeight(V.cars.nehorai.x, V.cars.nehorai.z) + 0.05);
        seat(m, game, V.cars.liam);
        game.player.place(V.gate.x, V.gate.z + 1.5, V.gate.yaw);
        gather(game, [...CREW, 'liam'], { x: V.gate.x, z: V.gate.z + 3.4 }, V.gateInside, 2.8);
        const muller = game.npc('muller'), post = V.mullerPost;
        muller.floorY = null; muller.place(post.foot.x, post.foot.z, Math.PI); muller.show(true);
        game.follow.shot({ x: V.gate.x + 6, y: V.y + 2.6, z: V.gate.z + 6 }, { x: V.gate.x, y: V.y + 1.2, z: V.gate.z - 2 }, 9999);
        game.dialogue.play(ARRIVE).then(() => {
          // up he goes: the shot moves to the roof, and he is there
          muller.floorY = post.y; muller.place(post.x, post.z, 0); muller.lookAt(post.look.x, post.look.z);
          game.follow.shot({ x: post.x + 4, y: post.y + 2.4, z: post.z + 6 }, { x: post.x, y: post.y + 1.4, z: post.z - 2 }, 9999);
          return game.dialogue.play(POST);
        }).then(() => game.dialogue.play(RULES)).then(() => { m.s.posted = true; });
      },
      update: (m) => (m.s.posted ? 'next' : null),
      exit(m, game) {
        game.cutscene = false; game.follow.override = null;
        const V = villa(game);
        game.player.place(V.gate.x, V.gate.z + 1.0, V.gate.yaw); game.follow.snapBehind(V.gate.yaw);
        postGuards(game); armUp(game);
      },
    },
    { // 3: the yard: mark for Muller what he can see, paint the rest yourself
      objective: 'לסמן את השומרים בחצר ועל הגג (0/6) · סומנת 0/3', checkpoint: true,
      target: (m, game) => nearestGuard(game, [...YARD.map((y) => y[0]), ...ROOF]),
      enter(m, game) {
        const P = game.paint;
        m.s.spotted = false;
        P.onSpot = () => { if (!m.s.spotted) { m.s.spotted = true; game.dialogue.play(SPOTTED); } };
        P.onNoSight = () => { if (!m.s.hinted) { m.s.hinted = true; game.hud.toast('מולר לא רואה אותו משם — תסמן אותו בעצמך, או תמצא זווית', 2600); } };
        P.onOverwatchHit = () => { if (!m.s.firstOw) { m.s.firstOw = true; game.hud.toast('מולר הוריד אותו מהגג', 1800); } };
      },
      update(m, game) {
        const ids = [...YARD.map((y) => y[0]), ...ROOF], left = guardsLeft(game, ids).length;
        say(m, game, left ? `לסמן את השומרים בחצר ועל הגג (${6 - left}/6) · סומנת ${game.paint.hits}/${OUT_AT}` : 'החצר נקייה · להיכנס לווילה');
        return left === 0 ? 'next' : null;
      },
      exit(m, game) { game.paint.onSpot = null; game.paint.onNoSight = null; game.paint.onOverwatchHit = null; },
    },
    { // 4: inside, room by room
      objective: 'להיכנס ולנקות חדר אחרי חדר (0/3)', checkpoint: true,
      target: (m, game) => { const V = villa(game); const left = guardsLeft(game, INS.map((i) => i[0])); if (!left.length) return null; return game.mode === 'foot' && !V.inside(game.player.pos.x, game.player.pos.z) ? { ...V.door, y: V.floorY, r: 2 } : nearestGuard(game, INS.map((i) => i[0])); },
      enter(m, game) { if (!m.s.lined) { m.s.lined = true; game.dialogue.play(INSIDE); } },
      update(m, game) {
        const V = villa(game), left = guardsLeft(game, INS.map((i) => i[0]));
        if (!left.length) return 'next';
        const g = left[0], room = ROOMS[V.inRoom(g.npc.pos.x, g.npc.pos.z)] || 'החדר הבא';
        say(m, game, V.inside(game.player.pos.x, game.player.pos.z) ? `לנקות את ${room} (${3 - left.length}/3) · סומנת ${game.paint.hits}/${OUT_AT}` : `להיכנס לווילה דרך הדלת (${3 - left.length}/3)`);
        return null;
      },
    },
    { // 5: the bags, in the study
      objective: 'לקחת את שני התיקים מהחדר האחורי', checkpoint: true,
      enter(m, game) {
        const V = villa(game);
        if (!m.bags) m.bags = V.bags.map((b) => { const obj = makeMoneyBag(); obj.position.set(b.x, b.y, b.z); game.scene.add(obj); return { obj, pos: b, taken: false }; });
        game.paint.disarmPlayer();
        if (!m.s.bagLine) { m.s.bagLine = true; game.dialogue.play(BAGS); }
      },
      target: (m, game) => { const b = m.bags?.find((x) => !x.taken); return b ? { x: b.pos.x, z: b.pos.z, y: b.pos.y, r: 1.4 } : null; },
      interaction(m, game) {
        if (game.mode !== 'foot') return null;
        for (const b of m.bags || []) if (!b.taken && near(game.player.pos, b.pos, 2.2)) return { label: 'לקחת תיק', priority: 5, run: () => {
          b.taken = true;
          const taken = m.bags.filter((x) => x.taken).length;
          if (taken === 1) { b.obj.removeFromParent(); b.obj.position.set(0, 0.55, 0.38); b.obj.rotation.set(0, 0, 0); game.nehorai.root.add(b.obj); game.nehorai.setPose('carry'); }
          else { const liam = game.npc('liam'); b.obj.removeFromParent(); b.obj.position.set(0, 0.55, 0.38); b.obj.rotation.set(0, 0, 0); liam.model.root.add(b.obj); liam.model.setPose('carry'); }
          game.hud.toast(`תיק ${taken} מתוך 2`, 1500);
        } };
        return null;
      },
      update(m, game) { const taken = (m.bags || []).filter((x) => x.taken).length; say(m, game, `לקחת את שני התיקים מהחדר האחורי (${taken}/2)`); return taken === 2 ? 'next' : null; },
    },
    { // 6: out to the cars
      objective: 'לצאת לרנו · ליאם לסיאט', checkpoint: true,
      enter(m, game) {
        const V = villa(game);
        if (!m.s.outLine) { m.s.outLine = true; game.dialogue.play(OUT); }
        game.paint.setOverwatch(null);
        for (const b of ['idoBuddy', 'hadarBuddy', 'liamBuddy']) game[b].held = true;
        game.npc('liam').walkTo(V.cars.liam.x + 1.4, V.cars.liam.z, { run: true });
        for (const id of CREW) game.npc(id).walkTo(V.gate.x + (Math.random() - 0.5) * 4, V.gate.z + 1.5, { run: true });
      },
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.6 }),
      update(m, game) {
        say(m, game, 'לרוץ לרנו ולצאת');
        return game.mode === 'car' ? 'next' : null;
      },
    },
    { // 7: Yaniv's friends behind; back to the pub, the Seat ahead
      objective: 'לברוח לפאב עם התיקים · לאבד את הרכבים מאחור', checkpoint: true,
      enter(m, game) {
        const V = villa(game), P = pub(game);
        game.nehorai.setPose(null);
        for (const b of m.bags || []) b.obj.removeFromParent();
        for (const id of [...CREW, 'liam', 'muller']) game.npc(id).show(false);
        m.pursuit = new Pursuit(game, { grace: 6, cars: 2, gap: 15, colors: ['#b8322a', '#d9c9a0'], lines: RUN, bonus: 150 });
        // Liam's Seat goes first, down the new street to Rimon street
        const road = game.world.places.villaRoad;
        if (m.seat && road) { const s = road.nearest(V.parking.x, V.parking.z).s ?? 70; m.seatAp = new Autopilot(roadPath(road, Math.min(road.length, s), 2, 1.8), { cruise: 14 }); }
        m.s.pubShown = false;
      },
      target: (m, game) => { const P = pub(game); return { ...P.parking, y: P.parkingY, r: 6 }; },
      update(m, game, dt) {
        const P = pub(game);
        if (m.seat && m.seatAp) m.seat.update(dt, m.seatAp.drive(m.seat));
        if (m.pursuit) m.pursuit.update(dt);
        say(m, game, game.mode === 'car' ? (m.pursuit?.active ? 'לאבד את הרכבים מאחור ולהגיע לפאב' : 'לנסוע לפאב ולחנות') : 'לחזור לרנו');
        return game.mode === 'car' && near(game.car.pos, P.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
      exit(m, game) { endChase(m, game); },
    },
    { // 8: the pub, everyone
      objective: 'הקופה חזרה',
      enter(m, game) {
        const P = pub(game);
        game.cutscene = true;
        game.exitCar();
        game.player.place(P.entrance.x, P.entrance.z + 1.5, P.entrance.yaw);
        seat(m, game, P.parkingSlots?.[0] || P.parking);
        gather(game, [...CREW, 'liam', 'muller'], { x: P.entrance.x, z: P.entrance.z + 3.2 }, P.entrance, 3);
        for (const id of ['kai', 'yahli']) { const n = game.npc(id); n.place(P.entrance.x + (id === 'kai' ? -1.2 : 1.2), P.entrance.z - 0.4, Math.PI); n.idle = 'arms'; n.show(true); }
        for (const id of [...CREW, 'liam']) game.npc(id).idle = 'cheer';
        game.follow.shot({ x: P.entrance.x + 6, y: P.floorY + 3, z: P.entrance.z + 8 }, { x: P.entrance.x, y: P.floorY + 1.3, z: P.entrance.z + 1.5 }, 9999);
        if (!m.s.endLine) { m.s.endLine = true; game.dialogue.play(END).then(() => { m.s.done = true; }); }
      },
      update: (m) => (m.s.done ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); for (const id of [...CREW, 'liam']) game.npc(id).idle = null; },
    },
  ],
};
