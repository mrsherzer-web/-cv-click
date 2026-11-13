// Chapter ten, mission 2, "השיירה האחרונה". The morning of the last day: Nehorai drives the Renault (Erez and
// Avraham with him) at the head of the convoy, car two (Ido, Yonati, Hadar) and car three (Muller with his
// laptop, Dolev, Liam) behind, out of the safe house's yard along the link and the iron road onto the hills road.
// Quiet, the radio, small talk; then a blast far off at the citadel and the sky turns red, and the Shadow's people
// come out of the side tracks: barricades with a gap, things by the road that warn and go up, a stretch where cars
// come at them head-on in both lanes, cars behind (Avraham paints their windscreens), the friends on the radio.
// The bridge ahead is blown in plain sight; Muller finds the service road; on it, the last bend, Muller sets off
// the Shadow's own charge behind them and the road closes on the pursuers; they pull up short of the service gate
// and get out. Rivals, never police; paint and dents, never worse. The driving is the player's. Invented.
import { Vector3 } from 'three';
import { say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { Blast } from './phoenix.js';
import { Rival, ORDER_COLORS, calm } from './phoenix-a.js';
import { L } from './lines10.js';
import { COLORS } from '../combat/paint.js';
import {
  HOME, LR, attempt, handsTo, endCrew, gangCars, dropGangCars, unboardAll, Chatter, Convoy, hush, aboard, boardAll,
  parkYard, dawn, hurt, holdBuddies, armAll, stageConvoy, Oncoming, standAtGate,
} from './infinity-a.js';

const TOWER = { x: 1682, z: 155 };               // the citadel's central tower (the far blast, the red glow)
const P = (who, text) => [who, text, 'phone'];   // over the radio, from another car
const phone = (line) => [...line, 'phone'];
// the lines of the drive that are not the spec's (the spec's are L.lastconvoy)
const INTRO = [['ארז', 'כולם בקשר? רכב שתיים, רכב שלוש?'], P('עידו', 'רכב שתיים פה. מוכנים.'), P('מולר', 'רכב שלוש פה. אני כבר בתוך המערכות שלו.'), P('דולב', 'ואני כבר מתגעגע למיטה.')];
const IRON = [['אברהם', 'כביש הברזל. פעם אחרונה שהיינו פה, עמדה פה משאית ענקית.'], ['ארז', 'הפעם אנחנו רק עוברים.']];
const HILLS = [P('יונתי', 'דרך הגבעות. מפה ישר עד המצודה.'), P('הדר', 'Bro, איזה שקט. אני לא אוהבת את זה.')];
const FAR_MULLER = [P('מולר', 'זה מהמצודה. המכונה שלו התעוררה.')];
const CHASE = [P('ליאם', 'אחים, יש לנו זנב! שניים מאחורינו!')];
const MORE = [P('דולב', 'עוד אחד מאחור. למה תמיד אצלנו?')];
const CLOSE = [[['ארז', 'הוא צמוד אלינו!']], [P('הדר', 'Bro, הוא עליכם!')], [P('עידו', 'נהוראי, שמאלה ימינה! אל תיתן לו להיצמד!')]];
const HIT = [[['ארז', 'ספגנו! אנחנו בסדר, תמשיך!']], [['אברהם', 'את זה הרגשתי בשיניים.']]];
const GANG_HIT = [[P('יונתי', 'רכב שתיים ספג מכה. ממשיכים!')], [P('ליאם', 'רכב שלוש ספג, אחים! הכל טוב!')]];
const CLEAR = [[P('יונתי', 'רכב שתיים עבר נקי.')], [P('ליאם', 'רכב שלוש עבר! רק קצת אבק.')], [P('מולר', 'כולם עברו. ממשיכים.')]];
const WARN = [[['ארז', 'משהו מהבהב בצד הדרך! לא לעצור!']], [P('עידו', 'משהו מצפצף ליד הכביש! לעבור מהר!')], [P('הדר', 'עוד אחד מהבהב! סעו, סעו!')], [['אברהם', 'עוד פיצוץ? מישהו פה ממש אוהב פיצוצים.']], [P('דולב', 'אני לא מסתכל. תגידו לי כשזה נגמר.')]];
const BARRIER = { 'hills 1': [P('עידו', 'מחסום! יש פרצה באמצע!')], 'hills 2': [P('הדר', 'עוד מחסום! הפרצה בצד ימין!')], service: [['ארז', 'מחסום אחרון! דרך הפרצה!']] };
const DODGE = [P('עידו', 'רכבים באים מולכם! בשני הנתיבים! לזגזג!')];
const DODGED = [['ארז', 'אחי... איך עברנו את זה?'], P('דולב', 'אני פותח עיניים. עברנו?')];
const DODGE_HIT = [['ארז', 'אאוץ׳! הרנו עוד נוסעת, תמשיך!']];
const PAINTED = [[['אברהם', 'שמשה צבועה. שיסע ככה עכשיו.']], [['אברהם', 'עוד אחד רואה רק צבע. בבקשה.']], [['אברהם', 'ניקיתי לנו את המראה האחורית.']]];
const LOST = [P('מולר', 'הם נשארו מאחור. בינתיים.')];
const BRIDGE_WARN = [P('עידו', 'נהוראי! משהו מהבהב על הגשר!')];
const BRIDGE = [['ארז', 'הגשר!!! לעצור!']];
const FOLLOW = [P('עידו', 'שמעתם את מולר! כולם אחרי הרנו, לכביש השירות!')];
const SERVICE = [P('יונתי', 'כביש השירות. צר, אבל ריק.')];
const WADI = [P('הדר', 'עוד אחד יוצא מהוואדי!')];
const BIG_WARN = [P('מולר', 'כולם עברו את הסיבוב? יש להם מטען על הכביש מאחורינו. אני מפעיל אותו.')];
const BIG_AFTER = [P('ליאם', 'הם עצרו! הכביש סגור מאחורינו!'), ['ארז', 'מולר, אתה גאון.'], P('מולר', 'אני יודע.')];
const ARRIVE = [P('עידו', 'המצודה. לעצור לפני השער.')];
const SCENE = [['ארז', 'אז זה המקום.'], ['נהוראי', 'כן. מכאן ברגל. ביחד, כמו תמיד.']];
const WRECKED = 'הרנו נפגעה יותר מדי. ארז: "לזגזג בין הרכבים שמולנו, ולא לתת לאלה שמאחור להיצמד."';
const RAVINE = 'הרנו ירדה לערוץ. ארז: "אחי, הגשר נפל — לא קופצים אחריו. בצומת, לכביש השירות."';
const LEFT_CAR = 'השארת את הרנו מאחור. ארז: "בלי הרנו אין שיירה. חוזרים לאוטו."';
const OBJ = ['לנסוע בראש השיירה', 'דרך הגבעות · להמשיך מזרחה', 'להתחמק ולהמשיך למצודה', 'הגשר נפל · לבחור דרך אחרת', 'בכביש השירות אל המצודה', 'המצודה · שער השירות'];
// the stretch of cars coming at them: when each sets off (the Renault's metres along the hills road, from the
// stretch's start) and its lane (+2 the convoy's own, -2 the other)
const DODGERS = [{ at: -50, lane: 2 }, { at: -12, lane: -2 }, { at: 26, lane: 2 }];

// where the Renault is: on the hills road and on the service road ({ s, d } each)
function where(game) { const R = LR(game), c = game.car.pos; return { hills: R.roads.hills.nearest(c.x, c.z), service: R.roads.service.nearest(c.x, c.z) }; }
// the line has been on screen since the dialogue's count was `n` (a retry says it again)
const heardSince = (game, n, [who, text]) => { const d = game.dialogue, k = d.said - (n ?? d.said); return k > 0 && d.history.slice(-k).includes(`${who}: ${text}`); };
const onRoad = (road, s, lane = 0) => { const p = road.at(s); return { x: p.x + p.nx * lane, z: p.z + p.nz * lane, y: p.h }; };
// the arrow: some 60 m on along a route of the last road
function ahead(game, route = 'convoy', n = 20) { const pts = LR(game).pathFrom(route, game.car.pos.x, game.car.pos.z), p = pts[Math.min(pts.length - 1, n)]; return { x: p.x, z: p.z, r: 6 }; }

function fresh(m) {
  m.s = {
    introSaid: false, ironSaid: false, hillsSaid: false, far: false, closing: false, rivalDone: {}, rivalsOut: 0, joined: 0, painted: 0,
    blown: [], booms: 0, warns: 0, bars: {}, dodgers: 0, dodged: 0, dodgeHits: 0, dodgeSaid: false, dodgedSaid: false,
    bridgeT: null, bridgeBlown: false, roadSaid: false, serviceSaid: false, bigT: null, bigDone: false, arrived: false, sceneDone: false,
  };
  m.cool = { close: -99, hit: -99, gang: -99, paint: -99, clear: -99 };
}
function clearLive(m, game) {
  m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; game.hud.setPursuit(null);
  for (const v of Object.values(m.rivals || {})) v.dispose(); m.rivals = {};
  for (const o of m.oncoming || []) if (!o.gone) o.dispose(); m.oncoming = [];
  for (const b of m.live || []) b.cancel(); m.live = [];
  m.chat?.clear();
  m.convoy = null;
  game.fx.clear();
}
// what every checkpoint starts from: the live pieces gone, the road as the Shadow's people set it (the truck of
// chapter eight off the iron road, the barricades up), Nehorai as chapter nine left him, the gang off the squad
function base(m, game) {
  const R = LR(game);
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  clearLive(m, game);
  game.fx.resetAtmosphere(); game.daylight?.preset(null, { seconds: 0 });
  game.daylight?.set(0, 0);
  R.truck.clear(); for (const b of R.barricades) b.raise();
  game.squad.dismiss(); holdBuddies(game, true);
  if (game.playingAs !== 'nehorai') game.playAs('nehorai');
  hurt(game, true);
  game.paint.dispose();
}
// the start in the safe house's yard at 05:30: the Renault in its bay, the two cars in theirs, everyone aboard
function stageYard(m, game) {
  const h = HOME(game);
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  dawn(game);
  game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
  game.player.place(h.car.x - 2, h.car.z, h.car.yaw, h.y);
  game.enterCar();
  parkYard(game);
  boardAll(game);
  armAll(game);
  m.convoy = new Convoy(game, gangCars(game), { behind: h.cars.map((c) => ({ x: c.x, z: c.z })).reverse() });
}
const redSky = (game, seconds) => game.daylight?.preset('redSky', { seconds, toward: TOWER });

// the Shadow's cars behind them; `again`: a new pair on the service road
function startChase(m, game, grace = 3) {
  if (m.pursuit && !m.pursuit.over) return;
  if (m.pursuit) { m.pursuit.dispose(); m.pursuit = null; }
  m.pursuit = new Pursuit(game, { grace, cars: 2, gap: 9, colors: ORDER_COLORS, lines: {}, bonus: 0, radio: false });
  m.s.joined = 0; m.health = game.car.health;
}
function stopChase(m, game) {
  const p = m.pursuit;
  if (p) { if (p.chase && !p.chase.over) p.chase.end(false); p.phase = 'done'; game.alert.chasing = false; game.hud.setPursuit(null); }
  for (const v of Object.values(m.rivals)) if (v.phase !== 'wait') v.phase = 'done';
  m.s.stopped = true;
}
// a car of the Shadow's out of a side track (t1, t2, t3), once
function rival(m, game, name, lines = null) {
  if (m.rivals[name] || m.s.rivalDone[name]) return;
  const j = LR(game).sideRoads.find((q) => q.name === name);
  m.s.rivalsOut++;
  const v = m.rivals[name] = new Rival(game, j, { color: ORDER_COLORS[Object.keys(m.rivals).length % ORDER_COLORS.length] });
  v.go();
  if (lines) m.chat.add(lines, { soon: true });
}
// Avraham, from the Renault's back window: a burst of paint on the windscreen of a car right behind them; it
// cannot see and pulls up (a car of the chase, or one out of a side track that is after them now)
function paintBehind(m, game) {
  if (m.t - m.cool.paint < 11 || game.dialogue.busy) return;
  const me = game.car, fx = Math.sin(me.yaw), fz = Math.cos(me.yaw);
  const cands = [...(m.pursuit?.chase?.chasers || []).filter((ch) => !ch.out).map((ch) => ch.car), ...Object.values(m.rivals).filter((v) => v.phase === 'chase' || v.phase === 'cut').map((v) => v.car)];
  const tgt = cands.find((c) => { const dx = c.pos.x - me.pos.x, dz = c.pos.z - me.pos.z, d = Math.hypot(dx, dz); return !c.disabled && d > 6 && d < 24 && dx * fx + dz * fz < -3; });
  if (!tgt) return;
  m.cool.paint = m.t;
  const Pt = game.paint, color = COLORS.avraham || COLORS.ido, from = me.local(0.5, -1.9), to = tgt.local(0, 1.2);
  const a = { x: from.x, y: me.pos.y + 1.3, z: from.z }, b = { x: to.x, y: tgt.pos.y + 1.15, z: to.z };
  m.chat.now([['אברהם', 'רגע, אני מטפל בו.']]).then(() => {
    if (game.missions.active !== m || tgt.disabled) return;
    Pt.tracer(new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z), color);
    Pt.splat({ point: new Vector3(b.x, b.y, b.z) }, color, new Vector3(a.x, a.y, a.z));
    const s = Pt.splats[Pt.splats.length - 1]; if (s) tgt.model.attach(s); // the paint rides on his windscreen
    tgt.health = 0; tgt.disabled = true; // he cannot see: he pulls up and is out of it
    for (const v of Object.values(m.rivals)) if (v.car === tgt) v.phase = 'done';
    game.hud.toast('אברהם צבע להם את השמשה!', 1600);
    m.s.painted++;
    m.chat.add(PAINTED[(m.s.painted - 1) % PAINTED.length], { soon: true });
  });
}

