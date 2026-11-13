// The DOM layer over the 3D view: objective, toasts, captions, the context button, start and pause screens.
const $ = (id) => document.getElementById(id);

// Chapter ten's pieces carry their own styles (added to the page once, when the HUD is made): the
// marker kind's name over the paint left, the special attack's button with its meter, the prompt of a
// timed opening
const STYLE10 = `
.marker-kind { position: absolute; right: 6px; bottom: 130px; padding: 2px 7px 3px; border-radius: 7px; background: var(--panel); color: var(--ink);
  font-size: 10px; font-weight: 800; white-space: nowrap; pointer-events: none; border-inline-start: 3px solid var(--kind, #ff5c8a); }
@media (max-height: 420px) { .marker-kind { bottom: 118px; } }
.act-special { right: 162px; bottom: 78px; width: 62px; height: 62px; border-color: rgba(255, 210, 63, .5); opacity: .6; overflow: hidden; }
.act-special svg { width: 22px; height: 22px; }
.act-special .act-label { font-size: 9px; white-space: nowrap; }
.act-special .sp-meter { position: absolute; left: 0; right: 0; bottom: 0; height: 100%; transform-origin: bottom; transform: scaleY(var(--k, 0)); background: rgba(255, 210, 63, .28); pointer-events: none; }
.act-special > :not(.sp-meter) { position: relative; }
.act-special.ready { opacity: 1; border-color: #ffd23f; box-shadow: 0 0 16px rgba(255, 210, 63, .7); animation: sp-ready .7s ease-in-out infinite alternate; }
.act-special.ready .sp-meter { background: rgba(255, 190, 40, .55); }
.act-special:active { background: rgba(255, 210, 63, .4); }
@keyframes sp-ready { to { box-shadow: 0 0 26px rgba(255, 210, 63, 1); } }
@media (max-height: 420px) { .act-special { right: 146px; bottom: 68px; width: 56px; height: 56px; } }
@media (orientation: portrait) { .act-special { right: 124px; bottom: 170px; width: 62px; height: 62px; } }
.opening { position: absolute; top: 31%; left: 0; right: 0; margin-inline: auto; width: max-content; min-width: 150px; padding: 6px 16px 8px; border-radius: 12px;
  background: rgba(255, 210, 63, .94); color: #2b1a00; font-size: 17px; font-weight: 900; text-align: center; pointer-events: none; box-shadow: 0 0 22px rgba(255, 210, 63, .6); }
.opening small { display: block; font-size: 11px; font-weight: 800; }
.opening i { display: block; height: 4px; margin-top: 5px; border-radius: 2px; background: #2b1a00; transform-origin: center; transform: scaleX(var(--k, 1)); }
.hud.cinematic .opening { display: none; }
@media (prefers-reduced-motion: reduce) { .act-special.ready { animation: none; } }
`;

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), objective: $('objective'), objLabel: $('objLabel'), objText: $('objText'), objDist: $('objDist'), objArrow: $('objArrow'), objMeters: $('objMeters'),
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
      heavy: $('btnHeavy'), shove: $('btnShove'), combo: $('combo'), comboPips: $('comboPips'), comboText: $('comboText'),
      foe: $('foeBar'), foeName: $('foeName'), foeFill: $('foeFill'),
      boss: $('bossBar'), bossName: $('bossName'), bossTag: $('bossTag'), bossFill: $('bossFill'), bossMarks: $('bossMarks'),
      bout: $('bout'), boutRound: $('boutRound'), boutClock: $('boutClock'),
      boutRed: { name: $('boutRedName'), fill: $('boutRedFill') }, boutBlue: { name: $('boutBlueName'), fill: $('boutBlueFill') },
      choice: $('choice'), choiceTitle: $('choiceTitle'), choiceOptions: $('choiceOptions'),
      gun: $('gunActions'), ammo: $('ammo'), crosshair: $('crosshair'), paintHits: $('paintHits'), mark: $('btnMark'), radio: $('radio'), pursuit: $('pursuit'), squad: $('squadBar'),
      vcall: $('videoCall'), vcallName: $('vcallName'), vcallTime: $('vcallTime'), vcallSelf: $('vcallSelf'),
    };
    if (!$('style10') && document.head) { const st = document.createElement('style'); st.id = 'style10'; st.textContent = STYLE10; document.head.append(st); }
    this.el.special = $('btnSpecial');
    this.specialKey = -2;
    this.openingKey = -2;
    this.markerKey = '';
    this.gunOn = false;
    this.squadOnly = false;
    this.ammoKey = '';
    this.callTime = 0;
    this.boutLast = {};
    this.combatOn = false;
    this.fistsOn = false;
    this.comboKey = -1;
    this.foeLast = {};
    this.bossLast = {};
    this.vit = { hp: -1, st: -1, tired: false };
    this.bars = [];
    this.popTimer = 0;
    this.bannerTimer = 0;
    this.money = null;
    this.lastSpeed = -1;
    this.lastHealth = -1;
    this.toastTimer = 0;
    this.captionTimer = 0;
    // every objective shown, and whether an arrow and a distance went with it (read by the tests);
    // a line that only differs in its numbers (a clock, a count) replaces the one before it
    this.guideLog = [];
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

  // the objective panel: what to do now, under a heading (the mission, or "next mission"); a heading
  // left out stays as it was
  setObjective(text, label) {
    this.el.objective.hidden = !text;
    this.el.objText.textContent = text || '';
    if (label !== undefined) this.el.objLabel.textContent = label;
    if (!text) return;
    const entry = { label: this.el.objLabel.textContent, text, meters: null }, last = this.guideLog[this.guideLog.length - 1];
    const shape = (e) => `${e.label}|${e.text.replace(/\d+/g, '#')}`;
    if (last && shape(last) === shape(entry)) { entry.meters = last.meters; this.guideLog[this.guideLog.length - 1] = entry; return; }
    this.guideLog.push(entry);
    if (this.guideLog.length > 400) this.guideLog.shift();
  }

  // meters to the target and its bearing relative to the camera (radians, 0 = straight ahead)
  setDistance(meters, bearing) {
    if (meters == null) { this.el.objDist.hidden = true; return; }
    const last = this.guideLog[this.guideLog.length - 1];
    if (last && last.meters == null) last.meters = Math.round(meters);
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

  // tone: 'red' or 'yellow' for a call from the corner, matching the rings in a fight
  setInteract(label, tone = null) {
    if (label === this.interactLabel && tone === this.interactTone) return;
    this.interactLabel = label;
    this.interactTone = tone;
    this.el.interact.hidden = !label;
    this.el.interact.classList.toggle('tone-red', tone === 'red');
    this.el.interact.classList.toggle('tone-yellow', tone === 'yellow');
    if (label) {
      this.el.interactLabel.textContent = label;
      this.el.interact.setAttribute('aria-label', label);
    }
  }

  // the round board: { round, of, clock (seconds), red: { name, frac }, blue: { name, frac } }, or null
  setBout(b) {
    const e = this.el, L = this.boutLast;
    if (!b) { if (!e.bout.hidden) { e.bout.hidden = true; e.hud.classList.remove('bout-on'); } return; }
    if (e.bout.hidden) { e.bout.hidden = false; e.hud.classList.add('bout-on'); }
    const round = `סיבוב ${b.round} מתוך ${b.of}`, left = Math.max(0, Math.ceil(b.clock)), clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (L.round !== round) { L.round = round; e.boutRound.textContent = round; }
    if (L.clock !== clock) { L.clock = clock; e.boutClock.textContent = clock; }
    for (const side of ['red', 'blue']) {
      const el = side === 'red' ? e.boutRed : e.boutBlue, v = b[side], f = Math.round(Math.max(0, Math.min(1, v.frac)) * 100);
      if (L[`${side}Name`] !== v.name) { L[`${side}Name`] = v.name; el.name.textContent = v.name; }
      if (L[`${side}F`] !== f) { L[`${side}F`] = f; el.fill.style.width = `${f}%`; }
    }
  }

  // a choice of a few options, one tap: resolves with the option's id ({ id, label, note } each)
  choose(title, options) {
    const e = this.el;
    e.choiceTitle.textContent = title;
    e.choiceOptions.replaceChildren();
    return new Promise((resolve) => {
      for (const o of options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = o.id;
        b.innerHTML = '<b></b><small></small>';
        b.firstChild.textContent = o.label;
        b.lastChild.textContent = o.note || '';
        b.addEventListener('click', () => { e.choice.hidden = true; e.choiceOptions.replaceChildren(); resolve(o.id); }, { once: true });
        e.choiceOptions.append(b);
      }
      e.choice.hidden = false;
    });
  }

  hideChoice() { this.el.choice.hidden = true; this.el.choiceOptions.replaceChildren(); }

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

  // chapter nine: the heavy punch and the shove beside the fists, only while a fight runs
  setFists(on) {
    if (on === this.fistsOn) return;
    this.fistsOn = on;
    this.el.heavy.hidden = this.el.shove.hidden = !on;
    this.el.hud.classList.toggle('fists-on', on);
  }

  // chapter ten's last fight: the special attack's button, with how far it has charged (0..1; at 1 it is lit
  // and can be pressed). null takes the button away
  setSpecial(frac) {
    const b = this.el.special; if (!b) return;
    const key = frac == null ? -1 : Math.round(Math.max(0, Math.min(1, frac)) * 50);
    if (key === this.specialKey) return;
    this.specialKey = key;
    b.hidden = key < 0;
    if (key < 0) return;
    b.style.setProperty('--k', String(key / 50));
    b.classList.toggle('ready', key >= 50);
  }
  get specialOn() { return this.specialKey >= 0; }

  // a timed opening: "now!" over the fight while the window is open (frac 1..0 runs it out); null hides it
  setOpening(frac) {
    const key = frac == null ? -1 : Math.round(Math.max(0, Math.min(1, frac)) * 40);
    if (key === this.openingKey) return;
    this.openingKey = key;
    let o = this.el.opening;
    if (!o) {
      if (key < 0) return;
      o = this.el.opening = document.createElement('div');
      o.className = 'opening'; o.id = 'opening'; o.setAttribute('aria-live', 'assertive');
      o.innerHTML = 'עכשיו!<small>אגרוף · מכת נגד</small><i></i>';
      this.el.hud.append(o);
    }
    o.hidden = key < 0;
    if (key >= 0) o.style.setProperty('--k', String(key / 40));
  }

  // the kind of marker in hand (chapter ten's rack), over the paint left; null takes the label away
  setMarker(name, accent = null) {
    const key = name ? `${name}|${accent}` : '';
    if (key === this.markerKey) return;
    this.markerKey = key;
    let m = this.el.markerKind;
    if (!m) {
      if (!name) return;
      m = this.el.markerKind = document.createElement('div');
      m.className = 'marker-kind'; m.id = 'markerKind';
      this.el.gun.append(m);
    }
    m.hidden = !name;
    if (name) { m.textContent = name; m.style.setProperty('--kind', accent || '#ff5c8a'); }
  }

  // the combination: punches landed in a row (a pip each); the third, the finisher, flashes
  setCombo(n, finished = false) {
    const key = n * 2 + (finished ? 1 : 0); // a number: this runs every frame of a fight
    if (key === this.comboKey) return;
    this.comboKey = key;
    const c = this.el.combo;
    c.hidden = !n;
    if (!n) return;
    [...this.el.comboPips.children].forEach((p, i) => p.classList.toggle('on', i < n));
    this.el.comboText.textContent = finished ? 'קומבו! ×3' : n >= 2 ? `×${n} · עוד אחת: סיום` : `×${n}`;
    c.classList.toggle('ready', n >= 2 && !finished);
    c.classList.toggle('done', finished);
  }

  // the opponent Nehorai faces: his name and a small health bar (yellow while he is open)
  setFoe(f) {
    const e = this.el, L = this.foeLast;
    if (!f) { if (!e.foe.hidden) { e.foe.hidden = true; e.hud.classList.remove('foe-on'); L.name = null; } return; }
    if (e.foe.hidden) { e.foe.hidden = false; e.hud.classList.add('foe-on'); }
    if (L.name !== f.name) { L.name = f.name; e.foeName.textContent = f.name; }
    const w = Math.round(Math.max(0, Math.min(1, f.frac)) * 100);
    if (L.w !== w) { L.w = w; e.foeFill.style.width = `${w}%`; }
    const st = f.floored ? 'floored' : f.open ? 'open' : '';
    if (L.st !== st) { L.st = st; e.foe.classList.toggle('open', st === 'open'); e.foe.classList.toggle('floored', st === 'floored'); }
  }

  // a boss: his name, a long bar with a mark at each phase, and what moves him. `marks` is the boss's
  // own list (the same array every frame), so it is compared as it is
  setBoss(b) {
    const e = this.el, L = this.bossLast;
    if (!b) { if (!e.boss.hidden) { e.boss.hidden = true; e.hud.classList.remove('boss-on'); L.name = null; L.marks = null; } return; }
    if (e.boss.hidden) { e.boss.hidden = false; e.hud.classList.add('boss-on'); }
    if (L.name !== b.name) { L.name = b.name; e.bossName.textContent = b.name; }
    if (L.marks !== b.marks) {
      L.marks = b.marks;
      e.bossMarks.replaceChildren(...(b.marks || []).map((at) => { const i = document.createElement('i'); i.style.insetInlineStart = `${at * 100}%`; return i; }));
    }
    const w = Math.round(Math.max(0, Math.min(1, b.frac)) * 100);
    if (L.w !== w) { L.w = w; e.bossFill.style.width = `${w}%`; }
    const tag = b.tag ?? (b.floored ? 'על הרצפה!' : b.open ? 'פתוח!' : 'רק מכה חזקה או סיום קומבו'); // b.tag: an energy foe says what moves it
    if (L.tag !== tag) { L.tag = tag; e.bossTag.textContent = tag; e.boss.classList.toggle('open', !!b.open || !!b.floored); }
  }

  // paintball: fire and reload under the right thumb instead of the fists, and the crosshair. `squad`:
  // with the weapons taken (chapter nine) the block keeps only the squad's order button, beside the run
  // button, so orders can still be given unarmed
  setGun(on, squad = false) {
    squad = !on && !!squad;
    if (on === this.gunOn && squad === this.squadOnly) return;
    this.gunOn = on;
    this.squadOnly = squad;
    this.el.gun.hidden = !on && !squad;
    this.el.gun.classList.toggle('squad-only', squad);
    this.el.hud.classList.toggle('gun-on', on);
    this.el.hud.classList.toggle('squad-only', squad);
    if (!on) this.setCrosshair(null);
  }

  // chapter five: the "mark for Muller" button beside the fire button; lit when the overwatch can see the locked guard
  setMark(on, canSee) {
    const key = `${on}:${canSee}`;
    if (key === this.markKey) return;
    this.markKey = key;
    const b = this.el.mark; if (!b) return;
    b.hidden = !on;
    b.classList.toggle('can', !!canSee);
  }

  // the pursuit pill under the top row: the grace countdown, then the cars and how close they are
  setPursuit(text) {
    const el = this.el.pursuit; if (!el) return;
    if (text === this.pursuitText) return;
    this.pursuitText = text;
    el.hidden = !text;
    if (text) el.textContent = text;
  }

  // the team strip (chapter seven): a chip per member with a dot for their state
  setSquad(rows, order = null) {
    const el = this.el.squad, btn = document.getElementById('btnSquad'); if (!el) return;
    if (!rows) { el.hidden = true; el.replaceChildren(); if (btn) btn.hidden = true; return; }
    el.hidden = false;
    const head = []; if (order) { const d = document.createElement('div'); d.className = 'order'; d.textContent = order; head.push(d); }
    el.replaceChildren(...head, ...rows.map((r) => { const d = document.createElement('div'); d.className = `mate ${r.state}`; d.innerHTML = '<i></i><span></span>'; d.lastChild.textContent = r.name; return d; }));
    if (btn) { btn.hidden = false; btn.querySelector('span').textContent = order || 'פקודה'; }
  }

  // the paint left in the hopper, as pellets; `reloading` blinks them
  setAmmo(n, max, reloading) {
    const key = `${n}/${max}/${reloading}`;
    if (key === this.ammoKey) return;
    this.ammoKey = key;
    const a = this.el.ammo;
    if (a.children.length !== max) { a.replaceChildren(); for (let i = 0; i < max; i++) a.append(document.createElement('i')); }
    [...a.children].forEach((el, i) => el.classList.toggle('spent', i >= n));
    a.classList.toggle('reloading', reloading);
  }

  // 'locked' on someone, 'free', or null to hide it
  setCrosshair(state) {
    const c = this.el.crosshair;
    if (state === this.crosshairState) return;
    this.crosshairState = state;
    c.hidden = !state;
    c.classList.toggle('locked', state === 'locked');
  }

  // a pellet got Nehorai: a splat of that paint on the lens (the nth at its own corner)
  paintHit(color, n) {
    const el = document.createElement('div');
    el.className = 'splat';
    el.style.background = color;
    const spots = [[-30, 18], [62, -40], [12, 58], [40, 30]], [sx, sy] = spots[(n - 1) % spots.length];
    el.style.left = `${sx}%`;
    el.style.top = `${sy}%`;
    el.style.transform = `rotate(${(n * 47) % 360}deg)`;
    this.el.paintHits.append(el);
  }

  paintClear() { this.el.paintHits.replaceChildren(); }

  // a video call: the name at the top with a timer, Nehorai's own frame at the corner (the game
  // draws into it); returns the frame's rectangle each frame through frameRect()
  videoCall(name) {
    this.el.vcallName.textContent = name;
    this.el.vcallTime.textContent = '00:00';
    this.callTime = 0;
    this.el.vcall.hidden = false;
    this.el.hud.classList.add('vcall-on');
  }

  endVideoCall() {
    this.el.vcall.hidden = true;
    this.el.hud.classList.remove('vcall-on');
  }

  get callOn() { return !this.el.vcall.hidden; }
  frameRect() { return this.el.vcallSelf.getBoundingClientRect(); }

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
  // to black, with an optional line ("the next morning"); then() runs while the screen is black, and the
  // picture comes back after `ms`
  fade(text = '', then = null, ms = 1600) {
    const f = document.getElementById('fade');
    document.getElementById('fadeText').textContent = text;
    f.classList.add('on');
    this.fading = true;
    setTimeout(() => {
      then?.();
      setTimeout(() => { f.classList.remove('on'); this.fading = false; }, ms);
    }, 520);
  }

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
  get objectiveText() { return this.el.objText.textContent; }

  // the chapter's missions in the pause menu; only finished ones get a button (to play them again)
  setMissionList(rows, onReplay) {
    const e = this.el;
    e.missionList.hidden = !rows.length;
    e.missionRows.replaceChildren(...rows.map(({ id, title, state, note }) => {
      const row = document.createElement('div');
      row.className = `mission-row ${state}`;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = title;
      const right = document.createElement('span');
      right.className = 'status';
      if (note) {
        const n = document.createElement('span');
        n.className = 'note';
        n.textContent = note;
        right.append(n);
      }
      if (state === 'done') {
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
    if (this.callOn) {
      this.callTime += dt;
      const t = Math.floor(this.callTime), txt = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      if (txt !== this.el.vcallTime.textContent) this.el.vcallTime.textContent = txt;
    }
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
