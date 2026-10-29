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
  resolve(pos, r, y = pos.y, ignore = null) {
    const list = this.gather(pos.x, pos.z, r + 4);
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const it of list) {
        if (it.owner && it.owner === ignore) continue;
        if (y !== undefined && (y > it.y1 || y + BODY < it.y0)) continue;
        if (it.circle) {
          const dx = pos.x - it.cx, dz = pos.z - it.cz, d2 = dx * dx + dz * dz, m = r + it.r;
          if (d2 < m * m) {
            const d = Math.sqrt(d2) || 1e-4;
            pos.x = it.cx + (dx / d) * m;
            pos.z = it.cz + (dz / d) * m;
            moved = hit = true;
          }
        } else if (pushOutOfBox(pos, r, it)) moved = hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  // is the point inside any box or circle at its height (keeps the camera out of walls)
  blocks(x, y, z, ignore = null) {
    for (const it of this.gather(x, z, 1)) {
      if (it.owner && it.owner === ignore) continue;
      if (y < it.y0 || y > it.y1) continue;
      if (it.circle) { if ((x - it.cx) ** 2 + (z - it.cz) ** 2 < it.r * it.r) return true; continue; }
      toLocal(x, z, it);
      if (Math.abs(tmp.x) < it.hx && Math.abs(tmp.z) < it.hz) return true;
    }
    return false;
  }
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
