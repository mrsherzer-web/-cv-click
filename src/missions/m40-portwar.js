// Chapter nine, mission 7, "מלחמת הנמל". The markers are back in the gang's hands, and the facility's alarm
// goes off: the red emergency light in every hall, the siren, the Shadow on the speakers sending all of the
// facility's security after them, the action music. Out of the armory, the Order's men come at them down the
// iron corridor from both ends (the side bays are the cover); the tunnel south, where a charge shuts the door
// to the hangar in fire (the way changes: west, through the stores); the storage halls, men among the racks,
// a ceiling beam that comes down across a lane and a stack of drums that goes up; two ways into the hangar
// (the west door or the south tunnel); and the giant hangar itself: the Order behind the vehicles, fuel tanks a
// pellet sets off, the great door opening to let more in from the surface, more out of the side room, the
// crane's truss coming down, smoke and fire everywhere. At the end Erez goes to check the side room and the
// Order's charge by its door jams it shut with him behind it. The squad fights alongside (and takes orders),
// every blast and every falling thing warns first. Paint, never blood: a marked man sits down. Invented.
import { near, say, nearestGuard } from './missions.js';
import { TEAM, endCrew, failOut, attempt, Job } from './phoenix.js';
import {
  FAC, L, zone, handsTo, underground, hush, become, gangAt, armed, upAgain, freshMarks, beatenAt, offBoard, Wave,
  FBlast, fallingBeam, TRUSS_AT, truss, fuelTanks, blowVehicle, rumble, redLight, flicker, flickerOn, beats, later, talkOn, clearAll,
  byExit, exitClear, shutExit,
} from './phoenix-c.js';

const ORDER = Array.from({ length: 16 }, (_, i) => `og${i + 1}`);
// the waves (local points: x east, z south of the facility's centre); `from` is where each comes in
const W1 = (g) => [
  { id: 'og5', from: L(g, 78.5, -28.5), post: L(g, 72, -29.4) }, { id: 'og6', from: L(g, 77, -22), post: L(g, 75.5, -27) },
  { id: 'og7', from: L(g, 78.5, -27), post: L(g, 68, -26.6), hot: false },
  { id: 'og8', from: L(g, 18, -17.5), post: L(g, 18, -27), hot: false }, { id: 'og9', from: L(g, 18, -17.5), post: L(g, 18.4, -29), hot: false },
];
const W2 = (g) => [
  { id: 'og10', post: L(g, 77, -15, 0, Math.PI), still: true }, { id: 'og11', post: L(g, 64, -8, 0, Math.PI / 2), still: true },
  { id: 'og12', post: L(g, 46, -8, 0, Math.PI / 2), still: true },
];
const W3 = (g) => [
  { id: 'og1', post: L(g, 11.5, -4, 0, Math.PI / 2), still: true }, { id: 'og2', post: L(g, 4, 9, 0, Math.PI / 2), still: true },
  { id: 'og4', post: L(g, 21, 17, 0, Math.PI), still: true },
];
const W3B = (g) => [{ id: 'og13', from: L(g, -30, 9), post: L(g, -12, 9) }, { id: 'og10', from: L(g, -36, 4), post: L(g, -14, 4) }];
const W4A = (g) => [
  { id: 'og3', post: L(g, 52, 22, 0, -Math.PI / 2), still: true }, { id: 'og14', post: L(g, 61, 25, 0, -Math.PI / 2), still: true },
  { id: 'og15', post: L(g, 71.5, 30, 0, -Math.PI / 2), still: true }, { id: 'og16', post: L(g, 59.5, 34, 0, -Math.PI / 2), still: true },
  { id: 'og5', post: L(g, 52, 40, 0, -Math.PI / 2), still: true }, { id: 'og6', post: L(g, 74, 40, 0, -Math.PI / 2), still: true },
];
// the second wave: in through the great door (each just inside it as it rises, so none is left out on the ramp
// when it comes down again), and out of the side room (each through its doorway, on the hangar's side of the wall:
// they come straight at the player, and from inside the room that line would run into its wall)
const W4B = (g) => [
  { id: 'og7', from: L(g, 84.3, 28.6), post: L(g, 79, 26) }, { id: 'og10', from: L(g, 63.2, 9.2), post: L(g, 60, 14) },
  { id: 'og8', from: L(g, 84.3, 31.4), post: L(g, 80, 34) }, { id: 'og11', from: L(g, 63.8, 9.6), post: L(g, 66, 14) },
  { id: 'og9', from: L(g, 84.3, 30), post: L(g, 74, 30) }, { id: 'og12', from: L(g, 63.0, 10.0), post: L(g, 56, 12) },
];

