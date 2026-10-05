// ============================================================================
//  Reusable 3D props for the snooker club
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';

const mats = new Map();
export function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}
export const std = (color, rough = 0.8, metal = 0, extra = {}) =>
  mat(`std:${color}:${rough}:${metal}:${JSON.stringify(extra)}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }),
  );

export const M = {
  get mahogany() {
    return std(0x4a1a0c, 0.45, 0.05);
  },
  get darkWood() {
    return std(0x24140b, 0.7);
  },
  get brass() {
    return std(0xc8a14a, 0.32, 0.85);
  },
  get gold() {
    return std(0xb8892e, 0.35, 0.8);
  },
  get black() {
    return std(0x0b0b0c, 0.6);
  },
  get steel() {
    return std(0x8a9096, 0.4, 0.7);
  },
  get white() {
    return std(0xd8d8d0, 0.5);
  },
  get felt() {
    return mat('felt', () => new THREE.MeshStandardMaterial({ map: T.tex(T.felt(), { repeat: [2, 1] }), roughness: 0.95 }));
  },
  get feltBlood() {
    return mat('feltb', () => new THREE.MeshStandardMaterial({ map: T.tex(T.felt('#16602e'), { repeat: [2, 1] }), roughness: 0.95 }));
  },
  get leather() {
    return mat('leather', () => new THREE.MeshStandardMaterial({ map: T.tex(T.leather()), roughness: 0.55 }));
  },
};

const box = (w, h, d, material, x = 0, y = 0, z = 0, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
};
export { box };

const cyl = (rt, rb, h, material, x = 0, y = 0, z = 0, parent, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
};
export { cyl };

// ------------------------------------------------------------------ table
let legGeo = null;
function turnedLeg() {
  if (legGeo) return legGeo;
  const pts = [
    [0.0, 0], [0.075, 0], [0.085, 0.04], [0.06, 0.08], [0.065, 0.14], [0.095, 0.22], [0.1, 0.3],
    [0.075, 0.38], [0.06, 0.44], [0.07, 0.5], [0.06, 0.56], [0.0, 0.56],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  legGeo = new THREE.LatheGeometry(pts, 18);
  return legGeo;
}

const BALL_COLORS = [0xffd02a, 0x1f8a3a, 0x7a4a1c, 0x1b4bd8, 0xff8fb0, 0x101010];

export function snookerTable({ length = 3.6, width = 1.85, balls = true, bloody = false, scatter = false, cover = false } = {}) {
  const g = new THREE.Group();
  const H = 0.86;
  const rail = 0.12;
  // legs
  const lx = length / 2 - 0.25;
  const lz = width / 2 - 0.2;
  const xs = length > 3 ? [-lx, 0, lx] : [-lx, lx];
  for (const x of xs)
    for (const z of [-lz, lz]) {
      const leg = new THREE.Mesh(turnedLeg(), M.gold);
      leg.position.set(x, 0, z);
      leg.castShadow = true;
      g.add(leg);
    }
  // body
  box(length - 0.2, 0.26, width - 0.2, M.mahogany, 0, H - 0.2, 0, g);
  box(length - 0.18, 0.03, width - 0.18, M.gold, 0, H - 0.34, 0, g);
  // bed
  const bed = box(length - rail * 2, 0.06, width - rail * 2, cover ? std(0x3a3a38, 0.95) : bloody ? M.feltBlood : M.felt, 0, H - 0.03, 0, g);
  bed.castShadow = false;
  // rails
  box(length, 0.07, rail, M.mahogany, 0, H + 0.01, width / 2 - rail / 2, g);
  box(length, 0.07, rail, M.mahogany, 0, H + 0.01, -width / 2 + rail / 2, g);
  box(rail, 0.07, width, M.mahogany, length / 2 - rail / 2, H + 0.01, 0, g);
  box(rail, 0.07, width, M.mahogany, -length / 2 + rail / 2, H + 0.01, 0, g);
  // cushions
  const cush = cover ? std(0x3a3a38, 0.95) : M.felt;
  box(length - rail * 2, 0.04, 0.04, cush, 0, H + 0.015, width / 2 - rail - 0.02, g);
  box(length - rail * 2, 0.04, 0.04, cush, 0, H + 0.015, -width / 2 + rail + 0.02, g);
  box(0.04, 0.04, width - rail * 2, cush, length / 2 - rail - 0.02, H + 0.015, 0, g);
  box(0.04, 0.04, width - rail * 2, cush, -length / 2 + rail + 0.02, H + 0.015, 0, g);
  // pockets
  const pocketMat = std(0x050505, 0.9);
  for (const x of [-length / 2 + rail * 0.7, 0, length / 2 - rail * 0.7])
    for (const z of [-width / 2 + rail * 0.7, width / 2 - rail * 0.7]) cyl(0.065, 0.065, 0.08, pocketMat, x, H + 0.02, z, g, 12);
  if (cover) {
    // a dusty sheet thrown over the table
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(length + 0.25, 0.5, width + 0.25, 8, 2, 4), std(0xb8b2a2, 1));
    const p = sheet.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 0) {
        p.setX(i, p.getX(i) * (1 + Math.random() * 0.03));
        p.setY(i, y - Math.random() * 0.15);
      } else p.setY(i, y + Math.random() * 0.03);
    }
    sheet.geometry.computeVertexNormals();
    sheet.position.y = H - 0.18;
    sheet.castShadow = sheet.receiveShadow = true;
    g.add(sheet);
    return g;
  }
  if (balls) {
    const r = 0.026;
    const geo = new THREE.SphereGeometry(r, 14, 10);
    const reds = new THREE.InstancedMesh(geo, std(0xc80c0c, 0.25), 15);
    const m4 = new THREE.Matrix4();
    let k = 0;
    const apexX = length * 0.22;
    for (let row = 0; row < 5; row++)
      for (let i = 0; i <= row; i++) {
        let x = apexX + row * r * 1.75;
        let z = (i - row / 2) * r * 2.02;
        if (scatter) {
          x = (Math.random() - 0.5) * (length - 0.5);
          z = (Math.random() - 0.5) * (width - 0.5);
        }
        m4.setPosition(x, H + r, z);
        reds.setMatrixAt(k++, m4);
      }
    reds.castShadow = true;
    g.add(reds);
    const spots = [
      [-length * 0.3, -0.29], [-length * 0.3, 0.29], [-length * 0.3, 0], [0, 0], [length * 0.2, 0], [length * 0.4, 0],
    ];
    BALL_COLORS.forEach((c, i) => {
      const b = new THREE.Mesh(geo, std(c, 0.25));
      b.position.set(spots[i][0], H + r, spots[i][1]);
      b.castShadow = true;
      g.add(b);
    });
    const cue = new THREE.Mesh(geo, std(0xf2f0e6, 0.2));
    cue.position.set(-length * 0.36, H + r, 0.12);
    g.add(cue);
    // a cue left on the table
    const stick = cyl(0.006, 0.014, 1.45, std(0xd2b07a, 0.5), length * -0.05, H + 0.02, width * 0.18, g, 8);
    stick.rotation.z = Math.PI / 2;
    stick.rotation.y = 0.3;
  }
  if (bloody) {
    const d = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshStandardMaterial({ map: T.tex(T.bloodDecal(3, false)), transparent: true, depthWrite: false, roughness: 0.4 }),
    );
    d.rotation.x = -Math.PI / 2;
    d.position.set(length * 0.1, H + 0.004, -0.15);
    g.add(d);
  }
  return g;
}

// ------------------------------------------------------------------ lamps
const coneMat = (color = 0xfff0c8, op = 0.07) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, op: { value: op } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){ vH = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float op; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(vN, vV)), 1.5); float a = op * f * smoothstep(0.0, 1.0, vH) ; gl_FragColor = vec4(color * a, a); }`,
  });

