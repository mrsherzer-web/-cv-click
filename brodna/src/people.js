import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHead } from './faces.js';
import { clamp, damp, dampAngle, smooth } from './util.js';

// Bone layout (metres, bind pose, character faces +Z, its left is +X).
const BONES = [
  ['root', null, [0, 0, 0]],
  ['pelvis', 'root', [0, 0.93, 0]],
  ['spine', 'pelvis', [0, 0.12, 0]],
  ['chest', 'spine', [0, 0.2, 0]],
  ['neck', 'chest', [0, 0.25, 0]],
  ['head', 'neck', [0, 0.06, 0]],
  ['shL', 'chest', [0.2, 0.19, 0]],
  ['elL', 'shL', [0, -0.28, 0]],
  ['handL', 'elL', [0, -0.26, 0]],
  ['shR', 'chest', [-0.2, 0.19, 0]],
  ['elR', 'shR', [0, -0.28, 0]],
  ['handR', 'elR', [0, -0.26, 0]],
  ['hipL', 'pelvis', [0.1, -0.03, 0]],
  ['knL', 'hipL', [0, -0.43, 0]],
  ['ftL', 'knL', [0, -0.43, 0]],
  ['hipR', 'pelvis', [-0.1, -0.03, 0]],
  ['knR', 'hipR', [0, -0.43, 0]],
  ['ftR', 'knR', [0, -0.43, 0]],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const ANIM_BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'hipL', 'knL', 'ftL', 'hipR', 'knR', 'ftR'];

// World-space bind position of every bone.
const BIND = (() => {
  const out = {};
  for (const [name, parent, off] of BONES) {
    const p = parent ? out[parent] : [0, 0, 0];
    out[name] = [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
  }
  return out;
})();

function lathe(points, segs = 20, zScale = 1) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs, Math.PI, Math.PI * 2);
  if (zScale !== 1) g.scale(1, 1, zScale);
  return g;
}

function limb(r0, r1, len, segs = 12) {
  // cylinder from y=0 down to y=-len with rounded ends
  const g = new THREE.CapsuleGeometry((r0 + r1) / 2, len, 4, segs);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = clamp((y + len / 2) / len, 0, 1); // 0 bottom, 1 top
    const k = (r1 + (r0 - r1) * t) / ((r0 + r1) / 2);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.translate(0, -len / 2, 0);
  g.computeVertexNormals();
  return g;
}

