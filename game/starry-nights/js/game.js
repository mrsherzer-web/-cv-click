'use strict';
/* =====================================================================
   STARRY NIGHTS · game.js
   nights & missions · office, doors & cameras · menus · cast editor · main loop
   ===================================================================== */

const G = {
  mode: 'boot', night: 1, N: null, time: 0, hour: 0, step: 0, steps: [], counts: {}, msgQ: [], log: [], once: {}, spdMul: 1, fear: 0, hb: 0,
  locked: false, suppressPause: false, inOffice: false, cam: 0, holdT: 0, holdTarget: null, focus: null, flickerT: 0, stats: {}, lastRoom: null,
  killer: null, ready: false, code: '0000', entry: '', escapeT: 0, back: 'title', prevMode: 'play', hudT: 0, audioReady: false, gateBlink: 0, whiteOn: false
};
let BOSS_AVATAR = '', SUNRISE = '';
const ITEM_LABEL = { fuse: 'לאסוף נתיך', bottle: 'לקחת בקבוק ונדיה', fuel: 'לקחת ג׳ריקן דלק', note: 'להרים את הפתק', battery: 'לקחת סוללה לפנס', card: 'לאסוף קלף שחקן' };
const ITEM_NAME = { fuse: 'נתיכים', bottle: 'בקבוקים', fuel: 'ג׳ריקנים', cambox: 'מצלמות', valve: 'שסתומים', note: 'פתק' };
const CHASE_LINE = { host: 'מצאתי אותך 🎉', counselor: 'ראיתי אותך', brodana: 'בוא נראה אותך עובר אותי', zero: 'תסתובב.' };

/* ---------------- small UI helpers ---------------- */
const _txt = new Map();
function setText(sel, v) { if (_txt.get(sel) === v) return; _txt.set(sel, v); const el = $(sel); if (el) el.textContent = v; }
function showScreen(id) { $$('.screen').forEach(s => { s.hidden = s.id !== id; }); if (id === 'title') startSkyLoop(); $('#done').classList.toggle('show', id === 'done'); }
function hideScreens() { $$('.screen').forEach(s => { s.hidden = true; }); }
function setTouchUI(on) { const off = !(on && IS_TOUCH); $('#touchzone').hidden = off; $('#tbtns').hidden = off; if (off) clearTouchState(); }
let _sysT = 0; function toast(t) { const el = $('#sys'); el.textContent = t; el.classList.add('on'); clearTimeout(_sysT); _sysT = setTimeout(() => el.classList.remove('on'), 2400); }
let _locT = 0; function showLoc(t) { const el = $('#loc'); el.textContent = t; el.classList.add('on'); clearTimeout(_locT); _locT = setTimeout(() => el.classList.remove('on'), 2000); }
function glitch(s) { const el = $('#glitch'); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), s * 1000); }
function flicker(s) { G.flickerT = s; }
const fmtClock = () => { const H = diff().hour, h = Math.floor(G.time / H), m = Math.floor((G.time % H) / H * 60); return `${fmt2(h)}:${fmt2(m)}`; };

function makeBossAvatar() { const c = cv(96, 96), x = c2(c); swirlBG(x, 96, 96); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 96, 96); txt(x, 'ו', 48, 52, `900 56px ${FONT_U}`, '#f4d54b'); return c.toDataURL('image/jpeg', 0.86); }
function makeSunrise() {
  const c = cv(512, 512), x = c2(c), g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#16307a'); g.addColorStop(0.55, '#e07b39'); g.addColorStop(1, '#ffd98a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512); const s = x.createRadialGradient(256, 400, 0, 256, 400, 160); s.addColorStop(0, '#fff6d8'); s.addColorStop(0.4, 'rgba(255,220,140,.8)'); s.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = s; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#03040a'; x.fillRect(0, 440, 512, 72); txt(x, '06:00', 256, 170, `700 150px ${FONT_D}`, '#fff3d4'); grainFx(x, 512, 512, 18); return c.toDataURL('image/jpeg', 0.86);
}

/* ---------------- the title sky: a moving starry night ---------------- */
const SKY = { on: false, parts: [], stars: [], t: 0, w: 0, h: 0, d: 1, x: null };
function newPart() { return { x: rand(SKY.w), y: rand(SKY.h * 0.85), life: rand(40, 170), c: pick(['#1c3f94', '#2f5fd0', '#5b8be0', '#9cc3ff', '#16307a', '#2d5bd1', '#e8d77a']) }; }
function sizeSky() {
  const c = $('#sky'), d = Math.min(window.devicePixelRatio || 1, 1.5); SKY.d = d;
  SKY.w = c.width = Math.max(1, Math.floor(innerWidth * d)); SKY.h = c.height = Math.max(1, Math.floor(innerHeight * d));
  SKY.x.fillStyle = '#060918'; SKY.x.fillRect(0, 0, SKY.w, SKY.h);
  SKY.stars = []; for (let i = 0; i < 6; i++) SKY.stars.push({ x: rand(SKY.w * 0.05, SKY.w * 0.95), y: rand(SKY.h * 0.05, SKY.h * 0.5), r: rand(12, 28) * d, ph: rand(6) });
  SKY.stars.push({ x: SKY.w * 0.1, y: SKY.h * 0.14, r: 40 * d, ph: 0, moon: true });
  for (const p of SKY.parts) Object.assign(p, newPart());
}
function startSky() { SKY.x = $('#sky').getContext('2d'); const n = IS_TOUCH ? 230 : 520; for (let i = 0; i < n; i++) SKY.parts.push({}); sizeSky(); window.addEventListener('resize', () => { if (!$('#title').hidden) sizeSky(); }); startSkyLoop(); }
function startSkyLoop() { if (SKY.on || !SKY.x) return; SKY.on = true; requestAnimationFrame(skyFrame); }
function skyFrame() {
  if ($('#title').hidden) { SKY.on = false; return; }
  requestAnimationFrame(skyFrame);
  const x = SKY.x, d = SKY.d; SKY.t += 0.016;
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = 'rgba(6,9,24,0.06)'; x.fillRect(0, 0, SKY.w, SKY.h);
  x.lineWidth = 2.2 * d; x.lineCap = 'round'; x.globalAlpha = 0.55;
  for (const p of SKY.parts) {
    let a = Math.sin(p.x * 0.0035 / d + SKY.t * 0.15) * 1.5 + Math.cos(p.y * 0.0042 / d - SKY.t * 0.1) * 1.5;
    for (const s of SKY.stars) { const dx = p.x - s.x, dy = p.y - s.y, dd = Math.hypot(dx, dy), R = s.r * 7; if (dd < R) a = lerpAngle(a, Math.atan2(dy, dx) + 1.45, (1 - dd / R) * 0.9); }
    const nx = p.x + Math.cos(a) * 1.6 * d, ny = p.y + Math.sin(a) * 1.6 * d;
    x.strokeStyle = p.c; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(nx, ny); x.stroke();
    p.x = nx; p.y = ny; p.life--;
    if (p.life <= 0 || p.x < 0 || p.x > SKY.w || p.y < 0 || p.y > SKY.h) Object.assign(p, newPart());
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'lighter';
  for (const s of SKY.stars) {
    const r = s.r * (1 + Math.sin(SKY.t * 1.4 + s.ph) * 0.12), g = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.2);
    g.addColorStop(0, s.moon ? 'rgba(255,240,170,.05)' : 'rgba(255,244,190,.035)'); g.addColorStop(0.3, 'rgba(244,213,75,.016)'); g.addColorStop(1, 'rgba(244,213,75,0)');
    x.fillStyle = g; x.beginPath(); x.arc(s.x, s.y, r * 2.2, 0, 7); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
}

/* ---------------- menus ---------------- */
function renderNightCards() {
  const wrap = $('#nightCards'); wrap.innerHTML = '';
  NIGHTS.forEach(N => {
    const locked = N.n > PROGRESS.unlocked, done = !!PROGRESS.done[N.n];
    const b = document.createElement('button'); b.className = 'tcard' + (locked ? ' locked' : '') + (done ? ' done' : '');
    b.disabled = locked || !G.ready; b.setAttribute('aria-label', `לילה ${N.n}: ${N.title}${locked ? ' (נעול)' : ''}`);
    b.innerHTML = `<span class="tc-h">כרטיס נוכחות · לילה</span><b class="tc-n">${N.n}</b><span class="tc-t"></span><span class="tc-time" dir="ltr">00:00 — 06:00</span>${done ? '<i class="stamp" dir="ltr">OUT</i>' : locked ? '<i class="lock">נעול</i>' : ''}`;
    b.querySelector('.tc-t').textContent = N.title;
    b.addEventListener('click', () => selectNight(N.n));
    wrap.appendChild(b);
  });
}
function cardEl(c, big) {
  const d = document.createElement('div'); d.className = 'pcard ' + c.id; if (big) d.style.width = '230px';
  d.innerHTML = `<div class="in"></div><b class="pc-ovr">${c.ovr}</b><span class="pc-pos">${c.pos}</span><div class="pc-photo"><img alt=""></div><div class="pc-name"></div><div class="pc-stats" dir="ltr">${['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'].map((k, i) => `<span><b>${c.stats[i]}</b>${k}</span>`).join('')}</div>`;
  d.querySelector('img').src = ART.faceURL[c.id] || ''; d.querySelector('.pc-name').textContent = castName(c.id);
  if (PROGRESS.cards.includes(c.id)) { const f = document.createElement('i'); f.className = 'pc-found'; f.textContent = 'נמצא'; d.appendChild(f); }
  return d;
}
function renderCast() {
  const g = $('#castGrid'); g.innerHTML = '';
  for (const c of CAST) {
    const art = document.createElement('article'); art.className = 'pc'; art.appendChild(cardEl(c));
    const info = document.createElement('div'); info.className = 'pc-info';
    info.innerHTML = `<label class="lbl" for="nm-${c.id}">שם</label><input class="pc-input" id="nm-${c.id}" maxlength="16" autocomplete="off"><p class="pc-role"><b></b> · <span></span></p><p class="pc-bio"></p><p class="pc-tip"></p><div class="pc-btns"><label class="btn ghost small" for="up-${c.id}" tabindex="0">החלפת תמונה</label><input type="file" id="up-${c.id}" accept="image/*" hidden><button class="btn ghost small" data-reset>איפוס</button></div>`;
    const inp = info.querySelector('.pc-input'); inp.value = castName(c.id); inp.placeholder = c.name;
    info.querySelector('.pc-role b').textContent = c.ability; info.querySelector('.pc-role span').textContent = `מלילה ${c.night}`;
    info.querySelector('.pc-bio').textContent = c.bio; info.querySelector('.pc-tip').textContent = c.tip;
    inp.addEventListener('input', () => { CASTDATA[c.id] = Object.assign({}, CASTDATA[c.id], { name: inp.value.slice(0, 16) }); saveCast(); art.querySelector('.pc-name').textContent = castName(c.id); });
    const file = info.querySelector('input[type=file]'), lab = info.querySelector('label.btn');
    lab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) openEditor(f, c.id); });
    const rb = info.querySelector('[data-reset]'); rb.hidden = !(CASTDATA[c.id] && (CASTDATA[c.id].photo || CASTDATA[c.id].name));
    rb.addEventListener('click', async () => { delete CASTDATA[c.id]; saveCast(); await buildFace(c.id); refreshEnemyLooks(); renderCast(); });
    art.appendChild(info); g.appendChild(art);
  }
}
function renderSettings() {
  $('#setVol').value = SETTINGS.volume; $('#setSens').value = SETTINGS.sens; $('#setTSens').value = SETTINGS.touchSens;
  $$('#setQ button').forEach(b => b.classList.toggle('on', b.dataset.v === SETTINGS.quality));
  $$('#setD button').forEach(b => b.classList.toggle('on', b.dataset.v === SETTINGS.difficulty));
  const rb = $('#btnReset'); rb.textContent = 'איפוס ההתקדמות'; delete rb.dataset.armed;
}
function initSettingsUI() {
  const vol = $('#setVol'), sens = $('#setSens'), ts = $('#setTSens');
  vol.oninput = () => { SETTINGS.volume = +vol.value; AU.setVolume(SETTINGS.volume); saveSettings(); };
  sens.oninput = () => { SETTINGS.sens = +sens.value; saveSettings(); };
  ts.oninput = () => { SETTINGS.touchSens = +ts.value; saveSettings(); };
  $$('#setQ button').forEach(b => b.onclick = () => { SETTINGS.quality = b.dataset.v; saveSettings(); renderSettings(); resize(); });
  $$('#setD button').forEach(b => b.onclick = () => { SETTINGS.difficulty = b.dataset.v; saveSettings(); renderSettings(); });
  const rb = $('#btnReset');
  rb.onclick = () => {
    if (rb.dataset.armed) { Object.assign(PROGRESS, { unlocked: 1, done: [], cards: [], won: false, tape: false }); saveProgress(); rb.textContent = 'ההתקדמות אופסה'; delete rb.dataset.armed; renderNightCards(); }
    else { rb.dataset.armed = '1'; rb.textContent = 'בטוח? לחצו שוב כדי לאפס'; }
  };
}

