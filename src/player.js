import * as THREE from 'three';
import { isWater, HALF, BAY_Z1 } from './city.js';

const G = 26;
const RUN = 15;
const MAX_SPEED = 92;
export const FOOT = 0.9; // pelvis to soles
const HEAD = 0.95;
const HW = 0.32;

export const anchorRise = (y) => THREE.MathUtils.clamp(26 - (y - 100) * 0.12, 14, 26);

const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _f = new THREE.Vector3();

// Point-mass hero: run on roofs, swing on an inextensible rope, climb walls.
export class Player {
  constructor(city) {
    this.city = city;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.state = 'ground'; // ground | air | swing | wall | dead
    this.anchor = new THREE.Vector3();
    this.ropeLen = 0;
    this.attachY = 0;
    this.riseAllow = 0;
    this.swingTime = 0;
    this.airTime = 0;
    this.side = 1;
    this.webCooldown = 0;
    this.boostCooldown = 0;
    this.boostTime = 9;
    this.landTime = 9;
    this.wallN = new THREE.Vector3();
    this.wallBox = null;
    this.wallTime = 0;
    this.wallContact = false;
    this.zipTarget = new THREE.Vector3();
    this.events = [];
  }

  spawn(x, y, z, heading) {
    this.pos.set(x, y + FOOT, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.state = 'ground';
    this.airTime = 0;
    this.webCooldown = 0;
    this.boostCooldown = 0;
    this.boostTime = 9;
    this.landTime = 9;
  }

  fwdH(out) {
    const vh = Math.hypot(this.vel.x, this.vel.z);
    if (vh > 3) return out.set(this.vel.x / vh, 0, this.vel.z / vh);
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  update(dt, input, camYaw, camFwd) {
    if (this.state === 'dead') return;
    this.webCooldown -= dt;
    this.boostCooldown -= dt;
    this.boostTime += dt;
    this.landTime += dt;

    if (input.webPressed) {
      if (this.state === 'ground') this._jump();
      else if (this.state === 'wall') this._wallJump();
      else if (this.state === 'air') this._attach(true);
    }
    if (input.webReleased && this.state === 'swing') this._release(true);
    if (input.web && this.state === 'air' && this.webCooldown <= 0 && this.airTime > 0.16) this._attach(false);
    if (input.boostPressed && this.boostCooldown <= 0) this._boost(camFwd);

    const steps = Math.min(12, Math.ceil(dt / 0.0085));
    const h = dt / steps;
    for (let i = 0; i < steps && this.state !== 'dead'; i++) this._step(h, input, camYaw);

    const vh = Math.hypot(this.vel.x, this.vel.z);
    if (this.state === 'wall') this.heading = Math.atan2(-this.wallN.x, -this.wallN.z);
    else if (vh > 1.5) this.heading = Math.atan2(this.vel.x, this.vel.z);
  }

  _jump() {
    const f = this.fwdH(_f);
    const vh = Math.hypot(this.vel.x, this.vel.z);
    this.vel.y = 22;
    if (vh < 8) {
      this.vel.x += f.x * 9;
      this.vel.z += f.z * 9;
    } else {
      this.vel.x *= 1.15;
      this.vel.z *= 1.15;
    }
    this.state = 'air';
    this.airTime = 0;
    this.events.push({ type: 'jump' });
  }

  _wallJump() {
    this.vel.set(this.wallN.x * 13, 17, this.wallN.z * 13);
    this.state = 'air';
    this.airTime = 0;
    this.events.push({ type: 'jump' });
  }

  _attach(explicit) {
    const f = this.fwdH(_f);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const a = this.city.findAnchor(this.pos, f, this.side, sp, anchorRise(this.pos.y));
    if (!a) {
      this.webCooldown = 0.3;
      if (explicit) this.events.push({ type: 'miss' });
      return false;
    }
    this.anchor.copy(a);
    // Near the street the rope is shortened so the arc clears the ground (a quick pull up).
    this.ropeLen = Math.min(this.pos.distanceTo(a) * 0.97, a.y - 2.5);
    this.attachY = this.pos.y;
    // Each swing may rise a little when low and must sink when high: holding the button settles at rooftop height.
    this.riseAllow = THREE.MathUtils.clamp(8 - (this.pos.y - 50) * 0.12, -10, 14);
    this.state = 'swing';
    this.swingTime = 0;
    this.side = -this.side;
    if (sp < 12) {
      this.vel.x += f.x * 7;
      this.vel.z += f.z * 7;
    }
    this.events.push({ type: 'web' });
    return true;
  }

  _release(manual) {
    this.state = 'air';
    this.airTime = 0.2;
    this.webCooldown = manual ? 0.12 : 0.28;
    if (manual) {
      const f = this.fwdH(_f);
      this.vel.y += 4 + Math.max(0, this.vel.y) * 0.12;
      this.vel.x += f.x * 4;
      this.vel.z += f.z * 4;
    }
    this.events.push({ type: 'release' });
  }

  _boost(camFwd) {
    const d = _t.copy(camFwd);
    d.y = Math.max(d.y, -0.2) + 0.22;
    d.normalize();
    this.vel.multiplyScalar(0.45).addScaledVector(d, 36);
    this.state = 'air';
    this.airTime = 0.2;
    this.boostCooldown = 1.3;
    this.boostTime = 0;
    this.zipTarget.copy(this.pos).addScaledVector(d, 32);
    this.events.push({ type: 'boost' });
  }

  _step(h, input, camYaw) {
    const p = this.pos;
    const v = this.vel;
    const sx = input.sx;
    const sy = input.sy;
    if (this.state === 'ground') {
      const mag = Math.min(1, Math.hypot(sx, sy));
      let tx = 0;
      let tz = 0;
      if (mag > 0.08) {
        const dx = Math.sin(camYaw) * sy - Math.cos(camYaw) * sx;
        const dz = Math.cos(camYaw) * sy + Math.sin(camYaw) * sx;
        const l = Math.hypot(dx, dz) || 1;
        tx = (dx / l) * RUN * mag;
        tz = (dz / l) * RUN * mag;
      }
      const k = 1 - Math.exp(-(mag > 0.08 ? 7 : 10) * h);
      v.x += (tx - v.x) * k;
      v.z += (tz - v.z) * k;
      v.y = -3;
    } else if (this.state === 'wall') {
      this.wallTime += h;
      v.set(-this.wallN.x * 2, 14, -this.wallN.z * 2);
      if (p.y - FOOT > this.wallBox.y1 - 0.3) {
        // Vault over the edge onto the roof.
        p.y = this.wallBox.y1 + FOOT + 0.05;
        this.state = 'air';
        this.airTime = 0;
        v.set(-this.wallN.x * 7, 6, -this.wallN.z * 7);
      } else if (this.wallTime > 2.6) {
        this.state = 'air';
        this.airTime = 0;
        v.set(this.wallN.x * 5, 0, this.wallN.z * 5);
      }
    } else {
      this.airTime += h;
      v.y -= G * h;
      // Steer by rotating the horizontal velocity, like banking.
      const turn = (this.state === 'swing' ? 1.3 : 1.8) * -sx * h;
      if (turn !== 0) {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const x = v.x * c + v.z * s;
        v.z = -v.x * s + v.z * c;
        v.x = x;
      }
      if (sy > 0.1) {
        const f = this.fwdH(_f);
        v.x += f.x * 6 * sy * h;
        v.z += f.z * 6 * sy * h;
      } else if (sy < -0.1 && this.state === 'air') {
        // Pull back to dive toward the street.
        v.y += 22 * sy * h;
      }
      if (this.state === 'swing') {
        this.swingTime += h;
        if (this.swingTime < 0.35) this.ropeLen = Math.max(8, this.ropeLen - 6 * h);
        _n.subVectors(p, this.anchor).normalize();
        if (p.y < this.anchor.y - 2) {
          // Pump energy along the arc so swings keep their rhythm.
          _t.copy(v).addScaledVector(_n, -v.dot(_n));
          const tl = _t.length();
          // Less pump high up, so the skyline is where swinging naturally settles.
          const pump = 9 * THREE.MathUtils.clamp(1 - (p.y - 90) / 90, 0.15, 1);
          if (tl > 0.5) v.addScaledVector(_t, (pump * h) / tl);
        }
        if (v.y > 0 && (p.y > this.anchor.y - 3.5 || (this.swingTime > 0.5 && p.y > this.attachY + this.riseAllow))) this._release(false);
        else if (this.swingTime > 4) this._release(false);
      }
      const sp = v.length();
      v.multiplyScalar(Math.max(0, 1 - 0.0034 * sp * h));
      if (sp > MAX_SPEED) v.multiplyScalar(MAX_SPEED / sp);
      // Soft world edge: lean back toward the city.
      const out = Math.max(Math.abs(p.x) - (HALF + 900), -p.z - (HALF + 900), p.z - (BAY_Z1 + 300));
      if (out > 0) {
        const l = Math.hypot(p.x, p.z) || 1;
        v.x -= (p.x / l) * 25 * h;
        v.z -= (p.z / l) * 25 * h;
      }
    }

    p.addScaledVector(v, h);

    if (this.state === 'swing') {
      _n.subVectors(p, this.anchor);
      const dist = _n.length();
      if (dist > this.ropeLen) {
        _n.divideScalar(dist);
        p.copy(this.anchor).addScaledVector(_n, this.ropeLen);
        const vr = v.dot(_n);
        if (vr > 0) v.addScaledVector(_n, -vr);
      }
    }
    this._collide();
  }

  _collide() {
    const p = this.pos;
    const v = this.vel;
    const vyBefore = v.y;
    let grounded = false;
    this.wallContact = false;
    const list = this.city.near(p.x, p.z, 2);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const minX = p.x - HW;
      const maxX = p.x + HW;
      const minY = p.y - FOOT;
      const maxY = p.y + HEAD;
      const minZ = p.z - HW;
      const maxZ = p.z + HW;
      if (maxX <= b.x0 || minX >= b.x1 || maxY <= b.y0 || minY >= b.y1 || maxZ <= b.z0 || minZ >= b.z1) continue;
      const up = b.y1 - minY;
      const down = maxY - b.y0;
      const px = b.x1 - minX;
      const nx = maxX - b.x0;
      const pz = b.z1 - minZ;
      const nz = maxZ - b.z0;
      if (up < 0.6 || (up < 1.4 && v.y <= 2)) {
        p.y += up;
        v.y = Math.max(v.y, 0);
        grounded = true;
        continue;
      }
      const m = Math.min(up, down, px, nx, pz, nz);
      if (m === up) {
        p.y += up;
        v.y = Math.max(0, v.y);
        grounded = true;
      } else if (m === down) {
        p.y -= down;
        if (v.y > 0) v.y = 0;
      } else {
        let wx = 0;
        let wz = 0;
        if (m === px) {
          p.x += px;
          wx = 1;
        } else if (m === nx) {
          p.x -= nx;
          wx = -1;
        } else if (m === pz) {
          p.z += pz;
          wz = 1;
        } else {
          p.z -= nz;
          wz = -1;
        }
        const into = -(v.x * wx + v.z * wz);
        if (into > 0) {
          v.x += wx * into;
          v.z += wz * into;
        }
        this._wallHit(b, wx, wz, into);
      }
    }

    if (p.y - FOOT < 0) {
      if (isWater(p.x, p.z)) {
        if (p.y - FOOT < -2.2) {
          this.state = 'dead';
          v.set(0, 0, 0);
          this.events.push({ type: 'splash', x: p.x, z: p.z });
          return;
        }
      } else {
        p.y = FOOT;
        v.y = Math.max(0, v.y);
        grounded = true;
      }
    }

    if (this.state === 'wall' && !this.wallContact) {
      this.state = 'air';
      this.airTime = 0;
      v.y = Math.max(v.y, 6);
    }
    if (grounded) {
      if (this.state !== 'ground') {
        this.events.push({ type: 'land', impact: -vyBefore });
        if (vyBefore < -28) this.landTime = 0;
        this.state = 'ground';
        this.airTime = 0;
      }
    } else if (this.state === 'ground') {
      this.state = 'air';
      this.airTime = 0.2;
    }
  }

  _wallHit(b, wx, wz, into) {
    if (this.state === 'wall') {
      this.wallContact = true;
      return;
    }
    if (into < 6 || b.y1 - (this.pos.y - FOOT) < 2.5) return;
    // Running or swinging into a facade turns into a climb.
    this.state = 'wall';
    this.wallBox = b;
    this.wallN.set(wx, 0, wz);
    this.wallTime = 0;
    this.wallContact = true;
    this.events.push({ type: 'wall' });
  }
}
