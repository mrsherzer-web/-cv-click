// The death road (chapter nine, כביש המוות): can the Renault really drive every way from the safe house's
// yard to the Black Port's gate? Each route is driven end to end by the game's own car and physics, stepped
// by hand along the route's points with the debug autopilot (drivePath): it stays on the road surface,
// hits nothing, and gets there; the ramps throw it into the air (car.launches grows); the ditch on the dirt
// track is a real gap (a slow car does not get across); the closure shuts the highway and opens it again;
// the rivals' side roads and the head-on lorry's lane are clear; the covered gallery has nothing solid in
// its lanes and its lamps are inside; the three routes leave at the fork and meet again before the port;
// nothing stands in the Iron Base or on the iron road's branch, and the long east stretch keeps off the
// hills. Screenshots of the fork, the gallery and a jump. Usage: node tests/walk-deathroad.test.mjs [distDir] [shotDir]
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
const SHOTS = process.argv[3] || new URL('../test-results/deathroad/', import.meta.url).pathname;
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

// ---------- the place: everything a mission counts on is there ----------
const shape = await G(() => {
  const P = window.__game.debug.world.places.deathRoad;
  if (!P) return null;
  return {
    routes: Object.fromEntries(Object.entries(P.routes).map(([k, v]) => [k, v.length])),
    ramps: P.ramps.map((r) => r.road), tunnels: P.tunnels.map((t) => t.lamps.length), lamps: P.lamps.length,
    blocks: P.roadblocks.map((b) => b.kind), blasts: P.blasts.filter((b) => Number.isFinite(b.x) && Number.isFinite(b.s) && b.road && b.size).length, joins: P.joins.filter((j) => j.path.length > 5).length,
    truck: !!(P.truckRun?.start && Number.isFinite(P.truckRun.lane) && P.truckRun.dir === -1 && P.truckRun.path.length > 20),
    end: P.end, gate: P.gate, first: P.routes.main[0], fork: P.fork.choices.map((c) => c.route), fns: ['routeAt', 'pathFrom', 'remaining'].every((f) => typeof P[f] === 'function'),
    closure: typeof P.closure?.close === 'function' && typeof P.closure.open === 'function' && !P.closure.closed,
  };
});
check('ctx.places.deathRoad exists', !!shape);
if (!shape) { await browser.close(); process.exit(1); }
check('three routes: main, tunnel, dirt', ['main', 'tunnel', 'dirt'].every((k) => shape.routes[k] > 100), JSON.stringify(shape.routes));
check('the fork offers all three', ['main', 'tunnel', 'dirt'].every((k) => shape.fork.includes(k)));
check('ramps on the highway and on the dirt track', shape.ramps.filter((r) => r === 'main').length >= 2 && shape.ramps.includes('dirt'), shape.ramps.join(','));
check('a tunnel with lamps inside', shape.tunnels.length >= 1 && shape.tunnels[0] >= 8, `${shape.tunnels[0]} lamps`);
check('roadblocks: barriers, a parked truck, the closure', ['barriers', 'truck', 'closure'].every((k) => shape.blocks.includes(k)), shape.blocks.join(','));
check('roadside blast spots with s and positions', shape.blasts >= 12, `${shape.blasts}`);
check('places rival cars join from', shape.joins >= 4, `${shape.joins}`);
check('a straight where a truck comes head-on (start, lane, direction, path)', shape.truck);
check('the end is at the port\'s west gate', Math.abs(shape.end.x - 1535) < 12 && Math.abs(shape.end.z + 352) < 14 && Math.hypot(shape.gate.x - 1540, shape.gate.z + 350) < 4, `end (${shape.end.x.toFixed(0)}, ${shape.end.z.toFixed(0)})`);
check('the road starts at the safe house\'s yard (680, -175)', Math.hypot(shape.first.x - 680, shape.first.z + 175) < 8, `(${shape.first.x.toFixed(0)}, ${shape.first.z.toFixed(0)})`);
check('routeAt / pathFrom / remaining', shape.fns);
check('the closure starts open', shape.closure);

