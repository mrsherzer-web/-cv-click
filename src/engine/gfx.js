// ============================================================================
//  Renderer + post-processing (office look / CCTV look / jump-scare overlay)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tFace;
uniform vec2 res;
uniform float time, exposure, noise, scan, vignette, aberr, distort, glitch, staticAmt,
              desat, flash, fade, faceAmt, faceScale, roll, contrast, bloom, redPulse, pixel;
uniform vec3 tint, flashColor;
uniform vec2 faceOffset;
varying vec2 vUv;

float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
vec3 sceneAt(vec2 uv, vec2 dir){
  vec3 c;
  c.r = texture2D(tScene, uv + dir).r;
  c.g = texture2D(tScene, uv).g;
  c.b = texture2D(tScene, uv - dir).b;
  return c;
}
void main(){
  vec2 uv = vUv;
  // horizontal tearing
  if (glitch > 0.0) {
    float band = floor(uv.y * 30.0) + floor(time * 17.0) * 13.0;
    float r = hash(vec2(band, floor(time * 30.0)));
    if (r < glitch * 0.55) uv.x += (hash(vec2(band, 3.1)) - 0.5) * 0.18 * glitch;
    if (r > 1.0 - glitch * 0.08) uv.y += (hash(vec2(time, band)) - 0.5) * 0.05;
  }
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  uv = 0.5 + cc * (1.0 + distort * r2 + distort * 0.4 * r2 * r2);
  if (pixel > 1.0) uv = (floor(uv * res / pixel) + 0.5) * pixel / res;
  float outside = step(uv.x, 0.0) + step(1.0, uv.x) + step(uv.y, 0.0) + step(1.0, uv.y);
  vec2 dir = cc * aberr * (1.0 + glitch * 6.0);
  vec3 col = sceneAt(uv, dir);
  // cheap bloom from blurry mip levels of the scene
  if (bloom > 0.0) {
    vec3 b1 = texture2D(tScene, uv, 2.5).rgb;
    vec3 b2 = texture2D(tScene, uv, 4.5).rgb;
    vec3 b3 = texture2D(tScene, uv, 6.0).rgb;
    col += (max(b1 - 0.8, 0.0) * 0.5 + max(b2 - 0.6, 0.0) * 0.6 + max(b3 - 0.5, 0.0) * 0.5) * bloom;
  }
  col = aces(col * exposure);
  col = pow(col, vec3(1.0 / 2.2));
  col = (col - 0.5) * contrast + 0.5;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l) * tint, desat);
  col.r += redPulse * 0.35 * (1.0 - l);
  col.gb *= 1.0 - redPulse * 0.35;

  // jump-scare face
  if (faceAmt > 0.0) {
    vec2 p = vUv - 0.5 - faceOffset;
    p.x *= res.x / res.y;
    vec2 fuv = p / faceScale + 0.5;
    fuv.y = fuv.y;
    vec2 fd = vec2(0.006 + glitch * 0.02, 0.0);
    vec4 fc = texture2D(tFace, fuv);
    float fr = texture2D(tFace, fuv + fd).r;
    float fb = texture2D(tFace, fuv - fd).b;
    vec3 face = pow(vec3(fr, fc.g, fb), vec3(1.0 / 2.2));
    float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
    col = mix(col, face * 1.15, fc.a * inside * faceAmt);
  }

  // scanlines + rolling bar
  col *= 1.0 - scan * (0.5 + 0.5 * sin(vUv.y * res.y * 1.6));
  float bar = smoothstep(0.0, 0.06, abs(fract(vUv.y * 0.6 - time * 0.11) - 0.5) - 0.44);
  col *= 1.0 - roll * (1.0 - bar) * 0.35;
  // grain + static
  float n = hash(vUv * res + vec2(fract(time * 37.0) * 311.0, fract(time * 53.0) * 173.0));
  col += (n - 0.5) * noise;
  col = mix(col, vec3(n * 0.9), clamp(staticAmt, 0.0, 1.0));
  // vignette
  float v = smoothstep(0.95, 0.25, length(cc * vec2(1.0, 0.85)) * 1.35);
  col *= mix(1.0, v, vignette);
  col = mix(col, flashColor, clamp(flash, 0.0, 1.0));
  col *= 1.0 - clamp(fade, 0.0, 1.0);
  col *= 1.0 - clamp(outside, 0.0, 1.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const PRESETS = {
  office: {
    exposure: 1.0, noise: 0.06, scan: 0, vignette: 0.75, aberr: 0.0025, distort: 0.06, desat: 0.12,
    tint: [1, 0.97, 0.92], contrast: 1.06, bloom: 1, roll: 0, pixel: 1, scale: 1,
  },
  cctv: {
    exposure: 2.3, noise: 0.13, scan: 0.14, vignette: 0.8, aberr: 0.005, distort: 0.22, desat: 0.58,
    tint: [0.84, 1.05, 0.92], contrast: 1.12, bloom: 1.2, roll: 1, pixel: 1, scale: 0.5,
  },
  cinema: {
    exposure: 1.1, noise: 0.05, scan: 0, vignette: 0.7, aberr: 0.002, distort: 0.03, desat: 0.15,
    tint: [1, 0.96, 0.9], contrast: 1.08, bloom: 1, roll: 0, pixel: 1, scale: 1,
  },
};

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    }));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 1);
    this.isMobile = matchMedia('(pointer: coarse)').matches;
    this.maxDpr = this.isMobile ? 1.25 : 1.5;
    const hasFloat = r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float');
    this.rtType = hasFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const rtOpts = { type: this.rtType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
    this.rtFull = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, samples: this.isMobile ? 0 : 4 });
    this.rtLow = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, samples: 0 });

    this.blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.blank.needsUpdate = true;
    this.uniforms = {
      tScene: { value: null },
      tFace: { value: this.blank },
      res: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      exposure: { value: 1 },
      noise: { value: 0 },
      scan: { value: 0 },
      vignette: { value: 0 },
      aberr: { value: 0 },
      distort: { value: 0 },
      glitch: { value: 0 },
      staticAmt: { value: 0 },
      desat: { value: 0 },
      flash: { value: 0 },
      fade: { value: 0 },
      faceAmt: { value: 0 },
      faceScale: { value: 1 },
      faceOffset: { value: new THREE.Vector2() },
      roll: { value: 0 },
      contrast: { value: 1 },
      bloom: { value: 0 },
      redPulse: { value: 0 },
      pixel: { value: 1 },
      tint: { value: new THREE.Color(1, 1, 1) },
      flashColor: { value: new THREE.Color(1, 1, 1) },
    };
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false }),
    );
    quad.frustumCulled = false;
    this.postScene.add(quad);

    // per-frame effect state, written by scenes
    this.fx = { glitch: 0, staticAmt: 0, flash: 0, fade: 0, faceAmt: 0, faceScale: 1, faceX: 0, faceY: 0, redPulse: 0, shake: 0 };
    this.flashColor = new THREE.Color(1, 1, 1);
    this.preset = PRESETS.office;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.w = Math.floor(w * dpr);
    this.h = Math.floor(h * dpr);
    this.rtFull.setSize(this.w, this.h);
    this.rtLow.setSize(Math.max(2, Math.floor(this.w * 0.5)), Math.max(2, Math.floor(this.h * 0.5)));
    this.aspect = w / h;
  }

  setFace(texture) {
    this.uniforms.tFace.value = texture || this.blank;
  }

  /** Render a 3D scene through the post-processing pass. */
  render(scene, camera, presetName = 'office', time = 0) {
    const p = (this.preset = PRESETS[presetName] || PRESETS.office);
    if (camera.aspect !== this.aspect) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
    const rt = p.scale < 1 ? this.rtLow : this.rtFull;
    const r = this.renderer;
    if (scene) {
      r.setRenderTarget(rt);
      r.clear();
      r.render(scene, camera);
    } else {
      r.setRenderTarget(rt);
      r.clear();
    }
    const u = this.uniforms;
    const fx = this.fx;
    u.tScene.value = rt.texture;
    u.res.value.set(this.w, this.h);
    u.time.value = time;
    u.exposure.value = p.exposure * (fx.exposure ?? 1);
    u.noise.value = p.noise + (fx.noiseAdd || 0);
    u.scan.value = p.scan;
    u.vignette.value = p.vignette;
    u.aberr.value = p.aberr;
    u.distort.value = p.distort;
    u.desat.value = Math.min(1, p.desat + (fx.desatAdd || 0));
    u.tint.value.setRGB(...p.tint);
    u.contrast.value = p.contrast;
    u.bloom.value = p.bloom;
    u.roll.value = p.roll;
    u.pixel.value = p.pixel;
    u.glitch.value = fx.glitch;
    u.staticAmt.value = fx.staticAmt;
    u.flash.value = fx.flash;
    u.flashColor.value.copy(this.flashColor);
    u.fade.value = fx.fade;
    u.faceAmt.value = fx.faceAmt;
    u.faceScale.value = fx.faceScale;
    u.faceOffset.value.set(fx.faceX, fx.faceY);
    u.redPulse.value = fx.redPulse;
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }

  /** Pre-compile shaders of a scene so switching cameras never stutters. */
  async warm(scene, camera) {
    const r = this.renderer;
    try {
      if (r.compileAsync) await r.compileAsync(scene, camera);
      else r.compile(scene, camera);
    } catch (e) {
      r.compile(scene, camera);
    }
    r.setRenderTarget(this.rtLow);
    r.render(scene, camera);
    r.setRenderTarget(null);
  }
}
