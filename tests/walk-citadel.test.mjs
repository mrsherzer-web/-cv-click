// Walkability of chapter ten's citadel (src/world/citadel.js, citadel-tower.js): can a player on foot get to
// every place a mission sends him, on that place's own floor, along the story's order — the service gate, the
// yard, the lift down, the tunnels up into the inner compound, the inner gate, control room B, the bridges, the
// tower bridge, every hall of the central tower, the way out to the armoured car? A flood fill over a half-metre
// grid with the player's own collision test that follows the ground at the walker's own height, with the gates
// and doors in the state each case sets. Then the lift ridden and the way out walked with the player's own
// controller, the tower bridge with every segment dropped in turn, every patrol point and leg, every door,
// destroy() and restore(), and the draw calls from the yard and the last hall.
// Usage: node tests/walk-citadel.test.mjs [distDir]
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
ctx.setDefaultTimeout(300000);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', mp4: 'video/mp4' };
await page.route(/^http:\/\/game\.local\//, async (r) => { let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p === '/') p = '/play.html'; try { const body = await fs.promises.readFile(path.join(ROOT, p)); r.fulfill({ status: 200, body, headers: { 'content-type': MIME[p.split('.').pop()] || 'application/octet-stream' } }); } catch { r.fulfill({ status: 404, body: '' }); } });
await page.goto('http://game.local/play.html');
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);
await G(() => { window.__game.debug.game.hold = true; });
check('the citadel is built', await G(() => { const Z = window.__game.debug.world.places.citadel; return !!Z?.towerBridge?.segments?.length && !!Z.tower && !!Z.wayOut; }));
check('it stands in its box (x 1440..1780, z 30..280) on the plain', await G(() => { const Z = window.__game.debug.world.places.citadel; return Z.x === 1610 && Z.z === 155 && Z.box.x0 === 1440 && Z.box.x1 === 1780 && Z.box.z0 === 30 && Z.box.z1 === 280 && Math.abs(Z.y + 50) < 4 && Z.gates.main.at.x === 1440 && Z.gates.main.at.z === 95 && Z.gates.service.at.z === 235; }));
check('as the site leaves it: both gates, the inner gate, the service door and every way into the tower locked; the stores, the alarm room and control room B open; the lift up, without power', await G(() => {
  const Z = window.__game.debug.world.places.citadel;
  return Z.gates.main.locked && !Z.gates.main.isOpen && Z.gates.service.locked && Z.innerGate.locked && Z.wayOut.doors[1].door.locked && Z.mainHall.door.locked && Z.energyHall.door.locked && Z.machine.upperDoor.locked && Z.lastHall.exit.door.locked
    && Z.stores.doors.every((d) => d.open) && Z.alarm.door.open && Z.control.doors.every((d) => d.open) && Z.lift.state === 'top' && !Z.lift.power && !Z.alarm.active && !Z.destroyed;
}));

