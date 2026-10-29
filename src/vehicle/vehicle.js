// Arcade car physics: throttle, brake and reverse, speed-sensitive steering with a grip limit, a
// handbrake that lets the rear slide, slopes, curbs and short drops, collisions that slow and damage the
// car, and the visual touches (body lean, wheel spin and steer, brake lights). Short frames are stepped.
import * as THREE from 'three';
import { clamp, damp, lerp, angleDiff } from '../core/math.js';
import { CollisionWorld } from '../world/colliders.js';

const WHEELBASE = 2.57, TRACK = 1.56, RADIUS = 0.92;
const PROBES = [1.22, 0, -1.22];         // collision circles along the car's length
const G = 9.8;

export class Vehicle {
  constructor(world, model, { maxSpeed = 30, accel = 7.2, name = 'car' } = {}) {
    this.world = world;
    this.model = model;
    this.name = name;
    this.maxSpeed = maxSpeed;
    this.accel = accel;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vy = 0;
    this.yaw = 0;
    this.speed = 0;        // along the heading, m/s (negative in reverse)
    this.slip = 0;         // angle between heading and travel (sliding), radians
    this.steer = 0;
    this.pitch = 0; this.roll = 0; this.lean = 0; this.dive = 0;
    this.health = 100;
    this.disabled = false;
    this.lastImpact = 0;   // impact speed of the latest crash, m/s
    this.impacts = 0;
    this.stuckTime = 0;
    this.braking = false;
    this.occupants = new Set();
    this.box = world.cols.addDynamicBox(this, 0.92, 2.08);
    this.tmp = { x: 0, z: 0, y: 0 };
  }

  place(x, z, yaw, y = null) {
    this.pos.x = x; this.pos.z = z;
    this.yaw = yaw;
    this.speed = this.slip = this.steer = this.vy = 0;
    this.pos.y = y ?? this.groundUnder();
    this.sync(0);
  }

