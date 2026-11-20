// Chapter seven, mission 1, "ערב בתצפית" (its name gives nothing away: the player does not know what is coming). An evening walk to the lookout ends with a dark car,
// two of Kotzi's people, and Nehorai gone. From here the chapter is played as Erez: at the gym the
// friends come in one by one, Erez says the words — nobody gets left behind — and the team drives
// out to the only lead, the abandoned quarry. Kotzi and his people are invented for the game; the
// lines are written for it and describe nobody real. Paint, never blood, as always.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { roadPath } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';
import { asErez, asNehorai, team, TEAM, NAMES } from './rescue.js';

const TAKEN = [
  ['נהוראי', 'ערב יפה. שקט.'],
  ['שומר', 'נהוראי פרחי? קוצי מוסר דרישת שלום.'],
  ['נהוראי', 'היי, רגע, מה— ארז! עידו!'],
  ['שומר', 'בלי טלפון. ברכב, עכשיו.'],
];
const GYM = [
  ['עידו', 'ארז. נהוראי לא עונה שעתיים. והרנו שלו בתצפית, פתוחה.'],
  ['ארז', 'קוצי.'],
  ['עידו', 'קוצי. מישהו ראה את הוואן השחור שלו נוסע מזרחה.'],
];
const ARRIVALS = [
  ['יונתי', 'הגעתי. אם זה מסוכן, אני רוצה שיידעו שבאתי ראשון.'],
  ['אברהם', 'באתי ישר. דיברתי כל הדרך, אין לי עם מי.'],
  ['מולר', 'פה.'],
  ['דולב', 'חטפו את נהוראי? אני מומחה בלהיחטף. אני בא.'],
  ['הדר', 'Bro. ניו יורק לימדה אותי דבר אחד: לא מחכים.'],
  ['ליאם', 'אחים יקרים. הסיאט בחוץ, מלאה בצבע.'],
];
const SPEECH = [
  ['ארז', 'תקשיבו. קוצי לקח את נהוראי. יש לו מקומות מזרחה, מעבר למחצבה.'],
  ['ארז', 'אנחנו לא משאירים אף אחד מאחור. יוצאים להחזיר את נהוראי.'],
  ['עידו', 'אני איתך בכל צעד. ציוד, דלתות, מלכודות — שלי.'],
  ['אברהם', 'ואני אדבר עם השומרים עד שהם יתחננו שנסמן אותם.'],
  ['ארז', 'לוקחים את הרנו של נהוראי. הוא יבין. סע.'],
];

// ---------- the taking at the lookout ----------
// Filmed by the game's camera and played by the scene itself: nobody in it walks or drives. The plaza is
// cleared and the Renault parked out of the way first; then the dark car is moved along a line and the three
// bodies are put in place every frame from the scene's own clock. So nothing can stand in anybody's way, a
// slow frame only makes a bigger step, and lines tapped away change nothing. Two men take him by the arms and
// drag him to the car while he fights it: grabbing and dragging only, no blow is struck.
// It is laid out in the plaza's own frame: `e` metres from its centre toward the street, `s` metres to the
// right of a car coming up the street (the pub's side).
const SPOT = [-3.4, -1.2];    // where his walk ends and the car finds him, on the view's side of the plaza's lamp
const HELD = [-3.9, -1.2];    // half a step on, where they get hold of him
const STROLL = [0.4, -1.0];   // where his evening walk begins
const STOP = [2.3, -1.2];     // the car at rest: across the plaza, its nose to the south, its right side to him
const DOOR = [0.4, -0.75];    // his heels when his back is at the car's back door
const PARK = [-3.4, 8.3];     // the Renault: by the railing on the pub's side, its nose (and its lamps) to where he is taken
const LIT = [-3.0, -1.1];     // ...the middle of their beam: he is taken in his own car's light and dragged out of it, to a car that stays dark
const CLEAR = 80;             // nobody else within this of the plaza (the car's way in and out along the street too)
const CAR = { from: 50, cruise: 13, brake: 8, turn: 4.4, out: 3.5, pull: 6.5, top: 19 }; // metres up the street, m/s, m/s², the two turns' radii, m/s², m/s
const WALK = 3.9;             // seconds of his walk
const HAUL_T = 5.0;           // seconds from the first heave to the car's door
// the drag, seconds against metres: hauled in heaves, and twice he digs his heels in and drags them back a
// little before they get him moving again
const HAUL = [[0, 0], [0.45, 0.2], [1.0, 0.85], [1.5, 1.5], [1.9, 1.4], [2.3, 1.55], [2.8, 2.2], [3.25, 2.8], [3.6, 2.72], [3.95, 2.85], [4.45, 3.6], [HAUL_T, 4.32]];
const DIGS = [[1.45, 2.3], [3.2, 3.95]];
const BUDDIES = ['companion', 'hadarBuddy', 'idoBuddy', 'liamBuddy', 'erezBuddy'];
const CAST = ['nehorai', 'kg1', 'kg2'];
const MEN = [['kg1', -1], ['kg2', 1]]; // who, and his side of the way to the car: -1 the south (out of its front door), 1 the north (its back door)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k });
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const turn = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function frame(game) {
  const p = game.world.places.plaza, ux = -p.dx, uz = -p.dz, rx = -p.dz, rz = p.dx;
  return {
    y: game.world.places.lookout?.y ?? p.h,
    at: (e, s) => ({ x: p.x + ux * e + rx * s, z: p.z + uz * e + rz * s }),
    of: (q) => ({ e: (q.x - p.x) * ux + (q.z - p.z) * uz, s: (q.x - p.x) * rx + (q.z - p.z) * rz }),
    yaw: (de, ds) => Math.atan2(ux * de + rx * ds, uz * de + rz * ds),
  };
}

