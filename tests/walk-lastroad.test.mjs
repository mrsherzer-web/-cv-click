// The last road (chapter ten, "הדרך לגיהינום", places.lastRoad): can a car really drive from the safe house's
// yard down the link onto the iron road, along it to its end, along the hills road between the hills, over the
// new ravine's bridge to the citadel's main gate, and by the service road round the ravine to the service gate?
// Each route is driven end to end by the game's own car and physics with the debug autopilot (drivePath),
// stepped by hand: it stays on the road surface, hits nothing, takes no damage and gets there. Then: Kotzi's
// truck still closes the iron road until truck.clear(); bridge.blow() takes the middle span (a car is
// stopped at the burning rubble on the stump and does not fall; nobody crosses on foot; the game's own car
// reset puts a car that is down in the ravine back on a road) and bridge.restore() makes it drivable again;
// the side tracks' rivals get onto the road; the barricades shut the road but their gap; every blast spot,
// side track, barricade and checkpoint is on the ground where it should be; the rollover bank is beside the
// service road about 300 m out of the gate; nothing of the roads runs into the places it must keep clear of.
// Screenshots of the link, the hills road, the bridge whole and blown, the fork and the service road.
// Usage: node tests/walk-lastroad.test.mjs [distDir] [shotDir]
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
const SHOTS = process.argv[3] || new URL('../test-results/lastroad/', import.meta.url).pathname;
const NO_SHOTS = process.env.NO_SHOTS === '1';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
ctx.setDefaultTimeout(240000);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', mp4: 'video/mp4' };
await page.route(/^http:\/\/game\.local\//, async (r) => { let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p === '/') p = '/play.html'; try { const body = await fs.promises.readFile(path.join(ROOT, p)); r.fulfill({ status: 200, body, headers: { 'content-type': MIME[p.split('.').pop()] || 'application/octet-stream' } }); } catch (e) { r.fulfill({ status: 404, body: '' }); } });
await page.goto('http://game.local/play.html');
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
const G = (fn, arg) => page.evaluate(fn, arg);
await G(() => { window.__game.debug.game.hold = true; });
const P = (expr) => G((e) => new Function('P', 'W', `return (${e});`)(window.__game.debug.world.places.lastRoad, window.__game.debug.world), expr);

// ---------- the place: everything a mission counts on is there ----------
const shape = await G(() => {
  const W = window.__game.debug.world, P = W.places.lastRoad;
  if (!P) return null;
  const pose = (p) => !!p && [p.x, p.z, p.y, p.yaw].every(Number.isFinite);
  const names = W.net.roads.map((r) => r.name);
  return {
    routes: Object.fromEntries(Object.entries(P.routes).map(([k, v]) => [k, v.length])),
    paved: (W.places.lastRoads || []).map((r) => r.name),
    unique: names.length === new Set(names).size, dup: names.filter((n, i) => names.indexOf(n) !== i),
    blasts: P.blasts.filter((b) => [b.x, b.y, b.z, b.s, b.size].every(Number.isFinite) && b.road && b.route).length,
    sides: P.sideRoads.filter((s) => pose(s) && s.path.length > 10 && s.route).length,
    bars: P.barricades.filter((b) => [b.x, b.z, b.yaw].every(Number.isFinite) && b.gap.length === 2 && typeof b.raise === 'function' && typeof b.lower === 'function' && !b.up).length,
    cps: P.checkpoints.filter((c) => pose(c) && c.route && c.name).length,
    dodge: !!P.dodge && pose(P.dodge.start) && pose(P.dodge.end) && P.dodge.length > 50 && P.dodge.left.length > 10 && P.dodge.right.length > 10,
    bridge: typeof P.bridge.blow === 'function' && typeof P.bridge.restore === 'function' && !P.bridge.blown && pose(P.bridge.west) && pose(P.bridge.east) && pose(P.bridge.mid),
    bridgeAt: { x: P.bridge.x, z: P.bridge.z },
    fork: pose(P.fork) && P.fork.choices.map((c) => c.route).join(','), forkAt: { x: P.fork.x, z: P.fork.z },
    gates: ['main', 'service'].map((k) => P.gates[k]).every((g) => pose(g.outside) && pose(g.inside) && pose(g.far)),
    gateAt: { main: P.gates.main, service: P.gates.service },
    roll: pose(P.rollover) && pose(P.rollover.out) && P.rollover.gather.length >= 6,
    fns: ['routeAt', 'pathFrom', 'remaining', 'reset', 'tick'].every((f) => typeof P[f] === 'function'),
    truck: P.truck.found, start: P.routes.link[0], lamps: P.lamps.length,
  };
});
check('ctx.places.lastRoad exists', !!shape);
if (!shape) { await browser.close(); process.exit(1); }
check('routes: link, iron, main, service (and the escape)', ['link', 'iron', 'main', 'service', 'escape'].every((k) => shape.routes[k] > 20), JSON.stringify(shape.routes));
check('the four roads are listed in places.lastRoads to be paved', shape.paved.length === 4 && shape.paved.includes('דרך הגבעות') && shape.paved.includes('כביש השירות למצודה'), shape.paved.join(', '));
check('every road in the net has a name of its own', shape.unique, shape.dup.join(', '));
check('roadside blast spots', shape.blasts >= 8, `${shape.blasts}`);
check('side tracks for rivals, each with a start pose and a path', shape.sides >= 3, `${shape.sides}`);
check('barricades with a gap, down at the start', shape.bars >= 3, `${shape.bars}`);
check('checkpoints', shape.cps >= 5, `${shape.cps}`);
check('a marked stretch for dodging (start, end, two lanes)', shape.dodge);
check('the bridge: blow, restore, the approaches, at about (1320, 50)', shape.bridge && Math.hypot(shape.bridgeAt.x - 1320, shape.bridgeAt.z - 50) < 3);
check('the fork at about (1230, 20) offers main and service', shape.fork === 'main,service' && Math.hypot(shape.forkAt.x - 1230, shape.forkAt.z - 20) < 6, `${shape.fork} (${shape.forkAt.x.toFixed(0)}, ${shape.forkAt.z.toFixed(0)})`);
check('the gates at (1440, 95) and (1440, 235) with poses', shape.gates && Math.hypot(shape.gateAt.main.x - 1440, shape.gateAt.main.z - 95) < 2 && Math.hypot(shape.gateAt.service.x - 1440, shape.gateAt.service.z - 235) < 2);
check('the rollover bank with the spots round it', shape.roll);
check('routeAt / pathFrom / remaining / reset / tick', shape.fns);
check('Kotzi\'s truck on the iron road is found (to clear it)', shape.truck);
check('the link starts at the safe house\'s yard (about (700, -160))', Math.hypot(shape.start.x - 690, shape.start.z + 172) < 14, `(${shape.start.x.toFixed(0)}, ${shape.start.z.toFixed(0)})`);

// ---------- the ground: where the roads go and what is beside them ----------
const ground = await G(() => {
  const W = window.__game.debug.world, P = W.places.lastRoad, net = W.net, cols = W.cols, C = W.places.citadel, car = window.__game.debug.game.car;
  const out = { keep: {}, offSurface: [], gaps: 0, steps: [] };
  const KEEP = {
    hideout: (x, z) => x > 600 && x < 696 && z > -82 && z < -38, hq: (x, z) => x > 676 && x < 844 && z > 51 && z < 189,
    oldRavine: (x, z) => x > 998 && x < 1042 && z > 40 && z < 270, oldBridge: (x, z) => x > 932 && x < 1096 && z > 136 && z < 164,
    industry: (x, z) => Math.abs(x - 1097) < 14 && z > 150 && z < 300, facility: (x, z) => x > 1428 && x < 1612 && z < -48,
    plaza: (x, z) => x > 1655 && x < 1885 && z < -15, grove: (x, z) => x > 1150 && x < 1262 && z > 180 && z < 276,
    citadel: (x, z) => x >= 1440 && z > 30 && z < 280 && Math.hypot(x - 1440, z - 95) > 8 && Math.hypot(x - 1440, z - 235) > 8, getaway: (x, z) => x > 1800 && x < 1830,
  };
  for (const r of Object.values(P.roads)) {
    if (r === P.roads.iron) continue;
    for (let i = 0; i < r.n; i++) for (const [k, f] of Object.entries(KEEP)) if (f(r.x[i], r.z[i])) out.keep[k] = (out.keep[k] || 0) + 1;
  }
  for (const k of ['link', 'iron', 'main', 'service', 'escape', 'direct', 'convoy']) {
    const pts = P.routes[k];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], y = net.surface(p.x, p.z);
      if (y === null) out.offSurface.push(`${k}#${i} (${p.x.toFixed(0)},${p.z.toFixed(0)})`);
      if (i) { const q = pts[i - 1], l = Math.hypot(p.x - q.x, p.z - q.z); if (l > 6) out.gaps++; const y0 = net.surface(q.x, q.z); if (y !== null && y0 !== null && Math.abs(y - y0) > 0.6) out.steps.push(`${k}#${i} ${(y - y0).toFixed(2)}`); }
    }
  }
  // the legs meet: the link's end and the iron route's start, the iron road's end and the hills road's start
  const R = P.routes, last = (a) => a[a.length - 1], d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  out.joins = { linkIron: d(last(R.link), R.iron[0]), ironMain: d(last(R.iron), R.main[0]), ironService: d(last(R.iron), R.service[0]) };
  out.linkOnIron = net.under(last(R.link).x, last(R.link).z)?.road === P.roads.iron;
  // the roads meet the citadel's gates at its height
  out.gateH = ['main', 'service'].map((k) => { const o = C?.gates?.[k]?.outside, y = o ? net.surface(o.x, o.z) : null; return { k, y, cy: C?.y, ok: o && y !== null && Math.abs(y - C.y) < 0.35 }; });
  const ar = C?.armoured?.route, arEnd = ar?.[ar.length - 1];
  out.armoured = arEnd ? { onRoad: net.under(arEnd.x, arEnd.z)?.road === P.roads.service, d: Math.min(...R.escape.map((p) => d(p, arEnd))) } : null;
  out.ends = { main: d(last(R.main), P.gates.main), service: d(last(R.service), P.gates.service) };
  // the rim of the ravine: the land along it is within the wall's reach
  const lanes = [...Object.values(P.routes).flat(), ...P.sideRoads.flatMap((s) => s.path)];
  const near = (x, z) => { let m = Infinity; for (const p of lanes) m = Math.min(m, Math.hypot(p.x - x, p.z - z)); return m; };
  out.blastsOnLane = []; out.blastsBare = [];
  for (const b of P.blasts) {
    const n = near(b.x, b.z);
    if (n < 7) out.blastsOnLane.push(`${b.road}@${b.s.toFixed(0)} ${n.toFixed(1)}m`);
    if (!cols.blocks(b.x, b.y + 0.5, b.z) && !cols.blocks(b.x, b.y + 0.5, b.z + 0.3)) out.blastsBare.push(`${b.road}@${b.s.toFixed(0)}`);
    if (Math.abs(W.groundHeight(b.x, b.z) - b.y) > 0.4) out.blastsBare.push(`${b.road}@${b.s.toFixed(0)} floats ${(b.y - W.groundHeight(b.x, b.z)).toFixed(2)}`);
  }
  out.sides = P.sideRoads.map((s) => { const u = net.under(s.x, s.z), e = last(s.path); return { name: s.name, onTrack: u?.road.name === s.road, y: Math.abs(net.surface(s.x, s.z) - s.y) < 0.3, first: d(s.path[0], s) < 1, joins: net.under(e.x, e.z)?.road === P.roads[s.onto] || net.under(e.x, e.z)?.road === P.roads.service }; });
  out.bars = P.barricades.map((b) => { const u = net.under(b.x, b.z); return { name: b.name, on: u?.road === P.roads[b.road], y: Math.abs(net.surface(b.x, b.z) - b.y) < 0.3 }; });
  out.cps = P.checkpoints.map((c) => { const at = P.routeAt(c.x, c.z); return { name: c.name, surf: net.surface(c.x, c.z) !== null && Math.abs(net.surface(c.x, c.z) - c.y) < 0.3, route: at?.route === c.route || (c.route === 'common' && at?.route === 'common'), free: !cols.blocks(c.x, c.y + 0.8, c.z, car) }; });
  // the rollover: beside the service road, off the asphalt, on a shallow bank, about 300 m out of the gate
  const ro = P.rollover, q = P.roads.service.nearest(ro.x, ro.z), y0 = W.groundHeight(ro.x, ro.z);
  let slope = 0; for (let a = 0; a < 6.28; a += 0.785) slope = Math.max(slope, Math.abs(W.groundHeight(ro.x + Math.cos(a) * 3, ro.z + Math.sin(a) * 3) - y0));
  out.roll = { d: q.d, off: net.surface(ro.x, ro.z) === null, below: q.h - y0, slope, fromGate: P.gates.service.s - q.s, clear: !cols.blocks(ro.x, y0 + 0.8, ro.z, car), gatherFree: ro.gather.every((p) => !cols.blocks(p.x, p.y + 0.8, p.z, car)) };
  // the hills: mounds on both sides of the hills road, none on any road
  const hr = P.roads.hills;
  out.hills = { n: P.hills.length, left: 0, right: 0, onRoad: 0 };
  for (const m of P.hills) { const n = hr.nearest(m.x, m.z); if (n && n.d < 140) { const a = hr.at(n.s); ((m.x - a.x) * a.nx + (m.z - a.z) * a.nz > 0 ? out.hills.right++ : out.hills.left++); } if (net.under(m.x, m.z)) out.hills.onRoad++; }
  // the hills either side of the road: the land rises beside the hills road
  let rise = 0, samples = 0; for (let s = 30; s < hr.length - 40; s += 20) { const a = hr.at(s); let m = 0; for (const o of [-40, -30, 30, 40]) m = Math.max(m, W.groundHeight(a.x + a.nx * o, a.z + a.nz * o) - a.h); rise += m; samples++; }
  out.rise = rise / samples;
  // the ravine's rim wall stands on the land everywhere (its collider reaches the ground)
  const rv = P.ravine; out.rim = 0;
  for (let z = rv.z0; z <= rv.z1; z += 4) for (const x of [rv.x0, rv.x1]) { if (Math.abs(z - P.bridge.z) < 6) continue; const g = W.terrain ? W.terrain.heightAt(x, z) : W.groundHeight(x, z); if (!cols.blocks(x, g + 0.6, z)) out.rim++; }
  for (let x = rv.x0; x <= rv.x1; x += 4) for (const z of [rv.z0, rv.z1]) { const g = W.groundHeight(x, z); if (!cols.blocks(x, g + 0.6, z)) out.rim++; }
  out.depth = P.bridge.y - W.groundHeight(P.bridge.x, P.bridge.z + 30);
  return out;
});
check('the roads keep clear of the hideout, the HQ, the old ravine and bridge, Kotzi\'s road, the facility, the plaza, the citadel, the grove and the getaway', Object.keys(ground.keep).length === 0, JSON.stringify(ground.keep));
check('route points are close together', ground.gaps === 0, `${ground.gaps} gaps`);
check('every route point is on a road surface', ground.offSurface.length === 0, ground.offSurface.slice(0, 4).join(' '));
check('no steps along a route', ground.steps.length === 0, ground.steps.slice(0, 4).join(' '));
check('the link ends on the iron road, and the legs meet (link → iron → hills road)', ground.linkOnIron && Object.values(ground.joins).every((v) => v < 4), JSON.stringify(Object.fromEntries(Object.entries(ground.joins).map(([k, v]) => [k, +v.toFixed(1)]))));
check('the roads meet the citadel\'s gates (outside) at the citadel\'s height', ground.gateH.every((g) => g.ok), JSON.stringify(ground.gateH.map((g) => [g.k, g.y?.toFixed(2), g.cy?.toFixed(2)])));
check('the armoured car\'s way out ends on the service road, where the escape route runs', ground.armoured?.onRoad && ground.armoured.d < 5, JSON.stringify(ground.armoured));
check('routes.main and routes.service end at their gates', ground.ends.main < 8 && ground.ends.service < 8, JSON.stringify(ground.ends));
check('blast spots stand off the lanes (routes and side tracks)', ground.blastsOnLane.length === 0, ground.blastsOnLane.slice(0, 3).join(' '));
check('every blast spot has something there, on the ground', ground.blastsBare.length === 0, ground.blastsBare.join(' '));
for (const s of ground.sides) check(`side track ${s.name}: the start pose on its track, its path from there onto the road`, s.onTrack && s.y && s.first && s.joins, JSON.stringify(s));
for (const b of ground.bars) check(`barricade ${b.name}: across its road, on it`, b.on && b.y);
for (const c of ground.cps) check(`checkpoint ${c.name}: on the road surface, on its route, clear`, c.surf && c.route && c.free, JSON.stringify(c));
check('the rollover bank: beside the service road (6..14 m off its line), off the asphalt, a little below it', ground.roll.d > 6 && ground.roll.d < 14 && ground.roll.off && ground.roll.below > 0.2 && ground.roll.below < 2.5, `${ground.roll.d.toFixed(1)} m off, ${ground.roll.below.toFixed(2)} m below`);
check('  a shallow bank, about 300 m out of the service gate, clear to stand round', ground.roll.slope < 1.3 && ground.roll.fromGate > 270 && ground.roll.fromGate < 330 && ground.roll.clear && ground.roll.gatherFree, `slope ${ground.roll.slope.toFixed(2)} m over 3 m, ${ground.roll.fromGate.toFixed(0)} m from the gate`);
check('hills either side of the hills road, none on a road', ground.hills.left >= 2 && ground.hills.right >= 2 && ground.hills.onRoad === 0, JSON.stringify(ground.hills));
check('  the land rises beside the hills road', ground.rise > 3, `${ground.rise.toFixed(1)} m on average 30-40 m off`);
check('the ravine is deep (about 16 m) and walled along its rim', ground.depth > 13 && ground.rim === 0, `${ground.depth.toFixed(1)} m, ${ground.rim} gaps in the wall`);

