// Walkability of chapter nine's Black Tower (src/world/tower.js): can a player on foot get from the plaza up
// every storey by the stairs to each place a mission sends him, at that floor's height? A flood fill over a
// half-metre grid with the player's own collision test (walls, furniture, vehicles, closed doors) that
// follows the ground at the walker's own height (floors, steps), with the doors in the state the case sets.
// Then the escape route walked end to end (and cut where its gate or the lobby's shutter is shut), every
// door checked to block when shut and not when open, the patrols' legs and the route's marked legs checked
// clear, the cars' colliders, the place's helpers. Usage: node tests/walk-tower.test.mjs [distDir]
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
const G = (fn, a) => page.evaluate(fn, a);
check('the tower is built', await G(() => !!window.__game.debug.world.places.tower?.stairs?.length));
check('the doors as the site leaves them: the gates shut, the lobby open, the four locked rooms locked, the elevators shut', await G(() => { const T = window.__game.debug.world.places.tower; return !T.gate.open && T.gate.locked && !T.exitGate.open && T.exitGate.locked && T.lobby.door.open && T.escape.gate.open && T.breach.door.locked && T.trapped.door.locked && T.command.door.locked && T.command.escapeDoor.locked && T.elevator.doors.every((d) => !d.open); }));

// one fill: c = { area (site-local), setup, teardown (code with T = the tower, W = world, g = game), from (expr, with y),
// to: [[name, expr]] }. A target counts when a cell within 1.5 m of it was reached at its height (within a metre).
const walk = (c) => page.evaluate((c) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, T = W.places.tower, cols = W.cols, R = 0.35, S = 0.5;
  const run = (code) => code && new Function('T', 'W', 'g', code)(T, W, g);
  const E = (expr) => new Function('T', `return (${expr});`)(T);
  run(c.setup);
  const a = c.area, x0 = T.x + a.x0, z0 = T.z + a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
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
const run = async (title, c, shut = []) => {
  const r = await walk(c);
  for (const [name] of c.to) { const want = shut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
  return r;
};
const SITE = { x0: -133, z0: -22, x1: 106, z1: 109 }, TOWER = { x0: -21, z0: -21, x1: 21, z1: 32 };
const flightSpots = (k) => [[`flight ${k} bottom (floor ${k})`, `T.stairs[${k}].bottom`], [`flight ${k} top (floor ${k + 1})`, `T.stairs[${k}].top`], [`flight ${k} foot aisle`, `T.stairs[${k}].foot`], [`flight ${k} hall above`, `T.stairs[${k}].hall`]];
// the doors as the site leaves them (gate and vehicle gate shut, the lobby open, the four locked rooms shut)
const reset = `T.gate.lock(); T.exitGate.lock(); T.lobby.door.unlock(); T.lobby.door.setOpen(true); T.escape.gate.unlock(); T.escape.gate.setOpen(true);
  for (const d of [T.breach.door, T.trapped.door, T.command.door, T.command.escapeDoor]) d.lock(); T.elevator.closeAll();
  T.security.monitorDoor.setOpen(true); T.security.alarmDoor.setOpen(true);`;
const openGate = `${reset} T.gate.unlock(); T.gate.setOpen(true);`;
const openAll = `${openGate} for (const d of [T.breach.door, T.trapped.door, T.command.door, T.command.escapeDoor, T.exitGate]) { d.unlock(); d.setOpen(true); } for (let k = 0; k < 5; k++) T.elevator.open(k);`;

// ---------- the plaza: the west gate ----------
await run('the west gate shut: from the way up from the facility', { area: SITE, setup: reset, teardown: reset, from: 'T.approach',
  to: [['outside the gate', 'T.gateOutside'], ['inside the gate (shut)', 'T.gateInside'], ['the lobby (shut)', 'T.lobby.inside']] },
  ['inside the gate (shut)', 'the lobby (shut)']);

// ---------- from the plaza up every storey, by the stairs ----------
const up = [
  ['inside the gate', 'T.gateInside'], ['the plaza', 'T.plaza.centre'], ['the guard booth', 'T.plaza.booth'], ['the door of the tower', 'T.plaza.entrance'], ['the getaway spot', 'T.escape.car'],
  ...[0, 1, 2, 3, 4, 5].map((k) => [`beside car ${k + 1}`, `(() => { const v = T.cars[${k}]; return { x: v.x + Math.cos(v.yaw) * 2.2, z: v.z - Math.sin(v.yaw) * 2.2, y: v.y }; })()`]),
  ['the lobby, inside the door', 'T.lobby.inside'], ['the lobby centre', 'T.lobby.centre'], ['in front of the desk', 'T.lobby.desk'], ['behind the desk', 'T.lobby.reception'], ['the waiting area', 'T.lobby.waiting'], ['the exit switch', 'T.escape.switch'],
  ...[0, 1, 2, 3, 4].flatMap(flightSpots),
  ['F1 hall', 'T.security.hall'], ['F1 the monitor room', 'T.security.monitorRoom'], ['F1 at the monitors', 'T.security.monitorsAt'], ['F1 the alarm room', 'T.security.alarmRoom'], ['F1 at the alarm panel', 'T.alarmAt'], ['F1 the locker room', 'T.security.lockers'], ['F1 the office', 'T.security.office'], ['F1 by the card', 'T.card.pickAt'], ['F1 where a friend falls', 'T.escape.fallen'], ['F1 beside him', 'T.escape.fallenAt'],
  ['F2 hall', 'T.servers.hall'], ['F2 corridor', 'T.servers.corridor'], ['F2 room A', 'T.servers.rooms.A'], ['F2 room B', 'T.servers.rooms.B'], ['F2 room D', 'T.servers.rooms.D'], ['F2 Ido at the breach', 'T.breach.at'], ['F2 Ido aside', 'T.breach.aside'], ['F2 covering him', 'T.breach.cover'], ['F2 the emergency gate', 'T.escape.gateAt'], ['F2 the server room (locked)', 'T.breach.inside'],
  ['F3 hall', 'T.storage.hall'], ['F3 the aisle', 'T.storage.aisle'], ['F3 west', 'T.storage.west'], ['F3 east', 'T.storage.east'], ['F3 the loading office', 'T.storage.office'], ['F3 the store room door', 'T.trapped.at'], ['F3 inside the store room (locked)', 'T.trapped.inside'],
  ['F4 hall', 'T.command.hall'], ['F4 the anteroom', 'T.command.anteroom'], ['F4 the card reader', 'T.command.readerAt'], ['F4 at the command door', 'T.command.doorAt'], ['F4 the guard post', 'T.command.guardPost'], ['F4 the archive', 'T.command.archive'], ['F4 the command room (locked)', 'T.command.inside'], ['F4 the computer (locked)', 'T.command.computer'],
  ['the roof, out of the hut', 'T.roof.at'], ['the roof deck', 'T.roof.deck'], ['the helipad', 'T.roof.helipad'], ['the south edge', 'T.roof.edge[0]'], ['the west edge', 'T.roof.edge[1]'], ['the east edge', 'T.roof.edge[2]'],
  ...[0, 1, 2, 3, 4].flatMap((k) => [[`elevator front, floor ${k}`, `T.elevator.front[${k}]`], [`elevator inside, floor ${k} (shut)`, `T.elevator.inside[${k}]`]]),
];
await run('the gate open: from outside it, up every storey by the stairs', { area: SITE, setup: openGate, teardown: reset, from: 'T.gateOutside', to: up },
  ['F2 the server room (locked)', 'F3 inside the store room (locked)', 'F4 the command room (locked)', 'F4 the computer (locked)', ...[0, 1, 2, 3, 4].map((k) => `elevator inside, floor ${k} (shut)`)]);

// the vehicle gate, from the getaway spot with the west gate shut: the only way out to the south
await run('the vehicle gate shut: from the getaway spot', { area: SITE, setup: reset, teardown: reset, from: 'T.escape.car', to: [['the lobby door', 'T.plaza.entrance'], ['outside the vehicle gate (shut)', 'T.escape.exitOutside'], ['outside the west gate (shut)', 'T.gateOutside']] }, ['outside the vehicle gate (shut)', 'outside the west gate (shut)']);
await run('the vehicle gate open: from the getaway spot', { area: SITE, setup: `${reset} T.exitGate.unlock(); T.exitGate.setOpen(true);`, teardown: reset, from: 'T.escape.car', to: [['outside the vehicle gate', 'T.escape.exitOutside'], ['the drive south', 'T.escape.drive[2]']] });

// ---------- the locked rooms opened ----------
const opened = [
  ['F2 inside the server room', 'T.breach.inside'], ['F3 inside the store room', 'T.trapped.inside'],
  ['F4 inside the command room', 'T.command.inside'], ['F4 the arena', 'T.command.arena'], ['F4 in front of the desk', 'T.command.desk'], ['F4 the computer', 'T.command.computer'], ['F4 where the Shadow stands', 'T.command.shadowAt'], ['F4 by the window', 'T.command.window.at'],
  ...[0, 1, 2, 3, 4, 5].map((k) => [`F4 cover ${k + 1}`, `T.command.cover[${k}]`]),
  ['F4 at the emergency elevator', 'T.command.escapeAt'], ['F4 inside the emergency elevator', 'T.command.escapeInside'],
  ...[0, 1, 2, 3, 4].map((k) => [`elevator inside, floor ${k}`, `T.elevator.inside[${k}]`]),
  ['outside the vehicle gate', 'T.escape.exitOutside'], ['the getaway drive, past the gate', 'T.escape.drive[2]'],
];
await run('every door open: from the lobby', { area: SITE, setup: openAll, teardown: reset, from: 'T.lobby.centre', to: opened });

// every patrol point, with every door open
const patrolTo = await G(() => Object.entries(window.__game.debug.world.places.tower.patrols).flatMap(([k, pts]) => pts.map((p, i) => [`patrol ${k}[${i}]`, `T.patrols.${k}[${i}]`])));
await run('every patrol point', { area: SITE, setup: openAll, teardown: reset, from: 'T.lobby.centre', to: patrolTo });

// ---------- the escape (mission 45): the route down, end to end ----------
const routeLen = await G(() => window.__game.debug.world.places.tower.escape.route.length);
const routeTo = [...Array(routeLen).keys()].map((i) => [`route ${i}`, `T.escape.route[${i}]`]);
const escapeOpen = `${reset} T.command.door.unlock(); T.command.door.setOpen(true); T.escape.throwSwitch(true);`;
await run('the escape: from the command room to the car, the route walked', { area: SITE, setup: escapeOpen, teardown: `T.escape.throwSwitch(false); ${reset}`, from: 'T.escape.route[0]',
  to: [...routeTo, ['the emergency gate', 'T.escape.gateAt'], ['the fallen friend', 'T.escape.fallenAt'], ['the switch', 'T.escape.switch'], ['the getaway car', 'T.escape.car'], ['out of the vehicle gate', 'T.escape.exitOutside']] });
const gateIdx = await G(() => { const T = window.__game.debug.world.places.tower, g = T.escape.gate.pos; return T.escape.route.findIndex((p) => Math.hypot(p.x - g.x, p.z - g.z) < 1 && Math.abs(p.y - g.y) < 1); });
check('the route passes the emergency gate', gateIdx > 0, `index ${gateIdx}`);
await run('the escape: the emergency gate shut', { area: SITE, setup: `${escapeOpen} T.escape.gate.lock();`, teardown: `T.escape.throwSwitch(false); ${reset}`, from: 'T.escape.route[0]',
  to: [['before the gate', `T.escape.route[${gateIdx - 1}]`], ['the gate, its near side', 'T.escape.gateAt'], ['past the gate', `T.escape.route[${gateIdx + 1}]`], ['the lobby', 'T.lobby.centre']] },
  ['past the gate', 'the lobby']);
await run('the escape: the lobby shutter down, before the switch', { area: SITE, setup: `${reset} T.command.door.unlock(); T.command.door.setOpen(true); T.escape.throwSwitch(false);`, teardown: reset, from: 'T.escape.route[0]',
  to: [['the switch', 'T.escape.switch'], ['outside the door', 'T.plaza.entrance'], ['the car', 'T.escape.car']] },
  ['outside the door', 'the car']);

// the player's own controller (joystick forward, toward each point in turn): down the whole route to the car,
// then back up every flight to the roof and the helipad, each point reached on its own floor
const walked = await G(() => {
  const g = window.__game.debug.game, T = window.__game.debug.world.places.tower, pl = g.player, out = [];
  T.command.door.unlock(); T.command.door.setOpen(true); T.escape.throwSwitch(true);
  const go = (title, pts) => {
    pl.place(pts[0].x, pts[0].z, 0, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const q = pts[i]; let t = 0, ok = false;
      while (t < 40) { const dx = q.x - pl.pos.x, dz = q.z - pl.pos.z, d = Math.hypot(dx, dz); if (d < 0.45) { ok = true; break; } pl.update(1 / 30, { x: 0, y: Math.min(1, d) }, false, Math.atan2(-dx, -dz)); t += 1 / 30; }
      const floor = Math.abs(pl.pos.y - q.y) < 0.4;
      if (!ok || !floor) { out.push(`${title}: ${ok ? 'on the wrong floor' : 'stuck'} before point ${i} (at ${(pl.pos.x - T.x).toFixed(1)}, ${(pl.pos.z - T.z).toFixed(1)}, height ${(pl.pos.y - T.y).toFixed(1)})`); return false; }
    }
    return true;
  };
  const down = go('down', T.escape.route);
  const up = go('up', [...[...T.escape.route].reverse().slice(1), T.command.hall, { x: T.x + 15.6, z: T.z - 13.6, y: T.floorY(4) }, T.stairs[4].foot, T.stairs[4].bottom, T.stairs[4].top, T.roof.at, T.roof.deck, T.roof.helipad]);
  T.escape.throwSwitch(false); T.command.door.lock(); T.lobby.door.unlock(); T.lobby.door.setOpen(true);
  return { down, up, out, respawns: pl.respawns };
});
check('the player walks the marked route down to the getaway car', walked.down, walked.out.join(' | '));
check('the player climbs every flight from the plaza to the helipad', walked.up, walked.out.join(' | '));
check('and never falls through to a respawn', walked.respawns === 0, `${walked.respawns}`);

// the marked legs of the route and every patrol leg: a walker fits the whole straight line at its height
const legs = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, T = W.places.tower, cols = W.cols, pos = { x: 0, y: 0, z: 0 };
  for (const d of [T.command.door, T.breach.door, T.trapped.door, T.command.escapeDoor]) { d.unlock(); d.setOpen(true); }
  T.escape.throwSwitch(true);
  const blockedOn = (a, b, r = 0.3) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25); let bad = 0; for (let i = 0; i <= n; i++) { const t = i / n; pos.x = a.x + (b.x - a.x) * t; pos.z = a.z + (b.z - a.z) * t; pos.y = W.groundHeight(pos.x, pos.z, a.y + 0.3); const x = pos.x, z = pos.z; if (cols.resolve(pos, r, pos.y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02) bad++; } return bad; };
  const out = [];
  const R = T.escape.route; for (let i = 0; i + 1 < R.length; i++) if (Math.abs(R[i].y - R[i + 1].y) < 0.1) out.push([`route leg ${i}→${i + 1}`, blockedOn(R[i], R[i + 1])]);
  for (const [k, pts] of Object.entries(T.patrols)) for (let i = 0; i + 1 < pts.length; i++) out.push([`patrol leg ${k} ${i}→${i + 1}`, blockedOn(pts[i], pts[i + 1], 0.35)]);
  T.escape.throwSwitch(false); for (const d of [T.breach.door, T.trapped.door, T.command.door, T.command.escapeDoor]) d.lock();
  T.lobby.door.unlock(); T.lobby.door.setOpen(true);
  return out;
});
for (const [name, bad] of legs) check(`${name} is clear`, bad === 0, bad ? `${bad} blocked samples` : '');