// a line the car is moved along: where it is and which way it points, `d` metres from the line's start
function line(pts) {
  const P = [], at = [];
  for (const p of pts) { const q = P[P.length - 1]; if (q && Math.hypot(p.x - q.x, p.z - q.z) < 0.05) continue; at.push(q ? at[at.length - 1] + Math.hypot(p.x - q.x, p.z - q.z) : 0); P.push(p); }
  const length = at[at.length - 1];
  const point = (d) => {
    const c = Math.min(Math.max(d, 0), length);
    let i = 0;
    while (i < P.length - 2 && at[i + 1] < c) i++;
    const k = (c - at[i]) / (at[i + 1] - at[i]);
    return { x: P[i].x + (P[i + 1].x - P[i].x) * k, z: P[i].z + (P[i + 1].z - P[i].z) * k };
  };
  return { length, pose(d) { const a = point(d - 0.4), b = point(d + 0.4), p = point(d); return { x: p.x, z: p.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }; } };
}

// how far along the drag they are after `u` seconds of it, 0..1
function hauled(u) {
  const last = HAUL[HAUL.length - 1];
  if (u >= last[0]) return 1;
  let i = 0;
  while (i < HAUL.length - 2 && HAUL[i + 1][0] <= u) i++;
  const a = HAUL[i], b = HAUL[i + 1];
  return (a[1] + (b[1] - a[1]) * ease((u - a[0]) / (b[0] - a[0]))) / last[1];
}
// 0..1 while he has his heels dug in
const digging = (u) => DIGS.reduce((k, [a, b]) => (u > a && u < b ? Math.max(k, Math.sin((Math.PI * (u - a)) / (b - a)) ** 2) : k), 0);

// a soft round light as a texture: the car's lamps and the phone's glow
function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, outer); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the dark car's lamps at night: the lenses lit, a glare on each and a pool of light on the road ahead (no real
// light is added to the scene, so no shader is rebuilt on a phone in the middle of it)
function carLamps(model) {
  const tex = glowTexture('rgba(255,244,214,1)', 'rgba(255,226,170,0.4)');
  const glare = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const pool = new THREE.MeshBasicMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const group = new THREE.Group(), beam = new THREE.Mesh(new THREE.PlaneGeometry(6, 11).rotateX(-Math.PI / 2), pool);
  group.name = 'taken-lamps';
  for (const x of [0.55, -0.55]) { const s = new THREE.Sprite(glare); s.position.set(x, 0.74, 2.12); s.scale.setScalar(1.15); group.add(s); }
  beam.position.set(0, 0.09, 7.4);
  group.add(beam);
  model.add(group);
  return {
    set(k) { glare.opacity = 0.95 * k; pool.opacity = 0.42 * k; model.userData.headMat.emissiveIntensity = 2.6 * k; },
    dispose() { model.remove(group); tex.dispose(); glare.dispose(); pool.dispose(); beam.geometry.dispose(); },
  };
}
// his phone: in his right hand while he walks, then on the paving where it fell, its screen still lit
function makePhone() {
  const group = new THREE.Group(), tex = glowTexture('rgba(190,222,255,0.9)', 'rgba(120,170,255,0.3)');
  group.name = 'taken-phone';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.011), new THREE.MeshStandardMaterial({ color: '#14161b', roughness: 0.45 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ color: '#d4e7ff', toneMapped: false, fog: false }));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false }));
  screen.position.z = 0.0062;
  glow.position.z = -0.004;
  glow.visible = false; // lit paving round it once it lies there
  group.add(body, screen, glow);
  return { group, glow, dispose() { group.removeFromParent(); tex.dispose(); for (const o of [body, screen, glow]) { o.geometry.dispose(); o.material.dispose(); } } };
}

// one of the scene's three put where the scene has him this frame: no way of his own, nothing to bump into.
// `legs`: whether they walk with the ground he covers (not while he is held or dragged)
function put(n, p, yaw, legs = true) {
  n.target = null; n.face = null;
  n.pos.x = p.x; n.pos.z = p.z; n.yaw = yaw;
  n.pos.y = n.game.world.groundHeight(p.x, p.z, n.pos.y);
  if (!legs) { n.lastX = p.x; n.lastZ = p.z; }
  n.sync();
}
// a whole body leaned about its feet: back (x < 0) or forward, and to a side; lean(n) stands it straight again
function lean(n, x = 0, z = 0) {
  const r = n.model.root.rotation;
  r.order = x || z ? 'YXZ' : 'XYZ';
  r.x = x; r.z = z;
}
// a cut: the camera is at the new shot at once (the follow camera would sweep over from a near one)
function cut(game, [from, look]) {
  game.follow.shot(from, look, 9999);
  game.camera.position.set(from.x, from.y, from.z);
  game.camera.lookAt(look.x, look.y, look.z);
}

