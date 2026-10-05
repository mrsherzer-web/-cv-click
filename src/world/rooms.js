// ============================================================================
//  The camera rooms of the club. Each room is its own small scene.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import * as P from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Room {
  constructor(id, { fog = 0x040405, fogDensity = 0.07, ambient = 0.13, hemi = 0x5a6070 } = {}) {
    this.id = id;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020202);
    this.scene.fog = new THREE.FogExp2(fog, fogDensity);
    this.scene.add(new THREE.HemisphereLight(hemi, 0x080604, ambient * 4));
    this.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 60);
    this.lamps = [];
    this.spots = {};
    this.panAmp = 0.1;
    this.panSpeed = 0.22;
    this.flicker = 0.25;
    this.nightDecor = [];
    this.updaters = [];
  }
  setCam(pos, target, fov = 68) {
    this.camera.position.copy(pos);
    this.camera.fov = fov;
    const d = target.clone().sub(pos);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateProjectionMatrix();
  }
  add(o, x = 0, y = 0, z = 0, ry = 0) {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    this.scene.add(o);
    return o;
  }
  lamp(l, x, y, z, ry = 0) {
    this.add(l, x, y, z, ry);
    l.seed = Math.random() * 100;
    this.lamps.push(l);
    return l;
  }
  /** decor that only exists from a given night on */
  decorFrom(night, obj) {
    obj.visible = false;
    this.nightDecor.push([night, obj]);
    return obj;
  }
  setNight(n) {
    this.nightDecor.forEach(([from, o]) => (o.visible = n >= from));
  }
  update(t, dt, active) {
    if (!active) return;
    this.camera.rotation.y = this.yaw + Math.sin(t * this.panSpeed) * this.panAmp;
    this.lamps.forEach((l) => P.setLamp(l, P.flickerFactor(t, l.seed, this.flicker) * (this.dim ?? 1)));
    this.updaters.forEach((f) => f(t, dt));
  }
}

const posterTex = (assets, key) => assets.tex[key];

function neon(text, color, glow, w, h, font = '400 120px "Rubik Wet Paint"') {
  return P.sign(T.textTexture([text], { w: 1024, h: 256, bg: null, color, glow, font }), w, h, 2.2);
}

// ---------------------------------------------------------------- CAM 1
function mainHall(A) {
  const r = new Room('main', { fogDensity: 0.055 });
  const W = 12, D = 10, H = 3.2;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.wallpaper(), floor: T.woodFloor(), ceil: T.ceilingTiles(true) }));
  r.add(P.snookerTable({ bloody: true }), 0, 0, -2.6);
  r.add(P.snookerTable({ scatter: true }), -3.3, 0, 1.4);
  r.add(P.snookerTable(), 3.3, 0, 1.4);
  r.lamp(P.pendantLamp({ intensity: 16 }), 0, H - 1.15, -2.6);
  r.lamp(P.pendantLamp({ intensity: 12, shadow: false }), -3.3, H - 1.15, 1.4);
  r.lamp(P.pendantLamp({ intensity: 12, shadow: false }), 3.3, H - 1.15, 1.4);
  // back wall
  const n = neon('הסנוקר של גפן', '#ff3344', '#ff0022', 3.6, 0.9);
  r.add(n, 0, 2.55, -4.97);
  const nl = new THREE.PointLight(0xff2233, 5, 9, 1.6);
  r.add(nl, 0, 2.4, -4.4);
  r.updaters.push((t) => {
    const f = Math.sin(t * 23) > 0.92 ? 0.25 : 1;
    n.material.color.setScalar(2.2 * f);
    nl.intensity = 5 * f;
  });
  r.add(new THREE.PointLight(0x7fd0ff, 2.2, 7, 1.6), 5.2, 2.2, -2.0);
  r.add(new THREE.PointLight(0xffc890, 2.0, 8, 1.6), -4.5, 2.6, 2.5);
  r.add(P.cueRack(10), -3.6, 0.3, -4.93);
  r.add(P.cueRack(10), 3.8, 0.3, -4.93);
  r.add(P.ballShelf(), -5.2, 0.4, -4.92);
  const sb = P.sign(T.scoreboard(), 1.4, 0.7, 1.6);
  r.add(sb, 5.95, 2.0, -2.0, -Math.PI / 2);
  r.add(P.poster(A.tex.posterDuo, 0.75, 1.34), 5.96, 1.6, 0.6, -Math.PI / 2);
  r.add(P.deadTree(), -5.2, 0, -3.9);
  r.add(P.bench(2.2), -5.6, 0, 0.6, Math.PI / 2);
  r.add(P.exitSign(), 5.95, 2.65, 3.8, -Math.PI / 2);
  const blood = P.decal(T.bloodDecal(7), 1.6, 1.6, 0.9);
  blood.rotation.x = -Math.PI / 2;
  r.add(blood, 1.6, 0.012, 0.2);
  const msg = r.decorFrom(3, P.decal(T.writing('אין לאן לברוח'), 3.2, 0.8, 0.95));
  r.add(msg, -5.97, 1.75, -1.5, Math.PI / 2);
  r.setCam(V(5.5, 2.95, 4.6), V(-0.4, 0.8, -2.4), 66);
  r.spots = {
    gefen0: { pos: [0.25, 0.3, -3.85], h: 1.5, light: 0.85, glow: 2.5 },
    gefen1: { pos: [1.4, 0.3, -0.55], h: 1.5, light: 0.6, glow: 3.5 },
    gefen2: { pos: [4.05, 0.42, 3.05], h: 1.5, light: 0.5, glow: 5, fade: 0.3 },
    cap: { pos: [-1.9, 0.64, -0.9], h: 1.16, light: 0.55, glow: 3.5, fade: 0.35 },
    smiler: { pos: [2.1, 0.72, -1.6], h: 1.06, light: 0.55, glow: 3.5, fade: 0.35 },
  };
  return r;
}