// one fill: c = { setup, teardown (code with Z = the citadel, W = world, g = game), from (expr, with y), to: [[name, expr]] }.
// A target counts when a cell within 1.5 m of it was reached at its height (within a metre).
const AREA = { x0: -200, z0: -128, x1: 172, z1: 128 };
const walk = (c) => page.evaluate(({ c, a }) => {
  const g = window.__game.debug.game, W = window.__game.debug.world, Z = W.places.citadel, cols = W.cols, R = 0.35, S = 0.5;
  const run = (code) => code && new Function('Z', 'W', 'g', code)(Z, W, g);
  const E = (expr) => new Function('Z', `return (${expr});`)(Z);
  run(c.setup);
  const x0 = Z.x + a.x0, z0 = Z.z + a.z0, nx = Math.round((a.x1 - a.x0) / S) + 1, nz = Math.round((a.z1 - a.z0) / S) + 1;
  const pos = { x: 0, y: 0, z: 0 }, free = new Map();
  const isFree = (i, j, y) => { const k = (i * nz + j) * 64 + Math.max(0, Math.min(63, Math.round((y + 80) / 2))); if (free.has(k)) return free.get(k); const x = x0 + i * S, z = z0 + j * S; pos.x = x; pos.y = y; pos.z = z; const hit = cols.resolve(pos, R, y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02; free.set(k, !hit); return !hit; };
  const from = E(c.from), seen = new Map(), q = [];
  const keyOf = (i, j, y) => (i * nz + j) * 64 + Math.max(0, Math.min(63, Math.round((y + 70) / 1.25)));
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
}, { c, a: AREA });
const run = async (title, c, shut = []) => {
  const r = await walk(c);
  for (const [name] of c.to) { const want = shut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
  return r;
};
// the doors and the lift as the site leaves them
const reset = `Z.restore(); Z.gates.main.lock(); Z.gates.service.lock(); Z.innerGate.lock(); Z.wayOut.throwSwitch(0, false); Z.wayOut.throwSwitch(1, false);
  for (const d of [Z.mainHall.door, Z.energyHall.door, Z.machine.upperDoor]) d.lock();
  for (const d of [...Z.stores.doors, Z.alarm.door, ...Z.control.doors]) { d.unlock(); d.setOpen(true); }
  Z.towerBridge.restore(); Z.wayOut.leap.guard(true); Z.lift.setPower(false); Z.lift.set('top'); Z.alarm.on(false);`;
const list = (n, f) => [...Array(n).keys()].map(f);
const N = await G(() => { const Z = window.__game.debug.world.places.citadel; return { vehicles: Z.vehicles.length, pillars: Z.mainHall.pillars.length, cover: Z.mainHall.cover.length, cells: Z.energyHall.cells.length, rifts: Z.lastHall.rifts.length, reactors: Z.energy.reactors.length, pylons: Z.energy.pylons.length, route: Z.wayOut.route.length, leap: Z.wayOut.leapIndex, segs: Z.towerBridge.n, blasts: Z.wayOut.blasts.length, friends: Z.lastHall.friends.length }; });

// ---------- 1. the gates shut: nobody gets in ----------
await run('both gates shut: from the service road', { setup: reset, teardown: reset, from: 'Z.gates.service.approach',
  to: [['outside the service gate', 'Z.gates.service.outside'], ['outside the main gate', 'Z.gates.main.outside'], ['inside the service gate (shut)', 'Z.gates.service.inside'], ['inside the main gate (shut)', 'Z.gates.main.inside']] },
  ['inside the service gate (shut)', 'inside the main gate (shut)']);

// ---------- 2. the service gate open: the yard, its rooms, the two western watch towers ----------
const towerSpots = (k) => [[`watch tower ${k}: the stairs' foot`, `Z.towers[${k}].foot`], [`watch tower ${k}: the landing`, `Z.towers[${k}].landing`], [`watch tower ${k}: the top of the stairs`, `Z.towers[${k}].top`], [`watch tower ${k}: the post`, `Z.towers[${k}].post`], [`watch tower ${k}: the lookout`, `Z.towers[${k}].look`]];
const yard = [
  ['inside the service gate', 'Z.gates.service.inside'], ['inside the main gate', 'Z.gates.main.inside'], ['the yard', 'Z.yard.centre'], ['the containers', 'Z.yard.containers'], ['the tanks', 'Z.yard.tanks'], ['the crane', 'Z.yard.crane'],
  ...list(N.vehicles, (k) => [`beside vehicle ${k + 1}`, `Z.vehicles[${k}].near`]),
  ['the alarm room door', 'Z.alarm.doorAt'], ['the alarm room', 'Z.alarm.room'], ['at the alarm panel', 'Z.alarm.panelAt'],
  ...list(4, (k) => [`in front of store ${k + 1}`, `Z.stores.fronts[${k}]`]), ...list(4, (k) => [`inside store ${k + 1}`, `Z.stores.rooms[${k}]`]),
  ['at the lift power switch', 'Z.lift.switchAt'], ['at the alarm fuses', 'Z.alarm.fuseAt'],
  ['in front of the lift', 'Z.lift.topAt'], ['on the lift platform', 'Z.lift.onTop'],
  ['the vehicle bay', 'Z.armoured.bay'], ['the armoured car spot', 'Z.armoured.spot'], ['beside the armoured car', 'Z.armoured.boardAt'],
  ['the inner gate, yard side', 'Z.innerGate.outside'], ...towerSpots(0), ...towerSpots(1),
  ['the inner gate, inner side (shut)', 'Z.innerGate.inside'], ['the tunnels (lift up)', 'Z.tunnels.lobby'], ['the tower door (shut)', 'Z.mainHall.outside'],
];
await run('the service gate open: from outside it', { setup: `${reset} Z.gates.service.open();`, teardown: reset, from: 'Z.gates.service.outside', to: yard },
  ['the inner gate, inner side (shut)', 'the tunnels (lift up)', 'the tower door (shut)']);
await run('the main gate open: from outside it', { setup: `${reset} Z.gates.main.open();`, teardown: reset, from: 'Z.gates.main.outside', to: [['inside the main gate', 'Z.gates.main.inside'], ['the alarm room', 'Z.alarm.room'], ['in front of the lift', 'Z.lift.topAt']] });

// ---------- 3. the lift: no power, then a real ride down and up with the player's own controller ----------
const ride = await G(() => {
  const W = window.__game, g = W.debug.game, Z = W.debug.world.places.citadel, pl = g.player, cam = W.debug.camera, L = Z.lift, out = { notes: [] };
  const step = (n) => { for (let i = 0; i < n; i++) { Z.tick(cam, 1 / 30); pl.update(1 / 30, { x: 0, y: 0 }, false, null); } };
  const walkTo = (q) => { let t = 0; while (t < 30) { const dx = q.x - pl.pos.x, dz = q.z - pl.pos.z, d = Math.hypot(dx, dz); if (d < 0.45) return true; Z.tick(cam, 1 / 30); pl.update(1 / 30, { x: 0, y: Math.min(1, d) }, false, Math.atan2(-dx, -dz)); t += 1 / 30; } return false; };
  L.setPower(false); L.set('top');
  out.refused = L.go('down') === false && L.call('bottom') === false;
  pl.place(L.topAt.x, L.topAt.z, 0, L.topAt.y);
  out.walkedOn = walkTo(L.onTop) && L.has(pl.pos);
  L.setPower(true); out.started = L.go('down') === true && L.state === 'moving';
  let arrived = null; L.onArrive = (s) => { arrived = s; };
  step(30); out.midDown = +(pl.pos.y - Z.y).toFixed(2); out.midOn = L.has(pl.pos);
  step(140); out.downY = +(pl.pos.y - Z.y).toFixed(2); out.downState = L.state; out.arrived = arrived;
  out.walkedOff = walkTo(L.bottomAt); out.offY = +(pl.pos.y - Z.y).toFixed(2);
  out.lobby = walkTo(Z.tunnels.lobby);
  // back on, and up
  out.backOn = walkTo(L.bottomAt) && walkTo(L.onBottom);
  out.up = L.go('up'); step(30); out.midUp = +(pl.pos.y - Z.y).toFixed(2); step(140);
  out.upY = +(pl.pos.y - Z.y).toFixed(2); out.upState = L.state;
  out.offTop = walkTo(L.topAt);
  // called from below while it is up: it comes down empty, the gate at the bottom opens
  out.call = L.call(Z.tunnels.lobby); step(170); out.callState = L.state; out.gates = L.gates.bottom.open && !L.gates.top.open;
  out.respawns = pl.respawns;
  L.onArrive = null; L.setPower(false); L.set('top');
  return out;
});
check('the lift refuses to move without power', ride.refused);
check('the player walks onto the platform in the yard', ride.walkedOn);
check('with power it goes down, the player standing on it rides with it', ride.started && ride.midOn && ride.midDown < -0.8 && ride.midDown > -5.5, `after a second: ${ride.midDown} m`);
check('it arrives at the tunnels (about 6 m down) and says so', ride.downState === 'bottom' && ride.arrived === 'bottom' && Math.abs(ride.downY + 5.88) < 0.1, `player at ${ride.downY} m, ${ride.downState}`);
check('the player walks off it into the tunnels', ride.walkedOff && Math.abs(ride.offY + 6) < 0.1 && ride.lobby, `at ${ride.offY} m`);
check('and rides it back up to the yard', ride.backOn && ride.up && ride.midUp > -5.5 && ride.midUp < -0.8 && ride.upState === 'top' && Math.abs(ride.upY) < 0.05 && ride.offTop, `mid ${ride.midUp} m, top ${ride.upY} m`);
check('called from below, it comes down and opens the lower gate only', ride.call && ride.callState === 'bottom' && ride.gates);
check('nobody fell through the world on the lift', ride.respawns === 0, `${ride.respawns}`);

// ---------- 4. from the lift at the bottom: the tunnels, up into the inner compound, everything on the ground there ----------
const inner = [
  ['the tunnels: the lobby', 'Z.tunnels.lobby'], ...list(3, (k) => [`the north way ${k}`, `Z.tunnels.north[${k}]`]), ...list(3, (k) => [`the south way ${k}`, `Z.tunnels.south[${k}]`]), ['the cross passage', 'Z.tunnels.cross'],
  ['the north stairs: foot', 'Z.tunnels.exits.north.foot'], ['the north stairs: top, in the inner compound', 'Z.tunnels.exits.north.top'], ['the south stairs: foot', 'Z.tunnels.exits.south.foot'], ['the south stairs: top', 'Z.tunnels.exits.south.top'],
  ['the inner gate, inner side', 'Z.innerGate.inside'], ['at wheel A', 'Z.innerGate.wheelAAt'], ['at wheel B', 'Z.innerGate.wheelBAt'], ...list(2, (k) => [`inner gate cover ${k}`, `Z.innerGate.cover[${k}]`]),
  ['control room B', 'Z.control.room'], ['at the main computer', 'Z.computer.at'],
  ...list(3, (k) => [`control door ${k}: outside`, `Z.control.approaches[${k}].outside`]), ...list(3, (k) => [`control door ${k}: inside`, `Z.control.approaches[${k}].inside`]), ...list(3, (k) => [`control door ${k}: the defender's post`, `Z.control.approaches[${k}].post`]), ...list(3, (k) => [`control door ${k}: where they come from`, `Z.control.approaches[${k}].from`]),
  ['the plant house', 'Z.plant.room'], ['the plant roof (+7)', 'Z.plant.roof'], ['the control roof (+7)', 'Z.control.roof'], ['bridge A, the tower end (+7)', 'Z.bridges.a[1]'], ['bridge B, the plant side of the gap', 'Z.wayOut.leap.to'],
  ['the bridgehead: foot (+7)', 'Z.towerBridge.head.foot'], ['the bridgehead: top (+14)', 'Z.towerBridge.head.top'], ['the tower bridge: start', 'Z.towerBridge.start'], ['the tower bridge: the ledge at the upper door', 'Z.towerBridge.end'],
  ...list(N.reactors, (k) => [`at reactor ${k}`, `Z.energy.reactors[${k}].at`]), ['the forecourt', 'Z.energy.forecourt'], ['the energy field', 'Z.energy.field'],
  ['the tower door, outside', 'Z.mainHall.outside'], ...towerSpots(2), ...towerSpots(3),
  ['the fallen friend (way out)', 'Z.wayOut.fallenAt'], ['the service door switch', 'Z.wayOut.doors[1].switchAt'],
  ['the yard (inner gate shut)', 'Z.innerGate.outside'], ['the main hall (shut)', 'Z.mainHall.inside'], ['the energy hall (shut)', 'Z.energyHall.doorInside'], ['the machine room (shut)', 'Z.machine.doorInside'], ['bridge B, the tower side of the gap', 'Z.wayOut.leap.from'],
];
await run('the lift down: from in front of it in the tunnels', { setup: `${reset} Z.lift.set('bottom');`, teardown: reset, from: 'Z.lift.bottomAt', to: inner },
  ['the yard (inner gate shut)', 'the main hall (shut)', 'the energy hall (shut)', 'the machine room (shut)', 'bridge B, the tower side of the gap']);
await run('the inner gate opened from inside: from the yard', { setup: `${reset} Z.gates.service.open(); Z.innerGate.open();`, teardown: reset, from: 'Z.gates.service.inside', to: [['the inner gate, inner side', 'Z.innerGate.inside'], ['at the main computer', 'Z.computer.at'], ['the tower door', 'Z.mainHall.outside'], ['the tunnels, down the north stairs', 'Z.tunnels.north[1]']] });

// ---------- 5. the central tower: the main hall by its door, up to the energy hall; the bridges; the machine room; the last hall ----------
const hall0 = [
  ['inside the door', 'Z.mainHall.inside'], ['the centre', 'Z.mainHall.centre'], ['before the screen', 'Z.mainHall.screenAt'], ['where the Shadow stands', 'Z.mainHall.shadowAt'], ['Erez', 'Z.mainHall.erezAt'], ['the portal spot', 'Z.mainHall.portalAt'],
  ...list(N.pillars, (k) => [`holding pillar ${k}`, `Z.mainHall.pillars[${k}].holdAt`]), ...list(N.cover, (k) => [`behind low cover ${k}`, `Z.mainHall.cover[${k}].behind`]),
  ...list(3, (k) => [`at control node ${k}`, `Z.mainHall.defence.nodes[${k}].at`]), ['at the first-aid box', 'Z.mainHall.medkitAt'], ['where the marker lands', 'Z.mainHall.markerAt'], ['at the wall he is thrown against', 'Z.mainHall.thrownAt'], ['the stairs', 'Z.mainHall.stairsAt'],
  ['the energy hall: the top of the stairs', 'Z.energyHall.stairsTop'], ['the energy hall: centre', 'Z.energyHall.centre'], ['the energy hall: inside its door', 'Z.energyHall.doorInside'],
  ...list(N.cells, (k) => [`beside energy cell ${k}`, `({ x: Z.energyHall.cells[${k}].x + 1.6, z: Z.energyHall.cells[${k}].z, y: Z.energyHall.cells[${k}].y })`]),
  ['the machine room (no way inside)', 'Z.machine.centre'], ['the last hall (no way inside)', 'Z.lastHall.centre'],
];
await run('the tower door open: from the forecourt', { setup: `${reset} Z.mainHall.door.unlock(); Z.mainHall.door.setOpen(true);`, teardown: reset, from: 'Z.mainHall.outside', to: hall0 }, ['the machine room (no way inside)', 'the last hall (no way inside)']);
const upper = [
  ['bridge A', 'Z.energyHall.doorOutside'], ['the control roof', 'Z.control.roof'], ['the bridgehead: top', 'Z.towerBridge.head.top'], ['the tower bridge: start', 'Z.towerBridge.start'], ...list(N.segs, (k) => [`tower bridge segment ${k}`, `Z.towerBridge.segments[${k}].centre`]),
  ['the ledge', 'Z.towerBridge.end'], ['outside the upper door', 'Z.machine.doorOutside'], ['inside the upper door', 'Z.machine.doorInside'], ['the machine room', 'Z.machine.centre'], ["at Muller's console", 'Z.machine.consoleAt'], ['at the energy source', 'Z.machine.sourceAt'], ['the counter-portal spot', 'Z.machine.portalAt'],
  ...list(3, (k) => [`machine approach ${k}: outside`, `Z.machine.approaches[${k}].outside`]), ...list(3, (k) => [`machine approach ${k}: the doorway`, `Z.machine.approaches[${k}].door`]), ...list(3, (k) => [`machine approach ${k}: the post`, `Z.machine.approaches[${k}].post`]), ...list(3, (k) => [`machine approach ${k}: where they come from`, `Z.machine.approaches[${k}].from`]),
  ['the stairs to the last hall', 'Z.machine.stairsAt'], ['the last hall: entry', 'Z.lastHall.entry'], ['the last hall: centre', 'Z.lastHall.centre'], ['before the engine', 'Z.lastHall.engineAt'], ['the fist-fight spot', 'Z.lastHall.duel'], ['the portal anchor', 'Z.lastHall.portalAt'],
  ['landing: Nehorai', 'Z.lastHall.landing.nehorai'], ['landing: Erez', 'Z.lastHall.landing.erez'], ['the Shadow', 'Z.lastHall.shadowAt'], ...list(N.friends, (k) => [`friend ${k}`, `Z.lastHall.friends[${k}]`]),
  ['generator 0 (to shoot): a line on it', 'Z.lastHall.generators[0].from'], ['generator 1: at its console', 'Z.lastHall.generators[1].consoleAt'], ['generator 2: the lure spot', 'Z.lastHall.generators[2].lureAt'],
  ...list(N.rifts, (k) => [`rift ${k}`, `Z.lastHall.rifts[${k}]`]), ['at the emergency door switch', 'Z.lastHall.exit.switchAt'], ['inside the emergency door', 'Z.lastHall.exit.inside'], ['the fire stairs (door shut)', 'Z.lastHall.exit.outside'],
];
await run('the energy hall door and the upper door open: from the energy hall', { setup: `${reset} for (const d of [Z.energyHall.door, Z.machine.upperDoor]) { d.unlock(); d.setOpen(true); }`, teardown: reset, from: 'Z.energyHall.centre', to: upper }, ['the fire stairs (door shut)']);

// ---------- 6. the tower bridge: a segment falls, the catwalk and the leap spots still connect ----------
const dropOne = await G(() => {
  const W = window.__game.debug.world, Z = W.places.citadel, g = window.__game.debug.game, B = Z.towerBridge, out = [];
  for (const s of B.segments) {
    const before = W.groundHeight(s.centre.x, s.centre.z, s.centre.y);
    const ok = B.drop(s.i, true), after = W.groundHeight(s.centre.x, s.centre.z, s.centre.y);
    const p = { x: s.centre.x, y: s.centre.y, z: s.centre.z }; const barred = W.cols.resolve(p, 0.35, s.centre.y, g.car);
    const again = B.drop(s.i, true), at = B.segmentAt(s.centre);
    B.restore(s.i);
    out.push({ i: s.i, ok: ok && !again && Math.abs(before - s.centre.y) < 0.01 && after < s.centre.y - 10 && barred && at === s.i && Math.abs(W.groundHeight(s.centre.x, s.centre.z, s.centre.y) - s.centre.y) < 0.01 && !s.dropped, before, after });
  }
  return out;
});
check('drop(i) takes each segment\'s walking surface away (the ground below is what is left), bars the hole, and restore(i) puts it back', dropOne.every((s) => s.ok), dropOne.filter((s) => !s.ok).map((s) => s.i).join(','));
for (const i of [0, 3, 7]) {
  await run(`segment ${i} dropped: from the bridgehead`, { setup: `${reset} Z.towerBridge.drop(${i}, true);`, teardown: reset, from: 'Z.towerBridge.start',
    to: [['the leap spot before the gap', `Z.towerBridge.segments[${i}].from`], ['the leap spot after the gap', `Z.towerBridge.segments[${i}].to`], ['the ledge at the upper door', 'Z.towerBridge.end'], ['the catwalk', 'Z.towerBridge.detour.catwalk[1]'], ['the fallen segment (gone)', `Z.towerBridge.segments[${i}].centre`]] },
    ['the fallen segment (gone)']);
}
await run('every segment dropped: from the bridgehead, by the catwalk', { setup: `${reset} for (let i = 0; i < Z.towerBridge.n; i++) Z.towerBridge.drop(i, true);`, teardown: reset, from: 'Z.towerBridge.start', to: [['the ledge at the upper door', 'Z.towerBridge.end'], ['the catwalk\'s far end', 'Z.towerBridge.detour.catwalk[1]']] });

// ---------- 7. the way out: the last hall down to the armoured car ----------
const routeTo = (a, b) => list(b - a, (k) => [`route ${a + k}`, `Z.wayOut.route[${a + k}]`]);
const outOpen = `${reset} Z.wayOut.throwSwitch(0, true); Z.wayOut.throwSwitch(1, true); Z.gates.service.open();`;
await run('the emergency door shut: from the last hall', { setup: reset, teardown: reset, from: 'Z.lastHall.centre', to: [['its switch', 'Z.wayOut.doors[0].switchAt'], ['the fire stairs (shut)', 'Z.wayOut.route[1]']] }, ['the fire stairs (shut)']);
await run('both switches thrown: from the last hall to the gap', { setup: outOpen, teardown: reset, from: 'Z.wayOut.route[0]',
  to: [...routeTo(0, N.leap + 1), ['the leap spot', 'Z.wayOut.leap.from'], ['across the gap (a leap, not a walk)', 'Z.wayOut.leap.to'], ['the armoured car (not without the leap)', 'Z.armoured.boardAt']] },
  ['across the gap (a leap, not a walk)', 'the armoured car (not without the leap)']);
await run('both switches thrown: from across the gap to the armoured car and out', { setup: outOpen, teardown: reset, from: 'Z.wayOut.leap.to',
  to: [...routeTo(N.leap + 1, N.route), ['the fallen friend', 'Z.wayOut.fallenAt'], ['the service door switch', 'Z.wayOut.doors[1].switchAt'], ['the vehicle bay', 'Z.armoured.bay'], ['the armoured car', 'Z.armoured.boardAt'], ['outside the service gate', 'Z.gates.service.outside'], ...list(6, (k) => [`the drive out ${k}`, `Z.armoured.route[${k}]`])] });
await run('the service door shut: from across the gap', { setup: `${outOpen} Z.wayOut.throwSwitch(1, false);`, teardown: reset, from: 'Z.wayOut.leap.to', to: [['the fallen friend', 'Z.wayOut.fallenAt'], ['its switch', 'Z.wayOut.doors[1].switchAt'], ['before the door', 'Z.wayOut.doors[1].before'], ['past the door (shut)', 'Z.wayOut.doors[1].after'], ['the armoured car (shut)', 'Z.armoured.boardAt']] }, ['past the door (shut)', 'the armoured car (shut)']);
await run('the blast spots along the way out', { setup: `${outOpen} Z.innerGate.open(); Z.mainHall.door.unlock(); Z.mainHall.door.setOpen(true); for (const d of [Z.energyHall.door, Z.machine.upperDoor]) { d.unlock(); d.setOpen(true); }`, teardown: reset, from: 'Z.wayOut.leap.to', to: list(N.blasts, (k) => [`blast ${k}`, `Z.wayOut.blasts[${k}]`]) });

// the player's own controller down the whole way out (the leap done by placing him across the gap)
const walked = await G(() => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, pl = g.player, out = [];
  Z.wayOut.throwSwitch(0, true); Z.wayOut.throwSwitch(1, true); Z.gates.service.open();
  const go = (title, pts) => {
    pl.place(pts[0].x, pts[0].z, 0, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const q = pts[i]; let t = 0, ok = false;
      while (t < 60) { const dx = q.x - pl.pos.x, dz = q.z - pl.pos.z, d = Math.hypot(dx, dz); if (d < 0.45) { ok = true; break; } pl.update(1 / 30, { x: 0, y: Math.min(1, d) }, false, Math.atan2(-dx, -dz)); t += 1 / 30; }
      const floor = Math.abs(pl.pos.y - q.y) < 0.4;
      if (!ok || !floor) { out.push(`${title}: ${ok ? 'on the wrong floor' : 'stuck'} before point ${i} (at ${(pl.pos.x - Z.x).toFixed(1)}, ${(pl.pos.z - Z.z).toFixed(1)}, height ${(pl.pos.y - Z.y).toFixed(1)})`); return false; }
    }
    return true;
  };
  const R = Z.wayOut.route, k = Z.wayOut.leapIndex;
  const a = go('to the gap', R.slice(0, k + 1));
  // walking on from the edge: the bars hold him there, he does not drop into the hole
  for (let t = 0; t < 90; t++) pl.update(1 / 30, { x: 0, y: 1 }, false, Math.PI / 2);
  const held = Math.abs(pl.pos.y - Z.wayOut.leap.from.y) < 0.3 && pl.pos.x > Z.wayOut.leap.to.x + 3;
  const b = go('from the gap', R.slice(k + 1));
  const up = go('up the tower by the bridges', [Z.towerBridge.head.foot, Z.towerBridge.head.stairs.bottom, Z.towerBridge.head.stairs.top, Z.towerBridge.start, Z.towerBridge.end]);
  const hall = (() => { Z.mainHall.door.unlock(); Z.mainHall.door.setOpen(true); return go('the main hall up to the energy hall', [Z.mainHall.outside, Z.mainHall.inside, Z.mainHall.stairsAt, Z.tower.stairs[0].bottom, Z.tower.stairs[0].top, Z.energyHall.stairsTop, Z.energyHall.centre]); })();
  const watch = go('up a watch tower', [Z.towers[1].foot, Z.towers[1].landing, Z.towers[1].top, Z.towers[1].post]);
  return { a, b, held, up, hall, watch, out, respawns: pl.respawns };
});
check('the player walks the way out from the last hall to the gap', walked.a, walked.out.join(' | '));
check('at the gap the bars hold him on the edge', walked.held);
check('and from across the gap down the plant stairs, through the service door and the yard to the armoured car', walked.b, walked.out.join(' | '));
check('the player climbs the bridgehead and crosses the tower bridge', walked.up, walked.out.join(' | '));
check('the player climbs from the main hall to the energy hall', walked.hall, walked.out.join(' | '));
check('the player climbs a watch tower to its post', walked.watch, walked.out.join(' | '));
check('and never falls through to a respawn', walked.respawns === 0, `${walked.respawns}`);
await G((code) => new Function('Z', code)(window.__game.debug.world.places.citadel), reset);

// ---------- 8. every patrol point on walkable ground on its floor, every patrol leg clear ----------
const openAll = `${reset} Z.gates.service.open(); Z.gates.main.open(); Z.innerGate.open(); Z.wayOut.throwSwitch(0, true); Z.wayOut.throwSwitch(1, true); Z.wayOut.leap.guard(true);
  for (const d of [Z.mainHall.door, Z.energyHall.door, Z.machine.upperDoor]) { d.unlock(); d.setOpen(true); } Z.lift.set('bottom');`;
const patrolTo = await G(() => Object.entries(window.__game.debug.world.places.citadel.patrols).flatMap(([k, pts]) => pts.map((p, i) => [`patrol ${k}[${i}]`, `Z.patrols.${k}[${i}]`])));
const all = await run('every door open, the lift down: every patrol point, from the service gate', { setup: openAll, teardown: reset, from: 'Z.gates.service.outside', to: [...patrolTo, ['the last hall', 'Z.lastHall.centre'], ['the tunnels', 'Z.tunnels.lobby'], ['outside the main gate', 'Z.gates.main.outside']] });
console.log(`      (${all.cells} cells walked)`);
const legs = await G((openAll) => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Z = W.places.citadel, cols = W.cols, pos = { x: 0, y: 0, z: 0 };
  new Function('Z', openAll)(Z);
  const blockedOn = (a, b, r = 0.35) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25); let bad = 0; for (let i = 0; i <= n; i++) { const t = i / n; pos.x = a.x + (b.x - a.x) * t; pos.z = a.z + (b.z - a.z) * t; pos.y = W.groundHeight(pos.x, pos.z, a.y + 0.3); const x = pos.x, z = pos.z; if (Math.abs(pos.y - a.y) > 0.45 || (cols.resolve(pos, r, pos.y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.02)) bad++; } return bad; };
  const out = [];
  for (const [k, pts] of Object.entries(Z.patrols)) { if (pts.some((p) => typeof p.y !== 'number')) out.push([`patrol ${k} has its y`, 1]); for (let i = 0; i + 1 < pts.length; i++) out.push([`patrol leg ${k} ${i}→${i + 1}`, blockedOn(pts[i], pts[i + 1])]); }
  const R = Z.wayOut.route; for (let i = 0; i + 1 < R.length; i++) if (i !== Z.wayOut.leapIndex && Math.abs(R[i].y - R[i + 1].y) < 0.1) out.push([`way-out leg ${i}→${i + 1}`, blockedOn(R[i], R[i + 1], 0.3)]);
  return out;
}, openAll);
for (const [name, bad] of legs) check(`${name} is clear and level`, bad === 0, bad ? `${bad} blocked samples` : '');
await G((code) => new Function('Z', code)(window.__game.debug.world.places.citadel), reset);

