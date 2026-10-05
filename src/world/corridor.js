// ============================================================================
//  The escape corridor (from the snooker room to the office)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import * as P from './props.js';

const HW = 1.2; // half width
const H = 2.8;

export class Corridor {
  constructor(A) {
    this.A = A;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x010101);
    s.fog = new THREE.FogExp2(0x030202, 0.09);
    s.add(new THREE.HemisphereLight(0x303848, 0x080604, 0.12));
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 60);
    const wallTex = T.wallpaper('#1f2522', '#283029');
    const wm = (len) => new THREE.MeshStandardMaterial({ map: T.tex(wallTex, { repeat: [len / 2.2, 1] }), roughness: 0.85 });
    const fm = (w, d) => new THREE.MeshStandardMaterial({ map: T.tex(T.woodFloor(true), { repeat: [w / 3, d / 3] }), roughness: 0.75 });
    const cm = (w, d) => new THREE.MeshStandardMaterial({ map: T.tex(T.ceilingTiles(true), { repeat: [w / 1.2, d / 1.2] }), roughness: 0.95 });
    const plane = (w, h, m, x, y, z, rx, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, y, z);
      p.rotation.set(rx, ry, 0);
      p.receiveShadow = true;
      s.add(p);
      return p;
    };
    // segment A: z from +5 to -24.4 along x = 0
    const aLen = 29.4;
    const aZ = (5 + -24.4) / 2;
    plane(HW * 2, aLen, fm(2.4, aLen), 0, 0, aZ, -Math.PI / 2, 0);
    plane(HW * 2, aLen, cm(2.4, aLen), 0, H, aZ, Math.PI / 2, 0);
    plane(aLen, H, wm(aLen), HW, H / 2, aZ, 0, -Math.PI / 2);
    const leftLen = 5 - -22;
    plane(leftLen, H, wm(leftLen), -HW, H / 2, (5 + -22) / 2, 0, Math.PI / 2);
    plane(HW * 2, H, wm(2.4), 0, H / 2, -24.4, 0, 0);
    plane(HW * 2, H, wm(2.4), 0, H / 2, 5, 0, Math.PI);
    // segment B: x from -1.2 to -17 along z = -23.2
    const bLen = 15.8;
    const bX = (-1.2 + -17) / 2;
    plane(bLen, HW * 2, fm(bLen, 2.4), bX, 0, -23.2, -Math.PI / 2, 0);
    plane(bLen, HW * 2, cm(bLen, 2.4), bX, H, -23.2, Math.PI / 2, 0);
    plane(bLen, H, wm(bLen), bX, H / 2, -22, 0, Math.PI);
    plane(bLen + 2.4, H, wm(bLen), bX + 1.2, H / 2, -24.4, 0, 0);
    // end wall with the office doorway
    plane(0.55, H, wm(1), -17, H / 2, -22.27, 0, Math.PI / 2);
    plane(0.55, H, wm(1), -17, H / 2, -24.13, 0, Math.PI / 2);
    plane(1.3, H - 2.3, wm(1), -17, 2.3 + (H - 2.3) / 2, -23.2, 0, Math.PI / 2);
    // the lit office beyond the doorway
    const officeGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.85) }));
    officeGlow.position.set(-18.2, 1.15, -23.2);
    officeGlow.rotation.y = Math.PI / 2;
    s.add(officeGlow);
    const ol = new THREE.PointLight(0xffc888, 6, 0, 2);
    ol.position.set(-17.6, 1.6, -23.2);
    s.add(ol);
    const shutter = P.box(0.07, 2.4, 1.4, new THREE.MeshStandardMaterial({ map: T.tex(T.metal(0.5)), roughness: 0.45, metalness: 0.6 }), -17.05, 2.3 + 1.25, -23.2, s);
    this.shutter = shutter;

    // lights: emissive fixtures + a small pool of real lights that follow you
    this.fixtures = [];
    for (let z = 3; z > -22; z -= 4) this.fixtures.push(new THREE.Vector3(0, H - 0.05, z));
    for (let x = -3; x > -16; x -= 4) this.fixtures.push(new THREE.Vector3(x, H - 0.05, -23.2));
    this.fixtureMats = [];
    this.fixtures.forEach((p, i) => {
      const f = P.fluorescent(0);
      f.remove(f.light);
      f.position.copy(p);
      if (p.z < -22.5) f.rotation.y = Math.PI / 2;
      s.add(f);
      this.fixtureMats.push(f.bulbMats[0]);
      f.bulbMats[0].userData.base = f.bulbMats[0].color.clone();
    });
    this.pool = [0, 1, 2].map(() => {
      const L = new THREE.PointLight(0xd8f0ff, 3.5, 9, 2);
      s.add(L);
      return L;
    });
    // decor along the way
    const doorsA = [-3, -9, -15, -19];
    doorsA.forEach((z, i) => {
      const d = P.woodenDoor();
      d.position.set(i % 2 ? HW - 0.01 : -HW + 0.01, 0, z);
      d.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
      s.add(d);
    });
    const p1 = P.poster(A.tex.posterDuo, 0.6, 1.07);
    p1.position.set(HW - 0.01, 1.5, -6);
    p1.rotation.y = -Math.PI / 2;
    s.add(p1);
    const p2 = P.poster(A.tex.champion, 0.6, 0.85, { frameColor: 0x6a4a1a });
    p2.position.set(-HW + 0.01, 1.5, -12);
    p2.rotation.y = Math.PI / 2;
    s.add(p2);
    const arrow = P.sign(T.textTexture(['← חדר הביטחון'], { w: 512, h: 128, bg: '#0a3a14', color: '#7dffa0', font: '900 64px Heebo', glow: '#3cff6a' }), 1.1, 0.28, 2.2);
    arrow.position.set(0, 2.2, -24.38);
    s.add(arrow);
    const msg = P.decal(T.writing('ברח!!!'), 2.0, 0.5);
    msg.position.set(HW - 0.02, 1.6, -16);
    msg.rotation.y = -Math.PI / 2;
    s.add(msg);
    [[-0.3, -7], [0.4, -14], [-0.2, -20.5], [-6, -23.3], [-12, -22.9]].forEach(([x, z], i) => {
      const b = P.decal(T.bloodDecal(60 + i), 1.1, 1.1);
      b.rotation.x = -Math.PI / 2;
      b.position.set(x, 0.012, z);
      s.add(b);
    });
    // a knocked over chair and a table
    const chair = new THREE.Group();
    P.box(0.45, 0.05, 0.45, P.M.darkWood, 0, 0.45, 0, chair);
    P.box(0.45, 0.5, 0.05, P.M.darkWood, 0, 0.72, -0.2, chair);
    chair.position.set(0.7, 0.25, -10.5);
    chair.rotation.set(0, 0.6, Math.PI / 2);
    s.add(chair);
    const table = P.snookerTable({ length: 2.0, width: 1.0, cover: true });
    table.position.set(-0.6, 0, -17.5);
    table.rotation.y = Math.PI / 2;
    table.scale.setScalar(0.8);
    s.add(table);
    // camera path
    this.path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 1.62, -0.5),
        new THREE.Vector3(0, 1.62, -8),
        new THREE.Vector3(0.05, 1.62, -16),
        new THREE.Vector3(0, 1.62, -21.2),
        new THREE.Vector3(-0.6, 1.62, -22.9),
        new THREE.Vector3(-2.5, 1.62, -23.2),
        new THREE.Vector3(-9, 1.62, -23.2),
        new THREE.Vector3(-16.6, 1.62, -23.2),
      ],
      false,
      'centripetal',
    );
    this.length = this.path.getLength();
    this.turnAt = 21.0 / this.length; // where the "turn left" prompt shows
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  /** pose the camera at path position u (0..1) */
  pose(u, t, speed, lookBack = 0) {
    const c = this.camera;
    u = Math.min(0.999, Math.max(0, u));
    this.path.getPointAt(u, this.tmp);
    this.path.getPointAt(Math.min(1, u + 0.02), this.tmp2);
    const k = Math.min(1, speed / 5);
    c.position.copy(this.tmp);
    c.position.y += Math.abs(Math.sin(t * 9)) * 0.07 * k;
    c.position.x += Math.sin(t * 4.5) * 0.03 * k;
    const dir = this.tmp2.sub(this.tmp);
    const yaw = Math.atan2(-dir.x, -dir.z) + lookBack;
    c.rotation.set(-0.02 + Math.sin(t * 9) * 0.01 * k, yaw, Math.sin(t * 4.5) * 0.02 * k, 'YXZ');
    // move the light pool to the closest fixtures
    const sorted = this.fixtures
      .map((f, i) => [f.distanceToSquared(c.position) + (i * 0.0001), f])
      .sort((a, b) => a[0] - b[0])
      .slice(0, this.pool.length);
    sorted.forEach(([, f], i) => {
      this.pool[i].position.copy(f).y -= 0.25;
    });
  }

  flicker(t) {
    const pass = 0.75 + 0.25 * Math.sin(t * 50) * Math.sin(t * 13);
    const off = Math.sin(t * 2.3) > 0.97;
    this.pool.forEach((L, i) => (L.intensity = off && i === 0 ? 0.2 : 3.5 * pass));
    this.fixtureMats.forEach((m, i) => m.color.copy(m.userData.base).multiplyScalar(off && i % 3 === 0 ? 0.1 : pass));
  }
}
