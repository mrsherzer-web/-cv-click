// Walkability of chapter nine's underground facility (המתקן התת-קרקעי): from the elevator's arrival hall,
// is every zone reachable through its doors when they are open (the cells, the iron corridor, the machine
// room and its catwalks, the arena and its stands, the armory and the wall of weapons, the tunnels, the
// stores, the hangar, the safe room, the way out to the surface), and is each shut off when its doors are
// shut? A flood fill over a half-metre grid with the player's own collision test, following the ground at
// the walker's own height (floors, stairs, the ramp), as tests/walk.test.mjs does for chapter eight. Then:
// every guard's patrol point is reachable and every leg of every route is walkable on its floor; the
// place's API (doors, machines, the rack, the kit, the vehicles, zones) does what it says; and screenshots
// of the corridor, the arena and the hangar at night.
// Usage: node tests/walk-facility.test.mjs [siteDir] [screenshot dir]
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
const SHOTS = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
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
check('the facility is built', await page.evaluate(() => !!window.__game.debug.world.places.facility));

// a fill that follows the ground at the walker's own height (as tests/walk.test.mjs's walk3)
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
  return r;
};

const AREA = await page.evaluate(() => { const F = window.__game.debug.world.places.facility; return { x0: F.x - 100, z0: F.z - 80, x1: F.x + 136, z1: F.z + 80 }; });
const F = 'P.facility';
const open = `${F}.openAll();`;
const shut = (names) => `${F}.openAll(); ${F}.setDoors({ ${names.map((n) => `${n}: false`).join(', ')} });`;
const list = (expr, name) => page.evaluate(({ expr }) => new Function('P', `return (${expr}).length;`)(window.__game.debug.world.places), { expr }).then((n) => Array.from({ length: n }, (_, i) => [`${name} ${i + 1}`, `${expr}[${i}]`]));
const beside = (v) => `(() => { const q = ${v}; return { x: q.x + Math.cos(q.yaw) * (q.w / 2 + 1.1), z: q.z - Math.sin(q.yaw) * (q.w / 2 + 1.1), y: q.y }; })()`;

// ---------- every zone, every door open: from the arrival hall ----------
const everything = [
  ['arrival: the hall', `${F}.arrival.centre`], ...await list(`${F}.arrival.inCar`, 'arrival: in the car'), ...await list(`${F}.arrival.spots`, 'arrival: by the car'),
  ['cells: the hallway', `${F}.cells.hall`], ['cells: the big cell', `${F}.cells.big.inside`], ...await list(`${F}.cells.wake`, 'cells: wakes'), ['cells: cell 1', `${F}.cells.row[0].inside`], ['cells: cell 2', `${F}.cells.row[1].inside`], ['cells: cell 3', `${F}.cells.row[2].inside`], ['cells: the guard entrance', `${F}.cells.guardEntrance`],
  ...await list(`${F}.corridor.points`, 'corridor'), ...await list(`${F}.corridor.bays`, 'corridor: bay'), ...await list(`${F}.corridor.fights`, 'corridor: fight spot'), ['corridor: guard room 1', `${F}.corridor.guardRooms[0].inside`], ['corridor: guard room 2', `${F}.corridor.guardRooms[1].inside`],
  ['machines: in by A', `${F}.machines.inA`], ['machines: in by B', `${F}.machines.inB`], ...await list(`${F}.machines.walkway`, 'machines: walkway'), ['machines: the panel', `${F}.machines.panel.at`],
  ['machines: the west stairs, top', `${F}.machines.stairs.west.top`], ['machines: the east stairs, top', `${F}.machines.stairs.east.top`], ...await list(`${F}.machines.catwalk.points`, 'machines: catwalk'),
  ['arena: the entry', `${F}.arena.entry`], ['arena: outside the gate', `${F}.arena.gateOut`], ['arena: the centre', `${F}.arena.centre`], ['arena: the hammer', `${F}.arena.hammer`], ['arena: the player', `${F}.arena.player`], ...await list(`${F}.arena.allies`, 'arena: ally'),
  ['arena: the west stairs, top', `${F}.arena.stairs.west.top`], ['arena: the east stairs, top', `${F}.arena.stairs.east.top`], ...await list(`${F}.arena.rail`, 'arena: at the rail'), ['arena: the north stand', `${F}.arena.stands.north`],
  ['armory: the card reader', `${F}.armory.reader.at`], ['armory: inside', `${F}.armory.inside`], ['armory: the clipboard', `${F}.armory.clipboard.at`], ['armory: the keypad', `${F}.armory.keypad.at`], ['armory: behind the bars', `${F}.armory.behind`], ['armory: the rack', `${F}.armory.rack.at`],
  ...(await list(`${F}.armory.rack.markers`, 'armory: marker')).map(([n, e]) => [n, `${e}.at`]), ...await list(`${F}.armory.spots`, 'armory: spot'),
  ...await list(`${F}.tunnels.points`, 'tunnels'),
  ['stores: hall A', `${F}.stores.a`], ['stores: hall B', `${F}.stores.b`], ...await list(`${F}.stores.lanes`, 'stores: lane'),
  ['hangar: the centre', `${F}.hangar.centre`], ['hangar: by the west door', `${F}.hangar.doorAt.west`], ['hangar: by the south-west door', `${F}.hangar.doorAt.sw`], ['hangar: by the north door', `${F}.hangar.doorAt.north`],
  ...(await list(`${F}.hangar.vehicles`, 'hangar: beside vehicle')).map(([n, e]) => [n, beside(e)]),
  ['hangar: at the damaged door', `${F}.hangar.trap.at`], ['hangar: behind the damaged door', `${F}.hangar.trap.behind`], ['hangar: the first-aid kit', `${F}.medkit.at`], ['hangar: the blast spot', `${F}.hangar.blast`],
  ['safe room: at the door', `${F}.saferoom.doorAt`], ['safe room: inside the door', `${F}.saferoom.doorIn`], ['safe room: inside', `${F}.saferoom.inside`], ['safe room: by the bed', `${F}.saferoom.bed.side`], ...await list(`${F}.saferoom.spots`, 'safe room: spot'),
  ['exit: the panel', `${F}.exit.panel.at`], ['exit: inside the door', `${F}.exit.inside`], ['exit: the ramp, bottom', `${F}.exit.rampBottom`], ['exit: the ramp, middle', `${F}.exit.rampMid`], ['exit: the ramp, top', `${F}.exit.rampTop`], ['exit: outside, on the surface', `${F}.exit.outside`],
];
await run3('all doors open: from the arrival hall', { area: AREA, setup: open, from: `${F}.arrival.centre`, to: everything });