// everything put where the scene needs it, whatever the player left where: called under the black
function stage(m, game) {
  const hidden = m.sc?.hidden || []; // (set a second time, a step entered again: whoever it hid already stays on the list)
  strike(m, game);
  const W = game.world, F = frame(game), road = W.places.mainRoad, L = road.length;
  if (game.mode === 'car') game.exitCar();
  const sc = (m.sc = { F, hidden, cues: [], cue: 0, men: [], track: null, drop: null });
  const at = (p) => F.at(p[0], p[1]);
  const shot = (from, look) => [{ ...F.at(from[0], from[1]), y: F.y + from[2] }, { ...F.at(look[0], look[1]), y: F.y + look[2] }];

  // nobody else in the picture: the friends who follow Nehorai after the earlier chapters wait out of it (held,
  // as every scene holds them; the fade to the gym sends them home as it always did, and a scene cut short lets
  // them go again), and anyone else standing about is hidden until it is over
  for (const b of BUDDIES) if (game[b]) game[b].held = true;
  const C = F.at(0, 0);
  for (const [id, q] of game.npcs) {
    if (CAST.includes(id) || !q.visible || q.inCar || Math.hypot(q.pos.x - C.x, q.pos.z - C.z) > CLEAR) continue;
    q.target = null; q.show(false);
    if (!BUDDIES.some((b) => game[b]?.active && game[b].id === id)) sc.hidden.push(q);
  }
  // the Renault at the lookout, wherever it was left (on the plaza beside him, in the car's way, at home):
  // always the same spot by the railing, clear of the scene, its headlamps across the paving where it happens
  // (they are the scene's light: the plaza's own lamp is behind him). "At the lookout, open" when Ido finds it
  const pk = at(PARK);
  game.car.place(pk.x, pk.z, F.yaw(LIT[0] - PARK[0], LIT[1] - PARK[1]));

  // where the scene happens, and the way from where he is taken to the car's door
  sc.spot = at(SPOT); sc.held = at(HELD); sc.door = at(DOOR); sc.from = at(STROLL);
  sc.len = Math.hypot(sc.door.x - sc.held.x, sc.door.z - sc.held.z);
  const T = (sc.T = { x: (sc.door.x - sc.held.x) / sc.len, z: (sc.door.z - sc.held.z) / sc.len }), S = (sc.S = { x: T.z, z: -T.x }); // toward the car; to its left (north)
  sc.off = (p, a, b) => ({ x: p.x + T.x * a + S.x * b, z: p.z + T.z * a + S.z * b });
  sc.yawT = Math.atan2(T.x, T.z); sc.west = F.yaw(-1, 0);
  sc.heels = sc.held;
  sc.land = sc.off(sc.held, -0.7, 0.5); // where the phone ends up: in front of him, on his right

  // the dark car and its two lines. In: down the street on its own side, a little wide into the plaza, then hard
  // round to the left and across it. Out: on round to the left, through the plaza's mouth and away up the street
  const lane = roadPath(road, L - CAR.from, L - 10, 1.8, 2), j = F.of(lane[lane.length - 1]), cx = STOP[0] + CAR.turn, sIn = STOP[1] + CAR.turn;
  const pin = lane.slice();
  for (let e = j.e - 0.5; e > cx; e -= 0.5) pin.push(F.at(e, j.s + (sIn - j.s) * ease((j.e - e) / (j.e - cx))));
  for (let k = 0; k <= 14; k++) { const a = (k / 14) * (Math.PI / 2); pin.push(F.at(cx - Math.sin(a) * CAR.turn, STOP[1] + Math.cos(a) * CAR.turn)); }
  sc.inLen = line(pin).length;
  pin.push(F.at(STOP[0], STOP[1] - 1.5)); // (straight on a little, so it comes to rest square)
  sc.in = line(pin);
  const back = roadPath(road, L - 10, Math.max(0, L - 150), 1.8, 3), j2 = F.of(back[0]), c2 = STOP[0] + CAR.out, sOut = STOP[1] - CAR.out;
  const pout = [F.at(STOP[0], STOP[1] + 1.5)];
  for (let k = 0; k <= 14; k++) { const a = Math.PI / 2 + (k / 14) * (Math.PI / 2); pout.push(F.at(c2 - Math.sin(a) * CAR.out, STOP[1] + Math.cos(a) * CAR.out)); }
  for (let e = c2 + 0.5; e < j2.e; e += 0.5) pout.push(F.at(e, sOut + (j2.s - sOut) * ease((e - c2) / (j2.e - c2))));
  pout.push(...back);
  sc.out = line(pout);
  const van = (m.van = new Vehicle(W, makeHatchback({ color: '#12141a' }), { name: 'van' }));
  van.model.userData.paint.roughness = 0.9; van.model.userData.paint.metalness = 0; // (dull paint: a dark car under the plaza's lamp too)
  game.scene.add(van.model);
  game.chaseCars.push(van);
  sc.lamps = carLamps(van.model);
  sc.lamps.set(0);
  const p0 = sc.in.pose(0);
  van.place(p0.x, p0.z, p0.yaw);

  // the scene's clock: seconds from the picture coming back
  const inTime = (sc.inLen - (CAR.cruise * CAR.cruise) / (2 * CAR.brake)) / CAR.cruise + CAR.cruise / CAR.brake;
  const A = (sc.at = { van: 2.2 });
  A.stop = A.van + inTime;       // the car at rest
  A.notice = A.stop - 2.2;       // he hears it and turns
  A.lunge = A.stop + 2.65;       // they go for him; he turns to run
  A.grab = A.lunge + 0.45;       // they have him
  A.drag = A.grab + 1.9;         // they haul him off his feet
  A.door = A.drag + HAUL_T;      // at the car's back door
  A.inside = A.door + 0.45;      // he is in
  A.away = A.door + 1.3;         // the doors shut, the car pulls out
  A.fade = A.away + 3.3;

  // Nehorai as a figure in the scene: the player's body steps aside for his double
  game.player.place(sc.spot.x, sc.spot.z, sc.west);
  game.nehorai.root.visible = false;
  const n = game.npc('nehorai');
  n.floorY = null; n.idle = null; n.posed = false;
  n.place(sc.from.x, sc.from.z, sc.west);
  n.show(true);
  n.body.enabled = false;
  n.model.setPose('phone');
  sc.phone = makePhone();
  sc.phone.group.position.copy(n.model.handR.offset);
  sc.phone.group.rotation.set(0.2, Math.PI / 2, 0);
  n.model.handR.bone.add(sc.phone.group);
  // Kotzi's two, in the car until it stops
  for (const [id, side] of MEN) {
    const g = game.npc(id), front = side < 0;
    g.floorY = null; g.idle = null; g.posed = false; g.model.setPose(null); g.show(false);
    sc.men.push({ npc: g, side, front, out: A.stop + (front ? 0.12 : 0.34), in: A.door + (front ? 1.05 : 0.85), grip: side > 0 ? 'gripL' : 'gripR', haul: side > 0 ? 'haulR' : 'haulL' });
  }

  // the shots
  const SHOTS = {
    walk: shot([-8.8, -0.3, 1.75], [-1.2, -1.0, 1.5]),          // he walks toward the camera; the street behind him, where the lamps come
    // wide from the side: the car across the plaza, the two men out, him between (a phone standing up sees a narrow
    // picture: from nearer his back then, so he and the car are both in it)
    pullUp: game.camera.aspect < 1 ? shot([-8.6, -3.3, 2.7], [-0.6, -1.3, 1.0]) : shot([-6.5, -7.0, 2.4], [-1.2, -1.2, 1.0]),
    taken: shot([HELD[0] - 3.1, HELD[1] + 0.5, 1.5], [HELD[0] + 0.4, HELD[1], 1.3]), // closer, in front of him as he turns to run
  };
  // what happens when, in order (a long frame may run several at once)
  const cue = (t, run) => sc.cues.push([t, run]);
  const says = (i) => () => game.dialogue.play([TAKEN[i]]);
  const sound = (kind, k) => () => game.sound?.hit(kind, k);
  const act = (name) => () => n.model.play(name);
  cue(0.6, says(0));
  cue(A.van, () => game.sound?.rev(inTime * 0.95, 0.14));
  cue(A.stop - 1.45, () => cut(game, SHOTS.pullUp));
  cue(A.stop - 1.3, () => n.model.setPose(null));               // the phone comes down from his ear
  cue(A.stop - 0.95, sound('crash', 0.2));                      // its tyres on the paving
  for (const man of sc.men) {
    cue(man.out, () => { const d = van.local(-1.4, man.front ? 0.55 : -0.5); man.door = d; man.npc.place(d.x, d.z, facing(d, sc.spot)); man.npc.show(true); man.npc.body.enabled = false; game.sound?.hit('block', 0.3); });
    cue(man.out + 0.9, () => man.npc.model.setPose('closein'));
    cue(man.in, () => { man.npc.model.setPose(null); lean(man.npc); man.npc.enter(van); });
  }
  cue(A.stop + 0.3, says(1));
  cue(A.stop + 0.5, () => n.model.setPose('wary'));             // his hands come up as they close on him
  cue(A.lunge - 0.25, () => cut(game, SHOTS.taken));
  cue(A.lunge - 0.1, says(2));
  cue(A.lunge, () => n.model.setPose(null));
  cue(A.grab, () => { m.s.grabAt = m.s.t; n.model.setPose('seized'); for (const man of sc.men) man.npc.model.setPose(man.grip); game.sound?.hit('block', 0.45); });
  cue(A.grab + 0.05, () => { // the phone out of his hand
    const g = sc.phone.group, v = new THREE.Vector3();
    g.updateWorldMatrix(true, false);
    v.setFromMatrixPosition(g.matrixWorld);
    game.scene.add(g);
    g.position.copy(v);
    sc.drop = { t0: A.grab + 0.05, x: v.x, y: v.y, z: v.z, hit: false, done: false };
  });
  for (const [t, name] of [[0.2, 'wrenchL'], [0.75, 'wrenchR'], [1.3, 'wrenchL']]) cue(A.grab + t, act(name));
  cue(A.drag, () => { m.s.dragAt = m.s.t; n.model.setPose('dragged'); n.model.play('wrenchR'); for (const man of sc.men) man.npc.model.setPose(man.haul); });
  cue(A.drag + 0.12, () => { sc.track = 'drag'; cut(game, dragShot(sc)); });
  cue(A.drag + 0.25, says(3));
  for (const [t, name] of [[0.75, 'dragkickL'], [1.2, 'dragkickR'], [1.5, 'wrenchL'], [1.9, 'wrenchR'], [2.55, 'dragkickL'], [2.95, 'dragkickR'], [3.25, 'wrenchR'], [3.62, 'wrenchL'], [4.25, 'dragkickL'], [4.65, 'dragkickR']]) cue(A.drag + t, act(name));
  cue(A.door + 0.05, () => { n.model.setPose('bundled'); for (const man of sc.men) { man.npc.model.setPose(null); man.npc.model.play('shove'); } });
  cue(A.inside, () => { m.s.insideAt = m.s.t; n.model.setPose(null); lean(n); n.enter(van); });
  cue(A.door + 0.62, sound('bag', 0.9));                        // the back door
  cue(A.door + 1.15, sound('bag', 0.8));                        // the front one
  cue(A.away, () => game.sound?.rev(3.4, 0.2));
  cue(A.away + 0.25, () => { sc.track = 'away'; const from = sc.off(sc.land, -1.15, 0.25); cut(game, [{ ...from, y: F.y + 0.5 }, { x: van.pos.x, y: F.y + 0.75, z: van.pos.z }]); });
  cue(A.fade, () => { m.s.faded = true; m.s.fadeAt = m.t; game.hud.fade('באותו ערב · המכון של ארז', () => toGym(m, game), 1600); });
  sc.cues.sort((a, b) => a[0] - b[0]);

  cut(game, SHOTS.walk);
  m.s.staged = true;
}

