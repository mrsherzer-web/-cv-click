// Chapter ten, group a (missions 47-50: the safe house at dawn, the last convoy, the citadel, the fall): the
// pieces these missions share. The operation's three vehicles and who rides in which (Erez at Nehorai's side in
// the Renault, Ido leading the second team in car two, Muller on the Shadow's systems in car three), the morning
// look of 05:30, chapter nine's bandage, a friend standing at a spot with something to do, and the ready-check a
// mission that carries on from the yard (or a road) uses. Built on chapter nine's helpers (phoenix-a: the gang's
// two other cars, the convoy, a walk through doorways, lines that wait their turn; phoenix-d: the bandage, beats).
// Nobody of the gang betrays and nobody of the gang dies. Invented, all of it.
import * as THREE from 'three';
import { TEAM, NAMES, attempt, endCrew, handsOver } from './phoenix.js';
import { gangCars, dropGangCars, parkGangCars, unboardAll, Walk, Chatter, Convoy, inView, handsTo } from './phoenix-a.js';
import { bandage, armWrap, beats, hush } from './phoenix-d.js';
import { COLORS, KINDS, KIND_IDS } from '../combat/paint.js';
import { makePaintGun, GUN_LOOKS } from '../combat/gunModel.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';

export { TEAM, NAMES, attempt, endCrew, handsOver, handsTo, gangCars, dropGangCars, parkGangCars, unboardAll, Walk, Chatter, Convoy, inView, bandage, armWrap, beats, hush };

export const HOME = (game) => game.world.places.safehouse;

// ---------- the operation's three vehicles ----------
// chapter nine had Erez and Ido in the Renault; on the last day Ido leads the second team, so the crews change:
// the Renault: Nehorai driving, Erez and Avraham; car two (gangCars[0]): Ido, Yonati, Hadar; car three
// (gangCars[1]): Muller with his laptop, Dolev, Liam. The two cars are chapter nine's (phoenix-a's gangCars).
export const RENAULT = ['erez', 'avraham'];
export const CREWS = [['ido', 'yonati', 'hadar'], ['muller', 'dolev', 'liam']];
export const CAR_NAMES = ['רכב שתיים', 'רכב שלוש'];
export function carOf(game, id) {
  if (RENAULT.includes(id)) return game.car;
  const k = CREWS.findIndex((c) => c.includes(id));
  return k < 0 ? null : gangCars(game)[k];
}
// the door a friend gets in by: beside his own car (the passenger side for the Renault's two)
export function doorOf(game, id) {
  const car = carOf(game, id), crew = RENAULT.includes(id) ? RENAULT : CREWS.find((c) => c.includes(id)), i = crew.indexOf(id);
  const side = RENAULT.includes(id) ? -1 : (i % 2 ? -1 : 1), back = RENAULT.includes(id) ? (i ? -0.9 : 0.4) : (i === 2 ? -1.0 : 0.3);
  return car.local(side * 1.7, back);
}
// everyone into his own car at once (a cut, a restore)
export function boardAll(game) {
  for (const id of TEAM) { const n = game.npc(id), car = carOf(game, id); if (n.inCar === car) continue; if (n.inCar) n.stepOut(); n.model.setPose(null); n.posed = false; n.idle = null; n.enter(car); }
}
// the operation is in its cars: Nehorai driving the Renault and every friend in his own car. A mission that
// carries on from the yard (48) checks this to take the scene over instead of staging it
export const aboard = (game) => game.mode === 'car' && TEAM.every((id) => game.npc(id).inCar === carOf(game, id));
// the two other cars at their bays in the safe house's yard (behind the Renault)
export function parkYard(game) { const h = HOME(game); parkGangCars(game, h.cars.map((c) => ({ ...c, y: h.y }))); }

// ---------- the look of the morning ----------
// 05:30: the day (not the night) with the sunrise laid over it, at once (fx.resetAtmosphere drops it again)
export function dawn(game) { game.daylight?.set(0, 0); game.daylight?.preset('sunrise', { seconds: 0 }); }

// ---------- Nehorai as chapter nine left him ----------
export function hurt(game, on = true) { bandage(game.nehorai, on); armWrap(game.nehorai, on); }

