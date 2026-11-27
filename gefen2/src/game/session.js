// ============================================================================
//  One night in play: owns the world, the player, enemies, allies, the office
//  systems and the HUD, and gives night scripts a small awaitable API.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { World } from '../world/world.js';
import { Actor } from '../world/actor.js';
import { CAMS, SPOTS, POINTS, PLAYER, VENTS, floorY, roomAt } from '../world/layout.js';
import { Player } from './player.js';
import { Gefen, Ido, Dolev, Follower } from './enemies.js';
import { Office } from './office.js';
import { Phone } from './phone.js';
import { Hud } from './hud.js';
import { AI, CHAR, TIME, PLAYER_CFG, NIGHT_TITLES, POWER } from '../config.js';
import { SPEAKERS, UI } from '../story.js';
import { audio } from '../engine/audio2.js';
import { voice } from '../engine/voice.js';

export const CANCEL = Symbol('cancel');
const v3 = new THREE.Vector3();

export class Session {
  constructor(G, { night = 1 } = {}) {
    this.G = G;
    this.night = night;
    this.time = 0;
    this.clock = 0;
    this.clockRun = false;
    this.showClock = true;
    this.powerOn = true;
    this.waiters = new Set();
    this.listeners = {};
    this.uses = [];
    this.flags = {};
    this.threat = 0;
    this.threatShown = 0;
    this.dead = false;
    this.busy = false; // true during cut scenes: tools are locked
    this.playerSafe = false;
    this.balls = -1;
    this.video = null;
    this.ambT = 6;
    this.callCd = 0;
    this.marker = null;

    this.world = new World({ lights: [3, 5, 6][G.settings.quality] ?? 5, tex: G.assets.worldTex });
    this.player = new Player(this);
    this.cctv = new THREE.PerspectiveCamera(80, 16 / 9, 0.05, 80);
    this.office = new Office(this);
    this.phone = new Phone(this);
    const A = (id, opts) => new Actor(this.world, id, G.assets.sheet(id), opts);
    this.actors = {
      gefen: A('gefen', { eye: CHAR.gefen.eye, glow: 3.2 }),
      ido: A('ido', { eye: CHAR.ido.eye, glow: 3 }),
      dolev: A('dolev', { eye: CHAR.dolev.eye, glow: 3 }),
      yahali: A('yahali', { glow: 0 }),
      maayan: A('maayan', { glow: 0 }),
      cap: A('cap', { glow: 0 }),
      smiler: A('smiler', { glow: 0 }),
    };
    this.enemies = {
      gefen: new Gefen(this, 'gefen', this.actors.gefen),
      ido: new Ido(this, 'ido', this.actors.ido),
      dolev: new Dolev(this, 'dolev', this.actors.dolev),
    };
    this.allies = {
      yahali: new Follower(this, 'yahali', this.actors.yahali),
      maayan: new Follower(this, 'maayan', this.actors.maayan),
      cap: new Follower(this, 'cap', this.actors.cap),
      smiler: new Follower(this, 'smiler', this.actors.smiler),
    };
    this.hud = new Hud(this);
    this.phone.render();
    this.markerEl = document.createElement('div');
    this.markerEl.className = 'marker';
    this.markerEl.hidden = true;
    this.markerEl.innerHTML = '<i></i><span></span>';
    this.hud.el.appendChild(this.markerEl);
    this.dust = this._dust();
    this.player.seat();
    audio.drone(0.8);
    audio.tensionStart?.();
    this.on('move', (e) => this._callout(e));
    this.on('broken', (e) => this._onBroken(e));
    this.on('maayanFix', (e) => {
      if (e.start) this.quick('maayan', { cams: 'המצלמות נפלו. אני מטפל.', audio: 'הרמקולים מתו. שנייה.', power: 'הוא משחק בחשמל. אני על זה.' }[e.key]);
    });
    window.__g2 = this;
  }

  get tabletOpen() {
    return this.office.tablet.open;
  }

  // ------------------------------------------------------------ events
  on(type, fn) {
    (this.listeners[type] = this.listeners[type] || new Set()).add(fn);
    return () => this.listeners[type].delete(fn);
  }
  emit(type, data = {}) {
    this.listeners[type]?.forEach((fn) => fn(data));
    this.last = this.last || {};
    this.last[type] = { ...data, t: this.time };
  }

