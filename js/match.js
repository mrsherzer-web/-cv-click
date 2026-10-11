/* Katzir FC — 8-a-side match engine: physics, AI, input and a 2.5D broadcast-camera renderer. */
window.KFC = window.KFC || {};

KFC.Match = (function () {
  'use strict';
  const D = KFC.DATA;

  // ---------- pitch geometry (metres) ----------
  const L = 84, W = 52, CY = W / 2;
  const GW = 6.6, GH = 2.35, GD = 2.0, POST_R = 0.07;
  const PEN_L = 13.5, PEN_W = 30, SIX_L = 4.8, SIX_W = 14, CC_R = 7.5, SPOT = 9.5;
  const PR = 0.45, BR = 0.18, GRAV = 9.81, ROLL = 2.5, AIR = 0.009, EXAG = 1.36;
  const STEP = 1 / 120, CTRL_R = 0.95;

  const rnd = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hyp = Math.hypot;
  const randn = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function colorDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return hyp(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
  function shade(h, k) { const c = hexRgb(h).map(v => clamp(Math.round(v * k), 0, 255)); return 'rgb(' + c.join(',') + ')'; }

  function create(opts) {
    const canvas = opts.canvas;
    const ctx = canvas.getContext('2d');
    const ui = opts.ui;
    const diff = D.DIFFICULTY[opts.difficulty] || D.DIFFICULTY.normal;
    const halfSeconds = Math.max(1, opts.minutes) * 60;
    const clockRate = 2700 / halfSeconds;

    // ---------- teams ----------
    const opp = opts.away;
    const oppKit = { shirt: opp.primary, sleeve: opp.primary, trim: opp.secondary, shorts: opp.shorts, socks: opp.socks, num: opp.secondary };
    let homeKit = D.KITS[opts.kit] || null;
    if (!homeKit) {
      homeKit = ['home', 'vamos', 'away'].map(k => D.KITS[k])
        .sort((a, b) => colorDist(b.shirt, opp.primary) - colorDist(a.shirt, opp.primary))[0];
    }
    const homeGK = { shirt: '#141414', sleeve: '#141414', trim: '#e8c26a', shorts: '#141414', socks: '#141414', num: '#e8c26a' };
    const oppGK = colorDist(opp.primary, '#b7f34a') > 160
      ? { shirt: '#b7f34a', sleeve: '#b7f34a', trim: '#1a1a1a', shorts: '#1a1a1a', socks: '#b7f34a', num: '#1a1a1a' }
      : { shirt: '#ff8a1e', sleeve: '#ff8a1e', trim: '#1a1a1a', shorts: '#1a1a1a', socks: '#ff8a1e', num: '#1a1a1a' };

    const teams = [
      { idx: 0, user: true, dir: 1, attackX: L, ownX: 0, kit: homeKit, gkKit: homeGK, name: 'KATZIR', code: 'KAT', players: [], color: homeKit.shirt },
      { idx: 1, user: false, dir: -1, attackX: 0, ownX: L, kit: oppKit, gkKit: oppGK, name: opp.en, code: opp.code, players: [], color: opp.primary, style: opp.style }
    ];
    teams[0].opp = teams[1]; teams[1].opp = teams[0];

    const headCache = {};
    function headImg(id) {
      if (headCache[id] !== undefined) return headCache[id];
      const im = new Image();
      im.decoding = 'async';
      im.src = 'assets/heads/' + id + '.png';
      headCache[id] = im;
      return im;
    }

    function makePlayer(team, card, slot, i) {
      const pd = card.player;
      const st = card.stats;
      const gk = slot.role === 'GK';
      const s = pd.gk
        ? { pac: st.spd, sho: 45, pas: st.kic, dri: 50, def: 55, phy: 72, div: st.div, han: st.han, ref: st.ref, gpos: st.pos }
        : Object.assign({ div: 40, han: 40, ref: 45, gpos: 40 }, st);
      if (gk && !pd.gk) { s.div = s.def; s.han = s.def; s.ref = s.def; s.gpos = s.def; }
      const isOpp = !team.user;
      const ai = isOpp ? diff.ai : 1;
      const pace = s.pac / 100;
      const first = pd.real ? pd.he.split(' ')[0] : (pd.nickHe || pd.he.replace(/"[^"]*"\s*/, '').split(' ')[0]);
      return {
        team, i, card, data: pd, role: slot.role, slot, gk,
        s, ovr: card.ovr, goat: card.edition === 'goat' || !!pd.goat,
        x: 0, y: 0, vx: 0, vy: 0, dir: team.dir > 0 ? 0 : Math.PI,
        vmax: (5.3 + pace * 2.9) * (isOpp ? 0.9 + 0.1 * ai : 1) * (card.edition === 'goat' ? 1.05 : 1),
        sprintK: 1.3, acc: 15 + pace * 11,
        anim: rnd() * 6, kickT: 0, stunT: 0, down: false, slideT: 0, slideDx: 0, slideDy: 0, noCtrlT: 0, celebT: 0, tackleCd: 0,
        dive: null, hold: 0, sprinting: false,
        tx: 0, ty: 0, urg: 0.7,
        ai: { t: rnd() * 0.4 },
        head: team.user ? headImg(pd.id) : null,
        label: first,
        goals: 0, assists: 0, shots: 0, tackles: 0, saves: 0, passes: 0
      };
    }

    const forms = [D.FORMATIONS.katzir, D.FORMATIONS.rival];
    opts.home.cards.forEach((card, i) => teams[0].players.push(makePlayer(teams[0], card, forms[0][i], i)));
    opp.roster.forEach((pl, i) => teams[1].players.push(makePlayer(teams[1], { player: pl, stats: pl.stats, ovr: pl.ovr, edition: 'gold' }, forms[1][i], i)));
    teams.forEach(t => { t.gk = t.players.find(p => p.gk); });
    const all = teams[0].players.concat(teams[1].players);

    // ---------- state ----------
    const ball = { x: L / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, lastTeam: null, rot: 0, trail: [] };
    const S = {
      time: 0, clock: 0, half: 1, phase: 'intro', phaseT: 0, score: [0, 0], paused: false, over: false,
      kickTeam: 0, firstKick: 0, active: null, switchT: 0, shot: null, pass: null, restart: null,
      slowmo: 0, flash: 0, shake: 0, goalInfo: null, lastLiamLine: -99, lastSaveLine: -99,
      possession: [0.001, 0.001], shots: [0, 0], onTarget: [0, 0], goals: [], halfDone: false, crowdJump: 0
    };
    const particles = [];
    const cam = { x: L / 2, oy: 0, tx: L / 2 };
    const V = { F: 1000, D0: W * 1.5, camH: W * 1.5 * 0.6, cw: 800, ch: 450, dpr: 1, oyMin: 0, oyMax: 0, sN: 20 };

    // ---------- input ----------
    const input = { mx: 0, my: 0, stickX: 0, stickY: 0, sprint: false, keys: {}, passDown: false, passT: 0, shootDown: false, shootT: 0, charging: false };

    function hasBallUser() { return ball.owner && ball.owner.team.user; }

    function onPassPress() {
      if (S.paused || S.phase !== 'play') return;
      input.passDown = true; input.passT = 0;
      if (!hasBallUser()) switchToBest(true);
    }
    function onPassRelease() {
      if (!input.passDown) return;
      input.passDown = false;
      if (S.paused || S.phase !== 'play') return;
      const p = S.active;
      if (p && ball.owner === p) userPass(p, input.passT > 0.28);
    }
    function onShootPress() {
      if (S.paused || S.phase !== 'play') return;
      input.shootDown = true; input.shootT = 0;
      const p = S.active;
      if (!p) return;
      if (ball.owner === p) { input.charging = true; }
      else if (!ball.owner && p.noCtrlT <= 0 && hyp(ball.x - p.x, ball.y - p.y) < 1.4 && ball.z < 0.9) { take(p); input.charging = true; }
      else if (!ball.owner && p && hyp(ball.x - p.x, ball.y - p.y) < 1.6 && ball.z > 0.7 && ball.z < 2.7) { header(p); input.shootDown = false; }
      else userTackle(p);
    }
    function onShootRelease() {
      if (!input.shootDown) return;
      input.shootDown = false;
      if (input.charging) {
        input.charging = false;
        const p = S.active;
        if (p && ball.owner === p && S.phase === 'play') shoot(p, clamp(input.shootT / 0.85, 0.18, 1), userAimHint());
      }
    }
    function userAimHint() {
      const m = hyp(input.mx, input.my);
      if (m < 0.25) return null;
      return clamp(input.my / Math.max(0.35, m) * 1.15, -1, 1);
    }

    const keyMap = {
      ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
      ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyL: 'sprint',
      KeyJ: 'pass', KeyX: 'pass', KeyK: 'shoot', Space: 'shoot', KeyQ: 'switch', KeyE: 'switch'
    };
    function keydown(e) {
      const k = keyMap[e.code];
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); togglePause(); return; }
      if (!k) return;
      e.preventDefault();
      if (input.keys[k]) return;
      input.keys[k] = true;
      if (k === 'pass') onPassPress();
      if (k === 'shoot') onShootPress();
      if (k === 'switch' && !hasBallUser()) switchToBest(true);
    }
    function keyup(e) {
      const k = keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      input.keys[k] = false;
      if (k === 'pass') onPassRelease();
      if (k === 'shoot') onShootRelease();
    }
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    function blur() { input.keys = {}; input.stickX = input.stickY = 0; }
    window.addEventListener('blur', blur);

    // Touch controls are wired by the UI; it calls these.
    const touchApi = {
      stick(x, y) { input.stickX = x; input.stickY = y; },
      sprint(v) { input.sprint = v; },
      pass(down) { down ? onPassPress() : onPassRelease(); },
      shoot(down) { down ? onShootPress() : onShootRelease(); }
    };

    function readInput(dt) {
      let mx = input.stickX, my = input.stickY;
      if (input.keys.l) mx -= 1; if (input.keys.r) mx += 1; if (input.keys.u) my += 1; if (input.keys.d) my -= 1;
      const m = hyp(mx, my);
      if (m > 1) { mx /= m; my /= m; }
      input.mx = mx; input.my = my;
      if (input.passDown) input.passT += dt;
      if (input.shootDown) {
        input.shootT += dt;
        if (input.charging && input.shootT > 1.05) onShootRelease();
      }
    }

    // ---------- view / projection ----------
    function resize() {
      const r = canvas.getBoundingClientRect();
      V.dpr = Math.min(window.devicePixelRatio || 1, 2);
      V.cw = Math.max(320, r.width); V.ch = Math.max(240, r.height);
      canvas.width = Math.round(V.cw * V.dpr); canvas.height = Math.round(V.ch * V.dpr);
      const portrait = V.ch > V.cw * 1.15;
      const targetH = portrait ? clamp(V.cw * 0.135, 46, 74) : clamp(Math.min(V.ch * 0.118, V.cw * 0.072), 46, 96);
      V.sN = targetH / (1.8 * EXAG);
      V.D0 = W * 1.12; V.camH = V.D0 * 0.62; V.F = V.sN * V.D0;
      const nearY = V.camH * V.F / V.D0, farY = V.camH * V.F / (V.D0 + W);
      V.oyMin = farY - V.ch * (portrait ? 0.3 : 0.24);
      V.oyMax = nearY - V.ch * (portrait ? 0.8 : 0.94);
      if (V.oyMax < V.oyMin) { const m = (V.oyMin + V.oyMax) / 2; V.oyMin = V.oyMax = m; }
    }
    function proj(x, y, z) {
      const d = y + V.D0, s = V.F / d;
      return { x: V.cw / 2 + (x - cam.x) * s, y: (V.camH - z) * s - cam.oy, s };
    }
    function scaleAt(y) { return V.F / (y + V.D0); }

    // ---------- placement ----------
    function kickoffPositions(kickTeam) {
      teams.forEach(t => {
        t.players.forEach(p => {
          const sx = Math.min(p.slot.x, 0.46) * 0.98;
          p.x = t.dir > 0 ? sx * L : L - sx * L;
          p.y = p.slot.y * W;
          p.vx = p.vy = 0; p.dir = t.dir > 0 ? 0 : Math.PI;
          p.stunT = 0; p.slideT = 0; p.kickT = 0; p.dive = null; p.hold = 0; p.celebT = 0; p.down = false; p.noCtrlT = 0;
        });
      });
      const t = teams[kickTeam];
      const fw = t.players.filter(p => p.role === 'FWD').sort((a, b) => Math.abs(a.slot.y - 0.5) - Math.abs(b.slot.y - 0.5));
      if (fw[0]) { fw[0].x = L / 2 - t.dir * 0.7; fw[0].y = CY; }
      if (fw[1]) { fw[1].x = L / 2 - t.dir * 2.5; fw[1].y = CY + 6; }
      t.opp.players.forEach(p => {
        const dx = p.x - L / 2, dy = p.y - CY;
        if (hyp(dx, dy) < CC_R + 1) { const a = Math.atan2(dy, dx || t.opp.dir * -1); p.x = L / 2 + Math.cos(a) * (CC_R + 1.5); p.y = CY + Math.sin(a) * (CC_R + 1.5); }
        if (t.opp.dir > 0 && p.x > L / 2 - 1) p.x = L / 2 - 1; if (t.opp.dir < 0 && p.x < L / 2 + 1) p.x = L / 2 + 1;
      });
      Object.assign(ball, { x: L / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, lastTeam: null, trail: [] });
      S.shot = null; S.pass = null; S.restart = null;
      S.kickTaker = fw[0] || t.players[1];
      setActive(teams[0].players.find(p => p.role === 'FWD') || teams[0].players[1]);
      cam.x = L / 2;
    }

    function setActive(p, silent) {
      if (!p || !p.team.user || p.gk || S.active === p) return;
      S.active = p; S.switchT = 0;
      if (!silent && ui.chip) ui.chip(p);
    }

    // ---------- kicking ----------
    function release(p, cool) {
      ball.owner = null; ball.last = p; ball.lastTeam = p.team;
      p.noCtrlT = cool == null ? 0.25 : cool;
      p.kickT = 0.24;
    }
    function playKick(power) {
      const pan = clamp((proj(ball.x, ball.y, 0).x / V.cw) * 2 - 1, -0.8, 0.8);
      KFC.Audio.play('kick', { vol: 0.45 + power * 0.55, rate: 1.1 - power * 0.2 + rnd() * 0.08, pan });
    }

    function predictBall(t) {
      // ground-roll prediction (ignores height)
      const sp = hyp(ball.vx, ball.vy);
      if (sp < 0.01) return { x: ball.x, y: ball.y };
      const tStop = sp / ROLL;
      const tt = Math.min(t, tStop);
      const dist = sp * tt - 0.5 * ROLL * tt * tt;
      return { x: ball.x + ball.vx / sp * dist, y: ball.y + ball.vy / sp * dist };
    }
    function interceptPoint(p) {
      if (ball.owner) return { x: ball.owner.x, y: ball.owner.y, t: hyp(ball.owner.x - p.x, ball.owner.y - p.y) / p.vmax };
      const sp = p.vmax * 1.12;
      for (let t = 0; t <= 3; t += 0.1) {
        const b = predictBall(t);
        if (hyp(b.x - p.x, b.y - p.y) <= sp * t + 0.6) return { x: b.x, y: b.y, t };
      }
      const b = predictBall(3);
      return { x: b.x, y: b.y, t: 3 + hyp(b.x - p.x, b.y - p.y) / sp };
    }

    function laneOpen(p, tx, ty) {
      const dx = tx - p.x, dy = ty - p.y, len = hyp(dx, dy) || 1;
      let worst = 99;
      for (const q of p.team.opp.players) {
        const t = clamp(((q.x - p.x) * dx + (q.y - p.y) * dy) / (len * len), 0, 1);
        const d = hyp(p.x + dx * t - q.x, p.y + dy * t - q.y);
        if (t > 0.05 && d < worst) worst = d;
      }
      return worst;
    }

    function passTo(p, r, lob) {
      const d0 = hyp(r.x - p.x, r.y - p.y);
      let speed = lob ? clamp(d0 * 0.75 + 7, 10, 21) : clamp(Math.sqrt(36 + 2 * ROLL * d0) * 1.08, 9, 27);
      const tt = d0 / Math.max(6, speed * (lob ? 1 : 0.82));
      const lx = clamp(r.x + r.vx * tt * 0.85, 0.5, L - 0.5), ly = clamp(r.y + r.vy * tt * 0.85, 0.5, W - 0.5);
      const dist = hyp(lx - p.x, ly - p.y);
      let ang = Math.atan2(ly - p.y, lx - p.x);
      const skill = p.s.pas / 100;
      ang += randn() * (1 - skill) * (p.team.user ? 0.07 : 0.1 / diff.ai);
      if (lob) {
        const hs = clamp(dist * 0.62 + 5, 8, 19);
        const T = dist / hs;
        ball.vx = Math.cos(ang) * hs; ball.vy = Math.sin(ang) * hs; ball.vz = GRAV * T * 0.5;
      } else {
        speed = clamp(Math.sqrt(30 + 2 * ROLL * dist) * 1.06, 9, 27);
        ball.vx = Math.cos(ang) * speed; ball.vy = Math.sin(ang) * speed; ball.vz = 0.4;
      }
      release(p);
      p.passes++;
      S.pass = { from: p, to: r, t: S.time };
      playKick(lob ? 0.6 : 0.4);
      if (p.team.user) setActive(r);
    }

    function kickInto(p, x, y, power, lob) {
      const ang = Math.atan2(y - p.y, x - p.x) + randn() * 0.08;
      const sp = 10 + power * 14;
      ball.vx = Math.cos(ang) * sp; ball.vy = Math.sin(ang) * sp; ball.vz = lob ? 5 + power * 5 : 0.3;
      release(p); S.pass = null; playKick(power);
    }

    function userPass(p, lob) {
      let dx = input.mx, dy = input.my;
      if (hyp(dx, dy) < 0.2) { dx = Math.cos(p.dir); dy = Math.sin(p.dir); }
      const da = Math.atan2(dy, dx);
      let best = null, bestS = -1e9;
      for (const r of p.team.players) {
        if (r === p) continue;
        const rx = r.x - p.x, ry = r.y - p.y, d = hyp(rx, ry);
        if (d < 2) continue;
        const a = Math.abs(angDiff(Math.atan2(ry, rx), da));
        if (a > 1.15) continue;
        const open = Math.min(5, laneOpen(p, r.x, r.y));
        const score = Math.cos(a) * 3 - d / (lob ? 40 : 22) + open * 0.35 - (r.gk ? 2.5 : 0);
        if (score > bestS) { bestS = score; best = r; }
      }
      if (best) passTo(p, best, lob);
      else kickInto(p, p.x + dx / hyp(dx, dy) * 14, p.y + dy / hyp(dx, dy) * 14, lob ? 0.55 : 0.35, lob);
    }

    function shoot(p, power, aimHint) {
      const t = p.team, gx = t.attackX;
      const gk = t.opp.gk;
      const dist = hyp(gx - p.x, CY - p.y);
      let aimY;
      if (aimHint != null) aimY = CY + aimHint * (GW / 2 - 0.5);
      else {
        const side = gk ? (gk.y > CY ? -1 : 1) : (rnd() < 0.5 ? -1 : 1);
        aimY = CY + side * (GW / 2 - 0.55 - rnd() * 0.9);
      }
      const skill = p.s.sho / 100;
      const goatK = p.goat ? 0.4 : 1;
      const aiK = t.user ? 1 : 1 / (0.55 + 0.45 * diff.ai);
      const speed = (14.5 + power * 15 + skill * 4.5) * (p.goat ? 1.1 : 1);
      let ang = Math.atan2(aimY - p.y, gx - p.x);
      const err = ((1 - skill) * 0.12 + Math.max(0, power - 0.86) * 0.22 + dist / 700) * goatK * aiK;
      ang += randn() * err;
      const aimZ = clamp(0.25 + power * 1.15 + Math.abs(randn()) * 0.4 * (1 - skill) * goatK + Math.max(0, power - 0.9) * 4, 0.12, 5);
      const T = dist / (speed * 0.93);
      ball.vx = Math.cos(ang) * speed; ball.vy = Math.sin(ang) * speed;
      ball.vz = (aimZ + 0.5 * GRAV * T * T) / T;
      ball.z = Math.max(ball.z, 0.12);
      release(p, 0.4);
      p.shots++; S.shots[t.idx]++;
      S.shot = { by: p, team: t, t0: S.time, speed, power, goat: p.goat };
      S.pass = null;
      playKick(0.75 + power * 0.25);
      planSave(p);
    }

    function header(p) {
      const t = p.team;
      const toGoal = Math.abs(t.attackX - p.x) < 24;
      if (toGoal) {
        const gk = t.opp.gk;
        const side = gk && gk.y > CY ? -1 : 1;
        const aimY = CY + side * (GW / 2 - 0.8) + randn() * 0.6;
        const ang = Math.atan2(aimY - p.y, t.attackX - p.x) + randn() * 0.06;
        const sp = 12 + p.s.phy / 100 * 6;
        ball.vx = Math.cos(ang) * sp; ball.vy = Math.sin(ang) * sp; ball.vz = -1.5 + rnd() * 2;
        release(p, 0.35); p.shots++; S.shots[t.idx]++;
        S.shot = { by: p, team: t, t0: S.time, speed: sp, power: 0.6, header: true };
        planSave(p);
      } else {
        kickInto(p, p.x + t.dir * 14, p.y + randn() * 4, 0.4, false);
      }
      p.kickT = 0.3;
      KFC.Audio.play('kick', { vol: 0.4, rate: 0.8 });
    }

    function planSave(shooter) {
      const gk = shooter.team.opp.gk;
      if (!gk || Math.abs(ball.vx) < 0.5) return;
      const gx = shooter.team.attackX;
      const tl = (gx - ball.x) / ball.vx;
      if (tl <= 0) return;
      const yc = ball.y + ball.vy * tl;
      const zc = ball.z + ball.vz * tl - 0.5 * GRAV * tl * tl;
      const onTarget = Math.abs(yc - CY) < GW / 2 + 0.05 && zc < GH + 0.05;
      S.shot.onTarget = onTarget; S.shot.yc = yc; S.shot.zc = zc;
      if (onTarget) S.onTarget[shooter.team.idx]++;
      const tg = Math.max(0.05, (gk.x - ball.x) / ball.vx);
      const yg = ball.y + ball.vy * tg;
      const zg = clamp(ball.z + ball.vz * tg - 0.5 * GRAV * tg * tg, 0.15, 2.6);
      const dy = Math.abs(yg - gk.y);
      const gkK = gk.team.user ? 1 : diff.gk;
      const react = (0.09 + (1 - gk.s.ref / 100) * 0.3) / gkK;
      const avail = Math.max(0, tg - react);
      const reach = 0.9 + gk.s.div / 100 * 2.6;
      const reachable = Math.min(reach, 0.55 + avail * 7.2);
      let pSave = 0.02;
      if (onTarget && dy <= reachable) {
        const placement = dy / Math.max(0.6, reachable);
        pSave = 0.98 - placement * 0.45 - Math.max(0, S.shot.speed - 19) * 0.024 + (gk.s.han - 75) / 260;
        if (zc > GH - 0.6) pSave -= 0.08;
        if (shooter.goat) pSave -= 0.28;
        pSave = clamp(pSave * gkK, 0.04, 0.93);
      }
      const willSave = onTarget && rnd() < pSave;
      const side = Math.sign(yg - gk.y) || 1;
      gk.dive = { t0: S.time + react, ty: willSave ? yg : yg - side * (0.7 + rnd() * 0.9), tz: zg, willSave, side, k: 0, lift: 0, active: false, end: S.time + react + 0.9 };
    }

    // ---------- tackles ----------
    function attemptTackle(q, o, bonus) {
      q.tackleCd = 0.75;
      let chance = 0.36 + (q.s.def - o.s.dri) / 115 + (bonus || 0);
      if (o.team.user && !o.sprinting) chance -= 0.1;   // close control shields the ball
      if (!q.team.user) chance *= 0.75 + 0.25 * diff.ai;
      if (o.goat) chance *= 0.55;
      chance = clamp(chance, 0.1, 0.86);
      if (rnd() < chance) {
        q.tackles++;
        o.stunT = 0.35;
        if (rnd() < 0.6) take(q);
        else {
          const a = q.dir + randn() * 0.5;
          ball.owner = null; ball.vx = Math.cos(a) * 5; ball.vy = Math.sin(a) * 5; ball.vz = 0.5;
          ball.last = q; ball.lastTeam = q.team; o.noCtrlT = 0.3;
        }
        KFC.Audio.play('kick', { vol: 0.3, rate: 0.75 });
        return true;
      }
      q.stunT = 0.45;
      return false;
    }

    function userTackle(p) {
      if (p.stunT > 0 || p.slideT > 0 || p.tackleCd > 0) return;
      const o = ball.owner;
      const tx = o ? o.x : ball.x, ty = o ? o.y : ball.y;
      const d = hyp(tx - p.x, ty - p.y);
      if (o && o.team !== p.team && d < 1.35) { attemptTackle(p, o, 0.1); return; }
      if (d < 3.6) {
        const a = Math.atan2(ty - p.y, tx - p.x);
        p.slideT = 0.5; p.slideDx = Math.cos(a); p.slideDy = Math.sin(a); p.dir = a; p.tackleCd = 0.9;
        spawnGrass(p.x, p.y, 10);
      }
    }

    // ---------- possession ----------
    function take(p) {
      const prevTeam = ball.lastTeam;
      ball.owner = p; ball.last = p; ball.lastTeam = p.team;
      ball.vz = 0; ball.z = 0;
      S.lastPassFrom = (S.pass && S.pass.from.team === p.team && S.pass.from !== p) ? S.pass.from : (S.lastPassFrom && S.lastPassFrom.team === p.team ? S.lastPassFrom : null);
      S.pass = null;
      if (S.shot) S.shot = null;
      p.noCtrlT = 0;
      if (p.team.user) {
        setActive(p);
        if (p.data.id === 'liam' && S.time - S.lastLiamLine > 45 && rnd() < 0.45) { S.lastLiamLine = S.time; say('liam_ball'); }
      } else if (prevTeam && prevTeam.user) {
        input.charging = false;
      }
    }

    function looseBallControl() {
      let best = null, bestD = 1e9;
      for (const p of all) {
        if (p.noCtrlT > 0 || p.stunT > 0 || (p.dive && p.dive.active)) continue;
        const reachZ = p.gk && inOwnBox(p, ball.x, ball.y) ? 2.5 : 1.0;
        if (ball.z > reachZ) continue;
        const d = hyp(ball.x - p.x, ball.y - p.y);
        const r = CTRL_R + (p.gk ? 0.55 : 0) + (p.slideT > 0 ? 0.35 : 0);
        if (d < r && d < bestD) { best = p; bestD = d; }
      }
      if (!best) return;
      const rel = hyp(ball.vx - best.vx, ball.vy - best.vy);
      const maxRel = 15 + best.s.dri * 0.11 + (best.gk ? 12 : 0);
      if (best.slideT > 0) {
        ball.vx = best.slideDx * 6 + randn(); ball.vy = best.slideDy * 6 + randn(); ball.vz = 0.6;
        ball.last = best; ball.lastTeam = best.team; best.noCtrlT = 0.3; best.tackles++;
        return;
      }
      if (rel > maxRel && !(S.pass && S.pass.to === best)) {
        // deflection
        ball.vx *= -0.35; ball.vy = ball.vy * 0.4 + randn() * 3; ball.vz = 1 + rnd() * 2;
        ball.last = best; ball.lastTeam = best.team; best.noCtrlT = 0.25;
        KFC.Audio.play('kick', { vol: 0.3, rate: 0.9 });
        return;
      }
      take(best);
    }

    function inOwnBox(p, x, y) {
      const ox = p.team.ownX;
      return Math.abs(x - ox) < PEN_L && Math.abs(y - CY) < PEN_W / 2;
    }

    // ---------- commentary ----------
    function say(id, force) { KFC.Audio.line(id, { force }); }

    // ---------- AI ----------
    function teamThink(t) {
      const dir = t.dir;
      const own = ball.owner;
      const hasBall = own && own.team === t;
      const oppBall = own && own.team !== t;
      const bu = dir > 0 ? ball.x / L : 1 - ball.x / L;
      let chaser = null, second = null;
      if (!hasBall) {
        let r = [];
        for (const p of t.players) {
          if (p.gk || p.stunT > 0) continue;
          r.push({ p, tt: interceptPoint(p).t });
        }
        r.sort((a, b) => a.tt - b.tt);
        chaser = r[0] && r[0].p; second = r[1] && r[1].p;
        // The user's teammates help: when the user is the one pressing, the next man in also closes down.
        if (t.user && chaser === S.active && oppBall && second) {
          const inOwnHalf = t.dir > 0 ? own.x < L * 0.55 : own.x > L * 0.45;
          if (inOwnHalf) { chaser = second; second = r[2] && r[2].p; }
        }
      }
      t.chaser = chaser;
      let support = null;
      if (hasBall) {
        let bd = 1e9;
        for (const p of t.players) {
          if (p === own || p.gk) continue;
          const d = hyp(p.x - own.x, p.y - own.y);
          if (d < bd) { bd = d; support = p; }
        }
      }
      for (const p of t.players) {
        if (p.gk || p === own) continue;
        if (t.user && p === S.active && S.phase === 'play') continue;
        let u;
        if (hasBall) u = clamp(p.slot.x * 0.8 + bu * 0.56 - 0.05, 0.06, 0.93);
        else if (oppBall) u = clamp(p.slot.x * 0.78 + bu * 0.5 - 0.18, 0.04, 0.8);
        else u = clamp(p.slot.x * 0.8 + bu * 0.52 - 0.1, 0.05, 0.86);
        let tx = dir > 0 ? u * L : (1 - u) * L;
        let ty = lerp(p.slot.y * W, ball.y, hasBall ? 0.16 : 0.3);
        let urg = 0.62;
        if (p === chaser) {
          if (oppBall) {
            const lead = clamp(hyp(own.x - p.x, own.y - p.y) / 9, 0.15, 0.7);
            const fx = own.x + own.vx * lead, fy = own.y + own.vy * lead;
            const gl = hyp(t.ownX - fx, CY - fy) || 1;
            tx = fx + (t.ownX - fx) / gl * 0.9; ty = fy + (CY - fy) / gl * 0.9;
          } else { const ip = interceptPoint(p); tx = ip.x; ty = ip.y; }
          urg = 1;
        } else if (oppBall && p === second) {
          tx = lerp(ball.x, t.ownX, 0.22); ty = lerp(ball.y, CY, 0.22); urg = 0.85;
        } else if (oppBall) {
          let m = null, md = 10;
          for (const q of t.opp.players) {
            if (q.gk || q === own) continue;
            const d = hyp(q.x - tx, q.y - ty);
            if (d < md) { md = d; m = q; }
          }
          if (m) { tx = lerp(tx, m.x - dir * 1.8, 0.6); ty = lerp(ty, m.y + (CY - m.y) * 0.1, 0.6); urg = 0.75; }
        } else if (hasBall) {
          if (p.role === 'FWD') {
            const ahead = own.x + dir * 11;
            tx = dir > 0 ? Math.max(tx, Math.min(L - 7, ahead)) : Math.min(tx, Math.max(7, ahead));
            ty = lerp(ty, p.slot.y * W, 0.45);
            urg = 0.8;
          }
          if (p === support) {
            const side = p.y > own.y ? 1 : -1;
            tx = own.x + dir * 4 + randn() * 0.1; ty = clamp(own.y + side * 9, 3, W - 3); urg = 0.78;
          }
        }
        if (S.pass && S.pass.to === p && !ball.owner) { const ip = interceptPoint(p); tx = ip.x; ty = ip.y; urg = 1; }
        if (S.phase === 'restart' && S.restart && S.restart.taker === p) { tx = S.restart.x; ty = S.restart.y; urg = 1; }
        p.tx = clamp(tx, 1.5, L - 1.5); p.ty = clamp(ty, 1, W - 1); p.urg = urg;
      }
    }

    function aiCarrier(p, dt) {
      const t = p.team, style = t.style || { press: 0.6, pass: 0.6, shoot: 0.6 };
      const gx = t.attackX;
      const dGoal = hyp(gx - p.x, CY - p.y);
      let near = null, nd = 99;
      for (const q of t.opp.players) { const d = hyp(q.x - p.x, q.y - p.y); if (d < nd) { nd = d; near = q; } }
      p.ai.t -= dt;
      if (p.ai.t <= 0) {
        p.ai.t = 0.28 + rnd() * 0.35;
        const angleOK = Math.abs(CY - p.y) < dGoal * 0.9;
        if (dGoal < 25 && angleOK) {
          const prob = (1 - dGoal / 26) * 0.55 * (0.6 + style.shoot * 0.6) * diff.ai + (dGoal < 12 ? 0.18 : 0);
          if (rnd() < prob) { shoot(p, clamp(0.55 + rnd() * 0.4 - (dGoal < 10 ? 0.15 : 0), 0.3, 0.97)); return; }
        }
        const pressured = nd < 3.0;
        if (pressured || rnd() < style.pass * 0.32) {
          let best = null, bs = -1e9;
          for (const r of t.players) {
            if (r === p || r.gk) continue;
            const d = hyp(r.x - p.x, r.y - p.y);
            if (d < 4 || d > 34) continue;
            const prog = (r.x - p.x) * t.dir;
            const open = Math.min(5, laneOpen(p, r.x, r.y));
            let mark = 99; for (const q of t.opp.players) mark = Math.min(mark, hyp(q.x - r.x, q.y - r.y));
            const sc = prog * 0.12 + open * 0.55 + Math.min(mark, 6) * 0.3 - d * 0.03;
            if (sc > bs) { bs = sc; best = r; }
          }
          if (best && (bs > 1.2 || pressured)) { passTo(p, best, hyp(best.x - p.x, best.y - p.y) > 22 && rnd() < 0.5); return; }
        }
      }
      // dribble toward goal, steering around defenders
      let dx = gx - p.x, dy = (CY - p.y) * 0.8;
      const dl = hyp(dx, dy) || 1; dx /= dl; dy /= dl;
      for (const q of t.opp.players) {
        const ox = p.x - q.x, oy = p.y - q.y, d = hyp(ox, oy);
        if (d < 5 && d > 0.01) { const k = (5 - d) / 5 * 0.9; dx += ox / d * k; dy += oy / d * k; }
      }
      if (p.y < 3) dy += 0.8; if (p.y > W - 3) dy -= 0.8;
      const m = hyp(dx, dy) || 1;
      p.tx = p.x + dx / m * 6; p.ty = p.y + dy / m * 6;
      p.urg = nd < 4 ? 1 : 0.82;
    }

    function gkThink(p, dt) {
      const t = p.team;
      if (ball.owner === p) {
        p.hold -= dt;
        p.tx = p.x; p.ty = p.y; p.urg = 0;
        if (p.hold <= 0) gkDistribute(p);
        return;
      }
      if (p.dive) return;
      const gx = t.ownX;
      const car = ball.owner;
      if (car && car.team !== t && inOwnBox(p, car.x, car.y) && hyp(car.x - p.x, car.y - p.y) < 9) {
        p.tx = car.x + car.vx * 0.25; p.ty = car.y + car.vy * 0.25; p.urg = 1;
        if (hyp(car.x - p.x, car.y - p.y) < 1.3 && p.tackleCd <= 0 && S.phase === 'play') {
          p.tackleCd = 0.9;
          const chance = clamp(0.5 + (p.s.div + p.s.gpos) / 2 / 220 - car.s.dri / 260 - (car.goat ? 0.2 : 0), 0.2, 0.85);
          if (rnd() < chance) { p.saves++; take(p); p.hold = 1.0; KFC.Audio.play('kick', { vol: 0.35, rate: 0.7 }); if (S.time - S.lastSaveLine > 8) { S.lastSaveLine = S.time; say('save'); } }
          else { p.stunT = 0.6; p.down = true; }
        }
        return;
      }
      const loose = !ball.owner;
      const bd = hyp(ball.x - p.x, ball.y - p.y);
      if (loose && inOwnBox(p, ball.x, ball.y) && !S.shot && (bd < 7 || t.chaser == null || interceptPoint(p).t < interceptPoint(t.chaser).t)) {
        const ip = interceptPoint(p); p.tx = ip.x; p.ty = ip.y; p.urg = 1; return;
      }
      const dxb = ball.x - gx, dyb = ball.y - CY, db = hyp(dxb, dyb) || 1;
      const r = clamp(db * 0.11, 0.7, 3.4) * (0.7 + p.s.gpos / 330);
      p.tx = gx + dxb / db * r;
      p.ty = clamp(CY + dyb / db * r * 1.6, CY - GW / 2 + 0.3, CY + GW / 2 - 0.3);
      p.urg = 0.8;
    }

    function gkDistribute(p) {
      const t = p.team;
      let best = null, bs = -1e9;
      for (const r of t.players) {
        if (r === p) continue;
        const d = hyp(r.x - p.x, r.y - p.y);
        let mark = 99; for (const q of t.opp.players) mark = Math.min(mark, hyp(q.x - r.x, q.y - r.y));
        const sc = Math.min(mark, 8) * 0.5 - Math.abs(d - 18) * 0.06 + (r.role === 'DEF' ? 0.6 : 0) + rnd() * 0.8;
        if (sc > bs) { bs = sc; best = r; }
      }
      if (best) passTo(p, best, hyp(best.x - p.x, best.y - p.y) > 20);
      else kickInto(p, L / 2, CY, 0.9, true);
    }

    function userAutoSwitch() {
      const t = teams[0];
      if (hasBallUser()) return;
      if (S.pass && S.pass.to && S.pass.to.team === t) return;
      const c = t.chaser;
      if (!c || c === S.active || S.switchT < 0.7) return;
      const a = S.active;
      const da = a ? interceptPoint(a).t : 99, dc = interceptPoint(c).t;
      const moving = hyp(input.mx, input.my) > 0.2;
      if (dc + (moving ? 0.9 : 0.35) < da) setActive(c);
    }

    function switchToBest(manual) {
      const t = teams[0];
      const ranked = t.players.filter(p => !p.gk).map(p => ({ p, tt: interceptPoint(p).t })).sort((a, b) => a.tt - b.tt);
      if (!ranked.length) return;
      let pick = ranked[0].p;
      if (manual && pick === S.active && ranked[1]) pick = ranked[1].p;
      setActive(pick);
    }

    // ---------- movement ----------
    function steer(p, dt, dvx, dvy) {
      const ax = dvx - p.vx, ay = dvy - p.vy, a = hyp(ax, ay);
      const maxA = p.acc * dt * (ball.owner === p ? 0.85 : 1);
      if (a > maxA) { p.vx += ax / a * maxA; p.vy += ay / a * maxA; } else { p.vx = dvx; p.vy = dvy; }
    }

    function movePlayer(p, dt) {
      p.kickT = Math.max(0, p.kickT - dt);
      p.noCtrlT = Math.max(0, p.noCtrlT - dt);
      p.tackleCd = Math.max(0, p.tackleCd - dt);
      if (p.celebT > 0) p.celebT -= dt;
      if (p.slideT > 0) {
        p.slideT -= dt;
        const sp = 8.5 * clamp(p.slideT / 0.5 + 0.3, 0, 1);
        p.vx = p.slideDx * sp; p.vy = p.slideDy * sp;
        if (p.slideT <= 0) { p.stunT = 0.45; p.down = true; }
      } else if (p.stunT > 0) {
        p.stunT -= dt;
        p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
        if (p.stunT <= 0) p.down = false;
      } else if (p.dive) {
        const dv = p.dive;
        if (S.time >= dv.t0) {
          dv.active = true;
          const dy = dv.ty - p.y;
          const sp = Math.min(Math.abs(dy) / dt, 7.8);
          p.vy = Math.sign(dy) * sp; p.vx = 0;
          dv.k = Math.min(1, dv.k + dt * 4);
          dv.lift = Math.min(dv.tz * 0.55, 0.9) * Math.sin(Math.min(1, (S.time - dv.t0) / 0.5) * Math.PI);
        } else { p.vx *= 0.8; p.vy *= 0.8; }
        if (S.time > dv.end) { p.dive = null; p.stunT = dv.active ? 0.5 : 0; p.down = dv.active; }
      } else if (p === S.active && p.team.user && S.phase === 'play') {
        const m = hyp(input.mx, input.my);
        const sprint = input.sprint || input.keys.sprint;
        p.sprinting = sprint && m > 0.2;
        let vmax = p.vmax * (p.sprinting ? p.sprintK : 1) * (ball.owner === p ? (p.sprinting ? 0.84 : 0.88) : 1);
        if (m > 0.12) steer(p, dt, input.mx / Math.max(m, 1) * vmax * Math.min(1, m * 1.3), input.my / Math.max(m, 1) * vmax * Math.min(1, m * 1.3));
        else if (S.pass && S.pass.to === p && !ball.owner) {
          const ip = interceptPoint(p); const dx = ip.x - p.x, dy = ip.y - p.y, d = hyp(dx, dy);
          if (d > 0.4) steer(p, dt, dx / d * p.vmax, dy / d * p.vmax); else steer(p, dt, 0, 0);
        } else steer(p, dt, 0, 0);
      } else {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
        const sprint = p.urg >= 1 && d > 5;
        p.sprinting = sprint;
        let vmax = p.vmax * p.urg * (sprint ? p.sprintK * 0.96 : 1);
        if (ball.owner === p) vmax *= 0.88;
        if (S.phase === 'restart' || S.phase === 'kickoff' || S.phase === 'intro') vmax = p.vmax * 1.15;
        const arrive = d < 2.5 ? d / 2.5 : 1;
        if (d > 0.25) steer(p, dt, dx / d * vmax * arrive, dy / d * vmax * arrive); else steer(p, dt, 0, 0);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, -1.2, L + 1.2); p.y = clamp(p.y, -1.0, W + 1.0);
      const sp = hyp(p.vx, p.vy);
      if (sp > 0.3 && !p.dive && p.slideT <= 0 && p.stunT <= 0) {
        const target = Math.atan2(p.vy, p.vx);
        const rate = ball.owner === p ? 6 + p.s.dri / 14 : 12;
        p.dir += clamp(angDiff(target, p.dir), -rate * dt, rate * dt);
      }
      p.anim += dt * (2.2 + sp * 1.9);
    }

    function separate() {
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        for (let j = i + 1; j < all.length; j++) {
          const b = all[j];
          const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), min = PR * 2;
          if (d < min && d > 0.0001) {
            const push = (min - d) / 2, nx = dx / d, ny = dy / d;
            const wa = b.s.phy / (a.s.phy + b.s.phy), wb = 1 - wa;
            a.x -= nx * push * wa * 2; a.y -= ny * push * wa * 2;
            b.x += nx * push * wb * 2; b.y += ny * push * wb * 2;
          }
        }
      }
    }

    // ---------- ball physics ----------
    function ballStep(dt) {
      if (ball.owner) {
        const o = ball.owner;
        const reach = o.sprinting ? 0.85 : 0.58;
        const fx = o.x + Math.cos(o.dir) * reach, fy = o.y + Math.sin(o.dir) * reach;
        const k = 1 - Math.exp(-dt * 16);
        const px = ball.x, py = ball.y;
        ball.x = lerp(ball.x, fx, k); ball.y = lerp(ball.y, fy, k); ball.z = 0;
        ball.vx = (ball.x - px) / dt; ball.vy = (ball.y - py) / dt; ball.vz = 0;
        ball.rot += hyp(ball.vx, ball.vy) * dt / BR;
        return;
      }
      const px = ball.x, py = ball.y;
      const sp = hyp(ball.vx, ball.vy, ball.vz);
      // air drag
      const drag = 1 - AIR * sp * dt;
      ball.vx *= drag; ball.vy *= drag; ball.vz *= drag;
      if (ball.z > 0.001 || ball.vz > 0) {
        ball.vz -= GRAV * dt;
        ball.z += ball.vz * dt;
        if (ball.z <= 0) {
          ball.z = 0;
          if (ball.vz < -1.2) { ball.vz = -ball.vz * 0.52; ball.vx *= 0.86; ball.vy *= 0.86; }
          else ball.vz = 0;
        }
      } else {
        const g = hyp(ball.vx, ball.vy);
        if (g > 0) {
          const ng = Math.max(0, g - ROLL * dt);
          ball.vx *= ng / g; ball.vy *= ng / g;
        }
      }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.rot += hyp(ball.vx, ball.vy) * dt / BR;
      goalFrame(px, py);
    }

    function goalFrame(px, py) {
      for (const gx of [0, L]) {
        if (Math.abs(ball.x - gx) > 1.2 && Math.abs(px - gx) > 1.2) continue;
        // posts
        for (const py0 of [CY - GW / 2, CY + GW / 2]) {
          if (ball.z > GH + BR) continue;
          const dx = ball.x - gx, dy = ball.y - py0, d = hyp(dx, dy), min = BR + POST_R;
          if (d < min && d > 0.0001) {
            const nx = dx / d, ny = dy / d, vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) {
              ball.vx -= 1.75 * vn * nx; ball.vy -= 1.75 * vn * ny;
              ball.x = gx + nx * min; ball.y = py0 + ny * min;
              woodwork();
            }
          }
        }
        // crossbar
        if (Math.abs(ball.y - CY) < GW / 2) {
          const dx = ball.x - gx, dz = ball.z - GH, d = hyp(dx, dz), min = BR + POST_R;
          if (d < min && d > 0.0001) {
            const nx = dx / d, nz = dz / d, vn = ball.vx * nx + ball.vz * nz;
            if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vz -= 1.7 * vn * nz; ball.x = gx + nx * min; ball.z = GH + nz * min; woodwork(); }
          }
        }
      }
    }

    let lastWood = -9;
    function woodwork() {
      if (S.time - lastWood < 0.4) return;
      lastWood = S.time;
      KFC.Audio.play('post', { vol: 0.9 });
      S.shake = Math.max(S.shake, 5);
      if (S.shot && S.phase === 'play') { KFC.Audio.play('ooh', { vol: 0.8 }); say('post'); }
      if (S.shot) S.shot.wood = true;
    }

    function checkGoalOrOut(prevX) {
      if (S.phase !== 'play') return;
      // goal lines
      for (const side of [0, 1]) {
        const gx = side === 0 ? 0 : L;
        const crossed = side === 0 ? (prevX >= 0 && ball.x < 0) : (prevX <= L && ball.x > L);
        if (!crossed) continue;
        const inMouth = Math.abs(ball.y - CY) < GW / 2 - BR * 0.5 && ball.z < GH - BR * 0.3;
        const scorer = side === 0 ? teams[1] : teams[0];
        if (inMouth) { goal(scorer); return; }
        const defending = scorer.opp;
        if (S.shot && S.phase === 'play') {
          const near = Math.abs(Math.abs(ball.y - CY) - GW / 2) < 1.6 || (ball.z > GH && ball.z < GH + 1.2);
          if (near && !S.shot.wood) { KFC.Audio.play('ooh', { vol: 0.75 }); say('miss'); }
        }
        if (ball.lastTeam === defending) setRestart('corner', scorer, gx === 0 ? 0.6 : L - 0.6, ball.y < CY ? 0.6 : W - 0.6);
        else setRestart('goalkick', defending, gx === 0 ? SIX_L : L - SIX_L, CY + (ball.y < CY ? -4 : 4));
        return;
      }
      if (ball.y < -BR || ball.y > W + BR) {
        const team = ball.lastTeam ? ball.lastTeam.opp : teams[0];
        setRestart('throw', team, clamp(ball.x, 1, L - 1), ball.y < 0 ? 0 : W);
      }
    }

    function setRestart(type, team, x, y) {
      S.phase = 'restart'; S.phaseT = 0;
      if (ball.owner) ball.owner = null;
      S.restart = { type, team, x, y };
      S.shot = null; S.pass = null;
      let taker;
      if (type === 'goalkick') taker = team.gk;
      else {
        let bd = 1e9;
        for (const p of team.players) { if (p.gk) continue; const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; taker = p; } }
      }
      S.restart.taker = taker;
      KFC.Audio.play('whistle', { vol: 0.55 });
      if (team.user && taker && !taker.gk) setActive(taker, true);
    }

    function execRestart() {
      const r = S.restart;
      const p = r.taker;
      Object.assign(ball, { x: r.x, y: r.y, z: 0, vx: 0, vy: 0, vz: 0 });
      p.x = r.x - (r.type === 'throw' ? 0 : r.team.dir * 0.4); p.y = r.type === 'throw' ? (r.y === 0 ? -0.4 : W + 0.4) : r.y;
      p.vx = p.vy = 0;
      ball.owner = null; ball.last = p; ball.lastTeam = r.team;
      S.phase = 'play'; S.restart = null;
      if (r.type === 'corner') {
        // cross into the box toward the best-placed teammate
        const gx = r.team.attackX;
        let best = null, bs = -1e9;
        for (const q of r.team.players) {
          if (q === p || q.gk) continue;
          const d = hyp(q.x - (gx - r.team.dir * SPOT), q.y - CY);
          const sc = -d + rnd() * 3;
          if (sc > bs) { bs = sc; best = q; }
        }
        const tx = gx - r.team.dir * (6 + rnd() * 5), ty = CY + randn() * 4;
        if (best) { best.x = lerp(best.x, tx, 0.5); best.y = lerp(best.y, ty, 0.5); }
        const ang = Math.atan2(ty - p.y, tx - p.x), dist = hyp(tx - p.x, ty - p.y);
        const hs = clamp(dist * 0.6 + 6, 10, 18), T = dist / hs;
        ball.vx = Math.cos(ang) * hs; ball.vy = Math.sin(ang) * hs; ball.vz = GRAV * T * 0.5;
        release(p); playKick(0.6);
        if (best) { S.pass = { from: p, to: best, t: S.time }; if (r.team.user) setActive(best); }
      } else if (r.type === 'throw') {
        let best = null, bs = -1e9;
        for (const q of r.team.players) {
          if (q === p || q.gk) continue;
          const d = hyp(q.x - p.x, q.y - p.y);
          if (d > 22) continue;
          let mark = 99; for (const o of r.team.opp.players) mark = Math.min(mark, hyp(o.x - q.x, o.y - q.y));
          const sc = Math.min(mark, 6) - d * 0.12 + (q.x - p.x) * r.team.dir * 0.05;
          if (sc > bs) { bs = sc; best = q; }
        }
        if (best) {
          const ang = Math.atan2(best.y - p.y, best.x - p.x), dist = hyp(best.x - p.x, best.y - p.y);
          const hs = clamp(dist * 0.7 + 4, 6, 13), T = dist / hs;
          ball.z = 1.8; ball.vx = Math.cos(ang) * hs; ball.vy = Math.sin(ang) * hs; ball.vz = GRAV * T * 0.5 - 1.8 / T;
          release(p, 0.5); S.pass = { from: p, to: best, t: S.time };
          if (r.team.user) setActive(best);
        } else { ball.owner = p; }
      } else {
        // goal kick: keeper starts with the ball
        ball.owner = p; p.hold = 0.6;
      }
    }

    function goal(team) {
      S.phase = 'goal'; S.phaseT = 0;
      S.score[team.idx]++;
      const shooter = S.shot && S.shot.team === team ? S.shot.by : (ball.last && ball.last.team === team ? ball.last : null);
      const scorer = shooter || team.players.find(p => p.role === 'FWD') || team.players[1];
      scorer.goals++;
      const assist = S.lastPassFrom && S.lastPassFrom.team === team && S.lastPassFrom !== scorer ? S.lastPassFrom : null;
      if (assist) assist.assists++;
      const minute = Math.min(90, Math.floor(S.clock / 60) + 1);
      const info = { team: team.idx, scorer, assist, minute, score: S.score.slice(), goat: scorer.goat && team.user };
      S.goals.push(info);
      S.goalInfo = info;
      S.slowmo = 1.1; S.flash = 1; S.shake = 9;
      S.crowdJump = team.user ? 1 : 0.25;
      scorer.celebT = 4;
      S.shot = null; S.pass = null;
      KFC.Audio.play('net', { vol: 0.9 });
      KFC.Audio.play('roar', { vol: team.user ? 1 : 0.45, delay: 0.05 });
      if (team.user) {
        const lid = 'goal_' + scorer.data.id;
        say(D.LINES[lid] ? lid : 'goal_generic', true);
        confetti(team.user ? ['#e8c26a', '#fff1bd', team.kit.shirt, '#ffffff'] : ['#ffffff']);
      } else {
        say('conceded', true);
      }
      if (ui.score) ui.score(S.score);
    }

    // ---------- particles ----------
    function spawnGrass(x, y, n) {
      for (let i = 0; i < n; i++) particles.push({ kind: 'grass', x, y, z: 0.05, vx: randn() * 2, vy: randn() * 2, vz: 1.5 + rnd() * 2, life: 0.7, c: rnd() < 0.5 ? '#3a8a43' : '#2a6b33' });
    }
    function confetti(colors) {
      for (let i = 0; i < 160; i++) {
        particles.push({ kind: 'conf', sx: rnd() * V.cw, sy: -20 - rnd() * V.ch * 0.6, vx: randn() * 40, vy: 60 + rnd() * 120, rot: rnd() * 6, vr: randn() * 8, life: 4 + rnd() * 2, c: colors[i % colors.length], w: 5 + rnd() * 6, h: 3 + rnd() * 4 });
      }
    }
    function updateParticles(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.life -= dt;
        if (q.life <= 0) { particles.splice(i, 1); continue; }
        if (q.kind === 'grass') { q.vz -= GRAV * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt); }
        else { q.sx += q.vx * dt + Math.sin(q.life * 3 + q.rot) * 20 * dt; q.sy += q.vy * dt; q.rot += q.vr * dt; }
      }
    }

    // ---------- main simulation step ----------
    function step(dt) {
      S.time += dt; S.phaseT += dt; S.switchT += dt;
      if (S.phase === 'play') {
        S.clock += dt * clockRate;
        if (ball.owner) S.possession[ball.owner.team.idx] += dt;
        const limit = 2700 * S.half;
        if (S.clock >= limit && !S.shot) { endHalf(); return; }
      }
      if (S.phase === 'intro') {
        if (S.phaseT > 2.6) startKickoff(S.kickTeam);
      } else if (S.phase === 'kickoff') {
        if (S.phaseT > 1.1) {
          S.phase = 'play'; S.phaseT = 0;
          KFC.Audio.play('whistle', { vol: 0.7 });
          const k = S.kickTaker;
          if (k) { take(k); if (!k.team.user) { k.ai.t = 0.15; } }
        }
      } else if (S.phase === 'restart') {
        if (S.phaseT > 0.95 && S.restart) execRestart();
      } else if (S.phase === 'goal') {
        if (S.phaseT > 0.9 && !S.goalShown) { S.goalShown = true; if (ui.goal) ui.goal(S.goalInfo); }
        if (S.phaseT > 4.6) { S.goalShown = false; if (ui.goalEnd) ui.goalEnd(); startKickoff(S.goalInfo.team === 0 ? 1 : 0); }
      }

      S.thinkN = (S.thinkN || 0) + 1;
      if (S.thinkN % 3 === 0 || S.phase !== 'play') { teamThink(teams[0]); teamThink(teams[1]); }
      for (const t of teams) { if (t.gk) gkThink(t.gk, dt); }
      if (ball.owner && !ball.owner.team.user && !ball.owner.gk && S.phase === 'play') aiCarrier(ball.owner, dt);
      if (ball.owner && ball.owner.team.user && ball.owner.gk && S.phase === 'play') { /* keeper distributes on its own */ }
      if (S.phase === 'play') userAutoSwitch();

      // AI pressing / tackles on carriers
      if (S.phase === 'play' && ball.owner) {
        const o = ball.owner;
        for (const q of o.team.opp.players) {
          if (q.gk || q.stunT > 0 || q.tackleCd > 0 || (q.team.user && q === S.active)) continue;
          const d = hyp(q.x - o.x, q.y - o.y);
          if (d < 1.15) {
            const rate = q.team.user ? 1.1 : (0.55 + (q.team.style ? q.team.style.press : 0.6)) * diff.ai;
            if (rnd() < rate * dt * 2.0) attemptTackle(q, o, q.team.user ? 0.06 : 0);
            else q.tackleCd = 0.2;
          }
        }
      }

      const frozen = S.phase === 'intro' || S.phase === 'kickoff';
      for (const p of all) {
        if (frozen) { p.vx = p.vy = 0; p.anim += dt * 2; continue; }
        if (S.phase === 'goal' && p.celebT > 0 && p === S.goalInfo.scorer) {
          const cx = p.team.attackX - p.team.dir * 4, cyy = p.y < CY ? 2 : W - 2;
          p.tx = cx; p.ty = cyy; p.urg = 1;
        }
        movePlayer(p, dt);
      }
      separate();

      const prevX = ball.x;
      ballStep(dt);
      if (!ball.owner && S.phase === 'play') looseBallControl();
      if (!ball.owner && S.pass && S.time - S.pass.t > 3) S.pass = null;

      // keeper saves
      for (const t of teams) {
        const gk = t.gk;
        if (!gk || !gk.dive || !gk.dive.active || ball.owner) continue;
        const handX = gk.x, handY = gk.y, handZ = 0.6 + gk.dive.lift;
        const d = hyp(ball.x - handX, ball.y - handY, (ball.z - handZ) * 0.6);
        if (gk.dive.willSave && d < 1.25) {
          gk.saves++;
          const sp = hyp(ball.vx, ball.vy);
          if (sp < 22 && rnd() < gk.s.han / 105) {
            take(gk); gk.hold = 1.1; gk.dive.end = S.time + 0.25;
          } else {
            ball.vx = -ball.vx * 0.28 + t.dir * 2; ball.vy = (ball.y >= CY ? 1 : -1) * (4 + rnd() * 4); ball.vz = 2 + rnd() * 3;
            ball.last = gk; ball.lastTeam = t; gk.noCtrlT = 0.6;
            KFC.Audio.play('kick', { vol: 0.5, rate: 0.7 });
          }
          gk.dive.willSave = false;
          S.shot = null;
          if (S.time - S.lastSaveLine > 8) { S.lastSaveLine = S.time; say('save'); }
          KFC.Audio.play('ooh', { vol: 0.6 });
        }
      }
      if (S.shot && S.time - S.shot.t0 > 2.2) S.shot = null;

      checkGoalOrOut(prevX);

      // ball inside the net after a goal
      if (S.phase === 'goal') {
        for (const gx of [0, L]) {
          const inside = gx === 0 ? ball.x < 0 : ball.x > L;
          if (!inside) continue;
          const back = gx === 0 ? -GD + BR : L + GD - BR;
          if ((gx === 0 && ball.x < back) || (gx === L && ball.x > back)) { ball.x = back; ball.vx *= -0.15; ball.vy *= 0.5; }
          ball.y = clamp(ball.y, CY - GW / 2 + BR, CY + GW / 2 - BR);
          if (ball.z > GH - BR) { ball.z = GH - BR; ball.vz = -Math.abs(ball.vz) * 0.3; }
          ball.vx *= 0.94; ball.vy *= 0.94;
        }
      }
      if (ball.owner === null && ball.trail) {
        const sp = hyp(ball.vx, ball.vy);
        if (sp > 14) { ball.trail.push({ x: ball.x, y: ball.y, z: ball.z }); if (ball.trail.length > 14) ball.trail.shift(); }
        else if (ball.trail.length) ball.trail.shift();
      } else ball.trail.length = 0;
      updateParticles(dt);
    }

    function startKickoff(team) {
      kickoffPositions(team);
      S.phase = 'kickoff'; S.phaseT = 0; S.kickTeam = team;
      if (S.time < 4) say('kickoff', true);
    }

    function endHalf() {
      if (S.half === 1) {
        S.half = 2; S.phase = 'halftime'; S.clock = 2700;
        KFC.Audio.play('whistle_long', { vol: 0.7 });
        say('halftime', true);
        if (ui.halftime) ui.halftime(summary(), () => { startKickoff(S.firstKick === 0 ? 1 : 0); });
      } else {
        S.phase = 'fulltime'; S.over = true; S.clock = 5400;
        KFC.Audio.play('whistle_long', { vol: 0.8 });
        const r = S.score[0] > S.score[1] ? 'win' : S.score[0] < S.score[1] ? 'lose' : 'draw';
        say(r, true);
        if (r === 'win') KFC.Audio.play('roar', { vol: 0.8 });
        if (ui.fulltime) ui.fulltime(summary());
      }
    }

    function summary() {
      const tot = S.possession[0] + S.possession[1];
      const rating = p => 6 + p.goals * 1.3 + p.assists * 0.8 + p.shots * 0.12 + p.tackles * 0.15 + p.saves * 0.45 + p.passes * 0.02 + (p.goat ? 0.3 : 0);
      const motm = teams[0].players.slice().sort((a, b) => rating(b) - rating(a))[0];
      return {
        score: S.score.slice(), half: S.half,
        possession: [Math.round(S.possession[0] / tot * 100), Math.round(S.possession[1] / tot * 100)],
        shots: S.shots.slice(), onTarget: S.onTarget.slice(),
        goals: S.goals.map(g => ({ team: g.team, minute: g.minute, name: g.scorer.data.he.replace(/"[^"]*"\s*/, ''), id: g.scorer.data.id })),
        motm: motm ? motm.card : null,
        scorers: teams[0].players.filter(p => p.goals > 0).map(p => ({ id: p.data.id, goals: p.goals }))
      };
    }

    // ---------- camera ----------
    function updateCamera(dt) {
      const lead = clamp(ball.vx * 0.35, -6, 6);
      const halfVis = (V.cw / 2) / V.sN;
      let tx = ball.x + lead;
      if (L + 10 < halfVis * 2) tx = L / 2;
      else tx = clamp(tx, halfVis - 7, L - halfVis + 7);
      cam.x = lerp(cam.x, tx, 1 - Math.exp(-dt * 3.2));
      const by = (V.camH - ball.z * 0.3) * V.F / (ball.y + V.D0);
      const toy = clamp(by - V.ch * 0.56, V.oyMin, V.oyMax);
      cam.oy = lerp(cam.oy, toy, 1 - Math.exp(-dt * 2.6));
      S.shake = Math.max(0, S.shake - dt * 18);
      S.flash = Math.max(0, S.flash - dt * 2.2);
      S.crowdJump = Math.max(0, S.crowdJump - dt * 0.18);
    }

    // ---------- rendering ----------
    const crowdTex = makeCrowd();
    function makeCrowd() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#0b1022'; g.fillRect(0, 0, c.width, c.height);
      const shirts = ['#14275f', '#14275f', '#e8c26a', '#f3f5fa', '#1d3a8a', '#d3172b', opp.primary, '#0f1b3e', '#2a2f45'];
      const skins = ['#e0b79a', '#c99a7a', '#a8775a', '#7a5238', '#d9a885'];
      for (let row = 0; row < 4; row++) {
        const y0 = row * 64;
        g.fillStyle = row % 2 ? '#0d1328' : '#0a0f20'; g.fillRect(0, y0, c.width, 64);
        for (let x = 4; x < c.width; x += 10 + Math.floor(rnd() * 5)) {
          if (rnd() < 0.08) continue;
          const sh = shirts[Math.floor(rnd() * shirts.length)];
          const yy = y0 + 22 + rnd() * 10;
          g.fillStyle = sh; g.fillRect(x - 5, yy, 10, 26);
          g.fillStyle = skins[Math.floor(rnd() * skins.length)];
          g.beginPath(); g.arc(x, yy - 4, 4.2, 0, Math.PI * 2); g.fill();
          if (rnd() < 0.15) { g.fillStyle = sh; g.fillRect(x - 7, yy - 18, 3, 16); g.fillRect(x + 4, yy - 18, 3, 16); }
          if (rnd() < 0.04) { g.fillStyle = rnd() < 0.5 ? '#e8c26a' : '#ffffff'; g.fillRect(x - 6, yy - 26, 26, 12); }
        }
      }
      return c;
    }

    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, V.ch);
      g.addColorStop(0, '#02040b'); g.addColorStop(0.5, '#071026'); g.addColorStop(1, '#0a1530');
      ctx.fillStyle = g; ctx.fillRect(0, 0, V.cw, V.ch);
    }

    function drawStands() {
      const rows = 26;
      for (let i = rows - 1; i >= 0; i--) {
        const y = W + 5 + i * 1.7, z0 = 1.3 + i * 1.12, z1 = z0 + 1.12;
        const top = proj(0, y, z1), bot = proj(0, y, z0);
        if (bot.y < -40 || top.y > V.ch) continue;
        const h = bot.y - top.y + 1;
        const s = top.s;
        const tw = crowdTex.width * (h / 64);
        const variant = i % 4;
        let off = ((cam.x * s) % tw + tw) % tw;
        let jump = 0;
        if (S.crowdJump > 0) jump = Math.max(0, Math.sin(S.time * 13 + i * 0.8)) * h * 0.22 * Math.min(1, S.crowdJump * 2);
        const dark = 0.55 + 0.45 * (1 - i / rows);
        ctx.globalAlpha = 1;
        for (let x = -off; x < V.cw; x += tw) {
          ctx.drawImage(crowdTex, 0, variant * 64, crowdTex.width, 64, x, top.y - jump, tw, h);
        }
        ctx.fillStyle = 'rgba(3,6,16,' + (1 - dark).toFixed(3) + ')';
        ctx.fillRect(0, top.y - jump, V.cw, h + jump);
      }
      // depth shading: lit near the pitch, falling into darkness toward the roof
      const sb = proj(0, W + 5, 1.3), st = proj(0, W + 5 + rows * 1.7, 1.3 + rows * 1.12);
      if (sb.y > 0) {
        const g2 = ctx.createLinearGradient(0, st.y, 0, sb.y);
        g2.addColorStop(0, 'rgba(2,4,10,0.75)'); g2.addColorStop(0.55, 'rgba(2,4,10,0.25)'); g2.addColorStop(1, 'rgba(2,4,10,0.05)');
        ctx.fillStyle = g2; ctx.fillRect(0, st.y, V.cw, sb.y - st.y);
        for (const k of [7, 15]) {
          const tb = proj(0, W + 5 + k * 1.7, 1.3 + k * 1.12);
          ctx.fillStyle = 'rgba(2,4,12,0.85)'; ctx.fillRect(0, tb.y - 2, V.cw, Math.max(3, tb.s * 0.5));
        }
      }
      // roof edge + flood lights
      const r = proj(0, W + 5 + rows * 1.7, 1.3 + rows * 1.12);
      if (r.y > 0) { ctx.fillStyle = '#03050c'; ctx.fillRect(0, 0, V.cw, r.y); }
      for (const fx of [-14, L + 14, L * 0.33, L * 0.66]) {
        const f = proj(fx, W + 40, 34);
        if (f.x < -400 || f.x > V.cw + 400) continue;
        const rad = 140 * (V.sN / 22);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
        g.addColorStop(0, 'rgba(255,250,230,0.95)'); g.addColorStop(0.08, 'rgba(255,245,215,0.6)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - rad, f.y - rad, rad * 2, rad * 2);
      }
      // camera flashes
      const n = S.crowdJump > 0.2 ? 14 : 3;
      for (let k = 0; k < n; k++) {
        if (rnd() > 0.35) continue;
        const sx = rnd() * V.cw, rr = proj(0, W + 8 + rnd() * 30, 3 + rnd() * 20);
        if (rr.y < 0) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx, rr.y, 2, 2);
      }
    }

    function quad(ax, ay, bx, by, cx2, cy2, dx, dy) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.lineTo(dx, dy); ctx.closePath();
    }
    function groundQuad(x0, y0, x1, y1) {
      const a = proj(x0, y0, 0), b = proj(x1, y0, 0), c = proj(x1, y1, 0), d = proj(x0, y1, 0);
      quad(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
    }

    function drawBoards() {
      const y = W + 2.4;
      const a = proj(-60, y, 1.0), b = proj(L + 60, y, 0);
      const h = b.y - a.y;
      ctx.fillStyle = '#05070f'; ctx.fillRect(a.x, a.y, b.x - a.x, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(a.x, a.y + h * 0.08, b.x - a.x, h * 0.84); ctx.clip();
      const s = a.s;
      const seg = 12 * s;
      const texts = ['KATZIR FC', 'קציר', 'VAMOS', 'THE GOAT', 'קציר FC', opp.en, 'LIAM SHABAT 99'];
      const scroll = (S.time * 2.2) % 1;
      ctx.font = '800 ' + Math.max(8, h * 0.62).toFixed(1) + 'px "Barlow Condensed","Karantina",sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      let i = 0;
      const blink = Math.floor(S.time / 4) % 2;
      for (let x = a.x - seg * scroll; x < b.x; x += seg, i++) {
        const k = (i + Math.floor(S.time / 4)) % texts.length;
        const gold = (i + blink) % 2 === 0;
        ctx.fillStyle = gold ? '#141d3d' : '#0c1430';
        ctx.fillRect(x + 1, a.y, seg - 2, h);
        ctx.fillStyle = gold ? '#e8c26a' : '#46d9ff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
        ctx.fillText(texts[k], x + seg / 2, a.y + h / 2);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(a.x, a.y, b.x - a.x, 1);
    }

    function drawPitch() {
      // surrounding grass
      ctx.fillStyle = '#123f20';
      groundQuad(-60, -16, L + 60, W + 2.4); ctx.fill();
      // mowing stripes
      const n = 14, sw = L / n;
      for (let i = -6; i < n + 6; i++) {
        groundQuad(i * sw, -16, (i + 1) * sw, W + 2.4);
        ctx.fillStyle = i % 2 === 0 ? '#1f7a3b' : '#1a6b33';
        ctx.fill();
      }
      // darker run-off outside the lines
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      groundQuad(-60, -16, L + 60, 0); ctx.fill();
      groundQuad(-60, W, L + 60, W + 2.4); ctx.fill();
      groundQuad(-60, 0, 0, W); ctx.fill();
      groundQuad(L, 0, L + 60, W); ctx.fill();
      // floodlight pools
      const pools = [[L * 0.2, W * 0.75], [L * 0.8, W * 0.75], [L * 0.5, W * 0.3]];
      for (const [px, py] of pools) {
        const c = proj(px, py, 0);
        const r = 30 * c.s;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, 'rgba(255,255,220,0.10)'); g.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      }
      // lines
      ctx.strokeStyle = 'rgba(245,250,245,0.88)';
      ctx.lineCap = 'round';
      const lw = y => Math.max(1, 0.12 * scaleAt(y));
      const line = (pts) => {
        ctx.beginPath();
        pts.forEach((p, i) => { const q = proj(p[0], p[1], 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
        ctx.lineWidth = lw(pts.reduce((s, p) => s + p[1], 0) / pts.length);
        ctx.stroke();
      };
      line([[0, 0], [L, 0]]); line([[0, W], [L, W]]); line([[0, 0], [0, W]]); line([[L, 0], [L, W]]);
      line([[L / 2, 0], [L / 2, W]]);
      const circ = (cx0, cy0, r, a0, a1) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; pts.push([cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r]); } line(pts); };
      circ(L / 2, CY, CC_R, 0, Math.PI * 2);
      for (const gx of [0, L]) {
        const d = gx === 0 ? 1 : -1;
        line([[gx, CY - PEN_W / 2], [gx + d * PEN_L, CY - PEN_W / 2], [gx + d * PEN_L, CY + PEN_W / 2], [gx, CY + PEN_W / 2]]);
        line([[gx, CY - SIX_W / 2], [gx + d * SIX_L, CY - SIX_W / 2], [gx + d * SIX_L, CY + SIX_W / 2], [gx, CY + SIX_W / 2]]);
        const ang = Math.acos((PEN_L - SPOT) / 7.3);
        if (d > 0) circ(gx + SPOT, CY, 7.3, -ang, ang); else circ(gx - SPOT, CY, 7.3, Math.PI - ang, Math.PI + ang);
        for (const cyy of [0, W]) {
          const sgnY = cyy === 0 ? 1 : -1;
          circ(gx, cyy, 1, d > 0 ? (sgnY > 0 ? 0 : -Math.PI / 2) : (sgnY > 0 ? Math.PI / 2 : Math.PI), d > 0 ? (sgnY > 0 ? Math.PI / 2 : 0) : (sgnY > 0 ? Math.PI : Math.PI * 1.5));
        }
        const sp = proj(gx + d * SPOT, CY, 0);
        ctx.fillStyle = 'rgba(245,250,245,0.9)'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 0.22 * sp.s, 0.1 * sp.s, 0, 0, Math.PI * 2); ctx.fill();
      }
      const c = proj(L / 2, CY, 0);
      ctx.fillStyle = 'rgba(245,250,245,0.9)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.22 * c.s, 0.1 * c.s, 0, 0, Math.PI * 2); ctx.fill();
      // corner flags
      for (const fx of [0, L]) for (const fy of [0, W]) {
        const b = proj(fx, fy, 0), t = proj(fx, fy, 1.5);
        ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = Math.max(1, 0.05 * b.s); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
        ctx.fillStyle = '#e8c26a'; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 0.5 * t.s * (fx === 0 ? 1 : -1), t.y + 0.15 * t.s); ctx.lineTo(t.x, t.y + 0.35 * t.s); ctx.fill();
      }
    }

    function drawNet(gx) {
      const d = gx === 0 ? -1 : 1;
      const y1 = CY - GW / 2, y2 = CY + GW / 2, bx = gx + d * GD, bz = GH * 0.82;
      ctx.strokeStyle = 'rgba(235,240,250,0.32)';
      ctx.lineWidth = 1;
      const seg = (a, b) => { const p = proj(a[0], a[1], a[2]), q = proj(b[0], b[1], b[2]); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); };
      ctx.beginPath();
      for (let y = y1; y <= y2 + 0.01; y += 0.42) { seg([bx, y, 0], [bx, y, bz]); seg([bx, y, bz], [gx, y, GH]); }
      for (let z = 0; z <= bz + 0.01; z += 0.36) seg([bx, y1, z], [bx, y2, z]);
      for (let k = 0; k <= 1.0001; k += 0.2) { const x = lerp(gx, bx, k), z = lerp(GH, bz, k); seg([x, y1, z], [x, y2, z]); }
      for (const y of [y1, y2]) {
        for (let k = 0; k <= 1.0001; k += 0.2) { const x = lerp(gx, bx, k); seg([x, y, 0], [x, y, lerp(GH, bz, k)]); }
        for (let z = 0; z <= GH; z += 0.45) seg([gx, y, z], [bx, y, Math.min(z, bz)]);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,210,230,0.05)';
      const a = proj(bx, y1, 0), b = proj(bx, y2, 0), c2 = proj(bx, y2, bz), e = proj(bx, y1, bz);
      quad(a.x, a.y, b.x, b.y, c2.x, c2.y, e.x, e.y); ctx.fill();
    }

    function drawPost(gx, y, withBar) {
      const b = proj(gx, y, 0), t = proj(gx, y, GH);
      ctx.strokeStyle = '#f4f6fa'; ctx.lineWidth = Math.max(2, 0.13 * b.s); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y);
      if (withBar) { const o = proj(gx, CY + GW / 2, GH); ctx.lineTo(o.x, o.y); }
      ctx.stroke();
    }

    function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); ctx.fill(); }

    function drawPlayerShadow(p) {
      const P = proj(p.x, p.y, 0);
      const H = 1.8 * P.s * EXAG;
      ellipse(P.x, P.y, H * 0.2, H * 0.055, 'rgba(0,0,0,0.32)');
      ctx.save(); ctx.translate(P.x, P.y);
      for (const a of [-0.55, 0.55]) {
        ctx.save(); ctx.rotate(a); ctx.translate(Math.sign(a) * H * 0.28, 0);
        ellipse(0, 0, H * 0.32, H * 0.045, 'rgba(0,0,0,0.12)');
        ctx.restore();
      }
      ctx.restore();
    }

    function limb(x1, y1, x2, y2, w, color) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    function drawPlayer(p) {
      const P = proj(p.x, p.y, 0);
      const build = Math.pow(p.data.build || 1, 0.5);
      const H = 1.8 * P.s * EXAG;
      const kit = p.gk ? p.team.gkKit : p.team.kit;
      const sp = hyp(p.vx, p.vy);
      const run = clamp(sp / 7.5, 0, 1);
      const face = Math.cos(p.dir) >= 0 ? 1 : -1;
      const side = Math.abs(Math.cos(p.dir));
      const awayFromCam = Math.sin(p.dir) > 0.55;
      ctx.save();
      ctx.translate(P.x, P.y);
      let rot = 0, lift = 0;
      if (p.slideT > 0) rot = face * 1.2;
      else if (p.dive && p.dive.active) { rot = (p.dive.side > 0 ? -1 : 1) * 1.25 * p.dive.k; lift = p.dive.lift * P.s; }
      else if (p.down) rot = face * 1.45;
      ctx.translate(0, -lift);
      if (rot) ctx.rotate(rot);
      const bob = Math.abs(Math.sin(p.anim)) * H * 0.022 * run;
      ctx.translate(0, -bob);
      const hipY = -H * 0.47, shY = -H * 0.79;
      const legW = H * 0.085 * build, legL = H * 0.47;
      const swing = Math.sin(p.anim) * 0.62 * run * (0.4 + 0.6 * side);
      const kick = p.kickT > 0 ? Math.sin((1 - p.kickT / 0.24) * Math.PI) * 1.1 : 0;
      const celebrate = p.celebT > 0;
      const skin = p.data.skin || '#c99a7a';
      const leg = (ang, bend, front) => {
        const kx = Math.sin(ang * face) * legL * 0.52, ky = hipY + Math.cos(ang) * legL * 0.52;
        const ang2 = ang - bend;
        const fx = kx + Math.sin(ang2 * face) * legL * 0.5, fy = ky + Math.cos(ang2) * legL * 0.5;
        const sx = face * legW * 0.25 * (front ? 1 : -1);
        limb(sx, hipY, sx + kx, ky, legW, front ? skin : shade(skin.length === 7 ? skin : '#c99a7a', 0.85));
        limb(sx + kx, ky, sx + fx, fy, legW * 0.92, front ? kit.socks : shade(kit.socks, 0.8));
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(sx + fx + face * legW * 0.35, fy, legW * 0.75, legW * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      };
      const back = -swing, frontA = swing + kick;
      leg(back, Math.max(0, -Math.cos(p.anim)) * 0.9 * run, false);
      leg(frontA, Math.max(0, Math.cos(p.anim)) * 0.9 * run * (kick ? 0.2 : 1), true);
      // shorts
      const tw = H * (0.2 + 0.07 * (1 - side)) * build;
      ctx.fillStyle = kit.shorts;
      roundRect(-tw * 0.52, hipY - H * 0.05, tw * 1.04, H * 0.13, H * 0.03); ctx.fill();
      // arms (behind torso)
      const armL = H * 0.34, armW = H * 0.06 * build;
      const armSwing = celebrate ? -2.7 : -swing * 0.9;
      const arm = (a, front) => {
        const ex = Math.sin(a * face) * armL * 0.5, ey = shY + H * 0.03 + Math.cos(a) * armL * 0.5;
        const hx = ex + Math.sin((a + (celebrate ? 0 : 0.5)) * face) * armL * 0.48, hy = ey + Math.cos(a + (celebrate ? 0 : 0.5)) * armL * 0.48;
        const sx = face * tw * 0.42 * (front ? 1 : -1);
        limb(sx, shY + H * 0.03, sx + ex, ey, armW * 1.15, kit.sleeve);
        limb(sx + ex, ey, sx + hx, hy, armW, p.gk ? '#f2f2f2' : skin);
      };
      arm(celebrate ? -2.6 : -armSwing, false);
      // torso
      const grad = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      grad.addColorStop(0, shade(kit.shirt, 0.82)); grad.addColorStop(0.5, kit.shirt); grad.addColorStop(1, shade(kit.shirt, 0.88));
      ctx.fillStyle = grad;
      ctx.save(); ctx.rotate(face * 0.12 * run);
      roundRect(-tw / 2, shY, tw, hipY - shY + H * 0.02, H * 0.05); ctx.fill();
      ctx.fillStyle = kit.trim;
      ctx.fillRect(-tw / 2, shY + H * 0.005, tw, H * 0.022);
      if (awayFromCam || side < 0.35) {
        ctx.fillStyle = kit.num;
        ctx.font = '800 ' + (H * 0.15).toFixed(1) + 'px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (awayFromCam) ctx.fillText(String(p.data.num || ''), 0, (shY + hipY) / 2);
      }
      ctx.restore();
      arm(celebrate ? -2.6 : armSwing, true);
      // head
      const headY = shY - H * 0.07;
      const img = p.head;
      if (img && img.complete && img.naturalWidth) {
        const hh = H * 0.42, ww = hh * img.naturalWidth / img.naturalHeight;
        ctx.save();
        if (rot) ctx.rotate(-rot * 0.3);
        ctx.drawImage(img, -ww / 2, headY - hh * 0.86, ww, hh);
        ctx.restore();
      } else {
        const r = H * 0.075;
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, headY - r * 0.9, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.data.hair || '#1b1410';
        ctx.beginPath(); ctx.arc(0, headY - r * 1.05, r * 1.02, Math.PI, 0); ctx.fill();
      }
      ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function drawRing(p) {
      const P = proj(p.x, p.y, 0);
      const H = 1.8 * P.s * EXAG;
      const pulse = 0.65 + 0.35 * Math.sin(S.time * 6);
      ctx.strokeStyle = 'rgba(232,194,106,' + pulse.toFixed(2) + ')';
      ctx.lineWidth = Math.max(2, H * 0.035);
      ctx.beginPath(); ctx.ellipse(P.x, P.y, H * 0.3, H * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
      // direction pointer
      const a = Math.atan2(-Math.sin(p.dir) * 0.35, Math.cos(p.dir));
      ctx.fillStyle = 'rgba(232,194,106,0.95)';
      ctx.save(); ctx.translate(P.x + Math.cos(a) * H * 0.36, P.y + Math.sin(a) * H * 0.11); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(H * 0.08, 0); ctx.lineTo(-H * 0.04, -H * 0.05); ctx.lineTo(-H * 0.04, H * 0.05); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function drawMarkers(p) {
      const P = proj(p.x, p.y, 0);
      const H = 1.8 * P.s * EXAG;
      // name tag
      const ty = P.y - H * 1.3 - (p.head ? H * 0.2 : 0);
      ctx.font = '700 ' + Math.max(11, H * 0.2).toFixed(1) + 'px Heebo, sans-serif';
      const label = p.label;
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(8,14,34,0.82)';
      roundRect(P.x - tw / 2, ty - H * 0.13, tw, H * 0.26, H * 0.08); ctx.fill();
      ctx.strokeStyle = 'rgba(232,194,106,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffe7a3'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, P.x, ty + 1);
      // shot power
      if (input.charging && ball.owner === p) {
        const k = clamp(input.shootT / 0.85, 0, 1);
        const bw = Math.max(46, H * 0.9), bh = Math.max(6, H * 0.08), bx = P.x - bw / 2, by = ty - H * 0.32;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#46d9ff'); g.addColorStop(0.7, '#e8c26a'); g.addColorStop(1, '#e8293f');
        ctx.fillStyle = g; ctx.fillRect(bx, by, bw * k, bh);
      }
    }

    function drawReceiver(p) {
      const P = proj(p.x, p.y, 0);
      const H = 1.8 * P.s * EXAG;
      const y = P.y - H * 1.25 + Math.sin(S.time * 8) * 3;
      ctx.fillStyle = 'rgba(70,217,255,0.9)';
      ctx.beginPath(); ctx.moveTo(P.x - 6, y - 6); ctx.lineTo(P.x + 6, y - 6); ctx.lineTo(P.x, y + 2); ctx.closePath(); ctx.fill();
    }

    function drawBall() {
      const g = proj(ball.x, ball.y, 0), b = proj(ball.x, ball.y, ball.z);
      const r = Math.max(3.8, BR * b.s * 2.3);
      ellipse(g.x, g.y, r * 1.15, r * 0.42, 'rgba(0,0,0,' + (0.38 * clamp(1 - ball.z / 7, 0.25, 1)).toFixed(3) + ')');
      if (ball.trail.length > 2) {
        const goat = S.shot && S.shot.goat;
        ctx.lineCap = 'round';
        for (let i = 1; i < ball.trail.length; i++) {
          const a = proj(ball.trail[i - 1].x, ball.trail[i - 1].y, ball.trail[i - 1].z), c = proj(ball.trail[i].x, ball.trail[i].y, ball.trail[i].z);
          const k = i / ball.trail.length;
          ctx.strokeStyle = goat ? 'rgba(255,214,120,' + (k * 0.8).toFixed(2) + ')' : 'rgba(255,255,255,' + (k * 0.35).toFixed(2) + ')';
          ctx.lineWidth = r * 1.4 * k;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        }
      }
      const grd = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.7, '#e9edf4'); grd.addColorStop(1, '#9aa3b5');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#1b2233';
      for (let i = 0; i < 3; i++) {
        const a = ball.rot * 0.6 + i * 2.1;
        const px = b.x + Math.cos(a) * r * 0.55, py = b.y + Math.sin(ball.rot * 0.35 + i * 2.1) * r * 0.5;
        ctx.beginPath(); ctx.arc(px, py, r * 0.28, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawParticles() {
      for (const q of particles) {
        if (q.kind === 'grass') {
          const p = proj(q.x, q.y, q.z);
          ctx.fillStyle = q.c; ctx.fillRect(p.x, p.y, 2, 2);
        } else {
          ctx.save(); ctx.translate(q.sx, q.sy); ctx.rotate(q.rot);
          ctx.globalAlpha = Math.min(1, q.life);
          ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    function render() {
      ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
      const shx = S.shake ? randn() * S.shake * 0.5 : 0, shy = S.shake ? randn() * S.shake * 0.5 : 0;
      ctx.translate(shx, shy);
      drawSky();
      drawStands();
      drawPitch();
      drawBoards();
      drawNet(0); drawNet(L);
      const list = [];
      for (const p of all) list.push({ y: p.y, f: () => drawPlayer(p), sh: () => drawPlayerShadow(p) });
      list.push({ y: ball.y - 0.05, f: drawBall });
      for (const gx of [0, L]) {
        list.push({ y: CY + GW / 2, f: () => drawPost(gx, CY + GW / 2, false) });
        list.push({ y: CY - GW / 2, f: () => drawPost(gx, CY - GW / 2, true) });
      }
      for (const it of list) if (it.sh) it.sh();
      const showMarker = S.active && (S.phase === 'play' || S.phase === 'kickoff' || S.phase === 'restart');
      if (showMarker) drawRing(S.active);
      list.sort((a, b) => b.y - a.y);
      for (const it of list) it.f();
      if (showMarker) drawMarkers(S.active);
      if (S.pass && S.pass.to && S.pass.to !== S.active && !ball.owner) drawReceiver(S.pass.to);
      drawParticles();
      // vignette + goal flash
      const vg = ctx.createRadialGradient(V.cw / 2, V.ch * 0.55, Math.min(V.cw, V.ch) * 0.35, V.cw / 2, V.ch * 0.55, Math.max(V.cw, V.ch) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg; ctx.fillRect(-20, -20, V.cw + 40, V.ch + 40);
      if (S.flash > 0) { ctx.fillStyle = 'rgba(255,248,225,' + (S.flash * 0.55).toFixed(3) + ')'; ctx.fillRect(-20, -20, V.cw + 40, V.ch + 40); }
    }

    // ---------- loop ----------
    let raf = 0, last = 0, acc = 0, running = false;
    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dtReal = Math.min(0.05, (ts - last) / 1000 || 0);
      last = ts;
      if (!S.paused && !S.manual && S.phase !== 'halftime' && S.phase !== 'fulltime') {
        readInput(dtReal);
        let scale = 1;
        if (S.slowmo > 0) { S.slowmo -= dtReal; scale = 0.35; }
        acc += dtReal * scale;
        let n = 0;
        while (acc >= STEP && n < 12) { step(STEP); acc -= STEP; n++; }
        if (n >= 12) acc = 0;
        updateCamera(dtReal);
        if (ui.clock) ui.clock(S.clock, S.half);
      } else if (S.phase === 'fulltime' || S.phase === 'halftime') {
        updateParticles(dtReal);
        updateCamera(dtReal);
      }
      render();
    }

    function togglePause(force) {
      if (S.phase === 'fulltime' || S.phase === 'halftime') return;
      S.paused = force == null ? !S.paused : !!force;
      if (ui.pause) ui.pause(S.paused);
    }

    function start() {
      resize();
      window.addEventListener('resize', resize);
      kickoffPositions(0);
      S.phase = 'intro'; S.phaseT = 0; S.kickTeam = 0; S.firstKick = 0;
      cam.oy = (V.oyMin + V.oyMax) / 2;
      running = true; last = performance.now();
      raf = requestAnimationFrame(frame);
      if (ui.score) ui.score(S.score);
      if (ui.intro) ui.intro();
    }

    function destroy() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
    }

    return {
      start, destroy, resize, touch: touchApi, togglePause,
      resume() { S.paused = false; if (ui.pause) ui.pause(false); },
      get state() { return S; },
      get teams() { return teams; },
      context() { return hasBallUser() ? 'attack' : 'defend'; },
      debug: { S, ball, teams, input, step, V, cam }
    };
  }

  return { create, L, W };
})();
