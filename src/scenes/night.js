// ============================================================================
//  The night: survive 00:00 -> 06:00 in the office
// ============================================================================
import { TIME, POWER, AI, PATHS, CAMS, OFFICE_MAP, DEV, CHARACTERS } from '../config.js';
import { TUTORIAL, RADIO, SPEAKERS, UI as TXT } from '../story.js';
import { audio } from '../engine/audio.js';
import { voice } from '../engine/voice.js';
import { setRoomsNight } from '../world/rooms.js';
import { mount, h, wait, flash, isTouch, esc } from '../ui/dom.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const roll = () => 1 + Math.floor(Math.random() * 20);
const NIGHT_LEN = TIME.secondsPerHour * TIME.hours;

// ---------------------------------------------------------------- the two possessed guys
class Mover {
  constructor(N, key) {
    this.N = N;
    this.key = key; // cap | smiler
    this.charKey = 'char_' + key;
    this.path = PATHS[key];
    this.side = this.path.side;
    this.loc = this.path.start;
    this.timer = AI.tick[key] * rand(0.6, 1);
    this.state = 'roam';
    this.seen = false;
  }
  get level() {
    const n = this.N.night;
    return AI[this.key][n] > 0 ? AI[this.key][n] + this.N.hourBonus : 0;
  }
  update(dt) {
    if (this.state === 'inside') {
      this.insideT += dt;
      const N = this.N;
      if ((!N.camsOpen && this.insideT > this.attackDelay) || this.insideT > 11) N.die(this.key);
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = AI.tick[this.key];
    if (this.level <= 0 || roll() > this.level) return;
    this.move();
  }
  move() {
    const N = this.N;
    const from = this.loc;
    if (from === 'door') {
      if (N.office.state[this.side].closed) {
        this.loc = pick(this.path.retreat);
        audio.footsteps(this.side === 'left' ? -0.8 : 0.8, 4, 0.25, 0.45);
      } else {
        // gets in!
        this.state = 'inside';
        this.loc = 'inside';
        this.insideT = 0;
        this.attackDelay = rand(0.8, 2.2);
        N.office.state[this.side].disabled = true;
        N.office.state[this.side].light = false;
        audio.laugh(0.35, this.side === 'left' ? -0.6 : 0.6, 70);
      }
    } else {
      const next = pick(this.path.next[from]);
      this.loc = next;
      this.seen = false;
      if (next === 'door') audio.footsteps(this.side === 'left' ? -0.9 : 0.9, 3, 0.4, 0.4);
      else if (next.startsWith('corner')) audio.footsteps(this.side === 'left' ? -0.7 : 0.7, 3, 0.22, 0.45);
    }
    N.onMove(from, this.loc);
  }
}

// ---------------------------------------------------------------- Gefen
class Gefen {
  constructor(N) {
    this.N = N;
    this.stage = 0; // 0,1,2 at the table, 3 = running
    this.timer = AI.tick.gefen;
    this.lockout = 0;
    this.bangs = 0;
    this.side = 'left';
  }
  get level() {
    const n = this.N.night;
    return AI.gefen[n] > 0 ? AI.gefen[n] + this.N.hourBonus : 0;
  }
  update(dt) {
    const N = this.N;
    const watching = N.camsOpen && N.cam === 'main' && !N.out;
    if (this.stage === 3) {
      this.runT += dt;
      if (this.runT >= this.runDur) this.arrive();
      return;
    }
    if (watching) {
      this.lockout = Math.max(this.lockout, rand(1.5, 9) * (1 - N.night * 0.1));
      return;
    }
    if (this.lockout > 0) {
      this.lockout -= dt;
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = AI.tick.gefen;
    if (this.level <= 0 || roll() > this.level) return;
    const from = this.stage;
    this.stage++;
    if (this.stage === 3) this.startRun();
    else audio.laugh(0.18 + this.stage * 0.1, rand(-0.3, 0.3), 88);
    N.onMove('main', 'main', from);
  }
  startRun() {
    const N = this.N;
    this.side = N.night >= 3 ? pick(['left', 'right']) : 'left';
    this.runT = 0;
    this.runDur = AI.gefenRun[N.night] * rand(0.9, 1.15);
    audio.laugh(0.55, this.side === 'left' ? -0.5 : 0.5, 84);
    setTimeout(() => !N.ended && audio.running(this.side === 'left' ? -0.85 : 0.85, this.runDur * 0.9, 0.65), 400);
    N.onMove('main', this.side === 'left' ? 'hallL' : 'hallR');
  }
  arrive() {
    const N = this.N;
    if (N.office.state[this.side].closed) {
      this.bangs++;
      const cost = Math.min(12, (POWER.doorBangCost[N.night] || 1) * this.bangs);
      N.power = Math.max(0, N.power - cost);
      const pan = this.side === 'left' ? -0.9 : 0.9;
      audio.bang(pan, 1);
      setTimeout(() => audio.bang(pan, 0.8), 380);
      setTimeout(() => audio.bang(pan, 0.9), 820);
      N.shake = 0.03;
      setTimeout(() => !N.ended && audio.laugh(0.3, pan, 76), 1500);
      this.stage = Math.random() < 0.5 ? 0 : 1;
      this.lockout = rand(2, 5);
      N.onMove(this.side === 'left' ? 'hallL' : 'hallR', 'main');
    } else {
      N.die('gefen');
    }
  }
}

// ---------------------------------------------------------------- the night
export class NightScene {
  constructor(G, { night = 1, tutorial = false } = {}) {
    this.G = G;
    this.night = night;
    this.tutorial = tutorial || night === 1;
    this.office = G.office;
    this.rooms = G.rooms;
    this.time = 0;
    this.power = 100;
    this.camsOpen = false;
    this.cam = 'main';
    this.paused = false;
    this.ended = false;
    this.out = null;
    this.shake = 0;
    this.camStatic = 0;
    this.mx = 0.5;
    this.nextAmbient = rand(10, 25);
    this.hourBonus = 0;
  }

