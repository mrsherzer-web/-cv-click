// Chapter nine, mission 12, "בריחה מהתופת". The Shadow turns on the tower's self-destruct from wherever his lift took
// him: 05:00 – ESCAPE! Nehorai, Erez and Ido and the whole gang down and out before it goes up, floor by floor along
// the emergency lights' green arrows, the tower coming apart round them: blasts (each with its ring and beeps
// first), fire and smoke, the elevator dead, a beam across the storage floor's hall (the way round through the
// shelves), the server floor's emergency gate slamming shut ahead of them (its manual release), a beam down on
// Avraham on the security floor (Nehorai lifts it), the lobby's shutter locked (the exit switch by the door opens it
// and the plaza's vehicle gate), the last two of the Order in the lobby, and the Renault waiting on the plaza with
// Liam, who ran to the port for it. Everyone in, out through the vehicle gate and away, and from the road the gang
// watches the tower go up. Paint for the Order's people; a blast knocks you down, nothing worse. The whole gang stays
// loyal; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { TEAM, Work, failOut, handsOver, endCrew, pin, gone, crewInCar, crewOutOfCar, dropBeam } from './phoenix.js';
import {
  TW, T, ORDER, onFloor, floorOf, hush, armed, gangAt, freshMarks, wipeOff, post, offBoard, standing, nearestOf, TBlast,
  towerRed, beats, later, talkOn, bandage, clearAll, assaulted, towerReset, escapeClock, mmss,
} from './phoenix-d.js';

const LIMIT = 300;
const FLOORS = [LIMIT, LIMIT, 250, 210, 170, 130, 95];   // the least the clock shows when a checkpoint is picked up again
const LOBBY = [{ id: 'og15', lx: -8, lz: 10 }, { id: 'og16', lx: 7.5, lz: 13.5 }];
const LIDS = LOBBY.map((g) => g.id);
const RIDE = TEAM.filter((id) => id !== 'liam');
const FAR = 150;

const SELF = [['הצל', 'אתם עוד שם? מצוין. מערכת השמדה עצמית: פעילה.', 'phone'], ['קול ברמקול', 'השמדה עצמית בעוד חמש דקות.']];
const GO = [['ארז', 'כולם החוצה! עכשיו!'], ['עידו', 'המעלית מתה. תאורת החירום מסמנת את הדרך — אחרי החצים הירוקים!']];
const BEAM = [['ארז', 'המסדרון חסום! דרך המדפים!']];
const GATE = [['עידו', 'שער החירום נטרק! יש שחרור ידני בצד שלנו!']];
const GATE_OPEN = [['ארז', 'פתוח! ממשיכים!']];
const FALL = [['אברהם', 'רגע! אני רוצה להגיד משהו… תרימו את זה ממני!']];
const UP = [['אברהם', 'תודה, אחי. את הנאום אני שומר לבחוץ.'], ['נהוראי', 'רוץ, אברהם!']];
const LOBBYDOWN = [['עידו', 'התריס נעול! המתג ליד הדלת!']];
const SWITCHED = [['ארז', 'התריס עלה! וגם שער הרכבים!']];
const CAR = [['ליאם', 'אחים! לפה! הרנו מחכה!'], ['ארז', 'כולם לרנו!']];
const DRIVE = [['עידו', 'דרך שער הרכבים, דרומה! סע, סע!']];
const LOOK = [['ארז', 'תעצור. תסתכלו אחורה.']];
const AFTER = [['עידו', 'וזה… היה המגדל השחור.'], ['דולב', 'בפעם הבאה אני נשאר בבית.'], ['נהוראי', 'עכשיו הביתה. כולם.']];
const TIMEOUT = 'המגדל התפוצץ לפני שיצאתם. ארז: "מההתחלה. אחרי החצים הירוקים, ולא עוצרים לשום דבר."';
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "שוב. כשיש טבעת אדומה — לצאת ממנה, לא לעמוד בה."';

