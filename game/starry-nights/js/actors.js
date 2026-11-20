'use strict';
/* =====================================================================
   STARRY NIGHTS · actors.js
   the player · keyboard, mouse & touch · the six animatronics and their AI
   ===================================================================== */

const P = {
  x: START.x, z: START.z, yaw: 0, pitch: 0, vx: 0, vz: 0, eye: EYE_H, crouch: false, stam: 1, exhausted: false, sprinting: false,
  step: 0, bobT: 0, battery: 100, flashOn: true, hidden: null, dist: 0, trail: [], trailT: 0, flashYaw: 0, flashPitch: 0, shake: 0
};
const INPUT = { k: {}, joy: { id: null, x: 0, y: 0, ox: 0, oy: 0 }, look: { id: null, lx: 0, ly: 0 }, inter: false, interPressed: false, sprintBtn: false, drag: null };
let NOISES = [];
function emitNoise(x, z, r) { NOISES.push({ x, z, r }); }

function resetPlayer() {
  Object.assign(P, { x: START.x, z: START.z, yaw: START.yaw, pitch: -0.05, vx: 0, vz: 0, eye: EYE_H, crouch: false, stam: 1, exhausted: false, sprinting: false, step: 0, bobT: 0, battery: 100, flashOn: true, hidden: null, dist: 0, trailT: 0, flashYaw: START.yaw, flashPitch: 0, shake: 0 });
  P.trail.length = 0; $('#locker').hidden = true;
}

/* ---------------- input ---------------- */
const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
function initInput() {
  window.addEventListener('keydown', e => {
    if (typing(e)) return; const c = e.code;
    if ((G.mode === 'play' || G.mode === 'cctv') && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) e.preventDefault();
    if (!INPUT.k[c]) onKeyPress(c);
    INPUT.k[c] = true;
  });
  window.addEventListener('keyup', e => { INPUT.k[e.code] = false; if (e.code === 'KeyE') INPUT.inter = false; });
  window.addEventListener('blur', () => { INPUT.k = {}; INPUT.inter = false; INPUT.sprintBtn = false; });
  const gl = $('#gl');
  gl.addEventListener('click', () => { if (G.mode === 'play' && !IS_TOUCH && !document.pointerLockElement) lockPointer(); });
  document.addEventListener('pointerlockchange', () => {
    G.locked = document.pointerLockElement === gl;
    const quiet = G.suppressPause; G.suppressPause = false;
    if (!G.locked && G.mode === 'play' && !IS_TOUCH && !quiet) pauseGame();
  });
  document.addEventListener('mousemove', e => {
    if (G.locked) { look(e.movementX * 0.0022 * SETTINGS.sens, e.movementY * 0.0022 * SETTINGS.sens); return; }
    if (INPUT.drag && G.mode === 'play') { look((e.clientX - INPUT.drag.x) * 0.004 * SETTINGS.sens, (e.clientY - INPUT.drag.y) * 0.004 * SETTINGS.sens); INPUT.drag = { x: e.clientX, y: e.clientY }; }
  });
  gl.addEventListener('mousedown', e => { if (!G.locked && G.mode === 'play' && !IS_TOUCH) INPUT.drag = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('mousedown', e => { if (G.locked && e.button === 0) { INPUT.inter = true; INPUT.interPressed = true; } });
  document.addEventListener('mouseup', e => { INPUT.drag = null; if (e.button === 0) INPUT.inter = false; });
  initTouch();
}
function lockPointer() { const gl = $('#gl'); try { const r = gl.requestPointerLock && gl.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function releasePointer() { if (document.pointerLockElement) { G.suppressPause = true; try { document.exitPointerLock(); } catch (e) { } } }
function look(dx, dy) {
  if (G.mode !== 'play') return;
  P.yaw -= dx; P.pitch = clamp(P.pitch - dy, -1.35, 1.35);
  if (P.hidden) { P.yaw = P.hidden.yaw + clamp(angDiff(P.yaw, P.hidden.yaw), -0.6, 0.6); P.pitch = clamp(P.pitch, -0.35, 0.3); }
}
function onKeyPress(c) {
  if (G.mode === 'cctv') {
    if (c === 'ArrowLeft' || c === 'KeyA') cycleCam(-1); else if (c === 'ArrowRight' || c === 'KeyD') cycleCam(1);
    else if (c === 'Escape' || c === 'KeyS' || c === 'Digit3' || c === 'KeyE') closeCCTV();
    return;
  }
  if (G.mode === 'map') { if (c === 'KeyM' || c === 'Tab' || c === 'Escape') toggleMap(); return; }
  if (G.mode === 'note') { if (c === 'KeyE' || c === 'Escape' || c === 'Space' || c === 'Enter') closeModal(); return; }
  if (G.mode === 'keypad') { if (/^Digit\d$/.test(c)) keypadPress(c.slice(5)); else if (c === 'Backspace') keypadPress('C'); else if (c === 'Enter') keypadPress('OK'); else if (c === 'Escape') closeModal(); return; }
  if (G.mode === 'pause') { if (c === 'Escape') resumeGame(); return; }
  if (G.mode !== 'play') return;
  if (c === 'KeyE') { INPUT.inter = true; INPUT.interPressed = true; }
  else if (c === 'KeyF') toggleFlash();
  else if (c === 'KeyC' || c === 'ControlLeft') toggleCrouch();
  else if (c === 'KeyM' || c === 'Tab') toggleMap();
  else if (c === 'KeyQ' || c === 'KeyJ') toggleTasks();
  else if (c === 'Escape' && IS_TOUCH) pauseGame();
  else if (G.inOffice) {
    if (c === 'Digit1') toggleDoor('w'); else if (c === 'Digit2') toggleDoorLight('w'); else if (c === 'Digit3') openCCTV();
    else if (c === 'Digit4') toggleDoorLight('e'); else if (c === 'Digit5') toggleDoor('e');
  }
}
function toggleFlash() { if (P.hidden) return; P.flashOn = !P.flashOn; AU.beep(P.flashOn ? 1400 : 900, 0.05); }
function toggleCrouch() { if (P.hidden) return; P.crouch = !P.crouch; document.body.classList.toggle('crouched', P.crouch); }

function initTouch() {
  const tz = $('#touchzone');
  tz.addEventListener('touchstart', onTS, { passive: false }); tz.addEventListener('touchmove', onTM, { passive: false });
  tz.addEventListener('touchend', onTE); tz.addEventListener('touchcancel', onTE);
  window.addEventListener('touchstart', () => { if (!IS_TOUCH) { IS_TOUCH = true; document.body.classList.add('touch'); } }, { passive: true, capture: true });
  const hold = (el, down, up) => {
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(); }, { passive: false });
    const end = e => { e.preventDefault(); el.classList.remove('on'); up && up(); };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', e => { e.preventDefault(); down(); }); el.addEventListener('mouseup', () => up && up());
  };
  hold($('#tb-act'), () => { INPUT.inter = true; INPUT.interPressed = true; }, () => { INPUT.inter = false; });
  hold($('#tb-run'), () => { INPUT.sprintBtn = true; }, () => { INPUT.sprintBtn = false; });
  hold($('#tb-flash'), toggleFlash); hold($('#tb-crouch'), toggleCrouch); hold($('#tb-map'), toggleMap); hold($('#tb-tasks'), toggleTasks);
}
function onTS(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const left = t.clientX < window.innerWidth * 0.45;
    if (left && INPUT.joy.id === null) { const j = INPUT.joy; j.id = t.identifier; j.ox = t.clientX; j.oy = t.clientY; j.x = j.y = 0; const b = $('#joy'); b.style.left = t.clientX + 'px'; b.style.top = t.clientY + 'px'; b.hidden = false; $('#knob').style.transform = 'translate(-50%,-50%)'; }
    else if (!left && INPUT.look.id === null) { INPUT.look.id = t.identifier; INPUT.look.lx = t.clientX; INPUT.look.ly = t.clientY; }
  }
}
function onTM(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === INPUT.joy.id) { const R = 56; let dx = t.clientX - INPUT.joy.ox, dy = t.clientY - INPUT.joy.oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } INPUT.joy.x = dx / R; INPUT.joy.y = dy / R; $('#knob').style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; }
    else if (t.identifier === INPUT.look.id) { const s = 0.0055 * SETTINGS.touchSens; look((t.clientX - INPUT.look.lx) * s, (t.clientY - INPUT.look.ly) * s * 0.8); INPUT.look.lx = t.clientX; INPUT.look.ly = t.clientY; }
  }
}
function onTE(e) { for (const t of e.changedTouches) { if (t.identifier === INPUT.joy.id) { INPUT.joy.id = null; INPUT.joy.x = INPUT.joy.y = 0; $('#joy').hidden = true; } if (t.identifier === INPUT.look.id) INPUT.look.id = null; } }
function clearTouchState() { INPUT.joy.id = null; INPUT.joy.x = INPUT.joy.y = 0; INPUT.look.id = null; INPUT.sprintBtn = false; INPUT.inter = false; const j = $('#joy'); if (j) j.hidden = true; }

