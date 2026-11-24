/* Heist chapter engine: renderer + post (bloom, wet-street reflections), player on foot / in cars,
   orbit + chase cameras, input, markers and the frame loop. The mission script lives in mission.js. */
const Heist = {
  active: false, state: 'off', paused: false, T: null, q: 'high',
  player: null, car: null, cars: [], peds: [], events: [], time: 0, tod: 0, todTarget: null,
  cam: { yaw: 0, pitch: 0.28, dist: 4.8, manualT: 0, shake: 0, fov: 60, x: 0, y: 3, z: 0, ly: 0 },
  mouse: { dx: 0, dy: 0, locked: false, drag: false, lx: 0, ly: 0 },

  /* ================= lifecycle ================= */
  async start(opts) {
    if (this.active) return;
    this.opts = opts || {}; this.active = true; this.state = 'loading'; this.paused = false;
    const stage = this.stage = document.getElementById('stage');
    HHud.init(stage); HHud.loading(true, this.opts.story === 'crew' ? 'THE CREW' : 'THE BIG SCORE', t('h_loading'), t(Input.touchMode ? 'h_tip1Touch' : 'h_tip1'), 0.05);
    document.getElementById('game').style.visibility = 'hidden';
    if (typeof AudioSys !== 'undefined') { AudioSys.stopMusic(); }
    try {
      const T = this.T = await HX.loadThree();
      HHud.loading(true, undefined, undefined, undefined, 0.35);
      if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('400 40px "Bebas Neue"'), document.fonts.load('900 20px Rubik')]), new Promise(r => setTimeout(r, 1500))]);
      await new Promise(r => setTimeout(r, 30));
      if (!this.active) return;
      this.setup(T);
      HHud.loading(true, undefined, undefined, undefined, 0.7);
      await new Promise(r => setTimeout(r, 30));
      if (!this.active) return;
      this.buildWorld();
      HHud.loading(true, undefined, undefined, undefined, 1);
      await new Promise(r => setTimeout(r, 120));
      if (!this.active) return;
      HHud.loading(false); HHud.show(true);
      HMission.begin(this, this.opts.free, this.opts.story || 'heist');
    } catch (err) {
      console.error(err);
      HHud.loading(true, ':(', t('h_loadfail'), String(err && err.message || err), 0);
      setTimeout(() => { if (this.active) this.quit(); }, 3500);
    }
  },
  stop() {
    if (!this.active) return;
    this.active = false; this.state = 'off'; this.paused = false;
    if (window.HCrew && HCrew.stop) { try { HCrew.stop(); } catch (e) { console.error(e); } }
    if (window.HShop && HShop.close) { try { HShop.close(true); } catch (e) { console.error(e); } }
    if (window.HCrewStory && HCrewStory.stop) { try { HCrewStory.stop(); } catch (e) { console.error(e); } }
    HMission.cancel(); // invalidate the mission's pending timers and cut callbacks before endCut() can run one
    if (window.HHack && HHack.active) HHack.stop();
    if (window.HAudio) HAudio.stopAll();
    if (HHud.ready) { HHud.show(false); HHud.loading(false); HHud.endCut(true); HHud.fade(0, 0); HHud.prompt(); HHud.help(''); HHud.hideBanner(); }
    const res = document.getElementById('hresults'); if (res) res.remove();
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.canvas) this.canvas.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp); document.removeEventListener('pointerlockchange', this._onLock);
    if (this.renderer) { this.disposeAll(); }
    // per-session state: the next start() builds a new scene, so nothing may survive from this one
    this.W = this.H = 0; this._pf = null; this.time = 0;
    this.player = null; this.car = null; HVehicle.player = null; this.cars = []; this.parked = []; this.peds = []; this.events.length = 0;
    this.aiCtx = null; this._lightsOn = undefined; this._ambKey = undefined; this._radarT = 0; this.flash = null; this.todTarget = null;
    this.timeScale = 1; this.camOverride = null; this.interior = null; this.mods = [];
    HMission.vault = null; HMission.cash = []; HMission.hacker = null;
    document.getElementById('game').style.visibility = '';
    Input.BTN = this._origBTN || Input.BTN;
  },
  quit() { const cb = this.opts && this.opts.onExit; this.stop(); if (cb) cb(); },
  disposeAll() {
    try {
      HAI.reset(); HFX3.clear && HFX3.clear(); HExtras.reset();
      this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture && !m[k].isVideoTexture) m[k].dispose(); m.dispose(); }); });
      if (HMission.vault && HMission.vault.scene) HMission.vault.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      for (const sc of this.extraScenes || []) sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture && !m[k].isVideoTexture) m[k].dispose(); m.dispose(); }); });
      this.extraScenes = [];
      for (const k of ['rtScene', 'rt2', 'rt2b', 'rt4', 'rt4b', 'rt8', 'rt8b', 'reflRT']) if (this[k]) this[k].dispose();
      this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss();
    } catch (e) { console.error(e); }
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.billVideo) { this.billVideo.pause(); this.billVideo.removeAttribute('src'); this.billVideo.load(); }
    this.renderer = null; this.scene = null; this.canvas = null;
  },

  /* ================= renderer / post ================= */
  setup(T) {
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    this.q = this.opts.quality || (touch ? 'med' : 'high');
    const cv = this.canvas = document.createElement('canvas'); cv.id = 'game3d';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;touch-action:none;';
    this.stage.insertBefore(cv, document.getElementById('hhud'));
    const r = this.renderer = new T.WebGLRenderer({ canvas: cv, antialias: this.q === 'low', powerPreference: 'high-performance', stencil: false });
    this.isGL2 = r.capabilities.isWebGL2;
    const floatOK = this.isGL2 && (r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    this.bloom = this.q !== 'low'; this.reflect = this.q !== 'low';
    this.hdrType = floatOK ? T.HalfFloatType : T.UnsignedByteType;
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = this.bloom ? T.NoToneMapping : T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x05030b, 1);
    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x170a2a, 0.003);
    this.camera = new T.PerspectiveCamera(60, 16 / 9, 0.25, 3000);
    this.lights = { hemi: new T.HemisphereLight(0x6a52ff, 0x1b0b1f, 0.6), sun: new T.DirectionalLight(0x8fa8ff, 0.3) };
    this.scene.add(this.lights.hemi); this.scene.add(this.lights.sun); this.scene.add(this.lights.sun.target);
    // the hero car's headlights: one real spotlight that follows the player car at night
    this.head = new T.SpotLight(0xfff0d0, 0, 60, 0.45, 0.6, 1.2); this.scene.add(this.head); this.scene.add(this.head.target);
    // police light that flashes on the nearest cop car
    this.copLight = new T.PointLight(0xff2040, 0, 26, 2); this.scene.add(this.copLight);
    // environment for glossy paint and glass
    this.env = this.makeEnv(T); // only cars, glass and chrome get it (a scene-wide env washes the night out)
    this.resize();
    if (this.bloom) this.setupPost(T);
    if (this.reflect) this.setupReflection(T);
    // input
    this.bindInput();
    this._origBTN = Input.BTN;
    Input.BTN = { dash: { x: 1190, y: 650 }, special: { x: 1085, y: 600 }, r: 44, hit: 60 };
  },
  // reflection environment for paint / glass / chrome: a neutral dusk sky dome with thin neon accents
  makeEnv(T) {
    const pm = new T.PMREMGenerator(this.renderer), es = new T.Scene();
    es.background = new T.Color(0x0b0d18);
    const ring = new T.Mesh(new T.CylinderGeometry(40, 40, 9, 32, 1, true), new T.MeshBasicMaterial({ color: 0x6e5a66, side: T.BackSide })); ring.position.y = 2; es.add(ring); // warm horizon band
    const sky = new T.Mesh(new T.CylinderGeometry(40, 40, 30, 32, 1, true), new T.MeshBasicMaterial({ color: 0x1c2140, side: T.BackSide })); sky.position.y = 21; es.add(sky);
    const gnd = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshBasicMaterial({ color: 0x08070b })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -3; es.add(gnd);
    const strip = (c, x, y, z, w, h, d) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); es.add(m); };
    strip(0xff4fa8, 0, 5, -20, 18, 0.35, 0.3); strip(0x40d8ff, 20, 4, 0, 0.3, 0.3, 18); strip(0xffd49a, -18, 9, 6, 0.3, 0.4, 10); strip(0xffffff, 0, 30, 0, 8, 0.2, 2);
    const rt = pm.fromScene(es, 0.03); pm.dispose();
    return rt.texture;
  },
  resize() {
    if (!this.renderer) return;
    const rect = this.stage.getBoundingClientRect(), s = rect.width / 1280 || 1;
    const dpr = window.devicePixelRatio || 1, qk = this.q === 'high' ? 1 : this.q === 'med' ? 0.8 : 0.65;
    const k = HX.clamp(s * dpr * qk, 0.5, this.q === 'high' ? 1.6 : 1.25);
    const W = Math.round(1280 * k), H = Math.round(720 * k);
    if (this.W === W && this.H === H) return;
    this.W = W; this.H = H; this.renderer.setPixelRatio(1); this.renderer.setSize(W, H, false);
    if (this.rtScene) this.sizePost();
    if (this.reflRT) this.reflRT.setSize(Math.round(W / (this.q === 'high' ? 2 : 3)), Math.round(H / (this.q === 'high' ? 2 : 3)));
  },
  setupPost(T) {
    const mk = () => new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, type: this.hdrType, depthBuffer: false, stencilBuffer: false });
    this.rtScene = (this.isGL2 && this.q !== 'low' && T.WebGLMultisampleRenderTarget) ? new T.WebGLMultisampleRenderTarget(4, 4, { type: this.hdrType, stencilBuffer: true }) : new T.WebGLRenderTarget(4, 4, { type: this.hdrType, stencilBuffer: true, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    if (this.rtScene.samples !== undefined) this.rtScene.samples = this.q === 'high' ? 4 : 2;
    for (const k of ['rt2', 'rt2b', 'rt4', 'rt4b', 'rt8', 'rt8b']) this[k] = mk();
    // (stencilBuffer:true above is deliberate: r128 then allocates DEPTH24_STENCIL8 instead of a 16-bit depth buffer that z-fights)
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.mBright = new T.ShaderMaterial({ uniforms: { tIn: { value: null }, uTh: { value: 0.9 }, uTx: { value: new T.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tIn; uniform float uTh; uniform vec2 uTx; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tIn, vUv + o * uTx).rgb; }
        void main(){ vec3 c = (s(vec2(-1.0,-1.0)) + s(vec2(1.0,-1.0)) + s(vec2(-1.0,1.0)) + s(vec2(1.0,1.0))) * 0.25;
          if (!(c.r >= 0.0 || c.r <= 0.0) || !(c.g >= 0.0 || c.g <= 0.0) || !(c.b >= 0.0 || c.b <= 0.0)) c = vec3(0.0); // NaN guard
          float l = max(max(c.r, c.g), c.b); float k = smoothstep(uTh, uTh * 2.2, l); gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0); }` });
    this.mBlur = new T.ShaderMaterial({ uniforms: { tIn: { value: null }, uDir: { value: new T.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tIn, vUv).rgb * 0.2270270270;
          c += (texture2D(tIn, vUv + uDir * 1.3846153846).rgb + texture2D(tIn, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
          c += (texture2D(tIn, vUv + uDir * 3.2307692308).rgb + texture2D(tIn, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
          gl_FragColor = vec4(c, 1.0); }` });
    this.mCopy = new T.ShaderMaterial({ uniforms: { tIn: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false, fragmentShader: 'uniform sampler2D tIn; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tIn, vUv).rgb, 1.0); }' });
    this.mFinal = new T.ShaderMaterial({
      uniforms: { tScene: { value: null }, tB2: { value: null }, tB4: { value: null }, tB8: { value: null }, uBloom: { value: 0.9 }, uExp: { value: 1.0 }, uVig: { value: 0.55 }, uFlash: { value: new T.Vector4(0, 0, 0, 0) }, uCA: { value: 0 }, uTime: { value: 0 }, uGrade: { value: 0 }, uDesat: { value: 0 }, uTint: { value: new T.Vector3(1, 1, 1) } },
      vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tScene, tB2, tB4, tB8; uniform float uBloom, uExp, uVig, uCA, uTime, uGrade, uDesat; uniform vec3 uTint; uniform vec4 uFlash; varying vec2 vUv;
        vec3 aces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec2 d = (vUv - 0.5);
          vec3 col;
          if (uCA > 0.0001) { col.r = texture2D(tScene, vUv - d * uCA).r; col.g = texture2D(tScene, vUv).g; col.b = texture2D(tScene, vUv + d * uCA).b; }
          else col = texture2D(tScene, vUv).rgb;
          if (!(col.r >= 0.0 || col.r <= 0.0) || !(col.g >= 0.0 || col.g <= 0.0) || !(col.b >= 0.0 || col.b <= 0.0)) col = vec3(0.0); // NaN guard
          col = min(col, vec3(64.0));
          vec3 bl = texture2D(tB2, vUv).rgb * 0.55 + texture2D(tB4, vUv).rgb * 0.85 + texture2D(tB8, vUv).rgb * 1.15;
          col += bl * uBloom;
          col *= uExp;
          col = aces(col);
          // night grade: lift shadows toward violet, warm highlights
          col = mix(col, col * vec3(1.03, 0.97, 1.08) + vec3(0.012, 0.0, 0.025), uGrade);
          float v = smoothstep(0.35, 0.95, length(d * vec2(1.25, 1.0)));
          col *= 1.0 - v * (uVig + uDesat * 0.35);
          col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))) * uTint, uDesat); // crew switch / slow-motion grade
          col = mix(col, uFlash.rgb, uFlash.a);
          col = toSRGB(clamp(col, 0.0, 1.0));
          col += (fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;
          gl_FragColor = vec4(col, 1.0);
        }` });
    this.quadScene = new this.T.Scene(); this.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.mCopy); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    this.sizePost();
  },
  sizePost() {
    const W = this.W, H = this.H;
    this.rtScene.setSize(W, H);
    this.rt2.setSize(W >> 1, H >> 1); this.rt2b.setSize(W >> 1, H >> 1);
    this.rt4.setSize(W >> 2, H >> 2); this.rt4b.setSize(W >> 2, H >> 2);
    this.rt8.setSize(W >> 3, H >> 3); this.rt8b.setSize(W >> 3, H >> 3);
  },
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.quadScene, this.quadCam); },
  blur(rt, tmp, scale) {
    const m = this.mBlur;
    m.uniforms.tIn.value = rt.texture; m.uniforms.uDir.value.set(scale / rt.width, 0); this.pass(m, tmp);
    m.uniforms.tIn.value = tmp.texture; m.uniforms.uDir.value.set(0, scale / rt.height); this.pass(m, rt);
  },
  setupReflection(T) {
    this.reflRT = new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, type: this.hdrType, stencilBuffer: true }); // 24-bit depth
    this.reflCam = new T.PerspectiveCamera();
    this.reflMat = new T.Matrix4(); this.reflK = { value: 0.9 };
    this._rv = { n: new T.Vector3(0, 1, 0), mp: new T.Vector3(), cp: new T.Vector3(), rot: new T.Matrix4(), look: new T.Vector3(0, 0, -1), view: new T.Vector3(), tgt: new T.Vector3(), plane: new T.Plane(), clip: new T.Vector4(), q: new T.Vector4() };
    this.reflRT.setSize(Math.round(this.W / 2), Math.round(this.H / 2));
  },
  patchReflective(mat) {
    if (!this.reflect || mat.userData.patched) return; mat.userData.patched = true;
    const self = this;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tRefl = { value: self.reflRT.texture }; sh.uniforms.uReflMat = { value: self.reflMat }; sh.uniforms.uReflK = self.reflK; sh.uniforms.tWet = { value: HWorld.tex.puddle };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uReflMat; varying vec4 vReflUv; varying vec3 vWPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wpR = modelMatrix * vec4(transformed, 1.0); vWPos = wpR.xyz; vReflUv = uReflMat * wpR;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRefl; uniform sampler2D tWet; uniform float uReflK; varying vec4 vReflUv; varying vec3 vWPos;')
        // a low sun straight ahead would blow the wet asphalt out into a white blob: keep its glint soft
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular = min(reflectedLight.directSpecular * 0.35, vec3(0.8));')
        .replace('#include <tonemapping_fragment>', `{
            float wet = texture2D(tWet, vWPos.xz * 0.043).r;
            vec2 dd = (texture2D(tWet, vWPos.xz * 0.37).rg - 0.5) * 0.006;
            vec4 ruv = vReflUv; ruv.xy += dd * ruv.w;
            // wet asphalt stretches lights into vertical streaks: 6 jittered taps (jitter hides the banding)
            float jt = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); // interleaved gradient noise
            vec3 rc = vec3(0.0); float wsum = 0.0;
            for (int i = 0; i < 6; i++) { float fi = (float(i) + jt) / 6.0; float w = 1.0 - fi * 0.8; rc += texture2DProj(tRefl, ruv + vec4(0.0, fi * fi * 0.045, 0.0, 0.0) * ruv.w).rgb * w; wsum += w; }
            rc = min(rc / wsum, vec3(1.4));
            vec3 vd = normalize(cameraPosition - vWPos);
            float fr = 0.3 + 0.7 * pow(1.0 - clamp(vd.y, 0.0, 1.0), 2.5);
            gl_FragColor.rgb += rc * uReflK * fr * (0.3 + 0.7 * smoothstep(0.35, 0.75, wet));
          }
          #include <tonemapping_fragment>`);
    };
    mat.needsUpdate = true;
  },
  updateReflection() {
    const v = this._rv, cam = this.camera, rc = this.reflCam;
    v.mp.set(0, 0.02, 0); v.cp.setFromMatrixPosition(cam.matrixWorld);
    v.view.subVectors(v.mp, v.cp); if (v.view.dot(v.n) > 0) return false;
    v.view.reflect(v.n).negate(); v.view.add(v.mp);
    v.rot.extractRotation(cam.matrixWorld);
    v.look.set(0, 0, -1).applyMatrix4(v.rot).add(v.cp);
    v.tgt.subVectors(v.mp, v.look); v.tgt.reflect(v.n).negate(); v.tgt.add(v.mp);
    rc.position.copy(v.view); rc.up.set(0, 1, 0).applyMatrix4(v.rot).reflect(v.n); rc.lookAt(v.tgt);
    rc.far = cam.far; rc.updateMatrixWorld(); rc.projectionMatrix.copy(cam.projectionMatrix);
    this.reflMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.reflMat.multiply(rc.projectionMatrix); this.reflMat.multiply(rc.matrixWorldInverse);
    v.plane.setFromNormalAndCoplanarPoint(v.n, v.mp); v.plane.applyMatrix4(rc.matrixWorldInverse);
    v.clip.set(v.plane.normal.x, v.plane.normal.y, v.plane.normal.z, v.plane.constant);
    const P = rc.projectionMatrix.elements;
    v.q.x = (Math.sign(v.clip.x) + P[8]) / P[0]; v.q.y = (Math.sign(v.clip.y) + P[9]) / P[5]; v.q.z = -1.0; v.q.w = (1.0 + P[10]) / P[14];
    v.clip.multiplyScalar(2.0 / v.clip.dot(v.q));
    P[2] = v.clip.x; P[6] = v.clip.y; P[10] = v.clip.z + 1.0 - 0.003; P[14] = v.clip.w;
    return true;
  },

  /* ================= world / actors ================= */
  buildWorld() {
    const T = this.T, scene = this.scene;
    if (window.HModels && HModels.init) { try { HModels.init(T, { envMap: this.env }); } catch (e) { console.error(e); } }
    if (window.HAudio && HAudio.init) { try { HAudio.init(); } catch (e) { console.error(e); } }
    HWorld.build(T, scene, { quality: this.q, maxAniso: this.renderer.capabilities.getMaxAnisotropy(), envMap: this.env });
    for (const m of [HWorld.mats.road, HWorld.mats.cross]) if (m) this.patchReflective(m); // roads are wet; sidewalks stay matte
    HFX3.init(T, scene);
    HExtras.init(T, scene, this.q);
    this.linearize(scene);
    HWorld.blobTex = HWorld.blobTex || (() => { const [c, x] = HWorld.canvas(64, 64), g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
    this.blobMat = new T.MeshBasicMaterial({ map: HWorld.blobTex, transparent: true, depthWrite: false });
    // markers (mission goal beam + ground ring)
    const beam = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 60, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false }));
    beam.position.y = 30; const ring = new T.Mesh(new T.RingGeometry(1.6, 2.1, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2;
    const chev = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 4), new T.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false })); chev.rotation.x = Math.PI; chev.position.y = 4;
    this.marker = new T.Group(); this.marker.add(beam, ring, chev); this.marker.visible = false; scene.add(this.marker); this.markerParts = { beam, ring, chev };
    beam.layers.enable(1); ring.layers.enable(1);
    // the billboard screen playing the couch video (chapter 1) on a downtown tower
    this.makeBillboard();
  },
  makeBillboard() {
    const T = this.T, v = this.billVideo = document.createElement('video');
    v.src = 'assets/intro.mp4'; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    const tex = new T.VideoTexture(v); tex.encoding = T.sRGBEncoding;
    const scr = new T.Mesh(new T.PlaneGeometry(26, 14.6), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // on the corner tower facing the main avenue (z = 0) a few blocks east of the hotel
    scr.position.set(-36, 22, -8.2); scr.rotation.y = 0; this.scene.add(scr); scr.layers.enable(1);
    const frame = new T.Mesh(new T.BoxGeometry(27.6, 16.2, 0.6), new T.MeshStandardMaterial({ color: 0x111118, metalness: 0.6, roughness: 0.4 })); frame.position.set(-36, 22, -8.6); this.scene.add(frame);
    HWorld.addGlows([[-36, 22, -6, '#ff7ad9']], 30, 0.18);
    this.billboard = scr;
  },
  // three r128 treats hex material colours as linear; ours are designed in sRGB -> convert once per material
  linearize(root) {
    root.traverse(o => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (!m || m.userData.lin || m.isShaderMaterial) continue; m.userData.lin = true;
        if (m.color && !(m.map && m.color.r === 1 && m.color.g === 1 && m.color.b === 1)) m.color.convertSRGBToLinear();
        if (m.emissive) m.emissive.convertSRGBToLinear();
      }
    });
    return root;
  },
  markLinear(root) { root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m) m.userData.lin = true; }); return root; },
  addBlob(group, w, l) { const T = this.T, m = new T.Mesh(new T.PlaneGeometry(w, l), this.blobMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = -1; group.add(m); return m; },
  makeCar(kind, x, z, h, opts) {
    const v = HVehicle.make(kind, x, z, h, opts);
    if (!v.rig.fromModels) this.addBlob(v.rig.group, (v.rig.dims.width || 1.9) * 1.35, (v.rig.dims.length || 4.5) * 1.15); // HModels rigs carry their own contact shadow
    return v;
  },
  makePerson(kind, opts) {
    const T = this.T; let rig = null;
    if (window.HModels && HModels.person) { try { rig = HModels.person(kind, opts || {}); if (rig) rig.fromModels = true; } catch (e) { console.error(e); } }
    if (!rig) { // fallback mannequin
      const g = new T.Group(), suit = new T.MeshStandardMaterial({ color: kind === 'hero' ? 0x16161c : kind === 'hacker' ? 0x1d2640 : 0x3a6ea5, roughness: 0.7 });
      const body = new T.Mesh(new T.BoxGeometry(0.5, 0.8, 0.28), suit); body.position.y = 1.15; g.add(body);
      const head = new T.Mesh(new T.SphereGeometry(0.15, 12, 10), new T.MeshStandardMaterial({ color: 0xd9a071 })); head.position.y = 1.72; g.add(head);
      const legs = []; for (const s of [-1, 1]) { const l = new T.Mesh(new T.BoxGeometry(0.18, 0.78, 0.2), suit); l.geometry.translate(0, -0.39, 0); l.position.set(s * 0.13, 0.78, 0); g.add(l); legs.push(l); }
      rig = { group: g, height: 1.8, setPose(name, tt, k) { const a = name === 'walk' || name === 'run' ? Math.sin(tt * (name === 'run' ? 11 : 7.5)) * (name === 'run' ? 0.8 : 0.5) * (k === undefined ? 1 : k) : 0; legs[0].rotation.x = a; legs[1].rotation.x = -a; g.visible = name !== 'hidden'; } };
    }
    if (!rig.fromModels) { this.addBlob(rig.group, 0.9, 0.9); this.linearize(rig.group); } // HModels rigs: own shadow, already linear
    this.scene.add(rig.group);
    return rig;
  },
  spawnPlayer(x, z, h) {
    if (!this.player) this.player = { rig: this.makePerson('hero'), hp: 100 };
    const p = this.player; Object.assign(p, { x, z, y: 0, h, vx: 0, vz: 0, vy: 0, anim: 'idle', at: 0, inCar: null, knockT: 0, enterT: 0, hp: p.hp || 100 });
    p.rig.group.visible = true; p.rig.group.position.set(x, 0, z); p.rig.group.rotation.y = h;
    if (!p.rig.group.parent) this.scene.add(p.rig.group);
    this.cam.yaw = h; this.cam.pitch = 0.22;
    return p;
  },
  setPlayerCar(v) { this.car = v; HVehicle.player = v; if (v && this.cars.indexOf(v) < 0) this.cars.push(v); },

  /* ================= input ================= */
  bindInput() {
    const cv = this.canvas, m = this.mouse;
    this._onMove = e => { if (!this.active) return; if (document.pointerLockElement === cv) { m.dx += e.movementX || 0; m.dy += e.movementY || 0; } else if (m.drag) { m.dx += e.clientX - m.lx; m.dy += e.clientY - m.ly; m.lx = e.clientX; m.ly = e.clientY; } };
    this._onDown = e => { if (!this.active || e.pointerType === 'touch') return; m.drag = true; m.lx = e.clientX; m.ly = e.clientY; if (this.state === 'play' && !this.paused && cv.requestPointerLock && !Input.touchMode) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} } };
    this._onUp = () => { m.drag = false; };
    this._onLock = () => { m.locked = document.pointerLockElement === cv; };
    cv.addEventListener('pointerdown', this._onDown); window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    document.addEventListener('pointerlockchange', this._onLock);
    cv.addEventListener('contextmenu', e => e.preventDefault()); // right-drag turns the camera, no browser menu
  },
  key(...codes) { return codes.some(c => Input.keys.has(c)); },
  pressed(...codes) { return codes.some(c => Input.pressed.has(c)); },
  moveInput() {
    let x = 0, y = 0;
    if (this.key('KeyA', 'ArrowLeft')) x -= 1; if (this.key('KeyD', 'ArrowRight')) x += 1;
    if (this.key('KeyW', 'ArrowUp')) y -= 1; if (this.key('KeyS', 'ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l, mag: 1, keys: true }; }
    const st = Input.stickVec('move'); if (st && st.mag > 0) return { x: st.x / st.mag * st.mag, y: st.y / st.mag * st.mag, mag: st.mag };
    return { x: 0, y: 0, mag: 0 };
  },
  actionPressed() { return this.pressed('KeyE', 'KeyF', 'Enter') || Input.pressed.has('touchSpecial'); },

  /* ================= frame ================= */
  frame(real, now) {
    if (!this.active || !this.renderer) { if (this.active && HHud.ready) HHud.tick(real); return; }
    if (this.pressed('Escape', 'KeyP') && !HHud.cutActive() && !(window.HHack && HHack.active)) { if (this.paused) this.resume(); else this.pause(); }
    const dt = this.paused || this.state === 'loading' || HHud.cutActive() ? 0 : Math.min(real, 0.05) * (this.timeScale || 1);
    this.realDt = this.paused ? 0 : Math.min(real, 0.05); // unscaled (UI, slow-motion meters)
    this.time += dt;
    if (dt > 0) this.update(dt);
    if (this.state !== 'loading' && !HHud.cutActive() && !(window.HHack && HHack.active)) this.render(real);
    HHud.tick(real);
    this.mouse.dx = 0; this.mouse.dy = 0;
    // adaptive quality
    this.perf(real);
  },
  perf(real) {
    if (this.paused || this.state !== 'play') return;
    this._pf = this._pf || { t: 0, n: 0, sum: 0 }; const pf = this._pf; pf.t += real; pf.n++; pf.sum += real;
    if (pf.t > 4) {
      const avg = pf.sum / pf.n; pf.t = 0; pf.n = 0; pf.sum = 0;
      if (avg > 0.034 && this.q !== 'low') {
        this.q = this.q === 'high' ? 'med' : 'low';
        if (this.q === 'low') {
          this.bloom = false; this.reflect = false; this.renderer.toneMapping = this.T.ACESFilmicToneMapping;
          this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.userData && m.userData.patched) { m.onBeforeCompile = () => {}; } m.needsUpdate = true; }); });
          for (const k of ['rtScene', 'rt2', 'rt2b', 'rt4', 'rt4b', 'rt8', 'rt8b', 'reflRT']) if (this[k]) { this[k].dispose(); this[k] = null; } // free the post targets on a struggling device
        }
        this.W = 0; this.resize();
      }
    }
  },
  pause() { if (!this.active || this.paused || (this.state !== 'play' && this.state !== 'vault' && this.state !== 'interior') || HHud.cutActive() || (window.HHack && HHack.active) || document.getElementById('hresults')) return; this.paused = true; if (document.pointerLockElement) document.exitPointerLock(); if (window.HAudio) HAudio.duck(true); if (this.opts.onPause) this.opts.onPause(true); },
  resume() { if (!this.paused) return; this.paused = false; if (window.HAudio) HAudio.duck(false); if (this.opts.onPause) this.opts.onPause(false); },

  update(dt) {
    const p = this.player;
    // time of day easing (mission drives the target; free roam cycles)
    if (this.todTarget !== null && Math.abs(this.tod - this.todTarget) > 0.001) { this.tod = HX.damp(this.tod, this.todTarget, this.todRate || 0.6, dt); this.applyTod(); }
    for (const m of this.mods || []) if (m.preUpdate) m.preUpdate(dt);
    if (this.state === 'interior' && this.interior && this.interior.update) this.interior.update(dt);
    if (this.state === 'play' || this.state === 'vault') {
      if (this.state === 'vault') { HMission.vaultUpdate(dt); }
      else {
        if (p.inCar) this.driveCar(dt); else this.walk(dt);
        this.events.length = 0;
        if (this.car && this.car !== p.inCar) { HVehicle.step(this.car, dt, this.events); HVehicle.sync(this.car, dt); this.car.inp.throttle = 0; this.car.inp.handbrake = !this.car.wrecked; }
        // cars the player left behind are real cars: they roll, get pushed and collide
        for (const pv of this.parked || []) if (pv !== p.inCar && pv !== this.car && pv.rig.group.parent) { pv.inp.throttle = 0; pv.inp.handbrake = true; HVehicle.step(pv, dt, this.events); HVehicle.sync(pv, dt); }
        const pc = p.inCar;
        const ctx = this.aiCtx || (this.aiCtx = { cam: {} });
        ctx.px = pc ? pc.x : p.x; ctx.pz = pc ? pc.z : p.z; ctx.inCar = !!pc; ctx.pcar = pc || this.car; ctx.extra = this.parked;
        // the AI sees how fast the player really moves (on foot, pushing against a wall is not running)
        if (pc) { ctx.pvx = pc.vx; ctx.pvz = pc.vz; ctx._fx = undefined; }
        else { const lx = ctx._fx === undefined ? p.x : ctx._fx, lz = ctx._fz === undefined ? p.z : ctx._fz; ctx.pvx = HX.clamp((p.x - lx) / dt, -12, 12); ctx.pvz = HX.clamp((p.z - lz) / dt, -12, 12); ctx._fx = p.x; ctx._fz = p.z; }
        ctx.cam.x = this.cam.x; ctx.cam.z = this.cam.z; ctx.cam.fx = Math.sin(this.cam.yaw); ctx.cam.fz = Math.cos(this.cam.yaw); ctx.lights = this.tod < 1.4; ctx.safe = HMission.safeZone(ctx.px, ctx.pz);
        HAI.update(dt, ctx, this.events);
        if (pc) { HVehicle.step(pc, dt, this.events); this.playerCarVsAll(pc); HVehicle.sync(pc, dt); }
        this.handleEvents();
        this.updatePeds(dt);
        HMission.update(dt);
      }
    }
    for (const m of this.mods || []) if (m.update) m.update(dt);
    if (this.aiCtx && this.state !== 'interior') HExtras.update(dt, this.aiCtx);
    HWorld.update(dt);
    this.updateCamera(dt);
    HFX3.update(dt, this.camera, this.H / (2 * Math.tan(this.camera.fov * Math.PI / 360)));
    this.updateLights(dt);
    this.updateAudio(dt);
    this.updateHud(dt);
  },

  /* ---------- on foot ---------- */
  walk(dt) {
    const p = this.player, cam = this.cam;
    if (p.knockT > 0) { p.knockT -= dt; p.rig.setPose('fall', this.time, HX.clamp(1 - p.knockT / 1.4, 0, 1)); p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt; const rk = HX.resolveCircle(p.x, p.z, 0.38); p.x = rk.x; p.z = rk.z; this.syncPlayer(); return; }
    const mv = this.moveInput();
    const run = mv.mag > 0.05 && (this.key('ShiftLeft', 'ShiftRight') || mv.mag > 0.92 && !mv.keys);
    const sp = (run ? 7.6 : 4.2) * Math.min(1, mv.mag * 1.15);
    // camera-relative: up on the stick = away from the camera
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const dx = fx * -mv.y + rx * mv.x, dz = fz * -mv.y + rz * mv.x;
    const tvx = dx * sp, tvz = dz * sp;
    p.vx = HX.damp(p.vx, tvx, 12, dt); p.vz = HX.damp(p.vz, tvz, 12, dt);
    p.x += p.vx * dt; p.z += p.vz * dt;
    // jump
    if (this.pressed('Space') && p.y <= 0.001) p.vy = 5.2;
    if (p.y > 0 || p.vy > 0) { p.vy -= 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) p.vy = 0; }
    // collisions: world + cars
    const r = HX.resolveCircle(p.x, p.z, 0.38); p.x = r.x; p.z = r.z;
    for (const v of this.allCars()) {
      for (const [cx, cz] of HVehicle.circles(v)) {
        const ddx = p.x - cx, ddz = p.z - cz, rr = v.radius + 0.35, d = Math.hypot(ddx, ddz);
        if (d < rr && d > 1e-4) {
          const sp2 = HVehicle.speed(v);
          if (sp2 > 6.5 && p.knockT <= 0 && p.y < 0.4) { this.knockPlayer(v.vx, v.vz, sp2); }
          p.x += ddx / d * (rr - d); p.z += ddz / d * (rr - d);
        }
      }
    }
    { const r2 = HX.resolveCircle(p.x, p.z, 0.38); p.x = r2.x; p.z = r2.z; } // a car push must not shove the player into a wall
    const spd = Math.hypot(p.vx, p.vz);
    if (spd > 0.4) p.h = HX.lerp(p.h, p.h + HX.wrapAngle(Math.atan2(p.vx, p.vz) - p.h), Math.min(1, dt * 12));
    p.anim = spd > 5.5 ? 'run' : spd > 0.4 ? 'walk' : 'idle';
    p.at += dt * (spd > 0.4 ? spd / (p.anim === 'run' ? 7.6 : 4.2) : 1);
    p.rig.setPose(p.anim, p.at, p.anim === 'idle' ? 1 : HX.clamp(spd / (p.anim === 'run' ? 7.6 : 4.2), 0.3, 1));
    if (window.HAudio && spd > 0.5) { p.stepT = (p.stepT || 0) - dt * spd * 0.42; if (p.stepT < 0) { p.stepT = 1; HAudio.step({ surface: this.tod < 0.7 ? 'wet' : 'concrete', vol: p.anim === 'run' ? 1.1 : 0.8 }); } }
    this.syncPlayer();
    // get into a car
    const near = this.nearestCar(3.6);
    if (near && p.enterT <= 0) HHud.prompt(Input.touchMode ? '🚗' : 'E', near.ai && near.ai.type === 'police' ? t('h_stealCop') : near === this.car ? t('h_enter') : t('h_steal'));
    else if (!HMission.promptBusy) HHud.prompt();
    if (near && this.actionPressed()) this.enterCar(near);
  },
  knockPlayer(vx, vz, sp) {
    const p = this.player; p.knockT = 1.4; const L = Math.hypot(vx, vz) || 1; p.vx = vx / L * Math.min(9, sp * 0.6); p.vz = vz / L * Math.min(9, sp * 0.6);
    p.hp = Math.max(5, p.hp - Math.min(30, sp * 1.5)); this.cam.shake = 0.6; if (window.HAudio) HAudio.sfx('crash', { intensity: 0.4 });
  },
  syncPlayer() { const p = this.player, g = p.rig.group; g.position.set(p.x, p.y + HX.groundY(p.x, p.z), p.z); g.rotation.y = p.h; },
  allCars() { const a = HAI.traffic.concat(HAI.police); for (const v of this.parked || []) if (v.rig.group.parent && a.indexOf(v) < 0) a.push(v); if (this.car && a.indexOf(this.car) < 0) a.push(this.car); return a; },
  nearestCar(r) {
    const p = this.player; let best = null, bd = r;
    for (const v of this.allCars()) { if (v.wrecked && v.burnT > 2.5) continue; const d = Math.hypot(v.x - p.x, v.z - p.z) - 1.2; if (d < bd && HVehicle.speed(v) < 9) { bd = d; best = v; } }
    return best;
  },
  enterCar(v) {
    const p = this.player; this.parked = (this.parked || []).filter(o => o !== v);
    if (v.ai) {
      const wasCop = v.ai.type === 'police';
      const ti = HAI.traffic.indexOf(v); if (ti >= 0) HAI.traffic.splice(ti, 1);
      const pi = HAI.police.indexOf(v); if (pi >= 0) HAI.police.splice(pi, 1);
      if (!wasCop) this.ejectDriver(v);
      if (HMission.mode === 'free' || HMission.allowCrime) { if (wasCop) HAI.setWanted(Math.max(HAI.wanted, 2), 'copcar'); else if (HAI.witness(v.x, v.z, 60)) HAI.crime(1); }
      v.ai = null; v.sirenOn = false;
      if (!v.rig.fromModels && !this.blobOf(v)) this.addBlob(v.rig.group, (v.rig.dims.width || 1.9) * 1.35, (v.rig.dims.length || 4.5) * 1.15);
    }
    if (this.car && this.car !== v && this.cars.indexOf(this.car) >= 0) { /* the old car stays parked in the world */ HAI.traffic.length < 30 && this.parkOld(this.car); }
    this.setPlayerCar(v);
    p.inCar = v; p.rig.setPose('hidden', 0, 0); p.rig.group.visible = false; HHud.prompt();
    v.vx *= 0.2; v.vz *= 0.2; v.inp.handbrake = false;
    if (v.rig.setLights) v.rig.setLights(this.tod < 1.4 || true);
    if (window.HAudio) { HAudio.sfx('door'); HAudio.sfx('engineStart'); }
    this.cam.yaw = v.h; HMission.onEnterCar(v);
  },
  blobOf(v) { return v.rig.group.children.some(c => c.material === this.blobMat); },
  parkOld(v) { v.inp.throttle = 0; v.inp.steer = 0; v.inp.handbrake = true; v.parked = true; this.parked = (this.parked || []).filter(o => o !== v); this.parked.push(v); while (this.parked.length > 3) { const o = this.parked.shift(); if (o !== this.car) HVehicle.remove(o); } },
  exitCar() {
    const p = this.player, v = p.inCar; if (!v) return;
    const tryDoor = (side) => { const dx = (v.rig.door ? v.rig.door.x : 1.4) * side, dz = v.rig.door ? v.rig.door.z : 0.3; const x = v.x + dx * Math.cos(v.h) + dz * Math.sin(v.h), z = v.z - dx * Math.sin(v.h) + dz * Math.cos(v.h); const r = HX.resolveCircle(x, z, 0.4); return Math.hypot(r.x - x, r.z - z) < 0.05 ? r : null; };
    const spot = tryDoor(1) || tryDoor(-1) || { x: v.x + Math.cos(v.h) * 2.2, z: v.z - Math.sin(v.h) * 2.2 };
    p.inCar = null; p.x = spot.x; p.z = spot.z; p.y = 0; p.vx = v.vx * 0.3; p.vz = v.vz * 0.3; p.h = v.h + Math.PI / 2; p.rig.group.visible = true;
    v.inp.throttle = 0; v.inp.steer = 0; v.inp.handbrake = true;
    if (window.HAudio) { HAudio.sfx('door'); HAudio.engine({ on: false }); }
    this.cam.yaw = v.h; this.syncPlayer(); HMission.onExitCar(v);
  },
  ejectDriver(v) {
    const rig = this.makePerson('civ', { seed: Math.floor(Math.random() * 32) }); // a bounded outfit pool keeps the model cache small
    const x = v.x + 1.6 * Math.cos(v.h), z = v.z - 1.6 * Math.sin(v.h);
    rig.group.position.set(x, HX.groundY(x, z), z);
    const a = Math.random() * 6.283; this.peds.push({ rig, x, z, vx: Math.cos(a) * 6, vz: Math.sin(a) * 6, t: 0, life: 4 });
  },
  updatePeds(dt) {
    for (let k = this.peds.length - 1; k >= 0; k--) {
      const q = this.peds[k]; q.t += dt;
      if (q.t > q.life) { this.scene.remove(q.rig.group); if (q.rig.mesh && q.rig.mesh.skeleton) q.rig.mesh.skeleton.dispose(); this.peds.splice(k, 1); continue; }
      q.x += q.vx * dt; q.z += q.vz * dt; const r = HX.resolveCircle(q.x, q.z, 0.35); q.x = r.x; q.z = r.z;
      q.rig.group.position.set(q.x, HX.groundY(q.x, q.z), q.z); q.rig.group.rotation.y = Math.atan2(q.vx, q.vz); q.rig.setPose('run', q.t * 1.5, 1);
      if (q.t > q.life - 0.5) q.rig.group.scale.setScalar(Math.max(0.01, (q.life - q.t) * 2));
    }
  },

  /* ---------- driving ---------- */
  driveCar(dt) {
    const v = this.player.inCar, inp = v.inp;
    const mv = this.moveInput();
    let thr = 0, steer = 0;
    if (mv.keys || mv.mag === 0) { thr = this.key('KeyW', 'ArrowUp') ? 1 : 0; if (this.key('KeyS', 'ArrowDown')) thr = -1; steer = (this.key('KeyD', 'ArrowRight') ? 1 : 0) - (this.key('KeyA', 'ArrowLeft') ? 1 : 0); }
    else {
      const dz = 0.12; thr = Math.abs(mv.y) > dz ? -mv.y : 0; steer = Math.abs(mv.x) > dz ? mv.x : 0; thr = HX.clamp(thr * 1.4, -1, 1);
      // mostly sideways on the stick keeps cruising while steering, but only at or above horizontal:
      // pulling slightly down coasts, further down brakes (the assist fades out across the dead zone)
      if (mv.mag > 0.3 && mv.y > -0.35 && mv.y < dz) thr = Math.max(thr, 0.75 * (1 - Math.max(0, mv.y) / dz));
    }
    // keyboard steering is digital: ease it so the car doesn't twitch at speed
    const sk = Math.abs(steer) > Math.abs(v._steerIn || 0) ? 6 : 10;
    v._steerIn = HX.damp(v._steerIn || 0, steer, sk, dt);
    inp.steer = v._steerIn; inp.throttle = thr; inp.handbrake = this.key('Space') || Input.keys.has('Space');
    if (this.pressed('KeyH') && window.HAudio) HAudio.sfx('horn');
    if (v.wrecked) { v.burnT += dt; if (v.burnT > 4 && !v.exploded) this.explodeCar(v); }
    if (this.actionPressed() && Math.abs(v.vF) < 7) this.exitCar();
    HHud.prompt();
  },
  explodeCar(v) {
    v.exploded = true; HFX3.glowBurst(v.x, 1, v.z, 1, 0.55, 0.15, 60, 9); for (let k = 0; k < 14; k++) HFX3.darkSmoke(v.x + (Math.random() - 0.5) * 3, 1.5, v.z + (Math.random() - 0.5) * 3);
    this.cam.shake = 1.2; if (window.HAudio) HAudio.sfx('crash', { intensity: 1 });
    if (this.player.inCar === v) { this.exitCar(); this.knockPlayer(Math.random() - 0.5, Math.random() - 0.5, 8); HMission.onWasted(); }
  },
  playerCarVsAll(pc) {
    for (const v of HAI.traffic.concat(HAI.police, this.parked || [])) {
      if (v === pc || !v.rig.group.parent || Math.abs(v.x - pc.x) > 8 || Math.abs(v.z - pc.z) > 8) continue;
      if (HVehicle.collidePair(pc, v, this.events) && v.ai) {
        if (v.ai.type === 'traffic') v.ai.stopT = 2.5;
      }
    }
    if (this.car && this.car !== pc && Math.abs(this.car.x - pc.x) < 8 && Math.abs(this.car.z - pc.z) < 8) HVehicle.collidePair(pc, this.car, this.events);
  },
  handleEvents() {
    const pc = this.player.inCar;
    for (const e of this.events) {
      const mine = pc && (e.v === pc || e.a === pc || e.b === pc);
      if (e.type === 'crash' || e.type === 'carhit') {
        const near = Math.hypot(e.x - this.cam.x, e.z - this.cam.z) < 60;
        if (near) { HFX3.sparkBurst(e.x, 0.6, e.z, e.nx || 0, e.nz || 0, Math.min(24, 4 + e.impact * 1.5)); if (window.HAudio) HAudio.sfx('crash', { intensity: HX.clamp(e.impact / 22, 0.15, 1) }); }
        if (mine) {
          this.cam.shake = Math.min(1.2, this.cam.shake + e.impact * 0.05);
          if (e.type === 'carhit') {
            const other = e.a === pc ? e.b : e.a;
            if (other && other.ai && (HMission.mode === 'free' || HMission.allowCrime)) {
              if (other.ai.type === 'police' && e.impact > 5) HAI.crime(1);
              else if (e.impact > 9 && HAI.witness(other.x, other.z, 50)) HAI.crime(1);
            }
            if (other && other.ai && other.ai.type === 'police') HAI.lastSeen = HAI.t;
          }
        }
      } else if (e.type === 'knock' && mine) { if (window.HAudio) HAudio.sfx('crash', { intensity: 0.35 }); this.cam.shake = Math.min(0.8, this.cam.shake + 0.25); }
    }
  },

  /* ---------- camera ---------- */
  updateCamera(dt) {
    const cam = this.cam, c = this.camera, p = this.player, m = this.mouse;
    // a module can own the camera: an interior scene, the crew-switch sky cam, a scripted shot
    if (this.state === 'interior' && this.interior && this.interior.camera) { this.interior.camera(dt, c, this.mouse); return; }
    const o = this.camOverride;
    if (o) {
      if (typeof o === 'function') { o(dt, c); return; }
      c.position.set(o.x, o.y, o.z); c.fov = o.fov || 60; c.updateProjectionMatrix(); c.lookAt(o.lx, o.ly, o.lz);
      cam.x = o.x; cam.y = o.y; cam.z = o.z; return;
    }
    if (!p) return;
    const look = Input.stickVec('aim', 10);
    const sens = 0.0026;
    let manual = false;
    if (m.dx || m.dy) { cam.yaw -= m.dx * sens; cam.pitch = HX.clamp(cam.pitch + m.dy * sens * 0.8, -0.35, 1.1); manual = true; }
    if (look && look.mag > 0) { cam.yaw -= look.x * 2.6 * dt; cam.pitch = HX.clamp(cam.pitch + look.y * 1.4 * dt, -0.35, 1.1); manual = true; }
    if (this.key('KeyQ')) { cam.yaw += 2.2 * dt; manual = true; } if (this.key('KeyR')) { cam.yaw -= 2.2 * dt; manual = true; }
    cam.manualT = manual ? 1.6 : Math.max(0, cam.manualT - dt);
    let tx, ty, tz, dist, fovT = 60;
    const v = p.inCar;
    if (this.state === 'vault' && HMission.vault) { const V = HMission.vault; tx = V.px; ty = 1.5; tz = V.pz; dist = 3.6; }
    else if (v) {
      const spd = Math.abs(v.vF);
      // chase camera: swings behind the car unless the player is looking around
      if (cam.manualT <= 0) { const behind = v.vF < -3 ? v.h + Math.PI : v.h; cam.yaw = cam.yaw + HX.wrapAngle(behind - cam.yaw) * (1 - Math.exp(-(2.2 + spd * 0.05) * dt)); cam.pitch = HX.damp(cam.pitch, 0.2, 2, dt); }
      tx = v.x + Math.sin(v.h) * 1.5; ty = 1.25; tz = v.z + Math.cos(v.h) * 1.5;
      dist = 7.2 + spd * 0.045; fovT = 62 + Math.min(18, spd * 0.32);
    } else {
      tx = p.x; ty = 1.55 + p.y; tz = p.z; dist = 4.4;
      // gentle follow when walking without touching the camera (on touch: always keep it behind)
      const spd = Math.hypot(p.vx, p.vz);
      if (cam.manualT <= 0 && spd > 1 && (Input.touchMode || spd > 5)) cam.yaw = cam.yaw + HX.wrapAngle(p.h - cam.yaw) * (1 - Math.exp(-1.1 * dt));
    }
    cam.fov = HX.damp(cam.fov, fovT, 3, dt);
    // orbit position
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let cx = tx - Math.sin(cam.yaw) * cp * dist, cz = tz - Math.cos(cam.yaw) * cp * dist, cy = ty + sp * dist + (v ? 0.9 : 0.25);
    // keep the camera out of buildings
    if (this.state !== 'vault') {
      const hit = HX.raycast(tx, tz, cx, cz, cy - 0.5);
      if (hit < 1) { const k = Math.max(0.15, hit - 0.08); cx = tx + (cx - tx) * k; cz = tz + (cz - tz) * k; cy = HX.lerp(ty + 0.4, cy, k); }
      cy = Math.max(0.4, cy);
    } else if (HMission.vault) { const V = HMission.vault.bounds; cx = HX.clamp(cx, V.x0 + 0.4, V.x1 - 0.4); cz = HX.clamp(cz, V.z0 + 0.4, V.z1 - 0.4); cy = Math.min(cy, 3.6); }
    // smoothing
    const k = v ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-20 * dt);
    cam.x = HX.lerp(cam.x, cx, k); cam.y = HX.lerp(cam.y, cy, k); cam.z = HX.lerp(cam.z, cz, k);
    if (Math.hypot(cam.x - cx, cam.z - cz) > 25) { cam.x = cx; cam.y = cy; cam.z = cz; }
    cam.shake = Math.max(0, cam.shake - dt * 1.8);
    const sh = cam.shake * cam.shake * 0.35 + (v ? Math.min(0.04, Math.abs(v.vF) * 0.0007) : 0);
    c.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z + (Math.random() - 0.5) * sh);
    c.fov = cam.fov; c.updateProjectionMatrix();
    c.lookAt(tx, ty + (v ? 0.55 : 0.1), tz);
    HHud.setArrow(v ? -(HX.wrapAngle(v.h - cam.yaw)) : -(HX.wrapAngle(p.h - cam.yaw)));
  },

  /* ---------- lights / tod ---------- */
  applyTod() { HWorld.setTimeOfDay(this.tod, this.lights); if (this.reflK) this.reflK.value = HX.clamp(0.55 - this.tod * 0.22, 0.1, 0.55); const lightsOn = this.tod < 1.45; if (this._lightsOn !== lightsOn) { this._lightsOn = lightsOn; HAI.setLights(lightsOn); if (this.car && this.car.rig.setLights) this.car.rig.setLights(lightsOn); } },
  updateLights(dt) {
    const s = this.lights.sun, f = this.player && this.player.inCar ? this.player.inCar : null, p = this.player;
    const cx = f ? f.x : p ? p.x : 0, cz = f ? f.z : p ? p.z : 0;
    if (this.lights.sunDir) { s.position.set(cx + this.lights.sunDir.x * 200, this.lights.sunDir.y * 200 + 30, cz + this.lights.sunDir.z * 200); s.target.position.set(cx, 0, cz); }
    // headlight spot on the player car at night
    if (f && this.tod < 1.5) { const fx = Math.sin(f.h), fz = Math.cos(f.h); this.head.intensity = 2.2 * (1.5 - this.tod) / 1.5; this.head.position.set(f.x + fx * 2.4, 0.9, f.z + fz * 2.4); this.head.target.position.set(f.x + fx * 22, 0, f.z + fz * 22); }
    else this.head.intensity = 0;
    // flashing light on the closest police car
    let best = null, bd = 70; for (const v of HAI.police) { if (!v.sirenOn) continue; const d = Math.hypot(v.x - cx, v.z - cz); if (d < bd) { bd = d; best = v; } }
    if (best) { const ph = Math.floor(this.time * 8) % 2; this.copLight.color.set(ph ? 0xff2040 : 0x2050ff); this.copLight.intensity = 3.2; this.copLight.position.set(best.x, 2.4, best.z); } else this.copLight.intensity = 0;
    // billboard video only plays when nearby
    if (this.billVideo) { const d = Math.hypot(cx + 36, cz + 8); if (d < 220 && this.billVideo.paused && !this.paused) { const pr = this.billVideo.play(); if (pr && pr.catch) pr.catch(() => {}); } else if ((d >= 240 || this.paused) && !this.billVideo.paused) this.billVideo.pause(); }
    // marker animation
    if (this.marker.visible) { const k = this.time; this.markerParts.chev.position.y = 3.6 + Math.sin(k * 3) * 0.4; this.markerParts.chev.rotation.y = k * 2; this.markerParts.ring.scale.setScalar(1 + Math.sin(k * 4) * 0.06); }
  },
  setMarker(x, z, col) { if (x === null || x === undefined) { this.marker.visible = false; return; } this.marker.visible = true; this.marker.position.set(x, 0, z); const c = col || 0xffd23f; for (const m of Object.values(this.markerParts)) m.material.color.set(c); },

  /* ---------- audio ---------- */
  updateAudio(dt) {
    if (!window.HAudio) return;
    const v = this.player && this.player.inCar;
    if (v && this.state === 'play') {
      const spd = Math.abs(v.vF), gearTop = [0, 14, 24, 35, 46, 70], g = Math.max(1, gearTop.findIndex(x => x > spd) || 5);
      const lo = gearTop[g - 1], hi = gearTop[g], rpm = 900 + (spd - lo) / (hi - lo) * 6200 * (0.6 + 0.4 * Math.max(0, v.inp.throttle));
      HAudio.engine({ on: !v.wrecked, rpm: HX.clamp(v.inp.throttle > 0.5 && spd < 3 ? 4200 : rpm, 800, 7600), throttle: Math.max(0, v.inp.throttle), speed: spd, gear: g });
      HAudio.skid(HX.clamp((v.slip - 4) / 9, 0, 1) + (v.inp.handbrake && spd > 6 ? 0.4 : 0));
    } else { HAudio.engine({ on: false }); HAudio.skid(0); }
    // nearest siren
    const cx = this.camera.position.x, cz = this.camera.position.z; let lvl = 0, pan = 0, pitch = 1;
    for (const c of HAI.police) { if (!c.sirenOn) continue; const dx = c.x - cx, dz = c.z - cz, d = Math.hypot(dx, dz), l = HX.clamp(1 - d / 160, 0, 1); if (l > lvl) { lvl = l; const right = -Math.cos(this.cam.yaw) * dx + Math.sin(this.cam.yaw) * dz; pan = HX.clamp(right / (d || 1), -1, 1); const rel = ((c.vx - (v ? v.vx : 0)) * dx + (c.vz - (v ? v.vz : 0)) * dz) / (d || 1); pitch = HX.clamp(1 - rel / 340, 0.9, 1.1); } }
    HAudio.siren(lvl * lvl, pan, pitch);
    // night city bed: rain at night, dry at dawn/day (only re-sent when it changes)
    const amb = this.state === 'play' ? 0.55 : this.state === 'vault' || this.state === 'interior' ? 0 : 0.3, rain = HX.clamp(1 - this.tod * 1.6, 0, 1), key = amb.toFixed(2) + '|' + rain.toFixed(1);
    if (key !== this._ambKey) { this._ambKey = key; HAudio.ambience(amb, { rain, wind: 0.5, club: this.state === 'play' && this.tod < 0.5 ? 0.25 : 0 }); }
  },

  /* ---------- HUD ---------- */
  updateHud(dt) {
    if (!HHud.ready || this.state === 'loading') return;
    HHud.el.classList.toggle('touch', !!Input.touchMode);
    const p = this.player, v = p && p.inCar;
    if (p) {
      HHud.setBars(p.hp / 100, v ? 1 - v.damage : this.car ? 1 - this.car.damage : null);
      HHud.setSpeed(v && this.state === 'play' ? Math.abs(v.vF) * 3.6 : null);
      HHud.setWanted(HAI.wanted, !HAI.seen && HAI.wanted > 0);
      const px = v ? v.x : this.state === 'vault' ? -170 : p.x, pz = v ? v.z : this.state === 'vault' ? -35 : p.z;
      this._radarT = (this._radarT || 0) - dt; HHud.radarVisible(this.state !== 'vault' && this.state !== 'interior' && !this.camOverride);
      if (this._radarT <= 0 && this.state !== 'vault' && this.state !== 'interior') {
        this._radarT = 1 / 30;
        const blips = HMission.blips();
        for (const c of HAI.police) if (!c.wrecked) blips.push({ x: c.x, z: c.z, kind: 'police', edge: HAI.wanted > 0 });
        if (this.car && this.car !== v) blips.push({ x: this.car.x, z: this.car.z, col: '#4da3ff', edge: true });
        HHud.radar(px, pz, this.cam.yaw + Math.PI, blips, HMission.route); // rotate so that the camera's forward is up
      }
    }
    // touch controls overlay
    if (Input.touchMode && this.state === 'interior') HHud.drawTouch(true, Input.sticks, (this.interior && this.interior.touchButtons) ? this.interior.touchButtons() : []);
    else if (Input.touchMode && (this.state === 'play' || this.state === 'vault') && !this.camOverride) {
      const B = Input.BTN;
      HHud.drawTouch(true, Input.sticks, this.state === 'vault'
        ? [{ x: B.special.x, y: B.special.y, r: B.r, label: '🚗', col: '#ffd23f', on: !HHud.$.prompt.hidden }]
        : [
          { x: B.dash.x, y: B.dash.y, r: B.r, label: v ? '⛔' : '⤒', col: '#ffffff' },
          { x: B.special.x, y: B.special.y, r: B.r, label: v ? '🚪' : '🚗', col: '#ffd23f', on: !!(v || this.nearestCar(3.6) || HMission.promptBusy) },
        ]);
    } else HHud.drawTouch(false);
  },

  /* ---------- render ---------- */
  render(real) {
    const r = this.renderer, indoor = (this.state === 'interior' && this.interior) || (this.state === 'vault' && HMission.vault), sc = this.state === 'interior' && this.interior ? this.interior.scene : this.state === 'vault' && HMission.vault ? HMission.vault.scene : this.scene;
    const pal = HWorld.todPal || { exp: 1 };
    if (this.reflect && !indoor && this.updateReflection()) {
      this.reflCam.layers.set(1);
      const fog = this.scene.fog, bg = this.scene.background; this.scene.background = null;
      r.setRenderTarget(this.reflRT); r.setClearColor(0x000000, 1); r.clear(); r.render(this.scene, this.reflCam);
      this.scene.background = bg; r.setClearColor(0x05030b, 1);
    }
    if (this.bloom) {
      r.setRenderTarget(this.rtScene); r.clear(); r.render(sc, this.camera);
      const mb = this.mBright; mb.uniforms.tIn.value = this.rtScene.texture; mb.uniforms.uTx.value.set(1 / this.W, 1 / this.H); const dayK = HX.clamp((this.tod - 0.4) / 0.8, 0, 1); mb.uniforms.uTh.value = indoor ? (this.interior && this.state === 'interior' && this.interior.bloomTh || 0.9) : 1.05 + 0.8 * dayK; // continuous: no pop through dawn/dusk
      this.pass(mb, this.rt2); this.blur(this.rt2, this.rt2b, 1);
      this.mCopy.uniforms.tIn.value = this.rt2.texture; this.pass(this.mCopy, this.rt4); this.blur(this.rt4, this.rt4b, 1);
      this.mCopy.uniforms.tIn.value = this.rt4.texture; this.pass(this.mCopy, this.rt8); this.blur(this.rt8, this.rt8b, 1.2);
      const f = this.mFinal.uniforms; f.tScene.value = this.rtScene.texture; f.tB2.value = this.rt2.texture; f.tB4.value = this.rt4.texture; f.tB8.value = this.rt8.texture;
      f.uExp.value = pal.exp || 1; f.uTime.value = this.time % 100; f.uGrade.value = HX.clamp(1 - this.tod, 0, 1);
      f.uBloom.value = indoor ? 0.75 : 0.75 - 0.4 * dayK;
      if (this.state === 'interior' && this.interior) f.uGrade.value = this.interior.grade !== undefined ? this.interior.grade : 0.3;
      f.uDesat.value = HX.clamp(this.desat || 0, 0, 1); const ti = this.desatTint || [1, 1, 1]; f.uTint.value.set(ti[0], ti[1], ti[2]);
      const v = this.player && this.player.inCar; f.uCA.value = v ? HX.clamp((Math.abs(v.vF) - 30) / 30, 0, 1) * 0.012 : 0;
      const fl = this.flash || (this.flash = { a: 0, r: 1, g: 1, b: 1 }); fl.a = Math.max(0, fl.a - real * 2.5); f.uFlash.value.set(fl.r, fl.g, fl.b, fl.a);
      this.pass(this.mFinal, null);
    } else {
      r.toneMappingExposure = pal.exp || 1;
      r.setRenderTarget(null); r.render(sc, this.camera);
    }
  },
  doFlash(r, g, b, a) { this.flash = { r, g, b, a }; },
};

/* expose the chapter's globals on window: top-level const declarations in classic scripts are global
   bindings but NOT window properties, and several places feature-detect modules with window.X */
(function exposeHeistGlobals() {
  const get = { AudioSys: () => AudioSys, HExtras: () => HExtras, HX: () => HX, HWorld: () => HWorld, HFX3: () => HFX3, HSkids: () => HSkids, HVehicle: () => HVehicle, HAI: () => HAI, HHud: () => HHud, HMission: () => HMission, Heist: () => Heist, HModels: () => HModels, HAudio: () => HAudio, HHack: () => HHack, HCrew: () => HCrew, HShop: () => HShop, HCrewStory: () => HCrewStory };
  for (const k in get) { try { if (!window[k]) window[k] = get[k](); } catch (e) { /* that module isn't loaded */ } }
})();
