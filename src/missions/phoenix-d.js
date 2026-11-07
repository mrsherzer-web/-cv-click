// Shared pieces of chapter nine's missions 43–46: the Black Tower floor by floor, the Shadow in his command room,
// the escape before the tower goes up, and the night back at the safe house. Here: the tower's points on their
// floors, the gang formed and armed (a stash left by a replay of an earlier mission given back first), the
// Order's guards posted where a floor needs them (the others on the board left as they are), blasts that warn and
// take whoever of the Order stands too close, the command room's paint turrets (a sensor the player's pellets
// count on), the red light of a floor, a short scene on game time, lines that wait their turn, and Nehorai's
// bandage. Paint, never blood: a marked man sits down; a blast knocks people down, nothing worse. The whole gang
// stays loyal; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { COLORS, CLIP } from '../combat/paint.js';
import { angleDiff } from '../core/math.js';
import { near } from './missions.js';
import { TEAM, NAMES, crew, Blast, gone, attempt } from './phoenix.js';

export const TW = (game) => game.world.places.tower;
export const HOME = (game) => game.world.places.safehouse;
export const FAC = (game) => game.world.places.facility;
export const ORDER = Array.from({ length: 16 }, (_, i) => `og${i + 1}`);
export const ids = (list) => list.map((g) => g.id);

// a point of the tower in its own coordinates (x east, z south of its centre) on floor k (5: the roof)
export function T(game, lx, lz, k = 0, yaw) { const t = TW(game), p = t.toWorld(lx, lz); return { x: p.x, z: p.z, y: t.floorY(k), ...(yaw != null ? { yaw } : {}) }; }
// the floor the player (or a point) is on: 0 the lobby .. 4 the command room, 5 the roof; -1 outside the tower
export function floorOf(game, p = game.player.pos) { const t = TW(game); return t.inTower(p.x, p.z) ? t.floorOf(p.y) : -1; }
export const onFloor = (game, k, p = game.player.pos) => floorOf(game, p) === k;

// the squad's own chatter was written for chapter seven (Erez leading): its banter and its "ארז! מחסה" when the
// leader is hit stay quiet here (the call-outs for a guard spotted or marked play on); the alert meter's label
// names Kotzi's people, so in chapter nine it stays under that mark
export function hush(game) {
  const q = game.squad, c = q?.cool; if (c) { c.banter = Math.min(c.banter, 0); c.hit = q.t; }
  const A = game.alert; if (A && !A.chasing && A.level >= 35) A.level = 34;
}