// Attach skinning attributes: weights(x,y,z) -> [[boneIndex, weight], ...]
function skin(geo, weightsFn) {
  const n = geo.attributes.position.count;
  const idx = new Uint16Array(n * 4);
  const wts = new Float32Array(n * 4);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(geo.attributes.position, i);
    const ws = weightsFn(p);
    for (let k = 0; k < Math.min(4, ws.length); k++) {
      idx[i * 4 + k] = ws[k][0];
      wts[i * 4 + k] = ws[k][1];
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  return geo;
}

const rigid = (bone) => () => [[BI[bone], 1]];
const blend = (a, b, y0, y1) => (p) => {
  const t = smooth(y0, y1, p.y);
  return [
    [BI[a], 1 - t],
    [BI[b], t],
  ];
};

function at(geo, bone, dx = 0, dy = 0, dz = 0) {
  const b = BIND[bone];
  geo.translate(b[0] + dx, b[1] + dy, b[2] + dz);
  return geo;
}

function shirtTexture(o) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = o.shirt;
  g.fillRect(0, 0, 512, 512);
  // soft fabric noise
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.035)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // u=0.5 is the chest; v runs bottom (waist) to top (shoulders)
  if (o.print === 'lisbon') {
    g.fillStyle = '#7fe0c4';
    g.font = 'italic 700 46px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('Lisbon', 256, 190);
    g.font = '600 18px Arial';
    g.fillText('CITY OF LIGHT', 256, 214);
  } else if (o.print === 'cactus') {
    g.strokeStyle = '#2a2723';
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(256, 300, 34, 60, 0, 0, Math.PI * 2);
    g.stroke();
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(256 + k * 12, 250);
      g.lineTo(256 + k * 12, 350);
      g.stroke();
    }
    g.font = '700 40px Arial';
    g.fillStyle = '#2a2723';
    g.fillText('R', 330, 270);
    g.fillText('V', 330, 312);
  } else if (o.print === 'flag') {
    g.fillStyle = '#ffffff';
    g.fillRect(352, 80, 70, 48);
    g.fillStyle = '#1b4fb5';
    g.fillRect(352, 86, 70, 7);
    g.fillRect(352, 115, 70, 7);
    g.strokeStyle = '#1b4fb5';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(387, 94);
    g.lineTo(377, 112);
    g.lineTo(397, 112);
    g.closePath();
    g.moveTo(387, 116);
    g.lineTo(377, 98);
    g.lineTo(397, 98);
    g.closePath();
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function fabric(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

function buildBody(o, skinColor) {
  const parts = { shirt: [], pants: [], skin: [], shoes: [], coat: [], accent: [] };
  const w = o.build || 1;
  const add = (key, geo) => parts[key].push(geo);

  // torso: waist to shoulders, blended between spine and chest
  const tank = o.top === 'tank';
  const torsoPts = [
    [0.0, 0.96],
    [0.14 * w, 0.96],
    [0.152 * w, 1.06],
    [0.165 * w, 1.2],
    [0.178 * w, 1.33],
    [0.17 * w, 1.42],
    [0.12 * w, 1.47],
    [0.06, 1.5],
    [0.0, 1.5],
  ];
  add('shirt', skin(lathe(torsoPts, 22, 0.66), blend('spine', 'chest', 1.08, 1.32)));
  // hips
  add('pants', skin(lathe([[0.0, 0.84], [0.11 * w, 0.84], [0.148 * w, 0.9], [0.145 * w, 0.99], [0.0, 0.99]], 18, 0.7), rigid('pelvis')));
  add('accent', skin(lathe([[0.149 * w, 0.955], [0.15 * w, 0.985]], 18, 0.7), rigid('pelvis')));
  // neck
  add('skin', skin(at(new THREE.CylinderGeometry(0.052, 0.06, 0.12, 12), 'neck', 0, 0.02, 0.005), blend('chest', 'neck', 1.46, 1.54)));
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    // shoulders + arms
    add(tank ? 'skin' : 'shirt', skin(at(new THREE.SphereGeometry(0.075 * w, 14, 10), 'sh' + L), rigid('sh' + L)));
    add('skin', skin(at(limb(0.055 * w, 0.045 * w, 0.27), 'sh' + L), rigid('sh' + L)));
    if (!tank) add('shirt', skin(at(limb(0.074 * w, 0.064 * w, 0.13), 'sh' + L, 0, -0.01), rigid('sh' + L)));
    add('skin', skin(at(limb(0.044 * w, 0.034, 0.25), 'el' + L), rigid('el' + L)));
    const hand = new THREE.SphereGeometry(0.048, 12, 10);
    hand.scale(0.75, 1.15, 1.0);
    add('skin', skin(at(hand, 'hand' + L, 0, -0.04), rigid('hand' + L)));
    if (o.watch && s > 0) add('accent', skin(at(new THREE.CylinderGeometry(0.041, 0.041, 0.035, 12), 'hand' + L, 0, 0.03), rigid('el' + L)));
    // legs
    const shorts = o.legs === 'shorts';
    add('pants', skin(at(limb(0.088 * w, 0.064 * w, 0.42), 'hip' + L), rigid('hip' + L)));
    if (shorts) {
      add('skin', skin(at(limb(0.058, 0.044, 0.41), 'kn' + L), rigid('kn' + L)));
      add('pants', skin(at(limb(0.072 * w, 0.07 * w, 0.08), 'kn' + L, 0, 0.02), rigid('kn' + L)));
    } else {
      add('pants', skin(at(limb(0.064 * w, 0.05 * w, 0.41), 'kn' + L), rigid('kn' + L)));
    }
    const shoe = new THREE.BoxGeometry(0.105, 0.075, 0.27, 2, 1, 3);
    const sp = shoe.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const z = sp.getZ(i);
      if (z > 0.08) sp.setY(i, sp.getY(i) * 0.8 - 0.004);
      sp.setX(i, sp.getX(i) * (z > 0.1 ? 0.85 : 1));
    }
    shoe.computeVertexNormals();
    add('shoes', skin(at(shoe, 'ft' + L, 0, -0.005, 0.045), rigid('ft' + L)));
  }
  if (o.chain) {
    const chain = new THREE.TorusGeometry(0.075, 0.006, 6, 30);
    chain.rotateX(Math.PI / 2 - 0.35);
    add('accent', skin(at(chain, 'chest', 0, 0.19, 0.035), rigid('chest')));
  }
  if (o.coat) {
    // lab coat: open at the front, from the shoulders to above the knees
    const coat = new THREE.LatheGeometry(
      [[0.22, 0.6], [0.2, 0.8], [0.185, 1.0], [0.19, 1.2], [0.198, 1.34], [0.18, 1.44], [0.12, 1.49]].map(([r, y]) => new THREE.Vector2(r * w, y)),
      22,
      0.28,
      Math.PI * 2 - 0.56
    );
    coat.scale(1, 1, 0.72);
    add('coat', skin(coat, (p) => (p.y > 1.0 ? blend('spine', 'chest', 1.08, 1.32)(p) : [[BI.pelvis, 1]])));
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R';
      add('coat', skin(at(limb(0.08 * w, 0.07 * w, 0.42), 'sh' + L, 0, 0.0), rigid('sh' + L)));
      add('coat', skin(at(limb(0.066, 0.058, 0.2), 'el' + L), rigid('el' + L)));
    }
  }
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7, emissive: skinColor, emissiveIntensity: 0.18 });
  const mats = {
    shirt: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: shirtTexture(o) }),
    pants: fabric(o.pants, 0.92),
    skin: skinMat,
    shoes: fabric(o.shoes, 0.6),
    coat: fabric('#f2f3f0', 0.8),
    accent: new THREE.MeshStandardMaterial({ color: o.accent || '#c9ccd1', roughness: 0.35, metalness: 0.6 }),
  };
  const geos = [];
  const materials = [];
  for (const key of Object.keys(parts)) {
    if (!parts[key].length) continue;
    geos.push(mergeGeometries(parts[key], false));
    materials.push(mats[key]);
  }
  const geo = mergeGeometries(geos, true);
  return { geo, materials, skinMat };
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