// ---------- the ground: where the roads go and what is beside them ----------
const ground = await G(() => {
  const W = window.__game.debug.world, P = W.places.deathRoad, net = W.net, cols = W.cols;
  const out = { inBase: 0, nearBranch: 0, offHills: 0, gaps: 0, offSurface: [], steps: [], blastsOnLane: [], blastsBare: [], spurs: 0 };
  const roads = Object.values(P.roads);
  for (const r of roads) for (let i = 0; i < r.n; i++) {
    const x = r.x[i], z = r.z[i];
    if (x > 1060 && x < 1180 && z > -340 && z < -240) out.inBase++;
    if (Math.hypot(x - 1112, z + 214) < 40) out.nearBranch++;
    if ([P.roads.main, P.roads.tunnel, P.roads.dirt].includes(r) && x > 960 && x < 1500 && (z < -460 || z > -360)) out.offHills++;
  }
  const d = P.ditch, inDitch = (x, z) => { const q = P.roads.dirt.nearest(x, z); return q && q.d < 8 && Math.abs(q.s - d.s) < d.half + 12; };
  for (const [k, pts] of Object.entries(P.routes)) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], y = net.surface(p.x, p.z);
      if (y === null) out.offSurface.push(`${k}#${i}`);
      if (i) { const q = pts[i - 1], l = Math.hypot(p.x - q.x, p.z - q.z); if (l > 6) out.gaps++; const y0 = net.surface(q.x, q.z); if (y !== null && y0 !== null && Math.abs(y - y0) > 0.6 && !inDitch(p.x, p.z)) out.steps.push(`${k}#${i} ${(y - y0).toFixed(2)}`); }
    }
  }
  for (const b of P.blasts) {
    let near = Infinity; for (const pts of Object.values(P.routes)) for (const p of pts) near = Math.min(near, Math.hypot(p.x - b.x, p.z - b.z));
    for (const j of P.joins) for (const p of j.path) near = Math.min(near, Math.hypot(p.x - b.x, p.z - b.z) + 1);
    for (const pts of P.truckRuns.map((t) => t.path)) for (const p of pts) near = Math.min(near, Math.hypot(p.x - b.x, p.z - b.z));
    if (near < 7) out.blastsOnLane.push(`${b.road}@${b.s.toFixed(0)} ${near.toFixed(1)}m`);
    if (!cols.blocks(b.x, b.y + 0.5, b.z) && !cols.blocks(b.x, b.y + 0.5, b.z + 0.3)) out.blastsBare.push(`${b.road}@${b.s.toFixed(0)}`);
  }
  // the tunnel: nothing solid across the lanes (the paved width and a car's half-width more), lamps under the roof
  const t = P.tunnels[0], road = P.roads.tunnel;
  out.tunnelHits = [];
  for (let s = t.s0 - 2; s <= t.s1 + 2; s += 1) {
    const p = road.at(s);
    for (let o = -4.6; o <= 4.6; o += 0.4) for (const dy of [0.3, 1.2, 2.2]) if (cols.blocks(p.x + p.nx * o, p.h + dy, p.z + p.nz * o, window.__game.debug.game.car)) out.tunnelHits.push(`s${s.toFixed(0)} o${o.toFixed(1)}`);
    for (const o of [-2.5, 2.5]) { const q = { x: p.x + p.nx * o, y: p.h, z: p.z + p.nz * o }, x0 = q.x, z0 = q.z; if (cols.resolve(q, 0.92, p.h + 0.3, window.__game.debug.game.car) && Math.hypot(q.x - x0, q.z - z0) > 0.01) out.tunnelHits.push(`car s${s.toFixed(0)} o${o}`); }
  }
  out.lampsInside = t.lamps.every((l) => { const q = road.nearest(l.x, l.z); return q.d < t.halfWidth - 1 && q.s > t.s0 && q.s < t.s1 && l.y < q.h + t.height && l.y > q.h + 3; });
  // the ramps: pads that launch, with the slope of the ramp
  out.ramps = P.ramps.map((r) => { const road = P.roads[r.road], p = road.at(r.s + r.run / 2), pad = net.padAt(p.x + p.nx * r.lane, p.z + p.nz * r.lane); return !!pad && pad.launch === true && Math.abs(pad.slope - r.rise / r.run) < 1e-6; });
  // the routes: they share the start, part at the fork and meet again before the end
  const R = P.routes, last = (a) => a[a.length - 1], dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nearestOn = (pts, p) => { let best = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], vx = b.x - a.x, vz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / (vx * vx + vz * vz || 1))); best = Math.min(best, Math.hypot(a.x + vx * t - p.x, a.z + vz * t - p.z)); } return best; }; // distance to the route's line
  out.sameStart = dist(R.tunnel[0], R.main[0]) < 0.5 && dist(R.dirt[0], R.main[0]) < 0.5;
  out.sameEnd = dist(last(R.tunnel), last(R.main)) < 0.5 && dist(last(R.dirt), last(R.main)) < 0.5 && dist(last(R.main), P.end) < 3;
  out.apart = { tunnel: Math.max(...R.tunnel.map((p) => nearestOn(R.main, p))), dirt: Math.max(...R.dirt.map((p) => nearestOn(R.main, p))) };
  out.rejoin = ['tunnel', 'dirt'].map((k) => { const i = R[k].findIndex((p) => dist(p, P.rejoin) < 3); return i >= 0 && R[k].slice(i).every((p) => nearestOn(R.main, p) < 0.6); });
  out.routeAt = { fork: P.routeAt(P.fork.choices[1].at.x, P.fork.choices[1].at.z)?.route, dirt: P.routeAt(P.ditch.far.x, P.ditch.far.z)?.route, gallery: P.routeAt(t.mid.x, t.mid.z)?.route, start: P.routeAt(P.start.x, P.start.z)?.route };
  out.remaining = Math.round(P.remaining('main', P.start.x, P.start.z));
  return out;
});
check('nothing in the Iron Base (x 1060..1180, z -340..-240)', ground.inBase === 0, `${ground.inBase} road samples`);
check('clear of the iron road\'s branch end (1112, -214)', ground.nearBranch === 0);
check('the long east stretch keeps within z -460..-360 (the hills rise north of it)', ground.offHills === 0, `${ground.offHills}`);
check('route points are close together', ground.gaps === 0, `${ground.gaps} gaps`);
check('every route point is on a road surface', ground.offSurface.length === 0, ground.offSurface.slice(0, 4).join(' '));
check('no steps along a route (but the ditch)', ground.steps.length === 0, ground.steps.slice(0, 4).join(' '));
check('blast spots stand off the lanes (routes, side roads, the lorry\'s lane)', ground.blastsOnLane.length === 0, ground.blastsOnLane.slice(0, 3).join(' '));
check('every blast spot has something there', ground.blastsBare.length === 0, ground.blastsBare.join(' '));
check('the gallery: nothing solid in its lanes', ground.tunnelHits.length === 0, ground.tunnelHits.slice(0, 4).join(' '));
check('the gallery\'s lamps are inside, under the roof', ground.lampsInside);
check('every ramp is pads that launch, with its slope', ground.ramps.length >= 3 && ground.ramps.every(Boolean), JSON.stringify(ground.ramps));
check('the three routes start together', ground.sameStart);
check('the three routes end together at the port', ground.sameEnd);
check('the tunnel and dirt routes really leave the highway', ground.apart.tunnel > 15 && ground.apart.dirt > 30, `${ground.apart.tunnel.toFixed(0)} m, ${ground.apart.dirt.toFixed(0)} m`);
check('the tunnel and dirt routes rejoin the highway before the end', ground.rejoin.every(Boolean), JSON.stringify(ground.rejoin));
check('routeAt names the way', ground.routeAt.fork === 'tunnel' && ground.routeAt.dirt === 'dirt' && ground.routeAt.gallery === 'tunnel' && ground.routeAt.start === 'common', JSON.stringify(ground.routeAt));
check('remaining() from the start is about the highway\'s length', ground.remaining > 900 && ground.remaining < 1100, `${ground.remaining} m`);

