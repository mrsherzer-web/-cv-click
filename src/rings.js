import * as THREE from 'three';
import { fogPatch } from './shared.js';
import { HALF, PITCH } from './city.js';

// Street intersections (grid line i, grid line j). The route zigzags north from
// downtown through the towers to midtown. Heights follow the skyline.
const ROUTE = [
  [9, 18],
  [9, 16],
  [11, 16],
  [11, 14],
  [11, 12],
  [9, 12],
  [9, 10],
  [11, 10],
  [11, 8],
  [13, 8],
  [13, 6],
  [13, 4],
];

export class Rings {
  constructor(scene, city) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const pts = ROUTE.map(([i, j]) => {
      const x = -HALF + i * PITCH;
      const z = -HALF + j * PITCH;
      // Halfway up the four blocks around the crossing: low enough to need a swing, high enough to reach.
      const tops = [[-30, -30], [30, -30], [-30, 30], [30, 30]].map(([dx, dz]) => city.topAt(x + dx, z + dz));
      const avg = tops.reduce((a, b) => a + b, 0) / tops.length;
      return new THREE.Vector3(x, THREE.MathUtils.clamp(avg * 0.5, 30, 130), z);
    });
    const geo = new THREE.TorusGeometry(6.5, 0.38, 10, 56);
    this.matOn = fogPatch(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.55) }));
    this.matOff = fogPatch(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.6, 0.25), transparent: true, opacity: 0.5 }));
    this.matDone = fogPatch(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 0.55), transparent: true, opacity: 0.25 }));
    this.items = pts.map((p, i) => {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dir = new THREE.Vector3().subVectors(next, prev).normalize();
      const mesh = new THREE.Mesh(geo, this.matOff);
      mesh.position.copy(p);
      mesh.lookAt(p.clone().add(dir));
      this.group.add(mesh);
      return { mesh, pos: p };
    });
    const pillarGeo = new THREE.CylinderGeometry(1.1, 1.1, 700, 12, 1, true).translate(0, 350, 0);
    this.pillar = new THREE.Mesh(
      pillarGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.6, 0.2), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.pillar.frustumCulled = false;
    this.group.add(this.pillar);
    this.reset();
  }

  get count() {
    return this.items.length;
  }

  get nextPos() {
    return this.finished ? null : this.items[this.next]?.pos || null;
  }

  reset() {
    this.next = 0;
    this.running = false;
    this.finished = false;
    this.time = 0;
    this._refresh();
  }

  setVisible(v) {
    this.group.visible = v;
  }

  _refresh() {
    this.items.forEach((it, i) => {
      it.mesh.material = i < this.next ? this.matDone : i === this.next ? this.matOn : this.matOff;
      it.mesh.scale.setScalar(1);
    });
    const p = this.nextPos;
    this.pillar.visible = !!p;
    if (p) this.pillar.position.set(p.x, 0, p.z);
  }

  update(dt, P, time) {
    if (this.running) this.time += dt;
    const it = this.items[this.next];
    if (!it || this.finished) return null;
    it.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
    if (P.pos.distanceTo(it.pos) > 7.6) return null;
    if (this.next === 0) {
      this.running = true;
      this.time = 0;
    }
    this.next++;
    if (this.next >= this.items.length) {
      this.running = false;
      this.finished = true;
      this._refresh();
      return { type: 'finish', index: this.next - 1, time: this.time, pos: it.pos };
    }
    this._refresh();
    return { type: 'ring', index: this.next - 1, pos: it.pos };
  }
}