  // ---------------------------------------------------------------- setup
  enter() {
    const G = this.G;
    Object.values(G.chars).forEach((c) => c.remove());
    this.office.reset();
    this.office.setNight(this.night);
    setRoomsNight(this.rooms, this.night);
    this.gefen = new Gefen(this);
    this.movers = [new Mover(this, 'cap'), new Mover(this, 'smiler')];
    this.buildHud();
    this.bindInput();
    audio.fan();
    audio.drone(0.55 + this.night * 0.08);
    this.layoutChars();
    if (this.tutorial && this.night === 1) this.runTutorial();
    if (RADIO[this.night]) setTimeout(() => this.runRadio(RADIO[this.night]), 2500);
    this.G.gfx.fx.fade = 1;
    this.fadeIn = 1;
  }

  buildHud() {
    const hud = (this.hud = document.getElementById('hud'));
    hud.hidden = false;
    hud.className = '';
    const key = (k) => (isTouch() ? '' : `<span class="k">${k}</span>`);
    const camButtons = CAMS.map((c) => {
      const [x, y, w, hh] = c.map;
      return `<div class="room" style="left:${x}%;top:${(y / 80) * 100}%;width:${w}%;height:${(hh / 80) * 100}%"></div>
              <button data-cam="${c.id}" style="left:${x + w / 2}%;top:${((y + hh / 2) / 80) * 100}%">${c.label}</button>`;
    }).join('');
    const [ox, oy, ow, oh] = OFFICE_MAP;
    hud.innerHTML = `
      <div class="clock"><span class="time">00:00</span><span class="night">${TXT.nightN(this.night)}</span></div>
      <div class="power">${TXT.power}: <b>100%</b><div class="usage"><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="side left">
        <button class="door" data-side="left">${TXT.doorL}${key('Q')}</button>
        <button class="light" data-side="left">${TXT.light}${key('A')}</button>
      </div>
      <div class="side right">
        <button class="door" data-side="right">${TXT.doorR}${key('E')}</button>
        <button class="light" data-side="right">${TXT.light}${key('D')}</button>
      </div>
      <div class="camui">
        <div class="rec">REC</div>
        <div class="camname"></div>
        <div class="offline">${TXT.camOffline}</div>
        <div class="map">${camButtons}<div class="office" style="left:${ox}%;top:${(oy / 80) * 100}%;width:${ow}%;height:${(oh / 80) * 100}%">אתה</div></div>
      </div>
      <button class="camtoggle">▲ ${TXT.cams} ▲${isTouch() ? '' : ' <span style="opacity:.6;font-size:.8em">(רווח)</span>'}</button>
      <button class="icon-btn pause-btn" aria-label="pause">II</button>
      <div class="toast"></div>
      <div class="radio"><img alt=""><div><div class="who"></div><div class="txt"></div></div><button class="mute">השתק ✕</button></div>
      ${DEV.enabled ? '<div class="dev"></div>' : ''}
    `;
    const q = (s) => hud.querySelector(s);
    this.$time = q('.clock .time');
    this.$power = q('.power');
    this.$powerVal = q('.power b');
    this.$usage = [...hud.querySelectorAll('.usage i')];
    this.$camname = q('.camname');
    this.$offline = q('.offline');
    this.$toast = q('.toast');
    this.$radio = q('.radio');
    this.$dev = q('.dev');
    this.$btn = {
      left: { door: q('.side.left .door'), light: q('.side.left .light') },
      right: { door: q('.side.right .door'), light: q('.side.right .light') },
    };
    hud.querySelectorAll('.side button').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const side = b.dataset.side;
        if (b.classList.contains('door')) this.toggleDoor(side);
        else this.toggleLight(side);
      }),
    );
    q('.camtoggle').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.toggleCams();
    });
    hud.querySelectorAll('.map button').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.selectCam(b.dataset.cam);
      }),
    );
    q('.pause-btn').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.pause(true);
    });
    q('.radio .mute').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.radioMuted = true;
      voice.cancel();
      this.$radio.classList.remove('on');
    });
    this.selectCam(this.cam, true);
  }

  bindInput() {
    const touch = isTouch();
    this._move = (e) => {
      if (e.pointerType === 'mouse') this.mx = e.clientX / innerWidth;
      if (this.drag && e.pointerType !== 'mouse') {
        const dx = e.clientX - this.drag.x;
        this.drag.x = e.clientX;
        this.drag.moved += Math.abs(dx);
        const o = this.office;
        o.targetYaw = Math.max(-o.maxYaw, Math.min(o.maxYaw, o.targetYaw + (dx / innerWidth) * 2.8));
      }
    };
    this._down = (e) => {
      if (e.target.closest && e.target.closest('button, .dialog, .pause-menu')) return;
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, mouse: e.pointerType === 'mouse' };
    };
    this._up = (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved > 12 || this.camsOpen || this.paused || this.ended) return;
      // click on the 3D buttons next to the doors
      const hit = this.office.pick((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (hit) hit.action === 'door' ? this.toggleDoor(hit.side) : this.toggleLight(hit.side);
    };
    this._key = (e) => {
      if (this.ended) return;
      if (e.code === 'Escape' || e.code === 'KeyP') return this.pause(!this.paused);
      if (this.paused || e.repeat) return;
      const c = e.code;
      if (c === 'KeyQ') this.toggleDoor('left');
      else if (c === 'KeyE') this.toggleDoor('right');
      else if (c === 'KeyA') this.toggleLight('left');
      else if (c === 'KeyD') this.toggleLight('right');
      else if (c === 'Space' || c === 'KeyS' || c === 'Tab') {
        e.preventDefault();
        this.toggleCams();
      } else if (/^Digit[1-9]$/.test(c) || /^Numpad[1-9]$/.test(c)) {
        const idx = parseInt(c.slice(-1)) - 1;
        if (CAMS[idx]) {
          if (!this.camsOpen) this.toggleCams();
          this.selectCam(CAMS[idx].id);
        }
      } else if (c === 'ArrowLeft') this.office.targetYaw = this.office.maxYaw;
      else if (c === 'ArrowRight') this.office.targetYaw = -this.office.maxYaw;
      else if (c === 'ArrowDown' || c === 'ArrowUp') this.office.targetYaw = 0;
    };
    this.keyLook = !touch;
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerdown', this._down);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('keydown', this._key);
  }

  // ---------------------------------------------------------------- actions
  canUse(side) {
    return !this.out && !this.ended && !this.paused && !this.office.state[side].disabled;
  }
  toggleDoor(side) {
    if (!this.canUse(side)) return audio.click(0.15);
    const st = this.office.state[side];
    st.closed = !st.closed;
    if (st.closed) audio.doorSlam(side === 'left' ? -0.8 : 0.8);
    else audio.doorOpen(side === 'left' ? -0.8 : 0.8);
  }
  toggleLight(side) {
    if (!this.canUse(side)) return audio.click(0.15);
    const st = this.office.state[side];
    const other = this.office.state[side === 'left' ? 'right' : 'left'];
    st.light = !st.light;
    if (st.light) other.light = false;
    audio.stopLoop('light-left', 0.05);
    audio.stopLoop('light-right', 0.05);
    if (st.light) {
      audio.lightBuzz(side);
      audio.click(0.2);
      this.office.targetYaw = side === 'left' ? Math.max(this.office.targetYaw, 0.75) : Math.min(this.office.targetYaw, -0.75);
    }
  }
  toggleCams() {
    if (this.out || this.ended || this.paused) return;
    this.camsOpen = !this.camsOpen;
    this.hud.classList.toggle('cams-open', this.camsOpen);
    if (this.camsOpen) {
      audio.camOpen();
      audio.camStatic();
      this.camStatic = 1;
      for (const s of ['left', 'right']) this.office.state[s].light = false;
      audio.stopLoop('light-left', 0.05);
      audio.stopLoop('light-right', 0.05);
    } else {
      audio.camClose();
      audio.stopLoop('camstatic', 0.1);
    }
  }
  selectCam(id, silent = false) {
    this.cam = id;
    const c = CAMS.find((x) => x.id === id);
    this.$camname.innerHTML = `${esc(c.name)} <span class="id">CAM ${c.label}</span>`;
    this.hud.querySelectorAll('.map button').forEach((b) => b.classList.toggle('sel', b.dataset.cam === id));
    if (!silent) {
      this.camStatic = 0.9;
      audio.camSwitch();
    }
    this.layoutChars();
  }

  // something moved: glitch the camera if it involves the room on screen
  onMove(from, to) {
    if (this.camsOpen && (from === this.cam || to === this.cam)) {
      this.camStatic = 1;
      this.camOfflineT = 0.35 + Math.random() * 0.4;
      audio.staticBurst(0.4, 0.15);
    }
    this.layoutChars();
  }

  /** put every character model where its AI says it is */
  layoutChars() {
    const { chars } = this.G;
    const R = this.rooms;
    const g = this.gefen;
    if (!g) return;
    if (this.out) return;
    if (g.stage < 3) chars.gefen.place(R.main, R.main.spots['gefen' + g.stage]);
    else {
      const hall = R[g.side === 'left' ? 'hallL' : 'hallR'];
      chars.gefen.place(hall, { ...hall.spots.run });
    }
    for (const m of this.movers) {
      const ch = chars[m.key];
      if (m.loc === 'door') ch.place(this.office, this.office.doorSpot(m.side, ch.key, false));
      else if (m.loc === 'inside') ch.remove();
      else {
        const room = R[m.loc];
        const spot = room.spots[m.key];
        if (spot) ch.place(room, spot);
        else ch.remove();
      }
    }
  }

  // ---------------------------------------------------------------- tutorial / radio
  async runTutorial() {
    const tips = isTouch() ? TUTORIAL.touch : TUTORIAL.desktop;
    await wait(1800);
    for (const tip of tips) {
      if (this.ended) return;
      this.toast(tip, 6200);
      await wait(6800);
    }
    if (!isTouch() && !this.ended) this.toast(TUTORIAL.keys, 7000);
  }
  toast(text, ms) {
    this.$toast.textContent = text;
    this.$toast.classList.add('on');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.$toast.classList.remove('on'), ms);
  }
  async runRadio(lines) {
    if (this.ended) return;
    audio.radioBeep();
    const A = this.G.A;
    this.office.radioLed.material.color.setHex(0x33ff66);
    await wait(700);
    for (const line of lines) {
      if (this.ended || this.radioMuted) break;
      const sp = SPEAKERS[line.who];
      this.$radio.querySelector('img').src = (line.who === 'maayan' ? A.img.maayan : A.img.yahali).src;
      this.$radio.querySelector('.who').textContent = `📻 ${sp.name}`;
      this.$radio.querySelector('.txt').textContent = line.text;
      this.$radio.classList.add('on');
      const spoken = voice.available ? voice.speak(line, sp.voice, 0.9) : wait(2200 + line.text.length * 55);
      if (line.fx === 'static') {
        await wait(2600);
        audio.staticBurst(1.4, 0.3);
        audio.laugh(0.5, 0, 80);
        voice.cancel();
        break;
      }
      await Promise.race([spoken, wait(15000)]);
      await wait(700);
    }
    this.$radio.classList.remove('on');
    audio.radioBeep();
    this.office.radioLed.material.color.setHex(0x113311);
  }

  // ---------------------------------------------------------------- pause
  pause(on) {
    if (this.ended) return;
    if (on === this.paused) return;
    this.paused = on;
    if (on) {
      voice.cancel();
      audio.duck(0.15);
      this.pauseEl = mount(
        `<div class="pause-menu"><h2>${TXT.paused}</h2>
          <button class="btn resume">${TXT.resume}</button>
          <button class="btn ghost restart">${TXT.restartNight}</button>
          <button class="btn ghost menu">${TXT.mainMenu}</button></div>`,
        document.getElementById('ui'),
      );
      this.pauseEl.querySelector('.resume').addEventListener('click', () => this.pause(false));
      this.pauseEl.querySelector('.restart').addEventListener('click', () => this.G.director.go('night', { night: this.night }));
      this.pauseEl.querySelector('.menu').addEventListener('click', () => this.G.director.go('menu'));
    } else {
      audio.unduck();
      this.pauseEl?.remove();
    }
  }

  // ---------------------------------------------------------------- power
  get usage() {
    const s = this.office.state;
    return 1 + (s.left.closed ? 1 : 0) + (s.right.closed ? 1 : 0) + (s.left.light || s.right.light ? 1 : 0) + (this.camsOpen ? 1 : 0);
  }
  powerOut() {
    this.out = { phase: 0, t: 0, d0: rand(3, 9), d1: rand(7, 15), d2: rand(1.5, 4) };
    if (this.camsOpen) this.toggleCams();
    this.office.setPower(false);
    audio.stopLoop('fan', 0.3);
    audio.stopLoop('light-left', 0.05);
    audio.stopLoop('light-right', 0.05);
    audio.stopLoop('camstatic', 0.05);
    audio.powerDown();
    this.hud.querySelectorAll('.side button, .camtoggle').forEach((b) => b.classList.add('dead'));
    Object.values(this.G.chars).forEach((c) => c.remove());
    this.toast(TXT.powerOut, 3000);
  }
  updateOutage(dt, t) {
    const o = this.out;
    o.t += dt;
    const gef = this.G.chars.gefen;
    if (o.phase === 0 && o.t > o.d0) {
      o.phase = 1;
      o.t = 0;
      gef.place(this.office, this.office.outageSpot());
      audio.musicBox(0.55);
      audio.footsteps(-0.8, 3, 0.3, 0.5);
    } else if (o.phase === 1) {
      const on = Math.sin(t * 7.3) * Math.sin(t * 3.1) > 0.1;
      gef.uniforms.light.value = on ? 0.32 : 0.0;
      gef.uniforms.eyeGlow.value = on ? 7 : 2.5;
      gef.faceCamera(this.office.camera);
      if (o.t > o.d1) {
        o.phase = 2;
        o.t = 0;
        gef.remove();
        audio.stopLoop('musicbox', 0.1);
      }
    } else if (o.phase === 2 && o.t > o.d2) {
      this.die('gefen');
    }
  }

  // ---------------------------------------------------------------- end states
  die(who) {
    if (this.ended || DEV.god) return;
    this.ended = true;
    this.hud.hidden = true;
    voice.cancel();
    audio.stopAll(0.05);
    if (this.camsOpen) this.camsOpen = false;
    this.G.jumpscare(who, () => this.G.director.go('gameover', { night: this.night, who }));
  }
  win() {
    if (this.ended) return;
    this.ended = true;
    voice.cancel();
    audio.stopAll(0.4);
    this.G.director.go('sixam', { night: this.night });
  }

  // ---------------------------------------------------------------- frame
  update(dt, t) {
    const fx = this.G.gfx.fx;
    if (this.fadeIn > 0) {
      this.fadeIn = Math.max(0, this.fadeIn - dt * 0.8);
      fx.fade = this.fadeIn;
    }
    if (this.paused || this.ended) return;
    const gdt = dt * DEV.speed;
    this.time += gdt;
    if (this.time >= NIGHT_LEN) return this.win();
    const hour = Math.floor(this.time / TIME.secondsPerHour);
    this.hourBonus = Object.entries(AI.hourBonus).reduce((a, [hh, b]) => a + (hour >= +hh ? b : 0), 0);

    // power
    if (!this.out) {
      this.power -= gdt * (POWER.base * this.usage + (POWER.passive[this.night] || 0));
      if (this.power <= 0) {
        this.power = 0;
        this.powerOut();
      }
    }
    // AI
    if (!this.out) {
      this.gefen.update(gdt);
      this.movers.forEach((m) => m.update(gdt));
    } else this.updateOutage(gdt, t);
    if (this.ended) return;

    // office view
    const o = this.office;
    if (!this.camsOpen && !this.drag?.moved && this.keyLook) {
      const nx = this.mx * 2 - 1;
      const k = Math.sign(nx) * Math.max(0, Math.min(1, (Math.abs(nx) - 0.12) / 0.8));
      o.targetYaw = -k * o.maxYaw;
    }
    const flick = 0.15 + hour * 0.05 + (this.gefen.stage === 2 ? 0.3 : 0);
    o.update(t, dt, { flicker: flick, shake: this.shake });
    o.setClock(this.time / TIME.secondsPerHour);
    this.shake = Math.max(0, this.shake - dt * 0.05);
    // movers at the doors are only visible with the light on
    for (const m of this.movers) {
      if (m.loc !== 'door') continue;
      const ch = this.G.chars[m.key];
      const lit = o.state[m.side].light && !this.out;
      ch.uniforms.light.value = lit ? 0.95 : 0.0;
      ch.uniforms.eyeGlow.value = lit ? 3 : 0.0;
      ch.faceCamera(o.camera);
      if (lit && !m.seen) {
        m.seen = true;
        audio.sting(0.5);
      }
    }
    // the cameras
    if (this.camsOpen) {
      const room = this.rooms[this.cam];
      room.flicker = room.baseFlicker ?? (room.baseFlicker = room.flicker);
      room.update(t, dt, true);
      const g = this.gefen;
      if (g.stage === 3 && (this.cam === 'hallL' || this.cam === 'hallR')) {
        const k = Math.min(1, g.runT / g.runDur);
        const ch = this.G.chars.gefen;
        if (ch.room === room) {
          ch.group.position.z = -6 + k * 10.5;
          ch.uniforms.blur.value = 0.004;
        }
      }
      Object.values(this.G.chars).forEach((c) => c.room === room && c.faceCamera(room.camera));
      this.camStatic = Math.max(0.12, this.camStatic - dt * 2.5);
      if (this.camOfflineT > 0) this.camOfflineT -= dt;
      this.$offline.classList.toggle('on', this.camOfflineT > 0);
    }
    fx.staticAmt = this.camsOpen ? (this.camOfflineT > 0 ? 1 : this.camStatic * 0.55) : 0;
    fx.glitch = this.camsOpen && this.camStatic > 0.5 ? 0.3 : 0;
    fx.redPulse = this.power < 10 && !this.out ? 0.15 + Math.sin(t * 4) * 0.1 : 0;

    // ambience
    this.nextAmbient -= gdt;
    if (this.nextAmbient < 0) {
      this.nextAmbient = rand(14, 32);
      audio.ambientEvent();
    }
    this.updateHud();
  }

  updateHud() {
    const mins = Math.floor(this.time / (TIME.secondsPerHour / 60));
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const txt = `0${hh}:${mm < 10 ? '0' : ''}${mm}`;
    if (this.$time.textContent !== txt) this.$time.textContent = txt;
    const p = Math.ceil(this.power);
    this.$powerVal.textContent = p + '%';
    this.$power.classList.toggle('low', p <= 15);
    const u = this.out ? 0 : this.usage;
    this.$usage.forEach((el, i) => {
      el.className = i < u ? 'on ' + (u >= 4 ? 'r' : u >= 3 ? 'y' : 'g') : '';
    });
    for (const side of ['left', 'right']) {
      const st = this.office.state[side];
      const b = this.$btn[side];
      b.door.classList.toggle('on', st.closed);
      b.light.classList.toggle('on', st.light);
      b.door.classList.toggle('dead', !!st.disabled || !!this.out);
      b.light.classList.toggle('dead', !!st.disabled || !!this.out);
    }
    if (this.$dev) {
      const g = this.gefen;
      this.$dev.textContent =
        `t=${this.time.toFixed(0)} power=${this.power.toFixed(1)} usage=${this.usage}\n` +
        `gefen stage=${g.stage} lock=${g.lockout.toFixed(1)} lvl=${g.level}\n` +
        this.movers.map((m) => `${m.key}: ${m.loc} (${m.state}) lvl=${m.level}`).join('\n');
    }
  }

  render(t) {
    const gfx = this.G.gfx;
    if (this.camsOpen && !this.out && !this.ended) {
      const room = this.rooms[this.cam];
      gfx.render(room.scene, room.camera, 'cctv', t);
    } else gfx.render(this.office.scene, this.office.camera, 'office', t);
  }

  exit() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('keydown', this._key);
    clearTimeout(this.toastT);
    this.ended = true;
    voice.cancel();
    this.hud.hidden = true;
    this.hud.innerHTML = '';
    this.pauseEl?.remove();
    audio.unduck();
    audio.stopAll(0.3);
    const fx = this.G.gfx.fx;
    fx.staticAmt = fx.glitch = fx.redPulse = 0;
    fx.fade = 0;
  }
}
