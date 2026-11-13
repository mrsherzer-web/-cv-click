// Chapter ten acceptance test, part one (missions 47–49) on the stage harness, in ONE session from the first to the
// last: a save at the start of chapter ten and nothing placed after it — each mission is carried straight on from
// the one before (47 → 48 in the Renault in the yard, 48 → 49 on foot at the citadel's service gate, 49 → 50 at the
// energy hall's door).
//   47 "השקט לפני הסוף": the scene at 05:30 (the balcony, the sunrise, the bandage, the threat map, every line word
//      for word, the card); the gear from the rack; a marker off the table (and a change of mind); the friends; into
//      the Renault while the gang boards the two other cars.
//   48 "השיירה האחרונה": the quiet drive at the head of the convoy (the radio); the far blast and the red sky; the
//      chase with the damage on (barricades with a gap, warned blasts by the road, the stretch of cars head-on dodged
//      lane by lane, the pursuers, Avraham at the back window); the bridge blown in plain sight and Muller's line; the
//      service road, the big blast behind, the gate, the shot of the citadel. The driving is the game's own car and
//      physics on the debug autopilot along the last road's routes (as in stage-q), steered lane by lane through the
//      stretch from what is on the road.
//   49 "המלחמה הגדולה": its six numbered goals word for word, each played with the stick, the interact button, the
//      marker and the squad's order button (the gate and the watch tower, the alarm, the freight lift, the inner
//      gate's wheels with Ido, Muller's bar through three waves, the pylons' discharges timed and the bridges to the
//      tower's door). Guards are marked by the test except one real shot per fight (as stage-t does).
// A forced fail at each checkpoint (leaving the safe house; the Renault wrecked, the ravine; three marks, a
// discharge) is retried there, and one reload in the middle of the group (in 48's chase) is picked up at its
// checkpoint. Every leg on foot is walked with the stick along a path.
//   node tools/build-single.mjs && node tests/stage-u.test.mjs [first mission: 47..49 or its id] [last mission]
// (a part run starts from a save with the missions before it done; its reload is in the middle one of the part)
import { openStage } from './lib/stage.mjs';
import { L, CARDS } from '../src/missions/lines10.js';

const IDS = ['dawn', 'lastconvoy', 'citadel'];
const pick = (a, d) => { if (!a) return d; const n = Number(a); const i = n >= 47 && n <= 49 ? n - 47 : IDS.indexOf(a); return i >= 0 ? i : d; };
const FROM = pick(process.argv[2], 0), TO = Math.max(FROM, pick(process.argv[3], 2));
const RELOAD = IDS[Math.round((FROM + TO) / 2)];
const t = await openStage({ chapter: 10, done: IDS.slice(0, FROM), first: IDS[FROM] });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, text, page, holdLoop, markNow, heard, listen, reload, shoot, markAll, press, jump } = t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const said2 = ([who, line]) => said(line, who);
let s, v;
// every step's goal and arrow, seen as the game runs: the harness's stepping wrapped in the page to note, for each
// mission's step, the first objective on screen and whether the arrow had a target (kept here across the reload)
const GS = {};
const trackGoals = () => G(() => {
  const r = window.__r; if (r.tracked) return; const st = r.step; window.__goals = {};
  r.step = (sec) => {
    st(sec);
    const g = window.__game.debug.game, m = g.missions.active; if (!m) return;
    const e = window.__goals[`${m.def.id}:${m.stepIndex}`] ||= { obj: '', target: false };
    if (!e.obj) e.obj = document.getElementById('objText')?.textContent || '';
    e.target ||= !!g.target;
  };
  r.tracked = true;
});
const pullGoals = async () => { for (const [k, e] of Object.entries(await G(() => window.__goals || {}))) { const o = (GS[k] ||= { obj: '', target: false }); o.obj ||= e.obj; o.target ||= e.target; } };
const reloadHere = async () => { await pullGoals(); const r = await reload(); await trackGoals(); return r; };
// scenes: steps that are a scene only (no arrow while they play)
async function goalsCheck(id, scenes = []) {
  await pullGoals();
  const n = await G((id) => window.__game.debug.game.missions.defs.find((d) => d.id === id).steps.length, id), miss = [];
  for (let i = 0; i < n; i++) { const e = GS[`${id}:${i}`]; if (!e?.obj || (!e.target && !scenes.includes(i))) miss.push(`${i}: ${!e ? 'not seen' : !e.obj ? 'no goal' : 'no arrow'}`); }
  check(`${id}: every one of its ${n} steps had its goal on screen and ${scenes.length ? '(but its scene) ' : ''}a target for the arrow`, !miss.length, miss.join(' · ') || Array.from({ length: n }, (_, i) => GS[`${id}:${i}`]?.obj).join(' / '));
}
await trackGoals();
console.log(`missions ${IDS.slice(FROM, TO + 1).join(' → ')}; the reload in ${RELOAD}`);

