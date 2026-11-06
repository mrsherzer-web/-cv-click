// Walkability of chapter seven's places: can a player on foot actually get from where each mission puts
// him to each of its objectives? A flood fill over a half-metre grid with the player's own collision
// test (walls, crates, closed doors; the ground height per cell), with the doors in the state the
// mission has them at that point. Usage: node tests/walk.test.mjs [siteDir]
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

// one case: doors set, a flood fill from `from`, every target looked up. Expressions are read against P = world.places.
const walk = (c) => page.evaluate((c) => {
  const g = window.__game, W = g.debug.world, P = W.places, cols = W.cols, R = 0.35, S = 0.5;
  const E = (expr) => new Function('P', `return (${expr});`)(P);
  for (const [expr, open] of c.doors) { const d = E(expr); if (open) d.unlock(); else d.lock(); d.setOpen(open); }
  const a = c.area, x0 = a.x0, z0 = a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
  const blocked = new Uint8Array(nx * nz), ground = new Float32Array(nx * nz), pos = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + i * S, z = z0 + j * S, y = W.groundHeight(x, z); ground[i * nz + j] = y;
    pos.x = x; pos.y = y; pos.z = z;
    blocked[i * nz + j] = cols.resolve(pos, R, y, g.debug.game.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02 ? 1 : 0;
  }
  const idx = (p) => { const i = Math.round((p.x - x0) / S), j = Math.round((p.z - z0) / S); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : i * nz + j; };
  const from = E(c.from); let start = idx(from); if (start < 0) return { error: 'start outside the area' };
  if (blocked[start]) { let best = Infinity; for (let k = 0; k < nx * nz; k++) { if (blocked[k]) continue; const d = Math.hypot(x0 + Math.floor(k / nz) * S - from.x, z0 + (k % nz) * S - from.z); if (d < best) { best = d; start = k; } } if (best > 1.2) return { error: `start blocked (nearest free cell ${best.toFixed(1)} m away)` }; }
  const seen = new Uint8Array(nx * nz); const q = [start]; seen[start] = 1;
  while (q.length) { const k = q.pop(); const i = Math.floor(k / nz), j = k % nz; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue; const n = a2 * nz + b2; if (seen[n] || blocked[n] || Math.abs(ground[n] - ground[k]) > 0.9) continue; seen[n] = 1; q.push(n); } }
  const out = {};
  // a target on a piece of furniture counts when a cell within a metre of it is reached (the interaction radius is larger)
  const nearOk = (k) => { const i = Math.floor(k / nz), j = k % nz; for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue; if (seen[a2 * nz + b2]) return true; } return false; };
  for (const [name, expr] of c.to) { const p = E(expr); const k = idx(p); out[name] = k < 0 ? 'outside-area' : seen[k] ? 'ok' : blocked[k] ? (nearOk(k) ? 'ok' : 'blocked-cell') : 'unreachable'; }
  return { out };
}, c);
const FORT = { x0: 356, z0: 128, x1: 484, z1: 258 }, FORT_ROAD = { x0: 296, z0: 92, x1: 486, z1: 258 }, DEPOT = { x0: 138, z0: 100, x1: 262, z1: 232 }, PASSAGE = { x0: 298, z0: 94, x1: 388, z1: 182 }, QUARRY = { x0: 248, z0: -32, x1: 352, z1: 92 };
const side = (expr, dx, dz) => `(() => { const p = ${expr}; return { x: p.x + (${dx}), z: p.z + (${dz}) }; })()`;
const run = async (title, c, expectUnreachable = []) => {
  const r = await walk(c);
  if (r.error) { check(`${title}: ${r.error}`, false); return; }
  for (const [name] of c.to) { const want = expectUnreachable.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
};

// ---------- the fort ----------
const fortDoors = (gate, halls, cell) => [['P.fort.gate', gate], ['P.fort.main.westDoor', halls], ['P.fort.main.eastDoor', halls], ['P.fort.holding.cellDoor', cell], ['P.passage.exitDoor', false], ['P.passage.puzzleDoor', false]];
await run('fort, the quiet way in: from the hatch', { area: FORT, doors: fortDoors(false, false, false), from: 'P.fort.hatch', to: [
  ['passage out', 'P.passage.out'], ['generator door', 'P.fort.generator.door'], ['generator inside', 'P.fort.generator.inside'], ['beside the breaker', side('P.fort.generator.breaker', 0.9, 0)],
  ['main door', 'P.fort.main.door'], ['main inside', 'P.fort.main.inside'], ['centre hall', 'P.fort.main.centre'], ['west hall (door shut)', 'P.fort.main.west'], ['east hall (door shut)', 'P.fort.main.east'],
  ['control foot', 'P.fort.control.foot'], ['control door', 'P.fort.control.door'], ['control inside', 'P.fort.control.inside'], ['beside the note', side('P.fort.control.note', 0, -1.2)], ['gate inside', 'P.fort.gateInside'], ['gate outside (gate shut)', 'P.fort.gateOutside'], ['behind the passage door', 'P.passage.exitAt'] ] },
  ['west hall (door shut)', 'east hall (door shut)', 'gate outside (gate shut)', 'behind the passage door']);
await run('fort, the loud way in: from outside the open gate', { area: FORT, doors: fortDoors(true, false, false), from: 'P.fort.gateOutside', to: [['gate inside', 'P.fort.gateInside'], ['main door', 'P.fort.main.door'], ['control inside', 'P.fort.control.inside'], ['hatch', 'P.fort.hatch']] });
await run('fort, Ido opened the hall doors: from the centre', { area: FORT, doors: fortDoors(false, true, false), from: 'P.fort.main.centre', to: [
  ['west hall', 'P.fort.main.west'], ['east hall', 'P.fort.main.east'], ['west door spot', 'P.fort.main.westDoorAt'], ['east door spot', 'P.fort.main.eastDoorAt'], ['tunnel mouth', 'P.fort.main.tunnelMouth'], ['tunnel start', 'P.fort.tunnel.start'], ['tunnel end', 'P.fort.tunnel.end'],
  ['holding door', 'P.fort.holding.door'], ['holding inside', 'P.fort.holding.inside'], ['keypad', 'P.fort.holding.keypadAt'], ['the cell (code door shut)', 'P.fort.holding.cell'] ] }, ['the cell (code door shut)']);
await run('fort, the code door open: from the keypad', { area: FORT, doors: fortDoors(false, true, true), from: 'P.fort.holding.keypadAt', to: [['the cell', 'P.fort.holding.cell'], ['Nehorai', 'P.fort.holding.nehorai'], ['Kotzi', 'P.fort.holding.kotzi']] });
await run('the escape: from the cell to the gate (gate shut)', { area: FORT, doors: fortDoors(false, true, true), from: 'P.fort.holding.cell', to: [['tunnel mouth', 'P.fort.main.tunnelMouth'], ['centre hall', 'P.fort.main.centre'], ['main door', 'P.fort.main.door'], ['gate inside', 'P.fort.gateInside'], ['gate outside (gate shut)', 'P.fort.gateOutside']] }, ['gate outside (gate shut)']);
await run('the escape: Ido opened the gate, to the cars', { area: FORT_ROAD, doors: fortDoors(true, true, true), from: 'P.fort.gateInside', to: [['gate outside', 'P.fort.gateOutside'], ['the cars at the passage parking', 'P.passage.parking']] });

// ---------- the depot ----------
const depotDoors = (office, hidden) => [['P.depot.office.door', office], ['P.depot.hidden.door', hidden]];
await run('depot: from the parking', { area: DEPOT, doors: depotDoors(false, false), from: 'P.depot.parking', to: [
  ['gate', 'P.depot.gate'], ['gate inside', 'P.depot.gateInside'], ['guard house door', 'P.depot.guardHouse.door'], ['guard house inside', 'P.depot.guardHouse.inside'], ['beside the monitor', side('P.depot.guardHouse.monitor', 0, 1.0)],
  ['warehouse door', 'P.depot.warehouse.door'], ['warehouse inside', 'P.depot.warehouse.inside'], ['warehouse centre', 'P.depot.warehouse.center'], ['office door spot', 'P.depot.office.at'], ['shelf spot', 'P.depot.hidden.at'], ['office inside (door shut)', 'P.depot.office.inside'], ['the back, round the outside', 'P.depot.back'] ] },
  ['office inside (door shut)']);
await run('depot: Ido opened the office and the hidden door', { area: DEPOT, doors: depotDoors(true, true), from: 'P.depot.warehouse.center', to: [['office inside', 'P.depot.office.inside'], ['beside the laptop', side('P.depot.office.laptop', 0, 1.0)], ['behind the hidden door', 'P.depot.hidden.out'], ['the back', 'P.depot.back'], ['the parking', 'P.depot.parking']] });

// ---------- the passage ----------
const passageDoors = (trap, sideIn, shutter, puzzle, exit) => [['P.passage.trapDoor', trap], ['P.passage.sideIn', sideIn], ['P.passage.sideOut', true], ['P.passage.clock.shutter', shutter], ['P.passage.puzzleDoor', puzzle], ['P.passage.exitDoor', exit]];
// the mission puts the team at the shed door, inside the covered passage (its only way out is the fort)
await run('passage: from the shed door through the plates to the switch room', { area: PASSAGE, doors: passageDoors(true, false, true, false, false), from: 'P.passage.shed.door', to: [
  ['shed inside', 'P.passage.shed.inside'], ['plates start', 'P.passage.platesStart'], ['plates end', 'P.passage.platesEnd'], ['before the door', 'P.passage.beforeDoor'], ['after the door', 'P.passage.afterDoor'],
  ['clock start', 'P.passage.clock.start'], ['clock end', 'P.passage.clock.end'], ['the turn', 'P.passage.turn'], ['the switches', 'P.passage.puzzleAt'], ['the valves (puzzle door shut)', side('P.passage.valves[0]', 0, 1.0)] ] }, ['the valves (puzzle door shut)']);
await run('passage: the door locked behind Erez, the side room for the team', { area: PASSAGE, doors: passageDoors(false, true, true, false, false), from: 'P.passage.beforeDoor', to: [['side door spot', 'P.passage.sideAt'], ['side in', 'P.passage.sideInAt'], ['side room', 'P.passage.sideRoom'], ['side out', 'P.passage.sideOutAt'], ['after the door', 'P.passage.afterDoor']] });
await run('passage: the switches done, the valves, the way out', { area: FORT_ROAD, doors: passageDoors(false, true, true, true, false), from: 'P.passage.puzzleAt', to: [['after the puzzle door', 'P.passage.afterPuzzle'], ['the near valve', side('P.passage.valves[0]', 0, 1.0)], ['the far valve', side('P.passage.valves[1]', 0, -1.0)], ['before the exit door', 'P.passage.exitAt'], ['out (exit door shut)', 'P.passage.out']] }, ['out (exit door shut)']);
await run('passage: the valves turned, out into the fort', { area: FORT_ROAD, doors: passageDoors(false, true, true, true, true), from: 'P.passage.exitAt', to: [['out', 'P.passage.out'], ['the fort hatch', 'P.fort.hatch'], ['the fort main door', 'P.fort.main.door']] });

// ---------- the quarry ----------
await run('quarry: from the parking', { area: QUARRY, doors: [], from: 'P.quarry.parking', to: [['entrance', 'P.quarry.entrance'], ['office door', 'P.quarry.office.door'], ['office inside', 'P.quarry.office.inside'], ['beside the desk', side('P.quarry.office.desk', 0, 0.9)], ['beside the map', side('P.quarry.office.map', 0.9, 0)], ['beside the cabinet', side('P.quarry.office.cabinet', 0, -0.9)], ['shed inside', 'P.quarry.shed.inside'], ['beside the radios', side('P.quarry.shed.radios', 0, 1.0)], ['beside the truck keys', side('P.quarry.truck.keys', 0, 1.0)], ['truck cab', 'P.quarry.truck.cab']] });

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
