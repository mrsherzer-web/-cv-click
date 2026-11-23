/* Sprites: everything is drawn with canvas paths. Origin of every sprite is at the feet / contact shadow. */
const Sprites = {
  shadow(ctx, x, y, w, h, a) {
    ctx.fillStyle = `rgba(0,0,0,${a || 0.45})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, 6.283); ctx.fill();
  },
  face(ctx, ex, ey, size, angry, blink) {
    // two eyes with angry brows
    for (let k = -1; k <= 1; k += 2) {
      const x = ex + k * size * 0.55;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, ey, size * 0.42, blink ? size * 0.08 : size * 0.5, 0, 0, 6.283); ctx.fill();
      if (!blink) { ctx.fillStyle = '#1a0a22'; ctx.beginPath(); ctx.arc(x + k * size * 0.1, ey + size * 0.1, size * 0.2, 0, 6.283); ctx.fill(); }
      if (angry) {
        ctx.strokeStyle = '#1a0a22'; ctx.lineWidth = Math.max(1.5, size * 0.16); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - k * size * 0.45, ey - size * 0.7); ctx.lineTo(x + k * size * 0.35, ey - size * 0.35); ctx.stroke();
      }
    }
  },
  mouth(ctx, x, y, w, open) {
    ctx.fillStyle = '#1a0a22'; ctx.beginPath();
    if (open) ctx.ellipse(x, y, w * 0.5, w * 0.5, 0, 0, 6.283); else { ctx.rect(x - w / 2, y - 1, w, 2.5); }
    ctx.fill();
  },

  /* ---- the king in the paper crown ---- */
  player(ctx, p, t) {
    const s = p.scale, walk = p.moving ? Math.sin(t * 16) : 0, bob = p.moving ? Math.abs(Math.cos(t * 16)) * 2 : Math.sin(t * 2.2) * 1.2;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s * p.face, s);
    this.shadow(ctx, 0, 2, 20, 7, 0.5);
    if (p.dashT > 0) { ctx.globalAlpha = 0.55; }
    if (p.hurtT > 0 && Math.floor(p.hurtT * 20) % 2 === 0) ctx.globalAlpha *= 0.4;
    // legs (dark shorts + skin)
    ctx.lineCap = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = '#d9a071';
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-7 - walk * 6, -2); ctx.moveTo(6, -16); ctx.lineTo(7 + walk * 6, -2); ctx.stroke();
    ctx.fillStyle = '#2a1b2e'; ctx.beginPath(); ctx.roundRect(-14, -26, 28, 14, 5); ctx.fill();
    // torso: the yellow shirt
    ctx.translate(0, -bob);
    const grd = ctx.createLinearGradient(0, -58, 0, -20); grd.addColorStop(0, '#ffe066'); grd.addColorStop(1, '#f2b900');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(-17, -58, 34, 38, 8); ctx.fill();
    ctx.fillStyle = '#5a3a00'; ctx.font = '900 7px Rubik'; ctx.textAlign = 'center'; ctx.fillText('KING', 2, -40);
    // arms
    ctx.strokeStyle = '#d9a071'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-15, -52); ctx.lineTo(-22 + walk * 3, -34); ctx.stroke();
    // front arm holds hand near mouth (smoking pose)
    ctx.beginPath(); ctx.moveTo(15, -52); ctx.lineTo(22, -44); ctx.lineTo(14, -66); ctx.stroke();
    // head
    ctx.fillStyle = '#e0a876'; ctx.beginPath(); ctx.arc(0, -74, 15, 0, 6.283); ctx.fill();
    // hair
    ctx.fillStyle = '#2b1b16'; ctx.beginPath(); ctx.arc(0, -78, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(13, -78); ctx.lineTo(-13, -78); ctx.fill();
    ctx.beginPath(); ctx.arc(-11, -70, 4, 0, 6.283); ctx.fill();
    // eyes (chill, half closed) + smirk
    ctx.fillStyle = '#1a0a22';
    ctx.beginPath(); ctx.ellipse(5, -74, 2.6, 1.6, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-5, -74, 2.6, 1.6, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#1a0a22'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(3, -68, 5, 0.1, Math.PI * 0.8); ctx.stroke();
    // the paper crown
    ctx.fillStyle = '#f7f1e3'; ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-15, -84); ctx.lineTo(15, -84); ctx.lineTo(15, -92);
    for (let i = 0; i < 5; i++) { ctx.lineTo(15 - i * 7.5 - 3.75, -102); ctx.lineTo(15 - (i + 1) * 7.5, -92); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a1f3a'; ctx.beginPath(); ctx.moveTo(0, -86); ctx.lineTo(-3, -90); ctx.lineTo(0, -92); ctx.lineTo(3, -90); ctx.closePath(); ctx.fill();
    // smoke wisp from the hand
    ctx.globalAlpha *= 0.5; ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(14, -68); ctx.quadraticCurveTo(18 + Math.sin(t * 3) * 4, -80, 14 + Math.sin(t * 2) * 5, -92); ctx.stroke();
    ctx.restore();
  },

  /* ---- enemies ---- */
  chip(ctx, e, t) {
    const s = e.scale; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 16, 5);
    ctx.rotate(Math.sin(t * 10 + e.id) * 0.15);
    ctx.translate(0, -18 - Math.abs(Math.sin(t * 10 + e.id)) * 6);
    const g = ctx.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#ffd978'); g.addColorStop(1, '#e8a221');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(22, -4, 18, 18); ctx.quadraticCurveTo(0, 12, -18, 18); ctx.quadraticCurveTo(-22, -4, 0, -20); ctx.fill();
    ctx.fillStyle = 'rgba(160,90,10,.5)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-8 + i * 7, 6 + (i % 2) * 5, 1.8, 0, 6.283); ctx.fill(); }
    this.face(ctx, 0, -2, 5, true);
    this.mouth(ctx, 0, 8, 7, true);
    ctx.restore();
  },
  cookie(ctx, e, t) {
    const s = e.scale; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 20, 6);
    ctx.translate(0, -22); ctx.rotate(e.roll || 0);
    ctx.fillStyle = '#b9743a'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#d08a48'; ctx.beginPath(); ctx.arc(-3, -3, 17, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3a1f12'; [[-8, -9], [7, -6], [-2, 8], [10, 7], [-11, 4]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fill(); });
    ctx.rotate(-(e.roll || 0));
    this.face(ctx, 0, -3, 5.5, true); this.mouth(ctx, 0, 7, 9, false);
    ctx.restore();
  },
  cap(ctx, e, t) {
    const s = e.scale; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 16, 5);
    ctx.translate(0, -18 + Math.sin(t * 4 + e.id) * 3);
    ctx.fillStyle = '#c8102e'; ctx.beginPath();
    for (let i = 0; i < 21; i++) { const a = i / 21 * 6.283, r = i % 2 ? 17 : 15; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.fill();
    this.face(ctx, 0, -1, 4, true); this.mouth(ctx, 0, 6, 6, e.charge > 0.5);
    if (e.charge > 0) { ctx.strokeStyle = `rgba(255,80,80,${e.charge})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 20 + e.charge * 6, 0, 6.283); ctx.stroke(); }
    ctx.restore();
  },
  lighter(ctx, e, t) {
    const s = e.scale, hot = e.fuse !== undefined && e.fuse < 1.2; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 12, 4);
    ctx.translate(0, -2); if (hot) ctx.translate((Math.random() - 0.5) * 4, 0);
    ctx.rotate(Math.sin(t * 14 + e.id) * 0.12);
    ctx.fillStyle = hot ? '#9cff57' : '#3ddc3d'; ctx.beginPath(); ctx.roundRect(-9, -36, 18, 36, 4); ctx.fill();
    ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.roundRect(-9, -44, 18, 9, 2); ctx.fill();
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.roundRect(-3, -47, 6, 4, 1); ctx.fill();
    // flame
    const fl = hot ? 14 + Math.random() * 10 : 6 + Math.sin(t * 20) * 2;
    const g = ctx.createRadialGradient(0, -48, 1, 0, -48 - fl / 2, fl); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ff9d00'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -48 - fl / 2, fl * 0.5, fl, 0, 0, 6.283); ctx.fill();
    this.face(ctx, 0, -24, 3.5, true); this.mouth(ctx, 0, -16, 5, hot);
    ctx.restore();
  },
  wraith(ctx, e, t) {
    const s = e.scale, ph = e.phased; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 14, 4, 0.2);
    ctx.globalAlpha = ph ? 0.3 : 0.8; ctx.translate(0, -30 + Math.sin(t * 3 + e.id) * 5);
    const g = ctx.createRadialGradient(0, -6, 2, 0, 0, 26); g.addColorStop(0, '#f6ecff'); g.addColorStop(1, 'rgba(200,160,255,0.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -8, 18, Math.PI, 0);
    for (let i = 0; i < 5; i++) ctx.lineTo(18 - i * 9, 12 + (i % 2 ? -5 : 5) + Math.sin(t * 8 + i) * 2);
    ctx.closePath(); ctx.fill();
    this.face(ctx, 0, -8, 4.5, true); this.mouth(ctx, 0, 1, 6, true);
    ctx.restore();
  },
  blob(ctx, e, t) {
    const s = e.scale * (e.small ? 0.6 : 1); ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 20, 6);
    const w = 1 + Math.sin(t * 6 + e.id) * 0.1;
    ctx.translate(0, -18); ctx.scale(w, 1 / w);
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 24); g.addColorStop(0, '#ffd1a8'); g.addColorStop(0.5, '#ff6a3d'); g.addColorStop(1, '#d4186e');
    ctx.shadowColor = '#ff6a3d'; ctx.shadowBlur = 18; ctx.fillStyle = g;
    ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283, r = 21 + Math.sin(a * 3 + t * 5) * 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill();
    ctx.shadowBlur = 0;
    this.face(ctx, 0, -3, 5, true); this.mouth(ctx, 0, 8, 8, true);
    ctx.restore();
  },
  bottle(ctx, e, t) {
    const s = e.scale; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 2, 14, 5);
    ctx.rotate(Math.sin(t * 5 + e.id) * 0.06 + (e.charging ? Math.sin(t * 40) * 0.1 : 0));
    const g = ctx.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#5a2d0c'); g.addColorStop(0.5, '#8a4a1a'); g.addColorStop(1, '#4a2208');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-13, -46, 26, 46, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, -46); ctx.lineTo(-6, -62); ctx.lineTo(6, -62); ctx.lineTo(13, -46); ctx.fill();
    ctx.fillStyle = '#6a3a12'; ctx.beginPath(); ctx.roundRect(-6, -70, 12, 9, 2); ctx.fill();
    ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.roundRect(-7, -72, 14, 4, 1); ctx.fill();
    ctx.fillStyle = '#efe7d0'; ctx.beginPath(); ctx.roundRect(-10, -36, 20, 18, 3); ctx.fill();
    this.face(ctx, 0, -29, 4, true); this.mouth(ctx, 0, -22, 7, e.charging);
    ctx.restore();
  },
  // boss sprites
  hydra(ctx, e, t) {
    const s = e.scale * 2.2; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 3, 34, 10, 0.5);
    const bob = Math.sin(t * 3) * 3; ctx.translate(0, bob);
    // bag body (red/blue like the bag on the table)
    const g = ctx.createLinearGradient(-30, -70, 30, 0); g.addColorStop(0, '#2d6cdf'); g.addColorStop(0.5, '#d61f2c'); g.addColorStop(1, '#8a0f1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, -70); ctx.lineTo(30, -70); ctx.lineTo(34, -6); ctx.lineTo(-34, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd978'; ctx.lineWidth = 2; ctx.strokeRect(-24, -62, 48, 28);
    ctx.fillStyle = '#ffd978'; ctx.font = '900 10px Rubik'; ctx.textAlign = 'center'; ctx.fillText('CHIPS', 0, -44);
    // three chip heads on necks
    for (let i = -1; i <= 1; i++) {
      const nx = i * 26, ny = -70 - 24 + Math.sin(t * 4 + i) * 6, sway = Math.sin(t * 2 + i * 2) * 6;
      ctx.strokeStyle = '#e8a221'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(i * 14, -68); ctx.quadraticCurveTo(nx + sway, ny + 20, nx + sway, ny); ctx.stroke();
      ctx.save(); ctx.translate(nx + sway, ny); ctx.rotate(Math.sin(t * 5 + i) * 0.2);
      const cg = ctx.createLinearGradient(0, -14, 0, 14); cg.addColorStop(0, '#ffd978'); cg.addColorStop(1, '#e8a221');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(18, -4, 14, 14); ctx.quadraticCurveTo(0, 10, -14, 14); ctx.quadraticCurveTo(-18, -4, 0, -16); ctx.fill();
      this.face(ctx, 0, -1, 4, true); this.mouth(ctx, 0, 7, 6, e.state === 'spit');
      ctx.restore();
    }
    ctx.restore();
  },
  lavalord(ctx, e, t) {
    const s = e.scale * 2.4; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 3, 30, 9, 0.5);
    // the lava lamp itself, with legs
    ctx.strokeStyle = '#e0a876'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const w = Math.sin(t * 8) * 6;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-14 - w, 0); ctx.moveTo(10, -8); ctx.lineTo(14 + w, 0); ctx.stroke();
    ctx.fillStyle = '#8f9aa6'; ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(16, -8); ctx.lineTo(10, -28); ctx.lineTo(-10, -28); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, -110, 0, -28); g.addColorStop(0, '#ff5fb0'); g.addColorStop(0.6, '#ff2d95'); g.addColorStop(1, '#ff6a3d');
    ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 30; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(-22, -100); ctx.quadraticCurveTo(0, -126, 22, -100); ctx.lineTo(10, -28); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // lava blobs rising inside
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 4; i++) { const ph = (t * 0.4 + i * 0.25) % 1, y = -34 - ph * 70, r = 4 + Math.sin(ph * 6.283) * 2 + i; ctx.beginPath(); ctx.ellipse((i - 1.5) * 6, y, r * 1.2, r, 0, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#8f9aa6'; ctx.beginPath(); ctx.moveTo(-14, -104); ctx.lineTo(14, -104); ctx.lineTo(10, -120); ctx.lineTo(-10, -120); ctx.closePath(); ctx.fill();
    this.face(ctx, 0, -78, 6, true); this.mouth(ctx, 0, -64, 12, e.state === 'burst');
    ctx.restore();
  },
  king(ctx, e, t) {
    const s = e.scale * 2.6; ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    this.shadow(ctx, 0, 3, 36, 11, 0.55);
    const bob = Math.sin(t * 2.5) * 3;
    // a giant pizza box monster wearing a paper crown
    ctx.translate(0, bob);
    ctx.fillStyle = '#2a1b2e'; ctx.beginPath(); ctx.roundRect(-20, -14, 14, 14, 3); ctx.roundRect(6, -14, 14, 14, 3); ctx.fill();
    const g = ctx.createLinearGradient(0, -70, 0, -14); g.addColorStop(0, '#f0d9a8'); g.addColorStop(1, '#c9a26b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-40, -70, 80, 56, 6); ctx.fill();
    ctx.fillStyle = '#b5804a'; ctx.fillRect(-40, -44, 80, 3);
    // pizza mouth (lid open)
    const open = e.state === 'chomp' ? 14 : 4 + Math.sin(t * 3) * 2;
    ctx.fillStyle = '#3a1010'; ctx.beginPath(); ctx.roundRect(-34, -40, 68, 20, 4); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.roundRect(-34, -40, 68, open, 3); ctx.fill();
    ctx.fillStyle = '#d61f2c'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-28 + i * 11, -40 + open * 0.5, 3, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-32 + i * 10, -20); ctx.lineTo(-28 + i * 10, -14); ctx.lineTo(-24 + i * 10, -20); ctx.fill(); }
    this.face(ctx, 0, -56, 8, true);
    // crown
    ctx.fillStyle = '#f7f1e3'; ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-24, -70); ctx.lineTo(24, -70); ctx.lineTo(24, -80);
    for (let i = 0; i < 6; i++) { ctx.lineTo(24 - i * 8 - 4, -94); ctx.lineTo(24 - (i + 1) * 8, -80); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a1f3a'; ctx.beginPath(); ctx.moveTo(0, -74); ctx.lineTo(-4, -79); ctx.lineTo(0, -82); ctx.lineTo(4, -79); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  /* ---- projectiles & pickups ---- */
  ring(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = 3.5; ctx.shadowColor = '#e04dff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.6, b.r, 0, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.6, b.r, 0, 0, 6.283); ctx.stroke();
    ctx.restore();
  },
  chipBullet(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
    ctx.fillStyle = '#ffd978'; ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, -b.r); ctx.quadraticCurveTo(b.r, 0, b.r * 0.8, b.r); ctx.quadraticCurveTo(0, b.r * 0.6, -b.r * 0.8, b.r); ctx.quadraticCurveTo(-b.r, 0, 0, -b.r); ctx.fill();
    ctx.restore();
  },
  fireball(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, b.r * 1.6); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.4, '#ff9d00'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r * 1.6, 0, 6.283); ctx.fill();
    ctx.restore();
  },
  orb(ctx, x, y, r, t) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r); g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.5, '#ff6a3d'); g.addColorStop(1, '#ff2d95');
    ctx.shadowColor = '#ff6a3d'; ctx.shadowBlur = 16; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.restore();
  },
  enemyBullet(ctx, b) {
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.fillStyle = b.color || '#ff4d6d'; ctx.shadowColor = b.color || '#ff4d6d'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, b.r * 0.4, 0, 6.283); ctx.fill();
    ctx.restore();
  },
  pickup(ctx, p, t) {
    const s = p.scale, hop = Math.sin(t * 4 + p.x) * 3; ctx.save(); ctx.translate(p.x, p.y - 8 + hop); ctx.scale(s, s);
    if (p.kind === 'xp') {
      const r = p.value >= 10 ? 9 : p.value >= 3 ? 7 : 5;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r); g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, p.value >= 10 ? '#b000ff' : p.value >= 3 ? '#ff2d95' : '#ff6a3d');
      ctx.shadowColor = '#ff6a3d'; ctx.shadowBlur = 12; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.quadraticCurveTo(r, -r * 0.2, 0, r); ctx.quadraticCurveTo(-r, -r * 0.2, 0, -r * 1.5); ctx.fill();
    } else if (p.kind === 'pizza') {
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#e8b04a'; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-13, -12); ctx.quadraticCurveTo(0, -18, 13, -12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-9, -8); ctx.quadraticCurveTo(0, -12, 9, -8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d61f2c'; [[0, -3], [-4, 2], [4, 1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.3, 0, 6.283); ctx.fill(); });
    } else if (p.kind === 'bag') {
      ctx.shadowColor = '#2d6cdf'; ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(-10, -14, 10, 10); g.addColorStop(0, '#2d6cdf'); g.addColorStop(1, '#d61f2c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-10, -14, 20, 26, 3); ctx.fill();
      ctx.fillStyle = '#ffd978'; ctx.fillRect(-6, -6, 12, 8);
    } else if (p.kind === 'lamp') {
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#8f9aa6'; ctx.fillRect(-6, 6, 12, 6);
      const g = ctx.createLinearGradient(0, -20, 0, 6); g.addColorStop(0, '#ff5fb0'); g.addColorStop(1, '#ff6a3d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(-9, -16); ctx.quadraticCurveTo(0, -24, 9, -16); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, -8 + Math.sin(t * 3) * 5, 3.5, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  },
  lavaPool(ctx, h, t) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(1, 0.45);
    const a = Math.min(1, h.life / 0.5);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r); g.addColorStop(0, `rgba(255,233,168,${0.9 * a})`); g.addColorStop(0.5, `rgba(255,106,61,${0.75 * a})`); g.addColorStop(1, `rgba(212,24,110,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, h.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = `rgba(255,240,200,${0.5 * a})`;
    for (let i = 0; i < 4; i++) { const ph = (t * 0.7 + i * 0.3) % 1; ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * h.r * 0.5, Math.sin(i * 2.3) * h.r * 0.5, (1 - ph) * 6, 0, 6.283); ctx.fill(); }
    ctx.restore();
  },
};
