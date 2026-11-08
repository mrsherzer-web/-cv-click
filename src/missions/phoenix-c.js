// Shared pieces of chapter nine's missions 40–42, under the ground with the markers back: the Order's guards
// coming in waves (the same people stood up again for each), the facility's red emergency light, blasts that
// warn and take whoever of the Order stands too close, the hangar's vehicles with fuel tanks a pellet can set
// off, a ceiling beam or a truss that comes down after a warning, the far booms that shake the place, a short
// scene on game time, who is being played (Nehorai, or Ido while Nehorai is down), Nehorai carried between two
// friends, and the bandage on his head. Paint, never blood: a marked man sits down; a blast knocks people
// down, nothing worse. The whole gang stays loyal; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { COLORS, CLIP } from '../combat/paint.js';
import { near } from './missions.js';
import { TEAM, NAMES, crew, armCrew, Blast, gone, attempt, dropBeam } from './phoenix.js';

export const FAC = (game) => game.world.places.facility;
// a point of the facility in its own coordinates (x east, z south of its centre), on its floor
export function L(game, lx, lz, ly = 0, yaw) { const f = FAC(game), p = f.toWorld(lx, lz); return { x: p.x, z: p.z, y: f.y + ly, ...(yaw != null ? { yaw } : {}) }; }
export const zone = (game, p = game.player.pos) => FAC(game).zoneAt(p.x, p.z);
// on completion the scene is left as it is only for the mission that carries straight on from this one (a replay
// from the pause menu may be followed by a later mission, which stages its own)
export function handsTo(game, id) { const M = game.missions, n = M.next(); return n?.id === id && !!n.follows && M.ready(n); }

// under the ground: the night's lamps (the halls are lit by their own tubes), the minimap covered
export function underground(game) { game.daylight?.set(1, 0); game.overlay?.mapHidden(true, 'מתחת לאדמה'); }

// the squad's own chatter was written for chapter seven (Erez leading, Nehorai the one to be rescued): its banter
// and its "ארז! מחסה" when the leader is hit stay quiet here (the call-outs for a guard spotted or marked play on)
export function hush(game) { const q = game.squad, c = q?.cool; if (!c) return; c.banter = Math.min(c.banter, 0); c.hit = q.t; }

// ---------- who is played ----------
// Nehorai or Ido at the controls: the body swapped (the old one freed), the marker in the hand in its owner's
// colour, the one played no longer a friend standing around; the squad's orders are given in the leader's name
export function become(game, id) {
  const P = game.paint, sq = game.squad;
  if (game.playingAs !== id) {
    const armed = P.armed, old = game.nehorai;
    P.disarmPlayer();
    game.playAs(id);
    if (old !== game.nehorai) { bandage(old, false); old.dispose(); }
    if (armed) P.armPlayer(COLORS[id] || COLORS.nehorai);
  }
  game.fighter.body.model = game.nehorai;
  game.fighter.revive(); game.fighter.minHp = 0; game.dash = null;
  game.nehorai.setPose(null);
  // the order button's toast names the one who leads (squad.leaderName knows only Erez and Nehorai): while
  // Ido leads, his own name (an instance override, taken off again as soon as Nehorai is back)
  if (id === 'nehorai') delete sq.leaderName; else sq.leaderName = () => NAMES[id] || 'עידו';
  // the one played is not also one of the squad (the squad would show him again)
  if (sq.ids.includes(id)) { sq.ids = sq.ids.filter((q) => q !== id); sq.tasks.delete(id); }
  if (sq.active) { sq.leaderId = id; sq.refresh(true); }
  const n = game.npcs.get(id); if (n) { n.show(false); n.body.enabled = false; P.removeAlly(n); }
}

// Nehorai himself as someone lying there (while Ido is played): no marker, nobody's obstacle, on the floor
export function nehoraiDown(game, at, { pose = 'floored', y = null } = {}) {
  const n = game.npc('nehorai');
  game.paint.removeAlly(n);
  n.target = null; n.face = null; n.idle = null; n.posed = false;
  n.floorY = y;
  n.place(at.x, at.z, at.yaw ?? 0, y ?? at.y ?? null);
  n.model.setPose(pose);
  n.show(true); n.body.enabled = false;
  return n;
}
export function nehoraiAway(game) { const n = game.npcs.get('nehorai'); if (!n) return; game.paint.removeAlly(n); n.floorY = null; n.target = null; n.model.setPose(null); n.show(false); }

