// Roads: smooth centerlines sampled by arc length, with builders for asphalt, sidewalks and curbs,
// and a network that finds the road surface under any point quickly and shapes the terrain around it.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/math.js';

export class Road {
  // kind: 'street' (sidewalks and curbs) or 'highway' (shoulders, no sidewalks).
  // startH / endH pin the height of an end that joins another road.
  constructor(points, { name = '', kind = 'street', width = 7, sidewalk = 2.2, curb = 0.14, shoulder = 2.5, spacing = 1.5,
    baseHeight, maxGrade = 0.08, startH = null, endH = null, closed = false } = {}) {
    this.name = name;
    this.kind = kind;
    this.width = width;
    this.sidewalk = sidewalk;
    this.curb = curb;
    this.halfSurface = width / 2 + sidewalk;       // paved part, where the road decides the ground height
    this.flatHalf = this.halfSurface + shoulder;    // flat band the terrain is shaped to
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
    const pts = curve.getSpacedPoints(Math.max(8, Math.ceil(curve.getLength() / spacing)));
    const n = pts.length;
    this.n = n;
    this.x = new Float32Array(n); this.z = new Float32Array(n);
    this.tx = new Float32Array(n); this.tz = new Float32Array(n);
    this.s = new Float32Array(n); this.h = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = pts[i].x; this.z[i] = pts[i].z;
      if (i) this.s[i] = this.s[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l;
    }
    this.length = this.s[n - 1];

    // height: the land under it, averaged so the road has no bumps, pinned where it joins another
    // road, then limited to a drivable grade in both directions
    const raw = Array.from({ length: n }, (_, i) => baseHeight(this.x[i], this.z[i]));
    const win = Math.max(4, Math.round(20 / spacing));
    for (let i = 0; i < n; i++) {
      let sum = 0, c = 0;
      for (let j = Math.max(0, i - win); j <= Math.min(n - 1, i + win); j++) { sum += raw[j]; c++; }
      this.h[i] = sum / c;
    }
    const L = this.length, blend = Math.min(30, L / 3);
    for (let i = 0; i < n; i++) {
      if (startH !== null) this.h[i] = lerp(startH, this.h[i], smoothstep(0, blend, this.s[i]));
      if (endH !== null) this.h[i] = lerp(endH, this.h[i], smoothstep(0, blend, L - this.s[i]));
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < n; i++) this.h[i] = clamp(this.h[i], this.h[i - 1] - maxGrade * (this.s[i] - this.s[i - 1]), this.h[i - 1] + maxGrade * (this.s[i] - this.s[i - 1]));
      for (let i = n - 2; i >= 0; i--) this.h[i] = clamp(this.h[i], this.h[i + 1] - maxGrade * (this.s[i + 1] - this.s[i]), this.h[i + 1] + maxGrade * (this.s[i + 1] - this.s[i]));
      if (startH !== null) this.h[0] = startH;
      if (endH !== null) this.h[n - 1] = endH;
    }
  }

  // left-hand normal at sample i (points to the "left" side when driving toward increasing s)
  normal(i) { return [-this.tz[i], this.tx[i]]; }

  // point on the centerline at arc length s, with tangent and left normal
  at(s) {
    s = clamp(s, 0, this.length);
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.s[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - this.s[lo]) / ((this.s[hi] - this.s[lo]) || 1);
    const x = this.x[lo] + (this.x[hi] - this.x[lo]) * t, z = this.z[lo] + (this.z[hi] - this.z[lo]) * t;
    const h = this.h[lo] + (this.h[hi] - this.h[lo]) * t;
    const tx = this.tx[lo], tz = this.tz[lo];
    return { x, z, h, tx, tz, nx: -tz, nz: tx };
  }

  // distance from (px, pz) to segment i: { d, t, side, qx, qz }
  segment(i, px, pz) {
    const ax = this.x[i], az = this.z[i], vx = this.x[i + 1] - ax, vz = this.z[i + 1] - az, len2 = vx * vx + vz * vz || 1;
    const t = clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1);
    const qx = ax + vx * t, qz = az + vz * t;
    return { d: Math.hypot(px - qx, pz - qz), t, side: vx * (pz - az) - vz * (px - ax) >= 0 ? 1 : -1, qx, qz };
  }

  // nearest point on the whole centerline (a plain scan; the network has a faster indexed version)
  nearest(px, pz) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i += 4) {
      const d = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    let res = null;
    for (let i = Math.max(0, best - 5); i <= Math.min(this.n - 2, best + 4); i++) {
      const g = this.segment(i, px, pz);
      if (!res || g.d < res.d) res = { ...g, i, h: this.h[i] + (this.h[i + 1] - this.h[i]) * g.t, s: this.s[i] + (this.s[i + 1] - this.s[i]) * g.t };
    }
    return res;
  }

  // a ribbon between two lateral offsets (negative = right side), lifted by `lift`
  ribbon(off0, off1, lift, vScale = 1 / 6, sFrom = 0, sTo = Infinity) {
    const pos = [], uv = [], idx = [];
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.s[i] < sFrom - 1e-3 || this.s[i] > sTo + 1e-3) continue;
      const [nx, nz] = this.normal(i), y = this.h[i] + lift;
      pos.push(this.x[i] + nx * off0, y, this.z[i] + nz * off0, this.x[i] + nx * off1, y, this.z[i] + nz * off1);
      uv.push(0, this.s[i] * vScale, 1, this.s[i] * vScale);
      if (k) {
        const a = (k - 1) * 2, b = a + 1, c = a + 2, d = a + 3;
        if (off1 > off0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
      k++;
    }
    return makeGeo(pos, uv, idx);
  }

  // a vertical strip at lateral offset `off`, from y0 to y1 above the road height, facing `face` (+1 toward the road)
  wall(off, y0, y1, face, sFrom = 0, sTo = Infinity, vScale = 1 / 2) {
    const pos = [], uv = [], idx = [];
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.s[i] < sFrom - 1e-3 || this.s[i] > sTo + 1e-3) continue;
      const [nx, nz] = this.normal(i), x = this.x[i] + nx * off, z = this.z[i] + nz * off;
      pos.push(x, this.h[i] + y0, z, x, this.h[i] + y1, z);
      uv.push(this.s[i] * vScale, 0, this.s[i] * vScale, 1);
      if (k) {
        const a = (k - 1) * 2, b = a + 1, c = a + 2, d = a + 3;
        if (face * Math.sign(off) < 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      k++;
    }
    return makeGeo(pos, uv, idx);
  }

  // dashed or solid paint line at lateral offset `off`
  line(off, width, lift, dash = 0, gap = 0, sFrom = 0, sTo = Infinity) {
    if (!dash) return this.ribbon(off - width / 2, off + width / 2, lift, 1 / 4, sFrom, sTo);
    const parts = [];
    for (let s = Math.max(sFrom, 0); s < Math.min(sTo, this.length); s += dash + gap) parts.push(this.ribbon(off - width / 2, off + width / 2, lift, 1 / 4, s, Math.min(s + dash, sTo)));
    return parts;
  }
}

