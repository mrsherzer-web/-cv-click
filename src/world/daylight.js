// Day and night. The game lives in a late afternoon; chapter four's visit to the bank happens at two in
// the morning. One number from 0 (day) to 1 (night), eased over a few seconds, moves the sky's colors,
// the light, the fog, the painted horizon and the exposure together. At night the Renault's headlights
// come on (two spotlights, added only then so the day pays nothing for them), and a mission may add a
// few lamps of its own.
import * as THREE from 'three';

const DAY = {
  top: '#3d7fd6', horizon: '#e7d8c2', sunGlow: '#fff0d2', fog: '#e7d8c2', ring: '#ffffff',
  hemiSky: '#cfe0ff', hemiGround: '#8a7452', hemi: 1.35, sun: '#fff0d8', sunI: 2.6, exposure: 1.0,
};
const NIGHT = {
  top: '#070c1c', horizon: '#141c32', sunGlow: '#aebde6', fog: '#0b1020', ring: '#1d2336',
  hemiSky: '#223059', hemiGround: '#100e14', hemi: 0.72, sun: '#93a9dd', sunI: 0.75, exposure: 0.95,
};

const c = (hex) => new THREE.Color(hex);

export class Daylight {
  constructor({ scene, sky, renderer }) {
    this.scene = scene;
    this.sky = sky;
    this.renderer = renderer;
    this.night = 0;
    this.target = 0;
    this.rate = 0;
    this.lamps = [];        // lights that exist only at night: { light, intensity }
    this.lampsIn = false;
    this.focus = null;      // where the player is: only the nearest lamps are in the scene (phones cannot light more)
    this.cullT = 0;
    this.emissives = [];    // materials that glow at night: { mat, intensity }
    this.car = null;        // the Renault's headlights
    this.day = Object.fromEntries(Object.entries(DAY).map(([k, v]) => [k, typeof v === 'string' ? c(v) : v]));
    this.nite = Object.fromEntries(Object.entries(NIGHT).map(([k, v]) => [k, typeof v === 'string' ? c(v) : v]));
    this.tmp = new THREE.Color();
  }

  // go to night (1) or day (0) over `seconds`; 0 switches at once
  set(night, seconds = 0) {
    this.target = night;
    this.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (!seconds) { this.night = night; this.apply(); }
  }

  addLamp(light, intensity) { this.lamps.push({ light, intensity, on: false }); if (this.lampsIn) this.cull(true); }
  removeLamps(list) { for (const l of list) { this.lamps = this.lamps.filter((q) => q.light !== l); this.scene.remove(l); } }

  // the twelve lamps nearest the player (within 140 m) are the ones in the scene
  cull(force = false) {
    const f = this.focus || { x: 0, z: 0 };
    const near = this.lamps.map((l) => ({ l, d: Math.hypot(l.light.position.x - f.x, l.light.position.z - f.z) })).filter((q) => q.d < 140).sort((a, b) => a.d - b.d).slice(0, 12);
    const set = new Set(near.map((q) => q.l));
    const glow = Math.max(0, (this.night - 0.3) / 0.7);
    for (const l of this.lamps) { const on = this.lampsIn && set.has(l); if (on !== l.on || force) { l.on = on; if (on) { l.light.intensity = l.intensity * glow * (l.k ?? 1); this.scene.add(l.light); } else this.scene.remove(l.light); } }
  }
  addEmissive(mat, intensity) { this.emissives.push({ mat, intensity }); }
  // lamps near a point (a building whose power is cut) at a fraction of their light; 1 brings them back
  dimNear(x, z, r, k) {
    for (const l of this.lamps) if (Math.hypot(l.light.position.x - x, l.light.position.z - z) < r) { l.k = k; if (l.on) l.light.intensity = l.intensity * Math.max(0, (this.night - 0.3) / 0.7) * k; }
  }

  // the Renault: two headlights, aimed down the road ahead
  attachCar(car) {
    if (this.car) return;
    const lights = [];
    for (const sx of [-0.55, 0.55]) {
      const l = new THREE.SpotLight('#ffe9c0', 0, 44, 0.5, 0.55, 1.1);
      l.position.set(sx, 0.78, 2.0);
      l.target.position.set(sx * 0.6, -0.4, 18);
      l.castShadow = false;
      car.model.add(l.target);
      lights.push({ light: l, intensity: 160 });
    }
    this.car = { car, lights };
  }

  update(dt) {
    if (this.night !== this.target) {
      const step = this.rate * dt;
      this.night = this.night < this.target ? Math.min(this.target, this.night + step) : Math.max(this.target, this.night - step);
      this.apply();
    }
    if (this.lampsIn && (this.cullT -= dt) <= 0) { this.cullT = 0.5; this.cull(); }
  }

  apply() {
    const n = this.night, d = this.day, k = this.nite, s = this.sky, u = s.dome.material.uniforms, mix = (a, b) => this.tmp.copy(a).lerp(b, n);
    u.top.value.copy(mix(d.top, k.top));
    u.horizon.value.copy(mix(d.horizon, k.horizon));
    u.sunColor.value.copy(mix(d.sunGlow, k.sunGlow));
    this.scene.fog.color.copy(mix(d.fog, k.fog));
    this.scene.background.copy(this.scene.fog.color);
    s.ring.material.color.copy(mix(d.ring, k.ring));
    s.hemi.color.copy(mix(d.hemiSky, k.hemiSky));
    s.hemi.groundColor.copy(mix(d.hemiGround, k.hemiGround));
    s.hemi.intensity = d.hemi + (k.hemi - d.hemi) * n;
    s.sun.color.copy(mix(d.sun, k.sun));
    s.sun.intensity = d.sunI + (k.sunI - d.sunI) * n;
    this.renderer.toneMappingExposure = d.exposure + (k.exposure - d.exposure) * n;
    // the lamps live in the scene only while there is any night
    const want = n > 0.02;
    if (want !== this.lampsIn) {
      this.lampsIn = want;
      this.cull(true);
      if (this.car) for (const l of this.car.lights) want ? this.car.car.model.add(l.light) : this.car.car.model.remove(l.light);
    }
    const glow = Math.max(0, (n - 0.3) / 0.7);
    for (const l of this.lamps) l.light.intensity = l.intensity * glow * (l.k ?? 1);
    if (this.car) {
      for (const l of this.car.lights) l.light.intensity = l.intensity * glow;
      const hm = this.car.car.model.userData.headMat;
      if (hm) hm.emissiveIntensity = 2.2 * glow;
    }
    for (const e of this.emissives) e.mat.emissiveIntensity = e.intensity * glow;
  }
}
