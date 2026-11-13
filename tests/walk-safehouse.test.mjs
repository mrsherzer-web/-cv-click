// Walkability of the safe house (chapter nine, places.safehouse): from the yard, on foot, can a player reach
// every spot the missions use (the nine seats, the kitchen chairs, the gear rack, the TV, the switch and the
// fuse box, the door, the yard, the gate, the three car spots)? And does nothing stand inside a wall (a spot
// a player could not stand on without being pushed)? A flood fill over a half-metre grid with the player's
// own collision test and the ground at his own height, as in tests/walk.test.mjs. Also: the front door,
// the TV and the sofas collide; the screen's pictures (chapter ten's 'threat' map too), the lights switched off
// and on (the lamps' lights in the scene, the bulbs), the gear taken and put back. Chapter ten's balcony: reached on
// foot from the living room through its door (and only so: railed all round, shut with its door), its spots clear,
// the view east from it open over the yard's low wall. Usage: node tests/walk-safehouse.test.mjs [distDir]
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

// a fill that follows the ground at the walker's own height (the walk3 of tests/walk.test.mjs). c: { area,
// setup, teardown (code run with P = places, W = world, g = game), from (expr), to: [[name, expr, near?]] }:
// a target counts when a reached cell within `near` cells of it (default 1, half a metre) is at its height
const walk = (c) => page.evaluate((c) => {
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
  for (const [name, expr, near = 1] of c.to) {
    const p = E(expr), i0 = Math.round((p.x - x0) / S), j0 = Math.round((p.z - z0) / S), yy = p.y ?? W.groundHeight(p.x, p.z);
    let ok = false;
    for (let di = -near; di <= near && !ok; di++) for (let dj = -near; dj <= near && !ok; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; for (const dy of [-1.25, 0, 1.25]) { const k = keyOf(i, j, yy + dy); if (seen.has(k) && Math.abs(seen.get(k) - yy) < 1.0) { ok = true; break; } } }
    out[name] = ok ? 'ok' : 'unreachable';
  }
  run(c.teardown);
  return { out, cells: seen.size };
}, c);
const run = async (title, c, expectShut = []) => {
  const r = await walk(c);
  for (const [name] of c.to) { const want = expectShut.includes(name) ? 'unreachable' : 'ok'; check(`${title} → ${name}${want === 'unreachable' ? ' (must be shut)' : ''}`, r.out[name] === want, r.out[name]); }
  return r;
};

const AREA = await G(() => { const s = window.__game.debug.world.places.safehouse; return { x0: s.x - 40, z0: s.z - 26, x1: s.x + 40, z1: s.z + 26 }; });
const H = 'P.safehouse';
// a seat is reached through the spot in front of it (seat.stand); that the seat itself is clear and the
// way from it to its stand is open is checked below (a seat's pocket between the arms is narrower than the grid)
const WHO = ['Nehorai', 'Erez', 'Ido', 'Yonati', 'Avraham', 'Muller', 'Dolev', 'Hadar', 'Liam'];
const seats = [...Array(9).keys()].map((k) => [`seat ${k} (${WHO[k]})`, `${H}.seats[${k}]`]);
const chairs = [...Array(4).keys()].map((k) => [`kitchen chair ${k}`, `${H}.kitchenSeats[${k}]`]);
const fronts = [...seats, ...chairs].map(([n, e]) => [`in front of ${n}`, `${e}.stand`]);
const inside = [
  ['the hallway', `${H}.hallway`], ['inside the door', `${H}.doorAt`], ['the living room', `${H}.living`], ['the TV front', `${H}.tvFront`], ...fronts, ['the kitchen', `${H}.kitchen`],
  ['the gear room', `${H}.gearRoom`], ['the gear (at the rack)', `${H}.gear`], ['the bunk room', `${H}.bunkRoom`], ['the first-aid kit', `${H}.kit.at`], ['the light switch', `${H}.switch.at`], ['the fuse box', `${H}.breaker.at`],
];
const balcony = [['the balcony (Nehorai)', `${H}.balcony`], ['beside him (Erez)', `${H}.balconySide`], ['out of the balcony door', `${H}.balconyDoor.outside`], ['in at the balcony door', `${H}.balconyDoor.inside`]];
const outside = [
  ['outside the door', `${H}.outside`], ['the yard', `${H}.yard`], ['the terrace', `${H}.terrace`], ['behind the house', `${H}.behind`], ['the gate', `${H}.gate`], ['past the gate (the death road)', `${H}.gateOutside`],
  ['the Renault', `${H}.car`], ['car 2', `${H}.cars[0]`], ['car 3', `${H}.cars[1]`],
];
const doorOpen = `P.safehouse.door.unlock(); P.safehouse.door.setOpen(true);`, doorShut = `P.safehouse.door.lock();`;
// the Renault out of the way (the fill ignores it, but keep it off the spots for the stand test below)
await G(() => { const g = window.__game.debug.game; g.car.place(g.car.pos.x, g.car.pos.z, g.car.yaw); });

