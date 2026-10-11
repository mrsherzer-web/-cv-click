import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng } from './util.js';

// ---------- sky
const SKY_VS = `varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uStars; uniform float uTime; uniform vec3 uMoonDir;
varying vec3 vDir;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, uBottom, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 6.0) * 0.55 + pow(s, 90.0) * 1.2 + smoothstep(0.9993, 0.9997, s) * 6.0);
  if (uStars > 0.0) {
    vec3 p = floor(d * 380.0);
    float n = h3(p);
    float star = step(0.9975, n) * smoothstep(0.02, 0.25, h);
    col += vec3(0.85, 0.9, 1.0) * star * uStars * (0.55 + 0.45 * sin(uTime * 2.0 + n * 90.0));
    float m = max(dot(d, uMoonDir), 0.0);
    col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99955, 0.9997, m) * 3.0 + pow(m, 60.0) * 0.12) * uStars;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SKIES = {
  day: { top: '#5b8fd6', horizon: '#cfe0ef', bottom: '#9db0bf', sun: [-0.3, 0.6, -0.5], sunColor: '#fff2d8', sunK: 0.6, stars: 0, fog: '#c7d6e2', fogD: 0.004 },
  dusk: { top: '#2a2f62', horizon: '#ff8a4c', bottom: '#3b2a3d', sun: [-0.85, 0.03, -0.5], sunColor: '#ff9a50', sunK: 1.2, stars: 0.35, fog: '#6e4a5a', fogD: 0.0042 },
  night: { top: '#050914', horizon: '#1c2846', bottom: '#060810', sun: [-0.9, -0.3, -0.3], sunColor: '#000000', sunK: 0, stars: 1, fog: '#0d1424', fogD: 0.0055 },
  dawn: { top: '#3d5a8c', horizon: '#ffb37a', bottom: '#4a4560', sun: [0.85, 0.05, 0.45], sunColor: '#ffb070', sunK: 1.0, stars: 0.15, fog: '#9a8a92', fogD: 0.004 },
};

export function makeSky(scene, preset) {
  const P = SKIES[preset];
  const u = {
    uTop: { value: new THREE.Color(P.top) },
    uHorizon: { value: new THREE.Color(P.horizon) },
    uBottom: { value: new THREE.Color(P.bottom) },
    uSunDir: { value: new THREE.Vector3(...P.sun).normalize() },
    uSunColor: { value: new THREE.Color(P.sunColor).multiplyScalar(P.sunK) },
    uStars: { value: P.stars },
    uTime: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.5, -0.75).normalize() },
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }));
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  scene.add(mesh);
  scene.fog = new THREE.FogExp2(new THREE.Color(P.fog), P.fogD);
  return {
    mesh,
    u,
    preset,
    set(name) {
      const Q = SKIES[name];
      u.uTop.value.set(Q.top);
      u.uHorizon.value.set(Q.horizon);
      u.uBottom.value.set(Q.bottom);
      u.uSunDir.value.set(...Q.sun).normalize();
      u.uSunColor.value.set(Q.sunColor).multiplyScalar(Q.sunK);
      u.uStars.value = Q.stars;
      scene.fog.color.set(Q.fog);
      scene.fog.density = Q.fogD;
      this.preset = name;
    },
    update(t, camera) {
      u.uTime.value = t;
      mesh.position.copy(camera.position);
    },
  };
}

// ---------- procedural textures (cached)
const cache = {};
function noisy(g, w, h, n, alpha, light = false) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${light && Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`;
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

