/* HModels — procedural low-poly models for chapters 2 "THE BIG SCORE" and 3 "THE CREW".
 * three.js r128 is used as the global THREE, but only inside functions called after HModels.init().
 * Conventions: y up, metres. Cars face +z, their LEFT (driver) side is +x. People face +z (their left = +x).
 * Colours are authored in sRGB and converted to linear (renderer.outputEncoding = sRGBEncoding,
 * ACES tone mapping recommended). Pass { linearOutput: true } to init() to skip that conversion.
 * Geometry is cached and shared (never dispose it per instance); materials made per instance are noted below.
 *
 * API
 *  init(THREE, { envMap, linearOutput })   -> HModels. Call again for every new renderer (rebuilds shared materials).
 *  car(kind, { color, seed, lights })      -> car rig. kind: 'sports' | 'police' | 'sedan' | 'taxi' | 'van' | 'coupe' | 'lux'
 *    rig: { kind, group, body, wheels[{pivot, spin, mesh}], paint, meshes{paint,trim,glass,cabin,decal,lamps,glow}, shadow,
 *           dims{length,width,height,wheelBase,track,trackRear,wheelRadius}, door{x,z}, steeringWheel (lux, else null),
 *           seats{ driver, passenger, rearL, rearR } = [x, y, z] in car space (y = seat surface; 'sports' has no rear seats),
 *           setLights(on), setBrake(on), setReverse(on), setSiren(t|-1), setDamage(0..1), setColor(hex),
 *           setSteer(-1..1) (turns the modelled steering wheel; no-op without one), dispose() (own materials only) }
 *    'lux' = the crew's black four-door coupe (default colour 0x15161a): 5.0 x 1.9 x 1.41 m, clear tinted glass with a tan
 *    cabin (seated rigs are visible), dark 16-spoke wheels with red calipers on the wheel pivots, slim LED lamps.
 *  person(kind, { seed, masked })          -> person rig (one SkinnedMesh, 12 bones, 1 draw call + blob shadow)
 *    kind: 'hero' | 'hacker' | 'civ' | 'cop' | 'yoav' | 'hadar' | 'ido' (unknown -> 'civ')
 *    crew: 'yoav' white button-up, beard, curls, round glasses, grey slacks, brown belt; 'hadar' charcoal-green hoodie,
 *    gold chest logo, black knee cargo shorts; 'ido' sage tee with a black round chest emblem, navy-black jeans. All wear a
 *    black watch on the left wrist. { masked: true } -> heist kit: black tactical clothes, plate carrier with a light chest
 *    patch, balaclava, gloves, boots, team-ID tape in the member's accent colour (Hadar: ballistic helmet; Yoav keeps his
 *    glasses). Geometry is cached per (kind, masked).
 *    rig: { kind, group, mesh, bones, height, outfit, shadow, pose, crew (id|null), masked, accent (hex|null),
 *           bag (duffel holder on the right hand: hero visible; crew rigs have it hidden -> rig.bag.visible = true),
 *           seatHeight (= SEAT_SURF * height: in 'sit'/'drive' the buttocks rest this far above the rig origin, so seat a
 *           rig with group.position = seat - (0, seatHeight, 0), facing the car's +z), steer (-1..1, read by 'drive'),
 *           setPose(name, t, k) }
 *    poses (t = time in s; k = blend/amount, default 1):
 *      idle, walk, run (k = speed blend), type, cheer, fall (k = progress), hidden,
 *      sit      car passenger: thighs forward, feet on a low car's floor, hands on the thighs, looking around
 *      drive    seated, hands on a wheel at 10-and-2 (wheel centre 0.9 m above / 0.45 m ahead of the rig origin, the
 *               lux car's steering wheel is placed there); set rig.steer first to turn the hands with the wheel
 *      kneel    right knee down, left foot planted; hands work ~0.58 m ahead at ~0.82 m (where to mount a charge)
 *      point    right arm out forward-right at chest height (k scales the little bob)
 *      lean     leaning back against a car (its side ~0.3 m behind the heels; face away from it), arms folded
 *      highfive right arm raised high (k: 0 = rest .. 1 = fully up; animate k for the slap; rig.reach = {x,y,z} in rig space aims the hand)
 *      carry    walk cycle hauling a heavy bag in the right hand (k = speed blend; show rig.bag)
 *      cover    duck and cover: on both knees, folded over, hands on the back of the head
 *  cashStack({ single }), cashBag({ color })  (chapter 2)
 *  bomb()            -> Group: ~0.5 m yellow-ochre canister lying along x, origin on the ground; .update(t, rate) blinks the
 *                       red LED (rate > 1 = faster); .dispose() frees its LED materials
 *  thermalCharge()   -> Group: flat strapped block with keypad, display and red LED; origin = centre of its back face, faces
 *                       +z (mount on a surface whose outward normal is +z); .update(t, rate), .dispose()
 *  gasCylinders()    -> Group: 6 white/red gas cylinders on a 1.6 x 1.0 m pallet with a hazard placard, origin on the
 *                       ground; .cylinders = 6 meshes (origin at their base, fling them), .pallet, .rack, .sign
 *  billBundle()      -> { geometry, material } for InstancedMesh: one banded bundle 0.156 x 0.02 x 0.066 m, centred
 *                       (shared - do not dispose)
 *  CREW ['yoav','hadar','ido'], ACCENT {id: hex}, BONES (bone index map), SEAT_SURF, CHANNELS (lamp channels) */
