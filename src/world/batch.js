// Collects many small static pieces and merges them into one mesh per material,
// which keeps the draw-call count low enough for phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const white = new THREE.Color(1, 1, 1);

export function mat4(x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0) {
  euler.set(pitch, yaw, roll, 'YXZ');
  quat.setFromEuler(euler);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(sx, sy, sz));
}

// texture coordinates from world position, picking the axis plane each face is closest to
function worldUV(g, scale) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class Batch {
  constructor() {
    this.groups = new Map();
  }

  // opts.uv: 'world' (meters × uvScale) or 'keep'; opts.color: THREE.Color tint
  add(key, material, geometry, matrix, { color = white, uv = 'keep', uvScale = 0.25 } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (uv === 'world') worldUV(g, uvScale);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    const count = g.getAttribute('position').count, col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) col.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!this.groups.has(key)) this.groups.set(key, { material, geos: [] });
    this.groups.get(key).geos.push(g);
  }

  build(parent, shadows = {}) {
    const meshes = {};
    for (const [key, { material, geos }] of this.groups) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
      mesh.name = key;
      mesh.castShadow = !!shadows[key]?.cast;
      mesh.receiveShadow = shadows[key]?.receive ?? true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes[key] = mesh;
      for (const g of geos) g.dispose();
    }
    this.groups.clear();
    return meshes;
  }
}