// ---------- every door shut: nothing past the arrival hall ----------
await run3('all doors shut: from the arrival hall', { area: AREA, setup: `${F}.closeAll();`, teardown: open, from: `${F}.arrival.centre`,
  to: [['the hall', `${F}.arrival.spots[0]`], ['in the car (gate shut)', `${F}.arrival.inCar[0]`], ['the cells (door shut)', `${F}.cells.hall`], ['the corridor', `${F}.corridor.start`], ['the machine room', `${F}.machines.west`], ['the arena', `${F}.arena.centre`], ['the armory', `${F}.armory.inside`], ['the tunnels', `${F}.tunnels.t1[0]`], ['the stores', `${F}.stores.a`], ['the hangar', `${F}.hangar.centre`], ['the safe room', `${F}.saferoom.inside`], ['outside', `${F}.exit.outside`]] },
  ['in the car (gate shut)', 'the cells (door shut)', 'the corridor', 'the machine room', 'the arena', 'the armory', 'the tunnels', 'the stores', 'the hangar', 'the safe room', 'outside']);

// ---------- door by door: each zone opens with its doors and is shut off without them ----------
await run3('the cells: cell doors shut, the guard door shut', { area: AREA, setup: shut(['bigCell', 'cell1', 'cell2', 'cell3', 'guardDoor']), teardown: open, from: `${F}.arrival.centre`,
  to: [['the hallway', `${F}.cells.hall`], ['at the big cell door', `${F}.cells.big.doorAt`], ['the big cell', `${F}.cells.big.inside`], ['a wake spot', `${F}.cells.wake[0]`], ['cell 2', `${F}.cells.row[1].inside`], ['the corridor', `${F}.corridor.start`]] },
  ['the big cell', 'a wake spot', 'cell 2', 'the corridor']);
await run3('the cells: woken in the big cell, its door opened, the guard door open', { area: AREA, setup: shut(['arrivalDoor', 'cell1', 'cell2', 'cell3']), teardown: open, from: `${F}.cells.wake[5]`,
  to: [['the hallway', `${F}.cells.hall`], ['the guard entrance', `${F}.cells.guardEntrance`], ['the corridor', `${F}.corridor.points[3]`], ['cell 1 (shut)', `${F}.cells.row[0].inside`], ['the arrival hall (shut)', `${F}.arrival.centre`]] },
  ['cell 1 (shut)', 'the arrival hall (shut)']);