// the travelling shot of the drag: ahead of his feet and to one side, a little above, going along with them
function dragShot(sc) {
  const from = sc.off(sc.heels, -3.0, 1.5), look = sc.off(sc.heels, 0.35, 0);
  return [{ ...from, y: sc.F.y + 2.25 }, { ...look, y: sc.F.y + 1.0 }];
}

// one frame of it, from the scene's clock
function play(m, game, dt) {
  const sc = m.sc, A = sc.at, t = (m.s.t += dt);
  while (sc.cue < sc.cues.length && sc.cues[sc.cue][0] <= t) sc.cues[sc.cue++][1]();
  if (m.sc !== sc) return; // (a cue ended the scene)
  m.s.phase = t < A.van ? 'stroll' : t < A.stop ? 'arrive' : t < A.grab ? 'out' : t < A.drag ? 'grab' : t < A.door ? 'drag' : t < A.away ? 'load' : 'away';
  moveCar(m, t, dt);
  moveHim(m, game, t);
  moveMen(m, t);
  movePhone(m, game, t);
  // the camera goes along with the drag, and then watches the car go from beside the phone
  const o = game.follow.override;
  if (o && sc.track === 'drag') { const [from, look] = dragShot(sc); o.from.set(from.x, from.y, from.z); o.look.set(look.x, look.y, look.z); }
  if (o && sc.track === 'away' && m.van) { const k = 1 - Math.exp(-3 * dt), v = m.van.pos; o.look.x += (v.x - o.look.x) * k; o.look.z += (v.z - o.look.z) * k; }
}