// ---------- from the yard, the front door open: everything ----------
const r1 = await run('safe house, the door open: from the yard', { area: AREA, setup: doorOpen, from: `${H}.yard`, to: [...inside, ...outside, ...balcony] });
check('the fill covered the house and the yard', r1.cells > 3000, `${r1.cells} cells`);
// ---------- the door shut: the house has no other way in (the windows have sills, the walls collide) ----------
await run('safe house, the door shut: from the yard', { area: AREA, setup: doorShut, teardown: doorOpen, from: `${H}.yard`,
  to: [['the hallway (door shut)', `${H}.hallway`], ['the living room (door shut)', `${H}.living`], ['seat 0 (door shut)', `${H}.seats[0].stand`], ['the gear (door shut)', `${H}.gear`], ['the bunk room (door shut)', `${H}.bunkRoom`], ...outside] },
  ['the hallway (door shut)', 'the living room (door shut)', 'seat 0 (door shut)', 'the gear (door shut)', 'the bunk room (door shut)']);
// ---------- the balcony (chapter ten): from the living room through its door; railed all round, so with that
// door shut it is out of reach, and from the yard it is reached only through the house ----------
await run('safe house: from the living room to the balcony', { area: AREA, setup: doorOpen, from: `${H}.living`, to: balcony });
await run('safe house: from the balcony back in, to the TV and out to the cars', { area: AREA, setup: doorOpen, from: `${H}.balcony`, to: [['the TV front', `${H}.tvFront`], ['seat 0', `${H}.seats[0].stand`], ['the Renault', `${H}.car`], ['car 3', `${H}.cars[1]`]] });
await run('safe house: the balcony door shut', { area: AREA, setup: `${doorOpen} P.safehouse.balconyDoor.lock();`, teardown: `P.safehouse.balconyDoor.unlock(); P.safehouse.balconyDoor.setOpen(true);`, from: `${H}.living`,
  to: [['the balcony (its door shut)', `${H}.balcony`], ['beside him (its door shut)', `${H}.balconySide`], ['the yard', `${H}.yard`]] }, ['the balcony (its door shut)', 'beside him (its door shut)']);
await run('safe house: both doors shut, from the yard', { area: AREA, setup: `${doorShut} P.safehouse.balconyDoor.lock();`, teardown: `${doorOpen} P.safehouse.balconyDoor.unlock(); P.safehouse.balconyDoor.setOpen(true);`, from: `${H}.yard`,
  to: [['the balcony (from the yard, the house shut)', `${H}.balcony`], ['the living room (the house shut)', `${H}.living`]] }, ['the balcony (from the yard, the house shut)', 'the living room (the house shut)']);
const view = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, s = W.places.safehouse, b = s.balcony, out = { blocked: [], hidden: [] };
  const eye = { x: b.x, y: b.y + 1.6, z: b.z };
  for (let a = -14; a <= 14; a += 2) {
    const yaw = b.yaw + a * Math.PI / 180, dx = Math.sin(yaw), dz = Math.cos(yaw);
    const t = W.cols.raycast(eye.x, eye.y, eye.z, eye.x + dx * 150, eye.y, eye.z + dz * 150, g.car);
    if (t !== null) out.blocked.push({ a, at: `${a}° at ${(t * 150).toFixed(1)} m` });
    for (let d = 2; d <= 400; d += 4) { const x = eye.x + dx * d, z = eye.z + dz * d; if (W.groundHeight(x, z) > eye.y + d * 0.02) { out.hidden.push(`${a}° by the land at ${d} m`); break; } }
  }
  out.east = Math.abs(b.yaw - Math.PI / 2) < 1e-6 && b.look.x - b.x > 250 && Math.abs(b.look.z - b.z) < 1;
  out.side = Math.hypot(s.balconySide.x - b.x, s.balconySide.z - b.z);
  out.roofed = W.cols.floorBetween(b.x, b.z, b.y + 1, b.y + 4) && W.cols.floorBetween(s.balconySide.x, s.balconySide.z, b.y + 1, b.y + 4);
  out.parking = s.parking.length === 3 && s.parking[0] === s.car && s.parking[2] === s.cars[1];
  return out;
});
check('the balcony looks east (yaw pi/2), its look point far east', view.east);
// (thin things stand in a wider fan: a pillar of the yard's gate, a post of the terrace's pergola, a road sign)
check('from the balcony the view east is open: nothing solid straight ahead for 150 m (±4°), little in a wider fan (±14°)', view.blocked.every((b) => Math.abs(b.a) > 4) && view.blocked.length <= 4, view.blocked.map((b) => b.at).join(', '));
check('  and the land does not rise into it (to 400 m)', view.hidden.length === 0, view.hidden.slice(0, 3).join(' '));
check('Erez\'s spot is beside Nehorai\'s, the balcony is roofed over both', view.side > 0.8 && view.side < 2 && view.roofed, `${view.side.toFixed(2)} m`);
check('parking: the operation\'s three vehicles (the Renault\'s bay and the two others)', view.parking);

