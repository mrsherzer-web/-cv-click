// Chapter ten, mission 4 (50): הנפילה של הגיבור. The gang comes into the central tower's main hall; the Shadow on
// the giant screen, the lines; the hall's defence wakes and is the first boss: emitters in the ceiling and on the
// walls fire warned energy at Nehorai (bolts, rings on the floor, a sweeping beam) while Muller, at the main
// computer in control room B, opens the three control nodes one by one and Erez and Ido call out which is open;
// Erez beside him quiets an emitter now and then, Ido and the others hold the hall's door against the Order.
// Then the energy attack: it is meant for Erez, Nehorai steps in front of him and is thrown against the wall, his
// marker falls, he tries to rise and drops to his knees; Ido's cry, Erez over him; the Shadow comes in person and
// Erez stands between them. Hurt play — never a fail: crawl to the low cover while Erez keeps the Shadow busy
// (his bolts only knock back), crawl to the first-aid box, use it, be helped up by Erez, pick the marker up. The
// lines; the music back hard; mission 51 carries on. Paint, never blood: no wound is shown, a bandage goes on.
// Invented, all of it.
import { near, say } from './missions.js';
import { OUT_AT } from '../combat/paint.js';
import { L } from './lines10.js';
import { attempt, handsOver, endCrew, gone, Work, helpUp } from './infinity.js';
import { ORDER, beats, later, talkOn, hush, stay, gangAt, armed, freshMarks, wipeOff, post, offBoard, standing, bandage, armWrap, clearAll } from './phoenix-d.js';
import { HALL, H, Z, yawTo, inHall, citadelTaken, citadelAsBuilt, battleSky, shadowIn, shadowOut, mullerAtComputer, GANG, shotAt, hurtLook } from './infinity-b.js';

const VIOLET = '#8a6bff', RED = '#ff3b6b', DIM = '#3a2a66';
const HP = 3;                     // pellets (a long marker's count double) to put a control node out
const GAPS = [3.4, 2.9, 2.4];     // seconds between the defence's attacks, by the nodes already out
const OPEN_AFTER = [5, 6, 6];     // Muller's seconds to open the next node
const DOOR_TEAM = ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam'];
const DOOR_POSTS = [[36.5, -3.4], [36.5, 3.4], [38.8, -6], [38.8, 6], [40.6, -2.4], [40.6, 2.4]];
const WAVES = [['og1', 'og2'], ['og3', 'og4'], ['og5', 'og6']];        // at the tower door while the nodes fall
const TRICKLE = [['og7', 'og8'], ['og9', 'og10'], ['og11', 'og12']];   // and while Nehorai is hurt
const GUARDS = [...WAVES.flat(), ...TRICKLE.flat()];

// the spots of the scene, by the hall's own coordinates (see infinity-b's H)
const ENTER_LX = 44;                         // in this far, the screen comes on
const E1 = [66, 23.5], N1 = [62.4, 25.2];   // Erez and Nehorai when the strong attack comes
const N2 = [66.3, 22.4];                    // the step in front of Erez
const EK = [67.2, 33.1];                    // Erez kneeling by him at the wall
const S0 = [90, 20], S3 = [80, 27];         // the Shadow coming in, and where he stands
const E3 = [74.6, 30.4];                    // Erez between them
const COVER = [70.8, 26.6];                 // behind the low cover at (72, 26), out of the Shadow's line
const E6 = [60.6, 32.4];                    // Erez by the first-aid box, to help him up

// lines that are not the user's: short, in each one's voice
const WAKE = [['מולר', 'נהוראי, ההגנה של האולם ננעלה עליך. אני פותח לך את המוקדים אחד-אחד — תפגע בכל אחד שנדלק.', 'phone']];
const CALLS = [
  [['עידו', 'נהוראי! המוקד ליד הכניסה נפתח — משמאל לך!']],
  [['ארז', 'השני פתוח! ליד המסך, בצד שמאל!']],
  [['עידו', 'האחרון! באמצע הקיר הימני!']],
];
const DOWN = [[['מולר', 'יפה! עוד שניים. פותח את הבא.', 'phone']], [['מולר', 'נשאר אחד. המערכת שלהם כבר מזיעה.', 'phone']]];
const DOOR = [['עידו', 'יש לנו אורחים בדלת! אנחנו מחזיקים אותם — תתרכז במוקדים!']];
const TIP = [['ארז', 'טבעת על הרצפה — זזים. קרן — מאחורי עמוד!']];
const CRAWL = [['ארז', 'לזחול, אחי! אל המחסה הנמוך — אני מחזיק אותו!']];
const PINNED = [['עידו', 'אנחנו תקועים פה בדלת! ארז, אל תיתן לו להתקרב!']];
const KIT = [['ארז', 'יש לך ערכה על הקיר, משמאל. לזחול לשם!']];
const COMING = [['ארז', 'אני בא אליך. תן יד.']];
const UP = [['ארז', 'הנה, על הרגליים. הרובה שלך שם, ליד העמוד.']];
const IN = [['עידו', 'הדלת נקייה! אנחנו בפנים!']];
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "כשטבעת נדלקת מתחתיך — זזים. מהקרן מסתתרים מאחורי עמוד."';

