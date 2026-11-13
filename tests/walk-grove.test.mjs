// Walkability of the olive grove (chapter ten, places.grove). In the ordinary world: from the parking lot, on
// foot, is the whole park reachable (the lot, the sign and the boulder, the path to its end at the gate, the
// lawn, the goal, the playground and its four pieces, every bench, the shed, the far lawn), and is no free
// spot of the park cut off (nothing traps a player)? With the parallel universe on (grove.dimension(true)):
// the landing spots are on the ground and clear of the trees; with the seals shut each symbol is reached only
// after the seals before it open; with all open the broken path's start is reached; the broken path's data
// is consistent (every gap between consecutive stones at most 3 m or crossed by a leap, heights agree, the
// ledge is the 1.6 m step, fields/switches/safe points stand on stones, minY under every stone, the rhythm of
// the platforms can be walked); from the path's end the Keeper's clearing, its anchors and spots, the crystal
// and the energy point are reached, the last along a clear run-up; dimension(false) hides the layer and gives
// the whole path back. A flood fill over a half-metre grid with the player's own collision test and the ground
// at his own height, as in tests/walk-safehouse.test.mjs. Also reports triangles and draw calls with the
// camera in the grove. Usage: node tests/walk-grove.test.mjs [distDir]
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
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

// the fill (walk3 of tests/walk.test.mjs). c: { area, setup, teardown (code run with P = places, W = world,
// g = game, Q = places.grove), from (expr), to: [[name, expr, near?]], trap?: rect } — a target counts when a
// reached cell within `near` cells of it (default 1) is at its height. With `trap`: the free cells inside that
// rect (at the height of the highest ground there) that the fill did not reach are counted (pockets)
const walk = (c) => page.evaluate((c) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = W.places, Q = P.grove, cols = W.cols, R = 0.35, S = 0.5;
  const run = (code) => code && new Function('P', 'W', 'g', 'Q', code)(P, W, g, Q);
  run(c.setup);
  const E = (expr) => new Function('P', 'Q', `return (${expr});`)(P, Q);
  const a = c.area, x0 = a.x0, z0 = a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
  const pos = { x: 0, y: 0, z: 0 }, free = new Map();
  const isFree = (i, j, y) => { const k = (i * nz + j) * 64 + Math.max(0, Math.min(63, Math.round((y + 80) / 2))); if (free.has(k)) return free.get(k); const x = x0 + i * S, z = z0 + j * S; pos.x = x; pos.y = y; pos.z = z; const hit = (cols.resolve(pos, R, y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02) || cols.blocks(x, y + 0.5, z, g.car); free.set(k, !hit); return !hit; }; // (blocks: the very centre of a post or a trunk, where a push has no direction)
  const from = E(c.from), seen = new Map(), q = [];
  const keyOf = (i, j, y) => (i * nz + j) * 48 + Math.max(0, Math.min(47, Math.round((y + 60) / 1.25)));
  const push = (i, j, y) => { const k = keyOf(i, j, y); if (seen.has(k)) return; seen.set(k, y); q.push([i, j, y]); };
  { const i = Math.round((from.x - x0) / S), j = Math.round((from.z - z0) / S), y = W.groundHeight(x0 + i * S, z0 + j * S, from.y ?? null); push(i, j, y); }
  while (q.length) {
    const [i, j, y] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue;
      const y2 = W.groundHeight(x0 + a2 * S, z0 + b2 * S, y);
      if (Math.abs(y2 - y) > 0.9) continue;
      if (!isFree(a2, b2, y2)) continue;
      push(a2, b2, y2);
    }
  }
  const out = {};
  for (const [name, expr, near = 1] of c.to) {
    const p = E(expr), i0 = Math.round((p.x - x0) / S), j0 = Math.round((p.z - z0) / S), yy = p.y ?? W.groundHeight(p.x, p.z);
    let ok = false;
    for (let di = -near; di <= near && !ok; di++) for (let dj = -near; dj <= near && !ok; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; for (const dy of [-1.25, 0, 1.25]) { const k = keyOf(i, j, yy + dy); if (seen.has(k) && Math.abs(seen.get(k) - yy) < 1.0) { ok = true; break; } } }
    out[name] = ok ? 'ok' : 'unreachable';
  }
  let pockets = null;
  if (c.trap) { // free cells nobody can walk to
    pockets = { n: 0, at: [] };
    const t = c.trap;
    for (let i = Math.ceil((t.x0 - x0) / S); i <= Math.floor((t.x1 - x0) / S); i++) for (let j = Math.ceil((t.z0 - z0) / S); j <= Math.floor((t.z1 - z0) / S); j++) {
      const y = W.groundHeight(x0 + i * S, z0 + j * S);
      if (!isFree(i, j, y)) continue;
      let hit = false; for (const dy of [-1.25, 0, 1.25]) { const k = keyOf(i, j, y + dy); if (seen.has(k) && Math.abs(seen.get(k) - y) < 1.0) { hit = true; break; } }
      if (!hit) { pockets.n++; if (pockets.at.length < 12) pockets.at.push(`(${(x0 + i * S - Q.x).toFixed(1)}, ${(z0 + j * S - Q.z).toFixed(1)})`); }
    }
  }
  run(c.teardown);
  return { out, cells: seen.size, pockets };
}, c);
const run = async (title, c, expectShut = []) => {
  const r = await walk(c);
  for (const [name] of c.to) { const want = expectShut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
  return r;
};

const AREA = await G(() => { const b = window.__game.debug.world.places.grove.box; return { x0: b.x0 - 6, z0: b.z0 - 6, x1: b.x1 + 6, z1: b.z1 + 6 }; });
const info = await G(() => { const Q = window.__game.debug.world.places.grove; return { benches: Q.benches.length, path: Q.path.length, trees: Q.trees.length, spots: Q.arena.spots.length, runUp: Q.runUp.length, x: Q.x, z: Q.z, y: Q.y }; });
check('the grove is there, with about forty old olives', info.trees >= 38 && info.trees <= 50, `${info.trees} trees`);

// ---------- the ordinary world: the whole park from the lot ----------
const Qs = 'Q';
const park = [
  ['the lot', `${Qs}.lot.centre`], ['the lot entrance', `${Qs}.lot.entrance`], ['the roundabout island', `${Qs}.lot.island`, 3], ...[0, 1, 2].map((k) => [`parking spot ${k}`, `${Qs}.lot.park[${k}]`]),
  ['the sign', `${Qs}.sign`, 2], ['the boulder', `${Qs}.boulder`, 5], ['the start of the path', `${Qs}.pathStart`],
  ...[...Array(info.path).keys()].map((k) => [`the path, point ${k}`, `${Qs}.path[${k}]`]), ['the end of the path', `${Qs}.pathEnd`], ['the gate in the fence', `${Qs}.gate`],
  ['the lawn', `${Qs}.lawn`], ['in front of the goal', `${Qs}.goal.front`], ['the playground', `${Qs}.playground.centre`], ['the swings', `${Qs}.playground.swings`], ['the spinner', `${Qs}.playground.spinner`],
  ['the fish seesaw', `${Qs}.playground.seesaw`], ['the rocket slide', `${Qs}.playground.slide`], ...[...Array(info.benches).keys()].map((k) => [`in front of bench ${k}`, `${Qs}.benches[${k}].front`]),
  ['the shed', `${Qs}.shed`], ['by the white building', `${Qs}.hall`], ['the far lawn (the clearing)', `${Qs}.arena.centre`], ['between the great olives', `${Qs}.portalAt`],
  ['the landing spot (Nehorai)', `${Qs}.landing.nehorai`], ['the landing spot (Erez)', `${Qs}.landing.erez`], ...[0, 1, 2].map((k) => [`by the stone of symbol ${k}`, `${Qs}.symbols[${k}].at`]),
];
const TRAP = { x0: info.x - 45.4, x1: info.x + 55.4, z0: info.z - 47.2, z1: info.z + 47.2 };
const r1 = await run('the park (ordinary world), from the lot', { area: AREA, setup: 'Q.dimension(false);', from: `${Qs}.lot.centre`, to: park, trap: TRAP });
check('the fill covered the park', r1.cells > 25000, `${r1.cells} cells`);
check('nothing traps: no free spot of the park is cut off from the lot', r1.pockets.n === 0, r1.pockets.n ? `${r1.pockets.n} cells, e.g. ${r1.pockets.at.join(' ')}` : '');
// the trees, benches, playground pieces and the boulder collide; a person put on a spot is not pushed
const solid = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Q = W.places.grove, y = Q.y, B = (x, h, z) => W.cols.blocks(x, y + h, z, g.car), out = {};
  out['every olive trunk'] = Q.trees.every((t) => B(t.x, 0.8, t.z));
  out['every bench'] = Q.benches.every((b) => B(b.x, 0.4, b.z));
  out['the boulder'] = B(Q.boulder.x, 0.5, Q.boulder.z);
  const pg = Q.playground; // (each piece stands behind the spot in front of it)
  out['the swing frame'] = B(pg.swings.x, 1, pg.swings.z - 2); out['the spinner'] = B(pg.spinner.x, 0.5, pg.spinner.z - 1.8);
  out['the fish seesaw'] = B(pg.seesaw.x, 0.5, pg.seesaw.z - 1.6); out['the rocket and its chute'] = B(pg.slide.x - 4, 0.5, pg.slide.z) && B(pg.slide.x - 2.25, 0.5, pg.slide.z);
  out['the path is open (no collider on it)'] = Q.path.every((p) => !B(p.x, 0.5, p.z));
  return out;
});
for (const [name, ok] of Object.entries(solid)) check(`collides: ${name}`, ok);
const stand = await G((names) => {
  const W = window.__game.debug.world, g = window.__game.debug.game, P = W.places, Q = P.grove, out = {};
  for (const [name, expr] of names) { const p = new Function('P', 'Q', `return (${expr});`)(P, Q), q = { x: p.x, y: p.y ?? W.groundHeight(p.x, p.z), z: p.z }; W.cols.resolve(q, 0.35, q.y, g.car); out[name] = Math.hypot(q.x - p.x, q.z - p.z); }
  return out;
}, park.filter(([n]) => !/boulder|island|sign/.test(n)));
const pushed = Object.entries(stand).filter(([, d]) => d >= 0.02);
check('every spot of the park stands free (nobody is pushed off it)', pushed.length === 0, pushed.map(([n, d]) => `${n} ${d.toFixed(2)} m`).join(', '));

