// Chapter ten, mission 9, "הגיבורים חוזרים". Out of the white, in the citadel's main hall: Muller at the machine can
// hardly hold the way back open; it widens and Nehorai and Erez come flying out of it onto the floor. Ido runs to
// them, Muller can't believe it, and across the hall the Shadow, come down the stairs with four of his men, can't
// either. The music breaks out, the whole gang lines up (the camera along the line), Muller has already shut the
// Shadow's own portal, and Nehorai raises his marker: the last fight. Then the hand-over is the player's: the Shadow
// pulls back up the tower behind his men, and Nehorai leads the gang up the stairs to the energy hall, where
// mission 56 carries on. Paint for everyone; nobody of the gang betrays, nobody dies. Invented, all of it.
import { near, say } from './missions.js';
import { Portal } from '../fx/portal.js';
import { L } from './lines10.js';
import { endCrew } from './infinity.js';
import {
  CIT, ORDER, TEAM, hall, MULLER_AT, GATE_AT, hold, buddiesOff, onlyThese, freshMarks, clearScene, machineConsole,
  inCitadel, citadelBack, groveBack, asNehorai, dolly, attempt, become, nehoraiAway, armed, offBoard, beats, later, talkOn,
  bandage, armWrap, hush,
} from './infinity-c.js';

const R = L.return;
const GUARDS = ['og15', 'og16', 'og17', 'og18']; // the four of the Order beside the Shadow (not in mission 54's waves)

// ---------- the main hall (the tower's own frame: x 32 at the main door … 112 at the giant screen, z -36 north … 36 south) ----------
const FLOOR = (g) => CIT(g).mainHall.y;
// the way back opens over the machine's anchor in front of the screen; its middle stays at this height as it widens
const GATE_H = 2.9, GATE_SMALL = 1.25, GATE_WIDE = 2.6;
// where the two come down, flung out of it westward, just short of the low cover at x 88
const NEH_LAND = (g) => hall(g, 90.6, -1.1, -Math.PI / 2);
const ERZ_LAND = (g) => hall(g, 91.3, 1.4, -Math.PI / 2);
// out of sight while the hall waits for them (behind the first shot's camera)
const AWAY = (g) => hall(g, 52, 24, 0);
// the gang round the machine, watching the gate (Muller at the console)
const WATCH = (g) => ({
  ido: hall(g, 101.6, -3.6), yonati: hall(g, 101.0, 4.2), avraham: hall(g, 99.0, 5.8),
  dolev: hall(g, 103.4, -6.8), hadar: hall(g, 99.0, -5.8), liam: hall(g, 103.6, 6.6),
});
// the Shadow come down the stairs in the north-east corner, his four men in front of him (west of the pillar at
// 96,-14, which would stand between him and the gang)
const SHADOW_AT = (g) => hall(g, 93, -27, 0);
const GUARD_AT = (g) => ({ og15: hall(g, 89.6, -22.4), og16: hall(g, 92.5, -21.5), og17: hall(g, 95.5, -22), og18: hall(g, 97.4, -25.6) });
// the line, west to east, every one of them facing the Shadow; Nehorai in the middle
const LINE_Z = -6.2;
const LINE = { liam: 87.2, hadar: 89.2, dolev: 91.2, erez: 93.3, nehorai: 95.4, ido: 97.5, yonati: 99.5, avraham: 101.5, muller: 103.5 };
const lineAt = (g, id) => hall(g, LINE[id], LINE_Z);
// the stairs up to the energy hall: the foot (east of the first step) and the top, on the energy hall's floor
const FOOT = (g) => ({ ...CIT(g).mainHall.stairsAt });
const TOP = (g) => ({ ...CIT(g).energyHall.stairsTop });
const UP = (g) => { const Z = CIT(g), f = Z.energyHall.stairsTop; return { ...Z.toWorld(87.5, -33.7), y: f.y }; }; // a step past the top: where his men go in

