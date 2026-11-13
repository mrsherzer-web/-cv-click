// Chapter ten: energy. A kit for foes that are not ordinary guards (the Threshold Keeper, the Shadow in
// his suit, the hall's defence system), used by the missions through game.energy.
//
// The attacks all warn before they hurt, and each has a way out:
//   ringAttack  a ring on the floor fills up, then bursts: step out of it
//   beamSweep   a line is shown, then sweeps across an arc: stand clear of the arc, or behind cover
//   bolt        a ball of light that flies slowly enough to step aside; cover stops it
// What a hit does to Nehorai is the mission's choice: a paint mark like any other (three and he is out,
// as everywhere), a knock-back, both, or only a call back. Nothing here ends a mission by itself.
//
// EnergyFoe wraps an Npc (or a bare model) as such a foe: it teleports (fades out, a shimmer where it
// will appear, fades in), makes copies of itself that pop when a pellet lands on them, stands behind
// shields fed by generators (pellets splash on the shield until every generator is down), shows a weak
// point for a few seconds (the only place pellets count, unless the mission says otherwise), and puts
// its name and health on chapter nine's boss bar.
//
// Everything drawn here comes from small pools made on first use and is let go in dispose(); the
// sparks are the effect system's own pooled particles. Paintball still: nothing here hurts anyone.
import * as THREE from 'three';
import { makeCharacter } from '../characters/builder.js';

