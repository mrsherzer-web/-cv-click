// Chapter eight, mission 8, "הבריחה מהפיצוץ". Two minutes. Out of the headquarters with the whole gang:
// the west door (Ido opens it and a blast closes it again), back through the corridor to the centre door
// (beams come down on it), round through the second room and the east hall to the east door (Ido opens
// it), Dolev pinned under a beam in the courtyard (Nehorai lifts it), the gate, the Renault, and the
// headquarters going up behind them. Then the last lines, the radio, STAGE 8 COMPLETE, and the gang back
// at the lookout in Katzir. Blasts warn before they go off; fire and smoke, nothing worse. Invented.
import { near, say, nearestGuard } from './missions.js';
import { TEAM, crew, armCrew, endCrew, failOut, clock, fmt, radio, Blast, Job, dropBeam, pin, postGuards, hideGuards, attempt, handsOver } from './firestorm.js';

const Q = (game) => game.world.places.hq;
const LIMIT = 120;
const YARD = [['kg7', 'e2'], ['kg8', 'e3']];
const START = [['ארז', 'קוצי נעלם! בבלבול!'], ['עידו', 'אין זמן! הדלת המערבית, אני פותח!']];
const W_SHUT = [['ארז', 'חסום! מזרחה, דרך המסדרון!']];
const C_SHUT = [['עידו', 'גם פה! דרך החדר השני, לאולם המזרחי!']];
const E_OPEN = [['עידו', 'פתוח! לחצר!']];
const DOLEV = [['דולב', 'נהוראי! קורה עליי! אל תשאירו אותי!']];
const FREE = [['דולב', 'אחי. חייב לך.'], ['נהוראי', 'רוץ!']];
const CAR = [['ארז', 'לרנו! כולם!']];
const END = [['נהוראי', 'זהו, נגמר הסיפור.'], ['עידו', 'נהוראי… אני לא חושב שזה נגמר.']];
const VOICE = 'קוצי היה רק ההתחלה.';
const BOOMS = [[0, 0], [-40, -35], [45, -20], [-60, 20], [30, 40], [0, -50]];

function clearAll(m, game) {
  for (const b of m.beams || []) b.remove(); m.beams = [];
  for (const x of m.live || []) x.cancel(); m.live = [];
  m.job?.cancel(); m.job = null;
  if (m.pinned) { m.pinned.cancel(); if (m.pinned.beam) game.scene.remove(m.pinned.beam); m.pinned.npc?.model.setPose(null); game.squad.release('dolev'); m.pinned = null; }
  game.fx.clear();
}
function doors(game, lock) { const q = Q(game).inner; for (const d of [q.doorW, q.doorC, q.doorE]) { if (lock) d.lock(); else { d.unlock(); d.setOpen(true); } } }
function stage(m, game) {
  const q = Q(game), e = q.escape;
  if (game.mode === 'car') game.exitCar();
  clearAll(m, game);
  doors(game, true);
  q.gate.unlock(); q.gate.setOpen(true);
  for (const d of [q.rooms[1].door, q.rooms[2].door, q.r3w, q.r2e, q.control.door, q.command.front]) { d.unlock(); d.setOpen(true); }
  q.command.back.lock(); // the passage north is jammed: the first blast took it
  for (const c of q.security.cameras) c.setOn(false); for (const g of q.security.gates) { g.unlock(); g.setOpen(true); }
  const z = game.npc('kotzi'); z.model.setPose(null); z.show(false);
  game.npc('shpitz').show(false);
  game.player.place(e.startAt.x, e.startAt.z, e.startAt.yaw, q.y); game.follow.snapBehind(e.startAt.yaw);
  crew(game, game.player.pos, e.startAt.yaw);
  game.paint.dispose(); armCrew(game); game.paint.reset();
  hideGuards(game, YARD.map((g) => g[0])); postGuards(game, q, YARD);
  m.pinned = pin(game, 'dolev', e.pinned, { label: 'להרים את הקורה מדולב', seconds: 3, onFree: () => { m.s.dolev = true; game.dialogue.play(FREE); } });
  game.car.repair(); game.car.place(q.car.x, q.car.z, q.car.yaw, q.y);
  m.s = { ...m.s, t0: game.time, route: 'W', dolev: false, wJob: false, cSaid: false, eOpen: false, dolevSaid: false, inCar: false, boom: false, fin: false, blasted: new Set(), nextBoom: game.time + 6 };
}