const aroundShutter = ['shutter', 'guardRoom1Back', 'guardRoom2Back'];
await run3('the corridor: the shutter down, the machine room shut too: no way east', { area: AREA, setup: shut([...aroundShutter, 'machA', 'machB']), teardown: open, from: `${F}.corridor.start`,
  to: [['west of the shutter', `${F}.corridor.shutterAt.west`], ['guard room 1', `${F}.corridor.guardRooms[0].inside`], ['east of the shutter', `${F}.corridor.shutterAt.east`], ['the arena door', `${F}.arena.doorAt`], ['the machine room', `${F}.machines.west`]] },
  ['east of the shutter', 'the arena door', 'the machine room']);
await run3('the corridor: the shutter down, through the machine room (floor and catwalks)', { area: AREA, setup: shut(aroundShutter), teardown: open, from: `${F}.corridor.start`,
  to: [['in by A', `${F}.machines.inA`], ['the panel', `${F}.machines.panel.at`], ['the walkway west', `${F}.machines.walkway[0]`], ['between the presses', `${F}.machines.safe[0]`], ['the walkway east', `${F}.machines.walkway[5]`], ['the catwalk, north', `${F}.machines.catwalk.north`], ['the catwalk, east', `${F}.machines.catwalk.east`], ['out by B', `${F}.machines.outB`], ['east of the shutter', `${F}.corridor.shutterAt.east`], ['the arena door', `${F}.arena.doorAt`]] });
await run3('the machine room: door B shut: the room, not the corridor past the shutter', { area: AREA, setup: shut([...aroundShutter, 'machB']), teardown: open, from: `${F}.corridor.start`,
  to: [['the catwalk, west', `${F}.machines.catwalk.west`], ['in by B', `${F}.machines.inB`], ['east of the shutter', `${F}.corridor.shutterAt.east`]] }, ['east of the shutter']);