// the lines that are not the user's: short, the friends' own voices
const FLOOR_LINE = [['ארז', 'רצפה. רצפה אמיתית. אני אוהב רצפה.']];
const CLIMB = [
  [['הדר', 'הוא בורח למעלה? שיברח. אנחנו באים.']],
  [['ליאם', 'מדרגות. למה אצל הרעים זה תמיד מדרגות?']],
  [['דולב', 'נהוראי… טוב שחזרתם. באמת.'], ['נהוראי', 'טוב לחזור, אחי.']],
  [['יונתי', 'אני סוגר מאחור. אף אחד לא נשאר מאחור.']],
];
// on the energy hall's floor, west of the stairs' top (clear of the hole's rail, the cover at x 92 and the cell at 84,-27):
// where anyone of the gang still on the way comes up beside him
const TOP_SPOTS = [[88.0, -31.2], [86.4, -32.8], [86.4, -30.0], [88.6, -29.0], [84.8, -31.4], [87.0, -27.6], [89.6, -27.0], [85.4, -28.8]];
function upWithHim(game) {
  const Z = CIT(game), y = Z.energyHall.y, p = game.player.pos;
  game.squad.ids.forEach((id, i) => {
    const n = game.npc(id);
    if (Math.abs(n.pos.y - p.y) < 1.5 && near(n.pos, p, 12)) return;
    const [lx, lz] = TOP_SPOTS[i % TOP_SPOTS.length], at = Z.toWorld(lx, lz);
    n.target = null; n.place(at.x, at.z, game.player.yaw, y); n.show(true);
  });
}
const ARRIVE = [['ארז', 'אולם האנרגיה. הם מחכים לנו בפנים.'], ['עידו', 'שיחכו. אנחנו כבר פה.']];
const OFFLINE = { title: 'הפורטל הושבת', sub: 'אין לאן לברוח', color: '#ff9180' };

// ---------- people ----------
function standAt(game, id, at, { yaw = null, show = true, solid = true } = {}) {
  const n = game.npc(id);
  game.paint.removeAlly(n);
  n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null);
  n.place(at.x, at.z, yaw ?? at.yaw ?? n.yaw, at.y ?? null); n.show(show); n.body.enabled = show && solid;
  return n;
}
const faceTo = (n, p) => { n.yaw = Math.atan2(p.x - n.pos.x, p.z - n.pos.z); n.lookAt(p.x, p.z); };
// the Shadow and his four at the foot of the stairs, facing the gang (shown or not yet)
function shadowSide(game, show) {
  const t = NEH_LAND(game), s = SHADOW_AT(game), G = GUARD_AT(game);
  const sh = standAt(game, 'shadow', s, { show, solid: false }); sh.model.setArmor?.(false); faceTo(sh, t);
  for (const id of GUARDS) faceTo(standAt(game, id, G[id], { show, solid: false }), t);
}

// ---------- the whole scene at a checkpoint (a retry, a reload): who is played, where, the world, the doors ----------
function stage(m, game, cp) {
  m.gate?.dispose(); m.gate = null; m.dolly = null; m.fly = []; m.away = [];
  if (game.player.scripted) game.player.release(game.player.scripted, FLOOR(game));
  clearScene(m, game);
  game.paint.dispose(); offBoard(game, ORDER); buddiesOff(game);
  game.squad.dismiss();
  m.s = { cp }; m.said = null;
  // the ordinary world (mission 54 hands on inside the grove's dimension, under the white), the tower standing,
  // the main door open behind the gang
  groveBack(game);
  inCitadel(game, { screen: cp === 0 ? 'portal' : 'text', progress: 1 });
  if (cp > 0) CIT(game).mainHall.screen.show('text', OFFLINE);
  asNehorai(game);
  game.nehorai.setPose(null);
  const con = machineConsole(game, true);
  if (cp === 0) {
    // the hall waits: Muller at the console holding the way back, the others round the machine watching it;
    // Nehorai and Erez are still on the other side (out of sight here), the Shadow not come down yet
    con.set(1);
    const a = AWAY(game); game.player.place(a.x, a.z, 0, a.y); game.follow.snapBehind(0);
    onlyThese(game, TEAM.filter((id) => id !== 'erez'));
    standAt(game, 'erez', a, { show: false });
    hold(game, 'muller', MULLER_AT(game));
    const W = WATCH(game), gate = GATE_AT(game);
    for (const id of Object.keys(W)) faceTo(hold(game, id, W[id]), gate);
    shadowSide(game, false);
    game.sound?.music?.(null, { fade: 0.3 });
  } else {
    // the line, facing the Shadow across the hall, every marker in hand; the music on
    con.set(0.15);
    const me = lineAt(game, 'nehorai'), s = SHADOW_AT(game), yaw = Math.atan2(s.x - me.x, s.z - me.z);
    game.player.place(me.x, me.z, yaw, me.y); game.follow.snapBehind(yaw);
    onlyThese(game, TEAM);
    for (const id of TEAM) faceTo(standAt(game, id, lineAt(game, id)), s);
    armed(game, TEAM);
    shadowSide(game, true);
    game.sound?.music?.('epic', { fade: 0.4 });
  }
  game.paint.reset(); freshMarks(game);
}