// ---------- from a seat, out to the cars (the ending's way and the opening's) ----------
await run('safe house: from Nehorai\'s seat to the cars', { area: AREA, setup: doorOpen, from: `${H}.seats[0]`, to: [['the gear', `${H}.gear`], ['outside the door', `${H}.outside`], ['the Renault', `${H}.car`], ['car 2', `${H}.cars[0]`], ['car 3', `${H}.cars[1]`], ['past the gate', `${H}.gateOutside`]] });
// ---------- from the gear rack and the fuse box (the lights-out moment) back to the living room ----------
await run('safe house: from the fuse box', { area: AREA, setup: doorOpen, from: `${H}.breaker.at`, to: [['the light switch', `${H}.switch.at`], ['the TV front', `${H}.tvFront`], ['the gear', `${H}.gear`]] });

// ---------- nothing stuck: a player put on any spot is not pushed (walls, furniture, the closed door) ----------
const stand = await G((names) => {
  const W = window.__game.debug.world, g = window.__game.debug.game, P = W.places;
  const out = {};
  for (const [name, expr] of names) {
    const p = new Function('P', `return (${expr});`)(P), q = { x: p.x, y: p.y ?? W.groundHeight(p.x, p.z), z: p.z };
    W.cols.resolve(q, 0.35, q.y, g.car);
    out[name] = Math.hypot(q.x - p.x, q.z - p.z);
  }
  return out;
}, [...inside, ...seats, ...chairs, ...outside, ...balcony]);
for (const [name, d] of Object.entries(stand)) check(`stands free: ${name}`, d < 0.02, d < 0.02 ? '' : `pushed ${d.toFixed(2)} m`);
// from each seat to its stand, a player walks straight out: every point on the way is clear
const out = await G((names) => {
  const W = window.__game.debug.world, g = window.__game.debug.game, P = W.places, res = {};
  for (const [name, expr] of names) {
    const s = new Function('P', `return (${expr});`)(P), t = s.stand;
    let worst = 0;
    for (let k = 0; k <= 10; k++) { const x = s.x + (t.x - s.x) * k / 10, z = s.z + (t.z - s.z) * k / 10, q = { x, y: s.y, z }; W.cols.resolve(q, 0.35, s.y, g.car); worst = Math.max(worst, Math.hypot(q.x - x, q.z - z)); }
    res[name] = worst;
  }
  return res;
}, [...seats, ...chairs]);
for (const [name, d] of Object.entries(out)) check(`a clear way out of ${name}`, d < 0.02, d < 0.02 ? '' : `blocked ${d.toFixed(2)} m`);
// the spots are distinct where people sit: nine seats, nine names, none on another
const seatInfo = await G(() => { const s = window.__game.debug.world.places.safehouse; return { n: s.seats.length, who: s.seats.map((q) => q.who), ido: s.seatFor('ido') === s.seats[2], gap: Math.min(...s.seats.flatMap((a, i) => s.seats.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z)))) }; });
check('nine seats, one for each of the gang', seatInfo.n === 9 && new Set(seatInfo.who).size === 9 && seatInfo.who[0] === 'nehorai', seatInfo.who.join(','));
check('seatFor finds them', seatInfo.ido);
check('seats far enough apart for two people', seatInfo.gap >= 0.7, `${seatInfo.gap.toFixed(2)} m`);

// ---------- what collides: the sofas' backs, the TV and its console, the coffee table, the door when shut ----------
const solid = await G(() => {
  const W = window.__game.debug.world, g = window.__game.debug.game, s = W.places.safehouse, y = s.y, B = (x, h, z) => W.cols.blocks(x, y + h, z, g.car);
  const out = {};
  s.seats.forEach((q, k) => { out[`the back behind seat ${k}`] = B(q.x - Math.sin(q.yaw) * 0.43, 0.5, q.z - Math.cos(q.yaw) * 0.43); });
  out['the TV on the wall'] = B(s.tv.x - 0.03, 1.7, s.tv.z);
  out['the TV console'] = B(s.tv.x + 0.2, 0.3, s.tv.z);
  out['the coffee table'] = B(s.coffeeTable.x, 0.3, s.coffeeTable.z);
  s.door.lock(); out['the front door, shut'] = B(s.door.pos.x, 1.0, s.door.pos.z); s.door.unlock(); s.door.setOpen(true);
  out['the front door, open: free'] = !B(s.door.pos.x, 1.0, s.door.pos.z);
  return out;
});
for (const [name, ok] of Object.entries(solid)) check(`collides: ${name}`, ok);

