// Chapter ten's portals and the other dimension in headless Chromium: game.dimension in and out by day and
// by night (the sky, the fog, the light, the far plane and the minimap come back exactly), the looks a
// mission lays over the hour (sunrise, red sky, sunset), the portal (opens, pulls, contains, grows, closes,
// leaves nothing behind), the orb (grows, flies, becomes a portal), the crossing (the player and a friend
// moved under the white, the world switched, control back, nothing else touched), the overlay's white, system
// message and title card, the new sounds and the two new music loops, and what all of it costs a frame.
// The loop is held and stepped here (game.hold, game.update) so game time is exact at 1-2 frames a second.
// usage: node tests/dimension.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });
// real time, for the audio (its clock and its clean-up timers run in real time): poll until true
async function poll(fn, ms, arg) { const end = Date.now() + ms; for (;;) { const v = await G(fn, arg); if (v || Date.now() > end) return v; await page.waitForTimeout(150); } }

// a finished game: a quiet open world with every friend met
await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify(window.__game.debug.game.progressForChapter(11))));
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
await G(() => {
  const W = window.__game, g = W.debug.game;
  g.missions.stop(); g.cutscene = false; g.setPopulation({ traffic: 0, people: 0 });
  document.getElementById('banner').hidden = true;
  g.hold = true; // the loop stops; the test steps the game itself
  window.__step = (n = 1, render = true) => {
    const W = window.__game, g = W.debug.game, d = g.daylight;
    for (let i = 0; i < n; i++) { g.update(1 / 30); d.update(1 / 30); }
    if (render) { d.sky.follow(W.debug.camera, g.nehorai.root.position); W.debug.world.tick(W.debug.camera, 1 / 30); W.debug.renderer.render(W.debug.scene, W.debug.camera); }
    return W.debug.renderer.info.render.calls;
  };
  window.__count = () => { let n = 0; W.debug.scene.traverse(() => n++); const m = W.debug.renderer.info.memory; return { objects: n, children: W.debug.scene.children.length, geometries: m.geometries, textures: m.textures }; };
  // everything the dimension and the looks may touch, as numbers (compared before and after as one string)
  window.__light = () => {
    const sc = W.debug.scene, cam = W.debug.camera, d = g.daylight, s = d.sky, u = s.dome.material.uniforms, v = (c) => [c.r, c.g, c.b];
    s.follow(cam, g.nehorai.root.position); // as the frame loop does before every draw: the sun's light and the view's reach are current
    const dir = s.sun.position.clone().sub(s.sun.target.position).normalize();
    return {
      top: v(u.top.value), horizon: v(u.horizon.value), sunColor: v(u.sunColor.value), sunDir: u.sunDir.value.toArray(), lightDir: dir.toArray().map((q) => +q.toFixed(5)),
      glow: u.glowAmount.value, moons: u.moonAmount.value, weird: u.weird.value, cracks: u.breakAmount.value,
      fog: v(sc.fog.color), fogNear: sc.fog.near, fogFar: sc.fog.far, background: v(sc.background), ring: v(s.ring.material.color), ringScale: s.ring.scale.toArray(),
      hemi: v(s.hemi.color), ground: v(s.hemi.groundColor), hemiI: s.hemi.intensity, sun: v(s.sun.color), sunI: s.sun.intensity, exposure: W.debug.renderer.toneMappingExposure,
      far: cam.far, night: d.night, target: d.target, motes: !!s.motes, viewLimit: s.viewLimit,
      map: g.minimap.covered, mapLabel: document.getElementById('minimap').getAttribute('aria-label'), dimension: g.dimensionName, static: g.rift.static,
    };
  };
  // the grove's own layer: the place is told when the dimension goes on and off (a spy over whatever is there)
  const P = W.debug.world.places;
  P.grove = P.grove || {};
  const own = P.grove.dimension?.bind(P.grove);
  window.__told = [];
  P.grove.dimension = (on) => { window.__told.push(on); return own?.(on); };
});
const audio = await G(() => { const s = window.__game.debug.game.sound; return { ctx: !!s.ctx, state: s.ctx?.state }; });
check('the game starts (a finished save), sound running', audio.ctx && audio.state === 'running', audio.state);
const baseVoices = await G(() => window.__game.debug.game.sound.voices);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (a, b) => Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).join(', ') || 'nothing';
const violet = (c) => c[2] > c[0] && c[0] > c[1]; // more blue than red, more red than green
const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

// ---------- the other dimension, by day ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1206, 228); g.player.yaw = 1.9; g.follow.snapBehind(1.9); g.follow.pitch = 0.03; g.daylight.set(0, 0); window.__step(4); });
const day0 = await G(() => window.__light());
const calls0 = await G(() => window.__step(1));
const into = await G(() => { const g = window.__game.debug.game; const r = g.dimension('grove'); window.__step(3); return r; });
const dimDay = await G(() => window.__light());
const callsDim = await G(() => window.__step(1));
await snap('dim1-violet-sky-two-moons');
check('game.dimension("grove"): the game is in it (game.dimensionName) and the place was told', into === 'grove' && dimDay.dimension === 'grove' && same(await G(() => window.__told), [true]));
check('in the dimension: the sky, the fog and the light are violet', violet(dimDay.top) && violet(dimDay.horizon) && violet(dimDay.fog) && violet(dimDay.hemi) && violet(dimDay.sun), `top ${dimDay.top.map((q) => q.toFixed(2))}, fog ${dimDay.fog.map((q) => q.toFixed(2))}`);
check('in the dimension: fog hides everything past 80 m and nothing is drawn beyond it', dimDay.fogFar === 80 && dimDay.fogNear < 10 && dimDay.far <= 100 && dimDay.far < day0.far, `fog ${dimDay.fogNear}..${dimDay.fogFar} m, far plane ${day0.far} → ${dimDay.far} m`);
const moons = await G(() => { const g = window.__game.debug.game, u = g.daylight.sky.dome.material.uniforms; const el = (m) => Math.asin(m.y) * 180 / Math.PI, az = (m) => Math.atan2(m.x, m.z); return { amount: u.moonAmount.value, a: el(u.moonA.value), b: el(u.moonB.value), apart: Math.abs(az(u.moonA.value) - az(u.moonB.value)) * 180 / Math.PI, size: u.moonSize.value.toArray(), sun: u.sunColor.value.getHex(), point: g.rift.moonPoint(0) }; });
check('in the dimension: two moons hang near the horizon, the sun is gone', moons.amount === 1 && moons.a > 2 && moons.a < 14 && moons.b > 2 && moons.b < 14 && moons.apart > 10 && moons.apart < 50 && moons.sun === 0 && !!moons.point, `${moons.a.toFixed(1)}° and ${moons.b.toFixed(1)}° up, ${moons.apart.toFixed(0)}° apart`);
check('in the dimension: energy motes drift around the camera (one draw call)', dimDay.motes && await G(() => { const m = window.__game.debug.game.daylight.sky.motes; return !!m && m.isPoints && m.geometry.attributes.position.count > 100; }));
check('in the dimension: the minimap shows "ממד לא ידוע" instead of the map', dimDay.map === 'ממד לא ידוע' && dimDay.mapLabel === 'ממד לא ידוע' && await G(() => { const c = document.getElementById('minimap'), d = c.getContext('2d').getImageData(c.width / 2 - 40, c.height / 2 - 40, 1, 1).data; return !!c.offsetParent && d[3] > 200 && d[2] > d[1]; }));
check('in the dimension: the walkie-talkie flag is static, and a phone call does not get through', dimDay.static === true && await G(() => { const g = window.__game.debug.game; g.dialogue.stop(); g.call('avraham'); return !g.dialogue.busy && /אין קליטה/.test(document.getElementById('toast').textContent); }));
check('the dimension costs few draw calls (no more than the day it replaces, plus the motes)', callsDim <= calls0 + 1, `${calls0} → ${callsDim} calls`);
// the cycle keeps ticking, somebody sets the hour again, rain comes and goes: still the dimension
await G(() => { const g = window.__game.debug.game; g.daylight.set(0.4, 1); g.daylight.setWeather(1, 0.5); window.__step(50, false); g.daylight.setWeather(0, 0.5); window.__step(40, false); });
const dimLater = await G(() => window.__light());
check('the dimension survives the daylight cycle ticking (the hour changed, rain came and went)', violet(dimLater.top) && violet(dimLater.fog) && dimLater.fogFar === 80 && dimLater.moons === 1 && Math.abs(dimLater.night - 0.4) < 1e-9, `night ${dimLater.night}`);
check('game.dimension("grove") again changes nothing and does not tell the place twice', await G(() => { const g = window.__game.debug.game, a = JSON.stringify(window.__light()); g.dimension('grove'); return a === JSON.stringify(window.__light()) && window.__told.length === 1; }));
await G(() => { const g = window.__game.debug.game; g.rift.crack(0.8, 0); window.__step(2); });
check('the sky can come apart (rift.crack)', await G(() => window.__game.debug.game.daylight.sky.dome.material.uniforms.breakAmount.value === 0.8));
await snap('dim2-sky-cracks');
const out = await G(() => { const g = window.__game.debug.game; const r = g.dimension(null); window.__step(3); return r; });
const day1 = await G(() => window.__light());
check('game.dimension(null) by day: sky, fog, light, far plane, minimap and the hour exactly as they were', out === null && same(day0, day1), `differs: ${diff(day0, day1)}`);
check('leaving told the place, and leaving twice is safe', await G(() => { const g = window.__game.debug.game, a = JSON.stringify(window.__light()); g.dimension(null); return a === JSON.stringify(window.__light()) && JSON.stringify(window.__told) === '[true,false]'; }));
check('out of the dimension the map is drawn again and the phone works', await G(() => { const g = window.__game.debug.game; window.__step(3, false); const c = document.getElementById('minimap'); g.call('avraham'); const talks = g.dialogue.busy; g.dialogue.stop(); return g.minimap.covered === null && c.getAttribute('aria-label') === 'מפה' && talks; }));