// =====================================================================================================================
// 47 · dawn
// =====================================================================================================================
async function dawn() {
  const pt = (expr) => G((expr) => { const g = window.__game.debug.game, W = window.__game.debug.world, h = W.places.safehouse; const q = new Function('g', 'W', 'h', `return (${expr});`)(g, W, h); return q && { x: q.x, z: q.z, y: q.y ?? h.y, yaw: q.yaw }; }, expr);
  const look = () => G(() => {
    const g = window.__game.debug.game, h = window.__game.debug.world.places.safehouse, P = g.paint, head = g.nehorai.bones?.head;
    const npc = (id) => { const n = g.npc(id); return { x: n.pos.x, z: n.pos.z, car: n.inCar ? n.inCar.name || (n.inCar === g.car ? 'renault' : 'car') : null, vis: n.visible }; };
    return {
      preset: g.daylight?.presetName ?? null, bandage: !!head?.getObjectByName('bandage'), wrap: !!(g.nehorai.bones?.elL || g.nehorai.bones?.armL)?.getObjectByName('wrap'),
      screen: h.screen.mode, gear: h.gear.taken, allies: P.allies.length, armed: P.armed, kind: P.kind, chosen: g.progress.marker ?? null, playKind: P.player?.kind ?? null,
      table: (g.missions.active?.table?.items || []).map((i) => (i.holder.visible ? i.kind : '-')).join(','), tableOn: !!g.missions.active?.table?.group.visible,
      me: { x: g.player.pos.x, z: g.player.pos.z }, erez: npc('erez'), ido: npc('ido'), muller: npc('muller'), dolev: npc('dolev'),
      renault: { x: g.car.pos.x, z: g.car.pos.z },
    };
  });
  const line = (k) => L.dawn[k];
  const heardLine = (k) => said(line(k)[1], line(k)[0]);
  const H = { balcony: await pt('h.balcony'), gear: await pt('h.gear'), table: await pt('h.gear.table') };
  const objectives = new Set();

  // ---------- 0: the scene ----------
  s = await S();
  check('47: a save at the start of chapter ten: "השקט לפני הסוף" opens by itself', s.mission?.id === 'dawn' && s.mission.step === 0, JSON.stringify(s.mission));
  s = await until(async (s) => s.cutscene && dist(s.me, H.balcony) < 0.6, 40, 'the balcony');
  s = await until(async () => (await G(() => window.__game.debug.game.dialogue.busy)), 40, 'the first line');
  v = await look();
  check('47: 05:30 on the balcony: the sunrise, Nehorai at the east rail, chapter nine\'s bandage (head and arm) still on', v.preset === 'sunrise' && dist(v.me, H.balcony) < 0.6 && v.bandage && v.wrap, JSON.stringify({ preset: v.preset, d: dist(v.me, H.balcony).toFixed(2), bandage: v.bandage, wrap: v.wrap }));
  await snap('u47-1-balcony');
  s = await talkThrough(() => heardLine('idoLook'), 90, 'the balcony');
  check('47: the balcony, word for word: Erez, Nehorai, Erez, then Ido runs in', ['erezAwake', 'cantSleep', 'today', 'idoLook'].every(heardLine), heard.slice(0, 5).join(' | '));
  v = await look();
  check('47: Erez came out to him, Ido at the balcony door', dist(v.erez, await pt('h.balconySide')) < 1.2 && v.ido.x > 634 && v.ido.z < -185.5, JSON.stringify({ erez: v.erez, ido: v.ido }));
  s = await talkThrough(() => heardLine('mullerMachine'), 90, 'Muller');
  v = await look();
  check('47: inside: the threat map on the screen, Muller explains in his own words, then his line', v.screen === 'threat' && heardLine('mullerMachine') && said('תסתכלו על האדום. כל כתם כזה זה מקום שהמכונה של הצל כבר נוגעת בו.') && dist(v.me, H.balcony) > 8, `screen ${v.screen}`);
  s = await talkThrough(() => heardLine('notLetting'), 60, 'Nehorai');
  const pass = await until(async () => (await G(() => !!window.__game.debug.game.missions.active?.beats)) && (await G(() => !window.__game.debug.game.dialogue.busy)), 10, 'the camera over the friends');
  s = await talkThrough(() => heardLine('everyoneHome'), 90, 'the camera over the friends');
  check('47: "אז אנחנו לא נותנים לה..." then the camera over every friend, then "...כולם חוזרים הביתה."', heardLine('notLetting') && !!pass && heardLine('everyoneHome'), heard.slice(-3).join(' | '));
  check('47: the music swells (the epic theme)', await G(() => window.__game.debug.game.sound?.musicMode === 'epic'), await G(() => window.__game.debug.game.sound?.musicMode));
  let cardSeen = false, tagSeen = false;
  const onBlack = () => G(() => document.getElementById('fade').classList.contains('on'));
  s = await until(async (s) => {
    const t = await text('#fadeText');
    if (!cardSeen) cardSeen = t === CARDS.finalChapter && (await onBlack());
    else if (!tagSeen) tagSeen = t === CARDS.tagline && (await onBlack());
    return s.mission?.step === 1 && !s.cutscene;
  }, 40, 'the card');
  check(`47: the card on black: "${CARDS.finalChapter}", then the chapter's tagline "${CARDS.tagline}", then control back`, cardSeen && tagSeen && !!s && s.mode === 'foot', `${await text('#fadeText')}`);
  await step(0.8);
  check('47: the black lifted off the picture with control back', !(await onBlack()));

  // ---------- 1: the gear (a forced fail first, retried at this checkpoint) ----------
  check('47: step 1 "לאסוף את הציוד" on screen, the arrow at the rack', /לאסוף את הציוד/.test(s.objective) && !!(await G(() => window.__game.debug.game.target)), s.objective);
  await G(() => window.__game.teleport(650 + 150, -175));
  s = await until((s) => s.fail, 6, 'the fail');
  check('47: leaving the safe house fails with a reason and a tip', !!s && /התרחקת מבית המסתור/.test(await text('#failReason')) && /חוזרים לחצר/.test(await text('#failReason')));
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => s.mission?.step === 1 && !s.fail, 10, 'the retry');
  v = await look();
  check('47: retry at the gear: the morning, the bandage, the gear back on the rack, nobody armed, Nehorai in the living room', !!s && v.preset === 'sunrise' && v.bandage && !v.gear && v.allies === 0 && !v.armed && dist(v.me, { x: 634.6, z: -178.4 }) < 0.8, JSON.stringify({ preset: v.preset, gear: v.gear, allies: v.allies, armed: v.armed, me: v.me }));
  let r = await tp(H.gear);
  check('47: walked to the gear room with the stick', r === 'ok', r);
  check('47: "לאסוף את הציוד" pressed at the rack', await interact('לאסוף את הציוד', 8));
  s = await until((s) => s.mission?.step === 2, 15, 'the gear handed out');
  v = await look();
  check('47: the gear handed out: every friend armed with his own marker, the three markers out on the table', !!s && v.gear && v.allies === 8 && v.tableOn && v.table === 'quick,balanced,long', JSON.stringify({ allies: v.allies, table: v.table }));

  // ---------- 2: a marker ----------
  s = await S();
  check('47: step 2 "לבחור רובה"', /לבחור רובה/.test(s.objective), s.objective);
  r = await tp({ x: H.table.x + 0.82, z: H.table.z + 1.15, y: H.table.y }, 0, 0, Math.PI);
  s = await until((s) => /ארוך ומדויק ·/.test(s.objective), 4, 'the description');
  check('47: at the long marker: its one-line description on screen', !!s, s?.objective);
  check('47: "לקחת · ארוך ומדויק" pressed: the kind set and the marker in his hand', await interact('לקחת · ארוך ומדויק', 6));
  s = await until((s) => s.mission?.step === 3, 10, 'the friends');
  v = await look();
  check('47: the long marker in his hand (kind kept in the progress), the HUD shows it', v.armed && v.kind === 'long' && v.chosen === 'long' && v.playKind === 'long' && v.table === 'quick,balanced,-' && /ארוך/.test(await text('#markerKind').catch(() => '')), JSON.stringify({ kind: v.kind, table: v.table }));

  // ---------- 3: the friends (a change of marker, an optional talk, a forced fail) ----------
  check('47: step 3 "לדבר עם החברים (0/3)"', /לדבר עם החברים \(0\/3\)/.test(s.objective), s.objective);
  r = await tp({ x: H.table.x - 0.82, z: H.table.z + 1.15, y: H.table.y }, 0, 0, Math.PI);
  check('47: changed his mind at the table: "לקחת · מהיר"', await interact('לקחת · מהיר', 6) && (await look()).kind === 'quick');
  const dolev = (await look()).dolev;
  await tp(dolev, 1.2, 0, null, { near: 0.6 }); // round the table's end to him (by the table the marker's prompt is the nearer one)
  await markNow();
  check('47: the others answer too: "לדבר עם דולב"', await interact('לדבר עם דולב', 6));
  s = await talkThrough(async () => !(await G(() => window.__game.debug.game.missions.active.s.talking)) && said('רכב שלוש, עם מולר וליאם. ואם מישהו שואל, אני הייתי ער ראשון.'), 30, 'Dolev');
  check('47: Dolev\'s line heard', !!s);
  if (RELOAD === 'dawn') {
    s = await reloadHere();
    s = await until((s) => s.mission?.id === 'dawn' && s.mission.step === 3 && !s.cutscene, 30, 'the resume');
    v = await look();
    check('47: a reload is picked up at the friends\' checkpoint: the morning, the bandage, the quick marker held, the gang at their places', !!s && v.preset === 'sunrise' && v.bandage && v.armed && v.kind === 'quick' && v.table === '-,balanced,long' && v.allies === 8 && dist(v.erez, await pt('g.car.local(-2.3, -0.4)')) < 1.0 && v.screen === 'threat', JSON.stringify({ preset: v.preset, kind: v.kind, table: v.table, allies: v.allies, erez: v.erez }));
  }
  await G(() => window.__game.teleport(650 - 160, -175));
  s = await until((s) => s.fail, 6, 'the fail');
  check('47: leaving now fails too', !!s && /התרחקת/.test(await text('#failReason')));
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => s.mission?.step === 3 && !s.fail, 10, 'the retry');
  v = await look();
  check('47: retry at the friends: back by the table, the marker of his choice in hand, nobody talked to yet, the threat map still up', !!s && v.kind === 'quick' && v.armed && v.allies === 8 && v.table === '-,balanced,long' && /\(0\/3\)/.test(s.objective) && dist(v.me, { x: 641.5, z: -179.8 }) < 0.8 && v.screen === 'threat', s?.objective);
  for (const [id, name, key] of [['muller', 'מולר', 'אני יודע. אבל נחמד לשמוע.'], ['erez', 'ארז', 'כמו תמיד. רק תנסה לא לחזור עם עוד תחבושת. נגמרו לנו.'], ['ido', 'עידו', 'אני? אני הכי זהיר שיש. כמעט תמיד.']]) {
    const n = (await look())[id];
    r = await tp(n, 0, 0, null, { near: 1.5 });
    await markNow();
    const ok = await interact(`לדבר עם ${name}`, 8);
    s = await talkThrough(async () => !(await G(() => window.__game.debug.game.missions.active?.s.talking)) && said(key), 40, name);
    objectives.add((await S()).objective);
    check(`47: "לדבר עם ${name}": what he does today (walked there: ${r})`, ok && !!s, heard.slice(0, 2).join(' | '));
  }
  s = await until((s) => s.mission?.step === 4, 6, 'the cars');
  check('47: the count went up as they answered; step 4 "לעלות לרכב המבצע"', !!s && /לעלות לרכב המבצע/.test(s.objective) && [...objectives].some((o) => /\(2\/3\)/.test(o)), `${s?.objective} · ${[...objectives].join(' / ')}`);

  // ---------- 4: into the Renault; the convoy ----------
  r = await tp(await pt('g.car.local(1.9, 0.3)'), 0, 0, null, { near: 1.0 });
  check('47: "להיכנס לרכב" at the Renault', await interact('להיכנס לרכב', 8), r);
  s = await until((s) => s.mission?.id === 'lastconvoy' || s.mission?.id !== 'dawn', 40, 'the next mission');
  v = await look();
  const crews = await G(() => { const g = window.__game.debug.game; return ['erez', 'avraham'].every((id) => g.npc(id).inCar === g.car) && ['ido', 'yonati', 'hadar', 'muller', 'dolev', 'liam'].every((id) => g.npc(id).inCar && g.npc(id).inCar !== g.car) && g.npc('ido').inCar !== g.npc('muller').inCar; });
  check('47: everyone in the three cars (Erez with Nehorai; Ido leading car two; Muller in car three): 47 done', !!s && crews && (await G(() => window.__game.debug.game.progress.done.includes('dawn'))), JSON.stringify(s?.mission));
  await goalsCheck('dawn', [0]);
  check('47 → 48 carried straight on: "השיירה האחרונה" begins in the car, in the morning, the bandage on, the quick marker kept', s?.mission?.id === 'lastconvoy' && s.mode === 'car' && v.preset === 'sunrise' && v.bandage && v.chosen === 'quick', JSON.stringify({ id: s?.mission?.id, mode: s?.mode, preset: v.preset }));
}