export const ENERGY_COLOR = '#8a6bff';
const GRACE = 1.0;          // seconds after a hit in which nothing else hits Nehorai
const col = new THREE.Color();
const rgbOf = (hex, out) => { col.set(hex); out[0] = col.r; out[1] = col.g; out[2] = col.b; return out; };
const glowMat = (opacity = 0.6, additive = true) => new THREE.MeshBasicMaterial({ color: ENERGY_COLOR, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
// the distance from a point to a segment, squared (a bolt's step past someone)
function segDist2(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2)) : 0;
  const x = ax + dx * t - px, y = ay + dy * t - py, z = az + dz * t - pz;
  return x * x + y * y + z * z;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Energy {
  constructor(game) {
    this.game = game;
    this.attacks = [];     // rings, beams and bolts under way
    this.foes = new Set(); // EnergyFoe's, updated from here every frame
    this.catchers = [];    // things a bolt can be lured into: { x, y, z, r, onBolt }
    this.pool = { ring: [], beam: [], bolt: [], shimmer: [] };
    this.made = [];        // every pooled object ever built, for dispose()
    this.geo = null;       // the few geometries they share
    this.safe = 0;
    this.struck = 0;       // hits on Nehorai so far (missions and tests read it)
    this.knock = null;     // a knock-back being played out over a quarter second
    this.frame = -1;
    this.rgb = [1, 1, 1];
    this.spark = { life: 0.5, size: 0.3, grow: -0.2, color: this.rgb, alpha: 1, grav: 3, drag: 1.2 };
    this.trail = { life: 0.35, size: 0.34, grow: -0.5, color: this.rgb, alpha: 0.8, grav: 0, drag: 0.5 };
  }

  get active() { return this.attacks.length; }
  // a foe of energy (see EnergyFoe below): game.energy.foe({ npc: game.npc('keeper'), hp: 6, at: { x, z } })
  foe(opts) { return new EnergyFoe(this.game, opts); }
  // is Nehorai there to be hit: on foot, in play
  get open() { const g = this.game; return g.mode === 'foot' && !g.cutscene; }
  // crawling (chapter ten's hurt walk) or otherwise low: a beam or a bolt has to come in under the cover
  get low() { const p = this.game.player; return !!(p.crawling || p.prone || p.low); }

  // ---------- the pooled shapes ----------
  shapes() {
    if (this.geo) return this.geo;
    this.geo = {
      edge: new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2),
      disc: new THREE.CircleGeometry(1, 44).rotateX(-Math.PI / 2),
      strip: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),        // on the floor, from the origin along +z
      rod: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      ball: new THREE.SphereGeometry(1, 14, 10),
      column: new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0),
    };
    return this.geo;
  }
  take(kind) {
    let o = this.pool[kind].pop();
    if (!o) {
      const G = this.shapes(), mesh = (geo, opacity, additive) => { const m = new THREE.Mesh(geo, glowMat(opacity, additive)); m.frustumCulled = false; m.renderOrder = 3; return m; };
      const root = new THREE.Group();
      if (kind === 'ring') o = { root, edge: mesh(G.edge, 0.9, false), fill: mesh(G.disc, 0.25, false) };
      else if (kind === 'beam') o = { root, strip: mesh(G.strip, 0.5, false), rod: mesh(G.rod, 0.92, false), fan: null };
      else if (kind === 'bolt') o = { root, ball: mesh(G.ball, 0.8, false), core: mesh(G.ball, 0.95, true) };
      else o = { root, column: mesh(G.column, 0.4, true), edge: mesh(G.edge, 0.8, true) };
      for (const k in o) if (o[k]?.isMesh) root.add(o[k]);
      this.made.push(o);
    }
    // as new, whatever used it last
    o.root.rotation.set(0, 0, 0); o.root.scale.setScalar(1); o.root.visible = true;
    for (const k in o) if (o[k]?.isMesh) { const m = o[k]; m.visible = true; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(1); }
    this.game.scene.add(o.root);
    return o;
  }
  give(kind, o) {
    if (!o) return;
    if (o.fan) { o.fan.removeFromParent(); o.fan.geometry.dispose(); o.fan.material.dispose(); o.fan = null; }
    o.root.removeFromParent();
    this.pool[kind].push(o);
  }
  tint(o, hex) { for (const k in o) if (o[k]?.isMesh) o[k].material.color.set(hex); }
  // a burst of sparks in an energy colour (the effect system's pooled particles)
  sparks(x, y, z, hex = ENERGY_COLOR, n = 16, speed = 5) {
    const fire = this.game.fx?.fire; if (!fire) return;
    rgbOf(hex, this.rgb);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, v = speed * (0.4 + Math.random() * 0.6);
      fire.spawn(x, y, z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 1, Math.sin(a) * Math.cos(e) * v, this.spark);
    }
  }

  // ---------- a hit on Nehorai ----------
  // a: the attack ({ hit: 'mark' | 'knock' | 'both' | 'call', label, color, knock, onHit }); (sx, sz): where
  // it came from. One hit, then a moment's grace. Returns true when it counted
  hurt(a, sx, sz) {
    const g = this.game;
    if (this.safe > 0 || !this.open) return false;
    this.safe = GRACE;
    this.struck++;
    a.struck = true;
    const p = g.player.pos, dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz) || 1;
    if (a.hit === 'mark' || a.hit === 'both') g.paint.strike(a.label, a.color);
    else if (a.hit === 'knock') { g.hud.pop(a.label, 'hit'); g.hud.hurt?.(); g.follow.shake(0.4); g.sound?.hit?.('crash', 0.5); }
    const k = a.knock ?? (a.hit === 'knock' || a.hit === 'both' ? 2.4 : 0);
    if (k > 0) this.knock = { x: (dx / d) * k, z: (dz / d) * k, t: 0.25 };
    a.onHit?.('player', a);
    return true;
  }

  // ---------- the attacks ----------
  // A ring on the floor at `at` ({ x, z, y? }) of radius r: it fills from the middle for `warn` seconds,
  // blinking faster, then bursts. Whoever of Nehorai is still inside at the burst is hit (see hurt()):
  // hit 'mark' (a paint mark), 'knock' (thrown back `knock` m, no mark), 'both', or 'call' (only onHit).
  // onBurst(a) fires at the burst either way. Returns the attack: { done, struck, cancel() }
  ringAttack({ at, r = 4, warn = 1.4, color = ENERGY_COLOR, hit = 'mark', label = 'אנרגיה!', knock = null, onHit = null, onBurst = null } = {}) {
    const g = this.game, o = this.take('ring'), y = at.y ?? g.world.groundHeight(at.x, at.z, g.player.pos.y);
    this.tint(o, color);
    o.root.position.set(at.x, y + 0.07, at.z);
    o.edge.scale.setScalar(r); o.fill.scale.setScalar(0.01);
    const a = { kind: 'ring', o, x: at.x, y, z: at.z, r, warn, t: 0, color, hit, label, knock, onHit, onBurst, done: false, struck: false, burst: false, cancel: () => this.end(a) };
    this.attacks.push(a);
    g.sound?.beep?.(1, 540);
    return a;
  }

  // A beam from `from` ({ x, z, y? }) of length len. For `warn` seconds a thin line lies along angle0 and a
  // faint fan shows the arc it will cross; then the beam is lit and turns from angle0 to angle1 over
  // `seconds` (angles as yaw: 0 is +z, π/2 is +x). It hits Nehorai when it passes over him with nothing
  // solid between him and `from` (cover stops it; crawling, low cover is enough). `height`: how high over
  // the floor the beam runs (1.0)
  beamSweep({ from, angle0 = 0, angle1 = Math.PI / 2, len = 14, warn = 1.2, seconds = 2.4, width = 0.9, height = 1.0, color = ENERGY_COLOR, hit = 'mark', label = 'קרן!', knock = null, onHit = null, onDone = null } = {}) {
    const g = this.game, o = this.take('beam'), y = from.y ?? g.world.groundHeight(from.x, from.z, g.player.pos.y);
    this.tint(o, color);
    o.root.position.set(from.x, y, from.z);
    o.strip.position.y = 0.06;
    o.rod.position.y = height;
    o.rod.visible = false;
    // the arc it will cross, shown through the warning (one small shape for this sweep, freed with it)
    const lo = Math.min(angle0, angle1), span = Math.abs(angle1 - angle0);
    o.fan = new THREE.Mesh(new THREE.CircleGeometry(len, Math.max(6, Math.ceil(span * 10)), lo - Math.PI / 2, span).rotateX(-Math.PI / 2), glowMat(0.13, false));
    o.fan.material.color.set(color);
    o.fan.position.y = 0.04; o.fan.renderOrder = 2; o.fan.frustumCulled = false;
    o.root.add(o.fan);
    const a = { kind: 'beam', o, x: from.x, y, z: from.z, angle0, angle1, angle: angle0, len, warn, seconds, width, height, t: 0, color, hit, label, knock, onHit, onDone, done: false, struck: false, live: false, cancel: () => this.end(a) };
    this.attacks.push(a);
    this.aimBeam(a, angle0, len, false);
    g.sound?.beep?.(2, 700, 0.14);
    return a;
  }

  // A ball of light from `from` ({ x, y?, z }) toward `to` ({ x, y?, z }) or at `target` ('player', an Npc
  // or anything with pos). It gathers at `from` for `warn` seconds with a thin line along its way, then
  // flies at `speed` m/s (slow enough to step aside) for `life` seconds. `homing` (rad/s) lets it turn
  // after its target a little. The first solid thing on its way stops it (cover), a catcher (a generator
  // it is lured into, see addCatcher) takes it, and Nehorai within r of it is hit. onStop(a, point)
  bolt({ from, to = null, target = null, speed = 7, r = 0.45, warn = 0.5, homing = 0, life = 6, color = ENERGY_COLOR, hit = 'mark', label = 'כדור אנרגיה!', knock = null, onHit = null, onStop = null } = {}) {
    const g = this.game, o = this.take('bolt');
    const y = from.y ?? g.world.groundHeight(from.x, from.z, g.player.pos.y) + 1.2;
    this.tint(o, color); o.core.material.color.set('#ffffff');
    o.root.position.set(from.x, y, from.z);
    o.root.scale.setScalar(0.05);
    o.core.scale.setScalar(0.38);
    const lane = this.take('beam');
    this.tint(lane, color);
    lane.rod.visible = false;
    lane.strip.material.opacity = 0.3;
    const tg = target === 'player' || (!target && !to) ? g.player : target;
    const a = { kind: 'bolt', o, lane, x: from.x, y, z: from.z, px: from.x, py: y, pz: from.z, dx: 0, dy: 0, dz: 1, to, target: tg, speed, r, warn, homing, life, t: 0, acc: 0, color, hit, label, knock, onHit, onStop, done: false, struck: false, flying: false, stopped: null, cancel: () => this.end(a) };
    this.attacks.push(a);
    this.aimBolt(a);
    return a;
  }

  // something a bolt can be lured into (a generator to overload): a ball of radius r; onBolt(bolt) when
  // one reaches it. Returns the catcher (removeCatcher to take it away)
  addCatcher({ x, y, z, r = 1, onBolt = null }) { const c = { x, y, z, r, onBolt }; this.catchers.push(c); return c; }
  removeCatcher(c) { const i = this.catchers.indexOf(c); if (i >= 0) this.catchers.splice(i, 1); }

  aimBolt(a) {
    const g = this.game, tg = a.target, low = tg === g.player && this.low;
    const tx = tg ? tg.pos.x : a.to.x, tz = tg ? tg.pos.z : a.to.z, ty = tg ? tg.pos.y + (low ? 0.4 : 1.0) : a.to.y ?? a.y;
    const dx = tx - a.x, dy = ty - a.y, dz = tz - a.z, d = Math.hypot(dx, dy, dz) || 1;
    a.dx = dx / d; a.dy = dy / d; a.dz = dz / d;
    const L = a.lane, flat = Math.hypot(dx, dz);
    L.root.position.set(a.x, g.world.groundHeight(a.x, a.z, a.y) + 0.05, a.z);
    L.root.rotation.y = Math.atan2(dx, dz);
    L.strip.scale.set(0.16, 1, Math.min(a.speed * a.life, flat + 5));
  }
  aimBeam(a, angle, len, live) {
    const o = a.o;
    o.strip.rotation.y = o.rod.rotation.y = angle;
    o.strip.scale.set(live ? a.width : 0.3, 1, len);
    o.rod.scale.set(0.09, 0.09, len);
  }

  end(a) {
    if (a.done) return;
    a.done = true;
    if (a.kind === 'bolt') { this.give('bolt', a.o); this.give('beam', a.lane); a.lane = null; } else this.give(a.kind, a.o);
    a.o = null;
  }
  // every attack under way stopped and put away (a mission's cleanup, a restore)
  clear() {
    for (const a of this.attacks) this.end(a);
    this.attacks.length = 0;
    this.knock = null;
    this.safe = 0;
  }

  // ---------- each frame (called from the markers' update, so it runs with the game) ----------
  update(dt) {
    const g = this.game;
    if (this.frame === g.time) return;
    this.frame = g.time;
    this.safe = Math.max(0, this.safe - dt);
    const k = this.knock;
    if (k) { // thrown back over a quarter second, in steps, so walls stop it
      const s = Math.min(dt, k.t) / 0.25;
      if (g.mode === 'foot') g.player.push(k.x * s, k.z * s);
      if ((k.t -= dt) <= 0) this.knock = null;
    }
    const list = this.attacks;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (!a.done) { a.t += dt; if (a.kind === 'ring') this.stepRing(a, dt); else if (a.kind === 'beam') this.stepBeam(a, dt); else this.stepBolt(a, dt); }
      if (a.done) list.splice(i, 1);
    }
    for (const f of this.foes) f.update(dt);
  }

  stepRing(a) {
    const g = this.game, o = a.o;
    if (!a.burst) {
      const k = Math.min(1, a.t / a.warn);
      o.fill.scale.setScalar(Math.max(0.01, a.r * k));
      o.fill.material.opacity = 0.16 + 0.3 * k;
      o.edge.material.opacity = 0.55 + 0.4 * Math.sin(a.t * (8 + k * 18));
      if (a.t < a.warn) return;
      a.burst = true;
      // the burst: light all over the ring, sparks at its rim, whoever is still inside is hit
      o.fill.material.color.set('#ffffff'); o.fill.material.opacity = 0.75;
      for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2; this.sparks(a.x + Math.cos(an) * a.r * 0.8, a.y + 0.3, a.z + Math.sin(an) * a.r * 0.8, a.color, 3, 5); }
      this.sparks(a.x, a.y + 0.5, a.z, a.color, 14, 7);
      const p = g.player.pos, d = Math.hypot(p.x - a.x, p.z - a.z), cam = g.camera.position;
      g.follow.shake(Math.max(0, 0.3 * (1 - Math.hypot(cam.x - a.x, cam.z - a.z) / 40)));
      if (g.sound?.thunder) g.sound.thunder(0.45); else g.sound?.hit?.('crash', 0.45);
      if (d <= a.r && Math.abs(p.y - a.y) < 2.5) this.hurt(a, a.x, a.z);
      a.onBurst?.(a);
      return;
    }
    const u = (a.t - a.warn) / 0.3; // the afterglow
    o.fill.material.opacity = 0.75 * Math.max(0, 1 - u);
    o.edge.material.opacity = 0.9 * Math.max(0, 1 - u);
    if (u >= 1) this.end(a);
  }

  stepBeam(a, dt) {
    const g = this.game, o = a.o;
    if (a.t < a.warn) { // the warning: a thin line that blinks, the arc faint under it
      o.strip.material.opacity = 0.65 + 0.3 * Math.sin(a.t * 14);
      return;
    }
    if (!a.live) { a.live = true; o.rod.visible = true; o.strip.material.opacity = 0.55; if (g.sound?.zap) g.sound.zap(1, 0.6); else g.sound?.hit?.('crash', 0.3); }
    const u = Math.min(1, (a.t - a.warn) / a.seconds), prev = a.angle;
    a.angle = a.angle0 + (a.angle1 - a.angle0) * u;
    // the beam ends at the first solid thing
    const sx = Math.sin(a.angle), sz = Math.cos(a.angle), cols = g.world.cols, hy = a.y + a.height;
    const cut = cols.raycast(a.x, hy, a.z, a.x + sx * a.len, hy, a.z + sz * a.len), len = a.len * (cut ?? 1);
    this.aimBeam(a, a.angle, len, true);
    o.rod.material.opacity = 0.75 + 0.2 * Math.sin(a.t * 30);
    if ((a.acc = (a.acc || 0) + dt) > 0.05) { a.acc = 0; this.sparks(a.x + sx * len, hy, a.z + sz * len, a.color, 2, 3); }
    // over Nehorai: his bearing inside what the beam crossed this frame (and its width), in reach, in sight
    if (this.open && this.safe <= 0) {
      const p = g.player.pos, dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
      if (d <= a.len + 0.3 && d > 0.2 && Math.abs(p.y - a.y) < 2) {
        const mid = prev + angDiff(a.angle, prev) / 2, half = Math.abs(angDiff(a.angle, prev)) / 2 + Math.atan2(a.width / 2 + 0.3, d);
        if (Math.abs(angDiff(Math.atan2(dx, dz), mid)) <= half && cols.raycast(a.x, hy, a.z, p.x, p.y + (this.low ? 0.4 : 1.0), p.z, g.player) === null) this.hurt(a, a.x, a.z);
      }
    }
    if (u >= 1) { a.onDone?.(a); this.end(a); }
  }

  stepBolt(a, dt) {
    const g = this.game, o = a.o, cols = g.world.cols;
    if (!a.flying) { // gathering: it grows where it is, its line follows the target until it goes
      const k = Math.min(1, a.t / a.warn);
      o.root.scale.setScalar(a.r * (0.2 + 0.8 * k));
      if (a.target) this.aimBolt(a);
      a.lane.strip.material.opacity = 0.2 + 0.25 * Math.sin(a.t * 18);
      if (a.t < a.warn) return;
      a.flying = true; a.t = 0;
      this.give('beam', a.lane); a.lane = null;
      if (g.sound?.zap) g.sound.zap(0.8, 1); else g.sound?.shot?.();
      return;
    }
    if (a.homing > 0 && a.target) { // turning after the target a little, on the level
      const tp = a.target.pos, want = Math.atan2(tp.x - a.x, tp.z - a.z), cur = Math.atan2(a.dx, a.dz), flat = Math.hypot(a.dx, a.dz);
      const step = Math.max(-a.homing * dt, Math.min(a.homing * dt, angDiff(want, cur))), yaw = cur + step;
      a.dx = Math.sin(yaw) * flat; a.dz = Math.cos(yaw) * flat;
    }
    a.px = a.x; a.py = a.y; a.pz = a.z;
    let nx = a.x + a.dx * a.speed * dt, ny = a.y + a.dy * a.speed * dt, nz = a.z + a.dz * a.speed * dt, stop = false;
    const t = cols.raycast(a.px, a.py, a.pz, nx, ny, nz);
    if (t !== null) { nx = a.px + (nx - a.px) * t; ny = a.py + (ny - a.py) * t; nz = a.pz + (nz - a.pz) * t; stop = true; }
    if (ny < g.world.groundHeight(nx, nz, a.py) + 0.12) stop = true;
    a.x = nx; a.y = ny; a.z = nz;
    o.root.position.set(nx, ny, nz);
    o.root.scale.setScalar(a.r * (1 + 0.12 * Math.sin(a.t * 22)));
    if ((a.acc += dt) > 0.045) { a.acc = 0; rgbOf(a.color, this.rgb); g.fx?.fire?.spawn(nx, ny, nz, 0, 0.2, 0, this.trail); }
    // a generator it was lured into
    for (const c of this.catchers) {
      const reach = c.r + a.r + (stop ? 0.7 : 0);
      if (segDist2(c.x, c.y, c.z, a.px, a.py, a.pz, nx, ny, nz) <= reach * reach) { this.burstBolt(a); c.onBolt?.(a); return; }
    }
    if (this.open) {
      const p = g.player.pos, reach = a.r + 0.4;
      if (segDist2(p.x, p.y + (this.low ? 0.4 : 0.95), p.z, a.px, a.py, a.pz, nx, ny, nz) <= reach * reach && this.hurt(a, a.px, a.pz)) { this.burstBolt(a); return; }
    }
    if (stop || a.t >= a.life) this.burstBolt(a);
  }
  burstBolt(a) {
    a.stopped = { x: a.x, y: a.y, z: a.z };
    this.sparks(a.x, a.y, a.z, a.color, 14, 5);
    this.game.sound?.splat?.();
    a.onStop?.(a, a.stopped);
    this.end(a);
  }

  // the pools let go for good (a page that tears the game down); foes are their makers' to dispose
  dispose() {
    this.clear();
    for (const o of this.made) for (const k in o) if (o[k]?.isMesh) { o[k].removeFromParent(); o[k].material.dispose(); }
    if (this.geo) for (const k in this.geo) this.geo[k].dispose();
    this.geo = null;
    this.made.length = 0;
    this.pool = { ring: [], beam: [], bolt: [], shimmer: [] };
    this.catchers.length = 0;
  }
}

