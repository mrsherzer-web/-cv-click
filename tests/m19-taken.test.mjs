// Chapter seven, mission 1: the abduction at the lookout, watched frame by frame. The scene is started the way a
// player starts it (on foot, onto the blue marker) from several situations and must play the same from each:
//   the Renault parked beside the spot where he is taken; the Renault left on the street in the dark car's way
//   (the player arriving in it); Dolev and Ido following him (the way chapter six leaves a friend along); every
//   line tapped away at once; ten frames a second at time scale 2 (a 0.2 s step); a replay from the pause menu in
//   the middle of the drag; the scene cut short (the mission left).
// In every frame of it: his double never has a way of its own (nor do the two men), from the grab to the car's
// door he is within arm's reach of both, nobody else is within 6 m of him, nothing touches the Renault (which
// stands on its one spot at the lookout), the camera is in no body, car or wall; the grab-to-inside time is the
// same every time; his phone is there, falls, lies on the paving and is gone with the scene; the scene reaches
// the gym and step 1 begins with the Renault and the friends where the rest of the mission expects them.
// A screenshot is saved at each beat.
// usage: node tests/m19-taken.test.mjs [url] [screenshot dir] [shots]   ("shots": the first situation only, for its pictures)
import { openStage } from './lib/stage.mjs';

const url = process.argv[2] || undefined;
const shotsDir = process.argv[3] || new URL('../test-results/m19-taken/', import.meta.url).pathname;
const only = process.argv[4] || '';
const t = await openStage({ url, shots: shotsDir, chapter: 7, hold: true });
const { check, G, page } = t;
const LINES = ['נהוראי: ערב יפה. שקט.', 'שומר: נהוראי פרחי? קוצי מוסר דרישת שלום.', 'נהוראי: היי, רגע, מה— ארז! עידו!', 'שומר: בלי טלפון. ברכב, עכשיו.'];