// ---------- the parallel universe: the landing ----------
const landing = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Q = W.places.grove; Q.dimension(true); Q.reset();
  const out = {};
  for (const k of ['nehorai', 'erez']) {
    const p = Q.landing[k], gy = W.groundHeight(p.x, p.z), q = { x: p.x, y: p.y, z: p.z }; W.cols.resolve(q, 0.35, p.y, g.car);
    const tree = Math.min(...Q.trees.map((t) => Math.hypot(t.x - p.x, t.z - p.z) - t.r));
    out[k] = { ground: Math.abs(gy - Q.y) < 0.2 && Math.abs(p.y - gy) < 0.2, free: Math.hypot(q.x - p.x, q.z - p.z) < 0.02, tree };
  }
  out.apart = Math.hypot(Q.landing.nehorai.x - Q.landing.erez.x, Q.landing.nehorai.z - Q.landing.erez.z);
  out.layer = Q.layer.visible && Q.isDimension();
  return out;
});
check('dimension(true): the layer shows', landing.layer);
for (const k of ['nehorai', 'erez']) {
  check(`landing.${k} is on the ground of the lawn`, landing[k].ground);
  check(`landing.${k} is clear of the trees (at least 2 m from a trunk)`, landing[k].free && landing[k].tree >= 2, `${landing[k].tree.toFixed(1)} m`);
}
check('the two landing spots are apart', landing.apart >= 1.2 && landing.apart <= 5, `${landing.apart.toFixed(1)} m`);