// ---------------------------------------------------------------- CAM 2
function bar(A) {
  const r = new Room('bar', { fogDensity: 0.06 });
  const W = 8, D = 6.5, H = 3;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.wallpaper('#2a1a1a', '#3a2424'), floor: T.woodFloor(true), ceil: T.ceilingTiles() }));
  r.add(P.barCounter(5), -0.3, 0, -1.9);
  r.add(P.bottleShelf(5.5), -0.3, 0, -3.1);
  for (let i = 0; i < 5; i++) r.add(P.stool(), -2.3 + i * 1.0, 0, -1.25);
  for (let i = 0; i < 3; i++) r.lamp(P.bareBulb(2.6), -2 + i * 2, H - 0.6, -1.4);
  r.add(neon('BAR', '#ffb347', '#ff7a00', 1.4, 0.36, '900 150px Heebo'), -0.3, 2.65, -3.2);
  r.add(new THREE.PointLight(0xff9030, 4, 8, 1.6), -0.3, 2.4, -2.6);
  r.add(P.poster(A.tex.posterDuo, 0.85, 1.52), -3.96, 1.55, -1.0, Math.PI / 2);
  // little round table
  const tg = new THREE.Group();
  P.cyl(0.45, 0.45, 0.04, P.M.mahogany, 0, 0.75, 0, tg, 20);
  P.cyl(0.04, 0.05, 0.73, P.M.steel, 0, 0.37, 0, tg, 8);
  P.cyl(0.03, 0.03, 0.26, P.std(0xb0101a, 0.15, 0, { emissive: new THREE.Color(0x500006) }), 0.1, 0.9, 0.05, tg, 10);
  r.add(tg, 2.4, 0, 1.0);
  r.add(P.stool(), 2.9, 0, 1.6);
  const blood = P.decal(T.bloodDecal(11), 1.2, 1.2);
  blood.rotation.x = -Math.PI / 2;
  r.add(blood, 0.6, 0.012, -0.4);
  r.setCam(V(3.6, 2.6, 2.9), V(-0.8, 0.95, -1.6), 66);
  r.spots = {
    cap: { pos: [-0.75, 0.5, -1.15], h: 1.16, light: 0.8, glow: 2.5, fade: 0.25 },
    smiler: { pos: [0.45, 0.58, -1.15], h: 1.06, light: 0.8, glow: 2.5, fade: 0.25 },
  };
  return r;
}