(function () {
  'use strict';

  let T = null, ENV = null, SRGB = true, GEN = 0; // GEN: bumped by every init() -> lazily built materials know they are stale
  const MAT = {}, GEO = {}, TEX = {};
  const CH = { HEAD: 0, TAIL: 1, REV: 2, SR1: 3, SB1: 4, SR2: 5, SB2: 6, AUX: 7 };

  // ---------------------------------------------------------------- small utils
  function rng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function C(hex) { const c = new T.Color(hex); if (SRGB) c.convertSRGBToLinear(); return c; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  // geometry -> non-indexed with a flat vertex colour and optional float attributes
  function prep(geo, color, extra) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
    if (color !== undefined && color !== null) {
      const c = (color && color.isColor) ? color : C(color);
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
    }
    if (extra) for (const k in extra) g.setAttribute(k, new T.BufferAttribute(new Float32Array(n).fill(extra[k]), 1));
    return g;
  }
  const _m = () => new T.Matrix4(), _e = () => new T.Euler(), _q = () => new T.Quaternion();
  // transform a geometry in place: p position, r euler [x,y,z], s scale (number or [x,y,z])
  function xf(g, p, r, s) {
    const m = _m(), q = _q();
    if (r) q.setFromEuler(_e().set(r[0] || 0, r[1] || 0, r[2] || 0));
    const sc = s === undefined ? [1, 1, 1] : (typeof s === 'number' ? [s, s, s] : s);
    m.compose(new T.Vector3(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), q, new T.Vector3(sc[0], sc[1], sc[2]));
    g.applyMatrix4(m);
    return g;
  }
  // merge non-indexed geometries (position, normal, uv, color + any custom float attrs)
  function merge(list) {
    list = list.filter(Boolean);
    let total = 0, hasCol = false; const ex = {};
    list.forEach((g) => {
      total += g.attributes.position.count;
      if (g.attributes.color) hasCol = true;
      for (const k in g.attributes) if (!/^(position|normal|uv|color)$/.test(k)) ex[k] = g.attributes[k].itemSize;
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const cl = hasCol ? new Float32Array(total * 3) : null, exa = {};
    for (const k in ex) exa[k] = new Float32Array(total * ex[k]);
    let o = 0;
    list.forEach((g) => {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
      nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
      if (cl) { if (g.attributes.color) cl.set(g.attributes.color.array.subarray(0, n * 3), o * 3); else cl.fill(1, o * 3, (o + n) * 3); }
      for (const k in ex) if (g.attributes[k]) exa[k].set(g.attributes[k].array.subarray(0, n * ex[k]), o * ex[k]);
      o += n;
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (cl) out.setAttribute('color', new T.BufferAttribute(cl, 3));
    for (const k in ex) out.setAttribute(k, new T.BufferAttribute(exa[k], ex[k]));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  // flat-shaded hexahedron from 8 corners [x,y,z]:
  // 0:(-x,-y,-z) 1:(+x,-y,-z) 2:(+x,+y,-z) 3:(-x,+y,-z) 4..7 same at +z.  skip: string of faces to omit (e.g. 'b' bottom)
  function hexa(c, color, skip, extra) {
    const F = { k: [0, 3, 2, 1], f: [4, 5, 6, 7], l: [0, 4, 7, 3], r: [1, 2, 6, 5], b: [0, 1, 5, 4], t: [3, 7, 6, 2] };
    const p = [];
    for (const key in F) {
      if (skip && skip.indexOf(key) >= 0) continue;
      const q = F[key];
      [q[0], q[1], q[2], q[0], q[2], q[3]].forEach((i) => p.push(c[i][0], c[i][1], c[i][2]));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(p), 3));
    g.computeVertexNormals();
    return prep(g, color, extra);
  }
  // axis-aligned box helper (centre, size) -> prepped
  function box(cx, cy, cz, sx, sy, sz, color, skip, extra) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    return hexa([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color, skip, extra);
  }
  function mirrorX(g) { // mirrored copy (fixes winding)
    const h = g.clone(); h.scale(-1, 1, 1);
    const p = h.attributes.position, n = h.attributes.normal, attrs = Object.keys(h.attributes);
    for (let i = 0; i < p.count; i += 3) { // swap vertex 1 and 2 of every triangle
      attrs.forEach((k) => {
        const a = h.attributes[k], s = a.itemSize, arr = a.array;
        for (let j = 0; j < s; j++) { const t = arr[(i + 1) * s + j]; arr[(i + 1) * s + j] = arr[(i + 2) * s + j]; arr[(i + 2) * s + j] = t; }
      });
    }
    n.needsUpdate = true;
    return h;
  }
  function both(g) { return [g, mirrorX(g)]; }

  // ---------------------------------------------------------------- loft surfaces
  // rows: array (along z) of arrays (around the right half, x >= 0, bottom-centre -> top-centre) of [x,y,z,Color]
  // returns non-indexed geometry for rows r0..r1 and cols c0..c1, mirrored to the left half when mirror !== false
  function loft(rows, r0, r1, c0, c1, mirror) {
    const nr = r1 - r0 + 1, nc = c1 - c0 + 1, half = nr * nc;
    const sides = mirror === false ? 1 : 2;
    const pos = new Float32Array(half * 3 * sides), col = new Float32Array(half * 3 * sides), idx = [];
    for (let s = 0; s < sides; s++) {
      const sx = s === 0 ? 1 : -1, base = s * half;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const p = rows[r0 + i][c0 + j], k = (base + i * nc + j) * 3;
        pos[k] = p[0] * sx; pos[k + 1] = p[1]; pos[k + 2] = p[2];
        col[k] = p[3].r; col[k + 1] = p[3].g; col[k + 2] = p[3].b;
      }
      for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
        const a = base + i * nc + j, b = a + 1, c = a + nc + 1, d = a + nc;
        if (s === 0) idx.push(a, b, c, a, c, d); else idx.push(a, d, c, a, c, b);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal; // keep the centre seam smooth
    for (let i = 0; i < n.count; i++) if (Math.abs(pos[i * 3]) < 1e-4) { n.setX(i, 0); const l = Math.hypot(n.getY(i), n.getZ(i)) || 1; n.setY(i, n.getY(i) / l); n.setZ(i, n.getZ(i) / l); }
    return prep(g);
  }
  // planar cap across one loft row (both halves); dir -1 faces -z, +1 faces +z
  function cap(row, dir, color) {
    const pts = row.map((p) => new T.Vector2(p[0], p[1]));
    const left = row.slice(1, row.length - 1).reverse().map((p) => new T.Vector2(-p[0], p[1]));
    const contour = pts.concat(left);
    const clean = []; contour.forEach((v) => { const l = clean[clean.length - 1]; if (!l || l.distanceTo(v) > 1e-4) clean.push(v); });
    if (clean.length > 2 && clean[0].distanceTo(clean[clean.length - 1]) < 1e-4) clean.pop();
    const tris = T.ShapeUtils.triangulateShape(clean, []);
    const z = row[0][2], p = [];
    tris.forEach((t) => {
      const o = dir > 0 ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
      o.forEach((i) => p.push(clean[i].x, clean[i].y, z));
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(p), 3));
    g.computeVertexNormals();
    // make sure it faces the requested way
    if (g.attributes.normal.count && g.attributes.normal.getZ(0) * dir < 0) flip(g);
    return prep(g, color);
  }
  function flip(g) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; } g.computeVertexNormals(); return g; }

  // ---------------------------------------------------------------- textures
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texFrom(cv, srgb) {
    const t = new T.CanvasTexture(cv);
    if (srgb !== false && SRGB) t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  // decal atlas: POLICE door text, plates, TAXI, checker strip, unit number
  const ATLAS = { police: [0, 0, 512, 128], plateHero: [0, 128, 128, 192], plate: [128, 128, 256, 192], taxi: [256, 128, 384, 192], checker: [0, 192, 512, 224], unit: [384, 128, 512, 192], badge: [0, 224, 512, 256] };
  function buildAtlas() {
    const cv = canvas(512, 256), g = cv.getContext('2d');
    g.clearRect(0, 0, 512, 256);
    // POLICE door decal: gold star shield + bold black lettering
    g.save();
    g.fillStyle = '#d8b04a'; g.strokeStyle = '#3a2a08'; g.lineWidth = 3;
    const sx = 64, sy = 64;
    g.beginPath();
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7, r = i % 2 ? 26 : 50; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1b2a5a'; g.beginPath(); g.arc(sx, sy, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8b04a'; g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MPD', sx, sy + 1);
    g.fillStyle = '#0b0b10'; g.font = '900 78px "Arial Black", Impact, Arial, sans-serif'; g.textAlign = 'left';
    g.fillText('POLICE', 128, 60);
    g.font = 'bold 22px Arial, sans-serif'; g.fillText('TO PROTECT AND SERVE', 132, 112);
    g.restore();
    // plates
    function plate(x, txt, top) {
      g.save();
      g.fillStyle = '#f4f1e6'; g.fillRect(x + 2, 130, 124, 60);
      g.strokeStyle = '#1f2f6b'; g.lineWidth = 4; g.strokeRect(x + 4, 132, 120, 56);
      g.fillStyle = '#ff7a3d'; g.beginPath(); g.arc(x + 64, 162, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1f6b3a'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillText(top, x + 64, 145);
      g.fillStyle = '#16245e'; g.font = 'bold 25px "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(txt, x + 64, 170);
      g.restore();
    }
    plate(0, 'BIG$CORE', 'SUNSHINE STATE');
    plate(128, 'VCE 285', 'SUNSHINE STATE');
    // TAXI sign
    g.save();
    g.fillStyle = '#111'; g.fillRect(260, 134, 120, 52);
    g.fillStyle = '#ffd23f'; g.font = '900 40px "Arial Black", Impact, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 320, 162);
    g.restore();
    // unit number for the police roof/trunk
    g.save(); g.fillStyle = '#0b0b10'; g.font = '900 54px "Arial Black", Impact, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('27', 448, 162); g.restore();
    // checker strip
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f3efe2'; g.fillRect(i * 16, 192 + j * 16, 16, 16); }
    // badge strip: small chrome-like "TR" style tail script (no brand) -> just a thin chrome bar with a red dot
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 236, 512, 6); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(256, 239, 6, 0, Math.PI * 2); g.fill();
    const t = texFrom(cv);
    t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  }
  // map a quad's uvs to an atlas rect (rect in pixel coords, origin top-left)
  function atlasUV(g, key, flipU) {
    const r = ATLAS[key], uv = g.attributes.uv, u0 = r[0] / 512, u1 = r[2] / 512, v0 = 1 - r[3] / 256, v1 = 1 - r[1] / 256;
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i); if (flipU) u = 1 - u;
      uv.setXY(i, lerp(u0, u1, u), lerp(v0, v1, uv.getY(i)));
    }
    return g;
  }
  // a decal quad: centre, size (w,h), facing axis ('x','-x','z','-z','y'), atlas key
  function decal(cx, cy, cz, w, h, face, key) {
    const g = new T.PlaneGeometry(w, h);
    let flipU = false;
    if (face === 'x') g.rotateY(Math.PI / 2);
    else if (face === '-x') g.rotateY(-Math.PI / 2);
    else if (face === '-z') g.rotateY(Math.PI);
    else if (face === 'y') g.rotateX(-Math.PI / 2);
    g.translate(cx, cy, cz);
    return atlasUV(prep(g), key, flipU);
  }
  // soft contact shadow (rounded rect)
  function buildShadowTex() {
    const cv = canvas(128, 128), g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return texFrom(cv, false);
  }
  function blobShadow(w, l, opacity) {
    const m = new T.Mesh(GEO.shadowPlane, MAT.shadow);
    m.scale.set(w, l, 1); m.position.y = 0.012; m.renderOrder = -1;
    m.name = 'shadow';
    if (opacity !== undefined && opacity !== 1) {
      const k = 'shadow' + opacity;
      if (!MAT[k]) { MAT[k] = MAT.shadow.clone(); MAT[k].opacity = opacity * MAT.shadow.opacity; }
      m.material = MAT[k];
    }
    return m;
  }

  // ---------------------------------------------------------------- shaders: lamp lenses + additive glows
  const LAMP_VS = [
    'attribute float chan;',
    'uniform float inten[8];',
    'varying vec3 vC;',
    '#include <fog_pars_vertex>',
    'void main(){',
    '  int ci = int(chan + 0.5); float k = 0.0;',
    '  for (int i = 0; i < 8; i++) { if (i == ci) k = inten[i]; }',
    '  vec3 c = color;',
    '  float lit = clamp(k, 0.0, 1.0);',
    '  vec3 n = normalize(normalMatrix * normal);',
    '  float shade = 0.55 + 0.45 * abs(n.z);',
    '  vC = c * (0.2 * shade + 0.95 * lit) + mix(c, vec3(1.0), 0.55) * max(k - 1.0, 0.0) * 0.9;',
    '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <fog_vertex>',
    '}'].join('\n');
  const LAMP_FS = [
    'varying vec3 vC;',
    '#include <fog_pars_fragment>',
    'void main(){',
    '  gl_FragColor = vec4(vC, 1.0);',
    '  #include <fog_fragment>',
    '  #include <encodings_fragment>',
    '}'].join('\n');
  const GLOW_VS = [
    'attribute vec2 corner; attribute float gsize; attribute vec3 gcolor; attribute float chan; attribute vec3 gdir;',
    'uniform float inten[8]; uniform float gscale;',
    'varying vec3 vCol; varying vec2 vUv;',
    '#include <fog_pars_vertex>',
    'void main(){',
    '  int ci = int(chan + 0.5); float k = 0.0;',
    '  for (int i = 0; i < 8; i++) { if (i == ci) k = inten[i]; }',
    '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
    '  vec3 vd = normalize(-mvPosition.xyz);',
    '  float facing = 1.0;',
    '  if (dot(gdir, gdir) > 0.01) { vec3 nd = normalize(normalMatrix * gdir); facing = smoothstep(-0.15, 0.55, dot(nd, vd)); }',
    '  float on = k > 0.003 ? 1.0 : 0.0;',
    '  float s = gsize * gscale * on * (0.45 + 0.55 * min(k, 1.0) + 0.25 * max(k - 1.0, 0.0)) * (0.35 + 0.65 * facing);',
    '  mvPosition.xyz += vd * 0.1;',
    '  mvPosition.xy += corner * s;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  vCol = gcolor * min(k, 1.6) * facing; vUv = corner;',
    '  #include <fog_vertex>',
    '}'].join('\n');
  const GLOW_FS = [
    'varying vec3 vCol; varying vec2 vUv;',
    '#include <fog_pars_fragment>',
    'void main(){',
    '  float d = length(vUv); if (d >= 1.0) discard;',
    '  float halo = pow(1.0 - d, 2.8) * 0.6;',
    '  float core = pow(max(0.0, 1.0 - d * 3.4), 2.0);',
    '  vec3 c = vCol * (halo + core * 1.1) + vec3(core) * 0.3 * min(length(vCol), 1.0);',
    '  #ifdef USE_FOG',
    '    #ifdef FOG_EXP2',
    '      float ff = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);',
    '    #else',
    '      float ff = smoothstep(fogNear, fogFar, fogDepth);',
    '    #endif',
    '    c *= 1.0 - ff * 0.85;',
    '  #endif',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <encodings_fragment>',
    '}'].join('\n');
  function lampMaterial() {
    return new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { inten: { value: [0, 0, 0, 0, 0, 0, 0, 0] } }]),
      vertexShader: LAMP_VS, fragmentShader: LAMP_FS, vertexColors: true, fog: true,
    });
  }
  function glowMaterial() {
    return new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { inten: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, gscale: { value: 1 } }]),
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false,
      blending: T.AdditiveBlending, fog: true, toneMapped: false,
    });
  }
  // glows: [{p:[x,y,z], c:hex, s:size, ch:channel, d:[dx,dy,dz] or null}]
  function glowGeo(list) {
    const n = list.length, P = new Float32Array(n * 12), K = new Float32Array(n * 8), S = new Float32Array(n * 4),
      Cc = new Float32Array(n * 12), H = new Float32Array(n * 4), D = new Float32Array(n * 12), I = [];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    let maxS = 0;
    list.forEach((gl, i) => {
      const c = C(gl.c), d = gl.d || [0, 0, 0];
      maxS = Math.max(maxS, gl.s);
      for (let v = 0; v < 4; v++) {
        const o = i * 4 + v;
        P.set(gl.p, o * 3); K.set(corners[v], o * 2); S[o] = gl.s; Cc.set([c.r, c.g, c.b], o * 3); H[o] = gl.ch; D.set(d, o * 3);
      }
      I.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3));
    g.setAttribute('corner', new T.BufferAttribute(K, 2));
    g.setAttribute('gsize', new T.BufferAttribute(S, 1));
    g.setAttribute('gcolor', new T.BufferAttribute(Cc, 3));
    g.setAttribute('chan', new T.BufferAttribute(H, 1));
    g.setAttribute('gdir', new T.BufferAttribute(D, 3));
    g.setIndex(I);
    g.computeBoundingSphere();
    g.boundingSphere.radius += maxS * 1.5;
    return g;
  }

  // ================================================================= init
  function init(THREE, opts) {
    T = THREE; opts = opts || {};
    ENV = opts.envMap || null; SRGB = !opts.linearOutput;
    if (!TEX.atlas) { TEX.atlas = buildAtlas(); TEX.shadow = buildShadowTex(); }
    const envI = ENV ? 1 : 0;
    MAT.trim = lumSplit(new T.MeshStandardMaterial({ vertexColors: true, metalness: ENV ? 0.6 : 0.2, roughness: 0.3, envMap: ENV, envMapIntensity: 1 }), 0.5, 0.0);
    MAT.glass = new T.MeshStandardMaterial({ color: C(ENV ? 0x0c111c : 0x1a2233), metalness: ENV ? 0.9 : 0.3, roughness: 0.05, envMap: ENV, envMapIntensity: 1.5 });
    MAT.wheel = lumSplit(new T.MeshStandardMaterial({ vertexColors: true, metalness: ENV ? 0.75 : 0.3, roughness: 0.28, envMap: ENV, envMapIntensity: 1.2 }), 0.82, 0.0);
    MAT.decal = new T.MeshStandardMaterial({ map: TEX.atlas, transparent: true, alphaTest: 0.3, roughness: 0.45, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMap: ENV, envMapIntensity: 0.4 * envI });
    MAT.shadow = new T.MeshBasicMaterial({ color: 0x000000, map: TEX.shadow, transparent: true, depthWrite: false, opacity: 0.8 });
    MAT.person = new T.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.72, metalness: 0.0, envMap: ENV, envMapIntensity: 0.35 });
    MAT.bag = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, envMap: ENV, envMapIntensity: 0.6 });
    // chapter 3: see-through tinted glass (the crew is visible inside the lux car), cabin trim, props
    MAT.glassClear = new T.MeshStandardMaterial({ color: C(0x0b0e14), metalness: ENV ? 0.55 : 0.2, roughness: 0.04, envMap: ENV, envMapIntensity: 1.5, transparent: true, opacity: 0.56, depthWrite: false });
    MAT.cabin = new T.MeshStandardMaterial({ color: C(0x9a9a9a), vertexColors: true, roughness: 0.7, metalness: 0.05, envMap: ENV, envMapIntensity: 0.25 }); // shaded by the roof
    MAT.prop = lumSplit(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: ENV ? 0.35 : 0.15, envMap: ENV, envMapIntensity: 0.6 }), 0.8, 0.0);
    MAT.wood = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
    GEN++;
    GEO.shadowPlane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    HModels.ready = true;
    return HModels;
  }
  // dark vertex colours (tyres, rubber, black plastic) get their own roughness/metalness -> one draw call, two looks
  function lumSplit(mat, darkRough, darkMetal) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', [
        '#include <metalnessmap_fragment>',
        '#ifdef USE_COLOR',
        '  float lumV = dot(vColor.rgb, vec3(0.3333));',
        '  float darkK = 1.0 - smoothstep(0.006, 0.02, lumV);',
        '  roughnessFactor = mix(roughnessFactor, ' + darkRough.toFixed(3) + ', darkK);',
        '  metalnessFactor = mix(metalnessFactor, ' + darkMetal.toFixed(3) + ', darkK);',
        '#endif'].join('\n'));
    };
    mat.customProgramCacheKey = () => 'lumsplit' + darkRough + '_' + darkMetal;
    return mat;
  }
  function paintMaterial(hex, hero) {
    const base = {
      color: C(hex), vertexColors: true, envMap: ENV,
      metalness: ENV ? (hero ? 0.3 : 0.25) : 0.1, roughness: ENV ? (hero ? 0.3 : 0.36) : 0.45, envMapIntensity: 0.9,
    };
    if (hero && T.MeshPhysicalMaterial) {
      const m = new T.MeshPhysicalMaterial(Object.assign(base, { clearcoat: 1, clearcoatRoughness: 0.06 }));
      return m;
    }
    return new T.MeshStandardMaterial(base);
  }

  // ================================================================= wheels
  // one merged mesh per wheel; outer face at +x (right-side wheels are mirrored with scale.x = -1)
  function wheelGeo(r, w, style) {
    const key = 'wheel_' + r.toFixed(3) + '_' + w.toFixed(3) + '_' + style;
    if (GEO[key]) return GEO[key];
    if (style === 'lux') return (GEO[key] = luxWheelGeo(r, w));
    const rr = r * (style === 'sport' ? 0.7 : 0.62), hw = w / 2, parts = [];
    const prof = [[rr, hw], [r - 0.03, hw], [r, hw - 0.04], [r, -hw + 0.04], [r - 0.03, -hw], [rr, -hw]].map((p) => new T.Vector2(p[0], p[1]));
    const tire = new T.LatheGeometry(prof, 12);
    tire.rotateZ(-Math.PI / 2);
    parts.push(prep(tire, 0x09090a));
    const silver = style === 'steel' ? 0x9aa0a8 : style === 'police' ? 0x1b1c20 : 0xd5d8de;
    const dish = new T.CircleGeometry(rr * 0.98, 12); dish.rotateY(Math.PI / 2); dish.translate(hw - 0.045, 0, 0);
    parts.push(prep(dish, style === 'sport' ? 0x101114 : 0x2a2c31));
    const lip = new T.RingGeometry(rr * 0.86, rr, 12, 1); lip.rotateY(Math.PI / 2); lip.translate(hw - 0.012, 0, 0);
    parts.push(prep(lip, style === 'police' ? 0x8e939b : silver));
    const nSp = style === 'steel' ? 0 : 5;
    for (let i = 0; i < nSp; i++) {
      const a = i * Math.PI * 2 / nSp, x0 = hw - 0.045, x1 = hw - 0.016;
      const r0 = 0.05, r1 = rr * 0.9, w0 = 0.032, w1 = style === 'sport' ? 0.022 : 0.028;
      const P = (x, rad, t) => [x, Math.cos(a) * rad + Math.sin(a) * t, Math.sin(a) * rad - Math.cos(a) * t];
      // corners: -x/+x = inner/outer face ; -y/+y spans the tangential width ; -z/+z = hub / rim end
      parts.push(hexa([P(x0, r0, -w0), P(x1, r0, -w0), P(x1, r0, w0), P(x0, r0, w0), P(x0, r1, -w1), P(x1, r1, -w1), P(x1, r1, w1), P(x0, r1, w1)].map((c) => c), silver, 'lk'));
    }
    if (style === 'steel') { // steel wheel: hubcap disc with slots
      const hc = new T.CylinderGeometry(rr * 0.7, rr * 0.78, 0.03, 12, 1); hc.rotateZ(-Math.PI / 2); hc.translate(hw - 0.03, 0, 0);
      parts.push(prep(hc, silver));
    }
    const hub = new T.CylinderGeometry(0.055, 0.07, 0.04, 6, 1); hub.rotateZ(-Math.PI / 2); hub.translate(hw - 0.012, 0, 0);
    parts.push(prep(hub, style === 'police' ? 0x9aa0a8 : silver));
    const g = merge(parts);
    GEO[key] = g;
    return g;
  }

  // big low-profile rim: 16 slim gunmetal spokes in front of a brake disc (the red caliper is a separate,
  // non-spinning mesh on the pivot, see caliperGeo). Outer face at +x like wheelGeo.
  function luxWheelGeo(r, w) {
    const rr = r * 0.75, hw = w / 2, parts = [];
    const prof = [[rr, hw - 0.006], [r - 0.028, hw], [r, hw - 0.035], [r, -hw + 0.035], [r - 0.028, -hw], [rr, -hw + 0.006]].map((p) => new T.Vector2(p[0], p[1]));
    const tire = new T.LatheGeometry(prof, 14); tire.rotateZ(-Math.PI / 2);
    parts.push(prep(tire, 0x09090a));
    // barrel (dark, so the gap between rim and disc never shows daylight), deep dish, disc
    parts.push(cyl(rr * 0.985, rr * 0.985, w - 0.02, 14, 'x', 0, 0, 0, 0x15161a, true));
    const dish = new T.CircleGeometry(rr * 0.97, 14); dish.rotateY(Math.PI / 2); dish.translate(-hw + 0.03, 0, 0);
    parts.push(prep(dish, 0x0b0b0d));
    const disc = new T.RingGeometry(0.07, rr * 0.8, 16, 1); disc.rotateY(Math.PI / 2); disc.translate(hw - 0.115, 0, 0);
    parts.push(prep(disc, 0x6d7076));
    const hat = new T.CircleGeometry(0.075, 10); hat.rotateY(Math.PI / 2); hat.translate(hw - 0.113, 0, 0);
    parts.push(prep(hat, 0x2a2c30));
    // polished lip + dark gunmetal spokes
    const lip = new T.RingGeometry(rr * 0.9, rr * 1.0, 16, 1); lip.rotateY(Math.PI / 2); lip.translate(hw - 0.006, 0, 0);
    parts.push(prep(lip, 0xb4b8bf));
    const nSp = 16, gun = 0x3a3d43;
    for (let i = 0; i < nSp; i++) {
      const a = (i + 0.5) * Math.PI * 2 / nSp, x0 = hw - 0.05, x1 = hw - 0.02, xh = hw - 0.012;
      const r0 = 0.062, r1 = rr * 0.93, w0 = 0.013, w1 = 0.0085;
      const P = (x, rad, t) => [x, Math.cos(a) * rad + Math.sin(a) * t, Math.sin(a) * rad - Math.cos(a) * t];
      // concave: the hub end sits proud (xh), the rim end is set back (x1)
      parts.push(hexa([P(x0 + 0.02, r0, -w0), P(xh, r0, -w0), P(xh, r0, w0), P(x0 + 0.02, r0, w0),
        P(x0, r1, -w1), P(x1, r1, -w1), P(x1, r1, w1), P(x0, r1, w1)], gun, 'lk'));
    }
    const hub = cyl(0.068, 0.075, 0.03, 10, 'x', hw - 0.018, 0, 0, 0x2c2f34);
    parts.push(hub);
    const capC = new T.CircleGeometry(0.03, 10); capC.rotateY(Math.PI / 2); capC.translate(hw - 0.002, 0, 0);
    parts.push(prep(capC, 0xc9ccd2));
    for (let i = 0; i < 5; i++) { // lug nuts
      const a = i * Math.PI * 2 / 5;
      parts.push(cyl(0.009, 0.009, 0.012, 6, 'x', hw - 0.004, Math.cos(a) * 0.048, Math.sin(a) * 0.048, 0x8d9097));
    }
    return merge(parts);
  }
  function caliperGeo(r, w, color) {
    const key = 'caliper_' + r.toFixed(3) + '_' + w.toFixed(3) + '_' + color;
    if (GEO[key]) return GEO[key];
    const rr = r * 0.75, hw = w / 2, parts = [];
    // a fat arc hugging the top-rear of the disc, behind the spokes
    const a0 = Math.PI * 0.58, a1 = Math.PI * 0.86, n = 4, ri = rr * 0.6, ro = rr * 0.86, xa = hw - 0.105, xb = hw - 0.058;
    for (let i = 0; i < n; i++) {
      const p = (a, rad, x) => [x, Math.sin(a) * rad, Math.cos(a) * rad];
      const u = lerp(a0, a1, i / n), v = lerp(a0, a1, (i + 1) / n);
      // (x, radial, -angle) is right-handed, so the corner set at the larger angle comes first
      parts.push(hexa([p(v, ri, xa), p(v, ri, xb), p(v, ro, xb), p(v, ro, xa), p(u, ri, xa), p(u, ri, xb), p(u, ro, xb), p(u, ro, xa)], color));
    }
    const g = merge(parts);
    GEO[key] = g; return g;
  }
  // steering wheel: rim (torus in the local xy plane), hub and three spokes; the axis is local +z
  function steeringGeo(R) {
    const key = 'steer_' + R.toFixed(3);
    if (GEO[key]) return GEO[key];
    const parts = [], black = 0x141416, metal = 0x8c9096;
    const rim = new T.TorusGeometry(R, 0.017, 5, 18); parts.push(prep(rim, black));
    parts.push(cyl(0.055, 0.06, 0.05, 10, 'z', 0, 0, 0.01, black));
    parts.push(box(0, 0, -0.018, 0.04, 0.03, 0.006, metal));
    [[-1, 0], [1, 0], [0, -1]].forEach((d) => {
      const L = R - 0.05, cx = d[0] * (0.05 + L / 2), cy = d[1] * (0.05 + L / 2);
      parts.push(box(cx, cy, 0.006, d[0] ? L : 0.035, d[1] ? L : 0.022, 0.014, 0x1c1d20));
    });
    parts.push(cyl(0.025, 0.03, 0.3, 8, 'z', 0, 0, 0.17, 0x0f0f11)); // column into the dash
    const g = merge(parts); GEO[key] = g; return g;
  }

  // ================================================================= car body (lofted)
  // spec.st: rows rear->front [z, yb, hw, ysh, ytop]; spec.cab: rows rear->front [z, yBelt, hwBelt, hwRoof, yRoof]
  function stAt(st, z) {
    if (z <= st[0][0]) return st[0].slice(1);
    for (let i = 1; i < st.length; i++) if (z <= st[i][0]) {
      const a = st[i - 1], b = st[i], t = (z - a[0]) / (b[0] - a[0] || 1);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t)];
    }
    return st[st.length - 1].slice(1);
  }
  function hwAt(spec, z) { return stAt(spec.st, z)[1]; }
  // y of the upper body surface at (z, x)
  function topY(spec, z, x) {
    const s = stAt(spec.st, z), hw = s[1], ysh = s[2], ytop = s[3];
    const pts = [[0, ytop], [hw * 0.8, ysh + (ytop - ysh) * 0.82], [hw - 0.03, ysh], [hw, ysh - 0.05]];
    x = Math.abs(x);
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
    return ysh - 0.05;
  }
  function bodyRows(spec) {
    const R = spec.archR, yc = spec.wr, list = [];
    spec.st.forEach((s) => list.push({ z: s[0], o: 0.5 }));
    spec.axles.forEach((za) => {
      list.push({ z: za - R, o: 0, ya: -1 }, { z: za - R, o: 1, ya: yc });
      list.push({ z: za + R, o: 0, ya: yc }, { z: za + R, o: 1, ya: -1 });
      for (let k = 1; k < 4; k++) { const a = Math.PI - k * Math.PI / 4; list.push({ z: za + R * Math.cos(a), o: 0.5, ya: yc + R * Math.sin(a) }); }
    });
    (spec.splits || []).forEach((z) => { list.push({ z: z, o: 0.2, cz: z - 1e-3 }, { z: z, o: 0.8, cz: z + 1e-3 }); });
    list.sort((a, b) => (a.z - b.z) || (a.o - b.o));
    // drop key stations that fall inside an arch (the arch samples define the shape there)
    const rows = [];
    const dark = C(0x060608), white = new T.Color(1, 1, 1);
    const colAt = (z, part) => { const h = spec.colorFn ? spec.colorFn(z, part) : null; return h === null || h === undefined ? white : C(h); };
    list.forEach((it) => {
      const z = it.z, s = stAt(spec.st, z), yb = s[0], hw = s[1], ysh = s[2], ytop = s[3];
      let ya = it.ya;
      if (ya === undefined) { // generic row: inside an arch?
        ya = -1;
        spec.axles.forEach((za) => { const d = Math.abs(z - za); if (d < R - 1e-4) ya = yc + Math.sqrt(R * R - d * d); });
      }
      const inArch = ya > 0;
      const y1 = inArch ? Math.min(ya, ysh - 0.05) : yb;
      const hwIn = Math.max(0.25, hw - 0.34), lip = inArch ? hw - 0.005 : hw - 0.055;
      const cz = it.cz !== undefined ? it.cz : z, cs = colAt(cz, 'side'), ct = colAt(cz, 'top');
      // side heights are pinned to the nominal (non-arch) profile so the panels stay smooth around the arches
      const nSpan = ysh - yb;
      const yRock = Math.max(yb + Math.min(0.09, nSpan * 0.28), y1 + 0.008);
      const yMid = Math.min(Math.max(yb + nSpan * 0.72, yRock + 0.01), ysh - 0.012);
      const pts = [
        [0, yb, dark], [hwIn, yb, dark], [hwIn, y1, dark], [lip, y1, dark],
        [lip, y1, cs], [inArch ? hw - 0.003 : hw - 0.006, yRock, cs], [hw, yMid, cs], [hw - 0.028, ysh, cs],
      ];
      if (spec.twoTone) pts.push([hw - 0.028, ysh, ct]);
      pts.push([hw * 0.8, ysh + (ytop - ysh) * 0.82, ct], [0, ytop, ct]);
      rows.push(pts.map((p) => [p[0], p[1], z, p[2]]));
    });
    return rows;
  }
  function cabRows(spec) {
    const white = new T.Color(1, 1, 1), rows = [];
    spec.cab.forEach((c) => {
      const z = c[0], yB = c[1], hB = c[2], hR = c[3], yR = c[4], col = spec.roofColor ? C(spec.roofColor) : white;
      const k = spec.tumble === undefined ? 0.55 : spec.tumble;
      rows.push([
        [hB, yB, z, col], [lerp(hB, hR, k), lerp(yB, yR, 0.62), z, col], [hR, yR - 0.035, z, col],
        [hR * 0.62, yR - 0.004, z, col], [0, yR, z, col],
      ]);
    });
    return rows;
  }
  // build paint/glass geometry for the body + greenhouse
  function shell(spec) {
    const rows = bodyRows(spec), n = rows.length, nc = rows[0].length;
    const paint = [loft(rows, 0, n - 1, 0, nc - 1)];
    paint.push(cap(rows[0], -1), cap(rows[n - 1], 1));
    const glass = [];
    if (spec.cab) {
      const cr = cabRows(spec), m = cr.length, rg = spec.rearGlassRows || 1; // rg > 1: a curved fastback rear window
      glass.push(loft(cr, 0, rg, 0, 4));                // rear window
      glass.push(loft(cr, m - 2, m - 1, 0, 4));         // windshield
      if (m > 2 + rg) {
        glass.push(loft(cr, rg, m - 2, 0, 2));          // side windows
        paint.push(loft(cr, rg, m - 2, 2, 4));          // roof
      }
      // pillars: thin strips along the A pillar edge (and C pillar) so the glass reads as framed
      const pil = (a, b, w, colr) => {
        const d = 0.012;
        return hexa([[a[0] - w, a[1], a[2]], [a[0] + d, a[1], a[2]], [a[0] + d, a[1] + d, a[2]], [a[0] - w, a[1] + d, a[2]],
          [b[0] - w, b[1], b[2]], [b[0] + d, b[1], b[2]], [b[0] + d, b[1] + d, b[2]], [b[0] - w, b[1] + d, b[2]]], colr, 'b');
      };
      const wsA = cr[m - 1][0], wsB = cr[m - 2][2], rwA = cr[0][0], rwB = cr[1][2];
      const pc = spec.pillarColor === undefined ? null : spec.pillarColor;
      both(pil([wsA[0], wsA[1], wsA[2]], [wsB[0], wsB[1], wsB[2]], 0.06, pc)).forEach((g) => paint.push(g));
      if (spec.cPillar !== false && rg === 1) both(pil([rwA[0], rwA[1], rwA[2]], [rwB[0], rwB[1], rwB[2]], 0.08, pc)).forEach((g) => paint.push(g));
      else if (spec.cPillar !== false) for (let i = 0; i < rg; i++) { // follow the curved C seam segment by segment
        const p0 = i === 0 ? cr[0][0] : cr[i][2], p1 = cr[i + 1][2], w = spec.cPillarW || 0.08;
        both(pil([p0[0], p0[1], p0[2]], [p1[0], p1[1], p1[2]], w, pc)).forEach((g) => paint.push(g));
      }
      if (spec.bPillar !== undefined) { // B pillar: vertical strip over the side glass
        const z = spec.bPillar;
        const i = Math.max(1, cr.findIndex((r) => r[0][2] >= z));
        const r0 = cr[i - 1], r1 = cr[i], t = (z - r0[0][2]) / ((r1[0][2] - r0[0][2]) || 1);
        const lo = r0[0].map((v, k) => k < 3 ? lerp(v, r1[0][k], t) : v), hi = r0[2].map((v, k) => k < 3 ? lerp(v, r1[2][k], t) : v);
        both(hexa([[lo[0] - 0.02, lo[1], z - 0.05], [lo[0] + 0.006, lo[1], z - 0.05], [hi[0] + 0.006, hi[1], z - 0.05], [hi[0] - 0.02, hi[1], z - 0.05],
          [lo[0] - 0.02, lo[1], z + 0.05], [lo[0] + 0.006, lo[1], z + 0.05], [hi[0] + 0.006, hi[1], z + 0.05], [hi[0] - 0.02, hi[1], z + 0.05]], 0x0a0a0c, 'lbt')).forEach((g) => paint.push(g));
      }
    }
    return { paint: paint, glass: glass, rows: rows };
  }

  // ================================================================= rig assembly
  function assemble(kind, spec, G, color) {
    const group = new T.Group(); group.name = 'car-' + kind;
    const body = new T.Group(); body.name = 'body'; group.add(body);
    const paint = paintMaterial(color, kind === 'sports' || kind === 'lux');
    if (kind === 'lux' && ENV) { paint.roughness = 0.26; paint.metalness = 0.22; paint.envMapIntensity = 0.7; } // deep black lacquer: the clearcoat carries the reflections
    const add = (geo, mat, name) => {
      if (!geo) return null;
      const m = new T.Mesh(geo, mat); m.name = name; m.castShadow = false; m.receiveShadow = false; body.add(m); return m;
    };
    add(G.paint, paint, 'paint');
    add(G.trim, MAT.trim, 'trim');
    add(G.cabin, MAT.cabin, 'cabin');
    const glassMesh = add(G.glass, spec.clearGlass ? MAT.glassClear : MAT.glass, 'glass');
    if (spec.clearGlass && glassMesh) glassMesh.renderOrder = 2;
    add(G.decal, MAT.decal, 'decal');
    const lampMat = lampMaterial(), glowMat = glowMaterial();
    add(G.lamp, lampMat, 'lamps');
    const glow = add(G.glow, glowMat, 'glow'); glow.renderOrder = 5;
    // wheels
    const wheels = [];
    const defs = [[spec.track[0] / 2, spec.axles[1], spec.ww[0]], [-spec.track[0] / 2, spec.axles[1], spec.ww[0]],
      [spec.track[1] / 2, spec.axles[0], spec.ww[1]], [-spec.track[1] / 2, spec.axles[0], spec.ww[1]]];
    defs.forEach((d, i) => {
      const pivot = new T.Object3D(); pivot.position.set(d[0], spec.wr, d[1]); pivot.name = ['fl', 'fr', 'rl', 'rr'][i];
      const spin = new T.Object3D(); pivot.add(spin);
      const wm = new T.Mesh(wheelGeo(spec.wr, d[2], spec.wheelStyle || 'sport'), MAT.wheel);
      if (d[0] < 0) wm.scale.x = -1;
      spin.add(wm); group.add(pivot);
      if (spec.caliper) { // brake caliper: steers with the wheel but does not spin
        const cm = new T.Mesh(caliperGeo(spec.wr, d[2], spec.caliper), MAT.wheel); cm.name = 'caliper';
        if (d[0] < 0) cm.scale.x = -1;
        pivot.add(cm);
      }
      wheels.push({ pivot: pivot, spin: spin, mesh: wm });
    });
    // steering wheel (cars with a modelled cabin): rig.setSteer(a) turns it
    let steerWheel = null;
    if (spec.steeringWheel) {
      const sw = spec.steeringWheel;
      steerWheel = new T.Object3D(); steerWheel.name = 'steeringWheel';
      steerWheel.position.set(sw.p[0], sw.p[1], sw.p[2]); steerWheel.rotation.x = sw.tilt;
      const spinW = new T.Mesh(steeringGeo(sw.r), MAT.cabin); spinW.name = 'wheelRim';
      steerWheel.add(spinW); body.add(steerWheel);
      steerWheel.userData.rim = spinW;
    }
    // contact shadow
    const sh = blobShadow(spec.W + 0.55, spec.L + 0.7); group.add(sh);
    const meshes = {}; body.children.forEach((c) => { meshes[c.name] = c; });
    const inten = lampMat.uniforms.inten.value, ginten = glowMat.uniforms.inten.value;
    const st = { lights: false, brake: false, rev: false, siren: -1 };
    const base = paint.color.clone(), dirt = C(0x3b3329);
    const baseRough = paint.roughness, baseMetal = paint.metalness;
    const sync = () => {
      const head = st.lights ? 1 : 0, tail = (st.lights ? 0.55 : 0) + (st.brake ? 0.95 : 0);
      inten[CH.HEAD] = ginten[CH.HEAD] = head;
      inten[CH.TAIL] = ginten[CH.TAIL] = tail;
      inten[CH.REV] = ginten[CH.REV] = st.rev ? 1 : 0;
      inten[CH.AUX] = ginten[CH.AUX] = st.lights ? 1 : 0;
    };
    const rig = {
      kind: kind, group: group, body: body, wheels: wheels, paint: paint, lampMaterial: lampMat, glowMaterial: glowMat, shadow: sh, meshes: meshes,
      dims: { length: spec.L, width: spec.W, height: spec.H, wheelBase: spec.axles[1] - spec.axles[0], track: spec.track[0], trackRear: spec.track[1], wheelRadius: spec.wr },
      door: { x: spec.W / 2 + 0.55, z: spec.doorZ },
      seats: spec.seats || null,
      steeringWheel: steerWheel,
      // a: steering amount (-1 full left .. 1 full right) -> the modelled steering wheel turns (no-op without a cabin)
      setSteer(a) { if (steerWheel) steerWheel.userData.rim.rotation.z = clamp(a || 0, -1.2, 1.2) * 2.2; return rig; },
      setLights(on) { st.lights = !!on; sync(); return rig; },
      setBrake(on) { st.brake = !!on; sync(); return rig; },
      setReverse(on) { st.rev = !!on; sync(); return rig; },
      setSiren(t) {
        if (kind !== 'police') return rig;
        if (t === undefined || t < 0) { inten[3] = inten[4] = inten[5] = inten[6] = 0; ginten[3] = ginten[4] = ginten[5] = ginten[6] = 0; return rig; }
        const p = (t % 0.9) / 0.9;
        const dbl = (x) => ((x < 0.16 || (x > 0.26 && x < 0.42)) ? 1 : 0);
        const a = p < 0.5 ? dbl(p * 2) : 0.06, b = p >= 0.5 ? dbl(p * 2 - 1) : 0.06;
        const f = (t * 3.3) % 1, c = f < 0.5 ? 1 : 0.06, d = f < 0.5 ? 0.06 : 1;
        inten[3] = a; inten[4] = b; inten[5] = c; inten[6] = d;
        ginten[3] = a * 1.25; ginten[4] = b * 1.4; ginten[5] = c; ginten[6] = d * 1.15;
        return rig;
      },
      setDamage(dmg) {
        dmg = clamp(dmg || 0, 0, 1);
        paint.color.copy(base).lerp(dirt, dmg * 0.55).multiplyScalar(1 - dmg * 0.35);
        paint.roughness = lerp(baseRough, 0.75, dmg); paint.metalness = lerp(baseMetal, 0.1, dmg);
        if (paint.clearcoat !== undefined) paint.clearcoat = 1 - dmg * 0.8;
        return rig;
      },
      setColor(hex) { base.copy(C(hex)); paint.color.copy(base); return rig; },
      // geometry is shared between cars of the same kind: dispose only this car's own materials
      dispose() { paint.dispose(); lampMat.dispose(); glowMat.dispose(); },
    };
    sync();
    return rig;
  }

  // ================================================================= car kinds
  function kit() { return { paint: [], trim: [], glass: [], lamp: [], decal: [], glows: [], cabin: [] }; }
  function push2(arr, g) { arr.push(g, mirrorX(g)); }
  function lens(P, cx, cy, cz, sx, sy, sz, hex, ch, mirror) {
    const g = box(cx, cy, cz, sx, sy, sz, hex, 'b', { chan: ch });
    if (mirror === false) P.lamp.push(g); else push2(P.lamp, g);
  }
  function glow2(P, x, y, z, hex, s, ch, d, mirror) {
    P.glows.push({ p: [x, y, z], c: hex, s: s, ch: ch, d: d });
    if (mirror !== false && x !== 0) P.glows.push({ p: [-x, y, z], c: hex, s: s, ch: ch, d: d });
  }
  // a hexa that hugs the body side between z0..z1 (outward offset o0..o1 from the local half-width)
  function sideStrip(spec, z0, z1, y0, y1, o0, o1, color, extra) {
    const h0 = hwAt(spec, z0), h1 = hwAt(spec, z1);
    return hexa([[h0 + o0, y0, z0], [h0 + o1, y0, z0], [h0 + o1, y1, z0], [h0 + o0, y1, z0],
      [h1 + o0, y0, z1], [h1 + o1, y0, z1], [h1 + o1, y1, z1], [h1 + o0, y1, z1]], color, 'l', extra);
  }
  // thin line lying on the upper body surface from (x0,z0) to (x1,z1)
  function surfLine(spec, x0, z0, x1, z1, w, color) {
    const y0 = topY(spec, z0, x0) + 0.004, y1 = topY(spec, z1, x1) + 0.004, h = 0.004;
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
    return hexa([[x0 - nx, y0 - h, z0 - nz], [x0 + nx, y0 - h, z0 + nz], [x0 + nx, y0 + h, z0 + nz], [x0 - nx, y0 + h, z0 - nz],
      [x1 - nx, y1 - h, z1 - nz], [x1 + nx, y1 - h, z1 + nz], [x1 + nx, y1 + h, z1 + nz], [x1 - nx, y1 + h, z1 - nz]], color, 'b');
  }
  function cyl(rt, rb, h, seg, axis, cx, cy, cz, color, open) {
    const g = new T.CylinderGeometry(rt, rb, h, seg, 1, !!open);
    if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(-Math.PI / 2);
    g.translate(cx, cy, cz);
    return prep(g, color);
  }

  // ---- the hero: red 1980s Italian wedge supercar
  function specSports() {
    return {
      L: 4.49, W: 1.976, H: 1.13, wr: 0.315, ww: [0.235, 0.29], track: [1.52, 1.64], axles: [-1.29, 1.26], archR: 0.375,
      wheelStyle: 'sport', doorZ: 0.05,
      seats: { driver: [0.36, 0.28, -0.12], passenger: [-0.36, 0.28, -0.12] },
      st: [
        [-2.245, 0.27, 0.95, 0.90, 0.93], [-2.19, 0.2, 0.975, 0.925, 0.952], [-1.95, 0.17, 0.988, 0.935, 0.962],
        [-0.85, 0.16, 0.988, 0.93, 0.965], [-0.62, 0.155, 0.976, 0.905, 0.955], [-0.3, 0.15, 0.962, 0.866, 0.872],
        [0.5, 0.15, 0.942, 0.836, 0.846], [0.8, 0.155, 0.932, 0.79, 0.81], [1.8, 0.175, 0.9, 0.67, 0.695],
        [2.08, 0.21, 0.845, 0.596, 0.616], [2.2, 0.25, 0.77, 0.536, 0.556], [2.245, 0.29, 0.68, 0.49, 0.505],
      ],
      cab: [[-0.66, 0.955, 0.56, 0.56, 0.958], [-0.52, 0.876, 0.80, 0.585, 1.125], [0.02, 0.863, 0.80, 0.60, 1.13], [0.56, 0.842, 0.80, 0.80, 0.846]],
      cPillar: false, tumble: 0.5,
    };
  }
  function buildSports(P, spec) {
    const red = null, black = 0x060607, satin = 0x0e0e10;
    // flying buttresses (sails) from the roof back to the tail
    push2(P.paint, hexa([
      [0.70, 0.952, -1.80], [0.95, 0.928, -1.80], [0.94, 0.948, -1.80], [0.71, 0.972, -1.80],
      [0.545, 0.945, -0.5], [0.83, 0.88, -0.5], [0.66, 1.118, -0.5], [0.575, 1.123, -0.5]], red, 'b'));
    // louvred engine cover: dark well + body-coloured slats
    const zA = -2.02, zB = -0.72;
    P.trim.push(hexa([[-0.6, 0.95, zA], [0.6, 0.95, zA], [0.6, 0.976, zA], [-0.6, 0.976, zA],
      [-0.55, 0.95, zB], [0.55, 0.95, zB], [0.55, 0.976, zB], [-0.55, 0.976, zB]], black, 'b'));
    for (let i = 0; i < 9; i++) {
      const z = zA + 0.08 + i * 0.142, w = lerp(0.6, 0.55, (z - zA) / (zB - zA)) - 0.03;
      P.paint.push(hexa([[-w, 0.972, z - 0.03], [w, 0.972, z - 0.03], [w, 0.992, z - 0.012], [-w, 0.992, z - 0.012],
        [-w, 0.972, z + 0.03], [w, 0.972, z + 0.03], [w, 0.992, z + 0.03], [-w, 0.992, z + 0.03]], red, 'b'));
    }
    // rear: full-width louvred black grille with the tail lamps glowing through it
    const zr = -2.245;
    P.trim.push(box(0, 0.678, zr - 0.004, 1.84, 0.25, 0.012, black, 'f'));
    lens(P, 0.645, 0.678, zr - 0.012, 0.46, 0.19, 0.01, 0xff1a1a, CH.TAIL);
    lens(P, 0.35, 0.678, zr - 0.012, 0.11, 0.12, 0.01, 0xf2f2f2, CH.REV);
    for (let i = 0; i < 6; i++) P.trim.push(box(0, 0.575 + i * 0.041, zr - 0.026, 1.86, 0.016, 0.03, satin, 'f'));
    P.trim.push(box(0, 0.805, zr - 0.012, 1.86, 0.012, 0.03, satin));
    P.trim.push(box(0, 0.552, zr - 0.012, 1.86, 0.012, 0.03, satin));
    P.decal.push(decal(0, 0.41, zr - 0.006, 0.31, 0.155, '-z', 'plateHero'));
    P.trim.push(box(0, 0.225, -2.17, 1.66, 0.11, 0.16, black, 't'));       // lower valance
    [0.2, 0.3].forEach((x) => { push2(P.trim, cyl(0.034, 0.034, 0.1, 7, 'z', x, 0.235, -2.235, 0x8d9098, true)); push2(P.trim, cyl(0.026, 0.026, 0.01, 7, 'z', x, 0.235, -2.27, 0x050505)); });
    glow2(P, 0.62, 0.68, zr - 0.06, 0xff2414, 0.62, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.83, 0.68, zr - 0.06, 0xff2414, 0.42, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.35, 0.68, zr - 0.06, 0xffffff, 0.45, CH.REV, [0, 0, -1]);
    // front: black mouth grille, driving lamps, indicators, chin
    const zf = 2.245;
    P.trim.push(box(0, 0.355, zf - 0.03, 1.2, 0.12, 0.08, black, 'k'));
    for (let i = 0; i < 2; i++) P.trim.push(box(0, 0.335 + i * 0.045, zf + 0.012, 0.86, 0.012, 0.012, satin));
    lens(P, 0.5, 0.36, zf + 0.012, 0.17, 0.07, 0.012, 0xfff6e8, CH.HEAD);
    lens(P, 0.645, 0.36, zf - 0.035, 0.07, 0.06, 0.06, 0xff9a1e, CH.AUX);
    P.trim.push(box(0, 0.235, 2.15, 1.3, 0.09, 0.2, black, 't'));
    glow2(P, 0.5, 0.36, zf + 0.05, 0xfff1d8, 0.55, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.5, 0.36, zf + 0.08, 0x3a3428, 1.05, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.66, 0.36, zf, 0xff9a2a, 0.28, CH.AUX, [0, 0, 1]);
    // closed pop-up headlamp covers (panel gaps on the hood)
    [[0.46, 1.6, 0.8, 1.6], [0.46, 1.92, 0.78, 1.92], [0.46, 1.6, 0.46, 1.92]].forEach((l) => push2(P.trim, surfLine(spec, l[0], l[1], l[2], l[3], 0.008, black)));
    // centre hood line + windshield wiper hints
    P.trim.push(surfLine(spec, -0.45, 0.62, 0.15, 0.6, 0.012, black));
    // side strakes over the door / intake
    push2(P.trim, sideStrip(spec, -0.88, 0.26, 0.385, 0.735, -0.02, 0.003, black));
    for (let i = 0; i < 5; i++) {
      const y = 0.418 + i * 0.07;
      push2(P.paint, sideStrip(spec, -0.9, 0.24 + i * 0.012, y - 0.018, y + 0.018, -0.01, 0.018, red));
    }
    push2(P.trim, sideStrip(spec, 0.47, 0.476, 0.2, 0.83, -0.004, 0.003, black));   // door front shut line
    push2(P.trim, sideStrip(spec, -0.86, 0.26, 0.205, 0.235, -0.004, 0.004, satin)); // sill line
    // single high mirror on the driver's A pillar (left = +x)
    P.paint.push(hexa([[0.80, 0.905, 0.40], [0.95, 0.925, 0.395], [0.95, 0.945, 0.395], [0.80, 0.925, 0.40],
      [0.80, 0.905, 0.42], [0.95, 0.925, 0.415], [0.95, 0.945, 0.415], [0.80, 0.925, 0.42]], red, 'kfb'));
    P.paint.push(box(0.985, 0.945, 0.40, 0.13, 0.072, 0.075, red));
    P.trim.push(box(0.985, 0.945, 0.36, 0.112, 0.056, 0.004, 0x1a1f2a, 'f'));
  }

  // ---- 1980s/90s US sedan family (sedan, police, taxi)
  function specSedan() {
    return {
      L: 5.05, W: 1.92, H: 1.42, wr: 0.33, ww: [0.22, 0.22], track: [1.58, 1.58], axles: [-1.4, 1.48], archR: 0.4,
      wheelStyle: 'steel', doorZ: 0.35, bPillar: -0.12, pillarColor: 0x0a0a0c,
      seats: { driver: [0.38, 0.34, 0.15], passenger: [-0.38, 0.34, 0.15], rearL: [0.38, 0.34, -0.85], rearR: [-0.38, 0.34, -0.85] },
      st: [
        [-2.525, 0.36, 0.9, 0.875, 0.895], [-2.47, 0.27, 0.945, 0.905, 0.925], [-2.0, 0.22, 0.958, 0.915, 0.935],
        [-1.32, 0.21, 0.962, 0.91, 0.932], [-1.0, 0.21, 0.962, 0.9, 0.905], [0.95, 0.21, 0.96, 0.895, 0.9],
        [1.1, 0.22, 0.96, 0.89, 0.905], [2.3, 0.26, 0.95, 0.865, 0.885], [2.47, 0.3, 0.93, 0.825, 0.845], [2.525, 0.36, 0.89, 0.765, 0.785],
      ],
      cab: [[-1.3, 0.93, 0.86, 0.86, 0.935], [-0.62, 0.905, 0.87, 0.7, 1.42], [0.4, 0.9, 0.87, 0.7, 1.425], [1.1, 0.905, 0.87, 0.87, 0.91]],
    };
  }
  function buildSedanDetails(P, spec, o) {
    const chrome = o.chrome === undefined ? 0xb9bec7 : o.chrome, black = 0x08080a, zf = spec.L / 2, zr = -spec.L / 2;
    // front
    P.trim.push(box(0, 0.58, zf + 0.008, 0.82, 0.2, 0.02, chrome));
    P.trim.push(box(0, 0.58, zf + 0.02, 0.74, 0.15, 0.01, 0x0b0b0e));
    for (let i = 0; i < 4; i++) P.trim.push(box(0, 0.53 + i * 0.033, zf + 0.026, 0.74, 0.008, 0.008, chrome));
    lens(P, 0.66, 0.59, zf + 0.01, 0.4, 0.14, 0.02, 0xfff4e0, CH.HEAD);
    lens(P, 0.66, 0.475, zf + 0.006, 0.38, 0.05, 0.02, 0xffa630, CH.AUX);
    P.trim.push(box(0, 0.37, zf + 0.05, 1.96, 0.14, 0.13, chrome, 'b'));
    P.trim.push(box(0, 0.37, zf + 0.118, 1.9, 0.03, 0.006, 0x1a1a1d));
    glow2(P, 0.66, 0.59, zf + 0.06, 0xfff0d2, 0.55, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.66, 0.59, zf + 0.09, 0x3a3428, 1.1, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.66, 0.475, zf + 0.04, 0xff9a2a, 0.3, CH.AUX, [0, 0, 1]);
    // rear
    lens(P, 0.7, 0.72, zr - 0.01, 0.44, 0.2, 0.02, 0xff1c1c, CH.TAIL);
    lens(P, 0.42, 0.72, zr - 0.01, 0.12, 0.2, 0.02, 0xf0f0f0, CH.REV);
    P.trim.push(box(0, 0.72, zr - 0.006, 0.7, 0.2, 0.01, o.tailPanel === undefined ? 0x2a0608 : o.tailPanel));
    P.decal.push(decal(0, 0.575, zr - 0.013, 0.3, 0.15, '-z', o.plate || 'plate'));
    P.trim.push(box(0, 0.38, zr - 0.05, 1.96, 0.14, 0.13, chrome, 'b'));
    glow2(P, 0.7, 0.72, zr - 0.06, 0xff2414, 0.62, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.42, 0.72, zr - 0.06, 0xffffff, 0.45, CH.REV, [0, 0, -1]);
    // sides: rub strip, handles, mirrors
    push2(P.trim, sideStrip(spec, -2.3, 2.3, 0.53, 0.58, -0.01, 0.012, black));
    [0.72, -0.3].forEach((z) => push2(P.trim, sideStrip(spec, z - 0.07, z + 0.07, 0.8, 0.83, -0.005, 0.012, chrome)));
    push2(P.trim, box(0.99, 0.99, 1.0, 0.08, 0.08, 0.13, black));
    push2(P.trim, box(0.95, 0.96, 1.02, 0.06, 0.02, 0.04, black));
    if (o.doors !== false) [1.02, -0.12, -1.0].forEach((z) => push2(P.trim, sideStrip(spec, z - 0.004, z + 0.004, 0.27, 0.88, -0.004, 0.004, 0x050506)));
  }
  function buildPolice(P, spec) {
    buildSedanDetails(P, spec, { chrome: 0x2a2b2f });
    // light bar
    const y0 = 1.42, zc = -0.02;
    P.trim.push(box(0, y0 + 0.03, zc, 1.3, 0.05, 0.3, 0x0a0a0c));
    P.trim.push(box(0, y0 + 0.096, zc, 0.1, 0.085, 0.24, 0xd9dce2));
    push2(P.trim, box(0.66, y0 + 0.096, zc, 0.04, 0.09, 0.26, 0x18181b));
    lens(P, 0.47, y0 + 0.096, zc, 0.33, 0.085, 0.24, 0xff1830, CH.SR1, false);
    lens(P, 0.175, y0 + 0.096, zc, 0.24, 0.085, 0.24, 0xff2a3a, CH.SR2, false);
    lens(P, -0.47, y0 + 0.096, zc, 0.33, 0.085, 0.24, 0x2050ff, CH.SB1, false);
    lens(P, -0.175, y0 + 0.096, zc, 0.24, 0.085, 0.24, 0x3a66ff, CH.SB2, false);
    P.glows.push({ p: [0.47, y0 + 0.1, zc], c: 0xff1a2a, s: 0.95, ch: CH.SR1 }, { p: [0.17, y0 + 0.1, zc], c: 0xff2a3a, s: 0.7, ch: CH.SR2 },
      { p: [-0.47, y0 + 0.1, zc], c: 0x2a5cff, s: 0.95, ch: CH.SB1 }, { p: [-0.17, y0 + 0.1, zc], c: 0x3a6cff, s: 0.7, ch: CH.SB2 },
      { p: [0.4, y0 + 0.1, zc], c: 0x601018, s: 3.2, ch: CH.SR1 }, { p: [-0.4, y0 + 0.1, zc], c: 0x10246a, s: 3.2, ch: CH.SB1 });
    // grille strobes
    lens(P, 0.25, 0.585, spec.L / 2 + 0.03, 0.1, 0.04, 0.01, 0xff2030, CH.SR2, false);
    lens(P, -0.25, 0.585, spec.L / 2 + 0.03, 0.1, 0.04, 0.01, 0x3060ff, CH.SB2, false);
    P.glows.push({ p: [0.25, 0.585, spec.L / 2 + 0.08], c: 0xff2030, s: 0.5, ch: CH.SR2, d: [0, 0, 1] }, { p: [-0.25, 0.585, spec.L / 2 + 0.08], c: 0x3060ff, s: 0.5, ch: CH.SB2, d: [0, 0, 1] });
    // push bar
    const zp = spec.L / 2 + 0.17, bk = 0x0d0d0f;
    push2(P.trim, box(0.36, 0.56, zp, 0.05, 0.46, 0.05, bk));
    P.trim.push(box(0, 0.47, zp + 0.01, 0.86, 0.05, 0.05, bk), box(0, 0.74, zp + 0.01, 0.82, 0.05, 0.05, bk));
    push2(P.trim, box(0.36, 0.4, zp - 0.08, 0.04, 0.04, 0.16, bk));
    // A-pillar spotlight + antenna
    P.trim.push(cyl(0.05, 0.05, 0.12, 7, 'z', 0.93, 1.02, 1.0, 0xc8ccd3));
    P.trim.push(box(-0.55, 1.15, -1.95, 0.008, 0.45, 0.008, 0x111111));
    // door lettering
    P.decal.push(decal(spec.W / 2 + 0.011, 0.69, 0.08, 1.12, 0.28, 'x', 'police'));
    P.decal.push(decal(-spec.W / 2 - 0.011, 0.69, 0.08, 1.12, 0.28, '-x', 'police'));
    P.decal.push(decal(0, 1.437, -0.62, 0.5, 0.25, 'y', 'unit'));
  }
  function buildTaxi(P, spec) {
    buildSedanDetails(P, spec, {});
    const y0 = 1.425;
    P.trim.push(box(0, y0 + 0.015, -0.05, 0.7, 0.03, 0.24, 0x111114));
    P.lamp.push(box(0, y0 + 0.1, -0.05, 0.64, 0.15, 0.2, 0xfff1c4, 'b', { chan: CH.AUX }));
    P.decal.push(decal(0, y0 + 0.1, 0.052, 0.6, 0.14, 'z', 'taxi'), decal(0, y0 + 0.1, -0.152, 0.6, 0.14, '-z', 'taxi'));
    P.glows.push({ p: [0, y0 + 0.12, -0.05], c: 0x806a2a, s: 1.1, ch: CH.AUX });
    P.decal.push(decal(spec.W / 2 + 0.013, 0.69, -0.1, 2.3, 0.075, 'x', 'checker'), decal(-spec.W / 2 - 0.013, 0.69, -0.1, 2.3, 0.075, '-x', 'checker'));
  }
  // ---- 2-door coupe
  function specCoupe() {
    return {
      L: 4.75, W: 1.86, H: 1.28, wr: 0.32, ww: [0.235, 0.25], track: [1.54, 1.56], axles: [-1.3, 1.4], archR: 0.385,
      wheelStyle: 'sport5', doorZ: 0.15, pillarColor: 0x0a0a0c,
      seats: { driver: [0.36, 0.3, -0.1], passenger: [-0.36, 0.3, -0.1], rearL: [0.34, 0.3, -0.98], rearR: [-0.34, 0.3, -0.98] },
      st: [
        [-2.375, 0.32, 0.88, 0.855, 0.875], [-2.32, 0.24, 0.905, 0.88, 0.9], [-1.9, 0.19, 0.922, 0.885, 0.9],
        [-1.6, 0.18, 0.925, 0.87, 0.885], [-1.3, 0.18, 0.925, 0.85, 0.86], [0.75, 0.18, 0.915, 0.82, 0.83],
        [0.9, 0.185, 0.912, 0.81, 0.83], [2.05, 0.21, 0.88, 0.7, 0.72], [2.3, 0.26, 0.84, 0.62, 0.64], [2.375, 0.32, 0.79, 0.56, 0.58],
      ],
      cab: [[-1.72, 0.885, 0.76, 0.76, 0.888], [-0.5, 0.85, 0.82, 0.62, 1.27], [0.18, 0.84, 0.82, 0.63, 1.28], [0.9, 0.828, 0.8, 0.8, 0.832]],
    };
  }
  function buildCoupe(P, spec) {
    const black = 0x07070a, zf = spec.L / 2, zr = -spec.L / 2;
    P.trim.push(box(0, 0.62, zr - 0.006, 1.74, 0.15, 0.012, black));
    lens(P, 0.6, 0.62, zr - 0.014, 0.52, 0.1, 0.012, 0xff1a1a, CH.TAIL);
    lens(P, 0.25, 0.62, zr - 0.014, 0.16, 0.1, 0.012, 0xeeeeee, CH.REV);
    P.decal.push(decal(0, 0.45, zr - 0.006, 0.3, 0.15, '-z', 'plate'));
    P.trim.push(box(0, 0.3, zr + 0.02, 1.8, 0.14, 0.12, black, 'b'));
    P.paint.push(box(0, 0.935, -2.2, 1.6, 0.025, 0.2, null, 'b'));
    push2(P.paint, box(0.7, 0.905, -2.2, 0.05, 0.05, 0.12, null, 'b'));
    glow2(P, 0.6, 0.62, zr - 0.06, 0xff2414, 0.62, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.25, 0.62, zr - 0.06, 0xffffff, 0.45, CH.REV, [0, 0, -1]);
    P.trim.push(box(0, 0.5, zf - 0.02, 1.3, 0.07, 0.06, black));
    lens(P, 0.56, 0.505, zf - 0.008, 0.36, 0.055, 0.04, 0xfff4e0, CH.HEAD);
    P.trim.push(box(0, 0.33, zf - 0.02, 1.62, 0.13, 0.1, black, 'b'));
    lens(P, 0.62, 0.33, zf + 0.032, 0.18, 0.04, 0.01, 0xffa630, CH.AUX);
    glow2(P, 0.56, 0.505, zf + 0.04, 0xfff0d2, 0.55, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.56, 0.505, zf + 0.07, 0x3a3428, 1.05, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.62, 0.33, zf + 0.04, 0xff9a2a, 0.28, CH.AUX, [0, 0, 1]);
    push2(P.trim, sideStrip(spec, -2.2, 2.2, 0.22, 0.36, -0.03, 0.006, 0x101014));
    push2(P.trim, sideStrip(spec, 0.1, 0.24, 0.76, 0.785, -0.004, 0.01, black));
    push2(P.trim, box(0.95, 0.9, 0.85, 0.08, 0.07, 0.12, black));
  }
  // ---- boxy minivan
  function specVan() {
    return {
      L: 4.6, W: 1.84, H: 1.66, wr: 0.31, ww: [0.21, 0.21], track: [1.53, 1.53], axles: [-1.3, 1.52], archR: 0.38,
      wheelStyle: 'steel', doorZ: 0.75, bPillar: 0.45, pillarColor: 0x0a0a0c,
      seats: { driver: [0.38, 0.5, 0.65], passenger: [-0.38, 0.5, 0.65], rearL: [0.38, 0.5, -0.4], rearR: [-0.38, 0.5, -0.4] },
      st: [
        [-2.3, 0.32, 0.88, 1.0, 1.03], [-2.25, 0.25, 0.905, 1.02, 1.035], [-1.8, 0.22, 0.915, 1.02, 1.035],
        [1.3, 0.22, 0.915, 1.0, 1.012], [1.42, 0.23, 0.91, 0.975, 0.99], [2.05, 0.27, 0.885, 0.86, 0.885],
        [2.25, 0.32, 0.86, 0.785, 0.8], [2.3, 0.36, 0.83, 0.73, 0.745],
      ],
      cab: [[-2.27, 1.035, 0.85, 0.79, 1.04], [-2.17, 1.035, 0.86, 0.76, 1.64], [0.7, 1.01, 0.86, 0.76, 1.66], [1.42, 0.99, 0.86, 0.86, 0.995]],
    };
  }
  function buildVan(P, spec, wood) {
    const black = 0x08080a, zf = spec.L / 2, zr = -spec.L / 2, chrome = 0xb9bec7;
    lens(P, 0.79, 0.78, zr - 0.006, 0.1, 0.44, 0.02, 0xff1a1a, CH.TAIL);
    lens(P, 0.79, 0.53, zr - 0.006, 0.1, 0.06, 0.02, 0xf0f0f0, CH.REV);
    P.decal.push(decal(0, 0.62, zr - 0.006, 0.3, 0.15, '-z', 'plate'));
    P.trim.push(box(0, 0.36, zr - 0.03, 1.84, 0.14, 0.1, black, 'b'));
    glow2(P, 0.79, 0.82, zr - 0.06, 0xff2414, 0.6, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.79, 0.53, zr - 0.06, 0xffffff, 0.4, CH.REV, [0, 0, -1]);
    P.trim.push(box(0, 0.6, zf + 0.004, 0.62, 0.13, 0.02, chrome), box(0, 0.6, zf + 0.012, 0.56, 0.09, 0.01, 0x0b0b0e));
    lens(P, 0.6, 0.6, zf + 0.006, 0.38, 0.12, 0.02, 0xfff4e0, CH.HEAD);
    P.trim.push(box(0, 0.4, zf + 0.03, 1.84, 0.14, 0.1, 0x2a2b30, 'b'));
    glow2(P, 0.6, 0.6, zf + 0.05, 0xfff0d2, 0.55, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.6, 0.6, zf + 0.08, 0x3a3428, 1.05, CH.HEAD, [0, 0, 1]);
    if (wood) { // faux wood side panelling, very 1980s
      push2(P.trim, sideStrip(spec, -2.05, 1.12, 0.43, 0.86, -0.006, 0.006, 0x6a4222));
      push2(P.trim, sideStrip(spec, -2.07, 1.14, 0.855, 0.875, -0.004, 0.01, chrome));
      push2(P.trim, sideStrip(spec, -2.07, 1.14, 0.415, 0.435, -0.004, 0.01, chrome));
    } else push2(P.trim, sideStrip(spec, -2.1, 2.1, 0.5, 0.56, -0.01, 0.01, black));
    P.trim.push(sideStrip(spec, -0.55, -0.45, 0.78, 0.81, -0.004, 0.012, black));
    push2(P.trim, box(0.95, 1.05, 1.3, 0.08, 0.09, 0.13, black));
    push2(P.trim, box(0.55, 1.68, -0.6, 0.04, 0.03, 2.6, 0x9aa0a8));   // roof rails
  }

  // ---- chapter 3: the crew's black luxury four-door coupe (long hood, fastback roofline, frameless doors,
  // chrome window line, big dark multi-spoke wheels with red calipers, slim LED lamps, tan cabin behind clear glass)
  // a flat strip along a polyline of surface points (strip centre line), height h, thickness th, pushed out by `out`
  // along the horizontal normal (-tz, 0, tx): list the points so that this normal points away from the body.
  function ribbon(pts, h, th, out, color, extra, dy) {
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l, nz = tx / l, f = out + th / 2, k = out - th / 2;
      const dyA = dy ? dy[i] : 0, dyB = dy ? dy[i + 1] : 0;
      const c = (p, s, y, d) => [p[0] + nx * s, p[1] + y + d, p[2] + nz * s];
      parts.push(hexa([c(a, k, -h / 2, dyA), c(b, k, -h / 2, dyB), c(b, k, h / 2, dyB), c(a, k, h / 2, dyA),
        c(a, f, -h / 2, dyA), c(b, f, -h / 2, dyB), c(b, f, h / 2, dyB), c(a, f, h / 2, dyA)], color, null, extra));
    }
    return parts;
  }
  // thin 4-sided tube from a to b (chrome window surrounds, wires)
  function tube(a, b, r, color, seg) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new T.CylinderGeometry(r, r, len, seg || 4, 1, true);
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize())));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return prep(g, color);
  }
  function specLux() {
    const spec = {
      L: 5.0, W: 1.9, H: 1.41, wr: 0.345, ww: [0.245, 0.275], track: [1.6, 1.62], axles: [-1.47, 1.42], archR: 0.405,
      wheelStyle: 'lux', doorZ: 0.2, bPillar: -0.36, pillarColor: 0x08080a, caliper: 0xc8141c, clearGlass: true,
      seats: { driver: [0.37, 0.4, -0.08], passenger: [-0.37, 0.4, -0.08], rearL: [0.37, 0.36, -0.93], rearR: [-0.37, 0.36, -0.93] },
      st: [
        [-2.5, 0.44, 0.8, 0.87, 0.895], [-2.47, 0.33, 0.885, 0.912, 0.935], [-2.36, 0.255, 0.93, 0.93, 0.962],
        [-2.05, 0.225, 0.948, 0.935, 0.972], [-1.6, 0.215, 0.952, 0.925, 0.955], [-1.1, 0.212, 0.95, 0.915, 0.935],
        [-0.3, 0.21, 0.947, 0.9, 0.915], [0.5, 0.21, 0.944, 0.888, 0.9], [0.95, 0.214, 0.94, 0.865, 0.885],
        [1.55, 0.225, 0.93, 0.805, 0.835], [2.05, 0.25, 0.912, 0.74, 0.77], [2.33, 0.285, 0.875, 0.685, 0.708],
        [2.46, 0.32, 0.82, 0.64, 0.66], [2.5, 0.36, 0.76, 0.6, 0.618],
      ],
      tumble: 0.5, rearGlassRows: 2, cPillarW: 0.11,
    };
    // greenhouse: [z, hwBelt, hwRoof, yRoof] -> the belt sits on the body's upper surface; two rear-glass rows = curved fastback
    spec.cab = [[-1.95, 0.86, 0.86, null], [-1.55, 0.87, 0.6, 1.165], [-1.08, 0.876, 0.655, 1.3], [-0.6, 0.88, 0.675, 1.368],
      [-0.05, 0.88, 0.68, 1.4], [0.3, 0.878, 0.69, 1.388], [0.97, 0.87, 0.87, null]].map((c) => {
      const yb = topY(spec, c[0], c[1]) + 0.004;
      return [c[0], yb, c[1], c[2], c[3] === null ? yb + 0.003 : c[3]];
    });
    spec.steeringWheel = { p: [0.37, 0.86, 0.37], tilt: 0.5, r: 0.17 }; // = DRIVE_WHEEL relative to the driver seat (seat y - SEAT_SURF)
    return spec;
  }
  function buildLux(P, spec) {
    const chrome = 0xc9ccd3, black = 0x060607, satin = 0x111114, zf = spec.L / 2, zr = -spec.L / 2;
    const tan = 0x704326, tanD = 0x4f2f18, cblk = 0x141416, cgry = 0x2a2a2e;
    // ---------- front: wide low grille, one thick chrome blade carrying an original ring emblem
    P.trim.push(hexa([[-0.33, 0.395, zf - 0.03], [0.33, 0.395, zf - 0.03], [0.39, 0.555, zf - 0.03], [-0.39, 0.555, zf - 0.03],
      [-0.33, 0.395, zf + 0.01], [0.33, 0.395, zf + 0.01], [0.39, 0.555, zf + 0.01], [-0.39, 0.555, zf + 0.01]], 0x070708));
    for (let i = 0; i < 4; i++) P.trim.push(box(0, 0.413 + i * 0.037, zf + 0.012, 0.66 + i * 0.03, 0.006, 0.006, 0x26272b));
    [[[-0.33, 0.395], [0.33, 0.395]], [[0.33, 0.395], [0.39, 0.555]], [[0.39, 0.555], [-0.39, 0.555]], [[-0.39, 0.555], [-0.33, 0.395]]]
      .forEach((q) => P.trim.push(tube([q[0][0], q[0][1], zf + 0.014], [q[1][0], q[1][1], zf + 0.014], 0.009, chrome)));
    P.trim.push(hexa([[-0.37, 0.478, zf + 0.008], [0.37, 0.478, zf + 0.008], [0.375, 0.5, zf + 0.008], [-0.375, 0.5, zf + 0.008],
      [-0.37, 0.478, zf + 0.03], [0.37, 0.478, zf + 0.03], [0.375, 0.5, zf + 0.026], [-0.375, 0.5, zf + 0.026]], chrome));
    P.trim.push(cyl(0.056, 0.056, 0.02, 14, 'z', 0, 0.489, zf + 0.03, 0x0a0a0c));
    const ring = new T.TorusGeometry(0.056, 0.009, 4, 18); ring.translate(0, 0.489, zf + 0.042); P.trim.push(prep(ring, chrome));
    P.trim.push(xf(box(0, 0, 0, 0.042, 0.042, 0.012, chrome), [0, 0.489, zf + 0.04], [0, 0, Math.PI / 4]));
    // slim swept headlamps (main beam lens + an LED "eyebrow" daytime strip) following the nose corner
    const hl = [[0.47, 0.578, zf + 0.004], [0.64, 0.594, zf + 0.004], [0.75, 0.607, zf - 0.008], [0.818, 0.624, zf - 0.048], [0.86, 0.645, zf - 0.12]];
    push2(P.lamp, merge(ribbon(hl, 0.058, 0.012, 0.004, 0xe8eef6, { chan: CH.HEAD })));
    push2(P.lamp, merge(ribbon(hl.slice(1), 0.01, 0.01, 0.009, 0xeaf4ff, { chan: CH.AUX }, [0.03, 0.03, 0.03, 0.03])));
    push2(P.trim, merge(ribbon(hl, 0.085, 0.01, -0.002, 0x0b0b0d, null, [0.0, 0.0, 0.0, 0.0, 0.0])));
    lens(P, 0.66, 0.405, zf - 0.065, 0.16, 0.022, 0.03, 0xffa630, CH.AUX);           // turn signal in the bumper
    glow2(P, 0.55, 0.595, zf + 0.06, 0xfff1d8, 0.5, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.72, 0.61, zf + 0.04, 0xfff1d8, 0.36, CH.HEAD, [0.3, 0, 1]);
    glow2(P, 0.6, 0.6, zf + 0.1, 0x3a3428, 1.15, CH.HEAD, [0, 0, 1]);
    glow2(P, 0.7, 0.632, zf + 0.02, 0xd8ecff, 0.26, CH.AUX, [0.4, 0, 1]);
    glow2(P, 0.82, 0.65, zf - 0.07, 0xd8ecff, 0.2, CH.AUX, [0.8, 0, 0.6]);
    // lower bumper: chin lip running back to the arches, central intake, side intakes with chrome fins, splitter blade
    P.trim.push(hexa([[-0.88, 0.2, 1.97], [0.88, 0.2, 1.97], [0.88, 0.262, 1.97], [-0.88, 0.262, 1.97],
      [-0.73, 0.178, zf - 0.005], [0.73, 0.178, zf - 0.005], [0.72, 0.372, zf - 0.005], [-0.72, 0.372, zf - 0.005]], 0x0c0c0e, 'k'));
    P.trim.push(box(0, 0.27, zf - 0.0, 0.66, 0.11, 0.012, 0x040405));
    for (let i = 0; i < 3; i++) P.trim.push(box(0, 0.235 + i * 0.035, zf + 0.008, 0.64, 0.007, 0.008, 0x23242a));
    push2(P.trim, box(0.6, 0.285, zf - 0.0, 0.19, 0.12, 0.012, 0x040405));
    [0.255, 0.31].forEach((y) => push2(P.trim, box(0.6, y, zf + 0.01, 0.19, 0.012, 0.012, chrome)));
    P.trim.push(hexa([[-0.72, 0.17, zf - 0.07], [0.72, 0.17, zf - 0.07], [0.72, 0.186, zf - 0.07], [-0.72, 0.186, zf - 0.07],
      [-0.68, 0.17, zf + 0.03], [0.68, 0.17, zf + 0.03], [0.68, 0.182, zf + 0.03], [-0.68, 0.182, zf + 0.03]], chrome));
    // ---------- sides
    push2(P.trim, sideStrip(spec, -1.02, 0.98, 0.205, 0.3, -0.008, 0.013, satin));            // side skirt
    push2(P.trim, sideStrip(spec, -1.0, 0.96, 0.298, 0.31, -0.004, 0.016, chrome));          // sill chrome line
    [0.99, -0.36, -1.055].forEach((z) => push2(P.trim, sideStrip(spec, z - 0.004, z + 0.004, 0.31, topY(spec, z, 0.93) - 0.03, -0.004, 0.004, 0x030304)));
    [0.06, -0.95].forEach((z) => {                                                            // flush chrome handles
      push2(P.trim, sideStrip(spec, z - 0.08, z + 0.08, 0.792, 0.818, -0.004, 0.011, chrome));
      push2(P.trim, sideStrip(spec, z - 0.07, z + 0.07, 0.782, 0.792, -0.004, 0.006, 0x030304));
    });
    push2(P.trim, sideStrip(spec, 1.8, 1.95, 0.625, 0.645, -0.004, 0.01, chrome));             // fender vent
    push2(P.trim, sideStrip(spec, 1.8, 1.95, 0.6, 0.62, -0.004, 0.006, 0x050506));
    // mirrors: body-coloured cap on a black arm, glass toward the back, LED repeater
    push2(P.trim, hexa([[0.86, 0.9, 0.74], [0.95, 0.915, 0.75], [0.95, 0.94, 0.75], [0.86, 0.93, 0.74],
      [0.86, 0.9, 0.8], [0.95, 0.915, 0.8], [0.95, 0.94, 0.8], [0.86, 0.93, 0.8]], black));
    push2(P.paint, hexa([[0.93, 0.925, 0.72], [1.07, 0.935, 0.705], [1.06, 1.0, 0.71], [0.93, 1.005, 0.725],
      [0.93, 0.93, 0.82], [1.065, 0.94, 0.79], [1.055, 0.995, 0.795], [0.93, 1.0, 0.815]], null));
    push2(P.trim, box(1.0, 0.965, 0.712, 0.12, 0.06, 0.006, 0x141a24, 'f'));
    push2(P.lamp, box(1.0, 0.938, 0.79, 0.1, 0.008, 0.012, 0xffa630, 'b', { chan: CH.AUX }));
    // chrome window line: belt + the arch over the side glass (C seam, roof edge, A seam)
    const cr = cabRows(spec), m = cr.length, out = (p, d) => [p[0] + d, p[1], p[2]];
    const belt = []; for (let i = m - 1; i >= 0; i--) belt.push([cr[i][0][0] + 0.004, cr[i][0][1] - 0.008, cr[i][0][2]]);
    push2(P.trim, merge(ribbon(belt, 0.022, 0.012, 0.0, chrome)));
    const arch = [cr[0][0]]; for (let i = 1; i < m - 1; i++) arch.push(cr[i][2]); arch.push(cr[m - 1][0]);
    for (let i = 0; i < arch.length - 1; i++) push2(P.trim, tube(out(arch[i], 0.012), out(arch[i + 1], 0.012), 0.0095, chrome));
    // ---------- rear: slim wrap-around LED tail lamps joined by a chrome bar, ducktail, diffuser + quad tips
    const tl = [[0.93, 0.82, -2.33], [0.9, 0.825, -2.43], [0.84, 0.83, zr - 0.004], [0.55, 0.828, zr - 0.006], [0.24, 0.826, zr - 0.006]];
    push2(P.lamp, merge(ribbon(tl, 0.058, 0.012, 0.004, 0xff1c1c, { chan: CH.TAIL })));
    push2(P.lamp, merge(ribbon(tl.slice(1, 4), 0.01, 0.01, 0.011, 0xff6a5a, { chan: CH.TAIL }, [0.012, 0.012, 0.012])));
    push2(P.trim, merge(ribbon(tl, 0.08, 0.01, -0.003, 0x1a0405)));
    lens(P, 0.4, 0.788, zr - 0.012, 0.13, 0.02, 0.012, 0xf2f2f2, CH.REV);
    P.trim.push(box(0, 0.828, zr - 0.012, 0.48, 0.02, 0.012, chrome));
    const ringR = new T.TorusGeometry(0.038, 0.006, 4, 14); ringR.rotateY(Math.PI); ringR.translate(0, 0.755, zr - 0.012); P.trim.push(prep(ringR, chrome));
    P.trim.push(box(0, 0.62, zr - 0.004, 0.36, 0.18, 0.012, 0x08080a));
    P.decal.push(decal(0, 0.62, zr - 0.012, 0.3, 0.15, '-z', 'plate'));
    const ty = (z, x) => topY(spec, z, x);                                                                     // subtle ducktail lip
    P.paint.push(hexa([[-0.74, ty(-2.475, 0.74) - 0.012, -2.475], [0.74, ty(-2.475, 0.74) - 0.012, -2.475], [0.74, ty(-2.475, 0.74) + 0.016, -2.478], [-0.74, ty(-2.475, 0.74) + 0.016, -2.478],
      [-0.78, ty(-2.39, 0.78) - 0.01, -2.39], [0.78, ty(-2.39, 0.78) - 0.01, -2.39], [0.78, ty(-2.39, 0.78) + 0.003, -2.39], [-0.78, ty(-2.39, 0.78) + 0.003, -2.39]], null));
    P.paint.push(hexa([[-0.06, ty(-2.475, 0) - 0.012, -2.475], [0.06, ty(-2.475, 0) - 0.012, -2.475], [0.06, ty(-2.475, 0) + 0.016, -2.478], [-0.06, ty(-2.475, 0) + 0.016, -2.478],
      [-0.06, ty(-2.39, 0) - 0.01, -2.39], [0.06, ty(-2.39, 0) - 0.01, -2.39], [0.06, ty(-2.39, 0) + 0.003, -2.39], [-0.06, ty(-2.39, 0) + 0.003, -2.39]], null));
    lens(P, 0, ty(-2.475, 0) + 0.004, -2.482, 0.3, 0.01, 0.008, 0xff2020, CH.TAIL, false);                      // third brake light
    P.paint.push(hexa([[-0.86, 0.215, -2.475], [0.86, 0.215, -2.475], [0.84, 0.445, -2.475], [-0.84, 0.445, -2.475],
      [-0.9, 0.215, -2.2], [0.9, 0.215, -2.2], [0.9, 0.445, -2.3], [-0.9, 0.445, -2.3]], null, 'f'));          // lower bumper
    P.trim.push(hexa([[-0.74, 0.2, -2.49], [0.74, 0.2, -2.49], [0.72, 0.31, -2.485], [-0.72, 0.31, -2.485],
      [-0.78, 0.2, -2.3], [0.78, 0.2, -2.3], [0.78, 0.31, -2.3], [-0.78, 0.31, -2.3]], 0x0c0c0e, 'f'));          // diffuser insert
    P.trim.push(box(0, 0.312, -2.487, 1.42, 0.01, 0.012, chrome));
    for (let i = 0; i < 5; i++) P.trim.push(box(-0.3 + i * 0.15, 0.235, -2.47, 0.012, 0.07, 0.06, 0x1a1b1e));  // diffuser fins
    [0.5, 0.66].forEach((x) => {
      push2(P.trim, hexa([[x - 0.065, 0.225, -2.5], [x + 0.065, 0.225, -2.5], [x + 0.06, 0.285, -2.5], [x - 0.06, 0.285, -2.5],
        [x - 0.065, 0.225, -2.4], [x + 0.065, 0.225, -2.4], [x + 0.06, 0.285, -2.4], [x - 0.06, 0.285, -2.4]], chrome, 'f'));
      push2(P.trim, box(x, 0.255, -2.502, 0.11, 0.045, 0.01, 0x030303));
    });
    lens(P, 0.83, 0.37, -2.46, 0.08, 0.02, 0.02, 0xc81010, CH.TAIL);                                          // reflectors
    glow2(P, 0.6, 0.828, zr - 0.06, 0xff2414, 0.55, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.3, 0.826, zr - 0.06, 0xff2414, 0.42, CH.TAIL, [0, 0, -1]);
    glow2(P, 0.88, 0.825, -2.42, 0xff2414, 0.36, CH.TAIL, [0.6, 0, -0.8]);
    glow2(P, 0.4, 0.788, zr - 0.06, 0xffffff, 0.4, CH.REV, [0, 0, -1]);
    P.glows.push({ p: [0, ty(-2.475, 0) + 0.01, -2.52], c: 0xff2414, s: 0.28, ch: CH.TAIL, d: [0, 0.3, -1] });
    // ---------- cabin (seen through the clear glass): tan leather seats, black dash, console, headliner
    const seatF = spec.seats.driver, seatR = spec.seats.rearL;
    [1, -1].forEach((sd) => {
      const x = sd * seatF[0], y = seatF[1], z = seatF[2];
      P.cabin.push(box(x, y - 0.06, z + 0.06, 0.5, 0.12, 0.52, tan));
      P.cabin.push(box(x + 0.22, y - 0.03, z + 0.06, 0.07, 0.12, 0.5, tanD), box(x - 0.22, y - 0.03, z + 0.06, 0.07, 0.12, 0.5, tanD));
      const zb = z - 0.2, yt = y + 0.62, zt = zb - 0.14;
      P.cabin.push(hexa([[x - 0.25, y - 0.02, zb - 0.13], [x + 0.25, y - 0.02, zb - 0.13], [x + 0.2, yt, zt - 0.1], [x - 0.2, yt, zt - 0.1],
        [x - 0.25, y - 0.02, zb], [x + 0.25, y - 0.02, zb], [x + 0.2, yt, zt], [x - 0.2, yt, zt]], tan));
      P.cabin.push(box(x + 0.23, y + 0.28, zb - 0.06, 0.06, 0.5, 0.14, tanD), box(x - 0.23, y + 0.28, zb - 0.06, 0.06, 0.5, 0.14, tanD));
      P.cabin.push(xf(box(0, 0, 0, 0.23, 0.15, 0.085, tanD), [x, yt + 0.1, zt - 0.05], [-0.22, 0, 0]), box(x, yt + 0.02, zt - 0.05, 0.03, 0.06, 0.03, cblk));
      // rear seats
      const xr = sd * seatR[0], yr = seatR[1], zr2 = seatR[2], zbr = zr2 - 0.2, ytr = yr + 0.56, ztr = zbr - 0.2;
      P.cabin.push(box(xr, yr - 0.06, zr2 + 0.05, 0.54, 0.12, 0.5, tan));
      P.cabin.push(hexa([[xr - 0.27, yr - 0.02, zbr - 0.12], [xr + 0.27, yr - 0.02, zbr - 0.12], [xr + 0.22, ytr, ztr - 0.1], [xr - 0.22, ytr, ztr - 0.1],
        [xr - 0.27, yr - 0.02, zbr], [xr + 0.27, yr - 0.02, zbr], [xr + 0.22, ytr, ztr], [xr - 0.22, ytr, ztr]], tan));
      P.cabin.push(xf(box(0, 0, 0, 0.22, 0.12, 0.075, tanD), [xr, ytr + 0.07, ztr - 0.04], [-0.3, 0, 0]));
    });
    P.cabin.push(box(0, seatR[1] - 0.04, seatR[2], 0.2, 0.14, 0.5, tanD));                            // rear middle
    P.cabin.push(box(0, seatF[1] + 0.06, 0.12, 0.2, 0.2, 0.8, cblk), box(0, seatF[1] + 0.17, -0.05, 0.18, 0.03, 0.4, tan)); // console + armrest
    // dash, instrument hood, centre screen, rear-view mirror, parcel shelf
    P.cabin.push(hexa([[-0.86, 0.62, 0.45], [0.86, 0.62, 0.45], [0.86, 0.955, 0.47], [-0.86, 0.955, 0.47],
      [-0.86, 0.62, 1.0], [0.86, 0.62, 1.0], [0.86, 0.88, 1.0], [-0.86, 0.88, 1.0]], cblk));
    P.cabin.push(box(0.37, 0.975, 0.56, 0.4, 0.05, 0.2, cblk), box(0.37, 0.955, 0.465, 0.36, 0.06, 0.012, 0x0e1622));
    P.cabin.push(box(0, 0.97, 0.5, 0.34, 0.11, 0.025, 0x0b0d12), box(0, 0.62, 0.42, 0.2, 0.3, 0.06, cgry));
    P.cabin.push(box(0, 1.315, 0.33, 0.22, 0.055, 0.02, cblk));
    P.cabin.push(hexa([[-0.84, 0.94, -1.92], [0.84, 0.94, -1.92], [0.84, 0.95, -1.92], [-0.84, 0.95, -1.92],
      [-0.84, 0.92, -1.36], [0.84, 0.92, -1.36], [0.84, 0.93, -1.36], [-0.84, 0.93, -1.36]], cblk));
    // headliner: the roof's underside, so a low look through the side glass never sees the sky through the roof
    const hr = cabRows(spec).map((row) => row.map((p) => [p[0] * 0.985, p[1] - 0.03, p[2], C(0x2e2d2b)]));
    P.cabin.push(flip(loft(hr, 1, m - 2, 2, 4)));
  }

  const CIV_COLORS = [0x2ec4b6, 0xff6fae, 0xf3f0ea, 0x9ff0c8, 0xb48cff, 0x5ec8ff, 0xff7f6b, 0xf2e3b6, 0xb9c0c9, 0x16161c, 0x1f3c88, 0x7a1f3d, 0x19b5c9, 0x3a3f4a, 0xffd23f, 0x6a2c91];
  let carSeed = 1;
  function specFor(kind) {
    let spec;
    if (kind === 'sports') spec = specSports();
    else if (kind === 'police') {
      spec = specSedan(); spec.wheelStyle = 'police'; spec.twoTone = true; spec.splits = [-0.86, 0.96];
      spec.colorFn = (z, part) => (part === 'side' && z > -0.86 && z < 0.96) ? 0xeeeeea : 0x0d0d10;
      spec.roofColor = 0xeeeeea; spec.H = 1.6;
    } else if (kind === 'taxi') { spec = specSedan(); spec.H = 1.6; }
    else if (kind === 'van') spec = specVan();
    else if (kind === 'coupe') spec = specCoupe();
    else if (kind === 'lux') spec = specLux();
    else spec = specSedan();
    return spec;
  }
  // geometry is built once per kind/variant and shared by every car of that kind
  function carGeometry(kind, variant) {
    const key = 'car_' + kind + '_' + variant;
    if (GEO[key]) return GEO[key];
    const spec = specFor(kind), P = kit();
    const sh = shell(spec);
    sh.paint.forEach((g) => P.paint.push(g)); sh.glass.forEach((g) => P.glass.push(g));
    if (kind === 'sports') buildSports(P, spec);
    else if (kind === 'police') buildPolice(P, spec);
    else if (kind === 'taxi') buildTaxi(P, spec);
    else if (kind === 'coupe') buildCoupe(P, spec);
    else if (kind === 'van') buildVan(P, spec, variant === 1);
    else if (kind === 'lux') buildLux(P, spec);
    else buildSedanDetails(P, spec, {});
    const m = (list) => (list.length ? merge(list) : null);
    const G = { paint: m(P.paint), trim: m(P.trim), glass: m(P.glass), lamp: m(P.lamp), decal: m(P.decal), glow: glowGeo(P.glows), cabin: m(P.cabin) };
    GEO[key] = { spec: spec, G: G };
    return GEO[key];
  }
  function car(kind, opts) {
    if (!T) throw new Error('HModels.init(THREE) first');
    opts = opts || {};
    if (['sports', 'police', 'sedan', 'taxi', 'van', 'coupe', 'lux'].indexOf(kind) < 0) kind = 'sedan';
    if (kind === 'lux') { // the crew car: never consumes the traffic colour sequence
      const rl = assemble(kind, carGeometry(kind, 0).spec, carGeometry(kind, 0).G, opts.color === undefined ? 0x15161a : opts.color);
      if (opts.lights) rl.setLights(true);
      return rl;
    }
    const r = rng(opts.seed !== undefined ? Math.imul((opts.seed | 0) + 101, 2654435761) : Math.imul(carSeed++, 2246822519));
    let color = opts.color, variant = 0;
    if (kind === 'sports') { if (color === undefined) color = 0xc40a12; }
    else if (kind === 'police') color = 0xffffff;
    else if (kind === 'taxi') { if (color === undefined) color = 0xffc21a; }
    else if (color === undefined) color = pick(r, CIV_COLORS);
    if (kind === 'van') variant = r() < 0.55 ? 1 : 0;
    const built = carGeometry(kind, variant);
    const rig = assemble(kind, built.spec, built.G, color);
    if (opts.lights) rig.setLights(true);
    return rig;
  }

  // ================================================================= people
  // one SkinnedMesh per person (rigid, segmented skinning = 1 draw call). Bones:
  const BN = { root: 0, hips: 1, spine: 2, head: 3, uArmL: 4, fArmL: 5, uArmR: 6, fArmR: 7, thighL: 8, shinL: 9, thighR: 10, shinR: 11 };
  const BIND = { hips: 0.95, spine: 1.02, head: 1.47, shoulderX: 0.195, shoulderY: 1.41, elbowY: 1.125, wristY: 0.875, hipX: 0.095, hipY: 0.93, kneeY: 0.505 };
  function skinned(g, bone) {
    const n = g.attributes.position.count, si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
    return g;
  }
  // limb segment: tapered open cylinder from a to b (points [x,y,z]), radii ra/rb, depth squash
  function limb(a, b, ra, rb, seg, color, bone, sq) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new T.CylinderGeometry(rb, ra, len, seg, 1, true);
    if (sq) g.scale(1, 1, sq);
    const dir = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return skinned(prep(g, color), bone);
  }
  function ball(c, r, color, bone, sx, sy, sz, ws, hs) {
    const g = new T.SphereGeometry(r, ws || 6, hs || 4);
    g.scale(sx || 1, sy || 1, sz || 1); g.translate(c[0], c[1], c[2]);
    return skinned(prep(g, color), bone);
  }
  function sbox(cx, cy, cz, sx, sy, sz, color, bone, skip) { return skinned(box(cx, cy, cz, sx, sy, sz, color, skip), bone); }
  // torso-like loft: rows [y, halfWidth, front, back] bottom->top
  function trunk(rows, color, bone, colorFn) {
    const R = rows.map((r) => {
      const y = r[0], hw = r[1], f = r[2], b = r[3];
      const c = (k) => C(colorFn ? colorFn(y, k) : color);
      return [[0, y, f, c(0)], [hw * 0.78, y, f * 0.86, c(1)], [hw, y, 0, c(2)], [hw * 0.8, y, -b * 0.86, c(3)], [0, y, -b, c(4)]];
    });
    return skinned(loft(R, 0, R.length - 1, 0, 4), bone);
  }
  function shoe(x, color, sole, bone) {
    const z0 = -0.075, z1 = 0.185, y0 = 0.0, w = 0.05;
    const top = hexa([[x - w, y0 + 0.02, z0], [x + w, y0 + 0.02, z0], [x + w * 0.95, 0.085, z0 + 0.01], [x - w * 0.95, 0.085, z0 + 0.01],
      [x - w * 0.8, y0 + 0.02, z1], [x + w * 0.8, y0 + 0.02, z1], [x + w * 0.7, 0.05, z1 - 0.02], [x - w * 0.7, 0.05, z1 - 0.02]], color, 'b');
    const so = box(x, 0.012, (z0 + z1) / 2 + 0.003, w * 2.05, 0.024, z1 - z0 + 0.012, sole);
    return [skinned(top, bone), skinned(so, bone)];
  }
  const SKIN = [0xf3cfb3, 0xe8b48f, 0xd29a70, 0xb07a52, 0x8a5a3a, 0x5e3d28];
  const HAIR = [0x120d0a, 0x24170f, 0x3e2717, 0x6d4a2a, 0xb08850, 0x7a7670];
  const SHIRTS = [0xff8fb8, 0x6fe0cf, 0x8cc6ff, 0xfff09a, 0xc9a8ff, 0xf4f1ea, 0xff9f80, 0x9ff0b4, 0xffcfe0, 0x30d0c8, 0xffb347, 0x7a8cff];
  const BOTTOMS = [0xd8c7a0, 0xf0eee8, 0x3b4f7a, 0x2a2f3a, 0x9a8a6a, 0x46566e];
  function outfitFor(kind, seed) {
    if (kind === 'hero') return { skin: 0xe0ac85, hair: 0x15100c, hairStyle: 'slick', top: 0x17181d, sleeve: 0x17181d, fore: 0x17181d, pants: 0x121317, thighLow: 0x121317, shin: 0x121317, shoes: 0x0b0b0c, sole: 0x050505, glasses: true, suit: true, build: 1.04, height: 1.0 };
    if (kind === 'hacker') return { skin: 0xd9a27a, hair: 0x1c130d, hairStyle: 'curly', top: 0x1b2238, sleeve: 0x1b2238, fore: 0x1b2238, pants: 0x2b3550, thighLow: 0x2b3550, shin: 0x2b3550, shoes: 0xe9e9e6, sole: 0x9a9a9a, hoodie: true, build: 0.95, height: 0.97 };
    if (kind === 'cop') return { skin: pick(rng(seed + 11), SKIN), hair: 0x1a120c, hairStyle: 'buzz', top: 0x24345e, sleeve: 0x24345e, fore: 0x24345e, pants: 0x161d33, thighLow: 0x161d33, shin: 0x161d33, shoes: 0x0a0a0a, sole: 0x050505, cop: true, hat: 'police', build: 1.06, height: 1.0 };
    const r = rng((seed >>> 0) * 2654435761 + 7);
    const fem = r() < 0.45, skin = pick(r, SKIN), top = pick(r, SHIRTS), bottom = pick(r, BOTTOMS);
    const tank = r() < 0.3, shorts = r() < 0.55;
    const o = {
      skin: skin, hair: pick(r, HAIR), hairStyle: fem ? (r() < 0.7 ? 'long' : 'bun') : pick(r, ['short', 'short', 'buzz', 'bald', 'curly']),
      top: top, sleeve: tank ? skin : top, fore: skin, pants: bottom, thighLow: shorts ? skin : bottom, shin: shorts ? skin : bottom,
      shoes: pick(r, [0xf2f2f0, 0x222226, 0xc8a070, 0xff6f9a, 0x6ad0ff]), sole: 0xdcdcd8, glasses: r() < 0.3,
      hat: r() < 0.22 ? 'cap' : null, hatColor: pick(r, SHIRTS), fem: fem,
      build: fem ? 0.9 : lerp(0.97, 1.12, r()), height: fem ? lerp(0.9, 0.97, r()) : lerp(0.95, 1.04, r()),
      stripe: r() < 0.35 ? pick(r, SHIRTS) : null,
    };
    return o;
  }
  // ---- chapter 3: the crew (accents match the UI: Yoav gold, Hadar mint, Ido blue)
  const CREW_KINDS = ['yoav', 'hadar', 'ido'];
  const CREW_ACCENT = { yoav: 0xffd23f, hadar: 0x5cf2a8, ido: 0x4da3ff };
  function crewOutfit(kind, masked) {
    let o;
    if (kind === 'yoav') { // the brain: white button-up (open collar, rolled sleeves), grey slacks, brown belt, curls, beard, round specs
      const skin = 0xae7a54;
      o = { skin: skin, hair: 0x0c0907, hairStyle: 'curlyTop', beard: 0x15100c, brows: 0x0c0907, specs: 0x2a221c,
        top: 0xf3f1ec, sleeve: 0xf3f1ec, fore: skin, pants: 0x5d5f64, thighLow: 0x5d5f64, shin: 0x5d5f64,
        shoes: 0x2e2016, sole: 0x120c08, shirt: true, rolled: true, belt: 0x5c3a1f, buckle: 0xc2c5ca, watch: 0x111113,
        build: 1.02, height: 1.0 };
    } else if (kind === 'hadar') { // the muscle: charcoal-green hoodie with a gold chest logo, black cargo shorts, bare shins
      const skin = 0xefc0a5;
      o = { skin: skin, hair: 0x86603e, hairStyle: 'tousled', brows: 0x6a4a30,
        top: 0x2e3632, sleeve: 0x2e3632, fore: 0x2e3632, pants: 0x1b1c1e, thighLow: 0x1b1c1e, shin: skin,
        shoes: 0x131315, sole: 0xe2e0da, socks: 0xecece8, hoodie: true, hoodCol: 0x2a322e, stringCol: 0x232a26, pocketCol: 0x29312d, cuffCol: 0x262d29,
        logo: 0xd0aa48, shortsHem: true, cargo: 0x242528, watch: 0x111113, build: 0.94, height: 0.965 };
    } else { // ido, the driver: sage tee with a black round chest emblem, dark navy-black jeans, short faded hair
      const skin = 0xe8c2a1;
      o = { skin: skin, hair: 0x2b1d13, hairStyle: 'fade', brows: 0x2b1d13,
        top: 0xa3ae9c, sleeve: 0xa3ae9c, fore: skin, pants: 0x1b2030, thighLow: 0x1b2030, shin: 0x1b2030,
        shoes: 0x121214, sole: 0xdcdcd6, shortSleeve: true, tee: true, emblem: 0x0d0d0f, emblemMark: 0xc9d0c2, watch: 0x111113,
        build: 1.0, height: 1.01 };
    }
    if (masked) Object.assign(o, { // heist kit: black tactical clothes, plate carrier, balaclava, gloves, boots
      masked: true, top: 0x17181b, sleeve: 0x17181b, fore: 0x17181b, pants: 0x151619, thighLow: 0x151619, shin: 0x151619,
      shoes: 0x0b0b0c, sole: 0x050505, hands: 0x0d0d0f, balaclava: 0x0e0f11, vest: 0x25282d, patch: 0xc8ccd1, pouch: 0x2c2f35,
      boots: true, kneePads: 0x1f2125, belt: 0x0c0c0d, buckle: 0x3c3e42, holster: 0x0b0b0c, tape: CREW_ACCENT[kind],
      shirt: false, rolled: false, hoodie: false, shortSleeve: false, tee: false, emblem: null, logo: null, watch: null, beard: null,
      hairStyle: 'bald', shortsHem: false, cargo: null, socks: null, helmet: kind === 'hadar' ? 0x2c302a : null,
    });
    o.crew = kind; o.accent = CREW_ACCENT[kind]; o.fem = false;
    return o;
  }
  // a point on the (deformed) head surface: azimuth a (0 = front, +pi/2 = the person's left), polar th (0 = top), scale s
  function headPoint(a, th, s) {
    let x = 0.1 * Math.sin(a) * Math.sin(th), y = 0.1 * Math.cos(th), z = 0.1 * Math.cos(a) * Math.sin(th);
    if (y < 0) { x *= 1 + y * 1.6; z *= 1 + y * 0.6; }
    if (z < 0) z *= 0.92;
    return [x * 0.92 * s, y * 1.12 * s + 1.615, z * s + 0.012];
  }
  // a smooth shell hugging the head (beard, balaclava, helmet): a0..a1 azimuth, th0/th1 polar limits (numbers or fn(a))
  function headShell(a0, a1, nA, th0, th1, nT, s, color) {
    const pos = [], idx = [];
    for (let i = 0; i <= nT; i++) for (let j = 0; j <= nA; j++) {
      const a = lerp(a0, a1, j / nA), t0 = typeof th0 === 'function' ? th0(a) : th0, t1 = typeof th1 === 'function' ? th1(a) : th1;
      const p = headPoint(a, lerp(t0, t1, i / nT), typeof s === 'function' ? s(a) : s); pos.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < nT; i++) for (let j = 0; j < nA; j++) {
      const p = i * (nA + 1) + j, q = p + nA + 1;
      idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); g.computeVertexNormals();
    // make sure it faces away from the head centre
    const n = g.attributes.normal, mid = Math.floor(pos.length / 6);
    const dx = pos[mid * 3], dy = pos[mid * 3 + 1] - 1.615, dz = pos[mid * 3 + 2] - 0.012;
    if (n.getX(mid) * dx + n.getY(mid) * dy + n.getZ(mid) * dz < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
    return skinned(prep(g, color), BN.head);
  }
  function crewHair(o, out) {
    const H = BN.head, st = o.hairStyle;
    if (st === 'curlyTop') { // a big rounded mop of tight black curls on top, short at the sides
      const cap = new T.SphereGeometry(0.106, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
      cap.rotateX(-0.36); cap.scale(0.95, 1.1, 1.06); cap.translate(0, 1.628, -0.006);
      out.push(skinned(prep(cap, o.hair), H));
      const cy = 1.695, rx = 0.1, ry = 0.072, rz = 0.112;
      out.push(ball([0, cy, -0.004], 0.1, o.hair, H, 1.0, 0.68, 1.1, 10, 6));
      const r = rng(131);
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, side = Math.abs(Math.sin(a)), el = Math.sqrt(r()) * (1.25 - 0.35 * side);
        const dx = Math.sin(a) * Math.sin(el), dy = Math.cos(el), dz = Math.cos(a) * Math.sin(el);
        const g = new T.IcosahedronGeometry(0.022 + r() * 0.014, 0);
        g.translate(dx * rx, cy + dy * ry + (dz > 0.3 ? 0.008 : 0), dz * rz - 0.004);
        out.push(skinned(prep(g, i % 3 ? o.hair : 0x1d1612), H));
      }
    } else if (st === 'tousled') { // short, messy light-brown hair pushed forward into a fringe
      const cap = new T.SphereGeometry(0.108, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
      cap.rotateX(-0.4); cap.scale(0.95, 1.1, 1.06); cap.translate(0, 1.628, -0.004);
      out.push(skinned(prep(cap, o.hair), H));
      out.push(ball([0, 1.69, 0.0], 0.092, o.hair, H, 1.0, 0.52, 1.1, 9, 5));
      const r = rng(57);
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, el = 0.1 + r() * 0.9, rad = 0.098;
        const g = new T.ConeGeometry(0.024, 0.04 + r() * 0.015, 4);
        const dir = new T.Vector3(Math.sin(a) * Math.sin(el) * 0.6, 0.55, Math.cos(a) * Math.sin(el) * 0.4 + 0.9).normalize();
        g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir)));
        g.translate(Math.sin(a) * Math.sin(el) * rad * 0.95, 1.665 + Math.cos(el) * rad * 0.62, Math.cos(a) * Math.sin(el) * rad * 1.06);
        out.push(skinned(prep(g, i % 4 ? o.hair : 0x9c7452), H));
      }
      [-0.04, 0.0, 0.04].forEach((x) => out.push(ball([x, 1.69 - Math.abs(x) * 0.35, 0.09], 0.032, o.hair, H, 1.15, 0.5, 0.8, 6, 4)));
    } else if (st === 'fade') { // short dark top, faded sides, a small front quiff
      const side = new T.Color(o.hair).lerp(new T.Color(o.skin), 0.22).getHex();
      const cap = new T.SphereGeometry(0.103, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.48);
      cap.rotateX(-0.42); cap.scale(0.95, 1.12, 1.06); cap.translate(0, 1.627, -0.004);
      out.push(skinned(prep(cap, side), H));
      const top = new T.SphereGeometry(0.1, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.36);
      top.rotateX(-0.25); top.scale(0.96, 1.05, 1.08); top.translate(0, 1.645, 0.0);
      out.push(skinned(prep(top, o.hair), H));
      out.push(ball([0, 1.716, 0.058], 0.04, o.hair, H, 1.5, 0.55, 0.9, 7, 4));
    }
  }
  function roundSpecs(col, out) { // thin round frames with clear lenses
    const H = BN.head, y = 1.629, z = 0.117;
    [1, -1].forEach((sd) => {
      const rim = new T.TorusGeometry(0.0215, 0.0027, 4, 14); rim.translate(sd * 0.041, y, z);
      out.push(skinned(prep(rim, col), H));
      out.push(skinned(hexa([[sd * 0.0625 - 0.002, y - 0.002, z - 0.004], [sd * 0.0625 + 0.002, y - 0.002, z - 0.004], [sd * 0.0625 + 0.002, y + 0.002, z - 0.004], [sd * 0.0625 - 0.002, y + 0.002, z - 0.004],
        [sd * 0.094 - 0.002, y + 0.004, 0.004], [sd * 0.094 + 0.002, y + 0.004, 0.004], [sd * 0.094 + 0.002, y + 0.008, 0.004], [sd * 0.094 - 0.002, y + 0.008, 0.004]], col), H));
    });
    out.push(sbox(0, y + 0.006, z + 0.001, 0.02, 0.004, 0.004, col, H));
  }
  function crewHead(o, out) {
    const H = BN.head;
    if (o.beard) { // short full beard: cheeks, jaw, chin and moustache in one shell; lips drawn over it
      const A = Math.PI * 0.45;
      out.push(headShell(-A, A, 14, (a) => Math.PI * (0.585 - 0.145 * smooth01((Math.abs(a) / A - 0.15) / 0.8)), Math.PI * 0.94, 6, 1.07, o.beard));
      const s = 1.07, th = Math.acos(clamp((1.566 - 1.615) / (0.112 * s), -1, 1)), pz = headPoint(0, th, s)[2];
      out.push(sbox(0, 1.566, pz + 0.002, 0.036, 0.011, 0.012, 0x7a463a, H));
    }
    if (o.balaclava) { // full head cover with an eye slit
      const As = Math.PI * 0.22, s = 1.045, tTop = Math.PI * 0.409, tBot = Math.PI * 0.508;
      out.push(headShell(As, Math.PI * 2 - As, 18, 0.0, Math.PI * 0.93, 10, s, o.balaclava));
      out.push(headShell(-As, As, 6, 0.0, tTop, 5, s, o.balaclava));
      out.push(headShell(-As, As, 6, tBot, Math.PI * 0.93, 6, s, o.balaclava));
    }
    if (o.helmet) { // high-cut ballistic helmet with side rails, a NVG shroud, chin strap and an ID tape strip
      const edge = (a) => Math.PI * (0.4 - 0.05 * Math.pow(Math.max(0, Math.cos(a)), 2) + 0.16 * Math.pow(Math.max(0, -Math.cos(a)), 2));
      out.push(headShell(0, Math.PI * 2, 20, 0.0, edge, 6, 1.21, o.helmet));
      // rim: a band facing down between the shell and the head
      const pos = [], idx = [], nA = 20;
      for (let j = 0; j <= nA; j++) { const a = j / nA * Math.PI * 2, p0 = headPoint(a, edge(a), 1.21), p1 = headPoint(a, edge(a) - 0.04, 1.08); pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]); }
      for (let j = 0; j < nA; j++) { const p = j * 2; idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
      const rim = new T.BufferGeometry(); rim.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); rim.setIndex(idx); rim.computeVertexNormals();
      if (rim.attributes.normal.getY(0) > 0) { const ix = rim.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } rim.computeVertexNormals(); }
      out.push(skinned(prep(rim, 0x1b1d1a), H));
      [1, -1].forEach((sd) => {
        const p = headPoint(sd * Math.PI / 2, Math.PI * 0.36, 1.25);
        out.push(sbox(p[0], p[1], p[2] + 0.005, 0.014, 0.026, 0.13, 0x151614, H));
        const a = headPoint(sd * Math.PI * 0.47, Math.PI * 0.42, 1.12), b = headPoint(sd * Math.PI * 0.2, Math.PI * 0.86, 1.07);
        out.push(skinned(hexa([[a[0] - 0.004, a[1], a[2] - 0.008], [a[0] + 0.004, a[1], a[2] - 0.008], [a[0] + 0.004, a[1], a[2] + 0.008], [a[0] - 0.004, a[1], a[2] + 0.008],
          [b[0] - 0.004, b[1], b[2] - 0.008], [b[0] + 0.004, b[1], b[2] - 0.008], [b[0] + 0.004, b[1], b[2] + 0.008], [b[0] - 0.004, b[1], b[2] + 0.008]], 0x0c0c0c), H));
      });
      const f = headPoint(0, Math.PI * 0.27, 1.24); out.push(sbox(f[0], f[1], f[2], 0.06, 0.036, 0.022, 0x161715, H));
      const bk = headPoint(Math.PI, Math.PI * 0.34, 1.215); out.push(sbox(bk[0], bk[1], bk[2] - 0.004, 0.075, 0.022, 0.012, o.tape || 0xffffff, H));
    } else if (o.tape && o.balaclava) { // ID tape across the back of the balaclava
      const bk = headPoint(Math.PI, Math.PI * 0.3, 1.05); out.push(sbox(bk[0], bk[1], bk[2] - 0.004, 0.06, 0.016, 0.01, o.tape, H));
    }
    if (o.specs) roundSpecs(o.specs, out);
  }
  function smooth01(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function headParts(o, out) {
    const H = BN.head, hc = [0, 1.615, 0.012];
    const head = new T.SphereGeometry(0.1, 10, 8);
    const hp = head.attributes.position;
    for (let i = 0; i < hp.count; i++) { // gentle jaw taper + flatter back
      const y = hp.getY(i), z = hp.getZ(i);
      if (y < 0) { hp.setX(i, hp.getX(i) * (1 + y * 1.6)); hp.setZ(i, z * (1 + y * 0.6)); }
      if (z < 0) hp.setZ(i, hp.getZ(i) * 0.92);
    }
    head.scale(0.92, 1.12, 1.0); head.translate(hc[0], hc[1], hc[2]);
    out.push(skinned(prep(head, o.skin), H));
    const bal = o.balaclava, cover = bal || o.skin;
    out.push(limb([0, 1.44, -0.005], [0, 1.56, 0.0], 0.052, 0.047, 7, cover, H));
    out.push(ball([0.093, 1.612, 0.0], 0.022, cover, H, 0.5, 1.2, 0.9, 5, 3), ball([-0.093, 1.612, 0.0], 0.022, cover, H, 0.5, 1.2, 0.9, 5, 3)); // ears
    if (bal) out.push(skinned(hexa([[-0.016, 1.582, 0.1], [0.016, 1.582, 0.1], [0.011, 1.632, 0.1], [-0.011, 1.632, 0.1],
      [-0.013, 1.582, 0.126], [0.013, 1.582, 0.126], [0.006, 1.614, 0.117], [-0.006, 1.614, 0.117]], bal, 'k'), H)); // covered nose
    else out.push(skinned(hexa([[-0.012, 1.585, 0.1], [0.012, 1.585, 0.1], [0.008, 1.63, 0.1], [-0.008, 1.63, 0.1],
      [-0.01, 1.585, 0.122], [0.01, 1.585, 0.122], [0.004, 1.615, 0.112], [-0.004, 1.615, 0.112]], o.skin, 'k'), H)); // nose
    if (o.glasses) {
      out.push(sbox(0, 1.637, 0.104, 0.175, 0.012, 0.012, 0x0a0a0c, H));
      out.push(sbox(0.042, 1.628, 0.108, 0.068, 0.04, 0.012, 0x050507, H), sbox(-0.042, 1.628, 0.108, 0.068, 0.04, 0.012, 0x050507, H));
      out.push(sbox(0.088, 1.632, 0.05, 0.008, 0.01, 0.11, 0x0a0a0c, H), sbox(-0.088, 1.632, 0.05, 0.008, 0.01, 0.11, 0x0a0a0c, H));
    } else {
      out.push(sbox(0.037, 1.63, 0.1, 0.024, 0.012, 0.01, 0x17110e, H), sbox(-0.037, 1.63, 0.1, 0.024, 0.012, 0.01, 0x17110e, H));
      if (o.crew) { if (!bal) out.push(sbox(0.038, 1.652, 0.1, 0.036, 0.011, 0.012, o.brows || o.hair, H), sbox(-0.038, 1.652, 0.1, 0.036, 0.011, 0.012, o.brows || o.hair, H)); }
      else out.push(sbox(0.038, 1.652, 0.099, 0.034, 0.008, 0.01, o.hair, H), sbox(-0.038, 1.652, 0.099, 0.034, 0.008, 0.01, o.hair, H));
    }
    if (!bal && !o.beard) out.push(sbox(0, 1.565, 0.095, 0.04, 0.008, 0.01, 0xa0645a, H)); // mouth hint
    if (o.crew) { crewHead(o, out); if (!bal) crewHair(o, out); }
    // hair
    const st = o.hairStyle;
    if (st !== 'bald' && !o.crew) {
      const thetaLen = st === 'buzz' ? Math.PI * 0.46 : Math.PI * 0.56;
      const slick = st === 'slick';
      const cap = new T.SphereGeometry(st === 'buzz' ? 0.103 : 0.109, 10, 5, 0, Math.PI * 2, 0, slick ? Math.PI * 0.5 : thetaLen);
      cap.rotateX(slick ? -0.62 : -0.42); cap.scale(0.95, slick ? 1.02 : 1.12, 1.06); cap.translate(0, slick ? 1.636 : 1.627, slick ? -0.008 : -0.004);
      out.push(skinned(prep(cap, o.hair), H));
      if (slick) out.push(ball([0, 1.705, -0.01], 0.082, o.hair, H, 1.08, 0.5, 1.28, 7, 4));
      if (st === 'curly') {
        const rr = rng(77);
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * Math.PI * 2, rad = 0.06 + rr() * 0.03;
          const g = new T.IcosahedronGeometry(0.036 + rr() * 0.012, 0);
          const front = Math.sin(a) > 0.3;
          g.translate(Math.cos(a) * rad, 1.705 + rr() * 0.03 + (front ? 0.022 : 0), Math.sin(a) * rad - (front ? 0.03 : 0.005));
          out.push(skinned(prep(g, o.hair), H));
        }
        out.push(ball([0, 1.725, 0.0], 0.065, o.hair, H, 1.2, 0.7, 1.2, 7, 4));
      }
      if (st === 'long') out.push(skinned(hexa([[-0.1, 1.38, -0.09], [0.1, 1.38, -0.09], [0.11, 1.66, -0.07], [-0.11, 1.66, -0.07],
        [-0.09, 1.4, -0.03], [0.09, 1.4, -0.03], [0.1, 1.66, 0.0], [-0.1, 1.66, 0.0]], o.hair), H));
      if (st === 'bun') out.push(ball([0, 1.7, -0.1], 0.05, o.hair, H, 1, 1, 1, 6, 4));
    }
    if (o.hat === 'police') {
      out.push(limb([0, 1.69, 0.0], [0, 1.76, -0.005], 0.112, 0.122, 10, 0x1b2644, H));
      out.push(sbox(0, 1.763, -0.003, 0.25, 0.012, 0.25, 0x1b2644, H));
      out.push(sbox(0, 1.69, 0.12, 0.17, 0.012, 0.08, 0x060608, H));
      out.push(sbox(0, 1.705, 0.113, 0.21, 0.016, 0.012, 0xc9a24a, H));
      out.push(sbox(0, 1.735, 0.12, 0.035, 0.04, 0.01, 0xe0c060, H));
    } else if (o.hat === 'cap') {
      const cap = new T.SphereGeometry(0.113, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
      cap.scale(0.97, 0.85, 1.05); cap.translate(0, 1.655, 0.0);
      out.push(skinned(prep(cap, o.hatColor), H));
      out.push(sbox(0, 1.662, 0.14, 0.15, 0.012, 0.09, o.hatColor, H));
    }
  }
  function bodyParts(o, out) {
    const sx = BIND.shoulderX, sy = BIND.shoulderY, ey = BIND.elbowY, wy = BIND.wristY, hx = BIND.hipX, hy = BIND.hipY, ky = BIND.kneeY;
    const fem = o.fem;
    // torso (spine)
    const topFn = (y, k) => {
      return o.top;
    };
    const sh = fem ? 0.178 : 0.205;
    const TR = [[1.0, 0.152, 0.095, 0.09], [1.12, fem ? 0.13 : 0.148, 0.1, 0.092], [1.28, sh * 0.9, fem ? 0.122 : 0.118, 0.104],
      [1.39, sh, 0.1, 0.092], [1.445, sh * 0.78, 0.07, 0.07], [1.485, 0.07, 0.05, 0.05]];
    out.push(trunk(TR, o.top, BN.spine, topFn));
    const trAt = (y) => { // interpolated torso row at height y
      for (let i = 1; i < TR.length; i++) if (y <= TR[i][0]) { const a = TR[i - 1], b = TR[i], t = (y - a[0]) / (b[0] - a[0]); return [y, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
      return TR[TR.length - 1];
    };
    // a strip lying on the chest front between x = w0(y)..w1(y), mirrored
    const chestStrip = (ys, w0, w1, lift, color) => {
      const rows = ys.map((y) => { const r = trAt(y), z0 = r[2] * (1 - 0.14 * Math.pow(w0(y) / (r[1] * 0.78), 2)) + lift, z1 = r[2] * (1 - 0.14 * Math.pow(w1(y) / (r[1] * 0.78), 2)) + lift;
        return [[w0(y), y, z0, C(color)], [w1(y), y, z1, C(color)]]; });
      return skinned(loft(rows, 0, rows.length - 1, 0, 1), BN.spine);
    };
    if (o.stripe) { const b0 = trAt(1.215), b1 = trAt(1.265); out.push(trunk([[1.215, b0[1] + 0.004, b0[2] + 0.004, b0[3] + 0.004], [1.265, b1[1] + 0.004, b1[2] + 0.004, b1[3] + 0.004]], o.stripe, BN.spine)); }
    if (o.suit) { // white shirt V, jacket lapels, collar, skirt
      const vy = [1.17, 1.24, 1.31, 1.38, 1.44], vw = (y) => Math.max(0, (y - 1.17) / 0.27) * 0.064;
      out.push(chestStrip(vy, () => 0, vw, 0.004, 0xf2f2f0));
      out.push(chestStrip(vy, vw, (y) => vw(y) + 0.03 + (y - 1.17) * 0.06, 0.007, 0x2a2b33));
      out.push(skinned(hexa([[-0.06, 1.44, 0.03], [0.06, 1.44, 0.03], [0.055, 1.5, 0.035], [-0.055, 1.5, 0.035],
        [-0.065, 1.44, 0.075], [0.065, 1.44, 0.075], [0.05, 1.49, 0.06], [-0.05, 1.49, 0.06]], 0xf4f4f2, 'b'), BN.spine));
      out.push(sbox(0, 1.06, 0.098, 0.03, 0.012, 0.01, 0x9aa0a8, BN.spine));
      out.push(trunk([[0.9, 0.168, 0.108, 0.1], [1.04, 0.158, 0.104, 0.096]], o.top, BN.hips, (y, k) => (k === 0 ? 0x101115 : o.top)));
    }
    if (o.hoodie) { // hood bunched behind the neck, drawstrings, kangaroo pocket
      const hood = new T.TorusGeometry(0.1, 0.045, 5, 10, Math.PI * 1.25);
      hood.rotateX(Math.PI / 2); hood.rotateY(Math.PI * 0.125 + Math.PI); hood.scale(1.05, 1, 0.9); hood.translate(0, 1.46, -0.02);
      out.push(skinned(prep(hood, o.hoodCol || 0x1f2842), BN.spine));
      const sc = o.stringCol || 0xe8e8e8;
      out.push(sbox(0.03, 1.34, 0.112, 0.008, 0.11, 0.008, sc, BN.spine), sbox(-0.03, 1.34, 0.112, 0.008, 0.11, 0.008, sc, BN.spine));
      out.push(sbox(0, 1.12, 0.1, 0.2, 0.1, 0.012, o.pocketCol || 0x161d31, BN.spine));
      out.push(trunk([[0.94, 0.158, 0.1, 0.095], [1.03, 0.155, 0.103, 0.095]], o.top, BN.hips));
    }
    if (o.cop) { // belt, badge, shoulder patches, radio
      out.push(trunk([[1.0, 0.158, 0.104, 0.098], [1.055, 0.156, 0.104, 0.098]], 0x0a0a0b, BN.hips));
      out.push(sbox(0, 1.028, 0.106, 0.045, 0.035, 0.01, 0xd8b04a, BN.hips));
      out.push(sbox(0.08, 1.33, 0.112, 0.04, 0.05, 0.01, 0xe0c060, BN.spine));
      out.push(sbox(-0.07, 1.36, 0.108, 0.04, 0.06, 0.02, 0x0c0c0c, BN.spine));
      out.push(sbox(0.13, 1.025, 0.04, 0.05, 0.09, 0.07, 0x0c0c0c, BN.hips));
    }
    if (o.crew) crewBody(o, out, trAt, chestStrip);
    // pelvis
    out.push(trunk([[0.865, 0.158, 0.092, 0.104], [0.95, fem ? 0.175 : 0.166, 0.098, 0.11], [1.03, 0.155, 0.097, 0.094]], o.pants, BN.hips));
    out.push(sbox(0, 0.87, 0.0, 0.1, 0.05, 0.12, o.pants, BN.hips));
    // arms
    [1, -1].forEach((sd) => {
      const U = sd > 0 ? BN.uArmL : BN.uArmR, F = sd > 0 ? BN.fArmL : BN.fArmR;
      const s0 = [sd * sx, sy, 0], e0 = [sd * (sx + 0.025), ey, -0.005], w0 = [sd * (sx + 0.035), wy, 0.01];
      out.push(ball([sd * (sx - 0.002), sy - 0.022, 0], 0.056, o.sleeve, U, 1.0, 0.95, 0.95, 7, 5));
      if (o.shortSleeve) { // loose tee sleeve to mid upper arm, bare arm below
        const m0 = [lerp(s0[0], e0[0], 0.5), lerp(s0[1], e0[1], 0.5), lerp(s0[2], e0[2], 0.5)], m1 = [lerp(s0[0], e0[0], 0.4), lerp(s0[1], e0[1], 0.4), lerp(s0[2], e0[2], 0.4)];
        out.push(limb(s0, m0, 0.067, 0.064, 8, o.sleeve, U, 0.95), limb(m1, e0, 0.05, 0.046, 7, o.skin, U, 0.95));
      } else out.push(limb(s0, e0, 0.058, 0.047, 7, o.sleeve, U, 0.95));
      out.push(ball([e0[0], e0[1], e0[2]], 0.046, o.shortSleeve ? o.skin : o.fore === o.sleeve ? o.fore : o.sleeve, F, 1, 1, 1, 6, 4));
      out.push(limb(e0, w0, 0.046, 0.036, 7, o.fore, F, 0.92));
      if (o.suit) out.push(limb([w0[0], w0[1] + 0.03, w0[2]], [w0[0], w0[1] - 0.005, w0[2]], 0.039, 0.039, 7, 0xf4f4f2, F));
      if (o.hoodie) out.push(limb([w0[0], w0[1] + 0.05, w0[2]], [w0[0], w0[1] + 0.005, w0[2]], 0.04, 0.038, 7, o.cuffCol || 0x161d31, F));
      if (o.crew) crewArm(o, out, sd, U, F, s0, e0, w0);
      // hand
      out.push(skinned(hexa([[w0[0] - 0.016, wy - 0.088, -0.028], [w0[0] + 0.016, wy - 0.088, -0.028], [w0[0] + 0.022, wy - 0.005, -0.038], [w0[0] - 0.022, wy - 0.005, -0.038],
        [w0[0] - 0.014, wy - 0.085, 0.042], [w0[0] + 0.014, wy - 0.085, 0.042], [w0[0] + 0.022, wy - 0.005, 0.048], [w0[0] - 0.022, wy - 0.005, 0.048]], o.hands || o.skin), F));
    });
    // legs
    [1, -1].forEach((sd) => {
      const TH = sd > 0 ? BN.thighL : BN.thighR, SH = sd > 0 ? BN.shinL : BN.shinR, x = sd * hx;
      const midY = (hy + ky) / 2 + 0.06;
      out.push(limb([x, hy + 0.03, 0], [x, midY, 0.005], 0.096, 0.08, 8, o.pants, TH));
      out.push(limb([x, midY, 0.005], [sd * (hx - 0.005), ky, 0.01], 0.08, 0.062, 8, o.thighLow, TH));
      out.push(ball([sd * (hx - 0.005), ky, 0.012], 0.061, o.thighLow === o.pants ? o.shin : o.thighLow, SH, 1, 1, 1, 6, 4));
      out.push(limb([sd * (hx - 0.005), ky, 0.01], [sd * (hx - 0.008), 0.3, -0.018], 0.06, 0.056, 8, o.shin, SH));
      out.push(limb([sd * (hx - 0.008), 0.3, -0.018], [sd * (hx - 0.01), 0.1, -0.008], 0.056, 0.042, 8, o.shin, SH));
      if (o.shin !== o.pants && o.thighLow !== o.pants) {} // bare legs
      if (o.crew) crewLeg(o, out, sd, TH, SH);
      shoe(sd * (hx - 0.01), o.shoes, o.sole, SH).forEach((g) => out.push(g));
    });
  }
  function push2s(out, g, bone) { out.push(skinned(g, bone), skinned(mirrorX(g), bone)); }
  const L3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function crewBody(o, out, trAt, chestStrip) {
    const S = BN.spine, HP = BN.hips;
    const chestZ = (x, y) => { const r = trAt(y); return r[2] * (1 - 0.14 * Math.min(1, Math.abs(x) / (r[1] * 0.78))); };
    if (o.shirt) { // white button-up: open collar (skin V, collar band, two open points), placket + buttons, tucked into a belt
      out.push(chestStrip([1.37, 1.405, 1.44, 1.475], () => 0, (y) => 0.006 + (y - 1.37) * 0.45, 0.0035, o.skin));
      const band = new T.CylinderGeometry(0.063, 0.071, 0.052, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4);
      band.translate(0, 1.474, -0.012); out.push(skinned(prep(band, o.top), S));
      push2s(out, hexa([[0.046, 1.398, 0.098], [0.096, 1.418, 0.074], [0.07, 1.482, 0.04], [0.04, 1.49, 0.056],
        [0.046, 1.398, 0.105], [0.096, 1.418, 0.081], [0.07, 1.482, 0.047], [0.04, 1.49, 0.063]], 0xf7f5f0), S);
      out.push(chestStrip([1.02, 1.2, 1.37], () => 0, () => 0.012, 0.0045, 0xe8e6e0));
      [1.1, 1.18, 1.26, 1.34].forEach((y) => out.push(sbox(0, y, chestZ(0, y) + 0.008, 0.008, 0.008, 0.004, 0xc9c7c0, S)));
      push2s(out, box(0.07, 1.06, chestZ(0.07, 1.06) - 0.004, 0.06, 0.004, 0.01, 0xdedcd6), S); // tuck folds
    }
    if (o.tee) { // ribbed crew neck, untucked hem
      const neck = new T.TorusGeometry(0.06, 0.011, 5, 14); neck.rotateX(Math.PI / 2); neck.scale(1.02, 1, 0.9); neck.translate(0, 1.478, -0.006);
      out.push(skinned(prep(neck, 0x939e8c), S));
      out.push(trunk([[0.935, 0.166, 0.106, 0.102], [1.035, 0.16, 0.104, 0.098]], o.top, HP));
    }
    if (o.emblem) { // small black round emblem on the left chest with a light cross mark
      const x = 0.072, y = 1.318, z = chestZ(x, y) + 0.004;
      out.push(skinned(cyl(0.026, 0.026, 0.005, 12, 'z', x, y, z, o.emblem), S));
      [1, -1].forEach((r) => out.push(skinned(xf(box(0, 0, 0, 0.033, 0.0055, 0.003, o.emblemMark), [x, y, z + 0.003], [0, 0, r * Math.PI / 4]), S)));
      out.push(skinned(cyl(0.007, 0.007, 0.004, 8, 'z', x, y, z + 0.004, o.emblem), S));
    }
    if (o.logo) { // the hoodie's small gold chest logo
      const x = 0.06, y = 1.33, z = chestZ(x, y) + 0.012;
      out.push(sbox(x, y, z, 0.034, 0.028, 0.006, o.logo, S), sbox(x, y - 0.002, z + 0.0035, 0.013, 0.013, 0.003, 0x3b2c10, S));
      out.push(sbox(x, y + 0.026, z - 0.001, 0.05, 0.006, 0.004, 0x9a7d34, S));
    }
    if (o.belt && !o.vest) { // trouser belt
      out.push(trunk([[0.995, 0.161, 0.106, 0.101], [1.04, 0.159, 0.106, 0.1]], o.belt, HP));
      out.push(sbox(0, 1.0175, 0.108, 0.042, 0.03, 0.01, o.buckle, HP));
    }
    if (o.vest) { // plate carrier: front/back plates, shoulder straps, light chest patch, magazine pouches; duty belt
      out.push(trunk([[1.03, 0.166, 0.126, 0.118], [1.14, 0.17, 0.132, 0.12], [1.27, 0.19, 0.14, 0.124], [1.37, 0.186, 0.13, 0.116], [1.405, 0.15, 0.106, 0.1]], o.vest, S));
      [1, -1].forEach((sd) => out.push(sbox(sd * 0.105, 1.452, 0.0, 0.056, 0.024, 0.21, o.vest, S)));
      out.push(sbox(0, 1.305, 0.141, 0.13, 0.042, 0.006, o.patch, S));
      [-0.036, 0, 0.036].forEach((x) => out.push(sbox(x, 1.305, 0.1445, 0.024, 0.014, 0.002, 0x24262a, S)));
      [-0.078, 0, 0.078].forEach((x) => { out.push(sbox(x, 1.118, 0.146, 0.056, 0.078, 0.036, o.pouch, S)); out.push(sbox(x, 1.16, 0.148, 0.06, 0.016, 0.04, o.vest, S)); });
      out.push(sbox(0.112, 1.37, 0.124, 0.036, 0.072, 0.026, 0x1a1b1e, S), sbox(0.112, 1.42, 0.124, 0.006, 0.04, 0.006, 0x111113, S)); // radio + antenna
      out.push(sbox(0, 1.25, -0.128, 0.16, 0.2, 0.012, 0x1f2226, S)); // back panel
      out.push(trunk([[0.985, 0.168, 0.11, 0.106], [1.035, 0.166, 0.11, 0.106]], o.belt, HP));
      out.push(sbox(0, 1.01, 0.112, 0.05, 0.034, 0.012, o.buckle, HP));
      [1, -1].forEach((sd) => out.push(sbox(sd * 0.13, 1.005, 0.07, 0.045, 0.06, 0.045, o.pouch, HP)));
    }
  }
  function crewArm(o, out, sd, U, F, s0, e0, w0) {
    if (o.rolled) { // sleeve over the elbow, a rolled cuff, bare forearm
      out.push(limb(e0, L3(e0, w0, 0.24), 0.05, 0.047, 7, o.sleeve, F, 0.95));
      out.push(limb(L3(e0, w0, 0.16), L3(e0, w0, 0.3), 0.055, 0.053, 7, 0xe3e1da, F, 0.95));
    }
    if (o.watch && sd > 0) { // black watch on the left wrist
      out.push(limb([w0[0], w0[1] + 0.05, w0[2]], [w0[0], w0[1] + 0.02, w0[2]], 0.0405, 0.0395, 8, o.watch, F, 0.92));
      out.push(sbox(w0[0] + 0.039, w0[1] + 0.035, w0[2], 0.012, 0.032, 0.032, 0x1d1f22, F), sbox(w0[0] + 0.0455, w0[1] + 0.035, w0[2], 0.002, 0.024, 0.024, 0x56606c, F));
    }
    if (o.tape) out.push(limb(L3(s0, e0, 0.3), L3(s0, e0, 0.44), 0.0615, 0.059, 7, o.tape, U, 0.95)); // team ID tape
    if (o.hands) out.push(limb([w0[0], w0[1] + 0.04, w0[2]], [w0[0], w0[1] - 0.004, w0[2]], 0.041, 0.042, 7, o.hands, F, 0.92)); // glove cuff
  }
  function crewLeg(o, out, sd, TH, SH) {
    const hx = BIND.hipX, ky = BIND.kneeY;
    if (o.shortsHem) out.push(limb([sd * (hx - 0.004), ky + 0.12, 0.008], [sd * (hx - 0.005), ky + 0.035, 0.01], 0.08, 0.078, 9, o.pants, TH)); // loose knee-length shorts
    if (o.cargo) out.push(sbox(sd * (hx + 0.079), 0.69, 0.012, 0.026, 0.12, 0.11, o.cargo, TH), sbox(sd * (hx + 0.082), 0.748, 0.012, 0.028, 0.024, 0.114, o.pants, TH));
    if (o.socks) out.push(limb([sd * (hx - 0.01), 0.155, -0.012], [sd * (hx - 0.01), 0.08, -0.008], 0.047, 0.046, 8, o.socks, SH));
    if (o.boots) out.push(limb([sd * (hx - 0.01), 0.21, -0.012], [sd * (hx - 0.01), 0.07, -0.006], 0.061, 0.058, 8, o.shoes, SH));
    if (o.kneePads) out.push(sbox(sd * (hx - 0.005), ky - 0.01, 0.064, 0.086, 0.11, 0.03, o.kneePads, SH));
    if (o.holster && sd < 0) {
      out.push(sbox(sd * (hx + 0.086), 0.76, 0.03, 0.036, 0.17, 0.085, o.holster, TH));
      out.push(limb([sd * hx, 0.705, 0.008], [sd * hx, 0.675, 0.008], 0.087, 0.085, 8, o.holster, TH));
    }
  }

  function buildBones() {
    const b = [];
    for (let i = 0; i < 12; i++) b.push(new T.Bone());
    const P = (i, parent, x, y, z) => { b[i].position.set(x, y, z); if (parent >= 0) b[parent].add(b[i]); };
    P(0, -1, 0, 0, 0); P(1, 0, 0, BIND.hips, 0); P(2, 1, 0, BIND.spine - BIND.hips, 0); P(3, 2, 0, BIND.head - BIND.spine, 0);
    P(4, 2, BIND.shoulderX, BIND.shoulderY - BIND.spine, 0); P(5, 4, 0.025, BIND.elbowY - BIND.shoulderY, -0.005);
    P(6, 2, -BIND.shoulderX, BIND.shoulderY - BIND.spine, 0); P(7, 6, -0.025, BIND.elbowY - BIND.shoulderY, -0.005);
    P(8, 1, BIND.hipX, BIND.hipY - BIND.hips, 0); P(9, 8, 0, BIND.kneeY - BIND.hipY, 0);
    P(10, 1, -BIND.hipX, BIND.hipY - BIND.hips, 0); P(11, 10, 0, BIND.kneeY - BIND.hipY, 0);
    const names = Object.keys(BN); b.forEach((bn, i) => { bn.name = names[i]; });
    return b;
  }
  function terminalTexture() {
    if (TEX.term) return TEX.term;
    const cv = canvas(256, 160), g = cv.getContext('2d');
    g.fillStyle = '#020a05'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#0d2a18'; g.fillRect(0, 0, 256, 14);
    g.font = 'bold 9px monospace'; g.fillStyle = '#7dffb0'; g.fillText('root@bigscore:~# ./vault_bypass --silent', 4, 10);
    const r = rng(5), words = ['ssh', 'decrypt', '0x7f3a', 'AUTH', 'OK', 'bypass', 'grid', 'vault', '>>>', 'PING', 'cam_04 OFF', 'loop', 'inject', '[####  ]', 'ACCESS'];
    for (let i = 0; i < 13; i++) {
      let line = ''; const n = 2 + Math.floor(r() * 5);
      for (let j = 0; j < n; j++) line += pick(r, words) + ' ';
      g.fillStyle = r() < 0.15 ? '#ffffff' : (r() < 0.5 ? '#38f07a' : '#1fb85a');
      g.fillText(line, 6 + (r() < 0.3 ? 12 : 0), 26 + i * 10.5);
    }
    g.fillStyle = '#38f07a'; g.fillRect(6, 150, 7, 2);
    const t = texFrom(cv); TEX.term = t; return t;
  }
  function laptop() {
    if (!GEO.laptop) {
      const parts = [];
      parts.push(box(0, 0.009, 0, 0.32, 0.018, 0.22, 0x3a3d44));
      parts.push(box(0, 0.0185, 0.01, 0.28, 0.002, 0.12, 0x101114));
      parts.push(box(0, 0.0185, -0.07, 0.08, 0.002, 0.05, 0x24262b));
      const lid = box(0, 0.105, 0, 0.32, 0.21, 0.01, 0x2e3138); lid.rotateX(0.3); lid.translate(0, 0.018, 0.108);
      parts.push(lid);
      GEO.laptop = merge(parts);
      const sc = new T.PlaneGeometry(0.29, 0.18); sc.rotateY(Math.PI); // faces -z (toward the user)
      sc.translate(0, 0.105, -0.0062); sc.rotateX(0.3); sc.translate(0, 0.018, 0.108);
      GEO.screen = prep(sc);
      MAT.laptop = new T.MeshStandardMaterial({ vertexColors: true, metalness: ENV ? 0.6 : 0.2, roughness: 0.35, envMap: ENV });
      MAT.screen = new T.MeshBasicMaterial({ map: terminalTexture(), toneMapped: false });
    }
    const g = new T.Group(); g.name = 'laptop';
    g.add(new T.Mesh(GEO.laptop, MAT.laptop));
    const s = new T.Mesh(GEO.screen, MAT.screen); s.name = 'screen'; g.add(s);
    const gm = glowMaterial(); gm.uniforms.inten.value[CH.AUX] = 1;
    const gl = new T.Mesh(glowGeo([{ p: [0, 0.12, 0.09], c: 0x1c7a40, s: 0.4, ch: CH.AUX, d: [0, 0.3, -0.95] }]), gm); gl.renderOrder = 5;
    g.add(gl);
    return g;
  }
  function duffel() {
    if (!GEO.duffel) {
      const parts = [], blk = 0x121215, strap = 0x2a2a30;
      const body = new T.CylinderGeometry(0.145, 0.145, 0.52, 10, 1, false); body.rotateX(Math.PI / 2); body.scale(1, 0.95, 1); body.translate(0, -0.27, 0);
      parts.push(prep(body, blk));
      const endA = new T.CylinderGeometry(0.15, 0.15, 0.02, 10); endA.rotateX(Math.PI / 2); endA.translate(0, -0.27, 0.265); parts.push(prep(endA, strap));
      const endB = endA.clone(); endB.translate(0, 0, -0.53); parts.push(prep(endB, strap));
      parts.push(box(0, -0.13, 0, 0.03, 0.012, 0.5, 0x9aa0a8));                 // zipper
      [0.09, -0.09].forEach((z) => { // handles: two straps up to the grip
        parts.push(hexa([[-0.06, -0.15, z - 0.015], [-0.05, -0.15, z - 0.015], [-0.004, 0.0, -0.01], [-0.014, 0.0, -0.01],
          [-0.06, -0.15, z + 0.015], [-0.05, -0.15, z + 0.015], [-0.004, 0.0, 0.01], [-0.014, 0.0, 0.01]], strap));
        parts.push(hexa([[0.05, -0.15, z - 0.015], [0.06, -0.15, z - 0.015], [0.014, 0.0, -0.01], [0.004, 0.0, -0.01],
          [0.05, -0.15, z + 0.015], [0.06, -0.15, z + 0.015], [0.014, 0.0, 0.01], [0.004, 0.0, 0.01]], strap));
      });
      parts.push(box(0, 0.0, 0, 0.04, 0.03, 0.06, strap));                     // grip wrap
      parts.push(box(0, -0.27, 0.0, 0.302, 0.03, 0.4, strap, 'kf'));            // side band
      GEO.duffel = merge(parts);
    }
    const m = new T.Mesh(GEO.duffel, MAT.bag); m.name = 'duffel';
    return m;
  }

  let personSeed = 1;
  function person(kind, opts) {
    if (!T) throw new Error('HModels.init(THREE) first');
    opts = opts || {};
    kind = ['hero', 'hacker', 'civ', 'cop', 'yoav', 'hadar', 'ido'].indexOf(kind) >= 0 ? kind : 'civ';
    const crew = CREW_KINDS.indexOf(kind) >= 0, masked = crew && opts.masked === true;
    const seed = crew ? 0 : opts.seed !== undefined ? opts.seed : personSeed++;
    const pkey = 'person_' + kind + '_' + (crew ? (masked ? 'masked' : 'plain') : kind === 'hero' || kind === 'hacker' ? 0 : seed);
    if (!GEO[pkey]) {
      const oo = crew ? crewOutfit(kind, masked) : outfitFor(kind, seed), parts = [];
      headParts(oo, parts); bodyParts(oo, parts);
      const gg = merge(parts); gg.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.25);
      GEO[pkey] = { o: oo, geo: gg };
    }
    const o = GEO[pkey].o, geo = GEO[pkey].geo;
    const bones = buildBones();
    const mesh = new T.SkinnedMesh(geo, MAT.person);
    mesh.name = 'person-' + kind; mesh.castShadow = false;
    mesh.add(bones[0]);
    mesh.scale.set(o.build * o.height, o.height, o.build * o.height);
    mesh.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton(bones));
    const group = new T.Group(); group.name = 'person-' + kind; group.add(mesh);
    const shadow = blobShadow(0.75, 0.75, 0.7); group.add(shadow);
    const rig = { kind: kind, group: group, mesh: mesh, bones: bones, height: 1.8 * o.height, outfit: o, shadow: shadow, bag: null, laptop: null, seatHeight: SEAT_SURF * o.height, pose: 'idle',
      crew: crew ? kind : null, masked: masked, accent: crew ? CREW_ACCENT[kind] : null, steer: 0 };
    if (kind === 'hero' || crew) { // the crew carry the same duffel, hidden until they have loot (rig.bag.visible = true)
      const bag = duffel(); const holder = new T.Object3D(); holder.position.set(-0.008, -0.33, 0.01); holder.add(bag);
      bones[BN.fArmR].add(holder); rig.bag = holder; rig.bagMesh = bag;
      if (crew) holder.visible = false;
    }
    if (kind === 'hacker') {
      const lt = laptop(); lt.rotation.x = Math.PI / 2; lt.position.set(-0.14, -0.27, 0.07);
      bones[BN.fArmL].add(lt); rig.laptop = lt;
    }
    rig.setPose = (name, t, k) => { applyPose(rig, name || 'idle', t || 0, k === undefined ? 1 : k); return rig; };
    rig.setPose('idle', 0, 1);
    return rig;
  }

  function applyPose(rig, name, t, k) {
    const B = rig.bones, o = rig.outfit;
    rig.group.visible = name !== 'hidden';
    rig.pose = name;
    if (name === 'hidden') return;
    for (let i = 0; i < B.length; i++) B[i].rotation.set(0, 0, 0);
    B[BN.root].position.set(0, 0, 0);
    B[BN.hips].position.set(0, BIND.hips, 0);
    const R = (i) => B[i].rotation;
    const breath = Math.sin(t * 1.7);
    let sitting = false, seated = false;
    // arm rest pose: slightly out, elbows soft
    R(BN.uArmL).z = 0.07; R(BN.uArmR).z = -0.07; R(BN.fArmL).x = -0.12; R(BN.fArmR).x = -0.12;
    if (name === 'idle') {
      R(BN.spine).x = 0.015 * breath; R(BN.head).y = 0.12 * Math.sin(t * 0.37); R(BN.head).x = 0.03 * Math.sin(t * 0.5);
      R(BN.uArmL).z += 0.015 * breath; R(BN.uArmR).z -= 0.015 * breath;
      R(BN.hips).z = 0.02 * Math.sin(t * 0.3); R(BN.thighL).z = -0.02; R(BN.thighR).z = 0.02;
    } else if (name === 'walk' || name === 'run' || name === 'carry') {
      const run = name === 'run', a = clamp(k, 0, 1.5);
      const ph = t * Math.PI * 2 * (run ? 1.45 : 0.92), s = Math.sin(ph), c = Math.cos(ph);
      const th = run ? 0.75 : 0.42, kn = run ? 1.35 : 0.62, ar = run ? 0.75 : 0.36;
      R(BN.thighL).x = (-s * th - (run ? 0.12 : 0)) * a; R(BN.thighR).x = (s * th - (run ? 0.12 : 0)) * a;
      R(BN.shinL).x = (0.06 + kn * Math.max(0, c) + (run ? 0.35 * Math.max(0, s) : 0)) * a;
      R(BN.shinR).x = (0.06 + kn * Math.max(0, -c) + (run ? 0.35 * Math.max(0, -s) : 0)) * a;
      R(BN.uArmL).x = s * ar * a; R(BN.uArmR).x = -s * ar * a;
      R(BN.fArmL).x = -(run ? 1.35 : 0.25 + 0.15 * Math.max(0, -s)) * a - 0.12 * (1 - a);
      R(BN.fArmR).x = -(run ? 1.35 : 0.25 + 0.15 * Math.max(0, s)) * a - 0.12 * (1 - a);
      R(BN.spine).x = (run ? 0.22 : 0.05) * a; R(BN.spine).y = s * (run ? 0.14 : 0.08) * a; R(BN.hips).y = -s * 0.07 * a;
      R(BN.head).x = -R(BN.spine).x * 0.6; R(BN.head).y = -R(BN.spine).y * 0.7;
      B[BN.hips].position.y = BIND.hips + (Math.cos(ph * 2) * (run ? 0.035 : 0.018) - (run ? 0.03 : 0.005)) * a;
      if (o.suit && rig.bag) { R(BN.uArmR).x *= 0.45; R(BN.fArmR).x = -0.08; R(BN.uArmR).z = -0.12; } // the bag is heavy
      if (name === 'carry') { // hauling a heavy bag in the right hand: arm straight down, body leaning away, free arm out
        R(BN.uArmR).set(-s * 0.07 * a, 0, -0.2); R(BN.fArmR).set(-0.05, 0, 0);
        R(BN.spine).z = -0.085 * Math.min(1, a) + 0.02 * c; R(BN.hips).z = 0.04 * Math.min(1, a);
        R(BN.uArmL).set(s * 0.32 * a, 0, 0.3 + 0.04 * c); R(BN.fArmL).set(-0.45 * a - 0.12, 0, 0);
        R(BN.head).z = 0.05; B[BN.hips].position.y -= 0.012 * a;
      }
    } else if (name === 'type') {
      R(BN.spine).x = 0.12 + 0.01 * breath; R(BN.head).x = 0.32; R(BN.head).y = 0.04 * Math.sin(t * 0.6);
      R(BN.uArmL).x = -0.42; R(BN.uArmL).z = 0.1; R(BN.fArmL).x = -1.15; R(BN.fArmL).y = 0.0;
      const tap = Math.sin(t * 23) * 0.05 + Math.sin(t * 13.7) * 0.03;
      R(BN.uArmR).x = -0.55 + tap * 0.3; R(BN.uArmR).z = 0.32; R(BN.fArmR).x = -1.0 + tap; R(BN.fArmR).y = 0.25;
    } else if (name === 'sit' || name === 'drive') { // car seat: buttocks at rig.seatHeight, thighs forward, feet on the floor
      sitting = seated = true;
      B[BN.hips].position.y = SEAT_HIP;
      R(BN.spine).x = -0.16 + 0.012 * breath;
      legIK(B, 1, SEAT_HIP - 0.02, 0.3, 0.8, 0.08); legIK(B, -1, SEAT_HIP - 0.02, 0.3, 0.8, -0.08); // feet stay above a low car's floor
      if (name === 'drive') { // hands on the wheel at ten-to-two; rig.steer (-1..1) turns them with the wheel
        const st = clamp(rig.steer || 0, -1, 1), ang = clamp(st * 2.2, -0.95, 0.95), W = DRIVE_WHEEL;
        R(BN.head).x = 0.15; R(BN.head).y = -st * 0.22 + 0.04 * Math.sin(t * 0.37);
        for (let sd = -1; sd <= 1; sd += 2) {
          const th = -sd * 1.05 + ang, up = Math.cos(th) * W.r;
          armIK(B, sd, -Math.sin(th) * W.r, W.y + up * Math.cos(W.tilt), W.z + up * Math.sin(W.tilt) - 0.012, sd * 0.7, -1, -0.35);
        }
      } else { // passenger: hands resting on the thighs, looking around
        R(BN.head).x = 0.1; R(BN.head).y = 0.32 * Math.sin(t * 0.29) + 0.07 * Math.sin(t * 0.83); R(BN.head).z = 0.03 * Math.sin(t * 0.47);
        armIK(B, 1, 0.135, 0.665, 0.25, 0.8, -0.4, -1); armIK(B, -1, -0.135, 0.665, 0.25, -0.8, -0.4, -1);
      }
    } else if (name === 'cheer') {
      const a = clamp(k, 0, 1), pump = Math.sin(t * 9);
      R(BN.uArmL).z = (2.5 + 0.25 * pump) * a + 0.07; R(BN.uArmR).z = -(2.5 - 0.25 * pump) * a - 0.07;
      R(BN.uArmL).x = R(BN.uArmR).x = -0.2 * a; R(BN.fArmL).x = R(BN.fArmR).x = -0.35 * a;
      R(BN.head).x = -0.25 * a; R(BN.spine).x = -0.08 * a;
      const hop = Math.max(0, Math.sin(t * 9)) * 0.1 * a;
      B[BN.root].position.y = hop; R(BN.shinL).x = R(BN.shinR).x = hop * 3; R(BN.thighL).x = R(BN.thighR).x = -hop * 1.5;
    } else if (name === 'fall') {
      const p = clamp(k, 0, 1), e = 1 - Math.pow(1 - p, 3);
      R(BN.root).x = -e * Math.PI / 2; B[BN.root].position.set(0, e * 0.12, -e * 0.15);
      R(BN.uArmL).z = 0.07 + 1.3 * e; R(BN.uArmR).z = -0.07 - 1.3 * e; R(BN.uArmL).x = R(BN.uArmR).x = -0.6 * e;
      R(BN.fArmL).x = R(BN.fArmR).x = -0.12 - 0.5 * e;
      R(BN.thighL).x = -0.35 * e; R(BN.thighR).x = -0.1 * e; R(BN.shinL).x = 0.6 * e; R(BN.shinR).x = 0.2 * e;
      R(BN.head).x = 0.35 * e * (1 - p * 0.6); R(BN.spine).x = 0.12 * e;
    } else if (name === 'kneel') { // right knee down (toes tucked), left foot planted; hands working ~0.58 m ahead at ~0.82 m
      B[BN.hips].position.y = 0.49;
      R(BN.thighR).set(0.25, 0, -0.04); R(BN.shinR).set(1.6, 0, 0);
      legIK(B, 1, 0.47, 0.0, 0.43, 0.1);
      R(BN.spine).x = 0.3 + 0.01 * breath; R(BN.head).x = 0.08 + 0.04 * Math.sin(t * 0.9); R(BN.head).y = 0.07 * Math.sin(t * 0.6);
      const tap = Math.sin(t * 7.5) * 0.014 * k;
      armIK(B, 1, 0.08, 0.84 + tap, 0.58, 0.9, -0.5, -0.3); armIK(B, -1, -0.07, 0.81 - tap, 0.59 + tap, -0.9, -0.5, -0.3);
    } else if (name === 'point') { // right arm out, pointing (the shop menu / a target), body turned a little toward it
      R(BN.spine).x = 0.04 + 0.01 * breath; R(BN.spine).y = -0.14; R(BN.head).y = -0.1; R(BN.head).x = 0.08;
      R(BN.thighL).z = -0.02; R(BN.thighR).z = 0.03; R(BN.hips).y = -0.04;
      const bob = Math.sin(t * 3.1) * 0.018 * k;
      armIK(B, -1, -0.36, 1.32 + bob, 0.5, -0.4, -1, 0.1);
      R(BN.uArmL).set(0.04, 0, 0.09 + 0.015 * breath); R(BN.fArmL).x = -0.2;
    } else if (name === 'lean') { // leaning back against a car (its body ~0.3 m behind the heels), arms folded
      R(BN.root).x = -0.2;
      R(BN.thighL).set(0.02, 0, -0.07); R(BN.thighR).set(0.04, 0, 0.08); R(BN.shinL).x = 0.04; R(BN.shinR).x = 0.04;
      R(BN.spine).x = 0.07 + 0.012 * breath; R(BN.head).x = 0.12; R(BN.head).y = 0.28 * Math.sin(t * 0.23) + 0.05 * Math.sin(t * 0.71);
      armIK(B, 1, -0.115, 0.165, 0.16, 0.9, -0.7, 0.3, 1); armIK(B, -1, 0.12, 0.2, 0.17, -0.9, -0.7, 0.3, 1);
    } else if (name === 'highfive') { // right arm raised high (k: 0 = at rest .. 1 = fully up), leaning into it
      // rig.reach {x,y,z} (rig space, optional): where the hand goes, e.g. the meeting point of a three-way high five
      const e = smooth01(k), sw = Math.sin(e * Math.PI), rc = rig.reach;
      armIK(B, -1, lerp(-0.26, rc ? rc.x : -0.21, e), lerp(0.86, rc ? rc.y : 1.92, e), lerp(0.03, rc ? rc.z : 0.26, e) + sw * (rc ? 0.1 : 0.22), -0.5, -0.4, -1);
      R(BN.spine).z = 0.07 * e; R(BN.spine).x = -0.06 * e + 0.01 * breath; R(BN.head).x = -0.22 * e; R(BN.head).y = -0.12 * e;
      R(BN.uArmL).z = 0.1 + 0.08 * e; R(BN.fArmL).x = -0.3 * e - 0.12;
      R(BN.thighR).z = 0.03; R(BN.thighL).z = -0.05;
    } else if (name === 'cover') { // duck and cover: on both knees, folded over, hands clasped on the back of the head
      const sh = Math.sin(t * 29) * 0.012 * k;
      B[BN.hips].position.y = 0.34;
      for (let sd = -1; sd <= 1; sd += 2) { R(sd > 0 ? BN.thighL : BN.thighR).set(-0.91, 0, sd * 0.12); R(sd > 0 ? BN.shinL : BN.shinR).set(2.76, 0, 0); }
      R(BN.spine).x = 0.95 + sh; R(BN.head).x = 0.42;
      armIK(B, 1, 0.075, 0.17, -0.02, 0.6, 0.0, 1, 2); armIK(B, -1, -0.075, 0.18, -0.025, -0.6, 0.0, 1, 2);
    }
    if (rig.laptop && name !== 'type' && name !== 'fall' && name !== 'cheer') { // the hacker cradles the open laptop
      R(BN.uArmL).x = -0.42 + (name === 'run' ? 0.08 * Math.sin(t * 9) : 0); R(BN.uArmL).z = 0.1; R(BN.fArmL).x = -1.15; R(BN.fArmL).y = 0;
    }
    if (rig.bag) { // keep the duffel hanging plumb (when falling it simply goes down with the arm)
      const fall = name === 'fall';
      const pitch = (fall ? 0 : R(BN.root).x) + R(BN.spine).x + R(BN.uArmR).x + R(BN.fArmR).x;
      const roll = R(BN.uArmR).z + R(BN.fArmR).z;
      rig.bag.rotation.set(-pitch * (sitting ? 1 : 0.92), -R(BN.spine).y, -roll * 0.95);
      if (fall) rig.bag.rotation.x += Math.PI / 2 * clamp(k, 0, 1);
    }
    rig.shadow.visible = (name !== 'fall' || k < 0.5) && !seated;
  }
  // seated poses: hips height and seat surface (pre-scale; rig.seatHeight = SEAT_SURF * height); the steering wheel the
  // 'drive' hands hold (centre, radius, tilt back from vertical) -> the lux car's wheel is placed to match
  const SEAT_HIP = 0.55, SEAT_SURF = 0.44, DRIVE_WHEEL = { y: 0.9, z: 0.45, r: 0.17, tilt: 0.5 };
  // planar 2-bone leg IK in the hips frame: hip joint at height hy, sole target (ty, tz); spread = thigh roll
  function legIK(B, side, hy, ty, tz, spread) {
    const L1 = 0.425, L2 = 0.505, dy = ty - hy, d0 = Math.hypot(dy, tz), d = clamp(d0, 0.15, L1 + L2 - 0.002);
    const base = Math.atan2(-tz, -dy), A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const K = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    B[side > 0 ? BN.thighL : BN.thighR].rotation.set(base - A, 0, spread || 0);
    B[side > 0 ? BN.shinL : BN.shinR].rotation.set(K, 0, 0);
  }
  // 2-bone arm IK. side +1 = left arm. Target = hand centre in rig space (pre-scale, origin at the feet; frame 0), in the
  // spine bone's frame (frame 1) or the head bone's frame (frame 2). (px,py,pz): where the elbow should point.
  const IK = {};
  function armIK(B, side, tx, ty, tz, px, py, pz, frame) {
    if (!IK.m) { IK.m = new T.Matrix4(); IK.r = new T.Matrix4(); IK.v = new T.Vector3(); IK.p = new T.Vector3(); IK.u = new T.Vector3(); IK.f = new T.Vector3(); IK.x = new T.Vector3(); IK.y = new T.Vector3(); IK.z = new T.Vector3(); }
    const U = side > 0 ? BN.uArmL : BN.uArmR, F = side > 0 ? BN.fArmL : BN.fArmR, v = IK.v.set(tx, ty, tz);
    if (frame !== 1) {
      B[BN.root].updateMatrix(); B[BN.hips].updateMatrix(); B[BN.spine].updateMatrix();
      IK.m.multiplyMatrices(B[BN.root].matrix, B[BN.hips].matrix).multiply(B[BN.spine].matrix);
      if (frame === 2) { B[BN.head].updateMatrix(); v.applyMatrix4(B[BN.head].matrix); } // head frame -> spine frame
      else v.applyMatrix4(IK.r.copy(IK.m).invert());                                    // rig -> spine frame
    }
    const L1 = 0.286, L2 = 0.292, D = v.sub(B[U].position), d0 = D.length() || 1e-4;
    const d = clamp(d0, Math.abs(L1 - L2) + 0.03, L1 + L2 - 0.004);
    D.multiplyScalar(1 / d0);
    const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const beta = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const P = IK.p.set(px, py, pz); P.addScaledVector(D, -P.dot(D));
    if (P.lengthSq() < 1e-8) P.set(0, -1, 0).addScaledVector(D, D.y);
    P.normalize();
    const u = IK.u.copy(D).multiplyScalar(ca).addScaledVector(P, sa);           // upper-arm direction
    const f = IK.f.copy(D).multiplyScalar(d).addScaledVector(u, -L1).normalize(); // forearm direction
    const y = IK.y.copy(u).negate(), z = IK.z.copy(f).addScaledVector(u, -f.dot(u));
    if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(u, -u.z);
    z.normalize();
    IK.r.makeBasis(IK.x.crossVectors(y, z), y, z);
    B[U].rotation.setFromRotationMatrix(IK.r, 'XYZ');
    B[F].rotation.set(-beta, 0, 0);
  }

  // ================================================================= cash
  function cashTexture() {
    if (TEX.cash) return TEX.cash;
    const cv = canvas(1024, 512), g = cv.getContext('2d');
    const bill = (x, y, w, h) => { // face of a banded bundle seen from above
      const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#86a97c'); gr.addColorStop(1, '#5c8660');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = '#2f5a3a'; g.lineWidth = Math.max(1, w * 0.02); g.strokeRect(x + w * 0.05, y + h * 0.1, w * 0.9, h * 0.8);
      g.fillStyle = '#c9d8bf'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.5, w * 0.12, h * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d6a48'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.52, w * 0.07, h * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2f5a3a'; g.font = 'bold ' + Math.round(h * 0.26) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('100', x + w * 0.16, y + h * 0.3); g.fillText('100', x + w * 0.84, y + h * 0.72);
      // paper band
      g.fillStyle = '#d9b44e'; g.fillRect(x + w * 0.36, y, w * 0.28, h);
      g.fillStyle = 'rgba(20,40,22,0.6)'; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
      g.fillStyle = '#6a4a08'; g.font = 'bold ' + Math.round(h * 0.4) + 'px Arial'; g.fillText('$', x + w * 0.5, y + h * 0.52);
    };
    const rr = rng(9);
    const edges = (x, y, w, h, band) => { // stacked paper edges of one bundle
      g.fillStyle = '#9fbd93'; g.fillRect(x, y, w, h);
      for (let i = 1; i < h - 2; i += 2) { g.fillStyle = (i % 4) ? 'rgba(52,92,58,0.55)' : 'rgba(205,225,195,0.55)'; g.fillRect(x, y + i, w, 1); }
      g.fillStyle = 'rgba(20,40,22,0.75)'; g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 2, y, 2, h);
      if (band) { const bx = x + w * (0.33 + (rr() - 0.5) * 0.12); g.fillStyle = '#d9b44e'; g.fillRect(bx, y, w * 0.26, h - 3); g.fillStyle = 'rgba(120,80,10,0.5)'; g.fillRect(bx, y, 2, h - 3); }
    };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) bill(i * 512 / 3, j * 512 / 7, 512 / 3, 512 / 7);       // top grid 3x7
    for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) edges(512 + i * 512 / 3, j * 256 / 7, 512 / 3, 256 / 7, true); // long sides 3x7
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) edges(512 + i * 512 / 7, 256 + j * 256 / 7, 512 / 7, 256 / 7, false); // ends 7x7
    g.strokeStyle = 'rgba(30,50,30,0.5)'; g.lineWidth = 2;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(i * 512 / 3, 0); g.lineTo(i * 512 / 3, 512); g.stroke(); }
    const t = texFrom(cv); t.anisotropy = 8; TEX.cash = t; return t;
  }
  // box with per-face uv rects (pixel rects in the 1024x512 cash texture) -> [px, nx, py, ny, pz, nz]
  function cashBox(sx, sy, sz, rects) {
    const g = new T.BoxGeometry(sx, sy, sz).toNonIndexed();
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const r = rects[f];
      for (let v = 0; v < 6; v++) {
        const i = f * 6 + v;
        uv.setXY(i, (r[0] + uv.getX(i) * (r[2] - r[0])) / 1024, 1 - (r[3] - uv.getY(i) * (r[3] - r[1])) / 512);
      }
    }
    return prep(g);
  }
  function cashStack(opts) {
    if (!T) throw new Error('HModels.init(THREE) first');
    if (!MAT.cash || MAT.cash.userData.gen !== GEN) { MAT.cash = new T.MeshStandardMaterial({ map: cashTexture(), roughness: 0.75, metalness: 0, envMap: ENV, envMapIntensity: 0.3 }); MAT.cash.userData.gen = GEN; }
    if (!GEO.cash) {
      const TOP = [0, 0, 512, 512], LONG = [512, 0, 1024, 256], END = [512, 256, 1024, 512];
      const brick = cashBox(0.48, 0.49, 0.49, [END, END, TOP, TOP, LONG, LONG]);
      brick.translate(0, 0.245, 0);
      const cw = 512 / 3, ch = 512 / 7;
      const bTop = [0, 0, cw, ch], bLong = [512, 0, 512 + cw, 256 / 7], bEnd = [512, 256, 512 + 512 / 7, 256 + 256 / 7];
      const parts = [brick];
      const r = rng(42);
      [[-0.16, 0, -0.17], [0, 0, -0.1], [0.15, 0, 0.0], [-0.12, 0, 0.12], [0.06, 0.07, -0.06]].forEach((p, i) => {
        const b = cashBox(0.16, 0.07, 0.07, [bEnd, bEnd, bTop, bTop, bLong, bLong]);
        b.rotateY((r() - 0.5) * 0.6 + (i === 4 ? 1.2 : 0)); b.translate(p[0], 0.49 + 0.035 + p[1], p[2]);
        parts.push(b);
      });
      GEO.cash = merge(parts);
      GEO.bundle = cashBox(0.16, 0.07, 0.07, [bEnd, bEnd, bTop, bTop, bLong, bLong]);
      GEO.bundle.translate(0, 0.035, 0);
    }
    const m = new T.Mesh(opts && opts.single ? GEO.bundle : GEO.cash, MAT.cash);
    m.name = 'cash'; m.castShadow = false;
    return m;
  }
  function cashBag(opts) {
    if (!T) throw new Error('HModels.init(THREE) first');
    opts = opts || {};
    cashStack();
    const root = new T.Group(); root.name = 'cashBag';
    const spin = new T.Group(); root.add(spin);
    const bag = duffel(); bag.rotation.y = Math.PI / 2; bag.position.y = 0.43; spin.add(bag);
    // bundles spilling out of the open zip (one merged mesh)
    const bl = [[-0.12, 0.27, 0.0, 0.5], [0.04, 0.285, 0.02, -0.3], [0.17, 0.26, -0.01, 0.2]].map((b) => {
      const g = GEO.bundle.clone(); g.rotateX(0.25); g.rotateZ(0.1); g.rotateY(b[3]); g.translate(b[0], b[1], b[2]); return g; });
    const bm = new T.Mesh(merge(bl), MAT.cash); spin.add(bm);
    if (!GEO.beam) {
      const cv = canvas(128, 128), g = cv.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.78, 'rgba(255,255,255,1)');
      gr.addColorStop(0.86, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      TEX.ring = texFrom(cv, false);
      GEO.beam = new T.CylinderGeometry(0.4, 0.55, 3.4, 16, 1, true); GEO.beam.translate(0, 1.7, 0);
      GEO.ring = new T.PlaneGeometry(1.5, 1.5); GEO.ring.rotateX(-Math.PI / 2);
    }
    const col = opts.color !== undefined ? opts.color : 0x3dff8a, cc = C(col);
    const beamMat = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { color: { value: cc }, opacity: { value: 0.5 } }]),
      vertexShader: ['varying vec3 vN; varying vec3 vV; varying float vH;', '#include <fog_pars_vertex>', 'void main(){', '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz); vH = position.y / 3.4;', '  gl_Position = projectionMatrix * mvPosition;', '  #include <fog_vertex>', '}'].join('\n'),
      fragmentShader: ['uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; varying float vH;', '#include <fog_pars_fragment>', 'void main(){',
        '  float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.5);', '  float a = f * pow(1.0 - clamp(vH, 0.0, 1.0), 1.6) * opacity;',
        '  vec3 c = color * a;', '  #ifdef USE_FOG', '    #ifdef FOG_EXP2', '      float ff = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);', '    #else', '      float ff = smoothstep(fogNear, fogFar, fogDepth);', '    #endif', '    c *= 1.0 - ff;', '  #endif', '  gl_FragColor = vec4(c, 1.0);', '}'].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: true,
    });
    const beam = new T.Mesh(GEO.beam, beamMat); beam.renderOrder = 4; root.add(beam);
    const ring = new T.Mesh(GEO.ring, new T.MeshBasicMaterial({ color: cc, map: TEX.ring, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9, toneMapped: false }));
    ring.position.y = 0.02; ring.renderOrder = 4; root.add(ring);
    const gm = glowMaterial(); gm.uniforms.inten.value[CH.AUX] = 1;
    const halo = new T.Mesh(glowGeo([{ p: [0, 0.45, 0], c: col, s: 1.0, ch: CH.AUX }]), gm);
    halo.material.uniforms.gscale.value = 1; halo.renderOrder = 5; root.add(halo);
    root.add(blobShadow(0.9, 0.9, 0.6));
    const update = (t) => {
      spin.rotation.y = t * 1.6; spin.position.y = 0.12 + Math.sin(t * 2.6) * 0.06;
      const pulse = 0.75 + 0.25 * Math.sin(t * 4.2);
      beamMat.uniforms.opacity.value = 0.55 * pulse; ring.material.opacity = 0.85 * pulse; ring.scale.setScalar(1 + 0.06 * Math.sin(t * 4.2));
      gm.uniforms.inten.value[CH.AUX] = 0.25 + 0.15 * pulse;
    };
    update(0);
    root.userData.update = update; root.update = update;
    return root;
  }

  // ================================================================= chapter 3 props
  // a blinking LED: lamp lens + glow, own materials per instance (the group's dispose() frees them)
  function ledParts(group, lensGeo, glowList) {
    const lm = lampMaterial(), gm = glowMaterial();
    group.add(new T.Mesh(lensGeo, lm));
    const gl = new T.Mesh(glowGeo(glowList), gm); gl.renderOrder = 5; group.add(gl);
    lm.uniforms.inten.value[CH.HEAD] = gm.uniforms.inten.value[CH.HEAD] = 1; // always-on display channel
    return (v) => { lm.uniforms.inten.value[CH.AUX] = v; gm.uniforms.inten.value[CH.AUX] = v; };
  }
  function blinker(group, set, period, onFrac) {
    const update = (t, rate) => { const p = ((t || 0) * (rate || 1) / period) % 1; set(p < onFrac ? 1.7 : 0.04); };
    update(0); group.update = update; group.userData.update = update;
    group.dispose = () => group.traverse((o) => { if (o.material && o.material.isShaderMaterial) o.material.dispose(); });
    return group;
  }
  // yellow-ochre canister bomb lying on its side (~0.5 m), dark bands, carry handle, detonator with a blinking red LED.
  // Origin on the ground under its centre, long axis along x. update(t, rate): blink (rate > 1 = faster, e.g. fuse running)
  function bomb() {
    if (!T) throw new Error('HModels.init(THREE) first');
    if (!GEO.bomb) {
      const p = [], ochre = 0xc39b36, ochre2 = 0xb08a2c, dark = 0x1c1a15, steel = 0x7d8086, y = 0.12, R0 = 0.118;
      [[-0.2, -0.1, ochre], [-0.1, 0.0, ochre2], [0.0, 0.1, ochre], [0.1, 0.2, ochre2]].forEach((s) => p.push(cyl(R0, R0, s[1] - s[0], 14, 'x', (s[0] + s[1]) / 2, y, 0, s[2], true)));
      [-1, 1].forEach((sd) => { const d = new T.SphereGeometry(R0, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); d.rotateZ(-sd * Math.PI / 2); d.scale(0.38, 1, 1); d.translate(sd * 0.2, y, 0); p.push(prep(d, ochre)); });
      [-0.155, -0.02, 0.135].forEach((x) => p.push(cyl(R0 + 0.004, R0 + 0.004, 0.024, 14, 'x', x, y, 0, dark, true)));
      p.push(cyl(R0 + 0.003, R0 + 0.003, 0.008, 14, 'x', 0.06, y, 0, 0x3d3a2e, true));
      [[0.04, 0.14], [0.07, 0.1], [0.06, 0.06]].forEach((b, i) => p.push(box(b[0] + 0.015 * i, y + 0.03 - i * 0.026, R0 - 0.002, b[1] * 0.5, 0.014, 0.006, dark))); // stencil marks
      // nozzle end: neck, valve block, a bracket clamp
      p.push(cyl(0.034, 0.04, 0.05, 8, 'x', -0.268, y, 0, steel), box(-0.3, y, 0, 0.03, 0.06, 0.06, 0x8c7a3a), cyl(0.018, 0.018, 0.04, 6, 'x', -0.33, y, 0, steel));
      p.push(box(-0.31, y + 0.05, 0, 0.012, 0.012, 0.11, 0x5a5c60), box(-0.31, y - 0.05, 0, 0.012, 0.012, 0.11, 0x5a5c60), box(-0.355, y, 0, 0.012, 0.11, 0.012, 0x5a5c60));
      // carry handle
      const h = new T.TorusGeometry(0.058, 0.009, 5, 10, Math.PI); h.translate(0, y + R0 + 0.012, 0); p.push(prep(h, 0x2a2b2e));
      p.push(box(0.058, y + R0 + 0.006, 0, 0.026, 0.016, 0.03, dark), box(-0.058, y + R0 + 0.006, 0, 0.026, 0.016, 0.03, dark));
      // detonator box + antenna
      p.push(box(0.13, y + R0 + 0.014, 0, 0.08, 0.034, 0.055, 0x121214), box(0.11, y + R0 + 0.033, 0.0, 0.03, 0.006, 0.03, 0x2c2e33));
      p.push(xf(cyl(0.0035, 0.0035, 0.1, 5, 'y', 0, 0.05, 0, 0x202022), [0.155, y + R0 + 0.03, -0.018], [0.25, 0, -0.3]));
      GEO.bomb = merge(p);
      GEO.bombLed = box(0.15, y + R0 + 0.034, 0.014, 0.014, 0.008, 0.014, 0xff2020, null, { chan: CH.AUX });
      GEO.bombGlow = [{ p: [0.15, y + R0 + 0.045, 0.014], c: 0xff2a1a, s: 0.16, ch: CH.AUX }];
    }
    const g = new T.Group(); g.name = 'bomb';
    const m = new T.Mesh(GEO.bomb, MAT.prop); m.name = 'canister'; g.add(m);
    const set = ledParts(g, GEO.bombLed, GEO.bombGlow);
    g.add(blobShadow(0.66, 0.34, 0.65));
    return blinker(g, set, 0.8, 0.16);
  }
  // thermal breaching charge: a flat taped block on a back plate with straps, a keypad + display and a blinking red LED.
  // Origin = centre of its back face; it faces +z (mount it on a surface whose outward normal is +z). ~0.32 x 0.24 x 0.1 m
  function thermalCharge() {
    if (!T) throw new Error('HModels.init(THREE) first');
    if (!GEO.therm) {
      const p = [], zb = 0.068;
      p.push(box(0, 0, 0.004, 0.32, 0.24, 0.008, 0x2b2d30));
      p.push(box(0, 0, 0.038, 0.28, 0.2, 0.06, 0x6f7457));
      p.push(box(0, 0.035, zb + 0.0005, 0.27, 0.012, 0.002, 0x5d6247), box(0, -0.045, zb + 0.0005, 0.27, 0.012, 0.002, 0x5d6247)); // tape seams
      [-0.09, 0.09].forEach((x) => { p.push(box(x, 0, 0.038, 0.034, 0.212, 0.066, 0x141518)); p.push(box(x, 0.06, zb + 0.004, 0.042, 0.028, 0.008, 0x8a8d92)); });
      for (let i = 0; i < 7; i++) p.push(box(-0.12 + i * 0.04, -0.104, zb - 0.005, 0.02, 0.016, 0.004, i % 2 ? 0x111111 : 0xf2c21b)); // hazard stripe
      // keypad module
      const kx = 0.0, ky = 0.012, kz = zb + 0.012;
      p.push(box(kx, ky, kz, 0.1, 0.13, 0.024, 0x17181a));
      p.push(box(kx, ky + 0.047, kz + 0.0125, 0.078, 0.024, 0.002, 0x061209));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.push(box(kx - 0.026 + c * 0.026, ky + 0.016 - r * 0.02, kz + 0.013, 0.019, 0.014, 0.004, r === 3 && c !== 1 ? 0xc85a2a : 0xaab0b6));
      // wires to the detonators
      const wires = [[[kx - 0.03, ky - 0.065, kz], [-0.07, -0.09, zb + 0.02], [-0.11, -0.06, zb + 0.004]], [[kx + 0.03, ky - 0.065, kz], [0.06, -0.095, zb + 0.022], [0.1, -0.07, zb + 0.004]]];
      wires.forEach((w, i) => { for (let j = 0; j < 2; j++) p.push(tube(w[j], w[j + 1], 0.0035, i ? 0x2050c8 : 0xc81e1e, 5)); });
      p.push(cyl(0.008, 0.008, 0.05, 6, 'y', -0.11, -0.04, zb + 0.004, 0x9aa0a6), cyl(0.008, 0.008, 0.05, 6, 'y', 0.1, -0.05, zb + 0.004, 0x9aa0a6));
      GEO.therm = merge(p);
      GEO.thermLed = merge([box(kx + 0.036, ky + 0.047, kz + 0.014, 0.01, 0.01, 0.004, 0xff2020, null, { chan: CH.AUX }),
        box(kx - 0.008, ky + 0.047, kz + 0.0135, 0.05, 0.014, 0.002, 0x3cff86, null, { chan: CH.HEAD })]);
      GEO.thermGlow = [{ p: [kx + 0.036, ky + 0.047, kz + 0.03], c: 0xff2a1a, s: 0.12, ch: CH.AUX }, { p: [kx - 0.008, ky + 0.047, kz + 0.03], c: 0x22c860, s: 0.08, ch: CH.HEAD }];
    }
    const g = new T.Group(); g.name = 'thermalCharge';
    const m = new T.Mesh(GEO.therm, MAT.prop); m.name = 'charge'; g.add(m);
    return blinker(g, ledParts(g, GEO.thermLed, GEO.thermGlow), 0.6, 0.2);
  }
  // hazard placard texture for the gas-cylinder pallet
  function warnTexture() {
    if (TEX.warn) return TEX.warn;
    const cv = canvas(256, 192), g = cv.getContext('2d');
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#c4161c'; g.fillRect(0, 0, 256, 46); g.lineWidth = 8; g.strokeStyle = '#c4161c'; g.strokeRect(4, 4, 248, 184);
    g.fillStyle = '#fff'; g.font = '900 34px "Arial Black", Impact, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DANGER', 128, 25);
    g.save(); g.translate(64, 118); g.rotate(Math.PI / 4); g.fillStyle = '#d4201f'; g.fillRect(-40, -40, 80, 80); g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeRect(-34, -34, 68, 68); g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 92); g.bezierCurveTo(84, 112, 80, 130, 64, 138); g.bezierCurveTo(48, 130, 46, 116, 58, 104); g.bezierCurveTo(58, 114, 62, 116, 64, 112); g.bezierCurveTo(68, 104, 62, 98, 64, 92); g.fill();
    g.font = 'bold 14px Arial'; g.fillText('2', 64, 150);
    g.fillStyle = '#111'; g.textAlign = 'left'; g.font = '900 22px "Arial Black", Arial, sans-serif'; g.fillText('FLAMMABLE', 116, 96); g.fillText('GAS', 116, 122);
    g.font = 'bold 13px Arial'; g.fillStyle = '#333'; g.fillText('NO SMOKING', 118, 150); g.fillText('NO OPEN FLAMES', 118, 168);
    TEX.warn = texFrom(cv); return TEX.warn;
  }
  function gasCylGeo(body, shoulder) {
    const p = [], h = 1.0, R0 = 0.125;
    p.push(cyl(R0, R0, h, 14, 'y', 0, 0.02 + h / 2, 0, body, true), cyl(R0 - 0.005, R0 + 0.004, 0.03, 14, 'y', 0, 0.015, 0, 0x3a3b3e));
    const d = new T.SphereGeometry(R0, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.55, 1); d.translate(0, 0.02 + h, 0); p.push(prep(d, shoulder));
    p.push(cyl(R0 + 0.003, R0 + 0.003, 0.05, 14, 'y', 0, h - 0.06, 0, shoulder, true));
    p.push(cyl(0.032, 0.036, 0.06, 8, 'y', 0, h + 0.1, 0, 0xb8913a), box(0, h + 0.145, 0, 0.05, 0.05, 0.05, 0xb8913a), box(0.04, h + 0.14, 0, 0.04, 0.018, 0.018, 0xa07c2e));
    const hw = new T.TorusGeometry(0.03, 0.006, 4, 10); hw.rotateX(Math.PI / 2); hw.translate(0, h + 0.18, 0); p.push(prep(hw, 0x1d1d20));
    p.push(box(0, 0.62, R0 - 0.002, 0.13, 0.17, 0.006, 0xf1e6b8));
    p.push(xf(box(0, 0, 0, 0.05, 0.05, 0.004, 0xd4201f), [0, 0.65, R0 + 0.002], [0, 0, Math.PI / 4]));
    p.push(box(0, 0.575, R0 + 0.002, 0.09, 0.008, 0.003, 0x222222), box(0, 0.56, R0 + 0.002, 0.07, 0.008, 0.003, 0x222222));
    return merge(p);
  }
  // 6 gas cylinders (white/red) with brass valves on a wooden pallet + a hazard placard on a post. ~1.6 x 1.0 m, 1.4 m tall.
  // Origin on the ground at the pallet centre. group.cylinders = the 6 cylinder meshes (origin at their base) so they can be
  // flung individually; group.pallet, group.rack, group.sign.
  function gasCylinders() {
    if (!T) throw new Error('HModels.init(THREE) first');
    if (!GEO.pallet) {
      const p = [], woods = [0xa47a4a, 0x8e6a3e, 0xb08654, 0x9a7244];
      [-0.72, 0, 0.72].forEach((x, i) => p.push(box(x, 0.05, 0, 0.1, 0.09, 1.0, woods[(i + 1) % 4])));
      for (let i = 0; i < 7; i++) p.push(box(0, 0.108, -0.45 + i * 0.15, 1.6, 0.025, 0.11, woods[i % 4]));
      for (let i = 0; i < 3; i++) p.push(box(0, 0.012, -0.44 + i * 0.44, 1.6, 0.022, 0.1, woods[(i + 2) % 4]));
      GEO.pallet = merge(p);
      const q = [];
      q.push(box(0.74, 0.72, 0.415, 0.045, 1.22, 0.045, 0x3a3c40), box(0.74, 1.12, 0.444, 0.46, 0.34, 0.012, 0x2a2c30));
      q.push(box(0, 0.86, -0.36, 1.5, 0.03, 0.02, 0x2a2c30), box(-0.76, 0.5, -0.36, 0.04, 0.8, 0.04, 0x3a3c40), box(0.76, 0.5, -0.36, 0.04, 0.8, 0.04, 0x3a3c40)); // back rail
      GEO.palletRack = merge(q);
      const sg = new T.PlaneGeometry(0.42, 0.315); sg.translate(0.74, 1.12, 0.456); GEO.palletSign = prep(sg);
      GEO.gasW = gasCylGeo(0xe9e7e0, 0xc41b1b); GEO.gasR = gasCylGeo(0xbd1c1c, 0xe9e7e0);
    }
    if (!MAT.sign || MAT.sign.userData.gen !== GEN) { MAT.sign = new T.MeshStandardMaterial({ map: warnTexture(), roughness: 0.6, metalness: 0 }); MAT.sign.userData.gen = GEN; }
    const g = new T.Group(); g.name = 'gasCylinders';
    const pal = new T.Mesh(GEO.pallet, MAT.wood); pal.name = 'pallet'; g.add(pal);
    const rack = new T.Mesh(GEO.palletRack, MAT.prop); rack.name = 'rack'; g.add(rack);
    const sign = new T.Mesh(GEO.palletSign, MAT.sign); sign.name = 'sign'; g.add(sign);
    const cyls = [], r = rng(23);
    [[-0.5, -0.2], [0, -0.21], [0.5, -0.19], [-0.52, 0.2], [0.02, 0.21], [0.48, 0.2]].forEach((c, i) => {
      const m = new T.Mesh(i === 1 || i === 5 ? GEO.gasR : GEO.gasW, MAT.prop); m.name = 'cylinder';
      m.position.set(c[0] + (r() - 0.5) * 0.04, 0.12, c[1]); m.rotation.y = r() * 6.28; if (i === 3) { m.rotation.z = 0.06; m.rotation.x = -0.04; }
      g.add(m); cyls.push(m);
    });
    g.add(blobShadow(2.0, 1.4, 0.7));
    g.cylinders = cyls; g.pallet = pal; g.rack = rack; g.sign = sign;
    return g;
  }
  // one banded banknote bundle (0.156 x 0.02 x 0.066 m, centred, paper band across the middle) for InstancedMesh bursts;
  // same texture/material as cashStack. Returns { geometry, material } (shared: do not dispose per use).
  function billBundle() {
    if (!T) throw new Error('HModels.init(THREE) first');
    cashStack();
    if (!GEO.billBundle) {
      const cw = 512 / 3, ch = 512 / 7;
      const bTop = [0, 0, cw, ch], bLong = [512, 0, 512 + cw, 256 / 7], bEnd = [512, 256, 512 + 512 / 7, 256 + 256 / 7];
      GEO.billBundle = cashBox(0.156, 0.02, 0.066, [bEnd, bEnd, bTop, bTop, bLong, bLong]);
      GEO.billBundle.computeBoundingSphere();
    }
    return { geometry: GEO.billBundle, material: MAT.cash };
  }

  // ================================================================= export
  const HModels = {
    ready: false,
    init: init,
    car: car,
    person: (typeof person === 'function') ? person : null,
    cashStack: (typeof cashStack === 'function') ? cashStack : null,
    cashBag: (typeof cashBag === 'function') ? cashBag : null,
    bomb: bomb, thermalCharge: thermalCharge, gasCylinders: gasCylinders, billBundle: billBundle,
    CREW: CREW_KINDS.slice(), ACCENT: CREW_ACCENT, BONES: BN, SEAT_SURF: SEAT_SURF,
    CHANNELS: CH,
  };
  window.HModels = HModels;
})();