// ---------- the seals: each symbol only after the seals before it ----------
const SYM = [0, 1, 2].map((k) => [`symbol ${k}`, `Q.symbols[${k}].at`]);
const START = ['the broken path\'s start', 'Q.brokenPath.start'], ARENA = ['the clearing', 'Q.arena.centre'], PORTAL = ['the energy point', 'Q.portalAt'];
await run('dimension, every seal shut, from the landing', { area: AREA, setup: 'Q.reset();', from: 'Q.landing.nehorai', to: [...SYM, START, ARENA, PORTAL, ['the landing of Erez', 'Q.landing.erez'], ['the boulder', 'Q.boulder', 5]] },
  ['symbol 1', 'symbol 2', START[0], ARENA[0], PORTAL[0]]);
await run('dimension, seal 0 open, from the landing', { area: AREA, setup: 'Q.reset(); Q.seals[0].open(true);', from: 'Q.landing.nehorai', to: [...SYM, START, ['the swings', 'Q.playground.swings'], ['the rocket slide', 'Q.playground.slide']] }, ['symbol 2', START[0]]);
await run('dimension, seals 0 and 1 open, from the landing', { area: AREA, setup: 'Q.reset(); Q.seals[0].open(true); Q.seals[1].open(true);', from: 'Q.landing.nehorai', to: [...SYM, START, ['in front of the goal', 'Q.goal.front'], ARENA, PORTAL] }, [ARENA[0], PORTAL[0]]);
const seal2 = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Q = W.places.grove; Q.reset(); for (const s of Q.seals) s.open(true); Q.seals[2].shut();
  const mid = (pn) => ({ x: (pn.a.x + pn.b.x) / 2, z: (pn.a.z + pn.b.z) / 2 });
  const shut = Q.seals[2].panels.every((pn) => { const m = mid(pn); return W.cols.blocks(m.x, Q.y + 1, m.z, g.car); });
  Q.seals[2].open(true);
  const open = Q.seals[2].panels.every((pn) => { const m = mid(pn); return !W.cols.blocks(m.x, Q.y + 1, m.z, g.car); });
  const all = Q.seals.every((s) => s.panels.every((pn) => !W.cols.blocks(mid(pn).x, Q.y + 1, mid(pn).z, g.car)));
  Q.seals[0].shut(); const back = Q.seals[0].panels.every((pn) => W.cols.blocks(mid(pn).x, Q.y + 1, mid(pn).z, g.car)); Q.seals[0].open(true);
  return { shut, open, all, back, panels: Q.seals.map((s) => s.panels.length) };
});
check('seal 2 shut: its walls stand across the broken path', seal2.shut, `panels ${seal2.panels.join('/')}`);
check('seals open: no wall left anywhere', seal2.open && seal2.all);
check('shut() puts a wall back', seal2.back);
await run('dimension, every seal open, from the landing', { area: AREA, setup: 'Q.reset(); for (const s of Q.seals) s.open(true);', from: 'Q.landing.nehorai', to: [...SYM, START] });