// ---------- the gang ----------
// the markers in hand: the player's in his own colour, each friend's in his; a stash left by a replay of an
// earlier mission goes back first (after the armory nobody of the gang is without his own)
export function armed(game, who = game.squad.ids) {
  const P = game.paint;
  P.unstash();
  if (P.player && P.player.color !== COLORS.nehorai) P.disarmPlayer();
  P.armPlayer(COLORS.nehorai);
  for (const id of who) { const n = game.npc(id); if (!n.visible || n.inCar) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
// the player at a spot and the gang formed round him, armed. `walk`: those already in sight on his floor walk over
export function gangAt(game, at, { ids: who = TEAM, walk = false, arm = true } = {}) {
  if (game.mode === 'car') game.exitCar();
  const yaw = at.yaw ?? game.player.yaw;
  game.player.place(at.x, at.z, yaw, at.y ?? null); game.follow.snapBehind(yaw);
  crew(game, game.player.pos, yaw, who);
  if (walk) game.squad.form(who, { near: game.player.pos, yaw, leader: 'nehorai', walk: true });
  for (const id of TEAM) if (!who.includes(id)) { const n = game.npc(id); n.target = null; n.show(false); game.paint.removeAlly(n); }
  if (arm) armed(game, who);
}
// the player's marks wiped and a full hopper (a new floor, a checkpoint); the friends who were marked back in it
export function freshMarks(game) {
  const P = game.paint;
  P.hits = 0; game.hud.paintClear();
  if (P.player) { P.player.ammo = CLIP; P.player.reloading = 0; game.hud.setAmmo(CLIP, CLIP, false); }
  for (const a of P.allies) { if (!a.marked) continue; a.marked = false; a.gun.visible = true; a.npc.body.enabled = false; if (a.npc.model.pose === 'down') a.npc.model.setPose(null); }
}
// a friend who was marked wipes the paint off after a few seconds and is back in it (he never crawls after the
// leader in his sitting pose)
export function wipeOff(m, game, dt) {
  m.wiping ||= new Map();
  for (const a of game.paint.allies) {
    if (!a.marked) { m.wiping.delete(a); continue; }
    const t = (m.wiping.get(a) || 0) + dt; m.wiping.set(a, t);
    if (t > 5 && !(a.npc.id === 'ido' && m.holdIdo)) { a.marked = false; a.gun.visible = true; a.npc.body.enabled = false; if (a.npc.model.pose === 'down') a.npc.model.setPose(null); m.wiping.delete(a); }
  }
}
// a friend standing somewhere for a while (on an errand of the squad's: he does not follow until released)
export function stay(game, id, at, { label = 'מחכה', pose = null, face = null } = {}) {
  const n = game.npc(id);
  game.squad.send(id, { x: at.x, z: at.z }, { label }); n.target = null;
  n.floorY = null; n.idle = null; n.posed = false; n.face = null;
  n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null); n.model.setPose(pose); n.show(true);
  if (face) n.lookAt(face.x, face.z);
  return n;
}
// one friend's marker put down (a brawl), and given back
export function unarm(game, id) { game.paint.removeAlly(game.npc(id)); }
export function rearm(game, id) { const n = game.npc(id); if (n.visible && !game.paint.allies.some((a) => a.npc === n)) game.paint.addAlly(n, COLORS[id] || COLORS.ido); }

// ---------- the tower's doors ----------
// the tower as the assault left it (missions 44 and 45 on a fresh page): the plaza's gate blown out of its rails, the
// lockdown off, every door the gang opened on the way up open
export function assaulted(game) {
  const t = TW(game);
  t.gate.unlock(); t.gate.setOpen(true); t.gate.setVisible(false);
  t.exitGate.lock();
  t.lobby.door.unlock(); t.lobby.door.setOpen(true);
  for (const d of [t.security.monitorDoor, t.security.alarmDoor, t.escape.gate, t.breach.door, t.trapped.door]) { d.unlock(); d.setOpen(true); }
  t.alarm.set(false); t.card.take(); t.command.reader.set(true);
  t.elevator.closeAll(); t.escape.mark(false); t.escape.switchLamp?.set('#ff2a2a');
  t.security.screen.show('cams');
  for (const v of t.cars) v.reset();
}
// and as it stands after the build (a mission put away that does not hand on)
export function towerReset(game) {
  const t = TW(game);
  t.gate.setVisible(true); t.gate.lock(); t.exitGate.lock();
  t.lobby.door.unlock(); t.lobby.door.setOpen(true);
  for (const d of [t.security.monitorDoor, t.security.alarmDoor, t.escape.gate]) { d.unlock(); d.setOpen(true); }
  for (const d of [t.breach.door, t.trapped.door, t.command.door, t.command.escapeDoor]) d.lock();
  t.alarm.set(true); t.card.reset(); t.command.reader.set(false); t.command.screen.show('map'); t.security.screen.show('cams');
  t.elevator.closeAll(); t.escape.mark(false); t.escape.switchLamp?.set('#ff2a2a');
  for (const v of t.cars) v.reset();
}

// ---------- the Order's guards ----------
// guards put where they stand or walk: each at `from` (or the first point) on that point's floor (he never steps
// off it), walking `at` (a list of points; one point: he stands still, turning there); one marked earlier is stood
// up again (a later floor uses the same people). `hot`: he knows where the gang is and comes at the player. The
// others on the board stay as they are (chapter seven's postGuards would stand everyone marked so far back up)
export function post(game, list, { hot = false } = {}) {
  const P = game.paint, out = [];
  for (const g of list) {
    const n = game.npc(g.id), pts = Array.isArray(g.at) ? g.at : [g.at], a = g.from || pts[0];
    n.idle = null; n.posed = false; n.face = null; n.target = null; n.model.setPose(null);
    n.floorY = a.y ?? null;
    n.place(a.x, a.z, g.yaw ?? a.yaw ?? n.yaw, a.y ?? null); n.show(true);
    const route = pts.map((p) => ({ x: p.x, z: p.z })), still = g.still ?? pts.length === 1;
    let gd = P.guards.find((q) => q.npc === n);
    if (gd) { P.revive(gd); P.setRoute(gd, route, { still, quick: true }); }
    else gd = P.addGuard(n, route, undefined, { quick: true, still });
    if (still && (g.yaw ?? a.yaw) != null) n.yaw = g.yaw ?? a.yaw;
    if (hot || g.hot) { gd.alerted = true; gd.calledOut = true; gd.seen = 0.4; gd.foe = { player: true, pos: game.player.pos, yaw: 0 }; gd.cool = 1.3 + Math.random(); }
    out.push(gd);
  }
  return out;
}
// guards marked where they stand (a restore staging a floor already won)
export function beaten(game, list) { for (const gd of post(game, list)) game.paint.markGuard(gd, 'restore'); }
// the Order's people off the board: no cone, no marker, out of sight
export function offBoard(game, who = ORDER) { for (const id of who) { const n = game.npc(id); game.paint.removeGuard(n); n.target = null; n.floorY = null; n.idle = null; n.posed = false; n.model.setPose(null); n.show(false); } }
export const standing = (game, who) => game.paint.guards.filter((g) => who.includes(g.npc.id) && !g.marked && g.npc.visible).length;
// the nearest one still standing among `who`, for the arrow (the last ones are never a search)
export function nearestOf(game, who, r = 2.2) {
  const me = game.player.pos; let best = null, bd = Infinity;
  for (const g of game.paint.guards) { if (g.marked || !g.npc.visible || !who.includes(g.npc.id)) continue; const d = Math.hypot(g.npc.pos.x - me.x, g.npc.pos.z - me.z) + Math.abs(g.npc.pos.y - me.y) * 4; if (d < bd) { bd = d; best = g; } }
  return best ? { x: best.npc.pos.x, z: best.npc.pos.z, y: best.npc.pos.y, r } : null;
}

// ---------- blasts ----------
// A blast that warns first (a red ring and beeps for `warn` seconds), as chapter eight's; indoors the debris stays
// out (it would land on the roof above), a big one flashes the screen, and whoever of the Order stands inside the
// ring sits down marked. Nehorai inside it after the warning takes a mark, as always
export class TBlast extends Blast {
  constructor(game, opts) { super(game, opts); this.flash = opts.flash ?? opts.size >= 2; this.marks = opts.marks ?? true; this.debris = opts.debris ?? false; }
  boom() {
    const g = this.game, p = this.at();
    this.done = true;
    if (this.ring) { gone(this.ring); this.ring = null; }
    g.fx.explode(p.x, p.y, p.z, { size: this.size, fire: this.fire, debris: this.debris, flash: this.flash });
    if (this.marks) for (const gd of g.paint.guards) if (!gd.marked && gd.npc.visible && near(gd.npc.pos, p, this.radius) && Math.abs(gd.npc.pos.y - p.y) < 2.5) g.paint.markGuard(gd, 'blast');
    if (this.hurts && g.mode === 'foot' && !g.cutscene && near(g.player.pos, p, this.radius) && Math.abs(g.player.pos.y - p.y) < 2.5) { g.paint.strike('הדף!'); g.player.push?.((g.player.pos.x - p.x) * 0.4, (g.player.pos.z - p.z) * 0.4); }
    this.onBoom?.(p);
  }
}

// a jerrycan of fuel strapped to one of the plaza's cars: two pellets and the car goes up after a short warning,
// with whoever of the Order stands by it
const canGeo = new THREE.BoxGeometry(0.34, 0.46, 0.2);
export function fuelCan(m, game, v, { onBlow = null } = {}) {
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw), x = v.x + c * 1.12, z = v.z - s * 1.12, y = v.y + 0.62;
  const mat = new THREE.MeshStandardMaterial({ color: '#b3261e', emissive: '#ff3b2a', emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.3 });
  const mesh = new THREE.Mesh(canGeo, mat); mesh.position.set(x, y, z); mesh.rotation.y = v.yaw; game.scene.add(mesh);
  const can = { v, mesh, blast: null, prop: null };
  can.prop = game.paint.addProp({ x, y, z, r: 0.36, hits: 2, label: 'ג׳ריקן', onHit: (pr) => {
    mat.emissiveIntensity = 1.4; game.fx.sparks(x, y, z, 6);
    if (!pr.done || can.blast) return;
    gone(mesh); can.mesh = null;
    can.blast = new TBlast(game, { at: { x: v.x, y: v.y, z: v.z }, size: 2.4, warn: 1.2, radius: 5.5, fire: 60, flash: true, debris: true, onBoom: () => { v.wreck(); (m.smoke ||= []).push(game.fx.smokeColumn(v.x, v.y + 1, v.z, { r: 1.1, strength: 1.2, seconds: 300 })); onBlow?.(v); } });
    (m.live ||= []).push(can.blast);
  } });
  return can;
}
export function clearCans(game, cans) { for (const c of cans || []) { if (c.prop) game.paint.removeProp(c.prop); if (c.mesh) gone(c.mesh); } }