export default {
  id: 'inferno', chapter: 8, number: 8, title: 'הבריחה מהפיצוץ', requires: ['lastwar'],
  follows: true, secret: true,
  where: 'בחדר הבקרה של המפקדה',
  startAt: (game) => { const q = Q(game); return q ? { x: q.escape.startAt.x, z: q.escape.startAt.z, y: q.y } : null; },
  reward: { money: 2000, unlocks: ['chapter-8'], text: 'סוף הפרק השמיני · 2,000 ₪' },

  setup(m, game) { m.s = {}; m.beams = []; m.live = []; },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const s = Q(game).escape.startAt; game.player.place(s.x, s.z, s.yaw, Q(game).y); },
  failIf(m, game) {
    if (!m.s.boom && m.s.t0 != null && game.time - m.s.t0 > LIMIT) return 'המפקדה התפוצצה לפני שיצאתם. עידו: "מההתחלה. והפעם לא עוצרים."';
    return failOut(m, game, [0]);
  },
  restore(m, game) { game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); if (game.mode === 'car') game.exitCar(); m.stopSiren?.(); m.stopSiren = null; }, // the step's own start stages it all again
  cleanup(m, game) {
    const q = Q(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); clock(game, null);
    m.stopSiren?.(); m.stopSiren = null;
    clearAll(m, game);
    game.paint.dispose(); hideGuards(game, YARD.map((g) => g[0]));
    doors(game, true); q.gate.lock();
    game.npc('kotzi').show(false);
    endCrew(game);
    if (!m.done) game.daylight?.set(0, 2);
  },

  steps: [
    { // 0: out of the headquarters before it goes up
      objective: 'לצאת מהמפקדה · שתי דקות', checkpoint: true,
      enter(m, game) {
        stage(m, game);
        m.stopSiren = game.sound?.siren?.(LIMIT + 10) || null;
        game.hud.banner('שתי דקות', 'לצאת מהמפקדה', 'כולם', 2400);
        game.dialogue.play(START);
      },
      target(m, game) {
        const q = Q(game), i = q.inner, e = q.escape;
        if (m.s.route === 'W') return { ...i.Win, r: 1.6 };
        if (m.s.route === 'C') return q.inRoom(2, game.player.pos.x, game.player.pos.z) ? { ...i.Cin, r: 1.6 } : { ...q.r3wAt, r: 1.6 };
        if (m.s.route === 'E' && m.s.eOpen && game.player.pos.z < i.Eout.z - 1) return { ...i.Eout, r: 1.6 };
        if (m.s.route === 'E' && !m.s.eOpen) return (q.inRoom(1, game.player.pos.x, game.player.pos.z) ? { ...q.r2eAt, r: 1.4 } : (game.player.pos.x > q.x + 8 ? { ...i.Ein, r: 1.6 } : { ...q.rooms[2].doorAt, r: 1.6 }));
        if (!m.s.dolev) return { ...e.pinned, r: 1.4 };
        return { ...e.gate, r: 3 };
      },
      interaction(m, game) { return m.pinned?.interaction(game) || null; },
      update(m, game, dt) {
        const q = Q(game), i = q.inner, e = q.escape, me = game.player.pos;
        const rest = LIMIT - (game.time - m.s.t0);
        clock(game, rest, 'המפקדה');
        m.job?.update(dt); m.pinned?.update(dt);
        for (const b of m.beams) b.update(dt);
        for (const x of m.live) x.update(dt);
        // the west door: Ido opens it, and a blast outside closes it again
        if (m.s.route === 'W' && !m.job && !m.s.wJob) { m.s.wJob = true; m.job = new Job(game, { who: 'ido', at: i.Win, seconds: 2, near: 14, pill: 'עידו פותח את הדלת המערבית', onDone: () => {
          i.doorW.unlock(); i.doorW.setOpen(true); i.doorW.body.enabled = true; m.job = null; // it swings open, and the blast is quicker than anyone: no one gets through
          m.live.push(new Blast(game, { at: { x: i.Wout.x, y: q.y, z: i.Wout.z + 1.5 }, size: 2.2, warn: 1.3, radius: 2.8, fire: 30, onBoom: () => {
            m.beams.push(dropBeam(game, { ...e.beamsW, from: { ...e.beamsW.from, z: i.W.z }, to: { ...e.beamsW.to, z: i.W.z }, len: 3.2, seconds: 0.6, onLand: () => { i.doorW.lock(); m.s.route = 'C'; game.dialogue.play(W_SHUT); } }));
          } }));
        } }); }
        // the centre door: beams come down on it as he reaches the third room
        if (m.s.route === 'C' && !m.s.cSaid && q.inRoom(2, me.x, me.z)) {
          m.s.cSaid = true;
          game.fx.explode(i.Cout.x, q.y, i.Cout.z + 3, { size: 2.4, fire: 30 });
          m.beams.push(dropBeam(game, { ...e.beamsC, from: { ...e.beamsC.from, z: i.C.z }, to: { ...e.beamsC.to, z: i.C.z }, len: 3.2, seconds: 0.6, onLand: () => { m.s.route = 'E'; game.dialogue.play(C_SHUT); const ido = game.npc('ido'); game.squad.send('ido', i.Ein, { label: 'לדלת המזרחית' }); ido.target = null; ido.place(i.Ein.x - 1.2, i.Ein.z - 1, 0, q.y); } }));
        }
        // the east door: Ido opens it once Nehorai is near
        if (m.s.route === 'E' && !m.s.eOpen && !m.job && near(me, i.Ein, 12)) m.job = new Job(game, { who: 'ido', at: i.Ein, seconds: 2, near: 14, pill: 'עידו פותח את הדלת המזרחית', onDone: () => { i.doorE.unlock(); i.doorE.setOpen(true); m.s.eOpen = true; m.job = null; game.dialogue.play(E_OPEN); } });
        if (m.s.eOpen && !m.s.dolevSaid && near(me, e.pinned, 20)) { m.s.dolevSaid = true; game.dialogue.play(DOLEV); }
        // blasts around the way, each with its warning; never on top of him
        if (game.time > m.s.nextBoom) {
          m.s.nextBoom = game.time + 5 + Math.random() * 4;
          const p = e.blasts.find((b) => !m.s.blasted.has(b) && Math.hypot(b.x - me.x, b.z - me.z) < 26 && Math.hypot(b.x - me.x, b.z - me.z) > 7);
          if (p) { m.s.blasted.add(p); m.live.push(new Blast(game, { at: p, size: 2.0, warn: 1.8, radius: 3.2, fire: 25 })); }
          else { const a = Math.random() * Math.PI * 2; game.fx.explode(me.x + Math.cos(a) * 30, q.y + 4, me.z + Math.sin(a) * 30, { size: 2.2, light: false }); }
        }
        say(m, game, m.s.route === 'W' ? `${fmt(rest)} · הדלת המערבית · עידו פותח` : m.s.route === 'C' ? `${fmt(rest)} · חסום · דרך המסדרון לחדר השלישי` : !m.s.eOpen ? `${fmt(rest)} · דרך החדר השני לאולם המזרחי · הדלת המזרחית` : !m.s.dolev ? `${fmt(rest)} · דולב לכוד · להרים את הקורה` : `${fmt(rest)} · לשער!`);
        return m.s.dolev && near(me, e.gate, 5) ? 'next' : null;
      },
    },
    { // 1: the Renault, away, and the headquarters going up behind them
      objective: 'לרנו · ולנסוע',
      enter(m, game) { game.dialogue.play(CAR); },
      target(m, game) { return game.mode === 'car' || m.s.boom ? null : { x: game.car.pos.x, z: game.car.pos.z, r: 2.6 }; },
      update(m, game, dt) {
        const q = Q(game);
        for (const x of m.live) x.update(dt);
        if (!m.s.boom) {
          const rest = LIMIT - (game.time - m.s.t0);
          clock(game, rest, 'המפקדה');
          say(m, game, game.mode === 'car' ? `${fmt(rest)} · לנסוע! הכי רחוק מהמפקדה` : `${fmt(rest)} · לרנו!`);
          if (game.mode === 'car' && Math.hypot(game.car.pos.x - q.gateOutside.x, game.car.pos.z - q.gateOutside.z) > 150) {
            m.s.boom = true; clock(game, null); m.stopSiren?.(); m.stopSiren = null;
            game.cutscene = true; game.hud.setCinematic(true);
            const c = game.car.pos, back = { x: c.x - Math.sin(game.car.yaw) * 12, y: c.y + 4, z: c.z - Math.cos(game.car.yaw) * 12 };
            game.follow.shot({ x: c.x + Math.sin(game.car.yaw) * 10, y: c.y + 5, z: c.z + Math.cos(game.car.yaw) * 10 }, { x: q.x, y: q.y + 6, z: q.z }, 9999);
            const live = attempt(game, m);
            BOOMS.forEach(([dx, dz], k) => setTimeout(() => { if (live()) game.fx.explode(q.x + dx, q.y + 3 + k, q.z + dz, { size: k ? 3.4 : 5.5, fire: 45 }); }, k * 320));
            setTimeout(() => { if (!live()) return; game.carCam?.shake(1.4); game.follow.shake(1.4); game.hud.banner('', 'המפקדה של קוצי', 'נעלמה', 2600); }, 600);
            setTimeout(() => live() && game.dialogue.play(END).then(() => (live() ? radio(game, 'קול לא מוכר', VOICE) : null)).then(() => live() && new Promise((res) => {
              game.hud.fade('STAGE 8 COMPLETE – OPERATION FIRESTORM', () => {
                if (!live()) return;
                if (game.mode === 'car') game.exitCar();
                endCrew(game);
                const P = game.world.places, p = P.plaza, road = P.mainRoad, r = road.at(road.length - 22);
                game.car.repair(); game.car.place(r.x - r.nx * 1.8, r.z - r.nz * 1.8, Math.atan2(r.tx, r.tz), r.h + 0.05);
                game.start(p.x - p.dx * 4, p.z - p.dz * 4, Math.atan2(p.dx, p.dz));
                game.daylight?.set(0, 0); game.fx.clear();
                // the blast's camera shot and the cinema bars end here, under the black card (step 1's exit
                // does the same, later): the camera is behind Nehorai at the plaza when the card lifts
                game.follow.override = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.snapBehind?.(Math.atan2(p.dx, p.dz));
              }, 5600);
              setTimeout(res, 6700); // the card stays black 5.6 s and takes half a second to clear: only then the mission completes, so no banner sits on it
            })).then(() => { if (live()) m.s.fin = true; }), 2600);
            void back;
          }
        }
        return m.s.fin ? 'next' : null;
      },
      exit(m, game) { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
  // the chapter ends on this card: shown once the framework's "המשימה הושלמה" (4.6 s) is down, so nothing covers it
  complete(m, game) { m.done = true; setTimeout(() => { if (!game.missions.active) game.hud.banner('פרק 9', 'TO BE CONTINUED IN STAGE 9…', 'בקרוב', 5200); }, 5000); },
};