// ---------- driving: the Renault, the game's own physics, stepped by hand along a list of points ----------
const drive = (pts, cruise, { maxT = 200, until = null } = {}) => G(({ pts, cruise, maxT, until }) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, car = g.car;
  g.hold = true;
  window.__game.drivePath([['points', pts]], cruise); const ap = g.autopilot; g.autopilot = null;
  const a = pts[0], b = pts[1];
  car.repair(); car.place(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z)); car.launches = 0; car.impacts = 0;
  const stop = until ? new Function('car', 'P', `return (${until});`) : null, P = W.places.deathRoad;
  let off = 0, t = 0, maxAir = 0, sunk = 0; const offAt = [];
  for (const dt = 1 / 30; !ap.done && t < maxT; t += dt) {
    car.update(dt, ap.drive(car));
    const y = W.net.surface(car.pos.x, car.pos.z);
    if (y === null) { off++; if (offAt.length < 3) offAt.push(`${car.pos.x.toFixed(0)},${car.pos.z.toFixed(0)}`); }
    const gr = car.groundUnder(); maxAir = Math.max(maxAir, car.pos.y - gr); if (car.pos.y < gr - 0.3) sunk++;
    if (stop && stop(car, P)) break;
  }
  const end = pts[pts.length - 1];
  return { t: +t.toFixed(1), done: ap.done, endD: +Math.hypot(car.pos.x - end.x, car.pos.z - end.z).toFixed(1), off, offAt, sunk, impacts: car.impacts, launches: car.launches || 0, maxAir: +maxAir.toFixed(2), x: car.pos.x, z: car.pos.z, health: Math.round(car.health) };
}, { pts, cruise, maxT, until });
const P = (expr) => G((e) => new Function('P', `return (${e});`)(window.__game.debug.world.places.deathRoad), expr);

