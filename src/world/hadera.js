// Hadera, fictional and compressed: a flat grid of streets on the coastal plain between the road from
// Gan Shmuel and the sea. Apartment blocks, shops along the boulevard, a park, an industrial zone in the
// south-west with a fenced court, a garage at the city's entrance, a kiosk, and the beach promenade.
// Every business and street name here is invented for the game.
import * as THREE from 'three';
import { Road } from './roads.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { signAtlas } from './textures.js';
import * as P from './props.js';
import { HADERA_H, fence, scaleUV } from './countryside.js';

export const CITY = { x0: -1432, x1: -942, z0: -356, z1: 216 };
export const SEA_H = -57.6;
const XS = [-950, -1060, -1170, -1280, -1390];          // north-south streets, east to west
const ZS = [-340, -230, -120, -10, 100, 200];           // east-west streets, north to south
const BLVD = 2;                                          // ZS[2] is the boulevard, with a median
const SW = 9, BW = 16;                                   // street and boulevard widths, curb to curb
const KERB = 0.16;                                       // sidewalks above the street
const Y = HADERA_H;
const NS = ['רחוב התאנה', 'רחוב הדקל', 'רחוב הגפן', 'רחוב השקד', 'רחוב החוף'];
const EW = ['רחוב הנחל', 'רחוב התחנה', 'שדרות הים', 'רחוב השוק', 'רחוב הפרדס', 'רחוב המלאכה'];
const SHOPS = [
  ['פלאפל השדרה', '#f2c230', '#2a2116'], ['סלולר פלוס', '#1d4f91', '#ffffff'], ['מכולת הפינה', '#2f7a4a', '#ffffff'], ['פיצה ים', '#c8352d', '#ffffff'],
  ['קפה החוף', '#3b2b20', '#f3e6cc'], ['אופטיקה עין טובה', '#f2f2ee', '#1d4f91'], ['כלבו הבית', '#7a4a1f', '#ffffff'], ['מאפיית השוק', '#efe0c0', '#5a3a1a'],
  ['שווארמה הצומת', '#2a2d31', '#ffb547'], ['מספרה', '#16171a', '#f2f2ee'], ['ירקות הפרדס', '#567a52', '#ffffff'], ['מיץ טבעי', '#f08a3c', '#ffffff'],
  ['גלידה ים', '#b7c4d6', '#1d2733'], ['מכבסה', '#2f5e8f', '#ffffff'], ['חנות אופניים', '#3d4046', '#f2c230'], ['בית מרקחת', '#f2f2ee', '#2f7a4a'],
  ['נעליים ועוד', '#6b4f7a', '#ffffff'], ['ספרים ומשחקים', '#a33a32', '#f2f2ee'], ['חומרי בניין', '#5d636b', '#ffffff'], ['פרגיות על האש', '#2b1a10', '#f2c230'],
];
const WALLS = ['#efe8dc', '#e6dccb', '#f1ece2', '#e2d6c2', '#ece3d3', '#dcd7cf', '#e9dfcf', '#d8d2c6'];

// the blocks between the streets: their extent and what fills them
function blocks() {
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < ZS.length - 1; j++) {
      const hwz = (k) => (k === BLVD ? BW : SW) / 2;
      const b = { i, j, x0: XS[i + 1] + SW / 2, x1: XS[i] - SW / 2, z0: ZS[j] + hwz(j), z1: ZS[j + 1] - hwz(j + 1) };
      b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2; b.hx = (b.x1 - b.x0) / 2; b.hz = (b.z1 - b.z0) / 2;
      b.kind = j === 4 && i >= 1 ? 'industry'
        : i === 1 && j === 3 ? 'park'
          : i === 0 && j === 2 ? 'garage'
            : j === 1 || j === 2 ? 'boulevard' : 'homes';
      out.push(b);
    }
  }
  return out;
}

export function layout(ctx) {
  const { net, places } = ctx;
  const flat = () => Y;
  // the streets are one paved floor; blocks are raised sidewalks on top of it
  net.addPad({ x: (CITY.x0 + CITY.x1) / 2, z: (CITY.z0 + CITY.z1) / 2, hx: (CITY.x1 - CITY.x0) / 2, hz: (CITY.z1 - CITY.z0) / 2, h: Y, top: 0.02, blend: 12, name: 'hadera streets', map: '#e4ded0' });
  const B = blocks();
  for (const b of B) b.pad = net.addPad({ x: b.cx, z: b.cz, hx: b.hx, hz: b.hz, h: Y, top: KERB, blend: 0, name: `block ${b.i},${b.j}`, map: b.kind === 'park' ? '#9fb07a' : '#c9c0b0' });
  // outer sidewalks: east (by the road in), north, south; the promenade by the beach in the west
  const strips = [
    { x0: XS[0] + SW / 2, x1: CITY.x1, z0: CITY.z0, z1: CITY.z1 },
    { x0: CITY.x0, x1: CITY.x1, z0: CITY.z0, z1: ZS[0] - SW / 2 },
    { x0: CITY.x0, x1: CITY.x1, z0: ZS[ZS.length - 1] + SW / 2, z1: CITY.z1 },
    { x0: CITY.x0, x1: XS[XS.length - 1] - SW / 2, z0: ZS[0] - SW / 2, z1: ZS[ZS.length - 1] + SW / 2, promenade: true },
  ];
  for (const s of strips) {
    s.pad = net.addPad({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, hx: (s.x1 - s.x0) / 2, hz: (s.z1 - s.z0) / 2, h: Y, top: KERB, blend: 0, name: s.promenade ? 'promenade' : 'sidewalk', map: '#c9c0b0' });
  }
  // the boulevard's median: raised, planted, crossed only at the intersections
  const medians = [];
  for (let i = 0; i < XS.length; i++) {
    const xa = i === 0 ? CITY.x1 : XS[i] - SW / 2 - 6, xb = i === XS.length - 1 ? XS[i] + SW / 2 + 6 : XS[i + 1] + SW / 2 + 6;
    if (i < XS.length - 1) medians.push({ x0: xb, x1: XS[i] - SW / 2 - 6 });
    void xa;
  }
  places.medians = medians.map((m) => net.addPad({ x: (m.x0 + m.x1) / 2, z: ZS[BLVD], hx: (m.x1 - m.x0) / 2, hz: 1.4, h: Y, top: KERB, blend: 0, name: 'median', map: '#9fb07a' }));

  // streets as roads, for driving and finding the way (their asphalt is the floor above)
  const roads = [];
  XS.forEach((x, i) => roads.push(net.add(new Road([[x, ZS[0] - SW / 2 - 4], [x, ZS[ZS.length - 1] + SW / 2 + 4]], { name: NS[i], width: SW, sidewalk: 0, curb: 0, shoulder: 0, spacing: 3, baseHeight: flat }))));
  ZS.forEach((z, j) => {
    const from = j === BLVD ? CITY.x1 + 2 : XS[0] + SW / 2 + 4;
    roads.push(net.add(new Road([[from, z], [XS[XS.length - 1] - SW / 2 - 4, z]], { name: EW[j], width: j === BLVD ? BW : SW, sidewalk: 0, curb: 0, shoulder: 0, spacing: 3, baseHeight: flat })));
  });
  places.cityRoads = roads;
  places.hadera = { CITY, XS, ZS, BLVD, SW, BW, KERB, y: Y, blocks: B, strips };
}

