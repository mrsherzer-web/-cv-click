// Chapter ten, mission 12, "ZERO HOUR". The Shadow is tied and the portal system dead, but the engine at the end of
// the last hall goes on by itself: it is coming apart, and it takes the citadel with it. Muller: four minutes.
// 04:00 – FINAL ESCAPE on the pill, the loudspeakers sending the Order's people out, and the gang out by the marked
// way: the emergency door (Ido throws its switch), the fire stairs down the tower's face with blasts and falling
// parts (each with its ring and its beeps first: a knock, a second lost, nothing worse), the gap in bridge B (a
// leap; the friends after him, the tied Shadow too), the plant house, the service door that slams and locks ahead
// of them (its switch on the plant's wall), and then a crash behind: Liam under a fallen frame. Erez: no time.
// Nehorai: everyone goes home. The rest run on to the vehicle bay (Yonati opens the service gate, Avraham and Dolev
// put the Shadow in the back of the armoured car) while Nehorai and Erez lift the frame and Nehorai gets Liam on
// his feet. Across the yard to the armoured car, everyone in, Muller raises its shield, and Nehorai drives it out of
// the service gate and down the road. The blast: the central tower goes down into itself, the wave comes over the
// plain, the car is thrown onto its side at the roadside. Black. Wind. Nehorai climbs out and calls them, and one by
// one they answer: everyone alive. The Shadow sits tied by the car; Muller has sent his position. Mission 59
// carries on. Nobody of the gang betrays, nobody of the gang dies, and the Order's people were sent out before it
// went. Invented, all of it.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { L, CARDS } from './lines10.js';
import { TEAM, handsOver, endCrew, attempt, Work, dropBeam, Leap, liftUp } from './infinity.js';
import { hush, armed, gangAt, beats, later, talkOn, clearAll, bandage, TBlast, ltr, mmss, stay, blackout } from './phoenix-d.js';
import { walkPath } from './phoenix-b.js';
import { CIT, HALL, H, inHall, hallReady, shadowAt, shadowAway, tie, armouredCar, armouredDone, armouredAway, ledBy } from './infinity-d.js';

const E = L.zerohour;
const LIMIT = 240;                                   // 04:00
const MIN = [LIMIT, LIMIT, 190, 150, 110];           // the least the clock shows when a checkpoint is picked up again
const AHEAD = ['muller', 'ido', 'hadar', 'yonati', 'avraham', 'dolev']; // on to the car while Liam is freed
// where each waits in the vehicle bay (the citadel's own plan: lx east, lz south of its centre), either side of the car
const BAYAT = { muller: [-144.6, 104], ido: [-145.6, 107.5], hadar: [-145.6, 111], yonati: [-144.6, 114.5], avraham: [-135.4, 105], dolev: [-135.4, 108.5] };
const ERZ_AT = [-35.6, 42];                           // Erez at the other end of the frame on Liam

// the user's lines are in lines10.js; these are mine, short, each in his own voice
const SPEAKER = [['קול ברמקול', 'כל הכוחות, לפנות את המצודה.']];
const MARKS = ['מולר', 'הדלקתי את סימוני החירום: חצים ירוקים על הרצפה. דלת החירום בקיר הדרומי!'];
const IDO_DOOR = ['עידו', 'הדלת נעולה? לא לאורך זמן. אני על המתג!'];
const TAKE = [['אברהם', 'ואת זה אנחנו לוקחים איתנו. אף אחד לא נשאר פה.'], ['דולב', 'קדימה, צל. צעד אחרי צעד.']];
const DOOR_OPEN = ['עידו', 'פתוח! כולם החוצה, ולמטה במדרגות!'];
const RINGS = ['ארז', 'טבעת אדומה מהבהבת — עוקפים או מחכים. לא נכנסים לתוכה!'];
const GAP = ['ארז', 'הגשר שבור! ארבעה מטר — קופצים!'];
const LANDED = ['עידו', 'אני לא מסתכל למטה. אני לא מסתכל למטה.'];
const HOP = ['אברהם', 'גם אתה, צל. קפיצה אחת, ואתה בצד השני.'];
const SLAM = [['הדר', 'דלת השירות נטרקה וננעלה! יש מתג על הקיר של המתקן — שם!']];
const OPENED = [['הדר', 'נפתחה! קדימה, קדימה!']];
const ON_TO_CAR = [['נהוראי', 'כל השאר — לרכב המשוריין! אנחנו מיד אחריכם.'], ['מולר', 'אני מכין את הרכב. יונתי, שער השירות!'], ['יונתי', 'עליי!']];
const FRAME = ['ארז', 'אני מהצד הזה. בשלוש — מרימים!'];
const LIFTED = [['ליאם', 'וואו. אני חייב לכם גלידה. הרבה גלידה.'], ['ארז', 'תשלם בבית. רוצו!']];
const GATE_OPEN = ['יונתי', 'שער השירות פתוח! עכשיו רק תביאו את עצמכם!', 'phone'];
const SHADOW_IN = [['אברהם', 'הצל מאחור, קשור לספסל. מישהו רוצה לשבת לידו?', 'phone'], ['דולב', 'לא.', 'phone']];
const BOARD = [['הדר', 'שמונה… תשעה… עשרה. כולם בפנים!']];
const SHIELD = [['מולר', 'מגן הרכב — למעלה. הוא יחזיק. אני כמעט בטוח.']];
const DRIVE = [['עידו', 'דרך שער השירות, ואז רק ישר בכביש! סע, סע!']];
const HOLD_ON = [['ארז', 'תחזיקו חזק!']];
const HERE = {
  muller: ['מולר', 'פה. המגן החזיק — אמרתי לכם שהוא טוב.'],
  yonati: ['יונתי', 'פה! רק איבדתי נעל.'],
  hadar: ['הדר', 'פה. שלמה. השיער פחות.'],
  avraham: ['אברהם', 'פה. ועכשיו אני באמת אגיד את הנאום.'],
  dolev: ['דולב', 'פה. בפעם הבאה אני נשאר בבית. הפעם ברצינות.'],
  liam: ['ליאם', 'פה! והרגל בסדר, תודה ששאלתם.'],
};
const SENT = [['מולר', 'שלחתי את המיקום שלו. יבואו לאסוף אותו.']];
const TIMEOUT = 'הזמן נגמר — המצודה קרסה לפני שיצאתם. מולר: "החצים הירוקים הם הדרך הקצרה. וכשטבעת אדומה מהבהבת — עוקפים אותה, לא עומדים בה."';
const TIMEOUT_CAR = 'הזמן נגמר לפני שהתרחקתם מהמצודה. עידו: "גז עד הסוף, דרך שער השירות, ואז רק ישר בכביש."';

const pill = (left) => ltr(CARDS.escape.replace(/^\d\d:\d\d/, mmss(left)));   // "04:00 – FINAL ESCAPE", counting down
function clock(game, left) { game.hud.setPursuit(left == null ? null : pill(left)); }
const leftOf = (m, game) => LIMIT - (game.time - m.s.t0);
const P = (game, lx, lz, k = 0, yaw) => { const Z = CIT(game), p = Z.toWorld(lx, lz); return { x: p.x, z: p.z, y: Z.y + k, ...(yaw != null ? { yaw } : {}) }; };
const RO = (game) => game.world.places.lastRoad.rollover;

