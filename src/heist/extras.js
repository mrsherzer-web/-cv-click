/* Heist chapter extras: night rain, pedestrians on the sidewalks, the police helicopter with a searchlight. */
const HExtras = {
  T: null, scene: null, peds: [], heli: null, rain: null, maxPeds: 16,

  init(T, scene, q) {
    this.T = T; this.scene = scene; this.peds = []; this.maxPeds = q === 'high' ? 18 : q === 'med' ? 12 : 6;
    this.makeRain(q === 'low' ? 500 : 1300);
  },
  reset() { for (const p of this.peds) this.dropPed(p); this.peds = []; this.dropHeli(); },
  dropPed(p) { this.scene.remove(p.rig.group); if (p.rig.mesh && p.rig.mesh.skeleton) p.rig.mesh.skeleton.dispose(); },
  dropHeli() {
    const H = this.heli; if (!H) return; this.heli = null;
    this.scene.remove(H.g); this.scene.remove(H.pool);
    H.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    H.pool.geometry.dispose(); H.pool.material.dispose();
  },

  /* ---------- rain: short streaks in a box that follows the camera ---------- */
  makeRain(n) {
    const T = this.T, pos = new Float32Array(n * 6);
    this.rainN = n; this.rainP = []; for (let k = 0; k < n; k++) this.rainP.push({ x: Math.random() * 60 - 30, y: Math.random() * 30, z: Math.random() * 60 - 30, s: 22 + Math.random() * 10 });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    const m = new T.LineBasicMaterial({ color: 0xb9c6ff, transparent: true, opacity: 0.32, depthWrite: false, fog: false, toneMapped: false });
    this.rain = new T.LineSegments(g, m); this.rain.frustumCulled = false; this.scene.add(this.rain); this.rainPos = pos;
  },
  updateRain(dt, cam, k) {
    if (!this.rain) return;
    this.rain.visible = k > 0.02; if (!this.rain.visible) return;
    this.rain.material.opacity = 0.3 * k;
    const P = this.rainPos, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (let i = 0; i < this.rainN; i++) {
      const r = this.rainP[i]; r.y -= r.s * dt;
      if (r.y < 0) { r.y = 26 + Math.random() * 6; r.x = Math.random() * 60 - 30; r.z = Math.random() * 60 - 30; }
      const x = cx + r.x, y = cy - 8 + r.y, z = cz + r.z, b = i * 6;
      P[b] = x; P[b + 1] = y; P[b + 2] = z; P[b + 3] = x + 0.04; P[b + 4] = y + 0.55; P[b + 5] = z + 0.02;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  },

  /* ---------- pedestrians walking around their block on the sidewalk ---------- */
  spawnPed(px, pz) {
    // pick a block near the player; walk its sidewalk loop (9 m from the road centre lines)
    const i = HX.clamp(Math.floor((px + HX.HALF) / HX.P) + Math.floor(Math.random() * 5) - 2, 0, HX.N - 1);
    const j = HX.clamp(Math.floor((pz + HX.HALF) / HX.P) + Math.floor(Math.random() * 5) - 2, 0, HX.N - 1);
    if (i === HX.HOTEL_BLOCK[0] && j === HX.HOTEL_BLOCK[1]) return;
    const x0 = HX.L(i) + 9.2, x1 = HX.L(i + 1) - 9.2, z0 = HX.L(j) + 9.2, z1 = HX.L(j + 1) - 9.2;
    const loop = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], dir = Math.random() < 0.5 ? 1 : -1;
    const seg = Math.floor(Math.random() * 4), t0 = Math.random();
    const a = loop[seg], b = loop[(seg + dir + 4) % 4];
    const x = HX.lerp(a[0], b[0], t0), z = HX.lerp(a[1], b[1], t0);
    if (Math.hypot(x - px, z - pz) < 30 && Math.random() < 0.7) return; // don't pop in right next to the player
    const rig = Heist.makePerson('civ', { seed: Math.floor(Math.random() * 32) }); // a bounded outfit pool: the model cache stays small
    const p = { rig, loop, dir, seg: (seg + dir + 4) % 4, x, z, h: 0, sp: 1.15 + Math.random() * 0.5, t: Math.random() * 10, state: 'walk', st: 0, vx: 0, vz: 0 };
    this.peds.push(p);
  },
  updatePeds(dt, ctx) {
    const px = ctx.px, pz = ctx.pz;
    for (let k = this.peds.length - 1; k >= 0; k--) { const p = this.peds[k]; if (Math.hypot(p.x - px, p.z - pz) > 170) { this.dropPed(p); this.peds.splice(k, 1); } }
    if (this.peds.length < this.maxPeds && Math.random() < dt * 6) this.spawnPed(px, pz);
    const cars = Heist.allCars();
    for (const p of this.peds) {
      p.t += dt;
      if (p.state === 'down') {
        p.st += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 3; p.vz *= 1 - dt * 3;
        p.rig.setPose('fall', p.t, Math.min(1, p.st / 0.6));
        if (p.st > 2.6) { p.state = 'flee'; p.st = 0; }
      } else {
        // danger: a fast car heading at me -> dive aside, too late -> knocked down
        let threat = null;
        for (const v of cars) {
          const sp = HVehicle.speed(v); if (sp < 5) continue;
          const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz); if (d > 14) continue;
          const ahead = (dx * v.vx + dz * v.vz) / (d * sp || 1);
          if (d < v.radius + 0.6 && sp > 6) { p.state = 'down'; p.st = 0; p.vx = v.vx * 0.5; p.vz = v.vz * 0.5; if (window.HAudio) HAudio.sfx('crash', { intensity: 0.2 }); if (v === (Heist.player && Heist.player.inCar) && HMission.mode === 'free' && HAI.witness(p.x, p.z, 60)) HAI.crime(1); threat = null; break; }
          if (ahead > 0.6) threat = v;
        }
        if (p.state === 'down') continue;
        if (threat && p.state !== 'dive') { p.state = 'dive'; p.st = 0; const s = Math.sign((p.x - threat.x) * threat.vz - (p.z - threat.z) * threat.vx) || 1; const L = Math.hypot(threat.vx, threat.vz) || 1; p.vx = threat.vz / L * 6 * s; p.vz = -threat.vx / L * 6 * s; }
        if (p.state === 'dive') { p.st += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.rig.setPose('run', p.t * 1.6, 1); if (p.st > 0.7) { p.state = 'flee'; p.st = 0; } }
        else {
          const run = p.state === 'flee'; if (run) { p.st += dt; if (p.st > 3) p.state = 'walk'; }
          const target = p.loop[p.seg], dx = target[0] - p.x, dz = target[1] - p.z, d = Math.hypot(dx, dz);
          if (d < 0.6) p.seg = (p.seg + p.dir + 4) % 4;
          const sp = run ? 4.5 : p.sp; p.x += dx / (d || 1) * sp * dt; p.z += dz / (d || 1) * sp * dt;
          p.h = p.h + HX.wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 8);
          p.rig.setPose(run ? 'run' : 'walk', p.t * (run ? 1.3 : 0.9), run ? 1 : 0.7);
        }
      }
      const r = HX.resolveCircle(p.x, p.z, 0.3, true); p.x = r.x; p.z = r.z;
      const g = p.rig.group, far = Math.hypot(p.x - px, p.z - pz) > 110; g.visible = !far;
      g.position.set(p.x, HX.groundY(p.x, p.z), p.z); g.rotation.y = p.state === 'dive' || p.state === 'down' ? Math.atan2(p.vx, p.vz) : p.h;
    }
  },

  /* ---------- police helicopter ---------- */
  makeHeli() {
    const T = this.T, g = new T.Group();
    const body = new T.MeshStandardMaterial({ color: 0x1a1d26, metalness: 0.5, roughness: 0.45, envMap: Heist.env });
    const white = new T.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 0.3, roughness: 0.5, envMap: Heist.env });
    const cab = new T.Mesh(new T.SphereGeometry(1.4, 16, 12), body); cab.scale.set(1, 0.85, 1.6); g.add(cab);
    const glass = new T.Mesh(new T.SphereGeometry(1.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), new T.MeshStandardMaterial({ color: 0x223348, metalness: 0.9, roughness: 0.1, envMap: Heist.env })); glass.position.set(0, 0.2, 1.1); glass.rotation.x = 0.6; g.add(glass);
    const stripe = new T.Mesh(new T.BoxGeometry(2.85, 0.35, 3.2), white); stripe.position.y = -0.2; g.add(stripe);
    const tail = new T.Mesh(new T.CylinderGeometry(0.18, 0.32, 5.2, 8), body); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.3, -4.2); g.add(tail);
    const fin = new T.Mesh(new T.BoxGeometry(0.12, 1.3, 0.8), body); fin.position.set(0, 0.9, -6.6); g.add(fin);
    for (const s of [-1, 1]) { const skid = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 3.2), body); skid.position.set(s * 0.9, -1.35, 0); g.add(skid); }
    const rotor = new T.Mesh(new T.BoxGeometry(11, 0.05, 0.32), new T.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.75 })); rotor.position.y = 1.35; g.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; g.add(rotor2);
    const trot = new T.Mesh(new T.BoxGeometry(0.05, 1.6, 0.18), rotor.material); trot.position.set(0.15, 0.9, -6.6); g.add(trot);
    // blinking nav lights + searchlight cone
    const red = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); red.position.set(-1.4, 0, 0); g.add(red);
    const grn = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: 0x20ff60, toneMapped: false })); grn.position.set(1.4, 0, 0); g.add(grn);
    const coneM = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
      uniforms: { uK: { value: 1 } },
      vertexShader: 'varying float vY; varying float vD; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uK; varying float vY; varying float vD; void main(){ float a = 0.16 * pow(1.0 + vY * 0.92, 1.6) * smoothstep(3.0, 16.0, vD) * uK; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, 1.0); }',
    });
    const cone = new T.Mesh(new T.ConeGeometry(3.2, 1, 24, 1, true), coneM); cone.geometry.translate(0, -0.5, 0); g.add(cone); // scaled to reach the ground each frame (in world space)
    const poolM = new T.MeshBasicMaterial({ map: HWorld.tex.glow, color: 0xe8f0ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pool = new T.Mesh(new T.PlaneGeometry(11, 11), poolM); pool.rotation.x = -Math.PI / 2; this.scene.add(pool);
    pool.layers.enable(1);
    this.scene.add(g); Heist.linearize(g);
    this.heli = { g, rotor, rotor2, trot, red, grn, cone, pool, x: 0, z: 0, y: 42, h: 0, aimX: 0, aimZ: 0, t: 0, leave: false };
    return this.heli;
  },
  updateHeli(dt, ctx, want) {
    let H = this.heli;
    if (want && !H) { H = this.makeHeli(); H.x = ctx.px - 160; H.z = ctx.pz - 120; H.aimX = ctx.px; H.aimZ = ctx.pz; }
    if (!H) return;
    H.t += dt; H.leave = !want;
    const tx = H.leave ? ctx.px + 900 : ctx.px + Math.sin(H.t * 0.25) * 40, tz = H.leave ? ctx.pz - 900 : ctx.pz + Math.cos(H.t * 0.25) * 40;
    const dx = tx - H.x, dz = tz - H.z, d = Math.hypot(dx, dz), sp = Math.min(55, d * 0.6);
    H.x += dx / (d || 1) * sp * dt; H.z += dz / (d || 1) * sp * dt;
    H.h = H.h + HX.wrapAngle(Math.atan2(dx, dz) - H.h) * Math.min(1, dt * 1.5);
    // fly over the towers, not through them: climb fast, come down slowly
    let roof = 0;
    for (const l of HWorld.lots) if (!l.park && H.x > l.x0 - 45 && H.x < l.x1 + 45 && H.z > l.z0 - 45 && H.z < l.z1 + 45) roof = Math.max(roof, l.h || 0);
    const wantY = Math.max(42, roof + 15); H.y = HX.damp(H.y, wantY, wantY > H.y ? 3 : 0.5, dt);
    H.g.position.set(H.x, H.y + Math.sin(H.t * 1.3) * 0.6, H.z); H.g.rotation.set(Math.min(0.25, sp * 0.006), H.h, Math.sin(H.t * 0.7) * 0.05, 'YXZ');
    H.rotor.rotation.y += dt * 38; H.rotor2.rotation.y += dt * 38; H.trot.rotation.x += dt * 50;
    const blink = Math.floor(H.t * 2) % 2; H.red.visible = !!blink; H.grn.visible = !blink;
    // searchlight sweeps toward the player with a little lag
    H.aimX = HX.damp(H.aimX, ctx.px + Math.sin(H.t * 1.7) * 3, 1.6, dt); H.aimZ = HX.damp(H.aimZ, ctx.pz + Math.cos(H.t * 1.3) * 3, 1.6, dt);
    const hx = H.x, hy = H.g.position.y - 1.2, hz = H.z, ax = H.aimX - hx, ay = 0.1 - hy, az = H.aimZ - hz, L = Math.hypot(ax, ay, az);
    // the cone lives in the helicopter group: express the beam direction in local space
    H.cone.visible = !H.leave && Heist.tod < 1.5;
    const T = this.T, dirW = new T.Vector3(ax / L, ay / L, az / L), inv = new T.Quaternion().copy(H.g.quaternion).invert();
    const dirL = dirW.applyQuaternion(inv); H.cone.position.set(0, -1.2, 0);
    H.cone.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dirL); H.cone.scale.set(1, L, 1);
    H.pool.visible = H.cone.visible; H.pool.position.set(H.aimX, 0.12, H.aimZ);
    if (H.leave && d < 60) this.dropHeli();
  },

  update(dt, ctx) {
    this.updateRain(dt, Heist.camera, Heist.state === 'vault' ? 0 : HX.clamp(1 - Heist.tod * 2.2, 0, 1));
    if (Heist.state !== 'play' && Heist.state !== 'fail') return;
    this.updatePeds(dt, ctx);
    this.updateHeli(dt, ctx, HAI.wanted >= 3);
  },
};
