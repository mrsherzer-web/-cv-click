// ============================================================================
//  Night scene: runs the stages of a night script on a Session, handles
//  death (jump scare + retry from the stage), 6 AM and saving.
// ============================================================================
import { Session, CANCEL } from './session.js';
import { NIGHT_SCRIPTS } from './nights/index.js';
import { UI, CAUGHT_TIPS } from '../story.js';
import { NIGHTS, NIGHT_TITLES } from '../config.js';
import { audio } from '../engine/audio2.js';
import { h, wait, esc } from '../ui/dom.js';

export class NightScene {
  constructor(G, { night = 1, stage = 0 } = {}) {
    this.G = G;
    this.night = night;
    this.S = new Session(G, { night });
    this.S.scene = this;
    this.stage = stage;
    this.paused = false;
    this.overlay = null;
    this.over = false;
    G.gfx.fx.fade = 1;
    if (G.dev.bot) import('../dev/bot.js').then((m) => (this.bot = new m.Bot(this.S)));
    this.run();
  }

  async run() {
    const S = this.S;
    const script = NIGHT_SCRIPTS[this.night];
    const stages = script.stages;
    let i = Math.min(this.stage, stages.length - 1);
    let fresh = false;
    while (i < stages.length && !this.over) {
      this.stage = i;
      S.stageIdx = i;
      S.stageRetry = !fresh; // true when this stage does not continue straight from the previous one
      fresh = false;
      S.resetStage();
      script.base?.(S, i);
      this.G.save.checkpoint(this.night, i);
      try {
        await stages[i].run(S);
      } catch (e) {
        if (e !== CANCEL) {
          console.error(e);
          throw e;
        }
        if (this.over) return;
        if (S.dead) {
          const retry = await this.death();
          if (this.over) return;
          if (!retry) return this.G.director.go('menu');
          continue;
        }
        if (this.restart) {
          this.restart = false;
          continue;
        }
        return;
      }
      fresh = true;
      i++;
    }
    if (!this.over) this.complete();
  }