// A foe of energy. `npc`: the Npc it is (game.npc('keeper'), game.npc('shadow')), or `model`: a bare model
// from makeCharacter that the foe places and owns. hp: the hits it takes (pellets on its weak point, or
// on its body while `vulnerable`); at: { x, z, yaw? } where it stands; name: for the boss bar (bar: false
// for none); r, height: its size for pellets (by default from the model).
// Calls back: onHurt(foe, n), onDown(foe), onBody(foe, power) a pellet on the body that did not count,
// onFound(foe) the real one hit among its copies (they all pop), onCopy(foe, left) a copy popped,
// onShield(foe, i, left) a shield fell (i < 0: a pellet splashed on the shield), onWeak(foe, on).
// tag: the boss bar's line when nothing else is going on; hint: what the HUD says when a pellet on the body
// does nothing; downPose: the pose it takes when beaten ('down'; null leaves it standing).
export class EnergyFoe {
  constructor(game, { npc = null, model = null, hp = 6, at = null, name = null, color = ENERGY_COLOR, r = null, height = null, bar = true, vulnerable = false, hint = null, tag = null, downPose = 'down', onHurt = null, onDown = null, onBody = null, onFound = null, onCopy = null, onShield = null, onWeak = null } = {}) {
    this.game = game;
    this.kit = game.energy;
    this.npc = npc;
    this.model = npc ? npc.model : model;
    this.own = !npc;                         // a bare model is placed, animated and freed here
    this.pos = npc ? npc.pos : { x: 0, y: 0, z: 0 };
    this.yawOwn = 0;
    const big = !!this.model.energy, sc = this.model.spec?.height || 1;
    this.r = r ?? (big ? 0.75 : 0.5) * sc;
    this.height = height ?? (big ? 3.0 : 1.85) * sc;
    this.core = this.height * (big ? 0.66 : 0.68); // where the weak point glows
    this.name = name ?? this.model.spec?.name ?? '';
    this.color = color;
    this.hp = this.maxHp = hp;
    this.down = false;
    this.vulnerable = vulnerable;            // pellets on the body count (otherwise only the weak point does)
    this.hint = hint;                        // what the HUD says when a pellet on the body does nothing
    this.tag = tag;                          // the boss bar's line when nothing else is going on
    this.downPose = downPose;                // the pose it takes when its health is gone (null: left as it is)
    this.bar = bar;
    this.alpha = 1;
    this.tp = null;                          // a teleport under way
    this.teleports = 0;
    this.shields = [];
    this.copyList = [];
    this.weak = 0;                           // seconds the weak point stays open
    this.ripple = 0;
    this.said = -9;
    this.clock = 0;
    this.frame = -1;
    this.hud = { name: this.name, frac: 1, phase: 0, marks: [], open: false, floored: false, tag: '' };
    this.barOn = false;
    this.tagN = -1; this.tagShield = '';
    Object.assign(this, { onHurt, onDown, onBody, onFound, onCopy, onShield, onWeak });
    if (this.own) game.scene.add(this.model.root);
    // what pellets land on: the body (or the shield round it), and the weak point while it is open
    this.body = game.paint.addTarget({ pos: this.pos, r: this.r, lo: 0.2, hi: this.height, onHit: (pt, power) => this.bodyHit(pt, power) });
    this.weakPos = { x: 0, y: 0, z: 0 };
    this.weakTarget = game.paint.addTarget({ pos: this.weakPos, r: Math.max(0.42, this.r * 0.8), lo: 0, hi: 0.9, on: false, onHit: (pt, power) => this.weakHit(pt, power) });
    this.bubble = null; this.orb = null;
    if (at) this.place(at.x, at.z, at.yaw ?? this.yaw, at.y ?? null);
    this.kit.foes.add(this);
  }

