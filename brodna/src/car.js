import * as THREE from 'three';
import { clamp, damp } from './util.js';

const SEATS = {
  driver: [0.37, 0.12, 0.2],
  front: [-0.37, 0.12, 0.2],
  rearL: [0.37, 0.12, -0.72],
  rearR: [-0.37, 0.12, -0.72],
};

function profileShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// A small white hatchback built from extruded side profiles.
export function carModel({ color = '#f4f4f2', dark = false } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: dark ? 0x05070a : 0x0d1117, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.82 });
  const black = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7 });
  // side profile (x = length, forward +), extruded across the width
  const body = new THREE.ExtrudeGeometry(
    profileShape([[2.0, 0.32], [2.02, 0.62], [1.7, 0.82], [0.95, 0.96], [-1.55, 1.0], [-1.98, 0.92], [-2.02, 0.4], [-1.9, 0.28], [1.9, 0.26]]),
    { depth: 1.62, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 4 }
  );
  body.translate(0, 0, -0.81);
  body.rotateY(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(body, paint);
  bodyMesh.castShadow = true;
  g.add(bodyMesh);
  const cabin = new THREE.ExtrudeGeometry(profileShape([[0.92, 0.96], [0.22, 1.42], [-1.35, 1.43], [-1.86, 1.0]]), {
    depth: 1.44,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  cabin.translate(0, 0, -0.72);
  cabin.rotateY(-Math.PI / 2);
  g.add(new THREE.Mesh(cabin, glass));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 1.5), paint);
  roof.position.set(0, 1.47, -0.58);
  roof.castShadow = true;
  g.add(roof);
  // wheels
  const tire = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20);
  tire.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12);
  rim.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 });
  g.userData.wheels = [];
  for (const [x, z] of [[0.8, 1.3], [-0.8, 1.3], [0.8, -1.25], [-0.8, -1.25]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.33, z);
    const t = new THREE.Mesh(tire, black);
    t.castShadow = true;
    w.add(t, new THREE.Mesh(rim, rimMat));
    g.add(w);
    g.userData.wheels.push(w);
  }
  // lights
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 2.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.6 });
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), head);
    h.position.set(s * 0.58, 0.66, 2.04);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), tail);
    r.position.set(s * 0.62, 0.78, -2.06);
    g.add(h, r);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.5 }));
  plate.position.set(0, 0.42, 2.09);
  g.add(plate);
  const plate2 = plate.clone();
  plate2.position.set(0, 0.5, -2.09);
  g.add(plate2);
  return g;
}

// Arcade driving: bicycle steering, terrain following, bump-and-stop collisions.
export class Car {
  constructor(scene, opts = {}) {
    this.group = new THREE.Group();
    this.model = carModel(opts);
    this.group.add(this.model);
    scene.add(this.group);
    this.pos = this.group.position;
    this.yaw = 0;
    this.speed = 0;
    this.steer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.max = opts.max || 23;
    this.occupants = [];
    this.lights = null;
    if (opts.headlights) {
      const l = new THREE.SpotLight(0xfff1d0, 60, 70, 0.55, 0.6, 1.3);
      l.position.set(0, 0.8, 1.9);
      l.target.position.set(0, 0, 14);
      this.model.add(l, l.target);
      this.lights = l;
    }
  }

  place(x, z, yaw, world) {
    this.pos.set(x, world ? world.ground(x, z) : 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.group.rotation.set(0, yaw, 0);
  }

  seat(person, which) {
    const s = SEATS[which];
    person.pose = which === 'driver' ? 'drive' : 'sit';
    person.lookTarget = null;
    this.model.add(person.group);
    person.group.position.set(s[0], s[1], s[2]);
    person.group.rotation.set(0, 0, 0);
    person.yaw = 0;
    person.faceYaw = 0;
    this.occupants.push(person);
  }

  unseat(person, scene, world, side = 1) {
    this.model.remove(person.group);
    scene.add(person.group);
    this.occupants = this.occupants.filter((p) => p !== person);
    person.pose = null;
    const off = new THREE.Vector3(side * 1.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const x = this.pos.x + off.x;
    const z = this.pos.z + off.z;
    person.place(x, world.ground(x, z), z, this.yaw);
    person.faceYaw = this.yaw;
  }

  update(dt, input, world, drive = true) {
    const thr = drive ? input.my : 0;
    const st = drive ? input.mx : 0;
    if (thr > 0.05) this.speed += thr * (this.speed < 0 ? 16 : 7.5) * dt;
    else if (thr < -0.05) this.speed += thr * (this.speed > 0.5 ? 14 : 4) * dt;
    else this.speed = damp(this.speed, 0, 0.9, dt);
    this.speed -= this.speed * 0.08 * dt;
    this.speed = clamp(this.speed, -6, this.max);
    const steerMax = 0.55 * (1 - 0.45 * Math.min(1, Math.abs(this.speed) / this.max));
    this.steer = damp(this.steer, -st * steerMax, 7, dt);
    this.yaw += (this.speed / 2.6) * Math.tan(this.steer) * dt;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let nx = this.pos.x + fx * this.speed * dt;
    let nz = this.pos.z + fz * this.speed * dt;
    if (world) {
      // two circles approximate the body
      let hitAny = false;
      for (const k of [1.25, -1.25]) {
        const cx = nx + fx * k;
        const cz = nz + fz * k;
        const r = world.resolve(cx, cz, 0.95, this.pos.y, 'car');
        if (Math.abs(r[0] - cx) + Math.abs(r[1] - cz) > 1e-4) {
          nx += r[0] - cx;
          nz += r[1] - cz;
          hitAny = true;
        }
      }
      if (hitAny && Math.abs(this.speed) > 2) {
        this.bumped = Math.abs(this.speed);
        this.speed *= -0.25;
      } else if (hitAny) this.speed *= 0.5;
      this.pos.x = nx;
      this.pos.z = nz;
      const g = world.ground(nx, nz);
      this.pos.y = damp(this.pos.y, g, 18, dt);
      const gf = world.ground(nx + fx * 1.3, nz + fz * 1.3);
      const gb = world.ground(nx - fx * 1.3, nz - fz * 1.3);
      const gl = world.ground(nx + fz * 0.8, nz - fx * 0.8);
      const gr = world.ground(nx - fz * 0.8, nz + fx * 0.8);
      this.pitch = damp(this.pitch, -Math.atan2(gf - gb, 2.6), 10, dt);
      this.roll = damp(this.roll, Math.atan2(gl - gr, 1.6), 10, dt);
    } else {
      this.pos.x = nx;
      this.pos.z = nz;
    }
    this.group.rotation.set(0, this.yaw, 0);
    this.model.rotation.set(this.pitch, 0, this.roll);
    for (const w of this.model.userData.wheels) w.children.forEach((c) => (c.rotation.x += (this.speed * dt) / 0.33));
    const fw = this.model.userData.wheels;
    fw[0].rotation.y = fw[1].rotation.y = this.steer;
  }
}