// ---------- the broken path's data ----------
const data = await G(() => {
  const W = window.__game.debug.world, Q = W.places.grove, bp = Q.brokenPath, out = { notes: [] }, y = Q.y;
  const stones = bp.stones, on = (p, s, m = 0.05) => { const dx = Math.abs(p.x - s.x), dz = Math.abs(p.z - s.z); return dx <= s.hx + m && dz <= s.hz + m; };
  const stoneUnder = (p) => stones.filter((s) => on(p, s)).sort((a, b) => Math.abs((p.y ?? y) - a.y) - Math.abs((p.y ?? y) - b.y))[0];
  // gaps and heights along the chain
  out.order = stones.every((s, i) => !i || s.u0 >= stones[i - 1].u0);
  out.gaps = []; out.steps = [];
  for (let i = 1; i < stones.length; i++) {
    const a = stones[i - 1], b = stones[i], gap = b.u0 - a.u1, dy = b.y - a.y;
    if (gap > 0.05) out.gaps.push({ between: `${a.name} → ${b.name}`, gap: +gap.toFixed(2), leap: bp.leaps.some((l) => on(l.from, a, 0.3) && on(l.to, b, 0.3)) });
    if (Math.abs(dy) > 0.45) out.steps.push({ between: `${a.name} → ${b.name}`, dy: +dy.toFixed(2) });
  }
  out.maxGap = Math.max(0, ...out.gaps.map((g) => g.gap));
  out.gapsLeapt = out.gaps.every((g) => g.leap);
  const L = bp.ledge, lb = stoneUnder(L.bottom), lt = stoneUnder(L.top);
  out.ledge = { height: +(L.top.y - L.bottom.y).toFixed(2), bottomOn: !!lb && Math.abs(lb.y - L.bottom.y) < 0.05, topOn: !!lt && Math.abs(lt.y - L.top.y) < 0.05, hand: !!(L.from && L.to) };
  out.stepsAreLedge = out.steps.every((s) => Math.abs(Math.abs(s.dy) - 1.6) < 0.05 ? s.dy > 0 && s.between === `${lb?.name} → ${lt?.name}` : Math.abs(s.dy) <= 0.45);
  // platforms: at path level, sized, a sound rhythm; the first and the last never go
  const P = bp.platforms;
  out.platforms = P.length;
  out.platformsOk = P.every((p) => Math.abs(p.y - y) < 0.05 && p.hx >= 0.6 && p.hz >= 0.6 && p.period > 0 && p.on > 0 && p.on <= p.period);
  out.firstLastFixed = P[0].on >= P[0].period && P[P.length - 1].on >= P[P.length - 1].period;
  const solidAt = (p, t) => p.on >= p.period || ((t + p.offset) % p.period + p.period) % p.period < p.on;
  const steadied = (i) => bp.switches.some((s) => (s.steadies || []).includes(i));
  out.rhythm = [];
  for (let i = 1; i < stones.length; i++) {
    const a = stones[i - 1], b = stones[i]; if (a.platform == null && b.platform == null) continue;
    const pa = a.platform != null ? P[a.platform] : { on: 1, period: 1, offset: 0 }, pb = b.platform != null ? P[b.platform] : { on: 1, period: 1, offset: 0 };
    let best = 0, run = 0; for (let t = 0; t < 48; t += 0.05) { if (solidAt(pa, t) && solidAt(pb, t)) { run += 0.05; best = Math.max(best, run); } else run = 0; }
    const st = (a.platform == null || steadied(a.platform)) && (b.platform == null || steadied(b.platform));
    out.rhythm.push({ between: `${a.name} → ${b.name}`, both: +best.toFixed(2), steadied: st });
  }
  out.rhythmOk = out.rhythm.every((r) => r.both >= 1.0 || r.steadied);
  // a switch that steadies stones stands before them on the way
  out.switchesBefore = bp.switches.every((s) => { const st = stoneUnder(s); return st && (s.steadies || []).every((k) => stones.find((q) => q.platform === k).u0 > st.u0); });
  out.switchesOn = bp.switches.map((s) => { const st = stoneUnder(s); return st ? `${s.label}: ${st.name}` : `${s.label}: nowhere`; });
  out.switchesOk = bp.switches.every((s) => { const st = stoneUnder(s); return st && st.kind !== 'platform' && Math.abs(st.y - s.y) < 0.05 && s.label && s.opens.every((o) => o === 'bridge' || (Number.isInteger(o) && o >= 0 && o < P.length)); });
  out.fieldsOk = bp.fields.every((f) => { const st = stoneUnder(f); return st && Math.abs(st.y - f.y) < 0.05 && f.r > 0.5 && f.period > f.hold && f.hold > 0; });
  out.disturbancesOk = bp.disturbances.every((d) => d.speed > 0 && d.r > 0 && d.path.length >= 2 && d.path.every((p) => p.x >= bp.rect.x0 - 1 && p.x <= bp.rect.x1 + 1 && p.z >= bp.rect.z0 && p.z <= bp.rect.z1));
  out.safeOk = bp.safe.every((p) => { const st = stoneUnder(p); return st && Math.abs(st.y - p.y) < 0.05; });
  out.safe = bp.safe.length;
  out.minY = { minY: bp.minY, lowest: Math.min(...stones.map((s) => s.y)), floor: bp.floorY };
  out.minYOk = bp.minY < out.minY.lowest - 0.5 && bp.minY > bp.floorY;
  out.startEnd = !!stoneUnder(bp.start) && stoneUnder(bp.start).kind === 'bank' && !!stoneUnder(bp.end) && stoneUnder(bp.end).kind === 'bank';
  out.length = +(stones[stones.length - 1].u0 - stones[0].u1).toFixed(1);
  // the rift is really dug in the dimension
  const mid = stones.find((s) => s.kind === 'platform' && s.platform === 1);
  out.riftDepth = +(y - W.groundHeight(mid.x, mid.z)).toFixed(2);
  return out;
});
check('the stones are in order along the path', data.order);
check('the broken stretch is about 45 m long', data.length >= 40 && data.length <= 50, `${data.length} m`);
check('every gap between consecutive stones is at most 3 m', data.maxGap <= 3, JSON.stringify(data.gaps));
check('every gap is crossed by a leap', data.gapsLeapt);
check('the heights agree: steps of at most 0.45 m, and the one 1.6 m step is the ledge', data.stepsAreLedge, JSON.stringify(data.steps));
check('the ledge: a 1.6 m step, its foot and top on stones, a hand for Erez', Math.abs(data.ledge.height - 1.6) < 0.05 && data.ledge.bottomOn && data.ledge.topOn && data.ledge.hand, JSON.stringify(data.ledge));
check('the platforms are at the path\'s height, sized, with a rhythm', data.platformsOk, `${data.platforms} platforms`);
check('the first and the last platform never go', data.firstLastFixed);
check('the rhythm can be walked: each step onto or off a moving stone has at least 1 s with both there, or a switch holds them', data.rhythmOk, data.rhythm.map((r) => `${r.between} ${r.both}s${r.steadied ? ' (switch)' : ''}`).join('; '));
check('the switches stand on stones before the stones they hold, and open what exists', data.switchesOk && data.switchesBefore, data.switchesOn.join('; '));
check('the stasis fields stand on stones and fire between holds', data.fieldsOk);
check('the disturbances drift over the rift', data.disturbancesOk);
check('the marked safe line runs over stones', data.safeOk, `${data.safe} points`);
check('minY is under every stone and above the rift floor', data.minYOk, JSON.stringify(data.minY));
check('start and end are on the banks', data.startEnd);
check('the rift is dug about 9 m deep under the path', data.riftDepth > 8 && data.riftDepth < 10, `${data.riftDepth} m`);