/* photo framing editor */
const ED = { img: null, id: null, s: 1, ox: 0, oy: 0, V: 0, b: 1, drag: null };
function initEditor() {
  const view = $('#edView');
  view.addEventListener('pointerdown', e => { ED.drag = { x: e.clientX, y: e.clientY, ox: ED.ox, oy: ED.oy }; try { view.setPointerCapture(e.pointerId); } catch (err) { } });
  view.addEventListener('pointermove', e => { if (!ED.drag) return; ED.ox = ED.drag.ox + (e.clientX - ED.drag.x); ED.oy = ED.drag.oy + (e.clientY - ED.drag.y); layoutEd(); });
  const up = () => { ED.drag = null; }; view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', e => { e.preventDefault(); const z = $('#edZoom'); z.value = clamp(+z.value - e.deltaY * 0.002, 1, 4); ED.s = +z.value; layoutEd(); }, { passive: false });
  $('#edZoom').addEventListener('input', e => { ED.s = +e.target.value; layoutEd(); });
  $('#edCancel').onclick = () => { $('#editor').hidden = true; };
  $('#edSave').onclick = saveEditor;
}
function openEditor(file, id) {
  const r = new FileReader();
  r.onload = () => { const img = $('#edImg'); img.onload = () => { ED.img = img; ED.id = id; ED.s = 1; ED.ox = ED.oy = 0; $('#edZoom').value = 1; $('#editor').hidden = false; requestAnimationFrame(layoutEd); }; img.src = r.result; };
  r.readAsDataURL(file);
}
function layoutEd() {
  const view = $('#edView'), V = view.clientWidth, img = ED.img; if (!img || !V) return; ED.V = V;
  ED.b = V / Math.min(img.naturalWidth, img.naturalHeight); const dw = img.naturalWidth * ED.b * ED.s, dh = img.naturalHeight * ED.b * ED.s;
  ED.ox = clamp(ED.ox, -(dw - V) / 2, (dw - V) / 2); ED.oy = clamp(ED.oy, -(dh - V) / 2, (dh - V) / 2);
  Object.assign(img.style, { width: dw + 'px', height: dh + 'px', left: ((V - dw) / 2 + ED.ox) + 'px', top: ((V - dh) / 2 + ED.oy) + 'px' });
}
async function saveEditor() {
  const img = ED.img, V = ED.V, S = 384, k = S / V; if (!img || !V) return;
  const dw = img.naturalWidth * ED.b * ED.s, dh = img.naturalHeight * ED.b * ED.s;
  const c = cv(S, S), x = c2(c); x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.drawImage(img, ((V - dw) / 2 + ED.ox) * k, ((V - dh) / 2 + ED.oy) * k, dw * k, dh * k);
  const id = ED.id; CASTDATA[id] = Object.assign({}, CASTDATA[id], { photo: c.toDataURL('image/jpeg', 0.85) });
  const ok = saveCast(); $('#editor').hidden = true;
  await buildFace(id); refreshEnemyLooks(); renderCast();
  $('#castNote').textContent = ok ? `התמונה של ${castName(id)} נשמרה.` : 'התמונה עובדת עכשיו, אבל הדפדפן לא הצליח לשמור אותה. אחרי רענון היא תחזור למקור.';
}

/* the night-5 tape */
function playTape(next) {
  G.mode = 'tape'; showScreen('tape'); const v = $('#tapev'), tape = $('#tape');
  $('#tapeCut').style.backgroundImage = `url(${ART.scareURL.zero})`;
  $('#tapeCap').textContent = fillNames('{zero}, יום הטעימה הראשון. בקבוק 0001.');
  let finished = false;
  const done = () => {
    if (finished) return; finished = true; try { v.pause(); } catch (e) { }
    tape.classList.add('cut'); AU.scream();
    setTimeout(() => { tape.classList.remove('cut'); PROGRESS.tape = true; saveProgress(); next(); }, 800);
  };
  v.onended = done; $('#tapeSkip').onclick = done;
  if (!v.getAttribute('src')) v.src = 'assets/tape0.mp4';
  try { v.currentTime = 0; } catch (e) { }
  v.volume = clamp(SETTINGS.volume, 0, 1); v.muted = false;
  const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => done()); });
  setTimeout(() => { if (!finished && v.readyState < 2) done(); }, 6000);
}