// ---------- the gang ----------
// the buddies of free roam (who would walk a friend off to the gym) held while the operation has them
export function holdBuddies(game, on = true) { for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (on && game[b]?.active) game[b].leave(); if (game[b]) game[b].held = on; } }
// a friend standing at a spot { x, z, yaw?, y? }, out of any car, with a habit ('phone', 'arms') or a pose
export function standAt(game, id, at, { idle = null, pose = null, face = null } = {}) {
  const n = game.npc(id);
  if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; }
  n.target = null; n.floorY = null; n.face = null; n.idle = idle; n.posed = false; n.model.setPose(pose);
  n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null); n.show(true); n.body.enabled = true;
  if (face) n.lookAt(face.x, face.z);
  return n;
}
// each friend his own marker in his own colour (not the player's: he chooses his at the table)
export function armFriends(game, ids = TEAM) {
  const P = game.paint;
  P.unstash();
  for (const id of ids) { const n = game.npc(id); if (!n.visible || n.inCar) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
// Nehorai's own marker, of the kind chosen (kept in the progress), in his hand
export function armNehorai(game) { const P = game.paint; P.unstash(); if (!P.armed) P.armPlayer(COLORS.nehorai, { kind: P.kind }); }

// ---------- the three markers laid out on a table (mission 47's choice) ----------
// one model of each kind lying on the table, its name over it in the kind's colour; take(kind) hides the one
// taken and shows the one put back; dispose() frees it all. `at` { x, y (the table top), z }, laid along x
export function markerTable(game, at, { gap = 0.82, yaw = Math.PI + 0.25 } = {}) {
  const group = new THREE.Group(); group.name = 'marker-table';
  const items = KIND_IDS.map((kind, i) => {
    const holder = new THREE.Group();
    const gun = makePaintGun({ kind, color: '#2a2d33', hopper: COLORS.nehorai });
    gun.rotation.z = Math.PI / 2; gun.position.set(0, 0.05, -0.12);
    holder.add(gun);
    holder.position.set(at.x + (i - 1) * gap, at.y, at.z); holder.rotation.y = yaw;
    const label = nameTag(KINDS[kind].name, GUN_LOOKS[kind].accent || '#e8e6e1');
    label.position.set(at.x + (i - 1) * gap, at.y + 0.42, at.z);
    group.add(holder, label);
    return { kind, pos: { x: at.x + (i - 1) * gap, y: at.y, z: at.z }, holder, label };
  });
  game.scene.add(group);
  return {
    group, items,
    show(on = true) { group.visible = on; },
    take(kind) { for (const it of items) { it.holder.visible = it.label.visible = it.kind !== kind; } },
    nearest(p, r = 1.3) { let best = null, bd = r; for (const it of items) { if (!it.holder.visible) continue; const d = Math.hypot(p.x - it.pos.x, p.z - it.pos.z); if (d < bd) { bd = d; best = it; } } return best; },
    dispose() {
      group.removeFromParent();
      // a marker's body and steel are materials every marker in the game shares (gunModel.js): found in more than
      // one of the three, they are left alone; a sprite's geometry is three.js's own shared one
      const guns = new Map(); // material -> the guns that use it
      for (const it of items) it.holder.traverse((o) => { if (o.isMesh) { if (!guns.has(o.material)) guns.set(o.material, new Set()); guns.get(o.material).add(it); } });
      group.traverse((o) => {
        if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); return; }
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (guns.get(o.material)?.size === 1) { o.material.dispose(); guns.delete(o.material); }
      });
    },
  };
}
// a small floating name in a colour (a sprite over a thing on a table)
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,18,22,0.72)'; g.beginPath(); g.roundRect?.(6, 8, 244, 56, 14); if (!g.roundRect) g.rect(6, 8, 244, 56); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.fillStyle = color; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 38);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.5, 0.14, 1);
  return s;
}

