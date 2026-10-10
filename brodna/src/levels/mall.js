import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { World } from '../world.js';
import { mat, worldBox, textSign, TEX, TREES } from '../env.js';
import { canvasTexture } from '../util.js';
import { Person, extraDef } from '../people.js';
import { rng } from '../util.js';

const LOWER = -5.6;
const LEFT_SHOPS = [
  ['אופטיקה', '#1d2433', '#8fd3ff'],
  ['נעליים', '#2a1f1a', '#ffd08a'],
  ['תכשיטים', '#191919', '#e9c46a'],
  ['סלולר', '#101a2a', '#6ec3ff'],
  ['פיצה', '#c8102e', '#ffd23f'],
  ['קפה', '#2b1d14', '#e6b980'],
  ['אופנה', '#141414', '#f2f2f2'],
  ['גלידה', '#ffd6e7', '#c2185b'],
];
const RIGHT_SHOPS = [
  ['ספרים', '#1f2a1d', '#b9e6a0'],
  ['צעצועים', '#ffe066', '#1d3557'],
  ['ספורט', '#111', '#ff6b35'],
  ['בשמים', '#2a1d2e', '#f5c6ff'],
  ['המבורגר', '#3d1f12', '#ffb703'],
  ['סושי', '#151515', '#ff4d4d'],
  ['טכנו', '#0d1b2a', '#4cc9f0'],
  ['מתנות', '#2d1e2f', '#ffd166'],
];

function poster(title, sub, colors, drawFig) {
  return canvasTexture(256, 384, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(1, colors[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.85)';
    drawFig(g, w, h);
    g.fillStyle = '#fff';
    g.font = '700 46px Karantina, Assistant, Arial';
    g.textAlign = 'center';
    g.fillText(title, w / 2, h - 58);
    g.font = '600 16px Assistant, Arial';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText(sub, w / 2, h - 30);
  });
}