export const TEX = {
  asphalt() {
    return (cache.asphalt ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#5a5a5c';
      g.fillRect(0, 0, w, h);
      noisy(g, w, h, 9000, 0.35, true);
    }, { repeat: [1, 1] }));
  },
  road() {
    return (cache.road ||= canvasTexture(256, 512, (g, w, h) => {
      g.fillStyle = '#4b4c50';
      g.fillRect(0, 0, w, h);
      noisy(g, w, h, 14000, 0.3, true);
      g.fillStyle = '#e8e2c8';
      g.fillRect(8, 0, 6, h);
      g.fillRect(w - 14, 0, 6, h);
      g.fillStyle = '#f2c94c';
      for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 4, y, 8, 70);
    }));
  },
  tiles() {
    return (cache.tiles ||= canvasTexture(512, 512, (g, w, h) => {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const v = 228 + Math.floor(Math.random() * 14);
          g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
          g.fillRect(i * 128, j * 128, 128, 128);
        }
      noisy(g, w, h, 3000, 0.06);
      g.strokeStyle = 'rgba(120,110,100,0.5)';
      g.lineWidth = 2;
      for (let k = 0; k <= 4; k++) {
        g.beginPath();
        g.moveTo(k * 128, 0);
        g.lineTo(k * 128, h);
        g.moveTo(0, k * 128);
        g.lineTo(w, k * 128);
        g.stroke();
      }
    }, { repeat: [1, 1] }));
  },
  concrete() {
    return (cache.concrete ||= canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#7d7c78';
      g.fillRect(0, 0, w, h);
      noisy(g, w, h, 16000, 0.22, true);
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * w;
        const grd = g.createLinearGradient(x, 0, x + 20, h);
        grd.addColorStop(0, 'rgba(40,35,30,0)');
        grd.addColorStop(0.5, 'rgba(40,35,30,0.18)');
        grd.addColorStop(1, 'rgba(40,35,30,0)');
        g.fillStyle = grd;
        g.fillRect(x, 0, 6 + Math.random() * 20, h);
      }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
    }, { repeat: [1, 1] }));
  },
  plaster() {
    return (cache.plaster ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#ece6da';
      g.fillRect(0, 0, w, h);
      noisy(g, w, h, 7000, 0.08, true);
    }, { repeat: [1, 1] }));
  },
  stone() {
    return (cache.stone ||= canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#c9b48f';
      g.fillRect(0, 0, w, h);
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        let x = (r % 2) * -40;
        while (x < w) {
          const bw = 70 + Math.random() * 60;
          const v = 180 + Math.floor(Math.random() * 40);
          g.fillStyle = `rgb(${v},${v - 18},${v - 50})`;
          g.fillRect(x + 2, r * 64 + 2, bw - 4, 60);
          x += bw;
        }
      }
      noisy(g, w, h, 9000, 0.12, true);
    }, { repeat: [1, 1] }));
  },
  roof() {
    return (cache.roof ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#a7472c';
      g.fillRect(0, 0, w, h);
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          const v = Math.random() * 30;
          g.fillStyle = `rgb(${160 + v},${66 + v * 0.4},${40 + v * 0.3})`;
          g.beginPath();
          g.ellipse(c * 32 + 16 + (r % 2) * 16, r * 32 + 20, 15, 18, 0, 0, Math.PI);
          g.fill();
        }
      noisy(g, w, h, 2000, 0.15);
    }, { repeat: [1, 1] }));
  },
  grass() {
    return (cache.grass ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#4c5b2e';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.random();
        g.fillStyle = v < 0.5 ? 'rgba(90,110,50,0.5)' : v < 0.8 ? 'rgba(140,130,70,0.45)' : 'rgba(40,50,25,0.5)';
        g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3);
      }
    }, { repeat: [1, 1] }));
  },
  wood() {
    return (cache.wood ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#7a5434';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(0, y, w, 2);
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(40,25,10,${Math.random() * 0.3})`;
          g.beginPath();
          const yy = y + Math.random() * 30;
          g.moveTo(0, yy);
          g.bezierCurveTo(w * 0.3, yy + 3, w * 0.6, yy - 3, w, yy);
          g.stroke();
        }
      }
    }, { repeat: [1, 1] }));
  },
  rust() {
    return (cache.rust ||= canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#5b5f62';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const grd = g.createRadialGradient(x, y, 0, x, y, 10 + Math.random() * 30);
        grd.addColorStop(0, 'rgba(130,60,20,0.6)');
        grd.addColorStop(1, 'rgba(130,60,20,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
      noisy(g, w, h, 5000, 0.2, true);
    }));
  },
  glow() {
    return (cache.glow ||= canvasTexture(128, 128, (g) => {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }));
  },
};

export function mat(kind, opts = {}) {
  const map = TEX[kind]().clone();
  map.needsUpdate = true;
  if (opts.repeat) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return new THREE.MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.9, metalness: opts.metalness ?? 0, color: opts.color ?? 0xffffff });
}

// Box with UVs scaled to world metres so textures tile evenly.
export function worldBox(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const sx = ax > 0.5 ? d : w;
    const sy = ay > 0.5 ? d : h;
    uv.setXY(i, (uv.getX(i) * sx) / uvScale, (uv.getY(i) * sy) / uvScale);
  }
  return g;
}

// ---------- vegetation (one geometry per species, vertex coloured, instanced)
function colored(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  return geo;
}

export const TREES = {
  pine: () =>
    mergeGeometries([
      colored(new THREE.CylinderGeometry(0.16, 0.26, 4, 6).translate(0, 2, 0), '#4a3524'),
      colored(new THREE.ConeGeometry(2.2, 3.4, 7).translate(0, 4.2, 0), '#1f3a24'),
      colored(new THREE.ConeGeometry(1.8, 3.0, 7).translate(0, 5.6, 0), '#244428'),
      colored(new THREE.ConeGeometry(1.3, 2.6, 7).translate(0, 7.0, 0), '#2a4d2d'),
    ]),
  olive: () =>
    mergeGeometries([
      colored(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 6).translate(0, 0.8, 0), '#5a4a3a'),
      colored(new THREE.IcosahedronGeometry(1.7, 1).scale(1.2, 0.8, 1.2).translate(0, 2.2, 0), '#6f7d5c'),
      colored(new THREE.IcosahedronGeometry(1.1, 1).translate(0.9, 2.6, 0.3), '#7d8a68'),
    ]),
  cypress: () =>
    mergeGeometries([
      colored(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6).translate(0, 0.6, 0), '#4a3524'),
      colored(new THREE.SphereGeometry(1, 8, 10).scale(0.85, 3.6, 0.85).translate(0, 4.2, 0), '#1c3322'),
    ]),
  ficus: () =>
    mergeGeometries([
      colored(new THREE.CylinderGeometry(0.4, 0.6, 3, 8).translate(0, 1.5, 0), '#5b4a3c'),
      colored(new THREE.IcosahedronGeometry(3.4, 1).scale(1.3, 0.75, 1.3).translate(0, 4.6, 0), '#2f4a28'),
    ]),
  bush: () => mergeGeometries([colored(new THREE.IcosahedronGeometry(0.9, 1).scale(1.2, 0.8, 1.2).translate(0, 0.6, 0), '#34502c')]),
};

export function forest(scene, species, items, { shadows = true } = {}) {
  if (!items.length) return null;
  const geo = TREES[species]();
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), items.length);
  const mx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rot ?? 0);
    mx.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * (it.sy ?? 1), it.s));
    m.setMatrixAt(i, mx);
  });
  m.castShadow = shadows;
  m.receiveShadow = false;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

// ---------- lights that are cheap: emissive bulbs + an additive glow pool on the ground
export function lampPosts(scene, items, { color = '#ffd59a', height = 5, pool = 7 } = {}) {
  if (!items.length) return;
  const pole = new THREE.InstancedMesh(
    mergeGeometries([new THREE.CylinderGeometry(0.07, 0.1, height, 6).translate(0, height / 2, 0), new THREE.BoxGeometry(0.12, 0.08, 1.0).translate(0, height, 0.45)]),
    new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.6, metalness: 0.5 }),
    items.length
  );
  const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) }), items.length);
  const glow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(pool, pool).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TEX.glow(), color: new THREE.Color(color).multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    items.length
  );
  const haloPos = new Float32Array(items.length * 3);
  const mx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  items.forEach((it, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot ?? 0);
    mx.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(1, 1, 1));
    pole.setMatrixAt(i, mx);
    const bx = it.x + Math.sin(it.rot ?? 0) * 0.9;
    const bz = it.z + Math.cos(it.rot ?? 0) * 0.9;
    mx.makeTranslation(bx, it.y + height - 0.12, bz);
    bulb.setMatrixAt(i, mx);
    mx.makeTranslation(bx, it.y + 0.04 + (it.gy ?? 0), bz);
    glow.setMatrixAt(i, mx);
    haloPos.set([bx, it.y + height - 0.12, bz], i * 3);
  });
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const halo = new THREE.Points(
    hg,
    new THREE.PointsMaterial({ map: TEX.glow(), size: 2.4, color: new THREE.Color(color).multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
  );
  for (const m of [pole, bulb, glow, halo]) {
    m.frustumCulled = false;
    scene.add(m);
  }
  pole.castShadow = true;
  return { pole, bulb, glow, halo };
}

export function textSign(text, { w = 512, h = 128, bg = '#111', fg = '#ffcc4d', font = '700 72px Assistant, Arial', border = null } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 8;
      g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

export { rng };