// ---------- driving: the Renault, the game's own physics, stepped by hand along a list of points ----------
const drive = (pts, cruise, { maxT = 260, until = null } = {}) => G(({ pts, cruise, maxT, until }) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, car = g.car;
  g.hold = true;
  window.__game.drivePath([['points', pts]], cruise); const ap = g.autopilot; g.autopilot = null;
  const a = pts[0], b = pts[1];
  car.repair(); car.place(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z)); car.impacts = 0; car.vy = 0;
  const stop = until ? new Function('car', 'P', `return (${until});`) : null, P = W.places.lastRoad;
  let off = 0, t = 0, sunk = 0, low = Infinity, stuck = 0; const offAt = [];
  for (const dt = 1 / 30; !ap.done && t < maxT; t += dt) {
    car.update(dt, ap.drive(car));
    const y = W.net.surface(car.pos.x, car.pos.z);
    if (y === null) { off++; if (offAt.length < 3) offAt.push(`${car.pos.x.toFixed(0)},${car.pos.z.toFixed(0)}`); }
    const gr = car.groundUnder(); if (car.pos.y < gr - 0.3) sunk++;
    low = Math.min(low, car.pos.y); stuck = Math.max(stuck, car.stuckTime);
    if (stop && stop(car, P)) break;
  }
  const end = pts[pts.length - 1];
  return { t: +t.toFixed(1), done: ap.done, endD: +Math.hypot(car.pos.x - end.x, car.pos.z - end.z).toFixed(1), off, offAt, sunk, impacts: car.impacts, x: car.pos.x, y: car.pos.y, z: car.pos.z, low, stuck: +stuck.toFixed(1), health: Math.round(car.health) };
}, { pts, cruise, maxT, until });