// ---------- doors block when shut, and not when open ----------
const doors = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, T = W.places.tower, cols = W.cols;
  const moved = (d) => { const p = { x: d.pos.x, y: d.pos.y, z: d.pos.z }; return cols.resolve(p, 0.3, d.pos.y, g.car) && Math.hypot(p.x - d.pos.x, p.z - d.pos.z) > 0.05; };
  const out = T.doors.map((d) => { const was = d.open, wasLocked = d.locked; d.unlock(); d.setOpen(true); const open = moved(d); d.setOpen(false); const shut = moved(d); if (wasLocked) d.lock(); else { d.unlock(); d.setOpen(was); } return { label: d.label || `door at ${d.pos.x.toFixed(1)}, ${d.pos.z.toFixed(1)}`, k: d.k, open, shut }; });
  return out;
});
for (const d of doors) check(`${d.label} (floor ${d.k}) blocks when shut, not when open`, d.shut && !d.open, `shut ${d.shut ? 'blocks' : 'lets through'}, open ${d.open ? 'blocks' : 'lets through'}`);

// ---------- a closed door between floors does not block the floor above or below ----------
const stacked = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, T = W.places.tower, cols = W.cols;
  // standing above or below a shut elevator door, a storey away, nothing pushes
  const bad = [];
  for (let k = 0; k < 5; k++) { const d = T.elevator.doors[k]; for (const other of [k - 1, k + 1]) { if (other < 0 || other > 4) continue; const yy = T.floorY(other), p = { x: d.pos.x, y: yy, z: d.pos.z + 1.2 }; if (cols.resolve(p, 0.35, yy, g.car) && Math.hypot(p.x - d.pos.x, p.z - (d.pos.z + 1.2)) > 0.05) bad.push(`${k}→${other}`); } }
  return bad;
});
check('a shut elevator door blocks only its own floor', stacked.length === 0, stacked.join(', '));