export function lightCone(height, rTop, rBottom, color = 0xfff0c8, op = 0.07) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, 24, 1, true), coneMat(color, op));
  m.renderOrder = 5;
  return m;
}

/**
 * Billiard pendant: brass bar on two chains with N green shades.
 * Returns group with .light (SpotLight), .bulbMats and .cones for flickering.
 */
export function pendantLamp({ shades = 3, spacing = 0.95, drop = 1.15, intensity = 14, color = 0xffe2b0, shadow = true, cone = true, angle = 0.95 } = {}) {
  const g = new THREE.Group();
  const span = (shades - 1) * spacing;
  cyl(0.02, 0.02, span + 0.3, M.brass, 0, 0, 0, g, 8).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const ch = cyl(0.006, 0.006, drop, M.brass, (s * span) / 2.5, drop / 2, 0, g, 4);
    ch.castShadow = false;
  }
  const shadeMat = std(0x1d3b26, 0.5, 0.3);
  const innerMat = std(0xf3efe2, 0.6);
  g.bulbMats = [];
  g.cones = [];
  for (let i = 0; i < shades; i++) {
    const x = -span / 2 + i * spacing;
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 20, 1, true), shadeMat);
    sh.position.set(x, -0.12, 0);
    g.add(sh);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.235, 0.195, 20, 1, true), innerMat);
    inner.material.side = THREE.BackSide;
    inner.position.set(x, -0.12, 0);
    g.add(inner);
    const bm = new THREE.MeshBasicMaterial({ color: 0xfff1d0 });
    bm.color.multiplyScalar(4);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), bm);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(x, -0.2, 0);
    g.add(bulb);
    g.bulbMats.push(bm);
    if (cone) {
      const c = lightCone(1.0, 0.18, 0.75, color, 0.05);
      c.position.set(x, -0.72, 0);
      g.add(c);
      g.cones.push(c);
    }
  }
  const L = new THREE.SpotLight(color, intensity, 0, angle, 0.6, 2);
  L.position.set(0, -0.25, 0);
  L.target.position.set(0, -2, 0);
  g.add(L, L.target);
  if (shadow) {
    L.castShadow = true;
    L.shadow.mapSize.set(512, 512);
    L.shadow.bias = -0.0008;
    L.shadow.radius = 4;
    L.shadow.camera.near = 0.2;
    L.shadow.camera.far = 6;
  }
  g.light = L;
  g.baseIntensity = intensity;
  return g;
}

