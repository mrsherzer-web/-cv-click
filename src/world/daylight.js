// Day and night. The game lives in a late afternoon; chapter four's visit to the bank happens at two in
// the morning. One number from 0 (day) to 1 (night), eased over a few seconds, moves the sky's colors,
// the light, the fog, the painted horizon and the exposure together. At night the Renault's headlights
// come on (two spotlights, added only then so the day pays nothing for them), and a mission may add a
// few lamps of its own. On top of that, two moods a mission can lay over the hour: rain (`setWeather`, a
// darker, bluer light, a lower sky, the fog closer) and an emergency (`setAlert`, the ambient light turned
// a dim red; fx.redAlert drives it and owns the flashing lamps).
// Chapter ten adds looks: a whole light a mission lays over the hour and lets go again (`preset`: the
// sunrise of 05:30, the red sky after a far blast, the golden hour of the walk home), and the other
// dimension's (`otherworld`: violet, two moons, motes, fog at 80 m). A look is blended over whatever the
// hour, the rain and the night give, so letting it go leaves the light exactly as those have it; the red
// of an emergency still goes over it. With no look laid, nothing here runs differently from before.
import * as THREE from 'three';
import { SUN_DIR } from './sky.js';

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

// the looks a mission may lay over the hour. Colours as the day's table has them; sunDir: where the sun
// stands (x east, y up, z south); glow: a band of colour low along the horizon, strongest toward the sun
// (or toward the point the mission names)
const LOOKS = {
  // 05:30: the sun just over the hills in the east, long shadows, the horizon pink and orange under a sky still cool
  sunrise: {
    top: '#3f66ad', horizon: '#f7a98a', sunGlow: '#ffc48e', fog: '#e8ae98', ring: '#b98a86',
    hemiSky: '#cdb9dc', hemiGround: '#6a5148', hemi: 0.98, sun: '#ffae6a', sunI: 2.25, exposure: 1.0,
    sunDir: [0.955, 0.15, 0.26], glow: '#ff6a3c', glowAmount: 0.85,
  },
  // after the far blast: the sky and the light go red
  redSky: {
    top: '#4f100c', horizon: '#e2482a', sunGlow: '#ff9468', fog: '#b23c28', ring: '#8a3a2c',
    hemiSky: '#ff7c5c', hemiGround: '#3c100a', hemi: 1.05, sun: '#ff8458', sunI: 1.7, exposure: 1.0,
    glow: '#ff3410', glowAmount: 0.9, glowDir: [1, 0, 0],
  },
  // the golden hour: the sun low in the west, everything warm
  sunset: {
    top: '#4a70b6', horizon: '#ffc079', sunGlow: '#ffd49a', fog: '#f0bb86', ring: '#d3a37c',
    hemiSky: '#ffd8b0', hemiGround: '#7a5a3c', hemi: 1.1, sun: '#ffac55', sunI: 2.4, exposure: 1.0,
    sunDir: [-0.94, 0.17, 0.3], glow: '#ff8528', glowAmount: 0.8,
  },
};
// the other dimension: a violet sky and light, no sun (the light is the great moon's), fog that hides
// everything past 80 m; the two moons, the ribbons and the motes come in with it
const OTHER = {
  top: '#170a36', horizon: '#7a4cc4', sunGlow: '#000000', fog: '#7044b6', ring: '#2c1a56',
  hemiSky: '#b9a0ff', hemiGround: '#3c2668', hemi: 1.15, sun: '#c6b8ff', sunI: 1.45, exposure: 1.0,
  fogNear: 5, fogFar: 80, glow: '#c070ff', glowAmount: 0.35,
};
const MOON_YAW = 1.9;          // where the great moon hangs unless told otherwise: east, a little north
const VIEW_PAST_FOG = 16;      // metres of far plane kept past the dimension's fog

