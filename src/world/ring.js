// The boxing night's ring (chapter three): set up in the middle of the court for one evening. A blue
// canvas on the asphalt, four posts with a red and a blue corner, three ropes a side, stools in the two
// corners, the timekeeper's table with the bell, and string lights from four poles. Hidden, and its
// ropes out of the way, except while the boxing night is on. Everything here is invented for the game.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';

const HALF = 3;            // half the side of the canvas, to the posts
const ROPES = [0.45, 0.8, 1.15];
const ROPE_COLORS = ['#c8352d', '#f2f2ee', '#2f5e8f'];

// the canvas: deep blue, a lighter apron, and the evening's name in the middle
function canvasTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#2b4a7a'; g.fillRect(26, 26, 460, 460);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  g.strokeStyle = 'rgba(242,242,238,0.55)'; g.lineWidth = 6;
  g.beginPath(); g.arc(256, 256, 120, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f2f2ee';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.font = 'bold 64px system-ui, sans-serif';
  g.fillText('ערב אגרוף', 256, 236);
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillStyle = '#f2c230';
  g.fillText('המגרש · חדרה', 256, 300);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a wire that sags between two points, sampled every ~0.8 m; returns the points
function sag(a, b, drop) {
  const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.8)), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - drop * 4 * t * (1 - t), a.z + (b.z - a.z) * t));
  }
  return out;
}

export function buildCourtRing(ctx, court) {
  const { group, M, cols } = ctx;
  const ring = new THREE.Group();
  ring.name = 'court-ring';
  ring.visible = false;
  group.add(ring);
  const cx = court.x, cz = court.z, y = court.y;
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // the canvas lies just over the court's painted lines (they stand 4 cm off the asphalt's base)
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 0.6, HALF * 2 + 0.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTexture(), roughness: 0.85 }));
  canvas.position.set(cx, y + 0.045, cz);
  canvas.receiveShadow = true;
  ring.add(canvas);

  // posts: the red corner toward the gate on the west, the blue one across from it
  const corners = { red: { x: cx - HALF, z: cz + HALF }, blue: { x: cx + HALF, z: cz - HALF } };
  for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const px = cx + sx * HALF, pz = cz + sz * HALF;
    const pad = sx === -1 && sz === 1 ? '#c8352d' : sx === 1 && sz === -1 ? '#2f5e8f' : '#f2f2ee';
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8), mat4(px, y + 0.7, pz), { color: tint('#5d636b') });
    batch.add('paint', M.paint, box(0.22, 0.85, 0.22), mat4(px, y + 0.8, pz), { color: tint(pad) });
  }
  // three ropes a side
  for (const [ax, az, bx, bz] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]]) {
    const mx = cx + (ax + bx) * HALF / 2, mz = cz + (az + bz) * HALF / 2, alongX = az === bz;
    ROPES.forEach((h, i) => batch.add('paint', M.paint, box(alongX ? HALF * 2 : 0.045, 0.045, alongX ? 0.045 : HALF * 2), mat4(mx, y + h, mz), { color: tint(ROPE_COLORS[i]) }));
  }
  // stools in the two corners, outside the ropes, and the timekeeper's table with the bell
  const stools = { red: { x: corners.red.x - 0.55, z: corners.red.z + 0.55 }, blue: { x: corners.blue.x + 0.55, z: corners.blue.z - 0.55 } };
  for (const s of Object.values(stools)) {
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), mat4(s.x, y + 0.45, s.z), { color: tint('#26272a') });
    for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]]) batch.add('paint', M.paint, box(0.03, 0.44, 0.03), mat4(s.x + lx, y + 0.22, s.z + lz), { color: tint('#7b8087') });
  }
  const table = { x: cx + HALF + 1.6, z: cz + 0.6 };
  batch.add('paint', M.paint, box(1.2, 0.05, 0.6), mat4(table.x, y + 0.76, table.z), { color: tint('#e9e2d0') });
  for (const [lx, lz] of [[-0.55, -0.25], [0.55, -0.25], [0.55, 0.25], [-0.55, 0.25]]) batch.add('paint', M.paint, box(0.04, 0.76, 0.04), mat4(table.x + lx, y + 0.38, table.z + lz), { color: tint('#5d636b') });
  batch.add('metal', M.metal, new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat4(table.x, y + 0.79, table.z - 0.1), { color: tint('#d6a84a') });
  batch.add('paint', M.paint, box(0.3, 0.03, 0.2), mat4(table.x + 0.3, y + 0.8, table.z + 0.1), { color: tint('#26272a') }); // a clock
  // poles for the lights, one off each corner
  const poles = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => ({ x: cx + sx * (HALF + 2.6), y: y + 4.2, z: cz + sz * (HALF + 2.6) }));
  for (const p of poles) batch.add('paint', M.paint, new THREE.CylinderGeometry(0.05, 0.06, 4.3, 6), mat4(p.x, y + 2.15, p.z), { color: tint('#5d636b') });
  batch.build(ring, { paint: { cast: true }, metal: { cast: true } });

  // string lights: around the four poles and across, warm bulbs on a dark wire
  const wire = [], bulbs = [];
  for (let i = 0; i < 4; i++) {
    const a = poles[i], b = poles[(i + 1) % 4];
    const pts = sag(a, b, 0.6);
    for (let k = 0; k < pts.length - 1; k++) wire.push(pts[k], pts[k + 1]);
    bulbs.push(...pts.slice(1, -1));
  }
  for (const [a, b] of [[poles[0], poles[2]], [poles[1], poles[3]]]) {
    const pts = sag(a, b, 0.9);
    for (let k = 0; k < pts.length - 1; k++) wire.push(pts[k], pts[k + 1]);
    bulbs.push(...pts.slice(1, -1));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#2a2b2e' }));
  ring.add(lines);
  const bulb = new THREE.SphereGeometry(0.045, 6, 4);
  const lit = new THREE.InstancedMesh(bulb, new THREE.MeshBasicMaterial({ color: '#ffbf5e' }), bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => lit.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.08, p.z)));
  lit.frustumCulled = false;
  ring.add(lit);

  // the ropes as walls while the ring is up, nobody walks through them, in or out; and the poles
  const walls = poles.map((p) => { const c = cols.addDynamicCircle(null, 0.12); c.enabled = false; c.cx = p.x; c.cz = p.z; c.y0 = y - 1; c.y1 = y + 4.3; return c; });
  for (const [lx, lz, alongX] of [[0, HALF, true], [HALF, 0, false], [0, -HALF, true], [-HALF, 0, false]]) {
    const w = cols.addDynamicBox(null, alongX ? HALF + 0.1 : 0.06, alongX ? 0.06 : HALF + 0.1);
    w.enabled = false;
    w.cx = cx + lx; w.cz = cz + lz; w.c = 1; w.s = 0; w.y0 = y - 1; w.y1 = y + 1.6;
    walls.push(w);
  }

  return {
    group: ring, center: { x: cx, y, z: cz }, half: HALF, corners, stools, table, y,
    // a point in the ring's frame (0, 0 the middle; +z toward the gate)
    at: (lx, lz) => ({ x: cx + lx, z: cz + lz, y }),
    inside: (x, z, margin = 0.25) => Math.abs(x - cx) < HALF - margin && Math.abs(z - cz) < HALF - margin,
    get up() { return ring.visible; },
    show(on) {
      ring.visible = on;
      for (const w of walls) w.enabled = on;
    },
  };
}
