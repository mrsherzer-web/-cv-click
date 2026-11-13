// Chapter eight, mission 7, "המלחמה האחרונה". Kotzi's headquarters, the biggest place in the game: Ido at
// the gate, the yard, the garage (the note with the server hall's code), the server hall (the keypad, the
// shelf that hides a door), the long passage north to the command room's back door. Then the boss, in
// three parts: Kotzi runs through three rooms, shutting each door behind him (Ido opens them as each
// room is cleared); in the security corridor he turns on the defences (two laser gates, two cameras)
// and three breakers turn them off; in the control room, the two of them, fists — dodge, block, punch.
// Kotzi goes down, smiles, and the place starts counting down. Invented, the whole of it.
import { near, say, nearestGuard } from './missions.js';
import { Fight } from '../combat/fight.js';
import { TEAM, crew, armCrew, endCrew, failOut, arriveCrew, clock, Blast, Job, Work, postGuards, hideGuards, left, attempt, handsOver } from './firestorm.js';

const Q = (game) => game.world.places.hq;
const YARD = [['guard1', 't1'], ['guard2', 't2'], ['guard3', 'yardW'], ['guard4', 'yardE'], ['vg1', 'yardMid'], ['vg2', 'gateIn'], ['vg3', 'hutW'], ['vg4', 'hutE']];
const GARAGE = [['vg5', 'g1'], ['vg6', 'g2'], ['vg7', 'g3']];
const SERVER = [['vg8', 's1'], ['vg9', 's2'], ['kg1', 's3']];
const ROOMS = [['kg2', 'r1'], ['kg3', 'r2'], ['kg4', 'r3']];
const NORTH = [['kg5', 'pass'], ['kg6', 'eh']];
const ALL = [...YARD, ...GARAGE, ...SERVER, ...ROOMS, ...NORTH];
const ids = (list) => list.map((g) => g[0]);

const GATE = [['עידו', 'המפקדה של קוצי. זה המקום הכי גדול שראינו.'], ['ארז', 'הוא בפנים. איפשהו בצפון.'], ['נהוראי', 'אז נלך צפונה. אחריי.']];
const GARAGE_LINES = [['ארז', 'המוסך. אולי יש פה משהו על השרתים.']];
const NOTE = [['נהוראי', '7-3-9-1. אולם השרתים.'], ['ליאם', 'קוצי והפתקים. אחים, הוא לא לומד.']];
const SHELF = [['עידו', 'המדף הזה זז. יש מאחוריו דלת. תן לי רגע.']];
const PASSAGE = [['ארז', 'מעבר ארוך צפונה. זה מוביל אליו.']];
const KOTZI = [['קוצי', 'נהוראי פרחי. אתה עקשן.'], ['נהוראי', 'נגמר, קוצי.'], ['קוצי', 'עוד לא.']];
const RUN = [['עידו', 'הוא בורח דרך החדרים! הוא נועל את הדלתות מאחוריו!'], ['ארז', 'נקו כל חדר. עידו פותח.']];
const DEFENCES = [['קול ברמקול', 'מערכות הגנה פעילות.'], ['עידו', 'שערי לייזר ושתי מצלמות. שלושה מפסקים — אחד בחדר הזה, אחד בין השערים, אחד ליד הדלת שלו.'], ['ארז', 'את השני אני לוקח. תחפה עליי.']];
const FIGHT = [['קוצי', 'רק אתה ואני, פרחי. ושפיץ.'], ['שפיץ', 'נעים לראות אותך שוב.'], ['נהוראי', 'ארז, עידו — איתי.']];
const WON = [['קוצי', 'אתה חושב שאני האויב הכי גדול שלך? אין לך מושג מה מחכה לך…']];