// =====================================================================================================================
// 48 · lastconvoy
// =====================================================================================================================
async function lastconvoy() {
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
  const P = await G(() => { const R = window.__game.debug.world.places.lastRoad, h = window.__game.debug.world.places.safehouse; return { yard: { x: h.car.x, z: h.car.z }, cps: R.checkpoints.map((c) => ({ name: c.name, x: c.x, z: c.z, s: c.s })), far: R.gates.service.far, ravine: { x: (R.ravine.x0 + R.ravine.x1) / 2, floorY: R.ravine.floorY } }; });
  // the autopilot on a route of the last road from where the Renault is ("upTo": stop there)
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
    const near = (m.oncoming || []).filter((o) => !o.gone && !o.passed).map((o) => { const q = road.nearest(o.pos.x, o.pos.z); return { s: q.s, lane: lat(o.pos.x, o.pos.z, q.s) > 0 ? 2 : -2 }; }).filter((o) => o.s > me.s && o.s < me.s + 75).sort((a, b) => a.s - b.s)[0];
    const want = near ? -near.lane : 2;
    if (want === window.__lane && g.autopilot && !g.autopilot.done) return want;
    window.__lane = want;
    const pts = []; for (let s = me.s + 6; s < R.dodge.s1 + 14; s += 3) { const p = road.at(s); pts.push({ x: p.x + p.nx * want, z: p.z + p.nz * want }); }
    const end = pts[pts.length - 1]; pts.push(...R.pathFrom('service', end.x, end.z).slice(2));
    window.__game.drivePath([['points', pts]], 15);
    return want;
  });
  // the Renault kept on the road (the chase's dents are the mission's and they are on; the test only needs it to
  // get there: a repair when it is low, counted)
  let repairs = 0, lowest = 100;
  const healthy = () => G(() => { const g = window.__game.debug.game, h = g.car.health; if (h < 45) { g.car.repair(); return [h, 1]; } return [h, 0]; }).then(([h, r]) => { lowest = Math.min(lowest, h); repairs += r; });
  const objectives = new Set();
  const watch = async () => { const v = await look(); if (v.objective) objectives.add(v.objective); return v; };
  const seen = { pursuit: false, rivals: 0, oncoming: 0, lanes: new Set() };

  // ---------- 0: the yard, the quiet drive ----------
  v = await look();
  check(`48: begins in the safe house's yard${FROM < 1 ? ' (carried on from 47, no save between)' : ''}: Nehorai driving the Renault with Erez and Avraham; Ido leading car two, Muller in car three`, v.id === 'lastconvoy' && v.step === 0 && v.mode === 'car' && v.crews && dist(v.car, P.yard) < 4, JSON.stringify({ step: v.step, mode: v.mode, crews: v.crews }));
  check('48: 05:30, the sunrise, chapter nine\'s bandage; his marker in hand, the friends with theirs', v.preset === 'sunrise' && v.bandage && v.armed && v.allies === 8, JSON.stringify({ preset: v.preset, bandage: v.bandage, allies: v.allies }));
  check('48: goal "לנסוע בראש השיירה"; the two other cars behind; the barricades up, the old truck off the iron road', /לנסוע בראש השיירה/.test(v.objective) && v.convoy === 2 && v.bars === 3 && v.truck, v.objective);
  await G(() => window.__game.debug.game.car.hurt(400));
  s = await until((s) => s.fail, 4, 'the fail');
  check('48: the Renault wrecked: the fail screen, a reason and a tip', !!s && /הרנו נפגעה/.test(await text('#failReason')), await text('#failReason'));
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => !s.fail && s.mission?.step === 0, 6, 'the retry');
  v = await look();
  check('48: retry: back in the yard, the Renault whole, everyone in his car, the sunrise, the bandage, armed', !!s && v.health === 100 && v.crews && dist(v.car, P.yard) < 4 && v.preset === 'sunrise' && v.bandage && v.armed && v.allies === 8 && v.convoy === 2, JSON.stringify({ health: v.health, crews: v.crews }));
  await markNow();
  await driveRoute('convoy', 15);
  s = await talkThrough(async () => (await watch()).step >= 1, 120, 'the hills road');
  check('48: the link road and the iron road, quiet: the radio between the cars', !!s && said('רכב שתיים פה. מוכנים.', 'עידו') && said('ואני כבר מתגעגע למיטה.', 'דולב'), heard.slice(0, 4).join(' | '));
  await snap('u48-0-convoy');

  // ---------- 1: the far blast, the red sky ----------
  s = await talkThrough(async () => (await watch()).step >= 2, 60, 'the far blast');
  v = await look();
  check(`48: the far blast at the citadel: "${line('idoSee')[1]}"`, heardLine('idoSee'), heard.filter((l) => l.startsWith('עידו')).join(' | '));
  check(`48: the rivals out of the side tracks: "${line('erezClosing')[1]}"`, heardLine('erezClosing') && v.rivals >= 1, `rivals ${v.rivals}`);
  check('48: the sky turns red', v.preset === 'redSky', v.preset);
  check('48: step 2 "להתחמק ולהמשיך למצודה" (a checkpoint)', v.step === 2 && /להתחמק ולהמשיך למצודה/.test(v.objective), v.objective);

  // ---------- 2: the chase; the reload in it; a forced fail ----------
  s = await talkThrough(async () => { await healthy(); const w = await watch(); return w.hills.s > 48 || w.step !== 2; }, 40, 'into the chase');
  if (RELOAD === 'lastconvoy') {
    s = await reloadHere();
    v = await look();
    check('48: THE RELOAD in the chase is picked up at its checkpoint: on the hills road, the red sky, the bandage, the convoy, the barricades up, armed', v.id === 'lastconvoy' && v.step === 2 && dist(v.car, P.cps[2]) < 5 && v.preset === 'redSky' && v.bandage && v.crews && v.convoy === 2 && v.bars === 3 && v.armed && v.allies === 8, JSON.stringify({ step: v.step, preset: v.preset, crews: v.crews, bars: v.bars }));
  }
  await G(() => window.__game.debug.game.car.hurt(400));
  s = await until((s) => s.fail, 4, 'the fail');
  check('48: wrecked in the chase: the fail screen with a tip', !!s && /הרנו נפגעה/.test(await text('#failReason')));
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => !s.fail && s.mission?.step === 2, 6, 'the retry');
  v = await look();
  check('48: retry at the chase\'s checkpoint: the Renault whole on the hills road, the sky still red, everyone in his car', !!s && v.health === 100 && dist(v.car, P.cps[2]) < 5 && v.preset === 'redSky' && v.crews && v.convoy === 2);
  await markNow();
  await driveRoute('service', 15);
  s = await talkThrough(async () => {
    await healthy();
    const w = await watch(), lane = await dodgeBot();
    if (lane != null) seen.lanes.add(lane);
    seen.pursuit ||= w.pursuit; seen.rivals = Math.max(seen.rivals, w.rivals); seen.oncoming = Math.max(seen.oncoming, w.oncoming);
    if (w.oncoming && !seen.shot) { seen.shot = true; await snap('u48-2-dodge'); }
    if (w.step === 2 && !(await G(() => window.__game.debug.game.autopilot && !window.__game.debug.game.autopilot.done))) await driveRoute('service', 15);
    return w.step >= 3;
  }, 160, 'the bridge');
  v = await look();
  check('48: the chase ran with the damage on (the Renault took dents on the way)', lowest < 100, `lowest ${lowest.toFixed(0)} · repairs ${repairs}`);
  check('48: the barricades: each called on the radio and passed through its gap', said('מחסום! יש פרצה באמצע!') && said('עוד מחסום! הפרצה בצד ימין!') && !v.fail, JSON.stringify(v.s?.bars));
  check('48: things by the road warn (a ring, beeps, a friend) and go up', (v.s.booms || 0) >= 3 && said('משהו מהבהב בצד הדרך! לא לעצור!'), `booms ${v.s.booms}`);
  check('48: the stretch: three cars head-on, in both lanes; dodged lane by lane', v.s.dodgers === 3 && seen.lanes.has(-2) && seen.lanes.has(2) && v.s.dodged >= 2 && said('רכבים באים מולכם! בשני הנתיבים! לזגזג!'), `dodged ${v.s.dodged} hits ${v.s.dodgeHits} lanes ${[...seen.lanes]}`);
  check('48: the Shadow\'s cars behind them, and more out of the side tracks', seen.pursuit && seen.rivals >= 1 && (v.s.rivalsOut || 0) >= 2 && said('אחים, יש לנו זנב! שניים מאחורינו!'), `pursuit ${seen.pursuit} · rivals out ${v.s.rivalsOut}`);
  check('48: Avraham at the back window paints a chaser\'s windscreen; it pulls up', (v.s.painted || 0) >= 1 && said('רגע, אני מטפל בו.', 'אברהם'), `painted ${v.s.painted}`);

  // ---------- 3: the bridge; Muller's line ----------
  s = await talkThrough(async () => { await healthy(); const w = await watch(); if (w.s?.bridgeBlown && !seen.bridgeShot) { seen.bridgeShot = true; await step(0.6); await snap('u48-3-bridge'); } return w.step >= 4; }, 90, 'the service road');
  v = await look();
  check('48: the bridge ahead is blown in plain sight after a warning', v.bridge && said('נהוראי! משהו מהבהב על הגשר!') && said('הגשר!!! לעצור!'));
  check(`48: Muller on the radio: "${line('mullerRoad')[1]}"`, heardLine('mullerRoad'));
  check('48: "הגשר נפל · לבחור דרך אחרת", the arrow to the fork; then "בכביש השירות אל המצודה" (a checkpoint)', [...objectives].some((o) => /הגשר נפל · לבחור דרך אחרת/.test(o)) && v.step === 4 && /בכביש השירות אל המצודה/.test(v.objective), [...objectives].join(' / '));

  // ---------- 4: a forced fail (the ravine); the service road; the big blast; the gate ----------
  await G(({ x, y }) => { const g = window.__game.debug.game; window.__game.stopDriving(); g.car.place(x, 60, 0, y + 0.2); }, { x: P.ravine.x, y: P.ravine.floorY });
  s = await until((s) => s.fail, 4, 'the fail');
  check('48: into the ravine: the fail screen with a tip', !!s && /לערוץ/.test(await text('#failReason')), await text('#failReason'));
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => !s.fail && s.mission?.step === 4, 6, 'the retry');
  v = await look();
  check('48: retry on the service road: the Renault whole, the bridge still down, the red sky, everyone in his car', !!s && v.health === 100 && dist(v.car, P.cps[4]) < 5 && v.bridge && v.preset === 'redSky' && v.crews && v.convoy === 2);
  await markNow();
  await driveRoute('service', 15, P.far);
  s = await talkThrough(async () => { await healthy(); const w = await watch(); if (w.step === 5 && w.mode === 'foot' && !seen.sceneShot) { seen.sceneShot = true; await step(1.5); await snap('u48-5-citadel'); } return w.id !== 'lastconvoy'; }, 150, 'the gate');
  v = await look();
  check('48: the big blast behind them after Muller\'s warning; the road closes on the pursuers', said('כולם עברו את הסיבוב? יש להם מטען על הכביש מאחורינו. אני מפעיל אותו.') && said('הם עצרו! הכביש סגור מאחורינו!') && said('אני יודע.', 'מולר'));
  check('48: at the service gate: out of the cars, the shot of the citadel ("אז זה המקום.")', said('המצודה. לעצור לפני השער.') && said('אז זה המקום.', 'ארז'));
  check('48: done', (await G(() => window.__game.debug.game.progress.done.includes('lastconvoy'))), JSON.stringify({ id: v.id }));
  await goalsCheck('lastconvoy');
  check('48 → 49 carried straight on: "המלחמה הגדולה" begins at the gate, Nehorai on foot, every friend out of the cars beside him, the red sky, the bandage, the bridge down', v.id === 'citadel' && v.mode === 'foot' && v.gang.every((n) => !n.car && n.vis && dist(n, P.far) < 16) && v.preset === 'redSky' && v.bandage && v.bridge, JSON.stringify(v.gang.map((n) => [n.id, n.car, n.vis, Math.round(dist(n, P.far))])));
}