// ---------- the two bodies flung out of the gate onto the floor ----------
// `who` an Npc, or null for the player (the controller's body taken for the flight and given back on the floor)
function flyOut(m, game, who, from, to, { seconds = 0.75, arc = 0.7 } = {}) {
  if (!who && !game.player.take(m)) return;
  if (who) { who.show(true); who.body.enabled = false; }
  m.fly.push({ who, a: from, b: to, T: seconds, H: arc, t: 0, yaw: Math.atan2(to.x - from.x, to.z - from.z) });
}
function flyOn(m, game, dt) {
  for (const f of m.fly || []) {
    if (f.done) continue;
    f.t += dt;
    const k = Math.min(1, f.t / f.T), x = f.a.x + (f.b.x - f.a.x) * k, z = f.a.z + (f.b.z - f.a.z) * k, y = f.a.y + (f.b.y - f.a.y) * k + f.H * 4 * k * (1 - k);
    const pose = k < 1 ? 'tuck' : 'floored';
    if (f.who) { const n = f.who; n.target = null; n.floorY = y; n.place(x, z, f.yaw); n.model.setPose(pose); }
    else { const P = game.player; P.pos.x = x; P.pos.y = P.visualY = y; P.pos.z = z; P.yaw = f.yaw; P.sync(); game.nehorai.setPose(pose); }
    if (k < 1) continue;
    f.done = true;
    if (f.who) f.who.floorY = null; else game.player.release(m, f.b.y);
    game.sound?.hit?.('crash', 0.5); game.follow.shake?.(0.2);
  }
}
const landed = (m) => (m.fly || []).length >= 2 && m.fly.every((f) => f.done);

// ---------- the Shadow's men pull back up the tower: to the stairs' foot, up, and in ----------
function pullBack(m, game) {
  const legs = [hall(game, 106, -29), FOOT(game), TOP(game), UP(game)]; // round the stairwell's side to its foot, up, in
  m.away = [{ id: 'shadow', wait: 0 }, ...GUARDS.map((id, i) => ({ id, wait: 0.9 + i * 0.35 }))].map((r) => ({ ...r, n: game.npc(r.id), legs, i: 0, t: 0 }));
}
function awayOn(m, game, dt) {
  for (const r of m.away || []) {
    if (r.gone) continue;
    if ((r.wait -= dt) > 0) continue;
    const n = r.n;
    r.t += dt;
    if (!n.visible) { r.gone = true; continue; }
    if (!n.target) {
      if (r.i >= r.legs.length || r.t > 22) { n.target = null; n.show(false); r.gone = true; continue; }
      const p = r.legs[r.i++]; n.walkTo(p.x, p.z, { run: true, near: 0.7 });
    }
  }
}

// ---------- a moving camera ----------
const lookAt = (p, up = 1.5) => ({ x: p.x, y: p.y + up, z: p.z });
const from = (g, lx, lz, up) => { const p = hall(g, lx, lz); return { x: p.x, y: p.y + up, z: p.z }; };

