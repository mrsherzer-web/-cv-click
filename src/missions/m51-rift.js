// Chapter ten, mission 5 (51): הקרע במציאות. In the central tower's main hall, right after the fall: Nehorai,
// on his feet again with the bandage on, and Erez take the Shadow on together — a short duel: he throws warned
// energy at Nehorai and keeps his guard up; Erez goes round him (his job), and when the Shadow turns on Erez his
// guard drops and Nehorai marks him; the others cover from the north side and hold their posts. On one knee, the
// Shadow brings out the orb: black-violet, growing in his hands, the air bending, the walls shaking. Muller on
// the radio from control room B, the lines; the Shadow's line; the throw; the orb becomes a portal and grows. The
// pull is real: reach a pillar and hold on (the prompt, kept pressed) while Erez, dragged off his feet, grabs
// Nehorai; Muller tries to shut it from the computer, Ido shouts from his pillar. The grip gives by script; both
// are drawn in; white; two seconds of silence. 52 carries on in the other dimension. (No fail after the duel.)
// Paint, never blood; nobody of the gang is hurt by the portal: two of them go through it. Invented, all of it.
import { near, say } from './missions.js';
import { OUT_AT } from '../combat/paint.js';
import { L } from './lines10.js';
import { attempt, endCrew } from './infinity.js';
import { handsTo } from './phoenix-a.js';
import { ORDER, beats, later, talkOn, hush, stay, gangAt, armed, freshMarks, wipeOff, offBoard, bandage, armWrap, clearAll } from './phoenix-d.js';
import { HALL, H, yawTo, inHall, citadelTaken, citadelAsBuilt, battleSky, shadowIn, shadowOut, mullerAtComputer, GANG, shotAt, hurtLook, keptPressed } from './infinity-b.js';

const VIOLET = '#8a6bff';
const HP = 4;                       // pellets (a long marker's count double) that put the Shadow on one knee
const WINDOW = 4.5;                 // seconds his guard stays down while he turns on Erez
const PULL = 2.6;                   // the portal's pull, metres a second at full openness
const GRIP = 6.5;                   // seconds held at the pillar before the grip gives (by script)
// the hall's own coordinates (infinity-b's H): lx 32 the west door .. 112 the screen; lz -36 north .. 36 south
const SPOTS = [[82, 10], [85, 19], [77, -4]];          // where the Shadow stands in the duel (he jumps between them)
const POSTS = [[52, -22], [57, -25], [62, -21], [68, -24], [73, -20], [46, -24]];   // the others, along the north side
const N1 = [66, 4], E1 = [66.5, 8];                 // Nehorai and Erez when the orb comes out
const SH = [98, 2];                                   // the Shadow by the screen with the orb
const GATE = [82, 2];                                 // where the orb lands and the portal opens
const OTHERS = ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam'];

// lines that are not the user's: short, in each one's voice
const START = [['ארז', 'אני עוקף אותו מהצד. כשהוא מסתובב אליי — תן לו!']];
const COVER = [['עידו', 'אנחנו מכסים מהצד הצפוני! קדימה, תנו לו!']];
const OPEN = [[['עידו', 'הוא הסתובב לארז — עכשיו, נהוראי!']], [['ארז', 'עכשיו! הוא שלך!']], [['הדר', 'הגב שלו פתוח! עכשיו!']]];
const JUMP = [[['ארז', 'הוא קופץ. אני הולך אחריו.']], [['ארז', 'שוב? בסדר, אני מתחיל לאהוב את זה.']]];
const KNEE = [['עידו', 'הוא על הברך! יש!']];
const HOLD_TIP = [['ארז', 'נהוראי! לעמוד! תחזיק ואל תעזוב!']];
const MULLER_TRY = [['מולר', 'אני מנסה לסגור אותו מכאן — הוא לא מגיב לי!', 'phone']];
const IDO_HOLD = [['עידו', 'תחזיקו! אנחנו נאחזים פה בעמודים!']];
const IDO_CRY = [['עידו', 'נהוראי!!! ארז!!!']];
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "כשהוא מכין כדור — זזים הצידה. כשהוא מסתובב אליי — יורים."';

