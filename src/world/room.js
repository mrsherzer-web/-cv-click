// Nehorai's room, on the ground floor at the back of his house: the morning after the party at the end
// of chapter one. A real interior, seen only from inside: the house around it has colliders along its
// outer walls instead of one solid block, and the room has its own floor, walls, ceiling and light.
// Clothes and snack bags on the floor, pizza boxes, the speaker back on the desk, a chair on its side,
// the bed a mess. The things the game points at (the bed, the door, the mess to pick up) are in
// places.room. Everything here is generic: no brands, no real home.
import * as THREE from 'three';
import { makeSpeaker } from './props.js';

const tex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// light floor tiles with grout lines, as in most Israeli homes
const floorTex = () => {
  const t = tex(256, 256, (g, w) => {
    g.fillStyle = '#d9d0c0'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,70,50'},0.05)`; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); }
    g.fillStyle = '#b9ae9b';
    g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, w);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// an invented poster: a white hatchback under a low orange sun
const posterTex = () => tex(128, 180, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#ff9a4d'); grd.addColorStop(0.6, '#c2457a'); grd.addColorStop(1, '#2a1d3f');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe1a6'; g.beginPath(); g.arc(w / 2, 82, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1b1530'; g.fillRect(0, 112, w, h - 112);
  g.fillStyle = '#f3f2ee';
  g.beginPath(); g.moveTo(24, 132); g.lineTo(36, 116); g.lineTo(84, 114); g.lineTo(104, 130); g.lineTo(106, 140); g.lineTo(22, 140); g.closePath(); g.fill();
  g.fillStyle = '#1b1530'; g.beginPath(); g.arc(42, 141, 7, 0, Math.PI * 2); g.arc(88, 141, 7, 0, Math.PI * 2); g.fill();
});

// the roller shutter half down, the morning showing through the slats
const windowTex = () => tex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff6df'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#9fa6ad';
  for (let y = 0; y < h * 0.55; y += 9) g.fillRect(0, y, w, 6);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, h * 0.55, w, h * 0.45);
});