  // ------------------------------------------------------------ awaitables
  until(fn) {
    return new Promise((res, rej) => this.waiters.add({ fn, res, rej }));
  }
  wait(sec) {
    const t = this.time + sec;
    return this.until(() => this.time >= t);
  }
  /** Wait for the first of several promises (each should be an S awaitable). */
  race(...ps) {
    return Promise.race(ps);
  }
  event(type, pred = null) {
    return new Promise((res, rej) => {
      const off = this.on(type, (d) => {
        if (pred && !pred(d)) return;
        off();
        this.waiters.delete(w);
        res(d);
      });
      const w = { fn: () => false, res, rej, off };
      this.waiters.add(w);
    });
  }
  cancelAll() {
    for (const w of [...this.waiters]) {
      this.waiters.delete(w);
      w.off?.();
      w.rej(CANCEL);
    }
  }
  clockTo(h) {
    this.clockRun = true;
    return this.until(() => this.clock >= h - 1e-6);
  }

  // ------------------------------------------------------------ helpers
  pan(x, z) {
    const P = this.player;
    const dx = x - P.x;
    const dz = z - P.z;
    const d = Math.hypot(dx, dz) || 1;
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    return Math.max(-1, Math.min(1, ((dx * rx + dz * rz) / d) * 0.9));
  }
  att(x, z, ref = 8) {
    const d = this.player.dist(x, z);
    return Math.max(0, Math.min(1, ref / (ref + d * d * 0.35)));
  }

  camGlitch(room) {
    if (room) this.office.camGlitch[room] = 0.6;
  }

  fpEnemies() {
    return Object.values(this.enemies).filter((e) => e.mode === 'fp');
  }

  officeAI(cfg) {
    for (const id of ['gefen', 'ido', 'dolev']) {
      const v = cfg[id];
      const e = this.enemies[id];
      if (v === undefined) continue;
      if (!v) e.off();
      else e.startOffice(typeof v === 'number' ? v : AI[id].level[this.night]);
    }
  }

  /** Put an ally in the office at his usual spot. */
  allyInOffice(id, on = true) {
    const a = this.allies[id];
    a.inOffice = on;
    if (!on) {
      a.actor.setPose('idle');
      return a.off();
    }
    a.mode = 'idle';
    a.placeSpot({ yahali: 'yahali_seat', maayan: 'maayan_post', cap: 'cap_post', smiler: 'smiler_post' }[id]);
    a.actor.setPose(id === 'yahali' && a.actor.sheet.sit ? 'sit' : 'idle');
    a.actor.show(true);
  }

  // ---- speech -------------------------------------------------------------
  lineDur(line) {
    const b = audio.samples['v_' + line.id];
    if (b) return b.duration / (SPEAKERS[line.who]?.demon ? 0.92 : 1) + 0.35;
    return 1.3 + [...line.text].length * 0.062;
  }

  /** Speak a scripted line with subtitle. Resolves when it is over. */
  async say(line, { radio = false, keep = false, block = true } = {}) {
    const sp = SPEAKERS[line.who] || SPEAKERS.sys;
    const dur = this.lineDur(line);
    if (this.G.settings.subs !== false || line.who === 'sys') this.hud.say(line.who, line.text, keep ? 0 : dur + 0.4);
    if (line.who !== 'sys' && this.G.settings.voice !== false) {
      const s = audio.playSample?.('v_' + line.id, { vol: sp.demon ? 1.1 : 0.95, rate: sp.demon ? 0.92 : 1, reverb: sp.demon ? 0.7 : 0.12, filter: sp.demon ? 'demon' : radio ? 'radio' : null, bus: 'sfx' });
      if (!s && voice.available && sp.voice) voice.speak(line, sp.voice, sp.demon ? 1 : 0.9);
      if (radio && !s) audio.radioBeep();
    }
    if (block) await this.wait(dur);
  }

  /** Short unscripted bark (ally call-outs). Never blocks. */
  quick(who, text) {
    if (!text || this.busy) return;
    this.say({ id: 'q_' + who + '_' + text.length, who, text }, { block: false });
  }