// ---------- the command room's defences: a paint turret on a post ----------
// It sweeps its red line from side to side; once the line is on Nehorai it follows him and, a second later, fires
// (a pellet that can miss); out of its line (a pillar, a wall) it loses him and sweeps again. Its red sensor takes
// two pellets: then it sparks, droops and is dead. Paint, like everything else
const TG = { post: new THREE.CylinderGeometry(0.16, 0.26, 1.15, 10), head: new THREE.BoxGeometry(0.5, 0.3, 0.56), barrel: new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8).rotateX(Math.PI / 2), eye: new THREE.SphereGeometry(0.12, 12, 8), laser: new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, 0.5) };
export class Turret {
  constructor(game, { at, yaw = 0, sweep = 0.85, speed = 0.75, range = 17, aim = 1.15, label = 'צריח' }) {
    this.game = game; this.at = at; this.yaw0 = yaw; this.yaw = yaw; this.sweep = sweep; this.speed = speed; this.range = range; this.aimTime = aim;
    this.t = Math.random() * 6; this.lock = 0; this.cool = 1.4; this.dead = false; this.beeped = -1; this.tracking = false; this.shots = 0;
    const dark = new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.5, metalness: 0.6 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 1.6 });
    this.laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.35, depthWrite: false });
    this.mats = [dark, this.eyeMat, this.laserMat];
    const g = new THREE.Group(); g.position.set(at.x, at.y, at.z);
    const post = new THREE.Mesh(TG.post, dark); post.position.y = 0.58; g.add(post);
    const head = new THREE.Group(); head.position.y = 1.3; g.add(head);
    head.add(new THREE.Mesh(TG.head, dark));
    const barrel = new THREE.Mesh(TG.barrel, dark); barrel.position.set(0, -0.02, 0.5); head.add(barrel);
    const eye = new THREE.Mesh(TG.eye, this.eyeMat); eye.position.set(0, 0.2, 0.18); head.add(eye);
    const laser = new THREE.Mesh(TG.laser, this.laserMat); laser.position.set(0, -0.02, 0.8); laser.scale.z = range; head.add(laser);
    this.group = g; this.head = head; this.laser = laser;
    game.scene.add(g);
    this.body = game.world.cols.addCircle(at.x, at.z, 0.3, at.y - 0.3, at.y + 1.0); // the post only: a pellet at the head reaches its sensor
    const ex = () => ({ x: at.x + Math.sin(this.yaw) * 0.18, y: at.y + 1.5, z: at.z + Math.cos(this.yaw) * 0.18 });
    this.prop = game.paint.addProp({ ...ex(), r: 0.34, hits: 2, label, onHit: (pr) => { const e = ex(); game.fx.sparks(e.x, e.y, e.z, 10); this.eyeMat.emissiveIntensity = 0.7; if (pr.done) this.kill(); } });
    this.eyeAt = ex;
  }
  update(dt) {
    if (this.dead) return;
    const g = this.game, at = this.at, me = g.player.pos;
    this.t += dt; this.cool -= dt;
    const e = this.eyeAt(); this.prop.x = this.prop.pos.x = e.x; this.prop.z = this.prop.pos.z = e.z;
    // can it see him: on its floor, in range, a clear line from its head to his chest
    let sees = false, d = this.range;
    if (g.mode === 'foot' && !g.cutscene && g.paint.player) {
      const dx = me.x - at.x, dz = me.z - at.z; d = Math.hypot(dx, dz);
      const ahead = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz))) < (this.tracking ? 0.9 : 0.2);
      sees = d < this.range && Math.abs(me.y - at.y) < 2.5 && ahead && g.world.cols.raycast(at.x, at.y + 1.3, at.z, me.x, me.y + 1.2, me.z) === null;
    }
    if (sees) {
      this.tracking = true;
      const want = Math.atan2(me.x - at.x, me.z - at.z);
      this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * 5);
      this.lock += dt;
      const tick = Math.floor(this.lock * 5);
      if (tick !== this.beeped) { this.beeped = tick; g.sound?.beep?.(1, 1150 + this.lock * 300); }
      if (this.lock >= this.aimTime && this.cool <= 0) this.fire();
    } else {
      if (this.tracking) { this.tracking = false; this.yaw0 = this.yaw; this.t = 0; }
      this.lock = Math.max(0, this.lock - dt * 2);
      this.yaw = this.yaw0 + Math.sin(this.t * this.speed) * this.sweep;
    }
    this.head.rotation.y = this.yaw;
    this.laser.scale.z = Math.max(0.5, Math.min(this.range, sees ? d : this.range));
    this.laserMat.opacity = sees ? 0.55 + 0.4 * (this.lock / this.aimTime) : 0.3;
  }
  fire() {
    const g = this.game, P = g.paint, at = this.at, me = g.player.pos;
    this.cool = 1.5; this.lock = 0.35; this.shots++;
    const from = new THREE.Vector3(at.x + Math.sin(this.yaw) * 0.8, at.y + 1.28, at.z + Math.cos(this.yaw) * 0.8);
    const to = new THREE.Vector3(me.x, me.y + 1.1, me.z);
    const targets = [{ pos: me, yaw: g.player.yaw, model: g.nehorai, who: { player: true } }];
    const hit = P.pellet(from, to, null, { color: '#ff3b3b', targets, spread: Math.random() < 0.65 ? 0 : 0.4 });
    if (hit.target) P.markPlayer(this, '#ff3b3b');
  }
  kill() {
    if (this.dead) return;
    const g = this.game, e = this.eyeAt();
    this.dead = true; this.laser.visible = false; this.eyeMat.emissiveIntensity = 0; this.eyeMat.color.set('#2a0a0a');
    this.head.rotation.x = 0.55; this.head.position.y = 1.18;
    g.fx.sparks(e.x, e.y, e.z, 24); g.fx.dust(e.x, e.y - 0.6, e.z, 0.6); g.sound?.hit?.('crash', 0.5);
    this.smoke = g.fx.smokeColumn(e.x, e.y - 0.2, e.z, { r: 0.25, strength: 0.5, seconds: 40 });
  }
  dispose() {
    const g = this.game;
    g.paint.removeProp(this.prop);
    if (this.body) { g.world.cols.remove(this.body); this.body = null; }
    this.smoke?.stop(); this.group.removeFromParent();
    for (const m of this.mats) m.dispose();
  }
}

