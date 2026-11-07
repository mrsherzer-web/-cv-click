// Chapter eight, mission 6, "המרדף אחרי קוצי". Kotzi runs for his headquarters in a black car; Nehorai
// takes the Renault and goes after him: the industrial strip (containers, a gantry, two trucks half on
// the road), the highway (a barrier down the middle, two ramps on the left lane that throw a fast car into
// the air), the abandoned compound, and the headquarters' gate, which opens for Kotzi and shuts behind
// him. Kotzi keeps ahead of a good driver and waits for a slow one, but fall too far behind and he is
// gone. Two of his cars behind, a helicopter overhead, the team on the radio. Invented throughout.
import { near, say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';
import { crew, endCrew, clock, Blast, attempt, handsOver } from './firestorm.js';

const K = (game) => game.world.places.kotziRoad;
const SEE = [['עידו', 'זה הוא! הרכב השחור!'], ['נהוראי', 'לרנו. עכשיו.']];
const GO = [['ארז', 'הוא לוקח את דרך התעשייה. דרומה.'], ['עידו', 'אל תאבד אותו, נהוראי. אם הוא מגיע למפקדה שלו לפנינו — לא נראה אותו יותר.']];
const LINES = {
  arrive: [[['ליאם', 'שניים מאחור! הם מגינים עליו!']], [['הדר', 'Bro, עוד אחד!']]],
  close: [['ארז', 'צמוד אלינו מאחור!'], ['יונתי', 'אל תיתן לו לדחוף אותך!']],
  hit: [['אברהם', 'הרנו! שוב!'], ['דולב', 'אני מרגיש כל מכה בגב.']],
};
const HIGHWAY = [['עידו', 'הכביש המהיר. ברמפות משמאל אפשר לעוף. ימין זה בטוח.']];
const RUINS = [['ארז', 'המתחם הנטוש. הוא מכיר את הדרך פה. אל תיפול מאחור.']];
const IN = [['עידו', 'הוא נכנס למפקדה. השער נסגר מאחוריו.'], ['נהוראי', 'אז אנחנו אחריו.']];
const LOST = 'איבדת את קוצי. ארז: "הוא נעלם. מההתחלה, ועם יותר גז."';

function pathIndex(path, x, z, from = 0, span = 400) { let best = from, bd = Infinity; for (let k = Math.max(0, from - 40); k < Math.min(path.length, from + span); k++) { const d = Math.hypot(path[k].x - x, path[k].z - z); if (d < bd) { bd = d; best = k; } } return best; }
function kotziCar(m, game, idx) {
  const path = K(game).path, hq = game.world.places.hq;
  if (!m.kc) {
    m.kc = new Vehicle(game.world, makeHatchback({ color: '#121417' }), { name: 'kotzi', maxSpeed: 30, accel: 8.4 }); game.scene.add(m.kc.model); game.chaseCars.push(m.kc);
    m.kc.tune.armor = 0; // his car takes no damage: a crash never leaves him stopped for good, with the chase unable to go on
  }
  const p = path[Math.min(idx, path.length - 2)], q = path[Math.min(idx + 1, path.length - 1)];
  m.kc.repair(); m.kc.place(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z), game.world.groundHeight(p.x, p.z) + 0.05);
  // past the road's end he drives on in through the headquarters' gate and stops a few metres inside
  // (added to his own points only, so the indices along `path` stay as they are)
  const pts = path.slice(idx);
  if (hq) { const o = hq.gateOutside, i = hq.gateInside, l = Math.hypot(i.x - o.x, i.z - o.z) || 1; pts.push({ x: o.x, z: o.z }, { x: i.x, z: i.z }, { x: i.x + (i.x - o.x) / l * 6, z: i.z + (i.z - o.z) / l * 6 }); }
  m.idx0 = idx; m.ap = new Autopilot(pts, { cruise: 8 });
  m.kc.model.visible = true;
}
function removeKotziCar(m, game) { if (!m.kc) return; game.scene.remove(m.kc.model); game.world.cols.dynamic.delete(m.kc.box); game.chaseCars = game.chaseCars.filter((c) => c !== m.kc); m.kc = null; m.ap = null; }
function helis(m, game, on) {
  for (const h of m.helis || []) { h.dispose(); game.helis = game.helis.filter((x) => x !== h); }
  m.helis = [];
  if (on) { const h = new game.Heli(game).shadow(() => ({ x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, yaw: game.car.yaw }), { ahead: 50, h: 28, side: 20 }); m.helis.push(h); game.helis.push(h); }
}
function stopChase(m, game) { m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; game.hud.setPursuit(null); }
function renault(game, road, s, lane = -1.8) {
  if (game.mode === 'car') game.exitCar();
  const p = road.at(s), yaw = Math.atan2(p.tx, p.tz);
  game.car.repair(); game.car.place(p.x + p.nx * lane, p.z + p.nz * lane, yaw, p.h + 0.05);
  return { x: p.x + p.nx * lane, z: p.z + p.nz * lane, yaw };
}

