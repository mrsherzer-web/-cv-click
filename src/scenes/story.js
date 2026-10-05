// ============================================================================
//  Night title, night-2 story, 06:00, game over, ending + credits
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { NIGHT2_SCENE, CAUGHT_CARD, ENDING, CREDITS, UI as TXT } from '../story.js';
import { CHARACTERS, NIGHTS } from '../config.js';
import { audio } from '../engine/audio.js';
import { voice } from '../engine/voice.js';
import { Dialogue } from '../ui/dialogue.js';
import { mount, wait, flash, fade, esc } from '../ui/dom.js';
import { save } from '../game/save.js';

// ---------------------------------------------------------------- "00:00 / night N"
export class NightIntroScene {
  constructor(G, { night = 1, tutorial = false } = {}) {
    this.G = G;
    this.night = night;
    this.tutorial = tutorial;
  }
  async enter() {
    save.reachNight(this.night);
    this.el = mount(`
      <div class="screen center-screen">
        <div class="big-clock fadein">00:00</div>
        <div class="big-sub fadein d2">${TXT.nightN(this.night)}</div>
      </div>`);
    fade(false, 300);
    audio.braam(0.45);
    await wait(3200);
    if (this.left) return;
    this.G.director.go('night', { night: this.night, tutorial: this.tutorial });
  }
  exit() {
    this.left = true;
  }
}

// ---------------------------------------------------------------- before night 2
export class Night2StoryScene {
  constructor(G) {
    this.G = G;
    this.office = G.office;
  }
  async enter() {
    const G = this.G;
    const A = G.A;
    Object.values(G.chars).forEach((c) => c.remove());
    this.office.reset();
    this.office.setNight(2);
    this.el = mount(`
      <div class="screen vn">
        <div class="portraits">
          <img class="portrait pos-left hidden" data-who="yahali" src="${A.img.yahali.src}" alt="">
          <img class="portrait pos-right hidden" data-who="maayan" src="${A.img.maayan.src}" alt="">
        </div>
      </div>`);
    this.p = {
      yahali: this.el.querySelector('[data-who=yahali]'),
      maayan: this.el.querySelector('[data-who=maayan]'),
    };
    this.p.yahali.style.height = 'min(70vh, 760px)';
    this.p.maayan.style.height = 'min(66vh, 720px)';
    audio.fan();
    audio.drone(0.45);
    fade(false, 800);
    await wait(500);
    const dlg = new Dialogue(this.el);
    await dlg.play(NIGHT2_SCENE, {
      onLine: (line) => {
        for (const [who, img] of Object.entries(this.p)) {
          if (line.who === who) img.classList.remove('hidden');
          img.classList.toggle('speaking', line.who === who);
          img.classList.toggle('idle', true);
        }
      },
      onFx: (fx) => this.fx(fx),
    });
    if (!this.cardShown) await this.caughtCard();
    await fade(true, 600);
    audio.stopAll(0.5);
    this.G.director.go('nightIntro', { night: 2 });
  }
  async fx(fx) {
    if (fx === 'knock') {
      audio.knock(3);
      await wait(1000);
      audio.knock(4);
      await wait(600);
      this.office.state.left.closed = false;
      audio.doorOpen(-0.6);
    } else if (fx === 'caught') {
      await this.caughtCard();
    }
  }
  async caughtCard() {
    this.cardShown = true;
    const A = this.G.A;
    audio.braam(1);
    audio.laugh(0.6, 0, 76);
    flash('#ff0000', 500, 0.8);
    const card = mount(
      `<div class="card"><img src="${A.img.duoPossessed.src}" alt=""><h2>${CAUGHT_CARD}</h2></div>`,
      this.el,
    );
    await wait(3200);
    card.style.transition = 'opacity .5s';
    card.style.opacity = '0';
    await wait(500);
    card.remove();
  }
  update(dt, t) {
    const o = this.office;
    o.targetYaw = Math.sin(t * 0.15) * 0.15;
    o.update(t, dt, { flicker: 0.15 });
  }
  render(t) {
    this.G.gfx.render(this.office.scene, this.office.camera, 'office', t);
  }
  exit() {
    voice.cancel();
  }
}

// ---------------------------------------------------------------- 06:00
export class SixAmScene {
  constructor(G, { night }) {
    this.G = G;
    this.night = night;
  }
  async enter() {
    const n = this.night;
    const last = n >= NIGHTS;
    save.reachNight(Math.min(NIGHTS, n + 1));
    if (last) save.beat();
    this.el = mount(`
      <div class="screen center-screen">
        <div class="big-clock">0<span class="roll"><span>5<br>6</span></span>:<span class="roll"><span>59<br>00</span></span></div>
        <div class="big-sub fadein" style="animation-delay:2.4s">${TXT.survived(n)}</div>
        <div class="fadein" style="animation-delay:3.4s;margin-top:20px">
          <button class="btn gold">${last ? TXT.next : TXT.nextNight + ' ◀'}</button>
        </div>
      </div>`);
    await fade(false, 200);
    setTimeout(() => audio.chime6(), 1400);
    const btn = this.el.querySelector('button');
    const go = () => {
      if (this.left) return;
      this.left = true;
      if (last) this.G.director.go('ending');
      else this.G.startNight(n + 1);
    };
    btn.addEventListener('click', go);
    this.auto = setTimeout(go, 14000);
  }
  exit() {
    this.left = true;
    clearTimeout(this.auto);
    audio.stopAll(0.5);
  }
}

