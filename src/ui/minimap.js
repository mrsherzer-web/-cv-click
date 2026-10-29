// A round map in the corner, turned so that up is where the camera looks: roads and paved areas drawn
// once from the world, the player in the middle, the car, and the current target (at the rim when far).
const PX = 0.5; // pixels per meter in the prerendered map

export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.world = world;
    this.target = null;
    this.wait = 0;
    const b = world.bounds;
    this.x0 = b.x0; this.z0 = b.z0;
    const map = document.createElement('canvas');
    map.width = Math.ceil((b.x1 - b.x0) * PX);
    map.height = Math.ceil((b.z1 - b.z0) * PX);
    const m = map.getContext('2d');
    m.fillStyle = 'rgba(120, 128, 92, 0.55)';
    m.fillRect(0, 0, map.width, map.height);
    const P = (x, z) => [(x - b.x0) * PX, (z - b.z0) * PX];
    for (const pad of world.net.pads) {
      m.fillStyle = 'rgba(200, 196, 186, 0.9)';
      m.save();
      m.translate(...P(pad.x, pad.z));
      if (pad.r) { m.beginPath(); m.arc(0, 0, pad.r * PX, 0, Math.PI * 2); m.fill(); }
      else { m.rotate(-pad.yaw); m.fillRect(-pad.hx * PX, -pad.hz * PX, pad.hx * 2 * PX, pad.hz * 2 * PX); }
      m.restore();
    }
    for (const road of world.net.roads) {
      m.strokeStyle = road.kind === 'highway' ? '#f1ece0' : '#e2dccd';
      m.lineWidth = Math.max(2, road.width * PX * 1.4);
      m.lineCap = m.lineJoin = 'round';
      m.beginPath();
      for (let i = 0; i < road.n; i += 2) { const [x, y] = P(road.x[i], road.z[i]); i ? m.lineTo(x, y) : m.moveTo(x, y); }
      m.stroke();
    }
    this.map = map;
  }

  // dir: the camera's forward direction on the ground; range: meters from the center to the rim
  draw(dt, pos, dir, { car = null, range = 110, others = [] } = {}) {
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = 1 / 15;
    const { g, canvas } = this, R = canvas.width / 2, k = R / range;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.translate(R, R);
    g.rotate(Math.atan2(dir.x, dir.z) + Math.PI);
    g.scale(k / PX, k / PX);
    g.drawImage(this.map, -(pos.x - this.x0) * PX, -(pos.z - this.z0) * PX);
    g.restore();
    // things in map space, turned with the map
    const rot = Math.atan2(dir.x, dir.z) + Math.PI, c = Math.cos(rot), s = Math.sin(rot);
    const place = (x, z) => { const dx = (x - pos.x) * k, dz = (z - pos.z) * k; return [R + dx * c - dz * s, R + dx * s + dz * c]; };
    for (const o of others) {
      const [x, y] = place(o.x, o.z);
      if (Math.hypot(x - R, y - R) > R - 4) continue;
      g.fillStyle = o.color;
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    if (car) {
      const [x, y] = place(car.x, car.z);
      if (Math.hypot(x - R, y - R) < R - 4) { g.fillStyle = '#f4f1ea'; g.fillRect(x - 4, y - 4, 8, 8); }
    }
    if (this.target) {
      let [x, y] = place(this.target.x, this.target.z);
      const d = Math.hypot(x - R, y - R);
      g.fillStyle = '#ffb547';
      if (d > R - 10) { // at the rim, pointing the way
        const a = Math.atan2(y - R, x - R);
        x = R + Math.cos(a) * (R - 10); y = R + Math.sin(a) * (R - 10);
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.closePath(); g.fill();
        g.restore();
      } else {
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2b1a00'; g.lineWidth = 2; g.stroke();
      }
    }
    // the player: an arrow pointing up (where the camera looks)
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(R, R - 9); g.lineTo(R + 7, R + 7); g.lineTo(R, R + 3); g.lineTo(R - 7, R + 7); g.closePath();
    g.stroke(); g.fill();
  }
}
