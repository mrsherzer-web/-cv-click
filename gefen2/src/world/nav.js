// ============================================================================
//  Navigation grid: collision for the player, A* paths and line of sight for
//  the enemies.  0.25 m cells over the whole complex.
// ============================================================================
import { ROOMS, DOORS, WORLD_BOUNDS, WALL } from './layout.js';

export const CELL = 0.25;

export class Nav {
  constructor() {
    const b = WORLD_BOUNDS;
    this.x0 = b.x0;
    this.z0 = b.z0;
    this.w = Math.ceil((b.x1 - b.x0) / CELL);
    this.h = Math.ceil((b.z1 - b.z0) / CELL);
    const n = this.w * this.h;
    this.open = new Uint8Array(n); // 1 = inside a room or an open door
    this.prop = new Uint8Array(n); // 1 = blocked by furniture (walkers), 2 = also blocks sight
    this.walk = new Uint8Array(n); // 1 = an agent centre may be here (inflated)
    this.doorCells = {}; // door id -> list of cell indices
    this.closed = new Set(); // closed door ids
    this._rasterRooms();
  }

  ix(x) {
    return Math.floor((x - this.x0) / CELL);
  }
  iz(z) {
    return Math.floor((z - this.z0) / CELL);
  }
  idx(x, z) {
    const i = this.ix(x);
    const j = this.iz(z);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  cx(i) {
    return this.x0 + (i + 0.5) * CELL;
  }
  cz(j) {
    return this.z0 + (j + 0.5) * CELL;
  }

  _fill(arr, x0, z0, x1, z1, v) {
    const i0 = Math.max(0, this.ix(x0 + 1e-4));
    const i1 = Math.min(this.w - 1, this.ix(x1 - 1e-4));
    const j0 = Math.max(0, this.iz(z0 + 1e-4));
    const j1 = Math.min(this.h - 1, this.iz(z1 - 1e-4));
    const out = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * this.w + i;
        if (arr) arr[k] = v;
        out.push(k);
      }
    return out;
  }

  _rasterRooms() {
    for (const id in ROOMS) {
      const r = ROOMS[id].rect;
      this._fill(this.open, r[0], r[1], r[2], r[3], 1);
    }
    for (const id in DOORS) {
      const d = DOORS[id];
      const half = d.w / 2;
      const g = WALL / 2 + 0.05;
      const cells = d.axis === 'x'
        ? this._fill(this.open, d.c - half, d.at - g, d.c + half, d.at + g, 1)
        : this._fill(this.open, d.at - g, d.c - half, d.at + g, d.c + half, 1);
      this.doorCells[id] = cells;
      if (d.lock) this.closed.add(id);
    }
  }

