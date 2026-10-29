// Late-afternoon light: a gradient sky with the sun in the southwest, haze that matches the horizon,
// and a painted ring of distant land: the coastal plain and the sea to the west, hills elsewhere.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.58, 0.57, 0.58).normalize();
const HAZE = new THREE.Color('#e7d8c2');

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#3d7fd6') },
      horizon: { value: HAZE.clone() },
      sunDir: { value: SUN_DIR },
      sunColor: { value: new THREE.Color('#fff0d2') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, sunDir, sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizon, top, pow(h, 0.32));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  mesh.name = 'sky';
  return mesh;
}

// panorama painted once; u = 0.25 is the direction of `westDir` after the cylinder is rotated
function backdropTexture() {
  const W = 2048, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const horizon = 250;
  // far land, lighter (hazier) toward the horizon
  const land = g.createLinearGradient(0, horizon, 0, H);
  land.addColorStop(0, '#d9cdb5');
  land.addColorStop(0.35, '#b8b18a');
  land.addColorStop(1, '#8d915e');
  g.fillStyle = land;
  g.fillRect(0, horizon, W, H - horizon);
  // fields and orchards on the plain
  for (let i = 0; i < 900; i++) {
    const y = horizon + 8 + Math.pow(Math.random(), 1.6) * (H - horizon);
    const w = 10 + Math.random() * 60 * ((y - horizon) / 120);
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '96,112,62' : '170,150,100'},${0.15 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * W, y, w, 1 + (y - horizon) / 70);
  }
  // hills all around except the west, bluish with distance
  const ridge = (amp, base, color, seed) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, horizon + 2);
    for (let x = 0; x <= W; x += 8) {
      const u = x / W, west = Math.exp(-((u - 0.25) ** 2) / 0.012); // no hills over the plain
      const y = horizon - base - amp * (0.5 + 0.5 * Math.sin(u * 19 + seed) * Math.cos(u * 7 + seed * 2)) * (1 - west);
      g.lineTo(x, y);
    }
    g.lineTo(W, horizon + 2);
    g.closePath();
    g.fill();
  };
  ridge(26, 6, 'rgba(150,164,182,0.55)', 1.2);
  ridge(16, 2, 'rgba(126,140,140,0.7)', 3.7);
  // the sea: a thin silver band on the western horizon
  const sea = g.createLinearGradient(0, 0, W, 0);
  sea.addColorStop(0.08, 'rgba(150,175,200,0)');
  sea.addColorStop(0.16, 'rgba(150,175,200,0.95)');
  sea.addColorStop(0.34, 'rgba(150,175,200,0.95)');
  sea.addColorStop(0.42, 'rgba(150,175,200,0)');
  g.fillStyle = sea;
  g.fillRect(0, horizon - 3, W, 7);
  // a coastal town on the plain, and a power station with two striped chimneys (invented placement)
  for (let i = 0; i < 70; i++) {
    const x = W * (0.2 + Math.random() * 0.11), w = 3 + Math.random() * 7, h = 3 + Math.random() * 12;
    g.fillStyle = `rgba(${225 + Math.random() * 20},${218 + Math.random() * 20},${205 + Math.random() * 20},0.85)`;
    g.fillRect(x, horizon + 5 - h, w, h);
  }
  for (const x of [W * 0.272, W * 0.279]) {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#f1ede6' : '#c9564a';
      g.fillRect(x, horizon - 60 + k * 7.5, 4, 7.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1; // seen from inside the cylinder
  return { texture: t, horizonV: 1 - horizon / H };
}

export function createSky(scene, { westDir }) {
  scene.background = HAZE.clone();
  scene.fog = new THREE.Fog(HAZE.clone(), 70, 520);

  const dome = skyDome();
  scene.add(dome);

  // the ring of far land sits below eye level so the horizon reads a few degrees down
  const { texture, horizonV } = backdropTexture();
  const R = 1400, Hc = 700, horizonY = -80;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, Hc, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, transparent: true, depthWrite: false }),
  );
  ring.position.y = horizonY - (horizonV - 0.5) * Hc;
  // the painted west (texture u = 0.25) lands on the cylinder's -x side; turn it to face westDir
  ring.rotation.y = Math.atan2(westDir.z, -westDir.x);
  ring.renderOrder = -1;
  ring.frustumCulled = false;
  ring.name = 'backdrop';
  scene.add(ring);

  const hemi = new THREE.HemisphereLight('#cfe0ff', '#8a7452', 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
  sun.castShadow = false;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 140;
  scene.add(sun, sun.target);

  return {
    dome, ring, sun, hemi,
    // keep the sky, the land ring and the shadow box centered on the player
    follow(camera, focus) {
      dome.position.copy(camera.position);
      ring.position.x = camera.position.x;
      ring.position.z = camera.position.z;
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(SUN_DIR, 70);
    },
    setQuality(q) {
      sun.castShadow = q.shadows;
      if (q.shadows && sun.shadow.mapSize.x !== q.shadowMapSize) {
        sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      scene.fog.far = q.fogFar;
    },
  };
}
