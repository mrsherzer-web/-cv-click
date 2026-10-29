// A square height grid. The same grid builds the mesh and answers height queries,
// so the player's feet land exactly on the triangles that are drawn.
import * as THREE from 'three';

export class Terrain {
  constructor({ size, segments, heightFn }) {
    this.size = size;
    this.seg = segments;
    this.n = segments + 1;
    this.step = size / segments;
    this.half = size / 2;
    this.h = new Float32Array(this.n * this.n);
    for (let iz = 0; iz < this.n; iz++) {
      for (let ix = 0; ix < this.n; ix++) {
        this.h[iz * this.n + ix] = heightFn(-this.half + ix * this.step, -this.half + iz * this.step);
      }
    }
  }

  heightAt(x, z) {
    const fx = (x + this.half) / this.step, fz = (z + this.half) / this.step;
    const ix = Math.min(this.seg - 1, Math.max(0, Math.floor(fx)));
    const iz = Math.min(this.seg - 1, Math.max(0, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - ix)), v = Math.min(1, Math.max(0, fz - iz));
    const n = this.n, H = this.h;
    const a = H[iz * n + ix], b = H[iz * n + ix + 1], c = H[(iz + 1) * n + ix], d = H[(iz + 1) * n + ix + 1];
    // each cell is split along the b-c diagonal, matching buildGeometry()
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  // colorFn(x, z, height, slope) returns [r, g, b] in linear 0..1
  buildGeometry(colorFn, uvScale = 0.25) {
    const n = this.n, count = n * n;
    const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), col = new Float32Array(count * 3);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix, x = -this.half + ix * this.step, z = -this.half + iz * this.step, y = this.h[i];
        pos.set([x, y, z], i * 3);
        uv.set([x * uvScale, z * uvScale], i * 2);
        const hx = this.h[iz * n + Math.min(n - 1, ix + 1)] - this.h[iz * n + Math.max(0, ix - 1)];
        const hz = this.h[Math.min(n - 1, iz + 1) * n + ix] - this.h[Math.max(0, iz - 1) * n + ix];
        const slope = Math.hypot(hx, hz) / (2 * this.step);
        col.set(colorFn(x, z, y, slope), i * 3);
      }
    }
    const idx = new Uint32Array(this.seg * this.seg * 6);
    let k = 0;
    for (let iz = 0; iz < this.seg; iz++) {
      for (let ix = 0; ix < this.seg; ix++) {
        const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b; // counter-clockwise from above, so normals face up
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    return geo;
  }
}