// the dark car: in at speed and braked hard round the turn, its tail stepping out; at rest across the plaza;
// then out again as fast as it will go. Moved along its two lines, never driven
function moveCar(m, t, dt) {
  const sc = m.sc, A = sc.at, van = m.van, C = CAR;
  let on, d, v, dive, slip = 0, braking = true;
  if (t < A.away) {
    const left = A.stop - Math.min(Math.max(t, A.van), A.stop), tb = C.cruise / C.brake, rest = t - A.stop; // seconds to the stop, and since it
    on = sc.in;
    d = left > tb ? sc.inLen - (C.cruise * C.cruise) / (2 * C.brake) - (left - tb) * C.cruise : sc.inLen - 0.5 * C.brake * left * left;
    v = left > tb ? C.cruise : C.brake * left;
    braking = left <= tb;
    slip = 0.3 * Math.sin(Math.PI * clamp01((d - (sc.inLen - 9)) / 9));
    dive = rest < 0 ? (braking ? 0.05 * clamp01((tb - left) / 0.25) : 0) : 0.05 * Math.exp(-6 * rest) * Math.cos(13 * rest); // it rocks back on its springs
  } else {
    const w = t - A.away, tv = C.top / C.pull;
    on = sc.out;
    d = 1.5 + (w < tv ? 0.5 * C.pull * w * w : 0.5 * C.pull * tv * tv + C.top * (w - tv));
    v = Math.min(C.top, C.pull * w);
    braking = false;
    dive = -0.035 * clamp01(w / 0.3) * (w < tv ? 1 : 0);
  }
  const p = on.pose(d), bend = on.pose(d + 0.5).yaw - on.pose(d - 0.5).yaw, curve = Math.atan2(Math.sin(bend), Math.cos(bend));
  van.pos.x = p.x; van.pos.z = p.z; van.yaw = p.yaw + slip;
  van.pos.y = van.groundUnder();
  van.speed = v; van.braking = braking; van.dive = dive;
  van.steer = Math.max(-0.6, Math.min(0.6, Math.atan(2.57 * curve) - slip * 1.4));
  van.lean = Math.max(-0.08, Math.min(0.08, curve * v * v * 0.012));
  van.sync(dt);
  sc.lamps.set(ease((t - A.van) / 0.7));
}