// the user's lines, exactly
const MANY = [['עידו', 'נהוראי! יש עוד מלא אויבים!'], ['נהוראי', 'יופי, שלא יהיה משעמם!']];
const ALARM = [
  ['רמקול', 'אזעקה כללית. פריצה למחסן הנשקים. כל כוחות האבטחה — למפלס התחתון.'],
  ['הצל', 'החבורה של נהוראי חמושה שוב. יפה. כל הכוחות של המתקן — עכשיו. אף אחד מהם לא יוצא מכאן.'],
  ['ארז', 'הוא מפעיל עלינו את כל מה שיש לו.'],
  ['נהוראי', 'אז נעבור דרך כל מה שיש לו. המנהרות, המחסנים, ההאנגר — ומשם החוצה.'],
];
const BOTH_ENDS = [['עידו', 'מגיעים משני הצדדים של המסדרון! להיכנס למפרצים!']];
const CORRIDOR_DONE = [['ארז', 'המסדרון נקי. למנהרה, בקצה המזרחי.']];
const SHUT = [['עידו', 'הדלת להאנגר נחסמה! מערבה, דרך המחסנים!']];
const STORES = [['מולר', 'מחסנים. הם בין המדפים.']];
const BEAM = [['ליאם', 'הקורה! אחים, זזים!']];
const STORES_DONE = [['ארז', 'שתי דרכים להאנגר: הדלת המערבית, או המנהרה הדרומית.']];
const WEST = [['עידו', 'הדלת להאנגר נעולה. תן לי ארבע שניות איתה — ותחפו עליי.']];
const MORE = [['דולב', 'הדלת הגדולה נפתחת! עוד מהם מבחוץ!'], ['הדר', 'Bro, וגם מהחדר הצדדי!']];
const TRUSS = [['יונתי', 'הגשר של המנוף! הוא נופל!']];
const SIDE = [['ארז', 'יש עוד מישהו בחדר הצדדי. אני בודק.'], ['נהוראי', 'ארז, חכה—']];
const TRAPPED = [['ארז', 'נהוראי! הדלת נתקעה! אני לכוד פה!', 'phone']];
const OUT = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "מההתחלה, אחי. מחסה במפרצים ומאחורי הרכבים — ותגיד לחבורה לחפות עליך."';

