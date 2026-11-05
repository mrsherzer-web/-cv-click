// "The pub in Katzir" (chapter five), invented for the game: a low dark building on the north side of
// the main street's last stretch, by the lookout. A walkable shell with a real doorway (no teleport):
// a bar along the back wall with a backlit bottle shelf, stools on a raised step, round tables, a
// dance floor with a DJ booth, speakers and a disco ball, pink and blue neon, posters with invented
// names, string lights outside and the 'הפאב' sign. The roof lifts away while the camera is inside,
// like the bank's. The same module dresses Katzir for the night: lamp heads that glow, soft halos and
// light pools at every street lamp, pink neon on two houses and the bus stop, string lights along the
// plaza railing. Nothing here is a real place or business.
import * as THREE from 'three';
import { rng } from '../core/math.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex, SIGN_FONT } from './textures.js';
import { yawFacing } from './katzir.js';
import * as P from './props.js';

const W = 14, D = 12, H = 4.2;             // the hall: width (local x), depth (local z), wall height; +z is the street
const S = 266, SIDE = 1, DIST = 15;        // where it stands along the main road: north side, 15 m from the centerline
const DOOR = 1.6;                          // the doorway gap in the front wall
const STEP = { z: -2.6, hz: 0.7, hx: 6.0, h: 0.25 }; // the raised step the stools stand on, in front of the counter
const DANCE = { x: -3.8, z: 1.9, half: 2.5 };        // the dance floor
const PARK = { x: -13.4, z: 0.4, hx: 4.4, hz: 6.65 }; // the parking pad beside the west wall
const WALL = '#3a2f2a';
const EMIT = 1.4;                          // the emissive intensity main.js gives every entry of `emissives` at night

let site = null;                           // the frame computed in layout(), used by build()

