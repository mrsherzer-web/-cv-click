// Drives a car along a list of points: steers toward a point a little ahead on the path, slows for
// bends and for the end. Used by traffic, by friends who drive, and by tests that need real driving.
import { clamp, angleDiff } from '../core/math.js';

export class Autopilot {
  // points: [{ x, z }], spaced a few meters apart; cruise: top speed in m/s
  constructor(points, { cruise = 13, stopAtEnd = true } = {}) {
    this.points = points;
    this.cruise = cruise;
    this.stopAtEnd = stopAtEnd;
    this.i = 0;
    this.done = false;
  }

  // the input a driver would give this frame
  drive(car) {
    const P = this.points, n = P.length;
    // advance along the path to the point nearest the car
    let best = this.i, bd = Infinity;
    for (let k = this.i; k < Math.min(n, this.i + 30); k++) {
      const d = Math.hypot(P[k].x - car.pos.x, P[k].z - car.pos.z);
      if (d < bd) { bd = d; best = k; }
    }
    this.i = best;
    const speed = Math.max(0, car.speed);
    const look = 5 + speed * 0.55;
    let j = best, acc = 0;
    while (j < n - 1 && acc < look) { acc += Math.hypot(P[j + 1].x - P[j].x, P[j + 1].z - P[j].z); j++; }
    const t = P[j];
    const err = angleDiff(car.yaw, Math.atan2(t.x - car.pos.x, t.z - car.pos.z));
    // each bend ahead has a safe speed (from how tight it is); slow down early enough to make it
    let want = this.cruise, dist = 0;
    for (let k = best; k < n - 2 && dist < 70; k++) {
      const l1 = Math.hypot(P[k + 1].x - P[k].x, P[k + 1].z - P[k].z), l2 = Math.hypot(P[k + 2].x - P[k + 1].x, P[k + 2].z - P[k + 1].z);
      dist += l1;
      const a = Math.atan2(P[k + 1].x - P[k].x, P[k + 1].z - P[k].z), b = Math.atan2(P[k + 2].x - P[k + 1].x, P[k + 2].z - P[k + 1].z);
      const turn = Math.abs(angleDiff(a, b));
      if (turn < 0.02) continue;
      const radius = (l1 + l2) / 2 / turn, safe = Math.max(2.2, Math.sqrt(3.2 * radius));
      want = Math.min(want, Math.sqrt(safe * safe + 2 * 3.5 * Math.max(0, dist - 2)));
    }
    let left = 0;
    for (let k = best; k < n - 1 && left < 40; k++) left += Math.hypot(P[k + 1].x - P[k].x, P[k + 1].z - P[k].z);
    if (Math.abs(err) > 0.5) want = Math.min(want, 5);
    if (this.stopAtEnd) want = Math.min(want, Math.max(0, (left - 1.5) * 0.9));
    this.done = this.stopAtEnd ? left < 2.5 && speed < 0.6 : best >= n - 2;
    const dv = want - speed;
    return {
      steer: clamp(-err * 2.4, -1, 1),
      throttle: dv > 0.3 ? clamp(dv / 3, 0, 1) : 0,
      brake: dv < -0.8 ? clamp(-dv / 4, 0, 1) : 0,
      handbrake: false,
    };
  }
}

// a path along a road from arc length s0 to s1 (either direction), on one lane
export function roadPath(road, s0, s1, lane = -1.8, step = 3) {
  const out = [], dir = s1 >= s0 ? 1 : -1;
  for (let s = s0; dir > 0 ? s <= s1 : s >= s1; s += step * dir) {
    const p = road.at(s), off = lane * dir;
    out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off });
  }
  const p = road.at(s1), off = lane * dir;
  out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off });
  return out;
}