// ---------------------------------------------------------------- CAM 3
function vip(A) {
  const r = new Room('vip', { fogDensity: 0.06 });
  const W = 6.5, D = 5.5, H = 2.9;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.wallpaper('#2a0d12', '#3d141b'), floor: T.woodFloor(true), ceil: T.ceilingTiles() }));
  r.add(P.snookerTable({ length: 3.0, width: 1.6 }), 0.3, 0, -0.6);
  r.lamp(P.pendantLamp({ shades: 2, intensity: 11 }), 0.3, H - 1.1, -0.6);
  // red curtains
  const cm = new THREE.MeshStandardMaterial({ map: T.tex(T.curtain(), { repeat: [3, 1] }), roughness: 0.9 });
  const cur = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.8, 64, 1), cm);
  const p = cur.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.06);
  cur.geometry.computeVertexNormals();
  r.add(cur, 0, 1.4, -2.65);
  r.add(P.sofa(2.2), -2.6, 0, 0.6, Math.PI / 2);
  // trophy cabinet with the old photo of Gefen
  const cab = new THREE.Group();
  P.box(1.2, 1.9, 0.4, P.M.darkWood, 0, 0.95, 0, cab);
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Group();
    P.cyl(0.07, 0.03, 0.14, P.M.gold, 0, 0.12, 0, cup, 12);
    P.cyl(0.05, 0.06, 0.05, P.M.gold, 0, 0.03, 0, cup, 12);
    cup.position.set(-0.35 + i * 0.35, 1.2, 0.12);
    cab.add(cup);
  }
  const photo = P.poster(A.tex.gefenPhoto, 0.42, 0.56, { frameColor: 0x8a6a2a });
  photo.position.set(0, 0.65, 0.21);
  cab.add(photo);
  r.vipPhoto = photo;
  r.add(cab, 3.0, 0, -1.6, -Math.PI / 2);
  r.add(new THREE.PointLight(0xff4060, 2.5, 7, 1.6), 0, 2.2, -2.0);
  r.add(P.sign(T.textTexture(['VIP'], { w: 256, h: 128, bg: null, color: '#ffd166', glow: '#ff9f1c', font: '900 100px Heebo', rtl: false }), 0.8, 0.4, 2), 0, 2.45, -2.6);
  r.setCam(V(2.8, 2.5, 2.4), V(-0.7, 0.8, -1.0), 68);
  r.spots = {
    smiler: { pos: [-1.6, 0.72, -1.1], h: 1.06, light: 0.55, glow: 3.5, fade: 0.3 },
    cap: { pos: [-1.0, 0.64, 0.6], h: 1.16, light: 0.5, glow: 3.5, fade: 0.3 },
  };
  r.setNightHook = (n) => (photo.surface.material.map = n >= 3 ? A.tex.gefenScaryPhoto : A.tex.gefenPhoto);
  return r;
}

// ---------------------------------------------------------------- CAM 4
function storage(A) {
  const r = new Room('storage', { fogDensity: 0.09 });
  const W = 5.5, D = 5, H = 2.7;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.plainWall('#3e3a34'), floor: T.plainWall('#2c2a27'), ceil: T.plainWall('#2a2826') }));
  r.add(P.shelfUnit(1.8), -1.2, 0, -2.2);
  r.add(P.shelfUnit(1.6), -2.45, 0, 0.2, Math.PI / 2);
  r.add(P.snookerTable({ length: 2.6, width: 1.4, cover: true }), 1.2, 0, -0.8, 0.2);
  // the box of the black ball (where it all started)
  const crate = P.box(0.6, 0.5, 0.5, new THREE.MeshStandardMaterial({ map: T.tex(T.cardboard()), roughness: 0.9 }), 1.9, 0.25, 1.4);
  r.scene.add(crate);
  const ballBox = new THREE.Group();
  P.box(0.3, 0.1, 0.22, P.std(0x1a0c06, 0.6), 0, 0.05, 0, ballBox);
  const blackBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), P.std(0x050505, 0.15, 0.2));
  blackBall.position.y = 0.13;
  ballBox.add(blackBall);
  const aura = new THREE.PointLight(0x7a00ff, 0.6, 2.5, 2);
  aura.position.y = 0.3;
  ballBox.add(aura);
  r.add(ballBox, 1.9, 0.5, 1.4);
  r.updaters.push((t) => (aura.intensity = 0.45 + Math.sin(t * 2.3) * 0.25));
  for (let i = 0; i < 5; i++) {
    const c = P.cyl(0.008, 0.014, 1.45, P.std(0xc9a676, 0.5), -2.4 + i * 0.07, 0.72, -2.3, r.scene, 6);
    c.rotation.z = 0.15 + i * 0.03;
  }
  r.lamp(P.bareBulb(3.2), 0, H - 0.45, 0);
  r.flicker = 0.7;
  r.setCam(V(2.3, 2.35, 2.2), V(-0.8, 0.7, -0.9), 70);
  r.spots = {
    cap: { pos: [-0.3, 0.64, -0.6], h: 1.16, light: 0.6, glow: 3.5, fade: 0.3 },
  };
  return r;
}

