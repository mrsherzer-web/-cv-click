// The DOM layer over the 3D view: objective, toasts, captions, the context button, start and pause screens.
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), objective: $('objective'), objText: $('objText'), objDist: $('objDist'), objArrow: $('objArrow'), objMeters: $('objMeters'),
      toast: $('toast'), caption: $('caption'), interact: $('btnInteract'), interactLabel: $('interactLabel'),
      start: $('startScreen'), startBtn: $('startBtn'), startNote: $('startNote'),
      pause: $('pauseMenu'), pauseBtn: $('pauseBtn'), resume: $('resumeBtn'), home: $('homeBtn'), resetCar: $('resetCarBtn'), fullscreen: $('fullscreenBtn'),
      fps: $('fpsText'), quality: [...document.querySelectorAll('[data-quality]')],
      footActions: $('footActions'), carActions: $('carActions'), carHud: $('carHud'), speed: $('speedText'), carHealth: $('carHealth'),
      run: $('btnRun'),
      money: $('money'), moneyText: $('moneyText'), minimap: $('minimap'),
      banner: $('banner'), bannerKicker: $('bannerKicker'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
      fail: $('failMenu'), failMission: $('failMission'), failReason: $('failReason'), retry: $('retryBtn'), quitMission: $('quitMissionBtn'),
      missionList: $('missionList'), missionRows: $('missionRows'),
      combat: $('combatActions'), block: $('btnBlock'), vitals: $('vitals'), hp: $('hpFill'), st: $('stFill'),
      hurt: $('hurt'), pop: $('pop'), enemyBars: $('enemyBars'),
    };
    this.combatOn = false;
    this.vit = { hp: -1, st: -1, tired: false };
    this.bars = [];
    this.popTimer = 0;
    this.bannerTimer = 0;
    this.money = null;
    this.lastSpeed = -1;
    this.lastHealth = -1;
    this.toastTimer = 0;
    this.captionTimer = 0;
    this.frames = 0;
    this.fpsTime = 0;
  }

  // the start button; with a saved game it reads "continue" and a second button starts over
  ready(onStart, saved = null) {
    const b = this.el.startBtn, n = document.getElementById('newGameBtn');
    b.disabled = false;
    b.textContent = saved ? 'להמשיך' : 'להתחיל';
    b.addEventListener('click', onStart, { once: true });
    if (saved) {
      n.hidden = false;
      n.textContent = 'משחק חדש';
      document.getElementById('startNote').textContent = `שמור: ${saved.summary}. כל הדמויות והאירועים במשחק בדיוניים.`;
      n.addEventListener('click', saved.onNew, { once: true });
    }
  }

  fail(message) {
    this.el.startBtn.textContent = 'לא ניתן להפעיל';
    this.el.startNote.textContent = message;
  }

  showGame() {
    this.el.start.hidden = true;
    this.el.hud.hidden = false;
  }

  setObjective(text) {
    this.el.objective.hidden = !text;
    this.el.objText.textContent = text || '';
  }

  // meters to the target and its bearing relative to the camera (radians, 0 = straight ahead)
  setDistance(meters, bearing) {
    if (meters == null) { this.el.objDist.hidden = true; return; }
    this.el.objDist.hidden = false;
    this.el.objMeters.textContent = `${Math.round(meters)} מ׳`;
    this.el.objArrow.style.transform = `rotate(${bearing}rad)`;
  }

  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  caption(text, ms) {
    const c = this.el.caption;
    c.hidden = !text;
    c.textContent = text || '';
    clearTimeout(this.captionTimer);
    if (text && ms) this.captionTimer = setTimeout(() => { c.hidden = true; }, ms);
  }

  setInteract(label) {
    if (label === this.interactLabel) return;
    this.interactLabel = label;
    this.el.interact.hidden = !label;
    if (label) {
      this.el.interactLabel.textContent = label;
      this.el.interact.setAttribute('aria-label', label);
    }
  }

  // on foot: run and the context button; driving: pedals, exit, speed and the car's condition
  setMode(mode) {
    const car = mode === 'car';
    this.el.carActions.hidden = !car;
    this.el.carHud.hidden = !car;
    this.el.run.hidden = car;
    this.el.vitals.hidden = car;
    if (car) this.setCombat(false);
  }

  setCar(car) {
    const kmh = Math.round(car.kmh);
    if (kmh !== this.lastSpeed) { this.lastSpeed = kmh; this.el.speed.textContent = String(kmh); }
    const h = Math.round(car.health);
    if (h !== this.lastHealth) {
      this.lastHealth = h;
      const f = this.el.carHealth;
      f.style.width = `${h}%`;
      f.classList.toggle('low', h < 60 && h >= 30);
      f.classList.toggle('bad', h < 30);
    }
  }

  // the alert meter: only while there is something to show
  setAlert(frac, label, state) {
    const key = `${Math.round(frac * 100)}|${label}|${state}`;
    if (key === this.alertKey) return;
    this.alertKey = key;
    const el = document.getElementById('alertMeter');
    el.hidden = frac <= 0 && state !== 'chase';
    el.classList.toggle('chase', state === 'chase');
    document.getElementById('alertLabel').textContent = label;
    document.getElementById('alertFill').style.width = `${Math.round(frac * 100)}%`;
  }

  // a phone ringing: the caller's name and an answer button; null hides it
  showCall(name, onAnswer) {
    const card = document.getElementById('callCard');
    if (!name) { card.hidden = true; return; }
    document.getElementById('callName').textContent = name;
    const b = document.getElementById('callAnswer');
    b.onpointerdown = (e) => { e.preventDefault(); card.hidden = true; onAnswer(); };
    b.onclick = (e) => { if (e.detail === 0) { card.hidden = true; onAnswer(); } };
    card.hidden = false;
  }

  // scripted moments: controls out of the way, the conversation in front
  setCinematic(on) {
    if (on === this.cinematic) return;
    this.cinematic = on;
    this.el.hud.classList.toggle('cinematic', on);
  }

  // fist-fight buttons: only near a punching bag or facing an opponent; the run button steps aside
  setCombat(on) {
    if (on === this.combatOn) return;
    this.combatOn = on;
    this.el.combat.hidden = !on;
    this.el.hud.classList.toggle('combat-on', on);
  }

  // health and stamina, as fractions; `tired` flashes the stamina bar
  setVitals(hp, st, tired) {
    const v = this.vit, H = Math.round(hp * 100), S = Math.round(st * 100);
    if (H !== v.hp) {
      v.hp = H;
      this.el.hp.style.width = `${H}%`;
      this.el.hp.classList.toggle('low', H < 50 && H >= 25);
      this.el.hp.classList.toggle('bad', H < 25);
    }
    if (S !== v.st) { v.st = S; this.el.st.style.width = `${S}%`; }
    if (tired !== v.tired) { v.tired = tired; this.el.vitals.classList.toggle('tired', tired); }
  }

  // a word over the action for a moment: 'block', 'dodge', 'counter', 'hit'
  pop(text, kind = 'hit') {
    const p = this.el.pop;
    p.textContent = text;
    p.className = `pop ${kind}`;
    void p.offsetWidth; // restart the animation
    p.classList.add('show');
  }

  hurt() {
    const h = this.el.hurt;
    h.classList.add('on');
    clearTimeout(this.hurtTimer);
    this.hurtTimer = setTimeout(() => h.classList.remove('on'), 90);
  }

  // [{ x, y, name, frac, open }] in screen pixels; anything not listed is hidden
  setEnemyBars(list) {
    while (this.bars.length < list.length) {
      const el = document.createElement('div');
      el.className = 'enemy-bar';
      el.innerHTML = '<span class="name"></span><div class="meter"><div class="meter-fill"></div></div>';
      this.el.enemyBars.append(el);
      this.bars.push({ el, name: el.firstChild, fill: el.querySelector('.meter-fill'), last: {} });
    }
    this.bars.forEach((b, i) => {
      const e = list[i];
      if (!e) { if (!b.el.hidden) b.el.hidden = true; return; }
      b.el.hidden = false;
      b.el.style.transform = `translate(${e.x.toFixed(1)}px, ${e.y.toFixed(1)}px)`;
      if (b.last.name !== e.name) { b.last.name = e.name; b.name.textContent = e.name; }
      const f = Math.round(e.frac * 100);
      if (b.last.f !== f) { b.last.f = f; b.fill.style.width = `${f}%`; }
      if (b.last.open !== e.open) { b.last.open = e.open; b.el.classList.toggle('open', e.open); }
    });
  }

  setMoney(amount) {
    const grew = this.money !== null && amount > this.money;
    this.money = amount;
    this.el.moneyText.textContent = amount.toLocaleString('he-IL');
    if (grew) {
      this.el.money.classList.add('flash');
      setTimeout(() => this.el.money.classList.remove('flash'), 900);
    }
  }

  // a short title card: a mission starting, done, or a reward
  banner(kicker, title, sub = '', ms = 2800) {
    const e = this.el;
    e.bannerKicker.textContent = kicker;
    e.bannerTitle.textContent = title;
    e.bannerSub.textContent = sub;
    e.banner.hidden = false;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { e.banner.hidden = true; }, ms);
  }

  showFail(mission, reason, { onRetry, onQuit }) {
    const e = this.el;
    e.failMission.textContent = mission;
    e.failReason.textContent = reason;
    e.fail.hidden = false;
    e.retry.onclick = () => { e.fail.hidden = true; onRetry(); };
    e.quitMission.onclick = () => { e.fail.hidden = true; onQuit(); };
    e.retry.focus({ preventScroll: true });
  }

  // finished missions in the pause menu, each with a "play again" button
  setMissionList(rows, onReplay) {
    const e = this.el;
    e.missionList.hidden = !rows.length;
    e.missionRows.replaceChildren(...rows.map(({ id, title, done }) => {
      const row = document.createElement('div');
      row.className = 'mission-row';
      const name = document.createElement('span');
      name.textContent = title;
      const right = document.createElement('span');
      if (done) {
        const tag = document.createElement('span');
        tag.className = 'done';
        tag.textContent = 'הושלמה · ';
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'לשחק שוב';
        b.addEventListener('click', () => onReplay(id));
        right.append(tag, b);
      }
      row.append(name, right);
      return row;
    }));
  }

  bindPause({ onPause, onResume, onHome, onResetCar, onTravel, onQuality, quality }) {
    const e = this.el;
    e.pauseBtn.addEventListener('click', onPause);
    e.resume.addEventListener('click', onResume);
    e.home.addEventListener('click', onHome);
    document.getElementById('travelBtn').addEventListener('click', onTravel);
    e.resetCar.addEventListener('click', onResetCar);
    for (const b of e.quality) b.addEventListener('click', () => { onQuality(b.dataset.quality); this.markQuality(b.dataset.quality); });
    this.markQuality(quality);
    const root = document.documentElement;
    if (document.fullscreenEnabled && root.requestFullscreen) {
      e.fullscreen.hidden = false;
      e.fullscreen.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else root.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
      });
      document.addEventListener('fullscreenchange', () => { e.fullscreen.textContent = document.fullscreenElement ? 'יציאה ממסך מלא' : 'מסך מלא'; });
    }
  }

  // the pause menu's quick trip: only once the place is unlocked, and not in the middle of a mission
  setTravel(available) { document.getElementById('travelBtn').hidden = !available; }

  markQuality(q) {
    for (const b of this.el.quality) b.setAttribute('aria-pressed', String(b.dataset.quality === q));
  }

  setPaused(on) {
    this.el.pause.hidden = !on;
    if (on) this.el.resume.focus({ preventScroll: true });
  }

  tick(dt) {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.el.fps.textContent = `FPS: ${this.fps}`;
      this.frames = 0;
      this.fpsTime = 0;
    }
  }
}