// the gang formed up round the one played, each with his own marker; `lead` is the leader's id
export function gangAt(game, at, yaw = at.yaw ?? 0, { ids = null, lead = game.playingAs, walk = false } = {}) {
  if (game.mode === 'car') game.exitCar();
  game.player.place(at.x, at.z, yaw, at.y); game.follow.snapBehind(yaw);
  const who = ids || TEAM.filter((id) => id !== lead);
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; }
  game.squad.form(who, { near: game.player.pos, yaw, leader: lead, walk });
  armed(game, who);
}
// the markers in hand: the player's in his own colour, each friend's in his; a stash left by a replay of an
// earlier mission goes back first (after the armory nobody of the gang is without his own)
export function armed(game, who = game.squad.ids) {
  const P = game.paint;
  P.unstash();
  const mine = COLORS[game.playingAs] || COLORS.nehorai;
  if (P.player && P.player.color !== mine) P.disarmPlayer();
  P.armPlayer(mine);
  for (const id of who) { const n = game.npc(id); if (!n.visible) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
// the friends who were marked wipe the paint off and are back in it (between two waves)
export function upAgain(game) {
  for (const a of game.paint.allies) {
    if (!a.marked) continue;
    a.marked = false; a.gun.visible = true;
    if (a.npc.model.pose === 'down') a.npc.model.setPose(null);
  }
}
// the player's marks wiped, a full hopper (a new stretch of the fight, a checkpoint)
export function freshMarks(game) {
  const P = game.paint;
  P.hits = 0; game.hud.paintClear();
  if (P.player) { P.player.ammo = CLIP; P.player.reloading = 0; game.hud.setAmmo(CLIP, CLIP, false); }
}

// ---------- the Order's guards ----------
// guards coming in: each placed at `from` (or at his post) and sent to stand at `post`; one marked earlier is
// stood up again (a wave uses the same people). `hot`: he knows where the gang is and comes at the player. The
// others on the board stay as they are (postGuards would stand everyone marked so far back up)
export function reinforce(game, list, { hot = false } = {}) {
  const P = game.paint, out = [];
  for (const g of list) {
    const n = game.npc(g.id), a = g.from || g.post;
    n.floorY = null; n.idle = null; n.posed = false; n.face = null; n.target = null; n.model.setPose(null);
    n.place(a.x, a.z, a.yaw ?? n.yaw, a.y ?? null); n.show(true);
    const pts = [{ x: g.post.x, z: g.post.z }];
    let gd = P.guards.find((q) => q.npc === n);
    if (gd) { P.revive(gd); P.setRoute(gd, pts, { still: !!g.still, quick: true }); }
    else gd = P.addGuard(n, pts, undefined, { quick: true, still: !!g.still });
    if (g.still && g.post.yaw != null) n.yaw = g.post.yaw;
    if (g.hot ?? hot) { gd.alerted = true; gd.calledOut = true; gd.seen = 0.4; gd.foe = { player: true, pos: game.player.pos, yaw: 0 }; gd.cool = 1.2 + Math.random(); }
    out.push(gd);
  }
  return out;
}
// guards marked where they stand (a restore staging a fight already won there): sitting at their posts
export function beatenAt(game, list) {
  const P = game.paint;
  for (const g of list) {
    const gd = reinforce(game, [{ id: g.id, post: g.post }])[0];
    const n = gd.npc; n.target = null; n.place(g.post.x, g.post.z, g.post.yaw ?? n.yaw, g.post.y ?? null);
    P.markGuard(gd, 'restore');
  }
}
// the Order's people off the board: no cone, no marker, out of sight
export function offBoard(game, ids) { for (const id of ids) { const n = game.npc(id); game.paint.removeGuard(n); n.target = null; n.floorY = null; n.idle = null; n.model.setPose(null); n.show(false); } }
export const standing = (game, ids) => game.paint.guards.filter((g) => ids.includes(g.npc.id) && !g.marked && g.npc.visible).length;
// guards of a wave who come in one after the other, `gap` seconds apart (a wave that fills the hall); `now`:
// all of them at once (posted where they wait). `left`: those still to deal with (standing, or not in yet)
export class Wave {
  constructor(game, list, { gap = 1.4, hot = true, delay = 0, now = false } = {}) {
    this.game = game; this.list = list.slice(); this.gap = gap; this.hot = hot; this.t = -delay; this.k = 0; this.out = [];
    if (now) this.all();
  }
  get ids() { return this.list.map((g) => g.id); }
  get done() { return this.k >= this.list.length; }
  get total() { return this.list.length; }
  get left() { return this.list.length - this.k + this.out.filter((g) => !g.marked).length; }
  update(dt) { if (this.done) return; this.t += dt; while (this.k < this.list.length && this.t >= this.k * this.gap) this.out.push(...reinforce(this.game, [this.list[this.k++]], { hot: this.hot })); }
  all() { while (!this.done) this.out.push(...reinforce(this.game, [this.list[this.k++]], { hot: this.hot })); return this; }
}

// ---------- blasts, beams, tanks, the far booms ----------
// A blast that warns first (a red ring and beeps for `warn` seconds), as chapter eight's; under the ground the
// debris stays out (it would land on the lid), a big one flashes the screen, and whoever of the Order stands
// inside the ring sits down marked. Nehorai inside it after the warning takes a mark, as always
export class FBlast extends Blast {
  constructor(game, opts) { super(game, opts); this.flash = opts.flash ?? opts.size >= 2; this.marks = opts.marks ?? true; }
  boom() {
    const g = this.game, p = this.at();
    this.done = true;
    if (this.ring) { gone(this.ring); this.ring = null; }
    g.fx.explode(p.x, p.y, p.z, { size: this.size, fire: this.fire, debris: false, flash: this.flash });
    if (this.marks) for (const gd of g.paint.guards) if (!gd.marked && gd.npc.visible && near(gd.npc.pos, p, this.radius) && Math.abs(gd.npc.pos.y - p.y) < 2.5) g.paint.markGuard(gd, 'blast');
    if (this.hurts && g.mode === 'foot' && !g.cutscene && near(g.player.pos, p, this.radius) && Math.abs(g.player.pos.y - p.y) < 2.5) { g.paint.strike('הדף!'); g.player.push?.((g.player.pos.x - p.x) * 0.4, (g.player.pos.z - p.z) * 0.4); }
    this.onBoom?.(p);
  }
}

// something heavy from the ceiling (a beam, the hangar's truss): a red ring where it will land and beeps for
// `warn` seconds, then it falls and blocks; Nehorai under it when it lands is pushed clear and marked
export function fallingBeam(game, { at, len = 8, yaw = 0, from = 5, warn = 2, w = 0.5, h = 0.5, onLand = null, color = '#3e434a' }) {
  const y0 = at.y;
  const b = { beam: null, done: false, t: 0, beeped: -1, ring: game.fx.ring(at.x, y0 + 0.05, at.z, Math.max(1.6, len / 2)) };
  b.update = (dt) => {
    if (b.beam) { b.beam.update(dt); return; }
    b.t += dt;
    if (b.ring) b.ring.material.opacity = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(b.t * (8 + 14 * Math.min(1, b.t / warn))));
    const tick = Math.floor(b.t * (b.t > warn - 0.8 ? 6 : 2));
    if (tick !== b.beeped && b.t < warn) { b.beeped = tick; game.sound?.beep?.(1, b.t > warn - 0.8 ? 1150 : 700); if (b.t > warn - 0.8) game.fx.sparks(at.x, y0 + from - 0.3, at.z, 4); }
    if (b.t < warn) return;
    gone(b.ring); b.ring = null;
    b.beam = dropBeam(game, { from: { x: at.x, y: y0 + from, z: at.z }, to: { x: at.x, y: y0 + h / 2, z: at.z }, len, yaw, w, h, color, seconds: 0.7, onLand: (beam) => {
      b.done = true;
      const me = game.player.pos, c = Math.cos(yaw), s = Math.sin(yaw), dx = me.x - at.x, dz = me.z - at.z;
      const along = dx * s + dz * c, across = dx * c - dz * s; // the beam lies along (sin yaw, cos yaw)
      if (game.mode === 'foot' && Math.abs(along) < len / 2 + 0.3 && Math.abs(across) < 1.1 && Math.abs(me.y - y0) < 2) { game.paint.strike('קורה!'); const k = across >= 0 ? 1 : -1; game.player.push(c * k * 1.6, -s * k * 1.6); }
      for (const gd of game.paint.guards) { if (gd.marked || !gd.npc.visible) continue; const ex = gd.npc.pos.x - at.x, ez = gd.npc.pos.z - at.z; if (Math.abs(ex * s + ez * c) < len / 2 && Math.abs(ex * c - ez * s) < 1.0) game.paint.markGuard(gd, 'beam'); }
      onLand?.(beam);
    } });
  };
  b.remove = () => { if (b.ring) { gone(b.ring); b.ring = null; } b.beam?.remove(); b.beam = null; b.done = true; };
  return b;
}
// the crane's truss that comes down across the middle of the hangar (mission 40), and lies there from then on
export const TRUSS_AT = (game) => ({ at: L(game, 62, 32), len: 14, yaw: 0, from: 12.8, warn: 2.6, w: 0.5, h: 0.9, color: '#2e3238' });
// something that came down earlier in the fight, lying where it fell (a later mission, a restore): no warning,
// no fall, the same block as when it landed; kept in the mission's `beams`, so clearAll takes it away again
export function fallen(game, { at, len = 8, yaw = 0, w = 0.5, h = 0.5, color = '#3e434a' }) {
  const W = game.world, y = at.y + h / 2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  mesh.position.set(at.x, y, at.z); mesh.rotation.y = yaw; game.scene.add(mesh);
  const beam = { mesh, landed: true, box: W.cols.addBox(at.x, at.z, w / 2 + 0.1, len / 2, yaw, y - 1, y + h + 0.6) };
  const b = { beam, done: true, update() {} };
  b.remove = () => { if (b.beam) { gone(b.beam.mesh); if (b.beam.box) W.cols.remove(b.beam.box); } b.beam = null; };
  return b;
}

// ---------- the great door to the surface ----------
// in its way: out on the ramp beyond it, or under it (the doorway)
export function byExit(game, p) { const f = FAC(game), lx = p.x - f.x, lz = p.z - f.z; return f.zoneAt(p.x, p.z) === 'exit' || (lx > 85 && lx < 87.5 && Math.abs(lz - 30) < 4); }
// it may come down only once nobody would be shut out by it or caught under it: the one played, his friends, and
// those of the Order still standing (a man still on the ramp is fought there, through the open door)
export function exitClear(game) {
  if (byExit(game, game.player.pos)) return false;
  if (game.squad.ids.some((id) => { const n = game.npc(id); return n.visible && byExit(game, n.pos); })) return false;
  return !game.paint.guards.some((gd) => !gd.marked && gd.npc.visible && byExit(game, gd.npc.pos));
}
// it comes down and locks (a man of the Order sitting marked under it is moved in, out of its way)
export function shutExit(game) {
  const f = FAC(game);
  for (const gd of game.paint.guards) {
    const n = gd.npc, lx = n.pos.x - f.x, lz = n.pos.z - f.z;
    if (gd.marked && n.visible && lx > 85 && lx < 87.5 && Math.abs(lz - 30) < 4) { const p = L(game, 84.3, Math.max(27, Math.min(33, lz))); n.place(p.x, p.z, n.yaw, p.y); }
  }
  f.doors.exit.lock();
}

// the hangar's vehicles: a red fuel tank on each side that the player's pellets count on (three hits); a tank
// hit enough and the vehicle goes up after its warning (time to get clear of it), with whoever of the Order stands by it
const tankGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.75, 12).rotateZ(Math.PI / 2);
export const TANK_WARN = 2.3;
export function fuelTanks(m, game, vehicles, { onBlow = null } = {}) {
  clearTanks(m, game);
  m.tanks = [];
  for (const v of vehicles) {
    if (v.blown) continue;
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw), off = v.w / 2 + 0.24, along = v.kind === 'jeep' ? -0.9 : -1.5;
    const entry = { v, props: [], meshes: [], blast: null };
    for (const side of [-1, 1]) {
      const x = v.x + c * side * off + s * along, z = v.z - s * side * off + c * along, y = v.y + 0.95;
      const mat = new THREE.MeshStandardMaterial({ color: '#b3261e', emissive: '#ff3b2a', emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.4 });
      const mesh = new THREE.Mesh(tankGeo, mat); mesh.position.set(x, y, z); mesh.rotation.y = v.yaw; game.scene.add(mesh);
      entry.meshes.push(mesh);
      // shot through: the same long warning as the Order's own charge (he may be in cover right beside it)
      entry.props.push(game.paint.addProp({ x, y, z, r: 0.42, hits: 3, label: 'מיכל דלק', onHit: (pr) => {
        mat.emissiveIntensity = 0.55 + (pr.hits - pr.left) * 0.6; game.fx.sparks(x, y, z, 6);
        if (pr.done && !entry.blast && blowVehicle(m, game, entry, { warn: TANK_WARN, onBlow }) && near(game.player.pos, v, 7)) game.hud.toast('מיכל הדלק דולף! להתרחק מהרכב!', 1800);
      } }));
    }
    m.tanks.push(entry);
  }
  return m.tanks;
}
// one of them set off (a tank shot through, or the Order's own charge): the warning, the blast, the wreck
export function blowVehicle(m, game, entry, { warn = 2.2, onBlow = null, size = 2.6 } = {}) {
  if (entry.blast || entry.v.blown) return null;
  const v = entry.v;
  for (const pr of entry.props) game.paint.removeProp(pr);
  entry.blast = new FBlast(game, { at: { x: v.x, y: v.y, z: v.z }, size, warn, radius: 6, fire: 80, flash: true, onBoom: () => {
    v.blow(); for (const mesh of entry.meshes) gone(mesh); entry.meshes = [];
    (m.smoke ||= []).push(game.fx.smokeColumn(v.x, v.y + v.h * 0.6, v.z, { r: 1.2, strength: 1.4, seconds: 400 }));
    game.follow.shake(1.1);
    onBlow?.(v);
  } });
  (m.live ||= []).push(entry.blast);
  return entry.blast;
}
export function clearTanks(m, game) {
  for (const e of m.tanks || []) { for (const pr of e.props) game.paint.removeProp(pr); for (const mesh of e.meshes) gone(mesh); }
  m.tanks = [];
}
// the vehicles as the story has them by now: `blown` ones black wrecks with their fire and smoke, the rest whole
export function wrecks(m, game, blown) {
  const H = FAC(game).hangar;
  H.vehicles.forEach((v, i) => {
    if (blown.includes(i)) { v.blow(); (m.smoke ||= []).push(game.fx.smokeColumn(v.x, v.y + v.h * 0.6, v.z, { r: 1.2, strength: 1.2, seconds: 400 }), game.fx.burn(v.x, v.y + 0.6, v.z, { r: 1.2, strength: 0.8, seconds: 400 })); }
    else v.reset();
  });
}