// =====================================================================================================================
// 49 · citadel
// =====================================================================================================================
// the six goals as the spec lists them ("משימות בתוך המצודה"), character for character
const GOALS = ['1. להשתלט על הכניסה.', '2. להשבית את מערכת האזעקה.', '3. להפעיל מעלית משא.', '4. לעזור לעידו לפתוח שער.', '5. להגן על מולר בזמן שהוא ניגש למחשב.', '6. להגיע למגדל המרכזי.'];
async function citadel() {
  const look = () => G(() => {
    const g = window.__game.debug.game, C = window.__game.debug.world.places.citadel, m = g.missions.active, head = g.nehorai.bones?.head;
    const P = g.paint, ally = (id) => P.allies.find((a) => a.npc === g.npc(id));
    return {
      id: m?.def.id ?? null, step: m?.stepIndex ?? null, s: m ? Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) : null,
      preset: g.daylight?.presetName ?? null, bandage: !!head?.getObjectByName('bandage'), mode: g.mode, armed: P.armed, kind: P.player?.kind ?? null, chosen: g.progress.marker ?? null, allies: P.allies.length, hits: P.hits,
      me: { x: g.player.pos.x, z: g.player.pos.z, y: g.player.pos.y }, squad: g.squad.mode, sq: g.squad.ids.slice(),
      gate: C.gates.service.isOpen, inner: C.innerGate.isOpen, alarm: C.alarm.active, lift: { state: C.lift.state, power: C.lift.power, level: C.lift.level }, hall: { locked: C.energyHall.door.locked, open: C.energyHall.door.open },
      gang: ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'].map((id) => { const n = g.npc(id); return { id, vis: n.visible, x: n.pos.x, z: n.pos.z, y: n.pos.y, marked: !!ally(id)?.marked, task: g.squad.tasks.get(id)?.label ?? null }; }),
      guards: P.guards.filter((x) => x.npc.visible && !x.marked).map((x) => x.npc.id), beams: g.energy?.active ?? 0,
      fail: !g.hud.el.fail.hidden, objective: document.getElementById('objText')?.textContent || '', pill: document.getElementById('pursuit')?.textContent || '',
      idoPose: g.npc('ido').model.pose ?? null, lifts: m?.lifts ?? 0,
      work: m?.work ? { t: m.work.t, started: m.work.started, away: m.work.away ?? 0, done: m.work.done } : null, prompt: g.prompt?.label ?? null,
      gangCars: g.chaseCars.filter((c) => /^gang-/.test(c.name || '') && c.model.parent).length, carName: g.car.name,
      carHome: Math.hypot(g.car.pos.x - window.__game.debug.world.places.carSpot.x, g.car.pos.z - window.__game.debug.world.places.carSpot.z),
    };
  });
  const P = await G(() => {
    const C = window.__game.debug.world.places.citadel, q = (p) => p && { x: p.x, z: p.z, y: p.y, yaw: p.yaw }, T = C.towers[1], L = C.lift, I = C.innerGate, s = C.plant.stairs;
    const ps = C.energy.pylons, z0 = Math.min(...ps.map((p) => p.z));
    return {
      y: C.y, gateIn: q(C.gates.service.inside), gateOut: q(C.gates.service.outside), foot: q(T.foot), landing: q(T.landing), top: q(T.top),
      fuse: q(C.alarm.fuseAt), panel: q(C.alarm.panelAt), front3: q(C.stores.fronts[2]), front1: q(C.stores.fronts[0]), sw: q(L.switchAt), liftTop: q(L.topAt), onTop: q(L.onTop),
      exitFoot: q(C.tunnels.exits.north.foot), exitTop: q(C.tunnels.exits.north.top), cross: q(C.tunnels.cross), wheelB: q(I.wheelBAt),
      west: q(C.control.approaches[0].inside), south0: q(C.control.approaches[1].outside),
      rowN: z0, rowS: Math.max(...ps.map((p) => p.z)), plantE: { x: C.toWorld(-26, 34).x, z: C.toWorld(-26, 34).z, y: C.y }, plantIn: { x: C.toWorld(-31, 34).x, z: C.toWorld(-31, 34).z, y: C.y },
      stairsBottom: q(s.bottom), stairsTop: q(s.top), c1: q(C.bridges.c[1]), c0: q(C.bridges.c[0]), a0: q(C.bridges.a[0]), door: q(C.energyHall.doorOutside), computer: q(C.computer.at),
    };
  });
  const objectives = new Set();
  const watch = async () => { const v = await look(); if (v.objective) objectives.add(v.objective); return v; };
  const goalShown = (i) => [...objectives].some((o) => o.startsWith(GOALS[i]));
  // shoved off a work at a spot `by` metres toward `way` (the way he came in: the room's door), as a guard
  // shouldering past him in a narrow room does
  const shove = (at, way, by = 3.5) => G(({ at, way, by }) => { const g = window.__game.debug.game, dx = way.x - at.x, dz = way.z - at.z, d = Math.hypot(dx, dz) || 1; g.player.push((dx / d) * by, (dz / d) * by); }, { at, way, by });
  // a work at a spot carried to its end as a player would: pushed off it, he walks back to it; stopped, he presses
  // its button again ("להמשיך · ..."); `done()`: what its end looks like. { ok, backs, presses }
  const workThrough = async (at, label, done, maxSec, what) => {
    const again = new RegExp(`^(להמשיך · )?${label}$`), r = { ok: false, backs: 0, presses: 0 };
    r.ok = !!(await talkThrough(async () => {
      if (await done()) return true;
      const w = await look(), far = dist(w.me, at);
      if (w.prompt && again.test(w.prompt)) { r.presses++; await press('btnInteract'); await step(1 / 30); }
      else if (far > 1.4 && w.work && !w.work.done) { r.backs++; await tp(at); }
      return false;
    }, maxSec, what));
    return r;
  };
  // a forced fail: three marks on Nehorai (the paint's own strike, as a pellet or a discharge gives it)
  async function forcedFail(stepIdx, re) {
    await G(() => { const P = window.__game.debug.game.paint; for (let i = 0; i < 3; i++) P.strike('test'); });
    const s = await until((s) => s.fail, 4, 'the fail');
    const reason = await text('#failReason');
    check(`49: goal ${stepIdx + 1}: three marks fail it, with a reason and a tip`, !!s && /סומן שלוש פעמים/.test(reason) && re.test(reason), reason);
    await page.tap('#retryBtn'); await holdLoop(true);
    return until((s) => !s.fail && s.mission?.step === stepIdx, 6, 'the retry');
  }

  // ---------- the start: at the service gate ----------
  v = await watch();
  check(`49: begins at the citadel's service gate${FROM < 2 ? ' (carried on from 48)' : ''}: Nehorai on foot with the whole gang, the three cars behind`, v.id === 'citadel' && v.step === 0 && v.mode === 'foot' && v.gang.every((n) => n.vis && dist(n, v.me) < 20) && dist(v.me, P.gateOut) < 60, JSON.stringify({ step: v.step, mode: v.mode, d: dist(v.me, P.gateOut).toFixed(0) }));
  check('49: the red sky, chapter nine\'s bandage, his marker of his kind, every friend armed', v.preset === 'redSky' && v.bandage && v.armed && v.allies === 8 && v.kind === (v.chosen ?? v.kind), JSON.stringify({ preset: v.preset, bandage: v.bandage, kind: v.kind, chosen: v.chosen, allies: v.allies }));
  check(`49: goal 1 on screen word for word: "${GOALS[0]}"`, v.objective.startsWith(GOALS[0]), v.objective);
  check('49: the service gate shut', !v.gate);

  // ---------- goal 1: the entrance ----------
  s = await talkThrough(async () => (await watch()).s?.phase === 'lock', 40, 'the scene');
  check('49: the scene at the gate ("זהו, חבר’ה. נכנסים ביחד, יוצאים ביחד.")', said('זהו, חבר’ה. נכנסים ביחד, יוצאים ביחד.', 'נהוראי') && said('שער השירות נעול. תנו לי כמה שניות עם המנעול.', 'מולר'));
  s = await until(async () => (await watch()).s?.phase === 'yard', 40, 'Muller at the lock');
  v = await look();
  check('49: Muller walks to the lock and opens the service gate (a job of his)', !!s && v.gate && /מולר פותח/.test([...objectives].join('|')), [...objectives].join(' / '));
  s = await forcedFail(0, /תחפו עליי|מאחורי/);
  v = await look();
  check('49: retry: back outside the gate, the gate shut again, the gang with him, the marks gone', !!s && !v.gate && v.hits === 0 && v.allies === 8 && v.s.phase !== 'yard', JSON.stringify({ gate: v.gate, hits: v.hits, phase: v.s?.phase }));
  await markNow();
  s = await talkThrough(async () => (await watch()).s?.phase === 'yard', 60, 'the gate again');
  await tp(P.gateIn, 0, 0, Math.PI / 2);
  s = await until(async () => (await look()).guards.length >= 4, 4, 'the guards');
  const real1 = await shoot('og1');
  await markAll(['og2', 'og3', 'og4']);
  s = await talkThrough(async () => (await watch()).s?.phase === 'order', 20, 'the tower');
  check('49: the yard inside the gate: four of the Order marked (one with a real shot)', !!s && real1, `real ${real1}`);
  check('49: Erez: "נשארו שניים על מגדל השמירה..."; the goal asks for the order', said('נשארו שניים על מגדל השמירה. תן פקודה לחפות — ואני מסמן את שניהם.', 'ארז') && /תחפו עליי/.test((await look()).objective));
  await press('btnSquad'); await step(0.3);
  await press('btnSquad'); await step(0.3);
  s = await talkThrough(async () => (await watch()).s?.phase === 'climb', 6, 'the order');
  v = await look();
  check('49: the squad\'s order button: "תחפו עליי!" given (follow → hold → cover); Erez covers', !!s && v.squad === 'cover', v.squad);
  await tp(P.foot);
  await tp(P.landing);
  s = await until(async () => ((await look()).s.pinned || 0) >= 2, 4, 'Erez\'s paint at the tower');
  v = await look();
  check('49: Erez\'s paint flies at the tower and keeps its men down while Nehorai climbs', (v.s.pinned || 0) >= 2 && v.hits === 0, `pinned ${v.s.pinned} · hits ${v.hits}`);
  const real5 = await shoot('og5');
  await tp(P.top);
  await snap('u49-1-tower');
  const real6 = await shoot('og6');
  s = await talkThrough(async () => (await watch()).step >= 1, 20, 'goal 2');
  check('49: the watch tower climbed by its stairs, both of its men marked for real', real5 && real6 && (await look()).me.y > P.y + 2, `${real5} ${real6}`);
  check('49: "הכניסה שלנו!"; goal 2 begins', said('הכניסה שלנו!', 'ארז') && (await look()).step === 1);

  // ---------- goal 2: the alarm ----------
  v = await watch();
  check(`49: goal 2 on screen word for word: "${GOALS[1]}"; the alarm on (sirens, red light)`, v.objective.startsWith(GOALS[1]) && v.alarm, v.objective);
  s = await forcedFail(1, /הנתיך/);
  v = await look();
  check('49: retry at the alarm: inside the service gate, the alarm on again', !!s && v.alarm && dist(v.me, P.gateIn) < 3 && v.hits === 0);
  await markNow();
  await tp(P.front3, 0, -3);
  await tp(P.fuse);
  s = await until(async () => (await look()).gang.filter((n) => (n.id === 'dolev' || n.id === 'avraham') && n.task === 'על הדלת').length === 2, 6, 'Dolev and Avraham');
  check('49: Dolev and Avraham hold the store\'s door', !!s);
  await markAll(['og9', 'og10']);
  check('49: the prompt "לחתוך את הנתיך"', await interact('לחתוך את הנתיך'));
  // half-way he is shoved off it (as the alarm room's guards did, pushing in): the work waits with what it has done
  await step(1.6);
  const w0 = (await look()).work;
  await shove(P.fuse, P.front3);
  await step(0.4);
  v = await watch();
  const pushed = { me: +dist(v.me, P.fuse).toFixed(2), before: +(w0?.t ?? 0).toFixed(2), now: v.work && +v.work.t.toFixed(2), started: v.work?.started, away: v.work && +v.work.away.toFixed(2), objective: v.objective };
  check('49: shoved off the fuse half-way: the work waits where it was (its progress kept, not undone) and the goal says so', !!w0 && w0.t > 1 && pushed.me > 2.6 && v.work.started && v.work.away > 0 && Math.abs(v.work.t - w0.t) < 0.05 && /נדחקת מהנתיך/.test(v.objective), JSON.stringify(pushed));
  await tp(P.fuse);
  v = await look();
  const resumed = !!v.work && (v.work.done || (v.work.started && v.work.away === 0 && v.work.t >= w0.t - 0.05));
  const fuse = await workThrough(P.fuse, 'לחתוך את הנתיך', async () => (await watch()).s?.phase === 'panel', 20, 'the fuse');
  check('49: back at the fuse it goes on by itself from where it stopped, and is cut; the panel next', resumed && fuse.ok && said('אני ואברהם על הדלת של המחסן. אף אחד לא נכנס.', 'דולב'), JSON.stringify({ resumed, work: v.work, ...fuse }));
  s = await talkThrough(async () => ((await look()).s.pairs || 0) >= 1, 30, 'a pair');
  v = await look();
  check('49: while it rings the alarm calls a fresh pair of the Order', (v.s.pairs || 0) >= 1, `pairs ${v.s.pairs}`);
  await markAll(['og7', 'og8', 'og11', 'og12', 'og13', 'og14', 'og15', 'og16']); // (the alarm room's two as well: cleared on the way in, not shoving him off its panel)
  await G(() => { window.__game.debug.game.paint.hits = 0; }); // (the walk across the yard: the test marks the pairs, not the player's luck)
  const atPanel = await tp(P.panel);
  await markAll(['og7', 'og8', 'og11', 'og12', 'og13', 'og14', 'og15', 'og16']);
  check('49: the prompt "לכבות את האזעקה" in the alarm room', await interact('לכבות את האזעקה'), await G((at) => { const g = window.__game.debug.game, p = g.player.pos, m = g.missions.active; return `walk ${at} · ${Math.hypot(p.x - at.x, p.z - at.z).toFixed(2)} m from the panel, y ${p.y.toFixed(1)} · prompt ${g.prompt?.label} · phase ${m?.s.phase} · work ${!!m?.work} started ${m?.work?.started} done ${m?.work?.done} · hits ${g.paint.hits} · guards up near ${g.paint.guards.filter((x) => x.npc.visible && !x.marked && Math.hypot(x.npc.pos.x - p.x, x.npc.pos.z - p.z) < 8).map((x) => x.npc.id).join(',')}`.replace('walk [object Object]', 'walk'); }, { ...P.panel, res: atPanel }).then((d) => `${atPanel} · ${d}`));
  const panel = await workThrough(P.panel, 'לכבות את האזעקה', async () => { await markAll(['og11', 'og12', 'og13', 'og14', 'og15', 'og16']); return (await watch()).step >= 2; }, 20, 'goal 3');
  s = panel.ok || null;
  v = await look();
  check('49: the alarm off: the sirens and the red light gone; goal 3 begins', !!s && !v.alarm && said('שקט. אני אוהב שקט.', 'מולר'), JSON.stringify({ alarm: v.alarm, step: v.step }));

  // ---------- goal 3: the freight lift ----------
  v = await watch();
  check(`49: goal 3 on screen word for word: "${GOALS[2]}"; the lift below without power`, v.objective.startsWith(GOALS[2]) && v.lift.state === 'bottom' && !v.lift.power, v.objective);
  s = await forcedFail(2, /המחסנים/);
  check('49: retry at the lift\'s goal: out of the alarm room, the lift below and dark', !!s && !(await look()).lift.power);
  await markNow();
  await tp(P.sw);
  await markAll(['og1']);
  check('49: the prompt "להפעיל את החשמל של המעלית" in store one', await interact('להפעיל את החשמל של המעלית'));
  // shoved off the switch and kept away past the work's patience: it stops, its progress kept, and its button is
  // there again to go on from where it stopped
  await step(0.6);
  const s0 = (await look()).work;
  await shove(P.sw, P.front1);
  await step(6.6);
  v = await watch();
  const stopped = { me: +dist(v.me, P.sw).toFixed(2), before: s0 && +s0.t.toFixed(2), now: v.work && +v.work.t.toFixed(2), started: v.work?.started, objective: v.objective };
  check('49: away from the switch too long: the work stops where it was (progress kept) and the goal says to go on', !!s0 && s0.t > 0.3 && !!v.work && !v.work.started && !v.work.done && Math.abs(v.work.t - s0.t) < 0.05 && /המתג · להמשיך מאיפה שעצרת/.test(v.objective), JSON.stringify(stopped));
  await tp(P.sw);
  check('49: back at it: "להמשיך · להפעיל את החשמל של המעלית"', await interact('להמשיך · להפעיל את החשמל של המעלית'));
  s = await talkThrough(async () => (await watch()).lift.power, 4, 'the power');
  check('49: the switch thrown from where it stopped (the power on)', !!s);
  await tp(P.liftTop);
  check('49: the prompt "לקרוא למעלית"', await interact('לקרוא למעלית'));
  s = await talkThrough(async () => (await look()).lift.state === 'top', 12, 'the lift up');
  check('49: the lift comes up (it really moves)', !!s);
  await tp(P.onTop);
  s = await talkThrough(async () => { const w = await look(); return w.gang.filter((n) => ['erez', 'ido', 'avraham', 'muller', 'dolev', 'liam'].includes(n.id) && Math.abs(n.x - P.onTop.x) < 3 && Math.abs(n.z - P.onTop.z) < 3).length === 6; }, 14, 'the gang aboard');
  check('49: the gang walks onto the platform; Hadar and Yonati stay by the shaft', !!s && (await look()).gang.filter((n) => n.task === 'שומרים על הפיר').length === 2);
  check('49: the prompt "לרדת למנהרות"', await interact('לרדת למנהרות'));
  await snap('u49-2-lift');
  s = await talkThrough(async () => (await watch()).step >= 3, 20, 'down');
  v = await look();
  const riders = v.gang.filter((n) => !['hadar', 'yonati'].includes(n.id));
  check('49: down in the tunnels with the gang (they rode the platform down)', !!s && v.me.y < P.y - 4 && riders.every((n) => n.y < P.y - 4 && dist(n, v.me) < 14), JSON.stringify(riders.map((n) => [n.id, n.y.toFixed(1)])));
  check('49: Hadar and Yonati at the top, the two who came to the shaft marked ("סימנתי אחד! ראשון!")', v.gang.filter((n) => ['hadar', 'yonati'].includes(n.id)).every((n) => n.vis && n.y > P.y - 1) && said('סימנתי אחד! ראשון!', 'יונתי'));

  // ---------- goal 4: the inner gate ----------
  if (RELOAD === 'citadel') s = await reloadHere();
  v = await watch();
  check(`49: ${RELOAD === 'citadel' ? 'a reload in the tunnels is picked up at goal 4\'s checkpoint' : 'goal 4\'s checkpoint'}: below with the gang, Hadar and Yonati at the shaft, the lift down with power, the red sky, the bandage`, v.id === 'citadel' && v.step === 3 && v.me.y < P.y - 4 && v.lift.power && v.lift.state === 'bottom' && v.preset === 'redSky' && v.bandage && v.armed && v.gang.filter((n) => ['hadar', 'yonati'].includes(n.id)).every((n) => n.vis && n.y > P.y - 1), JSON.stringify({ step: v.step, y: v.me.y.toFixed(1), lift: v.lift, preset: v.preset }));
  check(`49: goal 4 on screen word for word: "${GOALS[3]}"`, v.objective.startsWith(GOALS[3]), v.objective);
  s = await forcedFail(3, /הסיור/);
  check('49: retry at the inner gate\'s goal: in the tunnels again', !!s && (await look()).me.y < P.y - 4);
  await markNow();
  await tp(P.cross);
  await markAll(['og2', 'og3']);
  await tp(P.exitFoot);
  await tp(P.exitTop);
  await tp(P.wheelB);
  s = await talkThrough(async () => (await watch()).s?.phase === 'wheels', 6, 'the wheels');
  check('49: up the north stairs inside the inner compound; Ido goes to the other wheel', !!s && said('שני גלגלים, אחד לכל צד. אני בשמאלי — אתה בימני. רק ביחד הוא זז.', 'עידו'));
  check('49: the prompt "לסובב את הגלגל"', await interact('לסובב את הגלגל'));
  s = await talkThrough(async () => (await look()).s.p >= 0.2, 25, 'the turn');
  check('49: both wheels needed: the gate goes up only while Ido and Nehorai turn', !!s);
  s = await talkThrough(async () => (await look()).s.halt === true, 25, 'the patrol');
  check('49: half-way a patrol comes; the wheels wait', !!s);
  await step(1.5);
  const real4 = await shoot('og4');
  await markAll(['og5', 'og6']);
  await tp(P.wheelB);
  s = await talkThrough(async () => (await look()).s.halt === false, 8, 'the patrol held off');
  check('49: the patrol held off (one real shot); back to the wheels; Ido called it', !!s && real4 && said('סיור! מהחצר הפנימית! עזוב את הגלגל ותעצור אותם!', 'עידו'));
  check('49: the prompt "לסובב את הגלגל" again', await interact('לסובב את הגלגל'));
  s = await talkThrough(async () => (await watch()).step >= 4, 40, 'the gate open');
  v = await look();
  check('49: the inner gate up; Hadar and Yonati come through ("חיכינו בחוץ כמו שני עציצים")', !!s && v.inner && said('Bro! חיכינו בחוץ כמו שני עציצים.', 'הדר') && v.sq.length === 8, JSON.stringify(v.sq));

  // ---------- goal 5: Muller at the computer ----------
  check(`49: goal 5 on screen word for word: "${GOALS[4]}"`, v.objective.startsWith(GOALS[4]), v.objective);
  s = await forcedFail(4, /שולחן/);
  check('49: retry at the computer\'s goal: behind the inner gate, the gate open', !!s && (await look()).inner);
  await markNow();
  await tp(P.west);
  s = await talkThrough(async () => (await watch()).s?.phase === 'hack', 30, 'Muller at the computer');
  v = await look();
  check('49: Muller at the computer; Erez, Ido, Avraham and Dolev at the three ways in', !!s && v.gang.filter((n) => n.task === 'בעמדה').length === 4, JSON.stringify(v.gang.map((n) => [n.id, n.task])));
  // a friend marked at his post (Dolev, at the south way in): Ido leaves his own (the east), runs over, kneels at his
  // side and pulls him up, then goes back to his post
  await G(() => { const g = window.__game.debug.game, a = g.paint.allies.find((x) => x.npc === g.npc('dolev')); g.paint.markAlly(a, g.paint.guards[0]); });
  const lift = { went: false, knelt: false, upAt: null, back: false, lifts: 0 }, waves = new Set();
  s = await talkThrough(async () => {
    const w = await watch(), ido = w.gang.find((n) => n.id === 'ido'), dolev = w.gang.find((n) => n.id === 'dolev');
    if (w.s?.from) waves.add(w.s.from);
    lift.went ||= ido.task === 'מרים את דולב';
    if (!lift.knelt && w.idoPose === 'kneel' && dist(ido, dolev) < 1.6) {
      lift.knelt = true;
      // (a look at the two of them for the snapshot: a camera beside them for a frame, then the player's again)
      await G(() => { const g = window.__game.debug.game, i = g.npc('ido').pos, d = g.npc('dolev').pos, mx = (i.x + d.x) / 2, mz = (i.z + d.z) / 2, ax = d.x - i.x, az = d.z - i.z, l = Math.hypot(ax, az) || 1; const at = { x: mx, y: i.y + 0.6, z: mz }, sides = [[-az / l, ax / l], [az / l, -ax / l], [-ax / l, -az / l], [ax / l, az / l]].map(([ux, uz]) => ({ x: mx + ux * 2.4, y: i.y + 1.7, z: mz + uz * 2.4 })), from = sides.find((f) => g.world.cols.raycast(at.x, at.y + 0.6, at.z, f.x, f.y, f.z) === null) || { x: mx, y: i.y + 2.4, z: mz + 0.01 }; g.follow.shot(from, at, 9999); g.camera.position.set(from.x, from.y, from.z); g.camera.lookAt(at.x, at.y, at.z); });
      await step(1 / 15); await snap('u49-3-ido-lifts');
      await G(() => { window.__game.debug.game.follow.override = null; });
    }
    if (lift.upAt === null && !dolev.marked) { lift.upAt = +dist(ido, dolev).toFixed(2); lift.lifts = w.lifts; }
    if (lift.upAt !== null && ido.task === 'בעמדה') lift.back = true;
    if (w.guards.length) await markAll(['og7', 'og8', 'og9', 'og10', 'og11', 'og12', 'og13', 'og14', 'og15']);
    return lift.back || w.step >= 5;
  }, 30, 'Ido lifting Dolev');
  check('49: a friend marked at his post: Ido leaves his own, runs over, kneels at his side and pulls him up (no timer), then goes back to his post', !!s && lift.went && lift.knelt && lift.upAt !== null && lift.upAt < 1.6 && lift.lifts >= 1 && lift.back, JSON.stringify(lift));
  let realW = null, wiped = false;
  s = await talkThrough(async () => {
    const w = await watch();
    if (w.s?.from) waves.add(w.s.from);
    if (w.guards.some((id) => ['og7', 'og8', 'og9', 'og10', 'og11', 'og12', 'og13', 'og14', 'og15'].includes(id))) {
      await step(2);
      if (realW === null) { const id = (await look()).guards.find((x) => ['og7', 'og8', 'og9'].includes(x)); if (id) realW = await shoot(id); }
      await markAll(['og7', 'og8', 'og9', 'og10', 'og11', 'og12', 'og13', 'og14', 'og15']);
    }
    if (!wiped && (w.s?.bar || 0) > 0.5) { wiped = true; await G(() => { const g = window.__game.debug.game, a = g.paint.allies.find((x) => x.npc === g.npc('muller')); g.paint.markAlly(a, g.paint.guards[0]); }); }
    return w.step >= 5;
  }, 110, 'the bar');
  v = await look();
  check('49: three waves, each by a different way in (south, east, west), held off', waves.size === 3 && realW !== false, [...waves].join(','));
  check('49: Muller marked stops, wipes it off and goes on ("צבע על המסך. יופי. ממשיך.")', said('צבע על המסך. יופי. ממשיך.', 'מולר'));
  check('49: the bar full: Muller opens the energy hall\'s door from the computer', !!s && !v.hall.locked && said('רק דבר אחד: עמודי המתח בחצר פורקים חשמל. בין השורות עוברים בזמן.', 'מולר'));

  // ---------- goal 6: the pylons, the bridges, the tower's door ----------
  v = await watch();
  check(`49: goal 6 on screen word for word: "${GOALS[5]}"`, v.objective.startsWith(GOALS[5]), v.objective);
  await markNow();
  // a fail from the discharges themselves: Nehorai stands on the north row's line until it has struck three times
  await tp({ x: P.south0.x, z: P.rowN - 2.5, y: P.y });
  await jump({ x: P.south0.x, z: P.rowN, y: P.y });
  s = await until(async (s) => { await G((z) => { const g = window.__game.debug.game; if (Math.abs(g.player.pos.z - z) > 0.3) g.player.place(g.player.pos.x, z, g.player.yaw); }, P.rowN); return s.fail; }, 30, 'the discharges');
  const reason6 = await text('#failReason');
  check('49: a discharge strikes only after its warning line, and three of them fail goal 6 with a tip', !!s && /הקו על הרצפה/.test(reason6), reason6);
  await page.tap('#retryBtn'); await holdLoop(true);
  s = await until((s) => !s.fail && s.mission?.step === 5, 6, 'the retry');
  v = await look();
  check('49: retry at goal 6: in control room B, the hall door still open to them', !!s && !v.hall.locked && v.hits === 0);
  await markNow();
  // the crossing: at each row, wait for its beam to end, then go
  const crossRow = async (z0, z1, endAt) => {
    await tp({ x: P.south0.x, z: z0, y: P.y });
    await until(async () => { const c = (await look()).s.cycle; return c > endAt && c < endAt + 0.4; }, 6, 'the row going quiet');
    return tp({ x: P.south0.x, z: z1, y: P.y });
  };
  await tp({ x: P.south0.x, z: P.rowN - 2.5, y: P.y }, 0, 0, 0);
  await talkThrough(async () => { const c = (await look()).s.cycle; return c > 1.6 && c < 2.1; }, 8, 'a row discharging');
  await snap('u49-4-pylons');
  const hits0 = (await look()).hits;
  await crossRow(P.rowN - 2.5, P.rowN + 3, 2.3);
  await crossRow(P.rowS - 2.5, P.rowS + 3, 0.02);
  await listen();
  v = await look();
  check('49: both rows crossed between their discharges (no mark taken); Erez calls the timing', v.hits === hits0 && heard.some((l) => l.startsWith('ארז: ') && /רוץ|עבור|עכשיו/.test(l)), `hits ${v.hits} · ${heard.filter((l) => l.startsWith('ארז')).join(' | ')}`);
  await tp(P.plantE);
  await tp(P.plantIn);
  await tp(P.stairsBottom);
  await tp(P.stairsTop);
  await tp(P.c1);
  await markAll(['og16', 'og17']);
  await tp(P.c0);
  await tp(P.a0);
  await tp(P.door);
  s = await talkThrough(async () => (await watch()).id !== 'citadel', 30, 'the door');
  v = await look();
  check('49: up the plant house, over bridge C and bridge A to the energy hall\'s door at +7', v.me.y > P.y + 6 && dist(v.me, P.door) < 4, JSON.stringify(v.me));
  check('49: at the tower\'s door: "הנה הוא. המגדל." / "מה שלא יחכה לנו שם בפנים — ביחד."; Muller on the radio from the computer', said('הנה הוא. המגדל.', 'נהוראי') && said('מה שלא יחכה לנו שם בפנים — ביחד.', 'ארז') && said('המכונה שלו למעלה. והוא כבר יודע שאנחנו פה.', 'מולר'));
  await snap('u49-5-door');
  check('49: every one of the six goals was on screen word for word', GOALS.every((_, i) => goalShown(i)), GOALS.filter((_, i) => !goalShown(i)).join(' / '));
  check('49: done', await G(() => window.__game.debug.game.progress.done.includes('citadel')));
  await goalsCheck('citadel');
  // 50 takes the scene over where it stands: nobody moved (Nehorai still at the door on the bridge), Muller at the computer
  const seven = v.gang.filter((n) => n.id !== 'muller'), mu = v.gang.find((n) => n.id === 'muller');
  check('49 → 50: the cars left on the service road put away: the gang\'s two gone, the Renault home in its driveway', v.gangCars === 0 && v.carName === 'renault' && v.carHome < 3, JSON.stringify({ gangCars: v.gangCars, car: v.carName, home: Math.round(v.carHome) }));
  check('49 → 50 carried straight on: "הנפילה של הגיבור" begins at the energy hall\'s door where 49 ended (no jump), the seven on the bridge with him, the door open, Muller left at the computer, the red sky, the bandage, armed', v.id === 'fall' && v.step === 0 && v.mode === 'foot' && v.me.y > P.y + 6 && dist(v.me, P.door) < 4 && v.hall.open && seven.every((n) => n.vis && dist(n, v.me) < 16 && Math.abs(n.y - v.me.y) < 1.5) && mu.vis && dist(mu, P.computer) < 1.2 && v.preset === 'redSky' && v.bandage && v.armed && v.allies === 7, JSON.stringify({ id: v.id, me: v.me, gang: v.gang.map((n) => [n.id, Math.round(dist(n, v.me)), n.y.toFixed(1)]), allies: v.allies }));
}

const RUN = [dawn, lastconvoy, citadel];
for (let i = FROM; i <= TO; i++) {
  const ok = await RUN[i]().then(() => true, (e) => { check(`${IDS[i]}: ran to its end`, false, e.stack?.split('\n').slice(0, 3).join(' | ')); return false; });
  if (!ok) break;
}
await t.finish({ walked: !(FROM === 1 && TO === 1) });