// every frame of the drive, whichever step: the convoy, the lines, the chase, the rivals out of the side tracks,
// the cars coming at them, the things by the road that warn and go up, Avraham at the back window
function drive(m, game, dt, q, { blasts = null } = {}) {
  const R = LR(game);
  m.convoy?.update(dt);
  m.chat.update(dt);
  const p = m.pursuit;
  if (p && !m.s.stopped) {
    p.update(dt);
    const chasing = () => !m.s.stopped;
    if (p.joined > m.s.joined) { m.chat.add(m.s.joined ? MORE : CHASE, { radio: true, valid: chasing }); m.s.joined = p.joined; }
    const c = p.chase;
    if (c && !c.over && !game.dialogue.busy && c.nearest < 18 && m.t - m.cool.close > 14) { m.cool.close = m.t; m.chat.add(CLOSE[Math.floor(m.t) % CLOSE.length], { valid: chasing }); }
    if (p.over && p.escaped && !m.s.lostSaid) { m.s.lostSaid = true; m.chat.add(LOST, { valid: chasing }); }
    if (p.active || Object.values(m.rivals).some((v) => v.phase === 'chase' || v.phase === 'cut')) paintBehind(m, game);
  }
  if (m.s.stopped) for (const ch of m.pursuit?.chase?.chasers || []) if (Math.abs(ch.car.speed) > 0.1) ch.car.update(dt, { brake: 1, hold: true }); // they pull up
  // the Renault hit, a friend's car hit: they say so (a friend's car is never out of it)
  if (game.car.health < (m.health ?? 100) - 7 && m.t - m.cool.hit > 9) { m.cool.hit = m.t; m.chat.add(HIT[Math.floor(m.t) % HIT.length]); }
  m.health = game.car.health;
  gangCars(game).forEach((v, k) => { const was = m.gang?.[k] ?? v.health; if (v.health < was - 6 && m.t - m.cool.gang > 10) { m.cool.gang = m.t; m.chat.add(GANG_HIT[k], { soon: true }); } if (v.health < 35) v.repair(); (m.gang ||= [])[k] = v.health; });
  for (const v of Object.values(m.rivals)) v.update(dt);
  for (const [k, v] of Object.entries(m.rivals)) if (v.phase === 'done' && !m.convoy?.seen(v.car)) { v.dispose(); delete m.rivals[k]; m.s.rivalDone[k] = true; }
  // the cars coming at them: honking down their lane; one that touched the Renault is a dent, one passed counts
  for (const o of m.oncoming) {
    if (o.gone) continue;
    o.update(dt);
    if (!o.hit && o.hits(game.car) && Math.abs(game.car.speed - o.car.speed) > 6) { o.hit = true; m.s.dodgeHits++; game.carCam?.shake(1); game.sound?.hit?.('crash', 0.8); m.chat.now(DODGE_HIT); }
    if (!o.passed) { const s = R.roads.hills.nearest(o.pos.x, o.pos.z).s; if (s < q.hills.s - 8) { o.passed = true; if (!o.hit) m.s.dodged++; } }
  }
  if (!m.s.dodgedSaid && m.oncoming.length === DODGERS.length && m.oncoming.every((o) => o.passed)) { m.s.dodgedSaid = true; m.chat.add(DODGED, { soon: true }); }
  for (const o of m.oncoming) if (!o.gone && o.passed && o.ap.done && !m.convoy?.seen(o.car)) { o.dispose(); o.gone = true; } // on the verge, out of sight: gone
  // the things by the road on this stretch: a blinking ring and beeps, a friend calls it, then it goes up
  // (twelve metres off the road: a show, never a hit)
  if (blasts && game.car.speed > 3) {
    R.blasts.forEach((b, k) => {
      if (m.s.blown.includes(k) || !blasts(b)) return;
      const road = R.roads[b.road], qq = road.nearest(game.car.pos.x, game.car.pos.z);
      if (qq.d > 12 || qq.s < b.s - 60 || qq.s > b.s - 22) return;
      m.s.blown.push(k);
      m.live.push(new Blast(game, { at: { x: b.x, y: b.y, z: b.z }, size: b.size || 1.6, warn: 2.2, radius: 3.2, fire: 14, hurts: false, onBoom: () => { m.s.booms++; if (m.t - m.cool.clear > 12) { m.cool.clear = m.t; m.chat.add(CLEAR[m.s.booms % CLEAR.length], { valid: () => !m.s.stopped }); } } }));
      m.chat.add(WARN[m.s.warns++ % WARN.length], { soon: true });
    });
  }
  for (const b of m.live) b.update(dt);
  m.live = m.live.filter((b) => !b.done);
  // the barricades: a friend calls the gap as they come up to it
  for (const b of R.barricades) {
    if (m.s.bars[b.name] || !b.up || !m.s.far) continue;
    const qq = R.roads[b.road].nearest(game.car.pos.x, game.car.pos.z);
    if (qq.d < 12 && qq.s > b.s - 70 && qq.s < b.s - 20) { m.s.bars[b.name] = true; game.hud.toast('מחסום לפניכם · לעבור בפרצה', 2200); m.chat.add(BARRIER[b.name] || BARRIER['hills 1'], { soon: true }); }
  }
}
// the cars coming at them on the marked stretch: each sets off from its end down its lane, toward them, and
// pulls onto the verge at the other end
function dodgers(m, game, q) {
  const R = LR(game), D = R.dodge, road = R.roads.hills;
  DODGERS.forEach((d, k) => {
    if (m.s.dodgers > k || q.hills.d > 12 || q.hills.s < D.s0 + d.at) return;
    m.s.dodgers = k + 1;
    const path = [];
    for (let s = D.s1 + 4; s >= D.s0 - 34; s -= 3) path.push(onRoad(road, s, d.lane));
    for (const k2 of [1, 2, 3]) path.push(onRoad(road, D.s0 - 34 - k2 * 3, d.lane + Math.sign(d.lane) * k2 * 2.2)); // onto the verge
    m.oncoming.push(new Oncoming(game, path, { color: ORDER_COLORS[k % ORDER_COLORS.length], cruise: 11 }));
    if (!m.s.dodgeSaid) { m.s.dodgeSaid = true; m.chat.now(DODGE, { radio: true }); game.hud.toast('רכבים מולכם · לזגזג בין הנתיבים', 2400); }
  });
}

