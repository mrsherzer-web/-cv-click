// Walkability of the Black Port (chapter nine): can a player on foot get from the west gate, where the
// death road arrives, to every named spot on its own floor — the control tower's top room by its stairs,
// the office with the access card, the ships' decks by their gangways, the passage through the stacked
// containers and into the elevator — and to every point of every guard's route? And do the doors that
// matter (the gate, the office, the tower room, the passage's false back, the elevator) really block
// when they are shut? A flood fill over a half-metre grid with the player's own collision test, following
// the ground at the walker's own height (the harness of tests/walk.test.mjs, with finer height layers for
// the tower's steps). Also: the search lights sweep, see a point in their beam, and not one behind a
// container. Usage: node tests/walk-port.test.mjs [siteDir]
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
await page.evaluate(() => { window.__game.debug.game.hold = true; }); // no frames while the fills run

// c: { area, setup, teardown (code run in the page with P = places, W = world, g = game), from (expr, with y),
//      to: [[name, expr]] (with y where it is on a floor) }
const walk3 = (c) => page.evaluate((c) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = W.places, cols = W.cols, R = 0.35, S = 0.5;
  const run = (code) => code && new Function('P', 'W', 'g', code)(P, W, g);
  run(c.setup);
  const E = (expr) => new Function('P', `return (${expr});`)(P);
  const a = c.area, x0 = a.x0, z0 = a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
  const pos = { x: 0, y: 0, z: 0 }, free = new Map();
  const layer = (y) => Math.max(0, Math.min(255, Math.round((y + 80) * 2)));   // half-metre height layers
  const isFree = (i, j, y) => { const k = (i * nz + j) * 256 + layer(y); if (free.has(k)) return free.get(k); const x = x0 + i * S, z = z0 + j * S; pos.x = x; pos.y = y; pos.z = z; const hit = cols.resolve(pos, R, y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02; free.set(k, !hit); return !hit; };
  const from = E(c.from), seen = new Map(), q = [];
  const push = (i, j, y) => { const k = (i * nz + j) * 256 + layer(y); if (seen.has(k)) return; seen.set(k, y); q.push([i, j, y]); };
  { const i = Math.round((from.x - x0) / S), j = Math.round((from.z - z0) / S), y = W.groundHeight(x0 + i * S, z0 + j * S, from.y ?? null); if (!isFree(i, j, y)) return { error: 'start blocked' }; push(i, j, y); }
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
  // a target counts when a reached cell within a metre of it is on its floor (the interaction radius is larger)
  for (const [name, expr] of c.to) {
    const p = E(expr), i0 = Math.round((p.x - x0) / S), j0 = Math.round((p.z - z0) / S), yy = p.y ?? W.groundHeight(p.x, p.z);
    let ok = false;
    const tol = c.tol ?? 2;
    for (let di = -tol; di <= tol && !ok; di++) for (let dj = -tol; dj <= tol && !ok; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; for (let L = layer(yy) - 2; L <= layer(yy) + 2; L++) { const k = (i * nz + j) * 256 + L; if (seen.has(k) && Math.abs(seen.get(k) - yy) < 0.5) { ok = true; break; } } }
    out[name] = ok ? 'ok' : 'unreachable';
  }
  run(c.teardown);
  return { out, cells: seen.size };
}, c);
const run3 = async (title, c, expectShut = []) => {
  const t0 = Date.now(), r = await walk3(c);
  if (r.error) { check(`${title}: ${r.error}`, false); return; }
  for (const [name] of c.to) { const want = expectShut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
  console.log(`      (${r.cells} cells, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
};

// ---------- the place and its pieces ----------
const shape = await page.evaluate(() => {
  const p = window.__game.debug.world.places.port;
  if (!p) return null;
  return { bounds: p.bounds, patrols: Object.fromEntries(Object.entries(p.patrols).map(([k, v]) => [k, v.length])), ships: p.ships.length, cranes: p.cranes.length, lights: p.searchLights.length, spots: p.elevator.spots.length, entranceSpots: p.entranceSpots.length, gateSpots: p.gateSpots.length, cover: p.cover.length, coverSpots: p.coverSpots.length, route: p.route.length, lamps: p.lamps.length, emissives: p.emissives.length,
    doors: ['gate', 'tower.door', 'cardOffice.door', 'passage.door', 'elevator.door'].map((k) => { const d = k.split('.').reduce((o, s) => o[s], p); return typeof d?.setOpen === 'function' && typeof d?.lock === 'function' && !!d.body; }) };
});
check('places.port exists', !!shape);
check('the yard is where chapter nine puts it (x 1540..1830, z -440..-250)', shape && shape.bounds.x0 === 1540 && shape.bounds.x1 === 1830 && shape.bounds.z0 === -440 && shape.bounds.z1 === -250, JSON.stringify(shape?.bounds));
check('10 to 12 guard routes', shape && Object.keys(shape.patrols).length >= 10 && Object.keys(shape.patrols).length <= 12, Object.keys(shape?.patrols || {}).join(','));
check('two ships, three cranes, two search lights', shape && shape.ships === 2 && shape.cranes === 3 && shape.lights === 2);
check('ten places in the elevator, ten at the entrance, ten at the gate', shape && shape.spots === 10 && shape.entranceSpots === 10 && shape.gateSpots === 10);
check('every door is a site door (opens, locks, has a body)', shape && shape.doors.every(Boolean), JSON.stringify(shape?.doors));
check('lamps and emissives for the night', shape && shape.lamps >= 20 && shape.emissives >= 2, `${shape?.lamps} lamps`);

const AREA = await page.evaluate(() => { const b = window.__game.debug.world.places.port.bounds; return { x0: b.x0 - 12, z0: b.z0 - 4, x1: b.x1 + 4, z1: b.z1 + 4 }; });
const CORNER = await page.evaluate(() => { const b = window.__game.debug.world.places.port.bounds; return { x0: b.x1 - 50, z0: b.z1 - 50, x1: b.x1 + 2, z1: b.z1 + 2 }; });
// every door the way needs, in the state a mission would have it
const doors = ({ gate = true, tower = true, office = true, passage = false, elevator = true, cabins = true } = {}) => `{ const p = P.port; const set = (d, o) => { if (o) { d.unlock(); d.setOpen(true); } else d.lock(); };
  set(p.gate, ${gate}); set(p.tower.door, ${tower}); set(p.cardOffice.door, ${office}); set(p.passage.door, ${passage}); set(p.elevator.door, ${elevator}); for (const s of p.ships) set(s.cabin.door, ${cabins}); }`;
const reset = doors({ gate: false, passage: false });
const patrolPoints = await page.evaluate(() => Object.entries(window.__game.debug.world.places.port.patrols).flatMap(([k, v]) => v.map((_, i) => [`guard route ${k}[${i}]`, `P.port.patrols.${k}[${i}]`])));
const list = (expr, n, label) => Array.from({ length: n }, (_, i) => [`${label} ${i + 1}`, `${expr}[${i}]`]);

// ---------- from the west gate, the gate open, the passage's back still shut ----------
await run3('from outside the west gate (gate open)', { area: AREA, setup: doors(), teardown: reset, from: 'P.port.gateOutside', to: [
  ['inside the gate', 'P.port.gateInside'], ...list('P.port.gateSpots', 10, 'the gang at the gate'), ['the gate house', 'P.port.posts.gate'], ['the east booth', 'P.port.posts.east'],
  ['the tower foot', 'P.port.tower.foot'], ['tower stairs 1 top', 'P.port.tower.stairs[0].top'], ['landing 1', 'P.port.tower.landings[0]'], ['tower stairs 2 top', 'P.port.tower.stairs[1].top'], ['landing 2', 'P.port.tower.landings[1]'],
  ['tower stairs 3 top', 'P.port.tower.stairs[2].top'], ['landing 3', 'P.port.tower.landings[2]'], ['tower stairs 4 top', 'P.port.tower.stairs[3].top'], ['the top landing', 'P.port.tower.top'], ['the tower door', 'P.port.tower.doorAt'],
  ['the tower room', 'P.port.tower.room'], ['the alarm panel', 'P.port.alarmAt'], ['the view over the yard', 'P.port.tower.view'],
  ['the west warehouse opening', 'P.port.warehouses[0].opening'], ['the west warehouse side door', 'P.port.warehouses[0].side'], ['in the west warehouse', 'P.port.warehouses[0].inside'],
  ['the east warehouse opening', 'P.port.warehouses[1].opening'], ['the east warehouse side door', 'P.port.warehouses[1].side'], ['in the east warehouse', 'P.port.warehouses[1].inside'],
  ['the office door', 'P.port.cardOffice.doorAt'], ['in the office', 'P.port.cardOffice.inside'], ['at the desk with the card', 'P.port.cardOffice.desk'], ['beside the card', '({ x: P.port.card.x, z: P.port.card.z - 1.0, y: P.port.y })'],
  ...[0, 1].flatMap((k) => [[`ship ${k + 1}: the gangway foot`, `P.port.ships[${k}].gangway.bottom`], [`ship ${k + 1}: the gangway top`, `P.port.ships[${k}].gangway.top`], [`ship ${k + 1}: the deck`, `P.port.ships[${k}].deck`], [`ship ${k + 1}: fore`, `P.port.ships[${k}].fore`], [`ship ${k + 1}: aft`, `P.port.ships[${k}].stern`], [`ship ${k + 1}: the cabin door`, `P.port.ships[${k}].cabin.doorAt`], [`ship ${k + 1}: in the cabin`, `P.port.ships[${k}].cabin.inside`]]),
  ...patrolPoints, ...list('P.port.coverSpots', shape.coverSpots, 'cover spot'), ...list('P.port.route', shape.route, 'the quiet way'),
  ['the passage, in front', 'P.port.passage.front'], ['the passage mouth', 'P.port.passage.mouth'], ['in the passage', 'P.port.passage.inside'], ['at the false back', 'P.port.passage.back'],
  ['past the false back (shut)', 'P.port.passage.out'], ['the entrance (passage shut)', 'P.port.entrance'], ['in the elevator (passage shut)', 'P.port.elevator.inside'] ] },
  ['past the false back (shut)', 'the entrance (passage shut)', 'in the elevator (passage shut)']);

// ---------- the passage's back open: through it and into the elevator ----------
await run3('the false back open: from the passage into the elevator', { area: AREA, setup: doors({ passage: true }), teardown: reset, from: 'P.port.passage.back', to: [
  ['past the false back', 'P.port.passage.out'], ['the entrance', 'P.port.entrance'], ...list('P.port.entranceSpots', 10, 'the gang at the entrance'), ['the elevator door', 'P.port.elevator.doorAt'], ['in the elevator', 'P.port.elevator.inside'],
  ...list('P.port.elevator.spots', 10, 'elevator place'), ['back out to the yard', 'P.port.passage.front'], ['the gate (from inside)', 'P.port.gateInside'] ] });

// ---------- the doors that must block when shut ----------
await run3('the elevator door shut: from the entrance', { area: CORNER, tol: 0, setup: doors({ passage: true, elevator: false }), teardown: reset, from: 'P.port.entrance', to: [['the elevator door', 'P.port.elevator.doorAt'], ['in the elevator (door shut)', 'P.port.elevator.inside'], ...list('P.port.elevator.spots', 10, 'elevator place (door shut)')] },
  ['in the elevator (door shut)', ...Array.from({ length: 10 }, (_, i) => `elevator place (door shut) ${i + 1}`)]);
await run3('the elevator door shut: from inside the cage', { area: CORNER, tol: 0, setup: doors({ passage: true, elevator: false }), teardown: reset, from: 'P.port.elevator.inside', to: [['the entrance (door shut)', 'P.port.entrance'], ['the far elevator place', 'P.port.elevator.spots[9]']] }, ['the entrance (door shut)']);
await run3('the gate shut: from outside', { area: AREA, setup: doors({ gate: false }), teardown: reset, from: 'P.port.gateOutside', to: [['the gang at the gate', 'P.port.gateSpots[0]'], ['inside the gate (shut)', 'P.port.gateInside'], ['the tower foot (gate shut)', 'P.port.tower.foot']] }, ['inside the gate (shut)', 'the tower foot (gate shut)']);
await run3('the office door shut: from in front of it', { area: AREA, setup: doors({ office: false }), teardown: reset, from: 'P.port.cardOffice.doorAt', to: [['in the office (door shut)', 'P.port.cardOffice.inside'], ['at the desk (door shut)', 'P.port.cardOffice.desk']] }, ['in the office (door shut)', 'at the desk (door shut)']);
await run3('the tower door shut: from the foot', { area: AREA, setup: doors({ tower: false }), teardown: reset, from: 'P.port.tower.foot', to: [['the top landing', 'P.port.tower.top'], ['the tower room (door shut)', 'P.port.tower.room'], ['the alarm panel (door shut)', 'P.port.alarmAt']] }, ['the tower room (door shut)', 'the alarm panel (door shut)']);

// the elevator door, shut, pushes a body out of its doorway; open, it lets it stand there
const doorway = await page.evaluate(() => {
  const W = window.__game.debug.world, p = W.places.port, d = p.elevator.door, pos = { x: d.pos.x, y: d.pos.y, z: d.pos.z };
  d.lock(); const shut = W.cols.resolve(pos, 0.35, d.pos.y) && Math.hypot(pos.x - d.pos.x, pos.z - d.pos.z) > 0.1;
  d.unlock(); d.setOpen(true); const p2 = { x: d.pos.x, y: d.pos.y, z: d.pos.z }; const open = !W.cols.resolve(p2, 0.35, d.pos.y);
  const contains = p.elevator.spots.every((s) => p.elevator.contains(s.x, s.z)) && !p.elevator.contains(p.entrance.x, p.entrance.z);
  return { shut, open, contains };
});
check('the elevator door shut blocks its doorway', doorway.shut);
check('the elevator door open leaves its doorway free', doorway.open);
check('all ten elevator places are in the cage, the entrance is not', doorway.contains);

// ---------- the search lights ----------
const lights = await page.evaluate(() => {
  const W = window.__game.debug.world, p = W.places.port, cam = window.__game.debug.camera, out = { moved: [], seesBeam: [], blind: [], night: 0 };
  cam.position.set(p.x, p.y + 20, p.z);
  const before = p.searchLights.map((s) => ({ ...s.target }));
  for (let i = 0; i < 90; i++) p.tick(cam, 1 / 30);
  p.searchLights.forEach((s, k) => out.moved.push(Math.hypot(s.target.x - before[k].x, s.target.z - before[k].z)));
  // in the beam on open ground: seen; far from both beams: not seen
  for (let i = 0; i < 600 && out.seesBeam.length < 2; i++) {
    p.tick(cam, 0.25);
    for (const s of p.searchLights) if (!out.seesBeam.includes(s) && p.searchSees(s.target.x, s.target.z) && !W.cols.blocks(s.target.x, p.y + 1, s.target.z)) out.seesBeam.push(s);
  }
  out.seesBeam = out.seesBeam.length;
  out.blind = !p.searchSees(p.gateOutside.x - 300, p.gateOutside.z);
  // a point in a beam but behind a container (the ray from the light passes through it): not seen
  let hidden = null;
  for (let i = 0; i < 800 && !hidden; i++) {
    p.tick(cam, 0.2);
    for (const s of p.searchLights) for (let k = 0; k < 24 && !hidden; k++) {
      const a = (k / 24) * Math.PI * 2, x = s.target.x + Math.cos(a) * s.radius * 0.6, z = s.target.z + Math.sin(a) * s.radius * 0.6;
      if (W.cols.blocks(x, p.y + 1, z)) continue;
      if (W.cols.raycast(s.pos.x, s.pos.y, s.pos.z, x, p.y + 1.2, z) !== null) hidden = { seen: p.searchSees(x, z) };
    }
  }
  out.hidden = hidden;
  p.setSearch(false); out.off = p.searchLights.every((s) => !p.searchSees(s.target.x, s.target.z)); p.setSearch(true);
  return out;
});
check('both search lights sweep', lights.moved.every((d) => d > 1), lights.moved.map((d) => d.toFixed(1)).join(', '));
check('each search light sees a point in its beam', lights.seesBeam === 2, String(lights.seesBeam));
check('nobody far outside the beams is seen', lights.blind);
check('a point in a beam but behind cover is not seen', lights.hidden && lights.hidden.seen === false, JSON.stringify(lights.hidden));
check('switched off, the search lights see nothing', lights.off);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
