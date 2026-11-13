// Chapter ten, mission 3, "המלחמה הגדולה". The Shadow's citadel from the service gate to the central tower, in the
// spec's six numbered goals, each a different kind of challenge: (1) the entrance: Muller opens the service gate's
// lock, a paint fight in the yard inside it, then the watch tower beside the gate, taken with an order to the squad
// ("תחפו עליי!": Erez keeps the men up there pinned while Nehorai climbs); (2) the alarm, which calls a fresh pair
// of the Order every little while until it is off: its fuse cut in store three (Dolev and Avraham hold the door),
// then the panel in the alarm room; (3) the freight lift: its power switch in store one, the lift called up, the
// gang aboard and down into the tunnels (Hadar and Yonati stay up and watch the shaft); (4) through the tunnels and
// up behind the inner gate: Ido at one wheel, Nehorai at the other, both needed; a patrol half-way, held off, then
// the turn finished, and Hadar and Yonati come through; (5) control room B: Muller at the computer while the
// others hold three ways in, the Order coming by a different one each time (a marked Muller wipes it off and goes
// on: it never fails); (6) across the inner compound between the energy plants' pylons, which discharge on a
// rhythm with a warning, up the plant house, over the bridges at +7 to the tower's door. Mission 50 goes on inside.
// Paint, never blood: a marked man sits down; every discharge warns before it strikes. The whole gang stays loyal;
// every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { say } from './missions.js';
import { OUT_AT, COLORS } from '../combat/paint.js';
import { Work } from './phoenix.js';
import { FloorJob, post, offBoard, standing, nearestOf, freshMarks, beats, later, talkOn, gangAt } from './phoenix-d.js';
import {
  TEAM, NAMES, handsTo, endCrew, dropGangCars, parkGangCars, unboardAll, hush, gateSpots, standAtGate, atGate, LR,
  hurt, holdBuddies, armAll, CIT, redSky, citadelReset, standAt, towerDoorSpots,
} from './infinity-a.js';

// the six goals, word for word as the user wrote them (the spec's list "משימות בתוך המצודה")
const GOALS = ['1. להשתלט על הכניסה.', '2. להשבית את מערכת האזעקה.', '3. להפעיל מעלית משא.', '4. לעזור לעידו לפתוח שער.', '5. להגן על מולר בזמן שהוא ניגש למחשב.', '6. להגיע למגדל המרכזי.'];
const ORDER = Array.from({ length: 18 }, (_, i) => `og${i + 1}`);
const ENTRY = ['og1', 'og2', 'og3', 'og4'];          // goal 1: in the yard inside the service gate
const WATCH = ['og5', 'og6'];                         // goal 1: on the south-west watch tower (its landing, its post)
const ALARM = ['og7', 'og8', 'og9', 'og10'];          // goal 2: the alarm room, its door, the fuse room, the stores' front
const PAIRS = [['og11', 'og12'], ['og13', 'og14'], ['og15', 'og16']]; // goal 2: what the alarm calls, a pair at a time
const POWER = ['og1'];                                // goal 3: in store one with the lift's switch
const SHAFT = ['og17', 'og18'];                       // goal 3: two at the shaft while the lift goes down
const TUNNEL = ['og2', 'og3'];                        // goal 4: in the tunnels
const PATROL = ['og4', 'og5', 'og6'];                 // goal 4: the patrol half-way through the turn
const WAVES = [['og7', 'og8', 'og9'], ['og10', 'og11', 'og12'], ['og13', 'og14', 'og15']]; // goal 5
const WAVE_FROM = [1, 2, 0];                          // the approach each wave comes by: south, east, west
const WAVE_AT = [0.05, 0.38, 0.7];                    // ...when Muller's bar is that far
const ROOFS = ['og16', 'og17'];                       // goal 6: the control room's roof and bridge A
const RIDERS = TEAM.filter((id) => id !== 'hadar' && id !== 'yonati');
const SHAFT_WATCH = ['hadar', 'yonati'];
const PAIR_EVERY = 17;    // seconds between the pairs the alarm calls
const TURN_TIME = 14;     // seconds of both wheels turning
const HACK_TIME = 46;     // seconds of Muller at the computer
const CYCLE = 4.6, WARN = 1.3, LIVE = 1.0; // the pylons: a row warns, discharges, rests; the other row half a cycle later