  async talk(lines, opts = {}) {
    for (const l of lines) await this.say(l, opts);
  }

  // ---- interaction ---------------------------------------------------------
  addUse(u) {
    this.uses.push(u);
    return u;
  }
  removeUse(id) {
    this.uses = this.uses.filter((u) => u.id !== id);
    if (this.player.use.target?.id === id) this.player.use.target = null;
  }

  setMarker(x, z, y = 1.2) {
    this.marker = x == null ? null : { x, y: floorY(x, z) + y, z };
  }

  /** Walk to a point and hold "use". Resolves when done. */
  goTo(key, { label, short = null, hold = 1.2, radius = PLAYER_CFG.reach, y = 1.2, marker = true } = {}) {
    const p = Array.isArray(key) ? key : POINTS[key];
    const id = Array.isArray(key) ? 'pt' + key.join('_') : key;
    if (marker) this.setMarker(p[0], p[1], y);
    return new Promise((res, rej) => {
      const w = { fn: () => false, res, rej };
      this.waiters.add(w);
      this.addUse({
        id, x: p[0], z: p[1], label, short, hold, radius,
        done: () => {
          this.removeUse(id);
          this.waiters.delete(w);
          if (marker) this.setMarker(null);
          res();
        },
      });
      w.off = () => this.removeUse(id);
    });
  }

  /** Scatter spare batteries for a walking stage (call after resetStage). */
  spawnBatteries(n = 3) {
    const list = this.world.batteries;
    const off = (this.night * 2 + this.stageIdx) % list.length;
    for (let i = 0; i < list.length; i++) {
      const b = list[(i + off) % list.length];
      const on = i < n;
      b.mesh.visible = on;
      if (!on) continue;
      const id = 'bat' + ((i + off) % list.length);
      this.addUse({
        id, x: b.x, z: b.z, label: 'קח סוללה', short: UI.interact, hold: 0.35, radius: 1.6,
        done: () => {
          this.removeUse(id);
          b.mesh.visible = false;
          this.player.flash.battery = Math.min(100, this.player.flash.battery + 35);
          audio.okBeep?.(0.2);
          this.hud.toast('🔋 +35%', 2);
        },
      });
    }
  }

  /** Resolves when the walking player is within r of a point. */
  reach(x, z, r = 1.3) {
    return this.until(() => this.player.dist(x, z) < r);
  }

  makeNoise(x, z, strength = 1) {
    this.enemies.dolev.hear(x, z, strength);
    if (strength >= 1) this.enemies.gefen.hear?.(x, z);
    this.emit('noise', { x, z });
  }

  throwBall() {
    if (!(this.balls > 0)) return;
    this.balls--;
    const P = this.player;
    const dx = -Math.sin(P.yaw);
    const dz = -Math.cos(P.yaw);
    let x = P.x;
    let z = P.z;
    const nav = this.world.nav;
    for (let i = 0; i < 34; i++) {
      const nx = x + dx * 0.25;
      const nz = z + dz * 0.25;
      const k = nav.idx(nx, nz);
      if (k < 0 || nav.sight[k]) break;
      x = nx;
      z = nz;
    }
    audio.whoosh(true, 0.15, 0.2);
    this.wait(0.42)
      .then(() => {
        audio.ballBounce?.(this.pan(x, z), 0.5 * this.att(x, z, 10) + 0.15);
        this.makeNoise(x, z, 1);
      })
      .catch(() => {});
  }

  // ---- video ---------------------------------------------------------------
  /** Play a clip through the post shader. Falls back to nothing when the clip is missing. Returns true if it played. */
  async clip(key, { preset = 'clip', max = 12, shake = 0, rate = 1 } = {}) {
    const v = this.G.assets.video(key);
    if (!v) return false;
    const ok = await v.play(rate);
    if (!ok) return false;
    this.G.gfx.setVideo(v.tex, v.aspect);
    this.video = { v, preset, shake };
    this.G.gfx.fx.videoAmt = 1;
    try {
      await this.race(this.until(() => v.el.ended || v.el.currentTime >= v.el.duration - 0.06), this.wait(max));
    } finally {
      this.stopClip();
    }
    return true;
  }
  stopClip() {
    if (!this.video) return;
    this.video.v.el.pause();
    this.video = null;
    this.G.gfx.fx.videoAmt = 0;
    this.G.gfx.setVideo(null);
  }

