// Late-afternoon light: a gradient sky with the sun in the southwest, haze that matches the horizon,
// and a painted ring of distant land: the coastal plain and the sea to the west, hills elsewhere.
// Chapter ten lays more over it, every part at zero until a mission asks (so the afternoon draws exactly
// as it always did): a glow low along the horizon toward one side (sunrise, sunset, a far blast), a sun
// that can stand somewhere else, and for the other dimension two moons, slow ribbons of light, cracks,
// motes that drift around the camera (one shader-driven draw) and a view cut short (fog and far plane).
// world/daylight.js drives all of it; nothing here moves by itself.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.58, 0.57, 0.58).normalize();
const HAZE = new THREE.Color('#e7d8c2');

// a 1x1 clear texture, so the cloud sampler is always bound
function emptyClouds() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#3d7fd6') },
      horizon: { value: HAZE.clone() },
      sunDir: { value: SUN_DIR.clone() }, // where the sun stands now (the afternoon's place until a look moves it)
      sunColor: { value: new THREE.Color('#fff0d2') },
      // an optional cloud layer: a horizontally tileable density strip (r channel), v = 0 at the
      // horizon, wrapped three times around the dome and drifting slowly; nothing until a layer sets it
      clouds: { value: emptyClouds() },
      cloudAmount: { value: 0 },
      cloudShift: { value: 0 },
      // chapter ten (all off at 0): a glow low along the horizon, strongest toward glowDir (a flat unit vector)
      glowDir: { value: new THREE.Vector3(1, 0, 0) },
      glowColor: { value: new THREE.Color('#ff7a3c') },
      glowAmount: { value: 0 },
      // two moons: where each hangs (unit vectors), its colour, its angular radius (radians)
      moonA: { value: new THREE.Vector3(1, 0.16, 0).normalize() },
      moonB: { value: new THREE.Vector3(0.9, 0.2, 0.43).normalize() },
      moonColorA: { value: new THREE.Color('#e9dcff') },
      moonColorB: { value: new THREE.Color('#8fd6ff') },
      moonSize: { value: new THREE.Vector2(0.085, 0.04) },
      moonAmount: { value: 0 },
      weird: { value: 0 },        // the other dimension's ribbons of light and faint stars
      breakAmount: { value: 0 },  // cracks of light across the sky (it is coming apart)
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, sunDir, sunColor;
      uniform sampler2D clouds;
      uniform float cloudAmount, cloudShift;
      uniform vec3 glowDir, glowColor, moonA, moonB, moonColorA, moonColorB;
      uniform vec2 moonSize;
      uniform float glowAmount, moonAmount, weird, breakAmount, uTime;
      varying vec3 vDir;
      // a moon: a shaded ball lit from one side (lit: where its light comes from, in the disc's own
      // right/up/toward-us axes), a mottled face, a soft halo round it
      vec3 moon(vec3 col, vec3 d, vec3 m, float size, vec3 tint, vec3 lit, float seed) {
        float ang = sqrt(max(0.0, 2.0 - 2.0 * dot(d, m)));   // the chord: the angle, for small ones
        if (ang > size * 5.0) return col;
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), m)), up = cross(m, right);
        vec2 uv = vec2(dot(d, right), dot(d, up)) / size;
        float rr = dot(uv, uv);
        float disc = 1.0 - smoothstep(0.9, 1.0, sqrt(rr));
        vec3 n = vec3(uv, sqrt(max(0.0, 1.0 - rr)));
        float light = smoothstep(-0.12, 0.5, dot(n, normalize(lit)));
        float mott = 0.5 + 0.5 * sin(uv.x * 7.0 + seed) * sin(uv.y * 5.0 - seed * 1.7) + 0.25 * sin((uv.x + uv.y) * 13.0 + seed * 3.0);
        vec3 body = tint * (0.05 + 0.95 * light) * (0.82 + 0.18 * mott);
        float halo = exp(-max(ang - size, 0.0) / (size * 0.9)) * 0.38;
        return mix(col + tint * halo * moonAmount * (1.0 - disc), body, disc * moonAmount);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizon, top, pow(h, 0.32));
        float s = max(dot(d, sunDir), 0.0);
        float cloud = 0.0;
        if (cloudAmount > 0.0) {
          vec2 cuv = vec2((atan(d.x, d.z) / 6.2831853 + 0.5) * 3.0 + cloudShift, clamp(h / 0.6, 0.0, 1.0));
          // thin out toward the horizon (haze) and toward the zenith (the strip ends there)
          cloud = texture2D(clouds, cuv).r * cloudAmount * smoothstep(0.015, 0.1, h) * (1.0 - smoothstep(0.78, 1.0, cuv.y));
          // lit on top by the sun, the sky color showing through the thin parts
          vec3 cloudCol = mix(horizon, top, 0.3) * 0.72 + sunColor * 0.34;
          col = mix(col, cloudCol, cloud);
        }
        if (glowAmount > 0.0) {
          // a band of colour low on the horizon: all round a little, strongest toward glowDir
          float az = max(dot(normalize(d.xz + vec2(1e-5)), glowDir.xz), 0.0);
          col += glowColor * glowAmount * (0.22 + 0.78 * az * az * az) * pow(1.0 - h, 7.0) * (1.0 - 0.5 * cloud);
        }
        if (weird > 0.0) {
          // the other dimension: slow ribbons of light hang over the sky, a few faint stars behind them
          float a = atan(d.x, d.z);
          float band = sin(a * 3.0 + uTime * 0.07 + 1.6 * sin(h * 8.0 + a * 2.0 + uTime * 0.13));
          float rib = pow(band * 0.5 + 0.5, 7.0) * smoothstep(0.1, 0.34, h) * (1.0 - smoothstep(0.55, 0.98, h));
          col += vec3(0.16, 0.3, 0.95) * rib * 0.5 * weird;
          vec2 g = vec2(a * 40.0, h * 70.0), cell = floor(g);
          float rnd = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float star = step(0.93, rnd) * (1.0 - smoothstep(0.0, 0.16, length(fract(g) - 0.5)));
          col += vec3(0.8, 0.75, 1.0) * star * (0.5 + 0.5 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 40.0)) * 0.55 * weird * smoothstep(0.08, 0.3, h) * (1.0 - cloud);
        }
        if (moonAmount > 0.0) {
          col = moon(col, d, moonB, moonSize.y, moonColorB, vec3(0.75, 0.3, 0.45), 4.2);
          col = moon(col, d, moonA, moonSize.x, moonColorA, vec3(-0.6, 0.35, 0.6), 1.3);
        }
        col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08) * (1.0 - cloud * 0.85);
        if (breakAmount > 0.0) {
          // the sky coming apart: jagged cracks of white-blue light, more of them as it goes
          float a = atan(d.x, d.z);
          vec2 q = vec2(a * 2.2, h * 4.0);
          q += 0.22 * vec2(sin(q.y * 9.0 + 1.7), sin(q.x * 7.0 + 0.3)) + 0.07 * vec2(sin(q.y * 31.0), sin(q.x * 27.0));
          float c1 = abs(sin(q.x * 3.1 + q.y * 1.7)), c2 = abs(sin(q.x * 1.3 - q.y * 4.3 + 2.0));
          float w = 0.012 + 0.05 * breakAmount;
          float crack = (1.0 - smoothstep(0.0, w, c1)) + (1.0 - smoothstep(0.0, w, c2)) * step(0.45, breakAmount);
          float flick = 0.7 + 0.3 * sin(uTime * 9.0 + q.x * 5.0);
          col += vec3(0.75, 0.86, 1.0) * crack * flick * breakAmount * 1.6 * smoothstep(0.02, 0.12, h);
          col += vec3(0.3, 0.4, 1.0) * breakAmount * 0.12 * (1.0 - smoothstep(0.0, 0.5, min(c1, c2)));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  mesh.name = 'sky';
  return mesh;
}