// the doors as the fight has them by checkpoint `cp`: open for the way, the hangar's north door shut by the
// charge from the tunnel on, the great door to the surface shut (it opens once, for the Order). The guard rooms
// open onto the corridor (two of the first wave come out of the second; mission 39 leaves its door shut), their
// back doors into the stores locked as 39 has them (the way to the stores is the tunnel)
function doors(game, cp) {
  const f = FAC(game);
  f.setDoors({ armory: true, rackGate: true, t1Corridor: true, t1Stores: true, t2Stores: true, hangarW: cp >= 4 ? true : 'locked', t2Hangar: true, t1Hangar: cp >= 3 ? 'locked' : true, trap: true, saferoom: true, exit: 'locked', shutter: true, guardRoom1: true, guardRoom2: true, guardRoom1Back: 'locked', guardRoom2Back: 'locked' });
  f.snapDoors();
  f.armory.rack.all(); f.armory.reader.light(true); f.armory.keypad.light(true);
  f.exit.panel.light(false);
}
// the fight's fire and smoke where things went up before this checkpoint
function scars(m, game, cp) {
  if (cp >= 3) { const d = L(game, 77, 5); m.smoke.push(game.fx.burn(d.x, d.y + 0.2, d.z, { r: 1.4, strength: 1.2, seconds: 900 }), game.fx.smokeColumn(d.x, d.y + 0.5, d.z, { r: 1, seconds: 900 })); }
  if (cp >= 4) { const d = L(game, 11.3, 9); m.smoke.push(game.fx.burn(d.x, d.y + 0.2, d.z, { r: 1, strength: 0.8, seconds: 900 })); }
}
// where each checkpoint picks up: the gang formed there, facing the way
const AT = (game, cp) => [FAC(game).armory.inside, FAC(game).armory.inside, L(game, 77, -23, 0, 0), L(game, 23.5, -8, 0, -Math.PI / 2), L(game, 33, 20, 0, Math.PI / 2)][cp] || FAC(game).armory.inside;
const YAW = [Math.PI, Math.PI, 0, -Math.PI / 2, Math.PI / 2];

function stage(m, game, cp) {
  const f = FAC(game);
  clearAll(m, game); truss(game, false); // (the crane's truss is still up: it comes down in the hangar)
  underground(game);
  become(game, 'nehorai');
  f.hangar.vehicles.forEach((v) => v.reset()); f.hangar.trap.open(); f.medkit.reset();
  doors(game, cp);
  game.paint.dispose(); offBoard(game, ORDER);
  gangAt(game, AT(game, cp), YAW[cp] ?? 0, { lead: 'nehorai' });
  armed(game, TEAM); game.paint.reset(); freshMarks(game);
  m.w = {};
  if (cp === 2) beatenAt(game, W1(game));
  if (cp === 2) m.w.w2 = new Wave(game, W2(game), { now: true, hot: false });
  if (cp === 3) beatenAt(game, W2(game));
  if (cp >= 3) m.w.w4a = new Wave(game, W4A(game), { now: true, hot: false }); // waiting in the hangar behind its walls
  scars(m, game, cp);
  redLight(game); game.sound?.music?.('action', { fade: 0.4 });
  m.stopSiren = game.sound?.siren?.(600, 0.035) || null;
  m.s = { cp };
}
// the arrow: the nearest of the Order still standing of these waves; how many of a wave are dealt with
const foes = (m, ...keys) => keys.flatMap((k) => m.w?.[k]?.ids || []);
const done = (w) => (w ? w.total - w.left : 0);