// where the escape picks up at each checkpoint
function startAt(game, cp) {
  const W = CIT(game).wayOut, R = W.route;
  if (cp <= 1) { const a = H(game, 68, 8); return { ...a, yaw: Math.atan2(R[0].x - a.x, R[0].z - a.z) }; }
  if (cp === 2) return { ...R[6], yaw: -Math.PI / 2 };
  if (cp === 3) return { ...W.doors[1].before, yaw: Math.PI / 2 };
  return { ...W.doors[1].after, yaw: -Math.PI / 2 };
}

// ---------- everything this mission made, put away ----------
function put(m, game, { keep = false } = {}) {
  clearAll(m, game, { keep });
  m.leap?.dispose(); m.leap = null;
  m.lift?.dispose?.(); m.lift = null;
  for (const x of m.meshes || []) { x.removeFromParent(); x.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  m.meshes = []; m.frame = null; m.shield = null; m.wave = null; m.throw = null;
  for (const id of [...TEAM, 'shadow']) { const n = game.npcs.get(id); if (n?.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } }
  const Z = CIT(game);
  Z.wayOut.leap.guard(true);
  game.fx.redAlert(false, { id: 'citadel' }); game.fx.redAlert(false, { id: 'lasthall' });
  if (game.player.frozen) game.player.frozen = 0;
  if (game.nehorai) game.nehorai.root.visible = true;
  game.player.body.enabled = game.mode === 'foot';
}

// ---------- the scene at a checkpoint (or the start) ----------
function stage(m, game, cp, left) {
  // a live carry-on from mission 57: Nehorai and the tied Shadow where the fight left them in the last hall
  const sh0 = game.npcs.get('shadow'), carried = cp === 0 && !!sh0?.visible && inHall(game, sh0.pos) && inHall(game);
  const me0 = carried ? { x: game.player.pos.x, z: game.player.pos.z, y: game.player.pos.y } : null, sh0At = carried ? { x: sh0.pos.x, z: sh0.pos.z, y: sh0.pos.y } : null;
  put(m, game);
  const Z = CIT(game), W = Z.wayOut, Hh = HALL(game);
  hallReady(game, { engine: 'overload', music: undefined });
  game.energy?.clear?.();
  game.paint.dispose();
  // the doors: the emergency door (Ido's switch), the service door (its own switch), the service gate (Yonati)
  W.throwSwitch(0, cp >= 2);
  W.throwSwitch(1, cp >= 3);
  W.leap.guard(true);
  W.mark(cp >= 1);
  const gs = Z.gates.service; if (cp >= 4) gs.open(); else gs.lock();
  Z.alarm.on(true);
  // the armoured car in its bay
  const car = armouredCar(game), sp = Z.armoured.spot;
  car.place(sp.x, sp.z, sp.yaw, sp.y);
  // Nehorai and the gang: everyone with him until Liam is down; then the rest on errands at the car
  const at = me0 ? { ...me0, yaw: Math.atan2(W.route[0].x - me0.x, W.route[0].z - me0.z) } : startAt(game, cp);
  gangAt(game, at, { ids: TEAM });
  bandage(game.nehorai, true);
  game.follow.override = null; game.follow.snapBehind(at.yaw);
  if (cp >= 3) for (const id of AHEAD) { const [lx, lz] = BAYAT[id]; stay(game, id, P(game, lx, lz, 0, Math.PI), { label: 'ליד הרכב' }); }
  armed(game, TEAM);
  // the Shadow: tied, led by Avraham and Dolev; from Liam's fall on, in the back of the armoured car
  const sh = shadowAt(game, sh0At || (cp <= 1 ? H(game, 72, 2, -Math.PI / 2) : { x: at.x + 1.5, z: at.z + 1.5, y: at.y }), { armor: false });
  tie(sh.model, true);
  if (cp >= 3) sh.enter(car);
  m.led = {};
  // Liam under the frame (checkpoint 3)
  if (cp === 3) { liamDown(m, game); m.erezSet = false; }
  // fire and smoke on the way, the red light, the siren, the clock
  const burn = (p, r = 1, smoke = true) => { m.smoke.push(game.fx.burn(p.x, p.y + 0.05, p.z, { r, strength: 1.3, seconds: 900 })); if (smoke) m.smoke.push(game.fx.smokeColumn(p.x, p.y + 0.6, p.z, { r: r * 0.9, seconds: 900 })); };
  burn(H(game, 100, -22), 1.4); burn(H(game, 100, 22), 1.4); burn(H(game, 48, -30), 1.1); burn(H(game, 58, 30), 1);
  burn(P(game, 62, 46), 1.6); burn(P(game, -44, 32, 7), 1.1); burn(P(game, -80, 70), 1.4); burn(P(game, -100, 36), 1.2);
  { const t = Hh.engine; m.smoke.push(game.fx.smokeColumn(t.x - 4, Z.y + Z.F.towerRoof, t.z, { r: 6, strength: 2, seconds: 900 })); }
  game.fx.redAlert(true, { id: 'citadel', points: Z.alarm.lights });
  game.fx.redAlert(true, { id: 'lasthall', at: H(game, 72, 0), r: 46, points: [H(game, 50, 0), H(game, 94, 0)].map((p) => ({ ...p, y: p.y + 11 })), intensity: 60 });
  m.stopSiren = game.sound?.siren?.(LIMIT + 90) || null;
  game.sound?.music?.('action', { fade: 0.4 });
  m.s = { cp, t0: game.time - (LIMIT - left), used: new Set(), boomT: 3, sparkT: 0, cool: 0, ri: [0, 0, 6, 15, 16][cp], said: {}, lead: cp >= 1 && cp <= 2 };
  clock(game, left);
}

// ---------- the way: the arrow along the marked route ----------
// the next point of the marked way after the furthest he has reached; half way down a flight no point is on his
// height: then the nearest of them all, so the arrow keeps pointing on down
function nextOnRoute(m, game) {
  const W = CIT(game).wayOut, R = W.route, me = game.player.pos;
  let i = 0;
  if (R.some((q) => Math.abs(q.y - me.y) <= 1.6)) i = W.routeIndex(me);
  else { let bd = Infinity; R.forEach((q, k) => { const d = Math.hypot(q.x - me.x, q.y - me.y, q.z - me.z); if (d < bd) { bd = d; i = k; } }); }
  m.s.ri = Math.max(m.s.ri ?? 0, i);
  const p = R[Math.min(R.length - 1, m.s.ri + 1)];
  return { x: p.x, z: p.z, y: p.y, r: 1.6 };
}

// ---------- the way coming apart: blasts and falling parts, each warned first ----------
// a knock for whoever is in it when it goes: pushed away, a second on the floor to get up again, nothing worse
function knock(game, p, r) {
  const Pl = game.player, me = Pl.pos;
  if (game.mode !== 'foot' || game.cutscene || Pl.busy || Math.abs(me.y - p.y) > 2.2) return;
  const d = Math.hypot(me.x - p.x, me.z - p.z); if (d > r) return;
  const k = (r - d + 0.8) / (d || 1);
  Pl.push?.((me.x - p.x) * k * 0.5, (me.z - p.z) * k * 0.5); Pl.freeze?.(0.9);
  game.follow.shake(0.6); game.overlay?.flash?.('#ffd9a8', 240, 0.4); game.hud.toast('הדף! · שנייה, ועל הרגליים', 1300);
}
function hazards(m, game) {
  if (m.hz) return m.hz;
  const W = CIT(game).wayOut, fall = [H(game, 79, 27), P(game, 24, 38.25, 7), P(game, -88, 52), P(game, -118, 82)];
  m.hz = [...W.blasts.map((p) => ({ p, kind: 'blast' })), ...fall.map((p) => ({ p, kind: 'fall' }))].map((h) => ({ ...h, ri: W.routeIndex(h.p) }));
  return m.hz;
}
function dangers(m, game, dt) {
  const me = game.player.pos, Z = CIT(game);
  m.s.cool -= dt;
  if (m.s.cool <= 0 && game.mode === 'foot' && !game.cutscene) for (const h of hazards(m, game)) {
    if (m.s.used.has(h) || Math.abs(h.p.y - me.y) > 1.5 || h.ri < (m.s.ri ?? 0)) continue;
    const d = Math.hypot(h.p.x - me.x, h.p.z - me.z);
    if (d > 12 || d < 5.5) continue;
    m.s.used.add(h); m.s.cool = 1.2;
    const p = h.p;
    if (h.kind === 'blast') m.live.push(new TBlast(game, { at: p, size: 1.8, warn: 1.8, radius: 3, fire: 60, hurts: false, marks: false, onBoom: () => knock(game, p, 3) }));
    else m.live.push(new TBlast(game, { at: p, size: 0.5, warn: 1.4, radius: 1.8, hurts: false, marks: false, onBoom: () => {
      m.beams.push(dropBeam(game, { from: { x: p.x, y: p.y + 7, z: p.z }, to: { x: p.x, y: p.y + 0.25, z: p.z, roll: 0.3 }, len: 3.2, yaw: Math.random() * Math.PI, w: 0.42, h: 0.42, seconds: 0.42, block: false, color: '#3a3f46', onLand: () => knock(game, p, 1.8) }));
    } }));
    if (!m.s.said.rings) { m.s.said.rings = true; later(m, [RINGS]); }
    break;
  }
  // the citadel shaking round them: a far boom, dust from the ceiling inside the tower; the engine spitting sparks
  m.s.boomT -= dt;
  if (m.s.boomT <= 0 && !game.cutscene) {
    m.s.boomT = 4.5 + Math.random() * 4;
    game.sound?.boom?.(0.3 + Math.random() * 0.25); game.follow.shake(0.3); game.carCam?.shake?.(0.3);
    if (Z.inTower(me.x, me.z)) for (let k = 0; k < 3; k++) game.fx.dust(me.x + (Math.random() - 0.5) * 7, me.y + 4, me.z + (Math.random() - 0.5) * 7, 0.7);
  }
  if ((m.s.sparkT -= dt) <= 0) { m.s.sparkT = 0.8; const e = HALL(game).engine; game.energy?.sparks?.(e.x - 1.5, e.y + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 6, '#ff7a3a', 10, 6); }
}

// ---------- Liam under the frame ----------
function liamDown(m, game) {
  const W = CIT(game).wayOut, f = W.fallen, n = game.npc('liam');
  stay(game, 'liam', { ...f, yaw: -Math.PI / 2 }, { label: 'לכוד', pose: 'floored' });
  n.body.enabled = false;
  // the frame: a steel rack of beams across him, one end on the floor
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.7, metalness: 0.4 });
  for (const z of [-0.65, 0.65]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.16), mat); b.position.set(0, 0, z); g.add(b); }
  for (const x of [-1.7, 0, 1.7]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.46), mat.clone()); b.position.set(x, 0, 0); g.add(b); }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.08, 0.08), mat.clone()); brace.rotation.y = 0.36; g.add(brace);
  g.position.set(f.x, f.y + 0.55, f.z); g.rotation.z = -0.16; g.rotation.y = 0;
  game.scene.add(g); m.meshes.push(g); m.frame = { g, k: 0, up: false };
  m.s.frame = 'down'; m.s.liam = 'down';
}
// the frame up off him and down beside him
function frameOff(m, game, dt) {
  const F = m.frame; if (!F || !F.up || F.k >= 1) return;
  F.k = Math.min(1, F.k + dt / 0.9);
  const f = CIT(game).wayOut.fallen, e = F.k * F.k * (3 - 2 * F.k);
  F.g.position.set(f.x, f.y + 0.55 + Math.sin(Math.PI * Math.min(1, F.k * 1.3)) * 1.3, f.z - e * 2.4);
  F.g.rotation.z = -0.16 + e * 0.16; F.g.rotation.x = -e * 0.5;
  if (F.k >= 1) { F.g.position.y = f.y + 0.1; game.fx.dust(f.x, f.y, f.z - 2.4, 1); game.sound?.hit?.('crash', 0.7); }
}

