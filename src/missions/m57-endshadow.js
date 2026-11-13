// Chapter ten, mission 11, "END OF THE SHADOW". The last hall at the top of the central tower: the Shadow in the
// middle of it, the portal engine behind him, the whole gang facing him. His line, Nehorai's, a look at his
// friends: "אני לא נלחם לבד." Then the last boss in three phases, each with its checkpoint and each warned before
// it hurts. One: the energy suit and three shields fed by three generators, each brought down by its own deed (a
// core shot while its shutters are open; a console worked with the code Muller reads over the radio; his own bolt
// lured into the conductor rods), while he throws rings, beams and bolts that blink before they burst, and Yonati,
// Hadar and Liam draw his fire. Two: the broken dimension — rifts torn in the hall, the floor changing (fields
// that stop time, the floor that bursts under a warning), and he jumps from place to place and makes copies of
// himself; Muller reads which is real and marks him, Erez and Ido flank and pop the copies, and Nehorai's marks on
// the real one overload his system. Three: the suit breaks off; the last fist fight (the special attack, the timed
// openings), Erez and Ido stepping in for a moment each. He goes down, tries to rise, the last lines; Muller kills
// the portal system and Avraham and Dolev tie him: beaten for good, nobody dead. Mission 58 carries on from here.
// Paint and fists only: a marked man sits down, a punch is a white flash. Invented, all of it.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { OUT_AT } from '../combat/paint.js';
import { StasisField } from './moves.js';
import { Portal } from '../fx/portal.js';
import { L } from './lines10.js';
import { handsOver, endCrew, attempt } from './phoenix.js';
import { hush, armed, freshMarks, beats, later, talkOn, clearAll, bandage } from './phoenix-d.js';
import { become } from './phoenix-c.js';
import { walkPath } from './phoenix-b.js';
import { CIT, HALL, H, hallReady, nehoraiAt, gangPosted, friendShot, onRadio, shadowAt, shadowAway, tie } from './infinity-d.js';

const E = L.endshadow;
const EAST = Math.PI / 2, WEST = -Math.PI / 2;
// where everyone stands, in the hall's own plan (lx east, lz south; the engine at lx 104, the gang came in west)
const BACK = { muller: [41, 0], avraham: [45, -5], dolev: [45, 5], yonati: [50, -13], hadar: [51, 13], liam: [52, -3.5] };
const P1 = { ...BACK, erez: [62, -14], ido: [67, -23] };
const P2 = { ...BACK, erez: [62, -5], ido: [62, 5] };
const RING = { erez: [64, -5], ido: [64, 5], muller: [70, -10], avraham: [77, -9], dolev: [77, 9], yonati: [70, 10], hadar: [81, -2.5], liam: [81, 2.5] };
const DECOYS = ['yonati', 'hadar', 'liam'];          // they draw his fire in phase one
const SH1 = [[90, 0], [86, -9], [86, 9]];             // where he stands in phase one (in front of the engine)
const SPOTS2 = [[60, -14], [60, 14], [72, -18], [72, 18], [84, -14], [84, 14], [90, 0], [56, 0]]; // where he and his copies appear
const RIFTS = [2, 3, 4, 5];                           // the hall's rift spots torn open in phase two
const FIELDS = [[66, -6, 0], [80, 8, 3.5]];           // the floor that stops time (x, z, offset)
const HP2 = 6;                                        // marks on the real one that overload him
const SHUTTER = { open: 3.6, shut: 3.0 };             // the core's shutters, seconds
const CORE = { up: 3.0, out: 1.3 };                   // the core: on the generator's corner that faces its shooting spot, 3 m up

// lines of mine (the user's are in lines10.js): short, each in his own voice
const SHUTTERS = ['ארז', 'הליבה למעלה נפתחת כל כמה שניות. כשהתריסים עולים — לירות!'];
const CAGE = ['עידו', 'המחולל השני בכלוב, והקונסולה נעולה בקוד. מולר, תן לו ספרות!'];
const RODS = ['מולר', 'השלישי בתוך מוטות ההולכה. תעמוד על העיגול מולם, תן לו לירות עליך — וברגע שהכדור יוצא, הצידה!', 'phone'];
const READ = (code) => ['מולר', `יש לי את הרצף מהמערכת שלו: ${code.split('').join(', ')}. בדיוק בסדר הזה.`, 'phone'];
const DRAW = { yonati: ['יונתי', 'הוא מסתכל עליי. תזוז, נהוראי, אני קונה לך זמן!'], hadar: ['הדר', 'היי, משוריין! פה! ...טוב, לא פה, לא פה!'], liam: ['ליאם', 'עוד כדור כזה ואני עובר לטניס.'] };
const SHIELDS_DOWN = [['מולר', 'שלושת המגנים נפלו! אבל משהו קורה למנוע — הוא מושך ממנו הכול!', 'phone']];
const BROKEN = [['מולר', 'הוא קורע את המציאות באולם! העמודים הכחולים עוצרים את הזמן — לא לעמוד בהם כשהם מהבהבים.', 'phone'], ['ארז', 'אני מאגף משמאל!'], ['עידו', 'ואני מימין. ההעתקים — עלינו.']];
const REAL = ['מולר', 'האמיתי — זה שסימנתי לכם! החתימה שלו לא משקרת.', 'phone'];
const POPPED = { erez: ['ארז', 'מזויף! הבא בתור.'], ido: ['עידו', 'גם זה מזויף. כמה הוא צריך?'] };
const OVERLOAD = [['מולר', 'המערכת שלו בעומס! החליפה לא תחזיק!', 'phone']];
const FACE = [['ארז', 'אין לו יותר חליפה. רק הוא ואתה, אחי.'], ['עידו', 'ואנחנו פה, מסביב. כמו תמיד.']];
const STEP_IN = { erez: ['ארז', 'תפסתי לו את היד — עכשיו!'], ido: ['עידו', 'סליחה שאני מפריע. תמשיך!'] };
const DEAD = [['מולר', 'מערכת הפורטלים — מושבתת. אין לו לאן לברוח.']];
const TIED = [['אברהם', 'קשור. הוא לא הולך לשום מקום.'], ['דולב', 'הפעם הוא הקשור, לא אני. איזה כיף לשם שינוי.']];
const LOST1 = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. מולר: "כל התקפה שלו מהבהבת לפני: טבעת על הרצפה — לצאת ממנה; קו של קרן — מאחורי מחסה נמוך; כדור שמתמלא — לזוז הצידה."';
const LOST2 = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "ההעתקים לא מטילים צל, ומולר מסמן לך את האמיתי. ותתרחק מהעמודים הכחולים כשהם מהבהבים."';
const FIST_LOST = 'הצל הפיל אותך. עידו: "כשהוא מתנופף — דחיפה או התחמקות. וכשכתוב עכשיו! — אגרוף, מיד."';