// Nehorai: the walk, the turn to the car, the half step away, held, dragged, in
function moveHim(m, game, t) {
  const sc = m.sc, A = sc.at, n = game.npc('nehorai');
  if (n.inCar) return;
  const back = sc.yawT + Math.PI; // facing away from the car, as he is held and dragged
  if (t < A.lunge) {
    // an evening walk; he stops, hears the car and turns round to it; a step back as it stops
    const k = clamp01(t / WALK), f = k <= 0.7 ? 1.176 * k : 1 - 1.96 * (1 - k) * (1 - k);
    const p = mix(mix(sc.from, sc.spot, f), sc.held, 0.4 * ease((t - A.stop - 0.1) / 0.45));
    put(n, p, sc.west + Math.PI * ease((t - A.notice) / 0.6));
    lean(n);
  } else if (t < A.grab) {
    // he turns to run: half a step, no more
    const k = (t - A.lunge) / (A.grab - A.lunge);
    put(n, mix(mix(sc.spot, sc.held, 0.4), sc.held, ease(k)), turn(sc.west + Math.PI * (1 + ease(k / 0.75)), back, ease(k)));
    lean(n, 0.12 * ease(k), 0);
  } else if (t < A.drag) {
    // held by both arms: feet planted, heaving and twisting against the two of them
    const w = t - A.grab, sway = Math.sin(w * 11) * 0.05 + Math.sin(w * 6.3 + 1) * 0.04, surge = Math.sin(w * 7.5) * 0.07;
    sc.sway = sway; sc.surge = surge;
    put(n, sc.off(sc.held, -surge, sway), back + 0.36 * Math.sin(w * 8.2) + 0.14 * Math.sin(w * 13), false);
    lean(n, 0.2 + 0.08 * Math.sin(w * 7.5), 0.1 * Math.sin(w * 8.2 + 0.6));
  } else if (t < A.door) {
    // dragged: off his balance backwards, his heels along the paving; when he digs them in the three of them stop
    const u = t - A.drag, q = hauled(u) * sc.len, dig = digging(u);
    sc.heels = sc.off(sc.held, q, 0);
    sc.dig = dig; m.s.hauled = q;
    put(n, sc.off(sc.heels, 0, 0.05 * Math.sin(u * 6.1)), back + (0.16 + 0.34 * dig) * Math.sin(u * 9.4) + 0.08 * Math.sin(u * 5.1 + 1), false);
    lean(n, 0.2 + (-(0.5 - 0.2 * dig) - 0.2) * ease(u / 0.45) + 0.03 * Math.sin(u * 8), 0.07 * Math.sin(u * 7.3) + 0.08 * dig * Math.sin(u * 12));
  } else {
    // at the door: pushed in backwards
    const k = ease((t - A.door) / (A.inside - A.door));
    sc.heels = sc.door; m.s.hauled = sc.len;
    put(n, sc.off(sc.door, 1.05 * k, 0), back, false);
    lean(n, -0.5 + 0.35 * k, 0);
  }
}

// Kotzi's two: out of the car, at him from both sides, an arm each, hauling him to the car, in after him
function moveMen(m, t) {
  const sc = m.sc, A = sc.at, back = sc.yawT + Math.PI;
  for (const man of sc.men) {
    const g = man.npc, sd = man.side;
    if (g.inCar || t < man.out || !man.door) continue;
    const flank = sc.off(sc.spot, 1.2, sd * 1.05), close = sc.off(sc.spot, 0.85, sd * 0.9), hold = sc.off(sc.held, 0.22, sd * 0.52);
    if (t < A.lunge + 0.08) {
      // out and at him: a run to his side, then closing in slowly, eyes on him
      const k = clamp01((t - man.out) / 0.85), run = 1 - (1 - k) * (1 - k), p = mix(mix(man.door, flank, run), close, ease((t - man.out - 0.85) / (A.lunge - man.out - 0.85)));
      put(g, p, k < 1 ? turn(facing(man.door, flank), facing(p, sc.spot), ease((k - 0.6) / 0.4)) : facing(p, sc.spot));
      lean(g);
    } else if (t < A.grab) {
      const k = ease((t - A.lunge - 0.08) / (A.grab - A.lunge - 0.08)), p = mix(close, hold, k);
      put(g, p, turn(facing(close, sc.spot), back + sd * 0.5, k));
      lean(g, 0.1 * k, 0);
    } else if (t < A.drag) {
      // an arm each: braced against his pulling
      put(g, sc.off(hold, -sc.surge * 0.5, sc.sway * 0.6), back + sd * 0.5 + 0.05 * Math.sin((t - A.grab) * 9 + sd), false);
      lean(g, -0.1 - 0.05 * Math.sin((t - A.grab) * 7.5), 0);
    } else if (t < A.door) {
      // ahead of him, pulling: they turn to the car and walk; held back for a moment each time he digs in
      const u = t - A.drag, dig = sc.dig || 0;
      put(g, sc.off(sc.heels, 0.22 + 0.4 * ease(u / 0.4) - 0.12 * dig + 0.03 * Math.sin(u * 8 + sd), sd * (0.52 + 0.03 * dig)), turn(back + sd * 0.5, sc.yawT - sd * 0.12, ease(u / 0.3)));
      lean(g, -0.1 + 0.26 * ease(u / 0.35) + 0.14 * dig, 0);
    } else {
      // at the door: they stand aside and push him in, then get in themselves (the one at the front runs round to his door)
      const w = t - A.door, seat = man.front ? man.door : sc.off(sc.door, 0.7, 0), k = ease(w / 0.3), go = ease((w - 0.5) / (man.in - A.door - 0.5));
      const aside = sc.off(sc.door, 0.32, sd * 0.82), p = mix(sc.off(sc.door, 0.62 - 0.3 * k, sd * (0.52 + 0.3 * k)), seat, go);
      put(g, p, turn(turn(sc.yawT - sd * 0.12, sc.yawT - sd * 1.2, k), facing(aside, seat), go));
      lean(g, 0.16 * (1 - k), 0);
    }
  }
}