// ---------- the vehicle bay: everyone in, the shield, the drive ----------
function board(m, game) {
  if (m.s.boarded) return;
  m.s.boarded = true;
  const car = game.car;
  m.s.lead = false;
  for (const id of [...TEAM, 'shadow']) { const n = game.npc(id); n.target = null; if (!n.inCar) { if (id !== 'shadow') game.squad.tasks.set(id, { x: n.pos.x, z: n.pos.z, label: 'ברכב' }); n.enter(car); } }
  if (game.mode !== 'car') game.enterCar();
  CIT(game).gates.service.open();
  m.talk.unshift(BOARD, SHIELD, DRIVE);
  m.s.shieldIn = game.time + 1.6;
}
// Muller's shield over the car: a pale blue shell that takes the hits
function raiseShield(m, game) {
  if (m.shield) return;
  const car = game.car, g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), new THREE.MeshBasicMaterial({ color: '#8fe9ff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  const lines = new THREE.Mesh(new THREE.SphereGeometry(1.01, 14, 8), new THREE.MeshBasicMaterial({ color: '#c8f6ff', wireframe: true, transparent: true, opacity: 0.22, depthWrite: false }));
  g.add(shell, lines); g.scale.set(0.01, 0.01, 0.01); g.position.set(0, 1.5, 0);
  car.model.add(g); m.meshes.push(g);
  m.shield = { g, shell, lines, t: 0, flare: 0 };
  game.sound?.zap?.(0.6, 0.7); game.energy?.sparks?.(car.pos.x, car.pos.y + 2.8, car.pos.z, '#8fe9ff', 18, 4);
}
function shieldOn(m, game, dt) {
  const S = m.shield; if (!S) return;
  S.t += dt; S.flare = Math.max(0, S.flare - dt * 0.6);
  const k = Math.min(1, S.t / 0.7), e = k * (2 - k);
  S.g.scale.set(2.3 * e, 2.1 * e, 4.9 * e);
  S.shell.material.opacity = 0.13 + 0.05 * Math.sin(S.t * 3) + S.flare * 0.5;
  S.lines.material.opacity = 0.18 + S.flare * 0.6;
}
function drivePts(m, game) {
  if (m.pts) return m.pts;
  const Z = CIT(game), LR = game.world.places.lastRoad, a = Z.armoured.route, last = a[a.length - 1];
  m.pts = [...a.map((p) => ({ x: p.x, z: p.z })), ...LR.pathFrom('escape', last.x, last.z)];
  return m.pts;
}
function driveTarget(m, game) {
  const pts = drivePts(m, game), c = game.car.pos;
  let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; bi = i; } });
  m.s.di = Math.max(m.s.di ?? 0, bi);
  const p = pts[Math.min(pts.length - 1, m.s.di + 4)];
  return { x: p.x, z: p.z, y: game.world.groundHeight(p.x, p.z), r: 5 };
}
const farEnough = (game) => { const c = game.car.pos, R = RO(game), g = CIT(game).gates.service; return Math.hypot(c.x - R.road.x, c.z - R.road.z) < 30 || Math.hypot(c.x - g.at.x, c.z - g.at.z) > 300; };