// ---------- the last road (mission 48, and whoever drives it after) ----------
export const LR = (game) => game.world.places.lastRoad;
// a pose `back` metres behind point i of a route's point list (driving order), facing along it
export function behindOn(pts, i, back) {
  let k = Math.max(0, Math.min(pts.length - 1, i)), left = back;
  while (k > 0) {
    const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
    if (d >= left) { const t = left / (d || 1); return { x: pts[k].x + (pts[k - 1].x - pts[k].x) * t, z: pts[k].z + (pts[k - 1].z - pts[k].z) * t, yaw: Math.atan2(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z), i: k }; }
    left -= d; k--;
  }
  const q = pts[Math.min(1, pts.length - 1)];
  return { x: pts[0].x, z: pts[0].z, yaw: Math.atan2(q.x - pts[0].x, q.z - pts[0].z), i: 0 };
}
export function nearestOn(pts, x, z) { let best = 0, bd = Infinity; for (let k = 0; k < pts.length; k++) { const d = (pts[k].x - x) ** 2 + (pts[k].z - z) ** 2; if (d < bd) { bd = d; best = k; } } return best; }
// the operation on the road at once (a cut): Nehorai driving the Renault (Erez and Avraham with him) at `at`
// { x, z, yaw, y? }, the two other cars 17 and 34 metres behind it along the last road's route `route`, everyone
// in his own car. Returns the points behind the Renault, oldest first, for a Convoy's `behind`
export function stageConvoy(game, at, route = 'convoy') {
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  const pts = LR(game).routes[route], i = nearestOn(pts, at.x, at.z);
  const car = game.car; car.repair(); car.place(at.x, at.z, at.yaw, at.y ?? null);
  game.player.place(at.x - Math.cos(at.yaw) * 2, at.z + Math.sin(at.yaw) * 2, at.yaw, at.y ?? null);
  game.enterCar();
  parkGangCars(game, [behindOn(pts, i, 17), behindOn(pts, i, 34)]);
  boardAll(game);
  const trail = [];
  for (let k = Math.max(0, i - 16); k < i; k++) trail.push({ x: pts[k].x, z: pts[k].z });
  return trail;
}
// everyone of the gang with a marker, in a car or not (a cut on the road: they carry them as they ride)
export function armAll(game) {
  const P = game.paint;
  armNehorai(game);
  for (const id of TEAM) { const n = game.npc(id); if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
// a car taken out of the scene for good, its own meshes freed (the wheels' geometry is shared by every car)
export function freeVehicle(game, v) {
  const keep = new Set((v.model.userData.wheels || []).map((w) => w.spin.geometry));
  v.model.removeFromParent();
  game.world.cols.dynamic.delete(v.box);
  v.model.traverse((o) => { if (o.isMesh) { if (!keep.has(o.geometry)) o.geometry.dispose(); o.material.dispose?.(); } });
  game.chaseCars = game.chaseCars.filter((c) => c !== v);
}
// a car of the Shadow's people coming head-on down a lane (`path`, in its own driving order), horn going; at the
// end of its path it has pulled onto the verge and waits there. hits(car): that car inside its footprint
export class Oncoming {
  constructor(game, path, { color = '#16181d', cruise = 11 } = {}) {
    this.game = game;
    this.car = new Vehicle(game.world, makeHatchback({ color, plates: false }), { name: 'oncoming', maxSpeed: cruise + 3, accel: 7 });
    this.car.tune.armor = 0.5;
    game.scene.add(this.car.model); game.chaseCars.push(this.car);
    const p = path[0], q = path[1]; this.car.place(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z));
    this.ap = new Autopilot(path, { cruise, stopAtEnd: true });
    this.honk = 0;
  }
  get pos() { return this.car.pos; }
  hits(car) {
    const t = this.car, dx = car.pos.x - t.pos.x, dz = car.pos.z - t.pos.z, c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    return Math.abs(dx * c - dz * s) < 2.0 && Math.abs(dx * s + dz * c) < 4.3 && Math.abs(car.pos.y - t.pos.y) < 2.5;
  }
  update(dt) {
    if (this.ap.done) { if (Math.abs(this.car.speed) > 0.1) this.car.update(dt, { brake: 1, hold: true }); return; }
    this.car.update(dt, this.ap.drive(this.car));
    const d = Math.hypot(this.game.car.pos.x - this.car.pos.x, this.game.car.pos.z - this.car.pos.z);
    if ((this.honk -= dt) <= 0 && d < 90) { this.honk = 1.1; this.game.sound?.beep?.(2, 330, 0.22); }
  }
  dispose() { freeVehicle(this.game, this.car); }
}

// ---------- at the citadel's service gate (the end of 48, the start of 49) ----------
// the three cars pulled up on the service road short of the gate (the Renault at gates.service.far, 45 m out),
// and where each of the gang stands on foot in front of them looking at the citadel:
// { renault, cars: [two, three], people: { id: pose }, me }
export function gateSpots(game) {
  const R = LR(game), pts = R.routes.service, f = R.gates.service.far, i = nearestOn(pts, f.x, f.z);
  const ren = behindOn(pts, i, 0), yaw = ren.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx; // (rx, rz): the road's right
  const at = (fwd, side) => ({ x: ren.x + fx * fwd + rx * side, z: ren.z + fz * fwd + rz * side, yaw });
  const ids = ['erez', 'ido', 'muller', 'avraham', 'yonati', 'hadar', 'dolev', 'liam'];
  const slots = [[4.2, -1.6], [4.6, 1.2], [3.2, 3.6], [2.6, -3.4], [1.6, 4.6], [0.6, -4.4], [-0.4, 5.4], [-1.2, -5.0]];
  return {
    renault: { x: ren.x, z: ren.z, yaw },
    cars: [behindOn(pts, i, 9), behindOn(pts, i, 18)].map((c) => ({ x: c.x, z: c.z, yaw: c.yaw })),
    people: Object.fromEntries(ids.map((id, k) => [id, at(...slots[k])])),
    me: at(3.4, -0.2),
  };
}
// the gang out of the cars at the gate at once (a cut): the cars parked, Nehorai on foot in front of the Renault,
// everyone at his spot facing the citadel
export function standAtGate(game) {
  const S = gateSpots(game);
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  game.car.repair(); game.car.place(S.renault.x, S.renault.z, S.renault.yaw);
  parkGangCars(game, S.cars);
  for (const [id, p] of Object.entries(S.people)) standAt(game, id, p);
  game.player.place(S.me.x, S.me.z, S.me.yaw); game.follow.snapBehind(S.me.yaw);
  return S;
}
// the gang as 48 leaves it at the gate: Nehorai on foot, everyone out of the cars at his spot (49 checks this to
// take the scene over instead of staging it)
export const atGate = (game) => {
  if (game.mode !== 'foot') return false;
  const S = gateSpots(game);
  return TEAM.every((id) => { const n = game.npc(id), p = S.people[id]; return !n.inCar && n.visible && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 3; });
};

// ---------- the citadel (mission 49, and whoever goes on inside it) ----------
export const CIT = (game) => game.world.places.citadel;
export const TOWER_AT = { x: 1682, z: 155 }; // the central tower: where the red sky and the smoke point
// the red sky of the morning after the far blast, aimed at the tower, its smoke column standing (at once; a
// second call, a retry, puts the one from before away first)
const SMOKE = new WeakMap();
export function redSky(game) {
  game.daylight?.preset('redSky', { seconds: 0, toward: TOWER_AT });
  const c = CIT(game); SMOKE.get(game)?.stop?.();
  SMOKE.set(game, game.fx.smokeColumn(TOWER_AT.x, (c?.y ?? -49) + 30, TOWER_AT.z, { r: 5, strength: 2, seconds: 900 }));
}
// the citadel as its builder left it (a mission put away that does not hand on): every gate and the inner gate
// locked, the stores, the alarm room and control room B open, the lift up without power, the alarm off, the
// tower standing with its doors locked, the energy plants' pylons lit, the computer on its map
export function citadelReset(game) {
  const C = CIT(game); if (!C) return;
  for (const g of [C.gates.main, C.gates.service, C.innerGate]) { g.shut(); g.lock(); }
  for (const d of [...C.stores.doors, C.alarm.door, ...C.control.doors]) { d.unlock(); d.setOpen(true); }
  C.alarm.on(false); C.lift.setPower(false); C.lift.set('top');
  C.restore();
  for (const d of [C.mainHall.door, C.energyHall.door, C.machine.upperDoor]) { d.setOpen?.(false); d.lock(); }
  for (const p of C.energy.pylons) p.set(true);
  C.computer.screen.show('map');
}
// the end of 49, the start of 50: on bridge A at +7 in front of the energy hall's door on the tower's west face (the
// main door is sealed from inside), Nehorai at the door and the gang behind him along the bridge, all facing east:
// { me, people: { id: pose } }
export function towerDoorSpots(game) {
  const o = CIT(game).energyHall.doorOutside, y = o.y, yaw = Math.PI / 2;
  const ids = ['erez', 'ido', 'muller', 'avraham', 'yonati', 'hadar', 'dolev', 'liam'];
  const people = Object.fromEntries(ids.map((id, k) => [id, { x: o.x - 1.8 - Math.floor(k / 2) * 1.5, z: o.z + (k % 2 ? 0.7 : -0.7), y, yaw }]));
  return { me: { x: o.x, z: o.z, y, yaw }, people };
}
// the gang as 49 leaves it at the energy hall's door (50 checks this to take the scene over instead of staging it)
export const atTowerDoor = (game) => {
  if (game.mode !== 'foot') return false;
  const S = towerDoorSpots(game), me = game.player.pos;
  if (Math.hypot(me.x - S.me.x, me.z - S.me.z) > 4 || Math.abs(me.y - S.me.y) > 1.5) return false;
  return TEAM.every((id) => { const n = game.npc(id); return !n.inCar && n.visible && Math.hypot(n.pos.x - me.x, n.pos.z - me.z) < 14 && Math.abs(n.pos.y - me.y) < 1.5; });
};
// that scene staged at once (a cut): Nehorai at the door, everyone at his spot behind him on the bridge
export function standAtTowerDoor(game) {
  const S = towerDoorSpots(game);
  if (game.mode === 'car') game.exitCar();
  unboardAll(game);
  for (const [id, p] of Object.entries(S.people)) standAt(game, id, p);
  game.player.place(S.me.x, S.me.z, S.me.yaw, S.me.y); game.follow.snapBehind(S.me.yaw);
  return S;
}
