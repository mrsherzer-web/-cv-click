// Boot: renderer, world, player, camera, controls, HUD, and the frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildWorld } from './world/world.js';
import { createSky } from './world/sky.js';
import { Daylight } from './world/daylight.js';
import { Controls } from './input/controls.js';
import { Game } from './game.js';
import { Hud } from './ui/hud.js';
import { Lookout } from './missions/lookout.js';
import { Autopilot, roadPath } from './vehicle/autopilot.js';
import { fightBot } from './debug/bot.js';
import { Sound } from './audio/sound.js';
import { Radio } from './audio/radio.js';
import { onPress } from './input/controls.js';
import { loadProgress, newProgress, clearProgress } from './save/progress.js';
import { loadSettings, saveSettings } from './save/settings.js';

const hud = new Hud();
const settings = loadSettings();

function webgl2Available() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

function boot() {
  if (!webgl2Available()) {
    hud.fail('הדפדפן הזה לא תומך ב־WebGL2. צריך Chrome או Safari עדכניים (iOS 15 ומעלה).');
    return;
  }
  const canvas = document.getElementById('view');
  let quality = CONFIG.quality[settings.quality] ? settings.quality : 'medium';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'medium', powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 2600);

  const q0 = CONFIG.quality[quality];
  const timings = {};
  let t = performance.now();
  const world = buildWorld(scene, { shadows: q0.shadows });
  timings.world = Math.round(performance.now() - t);
  const endDir = world.road.at(world.road.length);
  const sky = createSky(scene, { westDir: { x: endDir.tx, z: endDir.tz } });

  const controls = new Controls(document.getElementById('game'), {
    stick: document.getElementById('stick'), knob: document.getElementById('stickKnob'),
    run: document.getElementById('btnRun'), interact: document.getElementById('btnInteract'),
    gas: document.getElementById('btnGas'), brake: document.getElementById('btnBrake'),
    handbrake: document.getElementById('btnHandbrake'), exit: document.getElementById('btnExit'),
    punch: document.getElementById('btnPunch'), block: document.getElementById('btnBlock'), dodge: document.getElementById('btnDodge'),
    heavy: document.getElementById('btnHeavy'), shove: document.getElementById('btnShove'),
    fire: document.getElementById('btnFire'), reload: document.getElementById('btnReload'), mark: document.getElementById('btnMark'), squad: document.getElementById('btnSquad'),
  });
  const saved = loadProgress();
  const game = new Game({ scene, camera, world, hud, controls, progress: saved || newProgress() });
  game.start(world.start.x, world.start.z, world.start.yaw);
  const lookout = new Lookout(world);
  game.activities.push(lookout);
  const daylight = new Daylight({ scene, sky, renderer });
  daylight.attachCar(game.car);
  daylight.focus = game.player.pos;
  if (world.places.bank) { // the bank's sign glows at night; a lamp over its doors and one at the bay
    daylight.addEmissive(world.places.bank.signMat, 1.6);
    for (const l of world.places.bank.lamps) { const pl = new THREE.PointLight(l.inside ? '#fff1d0' : '#ffd9a0', 0, l.inside ? 17 : 24, 1.6); pl.position.set(l.x, l.y, l.z); daylight.addLamp(pl, l.inside ? 38 : 60); }
  }
  // chapter five: the house's lamps, the pub's neon and lights, Katzir's string lights, the villa's lamps
  const lampsOf = (place, { warm = '#ffd9a0', cool = '#fff1d0' } = {}) => {
    if (!place) return;
    for (const m of place.emissives || []) daylight.addEmissive(m, m.userData?.night ?? 1.4);
    for (const l of place.lamps || []) { const pl = new THREE.PointLight(l.color || (l.inside ? cool : warm), 0, l.range || (l.inside ? 14 : 22), 1.7); pl.position.set(l.x, l.y, l.z); daylight.addLamp(pl, l.intensity ?? (l.inside ? 30 : 50)); }
  };
  lampsOf(world.places.home?.interior);
  lampsOf(world.places.pub);
  lampsOf(world.places.katzirNight);
  lampsOf(world.places.villa);
  lampsOf(world.places.yard);
  lampsOf(world.places.icecream);
  for (const k of ['quarry', 'depot', 'passage', 'fort']) lampsOf(world.places[k]);
  for (const k of ['hideout', 'ironRoad', 'ironBase', 'bridge', 'hq', 'kotziRoad']) lampsOf(world.places[k]); // chapter eight
  for (const k of ['safehouse', 'deathRoad', 'port', 'facility', 'tower']) lampsOf(world.places[k]); // chapter nine
  for (const k of ['lastRoad', 'citadel', 'grove']) lampsOf(world.places[k]); // chapter ten
  if (world.places.pub?.signMat) daylight.addEmissive(world.places.pub.signMat, 1.5);
  game.daylight = daylight;
  const refreshMissions = () => hud.setMissionList(game.missions.rows(), (id) => { game.missions.replay(id); setPaused(false); });
  game.onMissionsChanged = refreshMissions;

  // under the facility's lid (chapter nine) nothing outside can be seen, yet the map beyond its walls
  // would still be drawn up to the fog (300-450 draw calls): there the far plane comes in to 180 m (the
  // longest view inside is under 150 m), and the full view is back outside. The hangar and the exit keep
  // the full view while the exit is open, since the surface shows up the ramp
  const fac = world.places.facility, UNDER_FAR = 180;
  let farFull = camera.far, under = false;
  const viewDistance = () => {
    const c = camera.position;
    let u = !!fac?.interior?.visible && c.y < fac.lidY + 0.3 && fac.inside(c.x, c.z);
    if (u && fac.exit.door.k > 0.02) { const z = fac.zoneAt(c.x, c.z); u = z !== 'hangar' && z !== 'exit'; }
    if (u === under) return;
    under = u;
    camera.far = u ? UNDER_FAR : farFull;
    camera.updateProjectionMatrix();
  };

  function applyQuality(name) {
    quality = name;
    const q = CONFIG.quality[name];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    if (game.fx) game.fx.pixelRatio = renderer.getPixelRatio();
    renderer.setSize(innerWidth, innerHeight, false);
    if (renderer.shadowMap.enabled !== q.shadows) {
      renderer.shadowMap.enabled = q.shadows;
      scene.traverse((o) => {
        if (o.isMesh && o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
      });
    }
    sky.setQuality(q, camera);
    farFull = camera.far; // the preset's view distance; still the short one while under the lid
    if (under) { camera.far = UNDER_FAR; camera.updateProjectionMatrix(); }
    if (game.populated !== name) { game.setPopulation({ traffic: q.traffic, people: q.people }); game.populated = name; }
    world.lod.range = q.fogFar;
    world.lod.update(camera, 0, true);
    settings.quality = name;
    saveSettings(settings);
  }
  applyQuality(quality);

  let paused = false, started = false;
  const setPaused = (on) => {
    if (!started) return;
    paused = on;
    controls.enabled = !on;
    if (on) controls.reset();
    if (on) { hud.setTravel(game.has('hadera-parking') && !game.missions.active); refreshMissions(); if (started) game.save(); }
    game.sound?.setPaused(on);
    hud.setPaused(on);
  };
  controls.onPause = () => setPaused(!paused);
  // starting over: asked once more on the page itself, then a clean reload
  const confirmSheet = document.getElementById('resetConfirm');
  document.getElementById('resetBtn').addEventListener('click', () => { hud.setPaused(false); confirmSheet.hidden = false; document.getElementById('resetNo').focus({ preventScroll: true }); });
  document.getElementById('resetNo').addEventListener('click', () => { confirmSheet.hidden = true; hud.setPaused(true); });
  document.getElementById('resetYes').addEventListener('click', () => {
    // leaving the page pauses, and pausing saves: nothing may save again on the way out
    started = false;
    game.save = () => false;
    clearProgress();
    location.reload();
  });
  hud.bindPause({
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    onHome: () => {
      if (game.missions.active) { game.missions.stop(); game.missions.showNext(); } // going home leaves the mission (a mission that follows on starts again from its beginning)
      game.exitCar();
      game.start(world.start.x, world.start.z, world.start.yaw);
      setPaused(false);
    },
    onTravel: () => {
      game.travelTo('hadera');
      setPaused(false);
    },
    onResetCar: () => {
      game.car.reset();
      if (game.mode === 'car') game.carCam.snap(game.car);
      setPaused(false);
    },
    onQuality: applyQuality,
    quality,
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 250));

  const clock = new THREE.Clock();
  let simTime = 0, timeScale = 1;
  const focus = () => (game.mode === 'car' ? game.car.model.position : game.nehorai.root.position);
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1) * timeScale;
    if (!paused && !game.hold) {
      simTime += dt;
      game.update(dt);
      daylight.update(dt);
      sky.follow(camera, focus());
      world.tick(camera, dt);
      viewDistance();
      renderer.render(scene, camera);
      if (game.pip) renderPip();
    }
    hud.tick(dt);
  }

  // a second view in a corner of the screen (the video call): the same scene from another camera, drawn
  // into the frame's rectangle over the main picture, without re-rendering the shadows
  const pipCam = new THREE.PerspectiveCamera(34, 1, 0.05, 2600);
  function renderPip() {
    const p = game.pip, r = p.rect();
    if (!r || r.width < 4) return;
    pipCam.position.copy(p.from);
    pipCam.lookAt(p.look);
    pipCam.aspect = r.width / r.height;
    pipCam.updateProjectionMatrix();
    const x = r.left + 2, y = innerHeight - r.bottom + 2, w = r.width - 4, h = r.height - 4;
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.clear(true, true, false);
    sky.dome.position.copy(pipCam.position);
    renderer.render(scene, pipCam);
    sky.dome.position.copy(camera.position);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    renderer.autoClear = true;
    renderer.shadowMap.autoUpdate = shadows;
  }

  // first frame behind the start screen so the town is visible right away
  game.follow.update(0.016, game.player);
  sky.follow(camera, focus());
  world.lod.update(camera, 0, true);
  t = performance.now();
  renderer.render(scene, camera);
  timings.firstFrame = Math.round(performance.now() - t);
  frame();

  // the story picks up where it was left; a new game starts at mission 1
  // sound: starts with the first tap on "start", the button by the money mutes it (remembered)
  const sound = new Sound();
  game.sound = sound;
  game.radio = new Radio(game, document.getElementById('radio'));
  const muteBtn = document.getElementById('muteBtn');
  const showMute = () => muteBtn.setAttribute('aria-pressed', String(!!settings.muted));
  sound.setMuted(!!settings.muted);
  showMute();
  onPress(muteBtn, () => { settings.muted = !settings.muted; sound.setMuted(settings.muted); showMute(); saveSettings(settings); });
  const begin = (fresh) => {
    sound.start();
    if (fresh) { clearProgress(); Object.assign(game.progress, newProgress()); hud.setMoney(0); }
    started = true;
    game.begun = true; // missions may start now (none begins behind the start screen)
    hud.showGame();
    controls.enabled = true;
    refreshMissions();
    game.populate();
    if (game.missions.resume()) return; // the page was left in a mission: back at its last checkpoint
    const next = game.missions.next();
    if (next?.opens) game.missions.start(next.id); // the chapter opens with the first mission
    else game.missions.showNext();
  };
  const tryout = Number(window.__startChapter) || 0; // a build that begins at a later chapter (set in the page before the game loads)
  const beginAt = (chapter) => {
    clearProgress();
    Object.assign(game.progress, game.progressForChapter(chapter));
    hud.setMoney(game.progress.money);
    begin(false);
  };
  if (tryout) {
    const pick = document.getElementById('chapterPick');
    const names = { 4: 'בנק קוצי', 5: 'הפאב בקציר והווילה של יניב', 6: 'הצופן', 7: 'ערב בתצפית', 8: 'מבצע סופת אש', 9: 'מבצע אלמוות', 10: 'סוף העולם' };
    const last = Math.max(...game.missions.defs.map((d) => d.chapter || 1));
    for (let c = tryout; c <= last; c++) {
      const b = document.createElement('button');
      b.className = 'primary'; b.type = 'button'; b.dataset.chapter = String(c);
      b.textContent = `להתחיל מפרק ${c}${names[c] ? ` · ${names[c]}` : ''}`;
      b.disabled = true;
      b.addEventListener('click', () => { if (started) return; for (const o of pick.querySelectorAll('button')) o.disabled = true; beginAt(c); }, { once: true });
      pick.append(b);
    }
    pick.hidden = false;
    document.getElementById('startBtn').hidden = true;
    document.getElementById('startNote').textContent = `גרסת ניסיון: מתחילים מפרק ${tryout} עם כל מה שהושג קודם. כל הדמויות והאירועים במשחק בדיוניים.`;
    document.querySelector('#startScreen .eyebrow').textContent = `גרסת ניסיון · פרקים ${tryout}–${last}`;
    hud.ready(() => {}, null);
    for (const b of pick.querySelectorAll('button')) b.disabled = false;
    window.__beginAt = beginAt; // for the tests
  } else {
    const midway = saved && game.missions.resumable(); // "continue" goes straight back into it
    hud.ready(() => begin(!saved), saved ? { onNew: () => begin(true), summary: `${saved.done.length} משימות · ${saved.money} ₪${midway ? ` · באמצע ${midway.title}` : ''}` } : null);
  }

  // a read-only window for automated tests
  window.__game = {
    get state() {
      const player = game.player, follow = game.follow, car = game.car;
      return {
        started, paused, quality, time: simTime, fps: hud.fps, mode: game.mode, prompt: game.prompt?.label ?? null,
        player: { ...player.pos, yaw: player.yaw, speed: player.speed, running: player.running, respawns: player.respawns },
        car: { ...car.pos, yaw: car.yaw, speed: car.speed, kmh: car.kmh, health: car.health, impacts: car.impacts, stuck: car.stuckTime, slip: car.slip, ground: car.groundUnder() },
        ground: world.groundHeight(player.pos.x, player.pos.z),
        camera: { yaw: follow.yaw, pitch: follow.pitch, dist: follow.dist, x: camera.position.x, y: camera.position.y, z: camera.position.z },
        mission: game.missions.active ? { id: game.missions.active.def.id, step: game.missions.active.stepIndex, objective: game.missions.step.objective } : null,
        lookout: lookout.uses,
        progress: JSON.parse(JSON.stringify(game.progress)),
        cutscene: game.cutscene, hold: game.hold, dialogue: game.dialogue.busy,
        autopilot: game.autopilot ? { done: game.autopilot.done, i: game.autopilot.i, n: game.autopilot.points.length } : null,
        combat: game.combat, bagHits: game.bagHits,
        fighter: (({ hp, stamina, state, blocks, dodges, landed, taken, combo, lastMove }) => ({ hp, stamina, state, blocks, dodges, landed, taken, combo, lastMove }))(game.fighter),
        night: daylight.night,
        call: hud.callOn,
        paint: game.paint.armed ? { ammo: game.paint.player.ammo, hits: game.paint.hits, marked: game.paint.marked, guards: game.paint.guards.length, lock: game.paint.lock ? (game.paint.lock.npc?.id ?? 'board') : null, allies: game.paint.allies.map((a) => a.npc.id) } : null,
        bout: (() => { const m = game.missions.active, ev = m?.ev; return ev ? { round: m.s.round, phase: m.s.phase, clock: m.s.clock, hadar: ev.hadar.hp, bulldozer: ev.bulldozer.hp, calls: { ...ev.calls }, call: ev.call, over: ev.over, won: ev.won } : null; })(),
        fight: game.fight ? { over: game.fight.over, won: game.fight.won, full: game.fight.full, opponents: game.fight.opponents.map((o) => ({ name: o.name, hp: o.fighter.hp, mode: o.mode, down: o.fighter.down, floored: o.fighter.floored, boss: o.boss, phase: o.phase, winding: o.winding, x: o.npc.pos.x, z: o.npc.pos.z })) } : null,
        buttons: Object.fromEntries(['btnPunch', 'btnBlock', 'btnDodge', 'btnHeavy', 'btnShove', 'btnRun', 'btnInteract', 'btnFire', 'btnReload', 'btnSquad'].map((id) => [id, !!document.getElementById(id).offsetParent])),
        target: game.target ? { x: game.target.x, z: game.target.z } : null,
        npcs: Object.fromEntries([...game.npcs].map(([id, n]) => [id, { x: n.pos.x, z: n.pos.z, visible: n.visible, inCar: !!n.inCar }])),
        interactVisible: !document.getElementById('btnInteract').hidden,
        pixelRatio: renderer.getPixelRatio(),
        drawCalls: renderer.info.render.calls, far: camera.far,
        triangles: renderer.info.render.triangles,
      };
    },
    get guideLog() { return hud.guideLog; },
    // y picks the floor to stand on; a y far below every floor is kept as it is (a test of falling through the world)
    teleport(x, z, y) { game.player.place(x, z, game.player.yaw, y === undefined ? null : y); if (y !== undefined && y < game.player.pos.y - 5) game.player.pos.y = y; },
    setCamera(yaw, pitch = game.follow.pitch) { game.follow.yaw = yaw; game.follow.pitch = pitch; game.follow.idle = 0; },
    placeCar(x, z, yaw) { game.car.place(x, z, yaw); },
    enterCar() { game.enterCar(); },
    exitCar() { game.requestExit(); },
    setTimeScale(k) { timeScale = k; },
    // a point on a named road: { x, z, h, yaw } at arc length s (a negative s counts from the end)
    roadAt(name, s, offset = 0) {
      const r = world.net.roads.find((q) => q.name === name);
      const p = r.at(s < 0 ? r.length + s : s);
      return { x: p.x + p.nx * offset, z: p.z + p.nz * offset, h: p.h, yaw: Math.atan2(p.tx, p.tz), length: r.length };
    },
    roads: world.net.roads.map((r) => r.name),
    groundAt(x, z) { return world.groundHeight(x, z); },
    blocks(x, y, z) { return world.cols.blocks(x, y, z, game.car); },
    resetCar() { game.car.reset(); },
    startMission(id) { game.missions.start(id); },
    replayMission(id) { game.missions.replay(id); },
    skipDialogue() { game.dialogue.stop(); },
    damageCar(n) { game.car.hurt(n); },
    // drive the Renault along roads: [[roadName, fromS, toS], ...] (negative s counts from the end)
    drivePath(legs, cruise = 13) {
      const pts = [];
      for (const [name, a, b, lane] of legs) {
        if (name === 'points') { pts.push(...a); continue; }
        if (name === 'circle') { // a loop around a turning circle: [ 'circle', {x, z}, radius, fromAngle ]
          for (let k = 0; k <= 24; k++) { const t = lane + 0.5 + (k / 24) * (Math.PI * 2 - 1); pts.push({ x: a.x + Math.cos(t) * b, z: a.z + Math.sin(t) * b }); }
          continue;
        }
        const r = world.net.roads.find((q) => q.name === name);
        pts.push(...roadPath(r, a < 0 ? r.length + a : a, b < 0 ? r.length + b : b, lane ?? 1.8));
      }
      game.autopilot = new Autopilot(pts, { cruise });
      return pts.length;
    },
    stopDriving() { game.autopilot = null; },
    // tests only: let the fight bot take Nehorai's side of a fight; null hands it back
    fightBot(opts) { game.botInput = opts ? fightBot(game, opts) : null; },
    // tests only: Nehorai's calls from the corner in the main event, made in the frame they open; `share`
    // of them (decided once per call), 0 for none; null hands the button back
    // tests only: fires the marker whenever a guard is locked on; null hands the button back
    fireBot(on) {
      let cool = 0;
      game.botInput = on ? (input, dt) => { cool -= dt; if (cool <= 0 && game.paint.lock && game.paint.fire()) cool = 0.45; return input; } : null;
    },
    shoutBot(share) {
      const seen = new Set();
      game.botInput = share == null ? null : (input) => {
        const p = game.prompt, ev = game.missions.active?.ev;
        if (!ev || !p || (p.label !== 'חסום!' && p.label !== 'עכשיו!')) return input;
        const key = `${p.label}${ev.opp.swings}`;
        if (!seen.has(key)) { seen.add(key); if (Math.random() < share) p.run(); }
        return input;
      };
    },
    hurtPlayer(n) { const f = game.fighter; if (game.fight) f.takeHit({ pos: { x: f.pos.x + Math.sin(game.player.yaw), z: f.pos.z + Math.cos(game.player.yaw) } }, n, 'test'); },
    faceBag(i = 0, dist = 1.15) {
      const b = world.places.gymBags[i], g = world.places.gym, p = g.toWorld(g.toLocal(b.x, b.z).x, g.toLocal(b.x, b.z).z + dist);
      game.player.place(p.x, p.z, Math.atan2(b.x - p.x, b.z - p.z));
      game.follow.snapBehind(game.player.yaw);
    },
    carSpot: world.places.carSpot,
    layout: {
      homeS: world.places.home.s, avS: world.places.avraham.s, sideS: 150, lotS: world.places.lot.road.s,
      turn: { x: world.places.turn.x, z: world.places.turn.z, r: world.places.turn.r },
    },
    places: Object.fromEntries(Object.entries(world.places).filter(([, v]) => v && typeof v.x === 'number').map(([k, v]) => [k, { x: v.x, z: v.z, y: v.y, yaw: v.yaw }])),
    debug: { scene, camera, renderer, world, THREE, game },
    lookout: world.lookout,
    telescope: world.telescope,
    home: { x: world.home.house.x, z: world.home.house.z, yaw: world.home.yaw, hx: 5.5, hz: 5 },
    timings,
  };
}

// let the loading text paint before the town is generated
requestAnimationFrame(() => setTimeout(() => {
  try { boot(); } catch (err) { console.error(err); hud.fail(`שגיאה בטעינה: ${err.message}`); }
}, 30));
