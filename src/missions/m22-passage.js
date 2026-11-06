// Chapter seven, mission 4, "המלכודות של קוצי". From the tool shed at the end of the road, the covered
// passage to the fort — and everything Kotzi put in it: a floor of pressure plates (only the left
// column is safe; Ido saw the marks), a door that shuts behind Erez and cuts him off from the team
// (Ido finds the side way), a room where a shutter comes down on a thirty-second clock, three
// switches in an order written on the wall, and two valves that must be turned together. Ido is the
// one who reads the traps; the team is the one that gets through them. Invented; nothing real.
import { near, say } from './missions.js';
import { asErez, asNehorai, arriveTeam, armTeam, postGuards, hideGuards, left, radio, failOut, team, TEAM } from './rescue.js';

const SHED = [
  ['עידו', 'מחסן כלים. ובתוכו — פתח. המנהלה של קוצי: "המנהרה".'],
  ['ארז', 'אם קוצי בנה את זה, יש שם הפתעות.'],
  ['עידו', 'אני הולך ראשון עם העיניים. אתם הולכים איפה שאני אומר.'],
  ['דולב', 'אני הולך אחרון. סטטיסטית זה הכי בטוח.'],
];
const PLATES = [['עידו', 'עצור! רצפה. לוחות לחץ, שלושה טורים. יש סימון קטן — רק הטור השמאלי לא מחובר.'], ['ארז', 'שמאל. כולם בשורה אחריי.'], ['יונתי', 'אני נראה טוב בשורה.']];
const TRIP = [['שומר', 'אזעקה! מישהו במנהרה!'], ['עידו', 'ימין היה טעות! שומרים מאחור!']];
const LOCKED = [['עידו', 'ארז! הדלת נסגרה מאחוריך! אתה לבד שם!'], ['ארז', 'אני בסדר. תמצאו דרך.'], ['עידו', 'יש דלת צדדית. נעולה. תן לי חצי דקה.']];
const SIDE_OPEN = [['עידו', 'פתוח! כולם דרך החדר הצדדי. ארז, אנחנו באים.'], ['אברהם', 'דלת צדדית. סוף סוף משהו בגובה שלי.']];
const CLOCK = [['עידו', 'שעון. התריס בקצה יורד בעוד שלושים שניות. רוצו!'], ['הדר', 'Bro, זה כמו הרכבת התחתית בשמונה בבוקר!']];
const CLOCK_DONE = [['ליאם', 'כולם עברו? אחים, כולם עברו!'], ['דולב', 'אני עברתי. אני לא יודע איך.']];
const SWITCHES = [['עידו', 'שלושה כפתורים. ועל הקיר ממול: "ירוק · כחול · אדום". קוצי כותב את התשובות על הקיר.'], ['מולר', 'טיפש.']];
const WRONG = [['עידו', 'לא! זה התאפס. ירוק, כחול, אדום. לפי הקיר.']];
const VALVES = [['עידו', 'שני שסתומים, שני קצוות. "לסובב יחד". יונתי, לשסתום הרחוק.'], ['יונתי', 'אני תמיד הרחוק. בסדר. אבל שידעו.'], ['ארז', 'כשאתה שם, אני סופר. שלוש, שתיים—']];
const OUT = [['עידו', 'הדלת נפתחת. זה... החצר של המצודה. הגענו.'], ['ארז', 'מכאן זה כבר הבית של קוצי. אף אחד לא נשאר מאחור.']];
const NEHORAI_3 = 'ארז, אם זה אתה: שומעים אותכם מהמנהרה. קוצי שלח את כולם לחצר. תיזהרו מהמגדלים.';

const P = (game) => game.world.places.passage;
const BACK = [['kg1', 'back'], ['kg2', 'back']];
const ORDER = [1, 2, 0]; // green, blue, red

function clockPill(game, left) { game.hud.setPursuit(left == null ? null : `התריס יורד · ${Math.max(0, Math.ceil(left))}`); }