await run3('the arena: its door shut', { area: AREA, setup: shut(['arena']), teardown: open, from: `${F}.corridor.start`, to: [['at the door', `${F}.arena.doorAt`], ['the entry', `${F}.arena.entry`], ['the stands', `${F}.arena.stands.west`], ['the cage', `${F}.arena.centre`]] }, ['the entry', 'the stands', 'the cage']);
await run3('the arena: in, the cage gate shut', { area: AREA, setup: shut(['cage']), teardown: open, from: `${F}.corridor.start`, to: [['the entry', `${F}.arena.entry`], ['outside the gate', `${F}.arena.gateOut`], ['the west stand', `${F}.arena.stands.west`], ['the east stand', `${F}.arena.stands.east`], ['the north stand', `${F}.arena.stands.north`], ['the cage (gate shut)', `${F}.arena.centre`], ['the hammer (gate shut)', `${F}.arena.hammer`]] }, ['the cage (gate shut)', 'the hammer (gate shut)']);
await run3('the armory: the card door shut', { area: AREA, setup: shut(['armory']), teardown: open, from: `${F}.corridor.start`, to: [['the card reader', `${F}.armory.reader.at`], ['inside', `${F}.armory.inside`], ['the rack', `${F}.armory.rack.at`]] }, ['inside', 'the rack']);
await run3('the armory: in, the code gate shut', { area: AREA, setup: shut(['rackGate']), teardown: open, from: `${F}.corridor.start`, to: [['inside', `${F}.armory.inside`], ['the clipboard', `${F}.armory.clipboard.at`], ['the keypad', `${F}.armory.keypad.at`], ['behind the bars', `${F}.armory.behind`], ['the rack', `${F}.armory.rack.at`], ['marker 6', `${F}.armory.rack.markers[5].at`]] }, ['behind the bars', 'the rack', 'marker 6']);
const intoStores = ['guardRoom1Back', 'guardRoom2Back'];
await run3('the tunnels: the corridor door shut (and the guard rooms\' backs)', { area: AREA, setup: shut(['t1Corridor', ...intoStores]), teardown: open, from: `${F}.corridor.start`, to: [['the corridor\'s end', `${F}.corridor.end`], ['the tunnel', `${F}.tunnels.t1[0]`], ['the stores', `${F}.stores.a`], ['the hangar', `${F}.hangar.centre`]] }, ['the tunnel', 'the stores', 'the hangar']);
await run3('the stores: shut off from the tunnels and the hangar (the hangar by the north door)', { area: AREA, setup: shut([...intoStores, 't1Stores', 't2Stores', 'hangarW']), teardown: open, from: `${F}.corridor.start`, to: [['the tunnel', `${F}.tunnels.t1[1]`], ['the hangar', `${F}.hangar.centre`], ['T2 from the hangar', `${F}.tunnels.t2[2]`], ['store A', `${F}.stores.a`], ['store B', `${F}.stores.b`]] }, ['store A', 'store B']);
await run3('the stores: through T1\'s door', { area: AREA, setup: shut([...intoStores, 't2Stores', 'hangarW', 't1Hangar', 't2Hangar']), teardown: open, from: `${F}.corridor.start`, to: [['store A', `${F}.stores.a`], ['store B', `${F}.stores.b`], ['a forklift lane', `${F}.stores.lanes[4]`], ['the hangar (shut)', `${F}.hangar.centre`]] }, ['the hangar (shut)']);
await run3('the hangar: its three doors shut', { area: AREA, setup: shut(['t1Hangar', 'hangarW', 't2Hangar']), teardown: open, from: `${F}.corridor.start`, to: [['store B', `${F}.stores.b`], ['T2', `${F}.tunnels.t2[1]`], ['the hangar', `${F}.hangar.centre`], ['the safe room', `${F}.saferoom.inside`], ['outside', `${F}.exit.outside`]] }, ['the hangar', 'the safe room', 'outside']);
await run3('the hangar: the damaged door, the safe room, the exit shut', { area: AREA, setup: shut(['trap', 'saferoom', 'exit']), teardown: open, from: `${F}.hangar.centre`, to: [['at the damaged door', `${F}.hangar.trap.at`], ['behind it (shut)', `${F}.hangar.trap.behind`], ['at the safe room door', `${F}.saferoom.doorAt`], ['the safe room (shut)', `${F}.saferoom.inside`], ['the bed (shut)', `${F}.saferoom.bed.side`], ['the exit panel', `${F}.exit.panel.at`], ['the ramp (shut)', `${F}.exit.rampMid`], ['outside (shut)', `${F}.exit.outside`]] }, ['behind it (shut)', 'the safe room (shut)', 'the bed (shut)', 'the ramp (shut)', 'outside (shut)']);
await run3('the way in from the surface: down the ramp, the big door open', { area: AREA, setup: open, from: `${F}.exit.outside`, to: [['the ramp top', `${F}.exit.rampTop`], ['the hangar', `${F}.hangar.centre`], ['the safe room', `${F}.saferoom.inside`], ['the cells', `${F}.cells.hall`]] });

// ---------- the guards' routes: every point reachable, every leg walkable on its own floor ----------
const routes = await page.evaluate(() => Object.keys(window.__game.debug.world.places.facility.patrols));
check(`12 to 16 patrol routes (${routes.length})`, routes.length >= 12 && routes.length <= 16);
const pts = [];
for (const k of routes) { const n = await page.evaluate((k) => window.__game.debug.world.places.facility.patrols[k].length, k); for (let i = 0; i < n; i++) pts.push([`patrol ${k} ${i + 1}`, `${F}.patrols.${k}[${i}]`]); }
await run3('patrol points: from the arrival hall', { area: AREA, setup: open, from: `${F}.arrival.centre`, to: pts });
const legs = await page.evaluate(() => {
  const g = window.__game.debug.game, W = window.__game.debug.world, F = W.places.facility, pos = { x: 0, y: 0, z: 0 }, bad = [];
  F.openAll();
  for (const [k, pts] of Object.entries(F.patrols)) {
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length]; if (pts.length < 2) return;
      const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.25);
      let y = p.y ?? W.groundHeight(p.x, p.z);
      for (let s = 0; s <= n; s++) {
        const x = p.x + (q.x - p.x) * s / n, z = p.z + (q.z - p.z) * s / n, y2 = W.groundHeight(x, z, y);
        if (Math.abs(y2 - y) > 0.9) { bad.push(`${k} ${i + 1}: a drop at ${x.toFixed(1)},${z.toFixed(1)}`); return; }
        if (p.y != null && Math.abs(y2 - p.y) > 0.3) { bad.push(`${k} ${i + 1}: off its floor at ${x.toFixed(1)},${z.toFixed(1)}`); return; }
        y = y2; pos.x = x; pos.y = y; pos.z = z;
        if (W.cols.resolve(pos, 0.33, y, g.car) && Math.hypot(pos.x - x, pos.z - z) > 0.05) { bad.push(`${k} ${i + 1}: blocked at ${x.toFixed(1)},${z.toFixed(1)}`); return; }
      }
    });
  }
  return bad;
});
check('every leg of every patrol route is walkable on its floor', legs.length === 0, legs.slice(0, 4).join(' | '));

