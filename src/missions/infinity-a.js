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
    take(kind) { for (const it of items) { it.holder.visible = it.kind !== kind; it.label.visible = true; } },
    nearest(p, r = 1.3) { let best = null, bd = r; for (const it of items) { if (!it.holder.visible) continue; const d = Math.hypot(p.x - it.pos.x, p.z - it.pos.z); if (d < bd) { bd = d; best = it; } } return best; },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); o.material?.dispose?.(); } });
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