// ---------- the engine's path kit, built from the grove's data (game.moves.pathKit): every platform held
// there and the bridge up, the way is walkable stone to stone: start → the leap, past the leap → the ledge's
// foot, the ledge's top → the end (the leap and the climb are the kit's own moves) ----------
const kit = await G(() => {
  const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove; Q.reset(); for (const s of Q.seals) s.open(true);
  const k = window.__gk = g.moves.pathKit(g, Q.brokenPath.kit, { friends: [], onSwitch: (i, on) => Q.brokenPath.thrown(i, on) });
  const parts = [k.platforms.length, k.fields.length, k.disturbances.length, k.switches.length, k.leaps.length, !!k.climb, !!k.guard].join(',');
  for (const p of k.platforms) p.lock(true);
  Q.brokenPath.bridge.set(true, true);
  return { parts };
});
check('pathKit takes brokenPath.kit as it is', kit.parts === '7,2,2,2,1,true,true', kit.parts);
await run('the broken path, platforms held and the bridge up: from the start', { area: AREA, from: 'Q.brokenPath.start', to: [['the leap', 'Q.brokenPath.leaps[0].from'], ['the first stasis field', 'Q.brokenPath.fields[0]'], ['past the leap (only by leaping)', 'Q.brokenPath.leaps[0].to']] }, ['past the leap (only by leaping)']);
await run('the broken path: from past the leap', { area: AREA, from: 'Q.brokenPath.leaps[0].to', to: [['the switch that steadies the stones', 'Q.brokenPath.switches[0]'], ['the ledge\'s foot', 'Q.brokenPath.ledge.bottom'], ['the ledge\'s top (only by climbing)', 'Q.brokenPath.ledge.top']] }, ['the ledge\'s top (only by climbing)']);
await run('the broken path: from the ledge\'s top', { area: AREA, from: 'Q.brokenPath.ledge.top', to: [['the switch that raises the bridge', 'Q.brokenPath.switches[1]'], ['the bridge', 'Q.brokenPath.bridge'], ['the end', 'Q.brokenPath.end'], ['the clearing', 'Q.arena.centre']] });
await G(() => { const Q = window.__game.debug.world.places.grove; window.__gk.dispose(); window.__gk = null; Q.reset(); });