// ---------- the place's API ----------
const api = await page.evaluate(() => {
  const F = window.__game.debug.world.places.facility, out = {};
  // doors open and shut by script; a locked door stays shut
  const d = F.doors.bigCell; d.lock(); out.lockShut = !d.open && d.locked && d.body.enabled; d.unlock(); d.setOpen(true); out.openFree = d.open && !d.body.enabled;
  F.setDoors({ armory: 'locked', exit: false, saferoom: true }); out.setDoors = F.doors.armory.locked && !F.doors.armory.open && !F.doors.exit.open && F.doors.saferoom.open;
  F.openAll(); out.openAll = F.doorList.every((q) => q.open && !q.locked);
  out.doorCount = F.doorList.length;
  // the machines: each warns before it hits, and set(false) makes it safe
  const M = F.machines, hz = M.presses[1];
  M.reset(); let warned = false, hit = false, warnedFirst = null;
  for (let t = 0; t < 10; t += 1 / 30) { hz.update(1 / 30); if (hz.warning) warned = true; if (hz.hits(hz.x, hz.z)) { hit = true; if (warnedFirst === null) warnedFirst = warned; } }
  out.pressWarnsThenHits = hit && warnedFirst === true;
  out.pressMissesBeside = !hz.hits(hz.x + 3, hz.z);
  hz.set(false); let hitOff = false; for (let t = 0; t < 10; t += 1 / 30) { hz.update(1 / 30); if (hz.hits(hz.x, hz.z)) hitOff = true; } out.pressOffSafe = !hitOff;
  const v = M.vents[0]; v.set(true); let vw = false, vh = false, vwf = null; for (let t = 0; t < 10; t += 1 / 30) { v.update(1 / 30); if (v.warning) vw = true; if (v.hits(v.x, v.z)) { vh = true; if (vwf === null) vwf = vw; } }
  out.ventWarnsThenHits = vh && vwf === true;
  M.setAll(false); out.setAllOff = M.hazards.every((h) => !h.on); M.setAll(true); out.setAllOn = M.hazards.every((h) => h.on); M.reset();
  out.machineHits = typeof M.hits(0, 0) === 'object';
  // the wall of weapons
  const r = F.armory.rack; r.reset(); out.rackFull = r.left() === 10; r.take(3); out.rackTake = r.left() === 9 && r.markers[3].taken; r.all(); out.rackAll = r.left() === 0; r.reset(); out.rackReset = r.left() === 10 && !!r.of('nehorai');
  // the kit, the vehicles, the clipboard, the alarm, zones
  F.medkit.take(); out.kitTaken = F.medkit.taken && !F.medkit.mesh.visible; F.medkit.reset(); out.kitBack = !F.medkit.taken;
  out.vehicles = F.hangar.vehicles.length; F.hangar.vehicles[0].blow(); out.blown = F.hangar.vehicles[0].blown; F.hangar.vehicles[0].reset(); out.unblown = !F.hangar.vehicles[0].blown;
  F.armory.clipboard.setText(['בדיקה', '1234']); F.armory.clipboard.reset(); out.code = F.armory.code;
  F.alarm(true); out.alarm = F.alarmOn; F.alarm(false);
  out.zones = ['arrival', 'cells', 'corridor', 'machines', 'arena', 'armory', 'tunnels', 'stores', 'hangar', 'saferoom', 'exit'].map((z) => [z, z === 'arrival' ? F.arrival.centre : z === 'cells' ? F.cells.hall : z === 'corridor' ? F.corridor.start : z === 'machines' ? F.machines.west : z === 'arena' ? F.arena.centre : z === 'armory' ? F.armory.inside : z === 'tunnels' ? F.tunnels.t1[0] : z === 'stores' ? F.stores.a : z === 'hangar' ? F.hangar.centre : z === 'saferoom' ? F.saferoom.inside : F.exit.rampMid]).filter(([z, p]) => F.zoneAt(p.x, p.z) !== z).map(([z]) => z);
  out.inside = F.inside(F.hangar.centre.x, F.hangar.centre.z) && !F.inside(F.exit.outside.x, F.exit.outside.z);
  out.exitOutside = Math.hypot(F.exit.outside.x - 1640, F.exit.outside.z + 90) < 3;
  out.wake = F.cells.wake.length; out.car = F.arrival.inCar.length; out.hall = F.arrival.spots.length;
  out.lamps = F.lamps.length; out.inside_lamps = F.lamps.filter((l) => l.inside).length; out.red = F.redLamps.length;
  return out;
});
check('a locked door is shut and blocks; opened it lets through', api.lockShut && api.openFree);
check('setDoors and openAll set the doors by name', api.setDoors && api.openAll, `${api.doorCount} doors`);
check('a press warns (amber) before it comes down, hits under it only, and off is safe', api.pressWarnsThenHits && api.pressMissesBeside && api.pressOffSafe);
check('a steam vent warns before it bursts', api.ventWarnsThenHits);
check('machines.setAll switches every hazard', api.setAllOff && api.setAllOn);
check('the wall of weapons: ten markers, take(i), all(), reset()', api.rackFull && api.rackTake && api.rackAll && api.rackReset);
check('the first-aid kit: take() hides it, reset() puts it back', api.kitTaken && api.kitBack);
check('three or four vehicles that can blow (blow / reset)', api.vehicles >= 3 && api.vehicles <= 4 && api.blown && api.unblown, `${api.vehicles}`);
check('the armory code is on the clipboard', /^\d{4}$/.test(api.code));
check('the alarm switches the red lamps', api.alarm, `${api.red} red lamps`);
check('zoneAt names every zone', api.zones.length === 0, api.zones.join(', '));
check('inside(): under the ground in the hangar, not on the surface', api.inside);
check('the way out comes up at about (1640, -90)', api.exitOutside);
check('ten spots to wake in, ten in the car, ten by the car', api.wake === 10 && api.car === 10 && api.hall === 10);
check('lamps, most of them inside', api.lamps > 30 && api.inside_lamps > api.lamps * 0.8, `${api.lamps} lamps, ${api.inside_lamps} inside`);