// ---------- in the page: one frame at a time, and what each frame is checked for ----------
await G(() => {
  const D = window.__game.debug, g = D.game, W = D.world, CAST = ['nehorai', 'kg1', 'kg2'];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // a point in a car's own frame (x to its left, z forward)
  const inCar = (car, p) => { const dx = p.x - car.pos.x, dz = p.z - car.pos.z, c = Math.cos(car.yaw), s = Math.sin(car.yaw); return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  const others = () => {
    const out = [];
    for (const [id, n] of g.npcs) if (!CAST.includes(id) && n.visible && !n.inCar) out.push(n);
    for (const n of [...(g.pedestrians?.people || []), ...(g.pubCrowd || [])]) if (n.visible && !n.inCar) out.push(n);
    return out;
  };
  const T = (window.__t = {
    rec: null,
    fresh() {
      T.rec = { frames: 0, self: 0, menWalk: 0, nearest: Infinity, nearestWho: '', reach: 0, dragReach: 0, shoveReach: 0, dragFrames: 0, heldFrames: 0, renaultMoved: 0, renaultToPeople: Infinity, renaultToVan: Infinity, renaultSpeed: 0,
        camBlocked: 0, camInBody: 0, camInCar: 0, vanOnPeople: 0, phoneMissing: 0, playerShown: 0, stall: 0, hauledMax: 0, sinceGain: 0, phases: [], first: {}, renault0: null, vanStop: null, phoneLow: null, cutsceneOff: 0, maxDt: 0 };
    },
    frame(dt) { g.update(dt); W.tick(D.camera, dt); g.daylight?.update?.(dt); T.watch(dt); },
    // the scene as it stands after this frame
    watch(dt) {
      const m = g.missions.active, r = T.rec;
      if (!r || !m || m.def.id !== 'taken' || m.stepIndex !== 0 || !m.sc || m.s.phase === 'black' || m.s.phase === 'gym') return;
      const s = m.s, sc = m.sc, n = g.npcs.get('nehorai'), men = [g.npcs.get('kg1'), g.npcs.get('kg2')], van = m.van, car = g.car, cam = D.camera.position;
      r.frames++; r.maxDt = Math.max(r.maxDt, dt);
      if (r.phases[r.phases.length - 1] !== s.phase) { r.phases.push(s.phase); r.first[s.phase] = { t: s.t, n: { x: n.pos.x, z: n.pos.z }, van: { x: van.pos.x, z: van.pos.z, yaw: van.yaw } }; }
      if (n.target) r.self++;
      for (const k of men) if (k.target) r.menWalk++;
      if (!g.cutscene) r.cutsceneOff++;
      if (g.nehorai.root.visible) r.playerShown++;
      const shown = [n, ...men].filter((q) => q.visible && !q.inCar);
      if (!n.inCar && n.visible) {
        for (const o of others()) { const d = dist(o.pos, n.pos); if (d < r.nearest) { r.nearest = d; r.nearestWho = o.id; } }
        if (['grab', 'drag', 'load'].includes(s.phase)) {
          const d = Math.max(dist(n.pos, men[0].pos), dist(n.pos, men[1].pos));
          if (s.phase === 'load') r.shoveReach = Math.max(r.shoveReach, d); // (pushed into the seat at arm's length)
          else { r.reach = Math.max(r.reach, d); r.heldFrames++; if (s.phase === 'drag') { r.dragReach = Math.max(r.dragReach, d); r.dragFrames++; } }
        }
      }
      if (s.phase === 'drag') { const h = s.hauled || 0; if (h > r.hauledMax + 1e-4) { r.hauledMax = h; r.sinceGain = 0; } else { r.sinceGain += dt; r.stall = Math.max(r.stall, r.sinceGain); } }
      // the Renault: on its one spot, nothing near it
      if (!r.renault0) r.renault0 = { x: car.pos.x, z: car.pos.z, yaw: car.yaw };
      r.renaultMoved = Math.max(r.renaultMoved, dist(car.pos, r.renault0)); r.renaultSpeed = Math.max(r.renaultSpeed, Math.abs(car.speed));
      for (const q of shown) r.renaultToPeople = Math.min(r.renaultToPeople, dist(car.pos, q.pos));
      r.renaultToVan = Math.min(r.renaultToVan, dist(car.pos, van.pos));
      // the dark car never over anybody (but at its doors, as they get in)
      if (s.phase !== 'load') for (const q of shown) { const l = inCar(van, q.pos); if (Math.abs(l.x) < 0.92 + 0.25 && Math.abs(l.z) < 2.08 + 0.25) r.vanOnPeople++; }
      if (s.phase === 'out' && !r.vanStop) r.vanStop = { x: van.pos.x, z: van.pos.z, yaw: van.yaw, toHim: dist(van.pos, n.pos), side: Math.abs(Math.sin(van.yaw) * (n.pos.x - van.pos.x) + Math.cos(van.yaw) * (n.pos.z - van.pos.z)) / dist(van.pos, n.pos), right: inCar(van, n.pos).x < 0 };
      // the camera: in no wall, body or car
      if (W.cols.blocks(cam.x, cam.y, cam.z)) r.camBlocked++;
      for (const q of shown) if (dist(cam, q.pos) < 0.45 && cam.y < q.pos.y + 1.95 && cam.y > q.pos.y - 0.1) r.camInBody++;
      for (const c of [van, car]) { const l = inCar(c, cam); if (Math.abs(l.x) < 1.0 && Math.abs(l.z) < 2.2 && cam.y < c.pos.y + 1.6) r.camInCar++; }
      // his phone
      const ph = D.scene.getObjectByName('taken-phone');
      if (!ph) r.phoneMissing++;
      else if (s.grabAt != null && s.t > s.grabAt + 1) { const v = new D.THREE.Vector3(); ph.getWorldPosition(v); r.phoneLow = { y: v.y - sc.F.y, fromHim: n.inCar ? null : Math.hypot(v.x - n.pos.x, v.z - n.pos.z), lit: !!ph.children[2]?.visible, inHand: ph.parent !== D.scene }; }
    },
    // frames of `dt` until the scene's clock passes `until` (or the scene is over, or `stop` says so); lines tapped
    // away as they come when `skip`
    run({ dt = 1 / 30, until = Infinity, skip = false, max = 4000, toStep = null }) {
      let k = 0;
      for (; k < max; k++) {
        const m = g.missions.active;
        if (!m || m.def.id !== 'taken') break;
        if (toStep != null ? m.stepIndex >= toStep : m.stepIndex !== 0 || m.s.phase === 'gym' || (m.s.phase !== 'black' && m.s.t >= until)) break;
        if (skip && g.dialogue.busy) document.getElementById('caption').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        T.frame(dt);
      }
      const m = g.missions.active;
      return { k, id: m?.def.id ?? null, step: m?.stepIndex ?? null, phase: m?.s.phase ?? null, t: m?.s.t ?? null, at: m?.sc?.at ?? null, s: m ? { grabAt: m.s.grabAt, dragAt: m.s.dragAt, insideAt: m.s.insideAt, hauled: m.s.hauled } : null, len: m?.sc?.len ?? null };
    },
    // how the scene left things (at the gym, or cut short)
    after() {
      const pose = (id) => { const q = g.npcs.get(id); return q ? { visible: q.visible, inCar: !!q.inCar, pose: q.model.pose, lean: Math.abs(q.model.root.rotation.x) + Math.abs(q.model.root.rotation.z), body: q.body.enabled } : null; };
      const G0 = W.places.gymParking;
      return {
        as: g.playingAs, cast: CAST.map(pose), phone: !!D.scene.getObjectByName('taken-phone'), lamps: !!D.scene.getObjectByName('taken-lamps'), van: !!g.missions.active?.van, chase: g.chaseCars.length,
        vans: [...W.cols.dynamic].filter((b) => b.owner?.name === 'van').length,
        buddies: Object.fromEntries(['companion', 'hadarBuddy', 'idoBuddy', 'liamBuddy', 'erezBuddy'].map((b) => [b, { active: g[b].active, held: g[b].held, visible: !!g.npcs.get(g[b].id)?.visible }])),
        carAtGym: Math.hypot(g.car.pos.x - G0.x, g.car.pos.z - G0.z), cutscene: g.cutscene, playerVisible: g.nehorai.root.visible, override: !!g.follow.override, mode: g.mode,
        step: g.missions.active?.stepIndex ?? null, id: g.missions.active?.def.id ?? null,
      };
    },
    // the plaza's frame, as the scene lays it out: e toward the street, s toward the pub's side
    at(e, s) { const p = W.places.plaza; return { x: p.x - p.dx * e - p.dz * s, z: p.z - p.dz * e + p.dx * s }; },
    of(q) { const p = W.places.plaza; return { e: -(q.x - p.x) * p.dx - (q.z - p.z) * p.dz, s: -(q.x - p.x) * p.dz + (q.z - p.z) * p.dx }; },
  });
});

const wait = (ms) => page.waitForTimeout(ms);
// a picture of the scene as it stands (the loop is held: drawn here, once), with no black over it
async function snap(name) {
  await page.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 6000 }).catch(() => {});
  await wait(560);
  await G(() => new Promise((r) => requestAnimationFrame(() => { const D = window.__game.debug; D.renderer.render(D.scene, D.camera); requestAnimationFrame(() => r()); })));
  await page.screenshot({ path: `${shotsDir}/${name}.png` });
}
// the mission begun the way a player begins it: on foot, onto its blue marker
async function begin() {
  await G(() => {
    const g = window.__game.debug.game, p = g.world.places.plaza, mk = { x: p.x - p.dx * 3, z: p.z - p.dz * 3 };
    if (g.mode === 'car') g.exitCar();
    g.player.place(mk.x + 3, mk.z + 3, 0); window.__t.frame(1 / 30);
    g.player.place(mk.x + 0.3, mk.z + 0.2, 1.1);
    for (let k = 0; k < 30 && g.missions.active?.def.id !== 'taken'; k++) window.__t.frame(1 / 30);
  });
  return G(() => window.__game.debug.game.missions.active?.def.id === 'taken');
}
// back to free roam at the lookout as Nehorai, at night as chapter six leaves it, the last run's timers done
async function reset() {
  await wait(2400);
  // (step 1's lines are a chain of their own: run to its end first, so none of them is said into the next scene)
  await G(async () => { const g = window.__game.debug.game, m = g.missions.active; if (m?.def.id !== 'taken' || m.stepIndex !== 1) return; for (let k = 0; k < 60 && !m.s.spoke; k++) { g.dialogue.stop(); await new Promise((r) => setTimeout(r, 0)); } });
  await G(() => {
    const g = window.__game.debug.game;
    g.missions.stop(); g.dialogue.stop();
    g.progress.done = g.progress.done.filter((id) => id !== 'taken');
    for (const b of ['companion', 'hadarBuddy', 'idoBuddy', 'liamBuddy', 'erezBuddy']) { if (g[b].active) g[b].leave(); g[b].held = false; }
    if (g.mode === 'car') g.exitCar();
    const p = g.world.places.plaza; g.player.place(p.x - p.dx * 9, p.z - p.dz * 9, 0);
    for (let k = 0; k < 5; k++) window.__t.frame(1 / 30);
    window.__t.fresh();
  });
}

