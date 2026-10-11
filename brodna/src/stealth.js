import * as THREE from 'three';
import { clamp, smooth, angleDiff } from './util.js';

const RAYS = 26;

function bangSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ff3b3b';
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '900 96px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
}

// A watcher with a flashlight cone: patrols a route (or is moved by the script), fills a
// detection meter while it can see the player, and can chase.
export class Guard {
  constructor(S, person, opts = {}) {
    this.S = S;
    this.p = person;
    this.world = S.world;
    this.route = opts.route || null;
    this.range = opts.range || 8;
    this.fov = opts.fov || 0.6;
    this.speed = opts.speed || 1.5;
    this.active = !!this.route;
    this.meter = 0;
    this.spotted = false;
    this.mode = this.route ? 'patrol' : 'scripted';
    this.i = 0;
    this.waitT = 0;
    this.warnT = 0;
    this.lookT = 0;
    // cone on the ground
    const pos = new Float32Array((RAYS + 2) * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = [];
    for (let k = 1; k <= RAYS; k++) idx.push(0, k, k + 1);
    geo.setIndex(idx);
    this.coneMat = new THREE.MeshBasicMaterial({ color: opts.color || 0xfff1c9, transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 3;
    S.scene.add(this.cone);
    this.bang = bangSprite();
    this.bang.scale.set(0.55, 0.55, 0.55);
    this.bang.visible = false;
    S.scene.add(this.bang);
    if (opts.flashlight) {
      this.light = new THREE.SpotLight(0xfff0d0, 35, this.range * 1.4, this.fov, 0.45, 1.2);
      this.light.target.position.set(0, -0.3, 4);
      this.lightHolder = new THREE.Object3D();
      this.lightHolder.position.set(0.2, 1.35, 0.3);
      this.lightHolder.add(this.light, this.light.target);
      person.group.add(this.lightHolder);
    }
    this.start = person.pos.clone();
    this.startYaw = person.yaw;
    person.driven = this.mode === 'patrol';
  }

  dispose() {
    this.p.driven = false;
    this.S.scene.remove(this.cone, this.bang);
    if (this.lightHolder) this.p.group.remove(this.lightHolder);
    this.S.ui.danger(0);
    this.S.sfx.suspense(0);
  }

  reset() {
    this.meter = 0;
    this.spotted = false;
    this.mode = this.route ? 'patrol' : 'scripted';
    this.p.driven = this.mode === 'patrol';
    this.i = 0;
    this.waitT = 0;
    this.chaseTarget = null;
    if (this.route) {
      const r0 = this.route[0];
      this.p.place(r0.x, 0, r0.z, 0);
    }
    this.S.ui.danger(0);
  }

  warn(t) {
    this.warnT = t;
  }

  chase(target, speed = 4.2, from = null) {
    this.mode = 'chase';
    this.p.driven = true;
    this.chaseTarget = target;
    this.chaseSpeed = speed;
    this.active = true;
    this.spotted = false;
    this.meter = 0;
    if (from) this.p.place(from.x, 0, from.z, 0);
  }

  update(dt, player) {
    const p = this.p;
    const S = this.S;
    if (this.mode === 'patrol') this.patrol(dt);
    else if (this.mode === 'chase') {
      const t = this.chaseTarget;
      const path = S.level.chasePath;
      let tx = t.pos.x;
      let tz = t.pos.z;
      if (path && this.world.blocked(p.pos.x, p.pos.z, t.pos.x, t.pos.z, p.pos.y + 1.2)) {
        // head for the path node nearest to the target that we can see
        let best = null;
        let bd = Infinity;
        for (const n of path) {
          if (this.world.blocked(p.pos.x, p.pos.z, n.x, n.z, p.pos.y + 1.2)) continue;
          const d = Math.hypot(n.x - t.pos.x, n.z - t.pos.z);
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
        if (best) {
          tx = best.x;
          tz = best.z;
        }
      }
      const dx = tx - p.pos.x;
      const dz = tz - p.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      p.goal = null;
      p.vel.set((dx / d) * this.chaseSpeed, 0, (dz / d) * this.chaseSpeed);
      if (Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 1.0) this.spotted = true;
    }
    // vision
    let seeing = false;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    if (this.active && player.group.visible && this.mode !== 'chase') {
      const dx = player.pos.x - p.pos.x;
      const dz = player.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < this.range && d > 0.01) {
        const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
        if (ang < this.fov && !this.world.blocked(p.pos.x, p.pos.z, player.pos.x, player.pos.z, p.pos.y + 1.1)) seeing = true;
      }
      // about 0.7 s to get caught up close, over a second at the edge of the cone
      if (seeing) this.meter += dt * (0.8 + 1.6 * (1 - d / this.range));
      // running nearby is loud
      if (!seeing && d < 4.5 && player.speed > 4) {
        this.meter += dt * 0.6;
        if (this.mode === 'patrol') {
          p.faceTo(player.pos.x, player.pos.z);
          this.waitT = Math.max(this.waitT, 0.8);
        }
      }
    }
    if (!seeing) this.meter = Math.max(0, this.meter - dt * 0.55);
    if (this.meter >= 1) this.spotted = true;
    // ui feedback
    const danger = this.mode === 'chase' ? 0.35 : smooth(0.05, 1, this.meter);
    S.ui.danger(danger * 0.8);
    const near = clamp(1 - Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z) / 14, 0, 1);
    S.sfx.suspense(Math.max(near * 0.6, this.meter, this.mode === 'chase' ? 0.9 : 0));
    this.warnT -= dt;
    this.bang.visible = this.warnT > 0 || this.meter > 0.15;
    this.bang.position.set(p.pos.x, p.pos.y + 2.25 + Math.sin(S.g.clock.t * 8) * 0.03, p.pos.z);
    this.bang.material.opacity = this.warnT > 0 ? 1 : 0.4 + this.meter * 0.6;
    // cone geometry, clipped by walls
    const show = this.active && this.mode !== 'chase' && p.group.visible;
    this.cone.visible = show;
    if (this.light) this.light.visible = show || this.mode === 'chase';
    if (show) this.drawCone(fx, fz);
    this.coneMat.color.setRGB(1, 0.95 - this.meter * 0.7, 0.8 - this.meter * 0.75);
  }

  drawCone() {
    const p = this.p;
    const pos = this.cone.geometry.attributes.position;
    const y = p.pos.y + 0.06;
    pos.setXYZ(0, p.pos.x, y, p.pos.z);
    for (let k = 0; k <= RAYS; k++) {
      const a = p.yaw - this.fov + (2 * this.fov * k) / RAYS;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      let lo = 0;
      let hi = this.range;
      const ey = p.pos.y + 1.1;
      if (this.world.blocked(p.pos.x, p.pos.z, p.pos.x + dx * hi, p.pos.z + dz * hi, ey)) {
        for (let it = 0; it < 6; it++) {
          const mid = (lo + hi) / 2;
          if (this.world.blocked(p.pos.x, p.pos.z, p.pos.x + dx * mid, p.pos.z + dz * mid, ey)) hi = mid;
          else lo = mid;
        }
      }
      const gy = this.world.ground(p.pos.x + dx * hi, p.pos.z + dz * hi) + 0.06;
      pos.setXYZ(k + 1, p.pos.x + dx * hi, Math.max(y - 0.5, gy), p.pos.z + dz * hi);
    }
    pos.needsUpdate = true;
    this.cone.geometry.computeBoundingSphere();
  }

  patrol(dt) {
    const p = this.p;
    const wp = this.route[this.i];
    if (this.waitT > 0) {
      this.waitT -= dt;
      p.vel.set(0, 0, 0);
      p.goal = null;
      if (wp.look && this.waitT > 0) {
        this.lookT += dt;
        p.faceYaw = wp.look[Math.floor(this.lookT / 1.3) % wp.look.length];
      }
      if (this.waitT <= 0) this.i = (this.i + 1) % this.route.length;
      return;
    }
    const dx = wp.x - p.pos.x;
    const dz = wp.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      this.waitT = wp.wait || 0.01;
      this.lookT = 0;
      return;
    }
    p.goal = null;
    p.vel.set((dx / d) * this.speed, 0, (dz / d) * this.speed);
  }
}

// Laser trip wires (some blink) and pressure plates.
export class Traps {
  constructor(S, level) {
    this.S = S;
    this.group = new THREE.Group();
    S.scene.add(this.group);
    this.active = false;
    this.tripped = false;
    this.t = 0;
    this.lasers = (level.lasers || []).map((L) => {
      const a = new THREE.Vector3(L.a[0], L.y || 0.45, L.a[1]);
      const b = new THREE.Vector3(L.b[0], L.y || 0.45, L.b[1]);
      const len = a.distanceTo(b);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.15) }));
      beam.position.copy(a).add(b).multiplyScalar(0.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(beam.position);
      glow.quaternion.copy(beam.quaternion);
      for (const e of [a, b]) {
        const em = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x550000 }));
        em.position.copy(e);
        this.group.add(em);
      }
      this.group.add(beam, glow);
      return { ...L, a, b, beam, glow, on: true };
    });
    this.plates = (level.plates || []).map((pl) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pl.w, 0.05, pl.d), new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.4, emissive: 0x330000 }));
      m.position.set(pl.x, 0.025, pl.z);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pl.w, 0.06, pl.d)), new THREE.LineBasicMaterial({ color: 0xff4040 }));
      edge.position.copy(m.position);
      this.group.add(m, edge);
      return { ...pl, mesh: m };
    });
  }

  reset() {
    this.tripped = false;
  }

  hide() {
    this.group.visible = false;
  }

  update(dt, player) {
    this.t += dt;
    for (const L of this.lasers) {
      L.on = !L.period || Math.sin((this.t / L.period) * Math.PI * 2 + (L.phase || 0)) > -0.1;
      L.beam.visible = L.on;
      L.glow.material.opacity = L.on ? 0.25 + Math.sin(this.t * 30) * 0.05 : 0.04;
    }
    if (!this.active || this.tripped) return;
    const px = player.pos.x;
    const pz = player.pos.z;
    for (const L of this.lasers) {
      if (!L.on) continue;
      const ax = L.a.x;
      const az = L.a.z;
      const bx = L.b.x;
      const bz = L.b.z;
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
      if (Math.hypot(ax + dx * t - px, az + dz * t - pz) < 0.28) this.tripped = true;
    }
    for (const pl of this.plates) {
      if (Math.abs(px - pl.x) < pl.w / 2 - 0.05 && Math.abs(pz - pl.z) < pl.d / 2 - 0.05) {
        this.tripped = true;
        pl.mesh.position.y = 0.0;
      }
    }
    if (this.tripped) this.S.sfx.sting('alarm');
  }
}

export { angleDiff };
