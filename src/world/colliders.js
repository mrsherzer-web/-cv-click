// Solid things people, cars and the camera cannot pass through: rotated boxes on the ground plane
// (houses, walls, cars) and circles (trees, poles), each with a height range so a fence on the hill
// does not block the road below it. A grid of cells keeps queries fast across the whole map, and
// moving things (cars, people) live in a short list that is checked every time.
const CELL = 16;
const tmp = { x: 0, z: 0 };
const BODY = 1.6; // height of whatever is being pushed out (a person, a car)

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.dynamic = new Set();
    this.mark = 0;
    this.near = [];
    this.count = 0;
    this.hitHard = false;
    this.hitOwners = [];
  }

  static key(ix, iz) { return (ix + 32768) * 65536 + (iz + 32768); }

  insert(item, x0, z0, x1, z1) {
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const k = CollisionWorld.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(item);
      }
    }
    this.count++;
    return item;
  }

  // yaw follows three.js: local +z points along (sin yaw, cos yaw)
  addBox(cx, cz, hx, hz, yaw, y0 = -Infinity, y1 = Infinity) {
    const b = box(cx, cz, hx, hz, yaw, y0, y1);
    const ex = Math.abs(hx * b.c) + Math.abs(hz * b.s), ez = Math.abs(hx * b.s) + Math.abs(hz * b.c);
    return this.insert(b, cx - ex, cz - ez, cx + ex, cz + ez);
  }

  // a thin wall from (ax, az) to (bx, bz)
  addSegment(ax, az, bx, bz, thickness, y0, y1) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    return this.addBox((ax + bx) / 2, (az + bz) / 2, len / 2, thickness / 2, Math.atan2(-dz / len, dx / len), y0, y1);
  }

  addCircle(cx, cz, r, y0 = -Infinity, y1 = Infinity) {
    return this.insert({ circle: true, cx, cz, r, y0, y1, seen: 0 }, cx - r, cz - r, cx + r, cz + r);
  }

  // a box that moves (a car): keep the returned object and update it with setBox()
  addDynamicBox(owner, hx, hz) {
    const b = box(0, 0, hx, hz, 0, -Infinity, Infinity);
    b.owner = owner;
    b.enabled = true;
    this.dynamic.add(b);
    return b;
  }

  static setBox(b, cx, cz, yaw, y0, y1) {
    b.cx = cx; b.cz = cz; b.c = Math.cos(yaw); b.s = Math.sin(yaw); b.y0 = y0; b.y1 = y1;
  }

  // a person: a circle that moves. Soft: a car that runs into one stops without damage, and people
  // never push the camera in.
  addDynamicCircle(owner, r) {
    const c = { circle: true, cx: 0, cz: 0, r, y0: -Infinity, y1: Infinity, seen: 0, owner, enabled: true, soft: true };
    this.dynamic.add(c);
    return c;
  }

  static setCircle(c, cx, cz, y0, y1) { c.cx = cx; c.cz = cz; c.y0 = y0; c.y1 = y1; }

  // every collider near (x, z) within reach r, without repeats
  gather(x, z, r) {
    const out = this.near;
    out.length = 0;
    const m = ++this.mark;
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const list = this.cells.get(CollisionWorld.key(ix, iz));
        if (!list) continue;
        for (const it of list) if (it.seen !== m) { it.seen = m; out.push(it); }
      }
    }
    for (const it of this.dynamic) if (it.enabled) out.push(it);
    return out;
  }

  // push a circle of radius r standing at height y out of every collider; `ignore` skips one owner's
  // own box. Returns true if anything was hit.
  // After a call, `hitHard` says whether anything solid was hit and `hitOwners` lists the moving
  // things (cars, people) that were.
  resolve(pos, r, y = pos.y, ignore = null) {
    const list = this.gather(pos.x, pos.z, r + 4);
    let hit = false;
    this.hitHard = false;
    this.hitOwners.length = 0;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const it of list) {
        if (it.owner && it.owner === ignore) continue;
        if (y !== undefined && (y > it.y1 || y + BODY < it.y0)) continue;
        let touched = false;
        if (it.circle) {
          const dx = pos.x - it.cx, dz = pos.z - it.cz, d2 = dx * dx + dz * dz, m = r + it.r;
          if (d2 < m * m) {
            const d = Math.sqrt(d2) || 1e-4;
            pos.x = it.cx + (dx / d) * m;
            pos.z = it.cz + (dz / d) * m;
            touched = true;
          }
        } else touched = pushOutOfBox(pos, r, it);
        if (touched) {
          moved = hit = true;
          if (!it.soft) this.hitHard = true;
          if (it.owner && !this.hitOwners.includes(it)) this.hitOwners.push(it);
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  // the first solid thing on the segment from (x0, y0, z0) to (x1, y1, z1), as the fraction along it
  // (0..1), or null when nothing is in the way. Exact, so a thin partition is never stepped over: paint
  // and lines of sight go through doorways, not walls. Soft things (people) never count.
  raycast(x0, y0, z0, x1, y1, z1, ignore = null) {
    const dx = x1 - x0, dz = z1 - z0, dy = y1 - y0;
    const list = this.gather((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(dx, dz) / 2 + 1);
    let best = null;
    for (const it of list) {
      if (it.soft || (it.owner && it.owner === ignore)) continue;
      if (!(it.circle ? rayCircle(x0, z0, dx, dz, it.cx, it.cz, it.r) : rayBox(x0, z0, dx, dz, it))) continue;
      const t = yEntry(y0, dy, span.t0, span.t1, it.y0, it.y1);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }

  // the same segment against a standing cylinder (someone's body): the fraction where it enters, or null
  static segmentCylinder(x0, y0, z0, x1, y1, z1, cx, cz, r, lo, hi) {
    if (!rayCircle(x0, z0, x1 - x0, z1 - z0, cx, cz, r)) return null;
    return yEntry(y0, y1 - y0, span.t0, span.t1, lo, hi);
  }

  // is the point inside any box or circle at its height (keeps the camera out of walls)
  blocks(x, y, z, ignore = null) {
    for (const it of this.gather(x, z, 1)) {
      if (it.soft || (it.owner && it.owner === ignore)) continue;
      if (y < it.y0 || y > it.y1) continue;
      if (it.circle) { if ((x - it.cx) ** 2 + (z - it.cz) ** 2 < it.r * it.r) return true; continue; }
      toLocal(x, z, it);
      if (Math.abs(tmp.x) < it.hx && Math.abs(tmp.z) < it.hz) return true;
    }
    return false;
  }
}

// the segment p + v*t (t in 0..1) against a rotated box: its entry and exit fractions land in `span`
const span = { t0: 0, t1: 1 };
function rayBox(x0, z0, vx, vz, b) {
  const dx = x0 - b.cx, dz = z0 - b.cz;
  const ox = dx * b.c - dz * b.s, oz = dx * b.s + dz * b.c;
  const lx = vx * b.c - vz * b.s, lz = vx * b.s + vz * b.c;
  let t0 = 0, t1 = 1;
  if (Math.abs(lx) < 1e-9) { if (Math.abs(ox) > b.hx) return false; }
  else { let a = (-b.hx - ox) / lx, c = (b.hx - ox) / lx; if (a > c) { const q = a; a = c; c = q; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false; }
  if (Math.abs(lz) < 1e-9) { if (Math.abs(oz) > b.hz) return false; }
  else { let a = (-b.hz - oz) / lz, c = (b.hz - oz) / lz; if (a > c) { const q = a; a = c; c = q; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false; }
  span.t0 = t0; span.t1 = t1;
  return true;
}

// the same against a circle
function rayCircle(x0, z0, vx, vz, cx, cz, r) {
  const fx = x0 - cx, fz = z0 - cz;
  const a = vx * vx + vz * vz, b = 2 * (fx * vx + fz * vz), c = fx * fx + fz * fz - r * r;
  if (a < 1e-12) { if (c > 0) return false; span.t0 = 0; span.t1 = 1; return true; }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const s = Math.sqrt(disc), t0 = (-b - s) / (2 * a), t1 = (-b + s) / (2 * a);
  if (t1 < 0 || t0 > 1) return false;
  span.t0 = Math.max(0, t0); span.t1 = Math.min(1, t1);
  return true;
}

// the first fraction in [t0, t1] where the height y0 + dy*t lies within [lo, hi], or null (over or under it)
function yEntry(y0, dy, t0, t1, lo, hi) {
  const y = y0 + dy * t0;
  if (y >= lo && y <= hi) return t0;
  if (dy === 0) return null;
  const t = (y < lo ? lo - y0 : hi - y0) / dy;
  return t > t0 && t <= t1 ? t : null;
}

function box(cx, cz, hx, hz, yaw, y0, y1) {
  return { cx, cz, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1, seen: 0 };
}

function toLocal(x, z, b) {
  const dx = x - b.cx, dz = z - b.cz;
  tmp.x = dx * b.c - dz * b.s;
  tmp.z = dx * b.s + dz * b.c;
}

function pushOutOfBox(pos, r, b) {
  toLocal(pos.x, pos.z, b);
  const lx = tmp.x, lz = tmp.z;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return false;
  let nx, nz, push;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nx = ex / d; nz = ez / d; push = r - d;
  } else { // the center is inside the box: leave by the shortest way
    const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
    if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; }
  }
  pos.x += (nx * b.c + nz * b.s) * push;
  pos.z += (-nx * b.s + nz * b.c) * push;
  return true;
}