/* ---------------- night flow ---------------- */
function selectNight(n) {
  if (!G.ready) return; AU.init(); ensureAudio(); G.night = n;
  if (NIGHTS[n - 1].tape) playTape(() => showIntro(n)); else showIntro(n);
}
function showIntro(n) {
  const N = NIGHTS[n - 1]; G.mode = 'intro'; G.night = n;
  setText('#in-n', String(n)); setText('#in-title', N.title); setText('#in-story', N.story);
  const ol = $('#in-steps'); ol.innerHTML = '';
  N.steps.forEach(s => { const li = document.createElement('li'); li.textContent = s.k === 'collect' ? `${s.text} (${s.count})` : s.text; ol.appendChild(li); });
  const ul = $('#in-cast'); ul.innerHTML = '';
  for (const id in N.cast) { const li = document.createElement('li'), img = document.createElement('img'), d = document.createElement('div'), sm = document.createElement('small'); img.src = ART.faceURL[id]; img.alt = ''; d.textContent = castName(id); sm.textContent = castDef(id).ability; d.appendChild(sm); li.append(img, d); ul.appendChild(li); }
  showScreen('intro');
}
function ensureAudio() {
  if (G.audioReady || !AU.ctx) return; G.audioReady = true;
  G.speaker = AU.emitter(); AU.place(G.speaker, 55.7, 1.2, 24.7, false); AU.makeMusic(G.speaker);
  G.genEm = AU.emitter(); AU.place(G.genEm, 18, 1, 45, false); G.genHum = AU.makeHum(G.genEm);
}
function clearNightObjects() {
  for (const it of ITEMS) if (it.g.parent) scene.remove(it.g);
  ITEMS.length = 0;
  for (let i = INTER.length - 1; i >= 0; i--) if (INTER[i].temp) INTER.splice(i, 1);
  INTER.forEach(i => { i.prog = 0; });
}
function spawnItem(kind, tx, ty, o = {}) {
  const g = itemMesh(kind, o.id), x = tc(tx) + rand(-0.35, 0.35), z = tc(ty) + rand(-0.35, 0.35);
  g.position.set(x, 0.05, z); g.rotation.y = rand(6.28); scene.add(g);
  const it = { kind, x, z, g, id: o.id, taken: false, t: rand(6) }; ITEMS.push(it);
  INTER.push({ temp: true, x, z, r: 1.6, label: () => ITEM_LABEL[kind], enabled: () => !it.taken, use: () => takeItem(it) });
  return it;
}
function spawnCambox(tx, ty, side) {
  const w = onWall(tx, ty, side), g = itemMesh('cambox');
  g.position.set(w.x + w.nx * 0.09, 1.45, w.z + w.nz * 0.09); g.rotation.y = Math.atan2(w.nx, w.nz); scene.add(g);
  const it = { kind: 'cambox', x: w.x + w.nx * 0.95, z: w.z + w.nz * 0.95, g, taken: false, fixed: true, t: 0 }; ITEMS.push(it);
  INTER.push({ temp: true, x: it.x, z: it.z, r: 1.6, hold: 1.5, label: () => 'לאתחל את המצלמה', enabled: () => !it.taken, holding: holdNoise(5),
    use: () => { it.taken = true; const led = g.userData.led; led.material = MAT.ledOk; led.visible = true; AU.beep(1200); AU.beep(1700, 0.08); addCount('cambox'); } });
}
function spawnNightItems(N) {
  for (const s of N.steps) {
    if (s.k !== 'collect') continue;
    if (s.item === 'fuse' || s.item === 'bottle' || s.item === 'fuel') shuffle(SPOTS[s.item]).slice(0, s.count).forEach(([x, y]) => spawnItem(s.item, x, y));
    else if (s.item === 'note') { const [x, y] = pick(SPOTS.note); spawnItem('note', x, y); }
    else if (s.item === 'cambox') SPOTS.cambox.forEach(([x, y, side]) => spawnCambox(x, y, side));
  }
  shuffle(SPOTS.battery).slice(0, 3).forEach(([x, y]) => spawnItem('battery', x, y));
  for (const id in SPOTS.card) if (!PROGRESS.cards.includes(id) && castDef(id).night <= N.n) spawnItem('card', SPOTS.card[id][0], SPOTS.card[id][1], { id });
}
function startNight(n) {
  AU.init(); ensureAudio();
  const N = NIGHTS[n - 1]; G.night = n; G.N = N;
  clearNightObjects(); resetPlayer(); refreshPosters();
  WORLD.power = 100; WORLD.genOn = N.power; WORLD.fuses = N.power; WORLD.doorLight = null;
  for (const k of ['w', 'e']) { const d = WORLD.doors[k]; d.closed = false; d.broken = 0; d.y = 2.6; d.hit = 0; }
  WORLD.gate.y = 0; WORLD.gate.mesh.position.y = 1.58;
  WORLD.valves.forEach(v => { v.open = false; v.spin = 0; v.wheel.rotation.z = 0; });
  WORLD.fuseSlots.forEach(s => { s.material = N.power ? MAT.slotOn : MAT.slotOff; });
  clearMilk();
  const DL = LIGHTS.door.l; DL.color.setHex(0xfff4dc); DL.distance = 9; hemi.intensity = 0.22; G.whiteOn = false; $('#flashwhite').classList.remove('on');
  if (riderSpot) riderSpot.intensity = 0;
  Object.assign(G, { time: 0, hour: 0, step: 0, counts: {}, once: {}, log: [], fear: 0, killer: null, flickerT: 0, lastRoom: null, holdT: 0, holdTarget: null, gateBlink: 0, escapeT: 0 });
  G.steps = N.steps.map(s => Object.assign({}, s, { done: false }));
  G.stats = { close: 0, hides: 0, wasNear: false };
  G.msgQ = N.msgs.map(m => Object.assign({ sent: false }, m));
  G.code = String(randi(1000, 9999));
  spawnNightItems(N);
  const delayMul = SETTINGS.difficulty === 'easy' ? 1.3 : SETTINGS.difficulty === 'nightmare' ? 0.7 : 1;
  for (const e of ENEMIES) { if (e.engine) AU.setEngine(e.engine, 0); if (N.cast[e.id] != null) e.schedule(N.cast[e.id] * delayMul); else e.reset(); }
  refreshEnemyLooks(); setPowerVisuals();
  $('#toasts').innerHTML = ''; $('#tasks').hidden = true; $('#modal').hidden = true; $('#mapview').hidden = true; $('#cctv').hidden = true; $('#jump').hidden = true;
  hideScreens(); $('#hud').hidden = false; setTouchUI(true);
  G.mode = 'play'; G.inOffice = true; if (!IS_TOUCH) lockPointer();
  AU.setHum(WORLD.genOn); updateHUD(true); showLoc(ROOMS.office.name);
}