  // ---- caught while walking: one struggle, then it is over ---------------------
  /** An enemy reached the walking player. The first time in a while you can wrestle free. */
  grab(by, enemy) {
    if (this.dead || this.won || this.G.dev.god || this.grabbing || this.playerSafe) return;
    if (this.time < (this.grabCd || 0)) return this.kill(by);
    this.grabbing = true;
    this.grabCd = this.time + 24;
    const P = this.player;
    const wasBusy = this.busy;
    const held = Object.values(this.enemies).map((e) => [e, e.hold]);
    held.forEach(([e]) => (e.hold = true));
    this.busy = true;
    P.freeze(true);
    P.face(enemy.x, enemy.z);
    P.setMask(false);
    audio.sting(0.6);
    audio.scream(0.4);
    this.G.gfx.fx.glitch = 0.9;
    enemy.actor.uniforms.twitch.value = 2.4;
    let p = 0;
    let presses = 0;
    const on = (e) => {
      if (e.type === 'keydown' && e.repeat) return;
      presses++;
    };
    addEventListener('keydown', on);
    addEventListener('pointerdown', on);
    const t0 = this.time;
    const need = 11;
    const end = (ok) => {
      removeEventListener('keydown', on);
      removeEventListener('pointerdown', on);
      this.hud.mash(null);
      P.shake = 0;
      this.grabbing = false;
      held.forEach(([e, h]) => (e.hold = h));
      this.busy = wasBusy;
      P.freeze(false);
      if (!ok) return this.kill(by);
      audio.bang(0, 0.8);
      audio.hiss?.(0.6);
      this.G.gfx.fx.flash = 0.5;
      P.flash.battery = Math.max(0, P.flash.battery - 10);
      if (enemy.id === 'gefen') {
        enemy.state = 'stunned';
        enemy.stunT = 3.2;
        enemy.stunCd = 3.2;
      } else if (enemy.id === 'ido') {
        enemy.awayT = 14;
        enemy.actor.show(false);
      } else enemy.tinkerT = 5;
      this.hud.toast('השתחררת! בפעם הבאה הוא לא ירפה.', 4, 'warn');
    };
    const w = {
      fn: () => {
        if (this.G.dev.bot) presses += 0.5;
        p = Math.max(0, p + presses - 2.2 / 60);
        presses = 0;
        this.hud.mash(Math.min(1, p / need));
        P.shake = 0.03 + 0.03 * Math.sin(this.time * 40);
        this.G.gfx.fx.flash = Math.max(0, this.G.gfx.fx.flash - 0.03);
        if (p >= need) return true;
        if (this.time - t0 > 5.5) {
          end(false);
          this.waiters.delete(w);
        }
        return false;
      },
      res: () => end(true),
      rej: () => {
        removeEventListener('keydown', on);
        removeEventListener('pointerdown', on);
        this.hud.mash(null);
        this.grabbing = false;
      },
    };
    this.waiters.add(w);
  }

  // ---- death ---------------------------------------------------------------
  kill(by) {
    if (this.dead || this.won || this.G.dev.god) return;
    this.dead = true;
    this.deathBy = by;
    if (this.G.dev.bot) {
      const e = this.enemies[by.replace('fp_', '')];
      const P = this.player;
      console.log(`BOTDEATH ${by} stage=${this.stageIdx} t=${this.time.toFixed(0)} P=(${P.x.toFixed(1)},${P.z.toFixed(1)}) room=${P.room} light=${P.flash.on} bat=${P.flash.battery.toFixed(0)} mask=${P.mask.on} stam=${P.stamina.toFixed(1)} E=(${e?.x.toFixed(1)},${e?.z.toFixed(1)}) state=${e?.state} stunCd=${e?.stunCd?.toFixed(1)} bot=${window.__bot?.branch} hist=${(window.__bot?.hist || []).join(' ')}`);
    }
    this.cancelAll();
  }

