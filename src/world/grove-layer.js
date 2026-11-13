// The parallel universe over the olive grove (missions 52-54): a group that is hidden until
// grove.dimension(true). The sky, the moons, the fog and the motes in the air are the engine's; this is what
// the grove itself becomes: energy walls between the trees that close it into three areas (seals), a glowing
// symbol on a low stone in each, the path hanging in pieces over a rift (the stones that stay are built here;
// the ones that come and go are data for the engine's path kit), the Keeper's clearing with its four anchor
// stones, the energy point between the two great olives, and small touches (veins of light on some trunks,
// paving stones adrift in the air, the bulbs glowing oddly, a few motes).
// Everything that blocks or carries here does so only while the dimension is on.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { CollisionWorld } from './colliders.js';
import { oliveVariants, seeded } from './olive.js';

const VIOLET = '#a86bff';

export function buildLayer(ctx, env) {
  const { cols, net, M } = ctx, { S, C, y, P, BOX, RIFT, pathZ, PATH_HALF, trees, ROW_X, ROW_Z, GREAT, lid, lidGroup, bulbs, bulbMat, quads, paverMat } = env;
  const layer = new THREE.Group(); layer.name = 'grove dimension'; layer.visible = false; S.group.add(layer);
  const B = new Batch(), R = seeded(5252), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const W = (lx, ly, lz) => [C.x + lx, y + ly, C.z + lz];
  const st = { on: false, t: 0 };
  const always = [];          // colliders of the layer that are on whenever the dimension is
  const pads = [];            // walking surfaces of the layer: { pad, when() }
  const glows = [];           // materials that breathe: { mat, base, amp, speed, phase }
  const body = (ax, az, bx, bz, { h = 3.4, t = 0.4, lo = -1 } = {}) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), b = cols.addDynamicBox(layer, len / 2, t / 2);
    CollisionWorld.setBox(b, C.x + (ax + bx) / 2, C.z + (az + bz) / 2, Math.atan2(-dz / len, dx / len), y + lo, y + h); b.enabled = false; return b;
  };
  const round = (lx, lz, r, h) => { const c = cols.addDynamicCircle(layer, r); CollisionWorld.setCircle(c, C.x + lx, C.z + lz, y - 1, y + h); c.soft = false; c.enabled = false; always.push(c); return c; };
  const basic = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, ...o });
  const add = (mesh, name) => { mesh.name = name; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); layer.add(mesh); return mesh; };
  const stoneBox = (w, h, d, lx, ly, lz, color = '#5d566b', yaw = 0, pitch = 0, roll = 0) => B.add('stone', M.stone, box(w, h, d), mat4(C.x + lx, y + ly, C.z + lz, yaw, 1, 1, 1, pitch, roll), { color: tint(color), uv: 'world', uvScale: 0.5 });
  const canvas = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };

  // ---------- energy walls: translucent violet sheets from trunk to trunk, each panel with a collider ----------
  const wallTex = canvas(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * R()})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 6 + R() * 40); }
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const chain = (pts) => pts.slice(1).map((p, i) => [pts[i], p]);
  const sheet = (panels, h) => {
    const pos = [], uv = [], idx = [];
    panels.forEach(([a, b], k) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = len / 3; pos.push(...W(a[0], 0, a[1]), ...W(b[0], 0, b[1]), ...W(b[0], h, b[1]), ...W(a[0], h, a[1])); uv.push(0, 0, u, 0, u, 1, 0, 1); idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  };
  const wall = (panels, { h = 3.4, color = VIOLET, opacity = 0.5, name }) => {
    const mat = basic({ map: wallTex, color, opacity, blending: THREE.AdditiveBlending }), mesh = add(new THREE.Mesh(sheet(panels, h), mat), name);
    return { mesh, mat, opacity, bodies: panels.map(([a, b]) => body(a[0], a[1], b[0], b[1], { h })), panels: panels.map(([a, b]) => ({ a: P(a[0], a[1]), b: P(b[0], b[1]) })) };
  };
  // the three seals: 0 between the landing lawn and the playground; 1 round the goal lawn (from the playground
  // and from the landing lawn); 2 across both ends of the broken path
  const sealPanels = [
    chain([...ROW_X.slice(6), [8, 47.5]]),
    [...chain(ROW_X.slice(0, 7)), ...chain([ROW_X[6], ...ROW_Z, [-46, 14]])],
    [[[RIFT.x1, -16.3], [RIFT.x1, -11.7]], [[RIFT.x0, -16.3], [RIFT.x0, -11.7]]],
  ];
  const seals = sealPanels.map((panels, i) => {
    const w = wall(panels, { name: `grove seal ${i}` }), s = { index: i, isOpen: false, fade: 1, panels: w.panels, mesh: w.mesh };
    s.sync = () => { for (const b of w.bodies) b.enabled = st.on && !s.isOpen; w.mesh.visible = s.fade > 0.01; w.mat.opacity = w.opacity * s.fade; };
    // open(): the wall thins out and is gone (at once with `instant`); shut(): it is back
    s.open = (instant = false) => { s.isOpen = true; if (instant) s.fade = 0; s.sync(); return s; };
    s.shut = () => { s.isOpen = false; s.fade = 1; s.sync(); return s; };
    s.update = (dt) => { if (s.isOpen && s.fade > 0) { s.fade = Math.max(0, s.fade - dt / 0.8); s.sync(); } };
    return s;
  });
  // the edge of this pocket of reality: the box all round, the two stubs that keep the far lawn apart (it is
  // reached over the broken path only), the gate at the far end. It never opens.
  const edge = wall([...chain([[-55.5, -47.5], [55.5, -47.5], [55.5, 47.5], [-55.5, 47.5], [-55.5, -47.5]]), ...chain([[1.6, -22.3], [8, -22.2], [13, -22.3], [17.4, -22.3]]), [[-46.2, RIFT.z1], [RIFT.x0 + 0.2, RIFT.z1]], [[-52, -21.4], [-52, -17.6]]], { h: 5, color: '#6a4cf0', opacity: 0.32, name: 'grove edge' });
  always.push(...edge.bodies);

  // ---------- the rift: walls going down into a violet glow, a floor of cracks far below, a broken lip ----------
  { const q = quads(), top = new THREE.Color('#241b2c'), deep = new THREE.Color('#7a35e0'), mid = new THREE.Color('#3a2358'), D = RIFT.depth + 0.3;
    const side = (ax, az, bx, bz) => { q.quad(W(ax, 0.02, az), W(bx, 0.02, bz), W(bx, -3, bz), W(ax, -3, az), top, 0.3, top, mid, mid); q.quad(W(ax, -3, az), W(bx, -3, bz), W(bx, -D, bz), W(ax, -D, az), mid, 0.3, mid, deep, deep); };
    side(RIFT.x0, RIFT.z0, RIFT.x1, RIFT.z0); side(RIFT.x1, RIFT.z0, RIFT.x1, RIFT.z1); side(RIFT.x1, RIFT.z1, RIFT.x0, RIFT.z1); side(RIFT.x0, RIFT.z1, RIFT.x0, RIFT.z0);
    add(new THREE.Mesh(q.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'grove rift walls');
    const cracks = canvas(256, 128, (g, w, h) => {
      g.fillStyle = '#12061f'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 34; k++) { g.strokeStyle = `rgba(${150 + R() * 80 | 0},${60 + R() * 60 | 0},255,${0.35 + R() * 0.6})`; g.lineWidth = 0.6 + R() * 2.2; g.beginPath(); let px = R() * w, py = R() * h; g.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (R() - 0.5) * 60; py += (R() - 0.5) * 34; g.lineTo(px, py); } g.stroke(); }
    });
    const fm = new THREE.MeshBasicMaterial({ map: cracks }), f = new THREE.Mesh(new THREE.PlaneGeometry(RIFT.x1 - RIFT.x0, RIFT.z1 - RIFT.z0).rotateX(-Math.PI / 2), fm);
    f.position.set(C.x + (RIFT.x0 + RIFT.x1) / 2, y - RIFT.depth + 0.08, C.z + (RIFT.z0 + RIFT.z1) / 2); add(f, 'grove rift floor'); glows.push({ mat: fm, base: 0.8, amp: 0.2, speed: 0.9, phase: 0, color: true });
    for (const [h, o] of [[-6.2, 0.2], [-3.4, 0.12]]) { const m = new THREE.Mesh(f.geometry, basic({ color: '#7a3cff', opacity: o, blending: THREE.AdditiveBlending })); m.position.set(f.position.x, y + h, f.position.z); add(m, 'grove rift haze'); }
    // nobody down there walks out under the lawn
    for (const [ax, az, bx, bz] of [[RIFT.x0, RIFT.z0, RIFT.x1, RIFT.z0], [RIFT.x1, RIFT.z0, RIFT.x1, RIFT.z1], [RIFT.x1, RIFT.z1, RIFT.x0, RIFT.z1], [RIFT.x0, RIFT.z1, RIFT.x0, RIFT.z0]]) cols.addSegment(C.x + ax, C.z + az, C.x + bx, C.z + bz, 0.5, y - RIFT.depth - 1, y - 2.2);
    // the lip: broken rock along both long sides and the ends, open only where the path goes over
    const lip = (ax, az, bx, bz, out) => {
      const len = Math.hypot(bx - ax, bz - az), ox = out[0] * 0.35, oz = out[1] * 0.35;
      always.push(body(ax + ox, az + oz, bx + ox, bz + oz, { h: 1.3, t: 0.7 }));
      for (let s = 0.3; s < len; s += 0.75 + R() * 0.3) { const k = s / len, w = 0.5 + R() * 0.5, h = 0.3 + R() * 0.5; stoneBox(w, h, 0.45 + R() * 0.35, ax + (bx - ax) * k + ox, h * 0.4, az + (bz - az) * k + oz, R() < 0.5 ? '#5d566b' : '#4a4458', R() * 3, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5); }
    };
    lip(RIFT.x0, RIFT.z0, RIFT.x1, RIFT.z0, [0, -1]); lip(RIFT.x0, RIFT.z1, RIFT.x1, RIFT.z1, [0, 1]);
    lip(RIFT.x1, RIFT.z0 - 0.7, RIFT.x1, -16.3, [1, 0]); lip(RIFT.x1, -11.7, RIFT.x1, RIFT.z1 + 0.7, [1, 0]); lip(RIFT.x0, RIFT.z0 - 0.7, RIFT.x0, -16.3, [-1, 0]); lip(RIFT.x0, -11.7, RIFT.x0, RIFT.z1 + 0.7, [-1, 0]);
  }

  // ---------- the broken path: `u` is metres along it from the east bank; a stone spans u0..u1 ----------
  const LEN = RIFT.x1 - RIFT.x0, HZ = PATH_HALF;
  const zAt = (u) => pathZ(RIFT.x1 - Math.min(LEN, Math.max(0, u)));
  const U = (u, lat = 0, top = 0, yaw) => P(RIFT.x1 - u, zAt(u) + lat, top, yaw);
  const span = (name, kind, u0, u1, hz = HZ, top = 0) => { const u = (u0 + u1) / 2; return { name, kind, u0, u1, lx: RIFT.x1 - u, lz: zAt(u), hx: (u1 - u0) / 2, hz, top }; };
  const PHASE = [ // the ones the engine's kit builds: [u0, u1, period, on, offset] (the first and the last never go)
    [-0.05, 2.75, 6, 6, 0], [2.7, 5.5, 6, 3.6, 0], [5.45, 8.25, 6, 3.6, 4.8], [8.2, 11.0, 6, 3.6, 3.6], [23.55, 26.35, 2.4, 0.9, 0], [26.3, 29.1, 2.4, 0.9, 1.2], [43.2, 46.05, 6, 6, 0],
  ];
  const FIXED = [ // the ones that are always there in the dimension, built here
    span('island A1', 'stone', 10.95, 16.6, 1.8), span('island A2', 'stone', 18.8, 23.6, 1.8), span('ledge foot', 'stone', 29.05, 32.2, 1.8), span('ledge top', 'stone', 32.2, 37.0, 1.8, 1.6),
    span('step 1', 'step', 36.97, 37.5, HZ, 1.2), span('step 2', 'step', 37.47, 38.0, HZ, 0.8), span('step 3', 'step', 37.97, 38.5, HZ, 0.4), span('landing', 'stone', 38.47, 40.3, 1.7),
  ];
  const BRIDGE = span('bridge', 'bridge', 40.25, 43.25, 1.5);
  const padOf = (s) => net.addPad({ x: C.x + s.lx, z: C.z + s.lz, hx: s.hx, hz: s.hz, yaw: 0, h: y + s.top - 0.05, top: 0.05, blend: 0, covered: false, walkOnly: true, name: 'grove stone' });
  const paver = (Bt, s, ox = 0, oy = 0, oz = 0, color = '#b6adc8') => Bt.add('grovePaver', paverMat, box(s.hx * 2, 0.3, s.hz * 2), mat4(ox, oy, oz), { color: tint(color), uv: 'world', uvScale: 1 });
  const hang = (Bt, s, ox, oy, oz, depth = 1.9) => Bt.add('stone', M.stone, new THREE.CylinderGeometry(1, 0.22, depth, 6), mat4(ox, oy - 0.3 - depth / 2, oz, 0, s.hx * 1.02, 1, s.hz * 1.02), { color: tint('#4b4459'), uv: 'world', uvScale: 0.4 });
  for (const s of FIXED) {
    pads.push({ pad: padOf(s), when: () => true });
    const wx = C.x + s.lx, wz = C.z + s.lz;
    paver(B, s, wx, y + s.top - 0.15, wz);
    if (s.top > 0) B.add('stone', M.stone, box(s.hx * 2, s.top - 0.3 + 0.02, s.hz * 2), mat4(wx, y + (s.top - 0.3) / 2, wz), { color: tint('#575066'), uv: 'world', uvScale: 0.4 });
    if (s.kind !== 'step') hang(B, s, wx, y, wz, 1.6 + R() * 1.2);
  }
  { const s = FIXED[3]; always.push(body(s.lx - s.hx, s.lz, s.lx + s.hx, s.lz, { h: s.top - 0.1, t: s.hz * 2, lo: -RIFT.depth })); } // the ledge is a block: nobody walks in under its top
  // broken ends where the paving stops at the lip, and a marked safe line down the middle of what stands
  for (const [u, s] of [[-0.7, 1], [46.7, -1]]) for (let k = 0; k < 4; k++) B.add('grovePaver', paverMat, box(0.5 + R() * 0.5, 0.12, 0.4 + R() * 0.4), mat4(C.x + RIFT.x1 - u + s * R() * 0.5, y + 0.1 + R() * 0.12, C.z + zAt(u) + (k - 1.5) * 0.8, R() * 3, 1, 1, 1, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5), { color: tint('#b6adc8'), uv: 'world' });
  { const q = quads(), c = new THREE.Color('#7df9ff');
    const dash = (u, top) => { const p = U(u, 0, top + 0.02); q.quad([p.x + 0.22, p.y, p.z - 0.07], [p.x - 0.22, p.y, p.z - 0.07], [p.x - 0.22, p.y, p.z + 0.07], [p.x + 0.22, p.y, p.z + 0.07], c); };
    for (const s of [span('', '', -4, 0), ...FIXED.filter((f) => f.kind !== 'step'), span('', '', LEN, LEN + 3.5)]) for (let u = s.u0 + 0.5; u < s.u1 - 0.2; u += 1.1) dash(u, s.top);
    const m = basic({ vertexColors: true, opacity: 0.85, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    add(new THREE.Mesh(q.geo(), m), 'grove safe line'); glows.push({ mat: m, base: 0.6, amp: 0.3, speed: 2.2, phase: 0 });
  }
  // the bridge: three slabs waiting down in the rift; thrown, they rise into place
  const bridge = { on: false, k: 0, ...U((BRIDGE.u0 + BRIDGE.u1) / 2), hx: BRIDGE.hx, hz: BRIDGE.hz };
  { const g = new THREE.Group(), bb = new Batch(); g.position.set(C.x + BRIDGE.lx, y, C.z + BRIDGE.lz); g.name = 'grove bridge';
    for (let k = 0; k < 3; k++) { const s = { hx: 0.48, hz: BRIDGE.hz }; paver(bb, s, (k - 1) * 1.0, -0.15, 0, '#c4b6e6'); hang(bb, s, (k - 1) * 1.0, 0, 0, 0.9); }
    bb.build(g); layer.add(g); bridge.group = g;
    const pad = padOf(BRIDGE); bridge.pad = pad; pads.push({ pad, when: () => bridge.on && bridge.k >= 1 });
    const place = () => { g.position.y = y - 4.6 * (1 - bridge.k) * (1 - bridge.k); pad.covered = st.on && bridge.on && bridge.k >= 1; };
    // set(true): the slabs rise (0.9 s; at once with `instant`) and carry; set(false): they sink
    bridge.set = (v = true, instant = false) => { bridge.on = !!v; if (instant || !st.on) bridge.k = v ? 1 : 0; place(); return bridge; };
    bridge.update = (dt) => { const to = bridge.on ? 1 : 0; if (bridge.k !== to) { bridge.k = to ? Math.min(1, bridge.k + dt / 0.9) : Math.max(0, bridge.k - dt / 0.6); place(); } };
    place();
  }
  const platforms = PHASE.map(([u0, u1, period, on, offset]) => { const s = span('', '', u0, u1); return { ...P(s.lx, s.lz), hx: s.hx, hz: s.hz, period, on, offset, ...(on >= period ? { fixed: true, warn: 0 } : {}) }; });
  const chainOf = [ // every piece in order, for whoever wants to check or draw the way
    { name: 'east bank', kind: 'bank', u0: -6, u1: 0, top: 0, lx: RIFT.x1 + 3, lz: -14, hx: 3, hz: 2.3 },
    ...PHASE.map(([u0, u1], i) => ({ ...span(`platform ${i}`, 'platform', u0, u1), platform: i })), ...FIXED, BRIDGE,
    { name: 'west bank', kind: 'bank', u0: LEN, u1: LEN + 6, top: 0, lx: RIFT.x0 - 3, lz: -14, hx: 3, hz: 2.3 },
  ].sort((a, b) => a.u0 - b.u0).map((s) => ({ name: s.name, kind: s.kind, u0: s.u0, u1: s.u1, ...P(s.lx, s.lz, s.top), hx: s.hx, hz: s.hz, ...(s.platform != null ? { platform: s.platform } : {}) }));
  const switches = [
    { ...U(22.9, 0.5), label: 'לייצב את האבנים', opens: [4, 5], steadies: [4, 5], at: U(22.9, 0.5, 0, 0) },
    { ...U(35.9, 0.5, 1.6), label: 'להרים את הגשר', opens: ['bridge'], steadies: [], at: U(35.9, 0.5, 1.6, 0) },
  ];
  const data = {
    platforms,
    fields: [{ ...U(13.8), r: 1.9, period: 7, hold: 2.5, offset: 0 }, { ...U(20.7), r: 1.7, period: 7, hold: 2.5, offset: 3.5 }],
    switches,
    leaps: [{ from: U(16.25), to: U(19.15), twoWay: true, label: 'לקפוץ' }],
    ledge: { bottom: U(31.8, -0.6, 0, -Math.PI / 2), top: U(32.95, -0.6, 1.6, -Math.PI / 2), from: U(31.75, 0.75, 0, -Math.PI / 2), to: U(33.4, 0.75, 1.6, -Math.PI / 2), height: 1.6, label: 'לטפס', hand: 'לתת יד לארז' },
    disturbances: [{ path: [U(11.8, 0.9), U(16.0, -0.9), U(19.4, 0.9), U(23.0, -0.9)], speed: 2.0, r: 0.7 }, { path: [U(40.9, 0.8), U(45.4, -0.8)], speed: 2.4, r: 0.7 }],
    minY: y - 3,
    inside: (p) => p.x > C.x + RIFT.x0 && p.x < C.x + RIFT.x1 && p.z > C.z + RIFT.z0 && p.z < C.z + RIFT.z1,
  };
  const brokenPath = {
    ...data, kit: data,                                   // `kit` is what pathKit(game, …) takes as it is
    safe: [U(-2), ...chainOf.filter((s) => s.kind !== 'bank' && s.kind !== 'step').flatMap((s) => (s.u1 - s.u0 > 4 ? [U(s.u0 + 0.9, 0, s.y - y), U(s.u1 - 0.9, 0, s.y - y)] : [{ x: s.x, z: s.z, y: s.y }])), U(LEN + 2)],
    start: U(-1.8, 0, 0, -Math.PI / 2), end: U(LEN + 1.8, 0, 0, -Math.PI / 2), length: LEN, floorY: y - RIFT.depth,
    rect: { x0: C.x + RIFT.x0, x1: C.x + RIFT.x1, z0: C.z + RIFT.z0, z1: C.z + RIFT.z1 }, stones: chainOf, bridge,
    // what a thrown switch does beyond steadying platforms (the kit does that): onSwitch: (i, on) => brokenPath.thrown(i, on)
    thrown: (i, v = true) => { if (switches[i]?.opens.includes('bridge')) bridge.set(v); },
  };

  // ---------- the symbols: a low stone with a glowing sign on it and over it ----------
  const glyph = (k) => canvas(128, 128, (g) => {
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.translate(64, 64);
    if (k === 0) { g.beginPath(); g.arc(0, 0, 46, 0, 6.3); g.stroke(); g.beginPath(); for (let i = 0; i < 4; i++) g.lineTo(Math.sin(i * 2.094) * 30, -Math.cos(i * 2.094) * 30); g.stroke(); g.beginPath(); g.arc(0, 0, 6, 0, 6.3); g.stroke(); }
    else if (k === 1) { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 16 + i * 15, i * 2.1, i * 2.1 + 4.3); g.stroke(); } g.beginPath(); g.moveTo(0, -52); g.lineTo(0, 52); g.stroke(); }
    else { g.beginPath(); g.moveTo(0, -50); g.lineTo(40, 0); g.lineTo(0, 50); g.lineTo(-40, 0); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.moveTo(-18, -26); g.lineTo(18, 26); g.moveTo(18, -26); g.lineTo(-18, 26); g.stroke(); }
  });
  const DIM = new THREE.Color('#8a5cff'), LIT = new THREE.Color('#9ffcff');
  const beacon = (lx, lz, tex, { h = 0.45, r = 0.55, hover = 1.25, size = 0.8, name }) => {
    const mat = basic({ map: tex, color: DIM.clone(), opacity: 0.45, blending: THREE.AdditiveBlending });
    const flatG = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(0, h + 0.02, 0), up = new THREE.PlaneGeometry(size, size).translate(0, hover, 0), up2 = up.clone().rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.position.set(C.x + lx, y, C.z + lz); for (const q of [flatG, up, up2]) g.add(new THREE.Mesh(q, mat)); g.name = name; layer.add(g);
    B.add('stone', M.stone, new THREE.CylinderGeometry(r * 0.82, r, h, 7), mat4(C.x + lx, y + h / 2, C.z + lz, lx), { color: tint('#6a6378'), uv: 'world', uvScale: 0.6 });
    round(lx, lz, r + 0.05, h + 0.2);
    const b = { ...P(lx, lz), lit: false, group: g };
    b.light = (v = true) => { b.lit = !!v; mat.color.copy(v ? LIT : DIM); mat.opacity = v ? 1 : 0.45; return b; };
    glows.push({ mat, base: 1, amp: 0.25, speed: 1.6, phase: lx, scaleOf: b });
    return b;
  };
  const SYM = [[15.2, -8.3], [-12, 31], [-14.2, 1.2]];
  const symbols = SYM.map(([lx, lz], i) => ({ ...beacon(lx, lz, glyph(i), { name: `grove symbol ${i}` }), index: i, at: P(lx, lz + 1.35, 0, Math.PI) }));
  for (const s of symbols) { const b = s.light; s.light = (v = true) => { b(v); s.lit = !!v; return s; }; }

  // ---------- the Keeper's clearing: four anchor stones round the open lawn among the olives ----------
  const AR = { lx: -24, lz: -34.5, r: 11 }, anchorTex = canvas(64, 64, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(32, 6); g.lineTo(54, 32); g.lineTo(32, 58); g.lineTo(10, 32); g.closePath(); g.stroke(); g.beginPath(); g.arc(32, 32, 7, 0, 6.3); g.fill(); });
  const anchors = [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4]].map(([dx, dz], i) => {
    const lx = AR.lx + dx, lz = AR.lz + dz, k = 1.1 / Math.hypot(dx, dz), a = { ...beacon(lx, lz, anchorTex, { h: 1.25, r: 0.42, hover: 1.85, size: 0.6, name: `grove anchor ${i}` }), index: i, at: P(lx - dx * k, lz - dz * k, 0, Math.atan2(dx, dz)) };
    const b = a.light; a.light = (v = true) => { b(v); a.lit = !!v; return a; };
    return a;
  });
  const arena = {
    ...P(AR.lx, AR.lz), centre: P(AR.lx, AR.lz), radius: AR.r, r: AR.r, anchors,
    spots: [P(AR.lx, AR.lz), ...[0, 1, 2, 3, 4, 5].map((k) => P(AR.lx + Math.sin(k * 1.047 + 0.52) * 7, AR.lz + Math.cos(k * 1.047 + 0.52) * 7))],
    cover: trees.filter((t) => Math.hypot(t.lx - AR.lx, t.lz - AR.lz) < 17).map((t) => ({ x: t.x, z: t.z, r: t.r })),
    entry: P(-44, -24.5),
  };

  // ---------- the energy point between the two great olives, the run to it, where the crystal appears ----------
  const PZ = (GREAT[0][1] + GREAT[1][1]) / 2, portalAt = { ...P(GREAT[0][0], PZ, 0, -Math.PI / 2), lit: false };
  const runUp = [-24, -15, -6, 3, GREAT[0][0]].map((lx) => P(lx, PZ));
  { const m = basic({ color: VIOLET, opacity: 0.3, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 28).rotateX(-Math.PI / 2), m), inner = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20).rotateX(-Math.PI / 2), m);
    for (const r of [ring, inner]) { r.position.set(portalAt.x, y + 0.05, portalAt.z); add(r, 'grove energy point'); }
    // mark(true): the point shows itself (mission 54's "marked energy point")
    portalAt.mark = (v = true) => { portalAt.lit = !!v; m.opacity = v ? 0.95 : 0.3; m.color.set(v ? '#9ffcff' : VIOLET); return portalAt; };
    glows.push({ mat: m, base: 1, amp: 0.3, speed: 2.4, phase: 1, lvl: () => (portalAt.lit ? 0.9 : 0.3) });
  }
  const crystalAt = P(AR.lx, AR.lz, 1.2);

  // ---------- touches: veins of light up some trunks, paving stones adrift, a few motes ----------
  { const q = quads(), c = new THREE.Color('#c79bff'), vars = oliveVariants();
    for (const t of trees.filter((t, i) => t.great || i % 3 === 0)) {
      const va = vars[t.v % vars.length], cs = Math.cos(t.yaw), sn = Math.sin(t.yaw);
      for (let strand = 0; strand < 2; strand++) {
        let prev = null;
        for (let i = 0; i <= 12; i++) {
          const f = (i / 12) * (va.spine.length - 1), i0 = Math.min(va.spine.length - 2, Math.floor(f)), k = f - i0, sp = va.spine[i0].clone().lerp(va.spine[i0 + 1], k), hh = Math.max(0, sp.y);
          const a = strand * 3.1 + t.yaw + hh * 2.4, rad = (va.radii[i0] + (va.radii[i0 + 1] - va.radii[i0]) * k) * 1.45, lx = sp.x + Math.cos(a) * rad, lz = sp.z + Math.sin(a) * rad;
          const p = [t.x + (lx * cs + lz * sn) * t.s, y + Math.max(0.02, sp.y * t.s * t.sy), t.z + (-lx * sn + lz * cs) * t.s];
          if (prev) q.quad([prev[0], prev[1] - 0.03, prev[2]], [p[0], p[1] - 0.03, p[2]], [p[0], p[1] + 0.03, p[2]], [prev[0], prev[1] + 0.03, prev[2]], c);
          prev = p;
        }
      }
    }
    const m = basic({ vertexColors: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    add(new THREE.Mesh(q.geo(), m), 'grove veins'); glows.push({ mat: m, base: 0.55, amp: 0.4, speed: 1.3, phase: 2 });
  }
  const drift = [[27, 2.6, 9], [-20, 1.3, -19.6], [-7, 3.1, -37.5], [-36, 2.2, 22]].map(([lx, h, lz], n) => {
    const g = new THREE.Group(), fb = new Batch(); g.position.set(C.x + lx, y + h, C.z + lz); g.name = 'grove adrift';
    for (let k = 0; k < 5; k++) fb.add('grovePaver', paverMat, box(0.5 + R() * 0.6, 0.1, 0.3 + R() * 0.4), mat4((R() - 0.5) * 3, (R() - 0.5) * 1.6, (R() - 0.5) * 3, R() * 3, 1, 1, 1, (R() - 0.5) * 0.9, (R() - 0.5) * 0.9), { color: tint('#c9c2dc'), uv: 'world' });
    fb.build(g); layer.add(g); return { g, h: y + h, ph: n * 1.7 };
  });
  const motes = (() => {
    const pos = []; for (let k = 0; k < 150; k++) pos.push(C.x + BOX.x0 + 6 + R() * (BOX.x1 - BOX.x0 - 12), y + 0.4 + R() * 4.2, C.z + BOX.z0 + 4 + R() * (BOX.z1 - BOX.z0 - 8));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.1, color: '#d6b8ff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); m.name = 'grove motes'; m.frustumCulled = false; layer.add(m); return m;
  })();
  const oddMat = new THREE.MeshBasicMaterial({ vertexColors: true });   // the bulbs, glowing oddly

  B.build(layer);
  layer.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------- on and off ----------
  // dimension(true): the layer shows, its walls and stones are real, the lid over the rift is gone (the path is
  // broken). dimension(false): the park is a park again, the path whole. The seals keep whichever way they were.
  const dimension = (v = true) => {
    st.on = !!v; layer.visible = st.on; lidGroup.visible = !st.on; lid.covered = !st.on;
    for (const b of always) b.enabled = st.on;
    for (const p of pads) p.pad.covered = st.on && p.when();
    for (const s of seals) s.sync();
    bulbs.material = st.on ? oddMat : bulbMat;
    return st.on;
  };
  // everything as it is when they land: the seals shut, the symbols and anchors dark, the bridge down
  const reset = () => { for (const s of seals) s.shut(); for (const s of [...symbols, ...anchors]) s.light(false); bridge.set(false, true); portalAt.mark(false); };
  const tick = (dt) => {
    if (!st.on) return;
    const t = (st.t += dt);
    wallTex.offset.y = (t * 0.07) % 1; wallTex.offset.x = (t * 0.013) % 1;
    for (const s of seals) s.update(dt);
    bridge.update(dt);
    for (const g of glows) {
      const k = g.base + g.amp * Math.sin(t * g.speed + g.phase);
      if (g.color) g.mat.color.setScalar(k);
      else if (g.scaleOf) { const s = g.scaleOf.lit ? 1 + 0.08 * Math.sin(t * 3 + g.phase) : 1; g.scaleOf.group.scale.set(s, 1, s); g.scaleOf.group.rotation.y = g.scaleOf.lit ? t * 0.6 : 0; }
      else g.mat.opacity = g.lvl ? k * g.lvl() : k;
    }
    for (const d of drift) { d.g.position.y = d.h + Math.sin(t * 0.5 + d.ph) * 0.35; d.g.rotation.y = t * 0.12 + d.ph; }
    motes.position.set(Math.sin(t * 0.11) * 1.6, Math.sin(t * 0.23) * 0.5, Math.cos(t * 0.09) * 1.6);
    oddMat.color.setHSL((0.72 + 0.14 * Math.sin(t * 0.4)) % 1, 0.55, 0.62 + 0.3 * Math.sin(t * 5.3) * Math.sin(t * 1.9));
  };
  dimension(false);

  return {
    tick, layer,
    api: {
      landing: { nehorai: P(24, 2, 0, -Math.PI / 2), erez: P(26.2, 3.8, 0, -Math.PI / 2) },
      symbols, seals, brokenPath, arena, portalAt, runUp, crystalAt,
      dimension, isDimension: () => st.on, reset, layer,
    },
  };
}