export function buildMall(scene) {
  const world = new World(() => 0);
  const r = rng(77);
  const group = new THREE.Group();
  scene.add(group);

  // ---------- floors
  const floorMat = mat('tiles', { repeat: [1, 1], roughness: 0.22 });
  floorMat.map.repeat.set(1, 1);
  const upper = [];
  // galleries, plaza, entrance strip, bridges (all at y = 0)
  const slabs = [
    [4.5, -34, 11, 30],
    [-11, -34, -4.5, 30],
    [-11, 28, 11, 40],
    [-11, -34, 11, -30],
    [-4.5, -14, 4.5, -10],
    [-4.5, 8, 4.5, 12],
  ];
  for (const [x0, z0, x1, z1] of slabs) {
    const g = worldBox(x1 - x0, 0.4, z1 - z0, 4);
    g.translate((x0 + x1) / 2, -0.2, (z0 + z1) / 2);
    upper.push(g);
  }
  const floor = new THREE.Mesh(mergeGeometries(upper), floorMat);
  floor.receiveShadow = true;
  group.add(floor);
  const lowerFloor = new THREE.Mesh(worldBox(30, 0.4, 80, 4).translate(0, LOWER - 0.2, 3), floorMat);
  lowerFloor.receiveShadow = true;
  group.add(lowerFloor);
  // slab edges (white fascia) around the atrium
  const fascia = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.5 });
  const edges = [];
  for (const [x0, z0, x1, z1] of [
    [4.5, -30, 4.7, 28],
    [-4.7, -30, -4.5, 28],
    [-4.5, -30.2, 4.5, -30],
    [-4.5, 28, 4.5, 28.2],
  ]) {
    edges.push(worldBox(x1 - x0, 1.2, z1 - z0, 4).translate((x0 + x1) / 2, -0.6, (z0 + z1) / 2));
  }
  for (const z of [-12, 10]) edges.push(worldBox(9, 1.0, 4, 4).translate(0, -0.7, z));
  group.add(new THREE.Mesh(mergeGeometries(edges), fascia));

  // ---------- ceiling with skylights
  const ceil = new THREE.Mesh(worldBox(22.4, 0.3, 76, 4).translate(0, 6.35, 3), new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.8 }));
  group.add(ceil);
  const sky = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 5 });
  const skyGeos = [];
  const beamGeos = [];
  for (let z = -28; z <= 26; z += 6) {
    skyGeos.push(new THREE.BoxGeometry(8.4, 0.05, 5.2).translate(0, 6.18, z));
    beamGeos.push(new THREE.BoxGeometry(9.2, 0.35, 0.3).translate(0, 6.0, z + 3));
  }
  for (const x of [-4.1, 4.1]) beamGeos.push(new THREE.BoxGeometry(0.3, 0.35, 60).translate(x, 6.0, -1));
  group.add(new THREE.Mesh(mergeGeometries(skyGeos), sky));
  group.add(new THREE.Mesh(mergeGeometries(beamGeos), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.3 })));
  // ceiling downlights over galleries
  const dl = [];
  for (let z = -32; z <= 38; z += 4) for (const x of [-8, 8]) dl.push(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12).translate(x, 6.18, z));
  group.add(new THREE.Mesh(mergeGeometries(dl), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.9) })));

  // ---------- glass railings
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const rail = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.8 });
  const glassGeos = [];
  const railGeos = [];
  const runs = [];
  const sideRun = (x) => [
    [x, -30, x, -14],
    [x, -10, x, 8],
    [x, 12, x, 28],
  ];
  runs.push(...sideRun(4.55), ...sideRun(-4.55));
  runs.push([-4.5, -30, 4.5, -30], [-4.5, 28, 4.5, 28]);
  // bridge side rails
  runs.push([-4.5, -14, 4.5, -14], [-4.5, -10, 4.5, -10], [-4.5, 8, 4.5, 8], [-4.5, 12, 4.5, 12]);
  for (const [x0, z0, x1, z1] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongZ = Math.abs(z1 - z0) > Math.abs(x1 - x0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const gw = alongZ ? 0.03 : len;
    const gd = alongZ ? len : 0.03;
    glassGeos.push(new THREE.BoxGeometry(gw, 1.0, gd).translate(cx, 0.55, cz));
    railGeos.push(new THREE.BoxGeometry(alongZ ? 0.08 : len, 0.06, alongZ ? len : 0.08).translate(cx, 1.1, cz));
    world.box(cx - (alongZ ? 0.15 : len / 2), cz - (alongZ ? len / 2 : 0.15), cx + (alongZ ? 0.15 : len / 2), cz + (alongZ ? len / 2 : 0.15), { wall: false, y0: 0, y1: 1.2 });
  }
  group.add(new THREE.Mesh(mergeGeometries(glassGeos), glass));
  const railMesh = new THREE.Mesh(mergeGeometries(railGeos), rail);
  railMesh.castShadow = true;
  group.add(railMesh);

  // ---------- pillars
  const pillarGeos = [];
  for (let z = -24; z <= 24; z += 12)
    for (const x of [-5.4, 5.4]) {
      pillarGeos.push(new THREE.CylinderGeometry(0.42, 0.42, 12, 18).translate(x, 0.4, z));
      world.circle(x, z, 0.5, { wall: true });
    }
  const pillars = new THREE.Mesh(mergeGeometries(pillarGeos), new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.35 }));
  pillars.castShadow = true;
  group.add(pillars);

  // ---------- shop fronts (upper and lower floors)
  // shop windows: tinted glass you can see the lit shop through
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c4, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
  const shopFloorGeos = [];
  for (const [side, y] of [[1, 0], [-1, 0]]) shopFloorGeos.push(worldBox(4.2, 0.2, 60.3, 3).translate(side * 13.1, y - 0.1, -3.85));
  const shopFloor = new THREE.Mesh(mergeGeometries(shopFloorGeos), new THREE.MeshStandardMaterial({ map: TEX.wood(), roughness: 0.55, color: 0xd9c3a5 }));
  shopFloor.receiveShadow = true;
  group.add(shopFloor);
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.6 });
  const shopGlass = [];
  const shopFrame = [];
  const shopGlow = [];
  const addShops = (list, side, y) => {
    list.forEach(([name, bg, fg], i) => {
      const z0 = -34 + i * 8.6;
      const zc = z0 + 4.3;
      const x = side * 11;
      shopGlass.push(new THREE.BoxGeometry(0.08, 3.4, 7.6).translate(x, y + 1.7, zc));
      shopFrame.push(new THREE.BoxGeometry(0.3, 4.6, 0.5).translate(x, y + 2.3, z0 + 0.25));
      shopFrame.push(new THREE.BoxGeometry(0.4, 0.5, 8.6).translate(x + side * 0.05, y + 3.6, zc));
      shopGlow.push(new THREE.BoxGeometry(0.05, 3.0, 7.0).translate(x + side * 3.5, y + 1.6, zc));
      shopGlow.push(new THREE.BoxGeometry(2.6, 0.05, 0.25).translate(x + side * 1.9, y + 3.3, zc - 1.8), new THREE.BoxGeometry(2.6, 0.05, 0.25).translate(x + side * 1.9, y + 3.3, zc + 1.8));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.95), new THREE.MeshBasicMaterial({ map: textSign(name, { bg, fg, font: '800 84px Assistant, Arial' }), toneMapped: false }));
      sign.position.set(x - side * 0.22, y + 3.62, zc);
      sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(sign);
      // a few lit shelves behind the glass
      for (let k = 0; k < 3; k++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4 + r() * 0.8, 0.9), new THREE.MeshStandardMaterial({ color: new THREE.Color(fg).multiplyScalar(0.5), roughness: 0.6 }));
        shelf.position.set(x + side * (1.4 + r() * 1.6), y + 0.7, zc - 2.5 + k * 2.5);
        group.add(shelf);
      }
    });
    world.box(side > 0 ? 11 : -12, -34, side > 0 ? 12 : -11, 26.3, { wall: true });
  };
  addShops(LEFT_SHOPS.slice(0, 7), 1, 0);
  addShops(RIGHT_SHOPS.slice(0, 7), -1, 0);
  addShops(RIGHT_SHOPS.slice(1), 1, LOWER);
  addShops(LEFT_SHOPS.slice(1), -1, LOWER);
  // plaza side walls (the left one holds the parking exit)
  const plazaWall = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6 });
  for (const s of [1, -1]) {
    group.add(new THREE.Mesh(worldBox(0.3, 6.4, 14.2, 4).translate(s * 11.15, 3.0, 33.2), plazaWall));
    world.box(s > 0 ? 11 : -12, 26, s > 0 ? 12 : -11, 41, { wall: true });
  }
  const glassFronts = new THREE.Mesh(mergeGeometries(shopGlass), dark);
  glassFronts.renderOrder = 1;
  group.add(glassFronts);
  group.add(new THREE.Mesh(mergeGeometries(shopFrame), frame));
  group.add(new THREE.Mesh(mergeGeometries(shopGlow), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1d8, emissiveIntensity: 0.9 })));
  // back walls behind shops
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(worldBox(0.3, 12, 76, 4).translate(s * 15.2, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 }));
    group.add(w);
  }

  // ---------- end walls: entrance glass and the cinema
  const entr = new THREE.Mesh(new THREE.BoxGeometry(22, 6.2, 0.2).translate(0, 3.1, -34.1), new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.05, transparent: true, opacity: 0.35, metalness: 0.3 }));
  group.add(entr);
  world.box(-12, -35, 12, -34, { wall: true });
  const cinemaWall = new THREE.Mesh(worldBox(22.4, 12, 0.6, 4).translate(0, 0.4, 40.3), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.7 }));
  group.add(cinemaWall);
  world.box(-12, 40, 12, 41, { wall: true });
  const cinemaSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: textSign('קולנוע', { w: 1024, h: 192, bg: '#14161c', fg: '#ff4d6d', font: '700 150px Karantina, Assistant, Arial' }), toneMapped: false }));
  cinemaSign.position.set(0, 4.6, 39.95);
  cinemaSign.rotation.y = Math.PI;
  group.add(cinemaSign);
  // marquee bulbs
  const bulbs = [];
  for (let i = 0; i <= 30; i++) {
    const x = -4.8 + (i / 30) * 9.6;
    bulbs.push(new THREE.SphereGeometry(0.07, 6, 5).translate(x, 5.55, 39.9), new THREE.SphereGeometry(0.07, 6, 5).translate(x, 3.65, 39.9));
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 5.4, 2.6) });
  group.add(new THREE.Mesh(mergeGeometries(bulbs), bulbMat));
  // doors
  const door = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.1).translate(0, 1.5, 39.95), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, emissive: 0x2a0c12, emissiveIntensity: 0.8, roughness: 0.3 }));
  group.add(door);
  // posters
  const posters = [
    poster('הדוקטור', 'בקרוב בקולנוע', ['#2b0f12', '#000'], (g, w, h) => {
      g.beginPath();
      g.ellipse(w / 2, 120, 34, 40, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e9e6dd';
      g.beginPath();
      g.moveTo(w / 2 - 70, 330);
      g.lineTo(w / 2 - 50, 170);
      g.lineTo(w / 2 + 50, 170);
      g.lineTo(w / 2 + 70, 330);
      g.fill();
    }),
    poster('לילה בקציר', 'מותחן', ['#0d1b3a', '#000'], (g, w) => {
      g.fillStyle = '#f2e9c9';
      g.beginPath();
      g.arc(w / 2 + 50, 90, 30, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#000';
      for (let i = 0; i < 6; i++) g.fillRect(20 + i * 38, 200 - (i % 3) * 30, 30, 140 + (i % 3) * 30);
    }),
    poster('ברודנה', 'הסרט', ['#4a2c00', '#120800'], (g, w) => {
      g.fillStyle = '#ffcc4d';
      g.font = '700 150px Karantina, Arial';
      g.textAlign = 'center';
      g.fillText('?', w / 2, 230);
    }),
    poster('מצפה דור', 'דרמה', ['#2a1b3d', '#090510'], (g, w) => {
      g.strokeStyle = '#ff9f43';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(10, 260);
      g.lineTo(80, 180);
      g.lineTo(140, 230);
      g.lineTo(200, 150);
      g.lineTo(250, 210);
      g.stroke();
    }),
  ];
  posters.forEach((tex, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const x = i < 2 ? -9.5 + i * 2.1 : 5.4 + (i - 2) * 2.1;
    p.position.set(x, 1.9, 39.95);
    p.rotation.y = Math.PI;
    group.add(p);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8) }));
    fr.position.set(x, 1.9, 39.97);
    fr.rotation.y = Math.PI;
    group.add(fr);
  });
  // parking exit door on the plaza's side wall
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: textSign('חניון ⟵', { w: 512, h: 110, bg: '#0b5d2e', fg: '#fff', font: '700 64px Assistant, Arial' }), toneMapped: false }));
  exitSign.position.set(10.85, 3.0, 34.5);
  exitSign.rotation.y = -Math.PI / 2;
  group.add(exitSign);
  const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 2.2).translate(10.95, 1.3, 34.5), new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.1, metalness: 0.4, emissive: 0x18301f, emissiveIntensity: 0.6 }));
  group.add(exitDoor);

  // ---------- furniture: kiosks, benches, planters
  const furn = [];
  const kiosk = (x, z, w, d) => {
    furn.push(new THREE.BoxGeometry(w, 1.1, d).translate(x, 0.55, z));
    world.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { wall: false, y0: 0, y1: 1.2 });
  };
  kiosk(8.2, -6, 1.6, 3.2);
  kiosk(-8.2, 2, 1.6, 3.2);
  kiosk(-6.5, 33, 3.2, 1.6);
  group.add(new THREE.Mesh(mergeGeometries(furn), new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.5 })));
  const planterGeos = [];
  const plantSpots = [
    [9.8, -20],
    [9.8, 16],
    [-9.8, -22],
    [-9.8, 20],
    [6, 30],
    [-6, 30],
  ];
  for (const [x, z] of plantSpots) {
    planterGeos.push(new THREE.CylinderGeometry(0.55, 0.45, 0.8, 14).translate(x, 0.4, z));
    world.circle(x, z, 0.6);
  }
  group.add(new THREE.Mesh(mergeGeometries(planterGeos), new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.4 })));
  const plantGeo = TREES.bush();
  const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  for (const [x, z] of plantSpots) {
    const p = new THREE.Mesh(plantGeo, plantMat);
    p.position.set(x, 0.7, z);
    p.scale.setScalar(0.7);
    group.add(p);
  }

  // ---------- lighting
  const hemi = new THREE.HemisphereLight(0xf4f6ff, 0x8a7f74, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e6, 1.4);
  sun.position.set(6, 30, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -18;
  sc.right = sc.top = 18;
  sc.near = 1;
  sc.far = 70;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  const warm = new THREE.PointLight(0xff9a6a, 25, 18, 1.6);
  warm.position.set(0, 4, 36);
  scene.add(warm);

  // ---------- shoppers
  const extras = [];
  const routes = [
    [[7, -30], [7, 26]],
    [[9, 24], [9, -28]],
    [[-7, -28], [-7, 24]],
    [[-9, 22], [-9, -30]],
    [[-6, 31], [6, 36]],
    [[0, -11.5], [0, -12.5]],
  ];
  for (let i = 0; i < 9; i++) {
    const p = new Person(extraDef(i, r));
    const route = routes[i % routes.length];
    const a = route[0];
    p.place(a[0] + (r() - 0.5) * 1.5, 0, a[1] + (r() - 0.5) * 6, 0);
    p.route = route;
    p.leg = 1;
    scene.add(p.group);
    extras.push(p);
  }
  // lower floor crowd
  for (let i = 0; i < 5; i++) {
    const p = new Person(extraDef(20 + i, r));
    p.place((r() - 0.5) * 7, LOWER, -26 + i * 11, 0);
    p.route = [[(r() - 0.5) * 7, -26], [(r() - 0.5) * 7, 24]];
    p.leg = i % 2;
    p.lower = true;
    scene.add(p.group);
    extras.push(p);
  }

  function update(dt, player) {
    for (const p of extras) {
      if (!p.goal) {
        const t = p.route[p.leg];
        p.leg = 1 - p.leg;
        p.walkTo(t[0], t[1], { speed: 1.2 + (p.id.length % 3) * 0.15 });
      }
      p.ai(dt, p.lower ? null : world);
      if (p.lower) p.pos.y = LOWER;
      p.animate(dt);
    }
    if (player) {
      sun.position.set(player.pos.x + 6, 30, player.pos.z - 8);
      sun.target.position.set(player.pos.x, 0, player.pos.z);
    }
    const b = 1 + Math.sin(performance.now() * 0.006) * 0.35;
    bulbMat.color.setRGB(7 * b, 5.4 * b, 2.6 * b);
  }

  return {
    world,
    group,
    extras,
    lights: [hemi, sun, warm],
    update,
    points: {
      start: new THREE.Vector3(8, 0, -29),
      idoStart: new THREE.Vector3(9.4, 0, -28),
      pizza: new THREE.Vector3(10.1, 0, 4.7),
      meet: new THREE.Vector3(8, 0, 1.5),
      cinema: new THREE.Vector3(0, 0, 37.6),
      exit: new THREE.Vector3(10.2, 0, 34.5),
    },
    styleCam: { dist: 4.2, height: 1.6, look: 1.4 },
    // a bright interior: only real light sources (marquee bulbs, skylights) may glow
    post: { strength: 0.3, radius: 0.4, threshold: 4.2, exposure: 0.95 },
    envIntensity: 1,
    background: '#d8dde3',
  };
}