// ---------------------------------------------------------------- CAM 5
function restroom(A) {
  const r = new Room('restroom', { fogDensity: 0.07 });
  const W = 4.6, D = 4.2, H = 2.6;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.bathTiles(), floor: T.bathTiles(), ceil: T.ceilingTiles(), wallRepeat: 1.2 }));
  // stalls along the back wall
  for (let i = 0; i < 3; i++) {
    const x = -1.2 + i * 1.05;
    P.box(0.04, 1.9, 1.3, P.std(0x5a6b72, 0.6), x - 0.5, 1.05, -1.45, r.scene);
    const door = P.box(0.92, 1.7, 0.04, P.std(0x6a7b82, 0.6), x, 1.0, -0.82, r.scene);
    door.rotation.y = i === 1 ? -0.9 : 0;
    if (i === 1) door.position.x += 0.35;
  }
  // sinks + mirror on the left wall
  for (let i = 0; i < 2; i++) {
    const s = P.box(0.5, 0.15, 0.4, P.M.white, -2.05, 0.85, 0.2 + i * 0.8);
    r.scene.add(s);
  }
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), P.std(0x9aa8ae, 0.08, 0.95));
  r.add(mirror, -2.28, 1.6, 0.6, Math.PI / 2);
  const msg = r.decorFrom(2, P.decal(T.writing('אין לאן לברוח'), 1.4, 0.35));
  r.add(msg, -2.26, 1.62, 0.6, Math.PI / 2);
  r.lamp(P.fluorescent(5.5), 0, H - 0.06, 0);
  r.flicker = 0.85;
  r.setCam(V(1.95, 2.25, 1.75), V(-0.9, 0.85, -1.0), 72);
  r.spots = {
    smiler: { pos: [-0.35, 0.72, -0.25], h: 1.06, light: 0.75, glow: 3, fade: 0.3 },
  };
  return r;
}

// ---------------------------------------------------------------- halls
function hall(A, side) {
  const id = side === 'left' ? 'hallL' : 'hallR';
  const r = new Room(id, { fogDensity: 0.085 });
  const W = 2.4, D = 13, H = 2.8;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.wallpaper('#1f2522', '#283029'), floor: T.woodFloor(true), ceil: T.ceilingTiles(true) }));
  for (let i = 0; i < 3; i++) r.lamp(P.fluorescent(3.2), 0, H - 0.05, -4.5 + i * 4);
  r.flicker = 0.6;
  for (let i = 0; i < 3; i++) {
    const d = P.woodenDoor();
    r.add(d, (i % 2 ? 1 : -1) * 1.19, 0, -4 + i * 3.2, (i % 2 ? -1 : 1) * Math.PI / 2);
  }
  const ex = P.exitSign();
  r.add(ex, 0, 2.5, -6.45);
  if (side === 'left') {
    r.add(P.poster(A.tex.posterDuo, 0.6, 1.07), -1.18, 1.5, -1.0, Math.PI / 2);
    r.add(P.cueRack(6), 1.17, 0.4, 0.8, -Math.PI / 2);
  } else {
    // a dead vending machine glowing red
    const vm = new THREE.Group();
    P.box(0.9, 1.9, 0.7, P.std(0x5a0a10, 0.5, 0.3), 0, 0.95, 0, vm);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.2, 0.2) }));
    glass.position.set(-0.1, 1.15, 0.36);
    vm.add(glass);
    r.add(vm, 0.75, 0, -2.2, -Math.PI / 2);
    r.updaters.push((t) => glass.material.color.setRGB(Math.sin(t * 17) > 0.8 ? 0.2 : 1.6, 0.18, 0.18));
    r.add(P.ballShelf(), -1.12, 0.3, 0.6, Math.PI / 2);
  }
  const blood = P.decal(T.bloodDecal(side === 'left' ? 21 : 33), 1.0, 1.4);
  blood.rotation.x = -Math.PI / 2;
  r.add(blood, 0.2, 0.012, 1.5);
  r.decorFrom(4, r.add(P.decal(T.writing('גפן רואה אותך'), 2.4, 0.6), side === 'left' ? 1.18 : -1.18, 1.7, 3.0, side === 'left' ? -Math.PI / 2 : Math.PI / 2));
  r.setCam(V(side === 'left' ? 0.85 : -0.85, 2.5, 6.1), V(0, 1.0, -5), 64);
  r.panAmp = 0.05;
  r.spots = {
    cap: { pos: [-0.25, 0.64, -1.6], h: 1.16, light: 0.65, glow: 4, fade: 0.3 },
    smiler: { pos: [0.25, 0.72, -1.6], h: 1.06, light: 0.65, glow: 4, fade: 0.3 },
    run: { pos: [0, 0.3, -6], h: 1.5, light: 0.7, glow: 6, fade: 0.2 },
  };
  return r;
}