// ---------- from the path's end: the clearing, its anchors and spots, the crystal, the energy point ----------
const far = [ARENA, PORTAL, ...[0, 1, 2, 3].map((k) => [`by anchor ${k}`, `Q.arena.anchors[${k}].at`]), ...[...Array(info.spots).keys()].map((k) => [`the Keeper's spot ${k}`, `Q.arena.spots[${k}]`]),
  ['the crystal', '({ x: Q.crystalAt.x, z: Q.crystalAt.z })'], ['the way into the clearing', 'Q.arena.entry'], ...[...Array(info.runUp).keys()].map((k) => [`the run-up, point ${k}`, `Q.runUp[${k}]`])];
await run('dimension, all open, from the broken path\'s end', { area: AREA, setup: 'Q.reset(); for (const s of Q.seals) s.open(true);', from: 'Q.brokenPath.end', to: [...far, ['the landing', 'Q.landing.nehorai']] }, ['the landing']);
const runUp = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Q = W.places.grove, pts = Q.runUp; let worst = 0, dy = 0, len = 0;
  const near = Math.hypot(pts[0].x - Q.arena.x, pts[0].z - Q.arena.z), endAt = Math.hypot(pts[pts.length - 1].x - Q.portalAt.x, pts[pts.length - 1].z - Q.portalAt.z);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25); len += Math.hypot(b.x - a.x, b.z - a.z);
    for (let k = 0; k <= n; k++) { const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n, q = { x, y: Q.y, z }; W.cols.resolve(q, 0.4, Q.y, g.car); worst = Math.max(worst, Math.hypot(q.x - x, q.z - z)); dy = Math.max(dy, Math.abs(W.groundHeight(x, z) - Q.y)); }
  }
  const spots = Q.arena.spots.every((s) => Math.hypot(s.x - Q.arena.x, s.z - Q.arena.z) <= Q.arena.radius + 0.01);
  const anchors = Q.arena.anchors.every((s) => Math.hypot(s.x - Q.arena.x, s.z - Q.arena.z) <= Q.arena.radius);
  return { worst, dy, len, near, endAt, spots, anchors, cover: Q.arena.cover.length };
});
check('the run-up from the clearing to the energy point is clear and level', runUp.worst < 0.02 && runUp.dy < 0.3, `blocked ${runUp.worst.toFixed(2)} m, height ${runUp.dy.toFixed(2)} m, ${runUp.len.toFixed(0)} m long`);
check('the run-up starts in the clearing and ends at the energy point', runUp.near <= 1 && runUp.endAt < 0.5);
check('the clearing: spots and anchors inside its radius, trunks for cover', runUp.spots && runUp.anchors && runUp.cover >= 3, `${runUp.cover} trunks`);

