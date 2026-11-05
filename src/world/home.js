// Nehorai's house, the rest of the ground floor (chapter five): the living room where Ido's call
// finds him at five in the afternoon, the open kitchen, the dining corner, the entrance hall and the
// stairs up. The bedroom from chapter two (room.js) stays exactly as it is; everything here is built
// into the same group so it shows and hides with it, and the room's inside() test grows to the whole
// footprint. All geometry is procedural and batched into a few meshes by material; the materials and
// the lamps are published so the night and an optional asset layer can take them over.
// House-local axes: the origin is the footprint centre at floor level, +z faces the street.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { Tex } from './textures.js';
import { tint } from './materials.js';
import { clamp, rng } from '../core/math.js';

const W = 11, D = 10;        // the footprint katzir.js gives Nehorai's lot
const IN = 0.3;              // the walls sit this far inside the shell, like the bedroom's
const HT = 2.75, T = 0.12;   // ceiling height and interior wall thickness
const WHITE = new THREE.Color(1, 1, 1);

const canvas = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// a kilim-style rug: red border, sand field with a lattice, a dark medallion
const rugTex = () => canvas(256, 256, (g, w, h) => {
  g.fillStyle = '#7a2e2e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8b680'; g.fillRect(18, 18, w - 36, h - 36);
  g.strokeStyle = '#3b2a2a'; g.lineWidth = 3; g.strokeRect(25, 25, w - 50, h - 50);
  g.save();
  g.beginPath(); g.rect(28, 28, w - 56, h - 56); g.clip();
  g.strokeStyle = 'rgba(120,60,50,0.5)'; g.lineWidth = 2;
  for (let k = -h; k < w + h; k += 28) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke();
    g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke();
  }
  g.restore();
  const dia = (r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(w / 2, h / 2 - r); g.lineTo(w / 2 + r, h / 2); g.lineTo(w / 2, h / 2 + r); g.lineTo(w / 2 - r, h / 2); g.closePath(); g.fill(); };
  dia(64, '#7a2e2e'); dia(46, '#d8b680'); dia(30, '#2f4a5a'); dia(12, '#d8b680');
  for (let i = 0; i < 4; i++) { // small motifs in the corners
    const x = i % 2 ? w - 52 : 52, y = i < 2 ? 52 : h - 52;
    g.fillStyle = '#2f4a5a'; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); // the weave
});

// framed pictures: four invented abstracts, no photographs of anything real
const artTex = (kind) => canvas(192, 240, (g, w, h) => {
  if (kind === 0) { // a low sun over the sea, in flat warm bands
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#f6c177'); grd.addColorStop(0.55, '#e26d5a'); grd.addColorStop(1, '#4a2a4f');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff1c9'; g.beginPath(); g.arc(w * 0.55, h * 0.42, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2440'; for (let i = 0; i < 6; i++) g.fillRect(0, h * 0.62 + i * 14, w, 5 + i);
  } else if (kind === 1) { // brush strokes in teal and ochre
    g.fillStyle = '#eee9df'; g.fillRect(0, 0, w, h);
    const cs = ['#2f6f73', '#8fb3a9', '#d9a441', '#1f3a44', '#c66b3d'];
    g.globalAlpha = 0.85;
    for (let i = 0; i < 26; i++) { g.fillStyle = cs[i % cs.length]; g.fillRect((i * 37) % w, ((i * 53) % h) - 60, 10 + (i % 4) * 8, 90 + (i % 3) * 30); }
    g.globalAlpha = 1;
  } else if (kind === 2) { // geometric: black and sand triangles
    g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 48) for (let x = 0; x < w; x += 48) {
      g.fillStyle = ((x + y) / 48) % 2 ? '#1d1d20' : '#c8a264';
      g.beginPath(); g.moveTo(x, y + 48); g.lineTo(x + 48, y + 48); g.lineTo(x + 24, y); g.closePath(); g.fill();
    }
  } else { // dunes under a pale sky
    g.fillStyle = '#b7d3e6'; g.fillRect(0, 0, w, h);
    ['#e9d6b4', '#d5b88c', '#b9956a', '#8f6f4d', '#5c4634'].forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * (0.35 + i * 0.13));
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.35 + i * 0.13) + Math.sin(x * 0.04 + i * 1.7) * 14);
      g.lineTo(w, h); g.closePath(); g.fill();
    });
  }
});

// the television: an evening match, as in most living rooms at that hour
const tvTex = () => canvas(256, 144, (g, w, h) => {
  g.fillStyle = '#07080c'; g.fillRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 24, 0, h);
  grd.addColorStop(0, '#3f8a3a'); grd.addColorStop(1, '#2d6a2b');
  g.fillStyle = grd; g.fillRect(0, 24, w, h - 24);
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 24, 16, h - 24);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
  g.strokeRect(14, 34, w - 28, h - 48);
  g.beginPath(); g.moveTo(w / 2, 34); g.lineTo(w / 2, h - 14); g.stroke();
  g.beginPath(); g.arc(w / 2, (34 + h - 14) / 2, 18, 0, Math.PI * 2); g.stroke();
  g.strokeRect(14, 60, 30, 40); g.strokeRect(w - 44, 60, 30, 40);
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#f2c230' : '#2d6fd6'; g.fillRect(20 + (i * 53) % (w - 40), 40 + (i * 31) % (h - 60), 4, 8); }
  g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 0, w, 24);
  g.fillStyle = '#f2c230'; g.fillRect(8, 6, 60, 12);
  g.fillStyle = '#2d6fd6'; g.fillRect(w - 68, 6, 60, 12);
  g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1 : 1', w / 2, 12);
});

// a box with rounded edges (the same construction as three's RoundedBoxGeometry, which is not vendored)
function soft(w, h, d, r, seg = 2) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const p = g.attributes.position, nrm = g.attributes.normal, bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, hs = 0.5 / seg;
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    n.set(x - Math.sign(x) * hs, y - Math.sign(y) * hs, z - Math.sign(z) * hs).normalize();
    p.setXYZ(i, bx * Math.sign(x) + n.x * r, by * Math.sign(y) + n.y * r, bz * Math.sign(z) + n.z * r);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

