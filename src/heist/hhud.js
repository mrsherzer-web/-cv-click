/* Heist chapter HUD: objectives, money, wanted stars, radar, bars, speedometer, banners, prompts,
   loading screen, video cutscenes and the touch overlay. DOM inside #stage (1280x720 logical px). */
const HHud = {
  el: null, $: {}, money: 0, moneyShown: 0, ready: false,
  CSS: `
  #hhud { position:absolute; inset:0; z-index:4; pointer-events:none; font-family: var(--body); color:#fff; }
  #hhud .hh-obj { position:absolute; top:18px; left:22px; min-width:300px; max-width:420px; background:linear-gradient(90deg, rgba(8,4,18,.78), rgba(8,4,18,.35) 85%, rgba(8,4,18,0)); padding:12px 18px 14px; border-left:4px solid var(--shirt); }
  [dir="rtl"] #hhud .hh-obj { left:auto; right:22px; border-left:0; border-right:4px solid var(--shirt); background:linear-gradient(270deg, rgba(8,4,18,.78), rgba(8,4,18,.35) 85%, rgba(8,4,18,0)); }
  #hhud .hh-obj h4 { margin:0 0 6px; font: 400 26px/1 'Bebas Neue', 'Secular One', sans-serif; letter-spacing:1.5px; color:var(--shirt); text-shadow:0 2px 0 #000; }
  #hhud .hh-obj ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
  #hhud .hh-obj li { font-size:19px; font-weight:600; display:flex; gap:9px; align-items:center; text-shadow:0 1px 3px #000; transition:opacity .4s; }
  #hhud .hh-obj li i { width:16px; height:16px; border:2px solid rgba(255,255,255,.8); border-radius:3px; flex:none; font-style:normal; font-size:13px; line-height:12px; text-align:center; }
  #hhud .hh-obj li.done { opacity:.45; text-decoration: line-through; }
  #hhud .hh-obj li.done i { background:var(--ok); border-color:var(--ok); color:#06210f; }
  #hhud .hh-obj li.cur { color:#fff; }
  #hhud .hh-obj li.cur i { border-color:var(--shirt); box-shadow:0 0 10px rgba(255,210,63,.8); }
  #hhud .hh-tr { position:absolute; top:16px; right:22px; text-align:right; }
  [dir="rtl"] #hhud .hh-tr { right:auto; left:22px; text-align:left; }
  #hhud .hh-money { font: 400 46px/1 'Bebas Neue', Impact, sans-serif; color:#7dffb0; letter-spacing:1px; text-shadow: 0 3px 0 #04210f, 0 0 18px rgba(80,255,160,.45); direction:ltr; font-variant-numeric: tabular-nums; }
  #hhud .hh-money.bump { animation: hhbump .35s ease-out; }
  @keyframes hhbump { from { transform:scale(1.18); } to { transform:none; } }
  #hhud .hh-stars { margin-top:4px; display:flex; gap:3px; justify-content:flex-end; direction:ltr; }
  [dir="rtl"] #hhud .hh-stars { justify-content:flex-start; }
  #hhud .hh-stars b { font-size:28px; line-height:1; color:rgba(255,255,255,.18); text-shadow:0 2px 0 rgba(0,0,0,.6); transition: color .2s; }
  #hhud .hh-stars b.on { color:#fff; text-shadow:0 0 10px rgba(255,255,255,.7), 0 2px 0 #000; }
  #hhud .hh-stars.flash b.on { animation: hhflash .5s steps(2) infinite; }
  @keyframes hhflash { 50% { color: rgba(255,255,255,.25); } }
  #hhud .hh-bl { position:absolute; left:22px; bottom:18px; display:flex; flex-direction:column; gap:7px; align-items:center; transform: scale(var(--u)); transform-origin: bottom left; }
  [dir="rtl"] #hhud .hh-bl { left:auto; right:22px; transform-origin: bottom right; }
  #hhud .hh-radar { width:210px; height:210px; border-radius:50%; overflow:hidden; border:3px solid rgba(255,255,255,.75); box-shadow:0 0 0 2px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.6); background:#101a24; }
  #hhud .hh-bars { width:210px; display:flex; gap:6px; }
  #hhud .hh-bar { flex:1; height:9px; background:rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.35); border-radius:3px; overflow:hidden; }
  #hhud .hh-bar i { display:block; height:100%; width:100%; transform-origin:left; transition: transform .2s; }
  #hhud .hh-bar.hp i { background:linear-gradient(90deg,#2fd06a,#7dffb0); }
  #hhud .hh-bar.car i { background:linear-gradient(90deg,#2d6cdf,#7fc0ff); }
  #hhud .hh-speed { position:absolute; right:26px; bottom:22px; text-align:right; font: 400 64px/0.9 'Bebas Neue', Impact, sans-serif; text-shadow: 0 3px 0 #000, 0 0 16px rgba(255,45,149,.45); direction:ltr; transform: scale(var(--u)); transform-origin: bottom right; }
  [dir="rtl"] #hhud .hh-speed { right:auto; left:26px; text-align:left; transform-origin: bottom left; }
  #hhud .hh-speed small { display:block; font-size:22px; color:var(--lava-2); letter-spacing:2px; }
  #hhud .hh-banner { position:absolute; left:0; right:0; top:24%; text-align:center; opacity:0; transform:scale(.85); transition: opacity .35s, transform .45s cubic-bezier(.2,1.4,.4,1); }
  #hhud .hh-banner.show { opacity:1; transform:none; }
  #hhud .hh-banner h2 { margin:0; font: 400 112px/0.92 'Bebas Neue', 'Secular One', Impact, sans-serif; letter-spacing:2px; color:#f4f0e6; text-shadow: 0 5px 0 rgba(0,0,0,.65), 0 0 40px rgba(0,0,0,.6); }
  #hhud .hh-banner p { margin:6px 0 0; font: 400 62px/1 'Bebas Neue', 'Secular One', Impact, sans-serif; color:var(--shirt); text-shadow: 0 4px 0 rgba(0,0,0,.65); direction:ltr; }
  #hhud .hh-banner.busted h2, #hhud .hh-banner.wasted h2 { color:#ff3b5c; font-size:140px; }
  #hhud .hh-banner.green p { color:#7dffb0; }
  #hhud .hh-prompt { position:absolute; left:50%; bottom:110px; transform:translateX(-50%); background:rgba(8,4,18,.78); border:1px solid rgba(255,255,255,.25); border-radius:10px; padding:9px 18px; font-size:22px; font-weight:700; display:flex; gap:10px; align-items:center; white-space:nowrap; }
  #hhud .hh-prompt kbd { font-family:var(--body); background:var(--shirt); color:#1a0a22; border-radius:6px; padding:1px 10px; font-weight:900; }
  #hhud .hh-toasts { position:absolute; right:22px; top:120px; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
  [dir="rtl"] #hhud .hh-toasts { right:auto; left:22px; align-items:flex-start; }
  #hhud .hh-toast { font: 400 34px/1 'Bebas Neue', 'Secular One', sans-serif; letter-spacing:1px; text-shadow:0 3px 0 #000; animation: hhtoast 2.2s ease-out forwards; }
  @keyframes hhtoast { 0% { opacity:0; transform:translateY(10px); } 12% { opacity:1; transform:none; } 80% { opacity:1; } 100% { opacity:0; transform:translateY(-14px); } }
  #hhud .hh-help { position:absolute; left:50%; bottom:22px; transform:translateX(-50%); font-size:17px; font-weight:600; color:rgba(255,255,255,.85); background:rgba(0,0,0,.45); padding:6px 14px; border-radius:8px; text-shadow:0 1px 2px #000; white-space:nowrap; transition: opacity .6s; }
  #hhud canvas.hh-touch { position:absolute; inset:0; width:100%; height:100%; }
  #hfade { position:absolute; inset:0; background:#000; opacity:0; pointer-events:none; z-index:7; transition: opacity .5s; }
  #hload { position:absolute; inset:0; z-index:8; background:#05030b center/cover no-repeat; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom:70px; }
  #hload::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,3,11,.1), rgba(5,3,11,.85) 75%); }
  #hload > * { position:relative; }
  #hload h1 { margin:0; font: 400 120px/0.9 'Bebas Neue', 'Secular One', sans-serif; letter-spacing:3px; color:#fff; text-shadow:0 0 30px rgba(255,45,149,.6), 0 6px 0 #000; }
  #hload p { margin:12px 0 16px; font-size:22px; color:var(--muted); }
  #hload .bar { width:420px; height:6px; background:rgba(255,255,255,.15); border-radius:3px; overflow:hidden; }
  #hload .bar i { display:block; height:100%; background:linear-gradient(90deg,var(--lava-2),var(--neon)); width:0; transition: width .3s; }
  #hload .tip { margin-top:18px; font-size:18px; color:#fff; opacity:.85; max-width:760px; text-align:center; }
  #hcut { position:absolute; inset:0; z-index:9; background:#000; }
  #hcut video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  #hcut .caption { bottom:70px; }
  #hcut .skip { top:20px; }
  `,
  init(stage) {
    if (this.ready) return; this.ready = true; this.stage = stage;
    const st = document.createElement('style'); st.textContent = this.CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('section'); el.id = 'hhud'; el.hidden = true;
    el.innerHTML = `
      <div class="hh-obj"><h4></h4><ul></ul></div>
      <div class="hh-tr"><div class="hh-money">$0</div><div class="hh-stars">${'<b>★</b>'.repeat(5)}</div></div>
      <div class="hh-toasts"></div>
      <div class="hh-help"></div>
      <div class="hh-banner"><h2></h2><p></p></div>
      <div class="hh-prompt" hidden></div>
      <div class="hh-bl"><canvas class="hh-radar" width="420" height="420"></canvas><div class="hh-bars"><div class="hh-bar hp"><i></i></div><div class="hh-bar car"><i></i></div></div></div>
      <div class="hh-speed" hidden><span>0</span><small>KM/H</small></div>
      <canvas class="hh-touch" width="1280" height="720" hidden></canvas>`;
    stage.appendChild(el);
    const q = s => el.querySelector(s);
    this.$ = { objT: q('.hh-obj h4'), objL: q('.hh-obj ul'), obj: q('.hh-obj'), money: q('.hh-money'), stars: q('.hh-stars'), toasts: q('.hh-toasts'), help: q('.hh-help'),
      banner: q('.hh-banner'), bT: q('.hh-banner h2'), bS: q('.hh-banner p'), prompt: q('.hh-prompt'), radar: q('.hh-radar'), hp: q('.hh-bar.hp i'), car: q('.hh-bar.car i'), carBar: q('.hh-bar.car'),
      speed: q('.hh-speed'), speedN: q('.hh-speed span'), touch: q('.hh-touch') };
    this.rctx = this.$.radar.getContext('2d'); this.tctx = this.$.touch.getContext('2d');
    const fade = document.createElement('div'); fade.id = 'hfade'; stage.appendChild(fade); this.$.fade = fade;
    const load = document.createElement('section'); load.id = 'hload'; load.className = 'screen'; load.hidden = true;
    load.innerHTML = `<h1>THE BIG SCORE</h1><p></p><div class="bar"><i></i></div><div class="tip"></div>`; stage.appendChild(load); this.$.load = load;
    const cut = document.createElement('section'); cut.id = 'hcut'; cut.className = 'screen'; cut.hidden = true;
    cut.innerHTML = `<video playsinline preload="auto"></video><div class="letterbox top"></div><div class="letterbox bottom"></div><div class="caption"></div><button class="btn ghost skip" type="button"></button>`;
    stage.appendChild(cut); this.$.cut = cut; this.$.cutV = cut.querySelector('video'); this.$.cutC = cut.querySelector('.caption'); this.$.cutSkip = cut.querySelector('.skip');
    this.$.cutSkip.addEventListener('click', () => this.endCut(true));
  },
  show(on) { if (this.el) this.el.hidden = !on; },
  radarVisible(on) { const bl = this.el && this.el.querySelector('.hh-bl'); if (bl) bl.style.display = on ? '' : 'none'; },

  /* ---------- objectives ---------- */
  setObjective(title, lines) {
    const $ = this.$; $.objT.textContent = title || '';
    $.obj.hidden = !title && !(lines && lines.length);
    $.objL.innerHTML = '';
    (lines || []).forEach(l => { const li = document.createElement('li'); li.className = l.done ? 'done' : l.cur ? 'cur' : ''; li.innerHTML = `<i>${l.done ? '✓' : ''}</i><span></span>`; li.querySelector('span').textContent = l.t; $.objL.appendChild(li); });
  },
  help(text) { this.$.help.textContent = text || ''; this.$.help.style.opacity = text ? 1 : 0; },
  /* ---------- money / wanted / bars / speed ---------- */
  setMoney(n) { if (n > this.money) { this.$.money.classList.remove('bump'); void this.$.money.offsetWidth; this.$.money.classList.add('bump'); } this.money = n; },
  tick(dt) {
    if (this.moneyShown !== this.money) {
      const d = this.money - this.moneyShown; this.moneyShown += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 6)));
      if (Math.abs(this.money - this.moneyShown) < 1) this.moneyShown = this.money;
      this.$.money.textContent = '$' + Math.round(this.moneyShown).toLocaleString('en-US');
    }
  },
  setWanted(n, flash) {
    const bs = this.$.stars.children; for (let k = 0; k < 5; k++) bs[k].classList.toggle('on', k < n);
    this.$.stars.classList.toggle('flash', !!flash && n > 0); this.$.stars.style.visibility = n > 0 ? 'visible' : 'hidden';
  },
  setBars(hp, car) { this.$.hp.style.transform = `scaleX(${HX.clamp(hp, 0, 1)})`; this.$.carBar.style.visibility = car === null ? 'hidden' : 'visible'; if (car !== null) this.$.car.style.transform = `scaleX(${HX.clamp(car, 0, 1)})`; },
  setSpeed(kmh) { if (kmh === null) { this.$.speed.hidden = true; return; } this.$.speed.hidden = false; const v = String(Math.round(kmh)); if (this.$.speedN.textContent !== v) this.$.speedN.textContent = v; },
  /* ---------- banners / prompts / toasts ---------- */
  banner(title, sub, cls, dur) {
    const $ = this.$; $.bT.textContent = title || ''; $.bS.textContent = sub || ''; $.banner.className = 'hh-banner ' + (cls || '');
    void $.banner.offsetWidth; $.banner.classList.add('show');
    clearTimeout(this._bt); if (dur !== 0) this._bt = setTimeout(() => $.banner.classList.remove('show'), (dur || 3) * 1000);
  },
  hideBanner() { this.$.banner.classList.remove('show'); },
  prompt(key, text) {
    const p = this.$.prompt; if (!text) { p.hidden = true; this._pk = null; return; }
    const k = key + '|' + text; if (this._pk === k && !p.hidden) return; this._pk = k;
    p.innerHTML = key ? `<kbd></kbd><span></span>` : `<span></span>`; if (key) p.querySelector('kbd').textContent = key; p.querySelector('span').textContent = text; p.hidden = false;
  },
  toast(text, color) { const d = document.createElement('div'); d.className = 'hh-toast'; d.textContent = text; d.style.color = color || '#fff'; this.$.toasts.appendChild(d); setTimeout(() => d.remove(), 2300); while (this.$.toasts.children.length > 4) this.$.toasts.firstChild.remove(); },
  fade(a, dur) { const f = this.$.fade; f.style.transitionDuration = (dur === undefined ? 0.5 : dur) + 's'; f.style.opacity = a; },
  loading(on, title, text, tip, p) {
    const l = this.$.load; l.hidden = !on; if (!on) return;
    l.style.backgroundImage = 'url(assets/heist_hotel.jpg)';
    if (title) l.querySelector('h1').textContent = title;
    if (text !== undefined) l.querySelector('p').textContent = text;
    if (tip !== undefined) l.querySelector('.tip').textContent = tip;
    if (p !== undefined) l.querySelector('.bar i').style.width = Math.round(p * 100) + '%';
  },

  /* ---------- radar (rotates with the camera, like the trailer's HUD) ---------- */
  radar(px, pz, yaw, blips, route) {
    const c = this.rctx, S = 420, R = S / 2, sc = 0.78; // px per metre (in the 420px canvas)
    c.save(); c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(R, R, R, 0, 6.283); c.clip();
    c.fillStyle = '#1b2a36'; c.fillRect(0, 0, S, S);
    c.translate(R, R); c.rotate(yaw); c.scale(sc, sc); c.translate(-px, -pz);
    // ocean east of the beach + water all around the causeway
    c.fillStyle = '#1d4f73'; c.fillRect(HX.OCEAN_X, -2000, 3000, 4000);
    c.fillStyle = '#c7b38a'; c.fillRect(HX.BEACH_X, -300, HX.OCEAN_X - HX.BEACH_X, 600);
    const I = HX.ISLAND; c.fillStyle = '#c7b38a'; c.fillRect(I.x0, I.z0, I.x1 - I.x0, I.z1 - I.z0);
    // blocks (dark) and parks (green)
    c.fillStyle = '#2c3d4b'; c.fillRect(-HX.HALF - 60, -HX.HALF - 60, HX.HALF * 2 + 120 + 7, HX.HALF * 2 + 120);
    c.fillStyle = '#26463a'; for (const k of HX.PARK_BLOCKS) { const [i, j] = k.split(',').map(Number); c.fillRect(HX.L(i) + 7, HX.L(j) + 7, HX.P - 14, HX.P - 14); }
    // roads
    c.strokeStyle = '#8b98a6'; c.lineWidth = 12; c.lineCap = 'square'; c.beginPath();
    for (let i = 0; i <= HX.N; i++) { const L = HX.L(i); c.moveTo(L, -HX.HALF); c.lineTo(L, HX.HALF); c.moveTo(-HX.HALF, L); c.lineTo(HX.HALF, L); }
    c.moveTo(HX.BRIDGE_X0, 0); c.lineTo(915, 0); c.stroke();
    // GPS route
    if (route && route.length > 1) { c.strokeStyle = '#c84dff'; c.lineWidth = 9; c.lineJoin = 'round'; c.beginPath(); c.moveTo(route[0].x, route[0].z); for (const p of route) c.lineTo(p.x, p.z); c.stroke(); }
    c.restore();
    // blips (kept upright, clamped to the rim)
    c.save(); c.beginPath(); c.arc(R, R, R, 0, 6.283); c.clip();
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const b of blips || []) {
      let dx = (b.x - px) * sc, dz = (b.z - pz) * sc; let x = dx * cs - dz * sn, y = dx * sn + dz * cs;
      const d = Math.hypot(x, y), edge = d > R - 16; if (edge) { if (!b.edge) continue; x *= (R - 16) / d; y *= (R - 16) / d; }
      x += R; y += R;
      c.fillStyle = b.col || '#fff';
      if (b.kind === 'police') { c.fillStyle = (Math.floor(performance.now() / 180) % 2) ? '#ff2d55' : '#2d7bff'; c.beginPath(); c.arc(x, y, 9, 0, 6.283); c.fill(); }
      else if (b.kind === 'goal') { c.strokeStyle = '#000'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 15, 0, 6.283); c.stroke(); c.fillStyle = '#ffd23f'; c.fill(); c.fillStyle = '#000'; c.font = '900 18px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.label || '★', x, y + 1); }
      else if (b.kind === 'cash') { c.fillStyle = '#5cf2a8'; c.beginPath(); c.arc(x, y, 7, 0, 6.283); c.fill(); }
      else { c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill(); }
    }
    // the player arrow (always pointing up = camera forward, rotated by the player's own heading offset)
    c.restore();
    c.save(); c.translate(R, R); c.rotate(this._arrow || 0);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -18); c.lineTo(13, 14); c.lineTo(0, 7); c.lineTo(-13, 14); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north marker
    const nx = R + Math.sin(-yaw) * -(R - 20) * 0, ny = 0; // (kept simple: N drawn at top-rotated position)
    const ax = R - Math.sin(yaw) * (R - 22), ay = R - Math.cos(yaw) * (R - 22);
    c.fillStyle = '#fff'; c.font = '900 26px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText('N', ax, ay); c.fillText('N', ax, ay);
  },
  setArrow(a) { this._arrow = a; },

  /* ---------- touch controls ---------- */
  drawTouch(on, sticks, btns) {
    const cv = this.$.touch; cv.hidden = !on; if (!on) return;
    const c = this.tctx; c.clearRect(0, 0, 1280, 720);
    for (const name of ['move', 'aim']) {
      const s = sticks[name], ox = s ? HX.clamp(s.ox, 80, 1200) : (name === 'move' ? 180 : 1280 - 330), oy = s ? HX.clamp(s.oy, 80, 640) : 720 - 170;
      c.globalAlpha = s ? 0.5 : 0.2; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(ox, oy, 70, 0, 6.283); c.stroke();
      if (s) { const v = Input.stickVec(name, 0); c.fillStyle = name === 'move' ? '#ffd23f' : '#e04dff'; c.beginPath(); c.arc(ox + v.x * 70, oy + v.y * 70, 30, 0, 6.283); c.fill(); }
      else { c.fillStyle = '#fff'; c.font = '700 20px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name === 'move' ? '✥' : '👁', ox, oy); }
    }
    for (const b of btns) {
      c.globalAlpha = b.on === false ? 0.25 : 0.5; c.fillStyle = b.col || '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283); c.fill();
      c.globalAlpha = 1; c.fillStyle = '#1a0a22'; c.font = '900 ' + (b.fs || 22) + 'px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.label, b.x, b.y + 1);
    }
    c.globalAlpha = 1;
  },

  /* ---------- video cutscenes (segments of assets/heist.mp4) ---------- */
  playCut(start, end, captions, done) {
    const $ = this.$, v = $.cutV; this._cutDone = done; this._cutEnd = end; this._caps = captions || []; this._capIdx = -1;
    if (!v.src) v.src = 'assets/heist.mp4';
    $.cut.hidden = false; $.cutC.classList.remove('show'); $.cutSkip.textContent = t('skip');
    v.muted = !(window.AudioSys && AudioSys.enabled);
    const go = () => { try { v.currentTime = start; } catch (e) {} const p = v.play(); if (p && p.catch) p.catch(err => { if (err && err.name === 'AbortError') return; v.muted = true; v.play().catch(() => this.endCut(true)); }); };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
    if (!this._cutBound) {
      this._cutBound = true;
      v.addEventListener('timeupdate', () => {
        if (this.$.cut.hidden) return;
        const ct = v.currentTime; let idx = -1;
        for (let k = 0; k < this._caps.length; k++) if (ct >= this._caps[k][0]) idx = k;
        if (idx !== this._capIdx) { this._capIdx = idx; $.cutC.classList.remove('show'); if (idx >= 0) setTimeout(() => { $.cutC.textContent = this._caps[idx][1]; $.cutC.classList.add('show'); }, 120); }
        if (ct >= this._cutEnd - 0.05) this.endCut(false);
      });
      v.addEventListener('ended', () => this.endCut(false));
      v.addEventListener('error', () => { if (!this.$.cut.hidden) this.endCut(true); });
    }
    // safety net: never get stuck in a cutscene
    clearTimeout(this._cutTO); this._cutTO = setTimeout(() => { if (!$.cut.hidden) this.endCut(true); }, (end - start + 6) * 1000);
    setTimeout(() => $.cutSkip.focus && $.cutSkip.focus(), 60);
  },
  cutActive() { return this.$.cut && !this.$.cut.hidden; },
  endCut(skipped) {
    if (this.$.cut.hidden) return;
    clearTimeout(this._cutTO); const v = this.$.cutV; if (!v.paused) v.pause();
    this.$.cut.hidden = true; this.$.cutC.classList.remove('show');
    const d = this._cutDone; this._cutDone = null; if (d) d(skipped);
  },
  muteCut(m) { if (this.$.cutV) this.$.cutV.muted = m; },
};
