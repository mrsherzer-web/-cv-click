// Simple path-following NPC (Ori, the messenger, Yarin at the end, the mirror ghost).
import * as THREE from 'three';
import { angleDiff, damp, dist2 } from './util.js';
import { audio } from './audio.js';

export class Npc {
  constructor(game, model) {
    this.game = game;
    this.model = model;
    this.root = model.root;
    game.scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pose = 'idle';
    this.path = null; this.pathI = 0;
    this.speed = 0;
    this.goal = null;
    this.stepDist = 0;
    this.lookAtPlayer = false;
    this.root.visible = false;
  }

  place(x, z, yaw = 0, pose = 'idle', y = 0) {
    this.pos.set(x, y, z); this.yaw = yaw; this.pose = pose; this.path = null; this.goal = null;
    this.root.visible = true;
    this._apply();
  }

  hide() { this.root.visible = false; this.goal = null; this.path = null; }
  get visible() { return this.root.visible; }

  walkTo(x, z, { speed = 1.4, mode = 'walk', direct = false } = {}) {
    return new Promise((res) => {
      this.pose = mode;
      this.goal = { speed, mode, res };
      this.path = direct ? [[x, z]] : this.game.world.nav.findPath(this.pos.x, this.pos.z, x, z) || [[x, z]];
      this.pathI = 0;
    });
  }

  async walkPath(points, opts) { for (const [x, z] of points) await this.walkTo(x, z, { ...opts, direct: true }); }

  _apply() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  update(dt, t) {
    if (!this.root.visible) return;
    if (this.goal && this.path) {
      const g = this.goal;
      const [tx, tz] = this.path[this.pathI];
      // open doors on the way
      for (const d of this.game.world.nav.doorsOnSegment(this.pos.x, this.pos.z, tx, tz)) {
        if (d.solid && dist2(d.cx, d.cz, this.pos.x, this.pos.z) < 1.4) d.open(true, g.mode === 'run');
      }
      this.speed = damp(this.speed, g.speed, 6, dt);
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, this.speed * dt);
      if (d > 0.001) {
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 9);
      }
      this.stepDist += step;
      if (this.stepDist > (g.mode === 'run' ? 0.9 : 0.7)) {
        this.stepDist = 0;
        audio.at({ x: this.pos.x, y: 0.1, z: this.pos.z }, (dst) => audio.footstep(dst, { vol: g.mode === 'run' ? 1.1 : 0.6 }), 1);
      }
      if (d < (this._bestD ?? Infinity) - 0.05) { this._bestD = d; this._stuckT = 0; }
      else if ((this._stuckT = (this._stuckT || 0) + dt) > 1.5) { this._stuckT = 0; this._bestD = Infinity; this.pos.x = tx; this.pos.z = tz; }
      if (d < 0.15) {
        this._bestD = Infinity;
        this.pathI++;
        if (this.pathI >= this.path.length) { this.goal = null; this.path = null; this.speed = 0; this.pose = 'idle'; g.res(); }
      }
      this.model.animate(dt, this.speed, g.mode, t);
    } else {
      if (this.lookAtPlayer) {
        const p = this.game.player.pos;
        if (this.pose === 'sit') this.model.parts.head.rotation.y = damp(this.model.parts.head.rotation.y, Math.max(-1, Math.min(1, angleDiff(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)))), 3, dt);
        else this.yaw += angleDiff(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)) * Math.min(1, dt * 3);
      }
      this.model.animate(dt, 0, this.pose, t);
    }
    this._apply();
  }
}