  /** Furniture footprint. tall = also blocks line of sight. */
  block(x0, z0, x1, z1, tall = false) {
    this._fill(this.prop, Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), tall ? 2 : 1);
  }

  setDoor(id, isOpen) {
    if (isOpen) this.closed.delete(id);
    else this.closed.add(id);
    this.bake();
  }

  /** Build the inflated walk grid. Call after all props are placed and whenever a door changes. */
  bake(radius = 0.27) {
    const { w, h, open, prop, walk } = this;
    const solid = new Uint8Array(w * h);
    for (let k = 0; k < solid.length; k++) solid[k] = open[k] && !prop[k] ? 0 : 1;
    for (const id of this.closed) for (const k of this.doorCells[id]) solid[k] = 1;
    this.solid = solid;
    const r = Math.max(1, Math.round(radius / CELL));
    // two pass box inflate (cheap, slightly conservative on diagonals)
    const tmp = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -r; d <= r && !s; d++) {
          const ii = i + d;
          s = ii < 0 || ii >= w ? 1 : solid[j * w + ii];
        }
        tmp[j * w + i] = s;
      }
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -r; d <= r && !s; d++) {
          const jj = j + d;
          s = jj < 0 || jj >= h ? 1 : tmp[jj * w + i];
        }
        walk[j * w + i] = s ? 0 : 1;
      }
    }
    // sight grid: walls, closed (non glass) doors and tall props
    const sight = (this.sight = new Uint8Array(w * h));
    for (let k = 0; k < sight.length; k++) sight[k] = !open[k] || prop[k] === 2 ? 1 : 0;
    for (const id of this.closed) if (!DOORS[id].glass) for (const k of this.doorCells[id]) sight[k] = 1;
  }

  canWalk(x, z) {
    const k = this.idx(x, z);
    return k >= 0 && this.walk[k] === 1;
  }

  /** Move a point agent with sliding. Returns the new [x, z]. */
  move(x, z, dx, dz) {
    const step = Math.max(Math.abs(dx), Math.abs(dz));
    const n = Math.max(1, Math.ceil(step / (CELL * 0.6)));
    const sx = dx / n;
    const sz = dz / n;
    for (let s = 0; s < n; s++) {
      if (this.canWalk(x + sx, z + sz)) {
        x += sx;
        z += sz;
      } else if (this.canWalk(x + sx, z)) x += sx;
      else if (this.canWalk(x, z + sz)) z += sz;
      else break;
    }
    return [x, z];
  }

  /** Nearest walkable cell centre to a point (spiral search). */
  nearest(x, z, maxR = 12) {
    if (this.canWalk(x, z)) return [x, z];
    const i0 = this.ix(x);
    const j0 = this.iz(z);
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bd = 1e9;
      for (let j = j0 - r; j <= j0 + r; j++)
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          if (!this.walk[j * this.w + i]) continue;
          const d = (this.cx(i) - x) ** 2 + (this.cz(j) - z) ** 2;
          if (d < bd) {
            bd = d;
            best = [this.cx(i), this.cz(j)];
          }
        }
      if (best) return best;
    }
    return [x, z];
  }

  /** Line of sight on the sight grid (walls and tall furniture block). */
  los(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    const n = Math.ceil(dist / (CELL * 0.5));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const k = this.idx(x0 + dx * t, z0 + dz * t);
      if (k < 0 || this.sight[k]) return false;
    }
    return true;
  }

  /** A* on the walk grid (8 directions). Returns [[x,z],...] or null. */
  path(x0, z0, x1, z1, maxNodes = 14000) {
    const { w, h, walk } = this;
    [x0, z0] = this.nearest(x0, z0);
    [x1, z1] = this.nearest(x1, z1);
    const s = this.idx(x0, z0);
    const g = this.idx(x1, z1);
    if (s < 0 || g < 0) return null;
    if (s === g) return [[x1, z1]];
    const n = w * h;
    if (!this._g) {
      this._g = new Float32Array(n);
      this._from = new Int32Array(n);
      this._stamp = new Uint32Array(n);
      this._closed = new Uint32Array(n);
      this._tick = 0;
    }
    const tick = ++this._tick;
    const gS = this._g;
    const from = this._from;
    const stamp = this._stamp;
    const closed = this._closed;
    const gi = g % w;
    const gj = (g / w) | 0;
    const heur = (k) => {
      const dx = Math.abs((k % w) - gi);
      const dz = Math.abs(((k / w) | 0) - gj);
      return Math.max(dx, dz) + 0.41 * Math.min(dx, dz);
    };
    // binary heap of [f, k]
    const heapK = [];
    const heapF = [];
    const push = (k, f) => {
      let i = heapK.length;
      heapK.push(k);
      heapF.push(f);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= f) break;
        heapK[i] = heapK[p];
        heapF[i] = heapF[p];
        i = p;
      }
      heapK[i] = k;
      heapF[i] = f;
    };
    const pop = () => {
      const top = heapK[0];
      const lk = heapK.pop();
      const lf = heapF.pop();
      const len = heapK.length;
      if (len) {
        let i = 0;
        for (;;) {
          let c = i * 2 + 1;
          if (c >= len) break;
          if (c + 1 < len && heapF[c + 1] < heapF[c]) c++;
          if (heapF[c] >= lf) break;
          heapK[i] = heapK[c];
          heapF[i] = heapF[c];
          i = c;
        }
        heapK[i] = lk;
        heapF[i] = lf;
      }
      return top;
    };
    gS[s] = 0;
    stamp[s] = tick;
    from[s] = -1;
    push(s, heur(s));
    let count = 0;
    let found = false;
    let bestK = s;
    let bestH = heur(s);
    while (heapK.length) {
      const k = pop();
      if (closed[k] === tick) continue;
      closed[k] = tick;
      if (k === g) {
        found = true;
        break;
      }
      const hk = heur(k);
      if (hk < bestH) {
        bestH = hk;
        bestK = k;
      }
      if (++count > maxNodes) break;
      const i = k % w;
      const j = (k / w) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const nk = nj * w + ni;
          if (!walk[nk] || closed[nk] === tick) continue;
          if (di && dj && (!walk[j * w + ni] || !walk[nj * w + i])) continue; // no corner cutting
          const ng = gS[k] + (di && dj ? 1.41 : 1);
          if (stamp[nk] !== tick || ng < gS[nk]) {
            gS[nk] = ng;
            stamp[nk] = tick;
            from[nk] = k;
            push(nk, ng + heur(nk));
          }
        }
      }
    }
    // goal sealed off (a pocket behind furniture, a closed door): go as close as possible
    let end = g;
    if (!found) {
      if (bestK === s) return null;
      end = bestK;
      x1 = this.cx(end % w);
      z1 = this.cz((end / w) | 0);
    }
    const cells = [];
    for (let k = end; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    // string pulling: keep only the corners that are needed
    const pts = cells.map((k) => [this.cx(k % w), this.cz((k / w) | 0)]);
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = Math.min(pts.length - 1, a + 40);
      while (b > a + 1 && !this._clear(pts[a], pts[b])) b--;
      out.push(pts[b]);
      a = b;
    }
    out[out.length - 1] = [x1, z1];
    return out;
  }

  _clear(p, q) {
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const n = Math.ceil(Math.hypot(dx, dz) / (CELL * 0.45));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (!this.canWalk(p[0] + dx * t, p[1] + dz * t)) return false;
    }
    return true;
  }

  /** Walking distance along a path (or Infinity). */
  pathLength(x0, z0, x1, z1) {
    const p = this.path(x0, z0, x1, z1);
    if (!p) return Infinity;
    let d = 0;
    let px = x0;
    let pz = z0;
    for (const [x, z] of p) {
      d += Math.hypot(x - px, z - pz);
      px = x;
      pz = z;
    }
    return d;
  }
}