export default {
  id: 'kotzichase', chapter: 8, number: 6, title: 'המרדף אחרי קוצי', requires: ['bridge'],
  follows: true,
  where: 'בקצה המזרחי של הגשר',
  startAt: (game) => { const k = K(game); return k ? { x: k.start.x, z: k.start.z, y: k.start.h } : null; },
  reward: { money: 900, unlocks: ['kotzichase'], text: 'עד שער המפקדה · 900 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.blown = new Set(); m.launchSeen = undefined; game.daylight?.set(0, 0); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const k = K(game); game.start(k.start.x - 4, k.start.z, -Math.PI / 2); },
  failIf(m, game) { return game.mode === 'car' && game.car.disabled ? 'הרנו נפגעה יותר מדי. עידו: "עוד פעם. בלי לנשק כל משאית."' : null; },
  restore(m, game, checkpoint) {
    const k = K(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    stopChase(m, game); helis(m, game, false); for (const x of m.live || []) x.cancel(); m.live = [];
    const road = checkpoint >= 2 ? k.k3 : k.k1, s = checkpoint >= 2 ? 4 : 3, at = renault(game, road, s);
    game.player.place(at.x + Math.cos(at.yaw) * 2, at.z - Math.sin(at.yaw) * 2, at.yaw);
    game.enterCar();
    if (!game.squad.active) crew(game, game.player.pos, at.yaw);
    const i = pathIndex(k.path, at.x, at.z);
    kotziCar(m, game, Math.min(k.path.length - 30, i + 20));
    const hq = game.world.places.hq; if (hq) hq.gate.lock(); // opened for him on the last try, perhaps
    m.s = { ...m.s, inCar: true, lostFor: 0, highSaid: checkpoint >= 2, ruinsSaid: false, inside: false, gateOpen: false, clockOn: false };
  },
  cleanup(m, game) {
    stopChase(m, game); helis(m, game, false); for (const x of m.live || []) x.cancel(); m.live = [];
    removeKotziCar(m, game); clock(game, null);
    const k = game.npc('kotzi'); if (k.inCar) { k.inCar.occupants?.delete?.('kotzi'); k.inCar = null; } k.show(false);
    const hq = game.world.places.hq; if (hq) hq.gate.lock();
    if (!m.done || !handsOver(game)) endCrew(game);
  },

  steps: [
    { // 0: Kotzi tears off; into the Renault
      objective: 'הרכב השחור · לרנו',
      enter(m, game) {
        const k = K(game), g = game.world.places.bridge;
        if (game.mode === 'car') game.exitCar();
        if (!game.squad.active) crew(game, game.player.pos, game.player.yaw);
        const at = renault(game, k.k1, 3, -3.2);
        if (Math.hypot(game.player.pos.x - at.x, game.player.pos.z - at.z) > 30) { const e = g?.eastDeck || at; game.player.place(e.x + 6, e.z + 1.5, Math.PI / 2, g?.y); game.follow.snapBehind(Math.PI / 2); }
        kotziCar(m, game, pathIndex(k.path, k.kotziStart.x, k.kotziStart.z));
        const kz = game.npc('kotzi'); kz.floorY = null; kz.model.setPose(null); kz.place(k.kotziStart.x - 2, k.kotziStart.z, 0); kz.show(true); kz.enter(m.kc);
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: game.player.pos.x + 3, y: game.player.pos.y + 2.5, z: game.player.pos.z + 5 }, { x: m.kc.pos.x, y: m.kc.pos.y + 1, z: m.kc.pos.z }, 9999);
        const live = attempt(game, m);
        game.dialogue.play(SEE).then(() => { if (!live()) return; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); m.s.go = true; });
      },
      target(m, game) { return m.s.go && game.mode !== 'car' ? { x: game.car.pos.x, z: game.car.pos.z, r: 2.6 } : null; },
      update(m, game, dt) {
        // he drives off slowly while the gang gets in
        if (m.kc && m.ap && m.s.go) { m.ap.cruise = m.ap.i < 10 ? 6 : 0; m.kc.update(dt, m.ap.drive(m.kc)); } // he waits a little way off for the chase to begin
        say(m, game, game.mode === 'car' ? 'ברנו' : 'לרנו! הוא בורח');
        return game.mode === 'car' ? 'next' : null;
      },
    },
    { // 1: the industrial strip and the highway
      objective: 'לרדוף אחרי קוצי · אל תאבד אותו', checkpoint: true,
      enter(m, game) {
        m.pursuit = new Pursuit(game, { grace: 6, cars: 2, gap: 12, colors: ['#1c1f26', '#2a2d33'], lines: LINES, bonus: 0, radio: true });
        helis(m, game, true);
        game.dialogue.play(GO);
        m.s.lostFor = 0; m.s.radioT = m.t + 25;
      },
      target(m, game) { return m.kc ? { x: m.kc.pos.x, z: m.kc.pos.z, y: m.kc.pos.y, r: 4 } : null; },
      update(m, game, dt) { return chase(m, game, dt, 1); },
    },
    { // 2: the abandoned compound; the headquarters' gate
      objective: 'המתחם הנטוש · עד שער המפקדה', checkpoint: true,
      enter(m, game) { if (!m.pursuit) m.pursuit = new Pursuit(game, { grace: 4, cars: 1, gap: 12, colors: ['#1c1f26'], lines: LINES, bonus: 0, radio: true }); if (!m.helis?.length) helis(m, game, true); game.dialogue.play(RUINS); m.s.radioT = m.t + 25; },
      target(m, game) { const k = K(game); return m.s.inside ? { ...k.end, r: 12 } : m.kc ? { x: m.kc.pos.x, z: m.kc.pos.z, y: m.kc.pos.y, r: 4 } : null; },
      update(m, game, dt) { return chase(m, game, dt, 2); },
    },
  ],
  complete(m, game) { m.done = true; },
};