// ---------------------------------------------------------------- corners
function corner(A, side) {
  const id = side === 'left' ? 'cornerL' : 'cornerR';
  const r = new Room(id, { fogDensity: 0.07 });
  const W = 3.4, D = 3.4, H = 2.8;
  r.scene.add(P.roomShell({ w: W, d: D, h: H, wall: T.wallpaper('#1f2522', '#283029'), floor: T.woodFloor(true), ceil: T.ceilingTiles() }));
  r.lamp(P.bareBulb(1.6), -0.3, H - 0.5, -0.3);
  r.flicker = 0.55;
  if (side === 'left') {
    // "club champion" poster of Gefen - it changes on later nights
    const champ = P.poster(A.tex.champion, 0.8, 1.13, { frameColor: 0x6a4a1a });
    r.add(champ, -0.6, 1.55, -1.68);
    r.setNightHook = (n) => (champ.surface.material.map = n >= 3 ? A.tex.championScary : A.tex.champion);
    const ext = new THREE.Group();
    P.cyl(0.08, 0.08, 0.5, P.std(0xa00c0c, 0.4, 0.2), 0, 0.25, 0, ext, 12);
    r.add(ext, -1.6, 0.6, 0.5);
  } else {
    r.add(P.poster(A.tex.newspaper, 0.7, 0.93, { frame: false }), -0.5, 1.5, -1.68);
    const trash = P.cyl(0.22, 0.18, 0.6, P.M.steel, 1.2, 0.3, -1.3, r.scene, 14);
  }
  r.add(P.woodenDoor(1.0, 2.1), side === 'left' ? 1.69 : -1.69, 0, 0.4, side === 'left' ? -Math.PI / 2 : Math.PI / 2);
  const blood = P.decal(T.bloodDecal(side === 'left' ? 41 : 45), 0.9, 0.9);
  blood.rotation.x = -Math.PI / 2;
  r.add(blood, 0.3, 0.012, 0.4);
  r.setCam(V(1.45, 2.45, 1.45), V(-0.9, 0.9, -0.9), 74);
  r.panAmp = 0.06;
  r.spots = {
    cap: { pos: [-0.25, 0.64, -0.35], h: 1.16, light: 0.6, glow: 4.5, fade: 0.3 },
    smiler: { pos: [-0.25, 0.72, -0.35], h: 1.06, light: 0.6, glow: 4.5, fade: 0.3 },
  };
  return r;
}

export function buildRooms(assets) {
  const rooms = {
    main: mainHall(assets),
    bar: bar(assets),
    vip: vip(assets),
    storage: storage(assets),
    restroom: restroom(assets),
    hallL: hall(assets, 'left'),
    hallR: hall(assets, 'right'),
    cornerL: corner(assets, 'left'),
    cornerR: corner(assets, 'right'),
  };
  return rooms;
}

export function setRoomsNight(rooms, n) {
  Object.values(rooms).forEach((r) => {
    r.setNight(n);
    r.setNightHook?.(n);
  });
}
