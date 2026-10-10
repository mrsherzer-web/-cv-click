import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { World } from '../world.js';
import { mat, worldBox, textSign, TEX } from '../env.js';
import { portraitOf } from '../cast.js';

const H = 2.6;
// [x0, z0, x1, z1] wall rectangles (0.4 m thick)
const WALLS = [
  // corridor
  [-2.0, -24.4, -1.6, -6],
  [1.6, -24.4, 2.0, -6],
  [-2.0, -24.6, 2.0, -24.2],
  // junction
  [-4.2, -6.2, -1.6, -5.8],
  [1.6, -6.2, 4.2, -5.8],
  [-4.2, 1.8, 4.2, 2.2],
  // shared walls with doorways at z in [-3.2, -0.8]
  [-4.2, -8.2, -3.8, -3.2],
  [-4.2, -0.8, -3.8, 8.2],
  [3.8, -8.2, 4.2, -3.2],
  [3.8, -0.8, 4.2, 12.2],
  // room A
  [-18.2, -8.2, -17.8, 8.2],
  [-18.2, 7.8, -4.2, 8.2],
  [-18.2, -8.2, -4.2, -7.8],
  // room B (two lanes split by a wall with a gap at the east end)
  [21.8, -8.2, 22.2, 12.2],
  [4.2, 11.8, 21.8, 12.2],
  [4.2, -8.2, 21.8, -7.8],
  [4.2, 1.8, 17.8, 2.2],
];
const CRATES = [
  [-11, -2, 1.4, 1.4],
  [-7.2, 2.6, 1.2, 1.2],
  [-16.2, 0.4, 1.2, 2.2],
  [-7.5, -6.2, 1.4, 1.0],
  [-2.8, 0.6, 1.0, 1.0],
  [10.5, -6.6, 1.2, 1.0],
  [19.8, 10.6, 1.2, 1.2],
];

