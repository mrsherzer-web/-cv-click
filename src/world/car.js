// A generic white hatchback with no brand marks: the stand-in for Nehorai's white Renault until a
// licensed model is available. The same shape in other colors serves as traffic. The body is baked into
// one mesh (vertex colors) and each wheel into another, so a car costs a handful of draw calls.
// Local +z is the front; the origin is on the ground under the car's center; the driver sits on the left (+x).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2); // profile length was along x; turn it so the front faces +z
  return g;
}

// one geometry from many pieces, each with its own color: [geometry, color, matrix?]
function paintedMerge(pieces) {
  const geos = pieces.map(([g0, color, m]) => {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (m) g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const c = new THREE.Color(color), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(geos);
}
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

const shared = {};
function wheelGeometry() {
  if (shared.wheel) return shared.wheel;
  shared.wheel = paintedMerge([
    [new THREE.CylinderGeometry(0.31, 0.31, 0.22, 18).rotateZ(Math.PI / 2), '#1c1d20'],
    [new THREE.CylinderGeometry(0.19, 0.19, 0.226, 10).rotateZ(Math.PI / 2), '#b9bec4'],
    [new THREE.BoxGeometry(0.228, 0.3, 0.05), '#8d9298'], // a spoke, so the spin shows
  ]);
  return shared.wheel;
}

// the hatchback's body pieces: [geometry, color, matrix?]
function bodyPieces(color, plates) {
  const lower = extrudeProfile([
    [-1.96, 0.3], [1.92, 0.3], [2.02, 0.5], [1.99, 0.72], [1.2, 0.9], [0.92, 0.96],
    [-1.8, 0.98], [-1.99, 0.86], [-2.02, 0.5],
  ], 1.62, 0.05);
  const greenhouse = extrudeProfile([[0.9, 0.95], [0.12, 1.4], [-1.12, 1.42], [-1.74, 1.2], [-1.82, 0.97]], 1.5, 0.04);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const pieces = [
    [lower, color],
    [greenhouse, '#1b232c'],
    [box(1.46, 0.05, 1.32), color, at(0, 1.44, -0.48)],
    [box(1.6, 0.42, 0.12), color, at(0, 1.18, -0.42)],
    [box(0.36, 0.11, 0.05), '#e8eef2', at(0.55, 0.74, 2.02)], [box(0.36, 0.11, 0.05), '#e8eef2', at(-0.55, 0.74, 2.02)],
    [box(1.5, 0.16, 0.05), '#1c1d20', at(0, 0.36, 2.04)], [box(1.5, 0.16, 0.05), '#1c1d20', at(0, 0.36, -2.06)],
    [box(0.18, 0.1, 0.12), color, at(0.86, 1.0, 0.82)], [box(0.18, 0.1, 0.12), color, at(-0.86, 1.0, 0.82)],
    [box(1.58, 0.04, 2.1), '#2a2d31', at(0, 0.32, -0.1)], // underside, dark
  ];
  if (plates) pieces.push([box(0.52, 0.12, 0.05), '#f5cf1d', at(0, 0.47, 2.07)], [box(0.52, 0.12, 0.05), '#f5cf1d', at(0, 0.62, -2.08)]); // yellow Israeli plates
  return pieces;
}

export function makeHatchback({ color = '#f3f4f6', plates = true } = {}) {
  const car = new THREE.Group();
  car.name = 'hatchback';
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const pieces = bodyPieces(color, plates);
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12 });
  const body = new THREE.Mesh(paintedMerge(pieces), paint);
  car.add(body);
  // tail lights on their own, so they can light up when braking
  const tailMat = new THREE.MeshStandardMaterial({ color: '#b3161c', roughness: 0.3, emissive: '#3a0406' });
  const tail = new THREE.Mesh(paintedMerge([[box(0.26, 0.15, 0.05), '#ffffff', at(0.64, 0.86, -2.05)], [box(0.26, 0.15, 0.05), '#ffffff', at(-0.64, 0.86, -2.05)]]), tailMat);
  car.add(tail);

  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const wheels = [];
  for (const [x, z] of [[0.78, 1.27], [-0.78, 1.27], [0.78, -1.3], [-0.78, -1.3]]) {
    const pivot = new THREE.Group(), spin = new THREE.Mesh(wheelGeometry(), wheelMat);
    pivot.position.set(x, 0.31, z);
    pivot.add(spin);
    car.add(pivot);
    wheels.push({ pivot, spin, front: z > 0, x, z });
  }
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData = { wheels, body, tailMat, paint, color, halfExtents: { x: 0.9, z: 2.1 } };
  return car;
}

// The same car for traffic, drawn many at once: one geometry with the wheels and lights baked in and
// the paint left pure white, so each instance's color tints only the paint (see trafficMaterial).
export function trafficCarGeometry() {
  if (shared.traffic) return shared.traffic;
  const pieces = bodyPieces('#ffffff', true);
  pieces.push([new THREE.BoxGeometry(0.26, 0.15, 0.05), '#b3161c', at(0.64, 0.86, -2.05)], [new THREE.BoxGeometry(0.26, 0.15, 0.05), '#b3161c', at(-0.64, 0.86, -2.05)]);
  for (const [x, z] of [[0.78, 1.27], [-0.78, 1.27], [0.78, -1.3], [-0.78, -1.3]]) {
    pieces.push([new THREE.CylinderGeometry(0.31, 0.31, 0.22, 14).rotateZ(Math.PI / 2), '#1c1d20', at(x, 0.31, z)]);
    pieces.push([new THREE.CylinderGeometry(0.19, 0.19, 0.226, 8).rotateZ(Math.PI / 2), '#b9bec4', at(x, 0.31, z)]);
  }
  shared.traffic = paintedMerge(pieces);
  return shared.traffic;
}

let trafficMat = null;
export function trafficMaterial() {
  if (trafficMat) return trafficMat;
  trafficMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12 });
  trafficMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      vColor *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor *= mix(vec3(1.0), instanceColor.xyz, step(0.99, min(color.r, min(color.g, color.b))));
      #endif`);
  };
  return trafficMat;
}

// repaint a car (garage): rebuild the body with the new color
export function repaint(car, color) {
  const fresh = makeHatchback({ color });
  car.userData.body.geometry.dispose();
  car.userData.body.geometry = fresh.userData.body.geometry;
  car.userData.color = color;
}
