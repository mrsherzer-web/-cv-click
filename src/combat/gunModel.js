// A paintball marker, built from boxes and cylinders (no real make, nothing copied): a short body with
// a hopper of paint on top, a barrel, a grip and a small air tank under the stock. Held in the right
// hand: the model's origin is where the hand closes on the grip, +z down the barrel.
import * as THREE from 'three';

const shared = {};

export function makePaintGun({ color = '#2a2d33', hopper = '#1d9a7a' } = {}) {
  const g = new THREE.Group();
  g.name = 'paint-gun';
  const dark = shared.dark || (shared.dark = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 }));
  const steel = shared.steel || (shared.steel = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 0.35, metalness: 0.7 }));
  const tank = new THREE.MeshStandardMaterial({ color: hopper, roughness: 0.45 });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.05, 0.075, 0.26), dark, 0, 0.055, 0.1);                  // body
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10), steel, 0, 0.07, 0.36, Math.PI / 2); // barrel
  add(new THREE.BoxGeometry(0.035, 0.1, 0.045), dark, 0, 0, 0.0);                        // grip, in the hand
  add(new THREE.BoxGeometry(0.03, 0.03, 0.03), dark, 0, 0.012, 0.055);                   // trigger guard
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.11, 12), tank, 0, 0.14, 0.09);          // hopper of paint
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), steel, 0, 0.02, -0.12, Math.PI / 2); // air tank
  add(new THREE.BoxGeometry(0.03, 0.045, 0.08), dark, 0, 0.045, -0.06);                 // stock
  return g;
}

// a paint splat: a flattened blob with a few drips, laid on whatever was hit
export function makeSplat(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const g = new THREE.Group();
  const blob = (r, x, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6).scale(1, 1, 0.18), mat); m.position.set(x, y, 0); g.add(m); };
  blob(0.085, 0, 0);
  blob(0.04, 0.07, 0.03); blob(0.032, -0.065, 0.045); blob(0.028, 0.02, -0.075); blob(0.022, -0.05, -0.06);
  const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6), mat);
  drip.position.set(0.015, -0.1, 0);
  g.add(drip);
  return g;
}
