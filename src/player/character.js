// Nehorai, temporary model built from primitives (a real rigged model can replace it later).
// Visual reference only: short dark hair with faded sides and a black T-shirt. Pants, shoes and the
// small chest print are original design choices. The model faces local +z; the origin is at the feet.
import * as THREE from 'three';

const SKIN = '#c8946e';
const HAIR = '#1b1512';

// skin with hair painted on: solid on top, a short fade down the sides and the back (a skin fade).
// SphereGeometry maps u = 0.25 to the face (+z) and v = 1 to the crown.
function headTexture() {
  const W = 256, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = SKIN;
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const face = Math.max(0, Math.cos((u - 0.25) * Math.PI * 2));      // 1 at the face, 0 at the sides
    const back = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2));      // 1 at the back of the head
    // fractions of the height from the crown (0.5 is ear level)
    const solid = 0.3 - face * 0.08 + back * 0.04;                     // where solid hair ends
    const fade = solid + 0.16 + back * 0.1 - face * 0.16;               // where the fade reaches bare skin
    const grd = g.createLinearGradient(0, solid * H, 0, fade * H);
    grd.addColorStop(0, 'rgba(27,21,18,1)');
    grd.addColorStop(1, 'rgba(27,21,18,0)');
    g.fillStyle = HAIR;
    g.fillRect(x, 0, 1, solid * H);
    if (face < 0.85) { g.fillStyle = grd; g.fillRect(x, solid * H, 1, (fade - solid) * H); }
  }
  for (let i = 0; i < 1400; i++) { // short hair texture
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`;
    g.fillRect(Math.random() * W, Math.random() * H * 0.32, 1, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function canvasMark() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#f2efe8';
  g.lineWidth = 5;
  g.beginPath(); g.arc(32, 34, 17, Math.PI, 0); g.stroke();           // a small sun over a horizon line
  g.beginPath(); g.moveTo(8, 36); g.lineTo(56, 36); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeNehorai() {
  const m = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const mat = {
    skin: m(SKIN, 0.6), hair: m(HAIR, 0.95),
    tee: m('#17181b', 0.9), pants: m('#7b8088', 0.9), cuff: m('#62666d', 0.9),
    shoe: m('#efede8', 0.7), sole: m('#2a2a2c', 0.8), accent: m('#f0a43a', 0.6), eye: m('#1a1410', 0.4),
  };
  const mesh = (geo, material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

  const root = new THREE.Group();
  root.name = 'nehorai';
  const hips = pivot(0, 0.96, 0);
  root.add(hips);
  hips.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.21), mat.pants, 0, 0.0, 0));

  // torso and head
  const chest = pivot(0, 0.06, 0);
  hips.add(chest);
  const torso = new THREE.CylinderGeometry(0.205, 0.175, 0.5, 14);
  torso.scale(1, 1, 0.62);
  chest.add(mesh(torso, mat.tee, 0, 0.25, 0));
  chest.add(mesh(new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.32, 0.62), mat.tee, 0, 0.5, 0));
  const print = mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshStandardMaterial({ map: canvasMark(), transparent: true, roughness: 0.9 }), 0.085, 0.38, 0.122);
  print.castShadow = false;
  chest.add(print);
  chest.add(mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 10), mat.skin, 0, 0.57, 0.005));

  const head = pivot(0, 0.67, 0.01);
  chest.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.108, 24, 16).scale(0.9, 1.1, 1.0), new THREE.MeshStandardMaterial({ map: headTexture(), roughness: 0.7 })));
  // a little volume on top, kept above the faded sides
  const cap = new THREE.SphereGeometry(0.113, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.22).scale(0.92, 1.1, 1.04);
  const hair = mesh(cap, mat.hair, 0, 0.006, -0.004);
  hair.rotation.x = -0.12;
  head.add(hair);
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), mat.eye, s * 0.036, 0.018, 0.094));
    head.add(mesh(new THREE.BoxGeometry(0.042, 0.009, 0.012), mat.hair, s * 0.038, 0.045, 0.097));
    head.add(mesh(new THREE.SphereGeometry(0.028, 8, 6).scale(0.45, 1, 0.75), mat.skin, s * 0.1, 0.005, 0));
  }
  const nose = mesh(new THREE.ConeGeometry(0.016, 0.04, 6), mat.skin, 0, -0.008, 0.108);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  head.add(mesh(new THREE.BoxGeometry(0.038, 0.006, 0.01), m('#8a5a48', 0.6), 0, -0.05, 0.096));

  // arms: short sleeve then skin, with an elbow pivot
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = pivot(s * 0.225, 0.44, 0);
    chest.add(shoulder);
    shoulder.add(mesh(new THREE.SphereGeometry(0.072, 10, 8), mat.tee));
    shoulder.add(mesh(new THREE.CylinderGeometry(0.07, 0.064, 0.17, 10), mat.tee, 0, -0.085, 0));
    shoulder.add(mesh(new THREE.CylinderGeometry(0.047, 0.043, 0.16, 10), mat.skin, 0, -0.2, 0));
    const elbow = pivot(0, -0.29, 0);
    shoulder.add(elbow);
    elbow.add(mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.25, 10), mat.skin, 0, -0.125, 0));
    elbow.add(mesh(new THREE.BoxGeometry(0.055, 0.085, 0.03).translate(0, -0.03, 0), mat.skin, 0, -0.27, 0));
    shoulder.rotation.z = s * 0.06;
    arms.push({ shoulder, elbow, side: s });
  }

  // legs: joggers with darker cuffs, white sneakers with a dark sole and an amber heel tab
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(s * 0.095, -0.04, 0);
    hips.add(hip);
    hip.add(mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.44, 10), mat.pants, 0, -0.22, 0));
    const knee = pivot(0, -0.44, 0);
    hip.add(knee);
    knee.add(mesh(new THREE.CylinderGeometry(0.066, 0.052, 0.4, 10), mat.pants, 0, -0.2, 0));
    knee.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.05, 10), mat.cuff, 0, -0.4, 0));
    const ankle = pivot(0, -0.42, 0);
    knee.add(ankle);
    ankle.add(mesh(new THREE.BoxGeometry(0.105, 0.075, 0.27), mat.shoe, 0, 0.0, 0.045));
    ankle.add(mesh(new THREE.BoxGeometry(0.11, 0.025, 0.28), mat.sole, 0, -0.045, 0.045));
    ankle.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.012), mat.accent, 0, 0.03, -0.092));
    legs.push({ hip, knee, ankle, side: s });
  }

  // ---------- procedural walk / run / idle ----------
  let phase = 0, t = 0, blend = 0;
  function animate(dt, speed, maxSpeed) {
    t += dt;
    const k = Math.min(1, speed / 2.4);                 // 0 standing … 1 walking
    const run = Math.max(0, Math.min(1, (speed - 2.6) / (maxSpeed - 2.6)));
    blend += (k - blend) * Math.min(1, dt * 10);
    const stride = 1.35 + run * 1.0;                   // meters per full step cycle
    phase += (speed / stride) * Math.PI * 2 * dt;
    const sw = Math.sin(phase);
    const legAmp = (0.42 + run * 0.45) * blend, armAmp = (0.34 + run * 0.5) * blend;
    for (const L of legs) {
      const p = L.side > 0 ? sw : -sw;
      L.hip.rotation.x = -p * legAmp;
      const lift = Math.max(0, Math.sin(phase + (L.side > 0 ? 0 : Math.PI) - 1.1));
      L.knee.rotation.x = (0.08 + lift * (0.55 + run * 0.8)) * blend + 0.04 * (1 - blend);
      L.ankle.rotation.x = -L.knee.rotation.x * 0.35;
    }
    for (const A of arms) {
      const p = A.side > 0 ? -sw : sw;
      A.shoulder.rotation.x = -p * armAmp;
      A.elbow.rotation.x = -(0.2 + run * 0.9) * blend - 0.08;
      A.shoulder.rotation.z = A.side * (0.06 + 0.02 * Math.sin(t * 1.6) * (1 - blend));
    }
    hips.position.y = 0.96 - Math.abs(Math.cos(phase)) * (0.025 + run * 0.035) * blend;
    chest.rotation.x = (0.03 + run * 0.16) * blend;
    chest.rotation.y = sw * 0.06 * blend;
    chest.scale.y = 1 + Math.sin(t * 2.2) * 0.008 * (1 - blend);  // breathing when idle
    head.rotation.x = -chest.rotation.x * 0.6;
  }

  return { root, animate };
}