/* ---------------- missions ---------------- */
const curStep = () => G.steps[G.step];
function stepIs(k, x) { const s = curStep(); return !!s && s.k === k && (s.obj === x || s.item === x || s.room === x); }
function stepText(s) {
  if (s.k === 'collect') return `${s.text} ${Math.min(G.counts[s.item] || 0, s.count)}/${s.count}`;
  if (s.obj === 'safe' && G.counts.note) return `${s.text} · הקוד: ${G.code}`;
  return s.text;
}
function checkSteps() { let s = curStep(); while (s && s.k === 'collect' && (G.counts[s.item] || 0) >= s.count) { completeStep(); s = curStep(); } }
function completeStep() {
  const s = curStep(); if (!s) return; s.done = true; G.step++;
  AU.objective(); fireEvent('done:' + G.step);
  const o = $('#obj'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
  updateHUD(true); if (curStep()) checkSteps();
}
function addCount(kind) {
  G.counts[kind] = (G.counts[kind] || 0) + 1; const s = curStep();
  if (s && s.k === 'collect' && s.item === kind) toast(`${ITEM_NAME[kind]} ${Math.min(G.counts[kind], s.count)}/${s.count}`);
  else if (ITEM_NAME[kind]) toast(`אספת: ${ITEM_NAME[kind]}`);
  checkSteps(); updateHUD(true);
}
function takeItem(it) {
  if (it.taken) return; it.taken = true; scene.remove(it.g); AU.pickup();
  if (it.kind === 'battery') { P.battery = Math.min(100, P.battery + 50); toast('סוללה חדשה לפנס'); return; }
  if (it.kind === 'card') { if (!PROGRESS.cards.includes(it.id)) PROGRESS.cards.push(it.id); saveProgress(); showCard(it.id); return; }
  if (it.kind === 'note') { addCount('note'); showNote('פתק מקומט', `הקוד של הכספת של המנהלת:\n\n${G.code.split('').join(' ')}\n\nלא לשכוח שוב!!`); return; }
  addCount(it.kind);
}
const holdNoise = r => dt => { if (Math.random() < dt * 2) emitNoise(P.x, P.z, r); };
function gateHolding(dt, p) {
  WORLD.gate.mesh.position.y = 1.58 + p * 0.45; G.gateBlink = 0.3; P.shake = Math.max(P.shake, 0.05);
  if (Math.random() < dt * 2.5) { emitNoise(P.x, P.z, 45); AU.beep(520, 0.12); }
}
function openValve(v) {
  v.open = true; AU.noise({ type: 'highpass', f: 3000, dur: 2.5, v: 0.22, a: 0.05 });
  const g = new THREE.PlaneGeometry(1.8, 1.8); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, MAT.stain); m.position.set(v.x, 0.014, v.z); scene.add(m); ITEMS.push({ kind: 'decal', g: m, taken: true, x: v.x, z: v.z });
  addCount('valve');
}
function useObj(name) {
  if (name === 'fusebox') { WORLD.fuses = true; WORLD.genOn = true; WORLD.power = Math.max(WORLD.power, 60); WORLD.fuseSlots.forEach(s => { s.material = MAT.slotOn; }); AU.powerUp(); setPowerVisuals(); fireEvent('power'); completeStep(); }
  else if (name === 'tasting') { toast('הבקבוקים בתחנת הטעימות'); completeStep(); }
  else if (name === 'genfuel') { WORLD.power = Math.min(100, WORLD.power + 60); WORLD.genOn = true; setPowerVisuals(); AU.powerUp(); completeStep(); }
  else if (name === 'restart') { WORLD.power = Math.max(WORLD.power, 35); WORLD.genOn = true; setPowerVisuals(); AU.powerUp(); toast('הגנרטור עובד שוב'); }
  else if (name === 'freezer') { toast('לקחת את הנוסחה המקורית'); flicker(2.5); glitch(0.4); AU.sting(); completeStep(); }
  else if (name === 'gate') escapeNight();
}
function useClock() { if (stepIs('clock')) finishNight(); else { AU.buzz(); toast('עוד לא סיימת את המשימות של הלילה'); } }
function updateGoto() {
  const s = curStep(); if (!s || s.k !== 'goto' || roomAtW(P.x, P.z) !== s.room) return;
  completeStep();
  if (s.note === 1) setTimeout(() => { if (G.mode === 'play') showNote('המקלחות', fillNames('כל הרצפה לבנה מחלב.\nעל המראה מישהו כתב באדום: "{counselor} היה פה".\nוהעקבות הלבנות ממשיכות החוצה, אל המסדרון…')); }, 400);
}
function objectiveTargets() {
  const s = curStep(); if (!s) return [];
  if (s.k === 'collect') { if (s.item === 'valve') return WORLD.valves.filter(v => !v.open).map(v => ({ x: v.x, z: v.z })); return ITEMS.filter(it => it.kind === s.item && !it.taken).map(it => ({ x: it.x, z: it.z })); }
  if (s.k === 'cctv' || s.k === 'clock') return [{ x: 48, z: 55.5 }];
  if (s.k === 'goto') { const a = ROOMS[s.room].at; return [{ x: a[0] * T, z: a[1] * T }]; }
  const O = { fusebox: [25.5, 39.6], tasting: [46.5, 4], genfuel: [21, 45], safe: [82.9, 50], freezer: [55.5, 43.5], gate: [19.5, 68] }[s.obj];
  return O ? [{ x: O[0], z: O[1] }] : [];
}
function buildInteractables() {
  const add = o => INTER.push(o);
  add({ id: 'desk', x: 48, z: 54.7, r: 2.4, label: () => 'מצלמות האבטחה', use: openCCTV });
  add({ id: 'clock', x: 49.5, z: 59.1, r: 1.8, label: () => stepIs('clock') ? 'להחתים כרטיס יציאה' : 'שעון נוכחות', use: useClock });
  add({ id: 'panelW', x: 42.7, z: 58.4, r: 1.5, label: () => WORLD.doors.w.closed ? 'לפתוח את הדלת השמאלית' : 'לסגור את הדלת השמאלית', use: () => toggleDoor('w') });
  add({ id: 'panelE', x: 53.3, z: 58.4, r: 1.5, label: () => WORLD.doors.e.closed ? 'לפתוח את הדלת הימנית' : 'לסגור את הדלת הימנית', use: () => toggleDoor('e') });
  add({ id: 'fusebox', x: 25.5, z: 40.1, r: 1.9, hold: 2, label: () => 'להכניס את הנתיכים', enabled: () => stepIs('use', 'fusebox'), use: () => useObj('fusebox'), holding: holdNoise(4) });
  add({ id: 'gen', x: 21.8, z: 45, r: 2.2, hold: () => stepIs('use', 'genfuel') ? 2.5 : 3,
    label: () => stepIs('use', 'genfuel') ? 'למלא דלק בגנרטור' : 'להפעיל מחדש את הגנרטור',
    enabled: () => stepIs('use', 'genfuel') || (WORLD.power <= 0 && WORLD.fuses), use: () => useObj(stepIs('use', 'genfuel') ? 'genfuel' : 'restart'), holding: holdNoise(6) });
  add({ id: 'tasting', x: 46.5, z: 4.4, r: 1.9, hold: 1, label: () => 'להניח את הבקבוקים בתחנה', enabled: () => stepIs('use', 'tasting'), use: () => useObj('tasting') });
  add({ id: 'safe', x: 82.9, z: 49.2, r: 1.7, label: () => 'לפתוח את הכספת', enabled: () => stepIs('use', 'safe'), use: openKeypad });
  add({ id: 'freezer', x: 54.4, z: 43.5, r: 2.0, hold: 1.2, label: () => 'לפתוח את המקפיא', enabled: () => stepIs('use', 'freezer'), use: () => useObj('freezer') });
  add({ id: 'gate', x: 19.5, z: 67.4, r: 2.8, hold: 8, keep: true, label: () => 'לפתוח את שער היציאה', enabled: () => stepIs('use', 'gate'), use: () => useObj('gate'), holding: gateHolding });
  WORLD.valves.forEach((v, i) => add({ id: 'valve' + i, x: v.ix, z: v.iz, r: 1.8, hold: 2, label: () => 'לפתוח את השסתום', enabled: () => stepIs('collect', 'valve') && !v.open, use: () => openValve(v), holding: holdNoise(3) }));
}

/* ---------------- messages ---------------- */
function pushMsg(from, text) {
  text = fillNames(text);
  const name = from === 'boss' ? 'ונדיה · המנהלת' : castName(from), av = from === 'boss' ? BOSS_AVATAR : ART.faceURL[from];
  const el = document.createElement('div'); el.className = 'msg' + (from !== 'boss' ? ' friend' : '');
  el.innerHTML = '<img alt=""><div><b></b><p></p></div>'; el.querySelector('img').src = av; el.querySelector('b').textContent = name; el.querySelector('p').textContent = text;
  const box = $('#toasts'); box.prepend(el); while (box.children.length > (IS_TOUCH ? 2 : 3)) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 7600);
  G.log.unshift({ name, text }); AU.ding();
}
function pushMsgOnce(key, from, text) { if (G.once[key]) return; G.once[key] = true; pushMsg(from, text); }
function fireEvent(ev) { for (const m of G.msgQ) if (!m.sent && m.on === ev) { m.sent = true; pushMsg(m.from, m.text); } }
function updateMessages() { for (const m of G.msgQ) if (!m.sent && m.t != null && G.time >= m.t) { m.sent = true; pushMsg(m.from, m.text); } }
function onChaseStart(e) {
  if (e.dist() < 12) { AU.sting(); glitch(0.25); }
  if (CHASE_LINE[e.id]) pushMsgOnce('chase-' + e.id, e.id, CHASE_LINE[e.id]);
}