export function bareBulb(intensity = 3, color = 0xffd8a0, distance = 0) {
  const g = new THREE.Group();
  cyl(0.004, 0.004, 0.4, M.black, 0, 0.2, 0, g, 4);
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(5) });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bm);
  g.add(b);
  const L = new THREE.PointLight(color, intensity, distance, 2);
  g.add(L);
  g.light = L;
  g.bulbMats = [bm];
  g.cones = [];
  g.baseIntensity = intensity;
  return g;
}

export function fluorescent(intensity = 6, color = 0xd8f0ff) {
  const g = new THREE.Group();
  box(1.25, 0.06, 0.16, std(0xcfd2d0, 0.6), 0, 0, 0, g);
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4) });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.08), bm);
  tube.position.y = -0.04;
  g.add(tube);
  const P = new THREE.PointLight(color, intensity, 0, 2);
  P.position.y = -0.2;
  g.add(P);
  g.light = P;
  g.bulbMats = [bm];
  g.cones = [];
  g.baseIntensity = intensity;
  return g;
}

/** flicker helper: amount 0..1, returns current factor */
export function flickerFactor(t, seed = 0, amount = 0.3) {
  const n = Math.sin(t * 13.1 + seed) * Math.sin(t * 7.3 + seed * 2.1) * Math.sin(t * 31.7 + seed * 0.7);
  let f = 1 - amount * 0.25 * (n * 0.5 + 0.5);
  const burst = Math.sin(t * 0.37 + seed * 5.3) > 0.985 - amount * 0.03;
  if (burst && Math.sin(t * 60 + seed) > 0) f *= 0.15;
  return f;
}
export function setLamp(lamp, f) {
  if (lamp.light) lamp.light.intensity = lamp.baseIntensity * f;
  const base = lamp.bulbBase || (lamp.bulbBase = lamp.bulbMats.map((m) => m.color.clone()));
  lamp.bulbMats.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(Math.max(0.05, f)));
  lamp.cones.forEach((c) => (c.material.uniforms.op.value = 0.05 * f));
}

// ------------------------------------------------------------------ decor
export function poster(texture, w, h, { frame = true, emissive = 0, frameColor = 0x111111 } = {}) {
  const g = new THREE.Group();
  if (frame) box(w + 0.08, h + 0.08, 0.03, std(frameColor, 0.5, 0.3), 0, 0, -0.012, g).castShadow = false;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      emissive: emissive ? 0xffffff : 0x000000,
      emissiveMap: emissive ? texture : null,
      emissiveIntensity: emissive,
    }),
  );
  m.position.z = 0.006;
  m.receiveShadow = true;
  g.add(m);
  g.surface = m;
  return g;
}

export function sign(canvasEl, w, h, intensity = 2.5) {
  const t = T.tex(canvasEl);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(1, 1, 1).multiplyScalar(intensity) }));
  m.baseIntensity = intensity;
  return m;
}

export function decal(canvasEl, w, h, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: T.tex(canvasEl), transparent: true, opacity, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.receiveShadow = true;
  return m;
}