// ---------- by night, and with the night still falling ----------
await G(() => { const g = window.__game.debug.game; g.daylight.set(1, 0); window.__step(4, false); });
const night0 = await G(() => window.__light());
await G(() => { const g = window.__game.debug.game; g.dimension('grove'); window.__step(40, false); });
const dimNight = await G(() => window.__light());
await G(() => { const g = window.__game.debug.game; g.dimension(null); window.__step(3, false); });
const night1 = await G(() => window.__light());
check('by night: the dimension is as violet as by day', violet(dimNight.top) && violet(dimNight.fog) && dimNight.fogFar === 80 && close(dimNight.top, dimDay.top) && close(dimNight.hemi, dimDay.hemi) && close(dimNight.fog, dimDay.fog));
check('game.dimension(null) by night: everything exactly as it was', same(night0, night1), `differs: ${diff(night0, night1)}`);
const falling = await G(() => {
  const g = window.__game.debug.game, d = g.daylight;
  d.set(0, 0); d.set(1, 4); window.__step(30, false); // a quarter of the way into the night
  const a = window.__light();
  g.dimension('grove'); d.set(0.9, 0); window.__step(20, false); // a mission sets its own hour inside
  g.dimension(null);
  const b = window.__light();
  window.__step(150, false);
  return { a, b, end: d.night };
});
check('entered while the night was falling: on the way out the hour is where it was, and goes on falling', same(falling.a, falling.b) && Math.abs(falling.a.night - 0.25) < 1e-6 && falling.end === 1, `night ${falling.a.night.toFixed(3)} → ${falling.b.night.toFixed(3)} → ${falling.end}`);
// the graphics preset changed while inside (the pause menu): the dimension's fog holds, the new preset's view comes back after
const q = await G(() => {
  const W = window.__game, g = W.debug.game, s = g.daylight.sky, cam = W.debug.camera, sc = W.debug.scene;
  g.daylight.set(0, 0);
  const was = { fogFar: s.fogFar, shadows: s.sun.castShadow, shadowMapSize: s.sun.shadow.mapSize.x };
  g.dimension('grove'); window.__step(2, false);
  s.setQuality({ fogFar: 240, shadows: was.shadows, shadowMapSize: was.shadowMapSize }, cam);
  const farAtOnce = cam.far; // main.js reads this as the preset's own far plane
  window.__step(2); // (sky.follow cuts the view again)
  const inside = { fog: sc.fog.far, far: cam.far };
  g.dimension(null); window.__step(2, false);
  const after = { fog: sc.fog.far, far: cam.far };
  s.setQuality(was, cam);
  return { farAtOnce, inside, after, back: { fog: sc.fog.far, far: cam.far }, was };
});
check('a graphics preset chosen inside the dimension: its fog holds, and the new view distance is there on the way out', q.farAtOnce === 380 && q.inside.fog === 80 && q.inside.far === 96 && q.after.fog === 240 && q.after.far === 380 && q.back.fog === q.was.fogFar, `inside fog ${q.inside.fog} far ${q.inside.far}; after fog ${q.after.fog} far ${q.after.far}`);
check('after all of it the day is still exactly the day', same(day0, await G(() => { window.__game.debug.game.daylight.set(0, 0); window.__step(2, false); return window.__light(); })));

