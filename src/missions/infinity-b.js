// Shared pieces of chapter ten's group b (missions 50–53: the fall in the citadel's main hall, the rift, the olive
// grove and its secret). Here: the citadel as the gang left it after the assault (mission 49) and as it was built,
// the main hall's points by the tower's own coordinates, the Shadow in person, Muller at the main computer (the
// radio's other end), a friend's paint shot at something that is not a guard, the hurt look (the daze and the
// heartbeat) and the gang's door team. Paint, never blood; nobody of the gang betrays and nobody of the gang dies.
// Invented, all of it.
import * as THREE from 'three';
import { COLORS } from '../combat/paint.js';
import { TEAM } from './infinity.js';

export const Z = (game) => game.world.places.citadel;
export const HALL = (game) => Z(game).mainHall;
// a point of the main hall by the tower's coordinates: lx 32 (the west door) .. 112 (the screen), lz -36 (north,
// the left as one comes in) .. 36 (south, the right; the first-aid box's wall)
export function H(game, lx, lz, yaw) { const h = HALL(game); return { x: h.centre.x + lx - 72, z: h.centre.z + lz, y: h.y, ...(yaw != null ? { yaw } : {}) }; }
export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const inHall = (game, p = game.player.pos) => { const h = HALL(game), lx = p.x - h.centre.x + 72, lz = p.z - h.centre.z; return lx > 32.6 && lx < 111.6 && Math.abs(lz) < 35.6 && Math.abs(p.y - h.y) < 2.5; };

// ---------- the citadel ----------
// as the assault (mission 49) left it: in by the service gate, the alarm off, the lift powered and down in the
// tunnels, the inner gate up; the main gate, the tower's upper ways and the way out as built. `hallDoor`: the main
// hall's door open (it is the way in from the inner compound)
export function citadelTaken(game, { hallDoor = true } = {}) {
  const C = Z(game);
  if (C.destroyed || C.falling) C.restore();
  C.gates.main.lock(); C.gates.service.open(); C.innerGate.open();
  C.alarm.on(false); game.fx.redAlert?.(false);
  C.lift.setPower(true); C.lift.set('bottom');
  C.towerBridge.restore(); C.wayOut.leap.guard(true); C.wayOut.throwSwitch(0, false); C.wayOut.throwSwitch(1, false);
  for (const d of [C.energyHall.door, C.machine.upperDoor, C.lastHall.exit.door]) d.lock();
  for (const d of [...C.stores.doors, C.alarm.door, ...C.control.doors]) { d.unlock(); d.setOpen(true); }
  const door = C.mainHall.door; if (hallDoor) { door.unlock(); door.setOpen(true); } else door.lock();
  for (const e of C.mainHall.defence.emitters) e.set('#3a2a66');
  for (const n of C.mainHall.defence.nodes) n.set(true);
}
// as the site was built (a mission put away that does not hand on to the next)
export function citadelAsBuilt(game) {
  const C = Z(game);
  if (C.destroyed || C.falling) C.restore();
  C.gates.main.lock(); C.gates.service.lock(); C.innerGate.lock();
  C.wayOut.throwSwitch(0, false); C.wayOut.throwSwitch(1, false);
  for (const d of [C.mainHall.door, C.energyHall.door, C.machine.upperDoor, C.lastHall.exit.door]) d.lock();
  for (const d of [...C.stores.doors, C.alarm.door, ...C.control.doors]) { d.unlock(); d.setOpen(true); }
  C.towerBridge.restore(); C.wayOut.leap.guard(true); C.lift.setPower(false); C.lift.set('top'); C.alarm.on(false);
  C.mainHall.screen.show('off');
  for (const e of C.mainHall.defence.emitters) e.set('#3a2a66');
  for (const n of C.mainHall.defence.nodes) n.set(true);
}
// the morning of the battle over the citadel (the red sky of the far blast, mission 48), the ordinary world
export function battleSky(game) {
  if (game.dimensionName) game.dimension(null);
  game.daylight?.set?.(0, 0);
  if (game.daylight?.presetName !== 'redSky') game.daylight?.preset?.('redSky', { seconds: 0 });
}

// ---------- people ----------
// the Shadow in person, standing at a spot (in his own clothes: the energy suit is mission 57's)
export function shadowIn(game, at, yaw = at.yaw ?? 0) {
  const n = game.npc('shadow');
  n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null;
  n.model.setPose(null); n.model.setArmor?.(false);
  n.place(at.x, at.z, yaw, at.y ?? null); n.show(true); n.body.enabled = true;
  return n;
}
export function shadowOut(game) { const n = game.npc('shadow'); n.target = null; n.idle = null; n.posed = false; n.model.setPose(null); n.show(false); }
// Muller at the main computer in control room B (mission 49 left him there): the radio's other end. He is out of
// the squad (he does not follow), not armed, and the gang's lines from him come 'phone'
export function mullerAtComputer(game) {
  const C = Z(game), at = C.computer.at, n = game.npc('muller');
  game.squad.tasks.delete('muller'); game.squad.ids = game.squad.ids.filter((id) => id !== 'muller');
  game.paint.removeAlly(n);
  n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null);
  n.place(at.x, at.z, at.yaw ?? yawTo(at, C.computer.pos), at.y ?? null); n.show(true);
  n.lookAt(C.computer.pos.x, C.computer.pos.z);
  return n;
}
export const GANG = TEAM.filter((id) => id !== 'muller');

// a friend's paint shot at something that is not a guard (an emitter, the Shadow): the tracer from his marker,
// paint where it lands (on a body when `body` is given: { pos, yaw, model }), the sound. Nothing is counted
export function shotAt(game, n, to, { body = null, spread = 0.05 } = {}) {
  if (!n?.visible || n.inCar) return null;
  const yaw = Math.atan2(to.x - n.pos.x, to.z - n.pos.z);
  if (!n.target) n.yaw = yaw;
  n.model.setPose('aim');
  const from = new THREE.Vector3(n.pos.x + Math.sin(yaw) * 0.45, n.pos.y + 1.32, n.pos.z + Math.cos(yaw) * 0.45);
  return game.paint.pellet(from, new THREE.Vector3(to.x, to.y, to.z), n, { color: COLORS[n.id] || COLORS.ido, targets: body ? [body] : [], spread, range: 40 });
}

// ---------- Nehorai hurt ----------
// the daze (0 clear .. 1 badly) and the heartbeat with it; 0 ends both
export function hurtLook(game, k, seconds = 0.8) {
  game.overlay?.daze(k, seconds);
  if (k > 0.05) game.sound?.heartbeat?.(true, { bpm: Math.round(58 + k * 30), level: 0.25 + k * 0.35 });
  else game.sound?.heartbeat?.(false);
}
