/* Heist chapter: builds the 3D city (night Miami vibes) — buildings, roads, neon, palms, streetlights,
   THE BIG SCORE hotel, the causeway to the island safe house, ocean and sky. Uses the global THREE (loaded lazily).
   Chapter 3 (THE CREW) adds IRONSIDE ARMORY, OCEAN TRUST BANK, the Key Island lookout and the story points
   (HWorld.gunStore / bank / trap / lookout / crewStart / crewHomes / crewPaths): see the section "Chapter 3". */
const HWorld = {
  T: null, scene: null, q: 'high', mats: {}, tex: {}, glowSets: [], tod: 0, todPal: null,
  hotel: null, billboard: null, reflectables: [], waterMat: null, skyMat: null, time: 0,

  /* ---------- small helpers ---------- */
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; },
  texFrom(c, repeat) {
    const T = this.T, t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding; t.anisotropy = this.maxAniso;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  },
  // geometry builder for merged static meshes (world-space UVs in metres)
  GB() {
    const g = { p: [], n: [], u: [], c: [], i: [] };
    g.face = (ox, oy, oz, rx, rz, w, h, nx, nz, u0, v0, su, sv, col) => { // vertical face: origin bottom-left, right=(rx,0,rz)
      const b = g.p.length / 3;
      g.p.push(ox, oy, oz, ox + rx * w, oy, oz + rz * w, ox + rx * w, oy + h, oz + rz * w, ox, oy + h, oz);
      for (let k = 0; k < 4; k++) { g.n.push(nx, 0, nz); if (col) g.c.push(col[0], col[1], col[2]); }
      g.u.push(u0, v0, u0 + w / su, v0, u0 + w / su, v0 + h / sv, u0, v0 + h / sv);
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    g.top = (x0, z0, x1, z1, y, su, sv, col, ny) => { // horizontal quad facing +y (or -y)
      const b = g.p.length / 3, up = ny === undefined ? 1 : ny;
      if (up > 0) g.p.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0); else g.p.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      for (let k = 0; k < 4; k++) { g.n.push(0, up, 0); if (col) g.c.push(col[0], col[1], col[2]); }
      su = su || 1; sv = sv || 1;
      g.u.push(x0 / su, -z1 / sv, x1 / su, -z1 / sv, x1 / su, -z0 / sv, x0 / su, -z0 / sv);
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    g.box = (x0, y0, z0, x1, y1, z1, su, sv, col, uo, noTop) => { // axis aligned box, 4 sides (+ top)
      const w = x1 - x0, d = z1 - z0, h = y1 - y0; uo = uo || 0;
      g.face(x1, y0, z1, 0, -1, d, h, 1, 0, uo, 0, su, sv, col);          // +x
      g.face(x0, y0, z0, 0, 1, d, h, -1, 0, uo + 3.7, 0, su, sv, col);    // -x
      g.face(x0, y0, z1, 1, 0, w, h, 0, 1, uo + 1.3, 0, su, sv, col);     // +z
      g.face(x1, y0, z0, -1, 0, w, h, 0, -1, uo + 5.1, 0, su, sv, col);   // -z
      if (!noTop) g.top(x0, z0, x1, z1, y1, su, sv, col);
    };
    g.geo = () => {
      const T = HWorld.T, geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(g.u, 2));
      if (g.c.length) geo.setAttribute('color', new T.Float32BufferAttribute(g.c, 3));
      geo.setIndex(g.i); geo.computeBoundingSphere();
      return geo;
    };
    return g;
  },
  hex(c) { const T = this.T, k = new T.Color(c).convertSRGBToLinear(); return [k.r, k.g, k.b]; }, // design colours are sRGB; the pipeline is linear
  mergeInto(target, geom, matrix) { // append a (non-indexed) THREE geometry transformed by matrix into GB-like arrays
    const g = geom.index ? geom.toNonIndexed() : geom, T = this.T;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(matrix);
    const b = target.p.length / 3;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(matrix); target.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize(); target.n.push(v.x, v.y, v.z);
      target.u.push(uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
      target.i.push(b + k);
    }
  },

  /* ---------- procedural textures ---------- */
  makeFacade(kind, seed) {
    const R = HX.rng(seed), [c, x] = this.canvas(512, 512), [ce, xe] = this.canvas(512, 512);
    const pastel = ['#f4efe4', '#f6c9d4', '#a9e3dc', '#fbe1a6', '#cdb8f2', '#ffd0b5'];
    xe.fillStyle = '#000'; xe.fillRect(0, 0, 512, 512);
    const lit = (wx, wy, ww, wh, p, cols) => { if (R() < p) { xe.fillStyle = cols[Math.floor(R() * cols.length)]; xe.globalAlpha = 0.55 + R() * 0.45; xe.fillRect(wx, wy, ww, wh); xe.globalAlpha = 1; } };
    if (kind === 'deco') {
      const wall = pastel[Math.floor(R() * pastel.length)];
      x.fillStyle = wall; x.fillRect(0, 0, 512, 512);
      for (let f = 0; f < 8; f++) {
        x.fillStyle = 'rgba(0,0,0,0.10)'; x.fillRect(0, f * 64 + 58, 512, 6);           // floor band
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, f * 64 + 56, 512, 2);
        for (let k = 0; k < 8; k++) {
          const wx = k * 64 + 14, wy = f * 64 + 16, ww = 36, wh = 30;
          x.fillStyle = '#18202e'; x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(160,200,255,0.18)'; x.fillRect(wx + 2, wy + 2, ww - 4, 6);
          x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(wx - 3, wy + wh, ww + 6, 4);    // sill shadow
          lit(wx, wy, ww, wh, 0.42, ['#ffd9a0', '#ffc27a', '#ff9ad5', '#ffe9c4']);
        }
      }
      for (let k = 0; k < 8; k += 2) { x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(k * 64 + 1, 0, 6, 512); }
    } else if (kind === 'glass') {
      x.fillStyle = '#0d1828'; x.fillRect(0, 0, 512, 512);
      const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, 'rgba(90,140,200,0.18)'); g.addColorStop(1, 'rgba(20,30,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      x.fillStyle = '#2b3a4e'; for (let k = 0; k <= 8; k++) { x.fillRect(k * 64 - 2, 0, 4, 512); x.fillRect(0, k * 64 - 2, 512, 4); }
      for (let f = 0; f < 8; f++) { const rowOn = R() < 0.55; for (let k = 0; k < 8; k++) lit(k * 64 + 3, f * 64 + 3, 58, 58, rowOn ? 0.55 : 0.12, ['#bfe8ff', '#e8f6ff', '#9fd6ff', '#fff2d6']); }
    } else if (kind === 'concrete') {
      x.fillStyle = ['#c9b9a0', '#b9b3a8', '#d6c7b2', '#a99c8c'][Math.floor(R() * 4)]; x.fillRect(0, 0, 512, 512);
      for (let f = 0; f < 8; f++) for (let k = 0; k < 8; k++) {
        const wx = k * 64 + 10, wy = f * 64 + 10, ww = 44, wh = 36;
        x.fillStyle = '#1b1f27'; x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(k * 64 + 4, f * 64 + 50, 56, 8);       // balcony slab
        x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(k * 64 + 4, f * 64 + 48, 56, 2);
        lit(wx, wy, ww, wh, 0.38, ['#ffcf8a', '#ffe0b0', '#ffb070', '#fff0d0']);
      }
    } else { // 'tower': dark LED tower
      x.fillStyle = '#0a0b14'; x.fillRect(0, 0, 512, 512);
      x.fillStyle = '#1c2033'; for (let k = 0; k < 8; k++) x.fillRect(k * 64 + 28, 0, 8, 512);
      const col = ['#7a6cff', '#28d7ff', '#ff4fd8'][Math.floor(R() * 3)];
      xe.fillStyle = col; for (let k = 0; k < 8; k++) { xe.globalAlpha = 0.9; xe.fillRect(k * 64 + 29, 0, 6, 512); }
      xe.globalAlpha = 1;
      for (let f = 0; f < 8; f++) for (let k = 0; k < 8; k++) lit(k * 64 + 6, f * 64 + 8, 18, 46, 0.25, ['#cfe3ff', '#ffffff']);
    }
    // grime / variation
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${R() * 0.05})`; x.fillRect(R() * 512, R() * 512, 2 + R() * 8, 2 + R() * 18); }
    return { map: this.texFrom(c, true), emis: this.texFrom(ce, true) };
  },
  makeRoadTex() {
    const [c, x] = this.canvas(256, 256);
    x.fillStyle = '#2a2a2e'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 5000; k++) { const v = 30 + Math.random() * 40; x.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
    // across the road (u) = 14 m -> 256 px; along (v) = 14 m. centre double yellow, white edge lines, dashes between lanes
    const m = 256 / 14;
    x.fillStyle = '#d6b44a'; x.fillRect(128 - 0.35 * m, 0, 0.15 * m, 256); x.fillRect(128 + 0.2 * m, 0, 0.15 * m, 256);
    x.fillStyle = 'rgba(235,235,235,0.85)'; x.fillRect(0.5 * m, 0, 0.15 * m, 256); x.fillRect(256 - 0.65 * m, 0, 0.15 * m, 256);
    // tyre polish streaks
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(128 + 2 * m, 0, 1.1 * m, 256); x.fillRect(128 - 3.1 * m, 0, 1.1 * m, 256);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(128 + 4.5 * m, 0, 0.9 * m, 256); x.fillRect(128 - 5.4 * m, 0, 0.9 * m, 256);
    return this.texFrom(c, true);
  },
  makeCrossTex() {
    const [c, x] = this.canvas(256, 256), m = 256 / 14;
    x.fillStyle = '#29292d'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 4000; k++) { const v = 30 + Math.random() * 40; x.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
    x.fillStyle = 'rgba(235,235,235,0.8)';
    for (let k = 0; k < 7; k++) { const o = (1 + k * 1.8) * m; x.fillRect(o, 2, 0.8 * m, 1.6 * m); x.fillRect(o, 256 - 2 - 1.6 * m, 0.8 * m, 1.6 * m); x.fillRect(2, o, 1.6 * m, 0.8 * m); x.fillRect(256 - 2 - 1.6 * m, o, 1.6 * m, 0.8 * m); }
    return this.texFrom(c, false);
  },
  makePaverTex() {
    const [c, x] = this.canvas(256, 256);
    x.fillStyle = '#6e6a72'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { const v = 95 + Math.random() * 30; x.fillStyle = `rgb(${v},${v - 4},${v + 6})`; x.fillRect(k * 32 + 1, r * 32 + 1, 30, 30); }
    return this.texFrom(c, true);
  },
  makeNoiseTex(kind) {
    const [c, x] = this.canvas(256, 256);
    if (kind === 'sand') { x.fillStyle = '#d8c39a'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 9000; k++) { const v = Math.random() * 40; x.fillStyle = `rgba(${150 + v},${130 + v},${90 + v},0.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); } }
    else if (kind === 'grass') { x.fillStyle = '#2f5a35'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 9000; k++) { const v = Math.random() * 50; x.fillStyle = `rgba(${30 + v},${80 + v},${40 + v / 2},0.6)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1, 2); } }
    else { // puddles: white = wet/reflective
      x.fillStyle = '#555'; x.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 60; k++) { const r = 6 + Math.random() * 40, px = Math.random() * 256, py = Math.random() * 256; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    }
    return this.texFrom(c, true);
  },
  makeGlowTex() {
    const [c, x] = this.canvas(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)'); g.addColorStop(0.45, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new this.T.CanvasTexture(c); return t;
  },
  makeSignAtlas() { // 8 neon street signs in one atlas (2 x 4 cells of 256x96)
    const [c, x] = this.canvas(512, 384);
    const words = [['MOTEL', '#ff4fd8'], ['OPEN 24H', '#28d7ff'], ['TACOS', '#ffd23f'], ['CLUB VICE', '#ff2d95'], ['SURF', '#5cf2a8'], ['BAR', '#ff6a3d'], ['PALMS', '#b38cff'], ['NO VACANCY', '#ff4d6d']];
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 384);
    words.forEach(([w, col], k) => {
      const cx = (k % 2) * 256 + 128, cy = Math.floor(k / 2) * 96 + 48;
      x.font = '700 46px "Bebas Neue", Impact, "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; x.fillText(w, cx, cy + 2);
      x.shadowBlur = 6; x.fillStyle = '#fff'; x.globalAlpha = 0.85; x.fillText(w, cx, cy + 2); x.globalAlpha = 1;
      x.shadowBlur = 0; x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(cx - 118, cy - 40, 236, 80);
    });
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },
  makeHotelSign() {
    const [c, x] = this.canvas(1024, 256);
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 256);
    x.font = '400 150px "Bebas Neue", Impact, "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [blur, col, a] of [[40, '#ff2d95', 1], [16, '#ff6ad5', 1], [4, '#ffe0f4', 1]]) { x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.globalAlpha = a; x.fillText('THE BIG SCORE', 512, 134); }
    x.shadowBlur = 0; x.globalAlpha = 1; x.fillStyle = '#fff5fb'; x.fillText('THE BIG SCORE', 512, 134);
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },
  makeSkyline() {
    const [c, x] = this.canvas(2048, 256);
    x.clearRect(0, 0, 2048, 256);
    let px = 0; const R = HX.rng(77);
    while (px < 2048) {
      const w = 20 + R() * 70, h = 30 + R() * 190 * (0.3 + 0.7 * Math.sin(px / 2048 * Math.PI));
      x.fillStyle = '#120a22'; x.fillRect(px, 256 - h, w, h);
      for (let k = 0; k < w * h / 40; k++) if (R() < 0.5) { x.fillStyle = R() < 0.7 ? 'rgba(255,214,150,0.85)' : 'rgba(150,220,255,0.8)'; x.fillRect(px + 2 + R() * (w - 4), 256 - h + 4 + R() * (h - 8), 2, 2); }
      if (R() < 0.2) { x.fillStyle = '#ff2d55'; x.fillRect(px + w / 2 - 1, 256 - h - 6, 2, 2); }
      px += w + R() * 6;
    }
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },
  // the skyline's exact layout (same random sequence) as hazy silhouettes: lighter toward the base, no window dots
  makeSkylineHaze() {
    const [c, x] = this.canvas(2048, 256);
    x.clearRect(0, 0, 2048, 256);
    let px = 0, n = 0; const R = HX.rng(77), Q = HX.rng(78); // R: the night map's exact layout; Q: extra detail only
    while (px < 2048) {
      const w = 20 + R() * 70, h = 30 + R() * 190 * (0.3 + 0.7 * Math.sin(px / 2048 * Math.PI)), v = [1, 0.84, 0.93][n++ % 3];
      const col = (k, a) => `rgba(${Math.round(150 * v * k)},${Math.round(148 * v * k)},${Math.round(146 * v * k)},${a})`;
      const g = x.createLinearGradient(0, 256 - h, 0, 256);
      g.addColorStop(0, col(1, 1)); g.addColorStop(0.7, col(1.3, 0.93)); g.addColorStop(1, 'rgba(255,250,240,0.58)');
      x.fillStyle = g;
      const top = Q();  // silhouette: flat roof, setbacks, a needle spire or a pyramid crown
      if (top < 0.3 && w > 34) { x.fillRect(px, 256 - h * 0.86, w, h * 0.86); x.fillRect(px + w * 0.16, 256 - h, w * 0.68, h * 0.15); x.fillRect(px + w * 0.34, 256 - h - 7, w * 0.32, 8); }
      else if (top < 0.45) { x.fillRect(px, 256 - h, w, h); x.fillRect(px + w / 2 - 1.5, 256 - h - 16 - Q() * 14, 3, 30); }
      else if (top < 0.55 && w > 26) { x.fillRect(px, 256 - h, w, h); x.beginPath(); x.moveTo(px, 256 - h); x.lineTo(px + w / 2, 256 - h - w * 0.45); x.lineTo(px + w, 256 - h); x.fill(); }
      else x.fillRect(px, 256 - h, w, h);
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(px + w * 0.62, 256 - h, w * 0.38, h);   // the lit side
      x.fillStyle = 'rgba(0,0,0,0.035)'; for (let fy = 256 - h + 3; fy < 250; fy += 3) x.fillRect(px, fy, w, 1); // floor lines in the haze
      for (let k = 0; k < w * h / 40; k++) if (R() < 0.5) { R(); R(); R(); }                     // (the night map's windows)
      if (R() < 0.2) { x.fillStyle = `rgba(150,150,150,1)`; x.fillRect(px + w / 2 - 1, 256 - h - 14, 2, 14); }
      px += w + R() * 6;
    }
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },
  makeLeafTex() {
    const [c, x] = this.canvas(128, 512);
    x.clearRect(0, 0, 128, 512);
    x.strokeStyle = '#2f6b33'; x.lineWidth = 6; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 512); x.stroke();
    for (let k = 0; k < 40; k++) {
      const y = 10 + k * 12.4, L = 58 * Math.sin((k + 2) / 44 * Math.PI);
      x.strokeStyle = k % 3 ? '#3f8a3f' : '#357a36'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(64, y); x.lineTo(64 - L, y + 22); x.stroke();
      x.beginPath(); x.moveTo(64, y); x.lineTo(64 + L, y + 22); x.stroke();
    }
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },

  /* ---------- build ---------- */
  build(T, scene, opts) {
    this.T = T; this.scene = scene; this.q = (opts && opts.quality) || 'high';
    this.maxAniso = (opts && opts.maxAniso) || 4; this.envMap = (opts && opts.envMap) || null;
    this.glowSets = []; this.reflectables = []; this.time = 0;
    HX.resetWorld(); HX.buildGraph();
    const tx = this.tex;
    tx.road = this.makeRoadTex(); tx.cross = this.makeCrossTex(); tx.paver = this.makePaverTex();
    tx.sand = this.makeNoiseTex('sand'); tx.grass = this.makeNoiseTex('grass'); tx.puddle = this.makeNoiseTex('puddle');
    tx.glow = this.makeGlowTex(); tx.signs = this.makeSignAtlas(); tx.hotelSign = this.makeHotelSign(); tx.leaf = this.makeLeafTex();
    tx.facades = { deco: [1, 2, 3].map(s => this.makeFacade('deco', s * 17)), glass: [1, 2].map(s => this.makeFacade('glass', s * 31)), concrete: [1, 2].map(s => this.makeFacade('concrete', s * 43)), tower: [1, 2].map(s => this.makeFacade('tower', s * 59)) };

    this.todHooks = [];
    this.planCrewBlocks();
    this.buildGround();
    this.buildBlocks();
    this.buildHotel();
    this.buildGunStore();
    this.buildBank();
    this.buildStreetFurniture();
    this.buildBridgeAndIsland();
    this.buildLookout();
    this.buildWater();
    this.buildSky();
    this.buildBounds();
    this.buildCrewPoints();
    this.setTimeOfDay(0);
    return this;
  },

  roadMaterial(tex, repeatV) {
    const T = this.T;
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.0, roughnessMap: this.tex.puddle, envMapIntensity: 0.6 });
    m.userData.refl = true;
    return m;
  },

  buildGround() {
    const T = this.T, H = HX.HALF, P = HX.P, scene = this.scene;
    // roads: long strips along every grid line (UVs: u across the road, v along)
    const rg = this.GB();
    for (let i = 0; i <= HX.N; i++) {
      const c = HX.L(i);
      // north-south strip (x = c): u across x, v along z
      const b = rg.p.length / 3, z0 = -H - 7, z1 = H + 7;
      rg.p.push(c - 7, 0.02, z1, c + 7, 0.02, z1, c + 7, 0.02, z0, c - 7, 0.02, z0);
      for (let k = 0; k < 4; k++) rg.n.push(0, 1, 0);
      rg.u.push(0, 0, 1, 0, 1, (z1 - z0) / 14, 0, (z1 - z0) / 14); rg.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
      // east-west strip (z = c): u across z, v along x
      const e = rg.p.length / 3, x0 = -H - 7, x1 = H + 7;
      rg.p.push(x0, 0.021, c + 7, x1, 0.021, c + 7, x1, 0.021, c - 7, x0, 0.021, c - 7);
      for (let k = 0; k < 4; k++) rg.n.push(0, 1, 0);
      rg.u.push(1, 0, 1, (x1 - x0) / 14, 0, (x1 - x0) / 14, 0, 0); rg.i.push(e, e + 1, e + 2, e, e + 2, e + 3);
    }
    const roads = new T.Mesh(rg.geo(), this.mats.road = this.roadMaterial(this.tex.road));
    roads.receiveShadow = true; scene.add(roads); this.reflectables.push(roads);
    // intersections on top (hide the overlapping markings, add crosswalks)
    const ig = this.GB();
    for (let i = 0; i <= HX.N; i++) for (let j = 0; j <= HX.N; j++) ig.top(HX.L(i) - 7, HX.L(j) - 7, HX.L(i) + 7, HX.L(j) + 7, 0.03, 14, 14);
    // fix UVs to 0..1 per patch
    for (let k = 0; k < ig.u.length; k += 8) { ig.u[k] = 0; ig.u[k + 1] = 0; ig.u[k + 2] = 1; ig.u[k + 3] = 0; ig.u[k + 4] = 1; ig.u[k + 5] = 1; ig.u[k + 6] = 0; ig.u[k + 7] = 1; }
    const inter = new T.Mesh(ig.geo(), this.mats.cross = this.roadMaterial(this.tex.cross));
    inter.receiveShadow = true; scene.add(inter); this.reflectables.push(inter);
    // under-city base (dark) so nothing is ever see-through
    // (it stops where the beach slopes into the sea at x = 330, otherwise it would hide the bay)
    const base = new T.Mesh(new T.PlaneGeometry(1030, 1400), new T.MeshStandardMaterial({ color: 0x1a1720, roughness: 1 }));
    base.rotation.x = -Math.PI / 2; base.position.set(-185, -0.02, 0); scene.add(base);
  },

  // pick building kind / height from the location
  zoneOf(x, z) {
    const coast = x > 150, down = Math.abs(x + 20) < 140 && z > -200 && z < 60;
    return coast ? 'coast' : down ? 'down' : 'mid';
  },
  buildBlocks() {
    const T = this.T, scene = this.scene, R = HX.rng(1234);
    const facadeSets = this.tex.facades;
    // one merged geometry per facade texture
    const builders = new Map(); const getB = (kind, k) => { const key = kind + k; if (!builders.has(key)) builders.set(key, { kind, k, gb: this.GB(), roof: this.GB() }); return builders.get(key); };
    const side = this.GB(); // sidewalks
    const neonB = this.GB(); const haloB = this.GB();
    const signsB = this.GB(); const parks = this.GB();
    const neonCols = ['#ff2d95', '#28d7ff', '#b38cff', '#ff4fd8', '#5cf2a8', '#ffd23f'];
    this.lots = [];
    const hb = HX.HOTEL_BLOCK;
    // chapter 3 hero blocks: every random roll still happens (so the rest of the city and HWorld.lots stay exactly
    // as before) but the output goes into throwaway builders; buildGunStore / buildBank fill these blocks
    const sink = { gb: this.GB(), roof: this.GB() }, sinkN = this.GB(), sinkH = this.GB(), sinkS = this.GB();
    for (let i = 0; i < HX.N; i++) for (let j = 0; j < HX.N; j++) {
      const x0 = HX.L(i) + 7, x1 = HX.L(i + 1) - 7, z0 = HX.L(j) + 7, z1 = HX.L(j + 1) - 7;
      const crew = HX.crewBlock(i, j);
      // sidewalk slab (raised 15 cm, pavers); the hero blocks lay their own (parking bay, steps)
      if (!crew) side.box(x0, 0, z0, x1, 0.15, z1, 4, 4);
      if (i === hb[0] && j === hb[1]) continue; // hotel built separately
      if (HX.PARK_BLOCKS.includes(i + ',' + j)) { parks.top(x0 + 3, z0 + 3, x1 - 3, z1 - 3, 0.17, 8, 8); this.lots.push({ park: true, x0, z0, x1, z1 }); continue; }
      const bx0 = x0 + 4, bx1 = x1 - 4, bz0 = z0 + 4, bz1 = z1 - 4, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      const zone = this.zoneOf(cx, cz);
      const split = R(); const lots = [];
      if (split < 0.3) lots.push([bx0, bz0, bx1, bz1]);
      else if (split < 0.6) { const m = HX.lerp(bx0, bx1, 0.4 + R() * 0.2); lots.push([bx0, bz0, m - 2, bz1], [m + 2, bz0, bx1, bz1]); }
      else if (split < 0.8) { const m = HX.lerp(bz0, bz1, 0.4 + R() * 0.2); lots.push([bx0, bz0, bx1, m - 2], [bx0, m + 2, bx1, bz1]); }
      else { const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2; lots.push([bx0, bz0, mx - 2, mz - 2], [mx + 2, bz0, bx1, mz - 2], [bx0, mz + 2, mx - 2, bz1], [mx + 2, mz + 2, bx1, bz1]); }
      const neon = crew ? sinkN : neonB, halo = crew ? sinkH : haloB, signs = crew ? sinkS : signsB;
      for (const [a0, c0, a1, c1] of lots) {
        let kind, h;
        if (zone === 'coast') { kind = 'deco'; h = 10 + R() * 16; }
        else if (zone === 'down') { kind = R() < 0.55 ? 'glass' : R() < 0.5 ? 'tower' : 'concrete'; h = 40 + R() * 95; if (R() < 0.15) h += 60; }
        else { kind = R() < 0.4 ? 'deco' : R() < 0.6 ? 'concrete' : 'glass'; h = 14 + R() * 38; }
        h = Math.round(h / 3.5) * 3.5;
        const set = facadeSets[kind], k = Math.floor(R() * set.length), b = crew ? sink : getB(kind, k);
        b.gb.box(a0, 0.15, c0, a1, 0.15 + h, c1, 32, 28, null, Math.floor(R() * 8), true);
        b.roof.top(a0, c0, a1, c1, 0.15 + h, 8, 8);
        // roof parapet + rooftop boxes
        b.roof.box(a0 + 1, 0.15 + h, c0 + 1, a0 + 3 + R() * 4, 0.15 + h + 1.5 + R() * 2, c0 + 3 + R() * 4, 4, 4);
        if (!crew) HX.addBox(a0, c0, a1, c1, h + 0.15, 'building');
        this.lots.push(crew ? { x0: a0, z0: c0, x1: a1, z1: c1, h, kind, crew } : { x0: a0, z0: c0, x1: a1, z1: c1, h, kind });
        // neon trims on deco + some others
        if (kind === 'deco' || R() < 0.25) {
          const col = this.hex(neonCols[Math.floor(R() * neonCols.length)]), y = 0.15 + h - 0.6;
          this.neonRect(neon, halo, a0, c0, a1, c1, y, col);
          if (h > 14 && R() < 0.7) this.neonRect(neon, halo, a0, c0, a1, c1, 0.15 + h * (0.35 + R() * 0.2), this.hex(neonCols[Math.floor(R() * neonCols.length)]));
          if (R() < 0.6) { // vertical corner tubes
            for (const [px, pz] of [[a0, c0], [a1, c0], [a0, c1], [a1, c1]]) this.neonBox(neon, halo, px - 0.12, 0.6, pz - 0.12, px + 0.12, 0.15 + h, pz + 0.12, col);
          }
        }
        if (kind === 'tower' || (kind === 'glass' && R() < 0.5)) this.neonRect(neon, halo, a0, c0, a1, c1, 0.15 + h + 0.2, this.hex(R() < 0.5 ? '#28d7ff' : '#b38cff'));
        // street level neon signs facing the nearest road
        if (R() < 0.75) this.addSign(signs, a0, c0, a1, c1, R);
      }
    }
    // the hero blocks' background buildings use the same facade sets (they blend into the city)
    for (const f of this.crewFill || []) {
      const b = getB(f.kind, f.k);
      b.gb.box(f.x0, 0.15, f.z0, f.x1, 0.15 + f.h, f.z1, 32, 28, null, f.uo || 0, true);
      b.roof.top(f.x0, f.z0, f.x1, f.z1, 0.15 + f.h, 8, 8);
      b.roof.box(f.x0 + 1.5, 0.15 + f.h, f.z0 + 1.5, f.x0 + 5, 0.15 + f.h + 2.4, f.z0 + 4.5, 4, 4);
      HX.addBox(f.x0, f.z0, f.x1, f.z1, f.h + 0.15, 'building');
      if (f.neon) this.neonRect(neonB, haloB, f.x0, f.z0, f.x1, f.z1, 0.15 + f.h + 0.2, this.hex(f.neon));
    }
    for (const sl of this.crewSlabs || []) side.box(sl[0], 0, sl[1], sl[2], 0.15, sl[3], 4, 4);
    const sideMat = new T.MeshStandardMaterial({ map: this.tex.paver, roughness: 0.6, color: 0x9a96a8 });
    sideMat.userData.refl = true;
    const sideMesh = new T.Mesh(side.geo(), sideMat); sideMesh.receiveShadow = true; this.scene.add(sideMesh); this.reflectables.push(sideMesh);
    this.mats.sidewalk = sideMat;
    const parkMesh = new T.Mesh(parks.geo(), new T.MeshStandardMaterial({ map: this.tex.grass, roughness: 0.95 })); scene.add(parkMesh);
    this.mats.facades = [];
    for (const b of builders.values()) {
      const f = facadeSets[b.kind][b.k];
      const mat = new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emis, emissive: 0xffffff, emissiveIntensity: 1, roughness: b.kind === 'glass' ? 0.3 : 0.88, metalness: b.kind === 'glass' ? 0.5 : 0.0, envMap: b.kind === 'glass' ? this.envMap : null, envMapIntensity: 0.35 });
      this.mats.facades.push(mat);
      const m = new T.Mesh(b.gb.geo(), mat); scene.add(m);
      const roof = new T.Mesh(b.roof.geo(), this.mats.roof || (this.mats.roof = new T.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.9 })));
      scene.add(roof);
    }
    this.mats.neon = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const nm = new T.Mesh(neonB.geo(), this.mats.neon); scene.add(nm); nm.layers.enable(1);
    this.mats.halo = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const hm = new T.Mesh(haloB.geo(), this.mats.halo); scene.add(hm); hm.layers.enable(1);
    this.mats.signs = new T.MeshBasicMaterial({ map: this.tex.signs, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide });
    const sm = new T.Mesh(signsB.geo(), this.mats.signs); scene.add(sm); sm.layers.enable(1);
  },
  // neon tube rectangle around a building at height y (+ soft halo strip)
  neonRect(neon, halo, x0, z0, x1, z1, y, col) {
    const t = 0.13, e = 0.06;
    this.neonBox(neon, halo, x0 - e, y - t, z0 - e - t, x1 + e, y + t, z0 - e, col);
    this.neonBox(neon, halo, x0 - e, y - t, z1 + e, x1 + e, y + t, z1 + e + t, col);
    this.neonBox(neon, halo, x0 - e - t, y - t, z0 - e, x0 - e, y + t, z1 + e, col);
    this.neonBox(neon, halo, x1 + e, y - t, z0 - e, x1 + e + t, y + t, z1 + e, col);
  },
  neonBox(neon, halo, x0, y0, z0, x1, y1, z1, col) {
    neon.box(x0, y0, z0, x1, y1, z1, 1, 1, col);
    const g = 0.55; // halo: a wider faint shell
    halo.box(x0 - g, y0 - g, z0 - g, x1 + g, y1 + g, z1 + g, 1, 1, col);
  },
  addSign(signs, a0, c0, a1, c1, R) {
    // choose the side that faces a road (all lots border a street on at least one side within the block)
    const k = Math.floor(R() * 8), cu = (k % 2) * 0.5, cv = 1 - (Math.floor(k / 2) + 1) * 0.25;
    const w = 6 + R() * 3, h = w * 0.375, y = 3.2 + R() * 2;
    const sideK = Math.floor(R() * 4); let ox, oz, rx, rz, nx, nz;
    if (sideK === 0) { ox = HX.lerp(a0 + 1, a1 - w - 1, R()); oz = c1 + 0.25; rx = 1; rz = 0; nx = 0; nz = 1; }
    else if (sideK === 1) { ox = HX.lerp(a0 + w + 1, a1 - 1, R()); oz = c0 - 0.25; rx = -1; rz = 0; nx = 0; nz = -1; }
    else if (sideK === 2) { ox = a1 + 0.25; oz = HX.lerp(c1 - 1, c0 + w + 1, R()); rx = 0; rz = -1; nx = 1; nz = 0; }
    else { ox = a0 - 0.25; oz = HX.lerp(c0 + 1, c1 - w - 1, R()); rx = 0; rz = 1; nx = -1; nz = 0; }
    if ((a1 - a0) < w + 3 && sideK < 2) return; if ((c1 - c0) < w + 3 && sideK >= 2) return;
    const b = signs.p.length / 3;
    signs.p.push(ox, y, oz, ox + rx * w, y, oz + rz * w, ox + rx * w, y + h, oz + rz * w, ox, y + h, oz);
    for (let q = 0; q < 4; q++) signs.n.push(nx, 0, nz);
    signs.u.push(cu, cv, cu + 0.5, cv, cu + 0.5, cv + 0.25, cu, cv + 0.25);
    signs.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  },

  /* ---------- THE BIG SCORE hotel (block 1,3), facing east onto the avenue at x = -140 ---------- */
  buildHotel() {
    const T = this.T, scene = this.scene;
    const x0 = -196, x1 = -162, z0 = -57, z1 = -13, h = 24;
    const g = new T.Group(); scene.add(g);
    // white art-deco body with a stepped central tower
    const white = new T.MeshStandardMaterial({ color: 0xf2eef6, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5 });
    const gb = this.GB(); gb.box(x0, 0.15, z0, x1, h, z1, 1, 1, null, 0, false);
    gb.box(x1 - 10, 0.15, -43, x1 + 0.6, h + 9, -27, 1, 1, null, 0, false); // centre tower (slightly proud)
    gb.box(x1 - 6, h + 9, -39, x1 + 0.6, h + 17, -31, 1, 1, null, 0, false); // fin / crown
    const body = new T.Mesh(gb.geo(), white); body.receiveShadow = true; g.add(body);
    HX.addBox(x0, z0, x1 + 0.6, z1, h + 17, 'hotel');
    // window rows (glowing) on the east facade
    const win = this.GB(); const warm = this.hex('#ffd6a8');
    for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) {
      const zz = z0 + 3 + k * 4.6, yy = 4.2 + f * 3.4;
      if (zz > -44 && zz < -26) continue;
      win.face(x1 + 0.05, yy, zz + 2.2, 0, -1, 2.2, 1.8, 1, 0, 0, 0, 1, 1, warm);
    }
    for (let f = 0; f < 8; f++) win.face(x1 + 0.65, 4 + f * 3.4, -32, 0, -1, 6, 1.6, 1, 0, 0, 0, 1, 1, this.hex('#ffe9c8'));
    const winM = new T.Mesh(win.geo(), new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.9 })); g.add(winM); // (not reflected: only neon streaks on the wet road)
    this.mats.hotelWin = winM.material;
    // purple / pink neon floor bands (the look from the trailer)
    const neon = this.GB(), halo = this.GB();
    for (let f = 0; f < 7; f++) {
      const y = 3 + f * 3.4, col = this.hex(f % 2 ? '#b34dff' : '#ff4fd8');
      this.neonBox(neon, halo, x1 + 0.1, y, z0, x1 + 0.35, y + 0.22, -44, col);
      this.neonBox(neon, halo, x1 + 0.1, y, -26, x1 + 0.35, y + 0.22, z1, col);
    }
    this.neonRect(neon, halo, x0, z0, x1, z1, h - 0.3, this.hex('#ff2d95'));
    this.neonRect(neon, halo, x1 - 10, -43, x1 + 0.6, -27, h + 8.7, this.hex('#28d7ff'));
    this.neonBox(neon, halo, x1 + 0.6, 2, -43.4, x1 + 0.9, h + 9, -43.1, this.hex('#28d7ff'));
    this.neonBox(neon, halo, x1 + 0.6, 2, -26.9, x1 + 0.9, h + 9, -26.6, this.hex('#28d7ff'));
    const nm = new T.Mesh(neon.geo(), this.mats.neon); g.add(nm); nm.layers.enable(1);
    const hm = new T.Mesh(halo.geo(), this.mats.halo); g.add(hm); hm.layers.enable(1);
    // the sign: "THE BIG SCORE" over the entrance canopy + a big one on the crown
    const signMat = this.mats.hotelSign = new T.MeshBasicMaterial({ map: this.tex.hotelSign, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const s1 = new T.Mesh(new T.PlaneGeometry(16, 4), signMat); s1.position.set(x1 + 0.75, 6.6, -35); s1.rotation.y = Math.PI / 2; g.add(s1); s1.layers.enable(1);
    const s2 = new T.Mesh(new T.PlaneGeometry(22, 5.5), signMat); s2.position.set(x1 + 0.75, h + 4.5, -35); s2.rotation.y = Math.PI / 2; g.add(s2); s2.layers.enable(1);
    // entrance: canopy + glowing glass doors
    const canopy = new T.Mesh(new T.BoxGeometry(5, 0.35, 12), new T.MeshStandardMaterial({ color: 0x1d1426, roughness: 0.5 }));
    canopy.position.set(x1 + 2.5, 4.4, -35); g.add(canopy);
    const under = new T.Mesh(new T.PlaneGeometry(4.6, 11.6), new T.MeshBasicMaterial({ color: 0xffd9b0, toneMapped: false }));
    under.rotation.x = Math.PI / 2; under.position.set(x1 + 2.5, 4.2, -35); g.add(under);
    const doors = new T.Mesh(new T.PlaneGeometry(6, 3.4), new T.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false }));
    doors.position.set(x1 + 0.66, 1.85, -35); doors.rotation.y = Math.PI / 2; g.add(doors); doors.layers.enable(1);
    // red carpet + stanchions
    const carpet = new T.Mesh(new T.PlaneGeometry(9, 3), new T.MeshStandardMaterial({ color: 0x8a0f24, roughness: 0.9 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(x1 + 5, 0.17, -35); g.add(carpet);
    this.hotel = {
      door: { x: x1 + 1.2, z: -35 }, front: { x: x1 + 6, z: -35 },
      hacker: { x: -151.5, z: -47.5, h: -2.3 }, carSpot: { x: -143.5, z: -23, h: Math.PI },
      start: { x: -134.2, z: -31, h: -Math.PI / 2 },   // on the far kerb, facing the hotel across the avenue
    };
    // up-lights washing the facade (glow points)
    const ups = [];
    for (let k = 0; k < 10; k++) ups.push([x1 + 0.8, 0.6, z0 + 2 + k * 4.6, k % 2 ? '#b34dff' : '#ff4fd8']);
    this.addGlows(ups, 7, 0.9);
    // plaza palms
    this.palmSpots = [[x1 + 9, -17], [x1 + 9, -53], [x1 + 9, -42], [x1 + 9, -28]];
  },

  /* =====================================================================================================
     Chapter 3 "THE CREW": IRONSIDE ARMORY (gun store), OCEAN TRUST BANK, the gas-trap corner, the Key Island
     lookout and the crew's start / free-roam spots. Exported points (all walkable / drivable, outside every
     collision box; h = heading, 0 faces +z like cars):
       HWorld.gunStore  { door, front, park:{x,z,h}, bay:{x0,z0,x1,z1}, name }
       HWorld.bank      { door, front, park:{x,z,h}, back:{x,z,h}, backDoor, name }
       HWorld.trap      { x, z (intersection centre), prop:{x,z,h} (kerb corner for the gas cylinders) }
       HWorld.lookout   { x, z, carSpot:{x,z,h}, crew:[yoav, hadar, ido] {x,z,h}, crewById, cam:{x,y,z,lx,ly,lz,fov} }
       HWorld.crewStart { car:{x,z,h} }
       HWorld.crewHomes { yoav|hadar|ido: {x,z,h, car:{x,z,h}} }
       HWorld.crewPaths { toStore, toBank, pickup, escape, toLookout }  (suggested road polylines for the GPS)
     ===================================================================================================== */
  // block-local layout decided before buildBlocks runs: background buildings, sidewalk slabs, palms, poles to skip
  planCrewBlocks() {
    const gx = HX.L(HX.GUNSTORE_BLOCK[0]), gz = HX.L(HX.GUNSTORE_BLOCK[1]); // (0, 70)
    const bx = HX.L(HX.BANK_BLOCK[0]), bz = HX.L(HX.BANK_BLOCK[1]);         // (0, -140)
    this.crewFill = [
      // behind the gun-store strip: a five-storey block of flats over the shops (its roofline frames the store sign)
      { kind: 'concrete', k: 0, x0: gx + 11.5, z0: gz + 38, x1: gx + 58.5, z1: gz + 58.5, h: 17.5, uo: 3 },
      // OCEAN TRUST headquarters: the glass slab rising behind the old banking hall
      { kind: 'glass', k: 1, x0: bx + 11, z0: bz + 13, x1: bx + 21.5, z1: bz + 43, h: 98, uo: 5, neon: '#5cf2d8' },
    ];
    // gun-store block slab with a recessed kerbside parking bay in front of the store (x 25..47, 2.4 m deep)
    this.crewSlabs = [
      [gx + 7, gz + 9.4, gx + 63, gz + 63], [gx + 7, gz + 7, gx + 25, gz + 9.4], [gx + 47, gz + 7, gx + 63, gz + 9.4],
      [bx + 7, bz + 7, bx + 63, bz + 63],
    ];
    this.crewNoPoles = [[bx + 60, bz + 25, bx + 63, bz + 45]]; // no lamp post in front of the bank steps
    this.crewPalms = [
      [bx + 29, bz + 15.4], [bx + 39, bz + 15.6], [bx + 49, bz + 15.2],   // the bank's north lawn
      [bx + 15, bz + 50], [bx + 19.5, bz + 55.5],                          // its south-west garden
      [gx + 12.6, gz + 10.6], [gx + 59.2, gz + 10.6],                      // framing the gun-store strip
    ];
    const lk = this._lk = this.lookoutStaging();
    this.crewPalms.push(...lk.palms);                                       // the Key Island lookout
  },
  // The lookout shot (the video's last frame): the trio in front of the car, the skyline and the low sun right behind
  // them. The sky dome is centred on the origin, so seen from the island the sun disc sits ~34 deg north of east and
  // ~10 deg up (parallax): aim the whole staging at where the disc really appears from the camera at sunset (tod 1).
  lookoutStaging() {
    const O = { x: 949.4, z: -33.6 }, dist = 3.4, camY = 1.0;
    const sy = this.PALETTES[1].sunY, sl = Math.hypot(1, sy, -0.42), S = { x: 2600 / sl, y: 2600 * sy / sl, z: -0.42 * 2600 / sl };
    let a = Math.atan2(-0.42, 1), C = O;
    for (let it = 0; it < 4; it++) { // camera = O - dist*d, d aims a little right of the sun so the sun sits just left of the middle head
      C = { x: O.x - Math.cos(a) * dist, z: O.z - Math.sin(a) * dist };
      a = Math.atan2(S.z - C.z, S.x - C.x) + 0.07;
    }
    const dx = Math.cos(a), dz = Math.sin(a), rx = -dz, rz = dx;
    const at = (k, back) => ({ x: +(O.x + rx * k + dx * back).toFixed(2), z: +(O.z + rz * k + dz * back).toFixed(2) });
    const face = Math.atan2(-dx, -dz), sunEl = Math.atan2(S.y - camY, Math.hypot(S.x - C.x, S.z - C.z));
    return {
      O, dx, dz, rx, rz, sunEl,
      crew: { hadar: { ...at(-1.45, 0.05), h: +(face + 0.22).toFixed(3) }, ido: { ...at(0, 0.3), h: +(face + 0.05).toFixed(3) }, yoav: { ...at(1.5, 0), h: +(face - 0.25).toFixed(3) } },
      car: { ...at(0.1, 2.25), h: +Math.atan2(rx, rz).toFixed(3) },
      cam: { ...at(0, -dist), y: camY, look: at(0, 1.0), ly: camY + (dist + 1.0) * Math.tan(0.052) },   // knees-up, 3 deg up
      palms: [[at(-6.5, -2.5).x, at(-6.5, -2.5).z], [at(6.6, 5.8).x, at(6.6, 5.8).z]],                // just outside the frame
    };
  },

  /* ---------- canvas helpers ---------- */
  rrect(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); },
  fitText(x, text, maxW, px, family, weight) { let s = px; x.font = `${weight || 400} ${s}px ${family}`; while (x.measureText(text).width > maxW && s > 8) { s -= 2; x.font = `${weight || 400} ${s}px ${family}`; } return s; },
  spacedText(x, text, cx, cy, sp) { // centred text with extra letter spacing (canvas letterSpacing is not everywhere)
    const ws = [...text].map(ch => x.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
    let px = cx - tot / 2; const al = x.textAlign; x.textAlign = 'left';
    [...text].forEach((ch, k) => { x.fillText(ch, px, cy); px += ws[k] + sp; });
    x.textAlign = al; return tot;
  },
  SIGN_FONT: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
  SERIF_FONT: 'Georgia, "Times New Roman", "Liberation Serif", "DejaVu Serif", serif',
  // the store emblem: a riveted shield with a crosshair (original mark)
  drawShield(x, cx, cy, s, fill, ring, cross) {
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.beginPath(); x.moveTo(-50, -56); x.lineTo(50, -56); x.lineTo(50, 2); x.quadraticCurveTo(48, 42, 0, 64); x.quadraticCurveTo(-48, 42, -50, 2); x.closePath();
    x.fillStyle = fill; x.fill(); x.lineWidth = 7; x.strokeStyle = ring; x.stroke();
    x.strokeStyle = cross; x.lineWidth = 6; x.beginPath(); x.arc(0, 2, 26, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.moveTo(0, -36); x.lineTo(0, -10); x.moveTo(0, 14); x.lineTo(0, 40); x.moveTo(-38, 2); x.lineTo(-12, 2); x.moveTo(12, 2); x.lineTo(38, 2); x.stroke();
    x.fillStyle = cross; x.beginPath(); x.arc(0, 2, 4.5, 0, Math.PI * 2); x.fill();
    x.restore();
  },

  /* ---------- IRONSIDE ARMORY textures ---------- */
  makeArmorySign() { // 17.6 x 2.9 m channel-letter sign on a gunmetal plate
    const W = 1024, H = 168, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H), F = this.SIGN_FONT;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3d434a'); g.addColorStop(0.55, '#262a30'); g.addColorStop(1, '#1a1d21');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(Math.random() * W, Math.random() * H, 30 + Math.random() * 180, 1); }
    x.strokeStyle = '#5d646c'; x.lineWidth = 6; x.strokeRect(5, 5, W - 10, H - 10);
    x.fillStyle = '#8a929b'; for (let px = 22; px < W; px += 82) for (const py of [15, H - 15]) { x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); }
    // hazard-orange rule along the bottom, a thin one at the top
    x.fillStyle = '#e8581c'; x.fillRect(150, H - 34, W - 170, 7); x.fillRect(150, 26, W - 170, 3);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
    this.drawShield(x, 78, 80, 1.08, '#16191d', '#c9ced4', '#e8581c');
    this.drawShield(xe, 78, 80, 1.08, '#000', '#6a6e72', '#ff5a1a');
    // IRONSIDE (white) + ARMORY (orange), one line
    const t1 = 'IRONSIDE', t2 = 'ARMORY', gap = 26;
    let s = 132; x.font = `400 ${s}px ${F}`;
    while (x.measureText(t1).width + x.measureText(t2).width + gap > W - 200 && s > 40) { s -= 2; x.font = `400 ${s}px ${F}`; }
    const w1 = x.measureText(t1).width, w2 = x.measureText(t2).width, x0 = 160 + (W - 180 - (w1 + w2 + gap)) / 2, y = H / 2 + 6;
    for (const [ctx, emis] of [[x, false], [xe, true]]) {
      ctx.font = `400 ${s}px ${F}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (!emis) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(t1, x0 + 4, y + 5); ctx.fillText(t2, x0 + w1 + gap + 4, y + 5); }
      ctx.fillStyle = emis ? '#fff4e6' : '#f4f1ea'; ctx.fillText(t1, x0, y);
      ctx.fillStyle = emis ? '#ff6a1f' : '#ef6a26'; ctx.fillText(t2, x0 + w1 + gap, y);
    }
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  // interior seen through the shop glass (shared by doors and display windows): slat wall, long-gun silhouettes, counter, lights
  paintArmoryInside(x, W, H, R, emis) {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, emis ? '#fff6e0' : '#a8a296'); g.addColorStop(0.62, emis ? '#d9cfba' : '#8f887a'); g.addColorStop(1, emis ? '#7d7466' : '#4e483f');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (emis) return;
    x.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 8; y < H * 0.6; y += 9) x.fillRect(0, y, W, 2); // slat wall
    for (let row = 0; row < 3; row++) for (let k = 0; k < W / 26; k++) { // rifles on the wall, a few gaps
      if (R() < 0.18) continue;
      const px = 8 + k * 26 + R() * 4, py = 14 + row * H * 0.17, L = H * 0.13;
      x.save(); x.translate(px, py); x.rotate(-0.55 + R() * 0.08); x.fillStyle = R() < 0.25 ? '#4a3a2a' : '#1d1e21';
      x.fillRect(0, 0, 3, L); x.fillRect(-2, L * 0.62, 7, L * 0.34); x.restore();
    }
    x.fillStyle = '#3c3a38'; x.fillRect(0, H * 0.6, W, H * 0.05);        // counter top
    x.fillStyle = 'rgba(160,190,210,0.35)'; x.fillRect(0, H * 0.65, W, H * 0.2); // glass display
    x.fillStyle = '#2a2826'; x.fillRect(0, H * 0.85, W, H * 0.15);
    for (let k = 0; k < W / 40; k++) { x.fillStyle = ['#c23b22', '#d9a21a', '#2f6b9a', '#3c8a4a'][Math.floor(R() * 4)]; x.fillRect(6 + k * 40 + R() * 8, H * 0.7, 14, 8); }
  },
  sticker(x, R, cx, cy, s) { // a random small sticker / decal (all made-up text)
    const kinds = [['#c8102e', '#fff', 'SALE'], ['#ffd23f', '#111', 'AMMO'], ['#1b4d8f', '#fff', 'CCW'], ['#0f7a3a', '#fff', 'RANGE'], ['#fff', '#c8102e', '-25%'], ['#111', '#ffd23f', 'GEAR'], ['#e8581c', '#fff', 'OPEN'], ['#fff', '#1b4d8f', 'VET OWNED']];
    const [bg, fg, txt] = kinds[Math.floor(R() * kinds.length)];
    x.save(); x.translate(cx, cy); x.rotate((R() - 0.5) * 0.25);
    if (R() < 0.45) { x.beginPath(); x.arc(0, 0, 11 * s, 0, 7); x.fillStyle = bg; x.fill(); x.strokeStyle = fg; x.lineWidth = 1.5; x.stroke(); }
    else { x.fillStyle = bg; x.fillRect(-16 * s, -8 * s, 32 * s, 16 * s); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.strokeRect(-16 * s, -8 * s, 32 * s, 16 * s); }
    x.fillStyle = fg; x.font = `700 ${Math.round(7 * s)}px Rubik, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 0.5);
    x.restore();
  },
  makeArmoryDoors() { // glass of the double doors + transom (4.6 x 3.45 m): the video's sticker-covered doors
    const W = 512, H = 384, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H), R = HX.rng(31337), R2 = HX.rng(31337);
    this.paintArmoryInside(x, W, H, R, false); this.paintArmoryInside(xe, W, H, R2, true);
    // glass sheen: darker toward the bottom, a diagonal reflection band
    const sh = x.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(255,236,210,0.1)'); sh.addColorStop(1, 'rgba(14,18,24,0.35)');
    x.fillStyle = sh; x.fillRect(0, 0, W, H);
    const cover = (fn) => { fn(x); xe.save(); xe.globalCompositeOperation = 'source-over'; fn(xe, true); xe.restore(); };
    const tr = 62; // transom height in px (0.55 m)
    for (const side of [0, 1]) {
      const ox = side * 256, mid = ox + 128;
      // big round logo sticker (our emblem on a red disc)
      cover((ctx, e) => {
        ctx.beginPath(); ctx.arc(mid, tr + 108, 52, 0, 7); ctx.fillStyle = e ? '#000' : '#b3121f'; ctx.fill();
        if (!e) { ctx.lineWidth = 5; ctx.strokeStyle = '#f4f1ea'; ctx.stroke(); this.drawShield(ctx, mid, tr + 104, 0.62, '#b3121f', '#f4f1ea', '#f4f1ea'); }
      });
      // a tall poster on the outer edge
      cover((ctx, e) => {
        const px = side ? ox + 196 : ox + 10, py = tr + 176, pw = 50, ph = 96;
        ctx.fillStyle = e ? '#000' : '#f2efe6'; ctx.fillRect(px, py, pw, ph);
        if (e) return;
        ctx.fillStyle = '#c8102e'; ctx.fillRect(px, py, pw, 22); ctx.fillStyle = '#fff'; ctx.font = '700 13px Rubik, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(side ? 'SALE' : 'NEW', px + pw / 2, py + 11);
        ctx.fillStyle = '#111'; ctx.font = '900 20px Rubik, Arial, sans-serif'; ctx.fillText(side ? '50%' : 'IN', px + pw / 2, py + 42); ctx.fillText(side ? 'OFF' : 'STOCK', px + pw / 2, py + 64);
        ctx.fillStyle = '#555'; ctx.font = '600 8px Rubik, Arial, sans-serif'; ctx.fillText('IRONSIDE', px + pw / 2, py + 86);
      });
      // hours plate + push sticker + a cluster of small stickers low on the glass
      cover((ctx, e) => {
        const px = side ? ox + 60 : ox + 120, py = tr + 190;
        ctx.fillStyle = e ? '#000' : '#18191b'; ctx.fillRect(px, py, 76, 46);
        if (e) return;
        ctx.fillStyle = '#e8e4da'; ctx.font = '700 9px Rubik, Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ['MON-FRI 9-8', 'SAT 9-6', 'SUN 10-4'].forEach((l, k) => ctx.fillText(l, px + 6, py + 6 + k * 12));
      });
      cover((ctx, e) => { ctx.fillStyle = e ? '#000' : '#d9d4c8'; ctx.fillRect(side ? ox + 18 : ox + 208, tr + 150, 30, 12); if (!e) { ctx.fillStyle = '#222'; ctx.font = '700 9px Rubik, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(side ? 'PULL' : 'PUSH', side ? ox + 33 : ox + 223, tr + 156.5); } });
      for (let k = 0; k < 16; k++) { const sx = ox + 20 + R() * 216, sy = tr + 250 + R() * 60, ss = 0.8 + R() * 0.6, rs = Math.floor(R() * 1e6); cover((ctx, e) => { if (e) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(sx, sy, 15 * ss, 0, 7); ctx.fill(); } else this.sticker(ctx, HX.rng(rs), sx, sy, ss); }); }
      for (let k = 0; k < 5; k++) { const sx = ox + 30 + R() * 196, sy = tr + 30 + R() * 30, ss = 0.7 + R() * 0.4, rs = Math.floor(R() * 1e6); cover((ctx, e) => { if (e) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(sx, sy, 13 * ss, 0, 7); ctx.fill(); } else this.sticker(ctx, HX.rng(rs), sx, sy, ss); }); }
    }
    // transom: store name in cut vinyl
    cover((ctx, e) => { ctx.fillStyle = e ? '#000' : 'rgba(18,20,22,0.82)'; ctx.fillRect(0, 0, W, tr - 4); if (!e) { ctx.fillStyle = '#f4f1ea'; ctx.font = `400 40px ${this.SIGN_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; this.spacedText(ctx, 'IRONSIDE  ARMORY', W / 2, tr / 2, 6); } });
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeArmoryWindow(seed) { // a barred display window (7.2 x 2.55 m)
    const W = 512, H = 182, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H), R = HX.rng(seed), R2 = HX.rng(seed);
    this.paintArmoryInside(x, W, H, R, false); this.paintArmoryInside(xe, W, H, R2, true);
    // a vest on a mannequin, ammo-box shelf and a window poster
    x.fillStyle = '#2b3326'; this.rrect(x, 60, 40, 58, 74, 10); x.fill(); x.fillStyle = '#c8b28a'; x.beginPath(); x.arc(89, 30, 13, 0, 7); x.fill();
    xe.fillStyle = '#000'; this.rrect(xe, 60, 40, 58, 74, 10); xe.fill(); xe.beginPath(); xe.arc(89, 30, 13, 0, 7); xe.fill();
    for (let k = 0; k < 14; k++) { x.fillStyle = ['#2d5f8a', '#a8321f', '#c99a1c', '#3d7a3d', '#5a5a5a'][Math.floor(R() * 5)]; x.fillRect(180 + k * 22, 96, 18, 22); }
    const posterX = seed % 2 ? 360 : 330;
    for (const [ctx, e] of [[x, false], [xe, true]]) { ctx.fillStyle = e ? '#000' : '#ffd23f'; ctx.fillRect(posterX, 18, 110, 70); }
    x.fillStyle = '#111'; x.font = '900 26px Rubik, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(seed % 2 ? 'RANGE' : 'AMMO', posterX + 55, 40); x.font = '800 18px Rubik, Arial, sans-serif'; x.fillText(seed % 2 ? 'OPEN DAILY' : '-25% OFF', posterX + 55, 68);
    // sheen + security bars
    const sh = x.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(10,12,16,0.3)'); x.fillStyle = sh; x.fillRect(0, 0, W, H);
    for (const [ctx, e] of [[x, false], [xe, true]]) {
      ctx.fillStyle = e ? '#000' : '#1c1f22';
      for (let px = 10; px < W; px += 24) ctx.fillRect(px, 0, 4, H);
      for (const py of [6, H / 2 - 3, H - 12]) ctx.fillRect(0, py, W, 6);
      if (!e) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let px = 10; px < W; px += 24) ctx.fillRect(px + 1, 0, 1, H); }
    }
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeStucco(base, band) { // painted block wall, 4 m per repeat: faint block coursing + grime toward the ground
    const [c, x] = this.canvas(256, 256), R = HX.rng(base.length * 97 + 13);
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(0,0,0,0.05)';
    for (let r = 0; r < 10; r++) { x.fillRect(0, r * 25.6, 256, 1.5); for (let k = 0; k < 5; k++) x.fillRect(((k + (r % 2) * 0.5) * 51.2) % 256, r * 25.6, 1.5, 25.6); }
    for (let k = 0; k < 1400; k++) { const v = R(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${R() * 0.05})` : `rgba(255,255,255,${R() * 0.05})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3); }
    if (band) { const g = x.createLinearGradient(0, 200, 0, 256); g.addColorStop(0, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,0.18)'); x.fillStyle = g; x.fillRect(0, 200, 256, 56); }
    return this.texFrom(c, true);
  },
  makeShutterTex() {
    const [c, x] = this.canvas(64, 64);
    for (let y = 0; y < 64; y += 8) { const g = x.createLinearGradient(0, y, 0, y + 8); g.addColorStop(0, '#9aa0a6'); g.addColorStop(0.5, '#c4c9cd'); g.addColorStop(1, '#6d7378'); x.fillStyle = g; x.fillRect(0, y, 64, 8); }
    return this.texFrom(c, true);
  },
  makeShopFront(seed, tint) { // generic small-shop storefront glass with an interior
    const W = 256, H = 128, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H), R = HX.rng(seed);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tint); g.addColorStop(1, '#3a3430'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.fillRect(0, 0, W, H);
    xe.fillStyle = '#c9b89a'; xe.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) { const px = 8 + k * 28; x.fillStyle = ['#e9e4d8', '#bfc9cf', '#d6c49c'][k % 3]; x.fillRect(px, 40 + R() * 10, 20, 60); xe.fillStyle = '#5a5042'; xe.fillRect(px, 40, 20, 60); }
    const sh = x.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0.2)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = sh; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2b2b2b'; for (const px of [0, 84, 170, W - 4]) x.fillRect(px, 0, 4, H); xe.fillStyle = '#000'; for (const px of [0, 84, 170, W - 4]) xe.fillRect(px, 0, 4, H);
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeBoxSign(text, bg, fg, sub, aspect) { // small lit box sign for the neighbouring shops (canvas = the panel's aspect)
    const H = 96, W = Math.round(H * (aspect || 5.33) / 8) * 8, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H);
    x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 4; x.strokeRect(4, 4, W - 8, H - 8);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
    for (const [ctx, e] of [[x, false], [xe, true]]) {
      ctx.fillStyle = e ? fg : fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      this.fitText(ctx, text, W - 40 - 4 * text.length, sub ? 54 : 66, this.SIGN_FONT); this.spacedText(ctx, text, W / 2, sub ? 38 : H / 2 + 3, 4);
      if (sub) { ctx.font = '700 18px Rubik, Arial, sans-serif'; ctx.fillText(sub, W / 2, 76); }
    }
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeBayTex() { // the parking bay: asphalt + bay end marks + a painted 15 MIN
    const W = 512, H = 64, [c, x] = this.canvas(W, H); // 22 m x 2.4 m
    x.fillStyle = '#2b2b2f'; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 1600; k++) { const v = 30 + Math.random() * 40; x.fillStyle = `rgba(${v},${v},${v + 4},0.4)`; x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
    const m = W / 22; x.fillStyle = 'rgba(236,236,236,0.85)';
    for (const bx of [0, 7.33, 14.67, 22]) { x.fillRect(Math.min(W - 3, bx * m), 0, 3, H); }
    x.fillRect(0, 0, W, 3);
    x.font = '700 22px Rubik, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(236,236,236,0.7)';
    for (const bx of [3.67, 11, 18.33]) x.fillText('15 MIN', bx * m, H / 2 + 4);
    return this.texFrom(c);
  },

  /* ---------- OCEAN TRUST BANK textures ---------- */
  makeLimestone() { // ashlar courses: 0.6 m courses, 1.2 m blocks, 4.8 m per repeat
    const [c, x] = this.canvas(512, 512), R = HX.rng(4242);
    x.fillStyle = '#e3d7c0'; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
      const bx = k * 128 + (r % 2) * 64, by = r * 64, v = R();
      x.fillStyle = `rgba(${v < 0.5 ? '120,100,70' : '255,250,240'},${0.04 + R() * 0.07})`; x.fillRect(bx + 2, by + 2, 124, 60);
      for (let q = 0; q < 30; q++) { x.fillStyle = `rgba(90,75,55,${R() * 0.07})`; x.fillRect(bx + R() * 124, by + R() * 60, 1 + R() * 2, 1 + R() * 2); }
    }
    x.fillStyle = 'rgba(110,95,72,0.45)';
    for (let r = 0; r <= 8; r++) x.fillRect(0, r * 64 - 1, 512, 2.5);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) x.fillRect(k * 128 + (r % 2) * 64 - 1, r * 64, 2.5, 64);
    x.fillStyle = 'rgba(255,255,255,0.18)'; for (let r = 0; r < 8; r++) x.fillRect(0, r * 64 + 2, 512, 1);
    return this.texFrom(c, true);
  },
  makeFlutes() { // column fluting (u wraps around the shaft)
    const [c, x] = this.canvas(256, 16), n = 20;
    for (let k = 0; k < n; k++) { const g = x.createLinearGradient(k * 256 / n, 0, (k + 1) * 256 / n, 0); g.addColorStop(0, '#cdbfa6'); g.addColorStop(0.18, '#f1e8d6'); g.addColorStop(0.55, '#e8dcc6'); g.addColorStop(0.9, '#b9aa90'); g.addColorStop(1, '#d6c9b1'); x.fillStyle = g; x.fillRect(k * 256 / n, 0, 256 / n, 16); }
    const t = this.texFrom(c, true); return t;
  },
  makeFrieze(text, W, H) { // stone band with incised gold capitals
    const [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H);
    x.fillStyle = '#ddd0b8'; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 2000; k++) { x.fillStyle = `rgba(100,85,60,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    x.fillStyle = 'rgba(90,75,55,0.35)'; x.fillRect(0, 0, W, 3); x.fillRect(0, H - 3, W, 3);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
    const px = Math.round(H * 0.7), sp = H * 0.3, F = this.SERIF_FONT;
    for (const ctx of [x, xe]) { ctx.font = `700 ${px}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
    x.fillStyle = 'rgba(40,28,12,0.85)'; this.spacedText(x, text, W / 2 + 3, H / 2 + 4, sp);   // cut shadow
    const gg = x.createLinearGradient(0, H * 0.18, 0, H * 0.82); gg.addColorStop(0, '#f6d77e'); gg.addColorStop(0.5, '#b8862c'); gg.addColorStop(1, '#6e4b12');
    x.fillStyle = gg; this.spacedText(x, text, W / 2, H / 2, sp);
    xe.fillStyle = '#ffcf6a'; this.spacedText(xe, text, W / 2, H / 2, sp);
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeTympanum() { // pediment field: a gilt medallion (sun over three waves) between laurel sprays
    const W = 512, H = 80, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H);
    x.fillStyle = '#d6c8ae'; x.fillRect(0, 0, W, H); xe.fillStyle = '#4a3a26'; xe.fillRect(0, 0, W, H); // (dim warm base: floodlit stone at night)
    const cx = W / 2, cy = H * 0.58, r = H * 0.33;
    for (const [ctx, e] of [[x, false], [xe, true]]) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = e ? '#3a2c10' : '#c99a3a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = e ? '#ffcf6a' : '#8c6216'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy - 2, r * 0.38, Math.PI, 0); ctx.fillStyle = e ? '#ffcf6a' : '#fff1b8'; ctx.fill();
      ctx.strokeStyle = e ? '#ffcf6a' : '#fff1b8'; ctx.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let q = 0; q <= 20; q++) { const px = cx - r * 0.7 + q * r * 0.07, py = cy + 4 + k * 5 + Math.sin(q * 0.9) * 2; q ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
      if (!e) for (const s of [-1, 1]) for (let k = 0; k < 9; k++) { ctx.fillStyle = '#b8a07a'; ctx.save(); ctx.translate(cx + s * (r + 12 + k * 13), cy + 6 - k * 1.2); ctx.rotate(s * 0.5); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.restore();
    }
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeBronzeDoors() { // double bronze doors with raised panels and pulls (3.6 x 5.2 m)
    const W = 256, H = 370, [c, x] = this.canvas(W, H);
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#4a3216'); g.addColorStop(0.3, '#7a5628'); g.addColorStop(0.5, '#5a3e1c'); g.addColorStop(0.7, '#805f30'); g.addColorStop(1, '#4a3216');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const ox of [0, 128]) {
      for (const [py, ph] of [[14, 120], [146, 70], [228, 128]]) {
        x.fillStyle = 'rgba(30,18,6,0.55)'; x.fillRect(ox + 14, py, 100, ph);
        const pg = x.createLinearGradient(ox + 18, py, ox + 110, py + ph); pg.addColorStop(0, '#b08848'); pg.addColorStop(0.5, '#7a5526'); pg.addColorStop(1, '#5e4019'); x.fillStyle = pg; x.fillRect(ox + 18, py + 4, 92, ph - 8);
        x.strokeStyle = 'rgba(255,225,160,0.35)'; x.lineWidth = 1.5; x.strokeRect(ox + 24, py + 10, 80, ph - 20);
      }
      x.fillStyle = '#d9b46a'; for (let k = 0; k < 6; k++) for (const py of [8, H - 8]) { x.beginPath(); x.arc(ox + 18 + k * 18, py, 2.4, 0, 7); x.fill(); }
    }
    x.fillStyle = '#2a1a08'; x.fillRect(126, 0, 4, H);
    x.fillStyle = '#e6c27a'; x.fillRect(112, 150, 7, 70); x.fillRect(137, 150, 7, 70);
    const t = this.texFrom(c); return t;
  },
  makeBankWindow(seed) { // tall window: dark glass, cream mullions, warm lights inside
    const W = 128, H = 320, [c, x] = this.canvas(W, H), [ce, xe] = this.canvas(W, H), R = HX.rng(seed);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a3340'); g.addColorStop(1, '#141a22'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
    const lit = R() < 0.8;
    if (lit) { const eg = xe.createRadialGradient(W / 2, H * 0.35, 4, W / 2, H * 0.35, H * 0.6); eg.addColorStop(0, '#ffd9a0'); eg.addColorStop(1, '#6a4a22'); xe.fillStyle = eg; xe.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,214,150,0.25)'; x.fillRect(0, 0, W, H); }
    const sh = x.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0.15)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.fillRect(0, 0, W, H);
    for (const [ctx, e] of [[x, false], [xe, true]]) {
      ctx.fillStyle = e ? '#000' : '#e9dfcb';
      ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8); ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
      ctx.fillRect(W / 2 - 3, 0, 6, H); for (let k = 1; k < 6; k++) ctx.fillRect(0, k * H / 6 - 2, W, 4);
      if (!e) { ctx.fillStyle = '#20252c'; for (let k = 0; k < 7; k++) ctx.fillRect(14 + k * 16, H * 0.68, 2.5, H * 0.3); ctx.fillRect(8, H * 0.68, W - 16, 3); }
    }
    return { map: this.texFrom(c), emis: this.texFrom(ce) };
  },
  makeCrownSign() { // additive (black = transparent) wordmark for the HQ tower
    const [c, x] = this.canvas(1024, 192);
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 192);
    x.font = `400 130px ${this.SIGN_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [blur, col] of [[28, '#2fd6c8'], [10, '#8ff5ea']]) { x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; this.spacedText(x, 'OCEAN TRUST', 560, 100, 10); }
    x.shadowBlur = 0; x.fillStyle = '#f2fffd'; this.spacedText(x, 'OCEAN TRUST', 560, 100, 10);
    x.strokeStyle = '#8ff5ea'; x.lineWidth = 7; x.shadowColor = '#2fd6c8'; x.shadowBlur = 14;
    for (let k = 0; k < 3; k++) { x.beginPath(); for (let q = 0; q <= 24; q++) { const px = 50 + q * 5.5, py = 70 + k * 26 + Math.sin(q * 0.55) * 8; q ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  },

  /* ---------- small builders ---------- */
  stdMat(o) { const m = new this.T.MeshStandardMaterial(o); return m; },
  plane(w, h, mat, x, y, z, ry, parent) { const m = new this.T.Mesh(new this.T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || this.scene).add(m); return m; },
  // static props merged per material (one draw call each): box(x0,y0,z0,x1,y1,z1,mat), geo(geometry, mat, matrix), flush()
  batcher(parent) {
    const T = this.T, self = this, groups = new Map(), m4 = new T.Matrix4(), glow = new Set();
    const get = (mat) => { let b = groups.get(mat); if (!b) groups.set(mat, b = { p: [], n: [], u: [], i: [] }); return b; };
    return {
      m4,
      box(x0, y0, z0, x1, y1, z1, mat) { const geo = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); self.mergeInto(get(mat), geo, m4.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); geo.dispose(); },
      geo(geo, mat, matrix) { self.mergeInto(get(mat), geo, matrix); },
      glow(mat) { glow.add(mat); },   // these materials also show up in the wet-street reflections (layer 1)
      flush() {
        for (const [mat, b] of groups) {
          const bg = new T.BufferGeometry();
          bg.setAttribute('position', new T.Float32BufferAttribute(b.p, 3)); bg.setAttribute('normal', new T.Float32BufferAttribute(b.n, 3)); bg.setAttribute('uv', new T.Float32BufferAttribute(b.u, 2));
          bg.computeBoundingSphere();
          const mesh = new T.Mesh(bg, mat); parent.add(mesh); if (glow.has(mat)) mesh.layers.enable(1);
        }
        groups.clear();
      },
    };
  },

  /* ---------- IRONSIDE ARMORY: single-storey gun store on a little shopping strip ---------- */
  buildGunStore() {
    const T = this.T, X = HX.L(HX.GUNSTORE_BLOCK[0]), Z = HX.L(HX.GUNSTORE_BLOCK[1]);
    const g = new T.Group(); g.name = 'ironside'; this.scene.add(g);
    const B = this.batcher(g), m4 = B.m4; this.mats.stripSigns = []; this.mats.lantern = null; this.mats.bankSteel = null;
    const FZ = Z + 16.4;                       // the shop fronts (facing north, -z)
    const sx0 = X + 24, sx1 = X + 48, sz1 = Z + 36, sh = 5.55;   // the store body
    const tex = { wall: this.makeStucco('#cfc5b3', true), teal: this.makeStucco('#9fc9c0', true), pink: this.makeStucco('#e5b9ae', true), shutter: this.makeShutterTex() };
    const wallM = this.stdMat({ map: tex.wall, roughness: 0.92 });
    const tealM = this.stdMat({ map: tex.teal, roughness: 0.92 }), pinkM = this.stdMat({ map: tex.pink, roughness: 0.92 });
    const green = this.stdMat({ color: 0x3d6b4c, roughness: 0.45, metalness: 0.35, envMap: this.envMap, envMapIntensity: 0.5 });
    const steel = this.stdMat({ color: 0x2b2f34, roughness: 0.55, metalness: 0.5, envMap: this.envMap, envMapIntensity: 0.4 });
    const chrome = this.stdMat({ color: 0xc9ced4, roughness: 0.25, metalness: 0.9, envMap: this.envMap, envMapIntensity: 0.9 });
    const shutM = this.stdMat({ map: tex.shutter, roughness: 0.5, metalness: 0.4 });
    const capM = this.stdMat({ color: 0x5b5f63, roughness: 0.8 });
    // --- body + false front (merged, world-space UVs, 4 m per texture repeat) ---
    const wb = this.GB();
    wb.box(sx0, 0.15, FZ, sx1, sh, sz1, 4, 4, null, 0, true);
    wb.box(X + 27, sh, FZ, X + 45, 7.6, FZ + 0.6, 4, 4, null, 0, true);    // false front that carries the sign
    const body = new T.Mesh(wb.geo(), wallM); g.add(body);
    const rb = this.GB(); rb.top(sx0, FZ, sx1, sz1, sh, 4, 4); rb.top(X + 27, FZ, X + 45, FZ + 0.6, 7.6, 4, 4);
    g.add(new T.Mesh(rb.geo(), this.mats.roof || (this.mats.roof = this.stdMat({ color: 0x2a2630, roughness: 0.9 }))));
    // parapet caps + a dark green plinth band + a green fascia under the sign
    B.box(sx0 - 0.08, sh, FZ - 0.08, sx1 + 0.08, sh + 0.22, sz1 + 0.08, capM);
    B.box(X + 26.9, 7.6, FZ - 0.08, X + 45.1, 7.8, FZ + 0.68, capM);
    B.box(sx0 - 0.04, 0.15, FZ - 0.05, sx1 + 0.04, 0.75, FZ + 0.01, green);
    B.box(sx0 - 0.04, 4.22, FZ - 0.07, sx1 + 0.04, 4.42, FZ + 0.01, green);
    HX.addBox(sx0, FZ, sx1, sz1, 7.8, 'building');
    // --- glass: doors + two barred display windows ---
    const D = this.makeArmoryDoors(), W1 = this.makeArmoryWindow(7), W2 = this.makeArmoryWindow(8);
    const glassMat = (t) => this.stdMat({ map: t.map, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.12, metalness: 0.2, envMap: this.envMap, envMapIntensity: 0.9 });
    const dm = glassMat(D), w1m = glassMat(W1), w2m = glassMat(W2); this.mats.armoryGlass = [dm, w1m, w2m];
    const doorX = X + 36, gz = FZ - 0.015;
    this.plane(4.6, 3.45, dm, doorX, 0.15 + 3.45 / 2, gz, Math.PI, g);
    this.plane(7.2, 2.55, w1m, X + 28.8, 0.85 + 1.275, gz, Math.PI, g);
    this.plane(7.2, 2.55, w2m, X + 43.2, 0.85 + 1.275, gz, Math.PI, g);
    // green door frames (stiles, rails, transom bar, kick plates) + chrome push bars
    const fz0 = FZ - 0.16, fz1 = FZ - 0.01;
    const fr = (a0, y0, a1, y1, m) => B.box(X + a0, y0, fz0, X + a1, y1, fz1, m || green);
    fr(33.58, 0.15, 33.78, 3.72); fr(38.22, 0.15, 38.42, 3.72); fr(35.92, 0.15, 36.08, 3.06); fr(33.58, 3.6, 38.42, 3.75); fr(33.58, 3.02, 38.42, 3.12);
    fr(33.7, 0.15, 35.95, 0.42); fr(36.05, 0.15, 38.3, 0.42);
    for (const [a0, a1] of [[34.1, 35.6], [36.4, 37.9]]) B.box(X + a0, 1.0, fz0 - 0.1, X + a1, 1.07, fz0 - 0.02, chrome);
    for (const cx of [28.8, 43.2]) { // window frames: sill, head, jambs, two mullions
      fr(cx - 3.68, 0.72, cx + 3.68, 0.86); fr(cx - 3.68, 3.38, cx + 3.68, 3.5); fr(cx - 3.68, 0.72, cx - 3.52, 3.5); fr(cx + 3.52, 0.72, cx + 3.68, 3.5);
      fr(cx - 1.27, 0.86, cx - 1.17, 3.38); fr(cx + 1.17, 0.86, cx + 1.27, 3.38);
      B.box(X + cx - 3.7, 0.72, fz0 - 0.18, X + cx + 3.7, 0.8, fz0, capM); // deep sill
    }
    // roller shutters: housings over every opening, the window shutters pulled a third of the way down
    for (const [cx, w] of [[28.8, 7.6], [43.2, 7.6], [36, 5.2]]) B.box(X + cx - w / 2, 3.78, FZ - 0.48, X + cx + w / 2, 4.2, FZ, steel);
    for (const cx of [28.8, 43.2]) { B.box(X + cx - 3.6, 2.6, FZ - 0.4, X + cx + 3.6, 3.78, FZ - 0.34, shutM); B.box(X + cx - 3.62, 2.52, FZ - 0.42, X + cx + 3.62, 2.62, FZ - 0.32, steel); }
    // awning over the doors (cantilevered on two tie rods)
    B.box(X + 32.6, 4.24, FZ - 1.9, X + 39.4, 4.4, FZ, steel);
    for (const ax of [33, 39]) B.geo(new T.BoxGeometry(0.06, 0.06, 1.95), chrome, m4.makeRotationX(-0.5).setPosition(X + ax, 4.85, FZ - 0.85));
    // --- the big sign: gunmetal panel with lit letters, four gooseneck lamps above ---
    const S = this.makeArmorySign();
    const signM = this.mats.armorySign = this.stdMat({ map: S.map, emissiveMap: S.emis, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.45, metalness: 0.4, envMap: this.envMap, envMapIntensity: 0.6 });
    B.box(X + 27.1, 4.5, FZ - 0.3, X + 44.9, 7.45, FZ, steel);
    const sign = this.plane(17.6, 2.9, signM, doorX, 5.975, FZ - 0.305, Math.PI, g); sign.layers.enable(1);
    const lampGlows = [];
    for (const lx of [29.5, 33.8, 38.2, 42.5]) {
      B.box(X + lx - 0.04, 7.55, FZ - 0.9, X + lx + 0.04, 7.62, FZ + 0.1, steel);
      B.geo(new T.ConeGeometry(0.22, 0.26, 10, 1, true), steel, m4.makeRotationX(-0.6).setPosition(X + lx, 7.5, FZ - 0.95));
      lampGlows.push([X + lx, 7.38, FZ - 1.05, '#ffd9a0']);
    }
    this.addGlows(lampGlows, 2.2, 0.9);
    // red OPEN neon in the east window + warm light spilling onto the forecourt
    const [oc, ox] = this.canvas(128, 48); ox.fillStyle = '#000'; ox.fillRect(0, 0, 128, 48); ox.font = '800 34px Rubik, Arial, sans-serif'; ox.textAlign = 'center'; ox.textBaseline = 'middle'; ox.shadowColor = '#ff2d55'; ox.shadowBlur = 10; ox.fillStyle = '#ff5a78'; ox.fillText('OPEN', 64, 26); ox.strokeStyle = '#ff2d55'; ox.lineWidth = 3; ox.strokeRect(6, 4, 116, 40);
    const openTex = new T.CanvasTexture(oc); openTex.encoding = T.sRGBEncoding;
    const openM = this.mats.armoryOpen = new T.MeshBasicMaterial({ map: openTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const open = this.plane(1.3, 0.5, openM, X + 45, 2.35, FZ - 0.05, Math.PI, g); open.layers.enable(1);
    const spill = new T.Mesh(new T.PlaneGeometry(9, 4.2), this.mats.armorySpill = new T.MeshBasicMaterial({ map: this.tex.glow, color: 0xffd8a8, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(doorX, 0.17, FZ - 2); g.add(spill);
    // rooftop: AC units + vent stacks
    const acM = this.stdMat({ color: 0x9aa0a4, roughness: 0.6, metalness: 0.3 });
    for (const [ax, az, w, d] of [[29, 24, 2.4, 1.6], [41, 28, 2.4, 1.6], [34, 31, 1.4, 1.4]]) B.box(X + ax, sh, Z + az, X + ax + w, sh + 1.1, Z + az + d, acM);
    // anti-ram bollards (yellow) along the forecourt
    const bol = new T.CylinderGeometry(0.13, 0.13, 0.95, 10); const bolM = this.stdMat({ color: 0xe8b81c, roughness: 0.5 });
    for (const bxx of [26.5, 29.6, 42.4, 45.5]) { B.geo(bol, bolM, m4.makeTranslation(X + bxx, 0.15 + 0.475, Z + 13.1)); HX.addCircle(X + bxx, Z + 13.1, 0.15, 'post', null); }
    // --- the neighbours: a coin laundry (west) and a liquor & deli (east), single storey ---
    const shop = (x0, x1, mat, signT, frontT, seed) => {
      const sb = this.GB(); sb.box(X + x0, 0.15, FZ, X + x1, 4.4, Z + 32, 4, 4, null, seed, true); g.add(new T.Mesh(sb.geo(), mat));
      const tb = this.GB(); tb.top(X + x0, FZ, X + x1, Z + 32, 4.4, 4, 4); g.add(new T.Mesh(tb.geo(), this.mats.roof));
      B.box(X + x0 - 0.06, 4.4, FZ - 0.06, X + x1 + 0.06, 4.6, Z + 32.06, capM);
      HX.addBox(X + x0, FZ, X + x1, Z + 32, 4.6, 'building');
      const w = x1 - x0, fm = this.stdMat({ map: frontT.map, emissiveMap: frontT.emis, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.2, envMap: this.envMap, envMapIntensity: 0.8 });
      this.mats.armoryGlass.push(fm);
      this.plane(w - 1.4, 2.6, fm, X + (x0 + x1) / 2, 0.75 + 1.3, FZ - 0.015, Math.PI, g);
      const sm = this.stdMat({ map: signT.map, emissiveMap: signT.emis, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.5 }); (this.mats.stripSigns = this.mats.stripSigns || []).push(sm);
      B.box(X + x0 + 0.6, 3.45, FZ - 0.28, X + x1 - 0.6, 4.3, FZ, steel);
      const s = this.plane(w - 1.4, 0.8, sm, X + (x0 + x1) / 2, 3.875, FZ - 0.29, Math.PI, g); s.layers.enable(1);
      B.box(X + x0 - 0.02, 0.15, FZ - 0.05, X + x1 + 0.02, 0.75, FZ + 0.01, capM);
    };
    shop(11.5, 22.5, tealM, this.makeBoxSign('COIN LAUNDRY', '#1d5a8c', '#f2fbff', 'WASH · DRY · FOLD', 9.6 / 0.8), this.makeShopFront(5, '#cfe6f0'), 1);
    shop(49.5, 59, pinkM, this.makeBoxSign('LIQUOR & DELI', '#a3192b', '#ffe9a8', 'COLD BEER · SANDWICHES', 8.1 / 0.8), this.makeShopFront(9, '#f0dcc0'), 2);
    // --- the recessed parking bay in front of the store (road level, lines + "15 MIN") ---
    const bay = new T.Mesh(new T.PlaneGeometry(22, 2.4), this.stdMat({ map: this.makeBayTex(), roughness: 0.75 }));
    bay.rotation.set(-Math.PI / 2, 0, Math.PI); bay.position.set(X + 36, 0.022, Z + 8.2); g.add(bay);
    HX.addGround(X + 25, Z + 7, X + 47, Z + 9.4, 0, 0, 'x');
    // a 'NO PARKING / LOADING 15 MIN' pole sign at each end of the bay
    const [pc, px] = this.canvas(64, 96); px.fillStyle = '#f4f4f0'; px.fillRect(0, 0, 64, 96); px.strokeStyle = '#1b4d8f'; px.lineWidth = 4; px.strokeRect(3, 3, 58, 90); px.fillStyle = '#1b4d8f'; px.font = '900 40px Rubik, Arial, sans-serif'; px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText('P', 32, 32); px.font = '800 13px Rubik, Arial, sans-serif'; px.fillText('15 MIN', 32, 66); px.fillText('7AM-7PM', 32, 82);
    const psM = this.stdMat({ map: this.texFrom(pc), roughness: 0.6, side: T.DoubleSide });
    for (const ppx of [25.4, 46.6]) { B.box(X + ppx - 0.04, 0.15, Z + 9.7, X + ppx + 0.04, 2.6, Z + 9.78, steel); this.plane(0.42, 0.63, psM, X + ppx, 2.25, Z + 9.65, Math.PI, g); HX.addCircle(X + ppx, Z + 9.74, 0.08, 'post', null); }
    this.todHooks.push((pal) => {
      signM.emissiveIntensity = 0.3 + 1.9 * pal.neon;
      for (const m of this.mats.armoryGlass) m.emissiveIntensity = 0.32 + 0.9 * pal.win;
      for (const m of this.mats.stripSigns) m.emissiveIntensity = 0.25 + 1.5 * pal.neon;
      openM.color.setScalar(0.4 + 2.2 * pal.neon); this.mats.armorySpill.opacity = 0.42 * Math.max(pal.lamps, pal.win);
    });
    B.flush();
    // fix the lots of this block for the helicopter's roof check (heights of what really stands here)
    for (const l of this.lots) if (l.crew === 'gunstore') l.h = 17.5;
    this.gunStore = {
      name: 'IRONSIDE ARMORY',
      door: { x: doorX, z: +(FZ - 1.1).toFixed(2) },   // just outside the glass doors
      front: { x: doorX, z: +(Z + 11.6).toFixed(2) },  // on the sidewalk between the bay and the doors
      park: { x: X + 37, z: Z + 8.1, h: Math.PI / 2 }, // in the bay, nose east (toward the x = 70 avenue and the bank)
      bay: { x0: X + 25, z0: Z + 7, x1: X + 47, z1: Z + 9.4 },
    };
  },

  /* ---------- OCEAN TRUST BANK: a neoclassical banking hall in front of its glass HQ tower ---------- */
  buildBank() {
    const T = this.T, X = HX.L(HX.BANK_BLOCK[0]), Z = HX.L(HX.BANK_BLOCK[1]);
    const g = new T.Group(); g.name = 'oceantrust'; this.scene.add(g);
    const B = this.batcher(g), m4 = B.m4;
    const hx0 = X + 24, hx1 = X + 49.6, hz0 = Z + 19, hz1 = Z + 51;       // the hall (portico on the east, +x)
    const F0 = 1.65;                                                       // podium / floor level
    const stoneT = this.makeLimestone();
    const stone = this.mats.bankStone = this.stdMat({ map: stoneT, roughness: 0.85, emissive: 0xffd9a8, emissiveMap: stoneT, emissiveIntensity: 0 });
    const stoneD = this.mats.bankStoneD = this.stdMat({ map: stoneT, color: 0xc9bca4, roughness: 0.9, emissive: 0xffd9a8, emissiveMap: stoneT, emissiveIntensity: 0 });
    const plain = this.mats.bankPlain = this.stdMat({ color: 0xe6dac4, roughness: 0.8, emissive: 0xffd9a8, emissiveIntensity: 0 });
    const roofM = this.stdMat({ color: 0x6f7a72, roughness: 0.7, metalness: 0.2 });
    const bronze = this.stdMat({ color: 0x8a6430, roughness: 0.35, metalness: 0.85, envMap: this.envMap, envMapIntensity: 0.8 });
    // --- podium, walls, entablature, attic (merged stone) ---
    const sb = this.GB(), db = this.GB(), pb = this.GB();
    db.box(hx0 - 0.3, 0.15, hz0 - 0.3, hx1, F0, hz1 + 0.3, 4.8, 4.8);                      // rusticated base
    sb.box(hx0, F0, hz0, hx1, 12.6, hz1, 4.8, 4.8, null, 0, true);                         // walls
    pb.box(hx0 - 0.2, 12.6, hz0 - 0.2, hx1 + 0.1, 13.5, hz1 + 0.2, 1, 1);                   // architrave
    pb.box(hx0 - 0.1, 13.5, hz0 - 0.1, hx1 + 0.05, 14.35, hz1 + 0.1, 1, 1);                 // frieze
    pb.box(hx0 - 0.7, 14.35, hz0 - 0.7, hx1 + 0.4, 14.85, hz1 + 0.7, 1, 1);                 // cornice
    sb.box(hx0 + 1, 14.85, hz0 + 1, hx1 - 1, 16.6, hz1 - 1, 4.8, 4.8);                      // attic
    pb.box(hx0 + 0.8, 16.6, hz0 + 0.8, hx1 - 0.8, 16.85, hz1 - 0.8, 1, 1);
    // pilasters on the north, south and west walls; podium string course
    for (let k = 0; k <= 6; k++) { const px = hx0 + 1.2 + k * ((hx1 - hx0 - 2.4) / 6); for (const [z0, z1] of [[hz0 - 0.35, hz0], [hz1, hz1 + 0.35]]) pb.box(px - 0.4, F0, z0, px + 0.4, 12.6, z1, 1, 1); }
    for (let k = 0; k <= 7; k++) { const pz = hz0 + 1.2 + k * ((hz1 - hz0 - 2.4) / 7); pb.box(hx0 - 0.35, F0, pz - 0.4, hx0, 12.6, pz + 0.4, 1, 1); }
    pb.box(hx0 - 0.4, F0, hz0 - 0.4, hx1, F0 + 0.3, hz1 + 0.4, 1, 1);
    g.add(new T.Mesh(sb.geo(), stone)); g.add(new T.Mesh(db.geo(), stoneD)); g.add(new T.Mesh(pb.geo(), plain));
    const rf = this.GB(); rf.top(hx0 + 1, hz0 + 1, hx1 - 1, hz1 - 1, 16.86, 4, 4); g.add(new T.Mesh(rf.geo(), roofM));
    HX.addBox(hx0 - 0.4, hz0 - 0.4, hx1, hz1 + 0.4, 17, 'bank');
    // --- tall windows between the pilasters (north / south / west) ---
    const winTex = [this.makeBankWindow(3), this.makeBankWindow(5)];
    const winM = winTex.map(w => this.stdMat({ map: w.map, emissiveMap: w.emis, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3, envMap: this.envMap, envMapIntensity: 0.8 }));
    this.mats.bankWin = winM;
    const sill = (x0, z0, x1, z1) => B.box(x0, 3.0, z0, x1, 3.18, z1, plain);
    for (let k = 0; k < 6; k++) {
      const px = hx0 + 1.2 + (k + 0.5) * ((hx1 - hx0 - 2.4) / 6);
      this.plane(2.0, 6.6, winM[k % 2], px, 6.6, hz0 - 0.02, Math.PI, g); this.plane(2.0, 6.6, winM[(k + 1) % 2], px, 6.6, hz1 + 0.02, 0, g);
      sill(px - 1.25, hz0 - 0.3, px + 1.25, hz0); sill(px - 1.25, hz1, px + 1.25, hz1 + 0.3);
      B.box(px - 1.3, 9.9, hz0 - 0.32, px + 1.3, 10.3, hz0, plain); B.box(px - 1.3, 9.9, hz1, px + 1.3, 10.3, hz1 + 0.32, plain); // window heads
    }
    for (let k = 0; k < 7; k++) { const pz = hz0 + 1.2 + (k + 0.5) * ((hz1 - hz0 - 2.4) / 7); this.plane(2.0, 6.6, winM[k % 2], hx0 - 0.02, 6.6, pz, -Math.PI / 2, g); }
    // --- the portico: stylobate, six columns, entablature with the gilt name, pediment ---
    const cz = (hz0 + hz1) / 2, px0 = hx1, px1 = X + 55.4;
    const pt = this.GB(); pt.box(px0, 0.15, cz - 13.5, px1, F0, cz + 13.5, 4.8, 4.8); g.add(new T.Mesh(pt.geo(), stoneD));
    const ptop = this.GB(); ptop.top(px0, cz - 13.5, px1, cz + 13.5, F0, 2.4, 2.4); g.add(new T.Mesh(ptop.geo(), plain));
    const flutes = this.makeFlutes(); flutes.repeat.set(1, 1);
    const colM = this.mats.bankCol = this.stdMat({ map: flutes, roughness: 0.75, emissive: 0xffd9a8, emissiveMap: flutes, emissiveIntensity: 0 });
    const shaftG = new T.CylinderGeometry(0.52, 0.6, 9.85, 24, 1, true), capG = new T.CylinderGeometry(0.78, 0.54, 0.5, 24), torG = new T.CylinderGeometry(0.72, 0.76, 0.32, 24);
    const colX = X + 53.4;
    for (let k = 0; k < 6; k++) {
      const z = cz - 11 + k * 4.4;
      B.geo(shaftG, colM, m4.makeTranslation(colX, F0 + 0.32 + 4.925, z));
      B.geo(torG, plain, m4.makeTranslation(colX, F0 + 0.16, z));
      B.box(colX - 0.8, F0, z - 0.8, colX + 0.8, F0 + 0.12, z + 0.8, plain);
      B.geo(capG, plain, m4.makeTranslation(colX, F0 + 0.32 + 9.85 + 0.25, z));
      B.box(colX - 0.85, 12.42, z - 0.85, colX + 0.85, 12.6, z + 0.85, plain);
      HX.addCircle(colX, z, 0.62, 'column', null);
    }
    const eb = this.GB();
    eb.box(px0, 12.6, cz - 14.1, X + 55.8, 13.05, cz + 14.1, 1, 1); eb.box(px0, 13.05, cz - 14.0, X + 55.7, 14.35, cz + 14.0, 1, 1); eb.box(px0 - 0.4, 14.35, cz - 14.6, X + 56.3, 14.85, cz + 14.6, 1, 1);
    g.add(new T.Mesh(eb.geo(), plain));
    // the portico ceiling: shaded stone that still catches light bounced off the steps (never a black hole)
    const soffit = this.mats.bankSoffit = this.stdMat({ color: 0xd9ccb4, roughness: 0.9, emissive: 0x5a4c3c, emissiveIntensity: 1 });
    const sf = this.GB(); sf.top(px0, cz - 14.1, X + 55.8, cz + 14.1, 12.6, 1, 1, null, -1); g.add(new T.Mesh(sf.geo(), soffit));
    const FR = this.makeFrieze('OCEAN TRUST BANK', 2048, 96);
    const frM = this.mats.bankFrieze = this.stdMat({ map: FR.map, emissiveMap: FR.emis, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.3 });
    const fr = this.plane(27.6, 1.28, frM, X + 55.72, 13.7, cz, Math.PI / 2, g); fr.layers.enable(1);
    // pediment: triangular gable (tympanum + raking cornices + roof slopes)
    const pedH = 4.4, pw = 14.6, pg = new T.BufferGeometry(), xf = X + 55.6, xb = px0 - 0.4, y0 = 14.85;
    pg.setAttribute('position', new T.Float32BufferAttribute([
      xf, y0, cz + pw, xf, y0, cz - pw, xf, y0 + pedH, cz,                                     // front face (tympanum)
      xb, y0, cz - pw, xb, y0, cz + pw, xb, y0 + pedH, cz,                                     // back face
    ], 3));
    pg.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1], 2)); pg.computeVertexNormals();
    const TY = this.makeTympanum();
    const tyM = this.mats.bankTym = this.stdMat({ map: TY.map, emissiveMap: TY.emis, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.8 });
    g.add(new T.Mesh(pg, tyM));
    const slopeL = Math.hypot(pw, pedH), ang = Math.atan2(pedH, pw);
    for (const s of [-1, 1]) {
      // raking cornice (stone, proud of the tympanum) and the roof slope behind it
      B.geo(new T.BoxGeometry(1.0, 0.55, slopeL + 0.6), plain, m4.makeRotationX(s * ang).setPosition(X + 55.9, y0 + pedH / 2 + 0.22, cz + s * pw / 2));
      B.geo(new T.BoxGeometry(xf - xb, 0.3, slopeL + 0.4), roofM, m4.makeRotationX(s * ang).setPosition((xf + xb) / 2 - 0.3, y0 + pedH / 2 + 0.2, cz + s * pw / 2));
    }
    // --- the bronze doors (with a stone surround and a lit transom) ---
    const doorM = this.stdMat({ map: this.makeBronzeDoors(), roughness: 0.38, metalness: 0.8, envMap: this.envMap, envMapIntensity: 0.9 });
    this.plane(3.6, 5.2, doorM, hx1 + 0.03, F0 + 2.6, cz, Math.PI / 2, g);
    const trM = this.mats.bankTransom = this.stdMat({ map: winTex[0].map, emissiveMap: winTex[0].emis, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 });
    this.plane(3.6, 1.3, trM, hx1 + 0.03, F0 + 5.95, cz, Math.PI / 2, g);
    B.box(hx1, F0, cz - 2.35, hx1 + 0.45, F0 + 6.9, cz - 1.8, plain); B.box(hx1, F0, cz + 1.8, hx1 + 0.45, F0 + 6.9, cz + 2.35, plain);
    B.box(hx1, F0 + 6.6, cz - 2.6, hx1 + 0.65, F0 + 7.2, cz + 2.6, plain);
    B.box(hx1 + 0.02, F0 + 5.25, cz - 1.82, hx1 + 0.2, F0 + 5.35, cz + 1.82, bronze);
    for (const s of [-1, 1]) { this.plane(2.0, 5.6, winM[0], hx1 + 0.03, F0 + 4.2, cz + s * 4.4, Math.PI / 2, g); this.plane(2.0, 5.6, winM[1], hx1 + 0.03, F0 + 4.2, cz + s * 8.8, Math.PI / 2, g); }
    // --- the steps (walkable: the ground rises from the sidewalk to the portico) + cheek blocks with lanterns ---
    const st = this.GB(), stepN = 7, sx0 = px1, sx1 = X + 58.9;
    for (let k = 0; k < stepN; k++) st.box(sx0, 0.15, cz - 12, sx1 - k * (sx1 - sx0) / stepN, 0.15 + (k + 1) * (F0 - 0.15) / (stepN + 1), cz + 12, 2.4, 2.4); // a stack: highest = shortest
    g.add(new T.Mesh(st.geo(), stoneD));
    HX.addGround(px0 - 0.5, cz - 13.5, px1, cz + 13.5, F0, F0, 'x');           // portico floor
    HX.addGround(sx0, cz - 12, sx1, cz + 12, F0, 0.15, 'x');                    // the steps
    const lanterns = [];
    for (const s of [-1, 1]) {
      const z0 = s < 0 ? cz - 13.5 : cz + 12, z1 = s < 0 ? cz - 12 : cz + 13.5;
      const cb = this.GB(); cb.box(px1, 0.15, z0, sx1 + 0.2, 2.2, z1, 2.4, 2.4); g.add(new T.Mesh(cb.geo(), stoneD));
      B.box(px1 - 0.05, 2.2, z0 - 0.05, sx1 + 0.25, 2.35, z1 + 0.05, plain);
      HX.addBox(px1, z0, sx1 + 0.2, z1, 2.35, 'wall');
      const lz = (z0 + z1) / 2, lx = sx1 - 0.6;
      B.box(lx - 0.12, 2.35, lz - 0.12, lx + 0.12, 3.5, lz + 0.12, bronze);
      B.box(lx - 0.22, 3.55, lz - 0.22, lx + 0.22, 4.2, lz + 0.22, this.mats.lantern || (this.mats.lantern = new T.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }))); B.glow(this.mats.lantern);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(lx + ox * 0.25 - 0.04, 3.5, lz + oz * 0.25 - 0.04, lx + ox * 0.25 + 0.04, 4.25, lz + oz * 0.25 + 0.04, bronze);
      B.box(lx - 0.3, 3.45, lz - 0.3, lx + 0.3, 3.55, lz + 0.3, bronze);
      B.geo(new T.ConeGeometry(0.42, 0.35, 4), bronze, m4.makeRotationY(Math.PI / 4).setPosition(lx, 4.4, lz));
      lanterns.push([lx, 3.9, lz, '#ffd59a']);
    }
    this.addGlows(lanterns, 3.4, 0.9);
    // flood-light glow at every column foot + under the portico
    const ups = []; for (let k = 0; k < 6; k++) ups.push([X + 54.6, F0 + 0.4, cz - 11 + k * 4.4, '#ffe0b0']);
    this.addGlows(ups, 4.5, 0.55);
    // flags on two poles beside the steps (teal field, white wave)
    const [fc, fx] = this.canvas(128, 80); fx.fillStyle = '#0f6b70'; fx.fillRect(0, 0, 128, 80); fx.strokeStyle = '#f4fbfa'; fx.lineWidth = 6; for (let k = 0; k < 2; k++) { fx.beginPath(); for (let q = 0; q <= 20; q++) { const xx = 20 + q * 4.4, yy = 34 + k * 16 + Math.sin(q * 0.7) * 5; q ? fx.lineTo(xx, yy) : fx.moveTo(xx, yy); } fx.stroke(); } fx.fillStyle = '#ffd23f'; fx.beginPath(); fx.arc(64, 22, 9, Math.PI, 0); fx.fill();
    const flagM = this.stdMat({ map: this.texFrom(fc), roughness: 0.8, side: T.DoubleSide });
    const flags = [];
    for (const s of [-1, 1]) {
      const fx0 = X + 57.6, fz0 = cz + s * 15.2;
      B.box(fx0 - 0.07, 0.15, fz0 - 0.07, fx0 + 0.07, 13.5, fz0 + 0.07, this.stdMat({ color: 0xd8d8d8, metalness: 0.8, roughness: 0.3, envMap: this.envMap }));
      HX.addCircle(fx0, fz0, 0.12, 'post', null);
      const fg = new T.PlaneGeometry(2.6, 1.6, 8, 1); fg.translate(1.3, 0, 0);
      const flag = new T.Mesh(fg, flagM); flag.position.set(fx0, 12.4, fz0); flag.rotation.y = s * 0.25 + Math.PI / 2; g.add(flag); flags.push(flag);
    }
    this.bankFlags = flags;
    // --- landscaping: north lawn + hedges, the south service lane with the back door ---
    const grass = this.stdMat({ map: this.tex.grass, roughness: 0.95 });
    const lawn = this.GB(); lawn.top(X + 11.3, Z + 11.3, X + 58.7, hz0 - 0.6, 0.17, 6, 6); lawn.top(X + 11.3, Z + 43.5, hx0 - 0.6, Z + 58.7, 0.17, 6, 6);
    g.add(new T.Mesh(lawn.geo(), grass));
    const hedge = this.stdMat({ color: 0x2f5a35, roughness: 0.95 });
    B.box(X + 22, 0.15, Z + 11.4, X + 58.6, 1.0, Z + 12.4, hedge); HX.addBox(X + 22, Z + 11.4, X + 58.6, Z + 12.4, 1, 'wall');
    const lane = this.GB(); lane.top(hx0 - 0.4, hz1 + 0.4, X + 58.7, Z + 58.7, 0.165, 4, 4);
    g.add(new T.Mesh(lane.geo(), this.stdMat({ color: 0x55534f, roughness: 0.85 })));
    const backX = X + 40, backZ = hz1 + 0.4;
    const bdM = this.stdMat({ color: 0x3a4148, roughness: 0.5, metalness: 0.6, envMap: this.envMap, envMapIntensity: 0.4 });
    B.box(backX - 0.95, 0.15, backZ - 0.05, backX + 0.95, 2.55, backZ + 0.08, bdM);
    B.box(backX - 1.15, 2.55, backZ - 0.05, backX + 1.15, 2.75, backZ + 0.12, plain);
    B.box(backX + 0.6, 1.1, backZ + 0.08, backX + 0.75, 1.2, backZ + 0.16, this.stdMat({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.3 }));
    // caged lamp over the back door + its glow + a small pool of light
    const lampM = this.mats.backLamp = new T.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false });
    B.box(backX - 0.18, 3.0, backZ + 0.05, backX + 0.18, 3.32, backZ + 0.36, lampM); B.glow(lampM);
    B.box(backX - 0.22, 3.32, backZ, backX + 0.22, 3.4, backZ + 0.42, bdM);
    this.addGlows([[backX, 3.1, backZ + 0.5, '#fff0c8']], 3.2, 0.95);
    const pool = new T.Mesh(new T.PlaneGeometry(7, 7), this.mats.backPool = new T.MeshBasicMaterial({ map: this.tex.glow, color: 0xffe6b8, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(backX, 0.19, backZ + 2.6); g.add(pool);
    const [nc, nx] = this.canvas(128, 64); nx.fillStyle = '#c8102e'; nx.fillRect(0, 0, 128, 64); nx.fillStyle = '#fff'; nx.font = '800 20px Rubik, Arial, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText('STAFF ONLY', 64, 22); nx.font = '700 13px Rubik, Arial, sans-serif'; nx.fillText('NO ENTRY', 64, 46);
    this.plane(0.8, 0.4, this.stdMat({ map: this.texFrom(nc), roughness: 0.6 }), backX - 1.75, 1.7, backZ + 0.02, 0, g);
    // dumpster + bollards on the service lane
    const dump = this.stdMat({ color: 0x2f5a3c, roughness: 0.6, metalness: 0.3 });
    B.box(X + 45, 0.15, backZ + 0.3, X + 47.4, 1.45, backZ + 1.7, dump); B.box(X + 44.95, 1.45, backZ + 0.25, X + 47.45, 1.55, backZ + 1.75, steel());
    HX.addBox(X + 45, backZ + 0.3, X + 47.4, backZ + 1.7, 1.5, 'wall');
    function steel() { return HWorld.mats.bankSteel || (HWorld.mats.bankSteel = HWorld.stdMat({ color: 0x2b2f34, roughness: 0.5, metalness: 0.6 })); }
    // --- the HQ tower's crown sign (east face, readable from the avenue) ---
    const crownM = this.mats.crown = new T.MeshBasicMaterial({ map: this.makeCrownSign(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const crown = this.plane(26, 4.9, crownM, X + 21.6, 92.5, Z + 28, Math.PI / 2, g); crown.layers.enable(1);
    this.todHooks.push((pal) => {
      const night = HX.clamp(1 - pal.sunI / 1.8, 0, 1);           // floodlit stone after dark
      stone.emissiveIntensity = 0.3 * night; stoneD.emissiveIntensity = 0.26 * night; plain.emissiveIntensity = 0.34 * night; colM.emissiveIntensity = 0.42 * night;
      frM.emissiveIntensity = 0.15 + 1.4 * night; tyM.emissiveIntensity = 0.05 + 0.7 * night; soffit.emissiveIntensity = 0.55 + 0.6 * night;
      for (const m of winM) m.emissiveIntensity = 0.3 + 0.8 * pal.win; trM.emissiveIntensity = 0.5 + 0.8 * pal.win;
      crownM.color.setScalar(0.6 + 2.2 * pal.neon); this.mats.lantern.color.setRGB(1, 0.8, 0.5).multiplyScalar(0.25 + 1.6 * pal.lamps);
      lampM.color.setRGB(1, 0.94, 0.78).multiplyScalar(0.5 + 1.4 * pal.lamps); this.mats.backPool.opacity = 0.45 * pal.lamps;
    });
    B.flush();
    for (const l of this.lots) if (l.crew === 'bank') l.h = 98;
    this.bank = {
      name: 'OCEAN TRUST BANK',
      door: { x: hx1 + 1.0, z: cz },                     // on the portico in front of the bronze doors (floor 1.65 m)
      front: { x: X + 61, z: cz },                       // sidewalk at the foot of the steps
      park: { x: X + 40, z: Z + 6, h: -Math.PI / 2 },   // around the corner on the north street, nose west
      back: { x: X + 40.5, z: Z + 64, h: Math.PI / 2 }, // getaway stop by the back door, nose east (toward the trap)
      backDoor: { x: backX, z: +(backZ + 0.9).toFixed(2) },
    };
  },

  /* ---------- the Key Island lookout (north-east corner): pad, railing, bench, lamp, viewer ---------- */
  buildLookout() {
    const T = this.T, g = new T.Group(); g.name = 'lookout'; this.scene.add(g);
    const B = this.batcher(g), m4b = B.m4;
    const x0 = 933, x1 = 958.6, z0 = -45.4, z1 = -20.5;
    const [pc, px] = this.canvas(256, 256); px.fillStyle = '#8f8473'; px.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { const v = 150 + Math.random() * 30; px.fillStyle = `rgb(${v},${v - 10},${v - 26})`; px.fillRect(k * 32 + 1 + (r % 2) * 16, r * 32 + 1, 30, 30); px.fillRect(k * 32 + 1 + (r % 2) * 16 - 256, r * 32 + 1, 30, 30); }
    const padM = this.stdMat({ map: this.texFrom(pc, true), roughness: 0.85 });
    const pad = this.GB(); pad.top(x0, z0, x1, z1, 0.045, 4, 4); pad.box(x0, -0.3, z0, x1, 0.045, z1, 4, 4, null, 0, true);
    g.add(new T.Mesh(pad.geo(), padM));
    // low stone wall + steel railing along the east and north edges
    const wallM = this.stdMat({ color: 0xcfc3ad, roughness: 0.9 }), railM = this.stdMat({ color: 0x2c3036, roughness: 0.4, metalness: 0.7, envMap: this.envMap, envMapIntensity: 0.5 });
    const wb = this.GB(); wb.box(x1, 0, z0 - 0.5, x1 + 0.5, 0.55, z1, 1, 1); wb.box(x0, 0, z0 - 0.5, x1 + 0.5, 0.55, z0, 1, 1); g.add(new T.Mesh(wb.geo(), wallM));
    const rb = { p: [], n: [], u: [], i: [] }, m4 = new T.Matrix4(), post = new T.BoxGeometry(0.07, 0.6, 0.07);
    for (let z = z0; z <= z1 + 0.01; z += 1.6) this.mergeInto(rb, post, m4.makeTranslation(x1 + 0.25, 0.85, z));
    for (let x = x0; x <= x1 + 0.3; x += 1.6) this.mergeInto(rb, post, m4.makeTranslation(x, 0.85, z0 - 0.25));
    for (const y of [0.9, 1.14]) { this.mergeInto(rb, new T.BoxGeometry(0.06, 0.05, z1 - z0 + 0.5), m4.makeTranslation(x1 + 0.25, y, (z0 + z1) / 2 - 0.25)); this.mergeInto(rb, new T.BoxGeometry(x1 - x0 + 0.5, 0.05, 0.06), m4.makeTranslation((x0 + x1) / 2 + 0.25, y, z0 - 0.25)); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rb.p, 3)); rg.setAttribute('normal', new T.Float32BufferAttribute(rb.n, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(rb.u, 2));
    g.add(new T.Mesh(rg, railM));
    HX.addBox(x1, z0 - 0.6, x1 + 2, z1, 1.2, 'rail'); HX.addBox(x0, z0 - 2, x1 + 2, z0, 1.2, 'rail');
    // bench facing the view (east), at the south end of the pad
    const wood = this.stdMat({ color: 0x8a5a36, roughness: 0.8 });
    const bx = 955.6, bz = -23.4;
    B.box(bx - 0.22, 0.42, bz - 0.95, bx + 0.22, 0.48, bz + 0.95, wood); B.box(bx - 0.3, 0.5, bz - 0.95, bx - 0.24, 0.92, bz + 0.95, wood);
    for (const s of [-1, 1]) B.box(bx - 0.28, 0.045, bz + s * 0.85 - 0.04, bx + 0.22, 0.45, bz + s * 0.85 + 0.04, railM);
    HX.addBox(bx - 0.32, bz - 1, bx + 0.25, bz + 1, 0.9, 'wall');
    const bx2 = 947.5, bz2 = -44.3; // a second bench facing north-east over the water, by the north rail
    B.box(bx2 - 0.95, 0.42, bz2 - 0.22, bx2 + 0.95, 0.48, bz2 + 0.22, wood); B.box(bx2 - 0.95, 0.5, bz2 + 0.24, bx2 + 0.95, 0.92, bz2 + 0.3, wood);
    for (const s of [-1, 1]) B.box(bx2 + s * 0.85 - 0.04, 0.045, bz2 - 0.22, bx2 + s * 0.85 + 0.04, 0.45, bz2 + 0.28, railM);
    HX.addBox(bx2 - 1, bz2 - 0.25, bx2 + 1, bz2 + 0.32, 0.9, 'wall');
    // stone planters with clipped shrubs at the pad's inland corners
    const shrub = this.stdMat({ color: 0x3f6e3a, roughness: 0.95 });
    for (const [qx, qz] of [[934.6, -43.6], [934.6, -23.2]]) {
      B.box(qx - 0.8, 0.045, qz - 0.8, qx + 0.8, 0.65, qz + 0.8, wallM);
      B.geo(new T.SphereGeometry(0.75, 10, 8), shrub, m4b.makeScale(1, 0.75, 1).setPosition(qx, 0.95, qz));
      HX.addBox(qx - 0.8, qz - 0.8, qx + 0.8, qz + 0.8, 1.2, 'wall');
    }
    // a coin-op viewer at the railing and an old lamp post
    B.geo(new T.CylinderGeometry(0.07, 0.11, 1.15, 10), railM, m4b.makeTranslation(957.9, 0.045 + 0.58, -27.6));
    B.geo(new T.CylinderGeometry(0.17, 0.17, 0.46, 12), this.stdMat({ color: 0x2b6b5a, roughness: 0.4, metalness: 0.6 }), m4b.makeRotationZ(Math.PI / 2).setPosition(957.95, 0.045 + 1.28, -27.6));
    HX.addCircle(957.9, -27.6, 0.2, 'post', null);
    B.geo(new T.CylinderGeometry(0.06, 0.1, 3.6, 8), railM, m4b.makeTranslation(935, 0.045 + 1.8, -21.6));
    B.geo(new T.SphereGeometry(0.22, 12, 8), this.mats.lantern || (this.mats.lantern = new T.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false })), m4b.makeTranslation(935, 0.045 + 3.75, -21.6)); B.glow(this.mats.lantern);
    HX.addCircle(935, -21.6, 0.15, 'post', null);
    this.addGlows([[935, 3.75, -21.6, '#ffd59a']], 3.2, 0.9);
    B.flush();
    // the staging (see lookoutStaging): the trio faces the camera, the car behind them side-on, nose to screen-right
    const lk = this._lk || this.lookoutStaging(), c = lk.crew;
    this.lookout = {
      x: lk.O.x, z: lk.O.z,
      carSpot: lk.car,
      crew: [c.yoav, c.hadar, c.ido], crewById: c,
      cam: { x: +lk.cam.x.toFixed(2), y: lk.cam.y, z: +lk.cam.z.toFixed(2), lx: lk.cam.look.x, ly: +lk.cam.ly.toFixed(3), lz: lk.cam.look.z, fov: 40 },
    };
  },

  /* ---------- the remaining story points + suggested GPS paths ---------- */
  buildCrewPoints() {
    // the gas trap: the intersection of x = 210 and z = -70 on the escape east from the bank's back door;
    // the cylinders go on the south-west kerb corner, right beside the eastbound lane
    this.trap = { x: 210, z: -70, prop: { x: 202.6, z: -62.6, h: 3 * Math.PI / 4 } };
    // the chapter opens on Ocean Drive among the palms, nose north (the beach on the right)
    this.crewStart = { car: { x: 286, z: 205, h: Math.PI } };
    this.crewHomes = {
      yoav: { x: 61.2, z: -125.5, h: Math.PI / 2, car: { x: 64, z: -118, h: Math.PI } },     // downtown, by the bank
      hadar: { x: 305, z: -92, h: Math.PI / 2, car: { x: 286, z: -98, h: Math.PI } },        // on the beach by the boardwalk
      ido: { x: -201.6, z: 170, h: -Math.PI / 2, car: { x: -204, z: 177, h: Math.PI } },     // a quiet west-side street
    };
    const n = (i, j) => ({ x: HX.L(i), z: HX.L(j) }), p = (o) => ({ x: o.x, z: o.z });
    const gs = this.gunStore, bk = this.bank, tr = this.trap;
    this.crewPaths = {
      // north up Ocean Drive, west along z = 140, north on x = 0, then right into the bay (the store on the right)
      toStore: [p(this.crewStart.car), n(8, 6), n(4, 6), n(4, 5), p(gs.park)],
      // east to the avenue, north into downtown past the bank's portico, left onto its north street
      toBank: [p(gs.park), n(5, 5), n(5, 4), n(5, 3), n(5, 2), p(bk.park)],
      pickup: [p(bk.park), n(4, 2), n(4, 3), p(bk.back)],
      escape: [p(bk.back), n(5, 3), n(6, 3), { x: tr.x, z: tr.z }, n(8, 3), n(8, 4), { x: HX.BRIDGE_X0, z: 0 }],
      toLookout: [{ x: HX.BRIDGE_X0, z: 0 }, { x: 570, z: 0 }, { x: HX.BRIDGE_X1, z: 0 }, { x: 905, z: 0 }, { x: 912, z: -25 }, p(this.lookout.carSpot)], // (around the garage's north wing)
    };
  },

  /* ---------- glow points (one draw call per size class) ---------- */
  addGlows(list, size, alpha, keepDay) {
    const T = this.T, pos = [], col = [], c = new T.Color();
    for (const [x, y, z, hx] of list) { pos.push(x, y, z); c.set(hx).convertSRGBToLinear(); col.push(c.r, c.g, c.b); }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const mat = new T.PointsMaterial({ size, map: this.tex.glow, vertexColors: true, transparent: true, opacity: alpha, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false });
    const pts = new T.Points(geo, mat); this.scene.add(pts); pts.layers.enable(1);
    this.glowSets.push({ mat, base: alpha, keepDay: !!keepDay });
    return pts;
  },

  /* ---------- palms, streetlights, light pools ---------- */
  buildStreetFurniture() {
    const T = this.T, scene = this.scene, R = HX.rng(99), H = HX.HALF;
    const palms = [...(this.palmSpots || [])];
    // Ocean Drive: both sidewalks lined with palms
    for (let z = -270; z <= 270; z += 22) { palms.push([HX.HALF + 10.5, z + R() * 4]); const f = ((z + HX.HALF) % 70 + 70) % 70; if (Math.min(f, 70 - f) > 12) palms.push([HX.HALF - 10.5, z + R() * 4]); } // west side: not on a crossing road
    // the beach
    for (let k = 0; k < 40; k++) palms.push([300 + R() * 26, -280 + R() * 560]);
    // parks
    for (const l of this.lots) if (l.park) for (let k = 0; k < 10; k++) palms.push([HX.lerp(l.x0 + 5, l.x1 - 5, R()), HX.lerp(l.z0 + 5, l.z1 - 5, R())]);
    // main avenue z = 0 median palms + some sidewalks
    for (let x = -260; x <= 260; x += 35) if (Math.abs(((x + H) % 70) - 35) < 25) palms.push([x, 9.5]);
    // (chapter 3 palms are appended last: every palm before them keeps its random size / turn)
    this.buildPalms(palms.filter(([x, z]) => !(Math.abs(z) < 10 && x > 285 && x < 340)).concat(this.crewPalms || []));
    // streetlights: along every road line, both sides, every 35 m (skip intersections)
    const poles = [];
    for (let i = 0; i <= HX.N; i++) {
      const c = HX.L(i);
      for (let s = -H + 17.5; s < H; s += 35) {
        poles.push([c + 8.6, s, -1]); poles.push([c - 8.6, s + 17.5 < H ? s + 17.5 : s, 1]);        // N-S road: x = c +- 8.6, arm toward -x / +x
        poles.push([s, c + 8.6, -2]); poles.push([s + 17.5 < H ? s + 17.5 : s, c - 8.6, 2]);        // E-W road: z = c +- 8.6
      }
    }
    // no pole may stand on asphalt (the staggered ones would land on every crossing road), and the hotel entrance stays clear
    this.buildStreetlights(poles.filter(([x, z]) => !HX.onRoad(x, z, 1) && !(Math.abs(x + 148.6) < 0.5 && Math.abs(z + 35) < 12) && !(this.crewNoPoles || []).some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3])));
  },
  buildPalms(spots) {
    const T = this.T, scene = this.scene, R = HX.rng(5);
    // trunk template: curved stack of cylinders
    const trunk = { p: [], n: [], u: [], i: [] }, m = new T.Matrix4();
    let x = 0, y = 0;
    for (let k = 0; k < 7; k++) {
      const seg = new T.CylinderGeometry(0.2 - k * 0.012, 0.26 - k * 0.012, 1.35, 7, 1, true);
      x += 0.05 + k * 0.04; m.makeTranslation(x, y + 0.675, 0); this.mergeInto(trunk, seg, m); y += 1.3;
    }
    const top = { x, y };
    const tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.Float32BufferAttribute(trunk.p, 3)); tg.setAttribute('normal', new T.Float32BufferAttribute(trunk.n, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(trunk.u, 2));
    // fronds: drooping strips
    const fr = { p: [], n: [], u: [], i: [] };
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + (k % 2) * 0.2, L = 3.6 + (k % 3) * 0.4, seg = 5;
      const g = new T.PlaneGeometry(1.1, L, 1, seg); const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) { const py = pos.getY(v) + L / 2, t = py / L; pos.setXYZ(v, pos.getX(v) * (1 - t * 0.5), 0, 0); pos.setY(v, Math.sin(t * 1.4) * 1.0 - t * t * 1.7); pos.setZ(v, py * 0.95); }
      g.computeVertexNormals();
      m.makeRotationY(a); m.setPosition(top.x, top.y, 0); this.mergeInto(fr, g, m);
    }
    const fg = new T.BufferGeometry();
    fg.setAttribute('position', new T.Float32BufferAttribute(fr.p, 3)); fg.setAttribute('normal', new T.Float32BufferAttribute(fr.n, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute(fr.u, 2));
    const tm = new T.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.95 });
    const fm = new T.MeshStandardMaterial({ map: this.tex.leaf, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.8, color: 0x9fd39a });
    const n = spots.length, it = new T.InstancedMesh(tg, tm, n), ifr = new T.InstancedMesh(fg, fm, n);
    const d = new T.Object3D();
    this.palms = [];
    spots.forEach(([px, pz], k) => {
      const s = 0.85 + R() * 0.45; d.position.set(px, 0.1, pz); d.rotation.set(0, R() * Math.PI * 2, 0); d.scale.set(s, s, s); d.updateMatrix();
      it.setMatrixAt(k, d.matrix); ifr.setMatrixAt(k, d.matrix);
      const c = HX.addCircle(px, pz, 0.45, 'palm', { k }); this.palms.push({ x: px, z: pz, s, ry: d.rotation.y, c, fall: 0, fdx: 0, fdz: 0 });
    });
    it.instanceMatrix.needsUsage && it.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(it); scene.add(ifr); this.palmMeshes = [it, ifr];
  },
  // a car knocked a palm: tip it over in the direction of travel
  knockPalm(c, vx, vz) {
    const p = this.palms[c.obj.k]; if (!p || p.fall > 0) return; c.down = true;
    const L = Math.hypot(vx, vz) || 1; p.fdx = vx / L; p.fdz = vz / L; p.fall = 0.001;
  },
  updatePalms(dt) {
    if (!this.palms) return;
    const T = this.T, d = this._d || (this._d = new T.Object3D()); let dirty = false;
    for (let k = 0; k < this.palms.length; k++) {
      const p = this.palms[k]; if (p.fall <= 0 || p.fall >= 1) continue;
      p.fall = Math.min(1, p.fall + dt * 1.6); const a = (1 - Math.pow(1 - p.fall, 3)) * 1.35;
      d.position.set(p.x, 0.1, p.z); d.rotation.set(0, 0, 0); d.scale.set(p.s, p.s, p.s);
      d.quaternion.setFromAxisAngle(new T.Vector3(p.fdz, 0, -p.fdx), a); d.rotateY(p.ry); d.updateMatrix();
      this.palmMeshes[0].setMatrixAt(k, d.matrix); this.palmMeshes[1].setMatrixAt(k, d.matrix); dirty = true;
    }
    if (dirty) { this.palmMeshes[0].instanceMatrix.needsUpdate = true; this.palmMeshes[1].instanceMatrix.needsUpdate = true; }
  },
  buildStreetlights(poles) {
    const T = this.T, scene = this.scene, n = poles.length;
    const pg = { p: [], n: [], u: [], i: [] }, m = new T.Matrix4();
    this.mergeInto(pg, new T.CylinderGeometry(0.09, 0.14, 8, 6), m.makeTranslation(0, 4, 0));
    this.mergeInto(pg, new T.BoxGeometry(0.12, 0.12, 2.4), m.makeTranslation(0, 7.9, 1.1));
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pg.p, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(pg.n, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(pg.u, 2));
    const poleM = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0x2c2d38, roughness: 0.5, metalness: 0.6 }), n);
    const headGeo = new T.BoxGeometry(0.45, 0.16, 0.9); headGeo.translate(0, 7.78, 2.1);
    this.mats.lamp = new T.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
    const headM = new T.InstancedMesh(headGeo, this.mats.lamp, n);
    const poolGeo = new T.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(0, 0.05, 2.6);
    this.mats.pool = new T.MeshBasicMaterial({ map: this.tex.glow, color: 0xffb46a, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const poolM = new T.InstancedMesh(poolGeo, this.mats.pool, n);
    const d = new T.Object3D(), glows = [];
    poles.forEach(([x, z, dir], k) => {
      // dir: +-1 = arm along x, +-2 = arm along z
      const ry = dir === -1 ? -Math.PI / 2 : dir === 1 ? Math.PI / 2 : dir === -2 ? Math.PI : 0;
      d.position.set(x, 0.15, z); d.rotation.set(0, ry, 0); d.updateMatrix();
      poleM.setMatrixAt(k, d.matrix); headM.setMatrixAt(k, d.matrix); poolM.setMatrixAt(k, d.matrix);
      const hx = x + Math.sin(ry) * 2.1, hz = z + Math.cos(ry) * 2.1;
      glows.push([hx, 7.7, hz, '#ffcf8a']);
      HX.addCircle(x, z, 0.25, 'pole', { k });
    });
    scene.add(poleM); scene.add(headM); scene.add(poolM); headM.layers.enable(1);
    this.lampGlow = this.addGlows(glows, 6.5, 0.85);
    this.poolMesh = poolM; this.poleMeshes = [poleM, headM, poolM];
  },
  // a car took a lamp post down: it falls over (hidden instance) and its light goes out
  knockPole(c) {
    if (c.down) return; c.down = true; if (!c.obj || !this.poleMeshes) return;
    const d = this._pd || (this._pd = new this.T.Object3D()); d.position.set(c.x, -60, c.z); d.scale.setScalar(0.001); d.updateMatrix();
    for (const m of this.poleMeshes) { m.setMatrixAt(c.obj.k, d.matrix); m.instanceMatrix.needsUpdate = true; }
    const g = this.lampGlow && this.lampGlow.geometry.attributes.position; if (g) { g.setY(c.obj.k, -60); g.needsUpdate = true; }
    if (window.HFX3) { HFX3.sparkBurst(c.x, 7.6, c.z, 0, 0, 18); HFX3.puff && HFX3.puff(c.x, 0.4, c.z, 0, 0, 1); }
  },

  /* ---------- causeway, island, safe house ---------- */
  buildBridgeAndIsland() {
    const T = this.T, scene = this.scene, X0 = HX.BRIDGE_X0, X1 = HX.BRIDGE_X1, W = HX.BRIDGE_HW;
    // deck (road surface) — 4 lanes; road texture repeated along x
    const dg = this.GB(); const b = dg.p.length / 3;
    dg.p.push(X0, 0.07, W, X1 + 60, 0.07, W, X1 + 60, 0.07, -W, X0, 0.07, -W); // above the beach sand (0.05) and the island top (0.02)
    for (let k = 0; k < 4; k++) dg.n.push(0, 1, 0);
    dg.u.push(1.3, 0, 1.3, (X1 + 60 - X0) / 14, -0.3, (X1 + 60 - X0) / 14, -0.3, 0); dg.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    const deck = new T.Mesh(dg.geo(), this.mats.road); scene.add(deck); this.reflectables.push(deck);
    // concrete body + pillars + barriers
    const conc = new T.MeshStandardMaterial({ color: 0x8c8794, roughness: 0.8 });
    const cg = this.GB();
    cg.box(330, -1.6, -W - 0.4, X1, 0, W + 0.4, 4, 4, null, 0, true);
    for (let x = 340; x < X1; x += 40) cg.box(x - 1.2, -9, -4, x + 1.2, -1.6, 4, 4, 4, null, 0, true);
    cg.box(330, 0, W, X1, 0.95, W + 0.45, 4, 4); cg.box(330, 0, -W - 0.45, X1, 0.95, -W, 4, 4);
    scene.add(new T.Mesh(cg.geo(), conc));
    // walls (physics) along the barriers over the water
    // (the colliders are 6 m deep so a fast car at a low frame rate can never tunnel through onto the water)
    HX.addBox(336, W, X1, W + 6, 1, 'rail'); HX.addBox(336, -W - 6, X1, -W, 1, 'rail');
    // lights along the causeway
    const glows = [], poleGeo = new T.CylinderGeometry(0.1, 0.14, 9, 6); poleGeo.translate(0, 4.5, 0);
    const pm = new T.MeshStandardMaterial({ color: 0x2c2d38, metalness: 0.6, roughness: 0.5 });
    const n = Math.floor((X1 - 340) / 45) * 2, poles = new T.InstancedMesh(poleGeo, pm, n); let k = 0; const d = new T.Object3D();
    for (let x = 340; x < X1 - 5 && k < n; x += 45) for (const s of [-1, 1]) { if (k >= n) break; d.position.set(x, 0.9, s * (W + 0.2)); d.updateMatrix(); poles.setMatrixAt(k++, d.matrix); glows.push([x, 9.8, s * (W - 1.2), '#ffcf8a']); }
    scene.add(poles); this.addGlows(glows, 7, 0.85);
    // green overhead highway signs (gantry) like in the trailer
    this.buildGantry(360); this.buildGantry(700);
    // island ground
    const I = HX.ISLAND, ig = this.GB();
    ig.box(I.x0, -3, I.z0, I.x1, 0.02, I.z1, 8, 8, null, 0, true);
    const island = new T.Mesh(ig.geo(), new T.MeshStandardMaterial({ map: this.tex.sand, roughness: 0.95 })); scene.add(island);
    const top = this.GB(); top.top(I.x0, I.z0, I.x1, I.z1, 0.02, 8, 8);
    scene.add(new T.Mesh(top.geo(), new T.MeshStandardMaterial({ map: this.tex.sand, roughness: 0.95 })));
    HX.addBox(I.x1, I.z0 - 5, I.x1 + 6, I.z1 + 5, 4, 'wall'); HX.addBox(I.x0, I.z1, I.x1, I.z1 + 6, 4, 'wall'); HX.addBox(I.x0, I.z0 - 6, I.x1, I.z0, 4, 'wall');
    HX.addBox(X1 - 2, W + 0.5, I.x0, I.z1, 4, 'wall'); HX.addBox(X1 - 2, I.z0, I.x0, -W - 0.5, 4, 'wall');
    // safe house garage with an open door and a neon sign
    const S = HX.SAFEHOUSE, gar = new T.Group(); scene.add(gar);
    const wallM = new T.MeshStandardMaterial({ color: 0xe7d9c2, roughness: 0.7 });
    const gg = this.GB();
    gg.box(S.x + 6, 0, -14, S.x + 24, 9, 14, 1, 1);                 // back block
    gg.box(S.x - 6, 0, -14, S.x + 6, 9, -9, 1, 1); gg.box(S.x - 6, 0, 9, S.x + 6, 9, 14, 1, 1); // side wings
    gg.box(S.x - 6, 6, -9, S.x + 6, 9, 9, 1, 1);                    // lintel
    gar.add(new T.Mesh(gg.geo(), wallM));
    HX.addBox(S.x + 6, -14, S.x + 24, 14, 9, 'wall'); HX.addBox(S.x - 6, -14, S.x + 6, -9, 9, 'wall'); HX.addBox(S.x - 6, 9, S.x + 6, 14, 9, 'wall');
    const inside = new T.Mesh(new T.PlaneGeometry(18, 6), new T.MeshBasicMaterial({ color: 0xffb070, toneMapped: false })); inside.position.set(S.x + 5.9, 3, 0); inside.rotation.y = -Math.PI / 2; gar.add(inside);
    const neon = this.GB(), halo = this.GB(); this.neonRect(neon, halo, S.x - 6, -9, S.x + 6, 9, 6.2, this.hex('#5cf2a8'));
    const nm = new T.Mesh(neon.geo(), this.mats.neon); gar.add(nm); nm.layers.enable(1);
    const hm = new T.Mesh(halo.geo(), this.mats.halo); gar.add(hm); hm.layers.enable(1);
    this.addGlows([[S.x - 6.3, 7.5, 0, '#5cf2a8'], [S.x - 6.3, 7.5, -6, '#5cf2a8'], [S.x - 6.3, 7.5, 6, '#5cf2a8']], 8, 0.8);
  },
  buildGantry(x) {
    const T = this.T, g = new T.Group(); this.scene.add(g);
    const metal = new T.MeshStandardMaterial({ color: 0x7c7f88, metalness: 0.7, roughness: 0.4 });
    for (const s of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(0.5, 8, 0.5), metal); post.position.set(x, 4, s * (HX.BRIDGE_HW + 0.6)); g.add(post); }
    const beam = new T.Mesh(new T.BoxGeometry(0.6, 0.7, HX.BRIDGE_HW * 2 + 2), metal); beam.position.set(x, 7.6, 0); g.add(beam);
    const [c, cx] = this.canvas(512, 160);
    cx.fillStyle = '#0b6b3a'; cx.fillRect(0, 0, 512, 160); cx.strokeStyle = '#fff'; cx.lineWidth = 6; cx.strokeRect(8, 8, 496, 144);
    cx.fillStyle = '#fff'; cx.font = '700 46px Rubik, Arial, sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    cx.fillText('KEY ISLAND', 30, 56); cx.font = '600 34px Rubik, Arial, sans-serif'; cx.fillText('SAFE HARBOR  ➜', 30, 112);
    const tex = this.texFrom(c);
    const sign = new T.Mesh(new T.PlaneGeometry(10, 3.1), new T.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    sign.position.set(x - 0.36, 9.2, -4.2); sign.rotation.y = -Math.PI / 2; g.add(sign);
    const sign2 = sign.clone(); sign2.position.z = 5.5; g.add(sign2);
  },

  /* ---------- water + sky ---------- */
  buildWater() {
    const T = this.T;
    const mat = this.waterMat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uSky: { value: new T.Color(0x2a0f45) }, uHorizon: { value: new T.Color(0xff6ab0) }, uDeep: { value: new T.Color(0x04060f) },
        uSunDir: { value: new T.Vector3(1, 0.05, 0) }, uSunCol: { value: new T.Color(0xffc080) }, uSunK: { value: 0 },
        uFog: { value: new T.Color(0x1a0b2e) }, uFogD: { value: 0.0028 }, uCity: { value: 1 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float uTime, uSunK, uFogD, uCity; uniform vec3 uSky, uHorizon, uDeep, uSunCol, uFog, uSunDir; varying vec3 vW;
        float wave(vec2 p, vec2 d, float f, float s){ return sin(dot(p, d) * f + uTime * s); }
        void main(){
          vec2 p = vW.xz;
          float h1 = wave(p, vec2(0.8,0.6), 0.35, 1.3), h2 = wave(p, vec2(-0.5,0.9), 0.62, 1.9), h3 = wave(p, vec2(0.2,-1.0), 1.4, 2.7), h4 = wave(p, vec2(0.97,0.2), 2.6, 3.9);
          float h5 = wave(p, vec2(-0.7,-0.7), 4.3, 5.1), h6 = wave(p, vec2(0.3,0.95), 6.7, 6.3);
          vec3 n = normalize(vec3(0.06*h1 + 0.05*h2 + 0.035*h3 + 0.025*h4 + 0.02*h5 + 0.012*h6, 1.0, 0.05*h2 + 0.04*h1 + 0.03*h4 - 0.025*h3 + 0.02*h6 - 0.015*h5));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.35, R.y));
          vec3 col = mix(uDeep + vec3(0.0, 0.012, 0.03), sky * vec3(0.8, 0.86, 1.0), 0.06 + 0.62 * fres); // deep water + sky sheen (never sand-coloured)
          float sp = pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0) * 6.0 + pow(max(dot(R, normalize(uSunDir)), 0.0), 18.0) * 0.5;
          col += uSunCol * sp * uSunK;
          // city light glints on the water at night
          float g = fract(sin(dot(floor(p * 0.5), vec2(12.9898, 78.233))) * 43758.5453);
          col += vec3(1.0, 0.55, 0.85) * step(0.985, g) * max(h4, 0.0) * 0.5 * uCity * smoothstep(400.0, 60.0, length(p - vec2(280.0, 0.0)));
          float d = length(cameraPosition - vW); float f = 1.0 - exp(-uFogD * uFogD * d * d);
          gl_FragColor = vec4(mix(col, uFog, f), 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    const water = new T.Mesh(new T.PlaneGeometry(6000, 6000, 1, 1), mat);
    water.rotation.x = -Math.PI / 2; water.position.y = -2.4; this.scene.add(water);
    // the beach slope + sand
    const sg = this.GB(); sg.top(HX.BEACH_X, -300, 330, 300, 0.05, 8, 8);
    const beach = new T.Mesh(sg.geo(), new T.MeshStandardMaterial({ map: this.tex.sand, roughness: 0.95 })); this.scene.add(beach);
    const sl = this.GB(), b0 = sl.p.length / 3; // sand sloping into the water
    sl.p.push(330, 0.05, 300, 364, -3.0, 300, 364, -3.0, -300, 330, 0.05, -300);
    for (let k = 0; k < 4; k++) sl.n.push(0.09, 1, 0);
    sl.u.push(0, 0, 4, 0, 4, 75, 0, 75); sl.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    this.scene.add(new T.Mesh(sl.geo(), beach.material));
    // distant skyline across the bay
    const sk = new T.Mesh(new T.CylinderGeometry(2200, 2200, 300, 64, 1, true, -0.9, 1.8), new T.MeshBasicMaterial({ map: this.makeSkyline(), transparent: true, side: T.BackSide, depthWrite: false, fog: false, toneMapped: false }));
    sk.position.set(0, 120, 0); sk.rotation.y = Math.PI / 2; this.scene.add(sk); this.skyline = sk;
    // chapter 3's sunset skyline: the same towers as warm silhouettes in the golden haze, faded in around tod 1
    // (same layout and base line, 1.5x taller: slender towers that rise past the low sun from the island)
    const hz = new T.Mesh(new T.CylinderGeometry(2200, 2200, 450, 64, 1, true, -0.9, 1.8), new T.MeshBasicMaterial({ map: this.makeSkylineHaze(), transparent: true, opacity: 0, side: T.BackSide, depthWrite: false, fog: false, toneMapped: false }));
    hz.position.set(0, 195, 0); hz.rotation.copy(sk.rotation); hz.renderOrder = 1; hz.visible = false; this.scene.add(hz); this.skylineHaze = hz;
  },
  buildSky() {
    const T = this.T;
    const mat = this.skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { uTop: { value: new T.Color(0x050314) }, uHorizon: { value: new T.Color(0x2a0f45) }, uSunDir: { value: new T.Vector3(1, -0.2, 0) }, uSunCol: { value: new T.Color(0xffb070) }, uSunK: { value: 0 }, uStars: { value: 1 }, uTime: { value: 0 }, uCloud: { value: new T.Color(0xff8fb0) } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uSunDir, uSunCol, uCloud; uniform float uSunK, uStars, uTime; varying vec3 vD;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          float e = clamp(vD.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.55, e), 0.7));
          vec3 sd = normalize(uSunDir); float s = max(dot(vD, sd), 0.0);
          col += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 30.0) * 0.55 + pow(s, 6.0) * 0.25) * uSunK;
          // banded sunset clouds
          float band = sin(vD.y * 60.0 + sin(vD.x * 7.0 + vD.z * 5.0) * 2.0) * 0.5 + 0.5;
          col = mix(col, uCloud, band * smoothstep(0.02, 0.12, e) * smoothstep(0.3, 0.12, e) * 0.35 * uSunK);
          // stars
          vec3 g = floor(vD * 420.0); float st = step(0.9965, hash(g)) * smoothstep(0.05, 0.4, e) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(g) * 30.0));
          col += vec3(st) * uStars;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(2600, 32, 16), mat); sky.frustumCulled = false; sky.renderOrder = -10; this.scene.add(sky); this.sky = sky;
    // chapter 3's low sun: a real disc + halo where the dome draws its sun (the dome's own disc fades between its
    // vertices); it sits behind the skyline cylinder, so the towers cut into it like in the video's last shot
    const sm = (c, o) => new T.SpriteMaterial({ map: this.tex.glow, color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const halo = new T.Sprite(sm(0xff9a4a, 0.55)), core = new T.Sprite(sm(0xfff2d0, 1));
    halo.scale.setScalar(420); core.scale.setScalar(70); halo.visible = core.visible = false;
    this.scene.add(halo); this.scene.add(core); this.sunSprites = [core, halo];
  },
  buildBounds() {
    const H = HX.HALF, T = this.T, R = HX.rng(321);
    // invisible walls around the city and the beach
    HX.addBox(-H - 30, -H - 30, -H - 9, H + 60, 60, 'wall');   // west
    HX.addBox(-H - 30, -H - 30, HX.OCEAN_X, -H - 9, 60, 'wall'); // north
    HX.addBox(-H - 30, H + 9, HX.OCEAN_X, H + 30, 60, 'wall');   // south
    HX.addBox(HX.OCEAN_X, -H - 30, HX.OCEAN_X + 10, -HX.BRIDGE_HW - 0.5, 60, 'wall'); // the water's edge (except the causeway)
    HX.addBox(HX.OCEAN_X, HX.BRIDGE_HW + 0.5, HX.OCEAN_X + 10, H + 30, 60, 'wall');
    // a ring of tall backdrop towers beyond the outer avenues
    const gb = this.GB(), set = this.tex.facades;
    const ring = [];
    for (let s = -H - 20; s < H + 20; s += 42) { ring.push([s, -H - 50, s + 36, -H - 14]); ring.push([s, H + 14, s + 36, H + 50]); ring.push([-H - 50, s, -H - 14, s + 36]); }
    const mats = [set.glass[0], set.concrete[1], set.tower[0]];
    const gbs = mats.map(() => this.GB()), roofs = this.GB();
    for (const [a0, c0, a1, c1] of ring) { if (a1 > HX.OCEAN_X - 2) continue; const k = Math.floor(R() * 3), h = 40 + R() * 90; gbs[k].box(a0, 0, c0, a1, h, c1, 32, 28, null, Math.floor(R() * 8), true); roofs.top(a0, c0, a1, c1, h, 8, 8); }
    gbs.forEach((g, k) => { const f = mats[k]; this.scene.add(new T.Mesh(g.geo(), new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emis, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.7, metalness: 0.2 }))); });
    this.scene.add(new T.Mesh(roofs.geo(), this.mats.roof));
    // the far ends of the outer avenues: dark ground continues
  },

  /* ---------- time of day: 0 = night, 1 = sunset, 2 = day (lerps between) ---------- */
  PALETTES: [
    { top: '#050314', hor: '#2c1150', fog: '#140823', fogD: 0.0032, hemiS: '#4a3aa8', hemiG: '#140810', hemiI: 0.32, sun: '#8fa8ff', sunI: 0.18, sunY: -0.15, win: 1.0, neon: 1.0, lamps: 1.0, stars: 1, sunK: 0, cloud: '#ff8fb0', deep: '#03050d', wHor: '#5a2a7a', exp: 1.05 },
    { top: '#232a68', hor: '#ff6a2a', fog: '#b8634e', fogD: 0.0011, hemiS: '#ffc49a', hemiG: '#3a2234', hemiI: 0.75, sun: '#ffa45c', sunI: 1.8, sunY: 0.13, win: 0.35, neon: 0.55, lamps: 0.45, stars: 0.05, sunK: 1.25, cloud: '#ff6f8f', deep: '#120a24', wHor: '#ff9a5a', exp: 0.92 },
    { top: '#2f7fd8', hor: '#bfe3ff', fog: '#a9c9e6', fogD: 0.0012, hemiS: '#dff0ff', hemiG: '#5a5660', hemiI: 1.0, sun: '#fff4e0', sunI: 2.4, sunY: 0.75, win: 0.08, neon: 0.18, lamps: 0.0, stars: 0, sunK: 0.25, cloud: '#ffffff', deep: '#0b3550', wHor: '#bfe3ff', exp: 0.9 },
  ],
  setTimeOfDay(t, lights) {
    const T = this.T; if (!T) return;
    t = HX.clamp(t, 0, 2); this.tod = t;
    const a = this.PALETTES[Math.floor(Math.min(t, 1.999))], b = this.PALETTES[Math.min(2, Math.floor(Math.min(t, 1.999)) + 1)], k = t - Math.floor(Math.min(t, 1.999));
    const C = (p, q) => new T.Color(p).convertSRGBToLinear().lerp(new T.Color(q).convertSRGBToLinear(), k), N = (p, q) => p + (q - p) * k;
    const pal = this.todPal = {
      top: C(a.top, b.top), hor: C(a.hor, b.hor), fog: C(a.fog, b.fog), fogD: N(a.fogD, b.fogD), hemiS: C(a.hemiS, b.hemiS), hemiG: C(a.hemiG, b.hemiG), hemiI: N(a.hemiI, b.hemiI),
      sun: C(a.sun, b.sun), sunI: N(a.sunI, b.sunI), sunY: N(a.sunY, b.sunY), win: N(a.win, b.win), neon: N(a.neon, b.neon), lamps: N(a.lamps, b.lamps), stars: N(a.stars, b.stars), sunK: N(a.sunK, b.sunK),
      cloud: C(a.cloud, b.cloud), deep: C(a.deep, b.deep), wHor: C(a.wHor, b.wHor), exp: N(a.exp, b.exp),
    };
    const sunDir = new T.Vector3(1, pal.sunY, -0.42).normalize(); // low over the bay, just left of the causeway
    if (this.skyMat) { const u = this.skyMat.uniforms; u.uTop.value.copy(pal.top); u.uHorizon.value.copy(pal.hor); u.uSunDir.value.copy(sunDir); u.uSunCol.value.copy(pal.sun); u.uSunK.value = pal.sunK; u.uStars.value = pal.stars; u.uCloud.value.copy(pal.cloud); }
    if (this.waterMat) { const u = this.waterMat.uniforms; u.uSky.value.copy(pal.top); u.uHorizon.value.copy(pal.wHor); u.uDeep.value.copy(pal.deep); u.uSunDir.value.copy(sunDir); u.uSunCol.value.copy(pal.sun); u.uSunK.value = pal.sunK; u.uFog.value.copy(pal.fog); u.uFogD.value = pal.fogD; u.uCity.value = pal.neon; }
    if (this.scene.fog) { this.scene.fog.color.copy(pal.fog); this.scene.fog.density = pal.fogD; }
    for (const m of this.mats.facades || []) m.emissiveIntensity = pal.win;
    if (this.mats.neon) this.mats.neon.color.setScalar(0.5 + 2.3 * pal.neon);   // > 1 = HDR: blooms
    if (this.mats.halo) this.mats.halo.opacity = 0.22 * pal.neon;
    if (this.mats.signs) { this.mats.signs.opacity = 0.4 + 0.6 * pal.neon; this.mats.signs.color.setScalar(1 + 1.6 * pal.neon); }
    if (this.mats.hotelSign) this.mats.hotelSign.color.setScalar(1 + 2 * pal.neon);
    if (this.mats.lamp) this.mats.lamp.color.setRGB(1, 0.85, 0.63).multiplyScalar(0.3 + 0.7 * pal.lamps);
    if (this.mats.pool) this.mats.pool.opacity = 0.32 * pal.lamps;
    if (this.mats.hotelWin) this.mats.hotelWin.opacity = 0.35 + 0.55 * pal.win;
    // the rain stops at dawn: the asphalt dries (rougher), so the low sun gives a soft sheen instead of a blown-out glare spot
    for (const m of [this.mats.road, this.mats.cross]) if (m) m.roughness = 0.42 + 0.3 * HX.clamp(t - 0.3, 0, 1);
    if (this.skyline) this.skyline.material.opacity = 1 - 0.85 * HX.clamp(t - 1, 0, 1); // the night skyline fades into the day haze
    if (this.skylineHaze) { // chapter 3 only (chapter 2 keeps its sky): HWorld.hazeSkyline = true / false overrides
      const on = this.hazeSkyline !== undefined && this.hazeSkyline !== null ? !!this.hazeSkyline : typeof HMission !== 'undefined' && HMission.story === 'crew';
      const k = on ? HX.clamp(1 - Math.abs(t - 1.05) / 0.6, 0, 1) : 0, m = this.skylineHaze.material;
      this.skylineHaze.visible = k > 0.001; m.opacity = 0.96 * k;
      if (this.skyline && on) this.skyline.material.opacity *= 1 - k;   // cross-fade: the night towers give way to the haze
      m.color.copy(pal.fog).lerp(pal.hor, 0.2); // warm haze, 35 % desaturated (the video's grey-orange towers)
      const lum = (m.color.r + m.color.g + m.color.b) / 3; m.color.setRGB(HX.lerp(m.color.r, lum, 0.35), HX.lerp(m.color.g, lum, 0.35), HX.lerp(m.color.b, lum, 0.35)).multiplyScalar(0.95);
      if (this.sunSprites) {
        const ks = on ? HX.clamp(1 - Math.abs(t - 1.05) / 0.7, 0, 1) * HX.clamp(pal.sunY * 8, 0, 1) : 0;
        for (const sp of this.sunSprites) { sp.visible = ks > 0.001; sp.position.copy(sunDir).multiplyScalar(2450); }
        this.sunSprites[0].material.color.setRGB(1, 0.95, 0.82).multiplyScalar(4.5 * ks); this.sunSprites[1].material.color.setRGB(1, 0.6, 0.29).multiplyScalar(1.3 * ks);
      }
    }
    for (const g of this.glowSets) g.mat.opacity = g.base * (g.keepDay ? 1 : Math.max(pal.lamps, pal.neon * 0.8));
    for (const f of this.todHooks || []) f(pal, t);
    if (lights) {
      lights.hemi.color.copy(pal.hemiS); lights.hemi.groundColor.copy(pal.hemiG); lights.hemi.intensity = pal.hemiI;
      lights.sun.color.copy(pal.sun); lights.sun.intensity = pal.sunI; lights.sunDir = sunDir;
    }
    return pal;
  },
  update(dt) { this.time += dt; if (this.waterMat) this.waterMat.uniforms.uTime.value = this.time; if (this.skyMat) this.skyMat.uniforms.uTime.value = this.time; this.updatePalms(dt); },
};
