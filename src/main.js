/* Main: screens, HUD, loop. */
(function () {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('game');
  const screens = ['splash', 'intro', 'title', 'howto', 'levelup', 'pause', 'over'];
  let best = 0;
  try { best = parseInt(localStorage.getItem('kotc_best') || '0', 10) || 0; } catch (e) {}

  /* ---------- layout: keep 16:9, letterbox ---------- */
  function fit() {
    // fit inside any safe-area padding the host puts on the root element (phone notches / system bars)
    const cs = getComputedStyle(document.documentElement);
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const w = Math.max(1, window.innerWidth - pl - pr), h = Math.max(1, window.innerHeight - pt - pb), s = Math.min(w / 1280, h / 720);
    const x = pl + (w - 1280 * s) / 2, y = pt + (h - 720 * s) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    stage.style.setProperty('--u', Math.min(1.5, Math.max(1, 0.8 / s)).toFixed(3));
    stage.classList.toggle('compact', s < 0.75);
    // render the canvas at device resolution for crisp sprites
    const dpr = Math.min(2, window.devicePixelRatio || 1), k = Math.max(1, Math.min(2, s * dpr));
    const cw = Math.round(1280 * k), ch = Math.round(720 * k);
    if (canvas.width !== cw) { canvas.width = cw; canvas.height = ch; drewFrozen = false; }
    G.ctx.setTransform(k, 0, 0, k, 0, 0);
    if (h > w && w <= 600 && window.matchMedia && matchMedia('(pointer: coarse)').matches) pause(); // phone turned to portrait
  }
  let drewFrozen = false;

  function show(name) { screens.forEach(s => { $(s).hidden = s !== name; }); }
  function overlay(name, on) { $(name).hidden = !on; }

  /* ---------- splash → intro → title ---------- */
  $('btnSplash').addEventListener('click', () => {
    AudioSys.init(); AudioSys.resume(); AudioSys.sfx('click');
    playIntro();
  });
  const video = $('introVideo'), cap = $('caption');
  let capIdx = -1;
  function playIntro() {
    show('intro'); capIdx = -1;
    video.currentTime = 0; video.muted = !AudioSys.enabled;
    const p = video.play();
    if (p && p.catch) p.catch(err => {
      if ($('intro').hidden || (err && err.name === 'AbortError')) return; // skipped while loading: never restart it
      video.muted = true; // autoplay with sound refused: play muted
      video.play().catch(() => { if (!$('intro').hidden) goTitle(); });
    });
    setTimeout(() => $('btnSkip').focus(), 50);
  }
  video.addEventListener('timeupdate', () => {
    const caps = I18N[LANG].captions; let idx = -1;
    for (let i = 0; i < caps.length; i++) if (video.currentTime >= caps[i][0]) idx = i;
    if (idx !== capIdx) {
      capIdx = idx; cap.classList.remove('show');
      if (idx >= 0) setTimeout(() => { cap.textContent = caps[idx][1]; cap.classList.add('show'); }, 180);
    }
  });
  video.addEventListener('ended', () => { if (!$('intro').hidden) goTitle(); });
  video.addEventListener('error', () => { if (!$('intro').hidden) goTitle(); });
  $('btnSkip').addEventListener('click', goTitle);

  function goTitle() {
    if (!video.paused) video.pause();
    cap.classList.remove('show');
    G.state = 'title'; G.player = null; G.enemies.length = 0; G.bullets.length = 0; G.ebullets.length = 0; G.pickups.length = 0; G.hazards.length = 0;
    G.boss = null; G.bossPending = false; G.corpse = null; G.buddy = null; G.laughT = 0; G.intermission = 0; G.neonFlicker = 1;
    overlay('levelup', false); overlay('pause', false); overlay('over', false);
    FX.reset();
    show('title'); $('hud').hidden = true;
    $('bestLine').textContent = best ? t('best', { n: best.toLocaleString() }) : '';
    AudioSys.setIntensity(0, false); AudioSys.startMusic(); AudioSys.setMusicVolume(0.42);
    setTimeout(() => $('btnStart').focus(), 50);
  }

  /* ---------- title menu ---------- */
  $('btnStart').addEventListener('click', startGame);
  $('btnHow').addEventListener('click', () => { AudioSys.sfx('click'); show('howto'); $('btnHowBack').focus(); });
  function closeHow() { AudioSys.sfx('click'); show('title'); $('btnHow').focus(); }
  $('btnHowBack').addEventListener('click', closeHow);
  document.querySelectorAll('.lang-toggle').forEach(b => b.addEventListener('click', () => {
    AudioSys.sfx('click'); setLang(LANG === 'he' ? 'en' : 'he');
    $('bestLine').textContent = best ? t('best', { n: best.toLocaleString() }) : '';
  }));
  function syncSound() { document.querySelectorAll('.sound-toggle').forEach(b => { b.textContent = AudioSys.enabled ? '🔊' : '🔇'; }); }
  function toggleSound() { AudioSys.toggle(); video.muted = !AudioSys.enabled; syncSound(); }
  document.querySelectorAll('.sound-toggle').forEach(b => b.addEventListener('click', toggleSound));
  // fullscreen (hidden where the browser has none, e.g. iPhone Safari)
  const fsEl = document.documentElement, fsReq = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
  if (!fsReq) $('btnFull').hidden = true;
  $('btnFull').addEventListener('click', () => {
    const cur = document.fullscreenElement || document.webkitFullscreenElement;
    try { const r = cur ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : fsReq.call(fsEl); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  });

  function startGame() {
    AudioSys.init(); AudioSys.resume(); AudioSys.sfx('select');
    show(null); $('hud').hidden = false;
    G.newRun(); weaponSig = ''; spReadyShown = false;
    AudioSys.startMusic(); AudioSys.setMusicVolume(0.42);
    canvas.focus && canvas.focus();
  }

  /* ---------- level up ---------- */
  let cardsAt = 0, currentChoices = [];
  G.levelUpCb = (choices) => {
    currentChoices = choices; cardsAt = performance.now();
    const p = G.player;
    const box = $('cards'); box.innerHTML = '';
    choices.forEach((c, i) => {
      const isW = c.kind === 'weapon', def = isW ? WEAPONS[c.id] : PASSIVES[c.id];
      const txt = isW ? I18N[LANG].weapons[c.id] : I18N[LANG].passives[c.id];
      const isNew = c.lvl === 1;
      const el = document.createElement('button');
      el.className = 'card' + (isNew && isW ? ' new' : '');
      el.type = 'button';
      el.innerHTML = `<div class="ico">${def.icon}</div>
        <div class="lvl ${isNew && isW ? 'new' : ''}">${isNew && isW ? t('newWeapon') : (c.lvl >= def.max ? t('max') : t('lvl', { n: c.lvl }))}</div>
        <h3></h3><p></p><kbd>${i + 1}</kbd>`;
      el.querySelector('h3').textContent = txt[0];
      el.querySelector('p').textContent = (isW && !isNew) ? txt[2] : txt[1];
      // a passive that completes an evolution pair gets a hint
      if (!isW) { const w = p.weapons.find(x => !x.evo && EVOLVE[x.id] === c.id); if (w) { const h = document.createElement('div'); h.className = 'evo'; h.textContent = t('evoHint', { name: I18N[LANG].weapons[w.id][0] }); el.querySelector('p').after(h); } }
      el.addEventListener('click', () => pickCard(i));
      box.appendChild(el);
    });
    overlay('levelup', true);
    AudioSys.setMusicVolume(0.2);
    setTimeout(() => { const f = box.querySelector('.card'); if (f) f.focus(); }, 380);
  };
  function pickCard(i) {
    if (G.state !== 'levelup' || performance.now() - cardsAt < 350 || !currentChoices[i]) return;
    G.applyUpgrade(currentChoices[i]); currentChoices = [];
    overlay('levelup', false); AudioSys.setMusicVolume(0.42);
    // further queued level-ups fire from G.update on the next frame
  }

  /* ---------- pause ---------- */
  function pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused'; overlay('pause', true); AudioSys.setMusicVolume(0.15);
    $('pauseStats').innerHTML = statsHTML();
    $('btnResume').focus();
  }
  function resume() { if (G.state !== 'paused') return; AudioSys.resume(); G.state = 'playing'; overlay('pause', false); AudioSys.setMusicVolume(0.42); }
  $('btnResume').addEventListener('click', resume);
  $('btnQuit').addEventListener('click', () => { overlay('pause', false); goTitle(); });
  $('btnPause').addEventListener('click', () => { $('btnPause').blur(); pause(); });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); AudioSys.suspend(); } else AudioSys.resume(); });
  // iOS can leave the audio context 'interrupted' (calls, lock screen): wake it on the next touch or key
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, () => AudioSys.resume(), true));

  /* ---------- game over / victory ---------- */
  function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function statsHTML() {
    const p = G.player, rows = [
      [t('s_score'), G.score.toLocaleString()], [t('s_wave'), G.wave], [t('s_kills'), G.kills.toLocaleString()], [t('s_time'), fmtTime(G.runTime)],
      [t('s_level'), p ? p.level : 1], [t('s_combo'), G.maxCombo], [t('s_dmg'), G.dmgDealt.toLocaleString()],
    ];
    return rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  }
  G.overCb = (won) => {
    overlay('levelup', false);
    $('overTitle').textContent = won ? t('victory') : t('gameover');
    $('overText').textContent = won ? t('victoryText') : t('gameoverText');
    $('overStats').innerHTML = statsHTML();
    let isBest = false;
    if (G.score > best) { best = G.score; isBest = true; try { localStorage.setItem('kotc_best', String(best)); } catch (e) {} }
    $('overBest').textContent = isBest ? t('newBest') : t('best', { n: best.toLocaleString() });
    $('btnEndless').hidden = !won;
    overlay('over', true); $('hud').hidden = true;
    AudioSys.setMusicVolume(0.2);
    setTimeout(() => (won ? $('btnEndless') : $('btnAgain')).focus(), 100);
  };
  $('btnAgain').addEventListener('click', () => { overlay('over', false); startGame(); });
  $('btnMenu').addEventListener('click', () => { overlay('over', false); goTitle(); });
  $('btnEndless').addEventListener('click', () => {
    overlay('over', false); $('hud').hidden = false; AudioSys.setMusicVolume(0.42);
    G.state = 'playing'; G.endless = true; G.nextWave();
  });

  /* ---------- HUD ---------- */
  let annT = null, weaponSig = '', spReadyShown = false, last = {};
  G.announceCb = (txt, color) => {
    const a = $('announce'); a.textContent = txt; a.style.color = color || '#fff';
    a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
    clearTimeout(annT); annT = setTimeout(() => a.classList.remove('show'), 1700);
  };
  function setIf(id, prop, val) { const k = id + prop; if (last[k] === val) return; last[k] = val; if (prop === 'text') $(id).textContent = val; else $(id).style[prop] = val; }
  function hud() {
    const p = G.player; if (!p) return;
    if (last.touch !== Input.touchMode) { last.touch = Input.touchMode; $('hud').classList.toggle('touch', Input.touchMode); stage.classList.toggle('touch', Input.touchMode); }
    setIf('hpFill', 'transform', `scaleX(${Math.max(0, p.hp / p.maxhp).toFixed(3)})`);
    setIf('hpText', 'text', `${Math.ceil(p.hp)} / ${p.maxhp}`);
    setIf('xpFill', 'transform', `scaleX(${Math.min(1, p.xp / p.xpNext).toFixed(3)})`);
    setIf('xpText', 'text', t('lvl', { n: p.level }));
    setIf('dashFill', 'transform', `scaleX(${(1 - p.dashCd / p.dashCdMax).toFixed(2)})`);
    setIf('spFill', 'transform', `scaleX(${p.special.toFixed(3)})`);
    const ready = p.special >= 1;
    document.querySelector('.meter.special').classList.toggle('ready', ready);
    if (ready && !spReadyShown) { spReadyShown = true; G.announce(t('specialReady'), '#ffd23f'); AudioSys.sfx('select'); }
    if (!ready) spReadyShown = false;
    setIf('waveText', 'text', G.endless ? t('endless', { n: G.wave }) : t('wave', { n: G.wave }) + ' / 15');
    const wd = G.waveDef;
    setIf('waveTimer', 'text', G.intermission > 0 ? '✓' : wd && isFinite(wd.duration) ? fmtTime(Math.max(0, wd.duration - G.waveT)) : '☠');
    setIf('scoreText', 'text', G.score.toLocaleString());
    setIf('comboText', 'text', G.combo >= 5 ? t('combo', { n: G.combo }) : '');
    if (G.boss) {
      $('bossBar').hidden = false;
      setIf('bossName', 'text', I18N[LANG].enemies[G.boss.type]);
      setIf('bossFill', 'transform', `scaleX(${Math.max(0, G.boss.hp / G.boss.maxhp).toFixed(3)})`);
    } else $('bossBar').hidden = true;
    const sig = LANG + p.weapons.map(w => w.id + w.lvl + (w.evo ? '*' : '')).join() + '|' + Object.entries(p.passives).map(e => e.join('')).join();
    if (sig !== weaponSig) {
      weaponSig = sig;
      const row = $('weaponsRow'); row.innerHTML = '';
      p.weapons.forEach(w => { const d = document.createElement('div'); d.className = 'w' + (w.evo ? ' evo' : ''); d.innerHTML = `${WEAPONS[w.id].icon}<b>${w.evo ? '★' : w.lvl}</b>`; row.appendChild(d); });
      Object.entries(p.passives).forEach(([id, l]) => { const d = document.createElement('div'); d.className = 'w'; d.style.opacity = '.75'; d.innerHTML = `${PASSIVES[id].icon}<b>${l}</b>`; row.appendChild(d); });
    }
  }

  /* ---------- loop ---------- */
  let prev = performance.now();
  const splashEl = $('splash'), introEl = $('intro'), titleEl = $('title'), howEl = $('howto'), lvEl = $('levelup'), overEl = $('over');
  function frame(now) {
    requestAnimationFrame(frame); // scheduled first: one bad frame can never stop the loop
    try {
      const real = Math.min(0.05, (now - prev) / 1000); prev = now;
      // global keys
      if (Input.wasPressed('Escape') || Input.wasPressed('KeyP')) {
        if (G.state === 'playing') pause(); else if (G.state === 'paused') resume();
        else if (!introEl.hidden) goTitle(); else if (!howEl.hidden) closeHow();
      }
      if (Input.wasPressed('KeyM')) toggleSound();
      if (G.state === 'levelup') { ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (Input.wasPressed(k)) pickCard(i); }); }
      if (G.state === 'title' && !titleEl.hidden && Input.wasPressed('Enter')) startGame();

      FX.update(real);
      if (G.state === 'playing' || (G.state === 'over' && !G.won && FX.slow > 0)) {
        // (after death the world keeps moving in slow motion for a moment)
        const dt = real * FX.timeScale();
        if (dt > 0) G.update(dt);
      } else if (G.state === 'over' || G.state === 'title') {
        G.time += real;
        for (const s of G.smokeLayer) { s.x += s.vx * real; s.y += s.vy * real; if (s.y < -s.r) { s.y = 720 + s.r; } }
      }
      // skip drawing when the canvas is covered (splash/intro) or frozen under a blurred overlay
      const covered = !splashEl.hidden || !introEl.hidden;
      const frozen = !lvEl.hidden || G.state === 'paused' || (!overEl.hidden && FX.slow <= 0 && G.time - G.overAt > 0.35); // let the death fall finish first
      if (!covered && !(frozen && drewFrozen)) G.draw(now / 1000);
      drewFrozen = frozen && !covered;
      hud();
    } catch (err) { console.error(err); }
    finally { Input.endFrame(); }
  }

  /* ---------- boot ---------- */
  G.init(canvas);
  Input.init(stage, canvas);
  applyLang();
  syncSound();
  fit();
  window.addEventListener('resize', fit);
  show('splash');
  setTimeout(() => $('btnSplash').focus(), 50);
  if (document.fonts && document.fonts.load) { document.fonts.load('400 40px "Secular One"'); document.fonts.load('900 20px Rubik'); }
  requestAnimationFrame(t0 => { prev = t0; requestAnimationFrame(frame); });

  // debug hook for automated playtests
  window.__KOTC = { G, Input, AudioSys, FX, startGame, goTitle };
})();