  get yaw() { return this.npc ? this.npc.yaw : this.yawOwn; }
  set yaw(v) { if (this.npc) this.npc.yaw = v; else this.yawOwn = v; }
  get teleporting() { return !!this.tp; }
  get shielded() { for (const s of this.shields) if (s.up) return true; return false; }
  get shieldsUp() { let n = 0; for (const s of this.shields) if (s.up) n++; return n; }
  get exposed() { return this.weak > 0; }
  get copies() { let n = 0; for (const c of this.copyList) if (c.alive) n++; return n; }

  place(x, z, yaw = this.yaw, y = null) {
    const g = this.game;
    if (this.npc) { this.npc.place(x, z, yaw, y); if (y != null) { this.npc.pos.y = y; this.npc.sync(); } } else {
      this.pos.x = x; this.pos.z = z; this.pos.y = y ?? g.world.groundHeight(x, z, g.player.pos.y); this.yawOwn = yaw;
      this.model.root.position.set(this.pos.x, this.pos.y, this.pos.z); this.model.root.rotation.y = yaw;
    }
  }
  show(on) { if (this.npc) this.npc.show(on); else this.model.root.visible = on; }
  fade(a) { this.alpha = a; this.model.setOpacity?.(a); }

  // ---------- its own attacks (the kit's, from where it stands) ----------
  // a ring under Nehorai (or `at`), a beam across where he is (`arc` wide, or angle0/angle1), a bolt at him
  ring(o = {}) { const p = this.game.player.pos; return this.kit.ringAttack({ color: this.color, ...o, at: o.at ?? { x: p.x, z: p.z, y: p.y } }); }
  sweep({ arc = 1.6, ...o } = {}) {
    const p = this.game.player.pos, mid = Math.atan2(p.x - this.pos.x, p.z - this.pos.z), side = Math.random() < 0.5 ? 1 : -1;
    return this.kit.beamSweep({ color: this.color, angle0: mid - side * arc / 2, angle1: mid + side * arc / 2, ...o, from: o.from ?? { x: this.pos.x, z: this.pos.z, y: this.pos.y } });
  }
  shoot(o = {}) { return this.kit.bolt({ color: this.color, target: o.to ? null : 'player', ...o, from: o.from ?? { x: this.pos.x, y: this.pos.y + this.core, z: this.pos.z } }); }