// the way round the beam on the storage floor: through the opening at x -3, east along the first aisle, back out at x 3
const DETOUR = [[-3, -13.4], [-3, -10.2], [3, -10.2], [3, -13.4]];
// where the escape picks up at each checkpoint (the foot of each flight on its way down)
function startAt(game, cp) {
  const t = TW(game), r = t.escape.route;
  return [T(game, 0, 8, 4, Math.PI), T(game, 0, 8, 4, Math.PI), { ...r[7], yaw: 0 }, { ...r[12], yaw: 0 }, { ...r[18], yaw: 0 }, { ...r[23], yaw: 0 }, { ...t.lobby.outside, yaw: 0 }][cp];
}
const chevGeo = (() => { const s = new THREE.Shape([[0, 0.34], [0.38, -0.12], [0.18, -0.12], [0, 0.1], [-0.18, -0.12], [-0.38, -0.12]].map(([a, b]) => new THREE.Vector2(a, b))); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); })();
function detourMarks(m, game) {
  const pts = DETOUR.map(([lx, lz]) => T(game, lx, lz, 3)), g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#39ff7a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), yaw = Math.atan2(-dx, -dz);
    for (let s = 0.6; s < len - 0.2; s += 1.6) { const c = new THREE.Mesh(chevGeo, mat); c.position.set(a.x + dx * s / len, a.y + 0.06, a.z + dz * s / len); c.rotation.y = yaw; c.renderOrder = 2; g.add(c); }
  }
  game.scene.add(g); m.detour = { g, mat, pts };
}
function clearDetour(m) { if (!m.detour) return; m.detour.g.removeFromParent(); m.detour.mat.dispose(); m.detour = null; }

