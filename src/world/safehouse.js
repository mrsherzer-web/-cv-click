// The safe house (chapter nine, "מבצע אלמוות"): בית המסתור, a one-storey house on the plain where the gang
// rests after chapter eight. Its pad is x 622..678, z -193..-157 (centre (650, -175)); the house stands in
// the west half and the yard, walled, opens east through a wide gate onto the death road's start at about
// (680, -175). Inside: a living room with two sofas, two armchairs, a coffee table on a rug and a big TV on
// the west wall; a kitchen corner open to it; a hallway from the front door; a gear room (the gang's paint
// markers on a wall rack, bags on a table); a bunk room. Site-local axes: origin at the pad's centre, +x
// east, +z south. Everything here is invented.
//
// The place object, ctx.places.safehouse (every field; a spot is { x, z, yaw, y } in world coordinates):
//   x, z, y             the pad's centre and the floor height (the house floor and the yard are level)
//   toWorld, toLocal    site-local <-> world
//   group               the site's THREE.Group
//   bounds              the pad { x0, z0, x1, z1 }; house: the house's footprint { x0, z0, x1, z1 }
//   inside(x, z)        true inside the house's walls
//   living, kitchen, hallway, gearRoom, bunkRoom   a free standing spot in each room
//   tv                  the screen's centre { x, z, y, yaw } (yaw: the way it faces, into the room)
//   tvFront             where to stand to look at the TV (facing it)
//   screen              the TV: screen.show('off' | 'shadow' | 'video' | 'map', opts?) draws it on a canvas
//                       texture and turns it on ('off' turns it off; it works with the power out too: the
//                       Shadow's signal lights it). opts: { caption } for any mode; for 'video' also
//                       { time }; for 'map' also { title, bases: [{ label, x, y }] } (x, y in 0..1).
//                       screen.mode (the mode shown), screen.on, screen.mesh, screen.material, screen.texture
//   seats               nine sitting spots around the TV, in this order: 0 Nehorai, 1 Erez, 2 Ido, 3 Yonati,
//                       4 Avraham, 5 Muller, 6 Dolev, 7 Hadar, 8 Liam (seats[i + 1] is TEAM[i] of
//                       firestorm.js). Each { x, z, yaw, y, k, who, on: 'sofa' | 'side' | 'armchair' }; sit a
//                       person there with npc.place(s.x, s.z, s.yaw, s.y) and the 'sit' pose. Every seat is
//                       clear of the furniture's colliders, so the player can sit in any of them too.
//   seatFor(id)         the seat of 'nehorai', 'erez', ... (null for anyone else)
//   kitchenSeats        four more chairs at the kitchen table, same shape as a seat
//   sofa, coffeeTable   the main sofa's and the coffee table's centres { x, z, y }
//   gear                the pickup spot in the gear room: { x, z, yaw, y } stands facing the rack;
//                       gear.mesh (the gang's markers on the rack, a group: hide it when taken),
//                       gear.bags (the bags and masks on the table, a group), gear.rack and gear.table
//                       ({ x, z, y }), gear.slots.nehorai .. gear.slots.liam (each marker's { x, y, z }),
//                       gear.taken, gear.take({ bags = true }) hides them, gear.reset() puts them back
//   lights(on)          the house's power: false switches off every lamp of the place (rooms, porch, gate)
//                       and their bulbs and windows, and turns the TV off; true brings the lamps back (the
//                       TV stays as it is). lightsOn tells which. The TV's glow (a lamp in front of it, red
//                       for the Shadow) follows the screen, not the power: lights(false) then
//                       screen.show('shadow') leaves the room lit only by the TV.
//   switch              the light switch in the living room by the hallway: { x, z, y, mesh, at } (at: the
//                       spot to stand at it); breaker: the fuse box in the hallway, the same shape
//   door                the front door (a site door: setOpen(open), lock(), unlock(), open, locked); it is
//                       open after the build. doorAt: just inside it; outside: just outside, on the porch
//   yard                the middle of the yard, between the door and the cars
//   gate                the yard's gate (a 12 m opening in the east wall, no leaf); gateOutside: past it,
//                       at the death road's start; roadStart: { x, z } of that start (680, -175)
//   behind              the strip behind the house (west), to walk round it
//   terrace             beside the picnic table under the pergola, north of the drive
//   car                 the Renault's spot { x, z, yaw, y }; cars: two more spots for the gang's cars. All
//                       three face north-east toward the gate and the death road's start, with a clear run
//   kit                 a first-aid kit on a cabinet in the bunk room: { x, z, y, mesh, at }
//   lamps, emissives    the night lamps and glowing materials (main.js wires them to the night)
//   reset()             lights on, TV off, gear back, door open: the state after the build
//   tick(camera, dt)    per frame (world.js): the lamps, the windows, the screen's flicker
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { SIGN_FONT } from './textures.js';
import { rng } from '../core/math.js';
import { COLORS } from '../combat/paint.js';

const C = { x: 650, z: -175 }, HX = 28, HZ = 18;          // the pad
const X0 = -24, X1 = -4, Z0 = -10, Z1 = 9, H = 3.0;       // the house
const PX = -13;                                           // the wall between the living room and the rooms east of it
const ROAD = { lx: 30, lz: 0 };                            // the death road's start, just past the gate
const GANG = ['nehorai', 'erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
const HEB = { nehorai: 'נהוראי', erez: 'ארז', ido: 'עידו', yonati: 'יונתי', avraham: 'אברהם', muller: 'מולר', dolev: 'דולב', hadar: 'הדר', liam: 'ליאם' };

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  net.addPad({ x: C.x, z: C.z, hx: HX, hz: HZ, yaw: 0, h, top: 0.05, blend: 10, name: 'safehouse' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: HX + 6, hz: HZ + 6 });
  ctx.safehouse = { y: h + 0.05 };
}

