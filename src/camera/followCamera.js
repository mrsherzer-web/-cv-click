// Third-person orbit camera. Drag to look around; it pulls in when a wall or the ground is in the way,
// and drifts back behind the player after a while without touching the screen.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, dampAngle } from '../core/math.js';

export class FollowCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;           // camera sits at target + (sin yaw, ·, cos yaw) * distance
    this.pitch = CONFIG.camera.startPitch;
    this.dist = CONFIG.camera.distance;
    this.idle = 0;
    this.focus = new THREE.Vector3();
    this.override = null;   // { from, look, until } for short scripted shots
  }

  snapBehind(playerYaw) {
    this.yaw = playerYaw + Math.PI;
    this.pitch = CONFIG.camera.startPitch;
  }

  look(dx, dy) {
    const C = CONFIG.camera;
    if (dx || dy) this.idle = 0;
    this.yaw -= dx * C.lookSpeed;
    this.pitch = clamp(this.pitch + dy * C.lookSpeed, C.pitchMin, C.pitchMax);
  }

  // a fixed shot (cutscene); ends on its own after `seconds`
  shot(from, look, seconds) {
    this.override = { from: from.clone(), look: look.clone(), left: seconds };
  }

  update(dt, player) {
    const C = CONFIG.camera, cam = this.camera;
    this.focus.set(player.pos.x, player.visualY + C.targetHeight, player.pos.z);
    if (this.override) {
      this.override.left -= dt;
      cam.position.lerp(this.override.from, 1 - Math.exp(-4 * dt));
      cam.lookAt(this.override.look);
      if (this.override.left <= 0) this.override = null;
      return;
    }
    this.idle += dt;
    if (this.idle > C.autoCenterDelay && player.speed > 1) {
      this.yaw = dampAngle(this.yaw, player.yaw + Math.PI, C.autoCenterRate * Math.min(1, player.speed / 3), dt);
    }
    const cp = Math.cos(this.pitch), dirX = Math.sin(this.yaw) * cp, dirY = Math.sin(this.pitch), dirZ = Math.cos(this.yaw) * cp;
    // march toward the wanted position and stop short of walls and the ground;
    // with a wall right behind the player it comes all the way in, over the shoulder
    let free = C.distance;
    for (let d = 0.15; d <= C.distance; d += 0.2) {
      const x = this.focus.x + dirX * d, y = this.focus.y + dirY * d, z = this.focus.z + dirZ * d;
      if (y < this.world.groundHeight(x, z) + 0.25 || this.world.cols.blocks(x, y, z)) { free = Math.max(C.minDistance, d - 0.25); break; }
    }
    this.dist = free < this.dist ? damp(this.dist, free, 18, dt) : damp(this.dist, free, 3, dt);
    cam.position.set(this.focus.x + dirX * this.dist, this.focus.y + dirY * this.dist, this.focus.z + dirZ * this.dist);
    const ground = this.world.groundHeight(cam.position.x, cam.position.z) + 0.2;
    if (cam.position.y < ground) cam.position.y = ground;
    cam.lookAt(this.focus);
  }
}