// the bridge's charges counting down (beeps), then the span goes: the game's blast and fires, a shake by distance
function bridgeCountdown(m, game, dt) {
  const B = LR(game).bridge;
  if (m.s.bridgeBlown) return;
  const was = m.s.bridgeT; m.s.bridgeT -= dt;
  if (Math.floor(was * 3) !== Math.floor(m.s.bridgeT * 3)) game.sound?.beep?.(1, m.s.bridgeT < 1 ? 1200 : 880);
  if (m.s.bridgeT > 0) return;
  m.s.bridgeBlown = true;
  B.blow({ fx: game.fx });
  const d = Math.hypot(game.car.pos.x - B.x, game.car.pos.z - B.z);
  game.carCam?.shake(Math.max(0.3, 1.2 - d / 200));
  game.overlay?.flash?.('#ffd0a0', 500, Math.max(0.15, 0.6 - d / 300));
  game.hud.banner('', 'הגשר נפל', 'לבחור דרך אחרת', 2400);
  m.chat.now(BRIDGE);
}

// the far blast at the citadel: a flash on the horizon, a deep boom, the sky turns red
function farBlast(m, game) {
  m.s.far = true;
  const c = game.world.places.citadel, y = (c?.y ?? -49) + 30;
  game.fx.explode(TOWER.x, y, TOWER.z, { size: 9, shake: false, sound: false, debris: false, light: false });
  game.fx.smokeColumn(TOWER.x, y, TOWER.z, { r: 5, strength: 2, seconds: 600 });
  game.sound?.boom?.(0.7); game.carCam?.shake(0.45); game.overlay?.flash?.('#ff7a4a', 600, 0.35);
  redSky(game, 4);
  game.sound?.music?.('action', { fade: 1.5 });
  m.chat.now([phone(L.lastconvoy.idoSee)], { radio: true });
  m.chat.add(FAR_MULLER, { soon: true });
}

