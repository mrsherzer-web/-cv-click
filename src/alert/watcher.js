// Someone keeping watch (a Sharks lookout, invented for the game): walks a loop of points, pausing to
// look around, with his field of view drawn on the ground. Nehorai inside it, with nothing in between,
// raises the alert; the cone turns red while he is being seen. Stay out of the cone and he sees nothing.
import * as THREE from 'three';

const RANGE = 9, HALF = 0.62; // meters, and half the angle of view in radians

export class Watcher {
  constructor(game, npc, points) {
    this.game = game;
    this.npc = npc;
    this.points = points;
    this.k = 0;
    this.pause = 0;
    this.seeing = false;
    this.seen = 0;          // how long Nehorai has been in view, this time
    // a slice of a disc, centered on local +z (the way he faces)
    const geo = new THREE.CircleGeometry(RANGE, 20, -Math.PI / 2 - HALF, HALF * 2).rotateX(-Math.PI / 2);
    this.cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.22, depthWrite: false }));
    this.cone.renderOrder = 2;
    game.scene.add(this.cone);
    npc.idle = null;
    npc.model.setPose(null);
    this.walk();
  }

  walk() {
    const p = this.points[this.k];
    this.npc.walkTo(p.x, p.z, { near: 0.5, onArrive: () => { this.k = (this.k + 1) % this.points.length; this.pause = 1.5; } });
  }

  // can he see this point: in range, inside the cone, nothing solid in between
  sees(x, z) {
    const n = this.npc, dx = x - n.pos.x, dz = z - n.pos.z, d = Math.hypot(dx, dz);
    if (d > RANGE) return false;
    let a = Math.atan2(dx, dz) - n.yaw;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > HALF) return false;
    const cols = this.game.world.cols;
    for (let t = 1; t < d - 0.5; t += 0.8) if (cols.blocks(n.pos.x + (dx / d) * t, n.pos.y + 1.3, n.pos.z + (dz / d) * t, n)) return false;
    return true;
  }

  update(dt) {
    const n = this.npc, g = this.game;
    if (this.pause > 0 && (this.pause -= dt) <= 0) this.walk();
    if (this.pause > 0) n.yaw += Math.sin(g.time * 1.3) * dt * 0.8; // looking around while he stands
    const p = g.player.pos;
    this.seeing = g.mode === 'foot' && this.sees(p.x, p.z);
    this.seen = this.seeing ? this.seen + dt : 0;
    this.cone.material.color.set(this.seeing ? '#e2574c' : '#ffd23f');
    this.cone.material.opacity = this.seeing ? 0.32 : 0.2;
    this.cone.position.set(n.pos.x, n.pos.y + 0.06, n.pos.z);
    this.cone.rotation.y = n.yaw;
  }

  dispose() {
    this.game.scene.remove(this.cone);
    this.cone.geometry.dispose();
    this.cone.material.dispose();
  }
}
