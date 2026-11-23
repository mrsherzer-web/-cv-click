/* FX: particles, floating text, screen shake, flashes, slow motion, hit stop. */
const FX = {
  parts: [], texts: [], shake: 0, shakeX: 0, shakeY: 0, flash: 0, flashColor: '#fff', hitStop: 0, slow: 0, slowScale: 1,
  reset() { this.parts.length = 0; this.texts.length = 0; this.shake = 0; this.flash = 0; this.hitStop = 0; this.slow = 0; },

  // kinds: 'dot' (circle fades), 'smoke' (grows, fades), 'spark' (line streak), 'ring' (expanding ring), 'crumb' (gravity, bounce)
  spawn(o) {
    if (this.parts.length > 900) this.parts.shift();
    this.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, t: 0, r: 4, color: '#fff', kind: 'dot', drag: 0.9, grav: 0, grow: 0, alpha: 1 }, o));
  },
  burst(x, y, n, color, speed, opts) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      this.spawn(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.45, r: 2 + Math.random() * 4, color }, opts || {}));
    }
  },
  crumbs(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 220;
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.7 + Math.random() * 0.5, r: 2 + Math.random() * 3, color, kind: 'crumb', grav: 700, drag: 0.98, floor: y + 6 + Math.random() * 30 });
    }
  },
  smoke(x, y, n, color, speed, opts) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (speed || 30) * (0.2 + Math.random());
      this.spawn(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0.8 + Math.random() * 0.9, r: 8 + Math.random() * 14, color: color || 'rgba(230,210,255,1)', kind: 'smoke', drag: 0.96, grow: 22, alpha: 0.35 }, opts || {}));
    }
  },
  ring(x, y, r, color, life, width) { this.spawn({ x, y, r: 4, kind: 'ring', color, life: life || 0.5, grow: (r - 4) / (life || 0.5), width: width || 4 }); },
  sparks(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random());
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.2 + Math.random() * 0.25, r: 2, color, kind: 'spark', drag: 0.9 });
    }
  },
  text(x, y, str, color, size, opts) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push(Object.assign({ x, y, str, color: color || '#fff', size: size || 20, t: 0, life: 0.9, vy: -60, vx: (Math.random() - 0.5) * 40, font: 'Rubik' }, opts || {}));
  },
  doShake(a) { this.shake = Math.max(this.shake, a); },
  doFlash(a, color) { this.flash = Math.max(this.flash, a); this.flashColor = color || '#fff'; },
  doHitStop(s) { this.hitStop = Math.max(this.hitStop, s); },
  doSlow(dur, scale) { this.slow = Math.max(this.slow, dur); this.slowScale = scale; },

  update(dt) {
    // dt here is real time
    this.shake *= Math.pow(0.02, dt); if (this.shake < 0.3) this.shake = 0;
    this.shakeX = (Math.random() - 0.5) * 2 * this.shake; this.shakeY = (Math.random() - 0.5) * 2 * this.shake;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.hitStop > 0) this.hitStop -= dt;
    if (this.slow > 0) this.slow -= dt;
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.t += dt;
      if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k; p.vy *= k; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'crumb' && p.y > p.floor) { p.y = p.floor; p.vy *= -0.4; p.vx *= 0.6; }
      p.r += p.grow * dt;
    }
    const T = this.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const q = T[i]; q.t += dt; if (q.t >= q.life) { T.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= 0.95;
    }
  },
  timeScale() { if (this.hitStop > 0) return 0; if (this.slow > 0) return this.slowScale; return 1; },

  draw(ctx) {
    const P = this.parts;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], f = 1 - p.t / p.life;
      if (p.kind === 'dot' || p.kind === 'crumb') {
        ctx.globalAlpha = f * p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * (p.kind === 'crumb' ? 1 : f)), 0, 6.283); ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = f * p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = f; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = f; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * f + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of this.texts) {
      const f = 1 - q.t / q.life, pop = q.t < 0.12 ? 1 + (0.12 - q.t) * 4 : 1;
      ctx.globalAlpha = Math.min(1, f * 2);
      ctx.font = `900 ${Math.round(q.size * pop)}px ${q.font}, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(q.str, q.x, q.y);
      ctx.fillStyle = q.color; ctx.fillText(q.str, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  },
};
