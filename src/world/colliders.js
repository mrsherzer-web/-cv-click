// Solid things the player and camera cannot pass through: rotated boxes on the ground plane
// (houses, walls, cars) and circles (trees, poles). Each box also has a height range for the camera.
const tmp = { x: 0, z: 0 };

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.circles = [];
  }

  // yaw follows three.js: local +z points along (sin yaw, cos yaw)
  addBox(cx, cz, hx, hz, yaw, y0 = -Infinity, y1 = Infinity) {
    this.boxes.push({ cx, cz, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1 });
  }

  // a thin wall from (ax, az) to (bx, bz)
  addSegment(ax, az, bx, bz, thickness, y0, y1) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    this.addBox((ax + bx) / 2, (az + bz) / 2, len / 2, thickness / 2, Math.atan2(-dz / len, dx / len), y0, y1);
  }

  addCircle(cx, cz, r, y0 = -Infinity, y1 = Infinity) {
    this.circles.push({ cx, cz, r, y0, y1 });
  }

  // push a circle of radius r at pos out of every collider; returns true if anything was hit
  resolve(pos, r) {
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const b of this.boxes) if (pushOutOfBox(pos, r, b)) moved = hit = true;
      for (const c of this.circles) {
        const dx = pos.x - c.cx, dz = pos.z - c.cz, d2 = dx * dx + dz * dz, m = r + c.r;
        if (d2 < m * m) {
          const d = Math.sqrt(d2) || 1e-4;
          pos.x = c.cx + (dx / d) * m;
          pos.z = c.cz + (dz / d) * m;
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  // is the point inside any box or circle at its height (used to keep the camera out of walls)
  blocks(x, y, z) {
    for (const b of this.boxes) {
      if (y < b.y0 || y > b.y1) continue;
      toLocal(x, z, b);
      if (Math.abs(tmp.x) < b.hx && Math.abs(tmp.z) < b.hz) return true;
    }
    for (const c of this.circles) {
      if (y >= c.y0 && y <= c.y1 && (x - c.cx) ** 2 + (z - c.cz) ** 2 < c.r * c.r) return true;
    }
    return false;
  }
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
  let ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
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