// ---------- the lines (none of this mission's are the spec's: the spec gives its six goals) ----------
const INTRO = [['נהוראי', 'זהו, חבר’ה. נכנסים ביחד, יוצאים ביחד.'], ['מולר', 'שער השירות נעול. תנו לי כמה שניות עם המנעול.'], ['ארז', 'ואנחנו מחפים עליך. כמו תמיד.']];
const GATE_OPEN = [['מולר', 'פתוח. אחריכם, רבותיי.'], ['עידו', 'הם ראו אותנו! למחסה!']];
const TOWER_CALL = [['ארז', 'נשארו שניים על מגדל השמירה. תן פקודה לחפות — ואני מוריד להם את הראש.']];
const COVERING = [['ארז', 'מחפים! רוץ למדרגות, אחי.']];
const ENTRY_DONE = [['ארז', 'הכניסה שלנו!'], ['יונתי', 'ראשון בפנים. שמישהו ירשום.']];
const ALARM_ON = [['קול ברמקול', 'פריצה בשער השירות. כל הכוחות לחצר.'], ['מולר', 'אזעקה. כל עוד היא פועלת, יגיעו עוד ועוד מהם.'], ['מולר', 'היא מגובה בנתיך במחסן שלוש. קודם לחתוך את הנתיך, ואז לכבות אותה בלוח שבחדר הבקרה.']];
const DOOR_HOLD = [['דולב', 'אני ואברהם על הדלת של המחסן. אף אחד לא נכנס.'], ['אברהם', 'חוץ מאיתנו. אנחנו כבר בפנים.']];
const FUSE_CUT = [['מולר', 'הנתיך חתוך. עכשיו הלוח, בחדר הבקרה בצד המערבי של החצר.']];
const PAIR_LINES = [[['ליאם', 'אחים, עוד שניים מגיעים!']], [['הדר', 'Bro, עוד זוג! האזעקה הזאת לא נגמרת!']], [['עידו', 'עוד שניים. תכבו כבר את הדבר הזה!']]];
const ALARM_OFF = [['מולר', 'שקט. אני אוהב שקט.'], ['ליאם', 'אחים, שומעים? אף אחד לא בא.']];
const LIFT_START = [['מולר', 'המעלית למטה ובלי חשמל. המתג במחסן אחת.']];
const POWER_ON = [['מולר', 'יש חשמל. עכשיו לקרוא לה למעלה.']];
const LIFT_UP = [['הדר', 'Bro, אני ויונתי נשארות... נשארים פה. שומרים על הפיר.'], ['יונתי', 'אף אחד לא יורד אחריכם. מבטיח.']];
const SHAFT_COME = [['הדר', 'שניים באים לפיר!']];
const SHAFT_DONE = [['יונתי', 'סימנתי אחד! ראשון!'], ['הדר', 'והשני שלי. סעו, אנחנו פה.']];
const TUNNELS = [['עידו', 'המנהרות. מכאן אני מוביל: היציאה הצפונית עולה ממש מאחורי השער הפנימי.'], ['דולב', 'חושך, צינורות וריח של שמן. בדיוק כמו בחלומות שלי.']];
const WHEELS = [['עידו', 'שני גלגלים, אחד לכל צד. אני בשמאלי — אתה בימני. רק ביחד הוא זז.']];
const PATROL_CALL = [['עידו', 'סיור! מהחצר הפנימית! עזוב את הגלגל ותעצור אותם!']];
const PATROL_DONE = [['עידו', 'נקי. חזרה לגלגלים, ביחד!']];
const GATE_UP = [['עידו', 'השער למעלה!'], ['הדר', 'Bro! חיכינו בחוץ כמו שני עציצים.'], ['יונתי', 'אבל ראשונים שעברו בשער — אנחנו.']];
const CONTROL = [['מולר', 'חדר בקרה ב. המחשב הראשי שם. תנו לי דקה בפנים.'], ['ארז', 'שלוש כניסות. אני על המערבית.'], ['עידו', 'אני על המזרחית. אברהם, דולב — הדרומית.']];
const WAVE_CALL = [[['אברהם', 'מהדרום! שלושה!']], [['עידו', 'מהמזרח! אני רואה אותם!']], [['ארז', 'מהמערב, אחי! אצלי!']]];
const MULLER_WIPE = [['מולר', 'צבע על המסך. יופי. ממשיך.']];
const HACKED = [['מולר', 'יש לי את המצודה. הדלת הראשית של המגדל אטומה מבפנים — אבל את הדלת של אולם האנרגיה, בגובה שבעה מטר, פתחתי.'], ['מולר', 'רק דבר אחד: עמודי המתח בחצר פורקים חשמל. בין השורות עוברים בזמן.']];
const PYLONS = [['ארז', 'תסתכל על הקווים על הרצפה: כשהם מהבהבים, זה עומד לפרוק. עוברים כשהם כבים.'], ['ליאם', 'ואם זה פוגע?'], ['ארז', 'אז זה מדגדג. מאוד.']];
const RUN_NOW = [[['ארז', 'עכשיו! רוץ!']], [['ארז', 'כבה! עבור!']], [['ארז', 'עכשיו, אחי!']]];
const UP = [['עידו', 'במדרגות של בית המתקנים לגג, ומשם בגשרים.']];
const AT_DOOR = [['נהוראי', 'הנה הוא. המגדל.'], ['ארז', 'מה שלא יחכה לנו שם בפנים — ביחד.'], ['מולר', 'המכונה שלו למעלה. והוא כבר יודע שאנחנו פה.']];
// a fail has a reason and a tip
const TIPS = [
  'ארז: "מאחורי המכולות והמכוניות, אחי. ולמגדל — קודם פקודה לחפות, ואז לרוץ."',
  'מולר: "לא לעמוד באמצע החצר. הנתיך במחסן שלוש, הלוח בחדר הבקרה — ומהר, לפני שמגיע עוד זוג."',
  'עידו: "המחסנים צרים. לסמן אותם מהפתח, לא בפנים."',
  'עידו: "כשהסיור מגיע — מאחורי המחסה ליד השער, ורק אז לסמן."',
  'ארז: "לעמוד מאחורי שולחן ולשמור על הכניסה שהם באים ממנה."',
  'ארז: "לחכות שהקו על הרצפה יכבה, ואז לרוץ. ועל הגשרים — להוריד קודם את מי שעל הגג."',
];
const LOST = (i) => `נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ${TIPS[i]}`;

// ---------- places ----------
const Z = CIT;
const pt = (C, lx, lz, ly = 0, yaw) => ({ ...C.toWorld(lx, lz), y: C.y + ly, ...(yaw != null ? { yaw } : {}) });
const off = (p, dx, dz) => ({ ...p, x: p.x + dx, z: p.z + dz });
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sameFloor = (a, b) => Math.abs((a.y ?? 0) - (b.y ?? 0)) < 1.6;
// where each checkpoint begins (where the goal before it left the player)
function startAt(game, cp) {
  const C = Z(game);
  return [
    null,                                                      // the service gate (gateSpots)
    { ...C.gates.service.inside, yaw: Math.PI / 2 },           // inside the service gate
    { ...off(C.alarm.doorAt, 3, 0), yaw: Math.PI / 2 },        // out of the alarm room
    { ...C.lift.bottomAt, yaw: Math.PI / 2 },                  // the tunnels' lobby, out of the lift
    { ...C.innerGate.inside, yaw: Math.PI / 2 },               // behind the inner gate
    { ...C.control.approaches[1].inside, yaw: 0 },             // control room B, at its south door
  ][cp];
}
// the gang's posts in control room B (goal 5): Erez west, Ido east, Avraham and Dolev south
const POSTS = { erez: [0, 0], ido: [2, 0], avraham: [1, -0.9], dolev: [1, 0.9] };
// the route of goal 6 (one waypoint after another, each on its floor): round the plant house to its door, its
// stairs up, its roof, bridge C to the control room's roof, bridge A to the energy hall's door
function route6(game) {
  const C = Z(game), s = C.plant.stairs;
  return [pt(C, -26, 34), pt(C, -31, 34), { ...s.bottom }, { ...s.top }, { ...C.bridges.c[1] }, { ...C.bridges.c[0] }, { ...C.bridges.a[0] }, { ...C.energyHall.doorOutside }];
}
// the pylons by row (north z 146, south z 164), west to east
function rows(game) {
  const ps = Z(game).energy.pylons, z0 = Math.min(...ps.map((p) => p.z));
  const row = (n) => ps.filter((p) => (Math.abs(p.z - z0) < 4) === n).sort((a, b) => a.x - b.x);
  return [row(true), row(false)];
}

