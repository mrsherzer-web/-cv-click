// Dev-only: render one place of the world for screenshots. preview.html?view=main&preset=cctv&chars=gefen0,cap
import { Gfx } from '../engine/gfx.js';
import { loadAssets } from '../engine/assets.js';
import { buildRooms, setRoomsNight } from '../world/rooms.js';
import { Office } from '../world/office.js';
import { Corridor } from '../world/corridor.js';
import { Character } from '../world/character.js';

const q = new URLSearchParams(location.search);
const gfx = new Gfx(document.getElementById('gl'));
const A = await loadAssets();
const rooms = buildRooms(A);
setRoomsNight(rooms, parseInt(q.get('night') || '1'));
const chars = {
  gefen: new Character('char_gefen', A.tex.charGefen, A.tex.glowGefen),
  cap: new Character('char_cap', A.tex.charCap, A.tex.glowCap),
  smiler: new Character('char_smiler', A.tex.charSmiler, A.tex.glowSmiler),
};
const view = q.get('view') || 'main';
let scene, camera, preset = q.get('preset') || 'cctv', upd;
if (view === 'office') {
  const o = new Office(A);
  o.setNight(parseInt(q.get('night') || '1'));
  scene = o.scene; camera = o.camera; preset = q.get('preset') || 'office';
  o.targetYaw = o.yaw = parseFloat(q.get('yaw') || '0');
  if (q.get('light')) { o.state[q.get('light')].light = true; }
  if (q.get('closed')) { o.state[q.get('closed')].closed = true; o.updateDoors(0, true); }
  const at = q.get('at');
  if (at) { const [side, who] = at.split(':'); const c = chars[who]; c.place(o, o.doorSpot(side, c.key, !!q.get('light'))); upd = () => c.faceCamera(o.camera); }
  if (q.get('out')) { o.setPower(false); const c = chars.gefen; c.place(o, o.outageSpot()); upd = () => c.faceCamera(o.camera); }
  const t0 = performance.now();
  const loop = () => { const t = (performance.now() - t0) / 1000; o.update(t, 0.016); upd && upd(); gfx.render(scene, camera, preset, t); requestAnimationFrame(loop); };
  loop();
} else if (view === 'corridor') {
  const c = new Corridor(A);
  scene = c.scene; camera = c.camera; preset = q.get('preset') || 'office';
  const u = parseFloat(q.get('u') || '0');
  const t0 = performance.now();
  const loop = () => { const t = (performance.now() - t0) / 1000; c.pose(u, t, 0, parseFloat(q.get('back') || '0')); c.flicker(t); gfx.render(scene, camera, preset, t); requestAnimationFrame(loop); };
  loop();
} else {
  const r = rooms[view];
  scene = r.scene; camera = r.camera;
  for (const spec of (q.get('chars') || '').split(',').filter(Boolean)) {
    const who = spec.replace(/\d+$/, '');
    const c = chars[who];
    const spot = r.spots[spec] || r.spots[who];
    if (c && spot) c.place(r, spot);
  }
  const t0 = performance.now();
  const loop = () => { const t = (performance.now() - t0) / 1000; r.update(t, 0.016, true); Object.values(chars).forEach((c) => c.room === r && c.faceCamera(r.camera)); gfx.render(scene, camera, preset, t); requestAnimationFrame(loop); };
  loop();
}
window.__ready = true;