// ---------- 9. doors block when shut, and not when open ----------
const doors = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, Z = W.places.citadel, cols = W.cols;
  const moved = (d) => { const p = { x: d.pos.x, y: d.pos.y, z: d.pos.z }; return cols.resolve(p, 0.3, d.pos.y, g.car) && Math.hypot(p.x - d.pos.x, p.z - d.pos.z) > 0.05; };
  return Z.doors.map((d) => { const was = d.open, wasLocked = d.locked; d.unlock(); d.setOpen(true); const open = moved(d); d.setOpen(false); const shut = moved(d); if (wasLocked) d.lock(); else { d.unlock(); d.setOpen(was); } return { label: d.label || `door at ${(d.pos.x - Z.x).toFixed(1)}, ${(d.pos.z - Z.z).toFixed(1)}`, open, shut }; });
});
check(`all ${doors.length} doors and gates block when shut and not when open`, doors.every((d) => d.shut && !d.open), doors.filter((d) => !d.shut || d.open).map((d) => `${d.label}: shut ${d.shut ? 'blocks' : 'lets through'}, open ${d.open ? 'blocks' : 'lets through'}`).join(' | '));
const gatesApi = await G(() => { const Z = window.__game.debug.world.places.citadel, out = []; for (const gt of [Z.gates.main, Z.gates.service, Z.innerGate]) { const a = gt.locked && !gt.isOpen; gt.open(); const b = !gt.locked && gt.isOpen; gt.shut(); const c = !gt.isOpen; gt.locked = true; out.push(a && b && c && gt.locked && typeof gt.outside.y === 'number'); } Z.innerGate.spin(0, 1.2); out.push(Z.innerGate.wheels[0].rotation.z === 1.2 && !!Z.innerGate.wheelA && !!Z.innerGate.wheelB); Z.innerGate.spin(0, 0); return out; });
check('gates.main, gates.service and innerGate: open(), shut(), locked; the inner gate\'s wheels turn', gatesApi.every(Boolean), gatesApi.join(','));