function stopFight(m) { m.fight?.dispose(); m.fight = null; }
function shelf(game, moved) {
  const q = Q(game), s = q.server, W = game.world;
  if (moved) { if (s.shelfBody) { W.cols.remove(s.shelfBody); s.shelfBody = null; } s.shelf.position.x = q.x + 56 + 2.2; s.hidden.door.unlock(); s.hidden.door.setOpen(true); }
  else { if (!s.shelfBody) s.shelfBody = W.cols.addBox(q.x + 56, q.z - 11.4, 1.0, 0.3, 0, q.y - 1, q.y + 2.2); s.shelf.position.x = q.x + 56; s.hidden.door.lock(); }
}
function defences(game, on) { const s = Q(game).security; for (const c of s.cameras) c.setOn(on); for (const g of s.gates) { if (on) g.lock(); else { g.unlock(); g.setOpen(true); } } }
function resetDoors(game) {
  const q = Q(game);
  for (const d of [q.rooms[1].door, q.rooms[2].door, q.r3w, q.r2e, q.control.door, q.command.front]) { d.unlock(); d.setOpen(true); }
  q.command.back.lock(); q.server.door.lock(); shelf(game, false);
  for (const d of [q.inner.doorW, q.inner.doorC, q.inner.doorE]) d.lock();
  defences(game, false); // the laser gates stand open until Kotzi turns them on
}
// Kotzi's flight: from his desk through the three rooms to the control room, each door shut behind him
const FLIGHT = (q) => [q.command.frontAt, q.rooms[0].inside, q.rooms[1].doorAt, q.rooms[1].inside, q.rooms[2].doorAt, q.rooms[2].inside, q.r3wAt, q.security.corridor, q.control.doorAt, q.control.kotzi];
const SHUT_AFTER = { 1: [0, (q) => q.command.front], 4: [1, (q) => q.rooms[1].door], 6: [2, (q) => q.rooms[2].door] }; // after he is through: [which, the door]
// the doors he shuts, in the order he goes through them, and how far along that way Nehorai is: the three
// rooms 0..2 (the east hall is off room two), the corridor 3, the control room 4; short of the first, -1
const DOORS = (q) => [q.rooms[0].door, q.rooms[1].door, q.rooms[2].door, q.r3w, q.control.door];
function along(game) {
  const q = Q(game), { x, z } = game.player.pos;
  if (q.inControl(x, z)) return 4;
  if (q.inCorridor(x, z)) return 3;
  for (const k of [2, 1, 0]) if (q.inRoom(k, x, z)) return k;
  return q.inEastHall(x, z) ? 1 : -1;
}
// a door is shut behind him only while Nehorai is still short of it: right on his heels he is through it
// too, and it stays open (counted as opened), so he is never sealed in beyond a door Kotzi locked
function flee(m, game, k = 0) {
  const q = Q(game), pts = FLIGHT(q), z = game.npc('kotzi'), at = along(game);
  m.s.fleeK = k; m.s.fleeT = m.t;
  if (k >= pts.length) { z.lookAt(q.control.inside.x, q.control.inside.z); m.s.kotziIn = true; if (at < 4) q.control.door.lock(); return; }
  if (SHUT_AFTER[k]) { const [i, door] = SHUT_AFTER[k]; m.s.shut[i] = true; if (at < i) { door(q).lock(); game.sound?.hit?.('block', 0.7); } else m.s.opened[i] = true; }
  if (k === 8 && at < 3) q.r3w.lock();
  const live = attempt(game, m); // a run left over from a quit or a retry shuts nothing
  z.walkTo(pts[k].x, pts[k].z, { run: true, near: 0.7, onArrive: () => { if (live()) flee(m, game, k + 1); } });
}
const inRoom = (game, k) => Q(game).inRoom(k, game.player.pos.x, game.player.pos.z);

