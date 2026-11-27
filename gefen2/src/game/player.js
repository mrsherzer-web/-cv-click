// ============================================================================
//  The player: seated in the office or walking the complex in first person.
//  Owns the eye camera, the flashlight, the mask and the "hold to use" logic.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { PLAYER, floorY, roomAt } from '../world/layout.js';
import { PLAYER_CFG, FLASH } from '../config.js';
import { audio } from '../engine/audio.js';

const MAX_YAW = 1.5;
const v3 = new THREE.Vector3();

export class Player {
  constructor(S) {
    this.S = S;
    this.cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.06, 80);
    this.cam.rotation.order = 'YXZ';
    this.mode = 'seat';
    this.x = PLAYER.seat.x;
    this.z = PLAYER.seat.z;
    this.y = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.yawT = 0;
    this.pitchT = 0;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.bobT = 0;
    this.stepAcc = 0;
    this.stamina = PLAYER_CFG.stamina;
    this.sprinting = false;
    this.noise = 0; // how loud the player is right now (0..1), read by Dolev
    this.flash = { on: false, battery: 100, dead: false, flick: 0, enabled: true };
    this.mask = { on: false, amt: 0, enabled: false, t: 0 };
    this.use = { target: null, progress: 0 };
    this.shake = 0;
    this.lastPx = -1;
    // flashlight
    const q = S.G.settings.quality;
    const L = (this.spot = new THREE.SpotLight(0xfff0d8, 0, FLASH.range, FLASH.angle, 0.7, FLASH.decay));
    if (q >= 2) {
      L.castShadow = true;
      L.shadow.mapSize.set(1024, 1024);
      L.shadow.camera.near = 0.25;
      L.shadow.camera.far = 28;
      L.shadow.bias = -0.0025;
      L.shadow.normalBias = 0.02;
    }
    this.fill = new THREE.PointLight(0xffe6c8, 0, 5.5, 1.0);
    S.world.scene.add(L, L.target, this.fill);
    this.fl = { on: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), cos: Math.cos(FLASH.angle), power: 0 };
    this.fwd = new THREE.Vector3(0, 0, -1);
  }

  // ------------------------------------------------------------ mode changes
  seat() {
    this.mode = 'seat';
    this.x = PLAYER.seat.x;
    this.z = PLAYER.seat.z;
    this.y = 0;
    this.yaw = this.yawT = 0;
    this.pitch = this.pitchT = 0;
    this.vx = this.vz = 0;
    this.flash.on = false;
    this.S.G.input.setMode('seat');
  }

  stand(x = PLAYER.office_stand.x, z = PLAYER.office_stand.z, yaw = 0) {
    this.mode = 'walk';
    this.x = x;
    this.z = z;
    this.y = floorY(x, z);
    this.yaw = this.yawT = yaw;
    this.pitch = this.pitchT = 0;
    this.vx = this.vz = 0;
    this.S.G.input.setMode('walk');
  }

  freeze(on = true) {
    if (on) {
      this._prevMode = this.mode === 'frozen' ? this._prevMode : this.mode;
      this.mode = 'frozen';
      this.vx = this.vz = 0;
      this.S.G.input.setMode('ui');
    } else if (this.mode === 'frozen') {
      this.mode = this._prevMode || 'walk';
      this.S.G.input.setMode(this.mode);
    }
  }

  get room() {
    return roomAt(this.x, this.z) || this._room || 'office';
  }

  // ------------------------------------------------------------ queries
  /** Is a world point inside the flashlight cone with a clear line? */
  lights(x, y, z, maxDist = 24) {
    if (!this.fl.on) return false;
    v3.set(x, y, z).sub(this.fl.pos);
    const d = v3.length();
    if (d > maxDist) return false;
    if (v3.dot(this.fl.dir) / d < this.fl.cos * 1.01) return false;
    return this.S.world.nav.los(this.x, this.z, x, z);
  }

  /** Is a point roughly on screen and not behind a wall? */
  sees(x, z, halfAngle = 0.72, maxDist = 30) {
    const dx = x - this.x;
    const dz = z - this.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist) return false;
    if (d > 0.4 && (dx * this.fwd.x + dz * this.fwd.z) / d < Math.cos(halfAngle)) return false;
    return this.S.world.nav.los(this.x, this.z, x, z);
  }

  dist(x, z) {
    return Math.hypot(x - this.x, z - this.z);
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const S = this.S;
    const inp = S.G.input;
    const [lx, ly] = inp.consumeLook();
    const [ax, ay] = inp.axis();
    this.noise = Math.max(0, this.noise - dt * 1.2);

    if (this.mode === 'seat') {
      if (!inp.touch && inp.pointer.inside && Math.abs(inp.pointer.x - this.lastPx) > 0.0005 && !S.tabletOpen) {
        this.lastPx = inp.pointer.x;
        this.yawT = (0.5 - inp.pointer.x) * 2 * MAX_YAW * 1.1;
        this.pitchT = (0.5 - inp.pointer.y) * 0.5;
      }
      if (!S.tabletOpen) {
        this.yawT -= lx * 0.0046;
        this.pitchT -= ly * 0.003;
        this.yawT -= ax * dt * 2.3;
      }
      this.yawT = Math.max(-MAX_YAW, Math.min(MAX_YAW, this.yawT));
      this.pitchT = Math.max(-0.42, Math.min(0.36, this.pitchT));
      const k = Math.min(1, dt * 9);
      this.yaw += (this.yawT - this.yaw) * k;
      this.pitch += (this.pitchT - this.pitch) * k;
      this.eye = PLAYER.seat.eye;
      this.speed = 0;
    } else if (this.mode === 'walk') {
      const sens = S.G.settings.sens || 1;
      this.yaw -= lx * 0.0026 * sens;
      this.pitch -= ly * 0.0023 * sens;
      this.pitch = Math.max(-1.15, Math.min(1.1, this.pitch));
      const mag = Math.hypot(ax, ay);
      const wantSprint = (inp.held('sprint') || (inp.touch && mag > 0.93)) && ay > 0.3 && !this.mask.on && !this.carrying;
      if (wantSprint && this.stamina > 0.05) {
        this.sprinting = true;
        this.stamina = Math.max(0, this.stamina - dt);
      } else {
        this.sprinting = false;
        this.stamina = Math.min(PLAYER_CFG.stamina, this.stamina + dt * PLAYER_CFG.staminaRegen);
      }
      let sp = this.mask.on ? PLAYER_CFG.masked : this.sprinting ? PLAYER_CFG.sprint : PLAYER_CFG.walk;
      if (this.carrying) sp *= 0.93;
      if (this.slow) sp *= this.slow;
      const s = Math.sin(this.yaw);
      const c = Math.cos(this.yaw);
      const tx = (-s * ay + c * ax) * sp;
      const tz = (-c * ay - s * ax) * sp;
      const acc = Math.min(1, dt * 10);
      this.vx += (tx - this.vx) * acc;
      this.vz += (tz - this.vz) * acc;
      const [nx, nz] = S.world.nav.move(this.x, this.z, this.vx * dt, this.vz * dt);
      const moved = Math.hypot(nx - this.x, nz - this.z);
      this.x = nx;
      this.z = nz;
      this.y = floorY(nx, nz);
      this.speed = moved / Math.max(dt, 1e-4);
      this.bobT += moved * 1.75;
      this.stepAcc += moved;
      const stride = this.sprinting ? 1.25 : 0.95;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        audio.step?.(this.sprinting ? 0.5 : 0.28, 0, this.sprinting ? 1.15 : 1);
        this.noise = Math.max(this.noise, this.sprinting ? 1 : 0.35);
      }
      this.eye = PLAYER.eyeStand + Math.sin(this.bobT * 2) * 0.03;
      const r = roomAt(this.x, this.z);
      if (r) this._room = r;
    }

    // ---- mask
    const m = this.mask;
    if (m.enabled && inp.took('mask') && this.mode !== 'frozen' && !S.tabletOpen) this.setMask(!m.on);
    m.amt += ((m.on ? 1 : 0) - m.amt) * Math.min(1, dt * 12);
    if (m.on) m.t += dt;
    else m.t = 0;

    // ---- flashlight
    const f = this.flash;
    let want = false;
    if (f.enabled && !m.on && this.mode !== 'frozen' && !S.tabletOpen && !f.dead) {
      if (this.mode === 'seat') want = inp.held('light') && !this.facingVent();
      else {
        if (inp.took('light')) f.toggled = !f.toggled;
        want = !!f.toggled;
      }
    }
    if (this.mode === 'seat') f.toggled = false;
    if (want && f.battery <= 0) want = false;
    if (want !== f.on) {
      f.on = want;
      audio.click(0.2);
    }
    if (f.on) {
      const drain = (this.mode === 'seat' ? FLASH.seatDrain : FLASH.walkDrain) * (f.drainMul || 1);
      f.battery = Math.max(0, f.battery - drain * dt * (S.G.dev.god ? 0.2 : 1));
      if (f.battery <= 0) {
        f.on = false;
        f.toggled = false;
        audio.click(0.3);
      }
    }
    f.drainMul = 1;

    this.applyCamera(dt);
  }

  setMask(on) {
    const m = this.mask;
    if (m.on === on) return;
    m.on = on;
    audio.whoosh(on, 0.2, 0.22);
    if (on) {
      this.flash.on = false;
      this.flash.toggled = false;
      audio.breathing?.(0.35);
    } else audio.stopLoop?.('breath', 0.3);
  }

  /** seat mode: -1 = looking at the left vent, 1 = right vent, 0 = neither */
  facingVent() {
    if (this.mode !== 'seat') return 0;
    if (this.yaw > 0.92) return -1;
    if (this.yaw < -0.92) return 1;
    return 0;
  }

  /** seat mode: looking down the corridor */
  facingFront() {
    return this.mode === 'seat' && Math.abs(this.yaw) < 0.5;
  }

  applyCamera(dt) {
    const cam = this.cam;
    const sh = this.shake;
    cam.position.set(this.x + (Math.random() - 0.5) * sh, this.y + this.eye + (Math.random() - 0.5) * sh, this.z);
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.3, this.yaw, (Math.random() - 0.5) * sh * 0.2);
    const fov = this.mode === 'seat' ? 70 : this.sprinting ? 80 : 75;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 6);
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    cam.getWorldDirection(this.fwd);
    // flashlight follows the view with a little lag
    const L = this.spot;
    const f = this.flash;
    v3.set(0.2, -0.16, 0).applyQuaternion(cam.quaternion);
    L.position.copy(cam.position).add(v3);
    L.target.position.copy(cam.position).addScaledVector(this.fwd, 6);
    L.target.updateMatrixWorld();
    let inten = f.on ? FLASH.intensity : 0;
    if (f.on && (f.battery < 14 || f.flick > 0)) {
      const k = Math.max(f.flick, (14 - f.battery) / 14);
      if (Math.sin(performance.now() * 0.045) > 1 - k * 0.9) inten *= 0.12;
    }
    f.flick = Math.max(0, f.flick - dt * 2);
    L.intensity += (inten - L.intensity) * Math.min(1, dt * 30);
    this.fill.position.copy(cam.position);
    this.fill.intensity = (L.intensity / FLASH.intensity) * FLASH.fill * (this.mode === 'seat' ? 0.35 : 1);
    this.fl.on = f.on && L.intensity > FLASH.intensity * 0.04;
    this.fl.pos.copy(L.position);
    this.fl.dir.copy(this.fwd);
    this.fl.power = (L.intensity / FLASH.intensity) * 2.6;
  }

  /** Point the walking view at a world position (used after scripted moves). */
  face(x, z) {
    this.yaw = this.yawT = Math.atan2(-(x - this.x), -(z - this.z));
  }
}