// one frame of the chase: Kotzi's speed against the gap, the lost clock, the blasts by the road, the lines
function chase(m, game, dt, step) {
  const k = K(game), path = k.path;
  m.pursuit?.update(dt);
  for (const x of m.live) x.update(dt);
  if (m.kc && m.ap && !m.s.inside) {
    const ki = m.idx0 + m.ap.i, pi = pathIndex(path, game.car.pos.x, game.car.pos.z, Math.max(0, ki - 120), 240), gap = (ki - pi) * 3;
    // the rubber band: ahead of a good driver, waiting for a slow one
    m.ap.cruise = gap < 0 ? 27 : gap < 35 ? 24 : gap < 60 ? 19 : gap < 100 ? 13 : 8.5;
    m.kc.update(dt, m.ap.drive(m.kc));
    // stuck against something (or stopped some other way): on again a few points ahead, clear of the Renault
    if (m.kc.disabled || m.kc.stuckTime > 3) {
      const P = m.ap.points, me = game.car.pos;
      let j = Math.min(P.length - 2, m.ap.i + 3);
      while (j < P.length - 2 && Math.hypot(P[j].x - me.x, P[j].z - me.z) < 6) j++;
      m.kc.repair(); m.kc.place(P[j].x, P[j].z, Math.atan2(P[j + 1].x - P[j].x, P[j + 1].z - P[j].z), game.world.groundHeight(P[j].x, P[j].z) + 0.05); m.kc.stuckTime = 0;
    }
    const d = Math.hypot(m.kc.pos.x - game.car.pos.x, m.kc.pos.z - game.car.pos.z);
    m.s.lostFor = d > 220 ? m.s.lostFor + dt : 0;
    // the 'he is getting away' clock shares the pill with the rivals' count: up only while he is far,
    // cleared once when he is close again (the rivals' line comes back on the next frame)
    // from 150 m a warning with the distance; past 220 m the 8 seconds run down (a clock that does not move
    // until then would only confuse)
    if (d > 220) clock(game, 8 - m.s.lostFor, 'קוצי מתרחק'); else if (d > 150) game.hud.setPursuit(`קוצי מתרחק · ${Math.round(d)} מ׳ · ב-220 מ׳ הוא נעלם`); else if (m.s.clockOn) clock(game, null);
    m.s.clockOn = d > 150;
    if (m.s.lostFor > 8) return 'fail:' + LOST;
    // the blasts beside the road, as either car goes by
    for (const b of k.blasts) if (!m.blown.has(b) && (near(m.kc.pos, b, 18) || near(game.car.pos, b, 14))) { m.blown.add(b); m.live.push(new Blast(game, { at: b, size: b.size, warn: 0.5, radius: 0, fire: 16, hurts: false, quiet: true })); }
    // a jump: the car took off a ramp (the vehicle counts its launches; this works at any frame rate)
    const launches = game.car.launches || 0;
    if (m.launchSeen === undefined) m.launchSeen = launches;
    if (launches > m.launchSeen) { m.launchSeen = launches; if (!m.s.jumpSaid) { m.s.jumpSaid = true; m.s.jumps = (m.s.jumps || 0) + 1; game.hud.toast('קפיצה!', 1200); setTimeout(() => { m.s.jumpSaid = false; }, 3000); } }
    if (m.t > m.s.radioT && !game.dialogue.busy) { m.s.radioT = m.t + 25; game.dialogue.play([['ארז', `הוא ${Math.round(d)} מטר לפנינו.`]]); }
    const k3start = pathIndex(path, k.k3.at(2).x, k.k3.at(2).z, 0, path.length);
    if (step === 1 && !m.s.highSaid && ki > pathIndex(path, k.k2.at(2).x, k.k2.at(2).z, 0, path.length)) { m.s.highSaid = true; game.dialogue.play(HIGHWAY); }
    if (step === 1) { say(m, game, `לרדוף אחרי קוצי · ${Math.round(d)} מ׳ · אל תאבד אותו`); return ki > k3start ? 'next' : null; }
    // he comes up to the gate: it opens for him; once he is through it shuts behind him and he is gone
    const hq = game.world.places.hq;
    if (hq && !m.s.gateOpen && near(m.kc.pos, hq.gateOutside, 25)) { m.s.gateOpen = true; hq.gate.unlock(); hq.gate.setOpen(true); }
    // through the gate (a few metres past its line): it shuts at once, so no one tails him in
    const through = !!hq && m.kc.pos.z < hq.gateInside.z + 1.5 && Math.abs(m.kc.pos.x - hq.gateInside.x) < 6;
    if (m.ap.done || m.ap.i >= m.ap.points.length - 1 || through) {
      m.s.inside = true;
      if (hq) {
        // a Renault right on his bumper is kept out: back on the approach, facing the gate, before the leaf shuts
        const c = game.car.pos, lineZ = hq.gateOutside.z - 5;
        if (hq.inside(c.x, c.z) || (Math.abs(c.z - lineZ) < 3.5 && Math.abs(c.x - hq.gateOutside.x) < 5)) { const a = hq.approach; game.car.place(a.x, a.z, a.yaw, game.world.groundHeight(a.x, a.z)); }
        hq.gate.lock();
      }
      const kz = game.npc('kotzi'); kz.inCar = null; kz.show(false);
      removeKotziCar(m, game); clock(game, null);
      game.dialogue.play(IN);
    }
    say(m, game, `המתחם הנטוש · ${Math.round(d)} מ׳`);
    return null;
  }
  stopChase(m, game); helis(m, game, false);
  say(m, game, 'לשער המפקדה');
  return m.s.inside && near(game.car.pos, k.end, 26) ? 'next' : null;
}
