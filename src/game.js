/* The simulation: player, weapons, enemies, bosses, waves, pickups, rendering of the arena. */
const W = 1280, H = 720, FLOOR_TOP = 300, FLOOR_BOT = 690;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const depthScale = y => 0.8 + 0.4 * clamp((y - FLOOR_TOP) / (FLOOR_BOT - FLOOR_TOP), 0, 1);

const G = {
  canvas: null, ctx: null, bg: {}, bgReady: false,
  state: 'title', time: 0, runTime: 0, laughT: 0, neonFlicker: 1,
  player: null, enemies: [], bullets: [], ebullets: [], pickups: [], hazards: [], boss: null,
  wave: 0, waveT: 0, waveDef: null, spawnT: 0, bossPending: false, endless: false, won: false,
  score: 0, kills: 0, combo: 0, comboT: 0, maxCombo: 0, dmgDealt: 0, idc: 1,
  smokeLayer: [], announceCb: null, levelUpCb: null, overCb: null, hudCb: null,

  init(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    const names = ['room', 'smoke', 'laugh', 'chill'];
    let loaded = 0;
    names.forEach(n => { const im = new Image(); im.onload = () => { if (++loaded === names.length) this.bgReady = true; }; im.src = `assets/bg_${n}.jpg`; this.bg[n] = im; });
    for (let i = 0; i < 7; i++) this.smokeLayer.push({ x: rnd(0, W), y: rnd(80, H), r: rnd(120, 260), vx: rnd(-12, 12), vy: rnd(-8, -2), a: rnd(0.04, 0.09), ph: rnd(0, 6.28) });
  },

  /* ---------- run lifecycle ---------- */
  newRun() {
    this.player = {
      x: 640, y: 560, r: 20, face: 1, scale: 1, moving: false, hp: 100, maxhp: 100, speed: 255,
      level: 1, xp: 0, xpNext: this.xpFor(1), weapons: [{ id: 'ring', lvl: 1, cd: 0.2 }], passives: {},
      dmgMul: 1, rateMul: 1, magnet: 95, regen: 0, crit: 0.05, armor: 0, xpMul: 1,
      dashCd: 0, dashCdMax: 1.3, dashT: 0, dashX: 1, dashY: 0, hurtT: 0, special: 0, aim: { x: 1, y: 0 },
      orbitA: 0, auraTick: 0, vx: 0, vy: 0, kx: 0, ky: 0, t: 0, deathK: 0,
    };
    this.enemies.length = 0; this.bullets.length = 0; this.ebullets.length = 0; this.pickups.length = 0; this.hazards.length = 0;
    this.boss = null; this.bossPending = false; this.corpse = null; this.buddy = null; this.overAt = 0; this.goldDone = false; this.intermission = 0;
    this.wave = 0; this.waveT = 0; this.spawnT = 0; this.endless = false; this.won = false;
    this.score = 0; this.kills = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0; this.dmgDealt = 0; this.runTime = 0; this.laughT = 0;
    FX.reset();
    this.state = 'playing';
    this.nextWave();
  },
  nextWave() {
    this.wave++; this.waveT = 0; this.waveDef = waveDef(this.wave); this.spawnT = 0.8; this.goldDone = false;
    this.intermission = 0; this.bossPending = !!this.waveDef.boss; // a wave transition always starts clean
    if (this.wave > 15) this.endless = true;
    if (this.waveDef.boss) { this.announce(t('bossIncoming'), '#ff4d6d'); AudioSys.sfx('boss'); FX.doShake(6); }
    else { this.announce(this.endless ? t('endless', { n: this.wave }) : t('waveStart', { n: this.wave })); AudioSys.sfx('wave'); }
    AudioSys.setIntensity(this.wave < 3 ? 0 : this.wave < 6 ? 1 : this.wave < 11 ? 2 : 3, !!this.waveDef.boss);
  },
  announce(txt, color) { if (this.announceCb) this.announceCb(txt, color); },
  xpFor(l) { return Math.floor(5 + 4 * l + 2.3 * l * l); },
  orbitCount(w) { return WEAPONS.orbit.count(w.lvl) + (w.evo ? 2 : 0); },
  auraR(w) { return WEAPONS.aura.radius(w.lvl) * (w.evo ? 1.4 : 1); },
  // hit ellipse: bosses are much taller than wide, so a circle at the feet would leave the face unhittable
  hitTest(e, x, y, r) {
    const s = e.scale, hw = (e.def.hw || e.r) * s, hh = (e.def.hh || e.r) * s;
    const dx = (x - e.x) / (hw + r), dy = (y - (e.y - hh)) / (hh + r);
    return dx * dx + dy * dy < 1;
  },
  aimY(e) { return e.y - (e.def.hh || e.r) * e.scale; },

  /* ---------- helpers used by weapons ---------- */
  addBullet(b) { b.id = this.idc++; b.hit = new Set(); b.t = 0; this.bullets.push(b); },
  nearestEnemies(x, y, n, maxDist) {
    const list = [];
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || e.phased) continue; const d = Math.hypot(e.x - x, e.y - y); if (d <= maxDist) list.push([d, e]); }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map(v => v[1]);
  },
  shockwave(x, y, radius, dmg, kb, color) {
    FX.ring(x, y, radius, color || '#fff', 0.45, 6); FX.ring(x, y, radius * 0.6, color || '#fff', 0.3, 3);
    FX.doShake(5);
    if (!dmg) return; // visual-only rings (Big Laugh, King's chomp)
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < radius + e.r) this.hitEnemy(e, dmg, dx / d * kb, dy / d * kb, false);
    }
  },

  /* ---------- damage ---------- */
  hitEnemy(e, dmg, kx, ky, canCrit, quiet) {
    if (e.dead || e.spawnT > 0 || e.phased || this.state === 'over') return false; // the death slow-mo is for show only
    const p = this.player; let crit = false;
    dmg *= p.dmgMul;
    if (canCrit && Math.random() < p.crit) { dmg *= 2.5; crit = true; }
    if (e.elite) dmg *= 0.85;
    dmg = Math.round(dmg);
    e.hp -= dmg; e.hitT = 0.1; this.dmgDealt += dmg;
    const m = e.def.mass; e.kx += (kx || 0) / m; e.ky += (ky || 0) / m;
    if (crit || (!quiet && !(e.numT > 0))) { // throttled per enemy so big fights don't drown in numbers
      e.numT = 0.22;
      FX.text(e.x + rnd(-10, 10), e.y - e.r * 2 * e.scale - 10, String(dmg), crit ? '#ffd23f' : '#fff', crit ? 26 : 17);
      FX.sparks(e.x, e.y - e.r * e.scale, crit ? 10 : 4, e.def.color, 220);
    }
    AudioSys.sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0) this.killEnemy(e);
    return true;
  },
  killEnemy(e) {
    if (e.dead) return; e.dead = true;
    if (this.state === 'over') { FX.burst(e.x, e.y - e.r * e.scale, 10, e.def.color, 240); return; } // e.g. a fuse running out after death: no score, drops or BOSS DOWN
    const p = this.player, def = e.def, y = e.y - e.r * e.scale;
    this.kills++; this.combo++; this.comboT = 2.2; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const mult = 1 + Math.min(3, this.combo * 0.05) ;
    this.score += Math.round(def.score * mult * (e.elite ? 3 : 1) * (e.small ? 0.3 : 1));
    p.special = Math.min(1, p.special + (def.boss ? 0.15 : 0.012));
    FX.burst(e.x, y, def.boss ? 60 : 10, def.color, def.boss ? 500 : 240);
    FX.crumbs(e.x, y, def.boss ? 40 : 6, def.color);
    if (def.boss) FX.smoke(e.x, y, 20, 'rgba(230,210,255,1)', 40);
    else { FX.ring(e.x, y, 30 * e.scale, '#fff', 0.2, 4); FX.spawn({ x: e.x, y, r: 16 * e.scale, life: 0.09, color: '#fff' }); }
    AudioSys.sfx(def.boss ? 'bossdie' : 'kill');
    if (e.type === 'goldbag') {
      // treasure: a chest (evolves a ready weapon, otherwise a free level), a pizza and a shower of xp
      this.pickups.push({ kind: 'chest', x: e.x, y: clamp(e.y, FLOOR_TOP + 20, FLOOR_BOT - 10), vx: 0, vy: -120, t: 0, scale: 1, life: 40 });
      this.pickups.push({ kind: 'pizza', x: e.x + 30, y: e.y, vx: 60, vy: -80, t: 0, scale: 1, life: 25 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; this.pickups.push({ kind: 'xp', value: Math.max(2, Math.ceil(p.xpNext / 10)), x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, t: 0, scale: 1, life: 30 }); }
      FX.text(e.x, y - 30, '$$$', '#ffd23f', 34, { font: 'Secular One' }); FX.ring(e.x, y, 120, '#ffd23f', 0.5, 6);
      AudioSys.sfx('levelup');
    }
    // xp drops
    let xp = def.xp * (e.elite ? 4 : 1) * (e.small ? 0.5 : 1);
    const drops = def.boss ? 12 : e.elite ? 4 : 1;
    for (let i = 0; i < drops; i++) {
      const a = Math.random() * 6.283, s = def.boss ? rnd(80, 260) : rnd(30, 120);
      this.pickups.push({ kind: 'xp', value: Math.max(1, Math.round(xp / drops)), x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, scale: 1, life: 30 });
    }
    const roll = Math.random();
    const extra = def.boss ? 'lamp' : e.type === 'goldbag' ? null : e.elite ? (roll < 0.15 ? 'pizza' : roll < 0.3 ? 'bag' : null) : roll < 0.005 ? 'pizza' : roll < 0.009 ? 'bag' : roll < 0.011 ? 'lamp' : null;
    if (extra) this.pickups.push({ kind: extra, x: e.x, y: e.y, vx: rnd(-60, 60), vy: -80, t: 0, scale: 1, life: 25 });
    if (e.type === 'blob' && !e.small) for (let i = 0; i < 2; i++) this.spawnEnemy('blob', e.x + rnd(-20, 20), e.y + rnd(-10, 10), { small: true, instant: true });
    if (e.type === 'lighter' && !e.exploded) this.explodeLighter(e, false); // killed by you: hurts enemies, never you
    if (def.boss) this.bossKilled(e);
    if (this.combo > 1 && this.combo % 10 === 0) FX.text(e.x, y - 40, t('combo', { n: this.combo }), '#ff2d95', 24, { font: 'Secular One' });
  },
  explodeLighter(e, hurtsPlayer) {
    e.exploded = true;
    const R = 95;
    FX.burst(e.x, e.y - 20, 30, '#ff9d00', 400); FX.ring(e.x, e.y - 20, R, '#ffb347', 0.4, 6); FX.doShake(8); FX.doFlash(0.15, '#ffb347');
    AudioSys.sfx('explode');
    const p = this.player;
    if (hurtsPlayer !== false && Math.hypot(p.x - e.x, p.y - e.y) < R + p.r) this.hurtPlayer(22);
    for (const o of this.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < R + o.r) this.hitEnemy(o, 30, (o.x - e.x) * 3, (o.y - e.y) * 3, false);
  },
  hurtPlayer(dmg, src) {
    const p = this.player;
    if (!p || p.dashT > 0 || p.hurtT > 0 || this.state !== 'playing') return;
    if (src && !src.boss) dmg *= this.waveDef.dmgMul;
    dmg = Math.max(1, Math.round(dmg - p.armor));
    p.hp -= dmg; p.hurtT = src && src.boss ? 1.0 : 0.75; p.special = Math.min(1, p.special + 0.03);
    if (src) {
      // knock the player clear; a boss recoils and pauses, so it can't pin you in a corner
      const dx = p.x - src.x, dy = p.y - src.y, d = Math.hypot(dx, dy) || 1, f = src.boss ? 620 : 300;
      p.kx = dx / d * f; p.ky = dy / d * f;
      if (src.boss) {
        src.stun = 0.9; src.kx -= dx / d * 260; src.ky -= dy / d * 200;
        if (src.state === 'rush' || src.state === 'chomp') { src.state = 'chase'; src.st = 1.5; }
      }
    }
    this.combo = Math.floor(this.combo / 2);
    FX.doShake(10); FX.doFlash(0.35, '#ff2d55'); FX.text(p.x, p.y - 100, '-' + dmg, '#ff4d6d', 24);
    FX.burst(p.x, p.y - 40, 8, '#ff4d6d', 200);
    AudioSys.sfx('hurt');
    if (p.hp <= 0) { p.hp = 0; this.gameOver(false); }
  },
  gameOver(won) {
    if (this.state === 'over') return;
    AudioSys.setMusicVolume(0.06, 0.08); AudioSys.setIntensity(0, false);
    this.state = 'over'; this.won = won; this.overAt = this.time; if (won) this.laughT = 1;
    AudioSys.sfx(won ? 'win' : 'gameover');
    if (!won) { FX.doSlow(1.5, 0.2); FX.doShake(20); FX.burst(this.player.x, this.player.y - 40, 50, '#ffd23f', 400); }
    if (this.overCb) setTimeout(() => this.overCb(won), won ? 1800 : 1400);
  },
  bossKilled(e) {
    this.boss = null; this.bossPending = false;
    const p = this.player;
    if (this.state === 'playing') { const heal = Math.round(p.maxhp * 0.5); p.hp = Math.min(p.maxhp, p.hp + heal); FX.text(p.x, p.y - 110, '+' + heal, '#5cf2a8', 30); }
    this.corpse = { type: e.type, def: e.def, x: e.x, y: e.y, r: e.r, scale: e.scale, id: e.id, state: 'chase', t0: this.time };
    FX.doSlow(1.2, 0.18); FX.doFlash(0.8, '#fff'); FX.doShake(28);
    this.announce(t('bossDown'), '#ffd23f');
    this.score += 1000 * this.wave;
    // the boss takes its army with it (lighters fizzle out instead of blowing up in your face)
    for (const o of this.enemies) if (!o.dead && !o.def.boss) { o.exploded = true; this.killEnemy(o); }
    this.ebullets.length = 0; this.hazards.length = 0;
    if (e.type === 'king' && !this.endless) { this.gameOver(true); return; }
    this.pickups.push({ kind: 'chest', x: clamp(e.x, 80, W - 80), y: clamp(e.y, FLOOR_TOP + 20, FLOOR_BOT - 10), vx: 0, vy: -120, t: 0, scale: 1, life: 60 });
    this.intermission = 3; // a breather: read BOSS DOWN, grab the chest, then the next wave
  },

  /* ---------- spawning ---------- */
  spawnEnemy(type, x, y, opts) {
    opts = opts || {};
    const def = ENEMIES[type], wd = this.waveDef;
    const elite = !def.boss && !opts.small && !opts.noElite && Math.random() < wd.elite;
    const e = {
      id: this.idc++, type, def, x, y, hp: def.hp * (def.boss ? 1 : wd.hpMul) * (elite ? 3.2 : 1) * (opts.small ? 0.25 : 1), r: def.r * (opts.small ? 0.6 : 1),
      speed: def.speed * wd.speedMul * (elite ? 1.1 : 1) * (opts.small ? 1.4 : 1), scale: depthScale(y) * (elite ? 1.2 : 1), kx: 0, ky: 0, hitT: 0, spawnT: opts.instant ? 0.15 : 0.75,
      elite, small: !!opts.small, dead: false, st: 0, state: 'chase', phased: false, charge: 0, fuse: undefined, roll: 0, t: rnd(0, 10),
    };
    e.maxhp = e.hp;
    if (def.boss) { e.boss = true; this.boss = e; e.state = 'chase'; e.st = 2; }
    this.enemies.push(e);
    FX.smoke(x, y - 20, def.boss ? 24 : 4, 'rgba(200,160,255,1)', 60, { life: 1 });
    return e;
  },
  spawnPoint() {
    const p = this.player;
    for (let i = 0; i < 8; i++) {
      const side = Math.random(); let x, y;
      if (side < 0.33) { x = -30; y = rnd(FLOOR_TOP, FLOOR_BOT); }
      else if (side < 0.66) { x = W + 30; y = rnd(FLOOR_TOP, FLOOR_BOT); }
      else if (side < 0.88) { x = rnd(60, W - 60); y = FLOOR_TOP + rnd(0, 50); }
      else { x = rnd(60, W - 60); y = FLOOR_BOT; }
      if (Math.hypot(x - p.x, y - p.y) > 240) return { x, y };
    }
    return { x: -30, y: FLOOR_TOP + 10 };
  },
  pickType(pool) {
    let tot = 0; for (const [, w] of pool) tot += w;
    let r = Math.random() * tot; for (const [ty, w] of pool) { r -= w; if (r <= 0) return ty; }
    return pool[0][0];
  },
  updateWave(dt) {
    if (this.intermission > 0) { this.intermission -= dt; if (this.intermission <= 0) { this.score += 300 * this.wave; this.nextWave(); } return; }
    const wd = this.waveDef; this.waveT += dt;
    if (this.bossPending && wd.boss && this.waveT > 2.2 && !this.boss) {
      this.bossPending = false;
      const e = this.spawnEnemy(wd.boss, 640, FLOOR_TOP + 40, { noElite: true });
      e.spawnT = 1.2; FX.doShake(14); FX.doFlash(0.3, '#ff2d95');
    }
    const alive = this.enemies.length;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && alive < wd.cap) {
      this.spawnT = wd.interval * (this.boss ? 2.2 : 1);
      for (let i = 0; i < wd.batch; i++) { const sp = this.spawnPoint(); this.spawnEnemy(this.pickType(wd.pool), sp.x + rnd(-20, 20), clamp(sp.y + rnd(-20, 20), FLOOR_TOP, FLOOR_BOT)); }
    }
    // the golden munchies bag: a fleeing treasure runner, catch it before it escapes
    if (!this.goldDone && !wd.boss && (this.wave === 3 || this.wave === 7 || this.wave === 12 || (this.endless && this.wave % 3 === 0)) && this.waveT > 12) {
      this.goldDone = true; const p = this.player; let gx = 640, gy = 500;
      for (let i = 0; i < 12; i++) { gx = rnd(160, W - 160); gy = rnd(FLOOR_TOP + 30, FLOOR_BOT - 30); if (Math.hypot(gx - p.x, gy - p.y) > 340) break; }
      const g = this.spawnEnemy('goldbag', gx, gy, { noElite: true }); g.spawnT = 0.4; g.life = 9.4;
      this.announce(t('goldBag'), '#ffd23f'); AudioSys.sfx('select');
    }
    if (this.waveT >= wd.duration && !this.boss && !this.bossPending) { this.score += 300 * this.wave; this.nextWave(); }
  },

  /* ---------- update ---------- */
  update(dt) {
    const p = this.player, alive = this.state === 'playing';
    this.time += dt; p.t += dt; if (alive) this.runTime += dt;
    this.laughT = Math.max(0, this.laughT - dt * 0.8);
    this.neonFlicker = Math.random() < 0.03 ? rnd(0.5, 0.9) : Math.min(1, this.neonFlicker + dt * 4);

    // queued level-ups: one per frame, never after death or victory (leftover levels fire after the card pick)
    if (alive && p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++; p.xpNext = this.xpFor(p.level); this.levelUp();
      if (this.state !== 'playing') return;
    }

    if (alive) {
      /* player */
      const mv = Input.moveVec();
      p.moving = mv.mag > 0.05;
      if (p.dashT > 0) {
        p.dashT -= dt; p.x += p.dashX * 900 * dt; p.y += p.dashY * 700 * dt;
        FX.smoke(p.x, p.y - 30, 2, 'rgba(230,210,255,1)', 10, { life: 0.5, alpha: 0.5, r: 14 });
      } else {
        p.vx = mv.x * p.speed; p.vy = mv.y * p.speed * 0.8;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // knockback from contact hits (gets you out of a pin)
      if (p.kx || p.ky) { p.x += p.kx * dt; p.y += p.ky * dt; const pk = Math.pow(0.002, dt); p.kx *= pk; p.ky *= pk; if (Math.abs(p.kx) + Math.abs(p.ky) < 5) p.kx = p.ky = 0; }
      p.x = clamp(p.x, 26, W - 26); p.y = clamp(p.y, FLOOR_TOP, FLOOR_BOT);
      p.scale = depthScale(p.y);
      p.dashCd = Math.max(0, p.dashCd - dt); p.hurtT = Math.max(0, p.hurtT - dt);
      if (Input.wasPressed('Space') && p.dashCd <= 0) {
        p.dashCd = p.dashCdMax; p.dashT = 0.2;
        const d = p.moving ? { x: mv.x / mv.mag, y: mv.y / mv.mag } : p.aim; p.dashX = d.x; p.dashY = d.y;
        AudioSys.sfx('dash'); FX.ring(p.x, p.y - 30, 50, 'rgba(230,210,255,.8)', 0.3, 3);
      }
      if (Input.wasPressed('special') && p.special >= 1) this.bigLaugh();
      if (p.regen > 0) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);

      // aim: mouse / right stick / auto. Measured from the ring muzzle so shots fly where you point.
      const my = p.y - 60 * p.scale;
      let aim = Input.aimVec(p.x, my);
      if (!aim) { const n = this.nearestEnemies(p.x, p.y, 1, 2000)[0]; if (n) { const dx = n.x - p.x, dy = this.aimY(n) - my, d = Math.hypot(dx, dy) || 1; aim = { x: dx / d, y: dy / d }; } else aim = p.aim; }
      p.aim = aim; if (Math.abs(aim.x) > 0.15) p.face = aim.x > 0 ? 1 : -1;

      // weapons
      for (const w of p.weapons) {
        const def = WEAPONS[w.id];
        if (def.passive) continue;
        w.cd -= dt * p.rateMul;
        if (w.cd <= 0) { w.cd += def.cd(w.lvl); def.fire(p, w.lvl, w.evo); }
      }
      const orbit = p.weapons.find(w => w.id === 'orbit');
      if (orbit) {
        const d = WEAPONS.orbit, n = this.orbitCount(orbit), R = d.radius(orbit.lvl), oR = d.orbR(orbit.lvl), od = d.dmg(orbit.lvl) * (orbit.evo ? 1.5 : 1);
        p.orbitA += d.speed(orbit.lvl) * dt;
        for (let i = 0; i < n; i++) {
          const a = p.orbitA + i / n * 6.283, ox = p.x + Math.cos(a) * R, oy = p.y - 40 + Math.sin(a) * R * 0.6;
          for (const e of this.enemies) {
            if (e.dead || e.spawnT > 0 || !this.hitTest(e, ox, oy, oR)) continue;
            if (!e.orbT || e.orbT <= 0) { e.orbT = 0.3; this.hitEnemy(e, od, (e.x - p.x) * 2, (e.y - p.y) * 2, true); }
          }
        }
      }
      const aura = p.weapons.find(w => w.id === 'aura');
      if (aura) {
        p.auraTick -= dt;
        if (p.auraTick <= 0) {
          p.auraTick = 0.25; const R = this.auraR(aura), dmg = WEAPONS.aura.dps(aura.lvl) * 0.25 * (aura.evo ? 1.5 : 1);
          for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, (e.y - p.y) * 1.4) < R + e.r * e.scale) { if (aura.evo) e.slowT = 0.3; this.hitEnemy(e, dmg, 0, 0, false, true); }
        }
      }

      // the couch buddy (summoned by Big Laugh) fights by your side for a few seconds
      const bd = this.buddy;
      if (bd) {
        bd.t -= dt; bd.t0 += dt;
        const tx = clamp(p.x - 70 * p.face, 26, W - 26), ty = clamp(p.y + 10, FLOOR_TOP, FLOOR_BOT), k = Math.min(1, dt * 4);
        bd.moving = Math.hypot(tx - bd.x, ty - bd.y) > 8;
        bd.x += (tx - bd.x) * k; bd.y += (ty - bd.y) * k; bd.scale = depthScale(bd.y);
        bd.cd -= dt;
        if (bd.cd <= 0) {
          bd.cd = 0.22; const n = this.nearestEnemies(bd.x, bd.y, 1, 650)[0];
          if (n) {
            const by = bd.y - 60 * bd.scale, a = Math.atan2(this.aimY(n) - by, n.x - bd.x);
            this.addBullet({ kind: 'ring', x: bd.x, y: by, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 12, dmg: 12 + p.level, pierce: 2, life: 1.1, buddy: true });
            bd.face = Math.cos(a) > 0 ? 1 : -1;
          }
        }
        if (bd.t <= 0) { FX.smoke(bd.x, bd.y - 40, 14, 'rgba(230,210,255,1)', 50); this.buddy = null; }
      }
    }

    /* bullets */
    const B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.t += dt; b.life -= dt;
      if (b.kind === 'chip') {
        b.spin += 14 * dt;
        if (!b.returning) { b.travelled += Math.hypot(b.vx, b.vy) * dt; if (b.travelled >= b.range) { b.returning = true; b.hit.clear(); } }
        else {
          const tx = p.x, ty = p.y - 40, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx += (dx / d * 1900 - b.vx * 3) * dt; b.vy += (dy / d * 1900 - b.vy * 3) * dt;
          if (d < 26) { b.life = 0; }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < 40 || b.y > H + 60) { if (b.kind === 'fire' && alive) this.fireBlast(b); B.splice(i, 1); continue; }
      if (alive) for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.phased || b.hit.has(e.id)) continue;
        if (this.hitTest(e, b.x, b.y, b.r)) {
          b.hit.add(e.id);
          this.hitEnemy(e, b.dmg, b.vx * 0.25, b.vy * 0.25, true);
          if (b.kind === 'fire') { this.fireBlast(b); b.life = 0; break; }
          if (--b.pierce <= 0 && b.kind !== 'chip') { b.life = 0; break; }
        }
      }
      if (b.life <= 0) B.splice(i, 1);
    }

    /* enemies */
    const E = this.enemies;
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      if (e.dead) { E.splice(i, 1); continue; }
      e.t += dt; e.hitT = Math.max(0, e.hitT - dt); if (e.orbT) e.orbT -= dt; if (e.slowT > 0) e.slowT -= dt; if (e.numT > 0) e.numT -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; e.scale = depthScale(e.y) * (e.elite ? 1.2 : 1); continue; }
      this.enemyAI(e, dt);
      if (e.dead) continue;
      // separation (squared-distance early out: most pairs are far apart)
      for (let j = 0; j < E.length; j++) {
        const o = E[j]; if (o === e || o.dead || o.spawnT > 0) continue;
        const dx = e.x - o.x, dy = (e.y - o.y) * 1.6, min = (e.r + o.r) * 0.9, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 <= 0.0001) continue;
        const d = Math.sqrt(d2), f = (min - d) / min * 60 * dt; e.x += dx / d * f; e.y += dy / d * f * 0.6;
      }
      // knockback
      e.x += e.kx * dt; e.y += e.ky * dt; const kd = Math.pow(0.001, dt); e.kx *= kd; e.ky *= kd;
      e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT); e.x = clamp(e.x, -40, W + 40);
      e.scale = depthScale(e.y) * (e.elite ? 1.2 : 1);
      // contact
      if (alive && e.def.dmg > 0 && Math.hypot(e.x - p.x, (e.y - p.y) * 1.5) < (e.r * e.scale + p.r) * (e.boss ? 1.1 : 0.9)) this.hurtPlayer(e.def.dmg * (e.elite ? 1.5 : 1) * (e.small ? 0.5 : 1), e);
    }

    /* enemy bullets */
    const EB = this.ebullets;
    for (let i = EB.length - 1; i >= 0; i--) {
      const b = EB[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < 0 || b.y > H + 40) { EB.splice(i, 1); continue; }
      if (alive && Math.hypot(b.x - p.x, b.y - (p.y - 40)) < b.r + p.r * 0.9) { this.hurtPlayer(b.dmg); EB.splice(i, 1); }
    }

    /* hazards */
    const HZ = this.hazards;
    for (let i = HZ.length - 1; i >= 0; i--) {
      const h = HZ[i]; h.life -= dt; if (h.life <= 0) { HZ.splice(i, 1); continue; }
      if (alive && Math.hypot(p.x - h.x, (p.y - h.y) * 2.2) < h.r * 0.9) { h.tick = (h.tick || 0) - dt; if (h.tick <= 0) { h.tick = 0.4; const was = p.hurtT; p.hurtT = 0; this.hurtPlayer(6); p.hurtT = Math.max(was, 0.1); } }
    }

    /* pickups (state re-checked: the run can end earlier in this same frame) */
    if (this.state === 'playing') {
      const PK = this.pickups;
      for (let i = PK.length - 1; i >= 0; i--) {
        const k = PK[i]; k.t += dt; k.life -= dt; if (k.life <= 0) { PK.splice(i, 1); continue; }
        const dx = p.x - k.x, dy = (p.y - 30) - k.y, d = Math.hypot(dx, dy) || 1;
        const mag = k.kind === 'xp' ? p.magnet : 60;
        if (k.pulled || d < mag) {
          // accelerate from the moment of the pull; collect when this frame's step would reach you (never overshoots)
          k.pulled = true; k.pt = (k.pt || 0) + dt; const sp = 520 + k.pt * 900;
          if (d < 26 + sp * dt) { PK.splice(i, 1); this.collect(k); continue; }
          k.vx = dx / d * sp; k.vy = dy / d * sp;
        } else { const kd = Math.pow(0.02, dt); k.vx *= kd; k.vy *= kd; }
        k.x += k.vx * dt; k.y += k.vy * dt; k.y = clamp(k.y, FLOOR_TOP - 40, FLOOR_BOT);
        k.scale = depthScale(k.y);
        if (d < 26) { PK.splice(i, 1); this.collect(k); }
      }
    }

    /* combo */
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    /* waves */
    if (this.state === 'playing') this.updateWave(dt);
    /* ambient smoke */
    for (const s of this.smokeLayer) { s.x += s.vx * dt; s.y += s.vy * dt; if (s.y < -s.r) { s.y = H + s.r; s.x = rnd(0, W); } if (s.x < -s.r) s.x = W + s.r; if (s.x > W + s.r) s.x = -s.r; }
  },

  fireBlast(b) {
    if (b.blasted) return; b.blasted = true;
    FX.burst(b.x, b.y, 14, '#ff9d00', 260); FX.ring(b.x, b.y, b.blast, '#ffb347', 0.35, 5); FX.smoke(b.x, b.y, 3, 'rgba(255,170,80,1)', 30, { life: 0.6 });
    AudioSys.sfx('explode');
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0) continue; if (this.hitTest(e, b.x, b.y, b.blast) && !b.hit.has(e.id + 100000)) { b.hit.add(e.id + 100000); this.hitEnemy(e, b.dmg * 0.8, (e.x - b.x) * 2, (e.y - b.y) * 2, true); } }
  },
  collect(k) {
    const p = this.player;
    if (k.kind === 'xp') {
      p.xp += k.value * p.xpMul; this.score += k.value; AudioSys.sfx('pickup'); // the level-up itself is queued in update()
    } else if (k.kind === 'pizza') {
      p.hp = Math.min(p.maxhp, p.hp + Math.round(p.maxhp * 0.3)); AudioSys.sfx('heal'); FX.text(p.x, p.y - 100, '+' + Math.round(p.maxhp * 0.3), '#5cf2a8', 24); FX.burst(p.x, p.y - 40, 12, '#5cf2a8', 150);
    } else if (k.kind === 'bag') {
      for (const o of this.pickups) if (o.kind === 'xp') o.pulled = true; AudioSys.sfx('select'); FX.ring(p.x, p.y - 30, 400, '#2d6cdf', 0.5, 4);
    } else if (k.kind === 'lamp') {
      FX.doFlash(0.7, '#ff2d95'); FX.doShake(16); FX.doSlow(0.5, 0.3); AudioSys.sfx('explode');
      for (const e of this.enemies) if (!e.dead && !e.boss) this.hitEnemy(e, 400, 0, 0, false); else if (!e.dead) this.hitEnemy(e, 250, 0, 0, false);
      this.ebullets.length = 0;
    } else if (k.kind === 'chest') {
      FX.doFlash(0.45, '#ffd23f'); FX.ring(p.x, p.y - 30, 240, '#ffd23f', 0.6, 8); FX.burst(p.x, p.y - 50, 40, '#ffd23f', 380);
      const w = p.weapons.find(x => !x.evo && x.lvl >= WEAPONS[x.id].max && (p.passives[EVOLVE[x.id]] || 0) > 0);
      if (w) {
        w.evo = true; FX.doShake(10); AudioSys.sfx('levelup');
        this.announce(t('evolved', { name: I18N[LANG].weapons[w.id][0] }), '#ffd23f');
        FX.text(p.x, p.y - 130, t('evolvedFx'), '#ffd23f', 30, { font: 'Secular One', life: 1.4 });
      } else { p.xp = p.xp >= p.xpNext ? p.xp + this.xpFor(p.level + 1) : p.xpNext; AudioSys.sfx('select'); } // no weapon ready: a free level instead
    }
  },
  levelUp() {
    const p = this.player, choices = this.upgradeChoices();
    AudioSys.sfx('levelup'); FX.ring(p.x, p.y - 30, 160, '#ffd23f', 0.6, 6); FX.burst(p.x, p.y - 40, 24, '#ffd23f', 260);
    if (!choices.length) { p.hp = p.maxhp; this.score += 100 * p.level; FX.text(p.x, p.y - 110, t('maxFx'), '#ffd23f', 30, { font: 'Secular One' }); return; }
    this.state = 'levelup';
    // let the burst play for a moment before the cards cover it (the sim is already frozen)
    setTimeout(() => { if (this.state === 'levelup' && this.levelUpCb) this.levelUpCb(choices); }, 280);
  },
  upgradeChoices() {
    const p = this.player, pool = [];
    for (const id in WEAPONS) {
      const w = p.weapons.find(x => x.id === id);
      if (w) { if (w.lvl < WEAPONS[id].max) pool.push({ kind: 'weapon', id, lvl: w.lvl + 1, w: 1.3 }); }
      else if (p.weapons.length < 5) pool.push({ kind: 'weapon', id, lvl: 1, w: 1.1 });
    }
    for (const id in PASSIVES) { const l = p.passives[id] || 0; if (l < PASSIVES[id].max) pool.push({ kind: 'passive', id, lvl: l + 1, w: 1 }); }
    const out = [];
    while (out.length < 3 && pool.length) {
      let tot = 0; for (const c of pool) tot += c.w; let r = Math.random() * tot;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { out.push(pool.splice(i, 1)[0]); break; } }
    }
    return out;
  },
  applyUpgrade(c) {
    const p = this.player;
    if (c.kind === 'weapon') { const w = p.weapons.find(x => x.id === c.id); if (w) w.lvl++; else p.weapons.push({ id: c.id, lvl: 1, cd: 0.1 }); }
    else { p.passives[c.id] = (p.passives[c.id] || 0) + 1; PASSIVES[c.id].apply(p); }
    this.state = 'playing'; AudioSys.sfx('select');
  },
  bigLaugh() {
    const p = this.player; p.special = 0; this.laughT = 1.6;
    FX.doSlow(0.9, 0.25); FX.doShake(18); FX.doFlash(0.5, '#ffd23f');
    AudioSys.sfx('laugh');
    for (let i = 0; i < 8; i++) setTimeout(() => FX.text(rnd(100, W - 100), rnd(120, 600), t('hahaha'), '#ffd23f', rnd(28, 54), { font: 'Secular One', life: 1.2 }), i * 90);
    this.shockwave(p.x, p.y - 30, 2000, 0, 0, '#ffd23f');
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0) continue; const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; e.phased = false; this.hitEnemy(e, e.boss ? 350 : 90, dx / d * 900, dy / d * 500, false); }
    this.ebullets.length = 0;
    // your couch buddy from the video jumps in and fights beside you
    const bx = clamp(p.x - 70 * p.face, 26, W - 26);
    if (!this.buddy) FX.smoke(bx, p.y - 40, 16, 'rgba(230,210,255,1)', 60);
    this.buddy = { x: bx, y: p.y, scale: p.scale, t: 6, t0: 0, cd: 0.3, face: p.face, moving: false };
    setTimeout(() => { if (this.state === 'playing' && this.buddy) this.announce(t('buddy'), '#5cc8ff'); }, 700);
  },

  /* ---------- enemy AI ---------- */
  enemyAI(e, dt) {
    if (e.stun > 0) { e.stun -= dt; return; }
    const p = this.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d, sm = e.slowT > 0 ? 0.6 : 1;
    const chase = (mul) => { e.x += nx * e.speed * (mul || 1) * sm * dt; e.y += ny * e.speed * (mul || 1) * sm * 0.75 * dt; };
    switch (e.type) {
      case 'chip': chase(1 + Math.sin(e.t * 6) * 0.25); break;
      case 'cookie': chase(); e.roll += (nx > 0 ? 1 : -1) * 6 * dt; break;
      case 'cap':
        if (d > 300) chase(); else if (d < 200) chase(-0.7); else { e.x += Math.cos(e.t * 1.5) * 40 * dt; }
        if (e.x < 30) e.x = Math.min(30, e.x + 160 * dt); else if (e.x > W - 30) e.x = Math.max(W - 30, e.x - 160 * dt); // no sniping from off-screen
        e.st += dt;
        if (e.st > 2.4) { e.charge = Math.min(1, (e.st - 2.4) / 0.6); }
        if (e.st > 3.0) { e.st = rnd(0, 0.6); e.charge = 0; this.ebullets.push({ x: e.x, y: e.y - 20, vx: nx * 300, vy: (p.y - 40 - (e.y - 20)) / d * 300, r: 8, dmg: Math.round(12 * this.waveDef.dmgMul), life: 4 }); AudioSys.sfx('eshoot'); }
        break;
      case 'lighter':
        if (e.fuse === undefined) { chase(1.1); if (d < 80) { e.fuse = 0.85; } }
        else { e.fuse -= dt; chase(0.3); if (e.fuse <= 0) { this.explodeLighter(e); this.killEnemy(e); } }
        break;
      case 'wraith':
        e.st += dt; e.phased = (e.st % 3.4) > 2.5;
        chase(e.phased ? 1.6 : 1); e.x += Math.sin(e.t * 5) * 60 * dt;
        break;
      case 'blob': chase(1 + Math.max(0, Math.sin(e.t * 3)) * 0.8); break;
      case 'goldbag':
        e.life -= dt; chase(-1); e.y += Math.sin(e.t * 2.2) * 140 * dt;
        if (e.x < 40 || e.x > W - 40) e.x += (e.x < 640 ? 1 : -1) * 300 * dt;
        if (Math.random() < 0.3) FX.sparks(e.x, e.y - 30, 1, '#ffd23f', 80);
        if (e.life <= 0) { e.dead = true; FX.smoke(e.x, e.y - 20, 12, 'rgba(255,220,120,1)', 60); if (this.state === 'playing') this.announce(t('goldGone'), '#9aa0a6'); }
        break;
      case 'bottle':
        e.st += dt;
        if (e.state === 'chase') { chase(); if (e.st > 3.2 && d < 420) { e.state = 'tele'; e.st = 0; e.charging = true; e.rx = nx; e.ry = ny; } }
        else if (e.state === 'tele') { if (e.st > 0.55) { e.state = 'rush'; e.st = 0; e.charging = false; AudioSys.sfx('warn'); } }
        else { e.x += e.rx * 560 * dt; e.y += e.ry * 420 * dt; if (e.st > 0.5) { e.state = 'chase'; e.st = 0; } }
        break;
      case 'hydra': this.bossHydra(e, dt, d, nx, ny, chase); break;
      case 'lavalord': this.bossLava(e, dt, d, nx, ny, chase); break;
      case 'king': this.bossKing(e, dt, d, nx, ny, chase); break;
    }
  },
  bossHydra(e, dt, d, nx, ny, chase) {
    e.st -= dt; const frac = e.hp / e.maxhp, fast = frac < 0.5 ? 1.35 : 1;
    if (e.state === 'chase') { chase(fast); if (e.st <= 0) { e.state = Math.random() < 0.5 ? 'spit' : 'tele'; e.st = e.state === 'spit' ? 1.6 : 0.7; e.spitT = 0; e.rx = nx; e.ry = ny; if (e.state === 'tele') AudioSys.sfx('warn'); } }
    else if (e.state === 'spit') {
      e.spitT -= dt;
      if (e.spitT <= 0) { e.spitT = 0.28 / fast; if (this.enemies.length < 120) this.spawnEnemy('chip', e.x + rnd(-40, 40), e.y + rnd(-10, 10), { instant: true, noElite: true }); const pl = this.player, a0 = Math.atan2((pl.y - 40) - (e.y - 100), pl.x - e.x); for (let k = -1; k <= 1; k++) { const a = a0 + k * 0.3; this.ebullets.push({ x: e.x, y: e.y - 100, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, r: 9, dmg: 14, life: 4, color: '#ff5a36' }); } AudioSys.sfx('eshoot'); }
      if (e.st <= 0) { e.state = 'chase'; e.st = 2.5 / fast; }
    }
    else if (e.state === 'tele') { if (e.st <= 0) { e.state = 'rush'; e.st = 0.7; FX.doShake(4); } }
    else if (e.state === 'rush') { e.x += e.rx * 640 * dt; e.y += e.ry * 480 * dt; FX.smoke(e.x, e.y, 1, 'rgba(255,200,100,1)', 20, { life: 0.4 }); if (e.st <= 0) { e.state = 'chase'; e.st = 2 / fast; FX.doShake(8); } }
  },
  bossLava(e, dt, d, nx, ny, chase) {
    e.st -= dt; e.st2 = (e.st2 || 0) - dt; e.st3 = (e.st3 || 0) - dt; const frac = e.hp / e.maxhp;
    chase(0.9);
    if (e.st <= 0) {
      e.st = frac < 0.4 ? 2.6 : 3.8; e.state = 'burst'; e.stateT = 0.5;
      const n = frac < 0.4 ? 18 : 12, off = rnd(0, 6.28);
      for (let i = 0; i < n; i++) { const a = off + i / n * 6.283; this.ebullets.push({ x: e.x, y: e.y - 90, vx: Math.cos(a) * 240, vy: Math.sin(a) * 200, r: 9, dmg: 14, life: 5, color: '#ff6a3d' }); }
      AudioSys.sfx('fire'); FX.ring(e.x, e.y - 90, 120, '#ff2d95', 0.4, 5);
    }
    if (e.stateT !== undefined) { e.stateT -= dt; if (e.stateT <= 0) { e.state = 'chase'; e.stateT = undefined; } }
    if (e.st2 <= 0) { e.st2 = 2.8; this.hazards.push({ x: e.x, y: e.y, r: 70, life: 6 }); }
    if (e.st3 <= 0) { e.st3 = frac < 0.4 ? 4.5 : 6.5; if (this.enemies.length < 110) for (let i = 0; i < 2; i++) this.spawnEnemy('blob', e.x + rnd(-60, 60), clamp(e.y + rnd(-30, 30), FLOOR_TOP, FLOOR_BOT), { noElite: true }); }
  },
  bossKing(e, dt, d, nx, ny, chase) {
    e.st -= dt; const frac = e.hp / e.maxhp, fast = frac < 0.5 ? 1.4 : 1;
    if (e.state === 'chase') { chase(fast); if (e.st <= 0) { const r = Math.random(); e.state = r < 0.35 ? 'tele' : r < 0.7 ? 'spiral' : 'summon'; e.st = e.state === 'tele' ? 0.8 : e.state === 'spiral' ? 2.2 : 0.4; e.sa = 0; e.spT = 0; e.rx = nx; e.ry = ny; if (e.state === 'tele') AudioSys.sfx('warn'); } }
    else if (e.state === 'tele') { if (e.st <= 0) { e.state = 'chomp'; e.st = 0.9; } }
    else if (e.state === 'chomp') { e.x += e.rx * 700 * dt; e.y += e.ry * 520 * dt; if (e.st <= 0) { e.state = 'chase'; e.st = 1.8 / fast; FX.doShake(10); this.shockwave(e.x, e.y, 120, 0, 0, '#ffd23f'); } }
    else if (e.state === 'spiral') {
      e.spT -= dt; e.sa += 5 * dt;
      if (e.spT <= 0) { e.spT = 0.09 / fast; for (let k = 0; k < 3; k++) { const a = e.sa + k * 2.094; this.ebullets.push({ x: e.x, y: e.y - 60, vx: Math.cos(a) * 260, vy: Math.sin(a) * 210, r: 8, dmg: 12, life: 5, color: '#ff2d55' }); } }
      if (e.st <= 0) { e.state = 'chase'; e.st = 2 / fast; }
    }
    else if (e.state === 'summon') { if (e.st <= 0) { e.state = 'chase'; e.st = 3 / fast; if (this.enemies.length < 120) for (let i = 0; i < 5; i++) { const sp = this.spawnPoint(); this.spawnEnemy(ALL[Math.floor(Math.random() * ALL.length)], sp.x, sp.y, { noElite: true }); } FX.doShake(6); } }
  },

  /* ---------- rendering ---------- */
  makeSoftBg(img) {
    // cheap blur that works everywhere (no ctx.filter): downscale to 1/5 and back, masked to the arena only
    const s = document.createElement('canvas'); s.width = 256; s.height = 144; s.getContext('2d').drawImage(img, 0, 0, 256, 144);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, W, H);
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, FLOOR_TOP - 100, 0, FLOOR_TOP - 10); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = m; g.fillRect(0, 0, W, H);
    return c;
  },
  drawTelegraphs(ctx, tm) {
    for (const e of this.enemies) {
      if (e.dead || e.state !== 'tele' || e.rx === undefined) continue;
      const cfg = e.type === 'bottle' ? [560, 420, 0.5, 0.55, e.st / 0.55] : e.type === 'king' ? [700, 520, 0.9, 0.8, 1 - e.st / 0.8] : [640, 480, 0.7, 0.7, 1 - e.st / 0.7];
      const k = clamp(cfg[4], 0, 1), ex = e.x + e.rx * cfg[0] * cfg[2], ey = clamp(e.y + e.ry * cfg[1] * cfg[2], FLOOR_TOP, FLOOR_BOT);
      const a = Math.atan2(ey - e.y, ex - e.x), len = Math.hypot(ex - e.x, ey - e.y), hw = Math.max(18, e.r * e.scale * (e.boss ? 0.9 : 1.2));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = `rgba(255,40,80,${0.10 + 0.08 * Math.sin(tm * 30)})`; ctx.fillRect(0, -hw, len, hw * 2);
      ctx.fillStyle = 'rgba(255,60,90,0.38)'; ctx.fillRect(0, -hw, len * k, hw * 2);
      ctx.strokeStyle = 'rgba(255,90,110,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -tm * 60;
      ctx.strokeRect(0, -hw, len, hw * 2); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,220,230,0.9)';
      for (let d = 40; d < len - 10; d += 46) { ctx.beginPath(); ctx.moveTo(d, -hw * 0.45); ctx.lineTo(d + 16, 0); ctx.lineTo(d, hw * 0.45); ctx.lineTo(d + 6, 0); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  },
  /* The static backdrop (video frame, soft floor, tint, neon glow, floor plane, grid) is baked once per
     backing-store size instead of rebuilding ~2.5 screens of gradients every frame. */
  buildLayers() {
    const kc = Math.min(1.5, this.canvas.width / W);
    const mk = (k) => { const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); return [c, g]; };
    const L = { cw: this.canvas.width, cache: {} };
    L.get = (name) => L.cache[name] || (L.cache[name] = bake(this.bg[name], name !== 'laugh'));
    const bake = (img, soft) => {
      const [c, g] = mk(kc);
      g.drawImage(img, 0, 0, W, H);
      if (soft) g.drawImage(this.makeSoftBg(img), 0, 0, W, H);
      // dream tint
      const tint = g.createLinearGradient(0, 0, 0, H); tint.addColorStop(0, 'rgba(40,8,60,0.35)'); tint.addColorStop(0.45, 'rgba(14,4,22,0.45)'); tint.addColorStop(1, 'rgba(8,2,14,0.7)');
      g.fillStyle = tint; g.fillRect(0, 0, W, H);
      // neon tube glow (matches the purple light bar in the frame)
      g.globalCompositeOperation = 'lighter';
      const ng = g.createRadialGradient(640, 46, 10, 640, 46, 520); ng.addColorStop(0, 'rgba(224,77,255,0.35)'); ng.addColorStop(1, 'rgba(224,77,255,0)');
      g.fillStyle = ng; g.fillRect(0, 0, W, 566);
      g.globalCompositeOperation = 'source-over';
      // the arena floor: a dark plane in front of the couch so sprites read against it (faces above stay visible)
      const fl = g.createLinearGradient(0, FLOOR_TOP - 80, 0, H);
      fl.addColorStop(0, 'rgba(10,3,18,0)'); fl.addColorStop(0.16, 'rgba(10,3,18,0.58)'); fl.addColorStop(1, 'rgba(6,2,12,0.82)');
      g.fillStyle = fl; g.fillRect(0, FLOOR_TOP - 80, W, H - FLOOR_TOP + 80);
      // floor grid (perspective), brighter toward the camera
      const gy0 = FLOOR_TOP - 22;
      const gg = g.createLinearGradient(0, gy0, 0, H); gg.addColorStop(0, 'rgba(224,77,255,0.06)'); gg.addColorStop(1, 'rgba(224,77,255,0.24)');
      g.strokeStyle = gg; g.lineWidth = 1.2; g.beginPath();
      for (let i = -8; i <= 8; i++) { g.moveTo(640 + i * 46, gy0); g.lineTo(640 + i * 260, H + 40); }
      for (let k = 1; k < 9; k++) { const y = gy0 + Math.pow(k / 8, 1.8) * (H + 40 - gy0); g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
      // neon horizon: the back edge of the arena echoes the purple tube
      g.save(); g.strokeStyle = 'rgba(224,77,255,0.55)'; g.lineWidth = 2; g.shadowColor = '#e04dff'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(0, gy0); g.lineTo(W, gy0); g.stroke(); g.restore();
      return c;
    };
    const [vc, vg] = mk(1);
    const v = vg.createRadialGradient(640, 360, 300, 640, 360, 820); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(5,0,10,0.75)');
    vg.fillStyle = v; vg.fillRect(0, 0, W, H);
    L.vignette = vc;
    this.layers = L;
  },
  // the dying boss shakes, flashes and shrinks for 0.9 s, then bursts
  drawCorpse(ctx) {
    const c = this.corpse, k = (this.time - c.t0) / 0.9;
    if (k >= 1) { FX.burst(c.x, c.y - 80 * c.scale, 60, '#fff', 560); FX.ring(c.x, c.y - 60 * c.scale, 300, '#ffd23f', 0.6, 8); FX.doShake(18); this.corpse = null; return; }
    ctx.save(); ctx.translate(c.x + (Math.random() - 0.5) * 14 * k, c.y); ctx.scale(1 - 0.3 * k, 1 - 0.3 * k); ctx.translate(-c.x, -c.y);
    Sprites[c.type](ctx, c, this.time);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(this.time * 28)); Sprites.noShadow = true; Sprites[c.type](ctx, c, this.time); Sprites.noShadow = false;
    ctx.restore();
    if (Math.random() < 0.4) FX.burst(c.x + rnd(-50, 50) * c.scale, c.y - rnd(20, 130) * c.scale, 10, c.def.color, 300);
  },
  draw(real) {
    const ctx = this.ctx, p = this.player, tm = this.time;
    if (this.bgReady && (!this.layers || this.layers.cw !== this.canvas.width)) this.buildLayers();
    const L = this.layers;
    ctx.save();
    ctx.translate(clamp(FX.shakeX, -24, 24), clamp(FX.shakeY, -14, 14)); // never beyond the oversized backdrop (no stale edge strips)
    // the room (the actual video frame); waves 6-10 use the smokier frame, crossfaded
    if (L) {
      const want = p && this.wave >= 6 && this.wave <= 10 ? 'smoke' : 'room';
      if (want !== this.bgKey) { this.bgPrev = this.bgKey || want; this.bgKey = want; this.bgSwitchAt = real; }
      const fade = clamp((real - (this.bgSwitchAt || 0)) / 2.5, 0, 1);
      if (fade < 1) ctx.drawImage(L.get(this.bgPrev), -24, -14, W + 48, H + 28);
      ctx.globalAlpha = fade; ctx.drawImage(L.get(this.bgKey), -24, -14, W + 48, H + 28);
      if (this.laughT > 0) { ctx.globalAlpha = Math.min(1, this.laughT * 1.5); ctx.drawImage(L.get('laugh'), -24, -14, W + 48, H + 28); }
      ctx.globalAlpha = 1;
      // the neon tube flickers (only while playing, so a dip can't get stuck on a frozen screen)
      if (this.neonFlicker < 1 && this.state === 'playing') { ctx.fillStyle = `rgba(8,2,14,${(1 - this.neonFlicker) * 0.55})`; ctx.fillRect(-24, -14, W + 48, FLOOR_TOP - 6); }
    } else { ctx.fillStyle = '#1a0a22'; ctx.fillRect(-24, -14, W + 48, H + 28); }
    // ambient smoke (back)
    for (const s of this.smokeLayer) { const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r); g.addColorStop(0, `rgba(230,210,255,${s.a})`); g.addColorStop(1, 'rgba(230,210,255,0)'); ctx.fillStyle = g; ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }

    if (p) {
      for (const h of this.hazards) Sprites.lavaPool(ctx, h, tm);
      // aura
      const aura = p.weapons.find(w => w.id === 'aura');
      if (aura) {
        const R = this.auraR(aura) + Math.sin(tm * 4) * 4, c = aura.evo ? '120,220,255' : '210,170,255';
        ctx.save(); ctx.translate(p.x, p.y - 10); ctx.scale(1, 0.7);
        const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R); g.addColorStop(0, `rgba(${c},0.05)`); g.addColorStop(0.8, `rgba(${c},0.22)`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.restore();
      }
      this.drawTelegraphs(ctx, tm);
      // a lit lighter shows its exact blast zone (blast 95 + your radius 20)
      for (const e of this.enemies) {
        if (e.dead || e.type !== 'lighter' || e.fuse === undefined) continue;
        const k = 1 - Math.max(0, e.fuse) / 0.85;
        ctx.save(); ctx.globalAlpha = 0.25 + 0.6 * k; ctx.strokeStyle = '#ff9d00'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -tm * 80;
        ctx.beginPath(); ctx.arc(e.x, e.y, 115, 0, 6.283); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = `rgba(255,120,0,${0.06 + 0.12 * k})`; ctx.fill(); ctx.restore();
      }
      // player marker ring on the floor (findable in a crowd)
      ctx.save(); ctx.translate(p.x, p.y + 2); ctx.scale(1, 0.36); ctx.strokeStyle = 'rgba(255,210,63,0.75)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 30 * p.scale, 0, 6.283); ctx.stroke(); ctx.restore();
      // depth-sorted entities
      const list = [];
      for (const e of this.enemies) if (!e.dead) list.push(e);
      for (const k of this.pickups) list.push(k);
      if (this.buddy) list.push(this.buddy);
      if (this.corpse) list.push(this.corpse);
      list.push(p);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) {
        if (o === this.corpse) { this.drawCorpse(ctx); continue; }
        if (o === p) { p.deathK = p.hp <= 0 ? clamp((this.time - (this.overAt || 0)) / 0.35, 0, 1) : 0; Sprites.player(ctx, p, p.t); continue; }
        if (o.kind) { Sprites.pickup(ctx, o, tm); continue; }
        if (o === this.buddy) { const bd = o; Sprites.player(ctx, { x: bd.x, y: bd.y, scale: bd.scale, face: bd.face, moving: bd.moving, dashT: 0, hurtT: 0, deathK: 0, buddy: true, alpha: Math.min(1, bd.t0 * 4, bd.t * 2) }, bd.t0 + 1.7); continue; }
        const e = o;
        ctx.save();
        if (e.spawnT > 0) { ctx.globalAlpha = clamp(1 - e.spawnT / 0.75, 0.1, 1); }
        if (e.elite) { const R = e.r * e.scale * 2.6; ctx.drawImage(Sprites.glow('rgba(224,77,255,A)'), e.x - R, e.y - e.r * e.scale - R, R * 2, R * 2); }
        if (e.hitT > 0) { const q = e.hitT / 0.1; ctx.translate(e.x, e.y); ctx.scale(1 + 0.22 * q, 1 - 0.14 * q); ctx.translate(-e.x, -e.y); }
        Sprites[e.type](ctx, e, e.t);
        if (e.hitT > 0) { ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, e.hitT / 0.06); Sprites.noShadow = true; Sprites[e.type](ctx, e, e.t); if (!e.boss) Sprites[e.type](ctx, e, e.t); Sprites.noShadow = false; }
        ctx.restore();
        if (e.boss) {
          // nothing: boss bar is in the HUD
        } else if (e.hp < e.maxhp && !e.small) {
          const w = 36 * e.scale, y = e.y + 6;
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - w / 2, y, w, 4);
          ctx.fillStyle = e.elite ? '#e04dff' : '#ff4d6d'; ctx.fillRect(e.x - w / 2, y, w * clamp(e.hp / e.maxhp, 0, 1), 4);
        }
      }
      // x-ray: keep the player visible when a big sprite covers him
      if (this.state === 'playing' && this.enemies.some(e => !e.dead && e.y > p.y && Math.abs(e.x - p.x) < e.r * e.scale * (e.boss ? 1.6 : 1.1) && e.y - p.y < (e.boss ? 260 : 80) * e.scale)) {
        ctx.save(); ctx.globalAlpha = 0.45; Sprites.player(ctx, p, p.t); ctx.restore();
      }
      // orbit orbs
      const orbit = p.weapons.find(w => w.id === 'orbit');
      if (orbit) { const d = WEAPONS.orbit, n = this.orbitCount(orbit), R = d.radius(orbit.lvl), oR = d.orbR(orbit.lvl); for (let i = 0; i < n; i++) { const a = p.orbitA + i / n * 6.283; Sprites.orb(ctx, p.x + Math.cos(a) * R, p.y - 40 + Math.sin(a) * R * 0.6, oR, tm, orbit.evo); } }
      // bullets
      for (const b of this.bullets) { if (b.kind === 'ring') Sprites.ring(ctx, b, tm); else if (b.kind === 'chip') Sprites.chipBullet(ctx, b, tm); else Sprites.fireball(ctx, b, tm); }
      for (const b of this.ebullets) Sprites.enemyBullet(ctx, b);
    }
    FX.draw(ctx);
    // front smoke haze
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) { const s = this.smokeLayer[i], cx = W - s.x, cy = s.y * 0.8 + 100, R = s.r * 1.4; const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R); g.addColorStop(0, `rgba(240,225,255,${s.a * 0.7})`); g.addColorStop(1, 'rgba(240,225,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // vignette + flash
    if (L) ctx.drawImage(L.vignette, 0, 0, W, H);
    if (p && p.hp < p.maxhp * 0.3 && this.state === 'playing') { const a = 0.18 + Math.sin(real * 6) * 0.1; const lg = ctx.createRadialGradient(640, 360, 350, 640, 360, 800); lg.addColorStop(0, 'rgba(255,0,40,0)'); lg.addColorStop(1, `rgba(255,0,40,${a})`); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); }
    if (FX.flash > 0) { ctx.globalAlpha = Math.min(1, FX.flash); ctx.fillStyle = FX.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // crosshair / touch controls
    if (this.state === 'playing' || this.state === 'levelup') {
      if (!Input.touchMode) { const m = Input.mouse; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, 6.283); ctx.moveTo(m.x - 16, m.y); ctx.lineTo(m.x - 6, m.y); ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 16, m.y); ctx.moveTo(m.x, m.y - 16); ctx.lineTo(m.x, m.y - 6); ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 16); ctx.stroke(); }
      else this.drawTouch(ctx);
    }
  },
  drawTouch(ctx) {
    for (const name of ['move', 'aim']) {
      const s = Input.sticks[name];
      const ox = s ? clamp(s.ox, 80, W - 80) : (name === 'move' ? 180 : W - 330), oy = s ? clamp(s.oy, 80, H - 80) : H - 170;
      ctx.globalAlpha = s ? 0.5 : 0.18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ox, oy, 70, 0, 6.283); ctx.stroke();
      if (s) { const v = Input.stickVec(name, 0); ctx.fillStyle = name === 'move' ? '#ffd23f' : '#e04dff'; ctx.beginPath(); ctx.arc(ox + v.x * 70, oy + v.y * 70, 30, 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 0.45; const p = this.player, B = Input.BTN;
    ctx.fillStyle = p.dashCd <= 0 ? '#fff' : '#777'; ctx.beginPath(); ctx.arc(B.dash.x, B.dash.y, B.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = p.special >= 1 ? '#ffd23f' : '#777'; ctx.beginPath(); ctx.arc(B.special.x, B.special.y, B.r, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.font = '900 26px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💨', B.dash.x, B.dash.y); ctx.fillText('😂', B.special.x, B.special.y);
  },
};