// ---------- the blast: the wave over the plain, the car onto its side ----------
function waveOn(m, game, dt) {
  const w = m.wave; if (!w) return;
  w.r += dt * 150;
  w.g.scale.set(w.r, w.r * 0.32, w.r);
  w.mat.opacity = Math.max(0, 0.42 * (1 - w.r / 520));
  w.ring.scale.set(w.r, w.r, 1); w.ringMat.opacity = Math.max(0, 0.7 * (1 - w.r / 520));
  if (w.r > 540) { w.g.visible = false; w.ring.visible = false; }
}
function throwOn(m, game, dt) {
  const T = m.throw; if (!T || T.done) return;
  const c = game.car;
  T.t += dt;
  const k = Math.min(1, T.t / T.T), e = k * k * (3 - 2 * k);
  c.pos.x = T.a.x + (T.b.x - T.a.x) * e; c.pos.z = T.a.z + (T.b.z - T.a.z) * e;
  c.pos.y = T.a.y + (T.b.y - T.a.y) * e + Math.sin(Math.PI * k) * 3.2;
  let dy = T.b.yaw - T.a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  c.yaw = T.a.yaw + dy * e; c.lean = T.lean * Math.min(1, k * 1.15); c.speed = 0; c.vy = 0;
  c.sync(0);
  if (k >= 1) {
    T.done = true;
    game.fx.dust(c.pos.x, c.pos.y - 1.4, c.pos.z, 2.2); game.fx.sparks(c.pos.x, c.pos.y, c.pos.z, 24);
    game.sound?.hit?.('crash', 1); game.follow.shake(1.2); game.overlay?.flash?.('#ffffff', 300, 0.6);
  }
}

