// ============================================================================
//  The office - a small snooker room with two steel doors and the monitors
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import * as P from './props.js';

const W = 6, D = 5.6, H = 3; // x: -3..3, z: -4..1.6
const DOOR_Z = -1.0;
const DOOR_W = 1.35;
const DOOR_H = 2.3;

export class Office {
  constructor(A) {
    this.A = A;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x010101);
    s.fog = new THREE.FogExp2(0x030303, 0.05);
    this.camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.03, 40);
    this.camera.position.set(0, 1.32, 0.95);
    this.yaw = 0;
    this.targetYaw = 0;
    this.maxYaw = 1.05;
    this.bob = 0;
    this.lamps = [];
    this.power = true;
    this.state = {
      left: { closed: false, light: false, pos: 0 },
      right: { closed: false, light: false, pos: 0 },
    };
    this.buttons = [];
    this.build();
  }

  build() {
    const s = this.scene;
    const A = this.A;
    const wallTex = T.wallpaper('#1c2620', '#24322a');
    // floor / ceiling
    const fl = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 6, D + 2),
      new THREE.MeshStandardMaterial({ map: T.tex(T.woodFloor(), { repeat: [4, 2.5] }), roughness: 0.7 }),
    );
    fl.rotation.x = -Math.PI / 2;
    fl.position.z = -1.2;
    fl.receiveShadow = true;
    s.add(fl);
    const ce = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 6, D + 2),
      new THREE.MeshStandardMaterial({ map: T.tex(T.ceilingTiles(true), { repeat: [10, 6] }), roughness: 0.95 }),
    );
    ce.rotation.x = Math.PI / 2;
    ce.position.set(0, H, -1.2);
    s.add(ce);
    const wallMat = (len) => new THREE.MeshStandardMaterial({ map: T.tex(wallTex, { repeat: [len / 2.2, 1] }), roughness: 0.85 });
    const wall = (len, x, z, ry, h = H, y = h / 2) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat(len));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      s.add(m);
      return m;
    };
    wall(W, 0, -4, 0); // back
    wall(W, 0, 1.6, Math.PI); // behind the player
    // side walls with door openings
    for (const side of [-1, 1]) {
      const x = side * 3;
      const ry = -side * Math.PI / 2;
      const z0 = DOOR_Z - DOOR_W / 2;
      const z1 = DOOR_Z + DOOR_W / 2;
      const backLen = z0 - -4;
      const frontLen = 1.6 - z1;
      wall(backLen, x, -4 + backLen / 2, ry);
      wall(frontLen, x, z1 + frontLen / 2, ry);
      wall(DOOR_W, x, DOOR_Z, ry, H - DOOR_H, DOOR_H + (H - DOOR_H) / 2);
      // door frame
      const fm = P.std(0x2a2c2e, 0.5, 0.6);
      P.box(0.12, DOOR_H, 0.08, fm, x, DOOR_H / 2, z0, s);
      P.box(0.12, DOOR_H, 0.08, fm, x, DOOR_H / 2, z1, s);
      P.box(0.12, 0.1, DOOR_W + 0.16, fm, x, DOOR_H, DOOR_Z, s);
      // hazard stripes on the floor
      const hz = T.textTexture([''], { w: 256, h: 64, bg: '#111' });
      const hctx = hz.getContext('2d');
      for (let i = -64; i < 256; i += 32) {
        hctx.fillStyle = '#c9a400';
        hctx.beginPath();
        hctx.moveTo(i, 64);
        hctx.lineTo(i + 16, 64);
        hctx.lineTo(i + 48, 0);
        hctx.lineTo(i + 32, 0);
        hctx.fill();
      }
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 0.22), new THREE.MeshStandardMaterial({ map: T.tex(hz), roughness: 0.8 }));
      stripe.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      stripe.position.set(x - side * 0.14, 0.006, DOOR_Z);
      s.add(stripe);
      // the dark hallway behind the door
      const hl = 2.8;
      const hx = x + side * hl / 2;
      wall(hl, hx, DOOR_Z - 0.95, 0);
      wall(hl, hx, DOOR_Z + 0.95, Math.PI);
      wall(1.9, x + side * hl, DOOR_Z, -ry);
      // steel shutter
      const sh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, DOOR_H + 0.1, DOOR_W + 0.06),
        new THREE.MeshStandardMaterial({ map: T.tex(T.metal(0.5), { repeat: [1, 2] }), roughness: 0.45, metalness: 0.6 }),
      );
      sh.castShadow = true;
      sh.receiveShadow = true;
      s.add(sh);
      const st = this.state[side < 0 ? 'left' : 'right'];
      st.mesh = sh;
      st.x = x - side * 0.02;
      // hallway light (the "light" button)
      const L = new THREE.SpotLight(0xffe6c0, 0, 0, 0.75, 0.5, 2);
      L.position.set(x + side * 0.35, 2.6, DOOR_Z);
      L.target.position.set(x + side * 1.6, 0.8, DOOR_Z);
      L.castShadow = true;
      L.shadow.mapSize.set(512, 512);
      L.shadow.bias = -0.001;
      s.add(L, L.target);
      st.lightObj = L;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      bulb.position.set(x + side * 0.5, 2.75, DOOR_Z);
      s.add(bulb);
      st.bulb = bulb;
      const fill = new THREE.PointLight(0xffd0a0, 0.9, 3.2, 2);
      fill.position.set(x - side * 0.7, 2.5, DOOR_Z + 0.2);
      s.add(fill);
      st.fill = fill;
      const warn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0x220000 }));
      warn.position.set(x - side * 0.08, DOOR_H + 0.22, DOOR_Z);
      s.add(warn);
      st.warn = warn;
      // button panel
      const panel = new THREE.Group();
      P.box(0.05, 0.62, 0.3, P.std(0x3a3d40, 0.5, 0.5), 0, 0, 0, panel);
      const mkBtn = (y, color, action) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 20), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.4 }));
        b.rotation.z = Math.PI / 2;
        b.position.set(-side * 0.04, y, 0);
        b.userData = { side: side < 0 ? 'left' : 'right', action };
        panel.add(b);
        this.buttons.push(b);
        return b;
      };
      st.doorBtn = mkBtn(0.14, 0xd01818, 'door');
      st.lightBtn = mkBtn(-0.14, 0xe8e2c8, 'light');
      panel.position.set(x - side * 0.03, 1.3, DOOR_Z + side * 0 + 0.95);
      s.add(panel);
    }
    this.updateDoors(0, true);

    // ------------------------------------------------ the room content
    // snooker table at the back with its lamp
    const table = P.snookerTable({ length: 3.0, width: 1.6, scatter: true });
    table.position.set(0, 0, -2.75);
    s.add(table);
    const lamp = P.pendantLamp({ shades: 2, intensity: 9, spacing: 1.0 });
    lamp.position.set(0, H - 1.1, -2.75);
    s.add(lamp);
    lamp.seed = 3;
    this.lamps.push(lamp);
    // back wall decor
    const posterDuo = P.poster(A.tex.posterDuo, 0.78, 1.4);
    posterDuo.position.set(-1.9, 1.65, -3.97);
    s.add(posterDuo);
    const champ = P.poster(A.tex.champion, 0.8, 1.13, { frameColor: 0x6a4a1a });
    champ.position.set(1.85, 1.65, -3.97);
    s.add(champ);
    this.champ = champ;
    const rack = P.cueRack(8);
    rack.position.set(0, 0.35, -3.94);
    s.add(rack);
    // wall clock that shows the game time
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), P.std(0xe8e2d0, 0.6));
    clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 32), P.M.black);
    clock.add(rim);
    const hand = (len, w, z) => {
      const g = new THREE.Group();
      const m = P.box(w, len, 0.008, P.M.black, 0, len / 2, z, g);
      m.castShadow = false;
      clock.add(g);
      return g;
    };
    this.hourHand = hand(0.12, 0.018, 0.01);
    this.minHand = hand(0.18, 0.012, 0.02);
    clock.position.set(0, 2.45, -3.96);
    s.add(clock);
    // newspaper pinned on the right wall
    const news = P.poster(A.tex.newspaper, 0.55, 0.73, { frame: false });
    news.position.set(2.97, 1.6, -2.6);
    news.rotation.y = -Math.PI / 2;
    s.add(news);

    // desk
    const desk = new THREE.Group();
    P.box(2.3, 0.06, 0.85, P.std(0x3a2616, 0.6), 0, 0.76, 0, desk);
    for (const x of [-1.05, 1.05]) P.box(0.08, 0.76, 0.75, P.std(0x2a1a0e, 0.7), x, 0.38, 0, desk);
    P.box(2.1, 0.5, 0.04, P.std(0x2a1a0e, 0.7), 0, 0.45, -0.38, desk);
    desk.position.set(0, 0, -0.15);
    s.add(desk);
    // CRT monitors
    this.noise = T.noiseCanvas(128, 96);
    this.noiseTex = T.tex(this.noise.canvas);
    this.noiseTex.magFilter = THREE.NearestFilter;
    const mon1 = P.crtMonitor(this.noiseTex);
    mon1.position.set(-0.27, 0.79, -0.42);
    mon1.rotation.y = 0.14;
    mon1.scale.setScalar(0.72);
    const mon2 = P.crtMonitor(this.noiseTex);
    mon2.position.set(0.27, 0.79, -0.42);
    mon2.rotation.y = -0.14;
    mon2.scale.setScalar(0.72);
    s.add(mon1, mon2);
    this.monitors = [mon1, mon2];
    const monLight = new THREE.PointLight(0x9fe0c0, 1.2, 0, 2);
    monLight.position.set(0, 1.15, 0.05);
    s.add(monLight);
    this.monLight = monLight;
    // fan
    const fan = P.deskFan();
    fan.position.set(0.9, 0.79, -0.25);
    fan.rotation.y = -0.5;
    s.add(fan);
    this.fan = fan;
    // red bottle, the black ball, a framed photo of (normal) Gefen, a radio
    const bottle = new THREE.Group();
    P.cyl(0.04, 0.04, 0.24, P.std(0xb0101a, 0.12, 0, { emissive: new THREE.Color(0x3a0004) }), 0, 0.12, 0, bottle, 12);
    P.cyl(0.014, 0.022, 0.09, P.std(0xb0101a, 0.12, 0, { emissive: new THREE.Color(0x3a0004) }), 0, 0.28, 0, bottle, 8);
    P.cyl(0.016, 0.016, 0.03, P.M.gold, 0, 0.335, 0, bottle, 8);
    bottle.position.set(-0.72, 0.79, -0.42);
    bottle.scale.setScalar(0.62);
    s.add(bottle);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), P.std(0x060606, 0.12, 0.2));
    ball.position.set(-0.6, 0.825, 0.12);
    s.add(ball);
    const frame = P.poster(A.tex.gefenPhoto, 0.16, 0.21, { frameColor: 0x8a6a2a });
    frame.position.set(0.55, 0.92, -0.05);
    frame.rotation.set(-0.15, -0.35, 0);
    s.add(frame);
    this.photoFrame = frame;
    const radio = new THREE.Group();
    P.box(0.09, 0.2, 0.05, P.M.black, 0, 0.1, 0, radio);
    P.cyl(0.006, 0.006, 0.14, P.M.black, 0.03, 0.27, 0, radio, 4);
    this.radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: 0x113311 }));
    this.radioLed.position.set(-0.02, 0.17, 0.027);
    radio.add(this.radioLed);
    radio.position.set(0.25, 0.79, 0.15);
    radio.rotation.y = -0.4;
    s.add(radio);
    // desk lamp (warm)
    const dl = new THREE.Group();
    P.cyl(0.07, 0.08, 0.02, P.M.black, 0, 0.01, 0, dl, 12);
    const arm = P.cyl(0.008, 0.008, 0.4, P.M.black, 0, 0.2, 0, dl, 6);
    arm.rotation.z = 0.2;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 14), P.std(0x1d3b26, 0.5, 0.3));
    shade.position.set(-0.05, 0.4, 0);
    dl.add(shade);
    dl.position.set(-1.0, 0.79, -0.3);
    s.add(dl);
    const deskLight = new THREE.PointLight(0xffc888, 2.2, 0, 2);
    deskLight.position.set(-1.02, 1.12, -0.25);
    deskLight.castShadow = true;
    deskLight.shadow.mapSize.set(512, 512);
    deskLight.shadow.bias = -0.002;
    s.add(deskLight);
    this.deskLight = deskLight;
    this.deskLightBase = 2.2;
    // ambient
    this.hemi = new THREE.HemisphereLight(0x3a4050, 0x0a0806, 0.25);
    s.add(this.hemi);
    // blood on the floor near the right door
    const blood = P.decal(T.bloodDecal(51), 1.0, 1.0, 0.85);
    blood.rotation.x = -Math.PI / 2;
    blood.position.set(2.3, 0.013, -0.4);
    s.add(blood);
    this.raycaster = new THREE.Raycaster();
  }

  setNight(n) {
    this.champ.surface.material.map = n >= 3 ? this.A.tex.championScary : this.A.tex.champion;
    this.photoFrame.surface.material.map = n >= 4 ? this.A.tex.gefenScaryPhoto : this.A.tex.gefenPhoto;
  }

  reset() {
    for (const side of ['left', 'right']) {
      const st = this.state[side];
      st.closed = false;
      st.light = false;
      st.pos = 0;
      st.lightObj.intensity = 0;
      st.disabled = false;
    }
    this.power = true;
    this.yaw = this.targetYaw = 0;
    this.updateDoors(0, true);
    this.setPower(true);
  }

  setPower(on) {
    this.power = on;
    this.lamps.forEach((l) => P.setLamp(l, on ? 1 : 0));
    this.deskLight.intensity = on ? this.deskLightBase : 0;
    this.monLight.intensity = on ? 1.2 : 0;
    this.hemi.intensity = on ? 0.25 : 0.035;
    this.monitors.forEach((m) => (m.screen.material.color.setScalar(on ? 1.6 : 0.02)));
    if (!on)
      for (const side of ['left', 'right']) {
        this.state[side].light = false;
        this.state[side].closed = false;
      }
  }

  /** world-space spot for a character standing in the doorway */
  doorSpot(side, charKey, lit) {
    const x = side === 'left' ? -4.05 : 4.05;
    const base = charKey === 'char_gefen' ? { y: 0.3, h: 1.5 } : charKey === 'char_cap' ? { y: 0.62, h: 1.16 } : { y: 0.7, h: 1.06 };
    return { pos: [x, base.y, DOOR_Z], h: base.h, light: lit ? 0.95 : 0.0, glow: lit ? 3 : 0, fade: 0.28, shadow: false };
  }
  outageSpot() {
    return { pos: [-3.45, 0.3, DOOR_Z + 0.1], h: 1.5, light: 0, glow: 6, fade: 0.25, shadow: false };
  }

  updateDoors(dt, snap = false) {
    for (const side of ['left', 'right']) {
      const st = this.state[side];
      const target = st.closed ? 1 : 0;
      if (snap) st.pos = target;
      else st.pos += (target - st.pos) * Math.min(1, dt * 14);
      const openY = DOOR_H + 1.25;
      const closedY = (DOOR_H + 0.1) / 2;
      st.mesh.position.set(st.x, openY + (closedY - openY) * st.pos, DOOR_Z);
      const btnOn = (b, on, c) => {
        b.material.emissiveIntensity = on ? 1.6 : 0.08;
      };
      btnOn(st.doorBtn, st.closed);
      btnOn(st.lightBtn, st.light);
      const want = st.light && this.power ? 7 : 0;
      st.lightObj.intensity = want * (st.light ? 0.85 + Math.random() * 0.15 : 1);
      st.bulb.material.color.setHex(st.light && this.power ? 0xfff0c0 : 0x222222);
      st.warn.material.color.setRGB(st.closed && this.power ? 3 : 0.12, 0.02, 0.02);
      st.fill.intensity = this.power ? 0.9 : 0;
      if (st.light && this.power) st.bulb.material.color.multiplyScalar(4);
    }
  }

  setClock(hours) {
    // hours since midnight (0..6)
    const h = hours % 12;
    this.hourHand.rotation.z = -(h / 12) * Math.PI * 2;
    this.minHand.rotation.z = -((hours * 60) % 60) / 60 * Math.PI * 2;
  }

  pick(ndcX, ndcY) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this.raycaster.intersectObjects(this.buttons, false)[0];
    return hit && hit.distance < 6 ? hit.object.userData : null;
  }

  update(t, dt, { flicker = 0.2, shake = 0 } = {}) {
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 7);
    this.bob += dt;
    const c = this.camera;
    c.position.set(Math.sin(this.yaw) * -0.08, 1.32 + Math.sin(this.bob * 1.3) * 0.006, 0.95);
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    c.rotation.set(-0.035 + sy, this.yaw + sx, 0, 'YXZ');
    if (this.power) {
      this.lamps.forEach((l) => P.setLamp(l, P.flickerFactor(t, l.seed, flicker)));
      this.deskLight.intensity = this.deskLightBase * P.flickerFactor(t, 11, flicker * 0.6);
      this.fan.blades.rotation.z -= dt * 22;
      this.fan.head.rotation.y = Math.sin(t * 0.5) * 0.5;
      if (Math.floor(t * 20) % 2 === 0) {
        this.noise.draw([150, 255, 190]);
        this.noiseTex.needsUpdate = true;
      }
    }
    this.updateDoors(dt);
  }
}

export const OFFICE_DOOR_Z = DOOR_Z;
