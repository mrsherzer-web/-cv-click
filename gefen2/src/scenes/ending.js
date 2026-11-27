// ============================================================================
//  Ending: sunrise outside, the last two lines, credits, post-credits camera
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { World } from '../world/world.js';
import { Actor } from '../world/actor.js';
import { CAMS, POINTS } from '../world/layout.js';
import { N6, creditsList, SPEAKERS, UI } from '../story.js';
import { MANIFEST } from '../generated/manifest.js';
import { CHAR } from '../config.js';
import { audio } from '../engine/audio2.js';
import { voice } from '../engine/voice.js';
import { h, esc } from '../ui/dom.js';

export class EndingScene {
  constructor(G, { part = null } = {}) {
    this.G = G;
    this.t = 0;
    this.alive = true;
    this.preset = 'cinema';
    this.world = new World({ lights: [3, 5, 6][G.settings.quality] ?? 5, tex: G.assets.worldTex });
    this.cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 90);
    this.actors = {};
    for (const id of ['gefen', 'ido', 'dolev', 'yahali', 'maayan', 'cap', 'smiler']) {
      const a = (this.actors[id] = new Actor(this.world, id, G.assets.sheet(id), { eye: CHAR[id].eye || [1, 0, 0], glow: 0 }));
      a.setPose(a.sheet.normal ? 'normal' : 'idle');
      a.eyeBase = 0;
    }
    this.ui = h(`<div class="g2end"><div class="subs" hidden><b></b><span></span></div></div>`);
    document.getElementById('ui').appendChild(this.ui);
    G.gfx.fx.fade = 1;
    audio.stopAll(0.5);
    this.run(part).catch((e) => e !== 'exit' && console.error(e));
  }

  wait(sec) {
    const k = this.G.dev.bot ? 0.05 : 1 / (this.G.dev.speed || 1);
    return new Promise((res, rej) => setTimeout(() => (this.alive ? res() : rej('exit')), sec * 1000 * k));
  }

  async say(line) {
    const sp = SPEAKERS[line.who];
    const el = this.ui.querySelector('.subs');
    el.hidden = false;
    el.querySelector('b').textContent = sp.name + ':';
    el.querySelector('b').style.color = sp.color;
    el.querySelector('span').textContent = line.text;
    const b = audio.samples['v_' + line.id];
    if (this.G.settings.voice !== false) {
      if (!audio.playSample?.('v_' + line.id, { vol: 1, reverb: 0.25 }) && voice.available) voice.speak(line, sp.voice);
    }
    await this.wait(b ? b.duration + 0.5 : 1.6 + [...line.text].length * 0.07);
    el.hidden = true;
  }

  async fade(to, sec) {
    const fx = this.G.gfx.fx;
    const from = fx.fade;
    const t0 = performance.now();
    const k = this.G.dev.bot ? 0.05 : 1;
    await new Promise((res) => {
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / (sec * 1000 * k));
        fx.fade = from + (to - from) * p;
        if (p < 1 && this.alive) requestAnimationFrame(step);
        else res();
      };
      step();
    });
  }

  async run(part) {
    const G = this.G;
    const W = this.world;
    if (part !== 'post') {
      // --- sunrise
      W.dawn(true);
      W.setPower('dawn');
      W.setDoor('entrance', true, true);
      W.setView('outside');
      const spots = { gefen: [13.5, -9.0], ido: [16.3, -10.5], dolev: [17.5, -7.8], yahali: [15.7, -11.9], maayan: [16.7, -6.5], cap: [18.6, -11.0], smiler: [19.0, -8.8] };
      for (const id in spots) {
        const a = this.actors[id];
        a.place(spots[id][0], spots[id][1], 'outside');
        a.show(true);
        a.uniforms.sil.value = id === 'gefen' ? 0.3 : 0.88;
        a.uniforms.tint.value.setRGB(1.25, 0.95, 0.75);
      }
      this.cam.position.set(10.6, 1.55, -9);
      this.look = new THREE.Vector3(16, 1.9, -9);
      this.push = 0.16;
      audio.dawn?.();
      const clip = G.assets.video('ending');
      if (clip && (await clip.play(1))) {
        G.gfx.setVideo(clip.tex, clip.aspect);
        G.gfx.fx.videoAmt = 1;
        this.preset = 'clip';
        await this.fade(0, 1.5);
        await this.wait(Math.min(9, (clip.el.duration || 6) - 1.6));
        await this.fade(1, 1);
        clip.el.pause();
        G.gfx.fx.videoAmt = 0;
        G.gfx.setVideo(null);
        this.preset = 'cinema';
      }
      await this.fade(0, 3);
      await this.wait(2.2);
      await this.say(N6.ending[0]);
      await this.wait(2.6);
      await this.say(N6.ending[1]);
      await this.wait(2.4);
      G.gfx.flashColor.setRGB(1, 0.96, 0.9);
      await this.fade(1, 2.5);
      // --- credits
      await this.credits();
    }
    // --- post credits: one camera is still running
    audio.stopAll(1);
    await this.wait(1.2);
    for (const id in this.actors) this.actors[id].show(false);
    W.dawn(false);
    W.setPower('final');
    W.setView('basement');
    W.setIR(null);
    const c = CAMS.find((x) => x.n === 12);
    this.cam.position.set(...c.pos);
    this.cam.lookAt(...c.look);
    this.cam.fov = c.fov;
    this.cam.updateProjectionMatrix();
    this.look = null;
    this.preset = 'cctv';
    const fx = G.gfx.fx;
    fx.staticAmt = 1;
    fx.fade = 0;
    audio.camStatic?.();
    const tag = h(`<div class="tb-top" style="position:absolute;top:10px;left:12px;right:12px;display:flex;gap:14px;direction:ltr"><div class="rec"><i></i> REC</div><div class="camname">CAM 12 · המרתף</div></div>`);
    this.ui.appendChild(tag);
    await this.wait(1.4);
    fx.staticAmt = 0.12;
    await this.wait(3.2);
    // a figure that was not there before
    const fig = this.actors.gefen;
    fig.setPose(fig.sheet.back ? 'back' : 'idle');
    fig.place(POINTS.altar[0] - 0.4, POINTS.altar[1] + 0.3, 'basement');
    fig.uniforms.sil.value = 1;
    fig.uniforms.tint.value.setRGB(1, 1, 1);
    fig.eyeBase = 0;
    fig.show(true);
    fx.staticAmt = 0.7;
    audio.staticBurst(0.3, 0.25);
    await this.wait(0.25);
    fx.staticAmt = 0.1;
    await this.wait(2.6);
    fig.setPose('idle');
    fig.eyeBase = 4.5;
    fig.flicker = 0.3;
    audio.sting(0.5);
    fx.glitch = 0.6;
    await this.wait(1.7);
    fx.staticAmt = 1;
    audio.staticBurst(0.6, 0.4);
    tag.querySelector('.camname').textContent = UI.noSignal;
    await this.wait(1.1);
    fx.fade = 1;
    audio.stopLoop('camStatic', 0.1);
    audio.stopAll(0.2);
    await this.wait(1.6);
    window.__endingDone = true;
    fx.staticAmt = 0;
    G.director.go('menu');
  }

  credits() {
    return new Promise((res, rej) => {
      const el = h(`
        <div class="g2credits">
          <div class="roll">${creditsList(MANIFEST.hf).map(([a, b]) => `<p><small>${esc(a)}</small><b>${esc(b)}</b></p>`).join('')}</div>
          <button class="btn small ghost skipbtn">${UI.skip} ⏭</button>
        </div>`);
      this.ui.appendChild(el);
      audio.dawn?.();
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        el.remove();
        this.alive ? res() : rej('exit');
      };
      // the list rises from below and stops with its last line in the middle: no empty black tail
      const roll = el.querySelector('.roll');
      const vh = innerHeight;
      const end = vh * 0.56 - roll.scrollHeight;
      const k = this.G.dev.bot ? 0.02 : 1 / (this.G.dev.speed || 1);
      const dur = ((vh - end) / (vh * 0.075)) * 1000 * k;
      const anim = roll.animate([{ transform: `translateY(${vh}px)` }, { transform: `translateY(${end}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' });
      anim.onfinish = () => setTimeout(fin, 2600 * k);
      el.querySelector('.skipbtn').addEventListener('pointerdown', fin);
      setTimeout(fin, dur + 6000);
    });
  }

  update(dt) {
    this.t += dt;
    if (this.look) {
      this.cam.position.x += this.push * dt * 0.25;
      this.cam.lookAt(this.look);
    }
    this.world.update(dt, this.cam.position);
    for (const id in this.actors) this.actors[id].update(dt, this.cam, null);
  }

  render(time) {
    const fx = this.G.gfx.fx;
    this.G.gfx.render(fx.videoAmt > 0 || fx.staticAmt >= 1 ? null : this.world.scene, this.cam, this.preset, time);
  }

  exit() {
    this.alive = false;
    voice.cancel();
    audio.stopAll(0.3);
    const fx = this.G.gfx.fx;
    fx.videoAmt = 0;
    fx.staticAmt = 0;
    fx.fade = 0;
    this.G.gfx.flashColor.setRGB(1, 1, 1);
    for (const id in this.actors) this.actors[id].dispose();
    this.world.dispose();
  }
}