// ---------- screenshots at night: the corridor, the arena, the hangar ----------
await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.time > 0.5, null, { timeout: 120000 });
await page.evaluate(() => { const g = window.__game.debug.game; g.setPopulation?.({ traffic: 0, people: 0 }); g.daylight.set(1); window.__game.debug.world.places.facility.openAll(); });
const shot = async (name, at, yaw, pitch) => {
  await page.evaluate(({ at, yaw, pitch }) => { const P = window.__game.debug.world.places; const p = new Function('P', `return (${at});`)(P); window.__game.teleport(p.x, p.z, p.y); window.__game.setCamera(yaw, pitch); }, { at, yaw, pitch });
  const t0 = await page.evaluate(() => window.__game.state.time);
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if ((await page.evaluate(() => window.__game.state.time)) - t0 > 2.5) break; }
  await page.evaluate(({ yaw, pitch }) => window.__game.setCamera(yaw, pitch), { yaw, pitch });
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => { const F = window.__game.debug.world.places.facility; let n = 0; for (const o of [F.interior, F.shell]) o.traverseVisible((q) => { if (q.isMesh) n++; }); return { interior: F.interior.visible, mine: n, calls: window.__game.state.drawCalls }; });
  await page.screenshot({ path: `${SHOTS}/facility-${name}.png` });
  check(`screenshot: ${name} (${SHOTS}/facility-${name}.png)`, s.interior && s.mine < 60, `${s.mine} facility meshes drawn, ${s.calls} draw calls in all`);
};
await shot('corridor', `${F}.corridor.points[2]`, -Math.PI / 2, 0.12);
await shot('arena', `({ ...${F}.arena.stands.west, x: ${F}.arena.stands.west.x + 0.5, z: ${F}.arena.stands.west.z + 6 })`, -Math.PI / 2 - 0.35, 0.45);
await shot('hangar', `({ ...${F}.hangar.centre, x: ${F}.hangar.centre.x - 14, z: ${F}.hangar.centre.z + 14 })`, -Math.PI * 0.75, 0.3);
const outside = await page.evaluate(() => { const F = window.__game.debug.world.places.facility; window.__game.teleport(F.exit.outside.x + 30, F.exit.outside.z, F.exit.outside.y); return new Promise((res) => setTimeout(() => res(F.interior.visible), 3000)); });
check('from the plain the inside is not drawn (only the lid, the hangar, the ramp)', outside === false);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