  // ---------- teleporting ----------
  // It fades out, a shimmer stands where it will appear for `wait` seconds (the warning), then it fades in
  // there. to: { x, z, yaw?, y? }. While it is away pellets find nothing. False when it is already on its way
  teleport(to, { out = 0.4, wait = 0.7, into = 0.4, onArrive = null } = {}) {
    if (this.tp || this.down) return false;
    const g = this.game, y = to.y ?? g.world.groundHeight(to.x, to.z, this.pos.y), sh = this.kit.take('shimmer');
    this.kit.tint(sh, this.color);
    sh.root.position.set(to.x, y + 0.05, to.z);
    sh.column.scale.set(this.r * 0.9, this.height, this.r * 0.9);
    sh.edge.scale.setScalar(this.r * 1.6);
    this.tp = { x: to.x, y, z: to.z, yaw: to.yaw ?? null, fixY: to.y != null, t: 0, out, wait, into, phase: 'out', sh, onArrive };
    this.body.on = false;
    this.kit.sparks(this.pos.x, this.pos.y + this.core, this.pos.z, this.color, 10, 3);
    return true;
  }
  stepTeleport(dt) {
    const T = this.tp, sh = T.sh;
    T.t += dt;
    sh.column.material.opacity = 0.22 + 0.2 * Math.sin(this.clock * 20);
    sh.edge.material.opacity = 0.5 + 0.4 * Math.sin(this.clock * 13);
    if (T.phase === 'out') {
      this.fade(Math.max(0, 1 - T.t / T.out));
      if (T.t >= T.out) { T.phase = 'wait'; T.t = 0; this.show(false); }
    } else if (T.phase === 'wait') {
      if (T.t >= T.wait) {
        T.phase = 'in'; T.t = 0;
        const yaw = T.yaw ?? Math.atan2(this.game.player.pos.x - T.x, this.game.player.pos.z - T.z);
        this.place(T.x, T.z, yaw, T.fixY ? T.y : null);
        this.show(true);
        this.kit.sparks(T.x, T.y + this.core, T.z, this.color, 12, 4);
      }
    } else {
      this.fade(Math.min(1, T.t / T.into));
      if (T.t >= T.into) {
        this.fade(1);
        this.kit.give('shimmer', sh);
        this.tp = null;
        this.teleports++;
        T.onArrive?.(this);
      }
    }
  }

