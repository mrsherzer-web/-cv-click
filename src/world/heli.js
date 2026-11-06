// Kotzi's helicopters (chapter eight): a body, a tail, two rotors that spin, skids, and a cone of
// light searching the ground. They circle a point or hang ahead of the Renault; they are part of the
// sky, never something that hits the player. Invented, like everything else here.
import * as THREE from 'three';
import { damp, dampAngle } from '../core/math.js';

export class Heli {
  constructor(game, { color = '#1c1f26', light = true } = {}) {
    this.game = game;
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: '#8fb3cf', roughness: 0.2, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 3.6), dark); body.position.set(0, 0, 0.3); g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.2), glass); nose.position.set(0, 0.1, 2.5); g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4.2), dark); tail.position.set(0, 0.3, -3.3); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.8), dark); fin.position.set(0, 0.9, -5.2); g.add(fin);
    for (const sx of [-0.8, 0.8]) { const skid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.2), dark); skid.position.set(sx, -0.95, 0.4); g.add(skid); for (const sz of [-0.8, 1.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), dark); leg.position.set(sx, -0.7, sz); g.add(leg); } }
    this.rotor = new THREE.Group(); this.rotor.position.set(0, 0.85, 0.3);
    for (const a of [0, Math.PI / 2]) { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 8.4), dark); blade.rotation.y = a; this.rotor.add(blade); }
    g.add(this.rotor);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.16), dark); this.tailRotor.position.set(0.3, 0.6, -5.2); g.add(this.tailRotor);
    this.beam = null;
    if (light) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 30, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.set(0, -15.6, 0.8); g.add(cone); this.beam = cone;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4' })); lamp.position.set(0, -0.7, 0.8); g.add(lamp);
    }
    this.root = g;
    game.scene.add(g);
    this.mode = null;
    this.t = Math.random() * 10;
    this.pos = new THREE.Vector3(0, 40, 0);
    this.yaw = 0;
    this.tilt = 0;
  }

  // circle a point at a height
  orbit(x, z, { r = 60, h = 32, speed = 0.22, phase = 0 } = {}) { this.mode = { kind: 'orbit', x, z, r, h, speed, phase }; return this; }
  // hang ahead of a moving thing (the Renault), weaving a little
  shadow(target, { ahead = 36, h = 26, side = 18 } = {}) { this.mode = { kind: 'shadow', target, ahead, h, side }; return this; }
  // fly straight across the sky and be gone
  pass(from, to, { h = 40, seconds = 14 } = {}) { this.mode = { kind: 'pass', from, to, h, seconds, t: 0 }; return this; }

  update(dt) {
    this.t += dt;
    this.rotor.rotation.y += dt * 28;
    this.tailRotor.rotation.x += dt * 40;
    const m = this.mode; if (!m) return;
    let tx = this.pos.x, ty = this.pos.y, tz = this.pos.z;
    if (m.kind === 'orbit') { const a = this.t * m.speed + m.phase; tx = m.x + Math.cos(a) * m.r; tz = m.z + Math.sin(a) * m.r; ty = this.game.world.groundHeight(tx, tz) + m.h + Math.sin(this.t * 0.7) * 2; }
    else if (m.kind === 'shadow') { const p = m.target(); const yaw = p.yaw ?? 0; tx = p.x + Math.sin(yaw) * m.ahead + Math.cos(yaw) * Math.sin(this.t * 0.5) * m.side; tz = p.z + Math.cos(yaw) * m.ahead - Math.sin(yaw) * Math.sin(this.t * 0.5) * m.side; ty = Math.max(p.y ?? 0, this.game.world.groundHeight(tx, tz)) + m.h; }
    else if (m.kind === 'pass') { m.t += dt; const k = Math.min(1, m.t / m.seconds); tx = m.from.x + (m.to.x - m.from.x) * k; tz = m.from.z + (m.to.z - m.from.z) * k; ty = this.game.world.groundHeight(tx, tz) + m.h; if (k >= 1) this.mode = null; }
    const first = this.pos.y === 40 && this.pos.x === 0 && this.pos.z === 0;
    if (first) this.pos.set(tx, ty, tz);
    const k = 1 - Math.exp(-1.6 * dt);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
    const vx = (this.pos.x - ox) / Math.max(dt, 1e-4), vz = (this.pos.z - oz) / Math.max(dt, 1e-4), v = Math.hypot(vx, vz);
    if (v > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(vx, vz), 2.5, dt);
    this.tilt = damp(this.tilt, Math.min(0.22, v * 0.012), 2, dt);
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.tilt, this.yaw, Math.sin(this.t * 0.9) * 0.03);
    if (this.beam) this.beam.rotation.set(Math.sin(this.t * 0.6) * 0.25, 0, Math.cos(this.t * 0.45) * 0.25);
  }

  dispose() { this.game.scene.remove(this.root); this.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } }); }
}