// ---------- the looks: sunrise, red sky, sunset ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(690, -175); g.player.yaw = Math.PI / 2; g.follow.snapBehind(Math.PI / 2); g.follow.pitch = 0.06; g.daylight.set(0, 0); window.__step(3, false); });
const base = await G(() => window.__light());
const rise = await G(() => { const g = window.__game.debug.game; const r = g.daylight.preset('sunrise', { seconds: 0 }); window.__step(3); return { r, name: g.daylight.presetName, L: window.__light() }; });
await snap('dim3-sunrise');
check('daylight.preset("sunrise"): the sun low in the east, its light warm, the horizon pink and orange', rise.r === 'sunrise' && rise.name === 'sunrise' && rise.L.sunDir[0] > 0.9 && rise.L.sunDir[1] > 0.05 && rise.L.sunDir[1] < 0.3 && rise.L.horizon[0] > rise.L.horizon[2] * 1.5 && rise.L.sun[0] > rise.L.sun[2] * 1.5 && rise.L.glow > 0.5, `sun toward ${rise.L.sunDir.map((v) => v.toFixed(2))}`);
check('sunrise: long shadows (the light comes in low, never lower than 11°)', rise.L.lightDir[0] > 0.9 && rise.L.lightDir[1] >= 0.19 && rise.L.lightDir[1] < 0.3, `light from ${rise.L.lightDir.map((v) => v.toFixed(2))}`);
await G(() => { const g = window.__game.debug.game; g.daylight.preset(null, { seconds: 0 }); window.__step(2, false); });
check('preset(null): the afternoon exactly as it was', same(base, await G(() => window.__light())), `differs: ${diff(base, await G(() => window.__light()))}`);
// the red sky comes over seconds
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1100, 10); g.player.yaw = Math.PI / 2; g.follow.snapBehind(Math.PI / 2); g.follow.pitch = 0.08; window.__step(2, false); });
const red = await G(() => {
  const g = window.__game.debug.game, d = g.daylight, p = g.player.pos;
  d.preset('redSky', { seconds: 2, toward: { x: p.x + 300, z: p.z } });
  const at = [];
  for (let i = 0; i < 3; i++) { window.__step(21, false); at.push(window.__light()); }
  window.__step(1);
  return { at, full: window.__light() };
});
await snap('dim4-red-sky');
check('daylight.preset("redSky", { seconds: 2 }): the sky and the light go red, eased in', base.top[2] > red.at[0].top[2] && red.at[0].top[2] > red.at[1].top[2] && red.at[1].top[2] > red.full.top[2] && red.at[0].hemi[1] > red.full.hemi[1] && red.full.top[0] > red.full.top[2] * 3 && red.full.hemi[0] > red.full.hemi[2] * 2 && red.full.fog[0] > red.full.fog[2] * 3 && same(red.at[2], red.full), `the sky's blue ${[base, ...red.at].map((a) => a.top[2].toFixed(3)).join(' → ')}`);
const redOut = await G(() => { const g = window.__game.debug.game; g.daylight.preset(null, { seconds: 1.5 }); window.__step(20, false); const mid = window.__light(); window.__step(40, false); return { mid, end: window.__light(), name: g.daylight.presetName }; });
check('the red sky let go over seconds: back to the afternoon exactly', redOut.name === null && redOut.mid.hemi[1] < base.hemi[1] && redOut.mid.hemi[1] > red.full.hemi[1] && same(base, redOut.end), `differs: ${diff(base, redOut.end)}`);
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(300, 10); g.player.yaw = -Math.PI / 2; g.follow.snapBehind(-Math.PI / 2); g.follow.pitch = 0.06; g.daylight.preset('sunset', { seconds: 0 }); window.__step(3); });
const set = await G(() => window.__light());
await snap('dim5-sunset');
check('daylight.preset("sunset"): the golden hour, the sun low in the west', set.sunDir[0] < -0.85 && set.sunDir[1] > 0.05 && set.sunDir[1] < 0.3 && set.sun[0] > set.sun[2] * 1.5 && set.horizon[0] > set.horizon[2] * 1.3, `sun toward ${set.sunDir.map((v) => v.toFixed(2))}`);
// a look, then the dimension over it, then out: the look is still there as it was; and a look let go at night gives the night back
const stack = await G(() => {
  const g = window.__game.debug.game, d = g.daylight;
  const a = window.__light();
  g.dimension('grove'); window.__step(10, false); const inside = window.__light(); g.dimension(null); window.__step(2, false);
  const b = window.__light();
  d.preset('sunrise', { seconds: 1 }); window.__step(15, false); const cross = d.looks.length; window.__step(30, false);
  const one = d.looks.length, name = d.presetName;
  d.preset(null, { seconds: 0 }); d.set(1, 0); window.__step(2, false);
  const n0 = window.__light();
  d.preset('sunset', { seconds: 0 }); window.__step(5, false); d.preset(null, { seconds: 0 }); window.__step(2, false);
  const n1 = window.__light();
  d.set(0, 0); window.__step(2, false);
  return { a, b, inside, cross, one, name, n0, n1 };
});
check('the dimension over a look and out again leaves the look as it was', same(stack.a, stack.b) && stack.inside.fogFar === 80, `differs: ${diff(stack.a, stack.b)}`);
check('one look crosses over to another (two for a moment, then one), and a look let go at night gives the night back', stack.cross === 2 && stack.one === 1 && stack.name === 'sunrise' && same(stack.n0, stack.n1), `differs: ${diff(stack.n0, stack.n1)}`);

