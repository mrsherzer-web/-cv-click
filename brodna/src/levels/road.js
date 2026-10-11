import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { World } from '../world.js';
import { makeSky, TEX, forest, lampPosts, textSign } from '../env.js';
import { rng, smooth, clamp } from '../util.js';

// Road control points (x, y, z): from the coastal plain up the hills to Katzir.
const CTRL = [
  [0, 0, -400],
  [10, 4, -300],
  [-30, 10, -220],
  [-60, 18, -140],
  [-20, 26, -70],
  [40, 34, -20],
  [70, 44, 50],
  [30, 54, 120],
  [-20, 64, 170],
  [0, 74, 240],
  [60, 86, 290],
  [90, 96, 340],
  [70, 104, 400],
];
const HALF = 470;

function interpZ(z, k) {
  if (z <= CTRL[0][2]) return CTRL[0][k];
  for (let i = 1; i < CTRL.length; i++) {
    if (z <= CTRL[i][2]) {
      const a = CTRL[i - 1];
      const b = CTRL[i];
      const t = (z - a[2]) / (b[2] - a[2]);
      const s = t * t * (3 - 2 * t);
      return a[k] + (b[k] - a[k]) * s;
    }
  }
  return CTRL[CTRL.length - 1][k];
}

export function buildRoad(scene) {
  const r = rng(11);
  const curve = new THREE.CatmullRomCurve3(CTRL.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const N = 700;
  const S = curve.getSpacedPoints(N);
  const T = S.map((_, i) => curve.getTangentAt(i / N));
  // grid for nearest-sample lookups
  const CELL = 20;
  const grid = new Map();
  S.forEach((p, i) => {
    const k = Math.floor(p.x / CELL) * 4096 + Math.floor(p.z / CELL);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  function nearest(x, z) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = 0;
    let bd = Infinity;
    for (let rr = 1; rr <= 4; rr++) {
      for (let ix = cx - rr; ix <= cx + rr; ix++)
        for (let iz = cz - rr; iz <= cz + rr; iz++) {
          const l = grid.get(ix * 4096 + iz);
          if (!l) continue;
          for (const i of l) {
            const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2;
            if (d < bd) {
              bd = d;
              best = i;
            }
          }
        }
      if (bd < Infinity) break;
    }
    if (bd === Infinity) {
      for (let i = 0; i < S.length; i += 4) {
        const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    return { i: best, d: Math.sqrt(bd) };
  }
  function natural(x, z) {
    const cx = interpZ(z, 0);
    const base = interpZ(z, 1);
    const off = Math.abs(x - cx);
    return base + 9 * Math.sin(x * 0.021 + 0.7) * Math.cos(z * 0.017) + 4 * Math.sin((x - z) * 0.045) + 26 * smooth(50, 230, off) - 3;
  }
  function ground(x, z) {
    const n = nearest(x, z);
    const ry = S[n.i].y;
    if (n.d < 5.5) return ry;
    return ry + (natural(x, z) - ry) * smooth(5.5, 28, n.d);
  }
  const world = new World(ground);

  // ---------- terrain
  const SEG = 170;
  const tg = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  const col = new Float32Array(tp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i) + 0;
    const y = ground(x, z);
    tp.setY(i, y);
    const n = nearest(x, z);
    const dry = 0.5 + 0.5 * Math.sin(x * 0.013 + z * 0.021);
    c.setRGB(0.32 + dry * 0.18, 0.36 + dry * 0.08, 0.2 + dry * 0.02);
    if (n.d < 9) c.lerp(new THREE.Color(0.42, 0.37, 0.3), 1 - smooth(5, 9, n.d));
    col.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const grass = TEX.grass().clone();
  grass.needsUpdate = true;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(90, 90);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------- road ribbon
  function strip(width, lift, uvLen) {
    const pos = [];
    const uv = [];
    const idx = [];
    let dist = 0;
    for (let i = 0; i <= N; i++) {
      const p = S[i];
      const t = T[i];
      const nx = t.z;
      const nz = -t.x;
      const l = Math.hypot(nx, nz) || 1;
      if (i > 0) dist += S[i].distanceTo(S[i - 1]);
      for (const s of [-1, 1]) {
        pos.push(p.x + (nx / l) * s * width * 0.5, p.y + lift, p.z + (nz / l) * s * width * 0.5);
        uv.push(s < 0 ? 0 : 1, dist / uvLen);
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const roadTex = TEX.road().clone();
  roadTex.needsUpdate = true;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const road = new THREE.Mesh(strip(8, 0.06, 10), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
  road.receiveShadow = true;
  scene.add(road);
  const shoulder = new THREE.Mesh(strip(11, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0x6b6152, roughness: 1 }));
  shoulder.receiveShadow = true;
  scene.add(shoulder);
  // guardrails on the downhill side
  const railPos = [];
  const postGeos = [];
  for (let i = 20; i < N - 40; i += 3) {
    const p = S[i];
    const t = T[i];
    const nx = t.z;
    const nz = -t.x;
    const l = Math.hypot(nx, nz) || 1;
    const side = natural(p.x + (nx / l) * 12, p.z + (nz / l) * 12) < natural(p.x - (nx / l) * 12, p.z - (nz / l) * 12) ? 1 : -1;
    const x = p.x + (nx / l) * side * 5.6;
    const z = p.z + (nz / l) * side * 5.6;
    railPos.push([x, p.y, z]);
    if (i % 6 === 2) postGeos.push(new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(x, p.y + 0.4, z));
  }
  const railGeos = [];
  for (let i = 1; i < railPos.length; i++) {
    const a = new THREE.Vector3(...railPos[i - 1]);
    const b = new THREE.Vector3(...railPos[i]);
    const len = a.distanceTo(b);
    if (len > 8) continue;
    const g = new THREE.BoxGeometry(0.06, 0.3, len + 0.05);
    const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
    g.applyMatrix4(m);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.68, (a.z + b.z) / 2);
    railGeos.push(g);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9adb3, roughness: 0.4, metalness: 0.7 });
  if (railGeos.length) scene.add(new THREE.Mesh(mergeGeometries(railGeos), steel));
  if (postGeos.length) scene.add(new THREE.Mesh(mergeGeometries(postGeos), steel));

  // ---------- vegetation and rocks
  const pines = [];
  const olives = [];
  const cypress = [];
  const rocks = [];
  for (let k = 0; k < 2600 && pines.length + olives.length < 900; k++) {
    const x = (r() * 2 - 1) * (HALF - 20);
    const z = (r() * 2 - 1) * (HALF - 20);
    const n = nearest(x, z);
    if (n.d < 10) continue;
    const y = ground(x, z);
    if (n.d < 70 && r() < 0.6) {
      // olive grove rows near the road
      const gx = Math.round(x / 9) * 9;
      const gz = Math.round(z / 9) * 9;
      if (nearest(gx, gz).d < 10) continue;
      olives.push({ x: gx + r(), y: ground(gx, gz) - 0.1, z: gz + r(), s: 0.8 + r() * 0.5, rot: r() * 6 });
    } else {
      pines.push({ x, y: y - 0.2, z, s: 0.8 + r() * 0.8, rot: r() * 6 });
    }
  }
  for (let k = 0; k < 220; k++) {
    const x = (r() * 2 - 1) * HALF;
    const z = (r() * 2 - 1) * HALF;
    const n = nearest(x, z);
    if (n.d < 8) continue;
    rocks.push({ x, y: ground(x, z) - 0.2, z, s: 0.4 + r() * 1.4, rot: r() * 6 });
  }
  for (let i = N - 150; i < N; i += 6) {
    for (const s of [-1, 1]) {
      const t = T[i];
      const l = Math.hypot(t.z, t.x) || 1;
      const x = S[i].x + (t.z / l) * s * 9;
      const z = S[i].z - (t.x / l) * s * 9;
      cypress.push({ x, y: ground(x, z), z, s: 0.9 + r() * 0.3 });
    }
  }
  forest(scene, 'pine', pines);
  forest(scene, 'olive', olives);
  forest(scene, 'cypress', cypress);
  for (const t of [...pines, ...cypress]) world.circle(t.x, t.z, 0.45 * t.s, { tag: 'tree' });
  for (const t of olives) world.circle(t.x, t.z, 0.5 * t.s, { tag: 'tree' });
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8f8778, roughness: 1, flatShading: true }), rocks.length);
  const mx = new THREE.Matrix4();
  rocks.forEach((k, i) => {
    mx.compose(new THREE.Vector3(k.x, k.y, k.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(k.rot, k.rot * 2, 0)), new THREE.Vector3(k.s, k.s * 0.6, k.s));
    rockMesh.setMatrixAt(i, mx);
  });
  rockMesh.castShadow = true;
  scene.add(rockMesh);

  // ---------- Katzir: gate, lamps and the lit village on the hilltop
  const gi = N - 34;
  const gate = S[gi];
  const gt = T[gi];
  const gateYaw = Math.atan2(gt.x, gt.z);
  const gateGroup = new THREE.Group();
  gateGroup.position.copy(gate);
  gateGroup.rotation.y = gateYaw;
  const stone = new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.6, 1.2), stone);
    pillar.position.set(s * 6.2, 2.3, 0);
    pillar.castShadow = true;
    gateGroup.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.3, 0.4), new THREE.MeshBasicMaterial({ map: textSign('קציר · ברוכים הבאים', { w: 1024, h: 110, bg: '#1d4f2f', fg: '#fff', font: '700 76px Assistant, Arial' }), toneMapped: false }));
  beam.position.set(0, 5.0, 0);
  beam.rotation.y = Math.PI;
  gateGroup.add(beam);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.5 }));
  arm.position.set(4, 3.6, -1.2);
  arm.rotation.z = 1.25;
  gateGroup.add(arm);
  scene.add(gateGroup);
  world.box(gate.x - 0.6 + Math.cos(gateYaw) * 6.2, gate.z - 0.6 - Math.sin(gateYaw) * 6.2, gate.x + 0.6 + Math.cos(gateYaw) * 6.2, gate.z + 0.6 - Math.sin(gateYaw) * 6.2);
  world.box(gate.x - 0.6 - Math.cos(gateYaw) * 6.2, gate.z - 0.6 + Math.sin(gateYaw) * 6.2, gate.x + 0.6 - Math.cos(gateYaw) * 6.2, gate.z + 0.6 + Math.sin(gateYaw) * 6.2);
  const lamps = [];
  for (let i = N - 260; i < N; i += 14) {
    const t = T[i];
    const l = Math.hypot(t.z, t.x) || 1;
    const x = S[i].x + (t.z / l) * 6.4;
    const z = S[i].z - (t.x / l) * 6.4;
    lamps.push({ x, y: ground(x, z), z, rot: Math.atan2(-t.z, t.x) });
  }
  lampPosts(scene, lamps, { color: '#ffc27a', pool: 9 });
  // houses on the hill beyond the gate
  const houseGeos = [];
  const winGeos = [];
  for (let k = 0; k < 46; k++) {
    const a = r() * Math.PI * 2;
    const d = 30 + r() * 110;
    const x = 75 + Math.cos(a) * d;
    const z = 470 + Math.sin(a) * d * 0.6;
    const y = 104 + 4 + r() * 6;
    const w = 7 + r() * 5;
    const h = 5 + r() * 4;
    houseGeos.push(new THREE.BoxGeometry(w, h, 8).translate(x, y + h / 2, z));
    for (let wnd = 0; wnd < 3; wnd++) if (r() < 0.6) winGeos.push(new THREE.PlaneGeometry(1.1, 1.2).translate(x - w / 3 + wnd * (w / 3), y + h * 0.6, z - 4.05).rotateY(0));
  }
  scene.add(new THREE.Mesh(mergeGeometries(houseGeos), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.9 })));
  if (winGeos.length) {
    const wm = new THREE.Mesh(mergeGeometries(winGeos), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.7), side: THREE.DoubleSide }));
    scene.add(wm);
  }
  // the coastal plain far below to the west: town lights
  const lightsPos = [];
  for (let k = 0; k < 2200; k++) {
    const cx = -700 - r() * 1400;
    const cz = -600 + r() * 1400;
    lightsPos.push(cx, -40 - r() * 4, cz);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lightsPos, 3));
  scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color(2.2, 1.5, 0.8), size: 2.2, sizeAttenuation: true, map: TEX.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 1 }));
  plain.position.set(-1500, -46, 0);
  scene.add(plain);

  // ---------- light
  const sky = makeSky(scene, 'dusk');
  const hemi = new THREE.HemisphereLight(0xffb48a, 0x2b2540, 1.1);
  const sun = new THREE.DirectionalLight(0xff9a55, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -30;
  sc.right = sc.top = 30;
  sc.far = 200;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  const startI = 10;
  return {
    world,
    night: true,
    ambience: 'road',
    surface: 'gravel',
    points: {
      start: S[startI].clone(),
      startYaw: Math.atan2(T[startI].x, T[startI].z),
      gate: gate.clone(),
    },
    minY: -60,
    nearestRoad(pos) {
      const n = nearest(pos.x, pos.z);
      return { x: S[n.i].x, z: S[n.i].z, yaw: Math.atan2(T[n.i].x, T[n.i].z) };
    },
    styleCam: { dist: 4.3, height: 1.6, look: 1.4 },
    update(dt, focus, camera) {
      sky.update(performance.now() / 1000, camera);
      if (focus) {
        sun.position.set(focus.pos.x - 60, focus.pos.y + 25, focus.pos.z - 35);
        sun.target.position.copy(focus.pos);
        if (Math.abs(focus.pos.x) > HALF - 15 || Math.abs(focus.pos.z) > HALF - 15) {
          const n = nearest(focus.pos.x, focus.pos.z);
          focus.pos.x = clamp(focus.pos.x, -HALF + 16, HALF - 16);
          focus.pos.z = clamp(focus.pos.z, -HALF + 16, HALF - 16);
          if (focus.speed !== undefined) focus.speed *= 0.5;
          void n;
        }
      }
    },
  };
}
