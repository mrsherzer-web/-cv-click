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
  const nearOk = (k) => { const i = Math.floor(k / nz), j = k % nz; for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue; if (seen[a2 * nz + b2]) return true; } return false; };
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

// ---------- chapters four to six: the bank, the pub and home, the villa, the container yard ----------
const around = (expr, hx, hz) => page.evaluate(({ expr, hx, hz }) => { const P = window.__game.debug.world.places; const c = new Function('P', `return (${expr});`)(P); return { x0: c.x - hx, z0: c.z - hz, x1: c.x + hx, z1: c.z + hz }; }, { expr, hx, hz });
await run('the bank: from the Renault in the yard', { area: await around('P.bank', 55, 45), doors: [], from: 'P.bank.yard', to: [['the bay', 'P.bank.bay'], ['inside the bay', 'P.bank.bayInside'], ['the vault front', 'P.bank.vaultFront'], ['the office', 'P.bank.office'], ['the lobby', 'P.bank.lobby'], ['the front', 'P.bank.front']] });
await run('the pub: from the entrance', { area: await around('P.pub', 45, 45), doors: [], from: 'P.pub.entrance', to: [['inside the door', 'P.pub.doorInside'], ['the centre', 'P.pub.center'], ['the bar', 'P.pub.bar.player'], ['the dance floor', 'P.pub.dance'], ['the parking', 'P.pub.parking']] });
await run('home: from the living room', { area: await around('P.home.interior.living', 30, 30), doors: [], from: 'P.home.interior.living', to: [['the door', 'P.home.interior.door'], ['the doorway', 'P.home.interior.doorway'], ['outside', 'P.home.interior.outside'], ['the desk', 'P.home.interior.desk'], ['the kitchen', 'P.home.interior.kitchen']] });
await run('the villa: from the gate', { area: await around('P.villa', 45, 50), doors: [], from: 'P.villa.gate', to: [['inside the gate', 'P.villa.gateInside'], ['the front door', 'P.villa.door'], ['inside the door', 'P.villa.doorInside'], ['beside the safe', side('P.villa.safe', -1.0, 0)], ['beside the bags', side('P.villa.bags[0]', -1.0, 0)], ['the parking', 'P.villa.parking'], ["Nehorai's car", 'P.villa.cars.nehorai']] });
await run('the container yard: from the gate', { area: await around('P.yard', 40, 50), doors: [], from: 'P.yard.gate', to: [['inside the gate', 'P.yard.gateInside'], ['the office door', 'P.yard.office.door'], ['the office', 'P.yard.office.inside'], ['beside Dolev', side('P.yard.office.dolev', -1.0, 0)], ['beside the laptop', side('P.yard.office.laptop', 0, 1.0)]] });

