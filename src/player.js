// First-person player: movement + collision, crouch/run/stamina, flashlight with battery,
// footstep noise (which can wake Noam), interaction targeting and hiding/holding breath.
import * as THREE from 'three';
import { audio } from './audio.js';
import { clamp, damp, lerp, angleDiff } from './util.js';
import { lightCookie } from './textures.js';

const STAND_H = 1.62, CROUCH_H = 0.98;

export class Player {
  constructor(game) {
    this.game = game;
    const cam = (this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 420));
    cam.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eye = STAND_H;
    this.crouch = false;
    this.stamina = 1;
    this.battery = 1;
    this.flashOn = false;
    this.hasFlashlight = false;
    this.inventory = new Set();
    this.hidden = null;
    this.frozen = false;
    this.lookLocked = false;
    this.breath = 1;
    this.holdingBreath = false;
    this.speedNow = 0;
    this.stepDist = 0;
    this.bob = 0;
    this.target = null;
    this.holdT = 0;
    this.radius = 0.3;
    this.exhausted = false;
    this._hideT = 0;

    const q = game.quality;
    const flash = (this.flash = new THREE.SpotLight(0xfff1dc, 0, 24, 0.5, 0.6, 1.25));
    flash.castShadow = q.shadows;
    flash.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    flash.shadow.camera.near = 0.15; flash.shadow.camera.far = 22;
    flash.shadow.bias = -0.0004; flash.shadow.normalBias = 0.02;
    if (q.shadows) flash.map = lightCookie();
    flash.position.set(0.18, -0.12, 0.05);
    flash.target.position.set(0.0, -0.05, -3);
    cam.add(flash); cam.add(flash.target);
    // faint fill so the area right in front of you isn't pitch black
    this.fill = new THREE.PointLight(0xc9d4ff, 0.0, 3.2, 2);
    cam.add(this.fill);
    this.flashBase = 7.5;
    this.flicker = 0;
    this._v = new THREE.Vector3();
  }

  setPose(x, z, yaw = this.yaw, pitch = 0) {
    this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = pitch;
    this.hidden = null; this.eye = STAND_H; this.crouch = false;
    this._syncCam(0);
  }

  get height() { return this.crouch ? CROUCH_H : STAND_H; }
  get room() { return this.game.world.roomAt(this.pos.x, this.pos.z); }

  give(item) { this.inventory.add(item); this.game.ui.refreshInventory(this.inventory); }
  has(item) { return this.inventory.has(item); }
  take(item) { this.inventory.delete(item); this.game.ui.refreshInventory(this.inventory); }

  setFlashlight(on) {
    if (on && (!this.hasFlashlight || this.battery <= 0)) { if (this.hasFlashlight) audio.click(audio.now, audio.ui, 0.3, 1500); return; }
    if (this.flashOn !== on) audio.click(audio.now, audio.ui, 0.35, on ? 2200 : 1600);
    this.flashOn = on;
  }

  enterHide(spot) {
    if (this.hidden) return;
    this.hidden = spot;
    this._hideT = 0;
    this._hideFrom = this.camera.position.clone();
    this.yaw = spot.cam.yaw; this.pitch = spot.cam.pitch || 0;
    this.holdingBreath = false;
    this.game.ui.setHideOverlay(spot.kind);
    audio.doorCreak(audio.sfx, 0.5, 0.6);
    this.game.events.emit('hide', spot);
    // if Noam saw you slip in, he knows
    const n = this.game.noam;
    if (n && n.active && n.canSee(this.pos.x, this.pos.z, 1.0)) spot.seen = true; else spot.seen = false;
  }

  exitHide() {
    const s = this.hidden; if (!s) return;
    this.hidden = null;
    this.pos.set(s.exit.x, 0, s.exit.z);
    this.crouch = false;
    this.game.ui.setHideOverlay(null);
    this.holdingBreath = false;
    audio.doorCreak(audio.sfx, 0.4, 0.5);
    this.game.events.emit('unhide', s);
  }

  _syncCam(dt) {
    const c = this.camera;
    if (this.hidden) {
      const s = this.hidden.cam;
      this._hideT = Math.min(1, this._hideT + dt * 2.2);
      const t = this._hideT * this._hideT * (3 - 2 * this._hideT);
      c.position.set(lerp(this._hideFrom.x, s.x, t), lerp(this._hideFrom.y, s.y, t), lerp(this._hideFrom.z, s.z, t));
    } else {
      const bobY = Math.sin(this.bob * 2) * 0.035 * Math.min(1, this.speedNow / 2.5);
      const bobX = Math.cos(this.bob) * 0.025 * Math.min(1, this.speedNow / 2.5);
      c.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.eye + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    }
    c.rotation.set(this.pitch, this.yaw, (this.game.shake || 0) * (Math.random() - 0.5) * 0.04);
  }

  update(dt, input) {
    const world = this.game.world;
    // ---- look ----
    const look = input.takeLook();
    if (!this.frozen || this.freeLook) {
      if (!this.lookLocked) {
        this.yaw -= look.x;
        this.pitch = clamp(this.pitch - look.y, -1.35, 1.35);
      }
      if (this.hidden) {
        const base = this.hidden.cam.yaw;
        const d = angleDiff(base, this.yaw);
        this.yaw = base + clamp(d, -0.9, 0.9);
        this.pitch = clamp(this.pitch, -0.5, 0.45);
      }
    }
    if (this._lookTarget) {
      const t = this._lookTarget;
      const dx = t.x - this.camera.position.x, dz = t.z - this.camera.position.z, dy = t.y - this.camera.position.y;
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      this.yaw += angleDiff(this.yaw, ty) * Math.min(1, dt * this._lookSpeed);
      this.pitch = damp(this.pitch, tp, this._lookSpeed, dt);
    }

    // ---- flashlight ----
    if (input.consume('flashlight') && !this.frozen) this.setFlashlight(!this.flashOn);
    if (this.flashOn) {
      this.battery = Math.max(0, this.battery - dt / 540);
      if (this.battery <= 0) { this.flashOn = false; audio.click(audio.now, audio.ui, 0.3, 1200); this.game.ui.toast('הסוללה של הפנס נגמרה. חפש סוללות.'); }
    }
    let fl = this.flashOn ? this.flashBase : 0;
    if (this.flashOn) {
      const low = this.battery < 0.15 ? (Math.random() < 0.06 ? 0.15 : 0.75) : 1;
      const scare = this.flicker > 0 ? (Math.random() < 0.35 ? 0.05 : 1) : 1;
      fl *= low * scare;
    }
    this.flicker = Math.max(0, this.flicker - dt);
    this.flash.intensity = damp(this.flash.intensity, fl, 30, dt);
    this.fill.intensity = this.flashOn ? 0.22 : 0.05;

    // ---- hiding ----
    if (this.hidden) {
      this.speedNow = 0;
      const want = input.isHeld('breath') && this.breath > 0;
      if (want && !this.holdingBreath) audio.click(audio.now, audio.ui, 0.1, 800);
      this.holdingBreath = want;
      if (this.holdingBreath) {
        this.breath = Math.max(0, this.breath - dt / 7);
        if (this.breath <= 0) {
          this.holdingBreath = false;
          audio.gasp();
          world.emitNoise(this.hidden.cam.x, this.hidden.cam.z, 4.5, 'gasp');
          this.breath = -0.35; // lockout
        }
      } else this.breath = Math.min(1, this.breath + dt / 5);
      if (input.consume('interact') && !this.frozen) this.exitHide();
      this._syncCam(dt);
      this.target = null;
      this.game.ui.setPrompt(null);
      return;
    }

    // ---- movement ----
    if (input.consume('crouch') && !this.frozen) this.crouch = !this.crouch;
    const mv = this.frozen ? { x: 0, y: 0 } : input.move();
    const wantsRun = input.isHeld('run') && !this.crouch && mv.y > 0.2 && !this.exhausted;
    let speed = this.crouch ? 1.35 : wantsRun ? 4.7 : 2.45;
    if (this.game.slowMo) speed *= 0.6;
    const moving = Math.hypot(mv.x, mv.y) > 0.05;
    if (wantsRun && moving) {
      this.stamina = Math.max(0, this.stamina - dt / 4.6);
      if (this.stamina <= 0) { this.exhausted = true; audio.breath(audio.ui, 1.4); }
    } else {
      this.stamina = Math.min(1, this.stamina + dt / (this.crouch ? 5 : 7));
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;
    }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = -sin, fz = -cos, rx = cos, rz = -sin;
    const vx = (fx * mv.y + rx * mv.x) * speed, vz = (fz * mv.y + rz * mv.x) * speed;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    world.collide(this.pos, this.radius, this.height + 0.1);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speedNow = dt > 0 ? moved / dt : 0;
    // can't stand up under something
    this.eye = damp(this.eye, this.crouch ? CROUCH_H : STAND_H, 10, dt);

    // ---- footsteps -> noise ----
    if (moved > 0.0005) {
      this.bob += moved * (wantsRun ? 2.6 : 3.4);
      this.stepDist += moved;
      const stride = wantsRun ? 0.85 : this.crouch ? 0.55 : 0.7;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const room = this.room;
        const surface = room && room.outdoor ? 'outdoor' : 'tile';
        audio.footstep(audio.sfx, { vol: wantsRun ? 1.2 : this.crouch ? 0.35 : 0.8, surface });
        const r = wantsRun ? 9 : this.crouch ? 0.9 : 3.2;
        world.emitNoise(this.pos.x, this.pos.z, r, wantsRun ? 'run' : this.crouch ? 'sneak' : 'walk');
      }
    }
    if (input.consume('breath')) { /* only used when hidden */ }

    this._syncCam(dt);
    if (this.game.cameraFovKick != null) this.camera.fov = damp(this.camera.fov, 72 + (wantsRun && moving ? 6 : 0) + this.game.cameraFovKick, 6, dt);
    this.camera.updateProjectionMatrix();

    // ---- interaction ----
    this._updateTarget(dt, input);
  }

  lookAtPoint(v, speed = 4) { this._lookTarget = v; this._lookSpeed = speed; }
  stopLookAt() { this._lookTarget = null; }

  _updateTarget(dt, input) {
    const ui = this.game.ui;
    if (this.frozen) { this.target = null; ui.setPrompt(null); return; }
    const cam = this.camera;
    const dir = cam.getWorldDirection(this._v);
    let best = null, bestScore = -1;
    for (const it of this.game.world.interactables) {
      if (!it.enabled()) continue;
      const dx = it.x - cam.position.x, dy = (it.y ?? 1) - cam.position.y, dz = it.z - cam.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > it.r) continue;
      const c = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      const thresh = it.cos - Math.max(0, 1.0 - d) * 0.35;
      if (c < thresh) continue;
      // don't interact through walls
      const k = (it.door ? Math.min(0.5, d * 0.6) : Math.min(0.35, d * 0.5)) / d;
      if (!this.game.world.nav.lineOfSight(cam.position.x, cam.position.z, it.x - dx * k, it.z - dz * k)) continue;
      const score = c * 2 - d * 0.3;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    if (best !== this.target) { this.holdT = 0; this.target = best; }
    if (!best) { ui.setPrompt(null); return; }
    const label = typeof best.label === 'function' ? best.label() : best.label;
    if (!label) { ui.setPrompt(null); return; }
    if (best.hold) {
      if (input.isHeld('interact')) {
        this.holdT += dt;
        if (best.onHold) best.onHold(dt, this.holdT / best.hold);
        if (this.holdT >= best.hold) { this.holdT = 0; input.held.delete('interact'); input.consume('interact'); best.use(); }
      } else if (this.holdT > 0) { this.holdT = Math.max(0, this.holdT - dt * 2); if (best.onRelease) best.onRelease(); }
      ui.setPrompt(label, best.hold ? this.holdT / best.hold : 0, true);
      input.consume('interact');
    } else {
      ui.setPrompt(label);
      if (input.consume('interact')) best.use();
    }
  }
}