export function build(ctx) {
  const { cols, places, net } = ctx;
  const home = places.home, R = places.room;
  if (!home || !R?.group) return;
  const room = R.group, yaw = home.yaw, FY = home.y + 0.02;
  const hw = W / 2, hd = D / 2, IX = hw - IN, IZ = hd - IN;      // inner faces of the walls
  const BX0 = -IX, BX1 = -0.5, BZ0 = -IZ, BZ1 = -0.3;           // the bedroom (room.js)
  const r = rng(5051);

  room.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(room.matrixWorld).invert();
  const tv3 = new THREE.Vector3();
  const toWorld = (lx, lz) => { tv3.set(lx, 0, lz).applyMatrix4(room.matrixWorld); return { x: tv3.x, z: tv3.z }; };
  const inside = (x, z) => { tv3.set(x, 0, z).applyMatrix4(inv); return Math.abs(tv3.x) < hw && Math.abs(tv3.z) < hd; };

  // ---------- materials: vertex tints on light procedural maps, so one material serves many pieces ----------
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...o });
  const materials = {
    floor: std({ map: Tex.tiles(), roughness: 0.32, metalness: 0.04 }),
    wall: std({ map: Tex.plaster(), roughness: 0.95 }),
    wood: std({ map: Tex.wood(), roughness: 0.62 }),
    fabric: std({ map: Tex.fabric(), roughness: 1 }),
    counter: std({ map: Tex.plaster(), roughness: 0.28, metalness: 0.05 }),
    tile: std({ map: Tex.tiles(), roughness: 0.22, metalness: 0.03 }),
    rug: std({ map: rugTex(), roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#dbe7f2', emissive: '#bcd5ee', emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.1 }),
  };
  const MAT = {
    ...materials,
    paint: std({ roughness: 0.55, metalness: 0.05 }),      // lacquer, plastics, painted frames
    metal: std({ roughness: 0.3, metalness: 0.85 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#a9bcc9', roughness: 0.06, metalness: 0.95 }),
    bulb: new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd9a0', emissiveIntensity: 0 }),
  };
  const SCALE = { floor: 1 / 1.2, wall: 1 / 1.6, wood: 1 / 0.9, fabric: 1 / 0.45, counter: 1 / 1.4, tile: 1 / 0.24 };

  // ---------- builders ----------
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
  const sph = (rad, a = 8, b = 6) => new THREE.SphereGeometry(rad, a, b);
  // a batched piece at house-local (x, y above the floor, z); c = tint, ry/pitch/roll = rotation
  const add = (key, geo, x, y, z, { ry = 0, c = WHITE, uv = 'world', s = 1, pitch = 0, roll = 0 } = {}) =>
    batch.add(key, MAT[key], geo, mat4(x, FY + y, z, ry, 1, 1, 1, pitch, roll), { color: c, uv, uvScale: (SCALE[key] || 1) * s });
  // a piece's own frame: +z is its front, turned by ry about (cx, cz)
  const frame = (cx, cz, ry) => (key, geo, lx, y, lz, c, extra = {}) =>
    add(key, geo, cx + lx * Math.cos(ry) + lz * Math.sin(ry), y, cz - lx * Math.sin(ry) + lz * Math.cos(ry), { ...extra, ry: ry + (extra.ry || 0), c });
  // a stretched sphere (leaves, bowls): drop the normals so the batch recomputes them for the new shape
  const squash = (geo, sx, sy, sz) => { geo.scale(sx, sy, sz); geo.deleteAttribute('normal'); return geo; };
  const solid = (lx, lz, hx, hz, ry = 0, top = 1.2) => { const p = toWorld(lx, lz); cols.addBox(p.x, p.z, hx, hz, yaw + ry, FY - 1, FY + top); };
  const post = (lx, lz, rad, top = 1.2) => { const p = toWorld(lx, lz); cols.addCircle(p.x, p.z, rad, FY - 1, FY + top); };
  // an unbatched mesh with its own material (pictures, the screen)
  const mesh = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, FY + y, z); room.add(o); return o; };

  // floor and ceiling quads (the bedroom has its own)
  const quad = (key, x0, z0, x1, z1, y, up, c) =>
    add(key, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(up ? -Math.PI / 2 : Math.PI / 2), (x0 + x1) / 2, y, (z0 + z1) / 2, { c });
  // a straight interior wall with rectangular openings; axis 'x' runs along x at z = c, 'z' along z at x = c
  const wall = (axis, c, a, b, openings, color, h = HT, y0 = 0) => {
    const piece = (a0, a1, lo, hi) => {
      if (a1 - a0 < 0.005 || hi - lo < 0.005) return;
      const m = (a0 + a1) / 2;
      add('wall', axis === 'x' ? box(a1 - a0, hi - lo, T) : box(T, hi - lo, a1 - a0), axis === 'x' ? m : c, (lo + hi) / 2, axis === 'x' ? c : m, { c: color });
    };
    let at = a;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      piece(at, o.a, y0, y0 + h);
      piece(o.a, o.b, y0, o.y0);
      piece(o.a, o.b, o.y1, y0 + h);
      at = o.b;
    }
    piece(at, b, y0, y0 + h);
  };
  // coordinates along a wall: P(along, y, across) → (x, y, z); S(along, y, across) → a box
  const along = (axis) => ({
    P: (al, y, ac) => (axis === 'x' ? [al, y, ac] : [ac, y, al]),
    S: (sa, sy, sc) => (axis === 'x' ? box(sa, sy, sc) : box(sc, sy, sa)),
  });
  const white = tint('#f4f4f0');
  // a window in a wall: glass in the opening, frame, sill, the roller-shutter box over it; `inward` is the
  // sign of the across axis toward the room
  const windowAt = (axis, c, a, b, y0, y1, inward, { curtains = null, blind = false } = {}) => {
    const { P, S } = along(axis);
    const m = (a + b) / 2, wd = b - a, hh = y1 - y0, ym = (y0 + y1) / 2;
    add('glass', S(wd - 0.02, hh - 0.02, 0.02), ...P(m, ym, c));
    for (const e of [a, b]) add('paint', S(0.08, hh + 0.08, T + 0.05), ...P(e, ym, c), { c: white });
    for (const e of [y0, y1]) add('paint', S(wd + 0.08, 0.08, T + 0.05), ...P(m, e, c), { c: white });
    if (wd > 1.3) add('paint', S(0.05, hh, 0.05), ...P(m, ym, c), { c: white });
    add('paint', S(wd + 0.2, 0.04, 0.2), ...P(m, y0 - 0.02, c + inward * 0.08), { c: white });
    add('paint', S(wd + 0.24, 0.26, 0.2), ...P(m, y1 + 0.17, c + inward * 0.1), { c: white });
    if (curtains) {
      const rodY = y1 + 0.42, ac = c + inward * 0.22, rod = cyl(0.012, 0.012, wd + 1.0, 8);
      add('metal', axis === 'x' ? rod.rotateZ(Math.PI / 2) : rod.rotateX(Math.PI / 2), ...P(m, rodY, ac), { c: tint('#3a3a3e') });
      const ch = rodY - 0.14;
      for (const e of [a - 0.26, b + 0.26]) add('fabric', S(0.42, ch, 0.12), ...P(e, 0.12 + ch / 2, ac), { c: curtains, s: 1.4 });
    }
    if (blind) add('fabric', S(wd - 0.04, hh * 0.45, 0.02), ...P(m, y1 - hh * 0.225 - 0.02, c + inward * 0.09), { c: tint('#e8e3d8') });
  };
  // a closed door in its frame, the handle on the room side
  const doorAt = (axis, c, a, b, inward, color) => {
    const { P, S } = along(axis);
    const m = (a + b) / 2, wd = b - a, H = 2.1;
    add('wood', S(wd - 0.06, H - 0.04, 0.05), ...P(m, (H - 0.04) / 2, c), { c: color, s: 1.6 });
    for (const e of [a, b]) add('paint', S(0.07, H + 0.04, T + 0.05), ...P(e, (H + 0.04) / 2, c), { c: white });
    add('paint', S(wd + 0.07, 0.07, T + 0.05), ...P(m, H + 0.02, c), { c: white });
    add('metal', S(0.12, 0.025, 0.025), ...P(m + wd * 0.35, 1.02, c + inward * 0.05), { c: tint('#c9ccd1') });
  };
  const skirt = (axis, c, a, b, inward) => { const { P, S } = along(axis); add('paint', S(b - a, 0.09, 0.016), ...P((a + b) / 2, 0.045, c + inward * (T / 2 + 0.008)), { c: white }); };
  // a framed picture on a wall's inner face
  const picture = (axis, c, al, y, w, h, inward, kind, frameColor = '#2a2a2e') => {
    const { P, S } = along(axis);
    add('paint', S(w + 0.07, h + 0.07, 0.03), ...P(al, y, c + inward * (T / 2 + 0.016)), { c: tint(frameColor) });
    const geo = new THREE.PlaneGeometry(w, h);
    if (axis === 'x') { if (inward < 0) geo.rotateY(Math.PI); } else geo.rotateY(inward > 0 ? Math.PI / 2 : -Math.PI / 2);
    mesh(geo, new THREE.MeshStandardMaterial({ map: artTex(kind), roughness: 0.7 }), ...P(al, y, c + inward * (T / 2 + 0.034)));
  };

  // ---------- the envelope: floor, ceiling, walls ----------
  const wallWhite = tint('#f1ede6'), wallWarm = tint('#e8ddcb'), wallTeal = tint('#3a615f'), ceil = tint('#f6f4f0'), dusk = tint('#4a4a52');
  quad('floor', -IX, BZ1, IX, IZ, 0.002, true, WHITE);           // the front band: hall, dining, living
  quad('floor', BX1, BZ0, IX, BZ1, 0.002, true, WHITE);          // kitchen and the laundry niche
  quad('wall', BX1, BZ0, IX, BZ1, HT, false, ceil);
  quad('wall', -IX, 0.7, IX, IZ, HT, false, ceil);
  quad('wall', -3.0, BZ1, IX, 0.7, HT, false, ceil);
  // the stairwell over the top of the stairs: dark walls up to the next floor
  quad('wall', -IX, BZ1, -3.0, 0.7, HT + 1.4, false, dusk);
  add('wall', box(T, 1.4, 1.0), -IX - T / 2, HT + 0.7, 0.2, { c: dusk });
  add('wall', box(T, 1.4, 1.0), -3.0 + T / 2, HT + 0.7, 0.2, { c: dusk });
  for (const z of [BZ1 - T / 2, 0.7 + T / 2]) add('wall', box(2.2 + T, 1.4, T), -4.1, HT + 0.7, z, { c: dusk });

  const FRONT = IZ + T / 2, BACK = -IZ - T / 2, RIGHT = IX + T / 2, LEFT = -IX - T / 2;
  wall('x', FRONT, -IX, IX, [{ a: -0.5, b: 0.5, y0: 0, y1: 2.1 }, { a: 2.2, b: 3.8, y0: 0.9, y1: 2.2 }], wallWhite);
  wall('x', BACK, BX1, IX, [{ a: 2.4, b: 3.6, y0: 1.42, y1: 2.2 }], wallWhite);
  wall('z', RIGHT, BZ0, -2.0, [], wallWhite);
  wall('z', RIGHT, -2.0, IZ, [{ a: 3.2, b: 4.3, y0: 0.9, y1: 2.2 }], wallTeal);
  wall('z', LEFT, BZ1, IZ, [{ a: 1.9, b: 3.5, y0: 0.9, y1: 2.2 }], wallWarm);
  wall('x', BZ1 + T / 2, BX0, BX1, [{ a: -1.72, b: -0.78, y0: 0, y1: 2.1 }], wallWhite); // in front of the bedroom
  wall('z', BX1 + T / 2, BZ0, BZ1, [], wallWhite);                                        // beside it
  windowAt('x', FRONT, 2.2, 3.8, 0.9, 2.2, -1, { curtains: tint('#8d8275') });
  windowAt('x', BACK, 2.4, 3.6, 1.42, 2.2, 1, { blind: true });
  windowAt('z', RIGHT, 3.2, 4.3, 0.9, 2.2, -1, { blind: true });
  windowAt('z', LEFT, 1.9, 3.5, 0.9, 2.2, 1, { curtains: tint('#efe7d8') });
  doorAt('x', FRONT, -0.5, 0.5, -1, tint('#4a3328'));
  doorAt('x', BZ1 + T / 2, -1.72, -0.78, 1, tint('#8a6a4c'));
  skirt('x', FRONT, -IX, -0.5, -1); skirt('x', FRONT, 0.5, IX, -1);
  skirt('z', LEFT, BZ1, IZ, 1); skirt('z', RIGHT, -2.0, IZ, -1);
  skirt('x', BZ1 + T / 2, -0.78, BX1, 1); skirt('z', BX1 + T / 2, BZ0, BZ1, 1);
  skirt('x', BACK, BX1 + 0.12, 0.5, 1);

  // ---------- the stairs up, along the front of the bedroom ----------
  const STEPS = 13, TREAD = 0.24, RISE = 0.21, oak = tint('#c9a070'), walnut = tint('#6a4a34');
  for (let i = 0; i < STEPS; i++) {
    const x = -2.0 - TREAD / 2 - i * TREAD, top = (i + 1) * RISE;
    add('wall', box(TREAD, top - 0.04, 1.0), x, (top - 0.04) / 2, 0.2, { c: wallWhite });
    add('wood', box(TREAD + 0.03, 0.04, 1.02), x, top - 0.02, 0.2, { c: oak });
    if (i % 2 === 0) add('metal', box(0.02, 0.9, 0.02), x, top + 0.45, 0.68, { c: tint('#2a2a2e') });
  }
  {
    const run = (STEPS - 1) * TREAD, rise = (STEPS - 1) * RISE;
    add('wood', box(Math.hypot(run, rise) + 0.3, 0.04, 0.05), -2.0 - TREAD / 2 - run / 2, RISE + rise / 2 + 0.9, 0.68, { c: walnut, roll: -Math.atan2(rise, run) });
  }
  solid(-3.56, 0.2, 1.6, 0.5);

  // ---------- entrance hall: mat, shoe cabinet with the mirror, the light ----------
  add('fabric', box(0.8, 0.012, 0.5), 0, 0.006, 4.3, { c: tint('#5a4a3a') });
  add('wood', box(0.7, 0.42, 0.3), 0.95, 0.26, 4.53, { c: tint('#e6dfd2') });
  add('wood', box(0.72, 0.03, 0.32), 0.95, 0.485, 4.53, { c: oak });
  add('metal', box(0.14, 0.012, 0.012), 0.95, 0.27, 4.375, { c: tint('#c9ccd1') });
  add('paint', cyl(0.09, 0.07, 0.05, 12), 0.75, 0.525, 4.53, { c: tint('#2f4a5a') });                 // the key bowl
  add('paint', box(0.56, 1.16, 0.02), 0.95, 1.55, IZ - 0.012, { c: tint('#2a2a2e') });
  add('mirror', new THREE.PlaneGeometry(0.5, 1.1).rotateY(Math.PI), 0.95, 1.55, IZ - 0.025);
  solid(0.95, 4.53, 0.35, 0.15, 0, 0.5);
  add('bulb', cyl(0.14, 0.16, 0.06, 16), 0.2, HT - 0.03, 3.5);

  // ---------- living room: sofa and armchair on the rug, coffee table, the TV wall ----------
  const seater = (cx, cz, ry, n, w, color, pillow) => {
    const put = frame(cx, cz, ry), dpt = 0.92, cw = (w - 0.4) / n - 0.04;
    put('fabric', soft(w - 0.4, 0.3, dpt - 0.1, 0.05), 0, 0.25, 0.05, color);
    for (const sx of [-1, 1]) put('fabric', soft(0.2, 0.62, dpt, 0.05), sx * (w / 2 - 0.1), 0.31, 0, color);
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * (cw + 0.04)) / 2 + i * (cw + 0.04);
      put('fabric', soft(cw, 0.17, 0.6, 0.06), x, 0.48, 0.12, color, { s: 1.2 });
      put('fabric', soft(cw, 0.52, 0.2, 0.06), x, 0.7, -0.3, color, { pitch: -0.14 });
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('metal', cyl(0.02, 0.02, 0.1, 8), sx * (w / 2 - 0.12), 0.05, sz * (dpt / 2 - 0.12), tint('#2a2a2e'));
    if (pillow) for (const sx of [-1, 1]) put('fabric', soft(0.4, 0.4, 0.12, 0.05), sx * (w / 2 - 0.42), 0.76, -0.22, pillow, { ry: sx * 0.25, pitch: -0.2 });
    solid(cx, cz, w / 2, dpt / 2, ry, 0.7);
  };
  seater(2.4, 1.6, Math.PI / 2, 2, 2.0, tint('#6f7f8c'), tint('#d9a441'));                 // the two-seater, facing the TV
  seater(3.55, 3.9, 2.54, 1, 0.95, tint('#b8743f'), null);                                 // the armchair, turned toward it
  add('rug', box(3.2, 0.012, 2.6), 3.4, 0.006, 1.9, { uv: 'keep' });
  // coffee table: wood top on a black frame, a tray with cups, a remote, a magazine
  add('wood', box(1.0, 0.04, 0.5), 3.45, 0.42, 1.6, { c: oak });
  add('wood', box(0.9, 0.02, 0.42), 3.45, 0.15, 1.6, { c: oak });
  for (const [dx, dz] of [[-0.47, -0.22], [0.47, -0.22], [-0.47, 0.22], [0.47, 0.22]]) add('paint', box(0.03, 0.42, 0.03), 3.45 + dx, 0.21, 1.6 + dz, { c: tint('#1d1d20') });
  add('paint', box(0.4, 0.015, 0.28), 3.45, 0.448, 1.5, { c: tint('#2a2a2e') });
  for (const dx of [-0.1, 0.1]) add('paint', cyl(0.04, 0.035, 0.09, 10), 3.45 + dx, 0.5, 1.5, { c: white });
  add('paint', cyl(0.06, 0.05, 0.07, 10), 3.45, 0.475, 1.95, { c: tint('#c7c1b5') });
  add('paint', sph(0.065, 8, 6), 3.45, 0.56, 1.95, { c: tint('#3b7a46') });
  add('paint', box(0.16, 0.02, 0.045), 3.6, 0.45, 1.8, { c: tint('#1d1d20'), ry: 0.4 });
  add('paint', box(0.28, 0.01, 0.21), 3.3, 0.445, 1.85, { c: tint('#c66b3d'), ry: -0.2 });
  solid(3.45, 1.6, 0.5, 0.25, 0, 0.5);
  // the TV wall: console, soundbar, the set on its bracket
  add('wood', box(1.6, 0.45, 0.42), 4.99, 0.325, 1.6, { c: walnut });
  add('wood', box(1.64, 0.03, 0.46), 4.99, 0.565, 1.6, { c: walnut });
  for (const dz of [-0.4, 0.4]) { add('wood', box(0.02, 0.3, 0.74), 4.77, 0.33, 1.6 + dz, { c: tint('#7d5a40') }); add('metal', box(0.012, 0.012, 0.16), 4.758, 0.44, 1.6 + dz, { c: tint('#c9ccd1') }); }
  for (const dz of [-0.7, 0.7]) add('metal', cyl(0.02, 0.02, 0.1, 8), 4.99, 0.05, 1.6 + dz, { c: tint('#2a2a2e') });
  add('paint', box(0.08, 0.06, 0.9), 4.92, 0.61, 1.6, { c: tint('#1d1d20') });
  add('paint', box(0.18, 0.05, 0.26), 5.0, 0.605, 2.15, { c: tint('#2a2a2e') });
  add('paint', cyl(0.07, 0.06, 0.1, 10), 5.02, 0.63, 1.0, { c: tint('#e9e6df') });
  add('paint', sph(0.1, 8, 6), 5.02, 0.75, 1.0, { c: tint('#4c8a4a') });
  add('paint', soft(0.05, 0.84, 1.46, 0.012), 5.12, 1.38, 1.6, { c: tint('#111114') });
  mesh(new THREE.PlaneGeometry(1.38, 0.76).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0a0c10', emissive: '#ffffff', emissiveMap: tvTex(), emissiveIntensity: 0.55, roughness: 0.2 }), 5.092, 1.38, 1.6);
  solid(4.99, 1.6, 0.82, 0.22, 0, 0.6);
  // a floor lamp by the window, two big plants in the corners
  add('metal', cyl(0.14, 0.14, 0.02, 14), 1.85, 0.01, 4.2, { c: tint('#2a2a2e') });
  add('metal', cyl(0.014, 0.014, 1.5, 8), 1.85, 0.77, 4.2, { c: tint('#2a2a2e') });
  add('fabric', cyl(0.15, 0.2, 0.3, 16), 1.85, 1.62, 4.2, { c: tint('#efe6d6') });
  add('bulb', sph(0.04, 8, 6), 1.85, 1.5, 4.2);
  post(1.85, 4.2, 0.16);
  const plant = (cx, cz, pot, leaves = 8) => {
    add('paint', cyl(0.2, 0.15, 0.42, 14), cx, 0.21, cz, { c: pot });
    add('paint', cyl(0.18, 0.18, 0.02, 14), cx, 0.42, cz, { c: tint('#3a2a1e') });
    add('paint', cyl(0.02, 0.028, 0.5, 6), cx, 0.67, cz, { c: tint('#4a5a30') });
    for (let k = 0; k < leaves; k++) {
      const a = (k / leaves) * Math.PI * 2 + r() * 0.4, len = 0.26 + r() * 0.08;
      add('paint', squash(sph(0.17, 8, 6), 1, 0.22, 2.0), cx + Math.sin(a) * len, 0.72 + k * 0.045, cz + Math.cos(a) * len, { c: tint(k % 2 ? '#3f7a3c' : '#2f6a36'), ry: a, pitch: -0.5 - r() * 0.3 });
    }
    post(cx, cz, 0.28);
  };
  plant(4.75, 4.3, tint('#b9654a'));
  plant(-4.85, 4.35, tint('#e9e6df'));
  add('bulb', cyl(0.22, 0.26, 0.07, 18), 3.4, HT - 0.04, 1.9);                            // the living-room light
  add('metal', cyl(0.27, 0.27, 0.02, 18), 3.4, HT - 0.01, 1.9, { c: tint('#c9ccd1') });
  picture('z', RIGHT, -0.5, 1.5, 0.75, 0.95, -1, 2, '#e9e6df');

  // ---------- dining corner: table for four, sideboard under two pictures, the bookshelf by the door ----------
  add('wood', box(1.6, 0.05, 0.9), -3.4, 0.74, 2.5, { c: oak });
  add('wood', box(1.4, 0.08, 0.72), -3.4, 0.68, 2.5, { c: walnut });
  for (const [dx, dz] of [[-0.7, -0.36], [0.7, -0.36], [-0.7, 0.36], [0.7, 0.36]]) add('wood', box(0.07, 0.72, 0.07), -3.4 + dx, 0.36, 2.5 + dz, { c: walnut });
  add('paint', cyl(0.05, 0.04, 0.26, 10), -3.65, 0.9, 2.5, { c: white });
  for (let k = 0; k < 5; k++) add('paint', sph(0.035, 6, 5), -3.65 + Math.sin(k * 1.3) * 0.07, 1.08 + (k % 2) * 0.03, 2.5 + Math.cos(k * 1.3) * 0.07, { c: tint(k % 2 ? '#e3698f' : '#f2c230') });
  add('paint', squash(sph(0.17, 10, 6), 1, 0.32, 1), -3.1, 0.78, 2.5, { c: tint('#e9e6df') });
  for (const [dx, dz, c] of [[-0.05, -0.04, '#e8842a'], [0.06, 0.03, '#7cb342'], [0, 0.07, '#e8842a']]) add('paint', sph(0.05, 8, 6), -3.1 + dx, 0.86, 2.5 + dz, { c: tint(c) });
  solid(-3.4, 2.5, 0.8, 0.45, 0, 0.8);
  const chair = (cx, cz, ry, pad) => {
    const put = frame(cx, cz, ry);
    put('wood', box(0.44, 0.04, 0.44), 0, 0.45, 0, walnut);
    put('fabric', soft(0.4, 0.05, 0.4, 0.02), 0, 0.49, 0, pad);
    for (const sx of [-0.19, 0.19]) put('wood', box(0.03, 0.92, 0.03), sx, 0.46, -0.2, walnut);
    put('wood', soft(0.42, 0.3, 0.03, 0.01), 0, 0.76, -0.2, walnut);
    for (const [sx, sz] of [[-0.19, 0.19], [0.19, 0.19]]) put('wood', box(0.03, 0.45, 0.03), sx, 0.225, sz, walnut);
    solid(cx, cz, 0.23, 0.23, ry, 0.9);
  };
  for (const x of [-3.9, -2.9]) { chair(x, 1.8, 0, tint('#6f7f8c')); chair(x, 3.2, Math.PI, tint('#6f7f8c')); }
  // the sideboard under the window-less front wall, with the pair of pictures
  add('wood', box(1.5, 0.78, 0.42), -3.75, 0.44, 4.49, { c: oak });
  add('counter', box(1.54, 0.03, 0.46), -3.75, 0.845, 4.49, { c: tint('#efece6') });
  for (const dx of [-0.5, 0, 0.5]) { add('wood', box(0.46, 0.62, 0.02), -3.75 + dx, 0.44, 4.27, { c: tint('#d9b98a') }); add('metal', box(0.012, 0.1, 0.012), -3.75 + dx + 0.18, 0.44, 4.258, { c: tint('#c9ccd1') }); }
  for (const dx of [-0.65, 0.65]) add('metal', cyl(0.02, 0.02, 0.1, 8), -3.75 + dx, 0.05, 4.49, { c: tint('#2a2a2e') });
  add('paint', cyl(0.07, 0.05, 0.22, 10), -4.2, 0.97, 4.49, { c: tint('#2f4a5a') });
  for (const [dy, c] of [[0.88, '#b53a2e'], [0.91, '#2f4f7f'], [0.94, '#e0c36a']]) add('paint', box(0.22, 0.03, 0.16), -3.35, dy, 4.49, { c: tint(c), ry: 0.1 });
  solid(-3.75, 4.49, 0.75, 0.21, 0, 0.9);
  picture('x', FRONT, -4.1, 1.55, 0.5, 0.62, -1, 0, '#2a2a2e');
  picture('x', FRONT, -3.4, 1.55, 0.5, 0.62, -1, 1, '#2a2a2e');
  picture('z', LEFT, 1.05, 1.5, 0.42, 1.0, 1, 3, '#e9e6df');
  // bookshelf: back, sides, five shelves, rows of books, a plant and a box
  add('wood', box(1.8, 2.0, 0.02), -1.8, 1.0, IZ - 0.01, { c: oak });
  for (const dx of [-0.9, 0.9]) add('wood', box(0.025, 2.0, 0.32), -1.8 + dx, 1.0, 4.54, { c: oak });
  const palette = ['#b53a2e', '#2f4f7f', '#e0c36a', '#3a7d5a', '#2b2b30', '#e8e2d4', '#8a5a3a', '#5b3f78', '#c66b3d'];
  [0.05, 0.5, 0.95, 1.4, 1.85].forEach((sy, si) => {
    add('wood', box(1.76, 0.025, 0.3), -1.8, sy, 4.54, { c: oak });
    if (si === 4) return;
    let x = -2.66;
    const fill = si === 2 ? 0.55 : 0.8 + r() * 0.15;
    while (x < -2.66 + 1.7 * fill) {
      const bw = 0.025 + r() * 0.03, bh = 0.18 + r() * 0.1;
      add('paint', box(bw, bh, 0.2), x + bw / 2, sy + 0.0125 + bh / 2, 4.55, { c: tint(palette[Math.floor(r() * palette.length)]), ry: r() < 0.1 ? 0.12 : 0 });
      x += bw + 0.004;
    }
    if (si === 2) { add('paint', cyl(0.06, 0.05, 0.1, 10), -1.5, sy + 0.065, 4.55, { c: tint('#c7c1b5') }); add('paint', sph(0.09, 8, 6), -1.5, sy + 0.17, 4.55, { c: tint('#3f7a3c') }); add('paint', box(0.3, 0.2, 0.22), -1.1, sy + 0.1125, 4.55, { c: tint('#d9b98a') }); }
  });
  add('paint', box(0.26, 0.22, 0.2), -2.4, 1.86 + 0.11 + 0.0125, 4.55, { c: tint('#6f7f8c') });
  add('paint', sph(0.1, 8, 6), -1.6, 1.86 + 0.1 + 0.0125, 4.55, { c: tint('#e9e6df') });
  solid(-1.8, 4.54, 0.9, 0.16, 0, 2.0);
  // the dining pendant: a drum shade over the table
  add('metal', cyl(0.004, 0.004, HT - 2.05, 6), -3.4, 2.05 + (HT - 2.05) / 2, 2.5, { c: tint('#2a2a2e') });
  add('fabric', cyl(0.26, 0.26, 0.2, 18), -3.4, 1.95, 2.5, { c: tint('#e7ded0') });
  add('bulb', sph(0.04, 8, 6), -3.4, 1.84, 2.5);

  // ---------- the open kitchen: an L of counters, the fridge, the island with two stools ----------
  const lacquer = tint('#e4e1da'), front = tint('#efece5'), kick = tint('#3a3a3e'), quartz = tint('#efece6'), inox = tint('#c5c9cd'), black = tint('#1d1d20');
  const KB = BACK + T / 2; // the back wall's inner face
  add('paint', box(3.39, 0.76, 0.56), 2.945, 0.48, KB + 0.3, { c: lacquer });           // base run along the back wall
  add('paint', box(3.39, 0.1, 0.5), 2.945, 0.05, KB + 0.27, { c: kick });
  for (const x of [1.55, 2.15, 2.75, 3.35, 3.95]) {
    add('paint', box(0.56, 0.7, 0.02), x, 0.49, KB + 0.59, { c: front });
    add('metal', box(0.14, 0.012, 0.012), x, 0.8, KB + 0.605, { c: tint('#c9ccd1') });
  }
  add('counter', box(3.39, 0.04, 0.62), 2.945, 0.88, KB + 0.32, { c: quartz });
  add('paint', box(0.56, 0.76, 2.7), IX - 0.28, 0.48, -3.35, { c: lacquer });            // base run along the right wall
  add('paint', box(0.5, 0.1, 2.7), IX - 0.25, 0.05, -3.35, { c: kick });
  for (const z of [-3.75, -2.35]) {
    add('paint', box(0.02, 0.7, 0.56), IX - 0.57, 0.49, z, { c: front });
    add('metal', box(0.012, 0.012, 0.14), IX - 0.585, 0.8, z, { c: tint('#c9ccd1') });
  }
  add('paint', box(0.02, 0.7, 0.58), IX - 0.57, 0.49, -3.05, { c: black });               // the oven door
  add('paint', box(0.015, 0.3, 0.5), IX - 0.585, 0.5, -3.05, { c: tint('#55606a') });
  add('metal', box(0.02, 0.02, 0.5), IX - 0.6, 0.78, -3.05, { c: tint('#c9ccd1') });
  add('counter', box(0.62, 0.04, 2.7), IX - 0.32, 0.88, -3.35, { c: quartz });
  add('tile', box(3.39, 0.52, 0.01), 2.945, 1.16, KB + 0.005, { c: WHITE });              // backsplash
  add('tile', box(0.01, 0.52, 2.7), IX - 0.005, 1.16, -3.35, { c: WHITE });
  solid(2.945, KB + 0.3, 1.7, 0.3); solid(IX - 0.28, -3.35, 0.3, 1.35);
  // upper cabinets, the hood over the stove
  for (const [x, w] of [[1.775, 1.05], [4.12, 1.04]]) { add('paint', box(w, 0.7, 0.35), x, 1.85, KB + 0.175, { c: lacquer }); add('metal', box(0.012, 0.14, 0.012), x + w / 2 - 0.08, 1.6, KB + 0.355, { c: tint('#c9ccd1') }); }
  for (const [z, d] of [[-4.075, 1.25], [-2.325, 0.65]]) add('paint', box(0.35, 0.7, d), IX - 0.175, 1.85, z, { c: lacquer });
  add('metal', box(0.5, 0.08, 0.8), IX - 0.25, 1.52, -3.05, { c: inox });
  add('metal', box(0.3, 0.6, 0.3), IX - 0.15, 1.9, -3.05, { c: inox });
  // the stove on the right counter, the sink under the window
  add('paint', box(0.56, 0.012, 0.6), IX - 0.31, 0.905, -3.05, { c: black });
  for (const [dx, dz] of [[-0.14, -0.15], [0.14, -0.15], [-0.14, 0.15], [0.14, 0.15]]) add('paint', cyl(0.07, 0.07, 0.01, 14), IX - 0.31 + dx, 0.912, -3.05 + dz, { c: tint('#3a3a3e') });
  for (const dz of [-0.2, 0.2]) add('metal', box(0.8, 0.015, 0.04), 3.0, 0.905, KB + 0.32 + dz, { c: inox });
  for (const dx of [-0.38, 0.38]) add('metal', box(0.04, 0.015, 0.44), 3.0 + dx, 0.905, KB + 0.32, { c: inox });
  add('paint', box(0.72, 0.01, 0.36), 3.0, 0.902, KB + 0.32, { c: tint('#5c6168') });
  add('metal', cyl(0.014, 0.014, 0.28, 8), 3.0, 1.04, KB + 0.1, { c: inox });
  add('metal', box(0.025, 0.025, 0.2), 3.0, 1.17, KB + 0.2, { c: inox });
  // small appliances and a few things on the counters
  add('paint', box(0.48, 0.28, 0.36), 4.3, 1.04, KB + 0.3, { c: tint('#2b2b2f') });
  add('paint', box(0.3, 0.2, 0.01), 4.24, 1.04, KB + 0.485, { c: tint('#55606a') });
  add('paint', cyl(0.08, 0.07, 0.2, 12), 1.6, 1.0, KB + 0.3, { c: tint('#e9e9ea') });
  add('paint', box(0.03, 0.12, 0.03), 1.7, 1.02, KB + 0.3, { c: tint('#2b2b2f') });
  add('wood', box(0.3, 0.015, 0.22), 2.3, 0.9075, KB + 0.3, { c: oak });
  for (const [x, c] of [[1.2, '#e9e9ea'], [1.32, '#3b7a46']]) add('paint', cyl(0.035, 0.03, 0.14, 8), x + 0.9, 0.97, KB + 0.42, { c: tint(c) });
  // the fridge at the left end of the run
  add('paint', soft(0.74, 1.86, 0.72, 0.03), 0.875, 0.95, KB + 0.36, { c: tint('#d3d6d9') });
  add('paint', box(0.75, 0.01, 0.73), 0.875, 1.28, KB + 0.36, { c: tint('#55606a') });
  for (const y of [0.98, 1.5]) add('metal', box(0.02, 0.44, 0.02), 1.15, y, KB + 0.74, { c: tint('#c9ccd1') });
  solid(0.875, KB + 0.36, 0.38, 0.37, 0, 2.0);
  // a wall clock over the fridge
  add('paint', cyl(0.15, 0.15, 0.015, 20).rotateX(Math.PI / 2), 0.875, 2.35, KB + 0.01, { c: tint('#1d1d20') });
  add('paint', cyl(0.135, 0.135, 0.016, 20).rotateX(Math.PI / 2), 0.875, 2.35, KB + 0.012, { c: white });
  add('paint', box(0.012, 0.1, 0.01), 0.875, 2.39, KB + 0.021, { c: black });
  add('paint', box(0.07, 0.012, 0.01), 0.905, 2.35, KB + 0.021, { c: black });
  // the island facing the living room, two stools on its far side
  add('paint', box(1.6, 0.8, 0.8), 2.6, 0.45, -1.6, { c: tint('#4b5a66') });
  add('paint', box(1.5, 0.1, 0.7), 2.6, 0.05, -1.6, { c: kick });
  add('counter', box(1.72, 0.05, 0.92), 2.6, 0.875, -1.6, { c: quartz });
  add('wood', box(0.35, 0.015, 0.25), 2.2, 0.9075, -1.75, { c: oak, ry: 0.3 });
  add('paint', squash(sph(0.15, 10, 6), 1, 0.32, 1), 3.0, 0.94, -1.6, { c: tint('#2f4a5a') });
  for (const [dx, dz, c] of [[-0.05, -0.04, '#f2c230'], [0.06, 0.03, '#e8842a'], [0, 0.07, '#7cb342']]) add('paint', sph(0.05, 8, 6), 3.0 + dx, 1.0, -1.6 + dz, { c: tint(c) });
  for (const dx of [-0.1, 0.1]) add('paint', cyl(0.035, 0.03, 0.12, 10), 2.55 + dx, 0.96, -1.45, { c: tint('#dfe6ec') });
  solid(2.6, -1.6, 0.86, 0.46);
  for (const x of [2.25, 2.95]) {
    add('metal', cyl(0.17, 0.17, 0.02, 16), x, 0.01, -0.92, { c: tint('#2a2a2e') });
    add('metal', cyl(0.022, 0.022, 0.64, 8), x, 0.33, -0.92, { c: tint('#2a2a2e') });
    add('fabric', cyl(0.18, 0.18, 0.06, 16), x, 0.68, -0.92, { c: tint('#2b2d33') });
    post(x, -0.92, 0.2, 0.8);
    add('metal', cyl(0.004, 0.004, HT - 2.0, 6), x, 2.0 + (HT - 2.0) / 2, -1.6, { c: tint('#2a2a2e') });  // pendants over the island
    add('paint', cyl(0.09, 0.12, 0.2, 16), x, 1.9, -1.6, { c: black });
    add('bulb', sph(0.035, 8, 6), x, 1.77, -1.6);
  }
  // the laundry niche beside the bedroom: washing machine, a shelf of bottles, a broom
  add('paint', box(0.6, 0.85, 0.6), 0.05, 0.43, KB + 0.3, { c: tint('#eceae6') });
  add('paint', cyl(0.21, 0.21, 0.02, 20).rotateX(Math.PI / 2), 0.05, 0.5, KB + 0.61, { c: tint('#2a2f36') });
  add('paint', cyl(0.16, 0.16, 0.022, 16).rotateX(Math.PI / 2), 0.05, 0.5, KB + 0.612, { c: tint('#4b5563') });
  add('paint', box(0.5, 0.08, 0.02), 0.05, 0.78, KB + 0.61, { c: tint('#55606a') });
  add('wood', box(0.72, 0.025, 0.3), 0.05, 1.6, KB + 0.15, { c: oak });
  for (const [dx, c] of [[-0.2, '#2d6fd6'], [-0.05, '#3b7a46'], [0.12, '#e9e9ea']]) add('paint', box(0.1, 0.25, 0.08), 0.05 + dx, 1.74, KB + 0.15, { c: tint(c) });
  add('wood', cyl(0.012, 0.012, 1.3, 6), 0.42, 0.65, KB + 0.2, { c: oak, roll: 0.12 });
  solid(0.05, KB + 0.3, 0.32, 0.32);

  // ---------- light: two daylight fills (off at night), the bulbs that glow at night ----------
  const fills = [
    { light: new THREE.PointLight('#fff2dd', 0, 10, 1.6), base: 14, at: [3.0, HT - 0.4, 0.6] },
    { light: new THREE.PointLight('#fff2dd', 0, 9, 1.6), base: 10, at: [-2.4, HT - 0.4, 2.4] },
  ];
  for (const f of fills) { f.light.position.set(f.at[0], FY + f.at[1], f.at[2]); room.add(f.light); }

  const built = batch.build(room, {});
  for (const list of Object.values(built)) for (const m of list) { m.castShadow = false; m.receiveShadow = false; }
  room.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // the floor's height everywhere inside the footprint (the bedroom already has its own pad)
  net.addPad({ ...toWorld(0, 0), hx: hw, hz: hd, yaw, h: FY, top: 0, blend: 0, name: 'home floor' });

  // ---------- night: the windows go dark blue and the daylight fills fade; tick reads the scene's fog ----------
  const glass = materials.glass;
  const gDay = new THREE.Color('#dbe7f2'), gNight = new THREE.Color('#0d1730'), eDay = new THREE.Color('#bcd5ee'), eNight = new THREE.Color('#101a3a');
  const fogDay = new THREE.Color('#e7d8c2'), fogNight = new THREE.Color('#0b1020');
  let night = -1;
  const setNight = (n) => {
    n = clamp(n, 0, 1);
    night = n;
    glass.color.copy(gDay).lerp(gNight, n);
    glass.emissive.copy(eDay).lerp(eNight, n);
    glass.emissiveIntensity = 0.7 - 0.3 * n;
    const k = (1 - n) ** 1.5;
    for (const f of fills) { f.light.intensity = f.base * k; f.light.visible = n < 0.97; }
  };
  setNight(0);
  const tick = () => {
    const f = room.parent?.parent?.fog?.color;
    if (!f) return;
    const n = clamp((fogDay.g - f.g) / (fogDay.g - fogNight.g), 0, 1);
    if (Math.abs(n - night) > 0.003) setNight(n);
  };

  // ---------- what the game points at ----------
  R.inside = inside; // the bedroom's test now covers the whole house, so the interior shows wherever Nehorai is inside
  const lamp = (lx, ly, lz) => ({ ...toWorld(lx, lz), y: FY + ly, inside: true });
  home.interior = {
    group: room, floorY: FY, inside,
    door: { ...toWorld(0, 4.0), y: FY },
    outside: { ...toWorld(0, hd + 1.3), yaw },
    living: { ...toWorld(1.2, 1.6), yaw: yaw + Math.PI / 2 },
    kitchen: toWorld(3.0, -3.0),
    materials,
    lamps: [lamp(3.4, HT - 0.4, 1.9), lamp(-3.4, 1.9, 2.5), lamp(2.6, 2.0, -1.6)],
    emissives: [MAT.bulb],
    setNight, tick,
  };
  return home.interior;
}