const BEATS = [['a-walk', (A) => 1.6], ['b-lamps', (A) => A.stop - 2.6], ['b-turns', (A) => A.stop - 1.55], ['b-pullup', (A) => A.stop - 0.55], ['b-out', (A) => A.stop + 0.75], ['b-closing', (A) => A.stop + 2.2], ['c-runs', (A) => A.lunge + 0.3],
  ['c-grab', (A) => A.grab + 0.45], ['c-struggle', (A) => A.grab + 1.4], ['d-heave', (A) => A.drag + 0.7], ['d-digs-in', (A) => A.drag + 1.9], ['d-drag', (A) => A.drag + 2.9], ['d-digs-in-2', (A) => A.drag + 3.6], ['d-last', (A) => A.drag + 4.7],
  ['e-door', (A) => A.door + 0.3], ['e-in', (A) => A.door + 0.95], ['e-away', (A) => A.away + 0.9], ['e-gone', (A) => A.away + 2.6]];

// one playing of the scene: set up, begun, run to the gym with every frame watched; pictures at the beats when asked
async function play(label, { setup = null, dt = 1 / 30, skip = false, pictures = null, expectBuddy = false } = {}) {
  console.log(`\n— ${label} —`);
  await reset();
  if (setup) await G(setup);
  const said0 = await G(() => window.__game.debug.game.dialogue.said);
  check(`${label}: the mission begins at its marker`, await begin());
  // the black, and the plaza set under it
  let r = await G((o) => window.__t.run({ ...o, until: 0 }), { dt, skip });
  const A = r.at, len = r.len;
  check(`${label}: the plaza is set under the black and the scene begins`, !!A && r.phase !== 'black' && r.phase !== null, `phase ${r.phase}`);
  if (!A) return null;
  if (pictures) for (const [name, when] of BEATS) { r = await G((o) => window.__t.run(o), { dt, skip, until: when(A) }); await snap(`${pictures}-${name}`); }
  r = await G((o) => window.__t.run({ ...o, until: Infinity }), { dt, skip });
  const rec = await G(() => window.__t.rec);
  check(`${label}: the scene plays through to the gym`, r.phase === 'gym' && ['stroll', 'arrive', 'out', 'grab', 'drag', 'load', 'away'].every((p) => rec.phases.includes(p)), rec.phases.join(' › '));
  check(`${label}: his double never walks by himself, nor do the two men (no target of their own in any frame)`, rec.self === 0 && rec.menWalk === 0 && rec.frames > 60, `${rec.frames} frames, his ${rec.self}, theirs ${rec.menWalk}`);
  check(`${label}: from the grab to the door he is within arm's reach of both men`, rec.heldFrames > 20 && rec.reach < 1.0 && rec.dragReach < 1.0 && rec.dragFrames > 15 && rec.shoveReach < 1.3, `${rec.reach.toFixed(2)} m at most over ${rec.heldFrames} frames (${rec.dragFrames} of the drag); ${rec.shoveReach.toFixed(2)} m as he is pushed in`);
  check(`${label}: nobody else within 6 m of him, and the player's own body out of the picture`, rec.nearest >= 6 && rec.playerShown === 0, rec.nearest === Infinity ? 'nobody else in sight' : `${rec.nearestWho} at ${rec.nearest.toFixed(1)} m`);
  const spot = await G(() => window.__t.of(window.__t.rec.renault0));
  check(`${label}: the Renault on its spot at the lookout, never moved, nothing near it`, Math.hypot(spot.e + 3.4, spot.s - 8.3) < 0.05 && rec.renaultMoved < 0.02 && rec.renaultSpeed < 0.05 && rec.renaultToPeople > 4 && rec.renaultToVan > 5,
    `at ${spot.e.toFixed(1)}, ${spot.s.toFixed(1)}; people ${rec.renaultToPeople.toFixed(1)} m, the dark car ${rec.renaultToVan.toFixed(1)} m`);
  const vs = rec.vanStop;
  check(`${label}: the dark car stops a few metres from him, its right side to him, and is never over anybody`, !!vs && vs.toHim > 3 && vs.toHim < 6.5 && vs.side < 0.2 && vs.right && rec.vanOnPeople === 0, vs ? `${vs.toHim.toFixed(1)} m, off its beam by ${(Math.asin(vs.side) * 57.3).toFixed(0)}°` : 'no stop seen');
  const s = await G(() => { const m = window.__game.debug.game.missions.active; return m ? { grabAt: m.s.grabAt, dragAt: m.s.dragAt, insideAt: m.s.insideAt } : null; });
  const took = s ? s.insideAt - s.grabAt : NaN, plan = A.inside - A.grab;
  check(`${label}: from the grab to inside the car in its set time`, Math.abs(took - plan) <= dt + 1e-6 && took > 5 && took < 10, `${took.toFixed(2)} s (set ${plan.toFixed(2)} s)`);
  check(`${label}: the drag covers its whole way and never stalls longer than a dig of the heels`, Math.abs(rec.hauledMax - len) < 0.02 && rec.stall < 1.3, `${rec.hauledMax.toFixed(2)} of ${len.toFixed(2)} m; longest hold ${rec.stall.toFixed(2)} s`);
  check(`${label}: the camera in no wall, body or car, and the scene a scene throughout`, rec.camBlocked === 0 && rec.camInBody === 0 && rec.camInCar === 0 && rec.cutsceneOff === 0, `${rec.camBlocked}/${rec.camInBody}/${rec.camInCar}`);
  const ph = rec.phoneLow;
  check(`${label}: his phone is there all through, falls, and lies lit on the paving behind them`, rec.phoneMissing === 0 && !!ph && ph.y < 0.05 && ph.y > -0.02 && ph.lit && !ph.inHand, ph ? `${(ph.y * 100).toFixed(1)} cm up` : 'not seen');
  const heard = await G((n0) => { const d = window.__game.debug.game.dialogue; return d.history.slice(Math.max(0, d.history.length - (d.said - n0))); }, said0);
  check(`${label}: the four lines, word for word and in order`, LINES.every((l, i) => heard[i] === l), heard.slice(0, 4).join(' / ').slice(0, 90));
  // on to step 1 at the gym
  r = await G((o) => window.__t.run({ ...o, toStep: 1 }), { dt, skip });
  const a = await G(() => window.__t.after());
  check(`${label}: step 1 begins at the gym, as Erez, the Renault in the gym's parking`, a.id === 'taken' && a.step === 1 && a.as === 'erez' && a.carAtGym < 0.5 && a.mode === 'foot' && a.playerVisible, `step ${a.step}, as ${a.as}, the car ${a.carAtGym.toFixed(1)} m off`);
  check(`${label}: nothing of the scene is left: the car, its lamps, the phone, the poses, the three figures`, !a.phone && !a.lamps && !a.van && a.chase === 0 && a.vans === 0 && a.cast.every((c) => c && !c.visible && !c.inCar && c.pose === null && c.lean === 0), JSON.stringify(a.cast));
  check(`${label}: the friends who follow are sent home and held, as the rest of the mission expects`, Object.values(a.buddies).every((b) => !b.active && b.held), JSON.stringify(a.buddies).slice(0, 110));
  if (expectBuddy) check(`${label}: (the friends really were along before it)`, expectBuddy.every((b) => b.active && b.visible), JSON.stringify(expectBuddy));
  return { A, rec, len };
}