{ // the truck of chapter eight still closes the iron road's end; cleared, the way is open
  const pts = await P('P.routes.iron.slice(-30)');
  const r = await drive(pts, 14, { maxT: 40 });
  check('Kotzi\'s truck still stands across the iron road\'s end (chapters eight and nine)', !r.done && r.endD > 5, `${r.endD} m short`);
  await G(() => window.__game.debug.world.places.lastRoad.truck.clear());
}
for (const [k, cruise] of [['link', 15], ['iron', 17], ['main', 16], ['service', 16], ['escape', 16], ['direct', 17], ['convoy', 17]]) {
  const r = await drive(await P(`P.routes.${k}`), cruise);
  check(`drive routes.${k} end to end`, r.done && r.endD < 4, `${r.t} s, ${r.endD} m from the end`);
  check(`  ${k}: on the road surface all the way, never stuck`, r.off === 0 && r.sunk === 0 && r.stuck < 1, `${r.off} off ${r.offAt.join(' ')}, ${r.sunk} sunk, stuck ${r.stuck} s`);
  check(`  ${k}: hits nothing, no damage`, r.impacts === 0 && r.health === 100, `${r.impacts} impacts, health ${r.health}`);
}
for (const [i, name] of (await P('P.sideRoads.map((s) => s.name)')).entries()) {
  const r = await drive(await P(`P.sideRoads[${i}].path`), 13);
  check(`a rival from the side track ${name} gets onto the road and on`, r.done && r.impacts === 0 && r.off === 0, `${r.impacts} impacts, ${r.off} off, ${r.endD} m`);
}
{ // the barricades raised: the routes thread their gaps; the rest of the road is shut
  await G(() => { for (const b of window.__game.debug.world.places.lastRoad.barricades) b.raise(); });
  const shut = await G(() => {
    const W = window.__game.debug.world, P = W.places.lastRoad, car = window.__game.debug.game.car;
    return P.barricades.map((b) => { const r = P.roads[b.road], q = r.nearest(b.x, b.z), a = r.at(q.s), at = (o) => W.cols.blocks(a.x + a.nx * o, a.h + 0.6, a.z + a.nz * o, car);
      const mid = (b.gap[0] + b.gap[1]) / 2; return { name: b.name, gapFree: !at(mid) && !at(mid - 1) && !at(mid + 1), shut: at(b.gap[0] - 1.5) && at(b.gap[1] + 1.5) && at(-6) && at(6) }; });
  });
  for (const s of shut) check(`barricade ${s.name} raised: shut across the road, its gap free`, s.gapFree && s.shut, JSON.stringify(s));
  for (const k of ['direct', 'convoy']) {
    const r = await drive(await P(`P.routes.${k}`), 16);
    check(`  with the barricades up, routes.${k} still goes through their gaps`, r.done && r.impacts === 0 && r.health === 100, `${r.impacts} impacts, ${r.endD} m`);
  }
  const r = await drive(await P('(() => { const b = P.barricades[0], r = P.roads[b.road], q = r.nearest(b.x, b.z).s, out = []; for (let s = q - 50; s < q + 30; s += 3) { const a = r.at(s); out.push({ x: a.x - a.nx * 5, z: a.z - a.nz * 5 }); } return out; })()'), 12, { maxT: 30 });
  check('  a car outside the gap is stopped by the blocks', !r.done && r.impacts > 0, `${r.impacts} impacts`);
  await G(() => { for (const b of window.__game.debug.world.places.lastRoad.barricades) b.lower(); });
  const r2 = await drive(await P('(() => { const b = P.barricades[0], r = P.roads[b.road], q = r.nearest(b.x, b.z).s, out = []; for (let s = q - 50; s < q + 30; s += 3) { const a = r.at(s); out.push({ x: a.x - a.nx * 2, z: a.z - a.nz * 2 }); } return out; })()'), 12, { maxT: 30 });
  check('  lowered again, the road is clear', r2.done && r2.impacts === 0, `${r2.impacts} impacts`);
}
{ // the bridge blown: the middle span gone; a car is stopped at the rubble on the stump and does not fall
  const before = await P('({ span: P.bridge.span.visible, pad: W.net.surface(P.bridge.x, P.bridge.z), y: P.bridge.y })');
  await G(() => window.__game.debug.world.places.lastRoad.bridge.blow());
  const after = await P('({ span: P.bridge.span.visible, wreck: P.bridge.wreck.visible, blown: P.bridge.blown, mid: W.net.surface(P.bridge.x, P.bridge.z), west: W.net.surface(P.bridge.westDeck.x, P.bridge.westDeck.z), east: W.net.surface(P.bridge.eastDeck.x, P.bridge.eastDeck.z), floorY: P.bridge.floorY })');
  check('bridge.blow(): the span\'s meshes go, the wreck shows', before.span && !after.span && after.wreck && after.blown);
  check('  the walking/driving surface of the span is gone (the ravine floor is under it), the stumps stay', Math.abs(before.pad - before.y) < 0.1 && after.mid < after.floorY + 1 && Math.abs(after.west - before.y) < 0.1 && Math.abs(after.east - before.y) < 0.1, `mid ${after.mid?.toFixed(1)}, floor ${after.floorY.toFixed(1)}`);
  const pts = await P('P.pathFrom("main", P.bridge.west.x, P.bridge.west.z).slice(0, 34)');
  for (const v of [10, 22]) {
    const r = await drive(pts, v, { maxT: 30 });
    const g = await P('P.bridge.gap');
    check(`  a car driving at the blown bridge at ${v} m/s is stopped at the stump: it does not cross and does not fall`, !r.done && r.x < g.x0 && r.low > before.y - 1, `stopped at x ${r.x.toFixed(1)} (the gap starts at ${g.x0}), lowest ${(r.low - before.y).toFixed(2)} m`);
  }
  // on foot: the stumps' rubble and the parapets close the way; nobody walks across
  const foot = await G(() => {
    const W = window.__game.debug.world, P = W.places.lastRoad, b = P.bridge, cols = W.cols, car = window.__game.debug.game.car;
    const cross = () => { // a flood fill on the deck at its height, as the walk tests do
      const S = 0.5, x0 = b.x0 - 6, z0 = b.z - 8, nx = Math.round((b.x1 - b.x0 + 12) / S), nz = Math.round(16 / S), seen = new Set(), q = [];
      const at = (i, j) => ({ x: x0 + i * S, z: z0 + j * S });
      const push = (i, j, y) => { const k = i * nz + j; if (seen.has(k)) return; seen.add(k); q.push([i, j, y]); };
      const s0 = { i: Math.round((b.westDeck.x - x0) / S), j: Math.round((b.westDeck.z - z0) / S) }; push(s0.i, s0.j, b.y);
      while (q.length) { const [i, j, y] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= nx || c >= nz) continue; const p = at(a, c), y2 = W.groundHeight(p.x, p.z, y); if (Math.abs(y2 - y) > 0.9) continue; const pos = { x: p.x, y: y2, z: p.z }; if (cols.resolve(pos, 0.35, y2, car) && Math.hypot(pos.x - p.x, pos.z - p.z) > 0.02) continue; push(a, c, y2); } }
      const e = { i: Math.round((b.eastDeck.x - x0) / S), j: Math.round((b.eastDeck.z - z0) / S) };
      return seen.has(e.i * nz + e.j);
    };
    const blown = cross(); P.bridge.restore(); const whole = cross(); P.bridge.blow();
    return { blown, whole };
  });
  check('  on foot, nobody gets across the blown bridge (and across it whole they do)', !foot.blown && foot.whole, JSON.stringify(foot));
  // a car that is down in the ravine all the same: the game's own reset (car.reset) puts it back on a road
  const back = await G(() => {
    const W = window.__game.debug.world, P = W.places.lastRoad, car = window.__game.debug.game.car;
    car.place(P.bridge.x + 2, P.bridge.z + 12, 0); const y0 = car.pos.y; car.reset();
    const u = W.net.under(car.pos.x, car.pos.z);
    return { y0: y0 - P.bridge.y, road: u?.road.name ?? null, up: car.pos.y - P.bridge.y, d: Math.hypot(car.pos.x - P.bridge.x, car.pos.z - P.bridge.z) };
  });
  check('  a car down in the ravine is put back on a road by the game\'s own reset (car.reset)', back.y0 < -10 && back.road && Math.abs(back.up) < 3 && back.d < 120, JSON.stringify(back));
  await G(() => window.__game.debug.world.places.lastRoad.bridge.restore());
  const whole = await P('({ span: P.bridge.span.visible, wreck: P.bridge.wreck.visible, blown: P.bridge.blown, mid: W.net.surface(P.bridge.x, P.bridge.z) })');
  check('bridge.restore(): the span is back, the wreck hidden', whole.span && !whole.wreck && !whole.blown && Math.abs(whole.mid - before.y) < 0.1);
  const r = await drive(pts, 16, { maxT: 40 });
  check('  and a car drives across it again', r.done && r.impacts === 0, `${r.impacts} impacts, ${r.endD} m`);
}
{ // the reset and the routes' helpers
  const h = await P('(() => { const f = P.fork.choices; P.barricades[0].raise(); P.bridge.blow(); P.truck.restore(); P.reset(); const ok = !P.barricades[0].up && !P.bridge.blown && !P.truck.cleared; P.truck.clear(); return { ok, at: [P.routeAt(P.start.x, P.start.z)?.route, P.routeAt(P.join.x, P.join.z)?.route, P.routeAt(P.checkpoints[2].x, P.checkpoints[2].z)?.route, P.routeAt(f[0].at.x, f[0].at.z)?.route, P.routeAt(f[1].at.x, f[1].at.z)?.route, P.routeAt(P.bridge.mid.x, P.bridge.mid.z)?.route], rem: Math.round(P.remaining("service", P.fork.x, P.fork.z)), from: P.pathFrom("service", P.fork.x, P.fork.z).length }; })()');
  check('reset(): the bridge whole, the barricades down, the truck back', h.ok);
  check('routeAt names the way (link, iron, common, main, service, the bridge on main)', h.at.join(',') === 'link,iron,common,main,service,main', h.at.join(','));
  check('remaining() and pathFrom() along the service route from the fork', h.rem > 200 && h.rem < 500 && h.from > 50, `${h.rem} m, ${h.from} points`);
  await G(() => window.__game.debug.world.places.lastRoad.truck.restore());
}