const canvas = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// floor planks, running along u, light enough to tint
function plankTexture() {
  const r = rng(515);
  const t = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#c8a27a'; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let i = 0; i < rows; i++) {
      const l = 58 + r() * 14;
      g.fillStyle = `hsl(${26 + r() * 8}, ${38 + r() * 10}%, ${l}%)`;
      g.fillRect(0, i * rh + 1, w, rh - 2);
      for (let k = 0; k < 14; k++) { // grain
        g.strokeStyle = `rgba(70,40,20,${0.08 + r() * 0.12})`; g.lineWidth = 1;
        const y = i * rh + 2 + r() * (rh - 4);
        g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + (r() - 0.5) * 2); g.stroke();
      }
      const seam = r() * w; g.fillStyle = 'rgba(40,20,10,0.5)'; g.fillRect(seam, i * rh, 2, rh); // a plank end
      g.fillStyle = 'rgba(40,20,10,0.55)'; g.fillRect(0, i * rh, w, 1.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// glossy black and ivory checker for the dance floor
function checkerTexture() {
  const t = canvas(64, 64, (g, w, h) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#15161a' : '#e9e4da'; g.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(0, h / 2, w, 1); g.fillRect(w / 2, 0, 1, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// a soft round halo for lamp glows and light pools (white; the vertex color tints it)
function glowTexture() {
  const t = canvas(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// the neon sign over the door: 'הפאב' as a pink tube with a blue line under it
function signTexture() {
  return canvas(512, 176, (g, w) => {
    g.fillStyle = '#120a10'; g.fillRect(0, 0, w, 176);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold 118px ${SIGN_FONT}`;
    g.shadowColor = '#ff4fb0'; g.shadowBlur = 30; g.fillStyle = '#ff4fb0'; g.fillText('הפאב', w / 2, 76);
    g.shadowBlur = 12; g.fillStyle = '#ffd6ec'; g.fillText('הפאב', w / 2, 76);
    g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#ff8ccf'; g.strokeText('הפאב', w / 2, 76);
    g.font = `600 30px ${SIGN_FONT}`; g.shadowColor = '#7fd1ff'; g.shadowBlur = 14; g.fillStyle = '#9fdcff'; g.fillText('בר · מוזיקה · קציר', w / 2, 150);
  });
}

// eight 128×256 cells: posters with invented names, the chalkboard, the menu board, the DJ front, the toilets sign
function posterAtlas() {
  const CW = 128, CH = 256, COLS = 4, Wc = 512, Hc = 512;
  const cells = [
    { bg: ['#ff6a3d', '#7a1f5c'], ink: '#fff3e6', lines: [['ליל שישי', 30, 900], ['די.ג׳יי נועם', 24, 700], ['היפ-הופ עד הבוקר', 15, 600], ['23:00', 26, 900]], deco: 'disc' },
    { bg: ['#1d4f91', '#0b1a33'], ink: '#ffe28a', lines: [['ערב קריוקי', 30, 900], ['כל יום חמישי', 18, 600], ['הכניסה חופשית', 16, 600], ['21:00', 26, 900]], deco: 'mic' },
    { bg: ['#2f6b3c', '#10261a'], ink: '#f3e6cc', lines: [['הופעה חיה', 30, 900], ['להקת ההר', 24, 700], ['מוצ״ש בפאב', 16, 600], ['21:30', 26, 900]], deco: 'guitar' },
    { bg: ['#f2c230', '#b8731f'], ink: '#2b1a10', lines: [['הפי אוור', 30, 900], ['שתייה 1+1', 24, 700], ['כל ערב', 16, 600], ['18:00–20:00', 20, 900]], deco: 'glass' },
    { bg: ['#1d1a17', '#1d1a17'], ink: '#f3e6cc', chalk: true, lines: [['היום בפאב', 26, 900], ['בירה מהחבית', 18, 600], ['קוקטיילים 40', 18, 600], ['צ׳יפס גדול 22', 18, 600], ['בואו בשמחה', 16, 600]] },
    { bg: ['#120a10', '#120a10'], ink: '#ff8ccf', chalk: true, lines: [['תפריט', 28, 900], ['בירה 28', 18, 600], ['ערק עם אשכוליות 32', 15, 600], ['קוקטייל הבית 44', 15, 600], ['טוסט 26', 18, 600]] },
    { bg: ['#1c1d22', '#0e0f12'], ink: '#7fd1ff', lines: [['DJ', 44, 900], ['הלילה', 20, 600]], deco: 'wave' },
    { bg: ['#2b2f36', '#2b2f36'], ink: '#f3efe6', lines: [['שירותים', 24, 900], ['→', 40, 900]] },
  ];
  const tex = canvas(Wc, Hc, (g) => {
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    cells.forEach((c, i) => {
      const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
      const grd = g.createLinearGradient(x, y, x, y + CH);
      grd.addColorStop(0, c.bg[0]); grd.addColorStop(1, c.bg[1]);
      g.fillStyle = grd; g.fillRect(x, y, CW, CH);
      if (c.chalk) { g.strokeStyle = 'rgba(243,230,204,0.7)'; g.lineWidth = 3; g.strokeRect(x + 7, y + 7, CW - 14, CH - 14); }
      const cx = x + CW / 2;
      if (c.deco === 'disc') { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(cx, y + 150, 44, 0, Math.PI * 2); g.fill(); g.fillStyle = c.bg[1]; g.beginPath(); g.arc(cx, y + 150, 8, 0, Math.PI * 2); g.fill(); }
      if (c.deco === 'mic') { g.fillStyle = 'rgba(255,226,138,0.35)'; g.beginPath(); g.arc(cx, y + 140, 18, 0, Math.PI * 2); g.fill(); g.fillRect(cx - 4, y + 155, 8, 40); }
      if (c.deco === 'guitar') { g.fillStyle = 'rgba(243,230,204,0.25)'; g.beginPath(); g.ellipse(cx, y + 160, 22, 28, 0, 0, Math.PI * 2); g.fill(); g.fillRect(cx - 3, y + 90, 6, 60); }
      if (c.deco === 'glass') { g.fillStyle = 'rgba(43,26,16,0.35)'; g.beginPath(); g.moveTo(cx - 22, y + 120); g.lineTo(cx + 22, y + 120); g.lineTo(cx, y + 160); g.closePath(); g.fill(); g.fillRect(cx - 2, y + 160, 4, 26); g.fillRect(cx - 14, y + 186, 28, 4); }
      if (c.deco === 'wave') { g.strokeStyle = 'rgba(127,209,255,0.6)'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= CW; k += 4) g.lineTo(x + k, y + 190 + Math.sin(k * 0.25) * 14); g.stroke(); }
      g.fillStyle = c.ink;
      const n = c.lines.length, top = y + (c.deco ? 36 : 44), gap = c.deco ? 30 : 38;
      c.lines.forEach(([text, size, weight], k) => {
        g.font = `${weight} ${size}px ${SIGN_FONT}`;
        g.fillText(text, cx, top + k * gap + size * 0.1);
      });
    });
  });
  const uv = (i) => { const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH; return [x / Wc, 1 - (y + CH) / Hc, (x + CW) / Wc, 1 - y / Hc]; };
  return { tex, uv };
}

// a plane whose texture coordinates pick one atlas cell
function cellPlane(w, h, [u0, v0, u1, v1]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}

export function layout(ctx) {
  const { net, places } = ctx;
  const road = places.mainRoad;
  const p = road.at(S);
  const cx = p.x + p.nx * SIDE * DIST, cz = p.z + p.nz * SIDE * DIST;
  const yaw = Math.atan2(-p.nx * SIDE, -p.nz * SIDE); // the facade (local +z) faces the street
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const toWorld = (lx, lz) => ({ x: cx + lx * cs + lz * sn, z: cz - lx * sn + lz * cs });
  const toLocal = (x, z) => { const dx = x - cx, dz = z - cz; return { x: dx * cs - dz * sn, z: dx * sn + dz * cs }; };
  const floorY = p.h + road.curb;                      // level with the sidewalk in front of the door
  // the building and its forecourt, flat at the floor level, out to the sidewalk's outer edge
  const b = toWorld(0, 0.2);
  net.addPad({ x: b.x, z: b.z, hx: W / 2 + 0.6, hz: D / 2 + 0.85, yaw, h: p.h, top: road.curb, blend: 5, name: 'pub' });
  // the parking beside it, level with the street where the cars come in (the road drops toward the lookout)
  const pc = toWorld(PARK.x, PARK.z), q = road.nearest(pc.x, pc.z);
  const parkY = q.h + road.curb;
  net.addPad({ x: pc.x, z: pc.z, hx: PARK.hx, hz: PARK.hz, yaw, h: q.h, top: road.curb, blend: 5, name: 'pub parking' });
  site = { cx, cz, yaw, cs, sn, toWorld, toLocal, floorY, parkY, road };
}

export function build(ctx) {
  const { group, M, cols, places, net, terrain } = ctx;
  if (!site) throw new Error('pub: layout() must run before build()');
  const { cx, cz, yaw, toWorld, toLocal, floorY, parkY, road } = site;
  const r = rng(5151);
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
  // a matrix in the pub's frame: local (lx, ly above the floor, lz), turned by ry
  const at = (lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0) => { const p = toWorld(lx, lz); return mat4(p.x, floorY + ly, p.z, yaw + ry, sx, sy, sz, pitch, roll); };
  const solid = (lx, lz, hx, hz, h, ry = 0, y0 = -1) => { const p = toWorld(lx, lz); cols.addBox(p.x, p.z, hx, hz, yaw + ry, floorY + y0, floorY + h); };
  const post = (lx, lz, rad, h) => { const p = toWorld(lx, lz); cols.addCircle(p.x, p.z, rad, floorY - 1, floorY + h); };

  // ---------- materials of its own (the shared ones stay as they are) ----------
  const woodMat = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.72, vertexColors: true });
  const danceMat = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.3, metalness: 0.15, vertexColors: true });
  const neonPink = new THREE.MeshStandardMaterial({ color: '#c23a88', emissive: '#ff4fb0', emissiveIntensity: 0, roughness: 0.4, vertexColors: true });
  const neonBlue = new THREE.MeshStandardMaterial({ color: '#2f7fc0', emissive: '#3fa9ff', emissiveIntensity: 0, roughness: 0.4, vertexColors: true });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.4, vertexColors: true });
  const backlightMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: '#8a4a1a', emissiveIntensity: 0, roughness: 0.8, vertexColors: true });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#1f2933', emissive: '#5a331a', emissiveIntensity: 0, roughness: 0.2, metalness: 0.5, vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, vertexColors: true, side: THREE.DoubleSide });
  const atlas = posterAtlas();
  const posterMat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.75, vertexColors: true });
  // Katzir's night pieces keep their own two materials, so the lists main.js registers stay disjoint
  const headMat = new THREE.MeshStandardMaterial({ color: '#efe6d2', emissive: '#ffe2a8', emissiveIntensity: 0, roughness: 0.5, vertexColors: true });
  const neonOut = new THREE.MeshStandardMaterial({ color: '#c23a88', emissive: '#ff4fb0', emissiveIntensity: 0, roughness: 0.4, vertexColors: true });
  const wallC = tint(WALL), white = tint('#ffffff'), dark = tint('#1c1d22'), steel = tint('#8d9298');
  const warm = tint('#ffd9a0'), pink = tint('#ff4fb0'), blue = tint('#3fa9ff');
  const dim = (c, k) => c.clone().multiplyScalar(k);

  // a bar from local point a to local point b (sagging cables, neon tubes, rails)
  const beam = (key, mat, ax, ay, az, bx, by, bz, t, color = white) => {
    const A = toWorld(ax, az), B = toWorld(bx, bz);
    const dx = B.x - A.x, dz = B.z - A.z, dy = by - ay, horiz = Math.hypot(dx, dz), len = Math.hypot(horiz, dy);
    const m = mat4((A.x + B.x) / 2, floorY + (ay + by) / 2, (A.z + B.z) / 2, Math.atan2(dx, dz), 1, 1, 1, -Math.atan2(dy, horiz));
    batch.add(key, mat, box(t, t, len), m, { color });
  };
  const tube = (mat, ax, ay, az, bx, by, bz, color = white) => beam(mat === neonPink ? 'neonPink' : 'neonBlue', mat, ax, ay, az, bx, by, bz, 0.05, color);
  // a wall piece from (x0, z0) to (x1, z1); only pieces that start at the floor block the way
  const seg = (x0, z0, x1, z1, h = H, y = 0, thick = 0.3, color = wallC) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    batch.add('plaster', M.plaster, box(thick, h, len), at((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, ry), { color, uv: 'world', uvScale: 0.3 });
    if (y === 0) { const a = toWorld(x0, z0), b = toWorld(x1, z1); cols.addSegment(a.x, a.z, b.x, b.z, thick, floorY - 1, floorY + h); }
  };
  // a soft halo: three crossed quads (seen from any side) at a point, plus a pool on the ground when asked
  const halo = (lx, ly, lz, size, color, ry = 0) => {
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) batch.add('glow', glowMat, new THREE.PlaneGeometry(size, size), at(lx, ly, lz, ry + a), { color });
  };
  const pool = (lx, ly, lz, size, color) => batch.add('glow', glowMat, new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), at(lx, ly, lz), { color });
  // string lights: a sagging cable from a to b with small warm bulbs along it
  const strand = (ax, ay, az, bx, by, bz, sag, bulbs, cableColor = dark) => {
    const N = Math.max(2, bulbs);
    let px = ax, py = ay, pz = az;
    for (let i = 1; i <= N; i++) {
      const t = i / N, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - sag * 4 * t * (1 - t);
      beam('paint', M.paint, px, py, pz, x, y, z, 0.018, cableColor);
      if (i < N) {
        batch.add('bulb', bulbMat, new THREE.SphereGeometry(0.045, 6, 4), at(x, y - 0.06, z), { color: white });
        batch.add('paint', M.paint, cyl(0.012, 0.012, 0.04, 5), at(x, y - 0.02, z), { color: dark });
      }
      px = x; py = y; pz = z;
    }
  };

  // no hillside trees in the footprint, the forecourt or the parking
  ctx.veg = ctx.veg.filter((v) => {
    const l = toLocal(v.x, v.z);
    return !(Math.abs(l.x) < W / 2 + 3 && Math.abs(l.z) < D / 2 + 3) && !(Math.abs(l.x - PARK.x) < PARK.hx + 1.5 && Math.abs(l.z - PARK.z) < PARK.hz + 1.5);
  });

  // ---------- ground: a paved apron over the whole pad, asphalt in the parking ----------
  batch.add('pavers', M.pavers, box(W + 1.2, 0.12, D + 1.7), at(0, -0.06, 0.2), { uv: 'world', uvScale: 0.25 });
  batch.add('asphalt', M.asphalt, box(PARK.hx * 2, 0.12, PARK.hz * 2), at(PARK.x, parkY - floorY - 0.06, PARK.z), { uv: 'world', uvScale: 1 / 7 });
  const slots = [];
  for (const k of [-1, 0, 1]) { // three bays, nose toward the back, white lines between them and a wheel stop each
    const lx = PARK.x + k * 2.7;
    slots.push({ ...toWorld(lx, 1.2), yaw: yaw + Math.PI });
    batch.add('paint', M.paint, box(0.1, 0.012, 5.2), at(lx - 1.35, parkY - floorY + 0.006, 1.2), { color: tint('#e9e9e3') });
    if (k === 1) batch.add('paint', M.paint, box(0.1, 0.012, 5.2), at(lx + 1.35, parkY - floorY + 0.006, 1.2), { color: tint('#e9e9e3') });
    batch.add('paint', M.paint, box(1.6, 0.12, 0.18), at(lx, parkY - floorY + 0.06, -1.1), { color: tint('#8d8a84') });
  }
  // low stone kerb along the parking's far edges, kegs and a dumpster by the wall
  for (const [x0, z0, x1, z1] of [[PARK.x - PARK.hx, -PARK.hz + PARK.z, PARK.x - PARK.hx, PARK.z + PARK.hz - 1], [PARK.x - PARK.hx, PARK.z - PARK.hz, PARK.x + PARK.hx, PARK.z - PARK.hz]]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    batch.add('stone', M.stone, box(0.3, 0.35, len), at((x0 + x1) / 2, parkY - floorY + 0.1, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)), { uv: 'world', uvScale: 0.5, color: tint('#cfc8ba') });
    const a = toWorld(x0, z0), b = toWorld(x1, z1);
    cols.addSegment(a.x, a.z, b.x, b.z, 0.3, parkY - 1, parkY + 0.3);
  }
  for (const [lx, lz] of [[-7.9, -4.6], [-8.4, -5.2], [-7.8, -5.6]]) batch.add('paint', M.paint, cyl(0.2, 0.2, 0.5, 10), at(lx, parkY - floorY + 0.25, lz), { color: steel });
  batch.add('paint', M.paint, box(1.4, 1.1, 0.8), at(-8.2, parkY - floorY + 0.55, -3.3), { color: tint('#2e6b3c') });
  solid(-8.2, -3.3, 0.7, 0.4, 1.2, 0, parkY - floorY - 1);
  solid(-8.1, -5.1, 0.6, 0.7, 0.6, 0, parkY - floorY - 1);
  { // an olive at the parking's back corner
    const t = toWorld(PARK.x - PARK.hx + 1.0, PARK.z - PARK.hz + 1.0);
    ctx.veg.push({ kind: 'olive', x: t.x, y: parkY, z: t.z, s: 0.9 });
    cols.addCircle(t.x, t.z, 0.35, parkY - 1, parkY + 3);
  }

  // ---------- the shell: dark walls, the doorway, windows, a stone base, the parapet ----------
  const hw = W / 2, hd = D / 2, dg = DOOR / 2 + 0.18; // the wall ends leave room for the door frame
  seg(-hw, hd, -dg, hd); seg(dg, hd, hw, hd);                 // front, either side of the door
  seg(-dg, hd, dg, hd, H - 2.5, 2.5);                          // over the door
  seg(-hw, -hd, hw, -hd);                                      // back
  seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd);                // sides
  for (const [x0, z0, x1, z1] of [[-hw, hd, hw, hd], [-hw, -hd, hw, -hd], [-hw, -hd, -hw, hd], [hw, -hd, hw, hd]]) seg(x0, z0, x1, z1, 0.5, H, 0.34, tint('#2e2622')); // parapet
  // the door frame and header, dark steel; the frame edges keep the 1.6 m gap clear
  for (const sx of [-1, 1]) { batch.add('paint', M.paint, box(0.2, 2.5, 0.36), at(sx * (DOOR / 2 + 0.1), 1.25, hd), { color: dark }); solid(sx * (DOOR / 2 + 0.1), hd, 0.1, 0.18, 2.5); }
  batch.add('paint', M.paint, box(DOOR + 0.4, 0.14, 0.36), at(0, 2.43, hd), { color: dark });
  batch.add('paint', M.paint, box(DOOR + 1.2, 0.08, 1.1), at(0, 2.62, hd + 0.5), { color: tint('#2e2622') }); // a thin canopy over the door
  // windows: a warm pane outside (it glows at night), a dark pane inside, frames and sills
  for (const sx of [-4.4, 4.4]) {
    batch.add('window', windowMat, box(1.7, 1.3, 0.04), at(sx, 2.1, hd + 0.16), { color: white });
    batch.add('glass', M.glass, box(1.7, 1.3, 0.04), at(sx, 2.1, hd - 0.16), {});
    for (const dz of [0.17, -0.17]) {
      batch.add('paint', M.paint, box(1.86, 0.08, 0.06), at(sx, 2.79, hd + dz), { color: dark });
      batch.add('paint', M.paint, box(1.86, 0.08, 0.06), at(sx, 1.41, hd + dz), { color: dark });
      for (const ex of [-0.89, 0.89, 0]) batch.add('paint', M.paint, box(0.06, 1.3, 0.06), at(sx + ex, 2.1, hd + dz), { color: dark });
    }
    batch.add('stone', M.stone, box(1.95, 0.08, 0.3), at(sx, 1.4, hd + 0.2), { uv: 'world', uvScale: 0.5, color: tint('#cfc8ba') });
  }
  // a stone base around the outside and the wood wainscot inside
  for (const [x0, z0, x1, z1] of [[-hw - 0.17, hd + 0.17, hw + 0.17, hd + 0.17], [-hw - 0.17, -hd - 0.17, -hw - 0.17, hd + 0.17], [hw + 0.17, -hd - 0.17, hw + 0.17, hd + 0.17], [-hw - 0.17, -hd - 0.17, hw + 0.17, -hd - 0.17]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    batch.add('stone', M.stone, box(0.06, 0.9, len), at((x0 + x1) / 2, 0.45, (z0 + z1) / 2, ry), { uv: 'world', uvScale: 0.5, color: tint('#8a7a68') });
  }
  const iw = hw - 0.15, id = hd - 0.15; // the inner faces of the walls
  for (const [x0, z0, x1, z1] of [[-iw + 0.03, id - 0.03, -dg, id - 0.03], [dg, id - 0.03, iw - 0.03, id - 0.03], [-iw + 0.03, -id + 0.03, -iw + 0.03, id - 0.03], [iw - 0.03, -id + 0.03, iw - 0.03, id - 0.03]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    batch.add('wood', woodMat, box(0.05, 1.1, len), at((x0 + x1) / 2, 0.55, (z0 + z1) / 2, ry), { color: tint('#5a3f2c'), uv: 'world', uvScale: 0.5 });
    batch.add('wood', woodMat, box(0.08, 0.05, len), at((x0 + x1) / 2, 1.12, (z0 + z1) / 2, ry), { color: tint('#8a6a48'), uv: 'world', uvScale: 0.5 });
  }
  // the floor: dark planks, the raised step by the bar, the checkered dance floor with a blue edge
  batch.add('wood', woodMat, box(W - 0.3, 0.024, D - 0.3), at(0, 0, 0), { color: tint('#6e4f36'), uv: 'world', uvScale: 0.5 });
  batch.add('wood', woodMat, box(STEP.hx * 2, STEP.h, STEP.hz * 2), at(0, STEP.h / 2, STEP.z), { color: tint('#4a3426'), uv: 'world', uvScale: 0.5 });
  tube(neonBlue, -STEP.hx, STEP.h - 0.03, STEP.z + STEP.hz - 0.03, STEP.hx, STEP.h - 0.03, STEP.z + STEP.hz - 0.03, blue);
  {
    const sp = toWorld(0, STEP.z);
    net.addPad({ x: sp.x, z: sp.z, hx: STEP.hx, hz: STEP.hz, yaw, h: floorY, top: STEP.h, blend: 0, name: 'pub step' });
  }
  const dh = DANCE.half;
  batch.add('dance', danceMat, box(dh * 2, 0.02, dh * 2), at(DANCE.x, 0.022, DANCE.z), { uv: 'world', uvScale: 1 });
  for (const [x0, z0, x1, z1] of [[-dh, -dh, dh, -dh], [dh, -dh, dh, dh], [dh, dh, -dh, dh], [-dh, dh, -dh, -dh]]) tube(neonBlue, DANCE.x + x0, 0.045, DANCE.z + z0, DANCE.x + x1, 0.045, DANCE.z + z1, blue);

  // ---------- the bar along the back wall ----------
  const BZ = -3.7; // the counter's centre line
  batch.add('wood', woodMat, box(11.6, 1.02, 0.6), at(0, 0.51, BZ), { color: tint('#4a3426'), uv: 'world', uvScale: 0.5 });
  batch.add('wood', woodMat, box(11.9, 0.06, 0.86), at(0, 1.05, BZ + 0.1), { color: tint('#8a6a48'), uv: 'world', uvScale: 0.5 });
  tube(neonPink, -5.9, 0.98, BZ + 0.47, 5.9, 0.98, BZ + 0.47, pink); // the lit lip under the counter top
  beam('paint', M.paint, -5.6, 0.45, BZ + 0.5, 5.6, 0.45, BZ + 0.5, 0.04, steel);   // the foot rail
  solid(0, BZ + 0.05, 5.95, 0.45, 1.1);
  // taps, glasses and a till on the counter
  batch.add('paint', M.paint, cyl(0.06, 0.07, 0.36, 10), at(-1.2, 1.26, BZ - 0.1), { color: steel });
  for (const k of [-1, 0, 1]) batch.add('paint', M.paint, box(0.05, 0.16, 0.05), at(-1.2 + k * 0.1, 1.5, BZ - 0.1, 0, 1, 1, 1, -0.5), { color: k ? dark : tint('#c8352d') });
  for (let i = 0; i < 7; i++) batch.add('paint', M.paint, cyl(0.03, 0.035, 0.13, 8), at(-4.8 + i * 0.35 + (i % 2) * 0.1, 1.145, BZ - 0.15 + (i % 3) * 0.1), { color: tint('#d9e2e8') });
  batch.add('paint', M.paint, box(0.42, 0.22, 0.34), at(3.9, 1.19, BZ - 0.12), { color: dark });
  batch.add('paint', M.paint, box(0.34, 0.2, 0.02), at(3.9, 1.42, BZ - 0.2, 0, 1, 1, 1, -0.3), { color: tint('#1d3c66') });
  // the shelf behind: a backlit panel, three shelves of bottles, cabinets under them, the menu board
  batch.add('backlight', backlightMat, box(9.0, 2.3, 0.06), at(0, 2.05, -id + 0.05), { color: white });
  batch.add('wood', woodMat, box(9.3, 0.06, 0.3), at(0, 1.0, -id + 0.2), { color: tint('#8a6a48'), uv: 'world', uvScale: 0.5 });
  for (const ly of [1.3, 1.9, 2.5]) batch.add('wood', woodMat, box(9.0, 0.04, 0.26), at(0, ly, -id + 0.18), { color: tint('#5a3f2c'), uv: 'world', uvScale: 0.5 });
  const bottleColors = ['#2f6b3a', '#b8731f', '#cfd8dc', '#3b2a22', '#2d5fa8', '#9b2c2c', '#e2b23a'];
  for (const ly of [1.0, 1.3, 1.9, 2.5]) for (let i = 0; i < 10; i++) {
    const lx = -4.2 + i * 0.93 + (r() - 0.5) * 0.3, h = 0.24 + r() * 0.1, c = tint(bottleColors[Math.floor(r() * bottleColors.length)]);
    batch.add('paint', M.paint, cyl(0.03, 0.036, h, 7), at(lx, ly + 0.02 + h / 2, -id + 0.2), { color: c });
    batch.add('paint', M.paint, cyl(0.011, 0.014, 0.08, 5), at(lx, ly + 0.02 + h + 0.04, -id + 0.2), { color: c });
  }
  batch.add('wood', woodMat, box(9.3, 0.9, 0.5), at(0, 0.45, -id + 0.25), { color: tint('#4a3426'), uv: 'world', uvScale: 0.5 });
  solid(0, -id + 0.25, 4.65, 0.25, 1.0);
  batch.add('posters', posterMat, cellPlane(0.8, 1.6, atlas.uv(5)), at(5.8, 2.1, -id + 0.02), {}); // the menu board, by the shelf
  batch.add('posters', posterMat, cellPlane(0.5, 1.0, atlas.uv(7)), at(-6.3, 2.0, -id + 0.02), {}); // 'שירותים' in the corner
  tube(neonPink, -4.6, 3.3, -id + 0.06, 4.6, 3.3, -id + 0.06, pink);
  for (const sx of [-4.6, 4.6]) tube(neonPink, sx, 0.95, -id + 0.06, sx, 3.3, -id + 0.06, pink);
  // eight stools on the step, a gap in the middle where you stand
  const stoolX = [-1.1, -2.4, -3.7, -5.0, 1.1, 2.4, 3.7, 5.0], SZ = -2.75;
  for (const lx of stoolX) {
    batch.add('paint', M.paint, cyl(0.17, 0.17, 0.025, 12), at(lx, STEP.h + 0.012, SZ), { color: dark });
    batch.add('paint', M.paint, cyl(0.025, 0.025, 0.44, 7), at(lx, STEP.h + 0.245, SZ), { color: steel });
    batch.add('paint', M.paint, cyl(0.19, 0.17, 0.07, 12), at(lx, STEP.h + 0.5, SZ), { color: tint('#7a2a2a') });
    post(lx, SZ, 0.2, 1.1);
  }

  // ---------- tables and chairs, the banquette along the east wall ----------
  const tables = [[2.7, 4.3], [5.2, 3.4], [3.0, 1.6], [5.4, 0.6], [3.6, -1.0]];
  const chairAngles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const chairSpot = (t, a, rad = 0.72) => ({ x: t[0] + Math.sin(a) * rad, z: t[1] + Math.cos(a) * rad, yaw: a + Math.PI });
  for (const t of tables) {
    batch.add('wood', woodMat, cyl(0.46, 0.46, 0.04, 18), at(t[0], 0.74, t[1]), { color: tint('#5a3f2c') });
    batch.add('paint', M.paint, cyl(0.045, 0.045, 0.7, 8), at(t[0], 0.37, t[1]), { color: dark });
    batch.add('paint', M.paint, cyl(0.27, 0.3, 0.03, 14), at(t[0], 0.015, t[1]), { color: dark });
    batch.add('paint', M.paint, cyl(0.04, 0.04, 0.16, 8), at(t[0] + 0.12, 0.84, t[1] - 0.1), { color: tint('#f2c230') }); // a candle jar
    post(t[0], t[1], 0.5, 1.0);
    for (const a of chairAngles) {
      const c = chairSpot(t, a);
      batch.add('wood', woodMat, box(0.42, 0.04, 0.42), at(c.x, 0.46, c.z, c.yaw), { color: tint('#5a3f2c') });
      batch.add('wood', woodMat, box(0.42, 0.42, 0.04), at(c.x - Math.sin(c.yaw) * 0.19, 0.69, c.z - Math.cos(c.yaw) * 0.19, c.yaw), { color: tint('#5a3f2c') });
      for (const [ex, ez] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const lx = c.x + ex * Math.cos(c.yaw) + ez * Math.sin(c.yaw), lz = c.z - ex * Math.sin(c.yaw) + ez * Math.cos(c.yaw);
        batch.add('paint', M.paint, box(0.03, 0.46, 0.03), at(lx, 0.23, lz, c.yaw), { color: dark });
      }
      post(c.x, c.z, 0.22, 1.0);
    }
  }
  batch.add('paint', M.paint, box(0.55, 0.45, 6.0), at(iw - 0.3, 0.225, 1.8), { color: tint('#7a2a2a') });
  batch.add('paint', M.paint, box(0.12, 0.6, 6.0), at(iw - 0.08, 0.75, 1.8), { color: tint('#5e1f1f') });
  solid(iw - 0.3, 1.8, 0.3, 3.0, 0.6);
  // posters on the walls, and a blue neon line above the banquette
  batch.add('posters', posterMat, cellPlane(0.8, 1.6, atlas.uv(0)), at(iw - 0.03, 2.2, -4.6, -Math.PI / 2), {});
  batch.add('posters', posterMat, cellPlane(0.8, 1.6, atlas.uv(1)), at(iw - 0.03, 2.3, 2.6, -Math.PI / 2), {});
  batch.add('posters', posterMat, cellPlane(0.8, 1.6, atlas.uv(2)), at(-2.3, 2.1, id - 0.03, Math.PI), {});
  batch.add('posters', posterMat, cellPlane(0.8, 1.6, atlas.uv(3)), at(2.3, 2.1, id - 0.03, Math.PI), {});
  tube(neonBlue, iw - 0.06, 3.2, -id + 0.4, iw - 0.06, 3.2, id - 0.4, blue);
  tube(neonBlue, -iw + 0.06, 3.2, -id + 0.4, -iw + 0.06, 3.2, id - 0.4, blue);
  const innerSignTex = Tex.sign('לילה · מוזיקה · ריקודים', { bg: '#120a10', fg: '#7fd1ff', w: 512, h: 96, size: 56, border: false });
  const innerSignMat = new THREE.MeshStandardMaterial({ map: innerSignTex, emissive: '#ffffff', emissiveMap: innerSignTex, emissiveIntensity: 0, roughness: 0.6 });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), innerSignMat);
    const p = toWorld(iw - 0.04, 0.0);
    m.position.set(p.x, floorY + 2.75, p.z);
    m.rotation.y = yaw - Math.PI / 2;
    group.add(m);
  }

  // ---------- the dance floor's gear: DJ booth, speakers, the truss with par cans, the disco ball ----------
  const BX = -5.6, BZl = DANCE.z;
  batch.add('paint', M.paint, box(0.8, 1.05, 2.2), at(BX, 0.525, BZl), { color: dark });
  batch.add('paint', M.paint, box(0.9, 0.04, 2.3), at(BX, 1.07, BZl), { color: tint('#2a2c33') });
  batch.add('posters', posterMat, cellPlane(0.9, 0.9, atlas.uv(6)), at(BX + 0.41, 0.55, BZl, Math.PI / 2), {});
  tube(neonPink, BX + 0.42, 1.02, BZl - 1.1, BX + 0.42, 1.02, BZl + 1.1, pink);
  for (const dz of [-0.62, 0.62]) { batch.add('paint', M.paint, cyl(0.17, 0.17, 0.03, 16), at(BX, 1.1, BZl + dz), { color: steel }); batch.add('paint', M.paint, cyl(0.03, 0.03, 0.04, 8), at(BX, 1.13, BZl + dz), { color: dark }); }
  batch.add('paint', M.paint, box(0.32, 0.02, 0.22), at(BX, 1.1, BZl), { color: tint('#9aa0a7') });
  batch.add('paint', M.paint, box(0.32, 0.2, 0.015), at(BX - 0.1, 1.2, BZl, 0, 1, 1, 1, 0, 0), { color: tint('#1d3c66') });
  solid(BX, BZl, 0.4, 1.1, 1.1);
  for (const lz of [BZl - 1.85, BZl + 1.85]) { // the two speaker stacks
    batch.add('paint', M.paint, box(0.55, 1.3, 0.5), at(BX - 0.1, 0.65, lz), { color: tint('#16171a') });
    for (const [ly, rad] of [[0.95, 0.16], [0.5, 0.1]]) batch.add('paint', M.paint, cyl(rad, rad, 0.02, 14), at(BX + 0.18, ly, lz, 0, 1, 1, 1, 0, Math.PI / 2), { color: tint('#4a4f57') });
    solid(BX - 0.1, lz, 0.28, 0.25, 1.4);
  }
  // the truss over the dance floor, four par cans with pink and blue lenses, the mirror ball on a rod
  beam('paint', M.paint, DANCE.x, 3.75, DANCE.z - dh, DANCE.x, 3.75, DANCE.z + dh, 0.08, steel);
  for (const [k, mat, c] of [[-1.8, neonPink, pink], [-0.6, neonBlue, blue], [0.6, neonPink, pink], [1.8, neonBlue, blue]]) {
    const lz = DANCE.z + k, tilt = k < 0 ? 0.6 : -0.6;
    batch.add('paint', M.paint, cyl(0.09, 0.09, 0.24, 10), at(DANCE.x, 3.6, lz, 0, 1, 1, 1, Math.PI / 2 + tilt), { color: dark });
    batch.add(mat === neonPink ? 'neonPink' : 'neonBlue', mat, cyl(0.075, 0.075, 0.02, 10), at(DANCE.x + Math.sin(tilt) * 0.0, 3.6 - Math.cos(tilt) * 0.12, lz - Math.sin(tilt) * 0.12, 0, 1, 1, 1, Math.PI / 2 + tilt), { color: c });
    halo(DANCE.x, 3.45, lz, 0.9, dim(c, 0.6));
  }
  batch.add('paint', M.paint, cyl(0.012, 0.012, H - 3.55, 6), at(DANCE.x, (H + 3.55) / 2, DANCE.z), { color: steel });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: '#d8dee6', metalness: 0.7, roughness: 0.25, emissive: '#6f7f96', emissiveIntensity: 0.35, flatShading: true }));
  { const p = toWorld(DANCE.x, DANCE.z); ball.position.set(p.x, floorY + 3.22, p.z); }
  group.add(ball);

  // ---------- pendant lamps: three over the bar, two over the tables ----------
  const pendants = [[-3.6, BZ + 0.1], [0, BZ + 0.1], [3.6, BZ + 0.1], [3.0, 1.6], [5.2, 3.4]];
  for (const [lx, lz] of pendants) {
    batch.add('paint', M.paint, cyl(0.008, 0.008, H - 2.9, 5), at(lx, (H + 2.9) / 2, lz), { color: dark });
    batch.add('paint', M.paint, cyl(0.07, 0.21, 0.2, 12), at(lx, 2.8, lz), { color: tint('#2e2622') });
    batch.add('bulb', bulbMat, new THREE.SphereGeometry(0.05, 8, 6), at(lx, 2.69, lz), { color: white });
    halo(lx, 2.66, lz, 0.9, dim(warm, 0.55));
  }

  // ---------- outside: the sign, string lights, planters, a bench, the chalkboard, a wall lamp ----------
  const signTex = signTexture();
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0, roughness: 0.6 });
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.5), signMat);
    const p = toWorld(0, hd + 0.22);
    sign.position.set(p.x, floorY + 3.45, p.z);
    sign.rotation.y = yaw;
    group.add(sign);
    batch.add('paint', M.paint, box(4.6, 1.7, 0.1), at(0, 3.45, hd + 0.17), { color: tint('#120a10') }); // its backing box
    halo(0, 3.45, hd + 0.4, 5.6, dim(pink, 0.5));
    batch.add('glow', glowMat, new THREE.PlaneGeometry(6.0, 2.6), at(0, 3.45, hd + 0.5), { color: dim(pink, 0.35) });
  }
  tube(neonBlue, -hw + 0.1, H - 0.08, hd + 0.17, hw - 0.1, H - 0.08, hd + 0.17, blue);        // a blue line along the top of the facade
  for (const sx of [-1, 1]) tube(neonPink, sx * (DOOR / 2 + 0.24), 0.1, hd + 0.19, sx * (DOOR / 2 + 0.24), 2.56, hd + 0.19, pink); // pink around the door
  tube(neonPink, -(DOOR / 2 + 0.24), 2.56, hd + 0.19, DOOR / 2 + 0.24, 2.56, hd + 0.19, pink);
  // two slim posts at the sidewalk's edge carry strings of bulbs from the facade corners and across the front
  const PX = 5.4, PZ = hd + 0.95, PH = 3.2;
  for (const sx of [-1, 1]) {
    batch.add('paint', M.paint, cyl(0.035, 0.045, PH, 8), at(sx * PX, PH / 2, PZ), { color: dark });
    batch.add('paint', M.paint, cyl(0.16, 0.18, 0.06, 10), at(sx * PX, 0.03, PZ), { color: dark });
    post(sx * PX, PZ, 0.12, PH);
    strand(sx * hw, H - 0.3, hd, sx * PX, PH, PZ, 0.25, 5);
  }
  strand(-PX, PH, PZ, PX, PH, PZ, 0.55, 20);
  strand(-hw, H - 0.3, hd + 0.05, -2.6, H - 0.3, hd + 0.05, 0.22, 8);
  strand(2.6, H - 0.3, hd + 0.05, hw, H - 0.3, hd + 0.05, 0.22, 8);
  // the wall lamp over the door, the planters with bougainvillea, a bench, the A-frame chalkboard
  batch.add('paint', M.paint, box(0.3, 0.14, 0.3), at(0, 2.86, hd + 0.3), { color: dark });
  batch.add('bulb', bulbMat, new THREE.SphereGeometry(0.06, 8, 6), at(0, 2.78, hd + 0.3), { color: white });
  halo(0, 2.75, hd + 0.35, 1.6, dim(warm, 0.7));
  pool(0, 0.02, hd + 0.6, 5.5, dim(warm, 0.35));
  for (const sx of [-1.9, 1.9]) {
    batch.add('wood', woodMat, box(1.0, 0.55, 0.5), at(sx, 0.275, hd + 0.5), { color: tint('#4a3426'), uv: 'world', uvScale: 0.5 });
    solid(sx, hd + 0.5, 0.5, 0.25, 0.6);
    const t = toWorld(sx, hd + 0.5);
    ctx.veg.push({ kind: 'bush', x: t.x, y: floorY + 0.45, z: t.z, s: 0.5 });
  }
  { const b = toWorld(4.6, hd + 0.55); P.addBench(batch, M, cols, b.x, floorY, b.z, yaw); }
  {
    const bx = -3.4, bz = hd + 0.55;
    for (const s of [-1, 1]) batch.add('posters', posterMat, cellPlane(0.6, 1.0, atlas.uv(4)), at(bx, 0.5, bz + s * 0.17, s > 0 ? 0 : Math.PI, 1, 1, 1, s * 0.22), {});
    for (const ex of [-0.3, 0.3]) for (const s of [-1, 1]) batch.add('wood', woodMat, box(0.04, 1.05, 0.04), at(bx + ex, 0.52, bz + s * 0.19, 0, 1, 1, 1, s * 0.22), { color: tint('#4a3426') });
    solid(bx, bz, 0.35, 0.3, 1.0);
  }
  // a lamp post at the parking corner (its head is one of Katzir's night lights)
  const parkLamp = { x: PARK.x + PARK.hx - 0.6, z: PARK.z + PARK.hz - 0.6 };
  { const t = toWorld(parkLamp.x, parkLamp.z); P.addLamp(batch, M, cols, t.x, parkY, t.z, yaw + Math.PI); }

  // ---------- the roof: one mesh, hidden while the camera is inside ----------
  const roof = new THREE.Group();
  {
    const rb = new Batch();
    const roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, vertexColors: true });
    rb.add('roof', roofMat, box(W + 0.6, 0.3, D + 0.6), at(0, H + 0.15, 0), { color: tint('#4a4542') });
    rb.add('roof', roofMat, box(2.0, 0.9, 1.3), at(4.5, H + 0.75, -2.5), { color: tint('#8a9096') });   // an air unit
    rb.add('roof', roofMat, cyl(0.5, 0.5, 1.2, 12), at(-4.5, H + 0.9, -3.0), { color: tint('#eceae5') }); // a water tank
    rb.add('roof', roofMat, box(0.8, 0.6, 0.8), at(-1.5, H + 0.6, 3.5), { color: tint('#5d636b') });     // a vent
    rb.build(roof, { roof: { cast: true } });
  }
  group.add(roof);

  // ---------- Katzir at night: lamp heads, halos and light pools, pink neon, plaza string lights ----------
  const along = (rd, s, sd, d) => { const p = rd.at(s); return { x: p.x + p.nx * sd * d, z: p.z + p.nz * sd * d, h: p.h, tx: p.tx, tz: p.tz, nx: p.nx * sd, nz: p.nz * sd }; };
  const yardAt = (rd, s) => rd.at(s).h + rd.curb;
  const side = places.sideRoad, plaza = places.plaza;
  const nightLamps = [], heads = [];
  // the glow of a street lamp: an emissive strip under the head, a halo, a pool on the pavement
  const lampHead = (x, y, z, ry, real = false) => {
    const hx = x + Math.sin(ry) * 1.45, hz = z + Math.cos(ry) * 1.45, hy = y + 5.955;
    batch.add('bulb', headMat, box(0.22, 0.03, 0.5), mat4(hx, hy, hz, ry), { color: white });
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) batch.add('glow', glowMat, new THREE.PlaneGeometry(2.2, 2.2), mat4(hx, hy - 0.1, hz, ry + a), { color: dim(warm, 0.7) });
    batch.add('glow', glowMat, new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mat4(hx, y + 0.17, hz), { color: dim(warm, 0.42) });
    heads.push({ x: hx, y: hy, z: hz });
    if (real) nightLamps.push({ x: hx, y: hy - 0.25, z: hz, color: '#ffe2a8' });
  };
  for (const [rd, from, to] of [[road, 18, road.length - 4], [side, 20, side.length]]) {
    for (let s = from, i = 0; s < to; s += 32, i++) {
      const sd = i % 2 ? 1 : -1;
      if (rd === road && sd === -1 && Math.abs(s - 150) < 9) continue; // no post where the side street joins
      const t = along(rd, s, sd, rd.halfSurface - 0.35);
      lampHead(t.x, yardAt(rd, s), t.z, yawFacing(-t.nx, -t.nz), rd === road && (s === 242 || s === 274));
    }
  }
  { // the parking post by the pub
    const t = toWorld(parkLamp.x, parkLamp.z);
    const ry = yaw + Math.PI;
    lampHead(t.x, parkY, t.z, ry, true);
  }
  // pink neon under the roof line of the two houses nearest the pub, one on each side of the street
  const neonHouse = (ls, sd) => {
    const f = along(road, ls, sd, road.halfSurface + 5 - 0.03);  // the facade plane (every lot has a 5 m setback)
    const ry = yawFacing(-f.nx, -f.nz), y0 = yardAt(road, ls);
    // the house floor sits at the yard or on the back corners' ground, as katzir.js puts it
    const back = along(road, ls, sd, road.halfSurface + 5 + 10.2);
    const ty = Math.max(y0 + 0.15, (terrain.heightAt(back.x - back.tx * 5, back.z - back.tz * 5) + terrain.heightAt(back.x + back.tx * 5, back.z + back.tz * 5)) / 2 + 0.1);
    const y = ty + 2.78;
    for (const [a, b] of [[-3.5, 3.5]]) {
      const A = { x: f.x + f.tx * a, z: f.z + f.tz * a }, B = { x: f.x + f.tx * b, z: f.z + f.tz * b };
      batch.add('neonOut', neonOut, box(0.05, 0.05, 7.0), mat4((A.x + B.x) / 2, y, (A.z + B.z) / 2, Math.atan2(B.x - A.x, B.z - A.z)), { color: pink });
    }
    batch.add('glow', glowMat, new THREE.PlaneGeometry(7.6, 1.2), mat4(f.x - f.nx * 0.12, y, f.z - f.nz * 0.12, ry), { color: dim(pink, 0.45) });
    batch.add('glow', glowMat, new THREE.PlaneGeometry(8, 3).rotateX(-Math.PI / 2), mat4(f.x - f.nx * 1.3, y0 + 0.03, f.z - f.nz * 1.3), { color: dim(pink, 0.25) });
  };
  neonHouse(246, 1);
  neonHouse(245, -1);
  { // the bus stop's roof edge
    const SWo = road.width / 2 + road.sidewalk, bus = along(road, 125, -1, SWo - 0.95), ry = yawFacing(-bus.nx, -bus.nz), y = yardAt(road, 125);
    const fx = bus.x + Math.sin(ry) * 1.0, fz = bus.z + Math.cos(ry) * 1.0;
    batch.add('neonOut', neonOut, box(3.4, 0.045, 0.045), mat4(fx, y + 2.58, fz, ry), { color: pink });
    batch.add('glow', glowMat, new THREE.PlaneGeometry(4.0, 1.0), mat4(fx + Math.sin(ry) * 0.1, y + 2.5, fz + Math.cos(ry) * 0.1, ry), { color: dim(pink, 0.4) });
  }
  { // string lights along the plaza railing, and one lamp post at the plaza's rim by the street
    const pz = plaza.h + road.curb, viewA = Math.atan2(-plaza.dz, plaza.dx), rad = plaza.r - 0.3, a0 = viewA - 2.55, a1 = viewA + 2.55;
    const steps = Math.max(2, Math.round((Math.abs(a1 - a0) * rad) / 1.6));
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps, px = plaza.x + Math.cos(a) * rad, pzz = plaza.z - Math.sin(a) * rad;
      batch.add('paint', M.paint, cyl(0.02, 0.02, 0.5, 6), mat4(px, pz + 1.3, pzz), { color: tint('#4b5157') }); // a short stem on each railing post
      if (prev) {
        const N = 3;
        let qx = prev[0], qy = pz + 1.55, qz = prev[1];
        for (let k = 1; k <= N; k++) {
          const t = k / N, x = prev[0] + (px - prev[0]) * t, z = prev[1] + (pzz - prev[1]) * t, y = pz + 1.55 - 0.1 * 4 * t * (1 - t);
          const dx = x - qx, dz = z - qz, dy = y - qy, horiz = Math.hypot(dx, dz);
          batch.add('paint', M.paint, box(0.016, 0.016, Math.hypot(horiz, dy)), mat4((x + qx) / 2, (y + qy) / 2, (z + qz) / 2, Math.atan2(dx, dz), 1, 1, 1, -Math.atan2(dy, horiz)), { color: dark });
          if (k < N) batch.add('bulb', headMat, new THREE.SphereGeometry(0.05, 5, 3), mat4(x, y - 0.06, z), { color: white });
          qx = x; qy = y; qz = z;
        }
      }
      prev = [px, pzz];
    }
    const la = viewA + Math.PI - 1.0, lx = plaza.x + Math.cos(la) * (plaza.r - 1.4), lz = plaza.z - Math.sin(la) * (plaza.r - 1.4);
    const ry = yawFacing(plaza.x - lx, plaza.z - lz);
    P.addLamp(batch, M, cols, lx, pz, lz, ry);
    lampHead(lx, pz, lz, ry, false);
    nightLamps.unshift({ x: plaza.x, y: pz + 4.2, z: plaza.z, color: '#ffe2b0' });
    batch.add('glow', glowMat, new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), mat4(plaza.x, pz + 0.05, plaza.z), { color: dim(warm, 0.25) });
  }

  const built = batch.build(group, {
    plaster: { cast: true }, stone: { cast: true }, paint: { cast: true }, wood: { cast: true },
    pavers: { cast: false }, asphalt: { cast: false }, dance: { cast: false }, window: { cast: false }, glass: { cast: false },
    neonPink: { cast: false }, neonBlue: { cast: false }, neonOut: { cast: false }, bulb: { cast: false }, backlight: { cast: false },
    posters: { cast: false }, glow: { cast: false, receive: false },
  });
  const glowMesh = built.glow[0];
  glowMesh.visible = false;
  glowMesh.renderOrder = 2;

  // ---------- the places the missions use ----------
  const L = (lx, lz, ry) => { const p = toWorld(lx, lz); return ry === undefined ? p : { ...p, yaw: yaw + ry }; };
  const crowd = [];
  const dancers = [[-2.3, 0.4], [-3.4, 0.2], [-4.6, -0.1], [-1.9, 1.6], [-3.1, 1.3], [-4.2, 1.8], [-2.4, 2.8], [-3.6, 2.6], [-4.7, 3.4], [-2.0, 3.9]];
  for (const [lx, lz] of dancers) crowd.push({ ...L(lx, lz, (r() - 0.5) * Math.PI * 2), pose: 'dance' });
  crowd.push({ ...L(BX - 0.75, BZl, Math.PI / 2), pose: 'stand' });                 // the DJ behind the booth
  crowd.push({ ...L(-5.6, -2.4, Math.PI), pose: 'stand' });                           // waiting at the bar's west end
  crowd.push({ ...L(-5.9, -1.0, Math.PI / 2), pose: 'stand' });                       // watching the dance floor
  crowd.push({ ...L(6.0, 1.0, -Math.PI / 2), pose: 'phone' });                        // on the phone by the banquette
  crowd.push({ ...L(5.2, -1.9, yawFacing(0.8, -0.4)), pose: 'stand' });               // two talking by the east end of the bar
  crowd.push({ ...L(6.0, -2.3, yawFacing(-0.8, 0.4)), pose: 'stand' });
  crowd.push({ ...L(1.9, 4.9, yawFacing(-1, -0.3)), pose: 'phone' });                 // just inside the door
  crowd.push({ ...L(-1.6, 5.0, yawFacing(1, -0.1)), pose: 'stand' });
  for (const lx of [-2.4, -3.7, 3.7, 5.0]) crowd.push({ ...L(lx, SZ, Math.PI), pose: 'sit' }); // on stools, facing the bar
  for (const [t, a] of [[tables[0], -Math.PI / 2], [tables[2], Math.PI / 6]]) { const c = chairSpot(t, a, 0.76); crowd.push({ ...L(c.x, c.z, c.yaw), pose: 'sit' }); }

  const pub = {
    x: cx, z: cz, y: floorY, W, D, H, yaw, toWorld, toLocal, roof, signMat, floorY,
    inside: (x, z) => { const l = toLocal(x, z); return Math.abs(l.x) < W / 2 + 0.3 && Math.abs(l.z) < D / 2 + 0.3; },
    entrance: L(0, hd + 1.0, Math.PI),                 // a metre outside the doorway, facing in
    doorInside: L(0, hd - 1.2, Math.PI),
    center: L(0, 0),
    parking: slots[1],                                 // the middle bay, nose toward the back
    parkingSlots: slots,
    parkingY: parkY,
    dance: { ...L(DANCE.x, DANCE.z), r: dh },
    crowd,
    bar: {
      kai: L(0, -4.6, 0),                              // behind the counter, facing the room
      yahli: L(-1.1, SZ, yawFacing(0.8, -0.35)),       // on the stool left of the gap, turned toward you
      player: L(0, -2.75, Math.PI),                    // on the step, facing the bar
      ido: L(1.5, -2.2, yawFacing(-1.5, -0.55)),
      yonati: L(2.9, -2.15, yawFacing(-2.9, -0.6)),
    },
    liamSpot: L(0, -0.35, Math.PI),                    // 2.4 m behind you, facing the bar
    // night lights (the integrator makes PointLights from these; the first is the most important)
    lamps: [
      { ...L(DANCE.x, DANCE.z), y: floorY + 3.5, color: '#ff4fb0', inside: true },
      { ...L(0, BZ + 0.3), y: floorY + 3.3, color: '#ffd9a0', inside: true },
      { ...L(0, hd + 1.4), y: floorY + 3.0, color: '#ffd9a0', inside: false },
      { ...L(4.2, 1.6), y: floorY + 3.3, color: '#ff6fc0', inside: true },
    ],
    emissives: [neonPink, neonBlue, bulbMat, backlightMat, windowMat, innerSignMat],
    glowMat,
    tick(camera, dt) {
      const l = toLocal(camera.position.x, camera.position.z);
      roof.visible = !(camera.position.y < floorY + H + 1.2 && Math.abs(l.x) < W / 2 + 1 && Math.abs(l.z) < D / 2 + 1);
      ball.rotation.y += dt * 0.7;
      // the halos follow the bulbs' glow, which daylight drives (0 by day, EMIT at night)
      const k = Math.min(1, Math.max(0, bulbMat.emissiveIntensity / EMIT));
      if (k !== pub.glowK) { pub.glowK = k; glowMat.opacity = 0.85 * k; glowMesh.visible = k > 0.02; }
    },
    glowK: -1,
  };
  places.pub = pub;
  places.katzirNight = { emissives: [headMat, neonOut], lamps: nightLamps, heads };
}