// ---------- the red light of a floor ----------
// the tower's emergency light on one floor (k), or every floor: two red beacons up by the ceiling, the floor only
const REDS = [[0, -6], [0, 9]];
export function towerRed(game, k, on = true) {
  const t = TW(game), list = k == null ? [0, 1, 2, 3, 4] : [].concat(k);
  for (const f of list) {
    const id = `tower-${f}`;
    if (!on) { game.fx.redAlert(false, { id }); continue; }
    const c = T(game, 0, f === 0 ? 4 : 0, f), up = f === 0 ? 4.6 : 3.4;
    game.fx.redAlert(true, { id, at: c, r: 30, points: REDS.map(([lx, lz]) => { const p = T(game, lx, lz, f); return { x: p.x, z: p.z, y: p.y + up }; }), intensity: 55 });
  }
  void t;
}

// ---------- a short scene on game time ----------
// ['say', lines] waits for the lines, ['wait', seconds], ['do', fn], ['until', fn] waits for fn() to be true.
// update(dt) from the step's update; done when through; cancel() stops it
export function beats(game, list) {
  let i = 0, t = 0, started = false, token = 0;
  const b = {
    done: false, talking: false,
    update(dt) {
      while (i < list.length) {
        const [k, v] = list[i];
        if (!started) {
          started = true; t = 0;
          if (k === 'say') { const my = ++token; b.talking = true; game.dialogue.play(v).then(() => { if (my === token) b.talking = false; }); }
          else if (k === 'do') v();
        }
        if (k === 'say' && b.talking) return;
        if (k === 'wait') { t += dt; if (t < v) return; }
        if (k === 'until' && !v()) return;
        i++; started = false;
      }
      b.done = true;
    },
    cancel() { token++; i = list.length; b.done = true; b.talking = false; },
  };
  return b;
}
// lines that wait their turn: played once nothing else is being said (a call-out never cuts the story)
export function later(m, lines) { (m.talk ||= []).push(lines); }
export function talkOn(m, game) { if (m.talk?.length && !game.dialogue.busy && !game.cutscene) game.dialogue.play(m.talk.shift()); }
// the screen to black and back, only for the attempt that asked (a retry in between cancels it)
export function blackout(game, m, text, then, ms = 1600) { const live = attempt(game, m); game.hud.fade(text, () => { if (live()) then?.(); }, ms); }