const Hp = (game, [lx, lz], yaw) => H(game, lx, lz, yaw);

// ---------- the hall as each phase has it ----------
function put(m, game) { // everything this mission made, put away
  clearAll(m, game);
  game.keypad?.close?.(false);
  m.foe?.dispose(); m.foe = null;
  game.energy?.clear?.();
  for (const p of m.portals || []) p.dispose(); m.portals = [];
  for (const f of m.fields || []) f.dispose(); m.fields = [];
  if (m.catcher) { game.energy.removeCatcher(m.catcher); m.catcher = null; }
  for (const k of ['hood', 'plate', 'pin']) if (m[k]) { m[k].removeFromParent(); m[k].traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); m[k] = null; }
  m.att = null; m.r2 = null; m.inn = null; m.lureBolt = null;
  if (game.player.frozen) game.player.frozen = 0; // a field's hold on him ends with the scene it belonged to
}
function stage(m, game, cp) {
  put(m, game);
  become(game, 'nehorai');
  game.fighter.revive(); game.fighter.minHp = 0;
  hallReady(game, { engine: cp === 2 ? 'overload' : 'on' });
  const me = [Hp(game, [60, 0], EAST), Hp(game, [62, 0], EAST), Hp(game, [64, 0], EAST), Hp(game, [70.4, 0], EAST)][Math.min(cp, 3)];
  nehoraiAt(game, me);
  const spots = cp >= 3 ? RING : cp === 2 ? P2 : P1;
  gangPosted(game, Object.fromEntries(Object.entries(spots).map(([id, p]) => [id, Hp(game, p, cp >= 3 ? Math.atan2(72 - p[0], -p[1]) : EAST)])));
  const P = game.paint;
  if (cp >= 3) P.disarmPlayer();
  freshMarks(game); P.reset();
  // the Shadow: in the middle of the hall before the engine; his suit on until phase three
  const sh = shadowAt(game, cp >= 3 ? Hp(game, [73.6, 0], WEST) : cp === 2 ? Hp(game, SPOTS2[6], WEST) : Hp(game, [88, 0], WEST), { armor: cp < 3 });
  tie(sh.model, false);
  const G = HALL(game).generators; for (const g of G) g.set(true);
  m.s = { cp, p: null, said: {} };
}

// ---------- his attacks (phases one and two): each one blinks before it hurts ----------
function attacks(m, game, dt, kinds) {
  const A = m.att, foe = m.foe, sh = game.npc('shadow');
  if (!A || !foe || foe.down || game.cutscene || game.mode !== 'foot') return;
  sh.lookAt(game.player.pos.x, game.player.pos.z);
  if (foe.teleporting || m.s.lure || game.player.frozen || game.player.busy) return;
  if ((A.t -= dt) > 0) return;
  A.t = 3.4 + Math.random() * 1.2; A.n++;
  const from = { x: foe.pos.x, y: foe.pos.y + 1.3, z: foe.pos.z };
  sh.model.play?.('heavy', { speed: 1.6 });
  // one in three goes at whoever is drawing his fire (phase one): it flies past him, the friend ducks
  const near3 = A.decoys && A.n % 3 === 0 ? DECOYS.map((id) => game.npc(id)).filter((n) => n.visible) : [];
  const decoy = near3.length ? near3[(A.n / 3) % near3.length] : null;
  if (decoy) {
    game.energy.bolt({ from, target: decoy, speed: 8, warn: 0.6, color: foe.color });
    decoy.model.play?.('dodge', { speed: 1 });
    if (!m.s.said[decoy.id]) { m.s.said[decoy.id] = true; later(m, [DRAW[decoy.id]]); }
    return;
  }
  const p = game.player.pos, inField = (m.fields || []).some((f) => f.inside?.(p, 1.2));
  let k = kinds[A.n % kinds.length];
  if (k === 'ring' && inField) k = 'bolt';
  if (k === 'ring') foe.ring({ r: 3, warn: 1.5, label: 'טבעת אנרגיה!' });
  else if (k === 'beam') foe.sweep({ arc: 1.4, len: 26, warn: 1.3, seconds: 1.6, height: 0.8, label: 'קרן אנרגיה!' });
  else foe.shoot({ speed: 9, warn: 0.8, label: 'כדור אנרגיה!' });
}