for (const k of ['main', 'tunnel', 'dirt']) {
  const r = await drive(await P(`P.routes.${k}`), 16);
  check(`drive the ${k} route end to end`, r.done && r.endD < 4, `${r.t} s, ${r.endD} m from the end`);
  check(`  ${k}: on the road surface all the way`, r.off === 0 && r.sunk === 0, r.offAt.join(' '));
  check(`  ${k}: hits nothing`, r.impacts === 0 && r.health > 90, `${r.impacts} impacts, health ${r.health}`);
  if (k === 'dirt') check('  dirt: the ramp throws the car over the ditch', r.launches > 0 && r.maxAir > 1.5, `${r.launches} launches, ${r.maxAir} m up`);
  else check(`  ${k}: no ramp in its lane`, r.launches === 0);
}
for (const [i, road] of (await P('P.ramps.map((r) => r.road)')).entries()) {
  const r = await drive(await P(`P.ramps[${i}].path`), 20);
  check(`ramp ${i + 1} (${road}): the car takes off (car.launches grows) and lands clean`, r.launches > 0 && r.maxAir > 0.5 && r.impacts === 0 && r.done, `${r.launches} launches, ${r.maxAir} m up, ${r.impacts} impacts`);
}
{ // too slow for the jump: the car ends up in the ditch, against the far wall, and does not get across
  const r = await drive(await P('P.ramps.find((r) => r.road === "dirt").path'), 6, { maxT: 40 });
  const s = await G(({ x, z }) => { const P = window.__game.debug.world.places.deathRoad; return P.roads.dirt.nearest(x, z).s - P.ditch.s; }, r);
  check('the ditch is a real gap: a slow car does not get across', !r.done && s < 2, `${s.toFixed(1)} m past the ditch's middle`);
}
{ // the closure shuts the highway, and opens it again
  await G(() => window.__game.debug.world.places.deathRoad.closure.close());
  const pts = await P('P.pathFrom("main", P.closure.before.x, P.closure.before.z).slice(0, 40)');
  const r = await drive(pts, 14, { maxT: 30 });
  const past = await G(({ x, z }) => { const P = window.__game.debug.world.places.deathRoad; return P.roads.main.nearest(x, z).s - P.closure.s; }, r);
  check('closed, the highway is shut', !r.done && past < 0, `${past.toFixed(1)} m past it`);
  await G(() => window.__game.debug.world.places.deathRoad.closure.open());
  const r2 = await drive(pts, 14, { maxT: 30 });
  check('open again, the highway is clear', r2.done && r2.impacts === 0, `${r2.impacts} impacts`);
}
for (const [i, name] of (await P('P.joins.map((j) => j.name)')).entries()) {
  const at = await P(`(() => { const j = P.joins[${i}]; return Math.hypot(j.path[0].x - j.x, j.path[0].z - j.z); })()`);
  const r = await drive(await P(`P.joins[${i}].path`), 12, { maxT: 120 });
  check(`a rival from ${name} gets onto the road from where it waits`, at < 0.5 && r.done && r.impacts === 0 && r.off === 0, `${r.impacts} impacts, ${r.off} off`);
}
for (const [i] of (await P('P.truckRuns.map(() => 0)')).entries()) {
  const r = await drive(await P(`P.truckRuns[${i}].path`), 14);
  check(`the head-on lorry's lane ${i + 1} is clear`, r.done && r.impacts === 0 && r.off === 0, `${r.impacts} impacts`);
  const free = await drive(await P(`P.routes.main.filter((p, k, a) => { const q = P.truckRuns[${i}]; const m = P.roads.main.nearest(p.x, p.z).s; return m > q.s1 && m < q.s0; }).map((p) => { const q = P.roads.main.nearest(p.x, p.z), at = P.roads.main.at(q.s); return { x: at.x + at.nx * P.truckRuns[${i}].dodge, z: at.z + at.nz * P.truckRuns[${i}].dodge }; })`), 14);
  check(`  and the other lane is free to dodge into`, free.done && free.impacts === 0 && free.off === 0, `${free.impacts} impacts`);
}