function photoBoard(game) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#7a5a3a';
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#f4f1ea';
  g.font = '700 54px Karantina, Assistant, Arial';
  g.textAlign = 'center';
  g.fillText('התוכנית', 512, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ids = ['dolev', 'yahli', 'ido', 'yonati', 'avraham'];
  const spots = [
    [150, 200],
    [380, 330],
    [520, 190],
    [700, 340],
    [880, 210],
  ];
  const done = [];
  ids.forEach((id, i) => {
    const img = new Image();
    img.onload = () => {
      const [x, y] = spots[i];
      g.save();
      g.translate(x, y);
      g.rotate((i % 2 ? 1 : -1) * 0.08);
      g.fillStyle = '#f4f1ea';
      g.fillRect(-80, -92, 160, 184);
      g.drawImage(img, -72, -84, 144, 144);
      if (id === 'yonati' || id === 'avraham') {
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.font = '700 30px Assistant, Arial';
        g.fillText('?', 0, 84);
      } else {
        g.strokeStyle = '#d62828';
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(-60, -70);
        g.lineTo(60, 50);
        g.moveTo(60, -70);
        g.lineTo(-60, 50);
        g.stroke();
      }
      g.restore();
      done.push([x, y]);
      g.strokeStyle = 'rgba(210,30,30,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      done.forEach(([px, py], k) => (k ? g.lineTo(px, py - 92) : g.moveTo(px, py - 92)));
      g.stroke();
      tex.needsUpdate = true;
    };
    img.src = portraitOf(id, game.assets);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

export function buildBunker(scene, opts, game) {
  const world = new World(() => 0);
  const floorMat = mat('concrete', { roughness: 0.85 });
  floorMat.color.set(0x8a8780);
  const floorGeos = [];
  for (const [x0, z0, x1, z1] of [
    [-2, -25, 2, -6],
    [-4.2, -6.2, 4.2, 2.2],
    [-18.2, -8.2, -4, 8.2],
    [4, -8.2, 22.2, 12.2],
  ])
    floorGeos.push(worldBox(x1 - x0, 0.2, z1 - z0, 4).translate((x0 + x1) / 2, -0.1, (z0 + z1) / 2));
  const floor = new THREE.Mesh(mergeGeometries(floorGeos), floorMat);
  floor.receiveShadow = true;
  scene.add(floor);
  // packed earth around the rooms, so the top-down camera never looks into a void
  const earthMat = mat('stone', { roughness: 1, repeat: [14, 14], color: 0x2a251f });
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), earthMat);
  earth.position.set(2, -0.25, -6);
  earth.receiveShadow = true;
  scene.add(earth);
  const wallMat = mat('concrete', { roughness: 0.9 });
  const wallGeos = WALLS.map(([x0, z0, x1, z1]) => {
    world.box(x0, z0, x1, z1, { wall: true });
    return worldBox(x1 - x0, H, z1 - z0, 3).translate((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
  });
  const walls = new THREE.Mesh(mergeGeometries(wallGeos), wallMat);
  walls.castShadow = true;
  walls.receiveShadow = true;
  scene.add(walls);
  // pipes along the corridor
  const pipeGeos = [];
  for (const x of [-1.45, 1.45]) pipeGeos.push(new THREE.CylinderGeometry(0.07, 0.07, 18, 8).rotateX(Math.PI / 2).translate(x, 2.2, -15));
  scene.add(new THREE.Mesh(mergeGeometries(pipeGeos), new THREE.MeshStandardMaterial({ color: 0x5b6066, metalness: 0.7, roughness: 0.4 })));
  // crates (cover)
  const crateMat = new THREE.MeshStandardMaterial({ map: TEX.wood(), roughness: 0.8 });
  const crateGeos = CRATES.map(([x, z, w, d]) => {
    world.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { wall: true, y1: 1.4 });
    return worldBox(w, 1.4, d, 1.4).translate(x, 0.7, z);
  });
  const crates = new THREE.Mesh(mergeGeometries(crateGeos), crateMat);
  crates.castShadow = true;
  crates.receiveShadow = true;
  scene.add(crates);
  // desk with the gold key, and the obsession board
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.0), new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.6 }));
  desk.position.set(-15.4, 0.43, -6.6);
  desk.castShadow = true;
  scene.add(desk);
  world.box(-16.5, -7.2, -14.3, -6.1, { wall: false, y1: 0.9 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc4d, emissive: 0xb07a00, emissiveIntensity: 1.6, metalness: 0.8, roughness: 0.3 });
  const goldKey = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), goldMat);
  goldKey.position.set(-15.2, 0.98, -6.5);
  scene.add(goldKey);
  const goldGlow = new THREE.PointLight(0xffc04d, 4, 4, 2);
  goldGlow.position.set(-15.2, 1.4, -6.2);
  scene.add(goldGlow);
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x4fa3ff, emissiveIntensity: 0.9 }));
  monitor.position.set(-15.9, 1.15, -6.9);
  scene.add(monitor);
  const board = photoBoard(game);
  board.position.set(-11, 1.6, 7.75);
  board.rotation.y = Math.PI;
  scene.add(board);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: textSign('אין כניסה', { bg: '#7a0f0f', fg: '#fff' }), toneMapped: false }));
  sign.position.set(3.75, 2.1, -2);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);
  // Room B door: blocks the player until the gold key opens it
  const doorPivot = new THREE.Group();
  doorPivot.position.set(4, 0, -3.2);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 2.4), new THREE.MeshStandardMaterial({ map: TEX.rust(), metalness: 0.6, roughness: 0.5 }));
  doorMesh.position.set(0, 1.15, 1.2);
  doorPivot.add(doorMesh);
  scene.add(doorPivot);
  const doorCol = world.box(3.8, -3.2, 4.2, -0.8, { wall: true, tag: 'doorB' });
  // the back room door in Room B's west wall: Yiftach bursts out of it when Ido is freed
  const backPivot = new THREE.Group();
  backPivot.position.set(4.22, 0, 9.4);
  const backDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 1.9), new THREE.MeshStandardMaterial({ map: TEX.rust(), metalness: 0.6, roughness: 0.5 }));
  backDoor.position.set(0, 1.15, 0.95);
  backPivot.add(backDoor);
  scene.add(backPivot);
  const backDark = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), new THREE.MeshBasicMaterial({ color: 0x010101 }));
  backDark.position.set(4.19, 1.15, 10.35);
  backDark.rotation.y = Math.PI / 2;
  scene.add(backDark);
  let backTarget = 0;
  // chairs for the prisoners
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.4 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.9 });

  // lights
  const hemi = new THREE.HemisphereLight(0x5a6478, 0x141210, 0.75);
  scene.add(hemi);
  const lamps = [
    [-11, 2.4, 0, 0xffb36b, 7],
    [0, 2.4, -2, 0xffd59a, 5],
    [0, 2.4, -16, 0xffd59a, 4],
    [13, 2.4, -3, 0xff6b5b, 5],
    [13, 2.4, 7, 0xff6b5b, 5],
  ];
  const bulbGeos = [];
  const lampLights = [];
  for (const [x, y, z, color, i] of lamps) {
    const l = new THREE.PointLight(color, i, 12, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    lampLights.push(l);
    bulbGeos.push(new THREE.SphereGeometry(0.12, 8, 6).translate(x, y + 0.05, z));
  }
  scene.add(new THREE.Mesh(mergeGeometries(bulbGeos), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.3) })));
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x05060a, 0.02);
  let alarmOn = false;

  const route = [
    { x: 0, z: -2, wait: 1.0, look: [Math.PI / 2, -Math.PI / 2] },
    { x: -6, z: -2 },
    { x: -10, z: 1, wait: 1.8, look: [Math.PI, -Math.PI / 2, 0] },
    { x: -14.6, z: 2.6, wait: 1.2, look: [0, Math.PI] },
    { x: -10, z: -4.4, wait: 0.8, look: [Math.PI / 2] },
    { x: -5, z: -2 },
    { x: 0, z: -2 },
    { x: 6, z: -2 },
    { x: 16, z: -3, wait: 1.2, look: [Math.PI / 2, 0] },
    { x: 20, z: 0 },
    { x: 20, z: 5 },
    { x: 13, z: 7, wait: 1.8, look: [-Math.PI / 2, 0, Math.PI] },
    { x: 20, z: 5 },
    { x: 20, z: 0 },
    { x: 8, z: -2 },
    { x: 2, z: -2 },
  ];

  return {
    world,
    ambience: 'bunker',
    surface: 'hard',
    styleCam: { dist: 5.6, height: 3.4, look: 1.0, minPitch: 0.75, maxPitch: 1.25, collide: false },
    lasers: [
      { a: [10, -7.8], b: [10, -2.6] },
      { a: [14, 2.2], b: [14, 11.8], period: 2.6 },
      { a: [9, 2.2], b: [9, 6.2] },
    ],
    plates: [
      { x: 13.2, z: -0.4, w: 1.6, d: 1.6 },
      { x: 13.2, z: -5.6, w: 1.6, d: 1.6 },
      { x: 11.2, z: 9.6, w: 1.6, d: 1.6 },
      { x: 6.8, z: 4.6, w: 1.6, d: 1.6 },
    ],
    chasePath: [
      { x: 6.5, z: 8.6 },
      { x: 13, z: 7 },
      { x: 20, z: 5 },
      { x: 20, z: 0 },
      { x: 12, z: -2 },
      { x: 6, z: -2 },
      { x: 0, z: -2 },
      { x: 0, z: -10 },
      { x: 0, z: -18 },
      { x: 0, z: -23 },
    ],
    points: {
      start: { x: 0, z: -22, yaw: 0 },
      exit: new THREE.Vector3(0, 0, -23),
      patrol: route,
      yahli: new THREE.Vector3(-14.4, 0, 4.6),
      yahliYaw: Math.PI,
      dolev: new THREE.Vector3(-8.6, 0, 5.6),
      dolevYaw: Math.PI * 0.85,
      ido: new THREE.Vector3(6.6, 0, 8.6),
      idoYaw: Math.PI / 2,
      goldKey: new THREE.Vector3(-15.2, 0, -5.4),
      doorB: new THREE.Vector3(3.0, 0, -2),
      checkpointB: { x: 5.2, z: -2, yaw: Math.PI / 2 },
      escape: { x: 0, z: -4 },
      chaseStart: { x: 12, z: -2 },
    },
    chairs(people) {
      for (const p of people) {
        const g = mergeGeometries([
          new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.46, 0),
          new THREE.BoxGeometry(0.5, 0.6, 0.06).translate(0, 0.78, -0.24),
          ...[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([x, z]) => new THREE.BoxGeometry(0.05, 0.46, 0.05).translate(x, 0.23, z)),
        ]);
        const chair = new THREE.Mesh(g, chairMat);
        chair.position.copy(p.pos);
        chair.rotation.y = p.yaw;
        chair.position.z -= Math.cos(p.yaw) * 0.12;
        chair.position.x -= Math.sin(p.yaw) * 0.12;
        chair.castShadow = true;
        scene.add(chair);
        const rope = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), ropeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(chair.position.x, 0.95, chair.position.z);
        scene.add(rope);
        p.rope = rope;
        world.circle(p.pos.x, p.pos.z, 0.4, { wall: false });
      }
    },
    inRoomB(pos) {
      return pos.x > 4.2;
    },
    takeGoldKey() {
      goldKey.visible = false;
      goldGlow.intensity = 0;
    },
    openDoorB() {
      doorCol.enabled = false;
      this.doorBOpen = true;
    },
    doorBOpen: false,
    alarm(on) {
      alarmOn = on;
    },
    openBackDoor() {
      backTarget = 1.9;
    },
    backDoor: { x: 4.75, z: 10.35 },
    update(dt, focus, camera, story) {
      // Yiftach has his own key: the door swings open for him and shuts behind him
      const yif = story.ch('yiftach');
      const forHim = story.inScene.has(yif) && Math.hypot(yif.pos.x - 4, yif.pos.z + 2) < 2.6;
      const doorTarget = this.doorBOpen || forHim ? -1.6 : 0;
      doorPivot.rotation.y += (doorTarget - doorPivot.rotation.y) * Math.min(1, dt * 4);
      backPivot.rotation.y += (backTarget - backPivot.rotation.y) * Math.min(1, dt * 9);
      goldKey.rotation.y += dt * 2;
      const t = performance.now() / 1000;
      lampLights[0].intensity = 7 * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 3.1));
      if (alarmOn) {
        const on = Math.sin(t * 8) > 0;
        for (const l of lampLights) l.color.set(on ? 0xff2020 : 0x330000);
      }
      for (const p of story.inScene) if (p.rope) p.rope.visible = p.pose === 'tied';
    },
  };
}
