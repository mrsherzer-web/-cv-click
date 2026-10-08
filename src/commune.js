// The commune apartment in Dimona, rebuilt from the videos:
//  - roof terrace with the black leather sofa, pallets, solar water heaters and the city below
//  - the battered grey entrance door with the wheelchair sign
//  - entry with the tool table, kitchen (fridge, washing machine, white stove, dark cabinets)
//  - dining table + the DIMONA DEMONS mural, living room with grey sofa, TV + console, OSB board
//  - hallway (fire extinguisher, electrical panel, "כן יעשה" sign), boys' room with bunk beds
//    and Israeli flags, "the other room", bathroom with shower, plus storage rooms.
import * as THREE from 'three';
import * as T from './textures.js';
import { WALL_H } from './level.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { audio } from './audio.js';

export const LAYOUT = {
  minX: -3.5, minZ: -7.5, maxX: 20.5, maxZ: 17.5,
};

export function buildCommune(world, quality) {
  const M = world.mats;
  const S = (p) => new THREE.MeshStandardMaterial(p);
  const ft = T.floorTile();
  M.floor = S({ map: ft.map, bumpMap: ft.bump, bumpScale: 1.2, roughness: 0.16, metalness: 0.0 });
  M.wall = S({ map: T.wallPaint(), roughness: 0.93 });
  M.wallGirls = S({ map: T.wallPaint('#e8d9d6', 8), roughness: 0.93 });
  M.wallGrey = S({ map: T.wallPaint('#5d6166', 9), roughness: 0.9 });
  M.ext = S({ map: T.wallPaint('#cdbfa6', 10), roughness: 0.97 });
  M.ceil = S({ map: T.ceilingTex(), roughness: 1 });
  M.bathWall = S({ map: T.bathWallTile(), roughness: 0.3 });
  M.bathFloor = S({ map: T.marbleFloor(), roughness: 0.22 });
  M.terrace = S({ map: T.terraceTile(), roughness: 0.95 });
  M.concrete = S({ map: T.concreteTex(), roughness: 1 });
  M.woodDark = S({ map: T.woodTex('#3a2a22', '#140a05', 61, 1), roughness: 0.55 });
  M.woodLight = S({ map: T.woodTex('#b58654', '#6d4a28', 62, 1), roughness: 0.6 });
  M.wardrobe = S({ map: T.woodTex('#4b3b31', '#22160e', 63, 1.2), roughness: 0.6 });
  M.osb = S({ map: T.osbTex(), roughness: 0.95 });
  M.cabinet = S({ color: '#3b3e42', roughness: 0.55 });
  M.granite = S({ color: '#121212', roughness: 0.22 });
  M.white = S({ color: '#e7e9ea', roughness: 0.35 });
  M.plastic = S({ color: '#f1f1ee', roughness: 0.5 });
  M.fabric = S({ color: '#5b5e63', roughness: 1 });
  M.fabricDark = S({ color: '#46494d', roughness: 1 });
  M.leather = S({ color: '#121213', roughness: 0.42 });
  M.metalBlack = S({ color: '#1b1b1d', roughness: 0.45, metalness: 0.6 });
  M.chrome = S({ color: '#cfcfcf', roughness: 0.22, metalness: 0.95 });
  M.steel = S({ color: '#9b9ea2', roughness: 0.3, metalness: 0.85 });
  M.mattress = S({ color: '#223159', roughness: 0.9 });
  M.blanketArmy = S({ color: '#4a5631', roughness: 1 });
  M.blanketPink = S({ color: '#c98ea0', roughness: 1 });
  M.blanketGrey = S({ color: '#6f6a66', roughness: 1 });
  M.pillow = S({ color: '#d9d6cf', roughness: 1 });
  M.red = S({ color: '#b3121a', roughness: 0.5 });
  M.yellow = S({ color: '#f2c300', roughness: 0.6 });
  M.green = S({ color: '#2e7d32', roughness: 0.7 });
  M.blue = S({ color: '#2a5bd7', roughness: 0.6 });
  M.black = S({ color: '#0d0d0e', roughness: 0.6 });
  M.cardboard = S({ color: '#9c7a4f', roughness: 1 });
  M.doorWhite = S({ map: T.whiteDoorTex(), roughness: 0.6 });
  M.doorMetal = S({ map: T.metalDoorTex(), roughness: 0.55, metalness: 0.3 });
  M.palletWood = S({ map: T.woodTex('#9c8462', '#5e4b33', 64, 0.8), roughness: 1 });
  M.towel = S({ color: '#d9c3a6', roughness: 1 });
  M.ceil.userData.noShadow = false;

  const P = Math.PI;

  // ================= ROOMS (order matters for roomAt) =================
  world.addRoom('shed', 'מחסן הגג', 16.5, -7, 20, -4.5, { outdoor: false });
  world.addRoom('stairs', 'חדר המדרגות', -3.5, -3.2, 0, 0, { outdoor: false });
  world.addRoom('terrace', 'המרפסת', 0, -7, 20, 0, { outdoor: true });
  world.addRoom('entry', 'הכניסה', 0, 0, 4, 4);
  world.addRoom('kitchen', 'המטבח', 0, 4, 5, 9);
  world.addRoom('dining', 'פינת האוכל', 4, 0, 12.6, 9);
  world.addRoom('living', 'הסלון', 12.6, 0, 20, 9);
  world.addRoom('hallway', 'המסדרון', 3, 9, 20, 10.8);
  world.addRoom('girls', 'חדר הבנות', 0, 9, 3, 17);
  world.addRoom('myroom', 'החדר שלך', 3, 10.8, 8, 17);
  world.addRoom('boys', 'חדר הבנים', 8, 10.8, 13.5, 17);
  world.addRoom('bath', 'השירותים', 13.5, 10.8, 17, 17);
  world.addRoom('storage', 'המחסן', 17, 10.8, 20, 17);
  world.bounds = { minX: LAYOUT.minX, minZ: LAYOUT.minZ, maxX: LAYOUT.maxX, maxZ: LAYOUT.maxZ };

  // ================= FLOORS / CEILING / ROOF =================
  world.plane(0, 0, 20, 10.8, 0, M.floor);
  world.plane(0, 10.8, 13.5, 17, 0, M.floor);
  world.plane(13.5, 10.8, 17, 17, 0.005, M.bathFloor);
  world.plane(17, 10.8, 20, 17, 0, M.floor);
  world.plane(0, 0, 20, 17, WALL_H, M.ceil, true);
  // roof slab: front faces cast shadows so the moon can't leak along the wall/ceiling seams
  M.roof = M.concrete.clone(); M.roof.shadowSide = THREE.FrontSide;
  world.staticBox(10, WALL_H, 8.5, 20.4, 0.3, 17.4, M.roof, { collide: false });
  world.plane(-3.5, -7.5, 20.5, 0, -0.01, M.terrace);
  // drop beyond the parapet
  world.plane(-80, -80, 100, 100, -14, M.concrete);

  // ================= OUTER WALLS =================
  const winOps = (a, b, bottom = 0.95, top = 2.15) => ({ a, b, bottom, top });
  // North facade (terrace side): entrance door + living room windows
  world.wall('x', 0, 0, 20, { matA: M.ext, matB: M.wall, openings: [{ a: 2.0, b: 3.0, top: 2.12 }, winOps(14.2, 15.8), winOps(17.0, 18.6)] });
  // South wall
  world.wall('x', 17, 0, 13.5, { matA: M.wall, matB: M.ext, openings: [winOps(0.8, 2.2), winOps(5.0, 6.6), winOps(10.0, 11.8)] });
  world.wall('x', 17, 13.5, 17, { matA: M.bathWall, matB: M.ext, openings: [winOps(15.4, 16.2, 1.5, 2.15)] });
  world.wall('x', 17, 17, 20, { matA: M.wall, matB: M.ext });
  // West wall (kitchen window with bars)
  world.wall('z', 0, 0, 9, { matA: M.ext, matB: M.wall, openings: [winOps(6.0, 7.2, 1.05, 2.05)] });
  world.wall('z', 0, 9, 17, { matA: M.ext, matB: M.wallGirls });
  // East wall: grey TV wall in the living room
  world.wall('z', 20, 0, 9, { matA: M.wallGrey, matB: M.ext });
  world.wall('z', 20, 9, 17, { matA: M.wall, matB: M.ext });

  // ================= INTERIOR WALLS =================
  world.wall('z', 4, 0, 4, { openings: [{ a: 2.2, b: 3.7, top: 2.3 }] }); // entry <-> dining
  world.wall('x', 4, 0, 5, { openings: [{ a: 1.2, b: 2.2, top: 2.1 }] }); // entry <-> kitchen
  world.wall('z', 5, 4, 9, { openings: [{ a: 5.4, b: 7.9, top: 2.3 }] }); // kitchen arch
  world.wall('x', 9, 0, 3, { matA: M.wall, matB: M.wallGirls });
  world.wall('x', 9, 3, 20, { openings: [{ a: 11.2, b: 12.6, top: 2.3 }] }); // hallway entrance
  world.wall('z', 3, 9, 17, { matA: M.wallGirls, matB: M.wall, openings: [{ a: 9.3, b: 10.2, top: 2.1 }] });
  world.wall('x', 10.8, 3, 13.5, { openings: [{ a: 4.2, b: 5.1, top: 2.1 }, { a: 10.2, b: 11.1, top: 2.1 }] });
  world.wall('x', 10.8, 13.5, 17, { matA: M.wall, matB: M.bathWall, openings: [{ a: 14.3, b: 15.15, top: 2.1 }] });
  world.wall('x', 10.8, 17, 20, { openings: [{ a: 18.0, b: 18.9, top: 2.1 }] });
  world.wall('z', 8, 10.8, 17);
  world.wall('z', 13.5, 10.8, 17, { matA: M.wall, matB: M.bathWall });
  world.wall('z', 17, 10.8, 17, { matA: M.bathWall, matB: M.concrete });

  // arch trims (the round arch between kitchen and dining)
  const archMat = M.wall;
  for (let k = 0; k < 10; k++) {
    const a = (k / 9) * P;
    const zc = 6.65 + Math.cos(a) * 1.25, y = 1.95 + Math.sin(a) * 0.35;
    world.staticBox(5, y, zc, 0.2, 2.3 - y + 0.01, 0.26, archMat, { collide: false });
  }

  // baseboards
  const bb = M.cabinet;
  const base = (x0, z0, x1, z1) => world.staticBox((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.max(0.02, x1 - x0), 0.08, Math.max(0.02, z1 - z0), bb, { collide: false });
  base(0.1, 0.1, 2.0, 0.12); base(3.0, 0.1, 14.2, 0.12); base(18.6, 0.1, 19.9, 0.12);
  base(5.1, 8.88, 11.2, 8.9); base(12.6, 8.88, 19.9, 8.9); base(19.88, 0.1, 19.9, 8.9);

  // ================= TERRACE =================
  // parapets
  world.staticBox(10, 0, -7, 20.2, 1.1, 0.25, M.ext);
  world.staticBox(20, 0, -3.5, 0.25, 1.1, 7.2, M.ext);
  world.staticBox(0, 0, -5.1, 0.25, 1.1, 3.8, M.ext);
  // railings on the parapet
  for (let x = 0.3; x < 20; x += 0.6) world.staticBox(x, 1.1, -7, 0.04, 0.4, 0.04, M.metalBlack, { collide: false });
  world.staticBox(10, 1.48, -7, 20, 0.05, 0.06, M.metalBlack, { collide: false });
  // stairwell block (west) — where the messenger leaves
  world.staticBox(-1.75, 0, -3.2, 3.5, 3.0, 0.2, M.ext);
  world.staticBox(-3.5, 0, -1.6, 0.2, 3.0, 3.2, M.ext);
  world.staticBox(-1.75, 3.0, -1.6, 3.7, 0.2, 3.4, M.concrete, { collide: false });
  world.plane(-3.4, -3.1, 0, 0, 0.01, M.concrete);
  world.wall('z', 0, -3.2, 0, { matA: M.concrete, matB: M.ext, h: 3.0, openings: [{ a: -2.4, b: -1.4, top: 2.1 }] });
  world.addDoor({ id: 'stairs', name: 'דלת המדרגות', x: 0, z: -2.4, axis: 'z', width: 1.0, hinge: 'start', swing: -1, mat: M.doorMetal, locked: true, lockedMsg: 'הדלת למדרגות נעולה. אתה לא הולך לשום מקום עד שתבין מה קרה פה.' });

  // black leather sofa under the living-room window (the one in the video)
  {
    const x0 = 14.3, z = -0.55;
    world.staticBox(x0 + 1.1, 0, z, 2.2, 0.42, 0.85, M.leather);
    world.staticBox(x0 + 1.1, 0.42, z + 0.3, 2.2, 0.5, 0.25, M.leather, { collide: false });
    world.staticBox(x0 + 0.08, 0.42, z, 0.16, 0.25, 0.85, M.leather, { collide: false });
    world.staticBox(x0 + 2.12, 0.42, z, 0.16, 0.25, 0.85, M.leather, { collide: false });
    world.staticBox(x0 + 0.6, 0.42, z - 0.05, 0.95, 0.12, 0.65, M.leather, { collide: false });
    world.staticBox(x0 + 1.6, 0.42, z - 0.05, 0.95, 0.12, 0.65, M.leather, { collide: false });
  }
  // stacked pallets
  for (let i = 0; i < 4; i++) world.staticBox(11.8, i * 0.15, -6.3, 1.2, 0.12, 0.8, M.palletWood, { collide: i === 0 });
  world.addCollider(11.8, 0, -6.3, 1.2, 0.6, 0.8);
  for (let i = 0; i < 3; i++) world.staticBox(9.8, 0, -6.75 + i * 0.02, 1.0, 1.2, 0.1, M.palletWood, { collide: i === 0 });
  // solar water heaters (דוד שמש)
  for (const x of [3.5, 6.0]) {
    world.staticBox(x, 0, -6.3, 1.4, 0.4, 0.9, M.metalBlack);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.3, 16), M.white);
    tank.rotation.z = P / 2; tank.position.set(x, 0.75, -6.55); tank.castShadow = true; world.scene.add(tank);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.0), S({ color: '#1a2440', roughness: 0.2, metalness: 0.5 }));
    panel.position.set(x, 0.75, -5.8); panel.rotation.x = -0.6; world.scene.add(panel);
  }
  // plastic chair
  {
    const cx = 8.0, cz = -3.2;
    world.staticBox(cx, 0.42, cz, 0.45, 0.04, 0.45, M.plastic);
    world.staticBox(cx, 0.46, cz - 0.21, 0.45, 0.45, 0.04, M.plastic, { collide: false });
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) world.staticBox(cx + dx, 0, cz + dz, 0.03, 0.42, 0.03, M.plastic, { collide: false });
  }
  // barred windows on the facade
  for (const [a, b] of [[14.2, 15.8], [17.0, 18.6]]) {
    for (let x = a + 0.12; x < b; x += 0.16) world.staticBox(x, 0.95, -0.12, 0.02, 1.2, 0.02, M.chrome, { collide: false });
    for (const y of [1.25, 1.75]) world.staticBox((a + b) / 2, y, -0.12, b - a, 0.02, 0.02, M.chrome, { collide: false });
  }
  // outdoor wall lamp (dead)
  world.staticBox(3.4, 2.2, -0.15, 0.2, 0.25, 0.12, M.metalBlack, { collide: false });

  // roof shed (מחסן הגג)
  {
    const shedMat = S({ map: T.woodTex('#6f5a43', '#3a2c1d', 65, 0.6), roughness: 1 });
    M.shed = shedMat;
    world.wall('z', 16.5, -7, -4.5, { matA: shedMat, matB: shedMat, h: 2.3, openings: [{ a: -6.2, b: -5.3, top: 2.0 }] });
    world.wall('x', -4.5, 16.5, 20, { matA: shedMat, matB: shedMat, h: 2.3 });
    world.staticBox(18.25, 2.3, -5.75, 3.7, 0.08, 2.7, M.metalBlack, { collide: false });
    world.addDoor({ id: 'shed', name: 'מחסן הגג', x: 16.5, z: -6.2, axis: 'z', width: 0.9, hinge: 'start', swing: 1, mat: shedMat, locked: true, codeLock: true, lockedMsg: 'מנעול קוד. ארבע ספרות.' });
    // boxes inside
    world.staticBox(19.4, 0, -6.6, 0.9, 0.7, 0.6, M.cardboard);
    world.staticBox(19.5, 0.7, -6.6, 0.6, 0.45, 0.5, M.cardboard);
    world.staticBox(18.6, 0, -4.95, 1.4, 0.18, 0.7, M.mattress);
    world.staticBox(19.15, 0, -5.75, 0.55, 0.8, 0.6, M.cardboard);
    world.addHidingSpot({ id: 'shedBoxes', label: 'להתחבא מאחורי הארגזים', x: 18.4, z: -5.9, y: 0.6, cam: { x: 19.7, y: 0.7, z: -5.35, yaw: Math.PI / 2, pitch: 0 }, exit: { x: 18.3, z: -5.9 }, kind: 'boxes' });
    // outdoor hiding spot: crouched behind the black sofa
  }

  // ================= ENTRANCE DOOR =================
  world.addDoor({ id: 'entrance', name: 'דלת הכניסה', x: 2.0, z: 0, axis: 'x', width: 1.0, hinge: 'start', swing: -1, mat: M.doorMetal, locked: true, keyId: 'key_entrance', lockedMsg: 'נעול. צריך מפתח.' });

  // ================= ENTRY =================
  {
    // tool table (drill, tape measure, toolbox)
    const tx = 0.75, tz = 3.0;
    world.staticBox(tx, 0.72, tz, 1.1, 0.04, 0.75, M.woodLight);
    for (const [dx, dz] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) world.staticBox(tx + dx, 0, tz + dz, 0.04, 0.72, 0.04, M.metalBlack, { collide: false });
    world.staticBox(tx, 0.25, tz, 1.05, 0.03, 0.7, M.metalBlack, { collide: false });
    world.addCollider(tx, 0, tz, 1.1, 0.76, 0.75);
    world.staticBox(tx - 0.3, 0.76, tz + 0.15, 0.22, 0.2, 0.08, M.yellow, { collide: false }); // drill body
    world.staticBox(tx - 0.3, 0.76, tz + 0.15, 0.06, 0.08, 0.2, M.black, { collide: false });
    world.staticBox(tx + 0.2, 0.76, tz - 0.15, 0.3, 0.08, 0.2, S({ color: '#8fb3d9', roughness: 0.3, transparent: true, opacity: 0.6 }), { collide: false });
    world.staticBox(tx + 0.35, 0.76, tz + 0.18, 0.08, 0.08, 0.04, M.yellow, { collide: false });
    // trolley with the yellow-green shopping bag
    world.staticBox(3.55, 0, 0.7, 0.45, 0.85, 0.4, M.metalBlack);
    world.staticBox(3.55, 0.85, 0.7, 0.5, 0.55, 0.42, S({ color: '#c8b51e', roughness: 0.8 }), { collide: false });
    world.staticBox(3.55, 0.5, 0.7, 0.47, 0.32, 0.41, M.red, { collide: false });
    // hooks with bags
    world.staticBox(0.12, 1.6, 1.4, 0.06, 0.06, 1.2, M.woodDark, { collide: false });
    world.staticBox(0.25, 1.05, 1.1, 0.2, 0.55, 0.35, S({ color: '#2b2b30', roughness: 1 }), { collide: false });
    world.staticBox(0.25, 1.15, 1.7, 0.18, 0.45, 0.3, M.blanketArmy, { collide: false });
    // shoes
    for (let i = 0; i < 5; i++) world.staticBox(1.4 + i * 0.28, 0, 0.35 + (i % 2) * 0.08, 0.11, 0.09, 0.28, i % 2 ? M.black : M.white, { collide: false });
  }
  // minions taped to the kitchen door frame
  world.decal(T.minionsTex(), 2.27, 1.25, 3.88, 0.22, 0.9, '-z');

  // ================= KITCHEN =================
  {
    // lower cabinets along the west wall + black granite top
    world.staticBox(0.33, 0, 6.8, 0.62, 0.86, 3.6, M.cabinet);
    world.staticBox(0.35, 0.86, 6.8, 0.68, 0.04, 3.62, M.granite, { collide: false });
    for (let z = 5.1; z < 8.6; z += 0.6) world.staticBox(0.645, 0.1, z + 0.3, 0.01, 0.66, 0.57, M.fabricDark, { collide: false });
    for (let z = 5.1; z < 8.6; z += 0.6) world.staticBox(0.66, 0.55, z + 0.52, 0.02, 0.18, 0.02, M.chrome, { collide: false });
    // sink
    world.staticBox(0.35, 0.82, 6.6, 0.45, 0.06, 0.6, M.steel, { collide: false });
    world.staticBox(0.12, 0.9, 6.6, 0.04, 0.32, 0.04, M.chrome, { collide: false });
    world.staticBox(0.2, 1.2, 6.6, 0.2, 0.03, 0.03, M.chrome, { collide: false });
    // white stove at the end of the counter
    world.staticBox(0.33, 0, 8.65, 0.62, 0.9, 0.55, M.white);
    world.staticBox(0.645, 0.15, 8.65, 0.01, 0.45, 0.45, M.black, { collide: false });
    for (const dz of [-0.18, -0.06, 0.06, 0.18]) world.staticBox(0.65, 0.72, 8.65 + dz, 0.04, 0.05, 0.05, M.white, { collide: false });
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), M.black);
      b.position.set(0.33 + dx, 0.91, 8.65 + dz); world.scene.add(b);
    }
    world.stovePos = new THREE.Vector3(0.4, 0.95, 8.65);
    // upper cabinets
    world.staticBox(0.18, 1.5, 5.45, 0.35, 0.7, 0.9, M.cabinet, { collide: false });
    world.staticBox(0.18, 1.5, 8.0, 0.35, 0.7, 1.4, M.cabinet, { collide: false });
    // fridge with magnets + washing machine with potatoes on top
    world.staticBox(4.58, 0, 8.52, 0.72, 1.85, 0.7, M.white);
    world.decal(T.fridgeTex(), 4.2, 0.93, 8.52, 0.68, 1.8, '-x', { transparent: false, rough: 0.35 });
    world.staticBox(3.8, 0, 8.6, 0.62, 0.86, 0.58, M.white);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), S({ color: '#3a4250', roughness: 0.1, metalness: 0.4 }));
    drum.rotation.x = P / 2; drum.position.set(3.8, 0.45, 8.3); world.scene.add(drum);
    world.staticBox(3.7, 0.86, 8.6, 0.4, 0.25, 0.4, S({ color: '#c9a96a', roughness: 1 }), { collide: false });
    world.staticBox(3.95, 0.86, 8.55, 0.3, 0.32, 0.3, S({ color: '#e6d06a', roughness: 1 }), { collide: false });
    // tall broom closet (hiding spot)
    world.staticBox(0.38, 0, 4.48, 0.62, 2.05, 0.75, M.cabinet);
    world.staticBox(0.7, 0.9, 4.3, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.staticBox(0.7, 0.9, 4.66, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.addHidingSpot({ id: 'kitchenCloset', label: 'להתחבא בארון השירות', x: 0.95, z: 4.48, cam: { x: 0.45, y: 1.55, z: 4.48, yaw: -P / 2 }, exit: { x: 1.1, z: 4.48 }, kind: 'closet' });
    // kitchen window bars
    for (let z = 6.08; z < 7.2; z += 0.15) world.staticBox(-0.12, 1.05, z, 0.02, 1.0, 0.02, M.metalBlack, { collide: false });
  }

  // ================= DINING =================
  {
    const tx = 8.5, tz = 4.15;
    world.staticBox(tx, 0.72, tz, 2.6, 0.05, 1.1, M.woodDark, { collide: false });
    for (const [dx, dz] of [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]]) world.staticBox(tx + dx, 0, tz + dz, 0.08, 0.72, 0.08, M.woodDark);
    world.addCollider(tx, 0.6, tz, 2.6, 0.17, 1.1, { nav: false });
    world.diningTable = { x: tx, z: tz };
    const chair = (cx, cz, rot) => {
      const g = new THREE.Group();
      const mk = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.woodDark); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
      mk(0, 0.45, 0, 0.46, 0.05, 0.46);
      mk(0, 0.5, -0.21, 0.46, 0.62, 0.05);
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) mk(dx, 0, dz, 0.04, 0.45, 0.04);
      g.position.set(cx, 0, cz); g.rotation.y = rot; world.scene.add(g);
      world.addCollider(cx, 0, cz, 0.45, 1.1, 0.45, { nav: true });
      return g;
    };
    world.chairs = [];
    for (const dx of [-0.85, 0, 0.85]) { world.chairs.push(chair(tx + dx, tz - 0.85, 0)); world.chairs.push(chair(tx + dx, tz + 0.85, P)); }
    // Ori's chair, turned towards the TV (like in the video)
    world.chairs.push(chair(12.25, 4.6, P / 2));
    // paper towel + bottle on the table
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 16), M.plastic); roll.position.set(tx - 0.6, 0.89, tz); world.scene.add(roll);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 12), S({ color: '#1c2333', roughness: 0.3, metalness: 0.6 })); bottle.position.set(tx + 0.5, 0.9, tz + 0.2); world.scene.add(bottle);
    // DIMONA DEMONS mural
    world.mural = world.decal(T.muralTex(), 8.6, 1.85, 0.115, 7.0, 1.75, '+z');
    world.muralEyes = world.decal(T.muralEyesTex(), 5.0, 2.08, 0.12, 0.5, 0.25, '+z', { emissive: 3 });
    world.muralEyes.visible = false;
    // under-table hiding spot
    world.addHidingSpot({ id: 'table', label: 'לזחול מתחת לשולחן', x: tx, z: tz + 1.55, y: 0.5, cam: { x: tx, y: 0.42, z: tz, yaw: 0 }, exit: { x: tx, z: tz + 1.6 }, kind: 'table' });
    // white trash bin
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.5, 16), M.plastic); bin.position.set(12.1, 0.25, 1.2); bin.castShadow = true; world.scene.add(bin);
    world.addCollider(12.1, 0, 1.2, 0.34, 0.5, 0.34);
  }

  // ================= LIVING ROOM =================
  {
    // grey L sofa facing the TV (east)
    world.staticBox(13.65, 0, 4.0, 0.95, 0.42, 4.6, M.fabric);
    world.staticBox(13.25, 0.42, 4.0, 0.2, 0.5, 4.6, M.fabric, { collide: false });
    world.staticBox(14.85, 0, 1.95, 1.5, 0.42, 0.85, M.fabric);
    world.staticBox(14.6, 0.42, 1.6, 2.0, 0.5, 0.18, M.fabric, { collide: false });
    for (const z of [2.6, 3.7, 4.8, 5.9]) world.staticBox(13.7, 0.42, z, 0.7, 0.12, 1.0, M.fabricDark, { collide: false });
    for (const [x, z] of [[13.45, 3.2], [13.45, 5.3], [14.9, 1.75]]) world.staticBox(x, 0.5, z, 0.2, 0.38, 0.45, M.pillow, { collide: false });
    // round coffee table
    const ct = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 28), M.woodLight); ct.position.set(16.0, 0.45, 4.2); ct.castShadow = true; ct.receiveShadow = true; world.scene.add(ct);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * P * 2; world.staticBox(16.0 + Math.cos(a) * 0.3, 0, 4.2 + Math.sin(a) * 0.3, 0.03, 0.45, 0.03, M.metalBlack, { collide: false }); }
    world.addCollider(16.0, 0, 4.2, 0.9, 0.47, 0.9);
    world.staticBox(15.85, 0.47, 4.1, 0.28, 0.1, 0.2, S({ color: '#d93b2a', roughness: 0.7 }), { collide: false });
    world.staticBox(16.2, 0.47, 4.35, 0.08, 0.12, 0.08, S({ color: '#bfe0ff', roughness: 0.1, transparent: true, opacity: 0.5 }), { collide: false });
    // TV + console stand on the grey wall
    world.staticBox(19.62, 0, 4.3, 0.55, 0.48, 2.6, M.woodLight);
    world.staticBox(19.6, 0.48, 3.7, 0.32, 0.07, 0.42, M.black, { collide: false }); // console
    world.staticBox(19.55, 0.48, 4.6, 0.1, 0.05, 0.15, M.black, { collide: false });
    world.staticBox(19.55, 0.48, 4.85, 0.1, 0.05, 0.15, M.white, { collide: false });
    world.staticBox(19.6, 0.48, 5.3, 0.3, 0.2, 0.3, M.black, { collide: false }); // printer-ish box
    world.staticBox(19.86, 0.95, 4.3, 0.06, 1.12, 1.95, M.black, { collide: false });
    world.tv = T.makeTVScreen();
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 1.04), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: world.tv.texture, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2 }));
    scr.position.set(19.82, 1.51, 4.3); scr.rotation.y = -P / 2; world.scene.add(scr);
    world.tvScreen = scr;
    world.tvPos = new THREE.Vector3(19.6, 1.4, 4.3);
    world.tvLight = new THREE.PointLight(0x6f9cff, 0, 9, 1.6);
    world.tvLight.position.set(19.1, 1.4, 4.3);
    world.scene.add(world.tvLight);
    // OSB board with קומונה דימונה + timetable + notes
    world.staticBox(19.86, 0.85, 7.35, 0.06, 1.75, 2.6, M.osb, { collide: false });
    world.decal(T.communeLettersTex(), 19.82, 2.15, 7.35, 1.9, 0.95, '-x');
    world.busSign = world.decal(T.busScheduleTex(), 19.82, 1.25, 7.85, 0.45, 0.56, '-x');
    world.decal(T.paperTex(['תורנות שבועית', 'א׳ - אורי', 'ב׳ - ירין', 'ג׳ - נועם', 'ד׳ - ???'], { seed: 5 }), 19.82, 1.25, 7.0, 0.32, 0.4, '-x');
    world.decal(T.paperTex(['רשימת קניות:', 'חלב, ביצים', 'תפוחי אדמה', 'סוללות!!!'], { seed: 6, color: '#fff7b0' }), 19.82, 1.35, 6.5, 0.26, 0.32, '-x');
    // AC unit above the windows, punching ball, white drawers
    world.staticBox(16.3, 2.25, 0.25, 1.1, 0.3, 0.25, M.white, { collide: false });
    world.staticBox(18.95, 0, 1.0, 0.35, 0.05, 0.35, M.metalBlack);
    world.staticBox(18.95, 0.05, 1.0, 0.04, 1.2, 0.04, M.metalBlack, { collide: false });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), S({ color: '#e8e2da', roughness: 0.4 })); ball.position.set(18.95, 1.4, 1.0); ball.scale.y = 1.25; world.scene.add(ball);
    const ballR = new THREE.Mesh(new THREE.SphereGeometry(0.172, 16, 12, 0, P), M.red); ballR.position.copy(ball.position); ballR.scale.y = 1.25; world.scene.add(ballR);
    world.staticBox(19.6, 0, 0.6, 0.5, 0.95, 0.5, M.plastic);
    // drying rack with Noam's jersey (SEMENYO 24) — night 3 clue
    {
      const rx = 6.7, rz = 7.9;
      for (let k = 0; k < 6; k++) world.staticBox(rx - 0.6 + k * 0.24, 0.9, rz, 0.02, 0.02, 0.6, M.steel, { collide: false });
      for (const dx of [-0.65, 0.65]) world.staticBox(rx + dx, 0, rz, 0.03, 0.92, 0.6, M.steel, { collide: false });
      world.addCollider(rx, 0, rz, 1.3, 0.95, 0.62);
      const jersey = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: T.jerseyTex('noam', 'back'), side: THREE.DoubleSide, roughness: 0.9 }));
      jersey.position.set(rx, 0.63, rz - 0.31); jersey.rotation.y = P; world.scene.add(jersey);
      world.jersey = jersey;
      world.staticBox(rx + 0.4, 0.55, rz, 0.3, 0.35, 0.01, M.blanketGrey, { collide: false });
    }
  }

  // ================= WINDOWS (blinds with alpha so moonlight casts striped shadows) =================
  const blindsTex = (() => {
    const c = T.makeCanvas(64, 256), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 64, 256);
    x.fillStyle = '#fff'; for (let y = 0; y < 256; y += 16) x.fillRect(0, y, 64, 10);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const blindsMat = S({ color: '#d8dade', roughness: 0.7, alphaMap: blindsTex, alphaTest: 0.5, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0a1020', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.25 });
  const addWindow = (axis, c, a, b, bottom = 0.95, top = 2.15, inward = 1, blinds = 0.7) => {
    const w = b - a, h = top - bottom, mid = (a + b) / 2, ym = (bottom + top) / 2;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    const fr = M.plastic;
    if (axis === 'x') {
      glass.position.set(mid, ym, c); world.scene.add(glass);
      world.staticBox(mid, bottom - 0.04, c, w, 0.04, 0.24, fr, { collide: false });
      world.staticBox(mid, top, c, w, 0.04, 0.24, fr, { collide: false });
      world.staticBox(mid, bottom, c, 0.04, h, 0.1, fr, { collide: false });
      if (blinds) {
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(w, h * blinds), blindsMat);
        bl.position.set(mid, top - (h * blinds) / 2, c + inward * 0.09); bl.castShadow = true; world.scene.add(bl);
        bl.material.alphaMap.repeat.set(1, 1);
      }
    } else {
      glass.position.set(c, ym, mid); glass.rotation.y = P / 2; world.scene.add(glass);
      world.staticBox(c, bottom - 0.04, mid, 0.24, 0.04, w, fr, { collide: false });
      world.staticBox(c, top, mid, 0.24, 0.04, w, fr, { collide: false });
      if (blinds) {
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(w, h * blinds), blindsMat);
        bl.position.set(c + inward * 0.09, top - (h * blinds) / 2, mid); bl.rotation.y = P / 2; bl.castShadow = true; world.scene.add(bl);
      }
    }
  };
  addWindow('x', 0, 14.2, 15.8, 0.95, 2.15, 1, 0.55);
  addWindow('x', 0, 17.0, 18.6, 0.95, 2.15, 1, 0.45);
  addWindow('x', 17, 0.8, 2.2, 0.95, 2.15, -1, 0.8);
  addWindow('x', 17, 5.0, 6.6, 0.95, 2.15, -1, 0.6);
  addWindow('x', 17, 10.0, 11.8, 0.95, 2.15, -1, 0.75);
  addWindow('x', 17, 15.4, 16.2, 1.5, 2.15, -1, 0);
  addWindow('z', 0, 6.0, 7.2, 1.05, 2.05, 1, 0);

  // ================= HALLWAY =================
  {
    // fire extinguisher
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 14), M.red);
    ext.position.set(13.2, 0.75, 9.2); ext.castShadow = true; world.scene.add(ext);
    world.staticBox(13.2, 1.0, 9.2, 0.04, 0.1, 0.04, M.black, { collide: false });
    // electrical panel (לוח חשמל)
    world.staticBox(15.6, 1.45, 9.17, 0.55, 0.65, 0.12, S({ color: '#bfc2c4', roughness: 0.5, metalness: 0.3 }), { collide: false });
    world.panelDoor = world.box(0, 0, 0, 0.53, 0.63, 0.02, S({ color: '#d4d6d8', roughness: 0.5, metalness: 0.3 }));
    world.panelDoor.geometry.translate(0.265, 0, 0);
    world.panelDoor.position.set(15.6 - 0.265, 1.775, 9.24);
    world.panelPos = new THREE.Vector3(15.6, 1.75, 9.4);
    // "כן יעשה" + Dimona plaque + green banner at the end of the hallway
    world.decal(T.signTex(['כן יעשה'], { size: 110 }), 19.88, 1.75, 9.9, 1.2, 0.6, '-x');
    const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 28), S({ color: '#5a4636', roughness: 0.6, metalness: 0.3 }));
    plaque.rotation.z = P / 2; plaque.position.set(19.88, 2.25, 9.9); world.scene.add(plaque);
    world.decal(T.signTex(['דימונה'], { size: 60, color: '#e8dcc0', w: 256, h: 128 }), 19.85, 2.25, 9.9, 0.34, 0.17, '-x');
    world.decal(T.signTex(['לכל מעשה', 'יש משמעות'], { size: 52, color: '#f2f2f2', bg: '#1f3d2a', w: 512, h: 256 }), 19.88, 0.95, 9.9, 0.9, 0.55, '-x', { transparent: false });
    // framed photos from the commune (real pictures)
    world.photoFrames = [];
    // hallway ceiling lamp
    world.hallLight = new THREE.PointLight(0xffe2b0, 0, 7, 1.8);
    world.hallLight.position.set(12.5, 2.5, 9.9);
    world.scene.add(world.hallLight);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 0 }));
    bulb.position.set(12.5, 2.6, 9.9); world.scene.add(bulb);
    world.hallBulb = bulb;
  }

  // ================= DOORS =================
  const roomDoor = (id, name, x, z, axis, width, swing, extra = {}) => world.addDoor({ id, name, x, z, axis, width, swing, hinge: 'start', mat: M.doorWhite, ...extra });
  roomDoor('girls', 'חדר הבנות', 3, 9.3, 'z', 0.9, 1);
  roomDoor('myroom', 'החדר שלך', 4.2, 10.8, 'x', 0.9, -1, { canLockInside: true });
  roomDoor('boys', 'חדר הבנים', 10.2, 10.8, 'x', 0.9, -1, {
    decor: (pivot, panel, s) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ map: T.signTex(['בנים'], { size: 80, color: '#55e04a', bg: '#111', w: 256, h: 128 }) }));
      sign.position.set(s * 0.45, 1.6, -0.03); sign.rotation.y = P; pivot.add(sign);
    },
  });
  roomDoor('bath', 'שירותים', 14.3, 10.8, 'x', 0.85, -1);
  roomDoor('storage', 'המחסן', 18.0, 10.8, 'x', 0.9, -1, { locked: true, keyId: 'key_storage', lockedMsg: 'המחסן נעול. מבפנים שומעים... נשימות?' });

  // ================= GIRLS' ROOM =================
  {
    world.staticBox(0.55, 0, 12.6, 1.0, 0.45, 2.0, M.metalBlack);
    world.staticBox(0.55, 0.45, 12.6, 0.95, 0.12, 1.95, M.blanketPink, { collide: false });
    world.staticBox(0.55, 0.57, 11.75, 0.6, 0.12, 0.35, M.pillow, { collide: false });
    world.staticBox(0.55, 0.57, 13.0, 0.5, 0.06, 0.5, S({ map: T.jerseyTex('yarin', 'front'), roughness: 1 }), { collide: false });
    // wardrobe (hiding)
    world.staticBox(2.58, 0, 15.35, 0.6, 2.05, 1.5, M.wardrobe);
    world.staticBox(2.27, 0.9, 15.25, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.staticBox(2.27, 0.9, 15.45, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.addHidingSpot({ id: 'girlsWardrobe', label: 'להתחבא בארון', x: 1.75, z: 15.35, cam: { x: 2.6, y: 1.5, z: 15.35, yaw: P / 2 }, exit: { x: 1.65, z: 15.35 }, kind: 'closet' });
    // vanity with mirror
    world.staticBox(0.3, 0, 16.2, 0.5, 0.75, 1.0, M.plastic);
    world.staticBox(0.08, 0.95, 16.2, 0.03, 0.7, 0.55, M.chrome, { collide: false });
    // fairy lights (emissive dots)
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 2.6), new THREE.MeshBasicMaterial({ color: 0xffd28a }));
    fl.position.set(0.12, 2.45, 13.2); world.scene.add(fl);
    world.girlsLights = fl;
  }

  // ================= YOUR ROOM ("החדר השני") =================
  {
    world.staticBox(3.65, 0, 14.4, 0.95, 0.38, 2.0, M.metalBlack);
    world.staticBox(3.65, 0.38, 14.4, 0.92, 0.16, 1.95, M.mattress, { collide: false });
    world.staticBox(3.65, 0.54, 13.6, 0.55, 0.1, 0.3, M.pillow, { collide: false });
    world.staticBox(3.65, 0.54, 14.8, 0.9, 0.05, 1.0, M.blanketGrey, { collide: false });
    world.bedPos = new THREE.Vector3(3.65, 0.6, 14.4);
    // desk + chair + lamp
    world.staticBox(7.2, 0.74, 16.5, 1.3, 0.04, 0.7, M.woodLight, { collide: false });
    for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) world.staticBox(7.2 + dx, 0, 16.5 + dz, 0.04, 0.74, 0.04, M.metalBlack, { collide: false });
    world.addCollider(7.2, 0, 16.5, 1.3, 0.78, 0.7);
    world.staticBox(6.9, 0, 15.75, 0.42, 0.45, 0.42, S({ color: '#7fa7c9', roughness: 0.7 }));
    world.staticBox(7.6, 0.78, 16.6, 0.14, 0.02, 0.14, M.metalBlack, { collide: false });
    world.staticBox(7.6, 0.8, 16.6, 0.02, 0.35, 0.02, M.metalBlack, { collide: false });
    world.deskLight = new THREE.PointLight(0xffb36b, 0, 4.5, 1.8);
    world.deskLight.position.set(7.55, 1.1, 16.45); world.scene.add(world.deskLight);
    // dark brown wardrobe (hiding)
    world.staticBox(7.6, 0, 12.0, 0.6, 2.1, 1.6, M.wardrobe);
    world.staticBox(7.29, 0.9, 11.9, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.staticBox(7.29, 0.9, 12.1, 0.02, 0.3, 0.02, M.chrome, { collide: false });
    world.addHidingSpot({ id: 'myWardrobe', label: 'להתחבא בארון', x: 6.7, z: 12.0, cam: { x: 7.6, y: 1.5, z: 12.0, yaw: P / 2 }, exit: { x: 6.6, z: 12.0 }, kind: 'closet' });
    // backpack, clothes
    world.staticBox(5.5, 0, 16.6, 0.35, 0.45, 0.25, M.blanketArmy, { collide: false });
    world.staticBox(4.6, 0, 16.4, 0.5, 0.08, 0.4, M.blanketGrey, { collide: false });
  }

  // ================= BOYS' ROOM =================
  {
    const flagMat = S({ map: T.israelFlagTex(), side: THREE.DoubleSide, roughness: 0.95 });
    const bunk = (x, zc, faceDir, idPrefix) => {
      const z0 = zc - 1.0, z1 = zc + 1.0;
      for (const [dx, dz] of [[-0.45, z0 - zc], [0.45, z0 - zc], [-0.45, z1 - zc], [0.45, z1 - zc]]) world.staticBox(x + dx, 0, zc + dz, 0.05, 1.85, 0.05, M.steel, { collide: false });
      world.staticBox(x, 0.32, zc, 0.92, 0.06, 2.0, M.steel, { collide: false });
      world.staticBox(x, 0.38, zc, 0.88, 0.14, 1.95, M.mattress, { collide: false });
      world.staticBox(x, 1.3, zc, 0.92, 0.06, 2.0, M.steel, { collide: false });
      world.staticBox(x, 1.36, zc, 0.88, 0.14, 1.95, M.mattress, { collide: false });
      world.staticBox(x, 1.5, zc + 0.2, 0.85, 0.12, 1.4, M.blanketArmy, { collide: false });
      world.addCollider(x, 0, zc, 0.95, 1.9, 2.05, { opaque: false });
      // flags hanging as curtains on the room-facing side
      const fx = x + faceDir * 0.47;
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.95), flagMat);
      top.position.set(fx, 1.35, zc + 0.45); top.rotation.y = faceDir > 0 ? P / 2 : -P / 2; world.scene.add(top);
      const low = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.85), flagMat);
      low.position.set(fx, 0.85, zc + 0.55); low.rotation.y = faceDir > 0 ? P / 2 : -P / 2; world.scene.add(low);
      return { top, low };
    };
    world.noamBunk = bunk(8.6, 14.0, 1, 'b1');
    world.staticBox(8.6, 0.52, 13.15, 0.55, 0.1, 0.3, M.pillow, { collide: false });
    bunk(12.95, 14.0, -1, 'b2');
    world.noamBed = new THREE.Vector3(8.6, 0.55, 14.0);
    // hiding under the bottom bunk of the second bed
    world.addHidingSpot({ id: 'bunk', label: 'להתחבא במיטה התחתונה', x: 12.1, z: 14.6, cam: { x: 12.95, y: 0.62, z: 14.4, yaw: P / 2, pitch: -0.05 }, exit: { x: 12.0, z: 14.6 }, kind: 'bed' });
    // nightstand next to Noam's head
    world.staticBox(8.55, 0, 12.6, 0.45, 0.55, 0.45, M.woodLight);
    world.nightstandPos = new THREE.Vector3(8.55, 0.6, 12.6);
    // graffiti on the back wall + AC
    world.decal(T.graffitiTex('בנים', '#55e04a'), 10.9, 2.35, 16.88, 1.1, 0.55, '-z');
    world.decal(T.graffitiTex('DMN', '#55e04a'), 9.0, 2.2, 16.88, 0.8, 0.4, '-z');
    world.staticBox(12.3, 2.2, 16.75, 1.0, 0.3, 0.25, M.white, { collide: false });
    // clutter
    const clutter = [[10.5, 16.2, 0.6, 0.35, 0.45, M.black], [11.4, 15.9, 0.5, 0.25, 0.4, M.blanketArmy], [9.8, 12.0, 0.7, 0.1, 0.6, M.blanketGrey], [12.2, 11.5, 0.35, 0.5, 0.3, S({ color: '#b51f1f', roughness: 0.8 })], [10.0, 16.5, 0.3, 0.12, 0.3, M.black]];
    for (const [x, z, w, h, d, m] of clutter) world.staticBox(x, 0, z, w, h, d, m, { collide: h > 0.3 });
    world.staticBox(11.2, 0, 16.55, 0.6, 0.75, 0.5, M.metalBlack);
    // red LED strip
    world.boysLight = new THREE.PointLight(0xff1a1a, 0, 6, 1.5);
    world.boysLight.position.set(10.7, 2.5, 13.8); world.scene.add(world.boysLight);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    strip.position.set(10.75, 2.66, 11.0); world.scene.add(strip);
    world.boysStrip = strip;
  }

  // ================= BATHROOM =================
  {
    const tm = M.white;
    world.staticBox(14.0, 0, 16.6, 0.4, 0.42, 0.6, tm);
    world.staticBox(14.0, 0.42, 16.85, 0.4, 0.4, 0.18, tm, { collide: false });
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18), tm); seat.position.set(14.0, 0.44, 16.5); seat.scale.z = 1.2; world.scene.add(seat);
    // black metal shelf with baskets
    for (const y of [0.3, 0.8, 1.3]) world.staticBox(14.65, y, 16.75, 0.5, 0.03, 0.35, M.metalBlack, { collide: false });
    world.staticBox(14.65, 0.83, 16.75, 0.3, 0.2, 0.25, S({ color: '#e49aa6', roughness: 0.9 }), { collide: false });
    world.addCollider(14.65, 0, 16.75, 0.5, 1.6, 0.36);
    // sink cabinet + mirror
    world.staticBox(16.65, 0, 12.5, 0.6, 0.85, 1.0, tm);
    world.staticBox(16.62, 0.85, 12.5, 0.62, 0.06, 1.0, S({ color: '#f4f2ee', roughness: 0.15 }), { collide: false });
    world.staticBox(16.85, 0.92, 12.5, 0.08, 0.3, 0.04, M.chrome, { collide: false });
    world.sinkPos = new THREE.Vector3(16.3, 0.6, 12.5);
    world.mirrorPos = new THREE.Vector3(16.88, 1.55, 12.5);
    if (quality.mirror) {
      const mirror = new Reflector(new THREE.PlaneGeometry(0.85, 0.75), { textureWidth: 512, textureHeight: 512, color: 0xb0b4b8, clipBias: 0.003 });
      mirror.position.copy(world.mirrorPos); mirror.rotation.y = -P / 2; world.scene.add(mirror);
      world.mirror = mirror;
    } else {
      world.staticBox(16.88, 1.17, 12.5, 0.02, 0.75, 0.85, M.chrome, { collide: false });
    }
    world.mirrorWriting = world.decal(T.bloodTex('הוא לא נועם'), 16.86, 1.55, 12.5, 0.8, 0.4, '-x');
    world.mirrorWriting.visible = false;
    // shower corner with towels as a curtain (hiding)
    world.staticBox(15.6, 0, 16.2, 0.04, 2.0, 1.55, S({ color: '#cfe2ea', roughness: 0.05, transparent: true, opacity: 0.25 }), { collide: true });
    world.staticBox(16.3, 0, 15.45, 1.4, 0.04, 0.05, M.white, { collide: false });
    world.staticBox(16.85, 2.1, 16.4, 0.4, 0.02, 0.4, M.black, { collide: false });
    world.staticBox(16.9, 1.2, 16.4, 0.03, 0.9, 0.03, M.black, { collide: false });
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.7), new THREE.MeshStandardMaterial({ color: '#d4bfa0', side: THREE.DoubleSide, roughness: 1 }));
    towel.position.set(16.25, 1.15, 15.45); world.scene.add(towel);
    world.showerTowel = towel;
    world.showerPos = new THREE.Vector3(16.3, 1.6, 16.3);
    world.addHidingSpot({ id: 'shower', label: 'להתחבא במקלחת', x: 16.25, z: 14.8, cam: { x: 16.35, y: 1.5, z: 16.35, yaw: 0, pitch: 0 }, exit: { x: 16.25, z: 14.7 }, kind: 'shower' });
    // towel rack + robe
    world.staticBox(14.0, 1.6, 11.0, 0.6, 0.6, 0.03, M.towel, { collide: false });
  }

  // ================= STORAGE (where the missing are) =================
  {
    for (const y of [0.4, 1.1, 1.8]) world.staticBox(19.7, y, 13.5, 0.55, 0.04, 3.5, M.metalBlack, { collide: false });
    world.addCollider(19.7, 0, 13.5, 0.55, 2.2, 3.5);
    for (let i = 0; i < 5; i++) world.staticBox(19.7, 0.44 + (i % 2) * 0.7, 12.2 + i * 0.6, 0.45, 0.35, 0.5, M.cardboard, { collide: false });
    world.maskShelfPos = new THREE.Vector3(19.6, 1.9, 14.8);
    world.staticBox(19.3, 0, 12.1, 0.5, 0.42, 0.5, M.cardboard); // Ori sits on this crate
    // the missing commune members, asleep on mattresses
    world.sleepers = [];
    const sleeperMat = S({ color: '#3b3f47', roughness: 1 });
    for (const [x, z, r] of [[17.8, 15.9, 0.2], [18.9, 16.3, -0.1], [17.7, 12.0, 0.1]]) {
      world.staticBox(x, 0, z, 0.9, 0.12, 1.9, M.mattress, { collide: false });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.2, 4, 10), sleeperMat);
      body.rotation.x = P / 2; body.rotation.z = r; body.position.set(x, 0.3, z); body.scale.set(1.1, 1, 0.75); world.scene.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), S({ color: '#2a1e17', roughness: 0.9 }));
      head.position.set(x, 0.3, z - 0.85); world.scene.add(head);
      world.sleepers.push(body, head);
    }
    world.sleepers.forEach((m) => (m.visible = false));
  }

  // ================= CITY AROUND (neighbouring rooftops) =================
  {
    const bmat = S({ color: '#2a2722', roughness: 1 });
    const litMat = new THREE.MeshBasicMaterial({ color: 0xffc27a });
    const coolMat = new THREE.MeshBasicMaterial({ color: 0x9fc4ff });
    const blds = [[-14, -18, 10, 8, -2.5], [6, -24, 14, 9, -4], [28, -16, 9, 12, -1.5], [30, 6, 8, 14, -3], [-16, 10, 10, 12, -2], [10, 30, 16, 10, -5], [-12, -40, 12, 10, -7], [34, -36, 14, 10, -6]];
    for (const [x, z, w, d, top] of blds) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 20, d), bmat);
      b.position.set(x, top - 10, z); world.scene.add(b);
      for (let k = 0; k < 6; k++) {
        if (Math.random() < 0.5) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), Math.random() < 0.7 ? litMat : coolMat);
        const side = Math.floor(Math.random() * 4);
        const yy = top - 1.5 - Math.floor(Math.random() * 3) * 3;
        const off = (Math.random() - 0.5) * (side < 2 ? w : d) * 0.8;
        if (side === 0) win.position.set(x + off, yy, z + d / 2 + 0.02);
        if (side === 1) { win.position.set(x + off, yy, z - d / 2 - 0.02); win.rotation.y = P; }
        if (side === 2) { win.position.set(x + w / 2 + 0.02, yy, z + off); win.rotation.y = P / 2; }
        if (side === 3) { win.position.set(x - w / 2 - 0.02, yy, z + off); win.rotation.y = -P / 2; }
        world.scene.add(win);
      }
      // solar heaters on their roofs
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.3, 10), M.white);
        t.rotation.z = P / 2; t.position.set(x + (k - 1) * 2.2, top + 0.6, z); world.scene.add(t);
      }
    }
    // Yarin's window across the street (she watches from there)
    const yw = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    yw.position.set(6, -2.0, -19.48); world.scene.add(yw);
    world.yarinWindow = yw;
  }

  // sky dome + moon
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: T.skyTex(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.rotation.y = 0.5; world.scene.add(sky);
  world.sky = sky;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.moonTex(), fog: false, depthWrite: false, transparent: true }));
  moon.position.set(-60, 110, -200); moon.scale.set(40, 40, 1); world.scene.add(moon);

  return world;
}