// ---------- the portal ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1700, -60); g.player.yaw = Math.PI / 2; g.follow.snapBehind(Math.PI / 2); g.follow.pitch = 0.1; g.daylight.set(1, 0); window.__step(40); });
// (the friend who is pulled and who carries the orb further down: drawn once now, so his buffers are counted before anything is)
await G(() => { const g = window.__game.debug.game, p = g.player.pos, n = g.npc('erez'); n.idle = null; n.place(p.x + 3, p.z + 2, 0, p.y); n.show(true); window.__step(2); n.show(false); window.__step(1); });
const c0 = await G(() => window.__count());
const callsNo = await G(() => window.__step(1));
const made0 = await G(() => { const g = window.__game.debug.game, p = g.player.pos; window.__p = new g.rift.Portal(g, { at: { x: p.x + 8, z: p.z, y: p.y }, r: 2.4 }); return { state: window.__p.state, inScene: !!window.__p.group.parent, contains: window.__p.contains({ x: p.x + 8, y: p.y, z: p.z }) }; });
check('a new Portal is closed: not in the scene, nothing inside it', made0.state === 'closed' && !made0.inScene && !made0.contains);
const opening = await G(() => { const p = window.__p; let opened = false; p.open(1.2).then(() => { opened = true; }); window.__opened = () => opened; window.__step(12); return { state: p.state, k: p.k, inScene: !!p.group.parent, light: !!p.light.parent, things: window.__game.debug.game.rift.things.size }; });
await snap('dim6-portal-opening');
check('portal.open(1.2): it tears open over the seconds, ticked by the game', opening.state === 'opening' && opening.k > 0.2 && opening.k < 0.5 && opening.inScene && opening.light && opening.things === 1, `k ${opening.k.toFixed(2)} after 0.4 s`);
const callsPortal = await G(() => window.__step(40));
const open = await G(async () => { const p = window.__p; await null; return { state: p.state, k: p.k, r: p.r, scale: p.scale, light: p.light.intensity, opened: window.__opened(), y: p.pos.y - p.floor, hum: !!p.hum?.live }; });
await snap('dim7-portal-open');
check('the portal is open: its promise resolved, its light burns, it hums', open.state === 'open' && open.k === 1 && open.opened && Math.abs(open.scale - 2.4) < 1e-6 && open.light > 20 && open.hum && Math.abs(open.y - 2.7) < 1e-6, `light ${open.light.toFixed(0)}, middle ${open.y.toFixed(2)} m up`);
check('the portal is three draw calls (the disc, the motes, the lightning)', callsPortal - callsNo <= 3 && callsPortal - callsNo >= 1, `${callsNo} → ${callsPortal} calls`);
const inside = await G(() => { const p = window.__p, c = p.pos, f = p.floor; return { mid: p.contains({ x: c.x, y: f, z: c.z }), edge: p.contains({ x: c.x, y: f, z: c.z + 1.0 }), past: p.contains({ x: c.x, y: f, z: c.z + 2.6 }), front: p.contains({ x: c.x - 0.4, y: f, z: c.z }), far: p.contains({ x: c.x - 3, y: f, z: c.z }), above: p.contains({ x: c.x, y: f + 6, z: c.z }), noY: p.contains({ x: c.x, z: c.z }) }; });
check('portal.contains: in the gate yes; beside it, well in front of it or over it no', inside.mid && inside.edge && !inside.past && inside.front && !inside.far && !inside.above && inside.noY, JSON.stringify(inside));
const pull = await G(() => {
  const g = window.__game.debug.game, p = window.__p, at = () => ({ ...g.player.pos }), d = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
  const toward = (a, b) => Math.hypot(p.pos.x - a.x, p.pos.z - a.z) - Math.hypot(p.pos.x - b.x, p.pos.z - b.z);
  const a = at(); for (let i = 0; i < 30; i++) { p.pull(g.player, 3, 1 / 30); window.__step(1, false); }
  const b = at(); p.hold(g.player, 1); for (let i = 0; i < 30; i++) { p.pull(g.player, 3, 1 / 30); window.__step(1, false); }
  const c = at(); p.hold(g.player, 0.5); for (let i = 0; i < 30; i++) { p.pull(g.player, 3, 1 / 30); window.__step(1, false); }
  const e = at(); p.hold(g.player, 0);
  // a friend is dragged the same way
  const n = g.npc('erez'); n.place(a.x, a.z + 3, 0, a.y); n.show(true);
  const n0 = { ...n.pos }; for (let i = 0; i < 30; i++) { p.pull(n, 2, 1 / 30); window.__step(1, false); }
  const n1 = { ...n.pos };
  let inside = false, frames = 0;
  while (!inside && frames++ < 200) { inside = p.pull(g.player, 6, 1 / 30); window.__step(1, false); }
  return { free: d(a, b), toward: toward(a, b), held: d(b, c), half: d(c, e), holding: p.holding(g.player), friend: toward(n0, n1), inside, frames, contains: p.contains(g.player.pos) };
});
check('portal.pull drags the player toward it: 3 m in a second at strength 3', Math.abs(pull.free - 3) < 0.05 && Math.abs(pull.toward - 3) < 0.05, `${pull.free.toFixed(2)} m, ${pull.toward.toFixed(2)} m nearer`);
check('holding on (portal.hold) resists the pull: all of it, or half', pull.held < 0.01 && Math.abs(pull.half - 1.5) < 0.05 && pull.holding === 0, `held ${pull.held.toFixed(2)} m, half held ${pull.half.toFixed(2)} m`);
check('a friend is pulled too, and pull says when the body is inside the gate', Math.abs(pull.friend - 2) < 0.1 && pull.inside && pull.contains, `friend ${pull.friend.toFixed(2)} m nearer; the player inside after ${pull.frames} more frames`);
// what it costs a frame: the CPU side (the game's tick of it) and the draw, portal against none
const cost = await G(() => {
  const W = window.__game, g = W.debug.game, R = W.debug.renderer, sc = W.debug.scene, cam = W.debug.camera, p = window.__p, T = () => performance.now();
  W.teleport(1700, -60); window.__step(2, false);
  // the best of `rounds` batches of n calls each (a busy machine only ever makes a batch slower)
  const time = (n, f, rounds = 1) => { let best = Infinity; for (let r = 0; r < rounds; r++) { const a = T(); for (let i = 0; i < n; i++) f(); best = Math.min(best, (T() - a) / n); } return best; };
  // a whole frame drawn and finished: one pixel read back makes the call wait for the rasteriser
  const gl = R.getContext(), px = new Uint8Array(4), frame = () => { R.render(sc, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const tick = time(100, () => g.rift.update(1 / 30), 5);
  frame();
  const drawOn = time(2, frame, 2);
  p.group.visible = false; p.light.visible = false;
  frame();
  const drawOff = time(2, frame, 2);
  p.group.visible = true; p.light.visible = true;
  return { tick, drawOn, drawOff };
});
check('the portal is cheap: a small fraction of a millisecond of CPU a frame, and a frame with it draws in about the time of one without', cost.tick < 0.5 && cost.drawOn < cost.drawOff * 1.6 + 60, `rift.update ${cost.tick.toFixed(3)} ms a frame; a frame drawn and finished ${cost.drawOff.toFixed(0)} → ${cost.drawOn.toFixed(0)} ms in software rendering (its light and its three draws, the gate filling a third of the view)`);
const grown = await G(() => { const p = window.__p; p.grow(4.2, 1); window.__step(15, false); const mid = p.r; window.__step(20); return { mid, r: p.r, y: p.pos.y - p.floor }; });
await snap('dim8-portal-grown');
check('portal.grow(4.2, 1): it widens over the second and rises so its lower edge stays over the floor', grown.mid > 2.4 && grown.mid < 4.2 && grown.r === 4.2 && Math.abs(grown.y - 4.5) < 1e-6, `${grown.mid.toFixed(2)} → ${grown.r} m`);
const shut = await G(() => { const p = window.__p; p.close(0.6); window.__step(10, false); const mid = { state: p.state, k: p.k, contains: p.contains({ x: p.pos.x, y: p.floor, z: p.pos.z }) }; window.__step(15, false); return { mid, state: p.state, inScene: !!p.group.parent, light: !!p.light.parent, hum: p.hum }; });
check('portal.close(0.6): it shuts, lets nothing in on the way, and leaves the scene', shut.mid.state === 'closing' && !shut.mid.contains && shut.state === 'closed' && !shut.inScene && !shut.light && shut.hum === null);
const again = await G(() => { const p = window.__p; p.open(0); const a = { state: p.state, inScene: !!p.group.parent }; p.dispose(); window.__step(3, false); return { a, things: window.__game.debug.game.rift.things.size, disposed: p.disposed }; });
const c1 = await G(() => window.__count());
check('a shut portal opens again; dispose() takes it out of the scene and out of the game\'s ticking', again.a.state === 'open' && again.a.inScene && again.things === 0 && again.disposed && c0.objects === c1.objects && c0.children === c1.children, `objects ${c0.objects} → ${c1.objects}`);
// the buffers on the graphics card: the camera held still (what else is in view decides what else is
// uploaded), every portal really drawn before it is disposed
const leak = await G(() => {
  const W = window.__game, g = W.debug.game, p = g.player.pos;
  W.teleport(1700, -60); g.player.yaw = Math.PI / 2; g.follow.snapBehind(Math.PI / 2); g.follow.pitch = 0.1;
  window.__step(3); window.__step(1);
  const a = window.__count(), drawn = [];
  for (let i = 0; i < 4; i++) {
    const q = new g.rift.Portal(g, { at: { x: p.x + 8, z: p.z }, r: 2 + i * 0.4, sound: i % 2 === 0 });
    q.open(0.2); window.__step(8); drawn.push(window.__count().geometries - a.geometries);
    q.close(0.1); window.__step(4, false); q.open(0.1); q.grow(3, 0.1); window.__step(4); q.dispose();
  }
  window.__step(2);
  return { a, b: window.__count(), drawn };
});
check('four portals opened, drawn, shut, opened again and disposed: nothing left in the scene or on the graphics card', same(leak.a, leak.b) && leak.drawn.every((n) => n === 3), `each held ${leak.drawn.join(', ')} geometries while open; objects ${leak.a.objects} → ${leak.b.objects}, geometries ${leak.a.geometries} → ${leak.b.geometries}, textures ${leak.a.textures} → ${leak.b.textures}`);
check('their hums have ended', !!(await poll((b) => window.__game.debug.game.sound.voices === b, 20000, baseVoices)), `${await G(() => window.__game.debug.game.sound.voices)} voices (at the start ${baseVoices})`);

// ---------- the orb ----------
const orb = await G(() => {
  const W = window.__game, g = W.debug.game, p = g.player.pos;
  W.teleport(1700, -60); g.player.yaw = Math.PI / 2; g.follow.snapBehind(Math.PI / 2 + 0.5); g.follow.pitch = 0.12;
  const o = window.__o = g.rift.makeOrb({ at: { x: p.x + 2.2, y: p.y + 1.35, z: p.z }, r: 0.3 });
  const rot = o.ball.rotation.y;
  window.__step(20);
  return { r: o.r, spun: o.ball.rotation.y - rot, inScene: !!o.group.parent, bolts: o.bolts.geo.attributes.position.version, light: o.light.intensity };
});
await snap('dim9-orb');
check('makeOrb: a ball of energy that spins and crackles, with its own light', orb.r === 0.3 && orb.spun > 1 && orb.inScene && orb.bolts > 3 && orb.light > 5, `turned ${orb.spun.toFixed(2)} rad in 0.67 s, its lightning redrawn ${orb.bolts} times`);
const big = await G(() => { const o = window.__o; o.setSize(0.8, 0.5); window.__step(8, false); const mid = o.r; window.__step(12); return { mid, r: o.r, bend: o.bendMat.uniforms.uSize.value }; });
await snap('dim10-orb-grown');
check('orb.setSize(0.8, 0.5): it grows, and the bent air around it with it', big.mid > 0.3 && big.mid < 0.8 && big.r === 0.8 && big.bend > 2, `${big.mid.toFixed(2)} → ${big.r} m, the rings reach ${big.bend.toFixed(1)} m`);
const held = await G(() => { const g = window.__game.debug.game, o = window.__o, n = g.npc('erez'), p = g.player.pos; n.place(p.x + 3, p.z + 2, 1.2, p.y); n.show(true); o.setSize(0.3, 0); o.holdBy(n, { forward: 0.5, up: 1.2 }); window.__step(2, false); n.place(p.x + 4, p.z + 3, 0.4, p.y); window.__step(2, false); return { dx: o.pos.x - (n.pos.x + Math.sin(0.4) * 0.5), dz: o.pos.z - (n.pos.z + Math.cos(0.4) * 0.5), dy: o.pos.y - n.pos.y }; });
check('orb.holdBy: it stays in the hands of whoever carries it', Math.abs(held.dx) < 1e-6 && Math.abs(held.dz) < 1e-6 && Math.abs(held.dy - 1.2) < 1e-6);
const thrown = await G(() => {
  const g = window.__game.debug.game, o = window.__o, p = g.player.pos, from = o.pos.clone(), to = { x: p.x + 9, z: p.z };
  let landed = false; o.throwTo(to, 1.0, { arc: 2 }).then(() => { landed = true; });
  window.__landed = () => landed;
  window.__step(15);
  const mid = { flying: o.flying, lift: o.pos.y - (from.y + (g.world.groundHeight(to.x, to.z) + 1.2 - from.y) * 0.5), along: Math.hypot(o.pos.x - from.x, o.pos.z - from.z) / Math.hypot(to.x - from.x, to.z - from.z) };
  return { mid, to };
});
await snap('dim11-orb-thrown');
const landed = await G(async (to) => { const o = window.__o; window.__step(20, false); await null; return { flying: o.flying, d: Math.hypot(o.pos.x - to.x, o.pos.z - to.z), landed: window.__landed() }; }, thrown.to);
check('orb.throwTo: it flies along an arc and arrives (the promise resolves)', thrown.mid.flying && Math.abs(thrown.mid.along - 0.5) < 0.05 && thrown.mid.lift > 1.5 && !landed.flying && landed.d < 1e-6 && landed.landed, `half way: ${thrown.mid.lift.toFixed(2)} m over the straight line`);
const turned = await G(() => { const g = window.__game.debug.game, o = window.__o; const p = window.__p2 = o.toPortal({ r: 3, seconds: 1 }); window.__step(40); return { orbGone: o.disposed && !o.group.parent, isPortal: p instanceof g.rift.Portal, state: p.state, r: p.r, at: Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z), things: g.rift.things.size }; });
await snap('dim12-orb-became-portal');
check('orb.toPortal: where it landed a portal opens, and the orb is gone', turned.orbGone && turned.isPortal && turned.state === 'open' && turned.r === 3 && turned.at < 1e-6 && turned.things === 1);
await G(() => { window.__p2.dispose(); window.__game.debug.game.npc('erez').show(false); window.__step(3, false); });
const orbLeak = await G(() => {
  const W = window.__game, g = W.debug.game, p = g.player.pos;
  window.__step(2); window.__step(1);
  const a = window.__count();
  const o = g.rift.makeOrb({ at: { x: p.x + 2.2, y: p.y + 1.35, z: p.z }, r: 0.4 });
  window.__step(4);
  const held = window.__count().geometries - a.geometries;
  o.throwTo({ x: p.x + 6, z: p.z }, 0.2); window.__step(8, false);
  const q = o.toPortal({ r: 2, seconds: 0.2 }); window.__step(8);
  q.dispose(); window.__step(2);
  return { a, b: window.__count(), held, things: g.rift.things.size };
});
check('an orb made, drawn, thrown, turned into a portal and that disposed: nothing left in the scene or on the graphics card', same(orbLeak.a, orbLeak.b) && orbLeak.held === 3 && orbLeak.things === 0, `the orb held ${orbLeak.held} geometries; objects ${orbLeak.a.objects} → ${orbLeak.b.objects}, geometries ${orbLeak.a.geometries} → ${orbLeak.b.geometries}, textures ${orbLeak.a.textures} → ${orbLeak.b.textures}`);
check('the orb\'s hum and the portals\' have ended', !!(await poll((b) => window.__game.debug.game.sound.voices === b, 20000, baseVoices)), `${await G(() => window.__game.debug.game.sound.voices)} voices (at the start ${baseVoices})`);

// ---------- the crossing ----------
const before = await G(() => {
  const W = window.__game, g = W.debug.game;
  g.daylight.set(0, 0); W.teleport(1700, -60); g.player.yaw = 0.3;
  const n = g.npc('erez'); n.place(1702, -58, 0, g.player.pos.y); n.show(true);
  g.fighter.hp = 61; g.fighter.lastHurt = -1e6; // (hurt a moment ago, as far as the breather that heals him knows)
  g.paint.armPlayer(); g.paint.player.ammo = 7;
  window.__step(3, false);
  window.__log = [];
  window.__arrived = null;
  const keep = () => ({ hp: g.fighter.hp, ammo: g.paint.player?.ammo ?? null, armed: g.paint.armed, money: g.progress.money, done: g.progress.done.length, unlocks: g.progress.unlocks.length, squad: [...(g.squad.ids || [])], playingAs: g.playingAs });
  window.__keep = keep;
  return { light: window.__light(), keep: keep(), y: g.world.groundHeight(1206, 228) };
});
await G(() => {
  const g = window.__game.debug.game;
  g.rift.crossing({
    to: { x: 1206, z: 228, yaw: 1.9 }, also: [{ npc: 'erez', at: { x: 1208, z: 230, yaw: 1.9 } }], dimension: 'grove', seconds: 1.8,
    onMid: () => window.__log.push({ what: 'mid', white: g.overlay.state.white, x: g.player.pos.x, dim: g.dimensionName, cutscene: g.cutscene }),
    onArrive: () => window.__log.push({ what: 'arrive', white: g.overlay.state.white, cutscene: g.cutscene }),
  }).then((ok) => { window.__arrived = ok; });
});
const way = await G(() => { const g = window.__game.debug.game, out = []; for (let i = 0; i < 8; i++) { window.__step(7, i === 4); out.push({ white: +g.overlay.state.white.toFixed(2), x: Math.round(g.player.pos.x), cutscene: g.cutscene, hud: document.getElementById('hud').classList.contains('ov-whiteout') }); } return out; });
await snap('dim13-crossing-white');
const after = await G(async () => { const W = window.__game, g = W.debug.game; window.__step(2); await null; const n = g.npc('erez'); return { p: { ...g.player.pos }, yaw: g.player.yaw, cam: g.follow.yaw, n: { ...n.pos }, nVisible: n.visible, dim: g.dimensionName, white: g.overlay.state.white, cutscene: g.cutscene, arrived: window.__arrived, log: window.__log, keep: window.__keep(), busy: g.rift.crossingNow, hud: document.getElementById('hud').classList.contains('ov-whiteout'), light: window.__light() }; });
await snap('dim14-arrived-in-the-dimension');
check('crossing: the view goes white, and under the white the HUD is hidden and nobody walks', way.some((w) => w.white === 1 && w.hud && w.cutscene) && way[0].white > 0 && way[0].white < 1 && way[0].x === 1700, way.map((w) => w.white).join(' '));
check('crossing: under the white the player and the friend are moved and the dimension switched (onMid sees it)', after.log[0]?.what === 'mid' && after.log[0].white === 1 && Math.abs(after.log[0].x - 1206) < 1 && after.log[0].dim === 'grove' && after.log[0].cutscene === true, JSON.stringify(after.log[0]));
check('crossing: the player lands on the ground at the spot, the camera behind him, the friend beside him', Math.hypot(after.p.x - 1206, after.p.z - 228) < 0.6 && Math.abs(after.p.y - before.y) < 0.05 && Math.abs(after.yaw - 1.9) < 1e-6 && Math.abs(after.cam - (1.9 + Math.PI)) < 1e-6 && Math.hypot(after.n.x - 1208, after.n.z - 230) < 0.6 && after.nVisible, `player ${after.p.x.toFixed(1)}, ${after.p.z.toFixed(1)}; friend ${after.n.x.toFixed(1)}, ${after.n.z.toFixed(1)}`);
check('crossing: the white lifts, control comes back, onArrive runs, the promise resolves', after.white === 0 && !after.hud && after.cutscene === false && after.arrived === true && after.log[1]?.what === 'arrive' && after.log[1].white === 0 && !after.busy && after.dim === 'grove' && after.light.fogFar === 80);
check('crossing: health, the marker and its paint, money, progress, the squad and who is played are untouched', same(before.keep, after.keep), JSON.stringify(after.keep));
// and back again, landing on a spot something solid stands on
const solid = await G(() => {
  const W = window.__game, g = W.debug.game, y = g.world.groundHeight(1700, -60);
  for (let x = 1670; x <= 1740; x += 1) for (let z = -90; z <= -30; z += 1) if (W.blocks(x, y + 1, z) && Math.abs(g.world.groundHeight(x, z, y) - y) < 0.3) return { x, z, y };
  return null;
});
const back = await G((solid) => {
  const W = window.__game, g = W.debug.game, to = solid || { x: 1700, z: -60 };
  g.rift.crossing({ to: { x: to.x, z: to.z, yaw: 0.3, y: to.y }, also: [{ npc: g.npc('erez'), at: { x: to.x + 2, z: to.z + 2, y: to.y } }], dimension: null, seconds: 1.2 });
  window.__step(40, false);
  const p = g.player.pos, n = g.npc('erez').pos;
  return { d: Math.hypot(p.x - to.x, p.z - to.z), blocked: W.blocks(p.x, p.y + 1, p.z), nBlocked: W.blocks(n.x, n.y + 1, n.z), dim: g.dimensionName, white: g.overlay.state.white, cutscene: g.cutscene, moved: Math.hypot(n.x - 1208, n.z - 230) > 100 };
}, solid);
const home = await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1700, -60); g.player.yaw = 0.3; window.__step(3, false); return window.__light(); });
check('crossing back with dimension: null: the world is the world again, exactly', back.dim === null && back.white === 0 && back.cutscene === false && back.moved && same(before.light, home), `differs: ${diff(before.light, home)}`);
check('a safe landing: sent onto a spot where something solid stands, the player is put beside it, not in it', !!solid && !back.blocked && !back.nBlocked && back.d < 4, solid ? `asked for ${solid.x}, ${solid.z} (solid); landed ${back.d.toFixed(2)} m from it` : 'no solid spot found');
// a crossing dropped by a mission's cleanup (fx.resetAtmosphere → overlay.clear) moves nobody
const dropped = await G(async () => {
  const W = window.__game, g = W.debug.game;
  W.teleport(1700, -60);
  let ok = null; g.rift.crossing({ to: { x: 1206, z: 228 }, dimension: 'grove', seconds: 2 }).then((v) => { ok = v; });
  window.__step(10, false);
  const white = g.overlay.state.white;
  g.fx.resetAtmosphere();
  window.__step(60, false);
  await null;
  return { white, ok, x: g.player.pos.x, dim: g.dimensionName, after: g.overlay.state.white, cutscene: g.cutscene, busy: g.rift.crossingNow };
});
check('a crossing in flight is dropped by a cleanup (fx.resetAtmosphere): nobody moved, the white gone, control back', dropped.white > 0 && dropped.ok === false && Math.abs(dropped.x - 1700) < 0.5 && dropped.dim === null && dropped.after === 0 && dropped.cutscene === false && !dropped.busy);
// ...but the staging of a crossing may clean up under its own white (as a restore does) without ending it
const staged = await G(async () => {
  const W = window.__game, g = W.debug.game, d = g.daylight;
  W.teleport(1700, -60);
  d.preset('redSky', { seconds: 0 });
  let ok = null, whiteAtMid = null;
  g.rift.crossing({ to: { x: 1710, z: -60 }, seconds: 1, onMid: () => { g.fx.resetAtmosphere(); d.preset('sunset', { seconds: 0 }); } }).then((v) => { ok = v; });
  window.__step(12, false); // just past the middle
  whiteAtMid = g.overlay.state.white;
  const look = d.presetName;
  window.__step(25, false);
  await null;
  const arrived = { ok, x: g.player.pos.x, white: g.overlay.state.white };
  g.fx.resetAtmosphere(); window.__step(2, false);
  return { whiteAtMid, look, arrived, after: d.presetName, light: window.__light() };
});
check('a cleanup inside a crossing\'s own staging does not end it; a cleanup lets a sky look go', staged.whiteAtMid === 1 && staged.look === 'sunset' && staged.arrived.ok === true && Math.abs(staged.arrived.x - 1710) < 0.6 && staged.arrived.white === 0 && staged.after === null && same(before.light, staged.light), `differs: ${diff(before.light, staged.light)}`);
await G(() => { const g = window.__game.debug.game; g.npc('erez').show(false); g.paint.disarmPlayer?.(); g.fighter.hp = g.fighter.maxHp; });