  // ---- allies talk ------------------------------------------------------------
  _callout(e) {
    if (!this.allies.yahali.inOffice || this.busy) return;
    if (this.time < this.callCd) return;
    if (this.night > 3 && Math.random() > 0.85) return;
    let t = null;
    if (e.who === 'gefen') t = e.idx === 5 ? 'גפן קרוב! פנס!' : e.idx === 6 ? 'הוא בפתח!' : e.idx === 4 ? 'גפן באמצע המסדרון.' : null;
    if (e.who === 'ido') t = e.idx === 3 ? (e.side < 0 ? 'משהו נכנס לפיר השמאלי!' : 'משהו נכנס לפיר הימני!') : e.idx === 5 ? 'עידו בפתח! מסכה!' : null;
    if (e.who === 'dolev') t = e.idx === 4 ? 'דולב מתקרב. תמשוך אותו עם רעש.' : e.idx === 5 ? 'דולב בדלת! מתג הניתוק!' : null;
    if (!t) return;
    this.callCd = this.time + 2.5;
    setTimeout(() => !this.dead && this.quick('yahali', t), 500);
  }

  _onBroken(e) {
    const name = { cams: UI.sysCams, audio: UI.sysAudio, power: UI.sysPower }[e.key];
    this.hud.toast(`⚠ ${name}: ${UI.error}`, 4, 'warn');
  }

