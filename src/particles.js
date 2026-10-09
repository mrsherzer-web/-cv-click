import * as THREE from 'three';

const VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vA;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vA = aAlpha;
  vC = aColor;
}`;

const FS = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vC, smoothstep(0.5, 0.05, d) * vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Small pooled particle system: ring bursts, landing dust, splashes.
export class Particles {
  constructor(scene, max = 800) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    const attr = (n) => new THREE.BufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = attr(3);
    this.aColor = attr(3);
    this.aSize = attr(1);
    this.aAlpha = attr(1);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aColor);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setScale(px) {
    this.mat.uniforms.uScale.value = px;
  }

  emit(x, y, z, vx, vy, vz, life, size, col, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.c.set(col, i * 3);
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  burst(pos, count, speed, col, life, size, grav = 0, drag = 1.5, upBias = 0) {
    for (let k = 0; k < count; k++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.emit(pos.x, pos.y, pos.z, Math.cos(a) * s * sp, u * sp + upBias, Math.sin(a) * s * sp, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.8), col, grav, drag);
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.n;
        if (i !== last) {
          this.p.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.v.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.c.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.size[i] = this.size[last];
          this.grav[i] = this.grav[last];
          this.drag[i] = this.drag[last];
        }
        continue;
      }
      const o = i * 3;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[o] *= k;
      this.v[o + 1] = this.v[o + 1] * k - this.grav[i] * dt;
      this.v[o + 2] *= k;
      this.p[o] += this.v[o] * dt;
      this.p[o + 1] += this.v[o + 1] * dt;
      this.p[o + 2] += this.v[o + 2] * dt;
      i++;
    }
    const P = this.aPos.array;
    const C = this.aColor.array;
    const S = this.aSize.array;
    const A = this.aAlpha.array;
    for (let j = 0; j < this.n; j++) {
      P[j * 3] = this.p[j * 3];
      P[j * 3 + 1] = this.p[j * 3 + 1];
      P[j * 3 + 2] = this.p[j * 3 + 2];
      C[j * 3] = this.c[j * 3];
      C[j * 3 + 1] = this.c[j * 3 + 1];
      C[j * 3 + 2] = this.c[j * 3 + 2];
      S[j] = this.size[j];
      A[j] = Math.min(1, (this.life[j] / this.maxLife[j]) * 1.5);
    }
    this.points.geometry.setDrawRange(0, this.n);
    for (const a of [this.aPos, this.aColor, this.aSize, this.aAlpha]) a.needsUpdate = true;
  }
}