// panorama painted once; u = 0.25 is the direction of `westDir` after the cylinder is rotated
function backdropTexture() {
  const W = 2048, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const horizon = 250;
  // far land, lighter (hazier) toward the horizon
  const land = g.createLinearGradient(0, horizon, 0, H);
  land.addColorStop(0, '#d9cdb5');
  land.addColorStop(0.35, '#b8b18a');
  land.addColorStop(1, '#8d915e');
  g.fillStyle = land;
  g.fillRect(0, horizon, W, H - horizon);
  // fields and orchards on the plain
  for (let i = 0; i < 900; i++) {
    const y = horizon + 8 + Math.pow(Math.random(), 1.6) * (H - horizon);
    const w = 10 + Math.random() * 60 * ((y - horizon) / 120);
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '96,112,62' : '170,150,100'},${0.15 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * W, y, w, 1 + (y - horizon) / 70);
  }
  // hills all around except the west, bluish with distance
  const ridge = (amp, base, color, seed) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, horizon + 2);
    for (let x = 0; x <= W; x += 8) {
      const u = x / W, west = Math.exp(-((u - 0.25) ** 2) / 0.012); // no hills over the plain
      const y = horizon - base - amp * (0.5 + 0.5 * Math.sin(u * 19 + seed) * Math.cos(u * 7 + seed * 2)) * (1 - west);
      g.lineTo(x, y);
    }
    g.lineTo(W, horizon + 2);
    g.closePath();
    g.fill();
  };
  ridge(26, 6, 'rgba(150,164,182,0.55)', 1.2);
  ridge(16, 2, 'rgba(126,140,140,0.7)', 3.7);
  // the sea: a thin silver band on the western horizon
  const sea = g.createLinearGradient(0, 0, W, 0);
  sea.addColorStop(0.08, 'rgba(150,175,200,0)');
  sea.addColorStop(0.16, 'rgba(150,175,200,0.95)');
  sea.addColorStop(0.34, 'rgba(150,175,200,0.95)');
  sea.addColorStop(0.42, 'rgba(150,175,200,0)');
  g.fillStyle = sea;
  g.fillRect(0, horizon - 3, W, 7);
  // a coastal town on the plain, and a power station with two striped chimneys (invented placement)
  for (let i = 0; i < 70; i++) {
    const x = W * (0.2 + Math.random() * 0.11), w = 3 + Math.random() * 7, h = 3 + Math.random() * 12;
    g.fillStyle = `rgba(${225 + Math.random() * 20},${218 + Math.random() * 20},${205 + Math.random() * 20},0.85)`;
    g.fillRect(x, horizon + 5 - h, w, h);
  }
  for (const x of [W * 0.272, W * 0.279]) {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#f1ede6' : '#c9564a';
      g.fillRect(x, horizon - 60 + k * 7.5, 4, 7.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1; // seen from inside the cylinder
  return { texture: t, horizonV: 1 - horizon / H };
}

// motes of energy adrift around the camera (the other dimension): every one is placed by the shader from
// a seed, the time and the camera, wrapped in a box that follows the view while the motes stay put in the
// world, so the CPU sets three uniforms a frame. One draw call; in the scene only while they show.
const MOTES = 240, MOTE_BOX = [46, 16, 46];
function makeMotes() {
  const seed = new Float32Array(MOTES * 3), extra = new Float32Array(MOTES * 4);
  for (let i = 0; i < MOTES; i++) {
    seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
    extra[i * 4] = Math.random(); extra[i * 4 + 1] = 0.4 + Math.random() * 0.6; extra[i * 4 + 2] = 0.07 + Math.random() * Math.random() * 0.2; extra[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(extra, 4));
  const u = {
    uBox: { value: new THREE.Vector3(...MOTE_BOX) }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uScale: { value: 300 }, uAlpha: { value: 0 },
    uColA: { value: new THREE.Color('#b98cff') }, uColB: { value: new THREE.Color('#58c8ff') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform vec3 uBox, uCam; uniform float uTime, uScale, uAlpha;
      varying float vA, vHue;
      void main() {
        // adrift: a slow wander sideways, a slower rise
        vec3 drift = vec3(sin(uTime * 0.23 * aSeed.y + aSeed.x * 6.28) * 1.4, uTime * 0.16 * aSeed.y, cos(uTime * 0.19 * aSeed.y + aSeed.x * 4.1) * 1.4);
        vec3 local = mod(position * uBox + drift - uCam, uBox) - 0.5 * uBox;
        vec4 mv = viewMatrix * vec4(uCam + local, 1.0);
        float r = length(local.xz) / (0.5 * uBox.x);
        float tw = 0.5 + 0.5 * sin(uTime * (0.9 + 1.8 * aSeed.y) + aSeed.x * 40.0);
        vA = uAlpha * (0.25 + 0.75 * tw) * (1.0 - smoothstep(0.7, 1.0, r)) * smoothstep(0.5, 2.2, -mv.z);
        vHue = aSeed.w;
        gl_PointSize = aSeed.z * uScale / max(0.6, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColA, uColB; varying float vA, vHue;
      void main() {
        float d = 1.0 - min(1.0, length(gl_PointCoord - 0.5) * 2.0);
        float a = d * d * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(uColA, uColB, vHue) * (1.0 + 2.5 * pow(d, 6.0)), a);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 12; points.name = 'motes';
  points.raycast = () => {}; // its positions are seeds, not places
  const size = new THREE.Vector2();
  // just before the draw: the box around whichever camera draws (the main view or the video call's)
  points.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(size);
    u.uScale.value = size.y * 0.5 / Math.tan(((camera.fov || 60) * Math.PI) / 360);
    u.uCam.value.set(camera.position.x, camera.position.y + MOTE_BOX[1] * 0.22, camera.position.z);
  };
  return { points, u, geo, mat };
}

export function createSky(scene, { westDir }) {
  scene.background = HAZE.clone();
  scene.fog = new THREE.Fog(HAZE.clone(), 70, 520);

  const dome = skyDome();
  scene.add(dome);

  // the ring of far land sits below eye level so the horizon reads a few degrees down
  // drawn at unit size and scaled to just inside the camera's far plane (see setQuality)
  const { texture, horizonV } = backdropTexture();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.5, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, transparent: true, depthWrite: false }),
  );
  let ringY = 0;
  // the painted west (texture u = 0.25) lands on the cylinder's -x side; turn it to face westDir
  ring.rotation.y = Math.atan2(westDir.z, -westDir.x);
  ring.renderOrder = -1;
  ring.frustumCulled = false;
  ring.name = 'backdrop';
  scene.add(ring);

  const hemi = new THREE.HemisphereLight('#cfe0ff', '#8a7452', 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
  sun.castShadow = false;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 140;
  scene.add(sun, sun.target);

  const u = dome.material.uniforms;
  const lightDir = SUN_DIR.clone(); // where the sun's light comes from: the sun's place, never lower than about 12° (shadows stay finite)
  let motes = null;                 // made the first time they show
  let cam = null;                   // the camera the view distance belongs to (setQuality gives it)
  let held = null;                  // while the view is cut short: { far, full } as the camera had them before
  const sizeRing = (far) => {
    const R = far * 0.9, Hc = R * 0.5;
    ring.scale.set(R, Hc / 0.5, R);
    ringY = -R * 0.057 - (horizonV - 0.5) * Hc; // the horizon a few degrees below eye level
  };

  const sky = {
    dome, ring, sun, hemi,
    sunDir: u.sunDir.value,  // live: the daylight moves it for a look and puts it back (setSun)
    far: 2600,               // the quality preset's far plane and fog distance (setQuality)
    fogFar: scene.fog.far,
    viewLimit: null,         // metres, while the view is cut short (the other dimension)
    time: 0,                 // game seconds (the daylight's update), for the ribbons, the cracks and the motes
    onQuality: null,         // the daylight hooks this: a look that sets the fog is laid again after a preset change
    // keep the sky, the land ring and the shadow box centered on the player
    follow(camera, focus) {
      if (sky.viewLimit !== null) sky.applyLimit(camera);
      dome.position.copy(camera.position);
      u.cloudShift.value = (performance.now() * 0.0000022) % 1; // the clouds drift
      ring.position.set(camera.position.x, camera.position.y + ringY, camera.position.z);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(lightDir, 70);
    },
    // the sun somewhere else (a vector toward it); null puts it back in the afternoon's southwest
    setSun(dir = null) {
      sky.sunDir.copy(dir || SUN_DIR);
      if (!dir) { lightDir.copy(SUN_DIR); return; }
      sky.sunDir.normalize();
      lightDir.copy(sky.sunDir);
      if (lightDir.y < 0.2) { lightDir.y = 0.2; lightDir.normalize(); }
    },
    // game time for what moves in the sky (only while something there does)
    tick(dt) {
      sky.time += dt;
      if (u.weird.value > 0 || u.breakAmount.value > 0) u.uTime.value = sky.time;
      if (motes?.points.parent) motes.u.uTime.value = sky.time;
    },
    // motes adrift around the camera, 0..1 (0 takes them out of the scene)
    setMotes(k) {
      if (!(k > 0)) { if (motes?.points.parent) scene.remove(motes.points); return; }
      if (!motes) motes = makeMotes();
      motes.u.uAlpha.value = Math.min(1, k) * 0.85;
      if (!motes.points.parent) scene.add(motes.points);
    },
    get motes() { return motes?.points.parent ? motes.points : null; },
    // the view cut short at `far` metres (the far plane and the painted horizon come in with it); null
    // gives the preset's view back. The fog itself is the daylight's to set
    limitView(far = null) {
      const want = far === null ? null : Math.max(30, far);
      if (want === sky.viewLimit) return;
      sky.viewLimit = want;
      if (cam) { if (want === null) sky.releaseLimit(cam); else sky.applyLimit(cam); }
    },
    applyLimit(camera) {
      const want = Math.min(sky.far, sky.viewLimit);
      if (camera.far === want) return;
      // the first time: what the camera had is kept (the preset's far plane, or a shorter one set elsewhere)
      if (!held) held = { far: camera.far, full: sky.far };
      camera.far = want;
      camera.updateProjectionMatrix();
      sizeRing(want);
    },
    releaseLimit(camera) {
      if (!held) return;
      camera.far = held.far === held.full ? sky.far : held.far; // the preset's view as it is now, or what was there
      camera.updateProjectionMatrix();
      sizeRing(sky.far);
      held = null;
    },
    // fog, far plane and the painted horizon all follow the view distance of the quality preset
    setQuality(q, camera) {
      const far = q.fogFar + 140;
      cam = camera;
      sky.far = far; sky.fogFar = q.fogFar;
      if (held) held = { far, full: far }; // a preset chosen while the view is cut short: follow() cuts it again
      camera.far = far;
      camera.updateProjectionMatrix();
      dome.scale.setScalar(far * 0.95);
      sizeRing(far);
      sun.castShadow = q.shadows;
      if (q.shadows && sun.shadow.mapSize.x !== q.shadowMapSize) {
        sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      scene.fog.far = q.fogFar;
      sky.onQuality?.();
    },
    // the motes' buffers, let go (a page that tears the game down)
    dispose() { if (motes) { scene.remove(motes.points); motes.geo.dispose(); motes.mat.dispose(); motes = null; } },
  };
  return sky;
}