// ---------- chapter eight: storeys. A fill that follows the ground at the walker's own height ----------
// c: { area, setup, teardown (code run in the page with P = places, W = world, g = game), from (expr, with y),
//      to: [[name, expr]] (with y where it is on a floor) }
const walk3 = (c) => page.evaluate((c) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, P = W.places, cols = W.cols, R = 0.35, S = 0.5;
  const run = (code) => code && new Function('P', 'W', 'g', code)(P, W, g);
  run(c.setup);
  const E = (expr) => new Function('P', `return (${expr});`)(P);
  const a = c.area, x0 = a.x0, z0 = a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
  const pos = { x: 0, y: 0, z: 0 }, free = new Map();
  const isFree = (i, j, y) => { const k = (i * nz + j) * 64 + Math.max(0, Math.min(63, Math.round((y + 80) / 2))); if (free.has(k)) return free.get(k); const x = x0 + i * S, z = z0 + j * S; pos.x = x; pos.y = y; pos.z = z; const hit = cols.resolve(pos, R, y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02; free.set(k, !hit); return !hit; };
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
  for (const [name, expr] of c.to) {
    const p = E(expr), i0 = Math.round((p.x - x0) / S), j0 = Math.round((p.z - z0) / S), yy = p.y ?? W.groundHeight(p.x, p.z);
    let ok = false;
    for (let di = -3; di <= 3 && !ok; di++) for (let dj = -3; dj <= 3 && !ok; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; for (const dy of [-1.25, 0, 1.25]) { const k = keyOf(i, j, yy + dy); if (seen.has(k) && Math.abs(seen.get(k) - yy) < 1.0) { ok = true; break; } } }
    out[name] = ok ? 'ok' : 'unreachable';
  }
  run(c.teardown);
  return { out, cells: seen.size };
}, c);
const run3 = async (title, c, expectShut = []) => {
  const r = await walk3(c);
  for (const [name] of c.to) { const want = expectShut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
};
const box = (b) => `W.cols.addBox(${b}.to.x, ${b}.to.z, (${b}.w ?? 0.5) / 2 + 0.1, ${b}.len / 2, ${b}.yaw, ${b}.to.y - 1, ${b}.to.y + (${b}.h ?? 0.5) + 0.6)`;
const HIDE = await around('P.hideout', 60, 30), BASE = await around('P.ironBase', 58, 48), BRIDGE = await around('P.bridge', 64, 22), HQ = await around('P.hq', 86, 72);

// the hideout: the escape route with both beams down, the exit door shut, then open
await run3('hideout, both beams down, exit shut: from the table', { area: HIDE,
  setup: `P.hideout.exitDoor.lock(); P.hideout.officeDoor.setOpen(true); g.__beams = P.hideout.beams.map((b) => ${box('b')}); g.__rubble = W.cols.addBox(P.hideout.mainDoorOpening.x, P.hideout.mainDoorOpening.z - 0.6, 2.4, 1.2, 0, P.hideout.y - 1, P.hideout.y + 4);`,
  teardown: `for (const b of g.__beams) W.cols.remove(b); W.cols.remove(g.__rubble); P.hideout.officeDoor.setOpen(false);`,
  from: '({ ...P.hideout.table, x: P.hideout.table.x + 2.4, y: P.hideout.y })',
  to: [['the west stairs', '({ ...P.hideout.stairsW.bottom, y: P.hideout.y })'], ['the mezzanine', 'P.hideout.mezz.mid'], ['the rubble ramp top', 'P.hideout.rubble.top'], ['Ido at the exit door', 'P.hideout.exitAt'], ['the wheel', '({ ...P.hideout.wheel, x: P.hideout.wheel.x - 0.6, y: P.hideout.y })'], ['the office', 'P.hideout.office'], ['the yard (exit shut)', 'P.hideout.yard'], ['out of the main door (rubble)', '({ x: P.hideout.mainDoorOpening.x, z: P.hideout.mainDoorOpening.z + 3, y: P.hideout.y })']] },
  ['the yard (exit shut)', 'out of the main door (rubble)']);
await run3('hideout, the wheel turned: to the Renault', { area: HIDE,
  setup: `P.hideout.exitDoor.unlock(); P.hideout.exitDoor.setOpen(true); g.__beams = P.hideout.beams.map((b) => ${box('b')});`,
  teardown: `for (const b of g.__beams) W.cols.remove(b); P.hideout.exitDoor.lock();`,
  from: 'P.hideout.exitAt', to: [['outside', 'P.hideout.outside'], ['the Renault', '({ ...P.hideout.car, x: P.hideout.car.x - 1.6 })']] });

// the Iron Base: all three floors with the shutters open, from the gate
const baseOpen = `P.ironBase.gate.unlock(); P.ironBase.gate.setOpen(true); for (const d of P.ironBase.shutters) { d.unlock(); d.setOpen(true); }`;
await run3('Iron Base, shutters open: from inside the gate', { area: BASE, setup: baseOpen, from: 'P.ironBase.gateInside',
  to: [['the shed', 'P.ironBase.store.inside'], ['the main door', 'P.ironBase.main.door'], ['the lobby', 'P.ironBase.main.lobby'], ['the corridor', 'P.ironBase.main.corridor'], ['the main stairs, top', 'P.ironBase.main.s1.top'], ['first floor', 'P.ironBase.main.f1'], ['the office, breaker B', '({ ...P.ironBase.main.breakerB, x: P.ironBase.main.breakerB.x - 0.8, y: P.ironBase.y + P.ironBase.F1 })'], ['the west stairwell', 'P.ironBase.main.stairwell'], ['second floor', 'P.ironBase.main.f2'], ['the hallway', 'P.ironBase.main.hall2'], ['the control room', 'P.ironBase.control.inside'], ['by the note', 'P.ironBase.control.desk'], ['east of the control room', 'P.ironBase.main.east2'], ['the back stairs, top', 'P.ironBase.main.s3.top'], ['the store room (lock room)', 'P.ironBase.lockRoom.inside'], ['the generator keypad', 'P.ironBase.generator.keypadAt'], ['inside the generator room (door shut)', 'P.ironBase.generator.inside']] },
  ['inside the generator room (door shut)']);
await run3('Iron Base, the blackout: locked in the control room', { area: BASE,
  setup: `${baseOpen} P.ironBase.control.door.lock(); P.ironBase.shutters[0].lock(); P.ironBase.shutters[1].lock(); P.ironBase.lockRoom.door.lock();`,
  teardown: `${baseOpen} P.ironBase.lockRoom.door.unlock(); P.ironBase.lockRoom.door.setOpen(true);`,
  from: 'P.ironBase.control.inside', to: [['the note', 'P.ironBase.control.desk'], ['the shelf', 'P.ironBase.hidden.at'], ['past the hidden door (shut)', 'P.ironBase.hidden.out'], ['the hallway (door locked)', 'P.ironBase.main.hall2']] },
  ['past the hidden door (shut)', 'the hallway (door locked)']);
await run3('Iron Base, the blackout: the shelf moved, the hidden door open', { area: BASE,
  setup: `${baseOpen} P.ironBase.control.door.lock(); P.ironBase.shutters[0].lock(); P.ironBase.shutters[1].lock(); P.ironBase.lockRoom.door.lock(); W.cols.remove(P.ironBase.hidden.shelfBody); P.ironBase.hidden.door.unlock(); P.ironBase.hidden.door.setOpen(true);`,
  teardown: `${baseOpen} P.ironBase.lockRoom.door.unlock(); P.ironBase.lockRoom.door.setOpen(true); P.ironBase.hidden.shelfBody = W.cols.addBox(P.ironBase.x + 3.4, P.ironBase.z - 21, 0.3, 1.0, 0, P.ironBase.y + P.ironBase.F2 - 0.3, P.ironBase.y + P.ironBase.F2 + 2.2); P.ironBase.hidden.door.lock();`,
  from: 'P.ironBase.control.inside', to: [['past the hidden door', 'P.ironBase.hidden.out'], ['the back stairs, top', 'P.ironBase.main.s3.top'], ['breaker B', '({ ...P.ironBase.main.breakerB, x: P.ironBase.main.breakerB.x - 0.8, y: P.ironBase.y + P.ironBase.F1 })'], ['the ground corridor', 'P.ironBase.main.corridor'], ['the lobby (shutter down)', 'P.ironBase.main.lobby'], ['the lock room (locked)', 'P.ironBase.lockRoom.inside']] },
  ['the lobby (shutter down)', 'the lock room (locked)']);
await run3('Iron Base, breaker B lifted the shutter: out to the generator', { area: BASE,
  setup: `${baseOpen} P.ironBase.control.door.lock(); P.ironBase.shutters[1].lock(); P.ironBase.generator.door.unlock(); P.ironBase.generator.door.setOpen(true);`,
  teardown: `${baseOpen} P.ironBase.generator.door.lock();`,
  from: 'P.ironBase.main.corridor', to: [['the lobby', 'P.ironBase.main.lobby'], ['the main door', 'P.ironBase.main.door'], ['the keypad', 'P.ironBase.generator.keypadAt'], ['the green lever', '({ ...P.ironBase.generator.levers[0], y: P.ironBase.y })'], ['the red lever', '({ ...P.ironBase.generator.levers[1], y: P.ironBase.y })'], ['the blue lever', '({ ...P.ironBase.generator.levers[2], y: P.ironBase.y })'], ['the machine', 'P.ironBase.generator.machine'], ['out of the gate', 'P.ironBase.gateOutside']] });

// the bridge: every cover position and the edge of the span, from the west
await run3('the bridge: from the west end', { area: BRIDGE, from: 'P.bridge.west', to: [...[0, 1, 2, 3, 4, 5, 6].map((k) => [`behind car ${k + 1}`, `({ x: P.bridge.cars[${k}].x, z: P.bridge.cars[${k}].z + (P.bridge.cars[${k}].z > P.bridge.z ? -2.4 : 2.4), y: P.bridge.y })`]), ['the middle', 'P.bridge.mid'], ['the west edge of the span', 'P.bridge.edge.west'], ['the east edge of the span', 'P.bridge.edge.east'], ['beside the armoured car', '({ x: P.bridge.armour.x, z: P.bridge.armour.z + 4, y: P.bridge.y })'], ['the east end', 'P.bridge.east']] });

// the headquarters: the way in, door by door, and the way out when it is about to go up
const hqOpen = `{ const q = P.hq; q.gate.unlock(); q.gate.setOpen(true); q.server.door.unlock(); q.server.door.setOpen(true); if (q.server.shelfBody) { W.cols.remove(q.server.shelfBody); q.server.shelfBody = null; } q.server.hidden.door.unlock(); q.server.hidden.door.setOpen(true); q.command.back.unlock(); q.command.back.setOpen(true); for (const gt of q.security.gates) { gt.unlock(); gt.setOpen(true); } }`;
const hqReset = `{ const q = P.hq; q.gate.lock(); q.server.door.lock(); q.server.shelfBody = W.cols.addBox(q.x + 56, q.z - 11.4, 1.0, 0.3, 0, q.y - 1, q.y + 2.2); q.server.hidden.door.lock(); q.command.back.lock(); for (const d of [q.inner.doorW, q.inner.doorC, q.inner.doorE]) d.lock(); }`;
await run3('the headquarters, the server door shut: from the gate', { area: HQ, setup: `P.hq.gate.unlock(); P.hq.gate.setOpen(true);`, teardown: `P.hq.gate.lock();`, from: 'P.hq.gateInside',
  to: [['the garage', 'P.hq.garage.inside'], ['the office, the note', 'P.hq.garage.office'], ['the keypad', 'P.hq.server.keypadAt'], ['the server hall (door shut)', 'P.hq.server.inside'], ['the command room (no way yet)', 'P.hq.command.inside']] },
  ['the server hall (door shut)', 'the command room (no way yet)']);
await run3('the headquarters, all doors open: from the gate to the control room', { area: HQ, setup: hqOpen, teardown: hqReset, from: 'P.hq.gateInside',
  to: [['the server hall', 'P.hq.server.inside'], ['the shelf', 'P.hq.server.shelfAt'], ['the strip', 'P.hq.server.hidden.strip'], ['the passage', 'P.hq.passage.south'], ['the back door', 'P.hq.command.backAt'], ['the command room', 'P.hq.command.inside'], ['room one', 'P.hq.rooms[0].inside'], ['room two', 'P.hq.rooms[1].inside'], ['room three', 'P.hq.rooms[2].inside'], ['the corridor', 'P.hq.security.corridor'], ['breaker 1', 'P.hq.security.breakers[0]'], ['breaker 2', 'P.hq.security.breakers[1]'], ['breaker 3', 'P.hq.security.breakers[2]'], ['the control room', 'P.hq.control.inside'], ['the east hall', 'P.hq.eastHall']] });
await run3('the headquarters, the way out: west and centre blocked, east open', { area: HQ,
  setup: `${hqOpen} const q = P.hq, e = q.escape; g.__b = [W.cols.addBox(e.beamsW.to.x, q.inner.W.z, 0.4, 1.6, Math.PI / 2, q.y - 1, q.y + 1.5), W.cols.addBox(e.beamsC.to.x, q.inner.C.z, 0.4, 1.6, Math.PI / 2, q.y - 1, q.y + 1.5)]; q.inner.doorW.unlock(); q.inner.doorW.setOpen(true); q.inner.doorC.unlock(); q.inner.doorC.setOpen(true); q.inner.doorE.unlock(); q.inner.doorE.setOpen(true); q.command.back.lock();`,
  teardown: `for (const b of g.__b) W.cols.remove(b); ${hqReset}`,
  from: 'P.hq.escape.startAt', to: [['outside the east door', 'P.hq.inner.Eout'], ['Dolev', '({ ...P.hq.escape.pinned, x: P.hq.escape.pinned.x + 1.2 })'], ['the gate', 'P.hq.escape.gate'], ['outside the gate', 'P.hq.gateOutside']] });
await run3('the headquarters, the way out with the east door shut too: no way (it must be opened)', { area: HQ,
  setup: `${hqOpen} const q = P.hq, e = q.escape; g.__b = [W.cols.addBox(e.beamsW.to.x, q.inner.W.z, 0.4, 1.6, Math.PI / 2, q.y - 1, q.y + 1.5), W.cols.addBox(e.beamsC.to.x, q.inner.C.z, 0.4, 1.6, Math.PI / 2, q.y - 1, q.y + 1.5)]; for (const d of [q.inner.doorW, q.inner.doorC]) { d.unlock(); d.setOpen(true); } q.inner.doorE.lock(); q.command.back.lock();`,
  teardown: `for (const b of g.__b) W.cols.remove(b); ${hqReset}`,
  from: 'P.hq.escape.startAt', to: [['the gate (east door shut)', 'P.hq.escape.gate']] },
  ['the gate (east door shut)']);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