// ---------- Nehorai's bandage ----------
// a clean white bandage round the head (after the first aid in the facility), on whichever body plays Nehorai; the
// same one mission 41 puts on (found again by its name), so it is never put on twice
export function bandage(model, on = true) {
  if (!model) return null;
  const head = model.bones?.head; if (!head) return null;
  let b = head.getObjectByName('bandage');
  if (!on) { if (b) { b.removeFromParent(); b.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } return null; }
  if (b) return b;
  b = new THREE.Group(); b.name = 'bandage';
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.9 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.122, 0.055, 18, 1, true), mat); band.position.set(0, 0.155, -0.005); band.rotation.x = -0.12;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.012), mat.clone()); pad.position.set(0.04, 0.165, 0.118); pad.rotation.x = -0.12;
  b.add(band, pad);
  head.add(b);
  return b;
}
// and a white wrap round the left forearm (the safe house, the night after)
export function armWrap(model, on = true) {
  const bone = model?.bones?.elL || model?.bones?.armL || model?.bones?.shL; if (!bone) return null;
  let w = bone.getObjectByName('wrap');
  if (!on) { if (w) { w.removeFromParent(); w.geometry.dispose(); w.material.dispose(); } return null; }
  if (w) return w;
  w = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.16, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.9 }));
  w.name = 'wrap'; w.position.set(0, -0.12, 0);
  bone.add(w);
  return w;
}

