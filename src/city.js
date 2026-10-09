import * as THREE from 'three';
import { U, SHARED_GLSL, SUN_DIR, fogPatch, mulberry32 } from './shared.js';

// City grid: 80 m pitch = 60 m block + 20 m street. Units are metres.
export const PITCH = 80;
export const STREET = 20;
export const BLOCK = PITCH - STREET;
export const GRID = 26;
export const HALF = (GRID * PITCH) / 2;
export const RIVER_X0 = 330;
export const RIVER_X1 = 470;
export const BAY_Z0 = HALF + 12;
export const BAY_Z1 = HALF + 1250;
export const BRIDGE_Z = -HALF + 14 * PITCH;
export const PARK = { i0: 4, i1: 7, j0: 8, j1: 14 };
export const PARK_X0 = -HALF + PARK.i0 * PITCH + STREET / 2;
export const PARK_X1 = -HALF + PARK.i1 * PITCH - STREET / 2;
export const PARK_Z0 = -HALF + PARK.j0 * PITCH + STREET / 2;
export const PARK_Z1 = -HALF + PARK.j1 * PITCH - STREET / 2;
export const DOWNTOWN = { x: -300, z: 560 };

export function isWater(x, z) {
  return (x > RIVER_X0 && x < RIVER_X1) || (z > BAY_Z0 && z < BAY_Z1);
}

const f = (n) => n.toFixed(1);

// Style 0: glass curtain wall, 1: brick / limestone with punched windows, 2: concrete grid.
const TINTS = [
  [[0.1, 0.13, 0.17], [0.16, 0.14, 0.12], [0.11, 0.15, 0.15], [0.14, 0.15, 0.18]],
  [[0.4, 0.19, 0.13], [0.48, 0.29, 0.19], [0.33, 0.16, 0.12], [0.58, 0.48, 0.36], [0.52, 0.42, 0.3]],
  [[0.45, 0.43, 0.4], [0.36, 0.35, 0.34], [0.55, 0.52, 0.47], [0.3, 0.31, 0.33]],
];

const BUILDING_VS = /* glsl */ `
attribute vec4 aData;
attribute vec3 aTint;
varying vec3 vWP;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vSize;
varying vec4 vData;
varying vec3 vTint;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normal;
  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * vSize;
  vData = aData;
  vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BUILDING_FS = /* glsl */ `