/* ---------------- office: doors, lights, power, cameras ---------------- */
function toggleDoor(k) {
  const d = WORLD.doors[k];
  if (WORLD.power <= 0) { AU.buzz(); toast('אין חשמל לדלתות'); return; }
  if (d.broken > 0) { AU.buzz(); toast('הדלת שבורה'); return; }
  if (!d.closed) {
    if (toTile(P.x) === d.tx && toTile(P.z) === d.ty) { toast('אי אפשר לסגור כשאתה בפתח'); return; }
    for (const e of ENEMIES) if (e.active && e.tx() === d.tx && e.ty() === d.ty) { e.x = tc(d.ox); e.z = tc(d.oy); e.path = null; }
  }
  d.closed = !d.closed; AU.servo(d.closed); if (d.closed) setTimeout(() => AU.doorSlam(), 320);
  updateOfficeUI();
}
function toggleDoorLight(k) {
  if (WORLD.power <= 0) { AU.buzz(); return; }
  WORLD.doorLight = WORLD.doorLight === k ? null : k; AU.beep(600, 0.05);
  const d = OFFICE_DOORS[k]; LIGHTS.door.l.position.set(tc(d.ox), 2.6, tc(d.oy)); updateOfficeUI();
}
function officeAction(o) {
  if (G.mode !== 'play') return;
  ({ 'door-w': () => toggleDoor('w'), 'light-w': () => toggleDoorLight('w'), cams: openCCTV, 'light-e': () => toggleDoorLight('e'), 'door-e': () => toggleDoor('e') })[o]();
}
function updateOfficeUI() {
  const ob = $('#officebar');
  ob.querySelector('[data-o="door-w"]').classList.toggle('on', WORLD.doors.w.closed); ob.querySelector('[data-o="door-e"]').classList.toggle('on', WORLD.doors.e.closed);
  ob.querySelector('[data-o="light-w"]').classList.toggle('lit', WORLD.doorLight === 'w'); ob.querySelector('[data-o="light-e"]').classList.toggle('lit', WORLD.doorLight === 'e');
}
function updatePower(dt) {
  if (WORLD.power <= 0) return;
  let d = 0.05; if (WORLD.doors.w.closed) d += 0.32; if (WORLD.doors.e.closed) d += 0.32; if (WORLD.doorLight) d += 0.12; if (G.mode === 'cctv') d += 0.1;
  WORLD.power = Math.max(0, WORLD.power - d * dt);
  if (WORLD.power <= 0) blackout();
}
function blackout() {
  WORLD.power = 0; WORLD.genOn = false; WORLD.doors.w.closed = false; WORLD.doors.e.closed = false; WORLD.doorLight = null;
  if (G.mode === 'cctv') closeCCTV();
  AU.powerDown(); setPowerVisuals(); flicker(1.2); updateOfficeUI();
  pushMsg('boss', WORLD.fuses ? 'החשמל נגמר! הדלתות נפתחו. תפעיל מחדש את הגנרטור בחדר הגנרטור.' : 'גם הסוללה של חדר הביטחון נגמרה. תמהר עם הנתיכים.');
}
function updateDoors(dt) {
  for (const k of ['w', 'e']) {
    const d = WORLD.doors[k]; d.y = lerp(d.y, d.closed ? 0 : 2.6, 1 - Math.exp(-dt * 9));
    let off = 0; if (d.hit > 0) { d.hit -= dt; off = rand(-0.04, 0.04); }
    d.mesh.position.set(tc(d.tx) + off, d.y + 1.3, tc(d.ty));
    if (d.broken > 0) d.broken -= dt;
    const b = WORLD.buttons[k]; b.door.material = d.closed ? MAT.btnRed : MAT.btnOff; b.light.material = WORLD.doorLight === k ? MAT.btnWhite : MAT.btnDim;
  }
}
const _col = window.THREE ? new THREE.Color() : null;
function setPowerVisuals() {
  const fx = WORLD.fixtures;
  WORLD.fixtureState.forEach((s, i) => { _col.setScalar(WORLD.genOn && s !== 'dead' ? 2.2 : 0.06); fx.setColorAt(i, _col); });
  if (fx.instanceColor) fx.instanceColor.needsUpdate = true;
  WORLD.monitors.forEach(m => { m.visible = WORLD.power > 0; }); WORLD.genPanel.visible = WORLD.genOn;
  AU.setHum(WORLD.genOn);
}
function openCCTV() {
  if (G.mode !== 'play' || !G.inOffice) return;
  if (WORLD.power <= 0) { AU.buzz(); toast('אין חשמל למצלמות'); return; }
  G.mode = 'cctv'; releasePointer(); setTouchUI(false); $('#tasks').hidden = true; $('#cctv').hidden = false; document.body.classList.add('cctv'); $('#prompt').hidden = true; $('#officebar').hidden = true;
  AU.staticBurst(0.35, 0.2); if (stepIs('cctv')) completeStep();
  buildCamButtons(); switchCam(G.cam);
}
function closeCCTV() { if (G.mode !== 'cctv') return; $('#cctv').hidden = true; document.body.classList.remove('cctv'); G.mode = 'play'; setTouchUI(true); AU.staticBurst(0.15, 0.1); if (!IS_TOUCH) lockPointer(); }
function buildCamButtons() {
  const wrap = $('#ccbtns'); if (wrap.childElementCount) return;
  CAMS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = fmt2(c.id); b.style.left = ((c.p[0] + (c.id === 2 ? -0.7 : c.id === 3 ? 0.7 : 0)) / MW * 100) + '%'; b.style.top = (c.p[1] / MH * 100) + '%'; b.setAttribute('aria-label', c.name); b.onclick = () => switchCam(i); wrap.appendChild(b); });
  drawMapTo($('#ccmap'), { cctv: true });
}
function switchCam(i) {
  G.cam = (i + CAMS.length) % CAMS.length; const c = CAMS[G.cam];
  setText('#cam-name', `CAM ${fmt2(c.id)} · ${c.name}`);
  $$('#ccbtns button').forEach((b, k) => b.classList.toggle('on', k === G.cam));
  const el = $('#cctv'); el.classList.remove('switch'); void el.offsetWidth; el.classList.add('switch'); AU.staticBurst(0.2, 0.12);
}
function cycleCam(d) { switchCam(G.cam + d); }
function updateCCTV() {
  const cam = CCTV_CAMS[G.cam]; let near = false;
  for (const e of ENEMIES) if (e.active && Math.hypot(e.x - cam.position.x, e.z - cam.position.z) < 3.4) near = true;
  $('#cc-signal').classList.toggle('on', near);
}

