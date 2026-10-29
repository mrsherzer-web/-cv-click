// On-foot movement: camera-relative joystick input, acceleration, collisions with the world,
// feet snapped to the ground, and a safety net that returns the player to the last safe spot.
import { CONFIG } from '../config.js';
import { damp, dampAngle } from '../core/math.js';

export class PlayerController {
  constructor(world, model) {
    this.world = world;
    this.model = model;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.yaw = 0;
    this.speed = 0;
    this.running = false;
    this.visualY = 0;
    this.safe = { x: 0, z: 0, yaw: 0 };
    this.safeTimer = 0;
    this.respawns = 0;
  }

  place(x, z, yaw) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = this.visualY = this.world.groundHeight(x, z);
    this.vel.x = this.vel.z = 0;
    this.yaw = yaw;
    this.safe = { x, z, yaw };
    this.sync();
  }

  // move: { x: right, y: forward } in -1..1; camYaw: camera yaw (see FollowCamera); faceYaw: keep
  // facing this way while moving (squared up to an opponent) instead of turning toward the movement.
  // Long frames are split into short steps so fast movement never skips through a thin wall.
  update(dt, move, run, camYaw, faceYaw = null) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    let dist = 0;
    for (let i = 0; i < steps; i++) {
      if (!this.step(dt / steps, move, run, camYaw, faceYaw)) return;
      dist += this.speed * (dt / steps);
    }
    this.speed = dt > 0 ? dist / dt : 0;
  }

  step(dt, move, run, camYaw, faceYaw) {
    const P = CONFIG.player;
    const mag = Math.min(1, Math.hypot(move.x, move.y));
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // camera forward on the ground
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);    // camera right
    let dx = fx * move.y + rx * move.x, dz = fz * move.y + rz * move.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-5) { dx /= dl; dz /= dl; }
    this.running = run && mag > 0.2;
    const target = mag < 0.08 ? 0 : (this.running ? P.runSpeed : P.walkSpeed * Math.max(0.45, mag));
    this.vel.x = damp(this.vel.x, dx * target, P.accel, dt);
    this.vel.z = damp(this.vel.z, dz * target, P.accel, dt);

    const p = this.pos;
    const ox = p.x, oz = p.z;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    this.world.cols.resolve(p, P.radius);
    this.world.clampToPlayArea(p);
    // speed actually achieved, after walls stopped us
    this.speed = dt > 0 ? Math.hypot(p.x - ox, p.z - oz) / dt : 0;
    if (faceYaw !== null) this.yaw = dampAngle(this.yaw, faceYaw, P.turnRate, dt);
    else if (target > 0 && dl > 1e-5) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), P.turnRate, dt);

    const g = this.world.groundHeight(p.x, p.z);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(g) || p.y < g - CONFIG.world.fallLimit) {
      this.respawn();
      return false;
    }
    p.y = g;
    this.visualY = Math.abs(this.visualY - g) > 0.6 ? g : damp(this.visualY, g, 22, dt); // smooth curb steps
    this.safeTimer += dt;
    if (this.safeTimer > 0.5) { this.safeTimer = 0; this.safe = { x: p.x, z: p.z, yaw: this.yaw }; }
    this.sync();
    return true;
  }

  // a shove or a quick step that is not walking (knocked back, dodging): walls still stop it
  push(dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
    this.world.cols.resolve(this.pos, CONFIG.player.radius);
    this.world.clampToPlayArea(this.pos);
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z);
    this.sync();
  }

  respawn() {
    this.respawns++;
    this.place(this.safe.x, this.safe.z, this.safe.yaw);
  }

  sync() {
    this.model.root.position.set(this.pos.x, this.visualY, this.pos.z);
    this.model.root.rotation.y = this.yaw;
  }
}
