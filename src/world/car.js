// A generic white hatchback with no brand marks: the stand-in for Nehorai's white Renault until a
// licensed model is available. Local +z is the front; the origin is on the ground under the car's center.
import * as THREE from 'three';

function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2); // profile length was along x; turn it so the front faces +z
  return g;
}

export function makeHatchback({ color = '#f3f4f6' } = {}) {
  const car = new THREE.Group();
  car.name = 'white-hatchback';
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.15 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b232c', roughness: 0.1, metalness: 0.65 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.8 });

  // lower body up to the window line, side profile from rear (-x) to front (+x)
  const body = extrudeProfile([
    [-1.96, 0.3], [1.92, 0.3], [2.02, 0.5], [1.99, 0.72], [1.2, 0.9], [0.92, 0.96],
    [-1.8, 0.98], [-1.99, 0.86], [-2.02, 0.5],
  ], 1.62, 0.05);
  const greenhouse = extrudeProfile([
    [0.9, 0.95], [0.12, 1.4], [-1.12, 1.42], [-1.74, 1.2], [-1.82, 0.97],
  ], 1.5, 0.04);
  const bodyMesh = new THREE.Mesh(body, paint);
  const glassMesh = new THREE.Mesh(greenhouse, glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.05, 1.32), paint);
  roof.position.set(0, 1.44, -0.48);
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.12), paint);
  pillar.position.set(0, 1.18, -0.42);
  car.add(bodyMesh, glassMesh, roof, pillar);

  const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.22, 18).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.225, 10).rotateZ(Math.PI / 2);
  car.userData.wheels = [];
  for (const [x, z] of [[0.78, 1.27], [-0.78, 1.27], [0.78, -1.3], [-0.78, -1.3]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.31, z);
    w.add(new THREE.Mesh(wheelGeo, dark), new THREE.Mesh(rimGeo, chrome));
    car.add(w);
    car.userData.wheels.push(w);
  }

  const lamp = (w, h, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat); m.position.set(x, y, z); car.add(m); };
  const head = new THREE.MeshStandardMaterial({ color: '#e8eef2', roughness: 0.15, metalness: 0.4, emissive: '#30343a' });
  const tail = new THREE.MeshStandardMaterial({ color: '#b3161c', roughness: 0.3, emissive: '#3a0406' });
  const plate = new THREE.MeshStandardMaterial({ color: '#f5cf1d', roughness: 0.5 }); // yellow Israeli plates
  lamp(0.36, 0.11, 0.55, 0.74, 2.02, head); lamp(0.36, 0.11, -0.55, 0.74, 2.02, head);
  lamp(0.26, 0.15, 0.64, 0.86, -2.05, tail); lamp(0.26, 0.15, -0.64, 0.86, -2.05, tail);
  lamp(0.52, 0.12, 0, 0.47, 2.07, plate); lamp(0.52, 0.12, 0, 0.62, -2.08, plate);
  lamp(1.5, 0.16, 0, 0.36, 2.04, dark); lamp(1.5, 0.16, 0, 0.36, -2.06, dark); // bumpers
  for (const x of [0.86, -0.86]) { // side mirrors
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), paint);
    m.position.set(x, 1.0, 0.82);
    car.add(m);
  }

  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData.halfExtents = { x: 0.9, z: 2.1 };
  return car;
}