/* ---------------- map & tasks ---------------- */
function drawMapTo(c, o = {}) {
  const x = c.getContext('2d'), W = c.width, H = c.height, s = Math.min(W / MW, H / MH), ox = (W - s * MW) / 2, oy = (H - s * MH) / 2;
  x.clearRect(0, 0, W, H);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const i = idx(tx, ty); if (!GRID[i]) continue; const r = ROOM_AT[i];
    x.fillStyle = o.cctv ? (r === 'hall' ? 'rgba(125,255,176,.16)' : 'rgba(125,255,176,.3)') : (r === 'office' ? '#3a6a52' : r === 'hall' ? '#262b37' : '#3b4152');
    x.fillRect(ox + tx * s, oy + ty * s, s + 0.6, s + 0.6);
  }
  if (!o.cctv) {
    x.fillStyle = 'rgba(239,232,214,.88)'; x.font = `500 ${Math.max(11, s * 0.5) | 0}px Rubik, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const k in ROOMS) { const R = ROOMS[k]; if (R.at) x.fillText(R.name, ox + R.at[0] * s, oy + R.at[1] * s); }
    for (const k of ['w', 'e']) { const d = WORLD.doors[k]; x.fillStyle = d.closed ? '#e0182f' : 'rgba(239,232,214,.4)'; x.fillRect(ox + (d.tx + 0.4) * s, oy + d.ty * s, s * 0.2, s); }
  }
  return { s, ox, oy, x };
}
function drawMap() {
  const { s, ox, oy, x } = drawMapTo($('#mapc'));
  for (const p of objectiveTargets()) {
    const px = ox + p.x / T * s, pz = oy + p.z / T * s;
    x.fillStyle = '#ffb547'; x.beginPath(); x.arc(px, pz, s * 0.3, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,181,71,.55)'; x.lineWidth = 2; x.beginPath(); x.arc(px, pz, s * 0.62, 0, 7); x.stroke();
  }
  const px = ox + P.x / T * s, pz = oy + P.z / T * s;
  x.save(); x.translate(px, pz); x.rotate(-P.yaw); x.fillStyle = '#efe8d6'; x.beginPath(); x.moveTo(0, -s * 0.6); x.lineTo(s * 0.4, s * 0.42); x.lineTo(-s * 0.4, s * 0.42); x.closePath(); x.fill(); x.restore();
}
function toggleMap() {
  if (G.mode === 'map') { $('#mapview').hidden = true; G.mode = 'play'; setTouchUI(true); if (!IS_TOUCH) lockPointer(); return; }
  if (G.mode !== 'play') return;
  G.mode = 'map'; releasePointer(); setTouchUI(false); $('#mapview').hidden = false; drawMap();
}
function toggleTasks() {
  const t = $('#tasks'); if (!t.hidden) { t.hidden = true; return; }
  if (G.mode !== 'play' || !G.N) return;
  setText('#tk-title', `לילה ${G.night} · ${G.N.title}`);
  const ol = $('#tk-steps'); ol.innerHTML = '';
  G.steps.forEach((s, i) => { const li = document.createElement('li'); li.textContent = stepText(s); li.className = s.done ? 'done' : i === G.step ? 'now' : ''; ol.appendChild(li); });
  const ul = $('#tk-log'); ul.innerHTML = '';
  if (!G.log.length) { const li = document.createElement('li'); li.textContent = 'אין הודעות עדיין.'; ul.appendChild(li); }
  G.log.slice(0, 12).forEach(m => { const li = document.createElement('li'), b = document.createElement('b'); b.textContent = m.name + ': '; li.append(b, document.createTextNode(m.text)); ul.appendChild(li); });
  t.hidden = false;
}

/* ---------------- modals: notes, keypad, cards ---------------- */
function openModal(mode) { G.mode = mode; releasePointer(); setTouchUI(false); $('#tasks').hidden = true; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; if (G.mode === 'note' || G.mode === 'keypad') { G.mode = 'play'; setTouchUI(true); if (!IS_TOUCH) lockPointer(); } }
function showNote(title, text) {
  if (G.mode !== 'play') return;
  const box = $('#md-box'); box.innerHTML = '<div class="paper"><h3></h3><p></p><div class="btns close"><button class="btn small" id="note-close">סגירה</button></div></div>';
  box.querySelector('h3').textContent = title; box.querySelector('p').textContent = text; $('#note-close').onclick = closeModal;
  openModal('note'); AU.creak();
}
function showCard(id) {
  if (G.mode !== 'play') return;
  const box = $('#md-box'); box.innerHTML = ''; const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center';
  const p = document.createElement('p'); p.style.margin = '0'; p.textContent = `מצאת קלף שחקן · ${PROGRESS.cards.length}/6`;
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'סגירה'; b.onclick = closeModal;
  w.append(cardEl(castDef(id), true), p, b); box.appendChild(w); openModal('note'); AU.objective();
}
function openKeypad() {
  G.entry = '';
  const box = $('#md-box');
  box.innerHTML = `<div class="keypad"><div class="kp-screen" id="kp-screen"></div><div class="kp-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(k => `<button data-k="${k}" class="${k === 'OK' ? 'ok' : k === 'C' ? 'c' : ''}" aria-label="${k === 'C' ? 'מחיקה' : k === 'OK' ? 'אישור' : k}">${k === 'C' ? '⌫' : k === 'OK' ? '✓' : k}</button>`).join('')}</div><p class="kp-hint">הקוד כתוב על הפתק שמצאת</p><div class="btns" style="justify-content:center;margin-top:10px"><button class="btn ghost small" id="kp-close">סגירה</button></div></div>`;
  box.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => keypadPress(String(b.dataset.k)); });
  $('#kp-close').onclick = closeModal; openModal('keypad'); renderKp();
}
function renderKp() { const el = $('#kp-screen'); if (el) el.textContent = (G.entry + '____').slice(0, 4); }
function keypadPress(k) {
  if (k === 'C') G.entry = G.entry.slice(0, -1);
  else if (k === 'OK') {
    if (G.entry === G.code) { AU.objective(); closeModal(); toast('הכספת נפתחה. לקחת את הכרטיס של המקפיא'); completeStep(); return; }
    AU.buzz(); G.entry = ''; const el = $('#kp-screen'); el.classList.remove('err'); void el.offsetWidth; el.classList.add('err');
  } else if (G.entry.length < 4) { G.entry += k; AU.beep(900 + G.entry.length * 140, 0.08); }
  renderKp();
}

/* ---------------- death, dawn, clock-out, escape ---------------- */
function stopLoops() { AU.setMusic(false); for (const e of ENEMIES) if (e.engine) AU.setEngine(e.engine, 0); }
function leaveGameUI() { releasePointer(); setTouchUI(false); document.body.classList.remove('cctv'); for (const s of ['#hud', '#cctv', '#tasks', '#mapview', '#modal', '#locker']) $(s).hidden = true; }
function killPlayer(e) {
  if (G.mode !== 'play' && G.mode !== 'cctv') return;
  G.mode = 'jump'; G.killer = e; leaveGameUI(); stopLoops();
  const u = ART.scareURL[e.id]; ['#j1', '#j2', '#j3'].forEach(s => { $(s).src = u; });
  const j = $('#jump'); j.hidden = false; j.classList.remove('go'); void j.offsetWidth; j.classList.add('go');
  AU.scream(); try { if (navigator.vibrate) navigator.vibrate([250, 80, 400]); } catch (err) { }
  setTimeout(() => { j.hidden = true; j.classList.remove('go'); showDead(e); }, 1700);
}
function showDead(e) {
  G.mode = 'dead'; setText('#dead-kicker', `לילה ${G.night} · ${fmtClock()}`);
  $('#dead-img').src = ART.scareURL[e.id]; setText('#dead-title', `${castName(e.id)} תפס אותך`);
  setText('#dead-line', `״${e.c.kill}״`); setText('#dead-tip', 'טיפ: ' + e.c.tip); showScreen('dead');
}
function timeUp() {
  G.mode = 'dead'; leaveGameUI(); stopLoops(); AU.punch();
  $('#dead-img').src = SUNRISE; setText('#dead-kicker', `לילה ${G.night} · 06:00`); setText('#dead-title', 'הבוקר הגיע');
  setText('#dead-line', 'השמש עלתה והמשימות של הלילה לא הושלמו.'); setText('#dead-tip', 'טיפ: המפה מסמנת בכתום איפה המשימה הבאה. פותחים אותה עם M או עם כפתור המפה.');
  showScreen('dead');
}
function finishNight() {
  G.mode = 'done'; leaveGameUI(); stopLoops(); AU.punch();
  const n = G.night; PROGRESS.done[n] = true; PROGRESS.unlocked = Math.max(PROGRESS.unlocked, Math.min(5, n + 1)); saveProgress();
  setText('#done-title', `לילה ${n} · המשמרת הושלמה`); setText('#d-out', fmtClock()); setText('#d-dist', `${Math.round(P.dist)} מ׳`);
  setText('#d-close', String(G.stats.close)); setText('#d-cards', `${PROGRESS.cards.length}/6`);
  $('#btnNext').hidden = n >= 5; showScreen('done'); renderNightCards();
}
function escapeNight() {
  G.mode = 'escape'; G.escapeT = 0; G.escapeStart = performance.now(); leaveGameUI(); $('#prompt').hidden = true; stopLoops(); AU.powerUp();
  for (const e of ENEMIES) { e.vx = e.vz = 0; }
  PROGRESS.done[5] = true; PROGRESS.won = true; PROGRESS.unlocked = 5; saveProgress();
}
function escapeTick(dt) {
  G.escapeT = (performance.now() - G.escapeStart) / 1000; const g = WORLD.gate; g.y = Math.min(3.3, G.escapeT * 1.25); g.mesh.position.y = 1.58 + g.y;
  const ty = Math.atan2(-(19.5 - P.x), -(69 - P.z)); P.yaw = lerpAngle(P.yaw, ty, 1 - Math.exp(-dt * 2.5)); P.pitch = lerp(P.pitch, 0.05, 1 - Math.exp(-dt * 2.5));
  placeCamera(P.x, P.z, P.eye, dt);
  const L = LIGHTS.door.l; L.color.setHex(0xffe2b0); L.position.set(19.5, 1.8, 67); L.distance = 32; L.intensity = Math.min(4, G.escapeT * 1.5);
  hemi.intensity = 0.22 + Math.min(1.2, G.escapeT * 0.3);
  if (G.escapeT > 3.2 && !G.whiteOn) { G.whiteOn = true; $('#flashwhite').classList.add('on'); }
  if (G.escapeT > 4.4) showEnding();
}
function showEnding() {
  G.mode = 'ending'; $('#flashwhite').classList.remove('on');
  const cr = $('#credits'); cr.innerHTML = '';
  for (const c of CAST) { const d = document.createElement('div'), img = document.createElement('img'), b = document.createElement('b'), sm = document.createElement('small'); d.className = 'credit'; img.src = ART.faceURL[c.id]; img.alt = ''; b.textContent = castName(c.id); sm.textContent = c.ability; d.append(img, b, sm); cr.appendChild(d); }
  showScreen('ending'); renderNightCards();
}
function quitToMenu() {
  G.mode = 'title'; leaveGameUI(); stopLoops(); $('#jump').hidden = true;
  for (const e of ENEMIES) e.reset(); if (riderSpot) riderSpot.intensity = 0;
  setText('#t-status', statusLine()); renderNightCards(); showScreen('title');
}
function pauseGame() {
  if (G.mode !== 'play' && G.mode !== 'cctv') return;
  G.prevMode = G.mode; if (G.mode === 'cctv') { $('#cctv').hidden = true; document.body.classList.remove('cctv'); }
  G.mode = 'pause'; releasePointer(); setTouchUI(false);
  setText('#pause-kicker', `לילה ${G.night} · ${fmtClock()}`); const s = curStep(); setText('#pause-tasks', s ? 'המשימה עכשיו: ' + stepText(s) : '');
  showScreen('pause');
}
function resumeGame() {
  hideScreens();
  if (G.prevMode === 'cctv') { G.mode = 'cctv'; $('#cctv').hidden = false; document.body.classList.add('cctv'); }
  else { G.mode = 'play'; setTouchUI(true); if (!IS_TOUCH) lockPointer(); }
}
const statusLine = () => PROGRESS.won ? 'סיימת את כל חמשת הלילות. אפשר לשחק שוב ברמת סיוט.' : 'בחרו לילה כדי להתחיל. בלשונית "הצוות" אפשר לתת לחברים שמות ותמונות.';