// the battle elsewhere in the facility: now and then a far boom that shakes the halls and brings dust down
export function rumble(m, game, dt, { every = 12 } = {}) {
  m.rumbleT = (m.rumbleT ?? every * 0.6) - dt;
  if (m.rumbleT > 0 || game.cutscene) return;
  m.rumbleT = every * (0.7 + Math.random() * 0.6);
  const me = game.player.pos;
  game.sound?.boom?.(0.25 + Math.random() * 0.2);
  game.follow.shake(0.3 + Math.random() * 0.2);
  for (let k = 0; k < 3; k++) game.fx.dust(me.x + (Math.random() - 0.5) * 8, me.y + 3.6, me.z + (Math.random() - 0.5) * 8, 0.7);
}

// the lights fail for a moment (a charge took a cable): the picture goes black three times, sparks where it
// went; started with flicker(), played by flickerOn() from the mission's tick
export function flicker(m, game, at = null) { m.flick = { t: 0, k: 0, at }; }
export function flickerOn(m, game, dt) {
  const f = m.flick; if (!f) return;
  f.t += dt;
  const T = [0, 0.32, 0.8];
  while (f.k < T.length && f.t >= T[f.k]) {
    game.overlay?.flash('#000000', f.k === 2 ? 560 : 240, 0.9);
    game.sound?.hit?.('block', 0.25);
    if (f.at) game.fx.sparks(f.at.x, f.at.y, f.at.z, 10);
    f.k++;
  }
  if (f.k >= T.length) m.flick = null;
}