const hp = (game, [lx, lz], yaw) => H(game, lx, lz, yaw);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- the hall's defence: the first boss ----------
function defenceOn(m, game) {
  defenceOff(m, game);
  const h = HALL(game), P = game.paint;
  for (const e of h.defence.emitters) e.set(RED);
  m.nodes = h.defence.nodes.map((nd, i) => {
    nd.set(false);
    const rec = { i, nd, hp: HP, open: false, done: false, ring: null, x: nd.x, y: h.y + 1.1, z: nd.z };
    rec.t = P.addTarget({ pos: { x: nd.x, y: h.y, z: nd.z }, r: 0.62, lo: 0.2, hi: 1.75, on: false, onHit: (pt, power) => hitNode(m, game, rec, power) });
    return rec;
  });
  m.d = { t: 3, i: 0, stall: 0, quiet: [], erez: 4, breath: 0 };
  m.s.node = -1; m.s.down = 0; m.s.wait = OPEN_AFTER[0];
}
function defenceOff(m, game) {
  for (const r of m.nodes || []) { game.paint.removeTarget(r.t); if (r.ring) gone(r.ring); }
  m.nodes = []; m.d = null;
  game.energy?.clear();
  const h = HALL(game);
  for (const e of h.defence.emitters) e.set(DIM);
}
function openNode(m, game, i) {
  const r = m.nodes[i]; if (!r || r.done) return;
  r.open = true; r.t.on = true; r.nd.set(true);
  r.ring = game.fx.ring(r.x, HALL(game).y + 0.05, r.z, 1.25);
  m.s.node = i;
  game.sound?.beep?.(2, 980);
  game.hud.setPursuit(null);
  later(m, CALLS[i]);
}
function hitNode(m, game, r, power) {
  if (!r.open || r.done) return;
  r.hp -= power || 1;
  game.energy.sparks(r.x, r.y + 0.4, r.z, VIOLET, 10, 4);
  game.sound?.hit?.('block', 0.5);
  if (r.hp > 0) { game.hud.pop(`מוקד ${r.i + 1} · ${Math.max(0, Math.ceil(r.hp))}`, 'counter'); return; }
  r.done = true; r.open = false; r.t.on = false; r.nd.set(false);
  if (r.ring) { gone(r.ring); r.ring = null; }
  game.fx.explode(r.x, r.y, r.z, { size: 0.7, debris: false, fire: 0 });
  game.hud.pop('המוקד נפל!', 'counter');
  m.s.down++; m.s.node = -1;
  game.energy.clear(); m.d.stall = 2.6; m.d.t = 1.6;
  if (m.s.down < 3) { m.s.wait = OPEN_AFTER[m.s.down]; later(m, DOWN[m.s.down - 1]); wave(m, game, WAVES[m.s.down]); }
  else for (const e of HALL(game).defence.emitters) e.set(DIM);
}
// one of the defence's attacks at Nehorai, each with its warning: a bolt from the nearest ceiling emitter that
// gathers first and flies slowly enough to step aside, a ring that fills under him, or a beam from the wall on the
// far side that sweeps the hall (a pillar or the low cover stops it)
function attack(m, game) {
  const D = m.d, h = HALL(game), E = h.defence.emitters, me = game.player.pos, k = Math.min(2, m.s.down), now = game.time;
  const kind = ['bolt', 'ring', 'bolt', 'beam'][D.i++ % 4];
  const quiet = (i) => (D.quiet[i] || 0) > now;
  if (kind === 'bolt') {
    const e = E.slice(0, 5).map((e, i) => ({ e, i })).filter((q) => !quiet(q.i)).sort((a, b) => dist(a.e, me) - dist(b.e, me))[0]?.e;
    if (e) { game.energy.bolt({ from: { x: e.x, y: e.y - 0.45, z: e.z }, target: 'player', speed: 6 + k * 0.6, warn: 0.75 }); return; }
  }
  if (kind === 'beam') {
    const south = me.z > h.centre.z, i = south ? 5 : 6, e = E[i];
    if (!quiet(i)) {
      const c = south ? 0 : Math.PI, s = D.i % 8 < 4 ? 1 : -1;
      game.energy.beamSweep({ from: { x: e.x, z: e.z + (south ? 0.9 : -0.9), y: h.y }, angle0: c - 0.8 * s, angle1: c + 0.8 * s, len: 70, warn: 1.4, seconds: 2.8 });
      return;
    }
  }
  game.energy.ringAttack({ at: { x: me.x, z: me.z, y: h.y }, r: 2.4, warn: 1.6 - k * 0.1 });
}
// Erez puts a pellet into an emitter now and then: it goes dark and quiet for a few seconds
function erezShot(m, game) {
  const D = m.d, e = game.npc('erez'); if (!e.visible || !inHall(game, e.pos)) return;
  const E = HALL(game).defence.emitters, i = Math.floor(Math.random() * 5), em = E[i];
  shotAt(game, e, { x: em.x, y: em.y, z: em.z });
  game.energy.sparks(em.x, em.y - 0.2, em.z, '#ffb070', 8, 3);
  D.quiet[i] = game.time + 5; em.set(DIM);
}
function defenceTick(m, game, dt) {
  const D = m.d; if (!D) return;
  for (let i = 0; i < 7; i++) if (D.quiet[i] && D.quiet[i] <= game.time && m.s.down < 3) { D.quiet[i] = 0; HALL(game).defence.emitters[i].set(RED); }
  for (const r of m.nodes) if (r.ring) r.ring.material.opacity = 0.35 + 0.3 * Math.sin(game.time * 7);
  if (m.s.down >= 3) return;
  if (m.s.node < 0) { // Muller at work on the next node
    m.s.wait -= dt;
    game.hud.setPursuit(`מולר פותח את מוקד ${m.s.down + 1} · ${Math.max(0, Math.ceil(m.s.wait))}`);
    if (m.s.wait <= 0) openNode(m, game, m.s.down);
  }
  if (D.stall > 0) { D.stall -= dt; return; }
  if (!inHall(game) || game.cutscene) return;
  if ((D.t -= dt) <= 0) { D.t = GAPS[Math.min(2, m.s.down)]; attack(m, game); }
  if ((D.erez -= dt) <= 0) { D.erez = 5.5 + Math.random() * 2; erezShot(m, game); }
}