// ---------- canvases: the TV's pictures, the rug, the names on the rack ----------
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${SIGN_FONT}`;
const scan = (g, w, h, a = 0.2, step = 3) => { g.fillStyle = `rgba(0,0,0,${a})`; for (let y = 0; y < h; y += step) g.fillRect(0, y, w, 1); };
const vignette = (g, w, h, a = 0.75) => {
  const gr = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
};
const grain = (g, w, h, r, n = 2600, a = 0.12) => { for (let i = 0; i < n; i++) { const v = r(); g.fillStyle = v > 0.5 ? `rgba(255,255,255,${a * v})` : `rgba(0,0,0,${a * (1 - v) * 1.5})`; g.fillRect(r() * w, r() * h, 2, 2); } };
const caption = (g, w, h, text) => {
  if (!text) return;
  g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, h - 74, w, 74);
  g.fillStyle = '#f3efe6'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(40); g.fillText(text, w / 2, h - 37);
};

// the screen switched off: a dark glass with a faint reflection
function drawOff(g, w, h) {
  g.fillStyle = '#07080a'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

// the Shadow: a dark figure in a black mask (a balaclava with an eye slit) against red and black
function drawShadow(g, w, h, o) {
  const r = rng(77);
  let gr = g.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.45, w * 0.62);
  gr.addColorStop(0, '#9a0d0d'); gr.addColorStop(0.42, '#420505'); gr.addColorStop(1, '#060000');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + 0.1 * r()})`; g.beginPath(); g.ellipse(r() * w, r() * h, 80 + r() * 160, 18 + r() * 30, (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill(); }
  const cx = w / 2, hy = h * 0.4;
  // the shoulders and the hood, one silhouette
  const body = () => {
    g.beginPath();
    g.moveTo(w * 0.13, h);
    g.bezierCurveTo(w * 0.15, h * 0.8, w * 0.32, h * 0.7, w * 0.42, h * 0.66);
    g.bezierCurveTo(w * 0.385, h * 0.52, w * 0.39, h * 0.2, cx, h * 0.12);
    g.bezierCurveTo(w * 0.61, h * 0.2, w * 0.615, h * 0.52, w * 0.58, h * 0.66);
    g.bezierCurveTo(w * 0.68, h * 0.7, w * 0.85, h * 0.8, w * 0.87, h);
    g.closePath();
  };
  body(); g.fillStyle = '#050505'; g.fill();
  g.save(); body(); g.strokeStyle = 'rgba(255,70,55,0.45)'; g.lineWidth = 6; g.stroke(); g.restore();
  // the mask's head inside the hood, a shade lighter, with its seams
  g.fillStyle = '#0d0d0f'; g.beginPath(); g.ellipse(cx, hy, w * 0.085, h * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx, hy - h * 0.2); g.lineTo(cx, hy - h * 0.06); g.stroke();
  g.beginPath(); g.ellipse(cx, hy + h * 0.1, w * 0.05, h * 0.05, 0, 0.2, Math.PI - 0.2); g.stroke();
  // the eye slit and the eyes
  g.fillStyle = '#24110d';
  rrect(g, cx - w * 0.066, hy - h * 0.035, w * 0.132, h * 0.062, 14); g.fill();
  for (const sx of [-1, 1]) {
    const ex = cx + sx * w * 0.031, ey = hy - h * 0.004;
    g.fillStyle = '#bdb4aa'; g.beginPath(); g.ellipse(ex, ey, 15, 7.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#140707'; g.beginPath(); g.arc(ex - sx * 2, ey, 5.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,90,70,0.95)'; g.fillRect(ex - sx * 4, ey - 3, 2.5, 2.5);
  }
  scan(g, w, h, 0.22); grain(g, w, h, r, 1800, 0.1); vignette(g, w, h, 0.8);
  g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(w - 46, 42, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd9d6'; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.font = font(30); g.fillText('שידור חי', w - 68, 43);
  caption(g, w, h, o.caption);
}

// a still from a video: a huge industrial compound at night, with a caption
function drawVideo(g, w, h, o) {
  const r = rng(91), base = h * 0.7;
  let gr = g.createLinearGradient(0, 0, 0, base);
  gr.addColorStop(0, '#02040a'); gr.addColorStop(1, '#1a2540');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  gr = g.createRadialGradient(w * 0.5, base, 10, w * 0.5, base, w * 0.55);
  gr.addColorStop(0, 'rgba(255,165,90,0.32)'); gr.addColorStop(1, 'rgba(255,165,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(220,230,255,${0.2 + r() * 0.5})`; g.fillRect(r() * w, r() * h * 0.35, 1.5, 1.5); }
  const dark = '#06080e', lights = [], beacons = [];
  g.fillStyle = dark;
  // long halls and sheds along the horizon
  for (let x = -20; x < w + 20;) { const bw = 60 + r() * 120, bh = 30 + r() * 70; g.fillRect(x, base - bh, bw, bh + 2); for (let k = 0; k < bw * bh / 900; k++) lights.push([x + r() * bw, base - r() * bh * 0.9]); x += bw + r() * 12; }
  // tanks
  for (const [tx, tr] of [[120, 46], [215, 38], [790, 52], [880, 40]]) { g.beginPath(); g.ellipse(tx, base - tr * 1.2, tr, tr * 0.32, 0, 0, Math.PI * 2); g.fill(); g.fillRect(tx - tr, base - tr * 1.2, tr * 2, tr * 1.2 + 2); beacons.push([tx, base - tr * 1.55]); }
  // chimneys
  for (const [cx, ch] of [[300, 190], [330, 160], [690, 210], [728, 175]]) { g.fillRect(cx - 9, base - ch, 18, ch); beacons.push([cx, base - ch - 6]); }
  // the tower in the middle, far taller than the rest
  g.fillRect(w * 0.5 - 34, base - 330, 68, 330); g.fillRect(w * 0.5 - 50, base - 120, 100, 120); g.fillRect(w * 0.5 - 4, base - 380, 8, 52);
  beacons.push([w * 0.5, base - 384]);
  for (let k = 0; k < 70; k++) lights.push([w * 0.5 - 28 + r() * 56, base - 20 - r() * 300]);
  // gantry cranes
  g.strokeStyle = dark; g.lineWidth = 7;
  for (const gx of [420, 590]) { g.beginPath(); g.moveTo(gx - 40, base); g.lineTo(gx - 30, base - 150); g.lineTo(gx + 30, base - 150); g.lineTo(gx + 40, base); g.moveTo(gx - 70, base - 150); g.lineTo(gx + 90, base - 150); g.stroke(); beacons.push([gx + 88, base - 156]); }
  // windows and beacons
  for (const [lx, ly] of lights) { g.fillStyle = r() < 0.8 ? 'rgba(255,214,140,0.85)' : 'rgba(170,210,255,0.8)'; g.fillRect(lx, ly, 3, 2); }
  for (const [bx, by] of beacons) { g.fillStyle = 'rgba(255,40,30,0.95)'; g.beginPath(); g.arc(bx, by, 3.2, 0, Math.PI * 2); g.fill(); }
  // floodlights in cones
  for (const [fx, fy, a] of [[250, base - 110, 0.5], [760, base - 120, -0.5], [512, base - 140, 0.1]]) {
    const cone = g.createLinearGradient(fx, fy, fx + Math.sin(a) * 260, fy + 260);
    cone.addColorStop(0, 'rgba(255,236,190,0.32)'); cone.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.sin(a) * 260 - 90, fy + 260); g.lineTo(fx + Math.sin(a) * 260 + 90, fy + 260); g.closePath(); g.fill();
    g.fillStyle = '#fff1cf'; g.beginPath(); g.arc(fx, fy, 4, 0, Math.PI * 2); g.fill();
  }
  // the ground and a fence in front
  g.fillStyle = '#04050a'; g.fillRect(0, base, w, h - base);
  g.strokeStyle = 'rgba(120,130,150,0.55)'; g.lineWidth = 2;
  for (let x = 10; x < w; x += 64) { g.beginPath(); g.moveTo(x, base + 30); g.lineTo(x, base + 110); g.stroke(); }
  for (const y of [base + 40, base + 70, base + 100]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  grain(g, w, h, r, 3200, 0.14); scan(g, w, h, 0.14, 4); vignette(g, w, h, 0.7);
  g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(40, 40, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3efe6'; g.textBaseline = 'middle'; g.font = font(28);
  g.direction = 'ltr'; g.textAlign = 'left'; g.fillText(o.time || '03:12:47', 62, 41);
  caption(g, w, h, o.caption ?? 'הנמל השחור · מצלמה 3');
}

// a map with the big bases marked: an invented coast, a grid, red rings with names
const BASES = [
  { label: 'בסיס הצפון', x: 0.3, y: 0.3 }, { label: 'בסיס ההר', x: 0.64, y: 0.28 }, { label: 'בסיס האי', x: 0.14, y: 0.66 },
  { label: 'בסיס העמק', x: 0.47, y: 0.58 }, { label: 'בסיס המדבר', x: 0.78, y: 0.7 },
];
function drawMap(g, w, h, o) {
  const r = rng(53);
  g.fillStyle = '#06131f'; g.fillRect(0, 0, w, h);
  // land, invented
  const blob = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); g.closePath(); g.fill(); };
  blob([[0.24, 0.08], [0.55, 0.06], [0.9, 0.1], [0.97, 0.4], [0.93, 0.9], [0.62, 0.95], [0.36, 0.88], [0.3, 0.7], [0.36, 0.52], [0.25, 0.36], [0.2, 0.2]], '#163226');
  blob([[0.4, 0.2], [0.7, 0.16], [0.78, 0.34], [0.6, 0.42], [0.45, 0.38]], '#1d3d2d');
  blob([[0.06, 0.58], [0.2, 0.55], [0.23, 0.72], [0.12, 0.78], [0.04, 0.7]], '#163226');
  blob([[0.66, 0.6], [0.88, 0.58], [0.9, 0.84], [0.7, 0.86]], '#2c3a26');
  // the grid
  g.strokeStyle = 'rgba(80,160,210,0.18)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const bases = o.bases || BASES;
  // routes between the bases, dashed
  g.setLineDash([10, 9]); g.strokeStyle = 'rgba(255,90,80,0.5)'; g.lineWidth = 3;
  g.beginPath(); bases.forEach((b, i) => (i ? g.lineTo(b.x * w, b.y * h) : g.moveTo(b.x * w, b.y * h))); g.stroke(); g.setLineDash([]);
  for (const b of bases) {
    const x = b.x * w, y = b.y * h;
    g.fillStyle = 'rgba(255,40,30,0.18)'; g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff4b3e'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ff4b3e'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe9e6'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'top'; g.font = font(26); g.fillText(b.label, x, y + 40);
  }
  // a compass and the title
  g.strokeStyle = 'rgba(200,230,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(70, h - 70); g.lineTo(70, h - 140); g.stroke();
  g.fillStyle = 'rgba(200,230,255,0.8)'; g.beginPath(); g.moveTo(70, h - 150); g.lineTo(62, h - 128); g.lineTo(78, h - 128); g.closePath(); g.fill();
  g.font = font(22); g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'ltr'; g.fillText('N', 70, h - 52);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, w, 66);
  g.fillStyle = '#f3efe6'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(38); g.fillText(o.title ?? 'הבסיסים של המסדר השחור', w / 2, 34);
  grain(g, w, h, r, 1400, 0.08); scan(g, w, h, 0.1, 4);
  if (o.caption) caption(g, w, h, o.caption);
}
const DRAW = { off: drawOff, shadow: drawShadow, video: drawVideo, map: drawMap };
const GLOW = { off: null, shadow: '#ff2a22', video: '#8fb2ff', map: '#4fb0ff' };

const rugTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3a3836'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b0522e'; g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#3a3836'; g.fillRect(22, 22, w - 44, h - 44);
  g.strokeStyle = '#d7c7a6'; g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
  for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#b0522e' : '#d7c7a6'; g.fillRect(44, 54 + k * 26, w - 88, 8); }
  g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
});