const hp = (game, [lx, lz], yaw) => H(game, lx, lz, yaw);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// a friend sent somewhere on an errand of the squad's (he does not follow meanwhile), running there from where he is
function runTo(game, id, at, { label = '', face = null, run = true } = {}) {
  const n = game.npc(id), from = { x: n.pos.x, z: n.pos.z, yaw: n.yaw }, was = n.visible;
  stay(game, id, at, { label, face });
  if (was) { n.place(from.x, from.z, from.yaw, at.y); n.target = null; n.walkTo(at.x, at.z, { run, near: 0.3 }); }
  return n;
}
// the others to their posts on the north side (behind the pillars' line), armed
function posts(game, { run = false } = {}) {
  OTHERS.forEach((id, i) => { const at = hp(game, POSTS[i], 0); if (run) runTo(game, id, at, { label: 'מכסים' }); else stay(game, id, at, { label: 'מכסים' }); });
  armed(game, GANG);
}

// ---------- the duel: the Shadow, Erez going round him, Nehorai marking him when his guard drops ----------
function duelOn(m, game) {
  duelOff(m, game);
  const sh = game.npc('shadow');
  sh.body.enabled = true;
  m.foe = game.energy.foe({
    npc: sh, hp: HP, name: 'הצל', hint: 'הוא חוסם הכול · ארז יעקוף אותו', tag: 'ארז עוקף אותו', downPose: 'kneel',
    onHurt: () => { game.sound?.hit?.('block', 0.45); },
    onDown: () => { m.s.down = true; m.s.downAt = game.time; game.energy.clear(); later(m, KNEE); },
  });
  m.D = { phase: 'jump', t: 0.6, round: 0, atk: 2.2, k: 0, fire: 0, gang: 1.2, to: null };
}
function duelOff(m, game) {
  m.foe?.dispose(); m.foe = null; m.D = null;
  game.energy?.clear();
  game.hud.setBoss?.(null);
}
// a spot round the Shadow on the side away from Nehorai's line, clear and in plain line from him
function flankSpot(game, sh, side) {
  const W = game.world, h = HALL(game), y = h.y, me = game.player.pos, a = Math.atan2(me.x - sh.x, me.z - sh.z);
  for (const s of [side, -side]) for (const r of [6.5, 5, 8]) for (const off of [1.75, 1.45, 2.05]) {
    const b = a + s * off, p = { x: sh.x + Math.sin(b) * r, z: sh.z + Math.cos(b) * r, y };
    if (!inHall(game, p) || Math.abs(W.groundHeight(p.x, p.z, y) - y) > 0.4) continue;
    if (W.cols.raycast(sh.x, y + 1, sh.z, p.x, y + 1, p.z) !== null) continue;
    const q = { x: p.x, y, z: p.z }; W.cols.resolve(q, 0.4, y, null); if (Math.hypot(q.x - p.x, q.z - p.z) > 0.05) continue;
    return p;
  }
  return { x: sh.x, z: sh.z + 5, y };
}
function attack(m, game) {
  const foe = m.foe, me = game.player.pos, h = HALL(game);
  if (m.D.k++ % 2 === 0) foe.shoot({ speed: 6.5, warn: 0.75, r: 0.42 });
  else foe.ring({ at: { x: me.x, z: me.z, y: h.y }, r: 2.2, warn: 1.4 });
}
function duelTick(m, game, dt) {
  const D = m.D, foe = m.foe; if (!D || !foe || foe.down || game.cutscene) return;
  const sh = game.npc('shadow'), e = game.npc('erez'), me = game.player.pos;
  D.t -= dt;
  if (D.phase === 'jump') { // he fades out and comes back at the next spot (the shimmer shows where, first)
    if (D.t > 0 || foe.teleporting) return;
    const at = hp(game, SPOTS[D.round % SPOTS.length]);
    at.yaw = yawTo(at, me);
    if (foe.teleport(at, { onArrive: () => { if (m.D !== D) return; D.phase = 'flank'; D.t = 5; D.to = flankSpot(game, sh.pos, D.round % 2 ? -1 : 1); runTo(game, 'erez', D.to, { label: 'עוקף את הצל', face: sh.pos }); } })) D.phase = 'away';
    return;
  }
  if (D.phase === 'away') return;
  if (D.phase === 'flank' || D.phase === 'draw') { // his guard up, facing Nehorai; his attacks at him, each warned
    sh.lookAt(me.x, me.z); if (sh.model.pose !== 'guard') sh.model.setPose('guard');
    if ((D.atk -= dt) <= 0) { D.atk = 2.3; attack(m, game); }
  }
  if (D.phase === 'flank') { // Erez's job: round to the Shadow's side (it always ends: put there if he is slow)
    if (near(e.pos, D.to, 0.9) || D.t <= 0) {
      e.target = null; e.place(D.to.x, D.to.z, yawTo(D.to, sh.pos), D.to.y); e.model.setPose('aim');
      shotAt(game, e, { x: sh.pos.x, y: sh.pos.y + 1.2, z: sh.pos.z }, { body: { pos: sh.pos, yaw: sh.yaw, model: sh.model, r: 0.45, lo: 0.3, hi: 1.8 }, spread: 0.08 });
      D.phase = 'draw'; D.t = 0.7;
    }
  } else if (D.phase === 'draw' && D.t <= 0) { // he turns on Erez: his guard is down
    D.phase = 'open'; D.t = WINDOW; D.atk = 0.5; D.fire = 0.3;
    foe.vulnerable = true; foe.tag = 'לסמן אותו!'; sh.model.setPose(null);
    game.hud.toast('הצל פנה לארז · לירות עכשיו!', 1800);
    later(m, OPEN[D.round % OPEN.length]);
  } else if (D.phase === 'open') {
    sh.lookAt(e.pos.x, e.pos.z);
    if ((D.fire -= dt) <= 0) { D.fire = 0.6; shotAt(game, e, { x: sh.pos.x, y: sh.pos.y + 1.2, z: sh.pos.z }, { body: { pos: sh.pos, yaw: sh.yaw, model: sh.model, r: 0.45, lo: 0.3, hi: 1.8 }, spread: 0.1 }); }
    if ((D.atk -= dt) <= 0) { D.atk = 1.4; game.energy.bolt({ from: { x: sh.pos.x, y: sh.pos.y + 1.3, z: sh.pos.z }, target: e, speed: 8, warn: 0.4, hit: 'call' }); }
    if ((D.gang -= dt) <= 0) { // the others put paint on him from their posts while he is open
      D.gang = 1.3;
      const n = game.npc(OTHERS[Math.floor(Math.random() * OTHERS.length)]);
      if (n.visible && !n.target && dist(n.pos, sh.pos) < 40) shotAt(game, n, { x: sh.pos.x, y: sh.pos.y + 1.1, z: sh.pos.z }, { body: { pos: sh.pos, yaw: sh.yaw, model: sh.model, r: 0.45, lo: 0.3, hi: 1.8 }, spread: 0.12 });
    }
    if (D.t <= 0) { // the window is gone: his guard up again, and away to the next spot
      foe.vulnerable = false; foe.tag = 'ארז עוקף אותו';
      e.model.setPose(null);
      D.round++; D.phase = 'jump'; D.t = 0.5;
      later(m, JUMP[(D.round - 1) % JUMP.length]);
    }
  }
}