function makeGeo(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const CELL = 24;
const key = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);

// Paved areas that are not roads: plazas, parking lots, city blocks. Rect pads may be rotated.
export class Pad {
  constructor({ x, z, hx = 0, hz = 0, r = 0, yaw = 0, h, top = 0, blend = 8, covered = true, name = '' }) {
    Object.assign(this, { x, z, hx, hz, r, yaw, h, top, blend, covered, name, c: Math.cos(yaw), s: Math.sin(yaw) });
  }

  // signed distance to the edge (negative inside)
  sd(px, pz) {
    const dx = px - this.x, dz = pz - this.z;
    if (this.r) return Math.hypot(dx, dz) - this.r;
    const lx = Math.abs(dx * this.c - dz * this.s) - this.hx, lz = Math.abs(dx * this.s + dz * this.c) - this.hz;
    return lx > 0 || lz > 0 ? Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) : Math.max(lx, lz);
  }

  get reach() { return (this.r || Math.hypot(this.hx, this.hz)) + this.blend; }
}

export class RoadNetwork {
  constructor() {
    this.roads = [];
    this.pads = [];
    this.cells = new Map();
    this.padCells = new Map();
  }

  add(road) {
    this.roads.push(road);
    const pad = road.halfSurface + 0.5;
    for (let i = 0; i < road.n - 1; i++) {
      const x0 = Math.min(road.x[i], road.x[i + 1]) - pad, x1 = Math.max(road.x[i], road.x[i + 1]) + pad;
      const z0 = Math.min(road.z[i], road.z[i + 1]) - pad, z1 = Math.max(road.z[i], road.z[i + 1]) + pad;
      for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
        for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
          const k = key(ix, iz);
          if (!this.cells.has(k)) this.cells.set(k, []);
          this.cells.get(k).push(road, i);
        }
      }
    }
    return road;
  }

  addPad(opts) {
    const p = new Pad(opts);
    this.pads.push(p);
    const R = p.r || Math.hypot(p.hx, p.hz);
    for (let ix = Math.floor((p.x - R) / CELL); ix <= Math.floor((p.x + R) / CELL); ix++) {
      for (let iz = Math.floor((p.z - R) / CELL); iz <= Math.floor((p.z + R) / CELL); iz++) {
        const k = key(ix, iz);
        if (!this.padCells.has(k)) this.padCells.set(k, []);
        this.padCells.get(k).push(p);
      }
    }
    return p;
  }

  // the road whose paved surface covers (x, z), or null: { road, d, side, h, s, i, t }
  under(x, z) {
    const list = this.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    let best = null;
    for (let k = 0; k < list.length; k += 2) {
      const road = list[k], i = list[k + 1], g = road.segment(i, x, z);
      if (g.d > road.halfSurface) continue;
      const score = g.d - road.width / 2;
      if (!best || score < best.score) best = { road, i, ...g, score };
    }
    if (best) {
      const { road, i, t } = best;
      best.h = road.h[i] + (road.h[i + 1] - road.h[i]) * t;
      best.s = road.s[i] + (road.s[i + 1] - road.s[i]) * t;
    }
    return best;
  }

  // nearest road centerline within maxD (searches neighboring cells)
  nearest(x, z, maxD = 40, filter = null) {
    const r = Math.ceil(maxD / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = null;
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iz = cz - r; iz <= cz + r; iz++) {
        const list = this.cells.get(key(ix, iz));
        if (!list) continue;
        for (let k = 0; k < list.length; k += 2) {
          const road = list[k], i = list[k + 1];
          if (filter && !filter(road)) continue;
          const g = road.segment(i, x, z);
          if (g.d <= maxD && (!best || g.d < best.d)) best = { road, i, ...g };
        }
      }
    }
    if (best) {
      const { road, i, t } = best;
      best.h = road.h[i] + (road.h[i + 1] - road.h[i]) * t;
      best.s = road.s[i] + (road.s[i + 1] - road.s[i]) * t;
    }
    return best;
  }

  padAt(x, z) {
    const list = this.padCells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    for (const p of list) if (p.covered && p.sd(x, z) <= 0) return p;
    return null;
  }

  // height of the paved surface at (x, z), or null where there is none
  surface(x, z) {
    const p = this.padAt(x, z);
    if (p) return p.h + p.top;
    const u = this.under(x, z);
    if (!u) return null;
    return u.d < u.road.width / 2 ? u.h + 0.02 : u.h + u.road.curb;
  }

  // Shape the terrain around every road and pad: flat under and beside the pavement, then easing
  // back to the natural land (at most 3.5 m of cut or fill near the road).
  shape(terrain, base) {
    const { nx, nz, step, x0, z0 } = terrain;
    const N = nx * nz, de = new Float32Array(N).fill(Infinity), top = new Float32Array(N), inner = new Uint8Array(N), roadH = new Float32Array(N);
    const REACH = 55;
    for (const road of this.roads) {
      for (let i = 0; i < road.n - 1; i++) {
        const xa = Math.min(road.x[i], road.x[i + 1]) - road.flatHalf - REACH, xb = Math.max(road.x[i], road.x[i + 1]) + road.flatHalf + REACH;
        const za = Math.min(road.z[i], road.z[i + 1]) - road.flatHalf - REACH, zb = Math.max(road.z[i], road.z[i + 1]) + road.flatHalf + REACH;
        const ia = Math.max(0, Math.floor((xa - x0) / step)), ib = Math.min(nx - 1, Math.ceil((xb - x0) / step));
        const ja = Math.max(0, Math.floor((za - z0) / step)), jb = Math.min(nz - 1, Math.ceil((zb - z0) / step));
        for (let j = ja; j <= jb; j++) {
          for (let k = ia; k <= ib; k++) {
            const v = j * nx + k, g = road.segment(i, x0 + k * step, z0 + j * step), e = g.d - road.flatHalf;
            if (e < de[v]) {
              const h = road.h[i] + (road.h[i + 1] - road.h[i]) * g.t;
              de[v] = e; roadH[v] = h; top[v] = h + road.curb; inner[v] = g.d < road.halfSurface ? 1 : 0;
            }
          }
        }
      }
    }
    terrain.fill((x, z, v) => {
      const b = base(x, z);
      let h = b;
      if (de[v] < Infinity) {
        if (inner[v]) h = roadH[v] - 0.3;                 // hidden under asphalt and sidewalk
        else if (de[v] <= 0) h = top[v];
        else {
          const target = top[v] + clamp(b - top[v], -3.5, 3.5);
          h = lerp(top[v], target, smoothstep(0, 24, de[v]));
          if (de[v] > 24) h = lerp(target, b, smoothstep(24, REACH, de[v]));
        }
      }
      for (const p of this.pads) {
        if (Math.abs(x - p.x) > p.reach || Math.abs(z - p.z) > p.reach) continue;
        const d = p.sd(x, z);
        if (d > p.blend) continue;
        const target = p.covered ? p.h + p.top - 0.3 : p.h;
        h = lerp(h, d <= 0 ? target : p.h + p.top, d <= 0 ? 1 : 1 - smoothstep(0, p.blend, d));
      }
      return h;
    });
  }
}