// ---------- the hall's door: Ido and the others hold it against the Order ----------
function doorTeam(m, game, { run = false } = {}) {
  DOOR_TEAM.forEach((id, i) => { const [lx, lz] = DOOR_POSTS[i], at = H(game, lx, lz, -Math.PI / 2); if (run) runTo(game, id, at, { label: 'מחזיקים את הדלת' }); else stay(game, id, at, { label: 'מחזיקים את הדלת' }); });
  armed(game, GANG);
}
// a friend sent somewhere on an errand of the squad's (he does not follow meanwhile), running there from where he is
function runTo(game, id, at, { label = '', face = null, run = true } = {}) {
  const n = game.npc(id), from = { x: n.pos.x, z: n.pos.z, yaw: n.yaw }, was = n.visible;
  stay(game, id, at, { label, face });
  if (was) { n.place(from.x, from.z, from.yaw, at.y); n.target = null; n.walkTo(at.x, at.z, { run, near: 0.3 }); }
  return n;
}
// a pair of the Order's people come at the tower door from the inner compound (they walk to just outside it)
function wave(m, game, ids) {
  post(game, ids.map((id, i) => ({ id, at: [H(game, 8, i ? 2.2 : -2.2), H(game, 24, i ? 2.6 : -2.6)], yaw: Math.PI / 2 })));
  m.door = { ids, t: 0, k: m.door?.k ?? 0 };
}
// while Nehorai is hurt: whenever the pair at the door is down, another comes a little later
function doorTick(m, game, dt) {
  const D = m.door; if (!D || !m.trickle) return;
  if (standing(game, D.ids) > 0) { D.t = 0; return; }
  if ((D.t += dt) > 7) { const k = (D.k + 1) % TRICKLE.length; wave(m, game, TRICKLE[k]); m.door.k = k; }
}

// ---------- the throw: the body carried through the air by hand, then let go on the floor ----------
function fly(m, game, to, { seconds = 0.55, arc = 1.1, yaw = null, onLand = null } = {}) {
  const P = game.player; if (!P.take(m)) return;
  m.fly = { t: 0, a: { x: P.pos.x, y: P.pos.y, z: P.pos.z }, b: to, seconds, arc, yaw, onLand };
}
function flyOn(m, game, dt) {
  const f = m.fly; if (!f) return;
  const P = game.player; f.t += dt;
  const k = Math.min(1, f.t / f.seconds);
  P.pos.x = f.a.x + (f.b.x - f.a.x) * k; P.pos.z = f.a.z + (f.b.z - f.a.z) * k;
  P.pos.y = P.visualY = f.a.y + (f.b.y - f.a.y) * k + Math.sin(Math.PI * k) * f.arc;
  if (f.yaw != null) P.yaw = f.yaw;
  P.sync();
  if (k >= 1) { m.fly = null; P.release(m, f.b.y); f.onLand?.(); }
}
function flyOff(m, game) { if (m.fly) { m.fly = null; game.player.release(m); } }

