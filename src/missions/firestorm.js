// Shared pieces of chapter eight, "מבצע סופת אש": Nehorai back at the controls with the whole gang
// around him, blasts that warn before they hurt, jobs the player works at, beams that fall and block
// the way, a friend pinned under something, and the clock on the pill. Paint, as always: whoever is
// marked three times is out, and a blast you stood in after its warning counts as a mark.
import * as THREE from 'three';
import { COLORS, OUT_AT } from '../combat/paint.js';
import { near } from './missions.js';
import { Job, postGuards, hideGuards, left } from './rescue.js';

export { Job, postGuards, hideGuards, left };
export const TEAM = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
export const NAMES = { nehorai: 'נהוראי', erez: 'ארז', ido: 'עידו', yonati: 'יונתי', avraham: 'אברהם', muller: 'מולר', dolev: 'דולב', hadar: 'הדר', liam: 'ליאם' };
export const MARKED_OUT = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "מההתחלה, אחי. והפעם אתה נשאר מאחורי."';

// an async continuation (after a line, a fade, a timer) belongs to the attempt that started it: the same
// mission, the same step, the same state; after a quit, a replay or a retry it does nothing
export function attempt(game, m) { const s = m.s, i = m.stepIndex; return () => game.missions.active === m && m.stepIndex === i && m.s === s; }
// on completion the gang stays only if a mission follows straight on and will take them over
export function handsOver(game) { const M = game.missions, n = M.next(); return !!(n?.follows && M.ready(n)); }

// Nehorai leads: the gang forms up behind him
export function crew(game, at, yaw, ids = TEAM) {
  if (game.playingAs !== 'nehorai') game.playAs('nehorai');
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; }
  game.squad.form(ids, { near: at, yaw, leader: 'nehorai' });
}
export function armCrew(game) {
  const P = game.paint;
  P.armPlayer(COLORS.nehorai);
  for (const id of game.squad.ids) { const n = game.npc(id); if (!n.visible) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
export function endCrew(game) {
  game.squad.dismiss();
  game.paint.dispose();
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) if (game[b]) game[b].held = false;
  for (const id of TEAM) game.npc(id).show(false);
}
export function failOut(m, game, steps) { return steps.includes(m.stepIndex) && game.paint.hits >= OUT_AT ? MARKED_OUT : null; }
// the gang arrives somewhere together (a drive in between is the story): on foot, formed up
export function arriveCrew(game, at, ids = TEAM) { if (game.mode === 'car') game.exitCar(); game.player.place(at.x, at.z, at.yaw, at.y ?? null); game.follow.snapBehind(at.yaw); crew(game, game.player.pos, at.yaw, ids); }
// the gang in the Renault for a drive: in with Nehorai, out at the other end
export function crewInCar(game, ids = TEAM) { for (const id of ids) { const n = game.npc(id); if (!n.inCar) n.enter(game.car); } }
export function crewOutOfCar(game, ids = TEAM) { ids.forEach((id, i) => { const n = game.npc(id); if (n.inCar) n.stepOut(i % 2 ? 1 : -1); }); }
// a line over the radio from someone not in sight
export function radio(game, who, text) { game.hud.toast(`קשר · ${who}`, 1400); return game.dialogue.play([[who, text, 'phone']]); }
// the clock on the pill
export const fmt = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export function clock(game, left, label = 'שעון') { game.hud.setPursuit(left == null ? null : `${label} · ${fmt(left)}`); }

// A blast that warns first: a red ring on the ground and beeps for `warn` seconds, then the explosion;
// Nehorai inside `radius` at that moment takes a mark (never without the warning). `at` may move
// (a function) for something that is carried or driven.
export class Blast {
  constructor(game, { at, size = 1.2, warn = 2.5, radius = 5.5, fire = 0, onBoom = null, hurts = true, quiet = false }) {
    this.game = game; this.at = typeof at === 'function' ? at : () => at; this.size = size; this.warn = warn; this.radius = radius; this.fire = fire; this.onBoom = onBoom; this.hurts = hurts;
    this.t = 0; this.done = false; this.beeped = -1;
    this.ring = null;
    if (!quiet) { const p = this.at(); this.ring = game.fx.ring(p.x, p.y + 0.05, p.z, radius); }
  }
  update(dt) {
    if (this.done) return;
    this.t += dt;
    const g = this.game, p = this.at();
    if (this.ring) { this.ring.position.set(p.x, p.y + 0.05, p.z); const k = Math.min(1, this.t / this.warn); this.ring.material.opacity = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * (6 + 18 * k))); }
    const tick = Math.floor(this.t * (this.t > this.warn - 1 ? 6 : 2));
    if (tick !== this.beeped && this.t < this.warn) { this.beeped = tick; g.sound?.beep?.(1, this.t > this.warn - 1 ? 1200 : 880); }
    if (this.t >= this.warn) this.boom();
  }
  boom() {
    const g = this.game, p = this.at();
    this.done = true;
    if (this.ring) { this.ring.removeFromParent(); this.ring = null; }
    g.fx.explode(p.x, p.y, p.z, { size: this.size, fire: this.fire });
    if (this.hurts && g.mode === 'foot' && near(g.player.pos, p, this.radius) && Math.abs(g.player.pos.y - (p.y ?? g.player.pos.y)) < 2.5) { g.paint.strike('הדף!'); g.player.push?.((g.player.pos.x - p.x) * 0.4, (g.player.pos.z - p.z) * 0.4); }
    this.onBoom?.(p);
  }
  cancel() { this.done = true; if (this.ring) { this.ring.removeFromParent(); this.ring = null; } }
}