// the phone: out of his hand as they pin his arms, down to the paving, and there it lies, lit
function movePhone(m, game, t) {
  const sc = m.sc, d = sc.drop;
  if (!d || d.done) return;
  const g = sc.phone.group, k = (t - d.t0) / 0.42, y0 = sc.F.y + 0.012, L = sc.land;
  if (k < 1) { g.position.set(d.x + (L.x - d.x) * k, d.y + (y0 - d.y) * k * k, d.z + (L.z - d.z) * k); g.rotation.set(-k * 5.2, k * 2.1, k * 1.3); return; }
  const b = (t - d.t0 - 0.42) / 0.16;
  g.position.set(L.x, y0 + (b < 1 ? 0.05 * Math.sin(Math.PI * b) : 0), L.z);
  g.rotation.set(-Math.PI / 2, 0, 0.7); // flat on its back, the screen up
  if (!d.hit) { d.hit = true; sc.phone.glow.visible = true; game.sound?.hit('block', 0.22); }
  if (b >= 1) d.done = true;
}

// whoever the scene hid is back where he stood
function giveBack(m) {
  for (const q of m.sc?.hidden || []) if (!q.visible && !q.inCar) q.show(true);
  if (m.sc) m.sc.hidden.length = 0;
}
// the scene's own things taken down: the car, the phone, the three figures out of their poses and out of sight
function strike(m, game) {
  const sc = m.sc;
  m.sc = null;
  for (const id of CAST) {
    const q = game.npcs.get(id);
    if (!q) continue;
    if (q.inCar) { q.inCar.occupants.delete(id); q.inCar = null; }
    q.model.setPose(null); lean(q);
    q.target = null; q.face = null; q.idle = null;
    q.show(false);
  }
  if (m.van) { game.scene.remove(m.van.model); game.world.cols.dynamic.delete(m.van.box); game.chaseCars = game.chaseCars.filter((c) => c !== m.van); m.van = null; }
  sc?.lamps?.dispose();
  sc?.phone?.dispose();
}
// the cut to the gym, under the black: the lookout is cleared and the game goes on as Erez
function toGym(m, game) {
  if (game.missions.active !== m || m.stepIndex !== 0 || m.s.phase === 'gym') return; // (the black of a scene that is over)
  giveBack(m);
  strike(m, game);
  asErez(game);
  const G = game.world.places;
  game.car.place(G.gymParking.x, G.gymParking.z, G.gymParking.yaw);
  game.start(G.gymInside.x, G.gymInside.z, G.gymInside.yaw);
  game.nehorai.root.visible = true;
  m.s.phase = 'gym'; m.s.gymAt = m.t;
}

