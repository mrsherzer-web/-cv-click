// ============================================================================
//  Characters = photo cut-outs on planes, with glowing eyes (and bottle)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { ASSET_META } from '../generated/assets-meta.js';
import * as T from '../engine/textures.js';

const loader = new THREE.TextureLoader();
const texCache = new Map();
export function loadTex(url, srgb = true) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((res, rej) =>
    loader.load(
      url,
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        res(t);
      },
      undefined,
      rej,
    ),
  );
  texCache.set(url, p);
  return p;
}

const VS = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = /* glsl */ `
uniform sampler2D map;
uniform sampler2D glowMap;
uniform float light, eyeGlow, bottleGlow, bottomFade, opacity, blur;
uniform vec3 eyeColor, tint;
varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  vec2 uv = vUv;
  vec4 c = texture2D(map, uv);
  if (blur > 0.0) {
    c += texture2D(map, uv + vec2(0.0, blur));
    c += texture2D(map, uv - vec2(0.0, blur));
    c += texture2D(map, uv + vec2(0.0, blur * 2.0));
    c /= 4.0;
  }
  float a = c.a * opacity;
  if (a < 0.06) discard;
  vec3 col = c.rgb * light * tint;
  if (bottomFade > 0.0) col *= smoothstep(0.0, bottomFade, uv.y);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
  vec3 g = texture2D(glowMap, uv).rgb;
  gl_FragColor.rgb += eyeColor * g.r * eyeGlow + vec3(1.0, 0.06, 0.04) * g.g * bottleGlow;
}`;

export class Character {
  /**
   * @param {string} key  char_gefen | char_cap | char_smiler
   */
  constructor(key, map, glow) {
    this.key = key;
    this.meta = ASSET_META[key];
    const aspect = this.meta.aspect;
    const geo = new THREE.PlaneGeometry(aspect, 1);
    geo.translate(0, 0.5, 0);
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        map: { value: map },
        glowMap: { value: glow },
        light: { value: 1 },
        eyeGlow: { value: 3 },
        bottleGlow: { value: 0 },
        bottomFade: { value: 0.18 },
        opacity: { value: 1 },
        blur: { value: 0 },
        eyeColor: { value: new THREE.Color(1, 0.12, 0.06) },
        tint: { value: new THREE.Color(1, 1, 1) },
      },
    ]);
    this.uniforms.map.value = map;
    this.uniforms.glowMap.value = glow;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      fog: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    // contact shadow
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: T.tex(T.shadowBlob()), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.group = new THREE.Group();
    this.group.add(this.mesh, this.shadow);
    this.where = null;
  }

  /** Place in a room at a spot: {pos:[x,y,z], h, light, glow, fade, shadow} */
  place(room, spot) {
    if (this.group.parent !== room.scene) room.scene.add(this.group);
    const [x, y, z] = spot.pos;
    this.group.position.set(x, 0, z);
    this.mesh.position.y = y;
    this.mesh.scale.setScalar(spot.h);
    this.uniforms.light.value = spot.light ?? 1;
    this.uniforms.eyeGlow.value = spot.glow ?? 3;
    this.uniforms.bottomFade.value = spot.fade ?? 0.18;
    this.uniforms.bottleGlow.value = spot.bottle ?? (this.key === 'char_cap' ? 1.6 : 0);
    this.shadow.visible = spot.shadow !== false && y < 0.6;
    this.shadow.scale.set(spot.h * this.meta.aspect * 0.9, spot.h * 0.35, 1);
    this.shadow.position.y = 0.01;
    this.baseLight = spot.light ?? 1;
    this.spot = spot;
    this.group.visible = true;
    this.room = room;
  }

  remove() {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.room = null;
  }

  faceCamera(cam) {
    const p = this.group.position;
    this.mesh.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) + (this.spot?.yaw || 0);
  }
}