// the red emergency light over the halls of the way (the facility's own red lamps flash too); `areas`: names
// of FACILITY_ALERT below
const FACILITY_ALERT = {
  armory: { at: [56, -40], r: 22, zones: ['armory', 'corridor'] },
  corridor: { at: [40, -28], r: 42, zones: ['corridor'] },
  tunnels: { at: [64, -9], r: 30, zones: ['tunnels'] },
  stores: { at: [-6, 9], r: 46, zones: ['stores'] },
  hangar: { at: [58, 32], r: 40, zones: ['hangar', 'exit', 'saferoom'] },
};
export function redLight(game, areas = Object.keys(FACILITY_ALERT)) {
  const f = FAC(game);
  f.alarm(true);
  for (const k of areas) {
    const A = FACILITY_ALERT[k], at = L(game, A.at[0], A.at[1]);
    const points = f.redLamps.filter((r) => A.zones.includes(r.zone)).map((r) => ({ x: r.x, z: r.z, y: r.y }));
    game.fx.redAlert(true, { id: `fac-${k}`, at, r: A.r, points: points.length >= 2 ? points : undefined, intensity: 60 });
  }
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
export function later(m, game, lines) { (m.talk ||= []).push(lines); }
export function talkOn(m, game) { if (m.talk?.length && !game.dialogue.busy && !game.cutscene) game.dialogue.play(m.talk.shift()); }

// ---------- Nehorai carried, and his bandage ----------
// Ido (the player) and Erez carry him between them: Erez a little more than two metres ahead of Ido, facing him,
// Nehorai lying along the metre between them (his head at Ido's end), both of them with their arms under him; the
// three turn together as Ido turns (a wall in the way brings Erez in closer). The player walks it (slowly)
export class Carry {
  constructor(game, { by = 'erez' } = {}) {
    this.game = game; this.by = by; this.on = true; this.h = game.player.yaw;
    const e = game.npc(by), me = game.player.pos; game.squad.send(by, { x: me.x, z: me.z }, { label: 'נושא' }); e.target = null; e.idle = null; e.posed = false;
    this.update(1);
  }
  update(dt) {
    if (!this.on) return;
    const g = this.game, me = g.player.pos, e = g.npc(this.by), n = g.npc('nehorai');
    let d = this.h - g.player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.h -= d * Math.min(1, dt * 4);
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    let reach = 2.1;
    const hit = g.world.cols.raycast(me.x, me.y + 0.9, me.z, me.x + fx * 2.5, me.y + 0.9, me.z + fz * 2.5, g.player);
    if (hit !== null) reach = Math.max(1.3, 2.5 * hit - 0.4);
    e.target = null; e.place(me.x + fx * reach, me.z + fz * reach, this.h + Math.PI, me.y); e.model.setPose('carry');
    n.floorY = me.y + 0.62; n.place(me.x + fx * reach * 0.5, me.z + fz * reach * 0.5, this.h, me.y); n.model.setPose('floored');
    if (g.nehorai.pose !== 'carry') g.nehorai.setPose('carry');
  }
  stop() { this.on = false; const g = this.game; g.npc(this.by).model.setPose(null); g.squad.release(this.by); if (g.nehorai.pose === 'carry') g.nehorai.setPose(null); }
}

// a clean white bandage round the head (after the first aid); on whichever body plays Nehorai. Found again by name
export function bandage(model, on = true) {
  if (!model) return null;
  const head = model.bones?.head; if (!head) return null;
  let b = head.getObjectByName('bandage');
  if (!on) { if (b) { b.removeFromParent(); b.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } return null; }
  if (b) return b;
  b = new THREE.Group(); b.name = 'bandage';
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.9 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.104, 0.05, 18, 1, true), mat); band.position.set(0, 0.085, -0.005); band.rotation.x = -0.12;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.012), mat.clone()); pad.position.set(0.035, 0.09, 0.1); pad.rotation.x = -0.12;
  b.add(band, pad);
  head.add(b);
  return b;
}