/* ---------------- player update ---------------- */
function moveCircle(o, dx, dz, r) {
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2) || 1;
  for (let i = 0; i < n; i++) { const sx = dx / n, sz = dz / n; if (!hitsSolid(o.x + sx, o.z, r)) o.x += sx; else o.vx *= 0.4; if (!hitsSolid(o.x, o.z + sz, r)) o.z += sz; else o.vz *= 0.4; }
}
function updatePlayer(dt) {
  if (P.hidden) { P.hidden.t += dt; placeCamera(P.hidden.x, P.hidden.z, EYE_H - 0.06, dt); P.sprinting = false; P.stam = Math.min(1, P.stam + dt * 0.15); return; }
  let mx = 0, mz = 0, jm = 0; const k = INPUT.k;
  if (G.mode === 'play') {
    if (k.KeyW || k.ArrowUp) mz += 1; if (k.KeyS || k.ArrowDown) mz -= 1; if (k.KeyD || k.ArrowRight) mx += 1; if (k.KeyA || k.ArrowLeft) mx -= 1;
    if (INPUT.joy.id !== null) { mx += INPUT.joy.x; mz -= INPUT.joy.y; jm = Math.hypot(INPUT.joy.x, INPUT.joy.y); }
  }
  const mag = Math.hypot(mx, mz); if (mag > 1) { mx /= mag; mz /= mag; }
  const wantSprint = (k.ShiftLeft || k.ShiftRight || INPUT.sprintBtn || jm > 0.95) && mz > 0.3 && !P.crouch && mag > 0.1;
  if (wantSprint && !P.exhausted && P.stam > 0.01) { P.sprinting = true; P.stam = Math.max(0, P.stam - dt * 0.15); if (P.stam <= 0.01) P.exhausted = true; }
  else { P.sprinting = false; P.stam = Math.min(1, P.stam + dt * (mag > 0.1 ? 0.085 : 0.15)); if (P.exhausted && P.stam > 0.35) P.exhausted = false; }
  const spd = P.crouch ? 1.55 : (P.sprinting ? 5.3 : 3.0);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const tx = (-sy * mz + cy * mx) * spd, tz = (-cy * mz - sy * mx) * spd;
  const a = 1 - Math.exp(-dt * 12); P.vx += (tx - P.vx) * a; P.vz += (tz - P.vz) * a;
  moveCircle(P, P.vx * dt, P.vz * dt, 0.32);
  const sp = Math.hypot(P.vx, P.vz);
  if (sp > 0.3) {
    P.bobT += dt * sp * 2.1; const stride = P.sprinting ? 2.3 : P.crouch ? 1.25 : 1.75; P.step += sp * dt;
    if (P.step >= stride) { P.step -= stride; footstep(); }
  }
  P.dist += sp * dt;
  P.eye = lerp(P.eye, P.crouch ? CROUCH_EYE : EYE_H, 1 - Math.exp(-dt * 10));
  P.trailT -= dt;
  if (P.trailT <= 0) {
    P.trailT = 0.35; const last = P.trail[P.trail.length - 1];
    if (!last || Math.hypot(last.x - P.x, last.z - P.z) > 0.8) { P.trail.push({ x: P.x, z: P.z }); if (P.trail.length > 500) { P.trail.shift(); for (const e of ENEMIES) if (e.trailIdx > 0) e.trailIdx--; } }
  }
  const bob = Math.sin(P.bobT * 2) * (P.sprinting ? 0.055 : 0.028) * Math.min(1, sp / 3);
  placeCamera(P.x, P.z, P.eye + bob, dt);
}
function placeCamera(x, z, y, dt) {
  P.shake = Math.max(0, P.shake - dt * 1.5);
  const s = P.shake * 0.12 + G.fear * 0.008;
  camera.position.set(x + rand(-s, s), y + rand(-s, s), z + rand(-s, s));
  camera.rotation.set(P.pitch, P.yaw, 0);
  const fa = 1 - Math.exp(-dt * 13); P.flashYaw = lerpAngle(P.flashYaw, P.yaw, fa); P.flashPitch = lerp(P.flashPitch, P.pitch, fa);
  const dyaw = angDiff(P.flashYaw, P.yaw), dp = P.flashPitch - P.pitch;
  flashTarget.position.set(-Math.sin(dyaw) * 6, Math.sin(dp) * 6, -6);
}
function footstep() {
  const f = (ROOMS[roomAtW(P.x, P.z)] || ROOMS.hall).floor;
  AU.step(f === 'metal' ? 'metal' : f === 'tiles' ? 'tiles' : f === 'carpet' ? 'carpet' : 'concrete', P.sprinting);
  emitNoise(P.x, P.z, P.sprinting ? 15 : P.crouch ? 1.8 : 6.5);
  for (const d of WORLD.milk) if (d.life > 0 && Math.hypot(d.x - P.x, d.z - P.z) < 0.7) { AU.splash(); emitNoise(P.x, P.z, 11); break; }
}
function updateFlashlight(dt) {
  const on = P.flashOn && P.battery > 0 && !P.hidden;
  if (on) P.battery = Math.max(0, P.battery - dt * 0.42);
  let I = on ? 1.35 : 0;
  if (on && P.battery < 15 && Math.random() < 0.08) I *= rand(0, 0.5);
  if (on && G.flickerT > 0) I *= Math.random() < 0.5 ? 0.1 : 1;
  flash.intensity = I;
}
function enterLocker(L) {
  if (P.hidden) return;
  const seenBy = ENEMIES.filter(e => e.active && (e.state === 'chase' || e.beh === 'hunter') && e.dist() < 14 && los(e.x, e.z, P.x, P.z));
  P.hidden = Object.assign({ t: 0 }, L); P.yaw = L.yaw; P.pitch = 0; P.vx = P.vz = 0; P.crouch = false; document.body.classList.remove('crouched');
  AU.creak(); emitNoise(L.x, L.z, 3); $('#locker').hidden = false; P.trail.length = 0; G.stats.hides++;
  for (const e of seenBy) e.sawHide = true;
}
function exitLocker() { const L = P.hidden; if (!L) return; P.x = L.fx; P.z = L.fz; P.hidden = null; AU.creak(); $('#locker').hidden = true; for (const e of ENEMIES) e.sawHide = false; }