// ---------- the symbols, anchors and energy point light; reset puts all back ----------
const lights = await G(() => {
  const D = window.__game.debug, Q = D.world.places.grove, out = {};
  Q.symbols.forEach((s) => s.light(true)); Q.arena.anchors.forEach((a) => a.light(true)); Q.portalAt.mark(true); Q.brokenPath.bridge.set(true, true); Q.brokenPath.thrown(1, true);
  for (let i = 0; i < 40; i++) Q.tick(D.camera, 1 / 30);
  out.lit = Q.symbols.every((s) => s.lit) && Q.arena.anchors.every((a) => a.lit) && Q.portalAt.lit;
  const b = Q.brokenPath.bridge; out.bridge = b.on && b.k === 1 && D.world.groundHeight(b.x, b.z, Q.y) > Q.y - 0.1;
  Q.reset(); for (let i = 0; i < 5; i++) Q.tick(D.camera, 1 / 30);
  out.reset = !Q.symbols.some((s) => s.lit) && !Q.arena.anchors.some((a) => a.lit) && !Q.portalAt.lit && Q.seals.every((s) => !s.isOpen) && !Q.brokenPath.bridge.on;
  out.bridgeDown = D.world.groundHeight(b.x, b.z, Q.y) < Q.y - 5;
  return out;
});
check('symbols, anchors and the energy point light up', lights.lit);
check('the bridge rises and carries', lights.bridge);
check('reset(): everything dark, the seals shut, the bridge down again', lights.reset && lights.bridgeDown);