varying vec3 vWP;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vSize;
varying vec4 vData;
varying vec3 vTint;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vWP - cameraPosition);
  float seed = vData.x;
  float style = vData.y;
  vec3 tint = vTint;
  vec3 albedo = tint;
  float win = 0.0;
  vec3 glass = vec3(0.0);
  // Lower floors sit in the shadow of their neighbours; tops catch the sun.
  float sunVis = smoothstep(4.0, 95.0, vWP.y + seed * 40.0 - 12.0);

  if (N.y > 0.5) {
    vec2 e = vSize.xz * 0.5 - abs(vLocal.xz);
    float edge = 1.0 - smoothstep(0.5, 0.9, min(e.x, e.y));
    float n = hash12(floor(vWP.xz * 0.7)) * 0.05;
    albedo = mix(vec3(0.17, 0.165, 0.16) + n, tint * 0.9, edge * 0.8);
    sunVis = 1.0;
  } else if (N.y < -0.5) {
    albedo = tint * 0.4;
  } else {
    bool xFace = abs(N.x) > 0.5;
    float faceW = xFace ? vSize.z : vSize.x;
    float along = (xFace ? vLocal.z : vLocal.x) + faceW * 0.5;
    float floorH; float winW; vec2 lo; vec2 hi;
    if (style < 0.5) { floorH = 3.9; winW = 1.7; lo = vec2(0.05, 0.16); hi = vec2(0.95, 0.97); }
    else if (style < 1.5) { floorH = 3.5; winW = 2.7; lo = vec2(0.27, 0.24); hi = vec2(0.73, 0.84); }
    else { floorH = 3.7; winW = 3.3; lo = vec2(0.1, 0.2); hi = vec2(0.9, 0.88); }
    float nW = max(1.0, floor(faceW / winW + 0.5));
    vec2 cell = vec2(along / (faceW / nW), vWP.y / floorH);
    vec2 id = floor(cell);
    vec2 fc = fract(cell);
    vec2 fw = fwidth(cell) + 1e-4;
    vec2 m = smoothstep(lo - fw, lo + fw, fc) * (1.0 - smoothstep(hi - fw, hi + fw, fc));
    win = m.x * m.y;
    float px = max(fw.x, fw.y);
    float detail = 1.0 - smoothstep(0.2, 0.55, px);
    win = mix((hi.x - lo.x) * (hi.y - lo.y), win, detail);
    float lobby = 1.0 - step(5.5, vWP.y);
    float crown = step(vSize.y - 2.0, vLocal.y);
    win = mix(win, 0.85, lobby) * (1.0 - crown);
    float r = hash12(id + vec2(seed * 91.0, seed * 37.0) + (xFace ? 13.0 : 0.0));
    float band = (style > 0.5 && style < 1.5) ? 0.93 + 0.07 * step(0.5, fract(vWP.y / floorH + 0.1)) : 1.0;
    albedo = tint * band * (0.92 + 0.16 * hash12(vec2(id.y, seed * 50.0)));

    vec3 Nw = normalize(N + vec3(r - 0.5, 0.0, hash12(id.yx + seed) - 0.5) * 0.06);
    vec3 R = reflect(V, Nw);
    vec3 refl = R.y > 0.0 ? skyColor(R) : mix(uHaze * 0.5, vec3(0.05, 0.05, 0.06), clamp(-R.y * 4.0, 0.0, 1.0));
    float fres = 0.06 + 0.94 * pow(1.0 - max(dot(-V, Nw), 0.0), 4.0);
    vec3 interior = vec3(0.025, 0.03, 0.035) * (0.6 + r);
    float lit = step(0.9, hash12(id * 1.37 + seed * 7.0)) * detail;
    vec3 litCol = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.85, 0.6), r) * 1.4;
    vec3 tintGlass = style < 0.5 ? mix(vec3(1.0), tint * 3.0, 0.45) : vec3(0.85);
    glass = mix(interior + litCol * lit, refl * tintGlass, mix(0.35, 0.95, fres) * (1.0 - lit * 0.7));
    vec3 H = normalize(uSunDir - V);
    glass += uSunColor * pow(max(dot(Nw, H), 0.0), 180.0) * 3.0 * sunVis;
  }

  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 amb = mix(vec3(0.16, 0.13, 0.12), vec3(0.3, 0.37, 0.55), N.y * 0.5 + 0.5);
  float ao = mix(0.35, 1.0, smoothstep(0.0, 50.0, vWP.y));
  vec3 col = albedo * (amb * ao + uSunColor * ndl * sunVis);
  col = mix(col, glass, win);
  col = applyFog(col, vWP);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WORLD_VS = /* glsl */ `
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GROUND_FS = /* glsl */ `
varying vec3 vWP;
void main() {
  vec2 p = vWP.xz;
  if ((p.x > ${f(RIVER_X0)} && p.x < ${f(RIVER_X1)}) || (p.y > ${f(BAY_Z0)} && p.y < ${f(BAY_Z1)})) discard;
  vec2 q = p + ${f(HALF)};
  vec2 c = mod(q, ${f(PITCH)});
  vec2 s = min(c, ${f(PITCH)} - c);
  vec2 fw = fwidth(p) + 1e-4;
  float lod = 1.0 - smoothstep(0.15, 0.6, max(fw.x, fw.y));
  const float SH = ${f(STREET / 2)};
  float streetX = 1.0 - smoothstep(SH - fw.x, SH + fw.x, s.x);
  float streetZ = 1.0 - smoothstep(SH - fw.y, SH + fw.y, s.y);
  float street = max(streetX, streetZ);
  float walk = max(1.0 - smoothstep(SH + 3.0 - fw.x, SH + 3.0 + fw.x, s.x), 1.0 - smoothstep(SH + 3.0 - fw.y, SH + 3.0 + fw.y, s.y));
  vec3 asphalt = vec3(0.045, 0.045, 0.05) * (0.85 + 0.3 * hash12(floor(p * 0.5)));
  vec3 col = mix(vec3(0.2, 0.19, 0.18), vec3(0.3, 0.28, 0.26), walk);
  col = mix(col, asphalt, street);
  float dashZ = step(0.5, fract(q.y / 7.0));
  float dashX = step(0.5, fract(q.x / 7.0));
  float lineX = (1.0 - smoothstep(0.12, 0.12 + fw.x * 1.5, s.x)) * streetX * (1.0 - streetZ) * dashZ;
  float lineZ = (1.0 - smoothstep(0.12, 0.12 + fw.y * 1.5, s.y)) * streetZ * (1.0 - streetX) * dashX;
  col = mix(col, vec3(0.55, 0.45, 0.2), max(lineX, lineZ) * lod);
  float cwA = streetX * (1.0 - streetZ) * step(SH + 0.6, s.y) * step(s.y, SH + 3.4) * step(0.5, fract(q.x / 1.4));
  float cwB = streetZ * (1.0 - streetX) * step(SH + 0.6, s.x) * step(s.x, SH + 3.4) * step(0.5, fract(q.y / 1.4));
  col = mix(col, vec3(0.42, 0.41, 0.4), max(cwA, cwB) * lod);
  if (p.x > ${f(PARK_X0)} && p.x < ${f(PARK_X1)} && p.y > ${f(PARK_Z0)} && p.y < ${f(PARK_Z1)}) {
    vec3 grass = vec3(0.06, 0.1, 0.035) * (0.75 + 0.5 * hash12(floor(p * 0.3)));
    float d1 = abs(fract((p.x * 0.8 + sin(p.y * 0.031) * 22.0) / 70.0) - 0.5) * 70.0;
    float d2 = abs(fract((p.y * 0.9 + sin(p.x * 0.027) * 18.0) / 95.0) - 0.5) * 95.0;
    float path = 1.0 - smoothstep(1.4, 1.8, min(d1, d2));
    col = mix(grass, vec3(0.32, 0.29, 0.24), path);
  }
  vec3 lit = col * (vec3(0.3, 0.36, 0.5) * 0.9 + uSunColor * max(uSunDir.y, 0.0) * 0.6);
  gl_FragColor = vec4(applyFog(lit, vWP), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_FS = /* glsl */ `
varying vec3 vWP;
void main() {
  vec2 p = vWP.xz;
  vec2 g = vec2(0.0);
  #define WAVE(dx, dz, fr, amp, spd) { vec2 k = normalize(vec2(dx, dz)) * fr; g += k * amp * cos(dot(k, p) + uTime * spd); }
  WAVE(1.0, 0.3, 0.12, 0.6, 1.1)
  WAVE(-0.4, 1.0, 0.21, 0.35, 1.5)
  WAVE(0.7, -0.8, 0.37, 0.18, 2.1)
  WAVE(-0.9, -0.2, 0.63, 0.09, 2.7)
  WAVE(0.2, 0.9, 1.1, 0.05, 3.4)
  WAVE(-0.6, 0.5, 1.9, 0.025, 4.4)
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float d = length(vWP - cameraPosition);
  N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(150.0, 1800.0, d) * 0.8));
  vec3 V = normalize(vWP - cameraPosition);
  vec3 R = reflect(V, N);
  R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
  vec3 col = mix(vec3(0.015, 0.035, 0.045), skyColor(R), fres);
  float sd = max(dot(R, uSunDir), 0.0);
  col += uSunColor * pow(sd, 400.0) * 6.0 + uHazeSun * pow(sd, 40.0) * 0.25;
  gl_FragColor = vec4(applyFog(col, vWP), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SKY_FS = /* glsl */ `
varying vec3 vWP;
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 fr = fract(p);
  fr = fr * fr * (3.0 - 2.0 * fr);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, fr.x), mix(c, d, fr.x), fr.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vWP - cameraPosition);
  vec3 col = skyColor(d);
  float s = max(dot(d, uSunDir), 0.0);
  if (d.y > 0.0) {
    vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.004, 0.0);
    float c = fbm(cp);
    float cov = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.1, d.y) * (1.0 - smoothstep(0.35, 0.8, d.y));
    vec3 cloud = mix(vec3(0.32, 0.25, 0.3), uHazeSun * 1.15, pow(s, 3.0) * 0.8 + 0.18);
    col = mix(col, cloud, cov * 0.8);
  }
  col += uSunColor * (smoothstep(0.99975, 0.99992, s) * 9.0 + pow(s, 600.0) * 1.5);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function shaderMat(vs, fs, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: vs,
    fragmentShader: SHARED_GLSL + fs,
    extensions: { derivatives: true },
    ...extra,
  });
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];
    this.grid = new Map();
    this._stamp = 0;
    this._near = [];
    this._anchor = new THREE.Vector3();
    this.bld = [];
    this.waterTowers = [];
    this.acUnits = [];
    this.spires = [];
    const r = mulberry32(1337);
    this._generate(r);
    // Keep the starting roof clear for the opening shot.
    const sb = this._spawnBox();
    this.spires = this.spires.filter((t) => !(t.x > sb.x0 && t.x < sb.x1 && t.z > sb.z0 && t.z < sb.z1));
    this.acUnits = this.acUnits.filter((t) => !(t.x > sb.x0 && t.x < sb.x1 && t.z > sb.z0 && t.z < sb.z1));
    this._buildBuildings();
    this._buildGround();
    this._buildWater();
    this._buildSky();
    this._buildProps();
    this._buildPark(r);
    this._buildBridge();
    this._buildBanks();
  }

  // ---------- generation

  _heightAt(x, z, r) {
    const d1 = Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z);
    const d2 = Math.hypot(x + 140, z + 300);
    let h = 12 + 26 * r();
    h += 240 * Math.exp(-(d1 * d1) / (260 * 260));
    h += 200 * Math.exp(-(d2 * d2) / (320 * 320));
    if (x > RIVER_X1) h *= 0.55;
    if (r() < 0.05) h += 60 + 140 * r();
    return Math.min(h, 380);
  }

  _generate(r) {
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const bx0 = -HALF + i * PITCH + STREET / 2;
        const bz0 = -HALF + j * PITCH + STREET / 2;
        const cx = bx0 + BLOCK / 2;
        const cz = bz0 + BLOCK / 2;
        if (cx > RIVER_X0 - 20 && cx < RIVER_X1 + 20) continue;
        if (i >= PARK.i0 && i < PARK.i1 && j >= PARK.j0 && j < PARK.j1) continue;
        this._fillBlock(bx0, bz0, this._heightAt(cx, cz, r), r, true);
      }
    }
    // Outskirts and the far shore across the bay: render-only silhouettes.
    const EXT = 15;
    for (let i = -EXT; i < GRID + EXT; i++) {
      for (let j = -EXT; j < GRID + EXT + 8; j++) {
        if (i >= 0 && i < GRID && j >= 0 && j < GRID) continue;
        const bx0 = -HALF + i * PITCH + STREET / 2;
        const bz0 = -HALF + j * PITCH + STREET / 2;
        const cx = bx0 + BLOCK / 2;
        const cz = bz0 + BLOCK / 2;
        if (isWater(bx0, bz0) || isWater(bx0 + BLOCK, bz0) || isWater(bx0, bz0 + BLOCK) || isWater(bx0 + BLOCK, bz0 + BLOCK)) continue;
        if (Math.hypot(cx, cz) > 3600 || r() < 0.35) continue;
        let h = 10 + 30 * r() * r();
        if (r() < 0.06) h += 40 + 90 * r();
        if (cz > BAY_Z1) {
          h *= 1.3;
          if (r() < 0.12) h += 60 + 120 * r();
        }
        const ins = 3 + r() * 6;
        this._box(bx0 + ins, bz0 + ins, bx0 + BLOCK - ins, bz0 + BLOCK - ins, h, r() < 0.6 ? 2 : 1, TINTS[2][Math.floor(r() * 4)], r(), false);
      }
    }
  }

  _fillBlock(bx0, bz0, h0, r, collidable) {
    const SW = 3;
    const x0 = bx0 + SW;
    const z0 = bz0 + SW;
    const x1 = bx0 + BLOCK - SW;
    const z1 = bz0 + BLOCK - SW;
    const roll = r();
    const lots = [];
    const g = 0.8;
    if (h0 > 120 && roll < 0.55) {
      lots.push([x0, z0, x1, z1, 1]);
    } else if (roll < 0.4) {
      const s = 0.38 + 0.24 * r();
      if (r() < 0.5) {
        const xm = x0 + (x1 - x0) * s;
        lots.push([x0, z0, xm - g, z1, r()], [xm + g, z0, x1, z1, r()]);
      } else {
        const zm = z0 + (z1 - z0) * s;
        lots.push([x0, z0, x1, zm - g, r()], [x0, zm + g, x1, z1, r()]);
      }
    } else {
      const xm = x0 + (x1 - x0) * (0.4 + 0.2 * r());
      const zm = z0 + (z1 - z0) * (0.4 + 0.2 * r());
      lots.push(
        [x0, z0, xm - g, zm - g, r()],
        [xm + g, z0, x1, zm - g, r()],
        [x0, zm + g, xm - g, z1, r()],
        [xm + g, zm + g, x1, z1, r()]
      );
    }
    for (const [lx0, lz0, lx1, lz1, fr] of lots) {
      const single = lots.length === 1;
      const h = Math.max(9, single ? h0 : h0 * (0.35 + 0.85 * fr));
      const inset = single ? 2 + r() * 6 : r() < 0.3 ? r() * 2 : 0;
      this._building(lx0 + inset, lz0 + inset, lx1 - inset, lz1 - inset, h, r, collidable);
    }
  }

  _building(x0, z0, x1, z1, h, r, collidable) {
    const w = x1 - x0;
    const d = z1 - z0;
    let style;
    if (h > 95) style = r() < 0.7 ? 0 : 2;
    else {
      const q = r();
      style = q < 0.5 ? 1 : q < 0.82 ? 2 : 0;
    }
    const tints = TINTS[style];
    const tint = tints[Math.floor(r() * tints.length)];
    const seed = r();
    let tiers = 1;
    if (h > 110 && Math.min(w, d) > 24 && r() < 0.55) tiers = 3;
    else if (h > 60 && Math.min(w, d) > 18 && r() < 0.3) tiers = 2;
    const fr = tiers === 3 ? [0.45, 0.78, 1] : tiers === 2 ? [0.62, 1] : [1];
    let top = null;
    for (let k = 0; k < tiers; k++) {
      const ins = k * Math.min(w, d) * 0.16;
      top = this._box(x0 + ins, z0 + ins, x1 - ins, z1 - ins, h * fr[k], style, tint, seed + k * 0.13, collidable);
    }
    if (!collidable) return;
    const tw = top.x1 - top.x0;
    const td = top.z1 - top.z0;
    if (h > 190 && r() < 0.55) {
      this.spires.push({ x: (top.x0 + top.x1) / 2, z: (top.z0 + top.z1) / 2, y: top.y1, len: 18 + r() * 40 });
    }
    if (style === 1 && h < 95 && tw > 12 && td > 12 && r() < 0.5) {
      this.waterTowers.push({ x: top.x0 + 4 + r() * (tw - 8), z: top.z0 + 4 + r() * (td - 8), y: top.y1 });
    }
    const ac = r() < 0.6 ? 1 + Math.floor(r() * 3) : 0;
    for (let k = 0; k < ac && tw > 8 && td > 8; k++) {
      this.acUnits.push({ x: top.x0 + 3 + r() * (tw - 6), z: top.z0 + 3 + r() * (td - 6), y: top.y1, rot: r() < 0.5 ? 0 : Math.PI / 2 });
    }
  }

  _box(x0, z0, x1, z1, h, style, tint, seed, collidable) {
    const b = { x0, z0, x1, z1, h, style, tint, seed };
    this.bld.push(b);
    if (collidable) return this._addCollider(x0, 0, z0, x1, h, z1, true);
    return { x0, y0: 0, z0, x1, y1: h, z1 };
  }

  _addCollider(x0, y0, z0, x1, y1, z1, isBuilding = false) {
    const box = { x0, y0, z0, x1, y1, z1, bld: isBuilding, s: 0 };
    this.boxes.push(box);
    const ix0 = Math.floor(x0 / PITCH);
    const ix1 = Math.floor(x1 / PITCH);
    const iz0 = Math.floor(z0 / PITCH);
    const iz1 = Math.floor(z1 / PITCH);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const key = ix * 4096 + iz;
        let list = this.grid.get(key);
        if (!list) this.grid.set(key, (list = []));
        list.push(box);
      }
    }
    return box;
  }

  // ---------- meshes

  _buildBuildings() {
    const n = this.bld.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const data = new Float32Array(n * 4);
    const tint = new Float32Array(n * 3);
    const mesh = new THREE.InstancedMesh(geo, shaderMat(BUILDING_VS, BUILDING_FS), n);
    const m = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      const b = this.bld[k];
      m.makeScale(b.x1 - b.x0, b.h, b.z1 - b.z0);
      m.setPosition((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      mesh.setMatrixAt(k, m);
      data[k * 4] = b.seed;
      data[k * 4 + 1] = b.style;
      tint.set(b.tint, k * 3);
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.buildingMesh = mesh;
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(16000, 16000);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, shaderMat(WORLD_VS, GROUND_FS));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(16000, 16000);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, shaderMat(WORLD_VS, WATER_FS));
    mesh.position.y = -1.5;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(8000, 32, 16);
    const mesh = new THREE.Mesh(geo, shaderMat(WORLD_VS, SKY_FS, { side: THREE.BackSide, depthWrite: false }));
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    this.sky = mesh;
    this.scene.add(mesh);
  }

  _instanced(geo, mat, items, place) {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4();
    items.forEach((it, k) => {
      place(m, it, k);
      mesh.setMatrixAt(k, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  _buildProps() {
    const wood = fogPatch(new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.9 }));
    const metal = fogPatch(new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.55, metalness: 0.4 }));
    const dark = fogPatch(new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.8 }));
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const tank = new THREE.CylinderGeometry(2.2, 2.2, 4.2, 14).translate(0, 2.1 + 3, 0);
    this._instanced(tank, wood, this.waterTowers, (m, t) => m.makeTranslation(t.x, t.y, t.z));
    const cone = new THREE.ConeGeometry(2.45, 1.7, 14).translate(0, 7.2 + 0.85, 0);
    this._instanced(cone, dark, this.waterTowers, (m, t) => m.makeTranslation(t.x, t.y, t.z));
    const legs = new THREE.CylinderGeometry(1.6, 1.9, 3, 6, 1, true).translate(0, 1.5, 0);
    this._instanced(legs, dark, this.waterTowers, (m, t) => m.makeTranslation(t.x, t.y, t.z));
    const ac = new THREE.BoxGeometry(2.6, 1.5, 1.9).translate(0, 0.75, 0);
    this._instanced(ac, metal, this.acUnits, (m, a) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.rot);
      m.compose(p.set(a.x, a.y, a.z), q, s.set(1, 1, 1));
    });
    const spire = new THREE.CylinderGeometry(0.15, 0.7, 1, 6).translate(0, 0.5, 0);
    this._instanced(spire, metal, this.spires, (m, t) => {
      m.makeScale(1, t.len, 1);
      m.setPosition(t.x, t.y, t.z);
    });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.15) });
    const beacon = new THREE.SphereGeometry(0.55, 8, 6);
    this._instanced(beacon, this.beaconMat, this.spires, (m, t) => m.makeTranslation(t.x, t.y + t.len, t.z));
  }

  _buildPark(r) {
    const trees = [];
    for (let k = 0; k < 320; k++) {
      trees.push({
        x: PARK_X0 + 4 + r() * (PARK_X1 - PARK_X0 - 8),
        z: PARK_Z0 + 4 + r() * (PARK_Z1 - PARK_Z0 - 8),
        s: 0.7 + r() * 0.7,
        c: r(),
      });
    }
    const trunkMat = fogPatch(new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 1 }));
    const crownMat = fogPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6).translate(0, 1.6, 0);
    this._instanced(trunk, trunkMat, trees, (m, t) => {
      m.makeScale(t.s, t.s, t.s);
      m.setPosition(t.x, 0, t.z);
    });
    const crown = new THREE.IcosahedronGeometry(2.8, 0).translate(0, 5.2, 0);
    const mesh = this._instanced(crown, crownMat, trees, (m, t) => {
      m.makeScale(t.s * 1.2, t.s, t.s * 1.2);
      m.setPosition(t.x, 0, t.z);
    });
    const c = new THREE.Color();
    trees.forEach((t, k) => mesh.setColorAt(k, c.setRGB(0.07 + t.c * 0.06, 0.13 + t.c * 0.08, 0.04 + t.c * 0.02)));
    mesh.instanceColor.needsUpdate = true;
  }

  _buildBridge() {
    const z = BRIDGE_Z;
    const x0 = RIVER_X0 - 80;
    const x1 = RIVER_X1 + 80;
    const deckY = 24;
    const steel = fogPatch(new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.6, metalness: 0.3 }));
    const stone = fogPatch(new THREE.MeshStandardMaterial({ color: 0x8c7b67, roughness: 0.85 }));
    const deckMat = fogPatch(new THREE.MeshStandardMaterial({ color: 0x3d3a38, roughness: 0.8 }));
    const add = (mat, bx0, by0, bz0, bx1, by1, bz1, collide = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bx1 - bx0, by1 - by0, bz1 - bz0), mat);
      mesh.position.set((bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2);
      this.scene.add(mesh);
      if (collide) this._addCollider(bx0, by0, bz0, bx1, by1, bz1);
    };
    add(deckMat, x0, deckY - 2.2, z - 9, x1, deckY, z + 9);
    add(steel, x0, deckY, z - 9, x1, deckY + 1.2, z - 8.4, false);
    add(steel, x0, deckY, z + 8.4, x1, deckY + 1.2, z + 9, false);
    const towers = [RIVER_X0 + 22, RIVER_X1 - 22];
    const top = 100;
    for (const tx of towers) {
      for (const s of [-1, 1]) add(stone, tx - 3, -2, z + s * 11.5 - 2.5, tx + 3, top, z + s * 11.5 + 2.5);
      add(stone, tx - 3, 62, z - 14, tx + 3, 67, z + 14);
      add(stone, tx - 3, top - 8, z - 14, tx + 3, top - 3, z + 14);
      add(stone, tx - 4, -3, z - 15, tx + 4, deckY - 2.2, z + 15);
    }
    // Ramps down to street level (visual only).
    const rampLen = 120;
    for (const dir of [-1, 1]) {
      const ex = dir < 0 ? x0 : x1;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(rampLen, deckY), 2, 18), deckMat);
      mesh.position.set(ex + (dir * rampLen) / 2, deckY / 2 - 1, z);
      mesh.rotation.z = dir * Math.atan2(deckY, rampLen);
      this.scene.add(mesh);
    }
    const [ta, tb] = towers;
    const cableY = (x) => {
      if (x < ta) return deckY + 1.5 + (top - deckY - 1.5) * Math.pow((x - x0) / (ta - x0), 1.6);
      if (x > tb) return deckY + 1.5 + (top - deckY - 1.5) * Math.pow((x1 - x) / (x1 - tb), 1.6);
      const t = (x - ta) / (tb - ta);
      return top - (top - deckY - 4) * (1 - (2 * t - 1) * (2 * t - 1));
    };
    const hangers = [];
    for (const s of [-1, 1]) {
      const pts = [];
      for (let x = x0; x <= x1 + 0.1; x += 5) pts.push(new THREE.Vector3(x, cableY(x), z + s * 9.5));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.45, 6, false), steel);
      this.scene.add(tube);
      for (let x = x0 + 6; x < x1 - 3; x += 6) hangers.push({ x, z: z + s * 9.5, len: cableY(x) - deckY });
    }
    const hanger = new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0);
    this._instanced(hanger, steel, hangers, (m, h) => {
      m.makeScale(1, h.len, 1);
      m.setPosition(h.x, deckY, h.z);
    });
  }

  _buildBanks() {
    const mat = fogPatch(new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.9 }));
    const wall = (x0, z0, x1, z1) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 4.3, z1 - z0), mat);
      mesh.position.set((x0 + x1) / 2, -2, (z0 + z1) / 2);
      this.scene.add(mesh);
    };
    wall(RIVER_X0 - 1.5, -7000, RIVER_X0, BAY_Z0);
    wall(RIVER_X1, -7000, RIVER_X1 + 1.5, BAY_Z0);
    wall(-7000, BAY_Z0 - 1.5, RIVER_X0, BAY_Z0);
    wall(RIVER_X1, BAY_Z0 - 1.5, 7000, BAY_Z0);
    wall(-7000, BAY_Z1, RIVER_X0, BAY_Z1 + 1.5);
    wall(RIVER_X1, BAY_Z1, 7000, BAY_Z1 + 1.5);
  }

  update(time, camera) {
    this.sky.position.copy(camera.position);
    if (this.beaconMat) {
      const on = Math.sin(time * 3) > 0.2;
      this.beaconMat.color.setRGB(on ? 4 : 0.4, on ? 0.25 : 0.03, on ? 0.15 : 0.02);
    }
  }

  // ---------- queries

  near(x, z, rad) {
    const out = this._near;
    out.length = 0;
    const st = ++this._stamp;
    const ix0 = Math.floor((x - rad) / PITCH);
    const ix1 = Math.floor((x + rad) / PITCH);
    const iz0 = Math.floor((z - rad) / PITCH);
    const iz1 = Math.floor((z + rad) / PITCH);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const list = this.grid.get(ix * 4096 + iz);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const b = list[k];
          if (b.s !== st) {
            b.s = st;
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  // Highest walkable surface under (x, z) that is not above y.
  surfaceBelow(x, z, y) {
    let best = isWater(x, z) ? -1.5 : 0;
    for (const b of this.near(x, z, 1)) {
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.5 && b.y1 > best) best = b.y1;
    }
    return best;
  }

  topAt(x, z) {
    return this.surfaceBelow(x, z, 1e5);
  }

  // Where a web would stick: a facade or roof edge ahead of and above the hero.
  findAnchor(pos, fwd, side, speed, rise = 26) {
    const ahead = THREE.MathUtils.clamp(22 + speed * 0.55, 22, 62);
    const rx = -fwd.z;
    const rz = fwd.x;
    const dx = pos.x + fwd.x * ahead + rx * side * 10;
    const dy = pos.y + rise;
    const dz = pos.z + fwd.z * ahead + rz * side * 10;
    let best = false;
    let bestScore = Infinity;
    const a = this._anchor;
    for (const b of this.near(dx, dz, 90)) {
      if (b.y1 < pos.y + 7) continue;
      let px = Math.min(Math.max(dx, b.x0), b.x1);
      let py = Math.min(Math.max(dy, b.y0), b.y1);
      let pz = Math.min(Math.max(dz, b.z0), b.z1);
      if (px === dx && py === dy && pz === dz) {
        const dists = [dx - b.x0, b.x1 - dx, dz - b.z0, b.z1 - dz, b.y1 - dy];
        let mi = 0;
        for (let i = 1; i < 5; i++) if (dists[i] < dists[mi]) mi = i;
        if (mi === 0) px = b.x0;
        else if (mi === 1) px = b.x1;
        else if (mi === 2) pz = b.z0;
        else if (mi === 3) pz = b.z1;
        else py = b.y1;
      }
      const ox = px - pos.x;
      const oy = py - pos.y;
      const oz = pz - pos.z;
      const dist = Math.hypot(ox, oy, oz);
      if (dist < 10 || dist > 110 || oy < 6) continue;
      const hd = Math.hypot(ox, oz) || 1;
      const fwdDot = (ox * fwd.x + oz * fwd.z) / hd;
      if (fwdDot < -0.1) continue;
      const score = Math.hypot(px - dx, py - dy, pz - dz) + (1 - fwdDot) * 25;
      if (score < bestScore) {
        bestScore = score;
        a.set(px, py, pz);
        best = true;
      }
    }
    return best ? a : null;
  }

  // Fraction along a→b where the segment first enters a building (1 = clear).
  segmentHit(a, b, pad = 0.35) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    let tMin = 1;
    for (const bx of this.near((a.x + b.x) / 2, (a.z + b.z) / 2, len / 2 + 2)) {
      let t0 = 0;
      let t1 = tMin;
      let hit = true;
      const lo = [bx.x0 - pad, bx.y0 - pad, bx.z0 - pad];
      const hi = [bx.x1 + pad, bx.y1 + pad, bx.z1 + pad];
      const o = [a.x, a.y, a.z];
      const d = [dx, dy, dz];
      for (let i = 0; i < 3 && hit; i++) {
        if (Math.abs(d[i]) < 1e-6) {
          if (o[i] < lo[i] || o[i] > hi[i]) hit = false;
        } else {
          let ta = (lo[i] - o[i]) / d[i];
          let tb = (hi[i] - o[i]) / d[i];
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) hit = false;
        }
      }
      if (hit && t0 < tMin) tMin = t0;
    }
    return tMin;
  }

  _roofSpot(b, toward = 1) {
    const reach = Math.max(0, Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2 - 3) * toward;
    const l = Math.hypot(SUN_DIR.x, SUN_DIR.z);
    const x = (b.x0 + b.x1) / 2 + (SUN_DIR.x / l) * reach;
    const z = (b.z0 + b.z1) / 2 + (SUN_DIR.z / l) * reach;
    return { x, z, y: this.topAt(x, z) };
  }

  // Tallest downtown roof.
  _spawnBox() {
    let best = null;
    for (const b of this.boxes) {
      if (!b.bld || b.x1 - b.x0 < 14 || b.z1 - b.z0 < 14) continue;
      if (Math.hypot((b.x0 + b.x1) / 2 - DOWNTOWN.x, (b.z0 + b.z1) / 2 - DOWNTOWN.z) > 320) continue;
      if (!best || b.y1 > best.y1) best = b;
    }
    return best;
  }

  // Start on the edge away from the sun: facing the sun, the hero is lit and the city drops away behind him.
  spawnPoint() {
    const b = this._spawnBox();
    return b ? this._roofSpot(b, -1) : { x: DOWNTOWN.x, y: 0, z: DOWNTOWN.z };
  }

  respawnNear(x, z) {
    let best = null;
    let bestD = Infinity;
    const list = this.near(x, z, 260).slice();
    for (const b of list) {
      if (!b.bld || b.y1 < 30 || b.y1 > 160) continue;
      if (b.x1 - b.x0 < 12 || b.z1 - b.z0 < 12) continue;
      const d = Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best ? this._roofSpot(best) : this.spawnPoint();
  }
}
