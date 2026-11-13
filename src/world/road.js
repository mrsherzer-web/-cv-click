// The street: a smooth centerline sampled by arc length, with helpers to find the nearest point,
// and builders for the asphalt, sidewalks and curbs that follow it.
import * as THREE from 'three';
import { clamp } from '../core/math.js';

export class Road {
  constructor(points, { width = 7, sidewalk = 2.2, curb = 0.14, samples = 320, baseHeight, maxGrade = 0.08 }) {
    this.width = width;
    this.sidewalk = sidewalk;
    this.curb = curb;
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const pts = curve.getSpacedPoints(samples);
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

    // street height: the land under it, averaged so the street has no bumps, then grade-limited
    const raw = Array.from({ length: n }, (_, i) => baseHeight(this.x[i], this.z[i]));
    const win = 14;
    for (let i = 0; i < n; i++) {
      let sum = 0, c = 0;
      for (let j = Math.max(0, i - win); j <= Math.min(n - 1, i + win); j++) { sum += raw[j]; c++; }
      this.h[i] = sum / c;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) {
        const ds = this.s[i] - this.s[i - 1], lim = maxGrade * ds;
        this.h[i] = clamp(this.h[i], this.h[i - 1] - lim, this.h[i - 1] + lim);
      }
    }
  }

  // left-hand normal at sample i (points to the "left" side when walking toward increasing s)
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

  // nearest point on the centerline: distance d, side (+1 left, -1 right), street height h, arc length s
  nearest(px, pz) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i += 4) {
      const d = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    for (let i = Math.max(0, best - 4); i <= Math.min(this.n - 1, best + 4); i++) {
      const d = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    let res = null;
    for (const [a, b] of [[best - 1, best], [best, best + 1]]) {
      if (a < 0 || b >= this.n) continue;
      const ax = this.x[a], az = this.z[a], bx = this.x[b], bz = this.z[b];
      const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz || 1;
      const t = clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1);
      const qx = ax + vx * t, qz = az + vz * t, d = Math.hypot(px - qx, pz - qz);
      if (!res || d < res.d) {
        const cross = vx * (pz - az) - vz * (px - ax);
        res = { d, side: cross >= 0 ? 1 : -1, h: this.h[a] + (this.h[b] - this.h[a]) * t, s: this.s[a] + (this.s[b] - this.s[a]) * t, qx, qz };
      }
    }
    return res;
  }

  // a ribbon between two lateral offsets (negative = right side), lifted by `lift`
  ribbon(off0, off1, lift, vScale = 1 / 6, sFrom = 0, sTo = Infinity) {
    const pos = [], uv = [], idx = [];
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.s[i] < sFrom - 1 || this.s[i] > sTo + 1) continue;
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

  // a vertical strip at lateral offset `off`, from y0 to y1 above the street height, facing `face` (+1 toward the street)
  wall(off, y0, y1, face, sFrom = 0, sTo = Infinity, vScale = 1 / 2) {
    const pos = [], uv = [], idx = [];
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.s[i] < sFrom || this.s[i] > sTo) continue;
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
}

function makeGeo(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