// ---------- draw calls and triangles with the camera in the grove ----------
const cost = await G(async () => {
  const D = window.__game.debug, Q = D.world.places.grove, cam = D.camera, out = {};
  window.__game.teleport(Q.x + 18, Q.z - 12);
  const own = () => { let n = 0, t = 0; for (const G0 of [Q.group, Q.ground]) G0.traverseVisible((o) => { if (!(o.isMesh || o.isLine || o.isPoints)) return; n++; const gm = o.geometry, c = gm.index ? gm.index.count : gm.attributes.position.count; t += o.isMesh ? (c / 3) * (o.isInstancedMesh ? o.count : 1) : 0; }); return { calls: n, triangles: Math.round(t) }; };
  const shot = () => { cam.position.set(Q.x + 22, Q.y + 1.7, Q.z - 14); cam.lookAt(Q.x - 10, Q.y + 1, Q.z + 4); cam.updateMatrixWorld(); D.world.tick(cam, 1 / 30); Q.tick(cam, 1 / 30); D.renderer.render(D.scene, cam); return { calls: D.renderer.info.render.calls, triangles: D.renderer.info.render.triangles, own: own() }; };
  const hold = D.game.hold; D.game.hold = true;
  Q.dimension(false); out.park = shot();
  Q.dimension(true); for (const s of Q.seals) s.open(true); out.dimension = shot();
  D.game.hold = hold;
  return out;
});
console.log(`INFO  camera in the grove (the whole view), ordinary world: ${cost.park.calls} draw calls, ${cost.park.triangles} triangles; the dimension: ${cost.dimension.calls} draw calls, ${cost.dimension.triangles} triangles`);
console.log(`INFO  the grove's own objects (before culling), ordinary world: ${cost.park.own.calls} draw calls, ${cost.park.own.triangles} triangles; the dimension: ${cost.dimension.own.calls} draw calls, ${cost.dimension.own.triangles} triangles`);
check('the grove itself stays cheap (at most 60 draw calls of its own, 90 in the dimension)', cost.park.own.calls <= 60 && cost.dimension.own.calls <= 90, `${cost.park.own.calls} / ${cost.dimension.own.calls}`);

// ---------- dimension(false): the layer hidden, the path whole again ----------
const back = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Q = W.places.grove; Q.reset(); Q.dimension(false);
  const bp = Q.brokenPath, mids = bp.stones.filter((s) => s.kind !== 'bank');
  return {
    hidden: !Q.layer.visible && !Q.isDimension(),
    whole: mids.every((s) => Math.abs(W.groundHeight(s.x, s.z, Q.y) - Q.y) < 0.15),
    noWalls: Q.seals.every((s) => s.panels.every((pn) => !W.cols.blocks((pn.a.x + pn.b.x) / 2, Q.y + 1, (pn.a.z + pn.b.z) / 2, g.car))),
  };
});
check('dimension(false): the layer is hidden', back.hidden);
check('dimension(false): the paved path is whole over the rift', back.whole);
check('dimension(false): no energy wall stands', back.noWalls);
await run('the park again (dimension off), along the path', { area: AREA, setup: 'Q.dimension(false);', from: 'Q.pathStart', to: [['the end of the path', 'Q.pathEnd'], ['the gate', 'Q.gate'], ['the clearing', 'Q.arena.centre'], ['the lot', 'Q.lot.centre'], ['the playground', 'Q.playground.centre']] });

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