/* =====================================================================
   the animatronics
   ===================================================================== */
function buildAnimatronic(c) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = phong({ color: c.skin, shininess: 25 }), pants = phong({ color: c.pants }), shoe = phong({ color: 0x141414 }), hair = phong({ color: c.hair, shininess: 4 });
  const sf = phong({ map: shirtTex(c, 'front') }), sb = phong({ map: shirtTex(c, 'back') }), ss = phong({ color: c.shirtColor });
  const face = phong({ map: maskTexture(c.id), color: 0xc4c4c4, shininess: 18, specular: 0x1c1c1c });
  const legG = new THREE.BoxGeometry(0.21, 0.86, 0.24); legG.translate(0, -0.43, 0);
  const footG = new THREE.BoxGeometry(0.22, 0.1, 0.34); footG.translate(0, -0.83, 0.05);
  const mkLeg = x => { const l = new THREE.Group(); l.position.set(x, 0.92, 0); l.add(new THREE.Mesh(legG, pants)); l.add(new THREE.Mesh(footG, shoe)); body.add(l); return l; };
  const legL = mkLeg(-0.13), legR = mkLeg(0.13);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.32), [ss, ss, ss, ss, sf, sb]); torso.position.y = 1.28; body.add(torso);
  const armG = new THREE.BoxGeometry(0.16, 0.7, 0.18); armG.translate(0, -0.35, 0);
  const handG = new THREE.BoxGeometry(0.14, 0.14, 0.14); handG.translate(0, -0.75, 0);
  const mkArm = x => {
    const a = new THREE.Group(); a.position.set(x, 1.6, 0); a.add(new THREE.Mesh(armG, c.sleeves ? ss : skin)); a.add(new THREE.Mesh(handG, skin));
    if (!c.sleeves) { const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.22, 0.2), ss); cuff.position.y = -0.09; a.add(cuff); }
    body.add(a); return a;
  };
  const armL = mkArm(-0.4), armR = mkArm(0.4);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8), MAT.metal); neck.position.y = 1.7; body.add(neck);
  const head = new THREE.Group(); head.position.y = 1.72; head.scale.setScalar(1.2); body.add(head);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.46), [hair, hair, hair, skin, face, hair]); hm.position.y = 0.26; head.add(hm);
  const eyeMat = new THREE.SpriteMaterial({ map: MAT.glowTex, color: c.eyeColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const eyes = castEyes(c.id).map(([ex, ey]) => { const s = new THREE.Sprite(eyeMat); s.scale.set(0.1, 0.1, 1); s.position.set((ex - 0.5) * 0.5, 0.26 + (0.5 - ey) * 0.5, 0.24); head.add(s); return s; });
  if (c.acc === 'partyhat') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 14), MAT.stripe); h.position.set(0.06, 0.66, 0); h.rotation.z = -0.25; head.add(h); const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), MAT.gold); p.position.set(0.1, 0.85, 0); head.add(p); }
  if (c.acc === 'curls' || c.hairStyle === 'curly') for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.06, 0.085), 7, 5), hair); s.position.set(rand(-0.23, 0.23), rand(0.5, 0.56), rand(-0.22, 0.16)); head.add(s); }
  if (c.acc === 'hood') { const hd = phong({ color: c.shirtColor }); const bk = new THREE.Mesh(boxGeo(0.64, 0.66, 0.08), hd); bk.position.set(0, 0.28, -0.27); head.add(bk); for (const sx of [-0.31, 0.31]) { const sd = new THREE.Mesh(boxGeo(0.08, 0.64, 0.5), hd); sd.position.set(sx, 0.27, -0.02); head.add(sd); } const tp = new THREE.Mesh(boxGeo(0.64, 0.08, 0.52), hd); tp.position.set(0, 0.57, -0.02); head.add(tp); }
  if (c.acc === 'helmet') { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), phong({ color: 0xeeeeee, shininess: 120, specular: 0xffffff })); hl.position.y = 0.42; hl.scale.set(1, 0.9, 1.06); head.add(hl); const vz = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), phong({ color: 0xbfe3ff, transparent: true, opacity: 0.35, shininess: 140, specular: 0xffffff })); vz.position.set(0, 0.5, 0.33); vz.rotation.x = -0.5; head.add(vz); }
  if (c.shirt === 'garin') { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), MAT.metal); w.rotation.z = Math.PI / 2; w.position.set(0.08, 1.42, 0.18); body.add(w); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; g.add(sh);
  let scooter = null;
  if (c.acc === 'helmet') {
    scooter = new THREE.Group(); g.add(scooter);
    const deck = new THREE.Mesh(boxGeo(0.24, 0.06, 0.95), MAT.dark); deck.position.y = 0.13; scooter.add(deck);
    for (const z of [-0.42, 0.42]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), MAT.rubber); w.rotation.z = Math.PI / 2; w.position.set(0, 0.09, z); scooter.add(w); }
    const stem = new THREE.Mesh(boxGeo(0.05, 1.0, 0.05), MAT.metal); stem.position.set(0, 0.62, 0.44); stem.rotation.x = -0.15; scooter.add(stem);
    const bar = new THREE.Mesh(boxGeo(0.56, 0.04, 0.04), MAT.dark); bar.position.set(0, 1.1, 0.37); scooter.add(bar);
    body.position.y = 0.16;
  }
  let ball = null;
  if (c.acc === 'ball') { ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), phong({ map: mkTex(tBall()), shininess: 40 })); scene.add(ball); ball.visible = false; }
  return { g, body, legL, legR, armL, armR, head, eyes, eyeMat, face, scooter, ball };
}

