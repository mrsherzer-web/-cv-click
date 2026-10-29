// Israeli suburban houses: plastered blocks with roller shutters, flat roofs with a solar water
// heater or red tiled roofs, balconies and air conditioners on the side walls.
import * as THREE from 'three';
import { mat4 } from './batch.js';
import { tint } from './materials.js';

const FLOOR = 3.1;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const tankGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.5, 12).rotateZ(Math.PI / 2);

function hipRoof(w, d, rise) {
  const W = w / 2 + 0.4, D = d / 2 + 0.4, R = Math.max(0, W - D), y = 0, t = rise;
  const p = [
    -W, y, D, W, y, D, R, t, 0, -W, y, D, R, t, 0, -R, t, 0, // front
    W, y, -D, -W, y, -D, -R, t, 0, W, y, -D, -R, t, 0, R, t, 0, // back
    W, y, D, W, y, -D, R, t, 0, // right end
    -W, y, -D, -W, y, D, -R, t, 0, // left end
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// place a house whose footprint center is (x, y, z), front facade facing local +z rotated by yaw
export function addHouse(batch, M, { x, y, z, yaw, w, d, floors, roof, wall, balcony, ac, sink = 1.6 }) {
  const H = floors * FLOOR;
  const base = mat4(x, y, z, yaw);
  const at = (lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1) => base.clone().multiply(mat4(lx, ly, lz, ry, sx, sy, sz));
  const wallTint = tint(wall);
  const trim = tint('#f3f1ec');

  batch.add('plaster', M.plaster, box(w, H + sink, d), at(0, (H - sink) / 2, 0), { color: wallTint, uv: 'world', uvScale: 0.3 });
  if (floors > 1) batch.add('plaster', M.plaster, box(w + 0.12, 0.16, d + 0.12), at(0, FLOOR, 0), { color: trim, uv: 'world' });

  if (roof === 'tiles') {
    batch.add('tiles', M.tiles, hipRoof(w, d, Math.min(w, d) * 0.22), at(0, H, 0), { uv: 'world', uvScale: 0.6 });
  } else {
    // parapet, roof membrane and the solar water heater every Israeli roof has
    batch.add('plaster', M.plaster, box(w + 0.1, 0.55, 0.16), at(0, H + 0.27, d / 2 - 0.03), { color: wallTint, uv: 'world' });
    batch.add('plaster', M.plaster, box(w + 0.1, 0.55, 0.16), at(0, H + 0.27, -d / 2 + 0.03), { color: wallTint, uv: 'world' });
    batch.add('plaster', M.plaster, box(0.16, 0.55, d), at(w / 2 - 0.03, H + 0.27, 0), { color: wallTint, uv: 'world' });
    batch.add('plaster', M.plaster, box(0.16, 0.55, d), at(-w / 2 + 0.03, H + 0.27, 0), { color: wallTint, uv: 'world' });
    batch.add('paint', M.paint, box(w - 0.3, 0.04, d - 0.3), at(0, H + 0.02, 0), { color: tint('#8d8a84') });
    const sx = w * 0.18, sz = -d * 0.18;
    batch.add('solar', M.solar, box(1.1, 0.05, 1.9), at(sx, H + 0.75, sz, 0, 1, 1, 1).multiply(mat4(0, 0, 0, 0, 1, 1, 1, -0.55)), {});
    batch.add('paint', M.paint, tankGeo, at(sx, H + 1.35, sz - 0.95), { color: tint('#eceae5') });
    batch.add('paint', M.paint, box(0.05, 1.2, 0.05), at(sx - 0.5, H + 0.6, sz - 0.95), { color: tint('#5d6066') });
    batch.add('paint', M.paint, box(0.05, 1.2, 0.05), at(sx + 0.5, H + 0.6, sz - 0.95), { color: tint('#5d6066') });
  }

  // windows: roller shutters with sills; door with a small concrete canopy
  const win = (lx, ly, lz, ry, ww = 1.25, wh = 1.2) => {
    batch.add('shutter', M.shutter, plane(ww, wh), at(lx, ly, lz, ry), {});
    const off = 0.07;
    const sx = lx + Math.sin(ry) * off, sz = lz + Math.cos(ry) * off;
    batch.add('plaster', M.plaster, box(ww + 0.14, 0.06, 0.14), at(sx, ly - wh / 2 - 0.03, sz, ry), { color: trim, uv: 'world' });
  };
  const fz = d / 2 + 0.015, sxw = w / 2 + 0.015;
  win(-w * 0.3, 1.55, fz, 0);
  win(w * 0.3, 1.55, fz, 0);
  batch.add('door', M.door, plane(1.0, 2.1), at(0, 1.05, fz, 0), {});
  batch.add('plaster', M.plaster, box(1.6, 0.12, 0.8), at(0, 2.45, d / 2 + 0.4), { color: trim, uv: 'world' });
  win(0, 1.55, -fz, Math.PI);
  win(sxw, 1.55, 0, Math.PI / 2, 1.0);
  win(-sxw, 1.55, 0, -Math.PI / 2, 1.0);
  if (floors > 1) {
    win(-w * 0.3, FLOOR + 1.55, fz, 0);
    win(w * 0.3, FLOOR + 1.55, fz, 0);
    win(0, FLOOR + 1.55, -fz, Math.PI);
    win(sxw, FLOOR + 1.55, d * 0.2, Math.PI / 2, 1.0);
    win(-sxw, FLOOR + 1.55, -d * 0.2, -Math.PI / 2, 1.0);
    if (balcony) {
      batch.add('shutter', M.shutter, plane(1.4, 2.2), at(0, FLOOR + 1.1, fz, 0), {});
      batch.add('plaster', M.plaster, box(3.4, 0.16, 1.3), at(0, FLOOR, d / 2 + 0.65), { color: trim, uv: 'world' });
      batch.add('paint', M.paint, box(3.4, 0.05, 0.06), at(0, FLOOR + 1.0, d / 2 + 1.27), { color: tint('#d9dde2') });
      for (let i = -8; i <= 8; i++) {
        batch.add('paint', M.paint, box(0.025, 0.9, 0.025), at(i * 0.2, FLOOR + 0.53, d / 2 + 1.27), { color: tint('#d9dde2') });
      }
    } else {
      win(0, FLOOR + 1.55, fz, 0);
    }
  }
  if (ac) { // split air conditioner units hanging on the side wall
    batch.add('paint', M.paint, box(0.32, 0.6, 0.85), at(w / 2 + 0.17, 2.6, -d * 0.25), { color: tint('#efefeb') });
    if (floors > 1) batch.add('paint', M.paint, box(0.32, 0.6, 0.85), at(-w / 2 - 0.17, FLOOR + 2.3, d * 0.1), { color: tint('#efefeb') });
  }
  return { H };
}
