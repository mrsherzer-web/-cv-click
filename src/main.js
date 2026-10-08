// אל תעירו את נועם — a horror game set in the Dimona commune.
import * as THREE from 'three';
import { IMAGES } from './assets.js';
import { audio } from './audio.js';
import { World } from './level.js';
import { buildCommune } from './commune.js';
import { makeHumanoid, NOAM_EYES } from './characters.js';
import { Noam } from './noam.js';
import { Npc } from './npc.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI, SPEAKERS, MESSENGER_NAME } from './ui.js';
import { Story } from './story.js';
import { FX } from './fx.js';
import { setMaxAnisotropy, makeCanvas, toTexture } from './textures.js';
import { clamp, damp, rand, pick, sleep, loadImage, isTouchDevice, dist2 } from './util.js';

const QUALITY = {
  low: { pixelRatio: 1.0, shadows: false, shadowSize: 512, moonShadow: false, moonSize: 512, bloom: false, mirror: false, aniso: 2 },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 512, moonShadow: true, moonSize: 1024, bloom: false, mirror: true, aniso: 4 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 1024, moonShadow: true, moonSize: 2048, bloom: true, mirror: true, aniso: 8 },
};

const NIGHTS = [null, 'השקט', 'ההתעוררות', 'הקול בקשר', 'DIMONA DEMONS'];
const DEATH_LINES = [
  'הוא שמע אותך נושם.',
  'עכשיו גם אתה תישן איתם במחסן.',
  'היית צריך להתכופף.',
  'הפנס הסגיר אותך.',
  'אף אחד לא בורח מנועם בדירה שלו.',
  'ירין ניסתה להזהיר אותך...',
  'הוא רצה רק לשחק איתך פיפא.',
];

class Events {
  constructor() { this.m = {}; }
  on(e, f) { (this.m[e] = this.m[e] || []).push(f); }
  emit(e, ...a) { (this.m[e] || []).forEach((f) => f(...a)); }
}

