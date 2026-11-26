// ============================================================================
//  Actors = photo cut-outs on camera facing planes.  Lit by a cheap estimate of
//  the room lamps plus a per-pixel flashlight cone; eyes glow in the dark.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import { floorY, roomAt } from './layout.js';

const VS = /* glsl */ `
#include <fog_pars_vertex>
uniform float twitch, time, lean;
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec3 p = position;
  float top = smoothstep(0.62, 1.0, uv.y);
  p.x += top * twitch * (sin(time * 43.0) * 0.6 + sin(time * 17.3) * 0.4) * 0.09;
  p.x += lean * uv.y * uv.y * 0.35;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FS = /* glsl */ `
uniform sampler2D map;
uniform sampler2D glowMap;
uniform vec3 light, eyeColor, tint, flPos, flDir, flColor;
uniform float eyeGlow, bottomFade, opacity, glitch, time, flCos, flPower, hasGlow, sil;
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  vec2 uv = vUv;
  if (glitch > 0.0) {
    float band = floor(uv.y * 34.0);
    float r = hash(vec2(band, floor(time * 24.0)));
    if (r < glitch * 0.6) uv.x += (hash(vec2(band, 7.7 + floor(time * 24.0))) - 0.5) * 0.22 * glitch;
  }
  vec4 c = texture2D(map, uv);
  float a = c.a * opacity;
  if (a < 0.08) discard;
  vec3 L = light;
  if (flPower > 0.0) {
    vec3 d = vWorld - flPos;
    float dist = length(d);
    float cs = dot(d / dist, flDir);
    float spot = smoothstep(flCos, mix(flCos, 1.0, 0.45), cs);
    L += flColor * spot * flPower / (1.0 + dist * dist * 0.055);
  }
  vec3 col = c.rgb * mix(L, vec3(dot(L, vec3(0.33))) * 0.12, sil) * tint;
  if (bottomFade > 0.0) col *= smoothstep(0.0, bottomFade, uv.y);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
  if (hasGlow > 0.5) {
    vec3 g = texture2D(glowMap, uv).rgb;
    gl_FragColor.rgb += eyeColor * g.r * eyeGlow;
  }
}`;

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
blank.needsUpdate = true;

export class Actor {
  /**
   * @param world  World
   * @param sheet  { pose: { map, glow, aspect, h, fade } }
   */
  constructor(world, id, sheet, { eye = [1, 0.1, 0.05], glow = 3, shadow = true } = {}) {
    this.world = world;
    this.id = id;
    this.sheet = sheet;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.room = null;
    this.visible = false;
    this.eyeBase = glow;
    this.flicker = 0; // 0..1: eyes flicker
    this.jitter = 0;
    this.bob = 0;
    this.moving = false;
    this.t = Math.random() * 10;
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        map: { value: blank },
        glowMap: { value: blank },
        hasGlow: { value: 0 },
        light: { value: new THREE.Color(1, 1, 1) },
        eyeGlow: { value: glow },
        bottomFade: { value: 0 },
        opacity: { value: 1 },
        glitch: { value: 0 },
        twitch: { value: 0 },
        lean: { value: 0 },
        time: { value: 0 },
        sil: { value: 0 },
        eyeColor: { value: new THREE.Color(...eye) },
        tint: { value: new THREE.Color(1, 1, 1) },
        flPos: { value: new THREE.Vector3() },
        flDir: { value: new THREE.Vector3(0, 0, -1) },
        flColor: { value: new THREE.Color(1, 0.95, 0.85) },
        flCos: { value: 0.9 },
        flPower: { value: 0 },
      },
    ]);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      fog: true,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(1, 1, 1, 8);
    geo.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
    this.mesh.customDepthMaterial = this.depthMat;
    this.mesh.castShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    if (shadow) {
      this.shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: T.tex(T.shadowBlob()), transparent: true, depthWrite: false, opacity: 0.8 }),
      );
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = 0.015;
      this.shadow.renderOrder = 1;
      this.group.add(this.shadow);
    }
    this.group.visible = false;
    world.scene.add(this.group);
    this.setPose(Object.keys(sheet)[0]);
  }

  setPose(name) {
    const p = this.sheet[name] || this.sheet[Object.keys(this.sheet)[0]];
    if (!p || this.pose === p) return;
    this.pose = p;
    this.poseName = name;
    const u = this.uniforms;
    u.map.value = p.map || blank;
    u.glowMap.value = p.glow || blank;
    u.hasGlow.value = p.glow ? 1 : 0;
    u.bottomFade.value = p.fade || 0;
    this.depthMat.map = p.map || null;
    this.depthMat.needsUpdate = true;
    this.h = p.h || 1.78;
    this.aspect = p.aspect || 0.45;
    this.mesh.scale.set(this.h * this.aspect, this.h, 1);
    if (this.shadow) this.shadow.scale.set(this.h * this.aspect * 1.1, this.h * 0.32, 1);
    this.lift = p.lift || 0;
  }

  place(x, z, room = null, y = null) {
    this.x = x;
    this.z = z;
    this.room = room || roomAt(x, z) || this.room;
    this.y = y ?? floorY(x, z);
    this.group.position.set(x, this.y, z);
  }

  /** Vent stations sit above the floor */
  setY(y) {
    this.y = y;
    this.group.position.y = y;
  }

  show(v = true) {
    this.visible = v;
    this.group.visible = v;
  }

  /**
   * @param cam THREE.Camera that renders this frame
   * @param fl  flashlight {on, pos:Vector3, dir:Vector3, cos, power} or null
   */
  update(dt, cam, fl) {
    if (!this.visible) return;
    this.t += dt;
    const u = this.uniforms;
    u.time.value = this.t;
    const drawn = this.world.visible.has(this.room);
    this.group.visible = drawn;
    if (!drawn) return;
    // face the camera (yaw only)
    const dx = cam.position.x - this.x;
    const dz = cam.position.z - this.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    // walking bob + possessed jitter
    let oy = this.lift;
    if (this.moving) {
      this.bob += dt * 9;
      oy += Math.abs(Math.sin(this.bob)) * 0.05;
      u.lean.value += (0.25 - u.lean.value) * Math.min(1, dt * 6);
    } else u.lean.value += (0 - u.lean.value) * Math.min(1, dt * 6);
    let ox = 0;
    if (this.jitter > 0 && Math.sin(this.t * 31) > 0.7) ox = (Math.random() - 0.5) * 0.05 * this.jitter;
    this.mesh.position.set(ox, oy, 0);
    const L = this.world.sampleLight(this.x, this.y, this.z, this.room);
    u.light.value.setRGB(Math.min(1.7, L[0]), Math.min(1.7, L[1]), Math.min(1.7, L[2]));
    let eg = this.eyeBase;
    if (this.flicker > 0) eg *= 1 - this.flicker * (0.5 + 0.5 * Math.sin(this.t * 23 + Math.sin(this.t * 7) * 3));
    u.eyeGlow.value = eg;
    if (fl && fl.on) {
      u.flPos.value.copy(fl.pos);
      u.flDir.value.copy(fl.dir);
      u.flCos.value = fl.cos;
      u.flPower.value = fl.power;
    } else u.flPower.value = 0;
  }

  dispose() {
    this.world.scene.remove(this.group);
    this.material.dispose();
  }
}