export function cueRack(n = 8) {
  const g = new THREE.Group();
  box(0.06 * n + 0.2, 0.08, 0.1, M.darkWood, 0, 0.1, 0, g);
  box(0.06 * n + 0.2, 0.06, 0.1, M.darkWood, 0, 1.3, 0, g);
  for (let i = 0; i < n; i++) {
    const c = cyl(0.008, 0.015, 1.45, std(i % 3 ? 0xc9a676 : 0x7a4a26, 0.5), -0.03 * n + 0.06 * i + 0.03, 0.72, 0.03, g, 8);
    c.rotation.z = (Math.random() - 0.5) * 0.04;
  }
  return g;
}

export function ballShelf() {
  const g = new THREE.Group();
  box(0.5, 1.1, 0.12, M.darkWood, 0, 0.55, 0, g);
  const geo = new THREE.SphereGeometry(0.03, 10, 8);
  const cols = [0xc80c0c, 0xffd02a, 0x1b4bd8, 0x1f8a3a, 0xff8fb0, 0x7a4a1c, 0x101010, 0xeeeeee];
  for (let r = 0; r < 5; r++) {
    box(0.48, 0.015, 0.1, M.darkWood, 0, 0.15 + r * 0.2, 0.04, g);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(geo, std(cols[(r * 3 + i) % cols.length], 0.3));
      b.position.set(-0.19 + i * 0.075, 0.19 + r * 0.2, 0.05);
      g.add(b);
    }
  }
  return g;
}

export function bench(len = 2) {
  const g = new THREE.Group();
  box(len, 0.06, 0.4, std(0x6a5a48, 0.85), 0, 0.45, 0, g);
  for (const x of [-len / 2 + 0.15, len / 2 - 0.15]) box(0.06, 0.45, 0.35, M.steel, x, 0.22, 0, g);
  return g;
}

export function stool() {
  const g = new THREE.Group();
  cyl(0.19, 0.19, 0.08, M.leather, 0, 0.78, 0, g, 16);
  cyl(0.025, 0.025, 0.74, M.steel, 0, 0.38, 0, g, 8);
  cyl(0.2, 0.22, 0.03, M.steel, 0, 0.015, 0, g, 16);
  return g;
}

export function barCounter(len = 4) {
  const g = new THREE.Group();
  box(len, 1.05, 0.6, M.mahogany, 0, 0.525, 0, g);
  box(len + 0.1, 0.06, 0.75, std(0x2a120a, 0.3, 0.1), 0, 1.08, 0.05, g);
  box(len, 0.04, 0.04, M.brass, 0, 0.2, 0.33, g);
  return g;
}

export function bottleShelf(len = 3.5, redBottles = true) {
  const g = new THREE.Group();
  const cols = [0x2a5a1a, 0x5a3010, 0x1a3a5a, 0xc8b070, 0x3a1010];
  for (let r = 0; r < 3; r++) {
    box(len, 0.03, 0.25, M.darkWood, 0, 1.3 + r * 0.45, 0, g);
    for (let x = -len / 2 + 0.12; x < len / 2 - 0.1; x += 0.13) {
      if (Math.random() < 0.2) continue;
      const red = redBottles && Math.random() < 0.3;
      const mm = red
        ? std(0xb0101a, 0.15, 0, { emissive: new THREE.Color(0x400004) })
        : std(cols[Math.floor(Math.random() * cols.length)], 0.15);
      const h = 0.25 + Math.random() * 0.12;
      cyl(0.035, 0.035, h, mm, x, 1.32 + r * 0.45 + h / 2, 0, g, 8);
      cyl(0.012, 0.02, 0.08, mm, x, 1.32 + r * 0.45 + h + 0.04, 0, g, 6);
    }
  }
  return g;
}

export function deadTree() {
  const g = new THREE.Group();
  const barkMat = std(0x2a2018, 0.95);
  const branch = (len, rad, depth, parent) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 6), barkMat);
    m.position.y = len / 2;
    m.castShadow = true;
    const holder = new THREE.Group();
    holder.add(m);
    parent.add(holder);
    if (depth > 0) {
      const n = depth > 2 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const child = new THREE.Group();
        child.position.y = len * (0.6 + Math.random() * 0.4);
        child.rotation.z = (Math.random() - 0.5) * 1.6;
        child.rotation.x = (Math.random() - 0.5) * 1.2;
        holder.add(child);
        branch(len * 0.68, rad * 0.62, depth - 1, child);
      }
    }
    return holder;
  };
  branch(1.1, 0.09, 4, g);
  // planter
  const pot = new THREE.Group();
  box(0.6, 0.5, 0.6, std(0x3a3632, 0.9), 0, 0.25, 0, pot);
  g.position.y = 0.45;
  const out = new THREE.Group();
  out.add(pot, g);
  return out;
}

