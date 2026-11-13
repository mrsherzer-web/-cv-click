// Mission 48 ("השיירה האחרונה") played on the stage harness: a save with mission 47 done, the mission beginning by
// itself in the safe house's yard; the quiet drive at the head of the convoy (the radio); the far blast and the
// red sky, Ido's and Erez's lines word for word; the rivals out of the side tracks; the chase (barricades with a
// gap, things by the road that warn and go up, the stretch of cars head-on dodged lane by lane, the cars behind,
// Avraham at the back window); the bridge blown in plain sight and Muller's line; the service road, the big blast
// behind them, the service gate, the scene; mission 49 begins. The driving is the game's own car and physics on
// the debug autopilot (as in stage-q), steered lane by lane through the stretch from what is on the road. A forced
// fail at each checkpoint (the Renault wrecked; into the ravine) is retried, and a reload in the chase is picked up
// at its checkpoint.
//   node tests/m48.test.mjs   (after node tools/build-single.mjs)
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: ['dawn'], first: 'lastconvoy' });
const { check, S, G, step, until, talkThrough, said, snap, text, page, holdLoop, markNow, heard, listen, reload } = t;
const line = (k) => L.lastconvoy[k];
const heardLine = (k) => said(line(k)[1], line(k)[0]);
const look = () => G(() => {
  const g = window.__game.debug.game, W = window.__game.debug.world, R = W.places.lastRoad, m = g.missions.active, head = g.nehorai.bones?.head;
  const crews = ['erez', 'avraham'].every((id) => g.npc(id).inCar === g.car) && ['ido', 'yonati', 'hadar'].every((id) => g.npc(id).inCar && g.npc(id).inCar === g.npc('ido').inCar && g.npc(id).inCar !== g.car) && ['muller', 'dolev', 'liam'].every((id) => g.npc(id).inCar && g.npc(id).inCar === g.npc('muller').inCar && g.npc(id).inCar !== g.npc('ido').inCar && g.npc(id).inCar !== g.car);
  const c = g.car.pos, q = R.roads.hills.nearest(c.x, c.z), sv = R.roads.service.nearest(c.x, c.z);
  return {
    id: m?.def.id ?? null, step: m?.stepIndex ?? null, s: m ? Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) : null,
    preset: g.daylight?.presetName ?? null, bandage: !!head?.getObjectByName('bandage'), mode: g.mode, crews, health: g.car.health,
    car: { x: c.x, z: c.z, y: c.y, speed: g.car.speed }, hills: { s: q.s, d: q.d }, service: { s: sv.s, d: sv.d },
    convoy: m?.convoy?.cars.length ?? 0, bars: R.barricades.filter((b) => b.up).length, truck: R.truck.cleared, bridge: R.bridge.blown,
    pursuit: !!m?.pursuit?.active, rivals: Object.keys(m?.rivals || {}).length, oncoming: (m?.oncoming || []).length, armed: g.paint.armed, kind: g.paint.player?.kind ?? null, allies: g.paint.allies.length,
    gang: ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'].map((id) => { const n = g.npc(id); return { id, car: !!n.inCar, vis: n.visible, x: n.pos.x, z: n.pos.z }; }),
    fail: !g.hud.el.fail.hidden, objective: document.getElementById('objText')?.textContent || '',
  };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const P = await G(() => { const R = window.__game.debug.world.places.lastRoad, h = window.__game.debug.world.places.safehouse; return { yard: { x: h.car.x, z: h.car.z }, cps: R.checkpoints.map((c) => ({ name: c.name, x: c.x, z: c.z, s: c.s })), dodge: { s0: R.dodge.s0, s1: R.dodge.s1 }, fork: R.fork.s, far: R.gates.service.far, gate: { x: R.gates.service.x, z: R.gates.service.z }, ravine: { x: (R.ravine.x0 + R.ravine.x1) / 2, floorY: R.ravine.floorY } }; });
// the autopilot on a route of the last road from where the Renault is ("upTo": stop there, metres short of the end)
const driveRoute = (route, cruise = 15, upTo = null) => G(({ route, cruise, upTo }) => {
  const g = window.__game.debug.game, R = window.__game.debug.world.places.lastRoad;
  let pts = R.pathFrom(route, g.car.pos.x, g.car.pos.z);
  if (upTo) { const k = pts.findIndex((p) => Math.hypot(p.x - upTo.x, p.z - upTo.z) < 3); if (k > 0) pts = pts.slice(0, k + 1); }
  return window.__game.drivePath([['points', pts]], cruise);
}, { route, cruise, upTo });
// on the stretch: the lane with nobody coming down it in the next 70 m (the other one when one is), then the route
const dodgeBot = () => G(() => {
  const g = window.__game.debug.game, R = window.__game.debug.world.places.lastRoad, m = g.missions.active, road = R.roads.hills, c = g.car.pos, me = road.nearest(c.x, c.z);
  if (!m || me.d > 12 || me.s < R.dodge.s0 - 45 || me.s > R.dodge.s1 + 12) return null;
  const lat = (x, z, s) => { const p = road.at(s); return (x - p.x) * p.nx + (z - p.z) * p.nz; };
  const mine = lat(c.x, c.z, me.s) > 0 ? 2 : -2;
  const near = (m.oncoming || []).filter((o) => !o.gone && !o.passed).map((o) => { const q = road.nearest(o.pos.x, o.pos.z); return { s: q.s, lane: lat(o.pos.x, o.pos.z, q.s) > 0 ? 2 : -2 }; }).filter((o) => o.s > me.s && o.s < me.s + 75).sort((a, b) => a.s - b.s)[0];
  const want = near ? -near.lane : 2;
  if (want === window.__lane && g.autopilot && !g.autopilot.done) return want;
  window.__lane = want;
  const pts = []; for (let s = me.s + 6; s < R.dodge.s1 + 14; s += 3) { const p = road.at(s); pts.push({ x: p.x + p.nx * want, z: p.z + p.nz * want }); }
  const end = pts[pts.length - 1]; pts.push(...R.pathFrom('service', end.x, end.z).slice(2));
  window.__game.drivePath([['points', pts]], 15);
  return want;
});
// the Renault kept on the road (the chase's dents are the mission's; the test only needs it to get there)
const healthy = () => G(() => { const g = window.__game.debug.game; if (g.car.health < 45) g.car.repair(); });
const objectives = new Set();
const watch = async () => { const v = await look(); if (v.objective) objectives.add(v.objective); return v; };
let s, v;

// ---------- 0: the yard, the quiet drive ----------
v = await look();
check('mission 48 begins in the safe house\'s yard: Nehorai driving the Renault with Erez and Avraham; Ido leading car two, Muller in car three', v.id === 'lastconvoy' && v.step === 0 && v.mode === 'car' && v.crews && dist(v.car, P.yard) < 4, JSON.stringify({ step: v.step, mode: v.mode, crews: v.crews }));
check('05:30, the sunrise, chapter nine\'s bandage; his marker in hand, the friends with theirs', v.preset === 'sunrise' && v.bandage && v.armed && v.allies === 8, JSON.stringify({ preset: v.preset, bandage: v.bandage, allies: v.allies }));
check('goal "לנסוע בראש השיירה"; the convoy: the two other cars behind; the barricades up, the old truck off the iron road', /לנסוע בראש השיירה/.test(v.objective) && v.convoy === 2 && v.bars === 3 && v.truck, v.objective);
// a forced fail at the first checkpoint: the Renault wrecked
await G(() => window.__game.debug.game.car.hurt(400));
s = await until((s) => s.fail, 4, 'the fail');
check('the Renault wrecked: the fail screen, a reason and a tip', !!s && /הרנו נפגעה/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => !s.fail && s.mission?.step === 0, 6, 'the retry');
v = await look();
check('retry: back in the yard, the Renault whole, everyone in his car, the sunrise', !!s && v.health === 100 && v.crews && dist(v.car, P.yard) < 4 && v.preset === 'sunrise', JSON.stringify({ health: v.health, crews: v.crews }));
await markNow();
await driveRoute('convoy', 15);
s = await talkThrough(async () => (await watch()).step >= 1, 120, 'the hills road');
check('the link road and the iron road, quiet: the radio between the cars ("רכב שתיים פה. מוכנים.")', !!s && said('רכב שתיים פה. מוכנים.', 'עידו') && said('ואני כבר מתגעגע למיטה.', 'דולב'), heard.slice(0, 4).join(' | '));
await snap('m48-0-convoy');

// ---------- 1: the far blast, the red sky ----------
s = await talkThrough(async () => (await watch()).step >= 2, 60, 'the far blast');
v = await look();
check(`the far blast at the citadel: "${line('idoSee')[1]}"`, heardLine('idoSee'), heard.filter((l) => l.startsWith('עידו')).join(' | '));
check(`the rivals out of the side tracks: "${line('erezClosing')[1]}"`, heardLine('erezClosing') && v.rivals >= 1, `rivals ${v.rivals}`);
check('the sky turns red', v.preset === 'redSky', v.preset);
check('step 2 "להתחמק ולהמשיך למצודה" (a checkpoint)', v.step === 2 && /להתחמק ולהמשיך למצודה/.test(v.objective), v.objective);
await snap('m48-1-redsky');

// ---------- 2: the chase; a reload in it; a forced fail ----------
s = await talkThrough(async () => { await healthy(); const w = await watch(); return w.hills.s > 48 || w.step !== 2; }, 40, 'into the chase');
s = await reload();
v = await look();
check('a reload in the chase is picked up at its checkpoint: on the hills road, the red sky, the bandage, the convoy, the barricades up', v.id === 'lastconvoy' && v.step === 2 && dist(v.car, P.cps[2]) < 5 && v.preset === 'redSky' && v.bandage && v.crews && v.convoy === 2 && v.bars === 3 && v.armed, JSON.stringify({ step: v.step, preset: v.preset, crews: v.crews, bars: v.bars }));
await G(() => window.__game.debug.game.car.hurt(400));
s = await until((s) => s.fail, 4, 'the fail');
check('wrecked in the chase: the fail screen with a tip', !!s && /הרנו נפגעה/.test(await text('#failReason')));
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => !s.fail && s.mission?.step === 2, 6, 'the retry');
v = await look();
check('retry at the chase\'s checkpoint: the Renault whole on the hills road, the sky still red', !!s && v.health === 100 && dist(v.car, P.cps[2]) < 5 && v.preset === 'redSky' && v.crews);
await markNow();
await driveRoute('service', 15);
const seen = { pursuit: false, rivals: 0, oncoming: 0, lanes: new Set() };
s = await talkThrough(async () => {
  await healthy();
  const w = await watch(), lane = await dodgeBot();
  if (lane != null) seen.lanes.add(lane);
  seen.pursuit ||= w.pursuit; seen.rivals = Math.max(seen.rivals, w.rivals); seen.oncoming = Math.max(seen.oncoming, w.oncoming);
  if (w.oncoming && !seen.shot) { seen.shot = true; await snap('m48-2-dodge'); }
  if (w.step === 2 && !(await G(() => window.__game.debug.game.autopilot && !window.__game.debug.game.autopilot.done))) await driveRoute('service', 15);
  return w.step >= 3;
}, 160, 'the bridge');
v = await look();
check('the barricades: each called on the radio and passed through its gap', said('מחסום! יש פרצה באמצע!') && said('עוד מחסום! הפרצה בצד ימין!') && !v.fail, JSON.stringify(v.s?.bars));
check('things by the road warn (a ring, beeps, a friend) and go up', (v.s.booms || 0) >= 3 && said('משהו מהבהב בצד הדרך! לא לעצור!'), `booms ${v.s.booms}`);
check('the stretch: three cars head-on, in both lanes; dodged lane by lane', v.s.dodgers === 3 && seen.lanes.has(-2) && seen.lanes.has(2) && v.s.dodged >= 2 && said('רכבים באים מולכם! בשני הנתיבים! לזגזג!'), `dodged ${v.s.dodged} hits ${v.s.dodgeHits} lanes ${[...seen.lanes]}`);
check('the Shadow\'s cars behind them, and more out of the side tracks', seen.pursuit && seen.rivals >= 1 && (v.s.rivalsOut || 0) >= 2 && said('אחים, יש לנו זנב! שניים מאחורינו!'), `pursuit ${seen.pursuit} · rivals out ${v.s.rivalsOut} · chase line ${said('אחים, יש לנו זנב! שניים מאחורינו!')}`);
check('Avraham at the back window paints a chaser\'s windscreen; it pulls up', (v.s.painted || 0) >= 1 && said('רגע, אני מטפל בו.', 'אברהם'), `painted ${v.s.painted}`);

