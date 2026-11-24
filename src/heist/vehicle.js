/* Heist chapter: vehicles (arcade physics with drift), particles (smoke / sparks) and skid marks. */
const HFX3 = {
  T: null, smoke: null, sparks: null,
  init(T, scene) {
    this.T = T;
    this.smoke = this.makeSystem(T, scene, 700, false);
    this.sparks = this.makeSystem(T, scene, 500, true);
    this.skids = HSkids.init(T, scene);
  },
  makeSystem(T, scene, N, additive) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('rgba', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('size', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
    const mat = new T.ShaderMaterial({
      uniforms: { uMap: { value: HWorld.tex.glow }, uScale: { value: 400 } },
      vertexShader: `attribute vec4 rgba; attribute float size; varying vec4 vC; uniform float uScale;
        void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec4 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.004) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return { pts, geo, pos, col, size, N, p: [], add: additive };
  },
  emit(sys, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a) {
    if (sys.p.length >= sys.N) sys.p.shift();
    sys.p.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, r, g, b, a });
  },
  puff(x, y, z, vx, vz, k) { // tyre smoke
    const c = 0.75 + Math.random() * 0.15;
    this.emit(this.smoke, x, y, z, vx * 0.3 + (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), vz * 0.3 + (Math.random() - 0.5) * 1.5, 1.4 + Math.random(), 0.8, 4.2 * k, c * 0.62, c * 0.62, c * 0.66, 0.2 * k);
  },
  darkSmoke(x, y, z) { this.emit(this.smoke, x, y, z, (Math.random() - 0.5), 2 + Math.random(), (Math.random() - 0.5), 2, 0.8, 4, 0.12, 0.11, 0.12, 0.55); },
  sparkBurst(x, y, z, nx, nz, n) {
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, s = 4 + Math.random() * 9; this.emit(this.sparks, x, y, z, nx * s * 0.6 + Math.cos(a) * s * 0.5, 2 + Math.random() * 5, nz * s * 0.6 + Math.sin(a) * s * 0.5, 0.25 + Math.random() * 0.35, 0.25, 0.08, 1, 0.75, 0.35, 1); }
  },
  glowBurst(x, y, z, r, g, b, n, spd) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, e = Math.random() * 1.2; this.emit(this.sparks, x, y, z, Math.cos(a) * spd, Math.sin(e) * spd, Math.sin(a) * spd, 0.6 + Math.random() * 0.5, 0.6, 0.1, r, g, b, 1); } },
  update(dt, camera, pxScale) {
    for (const sys of [this.smoke, this.sparks]) {
      if (!sys) continue;
      sys.pts.material.uniforms.uScale.value = pxScale;
      let n = 0; const P = sys.p;
      for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; p.t += dt; if (p.t >= p.life) { P.splice(k, 1); continue; } }
      for (const p of P) {
        const f = p.t / p.life;
        if (sys.add) { p.vy -= 14 * dt; } else { p.vx *= 1 - dt * 0.8; p.vz *= 1 - dt * 0.8; p.vy *= 1 - dt * 0.5; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
        sys.pos[n * 3] = p.x; sys.pos[n * 3 + 1] = p.y; sys.pos[n * 3 + 2] = p.z;
        sys.col[n * 4] = p.r; sys.col[n * 4 + 1] = p.g; sys.col[n * 4 + 2] = p.b; sys.col[n * 4 + 3] = p.a * (sys.add ? 1 - f : Math.sin(Math.min(1, f * 3) * 1.57) * (1 - f));
        sys.size[n] = p.s0 + (p.s1 - p.s0) * f; n++;
      }
      sys.geo.setDrawRange(0, n);
      sys.geo.attributes.position.needsUpdate = true; sys.geo.attributes.rgba.needsUpdate = true; sys.geo.attributes.size.needsUpdate = true;
    }
    if (this.skids) this.skids.update();
  },
  clear() { for (const s of [this.smoke, this.sparks]) if (s) { s.p.length = 0; s.geo.setDrawRange(0, 0); } if (this.skids) this.skids.clear(); },
};

/* tyre marks: a ring buffer of dark quads laid on the road */
const HSkids = {
  N: 1600, k: 0,
  init(T, scene) {
    this.T = T; const N = this.N;
    this.pos = new Float32Array(N * 4 * 3); this.al = new Float32Array(N * 4);
    const idx = []; for (let q = 0; q < N; q++) { const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const geo = this.geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('alpha', new T.BufferAttribute(this.al, 1).setUsage(T.DynamicDrawUsage));
    geo.setIndex(idx);
    const mat = new T.ShaderMaterial({
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.03, 0.03, 0.035, vA); }',
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new T.Mesh(geo, mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.dirty = false; return this;
  },
  // segment from (x0,z0) to (x1,z1), width w
  add(x0, z0, x1, z1, w, a) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05 || L > 4) return;
    const nx = -dz / L * w / 2, nz = dx / L * w / 2, q = this.k++ % this.N, b = q * 12, y = 0.045;
    const P = this.pos;
    P[b] = x0 - nx; P[b + 1] = y; P[b + 2] = z0 - nz; P[b + 3] = x0 + nx; P[b + 4] = y; P[b + 5] = z0 + nz;
    P[b + 6] = x1 + nx; P[b + 7] = y; P[b + 8] = z1 + nz; P[b + 9] = x1 - nx; P[b + 10] = y; P[b + 11] = z1 - nz;
    for (let v = 0; v < 4; v++) this.al[q * 4 + v] = a;
    this.dirty = true;
  },
  update() { if (!this.dirty) return; this.dirty = false; this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true; },
  clear() { this.al.fill(0); this.dirty = true; },
};

/* ---------------- vehicles ---------------- */
const HVehicle = {
  SPECS: {
    sports: { max: 60, accel: 15, brake: 30, rev: 13, grip: 8.5, drift: 1.4, steer: 0.62, mass: 1.2, hp: 100 },
    police: { max: 54, accel: 13, brake: 28, rev: 12, grip: 8.0, drift: 1.6, steer: 0.58, mass: 1.6, hp: 120 },
    sedan: { max: 42, accel: 9, brake: 22, rev: 9, grip: 7.0, drift: 1.8, steer: 0.6, mass: 1.3, hp: 80 },
    taxi: { max: 42, accel: 9, brake: 22, rev: 9, grip: 7.0, drift: 1.8, steer: 0.6, mass: 1.3, hp: 80 },
    coupe: { max: 46, accel: 10, brake: 24, rev: 9, grip: 7.4, drift: 1.6, steer: 0.62, mass: 1.15, hp: 75 },
    van: { max: 36, accel: 7, brake: 18, rev: 8, grip: 6.0, drift: 2.0, steer: 0.55, mass: 2.1, hp: 110 },
  },
  // build a rig: HModels if present, else a simple fallback so the chapter still runs
  rig(kind, opts) {
    if (window.HModels && HModels.car) { try { const r = HModels.car(kind, opts || {}); if (r) { r.fromModels = true; return r; } } catch (e) { console.error(e); } }
    return this.fallbackRig(kind, opts);
  },
  fallbackRig(kind, opts) {
    const T = HWorld.T, g = new T.Group(), body = new T.Group(); g.add(body);
    const col = kind === 'sports' ? 0xc8102e : kind === 'police' ? 0x111111 : kind === 'taxi' ? 0xf2c014 : (opts && opts.color) || 0x6aa7c8;
    const paint = new T.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.3 });
    const len = kind === 'van' ? 4.8 : 4.5, wid = 1.95, h = kind === 'sports' ? 1.1 : 1.45;
    const lower = new T.Mesh(new T.BoxGeometry(wid, h * 0.55, len), paint); lower.position.y = 0.3 + h * 0.27; body.add(lower);
    const cab = new T.Mesh(new T.BoxGeometry(wid * 0.85, h * 0.45, len * 0.45), new T.MeshStandardMaterial({ color: 0x111622, metalness: 0.8, roughness: 0.15 })); cab.position.set(0, 0.3 + h * 0.75, -0.2); body.add(cab);
    const wheels = []; const wg = new T.CylinderGeometry(0.34, 0.34, 0.26, 12); wg.rotateZ(Math.PI / 2);
    const wm = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    for (const [x, z] of [[0.86, 1.4], [-0.86, 1.4], [0.86, -1.35], [-0.86, -1.35]]) { const pivot = new T.Group(), spin = new T.Mesh(wg, wm); pivot.position.set(x, 0.34, z); pivot.add(spin); g.add(pivot); wheels.push({ pivot, spin }); }
    const head = new T.MeshBasicMaterial({ color: 0x333333 }), tail = new T.MeshBasicMaterial({ color: 0x440000 });
    for (const s of [-1, 1]) { const hl = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.05), head); hl.position.set(s * 0.6, 0.55, len / 2); body.add(hl); const tl = new T.Mesh(new T.BoxGeometry(0.5, 0.12, 0.05), tail); tl.position.set(s * 0.6, 0.6, -len / 2); body.add(tl); }
    let lightsOn = false;
    return {
      group: g, body, wheels, paint, dims: { length: len, width: wid, height: h, wheelBase: 2.75, track: 1.72, wheelRadius: 0.34 }, door: { x: 1.4, z: 0.3 },
      setLights(on) { lightsOn = on; head.color.set(on ? 0xfff2cc : 0x333333); tail.color.set(on ? 0xff2020 : 0x440000); },
      setBrake(on) { tail.color.set(on ? 0xff5050 : lightsOn ? 0xff2020 : 0x440000); }, setReverse() {},
      setSiren(t) { if (kind !== 'police') return; cab.material.emissive = cab.material.emissive || new T.Color(); cab.material.emissive.set(t < 0 ? 0 : (Math.floor(t * 6) % 2 ? 0xff0000 : 0x0040ff)); },
      setDamage() {},
    };
  },
  make(kind, x, z, h, opts) {
    const S = this.SPECS[kind] || this.SPECS.sedan, rig = this.rig(kind, opts);
    const v = {
      kind, spec: S, rig, x, z, y: 0, h: h || 0, vx: 0, vz: 0, w: 0, vF: 0, vR: 0, steerVis: 0,
      hp: S.hp, damage: 0, wrecked: false, burnT: 0, slip: 0, pitch: 0, roll: 0, lastAx: 0, lastAy: 0,
      wheelSpin: 0, ai: null, driver: null, lights: false, sirenOn: false, sirenT: 0, impactT: 0,
      inp: { throttle: 0, steer: 0, handbrake: false }, skidPrev: [null, null], id: HVehicle._id = (HVehicle._id || 0) + 1,
      radius: Math.max(1.0, (rig.dims.width || 1.9) * 0.5),
      half: (rig.dims.length || 4.5) * 0.5,
    };
    HWorld.scene.add(rig.group);
    if (!rig.fromModels && window.Heist && Heist.linearize) Heist.linearize(rig.group);
    this.sync(v, 0);
    return v;
  },
  remove(v) { if (v.rig && v.rig.group.parent) v.rig.group.parent.remove(v.rig.group); if (v.rig && v.rig.dispose && !v._disposed) { v._disposed = true; v.rig.dispose(); } },
  speed(v) { return Math.hypot(v.vx, v.vz); },
  fwd(v) { return { x: Math.sin(v.h), z: Math.cos(v.h) }; },
  // world positions of the collision circles along the body
  circles(v) { const fx = Math.sin(v.h), fz = Math.cos(v.h), o = v.half - v.radius * 0.8; return [[v.x + fx * o, v.z + fz * o], [v.x, v.z], [v.x - fx * o, v.z - fz * o]]; },

  step(v, dt, events) {
    const S = v.spec, inp = v.inp;
    let fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
    let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
    const wreck = v.wrecked ? 0.15 : 1, thr = HX.clamp(inp.throttle, -1, 1) * wreck;
    // engine / brakes
    if (thr > 0) { if (vF < -0.5) vF = Math.min(0, vF + S.brake * thr * dt); else { const k = HX.clamp(vF / S.max, 0, 1); vF += S.accel * thr * (1 - k * k) * dt; } }
    else if (thr < 0) { if (vF > 0.5) vF = Math.max(0, vF + S.brake * thr * dt); else { const k = HX.clamp(-vF / S.rev, 0, 1); vF += S.accel * 0.7 * thr * (1 - k) * dt; } }
    vF -= vF * (0.08 + (thr === 0 ? 0.32 : 0)) * dt;                // drag + engine braking
    if (Math.abs(vF) < 0.08 && thr === 0) vF = 0;
    if (inp.handbrake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 6 * dt);
    // steering -> yaw rate (bicycle model, less lock at speed)
    const sAng = HX.clamp(inp.steer, -1, 1) * S.steer / (1 + Math.abs(vF) * 0.028);
    let yawT = vF * Math.tan(sAng) / ((v.rig.dims.wheelBase) || 2.6);
    // tyres can't give infinite grip: cap the yaw rate by lateral acceleration (~3 g, arcade-generous)
    const latMax = 30 * (inp.handbrake ? 1.7 : 1), yawCap = latMax / Math.max(6, Math.abs(vF));
    yawT = HX.clamp(yawT, -yawCap, yawCap);
    if (inp.handbrake && Math.abs(vF) > 4) yawT *= 1.35;
    if (Math.abs(vR) > 3) yawT *= 1.08;                              // counter-steer friendly while sliding
    v.w = HX.damp(v.w, yawT, 9, dt);
    // tyre grip: kill lateral speed (less with the handbrake / when already sliding)
    const sliding = Math.abs(vR) > 5.5;
    const grip = inp.handbrake ? S.drift : sliding ? S.grip * 0.42 : S.grip;
    const vR0 = vR; vR *= Math.exp(-grip * dt);
    v.slip = Math.abs(vR0);
    // recompose in the OLD frame, then turn: the body rotates under the velocity -> real drifts
    v.vx = fx * vF + rx * vR; v.vz = fz * vF + rz * vR;
    v.h = HX.wrapAngle(v.h - v.w * dt);
    v.vF = vF; v.vR = vR; v.steerVis = HX.damp(v.steerVis, sAng, 14, dt);
    // integrate
    v.x += v.vx * dt; v.z += v.vz * dt;
    // world collisions
    this.collideWorld(v, events);
    // visual body motion (pitch from acceleration, roll from lateral accel)
    const ax = (vF - (v._pvF || 0)) / Math.max(dt, 1e-3), ay = v.w * vF; v._pvF = vF;
    v.pitch = HX.damp(v.pitch, HX.clamp(-ax * 0.004, -0.05, 0.05), 6, dt);
    v.roll = HX.damp(v.roll, HX.clamp(ay * 0.0045, -0.07, 0.07), 6, dt);
    v.wheelSpin += vF / ((v.rig.dims.wheelRadius) || 0.34) * dt;
    if (v.impactT > 0) v.impactT -= dt;
  },
  collideWorld(v, events) {
    const cs = this.circles(v); let best = null;
    for (let k = 0; k < cs.length; k++) {
      const [cx, cz] = cs[k], r = HX.resolveCircle(cx, cz, v.radius);
      if (!r.hit) continue;
      if (r.what && (r.what.kind === 'palm' || r.what.kind === 'pole') && Math.hypot(v.vx, v.vz) > 9) {
        // fast enough: knock it over instead of stopping dead
        if (r.what.kind === 'palm') HWorld.knockPalm(r.what, v.vx, v.vz); else HWorld.knockPole(r.what);
        v.vx *= 0.82; v.vz *= 0.82;
        if (events) events.push({ type: 'knock', v, x: r.what.x, z: r.what.z, what: r.what.kind });
        continue;
      }
      v.x += r.x - cx; v.z += r.z - cz;
      if (!best || r.depth > best.depth) best = { ...r, k, cx, cz };
    }
    if (!best) return;
    const n = { x: best.nx, z: best.nz }, vn = v.vx * n.x + v.vz * n.z;
    if (vn < 0) {
      const e = 0.25;
      v.vx -= (1 + e) * vn * n.x; v.vz -= (1 + e) * vn * n.z;
      // scrape friction along the wall
      const tx = -n.z, tz = n.x, vt = v.vx * tx + v.vz * tz;
      v.vx -= tx * vt * 0.12; v.vz -= tz * vt * 0.12;
      // spin from an off-centre hit
      const off = best.k === 0 ? 1 : best.k === 2 ? -1 : 0, fx = Math.sin(v.h), fz = Math.cos(v.h);
      v.w += off * (fx * n.z - fz * n.x) * -vn * 0.06;
      const impact = -vn;
      if (impact > 3 && events) events.push({ type: 'crash', v, impact, x: best.cx - n.x * v.radius, z: best.cz - n.z * v.radius, nx: n.x, nz: n.z });
      if (impact > 6) this.hurt(v, (impact - 5) * 1.6);
    }
  },
  // circle-vs-circle between two cars (called by the traffic/police manager for nearby pairs)
  collidePair(a, b, events) {
    const ca = this.circles(a), cb = this.circles(b); let hit = null;
    for (const [ax, az] of ca) for (const [bx, bz] of cb) {
      const dx = ax - bx, dz = az - bz, rr = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), pen = rr - d; if (!hit || pen > hit.pen) hit = { nx: dx / d, nz: dz / d, pen, x: (ax + bx) / 2, z: (az + bz) / 2 }; }
    }
    if (!hit) return false;
    const ma = a.spec.mass, mb = b.spec.mass, tot = ma + mb;
    a.x += hit.nx * hit.pen * (mb / tot); a.z += hit.nz * hit.pen * (mb / tot);
    b.x -= hit.nx * hit.pen * (ma / tot); b.z -= hit.nz * hit.pen * (ma / tot);
    const rvx = a.vx - b.vx, rvz = a.vz - b.vz, vn = rvx * hit.nx + rvz * hit.nz;
    if (vn < 0) {
      const j = -(1.3) * vn / (1 / ma + 1 / mb);
      a.vx += j * hit.nx / ma; a.vz += j * hit.nz / ma; b.vx -= j * hit.nx / mb; b.vz -= j * hit.nz / mb;
      a.w += (Math.random() - 0.5) * -vn * 0.05; b.w += (Math.random() - 0.5) * -vn * 0.05;
      const impact = -vn;
      if (impact > 2.5 && events) events.push({ type: 'carhit', a, b, impact, x: hit.x, z: hit.z, nx: hit.nx, nz: hit.nz });
      if (impact > 7) { this.hurt(a, (impact - 6) * 1.1 * mb / tot * 2); this.hurt(b, (impact - 6) * 1.1 * ma / tot * 2); }
    }
    return true;
  },
  hurt(v, d) {
    if (v.wrecked) return;
    v.hp -= d; v.damage = HX.clamp(1 - v.hp / v.spec.hp, 0, 1);
    if (v.rig.setDamage) v.rig.setDamage(v.damage);
    if (v.hp <= 0) { v.hp = 0; v.wrecked = true; v.burnT = 0; }
  },
  repair(v) { v.hp = v.spec.hp; v.damage = 0; v.wrecked = false; if (v.rig.setDamage) v.rig.setDamage(0); },

  // push transforms to the rig + effects
  sync(v, dt, t) {
    const r = v.rig, g = r.group;
    g.position.set(v.x, v.y + (HX.deckY(v.x, v.z) ? 0.05 : 0), v.z); g.rotation.y = v.h; // on the deck: tyres sit like on city roads (~2 cm into the surface)
    if (r.body) { r.body.rotation.x = v.pitch; r.body.rotation.z = v.roll; }
    if (r.wheels) r.wheels.forEach((wh, k) => { if (k < 2 && wh.pivot) wh.pivot.rotation.y = -v.steerVis * 1.25; if (wh.spin) wh.spin.rotation.x = v.wheelSpin; });
    if (dt > 0) {
      const braking = (v.inp.throttle < -0.1 && v.vF > 0.5) || v.inp.handbrake;
      if (r.setBrake) r.setBrake(braking);
      if (r.setReverse) r.setReverse(v.vF < -0.5 && v.inp.throttle < 0);
      if (v.sirenOn && r.setSiren) { v.sirenT += dt; r.setSiren(v.sirenT); } else if (r.setSiren && v._sirenWas) r.setSiren(-1);
      v._sirenWas = v.sirenOn;
      // smoke + skid marks when sliding / burning out
      const burn = v.inp.throttle > 0.8 && Math.abs(v.vF) < 8 && v.spec.accel > 12 && v === (HVehicle.player || null);
      const k = HX.clamp((v.slip - 3.5) / 8, 0, 1) + (burn ? 0.6 : 0) + (v.inp.handbrake && Math.abs(v.vF) > 6 ? 0.5 : 0);
      const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h), back = (v.rig.dims.wheelBase || 2.6) * 0.5, tr = (v.rig.dims.track || 1.7) * 0.5;
      for (let s = 0; s < 2; s++) {
        const sx = v.x - fx * back + rx * tr * (s ? 1 : -1), sz = v.z - fz * back + rz * tr * (s ? 1 : -1);
        if (k > 0.12) {
          if (Math.random() < k * dt * 30) HFX3.puff(sx, 0.3, sz, v.vx, v.vz, Math.min(1.2, k));
          const p = v.skidPrev[s]; if (p) HSkids.add(p[0], p[1], sx, sz, 0.28, Math.min(0.55, k * 0.6)); v.skidPrev[s] = [sx, sz];
        } else v.skidPrev[s] = null;
      }
      if (v.damage > 0.6 || v.wrecked) if (Math.random() < dt * (v.wrecked ? 18 : 6)) HFX3.darkSmoke(v.x + fx * v.half * 0.7, 1.1, v.z + fz * v.half * 0.7);
      if (v.wrecked && Math.random() < dt * 10) HFX3.glowBurst(v.x + fx * v.half * 0.6, 0.9, v.z + fz * v.half * 0.6, 1, 0.45, 0.1, 1, 2);
    }
  },
};
