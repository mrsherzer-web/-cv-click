import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { World } from '../world.js';
import { makeSky, TEX, forest, lampPosts, textSign, worldBox, mat } from '../env.js';
import { rng, smooth } from '../util.js';
import { carModel } from '../car.js';
import { portraitOf } from '../cast.js';

const STREETS = [
  // [x0, z0, x1, z1, width]
  [-3.5, 13, 3.5, 160, 7],
  [-3.5, -64, 3.5, -13, 7],
  [-112, 26.5, 112, 33.5, 7],
  [-84, -39.5, 84, -32.5, 7],
  [-108, 14, -92, 30, 0],
  [-32, 12, -14, 26.5, 0],
];

export function ground(x, z) {
  let y = 0.45 * Math.sin(x * 0.035) * Math.cos(z * 0.04) + 0.25 * Math.sin((x + z) * 0.08);
  const w = smooth(-123, -175, x);
  y -= w * w * 190 + smooth(-175, -260, x) * 15;
  y -= smooth(-100, -170, z) * 35;
  y -= smooth(170, 240, z) * 35;
  y -= smooth(140, 210, x) * 35;
  return y;
}

function onStreet(x, z, pad = 0) {
  for (const [x0, z0, x1, z1] of STREETS) if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return true;
  return false;
}