export function build(ctx) {
  const { group, M, r, cols, veg, terrain, places } = ctx;
  const H = places.hadera, B = H.blocks;
  const batch = new Batch({ chunk: 200 }); // a city's worth of pieces in fewer, larger meshes
  const top = Y + KERB;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const atlasEntries = [];
  const signs = []; // [x, y, z, yaw, w, h, atlasIndex]
  // a sign plate; a two-sided one (street names) gets its text on the back too, the right way round
  const sign = (text, bg, fg, x, y, z, yaw, w, h = 0.8, twoSided = false) => {
    atlasEntries.push({ text, bg, fg });
    signs.push([x, y, z, yaw, w, h, atlasEntries.length - 1]);
    if (twoSided) signs.push([x - Math.sin(yaw) * 0.02, y, z - Math.cos(yaw) * 0.02, yaw + Math.PI, w, h, atlasEntries.length - 1]);
  };

  // ---------- the street floor, lane markings, crossings ----------
  batch.add('asphalt', M.asphalt, box(CITY.x1 - CITY.x0, 0.1, CITY.z1 - CITY.z0), mat4((CITY.x0 + CITY.x1) / 2, Y - 0.03, (CITY.z0 + CITY.z1) / 2), { uv: 'world', uvScale: 1 / 7 });
  const white = tint('#ecebe5'), yellow = tint('#f2c230');
  const dash = (x0, z0, x1, z1, color = white, w = 0.14, d = 3, gap = 5) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let t = 0; t < len - d; t += d + gap) {
      const k = (t + d / 2) / len;
      batch.add('paint', M.paint, box(w, 0.02, d), mat4(x0 + (x1 - x0) * k, Y + 0.035, z0 + (z1 - z0) * k, yaw), { color });
    }
  };
  // center lines between intersections; the boulevard gets two lanes each way
  for (let i = 0; i < XS.length; i++) for (let j = 0; j < ZS.length - 1; j++) dash(XS[i], ZS[j] + 8, XS[i], ZS[j + 1] - 8);
  for (let j = 0; j < ZS.length; j++) {
    for (let i = -1; i < XS.length - 1; i++) {
      const xa = i < 0 ? XS[0] + 30 : XS[i] - 8, xb = XS[i + 1] + 8;
      if (j === BLVD) for (const o of [-4, 4]) dash(xa, ZS[j] + o, xb, ZS[j] + o);
      else if (i >= 0) dash(xa, ZS[j], xb, ZS[j]);
    }
  }
  // zebra crossings on every side of every intersection
  const zebra = (x, z, alongX, width) => {
    for (let k = -width / 2 + 0.5; k < width / 2; k += 1.0) {
      batch.add('paint', M.paint, box(alongX ? 0.5 : 2.8, 0.02, alongX ? 2.8 : 0.5), mat4(alongX ? x + k : x, Y + 0.036, alongX ? z : z + k), { color: white });
    }
  };
  for (const x of XS) for (let j = 0; j < ZS.length; j++) {
    const hw = (j === BLVD ? BW : SW) / 2;
    zebra(x, ZS[j] - hw - 2, true, SW); zebra(x, ZS[j] + hw + 2, true, SW);
    zebra(x - SW / 2 - 2, ZS[j], false, j === BLVD ? BW : SW); zebra(x + SW / 2 + 2, ZS[j], false, j === BLVD ? BW : SW);
  }

  // ---------- sidewalks and curbs around every block and strip ----------
  const kerbed = (x0, x1, z0, z1, { inner = 'lawn', ring = 4 } = {}) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    // the sidewalk ring
    for (const [px, pz, bw, bd] of [[cx, z0 + ring / 2, w, ring], [cx, z1 - ring / 2, w, ring], [x0 + ring / 2, cz, ring, d - ring * 2], [x1 - ring / 2, cz, ring, d - ring * 2]]) {
      if (bw <= 0 || bd <= 0) continue;
      batch.add('pavers', M.pavers, box(bw, 0.2, bd), mat4(px, top - 0.1, pz), { uv: 'world', uvScale: 0.25 });
    }
    // the curb face along the street
    for (const [px, pz, bw, bd] of [[cx, z0, w, 0.22], [cx, z1, w, 0.22], [x0, cz, 0.22, d], [x1, cz, 0.22, d]]) {
      batch.add('curbGray', M.curbGray, box(bw + 0.02, KERB + 0.1, bd + 0.02), mat4(px, Y + (KERB + 0.1) / 2 - 0.08, pz), { uv: 'world', uvScale: 0.5 });
    }
    if (w > ring * 2 && d > ring * 2) {
      if (inner === 'lawn') batch.add('lawn', M.ground, box(w - ring * 2, 0.2, d - ring * 2), mat4(cx, top - 0.09, cz), { color: tint('#7d9a4c'), uv: 'world', uvScale: 0.25 });
      else if (inner === 'lot') batch.add('asphalt', M.asphalt, box(w - ring * 2, 0.2, d - ring * 2), mat4(cx, top - 0.09, cz), { uv: 'world', uvScale: 1 / 7 });
      else if (inner === 'pavers') batch.add('pavers', M.pavers, box(w - ring * 2, 0.2, d - ring * 2), mat4(cx, top - 0.1, cz), { uv: 'world', uvScale: 0.25 });
      else if (inner === 'yard') batch.add('paint', M.paint, box(w - ring * 2, 0.2, d - ring * 2), mat4(cx, top - 0.09, cz), { color: tint('#a49d90') });
    }
  };
  for (const b of B) kerbed(b.x0, b.x1, b.z0, b.z1, { inner: b.kind === 'industry' || b.kind === 'garage' ? 'yard' : b.kind === 'boulevard' ? 'pavers' : 'lawn' });
  for (const s of H.strips) kerbed(s.x0, s.x1, s.z0, s.z1, { inner: s.promenade ? 'lawn' : 'pavers', ring: s.promenade ? 6 : 3 });
  for (const m of places.medians) {
    const x0 = m.x - m.hx, x1 = m.x + m.hx;
    kerbed(x0, x1, m.z - m.hz, m.z + m.hz, { inner: 'none', ring: 0 });
    batch.add('lawn', M.ground, box(x1 - x0 - 0.4, 0.2, m.hz * 2 - 0.4), mat4(m.x, top - 0.09, m.z), { color: tint('#7d9a4c'), uv: 'world', uvScale: 0.25 });
    cols.addBox(m.x, m.z, m.hx, m.hz, 0, Y - 1, Y + 0.7);
    for (let x = x1 - 6; x > x0 + 4; x -= 14) { veg.push({ kind: 'palm', x, y: top, z: m.z, s: 0.95 + r() * 0.15 }); cols.addCircle(x, m.z, 0.4, Y - 1, Y + 8); }
  }

  // ---------- buildings ----------
  // an apartment block: windows and balconies on every side, a flat roof with water heaters
  const apartments = (x, z, w, d, floors, yaw, wall, { shops = 0, shopSide = 1, tanks = true } = {}) => {
    const h = floors * 3.0;
    const g = scaleUV(box(w, h, d), 1, 1);
    facadeUV(g, w, h, d);
    batch.add('facade', M.facade, g, mat4(x, top + h / 2, z, yaw), { color: tint(wall) });
    batch.add('paint', M.paint, box(w + 0.3, 0.45, d + 0.3), mat4(x, top + h + 0.1, z, yaw), { color: tint('#cfcac0') });
    if (tanks) for (let k = -1; k <= 1; k += 2) {
      const lx = k * w * 0.25, lz = -d * 0.15, c = Math.cos(yaw), s = Math.sin(yaw);
      batch.add('solar', M.solar, box(1.1, 0.05, 1.9), mat4(x + lx * c + lz * s, top + h + 0.85, z - lx * s + lz * c, yaw, 1, 1, 1, -0.55), {});
      batch.add('paint', M.paint, new THREE.CylinderGeometry(0.28, 0.28, 1.5, 8).rotateZ(Math.PI / 2), mat4(x + lx * c + (lz - 1) * s, top + h + 1.3, z - lx * s + (lz - 1) * c, yaw), { color: tint('#eceae5') });
    }
    if (shops) { // ground-floor shops on one long side: glass fronts and a sign each
      const c = Math.cos(yaw), s = Math.sin(yaw), fz = shopSide * (d / 2 + 0.04), each = w / shops;
      for (let k = 0; k < shops; k++) {
        const lx = -w / 2 + each * (k + 0.5), px = x + lx * c + fz * s, pz = z - lx * s + fz * c, ry = yaw + (shopSide > 0 ? 0 : Math.PI);
        batch.add('shopfront', M.shopfront, scaleUV(new THREE.PlaneGeometry(each - 0.6, 3.2), 1, 1), mat4(px, top + 1.6, pz, ry), {});
        const [name, bg, fg] = SHOPS[Math.floor(r() * SHOPS.length)];
        sign(name, bg, fg, px + 0.03 * s * shopSide, top + 2.85, pz + 0.03 * c * shopSide, ry, Math.min(each - 1, 6.5), 0.62);
        batch.add('paint', M.paint, box(each - 0.4, 0.12, 1.4), mat4(px + 0.7 * s * shopSide, top + 3.3, pz + 0.7 * c * shopSide, yaw), { color: tint(bg) }); // awning
      }
    }
    cols.addBox(x, z, w / 2 + 0.05, d / 2 + 0.05, yaw, Y - 1, top + h + 1);
    return h;
  };
  const warehouse = (x, z, w, d, h, yaw, color = '#c9ced3') => {
    batch.add('metal', M.metal, scaleUV(box(w, h, d), 1, 1), mat4(x, top + h / 2, z, yaw), { color: tint(color), uv: 'world', uvScale: 0.25 });
    batch.add('paint', M.paint, box(w + 0.4, 0.3, d + 0.4), mat4(x, top + h + 0.15, z, yaw), { color: tint('#8f959c') });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const k of [-0.25, 0.25]) { // roll-up doors on the street side
      const lx = k * w, lz = d / 2 + 0.03;
      batch.add('paint', M.paint, box(4.2, 4.4, 0.06), mat4(x + lx * c + lz * s, top + 2.2, z - lx * s + lz * c, yaw), { color: tint('#7b8087') });
    }
    cols.addBox(x, z, w / 2 + 0.05, d / 2 + 0.05, yaw, Y - 1, top + h + 1);
  };

  // apartment blocks along the edges of a block, with gaps between them
  const ring = (b, { floorsMin = 3, floorsMax = 5, shopsOn = null, depth = 11, skip = () => false }) => {
    const inset = 4 + 2;                          // behind the sidewalk, and a strip of garden
    const sides = [
      { along: 'x', z: b.z0 + inset + depth / 2, from: b.x0 + inset, to: b.x1 - inset, yaw: Math.PI, street: -1 },
      { along: 'x', z: b.z1 - inset - depth / 2, from: b.x0 + inset, to: b.x1 - inset, yaw: 0, street: 1 },
      { along: 'z', x: b.x0 + inset + depth / 2, from: b.z0 + inset + depth + 8, to: b.z1 - inset - depth - 8, yaw: -Math.PI / 2, street: -1 },
      { along: 'z', x: b.x1 - inset - depth / 2, from: b.z0 + inset + depth + 8, to: b.z1 - inset - depth - 8, yaw: Math.PI / 2, street: 1 },
    ];
    for (const sd of sides) {
      let a = sd.from + r() * 4;
      while (a < sd.to - 18) {
        const len = Math.min(sd.to - a, 26 + r() * 16);
        if (len < 18) break;
        const mid = a + len / 2, x = sd.along === 'x' ? mid : sd.x, z = sd.along === 'x' ? sd.z : mid;
        if (!skip(x, z)) {
          const tall = r() < 0.12;
          const floors = tall ? 8 + Math.floor(r() * 4) : floorsMin + Math.floor(r() * (floorsMax - floorsMin + 1));
          const shops = shopsOn && shopsOn(sd) ? Math.max(2, Math.round(len / 7)) : 0;
          // local +z of the box faces the street on this side
          const yaw = sd.along === 'x' ? (sd.street > 0 ? 0 : Math.PI) : (sd.street > 0 ? Math.PI / 2 : -Math.PI / 2);
          apartments(x, z, len, depth, shops ? Math.max(3, floors) : floors, yaw, WALLS[Math.floor(r() * WALLS.length)], { shops, shopSide: 1 });
        }
        a += len + 8 + r() * 6;
      }
    }
  };

  const special = {};
  for (const b of B) {
    if (b.kind === 'homes') ring(b, {});
    else if (b.kind === 'boulevard') {
      // shops face the boulevard; the kiosk and the safe car park take two corners
      const blvdSide = (sd) => (b.j === BLVD - 1 ? sd.along === 'x' && sd.street > 0 : sd.along === 'x' && sd.street < 0);
      ring(b, {
        floorsMin: 3, floorsMax: 4, shopsOn: blvdSide,
        skip: (x, z) => (b.i === 2 && b.j === 1 && x > b.x1 - 34 && z > b.z1 - 30) || (b.i === 1 && b.j === 1 && x < b.x0 + 46 && z > b.z1 - 40),
      });
    } else if (b.kind === 'industry') {
      if (b.i === 3) special.court = b;
      if (b.i === 2) special.yard = b;
      for (const [lx, lz, w, d] of b.i === 3 ? [[-30, -26, 30, 20], [30, -28, 26, 18]] : [[-24, -22, 34, 22], [24, -22, 30, 22], [-24, 26, 34, 22], [26, 28, 28, 20]]) {
        warehouse(b.cx + lx, b.cz + lz, w, d, 7 + r() * 3, lz < 0 ? Math.PI : 0, ['#c9ced3', '#b8c2c9', '#d6d0c4', '#a9b4bc'][Math.floor(r() * 4)]);
      }
    } else if (b.kind === 'park') {
      for (let k = 0; k < 46; k++) {
        const x = b.x0 + 8 + r() * (b.hx * 2 - 16), z = b.z0 + 8 + r() * (b.hz * 2 - 16);
        if (Math.hypot(x - b.cx, z - b.cz) < 14) continue;
        veg.push({ kind: r() < 0.4 ? 'pine' : r() < 0.7 ? 'olive' : 'palm', x, y: top, z, s: 0.9 + r() * 0.4 });
        cols.addCircle(x, z, 0.4, Y - 1, Y + 6);
      }
      batch.add('pavers', M.pavers, new THREE.CircleGeometry(12, 32).rotateX(-Math.PI / 2), mat4(b.cx, top + 0.02, b.cz), { uv: 'world', uvScale: 0.25 });
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P.addBench(batch, M, cols, b.cx + Math.cos(a) * 10, top, b.cz + Math.sin(a) * 10, Math.atan2(-Math.cos(a), -Math.sin(a))); }
      batch.add('paint', M.paint, new THREE.CylinderGeometry(2.2, 2.6, 0.7, 24), mat4(b.cx, top + 0.35, b.cz), { color: tint('#b9c4c9') }); // a fountain bowl
      cols.addCircle(b.cx, b.cz, 2.7, Y - 1, Y + 1);
      sign('גן העיר', '#2f6b3c', '#ffffff', b.x1 - 4.5, top + 2.4, b.cz, Math.PI / 2, 2.4, 0.5);
    } else if (b.kind === 'garage') special.garage = b;
  }

  // ---------- the junction garage, at the city's entrance ----------
  {
    const b = special.garage, gx = b.x1 - 26, gz = b.z0 + 22, w = 26, d = 18, h = 7.5;
    // the workshop opens toward the boulevard (north, -z)
    batch.add('metal', M.metal, box(w, h, 0.3), mat4(gx, top + h / 2, gz + d / 2), { color: tint('#d9dde0'), uv: 'world', uvScale: 0.25 });
    for (const k of [-1, 1]) batch.add('metal', M.metal, box(0.3, h, d), mat4(gx + k * w / 2, top + h / 2, gz), { color: tint('#d9dde0'), uv: 'world', uvScale: 0.25 });
    for (const k of [-1, 1]) batch.add('metal', M.metal, box(w / 2 - 5, h, 0.3), mat4(gx + k * (w / 4 + 2.5), top + h / 2, gz - d / 2), { color: tint('#d9dde0'), uv: 'world', uvScale: 0.25 });
    batch.add('metal', M.metal, box(10, h - 4.6, 0.3), mat4(gx, top + 4.6 + (h - 4.6) / 2, gz - d / 2), { color: tint('#d9dde0'), uv: 'world', uvScale: 0.25 });
    batch.add('paint', M.paint, box(w + 0.6, 0.35, d + 0.6), mat4(gx, top + h + 0.17, gz), { color: tint('#8f959c') });
    batch.add('paint', M.paint, box(w - 0.4, 0.04, d - 0.4), mat4(gx, top + 0.02, gz), { color: tint('#5f6268') });
    cols.addBox(gx, gz + d / 2, w / 2, 0.25, 0, Y - 1, top + h);
    for (const k of [-1, 1]) cols.addBox(gx + k * w / 2, gz, 0.25, d / 2, 0, Y - 1, top + h);
    for (const k of [-1, 1]) cols.addBox(gx + k * (w / 4 + 2.5), gz - d / 2, w / 4 - 2.5, 0.25, 0, Y - 1, top + h);
    // inside: a lift, tires, a workbench
    for (const k of [-1.6, 1.6]) { batch.add('paint', M.paint, box(0.3, 2.4, 0.3), mat4(gx - 6 + k, top + 1.2, gz + 4), { color: tint('#c8352d') }); cols.addCircle(gx - 6 + k, gz + 4, 0.25, Y - 1, Y + 3); }
    for (let k = 0; k < 5; k++) batch.add('paint', M.paint, new THREE.TorusGeometry(0.34, 0.14, 6, 12).rotateX(Math.PI / 2), mat4(gx + 9.5, top + 0.15 + k * 0.28, gz + 6.5), { color: tint('#1c1d20') });
    batch.add('paint', M.paint, box(3, 1, 0.9), mat4(gx + 8.5, top + 0.5, gz - 3), { color: tint('#5d636b') });
    cols.addBox(gx + 8.5, gz - 3, 1.5, 0.45, 0, Y - 1, Y + 1.2);
    sign('מוסך הצומת', '#c8352d', '#ffffff', gx, top + 5.9, gz - d / 2 - 0.2, Math.PI, 8.5, 1.2);
    // the forecourt where a car waits for work
    batch.add('asphalt', M.asphalt, box(16, 0.2, 12), mat4(gx, top - 0.09, gz - d / 2 - 7), { uv: 'world', uvScale: 1 / 7 });
    places.garage = { x: gx, z: gz, y: top, bay: { x: gx, z: gz - d / 2 - 7, y: top, yaw: Math.PI, r: 4.5 }, door: { x: gx, z: gz - d / 2 - 1.5 } };
    for (let k = 0; k < 3; k++) ring({ ...b, x1: b.x1 - 58 }, {}); // homes in the rest of the block
  }

  // ---------- the boulevard kiosk, and the safe car park across the street ----------
  {
    const b = B.find((q) => q.i === 2 && q.j === 1), kx = b.x1 - 12, kz = b.z1 - 10, yaw = 0; // faces the boulevard (+z)
    batch.add('plaster', M.plaster, box(4.4, 2.9, 3.4), mat4(kx, top + 1.45, kz), { color: tint('#f1e6d2'), uv: 'world', uvScale: 0.3 });
    batch.add('shutter', M.shutter, new THREE.PlaneGeometry(2.6, 1.2), mat4(kx, top + 1.5, kz + 1.71, yaw), {});
    batch.add('paint', M.paint, box(5.2, 0.12, 2.2), mat4(kx, top + 2.75, kz + 2.6), { color: tint('#2f5e8f') });
    sign('קיוסק השדרה', '#f2c230', '#2a2116', kx, top + 3.15, kz + 1.73, yaw, 4.2, 0.62);
    cols.addBox(kx, kz, 2.2, 1.7, 0, Y - 1, Y + 3);
    // plastic chairs around two tables, a parasol
    const seats = [];
    for (const [tx, tz] of [[-4.2, 5.2], [2.6, 5.6]]) {
      batch.add('paint', M.paint, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 14), mat4(kx + tx, top + 0.72, kz + tz), { color: tint('#f2f2ee') });
      batch.add('paint', M.paint, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), mat4(kx + tx, top + 0.36, kz + tz), { color: tint('#d9d9d4') });
      cols.addCircle(kx + tx, kz + tz, 0.5, Y - 1, Y + 1);
      for (const a of [0, 2.1, 4.2]) {
        const cx = kx + tx + Math.cos(a) * 0.95, cz = kz + tz + Math.sin(a) * 0.95, cy = Math.atan2(-(Math.cos(a)), -(Math.sin(a)));
        batch.add('paint', M.paint, box(0.45, 0.05, 0.45), mat4(cx, top + 0.45, cz, cy), { color: tint('#f2f2ee') });
        batch.add('paint', M.paint, box(0.45, 0.45, 0.05), mat4(cx - Math.cos(a) * 0.2, top + 0.68, cz - Math.sin(a) * 0.2, cy), { color: tint('#f2f2ee') });
        seats.push({ x: cx, z: cz, y: top, yaw: cy });
      }
    }
    batch.add('paint', M.paint, new THREE.ConeGeometry(2.2, 0.7, 12, 1, true), mat4(kx - 4.2, top + 2.6, kz + 5.2), { color: tint('#c8352d') });
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), mat4(kx - 4.2, top + 1.3, kz + 5.2), { color: tint('#d9d9d4') });
    places.kiosk = { x: kx, z: kz + 3.2, y: top, yaw: Math.PI, seats, front: { x: kx - 1, z: kz + 8.5 } };

    const pb = B.find((q) => q.i === 1 && q.j === 1), px = pb.x0 + 24, pz = pb.z1 - 20;
    batch.add('asphalt', M.asphalt, box(40, 0.2, 30), mat4(px, top - 0.08, pz), { uv: 'world', uvScale: 1 / 7 });
    for (let k = -3; k <= 3; k++) batch.add('paint', M.paint, box(0.12, 0.02, 5), mat4(px + k * 3, top + 0.03, pz - 6), { color: white });
    for (let k = -3; k <= 3; k++) batch.add('paint', M.paint, box(0.12, 0.02, 5), mat4(px + k * 3, top + 0.03, pz + 6), { color: white });
    sign('P · חנייה', '#1d4f91', '#ffffff', pb.x0 + 3, top + 2.6, pz + 13, -Math.PI / 2, 2.2, 0.6);
    batch.add('paint', M.paint, box(0.08, 2.4, 0.08), mat4(pb.x0 + 3, top + 1.2, pz + 13), { color: tint('#8a8f96') });
    places.safeParking = { x: px - 1.5, z: pz + 6, y: top, yaw: Math.PI, r: 3.2 };
    places.parkingLot = { x: px, z: pz, hx: 20, hz: 15 };
  }

  // ---------- the court: a fenced lot among the warehouses ----------
  {
    const b = special.court, cx = b.cx - 4, cz = b.cz + 16, hw = 17, hd = 12;
    batch.add('asphalt', M.asphalt, box(hw * 2, 0.2, hd * 2), mat4(cx, top - 0.08, cz), { color: tint('#9c8f86'), uv: 'world', uvScale: 1 / 7 });
    for (const [x0, z0, x1, z1] of [[-14, -9, 14, -9], [-14, 9, 14, 9], [-14, -9, -14, 9], [14, -9, 14, 9], [0, -9, 0, 9]]) {
      batch.add('paint', M.paint, box(Math.max(0.1, Math.abs(x1 - x0)), 0.02, Math.max(0.1, Math.abs(z1 - z0))), mat4(cx + (x0 + x1) / 2, top + 0.03, cz + (z0 + z1) / 2), { color: tint('#e9e2d0') });
    }
    batch.add('paint', M.paint, new THREE.RingGeometry(2.6, 2.75, 28).rotateX(-Math.PI / 2), mat4(cx, top + 0.035, cz), { color: tint('#e9e2d0') });
    for (const k of [-1, 1]) { // hoops
      const hx = cx + k * 15.4;
      batch.add('paint', M.paint, box(0.15, 3.2, 0.15), mat4(hx, top + 1.6, cz), { color: tint('#5d636b') });
      batch.add('paint', M.paint, box(0.06, 1.0, 1.6), mat4(hx - k * 0.3, top + 3.3, cz), { color: tint('#f2f2ee') });
      batch.add('paint', M.paint, new THREE.TorusGeometry(0.24, 0.02, 4, 12).rotateX(Math.PI / 2), mat4(hx - k * 0.62, top + 3.0, cz), { color: tint('#e2574c') });
      cols.addCircle(hx, cz, 0.2, Y - 1, Y + 3.5);
    }
    const gy = (x, z) => (Math.abs(x - cx) < hw + 2 && Math.abs(z - cz) < hd + 2 ? top : top);
    fence(batch, M, cols, cx - hw, cz - hd, cx + hw, cz - hd, gy);
    fence(batch, M, cols, cx - hw, cz + hd, cx - 4, cz + hd, gy);
    fence(batch, M, cols, cx + 4, cz + hd, cx + hw, cz + hd, gy); // the way in, from the south street
    fence(batch, M, cols, cx - hw, cz - hd, cx - hw, cz + hd, gy);
    fence(batch, M, cols, cx + hw, cz - hd, cx + hw, cz + hd, gy);
    for (const [lx, lz, ry] of [[-hw - 4, -4, 0.1], [hw + 5, 3, -0.05]]) { // shipping containers
      batch.add('metal', M.metal, box(2.5, 2.6, 6.1), mat4(cx + lx, top + 1.3, cz + lz, ry), { color: tint(lx < 0 ? '#2f6b8a' : '#a3472f'), uv: 'world', uvScale: 0.25 });
      cols.addBox(cx + lx, cz + lz, 1.25, 3.05, ry, Y - 1, Y + 3);
    }
    sign('המגרש', '#3d4046', '#f2c230', cx, top + 2.4, cz + hd + 0.1, 0, 2.6, 0.55);
    places.court = { x: cx, z: cz, y: top, hx: hw - 1, hz: hd - 1, gate: { x: cx, z: cz + hd + 2 } };
  }

  // ---------- the Sharks' yard between the warehouses: crates, a container, the generator ----------
  {
    const b = special.yard, cx = b.cx, cz = b.cz + 2;
    for (const [lx, lz, w, h, d, ry] of [[-8, 4, 2.4, 2.6, 6.1, 0.05], [12, -6, 1.2, 1.0, 1.2, 0.3], [13.4, -5.2, 1.2, 1.0, 1.2, -0.2], [12.6, -5.6, 1.0, 0.9, 1.0, 0.6], [-14, -7, 1.2, 1.1, 1.2, 0.1]]) {
      const isBox = w < 2;
      batch.add(isBox ? 'paint' : 'metal', isBox ? M.paint : M.metal, box(w, h, d), mat4(cx + lx, top + h / 2, cz + lz, ry), isBox ? { color: tint('#8a6440') } : { color: tint('#2b6a8f'), uv: 'world', uvScale: 0.25 });
      cols.addBox(cx + lx, cz + lz, w / 2, d / 2, ry, Y - 1, Y + h + 0.2);
    }
    // the generator on a pallet: the thing the story is about
    batch.add('paint', M.paint, box(1.2, 0.14, 1.0), mat4(cx + 4, top + 0.07, cz + 1), { color: tint('#8a6440') });
    batch.add('paint', M.paint, box(0.95, 0.7, 0.7), mat4(cx + 4, top + 0.5, cz + 1), { color: tint('#c8352d') });
    batch.add('paint', M.paint, box(0.98, 0.12, 0.72), mat4(cx + 4, top + 0.9, cz + 1), { color: tint('#1c1d20') });
    places.sharksYard = {
      x: cx, z: cz, y: top, crate: { x: cx + 4, z: cz + 1 },
      patrol: [{ x: cx - 12, z: cz + 9 }, { x: cx + 16, z: cz + 9 }, { x: cx + 16, z: cz - 3 }, { x: cx - 12, z: cz - 3 }],
      entry: { x: b.x1 + 4, z: cz }, street: { x: b.x1 + SW / 2 + 2, z: cz - 14 },
    };
  }

  // ---------- trees, lamps, benches and bins along the streets ----------
  // (none in the way of driving into the car park, the garage or the court)
  const ways = [
    { x: places.safeParking.x, z: places.parkingLot.z + places.parkingLot.hz + 5, r: 9 },
    { x: places.garage.bay.x, z: places.garage.bay.z - 6, r: 10 },
    { x: places.court.gate.x, z: places.court.gate.z + 12, r: 9 },
  ];
  const inTheWay = (x, z) => ways.some((w) => Math.hypot(x - w.x, z - w.z) < w.r);
  const sidewalkSpots = [];
  for (const b of [...B, ...H.strips.filter((s) => !s.promenade)]) {
    const edges = [[b.x0, b.z0, b.x1, b.z0], [b.x0, b.z1, b.x1, b.z1], [b.x0, b.z0, b.x0, b.z1], [b.x1, b.z0, b.x1, b.z1]];
    for (const [x0, z0, x1, z1] of edges) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 20) continue;
      const nx = (z1 - z0) / len, nz = -(x1 - x0) / len; // a normal; flipped below to point into the block
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, inx = Math.sign((cx - x0) * nx + (cz - z0) * nz) || 1;
      for (let t = 10, k = 0; t < len - 10; t += 14, k++) {
        const x = x0 + ((x1 - x0) * t) / len + nx * inx * 1.0, z = z0 + ((z1 - z0) * t) / len + nz * inx * 1.0;
        if (inTheWay(x, z)) continue;
        if (k % 2 === 0) { veg.push({ kind: b.kind === 'industry' ? 'eucalyptus' : 'olive', x, y: top, z, s: 0.85 + r() * 0.25 }); cols.addCircle(x, z, 0.35, Y - 1, Y + 4); }
        else if (k % 4 === 1) P.addLamp(batch, M, cols, x, top, z, Math.atan2(-nx * inx, -nz * inx));
        else if (r() < 0.25) P.addBin(batch, M, cols, x, top, z, Math.atan2(-nx * inx, -nz * inx));
        sidewalkSpots.push({ x: x0 + ((x1 - x0) * t) / len + nx * inx * 2.4, z: z0 + ((z1 - z0) * t) / len + nz * inx * 2.4 });
      }
    }
  }
  // bus stops on the boulevard
  for (const [x, z, yaw] of [[-1112, ZS[BLVD] - BW / 2 - 2.2, Math.PI], [-1222, ZS[BLVD] + BW / 2 + 2.2, 0]]) {
    P.addBusStop(group, batch, M, cols, x, top, z, yaw, 'תחנת אוטובוס · שדרות הים');
  }
  // street names at the corners
  XS.forEach((x, i) => { for (const j of [1, 3]) sign(NS[i], '#1d4f91', '#ffffff', x + SW / 2 + 1.2, top + 2.5, ZS[j] + 6.5, Math.PI / 2, 2.2, 0.42, true); });
  ZS.forEach((z, j) => { for (const i of [1, 3]) sign(EW[j], '#1d4f91', '#ffffff', XS[i] - 6.5, top + 2.5, z + (j === BLVD ? BW : SW) / 2 + 1.2, 0, 2.2, 0.42, true); });
  for (const [x, z] of [[XS[0] + SW / 2 + 1.2, ZS[1] + 6.5], [XS[0] + SW / 2 + 1.2, ZS[3] + 6.5]]) batch.add('paint', M.paint, box(0.07, 2.6, 0.07), mat4(x, top + 1.3, z), { color: tint('#8a8f96') });

  // ---------- the promenade, the beach and the sea ----------
  {
    const s = H.strips.find((q) => q.promenade), px = CITY.x0 + 5;
    const LOT = { x0: -1425, x1: -1401, z0: 138, z1: 188 }; // the beach car park at the south end
    for (let z = s.z0 + 10; z < s.z1 - 10; z += 16) {
      if (z > LOT.z0 - 6 && z < LOT.z1 + 6) continue;
      veg.push({ kind: 'palm', x: px + 7, y: top, z, s: 1 + r() * 0.15 });
      cols.addCircle(px + 7, z, 0.4, Y - 1, Y + 8);
      if ((z / 16) % 2 < 1) P.addBench(batch, M, cols, px + 2, top, z + 8, -Math.PI / 2);
      else P.addLamp(batch, M, cols, px + 0.8, top, z + 8, -Math.PI / 2);
    }
    // the beach car park, and a falafel truck at its sea end (Dolev's cousin's, in the story)
    {
      const cx = (LOT.x0 + LOT.x1) / 2, cz = (LOT.z0 + LOT.z1) / 2;
      batch.add('asphalt', M.asphalt, box(LOT.x1 - LOT.x0, 0.2, LOT.z1 - LOT.z0), mat4(cx, top - 0.08, cz), { uv: 'world', uvScale: 1 / 7 });
      for (let k = 0; k < 6; k++) batch.add('paint', M.paint, box(5, 0.02, 0.12), mat4(LOT.x1 - 3, top + 0.03, LOT.z0 + 8 + k * 6), { color: white });
      const tx = LOT.x0 + 3.2, tz = cz - 4, yaw = Math.PI / 2; // the hatch faces into the car park (+x)
      const at = (lx, ly, lz) => mat4(tx + lz * Math.sin(yaw) + lx * Math.cos(yaw), top + ly, tz + lz * Math.cos(yaw) - lx * Math.sin(yaw), yaw);
      batch.add('paint', M.paint, box(5.6, 2.3, 2.3), at(0, 1.55, 0), { color: tint('#f2efe6') });
      batch.add('paint', M.paint, box(5.6, 0.3, 2.35), at(0, 0.55, 0), { color: tint('#c8352d') });
      batch.add('paint', M.paint, box(1.8, 1.5, 2.25), at(3.4, 1.15, 0), { color: tint('#f2efe6') }); // the cab
      batch.add('paint', M.paint, box(1.0, 0.7, 2.27), at(3.6, 1.55, 0), { color: tint('#26303a') });
      batch.add('paint', M.paint, box(3.2, 1.0, 0.05), at(-0.4, 1.9, 1.16), { color: tint('#26303a') }); // the serving hatch
      batch.add('paint', M.paint, box(3.6, 0.08, 1.1), at(-0.4, 2.55, 1.7), { color: tint('#f2c230') }); // its awning
      for (const [lx, lz] of [[-1.8, -0.95], [-1.8, 0.95], [2.2, -0.95], [2.2, 0.95], [3.6, -0.95], [3.6, 0.95]]) {
        batch.add('paint', M.paint, new THREE.CylinderGeometry(0.35, 0.35, 0.28, 12).rotateX(Math.PI / 2), at(lx, 0.35, lz), { color: tint('#1c1d20') });
      }
      sign('פלאפל על גלגלים · ניסים', '#c8352d', '#ffffff', tx + 1.2 * Math.sin(yaw), top + 3.05, tz + 1.2 * Math.cos(yaw), yaw, 4.2, 0.6);
      cols.addBox(tx + 0.6 * Math.sin(yaw), tz, 3.3, 1.2, yaw, Y - 1, Y + 3);
      places.beachLot = { x: cx + 2, z: cz, y: top, hx: (LOT.x1 - LOT.x0) / 2, hz: (LOT.z1 - LOT.z0) / 2, truck: { x: tx + 2.4, z: tz, yaw: -Math.PI / 2 }, parking: { x: LOT.x1 - 4, z: cz + 8, yaw: Math.PI } };
    }
    // a lifeguard hut on stilts and a few parasols on the sand
    const hx = CITY.x0 - 11, hz = -60, hy = terrain.heightAt(hx, hz);
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) batch.add('paint', M.paint, box(0.14, 3, 0.14), mat4(hx + dx, hy + 1.5, hz + dz), { color: tint('#d9d4ca') });
    batch.add('plaster', M.plaster, box(3, 2.2, 3), mat4(hx, hy + 4.1, hz), { color: tint('#f2f2ee'), uv: 'world', uvScale: 0.3 });
    batch.add('paint', M.paint, box(3.6, 0.2, 3.6), mat4(hx, hy + 5.3, hz), { color: tint('#c8352d') });
    cols.addBox(hx, hz, 1.6, 1.6, 0, hy - 1, hy + 5.5);
    for (let k = 0; k < 7; k++) {
      const ux = CITY.x0 - 4 - r() * 11, uz = -300 + r() * 480, uy = terrain.heightAt(ux, uz);
      batch.add('paint', M.paint, new THREE.ConeGeometry(1.4, 0.5, 10, 1, true), mat4(ux, uy + 2.2, uz), { color: tint(['#f2c230', '#2f5e8f', '#c8352d', '#f2f2ee'][k % 4]) });
      batch.add('paint', M.paint, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), mat4(ux, uy + 1.1, uz), { color: tint('#d9d9d4') });
    }
    places.beach = { x: CITY.x0 - 8, z: -40, y: terrain.heightAt(CITY.x0 - 8, -40) };
    // the sea, out to the edge of the map
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 1000, 1, 1).rotateX(-Math.PI / 2), M.water);
    sea.position.set(-1700 + 160, SEA_H, -90);
    sea.name = 'sea';
    sea.receiveShadow = true;
    group.add(sea);
    places.sea = sea;
  }

  // ---------- one mesh for all the city's signs ----------
  {
    const atlas = signAtlas('hadera-signs', atlasEntries);
    const mat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6 });
    const sb = new Batch({ chunk: 200 });
    for (const [x, y, z, yaw, w, h, k] of signs) {
      const g = new THREE.PlaneGeometry(w, h), uv = g.getAttribute('uv'), [u0, v0, u1, v1] = atlas.uv[k];
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
      sb.add('citySigns', mat, g, mat4(x, y, z, yaw), { uv: 'keep' });
    }
    sb.build(group, {});
  }

  batch.build(group, { facade: { cast: true }, metal: { cast: true }, plaster: { cast: true }, paint: { cast: true } });

  // ---------- where people walk and cars drive in the city ----------
  places.sidewalkSpots = sidewalkSpots;
  places.cityLoops = B.filter((b) => b.kind !== 'industry').map((b) => ({ // driving around a block, on the right
    pts: [[b.x1 + SW / 4, b.z1 + 2.2], [b.x0 - SW / 4, b.z1 + 2.2], [b.x0 - SW / 4, b.z0 - 2.2], [b.x1 + SW / 4, b.z0 - 2.2]],
  }));
  places.walkLoops = B.map((b) => ({ x0: b.x0 + 2, x1: b.x1 - 2, z0: b.z0 + 2, z1: b.z1 - 2, y: top }));
  places.haderaEntry = { x: XS[0] + 20, z: ZS[BLVD], y: Y };
}

// texture coordinates in meters for a box: windows repeat every 6.8 m (two bays) and every 3 m (a floor)
function facadeUV(g, w, h, d) {
  const uv = g.getAttribute('uv');
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z; four vertices each
  const sizes = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = sizes[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (!fw) { uv.setXY(i, 0.03, 0.6); continue; } // roofs and floors: plain plaster
      uv.setXY(i, uv.getX(i) * (fw / 6.8), uv.getY(i) * (fh / 3.0));
    }
  }
}
