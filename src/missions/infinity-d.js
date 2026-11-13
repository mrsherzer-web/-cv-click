// Shared pieces of chapter ten's last missions (group d: the end of the Shadow, zero hour, the way home): the last
// hall at the top of the central tower and its points, the hall staged as a mission needs it (the tower standing,
// the normal world, the portal engine in a given mode), the gang posted at spots of the hall with their markers,
// a friend's own shot (a real pellet with its tracer), the Shadow put somewhere, and the Shadow tied (ropes round
// his chest and wrists, on whichever model). Paint, never blood: a marked man sits down. Nobody of the gang
// betrays and nobody of the gang dies: every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { COLORS } from '../combat/paint.js';
import { TEAM, NAMES, radio, crew } from './infinity.js';
import { armed, stay, bandage, hush } from './phoenix-d.js';

export { TEAM, NAMES };
export const CIT = (game) => game.world.places.citadel;
export const HALL = (game) => game.world.places.citadel.lastHall;
// a point of the last hall (+21 m, the top storey of the central tower) in the citadel's own coordinates: lx east,
// lz south of the citadel's centre (the hall spans lx 32..112, lz -36..36; the engine stands at its east end)
export function H(game, lx, lz, yaw) { const Z = CIT(game), p = Z.toWorld(lx, lz); return { x: p.x, z: p.z, y: Z.lastHall.y, ...(yaw != null ? { yaw } : {}) }; }
// the hall's own coordinates of a world point (for a mission that thinks in the hall's plan)
export function local(game, p) { const Z = CIT(game); return { lx: p.x - Z.x, lz: p.z - Z.z }; }
export function inHall(game, p = game.player.pos) { const q = local(game, p); return q.lx > 32 && q.lx < 112 && Math.abs(q.lz) < 36 && Math.abs(p.y - HALL(game).y) < 2; }

// ---------- the hall as a mission stages it ----------
// the normal world (no other dimension), daylight, the tower standing with its bridges whole, the emergency door
// locked, the portal engine in `engine` mode ('off' | 'idle' | 'on' | 'overload' | 'dead')
export function hallReady(game, { engine = 'on', music = 'epic' } = {}) {
  const Z = CIT(game);
  if (game.dimensionName) game.dimension(null);
  game.rift?.clear?.();
  if (Z.destroyed || Z.falling) Z.restore();
  Z.towerBridge?.restore?.();
  game.daylight?.preset?.(null, { seconds: 0 });
  game.daylight?.set?.(0, 0);
  const ex = Z.lastHall.exit; ex.door.lock?.(); ex.door.setOpen?.(false); ex.lamp?.set?.('#ff2a2a');
  Z.lastHall.engine.set(engine);
  game.overlay?.mapHidden?.(false);
  if (music !== undefined) game.sound?.music?.(music, { fade: 0.5 });
}

// Nehorai at a spot of the hall, on foot, himself, with chapter ten's bandage
export function nehoraiAt(game, at) {
  if (game.mode === 'car') game.exitCar();
  game.player.crawl?.(false);
  game.player.place(at.x, at.z, at.yaw ?? game.player.yaw, at.y);
  game.follow.override = null; game.follow.snapBehind(at.yaw ?? game.player.yaw);
  bandage(game.nehorai, true);
}

// the gang posted: { id: at } (an errand of the squad's, so nobody follows the leader into the line of fire),
// each with his own marker unless `arm` is false; anyone of the gang not named is put away
export function gangPosted(game, spots, { arm = true, labels = {} } = {}) {
  game.squad.tasks.clear();
  if (!game.squad.active || game.squad.leaderId !== 'nehorai') crew(game, game.player.pos, game.player.yaw, TEAM);
  hush(game);
  for (const id of TEAM) {
    const n = game.npc(id), at = spots[id];
    if (!at) { n.target = null; n.show(false); game.paint.removeAlly(n); continue; }
    stay(game, id, at, { label: labels[id] || 'בעמדה' });
    n.floorY = at.y ?? null;
    n.body.enabled = false; // soft: nobody of the gang is ever in the player's way
  }
  if (arm) armed(game, Object.keys(spots));
}

// a friend's own shot at a point: a real pellet with its tracer and splat (the targets given count for him),
// the friend turned to it with his marker up. Returns what it hit
export function friendShot(game, id, to, targets = []) {
  const n = game.npc(id), P = game.paint;
  if (!n.visible) return {};
  n.lookAt(to.x, to.z); n.yaw = Math.atan2(to.x - n.pos.x, to.z - n.pos.z);
  n.model.setPose('aim');
  const from = new THREE.Vector3(n.pos.x + Math.sin(n.yaw) * 0.45, n.pos.y + 1.32, n.pos.z + Math.cos(n.yaw) * 0.45);
  return P.pellet(from, new THREE.Vector3(to.x, to.y ?? n.pos.y + 1.1, to.z), n, { color: COLORS[id] || COLORS.ido, targets });
}

// a line over the radio (a toast with the name, then the line as a call)
export const onRadio = (game, line) => radio(game, line[0], line[1]);

// ---------- the Shadow ----------
// put somewhere, standing, nothing he was doing before carried on; `armor` his energy suit on or off
export function shadowAt(game, at, { armor = null, pose = null } = {}) {
  const n = game.npc('shadow');
  n.target = null; n.idle = null; n.posed = false; n.face = null;
  n.floorY = at.y ?? null;
  n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null);
  n.model.setPose(pose);
  if (armor != null) n.model.setArmor?.(armor);
  n.model.setOpacity?.(1);
  n.show(true);
  return n;
}
// the Shadow put away (his suit back to chapter nine's look, any ropes off)
export function shadowAway(game) {
  const n = game.npcs.get('shadow'); if (!n) return;
  tie(n.model, false);
  n.target = null; n.face = null; n.floorY = null; n.model.setPose(null); n.model.setArmor?.(false); n.model.setOpacity?.(1); n.show(false);
}

// ropes: two turns round the chest (over the arms) and a turn at each wrist, rough hemp; found again by name, so
// never put on twice. on = false takes them off
export function tie(model, on = true) {
  const J = model?.bones; if (!J?.chest) return null;
  const old = [];
  for (const b of [J.chest, J.elL, J.elR]) { const r = b?.getObjectByName('ropes'); if (r) old.push(r); }
  if (!on) { for (const r of old) { r.removeFromParent(); r.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } return null; }
  if (old.length) return old[0];
  const mat = () => new THREE.MeshStandardMaterial({ color: '#b08a55', roughness: 0.95 });
  const chest = new THREE.Group(); chest.name = 'ropes';
  for (const dy of [0.02, 0.13]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 22).rotateX(Math.PI / 2), mat()); t.position.y = dy; t.scale.set(1, 1, 0.78); chest.add(t); }
  J.chest.add(chest);
  for (const b of [J.elL, J.elR]) {
    if (!b) continue;
    const w = new THREE.Group(); w.name = 'ropes';
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 5, 14).rotateX(Math.PI / 2), mat()); t.position.y = -0.24; w.add(t);
    b.add(w);
  }
  return chest;
}
export const isTied = (model) => !!model?.bones?.chest?.getObjectByName('ropes');
