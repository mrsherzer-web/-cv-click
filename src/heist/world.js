/* Heist chapter: builds the 3D city (night Miami vibes) — buildings, roads, neon, palms, streetlights,
   THE BIG SCORE hotel, the causeway to the island safe house, ocean and sky. Uses the global THREE (loaded lazily). */
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

    this.buildGround();
    this.buildBlocks();
    this.buildHotel();
    this.buildStreetFurniture();
    this.buildBridgeAndIsland();
    this.buildWater();
    this.buildSky();
    this.buildBounds();
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
    const neon = this.GB(); const halo = this.GB();
    const signs = this.GB(); const parks = this.GB();
    const neonCols = ['#ff2d95', '#28d7ff', '#b38cff', '#ff4fd8', '#5cf2a8', '#ffd23f'];
    this.lots = [];
    const hb = HX.HOTEL_BLOCK;
    for (let i = 0; i < HX.N; i++) for (let j = 0; j < HX.N; j++) {
      const x0 = HX.L(i) + 7, x1 = HX.L(i + 1) - 7, z0 = HX.L(j) + 7, z1 = HX.L(j + 1) - 7;
      // sidewalk slab (raised 15 cm, pavers)
      side.box(x0, 0, z0, x1, 0.15, z1, 4, 4);
      if (i === hb[0] && j === hb[1]) continue; // hotel built separately
      if (HX.PARK_BLOCKS.includes(i + ',' + j)) { parks.top(x0 + 3, z0 + 3, x1 - 3, z1 - 3, 0.17, 8, 8); this.lots.push({ park: true, x0, z0, x1, z1 }); continue; }
      const bx0 = x0 + 4, bx1 = x1 - 4, bz0 = z0 + 4, bz1 = z1 - 4, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      const zone = this.zoneOf(cx, cz);
      const split = R(); const lots = [];
      if (split < 0.3) lots.push([bx0, bz0, bx1, bz1]);
      else if (split < 0.6) { const m = HX.lerp(bx0, bx1, 0.4 + R() * 0.2); lots.push([bx0, bz0, m - 2, bz1], [m + 2, bz0, bx1, bz1]); }
      else if (split < 0.8) { const m = HX.lerp(bz0, bz1, 0.4 + R() * 0.2); lots.push([bx0, bz0, bx1, m - 2], [bx0, m + 2, bx1, bz1]); }
      else { const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2; lots.push([bx0, bz0, mx - 2, mz - 2], [mx + 2, bz0, bx1, mz - 2], [bx0, mz + 2, mx - 2, bz1], [mx + 2, mz + 2, bx1, bz1]); }
      for (const [a0, c0, a1, c1] of lots) {
        let kind, h;
        if (zone === 'coast') { kind = 'deco'; h = 10 + R() * 16; }
        else if (zone === 'down') { kind = R() < 0.55 ? 'glass' : R() < 0.5 ? 'tower' : 'concrete'; h = 40 + R() * 95; if (R() < 0.15) h += 60; }
        else { kind = R() < 0.4 ? 'deco' : R() < 0.6 ? 'concrete' : 'glass'; h = 14 + R() * 38; }
        h = Math.round(h / 3.5) * 3.5;
        const set = facadeSets[kind], k = Math.floor(R() * set.length), b = getB(kind, k);
        b.gb.box(a0, 0.15, c0, a1, 0.15 + h, c1, 32, 28, null, Math.floor(R() * 8), true);
        b.roof.top(a0, c0, a1, c1, 0.15 + h, 8, 8);
        // roof parapet + rooftop boxes
        b.roof.box(a0 + 1, 0.15 + h, c0 + 1, a0 + 3 + R() * 4, 0.15 + h + 1.5 + R() * 2, c0 + 3 + R() * 4, 4, 4);
        HX.addBox(a0, c0, a1, c1, h + 0.15, 'building');
        this.lots.push({ x0: a0, z0: c0, x1: a1, z1: c1, h, kind });
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
    const nm = new T.Mesh(neon.geo(), this.mats.neon); scene.add(nm); nm.layers.enable(1);
    this.mats.halo = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const hm = new T.Mesh(halo.geo(), this.mats.halo); scene.add(hm); hm.layers.enable(1);
    this.mats.signs = new T.MeshBasicMaterial({ map: this.tex.signs, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide });
    const sm = new T.Mesh(signs.geo(), this.mats.signs); scene.add(sm); sm.layers.enable(1);
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
    this.buildPalms(palms.filter(([x, z]) => !(Math.abs(z) < 10 && x > 285 && x < 340)));
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
    this.buildStreetlights(poles.filter(([x, z]) => !HX.onRoad(x, z, 1) && !(Math.abs(x + 148.6) < 0.5 && Math.abs(z + 35) < 12)));
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
    for (const g of this.glowSets) g.mat.opacity = g.base * (g.keepDay ? 1 : Math.max(pal.lamps, pal.neon * 0.8));
    if (lights) {
      lights.hemi.color.copy(pal.hemiS); lights.hemi.groundColor.copy(pal.hemiG); lights.hemi.intensity = pal.hemiI;
      lights.sun.color.copy(pal.sun); lights.sun.intensity = pal.sunI; lights.sunDir = sunDir;
    }
    return pal;
  },
  update(dt) { this.time += dt; if (this.waterMat) this.waterMat.uniforms.uTime.value = this.time; if (this.skyMat) this.skyMat.uniforms.uTime.value = this.time; this.updatePalms(dt); },
};
