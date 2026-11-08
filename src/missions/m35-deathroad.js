// Chapter nine, mission 2, "מרדף בכביש המוות". Out of the safe house's yard onto the death road at night:
// Nehorai drives the Renault with Erez and Ido in it, the gang's two other cars behind on the same way. A
// lorry of the Order comes head-on in their lane ("נהוראי, אתה רואה את המשאית הזאת?!"), a black car comes
// out of a side road to cut them off, the barriers with a gap, things by the road that go up as they pass,
// charges on the road that warn before they blow; then the Order's cars behind, the fork with three ways to
// the port (the tunnels under the cliff, the highway with its two ramps, the dirt track over the washed-out
// ditch), another car out of a side road on each, and the last stretch in the first rain to the gates of the
// abandoned port, where the chasers suddenly stop. The friends talk on the radio between the cars. The
// driving is the player's, all of it. Rivals, never police; paint and dents, never worse. Invented.
import { near, say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { TEAM, endCrew, clock, Blast, attempt } from './phoenix.js';
import { gangCars, dropGangCars, parkGangCars, boardAll, unboardAll, Convoy, Chatter, Truck, Rival, ORDER_COLORS, handsTo, armGang, calm } from './phoenix-a.js';

const D = (game) => game.world.places.deathRoad;
const H = (game) => game.world.places.safehouse;
const PORT = (game) => game.world.places.port;
const INTRO = [['ארז', 'כולם בקשר? רכב שתיים, רכב שלוש?'], ['יונתי', 'רכב שתיים פה. אברהם כבר מדבר.', 'phone'], ['דולב', 'רכב שלוש פה. ואני כבר מתחרט.', 'phone'], ['עידו', 'כביש המוות עד הסוף. בסופו — הנמל.']];
const TRUCK = [['עידו', 'נהוראי, אתה רואה את המשאית הזאת?!'], ['נהוראי', 'ברור שאני רואה!'], ['עידו', 'אז למה אתה נוסע ישר אליה?!']];
const DODGED = [['ארז', 'וואו. עברנו בסנטימטרים.'], ['ליאם', 'אחים! ראינו את זה מאחור! מטורף!', 'phone'], ['עידו', 'הלב שלי נשאר שם, ליד המשאית.']];
const CUT = { j2: [['ארז', 'רכב שחור משמאל! הוא יוצא לחסום אותנו!']], j3: [['עידו', 'עוד אחד, מהדרך שמימין! הוא מנסה לחתוך אותנו!']], j4: [['ארז', 'האחרון יוצא מהשביל! לא לתת לו לעצור אותנו!']], j5: [['עידו', 'רכב בשדה! הוא עולה לדרך העפר מולנו!']] };
const CHASE = [['ליאם', 'אחים! שני רכבים שחורים מאחורינו!', 'phone'], ['ארז', 'המסדר. הם צפו בבית מבחוץ — כמו שנכנסו לנו לטלוויזיה.']];
const AGAIN = [['ליאם', 'אחים, הם שוב מאחורינו!', 'phone']];
const MORE = [['מולר', 'עוד אחד מאחור.', 'phone']];
const CLOSE = [[['ארז', 'הוא צמוד אלינו!']], [['עידו', 'שמאלה ימינה, אל תיתן לו להיצמד!']], [['הדר', 'Bro, הוא עלינו!', 'phone']]];
const HIT = [[['ארז', 'ספגנו! להמשיך!']], [['עידו', 'הרנו! תשמור על הרנו!']]];
const LOST = [['עידו', 'איבדנו אותם. בינתיים.'], ['אברהם', 'אני רוצה לציין שאני עדיין חי.', 'phone']];
const CHARGE = [[['ארז', 'מטען על הכביש! תסטה!']], [['עידו', 'עוד מטען! לנתיב השני!']], [['יונתי', 'עיגול אדום לפניכם! זוזו!', 'phone']]];
const BARRIER = [['עידו', 'מחסום! דרך הפרצה באמצע!']];
const FORK = [['עידו', 'שלוש דרכים לנמל! משמאל המנהרות, ישר הכביש הראשי, מימין דרך העפר.'], ['ארז', 'תבחר, אחי. כולנו אחריך.']];
const ROUTE = {
  tunnel: [['עידו', 'המנהרות. דרך הפרצה במחסום, ואז ישר מתחת לצוק.'], ['יונתי', 'אנחנו אחריכם. נכנסים לחושך.', 'phone']],
  main: [['עידו', 'הכביש הראשי. משאית חונה בנתיב הימני — ורמפות בשמאלי!'], ['דולב', 'רמפות?! אף אחד לא אמר לי רמפות!', 'phone']],
  dirt: [['עידו', 'דרך העפר. התעלה מגיעה — גז מלא, ועל הרמפה!'], ['ליאם', 'אחים, אם אתם קופצים, גם אנחנו קופצים.', 'phone']],
};
const GALLERY = [['ארז', 'המנהרה. תחזיק את ההגה ישר.'], ['מולר', 'העמודים קרובים. מאוד.', 'phone']];
const UNDER = [['עידו', 'מנהרה! תשאיר אותם מאחור בחושך.'], ['דולב', 'אני שונא מנהרות. ואת האנשים שבתוכן.', 'phone']];
const DITCH = [['ארז', 'נפלנו לתעלה! לטפס החוצה בצד, ולהמשיך!']];
const JUMP = [[['ארז', 'עפנו!!']], [['דולב', 'ראיתם את זה? עפנו!', 'phone']], [['עידו', 'נחיתה רכה. בערך.']]];
const REJOIN = [['עידו', 'חזרנו לכביש הראשי. ישר לנמל.'], ['ארז', 'כולם איתנו?'], ['יונתי', 'רכב שתיים פה.', 'phone'], ['ליאם', 'רכב שלוש פה, אחים.', 'phone']];
const STOPPED = [['ליאם', 'אחים... הם עוצרים. כולם.', 'phone'], ['ארז', 'הם לא רודפים אחרינו לנמל.'], ['עידו', 'כי הם רוצים שנגיע לשם.']];
const ARRIVE = [['עידו', 'הנמל השחור. נטוש, אבל משהו פה חי.'], ['נהוראי', 'כולם לעצור ליד השער.']];
const WRECKED = 'הרנו נפגעה יותר מדי. ארז: "לאט יותר בפניות, ולא לתת להם לדחוף אותך."';
const CRASHED = 'נסעת ישר לתוך המשאית. עידו: "אמרתי לך! כשהיא באה — לנתיב השני, השמאלי."';
const LEFT_CAR = 'השארת את הרנו מאחור. ארז: "בלי הרנו אין מבצע. חוזרים לאוטו."';
// the Order's cars stop chasing on the last stretch (metres along the highway): from STOP_AT, once the last car
// out of a side road has had its go at them and the chase behind is on, and past STOP_LAST whatever
const STOP_AT = 945, STOP_LAST = 985;

// metres along each of the three roads, and how far off it, for the Renault
function where(game) {
  const r = D(game), c = game.car.pos, R = r.roads;
  return { main: R.main.nearest(c.x, c.z), tunnel: R.tunnel.nearest(c.x, c.z), dirt: R.dirt.nearest(c.x, c.z) };
}
// a point on a road at s, `lane` metres right of its centreline
function onRoad(road, s, lane = 0) { const p = road.at(s); return { x: p.x + p.nx * lane, z: p.z + p.nz * lane, y: p.h, yaw: Math.atan2(p.tx, p.tz), s }; }

function clearLive(m, game) {
  m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; game.hud.setPursuit(null);
  m.truck?.dispose(); m.truck = null;
  for (const v of Object.values(m.rivals || {})) v.dispose(); m.rivals = {};
  for (const b of m.live || []) b.cancel(); m.live = [];
  m.chat?.clear();
  game.fx.clear();
  clock(game, null);
}
// the Renault at a spot on the road with Erez and Ido in it, the two other cars behind on the road, the
// friends in them, and the convoy following from there
function stageAt(m, game, at, parked, trail) {
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  game.car.repair(); game.car.place(at.x, at.z, at.yaw, at.y);
  game.player.place(at.x + Math.cos(at.yaw) * 2, at.z - Math.sin(at.yaw) * 2, at.yaw, at.y);
  game.enterCar();
  const cars = gangCars(game);
  parkGangCars(game, parked);
  boardAll(game);
  armGang(game); // each his own marker from the safe house's rack (a fresh page: given again)
  game.squad.dismiss(); // they ride; the squad forms again on foot at the port
  m.convoy = new Convoy(game, cars, { behind: trail });
}
// the start in the safe house's yard: the Renault in its bay, the two cars in theirs
function stageYard(m, game) {
  const h = H(game);
  stageAt(m, game, { ...h.car, y: h.y }, h.cars.map((c) => ({ ...c, y: h.y })), []); // they drive out of their bays after it
}
// on the highway at s: the two cars 17 and 34 metres behind in the right lane
function stageRoad(m, game, s) {
  const R = D(game).roads.main, L = D(game).lanes.main;
  const back = [onRoad(R, s - 17, L), onRoad(R, s - 34, L)];
  stageAt(m, game, onRoad(R, s, L), back, [onRoad(R, s - 40, L), ...back.slice().reverse(), onRoad(R, s - 6, L)]);
}
// the Order's cars behind them; `again`: they had been lost (or this is a retry on the last stretch) and come back
function startChase(m, game, grace = 3, { again = false } = {}) {
  if (m.pursuit && !m.pursuit.over) return;
  if (m.pursuit) { m.pursuit.dispose(); m.pursuit = null; }
  m.pursuit = new Pursuit(game, { grace, cars: 2, gap: 9, colors: ORDER_COLORS, lines: {}, bonus: 0, radio: false });
  m.s.joined = 0; m.s.health = game.car.health; m.s.again = again; m.s.lostSaid = false;
}
function rival(m, game, name) {
  if (m.rivals[name] || m.s.rivalDone?.[name]) return;
  const j = D(game).joins.find((q) => q.name === name);
  const v = m.rivals[name] = new Rival(game, j, { color: ORDER_COLORS[(Object.keys(m.rivals).length) % ORDER_COLORS.length] });
  v.go();
  line(m, game, CUT[name]);
}
// a line that matters now: at once (the chatter it cuts short is said after it), unless the lorry's three
// lines are on (those are never cut: it goes first in the queue behind them)
function line(m, game, lines) { if (m.s.truckSaid && !m.s.truckLines) m.chat.add(lines, { soon: true }); else m.chat.now(lines); }

// every frame of the drive, whichever step: the convoy, the lines, the chasers, the rivals out of the side
// roads, the things by the road, the charges on it, the jumps
function drive(m, game, dt, q) {
  const r = D(game);
  m.convoy?.update(dt);
  m.chat.update(dt);
  // the chasers behind: their own lines, never over a story line
  const p = m.pursuit;
  if (p) {
    p.update(dt);
    const chasing = () => !m.s.stopped; // (said late, after they have stopped, these would be wrong: let go)
    if (p.joined > m.s.joined) { m.chat.add(m.s.joined ? MORE : m.s.again ? AGAIN : CHASE, { radio: true, valid: chasing }); m.s.joined = p.joined; }
    const c = p.chase;
    if (c && !c.over && !game.dialogue.busy) {
      if (c.nearest < 20 && m.t - (m.s.closeT ?? -99) > 14) { m.s.closeT = m.t; m.chat.add(CLOSE[Math.floor(m.t) % CLOSE.length], { valid: chasing }); }
      if (game.car.health < m.s.health - 7 && m.t - (m.s.hitT ?? -99) > 9) { m.s.hitT = m.t; m.chat.add(HIT[Math.floor(m.t) % HIT.length], { valid: chasing }); }
    }
    m.s.health = game.car.health;
    if (p.over && p.escaped && !m.s.lostSaid && !m.s.stopped) { m.s.lostSaid = true; m.chat.add(LOST, { valid: chasing }); }
  }
  if (m.s.stopped) for (const ch of m.pursuit?.chase?.chasers || []) if (Math.abs(ch.car.speed) > 0.1) ch.car.update(dt, { brake: 1 }); // they pull up
  for (const v of Object.values(m.rivals)) v.update(dt);
  for (const [k, v] of Object.entries(m.rivals)) if (v.phase === 'done' && !m.convoy?.seen(v.car)) { v.dispose(); delete m.rivals[k]; m.s.rivalDone = { ...m.s.rivalDone, [k]: true }; }
  // the things beside the road go up as the Renault passes them (cinema, never on the road)
  const at = { main: q.main, tunnel: q.tunnel, dirt: q.dirt };
  for (const b of r.blasts) {
    const qq = at[b.road];
    if (game.car.speed > 4 && !m.s.blown.has(b) && qq.d < 14 && Math.abs(qq.s - b.s) < 16) { m.s.blown.add(b); m.live.push(new Blast(game, { at: b, size: b.size, warn: 0.5, radius: 0, fire: 18, hurts: false, quiet: true })); }
  }
  // charges on the road: a red ring in the Renault's own lane well ahead, beeps, then the blast; a lane
  // change takes it clear, staying in it costs a dent
  for (const ch of m.charges) {
    if (ch.set) continue;
    const road = r.roads[ch.road], qq = at[ch.road];
    if (qq.d > 9 || qq.s < ch.s - 58 || qq.s > ch.s - 30) continue;
    ch.set = true;
    const p0 = road.at(qq.s), lat = (game.car.pos.x - p0.x) * p0.nx + (game.car.pos.z - p0.z) * p0.nz, pt = road.at(ch.s);
    const spot = { x: pt.x + pt.nx * lat, z: pt.z + pt.nz * lat, y: pt.h };
    m.live.push(new Blast(game, { at: spot, size: 1.8, warn: 2.4, radius: 3.4, fire: 8, hurts: false, onBoom: () => {
      if (game.mode === 'car' && Math.hypot(game.car.pos.x - spot.x, game.car.pos.z - spot.z) < 4.2) { game.car.hurt(14); game.carCam?.shake(1.1); game.hud.toast('ספגנו את ההדף!', 1400); }
    } }));
    line(m, game, CHARGE[m.s.charges++ % CHARGE.length]);
  }
  for (const b of m.live) b.update(dt);
  m.live = m.live.filter((b) => !b.done);
  // a jump: the car took off a ramp (the vehicle counts its launches)
  const launches = game.car.launches || 0;
  if (m.s.launchSeen === undefined) m.s.launchSeen = launches;
  // (one jump however many times the wheels leave the ramp's steps: a second within two seconds is the same one)
  if (launches > m.s.launchSeen) { m.s.launchSeen = launches; if (m.t - (m.s.jumpT ?? -9) > 2) { m.s.jumps++; game.hud.toast('קפיצה!', 1200); m.chat.add(JUMP[(m.s.jumps - 1) % JUMP.length]); } m.s.jumpT = m.t; }
}

// (the second is said and gone before the fork's lines, and short of the fork's checkpoint: a retry there starts clear of it)
const CHARGES = [{ road: 'main', s: 262 }, { road: 'main', s: 340 }, { road: 'tunnel', s: 240 }, { road: 'main', s: 655 }, { road: 'dirt', s: 330 }, { road: 'main', s: 960 }];
function fresh(m, game) {
  m.s = { blown: new Set(), charges: 0, jumps: 0, launchSeen: undefined, joined: 0, health: game.car.health, rivalDone: {}, route: null, truckDone: false, dodged: false, crash: false, introSaid: false, truckSaid: false, barrierSaid: false, forkSaid: false, galSaid: false, ditchSaid: false, rejoinSaid: false, stopped: false, arrived: false, lostSaid: false };
  m.charges = CHARGES.map((c) => ({ ...c, set: false }));
}

export default {
  id: 'deathroad', chapter: 9, number: 2, title: 'מרדף בכביש המוות', requires: ['phoenix'], follows: true,
  where: 'בחצר של בית המסתור',
  startAt: (game) => { const c = game.world.places.safehouse?.car; return c ? { x: c.x, z: c.z, y: c.y } : null; },
  reward: { money: 900, unlocks: ['deathroad'], text: 'הגעתם לנמל השחור · 900 ₪' },

  setup(m, game) {
    m.live = []; m.rivals = {}; m.chat = new Chatter(game);
    fresh(m, game);
    game.daylight?.set(1, 0);
    D(game).closure.open();
    const h = H(game), ready = game.mode === 'car' && near(game.car.pos, h.car, 60) && game.npc('ido').inCar === game.car && TEAM.every((id) => game.npc(id).inCar);
    if (ready) { game.squad.dismiss(); m.convoy = new Convoy(game, gangCars(game), { behind: h.cars.map((c) => ({ x: c.x, z: c.z })).reverse() }); } // straight on from the safe house
    else stageYard(m, game);
    game.sound?.music?.('action');
  },
  tick(m, game) { calm(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const h = H(game); game.daylight?.set(1, 0); game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y); game.start(h.car.x - 2, h.car.z, h.car.yaw); },
  failIf(m, game) {
    if (m.s.crash) return CRASHED;
    if (game.mode === 'car' && game.car.disabled) return WRECKED;
    if (game.mode === 'foot' && Math.hypot(game.player.pos.x - game.car.pos.x, game.player.pos.z - game.car.pos.z) > 60) return LEFT_CAR;
    return null;
  },
  restore(m, game, checkpoint) {
    const r = D(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    clearLive(m, game);
    game.fx.resetAtmosphere();
    r.closure.open();
    game.daylight?.set(1, 0);
    fresh(m, game);
    if (checkpoint === 0) stageYard(m, game);
    else {
      const cp = r.checkpoints[checkpoint >= 3 ? 2 : 1];
      stageRoad(m, game, cp.s);
      m.s.truckDone = m.s.dodged = m.s.introSaid = m.s.truckSaid = m.s.truckLines = m.s.barrierSaid = true;
      m.s.rivalDone = { j1: true, j2: true };
      for (const b of r.blasts) if (b.route === 'common' && b.s < cp.s - 10) m.s.blown.add(b);
      for (const ch of m.charges) if (ch.road === 'main' && ch.s < cp.s) ch.set = true;
      if (checkpoint < 3) startChase(m, game, 2.5);
      else { m.s.rivalDone = { j1: true, j2: true, j3: true, j5: true }; m.s.rejoinSaid = true; game.fx.rain(true, { strength: 0.6 }); startChase(m, game, 1, { again: true }); } // still on their tail
    }
    game.sound?.music?.('action');
  },
  cleanup(m, game) {
    const r = D(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    clearLive(m, game);
    m.convoy = null;
    r.closure.open();
    if (!m.done || !handsTo(game, 'blackport')) { game.fx.resetAtmosphere(); unboardAll(game); endCrew(game); dropGangCars(game); }
    else {
      // at the gate: the two cars park beside the Renault (the next mission steps out of them)
      const p = PORT(game);
      if (p) parkGangCars(game, [{ ...p.parking[1], y: p.y }, { ...p.parking[2], y: p.y }]);
      game.sound?.music?.(null);
    }
  },

  steps: [
    { // 0: out of the yard and up the long straight: the lorry head-on, a car out of the side road
      objective: 'כביש המוות · לצאת מהחצר ולנסוע צפון-מזרחה', checkpoint: true,
      target(m, game) {
        const r = D(game), q = r.roads.main.nearest(game.car.pos.x, game.car.pos.z);
        if (game.mode !== 'car') return { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 };
        const p = onRoad(r.roads.main, Math.min(r.fork.s - 40, Math.max(12, q.s) + 70), r.lanes.main); return { ...p, r: 6 };
      },
      update(m, game, dt) {
        const r = D(game), q = where(game), s = q.main.s, onMain = q.main.d < 14;
        drive(m, game, dt, q);
        if (!m.s.introSaid && m.t > 0.8) { m.s.introSaid = true; m.chat.add(INTRO); }
        if (!m.s.barrierSaid && onMain && s > 30 && s < 100) { m.s.barrierSaid = true; game.hud.toast('מחסום לפניכם · לעבור בפרצה באמצע', 2200); }
        // the lorry: down the straight in their own lane, against them
        const run = r.truckRuns[0];
        if (!m.truck && !m.s.truckDone && game.mode === 'car' && onMain && s > 24) {
          m.truck = new Truck(game, run, { speed: 12 });
          m.s.truckSaid = true; m.chat.clear();
          const live = attempt(game, m);
          game.dialogue.play(TRUCK).then(() => { if (live()) m.s.truckLines = true; });
        }
        if (m.truck) {
          m.truck.update(dt);
          const ts = r.roads.main.nearest(m.truck.pos.x, m.truck.pos.z).s;
          if (!m.s.crash && !m.s.dodged && m.truck.hits(game.car) && game.car.speed + m.truck.car.speed > 9) { // head-on (a bump at a crawl is only a dent)
            m.s.crash = true;
            game.car.hurt(100); game.carCam?.shake(1.6); game.sound?.hit?.('crash', 1); game.fx.sparks(game.car.pos.x, game.car.pos.y + 1, game.car.pos.z, 30);
            game.hud.banner('', 'התנגשות', 'המשאית', 1800);
          }
          if (!m.s.dodged && !m.s.crash && ts < s - 9) { m.s.dodged = true; m.s.truckDone = true; m.chat.add(DODGED); game.hud.toast('חמקתם מהמשאית!', 1800); }
          if (m.s.dodged && s - ts > 120) { m.truck.dispose(); m.truck = null; }
        }
        // a black car out of the side road on the left, to cut them off (once the lorry is behind them)
        if (m.s.dodged && onMain && s > r.joins[1].s - 105 && s < r.joins[1].s + 25) rival(m, game, 'j2');
        // the Order's cars behind, once the lorry is behind them too
        if (m.s.dodged && onMain && s > 245) startChase(m, game, 3);
        say(m, game, game.mode !== 'car' ? 'לרנו!' : m.truck && !m.s.dodged ? 'משאית מולכם בנתיב! לעבור לנתיב השמאלי!' : m.rivals.j2 && m.rivals.j2.phase === 'cut' ? 'רכב שחור חוסם · לעקוף אותו' : m.pursuit?.active ? 'הם מאחוריכם · להמשיך לצומת' : s < 105 ? 'כביש המוות · דרך הפרצה במחסום' : 'כביש המוות · צפון-מזרחה, לצומת');
        return onMain && s > r.checkpoints[1].s - 8 ? 'next' : null;
      },
      exit(m, game) { if (m.truck) { m.truck.dispose(); m.truck = null; } m.s.truckDone = true; },
    },
    { // 1: the fork: three ways to the port
      objective: 'הצומת · לבחור דרך לנמל', checkpoint: true,
      enter(m, game) {
        if (!m.s.forkSaid) { m.s.forkSaid = true; m.chat.now(FORK); }
        game.hud.banner('צומת', 'שלוש דרכים', 'המנהרות ← · ישר הכביש הראשי · דרך העפר →', 2800);
        startChase(m, game, 2.5);
      },
      target(m, game) { const f = D(game).fork; return { x: f.x, z: f.z, y: f.y, r: 8 }; },
      update(m, game, dt) {
        const r = D(game), q = where(game);
        drive(m, game, dt, q);
        const ra = r.routeAt(game.car.pos.x, game.car.pos.z), u = r.underpass;
        // the short tunnel before the fork: every way goes through it
        // (after the fork's lines, and only while the Renault is still under its roof: never on the open road)
        if (u && !m.s.underSaid && q.main.d < 8 && q.main.s > u.s0 - 4 && q.main.s < u.s1) {
          m.s.underSaid = true;
          m.chat.add(UNDER, { soon: true, valid: () => { const c = D(game).roads.main.nearest(game.car.pos.x, game.car.pos.z); return c.d < 8 && c.s < u.s1 - 3; } });
        }
        say(m, game, u && q.main.d < 8 && q.main.s > u.s0 && q.main.s < u.s1 ? 'במנהרה · הצומת ביציאה ממנה' : 'הצומת · לבחור: המנהרות משמאל, ישר הכביש הראשי, דרך העפר מימין');
        if (ra && ra.route !== 'common') {
          m.s.route = ra.route;
          if ((ra.route === 'main' && q.main.s > r.fork.s + 30) || (ra.route === 'tunnel' && q.tunnel.s > 30) || (ra.route === 'dirt' && q.dirt.s > 30)) return 'next';
        }
        return null;
      },
    },
    { // 2: the way they took (they may change it on the way: the connecting road)
      objective: 'הדרך לנמל',
      enter(m, game) {
        const r = D(game), route = m.s.route || 'main', ahead = { main: r.roadblocks.find((b) => b.kind === 'truck').s - 15, tunnel: r.gallery.s0 - 15, dirt: r.ditch.s - 45 }[route];
        m.chat.add(ROUTE[route], { soon: true, valid: () => { const c = r.roads[route].nearest(game.car.pos.x, game.car.pos.z); return c.d < 12 && c.s < ahead; } });
      },
      target(m, game) {
        const r = D(game), route = m.s.route || 'main', pts = r.pathFrom(route, game.car.pos.x, game.car.pos.z), p = pts[Math.min(pts.length - 1, 24)];
        return { x: p.x, z: p.z, r: 6 };
      },
      update(m, game, dt) {
        const r = D(game), q = where(game), ra = r.routeAt(game.car.pos.x, game.car.pos.z);
        drive(m, game, dt, q);
        if (ra && ra.route !== 'common') m.s.route = ra.route;
        const route = m.s.route;
        // each way has its own: a car out of a side road; the gallery; the ditch
        if (route === 'main' && q.main.d < 12 && q.main.s > r.joins[2].s - 110 && q.main.s < r.joins[2].s - 30) rival(m, game, 'j3');
        if (route === 'dirt' && q.dirt.d < 10 && q.dirt.s > r.ditch.s + 8 && q.dirt.s < r.joins[4].s - 20) rival(m, game, 'j5');
        const onTunnel = (s0, s1) => () => { const c = r.roads.tunnel.nearest(game.car.pos.x, game.car.pos.z); return c.d < 8 && c.s > s0 && c.s < s1; };
        if (route === 'tunnel' && !m.s.galSaid && q.tunnel.d < 8 && q.tunnel.s > r.gallery.s0 - 10) { m.s.galSaid = true; m.chat.add(GALLERY, { soon: true, valid: onTunnel(r.gallery.s0 - 12, r.gallery.s1 - 25) }); }
        const bar = r.roadblocks.find((b) => b.kind === 'barriers' && b.road === 'tunnel').s;
        if (route === 'tunnel' && !m.s.barSaid2 && q.tunnel.d < 8 && q.tunnel.s > 40 && q.tunnel.s < bar) { m.s.barSaid2 = true; m.chat.add(BARRIER, { soon: true, valid: onTunnel(0, bar - 6) }); }
        const inDitch = route === 'dirt' && q.dirt.d < 9 && Math.abs(q.dirt.s - r.ditch.s) < r.ditch.half + 1 && game.car.pos.y < r.ditch.top - 1.2;
        if (inDitch && !m.s.ditchSaid) { m.s.ditchSaid = true; line(m, game, DITCH); }
        say(m, game, route === 'tunnel' ? (q.tunnel.s > r.gallery.s0 && q.tunnel.s < r.gallery.s1 ? 'במנהרה · ישר, בין העמודים' : 'דרך המנהרות · דרך הפרצה במחסום, אל המנהרה') : route === 'dirt' ? (inDitch ? 'בתעלה · לטפס החוצה בצד ולהמשיך' : q.dirt.s < r.ditch.s ? 'דרך העפר · גז מלא על הרמפה, מעל התעלה' : 'דרך העפר · עד החיבור לכביש הראשי') : 'הכביש הראשי · משאית בנתיב הימני, רמפות בשמאלי');
        return ra?.route === 'common' && q.main.d < 12 && q.main.s > r.rejoin.s - 6 ? 'next' : null;
      },
    },
    { // 3: the last stretch, the first rain, the gate of the abandoned port
      objective: 'אל הנמל השחור · עד השער', checkpoint: true,
      enter(m, game) {
        if (!m.s.rejoinSaid) { m.s.rejoinSaid = true; m.chat.add(REJOIN, { valid: () => !m.s.stopped }); } // (the stop's lines go first)
        if (!game.fx.raining) game.fx.rain(true, { strength: 0.6, seconds: 4 });
        // lost on the way, they find them again on the last stretch (the stop short of the port needs them behind)
        startChase(m, game, 1.5, { again: true });
        game.fx.lightning({ delay: 2, strength: 0.4 });
      },
      target(m, game) { const e = D(game).end; return { x: e.x, z: e.z, y: e.y, r: e.r }; },
      update(m, game, dt) {
        const r = D(game), q = where(game), e = r.end, s = q.main.s;
        drive(m, game, dt, q);
        if (q.main.d < 12 && s > r.joins[3].s - 95 && s < r.joins[3].s - 25) rival(m, game, 'j4');
        // the chasers suddenly stop short of the port: once the last car out of a side road has had its go and
        // the chase behind is on (at the latest a little before the gate)
        const cutting = Object.values(m.rivals).some((v) => v.phase === 'out' || v.phase === 'cut');
        if (!m.s.stopped && s > STOP_AT && (s > STOP_LAST || (!cutting && m.pursuit?.phase !== 'grace'))) {
          m.s.stopped = true;
          const behind = !!m.pursuit?.active || Object.values(m.rivals).some((v) => v.phase === 'cut' || v.phase === 'chase');
          if (m.pursuit) { if (m.pursuit.chase && !m.pursuit.chase.over) m.pursuit.chase.end(false); m.pursuit.phase = 'done'; game.alert.chasing = false; game.hud.setPursuit(null); }
          for (const v of Object.values(m.rivals)) if (v.phase !== 'wait') v.phase = 'done';
          if (behind) m.chat.now(STOPPED, { radio: true });
        }
        const close = Math.hypot(game.car.pos.x - e.x, game.car.pos.z - e.z);
        if (!m.s.arrived && m.s.stopped && close < 60) { m.s.arrived = true; m.chat.add(ARRIVE, { soon: true }); }
        say(m, game, close < 40 ? `לעצור מול שער הנמל${Math.abs(game.car.speed) > 3 ? ' · לבלום' : ''}` : 'אל הנמל השחור · עד השער');
        return close < e.r && Math.abs(game.car.speed) < 3 && m.s.arrived && !m.chat.queue.length && !game.dialogue.busy ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
