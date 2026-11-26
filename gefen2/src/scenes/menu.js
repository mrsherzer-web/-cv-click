// ============================================================================
//  Splash ("tap to enter") and the main menu
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { World } from '../world/world.js';
import { Actor } from '../world/actor.js';
import { UI, CREDITS } from '../story.js';
import { NIGHTS, NIGHT_TITLES, CHAR } from '../config.js';
import { audio } from '../engine/audio2.js';
import { h, esc } from '../ui/dom.js';

export class SplashScene {
  constructor(G) {
    this.G = G;
    const el = h(`
      <div class="g2splash">
        <div class="logo"><b>${UI.title}</b><span>${UI.subtitle}</span></div>
        <p class="enter">${UI.enter}</p>
        <p class="warn">${UI.warn}</p>
      </div>`);
    document.getElementById('ui').appendChild(el);
    const go = async () => {
      el.removeEventListener('pointerdown', go);
      removeEventListener('keydown', go);
      audio.unlock();
      G.voice.unlock();
      G.assets.primeVideos();
      await audio.decodePending?.();
      G.applySettings();
      G.director.go('menu');
    };
    el.addEventListener('pointerdown', go);
    addEventListener('keydown', go);
    this._go = go;
  }
  render(time) {
    this.G.gfx.render(null, new THREE.PerspectiveCamera(), 'cinema', time);
  }
  exit() {
    removeEventListener('keydown', this._go);
  }
}