// ---------- the Shadow and Erez while Nehorai is hurt ----------
// `at`: whom the Shadow's bolts go for — 'both' (one in two at Nehorai), 'some' (one in three), 'erez', or null
// (he stands and gloats). At Nehorai they only knock back (warned; the low cover stops them); at Erez they miss
function duel(m, game, dt, at) {
  const sh = game.npc('shadow'), e = game.npc('erez'), me = game.player.pos, D = (m.duel ||= { t: 2.2, i: 0, erez: 0.8 });
  if (!sh.visible) return;
  const busy = at && e.visible && !m.help?.active;
  sh.lookAt(busy ? e.pos.x : me.x, busy ? e.pos.z : me.z);
  if (at && (D.t -= dt) <= 0) {
    D.t = 2.5 + Math.random() * 0.9;
    const toHim = at === 'both' ? D.i % 2 === 0 : at === 'some' ? D.i % 3 === 0 : false; D.i++;
    const from = { x: sh.pos.x + Math.sin(sh.yaw) * 0.5, y: sh.pos.y + 1.35, z: sh.pos.z + Math.cos(sh.yaw) * 0.5 };
    if (toHim) game.energy.bolt({ from, target: 'player', speed: 5.5, warn: 0.85, hit: 'knock', knock: 1.2, label: 'הדף!' });
    else if (e.visible) game.energy.bolt({ from, target: e, speed: 7, warn: 0.6, hit: 'call' });
  }
  if (busy && !game.cutscene && (D.erez -= dt) <= 0) {
    D.erez = 1.1 + Math.random() * 0.7;
    shotAt(game, e, { x: sh.pos.x, y: sh.pos.y + 1.2, z: sh.pos.z }, { body: { pos: sh.pos, yaw: sh.yaw, model: sh.model, r: 0.45, lo: 0.3, hi: 1.8 }, spread: 0.1 });
  }
}

// ---------- the whole scene of a checkpoint ----------
function stage(m, game, cp, { keepHere = false } = {}) {
  const h = HALL(game), me = game.player.pos;
  const here = keepHere && game.mode === 'foot' && Math.hypot(me.x - h.outside.x, me.z - h.outside.z) < 14 && Math.abs(me.y - h.y) < 2.5 ? { x: me.x, z: me.z, y: me.y, yaw: game.player.yaw } : null;
  clearAll(m, game);
  flyOff(m, game); m.help?.cancel(); m.help = null; m.kit = null; m.duel = null; m.trickle = false; m.door = null;
  defenceOff(m, game);
  game.paint.dispose(); offBoard(game, ORDER); // (whoever of the Order an earlier mission left about)
  shadowOut(game);
  game.dimension?.(null);
  battleSky(game);
  citadelTaken(game);
  h.screen.show(cp === 1 ? 'shadow' : cp === 3 ? 'alert' : 'off');
  game.player.crawl(false); game.player.crawlSpeed = 0.9;
  hurtLook(game, 0, 0);
  bandage(game.nehorai, true); armWrap(game.nehorai, false); // chapter nine's bandage still on; the kit is still to come
  if (cp === 0) gangAt(game, here || h.outside, { ids: GANG, walk: !!here });
  else if (cp === 1) { gangAt(game, H(game, 46, 0, Math.PI / 2), { ids: GANG }); doorTeam(m, game); }
  else {
    gangAt(game, h.thrownAt, { ids: GANG });
    doorTeam(m, game);
    game.paint.drop(h.markerAt);
    stay(game, 'erez', hp(game, E3), { label: 'מול הצל', face: hp(game, S3) });
    shadowIn(game, hp(game, S3), yawTo(hp(game, S3), h.thrownAt));
    game.player.place(h.thrownAt.x, h.thrownAt.z, h.thrownAt.yaw ?? Math.PI, h.thrownAt.y);
    game.follow.snapBehind(game.player.yaw);
  }
  mullerAtComputer(game);
  game.sound?.music?.(cp === 1 ? 'action' : null, { fade: 0.4 });
  m.s = { cp };
}