  // ------------------------------------------------------------ death
  async death() {
    const S = this.S;
    const G = this.G;
    const by = S.deathBy || 'gefen';
    const who = by.replace('fp_', '').replace('rescue', 'gefen');
    S.busy = true;
    S.hideHud = true;
    S.office.tablet.open = false;
    S.player.setMask(false);
    audio.stopLoop('hum', 0.1);
    audio.setTension?.(0);
    // assets/audio/scare_<who>.mp3 when it exists, otherwise each enemy has his own synth sound
    const sampled = !!audio.playSample?.('scare_' + who, { vol: 1.15, reverb: 0.1 });
    const fx = G.gfx.fx;
    // video jump scare when we have one, otherwise the face comes at the camera
    const v = G.assets.video('js_' + who + (S.enemies.gefen.final && who === 'gefen' ? '_final' : '')) || G.assets.video('js_' + who);
    let played = false;
    if (v) {
      if (!sampled) {
        audio.scream(1);
        audio.sting(0.6);
      }
      played = await v.play(1.15);
      if (played) {
        G.gfx.setVideo(v.tex, v.aspect);
        S.video = { v, preset: 'clip', shake: 0.6 };
        fx.videoAmt = 1;
        await wait(Math.min(2300, (v.el.duration || 2.2) * 1000 * 0.75));
        S.stopClip();
      }
    }
    if (!played) {
      const sheet = G.assets.sheet(who);
      const tex = G.assets.faceTexture('face_' + who) || (sheet.final && S.enemies.gefen.final && who === 'gefen' ? sheet.final.map : sheet.idle.map);
      G.gfx.setFace(tex);
      const isFace = !!G.assets.images['face_' + who];
      const base = isFace ? 0.9 : 1.6;
      const y0 = isFace ? 0 : -0.55;
      const side = S.enemies.ido.side || 1;
      const snd = (fn) => !sampled && fn();
      // three different attacks:
      //  gefen - screams and flies straight at you
      //  ido   - a beat of silence, then he is simply there, from the side of his vent, and only then lunges
      //  dolev - the lights die and he arrives in three electric flashes, each one closer
      const FLASHES = [0.15, 0.5, 0.85, 1.15];
      const strobe = G.settings.flashing !== false; // the "flashing lights" setting turns the strobe off
      let cue = 0;
      if (who === 'gefen' || !isFace) snd(() => (audio.scream(1), audio.sting(0.6)));
      if (who === 'dolev') snd(() => (audio.staticBurst(0.3, 0.4), !strobe && audio.scream(0.8)));
      const t0 = performance.now();
      await new Promise((res) => {
        const step = () => {
          const t = (performance.now() - t0) / 1000;
          const jit = (k) => (Math.random() - 0.5) * k;
          if (who === 'ido' && isFace) {
            if (t < 0.4) {
              fx.faceAmt = 0;
              fx.exposure = 0.3;
              fx.glitch = 0;
            } else {
              if (cue === 0 && ++cue) snd(() => (audio.ventThump?.(side * 0.8, 1), audio.hiss?.(0.9, side * 0.5)));
              if (t >= 1.1 && cue === 1 && ++cue) snd(() => audio.scream(0.7));
              const lunge = Math.max(0, t - 1.1);
              fx.faceAmt = 1;
              fx.exposure = 0.3;
              fx.faceScale = 1.15 + (t - 0.4) * 0.12 + lunge * 5;
              fx.faceX = side * 0.9 * Math.max(0, 1 - (t - 0.4) / 0.1) + jit(lunge ? 0.04 : 0.004);
              fx.faceY = jit(lunge ? 0.04 : 0.004);
              fx.glitch = lunge ? 0.9 : 0.1;
            }
          } else if (who === 'dolev' && isFace && strobe) {
            let on = -1;
            FLASHES.forEach((f, i) => t >= f && t < f + (i === 3 ? 0.4 : 0.12) && (on = i));
            if (on >= 0) {
              if (cue <= on) {
                cue = on + 1;
                snd(() => (audio.zap?.(jit(1.2), 0.9), on === 3 && audio.scream(0.8)));
              }
              fx.faceAmt = 1;
              fx.exposure = 1.7;
              fx.faceScale = [0.75, 1.2, 1.8, 2.3][on] + (on === 3 ? (t - FLASHES[3]) * 2.5 : 0);
              fx.faceX = jit(0.05);
              fx.faceY = jit(0.03);
              fx.glitch = 0.6;
              fx.staticAmt = 0.15;
            } else {
              fx.faceAmt = 0;
              fx.exposure = 0.02;
              fx.glitch = 0;
              fx.staticAmt = 0.35;
            }
          } else {
            fx.faceAmt = 1;
            fx.faceScale = base + t * (isFace ? 1.4 : 3.2) + Math.sin(t * 60) * 0.05;
            fx.faceX = jit(0.03);
            fx.faceY = y0 - (isFace ? 0 : t * 0.9) + jit(0.03);
            fx.glitch = 0.8;
          }
          if (t < 1.5 && !this.over) requestAnimationFrame(step);
          else res();
        };
        step();
      });
      fx.faceAmt = 0;
      fx.exposure = 1;
      fx.staticAmt = 0;
    }
    fx.glitch = 0;
    fx.fade = 1;
    audio.staticBurst(0.5, 0.3);
    await wait(350);
    if (this.over) return false;
    const tip = CAUGHT_TIPS[by] || CAUGHT_TIPS[who] || '';
    return new Promise((res) => {
      const el = (this.overlay = h(`
        <div class="g2over">
          <div class="noise"></div>
          <h1>${UI.caught}</h1>
          <p class="tip">${esc(tip)}</p>
          <div class="row">
            <button class="btn primary retry">${UI.retry}</button>
            <button class="btn ghost menu">${UI.menu}</button>
          </div>
        </div>`));
      document.getElementById('ui').appendChild(el);
      const done = (v) => {
        el.remove();
        this.overlay = null;
        audio.click(0.3);
        res(v);
      };
      el.querySelector('.retry').addEventListener('pointerdown', () => done(true));
      el.querySelector('.menu').addEventListener('pointerdown', () => done(false));
      this._overKey = (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          removeEventListener('keydown', this._overKey);
          if (this.overlay === el) done(true);
        }
      };
      addEventListener('keydown', this._overKey);
      if (G.dev.bot) setTimeout(() => this.overlay === el && done(true), 300);
    });
  }

  // ------------------------------------------------------------ 6 AM
  async complete() {
    const S = this.S;
    const G = this.G;
    this.over = true;
    S.won = true;
    S.busy = true;
    S.hideHud = true;
    S.hud.el.classList.add('hidden'); // the loop stops with this.over, so hide it right here
    S.hud.el.querySelector('.subs').hidden = true;
    S.office.tablet.open = false;
    G.save.finishNight(this.night, S.flags);
    audio.setTension?.(0);
    if (this.night >= NIGHTS) return G.director.go('ending');
    audio.stopAll(1.2);
    audio.sixAM?.();
    const el = h(`
      <div class="g2six">
        <div class="big-clock"><span class="a">5:59</span><span class="b">6:00</span> AM</div>
        <p>${UI.survived}</p>
        <small>${UI.saved}</small>
        <div class="row" hidden>
          <button class="btn primary next">${UI.next}: ${esc(NIGHT_TITLES[this.night + 1])}</button>
          <button class="btn ghost menu">${UI.menu}</button>
        </div>
      </div>`);
    document.getElementById('ui').appendChild(el);
    await wait(G.dev.bot ? 200 : 2600);
    el.querySelector('.row').hidden = false;
    const go = (name, p) => {
      audio.click(0.3);
      G.director.go(name, p);
    };
    el.querySelector('.next').addEventListener('pointerdown', () => go('night', { night: this.night + 1 }));
    el.querySelector('.menu').addEventListener('pointerdown', () => go('menu'));
    if (G.dev.bot) setTimeout(() => (window.__nightDone = this.night), 100);
  }

  // ------------------------------------------------------------ pause
  togglePause() {
    if (this.over || this.overlay) return;
    const S = this.S;
    this.paused = !this.paused;
    document.exitPointerLock?.();
    if (this.paused) {
      audio.duck(0.15, 0.2);
      const el = (this.pauseEl = h(`
        <div class="g2pause">
          <h2>${UI.pause}</h2>
          <button class="btn primary resume">${UI.resume}</button>
          <button class="btn restart">${UI.restartStage}</button>
          <button class="btn ghost quit">${UI.quit}</button>
        </div>`));
      document.getElementById('ui').appendChild(el);
      el.querySelector('.resume').addEventListener('pointerdown', () => this.togglePause());
      el.querySelector('.restart').addEventListener('pointerdown', () => {
        this.togglePause();
        this.restart = true;
        S.cancelAll();
      });
      el.querySelector('.quit').addEventListener('pointerdown', () => {
        this.paused = false;
        this.G.director.go('menu');
      });
    } else {
      audio.unduck(0.3);
      this.pauseEl?.remove();
      this.pauseEl = null;
    }
  }

  update(dt) {
    const S = this.S;
    if (this.G.input.took('pause')) this.togglePause();
    if (this.paused) return;
    const n = Math.max(1, Math.round(this.G.dev.speed || 1));
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < n && !this.over; i++) {
      if (i > 0) this.G.input.hit.clear();
      this.bot?.update(step);
      S.update(step);
    }
  }

  render(time) {
    if (this.G.dev.noRender) return;
    this.S.render(time);
  }

  exit() {
    this.over = true;
    removeEventListener('keydown', this._overKey);
    this.pauseEl?.remove();
    this.overlay?.remove();
    this.S.destroy();
    this.G.gfx.fx.fade = 0;
    this.G.gfx.fx.mask = 0;
    this.G.gfx.fx.redPulse = 0;
    this.G.gfx.fx.staticAmt = 0;
  }
}
