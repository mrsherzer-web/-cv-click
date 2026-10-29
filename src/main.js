// Boot: renderer, world, player, camera, controls, HUD, and the frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildWorld } from './world/world.js';
import { createSky } from './world/sky.js';
import { Controls } from './input/controls.js';
import { Game } from './game.js';
import { Hud } from './ui/hud.js';
import { Lookout } from './missions/lookout.js';
import { Autopilot, roadPath } from './vehicle/autopilot.js';
import { fightBot } from './debug/bot.js';
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
  });
  const saved = loadProgress();
  const game = new Game({ scene, camera, world, hud, controls, progress: saved || newProgress() });
  game.start(world.start.x, world.start.z, world.start.yaw);
  const lookout = new Lookout(world);
  game.activities.push(lookout);
  const refreshMissions = () => hud.setMissionList(game.missions.rows().filter((r) => r.done), (id) => { game.missions.replay(id); setPaused(false); });
  game.onMissionsChanged = refreshMissions;

  function applyQuality(name) {
    quality = name;
    const q = CONFIG.quality[name];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    renderer.setSize(innerWidth, innerHeight, false);
    if (renderer.shadowMap.enabled !== q.shadows) {
      renderer.shadowMap.enabled = q.shadows;
      scene.traverse((o) => {
        if (o.isMesh && o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
      });
    }
    sky.setQuality(q, camera);
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
    hud.setPaused(on);
  };
  controls.onPause = () => setPaused(!paused);
  hud.bindPause({
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    onHome: () => {
      game.exitCar();
      game.start(world.start.x, world.start.z, world.start.yaw);
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
      sky.follow(camera, focus());
      world.tick(camera, dt);
      renderer.render(scene, camera);
    }
    hud.tick(dt);
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
  const begin = (fresh) => {
    if (fresh) { clearProgress(); Object.assign(game.progress, newProgress()); hud.setMoney(0); }
    started = true;
    hud.showGame();
    controls.enabled = true;
    refreshMissions();
    game.populate();
    const next = game.missions.next();
    if (next && !next.startAt) game.missions.start(next.id);
    else hud.setObjective(next ? `המשימה הבאה: ${next.title}` : game.missions.freeRoamText);
  };
  hud.ready(() => begin(!saved), saved ? { onNew: () => begin(true), summary: `${saved.done.length} משימות · ${saved.money} ₪` } : null);

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
        fight: game.fight ? { over: game.fight.over, won: game.fight.won, opponents: game.fight.opponents.map((o) => ({ name: o.name, hp: o.fighter.hp, mode: o.mode, down: o.fighter.down, x: o.npc.pos.x, z: o.npc.pos.z })) } : null,
        buttons: Object.fromEntries(['btnPunch', 'btnBlock', 'btnDodge', 'btnRun', 'btnInteract'].map((id) => [id, !!document.getElementById(id).offsetParent])),
        target: game.target ? { x: game.target.x, z: game.target.z } : null,
        npcs: Object.fromEntries([...game.npcs].map(([id, n]) => [id, { x: n.pos.x, z: n.pos.z, visible: n.visible, inCar: !!n.inCar }])),
        interactVisible: !document.getElementById('btnInteract').hidden,
        pixelRatio: renderer.getPixelRatio(),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
    teleport(x, z, y) { game.player.place(x, z, game.player.yaw); if (y !== undefined) game.player.pos.y = y; },
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
        pts.push(...roadPath(r, a < 0 ? r.length + a : a, b < 0 ? r.length + b : b, lane ?? -1.8));
      }
      game.autopilot = new Autopilot(pts, { cruise });
      return pts.length;
    },
    stopDriving() { game.autopilot = null; },
    // tests only: let the fight bot take Nehorai's side of a fight; null hands it back
    fightBot(opts) { game.botInput = opts ? fightBot(game, opts) : null; },
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
    debug: { scene, camera, renderer, world, THREE },
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
