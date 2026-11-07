// Chapter nine, mission 3, "הנמל השחור". Night and heavy rain at the abandoned port at the end of the death
// road. Three go in (Nehorai, Erez, Ido) while the other six wait by the wall outside the west gate; Ido
// opens the gate. Then the five goals, in order: the control tower (the search light on it sweeps the yard:
// stand in its circle and the alarm goes, and a guard who sees you calls it in unless he is marked first),
// the alarm panel at the top of the tower, the access card in the office of warehouse 3 (a charge on the
// way, warned; two of the Order come running after the card), the passage in the wall of containers (the
// card at the reader on the false back of the blue container; a second charge on the quay; a siren in the
// corner as it opens), and the friends gathered at the entrance (they run the length of the south quay,
// two guards after them, Nehorai covers them). Then the elevator: all nine in, the door shuts, it goes
// down, stops, the doors lock, the Shadow on the speakers ("ברוכים הבאים לשלב הבא."), the sleeping gas,
// and the screen goes black: mission 37 wakes them in the cells. Paint, never blood; whoever is marked
// sits down. The gang stays loyal to the last man; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { near, say, nearestGuard } from './missions.js';
import { TEAM, endCrew, Blast, Work, Job, attempt } from './phoenix.js';
import { OUT_AT } from '../combat/paint.js';
import { parkGangCars, dropGangCars, boardAll, unboardAll, Walk, Chatter, IN_RENAULT, armGang, handsTo, reinforce, hunt, hurryHunters, dropGuards, hush } from './phoenix-a.js';

const PT = (game) => game.world.places.port;
const DR = (game) => game.world.places.deathRoad;
const SIX = TEAM.filter((id) => !IN_RENAULT.includes(id));
const OG = Array.from({ length: 16 }, (_, i) => `og${i + 1}`);
// the Order's people on the port's patrols, and who is still posted at each checkpoint (those of the goals
// before it were dealt with on the way)
const POSTS = { og1: 'gate', og2: 'gateLane', og3: 'westRows', og4: 'towerFoot', og5: 'towerTop', og6: 'westQuay', og7: 'office', og8: 'southQuay', og9: 'storage', og10: 'eastQuay' };
const AT_CP = { 0: Object.keys(POSTS), 1: Object.keys(POSTS), 2: ['og3', 'og5', 'og6', 'og7', 'og8', 'og9', 'og10'], 3: ['og7', 'og8', 'og9', 'og10'], 4: ['og8', 'og9', 'og10'], 5: [], 6: [] };
const ALARMED = ['og11', 'og12'];     // they come when the alarm goes
const CHASERS = ['og13', 'og14'];     // after the card
const RAIDERS = ['og15', 'og16'];     // after the friends on the quay
// where the six wait: outside, against the wall south of the gate, out of the yard's sight (world)
const HOLD = [[1536.8, -343.6], [1536.8, -341.6], [1536.8, -339.6], [1534.9, -342.6], [1534.9, -340.6], [1534.9, -338.6]];
// the friends' run from the gate to the corner (site-local: along the gate lane, past the tower, the length
// of the south quay, through the passage), and where the Order comes from when the alarm goes
const RUN = [[-150, -2], [-140, -5], [-124, 4], [-100, 4], [-90, 30], [-88, 47.5], [-60, 47.5], [20, 47.5], [100, 47.5], [118, 56], [128.75, 59.3], [128.75, 62.4], [128.75, 67.9], [128.75, 73], [128.75, 76]];
const SPAWNS = [[-124, -20], [-104, -24], [-92, -40], [-124, 20], [-104, 24], [-75, 30], [-60, 30], [-40, 40], [-10, 40], [30, 47.5], [-92, -60], [60, 47.5]];
// the two charges the Order set off on the way (site-local), each with a second spot on the other way in
const CHARGE_A = [[-84, 64], [-60, 47]], CHARGE_B = [[20.5, 49.6], [63, 64]];

