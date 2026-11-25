/* Chapter 3 "THE CREW": explosions and gadgets — sticky bombs, the gas-cylinder trap, nitro. Contract: CREW_SPEC.md section E2.

   HBoom.init(H)                     once per session (idempotent): builds the effect pools and registers HBoom.mod in H.mods.
                                     Call it from the story's begin(): it adds one point light to the street scene, and adding a light
                                     after the first frame recompiles every material (a hitch). Every other call initialises lazily;
                                     when the session ends (Heist.stop) the module cleans itself up (HBoom.stop) even if nobody calls it.
   HBoom.reset(keepInventory)        clears bombs, the trap and every effect; ends slow motion and the takedown camera.
                                     Without keepInventory it also empties the gadgets (bombs = 0, nitro not owned).
   HBoom.stop()                      reset + unregister from H.mods + remove the HUD (the story may call it from its own stop()).
   HBoom.explode(x, y, z, o)         o = { power 0.3..3 (1.5), radius (5 + 3.2 * power), inner (0.6), mega, noPhysics, noScorch,
                                     quiet, quietToast, depth }: fireball + smoke + shockwave + debris + scorch + light + shake + sound,
                                     and the blast physics: cars are shoved and spun; police closer than inner * radius are wrecked,
                                     launched and explode (they stop chasing and can never bust the player); the player's own and the
                                     crew's cars only get a shove and non-lethal damage. Returns the police cars this blast disabled.
   HBoom.bombs                       sticky bombs available (the story sets it).
   HBoom.dropBomb(car?)              drops a canister behind the car (default: the player's car): proximity fuse (police < 7 m,
                                     fires at the closest approach) or a 3 s timer. Returns the bomb or null.
   HBoom.placeTrap(x, z, o)          o = { radius 15, onDetonate(total), prompt true, prop {x, z, h}, snap true, corner [sx, sz], h }:
                                     gas cylinders (HModels.gasCylinders or our own) + a collision circle. The blast stays centred on
                                     (x, z) (trap.cx, trap.cz); the props go on o.prop, else on HWorld.trap.prop when (x, z) is
                                     HWorld.trap, else on the nearest corner / kerb (snap). Replaces an earlier trap.
   HBoom.trap                        null | { x, z, cx, cz, radius, kill (0.75 * radius), armed, ready, cops, group }
   HBoom.trapReady()                 armed && the player within 60 m && >= 1 active cruiser in the kill zone (kill + 1 m around cx, cz);
                                     every cruiser in it is wrecked by the detonation, the rest of the radius is shoved and damaged.
   HBoom.detonateTrap(o)             o = { onDone(total), cinematic }: mega blast + rolling fireball + flying cylinders with secondary
                                     blasts + a 2 s slow-motion window (+ a 2.2 s takedown camera). Returns the police disabled by the
                                     first blast; onDone (and placeTrap's onDetonate) get the total 2.3 s (real time) later.
   HBoom.nitro                       { owned, charge 0..1, active }
   HBoom.updateNitro(dt, car, held)  boost + blue exhaust flames + FOV kick; drains in ~4 s, recharges in ~18 s.
   HBoom.keys = true                 the module reads its own input: G = detonate the trap when ready, else drop a bomb (in a car);
                                     Shift in a car = nitro; two touch buttons. Set false to drive bombs / nitro from the story.
                                     Input is ignored while another module owns H.camOverride (the crew switch, a scripted shot).
   HBoom.cinematic = true            a short slow-motion takedown camera when a bomb or the trap takes out police.
   HBoom.slowmo(seconds, scale)      eased slow-motion window in real seconds (cooperates with other users of H.timeScale / H.desat).
   HBoom.calm()                      ends slow motion and the takedown camera right away (a fail, a scripted shot, ...). A video cut
                                     (HHud.playCut) does this by itself within half a second: the mods do not run during cuts.
   HBoom.onTakedown(n, x, z)         optional hook: an explosion disabled n police cars.
   HBoom.stats                       { bombs, explosions, cops } (this session)
   New SFX (haudio.js): explosion bombDrop bombBeep thermalBeep nitro slowIn slowOut switchUp switchDown purchase moneyBurst. */
(function addBoomStrings() {
  if (typeof I18N === 'undefined') return;
  Object.assign(I18N.he, {
    bm_bombs: 'פצצות', bm_nitro: 'ניטרו', bm_detonate: 'בום!', bm_trapPrompt: 'פוצץ את המלכודת!', bm_noBombs: 'נגמרו הפצצות',
    bm_carOnly: 'פצצות זורקים רק מהאוטו', bm_copDown: 'ניידת הושבתה!', bm_copsDown: '{n} ניידות הושבתו!', bm_nitroEmpty: 'הניטרו נגמר',
    bm_trapWait: 'תמשוך את השוטרים למלכודת',
  });
  Object.assign(I18N.en, {
    bm_bombs: 'BOMBS', bm_nitro: 'NITRO', bm_detonate: 'BOOM!', bm_trapPrompt: 'Blow the trap!', bm_noBombs: 'Out of bombs',
    bm_carOnly: 'Bombs drop from a car', bm_copDown: 'COP DOWN!', bm_copsDown: '{n} COPS DOWN!', bm_nitroEmpty: 'Nitro empty',
    bm_trapWait: 'Lure the cops into the trap',
  });
})();