/* ---------------- per-frame systems ---------------- */
function updateInteraction(dt) {
  let best = null;
  if (P.hidden) best = { label: () => 'לצאת מהלוקר', use: exitLocker };
  else {
    let bs = 1e9; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const it of INTER) {
      if (it.enabled && !it.enabled()) continue;
      const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz); if (d > it.r) continue;
      const dot = (dx * fx + dz * fz) / (d || 1); if (d > 0.9 && dot < 0.3) continue;
      const sc = d - dot * 0.9 - (it.temp ? 0.6 : 0); if (sc < bs) { bs = sc; best = it; }
    }
  }
  G.focus = best;
  const hold = best ? ((typeof best.hold === 'function' ? best.hold() : best.hold) || 0) : 0;
  if (best && INPUT.inter) {
    if (hold > 0) {
      if (G.holdTarget !== best) { G.holdTarget = best; G.holdT = best.keep ? (best.prog || 0) : 0; }
      G.holdT += dt; if (best.keep) best.prog = G.holdT;
      if (best.holding) best.holding(dt, G.holdT / hold);
      if (G.holdT >= hold) { G.holdT = 0; G.holdTarget = null; INPUT.inter = false; if (best.keep) best.prog = 0; best.use(); }
    } else if (INPUT.interPressed) best.use();
  } else { G.holdT = 0; G.holdTarget = null; }
  INPUT.interPressed = false;
  const pr = $('#prompt');
  if (best && G.mode === 'play') {
    pr.hidden = false; setText('#prompt-text', (hold > 0 ? 'להחזיק · ' : '') + best.label()); setText('#prompt-key', IS_TOUCH ? '✋' : 'E');
    const holding = hold > 0 && G.holdTarget === best; pr.classList.toggle('hold', holding); pr.style.setProperty('--p', holding ? (G.holdT / hold).toFixed(3) : '0');
  } else pr.hidden = true;
}
function updateRoom() {
  const r = roomAtW(P.x, P.z); if (r && r !== G.lastRoom) { G.lastRoom = r; if (r !== 'hall') showLoc(ROOMS[r].name); }
  G.inOffice = !P.hidden && inOfficeArea(P.x, P.z);
}
function updateFear(dt) {
  let f = 0;
  for (const e of ENEMIES) {
    if (!e.active) continue; const d = e.dist(), seen = d < 12 && los(P.x, P.z, e.x, e.z);
    const v = seen ? clamp((11 - d) / 8, 0, 1) : clamp((6 - d) / 5, 0, 1) * 0.55; if (v > f) f = v;
  }
  if (P.hidden) f *= 0.6;
  G.fear = lerp(G.fear, f, 1 - Math.exp(-dt * 3));
  if (G.fear > 0.8) G.stats.wasNear = true; else if (G.fear < 0.25 && G.stats.wasNear) { G.stats.wasNear = false; G.stats.close++; }
  G.hb -= dt; if (G.fear > 0.18 && G.hb <= 0) { G.hb = lerp(1.1, 0.36, G.fear); AU.heartbeat(0.25 + G.fear * 0.55); }
  document.documentElement.style.setProperty('--fear', G.fear.toFixed(3));
}
function updateItemsAnim(dt, t) {
  for (const it of ITEMS) {
    if (it.taken || !it.g.parent || it.kind === 'decal') continue;
    if (it.kind === 'cambox') { it.g.userData.led.visible = Math.sin(t * 6) > 0; continue; }
    it.g.position.y = 0.05 + Math.sin(t * 2 + it.t) * 0.04; it.g.rotation.y += dt * 0.6;
    const gl = it.g.userData.glint; if (gl) gl.material.opacity = 0.35 + Math.sin(t * 3 + it.t) * 0.25;
  }
}
let _fxT = 0;
function updateLights(dt, t) {
  for (const k in LIGHTS) {
    const o = LIGHTS[k];
    if (k === 'door') { o.l.intensity = WORLD.doorLight && WORLD.power > 0 ? 1.8 : 0; continue; }
    let I = o.base;
    if (o.power && !WORLD.genOn) I = o.emergency ? 0.45 : 0;
    if (o.ups && WORLD.power <= 0) I = 0.1;
    if (o.flicker && WORLD.genOn) { if (o.fl > 0) { o.fl -= dt; I *= Math.random() < 0.5 ? 0.12 : 1; } else if (Math.random() < o.flicker * dt * 0.6) o.fl = rand(0.08, 0.5); }
    if (o.disco) o.l.color.setHSL((t * 0.12) % 1, 0.85, 0.55);
    if (o.emergency) o.l.color.setHex(WORLD.genOn ? 0xff8a3a : 0xff2020);
    if (G.flickerT > 0) I *= Math.random() < 0.45 ? 0.05 : 1;
    o.l.intensity = I;
  }
  _fxT -= dt;
  if (_fxT <= 0 && WORLD.fixtures) {
    _fxT = 0.09; const fx = WORLD.fixtures; let ch = false;
    WORLD.fixtureState.forEach((s, i) => {
      if (!WORLD.genOn || s === 'dead') return;
      if (s === 'flicker' || G.flickerT > 0) { _col.setScalar(Math.random() < 0.25 ? 0.08 : 2.2); fx.setColorAt(i, _col); ch = true; }
      else if (G._wasFlick) { _col.setScalar(2.2); fx.setColorAt(i, _col); ch = true; }
    });
    G._wasFlick = G.flickerT > 0;
    if (ch && fx.instanceColor) fx.instanceColor.needsUpdate = true;
  }
}
function updateProps(dt, t) {
  const c = WORLD.conveyor;
  if (c && (WORLD.genOn || !c.init)) {
    c.init = true; if (WORLD.genOn) c.off = (c.off + dt * 0.55) % c.L;
    for (let i = 0; i < c.N; i++) { const x = c.x0 + ((i / c.N) * c.L + c.off) % c.L, z = c.cz + (i % 2 ? 0.25 : -0.25); c.m.makeTranslation(x, 1.12, z); c.body.setMatrixAt(i, c.m); c.m.makeTranslation(x, 1.31, z); c.neck.setMatrixAt(i, c.m); }
    c.body.instanceMatrix.needsUpdate = true; c.neck.instanceMatrix.needsUpdate = true;
  }
  if (WORLD.fan && WORLD.power > 0) WORLD.fan.rotation.z += dt * 14;
  if (WORLD.disco) WORLD.disco.rotation.y += dt * 0.8;
  for (const v of WORLD.valves) if (v.open && v.spin < 9) { v.spin += dt * 5; v.wheel.rotation.z = v.spin; }
  G.gateBlink = Math.max(0, G.gateBlink - dt);
  const blink = G.gateBlink > 0 && Math.sin(t * 12) > 0; WORLD.gateLights.forEach(m => { m.material = blink ? MAT.slotOn : MAT.amber; });
  for (const d of WORLD.milk) if (d.life > 0) { d.life -= dt; if (d.life <= 0) d.m.visible = false; }
}
function updateAudio(dt) {
  if (!AU.ctx) return;
  AU.listen(camera.position.x, camera.position.y, camera.position.z, -Math.sin(P.yaw), -Math.cos(P.yaw));
  AU.musicTick();
  const host = ENEMIES.find(e => e.id === 'host');
  AU.setMusic(!!host && (host.state === 'sit' || host.state === 'waiting'));
  G.occT = (G.occT || 0) - dt;
  if (G.occT <= 0) { G.occT = 0.3; if (G.speaker) AU.place(G.speaker, 55.7, 1.2, 24.7, !los(P.x, P.z, 55.7, 25.6)); if (G.genEm) AU.place(G.genEm, 18, 1, 45, !los(P.x, P.z, 21.6, 45)); }
  if (G.genHum) G.genHum.gain.setTargetAtTime(WORLD.genOn ? 0.22 : 0, AU.now(), 0.3);
  AU.ambienceTick(dt, true);
}
const _hudMeter = {};
function meter(sel, v) {
  const q = Math.round(v); if (_hudMeter[sel] === q) return; _hudMeter[sel] = q;
  const el = $(sel); el.querySelector('b').style.setProperty('--v', (v / 100).toFixed(3)); el.querySelector('em').textContent = q + '%'; el.classList.toggle('low', v < 20);
}
function updateHUD(force) {
  const now = performance.now(); if (!force && now - G.hudT < 100) return; G.hudT = now;
  const clock = fmtClock(); setText('#h-time', clock); setText('#cam-time', clock); setText('#cam-pow', `PWR ${Math.round(WORLD.power)}%`);
  setText('#h-night', `לילה ${G.night} · ${G.N ? G.N.title : ''}`);
  meter('#m-batt', P.battery); meter('#m-pow', WORLD.power);
  const s = curStep(); setText('#obj-step', s ? `משימה ${G.step + 1}/${G.steps.length}` : 'הכול הושלם'); setText('#obj-text', s ? stepText(s) : '');
  $('#stam b').style.width = (P.stam * 100).toFixed(1) + '%'; $('#stam').classList.toggle('show', P.stam < 0.98);
  const ob = $('#officebar'), show = G.inOffice && G.mode === 'play'; if (ob.hidden === show) ob.hidden = !show; if (show) updateOfficeUI();
}