// The village, the lookout over the plain, the forest path along the cliff and the iron door.
export function buildKatzir(scene, opts = {}, game) {
  const r = rng(5);
  const world = new World(ground);
  const time = opts.time || 'night';

  // ---------- terrain
  const tg = new THREE.PlaneGeometry(520, 420, 160, 130);
  tg.rotateX(-Math.PI / 2);
  tg.translate(-30, 0, 45);
  const tp = tg.attributes.position;
  const col = new Float32Array(tp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const y = ground(x, z);
    tp.setY(i, y);
    const rock = smooth(-124, -140, x);
    const dry = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.03);
    c.setRGB(0.3 + dry * 0.12, 0.33 + dry * 0.06, 0.2);
    c.lerp(new THREE.Color(0.42, 0.38, 0.33), rock);
    col.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const grass = TEX.grass().clone();
  grass.needsUpdate = true;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(70, 56);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------- streets and plazas (flat ribbons following the ground)
  function flatPatch(x0, z0, x1, z1, lift, step = 4) {
    const w = x1 - x0;
    const d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.ceil(w / step)), Math.max(1, Math.ceil(d / step)));
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, ground(p.getX(i), p.getZ(i)) + lift);
      uv.setXY(i, p.getX(i) / 6, p.getZ(i) / 6);
    }
    g.computeVertexNormals();
    return g;
  }
  const asphalt = mat('asphalt', { roughness: 0.85 });
  asphalt.color.set(0x6d6d70);
  const streetGeos = STREETS.map(([x0, z0, x1, z1]) => flatPatch(x0, z0, x1, z1, 0.05));
  const streets = new THREE.Mesh(mergeGeometries(streetGeos), asphalt);
  streets.receiveShadow = true;
  scene.add(streets);
  const stoneMat = mat('stone', { roughness: 0.85 });
  const plazaGeos = [flatPatch(-13, -13, 13, 13, 0.07), flatPatch(-123, -11, -106, 7, 0.07), flatPatch(-106, -3, -13, 3, 0.06)];
  const plazas = new THREE.Mesh(mergeGeometries(plazaGeos), stoneMat);
  plazas.receiveShadow = true;
  scene.add(plazas);
  // centre lines
  const lineGeos = [];
  for (let z = 16; z < 158; z += 6) lineGeos.push(new THREE.PlaneGeometry(0.18, 2.6).rotateX(-Math.PI / 2).translate(0, ground(0, z) + 0.08, z));
  for (let x = -108; x < 110; x += 6) lineGeos.push(new THREE.PlaneGeometry(2.6, 0.18).rotateX(-Math.PI / 2).translate(x, ground(x, 30) + 0.08, 30));
  scene.add(new THREE.Mesh(mergeGeometries(lineGeos), new THREE.MeshStandardMaterial({ color: 0xe9e2c4, roughness: 0.6 })));

  // ---------- houses
  const wallGeos = [];
  const roofGeos = [];
  const trimGeos = [];
  const winLit = [];
  const winDark = [];
  const doorGeos = [];
  const yardTrees = [];
  const cypresses = [];
  const gardenGeos = [];
  const house = (x, z, face, opt = {}) => {
    // face: direction the front looks at (unit vector along x or z)
    const w = opt.w || 9 + r() * 3;
    const d = opt.d || 9 + r() * 2;
    const h = opt.h || (r() < 0.65 ? 6 : 3.4);
    const y = ground(x, z) - 0.2;
    const alongX = Math.abs(face[0]) > 0.5;
    const sx = alongX ? d : w;
    const sz = alongX ? w : d;
    wallGeos.push(worldBox(sx, h, sz, 3).translate(x, y + h / 2, z));
    world.box(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, { wall: true });
    if (opt.flat || r() < 0.4) {
      trimGeos.push(new THREE.BoxGeometry(sx + 0.3, 0.5, sz + 0.3).translate(x, y + h + 0.25, z));
    } else {
      const roof = new THREE.ConeGeometry(Math.hypot(sx, sz) / 2 + 0.6, 2.6, 4, 1);
      roof.rotateY(Math.PI / 4);
      roof.scale(sx / Math.hypot(sx, sz) * 1.41, 1, sz / Math.hypot(sx, sz) * 1.41);
      roof.translate(x, y + h + 1.3, z);
      roofGeos.push(roof);
    }
    // windows on the front facade
    const n = Math.max(2, Math.floor((alongX ? sz : sx) / 3));
    const fx = x + face[0] * (sx / 2 + 0.03);
    const fz = z + face[1] * (sz / 2 + 0.03);
    for (let f = 0; f < (h > 5 ? 2 : 1); f++) {
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        const wx = fx + (alongX ? 0 : t * (sx - 1.5));
        const wz = fz + (alongX ? t * (sz - 1.5) : 0);
        if (f === 0 && k === Math.floor(n / 2)) {
          const dg = new THREE.PlaneGeometry(1.1, 2.1);
          dg.rotateY(Math.atan2(face[0], face[1]));
          dg.translate(wx, y + 1.05 + 0.2, wz);
          doorGeos.push(dg);
          continue;
        }
        const g = new THREE.PlaneGeometry(1.2, 1.3);
        g.rotateY(Math.atan2(face[0], face[1]));
        g.translate(wx, y + 1.7 + f * 2.9, wz);
        (r() < 0.55 ? winLit : winDark).push(g);
      }
    }
    // garden wall toward the street, with a gate gap
    const gwx = x + face[0] * (sx / 2 + 3);
    const gwz = z + face[1] * (sz / 2 + 3);
    const len = alongX ? sz + 4 : sx + 4;
    for (const s of [-1, 1]) {
      const segLen = len / 2 - 0.9;
      const cx = gwx + (alongX ? 0 : s * (0.9 + segLen / 2));
      const cz = gwz + (alongX ? s * (0.9 + segLen / 2) : 0);
      const gw = alongX ? 0.35 : segLen;
      const gd = alongX ? segLen : 0.35;
      gardenGeos.push(worldBox(gw, 1.1, gd, 2).translate(cx, ground(cx, cz) + 0.45, cz));
      world.box(cx - gw / 2, cz - gd / 2, cx + gw / 2, cz + gd / 2, { wall: false, y1: ground(cx, cz) + 1.1 });
    }
    if (r() < 0.7) {
      const tx = x + face[0] * (sx / 2 + 1.5) + (alongX ? 0 : (r() - 0.5) * sx * 0.6);
      const tz = z + face[1] * (sz / 2 + 1.5) + (alongX ? (r() - 0.5) * sz * 0.6 : 0);
      (r() < 0.5 ? cypresses : yardTrees).push({ x: tx, y: ground(tx, tz), z: tz, s: 0.7 + r() * 0.4, rot: r() * 6 });
      world.circle(tx, tz, 0.5, { wall: true, tag: 'tree' });
    }
    return { x, z, sx, sz, y, h };
  };
  const occupied = (x, z, rad) =>
    onStreet(x, z, rad) ||
    (Math.abs(x) < 16 + rad && Math.abs(z) < 16 + rad) ||
    (x < -86 + rad && z > -70 - rad) ||
    (x > -100 && x < -60 && z > -66 && z < -26) ||
    (x > -34 - rad && x < -12 + rad && z > 10 - rad && z < 26 + rad);
  const placeRow = (from, to, fixed, alongStreetX, faceDir) => {
    for (let t = from; t < to; t += 15 + r() * 4) {
      const x = alongStreetX ? t : fixed;
      const z = alongStreetX ? fixed : t;
      if (occupied(x, z, 6)) continue;
      if (Math.abs(x - 96) < 12 && Math.abs(z - 42) < 12) continue;
      house(x, z, faceDir);
    }
  };
  placeRow(-80, 110, 18, true, [0, 1]);
  placeRow(-80, 112, 43, true, [0, -1]);
  placeRow(-60, 82, -49, true, [0, 1]);
  placeRow(-56, 82, -23, true, [0, -1]);
  placeRow(42, 156, 14, false, [-1, 0]);
  placeRow(42, 156, -14, false, [1, 0]);
  placeRow(-60, -18, 14, false, [-1, 0]);
  placeRow(-60, -18, -14, false, [1, 0]);
  // Avraham's house, porch light on
  const av = house(96, 44, [0, -1], { w: 11, d: 10, h: 6 });
  // square buildings: grocery and the club
  const grocery = house(22, -6, [-1, 0], { w: 12, d: 8, h: 3.6, flat: true });
  void grocery;
  const plaster = mat('plaster', { roughness: 0.9 });
  scene.add(new THREE.Mesh(mergeGeometries(wallGeos), plaster));
  const roofMat = mat('roof', { roughness: 0.8 });
  if (roofGeos.length) {
    const rm = new THREE.Mesh(mergeGeometries(roofGeos), roofMat);
    rm.castShadow = true;
    scene.add(rm);
  }
  if (trimGeos.length) scene.add(new THREE.Mesh(mergeGeometries(trimGeos), new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.9 })));
  scene.add(new THREE.Mesh(mergeGeometries(gardenGeos), stoneMat));
  const winLitMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc77a, emissiveIntensity: 1.5 });
  const winDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.2, metalness: 0.6 });
  if (winLit.length) scene.add(new THREE.Mesh(mergeGeometries(winLit), winLitMat));
  if (winDark.length) scene.add(new THREE.Mesh(mergeGeometries(winDark), winDarkMat));
  scene.add(new THREE.Mesh(mergeGeometries(doorGeos), new THREE.MeshStandardMaterial({ map: TEX.wood(), roughness: 0.7 })));
  forest(scene, 'cypress', cypresses);
  forest(scene, 'olive', yardTrees);
  // kiosk sign + Avraham's porch light
  const kiosk = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.9), new THREE.MeshBasicMaterial({ map: textSign('מכולת קציר', { bg: '#14365c', fg: '#fff' }), toneMapped: false }));
  kiosk.position.set(22 - 4.05, ground(18, -6) + 3.0, -6);
  kiosk.rotation.y = -Math.PI / 2;
  scene.add(kiosk);
  const porch = new THREE.PointLight(0xffc48a, 0, 14, 1.6);
  porch.position.set(av.x, av.y + 3, av.z - av.sz / 2 - 1);
  scene.add(porch);

  // ---------- the square
  forest(scene, 'ficus', [{ x: 0, y: ground(0, 0), z: 0, s: 1.1, rot: 0.4 }]);
  world.circle(0, 0, 0.9, { wall: true });
  const benchGeos = [];
  const bench = (x, z, rot) => {
    const g = mergeGeometries([new THREE.BoxGeometry(2, 0.1, 0.5).translate(0, 0.45, 0), new THREE.BoxGeometry(2, 0.5, 0.08).translate(0, 0.75, -0.22), new THREE.BoxGeometry(0.1, 0.45, 0.45).translate(-0.9, 0.22, 0), new THREE.BoxGeometry(0.1, 0.45, 0.45).translate(0.9, 0.22, 0)]);
    g.rotateY(rot);
    g.translate(x, ground(x, z), z);
    benchGeos.push(g);
    world.box(x - 1, z - 1, x + 1, z + 1, { wall: false, y1: ground(x, z) + 0.8 });
  };
  bench(6, 6, Math.PI * 1.25);
  bench(-6, 6, Math.PI * 0.75);
  bench(6, -6, -Math.PI * 0.25);
  bench(-6, -6, Math.PI * 0.25);
  bench(-114, 4.5, Math.PI);
  bench(-117, 4.5, Math.PI);
  scene.add(new THREE.Mesh(mergeGeometries(benchGeos), new THREE.MeshStandardMaterial({ map: TEX.wood(), roughness: 0.75 })));

  // ---------- Mitzpe Dor: railing, sign, binoculars
  const railGeos = [];
  for (let z = -11; z <= 7; z += 2) railGeos.push(new THREE.BoxGeometry(0.1, 1.1, 0.1).translate(-122.6, ground(-122.6, z) + 0.55, z));
  railGeos.push(new THREE.BoxGeometry(0.1, 0.08, 18.2).translate(-122.6, ground(-122.6, -2) + 1.08, -2));
  railGeos.push(new THREE.BoxGeometry(0.06, 0.06, 18.2).translate(-122.6, ground(-122.6, -2) + 0.6, -2));
  const binoc = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10).rotateZ(Math.PI / 2).translate(-121.6, ground(-121.6, -2) + 1.35, -2);
  railGeos.push(binoc, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6).translate(-121.6, ground(-121.6, -2) + 0.6, -2));
  scene.add(new THREE.Mesh(mergeGeometries(railGeos), new THREE.MeshStandardMaterial({ color: 0x2f3338, metalness: 0.7, roughness: 0.4 })));
  world.box(-124, -110, -122.4, 40, { wall: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), new THREE.MeshBasicMaterial({ map: textSign('מצפה דור', { bg: '#5a3d1e', fg: '#ffe7b0', border: '#ffe7b0', font: '700 82px Karantina, Assistant, Arial' }), toneMapped: false }));
  sign.position.set(-106.5, ground(-106.5, 8) + 2.1, 8.6);
  sign.rotation.y = Math.PI * 0.5;
  scene.add(sign);
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), new THREE.MeshStandardMaterial({ map: TEX.wood() }));
  signPost.position.set(-106.4, ground(-106.4, 8) + 1.1, 8.6);
  scene.add(signPost);

  // ---------- forest along the cliff: cover for the follow mission
  const followPath = [
    [-112, -8],
    [-110, -18],
    [-106, -27, true],
    [-110, -36],
    [-106, -45, true],
    [-110, -53],
    [-108, -58, true],
    [-114, -61.5],
  ];
  const nearPath = (x, z, rad) => {
    for (let i = 1; i < followPath.length; i++) {
      const [ax, az] = followPath[i - 1];
      const [bx, bz] = followPath[i];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(ax + dx * t - x, az + dz * t - z) < rad) return true;
    }
    return false;
  };
  const pines = [];
  const bushes = [];
  for (let k = 0; k < 420; k++) {
    const x = -121 + r() * 34;
    const z = -72 + r() * 60;
    if (nearPath(x, z, 2.4)) continue;
    if (x > -95 && z > -60) continue;
    if (Math.hypot(x + 116, z + 62) < 6) continue;
    if (r() < 0.45) {
      pines.push({ x, y: ground(x, z) - 0.2, z, s: 0.8 + r() * 0.5, rot: r() * 6 });
      world.circle(x, z, 0.38, { wall: true, tag: 'tree' });
    } else if (bushes.length < 70) {
      bushes.push({ x, y: ground(x, z) - 0.1, z, s: 1.1 + r() * 0.5, rot: r() * 6 });
      world.circle(x, z, 0.9, { wall: true, tag: 'bush', y1: ground(x, z) + 1.6 });
    }
  }
  // more pines everywhere around the village edge
  for (let k = 0; k < 260; k++) {
    const x = -150 + r() * 300;
    const z = -110 + r() * 300;
    if (Math.abs(x) < 120 && z > -75 && z < 165) continue;
    if (x < -124) continue;
    pines.push({ x, y: ground(x, z) - 0.2, z, s: 0.8 + r() * 0.7, rot: r() * 6 });
  }
  forest(scene, 'pine', pines);
  forest(scene, 'bush', bushes, { shadows: false });

  // ---------- rocks and the iron door
  const rockGeos = [];
  const rockSpots = [
    [-120, -62, 4.2],
    [-119, -57, 3],
    [-119, -67, 3.2],
    [-122, -60, 3.6],
    [-117.5, -71, 2.2],
  ];
  for (const [x, z, s] of rockSpots) {
    const g = new THREE.DodecahedronGeometry(s, 1);
    g.scale(1, 0.85, 1.2);
    g.translate(x, ground(x, z) + s * 0.55, z);
    rockGeos.push(g);
    world.circle(x, z, s * 0.85, { wall: true });
  }
  const rocks = new THREE.Mesh(mergeGeometries(rockGeos), new THREE.MeshStandardMaterial({ color: 0x8a8174, roughness: 1, flatShading: true }));
  rocks.castShadow = true;
  scene.add(rocks);
  const dy = ground(-116.2, -62);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 2.2), new THREE.MeshStandardMaterial({ map: TEX.concrete(), roughness: 0.9 }));
  frame.position.set(-116.6, dy + 1.4, -62);
  scene.add(frame);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-116.3, dy, -62.85);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.7), new THREE.MeshStandardMaterial({ map: TEX.rust(), roughness: 0.6, metalness: 0.6 }));
  door.position.set(0, 1.1, 0.85);
  doorPivot.add(door);
  scene.add(doorPivot);
  const doorCol = world.box(-116.6, -63, -116.0, -61, { wall: true });
  let doorTarget = 0;
  // a caged bulb over the iron door, so it can be found at night
  const doorLamp = new THREE.PointLight(0xffb066, 10, 12, 1.6);
  doorLamp.position.set(-115.3, dy + 2.75, -62);
  scene.add(doorLamp);
  const doorBulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.2) }));
  doorBulb.position.copy(doorLamp.position);
  scene.add(doorBulb);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x222222, wireframe: true }));
  cage.position.copy(doorLamp.position);
  scene.add(cage);

  // ---------- water tower and the old shed
  const tower = new THREE.Group();
  const tY = ground(-92, -44);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 });
  for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 12, 6), legMat);
    leg.position.set(lx, 6, lz);
    tower.add(leg);
    world.circle(-92 + lx, -44 + lz, 0.3, { wall: true });
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4.4, 20), new THREE.MeshStandardMaterial({ color: 0xc7ccd1, roughness: 0.5, metalness: 0.5 }));
  tank.position.y = 14;
  tank.castShadow = true;
  tower.add(tank);
  const tankTop = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.4, 20), legMat);
  tankTop.position.y = 16.9;
  tower.add(tankTop);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.2, 0.2) }));
  beacon.position.y = 17.8;
  tower.add(beacon);
  tower.position.set(-92, tY, -44);
  scene.add(tower);
  // shed: x in [-83,-77], z in [-55,-49], door on the z=-49 side
  const sY = ground(-80, -52);
  const shedMat = mat('concrete', { roughness: 0.9 });
  const shedGeos = [
    worldBox(6, 3, 0.25, 3).translate(-80, sY + 1.5, -55),
    worldBox(0.25, 3, 6, 3).translate(-83, sY + 1.5, -52),
    worldBox(0.25, 3, 6, 3).translate(-77, sY + 1.5, -52),
    worldBox(2.2, 3, 0.25, 3).translate(-82, sY + 1.5, -49),
    worldBox(2.2, 3, 0.25, 3).translate(-78, sY + 1.5, -49),
    worldBox(6.6, 0.25, 6.6, 3).translate(-80, sY + 3.1, -52),
  ];
  scene.add(new THREE.Mesh(mergeGeometries(shedGeos), shedMat));
  world.box(-83.2, -55.2, -76.8, -54.8);
  world.box(-83.2, -55.2, -82.8, -48.8);
  world.box(-77.2, -55.2, -76.8, -48.8);
  world.box(-83.2, -49.2, -80.9, -48.8);
  world.box(-79.1, -49.2, -76.8, -48.8);
  const shedPivot = new THREE.Group();
  shedPivot.position.set(-80.9, sY, -49);
  const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.1), new THREE.MeshStandardMaterial({ map: TEX.rust(), metalness: 0.5, roughness: 0.6 }));
  shedDoor.position.set(0.9, 1.2, 0);
  shedPivot.add(shedDoor);
  scene.add(shedPivot);
  const shedCol = world.box(-80.9, -49.2, -79.1, -48.8);
  let shedTarget = 0;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x400000 }));
  lock.position.set(-79.3, sY + 1.1, -48.9);
  scene.add(lock);
  // workbench, the blue key, and Yiftach's photo wall inside the shed
  const bench2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.9), new THREE.MeshStandardMaterial({ map: TEX.wood() }));
  bench2.position.set(-80, sY + 0.45, -53.9);
  scene.add(bench2);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 2, metalness: 0.6 });
  const blueKey = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16), keyMat);
  blueKey.position.set(-80, sY + 1.0, -53.7);
  scene.add(blueKey);
  const keyGlow = new THREE.PointLight(0x4f8cff, 3, 4, 2);
  keyGlow.position.set(-80, sY + 1.3, -53.4);
  scene.add(keyGlow);
  const board = photoWall(game, ['ido', 'dolev', 'yahli', 'yonati', 'avraham']);
  board.position.set(-82.8, sY + 1.7, -52);
  board.rotation.y = Math.PI / 2;
  scene.add(board);

  // ---------- Yiftach's black car at the lookout lot
  const blackCar = carModel({ color: '#15171b', dark: true });
  blackCar.position.set(-104, ground(-104, 25), 25);
  scene.add(blackCar);
  world.circle(-104, 25 + 1.2, 1.0, { wall: false, tag: 'parked' });
  world.circle(-104, 25 - 1.2, 1.0, { wall: false, tag: 'parked' });

  // ---------- the plain below: towns, roads, the power station and the sea
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x232026, roughness: 1 }));
  plain.position.set(-2700, -215, 0);
  scene.add(plain);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b1424, roughness: 0.15, metalness: 0.8, envMapIntensity: 0.25 }));
  sea.position.set(-3300, -214, 0);
  scene.add(sea);
  const cityPts = [];
  const towns = [
    [-700, -260, 280],
    [-950, 300, 320],
    [-520, 520, 200],
    [-1200, -40, 240],
    [-620, 60, 160],
  ];
  for (const [tx, tz, tr] of towns)
    for (let k = 0; k < 900; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * tr;
      cityPts.push(tx + Math.cos(a) * d, -212, tz + Math.sin(a) * d * 0.7);
    }
  for (let k = 0; k < 500; k++) {
    const t = r();
    cityPts.push(-300 - t * 1100, -212, -500 + t * 900 + Math.sin(t * 9) * 40);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cityPts, 3));
  const cityMat = new THREE.PointsMaterial({ color: new THREE.Color(2.6, 1.7, 0.85), size: 3.2, sizeAttenuation: true, map: TEX.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const city = new THREE.Points(cg, cityMat);
  scene.add(city);
  // Orot Rabin style power station: four striped chimneys by the sea
  const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, map: stripesTexture() });
  const chimneyLights = [];
  for (let k = 0; k < 4; k++) {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 250, 14), stripe);
    ch.position.set(-1300 - k * 18, -215 + 125, -150 + k * 26);
    scene.add(ch);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) }));
    bl.position.set(ch.position.x, -215 + 252, ch.position.z);
    scene.add(bl);
    chimneyLights.push(bl);
  }
  // police lights on the plain road (dawn ending)
  const policeGroup = new THREE.Group();
  const policeLights = [];
  for (let k = 0; k < 3; k++) {
    const pl = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.6, 6) }));
    policeGroup.add(pl);
    policeLights.push(pl);
  }
  policeGroup.visible = false;
  scene.add(policeGroup);

  // ---------- lamps
  const lamps = [];
  for (let z = 20; z < 158; z += 24) lamps.push({ x: 4.6, y: ground(4.6, z), z, rot: -Math.PI / 2 });
  for (let x = -100; x < 110; x += 26) lamps.push({ x, y: ground(x, 36), z: 36, rot: Math.PI });
  for (let x = -76; x < 82; x += 30) lamps.push({ x, y: ground(x, -42.5), z: -42.5, rot: 0 });
  for (let x = -100; x < -16; x += 22) lamps.push({ x, y: ground(x, 4), z: 4, rot: Math.PI });
  for (const [x, z] of [[11, 11], [-11, 11], [11, -11], [-11, -11], [-108, -9]]) lamps.push({ x, y: ground(x, z), z, rot: Math.atan2(-x, -z) });
  for (const l of lamps) world.circle(l.x, l.z, 0.15, { wall: false });
  const lampSet = lampPosts(scene, lamps, { color: '#ffc983', pool: 10 });

  // ---------- sky and light
  const sky = makeSky(scene, time);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -26;
  sc.right = sc.top = 26;
  sc.far = 160;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  function setTime(name) {
    sky.set(name);
    const night = name === 'night';
    const dusk = name === 'dusk';
    const dawn = name === 'dawn';
    hemi.color.set(night ? 0x34477a : dusk ? 0xffa77a : 0xffd2b0);
    hemi.groundColor.set(night ? 0x0a0a12 : dusk ? 0x2a2238 : 0x3c3440);
    hemi.intensity = night ? 0.75 : dusk ? 1.05 : 1.15;
    sun.color.set(night ? 0x9fb4ff : dusk ? 0xff8a4a : 0xffb27a);
    sun.intensity = night ? 0.45 : dusk ? 1.5 : 1.6;
    sun.userData.dir = new THREE.Vector3(...(night ? [-0.4, 0.55, -0.75] : dusk ? [-0.85, 0.12, -0.5] : [0.85, 0.2, 0.45])).normalize();
    const lampsOn = !dawn;
    lampSet.bulb.material.color.set(lampsOn ? new THREE.Color(3, 2.2, 1.2) : new THREE.Color(0.5, 0.45, 0.4));
    lampSet.glow.visible = lampSet.halo.visible = lampsOn;
    winLitMat.emissiveIntensity = night ? 1.6 : dusk ? 0.9 : 0.25;
    cityMat.size = dawn ? 1.8 : 3.2;
    cityMat.color.setScalar(dawn ? 0.6 : 1).multiply(new THREE.Color(2.6, 1.7, 0.85));
    porch.intensity = lampsOn ? 18 : 0;
    level.night = !dawn;
  }

  const level = {
    world,
    ambience: time === 'dawn' ? 'dawn' : 'night',
    surface: 'gravel',
    night: true,
    chasePath: null,
    points: {
      park: new THREE.Vector3(-22, 0, 19),
      parkYaw: -Math.PI / 2,
      square: new THREE.Vector3(0, 0, 4),
      yahli: new THREE.Vector3(5.5, 0, -3.5),
      dark: new THREE.Vector3(-74, 0, -1),
      lookout: new THREE.Vector3(-115, 0, -2),
      viewYaw: -Math.PI / 2,
      follow: followPath.map(([x, z, look]) => ({ x, z, look: !!look })),
      bunkerDoor: new THREE.Vector3(-115.2, dy, -62),
      avraham: new THREE.Vector3(96, 0, 37.4),
      avrahamYaw: Math.PI,
      lookoutPark: new THREE.Vector3(-99, 0, 21),
      yiftachCar: new THREE.Vector3(-104, 0, 25),
      yiftachCarDoor: new THREE.Vector3(-102.4, 0, 25.4),
      shedDoor: new THREE.Vector3(-80, 0, -47.4),
      shedKey: new THREE.Vector3(-80, 0, -52.8),
    },
    styleCam: { dist: 4.3, height: 1.6, look: 1.4 },
    setTime,
    parked(car) {
      car.parkCols = [1.2, -1.2].map((k) => world.circle(car.pos.x + Math.sin(car.yaw) * k, car.pos.z + Math.cos(car.yaw) * k, 1.0, { wall: false, tag: 'car' }));
    },
    unparked(car) {
      for (const c of car.parkCols || []) c.enabled = false;
    },
    openDoor(open) {
      doorTarget = open ? -1.7 : 0;
      doorCol.enabled = !open;
    },
    openShed() {
      shedTarget = -1.9;
      shedCol.enabled = false;
      lock.visible = false;
    },
    takeShedKey() {
      blueKey.visible = false;
      keyGlow.intensity = 0;
    },
    police(on) {
      policeGroup.visible = on;
    },
    update(dt, focus, camera) {
      const t = performance.now() / 1000;
      sky.update(t, camera);
      if (focus) {
        const d = sun.userData.dir || new THREE.Vector3(-0.4, 0.55, -0.75);
        sun.position.copy(focus.pos).addScaledVector(d, 70);
        sun.target.position.copy(focus.pos);
      }
      doorPivot.rotation.y += (doorTarget - doorPivot.rotation.y) * Math.min(1, dt * 3);
      shedPivot.rotation.y += (shedTarget - shedPivot.rotation.y) * Math.min(1, dt * 3);
      blueKey.rotation.y += dt * 2;
      const blink = Math.sin(t * 2.2) > 0.4;
      for (const b of chimneyLights) b.visible = blink;
      beacon.visible = !blink;
      if (policeGroup.visible) {
        policeLights.forEach((pl, k) => {
          const u = (t * 0.02 + k * 0.05) % 1;
          pl.position.set(-320 - u * 600, -205, 160 - u * 500);
          const on = Math.sin(t * 12 + k) > 0;
          pl.material.color.setRGB(on ? 0.3 : 6, on ? 0.6 : 0.3, on ? 6 : 0.3);
        });
      }
    },
  };
  setTime(time);
  return level;
}

function stripesTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#d8d8d8' : '#c0392b';
    g.fillRect(0, i * 32, 16, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Yiftach's obsession board: the friends' photos joined by red string.
function photoWall(game, ids) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6a45';
  g.fillRect(0, 0, 768, 512);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    g.fillRect(Math.random() * 768, Math.random() * 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spots = [
    [120, 140],
    [380, 110],
    [640, 150],
    [230, 360],
    [540, 370],
  ];
  const drawn = [];
  ids.forEach((id, i) => {
    const img = new Image();
    img.onload = () => {
      const [x, y] = spots[i];
      g.save();
      g.translate(x, y);
      g.rotate((Math.random() - 0.5) * 0.25);
      g.fillStyle = '#f4f1ea';
      g.fillRect(-78, -88, 156, 176);
      g.drawImage(img, -70, -80, 140, 140);
      g.fillStyle = '#c0392b';
      g.beginPath();
      g.arc(0, -86, 8, 0, Math.PI * 2);
      g.fill();
      g.restore();
      drawn.push([x, y]);
      g.strokeStyle = 'rgba(200,30,30,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      for (const [px, py] of drawn) g.lineTo(px, py - 86);
      g.stroke();
      if (id === 'ido') {
        g.strokeStyle = '#e74c3c';
        g.lineWidth = 7;
        g.beginPath();
        g.ellipse(x, y, 90, 100, 0, 0, Math.PI * 2);
        g.stroke();
      }
      tex.needsUpdate = true;
    };
    img.src = portraitOf(id, game.assets);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}
