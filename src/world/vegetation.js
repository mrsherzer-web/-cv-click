// Mediterranean trees as instanced meshes: Aleppo pine, olive, cypress, palm, and flowering bushes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/math.js';

// a lumpy blob: same displacement for vertices at the same spot, so the surface stays closed
function blob(radius, sx, sy, sz, seed, detail = 1) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.82 + 0.36 * Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453 % 1);
    p.setXYZ(i, x * n * sx, y * n * sy, z * n * sz);
  }
  g.computeVertexNormals();
  return g;
}
const at = (g, x, y, z, rx = 0, rz = 0) => g.rotateX(rx).rotateZ(rz).translate(x, y, z);
const clean = (g) => { g.deleteAttribute('uv'); return g; };

function speciesGeometry(kind) {
  switch (kind) {
    case 'pine': return {
      trunk: clean(at(new THREE.CylinderGeometry(0.14, 0.26, 4.6, 6), 0.15, 2.3, 0, 0, -0.06)),
      crown: mergeGeometries([
        at(blob(1.7, 1.25, 0.55, 1.1, 1), 0.3, 4.9, 0),
        at(blob(1.35, 1.1, 0.55, 1.2, 2), -0.9, 4.4, 0.5),
        at(blob(1.1, 1.2, 0.55, 1.0, 3), 0.9, 5.4, -0.6),
      ]),
    };
    case 'olive': return {
      trunk: clean(mergeGeometries([
        at(new THREE.CylinderGeometry(0.16, 0.3, 1.8, 6), 0, 0.9, 0, 0.1, 0.12),
        at(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 5), -0.3, 1.9, 0.1, 0, 0.5),
      ])),
      crown: mergeGeometries([
        at(blob(1.35, 1.2, 0.75, 1.15, 4), 0.1, 2.6, 0),
        at(blob(0.95, 1.2, 0.8, 1.0, 5), -0.8, 2.3, 0.4),
      ]),
    };
    case 'cypress': return {
      trunk: clean(at(new THREE.CylinderGeometry(0.08, 0.14, 1.0, 5), 0, 0.5, 0)),
      crown: at(blob(0.75, 1, 4.2, 1, 6), 0, 3.6, 0),
    };
    case 'palm': {
      const fronds = [];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const f = blob(1.0, 2.2, 0.12, 0.42, 10 + i, 0).translate(1.9, 0, 0).rotateZ(-0.35 - (i % 3) * 0.12).rotateY(a);
        fronds.push(f.translate(0, 7.2, 0));
      }
      return {
        trunk: clean(at(new THREE.CylinderGeometry(0.26, 0.34, 7.3, 8, 6), 0, 3.65, 0)),
        crown: mergeGeometries(fronds),
      };
    }
    case 'bush': return {
      trunk: null,
      crown: mergeGeometries([at(blob(0.85, 1.3, 0.8, 1.1, 7), 0, 0.6, 0), at(blob(0.6, 1.2, 0.9, 1.1, 8), 0.7, 0.55, 0.2)]),
    };
    default: throw new Error(`unknown tree ${kind}`);
  }
}

const CROWN_COLORS = {
  pine: ['#38552c', '#2f4b26', '#46632f'],
  olive: ['#7d8b5c', '#8a9668', '#6f7d52'],
  cypress: ['#2b4224', '#30482a'],
  palm: ['#56702f', '#4b6529'],
  bush: ['#c2367a', '#d04a8c', '#4d6b38', '#a8336d'], // bougainvillea pinks and plain green
};

// items: [{ kind, x, y, z, s, rot }]
export function buildVegetation(items, M, parent, { shadows }) {
  const byKind = new Map();
  for (const it of items) {
    if (!byKind.has(it.kind)) byKind.set(it.kind, []);
    byKind.get(it.kind).push(it);
  }
  const r = rng(99);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const color = new THREE.Color();
  for (const [kind, list] of byKind) {
    const geo = speciesGeometry(kind);
    const parts = [['crown', M.foliage], ['trunk', M.bark]];
    for (const [part, material] of parts) {
      if (!geo[part]) continue;
      const mesh = new THREE.InstancedMesh(geo[part], material, list.length);
      list.forEach((it, i) => {
        e.set(0, it.rot ?? r() * Math.PI * 2, 0);
        q.setFromEuler(e);
        sc.setScalar(it.s ?? 1);
        m.compose(v.set(it.x, it.y, it.z), q, sc);
        mesh.setMatrixAt(i, m);
        if (part === 'crown') {
          const pal = CROWN_COLORS[kind];
          color.set(pal[Math.floor(r() * pal.length)]);
        } else color.set(kind === 'palm' ? '#7a6a55' : '#5a4636');
        mesh.setColorAt(i, color);
      });
      mesh.castShadow = shadows && kind !== 'bush';
      mesh.receiveShadow = true;
      mesh.name = `${kind}-${part}`;
      parent.add(mesh);
    }
  }
}