export default {
  id: 'passage', chapter: 7, number: 4, title: 'המלכודות של קוצי', requires: ['depot'],
  follows: true,
  where: 'במחסן הכלים בסוף דרך המחצבה',
  startAt: (game) => { const p = P(game); return p ? { x: p.shed.door.x, z: p.shed.door.z, y: p.y } : null; },
  reward: { money: 400, unlocks: ['fort-yard'], text: 'בתוך המצודה · 400 ₪' },

  setup(m, game) { m.s = { trips: 0, pressed: [] }; asErez(game); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const p = P(game); game.car.place(p.parking.x, p.parking.z, p.parking.yaw); game.start(p.shed.door.x, p.shed.door.z, p.shed.door.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) {
    if (m.s.trips >= 3) return 'שלוש אזעקות. עידו: "קוצי כבר יודע שאנחנו פה. מההתחלה, ורק הטור השמאלי."';
    if (m.s.clockOut) return 'התריס ירד. עידו: "שלושים שניות. בלי לעצור ליד הארגזים."';
    return failOut(m, game, [1, 2, 3, 4, 5]);
  },
  restore(m, game, checkpoint) {
    const p = P(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; clockPill(game, null);
    asErez(game); game.exitCar();
    const at = checkpoint >= 3 ? p.clock.start : checkpoint === 2 ? p.beforeDoor : p.platesStart;
    game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
    team(game, game.player.pos, game.player.yaw); armTeam(game);
    m.s = { ...m.s, trips: 0, clockOut: false, clockAt: null, pressed: [], locked: false, sideOpen: false, cut: false };
    for (const pl of p.plates) pl.reset();
    p.trapDoor.unlock(); p.trapDoor.setOpen(checkpoint < 2); p.sideIn.lock(); p.clock.shutter.setOpen(true); p.puzzleDoor.lock(); p.exitDoor.lock();
    hideGuards(game, BACK.map((g) => g[0]));
  },
  cleanup(m, game) {
    const p = P(game);
    game.cutscene = false; game.follow.override = null; clockPill(game, null);
    game.paint.dispose();
    hideGuards(game, BACK.map((g) => g[0]));
    for (const pl of p.plates) pl.reset();
    p.trapDoor.unlock(); p.trapDoor.setOpen(true); p.sideIn.lock(); p.clock.shutter.setOpen(true); p.puzzleDoor.lock(); p.exitDoor.lock();
    if (!m.done) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: the shed
      objective: 'מחסן הכלים',
      enter(m, game) {
        const p = P(game);
        game.cutscene = true;
        arriveTeam(game, p.shed.door);
        p.trapDoor.setOpen(true); p.clock.shutter.setOpen(true);
        game.follow.shot({ x: p.shed.door.x + 5, y: p.y + 3, z: p.shed.door.z + 5 }, { x: p.shed.door.x, y: p.y + 1.3, z: p.shed.door.z - 2 }, 9999);
        game.hud.banner('המנהרה', '01:20', 'עידו הולך ראשון עם העיניים', 3000);
        game.dialogue.play(SHED).then(() => { m.s.in = true; });
      },
      update: (m) => (m.s.in ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); armTeam(game); },
    },
    { // 1: the plates
      objective: 'הרצפה: רק הטור השמאלי · לעבור את לוחות הלחץ', checkpoint: true,
      enter(m, game) { if (!m.s.platesSaid) { m.s.platesSaid = true; game.dialogue.play(PLATES); } },
      target: (m, game) => ({ ...P(game).platesEnd, y: P(game).y, r: 1.5 }),
      update(m, game) {
        const p = P(game), me = game.player.pos;
        for (const pl of p.plates) {
          if (pl.c !== 0 && pl.armed && pl.inside(me.x, me.z)) {
            pl.trip(); m.s.trips++;
            game.alert.raise(35); game.hud.toast(`אזעקה! (${m.s.trips}/3)`, 1600); game.sound?.hit?.('crash', 0.5);
            if (!m.s.backPosted) { m.s.backPosted = true; p.patrols = { back: [p.platesStart, p.shed.door] }; postGuards(game, p, BACK); for (const g of game.paint.guards) { g.seen = 1; g.alerted = true; } game.dialogue.play(TRIP); }
          }
        }
        const guards = left(game, BACK.map((g) => g[0]));
        say(m, game, guards ? `שומרים מאחור! לסמן אותם (${2 - guards}/2) · רק הטור השמאלי` : `לעבור את לוחות הלחץ · רק הטור השמאלי · אזעקות ${m.s.trips}/3`);
        return guards === 0 && near(me, p.platesEnd, 1.6) ? 'next' : null;
      },
    },
    { // 2: the door that shuts behind Erez
      objective: 'הדלת נסגרה מאחוריך · עידו מחפש את הדרך הצדדית', checkpoint: true,
      update(m, game) {
        const p = P(game), me = game.player.pos, local = p.toWorld ? null : null;
        const zLocal = me.z - p.z;
        if (!m.s.locked && zLocal > 25.5) {
          m.s.locked = true;
          p.trapDoor.lock(); game.sound?.hit?.('crash', 0.7); game.hud.toast('הדלת ננעלה מאחוריך!', 1800);
          // the team is cut off: Ido goes for the side door
          game.dialogue.play(LOCKED);
          for (const id of TEAM) { const n = game.npc(id); if (n.pos.z - p.z > 24.5) continue; game.squad.send(id, id === 'ido' ? p.sideAt : { x: p.beforeDoor.x + (Math.random() - 0.5) * 3, z: p.beforeDoor.z - 2 - Math.random() * 3 }, { label: id === 'ido' ? 'פורץ' : 'מחכה', onArrive: id === 'ido' ? () => { m.s.picking = m.t; } : null }); }
        }
        if (m.s.locked && m.s.picking != null && !m.s.sideOpen && m.t - m.s.picking > 4) {
          m.s.sideOpen = true;
          p.sideIn.unlock(); p.sideIn.setOpen(true); p.sideOut.setOpen(true); game.sound?.chime?.(true);
          game.dialogue.play(SIDE_OPEN);
          // through the side room, one after the other, then back to the wedge
          TEAM.forEach((id, i) => {
            const n = game.npc(id);
            const hop = (spots, k) => { if (k >= spots.length) { game.squad.release(id); return; } n.walkTo(spots[k].x, spots[k].z, { run: true, near: 0.7, onArrive: () => hop(spots, k + 1) }); };
            setTimeout(() => { if (n.pos.z - p.z < 24.5) hop([p.sideInAt, p.sideRoom, p.sideOutAt, { x: p.afterDoor.x + (i % 3 - 1) * 1.2, z: p.afterDoor.z + i * 0.6 }], 0); else game.squad.release(id); }, i * 450);
          });
        }
        say(m, game, !m.s.locked ? 'להמשיך דרומה, דרך הדלת הפתוחה' : !m.s.sideOpen ? 'הדלת ננעלה מאחוריך · עידו פורץ את הדלת הצדדית · לחכות' : 'הצוות עובר דרך החדר הצדדי · להמשיך לחדר הבא');
        const through = TEAM.filter((id) => game.npc(id).pos.z - p.z > 24.5).length;
        return m.s.sideOpen && through >= 5 ? 'next' : null;
      },
    },
    { // 3: the clock room
      objective: 'חדר השעון: לעבור לפני שהתריס יורד', checkpoint: true,
      enter(m, game) { m.s.clockAt = null; },
      target: (m, game) => ({ ...P(game).clock.end, y: P(game).y, r: 1.5 }),
      update(m, game) {
        const p = P(game), me = game.player.pos, zLocal = me.z - p.z;
        if (m.s.clockAt == null && zLocal > 32) { m.s.clockAt = m.t; game.dialogue.play(CLOCK); }
        if (m.s.clockAt != null) {
          const leftS = 30 - (m.t - m.s.clockAt);
          clockPill(game, leftS);
          if (leftS <= 0) { p.clock.shutter.setOpen(false); m.s.clockOut = true; }
          if (zLocal > 43.0) { clockPill(game, null); p.clock.shutter.setOpen(false); game.sound?.hit?.('crash', 0.6); game.dialogue.play(CLOCK_DONE); return 'next'; }
        }
        say(m, game, m.s.clockAt == null ? 'להיכנס לחדר השעון' : 'לרוץ לקצה החדר לפני שהתריס יורד!');
        return null;
      },
      exit(m, game) { clockPill(game, null); },
    },
    { // 4: the switches
      objective: 'שלושת הכפתורים · לפי הסדר שעל הקיר', checkpoint: true,
      enter(m, game) { if (!m.s.swSaid) { m.s.swSaid = true; game.dialogue.play(SWITCHES); } },
      target: (m, game) => { const p = P(game); const k = m.s.pressed.length; return k < 3 ? { ...p.panels[ORDER[k]], r: 1.4 } : { ...p.afterPuzzle, y: p.y, r: 1.5 }; },
      interaction(m, game) {
        const p = P(game); if (game.mode !== 'foot' || m.s.solved) return null;
        for (const pan of p.panels) if (near(game.player.pos, pan, 2.0)) return { label: `ללחוץ על הכפתור ה${pan.color}`, priority: 5, run: () => {
          const k = m.s.pressed.length;
          if (pan.i === ORDER[k]) { m.s.pressed.push(pan.i); game.sound?.chime?.(true); if (m.s.pressed.length === 3) { m.s.solved = true; p.puzzleDoor.unlock(); p.puzzleDoor.setOpen(true); game.hud.toast('הדלת נפתחה', 1400); } }
          else { m.s.pressed = []; game.alert.raise(15); game.sound?.hit?.('block', 0.6); game.dialogue.play(WRONG); }
        } };
        return null;
      },
      update(m, game) { const p = P(game); say(m, game, m.s.solved ? 'הדלת פתוחה · להמשיך מזרחה' : `הכפתורים לפי הקיר: ירוק, כחול, אדום (${m.s.pressed.length}/3)`); return m.s.solved && game.player.pos.x - p.x > 25 ? 'next' : null; },
    },
    { // 5: the valves, together
      objective: 'שני השסתומים · לסובב יחד עם יונתי', checkpoint: true,
      enter(m, game) {
        const p = P(game);
        game.dialogue.play(VALVES);
        game.squad.send('yonati', { x: p.valves[1].x, z: p.valves[1].z - 1.0, yaw: 0 }, { label: 'שסתום', onArrive: () => { m.s.yonatiThere = true; game.hud.toast('יונתי ליד השסתום הרחוק', 1400); } });
      },
      target: (m, game) => { const p = P(game); return m.s.turned ? { ...p.out, y: p.y, r: 2 } : { ...p.valves[0], r: 1.4 }; },
      interaction(m, game) {
        const p = P(game); if (game.mode !== 'foot' || m.s.turned) return null;
        if (near(game.player.pos, p.valves[0], 2.2)) return { label: m.s.yonatiThere ? 'לסובב יחד: שלוש, שתיים, אחת' : 'לחכות שיונתי יגיע לשסתום', priority: 5, run: () => { if (!m.s.yonatiThere) return; m.s.turned = true; p.exitDoor.unlock(); p.exitDoor.setOpen(true); game.squad.release('yonati'); game.sound?.chime?.(true); game.dialogue.play(OUT).then(() => radio(game, NEHORAI_3)); } };
        return null;
      },
      update(m, game) { const p = P(game); say(m, game, m.s.turned ? 'לצאת מהמנהרה אל חצר המצודה' : m.s.yonatiThere ? 'לסובב את השסתום הקרוב יחד עם יונתי' : 'ליד השסתום הקרוב · יונתי בדרך לרחוק'); return m.s.turned && game.player.pos.x - p.x > 47 && !game.dialogue.busy ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