// ---------- the scene each checkpoint begins in ----------
function clearLive(m, game) {
  game.dialogue.stop();
  game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  m.beats?.cancel(); m.beats = null; m.talk = [];
  m.work?.cancel(); m.work = null; m.job?.cancel(); m.job = null;
  m.stopSiren?.(); m.stopSiren = null;
  game.energy?.clear();
  game.hud.setPursuit(null);
  game.squad.tasks.clear();
}
// the citadel as the story has it at checkpoint cp
function doors(game, cp) {
  const C = Z(game);
  C.gates.main.shut(); C.gates.main.lock();
  if (cp >= 1) C.gates.service.open(); else { C.gates.service.shut(); C.gates.service.lock(); }
  for (const d of [...C.stores.doors, C.alarm.door, ...C.control.doors]) { d.unlock(); d.setOpen(true); }
  C.alarm.on(false);
  C.lift.setPower(cp >= 3); C.lift.set('bottom'); // the lift waits below from the start (goal 3 calls it up)
  if (cp >= 4) C.innerGate.open(); else { C.innerGate.shut(); C.innerGate.lock(); }
  C.innerGate.spin(0, 0); C.innerGate.spin(1, 0);
  C.restore();
  for (const d of [C.mainHall.door, C.machine.upperDoor]) { d.setOpen(false); d.lock(); }
  if (cp >= 5) C.energyHall.door.unlock(); else C.energyHall.door.lock();
  C.energyHall.door.setOpen(false);
  for (const p of C.energy.pylons) p.set(true);
  C.computer.screen.show(cp >= 5 ? 'data' : 'map', cp >= 5 ? { progress: 1 } : {});
}
// the three cars where 48 left them, short of the service gate
function carsAtGate(game) {
  const S = gateSpots(game);
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  game.car.repair(); game.car.place(S.renault.x, S.renault.z, S.renault.yaw);
  parkGangCars(game, S.cars);
}
// the road behind as 48 left it: the bridge down and burning, the barricades lowered, the old truck gone
function roadBehind(game) {
  const R = LR(game);
  R.truck.clear(); for (const b of R.barricades) b.lower();
  if (!R.bridge.blown) R.bridge.blow({ fx: game.fx, boom: false });
}
// the two who watch the shaft, at their places by the lift's top gate, markers up toward the yard
function shaftWatch(game) {
  const C = Z(game), L = C.lift.topAt;
  SHAFT_WATCH.forEach((id, k) => {
    const n = standAt(game, id, { x: L.x + 2.6, z: L.z + (k ? 3.2 : -3.2), y: L.y }, { pose: 'aim' });
    n.lookAt(L.x + 10, L.z + (k ? 10 : -10));
    if (!game.paint.allies.some((a) => a.npc === n)) game.paint.addAlly(n, COLORS[id] || COLORS.ido);
  });
}
function stage(m, game, cp) {
  clearLive(m, game);
  game.fx.resetAtmosphere(); game.fx.clear?.();
  redSky(game);
  roadBehind(game);
  doors(game, cp);
  game.paint.dispose(); offBoard(game, ORDER);
  carsAtGate(game);
  if (game.playingAs !== 'nehorai') game.playAs('nehorai');
  hurt(game, true); holdBuddies(game, true);
  if (cp === 0) { standAtGate(game); gangAt(game, gateSpots(game).me, { ids: TEAM, walk: true }); }
  else gangAt(game, startAt(game, cp), { ids: cp === 3 ? RIDERS : TEAM });
  if (cp === 3) shaftWatch(game);
  freshMarks(game);
  game.sound?.music?.('epic', { fade: 0.6 });
  m.s = { cp, phase: null };
  m.wiping = new Map();
}

// ---------- the gang on its feet again ----------
// a friend marked sits down; after a few seconds Ido comes and pulls him up (Ido himself wipes it off). Muller at
// the computer in goal 5 wipes his own off quicker (that step counts him itself)
function upAgain(m, game, dt) {
  m.wiping ||= new Map();
  for (const a of game.paint.allies) {
    if (!a.marked) { m.wiping.delete(a); continue; }
    if (m.s.hacking && a.npc.id === 'muller') continue;
    const t = (m.wiping.get(a) || 0) + dt; m.wiping.set(a, t);
    if (t < 4.5) continue;
    a.marked = false; a.gun.visible = true; a.npc.body.enabled = false; if (a.npc.model.pose === 'down') a.npc.model.setPose(null);
    m.wiping.delete(a);
    game.hud.toast(a.npc.id === 'ido' ? 'עידו מנגב את הצבע וחוזר' : `עידו מרים את ${NAMES[a.npc.id] || a.npc.id}`, 1500);
  }
}
const allyOf = (game, id) => game.paint.allies.find((a) => a.npc === game.npc(id));
const marks = (game) => `סומנת ${game.paint.hits}/3`;
const goal = (i, sub) => (sub ? `${GOALS[i]} · ${sub}` : GOALS[i]);

// ---------- goal 2: what the alarm calls ----------
function callPair(m, game) {
  const C = Z(game), me = game.player.pos;
  const pair = PAIRS.find((p) => standing(game, p) === 0);
  if (!pair) return;
  const spots = [C.patrols.yardNW[0], C.patrols.yardNE[0], C.patrols.spine[0], C.patrols.containers[1], C.patrols.mainLane[1]].filter((p) => d2(p, me) > 26);
  const p = spots.sort((a, b) => d2(b, me) - d2(a, me))[0] || C.patrols.yardNW[0];
  post(game, pair.map((id, k) => ({ id, at: [off(p, k * 1.6, 0), off(p, k * 1.6 + 2, 2)], still: false })), { hot: true });
  m.s.pairs = (m.s.pairs || 0) + 1;
  game.hud.toast('האזעקה הזעיקה עוד שניים', 1600);
  later(m, PAIR_LINES[(m.s.pairs - 1) % PAIR_LINES.length]);
}
// ---------- goal 6: the pylons' discharges ----------
// each row of four pylons lays a beam from the inner wall to the first, from pylon to pylon, and from the last to
// the tower's wall: a line that blinks for WARN seconds, then the live beam for LIVE; the rows take turns
function discharge(game, row) {
  const E = game.energy, C = Z(game); if (!E) return;
  const y = C.y, g = 0.9;
  const shot = (from, angle, len) => E.beamSweep({ from: { x: from.x, z: from.z, y }, angle0: angle, angle1: angle, len, warn: WARN, seconds: LIVE, width: 0.9, height: 1.0, hit: 'both', knock: 2.2, label: 'פריקת מתח!' });
  shot({ x: row[0].x - g, z: row[0].z }, -Math.PI / 2, 22);
  for (let i = 0; i + 1 < row.length; i++) shot({ x: row[i].x + g, z: row[i].z }, Math.PI / 2, row[i + 1].x - row[i].x - 2 * g);
  shot({ x: row[row.length - 1].x + g, z: row[row.length - 1].z }, Math.PI / 2, 16);
}