  // ---- dust in the flashlight beam -----------------------------------------
  _dust() {
    const n = [0, 160, 320][this.G.settings.quality] ?? 160;
    if (!n) return null;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 1] = Math.random() * 2.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 9;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { flPos: { value: new THREE.Vector3() }, flDir: { value: new THREE.Vector3(0, 0, -1) }, flCos: { value: 0.9 }, flPower: { value: 0 }, amb: { value: 0.05 }, t: { value: 0 }, origin: { value: new THREE.Vector3() } },
      vertexShader: `uniform vec3 flPos, flDir, origin; uniform float flCos, flPower, amb, t; varying float vA;
        void main(){ vec3 p = position; p.x += sin(t*0.21 + position.z*3.0)*0.25; p.y += sin(t*0.17 + position.x*2.0)*0.2;
          p.xz = mod(p.xz - origin.xz + 4.5, 9.0) - 4.5 + origin.xz; p.y += origin.y - 1.3;
          vec3 d = p - flPos; float dist = length(d); float cs = dot(d/dist, flDir);
          float spot = smoothstep(flCos, 1.0, cs) * flPower / (1.0 + dist*dist*0.08);
          vA = amb + spot; vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(26.0 / -mv.z, 1.0, 9.0); }`,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA; gl_FragColor = vec4(vec3(1.0,0.95,0.85) * a, a); }`,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    this.world.scene.add(pts);
    return pts;
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    const G = this.G;
    const P = this.player;
    const O = this.office;
    this.time += dt;
    if (this.clockRun && this.clock < TIME.hours) this.clock = Math.min(TIME.hours, this.clock + (dt / TIME.secondsPerHour) * (this.clockRate || 1));
    this.threat = 0;

    P.update(dt);
    O.update(dt);
    for (const id in this.enemies) this.enemies[id].update(dt);
    for (const id in this.allies) this.allies[id].update(dt);

    // interaction (walking)
    const use = P.use;
    if (P.mode === 'walk' && !this.busy) {
      let best = null;
      let bd = 1e9;
      for (const u of this.uses) {
        if (u.when && !u.when()) continue;
        const d = P.dist(u.x, u.z);
        if (d > (u.radius || PLAYER_CFG.reach) || d >= bd) continue;
        if (d > 0.8 && !P.sees(u.x, u.z, 1.15, 5)) continue;
        best = u;
        bd = d;
      }
      if (best !== use.target) {
        use.target = best;
        use.progress = 0;
      }
      if (best) {
        const inp = G.input;
        if (best.hold > 0) {
          if (inp.held('interact')) {
            use.progress += dt / best.hold;
            if (use.progress >= 1) {
              use.target = null;
              use.progress = 0;
              audio.click(0.4);
              best.done();
            }
          } else use.progress = Math.max(0, use.progress - dt * 1.5);
        } else if (inp.took('interact')) {
          use.target = null;
          best.done();
        }
      }
      if (G.input.took('throw')) this.throwBall();
    } else if (use.target) use.target = null;

    // waiters (after the simulation step)
    for (const w of [...this.waiters]) {
      let ok = false;
      try {
        ok = w.fn();
      } catch (e) {
        this.waiters.delete(w);
        w.rej(e);
        continue;
      }
      if (ok) {
        this.waiters.delete(w);
        w.res();
      }
    }

    // view selection
    const t = O.tablet;
    const fx = G.gfx.fx;
    let cam = P.cam;
    let preset = P.mode === 'seat' ? 'office' : 'fp';
    let room = P.room;
    let drawScene = true;
    let stat = 0;
    this.world.setIR(null);
    if (this.video) {
      preset = this.video.preset;
      drawScene = false;
    } else if (this.cine) {
      cam = this.cine.cam;
      room = this.cine.room || roomAt(cam.position.x, cam.position.z) || room;
      preset = this.cine.preset || 'cinema';
    } else if (t.open) {
      if (t.tab === 'cams') {
        const c = CAMS.find((x) => x.n === t.cam);
        if (O.camsUp && !O.camOffline.has(c.n)) {
          cam = this.cctv;
          cam.position.set(...c.pos);
          cam.lookAt(...c.look);
          if (cam.fov !== c.fov) {
            cam.fov = c.fov;
            cam.updateProjectionMatrix();
          }
          cam.rotation.z += Math.sin(this.time * 0.4) * 0.004;
          room = c.room;
          const vent = c.room.startsWith('vent');
          preset = vent ? 'cctvNV' : 'cctv';
          if (vent) this.world.setIR(c.room);
          stat = Math.max(t.switchT * 4, (O.camGlitch[c.room] || 0) * 1.6, O.interference * 0.5);
        } else {
          drawScene = false;
          preset = 'cctv';
          stat = 1;
        }
      } else {
        drawScene = false;
        preset = 'cctv';
        stat = 0.12;
      }
    }
    this.view = { cam, preset, drawScene };
    this.world.setView(room);
    this.world.setClock(Math.floor(this.clock * 12) / 12);
    this.world.update(dt, cam.position);
    const fl = cam === P.cam ? P.fl : null;
    for (const id in this.actors) this.actors[id].update(dt, cam, fl);
    if (this.dust) {
      const u = this.dust.material.uniforms;
      u.t.value = this.time;
      u.origin.value.copy(cam.position);
      u.flPos.value.copy(P.fl.pos);
      u.flDir.value.copy(P.fl.dir);
      u.flCos.value = P.fl.cos;
      u.flPower.value = fl && P.fl.on ? P.fl.power * 0.5 : 0;
      this.dust.visible = cam === P.cam;
    }

    // post fx
    const inter = O.interference;
    fx.staticAmt = Math.min(1, stat);
    fx.glitch = Math.max(0, Math.max(fx.glitch - dt * 2.5, inter * 0.35, this.video ? this.video.shake : 0));
    fx.mask = P.mask.amt;
    fx.shake = this.video ? this.video.shake * 0.02 : 0;
    this.threatShown += (this.threat - this.threatShown) * Math.min(1, dt * (this.threat > this.threatShown ? 4 : 1.2));
    fx.redPulse = this.redPulse ?? (this.threatShown > 0.5 ? (this.threatShown - 0.5) * 0.6 * (0.6 + 0.4 * Math.sin(this.time * 9)) : 0);
    audio.setTension?.(Math.max(this.threatShown, this.tensionBase || 0));
    // Ido is silent, but close by you can hear him whisper
    const ido = this.enemies.ido;
    if (ido.mode === 'fp' && !(ido.awayT > 0)) {
      const d = ido.playerDist();
      if (d < 9) {
        if (!audio.hasLoop('whisper')) audio.whisper?.();
        audio.setLoopGain('whisper', Math.max(0.0001, (1 - d / 9) * 0.5), 0.3);
      } else if (audio.hasLoop('whisper')) audio.setLoopGain('whisper', 0.0001, 0.3);
    } else if (audio.hasLoop('whisper')) audio.stopLoop('whisper', 0.4);
    if (inter > 0.3) audio.hum?.(0.12);
    else if (audio.hasLoop('hum')) audio.stopLoop('hum', 0.4);

    // random far away sounds
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 9 + Math.random() * 14;
      if (!this.video) audio.ambientEvent();
    }

    // objective marker
    this._marker(cam);
    this.hud.update(dt);
  }

  _marker(cam) {
    const el = this.markerEl;
    const m = this.marker;
    if (!m || this.player.mode !== 'walk' || this.busy || this.video) {
      el.hidden = true;
      return;
    }
    v3.set(m.x, m.y, m.z).project(cam);
    const behind = v3.z > 1;
    let x = v3.x;
    let y = v3.y;
    if (behind) {
      x = -x;
      y = -1;
    }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
    x = Math.max(-0.92, Math.min(0.92, x));
    y = Math.max(-0.8, Math.min(0.8, y));
    el.hidden = false;
    el.classList.toggle('off', off);
    el.style.transform = `translate(${((x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`;
    const d = Math.round(this.player.dist(m.x, m.z));
    if (el._d !== d) {
      el._d = d;
      el.lastChild.textContent = d + ' מ׳';
    }
  }

  render(time) {
    const v = this.view;
    if (!v) return;
    this.G.gfx.render(v.drawScene ? this.world.scene : null, v.cam, v.preset, time);
  }

  /** Called at the start of every stage (also on retry). */
  resetStage() {
    this.cancelAll();
    this.uses = [];
    this.world.batteries.forEach((b) => (b.mesh.visible = false));
    this.setMarker(null);
    this.dead = false;
    this.busy = false;
    this.cine = null;
    this.playerSafe = false;
    this.grabbing = false;
    this.grabCd = 0;
    this.powerOverride = false;
    this.redPulse = null;
    this.tensionBase = 0;
    this.hideHud = false;
    this.stopClip();
    for (const id in this.hud.actions) this.hud.action(id, null);
    this.hud.objective(null);
    this.hud.mash(null);
    this.hud.hideSubs();
    this.phone.hangup();
    const O = this.office;
    const en = O.enabled;
    const off = O.camOffline;
    // power and battery carry over inside a night; a retry gets the same values again
    if (this._snapStage !== this.stageIdx) {
      this._snapStage = this.stageIdx;
      this._snap = this.stageIdx === 0 || this._snap == null ? { power: 100, battery: 100 } : { power: Math.max(POWER.floor, O.power), battery: Math.max(45, this.player.flash.battery) };
    }
    O.reset();
    O.power = this._snap.power;
    O.enabled = en;
    O.camOffline = off;
    for (const id in this.enemies) {
      const e = this.enemies[id];
      e.off();
      e.hold = false;
      e.passive = false;
      e.noMercy = false;
    }
    for (const id in this.allies) {
      const a = this.allies[id];
      if (!a.inOffice) a.off();
      a.hurtCd = 0;
    }
    const P = this.player;
    P.flash.battery = this._snap.battery;
    P.flash.dead = false;
    P.flash.toggled = false;
    P.setMask(false);
    P.carrying = false;
    P.slow = 0;
    P.shake = 0;
    P.stamina = PLAYER_CFG.stamina;
    this.world.setPower('normal');
    this.world.flickerBoost = 0;
    const fx = this.G.gfx.fx;
    fx.fade = 0;
    fx.faceAmt = 0;
    fx.flash = 0;
    audio.stopLoop('heart', 0.2);
    audio.stopLoop('ring', 0.05);
    audio.stopLoop('generator', 0.3);
    audio.stopLoop('rumble', 0.3);
    audio.stopLoop('whisper', 0.2);
    voice.cancel();
  }

  titleCard() {
    this.hud.titleCard(this.night === 6 ? '' : `${UI.night} ${this.night}`, NIGHT_TITLES[this.night]);
    audio.braam(0.5);
  }

  destroy() {
    this.cancelAll();
    this.stopClip();
    this.hud.destroy();
    audio.stopAll(0.4);
    voice.cancel();
    this.world.scene.remove(this.player.spot, this.player.fill);
    this.world.dispose();
    if (window.__g2 === this) window.__g2 = null;
  }
}

export { SPOTS, POINTS, PLAYER, VENTS };