export default {
  id: 'zerohour', chapter: 10, number: 12, title: 'ZERO HOUR', requires: ['endshadow'], follows: true,
  where: 'במצודה',
  startAt: (game) => { const h = game.world.places.citadel?.lastHall; return h ? { x: h.entry.x, z: h.entry.z, y: h.entry.y } : null; },
  reward: { money: 3000, text: 'כולם יצאו בחיים · 3,000 ₪' },

  setup(m, game) { m.s = { said: {} }; m.live = []; m.beams = []; m.smoke = []; m.talk = []; m.meshes = []; m.saved = {}; m.led = {}; },
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.dimensionName) game.dimension(null);
    const a = H(game, 68, 8); game.player.place(a.x, a.z, 0.55, a.y); game.follow.snapBehind(0.55);
  },
  failIf(m, game) {
    if (m.s.t0 == null || m.s.away || m.stepIndex < 1 || m.stepIndex > 4 || leftOf(m, game) > 0) return null;
    return m.stepIndex === 4 && game.mode === 'car' ? TIMEOUT_CAR : TIMEOUT;
  },
  restore(m, game, cp) { stage(m, game, cp, Math.max(m.saved?.[cp] ?? 0, MIN[cp])); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live || []) x.update(dt);
    for (const b of m.beams || []) b.update(dt);
    // the Shadow a step behind Avraham on the way out (not while a leap carries him)
    if (m.s.lead && !m.leap?.friends.jobs.some((j) => j.n.id === 'shadow')) m.led = ledBy(game, 'avraham', dt, m.led);
    frameOff(m, game, dt); shieldOn(m, game, dt); waveOn(m, game, dt); throwOn(m, game, dt);
    if (m.s.t0 != null && !m.s.away) clock(game, leftOf(m, game));
  },
  cleanup(m, game) {
    const carry = m.done && handsOver(game), Z = CIT(game);
    put(m, game, { keep: carry });
    Z.wayOut.mark(false);
    if (carry) { // by the overturned car on the road out: the gang on the verge, the Shadow tied by the car (mission 59 takes it)
      armouredDone(game);
      game.sound?.music?.('calm', { fade: 2 });
      return;
    }
    if (Z.destroyed || Z.falling) Z.restore();
    Z.wayOut.throwSwitch(0, false); Z.wayOut.throwSwitch(1, false);
    Z.gates.service.lock(); Z.alarm.on(false);
    HALL(game).engine.set('idle');
    armouredAway(game);
    shadowAway(game);
    bandage(game.nehorai, false);
    game.sound?.music?.(null, { fade: 0.6 });
    endCrew(game);
  },

  steps: [
    { // 0: the engine goes on by itself; four minutes; the loudspeakers; the marked way
      objective: 'המנוע קורס',
      enter(m, game) {
        stage(m, game, 0, LIMIT);
        m.s.t0 = null; clock(game, null);
        const Hh = HALL(game), e = Hh.engine, sh = game.npc('shadow'), me = game.player.pos;
        game.cutscene = true; game.hud.setCinematic(true);
        const shot = (from, at) => game.follow.shot(from, at, 9999);
        const mu = game.npc('muller');
        stay(game, 'muller', { ...Hh.engineAt }, { label: 'במנוע' }); mu.lookAt(e.x, e.z);
        sh.model.setPose('down');
        for (const [id, s] of [['avraham', -1], ['dolev', 1]]) stay(game, id, { x: sh.pos.x - 0.9, z: sh.pos.z + s * 0.9, y: sh.pos.y }, { label: 'שומר' }).lookAt(sh.pos.x, sh.pos.z);
        m.beats = beats(game, [
          ['do', () => { shot({ x: e.x - 16, y: e.y + 2, z: e.z + 10 }, { x: e.x, y: e.y, z: e.z }); game.energy?.sparks?.(e.x - 1, e.y, e.z, '#ff7a3a', 40, 8); game.sound?.thunder?.(0.7); game.follow.shake(0.5); }],
          ['wait', 0.8],
          ['do', () => shot({ x: mu.pos.x - 3.4, y: mu.pos.y + 1.9, z: mu.pos.z + 2.2 }, { x: mu.pos.x, y: mu.pos.y + 1.5, z: mu.pos.z })],
          ['say', [E.mullerProblem]],
          ['do', () => shot({ x: me.x + 2.2, y: me.y + 1.8, z: me.z - 1.6 }, { x: me.x, y: me.y + 1.6, z: me.z })],
          ['say', [E.howBad]],
          ['do', () => { shot({ x: mu.pos.x - 3, y: mu.pos.y + 1.7, z: mu.pos.z - 2 }, { x: mu.pos.x, y: mu.pos.y + 1.5, z: mu.pos.z }); e.set('overload'); game.energy?.sparks?.(e.x - 1, e.y, e.z, '#ff7a3a', 30, 7); }],
          ['say', [E.mullerForever]],
          // the loudspeakers send the Order's people out; the siren; the clock
          ['do', () => { shot({ x: me.x - 6, y: me.y + 6, z: me.z - 8 }, { x: me.x + 6, y: me.y + 1, z: me.z + 6 }); game.sound?.boom?.(0.5); game.follow.shake(0.4); }],
          ['say', SPEAKER],
          ['do', () => { game.hud.banner('ZERO HOUR', ltr(CARDS.escape), 'כולם החוצה · אחרי החצים הירוקים', 3400); clock(game, LIMIT); }],
          ['wait', 0.6],
          ['do', () => { CIT(game).wayOut.mark(true); const r = CIT(game).wayOut.route[0]; shot({ x: me.x, y: me.y + 3.2, z: me.z - 3 }, { x: r.x, y: r.y + 0.5, z: r.z }); }],
          ['say', [MARKS, IDO_DOOR]],
          // Avraham and Dolev get him on his feet: he comes along, tied
          ['do', () => { shot({ x: sh.pos.x - 3.2, y: sh.pos.y + 1.7, z: sh.pos.z + 2.6 }, { x: sh.pos.x, y: sh.pos.y + 1.1, z: sh.pos.z }); sh.model.setPose('halfup'); }],
          ['wait', 0.5],
          ['do', () => { sh.model.setPose(null); }],
          ['say', TAKE],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) {
        m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        for (const id of ['muller', 'avraham', 'dolev']) game.squad.release(id);
        m.s.t0 = game.time; m.s.lead = true;
      },
    },
    { // 1: out of the last hall by the emergency door (Ido's switch), down the fire stairs
      objective: 'לברוח · אחרי החצים הירוקים', checkpoint: true,
      enter(m, game) {
        if (m.s.t0 == null) m.s.t0 = game.time;
        m.saved[1] = leftOf(m, game);
        const X = CIT(game).wayOut.doors[0], ido = game.npc('ido'), live = attempt(game, m);
        // Ido runs for the switch; there or not in a few seconds, the door opens (a friend's job always comes off)
        m.s.door = 'shut'; m.s.idoT = game.time;
        const open = () => { if (!live() || m.s.door === 'open') return; m.s.door = 'open'; CIT(game).wayOut.throwSwitch(0, true); game.sound?.hit?.('crash', 0.6); ido.lookAt(X.after.x, X.after.z); later(m, [DOOR_OPEN]); game.squad.release('ido'); };
        game.squad.send('ido', { x: X.switchAt.x, z: X.switchAt.z }, { label: 'מתג החירום', onArrive: () => { m.s.idoThere = true; } });
        m.s.openDoor = open;
      },
      target(m, game) { const X = CIT(game).wayOut.doors[0]; return m.s.door !== 'open' ? { x: X.before.x, z: X.before.z, y: X.before.y, r: 1.4 } : nextOnRoute(m, game); },
      update(m, game, dt) {
        const R = CIT(game).wayOut.route, me = game.player.pos, ido = game.npc('ido'), X = CIT(game).wayOut.doors[0];
        if (m.s.door !== 'open') {
          const late = game.time - m.s.idoT > 8;
          if (late && !m.s.idoThere) { ido.target = null; ido.place(X.switchAt.x, X.switchAt.z, 0, X.switchAt.y); m.s.idoThere = true; }
          if (m.s.idoThere && (m.s.idoAt ||= game.time) && game.time - m.s.idoAt > 0.7) m.s.openDoor();
        }
        dangers(m, game, dt);
        say(m, game, `${mmss(leftOf(m, game))} · ${m.s.door !== 'open' ? 'דלת החירום · עידו על המתג' : 'אחרי החצים · במדרגות החירום למטה'}`);
        return m.s.door === 'open' && Math.abs(me.y - R[6].y) < 1.2 && near(me, R[6], 6) ? 'next' : null;
      },
    },
    { // 2: the gap in bridge B (a leap), the plant house, the service door that slams and locks — its switch
      objective: 'לקפוץ מעל הפער · אל דלת השירות', checkpoint: true,
      enter(m, game) {
        const Z = CIT(game), W = Z.wayOut;
        m.saved[2] = leftOf(m, game);
        W.throwSwitch(0, true);
        // the service door open ahead of them (it will not stay so)
        const d1 = W.doors[1]; d1.door.unlock(); d1.door.setOpen(true); d1.lamp.set('#2fd27a');
        m.s.slam = null; m.s.leapt = false;
        const who = [...TEAM, 'shadow'].map((id) => game.npc(id)).filter((n) => n.visible && !n.inCar);
        m.leap = new Leap(game, { from: W.leap.from, to: W.leap.to, label: 'לקפוץ מעל הפער', friendsFollow: who,
          onStart: () => W.leap.guard(false),
          onLand: () => { W.leap.guard(true); m.s.leapt = true; later(m, [LANDED]); later(m, [HOP]); } });
        later(m, [GAP]);
        m.work = new Work(game, { at: d1.switchAt, seconds: 2, label: 'להפעיל את מתג הדלת', pill: 'מתג דלת השירות', near: 1.8, onDone: () => {
          m.s.slam = 'open'; W.throwSwitch(1, true); game.sound?.hit?.('crash', 0.6); game.dialogue.play(OPENED);
        } });
      },
      interaction(m, game) { return m.s.slam === 'shut' ? m.work?.interaction(game) || null : m.leap?.interaction(game) || null; },
      target(m, game) {
        const W = CIT(game).wayOut;
        if (!m.s.leapt && !m.leap?.active) { const f = W.leap.from; return { x: f.x, z: f.z, y: f.y, r: 1.1 }; }
        if (m.s.slam === 'shut') { const s = W.doors[1].switchAt; return { x: s.x, z: s.z, y: s.y, r: 1.0 }; }
        return nextOnRoute(m, game);
      },
      update(m, game, dt) {
        const Z = CIT(game), W = Z.wayOut, me = game.player.pos, d1 = W.doors[1];
        m.leap?.update(dt);
        dangers(m, game, dt);
        // the service door slams and locks as he comes through the plant house
        if (!m.s.slam && m.s.leapt && Math.abs(me.y - Z.y) < 1 && near(me, d1.before, 9)) {
          m.s.slam = 'shut'; d1.door.lock(); d1.lamp.set('#ff2a2a'); game.sound?.hit?.('crash', 1); game.follow.shake(0.4); game.dialogue.play(SLAM);
        }
        m.work?.update(dt);
        const left = mmss(leftOf(m, game));
        say(m, game, `${left} · ${!m.s.leapt ? 'הפער בגשר · לקפוץ' : m.s.slam === 'shut' ? 'דלת השירות ננעלה · המתג על הקיר' : 'דרך המתקן · אל דלת השירות'}`);
        return m.s.slam === 'open' ? 'next' : null;
      },
      exit(m, game) { m.work = null; m.leap?.dispose(); m.leap = null; },
    },
    { // 3: a crash behind: Liam under a fallen frame. No time — everyone goes home. The frame with Erez, Liam up
      objective: 'ליאם לכוד · להרים את המסגרת עם ארז', checkpoint: true,
      enter(m, game) {
        const Z = CIT(game), W = Z.wayOut, f = W.fallen, me = game.player.pos, live = attempt(game, m);
        m.saved[3] = leftOf(m, game);
        W.throwSwitch(1, true);
        if (!m.frame) { // live (not a checkpoint's restore): it comes down on him now, behind them
          game.squad.tasks.delete('liam');
          liamDown(m, game);
          game.fx.dust(f.x, f.y, f.z, 1.8); game.fx.sparks(f.x, f.y + 2.5, f.z, 16); game.sound?.hit?.('crash', 1); game.follow.shake(0.6);
        }
        m.erezSet = false;
        const sh = game.npc('shadow'), Hb = HALL(game); void Hb;
        game.cutscene = true; game.hud.setCinematic(true);
        const shot = (from, at) => game.follow.shot(from, at, 9999);
        // the rest go on to the car; Yonati opens the service gate; Avraham and Dolev put the Shadow in the back
        const bayPath = (id) => { const R = W.route, [lx, lz] = BAYAT[id]; return [W.doors[1].before, W.doors[1].after, R[17], R[18], R[19], P(game, lx, lz)]; };
        const onTo = () => {
          for (const id of AHEAD) {
            const n = game.npc(id); if (n.inCar) continue;
            game.squad.tasks.set(id, { x: n.pos.x, z: n.pos.z, label: 'לרכב' });
            if (id === 'yonati') {
              const gi = Z.gates.service.inside;
              walkPath(n, [W.doors[1].before, W.doors[1].after, W.route[17], W.route[18], gi], { run: true, onDone: () => { if (!live()) return; m.s.gate = true; Z.gates.service.open(); later(m, [GATE_OPEN]); walkPath(n, [W.route[19], P(game, ...BAYAT.yonati)], { run: true, onDone: () => n.lookAt(game.car.pos.x, game.car.pos.z) }); } });
            } else walkPath(n, bayPath(id), { run: true, onDone: () => {
              if (!live()) return;
              n.lookAt(game.car.pos.x, game.car.pos.z);
              if (id === 'avraham' && !sh.inCar) { m.s.lead = false; sh.target = null; sh.enter(game.car); later(m, SHADOW_IN); }
            } });
          }
          m.s.onT = game.time;
          // Erez to the other end of the frame
          const er = game.npc('erez'), q = P(game, ...ERZ_AT);
          game.squad.tasks.set('erez', { x: q.x, z: q.z, label: 'המסגרת' });
          walkPath(er, [W.doors[1].before, P(game, -50, 40), P(game, -40, 38.6), q], { run: true, onDone: () => { if (live()) m.erezSet = true; } });
          m.s.erT = game.time;
        };
        const inside = P(game, -49.4, 40.4);  // just inside the plant house's west way in, looking at him
        m.beats = beats(game, [
          ['do', () => shot({ x: inside.x, y: inside.y + 2.2, z: inside.z }, { x: f.x, y: f.y + 0.5, z: f.z })],
          ['wait', 0.7],
          ['say', [E.erezNoTime]],
          ['do', () => shot({ x: me.x + 1.8, y: me.y + 1.8, z: me.z - 1.6 }, { x: me.x, y: me.y + 1.6, z: me.z })],
          ['say', [E.iSaid]],
          ['say', ON_TO_CAR],
          ['do', () => { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); onTo(); later(m, [FRAME]); }],
        ]);
        m.work = new Work(game, { at: W.fallenAt, seconds: 2.5, label: 'להרים את המסגרת עם ארז', pill: 'מרימים עם ארז', near: 1.9, onDone: () => {
          m.s.frame = 'up'; if (m.frame) m.frame.up = true; game.npc('erez').model.setPose(null); game.sound?.hit?.('crash', 0.5);
        } });
      },
      interaction(m, game) {
        if (game.cutscene) return null;
        if (m.s.frame === 'down') return m.erezSet ? m.work?.interaction(game) || null : null;
        const n = game.npc('liam');
        if (m.s.liam === 'down' && m.s.frame === 'up' && (m.frame?.k ?? 1) >= 1 && near(game.player.pos, n.pos, 2.4)) return { label: 'לעזור לליאם לקום', priority: 7, run: () => {
          m.s.liam = 'lifting';
          const live = attempt(game, m);
          m.lift = liftUp(game, n, { onDone: () => { if (!live()) return; m.s.liam = 'up'; game.squad.release('liam'); game.squad.release('erez'); game.dialogue.play(LIFTED); } });
        } };
        return null;
      },
      target(m, game) {
        const W = CIT(game).wayOut;
        if (m.s.liam !== 'up') { const f = m.s.frame === 'down' ? W.fallenAt : game.npc('liam').pos; return { x: f.x, z: f.z, y: f.y, r: 1.1 }; }
        return nextOnRoute(m, game);
      },
      update(m, game, dt) {
        const Z = CIT(game), W = Z.wayOut, me = game.player.pos, er = game.npc('erez');
        m.beats?.update(dt);
        if (m.beats?.done) m.beats = null;
        // Erez at his end of the frame (put there if the way takes him long), hands on it
        if (!m.beats && !m.erezSet && m.s.erT && game.time - m.s.erT > 6) { const q = P(game, ...ERZ_AT); er.target = null; er.place(q.x, q.z, -Math.PI / 2, q.y); m.erezSet = true; }
        if (m.erezSet && m.s.frame === 'down') { er.target = null; er.lookAt(W.fallen.x, W.fallen.z); er.model.setPose('crouch'); }
        // those sent on to the car get there (a friend's errand always comes off)
        if (m.s.onT && game.time - m.s.onT > 40) for (const id of AHEAD) { const n = game.npc(id); if (n.inCar || !n.target) continue; const [lx, lz] = BAYAT[id]; const q = P(game, lx, lz); n.target = null; n.place(q.x, q.z, Math.PI, q.y); if (id === 'yonati' && !m.s.gate) { m.s.gate = true; Z.gates.service.open(); } if (id === 'avraham') { const sh = game.npc('shadow'); m.s.lead = false; if (!sh.inCar) sh.enter(game.car); } }
        m.work?.update(dt);
        dangers(m, game, dt);
        say(m, game, `${mmss(leftOf(m, game))} · ${m.s.frame === 'down' ? (m.erezSet ? 'להרים את המסגרת עם ארז' : 'ארז בדרך למסגרת') : m.s.liam !== 'up' ? 'לעזור לליאם לקום' : 'דרך דלת השירות · לחצר'}`);
        return m.s.liam === 'up' && Math.abs(me.y - Z.y) < 1 && me.x < W.doors[1].after.x + 1.5 ? 'next' : null;
      },
      exit(m, game) { m.work = null; m.beats?.cancel(); m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 4: across the yard to the armoured car: everyone in, the shield, and out of the service gate down the road
      objective: 'לרכב המשוריין', checkpoint: true,
      enter(m, game) {
        const Z = CIT(game);
        m.saved[4] = leftOf(m, game);
        m.s.boarded = false; m.s.di = 0;
        if (!m.s.gate) Z.gates.service.open();
        game.npc('liam').model.setPose(null);
        // the yard goes up round them too: two of the Order's cars by the way, each with its warning
        const R = Z.wayOut.route, me = game.player.pos;
        const byWay = Z.vehicles.filter((v) => !v.wrecked && [17, 18, 19].some((i) => Math.hypot(v.x - R[i].x, v.z - R[i].z) < 26)).slice(0, 2);
        byWay.forEach((v, k) => m.live.push(new TBlast(game, { at: v.at, size: 2.6, warn: 3 + k * 2.5, radius: 4.5, fire: 120, debris: true, hurts: false, onBoom: (p) => { v.wreck(); knock(game, p, 4.5); } })));
        void me;
      },
      interaction(m, game) {
        if (m.s.boarded || game.mode !== 'foot' || game.car.doorDistance(game.player.pos.x, game.player.pos.z) > 3.2) return null;
        return { label: 'לעלות לרכב המשוריין · כולם בפנים', priority: 7, run: () => board(m, game) };
      },
      target(m, game) {
        if (game.mode !== 'car') { const b = CIT(game).armoured.boardAt; return { x: b.x, z: b.z, y: b.y, r: 1.4 }; }
        return driveTarget(m, game);
      },
      update(m, game, dt) {
        if (game.mode === 'car' && !m.s.boarded) board(m, game); // in by the car's own door: they come too
        if (m.s.shieldIn && game.time > m.s.shieldIn) { m.s.shieldIn = 0; raiseShield(m, game); }
        if (game.mode === 'foot') dangers(m, game, dt);
        else { m.s.boomT -= dt; if (m.s.boomT <= 0) { m.s.boomT = 3 + Math.random() * 3; const t = HALL(game).engine; game.fx.explode(t.x - 10 + Math.random() * 20, t.y + 4 + Math.random() * 10, t.z - 30 + Math.random() * 60, { size: 4, fire: 0, debris: false, shake: false }); game.carCam?.shake?.(0.25); } }
        const g = CIT(game).gates.service.at, c = game.car.pos, away = Math.round(Math.hypot(c.x - g.x, c.z - g.z));
        say(m, game, `${mmss(leftOf(m, game))} · ${game.mode !== 'car' ? (m.s.boarded ? 'לרכב · כולם בפנים' : 'לרכב המשוריין · כולם מחכים בחניון') : `לנסוע! להתרחק מהמצודה · ${Math.min(300, away)}/300 מ׳`}`);
        return game.mode === 'car' && m.s.boarded && farEnough(game) ? 'next' : null;
      },
    },
    { // 5: the blast: the tower goes down into itself, the wave comes over the plain, the car onto its side. Black
      objective: 'הפיצוץ',
      enter(m, game) {
        const Z = CIT(game), c = game.car, R = RO(game), live = attempt(game, m);
        m.s.away = true; clock(game, 0);
        m.stopSiren?.(); m.stopSiren = null;
        game.cutscene = true; game.hud.setCinematic(true);
        m.s.film = 'playing';
        game.playCutscene('c10-blast', () => Promise.resolve()).then(() => { if (live()) m.s.film = 'done'; });
        const tw = P(game, 72, 0); // the central tower's middle (world x 1642..1722, z 119..191)
        const view = () => { // from behind the car, the citadel beyond it
          const dx = tw.x - c.pos.x, dz = tw.z - c.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
          game.follow.shot({ x: c.pos.x - ux * 13 - uz * 5, y: c.pos.y + 4.2, z: c.pos.z - uz * 13 + ux * 5 }, { x: tw.x, y: Z.y + 22, z: tw.z }, 9999);
        };
        const target = () => near(c.pos, R, 70) ? { x: R.x, z: R.z, y: R.y + 1.5, yaw: R.yaw } : (() => { const q = c.local(-9, 2); return { x: q.x, z: q.z, y: game.world.groundHeight(q.x, q.z) + 1.5, yaw: c.yaw + 0.8 }; })();
        const booms = [];
        [[0, 10, 0], [-14, 18, 12], [12, 24, -10], [-6, 30, -14], [8, 36, 10], [0, 46, 0]].forEach(([dx, dy, dz], k) => booms.push(['do', () => {
          game.fx.explode(tw.x + dx, Z.y + dy, tw.z + dz, { size: 6 + k, fire: 0, flash: k === 0 || k === 5, debris: k < 3 });
        }], ['wait', 0.32]));
        m.beats = beats(game, [
          ['do', view],
          ['until', () => m.s.film === 'done'],
          ['do', () => { game.cutscene = true; game.hud.setCinematic(true); view(); }],
          ['until', () => Math.abs(c.speed) < 1.5],
          ['wait', 0.4],
          ...booms,
          ['do', () => {
            Z.destroy(); HALL(game).engine.set('dead');
            game.overlay?.flash?.('#fff3dc', 900, 0.9); game.sound?.boom?.(1.4); game.sound?.thunder?.(1); game.follow.shake(1.4);
            for (const [dx, dz] of [[-20, -20], [20, -20], [-20, 20], [20, 20], [0, 0]]) m.smoke.push(game.fx.smokeColumn(tw.x + dx, Z.y + 2, tw.z + dz, { r: 9, strength: 2.4, seconds: 900 }));
            m.smoke.push(game.fx.burn(tw.x, Z.y + 1, tw.z, { r: 10, strength: 2, seconds: 900 }));
          }],
          ['say', HOLD_ON],
          ['do', () => { // the wave: a pale dome of dust and air coming over the plain
            const mat = new THREE.MeshBasicMaterial({ color: '#f3dcb4', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
            const g = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
            const ringMat = new THREE.MeshBasicMaterial({ color: '#fff1d6', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), ringMat);
            g.position.set(tw.x, Z.y, tw.z); ring.position.set(tw.x, Z.y + 0.6, tw.z); ring.rotation.x = 0;
            game.scene.add(g, ring); m.meshes.push(g, ring);
            m.wave = { g, mat, ring, ringMat, r: 20 };
          }],
          ['until', () => m.wave && m.wave.r >= Math.hypot(c.pos.x - tw.x, c.pos.z - tw.z) - 4],
          ['do', () => { // it hits: the shield flares, the car is thrown onto its side off the road
            if (m.shield) m.shield.flare = 1;
            for (const id of TEAM) if (game.npc(id).inCar) game.squad.tasks.set(id, { x: c.pos.x, z: c.pos.z, label: 'ברכב' });
            game.exitCar(); game.nehorai.root.visible = false; game.player.body.enabled = false;
            const b = target();
            m.throw = { t: 0, T: 1.05, a: { x: c.pos.x, z: c.pos.z, y: c.pos.y, yaw: c.yaw }, b, lean: Math.PI / 2 * (R.lean || 1) };
            game.overlay?.flash?.('#ffffff', 500, 0.8); game.follow.shake(1.4);
            const d = { x: b.x - c.pos.x, z: b.z - c.pos.z };
            game.follow.shot({ x: c.pos.x - d.z * 1.4 + d.x * 0.3, y: c.pos.y + 3.5, z: c.pos.z + d.x * 1.4 + d.z * 0.3 }, { x: (c.pos.x + b.x) / 2, y: c.pos.y + 1, z: (c.pos.z + b.z) / 2 }, 9999);
          }],
          ['until', () => m.throw?.done],
          ['wait', 0.7],
          ['do', () => { m.s.black = 'on'; game.sound?.music?.(null, { fade: 0.3 }); blackout(game, m, '', () => { m.s.black = 'done'; }, 2600); }],
          ['until', () => m.s.black === 'done'],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; },
    },
    { // 6: wind. Nehorai climbs out and calls them; one by one they answer: everyone alive
      objective: 'לצאת מהרכב',
      enter(m, game) {
        const c = game.car, R = RO(game), live = attempt(game, m);
        clock(game, null);
        if (m.wave) { m.wave.g.visible = false; m.wave.ring.visible = false; }
        if (m.shield) m.shield.g.visible = false; // it held, and it is spent
        game.cutscene = true; game.hud.setCinematic(true);
        game.sound?.gas?.(9, 0.07); // the wind over the plain (soft noise)
        game.sound?.heartbeat?.(true, { bpm: 70, level: 0.35 });
        const low = () => game.follow.shot({ x: c.pos.x + 4, y: c.pos.y + 0.6, z: c.pos.z - 6 }, { x: c.pos.x, y: c.pos.y, z: c.pos.z }, 9999);
        low();
        m.s.film = 'playing'; m.s.out = false;
        game.playCutscene('c10-alive', () => Promise.resolve()).then(() => { if (live()) { m.s.film = 'done'; game.cutscene = true; game.hud.setCinematic(true); low(); } });
        void R;
      },
      interaction(m, game) {
        if (m.s.out || m.s.film !== 'done') return null;
        return { label: 'לצאת מהרכב', priority: 9, run: () => climbOut(m, game) };
      },
      target(m, game) { const c = game.car.pos; return m.s.out ? null : { x: c.x, z: c.z, y: c.y, r: 2 }; },
      update(m, game, dt) {
        m.beats?.update(dt);
        if (m.s.out) say(m, game, 'כולם פה?');
        return m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.sound?.heartbeat?.(false); game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
  complete(m, game) { m.done = true; },
};

// Nehorai out of the car on its side, then the gang one by one, the Shadow sat by the car
function climbOut(m, game) {
  if (m.s.out) return;
  m.s.out = true;
  const c = game.car, R = RO(game), o = R.out, cit = R.citadel;
  game.nehorai.root.visible = true; game.player.body.enabled = true;
  game.player.place(o.x, o.z, cit, o.y); game.nehorai.setPose?.('kneel');
  game.sound?.heartbeat?.(false); game.sound?.music?.('calm', { fade: 3 });
  const me = game.player.pos, shot = (from, at) => game.follow.shot(from, at, 9999);
  const gather = R.gather, order = ['erez', 'ido', 'muller', 'yonati', 'hadar', 'avraham', 'dolev', 'liam'];
  const outOf = (id, k) => () => {
    const n = game.npc(id), q = c.local(-3.4, -2.6 + (k % 6) * 1.05), to = gather[k];
    if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; }
    n.place(q.x, q.z, cit, game.world.groundHeight(q.x, q.z, c.pos.y)); n.show(true); n.model.setPose(null);
    game.squad.tasks.set(id, { x: to.x, z: to.z, label: 'בחוץ' });
    n.walkTo(to.x, to.z, { run: false, near: 0.4, onArrive: () => n.lookAt(me.x, me.z) });
  };
  const sh = game.npc('shadow');
  m.beats = beats(game, [
    ['do', () => shot({ x: me.x + 2.6, y: me.y + 1.7, z: me.z + 2 }, { x: me.x, y: me.y + 1.2, z: me.z })],
    ['wait', 0.6],
    ['do', () => game.nehorai.setPose?.(null)],
    ['say', [E.calling]],
    ['do', outOf('erez', 0)], ['wait', 0.7], ['say', [E.erezHere]],
    ['do', outOf('ido', 1)], ['wait', 0.7], ['say', [E.idoSwear]],
    ['do', () => shot({ x: me.x - 4, y: me.y + 2.4, z: me.z - 5 }, { x: c.pos.x, y: c.pos.y, z: c.pos.z })],
    ...order.slice(2).flatMap((id, k) => [['do', outOf(id, k + 2)], ['wait', 0.45], ['say', [HERE[id]]]]),
    // Avraham and Dolev bring the Shadow out and sit him by the car, still tied
    ['do', () => { const q = c.local(-3.0, 3.6); if (sh.inCar) { sh.inCar.occupants.delete('shadow'); sh.inCar = null; } sh.target = null; sh.place(q.x, q.z, cit, game.world.groundHeight(q.x, q.z, c.pos.y)); sh.show(true); tie(sh.model, true); sh.model.setPose('down'); shot({ x: q.x - 3, y: q.y + 1.8, z: q.z + 2.5 }, { x: q.x, y: q.y + 0.6, z: q.z }); }],
    ['say', SENT],
    ['do', () => shot({ x: me.x - Math.sin(cit) * 6 + 2, y: me.y + 2.2, z: me.z - Math.cos(cit) * 6 }, { x: me.x, y: me.y + 1.4, z: me.z })],
    ['say', [E.allHere]], ['say', [E.all]],
    ['do', () => shot({ x: me.x + Math.sin(cit) * 5, y: me.y + 1.8, z: me.z + Math.cos(cit) * 5 }, { x: me.x, y: me.y + 1.5, z: me.z })],
    ['say', [E.weWon]],
    ['do', () => game.hud.banner('ZERO HOUR', 'כולם בחיים', 'המצודה נפלה · הצל קשור ליד הרכב', 3200)],
    ['wait', 2.4],
  ]);
}