const ARRIVE = [['ארז', 'הנמל השחור. מכבים מנועים, ממשיכים ברגל.'], ['עידו', 'גשם, חושך ופנסים שזזים. בדיוק מזג האוויר שאני אוהב.']];
const OUT = [['ארז', 'השער נעול. עידו?'], ['עידו', 'תן לי כמה שניות עם המנעול.']];
const PLAN = [['ארז', 'נכנסים שלושה: אני, עידו ונהוראי. כל השאר מחכים פה, צמוד לקיר, עד שנקרא להם.'], ['עידו', 'חמישה דברים, לפי הסדר: המגדל, האזעקה, כרטיס גישה מהמשרד, המעבר בקיר המכולות — ואז כולם בכניסה.'], ['ליאם', 'אחים, אנחנו פה. תקראו לנו ואנחנו רצים.'], ['נהוראי', 'קודם המגדל. בשקט.']];
const GATE = [['עידו', 'פתוח. הפנס על המגדל מסתובב — לא להיכנס לעיגול האור.']];
const TOWER = [['עידו', 'המגדל. האזעקה למעלה, בחדר הזכוכית.'], ['ארז', 'יש אחד למעלה, ליד הלוח. לאט במדרגות.']];
const PANEL_OFF = [['עידו', 'האזעקה כבויה. גם הפנס של המגדל.'], ['ארז', 'עכשיו הכרטיס. המשרד במחסן 3, דרומית מכאן.']];
const SIREN_OFF = [['ארז', 'שקט. הסירנה נפסקה.']];
const CALLER = [['עידו', 'הוא מזעיק! לסמן אותו, מהר!']];
const HUSHED = [['ארז', 'סימנת אותו לפני שהזעיק. יפה.']];
const ALARM = [['ארז', 'האזעקה! כל הנמל ער!'], ['עידו', 'שומרים בדרך אלינו! למחסה!']];
const CHARGE1 = [['ארז', 'עיגול אדום! מטען — אחורה!']];
const AFTER1 = [['עידו', 'הם רואים אותנו. יש להם מצלמות בכל פינה.'], ['נהוראי', 'אז שיראו. ממשיכים.']];
const OFFICE = [['עידו', 'המשרד בפינה הדרומית-מזרחית של המחסן. הכרטיס על השולחן.']];
const CARD = [['נהוראי', 'יש כרטיס.'], ['עידו', 'כרטיס של המסדר. עם זה פותחים את המעבר.']];
const CHASE = [['שומר', 'מישהו במשרד! לעצור אותו!'], ['ארז', 'שניים מהפתח הצפוני! לסמן או לברוח!']];
const PASSAGE = [['עידו', 'המעבר בקיר המכולות, בפינה הדרומית-מזרחית. המכולה עם הדלתות הכחולות — הגב שלה הוא דלת.']];
const CHARGE2 = [['ארז', 'עוד מטען! עיגול אדום לפניך — לעצור!']];
const SPOT2 = [['עידו', 'הפנס של המחסנים עליך! הם באים!']];
const OPEN = [['עידו', 'ירוק! הגב נפתח!'], ['ארז', 'ומשהו הפעיל אזעקה בפינה. הם יודעים שאנחנו פה.'], ['נהוראי', 'שידעו. קוראים לכולם.']];
const CALL = [['ארז', 'כולם, הדרך פתוחה! לאורך הרציף הדרומי, ישר לפינה!', 'phone'], ['ליאם', 'אחים, רצים!', 'phone']];
const RAID = [['יונתי', 'שניים מהרציף המזרחי! הם עלינו!', 'phone'], ['נהוראי', 'אני מחפה עליכם! תמשיכו לרוץ!']];
const HERE = { yonati: ['יונתי', 'מישהו צילם אותי רץ? זה היה יפה.'], avraham: ['אברהם', 'אני רוצה לציין שרצתי כל הדרך.'], muller: ['מולר', 'פה.'], dolev: ['דולב', 'הגעתי. אני צריך לשבת.'], hadar: ['הדר', 'Bro, איזה מקום.'], liam: ['ליאם', 'אחים יקרים, כולנו פה.'] };
const ALL_IN = [['ארז', 'כולם פה. תשעה.'], ['עידו', 'מעלית משא. היא לוקחת אותנו למטה, אל המתקן.'], ['נהוראי', 'כולם למעלית.']];
const CAGE = [['נהוראי', 'כולם בפנים?'], ['ארז', 'כולם.']];
const DOWN = [['הדר', 'Bro, זה יורד עמוק.'], ['עידו', 'עשרים מטר... שלושים...']];
const STOPPED = [['ארז', 'למה עצרנו?!']];
const LOCKED = [['עידו', 'הדלתות! הן לא זזות — נעולות!']];
const SHADOW = [['הצל', 'ברוכים הבאים לשלב הבא.']];
const GAS = [['ארז', 'גז! תכסו את הפה!'], ['דולב', 'אני... לא מרגיש את הרגליים...']];
const LAST = [['נהוראי', 'תחזיקו... ביחד...']];
const MARKED = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "בשקט, מאחורי המכולות — ולסמן אותם לפני שהם רואים אותך."';
const LEFT = 'עזבת את הנמל. ארז: "החבורה סומכת עלינו. חוזרים פנימה, ובלי לעזוב אותם."';
const STEPS_OUT = [1, 2, 3, 4, 5, 6];

