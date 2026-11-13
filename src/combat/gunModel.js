// A paintball marker, built from boxes and cylinders (no real make, nothing copied): a short body with
// a hopper of paint on top, a barrel, a grip and a small air tank under the stock. Held in the right
// hand: the model's origin is where the hand closes on the grip, +z down the barrel.
import * as THREE from 'three';

const shared = {};

// the three kinds of marker (chapter ten's rack): 'balanced' is the marker of chapters four to nine,
// exactly; 'quick' is short with a small hopper and a yellow band; 'long' has a long barrel, a sight
// on top, a foregrip and a blue band. `accent` is the band's colour (null: no band)
export const GUN_LOOKS = {
  quick: { barrel: 0.19, hopper: 0.72, accent: '#ffd23f' },
  balanced: { barrel: 0.3, hopper: 1, accent: null },
  long: { barrel: 0.5, hopper: 0.9, accent: '#36c3ff' },
};

export function makePaintGun({ color = '#2a2d33', hopper = '#1d9a7a', kind = 'balanced' } = {}) {
  const g = new THREE.Group();
  g.name = 'paint-gun';
  const L = GUN_LOOKS[kind] || GUN_LOOKS.balanced;
  const dark = shared.dark || (shared.dark = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 }));
  const steel = shared.steel || (shared.steel = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 0.35, metalness: 0.7 }));
  const tank = new THREE.MeshStandardMaterial({ color: hopper, roughness: 0.45 });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.05, 0.075, 0.26), dark, 0, 0.055, 0.1);                  // body
  add(new THREE.CylinderGeometry(0.014, 0.014, L.barrel, 10), steel, 0, 0.07, 0.21 + L.barrel / 2, Math.PI / 2); // barrel
  add(new THREE.BoxGeometry(0.035, 0.1, 0.045), dark, 0, 0, 0.0);                        // grip, in the hand
  add(new THREE.BoxGeometry(0.03, 0.03, 0.03), dark, 0, 0.012, 0.055);                   // trigger guard
  add(new THREE.CylinderGeometry(0.045 * L.hopper, 0.05 * L.hopper, 0.11 * L.hopper, 12), tank, 0, 0.085 + 0.055 * L.hopper, 0.09); // hopper of paint
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), steel, 0, 0.02, -0.12, Math.PI / 2); // air tank
  add(new THREE.BoxGeometry(0.03, 0.045, 0.08), dark, 0, 0.045, -0.06);                 // stock
  if (L.accent) {
    // the kind's own colour: a band round the body, and what sets its shape apart
    const band = new THREE.MeshStandardMaterial({ color: L.accent, roughness: 0.4, emissive: L.accent, emissiveIntensity: 0.25 });
    add(new THREE.BoxGeometry(0.054, 0.079, 0.03), band, 0, 0.055, 0.2);
    if (kind === 'long') {
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 10), dark, 0, 0.125, -0.035, Math.PI / 2);   // a sight over the stock
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10), band, 0, 0.125, 0.034, Math.PI / 2);   // its lens ring
      add(new THREE.BoxGeometry(0.026, 0.07, 0.03), dark, 0, 0.012, 0.3);                              // foregrip
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), band, 0, 0.07, 0.2 + L.barrel, Math.PI / 2); // muzzle
    } else {
      add(new THREE.BoxGeometry(0.03, 0.05, 0.05), band, 0, 0.02, 0.17);                               // a short second magazine of paint
    }
  }
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
