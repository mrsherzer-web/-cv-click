// ============================================================================
//  Escape: run from the possessed duo to the office (mash to run!)
// ============================================================================
import { ESCAPE } from '../story.js';
import { audio } from '../engine/audio.js';
import { mount, wait, flash, fade, isTouch } from '../ui/dom.js';

export class EscapeScene {
  constructor(G) {
    this.G = G;
    this.C = G.corridor;
  }
  enter() {
    const G = this.G;
    this.touch = isTouch();
    this.el = mount(`
      <div class="screen escape-ui">
        <div class="danger"></div>
        <div class="meter"><i></i><b></b></div>
        <div class="prompt">${ESCAPE.title}</div>
        <button class="turn left">←</button>
        <div class="hint" hidden>${this.touch ? ESCAPE.hintTouch : ESCAPE.hintDesktop}</div>
      </div>`);
    this.$prompt = this.el.querySelector('.prompt');
    this.$hint = this.el.querySelector('.hint');
    this.$meter = this.el.querySelector('.meter i');
    this.$enemy = this.el.querySelector('.meter b');
    this.$danger = this.el.querySelector('.danger');
    this.$turn = this.el.querySelector('.turn');
    this.reset();
    // the duo stands behind you at the start
    const cap = G.chars.cap;
    const smi = G.chars.smiler;
    const roomLike = { scene: this.C.scene };
    cap.place(roomLike, { pos: [-0.45, 0.62, 2.6], h: 1.16, light: 0.8, glow: 5, fade: 0.25, shadow: false });
    smi.place(roomLike, { pos: [0.5, 0.7, 2.9], h: 1.06, light: 0.8, glow: 5, fade: 0.25, shadow: false });
    this.C.shutter.position.y = 2.3 + 1.25;
    // input
    this._down = (e) => {
      if (e.target === this.$turn) return;
      this.press();
    };
    this._key = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.press();
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.turn();
    };
    this.$turn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.turn();
    });
    window.addEventListener('pointerdown', this._down);
    window.addEventListener('keydown', this._key);
    audio.drone(0.9);
    fade(false, 500);
  }
  reset() {
    this.phase = 'intro';
    this.t = 0;
    this.u = 0;
    this.speed = 0;
    this.gap = 6.5;
    this.lookBack = Math.PI;
    this.turnState = 'none';
    this.stepTimer = 0;
    this.caught = false;
  }
  press() {
    if (this.phase !== 'run') return;
    this.speed = Math.min(7.5, this.speed + 1.25);
  }
  turn() {
    if (this.turnState === 'prompt') {
      this.turnState = 'done';
      this.$turn.classList.remove('on');
      this.$prompt.classList.remove('on');
      audio.whoosh(true, 0.2, 0.25);
    }
  }
  update(dt, t) {
    const C = this.C;
    this.t += dt;
    const fx = this.G.gfx.fx;
    if (this.phase === 'intro') {
      // staring at them... then turn around and run
      if (this.t > 0.7 && !this.said) {
        this.said = true;
        this.$prompt.classList.add('on');
        audio.braam(0.8);
        audio.laugh(0.6, 0, 74);
      }
      if (this.t > 1.5) {
        this.lookBack = Math.max(0, this.lookBack - dt * 9);
        if (!this.whooshed) {
          this.whooshed = true;
          audio.whoosh(true, 0.3, 0.35);
        }
      }
      if (this.t > 1.9) {
        this.phase = 'run';
        this.$hint.hidden = false;
        this.speed = 2.5;
        audio.breathing(0.45);
        audio.heartbeat(110, 0.5);
        setTimeout(() => this.$prompt.classList.remove('on'), 700);
      }
    } else if (this.phase === 'run') {
      this.speed *= Math.exp(-dt * 1.5);
      const dist = this.speed * dt;
      this.u += dist / C.length;
      const chase = this.t < 3 ? 1.5 : 3.0;
      const stumble = this.turnState === 'prompt' && this.turnTimer > 1.6;
      if (stumble) {
        this.turnState = 'done';
        this.$turn.classList.remove('on');
        this.$prompt.classList.remove('on');
        this.speed = 0.4;
        this.gap -= 1.4;
        audio.bang(0, 0.4);
        flash('#400', 200, 0.6);
      }
      this.gap += (this.speed - chase) * dt;
      this.gap = Math.min(this.gap, 9);
      if (this.turnState === 'none' && this.u > C.turnAt - 0.03) {
        this.turnState = 'prompt';
        this.turnTimer = 0;
        this.$prompt.textContent = ESCAPE.turnLeft + ' ←';
        this.$prompt.classList.add('on');
        this.$turn.classList.add('on');
        audio.click(0.3);
      }
      if (this.turnState === 'prompt') {
        this.turnTimer += dt;
        this.speed *= Math.exp(-dt * 1.2);
      }
      // footsteps follow the speed
      this.stepTimer -= dt * Math.max(0.6, this.speed / 2.2);
      if (this.stepTimer <= 0 && this.speed > 0.5) {
        this.stepTimer = 0.34;
        audio.footsteps(0, 1, 0.35 + Math.min(0.3, this.speed * 0.05), 0.3);
      }
      const danger = Math.max(0, Math.min(1, 1 - (this.gap - 0.6) / 4));
      audio.heartbeat(95 + danger * 90, 0.35 + danger * 0.5);
      this.$danger.style.opacity = String(danger);
      fx.redPulse = danger * 0.5;
      this.$meter.style.width = Math.min(100, this.u * 100) + '%';
      this.$enemy.style.left = `calc(${Math.max(0, Math.min(100, (this.u - this.gap / C.length) * 100))}% - 3px)`;
      if (Math.random() < dt * (0.4 + danger)) audio.laugh(0.25 + danger * 0.4, (Math.random() - 0.5) * 0.4, 70 + Math.random() * 20);
      if (this.gap <= 0.6) return this.lose();
      if (this.u >= 0.995) return this.win();
    }
    C.pose(this.u, this.t, this.phase === 'run' ? this.speed : 0, this.lookBack);
    C.flicker(t);
    this.G.chars.cap.faceCamera(C.camera);
    this.G.chars.smiler.faceCamera(C.camera);
  }
  render(t) {
    this.G.gfx.render(this.C.scene, this.C.camera, 'office', t);
  }
  async win() {
    this.phase = 'end';
    this.$hint.hidden = true;
    audio.stopLoop('breath', 1);
    audio.heartbeat(70, 0.3);
    // the shutter slams shut behind you
    const s = this.C.shutter;
    const start = performance.now();
    await new Promise((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / 260);
        s.position.y = 2.3 + 1.25 - k * 2.4;
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
    audio.doorSlam(0);
    flash('#000', 200, 0.6);
    this.G.gfx.fx.redPulse = 0;
    await fade(true, 800);
    audio.stopLoop('heart', 1);
    this.G.director.go('nightIntro', { night: 1, tutorial: true });
  }
  async lose() {
    if (this.caught) return;
    this.caught = true;
    this.phase = 'caught';
    const G = this.G;
    audio.stopLoop('breath', 0.2);
    audio.stopLoop('heart', 0.2);
    G.jumpscare('cap', async () => {
      const card = mount(
        `<div class="card"><h2>${ESCAPE.caught}</h2><div style="margin-top:28px"><button class="btn">${ESCAPE.retry}</button></div></div>`,
        this.el.parentElement,
      );
      this.el.style.display = 'none';
      card.querySelector('button').addEventListener('click', () => {
        card.remove();
        G.director.go('escape');
      });
    });
  }
  exit() {
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('keydown', this._key);
    this.G.chars.cap.remove();
    this.G.chars.smiler.remove();
    audio.stopLoop('breath', 0.3);
    audio.stopLoop('heart', 0.3);
    this.G.gfx.fx.redPulse = 0;
  }
}