  // ---------- copies ----------
  // n copies of itself at `spots` ([{ x, z, yaw? }]). With more spots than copies the real one moves too:
  // it teleports to one of the spots left over, chosen at random, so where it stood tells nothing. A copy
  // pops when a pellet lands on it; a pellet on the real one pops them all (onFound). The tell: a copy
  // casts no shadow and flickers for a blink every few seconds. seconds > 0: they fade by themselves
  spawnCopies(n, spots, { seconds = 0 } = {}) {
    const g = this.game, order = spots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (spots.length > n) this.teleport(spots[order[n]], { out: 0.25, wait: 0.35, into: 0.3 });
    let made = 0;
    for (let i = 0; i < n && i < spots.length; i++) {
      const s = spots[order[i]];
      let c = this.copyList.find((q) => !q.alive);
      if (!c) {
        const model = makeCharacter(this.model.spec);
        model.setShadow?.(false);
        c = { model, pos: { x: 0, y: 0, z: 0 }, yaw: 0, alive: false, alpha: 0, blink: 0, left: 0, target: null };
        c.target = g.paint.addTarget({ pos: c.pos, r: this.r, lo: 0.2, hi: this.height, on: false, onHit: () => this.popCopy(c) });
        this.copyList.push(c);
      }
      c.pos.x = s.x; c.pos.z = s.z; c.pos.y = s.y ?? g.world.groundHeight(s.x, s.z, this.pos.y);
      c.yaw = s.yaw ?? Math.atan2(g.player.pos.x - s.x, g.player.pos.z - s.z);
      c.alive = true; c.alpha = 0; c.blink = 1.5 + Math.random() * 2; c.left = seconds;
      c.target.on = true;
      c.model.setArmor?.(!!this.model.armor);
      c.model.setPose(this.model.pose);
      c.model.root.position.set(c.pos.x, c.pos.y, c.pos.z);
      c.model.root.rotation.y = c.yaw;
      c.model.root.visible = true;
      g.scene.add(c.model.root);
      this.kit.sparks(c.pos.x, c.pos.y + this.core, c.pos.z, this.color, 8, 3);
      made++;
    }
    return made;
  }
  popCopy(c, quiet = false) {
    if (!c.alive) return;
    c.alive = false;
    c.target.on = false;
    c.model.root.removeFromParent();
    this.kit.sparks(c.pos.x, c.pos.y + this.core, c.pos.z, this.color, quiet ? 6 : 18, 5);
    if (!quiet) { this.game.hud.pop('העתק!', 'counter'); this.onCopy?.(this, this.copies); }
  }
  clearCopies() { for (const c of this.copyList) this.popCopy(c, true); }

