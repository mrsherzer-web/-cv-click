import * as THREE from 'three';
import { damp, dampAngle, clamp } from './util.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Follow camera you can drag, car chase cam, and scripted cinematic shots.
export class CamRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'follow';
    this.yaw = 0;
    this.pitch = 0.32;
    this.style = { dist: 4.3, height: 1.55, look: 1.35, minPitch: 0.05, maxPitch: 1.1 };
    this.lastDrag = -10;
    this.t = 0;
    this.pos = new THREE.Vector3(0, 3, -5);
    this.look = new THREE.Vector3();
    this.shotFrom = null;
    this.shotTo = null;
    this.fov = 60;
    this.baseFov = 60;
  }

  setStyle(s) {
    this.style = { dist: 4.3, height: 1.55, look: 1.35, minPitch: 0.05, maxPitch: 1.1, collide: true, ...s };
    this.pitch = clamp(this.pitch, this.style.minPitch, this.style.maxPitch);
  }

  snapBehind(target) {
    this.yaw = target.yaw;
    this.mode = 'follow';
    this._placeFollow(target, 1, null, true);
  }

  // Cinematic move to (pos, look) over `dur` seconds; resolves when it arrives.
  shot(pos, look, dur = 1.2, fov = null) {
    this.mode = 'shot';
    this.shotFov = fov;
    this.shotFrom = { pos: this.camera.position.clone(), look: this.look.clone() };
    this.shotTo = { pos: pos.clone(), look: look.clone() };
    this.shotT = 0;
    this.shotDur = Math.max(0.001, dur);
    return new Promise((res) => (this.shotDone = res));
  }

  // Over-the-shoulder close-up on a speaker's scanned face.
  closeup(person, toward = null, { dist = 1.35, side = 0.32, dur = 0.7 } = {}) {
    const head = person.headWorld(_a).clone();
    head.y -= 0.03;
    let dir;
    if (toward) dir = _b.set(toward.x - head.x, 0, toward.z - head.z).normalize();
    else dir = person.forward(_b);
    const right = _c.set(dir.z, 0, -dir.x);
    const pos = head.clone().addScaledVector(dir, dist).addScaledVector(right, side);
    pos.y += 0.06;
    // a longer lens for dialogue: the scanned face fills the frame (wider on portrait screens)
    return this.shot(pos, head, dur, this.baseFov > 60 ? 40 : 32);
  }

  follow() {
    this.mode = 'follow';
  }

  update(dt, { target, car, input, world }) {
    this.t += dt;
    const cam = this.camera;
    if (this.mode === 'free') return;
    if (this.mode === 'shot') {
      this.shotT = Math.min(1, this.shotT + dt / this.shotDur);
      const k = ease(this.shotT);
      cam.position.lerpVectors(this.shotFrom.pos, this.shotTo.pos, k);
      this.look.lerpVectors(this.shotFrom.look, this.shotTo.look, k);
      cam.lookAt(this.look);
      if (this.shotT >= 1 && this.shotDone) {
        const d = this.shotDone;
        this.shotDone = null;
        d();
      }
      this._fov(dt, this.shotFov || this.baseFov, this.shotFov ? 6 : 4);
      return;
    }
    if (input && (input.lookDX || input.lookDY)) {
      this.yaw -= input.lookDX * 0.006;
      this.pitch = clamp(this.pitch + input.lookDY * 0.004, this.style.minPitch, this.style.maxPitch);
      this.lastDrag = this.t;
    }
    if (this.mode === 'car' && car) {
      const want = car.yaw + (car.speed < -0.5 ? Math.PI : 0);
      if (this.t - this.lastDrag > 1.2) this.yaw = dampAngle(this.yaw, want, 3, dt);
      const dist = 6.8 + Math.min(2.5, Math.abs(car.speed) * 0.08);
      _a.set(-Math.sin(this.yaw) * dist, 2.6, -Math.cos(this.yaw) * dist).add(car.pos);
      _a.y = Math.max(_a.y, world ? world.ground(_a.x, _a.z) + 1.2 : _a.y);
      // far away (new level, teleport): cut instead of flying through the terrain
      if (cam.position.distanceTo(_a) > 25) cam.position.copy(_a);
      else cam.position.lerp(_a, 1 - Math.exp(-8 * dt));
      this.look.set(car.pos.x + Math.sin(car.yaw) * 3, car.pos.y + 1.2, car.pos.z + Math.cos(car.yaw) * 3);
      cam.lookAt(this.look);
      this._fov(dt, this.baseFov + Math.min(14, Math.abs(car.speed) * 0.5));
      return;
    }
    if (target) {
      const moving = target.speed > 0.6;
      if (moving && this.t - this.lastDrag > 1.6) this.yaw = dampAngle(this.yaw, target.yaw, 1.6, dt);
      this._placeFollow(target, dt, world);
      this._fov(dt, this.baseFov + (target.speed > 4 ? 6 : 0));
    }
  }

  _placeFollow(target, dt, world, snap = false) {
    const s = this.style;
    const cam = this.camera;
    const cp = Math.cos(this.pitch);
    const focus = _a.set(target.pos.x, target.pos.y + s.look, target.pos.z);
    const want = _b.set(-Math.sin(this.yaw) * cp * s.dist, Math.sin(this.pitch) * s.dist + (s.height - s.look), -Math.cos(this.yaw) * cp * s.dist).add(focus);
    if (world && s.collide !== false) {
      const t = world.hit(focus, want);
      if (t < 1) want.lerpVectors(focus, want, Math.max(0.15, t - 0.05));
      const g = world.ground(want.x, want.z) + 0.4;
      if (want.y < g) want.y = g;
    }
    if (snap || cam.position.distanceTo(want) > 25) cam.position.copy(want);
    else cam.position.lerp(want, 1 - Math.exp(-10 * dt));
    this.look.copy(focus);
    cam.lookAt(this.look);
  }

  _fov(dt, f, k = 4) {
    this.fov = damp(this.fov, f, k, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
