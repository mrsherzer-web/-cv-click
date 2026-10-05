// ============================================================================
//  Splash -> Gefen's intro (menu) -> video -> demon -> the red-bottle duo
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { INTRO_TALK, DEMON_LINE, DUO_SCENE, SPEAKERS, UI as TXT } from '../story.js';
import { audio } from '../engine/audio.js';
import { voice } from '../engine/voice.js';
import { Dialogue, speakLine } from '../ui/dialogue.js';
import { h, mount, wait, flash, fade, UI, esc } from '../ui/dom.js';
import { save } from '../game/save.js';

// ---------------------------------------------------------------- splash
export class SplashScene {
  constructor(G) {
    this.G = G;
  }
  enter() {
    this.el = mount(`
      <div class="screen splash">
        <div class="ball"><span>8</span></div>
        <h1>${TXT.gameTitle}</h1>
        <div class="sub">🎧 ${TXT.headphones}<br>${TXT.warning}</div>
        <div class="enter">${TXT.enter}</div>
      </div>`);
    this.el.addEventListener('pointerdown', () => this.go(), { once: true });
    this._key = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') this.go();
    };
    window.addEventListener('keydown', this._key);
  }
  go() {
    if (this.went) return;
    this.went = true;
    window.removeEventListener('keydown', this._key);
    audio.unlock();
    voice.unlock();
    audio.setVolume(save.data.settings.volume);
    voice.enabled = save.data.settings.voice;
    // prime the video element inside the gesture (iOS)
    const v = document.getElementById('video');
    v.muted = true;
    v.play()
      .then(() => {
        v.pause();
        v.currentTime = 0;
        v.muted = false;
      })
      .catch(() => (v.muted = false));
    this.G.director.go('menu');
  }
  exit() {
    window.removeEventListener('keydown', this._key);
  }
}

// ---------------------------------------------------------------- menu: Gefen talks to us
export class MenuScene {
  constructor(G) {
    this.G = G;
  }
  async enter() {
    const A = this.G.A;
    const night = save.data.night;
    const canContinue = save.data.introSeen && (night > 1 || save.data.beaten);
    this.el = mount(`
      <div class="screen menu">
        <div class="bg" style="background-image:url(${A.img.gefenNormalBlur.src})"></div>
        <div class="photo" style="background-image:url(${A.img.gefenNormal.src})"></div>
        <div class="vignette"></div>
        <div class="bubble" hidden><span class="who">${SPEAKERS.gefen.name}</span><span class="t"></span></div>
        <div class="left">
          <div class="title">${TXT.gameTitle}</div>
          <div class="tag">משחק אימה · 5 לילות · 00:00 עד 06:00</div>
          <button class="btn start" hidden>◀ ${TXT.start}</button>
          <div class="row">
            <button class="btn small ghost continue" hidden>${TXT.continue} — ${TXT.nightN(night)}</button>
          </div>
        </div>
        <button class="icon-btn settings-btn" aria-label="${TXT.settings}">⚙</button>
      </div>`);
    this.bubble = this.el.querySelector('.bubble');
    this.btnStart = this.el.querySelector('.start');
    this.btnCont = this.el.querySelector('.continue');
    this.btnStart.addEventListener('click', () => this.start());
    this.btnCont.addEventListener('click', () => this.cont());
    this.el.querySelector('.settings-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSettings();
    });
    this.el.addEventListener('pointerdown', () => this._skipLine && this._skipLine());
    this.canContinue = canContinue;
    audio.menuMusic();
    audio.stopLoop('drone', 0.5);
    await wait(900);
    if (this.left) return;
    await this.talk();
    if (this.left) return;
    this.showButtons();
  }

  async talk() {
    const t = this.bubble.querySelector('.t');
    for (const line of INTRO_TALK) {
      if (this.left) return;
      this.bubble.hidden = false;
      this.bubble.style.animation = 'none';
      void this.bubble.offsetWidth;
      this.bubble.style.animation = '';
      t.textContent = '';
      const chars = [...line.text];
      let i = 0;
      let skip = false;
      this._skipLine = () => (skip = true);
      const speaking = voice.available ? speakLine(line) : null;
      while (i < chars.length && !skip && !this.left) {
        i++;
        t.textContent = chars.slice(0, i).join('');
        if (!speaking && i % 2 === 0) audio.blip(1.1, 0.035);
        await wait(32);
      }
      t.textContent = line.text;
      const until = Date.now() + 900 + chars.length * 45;
      skip = false;
      if (speaking) await Promise.race([speaking, new Promise((r) => (this._skipLine = r))]);
      while (Date.now() < until && !skip && !this.left && !speaking) await wait(50);
      if (speaking) await wait(250);
    }
    this._skipLine = null;
  }

  showButtons() {
    this.btnStart.hidden = false;
    this.btnStart.classList.add('appear');
    if (this.canContinue) {
      this.btnCont.hidden = false;
      this.btnCont.classList.add('appear');
    }
    this.btnStart.focus({ preventScroll: true });
  }

  toggleSettings() {
    if (this.settingsEl) {
      this.settingsEl.remove();
      this.settingsEl = null;
      return;
    }
    const s = save.data.settings;
    this.settingsEl = mount(
      `<div class="settings">
        <label>${TXT.volume} <input type="range" min="0" max="1" step="0.05" value="${s.volume}"></label>
        <label>${TXT.voiceOn} <input type="checkbox" class="v" ${s.voice ? 'checked' : ''}></label>
        <label>${TXT.flashing} <input type="checkbox" class="f" ${s.flashing ? 'checked' : ''}></label>
        <div class="note">${voice.he ? 'נמצא קול עברי במכשיר: ' + esc(voice.he.name) : 'לא נמצא קול עברי במכשיר — הטקסט יוצג בכתוביות.'}</div>
      </div>`,
      this.el,
    );
    this.settingsEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.settingsEl.querySelector('input[type=range]').addEventListener('input', (e) => {
      s.volume = parseFloat(e.target.value);
      audio.setVolume(s.volume);
      save.write();
    });
    this.settingsEl.querySelector('.v').addEventListener('change', (e) => {
      s.voice = voice.enabled = e.target.checked;
      if (!s.voice) voice.cancel();
      save.write();
    });
    this.settingsEl.querySelector('.f').addEventListener('change', (e) => {
      s.flashing = e.target.checked;
      window.__settings = s;
      save.write();
    });
  }

  start() {
    if (this.left) return;
    this.left = true;
    voice.cancel();
    save.data.introSeen = true;
    save.write();
    audio.tapeStop(1.4);
    this.el.querySelector('.title').style.cssText = 'color:#e0102a;text-shadow:0 0 40px #f00';
    this.btnStart.disabled = true;
    setTimeout(() => this.G.director.go('video'), 1100);
  }

  cont() {
    if (this.left) return;
    this.left = true;
    voice.cancel();
    audio.tapeStop(1.0);
    setTimeout(() => this.G.startNight(save.data.night), 900);
  }

  exit() {
    this.left = true;
    voice.cancel();
    audio.stopLoop('menu', 0.6);
  }
}