// ---------- vehicles, the route's marks, the helpers ----------
const misc = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, T = W.places.tower, cols = W.cols;
  const solid = T.vehicles.map((v) => { const p = { x: v.x + 0.2, y: v.y, z: v.z + 0.2 }; return cols.resolve(p, 0.3, v.y, g.car); });
  const cars = T.cars.length, blows = T.cars.every((v) => typeof v.wreck === 'function' && typeof v.reset === 'function');
  T.cars[0].wreck(); const wrecked = T.cars[0].wrecked; T.cars[0].reset();
  T.escape.mark(true); const marked = T.escape.marked; T.escape.mark(false);
  const f = T.floors.map((fl) => T.floorOf(fl.y + 0.2));
  const near = T.near(T.stairs[1].top, { ...T.stairs[1].top, y: T.stairs[1].top.y - 4.4 }, 3);
  const idx = T.escape.routeIndex(T.stairs[2].top);
  T.alarm.set(false); const alarmOff = !T.alarm.on; T.alarm.set(true);
  T.card.take(); const taken = T.card.taken && !T.card.mesh.visible; T.card.reset();
  for (const m of ['off', 'cams', 'alarm', 'shadow', 'data', 'map']) T.command.screen.show(m, { progress: 0.5 }); T.command.screen.show('off');
  const lamps = T.lamps.length, inside = T.lamps.filter((l) => T.inTower(l.x, l.z) && l.y < T.floorY(5)).length;
  return { solid, cars, blows, wrecked, marked, f, near, idx, alarmOff, taken, lamps, inside, routeY: T.escape.route.every((p) => typeof p.y === 'number'), patrolY: Object.values(T.patrols).every((pts) => pts.every((p) => typeof p.y === 'number')) };
});
check('every vehicle blocks', misc.solid.every(Boolean), misc.solid.map((b, i) => (b ? '' : i)).filter(String).join(','));
check('cars that can blow: wreck() and reset()', misc.cars >= 4 && misc.blows && misc.wrecked, `${misc.cars} cars`);
check('the route can be marked', misc.marked);
check('floorOf finds each floor', misc.f.join(',') === '0,1,2,3,4,5', misc.f.join(','));
check('near() tells floors apart', misc.near === false);
check('routeIndex finds the route point on the right floor', misc.idx >= 0 && misc.idx === (await G(() => { const T = window.__game.debug.world.places.tower; return T.escape.route.findIndex((p) => p.x === T.stairs[2].top.x && p.z === T.stairs[2].top.z && p.y === T.stairs[2].top.y); })), `index ${misc.idx}`);
check('the alarm switches off and on', misc.alarmOff);
check('the card is taken and put back', misc.taken);
check('every route point and patrol point has its y', misc.routeY && misc.patrolY);
check('the lamps: few, with two to a storey inside', misc.lamps <= 24 && misc.inside === 10, `${misc.lamps} lamps, ${misc.inside} inside`);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