export default {
  id: 'return', chapter: 10, number: 9, title: 'הגיבורים חוזרים', requires: ['gateback'], follows: true, secret: true,
  where: 'במצודה',
  startAt: (game) => { const Z = CIT(game); return Z ? { ...Z.mainHall.inside, r: 2 } : null; },
  reward: { money: 500, text: 'החבורה שוב ביחד · 500 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; m.fly = []; m.away = []; },
  // the start, from anywhere: on foot, out of any dimension, in the citadel's main hall (step 0 stages the rest,
  // the white first)
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    game.player.crawl?.(false);
    game.rift?.clear(); if (game.dimensionName) game.dimension(null);
    const p = NEH_LAND(game); game.player.place(p.x, p.z, p.yaw, p.y); game.follow.snapBehind(p.yaw);
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    flyOn(m, game, dt);
    awayOn(m, game, dt);
    m.dolly?.update(dt);
    // the way back flickers while Muller can hardly hold it
    if (m.s.shaky && m.gate) {
      if ((m.s.flick = (m.s.flick ?? 0) - dt) <= 0) {
        m.s.flick = 0.32;
        m.gate.grow(GATE_SMALL * (0.82 + Math.random() * 0.36), 0.28);
        const g = GATE_AT(game); game.energy?.sparks?.(g.x, g.y + GATE_H + (Math.random() - 0.5) * 2, g.z + (Math.random() - 0.5) * 2.4, '#b48cff', 5, 2.5);
      }
    }
    // Muller stays at his console while it is his; the gang's eyes on the gate
    if (m.stepIndex === 0 && m.s.atConsole) { const n = game.npcs.get('muller'), c = machineConsole(game, true).group.position; if (n?.visible) { n.target = null; n.lookAt(c.x + 2, c.z); } }
  },
  cleanup(m, game) {
    const carry = !!m.done && handsTo(game, 'laststand');
    if (game.player.scripted === m) game.player.release(m, FLOOR(game));
    m.gate?.dispose(); m.gate = null; m.dolly = null; m.fly = [];
    machineConsole(game, false);
    for (const id of ['shadow', ...GUARDS]) { const n = game.npc(id); n.target = null; n.model.setPose(null); n.show(false); }
    offBoard(game, ORDER);
    if (carry) {
      // mission 56 carries on: Nehorai at the top of the stairs on the energy hall's floor, bandaged and armed, the
      // gang formed up and armed behind him, the music on; the tower's main door open as the gang left it
      game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
      m.beats?.cancel(); m.beats = null; m.talk = [];
      game.nehorai.setPose(null);
      return;
    }
    clearScene(m, game);
    groveBack(game);
    citadelBack(game);
    become(game, 'nehorai'); // (always: it also takes another leader's name off the squad's toasts)
    game.nehorai.setPose(null);
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    nehoraiAway(game);
    for (const id of TEAM) game.npc(id).model.setPose(null);
    endCrew(game);
  },

  steps: [
    { // 0: out of the white, in the main hall: the way back widens, the landing, the Shadow, the line
      objective: 'במצודה · מולר מחזיק את הפורטל',
      // the white the leap left holds a breath (on a carry-on it never went; on a fresh start it is put up), then
      // the hall is staged under it
      enter(m, game) {
        game.overlay?.white?.(1);
        game.cutscene = true; game.hud.setCinematic(true);
        m.s = { cp: 0, white: 0.5 };
      },
      begin(m, game) {
        stage(m, game, 0);
        game.overlay?.white?.(1);
        game.cutscene = true; game.hud.setCinematic(true);
        const s = m.s, gate = GATE_AT(game), y = FLOOR(game);
        m.gate = new Portal(game, { at: gate, r: GATE_SMALL, height: GATE_H, yaw: -Math.PI / 2, rumble: 0.25 });
        m.gate.open(0);
        s.atConsole = true;
        // the hall, waiting: the machine, Muller at it, the gate over its anchor, the gang watching
        game.follow.shot(from(game, 86.5, -8, 2.6), { x: gate.x + 4, y: y + 2, z: gate.z + 0.4 }, 9999);
        const live = attempt(game, m), team = game.npc.bind(game);
        const P = game.player, N = NEH_LAND(game), E = ERZ_LAND(game), sh = SHADOW_AT(game);
        const out = (dz) => ({ x: gate.x - 0.4, z: gate.z + dz, y: y + GATE_H - 1.0 });
        m.beats = beats(game, [
          ['do', () => game.overlay?.whiteIn?.(1.1)],
          ['wait', 1.2],
          ['do', () => { s.shaky = true; game.follow.shake?.(0.15); }],
          ['say', [R.mullerHold]],
          // the film of the gate tearing open (if there is one), then the game's own
          ['do', () => {
            s.film = false;
            game.playCutscene('c10-return', () => Promise.resolve()).then(() => {
              if (!live()) return;
              game.cutscene = true; game.hud.setCinematic(true); s.film = true;
            });
          }],
          ['until', () => s.film],
          ['do', () => {
            s.shaky = false; m.gate.grow(GATE_WIDE, 0.9);
            game.sound?.thunder?.(0.6); game.follow.shake?.(0.45);
            game.follow.shot(from(game, 85.2, 4.4, 1.8), { x: (gate.x + N.x) / 2, y: y + 1.2, z: gate.z }, 9999);
          }],
          ['wait', 1.0],
          ['do', () => { flyOut(m, game, null, out(-0.5), N); s.flying = true; }],
          ['wait', 0.15],
          ['do', () => flyOut(m, game, team('erez'), out(0.6), E, { seconds: 0.8, arc: 0.8 })],
          ['until', () => landed(m)],
          ['do', () => {
            s.landed = true;
            m.gate.close(0.9); machineConsole(game, true).set(0.15); s.atConsole = false;
            CIT(game).mainHall.screen.show('static');
            const ido = team('ido'); ido.walkTo(N.x + 1.6, N.z - 1.5, { run: true, near: 0.5, onArrive: () => ido.lookAt(N.x, N.z) });
          }],
          ['wait', 0.5],
          ['say', [R.idoCry]],
          ['do', () => { const mu = team('muller'); mu.lookAt(N.x, N.z); }],
          ['say', [R.mullerBack]],
          // up off the floor
          ['do', () => { game.nehorai.setPose('getup'); team('erez').model.setPose('getup'); }],
          ['wait', 0.8],
          ['do', () => {
            game.nehorai.setPose(null); team('erez').model.setPose(null);
            P.yaw = Math.atan2(sh.x - P.pos.x, sh.z - P.pos.z); P.sync();
            faceTo(team('erez'), sh);
            for (const id of ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller']) faceTo(team(id), sh);
          }],
          ['say', FLOOR_LINE],
          // across the hall: the Shadow, come down the stairs with four of his men
          ['do', () => {
            shadowSide(game, true); s.shadow = true;
            CIT(game).mainHall.screen.show('shadow');
            const p = P.pos, dx = sh.x - p.x, dz = sh.z - p.z, d = Math.hypot(dx, dz);
            game.follow.shot({ x: p.x - dx / d * 3.2 - 0.9, y: p.y + 2.1, z: p.z - dz / d * 3.2 + 0.6 }, lookAt(sh, 1.4), 9999);
          }],
          ['wait', 1.0],
          ['do', () => game.follow.shot(from(game, 94.2, -17.6, 1.9), lookAt(sh, 1.75), 9999)],
          ['say', [R.shadowImpossible]],
          ['do', () => {
            const p = P.pos, dx = sh.x - p.x, dz = sh.z - p.z, d = Math.hypot(dx, dz);
            game.follow.shot({ x: p.x + dx / d * 2.8 + 0.7, y: p.y + 1.65, z: p.z + dz / d * 2.8 }, lookAt(p, 1.6), 9999);
          }],
          ['say', [R.missedMe]],
          // the music breaks out, and everyone lines up facing him
          ['do', () => {
            game.sound?.music?.('epic', { fade: 0.4 });
            const me = lineAt(game, 'nehorai');
            P.place(me.x, me.z, Math.atan2(sh.x - me.x, sh.z - me.z), me.y);
            for (const id of TEAM) { const n = team(id), at = lineAt(game, id); n.walkTo(at.x, at.z, { run: true, near: 0.4, onArrive: () => n.lookAt(sh.x, sh.z) }); }
            game.follow.shot(from(game, 80, 6, 4.8), { x: me.x + 2, y: y + 1, z: me.z }, 9999);
          }],
          ['wait', 2.6],
          ['do', () => {
            for (const id of TEAM) { const n = team(id), at = lineAt(game, id); if (!near(n.pos, at, 0.8)) { n.target = null; n.place(at.x, at.z, n.yaw, at.y); } faceTo(n, sh); }
            // the camera along the line, from Muller's end to Liam's, in front of them
            m.dolly = dolly(game, { from: from(game, 105.6, -9.8, 1.7), to: from(game, 85.2, -9.8, 1.7), look: lookAt(lineAt(game, 'muller'), 1.45), lookTo: lookAt(lineAt(game, 'liam'), 1.45), seconds: 10 });
            s.lined = true;
          }],
          ['say', [R.ready]],
          ['say', [R.always]],
          ['say', [R.idoFinish]],
          ['do', () => CIT(game).mainHall.screen.show('text', OFFLINE)],
          ['say', [R.mullerPortal]],
          // Nehorai raises his marker
          ['do', () => {
            m.dolly = null; armed(game, TEAM); s.raised = true;
            game.nehorai.setPose('aim');
            const me = P.pos;
            game.follow.shot({ x: me.x + 1.3, y: me.y + 0.9, z: me.z - 2.6 }, lookAt(me, 1.55), 9999);
          }],
          ['wait', 0.5],
          ['say', [R.lastFight]],
          ['wait', 0.4],
        ]);
      },
      target: () => null, // a scene from end to end (the marker's beam would stand in the middle of the shots)
      update(m, game, dt) {
        if (m.s.white > 0) { if ((m.s.white -= dt) <= 0) this.begin(m, game); return null; }
        m.beats?.update(dt); return m.beats?.done ? 'next' : null;
      },
      exit(m, game) {
        m.beats = null; m.dolly = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        game.nehorai.setPose(null); game.follow.snapBehind(game.player.yaw);
      },
    },
    { // 1: the Shadow pulls back up the tower behind his men; Nehorai leads the gang to the energy hall
      objective: 'להוביל את החבורה אל אולם האנרגיה', checkpoint: true,
      enter(m, game) {
        const s = m.s;
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        game.squad.form(TEAM, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
        armed(game, TEAM);
        pullBack(m, game);
        game.hud.toast('הצל נסוג למעלה במגדל · אחריו!', 2600);
        s.up = false; s.there = false; s.t = 0; s.said = 0;
      },
      target(m, game) {
        if (m.s.there) return null;
        return m.s.up ? { ...TOP(game), r: 2.2 } : { ...FOOT(game), r: 2.2 };
      },
      update(m, game, dt) {
        const s = m.s, p = game.player.pos, top = TOP(game), y = FLOOR(game);
        s.t += dt;
        if (!s.up && (p.y > y + 0.8 || near(p, FOOT(game), 2.6))) s.up = true;
        // the friends' own lines on the way, one every few seconds
        if (s.said < CLIMB.length && s.t > 3 + s.said * 6) later(m, game, CLIMB[s.said++]);
        if (!s.there) {
          say(m, game, s.up ? 'להוביל את החבורה אל אולם האנרגיה · במדרגות למעלה' : 'להוביל את החבורה אל אולם האנרגיה · אל המדרגות בפינה הצפונית');
          if (near(p, top, 3) && Math.abs(p.y - top.y) < 1.3) {
            s.there = true; m.talk = [];
            say(m, game, 'אולם האנרגיה · החבורה איתך');
            // the friends come up behind him (the squad brings anyone left below up on his trail); nobody waits long
            m.beats = beats(game, [
              ['until', () => game.squad.ids.every((id) => { const n = game.npc(id); return Math.abs(n.pos.y - p.y) < 1.5 && near(n.pos, p, 12); }) || s.t > (s.at ??= s.t) + 3],
              ['do', () => upWithHim(game)],
              ['say', ARRIVE],
            ]);
          }
          return null;
        }
        m.beats?.update(dt);
        return m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; },
    },
  ],
  complete(m, game) { m.done = true; },
};

// on completion the scene is left only for mission 56, which carries straight on (never after a replay)
function handsTo(game, id) { const M = game.missions, n = M.next(); return !!M.carrying && n?.id === id && !!n.follows && M.ready(n); }