// ---------- the situations ----------
const runs = {};
runs.beside = await play('the Renault beside him', {
  pictures: 's1',
  setup: () => { const g = window.__game.debug.game, p = window.__t.at(-3.0, 0.6); g.car.place(p.x, p.z, 0.4); },
});
if (only !== 'shots') {
  runs.way = await play("the Renault in the dark car's way, the player arriving in it", {
    setup: () => { const g = window.__game.debug.game, r = window.__game.roadAt('דרך הגבעה', -16, 1.8); g.car.place(r.x, r.z, r.yaw); g.enterCar(); for (let k = 0; k < 4; k++) window.__t.frame(1 / 30); g.exitCar(); },
  });
  await reset();
  const along = await G(() => {
    const g = window.__game.debug.game;
    g.companion.join(); g.idoBuddy.join();
    for (let k = 0; k < 20; k++) window.__t.frame(1 / 30);
    return ['companion', 'idoBuddy'].map((b) => ({ active: g[b].active, visible: g.npc(g[b].id).visible, near: Math.hypot(g.npc(g[b].id).pos.x - g.player.pos.x, g.npc(g[b].id).pos.z - g.player.pos.z) }));
  });
  runs.buddy = await play('Dolev and Ido following him', {
    pictures: 's3', expectBuddy: along,
    setup: () => { const g = window.__game.debug.game; g.companion.join(); g.idoBuddy.join(); for (let k = 0; k < 20; k++) window.__t.frame(1 / 30); const c = g.world.places.carSpot; g.car.place(c.x, c.z, c.yaw); },
  });
  runs.skipped = await play('every line tapped away at once', { skip: true });
  runs.slow = await play('ten frames a second at time scale 2', { dt: 0.2, pictures: 's5' });

  // the same scene every time
  const all = Object.values(runs).filter(Boolean), A0 = all[0].A, v0 = all[0].rec.vanStop, g0 = all[0].rec.first.grab;
  check('the same clock in every situation', all.every((r) => ['stop', 'grab', 'drag', 'door', 'inside', 'away', 'fade'].every((k) => Math.abs(r.A[k] - A0[k]) < 1e-9)), `stop ${A0.stop.toFixed(2)}, grab ${A0.grab.toFixed(2)}, drag ${A0.drag.toFixed(2)}, door ${A0.door.toFixed(2)}, away ${A0.away.toFixed(2)}`);
  check('the dark car stops on the same spot in every situation', all.every((r) => Math.hypot(r.rec.vanStop.x - v0.x, r.rec.vanStop.z - v0.z) < 0.02 && Math.abs(r.rec.vanStop.yaw - v0.yaw) < 0.01));
  check('he is taken on the same spot in every situation', all.every((r) => Math.hypot(r.rec.first.grab.n.x - g0.n.x, r.rec.first.grab.n.z - g0.n.z) < 0.3));

  // ---------- a replay from the pause menu, in the middle of the drag ----------
  console.log('\n— a replay from the pause menu in the middle of the drag —');
  await reset();
  check('replay: the mission begins', await begin());
  let r = await G(() => window.__t.run({ until: 0 }));
  r = await G((A) => window.__t.run({ until: A.drag + 2.4 }), r.at);
  check('replay: (the scene is in the drag)', r.phase === 'drag', r.phase);
  await G(() => { const g = window.__game.debug.game; g.progress.done.push('taken'); window.__t.fresh(); window.__game.replayMission('taken'); });
  r = await G(() => window.__t.run({ until: 0 }));
  let a = await G(() => { const g = window.__game.debug.game, D = window.__game.debug, m = g.missions.active; let phones = 0, lamps = 0; D.scene.traverse((o) => { if (o.name === 'taken-phone') phones++; if (o.name === 'taken-lamps') lamps++; }); return { phones, lamps, replay: !!m?.replay, chase: g.chaseCars.length, vans: [...D.world.cols.dynamic].filter((b) => b.owner?.name === 'van').length, t: m?.s.t }; });
  check('replay: it starts again from the top with one car, one phone, nothing left of the first', r.phase === 'stroll' && a.replay && a.phones === 1 && a.lamps === 1 && a.chase === 1 && a.vans === 1 && a.t < 0.2, JSON.stringify(a));
  r = await G(() => window.__t.run({ until: Infinity }));
  let rec = await G(() => window.__t.rec);
  check('replay: and plays through to the gym as ever', r.phase === 'gym' && rec.self === 0 && rec.reach < 1.0 && rec.vanOnPeople === 0 && rec.camInBody === 0 && Math.abs(rec.hauledMax - r.len) < 0.02, `${rec.phases.join(' › ')}`);
  r = await G(() => window.__t.run({ toStep: 1 }));
  // a retry of the drive (its checkpoint): the scene's things stay gone, the team is there
  a = await G(() => { const g = window.__game.debug.game, m = g.missions.active; g.dialogue.stop(); g.missions.enterStep(2); m.def.restore(m, g, 2); g.missions.enterStep(2); for (let k = 0; k < 10; k++) window.__t.frame(1 / 30); return { ...window.__t.after(), squad: g.squad.active, ids: g.squad.ids.length }; });
  check('a retry at the checkpoint: as Erez with the team, nothing of the scene back', a.step === 2 && a.as === 'erez' && a.squad && a.ids === 7 && !a.phone && !a.van && a.cast.every((c) => !c.visible), `step ${a.step}, ${a.ids} friends`);

  // ---------- the scene cut short ----------
  console.log('\n— the scene cut short in the middle of the drag (Dolev along) —');
  await reset();
  await G(() => { const g = window.__game.debug.game; g.companion.join(); for (let k = 0; k < 20; k++) window.__t.frame(1 / 30); });
  check('cut short: the mission begins', await begin());
  r = await G(() => window.__t.run({ until: 0 }));
  const hiddenIn = await G(() => { const g = window.__game.debug.game; return { dolev: g.npc('dolev').visible, held: g.companion.held, active: g.companion.active }; });
  check('cut short: (Dolev is out of the picture while it plays, and still along)', !hiddenIn.dolev && hiddenIn.held && hiddenIn.active, JSON.stringify(hiddenIn));
  r = await G((A) => window.__t.run({ until: A.drag + 2.4 }), r.at);
  a = await G(() => { const g = window.__game.debug.game; g.missions.stop(); for (let k = 0; k < 45; k++) window.__t.frame(1 / 30); return { ...window.__t.after(), dolevNear: Math.hypot(g.npc('dolev').pos.x - g.player.pos.x, g.npc('dolev').pos.z - g.player.pos.z), renault: window.__t.of(g.car.pos) }; });
  check('cut short: Nehorai is himself again, in the open, the scene gone', a.id === null && a.as === 'nehorai' && a.playerVisible && !a.cutscene && !a.override && !a.phone && !a.lamps && a.chase === 0 && a.vans === 0 && a.cast.every((c) => !c.visible && !c.inCar && c.pose === null && c.lean === 0), JSON.stringify(a.cast));
  check('cut short: Dolev is let go and is with him again; the Renault stays at the lookout', a.buddies.companion.active && !a.buddies.companion.held && a.buddies.companion.visible && a.dolevNear < 16 && Math.hypot(a.renault.e + 3.4, a.renault.s - 8.3) < 0.1, `Dolev ${a.dolevNear.toFixed(1)} m away`);
}
await t.finish({ walked: false });