// ---------- screenshots: the fork, the gallery, a jump ----------
await G(() => { const e = document.getElementById('startScreen'); if (e) e.style.display = 'none'; });
const settle = async () => { const t0 = await G(() => window.__game.state.time); await page.waitForFunction((t0) => window.__game.state.time > t0 + 0.4, t0, { timeout: 90000 }).catch(() => {}); await page.waitForTimeout(800); };
const view = async (name, from, look, night = 0) => {
  await G(({ from, look, night }) => { const g = window.__game.debug.game; g.hold = false; g.daylight?.set(night, 0); window.__game.teleport(look.x, look.z); g.follow.shot(from, look, 9999); }, { from, look, night });
  await settle(); await settle();
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const calls = await G(() => window.__game.state.drawCalls);
  console.log(`      shot ${name}.png (${calls} draw calls)`);
  return calls;
};
const f = await P('P.fork');
const forkCalls = await view('deathroad-fork', { x: f.x - 70, y: f.y + 30, z: f.z + 8 }, { x: f.x + 40, y: f.y, z: f.z - 4 });
const tv = await P('(() => { const r = P.roads.tunnel, t = P.tunnels[0], p = r.at(t.s0 + 30), q = r.at(t.s0 + 70); return { a: { x: p.x + p.nx * 1.5, y: p.h + 2.6, z: p.z + p.nz * 1.5 }, b: { x: q.x, y: q.h + 1.5, z: q.z } }; })()');
const tunnelCalls = await view('deathroad-tunnel', tv.a, tv.b, 1);
const rv = await P('(() => { const d = P.ditch, r = P.roads.dirt, p = r.at(d.s - 4), q = r.at(d.s + 2); return { a: { x: p.x + p.nx * 22, y: p.h + 5, z: p.z + p.nz * 22 }, b: { x: q.x, y: q.h - 1, z: q.z } }; })()');
await view('deathroad-ditch', rv.a, rv.b);
const air = await G(() => { // the Renault over the ditch: drive up the ramp, stop the clock in the air, draw that frame
  const g = window.__game.debug.game, W = window.__game.debug.world, P = W.places.deathRoad, car = g.car, d = P.ditch;
  const pts = P.ramps.find((r) => r.road === 'dirt').path;
  window.__game.drivePath([['points', pts]], 17); const ap = g.autopilot; g.autopilot = null; g.hold = true;
  car.repair(); car.place(pts[0].x, pts[0].z, Math.atan2(pts[1].x - pts[0].x, pts[1].z - pts[0].z)); car.launches = 0;
  for (let t = 0; t < 30; t += 1 / 30) { car.update(1 / 30, ap.drive(car)); if (P.roads.dirt.nearest(car.pos.x, car.pos.z).s > d.s - 1) break; }
  const { renderer, scene, camera } = window.__game.debug; renderer.render(scene, camera);
  return { up: car.pos.y - car.groundUnder(), launches: car.launches };
});
await page.screenshot({ path: path.join(SHOTS, 'deathroad-jump.png') });
check('screenshot of the car in the air over the ditch', air.up > 1 && air.launches > 0, `${air.up.toFixed(1)} m over the floor`);
check('draw calls stay phone-friendly at the fork and in the gallery', forkCalls < 400 && tunnelCalls < 400, `${forkCalls}, ${tunnelCalls}`);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
