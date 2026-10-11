import * as THREE from 'three';
import { fogPatch } from './shared.js';
import { featherFace, defaultFace } from './face.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const AHEAD = new THREE.Vector3(0, 0, -1);
const Q_ID = new THREE.Quaternion();
const vUp = new THREE.Vector3();
const vFwd = new THREE.Vector3();
const vSide = new THREE.Vector3();
const vTmp = new THREE.Vector3();
const vTmp2 = new THREE.Vector3();
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const mA = new THREE.Matrix4();
const eA = new THREE.Euler();

export const SUITS = [
  { label: 'אדום ושחור', base: '#b51f2e', accent: '#17171d' },
  { label: 'שחור וזהב', base: '#1c1e26', accent: '#d8a23e' },
  { label: 'כחול ולבן', base: '#1e4ea6', accent: '#eef1f6' },
  { label: 'ירוק זית', base: '#4c5631', accent: '#cdb98c' },
];

const JOINTS = ['chest', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];

function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function suitTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  g.lineWidth = 2;
  for (let i = -256; i < 512; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.moveTo(i + 256, 0);
    g.lineTo(i, 256);
    g.stroke();
  }
  return canvasTex(c, 2);
}

// The striped knit beanie from the video call.
function hatTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const bands = [
    [0, 0.17, '#17181c'],
    [0.17, 0.29, '#a8a6c4'],
    [0.29, 0.37, '#e6e3d6'],
    [0.37, 0.47, '#e2cf62'],
    [0.47, 0.57, '#b9b6d0'],
    [0.57, 1, '#2e4630'],
  ];
  for (const [a, b, col] of bands) {
    g.fillStyle = col;
    g.fillRect(0, 256 * (1 - b), 128, 256 * (b - a) + 1);
  }
  for (let x = 0; x < 128; x += 6) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(x, 0, 2, 256);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(x + 3, 0, 1, 256);
  }
  for (let y = 0; y < 256; y += 5) {
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.fillRect(0, y, 128, 1);
  }
  return canvasTex(c);
}

function emblemCanvas(letter, base, accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = accent;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = base;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = base;
  g.font = '700 86px Karantina, "Secular One", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  return c;
}

function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
}