  // ---------- shields ----------
  // A shield fed by a generator: while any is up, pellets splash on the bubble round the foe (and the marker
  // no longer locks on to the foe, so it finds the generators). generator: a point { x, y, z } or a paint
  // prop (paint.addProp). kind 'shoot': the generator takes `hits` pellets: at a point it is a target of
  // radius r the marker locks on to; a prop of the mission's own keeps its own hits and aim. 'overload': an
  // energy bolt lured into it brings it down; 'switch': the mission calls shieldDown(i) when its console is
  // worked. A thin line of light runs from each generator to the foe while it feeds it. Returns its index
  addShield({ generator, kind = 'shoot', hits = 3, r = 0.6 } = {}) {
    const g = this.game, i = this.shields.length, p = generator.pos ?? generator;
    const s = { up: true, kind, x: p.x, y: p.y, z: p.z, prop: null, target: null, left: hits, catcher: null, beam: this.kit.take('beam') };
    this.kit.tint(s.beam, this.color);
    s.beam.strip.visible = false; s.beam.rod.visible = true; s.beam.rod.position.y = 0;
    if (kind === 'shoot') {
      if (generator.left !== undefined) { s.prop = generator; const prev = generator.onHit; generator.onHit = (pr, pt) => { prev?.(pr, pt); if (pr.done) this.shieldDown(i); }; }
      else {
        s.target = g.paint.addTarget({ pos: { x: p.x, y: p.y - r, z: p.z }, r, lo: 0, hi: r * 2, onHit: (pt, power) => {
          if (!s.up) return;
          s.left -= power;
          this.kit.sparks(pt.x, pt.y, pt.z, this.color, 6, 3);
          if (s.left <= 0) this.shieldDown(i); else g.hud.pop(`פגיעה! עוד ${Math.ceil(s.left)}`, 'counter');
        } });
      }
    } else if (kind === 'overload') s.catcher = this.kit.addCatcher({ x: p.x, y: p.y, z: p.z, r: r + 0.5, onBolt: () => this.shieldDown(i) });
    this.shields.push(s);
    if (!this.bubble) {
      this.bubble = new THREE.Mesh(this.kit.shapes().ball, glowMat(0.16, true));
      this.bubble.material.color.set(this.color);
      this.bubble.frustumCulled = false; this.bubble.renderOrder = 4;
      this.game.scene.add(this.bubble);
    }
    return i;
  }
  shieldDown(i) {
    const s = this.shields[i]; if (!s || !s.up) return false;
    s.up = false;
    this.kit.give('beam', s.beam); s.beam = null;
    if (s.target) { this.game.paint.removeTarget(s.target); s.target = null; }
    if (s.catcher) this.kit.removeCatcher(s.catcher);
    this.kit.sparks(s.x, s.y, s.z, this.color, 22, 6);
    this.game.fx?.sparks?.(s.x, s.y, s.z, 10);
    this.ripple = 0.6;
    const left = this.shieldsUp;
    this.game.hud.pop(left ? `מחולל נפל · נשארו ${left}` : 'המגן נפל!', 'counter');
    this.game.sound?.hit?.('crash', 0.4);
    this.onShield?.(this, i, left);
    return true;
  }

  // ---------- the weak point ----------
  // open for `seconds`: a glowing ball at its core that pellets count on (each takes the marker's power off
  // its health). hideWeak() closes it early
  exposeWeak(seconds = 5) {
    if (this.down) return false;
    const was = this.weak > 0;
    this.weak = seconds;
    this.weakTarget.on = true;
    if (!this.orb) {
      this.orb = new THREE.Mesh(this.kit.shapes().ball, glowMat(0.9, true));
      this.orb.material.color.set('#ffe9a8');
      this.orb.frustumCulled = false; this.orb.renderOrder = 5;
      this.game.scene.add(this.orb);
    }
    this.orb.visible = true;
    if (!was) { this.game.hud.pop('נקודת התורפה חשופה!', 'counter'); this.onWeak?.(this, true); }
    return true;
  }
  hideWeak() {
    if (this.weak <= 0) return;
    this.weak = 0;
    this.weakTarget.on = false;
    if (this.orb) this.orb.visible = false;
    this.onWeak?.(this, false);
  }

  // ---------- pellets ----------
  say(text, kind = 'block') { if (this.clock - this.said > 1.6) { this.said = this.clock; this.game.hud.pop(text, kind); } }
  bodyHit(pt, power) {
    if (this.down || this.tp) return;
    if (this.shielded) { // it splashes on the shield
      this.ripple = 0.35;
      this.kit.sparks(pt.x, pt.y, pt.z, this.color, 5, 2);
      this.say(`המגן בולם · ${this.shieldsUp} מחוללים`);
      this.onShield?.(this, -1, this.shieldsUp);
      return;
    }
    if (this.copies > 0) { this.clearCopies(); this.game.hud.pop('זה האמיתי!', 'counter'); this.onFound?.(this); }
    if (this.vulnerable) { this.hurt(power, 'player'); return; }
    this.model.flash?.(0.5);
    this.say(this.hint ?? 'הצבע לא נדבק · לחשוף את נקודת התורפה');
    this.onBody?.(this, power);
  }
  weakHit(pt, power) {
    if (this.down || this.weak <= 0) return;
    this.kit.sparks(pt.x, pt.y, pt.z, '#ffe9a8', 10, 4);
    this.hurt(power, 'player');
  }
  // n off its health (a pellet that counted; a mission may call it for its own reasons)
  hurt(n = 1, by = null) {
    if (this.down) return;
    this.hp = Math.max(0, this.hp - n);
    this.model.flash?.(1);
    this.game.follow.shake(0.08);
    this.onHurt?.(this, n, by);
    if (this.hp <= 0) this.goDown();
    else this.game.hud.pop('פגיעה!', 'counter');
  }
  goDown() {
    if (this.down) return;
    this.down = true;
    this.hideWeak();
    this.clearCopies();
    for (let i = 0; i < this.shields.length; i++) if (this.shields[i].up) this.shieldDown(i);
    this.body.on = false;
    if (this.downPose) this.model.setPose?.(this.downPose);
    this.kit.sparks(this.pos.x, this.pos.y + this.core, this.pos.z, this.color, 30, 7);
    if (this.barOn) { this.game.hud.setBoss(null); this.barOn = false; }
    this.onDown?.(this);
  }
  // the suit broken off (the Shadow's): sparks, and the plates are gone
  breakArmor() {
    if (!this.model.armor) return false;
    this.model.setArmor(false);
    this.kit.sparks(this.pos.x, this.pos.y + this.core, this.pos.z, this.color, 30, 7);
    this.game.fx?.sparks?.(this.pos.x, this.pos.y + 1.2, this.pos.z, 16);
    this.game.follow.shake(0.3);
    this.game.sound?.hit?.('crash', 0.6);
    return true;
  }

