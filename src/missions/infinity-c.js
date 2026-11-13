// Shared pieces of chapter ten's group c (missions 54 on): the citadel's main hall in its own coordinates, the
// counter-portal machine Muller runs there, who is played and who stands where (Ido at the machine while Nehorai
// and Erez are in the grove; Nehorai again over there), the grove as mission 53 leaves it, and the front of the
// breaking dimension that chases them to the energy point. Paint, never blood; nobody of the gang betrays, nobody
// of the gang dies; every threat is the Black Order's (or the broken dimension's, which only ever starts a run
// again). Invented, all of it.
import * as THREE from 'three';
import { COLORS, CLIP } from '../combat/paint.js';
import { CollisionWorld } from '../world/colliders.js';
import { TEAM, NAMES, attempt, handsOver } from './infinity.js';
import { become, nehoraiAway, gangAt, armed, upAgain, reinforce, offBoard, Wave, beats, later, talkOn, bandage, hush } from './phoenix-c.js';

export { TEAM, NAMES, attempt, handsOver, become, nehoraiAway, gangAt, armed, upAgain, reinforce, offBoard, Wave, beats, later, talkOn, bandage, hush };

export const CIT = (game) => game.world.places.citadel;
export const GRV = (game) => game.world.places.grove;
// the Order's people this group's missions use (chapter nine's og1..og18 and chapter ten's special ones)
export const ORDER = [...Array.from({ length: 18 }, (_, i) => `og${i + 1}`), 'sh1', 'sh2', 'sh3', 'hv1', 'hv2', 'rn1', 'rn2', 'rn3', 'rn4'];
// the gang without the two who are in the grove (the defence at the machine)
export const AT_CITADEL = TEAM.filter((id) => id !== 'erez');

// a point of the central tower's main hall, in the tower's own coordinates (x 32..112 from the main door in the
// west wall to the giant screen on the east wall, z -36..36 north to south; the same local frame as
// citadel-tower.js's P), on the hall's floor
export function hall(game, lx, lz, yaw) { const Z = CIT(game), p = Z.toWorld(lx, lz); return { x: p.x, z: p.z, y: Z.mainHall.y, ...(yaw != null ? { yaw } : {}) }; }
// the machine: Muller's console in front of the giant screen, and the anchor where the way back opens
export const CONSOLE = (game) => hall(game, 108.8, 0, -Math.PI / 2);
export const MULLER_AT = (game) => hall(game, 107.4, 0, Math.PI / 2);
export const GATE_AT = (game) => ({ ...CIT(game).mainHall.portalAt });

// ---------- the scene: who stands where ----------
// someone of the gang held at a spot in a pose (no walking off, no marker in his hands): Muller at the console
export function hold(game, id, at, { pose = null } = {}) {
  const n = game.npc(id), q = game.squad;
  if (q.ids.includes(id)) { q.ids = q.ids.filter((x) => x !== id); q.tasks.delete(id); }
  game.paint.removeAlly(n);
  n.target = null; n.face = null; n.idle = null; n.posed = false; n.floorY = null;
  n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null); n.show(true); n.body.enabled = true;
  n.model.setPose(pose);
  return n;
}
// the friends' markers held back while a scene runs, the buddies off duty (they would walk in from elsewhere)
export function buddiesOff(game) { for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; } }
// only these of the gang are out (the rest are elsewhere in the story): everyone else hidden and unarmed
export function onlyThese(game, ids) {
  for (const id of TEAM) if (!ids.includes(id)) { const n = game.npc(id); game.paint.removeAlly(n); n.target = null; n.model.setPose(null); n.show(false); }
}
// a friend who was marked sits it out for `after` seconds, wipes the paint off and is back in it (call every frame
// of a fight: nobody of the gang stays down, and no defence is left to the player alone for long)
export function wipeOff(game, dt, after = 7) {
  for (const a of game.paint.allies) {
    if (!a.marked) { a.downFor = 0; continue; }
    if ((a.downFor = (a.downFor || 0) + dt) < after) continue;
    a.marked = false; a.downFor = 0; a.gun.visible = true;
    if (a.npc.model.pose === 'down') a.npc.model.setPose(null);
  }
}
// the player's marks wiped and a full hopper of his own marker's size (a new stretch, a checkpoint)
export function freshMarks(game) {
  const P = game.paint;
  P.hits = 0; game.hud.paintClear();
  if (P.player) { const c = P.player.clip || CLIP; P.player.ammo = c; P.player.reloading = 0; game.hud.setAmmo(c, c, false); }
}
// everything a restore or a cleanup of these missions puts away first
export function clearScene(m, game) {
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  m.beats?.cancel(); m.beats = null; m.talk = [];
  m.kit?.dispose(); m.kit = null;
  for (const x of m.live || []) x.dispose?.(); m.live = [];
  m.front?.dispose(); m.front = null;
  m.wave = null; m.waves = [];
  game.hud.setPursuit(null);
  game.fx.resetAtmosphere();
  if (game.mode === 'car') game.exitCar();
  game.player.crawl?.(false);
}