export class MenuScene {
  constructor(G) {
    this.G = G;
    this.t = 0;
    // living background: the hall, one lamp, somebody standing in the dark
    this.world = new World({ lights: [3, 5, 6][G.settings.quality] ?? 5, tex: G.assets.worldTex });
    this.world.setView('hall');
    this.world.setPower('dim');
    this.cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 80);
    this.gefen = new Actor(this.world, 'gefen', G.assets.sheet('gefen'), { eye: CHAR.gefen.eye, glow: 3.4 });
    this.gefen.setPose(G.assets.sheet('gefen').final && G.save.data.beaten ? 'final' : 'idle');
    this.gefen.place(-2.6, -29.9, 'hall');
    this.gefen.show(true);
    this.gefen.flicker = 0.5;
    this.gefen.jitter = 1;
    audio.menuTheme?.();
    audio.drone(0.5);
    this.build();
  }

  build() {
    const G = this.G;
    const d = G.save.data;
    const cont = d.cont && (d.cont.night > 1 || d.cont.stage > 0);
    this.el = h(`
      <div class="g2menu">
        <div class="shade"></div>
        <div class="logo"><b data-text="${UI.title}">${UI.title}</b><span>${UI.subtitle}</span><em>${UI.heTitle}</em></div>
        <nav class="main">
          ${cont ? `<button class="btn primary" data-a="cont">${UI.cont} · ${UI.night} ${d.cont.night}</button>` : ''}
          <button class="btn ${cont ? '' : 'primary'}" data-a="new">${UI.play}</button>
          <button class="btn" data-a="nights">${UI.nights}</button>
          <button class="btn" data-a="settings">${UI.settings}</button>
          <button class="btn ghost" data-a="credits">${UI.credits}</button>
        </nav>
        <div class="panel" hidden></div>
        <div class="ver">v2.0</div>
      </div>`);
    document.getElementById('ui').appendChild(this.el);
    this.panel = this.el.querySelector('.panel');
    this.el.querySelectorAll('nav.main [data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.click(0.3);
        this.act(b.dataset.a);
      }),
    );
  }

  act(a) {
    const G = this.G;
    const d = G.save.data;
    if (a === 'cont') return this.start(d.cont.night, d.cont.stage);
    if (a === 'new') {
      d.cont = null;
      G.save.write();
      return this.start(1, 0);
    }
    if (a === 'nights') return this.showNights();
    if (a === 'settings') return this.showSettings();
    if (a === 'credits') return this.showCredits();
  }

  start(night, stage) {
    audio.braam(0.6);
    audio.stopLoop('menu2', 0.8);
    this.G.gfx.fx.fade = 1;
    setTimeout(() => this.G.director.go('night', { night, stage }), 350);
  }

  open(html) {
    this.panel.innerHTML = `<button class="x">✕</button>` + html;
    this.panel.hidden = false;
    this.el.classList.add('sub');
    this.panel.querySelector('.x').addEventListener('click', () => this.close());
  }
  close() {
    audio.click(0.2);
    this.panel.hidden = true;
    this.el.classList.remove('sub');
  }

  showNights() {
    const max = this.G.save.data.night;
    let html = `<h2>${UI.nights}</h2><div class="nights">`;
    for (let n = 1; n <= NIGHTS; n++) {
      const ok = n <= max || this.G.dev.on;
      html += `<button class="nightbtn ${ok ? '' : 'locked'}" data-n="${n}" ${ok ? '' : 'disabled'}><b>${n}</b><span>${ok ? esc(NIGHT_TITLES[n]) : '🔒 ' + UI.locked}</span></button>`;
    }
    html += '</div>';
    this.open(html);
    this.panel.querySelectorAll('.nightbtn:not(.locked)').forEach((b) => b.addEventListener('click', () => this.start(+b.dataset.n, 0)));
  }

  showSettings() {
    const G = this.G;
    const s = G.settings;
    const tog = (key, label) => `<label class="set"><span>${label}</span><button class="tog ${s[key] !== false ? 'on' : ''}" data-k="${key}">${s[key] !== false ? UI.on : UI.off}</button></label>`;
    this.open(`
      <h2>${UI.settings}</h2>
      <label class="set"><span>${UI.volume}</span><input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-k="volume"></label>
      <label class="set"><span>${UI.sens}</span><input type="range" min="40" max="220" value="${Math.round((s.sens || 1) * 100)}" data-k="sens"></label>
      <label class="set"><span>${UI.graphics}</span><span class="seg">
        ${[UI.gLow, UI.gMed, UI.gHigh].map((t, i) => `<button class="${s.quality === i ? 'on' : ''}" data-q="${i}">${t}</button>`).join('')}
      </span></label>
      ${tog('voice', UI.voice)}${tog('subs', UI.subs)}${tog('flashing', UI.flashing)}`);
    this.panel.querySelectorAll('input[type=range]').forEach((r) =>
      r.addEventListener('input', () => {
        s[r.dataset.k] = r.value / 100;
        G.applySettings();
      }),
    );
    this.panel.querySelectorAll('.tog').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        s[k] = s[k] === false;
        b.classList.toggle('on', s[k]);
        b.textContent = s[k] ? UI.on : UI.off;
        G.applySettings();
        audio.click(0.2);
      }),
    );
    this.panel.querySelectorAll('.seg button').forEach((b) =>
      b.addEventListener('click', () => {
        s.quality = +b.dataset.q;
        this.panel.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
        G.applySettings();
        audio.click(0.2);
      }),
    );
  }

  showCredits() {
    this.open(`<h2>${UI.credits}</h2><div class="credits">${CREDITS.map(([a, b]) => `<p><small>${esc(a)}</small><b>${esc(b)}</b></p>`).join('')}</div>`);
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.cam.position.set(4.6 + Math.sin(t * 0.07) * 0.9, 1.45 + Math.sin(t * 0.11) * 0.08, -22.4);
    this.cam.lookAt(-3.4 + Math.sin(t * 0.05) * 0.4, 0.95, -30.5);
    this.world.update(dt, this.cam.position);
    this.gefen.uniforms.twitch.value = Math.sin(t * 0.7) > 0.93 ? 2 : 0.15;
    this.gefen.update(dt, this.cam, null);
    if (Math.sin(t * 0.31) > 0.995) this.G.gfx.fx.glitch = 0.5;
    this.G.gfx.fx.glitch = Math.max(0, this.G.gfx.fx.glitch - dt * 2);
  }

  render(time) {
    this.G.gfx.render(this.world.scene, this.cam, 'cinema', time);
  }

  exit() {
    audio.stopLoop('menu2', 0.6);
    this.gefen.dispose();
    this.world.dispose();
  }
}