// ---------- phase one: the three generators ----------
function phaseOne(m, game) {
  const Hh = HALL(game), G = Hh.generators, y = Hh.y;
  const sh = game.npc('shadow');
  m.foe = game.energy.foe({ npc: sh, hp: HP2, name: 'הצל', bar: true, downPose: null, hint: 'המגן בולם · להשבית את המחוללים',
    onShield: (f, i, left) => { if (i < 0) return; G[i].set(false); if (i === 2 && m.plate) m.plate.visible = false; if (left === 0) m.s.p = 'down'; } });
  m.foe.place(sh.pos.x, sh.pos.z, WEST, y);
  // 0: the core on top of the tall generator, behind shutters that open on a rhythm
  const g0 = G[0], core = coreAt(game); // on the corner toward its spot: in plain sight and in a clear line from there
  m.foe.addShield({ generator: core, kind: 'shoot', hits: 3, r: 0.6 });
  // 1: the caged one, switched off at its console; 2: the one in the rods, overloaded by his own bolt
  m.foe.addShield({ generator: { x: G[1].x, y: G[1].y, z: G[1].z }, kind: 'switch' });
  m.foe.addShield({ generator: { x: G[2].x, y: G[2].y, z: G[2].z }, kind: 'switch' });
  m.catcher = game.energy.addCatcher({ x: G[2].x, y: y + 1.25, z: G[2].z, r: 1.3, onBolt: () => m.foe?.shieldDown(2) });
  // the core (a violet disc) and its shutter: a dark plate in front of it that slides up while the shutters are open
  const hood = new THREE.Group(), yaw = Math.atan2(g0.from.x - g0.x, g0.from.z - g0.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#b48cff' }));
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.08), new THREE.MeshStandardMaterial({ color: '#1d2026', metalness: 0.6, roughness: 0.5 }));
  shutter.position.z = 0.1; shutter.name = 'shutter'; hood.add(disc, shutter);
  hood.position.set(core.x, core.y, core.z); hood.rotation.y = yaw; game.scene.add(hood); m.hood = hood;
  m.shut = { t: 0, open: false };
  // the plate in front of the rods where he must stand
  const lure = Hh.generators[2].lureAt;
  const plate = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#59c7ff', transparent: true, opacity: 0.7, depthWrite: false }));
  plate.position.set(lure.x, y + 0.04, lure.z); game.scene.add(plate); m.plate = plate;
  m.att = { t: 2.2, n: 0, decoys: true };
  m.fire1 = 1.5;
}
// the core's point: out from the generator's middle toward its shooting spot, past the corner of its box
function coreAt(game) { const g0 = HALL(game).generators[0], dx = g0.from.x - g0.x, dz = g0.from.z - g0.z, d = Math.hypot(dx, dz) || 1; return { x: g0.x + dx / d * CORE.out, y: HALL(game).y + CORE.up, z: g0.z + dz / d * CORE.out }; }
const shieldsLeft = (m) => (m.foe ? m.foe.shieldsUp : 0);
function shutters(m, game, dt) {
  const S = m.shut, s = m.foe?.shields[0]; if (!S || !s) return;
  S.t += dt;
  const was = S.open; S.open = s.up && S.t % (SHUTTER.open + SHUTTER.shut) < SHUTTER.open;
  if (s.target) s.target.on = S.open;
  m.s.shutter = S.open;
  const h = m.hood, sh = h?.getObjectByName('shutter');
  if (sh) { sh.position.y += ((S.open ? 1.15 : 0) - sh.position.y) * Math.min(1, dt * 8); h.children[0].material.color.set(s.up ? (S.open ? '#e2d2ff' : '#6b4fb0') : '#1a1a1e'); }
  if (S.open && !was && s.up) game.sound?.beep?.(1, 660);
}
// the lure: on the plate, he comes round in line with the rods and throws a slow bolt; a step aside lets it by
function lure(m, game, dt) {
  const s2 = m.foe?.shields[2]; if (!s2?.up) { if (m.s.lure) m.s.lure = null; return; }
  const Hh = HALL(game), G = Hh.generators[2], p = game.player.pos, foe = m.foe;
  if (m.s.lure === 'wait') { if ((m.lureWait -= dt) <= 0) m.s.lure = null; return; }
  if (m.s.lure === 'bolt') { if (m.lureBolt?.flying && !m.s.flew) { m.s.flew = true; game.hud.pop('עכשיו — הצידה!', 'counter'); } return; }
  if (m.s.lure || game.cutscene || foe.teleporting || !near(p, Hh.generators[2].lureAt, 1.35) || Math.abs(p.y - Hh.y) > 1) return;
  const dx = p.x - G.x, dz = p.z - G.z, d = Math.hypot(dx, dz) || 1, S = { x: p.x + dx / d * 9, z: p.z + dz / d * 9, y: Hh.y };
  m.s.lure = 'tp'; m.s.flew = false;
  game.energy.clear(); // nothing else in the air while he lines up
  foe.teleport({ ...S, yaw: Math.atan2(-dx, -dz) }, { onArrive: () => {
    if (!m.foe || m.s.lure !== 'tp') return;
    m.s.lure = 'bolt';
    game.npc('shadow').model.play?.('heavy', { speed: 1.2 });
    m.lureBolt = game.energy.bolt({ from: { x: S.x, y: Hh.y + 1.3, z: S.z }, to: { x: G.x, y: Hh.y + 1.25, z: G.z }, speed: 7.5, warn: 1.3, color: foe.color, label: 'כדור אנרגיה!',
      onStop: () => { m.s.lure = 'wait'; m.lureWait = 2.2; m.att && (m.att.t = Math.max(m.att.t, 1.5)); } });
  } });
}
// Yonati, Hadar and Liam keep his head turned: paint splashing on his shield
function decoyFire(m, game, dt) {
  if (!m.foe || game.cutscene || (m.fire1 -= dt) > 0) return;
  m.fire1 = 1.6 + Math.random();
  const id = DECOYS[Math.floor(Math.random() * DECOYS.length)], f = m.foe;
  const hit = friendShot(game, id, { x: f.pos.x, y: f.pos.y + 1.2, z: f.pos.z }, [f.body]);
  if (hit.target === f.body) { game.energy.sparks(hit.point.x, hit.point.y, hit.point.z, f.color, 4, 2); f.ripple = 0.35; }
}