// ---------- the place ----------
const at = (game, lx, lz, ly = 0, yaw) => { const p = PT(game), w = p.toWorld(lx, lz); return { x: w.x, z: w.z, y: p.y + ly, ...(yaw != null ? { yaw } : {}) }; };
const spot = (game, [x, z], yaw = 0) => ({ x, z, y: PT(game).y, yaw });
// roofs over the yard: no rain inside the warehouses, the tower's room, the passage container, the cage
function underRoof(game) {
  const p = PT(game), W = p.warehouses, c = p.passage.container, e = p.elevator.cage;
  return (x, z, y = p.y) => W.some((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && y < p.y + 7.5) || p.tower.inRoom(x, z, y) ||
    (Math.abs(x - c.x) < 1.25 && Math.abs(z - c.z) < 6.1 && y < p.y + 2.5) || (x > e.x0 && x < e.x1 && z > e.z0 && z < e.z1 && y < p.y + 3);
}
function weather(game) { game.daylight?.set(1, 0); game.fx.rain(true, { strength: 1.1, seconds: 0, under: underRoof(game) }); }
// the port as the site has it, every door, panel and lamp of it
function resetPort(game) {
  const p = PT(game);
  p.gate.lock(); p.gate.setOpen?.(false);
  p.passage.door.lock(); p.passage.door.setOpen?.(false);
  p.elevator.door.unlock(); p.elevator.door.setOpen(true); p.elevator.setLamp(true);
  p.alarm.setOn(true); p.setSearch(true); p.card.put();
  p.cardOffice.door.unlock(); p.cardOffice.door.setOpen(true); p.tower.door.unlock(); p.tower.door.setOpen(true);
}

// ---------- the card reader on the false back, the shaft the cage goes down ----------
function reader(m, game) {
  if (m.reader) return m.reader;
  const p = PT(game), b = p.passage.back, g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.5 }));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#ff3a2a', emissive: '#ff3a2a', emissiveIntensity: 1.6 }));
  led.position.set(0, 0.07, -0.03); g.add(box, led);
  g.position.set(b.x + 0.9, p.y + 1.3, b.z + 0.86); g.rotation.y = Math.PI;
  game.scene.add(g);
  m.reader = { group: g, led, ok(on) { led.material.color.set(on ? '#2fd27a' : '#ff3a2a'); led.material.emissive.set(on ? '#2fd27a' : '#ff3a2a'); } };
  return m.reader;
}
function freeReader(m) { if (!m.reader) return; m.reader.group.removeFromParent(); m.reader.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); m.reader = null; }
// the walls of the shaft round the cage: concrete with a seam every metre and a half; it scrolls up past the
// fence while the cage "goes down" (the cage itself is part of the yard)
function shaft(m, game) {
  if (m.shaft) return m.shaft;
  const p = PT(game), e = p.elevator.cage, cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const c = cv.getContext('2d'); c.fillStyle = '#2a2b2e'; c.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`; c.fillRect(Math.random() * 64, Math.random() * 128, 2, 2); }
  c.fillStyle = '#4a4b4f'; c.fillRect(0, 0, 64, 6); c.fillStyle = '#7a6a3a'; c.fillRect(0, 60, 64, 3);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 3);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const g = new THREE.Group(), H = 4.6, cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2, w = e.x1 - e.x0 + 0.9, d = e.z1 - e.z0 + 0.9;
  for (const [px, pz, ry, len] of [[cx, e.z0 - 0.45, 0, w], [cx, e.z1 + 0.45, 0, w], [e.x0 - 0.45, cz, Math.PI / 2, d], [e.x1 + 0.45, cz, Math.PI / 2, d]]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(len, H), mat); q.position.set(px, p.y + H / 2 - 0.6, pz); q.rotation.y = ry; g.add(q);
  }
  g.visible = false; game.scene.add(g);
  m.shaft = { group: g, tex, mat, run: false, update(dt) { if (this.run) tex.offset.y -= dt * 0.9; } };
  return m.shaft;
}
function freeShaft(m) { if (!m.shaft) return; m.shaft.group.removeFromParent(); m.shaft.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); m.shaft.mat.dispose(); m.shaft.tex.dispose(); m.shaft = null; }

// ---------- the people ----------
function stand(game, id, s, yaw = s.yaw ?? 0) {
  const n = game.npc(id);
  if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; }
  n.floorY = null; n.idle = null; n.posed = false; n.target = null; n.face = null; n.model.setPose(null);
  n.place(s.x, s.z, yaw, s.y ?? null); n.show(true);
}
// the six wait by the wall south of the gate, markers up toward it (out of the squad: they hold)
function holdSix(game) {
  SIX.forEach((id, i) => { stand(game, id, spot(game, HOLD[i]), Math.PI); const n = game.npc(id); n.body.enabled = false; n.lookAt(n.pos.x, n.pos.z - 8); });
}
const squadOf = (game, ids) => { for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; } game.squad.form(ids, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true }); };
const busy = (m) => (m.walks || []).filter((w) => !w.done);
function walkTo(m, game, id, points, opts) { const w = new Walk(game, id, points, opts); m.walks.push(w); return w; }
const gd = (game, id) => game.paint.guards.find((g) => g.npc.id === id) || null;
const standingOf = (game, ids) => ids.map((id) => gd(game, id)).filter((g) => g && !g.marked && g.npc.visible);
// the gang's six friends from wherever they stand to the corner, the length of the yard
function runSix(m, game) {
  const p = PT(game), route = [];
  // the corners of the way, with points every few metres between them (out of sight he is moved on point by point)
  RUN.forEach(([lx, lz], k) => {
    if (k) { const [ax, az] = RUN[k - 1], n = Math.floor(Math.hypot(lx - ax, lz - az) / 7); for (let j = 1; j < n; j++) route.push(at(game, ax + (lx - ax) * j / n, az + (lz - az) * j / n)); }
    route.push(at(game, lx, lz));
  });
  SIX.forEach((id, i) => {
    const pts = [...route, p.entranceSpots[i + 2]];
    walkTo(m, game, id, pts, { run: true, near: 0.9, hurry: true, face: Math.PI / 2, label: 'בדרך לפינה', onDone: () => { m.s.here[id] = true; if (!m.s.quiet) m.chat.add([HERE[id]]); } });
  });
}

// ---------- the alarm: the search light, a guard who calls it in, the siren, those who come ----------
function raiseAlarm(m, game, why) {
  if (m.s.alarm || !PT(game).alarm.on) return;
  m.s.alarm = true; m.s.alarmBy = why; m.s.sirenT = 0; m.s.redT = 0;
  m.calls.clear(); game.hud.setPursuit(null);
  game.sound?.music?.('action');
  game.dialogue.play(ALARM);
  game.hud.banner('', 'אזעקה', why === 'light' ? 'הפנס תפס אותך' : 'שומר הזעיק', 2200);
  // two of the Order from out of sight, 20 to 45 metres off, hunting him
  const me = game.player.pos, pick = SPAWNS.map(([lx, lz]) => at(game, lx, lz)).map((q) => ({ q, d: Math.hypot(q.x - me.x, q.z - me.z) }))
    .sort((a, b) => Math.abs(a.d - 30) - Math.abs(b.d - 30)).filter((c) => c.d > 18 && c.d < 48).slice(0, 2);
  while (pick.length < 2) pick.push({ q: at(game, ...SPAWNS[pick.length]) });
  m.hunters.push(...reinforce(game, ALARMED.map((id, i) => [id, pick[i].q])));
  for (const g of m.hunters) hunt(game, g);
}
function alarmOff(m, game) {
  m.stopSiren?.(); m.stopSiren = null;
  game.fx.redAlert(false, { id: 'port' });
  m.s.alarm = false; m.calls.clear(); game.hud.setPursuit(null);
  game.sound?.music?.('calm');
}
// every frame while the panel still works: the light on the tower, the guards who saw him
function watch(m, game, dt) {
  const p = PT(game), me = game.player.pos;
  if (m.s.alarm) {
    // the siren goes on (in loops) and the red light follows him round the yard
    if ((m.s.sirenT -= dt) <= 0) { m.s.sirenT = 5.6; m.stopSiren?.(); m.stopSiren = game.sound?.siren?.(6, 0.07) || null; }
    if ((m.s.redT -= dt) <= 0) { m.s.redT = 2.5; game.fx.redAlert(true, { id: 'port', at: { x: me.x, z: me.z, y: me.y }, r: 38, height: 4 }); }
    hurryHunters(m.hunters);
    return;
  }
  if (!p.alarm.on || game.mode !== 'foot') return;
  // in the light's circle: a moment to get out of it, then the alarm
  const lit = p.searchSees(me.x, me.z, me.y);
  m.s.beam = lit ? m.s.beam + dt : Math.max(0, m.s.beam - dt * 1.5);
  if (lit && m.s.beam > 1.1) { raiseAlarm(m, game, 'light'); return; }
  // a guard who saw him calls it in unless he is marked first
  let left = Infinity;
  for (const [g, t] of m.calls) {
    if (g.marked) { m.calls.delete(g); m.chat.add(HUSHED); continue; }
    const nt = t - dt; m.calls.set(g, nt); left = Math.min(left, nt);
    if (nt <= 0) { raiseAlarm(m, game, 'guard'); return; }
  }
  game.hud.setPursuit(lit ? 'הפנס עליך! · לצאת מהאור' : left < Infinity ? `שומר מזעיק · ${Math.ceil(left)}` : null);
}
// after the panel: the light over the storage rows still sweeps; caught in it, the nearest come running
function watchLate(m, game, dt) {
  const p = PT(game), me = game.player.pos;
  hurryHunters(m.hunters);
  if (game.mode !== 'foot') return;
  const lit = p.searchSees(me.x, me.z, me.y);
  m.s.beam = lit ? m.s.beam + dt : Math.max(0, m.s.beam - dt * 1.5);
  m.s.spotCool = Math.max(0, (m.s.spotCool || 0) - dt);
  if (lit && m.s.beam > 1.1 && m.s.spotCool <= 0) {
    m.s.spotCool = 15; m.s.beam = 0;
    const near2 = game.paint.standing.filter((g) => g.npc.visible && Math.hypot(g.npc.pos.x - me.x, g.npc.pos.z - me.z) < 45).sort((a, b) => Math.hypot(a.npc.pos.x - me.x, a.npc.pos.z - me.z) - Math.hypot(b.npc.pos.x - me.x, b.npc.pos.z - me.z)).slice(0, 2);
    for (const g of near2) { hunt(game, g); if (!m.hunters.includes(g)) m.hunters.push(g); }
    m.chat.add(SPOT2);
  }
  if (!m.s.alarm) game.hud.setPursuit(lit ? 'הפנס עליך! · לצאת מהאור' : null);
}
// a charge the Order set off on the way: the first of its spots he comes near, a ring and beeps, the blast
function charge(m, game, key, spots, lines) {
  if (m.s[key]) return;
  const me = game.player.pos;
  for (const [lx, lz] of spots) {
    const q = at(game, lx, lz);
    if (Math.hypot(q.x - me.x, q.z - me.z) > 14 || Math.abs(me.y - q.y) > 2) continue;
    m.s[key] = true;
    m.live.push(new Blast(game, { at: q, size: 1.9, warn: 2.6, radius: 4.2, fire: 10 }));
    game.dialogue.play(lines);
    return;
  }
}
function lightning(m, game, dt) { if ((m.s.flashT -= dt) <= 0) { m.s.flashT = 18 + Math.random() * 16; game.fx.lightning({ delay: 1.2 + Math.random(), strength: 0.45 }); } }

// ---------- staging ----------
function clearLive(m, game) {
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  for (const b of m.live || []) b.cancel(); m.live = [];
  for (const w of m.walks || []) w.cancel(); m.walks = [];
  m.work?.cancel(); m.work = null; m.job?.cancel(); m.job = null;
  m.stopSiren?.(); m.stopSiren = null; m.stopGas?.(); m.stopGas = null;
  m.calls?.clear(); m.hunters = [];
  m.chat?.clear();
  if (m.shaft) { m.shaft.run = false; m.shaft.group.visible = false; }
  game.paint.onSpot = null;
  game.hud.setPursuit(null);
  game.fx.clear();
}
// the cars outside the gate: the Renault where the road ends (or its parking bay), the gang's two beside it
function parkCars(game, { atEnd = false } = {}) {
  const p = PT(game), e = DR(game).end;
  unboardAll(game);
  game.car.repair();
  if (atEnd) game.car.place(e.x, e.z, e.yaw, e.y); else game.car.place(p.parking[0].x, p.parking[0].z, p.parking[0].yaw, p.y);
  parkGangCars(game, [{ ...p.parking[1], y: p.y }, { ...p.parking[2], y: p.y }]);
}
function postAll(game, cp) {
  dropGuards(game, OG);
  const list = AT_CP[cp].map((id) => [id, POSTS[id]]);
  if (list.length) postGuardsHere(game, list); else game.paint.reset();
}
// as postGuards does (a route from the place's patrols, a floor kept), then everyone up and the paint wiped
function postGuardsHere(game, list) {
  const p = PT(game), P = game.paint;
  for (const [id, key] of list) {
    const pts = p.patrols[key], n = game.npc(id);
    n.floorY = pts[0].y > p.y + 1 ? pts[0].y : null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null);
    n.place(pts[0].x, pts[0].z, pts[0].yaw ?? 0, pts[0].y); n.show(true);
    P.addGuard(n, pts.map((q) => ({ x: q.x, z: q.z })), undefined, { quick: true, still: pts.length === 1 });
  }
  P.reset();
}
function onSpot(m, game) {
  game.paint.onSpot = (g, foe) => {
    if (!foe?.player || m.s.alarm || !PT(game).alarm.on || m.calls.has(g)) return;
    m.calls.set(g, 3.2);
    game.dialogue.play(CALLER);
  };
}
function fresh(m, game) {
  m.s = { gateOpen: false, alarm: false, alarmBy: null, beam: 0, b1: false, b2: false, panelSaid: false, card: false, chase: false, open: false, opening: 0, raid: false, called: false, here: {}, gathered: false, inCage: false, seq: null, fin: false, sirenT: 0, redT: 0, flashT: 6, quiet: false, spotCool: 0 };
  m.calls = new Map(); m.hunters = [];
}
// a whole scene for a checkpoint (a retry, or a fresh page picking up after a reload)
function stage(m, game, cp) {
  const p = PT(game);
  clearLive(m, game);
  if (game.mode === 'car') game.exitCar();
  game.fx.resetAtmosphere();
  weather(game);
  game.sound?.music?.(cp >= 5 ? 'action' : 'calm');
  resetPort(game);
  fresh(m, game);
  if (cp >= 2) { p.gate.unlock(); p.gate.setOpen(true); m.s.gateOpen = true; }
  if (cp >= 3) { p.alarm.setOn(false); p.searchLights[0].setOn(false); }
  if (cp >= 4) { p.card.take(); m.s.card = true; }
  if (cp >= 5) { p.passage.door.unlock(); p.passage.door.setOpen(true); m.s.open = true; reader(m, game).ok(true); } else reader(m, game).ok(false);
  parkCars(game);
  // Nehorai, and Erez and Ido with him
  const me = cp <= 1 ? { ...p.gateOutside, x: p.gateOutside.x - 1.5 } : cp <= 3 ? { x: p.tower.foot.x + 0.5, z: p.tower.foot.z + 1.8, y: p.y, yaw: Math.PI } : cp === 4 ? { ...p.cardOffice.inside, yaw: Math.PI } : cp === 5 ? { ...p.passage.out, yaw: 0 } : { ...p.entrance, yaw: Math.PI / 2 };
  game.player.place(me.x, me.z, me.yaw, me.y); game.follow.snapBehind(me.yaw);
  if (cp <= 5) for (const [i, id] of IN_RENAULT.entries()) stand(game, id, { x: me.x - Math.sin(me.yaw) * 1.6 + Math.cos(me.yaw) * (i ? 1.4 : -1.4), z: me.z - Math.cos(me.yaw) * 1.6 - Math.sin(me.yaw) * (i ? 1.4 : -1.4), y: me.y }, me.yaw);
  if (cp <= 5) holdSix(game);
  else TEAM.forEach((id, i) => stand(game, id, p.entranceSpots[i], Math.PI / 2));
  squadOf(game, cp <= 5 ? IN_RENAULT : TEAM);
  armGang(game);
  postAll(game, cp);
  onSpot(m, game);
  if (cp === 4) { // two of them come in through the north opening after the card
    m.s.chase = true;
    const o = p.warehouses[0].opening;
    m.hunters.push(...reinforce(game, CHASERS.map((id, i) => [id, { x: o.x - 1.5 + i * 3, z: o.z + 4, y: p.y, yaw: 0 }])));
    for (const g of m.hunters) hunt(game, g);
  }
  if (cp >= 5) { m.s.gathered = cp >= 6; for (const id of SIX) m.s.here[id] = cp >= 6; }
}

export default {
  id: 'blackport', chapter: 9, number: 3, title: 'הנמל השחור', requires: ['deathroad'], follows: true,
  where: 'בשער הנמל',
  startAt: (game) => { const e = game.world.places.deathRoad?.end; return e ? { x: e.x, z: e.z, y: e.y } : null; },
  reward: { money: 1100, unlocks: ['blackport'], text: 'הגעתם למעלית · 1100 ₪' },

  setup(m, game) {
    m.live = []; m.walks = []; m.chat = new Chatter(game); m.reader = null; m.shaft = null;
    const p = PT(game), e = DR(game).end;
    // straight on from the death road: the Renault stopped at the gate with Erez and Ido in it, the two cars
    // behind it. On a fresh page (or a replay) the same, staged
    const ready = game.mode === 'car' && near(game.car.pos, e, 45) && IN_RENAULT.every((id) => game.npc(id).inCar === game.car) && SIX.every((id) => game.npc(id).inCar);
    clearLive(m, game);
    game.fx.resetAtmosphere();
    weather(game);
    resetPort(game);
    fresh(m, game);
    reader(m, game).ok(false);
    if (!ready) {
      if (game.mode === 'car') game.exitCar();
      parkCars(game, { atEnd: true });
      const c = game.car.local(-2.2, 0);
      game.player.place(c.x, c.z, game.car.yaw, p.y);
      game.enterCar();
      boardAll(game);
    } else parkGangCars(game, [{ ...p.parking[1], y: p.y }, { ...p.parking[2], y: p.y }]);
    game.squad.dismiss();
    armGang(game);
    postAll(game, 0);
    onSpot(m, game);
    game.sound?.music?.('calm');
  },
  tick(m, game) { hush(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const e = game.world.places.deathRoad.end; game.daylight?.set(1, 0); game.start(e.x - 2, e.z, e.yaw); },
  failIf(m, game) {
    if (STEPS_OUT.includes(m.stepIndex) && game.paint.hits >= OUT_AT && !m.s.seq) return MARKED;
    const p = PT(game), b = p.bounds, me = game.player.pos;
    const out = Math.max(b.x0 - me.x, me.x - b.x1, b.z0 - me.z, me.z - b.z1);
    if (m.stepIndex >= 1 && out > 45) return LEFT;
    return null;
  },
  restore(m, game, checkpoint) { stage(m, game, checkpoint); },
  cleanup(m, game) {
    const hands = m.done && handsTo(game, 'stolen');
    clearLive(m, game);
    dropGuards(game, OG);
    freeReader(m); freeShaft(m);
    resetPort(game);
    dropGangCars(game);
    if (hands) {
      // the next mission wakes them in the cells under this black screen: the rain, the alarms and the music
      // end here, the lids stay shut and the daze on; the gang keep their markers (mission 37 takes them)
      game.fx.rain(false, { seconds: 0 }); game.fx.redAlert(false); game.sound?.music?.(null, { fade: 0.2 });
      game.player.speedScale = 1;
    } else {
      game.fx.resetAtmosphere();
      unboardAll(game);
      for (const id of TEAM) { const n = game.npc(id); if (n.model.pose === 'down') n.model.setPose(null); }
      endCrew(game);
    }
  },

  steps: [
    { // 0: at the gate, in the Renault: out, the gang out of the cars, the plan, Ido at the lock
      objective: 'שער הנמל · לצאת מהרנו',
      enter(m, game) {
        game.hud.banner('הנמל השחור', 'לילה · גשם', 'שער מערבי', 2600);
        game.fx.lightning({ delay: 1.6, strength: 0.5 });
        if (game.mode === 'car') game.dialogue.play(ARRIVE);
      },
      target(m, game) { const g = PT(game).gateOutside; return game.mode === 'car' ? { x: g.x, z: g.z, y: g.y, r: 2.2 } : null; },
      update(m, game, dt) {
        m.chat.update(dt);
        lightning(m, game, dt);
        if (game.mode === 'car') { say(m, game, 'שער הנמל · לצאת מהרנו'); return null; }
        // out of the cars: Erez and Ido beside Nehorai, the six to the wall
        for (const id of TEAM) { const n = game.npc(id); if (n.inCar) n.stepOut(IN_RENAULT.includes(id) ? (id === 'erez' ? 1 : -1) : 1); }
        squadOf(game, IN_RENAULT);
        SIX.forEach((id, i) => { const s = spot(game, HOLD[i]); walkTo(m, game, id, [s], { run: true, near: 0.5, face: Math.PI, onDone: (n) => { n.body.enabled = false; } }); game.npc(id).body.enabled = false; });
        return 'next';
      },
    },
    { // 1: Ido opens the gate; the first goal: the control tower
      objective: '1. להגיע למגדל הבקרה', checkpoint: true,
      enter(m, game) {
        const p = PT(game), live = attempt(game, m);
        if (!m.s.gateOpen) {
          const lock = { x: p.gate.pos.x - 2.4, z: p.gate.pos.z + 2.9, yaw: Math.PI / 2 };
          m.job = new Job(game, { who: 'ido', at: lock, seconds: 4, label: 'פורץ', pill: 'עידו פורץ את השער', near: 12, onDone: () => {
            if (!live()) return;
            p.gate.unlock(); p.gate.setOpen(true); m.s.gateOpen = true; game.sound?.hit?.('block', 0.7);
            game.hud.toast('השער פתוח', 1400);
            game.dialogue.play(GATE);
          } });
          game.dialogue.play([...OUT, ...PLAN]);
        }
        if (!m.walks.length) holdSix(game);
      },
      target(m, game) { const p = PT(game); if (!m.s.gateOpen) return { x: p.gateOutside.x, z: p.gateOutside.z, y: p.y, r: 2 }; const f = p.tower.foot; return { x: f.x, z: f.z, y: f.y, r: 2.4 }; },
      update(m, game, dt) {
        const p = PT(game), me = game.player.pos;
        m.job?.update(dt); for (const w of m.walks) w.update(dt); m.walks = busy(m);
        m.chat.update(dt); lightning(m, game, dt); watch(m, game, dt);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        say(m, game, !m.s.gateOpen ? '1. להגיע למגדל הבקרה · עידו פותח את השער' : m.s.alarm ? '1. להגיע למגדל הבקרה · אזעקה! שומרים בדרך' : '1. להגיע למגדל הבקרה · בשקט, מחוץ לאור הפנס');
        return m.s.gateOpen && near(me, p.tower.foot, 3.2) && Math.abs(me.y - p.y) < 1.5 ? 'next' : null;
      },
      exit(m, game) { m.job = null; },
    },
    { // 2: up the tower: the alarm panel
      objective: '2. להשבית את האזעקה', checkpoint: true,
      enter(m, game) {
        const p = PT(game), live = attempt(game, m);
        game.dialogue.play(TOWER);
        m.work = new Work(game, { at: p.alarmAt, seconds: 4, label: 'להשבית את האזעקה', pill: 'משבית את האזעקה', near: 1.7, onDone: () => {
          if (!live()) return;
          p.alarm.setOn(false); p.searchLights[0].setOn(false);
          game.sound?.chime?.(true); game.hud.toast('האזעקה כבויה · הפנס של המגדל כבה', 2000);
          const was = m.s.alarm;
          alarmOff(m, game);
          game.dialogue.play(was ? [...SIREN_OFF, ...PANEL_OFF] : PANEL_OFF);
        } });
      },
      target(m, game) {
        const p = PT(game), me = game.player.pos;
        if (me.y < p.y + 1 && !near(me, p.tower.foot, 2.5)) { const f = p.tower.foot; return { x: f.x, z: f.z, y: f.y, r: 2 }; }
        const a = p.alarmAt; return { x: a.x, z: a.z, y: a.y, r: 1.2 };
      },
      interaction(m, game) { const p = PT(game); return game.player.pos.y > p.y + 10 ? m.work?.interaction(game) : null; },
      update(m, game, dt) {
        const p = PT(game), me = game.player.pos;
        if (m.work?.started && me.y < p.y + 10) m.work.started = false; // walked off the top floor
        m.work?.update(dt);
        m.chat.update(dt); lightning(m, game, dt); watch(m, game, dt);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        const up = me.y > p.y + 10;
        say(m, game, m.s.alarm ? '2. להשבית את האזעקה · בראש המגדל, בחדר הזכוכית' : up ? '2. להשבית את האזעקה · הלוח האדום מתחת לחלון' : '2. להשבית את האזעקה · במדרגות, לראש המגדל');
        return !p.alarm.on ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 3: the access card in the office of warehouse 3 (a charge on the way)
      objective: '3. להשיג כרטיס גישה', checkpoint: true,
      enter(m, game) { m.chat.add(OFFICE); },
      target(m, game) {
        const p = PT(game), me = game.player.pos, W = p.warehouses[0], o = p.cardOffice;
        if (me.y > p.y + 1.5) { const f = p.tower.foot; return { x: f.x, z: f.z, y: f.y, r: 2 }; }
        const inW = me.x > W.x0 && me.x < W.x1 && me.z > W.z0 && me.z < W.z1;
        if (!inW) return { x: W.side.x, z: W.side.z, y: p.y, r: 1.6 };
        const inOffice = me.x > o.doorAt.x - 5.2 && me.z > o.doorAt.z + 1.3;
        if (!inOffice) return { x: o.doorAt.x, z: o.doorAt.z, y: p.y, r: 1.2 };
        return { x: o.desk.x, z: o.desk.z, y: p.y, r: 1 };
      },
      interaction(m, game) {
        const p = PT(game);
        if (game.mode !== 'foot' || p.card.taken || !near(game.player.pos, p.cardOffice.desk, 1.6)) return null;
        return { label: 'לקחת את כרטיס הגישה', priority: 6, run: () => {
          p.card.take(); m.s.card = true;
          game.sound?.chime?.(true); game.hud.toast('כרטיס הגישה אצלך', 1800);
          game.dialogue.play(CARD);
        } };
      },
      update(m, game, dt) {
        const p = PT(game);
        m.chat.update(dt); lightning(m, game, dt); watchLate(m, game, dt);
        charge(m, game, 'b1', CHARGE_A, CHARGE1);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        if (m.s.b1 && !m.s.after1 && !m.live.length) { m.s.after1 = true; m.chat.add(AFTER1); }
        say(m, game, p.card.taken ? '3. להשיג כרטיס גישה · יש!' : '3. להשיג כרטיס גישה · המשרד במחסן 3');
        if (!p.card.taken || game.dialogue.busy) return null;
        // the card is gone from the desk: two of them come running in through the north opening
        const o = p.warehouses[0].opening;
        m.s.chase = true;
        m.hunters.push(...reinforce(game, CHASERS.map((id, i) => [id, { x: o.x - 1.5 + i * 3, z: o.z + 4, y: p.y, yaw: 0 }])));
        for (const g of m.hunters) hunt(game, g);
        game.sound?.music?.('action');
        game.dialogue.play(CHASE);
        return 'next';
      },
    },
    { // 4: the passage: the card at the reader on the false back of the blue container
      objective: '4. לפתוח את המעבר למתקן התת-קרקעי', checkpoint: true,
      enter(m, game) { m.chat.add(PASSAGE); },
      target(m, game) {
        const p = PT(game), me = game.player.pos, ch = standingOf(game, CHASERS);
        if (ch.length && ch.some((g) => Math.hypot(g.npc.pos.x - me.x, g.npc.pos.z - me.z) < 16)) return nearestGuard(game, CHASERS);
        const f = p.passage.front, b = p.passage.back;
        if (near(me, f, 6) || (Math.abs(me.x - b.x) < 1.3 && me.z > f.z)) return { x: b.x, z: b.z, y: p.y, r: 0.9 };
        return { x: f.x, z: f.z, y: p.y, r: 1.6 };
      },
      interaction(m, game) {
        const p = PT(game), b = p.passage.back, me = game.player.pos;
        if (game.mode !== 'foot' || m.s.open || m.s.opening || Math.abs(me.x - b.x) > 1.2 || Math.abs(me.z - b.z) > 1.5) return null;
        return { label: 'להעביר את כרטיס הגישה', priority: 6, run: () => { m.s.opening = 1.4; game.sound?.beep?.(2, 1320, 0.12); game.hud.toast('הקורא מאמת…', 1300); } };
      },
      update(m, game, dt) {
        const p = PT(game);
        m.chat.update(dt); lightning(m, game, dt); watchLate(m, game, dt);
        charge(m, game, 'b2', CHARGE_B, CHARGE2);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        if (m.s.opening && (m.s.opening -= dt) <= 0 && !m.s.open) {
          m.s.opening = 0; m.s.open = true;
          reader(m, game).ok(true);
          p.passage.door.unlock(); p.passage.door.setOpen(true);
          game.sound?.chime?.(true); game.sound?.hit?.('block', 0.8);
          game.hud.toast('המעבר פתוח', 1600);
          // the Order knows: a siren and red lights in the corner, a blast over the storage rows behind
          m.stopSiren?.(); m.stopSiren = game.sound?.siren?.(5, 0.06) || null;
          const c = p.entrance; game.fx.redAlert(true, { id: 'corner', at: { x: c.x + 3, z: c.z + 3, y: p.y }, r: 22, height: 3.6 });
          const sb = at(game, 90, 63.5);
          m.live.push(new Blast(game, { at: sb, size: 2.4, warn: 0.6, radius: 0, fire: 14, hurts: false, quiet: true }));
          game.dialogue.play(OPEN);
          return 'next';
        }
        const n = standingOf(game, CHASERS).length;
        say(m, game, n && m.s.chase ? `4. לפתוח את המעבר · ${n === 1 ? 'שומר אחד רודף' : 'שני שומרים רודפים'} אחריך` : '4. לפתוח את המעבר למתקן התת-קרקעי · המכולה הכחולה בקיר המכולות');
        return null;
      },
    },
    { // 5: the friends gathered at the entrance (they run the length of the yard; two of the Order after them)
      objective: '5. לאסוף את החברים בכניסה', checkpoint: true,
      enter(m, game) {
        const p = PT(game);
        game.sound?.music?.('action');
        game.hud.setPursuit(null);
        if (!game.fx.redAlertOn) { const c = p.entrance; game.fx.redAlert(true, { id: 'corner', at: { x: c.x + 3, z: c.z + 3, y: p.y }, r: 22, height: 3.6 }); }
        m.s.called = false; m.s.callT = 0;
        // Erez and Ido to their places at the entrance
        IN_RENAULT.forEach((id, i) => walkTo(m, game, id, [p.passage.out, p.entranceSpots[i]], { run: true, near: 0.6, face: Math.PI / 2, label: 'בכניסה' }));
      },
      target(m, game) {
        const p = PT(game), r = standingOf(game, RAIDERS);
        if (r.length) return nearestGuard(game, RAIDERS);
        return { x: p.entrance.x, z: p.entrance.z, y: p.y, r: 2 };
      },
      update(m, game, dt) {
        const p = PT(game), me = game.player.pos;
        m.chat.update(dt); lightning(m, game, dt);
        for (const w of m.walks) w.update(dt); m.walks = busy(m);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        hurryHunters(m.hunters);
        // the call goes out once the lines of the opening are said
        if (!m.s.called && ((m.s.callT += dt) > 1.5) && !game.dialogue.busy) { m.s.called = true; game.dialogue.play(CALL); runSix(m, game); }
        // halfway along the quay, two of the Order come from the east quay after them
        if (m.s.called && !m.s.raid) {
          const lead = SIX.map((id) => game.npc(id)).sort((a, b) => b.pos.x - a.pos.x)[0];
          if (lead.pos.x > at(game, 40, 0).x || (m.s.raidT = (m.s.raidT || 0) + dt) > 28) {
            m.s.raid = true;
            const g = reinforce(game, RAIDERS.map((id, i) => [id, at(game, 128 + i * 4, 28 + i * 3)]));
            const a = game.paint.allies.find((q) => q.npc === lead);
            for (const x of g) hunt(game, x, a ? { ally: a, pos: lead.pos, yaw: lead.yaw } : null);
            m.hunters.push(...g);
            game.dialogue.play(RAID);
          }
        }
        // a friend marked on the run wipes the paint off and keeps coming
        for (const a of game.paint.allies) {
          if (!a.marked || !SIX.includes(a.npc.id)) continue;
          a.upT = (a.upT || 0) + dt;
          if (a.upT > 2.5) { a.upT = 0; a.marked = false; a.gun.visible = true; a.npc.model.setPose(null); game.hud.toast(`${a.npc.spec.name.split(' ')[0]} מנגב את הצבע וממשיך`, 1500); }
        }
        const here = SIX.filter((id) => m.s.here[id] && p.inCorner(game.npc(id).pos.x, game.npc(id).pos.z)).length + IN_RENAULT.filter((id) => p.inCorner(game.npc(id).pos.x, game.npc(id).pos.z)).length;
        const raiders = standingOf(game, RAIDERS).length;
        say(m, game, raiders ? `5. לאסוף את החברים בכניסה · ${raiders === 1 ? 'שומר רודף' : 'שני שומרים רודפים'} אחריהם · לחפות (${here}/8)` : `5. לאסוף את החברים בכניסה (${here}/8)`);
        return m.s.called && here === 8 && !raiders && m.s.raid && p.inCorner(me.x, me.z) && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) {
        m.s.gathered = true;
        for (const w of m.walks) w.cancel(); m.walks = [];
        squadOf(game, TEAM);
        game.dialogue.play(ALL_IN);
      },
    },
    { // 6: the elevator: all nine in; it goes down, stops, the doors lock, the Shadow, the gas, black
      objective: 'למעלית · כולם נכנסים', checkpoint: true,
      enter(m, game) {
        const p = PT(game), E = p.elevator;
        E.door.unlock(); E.door.setOpen(true); E.setLamp(true);
        if (!m.s.gathered) game.dialogue.play(ALL_IN);
        m.s.gathered = true; m.s.inCage = false; m.s.seq = null; m.s.goT = 0;
        game.hud.setPursuit(null);
      },
      target(m, game) { const E = PT(game).elevator; return m.s.seq ? null : game.player.pos && E.contains(game.player.pos.x, game.player.pos.z) ? null : { x: E.doorAt.x, z: E.doorAt.z, y: E.doorAt.y, r: 1.6 }; },
      update(m, game, dt) {
        const p = PT(game), E = p.elevator, me = game.player.pos;
        m.chat.update(dt);
        for (const b of m.live) b.update(dt); m.live = m.live.filter((b) => !b.done);
        if (!m.s.seq) {
          // each to his place in the cage, a few at a time through the door
          m.s.goT += dt;
          TEAM.forEach((id, k) => {
            const n = game.npc(id);
            if (m.s['in_' + id] || busy(m).some((w) => w.id === id) || m.s.goT < 0.6 + k * 0.5) return;
            const s = E.spots[k + 1];
            walkTo(m, game, id, [{ x: E.doorAt.x + ((k % 3) - 1) * 0.7, z: E.doorAt.z }, { x: E.doorAt.x + ((k % 3) - 1) * 0.6, z: E.doorAt.z + 2.4 }, s], { run: false, near: 0.35, face: Math.PI, label: 'במעלית', onDone: () => { m.s['in_' + id] = true; n.body.enabled = false; } });
          });
          for (const w of m.walks) w.update(dt); m.walks = busy(m);
          const inside = TEAM.filter((id) => E.contains(game.npc(id).pos.x, game.npc(id).pos.z)).length, mine = E.contains(me.x, me.z);
          say(m, game, `למעלית · כולם נכנסים (${inside + (mine ? 1 : 0)}/9)`);
          if (inside === TEAM.length && mine && TEAM.every((id) => m.s['in_' + id]) && !game.dialogue.busy) {
            m.s.seq = { t: 0, k: 0 };
            game.cutscene = true; game.hud.setCinematic(true); game.hud.setPursuit(null);
            game.fx.redAlert(false); m.stopSiren?.(); m.stopSiren = null;
            game.sound?.music?.(null, { fade: 1.2 });
            // Nehorai in his place at the front, everyone facing the door
            const s0 = E.spots[0]; game.player.place(s0.x, s0.z, Math.PI, s0.y);
            TEAM.forEach((id, k) => { const n = game.npc(id), s = E.spots[k + 1]; n.target = null; n.place(s.x, s.z, Math.PI, s.y); n.lookAt(s.x, s.z - 3); });
            game.squad.dismiss(); for (const id of TEAM) game.npc(id).body.enabled = false;
            const cx = (E.cage.x0 + E.cage.x1) / 2;
            game.follow.shot({ x: cx + 1.6, y: p.y + 2.55, z: E.cage.z0 + 0.5 }, { x: cx - 0.4, y: p.y + 1.25, z: E.cage.z1 - 1.2 }, 9999);
            E.door.setOpen(false); E.door.lock(); game.sound?.hit?.('block', 0.9);
          }
          return null;
        }
        return sequence(m, game, dt) ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};

// the cage: down, the stop, the doors locked, the Shadow on the speakers, the gas, the eyes closing. Each
// beat waits for its time and for the line before it to be said
function sequence(m, game, dt) {
  const p = PT(game), E = p.elevator, q = m.s.seq, sh = shaft(m, game);
  q.t += dt;
  sh.update(dt);
  const cx = (E.cage.x0 + E.cage.x1) / 2, cz = (E.cage.z0 + E.cage.z1) / 2;
  if (q.gas) { // the sleeping gas from the vents in the cage's roof
    q.puff = (q.puff || 0) + dt * 26;
    while (q.puff >= 1) { q.puff -= 1; const sx = Math.random() < 0.5 ? E.cage.x0 + 0.4 : E.cage.x1 - 0.4, sz = cz + (Math.random() - 0.5) * 3.6; game.fx.smoke.spawn(sx, p.y + 2.9, sz, (cx - sx) * 0.25 + (Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.4, (Math.random() - 0.5) * 0.5, { life: 2.6 + Math.random() * 1.4, size: 1.2 + Math.random() * 0.8, grow: 1.4, color: [0.78, 0.86, 0.8], alpha: 0.34, grav: 0.15, drag: 1.4 }); }
  }
  if (q.down) game.follow.shake(0.04);
  const beats = [
    [0.4, () => game.dialogue.play(CAGE)],
    [1.2, () => { sh.group.visible = true; sh.run = true; q.down = true; game.hud.toast('המעלית יורדת', 1800); game.sound?.beep?.(3, 140, 0.35); }],
    [2.0, () => game.dialogue.play(DOWN)],
    [6.5, () => { sh.run = false; q.down = false; game.follow.shake(0.9); game.sound?.hit?.('crash', 1); game.fx.sparks(cx, p.y + 3.1, cz, 24); E.setLamp(false); game.hud.toast('המעלית נעצרה', 1600); game.dialogue.play(STOPPED); }],
    [8.5, () => { game.sound?.hit?.('block', 1); game.hud.toast('הדלתות ננעלו', 1600); game.dialogue.play(LOCKED); }],
    [10.5, () => { game.hud.toast('רמקולים · הצל', 1800); game.sound?.beep?.(1, 260, 0.4); game.dialogue.play(SHADOW); }],
    [13.0, () => { q.gas = true; m.stopGas = game.sound?.gas?.(9, 0.13) || null; game.overlay?.daze(0.5, 2.5); game.dialogue.play(GAS); }],
    [15.5, () => { q.sleep = 0; }],
    [17.0, () => { game.overlay?.daze(1, 3); game.overlay?.eyes(0.6, 2.5); game.dialogue.play(LAST); }],
    [20.0, () => { game.overlay?.eyes(1, 2); }],
    [23.0, () => { q.black = true; }],
  ];
  // the friends sink down one after another as the gas takes them (asleep, never hurt)
  if (q.sleep != null) { q.sleep += dt; const k = Math.min(TEAM.length, Math.floor(q.sleep / 0.55)); for (let i = 0; i < k; i++) { const n = game.npc(TEAM[i]); if (n.model.pose !== 'down') n.model.setPose('down'); } }
  while (q.k < beats.length && q.t >= beats[q.k][0] && !game.dialogue.busy) { beats[q.k][1](); q.k++; }
  return !!q.black && q.t > 24;
}