export default {
  id: 'fall', chapter: 10, number: 4, title: 'הנפילה של הגיבור', requires: ['citadel'], follows: true,
  where: 'במגדל המרכזי',
  startAt: (game) => { const h = Z(game)?.mainHall; return h ? { x: h.outside.x, z: h.outside.z, y: h.outside.y } : null; },
  reward: { money: 1500, text: 'נהוראי נפל — וקם · 1,500 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; m.nodes = []; game.overlay?.mapHidden?.(false); },
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.playingAs !== 'nehorai') game.playAs('nehorai');
    const o = HALL(game).outside; game.player.place(o.x, o.z, o.yaw ?? Math.PI / 2, o.y); game.follow.snapBehind(game.player.yaw);
  },
  failIf(m, game) { return m.stepIndex === 1 && game.paint.hits >= OUT_AT ? LOST : null; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game); wipeOff(m, game, dt);
    flyOn(m, game, dt);
    doorTick(m, game, dt);
  },
  cleanup(m, game) {
    flyOff(m, game); m.help?.cancel(); m.help = null;
    defenceOff(m, game);
    game.hud.setPursuit(null);
    if (m.done && handsOver(game)) { // mission 51 takes it from here: the Shadow before them, Erez beside Nehorai, the
      // gang in and armed, the music on (no clearAll: it would quiet the music and drop the sky)
      m.beats?.cancel(); m.beats = null; m.talk = []; m.kit = null;
      game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
      offBoard(game, GUARDS);
      return;
    }
    clearAll(m, game);
    game.player.crawl(false); game.player.crawlSpeed = 0.9;
    hurtLook(game, 0, 0);
    game.paint.dispose(); offBoard(game, GUARDS);
    shadowOut(game);
    citadelAsBuilt(game);
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    game.sound?.music?.(null, { fade: 0.6 });
    endCrew(game);
  },
  complete(m, game) { m.done = true; },

  steps: [
    { // 0: in through the tower's door; the Shadow on the giant screen; the defence wakes
      objective: 'להיכנס לאולם המרכזי',
      enter(m, game) { stage(m, game, 0, { keepHere: true }); m.s.p = 'walk'; },
      target(m, game) { return m.s.p === 'walk' ? { ...H(game, ENTER_LX + 2, 0), r: 1.6 } : null; },
      update(m, game, dt) {
        const h = HALL(game), me = game.player.pos;
        if (m.s.p === 'walk' && inHall(game) && me.x - h.centre.x + 72 >= ENTER_LX) {
          m.s.p = 'scene';
          game.cutscene = true; game.hud.setCinematic(true);
          const s = h.screenAt;
          game.follow.shot({ x: me.x - 1.4, y: me.y + 2.1, z: me.z + 2.2 }, { x: s.x + 4, y: s.y + 3.9, z: s.z }, 9999);
          game.sound?.music?.(null, { fade: 0.5 });
          m.beats = beats(game, [
            ['do', () => { h.screen.show('static'); game.sound?.radioStatic?.(true, { level: 0.08 }); }],
            ['wait', 0.7],
            ['do', () => { h.screen.show('shadow'); game.sound?.radioStatic?.(false); game.follow.shake(0.15); }],
            ['say', [L.fall.shadowStop]],
            ['do', () => { game.follow.shot({ x: me.x + 2.6, y: me.y + 1.75, z: me.z - 1.2 }, { x: me.x, y: me.y + 1.5, z: me.z }, 9999); }],
            ['say', [L.fall.iKnow]],
            ['do', () => { // the defence wakes: the emitters light one after another
              game.follow.shot({ x: h.centre.x - 20, y: h.y + 3.2, z: h.centre.z + 6 }, { x: h.centre.x + 6, y: h.y + 5.5, z: h.centre.z }, 9999);
              h.defence.emitters.forEach((e, i) => setTimeout(() => { if (game.missions.active === m) { e.set(RED); game.sound?.beep?.(1, 600 + i * 70); } }, i * 120));
              game.sound?.zap?.(0.6, 0.8);
            }],
            ['wait', 1.2],
            ['say', WAKE],
          ]);
        }
        m.beats?.update(dt);
        return m.s.p === 'scene' && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the first boss — the hall's defence and its three control nodes
      objective: 'לפגוע בשלושת מוקדי ההגנה (0/3)', checkpoint: true,
      enter(m, game) {
        if (m.s.cp !== 1) doorTeam(m, game, { run: true });
        HALL(game).screen.show('shadow');
        defenceOn(m, game);
        freshMarks(game);
        wave(m, game, WAVES[0]);
        game.hud.banner('האולם המרכזי', 'מערכת ההגנה', 'שלושה מוקדים · מולר פותח אותם אחד-אחד', 2800);
        game.sound?.music?.('action', { fade: 0.4 });
        later(m, DOOR); later(m, TIP);
      },
      target(m, game) {
        const r = m.nodes?.[m.s.node] || m.nodes?.[m.s.down];
        return r ? { ...r.nd.at, r: 1.2 } : null;
      },
      update(m, game, dt) {
        defenceTick(m, game, dt);
        say(m, game, `לפגוע בשלושת מוקדי ההגנה (${m.s.down}/3)`);
        if (m.s.down >= 3) { m.s.after = (m.s.after || 0) + dt; if (m.s.after > 1.4) return 'next'; }
        return null;
      },
      exit(m, game) { game.hud.setPursuit(null); },
    },
    { // 2: the strong attack: meant for Erez, Nehorai steps in front of him; thrown at the wall; the marker falls
      objective: 'נהוראי!',
      enter(m, game) {
        const h = HALL(game), e = game.npc('erez'), live = attempt(game, m);
        game.energy.clear(); m.d && (m.d.stall = 99);
        m.s.film = false;
        game.playCutscene('c10-fall', () => Promise.resolve()).then(() => { if (live()) m.s.film = true; });
        const n1 = hp(game, N1), n2 = hp(game, N2), e1 = hp(game, E1), ek = hp(game, EK), t = h.thrownAt;
        m.beats = beats(game, [
          ['until', () => m.s.film],
          ['do', () => {
            game.cutscene = true; game.hud.setCinematic(true);
            game.sound?.music?.(null, { fade: 0.4 });
            for (const r of m.nodes) { r.t.on = false; if (r.ring) { gone(r.ring); r.ring = null; } }
            stay(game, 'erez', { ...e1, yaw: Math.PI / 2 }, { label: 'בקרב' }); e.model.setPose('aim');
            game.player.place(n1.x, n1.z, yawTo(n1, e1), n1.y);
            h.screen.show('shadow');
            const em = h.defence.emitters[2]; em.set('#ffffff');
            game.follow.shot({ x: n1.x - 7.5, y: n1.y + 2.6, z: n1.z + 4.5 }, { x: e1.x + 1, y: e1.y + 1.6, z: e1.z - 4 }, 9999);
            game.sound?.zap?.(1.2, 0.6); game.follow.shake(0.3);
            m.s.t0 = game.time;
            m.bolt = game.energy.bolt({ from: { x: em.x, y: em.y - 0.5, z: em.z }, to: { x: n2.x, y: n2.y + 1.25, z: n2.z }, speed: 15, warn: 1.1, r: 0.55, hit: 'call' });
          }],
          ['wait', 0.6],
          ['do', () => { game.nehorai.play?.('shove'); fly(m, game, n2, { seconds: 0.4, arc: 0.08, yaw: yawTo(n2, h.defence.emitters[2]) }); }],
          ['until', () => !m.fly && (m.bolt.done || Math.hypot(m.bolt.x - n2.x, m.bolt.z - n2.z) < 1.3 || game.time - m.s.t0 > 3.2)],
          ['do', () => { // the hit: white light, the crack, thrown back against the wall; the marker flies out of his hands
            m.bolt.cancel?.(); m.bolt = null;
            const me = game.player.pos;
            game.overlay?.flash('#e6dcff', 650, 1); game.sound?.thunder?.(1.4); game.follow.shake(1.3);
            game.energy.sparks(me.x, me.y + 1.2, me.z, VIOLET, 40, 7);
            game.paint.drop(h.markerAt);
            game.nehorai.setPose('floored');
            hurtLook(game, 0.9, 0.3);
            game.follow.shot({ x: t.x - 6.5, y: t.y + 2.2, z: t.z - 6 }, { x: t.x - 1, y: t.y + 0.8, z: t.z - 3 }, 9999);
            fly(m, game, t, { seconds: 0.6, arc: 1.3, yaw: t.yaw ?? Math.PI, onLand: () => { game.follow.shake(0.8); game.sound?.hit?.('crash', 0.9); game.nehorai.setPose('floored'); } });
          }],
          ['until', () => !m.fly],
          ['wait', 1.1],
          ['do', () => { game.nehorai.setPose('halfup'); game.sound?.hit?.('block', 0.3); }],
          ['wait', 0.7],
          ['do', () => { game.nehorai.setPose('kneel'); game.follow.shake(0.2); hurtLook(game, 0.95, 0.5); }],
          ['wait', 0.6],
          ['do', () => { // Ido, from the door
            const i = game.npc('ido');
            i.lookAt(t.x, t.z);
            game.follow.shot({ x: i.pos.x + 2.4, y: i.pos.y + 1.8, z: i.pos.z + 2.6 }, { x: i.pos.x, y: i.pos.y + 1.5, z: i.pos.z }, 9999);
          }],
          ['say', [L.fall.idoCry]],
          ['do', () => {
            runTo(game, 'erez', ek, { label: 'לידו' }); m.s.t1 = game.time;
            game.follow.shot({ x: t.x - 4.5, y: t.y + 1.7, z: t.z - 4 }, { x: t.x, y: t.y + 0.7, z: t.z - 0.8 }, 9999);
          }],
          ['until', () => near(e.pos, ek, 0.8) || game.time - m.s.t1 > 3.5],
          ['do', () => { e.target = null; e.place(ek.x, ek.z, yawTo(ek, t), h.y); e.model.setPose('kneel'); game.follow.shot({ x: t.x - 1.6, y: t.y + 1.1, z: t.z - 2.4 }, { x: ek.x, y: ek.y + 1.0, z: ek.z }, 9999); }],
          ['say', [L.fall.erezAnswer]],
          ['do', () => { // the Shadow in person: out of the door under the screen
            h.screen.show('alert');
            const s0 = hp(game, S0), s3 = hp(game, S3), sh = shadowIn(game, s0, yawTo(s0, s3));
            game.energy.sparks(s0.x, s0.y + 1.2, s0.z, VIOLET, 24, 4); game.sound?.zap?.(0.8, 0.5);
            sh.walkTo(s3.x, s3.z, { near: 0.4 }); m.s.t2 = game.time;
            game.follow.shot({ x: t.x - 0.6, y: t.y + 1.3, z: t.z - 0.9 }, { x: s3.x, y: s3.y + 1.4, z: s3.z }, 9999);
          }],
          ['until', () => near(game.npc('shadow').pos, hp(game, S3), 0.7) || game.time - m.s.t2 > 7],
          ['do', () => { const sh = game.npc('shadow'), s3 = hp(game, S3); sh.target = null; sh.place(s3.x, s3.z, yawTo(s3, t), s3.y); }],
          ['say', [L.fall.shadowHero]],
          ['do', () => { // Erez up and between them
            const e3 = hp(game, E3); e.model.setPose(null);
            runTo(game, 'erez', e3, { label: 'מול הצל', face: hp(game, S3) }); m.s.t3 = game.time;
            game.follow.shot({ x: t.x - 1.2, y: t.y + 1.0, z: t.z - 0.6 }, { x: (e3.x + hp(game, S3).x) / 2, y: e3.y + 1.4, z: (e3.z + hp(game, S3).z) / 2 }, 9999);
          }],
          ['until', () => near(e.pos, hp(game, E3), 0.7) || game.time - m.s.t3 > 3],
          ['do', () => { const e3 = hp(game, E3); e.target = null; e.place(e3.x, e3.z, yawTo(e3, hp(game, S3)), e3.y); e.model.setPose('aim'); }],
          ['say', [L.fall.erezStand]],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) {
        m.beats = null; flyOff(m, game); m.bolt = null;
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        defenceOff(m, game);
      },
    },
    { // 3: hurt: crawl to the low cover while Erez keeps the Shadow busy (nothing here fails: his bolts only knock back)
      objective: 'לזחול אל המחסה', checkpoint: true,
      enter(m, game) {
        const h = HALL(game);
        h.screen.show('alert');
        game.player.crawl(true, { speed: 1.1 });
        hurtLook(game, 0.55, 1.2);
        m.trickle = true; if (!m.door) wave(m, game, TRICKLE[0]);
        game.energy.clear();
        later(m, CRAWL); later(m, PINNED);
        game.hud.toast('נהוראי פצוע · זוחלים עם המקל', 3000);
      },
      target(m, game) { return { ...hp(game, COVER), r: 0.9 }; },
      update(m, game, dt) { duel(m, game, dt, 'both'); return near(game.player.pos, hp(game, COVER), 0.95) ? 'next' : null; },
    },
    { // 4: to the first-aid box on the wall
      objective: 'להגיע לערכת העזרה הראשונה',
      enter(m, game) { later(m, KIT); },
      target(m, game) { return { ...HALL(game).medkitAt, r: 1.0 }; },
      update(m, game, dt) { duel(m, game, dt, 'some'); return near(game.player.pos, HALL(game).medkitAt, 1.2) ? 'next' : null; },
    },
    { // 5: the kit: a few seconds of work; the bandage goes on and the blur eases
      objective: 'להשתמש בערכה',
      enter(m, game) {
        const h = HALL(game);
        m.kit = new Work(game, { at: h.medkitAt, seconds: 4, near: 1.7, label: 'להשתמש בערכה', pill: 'חובש את עצמו', onStart: () => { game.sound?.beep?.(1, 700); }, onDone: () => {
          m.s.kit = true;
          bandage(game.nehorai, true); armWrap(game.nehorai, true);
          hurtLook(game, 0.25, 2.2);
        } });
      },
      target(m, game) { return { ...HALL(game).medkitAt, r: 1.0 }; },
      interaction(m, game) { return m.kit?.interaction(game) || null; },
      update(m, game, dt) { duel(m, game, dt, 'erez'); m.kit?.update(dt); return m.s.kit ? 'next' : null; },
      exit(m, game) { m.kit = null; },
    },
    { // 6: Erez comes over and helps him up
      objective: 'להיעזר בארז כדי לקום',
      enter(m, game) {
        const e = game.npc('erez'), e6 = hp(game, E6);
        game.energy.clear();
        e.model.setPose(null); runTo(game, 'erez', e6, { label: 'בא לעזור' }); m.s.t6 = game.time;
        later(m, COMING);
      },
      target(m, game) { const e = game.npc('erez'); return m.help ? null : { x: e.pos.x, z: e.pos.z, y: e.pos.y, r: 1.0 }; },
      interaction(m, game) {
        const e = game.npc('erez');
        if (m.help || game.mode !== 'foot' || !near(game.player.pos, e.pos, 2.4) || Math.abs(e.pos.y - game.player.pos.y) > 1.2) return null;
        return { label: 'לקום בעזרת ארז', priority: 7, run: () => { m.help = helpUp(game, e, { onDone: () => { m.s.up = true; } }); } };
      },
      update(m, game, dt) {
        const e = game.npc('erez'), e6 = hp(game, E6);
        duel(m, game, dt, null);
        if (!m.help && e.target && game.time - m.s.t6 > 4) { e.target = null; e.place(e6.x, e6.z, yawTo(e6, game.player.pos), e6.y); }
        if (!m.help && !e.target) e.lookAt(game.player.pos.x, game.player.pos.z);
        return m.s.up ? 'next' : null;
      },
      exit(m, game) {
        m.help = null; game.player.crawl(false); game.player.crawlSpeed = 0.9;
        hurtLook(game, 0.12, 1.5);
        later(m, UP);
      },
    },
    { // 7: the marker, where it fell
      objective: 'לאסוף את הרובה',
      enter(m, game) {
        const e = game.npc('erez'), h = HALL(game);
        const at = { x: h.markerAt.x + 1.4, z: h.markerAt.z + 1.2, y: h.y };
        runTo(game, 'erez', at, { label: 'מכסה עליו', face: hp(game, S3), run: false });
      },
      target(m, game) { const d = game.paint.dropped; return d ? { x: d.x, z: d.z, y: d.y, r: 0.9 } : null; },
      interaction(m, game) {
        if (game.mode !== 'foot' || !game.paint.nearDropped(1.7)) return null;
        return { label: 'להרים את הרובה', priority: 7, run: () => { if (game.paint.pickUp()) { m.s.armed = true; game.sound?.beep?.(1, 880); } } };
      },
      update(m, game, dt) { duel(m, game, dt, null); return m.s.armed || game.paint.armed ? 'next' : null; },
    },
    { // 8: on his feet, the marker in his hands; the lines; the music back hard. 51 carries on
      objective: 'נהוראי חוזר לקרב!',
      enter(m, game) {
        const h = HALL(game), sh = game.npc('shadow'), e = game.npc('erez'), me = game.player.pos;
        game.energy.clear();
        game.cutscene = true; game.hud.setCinematic(true);
        hurtLook(game, 0, 1.2);
        game.sound?.music?.('epic', { fade: 0.25 });
        game.follow.shake(0.25);
        game.player.yaw = yawTo(me, sh.pos); game.player.sync?.();
        e.lookAt(sh.pos.x, sh.pos.z);
        game.follow.shot({ x: me.x - Math.sin(game.player.yaw) * 2.6 + 1.2, y: me.y + 1.8, z: me.z - Math.cos(game.player.yaw) * 2.6 }, { x: sh.pos.x, y: sh.pos.y + 1.4, z: sh.pos.z }, 9999);
        m.beats = beats(game, [
          ['say', [L.fall.yourProblem]],
          ['do', () => { game.follow.shot({ x: sh.pos.x - Math.sin(sh.yaw) * -2.4 + 1, y: sh.pos.y + 1.8, z: sh.pos.z - Math.cos(sh.yaw) * -2.4 }, { x: sh.pos.x, y: sh.pos.y + 1.5, z: sh.pos.z }, 9999); }],
          ['say', [L.fall.shadowWhat]],
          ['do', () => { game.follow.shot({ x: me.x + 1.6, y: me.y + 1.7, z: me.z - 1.8 }, { x: me.x, y: me.y + 1.55, z: me.z }, 9999); }],
          ['say', [L.fall.stopTalking]],
          ['do', () => { // the door is clear: the last of the Order there sit down marked, and the gang comes in
            m.trickle = false;
            for (const gd of game.paint.guards) if (!gd.marked && gd.npc.visible) game.paint.markGuard(gd, 'door');
            for (const id of DOOR_TEAM) game.squad.tasks.delete(id);
            game.squad.tasks.delete('erez');
            game.squad.form(GANG, { near: me, yaw: game.player.yaw, leader: 'nehorai', walk: true });
            armed(game, GANG);
            game.follow.shot({ x: me.x - 3, y: me.y + 2.4, z: me.z + 3.2 }, { x: h.inside.x + 8, y: me.y + 1.2, z: h.inside.z }, 9999);
          }],
          ['say', IN],
          ['wait', 0.4],
        ]);
      },
      target(m, game) { const sh = game.npc('shadow'); return sh.visible ? { x: sh.pos.x, z: sh.pos.z, y: sh.pos.y, r: 1.2 } : null; },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
};