export default {
  id: 'citadel', chapter: 10, number: 3, title: 'המלחמה הגדולה', requires: ['lastconvoy'], follows: true,
  where: 'בשער המצודה',
  startAt: (game) => { const R = game.world.places.lastRoad, f = R?.gates?.service?.far; return f ? { x: f.x, z: f.z, y: f.y } : null; },
  reward: { money: 1500, text: 'שש משימות במצודה · הגעתם למגדל המרכזי · 1,500 ₪' },

  setup(m, game) {
    m.s = { cp: 0 }; m.talk = []; m.wiping = new Map();
    if (atGate(game)) { // straight on from 48: the gang out of the cars at the gate, the red sky, the bandage, the bridge down
      game.squad.dismiss(); holdBuddies(game, true); armAll(game);
      doors(game, 0);
      offBoard(game, ORDER);
      gangAt(game, gateSpots(game).me, { ids: TEAM, walk: true });
      game.sound?.music?.('epic', { fade: 0.6 });
      m.s = { cp: 0, phase: null };
    } else stage(m, game, 0);
  },
  prepareReplay(game) { const S = gateSpots(game); if (game.mode === 'car') game.exitCar(); game.player.place(S.me.x, S.me.z, S.me.yaw); game.follow.snapBehind(S.me.yaw); },
  failIf(m, game) { return game.paint.hits >= OUT_AT ? LOST(m.stepIndex) : null; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) { hush(game); talkOn(m, game); upAgain(m, game, dt); },
  cleanup(m, game) {
    const carry = !!m.done && handsTo(game, 'fall');
    clearLive(m, game);
    offBoard(game, ORDER);
    if (carry) { game.paint.clearProps?.(); return; } // at the energy hall's door on bridge A, the gang with him, armed: 50 goes on inside
    game.fx.resetAtmosphere(); game.fx.clear?.(); game.daylight?.preset(null, { seconds: 0 });
    citadelReset(game);
    LR(game).reset();
    unboardAll(game); endCrew(game); dropGangCars(game);
    hurt(game, false); holdBuddies(game, false);
    game.sound?.music?.(null, { fade: 1 });
  },

  steps: [
    { // 0 · goal 1: the entrance. Muller opens the lock; the yard inside the gate; the watch tower, with an order
      objective: GOALS[0], checkpoint: true,
      enter(m, game) {
        const C = Z(game), G = C.gates.service, S = gateSpots(game);
        m.s.phase = 'scene';
        game.cutscene = true; game.hud.setCinematic(true);
        const r = S.renault;
        game.follow.shot({ x: r.x - Math.sin(r.yaw) * 3 + Math.cos(r.yaw) * 6, y: (G.outside.y ?? C.y) + 3.2, z: r.z - Math.cos(r.yaw) * 3 - Math.sin(r.yaw) * 6 }, { x: G.at.x, y: C.y + 3, z: G.at.z }, 9999);
        game.hud.banner('המצודה', GOALS[0], '', 2600);
        m.beats = beats(game, [['wait', 0.6], ['say', INTRO], ['do', () => {
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
          m.s.phase = 'lock';
          m.job = new FloorJob(game, { who: 'muller', at: { ...off(G.outside, -1.2, 2.2), yaw: Math.PI / 2 }, seconds: 5, near: 30, pill: 'מולר פותח את המנעול', onDone: () => {
            m.job = null; G.open(); game.sound?.hit?.('crash', 0.5);
            const P = C.patrols;
            post(game, [{ id: 'og1', at: P.gateService }, { id: 'og2', at: P.yardS }, { id: 'og3', at: P.bay }, { id: 'og4', at: [pt(C, -128, 80), pt(C, -116, 80)] }]);
            post(game, [{ id: 'og5', at: [C.towers[1].landing], yaw: Math.PI }, { id: 'og6', at: [C.towers[1].post] }]);
            for (const id of ENTRY) { const gd = game.paint.guards.find((x) => x.npc.id === id); if (gd) { gd.seen = 0.3; } }
            m.s.phase = 'yard'; later(m, GATE_OPEN);
          } });
        }]]);
      },
      target(m, game) {
        const C = Z(game), T = C.towers[1];
        if (m.s.phase === 'lock') return { ...C.gates.service.outside, r: 3 };
        if (m.s.phase === 'yard') return nearestOf(game, ENTRY) || { ...C.gates.service.inside, r: 2 };
        if (m.s.phase === 'order' || m.s.phase === 'climb') {
          const me = game.player.pos;
          if (me.y < T.landing.y - 0.8) return { ...T.foot, r: 1.4 };
          return nearestOf(game, WATCH) || { ...T.top, r: 1.2 };
        }
        return null;
      },
      update(m, game, dt) {
        const C = Z(game), s = m.s;
        m.beats?.update(dt);
        if (m.job) { const mu = game.npc('muller'); if (m.job.phase === 'go' && !mu.target) mu.walkTo(m.job.at.x, m.job.at.z, { run: true, near: 0.9 }); m.job.update(dt); }
        if (s.phase === 'yard' && !standing(game, ENTRY)) {
          if (!standing(game, WATCH)) s.phase = 'won';
          else { s.phase = 'order'; later(m, TOWER_CALL); }
        }
        if ((s.phase === 'order' || s.phase === 'climb') && !standing(game, WATCH)) s.phase = 'won';
        if (s.phase === 'order' && game.squad.mode === 'cover') { s.phase = 'climb'; s.ordered = true; later(m, COVERING); }
        // Erez covering (the squad on 'cover', Erez on his feet): his paint keeps the men up there down
        if (s.phase === 'climb' && game.squad.mode === 'cover' && !allyOf(game, 'erez')?.marked) {
          const e = game.npc('erez');
          s.pin = (s.pin || 0) - dt;
          for (const gd of game.paint.guards) {
            if (!WATCH.includes(gd.npc.id) || gd.marked) continue;
            gd.cool = Math.max(gd.cool, 0.6);
            if (s.pin <= 0) { s.pin = 0.8; s.pinned = (s.pinned || 0) + 1; game.paint.tracer(new THREE.Vector3(e.pos.x, e.pos.y + 1.35, e.pos.z), new THREE.Vector3(gd.npc.pos.x + (Math.random() - 0.5), gd.npc.pos.y + 1.6, gd.npc.pos.z + (Math.random() - 0.5)), COLORS.erez || '#3fa7ff'); }
          }
        }
        if (s.phase === 'won') { s.phase = 'done'; later(m, ENTRY_DONE); s.doneT = m.t; }
        const n = standing(game, ENTRY), w = standing(game, WATCH);
        say(m, game, s.phase === 'scene' ? GOALS[0]
          : s.phase === 'lock' ? goal(0, 'מולר פותח את המנעול · לחפות עליו')
          : s.phase === 'yard' ? goal(0, `לסמן את השומרים בחצר (${ENTRY.length - n}/${ENTRY.length}) · ${marks(game)}`)
          : s.phase === 'order' ? goal(0, 'לתת פקודה לצוות: "תחפו עליי!" (כפתור הפקודה)')
          : s.phase === 'climb' ? goal(0, `מגדל השמירה · לעלות ולסמן אותם (${WATCH.length - w}/${WATCH.length}) · ארז מחפה`)
          : goal(0, 'הכניסה שלנו'));
        return s.phase === 'done' && m.t - s.doneT > 0.5 && !game.dialogue.busy && !m.talk.length ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.job?.cancel(); m.job = null; game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); },
    },
    { // 1 · goal 2: the alarm. A pair every little while until it is off: the fuse in store three, the panel
      objective: GOALS[1], checkpoint: true,
      enter(m, game) {
        const C = Z(game), A = C.alarm;
        if (game.squad.mode !== 'follow') game.squad.command('follow', { quiet: true });
        freshMarks(game);
        A.on(true);
        game.fx.redAlert(true, { points: A.lights, id: 'citadel', at: C.yard.centre, r: 90 });
        m.stopSiren = game.sound?.siren?.(900) || null;
        game.hud.banner('המצודה', GOALS[1], '', 2400);
        post(game, [{ id: 'og7', at: C.patrols.alarmRoom }, { id: 'og8', at: C.patrols.alarmDoor }, { id: 'og9', at: C.patrols.fuseRoom }, { id: 'og10', at: C.patrols.storesFront }]);
        later(m, ALARM_ON);
        m.s.phase = 'fuse'; m.s.pairT = 8; m.s.pairs = 0;
        m.work = new Work(game, { at: A.fuseAt, seconds: 4, label: 'לחתוך את הנתיך', pill: 'חותך את הנתיך', near: 1.8, onDone: () => {
          m.s.phase = 'panel'; A.fuseLamp?.set?.('#2fd27a'); game.sound?.hit?.('crash', 0.4); later(m, FUSE_CUT);
          for (const id of ['dolev', 'avraham']) game.squad.release(id);
          m.work = new Work(game, { at: A.panelAt, seconds: 3, label: 'לכבות את האזעקה', pill: 'מכבה את האזעקה', near: 1.8, onDone: () => {
            m.s.phase = 'off'; A.on(false); game.fx.redAlert(false, { id: 'citadel' }); m.stopSiren?.(); m.stopSiren = null;
            game.hud.toast('האזעקה כבויה', 2000); later(m, ALARM_OFF);
          } });
        } });
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) {
        const C = Z(game), A = C.alarm, s = m.s, me = game.player.pos;
        const g = nearestOf(game, [...ALARM, ...PAIRS.flat()]);
        if (s.phase === 'fuse') return g && d2(g, me) < 12 ? g : { ...A.fuseAt, r: 1.1 };
        if (s.phase === 'panel') return g && d2(g, me) < 12 ? g : { ...A.panelAt, r: 1.1 };
        return g;
      },
      update(m, game, dt) {
        const C = Z(game), s = m.s, me = game.player.pos;
        m.work?.update(dt);
        // Dolev and Avraham hold the store's door while the fuse is cut
        if (s.phase === 'fuse' && !s.door && d2(me, C.stores.fronts[2]) < 16) {
          s.door = true; const f = C.stores.fronts[2];
          game.squad.send('dolev', { ...off(f, -1.8, -2.2), yaw: Math.PI }, { label: 'על הדלת' });
          game.squad.send('avraham', { ...off(f, 1.8, -2.2), yaw: Math.PI }, { label: 'על הדלת' });
          later(m, DOOR_HOLD);
        }
        if (s.phase !== 'off') { s.pairT -= dt; if (s.pairT <= 0) { s.pairT = PAIR_EVERY; callPair(m, game); } }
        const left = standing(game, [...ALARM, ...PAIRS.flat()]);
        say(m, game, s.phase === 'fuse' ? goal(1, `הנתיך במחסן 3 · דולב ואברהם על הדלת · ${marks(game)}`)
          : s.phase === 'panel' ? goal(1, `הלוח בחדר הבקרה · עוד ${left} מהם בחצר · ${marks(game)}`)
          : left ? goal(1, `האזעקה כבויה · לסמן את מי שנשאר (${left})`) : goal(1, 'האזעקה כבויה'));
        return s.phase === 'off' && !left ? 'next' : null;
      },
      exit(m, game) { m.work = null; for (const id of ['dolev', 'avraham']) game.squad.release(id); },
    },
    { // 2 · goal 3: the freight lift. The switch in store one, called up, aboard, down (Hadar and Yonati watch the shaft)
      objective: GOALS[2], checkpoint: true,
      enter(m, game) {
        const C = Z(game), L = C.lift;
        freshMarks(game);
        game.hud.banner('המצודה', GOALS[2], '', 2400);
        L.set('bottom'); L.setPower(false);
        post(game, [{ id: 'og1', at: C.patrols.powerRoom }]);
        later(m, LIFT_START);
        m.s.phase = 'power';
        m.work = new Work(game, { at: L.switchAt, seconds: 1.5, label: 'להפעיל את החשמל של המעלית', pill: 'מפעיל', near: 1.6, onDone: () => { L.setPower(true); m.s.phase = 'call'; later(m, POWER_ON); } });
      },
      interaction(m, game) {
        const C = Z(game), L = C.lift, s = m.s, me = game.player.pos;
        if (s.phase === 'power') return m.work?.interaction(game) || null;
        if (game.mode !== 'foot' || game.cutscene) return null;
        if ((s.phase === 'call' || s.phase === 'board' || s.phase === 'left') && L.state === 'bottom' && d2(me, L.topAt) < 2.6 && sameFloor(me, L.topAt)) return { label: 'לקרוא למעלית', priority: 6, run: () => { L.call('top'); s.called = true; game.sound?.beep?.(2, 660); } };
        if (s.phase === 'board' && L.state === 'top' && L.has(me)) return { label: 'לרדת למנהרות', priority: 6, run: () => {
          const spots = boardSpots(game);
          RIDERS.forEach((id, k) => { const n = game.npc(id); if (!L.has(n.pos)) n.place(spots[k].x, spots[k].z, Math.PI / 2, C.y); n.target = null; });
          L.go('down'); s.phase = 'ride'; s.rideT = 0;
          post(game, SHAFT.map((id, k) => ({ id, at: [off(C.patrols.spine[1], k * 2, 0), off(L.topAt, 8, k ? 4 : -4)], still: false })));
        } };
        return null;
      },
      target(m, game) {
        const C = Z(game), L = C.lift, s = m.s;
        if (s.phase === 'power') return nearestOf(game, POWER) || { ...L.switchAt, r: 1.0 };
        if (s.phase === 'call') return { ...L.topAt, r: 1.4 };
        if (s.phase === 'board') return L.state === 'top' ? { ...L.onTop, r: 2.2 } : { ...L.topAt, r: 1.4 };
        if (s.phase === 'ride') return { ...L.bottomAt, r: 1.6 };
        return null;
      },
      update(m, game, dt) {
        const C = Z(game), L = C.lift, s = m.s, me = game.player.pos;
        m.work?.update(dt);
        if (s.phase === 'call' && L.state === 'top') {
          s.phase = 'board'; s.boardT = 0;
          const spots = boardSpots(game);
          RIDERS.forEach((id, k) => game.squad.send(id, { ...spots[k], yaw: Math.PI / 2 }, { label: 'במעלית' }));
          SHAFT_WATCH.forEach((id, k) => game.squad.send(id, { x: L.topAt.x + 2.6, z: L.topAt.z + (k ? 3.2 : -3.2), yaw: -Math.PI / 2 }, { label: 'שומרים על הפיר' }));
          later(m, LIFT_UP);
        }
        if (s.phase === 'board') {
          s.boardT += dt;
          // a straggler who cannot find the gate is put on the platform after a while (nobody holds the lift up)
          if (s.boardT > 9) { const spots = boardSpots(game); RIDERS.forEach((id, k) => { const n = game.npc(id); if (!L.has(n.pos)) { n.target = null; n.place(spots[k].x, spots[k].z, Math.PI / 2, C.y); } }); }
          if (L.state === 'bottom' && s.called) s.called = false;
        }
        if (s.phase === 'ride') {
          s.rideT += dt;
          if (s.rideT > 1.2 && !s.shaftSaid) { s.shaftSaid = true; for (const gd of game.paint.guards) if (SHAFT.includes(gd.npc.id)) { gd.alerted = true; gd.foe = { pos: game.npc('hadar').pos, ally: allyOf(game, 'hadar'), yaw: 0 }; } later(m, SHAFT_COME); }
          // Hadar and Yonati mark the two who come to the shaft (if their own paint has not done it yet)
          if (s.rideT > 3.2 && standing(game, SHAFT)) {
            for (const gd of game.paint.guards) if (SHAFT.includes(gd.npc.id) && !gd.marked) game.paint.markGuard(gd, allyOf(game, gd.npc.id === 'og17' ? 'yonati' : 'hadar') || 'ally');
            later(m, SHAFT_DONE);
          }
          if (L.state === 'bottom' && !L.has(me) && me.y > L.top - 1) { s.phase = 'left'; }
          if (L.state === 'bottom' && L.has(me)) { s.phase = 'down'; s.downT = m.t; }
        }
        if (s.phase === 'left') { // he stepped off before it went: it comes up for him (the friends are already below)
          if (L.state === 'top' && L.has(me)) { L.go('down'); s.phase = 'ride'; }
        }
        say(m, game, s.phase === 'power' ? goal(2, `המתג במחסן 1 · ${marks(game)}`)
          : s.phase === 'call' ? goal(2, 'לקרוא למעלית')
          : s.phase === 'board' ? goal(2, L.state === 'top' ? 'לעלות על המשטח עם החבורה · הדר ויונתי שומרים על הפיר' : 'המעלית עולה')
          : s.phase === 'left' ? goal(2, L.state === 'top' ? 'לעלות על המשטח' : 'לקרוא למעלית בחזרה')
          : goal(2, 'יורדים למנהרות'));
        if (s.phase === 'down' && m.t - s.downT > 0.6 && !game.dialogue.busy) return 'next';
        return null;
      },
      exit(m, game) {
        const C = Z(game);
        m.work = null;
        for (const id of RIDERS) game.squad.release(id);
        for (const id of SHAFT_WATCH) game.squad.release(id);
        // below: the gang that rode down with him; up there the two who stay by the shaft
        game.squad.form(RIDERS, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
        offBoard(game, SHAFT);
        shaftWatch(game);
        void C;
      },
    },
    { // 3 · goal 4: through the tunnels; the inner gate's two wheels, Ido at one and Nehorai at the other
      objective: GOALS[3], checkpoint: true,
      enter(m, game) {
        const C = Z(game), P = C.patrols;
        freshMarks(game);
        game.hud.banner('המצודה', GOALS[3], '', 2400);
        post(game, [{ id: 'og2', at: P.tunCross }, { id: 'og3', at: P.tunNorth }]);
        later(m, TUNNELS);
        m.s.phase = 'tunnels'; m.s.p = 0; m.s.ang = 0; m.s.turning = false; m.s.idoT = 0;
      },
      interaction(m, game) {
        const C = Z(game), G = C.innerGate, s = m.s, me = game.player.pos;
        if (s.phase !== 'wheels' || s.turning || s.halt || game.mode !== 'foot' || d2(me, G.wheelBAt) > 1.7) return null;
        return { label: 'לסובב את הגלגל', priority: 6, run: () => { s.turning = true; game.sound?.hit?.('block', 0.5); } };
      },
      target(m, game) {
        const C = Z(game), T = C.tunnels.exits.north, G = C.innerGate, s = m.s, me = game.player.pos;
        if (s.phase === 'tunnels') {
          const g = nearestOf(game, TUNNEL);
          if (g && d2(g, me) < 14) return g;
          return me.y < C.y - 2 ? (d2(me, T.foot) > 3 ? { ...T.foot, r: 1.6 } : { ...T.top, r: 1.6 }) : { ...G.wheelBAt, r: 1.0 };
        }
        if (s.phase === 'wheels') return s.halt ? nearestOf(game, PATROL) || { ...G.cover[1], r: 1.4 } : { ...G.wheelBAt, r: 0.9 };
        return null;
      },
      update(m, game, dt) {
        const C = Z(game), G = C.innerGate, s = m.s, me = game.player.pos, ido = game.npc('ido');
        if (s.phase === 'tunnels' && C.inInner(me.x, me.z) && me.y > C.y - 1) {
          s.phase = 'wheels';
          game.squad.send('ido', { ...G.wheelAAt }, { label: 'בגלגל' });
          later(m, WHEELS);
        }
        if (s.phase === 'wheels') {
          const at = d2(ido.pos, G.wheelAAt) < 1.3;
          if (!s.halt && !at) { s.idoT += dt; if (s.idoT > 8 && d2(me, G.wheelBAt) < 16) { ido.target = null; ido.place(G.wheelAAt.x, G.wheelAAt.z, G.wheelAAt.yaw, G.wheelAAt.y); } }
          if (s.turning && d2(me, G.wheelBAt) > 2.3) { s.turning = false; game.hud.toast('להישאר ליד הגלגל', 1200); }
          const both = s.turning && at && !s.halt && !allyOf(game, 'ido')?.marked;
          if (at && !s.halt) { ido.lookAt(G.wheelA.x, G.wheelA.z); if (ido.model.pose !== 'carry' && both) ido.model.setPose('carry'); }
          if (both) {
            s.p = Math.min(1, s.p + dt / TURN_TIME); s.ang += dt * 2.4; G.spin(0, s.ang); G.spin(1, -s.ang);
            if ((s.click = (s.click || 0) - dt) <= 0) { s.click = 0.45; game.sound?.hit?.('block', 0.25); }
          } else if (ido.model.pose === 'carry') ido.model.setPose(null);
          game.hud.setPursuit(`השער הפנימי · ${Math.round(s.p * 100)}%`);
          // half-way: a patrol from the inner compound; the wheels wait until it is held off
          if (s.p >= 0.5 && !s.patrol) {
            s.patrol = true; s.halt = true; s.turning = false;
            game.squad.release('ido'); ido.model.setPose(null);
            const T = G.threats;
            post(game, PATROL.map((id, k) => ({ id, at: [off(T[k], 22, 0), T[k]], still: false })), { hot: true });
            later(m, PATROL_CALL);
          }
          if (s.halt && s.patrol && !standing(game, PATROL)) {
            s.halt = false; s.idoT = 0;
            game.squad.send('ido', { ...G.wheelAAt }, { label: 'בגלגל' });
            later(m, PATROL_DONE);
          }
          if (s.p >= 1) {
            s.phase = 'open'; s.turning = false; game.hud.setPursuit(null);
            ido.model.setPose(null); game.squad.release('ido');
            G.open(); game.sound?.hit?.('crash', 0.7); game.follow.shake(0.3);
            // Hadar and Yonati, who watched the shaft, come through from the yard side
            for (const [k, id] of SHAFT_WATCH.entries()) { const n = standAt(game, id, off(G.outside, -2, k ? 1.4 : -1.4)); n.model.setPose(null); }
            game.squad.form(TEAM, { near: me, yaw: game.player.yaw, leader: 'nehorai', walk: true });
            m.beats = beats(game, [['wait', 1.0], ['say', GATE_UP]]);
          }
        }
        m.beats?.update(dt);
        const n = standing(game, TUNNEL), pn = standing(game, PATROL);
        say(m, game, s.phase === 'tunnels' ? goal(3, n ? `במנהרות · לסמן אותם (${TUNNEL.length - n}/${TUNNEL.length}) · היציאה הצפונית` : 'במנהרות · היציאה הצפונית, אל השער הפנימי')
          : s.phase === 'wheels' ? (s.halt ? goal(3, `סיור! לעצור אותם (${PATROL.length - pn}/${PATROL.length}) · ${marks(game)}`) : goal(3, s.turning ? `לסובב יחד עם עידו · ${Math.round(s.p * 100)}%` : 'לגלגל הימני · עידו בשמאלי'))
          : goal(3, 'השער פתוח'));
        return s.phase === 'open' && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; game.hud.setPursuit(null); const ido = game.npc('ido'); if (ido.model.pose === 'carry') ido.model.setPose(null); },
    },
    { // 4 · goal 5: control room B. Muller at the computer; the Order by a different way in each time
      objective: GOALS[4], checkpoint: true,
      enter(m, game) {
        const C = Z(game), A = C.control.approaches;
        freshMarks(game);
        game.hud.banner('המצודה', GOALS[4], '', 2400);
        later(m, CONTROL);
        game.squad.send('muller', { ...C.computer.at }, { label: 'במחשב' });
        for (const [id, [k, side]] of Object.entries(POSTS)) { const p = A[k].post, sx = Math.cos(p.yaw ?? 0) * side, sz = -Math.sin(p.yaw ?? 0) * side; game.squad.send(id, { ...off(p, sx, sz) }, { label: 'בעמדה' }); }
        m.s.phase = 'go'; m.s.bar = 0; m.s.wave = 0; m.s.goT = 0; m.s.mullerMarks = 0;
        C.computer.screen.show('data', { progress: 0 });
      },
      target(m, game) {
        const C = Z(game), s = m.s;
        if (s.phase === 'go') return { ...C.control.approaches[0].inside, r: 1.6 };
        return nearestOf(game, WAVES.flat()) || { ...C.computer.at, r: 1.2 };
      },
      update(m, game, dt) {
        const C = Z(game), s = m.s, me = game.player.pos, mu = game.npc('muller'), A = C.control.approaches;
        const inRoom = me.x > C.computer.at.x - 16 && me.x < C.computer.at.x + 16 && me.z > C.computer.at.z - 4 && me.z < C.computer.at.z + 26;
        if (s.phase === 'go') {
          s.goT += dt;
          if (d2(mu.pos, C.computer.at) > 1.3 && (inRoom || s.goT > 20) && s.goT > 6) { mu.target = null; mu.place(C.computer.at.x, C.computer.at.z, Math.PI, C.y); }
          if (d2(mu.pos, C.computer.at) < 1.3 && inRoom) { s.phase = 'hack'; s.hacking = true; mu.target = null; mu.lookAt(C.computer.pos.x, C.computer.pos.z); }
        }
        if (s.phase === 'hack') {
          const a = allyOf(game, 'muller');
          if (a?.marked) { // he stops, wipes it off and goes on
            s.wipe = (s.wipe || 0) + dt;
            if (s.wipe > 3) { a.marked = false; a.gun.visible = true; a.npc.body.enabled = false; if (mu.model.pose === 'down') mu.model.setPose(null); s.wipe = 0; s.mullerMarks++; game.hud.toast('מולר מנגב את הצבע וממשיך', 1600); if (s.mullerMarks === 1) later(m, MULLER_WIPE); }
          } else {
            if (d2(mu.pos, C.computer.at) > 1.3) { mu.target = null; mu.place(C.computer.at.x, C.computer.at.z, Math.PI, C.y); }
            mu.lookAt(C.computer.pos.x, C.computer.pos.z);
            if (mu.model.pose !== 'carry') mu.model.setPose('carry');
            s.bar = Math.min(1, s.bar + dt / HACK_TIME);
          }
          C.computer.screen.show('data', { progress: s.bar });
          game.hud.setPursuit(`מולר במחשב · ${Math.round(s.bar * 100)}%`);
          if (s.wave < WAVES.length && s.bar >= WAVE_AT[s.wave]) {
            const k = s.wave++, ap = A[WAVE_FROM[k]], fx = ap.inside.x - ap.outside.x, fz = ap.inside.z - ap.outside.z, fl = Math.hypot(fx, fz) || 1, sx = -fz / fl, sz = fx / fl;
            post(game, WAVES[k].map((id, j) => ({ id, at: [off(ap.from, sx * (j - 1) * 1.8, sz * (j - 1) * 1.8), off(ap.outside, sx * (j - 1) * 0.9, sz * (j - 1) * 0.9), ap.inside], still: false })));
            for (const gd of game.paint.guards) if (WAVES[k].includes(gd.npc.id)) gd.seen = 0.3;
            later(m, WAVE_CALL[k]); s.from = ap.name;
          }
          if (s.bar >= 1 && s.wave >= WAVES.length && !standing(game, WAVES.flat())) {
            s.phase = 'done'; s.hacking = false; mu.model.setPose(null); game.hud.setPursuit(null);
            C.energyHall.door.unlock(); C.computer.screen.show('data', { progress: 1 });
            for (const id of ['muller', ...Object.keys(POSTS)]) game.squad.release(id);
            m.beats = beats(game, [['say', HACKED]]);
          }
        }
        m.beats?.update(dt);
        const left = standing(game, WAVES.flat()), pct = Math.round(s.bar * 100);
        const way = { west: 'מהמערב', south: 'מהדרום', east: 'מהמזרח' }[s.from] || '';
        say(m, game, s.phase === 'go' ? goal(4, 'לחדר בקרה ב · מולר אל המחשב')
          : s.phase === 'hack' ? goal(4, left ? `באים ${way}! לסמן אותם (${left}) · מולר ${pct}% · ${marks(game)}` : `מולר במחשב · ${pct}% · לשמור על הכניסות · ${marks(game)}`)
          : goal(4, 'מולר בפנים'));
        return s.phase === 'done' && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.s.hacking = false; game.hud.setPursuit(null); const mu = game.npc('muller'); if (mu.model.pose === 'carry') mu.model.setPose(null); },
    },
    { // 5 · goal 6: between the pylons' discharges, up the plant house, over the bridges to the tower's door
      objective: GOALS[5], checkpoint: true,
      enter(m, game) {
        const C = Z(game);
        freshMarks(game);
        game.hud.banner('המצודה', GOALS[5], '', 2400);
        for (const p of C.energy.pylons) p.set(true);
        later(m, PYLONS);
        m.s.phase = 'cross'; m.s.cycle = 0; m.s.wp = 0; m.s.fired = [0, 0]; m.s.runCool = 0;
      },
      target(m, game) {
        const s = m.s;
        if (s.phase === 'door' || s.phase === 'end') return null;
        const R = route6(game), g = s.wp >= 3 ? nearestOf(game, ROOFS) : null;
        return g && d2(g, game.player.pos) < 14 ? g : { ...R[Math.min(s.wp, R.length - 1)], r: 1.4 };
      },
      update(m, game, dt) {
        const C = Z(game), s = m.s, me = game.player.pos, R = route6(game), [north, south] = rows(game);
        // the discharges: each row warns and fires once a cycle, the rows half a cycle apart
        if (s.phase === 'cross' || s.phase === 'up') {
          const before = s.cycle; s.cycle = (s.cycle + dt) % CYCLE;
          const crossed = (t) => (before <= t && s.cycle > t) || (before > s.cycle && (s.cycle > t || before <= t));
          if (crossed(0.001)) { discharge(game, north); s.fired[0]++; }
          if (crossed(CYCLE / 2)) { discharge(game, south); s.fired[1]++; }
          // Erez calls it when a row near him goes quiet (between the rows, or at the first one)
          s.runCool -= dt;
          const quietN = s.cycle > WARN + LIVE && s.cycle < WARN + LIVE + 0.3, quietS = s.cycle < 0.3; // (the south row's beam ends as the cycle turns)
          if (s.runCool <= 0 && me.y < C.y + 1 && me.z > north[0].z - 5 && me.z < south[0].z + 3 && ((quietN && me.z < north[0].z) || (quietS && me.z < south[0].z && me.z > north[0].z))) { s.runCool = 7; later(m, RUN_NOW[(s.runs = (s.runs || 0) + 1) % RUN_NOW.length]); }
        }
        // the way: each waypoint reached on its floor moves the arrow on (one further on counts too)
        for (let k = R.length - 1; k >= s.wp; k--) if (d2(me, R[k]) < (k === R.length - 1 ? 2.2 : 2.6) && sameFloor(me, R[k])) { s.wp = Math.min(R.length - 1, k + 1); break; }
        if (s.phase === 'cross' && s.wp >= 2) { s.phase = 'up'; later(m, UP); post(game, [{ id: 'og16', at: C.patrols.controlRoof }, { id: 'og17', at: C.patrols.bridgeA }]); }
        const o = C.energyHall.doorOutside;
        if (s.phase === 'up' && d2(me, o) < 2.4 && sameFloor(me, o) && !standing(game, ROOFS)) {
          s.phase = 'door';
          game.energy?.clear();
          const D = C.energyHall.door; D.unlock(); D.setOpen(true); game.sound?.hit?.('block', 0.6);
          // everyone to his place behind him on the bridge (one who is still below or far behind is there at once)
          const S = towerDoorSpots(game);
          for (const id of TEAM) { const n = game.npc(id), p = S.people[id]; if (d2(n.pos, p) > 9 || !sameFloor(n.pos, p)) { standAt(game, id, p); game.squad.send(id, p, { label: '' }); n.target = null; } else game.squad.send(id, p, { label: '' }); }
          m.beats = beats(game, [['wait', 0.8], ['say', AT_DOOR], ['do', () => { m.s.phase = 'end'; }]]);
        }
        m.beats?.update(dt);
        const rn = standing(game, ROOFS);
        say(m, game, s.phase === 'cross' ? goal(5, `לחצות בין עמודי המתח אל בית המתקנים · ${marks(game)}`)
          : s.phase === 'up' ? goal(5, rn && s.wp >= 3 ? `על הגגות: לסמן אותם (${ROOFS.length - rn}/${ROOFS.length}) · ${marks(game)}` : 'לגג בית המתקנים, ובגשרים אל דלת המגדל')
          : goal(5, 'דלת המגדל'));
        return s.phase === 'end' ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; game.energy?.clear(); },
    },
  ],
  complete(m, game) { m.done = true; },
};

// where the six who ride down stand on the platform (two rows of three, Nehorai in the middle)
function boardSpots(game) {
  const L = Z(game).lift, c = L.onTop;
  return [[-1.8, -1.8], [0, -1.8], [1.8, -1.8], [-1.8, 1.8], [0, 1.8], [1.8, 1.8]].map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz, y: c.y }));
}