// Something the player works at for a few seconds (a wheel, a lever, a jammed door, a beam on a friend):
// an interaction that starts it, a count on the pill while he stays close, cancelled if he walks away.
export class Work {
  constructor(game, { at, seconds = 4, label = 'להפעיל', pill = 'עובד', near: r = 2.3, onDone = null, onStart = null, y = null }) {
    this.game = game; this.at = at; this.seconds = seconds; this.label = label; this.pill = pill; this.r = r; this.onDone = onDone; this.onStart = onStart; this.y = y;
    this.t = 0; this.started = false; this.done = false; this.shown = -1;
  }
  // for a step's interaction(): the prompt when Nehorai is close and it is not done
  interaction(game = this.game) {
    if (this.done || this.started || game.mode !== 'foot' || !near(game.player.pos, this.at, this.r)) return null;
    return { label: this.label, priority: 6, run: () => { this.started = true; this.t = 0; this.onStart?.(); } };
  }
  update(dt) {
    if (this.done || !this.started) return;
    const g = this.game;
    if (!near(g.player.pos, this.at, this.r + 0.8)) { this.started = false; this.shown = -1; g.hud.toast('להישאר צמוד', 1200); return; }
    this.t += dt;
    const left = Math.max(0, this.seconds - this.t), shown = Math.ceil(left);
    if (shown !== this.shown) { this.shown = shown; if (shown > 0) g.hud.toast(`${this.pill} · ${shown}`, 1100); }
    if (left <= 0) { this.done = true; g.sound?.chime?.(true); this.onDone?.(); }
  }
  cancel() { this.done = true; }
}

// A beam (or a slab) that comes down: it falls over `seconds` from `from` to `to`, kicks up dust, and
// from then on blocks (a box the size of the beam). Used to change the way through a burning place.
export function dropBeam(game, { from, to, len = 6, yaw = 0, w = 0.5, h = 0.5, seconds = 0.9, onLand = null, block = true, color = '#5a5248' }) {
  const W = game.world;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  mesh.position.set(from.x, from.y, from.z); mesh.rotation.y = yaw;
  game.scene.add(mesh);
  const beam = { mesh, t: 0, landed: false, box: null, update(dt) {
    if (beam.landed) return;
    beam.t += dt;
    const k = Math.min(1, beam.t / seconds), e = k * k;
    mesh.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * e);
    mesh.rotation.z = (to.roll ?? 0) * e;
    if (k >= 1) { beam.landed = true; game.fx.dust(to.x, to.y, to.z, 1.4); game.fx.sparks(to.x, to.y + 0.3, to.z, 10); game.follow.shake(0.35); game.sound?.hit?.('crash', 0.9); if (block) beam.box = W.cols.addBox(to.x, to.z, w / 2 + 0.1, len / 2, yaw, to.y - 1, to.y + h + 0.6); onLand?.(beam); }
  }, remove() { game.scene.remove(mesh); if (beam.box) W.cols.remove(beam.box); } };
  return beam;
}

// a friend under a beam: he lies there until Nehorai lifts it (a Work of a few seconds)
export function pin(game, id, at, { label = 'להרים את הקורה', seconds = 3, onFree = null } = {}) {
  const n = game.npc(id);
  n.target = null; n.floorY = null; n.place(at.x, at.z, at.yaw ?? 0, at.y ?? null); n.model.setPose('down'); n.show(true); n.body.enabled = false;
  game.squad.send(id, { x: at.x, z: at.z }, { label: 'לכוד' }); n.target = null;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3.2), new THREE.MeshStandardMaterial({ color: '#5a5248', roughness: 0.85 }));
  beam.position.set(at.x, n.pos.y + 0.5, at.z); beam.rotation.y = (at.yaw ?? 0) + Math.PI / 2; game.scene.add(beam);
  const work = new Work(game, { at: { x: at.x, z: at.z }, seconds, label, pill: `מרים · ${NAMES[id] || id}`, near: 2.4, onDone: () => { game.scene.remove(beam); n.model.setPose(null); n.body.enabled = true; game.squad.release(id); game.hud.toast(`${NAMES[id] || id} על הרגליים`, 1500); onFree?.(n); } });
  work.beam = beam; work.npc = n;
  return work;
}