// ---------- the screen, the lights, the gear ----------
const api = await G(() => {
  const D = window.__game.debug, W = D.world, s = W.places.safehouse, out = {};
  const v0 = s.screen.texture.version;
  for (const m of ['shadow', 'video', 'map', 'threat']) { s.screen.show(m); out[`screen shows ${m}`] = s.screen.mode === m && s.screen.on; }
  out['the pictures are drawn (texture updated)'] = s.screen.texture.version >= v0 + 4;
  { // the threat map: red areas and the citadel's target are on the canvas
    const c = s.screen.texture.image, g2 = c.getContext('2d'), d = g2.getImageData(0, 0, c.width, c.height).data;
    let red = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    out['the threat map has red areas on it'] = red > 1500;
    const v1 = s.screen.texture.version; s.screen.show('threat', { caption: 'בדיקה' }); out["the threat map with a caption of its own redraws"] = s.screen.texture.version > v1 && s.screen.mode === 'threat';
  }
  s.screen.show('video', { caption: 'בדיקה' }); out['a caption of its own'] = s.screen.mode === 'video';
  s.screen.show('off'); out['screen off'] = s.screen.mode === 'off' && !s.screen.on;
  s.gear.take(); out['gear taken: the markers hidden'] = !s.gear.mesh.visible && !s.gear.bags.visible && s.gear.taken;
  s.gear.reset(); out['gear back'] = s.gear.mesh.visible && s.gear.bags.visible && !s.gear.taken;
  out['the gear has a slot for each of the gang'] = Object.keys(s.gear.slots).length === 9;
  return out;
});
for (const [name, ok] of Object.entries(api)) check(name, ok);
// at night, inside: the lamps' lights are found in the scene; lights(false) puts them out, the TV's glow stays
await G(() => { const D = window.__game.debug, s = D.world.places.safehouse; D.game.daylight.set(1, 0); window.__game.teleport(s.living.x, s.living.z, s.y); });
await page.waitForFunction(() => { const s = window.__game.debug.world.places.safehouse; return s.lamps.filter((l) => l.light).length >= 6; }, null, { timeout: 120000 }).catch(() => {});
const night = await G(() => {
  const D = window.__game.debug, W = D.world, s = W.places.safehouse, tick = () => W.tick(D.camera, 1 / 60), out = {};
  const house = s.lamps.filter((l) => l.kind !== 'screen'), glow = s.lamps.find((l) => l.kind === 'screen');
  out.found = s.lamps.filter((l) => l.light).length;
  tick();
  out.onLit = house.filter((l) => l.light).every((l) => l.light.intensity > 0);
  out.bulbOn = s.materials.bulb.emissiveIntensity > 0;
  out.windowsOn = s.materials.window.emissiveIntensity > 0;
  s.lights(false); tick();
  out.offDark = house.filter((l) => l.light).every((l) => l.light.intensity === 0);
  out.bulbOff = s.materials.bulb.emissiveIntensity === 0;
  out.lightsOn = s.lightsOn;
  out.tvOffWithPower = s.screen.mode === 'off';
  s.screen.show('shadow'); for (let i = 0; i < 30; i++) W.tick(D.camera, 1 / 30);
  out.glow = glow.light ? glow.light.intensity : -1;
  out.glowRed = glow.light ? glow.light.color.r > 0.8 && glow.light.color.g < 0.4 : false;
  out.stillDark = house.filter((l) => l.light).every((l) => l.light.intensity === 0);
  s.lights(true); tick();
  out.back = house.filter((l) => l.light).every((l) => l.light.intensity > 0) && s.materials.bulb.emissiveIntensity > 0;
  out.tvKept = s.screen.mode === 'shadow';
  s.reset(); tick();
  s.balconyDoor.lock(); s.reset(); tick();
  out.reset = s.lightsOn && s.screen.mode === 'off' && s.door.open && s.gear.mesh.visible && s.balconyDoor.open && !s.balconyDoor.locked;
  D.game.daylight.set(0, 0);
  return out;
});
check('night: the place found its lamps in the scene', night.found >= 6, `${night.found} of the lamps`);
check('night: the lamps are lit', night.onLit && night.bulbOn && night.windowsOn);
check('lights(false): every lamp of the place out, the bulbs dark', night.offDark && night.bulbOff && night.lightsOn === false);
check('lights(false): the TV goes off with the power', night.tvOffWithPower);
check("screen.show('shadow') in the dark: the TV glows red, the lamps stay out", night.glow > 0 && night.glowRed && night.stillDark, `glow ${night.glow}`);
check('lights(true): the lamps come back, the TV keeps its picture', night.back && night.tvKept);
check('reset(): lights on, TV off, both doors open, gear back', night.reset);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
