// Detail by distance, so a phone draws only what matters: far terrain uses coarser blocks, far trees
// simpler shapes, and small things (posts, rails, shutters) are skipped a few hundred meters out.
// Checked a few times a second, not every frame.
export class Lod {
  constructor() {
    this.items = [];
    this.wait = 0;
    this.range = 440; // nothing past the fog
  }

  // show `near` within nearDist of the camera, otherwise `far` (until the fog hides everything)
  addSwap(center, radius, near, far, nearDist) {
    this.items.push({ x: center.x, z: center.z, radius, near, far, nearDist });
  }

  // a mesh shown only within maxDist (its own bounding sphere gives the position)
  addCull(obj, maxDist) {
    const g = obj.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const c = g.boundingSphere.center.clone().applyMatrix4(obj.matrixWorld);
    this.addSwap(c, g.boundingSphere.radius, [obj], [], maxDist);
  }

  update(camera, dt, force = false) {
    this.wait -= dt;
    if (this.wait > 0 && !force) return;
    this.wait = 0.2;
    const cx = camera.position.x, cz = camera.position.z;
    for (const it of this.items) {
      const d = Math.max(0, Math.hypot(it.x - cx, it.z - cz) - it.radius);
      const near = d < it.nearDist, seen = d < this.range;
      for (const o of it.near) o.visible = near && seen;
      for (const o of it.far) o.visible = !near && seen;
    }
  }
}