const HBoom = {
  H: null, T: null, scene: null, ready: false, mod: null,
  bombs: 0, nitro: { owned: false, charge: 1, active: false },
  keys: true, cinematic: true, onTakedown: null,
  trap: null, live: [], stats: { bombs: 0, explosions: 0, cops: 0 },
  FIRE_N: 340, SMOKE_N: 320, DEBRIS_N: 72, BOMB_MAX: 6,
  SYS_KEYS: ['px', 'py', 'pz', 'vx', 'vy', 'vz', 't', 'life', 's0', 's1', 'rot', 'rv', 'p1', 'p2', 'am', 'drag', 'buoy', 'fr', 'k1'],
  DEB_KEYS: ['x', 'y', 'z', 'vx', 'vy', 'vz', 'ax', 'ay', 'az', 'wx', 'wy', 'wz', 'sx', 'sy', 'sz', 't', 'life', 'tr'],

  /* ================================================================ lifecycle */
  init(H) {
    H = H || window.Heist;
    if (!H || !H.T || !H.scene) return this;
    if (this.ready && this.scene === H.scene) { this._register(); return this; }
    if (this.ready) this.stop(); // a new session: the old objects died with the old renderer
    this.H = H; this.T = H.T; this.scene = H.scene; this.ready = true;
    this.clock = 0; this.jobs = []; this.live = []; this.flying = []; this.burning = []; this.cyls = []; this.trap = null;
    this.slow = { on: false }; this.cine = null; this._lastCine = -99; this._dropCd = 0; this._toastT = {};
    this._fov = 0; this._nitroIdle = 0; this._tapBomb = false; this._holdNos = false; this._tsW = null; this._dsW = null; this._filterSet = false;
    this.stats = { bombs: 0, explosions: 0, cops: 0 };
    this.mod = this.mod || { preUpdate: (dt) => { try { this._pre(dt); } catch (e) { console.error(e); } }, update: (dt) => { try { this._update(dt); } catch (e) { console.error(e); } } };
    this._camFn = this._camFn || ((dt, camera) => this._cineCam(dt, camera));
    this._build();
    this._register();
    this._css(); this._hud();
    clearInterval(this._wd); this._wd = setInterval(() => this._watch(), 500);
    return this;
  },
  _register() { const H = this.H; if (!H.mods) H.mods = []; if (H.mods.indexOf(this.mod) < 0) H.mods.push(this.mod); },
  _ensure() { if (this.ready && this.H && this.H.active && this.H.scene === this.scene) return true; if (window.Heist && Heist.active && Heist.scene) { this.init(Heist); return this.ready; } return false; },
  // the session ended (Heist.stop() resets H.mods and disposes the scene): clean up even if nobody told us
  _watch() {
    const H = this.H; if (!H || !H.active || H.scene !== this.scene || !H.mods || H.mods.indexOf(this.mod) < 0) { this.stop(); return; }
    // a video cut freezes the mods: end slow motion and the takedown shot so the game resumes at normal speed
    if (window.HHud && HHud.cutActive && HHud.cutActive() && ((this.slow && this.slow.on) || this.cine)) this.calm();
  },
  reset(keep) {
    if (!keep) { this.bombs = 0; this._hadBombs = false; this.nitro.owned = false; this.nitro.charge = 1; }
    this.nitro.active = false;
    if (!this.ready) return;
    this.calm();
    for (const b of this.live) this._freeBomb(b); this.live.length = 0;
    if (this.trap) { const tr = this.trap; tr.armed = false; tr.ready = false; if (tr.circle) tr.circle.down = true; this._dropTrapGroup(tr); this.trap = null; }
    for (const c of this.cyls) if (c.obj.parent) c.obj.parent.remove(c.obj); this.cyls.length = 0;
    this.flying.length = 0; this.burning.length = 0; this.jobs.length = 0;
    for (const S of [this.fire, this.smoke]) if (S) { S.n = 0; this._upload(S); }
    if (this.debris) { this.debris.n = 0; this.debris.mesh.count = 0; }
    for (const r of this.rings || []) { r.t = -1; r.mesh.visible = false; }
    for (const r of this.airRings || []) { r.t = -1; r.sprite.visible = false; }
    for (const d of this.decals || []) d.visible = false;
    if (this.light) { this.light.intensity = 0; this.lightT = -1; this.pool.visible = false; }
    this._flames(null, 0); this._fov = 0;
    this._hudTick(true);
  },
  stop() {
    clearInterval(this._wd); this._wd = null;
    if (this.ready) { try { this.reset(); } catch (e) { console.error(e); } }
    const H = this.H; if (H && H.mods) { const i = H.mods.indexOf(this.mod); if (i >= 0) H.mods.splice(i, 1); }
    for (const k of ['gadEl', 'promptEl', 'tbBomb', 'tbNos']) { if (this[k]) this[k].remove(); this[k] = null; }
    this.ready = false; this.H = null; this.T = null; this.scene = null; this.trap = null; this.cine = null;
    this.fire = this.smoke = this.debris = this.light = this.pool = this.flame = null; this.rings = this.airRings = this.decals = this.bombPool = null; this.M = this.G = null;
  },
  // end slow motion and the takedown camera now (restores only what this module set)
  calm() {
    const H = this.H; if (!H) return;
    if (this.slow && this.slow.on) this._slowEnd();
    if (this.cine) { if (H.camOverride === this._camFn) H.camOverride = null; this.cine = null; }
  },
  _lin(...mats) { for (const m of mats) this.H.linearize({ traverse: (f) => f({ material: m }) }); },

  /* ================================================================ building (once per session) */
  _build() {
    const T = this.T, scene = this.scene;
    const M = this.M = {}; this.G = {};
    // textures (pixels cached on the module; GPU objects are per session)
    const puff = new T.DataTexture(HBoom._puffPixels(), 256, 256, T.RGBAFormat);
    puff.magFilter = T.LinearFilter; puff.minFilter = T.LinearMipmapLinearFilter; puff.generateMipmaps = true; puff.needsUpdate = true;
    const ringTex = new T.CanvasTexture(HBoom._ringCanvas()), scorchTex = new T.CanvasTexture(HBoom._scorchCanvas());
    const glow = HWorld.tex && HWorld.tex.glow;
    // particles: premultiplied alpha (fire adds light AND darkens what is behind it a little, so it reads at golden hour too)
    const vs = `attribute vec4 iA; attribute vec4 iB; attribute float iF; uniform float uFogD; uniform float uPull;
      varying vec2 vUv; varying vec4 vB; varying float vFog;
      void main(){
        vec4 mv = modelViewMatrix * vec4(iA.xyz, 1.0);
        float c = cos(iB.x), s = sin(iB.x); vec2 q = position.xy * iA.w;
        mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        mv.z += iA.w * uPull; // pulled toward the camera: big puffs cut less into the road and the walls
        gl_Position = projectionMatrix * mv;
        vUv = vec2(mod(iF, 2.0), floor(iF * 0.5)) * 0.5 + uv * 0.5;
        vB = iB; float fd = max(0.0, -mv.z) * uFogD; vFog = 1.0 - exp(-fd * fd);
      }`;
    const blend = { transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor };
    M.fire = new T.ShaderMaterial(Object.assign({
      uniforms: { uMap: { value: puff }, uFogD: { value: 0 }, uPull: { value: 0.35 } }, vertexShader: vs,
      // vB.y = temperature (0 white-hot .. 1 soot); the puffs are mostly opaque emitters, so a stack of them saturates at
      // the brightest puff instead of adding up to a white blob, and the billows stay readable
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec4 vB; varying float vFog;
        vec3 fireRamp(float k){
          if (k < 0.06) return mix(vec3(6.0, 4.4, 2.3), vec3(4.0, 1.95, 0.42), k / 0.06);         // white-hot -> yellow
          if (k < 0.24) return mix(vec3(4.0, 1.95, 0.42), vec3(2.0, 0.6, 0.08), (k - 0.06) / 0.18);  // -> orange
          if (k < 0.5) return mix(vec3(2.0, 0.6, 0.08), vec3(0.8, 0.15, 0.03), (k - 0.24) / 0.26);   // -> red
          if (k < 0.78) return mix(vec3(0.8, 0.15, 0.03), vec3(0.12, 0.04, 0.02), (k - 0.5) / 0.28); // -> embers
          return mix(vec3(0.12, 0.04, 0.02), vec3(0.03, 0.026, 0.024), (k - 0.78) / 0.22);           // -> soot
        }
        vec3 blueRamp(float k){ return k < 0.3 ? mix(vec3(3.2, 4.4, 9.0), vec3(0.7, 1.0, 5.0), k / 0.3) : mix(vec3(0.7, 1.0, 5.0), vec3(0.3, 0.12, 1.4), (k - 0.3) / 0.7); }
        void main(){
          vec4 tx = texture2D(uMap, vUv);
          float a = tx.a * vB.w; if (a < 0.003) discard;
          float k = clamp(vB.y + (0.5 - tx.r) * 0.5, 0.0, 1.0);
          bool blue = vB.z < 0.0;
          vec3 col = (blue ? blueRamp(k) : fireRamp(k)) * abs(vB.z) * (0.6 + 0.8 * tx.r);
          float em = smoothstep(0.05, 0.6, tx.a) * vB.w; // the dense cores burn, the thin fringes are soot
          float op = blue ? 0.12 : mix(0.5, 0.9, smoothstep(0.1, 0.65, k));
          float f = 1.0 - vFog;
          gl_FragColor = vec4(col * em * f, a * op * f);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    }, blend));
    M.smoke = new T.ShaderMaterial(Object.assign({
      uniforms: { uMap: { value: puff }, uFogD: { value: 0 }, uPull: { value: 0.3 }, uSmoke: { value: new T.Color(0.05, 0.05, 0.055) }, uGlow: { value: new T.Color(2.4, 0.75, 0.18) }, uFogCol: { value: new T.Color() } }, vertexShader: vs,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uSmoke; uniform vec3 uGlow; uniform vec3 uFogCol; varying vec2 vUv; varying vec4 vB; varying float vFog;
        void main(){
          vec4 tx = texture2D(uMap, vUv);
          float a = tx.a * vB.w; if (a < 0.003) discard;
          vec3 c = uSmoke * (0.45 + 0.7 * tx.r) * vB.y + uGlow * vB.z * (0.35 + 0.65 * tx.r);
          c = mix(c, uFogCol, vFog * 0.85);
          gl_FragColor = vec4(c * a, a);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    }, blend));
    this.smoke = this._sys(this.SMOKE_N, M.smoke, 6, false);
    this.fire = this._sys(this.FIRE_N, M.fire, 7, true); // fire on layer 1: the wet road reflects the fireball
    // debris: dark angular chunks (instanced)
    M.debris = new T.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.8, metalness: 0.25, flatShading: true }); this._lin(M.debris);
    const dm = new T.InstancedMesh(new T.DodecahedronGeometry(0.17, 0), M.debris, this.DEBRIS_N);
    dm.instanceMatrix.setUsage(T.DynamicDrawUsage); dm.count = 0; dm.frustumCulled = false; scene.add(dm);
    const f32 = () => new Float32Array(this.DEBRIS_N), D = this.debris = { mesh: dm, n: 0 };
    for (const k of this.DEB_KEYS) D[k] = f32();
    this._dummy = new T.Object3D();
    // shockwave: ground rings + camera-facing air rings
    this.rings = []; this.airRings = [];
    const ringGeo = new T.PlaneGeometry(2, 2); ringGeo.rotateX(-Math.PI / 2);
    for (let k = 0; k < 3; k++) {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ map: ringTex, color: new T.Color(1.3, 0.62, 0.26), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }));
      m.visible = false; m.renderOrder = 5; scene.add(m); this.rings.push({ mesh: m, t: -1 });
      const s = new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: new T.Color(0.9, 0.75, 0.6), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }));
      s.visible = false; s.renderOrder = 8; scene.add(s); this.airRings.push({ sprite: s, t: -1 });
    }
    // scorch decals (ring buffer)
    M.scorch = new T.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const decalGeo = new T.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
    this.decals = []; this._decalK = 0;
    for (let k = 0; k < 10; k++) { const d = new T.Mesh(decalGeo, M.scorch); d.visible = false; d.renderOrder = 1; scene.add(d); this.decals.push(d); }
    // one real light for the newest blast (kept in the scene from the start: adding lights later recompiles every material)
    this.light = new T.PointLight(0xffa04a, 0, 80, 2); this.light.position.set(0, -50, 0); scene.add(this.light); this.lightT = -1;
    this.pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glow, color: new T.Color(1.6, 0.62, 0.2), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.visible = false; this.pool.renderOrder = 2; scene.add(this.pool);
    // bomb LED halo (shared material, per-bomb sprites)
    M.led = new T.SpriteMaterial({ map: glow, color: new T.Color(4, 0.25, 0.15), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
    this.bombPool = [];
    this._buildFlames();
  },
  _sys(N, mat, order, layer1) {
    const T = this.T, g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(N * 4), B = new Float32Array(N * 4), F = new Float32Array(N);
    const aA = new T.InstancedBufferAttribute(A, 4).setUsage(T.DynamicDrawUsage), aB = new T.InstancedBufferAttribute(B, 4).setUsage(T.DynamicDrawUsage), aF = new T.InstancedBufferAttribute(F, 1).setUsage(T.DynamicDrawUsage);
    g.setAttribute('iA', aA); g.setAttribute('iB', aB); g.setAttribute('iF', aF); g.instanceCount = 0;
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.visible = false; if (layer1) mesh.layers.enable(1);
    this.scene.add(mesh);
    const S = { N, n: 0, mesh, g, A, B, F, aA, aB, aF };
    for (const k of this.SYS_KEYS) S[k] = new Float32Array(N);
    return S;
  },

  /* ---------- procedural textures (pixels cached on the module, shared by every session) ---------- */
  _puffPixels() {
    if (HBoom._puffPx) return HBoom._puffPx;
    const S = 256, d = new Uint8Array(S * S * 4), R = HX.rng(7331), P = new Float32Array(64 * 64);
    for (let i = 0; i < P.length; i++) P[i] = R();
    const vn = (u, v) => {
      const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv, a0 = iu & 63, a1 = (iu + 1) & 63, b0 = (iv & 63) * 64, b1 = ((iv + 1) & 63) * 64;
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv), A = P[a0 + b0], B = P[a1 + b0], C = P[a0 + b1], D = P[a1 + b1];
      return A + (B - A) * su + (C - A) * sv + (A - B - C + D) * su * sv;
    };
    const fbm = (u, v) => vn(u, v) * 0.5 + vn(u * 2.03 + 17, v * 2.03) * 0.25 + vn(u * 4.1, v * 4.1 + 31) * 0.125 + vn(u * 8.3 + 5, v * 8.3) * 0.0625;
    for (let cell = 0; cell < 4; cell++) {
      const ox = (cell & 1) * 128, oy = (cell >> 1) * 128, lobes = [[0, 0, 0.5]];
      for (let k = 0; k < 6; k++) { const a = R() * 6.283, r = 0.18 + R() * 0.2; lobes.push([Math.cos(a) * r, Math.sin(a) * r, 0.3 + R() * 0.16]); }
      for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
        const u = (px + 0.5) / 64 - 1, v = (py + 0.5) / 64 - 1, rr = Math.hypot(u, v);
        let m = 0; for (const [lx, ly, lr] of lobes) { const q = 1 - ((u - lx) * (u - lx) + (v - ly) * (v - ly)) / (lr * lr); if (q > 0) m = Math.max(m, q * q); }
        const n = fbm(u * 2.6 + cell * 9.1, v * 2.6 + cell * 3.7), det = fbm(u * 6 + 40 + cell * 7, v * 6 + 11);
        let dens = m * (0.35 + 1.15 * n) - 0.1; dens *= HX.clamp((1 - rr) / 0.18, 0, 1); dens = HX.clamp(dens * 1.25, 0, 1);
        const o = ((oy + py) * S + ox + px) * 4;
        d[o] = Math.round(HX.clamp(det * 1.25 - 0.1, 0, 1) * 255); d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.round(dens * 255);
      }
    }
    return (HBoom._puffPx = d);
  },
  _ringCanvas() {
    if (HBoom._ringC) return HBoom._ringC;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,0.95)'); g.addColorStop(0.88, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (HBoom._ringC = c);
  },
  _scorchCanvas() {
    if (HBoom._scorchC) return HBoom._scorchC;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = HX.rng(4242);
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 60);
    g.addColorStop(0, 'rgba(5,4,3,0.97)'); g.addColorStop(0.5, 'rgba(10,8,6,0.9)'); g.addColorStop(0.78, 'rgba(18,14,10,0.45)'); g.addColorStop(1, 'rgba(20,15,11,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.lineCap = 'round';
    for (let k = 0; k < 46; k++) { const a = R() * 6.283, r0 = 10 + R() * 18, r1 = 34 + R() * 28; x.strokeStyle = `rgba(8,6,5,${0.15 + R() * 0.3})`; x.lineWidth = 1 + R() * 3.5; x.beginPath(); x.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); x.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1); x.stroke(); }
    for (let k = 0; k < 70; k++) { const a = R() * 6.283, r = 20 + R() * 40; x.fillStyle = `rgba(10,8,6,${0.2 + R() * 0.4})`; x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 0.8 + R() * 2.6, 0, 6.283); x.fill(); }
    return (HBoom._scorchC = c);
  },
  _signCanvas() {
    if (HBoom._signC) return HBoom._signC;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.lineJoin = 'round'; x.beginPath(); x.moveTo(64, 10); x.lineTo(121, 114); x.lineTo(7, 114); x.closePath();
    x.fillStyle = '#ffc928'; x.fill(); x.lineWidth = 9; x.strokeStyle = '#141210'; x.stroke();
    x.fillStyle = '#141210'; x.beginPath(); x.moveTo(64, 42);
    x.bezierCurveTo(80, 58, 87, 72, 81, 88); x.bezierCurveTo(76, 101, 52, 102, 47, 89); x.bezierCurveTo(43, 77, 52, 69, 56, 60);
    x.bezierCurveTo(58, 70, 62, 73, 64, 69); x.bezierCurveTo(68, 61, 67, 51, 64, 42); x.fill();
    x.fillRect(40, 99, 48, 6);
    return (HBoom._signC = c);
  },

  /* ================================================================ particles */
  // fire: p1 = brightness (< 0: blue), p2 = start temperature, k1 = end temperature (0 white-hot .. 1 soot)
  // smoke: p1 = tone, p2 = early fire glow
  _emit(S, x, y, z, vx, vy, vz, life, s0, s1, p1, p2, am, drag, buoy, k1) {
    if (S.n >= S.N) return -1;
    const i = S.n++;
    S.px[i] = x; S.py[i] = y; S.pz[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz; S.t[i] = 0; S.life[i] = life; S.s0[i] = s0; S.s1[i] = s1;
    S.p1[i] = p1; S.p2[i] = p2; S.am[i] = am; S.drag[i] = drag; S.buoy[i] = buoy; S.k1[i] = k1 != null ? k1 : 1.05; S.rot[i] = Math.random() * 6.283; S.rv[i] = (Math.random() - 0.5) * 1.4; S.fr[i] = (Math.random() * 4) | 0;
    return i;
  },
  _kill(S, i) { const j = --S.n; if (i === j) return; const K = this.SYS_KEYS; for (let q = 0; q < K.length; q++) { const a = S[K[q]]; a[i] = a[j]; } },
  _stepSys(S, dt, smoke) {
    for (let i = S.n - 1; i >= 0; i--) {
      const t = (S.t[i] += dt);
      if (t >= S.life[i]) { this._kill(S, i); continue; }
      const dk = Math.exp(-S.drag[i] * dt);
      S.vx[i] *= dk; S.vz[i] *= dk; S.vy[i] = S.vy[i] * dk + S.buoy[i] * dt;
      S.px[i] += S.vx[i] * dt; S.py[i] += S.vy[i] * dt; S.pz[i] += S.vz[i] * dt;
      const floor = S.s0[i] * 0.25; if (S.py[i] < floor) { S.py[i] = floor; if (S.vy[i] < 0) S.vy[i] *= -0.2; }
      S.rot[i] += S.rv[i] * dt * (smoke ? 0.4 : 1);
    }
    const A = S.A, B = S.B, F = S.F;
    for (let i = 0; i < S.n; i++) {
      const f = S.t[i] / S.life[i], e = 1 - (1 - f) * (1 - f) * (1 - f), o = i * 4;
      A[o] = S.px[i]; A[o + 1] = S.py[i]; A[o + 2] = S.pz[i]; A[o + 3] = S.s0[i] + (S.s1[i] - S.s0[i]) * e;
      B[o] = S.rot[i]; F[i] = S.fr[i];
      if (smoke) { // p1 = tone, p2 = early fire glow
        B[o + 1] = S.p1[i]; B[o + 2] = S.p2[i] * Math.exp(-S.t[i] * 3.2);
        B[o + 3] = S.am[i] * (f < 0.1 ? f / 0.1 : 1) * (f > 0.45 ? Math.max(0, (1 - f) / 0.55) : 1);
      } else { // it cools from p2 to k1 over its life
        const k0 = S.p2[i]; B[o + 1] = k0 + f * (S.k1[i] - k0); B[o + 2] = S.p1[i];
        B[o + 3] = S.am[i] * Math.min(1, f * 14) * (f < 0.5 ? 1 : 1 - (f - 0.5) * (f - 0.5) * 4);
      }
    }
    this._upload(S);
  },
  _upload(S) {
    S.g.instanceCount = S.n; S.mesh.visible = S.n > 0;
    if (!S.n) return;
    S.aA.updateRange.offset = 0; S.aA.updateRange.count = S.n * 4; S.aA.needsUpdate = true;
    S.aB.updateRange.offset = 0; S.aB.updateRange.count = S.n * 4; S.aB.needsUpdate = true;
    S.aF.updateRange.offset = 0; S.aF.updateRange.count = S.n; S.aF.needsUpdate = true;
  },
  qk() { const q = this.H && this.H.q; return q === 'low' ? 0.5 : q === 'med' ? 0.75 : 1; },

  /* ================================================================ explosions */
  explode(x, y, z, o) {
    if (!this._ensure()) return 0;
    o = o || {};
    const H = this.H, power = HX.clamp(o.power != null ? o.power : 1.5, 0.3, 3), R = o.radius != null ? o.radius : 5 + 3.2 * power;
    y = y == null ? 0.6 : y;
    this.stats.explosions++;
    this._fx(x, y, z, power, o);
    const cam = H.camera.position, dCam = Math.hypot(x - cam.x, z - cam.z, y - cam.y);
    H.cam.shake = Math.max(H.cam.shake || 0, HX.clamp(1.35 * Math.sqrt(power) * (1 - dCam / (55 + 35 * power)), 0, 1.35));
    if (this.cine) this.cine.shake = Math.max(this.cine.shake, HX.clamp(1.2 * (1 - dCam / 120), 0.2, 1));
    if (dCam < 60 + 20 * power) H.doFlash(1, 0.78, 0.5, HX.clamp(0.1 * power * (1 - dCam / (60 + 20 * power)), 0, 0.28));
    if (!o.quiet && window.HAudio) {
      const dx = x - cam.x, dz = z - cam.z, right = -Math.cos(H.cam.yaw) * dx + Math.sin(H.cam.yaw) * dz;
      HAudio.sfx('explosion', { intensity: HX.clamp(power / 2.4, 0.25, 1), vol: HX.clamp(1.25 * (1 - dCam / 340), 0.18, 1.1), pan: HX.clamp(right / (dCam || 1), -1, 1) * 0.8, far: HX.clamp(dCam / 220, 0, 1), mega: !!o.mega });
    }
    const n = o.noPhysics ? 0 : this._blast(x, z, power, R, o);
    if (n > 0) {
      this.stats.cops += n;
      if (this.onTakedown) { try { this.onTakedown(n, x, z); } catch (e) { console.error(e); } }
      if (!o.quietToast && window.HHud) HHud.toast(n === 1 ? t('bm_copDown') : t('bm_copsDown', { n }), '#ffd23f');
    }
    return n;
  },
  _fx(x, y, z, P, o) {
    const q = this.qk(), F = this.fire, S = this.smoke, rnd = Math.random, gy = HX.groundY(x, z), pw = Math.pow(P, 0.75);
    // 1. the flash: one white-hot puff for a few frames (it stays hot: it is light, not flame)
    this._emit(F, x, y + 0.6, z, 0, 0.5, 0, 0.12, 2.2 * pw, 5.5 * pw, 1, 0, 0.9, 0, 0, 0.22);
    // 2. the fireball: billowing puffs pushed out of a small core (drag makes them stall and roll), rising and cooling
    //    from yellow through orange and red into soot. Bigger blasts get bigger puffs more than more puffs.
    const nF = Math.round((14 + 12 * P) * q);
    for (let k = 0; k < nF; k++) {
      let dx = rnd() * 2 - 1, dy = rnd() * 0.9 + 0.1, dz = rnd() * 2 - 1; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      const sp = (3 + rnd() * 8) * pw, r0 = rnd() * 0.7 * pw, s0 = (1.0 + rnd() * 1.3) * pw, core = k < nF * 0.3;
      this._emit(F, x + dx * r0, y + 0.3 + dy * r0, z + dz * r0, dx * sp * (core ? 0.5 : 1), dy * sp * 0.75 + 1.5 + rnd() * 2, dz * sp * (core ? 0.5 : 1),
        (0.55 + rnd() * 0.6) * (0.75 + 0.25 * P), s0, s0 * (1.9 + rnd() * 1.1), 0.85 + rnd() * 0.3, core ? 0.02 + rnd() * 0.05 : 0.07 + rnd() * 0.12, 0.95, 3.4, 3 + rnd() * 2, 1.0 + rnd() * 0.08);
    }
    // flame tongues licking out sideways
    const nT = Math.round((2 + 3 * P) * q);
    for (let k = 0; k < nT; k++) { const a = rnd() * 6.283, sp = (10 + rnd() * 9) * Math.sqrt(P); this._emit(F, x, y + 0.4, z, Math.cos(a) * sp, 2 + rnd() * 4, Math.sin(a) * sp, 0.3 + rnd() * 0.25, 0.6 * pw, 2.2 * pw, 1.05, 0.05, 0.9, 5.5, 2, 0.75); }
    // the big ones keep rolling: late puffs boil up out of the top of the fireball
    if (P >= 1.4) for (let k = 0, nR = Math.round((P - 0.8) * 4 * q); k < nR; k++) this._job(0.1 + k * 0.06, () => {
      if (!this.fire) return; const a = rnd() * 6.283, r = rnd() * pw;
      this._emit(this.fire, x + Math.cos(a) * r, y + 1.2 * pw + rnd() * pw, z + Math.sin(a) * r, Math.cos(a) * 1.5, 4 + rnd() * 3, Math.sin(a) * 1.5, 0.7 + rnd() * 0.5, 1.6 * pw, (3.4 + rnd() * 1.5) * pw, 0.85, 0.16 + rnd() * 0.1, 0.9, 1.5, 3, 1.05);
    });
    // 3. smoke: born hidden inside the fireball (glowing from it), billows out and climbs
    const nS = Math.round((8 + 14 * P) * q);
    for (let k = 0; k < nS; k++) {
      const a = rnd() * 6.283, r = rnd() * 1.2 * pw, sp = (1.5 + rnd() * 3.5) * Math.sqrt(P);
      this._emit(S, x + Math.cos(a) * r, y + 0.8 + rnd() * 1.5 * pw, z + Math.sin(a) * r, Math.cos(a) * sp, (2 + rnd() * 3) * Math.sqrt(P), Math.sin(a) * sp, (3.2 + rnd() * 3) * (0.8 + 0.2 * P), (1.8 + rnd()) * pw, (5 + rnd() * 4) * pw, 0.65 + rnd() * 0.45, 1, 0.78, 1.3, 0.9 + rnd() * 0.6);
    }
    // a column for the big ones
    if (P >= 1.9) for (let k = 0, nC = Math.round(9 * q); k < nC; k++) this._job(k * 0.07, () => { if (this.smoke) this._emit(this.smoke, x + (rnd() - 0.5) * 2, y + 1.5, z + (rnd() - 0.5) * 2, (rnd() - 0.5) * 1.5, 5 + rnd() * 4, (rnd() - 0.5) * 1.5, 6 + rnd() * 3, 2.5 * pw, (7 + rnd() * 4) * pw, 0.55 + rnd() * 0.4, 0.8, 0.82, 0.55, 0.5); });
    // 4. ground dust ring racing outward
    const nD = Math.round(7 * P * q);
    for (let k = 0; k < nD; k++) { const a = (k / nD) * 6.283 + rnd() * 0.5, sp = (9 + rnd() * 6) * Math.sqrt(P); this._emit(S, x + Math.cos(a), gy + 0.6, z + Math.sin(a), Math.cos(a) * sp, 0.4 + rnd(), Math.sin(a) * sp, 1.4 + rnd() * 0.9, 1.2 * pw, 4.2 * pw, 1.25 + rnd() * 0.3, 0.25, 0.42, 2.6, 0.25); }
    // 5. debris + sparks + embers
    const nB = Math.round((4 + 6 * P) * q);
    for (let k = 0; k < nB; k++) { const a = rnd() * 6.283, sp = (5 + rnd() * 9) * Math.sqrt(P); this._debris(x, y + 0.4, z, Math.cos(a) * sp, (6 + rnd() * 9) * Math.sqrt(P), Math.sin(a) * sp); }
    if (window.HFX3) { HFX3.sparkBurst(x, y + 0.5, z, 0, 0, Math.round(16 * P * q)); HFX3.glowBurst(x, y + 1, z, 1, 0.55, 0.15, Math.round(14 * P * q), 8 * Math.sqrt(P)); }
    // 6. shockwave rings
    let ring = this.rings[0]; for (const r of this.rings) if (r.t < 0) { ring = r; break; }
    ring.t = 0; ring.R = 4 + 6 * P; ring.dur = 0.4 + 0.12 * P; ring.mesh.position.set(x, gy + 0.12, z); ring.mesh.scale.setScalar(0.5); ring.mesh.visible = true;
    let air = this.airRings[0]; for (const r of this.airRings) if (r.t < 0) { air = r; break; }
    air.t = 0; air.R = 5 + 7 * P; air.dur = 0.28; air.sprite.position.set(x, y + 1.2, z); air.sprite.visible = true;
    // 7. scorch mark (not on the water)
    if (!o.noScorch && !(x > HX.OCEAN_X - 4 && Math.abs(z) > HX.BRIDGE_HW)) {
      const d = this.decals[this._decalK++ % this.decals.length]; d.position.set(x, gy + 0.05, z); d.rotation.y = rnd() * 6.283; d.scale.set(2.4 + 2.6 * P, 1, 2.4 + 2.6 * P); d.visible = true;
    }
    // 8. the light (the newest blast takes it)
    this.lightT = 0; this.lightP = 1.6 + 1.5 * P; this.lightDur = 0.55 + 0.35 * P; this.light.position.set(x, y + 2.5, z); this.light.distance = 24 + 12 * P;
    this.pool.position.set(x, gy + 0.07, z); this.pool.scale.setScalar(6 + 5 * P); this.pool.visible = true;
  },
  _debris(x, y, z, vx, vy, vz) {
    const D = this.debris; if (!D || D.n >= this.DEBRIS_N) return;
    const i = D.n++, r = Math.random;
    D.x[i] = x; D.y[i] = y; D.z[i] = z; D.vx[i] = vx; D.vy[i] = vy; D.vz[i] = vz; D.ax[i] = r() * 6; D.ay[i] = r() * 6; D.az[i] = r() * 6;
    D.wx[i] = (r() - 0.5) * 16; D.wy[i] = (r() - 0.5) * 16; D.wz[i] = (r() - 0.5) * 16; D.sx[i] = 0.5 + r() * 1.3; D.sy[i] = 0.35 + r() * 0.8; D.sz[i] = 0.5 + r() * 1.4;
    D.t[i] = 0; D.life[i] = 6 + r() * 3; D.tr[i] = 0;
  },
  _stepDebris(dt) {
    const D = this.debris, d = this._dummy, m = D.mesh, K = this.DEB_KEYS; if (!D.n) { m.count = 0; return; }
    for (let i = D.n - 1; i >= 0; i--) {
      const t = (D.t[i] += dt);
      if (t >= D.life[i]) { const j = --D.n; if (i !== j) for (let q = 0; q < K.length; q++) { const a = D[K[q]]; a[i] = a[j]; } continue; }
      const gy = HX.groundY(D.x[i], D.z[i]) + 0.08;
      if (D.y[i] > gy || D.vy[i] > 0) {
        D.vy[i] -= 15 * dt; D.x[i] += D.vx[i] * dt; D.y[i] += D.vy[i] * dt; D.z[i] += D.vz[i] * dt;
        D.ax[i] += D.wx[i] * dt; D.ay[i] += D.wy[i] * dt; D.az[i] += D.wz[i] * dt;
        if (D.y[i] < gy) { D.y[i] = gy; if (D.vy[i] < -2.5) { D.vy[i] *= -0.32; D.vx[i] *= 0.55; D.vz[i] *= 0.55; D.wx[i] *= 0.5; D.wy[i] *= 0.5; D.wz[i] *= 0.5; } else { D.vy[i] = 0; D.vx[i] = 0; D.vz[i] = 0; } }
        // burning chunks trail fire and smoke for their first second
        if (t < 1.1 && (i & 1) === 0 && (D.tr[i] -= dt) <= 0 && this.smoke.n < this.SMOKE_N * 0.75) { D.tr[i] = 0.08; this._emit(this.smoke, D.x[i], D.y[i], D.z[i], 0, 0.6, 0, 1.1 + Math.random() * 0.5, 0.35, 1.6, 0.5, 0.7, 0.55 * (1 - t / 1.1), 1.5, 0.8); if (t < 0.7) this._emit(this.fire, D.x[i], D.y[i], D.z[i], 0, 0.5, 0, 0.24, 0.45, 0.95, 1, 0.12, 0.85, 2, 1, 0.8); }
      }
    }
    for (let i = 0; i < D.n; i++) {
      const k = Math.min(1, (D.life[i] - D.t[i]) / 0.8);
      d.position.set(D.x[i], D.y[i], D.z[i]); d.rotation.set(D.ax[i], D.ay[i], D.az[i]); d.scale.set(D.sx[i] * k, D.sy[i] * k, D.sz[i] * k); d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.count = D.n; m.instanceMatrix.needsUpdate = true;
  },
  // the blast physics: returns the police cars this blast disabled
  _blast(x, z, P, R, o) {
    const H = this.H, depth = o.depth || 0, kill = R * (o.inner != null ? o.inner : 0.6); // police closer than this are wrecked
    let n = 0, hurtCops = false, hurtCivs = false;
    for (const v of this._cars()) {
      if (!v.rig || !v.rig.group.parent) continue;
      const fx = Math.sin(v.h), fz = Math.cos(v.h), off = v.half - v.radius * 0.8;
      let d = 1e9; for (let s = -1; s <= 1; s++) d = Math.min(d, Math.hypot(v.x + fx * off * s - x, v.z + fz * off * s - z));
      d = Math.max(0, d - v.radius * 0.6);
      if (d > R) continue;
      const f = 1 - d / R; let ux = v.x - x, uz = v.z - z; const L = Math.hypot(ux, uz);
      if (L < 0.05) { const a = Math.random() * 6.283; ux = Math.cos(a); uz = Math.sin(a); } else { ux /= L; uz /= L; }
      const imp = (5 + 9 * P) * Math.pow(f, 1.2) / Math.sqrt(v.spec.mass || 1.3), own = this._own(v);
      v.vx += ux * imp * (own ? 0.5 : 1); v.vz += uz * imp * (own ? 0.5 : 1); v.w += (Math.random() - 0.5) * imp * (own ? 0.15 : 0.4);
      if (own) { // a shove and some damage, never a wreck
        let dmg = f * 16 * P; const floor = v.spec.hp * 0.12; if (v.hp - dmg < floor) dmg = Math.max(0, v.hp - floor);
        if (dmg > 0) HVehicle.hurt(v, dmg);
        continue;
      }
      const cop = !!(v.ai && v.ai.type === 'police'), was = v.wrecked;
      if (cop) hurtCops = true; else if (v.ai) hurtCivs = true;
      HVehicle.hurt(v, d < kill ? 1e4 : f * (45 + 45 * P));
      if (v.wrecked && !was) {
        v.exploded = true; v.burnT = 99; v.sirenOn = false; if (v.inp) { v.inp.throttle = 0; v.inp.steer = 0; v.inp.handbrake = true; }
        if (cop) n++;
        this._launch(v, f, P);
        this._burn(v);
        if (depth < 1) { const vv = v; this._job(0.12 + Math.random() * 0.35, () => { if (vv.rig.group.parent) this.explode(vv.x, 0.9, vv.z, { power: 0.9, radius: 6.5, depth: depth + 1, noScorch: true, quietToast: true }); }); }
      }
    }
    // the player on foot / pedestrians / palms and lamp posts
    const p = H.player;
    if (p && !p.inCar && H.state === 'play') { const d = Math.hypot(p.x - x, p.z - z); if (d < R * 0.75) { const f = 1 - d / (R * 0.75); H.knockPlayer((p.x - x) || 0.1, (p.z - z) || 0.1, 6 + 8 * f); p.hp = Math.max(5, p.hp - f * 20 * P); } }
    if (window.HExtras && HExtras.peds) for (const q of HExtras.peds) {
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < R * 1.1 && q.state !== 'down') { const L = d || 1, f = 1 - d / (R * 1.1); q.state = 'down'; q.st = 0; q.vx = (q.x - x) / L * (3 + 7 * f); q.vz = (q.z - z) / L * (3 + 7 * f); }
      else if (d < R * 3.5 && q.state === 'walk') { q.state = 'flee'; q.st = 0; }
    }
    const qr = HX.query(x - R * 0.7, z - R * 0.7, x + R * 0.7, z + R * 0.7, { b: [], c: [] });
    for (const c of qr.c) { if (c.down || Math.hypot(c.x - x, c.z - z) > R * 0.7) continue; if (c.kind === 'palm') HWorld.knockPalm(c, c.x - x, c.z - z); else if (c.kind === 'pole') HWorld.knockPole(c); }
    // blowing up cops / cars is a crime where crime counts
    if (depth === 0 && window.HMission && (HMission.mode === 'free' || HMission.allowCrime)) {
      if (hurtCops) HAI.setWanted(Math.max(HAI.wanted, 2), 'boom'); else if (hurtCivs && HAI.witness(x, z, 70)) HAI.crime(1);
    }
    return n;
  },
  _cars() {
    const H = this.H, out = this._carBuf || (this._carBuf = []); out.length = 0;
    const add = (v) => { if (v && v.rig && out.indexOf(v) < 0) out.push(v); };
    for (const v of HAI.traffic) add(v); for (const v of HAI.police) add(v); for (const v of H.parked || []) add(v);
    add(H.car); add(H.player && H.player.inCar);
    if (window.HCrew && HCrew.members) for (const m of HCrew.members) add(m && m.car);
    return out;
  },
  _own(v) {
    const H = this.H; if (v === H.car || (H.player && v === H.player.inCar)) return true;
    if (window.HCrew && HCrew.members) for (const m of HCrew.members) if (m && m.car === v) return true;
    return false;
  },
  // wrecked cars fly: up, rolling, then land on the wheels or the roof (gravity + tumble done here, the AI just slides them)
  _launch(v, f, P) {
    const b = v._bm || (v._bm = { y: 0, roll: 0, pitch: 0 }), m = Math.sqrt(v.spec.mass || 1.3);
    b.vy = (3 + 4.2 * P) * (0.55 + 0.45 * f) * (0.8 + Math.random() * 0.4) / m;
    b.wr = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 3.2) * f * Math.sqrt(P); b.wp = (Math.random() - 0.5) * 2.2 * f; b.wy = (Math.random() - 0.5) * 3 * f;
    b.h = (v.rig.dims && v.rig.dims.height) || 1.45; b.air = true; b.pvx = undefined; b.y = Math.max(b.y || 0, 0.01);
    v.rig.group.rotation.order = 'YXZ';
    if (this.flying.indexOf(v) < 0) this.flying.push(v);
  },
  _burn(v) { this.burning.push({ v, t: 0, dur: 8 + Math.random() * 4, acc: 0 }); while (this.burning.length > 6) this.burning.shift(); },

  /* ================================================================ sticky bombs */
  dropBomb(car) {
    if (!this._ensure()) return null;
    const H = this.H; car = car || (H.player && H.player.inCar);
    if (!car) { this._toast('carOnly', t('bm_carOnly'), '#fff'); return null; }
    if (this.bombs <= 0) { this._toast('noBombs', t('bm_noBombs'), '#ff8a7a'); return null; }
    if (this._dropCd > 0 || this.live.length >= this.BOMB_MAX) return null;
    this.bombs--; this._hadBombs = true; this._dropCd = 0.45; this.stats.bombs++;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), back = car.half + 0.55;
    const b = this._getBomb();
    Object.assign(b, { x: car.x - fx * back, y: 0.6, z: car.z - fz * back, vx: car.vx * 0.12 - fx * 0.8, vy: 0.5, vz: car.vz * 0.12 - fz * 0.8, h: car.h + (Math.random() - 0.5) * 0.8, t: 0, fuse: 3, beepT: 0.3, ph: 0, minD: 99, tilt: 0.5, led: 0, landed: false });
    b.group.visible = true; this.live.push(b);
    this._sfxAt('bombDrop', b.x, b.z, 1);
    return b;
  },
  _getBomb() {
    for (const b of this.bombPool) if (!b.used) { b.used = true; return b; }
    const T = this.T, g = new T.Group(), model = this._bombModel(); g.add(model);
    const lp = model.userData.ledP, led = new T.Sprite(this.M.led); led.scale.setScalar(0.55); led.position.set(lp[0], lp[1] + 0.02, lp[2]); led.visible = false; g.add(led);
    g.visible = false; this.scene.add(g);
    const b = { group: g, model, ledS: led, used: true }; this.bombPool.push(b); return b;
  },
  _freeBomb(b) { b.used = false; b.group.visible = false; },
  _bombModel() {
    const H = this.H, T = this.T;
    // HModels.bomb(): lying along x, origin on the ground, its own LED blinks via update(t, rate); we drive it in step with the beeps
    if (window.HModels && typeof HModels.bomb === 'function') { try { const m = HModels.bomb(); if (m) { H.markLinear(m); m.userData.ext = true; m.userData.ledP = [0.15, 0.27, 0.014]; return m; } } catch (e) { console.error(e); } }
    const M = this.M, G = this.G;
    if (!M.bombBody) {
      M.bombBody = new T.MeshStandardMaterial({ color: 0xd3a02a, roughness: 0.45, metalness: 0.3 });
      M.bombBand = new T.MeshStandardMaterial({ color: 0x24221f, roughness: 0.6, metalness: 0.4 });
      M.bombBox = new T.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 });
      M.bombLed = new T.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
      this._lin(M.bombBody, M.bombBand, M.bombBox);
      G.bBody = new T.CylinderGeometry(0.15, 0.15, 0.38, 18); G.bBand = new T.CylinderGeometry(0.157, 0.157, 0.04, 18); G.bCap = new T.CylinderGeometry(0.11, 0.152, 0.05, 18);
      G.bHandle = new T.TorusGeometry(0.075, 0.014, 6, 14, Math.PI); G.bBox = new T.BoxGeometry(0.11, 0.08, 0.035); G.bLed = new T.BoxGeometry(0.022, 0.022, 0.012);
    }
    const g = new T.Group(), add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(G.bBody, M.bombBody, 0, 0.21, 0); add(G.bBand, M.bombBand, 0, 0.06, 0); add(G.bBand, M.bombBand, 0, 0.35, 0); add(G.bCap, M.bombBand, 0, 0.42, 0);
    add(G.bHandle, M.bombBand, 0, 0.44, 0); add(G.bBox, M.bombBox, 0, 0.22, 0.16); add(G.bLed, M.bombLed, 0.03, 0.24, 0.18);
    g.userData.ledP = [0.03, 0.24, 0.19];
    return g;
  },
  _stepBombs(dt) {
    const H = this.H, play = H.state === 'play';
    for (let k = this.live.length - 1; k >= 0; k--) {
      const b = this.live[k];
      // the drop: fall, one bounce, then it sticks to the asphalt
      if (!b.landed) {
        b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.y <= 0) { b.y = 0; if (b.vy < -2) { b.vy *= -0.28; b.vx *= 0.4; b.vz *= 0.4; } else { b.landed = true; b.vy = 0; } }
      }
      b.tilt = HX.damp(b.tilt, 0, 5, dt);
      b.group.position.set(b.x, b.y, b.z); b.group.rotation.set(b.tilt * Math.sin(b.t * 20) * 0.4, b.h, b.tilt * 0.3);
      if (!play) continue; // frozen while the street is not simulated (interior, fail, ...)
      b.t += dt;
      // accelerating beeps + the LED
      const k01 = HX.clamp(b.t / b.fuse, 0, 1); b.ph += dt * (2 + 10 * k01);
      if ((b.beepT -= dt) <= 0) { b.beepT = HX.lerp(0.42, 0.075, k01 * k01); b.led = 0.07; this._sfxAt('bombBeep', b.x, b.z, 0.9, 1 + k01 * 0.35); }
      b.led -= dt; b.ledS.visible = b.led > 0;
      if (b.model.userData.ext && b.model.update) b.model.update(b.led > 0 ? 0 : 0.5, 1); // its own LED flashes with the beep
      // proximity fuse: blows at the cruiser's closest approach (or right away when it is on top of it)
      let boom = b.t >= b.fuse;
      if (b.t > 0.25) {
        let d = 99; for (const v of HAI.police) if (!v.wrecked) d = Math.min(d, Math.hypot(v.x - b.x, v.z - b.z));
        if (d < 7 && (d < 2.8 || d > b.minD + 0.25)) boom = true;
        b.minD = Math.min(b.minD, d);
      }
      if (boom) { this.live.splice(k, 1); this._freeBomb(b); this._bombBlast(b.x, b.z); }
    }
  },
  _bombBlast(x, z) {
    const n = this.explode(x, 0.45, z, { power: 1.6, radius: 11, inner: 0.62 }); // wrecks police within ~6.8 m
    const H = this.H, p = H.player, pc = p && p.inCar;
    if (n > 0 && pc && this.cinematic && this.clock - this._lastCine > 7 && Math.hypot(pc.x - x, pc.z - z) < 70 && this._startCine(x, z, 1.5, 'bomb')) this.slowmo(1.4, 0.42);
  },

  /* ================================================================ the gas-cylinder trap */
  placeTrap(x, z, o) {
    if (!this._ensure()) return null;
    o = o || {};
    if (this.trap) { const old = this.trap; if (old.circle) old.circle.down = true; this._dropTrapGroup(old); this.trap = null; }
    // the props go on the kerb / corner next to the asphalt; the blast stays centred on the given point.
    // HWorld.trap.prop (the world's kerb spot for its trap intersection) is used when the trap goes on HWorld.trap.
    let px = x, pz = z, prop = o.prop || null;
    if (!prop && window.HWorld && HWorld.trap && HWorld.trap.prop && Math.hypot(HWorld.trap.x - x, HWorld.trap.z - z) < 3) prop = HWorld.trap.prop;
    if (prop) { px = prop.x; pz = prop.z; }
    else if (o.snap !== false) {
      const P = HX.P, H0 = HX.HALF, off = HX.ROAD_HW + 1.7, inCity = Math.abs(x) <= H0 + 8 && Math.abs(z) <= H0 + 8;
      const gx = HX.L(HX.clamp(Math.round((x + H0) / P), 0, HX.N)), gz = HX.L(HX.clamp(Math.round((z + H0) / P), 0, HX.N));
      const onX = inCity && Math.abs(x - gx) <= HX.ROAD_HW + 0.3, onZ = inCity && Math.abs(z - gz) <= HX.ROAD_HW + 0.3;
      const sx = o.corner ? o.corner[0] : (x - gx >= 0 ? 1 : -1), sz = o.corner ? o.corner[1] : (z - gz >= 0 ? 1 : -1);
      if (onX && onZ) { px = gx + sx * off; pz = gz + sz * off; }
      else if (onX) px = gx + sx * off;
      else if (onZ) pz = gz + sz * off;
      else if (x > HX.BRIDGE_X0 - 7 && x < HX.BRIDGE_X1 && Math.abs(z) < HX.BRIDGE_HW) pz = (z >= 0 ? 1 : -1) * (HX.BRIDGE_HW - 1.4);
    }
    const g = this._trapModel();
    const h = o.h != null ? o.h : prop && prop.h != null ? prop.h : (Math.hypot(x - px, z - pz) > 0.5 ? Math.atan2(x - px, z - pz) : 0); // the front (sign + bomb) faces the road
    g.position.set(px, HX.groundY(px, pz), pz); g.rotation.y = h; this.scene.add(g);
    const radius = o.radius || 15;
    this.trap = { x: px, z: pz, cx: x, cz: z, h, radius, kill: radius * 0.75, armed: true, ready: false, cops: 0, group: g, prompt: o.prompt !== false, onDetonate: o.onDetonate || null, circle: HX.addCircle(px, pz, 1.0, 'trap'), ledT: 0 };
    return this.trap;
  },
  trapReady() { const tr = this.trap; return !!(tr && tr.armed && tr.ready); },
  _dropTrapGroup(tr) {
    const g = tr && tr.group; if (!g || g.userData.dropped) return;
    g.userData.dropped = true; if (g.parent) g.parent.remove(g);
    const rig = g.userData.rig; if (rig && rig.dispose) { try { rig.dispose(); } catch (e) { /* its own LED materials only */ } }
  },
  _cylMats() {
    const T = this.T, M = this.M, G = this.G;
    if (M.cylW) return;
    M.cylW = new T.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.42, metalness: 0.2 }); M.cylR = new T.MeshStandardMaterial({ color: 0xb3241d, roughness: 0.45, metalness: 0.2 });
    M.brass = new T.MeshStandardMaterial({ color: 0x9c8240, roughness: 0.35, metalness: 0.85 }); M.tagG = new T.MeshStandardMaterial({ color: 0x2f8a46, roughness: 0.6 }); M.tagY = new T.MeshStandardMaterial({ color: 0xe3b51e, roughness: 0.6 });
    M.wood = new T.MeshStandardMaterial({ color: 0x8b6b45, roughness: 0.9 }); M.strap = new T.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.8 }); M.post = new T.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.5, metalness: 0.6 });
    this._lin(M.cylW, M.cylR, M.brass, M.tagG, M.tagY, M.wood, M.strap, M.post);
    M.sign = new T.MeshBasicMaterial({ map: new T.CanvasTexture(HBoom._signCanvas()), transparent: true, side: T.DoubleSide });
    G.cyl = new T.CylinderGeometry(0.16, 0.16, 0.92, 16); G.cyl.translate(0, 0.46, 0);
    G.shoulder = new T.SphereGeometry(0.16, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2); G.shoulder.scale(1, 0.55, 1); G.shoulder.translate(0, 0.92, 0);
    G.neck = new T.CylinderGeometry(0.04, 0.05, 0.13, 8); G.neck.translate(0, 1.06, 0);
    G.wheel = new T.TorusGeometry(0.055, 0.012, 5, 12); G.wheel.rotateX(Math.PI / 2); G.wheel.translate(0, 1.13, 0);
    G.collar = new T.CylinderGeometry(0.164, 0.164, 0.07, 16); G.collar.translate(0, 0.74, 0);
    G.board = new T.BoxGeometry(1.7, 0.035, 0.16); G.runner = new T.BoxGeometry(0.1, 0.1, 1.1); G.strapB = new T.BoxGeometry(1.62, 0.05, 0.02);
    G.post = new T.CylinderGeometry(0.03, 0.03, 1.3, 6); G.post.translate(0, 0.65, 0); G.sign = new T.PlaneGeometry(0.62, 0.62);
  },
  // six gas cylinders (white / red, brass valves, coloured collars) in pallet space
  _myCylinders() {
    const T = this.T, M = this.M, G = this.G, out = []; this._cylMats();
    [[-0.52, -0.22], [0, -0.22], [0.52, -0.22], [-0.52, 0.24], [0, 0.24], [0.52, 0.24]].forEach(([cx, cz], k) => {
      const c = new T.Group(), red = k % 3 === 1;
      c.add(new T.Mesh(G.cyl, red ? M.cylR : M.cylW)); c.add(new T.Mesh(G.shoulder, red ? M.cylR : M.cylW)); c.add(new T.Mesh(G.neck, M.brass)); c.add(new T.Mesh(G.wheel, M.brass)); c.add(new T.Mesh(G.collar, k % 2 ? M.tagG : M.tagY));
      c.position.set(cx + (Math.random() - 0.5) * 0.04, 0.136, cz + (Math.random() - 0.5) * 0.04); c.rotation.set((Math.random() - 0.5) * 0.04, Math.random() * 6.283, (Math.random() - 0.5) * 0.04);
      out.push(c);
    });
    return out;
  },
  _trapModel() {
    const H = this.H, T = this.T, g = new T.Group();
    let ext = null, cyls = [];
    if (window.HModels && typeof HModels.gasCylinders === 'function') { try { ext = HModels.gasCylinders(); if (ext) { H.markLinear(ext); g.add(ext); } } catch (e) { console.error(e); ext = null; } }
    if (!ext) {
      this._cylMats(); const M = this.M, G = this.G;
      for (const rx of [-0.55, 0, 0.55]) { const r = new T.Mesh(G.runner, M.wood); r.position.set(rx, 0.05, 0); g.add(r); }
      for (let k = 0; k < 6; k++) { const b = new T.Mesh(G.board, M.wood); b.position.set(0, 0.118, -0.46 + k * 0.184); g.add(b); }
      cyls = this._myCylinders(); for (const c of cyls) g.add(c);
      for (const [y, zz] of [[0.55, -0.4], [0.55, 0.42], [0.85, -0.4], [0.85, 0.42]]) { const s = new T.Mesh(G.strapB, M.strap); s.position.set(0, y, zz); g.add(s); }
      const post = new T.Mesh(G.post, M.post); post.position.set(1.05, 0, 0.45); g.add(post);
      const sign = new T.Mesh(G.sign, M.sign); sign.position.set(1.05, 1.15, 0.48); g.add(sign);
    }
    // Yoav's touch: a small canister bomb in front of the cylinders (on the pallet's front edge), its LED blinking
    const rig = this._bombModel(), sc = 0.72; rig.scale.setScalar(sc);
    if (rig.userData.ext) rig.position.set(ext ? -0.25 : -0.2, ext ? 0.12 : 0.136, ext ? 0.42 : 0.5); else rig.position.set(0, 0, 0.7);
    g.add(rig);
    const lp = rig.userData.ledP, led = new T.Sprite(this.M.led); led.scale.setScalar(0.45);
    led.position.set(rig.position.x + lp[0] * sc, rig.position.y + lp[1] * sc + 0.02, rig.position.z + lp[2] * sc); led.visible = false; g.add(led);
    g.userData.cyls = cyls; g.userData.ext = ext; g.userData.led = led; g.userData.rig = rig;
    return g;
  },
  _stepTrap(dt) {
    const tr = this.trap, H = this.H; if (!tr || !tr.armed) return;
    const p = H.player, pos = p && (p.inCar || p);
    let cops = 0; for (const v of HAI.police) if (!v.wrecked && Math.hypot(v.x - tr.cx, v.z - tr.cz) < tr.kill + 1) cops++; // in (or entering) the kill zone
    tr.cops = cops; tr.ready = H.state === 'play' && !!pos && Math.hypot(pos.x - tr.cx, pos.z - tr.cz) < 60 && cops > 0;
    tr.ledT += dt; const on = (tr.ledT % (tr.ready ? 0.25 : 0.9)) < 0.08; tr.group.userData.led.visible = on;
    const rig = tr.group.userData.rig; if (rig.userData.ext && rig.update) rig.update(on ? 0 : 0.5, 1);
  },
  detonateTrap(o) {
    if (!this._ensure()) return 0;
    const tr = this.trap; if (!tr || !tr.armed) return 0;
    o = o || {};
    const c0 = this.stats.cops;
    tr.armed = false; tr.ready = false; if (tr.circle) tr.circle.down = true;
    // the cylinders become missiles; the rest of the rig is gone in the fireball
    this._launchCylinders(tr);
    this._dropTrapGroup(tr);
    const n = this.explode(tr.x, 0.8, tr.z, { power: 3, radius: tr.radius, mega: true, inner: 0.7, quietToast: true });
    // the fireball rolls over the whole intersection: every cruiser in the kill zone (trap.kill around its middle) is wrecked
    this._job(0.09, () => this.explode(tr.cx, 1.3, tr.cz, { power: 2.4, radius: tr.radius, depth: 1, quiet: true, quietToast: true, inner: tr.kill / tr.radius }));
    this.slowmo(2.0, 0.34);
    if (o.cinematic !== undefined ? o.cinematic : this.cinematic) this._startCine(tr.cx, tr.cz, 2.2, 'trap');
    const done = o.onDone, cb = tr.onDetonate;
    this._job(2.3, () => {
      const total = this.stats.cops - c0;
      if (total > 0 && window.HHud) HHud.toast(total === 1 ? t('bm_copDown') : t('bm_copsDown', { n: total }), '#ffd23f');
      if (done) done(total); if (cb) cb(total);
    }, true);
    return n;
  },
  _launchCylinders(tr) {
    const T = this.T, g = tr.group, ext = g.userData.ext; let list = g.userData.cyls.slice();
    const ec = ext && (Array.isArray(ext.cylinders) ? ext.cylinders : ext.userData && ext.userData.cylinders);
    if (ec && ec.length) list = ec.slice();
    if (!list.length) { // a model without separable parts: our own cylinders fly instead (the model itself vanishes in the fireball)
      list = this._myCylinders(); for (const c of list) { c.position.x *= 1.1; g.add(c); }
    }
    g.updateMatrixWorld(true);
    const base = Math.atan2(tr.cx - tr.x, tr.cz - tr.z), wp = new T.Vector3(), wq = new T.Quaternion();
    list.forEach((c, k) => {
      c.getWorldPosition(wp); c.getWorldQuaternion(wq);
      if (c.parent) c.parent.remove(c);
      c.position.copy(wp); c.quaternion.copy(wq); this.scene.add(c);
      const a = base + (Math.random() - 0.5) * 2.6, sp = 5 + Math.random() * 9;
      this.cyls.push({ obj: c, x: wp.x, y: wp.y + 0.2, z: wp.z, vx: Math.sin(a) * sp, vy: 9 + Math.random() * 8, vz: Math.cos(a) * sp, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 8, wz: (Math.random() - 0.5) * 14, t: 0, boomAt: k % 3 === 2 ? 99 : 0.45 + Math.random() * 1.2, live: true, tr: 0 });
    });
  },
  _stepCyls(dt) {
    for (let k = this.cyls.length - 1; k >= 0; k--) {
      const c = this.cyls[k]; if (!c.live) continue;
      c.t += dt;
      if (c.y > 0.18 || c.vy > 0) {
        c.vy -= 13 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        const r = HX.resolveCircle(c.x, c.z, 0.2, true); if (r.hit) { const vn = c.vx * r.nx + c.vz * r.nz; if (vn < 0) { c.vx -= 1.6 * vn * r.nx; c.vz -= 1.6 * vn * r.nz; } c.x = r.x; c.z = r.z; }
        c.obj.rotation.x += c.wx * dt; c.obj.rotation.y += c.wy * dt; c.obj.rotation.z += c.wz * dt;
        if (c.y < 0.18 && c.vy < 0) { c.y = 0.18; if (c.vy < -3) { c.vy *= -0.32; c.vx *= 0.55; c.vz *= 0.55; c.wx *= 0.5; c.wz *= 0.5; this._sfxAt('crash', c.x, c.z, 0.5, undefined, 0.25); } else { c.vy = 0; c.vx *= 0.5; c.vz *= 0.5; } if (c.boomAt < 99 && c.t > 0.35) c.boomAt = Math.min(c.boomAt, c.t); }
        // escaping gas burns behind it
        if ((c.tr -= dt) <= 0) { c.tr = 0.05; c.tk = (c.tk || 0) + 1; this._emit(this.fire, c.x, c.y, c.z, -c.vx * 0.15, 0.5, -c.vz * 0.15, 0.34, 0.5, 1.5, 1.05, 0.06, 0.9, 3, 1.5, 0.85); if ((c.tk & 1) && this.smoke.n < this.SMOKE_N * 0.8) this._emit(this.smoke, c.x, c.y, c.z, 0, 0.8, 0, 1.2 + Math.random() * 0.6, 0.6, 2.8, 0.7, 0.8, 0.6, 1.2, 0.8); }
      } else {
        c.vx *= Math.exp(-2 * dt); c.vz *= Math.exp(-2 * dt); c.x += c.vx * dt; c.z += c.vz * dt; c.obj.rotation.x = HX.damp(c.obj.rotation.x, Math.PI / 2, 6, dt);
        if (c.t < 8 && (c.tr -= dt) <= 0 && this.smoke.n < this.SMOKE_N * 0.7) { c.tr = 0.14; this._emit(this.smoke, c.x, 0.3, c.z, 0, 0.9, 0, 2, 0.5, 2.2, 0.75, 0.2, 0.45, 1, 0.7); }
      }
      c.obj.position.set(c.x, c.y, c.z);
      if (c.t >= c.boomAt) { c.live = false; c.obj.visible = false; this.explode(c.x, c.y, c.z, { power: 1.1, radius: 7, depth: 1, noScorch: c.y > 2, quietToast: true }); }
    }
  },

  /* ================================================================ flying + burning wrecks */
  _preFlying() { for (const v of this.flying) { const b = v._bm; if (b && b.air) { b.pvx = v.vx; b.pvz = v.vz; } } },
  _stepFlying(dt) {
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const v = this.flying[k], b = v._bm, g = v.rig.group;
      if (!g.parent || !b) { this.flying.splice(k, 1); continue; }
      if (b.air) {
        // no tyre grip in the air: undo what the car's step took off the velocity (a wall bounce is kept)
        if (b.pvx !== undefined) { const dot = v.vx * b.pvx + v.vz * b.pvz, s2 = b.pvx * b.pvx + b.pvz * b.pvz; if (dot > 0.5 * s2) { v.x += (b.pvx - v.vx) * dt; v.z += (b.pvz - v.vz) * dt; v.vx = b.pvx * (1 - 0.15 * dt); v.vz = b.pvz * (1 - 0.15 * dt); } }
        b.vy -= 17 * dt; b.y += b.vy * dt; b.roll += b.wr * dt; b.pitch += b.wp * dt; v.h += b.wy * dt;
        if (b.y <= 0 && b.vy < 0) {
          b.y = 0;
          if (b.vy < -4) { b.vy *= -0.3; b.wr *= 0.55; b.wp *= 0.4; b.wy *= 0.5; if (window.HFX3) HFX3.sparkBurst(v.x, 0.3, v.z, 0, 0, 14); this._sfxAt('crash', v.x, v.z, 0.9, undefined, 0.65); this.H.cam.shake = Math.max(this.H.cam.shake, 0.25); }
          else { b.vy = 0; b.air = false; b.tRoll = Math.round(b.roll / Math.PI) * Math.PI; }
        }
      } else {
        b.roll = HX.damp(b.roll, b.tRoll, 7, dt); b.pitch = HX.damp(b.pitch, 0, 7, dt);
        if (Math.abs(b.roll - b.tRoll) < 0.01 && Math.abs(b.pitch) < 0.01) { b.roll = b.tRoll; b.pitch = 0; this.flying.splice(k, 1); }
      }
      // rotate about the body's middle, not the wheels: lift by the half height that the roll swings down
      v.y = b.y + b.h * 0.5 * (1 - Math.cos(b.roll) * Math.cos(b.pitch));
      g.position.y = v.y; g.rotation.x = b.pitch; g.rotation.z = b.roll; g.rotation.y = v.h;
    }
    for (let k = this.burning.length - 1; k >= 0; k--) {
      const B = this.burning[k], v = B.v; B.t += dt;
      if (B.t > B.dur || !v.rig.group.parent) { this.burning.splice(k, 1); continue; }
      B.acc += dt * 16 * HX.clamp((B.dur - B.t) / 3, 0.15, 1) * this.qk();
      while (B.acc >= 1) {
        B.acc -= 1; const fx = Math.sin(v.h), fz = Math.cos(v.h), o = (Math.random() - 0.3) * v.half * 0.9, up = v.y > 0.5 ? 0.5 : 1.1;
        this._emit(this.fire, v.x + fx * o + (Math.random() - 0.5), up, v.z + fz * o + (Math.random() - 0.5), 0, 1.5 + Math.random() * 1.5, 0, 0.5 + Math.random() * 0.4, 0.7, 1.9 + Math.random(), 0.8 + Math.random() * 0.3, 0.14 + Math.random() * 0.1, 0.85, 1.5, 2.5, 0.92);
        if (Math.random() < 0.25 && this.smoke.n < this.SMOKE_N * 0.8) this._emit(this.smoke, v.x + fx * o, up + 1, v.z + fz * o, 0, 2 + Math.random(), 0, 3 + Math.random() * 2, 1, 4.5, 0.55, 0.5, 0.7, 0.8, 0.6);
      }
    }
  },

  /* ================================================================ nitro */
  updateNitro(dt, car, held) {
    const N = this.nitro, H = this.H; if (!this.ready) return;
    const ok = N.owned && car && !car.wrecked && H.state === 'play';
    if (!ok) { N.active = false; this._fov = HX.damp(this._fov, 0, 6, dt); this._flames(null, dt); this._nosHeldPrev = false; return; }
    if (held && !N.active && N.charge > 0.12) { N.active = true; this._sfxAt('nitro', car.x, car.z, 1); }
    else if (held && !N.active && !this._nosHeldPrev) this._toast('nitro', t('bm_nitroEmpty'), '#8ec9ff');
    if (!held && N.active) N.active = false;
    this._nosHeldPrev = !!held;
    if (N.active) {
      N.charge = Math.max(0, N.charge - dt * 0.26); this._nitroIdle = 0;
      if (N.charge <= 0) N.active = false;
      const fx = Math.sin(car.h), fz = Math.cos(car.h), vF = car.vx * fx + car.vz * fz, top = car.spec.max * 1.42;
      const a = vF < -2 ? 0 : 19 * HX.clamp(1 - (vF / top) * (vF / top), 0, 1);
      car.vx += fx * a * dt; car.vz += fz * a * dt;
      H.cam.shake = Math.max(H.cam.shake || 0, 0.22);
      this._fov = HX.damp(this._fov, 9, 6, dt);
    } else {
      this._nitroIdle += dt; if (this._nitroIdle > 0.9) N.charge = Math.min(1, N.charge + dt * 0.055);
      this._fov = HX.damp(this._fov, 0, 4, dt);
    }
    this._flames(car, dt);
  },
  _buildFlames() {
    const T = this.T, glow = HWorld.tex && HWorld.tex.glow;
    const geo = new T.BufferGeometry(); // two crossed quads along -z (the nozzle at z = 0)
    geo.setAttribute('position', new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, -1, -0.5, 0, -1, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, -1, 0, -0.5, -1], 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uK: { value: 0 } }, transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uK; varying vec2 vUv;
        void main(){
          float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
          float fl = 0.8 + 0.2 * sin(uTime * 61.0) * sin(uTime * 37.0 + y * 9.0);
          float len = max(0.05, uK * fl), yy = y / len; if (yy > 1.0) discard;
          float w = (1.0 - yy) * (0.5 + 0.5 * sqrt(max(0.0, 1.0 - yy)));
          float body = smoothstep(w, w * 0.3, x);
          float dia = 0.65 + 0.35 * smoothstep(0.4, 1.0, sin(yy * 24.0 - uTime * 40.0)); // shock diamonds
          float core = smoothstep(w * 0.55, 0.0, x) * (1.0 - yy);
          vec3 col = mix(vec3(0.25, 0.45, 3.6), vec3(3.4, 5.0, 9.0), core) * dia;
          float a = body * (1.0 - yy * 0.55) * min(1.0, uK * 1.5);
          gl_FragColor = vec4(col * a, a * 0.12);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    const glowM = new T.SpriteMaterial({ map: glow, color: new T.Color(0.7, 1.3, 4.2), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
    const poolM = new T.MeshBasicMaterial({ map: glow, color: new T.Color(0.25, 0.55, 2.2), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0 });
    const g = new T.Group(), parts = [];
    for (let s = 0; s < 2; s++) { const m = new T.Mesh(geo, mat); m.renderOrder = 9; m.frustumCulled = false; const sp = new T.Sprite(glowM); sp.renderOrder = 9; g.add(m); g.add(sp); parts.push({ m, sp }); }
    const pool = new T.Mesh(new T.PlaneGeometry(1, 1), poolM); pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; g.add(pool);
    this.flame = { group: g, mat, parts, pool, poolM, car: null, k: 0, acc: 0 };
  },
  _flames(car, dt) {
    const F = this.flame; if (!F) return;
    F.k = car ? HX.damp(F.k, this.nitro.active ? 1 : 0, this.nitro.active ? 16 : 10, dt || 0.016) : 0;
    if (!car || F.k <= 0.02) { if (F.group.parent) F.group.parent.remove(F.group); F.car = null; return; }
    if (F.car !== car || F.group.parent !== car.rig.group) {
      car.rig.group.add(F.group); F.car = car;
      const dm = car.rig.dims || {}, L = dm.length || 4.5, W = dm.width || 1.9, ex = car.rig.exhaust;
      const pts = Array.isArray(ex) && ex.length ? ex : [[W * 0.27, 0.33, -L / 2 + 0.05], [-W * 0.27, 0.33, -L / 2 + 0.05]];
      F.parts.forEach((p, i) => { const q = pts[Math.min(i, pts.length - 1)], x = q.x !== undefined ? q.x : q[0], y = q.y !== undefined ? q.y : q[1], z = q.z !== undefined ? q.z : q[2]; p.m.position.set(x, y, z); p.sp.position.set(x, y, z - 0.12); p.m.visible = p.sp.visible = i < pts.length; });
      F.pool.position.set(0, 0.07, -L / 2 - 1.1); F.pool.scale.set(3, 4.2, 1);
    }
    const T = this.H.time;
    F.mat.uniforms.uTime.value = T; F.mat.uniforms.uK.value = F.k;
    for (const p of F.parts) { p.m.scale.set(0.4, 0.4, 1.9 * (0.85 + 0.15 * Math.sin(T * 47))); p.sp.scale.setScalar(0.6 * F.k * (0.85 + 0.15 * Math.sin(T * 53))); }
    F.poolM.opacity = 0.6 * F.k;
    // blue flame puffs left behind in world space (they streak as the car pulls away)
    if (this.nitro.active && dt) {
      F.acc += dt * 64 * this.qk();
      const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = Math.cos(car.h), rz = -Math.sin(car.h);
      while (F.acc >= 1) {
        F.acc -= 1; const p = F.parts[(Math.random() * 2) | 0].m.position;
        this._emit(this.fire, car.x + rx * p.x + fx * (p.z - 0.3), p.y + 0.02, car.z + rz * p.x + fz * (p.z - 0.3), car.vx * 0.55 - fx * 6, 0.3, car.vz * 0.55 - fz * 6, 0.14 + Math.random() * 0.07, 0.22, 0.62, -(0.75 + Math.random() * 0.4), 0, 0.85, 4, 0, 1);
      }
    }
  },

  /* ================================================================ slow motion + the takedown camera */
  slowmo(dur, scale) {
    if (!this._ensure()) return;
    const H = this.H, s = this.slow;
    if (!s.on) { s.base = H.timeScale || 1; if (window.HAudio) HAudio.sfx('slowIn'); }
    s.on = true; s.t = 0; s.dur = Math.max(0.4, dur || 1.5); s.k = HX.clamp(scale || 0.3, 0.05, 1); s.outSfx = false;
  },
  _slowTick(rdt) {
    const s = this.slow, H = this.H; if (!s.on) return;
    s.t += rdt;
    const inT = 0.14, outT = 0.5; let k;
    if (s.t < inT) k = HX.lerp(1, s.k, s.t / inT);
    else if (s.t < s.dur - outT) k = s.k;
    else if (s.t < s.dur) { const u = (s.t - (s.dur - outT)) / outT; k = HX.lerp(s.k, 1, u * u * (3 - 2 * u)); if (!s.outSfx) { s.outSfx = true; if (window.HAudio) HAudio.sfx('slowOut'); } }
    else { this._slowEnd(); return; }
    if (this._tsW !== null && H.timeScale !== this._tsW) s.base = H.timeScale || 1; // someone else (Ido's Focus, the crew wheel) changed it
    H.timeScale = this._tsW = Math.min(k, s.base);
    const ds = (1 - k) / (1 - s.k + 1e-6) * 0.28; // a warm, slightly drained grade while time drags
    if (H.bloom) { if (this._dsW === null ? !(H.desat > 0) : H.desat === this._dsW) { H.desat = this._dsW = ds; H.desatTint = [1.12, 0.96, 0.82]; } }
    else if (H.canvas) { H.canvas.style.filter = 'saturate(' + (1 - ds * 1.2).toFixed(2) + ')'; this._filterSet = true; }
  },
  _slowEnd() {
    const s = this.slow, H = this.H; s.on = false;
    if (H) {
      if (this._tsW !== null && H.timeScale === this._tsW) H.timeScale = s.base || 1;
      if (this._dsW !== null && H.desat === this._dsW) { H.desat = 0; H.desatTint = [1, 1, 1]; }
      if (this._filterSet && H.canvas) H.canvas.style.filter = '';
    }
    this._tsW = null; this._dsW = null; this._filterSet = false;
  },
  _startCine(x, z, dur, kind) {
    const H = this.H; if (!this.cinematic || H.camOverride || H.state !== 'play' || !H.player) return false;
    const p = H.player, v = p.inCar, px = v ? v.x : p.x, pz = v ? v.z : p.z;
    let ux = px - x, uz = pz - z; const L = Math.hypot(ux, uz);
    if (L < 2) { ux = Math.sin((v || p).h); uz = Math.cos((v || p).h); } else { ux /= L; uz /= L; }
    // film from the side of the blast-to-car line that has the most room
    const trap = kind === 'trap', d0 = trap ? 15 : 7, sd = trap ? 11 : 7;
    const free = (s) => HX.raycast(x, z, x + ux * d0 - uz * s * sd, z + uz * d0 + ux * s * sd, 1.5);
    this.cine = { t: 0, dur, x, z, kind, ux, uz, side: free(1) >= free(-1) ? 1 : -1, shake: 0.8, sx: null, sz: null };
    this._lastCine = this.clock;
    H.camOverride = this._camFn;
    return true;
  },
  // the takedown shot: a low side angle on the blast, the getaway car in the frame, a slow push-in
  _cineCam(dt, camera) {
    const c = this.cine, H = this.H; if (!c) return;
    const p = H.player, v = p.inCar, px = v ? v.x : p.x, pz = v ? v.z : p.z, k = HX.clamp(c.t / c.dur, 0, 1), e = k * k * (3 - 2 * k), trap = c.kind === 'trap';
    const sx = -c.uz * c.side, sz = c.ux * c.side;
    const along = (trap ? 16 : 7.5) - e * (trap ? 3 : 1.5), side = (trap ? 11 : 6.5) - e * (trap ? 2 : 1), up = (trap ? 5.5 : 2.2) + e * (trap ? 1.5 : 0.6);
    let cx = c.x + c.ux * along + sx * side, cz = c.z + c.uz * along + sz * side;
    const hit = HX.raycast(c.x, c.z, cx, cz, up - 0.5); if (hit < 1) { const kk = Math.max(0.3, hit - 0.06); cx = c.x + (cx - c.x) * kk; cz = c.z + (cz - c.z) * kk; }
    if (c.sx === null) { c.sx = cx; c.sz = cz; } else { const ee = 1 - Math.exp(-6 * (H.realDt || 0.016)); c.sx += (cx - c.sx) * ee; c.sz += (cz - c.sz) * ee; }
    // aim at the blast, nudged a little toward the car (capped: a getaway car far down the road must not pull the blast out of frame),
    // tilting up as the fireball and the wrecks rise
    const lead = Math.min(Math.hypot(px - c.x, pz - c.z) * (trap ? 0.18 : 0.25), trap ? 4 : 2.5);
    const lx = c.x + c.ux * lead, lz = c.z + c.uz * lead, ly = (trap ? 3.1 : 1.6) + e * (trap ? 1.3 : 0.9);
    const sh = c.shake * c.shake * 0.22;
    camera.position.set(c.sx + (Math.random() - 0.5) * sh, up + (Math.random() - 0.5) * sh, c.sz + (Math.random() - 0.5) * sh);
    camera.fov = trap ? 62 : 56; camera.updateProjectionMatrix(); camera.lookAt(lx, ly, lz);
    H.cam.x = camera.position.x; H.cam.y = camera.position.y; H.cam.z = camera.position.z;
  },

  /* ================================================================ frame */
  _pre(dt) {
    if (!this.ready) return;
    const H = this.H;
    this._dropCd -= dt;
    // input: G / the touch button (detonate the trap when it is ready, else drop a bomb), Shift / the touch button for nitro.
    // Ignored while another module owns the camera (the crew switch's sky cam, a scripted shot): gameplay input is frozen then.
    const camBusy = !!H.camOverride && H.camOverride !== this._camFn;
    if (this.keys && H.state === 'play' && !camBusy) {
      if ((H.pressed('KeyG') || this._tapBomb) && !this.cine) {
        if (this.trapReady()) this.detonateTrap();
        else if (H.player && H.player.inCar) { if (this.bombs > 0 || this._hadBombs) this.dropBomb(); else if (this.trap && this.trap.armed) this._toast('trap', t('bm_trapWait'), '#ffd23f'); }
        else if (this.bombs > 0) this._toast('carOnly', t('bm_carOnly'), '#fff');
      }
      const car = H.player && H.player.inCar;
      this.updateNitro(dt, car, this.nitro.owned && !!car && (H.key('ShiftLeft', 'ShiftRight') || this._holdNos));
    } else if (this.keys) { this.nitro.active = false; this._flames(null, dt); }
    this._tapBomb = false;
    this._preFlying();
  },
  _update(dt) {
    if (!this.ready) return;
    const H = this.H, rdt = H.realDt > 0 ? H.realDt : dt / Math.max(0.05, H.timeScale || 1);
    this.clock += dt;
    for (let i = this.jobs.length - 1; i >= 0; i--) { const j = this.jobs[i]; j.t -= j.real ? rdt : dt; if (j.t <= 0) { this.jobs.splice(i, 1); try { j.fn(); } catch (e) { console.error(e); } } }
    this._slowTick(rdt);
    if (this.cine) { this.cine.t += rdt; this.cine.shake = Math.max(0, this.cine.shake - rdt * 1.2); if (this.cine.t >= this.cine.dur || H.state !== 'play') { if (H.camOverride === this._camFn) H.camOverride = null; this.cine = null; } }
    this._stepBombs(dt);
    this._stepTrap(dt);
    this._stepCyls(dt);
    this._stepFlying(dt);
    this._stepDebris(dt);
    // the smoke takes its colour from the sky / fog of the moment
    const pal = HWorld.todPal, fog = this.scene.fog, sm = this.M.smoke.uniforms, fd = fog ? fog.density : 0;
    if (pal) { const s = sm.uSmoke.value, a = 0.13, hk = pal.hemiI * a, sk = pal.sunI * 0.35 * a, lk = pal.lamps; s.setRGB(0.03 + 0.05 * lk + pal.hemiS.r * hk + pal.sun.r * sk, 0.026 + 0.038 * lk + pal.hemiS.g * hk + pal.sun.g * sk, 0.032 + 0.026 * lk + pal.hemiS.b * hk + pal.sun.b * sk); }
    if (fog) sm.uFogCol.value.copy(fog.color);
    sm.uFogD.value = fd; this.M.fire.uniforms.uFogD.value = fd;
    this._stepSys(this.fire, dt, false);
    this._stepSys(this.smoke, dt, true);
    // shockwave rings
    for (const r of this.rings) { if (r.t < 0) continue; r.t += dt; const u = r.t / r.dur; if (u >= 1) { r.t = -1; r.mesh.visible = false; continue; } r.mesh.scale.setScalar(0.5 + r.R * (1 - (1 - u) * (1 - u))); r.mesh.material.opacity = 0.7 * (1 - u) * (1 - u) * (1 - u); }
    for (const r of this.airRings) { if (r.t < 0) continue; r.t += dt; const u = r.t / r.dur; if (u >= 1) { r.t = -1; r.sprite.visible = false; continue; } r.sprite.scale.setScalar(1 + r.R * 2 * Math.sqrt(u)); r.sprite.material.opacity = 0.22 * (1 - u) * (1 - u); }
    // the blast light: a hard flash, then a flickering orange decay
    if (this.lightT >= 0) {
      this.lightT += dt; const u = this.lightT;
      const e = u < 0.04 ? u / 0.04 : Math.exp(-(u - 0.04) * 4 / this.lightDur);
      if (u > this.lightDur * 2.2) { this.lightT = -1; this.light.intensity = 0; this.pool.visible = false; }
      else { const fl = 0.85 + 0.15 * Math.sin(u * 47) * Math.sin(u * 23); this.light.intensity = this.lightP * e * fl; this.light.color.setRGB(1, 0.55 + 0.35 * e, 0.22 + 0.4 * e * e); this.pool.material.opacity = Math.min(1, e * 1.2) * fl; }
    }
    // nitro FOV kick (the follow camera eases toward its own target right after this)
    const pc = H.player && H.player.inCar;
    if (this._fov > 0.05 && pc && !H.camOverride) H.cam.fov = Math.max(H.cam.fov, Math.min(84, 62 + Math.min(18, Math.abs(pc.vF) * 0.32) + this._fov));
    this._hudTick();
  },
  _job(delay, fn, real) { this.jobs.push({ t: delay, fn, real: !!real }); },
  _sfxAt(name, x, z, vol, pitch, inten) {
    if (!window.HAudio || !this.H) return;
    const H = this.H, cam = H.camera.position, dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz), right = -Math.cos(H.cam.yaw) * dx + Math.sin(H.cam.yaw) * dz;
    HAudio.sfx(name, { vol: (vol || 1) * HX.clamp(1.15 - d / 90, 0.12, 1), pan: HX.clamp(right / (d || 1), -1, 1) * 0.7, pitch, intensity: inten });
  },
  _toast(key, text, col) { const now = this.clock || 0; if (this._toastT[key] !== undefined && now - this._toastT[key] < 2) return; this._toastT[key] = now; if (window.HHud) HHud.toast(text, col); },

  /* ================================================================ HUD: gadget chips, the detonate prompt, touch buttons */
  ICONS: {
    bomb: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 8.5c0-3 8-3 8 0" stroke="#26231f" stroke-width="2.2" fill="none"/><rect x="8.5" y="8" width="15" height="20" rx="3.2" fill="#d9a62b"/><rect x="8.5" y="11" width="15" height="2.6" fill="#26231f"/><rect x="8.5" y="23" width="15" height="2.6" fill="#26231f"/><rect x="12" y="15.5" width="8" height="5" rx="1" fill="#3a3d42"/><circle cx="18" cy="18" r="1.4" fill="#ff3020"/></svg>',
    flame: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c5 7 10 11 8 18-1.5 6-14.5 6-16 0-1.2-5 3-8 4-12 1.5 4 3 5 4 3 1.5-3 1-6 0-9z" fill="#3f8cff"/><path d="M16 13c3 4 4 6 3 9-1 3-5 3-6 0-.5-2 1-4 3-9z" fill="#e6f6ff"/></svg>',
    boom: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2l3 7 7-4-3 8 7 3-7 3 3 8-7-4-3 7-3-7-7 4 3-8-7-3 7-3-3-8 7 4z" fill="#ffd23f"/><path d="M16 9l1.8 4.4 4.4-2.4-1.9 4.9 4.4 1.6-4.4 1.6 1.9 4.9-4.4-2.4L16 26.4l-1.8-4.4-4.4 2.4 1.9-4.9-4.4-1.6 4.4-1.6-1.9-4.9 4.4 2.4z" fill="#ff5a1f"/></svg>',
  },
  _css() {
    if (document.getElementById('bm-css')) return;
    const st = document.createElement('style'); st.id = 'bm-css';
    st.textContent = `
    #hhud .bm-gad { position:absolute; right:26px; bottom:98px; display:flex; flex-direction:column; gap:6px; align-items:flex-end; transform:scale(var(--u)); transform-origin:bottom right; direction:ltr; }
    [dir="rtl"] #hhud .bm-gad { right:auto; left:26px; align-items:flex-start; transform-origin:bottom left; }
    #hhud .bm-chip { display:flex; align-items:center; gap:8px; height:36px; padding:0 9px 0 6px; border-radius:6px; background:linear-gradient(90deg, rgba(8,4,18,.25), rgba(8,4,18,.8)); border-right:3px solid #ffd23f; transition:opacity .25s, box-shadow .2s; }
    [dir="rtl"] #hhud .bm-chip { flex-direction:row-reverse; padding:0 6px 0 9px; border-right:0; border-left:3px solid #ffd23f; background:linear-gradient(270deg, rgba(8,4,18,.25), rgba(8,4,18,.8)); }
    #hhud .bm-chip.nos, [dir="rtl"] #hhud .bm-chip.nos { border-color:#4da3ff; }
    #hhud .bm-chip svg { width:26px; height:26px; flex:none; filter:drop-shadow(0 2px 0 rgba(0,0,0,.6)); }
    #hhud .bm-chip b { font:400 30px/1 'Bebas Neue', Impact, sans-serif; letter-spacing:1px; color:#fff; text-shadow:0 2px 0 #000; min-width:36px; text-align:center; font-variant-numeric:tabular-nums; }
    #hhud .bm-chip kbd { font:800 12px/1 Rubik, sans-serif; color:#fff; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.4); border-bottom-width:2px; border-radius:4px; padding:3px 6px 2px; letter-spacing:.5px; }
    #hhud .bm-chip.off { opacity:.38; }
    #hhud .bm-bar { width:92px; height:9px; border-radius:5px; overflow:hidden; background:rgba(0,0,0,.65); border:1px solid rgba(120,190,255,.5); }
    #hhud .bm-bar i { display:block; height:100%; width:100%; background:linear-gradient(90deg,#1f4fe0,#4da3ff 55%,#dff3ff); transform-origin:left center; }
    #hhud .bm-chip.nos.on { box-shadow:0 0 18px rgba(77,163,255,.75); }
    #hhud .bm-chip.nos.on .bm-bar i { animation:bmflick .1s steps(2) infinite; }
    @keyframes bmflick { 50% { filter:brightness(1.5); } }
    #hhud .bm-prompt { position:absolute; left:50%; bottom:168px; transform:translateX(-50%) scale(var(--u)); transform-origin:bottom center; display:flex; gap:12px; align-items:center; white-space:nowrap;
      background:rgba(34,6,4,.86); border:2px solid #ff4d2e; border-radius:12px; padding:9px 20px 9px 12px; font:800 25px/1.1 Rubik, sans-serif; color:#fff; text-shadow:0 2px 0 #000; animation:bmpulse .55s ease-in-out infinite alternate; }
    [dir="rtl"] #hhud .bm-prompt { padding:9px 12px 9px 20px; }
    #hhud .bm-prompt kbd { font:900 24px/1 Rubik, sans-serif; background:#ff4d2e; color:#fff; border-radius:7px; padding:5px 12px; text-shadow:none; box-shadow:0 3px 0 #7a1406; }
    #hhud .bm-prompt svg { width:34px; height:34px; }
    @keyframes bmpulse { from { box-shadow:0 0 0 rgba(255,77,46,0); } to { box-shadow:0 0 30px rgba(255,77,46,.9); } }
    #hhud .bm-tb { position:absolute; width:84px; height:84px; margin:-42px 0 0 -42px; border-radius:50%; padding:0; pointer-events:auto; touch-action:none; user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent;
      display:grid; place-items:center; border:3px solid rgba(255,255,255,.75); background:rgba(10,6,20,.5); color:#fff; box-shadow:0 4px 14px rgba(0,0,0,.45); }
    #hhud .bm-tb svg { width:44px; height:44px; pointer-events:none; }
    #hhud .bm-tb .bm-cnt { position:absolute; right:-6px; top:-6px; min-width:28px; height:28px; border-radius:14px; background:#ffd23f; color:#1a0a22; font:900 17px/28px Rubik, sans-serif; text-align:center; box-shadow:0 2px 0 rgba(0,0,0,.5); pointer-events:none; }
    #hhud .bm-tb.nos { border-color:transparent; background:radial-gradient(circle, rgba(10,6,20,.72) 58%, transparent 59%), conic-gradient(#4da3ff calc(var(--c, 1) * 360deg), rgba(255,255,255,.18) 0); }
    #hhud .bm-tb.nos.on { box-shadow:0 0 22px rgba(77,163,255,.9); }
    #hhud .bm-tb.off { opacity:.45; }
    #hhud .bm-tb.boom { border-color:#ffd23f; background:#e8361b; animation:bmpulse .45s ease-in-out infinite alternate; }
    #hhud .bm-tb.boom .bm-cnt { display:none; }
    `;
    document.head.appendChild(st);
  },
  _hud() {
    const root = window.HHud && HHud.el; if (!root || this.gadEl) return;
    const gad = this.gadEl = document.createElement('div'); gad.className = 'bm-gad'; gad.hidden = true;
    gad.innerHTML = `<div class="bm-chip bomb">${this.ICONS.bomb}<b>×0</b><kbd>G</kbd></div><div class="bm-chip nos">${this.ICONS.flame}<span class="bm-bar"><i></i></span><kbd>SHIFT</kbd></div>`;
    root.appendChild(gad);
    this._chipB = gad.children[0]; this._chipN = gad.children[1]; this._chipBn = this._chipB.querySelector('b'); this._barN = this._chipN.querySelector('.bm-bar i');
    const pr = this.promptEl = document.createElement('div'); pr.className = 'bm-prompt'; pr.hidden = true; root.appendChild(pr);
    const mk = (cls, x, y) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'bm-tb ' + cls; b.style.left = x + 'px'; b.style.top = y + 'px'; b.hidden = true; root.appendChild(b); return b; };
    // right-thumb arc, clear of the handbrake (1190,650) / action (1085,600) buttons and of the speedometer
    this.tbBomb = mk('bomb', 1012, 518); this.tbBomb.innerHTML = this.ICONS.bomb + '<span class="bm-cnt">0</span>';
    this.tbNos = mk('nos', 988, 664); this.tbNos.innerHTML = this.ICONS.flame;
    this.tbBomb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this._tapBomb = true; });
    const nosOn = (e) => { e.preventDefault(); e.stopPropagation(); this._holdNos = true; try { this.tbNos.setPointerCapture(e.pointerId); } catch (er) { /* not capturable */ } };
    const nosOff = () => { this._holdNos = false; };
    this.tbNos.addEventListener('pointerdown', nosOn); this.tbNos.addEventListener('pointerup', nosOff); this.tbNos.addEventListener('pointercancel', nosOff); this.tbNos.addEventListener('lostpointercapture', nosOff);
    for (const b of [this.tbBomb, this.tbNos]) b.addEventListener('contextmenu', (e) => e.preventDefault());
    this._h = {};
  },
  // DOM writes only when something changed (it runs every frame)
  _hudTick(force) {
    if (!this.gadEl) return;
    const H = this.H, h = this._h, N = this.nitro, tr = this.trap;
    if (force) for (const k in h) delete h[k];
    const show = !!H && H.state === 'play' && !H.camOverride;
    const inCar = !!(H && H.player && H.player.inCar), touch = !!Input.touchMode;
    const hasB = this.bombs > 0 || !!this._hadBombs, hasN = !!N.owned, ready = !!(tr && tr.armed && tr.ready);
    let v = show && !touch && (hasB || hasN); if (h.gad !== v) { h.gad = v; this.gadEl.hidden = !v; }
    if (h.chipB !== hasB) { h.chipB = hasB; this._chipB.style.display = hasB ? '' : 'none'; }
    if (h.chipN !== hasN) { h.chipN = hasN; this._chipN.style.display = hasN ? '' : 'none'; }
    if (h.bn !== this.bombs) { h.bn = this.bombs; this._chipBn.textContent = '×' + this.bombs; const c = this.tbBomb.querySelector('.bm-cnt'); if (c) c.textContent = this.bombs; }
    v = !inCar || this.bombs <= 0; if (h.boff !== v) { h.boff = v; this._chipB.classList.toggle('off', v); }
    v = !inCar || (N.charge <= 0.12 && !N.active); if (h.noff !== v) { h.noff = v; this._chipN.classList.toggle('off', v); }
    v = !!N.active; if (h.non !== v) { h.non = v; this._chipN.classList.toggle('on', v); this.tbNos.classList.toggle('on', v); }
    v = Math.round(N.charge * 100); if (h.nc !== v) { h.nc = v; this._barN.style.transform = 'scaleX(' + v / 100 + ')'; this.tbNos.style.setProperty('--c', (v / 100).toFixed(2)); }
    const pk = show && ready && tr.prompt ? (touch ? 't' : 'k') + (typeof LANG !== 'undefined' ? LANG : 'en') : '';
    if (h.pr !== pk) { h.pr = pk; this.promptEl.hidden = !pk; if (pk) { this.promptEl.innerHTML = (touch ? this.ICONS.boom : '<kbd>G</kbd>') + '<span></span>'; this.promptEl.querySelector('span').textContent = t('bm_trapPrompt'); } }
    v = show && touch && inCar && (hasB || ready); if (h.tb !== v) { h.tb = v; this.tbBomb.hidden = !v; }
    if (h.tbBoom !== ready) { h.tbBoom = ready; this.tbBomb.classList.toggle('boom', ready); this.tbBomb.innerHTML = (ready ? this.ICONS.boom : this.ICONS.bomb) + '<span class="bm-cnt">' + this.bombs + '</span>'; }
    v = !ready && this.bombs <= 0; if (h.tbOff !== v) { h.tbOff = v; this.tbBomb.classList.toggle('off', v); }
    v = show && touch && inCar && hasN; if (h.tn !== v) { h.tn = v; this.tbNos.hidden = !v; }
  },
};
window.HBoom = HBoom;
