// A person in the world who is not the player: friends, rivals, passers-by. Walks to a point (around
// walls), turns to face someone, holds a pose, rides in a car (hidden inside) and steps out again.
import { makeCharacter } from '../characters/builder.js';
import { damp, dampAngle } from '../core/math.js';
import { CollisionWorld } from '../world/colliders.js';

const WALK = 1.7, RUN = 4.6;

export class Npc {
  constructor(game, spec, { detail = 'high' } = {}) {
    this.game = game;
    this.spec = spec;
    this.id = spec.id;
    this.model = makeCharacter(spec, { detail });
    game.scene.add(this.model.root);
    this.pos = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.speed = 0;
    this.target = null;       // { x, z, run, onArrive, near }
    this.face = null;         // { x, z } to turn toward when standing
    this.inCar = null;
    this.stuck = 0;
    this.visible = true;
    this.idle = null;         // what they do while standing: 'bag', 'arms', 'mirror', 'phone', 'cheer'
    this.idleWait = 0;
    this.flip = false;
    this.onPunch = null;      // called when a 'bag' punch lands
    this.body = game.world.cols.addDynamicCircle(this, 0.3);
  }

  place(x, z, yaw = this.yaw) {
    this.pos.x = this.lastX = x; this.pos.z = this.lastZ = z;
    this.pos.y = this.game.world.groundHeight(x, z);
    this.yaw = yaw;
    this.target = null;
    this.sync();
  }

  show(on) { this.visible = on; this.model.root.visible = on; this.body.enabled = on && !this.inCar; }

  // walk (or run) to a point; onArrive fires once there (within `near` meters)
  walkTo(x, z, { run = false, near = 0.6, onArrive = null } = {}) {
    this.target = { x, z, run, near, onArrive };
    this.stuck = 0;
  }

  lookAt(x, z) { this.face = { x, z }; }

  // get into a car: hidden inside until stepOut()
  enter(car) {
    this.inCar = car;
    this.target = null;
    car.occupants.add(this.id);
    this.show(false);
    this.body.enabled = false;
  }

  stepOut(side = -1) {
    const car = this.inCar;
    if (!car) return;
    car.occupants.delete(this.id);
    this.inCar = null;
    const q = car.local(side * 1.5, 0.2);
    this.place(q.x, q.z, car.yaw);
    this.show(true);
  }

  update(dt) {
    if (this.inCar) {
      this.pos.x = this.inCar.pos.x; this.pos.y = this.inCar.pos.y; this.pos.z = this.inCar.pos.z;
      return;
    }
    const W = this.game.world;
    if (this.target) {
      const t = this.target, dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d <= t.near) {
        this.target = null;
        t.onArrive?.();
      } else {
        const v = t.run ? RUN : WALK, step = Math.min(d, v * dt);
        const ox = this.pos.x, oz = this.pos.z;
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        this.pos.y = W.groundHeight(this.pos.x, this.pos.z);
        W.cols.resolve(this.pos, 0.33, this.pos.y, this);
        const made = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
        // blocked by a wall: sidestep along it for a moment
        this.stuck = made < v * 0.3 ? this.stuck + dt : 0;
        if (this.stuck > 0.6) {
          const side = Math.sin(this.game.time * 0.7) > 0 ? 1 : -1;
          this.pos.x += (-dz / d) * side * v * dt;
          this.pos.z += (dx / d) * side * v * dt;
          W.cols.resolve(this.pos, 0.33, this.pos.y, this);
        }
      }
    } else if (this.face) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.face.x - this.pos.x, this.face.z - this.pos.z), 5, dt);
    }
    this.behave(dt);
    // legs follow how far the body actually went, whoever moved it (walking, a fight, a shove)
    const moved = Math.hypot(this.pos.x - (this.lastX ?? this.pos.x), this.pos.z - (this.lastZ ?? this.pos.z)) / Math.max(dt, 1e-4);
    this.lastX = this.pos.x; this.lastZ = this.pos.z;
    this.speed = damp(this.speed, Math.min(moved, RUN), 10, dt);
    this.pos.y = W.groundHeight(this.pos.x, this.pos.z);
    this.model.animate(dt, this.speed, 6.2);
    this.sync();
  }

  // standing habits: punching a bag, arms crossed, checking the mirror, on the phone
  behave(dt) {
    const M = this.model;
    if (!this.idle || this.target) {
      if (this.posed) { M.setPose(null); this.posed = false; }
      return;
    }
    this.posed = true;
    this.idleWait -= dt;
    switch (this.idle) {
      case 'bag':
        M.setPose('guard');
        if (!M.action && this.idleWait <= 0) {
          this.flip = !this.flip;
          M.play(this.flip ? 'jab' : 'cross', { onHit: () => this.onPunch?.(this.flip ? 0.7 : 1) });
          this.idleWait = 0.3 + Math.random() * 0.7;
        }
        break;
      case 'arms': M.setPose('arms_crossed'); break;
      case 'phone': M.setPose('phone'); break;
      case 'cheer': // watching a bout: arms up now and then
        if (this.idleWait <= 0) { this.cheering = !this.cheering; this.idleWait = this.cheering ? 0.7 + Math.random() * 0.9 : 1.2 + Math.random() * 2.6; }
        M.setPose(this.cheering ? 'cheer' : null);
        break;
      case 'mirror':
        M.setPose(null);
        if (!M.action && this.idleWait <= 0) { M.play(Math.random() < 0.5 ? 'nod' : 'shrug'); this.idleWait = 2.5 + Math.random() * 3; }
        break;
      default: break;
    }
  }

  sync() {
    this.model.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.model.root.rotation.y = this.yaw;
    CollisionWorld.setCircle(this.body, this.pos.x, this.pos.z, this.pos.y - 0.2, this.pos.y + 1.8);
  }

  dispose() {
    this.game.world.cols.dynamic.delete(this.body);
    this.game.scene.remove(this.model.root);
    this.model.dispose();
  }
}
