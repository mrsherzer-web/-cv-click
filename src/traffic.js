import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fogPatch, mulberry32 } from './shared.js';
import { PITCH, GRID, HALF, RIVER_X0, RIVER_X1, BAY_Z0, BRIDGE_Z, PARK, PARK_X0, PARK_X1 } from './city.js';

const CAR_COLORS = ['#e8b923', '#e8b923', '#e8b923', '#f1f1ee', '#1d1f24', '#9da3aa', '#8f1d22', '#23406e', '#3c4a3a'];

function lightBox(x, y, z, rgb) {
  const g = new THREE.BoxGeometry(0.42, 0.18, 0.08).translate(x, y, z);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Instanced cars on right-hand lanes. Body, cabin and lights share one matrix buffer.
export class Traffic {
  constructor(scene, count = 520) {
    const lanes = [];
    for (let k = 0; k <= GRID; k++) {
      const x = -HALF + k * PITCH;
      if (x > RIVER_X0 - 5 && x < RIVER_X1 + 5) continue;
      if (k > PARK.i0 && k < PARK.i1) continue;
      lanes.push({ ax: 'z', c: x - 3.2, a: -HALF, b: BAY_Z0 - 8, dir: 1 });
      lanes.push({ ax: 'z', c: x + 3.2, a: -HALF, b: BAY_Z0 - 8, dir: -1 });
    }
    for (let j = 0; j <= GRID; j++) {
      const z = -HALF + j * PITCH;
      let segs = [
        [-HALF, RIVER_X0 - 12],
        [RIVER_X1 + 12, HALF],
      ];
      if (j > PARK.j0 && j < PARK.j1) segs = [[-HALF, PARK_X0 - 12], [PARK_X1 + 12, RIVER_X0 - 12], segs[1]];
      if (z === BRIDGE_Z) segs = [[-HALF, 100], [700, HALF]];
      for (const [a, b] of segs) {
        if (b - a < 40) continue;
        lanes.push({ ax: 'x', c: z + 3.2, a, b, dir: 1 });
        lanes.push({ ax: 'x', c: z - 3.2, a, b, dir: -1 });
      }
    }
    const total = lanes.reduce((s, l) => s + (l.b - l.a), 0);
    const r = mulberry32(99);
    this.cars = [];
    for (let i = 0; i < count; i++) {
      let pick = r() * total;
      let lane = lanes[lanes.length - 1];
      for (const l of lanes) {
        pick -= l.b - l.a;
        if (pick <= 0) {
          lane = l;
          break;
        }
      }
      this.cars.push({ lane, t: lane.a + r() * (lane.b - lane.a), v: 8 + r() * 8 });
    }

    this.matrix = new THREE.InstancedBufferAttribute(new Float32Array(count * 16), 16);
    this.matrix.setUsage(THREE.DynamicDrawUsage);

    const body = new THREE.BoxGeometry(1.9, 1.0, 4.4).translate(0, 0.75, 0);
    const cabin = new THREE.BoxGeometry(1.7, 0.6, 2.3).translate(0, 1.55, -0.2);
    const lights = mergeGeometries([
      lightBox(0.6, 0.85, 2.21, [3, 2.8, 2.4]),
      lightBox(-0.6, 0.85, 2.21, [3, 2.8, 2.4]),
      lightBox(0.6, 0.9, -2.21, [2.6, 0.12, 0.08]),
      lightBox(-0.6, 0.9, -2.21, [2.6, 0.12, 0.08]),
    ]);
    const bodyMesh = new THREE.InstancedMesh(body, fogPatch(new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 })), count);
    const cabinMesh = new THREE.InstancedMesh(cabin, fogPatch(new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.2, metalness: 0.5 })), count);
    const lightMesh = new THREE.InstancedMesh(lights, fogPatch(new THREE.MeshBasicMaterial({ vertexColors: true })), count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) bodyMesh.setColorAt(i, c.set(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]));
    for (const m of [bodyMesh, cabinMesh, lightMesh]) {
      m.instanceMatrix = this.matrix;
      m.frustumCulled = false;
      scene.add(m);
    }
    this.update(0);
  }

  update(dt) {
    const a = this.matrix.array;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const L = car.lane;
      car.t += car.v * dt * L.dir;
      if (car.t > L.b) car.t = L.a;
      else if (car.t < L.a) car.t = L.b;
      let x, z, cs, sn;
      if (L.ax === 'z') {
        x = L.c;
        z = car.t;
        cs = L.dir;
        sn = 0;
      } else {
        x = car.t;
        z = L.c;
        cs = 0;
        sn = L.dir;
      }
      const o = i * 16;
      a[o] = cs;
      a[o + 1] = 0;
      a[o + 2] = -sn;
      a[o + 3] = 0;
      a[o + 4] = 0;
      a[o + 5] = 1;
      a[o + 6] = 0;
      a[o + 7] = 0;
      a[o + 8] = sn;
      a[o + 9] = 0;
      a[o + 10] = cs;
      a[o + 11] = 0;
      a[o + 12] = x;
      a[o + 13] = 0;
      a[o + 14] = z;
      a[o + 15] = 1;
    }
    this.matrix.needsUpdate = true;
  }
}