// ---------- the counter-portal machine in the main hall ----------
const CONSOLES = new WeakMap();
// the console Muller hooks into the Shadow's machine (a desk with a glowing panel and a cable to the anchor);
// on = false takes it away. Its panel's light follows set(k 0..1): dim violet to bright cyan as it charges
export function machineConsole(game, on = true) {
  let c = CONSOLES.get(game);
  if (!on) { if (c) { c.group.removeFromParent(); c.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); CONSOLES.delete(game); } return null; }
  if (c) return c;
  const at = CONSOLE(game), gate = GATE_AT(game), g = new THREE.Group(); g.name = 'counter-portal console';
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2027', roughness: 0.6, metalness: 0.5 });
  const panel = new THREE.MeshBasicMaterial({ color: '#7a4dff' });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.8), dark); desk.position.y = 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.55), panel); top.position.set(0, 1.03, 0.04); top.rotation.x = -0.35;
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), dark.clone()); mast.position.set(0.8, 1.55, -0.25);
  g.add(desk, top, mast);
  // the cable along the floor from the desk to the anchor (a thin glowing strip)
  const dx = gate.x - at.x, dz = gate.z - at.z, len = Math.hypot(dx, dz);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, len), new THREE.MeshBasicMaterial({ color: '#4a2f99' }));
  cable.position.set(dx / 2, 0.02, dz / 2); cable.rotation.y = Math.atan2(dx, dz);
  g.add(cable);
  g.position.set(at.x, at.y, at.z); g.rotation.y = 0; // (the cable is laid in world directions; the desk is square to the screen)
  desk.rotation.y = top.rotation.y = Math.PI / 2; top.rotation.order = 'YXZ';
  game.scene.add(g);
  const cool = new THREE.Color('#7a4dff'), hot = new THREE.Color('#5cf2ff');
  c = { group: g, set(k) { panel.color.copy(cool).lerp(hot, Math.max(0, Math.min(1, k))); cable.material.color.copy(cool).lerp(hot, k).multiplyScalar(0.7); } };
  CONSOLES.set(game, c);
  return c;
}

// the citadel as these missions find it: the ordinary world, the tower standing, the main door open (the gang came
// in through it), the giant screen on `screen`
export function inCitadel(game, { screen = 'off', progress = 0 } = {}) {
  const Z = CIT(game);
  game.rift?.clear(); game.dimension?.(null); game.overlay?.white?.(0); game.overlay?.notice?.(null);
  if (Z.destroyed) Z.restore();
  const D = Z.mainHall.door; D.unlock(); D.setOpen(true);
  Z.mainHall.screen.show(screen, { progress });
  Z.alarm?.on?.(false);
}
// the citadel as the site leaves it (a cleanup): the main door locked again, the screen off
export function citadelBack(game) {
  const Z = CIT(game); if (!Z) return;
  const D = Z.mainHall.door; D.setOpen(false); D.lock();
  Z.mainHall.screen.show('off');
}