// ---------- the overlay: white, the system message, the title card ----------
const TEXT = 'DIMENSION UNKNOWN – CONNECTION LOST';
const note = await G((TEXT) => {
  const g = window.__game.debug.game, o = g.overlay, el = o.noticeEl;
  let gone = false; o.notice(TEXT, 1).then(() => { gone = true; });
  window.__gone = () => gone;
  window.__step(3);
  const cs = getComputedStyle(el), r = el.getBoundingClientRect(), map = document.getElementById('minimap').getBoundingClientRect();
  return { text: el.textContent, state: o.state.notice, dir: el.getAttribute('dir'), direction: cs.direction, bidi: cs.unicodeBidi, font: cs.fontFamily, shown: el.classList.contains('on') && r.width > 100, centred: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2, clearOfMap: r.top > map.bottom || r.left > map.right, touch: cs.pointerEvents };
}, TEXT);
await page.waitForTimeout(300);
await snap('dim15-notice');
check('overlay.notice shows the exact text, in the middle of the screen', note.text === TEXT && note.state === TEXT && note.shown && note.centred && note.clearOfMap, note.text);
check('the notice is a monospace system message, left to right and isolated on the right-to-left page, and takes no touch', note.dir === 'ltr' && note.direction === 'ltr' && /isolate/.test(note.bidi) && /mono/i.test(note.font) && note.touch === 'none', `${note.direction}, ${note.bidi}, ${note.font.slice(0, 40)}`);
const noteGone = await G(async () => { const o = window.__game.debug.game.overlay; window.__step(20, false); const still = o.state.notice; window.__step(15, false); await null; return { still, after: o.state.notice, on: o.noticeEl.classList.contains('on'), gone: window.__gone() }; });
check('the notice stays its seconds of game time and goes (its promise resolves)', noteGone.still !== null && noteGone.after === null && !noteGone.on && noteGone.gone);
const white = await G(async () => {
  const g = window.__game.debug.game, o = g.overlay, hud = document.getElementById('hud'), op = () => +getComputedStyle(o.whiteEl).opacity;
  const a = o.white(0.4), a1 = { op: op(), hud: hud.classList.contains('ov-whiteout') };
  o.white(0);
  let out = false, back = false;
  o.whiteOut(0.5).then(() => { out = true; });
  window.__step(8, false); await null;
  const mid = { v: o.state.white, out };
  window.__step(10, false); await null;
  const full = { v: o.state.white, out, op: op(), hud: hud.classList.contains('ov-whiteout'), caption: getComputedStyle(document.getElementById('caption')).visibility, money: getComputedStyle(document.getElementById('money')).visibility };
  o.whiteIn(0.5).then(() => { back = true; });
  window.__step(20, false); await null;
  return { a, a1, mid, full, end: { v: o.state.white, back, hud: hud.classList.contains('ov-whiteout') } };
});
check('overlay.white(k) sets the white at once; below 0.6 the HUD stays', white.a === 0.4 && Math.abs(white.a1.op - 0.4) < 0.01 && !white.a1.hud);
check('overlay.whiteOut(seconds) eases to white in game time and resolves; the HUD but for the captions is hidden under it', white.mid.v > 0.4 && white.mid.v < 0.7 && !white.mid.out && white.full.v === 1 && white.full.out && white.full.op === 1 && white.full.hud && white.full.money === 'hidden' && white.full.caption !== 'hidden', `half way ${white.mid.v.toFixed(2)}`);
check('overlay.whiteIn(seconds) brings the picture and the HUD back and resolves', white.end.v === 0 && white.end.back && !white.end.hud);
const card = await G(() => {
  const g = window.__game.debug.game, o = g.overlay;
  window.__cardDone = false; window.__cardThen = false;
  o.card('NAHORAI FARHI\nTHE FINAL CHAPTER.', 1.2, { then: () => { window.__cardThen = true; } }).then(() => { window.__cardDone = true; });
  const f = document.getElementById('fade'), t = document.getElementById('fadeText');
  return { text: t.textContent, on: f.classList.contains('on'), big: f.classList.contains('ov-card'), dir: t.getAttribute('dir'), fading: g.hud.fading, state: o.state.card };
});
await page.waitForTimeout(900);
await snap('dim16-title-card');
const cardMid = await G(() => { const f = document.getElementById('fade'), t = document.getElementById('fadeText'); return { then: window.__cardThen, done: window.__cardDone, opacity: +getComputedStyle(f).opacity, size: parseFloat(getComputedStyle(t).fontSize), hud: document.getElementById('hud').classList.contains('ov-carded') }; });
check('overlay.card: big title letters on the HUD\'s own black (hud.fade\'s), an English title left to right', card.text === 'NAHORAI FARHI\nTHE FINAL CHAPTER.' && card.on && card.big && card.dir === 'ltr' && card.fading === true && card.state === card.text && cardMid.then && !cardMid.done && cardMid.opacity > 0.95 && cardMid.size >= 24 && cardMid.hud, `${cardMid.size}px`);
const cardEnd = await poll(() => window.__cardDone && !document.getElementById('fade').classList.contains('on') && !window.__game.debug.game.hud.fading, 5000);
await page.waitForTimeout(700);
check('the card ends by itself: the picture comes back, the black is the plain one again', !!cardEnd && await G(() => { const f = document.getElementById('fade'); return !f.classList.contains('ov-card') && !document.getElementById('fadeText').hasAttribute('dir') && !document.getElementById('hud').classList.contains('ov-carded') && window.__game.debug.game.overlay.state.card === null; }));
const cards = await G(async () => {
  const o = window.__game.debug.game.overlay, f = document.getElementById('fade'), t = document.getElementById('fadeText'), wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = [];
  const a = o.card('THE END', 0.5, { stay: true }); await a; seen.push({ text: t.textContent, on: f.classList.contains('on') });
  const b = o.card('סוף', 0.4, { stay: true }); seen.push({ text: t.textContent, on: f.classList.contains('on'), dir: t.getAttribute('dir') }); await b;
  seen.push({ on: f.classList.contains('on') });
  o.card(null); await wait(700);
  seen.push({ on: f.classList.contains('on'), big: f.classList.contains('ov-card') });
  return seen;
});
check('cards follow each other on one black ({ stay: true }), a Hebrew title right to left; card(null) lifts it', cards[0].text === 'THE END' && cards[0].on && cards[1].text === 'סוף' && cards[1].on && cards[1].dir === 'rtl' && cards[2].on && !cards[3].on && !cards[3].big, JSON.stringify(cards));
check('overlay.clear() takes the white and the notice away', await G(() => { const o = window.__game.debug.game.overlay; o.white(1); o.notice('X', 0); o.clear(); return o.state.white === 0 && o.state.notice === null && !document.getElementById('hud').classList.contains('ov-whiteout'); }));