// ---------- phase two: the broken dimension ----------
function phaseTwo(m, game) {
  const Hh = HALL(game), y = Hh.y, sh = game.npc('shadow'), c = Hh.centre;
  Hh.engine.set('overload');
  m.portals = RIFTS.map((i, k) => { const r = Hh.rifts[i], q = new Portal(game, { at: { x: r.x, z: r.z, y }, r: 1.3, yaw: Math.atan2(c.x - r.x, c.z - r.z), height: 1.6, light: false, sound: k === 0, rumble: k === 0 ? 0.5 : 0 }); q.open(0.9); return q; });
  m.fields = FIELDS.map(([lx, lz, off]) => { const p = H(game, lx, lz); return new StasisField(game, { x: p.x, z: p.z, y, r: 2.4, period: 7, hold: 2.2, warn: 1.5, offset: off }); });
  m.foe = game.energy.foe({ npc: sh, hp: HP2, name: 'הצל', bar: true, vulnerable: true, downPose: null,
    onHurt: () => { if (m.r2) { m.r2.state = 'hit'; m.r2.t = 1.0; } },
    onDown: () => { m.s.p = 'over'; } });
  m.foe.place(sh.pos.x, sh.pos.z, WEST, y);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
  pin.visible = false; game.scene.add(pin); m.pin = pin;
  m.r2 = { state: 'idle', t: 1.6, age: 0, picks: {} };
  m.att = { t: 3.0, n: 0, decoys: false };
}
function spots2(game) { return SPOTS2.map((p) => H(game, p[0], p[1])); }
function round(m, game, dt) {
  const R = m.r2, foe = m.foe; if (!R || !foe || foe.down) return;
  const p = game.player.pos;
  R.t -= dt; R.age += dt;
  if (m.pin) { m.pin.visible = R.shown && foe.copies > 0 && !foe.teleporting; m.pin.position.set(foe.pos.x, foe.pos.y + 2.6 + 0.12 * Math.sin(game.time * 6), foe.pos.z); m.pin.rotation.y += dt * 3; }
  if (R.state === 'idle') {
    if (R.t > 0 || foe.teleporting || game.cutscene) return;
    // three places round him, not too near, not too far; he goes to one, copies stand in the other two
    const all = spots2(game).map((q) => ({ q, d: Math.hypot(q.x - p.x, q.z - p.z) })).filter((o) => o.d > 6 && o.d < 17).sort((a, b) => a.d - b.d);
    const pick = (all.length >= 3 ? all : spots2(game).map((q) => ({ q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d)).slice(0, 3).map((o) => o.q);
    foe.spawnCopies(2, pick);
    R.state = 'copies'; R.age = 0; R.shown = false; R.picks = {}; R.shoterez = R.shotido = false;
    return;
  }
  if (R.state === 'copies') {
    if (!R.shown && R.age > 1.6 && !foe.teleporting) { R.shown = true; if (!m.s.said.real) { m.s.said.real = true; onRadio(game, REAL); } else game.hud.toast('מולר סימן את האמיתי', 1400); }
    const copies = foe.copyList.filter((c) => c.alive);
    // Erez and Ido each go after one of them, from the side, and paint it
    ['erez', 'ido'].forEach((id, k) => {
      const n = game.npc(id), other = R.picks[k ? 'erez' : 'ido'];
      if (!R.picks[id]?.alive) R.picks[id] = copies.find((q) => q !== other) || null;
      const c = R.picks[id];
      if (!c) return;
      const side = k ? 1 : -1, dx = c.pos.x - p.x, dz = c.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      const fx = c.pos.x - dx / d * 7 + (-dz / d) * 5 * side, fz = c.pos.z - dz / d * 7 + (dx / d) * 5 * side;
      if (!n.target || Math.hypot(n.target.x - fx, n.target.z - fz) > 2) n.walkTo(fx, fz, { run: true, near: 0.8 });
      if (R.age > 3.4 + k * 0.9 && !R[`shot${id}`]) {
        R[`shot${id}`] = true; n.target = null;
        const hit = friendShot(game, id, { x: c.pos.x, y: c.pos.y + 1.2, z: c.pos.z }, [c.target]);
        if (c.alive) foe.popCopy(c); // his paint finds it (a friend's job always comes off)
        if (!m.s.said[`pop${id}`]) { m.s.said[`pop${id}`] = true; later(m, [POPPED[id]]); }
      }
    });
    if (R.age > 15 && !foe.teleporting) { foe.clearCopies(); R.state = 'idle'; R.t = 0.5; R.shoterez = R.shotido = false; }
    return;
  }
  if (R.state === 'hit' && R.t <= 0 && !foe.teleporting) { // hurt: away through a rift, and again
    const s = spots2(game).filter((q) => Math.hypot(q.x - foe.pos.x, q.z - foe.pos.z) > 5);
    foe.clearCopies();
    foe.teleport(s[Math.floor(Math.random() * s.length)]);
    R.state = 'idle'; R.t = 1.4; R.shoterez = R.shotido = false;
    for (const id of ['erez', 'ido']) { const n = game.npc(id), q = Hp(game, P2[id]); n.walkTo(q.x, q.z, { run: true, near: 0.8 }); }
  }
}

// ---------- phase three: Erez and Ido step in, each for a moment ----------
function stepIn(m, game, dt) {
  const S = m.inn, F = m.fight; if (!S || !F || F.over) return;
  const o = F.opponents[0], sh = o.npc, n = game.npc(S.id);
  S.t += dt;
  if (S.k === 'go') {
    if (o.fighter.floored && S.t < 3) { n.walkTo(sh.pos.x + (S.id === 'erez' ? -1 : 1) * 0.9, sh.pos.z + 1.1, { run: true, near: 0.4 }); return; }
    S.k = 'hold'; S.t = 0; n.target = null; n.lookAt(sh.pos.x, sh.pos.z);
    n.model.play?.('shove', { speed: 1 }); sh.model.play?.('reel', { speed: 1 });
    F.openUp(o, 1.6);
    later(m, [STEP_IN[S.id]]);
  } else if (S.k === 'hold' && S.t > 1.8) {
    S.k = 'back'; const q = Hp(game, RING[S.id]); n.walkTo(q.x, q.z, { run: true, near: 0.6 });
    m.inn = null;
  }
}

// the arrow to him, but no column of light over him while a scene or the fist fight is on (it would hide him)
function aimAtHim(m, game) { const n = game.npc('shadow'); return game.cutscene || (game.fight && !game.fight.over) || !n.visible ? null : { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 1.2 }; }

export default {
  id: 'endshadow', chapter: 10, number: 11, title: 'END OF THE SHADOW', requires: ['laststand'], follows: true,
  where: 'באולם האחרון',
  startAt: (game) => { const h = game.world.places.citadel?.lastHall; return h ? { x: h.entry.x, z: h.entry.z, y: h.entry.y } : null; },
  reward: { money: 3000, text: 'הצל מובס סופית · 3,000 ₪' },

  setup(m, game) { m.s = { said: {} }; m.live = []; m.talk = []; m.portals = []; m.fields = []; },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); if (game.dimensionName) game.dimension(null); const e = HALL(game).entry; game.player.place(e.x, e.z, e.yaw ?? 0, e.y); game.follow.snapBehind(e.yaw ?? 0); },
  failIf(m, game) { return (m.stepIndex === 1 || m.stepIndex === 2) && game.paint.hits >= OUT_AT ? (m.stepIndex === 1 ? LOST1 : LOST2) : null; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) { hush(game); talkOn(m, game); },
  cleanup(m, game) {
    const carry = m.done && handsOver(game);
    put(m, game);
    if (carry) { // the hall as it is: the Shadow tied on the floor, the engine dead, the gang round Nehorai, armed
      HALL(game).engine.set('dead');
      armed(game, game.squad.ids);
      return;
    }
    shadowAway(game);
    HALL(game).engine.set('idle');
    for (const g of HALL(game).generators) g.set(true);
    bandage(game.nehorai, false);
    game.sound?.music?.(null, { fade: 0.6 });
    endCrew(game);
  },

  steps: [
    { // 0: in the middle of the hall, the engine behind him; the lines; a look at the gang
      objective: 'הצל באולם האחרון',
      enter(m, game) {
        const Hh = HALL(game);
        // a live carry-on from the last stand leaves the gang in this hall: the scene is set over it all the same
        stage(m, game, 0);
        const sh = game.npc('shadow'); sh.model.setArmor?.(false); sh.lookAt(game.player.pos.x, game.player.pos.z);
        const me = game.player.pos, eng = Hh.engine;
        game.cutscene = true; game.hud.setCinematic(true);
        const shot = (from, at) => game.follow.shot(from, at, 9999);
        shot({ x: me.x - 3, y: me.y + 2.6, z: me.z + 2.2 }, { x: eng.x, y: eng.y - 2, z: eng.z });
        game.sound?.music?.(null, { fade: 0.6 });
        const gang = ['erez', 'ido', 'liam', 'hadar', 'yonati', 'dolev', 'avraham', 'muller'];
        m.beats = beats(game, [
          ['wait', 0.8],
          ['do', () => shot({ x: sh.pos.x - 4.5, y: sh.pos.y + 1.8, z: sh.pos.z + 1.6 }, { x: sh.pos.x, y: sh.pos.y + 1.6, z: sh.pos.z })],
          ['say', [E.shadowPower]],
          ['do', () => shot({ x: me.x + 2.2, y: me.y + 1.8, z: me.z - 1.4 }, { x: me.x, y: me.y + 1.6, z: me.z })],
          ['say', [E.forgot]],
          ['do', () => shot({ x: sh.pos.x - 3, y: sh.pos.y + 1.7, z: sh.pos.z - 1.2 }, { x: sh.pos.x, y: sh.pos.y + 1.6, z: sh.pos.z })],
          ['say', [E.shadowWhat]],
          // Nehorai looks at his friends: the camera goes over every one of them
          ['do', () => { game.player.yaw = -Math.PI / 2; game.nehorai.play?.('nod', { speed: 0.8 }); }],
          ...gang.flatMap((id) => [['do', () => { const n = game.npc(id); shot({ x: n.pos.x + 2.4, y: n.pos.y + 1.7, z: n.pos.z + (n.pos.z > me.z ? -1.2 : 1.2) }, { x: n.pos.x, y: n.pos.y + 1.5, z: n.pos.z }); n.lookAt(me.x, me.z); n.model.play?.('nod', { speed: 1 }); }], ['wait', 0.55]]),
          ['do', () => { game.player.yaw = EAST; shot({ x: me.x - 2.6, y: me.y + 1.7, z: me.z + 0.6 }, { x: sh.pos.x, y: sh.pos.y + 1.4, z: sh.pos.z }); }],
          ['say', [E.notAlone]],
          // the suit: plates and light close over him
          ['do', () => { game.energy.sparks(sh.pos.x, sh.pos.y + 1.2, sh.pos.z, '#8a6bff', 30, 6); sh.model.setArmor?.(true); game.follow.shake(0.3); game.sound?.thunder?.(0.6); game.overlay?.flash?.('#b9a6ff', 220, 0.35); }],
          ['wait', 0.9],
        ]);
      },
      target: aimAtHim,
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: phase one — the armoured Shadow and his three shields
      objective: 'שלב 1 · הצל המשוריין · מגנים (0/3)', checkpoint: true,
      enter(m, game) {
        const sh = game.npc('shadow'); sh.model.setArmor?.(true);
        if (m.s.cp !== 1) { freshMarks(game); game.paint.reset(); }
        phaseOne(m, game);
        game.hud.banner('הצל · שלב 1 מתוך 3', 'הצל המשוריין', 'שלושה מגנים · כל אחד בדרך אחרת', 2800);
        game.sound?.music?.('epic', { fade: 0.4 });
        later(m, [SHUTTERS]); later(m, [CAGE]); later(m, [RODS]);
        m.s.p = 'fight'; m.s.t1 = 0;
      },
      interaction(m, game) {
        const H1 = HALL(game).generators[1];
        if (m.s.p !== 'fight' || !m.foe?.shields[1]?.up || game.mode !== 'foot' || game.cutscene || !near(game.player.pos, H1.consoleAt, 1.7)) return null;
        return { label: 'לעבוד על הקונסולה', priority: 6, run: () => {
          const live = attempt(game, m);
          const code = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 9)).join('');
          m.s.code = code;
          onRadio(game, READ(code));
          game.keypad.open(code, `מולר בקשר: ${code.split('').join(' · ')}`).then((ok) => { if (live() && ok) { m.foe?.shieldDown(1); game.hud.toast('הקונסולה · המחולל בכלוב כבה', 1600); } });
        } };
      },
      target(m, game) {
        const Hh = HALL(game), G = Hh.generators, f = m.foe, me = game.player.pos;
        if (!f) return null;
        const list = [];
        // the spot to shoot from (once there, the core itself); the console; the plate (once on it, the rods)
        if (f.shields[0]?.up) list.push(near(me, G[0].from, 2.5) ? { x: G[0].x, z: G[0].z, y: Hh.y, r: 1.0, here: true } : { ...G[0].from, r: 1.1 });
        if (f.shields[1]?.up) list.push({ ...G[1].consoleAt, r: 1.0 });
        if (f.shields[2]?.up) list.push(near(me, G[2].lureAt, 2) ? { x: G[2].x, z: G[2].z, y: Hh.y, r: 1.2, here: true } : { ...G[2].lureAt, r: 1.2 });
        const here = list.find((q) => q.here);
        return here || list.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0] || { x: f.pos.x, z: f.pos.z, y: f.pos.y, r: 1.4 };
      },
      update(m, game, dt) {
        if (m.s.p === 'fight') {
          m.s.t1 += dt;
          shutters(m, game, dt); lure(m, game, dt); decoyFire(m, game, dt);
          attacks(m, game, dt, ['ring', 'beam', 'bolt']);
          // he moves about before the engine now and then (never while he is lining up a bolt)
          if (m.foe && !m.s.lure && !m.foe.teleporting && m.s.t1 > 9) { m.s.t1 = 0; const s = SH1[Math.floor(Math.random() * SH1.length)]; m.foe.teleport(Hp(game, s, WEST)); }
          say(m, game, `שלב 1 · הצל המשוריין · מגנים (${3 - shieldsLeft(m)}/3) · סומנת ${game.paint.hits}/3`);
        }
        if (m.s.p === 'down') { // the last shield fell
          m.s.p = 'after';
          game.energy.clear();
          const sh = game.npc('shadow');
          sh.model.play?.('reel', { speed: 0.8 });
          m.beats = beats(game, [['say', SHIELDS_DOWN], ['wait', 0.4]]);
        }
        if (m.s.p === 'after') { m.beats?.update(dt); if (m.beats?.done) return 'next'; }
        return null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; },
    },
    { // 2: phase two — the broken dimension
      objective: 'שלב 2 · הממד השבור', checkpoint: true,
      enter(m, game) {
        put(m, game);
        freshMarks(game); game.paint.reset();
        // played on from phase one (not restored): the lure's last state ('wait' after the bolt that took the third
        // shield) is never cleared there, and while it is set attacks() holds his fire for the whole phase
        m.s.lure = null;
        const sh = game.npc('shadow'); sh.model.setArmor?.(true);
        if (m.s.cp !== 2) for (const id of ['erez', 'ido']) { const n = game.npc(id), q = Hp(game, P2[id]); n.walkTo(q.x, q.z, { run: true, near: 0.8 }); }
        for (const g of HALL(game).generators) g.set(false);
        phaseTwo(m, game);
        game.follow.shake(0.4); game.overlay?.flash?.('#b9a6ff', 260, 0.4);
        game.hud.banner('הצל · שלב 2 מתוך 3', 'הממד השבור', 'מי האמיתי? · לסמן אותו', 2800);
        game.sound?.music?.('epic', { fade: 0.4 });
        later(m, BROKEN);
        m.s.p = 'fight';
      },
      // the arrow on him once Muller has marked him among his copies (until then, which one is the question)
      target(m, game) { const f = m.foe; return f && !f.down && !f.teleporting && (f.copies === 0 || m.r2?.shown) ? { x: f.pos.x, z: f.pos.z, y: f.pos.y, r: 1.3 } : null; },
      update(m, game, dt) {
        if (m.s.p === 'fight') {
          for (const f of m.fields) f.update(dt);
          round(m, game, dt);
          attacks(m, game, dt, ['ring', 'bolt', 'ring']);
          const done = m.foe ? HP2 - m.foe.hp : 0;
          say(m, game, `שלב 2 · הממד השבור · באמיתי (${Math.round(done)}/${HP2}) · סומנת ${game.paint.hits}/3`);
        }
        if (m.s.p === 'over') { // his system gives: the suit sparks and breaks off, the rifts close
          m.s.p = 'end';
          game.energy.clear();
          const sh = game.npc('shadow');
          m.foe.clearCopies(); m.foe.breakArmor();
          sh.model.play?.('reel', { speed: 0.7 });
          for (const p of m.portals) p.close(0.6);
          for (const f of m.fields) f.dispose(); m.fields = [];
          HALL(game).engine.set('on');
          if (m.pin) m.pin.visible = false;
          game.overlay?.flash?.('#ffffff', 260, 0.5); game.follow.shake(0.5);
          m.beats = beats(game, [['say', OVERLOAD], ['wait', 0.6]]);
        }
        if (m.s.p === 'end') { m.beats?.update(dt); if (m.beats?.done) return 'next'; }
        return null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; },
    },
    { // 3: phase three — face to face: the suit is off, the last fist fight
      objective: 'שלב 3 · פנים אל פנים', checkpoint: true,
      enter(m, game) {
        const Hh = HALL(game), d = Hh.duel;
        if (m.s.cp !== 3) {
          put(m, game);
          game.paint.disarmPlayer();
          gangPosted(game, Object.fromEntries(Object.entries(RING).map(([id, p]) => [id, Hp(game, p, Math.atan2(72 - p[0], -p[1]))])), { arm: false });
        }
        for (const id of Object.keys(RING)) game.paint.removeAlly(game.npc(id));
        const sh = shadowAt(game, Hp(game, [73.6, 0], WEST), { armor: false });
        game.player.place(d.x - 1.6, d.z, EAST, d.y); game.follow.snapBehind(EAST);
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: d.x - 4, y: d.y + 2.2, z: d.z + 3.2 }, { x: sh.pos.x, y: sh.pos.y + 1.4, z: sh.pos.z }, 9999);
        m.s.p = 'talk';
        m.beats = beats(game, [
          ['say', FACE],
          ['do', () => {
            game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(EAST);
            m.fight = new Fight(game, {
              opponents: [{ npc: sh, boss: true, name: 'הצל', hp: 180, power: 1.1, windup: 1.0, open: 1.05, armor: 0.7, aggression: 1.05, moves: ['slam', 'swing', 'cross', 'swing'], phases: [{ at: 0.66 }, { at: 0.33, aggression: 1.25, windup: 0.88 }] }],
              finale: true,
              onPhase: (o, k) => { m.inn = { id: k === 1 ? 'erez' : 'ido', k: 'go', t: 0 }; },
              onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; },
            });
            game.hud.banner('הצל · שלב 3 מתוך 3', 'FIST COMBAT', 'מכה מיוחדת · עכשיו! · חסימה · התחמקות', 2800);
            m.s.tipAt = game.time + 3;
            m.s.p = 'fight';
          }],
        ]);
      },
      target: aimAtHim,
      update(m, game, dt) {
        m.beats?.update(dt);
        if (m.s.p === 'fight') {
          stepIn(m, game, dt);
          if (m.s.tipAt && game.time > m.s.tipAt) { m.s.tipAt = 0; game.hud.toast('כשכתוב "עכשיו!" — אגרוף מיד. המד מלא: מכה מיוחדת', 3200); }
          if (m.s.lost) return `fail:${FIST_LOST}`;
          say(m, game, m.s.won ? 'הצל על הרצפה' : 'שלב 3 · פנים אל פנים · הצל');
          if (m.s.won) return 'next';
        }
        return null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.inn = null; m.fight?.dispose(); m.fight = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 4: he tries to rise; the last lines; the portal system killed; tied — beaten for good
      objective: 'הצל על הרצפה',
      enter(m, game) {
        const Hh = HALL(game), sh = game.npc('shadow'), me = game.player.pos;
        sh.target = null; sh.model.setPose('down');
        game.cutscene = true; game.hud.setCinematic(true);
        const live = attempt(game, m);
        m.s.film = 'playing';
        game.playCutscene('c10-shadow-down', () => Promise.resolve()).then(() => { if (live()) m.s.film = 'done'; });
        // shots worked out from the line between them (wherever the fight left them): u from Nehorai to him, v across
        const dl = Math.hypot(sh.pos.x - me.x, sh.pos.z - me.z) || 1, u = { x: (sh.pos.x - me.x) / dl, z: (sh.pos.z - me.z) / dl }, v = { x: -u.z, z: u.x };
        const at = (o, a, b, h) => ({ x: o.x + u.x * a + v.x * b, z: o.z + u.z * a + v.z * b, y: o.y + h });
        const side = (id, s) => { const n = game.npc(id), q = at(me, 0.2, s * 1.3, 0); n.target = null; n.walkTo(q.x, q.z, { run: false, near: 0.4, onArrive: () => n.lookAt(sh.pos.x, sh.pos.z) }); };
        const shot = (from, look) => game.follow.shot(from, look, 9999);
        const onHim = () => shot(at(me, -0.9, 1.1, 1.75), at(sh.pos, 0, 0, 0.8)); // over Nehorai's shoulder
        m.beats = beats(game, [
          ['until', () => m.s.film === 'done'],
          ['do', () => { game.cutscene = true; game.hud.setCinematic(true); onHim(); sh.lookAt(me.x, me.z); sh.model.setPose('halfup'); }],
          ['wait', 0.6],
          ['say', [E.shadowHow]],
          ['do', () => shot(at(sh.pos, 0.6, -1.3, 1.3), at(me, 0, 0, 1.6))],
          ['say', [E.separate]],
          ['do', () => side('erez', -1)],
          ['wait', 0.4],
          ['say', [E.didntWork]],
          ['do', () => side('ido', 1)],
          ['wait', 0.4],
          ['say', [E.badEnemies]],
          ['do', onHim],
          ['say', [E.over]],
          ['do', () => { sh.model.setPose('down'); }],
          // Muller at the engine's panel: the portal system dies
          ['do', () => { const n = game.npc('muller'), q = Hh.engineAt; n.target = null; m.s.t4 = game.time; walkPath(n, [H(game, 76, -2), H(game, 88, -1), q], { run: true, onDone: () => n.lookAt(Hh.engine.x, Hh.engine.z) }); shot({ x: q.x - 9, y: q.y + 3.2, z: q.z + 6 }, { x: Hh.engine.x, y: Hh.engine.y - 2, z: Hh.engine.z }); }],
          ['until', () => near(game.npc('muller').pos, Hh.engineAt, 1.2) || game.time - m.s.t4 > 7],
          ['do', () => { const e = Hh.engine; e.set('dead'); game.energy.sparks(e.x - 1, e.y, e.z, '#8a6bff', 40, 7); game.fx?.sparks?.(e.x - 1, e.y - 2, e.z, 18); game.sound?.hit?.('crash', 0.8); game.follow.shake(0.4); game.overlay?.flash?.('#ffffff', 200, 0.35); }],
          ['say', DEAD],
          // Avraham and Dolev tie him
          ['do', () => { m.s.t4 = game.time; ['avraham', 'dolev'].forEach((id, k) => { const n = game.npc(id); n.target = null; const q = at(sh.pos, 0.75, k ? 0.6 : -0.6, 0); n.walkTo(q.x, q.z, { run: true, near: 0.35, onArrive: () => { n.lookAt(sh.pos.x, sh.pos.z); n.model.setPose('kneel'); } }); }); shot(at(sh.pos, -0.9, 3.2, 2.3), at(sh.pos, 0.3, 0, 0.6)); }],
          ['until', () => ['avraham', 'dolev'].every((id) => !game.npc(id).target) || game.time - m.s.t4 > 5],
          ['wait', 1.2],
          ['do', () => { tie(sh.model, true); game.sound?.beep?.(1, 520); for (const id of ['avraham', 'dolev']) game.npc(id).model.setPose(null); }],
          ['say', TIED],
          ['do', () => { game.hud.banner('END OF THE SHADOW', 'הצל מובס סופית', 'מערכת הפורטלים מושבתת · הוא לא יכול לברוח', 3200); }],
          ['wait', 2.4],
        ]);
      },
      target: aimAtHim,
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) {
        m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        for (const id of ['avraham', 'dolev', 'erez', 'ido', 'muller']) { const n = game.npc(id); n.model.setPose(null); }
        armed(game, game.squad.ids);
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