// the grove's other dimension as mission 53 leaves it: every symbol lit and every seal open, the path's bridge up,
// the Keeper's anchors lit, the radio back (no static); `point`: the energy point marked
export function inGrove(game, { point = false } = {}) {
  const Q = GRV(game);
  game.rift?.clear(); game.overlay?.white?.(0); game.overlay?.notice?.(null);
  if (game.dimensionName !== 'grove') game.dimension('grove');
  Q.reset();
  Q.seals.forEach((s) => s.open(true)); Q.symbols.forEach((s) => s.light(true)); Q.arena.anchors.forEach((a) => a.light(true));
  Q.brokenPath.bridge.set(true, true); Q.brokenPath.thrown?.(1, true);
  Q.portalAt.mark(point);
  if (game.rift) game.rift.static = false;
  game.sound?.radioStatic?.(false);
}
// out of the grove (a cleanup that hands nothing on): the park whole again and the ordinary world back
export function groveBack(game) {
  const Q = GRV(game);
  game.rift?.clear(); game.daylight?.crack?.(0, 0.1);
  if (game.dimensionName) game.dimension(null);
  Q?.reset?.(); Q?.dimension?.(false);
  game.overlay?.white?.(0);
}

// Nehorai at the controls again (after Ido): his own body, his marker of the kind he chose, the bandage from the hall
export function asNehorai(game, { bandaged = true } = {}) {
  become(game, 'nehorai');
  bandage(game.nehorai, bandaged);
  const P = game.paint; P.unstash?.();
  if (P.player && P.player.color !== COLORS.nehorai) P.disarmPlayer();
  P.armPlayer(COLORS.nehorai);
}

// ---------- the front of the breaking dimension ----------
// A wall of violet light across the grove (z from z0 to z1) that moves along +x at `speed`, the ground behind it
// gone dark and glowing, sparks at its foot, thunder now and then. It never hurts: whoever it reaches starts the
// run again (the mission's rule, `caught(pos)`). go(on) starts and stops it; speed may change any time
export class Front {
  constructor(game, { x, z0, z1, y, speed = 4.2, height = 11 }) {
    this.game = game; this.x = x; this.x0 = x; this.z0 = z0; this.z1 = z1; this.y = y; this.speed = speed; this.go = false; this.t = 0; this.spark = 0; this.boom = 2;
    const w = z1 - z0, cz = (z0 + z1) / 2;
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g2 = c.getContext('2d'), gr = g2.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(120,70,255,0)'); gr.addColorStop(0.55, 'rgba(140,90,255,0.55)'); gr.addColorStop(0.9, 'rgba(200,160,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 4, 64);
    this.tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, color: '#b48cff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat); wall.rotation.y = Math.PI / 2; wall.position.set(0, height / 2, 0);
    const core = new THREE.Mesh(new THREE.PlaneGeometry(w, height * 0.6), mat.clone()); core.material.color.set('#7ad8ff'); core.material.opacity = 0.5;
    core.rotation.y = Math.PI / 2; core.position.set(-0.6, height * 0.3, 0);
    // the ground behind it: what is left of the grove there is dark and seething
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, w), new THREE.MeshBasicMaterial({ color: '#2a0f55', transparent: true, opacity: 0.82, depthWrite: false, fog: false }));
    back.rotation.x = -Math.PI / 2; back.position.set(-0.5, 0.06, 0);
    this.back = back;
    this.group = new THREE.Group(); this.group.name = 'dimension front'; this.group.add(wall, core, back);
    this.group.position.set(x, y, cz); this.group.renderOrder = 4;
    this.wall = wall; this.core = core;
    game.scene.add(this.group);
  }
  // is a body at `pos` reached by it (with a little room, the wall is a glow, not a line)
  caught(pos, pad = 0.4) { return pos.x <= this.x + pad && pos.z > this.z0 - 1 && pos.z < this.z1 + 1; }
  // how far ahead of it a body is
  lead(pos) { return pos.x - this.x; }
  update(dt) {
    const g = this.game;
    this.t += dt;
    if (this.go) this.x += this.speed * dt;
    this.group.position.x = this.x;
    const behind = Math.max(0.01, this.x - this.x0);
    this.back.scale.x = behind; this.back.position.x = -behind / 2;
    this.wall.material.opacity = 0.7 + Math.sin(this.t * 9) * 0.12;
    this.core.position.x = -0.6 + Math.sin(this.t * 5.3) * 0.25;
    if ((this.spark -= dt) <= 0) {
      this.spark = 0.12;
      const z = this.z0 + Math.random() * (this.z1 - this.z0);
      g.energy?.sparks?.(this.x, this.y + 0.3 + Math.random() * 2.2, z, Math.random() < 0.5 ? '#b48cff' : '#7ad8ff', 6, 3);
    }
    if (this.go && (this.boom -= dt) <= 0) { this.boom = 2.6 + Math.random() * 1.6; g.sound?.thunder?.(0.35); g.follow?.shake?.(0.18); }
  }
  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.tex.dispose();
  }
}