  get forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }
  get kmh() { return Math.abs(this.speed) * 3.6; }

  // world position of a point given in the car's frame (x left, z forward)
  local(lx, lz) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return { x: this.pos.x + lx * c + lz * s, z: this.pos.z - lx * s + lz * c };
  }

  groundUnder() {
    let sum = 0;
    for (const [lx, lz] of [[TRACK / 2, WHEELBASE / 2], [-TRACK / 2, WHEELBASE / 2], [TRACK / 2, -WHEELBASE / 2], [-TRACK / 2, -WHEELBASE / 2]]) {
      const p = this.local(lx, lz);
      sum += this.world.groundHeight(p.x, p.z);
    }
    return sum / 4;
  }

  // input: { throttle 0..1, brake 0..1, steer -1 (left) .. 1 (right), handbrake }
  update(dt, input) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < steps; i++) this.step(dt / steps, input);
    this.sync(dt);
  }

  step(dt, input) {
    const W = this.world;
    const onRoad = W.net.surface(this.pos.x, this.pos.z) !== null;
    const top = this.maxSpeed * (onRoad ? 1 : 0.55) * (this.disabled ? 0 : 1);
    let { throttle = 0, brake = 0, steer = 0, handbrake = false } = input;
    if (this.disabled) throttle = 0;

    // steering: quick to turn, quicker to straighten, less lock at speed
    const lock = 0.62 / (1 + Math.abs(this.speed) / 9);
    const want = clamp(-steer, -1, 1) * lock;
    this.steer = damp(this.steer, want, Math.abs(want) > Math.abs(this.steer) ? 6 : 9, dt);

    // engine, brakes, reverse, rolling resistance, air drag, and gravity on slopes
    let a = 0;
    const v = this.speed;
    if (throttle > 0) a += v < -0.5 ? 14 * throttle : this.accel * throttle * Math.max(0, 1 - v / top);
    if (brake > 0) {
      if (v > 0.5) a -= 14 * brake;
      else a -= 6 * brake * Math.max(0, 1 + v / 5.5); // reverse, up to about 20 km/h
    }
    this.braking = brake > 0 && v > 0.5;
    a -= Math.sign(v) * (0.35 + 0.0018 * v * v + (onRoad ? 0 : 1.2));
    if (handbrake) a -= Math.sign(v) * 5;
    a -= G * Math.sin(this.pitch) * 0.85;
    const before = this.speed;
    this.speed += a * dt;
    if (!throttle && !brake && Math.sign(this.speed) !== Math.sign(before) && Math.abs(before) < 1.5) this.speed = 0; // come to rest
    if (v > top) this.speed = damp(this.speed, top, 2, dt);

    // turning: bicycle model, limited by grip; the handbrake lets the back step out
    const grip = (onRoad ? 9 : 6.5) * (handbrake ? 0.55 : 1);
    let yawRate = (this.speed * Math.tan(this.steer)) / WHEELBASE;
    const lateral = Math.abs(yawRate * this.speed);
    if (lateral > grip) yawRate *= grip / lateral;
    if (handbrake && Math.abs(this.speed) > 4) yawRate *= 1.45;
    this.yaw += yawRate * dt;
    // sliding: travel lags the heading in sharp turns and catches up with grip
    this.slip += -yawRate * dt * (handbrake ? 0.9 : 0.25);
    this.slip = damp(this.slip, 0, handbrake ? 1.2 : 6, dt);
    this.slip = clamp(this.slip, -0.9, 0.9);
    const dir = this.yaw + this.slip;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += Math.sin(dir) * this.speed * dt;
    this.pos.z += Math.cos(dir) * this.speed * dt;

    this.collide(dt);
    W.clampToPlayArea(this.pos);

    // vertical: follow the road down slopes and off curbs, fall off ledges
    const ground = this.groundUnder();
    this.vy -= G * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= ground) {
      if (this.vy < -6) this.hurt((-this.vy - 6) * 2.2);
      this.pos.y = ground;
      this.vy = 0;
    } else if (this.pos.y - ground < 0.25 && this.vy < 0.5) {
      this.pos.y = damp(this.pos.y, ground, 25, dt); // small dips: stay planted
      if (this.pos.y - ground < 0.02) this.vy = 0;
    }
    if (!Number.isFinite(this.pos.x) || this.pos.y < ground - 6) this.reset();

    // stuck: pushing against something without moving
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
    this.stuckTime = (throttle > 0.5 || brake > 0.5) && moved < 0.4 ? this.stuckTime + dt : 0;

    // body motion for the eye: lean out of turns, nose dips under braking
    this.lean = damp(this.lean, clamp(yawRate * this.speed * 0.012, -0.08, 0.08), 6, dt);
    this.dive = damp(this.dive, clamp(-a * 0.005, -0.05, 0.05), 6, dt);
  }

  collide() {
    const W = this.world, cols = W.cols, p = this.tmp;
    for (let pass = 0; pass < 2; pass++) {
      let bx = 0, bz = 0, best = 0;
      for (const lz of PROBES) {
        const c = this.local(0, lz);
        p.x = c.x; p.z = c.z;
        if (cols.resolve(p, RADIUS, this.pos.y + 0.3, this)) {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
          if (d > best) { best = d; bx = dx; bz = dz; }
        }
      }
      if (best < 1e-4) return;
      this.pos.x += bx; this.pos.z += bz;
      // lose the speed going into the wall, keep the part along it
      const nx = bx / best, nz = bz / best, dir = this.yaw + this.slip;
      const vx = Math.sin(dir) * this.speed, vz = Math.cos(dir) * this.speed;
      const into = -(vx * nx + vz * nz);
      if (into > 0) {
        const tx = vx + nx * into * 1.15, tz = vz + nz * into * 1.15; // a little bounce
        const along = tx * Math.sin(this.yaw) + tz * Math.cos(this.yaw);
        this.speed = along * 0.92;
        if (into > 3) { this.lastImpact = into; this.impacts++; this.hurt((into - 3) * 3.2); }
      }
    }
  }

  hurt(amount) {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.disabled = true;
  }

  repair() { this.health = 100; this.disabled = false; }

  // put the car back on the nearest road, facing along it
  reset() {
    const s = this.world.roadSpot(this.pos.x, this.pos.z);
    if (s) this.place(s.x, s.z, s.yaw, s.h + 0.02);
    this.stuckTime = 0;
  }

  // a free spot to stand next to the car for getting out: driver's door, the other door, behind, in front
  exitSpot() {
    const W = this.world;
    for (const [lx, lz] of [[1.45, 0.25], [-1.45, 0.25], [0, -3], [0, 3], [2.4, -1.5], [-2.4, -1.5]]) {
      const q = this.local(lx, lz), y = W.groundHeight(q.x, q.z), probe = { x: q.x, z: q.z, y };
      if (Math.abs(y - this.pos.y) > 1.2) continue;
      if (W.cols.resolve(probe, 0.36, y, null)) continue; // something is there
      return { x: q.x, z: q.z, yaw: this.yaw };
    }
    const q = this.local(0, 0);
    return { x: q.x, z: q.z, yaw: this.yaw, onRoof: true };
  }

  // distance from a point to the nearest door
  doorDistance(x, z) {
    const a = this.local(1.2, 0.25), b = this.local(-1.2, 0.25);
    return Math.min(Math.hypot(x - a.x, z - a.z), Math.hypot(x - b.x, z - b.z));
  }

  sync(dt) {
    const m = this.model, d = m.userData;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);
    // tilt with the ground under the wheels
    if (dt > 0) {
      const f = this.local(0, WHEELBASE / 2), r = this.local(0, -WHEELBASE / 2), l = this.local(TRACK / 2, 0), rr = this.local(-TRACK / 2, 0);
      const W = this.world;
      const pitch = Math.atan2(W.groundHeight(f.x, f.z) - W.groundHeight(r.x, r.z), WHEELBASE);
      const roll = Math.atan2(W.groundHeight(l.x, l.z) - W.groundHeight(rr.x, rr.z), TRACK);
      this.pitch = damp(this.pitch, pitch, 12, dt);
      this.roll = damp(this.roll, roll, 12, dt);
    }
    m.rotation.set(-this.pitch + this.dive, this.yaw, this.roll + this.lean, 'YXZ');
    for (const w of d.wheels) {
      w.spin.rotation.x += (this.speed * dt) / 0.31;
      if (w.front) w.pivot.rotation.y = this.steer;
    }
    d.tailMat.emissive.setRGB(this.braking ? 0.9 : 0.23, this.braking ? 0.05 : 0.02, this.braking ? 0.05 : 0.02);
    CollisionWorld.setBox(this.box, this.pos.x, this.pos.z, this.yaw, this.pos.y - 0.5, this.pos.y + 1.5);
  }
}