const c = (hex) => new THREE.Color(hex);
// a look's table as colours and vectors
const look = (def) => Object.fromEntries(Object.entries(def).map(([k, v]) => [k, typeof v === 'string' ? c(v) : Array.isArray(v) ? new THREE.Vector3(...v).normalize() : v]));
const smooth = (k) => k * k * (3 - 2 * k);

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
    // chapter ten: looks over the hour
    this.lookDefs = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, look(v)]));
    this.otherDef = look(OTHER);
    this.looks = [];        // the looks laid over the hour, in the order they came: { name, def, k, to, rate, sunDir, glowDir }
    this.other = null;      // the other dimension's look, over those: { def, k, to, rate, sunDir, glowDir, yaw }
    this.cracks = { k: 0, to: 0, rate: Infinity }; // the sky coming apart, 0..1
    this.lookDirty = false; // a look has just gone: what it moved (the sun, the fog's reach) is put back once
    this.dir = new THREE.Vector3();
    this.gdir = new THREE.Vector3();
    if (sky) sky.onQuality = () => { if (this.looks.length || this.other) this.applyLight(); };
  }

  // a look laid over the hour: 'sunrise' (05:30: a low warm sun in the east, long shadows, a pink and orange
  // horizon), 'redSky' (the sky and the light go red) or 'sunset' (the golden hour, the sun low in the west),
  // eased in over `seconds` (0: at once); null lets it go the same way, and the light is then exactly what
  // the hour, the rain and the night make it. One look at a time: a new one crosses over from the old.
  // `toward` { x, z }: a point in the world the glow (and a look's sun) stands over, seen from the player
  preset(name = null, { seconds = 3, toward = null } = {}) {
    const def = name ? this.lookDefs[name] : null;
    if (name && !def) return this.presetName;
    const rate = seconds > 0 ? 1 / seconds : Infinity;
    for (const L of this.looks) if (L.name !== name) { L.to = 0; L.rate = rate; if (rate === Infinity) L.k = 0; }
    if (def) {
      let L = this.looks.find((q) => q.name === name);
      if (!L) { L = { name, def, k: 0, to: 1, rate, sunDir: null, glowDir: new THREE.Vector3(1, 0, 0) }; this.looks.push(L); }
      L.to = 1; L.rate = rate; if (rate === Infinity) L.k = 1;
      this.aim(L, toward);
    }
    this.sweep();
    this.applyLight();
    return this.presetName;
  }
  get presetName() { return this.looks.find((L) => L.to > 0)?.name ?? null; }
  // where a look's sun and glow stand: the look's own place, or over `toward` as seen from the player
  aim(L, toward) {
    const D = L.def, f = this.focus;
    let ax = null, az = null;
    if (toward && f) { const dx = toward.x - f.x, dz = toward.z - f.z, l = Math.hypot(dx, dz); if (l > 1) { ax = dx / l; az = dz / l; } }
    if (D.sunDir) {
      L.sunDir = (L.sunDir || new THREE.Vector3()).copy(D.sunDir);
      if (ax !== null) { const flat = Math.hypot(D.sunDir.x, D.sunDir.z); L.sunDir.set(ax * flat, D.sunDir.y, az * flat); }
      L.glowDir.set(L.sunDir.x, 0, L.sunDir.z).normalize();
    } else if (ax !== null) L.glowDir.set(ax, 0, az);
    else if (D.glowDir) L.glowDir.copy(D.glowDir);
  }

  // the other dimension's look, over everything else: on or off, eased over `seconds` (0: at once, as under
  // a white-out). `moonYaw`: where the great moon hangs (a yaw as the game has them: 0 is +z, π/2 is +x);
  // the small one hangs to its right, and the light comes from the great one
  otherworld(on = true, { seconds = 0, moonYaw = null } = {}) {
    const rate = seconds > 0 ? 1 / seconds : Infinity;
    if (on) {
      if (!this.other) this.other = { def: this.otherDef, k: 0, to: 1, rate, sunDir: new THREE.Vector3(), glowDir: new THREE.Vector3(), yaw: null };
      const o = this.other;
      o.to = 1; o.rate = rate; if (rate === Infinity) o.k = 1;
      if (moonYaw !== null || o.yaw === null) this.moons(moonYaw ?? MOON_YAW);
    } else if (this.other) {
      const o = this.other;
      o.to = 0; o.rate = rate; if (rate === Infinity) o.k = 0;
      this.cracks.to = 0; this.cracks.rate = rate; if (rate === Infinity) this.cracks.k = 0;
    }
    this.sweep();
    this.applyLight();
    return this.otherOn;
  }
  get otherOn() { return !!this.other && this.other.to > 0; }
  // the two moons, by the great one's yaw; returns where they hang (unit vectors toward them)
  moons(yaw = MOON_YAW) {
    const u = this.sky.dome.material.uniforms, o = this.other;
    const at = (v, a, el) => v.set(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
    at(u.moonA.value, yaw, 0.17);
    at(u.moonB.value, yaw - 0.46, 0.2);
    if (o) { o.yaw = yaw; o.sunDir.copy(u.moonA.value); o.glowDir.set(u.moonA.value.x, 0, u.moonA.value.z).normalize(); this.applyLight(); }
    return [u.moonA.value, u.moonB.value];
  }
  // the sky coming apart (cracks of light across it), 0..1, eased over `seconds`
  crack(k = 1, seconds = 0) {
    const q = this.cracks;
    q.to = Math.max(0, Math.min(1, k || 0));
    q.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (!(seconds > 0)) { q.k = q.to; this.applyLight(); }
  }
  // looks that have gone all the way out are dropped
  sweep() {
    for (let i = this.looks.length - 1; i >= 0; i--) if (this.looks[i].k === 0 && this.looks[i].to === 0) { this.looks.splice(i, 1); this.lookDirty = true; }
    if (this.other && this.other.k === 0 && this.other.to === 0) { this.other = null; this.lookDirty = true; }
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

  // the twelve lamps nearest the player (within 140 m) are the ones in the scene. Height counts too, from
  // where a lamp hangs over his own floor (3 m up): three times above, six times below his feet (a lamp
  // under the floor he stands on is a storey down), so in a building of storeys his own floor's lamps win
  // (they would light the other floors through the slabs: lamps cast no shadows). Lamps of one height
  // keep their order among themselves, as on a street
  cull(force = false) {
    const f = this.focus || { x: 0, z: 0 }, fy = Number.isFinite(f.y) ? f.y : null;
    const dist = (p) => {
      const h = Math.hypot(p.x - f.x, p.z - f.z);
      if (fy === null) return h;
      const dy = p.y - (fy + 3);
      return Math.hypot(h, dy * (p.y < fy ? 6 : 3));
    };
    const near = this.lamps.map((l) => ({ l, d: dist(l.light.position) })).filter((q) => q.d < 140).sort((a, b) => a.d - b.d).slice(0, 12);
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
    // the looks ease in and out
    if (this.looks.length || this.other || this.cracks.k !== this.cracks.to) {
      let moved = false;
      const ease = (q) => { if (q.k === q.to) return; const step = q.rate * dt; q.k = q.k < q.to ? Math.min(q.to, q.k + step) : Math.max(q.to, q.k - step); moved = true; };
      for (const L of this.looks) ease(L);
      if (this.other) ease(this.other);
      ease(this.cracks);
      if (moved) { this.sweep(); this.applyLight(); }
    }
    this.sky.tick?.(dt);
  }

  // the sky, the fog, the sun and the ambient light for the hour, then rain, then a look if one is laid, and
  // the emergency over them
  applyLight() {
    const n = this.night, d = this.day, k = this.nite, s = this.sky, u = s.dome.material.uniforms, mix = (a, b) => this.tmp.copy(a).lerp(b, n);
    const w = this.wet, r = this.alert, W = this.wetC, R = this.redC;
    const wet = (col, key, amount) => { if (w > 0) col.lerp(this.tmp2.copy(W[key][0]).lerp(W[key][1], n), amount * w); return col; };
    wet(u.top.value.copy(mix(d.top, k.top)), 'top', 0.8);
    wet(u.horizon.value.copy(mix(d.horizon, k.horizon)), 'horizon', 0.75);
    u.sunColor.value.copy(mix(d.sunGlow, k.sunGlow)).multiplyScalar(1 - 0.75 * w);
    const fog = wet(this.scene.fog.color.copy(mix(d.fog, k.fog)), 'fog', 0.7);
    let near = this.fogNear * (1 - 0.5 * w);
    s.ring.material.color.copy(mix(d.ring, k.ring)).multiplyScalar(1 - 0.45 * w);
    wet(s.hemi.color.copy(mix(d.hemiSky, k.hemiSky)), 'hemiSky', 0.45);
    s.hemi.groundColor.copy(mix(d.hemiGround, k.hemiGround));
    // by day the overcast takes a good part of the light; at night, already dark, only a little more
    let hemi = (d.hemi + (k.hemi - d.hemi) * n) * (1 - (0.3 - 0.18 * n) * w);
    wet(s.sun.color.copy(mix(d.sun, k.sun)), 'sun', 0.5);
    let sun = (d.sunI + (k.sunI - d.sunI) * n) * (1 - (0.6 - 0.3 * n) * w);
    let exposure = (d.exposure + (k.exposure - d.exposure) * n) * (1 - 0.08 * w);
    if (this.looks.length || this.other) {
      // each look in turn takes the light toward its own by how far it is in
      const dir = this.dir.copy(SUN_DIR), gdir = this.gdir.set(0, 0, 0), gcol = u.glowColor.value;
      let far = s.fogFar, glow = 0, moved = false;
      const lay = (L) => {
        const D = L.def, e = smooth(L.k);
        if (!(e > 0)) return;
        u.top.value.lerp(D.top, e); u.horizon.value.lerp(D.horizon, e); u.sunColor.value.lerp(D.sunGlow, e);
        fog.lerp(D.fog, e); s.ring.material.color.lerp(D.ring, e);
        s.hemi.color.lerp(D.hemiSky, e); s.hemi.groundColor.lerp(D.hemiGround, e); s.sun.color.lerp(D.sun, e);
        hemi += (D.hemi - hemi) * e; sun += (D.sunI - sun) * e; exposure += (D.exposure - exposure) * e;
        if (D.fogNear !== undefined) near += (D.fogNear - near) * e;
        if (D.fogFar !== undefined) far += (D.fogFar - far) * e;
        if (L.sunDir) { dir.lerp(L.sunDir, e); moved = true; }
        if (D.glowAmount) { if (glow > 0) gcol.lerp(D.glow, e); else gcol.copy(D.glow); gdir.lerp(L.glowDir, glow > 0 ? e : 1); }
        glow += ((D.glowAmount || 0) - glow) * e;
      };
      for (const L of this.looks) lay(L);
      const o = this.other, ok = o ? smooth(o.k) : 0;
      if (o) lay(o);
      s.setSun(moved ? dir : null);
      u.glowAmount.value = glow;
      if (gdir.lengthSq() > 1e-6) u.glowDir.value.copy(gdir).normalize();
      u.moonAmount.value = ok; u.weird.value = ok;
      s.setMotes(ok);
      this.scene.fog.far = far;
      s.limitView(o && o.k >= 1 ? o.def.fogFar + VIEW_PAST_FOG : null); // past the fog nothing is drawn
    } else if (this.lookDirty) {
      // the last look has gone: the sun, the fog's reach and the sky's extras as they always were
      this.lookDirty = false;
      s.setSun(null);
      u.glowAmount.value = 0; u.moonAmount.value = 0; u.weird.value = 0;
      s.setMotes(0);
      this.scene.fog.far = s.fogFar;
      s.limitView(null);
    }
    u.breakAmount.value = this.cracks.k;
    if (r > 0) fog.lerp(R.fog, 0.35 * r);
    this.scene.fog.near = near;
    this.scene.background.copy(fog);
    if (r > 0) { s.hemi.color.lerp(R.hemiSky, 0.6 * r); s.hemi.groundColor.lerp(R.hemiGround, 0.6 * r); }
    s.hemi.intensity = hemi * (1 - 0.35 * r);
    s.sun.intensity = sun * (1 - 0.4 * r);
    this.renderer.toneMappingExposure = exposure;
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