// ---------- the sounds and the two new loops ----------
const heard = await G(() => { const s = window.__game.debug.game.sound; s.thunder(1); s.zap(1); s.zap(0.5, 2); const h = s.portalHum(); window.__hum = h; s.radioStatic(true); s.crowd(true, { intensity: 0.8 }); return { hum: h.live, a: s.atmosphere }; });
const playing = await poll(() => { const s = window.__game.debug.game.sound; return s.voices > 12 && s.timer ? s.voices : 0; }, 3000);
check('thunder, the energy bolt, the portal hum, radio static and the crowd all start', heard.hum && heard.a.static && heard.a.crowd === 0.8 && !!playing, `${playing} voices`);
check('the crowd\'s intensity can be changed while it cheers', await G(() => { const s = window.__game.debug.game.sound, n = s.crowdNode; s.crowd(true, { intensity: 0.3 }); return s.crowdNode === n && s.atmosphere.crowd === 0.3; }));
await page.waitForTimeout(1200);
await G(() => { const s = window.__game.debug.game.sound; window.__hum.set(1.2, 0.8); window.__hum.stop(0.3); s.radioStatic(false); s.crowd(false, { seconds: 0.4 }); });
check('all of them stopped: every source has ended, the timer is off', !!(await poll((b) => { const s = window.__game.debug.game.sound; return !s.staticNode && !s.crowdNode && !s.timer && s.voices === b; }, 20000, baseVoices)), `${await G(() => window.__game.debug.game.sound.voices)} voices (at the start ${baseVoices})`);
await G(() => window.__game.debug.game.sound.music('epic'));
const epic = await poll(() => { const s = window.__game.debug.game.sound; return s.song?.mode === 'epic' && s.voices > 3 && s.timer ? s.voices : 0; }, 4000);
await page.waitForTimeout(1500);
await G(() => window.__game.debug.game.sound.music('home'));
const hm = await G(() => { const s = window.__game.debug.game.sound; return { mode: s.song?.mode, fading: s.fading.map((f) => f.mode), wanted: s.musicMode }; });
check('music("epic") plays, and music("home") takes over from it with a crossfade', !!epic && hm.mode === 'home' && hm.fading.includes('epic') && hm.wanted === 'home', `${epic} voices in the epic loop`);
await page.waitForTimeout(1500);
check('the first two loops are still there: music("action"), music("calm")', await G(() => { const s = window.__game.debug.game.sound; s.music('action', { fade: 0.2 }); const a = s.song?.mode; s.music('calm', { fade: 0.2 }); const c = s.song?.mode; s.music('nonsense'); return a === 'action' && c === 'calm' && s.musicMode === null; }));
check('music off: the songs fade, their voices end, the timer stops', !!(await poll((b) => { const s = window.__game.debug.game.sound; return !s.song && !s.fading.length && !s.timer && s.voices === b; }, 20000, baseVoices)), `${await G(() => window.__game.debug.game.sound.voices)} voices`);
// what they sound like: each rendered offline through the same code, loud enough and never clipping
const levels = await G(async () => {
  const Sound = window.__game.debug.game.sound.constructor, out = {};
  const make = (sec) => {
    const ctx = new OfflineAudioContext(1, 44100 * sec, 44100), s = new Sound();
    s.ctx = ctx; s.master = ctx.createGain(); s.master.gain.value = 0.8; s.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; s.noise = buf;
    return { ctx, s };
  };
  const measure = async (ctx, from) => { const b = await ctx.startRendering(), d = b.getChannelData(0); let peak = 0, sum = 0, n = 0; for (let i = Math.floor(from * 44100); i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; n++; } return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) }; };
  for (const mode of ['epic', 'home']) {
    const { ctx, s } = make(mode === 'epic' ? 18 : 30), song = mode === 'epic' ? s.epicSong() : s.homeSong();
    song.bus.gain.value = s.musicVolume;
    for (let st = 0, t = 0.05; t < ctx.length / 44100 - 0.5; st++, t += song.dt) song.play(st, t);
    out[mode] = await measure(ctx, mode === 'epic' ? 4 : 4);
  }
  { const { ctx, s } = make(3); s.thunder(1); out.thunder = await measure(ctx, 0); }
  { const { ctx, s } = make(1); s.zap(1); out.zap = await measure(ctx, 0); }
  { const { ctx, s } = make(3); s.portalHum(); out.hum = await measure(ctx, 1); }
  { const { ctx, s } = make(3); s.radioStatic(true); out.static = await measure(ctx, 1); }
  { const { ctx, s } = make(5); s.crowd(true, { intensity: 1 }); for (let t = 0.3; t < 4.5; t += 0.4) s.whoop(s.crowdNode, t); out.crowd = await measure(ctx, 2); }
  return out;
});
for (const [k, v] of Object.entries(levels)) check(`${k}: heard (rendered offline) and never clipping`, v.rms > 0.004 && v.peak < 0.98, `peak ${v.peak}, rms ${v.rms}`);

