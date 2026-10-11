import * as THREE from 'three';

// Heads are built in the MediaPipe canonical face space (centimetres, y up, z forward).
export const HEAD_SCALE = 0.0112;

const loader = new THREE.TextureLoader();

function texFromURL(url, onLoad) {
  const t = loader.load(url, onLoad);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Average photo colour under the outer ring of the face (cheeks and jaw, not the hairline),
// so the skull, ears and neck continue the face instead of framing it like a mask.
function edgeSkin(img, data) {
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, S, S);
  const px = g.getImageData(0, 0, S, S).data;
  let r = 0;
  let gr = 0;
  let b = 0;
  let n = 0;
  for (let i = 468; i < data.alpha.length; i++) {
    if (data.positions[i * 3 + 1] > 1.5) continue;
    const x = Math.min(S - 1, Math.max(0, Math.round(data.uvs[i * 2] * (S - 1))));
    const y = Math.min(S - 1, Math.max(0, Math.round((1 - data.uvs[i * 2 + 1]) * (S - 1))));
    const k = (y * S + x) * 4;
    r += px[k];
    gr += px[k + 1];
    b += px[k + 2];
    n++;
  }
  return n ? [r / n / 255, gr / n / 255, b / n / 255] : null;
}

// The scanned face: canonical triangulation + faded outer rings, textured with the photo.
function faceMesh(data, onSkin) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  const n = data.alpha.length;
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1;
    col[i * 4 + 3] = data.alpha[i];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(data.indices);
  g.computeVertexNormals();
  // Make sure triangles face forward (the nose tip normal must point +z).
  if (g.attributes.normal.getZ(1) < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  const tex = texFromURL(data.texture, (t) => {
    if (!onSkin) return;
    try {
      const rgb = edgeSkin(t.image, data);
      if (rgb) onSkin(rgb);
    } catch {
      /* keep the scanned average */
    }
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.36,
    roughness: 0.62,
    vertexColors: true,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 2;
  return m;
}

// Placeholder face when no scan is available.
function cartoonFace(skin) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + skin.getHexString();
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1d1512';
  for (const x of [92, 164]) {
    g.beginPath();
    g.ellipse(x, 120, 11, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - 22, 92, 44, 8);
  }
  g.strokeStyle = '#6b2f25';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(98, 190);
  g.quadraticCurveTo(128, 212, 158, 190);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(1, 32, 24, Math.PI / 2 - 1.1, 2.2, 0.55, 1.9);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) * 0.5, 0.5 + pos.getY(i) * 0.5);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  m.scale.set(7.6, 10.3, 9.3);
  m.position.set(0, 1, -4.2);
  return m;
}

const SKULL_C = new THREE.Vector3(0, 1.0, -4.5);
const SKULL_R = new THREE.Vector3(7.5, 10.2, 9.0);

// Per style: hairline heights (front / side / back on the unit sphere) and a thickness field.
const HAIR = {
  buzz: { line: [0.55, 0.08, -0.5], thick: () => 0.28 },
  short: { line: [0.5, 0.02, -0.45], thick: (p, n) => 0.5 + 0.15 * n },
  quiff: { line: [0.48, 0.0, -0.5], thick: (p, n) => 0.7 + 2.6 * sm(0.25, 0.75, p.y) * sm(-0.3, 0.4, p.z) + 0.5 * n },
  curly: { line: [0.42, -0.12, -0.55], thick: (p, n) => 1.3 + 0.9 * Math.max(0, p.y) + 0.5 * n, curls: 340 },
  wavy: { line: [0.4, -0.25, -0.62], thick: (p, n) => 1.4 + 1.6 * Math.max(0, p.y) + 0.7 * n },
  fringe: { line: [0.46, -0.05, -0.5], thick: (p, n) => 0.9 + 0.9 * Math.max(0, p.y) + 0.35 * n, fringe: 0.2 },
};