// ---------------------------------------------------------------- the possession video
export class VideoScene {
  constructor(G) {
    this.G = G;
  }
  async enter() {
    const v = (this.v = document.getElementById('video'));
    v.currentTime = 0;
    v.muted = false;
    v.volume = Math.min(1, save.data.settings.volume * 1.1);
    v.classList.add('on');
    this.el = mount(`<div class="screen"><button class="btn small ghost skip" hidden>${TXT.skip} ⏭</button></div>`);
    const skip = this.el.querySelector('.skip');
    skip.addEventListener('click', () => this.done());
    setTimeout(() => (skip.hidden = false), 1500);
    v.onended = () => this.done();
    this.timers = [
      setTimeout(() => audio.glitch(0.5, 0.18), 4400),
      setTimeout(() => audio.riser(4.8, 0.25), 5000),
    ];
    try {
      await v.play();
    } catch (e) {
      // autoplay blocked: show a play button
      const b = h(`<button class="btn" style="position:absolute;inset:0;margin:auto;width:max-content;height:max-content">▶</button>`);
      this.el.appendChild(b);
      b.addEventListener('click', () => {
        b.remove();
        v.play().catch(() => this.done());
      });
    }
  }
  done() {
    if (this.finished) return;
    this.finished = true;
    this.G.director.go('demon');
  }
  exit() {
    this.timers.forEach(clearTimeout);
    this.v.onended = null;
    this.v.pause();
    this.v.classList.remove('on');
  }
}