function stage(m, game, cp, left) {
  clearAll(m, game); clearDetour(m);
  const t = TW(game), E = t.escape, c = t.command;
  game.daylight?.set(1, 0);
  assaulted(game);
  c.door.unlock(); c.door.setOpen(true); c.escapeDoor.lock(); c.screen.show('alarm');
  t.lobby.door.lock(); t.exitGate.lock(); E.switchLamp.set('#ff2a2a');      // the self-destruct sealed them
  if (cp >= 6) E.throwSwitch(true);
  game.paint.dispose(); offBoard(game, ORDER); game.npc('shadow').show(false);
  // the gang with him; Liam is at the port, then at the Renault on the plaza
  gangAt(game, startAt(game, cp), { ids: RIDE });
  const L = game.npc('liam');
  game.car.repair(); game.car.place(E.car.x, E.car.z, E.car.yaw, E.car.y);
  if (cp >= 6) { const q = game.car.local(-2.2, 0.8); L.target = null; L.idle = null; L.place(q.x, q.z, game.car.yaw + Math.PI, E.car.y); L.show(true); } else L.show(false);
  bandage(game.nehorai, true);
  E.mark(true); towerRed(game);
  m.stopSiren = game.sound?.siren?.(LIMIT + 30) || null;
  game.sound?.music?.('action', { fade: 0.4 });
  // fire and smoke on the floors already burning
  const burn = (lx, lz, k, r = 1) => { const p = T(game, lx, lz, k); m.smoke.push(game.fx.burn(p.x, p.y + 0.05, p.z, { r, strength: 1.2, seconds: 900 }), game.fx.smokeColumn(p.x, p.y + 0.5, p.z, { r: r * 0.9, seconds: 900 })); };
  burn(10, 15, 4, 1.3); burn(-9, 7, 4); if (cp >= 2) burn(-8, -17.2, 3); if (cp >= 3) burn(13, -17.4, 2); if (cp >= 4) burn(10, -17.8, 1);
  m.s = { cp, t0: game.time - (LIMIT - left), used: new Set(), boomT: 4, gateShut: cp >= 4 ? 'open' : null, freed: cp >= 5, beam: cp >= 3, posted: false };
  escapeClock(game, left);
}
const leftOf = (m, game) => LIMIT - (game.time - m.s.t0);
// the next point of the marked way on his floor (the one after the nearest), or the detour round the beam
function nextOnRoute(m, game) {
  const E = TW(game).escape, me = game.player.pos, i = E.routeIndex(me);
  const p = E.route[Math.min(E.route.length - 1, i + 1)];
  return { x: p.x, z: p.z, y: p.y, r: 1.6 };
}
// blasts by the way: each spot once, when he comes near it on its floor; never right on top of him
// (only the spots clear of the marked way: whoever follows the green arrows is never inside a ring)
function spots(m, game) {
  if (m.spots) return m.spots;
  const r = TW(game).escape.route, off = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l)); return Math.hypot(p.x - a.x - dx * u, p.z - a.z - dz * u); };
  m.spots = TW(game).escape.blasts.filter((p) => { for (let i = 0; i + 1 < r.length; i++) if (Math.abs(r[i].y - p.y) < 1.5 && Math.abs(r[i + 1].y - p.y) < 1.5 && off(p, r[i], r[i + 1]) < 4.2) return false; return true; });
  return m.spots;
}
function blasts(m, game, dt) {
  const me = game.player.pos;
  for (const p of spots(m, game)) {
    if (m.s.used.has(p) || Math.abs(p.y - me.y) > 1.5) continue;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d < 11 && d > 4) { m.s.used.add(p); m.live.push(new TBlast(game, { at: p, size: 2.2, warn: 1.9, radius: 3.2, fire: 90 })); break; }
  }
  // and the tower shaking round them now and then: a far boom, dust from the ceiling
  m.s.boomT -= dt;
  if (m.s.boomT <= 0 && !game.cutscene) {
    m.s.boomT = 5 + Math.random() * 4;
    game.sound?.boom?.(0.3 + Math.random() * 0.25); game.follow.shake(0.35);
    if (floorOf(game) >= 0) for (let k = 0; k < 3; k++) game.fx.dust(me.x + (Math.random() - 0.5) * 7, me.y + 3.4, me.z + (Math.random() - 0.5) * 7, 0.7);
  }
}
// the getaway: everyone into the Renault (Liam too), Nehorai at the wheel
function board(m, game) {
  if (m.s.boarded) return;
  m.s.boarded = true;
  const L = game.npc('liam'); L.target = null; L.idle = null;
  crewInCar(game, game.squad.ids); if (!L.inCar) L.enter(game.car);
  if (game.mode !== 'car') game.enterCar();
  game.dialogue.play(DRIVE);
}