// ---------- the clock of the escape ----------
// "04:59 – ESCAPE!" on the pill: minutes and seconds, two digits each
export const mmss = (s) => { const t = Math.max(0, Math.ceil(s)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export function escapeClock(game, left) { game.hud.setPursuit(left == null ? null : `${mmss(left)} – ESCAPE!`); }

// everything a restore or a cleanup of these missions puts away first: the scene, the works and jobs, the blasts
// and beams, the fire and smoke, the turrets, the fight, the clock, the screen layers and the music
// (`keep`: a scene that hands straight on to the next mission keeps its camera shot and its fire and smoke on the
// screen until that one's fade has gone to black)
export function clearAll(m, game, { keep = false } = {}) {
  game.dialogue.stop(); game.keypad?.close(false);
  if (!keep) { game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); }
  m.beats?.cancel(); m.beats = null; m.talk = [];
  m.work?.cancel(); m.work = null; m.job?.cancel(); m.job = null;
  for (const w of m.works || []) w?.cancel?.(); m.works = [];
  for (const x of m.live || []) x.cancel?.(); m.live = [];
  for (const b of m.beams || []) b.remove(); m.beams = [];
  for (const s of m.smoke || []) s.stop?.(); m.smoke = [];
  for (const t of m.turrets || []) t.dispose(); m.turrets = [];
  for (const b of m.blocks || []) game.world.cols.remove(b); m.blocks = [];
  clearCans(game, m.cans); m.cans = [];
  m.pinned?.cancel?.(); if (m.pinned?.beam) gone(m.pinned.beam); m.pinned = null;
  m.fight?.dispose(); m.fight = null;
  m.stopSiren?.(); m.stopSiren = null;
  if (m.heli) { m.heli.dispose(); game.helis = game.helis.filter((h) => h !== m.heli); m.heli = null; }
  game.paint.clearProps();
  game.hud.setPursuit(null);
  game.fx.resetAtmosphere();
  if (!keep) game.fx.clear?.();
  if (game.mode === 'car') game.exitCar();
}

export { TEAM, NAMES, attempt };
