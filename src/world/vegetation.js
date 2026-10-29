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
        at(blob(1.35, 1.1, 0.55, 1.2, 2, 0), -0.9, 4.4, 0.5),
        at(blob(1.1, 1.2, 0.55, 1.0, 3, 0), 0.9, 5.4, -0.6),
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
    case 'eucalyptus': return {
      trunk: clean(mergeGeometries([
        at(new THREE.CylinderGeometry(0.16, 0.3, 9, 6), 0, 4.5, 0, 0, 0.05),
        at(new THREE.CylinderGeometry(0.08, 0.13, 3.5, 5), 0.6, 8.2, 0, 0, -0.45),
      ])),
      crown: mergeGeometries([
        at(blob(2.0, 1.0, 1.25, 0.9, 11), 0.4, 10.2, 0),
        at(blob(1.6, 1.1, 1.0, 1.0, 12), -1.1, 8.6, 0.6),
        at(blob(1.4, 1.0, 1.1, 1.1, 13), 1.4, 8.2, -0.7),
      ]),
    };
    case 'bush': return {
      trunk: null,
      crown: mergeGeometries([at(blob(0.85, 1.3, 0.8, 1.1, 7), 0, 0.6, 0), at(blob(0.6, 1.2, 0.9, 1.1, 8), 0.7, 0.55, 0.2)]),
    };
    default: throw new Error(`unknown tree ${kind}`);
  }
}

// the same trees seen from far away: a handful of faces each
function lowGeometry(kind) {
  const trunk = (r0, r1, h) => clean(at(new THREE.CylinderGeometry(r0, r1, h, 4), 0, h / 2, 0));
  switch (kind) {
    case 'pine': return { trunk: trunk(0.14, 0.26, 4.6), crown: at(blob(2.1, 1.3, 0.62, 1.2, 1, 0), 0.1, 5.0, 0) };
    case 'olive': return { trunk: trunk(0.16, 0.3, 2.0), crown: at(blob(1.6, 1.3, 0.8, 1.2, 4, 0), -0.2, 2.5, 0.1) };
    case 'cypress': return { trunk: null, crown: at(blob(0.8, 1, 4.2, 1, 6, 0), 0, 3.6, 0) };
    case 'palm': return { trunk: trunk(0.26, 0.34, 7.3), crown: at(blob(2.4, 1.6, 0.42, 1.6, 10, 0), 0, 7.2, 0) };
    case 'eucalyptus': return { trunk: trunk(0.16, 0.3, 9), crown: at(blob(2.3, 1.15, 1.3, 1.05, 11, 0), 0.2, 9.6, 0) };
    default: return null; // bushes are simply not drawn far away
  }
}

const CROWN_COLORS = {
  pine: ['#38552c', '#2f4b26', '#46632f'],
  olive: ['#7d8b5c', '#8a9668', '#6f7d52'],
  cypress: ['#2b4224', '#30482a'],
  palm: ['#56702f', '#4b6529'],
  eucalyptus: ['#6f8466', '#7b8f70', '#647a5c'],
  bush: ['#c2367a', '#d04a8c', '#4d6b38', '#a8336d'], // bougainvillea pinks and plain green
};

const CHUNK = 160; // trees are grouped by map chunk so the ones out of view are skipped
const BARK = { palm: '#7a6a55', eucalyptus: '#cfc6b5' };
const shapes = new Map();

// trunk and crown as one geometry: the trunk carries its bark color, the crown is white and takes
// each tree's own green from its instance color (see treeMaterial), so a tree is a single instance
function oneTree(parts, kind) {
  const bark = new THREE.Color(BARK[kind] || '#5a4636'), white = new THREE.Color(1, 1, 1);
  const geos = [];
  for (const [g, c] of [[parts.trunk, bark], [parts.crown, white]]) {
    if (!g) continue;
    const h = (g.index ? g.toNonIndexed() : g.clone());
    const n = h.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const name of Object.keys(h.attributes)) if (name !== 'position' && name !== 'normal') h.deleteAttribute(name);
    h.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(h);
  }
  return mergeGeometries(geos);
}

let treeMat = null;
function treeMaterial() {
  if (treeMat) return treeMat;
  treeMat = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true });
  treeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      vColor *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor *= mix(vec3(1.0), instanceColor.xyz, step(0.99, min(color.r, min(color.g, color.b))));
      #endif`);
  };
  return treeMat;
}

// items: [{ kind, x, y, z, s, rot }]; lod: when given, each chunk switches to simple shapes far away
export function buildVegetation(items, M, parent, { shadows, lod = null, nearDist = 130 }) {
  const byKind = new Map();
  for (const it of items) {
    const id = `${it.kind}@${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)}`;
    if (!byKind.has(id)) byKind.set(id, []);
    byKind.get(id).push(it);
  }
  const r = rng(99);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const color = new THREE.Color();
  const material = treeMaterial();
  for (const [id, list] of byKind) {
    const kind = list[0].kind;
    if (!shapes.has(kind)) {
      const low = lowGeometry(kind);
      shapes.set(kind, { near: oneTree(speciesGeometry(kind), kind), far: low && oneTree(low, kind) });
    }
    const { near: nearGeo, far: farGeo } = shapes.get(kind);
    const mesh = new THREE.InstancedMesh(nearGeo, material, list.length);
    const pal = CROWN_COLORS[kind];
    list.forEach((it, i) => {
      e.set(0, it.rot ?? r() * Math.PI * 2, 0);
      q.setFromEuler(e);
      sc.setScalar(it.s ?? 1);
      m.compose(v.set(it.x, it.y, it.z), q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(pal[Math.floor(r() * pal.length)]));
    });
    mesh.castShadow = shadows && kind !== 'bush';
    mesh.receiveShadow = true;
    mesh.name = id;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    const far = [];
    if (lod && farGeo) { // the far version shares the placement and colors
      const f = new THREE.InstancedMesh(farGeo, material, list.length);
      f.instanceMatrix.copy(mesh.instanceMatrix);
      f.instanceColor = mesh.instanceColor.clone();
      f.name = `${id}-far`;
      f.computeBoundingSphere();
      parent.add(f);
      far.push(f);
    }
    if (lod) lod.addSwap(mesh.boundingSphere.center, mesh.boundingSphere.radius, [mesh], far, kind === 'bush' ? 90 : nearDist);
  }
}
