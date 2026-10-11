import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const tD = new THREE.Vector3();

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const CAMERA_MODES = ['chase', 'pov', 'selfie'];

export class CameraRig {
  constructor(camera, city) {
    this.camera = camera;
    this.city = city;
    this.mode = 'chase';
    this.yaw = Math.PI;
    this.pitch = -0.2;
    this.offset = new THREE.Vector3(0, 2, 5);
    this.lookDir = new THREE.Vector3(0, 0, -1);
    this.roll = 0;
    this.prevYaw = 0;
    this.baseFov = 70;
    this.fov = 70;
    this.shake = 0;
    this.t = 0;
    this.portrait = false;
  }

  reset(P) {
    this.yaw = P.heading;
    this.pitch = -0.2;
    this.offset.copy(this.camera.position).sub(P.pos);
    this.lookDir.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    this.prevYaw = P.heading;
    this.roll = 0;
  }

  snap(P) {
    this.yaw = P.heading;
    this.pitch = -0.2;
    this.offset.set(-Math.sin(P.heading) * 5, 2.2, -Math.cos(P.heading) * 5);
    this.lookDir.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    this.prevYaw = P.heading;
  }

  kick(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  get forward() {
    return this.camera.getWorldDirection(tD);
  }

  _fov(dt, target) {
    this.fov += (target - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // Slow orbit in front of the hero on the menu screen. The aim point is shifted so the hero
  // lands in the empty part of the layout: lower half on phones, lower right on wide screens.
  updateTitle(dt, P) {
    this.t += dt;
    const a = P.heading + 0.35 + Math.sin(this.t * 0.12) * 0.45;
    const dist = this.portrait ? 5.2 : 4.4;
    const cam = this.camera.position.set(P.pos.x + Math.sin(a) * dist, P.pos.y + 0.75, P.pos.z + Math.cos(a) * dist);
    const right = tB.subVectors(P.pos, cam).cross(UP).normalize();
    const target = tA.copy(P.pos);
    target.y += this.portrait ? 0 : 0.55;
    if (!this.portrait) target.addScaledVector(right, -1.3);
    this.camera.up.copy(UP);
    this.camera.lookAt(target);
    this._fov(dt, this.portrait ? 64 : 50);
  }

  update(dt, P, hero) {
    this.t += dt;
    const v = P.vel;
    const speed = v.length();
    const cam = this.camera;
    this.shake *= Math.exp(-6 * dt);
    const shakeAmp = 0.05 * THREE.MathUtils.clamp((speed - 45) / 40, 0, 1) + this.shake * 0.35;

    if (this.mode === 'pov') {
      const head = hero.headWorld(tA);
      const want = speed > 4 ? tB.copy(v).divideScalar(speed) : tB.set(Math.sin(P.heading), 0, Math.cos(P.heading));
      const hl = Math.hypot(want.x, want.z) || 1e-3;
      const py = THREE.MathUtils.clamp(want.y, -0.8, 0.7);
      const hs = Math.sqrt(1 - py * py) / hl;
      want.set(want.x * hs, py, want.z * hs);
      this.lookDir.lerp(want, 1 - Math.exp(-4.5 * dt)).normalize();
      const yawNow = Math.atan2(this.lookDir.x, this.lookDir.z);
      let dy = yawNow - this.prevYaw;
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      this.prevYaw = yawNow;
      const rollT = THREE.MathUtils.clamp((-dy / Math.max(dt, 1e-3)) * 0.3, -0.55, 0.55);
      this.roll += (rollT - this.roll) * (1 - Math.exp(-3 * dt));
      const up = tC.copy(UP).applyAxisAngle(this.lookDir, this.roll);
      cam.position.copy(head).addScaledVector(this.lookDir, 0.12);
      cam.position.x += (Math.random() - 0.5) * shakeAmp * 0.4;
      cam.position.y += (Math.random() - 0.5) * shakeAmp * 0.4;
      cam.up.copy(up);
      cam.lookAt(cam.position.x + this.lookDir.x, cam.position.y + this.lookDir.y, cam.position.z + this.lookDir.z);
      this.yaw = yawNow;
      this._fov(dt, this.baseFov + 6 + THREE.MathUtils.clamp((speed - 18) * 0.4, 0, 26));
      return;
    }

    if (this.mode === 'selfie') {
      const head = hero.headWorld(tA);
      const q = hero.root.quaternion;
      const f = tB.set(0, 0, 1).applyQuaternion(q);
      const u = tC.set(0, 1, 0).applyQuaternion(q);
      const r = tD.set(-1, 0, 0).applyQuaternion(q);
      cam.position.copy(head).addScaledVector(f, 1.3).addScaledVector(u, 0.12).addScaledVector(r, 0.3);
      cam.up.copy(u).lerp(UP, 0.5).normalize();
      cam.lookAt(head.x + u.x * 0.04, head.y + u.y * 0.04, head.z + u.z * 0.04);
      this.yaw = Math.atan2(f.x, f.z);
      this._fov(dt, this.baseFov - 6);
      return;
    }

    // Chase camera.
    const vh = Math.hypot(v.x, v.z);
    let targetYaw = this.yaw;
    if (P.state === 'wall') targetYaw = P.heading;
    else if (vh > 2.5) targetYaw = Math.atan2(v.x, v.z);
    const follow = P.state === 'ground' ? 2.2 : 3.2;
    this.yaw = lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-follow * dt));
    const pitchT = THREE.MathUtils.clamp(-0.2 + v.y * 0.008, -0.8, 0.18);
    this.pitch += (pitchT - this.pitch) * (1 - Math.exp(-3 * dt));
    const dist = 4.8 + THREE.MathUtils.clamp((speed - 10) * 0.05, 0, 3.2);
    const cp = Math.cos(this.pitch);
    const dir = tA.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const desired = tB.copy(dir).multiplyScalar(-dist);
    desired.y += 1.1;
    this.offset.lerp(desired, 1 - Math.exp(-7 * dt));
    const target = tC.copy(P.pos);
    target.y += 0.75;
    cam.position.copy(target).add(this.offset);
    const hit = this.city.segmentHit(target, cam.position);
    if (hit < 1) cam.position.copy(target).addScaledVector(this.offset, Math.max(0.15, hit - 0.08));
    if (cam.position.y < 0.6) cam.position.y = 0.6;
    if (shakeAmp > 0.001) {
      cam.position.x += (Math.random() - 0.5) * shakeAmp;
      cam.position.y += (Math.random() - 0.5) * shakeAmp;
      cam.position.z += (Math.random() - 0.5) * shakeAmp;
    }
    cam.up.copy(UP);
    cam.lookAt(target.x + dir.x * 4, target.y + dir.y * 4, target.z + dir.z * 4);
    this.lookDir.copy(dir);
    this.prevYaw = this.yaw;
    this._fov(dt, this.baseFov + THREE.MathUtils.clamp((speed - 18) * 0.38, 0, 24));
  }
}
