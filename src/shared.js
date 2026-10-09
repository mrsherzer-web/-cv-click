import * as THREE from 'three';

// Low western sun: the whole look of the game hangs off this one vector.
export const SUN_DIR = new THREE.Vector3(-0.74, 0.12, -0.66).normalize();

// Uniforms shared by every custom shader and every patched material.
export const U = {
  uSunDir: { value: SUN_DIR },
  uSunColor: { value: new THREE.Color('#ffc48c').multiplyScalar(3.1) },
  uHaze: { value: new THREE.Color('#c79870') },
  uHazeSun: { value: new THREE.Color('#ffb46c').multiplyScalar(1.7) },
  uZenith: { value: new THREE.Color('#25457c') },
  uHorizon: { value: new THREE.Color('#f4a76a') },
  uFogA: { value: 0.00095 },
  uFogB: { value: 0.003 },
  uTime: { value: 0 },
};

export const SHARED_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHaze;
uniform vec3 uHazeSun;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uFogA;
uniform float uFogB;
uniform float uTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
  float s = max(dot(d, uSunDir), 0.0);
  col += uHazeSun * (pow(s, 5.0) * 0.45 + pow(s, 48.0) * 0.8);
  col = mix(col, uHaze, smoothstep(0.03, -0.1, h));
  return col;
}

// Analytic height fog: thick and golden near the ground, thin up high.
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 rd = wp - cameraPosition;
  float dist = length(rd);
  rd /= max(dist, 1e-3);
  float x = dist * rd.y * uFogB;
  float k = abs(x) < 1e-4 ? dist : dist * (1.0 - exp(-x)) / x;
  float amount = uFogA * exp(-cameraPosition.y * uFogB) * k;
  float f = 1.0 - exp(-amount);
  float s = max(dot(rd, uSunDir), 0.0);
  vec3 fc = mix(uHaze, uHazeSun, pow(s, 7.0));
  return mix(col, fc, clamp(f, 0.0, 1.0));
}
`;

// Gives built-in materials the same fog as the custom city shaders,
// applied in linear space before tone mapping so both paths match.
export function fogPatch(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogWP;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 fwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fwp = instanceMatrix * fwp;
          #endif
          vFogWP = (modelMatrix * fwp).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogWP;\n' + SHARED_GLSL)
      .replace(
        '#include <tonemapping_fragment>',
        'gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogWP);\n#include <tonemapping_fragment>'
      );
  };
  material.customProgramCacheKey = () => 'fogpatch';
  return material;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// localStorage can be missing or throw (private mode, previews): never rely on it.
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('goldenhour.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('goldenhour.' + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};