// ---------- the orb's quake: the walls shake, dust from the ceiling ----------
function quake(m, game, dt) {
  if (!m.s.quake) return;
  if ((m.s.qt = (m.s.qt ?? 0) - dt) > 0) return;
  m.s.qt = 0.6 + Math.random() * 0.5;
  game.follow.shake(0.08 + 0.1 * m.s.quake);
  const h = HALL(game), x = h.centre.x + (Math.random() - 0.5) * 60, z = h.centre.z + (Math.random() - 0.5) * 50;
  game.fx.dust?.(x, h.y + 0.2, z, 1.0);
}

// ---------- the pull: a pillar to hold on to ----------
function pillarFor(game, from) {
  const h = HALL(game), g = hp(game, GATE);
  let best = null, bd = Infinity;
  for (const p of h.pillars) { const d = dist(p, from); if (dist(p, g) > 9 && d < bd) { bd = d; best = p; } }
  // he holds it from the side (the pull drags him past it toward the gate); Erez trails behind him, toward the gate
  const ux = g.x - best.x, uz = g.z - best.z, ul = Math.hypot(ux, uz) || 1, px = -uz / ul, pz = ux / ul;
  const s = (from.x - best.x) * px + (from.z - best.z) * pz >= 0 ? 1 : -1;
  const at = { x: best.x + px * s * 1.15 + ux / ul * 0.35, z: best.z + pz * s * 1.15 + uz / ul * 0.35, y: h.y };
  const erez = { x: at.x + ux / ul * 1.25, z: at.z + uz / ul * 1.25, y: h.y };
  return { p: best, at, erez };
}
// the body carried through the air by hand, then let go on the floor
function fly(m, game, to, { seconds = 0.55, arc = 0.6, yaw = null, onLand = null } = {}) {
  const P = game.player; if (!P.take(m)) return;
  m.fly = { t: 0, a: { x: P.pos.x, y: P.pos.y, z: P.pos.z }, b: to, seconds, arc, yaw, onLand };
}
function flyOn(m, game, dt) {
  const f = m.fly;
  if (f) {
    const P = game.player; f.t += dt;
    const k = Math.min(1, f.t / f.seconds);
    P.pos.x = f.a.x + (f.b.x - f.a.x) * k; P.pos.z = f.a.z + (f.b.z - f.a.z) * k;
    P.pos.y = P.visualY = f.a.y + (f.b.y - f.a.y) * k + Math.sin(Math.PI * k) * f.arc;
    if (f.yaw != null) P.yaw = f.yaw;
    P.sync();
    if (k >= 1) { m.fly = null; if (!f.keep) P.release(m, f.b.y); f.onLand?.(); }
  }
  const e = m.efly;
  if (e) {
    const n = game.npc('erez'); e.t += dt;
    const k = Math.min(1, e.t / e.seconds);
    n.place(e.a.x + (e.b.x - e.a.x) * k, e.a.z + (e.b.z - e.a.z) * k, e.yaw, e.a.y);
    n.pos.y = e.a.y + (e.b.y - e.a.y) * k + Math.sin(Math.PI * k) * e.arc; n.sync();
    if (k >= 1) m.efly = null;
  }
}
function flyOff(m, game) { if (m.fly) { m.fly = null; game.player.release(m); } m.efly = null; if (game.player.scripted === m) game.player.release(m); }