/* grain overlay */
const GR = { x: null, img: null, f: 0 };
function grainTick() {
  if (!GR.x) { const c = $('#grain'); GR.x = c.getContext('2d'); GR.img = GR.x.createImageData(c.width, c.height); }
  if (++GR.f % 2) return; const d = GR.img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  GR.x.putImageData(GR.img, 0, 0);
}

/* ---------------- render & loop ---------------- */
function renderScene() {
  if (G.mode === 'cctv') {
    const cam = CCTV_CAMS[G.cam], fi = flash.intensity;
    hemi.intensity = 1.25; hemi.color.setHex(0x9dffc0); hemi.groundColor.setHex(0x203a28); scene.fog.density = 0.026; scene.fog.color.setHex(0x031208); scene.background.setHex(0x031208); flash.intensity = 0;
    renderer.render(scene, cam);
    hemi.intensity = 0.22; hemi.color.setHex(0x3a4a70); hemi.groundColor.setHex(0x140c08); scene.fog.density = 0.058; scene.fog.color.setHex(0x020306); scene.background.setHex(0x020306); flash.intensity = fi;
  } else renderer.render(scene, camera);
}
function simulate(dt, t) {
  G.time += dt; G.hour = G.time / diff().hour;
  if (G.hour >= 6) { timeUp(); return; }
  G.spdMul = diff().spd * (1 + Math.min(G.hour, 5) * 0.045);
  G.flickerT = Math.max(0, G.flickerT - dt);
  if (G.mode === 'play') updatePlayer(dt); else placeCamera(P.x, P.z, P.eye, dt);
  updateFlashlight(dt); updatePower(dt); updateDoors(dt);
  updateEnemies(dt); NOISES.length = 0;
  if (G.mode !== 'play' && G.mode !== 'cctv') return;
  updateRoom(); if (G.mode === 'play') updateInteraction(dt); else $('#prompt').hidden = true;
  updateGoto(); updateFear(dt); updateMessages(); updateItemsAnim(dt, t); updateLights(dt, t); updateProps(dt, t); updateDust(dt, t);
  updateAudio(dt); updateHUD(); if (G.mode === 'cctv') updateCCTV();
}
const STATIC_MODES = new Set(['pause', 'map', 'note', 'keypad', 'jump']);
let _last = performance.now(), _fpsT = 0, _fpsN = 0, _fc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - _last) / 1000; _last = now; dt = Math.min(dt, 0.1); const sdt = Math.min(dt, 0.05), t = now / 1000; _fc++;
  const live = G.mode === 'play' || G.mode === 'cctv';
  if (live) simulate(sdt, t); else if (G.mode === 'escape') escapeTick(dt);
  if (live || G.mode === 'escape') { renderScene(); grainTick(); }
  else if (STATIC_MODES.has(G.mode) && _fc % 12 === 0) { renderScene(); grainTick(); }
  if (live) {
    _fpsT += dt; _fpsN++;
    if (_fpsT > 2.5) { const fps = _fpsN / _fpsT; _fpsT = 0; _fpsN = 0; if (fps < 32 && dynScale > 0.55) { dynScale *= 0.85; resize(); } else if (fps > 56 && dynScale < 1) { dynScale = Math.min(1, dynScale * 1.1); resize(); } }
  }
}

/* ---------------- boot ---------------- */
function initUI() {
  if (IS_TOUCH) document.body.classList.add('touch');
  $('#btnCast').onclick = () => { renderCast(); $('#castNote').textContent = ''; G.back = 'title'; showScreen('cast'); };
  $('#btnHow').onclick = () => { G.back = 'title'; showScreen('how'); };
  $('#btnSet').onclick = () => { G.back = 'title'; renderSettings(); showScreen('settings'); };
  $$('[data-back]').forEach(b => { b.onclick = () => { if (G.back === 'pause') showScreen('pause'); else { setText('#t-status', G.ready ? statusLine() : $('#t-status').textContent); renderNightCards(); showScreen('title'); } }; });
  $('#btnClockIn').onclick = () => { AU.init(); AU.punch(); startNight(G.night); };
  $('#btnIntroBack').onclick = () => { G.mode = 'title'; showScreen('title'); };
  $('#btnResume').onclick = resumeGame;
  $('#btnPauseHow').onclick = () => { G.back = 'pause'; showScreen('how'); };
  $('#btnPauseSet').onclick = () => { G.back = 'pause'; renderSettings(); showScreen('settings'); };
  $('#btnRestart').onclick = () => startNight(G.night);
  $('#btnQuit').onclick = quitToMenu;
  $('#btnRetry').onclick = () => { if (NIGHTS[G.night - 1]) startNight(G.night); };
  $('#btnDeadMenu').onclick = quitToMenu;
  $('#btnNext').onclick = () => selectNight(Math.min(5, G.night + 1));
  $('#btnDoneMenu').onclick = quitToMenu; $('#btnEndMenu').onclick = quitToMenu;
  $('#btn-pause').onclick = pauseGame;
  $('#camPrev').onclick = () => cycleCam(-1); $('#camNext').onclick = () => cycleCam(1); $('#camClose').onclick = closeCCTV;
  $('#mapClose').onclick = toggleMap; $('#tasksClose').onclick = toggleTasks;
  $$('#officebar button').forEach(b => { b.onclick = () => officeAction(b.dataset.o); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && G.mode === 'note') closeModal(); });
  $('#mapview').addEventListener('click', e => { if (e.target.id === 'mapview') toggleMap(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  initSettingsUI(); initEditor();
}
async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const sample = 'אבגדהו abc 0123';
  const all = Promise.all(['700 40px Karantina', '500 20px Rubik', '700 20px Rubik', '900 20px Rubik', '20px "Share Tech Mono"', '700 20px "Amatic SC"'].map(f => document.fonts.load(f, sample).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(r, 3000))]);
}
async function boot() {
  initUI(); startSky(); showScreen('title'); renderNightCards();
  await loadFonts();
  if (!window.THREE) { const s = $('#t-status'); s.textContent = 'מנוע התלת־ממד לא נטען. בדקו את החיבור לאינטרנט ורעננו את הדף.'; s.classList.add('err'); return; }
  if (!initRenderer()) { const s = $('#t-status'); s.textContent = 'הדפדפן הזה לא תומך ב־WebGL, ולכן המשחק לא יכול לרוץ כאן. נסו בכרום או בספארי מעודכנים.'; s.classList.add('err'); return; }
  BOSS_AVATAR = makeBossAvatar(); SUNRISE = makeSunrise();
  await buildAllFaces();
  buildWorld(); buildInteractables(); buildEnemies(); initInput();
  resetPlayer(); placeCamera(P.x, P.z, P.eye, 0.016);
  try { renderer.compile(scene, camera); } catch (e) { }
  G.ready = true; G.mode = 'title'; setText('#t-status', statusLine()); renderNightCards();
  window.__starry = { G, P, WORLD, ENEMIES, startNight, killPlayer };
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