const ENEMIES = [];
const _v3 = window.THREE ? new THREE.Vector3() : null;
const PARTY_SIT = { x: 67.5, z: 25.0 };
const zoneWarehouse = (x, y) => aiWalk(x, y) && (ROOM_AT[idx(x, y)] === 'warehouse' || (y === 6 && x >= 19));
const hallOnly = (x, y) => aiWalk(x, y) && ROOM_AT[idx(x, y)] === 'hall';
const inOfficeArea = (x, z) => x > 42 && x < 54 && z > 54 && z < 60;

class Enemy {
  constructor(c) { this.c = c; this.id = c.id; this.beh = c.behavior; this.m = buildAnimatronic(c); scene.add(this.m.g); this.em = null; this.reset(); }
  reset() {
    Object.assign(this, { active: false, state: 'off', path: null, pi: 0, timer: 0, repath: 0, memory: 0, lastSeen: null, vx: 0, vz: 0, heading: 0, anim: 0, twitchT: rand(1, 3), tw: 0, twz: 0, twy: 0,
      sit: false, sawHide: false, trailIdx: 0, soundT: rand(3, 7), stepT: 0, puddleT: 0, moved: 0, wasVis: false, burst: 3.4, cdx: 0, cdz: 0, doorT: 0, spawnT: 0, x: -99, z: -99, eng: 0, inv: null, frozen: false });
    this.m.g.visible = false; if (this.m.ball) this.m.ball.visible = false; this.m.body.position.y = this.beh === 'charger' ? 0.16 : 0;
  }
  schedule(delay) { this.reset(); this.state = 'waiting'; this.spawnT = delay; }
  appear() {
    let p;
    if (this.beh === 'statue') { const opts = [[tc(5), tc(3)], [tc(8), tc(21)], [tc(17), tc(4)], [tc(27), tc(16)]]; opts.sort((a, b) => Math.hypot(b[0] - P.x, b[1] - P.z) - Math.hypot(a[0] - P.x, a[1] - P.z)); p = opts[0]; }
    else p = { host: [PARTY_SIT.x, PARTY_SIT.z], counselor: [tc(24), tc(21)], brodana: [tc(25), tc(1)], rider: [tc(29), tc(10)], zero: [tc(16), tc(14)] }[this.id];
    this.x = p[0]; this.z = p[1]; this.active = true; this.m.g.visible = true; if (this.m.ball) this.m.ball.visible = true;
    this.state = { listener: 'sit', tracker: 'track', statue: 'stalk', guardian: 'patrol', charger: 'patrol', hunter: 'stalk' }[this.beh];
    this.heading = this.beh === 'listener' ? 0 : Math.atan2(P.x - this.x, P.z - this.z); this.timer = 0;
    if (AU.ctx && !this.em) { this.em = AU.emitter(); if (this.beh === 'charger') this.engine = AU.makeEngine(this.em); }
    if (this.beh === 'hunter') AU.groan(this.em, true);
  }
  dist() { return Math.hypot(P.x - this.x, P.z - this.z); }
  tx() { return toTile(this.x); } ty() { return toTile(this.z); }
  go(x, z, ok = aiWalk, near = false) {
    const p = bfs(this.tx(), this.ty(), toTile(x), toTile(z), ok, near);
    if (!p) { this.path = null; return false; }
    this.path = p.map(i => ({ x: tc(i % MW), z: tc((i / MW) | 0) }));
    if (this.path.length && !near) this.path[this.path.length - 1] = { x, z };
    this.pi = 0; return true;
  }
  follow(dt, spd, ok = aiWalk) {
    if (!this.path || this.pi >= this.path.length) { this.vx = this.vz = 0; return true; }
    let t = this.path[this.pi];
    while (this.pi + 1 < this.path.length && (Math.hypot(t.x - this.x, t.z - this.z) < 0.6 || losWide(this.x, this.z, this.path[this.pi + 1].x, this.path[this.pi + 1].z, ok))) { this.pi++; t = this.path[this.pi]; if (this.pi > 60) break; }
    const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { this.pi++; this.vx = this.vz = 0; return this.pi >= this.path.length; }
    const s = Math.min(d, spd * dt); this.x += dx / d * s; this.z += dz / d * s; this.vx = dx / d * spd; this.vz = dz / d * spd; return false;
  }
  sees(range, fov) {
    if (P.hidden) return false;
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    let R = range * diff().sense; if (P.flashOn && P.battery > 0) R *= 1.3; if (P.crouch) R *= 0.65;
    if (d > R) return false;
    if (d > 1.8 && Math.abs(angDiff(Math.atan2(dx, dz), this.heading)) > fov / 2) return false;
    return los(this.x, this.z, P.x, P.z);
  }
  hears(mult) { const m = mult * diff().sense; for (const n of NOISES) if (Math.hypot(n.x - this.x, n.z - this.z) < n.r * m) return n; return null; }
  catchCheck(r = 0.95) { if (P.hidden || G.mode === 'jump') return false; if (this.dist() < r) { killPlayer(this); return true; } return false; }
  toChase() { if (this.state !== 'chase') { this.state = 'chase'; this.memory = 4; this.repath = 0; onChaseStart(this); } }
  /* shared chase: true while still chasing */
  chase(dt, spd, range, fov, mem, ok = aiWalk) {
    if (this.sees(range * 1.6, fov + 0.8)) { this.memory = mem; this.lastSeen = { x: P.x, z: P.z }; } else this.memory -= dt;
    if (!this.lastSeen) this.lastSeen = { x: P.x, z: P.z };
    if (this.memory <= 0) { this.state = 'search'; this.timer = 3.5; this.go(this.lastSeen.x, this.lastSeen.z, ok, true); return false; }
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.35; const tx = P.hidden ? this.lastSeen.x : P.x, tz = P.hidden ? this.lastSeen.z : P.z;
      if (!this.go(tx, tz, ok)) this.go(tx, tz, ok, true);
    }
    this.follow(dt, spd, ok); this.atDoor(dt); this.catchCheck(); return true;
  }
  search(dt, after) {
    if (this.path && this.pi < this.path.length) this.follow(dt, 2.2 * G.spdMul);
    else { this.vx = this.vz = 0; this.heading += dt * 1.8; this.timer -= dt; if (this.timer <= 0) after(); }
  }
  /* banging on a closed office door */
  atDoor(dt) {
    for (const k of ['w', 'e']) {
      const d = WORLD.doors[k]; if (!d.closed) continue;
      if (Math.hypot(this.x - tc(d.ox), this.z - tc(d.oy)) < 1.6 && inOfficeArea(P.x, P.z)) {
        this.doorT += dt; this.vx = this.vz = 0; this.heading = Math.atan2(tc(d.tx) - this.x, tc(d.ty) - this.z);
        if ((this.doorT % 0.9) < dt) { AU.bang(this.em); P.shake = Math.max(P.shake, 0.25); d.hit = 0.25; }
        if (this.beh === 'hunter' && this.doorT > 4.5) { d.closed = false; d.broken = 25; AU.doorSlam(); pushMsgOnce('broke' + k, 'boss', 'הוא שבר את הדלת! היא לא תיסגר עכשיו.'); this.doorT = 0; }
        else if (this.beh !== 'hunter' && this.doorT > rand(6, 9)) { this.doorT = 0; this.state = this.beh === 'tracker' ? 'lost' : 'search'; this.timer = 3; this.wander(); }
        return true;
      }
    }
    this.doorT = Math.max(0, this.doorT - dt); return false;
  }
  wander(ok = aiWalk, filter = () => true) { const t = randomTile((x, y, i) => ok(x, y) && filter(x, y, i)); if (t != null) this.go(tc(t % MW), tc((t / MW) | 0), ok); }
  lockerHunt(dt, spd) {
    if (!(P.hidden && this.sawHide)) return false;
    if (!this.path || this.pathTarget !== P.hidden) { this.go(P.hidden.fx, P.hidden.fz); this.pathTarget = P.hidden; }
    this.follow(dt, spd);
    if (Math.hypot(this.x - P.hidden.fx, this.z - P.hidden.fz) < 0.9) killPlayer(this);
    return true;
  }
  visibleToPlayer() {
    if (P.hidden || G.mode === 'cctv') return false; const d = this.dist(); if (d > 28) return false;
    for (const h of [1.95, 1.2, 0.4]) { _v3.set(this.x, h, this.z).project(camera); if (_v3.z < 1 && Math.abs(_v3.x) < 1.02 && Math.abs(_v3.y) < 1.02) return los(camera.position.x, camera.position.z, this.x, this.z); }
    return false;
  }
  visibleOnCam() {
    if (G.mode !== 'cctv') return false; const cam = CCTV_CAMS[G.cam]; if (!cam) return false;
    if (Math.hypot(cam.position.x - this.x, cam.position.z - this.z) > 30) return false;
    for (const h of [1.6, 0.6]) { _v3.set(this.x, h, this.z).project(cam); if (_v3.z < 1 && Math.abs(_v3.x) < 1 && Math.abs(_v3.y) < 1) return los(cam.position.x, cam.position.z, this.x, this.z); }
    return false;
  }
  update(dt) {
    if (this.state === 'off') return;
    if (this.state === 'waiting') { this.spawnT -= dt; if (this.spawnT <= 0) this.appear(); else return; }
    const S = G.spdMul; this.frozen = false;
    switch (this.beh) {
      case 'listener': this.upListener(dt, S); break;
      case 'tracker': this.upTracker(dt, S); break;
      case 'statue': this.upStatue(dt, S); break;
      case 'guardian': this.upGuardian(dt, S); break;
      case 'charger': this.upCharger(dt, S); break;
      case 'hunter': this.upHunter(dt, S); break;
    }
    this.post(dt);
  }
  /* --- the host: sits, listens, comes to the noise --- */
  upListener(dt, S) {
    if (this.lockerHunt(dt, 3.6 * S)) return;
    const st = this.state;
    if (st === 'sit') {
      this.sit = true; this.vx = this.vz = 0; this.heading = 0; this.x = PARTY_SIT.x; this.z = PARTY_SIT.z;
      if (this.sees(4.5, 2.2)) { this.sit = false; return this.toChase(); }
      const n = this.hears(1.6); if (n) { this.sit = false; this.state = 'rise'; this.timer = 0.7; this.inv = n; AU.partyHorn(this.em); return; }
      this.timer -= dt; if (this.timer <= 0) { this.timer = rand(30, 55); if (G.hour >= 1.5 && Math.random() < 0.6) { this.sit = false; this.state = 'wander'; this.wander(aiWalk, (x, y, i) => ROOM_AT[i] === 'party' || ROOM_AT[i] === 'hall' || ROOM_AT[i] === 'lockers'); } }
    } else if (st === 'rise') { this.timer -= dt; if (this.timer <= 0) { this.state = 'investigate'; this.go(this.inv.x, this.inv.z, aiWalk, true); } }
    else if (st === 'investigate' || st === 'wander') {
      if (this.sees(5.5, 2.2)) return this.toChase();
      const n = this.hears(1.6); if (n && Math.random() < 0.25) this.go(n.x, n.z, aiWalk, true);
      if (this.follow(dt, (st === 'wander' ? 1.9 : 2.6) * S)) { this.state = 'search'; this.timer = 4; this.path = null; }
      this.atDoor(dt); this.catchCheck();
    } else if (st === 'search') { if (this.sees(5.5, 2.2)) return this.toChase(); this.search(dt, () => { this.state = 'return'; this.go(PARTY_SIT.x, PARTY_SIT.z); }); }
    else if (st === 'return') {
      if (this.sees(5.5, 2.2)) return this.toChase(); const n = this.hears(1.6); if (n) { this.state = 'investigate'; this.go(n.x, n.z, aiWalk, true); return; }
      if (this.follow(dt, 2.1 * S)) { this.state = 'sit'; this.timer = rand(25, 45); }
    } else if (st === 'chase') { this.chase(dt, 3.9 * S, 5.5, 2.2, 4); }
  }
  /* --- the counselor: walks your exact trail, leaves milk --- */
  upTracker(dt, S) {
    if (this.lockerHunt(dt, 3.4 * S)) return;
    const moving = Math.hypot(this.vx, this.vz) > 0.2;
    if (moving) { this.puddleT -= dt; if (this.puddleT <= 0) { this.puddleT = 1.6; dropMilk(this.x + rand(-0.3, 0.3), this.z + rand(-0.3, 0.3)); } }
    const st = this.state, safe = P.hidden || (inOfficeArea(P.x, P.z) && WORLD.doors.w.closed && WORLD.doors.e.closed);
    if (st === 'track') {
      if (this.sees(7, 2.4)) return this.toChase();
      if (safe) { this.state = 'lost'; this.timer = rand(14, 22); P.trail.length = 0; this.trailIdx = 0; this.wander(); return; }
      const tr = P.trail;
      if (this.trailIdx >= tr.length) { this.repath -= dt; if (this.repath <= 0) { this.repath = 0.5; this.go(P.x, P.z, aiWalk, true); } }
      else {
        const c = tr[this.trailIdx];
        if (Math.hypot(c.x - this.x, c.z - this.z) < 0.7) { this.trailIdx++; return; }
        if (this.crumb !== c) { this.crumb = c; if (losWide(this.x, this.z, c.x, c.z)) { this.path = [{ x: c.x, z: c.z }]; this.pi = 0; } else this.go(c.x, c.z, aiWalk, true); }
      }
      this.follow(dt, 2.55 * S); this.atDoor(dt); this.catchCheck();
    } else if (st === 'lost') {
      if (this.follow(dt, 1.8 * S)) this.wander();
      this.timer -= dt; if (this.timer <= 0 && !P.hidden) { this.state = 'track'; this.trailIdx = 0; this.crumb = null; }
    } else if (st === 'chase') {
      if (!this.chase(dt, 3.45 * S, 7, 2.4, 3)) { this.state = 'track'; let best = 0, bd = 1e9; P.trail.forEach((c, i) => { const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; best = i; } }); this.trailIdx = best; this.crumb = null; }
    } else if (st === 'search') { this.state = 'track'; }
  }
  /* --- the watcher: only moves when nobody is looking --- */
  upStatue(dt, S) {
    const vis = this.visibleToPlayer() || this.visibleOnCam();
    if (vis) {
      this.frozen = true; this.vx = this.vz = 0;
      if (!this.wasVis && this.moved > 1.5 && this.dist() < 9) { AU.sting(); glitch(0.5); }
      this.wasVis = true; this.moved = 0; return;
    }
    this.wasVis = false;
    if (P.hidden && !this.sawHide) { this.repath -= dt; if (this.repath <= 0 || !this.path) { this.repath = 6; this.wander(); } this.follow(dt, 1.6 * S); return; }
    if (this.lockerHunt(dt, 4 * S)) return;
    this.repath -= dt;
    if (this.repath <= 0) { this.repath = 0.45; if (!this.go(P.x, P.z)) this.go(P.x, P.z, aiWalk, true); }
    const ox = this.x, oz = this.z; this.follow(dt, 3.9 * S); this.moved += Math.hypot(this.x - ox, this.z - oz);
    if (this.moved > 0 && Math.random() < dt * 2.5 && this.em) AU.thump(this.em.inp, 0.12);
    this.catchCheck(1.0);
  }
  /* --- brodana: the warehouse is his half of the pitch --- */
  upGuardian(dt, S) {
    const pIn = zoneWarehouse(toTile(P.x), toTile(P.z)), st = this.state;
    if (st === 'patrol') {
      if (pIn && this.sees(13, 2.6)) { this.burst = 3.4; return this.toChase(); }
      const n = this.hears(1.2); if (n && zoneWarehouse(toTile(n.x), toTile(n.z))) { this.state = 'investigate'; this.go(n.x, n.z, zoneWarehouse, true); return; }
      if (this.follow(dt, 2.1 * S, zoneWarehouse)) { this.timer -= dt; if (this.timer <= 0) { this.timer = rand(0.5, 2.5); this.wander(zoneWarehouse); } }
    } else if (st === 'investigate') {
      if (pIn && this.sees(13, 2.6)) { this.burst = 3.4; return this.toChase(); }
      if (this.follow(dt, 3.0 * S, zoneWarehouse)) { this.state = 'patrol'; this.timer = 1.5; }
    } else if (st === 'chase') {
      if (!pIn || P.hidden) { this.state = 'patrol'; this.timer = 0.5; this.vx = this.vz = 0; this.path = null; if (!P.hidden) pushMsgOnce('brodana-out', 'brodana', 'יצאת מהאזור שלי. הפעם.'); return; }
      this.burst -= dt; if (this.burst < -1.7) { this.burst = 3.4; AU.pant(this.em); }
      const spd = this.burst > 0 ? 6.1 * S : 1.0;
      this.repath -= dt; if (this.repath <= 0) { this.repath = 0.3; this.go(P.x, P.z, zoneWarehouse, true); }
      this.follow(dt, spd, zoneWarehouse); this.catchCheck();
    } else this.state = 'patrol';
    const b = this.m.ball;
    if (b) { const sp = Math.hypot(this.vx, this.vz); b.position.set(this.x + Math.sin(this.heading) * 0.45, 0.11 + Math.abs(Math.sin(this.anim * 1.6)) * 0.12 * Math.min(1, sp / 2), this.z + Math.cos(this.heading) * 0.45); b.rotation.x += sp * dt * 6; }
  }
  /* --- the rider: corridors only, charges in straight lines --- */
  upCharger(dt, S) {
    const st = this.state;
    if (st === 'patrol') {
      this.eng = 0.25;
      if (this.aligned()) { this.state = 'rev'; this.timer = 0.85; return; }
      if (this.follow(dt, 3.0 * S, hallOnly)) this.wander(hallOnly);
      this.catchCheck(1.1);
    } else if (st === 'rev') { this.eng = 0.75; this.vx = this.vz = 0; this.heading = Math.atan2(this.cdx, this.cdz); this.timer -= dt; if (this.timer <= 0) { this.state = 'charge'; if (this.em) AU.thump(this.em, 0.3); } }
    else if (st === 'charge') {
      this.eng = 1; const v = 10 * S, nx = this.x + this.cdx * v * dt, nz = this.z + this.cdz * v * dt;
      if (!hallOnly(toTile(nx + this.cdx * 0.5), toTile(nz + this.cdz * 0.5))) { this.state = 'stun'; this.timer = 1.4; this.vx = this.vz = 0; if (this.em) AU.bang(this.em); if (this.dist() < 8) P.shake = 0.5; }
      else { this.x = nx; this.z = nz; this.vx = this.cdx * v; this.vz = this.cdz * v; }
      this.catchCheck(1.15);
    } else if (st === 'stun') { this.eng = 0.1; this.timer -= dt; if (this.timer <= 0) { this.state = 'patrol'; this.path = null; this.wander(hallOnly); } }
    else this.state = 'patrol';
  }
  aligned() {
    if (P.hidden) return false; const pt = [toTile(P.x), toTile(P.z)], et = [this.tx(), this.ty()];
    if (!GRID[idx(pt[0], pt[1])]) return false;
    const row = pt[1] === et[1], col = pt[0] === et[0]; if (!row && !col) return false;
    const d = this.dist(); if (d > 26 || d < 1.6 || !los(this.x, this.z, P.x, P.z)) return false;
    if (row) { this.cdx = Math.sign(P.x - this.x); this.cdz = 0; this.z = tc(et[1]); } else { this.cdx = 0; this.cdz = Math.sign(P.z - this.z); this.x = tc(et[0]); }
    return true;
  }
  /* --- patient zero: always knows roughly where you are --- */
  upHunter(dt, S) {
    if (this.lockerHunt(dt, 4.2 * S)) return;
    const st = this.state;
    if (st === 'stalk') {
      if (this.sees(18, 2.8)) { AU.groan(this.em, true); return this.toChase(); }
      this.timer -= dt;
      if (this.timer <= 0 || !this.path) { this.timer = 4; const tx = clamp(toTile(P.x) + randi(-2, 2), 1, MW - 2), ty = clamp(toTile(P.z) + randi(-2, 2), 1, MH - 2); if (!this.go(tc(tx), tc(ty))) this.go(P.x, P.z, aiWalk, true); }
      if (this.follow(dt, 2.75 * S)) this.timer = 0;
      this.atDoor(dt); this.catchCheck();
    } else if (st === 'chase') { this.chase(dt, 4.35 * S, 18, 2.8, 6); }
    else if (st === 'search') { if (this.sees(18, 2.8)) return this.toChase(); this.search(dt, () => { this.state = 'stalk'; this.timer = 0; }); }
  }
  post(dt) {
    const m = this.m, sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.05) this.heading = lerpAngle(this.heading, Math.atan2(this.vx, this.vz), 1 - Math.exp(-dt * 10));
    m.g.position.set(this.x, 0, this.z); m.g.rotation.y = this.heading;
    // animation
    if (!this.frozen) this.anim += dt * sp * 2.4;
    const sw = Math.sin(this.anim) * Math.min(1, sp / 2) * 0.6;
    if (this.sit) { m.legL.rotation.x = m.legR.rotation.x = -1.45; m.body.position.y = -0.42; m.armL.rotation.x = m.armR.rotation.x = -0.35; m.g.position.z = this.z - 0.2; }
    else if (this.beh === 'charger') { m.legL.rotation.x = m.legR.rotation.x = 0; m.armL.rotation.x = m.armR.rotation.x = -1.15; m.body.position.y = 0.16; }
    else {
      m.body.position.y = Math.abs(Math.sin(this.anim)) * 0.04 * Math.min(1, sp);
      m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
      if ((this.beh === 'hunter' || this.beh === 'statue') && (this.state === 'chase' || this.beh === 'statue')) { const r = -1.35 + Math.sin(this.anim * 2) * 0.06; m.armL.rotation.x = r; m.armR.rotation.x = r; }
      else { m.armL.rotation.x = -sw * 0.8; m.armR.rotation.x = sw * 0.8; }
    }
    if (!this.frozen) {
      this.twitchT -= dt; if (this.twitchT <= 0) { this.twitchT = rand(1.2, 4); this.tw = 0.18; this.twz = rand(-0.4, 0.4); this.twy = rand(-0.6, 0.6); }
      if (this.tw > 0) { this.tw -= dt; m.head.rotation.z = this.twz; m.head.rotation.y = this.twy; } else { m.head.rotation.z *= 0.85; m.head.rotation.y *= 0.85; }
    }
    const d = this.dist(); m.eyeMat.opacity = clamp(1.25 - d / 26, 0, 1) * (0.75 + Math.random() * 0.25);
    // sound
    if (this.em) {
      const occ = !los(P.x, P.z, this.x, this.z); AU.place(this.em, this.x, 1.6, this.z, occ);
      if (sp > 0.3 && this.beh !== 'charger' && this.beh !== 'statue') { this.stepT -= dt * sp; if (this.stepT <= 0) { this.stepT = 1.5; AU.thump(this.em.inp, this.beh === 'hunter' ? 0.55 : 0.32); } }
      this.soundT -= dt;
      if (this.soundT <= 0) {
        if (this.beh === 'tracker') { this.soundT = rand(7, 12); AU.whistle(this.em.inp); }
        else if (this.beh === 'hunter') { this.soundT = rand(4, 8); AU.groan(this.em.inp, this.state === 'chase'); }
        else if (this.beh === 'guardian') { this.soundT = this.state === 'chase' ? 0.32 : 0.6; if (sp > 0.2) AU.bounce(this.em.inp, this.state === 'chase' ? 0.7 : 0.45); }
        else this.soundT = 5;
      }
      if (this.engine) AU.setEngine(this.engine, this.active ? this.eng : 0);
    }
    if (this.beh === 'charger' && riderSpot) {
      riderSpot.position.set(this.x + Math.sin(this.heading) * 0.4, 1.15, this.z + Math.cos(this.heading) * 0.4);
      riderSpot.target.position.set(this.x + Math.sin(this.heading) * 6, 0.5, this.z + Math.cos(this.heading) * 6);
      riderSpot.intensity = this.active ? (this.state === 'charge' || this.state === 'rev' ? 3.2 : 1.3) : 0;
    }
  }
}
function buildEnemies() { for (const c of CAST) ENEMIES.push(new Enemy(c)); }
function refreshEnemyLooks() {
  for (const e of ENEMIES) {
    e.m.face.map = maskTexture(e.id); e.m.face.needsUpdate = true;
    const eyes = castEyes(e.id); e.m.eyes.forEach((s, i) => { const [ex, ey] = eyes[i]; s.position.set((ex - 0.5) * 0.5, 0.26 + (0.5 - ey) * 0.5, 0.24); });
  }
}
function updateEnemies(dt) { for (const e of ENEMIES) e.update(dt); }
