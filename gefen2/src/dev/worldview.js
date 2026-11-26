// Dev viewer: ?cam=1..12 | ?pos=x,y,z&look=x,y,z  &preset=office|cctv  &power=normal|emergency|blackout  &fl=1 (flashlight)
import * as THREE from '../../vendor/three.module.min.js';
import { Gfx } from '../engine/gfx.js';
import { World } from '../world/world.js';
import { CAMS, roomAt } from '../world/layout.js';

const q = new URLSearchParams(location.search);
const num = (s) => s.split(',').map(Number);
await document.fonts.ready;
for (const f of ['400 40px "Rubik Wet Paint"', '900 40px Heebo', '400 40px VT323']) await document.fonts.load(f, 'אב12');
const gfx = new Gfx(document.getElementById('gl'));
const t0 = performance.now();
const world = new World({ lights: +(q.get('lights') || 6) });
const buildMs = performance.now() - t0;
const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 90);
let preset = q.get('preset') || 'office';
let room = 'office';
if (q.get('cam')) {
  const c = CAMS.find((c) => c.n === +q.get('cam'));
  cam.position.set(...c.pos);
  cam.lookAt(...c.look);
  cam.fov = c.fov;
  room = c.room;
  preset = q.get('preset') || 'cctv';
} else {
  const p = num(q.get('pos') || '0,1.22,1.35');
  const l = num(q.get('look') || '0,1.2,-10');
  cam.position.set(...p);
  cam.lookAt(...l);
  cam.fov = +(q.get('fov') || 72);
  room = q.get('room') || roomAt(p[0], p[2]) || 'office';
}
cam.updateProjectionMatrix();
world.setView(room);
if (q.get('power')) world.setPower(q.get('power'));
if (q.get('dawn')) world.dawn(true);
if (q.get('open')) q.get('open').split(',').forEach((d) => world.setDoor(d, true, true));
if (q.get('show')) q.get('show').split(',').forEach((k) => world.items[k] && (world.items[k].visible = true));
let fl = null;
if (q.get('fl')) {
  fl = new THREE.SpotLight(0xfff2dc, +(q.get('fli') || 90), 30, 0.42, 0.55, 1.5);
  fl.castShadow = true;
  fl.shadow.mapSize.set(1024, 1024);
  fl.shadow.camera.near = 0.2;
  fl.shadow.camera.far = 30;
  fl.shadow.bias = -0.002;
  world.scene.add(fl, fl.target);
}
window.__world = world;
window.__cam = cam;
let frames = 0;
let last = performance.now();
let acc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  if (fl) {
    fl.position.copy(cam.position).add(new THREE.Vector3(0.2, -0.15, 0).applyQuaternion(cam.quaternion));
    fl.target.position.copy(cam.position).add(new THREE.Vector3(0, 0, -5).applyQuaternion(cam.quaternion));
  }
  world.update(dt, cam.position);
  gfx.render(world.scene, cam, preset, now / 1000);
  frames++;
  {
    const i = gfx.renderer.info;
    if (frames % 30 === 0) if (!q.get('ui')) document.getElementById('info').style.display='none'; document.getElementById('info').textContent = `build ${buildMs | 0}ms  calls ${i.render.calls}  tris ${i.render.triangles}  room ${room}`;
    window.__stats = { calls: i.render.calls, tris: i.render.triangles, buildMs: buildMs | 0 };
  }
  window.__frames = frames;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
