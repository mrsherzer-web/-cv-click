// Chase camera for driving: behind and above the car, looking a little ahead, swinging with the turns.
// Drag to look around; it swings back behind the car on its own. Pulls in rather than entering walls.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/math.js';

const DIST = 6.3, HEIGHT = 2.1, LOOK_UP = 1.25, AHEAD = 2.4;

export class CarCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;          // direction the camera looks along (the car's heading, smoothed)
    this.offYaw = 0;       // the player's own look-around, eased back to zero
    this.pitch = 0.18;
    this.dist = DIST;
    this.idle = 0;
    this.focus = new THREE.Vector3();
  }

  snap(car) {
    this.yaw = car.yaw;
    this.offYaw = 0;
    this.dist = DIST;
  }

  look(dx, dy) {
    if (dx || dy) this.idle = 0;
    this.offYaw -= dx * 0.006;
    this.pitch = clamp(this.pitch + dy * 0.004, 0.02, 0.9);
  }

  update(dt, car) {
    const cam = this.camera;
    this.idle += dt;
    // follow the direction of travel; when reversing keep looking forward
    const travel = car.speed > 1 ? car.yaw + car.slip * 0.6 : car.yaw;
    this.yaw = dampAngle(this.yaw, travel, 3.2, dt);
    if (this.idle > 1.4) {
      this.offYaw = damp(this.offYaw, 0, 2.2, dt);
      this.pitch = damp(this.pitch, 0.18, 1.5, dt);
    }
    const yaw = this.yaw + this.offYaw;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.focus.set(car.pos.x + fx * AHEAD * 0.4, car.pos.y + LOOK_UP, car.pos.z + fz * AHEAD * 0.4);
    const want = DIST + Math.min(2.2, Math.abs(car.speed) * 0.07);
    const cp = Math.cos(this.pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(this.pitch) + (HEIGHT - LOOK_UP) / DIST, dz = -Math.cos(yaw) * cp;
    // march out from the car and stop before anything solid (the car itself does not count)
    let free = want;
    for (let d = 1.2; d <= want; d += 0.35) {
      const x = this.focus.x + dx * d, y = this.focus.y + dy * d, z = this.focus.z + dz * d;
      if (y < this.world.groundHeight(x, z) + 0.3 || this.world.cols.blocks(x, y, z, car)) { free = Math.max(2.2, d - 0.4); break; }
    }
    this.dist = free < this.dist ? damp(this.dist, free, 14, dt) : damp(this.dist, free, 2.5, dt);
    cam.position.set(this.focus.x + dx * this.dist, this.focus.y + dy * this.dist, this.focus.z + dz * this.dist);
    const g = this.world.groundHeight(cam.position.x, cam.position.z) + 0.25;
    if (cam.position.y < g) cam.position.y = g;
    cam.lookAt(this.focus.x + fx * AHEAD, this.focus.y - 0.1, this.focus.z + fz * AHEAD);
  }
}