// everything this mission made, put away (a restore, a cleanup)
function putAway(m, game) {
  m.beats?.cancel(); m.beats = null; m.lose?.cancel(); m.lose = null;
  flyOff(m, game);
  duelOff(m, game);
  m.held?.dispose(); m.held = null;
  m.orb?.dispose(); m.orb = null;
  m.portal = null; game.rift?.clear();
  game.nehorai?.setPose?.(null);
  game.hud.setPursuit(null);
}

// ---------- the whole scene of the checkpoint (the duel's start) ----------
// `carried`: mission 50 handed it on just now — everyone is where that scene left them; otherwise (a fresh page,
// a retry, a replay) the hall is staged as 50 leaves it
function stage(m, game, { carried = false } = {}) {
  const h = HALL(game);
  putAway(m, game);
  if (!carried) {
    clearAll(m, game);
    game.paint.dispose(); offBoard(game, ORDER);
    shadowOut(game);
    game.dimension?.(null);
    battleSky(game);
    citadelTaken(game);
    const at = { ...h.markerAt, x: h.markerAt.x + 1.2, z: h.markerAt.z - 1.0, yaw: Math.PI / 2 };
    gangAt(game, at, { ids: GANG });
    stay(game, 'erez', { x: at.x + 1.2, z: at.z + 1.4, y: h.y, yaw: Math.PI / 2 }, { label: 'בקרב' });
    shadowIn(game, hp(game, [80, 27]), yawTo(hp(game, [80, 27]), at));
  } else { offBoard(game, ORDER); armed(game, GANG); }
  game.player.crawl(false); game.player.crawlSpeed = 0.9;
  hurtLook(game, 0, 0);
  bandage(game.nehorai, true); armWrap(game.nehorai, true);
  h.screen.show('alert');
  mullerAtComputer(game);
  game.sound?.music?.('epic', { fade: 0.4 });
  m.s = { cp: 0, staged: true };
}
// a live hand-over from mission 50: the Shadow in person before them in the hall, Nehorai armed and on his feet
const carriedIn = (game) => game.npc('shadow').visible && inHall(game) && game.paint.armed && !game.paint.dropped && !game.player.crawling && game.npc('erez').visible && !game.dimensionName && game.mode === 'foot';