// ---------- 10. the things a mission switches ----------
const misc = await G(() => {
  const W = window.__game, g = W.debug.game, world = W.debug.world, Z = world.places.citadel, cols = world.cols, cam = W.debug.camera;
  const solid = Z.vehicles.map((v) => { const p = { x: v.x + 0.2, y: v.y, z: v.z + 0.2 }; return cols.resolve(p, 0.3, v.y, g.car); });
  const blows = Z.vehicles.every((v) => v.blows && typeof v.wreck === 'function' && typeof v.reset === 'function' && typeof v.at.y === 'number');
  Z.vehicles[0].wreck(); const wrecked = Z.vehicles[0].wrecked; Z.vehicles[0].reset();
  Z.alarm.on(true); Z.tick(cam, 0.1); const alarmOn = Z.alarm.active; Z.alarm.on(false);
  for (const m of ['shadow', 'alert', 'map', 'data', 'portal', 'engine', 'static', 'text', 'off']) { Z.screen.show(m, { progress: 0.5, title: 'א' }); Z.computer.screen.show(m, { progress: 0.3 }); }
  const screenOk = Z.screen.mode === 'off';
  for (const m of ['off', 'idle', 'on', 'overload', 'dead', 'idle']) Z.lastHall.engine.set(m);
  const gens = Z.lastHall.generators.map((x) => { x.set(false); const d = !x.live; x.set(true); return d && x.live && typeof x.y === 'number'; }).every(Boolean) && Z.lastHall.generators.map((x) => x.kind).join() === 'shoot,console,overload';
  const nodes = Z.mainHall.defence.nodes.map((x) => { x.set(false); const d = !x.live; x.set(true); return d && x.live; }).every(Boolean) && Z.mainHall.defence.emitters.length >= 6;
  Z.mainHall.defence.emitters[0].set('#ff3030'); Z.mainHall.defence.emitters[0].set('#3a2a66');
  const cells = Z.energyHall.cells.map((x) => { x.blow(); const d = x.blown; x.reset(); return d && !x.blown; }).every(Boolean);
  const props = [...Z.energy.reactors, ...Z.energy.pylons].map((x) => { x.set(false); const d = !x.live; x.set(true); return d && x.live && typeof x.y === 'number'; }).every(Boolean);
  Z.wayOut.mark(true); const marked = Z.wayOut.marked; Z.wayOut.mark(false);
  const idx = Z.wayOut.routeIndex(Z.wayOut.leap.from);
  const model = Z.armoured.model(), u = model.userData;
  const armoured = model.isGroup && u.wheels.length === 6 && !!u.body && !!u.tailMat && !!u.headMat && u.halfExtents.z > 3 && typeof Z.armoured.spot.yaw === 'number';
  model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
  const fy = ['tunnels', 'yard', 'bridges', 'watch', 'towerBridge', 0, 1, 2, 3].map((k) => +(Z.floorY(k) - Z.y).toFixed(2));
  const inside = Z.inYard(Z.yard.centre.x, Z.yard.centre.z) && Z.inInner(Z.computer.at.x, Z.computer.at.z) && Z.inTower(Z.lastHall.centre.x, Z.lastHall.centre.z) && Z.inTunnels(Z.tunnels.lobby) && !Z.inTunnels(Z.yard.centre) && !Z.inTower(Z.computer.at.x, Z.computer.at.z);
  return { solid, blows, wrecked, alarmOn, screenOk, gens, nodes, cells, props, marked, idx, armoured, fy, inside, lamps: Z.lamps.length, emissives: Z.emissives.length, medkit: typeof Z.medkit.y === 'number', portal: Z.portalAt === Z.lastHall.portalAt, size: Z.lastHall.size };
});
check('every yard vehicle blocks and can blow: wreck() and reset(), a blast spot each', misc.solid.every(Boolean) && misc.blows && misc.wrecked, `${misc.solid.length} vehicles`);
check('alarm.on(true) and off', misc.alarmOn);
check('the giant screen and the main computer show every picture', misc.screenOk);
check('three shield generators of three kinds, the engine\'s looks, the hall\'s defence nodes and emitters', misc.gens && misc.nodes);
check('the energy hall\'s cells blow and reset; reactors and pylons can be put out and relit', misc.cells && misc.props);
check('the way out can be marked; routeIndex finds the leap', misc.marked && misc.idx === N.leap, `index ${misc.idx}`);
check('the armoured car\'s model is a vehicle model (six wheels, body, lights, extents)', misc.armoured);
check('the floors\' heights', misc.fy.join() === '-6,0,7,9,14,0,7,14,21', misc.fy.join());
check('inYard / inInner / inTower / inTunnels', misc.inside);
check('the last hall is the biggest room (79 × 71 × 15 m); medkit and portalAt are there', misc.size.x === 79 && misc.size.z === 71 && misc.size.h === 15 && misc.medkit && misc.portal);
check('lamps and emissives for the night', misc.lamps >= 20 && misc.lamps <= 44 && misc.emissives >= 3, `${misc.lamps} lamps, ${misc.emissives} emissives`);