export default {
  id: 'meltdown', chapter: 9, number: 12, title: 'בריחה מהתופת', requires: ['shadow'], follows: true,
  where: 'בחדר הפיקוד',
  startAt: (game) => { const c = TW(game)?.command; return c ? { x: c.inside.x, z: c.inside.z, y: c.inside.y } : null; },
  reward: { money: 2000, unlocks: ['meltdown'], text: 'יצאתם מהתופת · 2,000 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.beams = []; m.smoke = []; m.talk = []; m.saved = {}; game.overlay?.mapHidden(false); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const c = TW(game).command; game.player.place(c.inside.x, c.inside.z, 0, c.inside.y); game.follow.snapBehind(0); },
  failIf(m, game) {
    if (m.s.t0 != null && !m.s.away && leftOf(m, game) <= 0) return TIMEOUT;
    return failOut(m, game, [1, 2, 3, 4, 5, 6]) ? LOST : null;
  },
  restore(m, game, cp) { stage(m, game, cp, Math.max(m.saved?.[cp] ?? 0, FLOORS[cp])); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game); wipeOff(m, game, dt);
    for (const x of m.live || []) x.update(dt);
    for (const b of m.beams || []) b.update(dt);
    if (m.s.t0 != null && !m.s.away) escapeClock(game, leftOf(m, game));
  },
  cleanup(m, game) {
    const E = TW(game).escape, on = m.done && handsOver(game);
    clearAll(m, game, { keep: on }); clearDetour(m);
    E.mark(false);
    if (on) return; // the gang out by the Renault on the road south: the safe house (mission 46) takes it from here
    game.paint.dispose(); offBoard(game, ORDER);
    if (game.mode === 'car') game.exitCar();
    for (const id of TEAM) { const n = game.npc(id); if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } }
    towerReset(game);
    bandage(game.nehorai, false);
    endCrew(game);
  },

  steps: [
    { // 0: the self-destruct; the clock
      objective: '05:00 – ESCAPE!',
      enter(m, game) {
        stage(m, game, 0, LIMIT);
        m.s.t0 = null; escapeClock(game, LIMIT);
        const c = TW(game).command;
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: c.inside.x + 2.5, y: c.inside.y + 2.2, z: c.inside.z + 7 }, { x: c.screen ? c.inside.x + 8.5 : c.inside.x, y: c.inside.y + 2, z: c.inside.z - 3.4 }, 9999);
        m.beats = beats(game, [
          ['say', SELF],
          ['do', () => { game.hud.banner('השמדה עצמית', '05:00 – ESCAPE!', 'כולם החוצה · אחרי החצים הירוקים', 3400); game.follow.shake(0.5); game.sound?.boom?.(0.6); }],
          ['wait', 1.2],
          ['say', GO],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); m.s.t0 = game.time; },
    },
    { // 1: the command floor, down the west stairs
      objective: 'לברוח · במדרגות המערביות למטה', checkpoint: true,
      enter(m, game) { if (m.s.t0 == null) m.s.t0 = game.time; m.saved[1] = leftOf(m, game); },
      target: (m, game) => nextOnRoute(m, game),
      update(m, game, dt) {
        blasts(m, game, dt);
        say(m, game, `${mmss(leftOf(m, game))} · קומת הפיקוד · החצים הירוקים, המדרגות המערביות`);
        return onFloor(game, 3) ? 'next' : null;
      },
    },
    { // 2: the storage floor: a beam across the hall; round it through the shelves
      objective: 'קומת המחסנים · לעקוף את הקורה', checkpoint: true,
      enter(m, game) { m.saved[2] = leftOf(m, game); m.s.beamOn = false; },
      target(m, game) {
        if (m.detour && !m.s.round) { const p = m.detour.pts[m.s.dk ?? 0]; return { x: p.x, z: p.z, y: p.y, r: 1.2 }; }
        return nextOnRoute(m, game);
      },
      update(m, game, dt) {
        const me = game.player.pos;
        blasts(m, game, dt);
        // the beam: its ring and the beeps as he comes along the hall, then down across it
        if (!m.s.beamOn && onFloor(game, 3) && me.z < T(game, 0, -12.2, 3).z && me.x > T(game, -13, 0, 3).x) {
          m.s.beamOn = true;
          const at = T(game, 0, -15.9, 3);
          m.live.push(new TBlast(game, { at, size: 1.4, warn: 1.8, radius: 2.2, fire: 300, onBoom: () => {
            m.beams.push(dropBeam(game, { from: { x: at.x, y: at.y + 4, z: at.z }, to: { x: at.x, y: at.y + 0.6, z: at.z }, len: 8.6, yaw: 0, w: 0.9, h: 1.3, seconds: 0.5, onLand: () => { m.s.beam = true; } }));
            detourMarks(m, game); m.s.dk = 0;
            game.dialogue.play(BEAM);
          } }));
        }
        // the way round, point by point
        if (m.detour && !m.s.round) { const p = m.detour.pts[m.s.dk]; if (near(me, p, 1.4)) { m.s.dk++; if (m.s.dk >= m.detour.pts.length) m.s.round = true; } }
        say(m, game, `${mmss(leftOf(m, game))} · ${m.detour && !m.s.round ? 'המסדרון חסום · עוקפים דרך המדפים' : 'קומת המחסנים · המדרגות המזרחיות'}`);
        return onFloor(game, 2) ? 'next' : null;
      },
    },
    { // 3: the server floor: the emergency gate slams shut ahead of them
      objective: 'קומת השרתים · שער החירום', checkpoint: true,
      enter(m, game) {
        const E = TW(game).escape;
        m.saved[3] = leftOf(m, game);
        clearDetour(m);
        E.gate.unlock(); E.gate.setOpen(true); m.s.gateShut = null;
        m.work = new Work(game, { at: E.gateAt, seconds: 4, label: 'לפתוח את שער החירום', pill: 'משחרר את השער', near: 1.8, onDone: () => { m.s.gateShut = 'open'; E.gate.unlock(); E.gate.setOpen(true); game.sound?.hit?.('crash', 0.6); game.dialogue.play(GATE_OPEN); } });
      },
      interaction(m, game) { return m.s.gateShut === 'shut' ? m.work?.interaction(game) || null : null; },
      target(m, game) { const E = TW(game).escape; return m.s.gateShut === 'shut' ? { ...E.gateAt, r: 1.0 } : nextOnRoute(m, game); },
      update(m, game, dt) {
        const E = TW(game).escape, me = game.player.pos;
        blasts(m, game, dt);
        if (!m.s.gateShut && onFloor(game, 2) && Math.hypot(me.x - E.gate.pos.x, me.z - E.gate.pos.z) < 9) { m.s.gateShut = 'shut'; E.gate.lock(); game.sound?.hit?.('crash', 1); game.follow.shake(0.4); game.dialogue.play(GATE); }
        m.work?.update(dt);
        say(m, game, `${mmss(leftOf(m, game))} · ${m.s.gateShut === 'shut' ? 'שער החירום נטרק · השחרור הידני' : 'קומת השרתים · אחרי החצים'}`);
        return onFloor(game, 1) ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 4: the security floor: a beam down on Avraham
      objective: 'קומת האבטחה · אברהם', checkpoint: true,
      enter(m, game) { m.saved[4] = leftOf(m, game); m.s.fell = false; m.s.freed = false; },
      interaction(m, game) { return m.pinned && !m.s.freed ? m.pinned.interaction(game) : null; },
      target(m, game) { const E = TW(game).escape; return m.pinned && !m.s.freed ? { ...E.fallenAt, r: 1.2 } : nextOnRoute(m, game); },
      update(m, game, dt) {
        const E = TW(game).escape, me = game.player.pos;
        blasts(m, game, dt);
        if (!m.s.fell && onFloor(game, 1) && me.z < T(game, 0, -11.5, 1).z) {
          m.s.fell = true;
          const p = E.fallen; game.fx.dust(p.x, p.y + 0.4, p.z, 1.6); game.fx.sparks(p.x, p.y + 3.5, p.z, 16); game.follow.shake(0.5); game.sound?.hit?.('crash', 1);
          m.pinned = pin(game, 'avraham', E.fallen, { label: 'להרים את הקורה מאברהם', seconds: 3, onFree: () => { m.s.freed = true; game.dialogue.play(UP); } });
          game.dialogue.play(FALL);
        }
        m.pinned?.update(dt);
        say(m, game, `${mmss(leftOf(m, game))} · ${m.pinned && !m.s.freed ? 'אברהם מתחת לקורה · להרים אותה' : 'קומת האבטחה · המדרגות המזרחיות ללובי'}`);
        return m.s.freed && onFloor(game, 0) ? 'next' : null;
      },
      exit(m, game) { if (m.pinned?.beam) gone(m.pinned.beam); m.pinned = null; },
    },
    { // 5: the lobby: the shutter locked; the exit switch; the last two of the Order
      objective: 'הלובי · מתג היציאה', checkpoint: true,
      enter(m, game) {
        const E = TW(game).escape;
        m.saved[5] = leftOf(m, game);
        freshMarks(game);
        post(game, LOBBY.map((g) => ({ id: g.id, at: [T(game, g.lx, g.lz, 0)], yaw: Math.PI })));
        later(m, LOBBYDOWN);
        m.s.switched = false;
        m.work = new Work(game, { at: E.switch, seconds: 2, label: 'להפעיל את מתג היציאה', pill: 'מתג היציאה', near: 1.7, onDone: () => { m.s.switched = true; E.throwSwitch(true); game.sound?.hit?.('crash', 0.6); game.dialogue.play(SWITCHED); } });
      },
      interaction(m, game) { return m.s.switched ? null : m.work?.interaction(game) || null; },
      target(m, game) { const E = TW(game).escape; return !m.s.switched ? { ...E.switch, r: 1.0 } : { ...TW(game).lobby.outside, r: 2 }; },
      update(m, game, dt) {
        const t = TW(game), me = game.player.pos;
        blasts(m, game, dt);
        m.work?.update(dt);
        const n = standing(game, LIDS);
        say(m, game, `${mmss(leftOf(m, game))} · ${!m.s.switched ? `מתג היציאה ליד הדלת${n ? ` · שניים מהמסדר בלובי (${LOBBY.length - n}/${LOBBY.length})` : ''}` : 'החוצה, לרחבה!'}`);
        return m.s.switched && !t.inTower(me.x, me.z) ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 6: the plaza: the Renault and Liam; everyone in; out through the vehicle gate and away
      objective: 'לרכב המילוט', checkpoint: true,
      enter(m, game) {
        const E = TW(game).escape, L = game.npc('liam');
        m.saved[6] = leftOf(m, game);
        if (!L.visible) { const q = game.car.local(-2.2, 0.8); L.target = null; L.place(q.x, q.z, game.car.yaw + Math.PI, E.car.y); L.show(true); }
        L.lookAt(game.player.pos.x, game.player.pos.z);
        later(m, CAR);
        m.s.boarded = false;
        // the plaza goes up round them too: two of the Order's cars, each with its warning
        const t = TW(game);
        for (const i of [3, 4]) { const v = t.cars[i]; if (!v.wrecked) m.live.push(new TBlast(game, { at: v.at, size: 2.6, warn: 2.6 + i * 1.5, radius: 5, fire: 120, debris: true, onBoom: () => v.wreck() })); }
      },
      interaction(m, game) {
        if (m.s.boarded || game.mode !== 'foot' || game.car.doorDistance(game.player.pos.x, game.player.pos.z) > 3) return null;
        return { label: 'לעלות לרנו · כולם בפנים', priority: 6, run: () => board(m, game) };
      },
      target(m, game) {
        const t = TW(game), E = t.escape;
        if (game.mode !== 'car') return { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.6 };
        const p = E.drive[Math.min(E.drive.length - 1, 4)]; return { x: p.x, z: p.z, y: p.y, r: 8 };
      },
      update(m, game, dt) {
        const t = TW(game);
        blasts(m, game, dt);
        if (game.mode === 'car' && !m.s.boarded) board(m, game); // in by the car's own door: they come too
        const away = Math.hypot(game.car.pos.x - t.x, game.car.pos.z - t.z);
        say(m, game, `${mmss(leftOf(m, game))} · ${game.mode !== 'car' ? 'לרנו! ליאם מחכה' : `לנסוע! דרך שער הרכבים · ${Math.min(FAR, Math.round(away))}/${FAR} מ׳ מהמגדל`}`);
        return game.mode === 'car' && away > FAR ? 'next' : null;
      },
    },
    { // 7: far enough: they get out on the road and watch it go
      objective: 'המגדל השחור',
      enter(m, game) {
        const t = TW(game);
        m.s.away = true; escapeClock(game, null); m.stopSiren?.(); m.stopSiren = null;
        game.cutscene = true; game.hud.setCinematic(true);
        game.sound?.music?.('calm', { fade: 2 });
        m.s.p = 'brake';
        const top = t.floorY(5);
        // the blasts climb the tower's face toward them, floor by floor, then up the shaft above the roof (out on
        // the facade, where they can be seen from the road), and the fires stay in the broken windows
        const face = (lx, ly, lz) => { const p = t.toWorld(lx, lz); return { x: p.x, y: t.y + ly, z: p.z }; };
        const booms = [];
        [[-12, 3, 21], [11, 7, 21], [-3, 11, 21.5], [14, 15, 21], [-14, 19.5, 21], [4, 22, 21.5], [-6, 32, -3], [7, 45, -3], [0, 60, -3]].forEach(([lx, ly, lz], k) => booms.push(['do', () => {
          const p = face(lx, ly, lz);
          game.fx.explode(p.x, p.y, p.z, { size: 4 + k * 0.35, fire: 0, flash: k % 3 === 0, debris: k < 3 });
          m.smoke.push(game.fx.burn(p.x, p.y - 0.6, p.z, { r: 2.4, strength: 2, seconds: 600 }));
        }], ['wait', 0.38]));
        m.beats = beats(game, [
          ['until', () => Math.abs(game.car.speed) < 1.2],
          ['do', () => {
            game.exitCar(); crewOutOfCar(game, [...game.squad.ids, 'liam']);
            const c = game.car, me = game.player.pos, yaw = Math.atan2(t.x - me.x, t.z - me.z);
            game.player.place(me.x, me.z, yaw, null);
            [...game.squad.ids, 'liam'].forEach((id, i) => { const n = game.npc(id), sx = (i % 5 - 2) * 1.3, sz = -1.4 - Math.floor(i / 5) * 1.2; n.target = null; n.show(true); n.place(me.x + Math.cos(yaw) * sx + Math.sin(yaw) * sz, me.z - Math.sin(yaw) * sx + Math.cos(yaw) * sz, yaw, me.y); });
            game.squad.tasks.clear();
            for (const id of game.squad.ids) game.squad.send(id, { x: game.npc(id).pos.x, z: game.npc(id).pos.z }, { label: 'מסתכל' });
            const back = { x: me.x - Math.sin(yaw) * 7 + Math.cos(yaw) * 3, y: me.y + 3.2, z: me.z - Math.cos(yaw) * 7 - Math.sin(yaw) * 3 };
            game.follow.shot(back, { x: t.x, y: t.y + 18, z: t.z }, 9999);
            void c;
          }],
          ['say', LOOK],
          ['wait', 0.4],
          ...booms,
          ['do', () => {
            const roof = face(0, 26, 8), crown = face(0, top - t.y + 64, -12);
            game.fx.explode(roof.x, roof.y, roof.z, { size: 9, fire: 0, flash: '#fff3dc' });
            game.fx.explode(crown.x, crown.y, crown.z, { size: 7, fire: 0 });
            m.smoke.push(game.fx.burn(roof.x, roof.y, roof.z, { r: 6, strength: 2, seconds: 600 }));
            for (const [lx, ly, lz] of [[-8, 27, 4], [8, 27, 12], [0, 88, -12]]) { const q = face(lx, ly, lz); m.smoke.push(game.fx.smokeColumn(q.x, q.y, q.z, { r: 5, strength: 2, seconds: 600 })); }
            game.follow.shake(1.4); game.carCam?.shake(1.4);
            game.hud.banner('', 'המגדל השחור', 'עולה באש', 2800);
          }],
          ['wait', 2.4],
          ['do', () => { const me = game.player.pos; game.follow.shot({ x: me.x + 2, y: me.y + 1.8, z: me.z + 3 }, { x: t.x, y: t.y + 12, z: t.z }, 9999); }],
          ['say', AFTER],
          ['wait', 0.6],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
