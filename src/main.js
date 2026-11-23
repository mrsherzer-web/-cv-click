/* Main: screens, HUD, loop. */
(function () {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('game');
  const screens = ['splash', 'intro', 'title', 'howto', 'levelup', 'pause', 'over'];
  let best = 0;
  try { best = parseInt(localStorage.getItem('kotc_best') || '0', 10) || 0; } catch (e) {}

  /* ---------- layout: keep 16:9, letterbox ---------- */
  function fit() {
    const w = window.innerWidth, h = window.innerHeight, s = Math.min(w / 1280, h / 720);
    const x = (w - 1280 * s) / 2, y = (h - 720 * s) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    // render the canvas at device resolution for crisp sprites
    const dpr = Math.min(2, window.devicePixelRatio || 1), k = Math.max(1, Math.min(2, s * dpr));
    const cw = Math.round(1280 * k), ch = Math.round(720 * k);
    if (canvas.width !== cw) { canvas.width = cw; canvas.height = ch; }
    G.ctx.setTransform(k, 0, 0, k, 0, 0);
  }

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
    video.currentTime = 0; video.muted = false;
    const p = video.play();
    if (p && p.catch) p.catch(() => { video.muted = true; video.play().catch(goTitle); });
  }
  video.addEventListener('timeupdate', () => {
    const caps = I18N[LANG].captions; let idx = -1;
    for (let i = 0; i < caps.length; i++) if (video.currentTime >= caps[i][0]) idx = i;
    if (idx !== capIdx) {
      capIdx = idx; cap.classList.remove('show');
      if (idx >= 0) setTimeout(() => { cap.textContent = caps[idx][1]; cap.classList.add('show'); }, 180);
    }
  });
  video.addEventListener('ended', goTitle);
  video.addEventListener('error', () => { if (!$('intro').hidden) goTitle(); });
  $('btnSkip').addEventListener('click', goTitle);

  function goTitle() {
    if (!video.paused) video.pause();
    cap.classList.remove('show');
    G.state = 'title'; G.player = null; G.enemies.length = 0; G.bullets.length = 0; G.ebullets.length = 0; G.pickups.length = 0; G.hazards.length = 0; G.boss = null;
    FX.reset();
    show('title'); $('hud').hidden = true;
    $('bestLine').textContent = best ? t('best', { n: best.toLocaleString() }) : '';
    AudioSys.setIntensity(0, false); AudioSys.startMusic(); AudioSys.setMusicVolume(0.42);
    setTimeout(() => $('btnStart').focus(), 50);
  }

  /* ---------- title menu ---------- */
  $('btnStart').addEventListener('click', startGame);
  $('btnHow').addEventListener('click', () => { AudioSys.sfx('click'); show('howto'); $('btnHowBack').focus(); });
  $('btnHowBack').addEventListener('click', () => { AudioSys.sfx('click'); show('title'); });
  $('btnLang').addEventListener('click', () => { AudioSys.sfx('click'); setLang(LANG === 'he' ? 'en' : 'he'); $('bestLine').textContent = best ? t('best', { n: best.toLocaleString() }) : ''; });
  $('btnSound').addEventListener('click', () => { const on = AudioSys.toggle(); $('btnSound').textContent = on ? '🔊' : '🔇'; });
  $('btnFull').addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) { const r = el.requestFullscreen(); if (r && r.catch) r.catch(() => {}); }
    } catch (e) {}
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
      el.addEventListener('click', () => pickCard(i));
      box.appendChild(el);
    });
    overlay('levelup', true);
    AudioSys.setMusicVolume(0.2);
    setTimeout(() => { const f = box.querySelector('.card'); if (f) f.focus(); }, 380);
  };
  function pickCard(i) {
    if (G.state !== 'levelup' || performance.now() - cardsAt < 350 || !currentChoices[i]) return;
    G.applyUpgrade(currentChoices[i]);
    overlay('levelup', false); AudioSys.setMusicVolume(0.42);
    // chained level-ups (big xp drops)
    const p = G.player;
    if (p.xp >= p.xpNext) { p.xp -= p.xpNext; p.level++; p.xpNext = Math.floor(14 + p.level * 7 + p.level * p.level * 1.1); setTimeout(() => { if (G.state === 'playing') G.levelUp(); }, 250); }
  }

  /* ---------- pause ---------- */
  function pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused'; overlay('pause', true); AudioSys.setMusicVolume(0.15);
    $('pauseStats').innerHTML = statsHTML();
    $('btnResume').focus();
  }
  function resume() { if (G.state !== 'paused') return; G.state = 'playing'; overlay('pause', false); AudioSys.setMusicVolume(0.42); }
  $('btnResume').addEventListener('click', resume);
  $('btnQuit').addEventListener('click', () => { overlay('pause', false); goTitle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

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
    setIf('hpFill', 'transform', `scaleX(${Math.max(0, p.hp / p.maxhp).toFixed(3)})`);
    setIf('hpText', 'text', `${Math.ceil(p.hp)} / ${p.maxhp}`);
    setIf('xpFill', 'transform', `scaleX(${Math.min(1, p.xp / p.xpNext).toFixed(3)})`);
    setIf('xpText', 'text', `LV ${p.level}`);
    setIf('dashFill', 'transform', `scaleX(${(1 - p.dashCd / p.dashCdMax).toFixed(2)})`);
    setIf('spFill', 'transform', `scaleX(${p.special.toFixed(3)})`);
    const ready = p.special >= 1;
    document.querySelector('.meter.special').classList.toggle('ready', ready);
    if (ready && !spReadyShown) { spReadyShown = true; G.announce(t('specialReady'), '#ffd23f'); AudioSys.sfx('select'); }
    if (!ready) spReadyShown = false;
    setIf('waveText', 'text', G.endless ? t('endless', { n: G.wave }) : t('wave', { n: G.wave }) + ' / 15');
    const wd = G.waveDef;
    setIf('waveTimer', 'text', wd && isFinite(wd.duration) ? fmtTime(Math.max(0, wd.duration - G.waveT)) : '☠');
    setIf('scoreText', 'text', G.score.toLocaleString());
    setIf('comboText', 'text', G.combo >= 5 ? `x${G.combo} COMBO` : '');
    if (G.boss) {
      $('bossBar').hidden = false;
      setIf('bossName', 'text', I18N[LANG].enemies[G.boss.type]);
      setIf('bossFill', 'transform', `scaleX(${Math.max(0, G.boss.hp / G.boss.maxhp).toFixed(3)})`);
    } else $('bossBar').hidden = true;
    const sig = p.weapons.map(w => w.id + w.lvl).join() + '|' + Object.entries(p.passives).map(e => e.join('')).join();
    if (sig !== weaponSig) {
      weaponSig = sig;
      const row = $('weaponsRow'); row.innerHTML = '';
      p.weapons.forEach(w => { const d = document.createElement('div'); d.className = 'w'; d.innerHTML = `${WEAPONS[w.id].icon}<b>${w.lvl}</b>`; row.appendChild(d); });
      Object.entries(p.passives).forEach(([id, l]) => { const d = document.createElement('div'); d.className = 'w'; d.style.opacity = '.75'; d.innerHTML = `${PASSIVES[id].icon}<b>${l}</b>`; row.appendChild(d); });
    }
  }

  /* ---------- loop ---------- */
  let prev = performance.now();
  function frame(now) {
    let real = Math.min(0.05, (now - prev) / 1000); prev = now;
    // global keys
    if (Input.wasPressed('Escape') || Input.wasPressed('KeyP')) { if (G.state === 'playing') pause(); else if (G.state === 'paused') resume(); }
    if (G.state === 'levelup') { ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (Input.wasPressed(k)) pickCard(i); }); }
    if (G.state === 'title' && !$('title').hidden && Input.wasPressed('Enter')) startGame();

    FX.update(real);
    if (G.state === 'playing') {
      const dt = real * FX.timeScale();
      if (dt > 0) G.update(dt); else G.time += 0;
    } else if (G.state === 'over' || G.state === 'title') {
      G.time += real;
      for (const s of G.smokeLayer) { s.x += s.vx * real; s.y += s.vy * real; if (s.y < -s.r) { s.y = 720 + s.r; } }
    }
    G.draw(now / 1000);
    hud();
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  G.init(canvas);
  Input.init(stage, canvas);
  applyLang();
  fit();
  window.addEventListener('resize', fit);
  show('splash');
  if (document.fonts && document.fonts.load) { document.fonts.load('400 40px "Secular One"'); document.fonts.load('900 20px Rubik'); }
  requestAnimationFrame(t0 => { prev = t0; requestAnimationFrame(frame); });

  // debug hook for automated playtests
  window.__KOTC = { G, Input, AudioSys, FX, startGame, goTitle };
})();