  // ---------- each frame (the kit calls it; a second call in the same frame does nothing) ----------
  update(dt) {
    const g = this.game;
    if (this.frame === g.time) return;
    this.frame = g.time;
    this.clock += dt;
    if (this.own) { this.model.animate(dt, 0, 1); this.model.root.position.set(this.pos.x, this.pos.y, this.pos.z); this.model.root.rotation.y = this.yawOwn; }
    if (this.tp) this.stepTeleport(dt);
    const shielded = this.shielded, away = !!this.tp || this.down;
    // what pellets find: the shield's bubble while it is up, the body otherwise, the weak point while open
    this.body.on = !away && this.weak <= 0;
    this.body.r = shielded ? this.r + 0.75 : this.r;
    this.body.lock = !shielded;
    if (this.weak > 0) {
      this.weak -= dt;
      this.weakPos.x = this.pos.x; this.weakPos.z = this.pos.z; this.weakPos.y = this.pos.y + this.core - 0.45;
      const k = 0.36 + 0.07 * Math.sin(this.clock * 9);
      this.orb.position.set(this.pos.x, this.pos.y + this.core, this.pos.z);
      this.orb.scale.setScalar(Math.max(0.2, this.r * 0.8) * (k / 0.36) * 0.62);
      this.orb.visible = !away;
      this.weakTarget.on = !away;
      if (this.weak <= 0) this.hideWeak();
    }
    this.ripple = Math.max(0, this.ripple - dt);
    if (this.bubble) {
      this.bubble.visible = shielded && !away;
      if (this.bubble.visible) {
        this.bubble.position.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z);
        this.bubble.scale.set(this.r + 0.75, this.height * 0.62, this.r + 0.75);
        this.bubble.material.opacity = 0.13 + 0.04 * Math.sin(this.clock * 3) + this.ripple * 0.9;
      }
    }
    for (const s of this.shields) if (s.up) { // the feed from each generator to the foe
      const b = s.beam, dx = this.pos.x - s.x, dy = this.pos.y + this.core - s.y, dz = this.pos.z - s.z, d = Math.hypot(dx, dy, dz) || 1;
      b.root.visible = !away;
      b.root.position.set(s.x, s.y, s.z);
      b.rod.rotation.set(-Math.asin(dy / d), Math.atan2(dx, dz), 0, 'YXZ');
      b.rod.scale.set(0.035, 0.035, d);
      b.rod.material.opacity = 0.5 + 0.3 * Math.sin(this.clock * 11 + s.x);
    }
    for (const c of this.copyList) if (c.alive) {
      c.alpha = Math.min(1, c.alpha + dt * 2.5);
      c.blink -= dt;
      const flick = c.blink < 0.12; // the tell: a blink every few seconds
      if (c.blink <= 0) c.blink = 2.2 + Math.random() * 1.8;
      c.model.setOpacity?.(flick ? 0.3 : c.alpha * 0.94);
      c.model.setPose(this.model.pose);
      c.model.animate(dt, 0, 1);
      c.model.root.rotation.y = Math.atan2(g.player.pos.x - c.pos.x, g.player.pos.z - c.pos.z);
      if (c.left > 0 && (c.left -= dt) <= 0) this.popCopy(c, true);
    }
    // the boss bar (chapter nine's), unless a fist fight is using it
    const show = this.bar && !this.down && !(g.fight && !g.fight.over);
    if (show) {
      const H = this.hud, n = this.copies;
      H.frac = this.hp / this.maxHp; H.open = this.weak > 0;
      if (shielded && this.tagN !== this.shieldsUp) { this.tagN = this.shieldsUp; this.tagShield = `מגן · ${this.tagN} מחוללים`; } // built when the count changes, not every frame
      H.tag = shielded ? this.tagShield : this.weak > 0 ? 'נקודת התורפה חשופה!' : n ? 'מי האמיתי?' : this.tag ?? (this.vulnerable ? 'לסמן אותו!' : 'לחשוף את נקודת התורפה');
      g.hud.setBoss(H);
      this.barOn = true;
    } else if (this.barOn) { g.hud.setBoss(null); this.barOn = false; }
  }

  // everything it made put away; an Npc is left standing as it was, a bare model is freed
  dispose() {
    const g = this.game, P = g.paint;
    this.kit.foes.delete(this);
    if (this.tp) { this.kit.give('shimmer', this.tp.sh); this.tp = null; this.show(true); }
    this.fade(1);
    P.removeTarget(this.body); P.removeTarget(this.weakTarget);
    for (const s of this.shields) { if (s.beam) this.kit.give('beam', s.beam); if (s.target) P.removeTarget(s.target); if (s.catcher) this.kit.removeCatcher(s.catcher); }
    this.shields.length = 0;
    for (const c of this.copyList) { P.removeTarget(c.target); c.model.root.removeFromParent(); c.model.dispose(); }
    this.copyList.length = 0;
    if (this.bubble) { this.bubble.removeFromParent(); this.bubble.material.dispose(); this.bubble = null; }
    if (this.orb) { this.orb.removeFromParent(); this.orb.material.dispose(); this.orb = null; }
    if (this.barOn) { g.hud.setBoss(null); this.barOn = false; }
    if (this.own) { this.model.root.removeFromParent(); this.model.dispose(); }
  }
}
