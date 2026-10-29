// Boot: renderer, world, player, camera, controls, HUD, and the frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildKatzir } from './world/katzir.js';
import { createSky } from './world/sky.js';
import { makeNehorai } from './player/character.js';
import { PlayerController } from './player/controller.js';
import { FollowCamera } from './camera/followCamera.js';
import { Controls } from './input/controls.js';
import { Hud } from './ui/hud.js';
import { StageA } from './missions/stageA.js';
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
  const world = buildKatzir(scene, { shadows: q0.shadows });
  timings.world = Math.round(performance.now() - t);
  const endDir = world.road.at(world.road.length);
  const sky = createSky(scene, { westDir: { x: endDir.tx, z: endDir.tz } });

  const nehorai = makeNehorai();
  scene.add(nehorai.root);
  const player = new PlayerController(world, nehorai);
  player.place(world.start.x, world.start.z, world.start.yaw);
  const follow = new FollowCamera(camera, world);
  follow.snapBehind(world.start.yaw);

  const controls = new Controls(document.getElementById('game'), {
    stick: document.getElementById('stick'), knob: document.getElementById('stickKnob'),
    run: document.getElementById('btnRun'), interact: document.getElementById('btnInteract'),
  });
  const mission = new StageA(scene, world, hud, follow);
  controls.onInteract = () => mission.interact(player);

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
    sky.setQuality(q);
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
      player.place(world.start.x, world.start.z, world.start.yaw);
      follow.snapBehind(world.start.yaw);
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
  let simTime = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!paused) {
      simTime += dt;
      const input = controls.sample();
      follow.look(input.lookDX, input.lookDY);
      player.update(dt, input.move, input.run, follow.yaw);
      nehorai.animate(dt, player.speed, CONFIG.player.runSpeed);
      follow.update(dt, player);
      mission.update(dt, player, camera);
      sky.follow(camera, nehorai.root.position);
      renderer.render(scene, camera);
    }
    hud.tick(dt);
  }

  // first frame behind the start screen so the town is visible right away
  follow.update(0.016, player);
  sky.follow(camera, nehorai.root.position);
  t = performance.now();
  renderer.render(scene, camera);
  timings.firstFrame = Math.round(performance.now() - t);
  frame();

  hud.ready(() => {
    started = true;
    hud.showGame();
    controls.enabled = true;
    hud.toast('נהוראי יוצא מהבית. התצפית בסוף הרחוב.');
  });

  // a read-only window for automated tests
  window.__game = {
    get state() {
      return {
        started, paused, quality, time: simTime, fps: hud.fps,
        player: { ...player.pos, yaw: player.yaw, speed: player.speed, running: player.running, respawns: player.respawns },
        ground: world.groundHeight(player.pos.x, player.pos.z),
        camera: { yaw: follow.yaw, pitch: follow.pitch, dist: follow.dist, x: camera.position.x, y: camera.position.y, z: camera.position.z },
        mission: mission.state,
        interactVisible: !document.getElementById('btnInteract').hidden,
        pixelRatio: renderer.getPixelRatio(),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
    teleport(x, z, y) { player.place(x, z, player.yaw); if (y !== undefined) player.pos.y = y; },
    setCamera(yaw, pitch = follow.pitch) { follow.yaw = yaw; follow.pitch = pitch; follow.idle = 0; },
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