export function buildRoom(ctx, house) {
  const { group, cols, places, net } = ctx;
  const { P0, y: base, yaw, w, d } = house;
  const room = new THREE.Group();
  room.name = 'nehorai-room';
  room.position.set(P0.x, 0, P0.z);
  room.rotation.y = yaw;
  group.add(room);
  room.updateMatrixWorld(true);
  const toWorld = (lx, lz) => { const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(room.matrixWorld); return { x: v.x, z: v.z }; };

  // the room in the back-left quarter of the ground floor (house-local: +z is the street side)
  const X0 = -w / 2 + 0.3, X1 = -0.5, Z0 = -d / 2 + 0.3, Z1 = -0.3, FY = base + 0.02, HT = 2.75;
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, RW = X1 - X0, RD = Z1 - Z0;
  const mats = new Map();
  const mat = (color, opts = {}) => {
    const k = `${color}|${JSON.stringify(opts)}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }));
    return mats.get(k);
  };
  const put = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    room.add(o);
    return o;
  };
  const box = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
  const collide = (lx, lz, hx, hz, h = 1.2) => { const p = toWorld(lx, lz); cols.addBox(p.x, p.z, hx, hz, yaw, FY - 0.5, FY + h); };

  // ---------- floor, ceiling, walls (each facing into the room) ----------
  const ft = floorTex();
  ft.repeat.set(RW / 0.6, RD / 0.6);
  put(new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), mat('#ffffff', { map: ft, roughness: 0.6 }), cx, FY, cz);
  put(new THREE.PlaneGeometry(RW, RD).rotateX(Math.PI / 2), mat('#f2f1ec'), cx, FY + HT, cz);
  const wallA = mat('#c9d3da'), wallB = mat('#2f4058'); // pale walls, one dark blue
  put(new THREE.PlaneGeometry(RW, HT), wallA, cx, FY + HT / 2, Z0);                       // back (window)
  put(new THREE.PlaneGeometry(RW, HT).rotateY(Math.PI), wallA, cx, FY + HT / 2, Z1);      // front (door)
  put(new THREE.PlaneGeometry(RD, HT).rotateY(Math.PI / 2), wallB, X0, FY + HT / 2, cz);  // left: the bed
  put(new THREE.PlaneGeometry(RD, HT).rotateY(-Math.PI / 2), wallA, X1, FY + HT / 2, cz); // right: the wardrobe
  for (const [x0, z0, x1, z1] of [[X0, Z0, X1, Z0], [X0, Z1, X1, Z1], [X0, Z0, X0, Z1], [X1, Z0, X1, Z1]]) {
    const a = toWorld(x0, z0), b = toWorld(x1, z1);
    cols.addSegment(a.x, a.z, b.x, b.z, 0.12, FY - 0.5, FY + HT);
  }
  net.addPad({ ...toWorld(cx, cz), hx: RW / 2 + 0.05, hz: RD / 2 + 0.05, yaw, h: FY, top: 0, blend: 0, name: 'room floor' });
  // skirting
  put(box(RW, 0.08, 0.02), mat('#e8e6e1'), cx, FY + 0.04, Z0 + 0.01);
  put(box(0.02, 0.08, RD), mat('#e8e6e1'), X1 - 0.01, FY + 0.04, cz);

  // ---------- window with the shutter half down, and the door out ----------
  const wx = cx + 0.3;
  put(new THREE.PlaneGeometry(1.4, 1.2), new THREE.MeshBasicMaterial({ map: windowTex() }), wx, FY + 1.55, Z0 + 0.012);
  put(box(1.55, 0.08, 0.14), mat('#eceae4'), wx, FY + 0.92, Z0 + 0.06);
  put(box(1.55, 0.06, 0.06), mat('#eceae4'), wx, FY + 2.18, Z0 + 0.03);
  const doorX = X1 - 0.75;
  put(box(0.9, 2.05, 0.05), mat('#8a6a4c', { roughness: 0.7 }), doorX, FY + 1.03, Z1 - 0.03);
  put(new THREE.SphereGeometry(0.035, 10, 8), mat('#c9ccd1', { metalness: 0.8, roughness: 0.3 }), doorX - 0.33, FY + 1.0, Z1 - 0.07);
  put(box(1.0, 0.06, 0.04), mat('#e8e6e1'), doorX, FY + 2.08, Z1 - 0.02);

  // ---------- bed against the dark wall: frame, mattress, a duvet in a heap, the pillow on the floor ----------
  const bedX = X0 + 0.55, bedZ = Z0 + 1.2;
  put(box(1.0, 0.3, 2.0), mat('#4a3a2e', { roughness: 0.7 }), bedX, FY + 0.15, bedZ);
  put(box(0.94, 0.16, 1.94), mat('#eeeeea'), bedX, FY + 0.38, bedZ);
  const duvet = box(0.98, 0.16, 1.2);
  { const p = duvet.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 9 + p.getZ(i) * 5) * 0.05); duvet.computeVertexNormals(); }
  put(duvet, mat('#5d7088'), bedX + 0.05, FY + 0.53, bedZ + 0.45, 0.12);
  put(box(0.55, 0.12, 0.35), mat('#f4f3ef'), bedX + 0.75, FY + 0.06, bedZ - 0.55, 0.5);
  collide(bedX - 0.25, bedZ, 0.25, 1.0, 0.5); // only the half by the wall, so there is room to sit on the edge
  places.room = { bed: { ...toWorld(bedX + 0.42, bedZ + 0.1), y: FY, yaw: yaw + Math.PI / 2 } };

  // ---------- desk under the window: the speaker is back, a laptop, cans ----------
  const deskX = wx + 0.15, deskZ = Z0 + 0.38;
  put(box(1.3, 0.04, 0.6), mat('#ece8df'), deskX, FY + 0.74, deskZ);
  for (const [lx, lz] of [[-0.6, -0.25], [0.6, -0.25], [-0.6, 0.25], [0.6, 0.25]]) put(box(0.04, 0.72, 0.04), mat('#3a3d42'), deskX + lx, FY + 0.36, deskZ + lz);
  const speaker = makeSpeaker();
  speaker.scale.setScalar(0.62);
  speaker.position.set(deskX - 0.38, FY + 0.76, deskZ);
  speaker.rotation.y = 0.35;
  room.add(speaker);
  put(box(0.34, 0.02, 0.24), mat('#2a2c30', { roughness: 0.4 }), deskX + 0.25, FY + 0.77, deskZ + 0.04, -0.2);
  put(box(0.33, 0.22, 0.015), mat('#1d1f23', { roughness: 0.3, emissive: '#1d3c66', emissiveIntensity: 0.6 }), deskX + 0.27, FY + 0.88, deskZ - 0.07, -0.2, -0.25);
  for (const [lx, c] of [[0.05, '#c8352d'], [0.52, '#2f7a4a']]) put(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10), mat(c, { metalness: 0.5, roughness: 0.4 }), deskX + lx, FY + 0.82, deskZ + 0.15);
  collide(deskX, deskZ, 0.65, 0.3, 0.8);

  // ---------- the desk chair on its side ----------
  const chairX = deskX - 0.1, chairZ = deskZ + 0.95;
  const chair = new THREE.Group();
  chair.add(new THREE.Mesh(box(0.48, 0.07, 0.46), mat('#1c1d20')));
  const back = new THREE.Mesh(box(0.46, 0.55, 0.06), mat('#1c1d20'));
  back.position.set(0, 0.3, -0.21);
  chair.add(back);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), mat('#5d6066', { metalness: 0.6 }));
  stem.position.y = -0.22;
  chair.add(stem);
  chair.position.set(chairX, FY + 0.25, chairZ);
  chair.rotation.set(0, 0.6, Math.PI / 2 - 0.15);
  room.add(chair);
  collide(chairX, chairZ, 0.35, 0.35, 0.6);

  // ---------- wardrobe with a door hanging open, clothes spilling out ----------
  const wardZ = cz + 0.2;
  put(box(0.6, 2.1, 1.3), mat('#e9e4da'), X1 - 0.32, FY + 1.05, wardZ);
  const wdoor = put(box(0.03, 2.0, 0.64), mat('#e2dccf'), X1 - 0.8, FY + 1.02, wardZ + 0.9, 0.9);
  wdoor.position.x -= 0.05;
  collide(X1 - 0.32, wardZ, 0.32, 0.66, 2.1);

  // ---------- a poster above the bed ----------
  put(new THREE.PlaneGeometry(0.62, 0.87).rotateY(Math.PI / 2), mat('#ffffff', { map: posterTex(), roughness: 0.6 }), X0 + 0.012, FY + 1.6, bedZ - 0.2);

  // ---------- the mess on the floor; three heaps can be picked up (the rest stays, it is that kind of room) ----------
  const tee = (c, x, z, r) => put(box(0.55, 0.02, 0.48), mat(c), x, FY + 0.012, z, r);
  tee('#17181b', cx - 0.3, cz + 0.9, 0.4);
  tee('#8d9096', cx + 0.9, cz - 0.1, -0.7);
  tee('#f2c230', X1 - 1.0, Z1 - 0.9, 1.2);
  put(box(0.3, 0.05, 0.6), mat('#9aa0a7'), cx + 0.2, FY + 0.03, cz + 0.2, 0.9);           // joggers
  for (const [x, z, r] of [[cx + 1.1, cz + 1.2, 0.2], [cx + 1.25, cz + 1.05, 1.1]]) {     // sneakers
    put(box(0.11, 0.08, 0.28), mat('#efede8'), x, FY + 0.04, z, r);
  }
  const heaps = [];
  // pizza boxes, two stacked and one open
  const pizza = new THREE.Group();
  for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(box(0.42, 0.045, 0.42), mat('#c9a679')); b.position.y = 0.023 + k * 0.047; b.rotation.y = k * 0.2; pizza.add(b); }
  const lid = new THREE.Mesh(box(0.42, 0.01, 0.42), mat('#c9a679'));
  lid.position.set(0.48, 0.006, 0.05);
  pizza.add(lid);
  pizza.position.set(cx - 0.5, FY, Z1 - 0.75);
  room.add(pizza);
  heaps.push({ id: 'pizza', obj: pizza, lx: cx - 0.35, lz: Z1 - 0.75, label: 'לזרוק את קופסאות הפיצה', line: 'שלוש קופסאות. אני לא זוכר שהזמנו שלוש.' });
  // snack bags, invented and unbranded: yellow pillows
  const snacks = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8).scale(1, 0.35, 0.75), mat(k % 2 ? '#f2c230' : '#e8952e', { roughness: 0.5 }));
    b.position.set(Math.cos(k * 1.3) * 0.25, 0.04, Math.sin(k * 1.3) * 0.2);
    b.rotation.y = k;
    snacks.add(b);
  }
  snacks.position.set(cx - 0.6, FY, cz + 0.55);
  room.add(snacks);
  heaps.push({ id: 'snacks', obj: snacks, lx: cx - 0.6, lz: cz + 0.55, label: 'לאסוף את שקיות החטיפים', line: 'ארז אמר שזה חלבון. זה לא חלבון.' });
  // a heap of jeans and hoodies by the wardrobe
  const laundry = new THREE.Group();
  for (const [x, z, y, c] of [[0, 0, 0.05, '#2c3e5c'], [0.12, 0.08, 0.12, '#55595f'], [-0.08, 0.1, 0.18, '#1c2740']]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 0.3, 0.8), mat(c));
    b.position.set(x, y, z);
    laundry.add(b);
  }
  laundry.position.set(X1 - 0.95, FY, wardZ - 0.1);
  room.add(laundry);
  heaps.push({ id: 'laundry', obj: laundry, lx: X1 - 0.95, lz: wardZ - 0.1, label: 'להחזיר את הבגדים לארון', line: 'זה הקפוצ׳ון של ארז? איך הוא הגיע לפה?' });

  // ---------- light: the ceiling lamp and the morning through the window ----------
  put(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 18), mat('#f7f3e9', { emissive: '#fff2d2', emissiveIntensity: 0.9 }), cx, FY + HT - 0.03, cz);
  const lamp = new THREE.PointLight('#ffe9c4', 9, 7, 1.6);
  lamp.position.set(cx, FY + HT - 0.35, cz);
  room.add(lamp);
  const sunIn = new THREE.PointLight('#fff4dc', 6, 5, 1.6);
  sunIn.position.set(wx, FY + 1.6, Z0 + 0.6);
  room.add(sunIn);

  // nothing in here needs the sun's shadows (the house above would put it all in shade)
  room.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const R = places.room;
  R.group = room;
  R.center = { ...toWorld(cx, cz), y: FY };
  R.floorY = FY;
  R.door = { ...toWorld(doorX, Z1 - 0.65), y: FY };
  R.speaker = { ...toWorld(deskX - 0.38, deskZ), y: FY + 0.76 };
  R.heaps = heaps.map((h) => ({ ...h, ...toWorld(h.lx, h.lz), y: FY }));
  R.inside = (x, z) => {
    const v = new THREE.Vector3(x, 0, z).applyMatrix4(new THREE.Matrix4().copy(room.matrixWorld).invert());
    return v.x > X0 && v.x < X1 && v.z > Z0 && v.z < Z1;
  };
  // outside the front door, facing the street
  const out = toWorld(0, d / 2 + 1.4);
  R.front = { ...out, yaw };
  room.visible = false; // only drawn while Nehorai is in it
  return R;
}