export class Person {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.def = def;
    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.phase = Math.random() * 6;
    this.pose = null; // overrides locomotion: sit, drive, tied, phone, shout, grab, dragged, celebrate, crouch, interact, hidden
    this.lookTarget = null;
    this.talking = false;
    this.t = Math.random() * 10;
    this.radius = 0.3;
    this.goal = null;
    this.onArrive = null;
    this.driven = false;
    this.passTag = null; // collider tag this person walks through (Yiftach has the keys to his own doors)
    this.build(def);
  }

  build(def) {
    const face = def.face || null;
    const skinRGB = face?.skin || def.skin || [0.78, 0.58, 0.47];
    const skinColor = new THREE.Color().setRGB(...skinRGB, THREE.SRGBColorSpace);
    const body = buildBody(def.outfit, skinColor);
    this.bodySkin = body.skinMat;
    this.bones = {};
    const boneList = BONES.map(([name, , off]) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(...off);
      this.bones[name] = b;
      return b;
    });
    for (const [name, parent] of BONES) if (parent) this.bones[parent].add(this.bones[name]);
    const mesh = new THREE.SkinnedMesh(body.geo, body.materials);
    mesh.add(this.bones.root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(boneList));
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.inner = new THREE.Group();
    this.inner.add(mesh);
    this.group.add(this.inner);
    const onSkin = (c) => {
      this.skinMatch = c.clone();
      this.bodySkin.color.copy(c);
      this.bodySkin.emissive.copy(c);
    };
    this.head = buildHead({ face, hairStyle: def.hair, hairColor: def.hairColor, skinColor: skinRGB, seed: def.seed || 1, onSkin });
    this.head.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.bones.head.add(this.head);
    if (def.scale) this.inner.scale.setScalar(def.scale);
    this.rest = {};
    for (const n of ANIM_BONES) this.rest[n] = this.bones[n].quaternion.clone();
    this.targets = Object.fromEntries(ANIM_BONES.map((n) => [n, [0, 0, 0]]));
  }

  setOutfit(outfit) {
    // rebuild only the body (e.g. Yiftach puts on his lab coat)
    const skinRGB = this.def.face?.skin || this.def.skin || [0.78, 0.58, 0.47];
    const body = buildBody(outfit, this.skinMatch || new THREE.Color().setRGB(...skinRGB, THREE.SRGBColorSpace));
    this.mesh.geometry.dispose();
    this.mesh.geometry = body.geo;
    this.mesh.material = body.materials;
    this.bodySkin = body.skinMat;
    this.def.outfit = outfit;
  }

  place(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.goal = null;
  }

  headWorld(out) {
    return this.head.getWorldPosition(out).add(_v.set(0, 0.11, 0));
  }

  forward(out) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  // Walk (or run) to a point; resolves when there.
  walkTo(x, z, { run = false, speed, near = 0.25 } = {}) {
    this.goal = new THREE.Vector3(x, 0, z);
    this.goalSpeed = speed || (run ? 5.2 : 1.6);
    this.goalNear = near;
    this.goalBest = Infinity;
    this.goalStuck = 0;
    return new Promise((res) => (this.onArrive = res));
  }

  stop() {
    this.goal = null;
    const cb = this.onArrive;
    this.onArrive = null;
    if (cb) cb();
  }

  faceTo(x, z) {
    this.faceYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  // Locomotion for NPCs walking to a goal or following someone.
  ai(dt, world) {
    if (this.driven) {
      this.move(dt, world);
      return;
    }
    let want = null;
    let spd = 0;
    if (this.goal) {
      const dx = this.goal.x - this.pos.x;
      const dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      // a blocked goal must never hang a cutscene: give up once progress stalls
      if (d < this.goalBest - 0.05) {
        this.goalBest = d;
        this.goalStuck = 0;
      } else this.goalStuck += dt;
      if (d < this.goalNear || this.goalStuck > 1.6) {
        this.stop();
      } else {
        want = [dx / d, dz / d];
        spd = Math.min(this.goalSpeed, d * 3);
      }
    } else if (this.follow) {
      const f = this.follow;
      let tx = f.target.pos.x + f.offset.x;
      let tz = f.target.pos.z + f.offset.z;
      let d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      const trail = f.trail;
      if (trail) {
        // out of sight of the leader: walk the leader's breadcrumbs round the corner instead of into the wall
        if (world && trail.length && world.blocked(this.pos.x, this.pos.z, f.target.pos.x, f.target.pos.z, this.pos.y + 1.0)) {
          while (trail.length > 1 && Math.hypot(trail[0].x - this.pos.x, trail[0].z - this.pos.z) < 0.7) trail.shift();
          tx = trail[0].x;
          tz = trail[0].z;
          d = Math.max(Math.hypot(tx - this.pos.x, tz - this.pos.z), f.dist + 1.2);
        } else trail.length = 0;
      }
      const dx = tx - this.pos.x;
      const dz = tz - this.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      if (d > f.dist) {
        want = [dx / dl, dz / dl];
        spd = clamp((d - f.dist) * 2.2, 0, Math.max(5.5, f.target.speed + 0.5));
      }
    }
    if (want) {
      this.vel.x = damp(this.vel.x, want[0] * spd, 8, dt);
      this.vel.z = damp(this.vel.z, want[1] * spd, 8, dt);
    } else {
      this.vel.x = damp(this.vel.x, 0, 10, dt);
      this.vel.z = damp(this.vel.z, 0, 10, dt);
    }
    this.move(dt, world);
  }

  move(dt, world) {
    if (this.pose === 'sit' || this.pose === 'drive' || this.pose === 'tied' || this.pose === 'hidden') {
      this.speed = 0;
      return;
    }
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    if (world) {
      const r = world.resolve(nx, nz, this.radius, this.pos.y, this.passTag);
      this.pos.x = r[0];
      this.pos.z = r[1];
      this.pos.y = world.ground(this.pos.x, this.pos.z);
    } else {
      this.pos.x = nx;
      this.pos.z = nz;
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.15) this.faceYaw = Math.atan2(this.vel.x, this.vel.z);
  }

  _set(b, x, y = 0, z = 0) {
    const t = this.targets[b];
    t[0] = x;
    t[1] = y;
    t[2] = z;
  }

  animate(dt, camera) {
    this.t += dt;
    if (this.faceYaw !== undefined) this.yaw = dampAngle(this.yaw, this.faceYaw, this.pose ? 6 : 10, dt);
    this.group.rotation.y = this.yaw;
    for (const n of ANIM_BONES) this._set(n, 0, 0, 0);
    const t = this.t;
    const sp = this.speed;
    let pelvisY = 0;
    let pelvisZ = 0;
    const pose = this.pose;
    if (pose === 'hidden') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    if (pose === 'sit' || pose === 'drive' || pose === 'tied') {
      this._set('hipL', -1.5, 0, 0.06);
      this._set('hipR', -1.5, 0, -0.06);
      this._set('knL', 1.5);
      this._set('knR', 1.5);
      pelvisY = -0.45;
      if (pose === 'drive') {
        this._set('shL', -1.0, 0, 0.25);
        this._set('shR', -1.0, 0, -0.25);
        this._set('elL', -0.7);
        this._set('elR', -0.7);
        this._set('spine', -0.12);
      } else if (pose === 'tied') {
        const struggle = Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.03;
        this._set('shL', 0.55, 0, 0.12);
        this._set('shR', 0.55, 0, -0.12);
        this._set('elL', -0.4, 0.6);
        this._set('elR', -0.4, -0.6);
        this._set('spine', 0.18 + struggle);
        this._set('chest', 0.05, struggle * 2);
        this._set('head', 0.35 + struggle);
      } else {
        this._set('shL', -0.25, 0, 0.15);
        this._set('shR', -0.25, 0, -0.15);
        this._set('elL', -0.9);
        this._set('elR', -0.9);
      }
    } else if (sp > 0.2 && pose !== 'dragged') {
      const crouch = pose === 'crouch';
      const runK = smooth(2.2, 4.6, sp);
      this.phase += dt * (sp * (crouch ? 2.6 : 2.15) + 1.2);
      const s = Math.sin(this.phase);
      const c = Math.cos(this.phase);
      const amp = (crouch ? 0.5 : 0.55) + 0.35 * runK;
      this._set('hipL', -amp * s - (crouch ? 0.6 : 0), 0, 0.03);
      this._set('hipR', amp * s - (crouch ? 0.6 : 0), 0, -0.03);
      this._set('knL', 0.15 + (0.9 + 0.5 * runK) * Math.max(0, c) + (crouch ? 0.8 : 0));
      this._set('knR', 0.15 + (0.9 + 0.5 * runK) * Math.max(0, -c) + (crouch ? 0.8 : 0));
      this._set('ftL', -0.15 * s);
      this._set('ftR', 0.15 * s);
      this._set('shL', (0.45 + 0.4 * runK) * s, 0, 0.12);
      this._set('shR', -(0.45 + 0.4 * runK) * s, 0, -0.12);
      this._set('elL', -0.35 - 0.9 * runK);
      this._set('elR', -0.35 - 0.9 * runK);
      this._set('spine', 0.05 + 0.18 * runK + (crouch ? 0.45 : 0), 0.1 * s);
      this._set('chest', 0, -0.12 * s);
      pelvisY = -Math.abs(c) * (0.025 + 0.04 * runK) - (crouch ? 0.22 : 0);
    } else {
      const b = Math.sin(t * 1.6);
      this._set('spine', 0.02 * b);
      this._set('chest', 0.015 * b);
      this._set('shL', 0.04, 0, 0.12 + 0.02 * b);
      this._set('shR', 0.04, 0, -0.12 - 0.02 * b);
      this._set('elL', -0.18);
      this._set('elR', -0.18);
      this._set('hipL', 0, 0.05, 0.04);
      this._set('hipR', 0, -0.05, -0.04);
      if (pose === 'crouch') {
        this._set('hipL', -1.1, 0, 0.12);
        this._set('hipR', -0.6, 0, -0.12);
        this._set('knL', 1.9);
        this._set('knR', 1.3);
        this._set('spine', 0.5);
        pelvisY = -0.38;
      }
    }
    if (this.talking && !pose) {
      const g = Math.sin(t * 2.3);
      this._set('shR', -0.35 + 0.2 * g, 0.2, -0.35);
      this._set('elR', -1.2 - 0.25 * Math.sin(t * 4.1));
      this._set('head', 0.06 * Math.sin(t * 5.3));
    }
    switch (pose) {
      case 'phone':
        this._set('shL', -0.3, 0, 0.55);
        this._set('elL', -2.4, -0.4);
        this._set('head', 0.12, 0.25);
        break;
      case 'shout':
        this._set('shL', -0.6, 0, 1.0);
        this._set('shR', -0.6, 0, -1.0);
        this._set('elL', -0.6);
        this._set('elR', -0.6);
        this._set('spine', 0.2 + 0.05 * Math.sin(t * 9));
        this._set('head', 0.15 + 0.06 * Math.sin(t * 13));
        break;
      case 'grab':
        this._set('shL', -1.35, 0, 0.1);
        this._set('shR', -1.35, 0, -0.1);
        this._set('elL', -0.4);
        this._set('elR', -0.4);
        this._set('spine', 0.2);
        break;
      case 'dragged':
        this._set('shL', -1.3, 0, 0.3);
        this._set('shR', -0.4, 0, -0.8);
        this._set('spine', -0.35);
        this._set('hipL', -0.5);
        this._set('hipR', -0.2);
        this._set('knL', 0.3);
        this._set('head', -0.3, 0.3 * Math.sin(t * 6));
        break;
      case 'celebrate':
        this._set('shL', -2.7 + 0.2 * Math.sin(t * 6), 0, 0.3);
        this._set('shR', -2.7 - 0.2 * Math.sin(t * 6), 0, -0.3);
        this._set('elL', -0.3);
        this._set('elR', -0.3);
        pelvisY = Math.abs(Math.sin(t * 6)) * 0.08;
        break;
      case 'interact':
        this._set('shR', -1.2, 0, -0.1);
        this._set('elR', -0.4);
        this._set('spine', 0.25);
        break;
      case 'scared':
        this._set('shL', -0.8, 0, 0.4);
        this._set('shR', -0.8, 0, -0.4);
        this._set('elL', -1.8);
        this._set('elR', -1.8);
        this._set('spine', -0.1);
        break;
      case 'armsCrossed':
        this._set('shL', -0.5, 0, 0.35);
        this._set('shR', -0.5, 0, -0.35);
        this._set('elL', -1.9, -0.6);
        this._set('elR', -1.9, 0.6);
        break;
    }

    // head look-at, relative to the chest
    let hy = 0;
    let hx = this.targets.head[0];
    if (this.lookTarget) {
      this.bones.chest.getWorldQuaternion(_q).invert();
      const hp = this.head.getWorldPosition(_v);
      const dir = new THREE.Vector3().subVectors(this.lookTarget, hp).applyQuaternion(_q);
      hy = clamp(Math.atan2(dir.x, dir.z), -1.1, 1.1);
      hx = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.6) + this.targets.head[0] * 0.5;
    }
    const neckShare = 0.35;
    this.targets.neck[1] += hy * neckShare;
    this.targets.head[1] += hy * (1 - neckShare);
    this.targets.head[0] = hx;

    const k = 1 - Math.exp(-12 * dt);
    for (const n of ANIM_BONES) {
      const a = this.targets[n];
      _e.set(a[0], a[1], a[2], n === 'head' || n === 'neck' ? 'YXZ' : 'XYZ');
      _q.setFromEuler(_e).premultiply(this.rest[n]);
      this.bones[n].quaternion.slerp(_q, k);
    }
    const pb = this.bones.pelvis.position;
    pb.y = damp(pb.y, 0.93 + pelvisY, 12, dt);
    pb.z = damp(pb.z, pelvisZ, 12, dt);
  }
}