class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.debug = this.params.has('debug');
    this.settings = Object.assign({ volume: 0.9, sens: 1, quality: isTouchDevice() ? 'low' : 'high', scares: true, bright: 1 }, this._load('dimona_settings') || {});
    this.quality = QUALITY[this.settings.quality] || QUALITY.medium;
    this.progress = this._load('dimona_progress') || { night: 1, finished: false };
    if (this.params.has('all')) this.progress.night = 4;
    this.events = new Events();
    this.state = 'boot';
    this.time = 0;
    this.shake = 0;
    this.hallFlicker = 0; this.hallFlickerT = 0; this.redAlert = 0;
    this.power = false;
    this.overlay = false;
    this.cameraFovKick = 0;
    this.images = {};
  }

  _exposure() { return 1.35 * (this.settings.bright || 1); }

  _load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  _save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  saveProgress(n) {
    if (n > 4) { this.progress.finished = true; n = 4; }
    this.progress.night = Math.max(this.progress.night, n);
    this._save('dimona_progress', this.progress);
  }

  async boot() {
    const ls = document.getElementById('loadState');
    ls.textContent = 'טוען את הקומונה...';
    for (const [k, v] of Object.entries(IMAGES)) this.images[k] = await loadImage(v);
    try { await Promise.race([document.fonts.ready, sleep(2500)]); } catch (e) { /* */ }

    // renderer
    const canvas = document.getElementById('c');
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.pixelRatio <= 1.3, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatio));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this._exposure();
    renderer.shadowMap.enabled = this.quality.shadows || this.quality.moonShadow;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    setMaxAnisotropy(Math.min(this.quality.aniso, renderer.capabilities.getMaxAnisotropy()));

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x020203);
    scene.fog = new THREE.FogExp2(0x030407, 0.06);

    // world
    const world = (this.world = new World(scene));
    world.game = this;
    buildCommune(world, this.quality);
    world.finalize();

    // lights
    this.hemi = new THREE.HemisphereLight(0x22304f, 0x0a0806, 0.45);
    scene.add(this.hemi);
    const moon = (this.moon = new THREE.DirectionalLight(0x8aa2ff, 0.9));
    moon.position.set(4, 16, -18); moon.target.position.set(10, 0, 4);
    scene.add(moon, moon.target);
    if (this.quality.moonShadow) {
      moon.castShadow = true;
      moon.shadow.mapSize.set(this.quality.moonSize, this.quality.moonSize);
      const c = moon.shadow.camera; c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 1; c.far = 60;
      moon.shadow.bias = -0.0002; moon.shadow.normalBias = 0.015;
      moon.shadow.autoUpdate = false; moon.shadow.needsUpdate = true;
    } else moon.intensity = 0.12; // without shadows the moon would leak through walls
    this.sun = new THREE.DirectionalLight(0xffb070, 0); this.sun.position.set(40, 8, -10); scene.add(this.sun);
    this.menuLight = new THREE.PointLight(0x9fb4ff, 0, 7, 1.4); this.menuLight.position.set(11.9, 2.2, 10.6); scene.add(this.menuLight);
    this.fireLight = new THREE.PointLight(0xff7a20, 0, 6, 1.6); this.fireLight.position.copy(world.stovePos).add(new THREE.Vector3(0.3, 0.4, 0)); scene.add(this.fireLight);
    this._makeFireSprites();

    // characters
    const noamModel = makeHumanoid({ faceImg: this.images.noam, shirt: 'noam', shorts: '#b0141a', skin: '#c99a7c', hair: '#1a120d', height: 1.8, eyes: NOAM_EYES });
    this.noam = new Noam(this, noamModel);
    this.noam.show(false);
    this.ori = new Npc(this, makeHumanoid({ faceImg: this.images.ori, shirt: 'ori', shorts: '#55585e', skin: '#c79a7a', hair: '#24170f', height: 1.74 }));
    this.msg = new Npc(this, makeHumanoid({ faceImg: this.images.messenger, shirt: 'messenger', shorts: '#2c2f36', skin: '#c48f72', hair: '#6b4a30', height: 1.8, backpack: true }));
    this.yarin = new Npc(this, makeHumanoid({ faceImg: this.images.yarin, shirt: 'yarin', shorts: '#111114', skin: '#d6a88a', hair: '#120c09', height: 1.65 }));
    // the reflection-only Noam for the mirror scare (layer 2 = visible only in the mirror)
    this.ghost = makeHumanoid({ faceImg: this.images.noam, shirt: 'noam', height: 1.8, eyes: NOAM_EYES });
    this.ghost.setPossessed(true);
    this.ghost.root.traverse((o) => o.layers.set(2));
    this.ghost.root.visible = false;
    scene.add(this.ghost.root);

    // player, input, ui, story, fx
    this.input = new Input(canvas);
    this.input.sensitivity = this.settings.sens;
    this.input.onUnlock = () => { if (this.state === 'play' && !this.overlay && !this.paused) this.pause(true); };
    this.player = new Player(this);
    scene.add(this.player.camera);
    if (world.mirror) world.mirror.getReflectionCamera(this.player.camera).layers.enable(2);
    this.ui = new UI(this);
    this.story = new Story(this);
    this.fx = new FX(renderer, scene, this.player.camera, this.quality);
    this.menuCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 400);
    scene.add(this.menuCam);
    this._dawnSky = this._makeDawnSky();
    this._nightSky = world.sky.material.map;

    audio.setVolume(this.settings.volume);
    audio.lowCpu = isTouchDevice();
    audio.onHowl = () => {
      if (this.state !== 'play') return;
      audio.at({ x: rand(-40, 40), y: -6, z: rand(-60, -30) }, (d) => audio.howl(d), 6, { ref: 8, max: 200, roll: 0.5 });
    };

    this._bindUI();
    addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.paused) this.pause(true); });

    // warm up shaders
    renderer.compile(scene, this.player.camera);
    this._resize();
    this._last = performance.now();
    renderer.setAnimationLoop(() => this._frame());
    ls.textContent = '';
    const bb = document.getElementById('bootBtn');
    bb.disabled = false;
    if (this.debug) window.game = this;
    window.__game = this;
  }

  _makeDawnSky() {
    const c = makeCanvas(1024, 512), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#2a3f6e'); g.addColorStop(0.35, '#7b88b0'); g.addColorStop(0.47, '#f4b27a'); g.addColorStop(0.5, '#ffd9a0'); g.addColorStop(0.53, '#6b4d3a'); g.addColorStop(1, '#2a2018');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    return toTexture(c, { wrap: false });
  }

  _makeFireSprites() {
    const c = makeCanvas(64, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 90, 2, 32, 80, 50);
    g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.25, 'rgba(255,190,60,0.9)'); g.addColorStop(0.6, 'rgba(255,70,10,0.5)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    const tex = toTexture(c, { wrap: false });
    this.flames = [];
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; this.scene.add(s); this.flames.push(s);
    }
  }

  _bindUI() {
    const $ = (s) => document.querySelector(s);
    $('#bootBtn').addEventListener('click', async () => {
      await audio.resume();
      audio.init();
      audio.setVolume(this.settings.volume);
      $('#boot').classList.add('hidden');
      this.showMenu();
    });
    document.querySelectorAll('.btn').forEach((b) => b.addEventListener('mouseenter', () => audio.uiHover()));
    $('#menu').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      audio.uiSelect();
      if (act === 'new') this.startNight(1);
      if (act === 'continue') this.startNight(this.progress.night);
      if (act === 'nights') this._nightSelect();
      if (act === 'howto') this._sub('#howto');
      if (act === 'settings') this._sub('#settings');
      if (act === 'credits') { this._fillCast(); this._sub('#credits'); }
    });
    document.querySelectorAll('.screen.sub .back').forEach((b) => b.addEventListener('click', () => { audio.uiSelect(); b.closest('.screen').classList.add('hidden'); this._applySettings(); }));
    $('#pause').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      audio.uiSelect();
      if (act === 'resume') this.pause(false);
      if (act === 'restart') { this.pause(false, true); this.startNight(this.story.night, 0); }
      if (act === 'settings') this._sub('#settings');
      if (act === 'howto') this._sub('#howto');
      if (act === 'menu') { this.pause(false, true); this.showMenu(); }
    });
    $('#death').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      audio.uiSelect();
      $('#death').classList.add('hidden');
      if (act === 'retry') this.startNight(this.story.night, this.story.cpStage);
      if (act === 'menu') this.showMenu();
    });
    $('#ending').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      $('#ending').classList.add('hidden'); this.showMenu();
    });
    // settings
    const vol = $('#setVol'), sens = $('#setSens'), q = $('#setQuality'), sc = $('#setScares'), br = $('#setBright');
    vol.value = this.settings.volume; sens.value = this.settings.sens; q.value = this.settings.quality; sc.checked = this.settings.scares; br.value = this.settings.bright;
    br.addEventListener('input', () => { this.settings.bright = +br.value; if (!this.dawn) this.renderer.toneMappingExposure = this._exposure(); });
    vol.addEventListener('input', () => { this.settings.volume = +vol.value; audio.setVolume(+vol.value); });
    sens.addEventListener('input', () => { this.settings.sens = +sens.value; this.input.sensitivity = +sens.value; });
    q.addEventListener('change', () => { this.settings.quality = q.value; this._applySettings(); if (confirm('לטעון מחדש כדי להחיל את האיכות?')) location.reload(); });
    sc.addEventListener('change', () => { this.settings.scares = sc.checked; });
  }

  _applySettings() { this._save('dimona_settings', this.settings); }
  _sub(id) { document.querySelector(id).classList.remove('hidden'); }

  _fillCast() {
    const cast = [
      ['noam', 'נועם אמירם', 'נועם. הרע בסיפור. אל תעירו אותו.'],
      ['ori', 'אורי יגרמן', 'אורי. עוזר לך... עד שהוא נעלם.'],
      ['yarin', 'ירין', 'ירין. העיניים שלך מהבניין ממול.'],
      ['messenger', MESSENGER_NAME, 'הוא זה שהזהיר אותך.'],
    ];
    document.querySelector('#credits .cast').innerHTML = cast.map(([k, n, r]) => `<div class="m"><img src="${IMAGES[k]}" alt=""><div class="n">${n}</div><div class="r">${r}</div></div>`).join('');
  }

  _nightSelect() {
    const box = document.getElementById('nightSelect');
    if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
      const b = document.createElement('button');
      b.className = 'btn';
      const locked = i > this.progress.night;
      b.innerHTML = `${locked ? '🔒' : '🌙'} לילה ${i} <small>${locked ? 'נעול' : NIGHTS[i]}</small>`;
      b.disabled = locked;
      b.addEventListener('click', () => { audio.uiSelect(); this.startNight(i); });
      box.appendChild(b);
    }
    box.classList.remove('hidden');
  }

  // ---------------- menu ----------------
  showMenu() {
    this.story.abort();
    this.state = 'menu';
    this.paused = false;
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.setHud(false);
    ['#pause', '#death', '#ending', '#howto', '#settings', '#credits'].forEach((s) => document.querySelector(s).classList.add('hidden'));
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('nightSelect').classList.add('hidden');
    const cont = document.getElementById('btnContinue');
    cont.classList.toggle('hidden', this.progress.night <= 1);
    cont.textContent = `המשך — לילה ${this.progress.night}`;
    audio.stopAmbience();
    audio.chaseMusic(false);
    audio.startMenuMusic();
    // menu scene: dark dining room, TV static, the hallway light flickers... and sometimes he is standing there
    this.story.resetWorld({ clock: null });
    this.story.clockMin = null;
    this.setDawn(false);
    this.world.tv.setMode('static'); this.world.tvLight.intensity = 1.4;
    this.power = true; this.hallOn = true; this.hallFlicker = 1;
    this.noam.state = 'script'; this.noam.scriptPose = 'idle'; this.noam.model.setPossessed(true);
    this.noam.teleport(11.9, 9.8, Math.PI); this.noam.show(false);
    this.world.doors.get('boys').setOpenInstant(0.4);
    this._menuT = 0; this._menuNoam = 6;
    this.menuLight.intensity = 2.2;
    this.fx.setCamera(this.menuCam);
    this.ui.fade(0, 2000);
  }

  _updateMenu(dt) {
    this._menuT += dt;
    const t = this._menuT;
    const cam = this.menuCam;
    cam.position.set(8.2 + Math.sin(t * 0.13) * 0.25, 1.5 + Math.sin(t * 0.21) * 0.05, 2.4 + Math.sin(t * 0.09) * 0.2);
    cam.lookAt(11.6 + Math.sin(t * 0.17) * 0.3, 1.25, 9.6);
    this._menuNoam -= dt;
    if (this._menuNoam <= 0) {
      const showing = this.noam.root.visible;
      this.hallFlickerT = 0.7;
      if (!showing) {
        const spots = [[11.9, 9.9], [11.9, 8.4], [10.6, 6.9]];
        const s = this.progress.night >= 3 && Math.random() < 0.3 ? spots[2] : pick(spots.slice(0, 2));
        this.noam.teleport(s[0], s[1], Math.atan2(cam.position.x - s[0], cam.position.z - s[1]));
        this.noam.show(true);
        this._menuNoam = rand(2.5, 4.5);
        if (Math.random() < 0.5) audio.whisper(audio.now, audio.music, rand(-0.5, 0.5), 2, 0.8);
      } else {
        this.noam.show(false);
        this._menuNoam = rand(7, 13);
      }
    }
    this.noam.model.animate(dt, 0, 'idle', this.time);
    this.noam._applyTransform();
  }

  // ---------------- nights ----------------
  async startNight(n, fromStage = 0) {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('death').classList.add('hidden');
    this.state = 'play';
    this.paused = false;
    this.overlay = false;
    this.ui.fade(1, 0);
    audio.stopMenuMusic(1);
    audio.stopAmbience();
    audio.chaseMusic(false);
    this.menuLight.intensity = 0;
    this.fx.setCamera(this.player.camera);
    this.input.enabled = true;
    this.input.clearPresses();
    this.fx.u.red.value = 0; this.fx.u.blink.value = 0;
    this.story.start(n, fromStage);
  }

  nextNight(n) { this.startNight(n); }

  async nightIntro(num, title, time, short = false) {
    this.ui.setHud(false);
    this.ui.fade(1, 0);
    this.player.frozen = true;
    const tok = this.story.token;
    if (!short) await this.ui.nightCard(num, title, time);
    else await sleep(500);
    if (tok.aborted || this.state !== 'play') return;
    audio.startAmbience();
    this.ui.setHud(true);
    this.ui.setNightLabel(`${num} · ${title}`);
    this.player.frozen = false;
    this.ui.fade(0, 1600);
    if (!this.input.touch && !this.input.locked) this.ui.toast('לחץ על המסך כדי לשלוט בעכבר', 3000);
    this.input.requestLock();
  }

  powerOn(on) {
    this.power = on;
    this.hallOn = on;
    const w = this.world;
    w.deskLight.intensity = on ? 1.2 : 0;
    w.boysLight.intensity = on ? 0.6 : 0; w.boysStrip.visible = on;
  }

  flickerHall(sec) { this.hallFlickerT = sec; }

  async mirrorScare() {
    const p = this.player, w = this.world;
    p.flicker = 1.4;
    if (w.mirror && this.settings.scares) {
      const dir = p.camera.getWorldDirection(new THREE.Vector3());
      const gx = p.pos.x - dir.x * 1.15, gz = p.pos.z - dir.z * 1.15;
      this.ghost.root.position.set(gx, 0, gz);
      this.ghost.root.rotation.y = Math.atan2(dir.x, dir.z);
      this.ghost.root.visible = true;
      this.ghost.animate(0.016, 0, 'reach', this.time);
      audio.stinger(1.1);
      audio.whisper(audio.now, audio.sfx, 0, 1.5, 1.5);
      await sleep(1100);
      this.ghost.root.visible = false;
      p.flicker = 0.6;
    } else if (this.settings.scares) {
      await this.ui.flashScare(300);
    }
    setTimeout(() => this.ui.say('me', '...מה זה היה?! הוא היה מאחוריי. במראה.'), 600);
  }

  setDawn(on) {
    const w = this.world;
    this.dawn = on;
    w.sky.material.map = on ? this._dawnSky : this._nightSky;
    w.sky.material.needsUpdate = true;
    this.hemi.intensity = on ? 1.4 : 0.45;
    this.hemi.color.set(on ? 0xffd2a8 : 0x22304f);
    this.sun.intensity = on ? 2.2 : 0;
    this.scene.fog.color.set(on ? 0x8a7a72 : 0x030407);
    this.scene.fog.density = on ? 0.01 : 0.06;
    this.renderer.toneMappingExposure = on ? 1.0 : this._exposure();
  }

  // ---------------- death ----------------
  async caughtBy(noam, spot) {
    if (this.state !== 'play' || this.dying) return;
    this.dying = true;
    const p = this.player;
    p.frozen = true;
    audio.chaseMusic(false);
    if (p.hidden) {
      // he rips the door open
      p.hidden = null; this.ui.setHideOverlay(null);
      audio.doorSlam(audio.sfx);
    }
    noam.state = 'catching';
    const cam = p.camera;
    const dir = new THREE.Vector3(cam.position.x - noam.pos.x, 0, cam.position.z - noam.pos.z).normalize();
    noam.pos.set(cam.position.x - dir.x * 0.75, 0, cam.position.z - dir.z * 0.75);
    noam.yaw = Math.atan2(dir.x, dir.z);
    noam._applyTransform();
    p.lookAtPoint(new THREE.Vector3(noam.pos.x, 1.68, noam.pos.z), 14);
    this.story.abort();
    await sleep(380);
    if (this.settings.scares) await this.ui.jumpscare();
    else { audio.stinger(1); this.ui.flash(600, '#900'); await sleep(800); }
    p.stopLookAt();
    this.ui.setHud(false);
    this.input.exitLock();
    audio.stopAmbience();
    noam.stopSnore();
    this.state = 'dead';
    document.querySelector('#death .flavor').textContent = pick(DEATH_LINES);
    document.getElementById('death').classList.remove('hidden');
    this.dying = false;
  }

  // ---------------- ending ----------------
  async ending() {
    const p = this.player, n = this.noam, w = this.world;
    this.state = 'ending';
    this.story.clockMin = null;
    this.fire = false; this.fireLight.intensity = 0; this.flames.forEach((f) => (f.visible = false));
    this.redAlert = 0; w.muralEyes.visible = false; this.hallFlicker = 0;
    this.setDawn(true);
    audio.stopAllLoops();
    this.ui.setHud(false);
    p.setFlashlight(false);
    p.setPose(14.9, -3.7, Math.PI, 0.05);
    p.frozen = true; p.freeLook = true;
    n.state = 'script'; n.model.setPossessed(false); n.show(true); n.scriptPose = 'sit';
    n.teleport(15.3, -0.55, Math.PI);
    this.ori.place(13.4, -1.7, Math.PI * 0.75, 'idle'); this.ori.lookAtPlayer = true;
    this.yarin.place(17.0, -1.9, -Math.PI * 0.75, 'idle'); this.yarin.lookAtPlayer = true;
    this.msg.hide();
    this.ui.setClock('06:12');
    await this.ui.nightCard('06:12', 'זריחה', 'הלילה נגמר');
    audio.endingMusic();
    audio.birds();
    this.ui.fade(0, 2500);
    await sleep(2500);
    SPEAKERS.noamCalm = { name: 'נועם', img: IMAGES.noam };
    const say = (s, t) => this.ui.say(s, t, { wait: true });
    p.lookAtPoint(new THREE.Vector3(15.3, 0.9, -0.55), 2);
    await say('noamCalm', 'מה... מה קרה? למה אני מרגיש כאילו רצתי מרתון?');
    p.lookAtPoint(new THREE.Vector3(13.4, 1.6, -1.7), 2);
    await say('ori', 'אחי. אתה לא רוצה לדעת.');
    audio.birds();
    p.lookAtPoint(new THREE.Vector3(17.0, 1.5, -1.9), 2);
    await say('yarinLive', 'כולם התעוררו במחסן. כולם בסדר. הם לא זוכרים כלום.');
    // the messenger finally arrives with "help"
    const sd = w.doors.get('stairs');
    sd.locked = false; sd.open(true);
    this.msg.place(-1.5, -1.9, Math.PI / 2, 'idle');
    this.msg.walkTo(2.0, -2.4, { speed: 2.4, mode: 'run', direct: true });
    p.lookAtPoint(new THREE.Vector3(1.5, 1.5, -2.2), 2);
    await sleep(1400);
    await say('msg', 'הבאתי עזרה!! ...רגע. מה פספסתי?');
    p.lookAtPoint(new THREE.Vector3(13.4, 1.6, -1.7), 2);
    await say('ori', 'רק את הלילה הכי ארוך בהיסטוריה של הקומונה.');
    p.lookAtPoint(new THREE.Vector3(15.3, 0.9, -0.55), 2);
    await say('noamCalm', '...מישהו רוצה לשחק פיפא?');
    await sleep(800);
    await this.ui.fade(1, 2500);
    this.saveProgress(5);
    audio.stopLoop('ending', 3);
    const end = document.getElementById('ending');
    const txt = end.querySelector('.endText');
    end.classList.remove('hidden');
    const cast = [['noam', 'נועם אמירם'], ['ori', 'אורי יגרמן'], ['yarin', 'ירין'], ['messenger', MESSENGER_NAME]];
    txt.innerHTML = `<span class="big">אל תעירו את נועם</span>תודה ששרדת את ארבעת הלילות בקומונת דימונה.<div class="cr">${cast.map(([k, nme]) => `<div><img src="${IMAGES[k]}" alt="">${nme}</div>`).join('')}</div>DIMONA DEMONS · כן יעשה`;
    await sleep(9000);
    txt.innerHTML = '...ועל הקיר בסלון, בציור של DIMONA DEMONS,<br>משהו <b style="color:#ff3030">מצמץ</b>.';
    audio.stinger(0.8);
    await sleep(4000);
    end.querySelector('.buttons').classList.remove('hidden');
  }

  // ---------------- pause / overlay ----------------
  pause(on, silent = false) {
    if (this.state !== 'play') return;
    this.paused = on;
    document.getElementById('pause').classList.toggle('hidden', !on || silent);
    if (on) { this.input.exitLock(); if (audio.ctx) audio.ctx.suspend(); }
    else { if (audio.ctx) audio.ctx.resume(); if (!silent) this.input.requestLock(); }
  }

  setOverlay(on) {
    this.overlay = on;
    this.player.frozen = on || this.player._frozenByStory || false;
    if (on) this.input.exitLock(); else { this.input.clearPresses(); this.input.requestLock(); }
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.fx.setSize(w, h);
    for (const c of [this.player.camera, this.menuCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  }

  // ---------------- main loop ----------------
  _frame() {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - this._last) / 1000);
    this._last = nowMs;
    if (this.state === 'boot') return;
    this._logic(dt);
    if (!this.noRender) this.fx.render(dt, this.time);
  }

  // debug/testing: advance the simulation without rendering
  simulate(sec, step = 1 / 30) { for (let t = 0; t < sec; t += step) this._logic(step); }

  _logic(dt) {
    const input = this.input;
    if (this.state === 'menu') {
      this.time += dt;
      this._updateMenu(dt);
      this._updateLights(dt);
      this.world.update(dt, this.time);
      this.world.tv.update(dt);
      this.fx.u.fear.value = 0.15;
      return;
    }
    if (input.consume('pause')) {
      if (this.ui.overlayOpen()) this.ui.closeTopOverlay();
      else if (this.state === 'play') this.pause(!this.paused);
    }
    if (this.state === 'play' && !this.paused) {
      if (this.ui.overlayOpen()) {
        if (input.consume('interact')) this.ui.closeTopOverlay(false);
      } else {
        this.time += dt;
        this.player.update(dt, input);
        this.noam.update(dt, this.time);
        for (const n of [this.ori, this.msg, this.yarin]) n.update(dt, this.time);
        this.world.update(dt, this.time);
        this.story.update(dt);
        this._updateHud(dt);
      }
    } else if (this.state === 'ending') {
      this.time += dt;
      this.player.update(dt, input);
      this.noam.update(dt, this.time);
      for (const n of [this.ori, this.msg, this.yarin]) n.update(dt, this.time);
      this.world.update(dt, this.time);
    } else if (this.state === 'dead') {
      this.time += dt * 0.2;
    }
    this.world.tv.update(dt);
    this._updateLights(dt);
    audio.setListener(this.player.camera);
  }

  _updateLights(dt) {
    const w = this.world;
    // hallway lamp
    let hl = this.hallOn ? 2.6 : 0;
    if (this.hallFlickerT > 0) {
      this.hallFlickerT -= dt;
      hl = Math.random() < 0.45 ? 2.8 * Math.random() : 0;
      if (Math.random() < dt * 6) audio.click(audio.now, audio.sfx, 0.05, 6000);
    } else if (this.hallFlicker && this.hallOn) {
      if (!this._fl || this._fl <= 0) { if (Math.random() < dt * 0.8) this._fl = rand(0.05, 0.4); }
      else { this._fl -= dt; hl = Math.random() < 0.5 ? 0 : hl * 0.3; }
    }
    if (this.redAlert > 0) {
      w.hallLight.color.setRGB(1, 0.25, 0.2);
      hl *= 0.7 + Math.sin(this.time * 3) * 0.3;
    } else w.hallLight.color.setRGB(1, 0.886, 0.69);
    w.hallLight.intensity = hl;
    w.hallBulb.material.emissiveIntensity = hl * 0.8;
    // TV glow flicker
    if (w.tv.mode !== 'off') w.tvLight.intensity = (w.tv.mode === 'static' ? 0.9 : 1.6) * (0.75 + Math.random() * 0.35);
    w.tvLight.color.set(w.tv.mode === 'match' || w.tv.mode === 'goal' || w.tv.mode === 'fulltime' ? 0x9fe0a0 : 0x6f9cff);
    // mural eyes pulse
    if (w.muralEyes.visible) w.muralEyes.material.emissiveIntensity = 2 + Math.sin(this.time * 2.2) * 1.5;
    // fire
    if (this.fire) {
      this.fireLight.intensity = 2.5 + Math.random() * 1.5;
      this.flames.forEach((f, i) => {
        f.visible = true;
        const k = (this.time * 1.5 + i / this.flames.length) % 1;
        f.position.set(w.stovePos.x + Math.sin(i * 7.1) * 0.12, w.stovePos.y + 0.05 + k * 0.5, w.stovePos.z + Math.cos(i * 3.3) * 0.12);
        const s = 0.35 * (1 - k * 0.7);
        f.scale.set(s, s * 1.6, 1);
        f.material.opacity = 1 - k;
      });
    }
  }

  _updateHud(dt) {
    const p = this.player, n = this.noam, ui = this.ui, F = this.story.flags;
    const room = p.room;
    // fog / outdoor audio
    const outdoor = room && room.outdoor ? 1 : 0;
    audio.outdoor = damp(audio.outdoor, outdoor, 2, dt);
    if (!this.dawn) this.scene.fog.density = damp(this.scene.fog.density, outdoor ? 0.025 : 0.055, 2, dt);
    // fear
    let fear = n.fear();
    if (p.hidden && n.active && dist2(n.pos.x, n.pos.z, p.pos.x, p.pos.z) < 5) fear = Math.max(fear, 0.8);
    audio.setFear(fear);
    if (audio.ready && n.state === 'chase' && !audio.hasLoop('chase')) audio.chaseMusic(true);
    if (n.state !== 'chase' && audio.hasLoop('chase') && !this._keepChase) audio.chaseMusic(false);
    const u = this.fx.u;
    u.fear.value = damp(u.fear.value, fear, 3, dt);
    u.red.value = damp(u.red.value, this.redAlert * 0.12, 2, dt);
    if (n.awake && dist2(n.pos.x, n.pos.z, p.pos.x, p.pos.z) < 5 && Math.random() < dt * 0.8) p.flicker = 0.4;
    this.shake = Math.max(0, this.shake - dt * 0.5);
    // HUD
    const showSleep = F.showSleep && n.state === 'sleep' && dist2(p.pos.x, p.pos.z, this.world.noamBed.x, this.world.noamBed.z) < 10;
    ui.setSleepMeter(n.disturbance, showSleep);
    ui.setAwareness(n.active && n.state !== 'chase' ? n.suspicion : 0);
    ui.setStamina(p.stamina, p.exhausted);
    ui.setBattery(p.battery, p.hasFlashlight);
    const near = n.active && p.hidden && dist2(n.pos.x, n.pos.z, p.hidden.cam.x, p.hidden.cam.z) < 3;
    ui.setBreath(!!p.hidden, Math.max(0, p.breath), near && !p.holdingBreath);
  }
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const ls = document.getElementById('loadState');
  ls.textContent = 'שגיאה בטעינה: ' + e.message;
});