// ---------- screenshots: the link, the hills road, the bridge whole and blown, the fork, the service road ----------
if (!NO_SHOTS) {
  await G(() => { const e = document.getElementById('startScreen'); if (e) e.style.display = 'none'; });
  const shot = async (name, from, look) => {
    const calls = await G(({ from, look }) => {
      const D = window.__game.debug, g = D.game; g.hold = true; g.daylight?.set(0, 0);
      window.__game.teleport(look.x, look.z); g.follow.shot(from, look, 9999);
      for (let i = 0; i < 4; i++) g.update(1 / 30);
      D.renderer.render(D.scene, D.camera);
      return D.renderer.info.render.calls;
    }, { from, look });
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    console.log(`      shot ${name}.png (${calls} draw calls)`);
    return calls;
  };
  const v = await P(`(() => { const r = P.roads, a = (road, s, o = 0, up = 0) => { const p = road.at(s); return { x: p.x + p.nx * o, y: p.h + up, z: p.z + p.nz * o }; }; const b = P.bridge;
    return { link: [a(r.link, 20, -6, 9), a(r.link, 120, 0, 1)], hills: [a(r.hills, 60, 3, 7), a(r.hills, 170, 0, 2)], bridge: [{ x: b.x - 30, y: b.y + 9, z: b.z - 40 }, { x: b.x, y: b.y - 2, z: b.z }],
      fork: [a(r.hills, P.fork.before.s - 20, -14, 16), { x: P.fork.x + 25, y: P.fork.y, z: P.fork.z + 20 }], service: [a(r.service, 120, -10, 10), a(r.service, 220, 0, 1)] }; })()`);
  const calls = [];
  calls.push(await shot('lastroad-link', ...v.link));
  calls.push(await shot('lastroad-hills', ...v.hills));
  calls.push(await shot('lastroad-bridge', ...v.bridge));
  await G(() => window.__game.debug.world.places.lastRoad.bridge.blow({ fx: window.__game.debug.game.fx, boom: false }));
  for (let i = 0; i < 20; i++) await G(() => window.__game.debug.game.update(1 / 30));
  calls.push(await shot('lastroad-bridge-blown', ...v.bridge));
  await G(() => window.__game.debug.world.places.lastRoad.bridge.restore());
  calls.push(await shot('lastroad-fork', ...v.fork));
  calls.push(await shot('lastroad-service', ...v.service));
  check('draw calls stay phone-friendly along the road', Math.max(...calls) < 400, calls.join(', '));
}

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