// Background shoppers: same rig, no scan.
export function extraDef(i, r) {
  const shirts = ['#2b4c7e', '#a33b3b', '#e7e3da', '#1d1f24', '#6b8f5e', '#d1a94f', '#7b5ea7', '#c96e3a'];
  const pants = ['#2e3a52', '#1f2125', '#6d6455', '#4a5a78', '#3b3b3b'];
  const skins = [[0.86, 0.67, 0.55], [0.74, 0.55, 0.42], [0.6, 0.42, 0.31], [0.9, 0.74, 0.62]];
  const hairs = ['buzz', 'short', 'wavy', 'quiff'];
  return {
    id: 'extra' + i,
    name: '',
    skin: skins[Math.floor(r() * skins.length)],
    hair: hairs[Math.floor(r() * hairs.length)],
    hairColor: r() < 0.7 ? [0.08, 0.07, 0.06] : [0.35, 0.24, 0.15],
    seed: 100 + i,
    scale: 0.94 + r() * 0.1,
    outfit: {
      shirt: shirts[Math.floor(r() * shirts.length)],
      pants: pants[Math.floor(r() * pants.length)],
      shoes: r() < 0.5 ? '#e9e7e2' : '#222',
      legs: r() < 0.3 ? 'shorts' : 'jeans',
    },
  };
}
