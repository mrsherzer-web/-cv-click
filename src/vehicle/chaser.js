// Rival cars chasing the Renault (the Sharks, a crew invented for the game; never police). Same arcade
// physics as Nehorai's car, steered at a point a little ahead of him, with a lower top speed so a good
// driver gets away. Bumping is part of it: both cars take dents. A chaser that is stuck, wrecked or far
// behind and out of sight drops out or comes back from a road behind him. Losing them all for a few
// seconds ends the chase.
import { Vehicle } from './vehicle.js';
import { makeHatchback } from '../world/car.js';
import { angleDiff, clamp } from '../core/math.js';

const COLORS = ['#2b6a8f', '#1d3b52', '#7fb3cf'];

class Chaser {
  constructor(game, k) {
    this.game = game;
    this.car = new Vehicle(game.world, makeHatchback({ color: COLORS[k % COLORS.length] }), { maxSpeed: 24, accel: 7.6, name: `chaser-${k}` });
    game.scene.add(this.car.model); // driven here, not left to coast with the parked cars
    this.stuck = 0;
    this.out = false;   // wrecked: out of the chase
  }

  // a spot on a road this far behind Nehorai, facing toward him
  respawn(behind = 140) {
    const g = this.game, me = g.car, back = { x: me.pos.x - Math.sin(me.yaw) * behind, z: me.pos.z - Math.cos(me.yaw) * behind };
    const s = g.world.roadSpot(back.x, back.z);
    if (!s) return false;
    this.car.place(s.x, s.z, Math.atan2(me.pos.x - s.x, me.pos.z - s.z), s.h + 0.05);
    this.car.repair();
    this.stuck = 0;
    return true;
  }

  drive(dt) {
    const me = this.game.car, c = this.car;
    if (c.disabled) { this.out = true; c.update(dt, { throttle: 0, brake: 1, steer: 0 }); return; }
    // aim where the Renault is going to be
    const lead = clamp(Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z) / 25, 0.2, 1.4);
    const tx = me.pos.x + Math.sin(me.yaw) * me.speed * lead, tz = me.pos.z + Math.cos(me.yaw) * me.speed * lead;
    const err = angleDiff(c.yaw, Math.atan2(tx - c.pos.x, tz - c.pos.z));
    const sharp = Math.abs(err) > 0.7;
    c.update(dt, {
      steer: clamp(-err * 2.2, -1, 1),
      throttle: sharp && c.speed > 9 ? 0.2 : 1,
      brake: sharp && c.speed > 12 ? 0.6 : 0,
      handbrake: Math.abs(err) > 1.4 && c.speed > 8,
    });
    this.stuck = c.stuckTime > 0 || (Math.abs(c.speed) < 1.5 && Math.abs(err) > 1) ? this.stuck + dt : 0;
  }
}

export class Chase {
  constructor(game, { cars = 2, after = 0 } = {}) {
    this.game = game;
    this.chasers = [];
    for (let k = 0; k < cars; k++) this.chasers.push(new Chaser(game, k));
    this.chasers.forEach((ch, k) => ch.respawn(after + 90 + k * 25));
    this.lostFor = 0;
    this.time = 0;
    this.over = false;
    this.escaped = false;
    game.alert.chasing = true;
    game.alert.raise(40);
  }

  // how far the nearest chaser still in it is
  get nearest() {
    const me = this.game.car;
    let d = Infinity;
    for (const ch of this.chasers) if (!ch.out) d = Math.min(d, Math.hypot(ch.car.pos.x - me.pos.x, ch.car.pos.z - me.pos.z));
    return d;
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    const g = this.game, cam = g.camera.position;
    for (const ch of this.chasers) {
      ch.drive(dt);
      const d = Math.hypot(ch.car.pos.x - g.car.pos.x, ch.car.pos.z - g.car.pos.z);
      const unseen = Math.hypot(ch.car.pos.x - cam.x, ch.car.pos.z - cam.z) > 120;
      // stuck behind something, out of sight: back on a road behind Nehorai (but only while he is close)
      if (!ch.out && ch.stuck > 4 && unseen && d < 260) ch.respawn(150);
    }
    const near = this.nearest;
    g.alert.raise(near < 90 ? dt * 6 : 0);
    // far from all of them for a while: lost them
    this.lostFor = near > 230 ? this.lostFor + dt : 0;
    if (this.lostFor > 5) this.end(true);
  }

  end(escaped) {
    this.over = true;
    this.escaped = escaped;
    this.game.alert.chasing = false;
    if (escaped) this.game.alert.level = Math.min(this.game.alert.level, 45);
  }

  dispose() {
    const g = this.game;
    for (const ch of this.chasers) {
      g.scene.remove(ch.car.model);
      g.world.cols.dynamic.delete(ch.car.box);
    }
    this.chasers = [];
    if (!this.over) g.alert.chasing = false;
  }
}
