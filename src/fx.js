// Post-processing: bloom (high quality) + a horror grade pass:
// film grain, vignette, chromatic aberration, barrel distortion, fear-driven red tint & wobble.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.06 }, vignette: { value: 0.35 },
    aberration: { value: 0.0025 }, fear: { value: 0 }, red: { value: 0 }, desat: { value: 0.18 }, blink: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, aberration, fear, red, desat, blink;
    varying vec2 vUv;
    float rnd(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      uv += c * r2 * (0.05 + fear * 0.12);
      uv.x += sin(uv.y * 26.0 + time * 7.0) * 0.0025 * fear * fear;
      float ab = aberration * (1.0 + fear * 3.0) * (0.3 + r2 * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l), desat + fear * 0.25);
      col *= vec3(0.95, 0.99, 1.07);
      col = mix(col, col * vec3(1.45, 0.55, 0.5) + vec3(0.03, 0.0, 0.0), clamp(fear * 0.3 + red, 0.0, 1.0));
      float v = smoothstep(0.95, 0.15, length(c) * (1.0 + vignette + fear * 0.6));
      col *= mix(1.0, v, 0.9);
      float n = rnd(uv * vec2(1280.0, 720.0) + fract(time * 13.7)) - 0.5;
      col += n * (grain + fear * 0.05);
      col *= 1.0 - 0.04 * sin(uv.y * 900.0 + time * 12.0) * fear;
      col *= 1.0 - smoothstep(0.0, 1.0, blink) * smoothstep(0.0, 0.06, abs(vUv.y - 0.5) - (1.0 - blink) * 0.5);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class FX {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    if (quality.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.horror = new ShaderPass(HorrorShader);
    this.composer.addPass(this.horror);
    this.u = this.horror.uniforms;
  }

  setCamera(cam) { this.renderPass.camera = cam; }
  setSize(w, h) { this.composer.setSize(w, h); }
  render(dt, t) { this.u.time.value = t; this.composer.render(dt); }
}