// ---------- 11. destroy() and restore() ----------
const fall = await G(() => {
  const W = window.__game, g = W.debug.game, world = W.debug.world, Z = world.places.citadel, cols = world.cols, cam = W.debug.camera, out = {};
  const hallY = () => +(world.groundHeight(Z.lastHall.centre.x, Z.lastHall.centre.z, Z.lastHall.centre.y) - Z.y).toFixed(2);
  const wallHit = () => { const p = { x: Z.x + 32, y: Z.y, z: Z.z + 20 }; return !!cols.resolve(p, 0.3, Z.y, g.car); };
  const floors0 = cols.floors.length, count0 = cols.count, pads0 = world.net.pads.length;
  out.before = hallY(); out.wallBefore = wallHit();
  out.destroyed = Z.destroy() === true && Z.destroyed && Z.falling && Z.destroy() === false;
  out.during = hallY(); out.wallDuring = wallHit(); out.ruinShown = Z.ruin.visible;
  for (let i = 0; i < 20; i++) Z.tick(cam, 0.1);
  out.sinking = +(Z.tower.group.position.y - Z.y).toFixed(1);
  for (let i = 0; i < 100; i++) Z.tick(cam, 0.1);
  out.fallen = !Z.falling && !Z.tower.group.visible && Z.ruin.visible;
  out.bridgeGone = Z.towerBridge.dropped().length === Z.towerBridge.n;
  // the ruin: rubble blocks somewhere inside the footprint, the hall's place is open ground
  let rubble = 0; for (let lx = 36; lx <= 108; lx += 4) for (let lz = -32; lz <= 32; lz += 4) { const p = { x: Z.x + lx, y: Z.y, z: Z.z + lz }; if (cols.resolve(p, 0.3, Z.y, g.car)) rubble++; }
  out.rubble = rubble;
  out.stub = (() => { const p = { x: Z.x + 31.2, y: Z.y + 7, z: Z.z - 24 }; return !!cols.resolve(p, 0.3, Z.y + 7, g.car); })();
  out.restored = Z.restore() === true && !Z.destroyed && Z.tower.group.visible && !Z.ruin.visible && Math.abs(Z.tower.group.position.y - Z.y) < 1e-6;
  out.after = hallY(); out.wallAfter = wallHit(); out.bridgeBack = Z.towerBridge.dropped().length === 0;
  out.same = cols.floors.length === floors0 && cols.count === count0 && world.net.pads.length === pads0;
  out.instant = Z.destroy({ instant: true }) && !Z.falling && !Z.tower.group.visible; Z.restore();
  out.final = hallY();
  return out;
});
check('destroy(): the tower\'s floors and walls leave the world at once, the ruin shows, the group sinks under smoke', fall.destroyed && fall.before === 21 && fall.during < 1 && fall.wallBefore && fall.ruinShown && fall.sinking < -3, `the last hall's floor ${fall.before} → ${fall.during} m; the group at ${fall.sinking} m after 2 s`);
check('after the fall: the tower is gone, the ruin stays (rubble that blocks), the tower bridge is down, the bridges\' ends are barred', fall.fallen && fall.bridgeGone && fall.rubble >= 20 && fall.stub, `${fall.rubble} of 323 samples blocked by rubble`);
check('restore(): the tower stands again exactly (colliders, floors, walking surfaces counted), the bridge is back', fall.restored && fall.after === 21 && fall.wallAfter && fall.bridgeBack && fall.same, `floor ${fall.after} m`);
check('destroy({ instant: true }) and restore() again', fall.instant && fall.final === 21);
await run('after destroy and restore: the tower door open, from the forecourt', { setup: `${reset} Z.mainHall.door.unlock(); Z.mainHall.door.setOpen(true);`, teardown: reset, from: 'Z.mainHall.outside', to: [['the main hall', 'Z.mainHall.centre'], ['the energy hall', 'Z.energyHall.centre']] });
await run('destroyed: the ruin from the forecourt', { setup: `${reset} Z.destroy({ instant: true });`, teardown: reset, from: 'Z.mainHall.outside', to: [['the inner gate', 'Z.innerGate.inside'], ['the control roof by the plant stairs and bridge C', 'Z.control.roof'], ['bridge A\'s end (barred, no fall)', 'Z.bridges.a[1]']] });