export default {
  id: 'rift', chapter: 10, number: 5, title: 'הקרע במציאות', requires: ['fall'], follows: true, secret: true,
  where: 'באולם המרכזי',
  startAt: (game) => { const h = game.world.places.citadel?.mainHall; return h ? { x: h.markerAt.x, z: h.markerAt.z, y: h.y } : null; },
  reward: { money: 1500, text: 'נבלעו בשער · 1,500 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; game.overlay?.mapHidden?.(false); },
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.playingAs !== 'nehorai') game.playAs('nehorai');
    const h = HALL(game); game.player.place(h.markerAt.x + 1.2, h.markerAt.z - 1, Math.PI / 2, h.y); game.follow.snapBehind(game.player.yaw);
  },
  failIf(m, game) { return m.stepIndex === 0 && !m.s.down && game.paint.hits >= OUT_AT ? LOST : null; },
  restore(m, game, cp) { stage(m, game); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game); wipeOff(m, game, dt);
    flyOn(m, game, dt);
    quake(m, game, dt);
  },
  cleanup(m, game) {
    m.held?.dispose(); m.held = null;
    if (m.done && handsTo(game, 'grove')) { // 52 takes it from here, under the white: the two of them gone through
      m.beats?.cancel(); m.beats = null; m.lose?.cancel(); m.lose = null; m.talk = [];
      flyOff(m, game); duelOff(m, game);
      game.rift.clear(); m.portal = null; m.orb = null;
      game.nehorai.setPose(null); game.npc('erez').model.setPose(null);
      shadowOut(game);
      game.cutscene = false; game.follow.override = null; game.hud.setPursuit(null);
      game.overlay?.white(1);
      return;
    }
    putAway(m, game);
    clearAll(m, game);
    hurtLook(game, 0, 0);
    game.paint.dispose(); offBoard(game, ORDER);
    shadowOut(game);
    citadelAsBuilt(game);
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    game.sound?.music?.(null, { fade: 0.6 });
    endCrew(game);
  },
  complete(m, game) { m.done = true; },

  steps: [
    { // 0: the short duel: Erez goes round him, Nehorai marks him when his guard drops
      objective: 'לפגוע בצל יחד עם ארז', checkpoint: true,
      enter(m, game) {
        if (!m.s.staged) stage(m, game, { carried: carriedIn(game) });
        freshMarks(game);
        posts(game, { run: true });
        duelOn(m, game);
        game.hud.banner('האולם המרכזי', 'הצל', 'ארז עוקף · כשהשמירה שלו יורדת — לסמן אותו', 2600);
        later(m, START); later(m, COVER);
      },
      target(m, game) { const sh = game.npc('shadow'); return sh.visible ? { x: sh.pos.x, z: sh.pos.z, y: sh.pos.y, r: 1.2 } : null; },
      update(m, game, dt) {
        duelTick(m, game, dt);
        const foe = m.foe;
        if (foe && !foe.down) say(m, game, m.D?.phase === 'open' ? 'לפגוע בצל יחד עם ארז · עכשיו!' : 'לפגוע בצל יחד עם ארז');
        return m.s.down && game.time - m.s.downAt > 1.4 && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { const sh = game.npc('shadow'); duelOff(m, game); sh.model.setPose('kneel'); game.npc('erez').model.setPose(null); },
    },
    { // 1: the orb in his hands; Muller on the radio; the throw; the portal
      objective: 'הצל מכין משהו…',
      enter(m, game) {
        const h = HALL(game), sh = game.npc('shadow'), e = game.npc('erez'), live = attempt(game, m);
        const n1 = hp(game, N1), e1 = hp(game, E1), s1 = hp(game, SH), gate = { ...hp(game, GATE), y: h.y + 1.2 };
        game.energy.clear();
        game.cutscene = true; game.hud.setCinematic(true);
        m.s.landed = false;
        m.beats = beats(game, [
          ['do', () => { // he vanishes from his knee...
            game.energy.sparks(sh.pos.x, sh.pos.y + 1, sh.pos.z, VIOLET, 26, 5); game.sound?.zap?.(0.7, 0.5);
            sh.show(false);
            game.player.place(n1.x, n1.z, yawTo(n1, s1), n1.y); game.follow.snapBehind(game.player.yaw);
            stay(game, 'erez', { ...e1, yaw: yawTo(e1, s1) }, { label: 'מול הצל', face: s1 });
            posts(game);
            game.follow.shot({ x: n1.x - 3.2, y: n1.y + 2.4, z: n1.z - 3.4 }, { x: s1.x, y: s1.y + 1.4, z: s1.z }, 9999);
          }],
          ['wait', 0.6],
          ['do', () => { // ...and stands by the screen, the orb gathering in his hands
            shadowIn(game, s1, yawTo(s1, n1)); sh.model.setOpacity?.(1);
            game.energy.sparks(s1.x, s1.y + 1, s1.z, VIOLET, 26, 5);
            h.screen.show('portal');
            m.orb = game.rift.makeOrb({ r: 0.12 });
            m.orb.holdBy(sh, { forward: 0.55, up: 1.3 }); m.orb.setSize(0.42, 2.2);
            game.follow.shot({ x: s1.x - 4.2, y: s1.y + 1.9, z: s1.z + 2.6 }, { x: s1.x, y: s1.y + 1.3, z: s1.z }, 9999);
            m.s.quake = 1; game.follow.shake(0.2);
          }],
          ['wait', 2.0],
          ['do', () => { m.orb?.setSize(0.75, 2.6); m.s.quake = 2; game.sound?.thunder?.(0.5); game.follow.shot({ x: s1.x - 8.5, y: s1.y + 2.2, z: s1.z + 3.2 }, { x: s1.x, y: s1.y + 1.3, z: s1.z }, 9999); }],
          ['say', [[...L.rift.mullerAway, 'phone']]],
          ['do', () => { game.follow.shot({ x: n1.x + 1.4, y: n1.y + 1.7, z: n1.z - 1.8 }, { x: n1.x, y: n1.y + 1.55, z: n1.z }, 9999); }],
          ['say', [L.rift.whatMeans]],
          ['say', [[...L.rift.mullerUniverse, 'phone']]],
          ['do', () => { m.orb?.setSize(0.95, 1.2); game.follow.shot({ x: s1.x - 3.0, y: s1.y + 1.6, z: s1.z - 1.6 }, { x: s1.x, y: s1.y + 1.4, z: s1.z }, 9999); }],
          ['say', [L.rift.shadowSee]],
          ['do', () => { // the throw
            sh.model.play?.('swing');
            game.follow.shot({ x: n1.x - 4.5, y: n1.y + 3.0, z: n1.z + 6.5 }, { x: gate.x, y: gate.y, z: gate.z }, 9999);
            m.orb?.throwTo(gate, 0.9, { arc: 1.2 }).then(() => { if (live()) m.s.landed = true; });
            m.s.t0 = game.time;
          }],
          ['until', () => m.s.landed || game.time - m.s.t0 > 2],
          ['do', () => { // it becomes a portal, and it grows
            m.portal = m.orb ? m.orb.toPortal({ r: 1.3, seconds: 0.9, yaw: yawTo(gate, n1) }) : new game.rift.Portal(game, { at: hp(game, GATE), r: 1.3, yaw: yawTo(gate, n1) });
            if (m.portal.state === 'closed') m.portal.open(0.9);
            m.orb = null; m.s.quake = 3;
            game.overlay?.flash('#d9ccff', 400, 0.6);
          }],
          ['wait', 1.0],
          ['do', () => { m.portal.grow(2.4, 1.4); game.follow.shake(0.35); }],
          ['wait', 1.0],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 2: the pull — a pillar to hold on to; Erez grabs him; the grip gives; both drawn in; white; silence
      objective: 'להחזיק בעמוד!',
      enter(m, game) {
        const h = HALL(game), me = game.player.pos;
        if (!m.portal) { m.portal = new game.rift.Portal(game, { at: hp(game, GATE), r: 2.4, yaw: yawTo(hp(game, GATE), me) }); m.portal.open(0); }
        m.portal.grow(3.0, 3);
        m.pil = pillarFor(game, me);
        m.held = keptPressed(game);
        m.s.held = 0; m.s.grip = false; m.s.lost = false; m.s.grabbed = false; m.s.said = 0; m.s.pulses = 0;
        // Erez holds the pillar's other side until Nehorai is on it; the others hold theirs on the north side
        const p = m.pil.p, side = { x: p.x + (p.x - m.pil.at.x), z: p.z + (p.z - m.pil.at.z), y: h.y };
        runTo(game, 'erez', side, { label: 'נאחז בעמוד', face: p });
        for (const id of OTHERS) { const n = game.npc(id); n.model.setPose('carry'); }
        game.hud.toast('להגיע לעמוד וללחוץ ממושכות', 2600);
        later(m, HOLD_TIP);
      },
      target(m, game) { return m.pil && !m.s.lost && !(m.s.grip && m.held?.held) ? { ...m.pil.at, r: 0.9 } : null; },
      interaction(m, game) {
        if (m.s.lost || !m.pil || game.mode !== 'foot' || game.player.scripted || dist(game.player.pos, m.pil.p) > 2.1) return null;
        return { label: 'להחזיק בעמוד', priority: 8, run: () => { m.s.grip = true; } };
      },
      update(m, game, dt) {
        const P = game.player, me = P.pos, e = game.npc('erez'), pt = m.portal;
        if (!m.s.lost && pt) {
          const at = dist(me, m.pil.p) <= 2.1, holding = m.s.grip && m.held?.held && at && !P.scripted;
          if (m.s.grip && !m.held?.held) m.s.grip = false;
          pt.hold(P, holding ? 1 : 0);
          if (holding) {
            m.s.held += dt;
            P.yaw = yawTo(me, m.pil.p); game.nehorai.setPose('carry');
            if (!m.s.grabbed) { // Erez is torn off his feet and catches hold of him
              m.s.grabbed = true; game.follow.yaw = Math.atan2(me.x - pt.pos.x, me.z - pt.pos.z); game.follow.idle = 0;
              const t = m.pil.erez; e.target = null; game.squad.send('erez', { x: t.x, z: t.z }, { label: 'מחזיק בנהוראי' }); e.target = null;
              m.efly = { t: 0, a: { x: e.pos.x, y: e.pos.y, z: e.pos.z }, b: t, seconds: 0.5, arc: 0.5, yaw: yawTo(t, me) };
              game.dialogue.stop?.(); game.dialogue.play([L.rift.erezHold]); m.s.said = 1;
            }
          } else if (!P.scripted) game.nehorai.setPose(null);
          if (m.s.grabbed && !m.efly) { // he hangs on behind Nehorai, toward the gate
            const t = { x: me.x + (pt.pos.x - me.x) / (dist(me, pt.pos) || 1) * 1.25, z: me.z + (pt.pos.z - me.z) / (dist(me, pt.pos) || 1) * 1.25 };
            e.target = null; e.place(t.x, t.z, yawTo(t, me), HALL(game).y); e.model.setPose('reach');
          }
          if (!P.scripted) pt.pull(P, PULL, dt);
          // at the gate's edge before his time: the gate's pulse throws him back toward the pillar (never a fail)
          if (!P.scripted && dist(me, pt.pos) < pt.r + 1.3) {
            m.s.pulses++;
            const back = { x: m.pil.at.x + (m.pil.at.x - pt.pos.x) / (dist(m.pil.at, pt.pos) || 1) * 1.5, z: m.pil.at.z + (m.pil.at.z - pt.pos.z) / (dist(m.pil.at, pt.pos) || 1) * 1.5, y: HALL(game).y };
            game.overlay?.flash('#cfc2ff', 300, 0.5); game.sound?.zap?.(0.6, 0.7);
            fly(m, game, back, { seconds: 0.6, arc: 0.8, yaw: yawTo(back, m.pil.p) });
            game.hud.toast('השער הדף אותך אחורה · לעמוד, ולהחזיק!', 2200);
          }
          if (m.s.said === 1 && m.s.held > 2.2) { m.s.said = 2; later(m, MULLER_TRY); }
          if (m.s.said === 2 && m.s.held > 4.2) { m.s.said = 3; later(m, IDO_HOLD); }
          const k = Math.max(0.12, 1 - m.s.held / GRIP * 0.85);
          game.hud.setPursuit(m.s.grip ? `אחיזה · ${Math.round(k * 100)}%` : 'לא מחזיק!');
          if (m.s.held >= GRIP && !game.dialogue.busy && !m.efly) lose(m, game);
        }
        m.lose?.update(dt);
        return m.lose?.done ? 'next' : null;
      },
      exit(m, game) { m.held?.dispose(); m.held = null; m.lose = null; game.hud.setPursuit(null); },
    },
  ],
};

// the grip gives (by script): the film, then both drawn into the gate; the white; two seconds of silence
function lose(m, game) {
  if (m.s.lost) return;
  m.s.lost = true;
  const pt = m.portal, e = game.npc('erez'), P = game.player, live = attempt(game, m);
  game.hud.setPursuit(null);
  m.s.film = false;
  game.playCutscene('c10-portal', () => Promise.resolve()).then(() => { if (live()) m.s.film = true; });
  m.lose = beats(game, [
    ['until', () => m.s.film],
    ['do', () => {
      game.cutscene = true; game.hud.setCinematic(true);
      pt.hold(P, 0); game.nehorai.setPose(null); game.sound?.hit?.('block', 0.5);
      const me = P.pos, c = { x: pt.pos.x, z: pt.pos.z, y: HALL(game).y };
      game.follow.shot({ x: me.x + (me.x - c.x) * 0.6 + 2.5, y: me.y + 2.6, z: me.z + (me.z - c.z) * 0.6 + 2.5 }, { x: c.x, y: pt.pos.y, z: c.z }, 9999);
      fly(m, game, c, { seconds: 1.3, arc: 0.7, yaw: yawTo(me, c) }); if (m.fly) m.fly.keep = true;
      m.efly = { t: 0, a: { x: e.pos.x, y: e.pos.y, z: e.pos.z }, b: { x: c.x, z: c.z, y: c.y }, seconds: 1.1, arc: 0.6, yaw: yawTo(e.pos, c) };
      pt.grow(3.4, 0.8); game.follow.shake(0.6); game.sound?.thunder?.(1.1);
    }],
    ['say', IDO_CRY],
    ['until', () => !m.fly && !m.efly],
    ['do', () => { game.overlay?.flash('#ffffff', 500, 1); game.overlay?.whiteOut(0.45); game.follow.shake(0.4); }],
    ['wait', 0.5],
    ['do', () => { // white, and nothing: the portal's hum and the music gone
      game.overlay?.white(1);
      game.sound?.quiet?.();
      game.rift.clear(); m.portal = null;
      m.s.quake = 0; m.s.silent = true;
    }],
    ['wait', 2.0],
  ]);
}