// ---------- the safe room ----------
// the cot (Nehorai lies on it, his head on the pillow at its south end), where he sits on its edge, the stool
// beside it, and a place inside for each of the gang
export function cot(game) {
  const R = FAC(game).saferoom, b = R.bed, y = FAC(game).y;
  return {
    lie: { x: b.x, z: b.z + 0.25, yaw: Math.PI, y: b.y },        // on his back along the cot, the feet to the north
    sit: { x: b.x - 0.42, z: b.z, yaw: -Math.PI / 2, y },          // on its west edge, the feet on the floor
    stool: { x: b.x - 1.3, z: b.z - 0.6, yaw: Math.PI / 2 - 0.35, y }, // beside it, facing him
    by: [{ x: b.x - 1.05, z: b.z + 0.1, yaw: Math.PI / 2, y }, { x: b.x - 1.0, z: b.z + 1.3, yaw: Math.PI / 2 + 0.5, y }], // two standing over him
    head: { x: b.x, z: b.z + 0.75, y: b.y + 0.32 },
    pov: { x: b.x - 0.1, z: b.z + 0.5, y: b.y + 0.78 },            // just over his face, looking up at them
    up: { x: b.x - 1.1, z: b.z + 0.1 },                            // where he stands once he is up
  };
}
export function roomSpots(game) {
  const s = FAC(game).saferoom.spots.slice(), add = (lx, lz, yaw) => s.push(L(game, lx, lz, 0, yaw));
  add(42.6, 58.2, Math.PI); add(44.8, 61.4, Math.PI / 2); add(49.8, 59.2, Math.PI);
  return s;
}
const STOOLS = new WeakMap();
// a steel stool by the cot (Erez sits on it); null takes it away
export function stool(game, at) {
  let s = STOOLS.get(game);
  if (!at) { if (s) { s.removeFromParent(); s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); STOOLS.delete(game); } return null; }
  if (!s) {
    s = new THREE.Group(); s.name = 'stool';
    const mat = new THREE.MeshStandardMaterial({ color: '#59616b', roughness: 0.5, metalness: 0.5 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), mat); top.position.y = 0.44;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 8), mat.clone()); leg.position.y = 0.21;
    s.add(top, leg); game.scene.add(s); STOOLS.set(game, s);
  }
  s.position.set(at.x, at.y, at.z);
  return s;
}
// a friend in the safe room: standing, sitting on the stool, kneeling by the cot (a task keeps him there)
export function stay(game, id, at, { pose = null, label = 'בחדר' } = {}) {
  const n = game.npc(id);
  game.squad.send(id, { x: at.x, z: at.z }, { label }); n.target = null;
  n.floorY = null; n.idle = null; n.posed = false; n.face = null;
  n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null); n.model.setPose(pose); n.show(true);
  return n;
}

// everything a restore or a cleanup of these missions puts away first: the scene, the works and jobs, the
// blasts and beams, the tanks, the fire and smoke, the clock, the carry, the screen layers and the music
export function clearAll(m, game) {
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
  m.beats?.cancel(); m.beats = null; m.talk = [];
  m.work?.cancel(); m.work = null; m.job?.cancel(); m.job = null;
  for (const x of m.live || []) x.cancel?.(); m.live = [];
  for (const b of m.beams || []) b.remove(); m.beams = [];
  for (const s of m.smoke || []) s.stop?.(); m.smoke = [];
  clearTanks(m, game);
  m.carry?.stop(); m.carry = null;
  m.wave = null; m.flick = null;
  m.stopSiren?.(); m.stopSiren = null;
  game.paint.clearProps();
  game.hud.setPursuit(null);
  FAC(game).alarm(false);
  game.fx.resetAtmosphere();
  game.fx.clear?.();
  if (game.mode === 'car') game.exitCar();
}

export { attempt, crew, armCrew };
