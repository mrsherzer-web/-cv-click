import * as THREE from 'three';
import { World } from '../world.js';
import { canvasTexture } from '../util.js';

// On wide screens the main menu card sits at the left; returns the part of the screen it leaves free.
function freeArea() {
  const card = document.querySelector('#menu .menu-card.main');
  if (!card || innerWidth < 900 || innerWidth <= innerHeight) return null;
  const r = card.getBoundingClientRect();
  if (!r.width || r.right > innerWidth * 0.6) return null;
  return { left: r.right + 12, right: innerWidth };
}

function setFov(camera, fov) {
  if (camera.fov === fov) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

// Menu backdrop: the cast in a police lineup, Yiftach a step apart in red light.
export function buildLineup(scene) {
  const world = new World(() => 0);
  scene.background = new THREE.Color(0x07080c);
  // 18 m wide so its edge never shows, with a column of heights beside each end of the lineup
  const wallTex = canvasTexture(2048, 512, (g, w, h) => {
    g.fillStyle = '#1a1d24';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(230,230,230,0.35)';
    g.fillStyle = 'rgba(230,230,230,0.55)';
    g.font = '600 18px Assistant, Arial';
    // 0 at the bottom of the texture = floor, top = 2.4 m
    for (let cm = 0; cm <= 240; cm += 10) {
      const y = h - (cm / 240) * h;
      g.lineWidth = cm % 50 === 0 ? 3 : 1;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      if (cm % 20 === 0 && cm) for (const x of [-4.95, 5.25]) g.fillText(`${cm}`, ((x + 9) / 18) * w, y - 4);
    }
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }));
  wall.position.set(0, 1.2, -1.2);
  scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.2 }));
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x9aa6c4, 0x0b0b10, 0.5));
  const key = new THREE.SpotLight(0xfff0dd, 60, 20, 0.7, 0.5, 1.4);
  key.position.set(-1.2, 6, 4.5);
  key.target.position.set(-1.2, 1, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  const red = new THREE.SpotLight(0xff2a2a, 70, 14, 0.45, 0.6, 1.4);
  red.position.set(4.6, 5, 3);
  red.target.position.set(3.9, 1, 0);
  scene.add(red, red.target);
  let t = 0;
  let people = [];
  let placed = false; // the first frame jumps the camera in instead of flying it over from the last level
  const cam = new THREE.Vector3();
  const ease = (camera, to, dt) => {
    if (placed) camera.position.lerp(to, 1 - Math.exp(-3 * dt));
    else camera.position.copy(to);
  };
  return {
    world,
    ambience: null,
    setup(story) {
      const order = [['ido', -3.6], ['yonati', -2.2], ['dolev', -0.8], ['yahli', 0.6], ['avraham', 2.0], ['yiftach', 4.1]];
      people = order.map(([id, x]) => story.add(id, x, -0.2, 0));
      story.rig.mode = 'free';
      story.control('none');
      placed = false;
    },
    update(dt, focus, camera) {
      t += dt;
      const a = Math.sin(t * 0.12);
      const free = freeArea();
      if (free) {
        // wide screens: the menu card covers the left of the picture, so shift the lens to stand
        // all six in the free part and back off until the lineup (4.2 m either side of its middle, plus the drift) fits
        const W = innerWidth;
        const H = innerHeight;
        const shift = (free.left + free.right) / 2 - W / 2;
        const v = camera.view;
        if (!v || !v.enabled || v.fullWidth !== W || v.fullHeight !== H || Math.abs(v.offsetX + shift) > 0.5) camera.setViewOffset(W, H, -shift, 0, W, H);
        setFov(camera, 46);
        const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (W / H) * ((free.right - free.left) / W);
        const dist = Math.max(5.6, 4.8 / tanH);
        cam.set(0.25 + a * 0.9, 1.5, dist - 0.2 - Math.abs(a) * 0.3);
        ease(camera, cam, dt);
        camera.lookAt(0.25 + a * 0.35, 1.2, 0);
      } else {
        if (camera.view?.enabled) camera.clearViewOffset();
        setFov(camera, 60);
        cam.set(-0.3 + a * 2.2, 1.45, 5.6 - Math.abs(a) * 0.5);
        ease(camera, cam, dt);
        camera.lookAt(0.2 + a * 0.6, 1.25, 0);
      }
      placed = true;
      for (const p of people) p.lookTarget = camera.position;
      red.intensity = 70 * (0.75 + 0.25 * Math.sin(t * 1.7));
    },
  };
}