// ---------------------------------------------------------------- "you have nowhere to run"
export class DemonScene {
  constructor(G) {
    this.G = G;
  }
  async enter() {
    const A = this.G.A;
    this.el = mount(`
      <div class="screen demon">
        <div class="bg" style="background-image:url(${A.img.gefenScaryBlur.src})"></div>
        <div class="photo" style="background-image:url(${A.img.gefenScary.src})"></div>
        <div class="photo slice" style="background-image:url(${A.img.gefenScary.src});mix-blend-mode:screen;opacity:0"></div>
        <div class="line"></div>
      </div>`);
    const slice = this.el.querySelector('.slice');
    this.tear = setInterval(() => {
      if (Math.random() < 0.45) {
        const y = Math.random() * 90;
        slice.style.opacity = '0.9';
        slice.style.clipPath = `inset(${y}% 0 ${Math.max(0, 100 - y - Math.random() * 12)}% 0)`;
        slice.style.translate = `${(Math.random() - 0.5) * 40}px 0`;
        slice.style.filter = `hue-rotate(${Math.random() * 360}deg) saturate(3)`;
      } else slice.style.opacity = '0';
    }, 90);
    flash('#ff0000', 500, 0.9);
    audio.braam(1);
    audio.drone(1.3);
    setTimeout(() => audio.laugh(0.9, 0, 78), 600);
    await wait(1200);
    const lineEl = this.el.querySelector('.line');
    lineEl.textContent = DEMON_LINE.text;
    const spoken = speakLine(DEMON_LINE);
    audio.glitch(0.6, 0.2);
    await Promise.race([Promise.all([spoken, wait(3200)]), wait(9000)]);
    await wait(900);
    await fade(true, 700);
    this.G.director.go('duo');
  }
  exit() {
    clearInterval(this.tear);
    fade(false, 600);
  }
}

// ---------------------------------------------------------------- meeting the red-bottle duo
export class DuoScene {
  constructor(G) {
    this.G = G;
    this.room = G.rooms.main;
    this.cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 60);
    this.cam.position.set(3.6, 1.62, 4.1);
    this.cam.lookAt(-0.6, 1.25, -2.6);
    this.baseRot = this.cam.rotation.clone();
    this.shake = 0;
    this.dim = 1;
    this.red = 0;
  }
  async enter() {
    const G = this.G;
    const A = G.A;
    Object.values(G.chars).forEach((c) => c.remove());
    this.room.setNight(1);
    this.el = mount(`
      <div class="screen vn">
        <div class="portraits"><img class="portrait pos-center idle speaking" src="${A.img.duo.src}" alt=""></div>
      </div>`);
    this.portrait = this.el.querySelector('.portrait');
    this.portrait.style.translate = '-62% 0';
    audio.drone(0.8);
    fade(false, 900);
    await wait(600);
    const dlg = new Dialogue(this.el);
    await dlg.play(DUO_SCENE, { onFx: (fx) => this.fx(fx) });
    // make sure they end possessed even if skipped
    this.portrait.src = A.img.duoPossessed.src;
    await wait(300);
    this.G.director.go('escape');
  }
  async fx(fx) {
    const G = this.G;
    if (fx === 'flicker') {
      audio.glitch(0.3, 0.12);
      this.dim = 0.15;
      setTimeout(() => (this.dim = 1), 250);
      setTimeout(() => (this.dim = 0.2), 500);
      setTimeout(() => (this.dim = 1), 700);
    } else if (fx === 'laugh') {
      this.dim = 0.45;
      G.chars.gefen.place(this.room, this.room.spots.gefen0);
      audio.laugh(0.85, -0.3, 82);
      await wait(1200);
    } else if (fx === 'possess') {
      audio.scream(0.5);
      flash('#ff0000', 400, 0.8);
      this.shake = 0.04;
      G.gfx.fx.glitch = 0.9;
      this.dim = 0.08;
      this.portrait.classList.remove('idle');
      this.portrait.classList.add('possess');
      await wait(250);
      this.portrait.src = G.A.img.duoPossessed.src;
      G.chars.gefen.remove();
      await wait(900);
      audio.braam(0.9);
      G.gfx.fx.glitch = 0.15;
      this.shake = 0.01;
      this.dim = 0.35;
      this.red = 0.5;
      this.portrait.classList.remove('possess');
      this.portrait.classList.add('idle');
    } else if (fx === 'red') {
      this.red = 0.8;
      audio.laugh(0.7, 0.2, 70);
    }
  }
  update(dt, t) {
    this.room.dim = this.dim;
    this.room.update(t, dt, true);
    this.room.camera.rotation.y = this.room.yaw; // not used, keep stable
    const c = this.cam;
    c.rotation.copy(this.baseRot);
    c.rotation.y += Math.sin(t * 0.3) * 0.01;
    if (this.shake) {
      c.rotation.x += (Math.random() - 0.5) * this.shake;
      c.rotation.y += (Math.random() - 0.5) * this.shake;
    }
    if (this.G.chars.gefen.room === this.room) this.G.chars.gefen.faceCamera(c);
    const fx = this.G.gfx.fx;
    fx.redPulse = this.red * (0.6 + 0.4 * Math.sin(t * 3));
    fx.glitch = Math.max(0, fx.glitch - dt * 0.4);
  }
  render(t) {
    this.G.gfx.render(this.room.scene, this.cam, 'cinema', t);
  }
  exit() {
    this.room.dim = 1;
    const fx = this.G.gfx.fx;
    fx.redPulse = 0;
    fx.glitch = 0;
    this.G.chars.gefen.remove();
  }
}
