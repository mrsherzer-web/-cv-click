// Day and night. The game lives in a late afternoon; chapter four's visit to the bank happens at two in
// the morning. One number from 0 (day) to 1 (night), eased over a few seconds, moves the sky's colors,
// the light, the fog, the painted horizon and the exposure together. At night the Renault's headlights
// come on (two spotlights, added only then so the day pays nothing for them), and a mission may add a
// few lamps of its own. On top of that, two moods a mission can lay over the hour: rain (`setWeather`, a
// darker, bluer light, a lower sky, the fog closer) and an emergency (`setAlert`, the ambient light turned
// a dim red; fx.redAlert drives it and owns the flashing lamps).
import * as THREE from 'three';

const DAY = {
  top: '#3d7fd6', horizon: '#e7d8c2', sunGlow: '#fff0d2', fog: '#e7d8c2', ring: '#ffffff',
  hemiSky: '#cfe0ff', hemiGround: '#8a7452', hemi: 1.35, sun: '#fff0d8', sunI: 2.6, exposure: 1.0,
};
const NIGHT = {
  top: '#070c1c', horizon: '#141c32', sunGlow: '#aebde6', fog: '#0b1020', ring: '#1d2336',
  hemiSky: '#223059', hemiGround: '#100e14', hemi: 0.72, sun: '#93a9dd', sunI: 0.75, exposure: 0.95,
};

// what rain does to the light, by day and by night: the sky goes grey, the light cooler and lower
const WET = {
  top: ['#6f7b8c', '#04070d'], horizon: ['#9aa3ae', '#0a0e18'], fog: ['#8d97a4', '#080c16'],
  hemiSky: ['#9fb0cc', '#1d2a4c'], sun: ['#b9c6dc', '#7d90c0'],
};
const RED = { hemiSky: '#ff3a26', hemiGround: '#2a0603', fog: '#260806' };

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
    this.tmp2 = new THREE.Color();
    this.wetC = Object.fromEntries(Object.entries(WET).map(([k, [a, b]]) => [k, [c(a), c(b)]]));
    this.redC = Object.fromEntries(Object.entries(RED).map(([k, v]) => [k, c(v)]));
    this.wet = 0;           // rain on the light, 0..1 (eased toward wetTarget)
    this.wetTarget = 0;
    this.wetRate = 0;
    this.alert = 0;         // the red of an emergency, 0..1 (set every frame by fx.redAlert while it runs)
    this.fogNear = scene.fog?.near ?? 70;
  }

  // rain's light: 0 dry, 1 a downpour; eased over `seconds` (0 at once)
  setWeather(k, seconds = 2.5) {
    this.wetTarget = Math.max(0, Math.min(1, k || 0));
    this.wetRate = seconds > 0 ? 1 / seconds : Infinity;
    if (!(seconds > 0)) { this.wet = this.wetTarget; this.applyLight(); }
  }
  // the emergency's red on the ambient light, 0..1 (immediate: the caller eases it)
  setAlert(k) {
    k = Math.max(0, Math.min(1, k || 0));
    if (Math.abs(k - this.alert) < 0.004 && (k > 0 || this.alert === 0)) return;
    this.alert = k;
    this.applyLight();
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
    let lit = false;
    if (this.night !== this.target) {
      const step = this.rate * dt;
      this.night = this.night < this.target ? Math.min(this.target, this.night + step) : Math.max(this.target, this.night - step);
      this.apply();
      lit = true;
    }
    if (this.wet !== this.wetTarget) {
      const step = this.wetRate * dt;
      this.wet = this.wet < this.wetTarget ? Math.min(this.wetTarget, this.wet + step) : Math.max(this.wetTarget, this.wet - step);
      if (!lit) this.applyLight();
    }
    if (this.lampsIn && (this.cullT -= dt) <= 0) { this.cullT = 0.5; this.cull(); }
  }

  // the sky, the fog, the sun and the ambient light for the hour, then rain and the emergency over them
  applyLight() {
    const n = this.night, d = this.day, k = this.nite, s = this.sky, u = s.dome.material.uniforms, mix = (a, b) => this.tmp.copy(a).lerp(b, n);
    const w = this.wet, r = this.alert, W = this.wetC, R = this.redC;
    const wet = (col, key, amount) => { if (w > 0) col.lerp(this.tmp2.copy(W[key][0]).lerp(W[key][1], n), amount * w); return col; };
    wet(u.top.value.copy(mix(d.top, k.top)), 'top', 0.8);
    wet(u.horizon.value.copy(mix(d.horizon, k.horizon)), 'horizon', 0.75);
    u.sunColor.value.copy(mix(d.sunGlow, k.sunGlow)).multiplyScalar(1 - 0.75 * w);
    const fog = wet(this.scene.fog.color.copy(mix(d.fog, k.fog)), 'fog', 0.7);
    if (r > 0) fog.lerp(R.fog, 0.35 * r);
    this.scene.fog.near = this.fogNear * (1 - 0.5 * w);
    this.scene.background.copy(fog);
    s.ring.material.color.copy(mix(d.ring, k.ring)).multiplyScalar(1 - 0.45 * w);
    wet(s.hemi.color.copy(mix(d.hemiSky, k.hemiSky)), 'hemiSky', 0.45);
    s.hemi.groundColor.copy(mix(d.hemiGround, k.hemiGround));
    if (r > 0) { s.hemi.color.lerp(R.hemiSky, 0.6 * r); s.hemi.groundColor.lerp(R.hemiGround, 0.6 * r); }
    s.hemi.intensity = (d.hemi + (k.hemi - d.hemi) * n) * (1 - 0.3 * w) * (1 - 0.35 * r);
    wet(s.sun.color.copy(mix(d.sun, k.sun)), 'sun', 0.5);
    s.sun.intensity = (d.sunI + (k.sunI - d.sunI) * n) * (1 - 0.6 * w) * (1 - 0.4 * r);
    this.renderer.toneMappingExposure = (d.exposure + (k.exposure - d.exposure) * n) * (1 - 0.08 * w);
  }

  apply() {
    const n = this.night;
    this.applyLight();
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