// ---------- 12. what it costs to draw ----------
const cost = await G(() => {
  const W = window.__game, g = W.debug.game, world = W.debug.world, Z = world.places.citadel, cam = W.debug.camera, R = W.debug.renderer;
  const shot = (from, to, night) => { g.daylight.set(night, 0); g.daylight.update(0.1); cam.position.set(Z.x + from[0], Z.y + from[1], Z.z + from[2]); cam.lookAt(Z.x + to[0], Z.y + to[1], Z.z + to[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); g.daylight.focus = cam.position; g.daylight.cull?.(true); world.tick(cam, 0.05); R.render(W.debug.scene, cam); return { calls: R.info.render.calls, tris: R.info.render.triangles }; };
  const out = { yard: shot([-150, 1.7, 70], [-60, 6, -10], 0), yardNight: shot([-150, 1.7, 70], [-60, 6, -10], 1), lastHall: shot([40, 22.7, -20], [104, 28, 0], 0), mainHall: shot([38, 1.7, 0], [110, 4, 0], 0), tunnels: shot([-101, -4.3, 72], [-40, -4.6, 64.5], 0) };
  g.daylight.set(0, 0); g.daylight.update(0.1);
  return out;
});
for (const [k, v] of Object.entries(cost)) console.log(`      draw: ${k}: ${v.calls} calls, ${v.tris} triangles`);
check('draw calls stay sane with the camera in the yard and in the last hall', cost.yard.calls <= 160 && cost.yardNight.calls <= 170 && cost.lastHall.calls <= 160 && cost.yard.tris < 400000 && cost.lastHall.tris < 400000, `yard ${cost.yard.calls} (night ${cost.yardNight.calls}), last hall ${cost.lastHall.calls}`);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
