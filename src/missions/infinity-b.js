// Shared pieces of chapter ten's group b (missions 50–53: the fall in the citadel's main hall, the rift, the olive
// grove and its secret). Here: the citadel as the gang left it after the assault (mission 49) and as it was built,
// the main hall's points by the tower's own coordinates, the Shadow in person, Muller at the main computer (the
// radio's other end), a friend's paint shot at something that is not a guard, the hurt look (the daze and the
// heartbeat) and the gang's door team. Paint, never blood; nobody of the gang betrays and nobody of the gang dies.
// Invented, all of it.
import * as THREE from 'three';
import { COLORS } from '../combat/paint.js';
import { TEAM } from './infinity.js';
import { gangAt, bandage, armWrap, stay } from './phoenix-d.js';

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
// hall's door open (sealed from inside when the gang comes in at +7; the Order opens it from the inner compound
// when the hall's defence wakes); `energyDoor`: the energy hall's door on bridge A open (Muller opened it in 49:
// the way the gang comes into the tower)
export function citadelTaken(game, { hallDoor = true, energyDoor = false } = {}) {
  const C = Z(game);
  if (C.destroyed || C.falling) C.restore();
  C.gates.main.lock(); C.gates.service.open(); C.innerGate.open();
  C.alarm.on(false); game.fx.redAlert?.(false);
  C.lift.setPower(true); C.lift.set('bottom');
  C.towerBridge.restore(); C.wayOut.leap.guard(true); C.wayOut.throwSwitch(0, false); C.wayOut.throwSwitch(1, false);
  for (const d of [C.machine.upperDoor, C.lastHall.exit.door]) d.lock();
  if (energyDoor) { C.energyHall.door.unlock(); C.energyHall.door.setOpen(true); } else C.energyHall.door.lock();
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

// ---------- a prompt kept pressed (holding on to a pillar) ----------
// the interact button (or E / Enter) held down: `held` is true from its press until it is let go. dispose() when
// the step is over
export function keptPressed(game) {
  const el = game.controls?.els?.interact; let ptr = false, key = false;
  const isKey = (e) => { const k = (e.key || '').toLowerCase(); return k === 'e' || k === 'enter'; };
  const dn = (e) => { if (!(e.button > 0)) ptr = true; }, up = () => { ptr = false; };
  const kd = (e) => { if (isKey(e)) key = true; }, ku = (e) => { if (isKey(e)) key = false; };
  el?.addEventListener('pointerdown', dn);
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  return {
    get held() { return ptr || key; },
    dispose() { el?.removeEventListener('pointerdown', dn); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); ptr = key = false; },
  };
}

// ---------- the olive grove's other side (missions 52–54) ----------
export const GROVE = (game) => game.world.places.grove;
// birds in the trees: a few short chirps (synthesized, quiet)
export function birds(game, n = 5) {
  const S = game.sound, ctx = S?.ctx; if (!ctx || !S.master) return;
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 0.5 + Math.random() * 0.35, f = 2500 + Math.random() * 1500, k = 2 + (i % 3);
    for (let j = 0; j < k; j++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + j * 0.12;
      o.type = 'sine'; o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * (1.3 + 0.2 * Math.random()), s + 0.06);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.045, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g); g.connect(S.master); o.start(s); o.stop(s + 0.11);
    }
  }
}
// into the grove's dimension (the violet sky, the two moons, the motes, the fog; the radio dead): the battle's sky
// look dropped first, the site's layer as built (every seal shut), then the first `open` seals opened and their
// symbols lit (a later checkpoint)
export function inGrove(game, { open = 0 } = {}) {
  const Q = GROVE(game);
  game.daylight?.preset?.(null, { seconds: 0 });
  game.dimension('grove');
  Q.reset();
  for (let i = 0; i < open; i++) { Q.symbols[i].light(true); Q.seals[i].open(true); }
  game.rift.static = true;
}
// Nehorai and Erez together over there: Nehorai at `at`, Erez with him as the squad (the rest of the gang stays
// behind in the citadel, out of this world), his own marker in his hands, chapter nine's bandage and the arm wrap on
export function pairAt(game, at, { walk = false } = {}) {
  gangAt(game, at, { ids: ['erez'], walk });
  bandage(game.nehorai, true); armWrap(game.nehorai, true);
  return game.npc('erez');
}
// where mission 52 ends and 53 begins: on the paving two metres short of the first wall of energy (seal 1, where it
// crosses the path at x ≈ 1214; its x there from the seal's own panels), facing it (yaw -π/2)
export function groveWall(game) {
  const Q = GROVE(game), P = Q.path;
  const xs = (Q.seals[1]?.panels || []).flatMap((p) => [p.a, p.b]).filter((q) => q.z > 204 && q.z < 222).map((q) => q.x);
  const X = (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1214) + 2;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    if ((a.x - X) * (b.x - X) <= 0 && a.x !== b.x) { const k = (X - a.x) / (b.x - a.x); return { x: X, z: a.z + (b.z - a.z) * k, y: Q.y, yaw: -Math.PI / 2 }; }
  }
  return { x: X, z: Q.pathStart.z, y: Q.y, yaw: -Math.PI / 2 };
}
// a friend sent somewhere on an errand of the squad's (he does not follow meanwhile), running there from where he
// stands (phoenix-d's stay() alone would put him there at once)
export function runTo(game, id, at, { label = '', face = null, run = true } = {}) {
  const n = game.npc(id), from = { x: n.pos.x, z: n.pos.z, yaw: n.yaw }, was = n.visible;
  stay(game, id, at, { label, face });
  if (was) { n.place(from.x, from.z, from.yaw, at.y); n.target = null; n.walkTo(at.x, at.z, { run, near: 0.3 }); }
  return n;
}
// a spot near `p` (on the floor of height y) where a body of radius r stands free of anything solid: p itself, else
// the nearest free point on rings round it; p when there is none
export function clearSpot(game, p, { y = p.y, r = 0.42, max = 3 } = {}) {
  const W = game.world, q = { x: 0, y, z: 0 };
  const free = (x, z) => { q.x = x; q.z = z; q.y = y; W.cols.resolve(q, r, y, null); return Math.hypot(q.x - x, q.z - z) < 0.03 && Math.abs(W.groundHeight(x, z, y) - y) < 0.4; };
  if (free(p.x, p.z)) return { ...p, y };
  for (let d = 0.6; d <= max; d += 0.6) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d; if (free(x, z)) return { ...p, x, z, y }; }
  return { ...p, y };
}