export class Hero {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.mSuit = fogPatch(new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, map: suitTexture() }));
    this.mAccent = fogPatch(new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.1 }));
    this.mSkin = fogPatch(new THREE.MeshStandardMaterial({ color: 0xc8957a, roughness: 0.7, emissive: 0xc8957a, emissiveIntensity: 0.3 }));
    this.mHair = fogPatch(new THREE.MeshStandardMaterial({ color: 0x1a1411, roughness: 0.95 }));
    const faceTex = canvasTex(featherFace(defaultFace()));
    // A little self-light keeps the photo readable even with the sun behind the hero.
    this.mFace = fogPatch(new THREE.MeshStandardMaterial({ roughness: 0.75, transparent: true, map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.42 }));
    this.mHat = fogPatch(new THREE.MeshStandardMaterial({ roughness: 1, map: hatTexture() }));
    this.mEmblem = fogPatch(new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }));
    this.T = {};
    for (const j of JOINTS) this.T[j] = [0, 0, 0];
    this.phase = 0;
    this.activeHand = null;
    this.name = 'הגיבור';
    this.suit = SUITS[0];
    this._build();
    this._buildViewmodel();
    this.setSuit(SUITS[0]);
  }

  _build() {
    const J = (this.j = {});
    const body = (this.body = new THREE.Group());
    this.root.add(body);
    const pelvis = new THREE.Group();
    body.add(pelvis);
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), this.mSuit);
    hips.scale.set(1.08, 0.8, 0.8);
    pelvis.add(hips);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.187, 0.06, 18), this.mAccent);
    belt.scale.set(1.04, 1, 0.8);
    belt.position.y = 0.07;
    pelvis.add(belt);

    J.chest = new THREE.Group();
    J.chest.position.y = 0.08;
    pelvis.add(J.chest);
    const torso = capsule(0.19, 0.26, this.mSuit);
    torso.position.y = 0.28;
    torso.scale.set(1.22, 1, 0.76);
    J.chest.add(torso);
    this.emblem = new THREE.Mesh(new THREE.CircleGeometry(0.068, 24), this.mEmblem);
    this.emblem.position.set(0, 0.36, 0.148);
    J.chest.add(this.emblem);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.1, 10), this.mSkin);
    neck.position.y = 0.6;
    J.chest.add(neck);

    J.head = new THREE.Group();
    J.head.position.y = 0.62;
    J.chest.add(J.head);
    const R = 0.215;
    const hs = (this.headShape = new THREE.Group());
    hs.position.y = R * 0.92;
    hs.scale.set(0.93, 1.07, 1);
    J.head.add(hs);
    hs.add(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), this.mSkin));
    hs.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 28, 10, 0, Math.PI * 2, 0, 0.8), this.mHair));
    hs.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 20, 14, Math.PI * 1.5 - 1.45, 2.9, 0.2, 1.75), this.mHair));
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), this.mSkin);
      ear.position.set(s * R * 0.97, -R * 0.05, -R * 0.05);
      ear.scale.set(0.5, 1, 0.8);
      hs.add(ear);
    }
    // Front cap of the head with planar UVs: the photo is projected like a mask.
    const fg = new THREE.SphereGeometry(R * 1.012, 40, 32, Math.PI / 2 - 1.2, 2.4, 0.5, 1.95);
    const pos = fg.attributes.position;
    const uv = fg.attributes.uv;
    const S = R * 2 * 0.98;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / S, 0.5 + (pos.getY(i) + R * 0.06) / S);
    hs.add(new THREE.Mesh(fg, this.mFace));

    const pts = [
      [1.0, 0.28],
      [1.05, 0.42],
      [1.05, 0.62],
      [1.03, 0.86],
      [0.93, 1.1],
      [0.78, 1.36],
      [0.6, 1.62],
      [0.42, 1.86],
      [0.24, 2.08],
      [0.1, 2.24],
      [0, 2.3],
    ].map(([r, y]) => new THREE.Vector2(r * R, (y + 0.12) * R));
    this.hat = new THREE.Group();
    this.hat.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), this.mHat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.09, 8, 28), fogPatch(new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 1 })));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = R * 0.45;
    this.hat.add(rim);
    this.hat.rotation.set(-0.14, 0, 0.07);
    hs.add(this.hat);

    for (const side of [1, -1]) {
      const k = side > 0 ? 'L' : 'R';
      const sh = new THREE.Group();
      sh.position.set(0.27 * side, 0.47, 0);
      J.chest.add(sh);
      sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), this.mSuit));
      const upper = capsule(0.068, 0.19, this.mSuit);
      upper.position.y = -0.15;
      sh.add(upper);
      const el = new THREE.Group();
      el.position.y = -0.3;
      sh.add(el);
      const fore = capsule(0.06, 0.17, this.mAccent);
      fore.position.y = -0.13;
      el.add(fore);
      const hand = new THREE.Group();
      hand.position.y = -0.29;
      el.add(hand);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), this.mAccent);
      fist.scale.set(0.9, 1.1, 1);
      hand.add(fist);

      const hip = new THREE.Group();
      hip.position.set(0.11 * side, -0.05, 0);
      pelvis.add(hip);
      const thigh = capsule(0.095, 0.25, this.mSuit);
      thigh.position.y = -0.2;
      hip.add(thigh);
      const kn = new THREE.Group();
      kn.position.y = -0.41;
      hip.add(kn);
      const shin = capsule(0.078, 0.24, this.mAccent);
      shin.position.y = -0.19;
      kn.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), this.mAccent);
      foot.position.set(0, -0.4, 0.045);
      kn.add(foot);

      J['sh' + k] = sh;
      J['el' + k] = el;
      J['hand' + k] = hand;
      J['hip' + k] = hip;
      J['kn' + k] = kn;
    }
    J.head.rotation.order = 'YXZ';
    this.activeHand = J.handR;
  }

  // First-person arms, parented to the camera: each pivots at an off-screen shoulder.
  _buildViewmodel() {
    this.vm = new THREE.Group();
    this.vm.visible = false;
    this.vmArms = [];
    const along = (mesh, z) => {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = z;
      return mesh;
    };
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(0.26 * side, -0.34, 0.08);
      this.vm.add(g);
      g.add(along(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 10), this.mSuit), -0.14));
      g.add(along(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.24, 4, 10), this.mAccent), -0.43));
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), this.mAccent);
      fist.position.z = -0.6;
      g.add(fist);
      const tip = new THREE.Group();
      tip.position.z = -0.64;
      g.add(tip);
      const rest = new THREE.Vector3(0.15 * side, -1, -0.3).normalize();
      this.vmArms.push({ g, tip, side, rest, isActive: false });
    }
  }

  setSuit(suit) {
    this.suit = suit;
    this.mSuit.color.set(suit.base);
    this.mAccent.color.set(suit.accent);
    this._emblem();
  }

  setName(name) {
    this.name = name;
    this._emblem();
  }

  _emblem() {
    const letter = (this.name || '').trim().charAt(0) || '★';
    const tex = canvasTex(emblemCanvas(letter, this.suit.base, this.suit.accent));
    if (this.mEmblem.map) this.mEmblem.map.dispose();
    this.mEmblem.map = tex;
    this.mEmblem.needsUpdate = true;
  }

  setHat(on) {
    this.hat.visible = on;
  }

  setFace(faceCanvas, rgb) {
    const tex = canvasTex(featherFace(faceCanvas || defaultFace()));
    if (this.mFace.map) this.mFace.map.dispose();
    this.mFace.map = tex;
    this.mFace.emissiveMap = tex;
    this.mFace.needsUpdate = true;
    if (rgb) this.mSkin.color.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
    else this.mSkin.color.set(0xc8957a);
    this.mSkin.emissive.copy(this.mSkin.color);
  }

  headWorld(out) {
    return this.headShape.getWorldPosition(out);
  }

  webOrigin(out, pov) {
    if (pov) {
      const arm = this.vmArms.find((a) => a.isActive) || this.vmArms[0];
      return arm.tip.getWorldPosition(out);
    }
    return (this.activeHand || this.j.handR).getWorldPosition(out);
  }

  _set(j, x, y, z) {
    const a = this.T[j];
    a[0] = x;
    a[1] = y;
    a[2] = z;
  }

  update(dt, P, mode, camera, time) {
    const v = P.vel;
    const speed = v.length();
    const vh = Math.hypot(v.x, v.z);
    const up = vUp.set(0, 1, 0);
    const fwd = vFwd;
    if (vh > 1) fwd.set(v.x / vh, 0, v.z / vh);
    else fwd.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    let pose;
    if (P.state === 'swing') {
      pose = 'swing';
      up.subVectors(P.anchor, P.pos).normalize().lerp(UP, 0.25).normalize();
      if (speed > 2) fwd.copy(v).divideScalar(speed);
    } else if (P.state === 'air' || P.state === 'dead') {
      pose = P.boostTime < 0.5 ? 'zip' : 'fall';
      if (speed > 2) fwd.copy(v).divideScalar(speed);
      const dive = THREE.MathUtils.smoothstep(-v.y, 14, 34);
      if (pose === 'fall' && dive > 0) {
        up.lerp(vTmp.copy(v).divideScalar(Math.max(speed, 1e-3)), dive * 0.9).normalize();
        if (dive > 0.35) pose = 'dive';
      } else up.set(v.x * 0.005, 1, v.z * 0.005).normalize();
    } else if (P.state === 'wall') {
      pose = 'climb';
      fwd.set(-P.wallN.x, 0, -P.wallN.z);
    } else {
      pose = P.landTime < 0.42 ? 'land' : vh > 1.2 ? 'run' : 'idle';
      fwd.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    }
    if (pose === 'dive') fwd.set(0, -1, 0);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 0.04) {
      fwd.set(Math.sin(P.heading), 0, Math.cos(P.heading));
      fwd.addScaledVector(up, -fwd.dot(up));
    }
    fwd.normalize();
    const side = vSide.crossVectors(up, fwd).normalize();
    mA.makeBasis(side, up, fwd);
    qA.setFromRotationMatrix(mA);
    this.root.quaternion.slerp(qA, mode === 'title' ? 1 : 1 - Math.exp(-9 * dt));
    this.root.position.copy(P.pos);

    for (const j of JOINTS) this._set(j, 0, 0, 0);
    let bodyY = 0;
    let webSide = null;
    if (pose === 'swing') webSide = vTmp.subVectors(P.anchor, P.pos).dot(side) > 0 ? 'L' : 'R';
    const w = Math.sin(time * 5);
    switch (pose) {
      case 'idle':
        this._set('chest', Math.sin(time * 1.7) * 0.03, 0, 0);
        this._set('shL', 0.05, 0, 0.17);
        this._set('shR', 0.05, 0, -0.17);
        this._set('elL', -0.3, 0, 0);
        this._set('elR', -0.3, 0, 0);
        this._set('hipL', 0, 0, 0.04);
        this._set('hipR', 0, 0, -0.04);
        this._set('knL', 0.05, 0, 0);
        this._set('knR', 0.05, 0, 0);
        break;
      case 'run': {
        this.phase += dt * (5 + vh * 0.5);
        const s = Math.sin(this.phase);
        const c = Math.cos(this.phase);
        this._set('hipL', -0.95 * s, 0, 0.04);
        this._set('hipR', 0.95 * s, 0, -0.04);
        this._set('knL', 0.25 + 1.25 * Math.max(0, c), 0, 0);
        this._set('knR', 0.25 + 1.25 * Math.max(0, -c), 0, 0);
        this._set('shL', 0.8 * s, 0, 0.14);
        this._set('shR', -0.8 * s, 0, -0.14);
        this._set('elL', -1.35, 0, 0);
        this._set('elR', -1.35, 0, 0);
        this._set('chest', 0.25, 0.15 * s, 0);
        bodyY = Math.abs(c) * 0.05;
        break;
      }
      case 'fall':
        this._set('shL', -0.3 + 0.2 * w, 0, 2.1);
        this._set('shR', -0.3 - 0.2 * w, 0, -2.1);
        this._set('elL', -0.5, 0, 0);
        this._set('elR', -0.5, 0, 0);
        this._set('hipL', -0.6 + 0.25 * w, 0, 0.18);
        this._set('hipR', -0.2 - 0.25 * w, 0, -0.18);
        this._set('knL', 1.0, 0, 0);
        this._set('knR', 0.6, 0, 0);
        this._set('chest', 0.15, 0, 0);
        break;
      case 'dive':
        this._set('shL', 0.5, 0, 0.35);
        this._set('shR', 0.5, 0, -0.35);
        this._set('hipL', 0.15, 0, 0.06);
        this._set('hipR', 0.15, 0, -0.06);
        this._set('knL', 0.15, 0, 0);
        this._set('knR', 0.15, 0, 0);
        this._set('head', -0.8, 0, 0);
        break;
      case 'zip':
        this._set('shL', -1.45, 0, 0.12);
        this._set('shR', -1.45, 0, -0.12);
        this._set('hipL', 0.5, 0, 0.1);
        this._set('hipR', 0.3, 0, -0.1);
        this._set('knL', 0.7, 0, 0);
        this._set('knR', 0.5, 0, 0);
        this._set('chest', -0.15, 0, 0);
        break;
      case 'swing': {
        const free = webSide === 'L' ? 'R' : 'L';
        const sgn = free === 'L' ? 1 : -1;
        const ext = THREE.MathUtils.smoothstep(speed, 25, 55) * 0.5;
        this._set('sh' + free, 0.55, 0, 1.25 * sgn);
        this._set('el' + free, -0.6, 0, 0);
        this._set('hipL', -1.15 * (1 - ext), 0, 0.12);
        this._set('hipR', -0.75 * (1 - ext), 0, -0.12);
        this._set('knL', 1.75 * (1 - ext), 0, 0);
        this._set('knR', 1.25 * (1 - ext), 0, 0);
        this._set('chest', -0.12, 0, 0);
        break;
      }
      case 'climb': {
        this.phase += dt * 12;
        const s = Math.sin(this.phase);
        this._set('shL', -2.7 + 0.5 * s, 0, 0.25);
        this._set('shR', -2.7 - 0.5 * s, 0, -0.25);
        this._set('elL', -0.4, 0, 0);
        this._set('elR', -0.4, 0, 0);
        this._set('hipL', -0.9 - 0.5 * s, 0, 0.1);
        this._set('hipR', -0.9 + 0.5 * s, 0, -0.1);
        this._set('knL', 1.3 + 0.4 * s, 0, 0);
        this._set('knR', 1.3 - 0.4 * s, 0, 0);
        this._set('chest', 0.1, 0, 0);
        break;
      }
      case 'land':
        this._set('hipL', -1.5, 0, 0.35);
        this._set('hipR', 0.25, 0, -0.25);
        this._set('knL', 2.3, 0, 0);
        this._set('knR', 1.5, 0, 0);
        this._set('chest', 0.65, 0, 0);
        this._set('shR', -0.75, 0, -0.2);
        this._set('shL', 0.5, 0, 1.1);
        this._set('elL', -0.4, 0, 0);
        bodyY = -0.42;
        break;
    }

    const k = mode === 'title' ? 1 - Math.exp(-6 * dt) : 1 - Math.exp(-13 * dt);
    for (const name of JOINTS) {
      if (webSide && (name === 'sh' + webSide || name === 'el' + webSide)) continue;
      const a = this.T[name];
      eA.set(a[0], a[1], a[2], name === 'head' ? 'YXZ' : 'XYZ');
      qB.setFromEuler(eA);
      this.j[name].quaternion.slerp(qB, k);
    }
    this.body.position.y += (bodyY - this.body.position.y) * k;
    this.root.updateMatrixWorld(true);

    if (webSide) {
      const sh = this.j['sh' + webSide];
      const dir = sh.getWorldPosition(vTmp);
      dir.subVectors(P.anchor, dir).normalize();
      dir.applyQuaternion(this.j.chest.getWorldQuaternion(qA).invert());
      qB.setFromUnitVectors(DOWN, dir);
      sh.quaternion.slerp(qB, 1 - Math.exp(-20 * dt));
      this.j['el' + webSide].quaternion.slerp(Q_ID, k);
      this.activeHand = this.j['hand' + webSide];
    } else if (pose === 'zip') {
      this.activeHand = this.j.handR;
    }

    if (mode === 'selfie' || mode === 'title') {
      const toCam = this.j.head.getWorldPosition(vTmp2);
      toCam.subVectors(camera.position, toCam);
      toCam.applyQuaternion(this.j.chest.getWorldQuaternion(qA).invert()).normalize();
      const yaw = THREE.MathUtils.clamp(Math.atan2(toCam.x, toCam.z), -0.9, 0.9);
      const pitch = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(toCam.y, -1, 1)), -0.5, 0.5);
      eA.set(pitch, yaw, 0, 'YXZ');
      qB.setFromEuler(eA);
      this.j.head.quaternion.slerp(qB, k);
    }
  }

  updateViewmodel(dt, P, camera) {
    if (!this.vm.visible) return;
    const k = 1 - Math.exp(-14 * dt);
    let activeSide = 0;
    const anchorCam = vTmp;
    if (P.state === 'swing') {
      anchorCam.copy(P.anchor).applyMatrix4(camera.matrixWorldInverse);
      activeSide = anchorCam.x > 0 ? 1 : -1;
    }
    const zipping = P.boostTime < 0.35;
    for (const arm of this.vmArms) {
      arm.isActive = arm.side === activeSide || (zipping && arm.side === 1);
      let aim;
      if (arm.side === activeSide) aim = vTmp2.subVectors(anchorCam, arm.g.position).normalize();
      else if (zipping) aim = vTmp2.set(-0.05 * arm.side, 0.08, -1).normalize();
      else aim = arm.rest;
      qB.setFromUnitVectors(AHEAD, aim);
      arm.g.quaternion.slerp(qB, k);
    }
  }
}