// floor tiles indoors, grey pavers in the yard (the shared pavers have a red row: a pavement's, not a yard's)
const repeatTex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const tileTex = () => repeatTex(256, 256, (g, w, h) => {
  const r = rng(13);
  g.fillStyle = '#9d968b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const l = 80 + r() * 5; g.fillStyle = `hsl(38, 14%, ${l}%)`; g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61); }
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(90,80,70,${0.04 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
});
const yardTex = () => repeatTex(256, 256, (g, w, h) => {
  const r = rng(29);
  g.fillStyle = '#6f6c67'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) { const off = (y / 32) % 2 ? 32 : 0; for (let x = -64; x < w + 64; x += 64) { const l = 58 + r() * 12; g.fillStyle = `hsl(32, 5%, ${l}%)`; g.fillRect(x + off + 2, y + 2, 60, 28); } }
  for (let k = 0; k < 1400; k++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
});

export function build(ctx) {
  const { places, M, cols } = ctx;
  const { y } = ctx.safehouse;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'safehouse' });
  const { L, wall, seg, slab, door, mesh, std, box, solid, toWorld, toLocal, group, batch } = S;
  const P = (lx, lz, yaw = 0, ly = 0) => ({ ...L(lx, lz, yaw), y: y + ly });   // a spot
  const W3 = (lx, ly, lz) => ({ ...toWorld(lx, lz), y: y + ly });              // a point
  const cyl = (r0, r1, hgt, n = 12) => new THREE.CylinderGeometry(r0, r1, hgt, n);
  const fabric = new THREE.MeshStandardMaterial({ roughness: 0.96, vertexColors: true });
  const wood = new THREE.MeshStandardMaterial({ roughness: 0.62, vertexColors: true });
  const paintWall = new THREE.MeshStandardMaterial({ roughness: 0.93, vertexColors: true });                   // painted walls indoors
  const ground = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, vertexColors: true };
  const floorMat = new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.55, ...ground });
  const yardMat = new THREE.MeshStandardMaterial({ map: yardTex(), roughness: 0.9, ...ground });
  // a piece into the site's batch: `ry` turns it, pitch/roll tilt it
  const put = (key, mat, geo, lx, ly, lz, color, { ry = 0, pitch = 0, roll = 0, uv = 'keep', scale = 0.3 } = {}) =>
    batch.add(key, mat, geo, mat4(C.x + lx, y + ly, C.z + lz, ry, 1, 1, 1, pitch, roll), { color: tint(color), uv, uvScale: scale });
  // a frame for furniture turned by `yaw` (three.js turns: local x -> (cos, -sin), local z -> (sin, cos))
  const frame = (fx, fz, yaw) => (px, pz) => [fx + px * Math.cos(yaw) + pz * Math.sin(yaw), fz - px * Math.sin(yaw) + pz * Math.cos(yaw)];

  // ---------- the night: a probe the daylight drives, the bulbs and windows follow it in tick ----------
  const probe = new THREE.MeshStandardMaterial(); probe.userData.night = 1; probe.emissiveIntensity = 0; // 0 by day .. 1 at night
  const bulbMat = S.bulbMat;  // every bulb of the place (switched with the power, so not handed to the daylight)
  const windowMat = new THREE.MeshStandardMaterial({ color: '#1b2633', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 0.25, metalness: 0.4 });
  const lamps = [];
  const lamp = (lx, ly, lz, { inside = true, range = 9, intensity = 16, color, kind = 'house' } = {}) => {
    const l = { ...toWorld(lx, lz), y: y + ly, inside, range, intensity, kind, k: 1, light: null };
    if (color) l.color = color;
    lamps.push(l);
    return l;
  };
  const ceilingLamp = (lx, lz, o = {}) => {
    put('sh-bulb', bulbMat, cyl(0.22, 0.26, 0.07, 16), lx, H - 0.04, lz, '#ffffff');
    put('paint', M.paint, cyl(0.28, 0.28, 0.03, 16), lx, H - 0.01, lz, '#dcd6ca');
    return lamp(lx, H - 0.35, lz, o);
  };

  // ---------- the house: walls with doors and windows ----------
  const outer = { h: H, t: 0.3, color: '#ddd3bf', key: 'plaster', mat: M.plaster, scale: 0.35 };
  const inner = { h: H, t: 0.15, color: '#ece7dc', key: 'sh-wall', mat: paintWall };
  const glass = [];
  // a wall whose openings are doorways (sill 0) or windows (a sill below them, which collides); an outer
  // wall (`out`: the way its outside faces) gets a painted lining on its inner face, drawn only
  const wallW = (x0, z0, x1, z1, openings, opts, out) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ix = -Math.sin(out), iz = -Math.cos(out);
    const lin = opts.t / 2 + 0.012;
    const piece = (s0, s1, y0, y1) => {
      seg(x0 + ux * s0, z0 + uz * s0, x0 + ux * s1, z0 + uz * s1, { ...opts, y0, h: y1 - y0 });
      const a = Math.max(s0, opts.t / 2), b = Math.min(s1, len - opts.t / 2);
      if (b - a > 0.01) put('sh-wall', paintWall, box(0.02, y1 - y0, b - a), x0 + ux * (a + b) / 2 + ix * lin, (y0 + y1) / 2, z0 + uz * (a + b) / 2 + iz * lin, '#efe9dd', { ry: Math.atan2(ux, uz) });
    };
    let s = 0;
    for (const o of [...openings].sort((a, b) => a.at - b.at)) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      piece(s, a, 0, opts.h);
      if (o.sill) piece(a, b, 0, o.sill);
      piece(a, b, o.top, opts.h);
      if (o.sill) glass.push({ x: x0 + ux * o.at, z: z0 + uz * o.at, w: o.w, y0: o.sill, y1: o.top, out, t: opts.t });
      s = b;
    }
    piece(s, len, 0, opts.h);
  };
  wallW(X0, Z0, X1, Z0, [{ at: 3, w: 1.6, sill: 1.0, top: 2.2 }, { at: 7, w: 1.6, sill: 1.0, top: 2.2 }], outer, Math.PI);           // north
  wallW(X0, Z1, X1, Z1, [{ at: 3, w: 1.6, sill: 1.2, top: 2.2 }, { at: 15.5, w: 1.2, sill: 1.0, top: 2.1 }], outer, 0);              // south
  wallW(X0, Z0, X0, Z1, [{ at: 10.4, w: 1.4, sill: 1.0, top: 2.2 }, { at: 16.6, w: 1.2, sill: 1.2, top: 2.2 }], outer, -Math.PI / 2); // west
  wallW(X1, Z0, X1, Z1, [{ at: 3.5, w: 1.2, sill: 1.0, top: 2.1 }, { at: 10, w: 1.4, top: 2.2 }, { at: 15.8, w: 1.2, sill: 1.0, top: 2.1 }], outer, Math.PI / 2); // east: the front door at z = 0
  wall(PX, Z0, PX, Z1, [{ at: 10, w: 2.4, h: 2.4 }], inner);                 // the living room's opening to the hallway
  wall(PX, -2, X1, -2, [{ at: 3, w: 1.4, h: 2.2 }], inner);                  // the gear room's doorway at x = -10
  wall(PX, 2, X1, 2, [{ at: 3, w: 1.4, h: 2.2 }], inner);                    // the bunk room's doorway at x = -10
  // the windows: glass (one mesh), frames and sills
  for (const g of glass) {
    const hgt = g.y1 - g.y0, ym = (g.y0 + g.y1) / 2, ax = Math.abs(Math.sin(g.out)) > 0.5; // ax: the wall runs along z
    const gl = new THREE.PlaneGeometry(g.w, hgt);
    put('sh-glass', windowMat, gl, g.x + Math.sin(g.out) * 0.02, ym, g.z + Math.cos(g.out) * 0.02, '#ffffff', { ry: g.out });
    const fw = (a, b, c) => (ax ? box(c, b, a) : box(a, b, c)); // a box sized along the wall, up, across
    for (const e of [-1, 1]) put('paint', M.paint, fw(0.07, hgt + 0.07, g.t + 0.04), g.x + (ax ? 0 : e * g.w / 2), ym, g.z + (ax ? e * g.w / 2 : 0), '#e9e6df');
    put('paint', M.paint, fw(g.w + 0.07, 0.07, g.t + 0.04), g.x, g.y1, g.z, '#e9e6df');
    put('paint', M.paint, fw(g.w + 0.2, 0.06, g.t + 0.16), g.x + Math.sin(g.out) * 0.08, g.y0 - 0.03, g.z + Math.cos(g.out) * 0.08, '#cfc9bd');
  }
  // the front door, open after the build (a mission shuts it when it wants it shut)
  const frontDoor = door(X1, 0, Math.PI / 2, 1.4, { color: '#6b4a32', h: 2.2 });
  frontDoor.lamp.visible = false;
  frontDoor.setOpen(true);
  put('paint', M.paint, box(0.9, 0.1, 2.2), X1 + 0.45, 2.55, 0, '#bfb8aa');                         // the canopy over it
  lamp(X1 + 0.35, 2.35, 0, { inside: false, range: 10, intensity: 22, kind: 'porch' });
  put('sh-bulb', bulbMat, box(0.12, 0.2, 0.12), X1 + 0.2, 2.35, 0, '#ffffff');
  // floor, ceiling and the flat roof (a ceiling for the camera too: it stays inside under it)
  slab((X0 + X1) / 2, 0.0, (Z0 + Z1) / 2, X1 - X0 - 0.3, 0.02, Z1 - Z0 - 0.3, { key: 'sh-floor', mat: floorMat, color: '#ffffff', scale: 0.5 });
  slab((X0 + X1) / 2, H + 0.12, (Z0 + Z1) / 2, X1 - X0 + 0.5, 0.24, Z1 - Z0 + 0.5, { key: 'plaster', mat: M.plaster, color: '#e6e0d4' });
  slab((X0 + X1) / 2, H - 0.01, (Z0 + Z1) / 2, X1 - X0 - 0.3, 0.02, Z1 - Z0 - 0.3, { key: 'sh-wall', mat: paintWall, color: '#f3efe7' }); // the ceiling
  cols.addFloor(C.x + X0, C.z + Z0, C.x + X1, C.z + Z1, y + H);
  const parapet = { h: 0.45, y0: H + 0.24, t: 0.2, color: '#d6ccb8', key: 'plaster', mat: M.plaster };
  seg(X0 - 0.15, Z0 - 0.15, X1 + 0.15, Z0 - 0.15, parapet); seg(X0 - 0.15, Z1 + 0.15, X1 + 0.15, Z1 + 0.15, parapet);
  seg(X0 - 0.15, Z0 - 0.15, X0 - 0.15, Z1 + 0.15, parapet); seg(X1 + 0.15, Z0 - 0.15, X1 + 0.15, Z1 + 0.15, parapet);
  // on the roof: a solar water heater
  put('solar', M.solar, box(2.0, 0.06, 1.2), -9, H + 0.75, -6, '#ffffff', { pitch: -0.6 });
  put('paint', M.paint, cyl(0.28, 0.28, 1.6, 12), -9, H + 0.75, -6.9, '#e9e6df', { roll: Math.PI / 2 });
  put('paint', M.paint, box(0.5, 0.06, 0.06), -14, H + 0.4, 4, '#9aa0a6'); put('paint', M.paint, box(0.8, 0.6, 0.5), -14, H + 0.55, 4, '#c9ccd1'); // an air conditioner
  // a darker band round the foot of the house
  for (const [ax0, az0, ax1, az1] of [[X0, Z0, X1, Z0], [X0, Z1, X1, Z1], [X0, Z0, X0, Z1], [X1, Z0, X1, -0.7], [X1, 0.7, X1, Z1]]) { // not across the front door
    const len = Math.hypot(ax1 - ax0, az1 - az0), along = ax0 === ax1;
    put('stone', M.stone, along ? box(0.34, 0.35, len) : box(len, 0.35, 0.34), (ax0 + ax1) / 2, 0.175, (az0 + az1) / 2, '#9b917f', { uv: 'world', scale: 0.4 });
  }

  // ---------- the living room: the TV wall, the sofas, the coffee table ----------
  const TVZ = -4, TVY = 1.75;
  put('sh-wood', wood, box(0.5, 0.5, 3.2), X0 + 0.4, 0.25, TVZ, '#3b2f27');                       // the console under it
  for (const dz of [-0.8, 0, 0.8]) put('paint', M.paint, box(0.02, 0.32, 0.72), X0 + 0.66, 0.25, TVZ + dz, '#2a241f');
  solid(X0 + 0.4, TVZ, 0.25, 1.6, 0.5);
  put('paint', M.paint, box(0.08, 1.56, 2.72), X0 + 0.19, TVY, TVZ, '#121316');                   // the set on the wall
  solid(X0 + 0.19, TVZ, 0.06, 1.36, TVY + 0.8);
  put('paint', M.paint, box(0.1, 0.06, 1.0), X0 + 0.56, 0.53, TVZ, '#1a1b1e');                    // a soundbar
  put('sh-bulb', bulbMat, box(0.02, 0.02, 0.02), X0 + 0.24, TVY - 0.76, TVZ + 1.2, '#ffffff');   // the standby light
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576;
  const g2 = cv.getContext('2d');
  const screenTex = new THREE.CanvasTexture(cv); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screenMesh = mesh(new THREE.PlaneGeometry(2.6, 1.4625), screenMat, X0 + 0.235, TVY, TVZ, Math.PI / 2);
  const glowLamp = lamp(X0 + 1.6, TVY, TVZ, { range: 8, intensity: 14, color: GLOW.shadow, kind: 'screen' });
  glowLamp.k = 0;
  // the rug and the coffee table
  mesh(new THREE.PlaneGeometry(4.4, 4.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 0.95 }), -20.4, 0.015, TVZ);
  const CT = { lx: -19.6, lz: TVZ };
  put('sh-wood', wood, box(0.7, 0.05, 1.3), CT.lx, 0.4, CT.lz, '#8a6b4a');
  put('sh-wood', wood, box(0.6, 0.03, 1.2), CT.lx, 0.12, CT.lz, '#6f5539');
  for (const [dx, dz] of [[-0.31, -0.6], [0.31, -0.6], [-0.31, 0.6], [0.31, 0.6]]) put('paint', M.paint, box(0.04, 0.4, 0.04), CT.lx + dx, 0.2, CT.lz + dz, '#1f1f22');
  solid(CT.lx, CT.lz, 0.35, 0.65, 0.45);
  put('paint', M.paint, box(0.42, 0.05, 0.42), CT.lx + 0.05, 0.45, CT.lz - 0.3, '#c8352d', { ry: 0.2 });   // pizza boxes
  put('paint', M.paint, box(0.42, 0.05, 0.42), CT.lx + 0.02, 0.5, CT.lz - 0.28, '#e9e2d2', { ry: -0.1 });
  for (const [dx, dz, c] of [[-0.2, 0.25, '#2d6fd6'], [0.15, 0.4, '#e9e6df'], [-0.1, 0.5, '#3b7a46']]) put('paint', M.paint, cyl(0.04, 0.035, 0.11, 10), CT.lx + dx, 0.48, CT.lz + dz, c);
  put('paint', M.paint, box(0.05, 0.02, 0.17), CT.lx + 0.2, 0.435, CT.lz + 0.1, '#1d1d20', { ry: 0.4 }); // the remote
  // sofas and armchairs: a seat cushion per person, a back, two arms; the colliders are the back and the
  // arms only, so each seat stays clear for whoever sits in it and the front is open to walk out
  const seats = [];
  const seater = (fx, fz, yaw, n, color, cushion, on) => {
    const D = 0.95, Wd = n * 0.8 + 0.36, F = frame(fx, fz, yaw), at = (px, py, pz, geo, c, o = {}) => { const [qx, qz] = F(px, pz); put('sh-fabric', fabric, geo, qx, py, qz, c, { ry: yaw, ...o }); };
    at(0, 0.2, 0.05, box(Wd - 0.36, 0.26, D - 0.1), color);                                     // the base
    at(0, 0.44, -D / 2 + 0.07, box(Wd, 0.88, 0.14), color);                                        // the back's frame
    for (const sx of [-1, 1]) at(sx * (Wd / 2 - 0.09), 0.3, 0, box(0.18, 0.6, D), color);         // arms
    for (let i = 0; i < n; i++) {
      const px = -((n - 1) * 0.8) / 2 + i * 0.8;
      at(px, 0.39, 0.09, box(0.76, 0.14, D - 0.26), cushion);                                     // the seat cushion
      at(px, 0.68, -D / 2 + 0.22, box(0.74, 0.46, 0.16), cushion, { pitch: -0.16 });              // the back cushion
      const [sx, sz] = F(px, -D / 2 + 0.5);
      seats.push({ ...P(sx, sz, yaw), on });
    }
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [qx, qz] = F(px * (Wd / 2 - 0.1), pz * (D / 2 - 0.1)); put('paint', M.paint, box(0.05, 0.07, 0.05), qx, 0.035, qz, '#1f1f22', { ry: yaw }); }
    const back = F(0, -D / 2 + 0.07);
    cols.addBox(C.x + back[0], C.z + back[1], Wd / 2, 0.07, yaw, y - 1, y + 0.88);
    for (const sx of [-1, 1]) { const a = F(sx * (Wd / 2 - 0.09), 0); cols.addBox(C.x + a[0], C.z + a[1], 0.09, D / 2, yaw, y - 1, y + 0.6); }
    return { ...W3(fx, 0.45, fz), yaw };
  };
  const sofa = seater(-17.3, TVZ, -Math.PI / 2, 4, '#4f5d6b', '#5f6f7e', 'sofa');               // faces the TV (west)
  seater(-21.0, -6.6, 0, 3, '#6b5446', '#7d6555', 'side');                                       // the side sofa, north, faces south
  seater(-22.1, -1.25, Math.PI + 0.5, 1, '#8a6a3a', '#9b7a48', 'armchair');                      // two armchairs, south, turned to the TV
  seater(-19.5, -1.15, Math.PI + 0.25, 1, '#8a6a3a', '#9b7a48', 'armchair');
  // seats in the order of the gang: the sofa's four (Nehorai between Erez and Ido), the side sofa, the armchairs
  const order = [2, 1, 3, 0, 4, 5, 6, 7, 8];   // sofa seats run north to south as built: 0 z -5.2 .. 3 z -2.8
  const ranked = order.map((i, k) => ({ ...seats[i], k, who: GANG[k] }));
  // a throw on the side sofa
  put('sh-fabric', fabric, box(0.9, 0.03, 0.6), -21.5, 0.47, -6.5, '#a8402e', { ry: 0.1 });
  // a bookshelf on the hallway wall and a plant in the corner
  put('sh-wood', wood, box(0.4, 2.0, 2.6), PX - 0.28, 1.0, -7.8, '#6f5539'); solid(PX - 0.28, -7.8, 0.2, 1.3, 2.0);
  for (const [ly, c] of [[0.45, '#2d6fd6'], [0.95, '#c8352d'], [1.45, '#e9c46a'], [1.9, '#3b7a46']]) put('paint', M.paint, box(0.28, 0.32, 2.3), PX - 0.3, ly + 0.05, -7.8, c);
  put('paint', M.paint, cyl(0.26, 0.2, 0.5, 12), X0 + 0.55, 0.25, Z0 + 0.6, '#8c5a3c'); cols.addCircle(C.x + X0 + 0.55, C.z + Z0 + 0.6, 0.28, y - 1, y + 1.2);
  put('paint', M.paint, new THREE.SphereGeometry(0.45, 10, 8), X0 + 0.55, 0.95, Z0 + 0.6, '#3f6b3a');
  ceilingLamp(-19.0, -4.6, { range: 12, intensity: 22 });
  // the light switch by the opening to the hallway
  const switchMesh = mesh(box(0.03, 0.14, 0.09), std({ color: '#f1efe9', roughness: 0.4 }), PX - 0.09, 1.3, 1.8);
  // ---------- the kitchen corner, open to the living room ----------
  put('sh-wood', wood, box(6.25, 0.86, 0.6), -20.725, 0.43, Z1 - 0.45, '#e3ddd2'); solid(-20.725, Z1 - 0.45, 3.125, 0.3, 0.92);
  put('stone', M.stone, box(6.3, 0.05, 0.64), -20.725, 0.885, Z1 - 0.46, '#5b5752', { uv: 'world', scale: 0.6 });
  put('sh-wood', wood, box(0.6, 0.86, 3.65), X0 + 0.45, 0.43, 6.425, '#e3ddd2'); solid(X0 + 0.45, 6.425, 0.3, 1.825, 0.92);
  put('stone', M.stone, box(0.64, 0.05, 3.7), X0 + 0.46, 0.885, 6.425, '#5b5752', { uv: 'world', scale: 0.6 });
  for (let lx = -23.4; lx < -17.8; lx += 0.6) put('paint', M.paint, box(0.56, 0.7, 0.02), lx, 0.45, Z1 - 0.76, '#d4cdc0');
  put('paint', M.paint, box(0.6, 0.04, 0.42), -21.0, 0.9, Z1 - 0.45, '#9ca3ad');                 // the sink
  put('paint', M.paint, box(0.62, 0.03, 0.5), -18.6, 0.91, Z1 - 0.45, '#18191c');                // the hob
  for (const [dx, dz] of [[-0.14, -0.11], [0.14, -0.11], [-0.14, 0.11], [0.14, 0.11]]) put('paint', M.paint, cyl(0.07, 0.07, 0.01, 12), -18.6 + dx, 0.93, Z1 - 0.45 + dz, '#3a3b3f');
  for (const [x0, x1] of [[-23.85, -22.0], [-20.0, -17.6]]) put('sh-wood', wood, box(x1 - x0, 0.7, 0.36), (x0 + x1) / 2, 1.9, Z1 - 0.33, '#e3ddd2'); // upper cabinets
  put('paint', M.paint, box(0.8, 1.9, 0.7), -17.05, 0.95, Z1 - 0.5, '#d9dde2'); solid(-17.05, Z1 - 0.5, 0.4, 0.35, 1.9); // the fridge
  put('paint', M.paint, box(0.02, 0.5, 0.04), -16.66, 1.2, Z1 - 0.84, '#9ca3ad');
  put('paint', M.paint, cyl(0.12, 0.1, 0.22, 10), -22.6, 1.0, Z1 - 0.45, '#c8352d');            // a kettle
  // the table and four chairs
  const KT = { lx: -19.0, lz: 5.2 };
  put('sh-wood', wood, box(1.8, 0.05, 0.9), KT.lx, 0.75, KT.lz, '#8a6b4a');
  for (const [dx, dz] of [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]]) put('paint', M.paint, box(0.05, 0.74, 0.05), KT.lx + dx, 0.37, KT.lz + dz, '#2a2d33');
  solid(KT.lx, KT.lz, 0.9, 0.45, 0.78);
  const kitchenSeats = [];
  for (const [dx, side] of [[-0.45, -1], [0.45, -1], [-0.45, 1], [0.45, 1]]) {
    const lx = KT.lx + dx, lz = KT.lz + side * 0.85, yaw = side < 0 ? 0 : Math.PI;
    put('sh-wood', wood, box(0.44, 0.05, 0.44), lx, 0.45, lz, '#6f5539');
    put('sh-wood', wood, box(0.44, 0.5, 0.04), lx, 0.72, lz + side * 0.2, '#6f5539');
    for (const [cx2, cz2] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) put('paint', M.paint, box(0.03, 0.45, 0.03), lx + cx2, 0.22, lz + cz2, '#2a2d33');
    kitchenSeats.push({ ...P(lx, lz - side * 0.04, yaw), on: 'kitchen' });
  }
  put('paint', M.paint, box(0.4, 0.06, 0.4), KT.lx, 0.8, KT.lz, '#c8352d', { ry: 0.3 });        // another pizza box
  ceilingLamp(KT.lx, KT.lz, { range: 8, intensity: 14 });

  // ---------- the hallway: the front door, the fuse box, a shoe cabinet ----------
  put('sh-wood', wood, box(1.0, 0.9, 0.35), -5.6, 0.45, 2 - 0.25, '#6f5539'); solid(-5.6, 2 - 0.25, 0.5, 0.18, 0.92);
  for (let k = 0; k < 4; k++) put('paint', M.paint, box(0.04, 0.04, 0.1), -6.0 + k * 0.27, 1.7, 2 - 0.12, '#2a2d33');            // coat hooks
  put('sh-fabric', fabric, box(0.4, 0.8, 0.12), -5.73, 1.35, 2 - 0.16, '#2f3a45'); put('sh-fabric', fabric, box(0.4, 0.75, 0.12), -5.2, 1.37, 2 - 0.16, '#5a4636');
  const breakerMesh = mesh(box(0.45, 0.55, 0.12), std({ color: '#b9bcc0', roughness: 0.5, metalness: 0.3 }), -5.2, 1.5, -2 + 0.135);
  mesh(box(0.36, 0.08, 0.02), std({ color: '#2a2d33' }), -5.2, 1.55, -2 + 0.2);
  solid(-5.2, -2 + 0.135, 0.23, 0.07, 2.2);
  put('stone', M.stone, box(1.2, 0.02, 0.8), X1 - 0.8, 0.015, 0, '#7d6555', { uv: 'world', scale: 0.8 });                     // a doormat
  ceilingLamp(-8.5, 0, { range: 8, intensity: 12 });

  // ---------- the gear room: the gang's markers on the wall rack, bags and masks on the table ----------
  const RZ = Z0 + 0.18;   // the rack's board, on the north wall's face
  put('sh-wood', wood, box(6.8, 1.4, 0.06), -8.5, 1.45, RZ, '#5a4636');
  put('paint', M.paint, box(6.9, 0.05, 0.18), -8.5, 0.76, RZ + 0.06, '#3a3d44');
  solid(-8.5, RZ + 0.1, 3.45, 0.14, 2.2);
  const markers = new THREE.Group(); markers.name = 'safehouse markers';
  const bags = new THREE.Group(); bags.name = 'safehouse bags';
  group.add(markers, bags);
  const mb = new Batch(), bb = new Batch(), slots = {};
  const mput = (bt, geo, lx, ly, lz, color, { ry = 0, pitch = 0, roll = 0 } = {}) => bt.add('paint', M.paint, geo, mat4(C.x + lx, y + ly, C.z + lz, ry, 1, 1, 1, pitch, roll), { color: tint(color) });
  GANG.forEach((id, k) => {
    const lx = -11.5 + k * 0.75, mz = RZ + 0.12, my = 1.42;
    mput(mb, box(0.03, 0.03, 0.14), lx, my + 0.28, RZ + 0.06, '#9ca3ad');                   // the peg
    mput(mb, box(0.065, 0.32, 0.09), lx, my, mz, '#2a2d33');                                  // the body, hung barrel up
    mput(mb, cyl(0.017, 0.017, 0.38, 8), lx, my + 0.35, mz, '#9ca3ad');                       // the barrel
    mput(mb, cyl(0.052, 0.058, 0.14, 12), lx, my + 0.06, mz + 0.11, COLORS[id] || '#36c3ff', { pitch: Math.PI / 2 }); // the hopper of paint, in his colour
    mput(mb, box(0.045, 0.055, 0.12), lx, my - 0.07, mz + 0.09, '#2a2d33');                  // the grip
    mput(mb, cyl(0.034, 0.034, 0.2, 10), lx, my - 0.27, mz, '#6b7078');                      // the air tank
    slots[id] = W3(lx, my, mz);
  });
  mb.build(markers);
  const names = canvasTex(1024, 40, (g, w, h) => {
    g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2d33'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(24);
    GANG.forEach((id, k) => g.fillText(HEB[id], ((-11.5 + k * 0.75) - (-11.9)) / 6.8 * w, h / 2 + 1));
  });
  mesh(new THREE.PlaneGeometry(6.8, 0.27), new THREE.MeshStandardMaterial({ map: names, roughness: 0.8 }), -8.5, 0.92, RZ + 0.035);
  const GT = { lx: -8.5, lz: -6.0 };
  put('sh-wood', wood, box(2.6, 0.06, 1.1), GT.lx, 0.84, GT.lz, '#7a5a3a');
  for (const [dx, dz] of [[-1.22, -0.48], [1.22, -0.48], [-1.22, 0.48], [1.22, 0.48]]) put('paint', M.paint, box(0.06, 0.82, 0.06), GT.lx + dx, 0.41, GT.lz + dz, '#2a2d33');
  solid(GT.lx, GT.lz, 1.3, 0.55, 0.9);
  for (const [dx, dz, c, len] of [[-0.75, -0.2, '#2f3a2c', 0.8], [0.05, 0.15, '#1f2633', 0.75], [0.8, -0.18, '#3a2f2a', 0.7]]) {
    mput(bb, cyl(0.17, 0.17, len, 12), GT.lx + dx, 1.04, GT.lz + dz, c, { roll: Math.PI / 2, ry: dz * 0.6 });
    mput(bb, box(0.06, 0.02, 0.36), GT.lx + dx, 1.2, GT.lz + dz, '#111214', { ry: dz * 0.6 });
  }
  for (let k = 0; k < 4; k++) { // paintball masks
    mput(bb, box(0.22, 0.16, 0.12), GT.lx - 0.9 + k * 0.6, 0.95, GT.lz + 0.38, '#1d1f24');
    mput(bb, box(0.18, 0.06, 0.02), GT.lx - 0.9 + k * 0.6, 0.98, GT.lz + 0.445, '#5f7f9a');
  }
  mput(bb, box(0.5, 0.3, 0.35), GT.lx + 0.2, 1.02, GT.lz - 0.35, '#c8b27a');                    // a box of paint
  bb.build(bags);
  put('sh-fabric', fabric, box(0.5, 0.36, 1.5), X1 - 0.45, 0.18, -8.6, '#2f3a2c'); solid(X1 - 0.45, -8.6, 0.26, 0.76, 0.4); // bags on the floor
  put('paint', M.paint, box(0.5, 2.0, 3.2), PX + 0.33, 1.0, -8.0, '#6b7078'); solid(PX + 0.33, -8.0, 0.25, 1.6, 2.0);     // lockers
  for (let k = 0; k < 4; k++) put('paint', M.paint, box(0.02, 1.9, 0.02), PX + 0.59, 1.0, -9.2 + k * 0.8, '#3a3d44');
  ceilingLamp(-8.5, -6.0, { range: 8, intensity: 14 });

  // ---------- the bunk room ----------
  const bunk = (lx, lz, yaw) => {
    const F = frame(lx, lz, yaw), at = (px, py, pz, geo, c, key = 'paint', mat = M.paint) => { const [qx, qz] = F(px, pz); put(key, mat, geo, qx, py, qz, c, { ry: yaw }); };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(sx * 0.95, 0.85, sz * 0.43, box(0.06, 1.7, 0.06), '#3a3d44');
    for (const ly of [0.35, 1.25]) { at(0, ly, 0, box(1.96, 0.08, 0.9), '#3a3d44'); at(0, ly + 0.11, 0, box(1.9, 0.14, 0.84), '#d9d4c8', 'sh-fabric', fabric); at(-0.75, ly + 0.23, 0, box(0.35, 0.1, 0.55), '#f2efe8', 'sh-fabric', fabric); }
    at(0.3, 0.52, 0, box(1.0, 0.04, 0.86), '#5a6b7d', 'sh-fabric', fabric);
    cols.addBox(C.x + lx, C.z + lz, 1.0, 0.47, yaw, y - 1, y + 1.75);
  };
  bunk(-10.4, Z1 - 0.65, 0); bunk(-6.6, Z1 - 0.65, 0); bunk(PX + 0.62, 4.6, Math.PI / 2);
  put('sh-wood', wood, box(0.4, 0.8, 0.8), X1 - 0.35, 0.4, 3.0, '#6f5539'); solid(X1 - 0.35, 3.0, 0.2, 0.4, 0.82);
  const kitMesh = new THREE.Group();
  const kitBox = new THREE.Mesh(box(0.36, 0.22, 0.26), std({ color: '#f2efe8', roughness: 0.5 }));
  const kitMark = std({ color: '#2fa055', roughness: 0.5 });
  const k1 = new THREE.Mesh(box(0.03, 0.12, 0.04), kitMark), k2 = new THREE.Mesh(box(0.03, 0.04, 0.12), kitMark);
  k1.position.x = k2.position.x = -0.19;
  kitMesh.add(kitBox, k1, k2); kitMesh.position.set(C.x + X1 - 0.35, y + 0.91, C.z + 3.0); group.add(kitMesh);
  ceilingLamp(-8.5, 5.5, { range: 8, intensity: 12 });

  // ---------- the yard: a low wall round the property, a wide gate east, three parking bays ----------
  const low = { h: 1.3, t: 0.25, color: '#b8ad98', key: 'stone', mat: M.stone, scale: 0.35 };
  wall(-HX + 0.2, -HZ + 0.2, HX - 0.2, -HZ + 0.2, [], low);
  wall(-HX + 0.2, HZ - 0.2, HX - 0.2, HZ - 0.2, [], low);
  wall(-HX + 0.2, -HZ + 0.2, -HX + 0.2, HZ - 0.2, [], low);
  wall(HX - 0.2, -HZ + 0.2, HX - 0.2, HZ - 0.2, [{ at: HZ - 0.2, w: 12, h: 1.3 }], low);           // the gate: z -6..6
  for (const sz of [-1, 1]) {
    put('stone', M.stone, box(0.6, 1.9, 0.6), HX - 0.2, 0.95, sz * 6.3, '#a89d88', { uv: 'world', scale: 0.4 });
    solid(HX - 0.2, sz * 6.3, 0.3, 0.3, 1.9);
    put('sh-bulb', bulbMat, new THREE.SphereGeometry(0.16, 10, 8), HX - 0.2, 2.05, sz * 6.3, '#ffffff');
  }
  lamp(HX - 1.2, 2.4, 0, { inside: false, range: 18, intensity: 34, kind: 'gate' });   // one light for the two lamps on the gate's pillars
  // paving: the yard east of the house, gravel strips round its other three sides (none under the house's own floor)
  const pave = (x0, z0, x1, z1, color) => slab((x0 + x1) / 2, 0.004, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, { key: 'sh-yard', mat: yardMat, color, scale: 0.4 });
  const E = HX - 0.35, N = HZ - 0.35;
  pave(X1 + 0.15, -N, E, N, '#ffffff');
  pave(-E, -N, X0 - 0.15, N, '#d8d2c6'); pave(X0 - 0.15, -N, X1 + 0.15, Z0 - 0.15, '#d8d2c6'); pave(X0 - 0.15, Z1 + 0.15, X1 + 0.15, N, '#d8d2c6');
  // the cars' spots: each faces the gate, which they leave through toward the death road
  const spot = (yaw, d) => ({ lx: ROAD.lx - Math.sin(yaw) * d, lz: ROAD.lz - Math.cos(yaw) * d, yaw });
  const bays = [spot(2.36, 12.5), spot(2.02, 16.5), spot(2.7, 15.5)];
  for (const b of bays) {
    const F = frame(b.lx, b.lz, b.yaw);
    for (const sx of [-1, 1]) { const [qx, qz] = F(sx * 1.3, 0); put('paint', M.paint, box(0.1, 0.012, 4.8), qx, 0.02, qz, '#ecebe5', { ry: b.yaw }); }
    const [qx, qz] = F(0, -2.4); put('paint', M.paint, box(2.7, 0.012, 0.1), qx, 0.02, qz, '#ecebe5', { ry: b.yaw });
  }
  // by the door: a bench and two plant pots
  put('sh-wood', wood, box(0.45, 0.45, 1.6), X1 + 0.5, 0.23, -4.2, '#7a5a3a'); solid(X1 + 0.5, -4.2, 0.23, 0.8, 0.46);
  for (const sz of [-1.4, 1.4]) { put('paint', M.paint, cyl(0.25, 0.2, 0.5, 12), X1 + 0.55, 0.25, sz, '#8c5a3c'); put('paint', M.paint, new THREE.SphereGeometry(0.36, 10, 8), X1 + 0.55, 0.75, sz, '#4a7a3f'); cols.addCircle(C.x + X1 + 0.55, C.z + sz, 0.26, y - 1, y + 1.0); }
  // the terrace, north of the drive: a pergola over a picnic table, a strip of lawn along the wall
  const TR = { lx: 10, lz: -12 };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { put('sh-wood', wood, box(0.14, 2.5, 0.14), TR.lx + sx * 2.4, 1.25, TR.lz + sz * 1.9, '#6f5539'); solid(TR.lx + sx * 2.4, TR.lz + sz * 1.9, 0.08, 0.08, 2.5); }
  for (const sz of [-1, 1]) put('sh-wood', wood, box(5.2, 0.16, 0.12), TR.lx, 2.5, TR.lz + sz * 1.9, '#6f5539');
  for (let k = 0; k < 9; k++) put('sh-wood', wood, box(0.08, 0.1, 4.2), TR.lx - 2.4 + k * 0.6, 2.62, TR.lz, '#7a5a3a');
  put('sh-wood', wood, box(2.0, 0.06, 0.8), TR.lx, 0.74, TR.lz, '#8a6b4a'); solid(TR.lx, TR.lz, 1.0, 0.4, 0.78);
  for (const sx of [-0.8, 0.8]) put('sh-wood', wood, box(0.08, 0.72, 0.7), TR.lx + sx, 0.36, TR.lz, '#6f5539');
  for (const sz of [-0.78, 0.78]) { put('sh-wood', wood, box(2.0, 0.05, 0.3), TR.lx, 0.45, TR.lz + sz, '#8a6b4a'); for (const sx of [-0.85, 0.85]) put('sh-wood', wood, box(0.06, 0.43, 0.26), TR.lx + sx, 0.21, TR.lz + sz, '#6f5539'); solid(TR.lx, TR.lz + sz, 1.0, 0.15, 0.47); }
  put('sh-fabric', fabric, box(24, 0.01, 1.8), 14, 0.02, -HZ + 1.45, '#5d7a3a');
  for (const lx of [4, 12, 20]) { put('paint', M.paint, cyl(0.28, 0.22, 0.55, 12), lx, 0.28, -HZ + 1.2, '#8c5a3c'); put('paint', M.paint, new THREE.SphereGeometry(0.5, 10, 8), lx, 1.0, -HZ + 1.2, '#4a7a3f'); cols.addCircle(C.x + lx, C.z - HZ + 1.2, 0.3, y - 1, y + 1.3); }
  S.finish();

  // ---------- the screen ----------
  let lightsOn = true, glowK = 0, tOn = 0, tt = 0, lastKey = '';
  const screen = {
    mode: 'off', on: false, mesh: screenMesh, material: screenMat, texture: screenTex,
    show(mode = 'off', opts = {}) {
      if (!DRAW[mode]) mode = 'off';
      const key = mode + JSON.stringify(opts);
      if (key !== lastKey) { lastKey = key; g2.setTransform(1, 0, 0, 1, 0, 0); g2.setLineDash([]); g2.direction = 'ltr'; DRAW[mode](g2, cv.width, cv.height, opts); screenTex.needsUpdate = true; }
      const was = screen.on;
      screen.mode = mode; screen.on = mode !== 'off';
      if (screen.on && !was) tOn = 0;
      if (GLOW[mode]) { glowLamp.color = GLOW[mode]; glowLamp.light?.color.set(GLOW[mode]); }
      glowLamp.k = screen.on ? 1 : 0;
      return screen;
    },
  };
  screen.show('off');

  // the lamps' lights are made by main.js from `lamps`; the place finds them in the scene and puts a switch
  // in each one's intensity (whatever the daylight sets, the light shows it times the lamp's k)
  const patch = (light, l) => {
    if (light.userData.safehouse) return;
    let raw = light.intensity;
    Object.defineProperty(light, 'intensity', { get: () => raw * l.k, set: (v) => { raw = v; }, configurable: true });
    light.userData.safehouse = true;
    l.light = light;
    if (l.kind === 'screen' && l.color) light.color.set(l.color);
  };
  const find = (scene) => {
    if (!scene) return;
    for (const o of scene.children) {
      if (!o.isPointLight || o.userData.safehouse) continue;
      for (const l of lamps) if (!l.light && Math.abs(o.position.x - l.x) < 1e-3 && Math.abs(o.position.z - l.z) < 1e-3 && Math.abs(o.position.y - l.y) < 1e-3) { patch(o, l); break; }
    }
  };
  const glowOf = () => Math.max(0, Math.min(1, probe.emissiveIntensity));
  const dark = new THREE.Color('#ffcf8a'), red = new THREE.Color('#ff3a2a');
  const apply = () => {
    const n = glowOf();
    bulbMat.emissiveIntensity = 1.6 * n * (lightsOn ? 1 : 0);
    if (lightsOn) { windowMat.emissive.copy(dark); windowMat.emissiveIntensity = 0.9 * n; }
    else { windowMat.emissive.copy(red); windowMat.emissiveIntensity = 0.3 * n * glowK; }
    for (const l of lamps) if (l.kind !== 'screen') l.k = lightsOn ? 1 : 0;
  };
  const lights = (on) => {
    lightsOn = !!on;
    if (!lightsOn) screen.show('off');
    apply();
    return lightsOn;
  };
  const gear = {
    ...P(-8.5, -8.55, Math.PI), rack: W3(-8.5, 1.45, RZ), table: W3(GT.lx, 0.86, GT.lz), slots, mesh: markers, bags, taken: false,
    take({ bags: withBags = true } = {}) { markers.visible = false; if (withBags) bags.visible = false; gear.taken = true; },
    reset() { markers.visible = true; bags.visible = true; gear.taken = false; },
  };
  const seatFor = (id) => ranked.find((s) => s.who === id) || null;
  const place = {
    x: C.x, z: C.z, y, toWorld, toLocal, group,
    bounds: { x0: C.x - HX, z0: C.z - HZ, x1: C.x + HX, z1: C.z + HZ },
    house: { x0: C.x + X0, z0: C.z + Z0, x1: C.x + X1, z1: C.z + Z1 },
    inside: (x, z) => x > C.x + X0 && x < C.x + X1 && z > C.z + Z0 && z < C.z + Z1,
    living: P(-15.0, -1.0, -Math.PI / 2), kitchen: P(-20.5, 7.4, 0), hallway: P(-8.5, 0, Math.PI / 2), gearRoom: P(-8.5, -4.0, Math.PI), bunkRoom: P(-8.5, 4.6, 0),
    tv: { ...W3(X0 + 0.235, TVY, TVZ), yaw: Math.PI / 2 }, tvFront: P(-21.9, TVZ, -Math.PI / 2),
    screen, seats: ranked, seatFor, kitchenSeats, sofa, coffeeTable: W3(CT.lx, 0.45, CT.lz),
    gear,
    lights, get lightsOn() { return lightsOn; },
    switch: { ...W3(PX - 0.09, 1.3, 1.8), mesh: switchMesh, at: P(PX - 0.85, 1.8, Math.PI / 2) },
    breaker: { ...W3(-5.2, 1.5, -2 + 0.135), mesh: breakerMesh, at: P(-5.2, -1.1, Math.PI) },
    door: frontDoor, doorAt: P(X1 - 1.2, 0, Math.PI / 2), outside: P(X1 + 1.6, 0, Math.PI / 2),
    yard: P(9, 1.5, Math.PI / 2), gate: P(HX - 1.5, 0, Math.PI / 2), gateOutside: P(ROAD.lx + 1, 0, 2.36), roadStart: toWorld(ROAD.lx, ROAD.lz),
    behind: P(-26, 0, 0), terrace: P(TR.lx, TR.lz + 1.6, Math.PI),
    car: P(bays[0].lx, bays[0].lz, bays[0].yaw), cars: [P(bays[1].lx, bays[1].lz, bays[1].yaw), P(bays[2].lx, bays[2].lz, bays[2].yaw)],
    kit: { ...W3(X1 - 0.35, 0.91, 3.0), mesh: kitMesh, at: P(X1 - 1.3, 3.0, Math.PI / 2) },
    lamps, emissives: [probe],
    reset() { lights(true); screen.show('off'); gear.reset(); kitMesh.visible = true; frontDoor.unlock(); frontDoor.setOpen(true); },
    tick(camera, dt) {
      tt += dt;
      // the screen: a short warm-up when it comes on, the Shadow's signal flickers a little
      if (screen.on) {
        tOn += dt;
        const up = Math.min(1, tOn / 0.35), fl = screen.mode === 'shadow' ? 0.9 + 0.1 * Math.sin(tt * 23) * Math.sin(tt * 7.3) : 1;
        screenMat.color.setScalar(up < 1 ? 0.3 + 0.9 * up : fl);
        glowK = up * fl;
      } else { if (glowK) screenMat.color.setScalar(1); glowK = 0; }
      glowLamp.k = glowK;
      apply();
      const cp = camera.position;
      if (lamps.some((l) => !l.light) && Math.abs(cp.x - C.x) < 220 && Math.abs(cp.z - C.z) < 220) find(group.parent?.parent);
      for (const l of lamps) if (l.light && !l.light.userData.safehouse) patch(l.light, l);
    },
  };
  places.safehouse = place;
}