export default {
  id: 'portwar', chapter: 9, number: 7, title: 'מלחמת הנמל', requires: ['armory'], follows: true,
  where: 'במחסן הנשקים',
  startAt: (game) => { const a = FAC(game)?.armory; return a ? { ...a.inside, r: 2 } : null; },
  reward: { money: 900, unlocks: ['portwar'], text: 'עברתם את המנהרות, המחסנים וההאנגר · 900 ₪' },

  setup(m, game) { m.s = {}; m.w = {}; m.live = []; m.beams = []; m.smoke = []; m.talk = []; underground(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const a = FAC(game).armory.inside; game.player.place(a.x, a.z, Math.PI, a.y); game.follow.snapBehind(Math.PI); underground(game); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3, 4]) && OUT; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live || []) x.update(dt);
    for (const b of m.beams || []) b.update(dt);
    flickerOn(m, game, dt);
    if (m.stepIndex >= 1 && m.stepIndex <= 4) rumble(m, game, dt, { every: 13 });
  },
  cleanup(m, game) {
    const f = FAC(game);
    clearAll(m, game);
    // straight on into the hangar's next minutes: the truss stays down where it fell (the falling one was this
    // mission's own, the one lying there now is the stretch's)
    if (m.done && handsTo(game, 'wounded')) { truss(game, true); underground(game); redLight(game, ['hangar']); game.sound?.music?.('action', { fade: 0.4 }); return; }
    truss(game, false);
    game.paint.dispose(); offBoard(game, ORDER);
    f.reset(); f.snapDoors(); if (game.missions.done('armory')) f.armory.rack.all();
    game.npc('erez').model.setPose(null);
    endCrew(game);
    game.overlay?.mapHidden(false);
  },

  steps: [
    { // 0: the alarm
      objective: 'האזעקה',
      enter(m, game) {
        const f = FAC(game), sq = game.squad;
        const fresh = !(sq.active && TEAM.every((id) => sq.ids.includes(id)) && game.paint.armed && f.zoneAt(game.player.pos.x, game.player.pos.z) === 'armory');
        clearAll(m, game); truss(game, false); underground(game); become(game, 'nehorai');
        f.hangar.vehicles.forEach((v) => v.reset()); f.hangar.trap.open(); f.medkit.reset();
        doors(game, 0);
        // whatever of the round before is on the board goes (the men beaten in the armory stay where they sit)
        for (const gd of [...game.paint.guards]) game.paint.removeGuard(gd.npc);
        if (fresh) offBoard(game, ORDER);
        // the alarm's shot looks at the armory's middle: the gang stands there for it, carried on from the wall
        // of weapons or on a fresh page alike (placed under the cut to the shot)
        gangAt(game, f.armory.inside, Math.PI, { lead: 'nehorai' });
        for (const id of TEAM) { const n = game.npc(id); n.idle = null; n.posed = false; }
        armed(game, TEAM); game.paint.reset(); freshMarks(game);
        m.s = { cp: 0 }; m.w = {};
        game.cutscene = true; game.hud.setCinematic(true);
        const a = f.armory.inside;
        game.follow.shot({ x: a.x - 6, y: a.y + 2.6, z: a.z - 9 }, { x: a.x, y: a.y + 1.2, z: a.z + 2 }, 9999);
        m.beats = beats(game, [
          ['do', () => { redLight(game); m.stopSiren = game.sound?.siren?.(600, 0.035) || null; game.sound?.beep?.(3, 520, 0.35); game.follow.shake(0.4); game.hud.banner('אזעקה', 'כל כוחות האבטחה של המתקן', 'הצל מפעיל את כולם', 3000); }],
          ['wait', 1.2],
          ['do', () => game.sound?.music?.('action')],
          ['say', ALARM],
          ['wait', 0.3],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the iron corridor, from both ends
      objective: 'הגל הראשון · במסדרון', checkpoint: true,
      enter(m, game) { freshMarks(game); upAgain(game); m.w.w1 = new Wave(game, W1(game), { gap: 2.0, hot: true, delay: 2.5 }); m.s.w1Said = false; },
      target(m, game) {
        const f = FAC(game);
        if (zone(game) === 'armory') return { ...f.armory.doorAt, r: 1.6 };
        return nearestGuard(game, foes(m, 'w1')) || { ...L(game, 77, -23.2), r: 2 };
      },
      update(m, game, dt) {
        const w = m.w.w1;
        w.update(dt);
        if (!m.s.w1Said && m.t > 3) { m.s.w1Said = true; later(m, game, BOTH_ENDS); game.hud.toast('כפתור החבורה: "תחפו עליי!" · הם יורים על מי שעליך', 3200); }
        if (w.done && !w.left && !m.s.w1Done) { m.s.w1Done = true; later(m, game, CORRIDOR_DONE); }
        say(m, game, zone(game) === 'armory' ? 'לצאת למסדרון הברזל · הם באים משני הצדדים' : w.left ? `המסדרון: לסמן אותם (${done(w)}/${w.total}) · מחסה במפרצים · סומנת ${game.paint.hits}/3` : 'המסדרון נקי · למנהרה בקצה המזרחי');
        return w.done && !w.left && near(game.player.pos, L(game, 77, -24), 3.2) ? 'next' : null;
      },
    },
    { // 2: the tunnel; the charge shuts the hangar's door; west, to the stores
      objective: 'המנהרה · דרומה', checkpoint: true,
      enter(m, game) {
        freshMarks(game); upAgain(game);
        if (!m.w.w2) m.w.w2 = new Wave(game, W2(game), { now: true, hot: false });
        m.s.shut = false; m.s.charge = false;
      },
      target(m, game) {
        if (!m.s.shut) return { ...L(game, 77, -10), r: 2 };
        return nearestGuard(game, foes(m, 'w2')) || { ...L(game, 28.2, -8), r: 1.8 };
      },
      update(m, game) {
        const p = game.player.pos, lz = p.z - FAC(game).z, w = m.w.w2;
        // the Order's charge at the far end of the tunnel: the ring, the beeps, the door to the hangar shut in fire
        if (!m.s.charge && (lz > -17 || m.t > 25)) {
          const d = L(game, 77, 4);
          m.s.charge = true;
          m.live.push(new FBlast(game, { at: d, size: 2.2, warn: 1.8, radius: 3.5, fire: 0, onBoom: () => {
            FAC(game).doors.t1Hangar.lock(); flicker(m, game, L(game, 77, -8, 3.4)); // the blast took a cable: the tunnel's lights fail for a moment
            m.smoke.push(game.fx.burn(d.x, d.y + 0.2, d.z + 1, { r: 1.4, strength: 1.2, seconds: 900 }), game.fx.smokeColumn(d.x, d.y + 0.5, d.z, { r: 1, seconds: 900 }));
            m.s.shut = true; game.hud.banner('', 'הדלת להאנגר נחסמה', 'מערבה · דרך המחסנים', 2200); later(m, game, SHUT);
          } }));
        }
        say(m, game, !m.s.shut ? `דרומה במנהרה · סומנת ${game.paint.hits}/3` : w.left ? `המנהרה: לסמן אותם (${done(w)}/${w.total}) · ואז מערבה למחסנים` : 'מערבה במנהרה · לדלת המחסנים');
        return m.s.shut && zone(game) === 'stores' ? 'next' : null;
      },
    },
    { // 3: the storage halls: among the racks; the beam; the drums; two ways on
      objective: 'המחסנים', checkpoint: true,
      enter(m, game) {
        freshMarks(game); upAgain(game);
        m.w.w3 = new Wave(game, W3(game), { now: true, hot: false });
        m.w.w3b = new Wave(game, W3B(game), { gap: 2.5, hot: true, delay: 7 });
        if (!m.w.w4a) m.w.w4a = new Wave(game, W4A(game), { now: true, hot: false });
        m.s.beam = false; m.s.drums = false; m.job?.cancel(); m.job = null;
        later(m, game, STORES);
      },
      target(m, game) {
        const n = nearestGuard(game, foes(m, 'w3', 'w3b'));
        if (n) return n;
        const me = game.player.pos, a = L(game, 26, 20), b = L(game, -40, 32);
        return Math.hypot(me.x - a.x, me.z - a.z) <= Math.hypot(me.x - b.x, me.z - b.z) + 20 ? { ...L(game, 28, 20), r: 1.8 } : { ...L(game, -40, 33.6), r: 1.8 };
      },
      update(m, game, dt) {
        const w = m.w.w3, wb = m.w.w3b, f = FAC(game);
        wb.update(dt);
        const p = game.player.pos, lx = p.x - f.x, lz = p.z - f.z;
        // the beam across the east lane, after its warning (never on top of him: it waits until he is clear of it)
        if (!m.s.beam && (m.t > 9 || lz > 2) && !(Math.abs(lz - 11) < 2.5 && lx > 14.5)) {
          m.s.beam = true; later(m, game, BEAM);
          m.beams.push(fallingBeam(game, { at: L(game, 21.1, 11), len: 10.8, yaw: Math.PI / 2, from: 5.2, warn: 2.2, w: 0.6, h: 0.6 }));
        }
        // the drums by the middle lane: they go up after a warning, on whoever of the Order is by them
        if (!m.s.drums && m.t > 14) { m.s.drums = true; m.live.push(new FBlast(game, { at: L(game, 11.3, 9), size: 1.8, warn: 2.0, radius: 3.6, fire: 900 })); }
        const left = w.left + wb.left, total = w.total + wb.total;
        if (!left && !m.s.w3Said) { m.s.w3Said = true; later(m, game, STORES_DONE); }
        // the Order sealed the hangar's west door: Ido works it open (cover him), or the long way round, the south tunnel
        const door = f.doors.hangarW;
        if (door.locked && !m.job && near(p, L(game, 26, 20), 10)) {
          later(m, game, WEST);
          m.job = new Job(game, { who: 'ido', at: L(game, 28.6, 20, 0, Math.PI / 2), seconds: 4, near: 12, pill: 'עידו פורץ את הדלת להאנגר', onDone: () => { door.unlock(); door.setOpen(true); m.s.westOpen = true; game.hud.toast('הדלת המערבית פתוחה', 1400); } });
        }
        m.job?.update(dt);
        say(m, game, left ? `המחסנים: לסמן אותם (${total - left}/${total}) · בין המדפים · סומנת ${game.paint.hits}/3` : door.locked ? (m.job ? 'עידו פורץ את הדלת המערבית · לחפות עליו · או המנהרה הדרומית' : 'להאנגר · הדלת המערבית נעולה (עידו) · או המנהרה הדרומית') : 'להאנגר · דרך הדלת המערבית');
        return zone(game) === 'hangar' ? 'next' : null;
      },
    },
    { // 4: the giant hangar
      objective: 'ההאנגר', checkpoint: true,
      enter(m, game) {
        const f = FAC(game);
        freshMarks(game); upAgain(game);
        if (!m.w.w4a) m.w.w4a = new Wave(game, W4A(game), { now: true, hot: false });
        for (const gd of m.w.w4a.out) if (!gd.marked) { gd.alerted = true; gd.calledOut = true; gd.foe = { player: true, pos: game.player.pos, yaw: 0 }; }
        m.w.w4b = null;
        fuelTanks(m, game, f.hangar.vehicles);
        m.s.bT = null; m.s.truss = false; m.s.tanker = false; m.s.exitShut = false; m.s.many = false;
        const live = attempt(game, m);
        game.dialogue.stop();
        game.dialogue.play(MANY).then(() => { if (live()) m.s.many = true; });
        game.hud.toast('מיכלי הדלק האדומים: שלוש פגיעות, והרכב מתפוצץ על מי שלידו', 3600);
      },
      target(m, game) { return nearestGuard(game, m.w.w4b ? foes(m, 'w4b', 'w4a') : foes(m, 'w4a')); },
      update(m, game, dt) {
        const f = FAC(game), a = m.w.w4a;
        m.w.w4b?.update(dt);
        // the second wave: the great door rises and more come down the ramp, more out of the side room
        if (!m.w.w4b && (a.left <= 2 || m.t > 40)) {
          m.s.bT = m.t;
          f.doors.exit.unlock(); f.doors.exit.setOpen(true); flicker(m, game, L(game, 84, 30, 4.6)); // the power dips as the great door's motor takes it
          m.w.w4b = new Wave(game, W4B(game), { gap: 1.1, hot: true, delay: 1.2 });
          later(m, game, MORE);
          game.hud.banner('', 'הדלת הגדולה נפתחת', 'עוד כוחות מבחוץ', 2000);
        }
        const b = m.w.w4b;
        // the great door comes down again once they are all in, and nobody of the gang is out on the ramp or under it
        if (b && !m.s.exitShut && b.done && m.t - m.s.bT > 9 && exitClear(game)) { m.s.exitShut = true; shutExit(game); game.sound?.hit?.('crash', 0.5); }
        // the Order's own charge under the tanker (it warns; never when he stands by it)
        if (b && !m.s.tanker && m.t - m.s.bT > 4) {
          const e = m.tanks.find((q) => q.v.kind === 'tanker');
          if (!e || e.v.blown || e.blast) m.s.tanker = true;
          else if (!near(game.player.pos, e.v, 9)) { m.s.tanker = true; blowVehicle(m, game, e, { warn: 2.4, size: 3 }); }
          else if (m.t - m.s.bT > 25) m.s.tanker = true; // he keeps by it: they never get the chance
        }
        // the crane's truss comes down across the middle of the hangar
        if (b && !m.s.truss && m.t - m.s.bT > 10) {
          const me = game.player.pos, lz = me.z - f.z, lx = me.x - f.x;
          if (!(Math.abs(lx - 62) < 2.2 && lz > 23 && lz < 41)) {
            m.s.truss = true; later(m, game, TRUSS);
            m.beams.push(fallingBeam(game, TRUSS_AT(game)));
          } else if (m.t - m.s.bT > 30) m.s.truss = true; // he stands right under it: it holds
        }
        const left = a.left + (b ? b.left : W4B(game).length), total = a.total + W4B(game).length;
        say(m, game, left ? `ההאנגר: לסמן אותם (${total - left}/${total}) · מאחורי הרכבים · מיכלי הדלק · סומנת ${game.paint.hits}/3` : 'ההאנגר נקי');
        // done once the last of them is down and the hangar has had its tanker and its truss (whatever stands where)
        return b && !left && m.s.many && m.s.tanker && m.s.truss && m.beams.every((q) => q.done) && m.live.every((q) => q.done) ? 'next' : null;
      },
    },
    { // 5: Erez and the side room
      objective: 'החדר הצדדי',
      enter(m, game) {
        const f = FAC(game), T = f.hangar.trap, e = game.npc('erez');
        game.cutscene = true; game.hud.setCinematic(true);
        game.paint.clearProps();
        const door = L(game, 63, 8);
        game.follow.shot({ x: door.x - 7, y: door.y + 2.6, z: door.z + 9 }, { x: door.x, y: door.y + 1.2, z: door.z }, 9999);
        const me = game.player.pos;
        if (Math.hypot(me.x - T.at.x, me.z - T.at.z) < 6 || zone(game) !== 'hangar') { const q = L(game, 57, 16); game.player.place(q.x, q.z, Math.PI * 0.8, q.y); }
        // the great door down again if it is still up (he was out on the ramp after the last of them): whoever of
        // the gang is still out there is with him in the hangar first
        if (!m.s.exitShut) {
          m.s.exitShut = true;
          if (game.squad.ids.some((id) => byExit(game, game.npc(id).pos))) game.squad.form(game.squad.ids, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai' });
          shutExit(game);
        }
        e.target = null; e.place(T.at.x - 0.8, T.at.z + 1.8, Math.PI, T.at.y);
        game.squad.send('erez', T.room, { label: 'בודק' });
        m.beats = beats(game, [
          ['say', SIDE],
          ['until', () => FAC(game).zoneAt(e.pos.x, e.pos.z) === 'trap' || m.t > 9],
          ['do', () => {
            if (FAC(game).zoneAt(e.pos.x, e.pos.z) !== 'trap') { e.target = null; e.place(T.room.x, T.room.z, 0, T.room.y); }
            m.live.push(new FBlast(game, { at: L(game, 61, 10), size: 2.2, warn: 1.4, radius: 2.6, fire: 0, hurts: false, onBoom: () => {
              T.close(); game.fx.sparks(door.x, door.y + 1.6, door.z, 24); game.follow.shake(1.0);
              m.smoke.push(game.fx.smokeColumn(door.x - 1.5, door.y + 0.3, door.z + 1.5, { r: 1, seconds: 900 }), game.fx.burn(door.x - 2.2, door.y + 0.1, door.z + 2.2, { r: 0.8, strength: 0.7, seconds: 900 }));
              game.hud.banner('', 'הדלת נתקעה', 'ארז לכוד בחדר הצדדי', 2400);
            } }));
          }],
          ['wait', 2.2],
          ['say', TRAPPED],
          ['wait', 0.4],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
  complete(m, game) { m.done = true; },
};