export function sofa(len = 2) {
  const g = new THREE.Group();
  const m = M.leather;
  box(len, 0.42, 0.8, m, 0, 0.21, 0, g);
  box(len, 0.6, 0.2, m, 0, 0.6, -0.32, g);
  for (const s of [-1, 1]) box(0.2, 0.55, 0.8, m, (s * (len - 0.2)) / 2, 0.35, 0, g);
  return g;
}

export function crtMonitor(screenTexture) {
  const g = new THREE.Group();
  box(0.5, 0.42, 0.45, std(0x2c2a26, 0.7), 0, 0.21, -0.05, g);
  box(0.42, 0.34, 0.25, std(0x23211e, 0.7), 0, 0.21, -0.35, g);
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.31),
    new THREE.MeshBasicMaterial({ map: screenTexture, color: new THREE.Color(1.6, 1.6, 1.6) }),
  );
  scr.position.set(0, 0.22, 0.176);
  g.add(scr);
  g.screen = scr;
  return g;
}

export function deskFan() {
  const g = new THREE.Group();
  cyl(0.09, 0.11, 0.03, M.black, 0, 0.015, 0, g, 16);
  cyl(0.015, 0.015, 0.28, M.black, 0, 0.16, 0, g, 6);
  const head = new THREE.Group();
  head.position.set(0, 0.32, 0);
  g.add(head);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 6, 24), M.steel);
  head.add(cage);
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.004), std(0x404448, 0.5, 0.5));
    b.position.x = 0.06;
    const h = new THREE.Group();
    h.rotation.z = (i * Math.PI * 2) / 3;
    h.add(b);
    blades.add(h);
  }
  head.add(blades);
  g.blades = blades;
  g.head = head;
  return g;
}

export function exitSign() {
  const c = T.textTexture(['יציאה'], { w: 256, h: 96, bg: '#0a3a14', color: '#7dffa0', font: '900 60px Heebo', glow: '#3cff6a' });
  const m = sign(c, 0.5, 0.19, 2.5);
  return m;
}

export function shelfUnit(w = 1.6, rows = 4) {
  const g = new THREE.Group();
  const frame = M.steel;
  for (const x of [-w / 2, w / 2]) for (const z of [-0.2, 0.2]) box(0.03, 2, 0.03, frame, x, 1, z, g);
  const card = new THREE.MeshStandardMaterial({ map: T.tex(T.cardboard()), roughness: 0.9 });
  for (let r = 0; r < rows; r++) {
    const y = 0.15 + r * 0.55;
    box(w, 0.03, 0.45, std(0x55585a, 0.7, 0.4), 0, y, 0, g);
    for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.36) {
      if (Math.random() < 0.25) continue;
      const s = 0.22 + Math.random() * 0.12;
      const b = box(s * 1.2, s, 0.35, card, x + Math.random() * 0.05, y + s / 2 + 0.015, 0, g);
      b.rotation.y = (Math.random() - 0.5) * 0.3;
    }
  }
  return g;
}

export function woodenDoor(w = 0.9, h = 2.05) {
  const g = new THREE.Group();
  box(w + 0.12, h + 0.08, 0.06, M.darkWood, 0, (h + 0.08) / 2, -0.02, g);
  box(w, h, 0.05, std(0x3a2414, 0.7), 0, h / 2, 0.02, g);
  cyl(0.02, 0.02, 0.06, M.brass, w / 2 - 0.1, h * 0.48, 0.06, g, 8).rotation.x = Math.PI / 2;
  return g;
}

/** A box-shaped room (floor, ceiling, 4 walls facing inward) */
export function roomShell({ w, d, h, wall, floor, ceil, wallRepeat = null }) {
  const g = new THREE.Group();
  const fm = new THREE.MeshStandardMaterial({ map: T.tex(floor, { repeat: [w / 3, d / 3] }), roughness: 0.75 });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fm);
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  g.add(f);
  const cm = new THREE.MeshStandardMaterial({ map: T.tex(ceil, { repeat: [w / 1.2, d / 1.2] }), roughness: 0.95 });
  const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cm);
  c.rotation.x = Math.PI / 2;
  c.position.y = h;
  g.add(c);
  const mkWall = (len, x, z, ry) => {
    const t = T.tex(wall, { repeat: wallRepeat ? [len / wallRepeat, 1] : [len / 2.2, 1] });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  g.walls = {
    back: mkWall(w, 0, -d / 2, 0),
    front: mkWall(w, 0, d / 2, Math.PI),
    left: mkWall(d, -w / 2, 0, Math.PI / 2),
    right: mkWall(d, w / 2, 0, -Math.PI / 2),
  };
  return g;
}
