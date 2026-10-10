// 2.5D collision world: ground height function, solid boxes and round obstacles (trees, pillars).
const CELL = 8;

export class World {
  constructor(ground = () => 0) {
    this.ground = ground;
    this.items = [];
    this.grid = new Map();
    this._stamp = 0;
    this._out = [];
  }

  _index(it) {
    const x0 = Math.floor(it.minX / CELL);
    const x1 = Math.floor(it.maxX / CELL);
    const z0 = Math.floor(it.minZ / CELL);
    const z1 = Math.floor(it.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = ix * 65536 + iz;
        let l = this.grid.get(k);
        if (!l) this.grid.set(k, (l = []));
        l.push(it);
      }
    }
  }

  // Axis-aligned box. opts: y0, y1 (vertical extent), wall (blocks sight), tag, enabled
  box(x0, z0, x1, z1, opts = {}) {
    const it = {
      kind: 'box',
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1),
      maxZ: Math.max(z0, z1),
      y0: opts.y0 ?? -1e4,
      y1: opts.y1 ?? 1e4,
      wall: opts.wall ?? true,
      tag: opts.tag || null,
      enabled: true,
      s: 0,
    };
    this.items.push(it);
    this._index(it);
    return it;
  }

  circle(x, z, r, opts = {}) {
    const it = { kind: 'circle', x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, y0: opts.y0 ?? -1e4, y1: opts.y1 ?? 1e4, wall: opts.wall ?? false, tag: opts.tag || null, enabled: true, s: 0 };
    this.items.push(it);
    this._index(it);
    return it;
  }

  near(x0, z0, x1, z1) {
    const out = this._out;
    out.length = 0;
    const st = ++this._stamp;
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const l = this.grid.get(ix * 65536 + iz);
        if (!l) continue;
        for (const it of l) {
          if (it.s !== st && it.enabled) {
            it.s = st;
            out.push(it);
          }
        }
      }
    }
    return out;
  }

  // Push a circle (x, z, r) at body height y out of everything solid; returns [x, z].
  resolve(x, z, r, y = 0, ignoreTag = null) {
    for (let pass = 0; pass < 3; pass++) {
      const list = this.near(x - r - 1, z - r - 1, x + r + 1, z + r + 1);
      let moved = false;
      for (const it of list) {
        if (it.y1 < y + 0.25 || it.y0 > y + 1.6) continue;
        if (ignoreTag && it.tag === ignoreTag) continue;
        if (it.kind === 'circle') {
          const dx = x - it.x;
          const dz = z - it.z;
          const d = Math.hypot(dx, dz);
          const m = r + it.r;
          if (d < m && d > 1e-6) {
            x = it.x + (dx / d) * m;
            z = it.z + (dz / d) * m;
            moved = true;
          }
        } else {
          const cx = Math.max(it.minX, Math.min(x, it.maxX));
          const cz = Math.max(it.minZ, Math.min(z, it.maxZ));
          const dx = x - cx;
          const dz = z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-9) {
              const d = Math.sqrt(d2);
              x = cx + (dx / d) * r;
              z = cz + (dz / d) * r;
            } else {
              const pl = x - it.minX;
              const pr = it.maxX - x;
              const pb = z - it.minZ;
              const pf = it.maxZ - z;
              const m = Math.min(pl, pr, pb, pf);
              if (m === pl) x = it.minX - r;
              else if (m === pr) x = it.maxX + r;
              else if (m === pb) z = it.minZ - r;
              else z = it.maxZ + r;
            }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }

  // True if a sight line from a to b (2D, at eye height y) is blocked by a wall.
  blocked(ax, az, bx, bz, y = 1.5) {
    const list = this.near(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1);
    for (const it of list) {
      if (!it.wall || it.y1 < y || it.y0 > y) continue;
      if (it.kind === 'box') {
        if (segBox(ax, az, bx, bz, it.minX, it.minZ, it.maxX, it.maxZ) < 1) return true;
      } else if (segCircle(ax, az, bx, bz, it.x, it.z, it.r)) return true;
    }
    return false;
  }

  // Fraction along a->b (3D) before hitting a solid; 1 if clear. Used to keep the camera out of walls.
  hit(a, b, pad = 0.25) {
    const list = this.near(Math.min(a.x, b.x) - 1, Math.min(a.z, b.z) - 1, Math.max(a.x, b.x) + 1, Math.max(a.z, b.z) + 1);
    let best = 1;
    for (const it of list) {
      if (it.kind !== 'box') continue;
      const t = segBox3(a, b, it.minX - pad, it.y0 - pad, it.minZ - pad, it.maxX + pad, it.y1 + pad, it.maxZ + pad);
      if (t < best) best = t;
    }
    return best;
  }
}

function segBox(ax, az, bx, bz, x0, z0, x1, z1) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  for (const [o, d, lo, hi] of [
    [ax, dx, x0, x1],
    [az, dz, z0, z1],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return 1;
    } else {
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return 1;
    }
  }
  return t0;
}

function segBox3(a, b, x0, y0, z0, x1, y1, z1) {
  let t0 = 0;
  let t1 = 1;
  const o = [a.x, a.y, a.z];
  const d = [b.x - a.x, b.y - a.y, b.z - a.z];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return 1;
    } else {
      let p = (lo[i] - o[i]) / d[i];
      let q = (hi[i] - o[i]) / d[i];
      if (p > q) [p, q] = [q, p];
      t0 = Math.max(t0, p);
      t1 = Math.min(t1, q);
      if (t0 > t1) return 1;
    }
  }
  return t0;
}

function segCircle(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / l2));
  const px = ax + dx * t - cx;
  const pz = az + dz * t - cz;
  return px * px + pz * pz < r * r;
}