// ---------- 3: the bridge; Muller's line ----------
s = await talkThrough(async () => { await healthy(); const w = await watch(); if (w.s?.bridgeBlown && !seen.bridgeShot) { seen.bridgeShot = true; await step(0.6); await snap('m48-3-bridge'); } return w.step >= 4; }, 90, 'the service road');
v = await look();
check('the bridge ahead is blown in plain sight after a warning ("משהו מהבהב על הגשר!")', v.bridge && said('נהוראי! משהו מהבהב על הגשר!') && said('הגשר!!! לעצור!'));
check(`Muller on the radio: "${line('mullerRoad')[1]}"`, heardLine('mullerRoad'));
check('"הגשר נפל · לבחור דרך אחרת", the arrow to the fork; then "בכביש השירות אל המצודה" (a checkpoint)', [...objectives].some((o) => /הגשר נפל · לבחור דרך אחרת/.test(o)) && v.step === 4 && /בכביש השירות אל המצודה/.test(v.objective), [...objectives].join(' / '));

// ---------- 4: a forced fail (the ravine); the service road; the big blast; the gate ----------
await G(({ x, y }) => { const g = window.__game.debug.game; g.stopDriving?.(); window.__game.stopDriving(); g.car.place(x, 60, 0, y + 0.2); }, { x: P.ravine.x, y: P.ravine.floorY });
s = await until((s) => s.fail, 4, 'the fail');
check('into the ravine: the fail screen with a tip', !!s && /לערוץ/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => !s.fail && s.mission?.step === 4, 6, 'the retry');
v = await look();
check('retry on the service road: the Renault whole, the bridge still down, the red sky, everyone in his car', !!s && v.health === 100 && dist(v.car, P.cps[4]) < 5 && v.bridge && v.preset === 'redSky' && v.crews && v.convoy === 2);
await markNow();
await driveRoute('service', 15, P.far);
s = await talkThrough(async () => { await healthy(); const w = await watch(); if (w.s?.bigDone && !seen.bigShot) { seen.bigShot = true; await snap('m48-4-blast'); } if (w.step === 5 && !seen.sceneShot && !w.car.speed) { /* */ } if (w.step === 5 && w.mode === 'foot' && !seen.sceneShot) { seen.sceneShot = true; await step(1.5); await snap('m48-5-citadel'); } return w.id !== 'lastconvoy'; }, 150, 'the gate');
v = await look();
check('the big blast behind them after Muller\'s warning; the road closes on the pursuers ("הם עצרו! הכביש סגור מאחורינו!")', said('כולם עברו את הסיבוב? יש להם מטען על הכביש מאחורינו. אני מפעיל אותו.') && said('הם עצרו! הכביש סגור מאחורינו!') && said('אני יודע.', 'מולר'));
check('at the service gate: out of the cars, the shot of the citadel ("אז זה המקום.")', said('המצודה. לעצור לפני השער.') && said('אז זה המקום.', 'ארז'));
check('mission 48 done; "המלחמה הגדולה" begins', v.id === 'citadel' && (await G(() => window.__game.debug.game.progress.done.includes('lastconvoy'))), JSON.stringify({ id: v.id }));
check('handed over at the gate: Nehorai on foot, every friend out of the cars beside them, the red sky, the bandage, the bridge down', v.mode === 'foot' && v.gang.every((n) => !n.car && n.vis && dist(n, P.far) < 16) && v.preset === 'redSky' && v.bandage && v.bridge, JSON.stringify(v.gang.map((n) => [n.id, n.car, n.vis, Math.round(dist(n, P.far))])));
await t.finish({ walked: false });
