/* Heist chapter core: map layout, road graph, collision grid, math helpers, lazy three.js loader.
   Nothing here touches THREE at parse time (it is loaded only when the chapter starts). */
const HX = {
  // ---- city layout: an 8x8 grid of blocks, road centre lines every P metres ----
  P: 70, N: 8, HALF: 280,          // road lines at x,z = -280 + 70*i  (i = 0..8)
  ROAD_HW: 7, LANE: 3.5, SIDEWALK: 4,
  BEACH_X: 287, OCEAN_X: 336,       // east of the last avenue: beach, then the ocean
  BRIDGE_X0: 287, BRIDGE_X1: 860, BRIDGE_HW: 9,
  ISLAND: { x0: 860, x1: 960, z0: -46, z1: 46 },
  SAFEHOUSE: { x: 925, z: 0, r: 9 },
  HOTEL_BLOCK: [1, 3],              // block (i, j) that holds THE BIG SCORE
  PARK_BLOCKS: ['4,4', '6,1', '2,6'],
  L(i) { return -this.HALF + this.P * i; },
  blockCenter(i, j) { return { x: this.L(i) + this.P / 2, z: this.L(j) + this.P / 2 }; },

  // ---- math ----
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
  wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
  rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; },

  /* ================= collision world ================= */
  CELL: 20, boxes: [], circles: [], cells: new Map(), stamp: 0,
  resetWorld() { this.boxes = []; this.circles = []; this.cells = new Map(); },
  _cellKeys(minX, minZ, maxX, maxZ, fn) {
    const c = this.CELL;
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++)
      for (let cz = Math.floor(minZ / c); cz <= Math.floor(maxZ / c); cz++) fn(cx + ',' + cz);
  },
  // solid axis-aligned box (building footprint, wall). h = height (for camera / jumps)
  addBox(minX, minZ, maxX, maxZ, h, kind) {
    const b = { minX, minZ, maxX, maxZ, h: h || 30, kind: kind || 'building', id: this.boxes.length, s: 0 };
    this.boxes.push(b);
    this._cellKeys(minX, minZ, maxX, maxZ, k => { let a = this.cells.get(k); if (!a) this.cells.set(k, a = { b: [], c: [] }); a.b.push(b); });
    return b;
  },
  // small round obstacle (palm, lamp post); breakable ones can be knocked over by cars
  addCircle(x, z, r, kind, obj) {
    const o = { x, z, r, kind, obj, id: this.circles.length, s: 0, down: false };
    this.circles.push(o);
    this._cellKeys(x - r, z - r, x + r, z + r, k => { let a = this.cells.get(k); if (!a) this.cells.set(k, a = { b: [], c: [] }); a.c.push(o); });
    return o;
  },
  query(minX, minZ, maxX, maxZ, out) {
    const st = ++this.stamp; out.b.length = 0; out.c.length = 0;
    this._cellKeys(minX, minZ, maxX, maxZ, k => {
      const a = this.cells.get(k); if (!a) return;
      for (const b of a.b) if (b.s !== st) { b.s = st; out.b.push(b); }
      for (const c of a.c) if (c.s !== st) { c.s = st; out.c.push(c); }
    });
    return out;
  },
  _q: { b: [], c: [] },
  /* push a circle (x,z,r) out of solids. Returns {x,z,nx,nz,hit,depth,what} (normal of the deepest contact) */
  resolveCircle(x, z, r, skipCircles) {
    const q = this.query(x - r, z - r, x + r, z + r, this._q);
    let hit = false, nx = 0, nz = 0, depth = 0, what = null;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of q.b) {
        const px = this.clamp(x, b.minX, b.maxX), pz = this.clamp(z, b.minZ, b.maxZ);
        let dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2), pen;
        if (d < 1e-6) { // centre inside the box: push out along the shallowest axis
          const l = x - b.minX, rr = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z, m = Math.min(l, rr, t, bt);
          if (m === l) { dx = -1; dz = 0; pen = l + r; } else if (m === rr) { dx = 1; dz = 0; pen = rr + r; } else if (m === t) { dx = 0; dz = -1; pen = t + r; } else { dx = 0; dz = 1; pen = bt + r; }
          d = 1;
        } else pen = r - d;
        const ux = dx / d, uz = dz / d;
        x += ux * pen; z += uz * pen;
        if (pen > depth) { depth = pen; nx = ux; nz = uz; what = b; }
        hit = true;
      }
    }
    if (!skipCircles) for (const c of q.c) {
      if (c.down) continue;
      const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), pen = rr - d, ux = dx / d, uz = dz / d;
      x += ux * pen; z += uz * pen; hit = true;
      if (pen > depth) { depth = pen; nx = ux; nz = uz; what = c; }
    }
    return { x, z, nx, nz, hit, depth, what };
  },
  /* 2D segment vs solid boxes: returns the hit fraction t in [0,1] (1 = clear) */
  raycast(x0, z0, x1, z1, minH) {
    const q = this.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), this._q);
    let best = 1; const dx = x1 - x0, dz = z1 - z0;
    for (const b of q.b) {
      if (minH && b.h < minH) continue;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (x0 < b.minX || x0 > b.maxX) continue; }
      else { let a = (b.minX - x0) / dx, c = (b.maxX - x0) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (z0 < b.minZ || z0 > b.maxZ) continue; }
      else { let a = (b.minZ - z0) / dz, c = (b.maxZ - z0) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue; }
      if (t0 < best) best = t0;
    }
    return best;
  },
  canSee(x0, z0, x1, z1) { return this.raycast(x0, z0, x1, z1, 4) >= 0.999; },

  /* ================= road graph ================= */
  nodes: [],
  buildGraph() {
    const N = this.N, nodes = this.nodes = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) nodes.push({ id: nodes.length, i, j, x: this.L(i), z: this.L(j), nbr: [] });
    const at = (i, j) => nodes[i * (N + 1) + j];
    const link = (a, b) => { a.nbr.push(b); b.nbr.push(a); };
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { if (i < N) link(at(i, j), at(i + 1, j)); if (j < N) link(at(i, j), at(i, j + 1)); }
    // the causeway east from Ocean Drive (node 8,4 at x=280, z=0) to the island
    const b1 = { id: nodes.length, x: 570, z: 0, nbr: [], bridge: true }; nodes.push(b1);
    const b2 = { id: nodes.length, x: this.BRIDGE_X1, z: 0, nbr: [], bridge: true }; nodes.push(b2);
    const g = { id: nodes.length, x: 905, z: 0, nbr: [], island: true }; nodes.push(g);
    link(at(N, 4), b1); link(b1, b2); link(b2, g);
    this.nodeAt = at;
    return nodes;
  },
  nearestNode(x, z, filter) {
    let best = null, bd = 1e18;
    for (const n of this.nodes) { if (filter && !filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  },
  // is (x,z) on drivable asphalt? (city grid roads, the causeway, the island road)
  onRoad(x, z, margin) {
    const m = (margin || 0) + this.ROAD_HW, H = this.HALF;
    if (x >= this.BRIDGE_X0 - 7 && x <= 915 && Math.abs(z) <= this.BRIDGE_HW - 1) return true;
    if (x < -H - m || x > H + m || z < -H - m || z > H + m) return false;
    const fx = ((x + H) % this.P + this.P) % this.P, fz = ((z + H) % this.P + this.P) % this.P;
    return Math.min(fx, this.P - fx) <= m || Math.min(fz, this.P - fz) <= m;
  },
  // lane point on the edge a->b at distance s from a (right-hand traffic)
  lanePoint(a, b, s, off) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const o = off === undefined ? this.LANE : off;
    return { x: a.x + ux * s - uz * o, z: a.z + uz * s + ux * o, ux, uz, L };
  },

  /* ================= lazy script loader ================= */
  THREE_SRC: ['vendor/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'],
  loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (this._threeP) return this._threeP;
    const tryLoad = (i) => new Promise((res, rej) => {
      if (i >= this.THREE_SRC.length) { rej(new Error('three.js failed to load')); return; }
      const s = document.createElement('script'); s.src = this.THREE_SRC[i]; s.async = true;
      s.onload = () => window.THREE ? res(window.THREE) : tryLoad(i + 1).then(res, rej);
      s.onerror = () => { s.remove(); tryLoad(i + 1).then(res, rej); };
      document.head.appendChild(s);
    });
    this._threeP = tryLoad(0).catch(e => { this._threeP = null; throw e; });
    return this._threeP;
  },
};