export default {
  id: 'lastwar', chapter: 8, number: 7, title: 'המלחמה האחרונה', requires: ['kotzichase'],
  follows: true, secret: true,
  where: 'מול שער המפקדה של קוצי',
  startAt: (game) => { const q = Q(game); return q ? { x: q.gateOutside.x, z: q.gateOutside.z, y: q.y } : null; },
  reward: { money: 1200, unlocks: ['lastwar'], text: 'קוצי על הרצפה · 1,200 ₪' },

  setup(m, game) { m.s = { shut: [false, false, false], opened: [false, false, false], b: [false, false, false], seen: [0, 0], cool: 0 }; m.live = []; m.works = []; game.daylight?.set(0, 0); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const q = Q(game); game.start(q.gateOutside.x, q.gateOutside.z + 4, Math.PI); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3, 4, 5]); },
  restore(m, game, checkpoint) {
    const q = Q(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
    m.job?.cancel(); m.job = null; m.job2?.cancel(); m.job2 = null; m.work?.cancel(); m.work = null; for (const w of m.works || []) w?.cancel(); m.works = []; stopFight(m);
    for (const x of m.live || []) x.cancel(); m.live = []; game.fx.clear();
    m.stopSiren?.(); m.stopSiren = null;
    if (game.mode === 'car') game.exitCar();
    resetDoors(game);
    const at = [q.gateOutside, q.gateOutside, q.gateInside, { ...q.server.keypadAt, x: q.server.keypadAt.x - 3 }, q.passage.south, q.rooms[2].inside, q.control.doorAt][checkpoint] || q.gateOutside;
    game.player.place(at.x, at.z, at.yaw ?? Math.PI, q.y); game.follow.snapBehind(at.yaw ?? Math.PI);
    crew(game, game.player.pos, at.yaw ?? Math.PI);
    game.paint.dispose(); hideGuards(game, ids(ALL)); postGuards(game, q, ALL); armCrew(game); game.paint.reset();
    const done = [];
    if (checkpoint >= 2) done.push(...YARD); if (checkpoint >= 3) done.push(...GARAGE); if (checkpoint >= 4) done.push(...SERVER); if (checkpoint >= 5) done.push(...ROOMS, ...NORTH);
    for (const g of game.paint.guards) if (done.some(([id]) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore');
    if (checkpoint >= 2) { q.gate.unlock(); q.gate.setOpen(true); } else q.gate.lock();
    if (checkpoint >= 4) { q.server.door.unlock(); q.server.door.setOpen(true); shelf(game, true); }
    const z = game.npc('kotzi'); z.floorY = null; z.target = null; z.model.setPose(null);
    if (checkpoint >= 5) { z.place(q.control.kotzi.x, q.control.kotzi.z, 0, q.y); z.show(true); q.command.back.unlock(); q.command.back.setOpen(true); q.command.front.lock(); q.rooms[1].door.unlock(); q.rooms[1].door.setOpen(true); q.rooms[2].door.unlock(); q.rooms[2].door.setOpen(true); q.r3w.lock(); q.control.door.lock(); }
    else z.show(false);
    if (checkpoint === 6) { defences(game, false); q.r3w.unlock(); q.r3w.setOpen(true); q.control.door.unlock(); q.control.door.setOpen(true); }
    m.s = { ...m.s, gateOpen: checkpoint >= 2, note: checkpoint >= 3, serverOpen: checkpoint >= 4, shelfOpen: checkpoint >= 4, backOpen: checkpoint >= 5, met: checkpoint >= 5, kotziIn: checkpoint >= 5, opened: [checkpoint >= 5, checkpoint >= 5, checkpoint >= 5], shut: [checkpoint >= 5, checkpoint >= 5, checkpoint >= 5], fleeK: null, b: [false, false, false], r3wOpen: checkpoint >= 6, seen: [0, 0], cool: 0, won: false, lost: false, end: false };
  },
  cleanup(m, game) {
    const q = Q(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
    m.job?.cancel(); m.job = null; m.job2?.cancel(); m.job2 = null; m.work?.cancel(); m.work = null; for (const w of m.works || []) w?.cancel(); m.works = []; stopFight(m);
    for (const x of m.live || []) x.cancel(); m.live = [];
    game.paint.dispose(); hideGuards(game, ids(ALL));
    defences(game, false);
    for (const id of ['shpitz']) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
    if (!m.done) { m.stopSiren?.(); m.stopSiren = null; resetDoors(game); q.gate.lock(); const z = game.npc('kotzi'); z.model.setPose(null); z.show(false); }
    if (!m.done || !handsOver(game)) endCrew(game);
  },

  steps: [
    { // 0: at the gate
      objective: 'המפקדה של קוצי',
      enter(m, game) {
        const q = Q(game);
        game.cutscene = true; game.hud.setCinematic(true);
        arriveCrew(game, q.gateOutside);
        resetDoors(game); q.gate.lock();
        game.paint.dispose(); hideGuards(game, ids(ALL)); postGuards(game, q, ALL);
        game.follow.shot({ x: q.gateOutside.x + 10, y: q.y + 6, z: q.gateOutside.z + 14 }, { x: q.x, y: q.y + 3, z: q.z }, 9999);
        game.hud.banner('המפקדה של קוצי', '07:05', 'המקום הכי גדול · חדר הפיקוד בצפון', 3200);
        const live = attempt(game, m); game.dialogue.play(GATE).then(() => { if (live()) m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); armCrew(game); game.paint.reset(); },
    },
    { // 1: the gate and the yard
      objective: 'השער · ואז החצר', checkpoint: true,
      enter(m, game) {
        const q = Q(game);
        if (!m.s.gateOpen) m.job = new Job(game, { who: 'ido', at: { x: q.gateOutside.x + 1.8, z: q.gateOutside.z - 2.6, yaw: Math.PI }, seconds: 4, near: 14, pill: 'עידו פותח את השער', onDone: () => { q.gate.unlock(); q.gate.setOpen(true); m.s.gateOpen = true; } });
        m.s.boomT = m.t + 10;
      },
      target(m, game) { const q = Q(game); return !m.s.gateOpen ? { ...q.gateOutside, r: 3 } : nearestGuard(game, ids(YARD)) || { ...q.garage.opening, r: 3 }; },
      update(m, game, dt) {
        const q = Q(game);
        m.job?.update(dt);
        if (m.s.gateOpen && m.t > m.s.boomT) { m.s.boomT = m.t + 11 + Math.random() * 6; const me = game.player.pos, a = Math.random() * Math.PI * 2; m.live.push(new Blast(game, { at: { x: me.x + Math.cos(a) * 15, y: q.y, z: me.z + Math.sin(a) * 15 }, size: 1.6, warn: 1.6, radius: 3, fire: 15 })); }
        for (const x of m.live) x.update(dt);
        const n = left(game, ids(YARD));
        say(m, game, !m.s.gateOpen ? 'השער · עידו פותח · לחפות עליו' : n ? `החצר: לסמן את השומרים והמגדלים (${YARD.length - n}/${YARD.length}) · סומנת ${game.paint.hits}/3` : 'החצר נקייה · למוסך במערב');
        return m.s.gateOpen && !n ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; game.dialogue.play(GARAGE_LINES); },
    },
    { // 2: the garage: the note
      objective: 'המוסך · הפתק במשרד', checkpoint: true,
      target(m, game) { const q = Q(game); return left(game, ids(GARAGE)) ? nearestGuard(game, ids(GARAGE)) || { ...q.garage.opening, r: 3 } : !m.s.note ? { ...q.garage.note, r: 1.2 } : { ...q.server.keypadAt, r: 1.4 }; },
      interaction(m, game) { const q = Q(game); if (game.mode !== 'foot' || m.s.note || !near(game.player.pos, q.garage.note, 2.0)) return null; return { label: 'לקרוא את הפתק', priority: 5, run: () => { m.s.note = true; game.hud.toast(`הקוד לאולם השרתים: ${q.code.split('').join('-')}`, 4200); game.dialogue.play(NOTE); } }; },
      update(m, game, dt) {
        for (const x of m.live) x.update(dt);
        const n = left(game, ids(GARAGE));
        say(m, game, n ? `המוסך: לסמן את השומרים (${GARAGE.length - n}/${GARAGE.length})` : !m.s.note ? 'הפתק על השולחן במשרד הקטן' : 'הקוד אצלך · לאולם השרתים במזרח');
        return !n && m.s.note ? 'next' : null;
      },
    },
    { // 3: the server hall: the keypad, the shelf, the hidden door
      objective: 'אולם השרתים · הקוד בדלת', checkpoint: true,
      target(m, game) { const q = Q(game); if (!m.s.serverOpen) return { ...q.server.keypadAt, r: 1.4 }; if (left(game, ids(SERVER))) return nearestGuard(game, ids(SERVER)); return m.s.shelfOpen ? { ...q.server.hidden.strip, r: 1.4 } : { ...q.server.shelfAt, r: 1.6 }; },
      interaction(m, game) {
        const q = Q(game);
        if (game.mode !== 'foot' || m.s.serverOpen || !near(game.player.pos, q.server.keypadAt, 2.0)) return null;
        return { label: 'להקיש את הקוד', priority: 5, run: () => { game.keypad.open(q.code, 'הקוד מהפתק במוסך').then((ok) => { if (ok) { m.s.serverOpen = true; q.server.door.unlock(); q.server.door.setOpen(true); game.hud.toast('הדלת נפתחה', 1400); } }); } };
      },
      update(m, game, dt) {
        const q = Q(game), n = left(game, ids(SERVER));
        m.job?.update(dt);
        if (m.s.serverOpen && !n && !m.s.shelfJob) { m.s.shelfJob = true; game.dialogue.play(SHELF); m.job = new Job(game, { who: 'ido', at: q.server.shelfAt, seconds: 3, near: 12, pill: 'עידו מזיז את המדף', onDone: () => { shelf(game, true); m.s.shelfOpen = true; game.hud.toast('דלת נסתרת', 1400); game.dialogue.play(PASSAGE); } }); }
        say(m, game, !m.s.serverOpen ? 'הדלת של אולם השרתים · להקיש את הקוד' : n ? `אולם השרתים: לסמן את השומרים (${SERVER.length - n}/${SERVER.length})` : !m.s.shelfOpen ? 'עידו מזיז את המדף בקיר הצפוני' : 'דרך הדלת הנסתרת · צפונה');
        return m.s.shelfOpen && near(game.player.pos, q.passage.south, 3.5) ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 4: the passage, the back door; Kotzi runs through the three rooms
      objective: 'המעבר צפונה · לחדר הפיקוד', checkpoint: true,
      target(m, game) {
        const q = Q(game);
        if (!m.s.backOpen) return { ...q.command.backAt, r: 1.6 };
        if (!m.s.met) return { ...q.command.inside, r: 2 };
        const k = [0, 1, 2].find((i) => !m.s.opened[i]);
        if (k != null) return nearestGuard(game, ids(ROOMS)) && !inRoom(game, k) ? nearestGuard(game, ids(ROOMS)) : { ...q.rooms[k].doorAt, r: 1.6 };
        return nearestGuard(game, ['kg4']) || { ...q.rooms[2].inside, r: 2 };
      },
      update(m, game, dt) {
        const q = Q(game), me = game.player.pos;
        m.job?.update(dt);
        if (!m.s.backOpen && !m.job && near(me, q.command.backAt, 8)) m.job = new Job(game, { who: 'ido', at: q.command.backAt, seconds: 2.5, near: 10, pill: 'עידו פותח את הדלת האחורית', onDone: () => { q.command.back.unlock(); q.command.back.setOpen(true); m.s.backOpen = true; m.job = null; } });
        if (m.s.backOpen && !m.s.met && q.inCommand(me.x, me.z)) {
          m.s.met = true;
          const z = game.npc('kotzi'); z.floorY = null; z.model.setPose(null); z.place(q.command.kotzi.x, q.command.kotzi.z, 0, q.y); z.show(true); z.lookAt(me.x, me.z);
          const live = attempt(game, m);
          game.dialogue.play(KOTZI).then(() => { if (!live() || m.s.fleeK != null) return; game.dialogue.play(RUN); flee(m, game, 0); });
        }
        // a door he shut, opened by Ido once the room before it is clear and Nehorai is at it
        // Kotzi never sticks on the way: a step that takes too long, and he is at the next point
        if (m.s.met && !m.s.kotziIn && m.s.fleeK != null && m.t - m.s.fleeT > 6) { const pts = FLIGHT(q), p = pts[Math.min(m.s.fleeK, pts.length - 1)], z = game.npc('kotzi'); z.target = null; z.place(p.x, p.z, 0, q.y); flee(m, game, m.s.fleeK + 1); }
        // and never sealed in: past one of his doors that is locked all the same (slipped through as it shut), it opens again
        if (m.s.met) { const at = along(game); DOORS(q).forEach((d, i) => { if (i <= at && d.locked) { d.unlock(); d.setOpen(true); if (i < 3) m.s.shut[i] = m.s.opened[i] = true; } }); }
        if (m.s.met && !m.job) for (const k of [0, 1, 2]) {
          if (m.s.opened[k]) continue;
          if (!m.s.shut[k]) break; // he has not shut it yet
          const d = q.rooms[k].door, clear = k === 0 ? true : !left(game, [ROOMS[k - 1][0]]);
          if (clear && near(me, q.rooms[k].doorAt, 7)) m.job = new Job(game, { who: 'ido', at: q.rooms[k].doorAt, seconds: 2.5, near: 9, pill: 'עידו פותח את הדלת', onDone: () => { d.unlock(); d.setOpen(true); m.s.opened[k] = true; m.job = null; } });
          break;
        }
        const n = left(game, ids(ROOMS));
        say(m, game, !m.s.backOpen ? 'המעבר הארוך · לדלת האחורית של חדר הפיקוד' : !m.s.met ? 'לחדר הפיקוד' : n ? `קוצי בורח · לנקות את החדרים (${ROOMS.length - n}/${ROOMS.length}) · עידו פותח את הדלתות` : 'החדר השלישי נקי');
        return m.s.met && inRoom(game, 2) && !left(game, ['kg4']) && m.s.kotziIn ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 5: the defences: two laser gates, two cameras, three breakers
      objective: 'מערכות ההגנה · שלושה מפסקים', checkpoint: true,
      enter(m, game) {
        const q = Q(game), s = q.security;
        defences(game, true);
        m.stopSiren = game.sound?.siren?.(30) || null;
        game.hud.banner('', 'קוצי מפעיל את ההגנות', 'שערי לייזר · מצלמות', 2400);
        game.dialogue.play(DEFENCES);
        m.works = [];
        q.control.door.lock(); if (!m.s.r3wOpen) q.r3w.lock(); // shut as a retry from here has them, also when they stayed open behind Nehorai on his heels
        if (!m.s.r3wOpen) m.job = new Job(game, { who: 'ido', at: q.r3wAt, seconds: 2, near: 12, pill: 'עידו פותח את הדלת למסדרון', onDone: () => { q.r3w.unlock(); q.r3w.setOpen(true); m.s.r3wOpen = true; m.job = null; } });
        m.works[0] = new Work(game, { at: s.breakers[0], seconds: 2, label: 'להוריד את המפסק', pill: 'מפסק 1', near: 2.0, onDone: () => { m.s.b[0] = true; s.gates[0].unlock(); s.gates[0].setOpen(true); game.hud.toast('שער הלייזר הראשון כבוי', 1500); m.job2 = new Job(game, { who: 'erez', at: s.breakers[1], seconds: 2.5, near: 14, pill: 'ארז מוריד את המפסק השני', onDone: () => { m.s.b[1] = true; s.gates[1].unlock(); s.gates[1].setOpen(true); game.hud.toast('שער הלייזר השני כבוי', 1500); } }); } });
        m.works[2] = new Work(game, { at: s.breakers[2], seconds: 2, label: 'להוריד את המפסק', pill: 'מפסק 3', near: 2.0, onDone: () => { m.s.b[2] = true; for (const c of s.cameras) c.setOn(false); q.control.door.unlock(); q.control.door.setOpen(true); m.stopSiren?.(); m.stopSiren = null; game.hud.toast('המצלמות כבויות · הדלת פתוחה', 1800); } });
      },
      target(m, game) { const s = Q(game).security, q = Q(game); if (!m.s.b[0]) return { ...s.breakers[0], r: 1.2 }; if (!m.s.b[1]) return { ...s.breakers[1], r: 1.2 }; if (!m.s.b[2]) return { ...s.breakers[2], r: 1.2 }; return { ...q.control.doorAt, r: 1.6 }; },
      interaction(m, game) { if (!m.s.b[0]) return m.works[0]?.interaction(game) || null; if (m.s.b[1] && !m.s.b[2]) return m.works[2]?.interaction(game) || null; return null; },
      update(m, game, dt) {
        const q = Q(game), s = q.security, me = game.player.pos;
        m.job?.update(dt); m.job2?.update(dt);
        for (const w of m.works) w?.update(dt);
        // the cameras: in sight, a beep each second; two and a half seconds, a mark
        m.s.cool = Math.max(0, m.s.cool - dt);
        s.cameras.forEach((c, i) => {
          if (!c.on || game.mode !== 'foot') return;
          if (c.sees(game.world, me.x, me.z) && m.s.cool <= 0) { const b4 = m.s.seen[i]; m.s.seen[i] += dt; if (Math.floor(m.s.seen[i]) > Math.floor(b4)) game.sound?.beep?.(1, 1300); if (m.s.seen[i] > 2.5) { m.s.seen[i] = 0; m.s.cool = 1.5; game.paint.strike('מצלמה!', '#ff4a4a'); } }
          else m.s.seen[i] = Math.max(0, m.s.seen[i] - dt * 1.5);
        });
        const k = m.s.b.filter(Boolean).length;
        say(m, game, k < 3 ? `מפסקים (${k}/3) · להישאר מחוץ לקונוסים של המצלמות · סומנת ${game.paint.hits}/3` : 'ההגנות כבויות · לחדר הבקרה');
        return k === 3 && near(me, q.control.doorAt, 3) ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; m.job2?.cancel(); m.job2 = null; for (const w of m.works || []) w?.cancel(); m.works = []; },
    },
    { // 6: Nehorai and Kotzi
      objective: 'הקרב האחרון', checkpoint: true,
      enter(m, game) {
        const q = Q(game), c = q.control;
        game.cutscene = true; game.hud.setCinematic(true);
        game.paint.disarmPlayer();
        const z = game.npc('kotzi'), sh = game.npc('shpitz');
        z.floorY = null; z.target = null; z.place(c.kotzi.x, c.kotzi.z, Math.PI, q.y); z.show(true); z.model.setPose(null);
        sh.floorY = null; sh.target = null; sh.place(c.kotzi.x + 2.5, c.kotzi.z + 1, Math.PI, q.y); sh.show(true); sh.model.setPose(null);
        game.player.place(c.arena.x, c.arena.z + 3, Math.PI, q.y);
        for (const [id, dx] of [['erez', -2], ['ido', 2]]) { const n = game.npc(id); n.target = null; n.place(c.arena.x + dx, c.arena.z + 3.6, Math.PI, q.y); game.squad.send(id, { x: c.arena.x + dx, z: c.arena.z + 3.6 }, { label: 'בקרב' }); n.target = null; }
        game.follow.shot({ x: c.arena.x + 5, y: q.y + 2.6, z: c.arena.z + 6 }, { x: c.kotzi.x, y: q.y + 1.2, z: c.kotzi.z }, 9999);
        const live = attempt(game, m);
        game.dialogue.play(FIGHT).then(() => {
          if (!live() || m.fight) return;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(Math.PI);
          m.fight = new Fight(game, {
            opponents: [{ npc: z, hp: 110, power: 1.0, aggression: 1.08, windup: 0.6, open: 0.9, moves: ['jab', 'cross', 'swing', 'cross'], name: 'קוצי' }, { npc: sh, hp: 60, power: 0.8, aggression: 0.9, moves: ['jab', 'cross'], name: 'שפיץ' }],
            allies: [{ npc: game.npc('erez'), hp: 90, power: 0.85 }, { npc: game.npc('ido'), hp: 90, power: 0.85 }],
            maxAttackers: 2,
            onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; },
          });
          game.hud.toast('להתחמק, לחסום, להכות · הכפתורים בצד ימין', 3000);
        });
      },
      update(m, game) {
        say(m, game, m.s.won ? 'קוצי על הרצפה' : 'קוצי ושפיץ · להתחמק, לחסום, להכות');
        if (m.s.lost) return 'fail:קוצי הפיל אותך. ארז: "מההתחלה, אחי. הפעם תתחמק לפני שאתה מכה."';
        if (m.s.won && !m.s.end) {
          m.s.end = true;
          const z = game.npc('kotzi'); z.model.setPose('down');
          const live = attempt(game, m);
          game.dialogue.play(WON).then(() => {
            if (!live()) return;
            m.stopSiren?.(); m.stopSiren = game.sound?.siren?.(6) || null;
            game.hud.banner('אזעקה', 'המפקדה עומדת להתפוצץ!', 'שתי דקות', 2800);
            game.follow.shake(0.6); game.fx.explode(Q(game).x - 30, Q(game).y + 5, Q(game).z - 40, { size: 2, light: false });
            setTimeout(() => { if (live()) m.s.over = true; }, 2800); // the alarm read first: the escape's start puts its own banners up
          });
        }
        return m.s.over ? 'next' : null;
      },
      exit(m, game) { stopFight(m); for (const id of ['erez', 'ido']) game.squad.release(id); },
    },
  ],
  complete(m, game) { m.done = true; },
};