// ---------------------------------------------------------------- game over
const TIPS = [
  'טיפ: גפן לא זז כל עוד מסתכלים עליו במצלמה 1. אם השולחן ריק — סגרו דלת מיד!',
  'טיפ: הדליקו אור לשנייה ובדקו מי עומד ליד הדלת. אל תשאירו דלתות סגורות סתם — זה גומר את החשמל.',
  'טיפ: שמעתם צעדים מצד אחד? תבדקו את הדלת באותו צד.',
  'טיפ: אם מישהו נכנס כשהמצלמות פתוחות — הוא יתקוף כשתורידו אותן.',
  'טיפ: הדפיקות של גפן על הדלת גונבות חשמל. תסתכלו עליו יותר.',
];
export class GameOverScene {
  constructor(G, { night = 1, who = 'gefen' }) {
    this.G = G;
    this.night = night;
    this.who = who;
  }
  enter() {
    const name = CHARACTERS[this.who]?.name || 'גפן';
    this.el = mount(`
      <div class="screen gameover">
        <canvas width="160" height="90"></canvas>
        <h2>${esc(TXT.gameOver(name))}</h2>
        <div class="tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>
        <div class="row">
          <button class="btn retry">${TXT.tryAgain} — ${TXT.nightN(this.night)}</button>
          <button class="btn ghost menu">${TXT.mainMenu}</button>
        </div>
      </div>`);
    const c = this.el.querySelector('canvas');
    const x = c.getContext('2d');
    const id = x.createImageData(160, 90);
    this.noise = setInterval(() => {
      for (let i = 0; i < id.data.length; i += 4) {
        const v = Math.random() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      x.putImageData(id, 0, 0);
    }, 50);
    audio.staticBurst(1.6, 0.25);
    this.el.querySelector('.retry').addEventListener('click', () => this.G.director.go('nightIntro', { night: this.night }));
    this.el.querySelector('.menu').addEventListener('click', () => this.G.director.go('menu'));
  }
  exit() {
    clearInterval(this.noise);
  }
}

// ---------------------------------------------------------------- ending
export class EndingScene {
  constructor(G) {
    this.G = G;
  }
  async enter() {
    const A = this.G.A;
    this.el = mount(`
      <div class="screen vn ending">
        <div class="sun"></div>
        <div class="portraits">
          <img class="portrait pos-center hidden" data-who="gefen" src="${A.img.gefenCut.src}" alt="">
          <img class="portrait pos-left hidden" data-who="yahali" src="${A.img.yahali.src}" alt="">
          <img class="portrait pos-right hidden" data-who="maayan" src="${A.img.maayan.src}" alt="">
          <img class="portrait pos-right hidden" data-who="cap" src="${A.img.duo.src}" alt="">
        </div>
      </div>`);
    const P = {};
    this.el.querySelectorAll('.portrait').forEach((p) => (P[p.dataset.who] = p));
    P.yahali.style.height = 'min(62vh, 680px)';
    P.maayan.style.height = 'min(58vh, 640px)';
    P.cap.style.height = 'min(60vh, 660px)';
    P.gefen.style.height = 'min(84vh, 880px)';
    await fade(false, 1500);
    audio.bell(523, audio.now, 0.15, 4);
    const dlg = new Dialogue(this.el);
    await dlg.play(ENDING, {
      onLine: (line) => {
        Object.entries(P).forEach(([who, img]) => {
          if (line.who === who) {
            img.classList.remove('hidden');
            if (who === 'cap') P.maayan.classList.add('hidden');
          }
          img.classList.toggle('speaking', line.who === who);
          img.classList.add('idle');
        });
      },
      onFx: async (fx) => {
        if (fx === 'red') {
          audio.ambientEvent();
          await wait(1300);
          P.gefen.src = A.img.gefenScaryCut.src;
          P.gefen.classList.remove('hidden');
          P.gefen.classList.add('speaking');
          flash('#ff0000', 200, 0.7);
          audio.laugh(0.6, 0, 80);
          await wait(260);
          P.gefen.src = A.img.gefenCut.src;
        }
      },
    });
    const end = mount(`<div class="card" style="background:#000"><h2>${TXT.theEnd}</h2></div>`, this.el);
    audio.braam(0.6);
    await wait(2600);
    end.remove();
    await this.credits();
  }
  async credits() {
    const A = this.G.A;
    const imgs = [null, A.img.gefenCut, A.img.yahali, A.img.maayan, A.img.duo, null, null];
    const items = CREDITS.map(
      ([a, b], i) =>
        `<div>${imgs[i] ? `<img src="${imgs[i].src}" alt="">` : ''}<h3 class="${i === 0 ? 'title' : ''}">${esc(a)}</h3>${b ? `<p>${esc(b)}</p>` : ''}</div>`,
    ).join('');
    this.cr = mount(`<div class="credits"><div class="roller">${items}</div></div>`, this.el);
    audio.menuMusic();
    await new Promise((r) => {
      this.cr.querySelector('.roller').addEventListener('animationend', r, { once: true });
      this.cr.addEventListener('pointerdown', r, { once: true });
    });
    audio.stopLoop('menu', 1);
    this.G.director.go('menu');
  }
  exit() {
    voice.cancel();
    audio.stopLoop('menu', 0.5);
  }
}