// ---------- what the dimension costs a frame ----------
const dimCost = await G(() => {
  const W = window.__game, g = W.debug.game, R = W.debug.renderer, sc = W.debug.scene, cam = W.debug.camera, T = () => performance.now();
  // the best of `rounds` batches of n calls each (a busy machine only ever makes a batch slower)
  const time = (n, f, rounds = 1) => { let best = Infinity; for (let r = 0; r < rounds; r++) { const a = T(); for (let i = 0; i < n; i++) f(); best = Math.min(best, (T() - a) / n); } return best; };
  const gl = R.getContext(), px = new Uint8Array(4), frame = () => { R.render(sc, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  W.teleport(1206, 228); g.player.yaw = 1.9; g.follow.snapBehind(1.9); g.follow.pitch = 0.03; g.daylight.set(0, 0);
  window.__step(3); frame();
  const day = { update: time(30, () => { g.update(1 / 30); g.daylight.update(1 / 30); }, 5), draw: time(2, frame, 2), calls: R.info.render.calls };
  g.dimension('grove'); window.__step(3); frame();
  const dim = { update: time(30, () => { g.update(1 / 30); g.daylight.update(1 / 30); }, 5), draw: time(2, frame, 2), calls: R.info.render.calls };
  g.dimension(null); window.__step(2, false);
  return { day, dim };
});
check('the dimension costs the CPU nothing to speak of, and is no dearer to draw than the day', dimCost.dim.update < dimCost.day.update + 0.5 && dimCost.dim.draw < dimCost.day.draw * 1.5 + 40, `game.update ${dimCost.day.update.toFixed(2)} → ${dimCost.dim.update.toFixed(2)} ms a frame; a frame drawn and finished ${dimCost.day.draw.toFixed(0)} → ${dimCost.dim.draw.toFixed(0)} ms in software rendering; ${dimCost.day.calls} → ${dimCost.dim.calls} calls`);

// ---------- the game's own frame loop (not stepped): a few real frames with all of it on ----------
const liveIn = await G(async () => {
  const W = window.__game, g = W.debug.game, cam = W.debug.camera, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  W.teleport(1206, 228); g.player.yaw = 1.9; g.follow.snapBehind(1.9);
  g.dimension('grove');
  const p = g.player.pos, portal = window.__p = new g.rift.Portal(g, { at: { x: p.x + Math.sin(1.9) * 9, z: p.z + Math.cos(1.9) * 9 }, r: 2.6 });
  portal.open(0.5);
  const t0 = W.state.time;
  g.hold = false;
  await wait(4000);
  g.hold = true;
  return { frames: W.state.time > t0, far: cam.far, k: portal.k, state: portal.state, fog: W.debug.scene.fog.far };
});
await snap('dim17-portal-in-the-dimension');
const live = await G(async (inside) => {
  const W = window.__game, g = W.debug.game, cam = W.debug.camera, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__p.dispose(); g.dimension(null);
  g.hold = false;
  await wait(2500);
  g.hold = true;
  return { inside, far: cam.far, fog: W.debug.scene.fog.far, name: g.dimensionName };
}, liveIn);
check('in the game\'s own frame loop: the dimension and a portal run, and the view comes back after', live.inside.frames && live.inside.far === 96 && live.inside.fog === 80 && live.inside.k > 0 && live.far === day0.far && live.fog === day0.fogFar && live.name === null, `inside: far ${live.inside.far}, portal ${live.inside.state}; after: far ${live.far}, fog ${live.fog}`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