function sm(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hairline(line, p) {
  const t = Math.abs(Math.atan2(p.x, p.z)) / Math.PI;
  let th = line[0] + (line[1] - line[0]) * sm(0.18, 0.45, t);
  return th + (line[2] - th) * sm(0.55, 0.9, t);
}

function strandTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, 256, 128);
  let s = seed * 7919;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 256;
    g.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.15 + rnd() * 0.3})` : `rgba(255,255,255,${0.1 + rnd() * 0.25})`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (rnd() - 0.5) * 12, 40, x + (rnd() - 0.5) * 12, 90, x + (rnd() - 0.5) * 8, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Small C-shaped strands for curly hair (colour detail and bump).
function curlTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a0a0a0';
  g.fillRect(0, 0, 512, 256);
  let s = seed * 104729;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * 512;
    const y = rnd() * 256;
    const r = 2.5 + rnd() * 5;
    const a0 = rnd() * Math.PI * 2;
    g.strokeStyle = rnd() < 0.55 ? `rgba(0,0,0,${0.25 + rnd() * 0.35})` : `rgba(255,255,255,${0.15 + rnd() * 0.3})`;
    g.lineWidth = 1 + rnd() * 1.6;
    g.beginPath();
    g.arc(x, y, r, a0, a0 + Math.PI * (1.1 + rnd() * 0.8));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Sculpted hair: an ellipsoid shell pushed out above the hairline and sunk into the skull below it.
// Curly hair gets a field of rounded clumps carved into the same shell.
function hairShell(style, color, rng, seed) {
  const st = HAIR[style];
  const geo = st.curls ? new THREE.SphereGeometry(1, 168, 126) : new THREE.SphereGeometry(1, 80, 60);
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ph = [rng() * 6, rng() * 6, rng() * 6];
  const clumps = [];
  if (st.curls) {
    for (let k = 0; clumps.length < st.curls && k < 8000; k++) {
      const u = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const c = [r * Math.cos(a), u, r * Math.sin(a)];
      if (c[1] < hairline(st.line, p.set(c[0], c[1], c[2])) + 0.02) continue;
      const sig = 0.075 + rng() * 0.05;
      clumps.push([c[0], c[1], c[2], sig, Math.cos(sig * 3), 0.7 + rng() * 0.7]);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let th = hairline(st.line, p);
    if (st.fringe && p.z > 0.5) th -= st.fringe * sm(0.5, 0.85, p.z) * sm(0.6, 0.0, Math.abs(p.x));
    const noise =
      Math.sin(p.x * 9 + ph[0]) * Math.sin(p.y * 11 + ph[1]) * Math.sin(p.z * 10 + ph[2]) * 0.6 +
      Math.sin(p.x * 23 + p.y * 17 + ph[1]) * 0.4;
    const above = sm(-0.03, 0.08, p.y - th);
    let off = -0.35 + above * (0.35 + st.thick(p, noise));
    if (clumps.length && above > 0) {
      let b = 0;
      for (const c of clumps) {
        const dot = p.x * c[0] + p.y * c[1] + p.z * c[2];
        if (dot < c[4]) continue;
        const ang = Math.acos(Math.min(1, dot)) / c[3];
        b = Math.max(b, c[5] * Math.exp(-ang * ang));
      }
      off += above * b * 1.3;
    }
    n.set(p.x / SKULL_R.x, p.y / SKULL_R.y, p.z / SKULL_R.z).normalize();
    pos.setXYZ(
      i,
      SKULL_C.x + p.x * SKULL_R.x + n.x * off,
      SKULL_C.y + p.y * SKULL_R.y + n.y * off,
      SKULL_C.z + p.z * SKULL_R.z + n.z * off
    );
  }
  geo.computeVertexNormals();
  const tex = st.curls ? curlTexture(seed) : strandTexture(seed);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: st.curls ? 0.78 : 0.62, map: tex, bumpMap: st.curls ? tex : null, bumpScale: 2 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));
  return group;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a group in metres whose origin is the top of the neck.
export function buildHead({ face, hairStyle = 'short', hairColor, skinColor, seed = 1, onSkin = null }) {
  const skin = new THREE.Color().setRGB(...(skinColor || face?.skin || [0.78, 0.58, 0.47]), THREE.SRGBColorSpace);
  // the scan is lit by the photo; keep the skull close to its brightness
  const hair = new THREE.Color().setRGB(...(hairColor || [0.1, 0.08, 0.07]), THREE.SRGBColorSpace);
  const head = new THREE.Group();
  const canon = new THREE.Group();
  canon.scale.setScalar(HEAD_SCALE);
  canon.position.set(0, 8.2 * HEAD_SCALE, 3.6 * HEAD_SCALE);
  head.add(canon);
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7, emissive: skin, emissiveIntensity: 0.34 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 26), skinMat);
  skull.scale.copy(SKULL_R);
  skull.position.copy(SKULL_C);
  canon.add(skull);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat);
    ear.scale.set(1.2, 2.7, 1.7);
    ear.position.set(s * 7.35, -0.8, -3.6);
    canon.add(ear);
  }
  const matchSkin = (rgb) => {
    // blend toward the photo edge colour: mostly the edge, a little of the overall average
    const edge = new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace);
    const c = skin.clone().lerp(edge, 0.8);
    skinMat.color.copy(c);
    skinMat.emissive.copy(c);
    if (onSkin) onSkin(c);
  };
  canon.add(face ? faceMesh(face, matchSkin) : cartoonFace(skin));
  const style = HAIR[hairStyle] ? hairStyle : 'short';
  canon.add(hairShell(style, hair, mulberry(seed * 7 + 3), seed));
  head.userData.skinMat = skinMat;
  return head;
}
