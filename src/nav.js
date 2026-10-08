// Grid navigation + line-of-sight for Noam's AI.
// The apartment is rasterised into 0.25m cells: blocked (walls/furniture),
// opaque (blocks vision), and door cells (passable only when the door isn't locked).

export class NavGrid {
  constructor(minX, minZ, maxX, maxZ, cell = 0.25) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.opaque = new Uint8Array(n);
    this.door = new Int16Array(n).fill(-1);
    this.doors = [];
  }

  idx(i, j) { return j * this.w + i; }
  toCell(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  center(i, j) { return [this.minX + (i + 0.5) * this.cell, this.minZ + (j + 0.5) * this.cell]; }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }

  rasterize(colliders, agentR = 0.3) {
    for (const c of colliders) {
      if (c.door != null) continue;
      if (c.maxY < 0.25 || c.minY > 1.7) continue;
      const tall = c.maxY > 1.55 && c.minY < 0.5 && c.opaque !== false;
      const [i0, j0] = this.toCell(c.minX - agentR, c.minZ - agentR);
      const [i1, j1] = this.toCell(c.maxX + agentR, c.maxZ + agentR);
      for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) {
          if (c.nav !== false) this.blocked[this.idx(i, j)] = 1;
        }
      }
      if (tall) {
        const [a0, b0] = this.toCell(c.minX + 0.02, c.minZ + 0.02);
        const [a1, b1] = this.toCell(c.maxX - 0.02, c.maxZ - 0.02);
        for (let j = Math.max(0, b0); j <= Math.min(this.h - 1, b1); j++)
          for (let i = Math.max(0, a0); i <= Math.min(this.w - 1, a1); i++) this.opaque[this.idx(i, j)] = 1;
      }
    }
  }

  // Door opening: cells along the opening are marked with the door index (and unblocked)
  addDoor(door, box) {
    const id = this.doors.length;
    this.doors.push(door);
    door.navId = id;
    const [i0, j0] = this.toCell(box.minX, box.minZ);
    const [i1, j1] = this.toCell(box.maxX, box.maxZ);
    door.cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!this.inside(i, j)) continue;
      const k = this.idx(i, j);
      this.door[k] = id; this.blocked[k] = 0;
      door.cells.push(k);
    }
  }

  walkable(i, j) {
    if (!this.inside(i, j)) return false;
    const k = this.idx(i, j);
    if (this.blocked[k]) return false;
    const d = this.door[k];
    if (d >= 0 && this.doors[d].locked && !this.doors[d].noamCanPass) return false;
    return true;
  }

  isOpaque(i, j) {
    if (!this.inside(i, j)) return true;
    const k = this.idx(i, j);
    if (this.opaque[k]) return true;
    const d = this.door[k];
    return d >= 0 && this.doors[d].openAmount < 0.4;
  }

  // DDA ray through cells; true if nothing opaque in between
  lineOfSight(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const [i, j] = this.toCell(x0 + dx * t, z0 + dz * t);
      if (this.isOpaque(i, j)) return false;
    }
    return true;
  }

  walkLine(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const [i, j] = this.toCell(x0 + dx * t, z0 + dz * t);
      if (!this.walkable(i, j)) return false;
    }
    return true;
  }

  nearestWalkable(x, z, maxR = 8) {
    let [ci, cj] = this.toCell(x, z);
    if (this.walkable(ci, cj)) return [ci, cj];
    for (let r = 1; r < maxR; r++) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.abs(i - ci) !== r && Math.abs(j - cj) !== r) continue;
        if (this.walkable(i, j)) return [i, j];
      }
    }
    return null;
  }

  // A* with octile heuristic; returns smoothed list of [x,z] waypoints
  findPath(sx, sz, tx, tz) {
    const s = this.nearestWalkable(sx, sz);
    const t = this.nearestWalkable(tx, tz);
    if (!s || !t) return null;
    const W = this.w, N = W * this.h;
    const start = this.idx(s[0], s[1]), goal = this.idx(t[0], t[1]);
    if (start === goal) return [[tx, tz]];
    const g = this._g || (this._g = new Float32Array(N));
    const came = this._came || (this._came = new Int32Array(N));
    const closed = this._closed || (this._closed = new Uint8Array(N));
    g.fill(Infinity); came.fill(-1); closed.fill(0);
    const heap = new MinHeap();
    const h = (k) => { const i = k % W, j = (k / W) | 0; const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[start] = 0; heap.push(start, h(start));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (heap.size && iter++ < 40000) {
      const k = heap.pop();
      if (k === goal) { found = true; break; }
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of dirs) {
        const ni = i + di, nj = j + dj;
        if (!this.walkable(ni, nj)) continue;
        if (di && dj && (!this.walkable(i + di, j) || !this.walkable(i, j + dj))) continue;
        const nk = this.idx(ni, nj);
        const ng = g[k] + c;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = k; heap.push(nk, ng + h(nk)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => this.center(k % W, (k / W) | 0));
    pts[pts.length - 1] = [tx, tz];
    // string pulling
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.walkLine(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--;
      out.push(pts[b]); a = b;
    }
    return out;
  }

  doorsOnSegment(x0, z0, x1, z1) {
    const res = new Set();
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const [i, j] = this.toCell(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (!this.inside(i, j)) continue;
      const d = this.door[this.idx(i, j)];
      if (d >= 0) res.add(this.doors[d]);
    }
    return [...res];
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]]; [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}
