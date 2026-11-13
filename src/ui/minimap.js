// A round map in the corner, turned so that up is where the camera looks: roads and paved areas drawn
// once from the world, the player in the middle, the car, and the current target (at the rim when far).
// Where there is no map to show (the other dimension, chapter ten) `cover(text)` puts the text in the
// map's place over a field of static; the target, if there is one, is still marked.
const PX = 0.5; // pixels per meter in the prerendered map
const NONE = [];

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
      if (pad.walkOnly) continue; // steps, storeys, decks: not ground to draw
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
    this.covered = null;   // the text shown in the map's place, or null while the map shows
    this.lines = [];
    this.coverFont = `800 ${Math.round(canvas.width * 0.125)}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
  }

  // no map here: `text` in its place (in two lines when it is long) until cover(null) brings the map back
  cover(text = null) {
    text = text ? String(text) : null;
    if (text === this.covered) return;
    this.covered = text;
    this.lines.length = 0;
    if (text) {
      const words = text.split(' ');
      if (text.length > 7 && words.length > 1) { const cut = Math.max(1, Math.round(words.length / 3)); this.lines.push(words.slice(0, cut).join(' '), words.slice(cut).join(' ')); }
      else this.lines.push(text);
      this.canvas.setAttribute('aria-label', text);
    } else this.canvas.setAttribute('aria-label', 'מפה');
    this.wait = 0; // drawn with the next frame
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
    if (this.covered) {
      // nothing known of this place: a dark field, static that jumps with every draw, the text
      g.fillStyle = 'rgba(22, 12, 46, 0.9)';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#c3a6ff';
      for (let i = 0; i < 64; i++) { g.globalAlpha = 0.05 + Math.random() * 0.22; g.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3 + Math.random() * 22, 2); }
      g.globalAlpha = 1;
      g.restore();
      g.save();
      g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = this.coverFont;
      g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = 'rgba(10, 5, 24, 0.85)'; g.fillStyle = '#f1e9ff';
      const L = this.lines, y0 = R + R * 0.36, step = R * 0.29;
      for (let i = 0; i < L.length; i++) { const y = y0 + (i - (L.length - 1) / 2) * step; g.strokeText(L[i], R, y); g.fillText(L[i], R, y); }
      g.restore();
      car = null; others = NONE; // no map, nothing on it; the target below is the one thing still marked
    } else {
      g.translate(R, R);
      g.rotate(Math.atan2(dir.x, dir.z) + Math.PI);
      g.scale(k / PX, k / PX);
      g.drawImage(this.map, -(pos.x - this.x0) * PX, -(pos.z - this.z0) * PX);
      g.restore();
    }
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