// ---------- a moving camera shot ----------
// the camera glides from `from` to `to` while it looks from `look` to `lookTo` (eased, over `seconds` of game time):
// the camera along a line of people. update(dt) from a tick; it lets go by itself when another shot takes over
export function dolly(game, { from, to, look, lookTo = look, seconds = 6 }) {
  game.follow.shot(from, look, 9999);
  const o = game.follow.override, lerp = (a, b, k) => a + (b - a) * k;
  let t = 0;
  return {
    done: false,
    update(dt) {
      if (this.done) return;
      if (game.follow.override !== o) { this.done = true; return; }
      t += dt;
      const k = Math.min(1, t / seconds), e = k * k * (3 - 2 * k);
      o.from.set(lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(from.z, to.z, e));
      o.look.set(lerp(look.x, lookTo.x, e), lerp(look.y, lookTo.y, e), lerp(look.z, lookTo.z, e));
      if (k >= 1) this.done = true;
    },
  };
}

// ---------- the last hall's door (mission 56 on) ----------
// A heavy double door across the top of the stairs from the machine room (tower-local x 104.4, z 31.9..35.5, on
// the last hall's floor): the gang walks up through it and it shuts behind them. lastDoor(game, 'open' | 'shut',
// { seconds }) makes it (or moves it over `seconds`); lastDoor(game, null) takes it away (a cleanup that hands
// nothing on, or mission 57's once it is done with the hall). Shut, a collider closes the stairs. `.state`, `.k`
const DOORS = new WeakMap();
export function lastDoor(game, state = 'shut', { seconds = 0 } = {}) {
  let d = DOORS.get(game);
  if (!state) {
    if (d) {
      d.group.removeFromParent(); d.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      game.world.cols.dynamic.delete(d.box); game.activities = game.activities.filter((a) => a !== d.act); DOORS.delete(game);
    }
    return null;
  }
  if (!d) {
    const Z = CIT(game), y = Z.lastHall.y, c = Z.toWorld(104.4, 33.7), g = new THREE.Group(); g.name = 'last hall door';
    g.position.set(c.x, y, c.z);
    const steel = () => new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.5, metalness: 0.6 });
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.4), steel()); post.position.set(0, 1.7, s * 1.95); g.add(post); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 4.3), steel()); top.position.set(0, 3.2, 0); g.add(top);
    const leaves = [-1, 1].map((s) => {
      const leaf = new THREE.Group(), slab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.95, 1.8), steel());
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.4, 0.07), new THREE.MeshBasicMaterial({ color: '#8a5cff' }));
      slab.position.y = 1.48; line.position.set(0, 1.5, -s * 0.82); leaf.add(slab, line); leaf.userData.s = s; g.add(leaf);
      return leaf;
    });
    game.scene.add(g);
    const box = game.world.cols.addDynamicBox({ name: 'last hall door' }, 0.2, 1.8);
    CollisionWorld.setBox(box, c.x, c.z, 0, y - 0.2, y + 3.2);
    d = {
      group: g, leaves, box, k: 1, to: 1, speed: 1, state: 'shut',
      set(st, sec = 0) { d.state = st; d.to = st === 'open' ? 0 : 1; d.speed = sec > 0 ? 1 / sec : 0; if (!sec) { d.k = d.to; d.draw(); } },
      // k 1 shut .. 0 open: the leaves slide apart along the wall
      draw() { for (const l of d.leaves) l.position.z = l.userData.s * (0.92 + (1 - d.k) * 1.8); d.box.enabled = d.k > 0.5; },
      update(dt) {
        if (d.k === d.to || !d.speed) return;
        d.k = d.k < d.to ? Math.min(d.to, d.k + d.speed * dt) : Math.max(d.to, d.k - d.speed * dt);
        d.draw();
        if (d.k === 1 && d.to === 1) { game.sound?.hit?.('crash', 1); game.follow?.shake?.(0.4); }
      },
    };
    d.act = { update: (dt) => d.update(dt) };
    game.activities.push(d.act);
    DOORS.set(game, d);
  }
  d.set(state, seconds);
  return d;
}