export default {
  id: 'lastconvoy', chapter: 10, number: 2, title: 'השיירה האחרונה', requires: ['dawn'], follows: true,
  where: 'בחצר בית המסתור',
  startAt: (game) => { const c = game.world.places.safehouse?.car; return c ? { x: c.x, z: c.z, y: c.y } : null; },
  reward: { money: 900, text: 'הגעתם לשער השירות של המצודה · 900 ₪' },

  setup(m, game) {
    m.live = []; m.rivals = {}; m.oncoming = []; m.chat = new Chatter(game);
    fresh(m);
    const R = LR(game);
    R.truck.clear(); for (const b of R.barricades) b.raise(); R.bridge.restore();
    if (aboard(game)) { // straight on from the yard (47): the morning, the bandage and the gang in the cars as it left them
      const h = HOME(game);
      game.squad.dismiss(); holdBuddies(game, true); armAll(game);
      m.convoy = new Convoy(game, gangCars(game), { behind: h.cars.map((c) => ({ x: c.x, z: c.z })).reverse() });
    } else { base(m, game); stageYard(m, game); }
    game.sound?.music?.('calm', { fade: 1 });
  },
  tick(m, game) { calm(game); hush(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const h = HOME(game); game.daylight?.set(0, 0); game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y); game.player.place(h.car.x - 2, h.car.z, h.car.yaw, h.y); game.follow.snapBehind(h.car.yaw); },
  failIf(m, game) {
    if (m.stepIndex >= 5) return null; // the arrival's scene
    const R = LR(game), c = game.car.pos;
    if (R.ravine.contains(c.x, c.z) && c.y < R.ravine.rimY - 3) return RAVINE;
    if (game.mode === 'car' && game.car.disabled) return WRECKED;
    if (game.mode === 'foot' && Math.hypot(game.player.pos.x - c.x, game.player.pos.z - c.z) > 60) return LEFT_CAR;
    return null;
  },
  restore(m, game, cp) {
    const R = LR(game);
    base(m, game);
    fresh(m);
    m.gang = null;
    if (cp === 0) { R.bridge.restore(); stageYard(m, game); game.sound?.music?.('calm'); return; }
    redSky(game, 0);
    m.s.introSaid = m.s.ironSaid = m.s.hillsSaid = m.s.far = m.s.closing = true;
    const c = game.world.places.citadel; game.fx.smokeColumn(TOWER.x, (c?.y ?? -49) + 30, TOWER.z, { r: 5, strength: 2, seconds: 600 });
    if (cp >= 4) {
      R.bridge.blow({ fx: game.fx, boom: false }); // fallen, still burning
      m.s.bridgeBlown = m.s.roadSaid = m.s.dodgeSaid = m.s.dodgedSaid = true; m.s.dodgers = DODGERS.length;
      m.s.rivalDone = { t1: true, t2: true };
      R.blasts.forEach((b, k) => { if (b.route !== 'service') m.s.blown.push(k); });
      for (const n of ['hills 1', 'hills 2']) m.s.bars[n] = true;
    } else R.bridge.restore();
    const trail = stageConvoy(game, R.checkpoints[cp >= 4 ? 4 : 2]);
    armAll(game);
    m.convoy = new Convoy(game, gangCars(game), { behind: trail });
    game.sound?.music?.('action');
  },
  cleanup(m, game) {
    const R = LR(game), carry = !!m.done && handsTo(game, 'citadel');
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    clearLive(m, game);
    for (const b of R.barricades) b.lower();
    if (carry) return; // at the service gate on foot, the cars parked behind, the red sky, the bridge down: 49 goes on
    game.dialogue.stop();
    game.fx.resetAtmosphere(); game.daylight?.preset(null, { seconds: 0 });
    if (game.mode === 'car') game.exitCar();
    unboardAll(game); endCrew(game); dropGangCars(game);
    R.reset();
    hurt(game, false); holdBuddies(game, false);
    game.sound?.music?.(null, { fade: 1 });
  },

  steps: [
    { // 0: out of the yard, the link road and the iron road: quiet, the radio
      objective: OBJ[0], checkpoint: true,
      target(m, game) { return game.mode !== 'car' ? { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 } : ahead(game); },
      update(m, game, dt) {
        const R = LR(game), q = where(game), ra = R.routeAt(game.car.pos.x, game.car.pos.z);
        drive(m, game, dt, q);
        if (!m.s.introSaid && m.t > 1.2) { m.s.introSaid = true; m.chat.add(INTRO, { radio: true }); }
        if (!m.s.ironSaid && ra?.route === 'iron') { m.s.ironSaid = true; m.chat.add(IRON); }
        say(m, game, game.mode !== 'car' ? `${OBJ[0]} · לחזור לרנו` : OBJ[0]);
        return q.hills.d < 12 && q.hills.s > 4 && q.hills.s < 120 ? 'next' : null;
      },
    },
    { // 1: the hills road: a blast far off at the citadel, the sky turns red, the rivals come out of the side tracks
      objective: OBJ[1],
      enter(m, game) { if (!m.s.hillsSaid) { m.s.hillsSaid = true; m.chat.add(HILLS, { radio: true }); } },
      target(m, game) { return ahead(game); },
      update(m, game, dt) {
        const q = where(game);
        drive(m, game, dt, q);
        if (!m.s.far && (m.t > 4 || q.hills.s > 30)) farBlast(m, game);
        if (m.s.far && !m.s.closing && m.t > 3 && q.hills.s > 26) {
          m.s.closing = true;
          rival(m, game, 't1');
          m.s.closingAt = game.dialogue.said;
          m.chat.add([L.lastconvoy.erezClosing], { soon: true });
        }
        say(m, game, OBJ[1]);
        return m.s.closing && !game.dialogue.busy && heardSince(game, m.s.closingAt, L.lastconvoy.erezClosing) ? 'next' : null;
      },
    },
    { // 2: the chase: barricades, the things by the road, the cars head-on, the Shadow's cars behind
      objective: OBJ[2], checkpoint: true,
      enter(m, game) { startChase(m, game, m.s.joined ? 1 : 3); game.sound?.music?.('action'); },
      target(m, game) { return game.mode !== 'car' ? { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 } : ahead(game); },
      update(m, game, dt) {
        const R = LR(game), q = where(game), D = R.dodge;
        drive(m, game, dt, q, { blasts: (b) => b.route === 'common' });
        if (q.hills.d < 12 && q.hills.s > 35) rival(m, game, 't1');
        if (q.hills.d < 12 && q.hills.s > 150) rival(m, game, 't2', [P('יונתי', 'עוד אחד, מהשביל של הבאר!')]);
        dodgers(m, game, q);
        const inStretch = q.hills.d < 12 && q.hills.s > D.s0 - 40 && q.hills.s < D.s1 + 10 && m.oncoming.some((o) => !o.passed);
        const bar = R.barricades.find((b) => b.road === 'hills' && q.hills.d < 12 && q.hills.s > b.s - 60 && q.hills.s < b.s + 4);
        // the bridge ahead: something blinking on it, beeps, then it goes, in plain sight and far enough to stop
        const onService = q.service.d < 8 && q.service.s > 4 && q.service.s < 200;
        if (m.s.bridgeT == null && ((q.hills.d < 12 && q.hills.s > R.fork.s - 40) || onService)) {
          m.s.bridgeT = 2.6;
          m.chat.now(BRIDGE_WARN, { radio: true });
        }
        if (m.s.bridgeT != null) bridgeCountdown(m, game, dt);
        say(m, game, game.mode !== 'car' ? `${OBJ[2]} · לחזור לרנו` : m.s.bridgeT != null ? `${OBJ[2]} · משהו על הגשר! להאט!` : inStretch ? `${OBJ[2]} · רכבים מולכם: לזגזג` : bar ? `${OBJ[2]} · מחסום: דרך הפרצה` : OBJ[2]);
        return m.s.bridgeBlown ? 'next' : null;
      },
    },
    { // 3: the bridge is down: Muller finds the service road; the arrow turns to the fork
      objective: OBJ[3],
      target(m, game) {
        const R = LR(game), q = where(game);
        if (q.service.d < 8 && q.service.s > 2) return ahead(game, 'service');
        const c = R.fork.choices.find((f) => f.route === 'service').at; return { x: c.x, z: c.z, r: 6 };
      },
      update(m, game, dt) {
        const q = where(game);
        drive(m, game, dt, q);
        if (m.s.bridgeBlown && !m.s.roadSaid) {
          m.s.roadSaid = true;
          m.chat.add([phone(L.lastconvoy.mullerRoad)], { soon: true, radio: true });
          m.chat.add(FOLLOW, { soon: true });
        }
        const onService = q.service.d < 8 && q.service.s > 12;
        say(m, game, game.mode !== 'car' ? `${OBJ[3]} · לחזור לרנו` : onService ? OBJ[3] : `${OBJ[3]} · בצומת, לכביש השירות`);
        return onService ? 'next' : null;
      },
    },
    { // 4: the service road: the last bend, the big blast behind them, the service gate
      objective: OBJ[4], checkpoint: true,
      enter(m, game) {
        if (!m.s.serviceSaid) { m.s.serviceSaid = true; m.chat.add(SERVICE, { radio: true }); }
        if (!m.s.bigDone) startChase(m, game, 2);
        game.sound?.music?.('action');
      },
      target(m, game) {
        const R = LR(game), f = R.gates.service.far;
        if (game.mode !== 'car') return { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 };
        return Math.hypot(game.car.pos.x - f.x, game.car.pos.z - f.z) < 90 ? { x: f.x, z: f.z, y: f.y, r: 8 } : ahead(game, 'service');
      },
      update(m, game, dt) {
        const R = LR(game), q = where(game), G = R.gates.service, f = G.far, bend = R.checkpoints.find((c) => c.name === 'bend');
        const gateD = Math.hypot(game.car.pos.x - G.x, game.car.pos.z - G.z);
        drive(m, game, dt, q, { blasts: (b) => b.route === 'service' && Math.hypot(b.x - G.x, b.z - G.z) > 80 });
        const onS = q.service.d < 10;
        if (onS && q.service.s > 60) rival(m, game, 't3', WADI);
        // past the last bend: Muller sets off their own charge on the road behind car three (a ring, beeps, then
        // the blast across the road and fire: whoever is after them stops there)
        if (!m.s.bigT && !m.s.bigDone && onS && q.service.s > bend.s + 45) {
          const three = gangCars(game)[1], s3 = R.roads.service.nearest(three.pos.x, three.pos.z).s;
          const s = Math.max(bend.s - 30, Math.min(q.service.s - 50, s3 - 14));
          m.s.bigT = 2.6; m.big = onRoad(R.roads.service, s, 0);
          m.bigRing = new Blast(game, { at: m.big, size: 4.5, warn: 2.6, radius: 5.5, fire: 0, hurts: false, onBoom: (p) => {
            m.s.bigDone = true;
            for (const o of [-3.5, 0, 3.5]) { const pt = onRoad(R.roads.service, s + o * 0.6, o); game.fx.burn(pt.x, pt.y, pt.z, { r: 1.6, strength: 1.6, seconds: 600 }); }
            game.fx.dust(p.x, p.y, p.z, 3);
            stopChase(m, game);
            if (game.mode === 'car' && Math.hypot(game.car.pos.x - p.x, game.car.pos.z - p.z) < 6) game.car.hurt(8);
            m.chat.now(BIG_AFTER, { radio: true });
          } });
          m.live.push(m.bigRing);
          m.chat.now(BIG_WARN, { radio: true });
        }
        if (!m.s.arrived && m.s.bigDone && gateD < 110) { m.s.arrived = true; m.chat.add(ARRIVE, { radio: true }); }
        const fd = Math.hypot(game.car.pos.x - f.x, game.car.pos.z - f.z);
        say(m, game, game.mode !== 'car' ? `${OBJ[4]} · לחזור לרנו` : fd < 40 ? `${OBJ[4]} · לעצור לפני השער${Math.abs(game.car.speed) > 3 ? ' · לבלום' : ''}` : OBJ[4]);
        return game.mode === 'car' && m.s.bigDone && m.s.arrived && (fd < 12 || gateD < 30) && Math.abs(game.car.speed) < 3 && !game.dialogue.busy && !m.chat.queue.length ? 'next' : null;
      },
    },
    { // 5: at the service gate: the film, everyone out of the cars, the game's own shot of the citadel
      objective: OBJ[5],
      enter(m, game) {
        const live = attempt(game, m), G = LR(game).gates.service;
        stopChase(m, game); m.chat.clear();
        game.cutscene = true; game.hud.setCinematic(true);
        game.playCutscene('c10-citadel', () => Promise.resolve()).then(() => {
          if (!live()) return;
          game.cutscene = true; game.hud.setCinematic(true); // (a film ends with the cutscene off: this scene goes on)
          const S = standAtGate(game);
          armAll(game);
          const r = S.renault, fx = Math.sin(r.yaw), fz = Math.cos(r.yaw), y = G.y ?? game.car.pos.y;
          game.follow.shot({ x: r.x - fx * 7 + fz * 8, y: y + 4.6, z: r.z - fz * 7 - fx * 8 }, { x: G.x, y: y + 6, z: G.z }, 9999); // (fz, -fx): the road's left
          game.hud.banner('', 'המצודה', 'שער השירות', 2600);
          game.sound?.music?.('epic', { fade: 1.2 });
          return game.dialogue.play(SCENE);
        }).then(() => { if (live()) m.s.sceneDone = true; });
      },
      target(m, game) { const G = LR(game).gates.service; return { x: G.x, z: G.z, y: G.y, r: 6 }; },
      update(m, game, dt) { m.convoy = null; m.chat.update(dt); return m.s.sceneDone ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