export default {
  id: 'taken', chapter: 7, number: 1, title: 'ערב בתצפית', requires: ['cipher'],
  where: 'הליכת ערב בתצפית בקציר',
  // (his double for the scene is made while the marker waits, out of sight: an asset layer that dresses people has
  // done so long before the scene shows him)
  startAt: (game) => { const p = game.world.places.plaza; game.npc('nehorai'); return p ? { x: p.x + p.dx * -3, z: p.z + p.dz * -3, y: p.h } : null; },
  reward: { money: 0, unlocks: ['rescue'], text: 'צוות החילוץ יוצא לדרך · משחקים בתור ארז' },

  setup(m, game) { m.s = {}; game.daylight?.set(1, 0); },
  prepareReplay(game) { asNehorai(game); game.daylight?.set(1, 0); if (game.mode === 'car') game.exitCar(); const p = game.world.places.plaza; game.start(p.x + p.dx * -8, p.z + p.dz * -8, Math.atan2(p.dx, p.dz)); },
  restore(m, game, checkpoint) {
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    giveBack(m); strike(m, game);
    if (!checkpoint) asNehorai(game); // (from the top: himself again, the friends let go; step 0 sets the plaza)
    if (checkpoint === 2) { asErez(game); const G = game.world.places; game.exitCar(); game.car.place(G.gymParking.x, G.gymParking.z, G.gymParking.yaw); game.start(G.gymInside.x, G.gymInside.z, G.gymInside.yaw); team(game, game.player.pos, game.player.yaw); }
  },
  cleanup(m, game) {
    game.cutscene = false; game.follow.override = null;
    giveBack(m); strike(m, game);
    game.nehorai.root.visible = true;
    if (!m.done || !game.missions.carrying) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: the kidnapping, filmed by the game's camera (staged and played above)
      objective: 'ערב בתצפית',
      enter(m, game) {
        game.cutscene = true;
        m.s.phase = 'black'; m.s.staged = false; m.s.faded = false; m.s.t = 0;
        game.hud.banner('קציר', 'התצפית · 21:40', 'נהוראי יוצא להליכת ערב', 3400);
        // a short black, the banner over it, and the plaza is set behind it. His double is made before it. A replay
        // on a fresh page had no marker waiting, so he is new: the black is then held past one round of an asset
        // layer that dresses people (it looks every two seconds), and he is never seen changing
        const fresh = !game.npcs.has('nehorai');
        game.npc('nehorai');
        game.hud.fade('', () => { if (game.missions.active === m && m.stepIndex === 0 && m.s.phase === 'black' && !m.s.staged) stage(m, game); }, fresh ? 2200 : 380);
      },
      update(m, game, dt) {
        game.cutscene = true; // (a scene to its end, whatever a menu did meanwhile)
        if (m.s.phase === 'black') {
          if (!m.s.staged && m.t > 2.5) stage(m, game); // (the black's own timer never came: set anyway)
          if (m.s.staged && (!game.hud.fading || m.t > 5)) { m.s.phase = 'stroll'; m.s.t = 0; }
        } else if (m.sc) play(m, game, dt);
        if (m.s.faded && m.s.phase !== 'gym' && m.t - m.s.fadeAt > 4) toGym(m, game); // (nor did the last one's)
        say(m, game, m.s.phase === 'gym' ? 'במכון' : 'ערב בתצפית');
        return m.s.phase === 'gym' && (!game.hud.fading || m.t - m.s.gymAt > 6) ? 'next' : null;
      },
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the team comes in, one by one; Erez's words
      objective: 'המכון: החבורה מתכנסת',
      enter(m, game) {
        const G = game.world.places, me = game.player.pos;
        game.cutscene = true;
        game.hud.banner('ארז', 'המכון · 23:10', 'משחקים בתור ארז', 3000);
        // Ido is already there; the rest come in through the door, one per line
        const ido = game.npc('ido'); ido.floorY = null; ido.place(me.x + 1.6, me.z + 1.2, Math.atan2(me.x - (me.x + 1.6), me.z - (me.z + 1.2))); ido.idle = 'arms'; ido.show(true);
        game.follow.shot({ x: me.x - 3, y: me.y + 2.2, z: me.z + 4 }, { x: me.x + 0.8, y: me.y + 1.2, z: me.z + 0.6 }, 9999);
        const door = G.gymDoor || { x: me.x, z: me.z + 9 };
        // this entry's own chain of lines: the mission left (or the step entered again) ends it, so nobody comes
        // running into another scene and no shot is set after it
        const chain = (m.s.chain = {}), on = () => game.missions.active === m && m.stepIndex === 1 && m.s.chain === chain;
        game.dialogue.play(GYM).then(async () => {
          if (!on()) return;
          const others = TEAM.filter((id) => id !== 'ido');
          for (const [i, id] of others.entries()) {
            const n = game.npc(id), slot = game.squad.slot(i + 1, me, game.player.yaw);
            n.floorY = null; n.place(door.x + (i % 2 ? 1 : -1), door.z, 0); n.idle = null; n.show(true);
            n.walkTo(slot.x, slot.z, { run: true, near: 0.8, onArrive: () => { n.target = null; n.lookAt(me.x, me.z); n.idle = 'arms'; } });
            await game.dialogue.play([ARRIVALS[i]]);
            if (!on()) return;
          }
          game.follow.shot({ x: me.x + 4, y: me.y + 2.0, z: me.z - 4 }, { x: me.x, y: me.y + 1.3, z: me.z }, 9999);
          await game.dialogue.play(SPEECH);
          if (on()) m.s.spoke = true;
        });
      },
      update: (m) => (m.s.spoke ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); team(game, game.player.pos, game.player.yaw); },
    },
    { // 2: out to the quarry
      objective: 'לנסוע למחצבה הנטושה, מזרחה, עם כולם', checkpoint: true,
      target: (m, game) => { const Q = game.world.places.quarry; return game.mode === 'car' ? { ...Q.parking, r: 6 } : { ...game.car.pos, r: 2.6 }; },
      update(m, game) {
        const Q = game.world.places.quarry;
        say(m, game, game.mode === 'car' ? 'לנסוע למחצבה: דרך הכרמים ואז דרך המחצבה, מזרחה' : 'להיכנס לרנו · החבורה מאחוריך');
        return game.mode === 'car' && near(game.car.pos, Q.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
