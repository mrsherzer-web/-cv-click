// A rectangular height grid over the whole map. The same grid builds the meshes and answers height
// queries, so feet and wheels land exactly on the triangles that are drawn. The mesh is cut into
// square tiles so the renderer can skip the ones outside the view.
import * as THREE from 'three';

export class Terrain {
  // x0, z0: the north-west corner; w, d: size in meters; step: grid spacing
  constructor({ x0, z0, w, d, step }) {
    this.x0 = x0;
    this.z0 = z0;
    this.step = step;
    this.nx = Math.round(w / step) + 1;
    this.nz = Math.round(d / step) + 1;
    this.x1 = x0 + (this.nx - 1) * step;
    this.z1 = z0 + (this.nz - 1) * step;
    this.h = new Float32Array(this.nx * this.nz);
  }

  fill(fn) {
    const { nx, nz, step, x0, z0, h } = this;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) h[iz * nx + ix] = fn(x0 + ix * step, z0 + iz * step, iz * nx + ix);
  }

  heightAt(x, z) {
    const fx = (x - this.x0) / this.step, fz = (z - this.z0) / this.step;
    const ix = Math.min(this.nx - 2, Math.max(0, Math.floor(fx)));
    const iz = Math.min(this.nz - 2, Math.max(0, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - ix)), v = Math.min(1, Math.max(0, fz - iz));
    const n = this.nx, H = this.h;
    const a = H[iz * n + ix], b = H[iz * n + ix + 1], c = H[(iz + 1) * n + ix], d = H[(iz + 1) * n + ix + 1];
    // each cell is split along the b-c diagonal, matching the meshes
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  // Meshes in two levels of detail. Near: tiles of `tile` cells at full resolution. Far: blocks twice
  // as wide at every other grid point. Each block knows its four near tiles; a short skirt along every
  // edge hides the cracks where a near tile meets a far block. colorFn(x, z, height, slope) → [r, g, b].
  buildLod(colorFn, uvScale = 0.22, tile = 24) {
    const { nx, nz, step, h } = this;
    const colors = new Float32Array(nx * nz * 3), normals = new Float32Array(nx * nz * 3);
    for (let gz = 0; gz < nz; gz++) {
      for (let gx = 0; gx < nx; gx++) {
        const hx = h[gz * nx + Math.min(nx - 1, gx + 1)] - h[gz * nx + Math.max(0, gx - 1)];
        const hz = h[Math.min(nz - 1, gz + 1) * nx + gx] - h[Math.max(0, gz - 1) * nx + gx];
        const l = Math.hypot(hx, 2 * step, hz), k = (gz * nx + gx) * 3;
        normals[k] = -hx / l; normals[k + 1] = (2 * step) / l; normals[k + 2] = -hz / l;
        colors.set(colorFn(this.x0 + gx * step, this.z0 + gz * step, h[gz * nx + gx], Math.hypot(hx, hz) / (2 * step)), k);
      }
    }
    const blocks = [];
    for (let bz = 0; bz < nz - 1; bz += tile * 2) {
      for (let bx = 0; bx < nx - 1; bx += tile * 2) {
        const block = { far: this.patch(bx, bz, tile * 2, 2, colors, normals, uvScale), near: [] };
        for (let tz = bz; tz < Math.min(nz - 1, bz + tile * 2); tz += tile) {
          for (let tx = bx; tx < Math.min(nx - 1, bx + tile * 2); tx += tile) block.near.push(this.patch(tx, tz, tile, 1, colors, normals, uvScale));
        }
        block.far.computeBoundingSphere();
        block.center = block.far.boundingSphere.center.clone();
        block.radius = block.far.boundingSphere.radius;
        blocks.push(block);
      }
    }
    return blocks;
  }

  // one patch of the grid starting at cell (tx, tz), `cells` wide, sampling every `k`th grid point
  patch(tx, tz, cells, k, colors, normals, uvScale) {
    const { nx, nz, step, x0, z0, h } = this;
    const cx = Math.ceil(Math.min(cells, nx - 1 - tx) / k), cz = Math.ceil(Math.min(cells, nz - 1 - tz) / k), vx = cx + 1, vz = cz + 1;
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const vert = (gx, gz, drop = 0) => {
      gx = Math.min(nx - 1, gx); gz = Math.min(nz - 1, gz);
      const g = gz * nx + gx, x = x0 + gx * step, z = z0 + gz * step;
      pos.push(x, h[g] - drop, z);
      nor.push(normals[g * 3], normals[g * 3 + 1], normals[g * 3 + 2]);
      uv.push(x * uvScale, z * uvScale);
      col.push(colors[g * 3], colors[g * 3 + 1], colors[g * 3 + 2]);
      return pos.length / 3 - 1;
    };
    for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) vert(tx + i * k, tz + j * k);
    for (let j = 0; j < cz; j++) {
      for (let i = 0; i < cx; i++) {
        const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
        idx.push(a, c, b, b, c, d); // counter-clockwise from above, so faces point up
      }
    }
    // skirts: each edge copied a few meters lower and joined to the edge, facing outward
    const edge = (list, flip) => {
      for (let n = 0; n < list.length - 1; n++) {
        const a = list[n], b = list[n + 1];
        const a2 = vert(...grid(a), 3), b2 = vert(...grid(b), 3);
        if (flip) idx.push(a, b, a2, b, b2, a2); else idx.push(a, a2, b, b, a2, b2);
      }
    };
    const grid = (v) => [tx + (v % vx) * k, tz + Math.floor(v / vx) * k];
    const row = (j) => Array.from({ length: vx }, (_, i) => j * vx + i), colm = (i) => Array.from({ length: vz }, (_, j) => j * vx + i);
    edge(row(0), true); edge(row(vz - 1), false); edge(colm(0), false); edge(colm(vx - 1), true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
}
