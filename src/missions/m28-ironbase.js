// Chapter eight, mission 3, "בסיס הברזל". Nehorai leads the gang into Kotzi's new base: Ido at the gate,
// the yard under two towers, the ground floor, the main stairs; then Kotzi's emergency system: a siren,
// the shutters coming down one after another, and ninety seconds to reach the control room on the top
// floor before its door locks. The team takes orders (אחריי / תישארו כאן / תחפו עליי / תתקדמו) and
// shoots paint with him. Whoever is marked three times is out. Invented throughout.
import { near, say, nearestGuard } from './missions.js';
import { TEAM, crew, armCrew, endCrew, failOut, arriveCrew, clock, Blast, Job, postGuards, hideGuards, left } from './firestorm.js';

const B = (game) => game.world.places.ironBase;
const YARD = [['guard1', 't1'], ['guard2', 't2'], ['guard3', 'yardW'], ['guard4', 'yardE'], ['vg1', 'yardN'], ['vg2', 'yardS'], ['vg3', 'gateIn'], ['vg4', 'yardMid']];
const GROUND = [['vg5', 'lobby1'], ['vg6', 'lobby2'], ['vg7', 'corr1'], ['vg8', 'corr2']];
const UPSTAIRS = [['vg9', 'f1walk'], ['kg1', 'f1office'], ['kg2', 'f1east'], ['kg3', 'f2hall'], ['kg4', 'f2south']];
const ALL = [...YARD, ...GROUND, ...UPSTAIRS];
const ids = (list) => list.map((g) => g[0]);
const LOCK = 90, SHUT = [6, 45, 90];

const GATE = [['עידו', 'בסיס הברזל. שלוש קומות, שני מגדלים, חצר מלאה.'], ['ארז', 'וקוצי?'], ['עידו', 'חדר הבקרה בקומה העליונה. משם הוא מנהל הכול.'], ['נהוראי', 'אני מוביל. אחריי.'], ['ליאם', 'אחים, זה הרגע.']];
const GATE_JOB = [['עידו', 'השער שלי. תחפו עליי.']];
const YARD_CLEAR = [['ארז', 'החצר נקייה. הבניין.'], ['דולב', 'מישהו ראה את הנעליים שלי? עזבו.']];
const GROUND_CLEAR = [['עידו', 'קומת הקרקע נקייה. המדרגות המזרחיות למעלה.']];
const ALARM = [['קול ברמקול', 'נעילת חירום. כל השערים נסגרים.'], ['עידו', 'הוא נועל את הבניין! נהוראי, לחדר הבקרה, למעלה, לפני שהדלת נסגרת!']];
const IN_CONTROL = [['ארז', 'בפנים! הספקנו.'], ['נהוראי', 'עכשיו נראה מה קוצי מסתיר פה.']];
const HINT = 'פקודות לצוות: הכפתור "פקודה" · אחריי, תישארו כאן, תחפו עליי, תתקדמו';

function inBuilding(game) { const b = B(game), p = game.player.pos; return b.insideBuilding(p.x, p.z); }
const floorOf = (game) => { const b = B(game), dy = game.player.pos.y - b.y; return dy > b.F2 - 0.8 ? 2 : dy > b.F1 - 0.8 ? 1 : 0; };
// past each shutter: the ground corridor, the first floor's stairwell, the control room
function past(game, k) {
  const b = B(game), p = game.player.pos, lx = p.x - b.x, lz = p.z - b.z, f = floorOf(game);
  if (k === 0) return f > 0 || (inBuilding(game) && lx > -4);
  if (k === 1) return f === 2 || (f === 1 && lx < -17.4 && lz < -4 && lz > -14) || (p.y - b.y > b.F1 + 0.6 && lx < -17.4);
  return b.inControl(p.x, p.z, p.y);
}
// the friends cut off behind a shutter come round to him (they find their own way)
function regroup(game) { const sq = game.squad, me = game.player.pos; sq.ids.forEach((id, i) => { if (sq.tasks.has(id)) return; const n = game.npc(id); if (Math.abs(n.pos.y - me.y) > 1.5 || Math.hypot(n.pos.x - me.x, n.pos.z - me.z) > 10) { const s = sq.slot(i, me, game.player.yaw); n.target = null; n.place(me.x - Math.sin(game.player.yaw) * (1.2 + (i % 3) * 0.6), me.z - Math.cos(game.player.yaw) * (1.2 + (i % 3) * 0.6), game.player.yaw, me.y); void s; } }); }
function openAll(b) { for (const d of b.shutters) { d.unlock(); d.setOpen(true); } }

export default {
  id: 'ironbase', chapter: 8, number: 3, title: 'בסיס הברזל', requires: ['ironroad'],
  follows: true,
  where: 'בקצה הדרך הישנה, מול בסיס הברזל',
  startAt: (game) => { const b = B(game); return b ? { x: b.approach.x, z: b.approach.z, y: b.y } : null; },
  reward: { money: 800, unlocks: ['ironbase'], text: 'בתוך חדר הבקרה · 800 ₪' },

  setup(m, game) { m.s = {}; m.live = []; game.daylight?.set(0.55, 0); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const b = B(game); game.start(b.approach.x, b.approach.z, b.approach.yaw); game.daylight?.set(0.55, 0); },
  failIf(m, game) {
    if (m.stepIndex === 3 && m.s.lockAt != null) {
      const t = m.t - m.s.lockAt;
      for (let k = 0; k < 3; k++) if (t >= SHUT[k] && !m.s.shut[k] && !past(game, k)) return k === 2 ? 'דלת חדר הבקרה ננעלה. ארז: "מההתחלה. והפעם רצים."' : 'התריס נסגר לפניך. עידו: "מההתחלה, ומהר יותר."';
    }
    return failOut(m, game, [1, 2, 3]);
  },
  restore(m, game, checkpoint) {
    const b = B(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    m.job?.cancel(); m.job = null; for (const x of m.live || []) x.cancel(); m.live = []; game.fx.clear();
    m.stopSiren?.(); m.stopSiren = null; clock(game, null);
    if (game.mode === 'car') game.exitCar();
    openAll(b);
    const at = checkpoint >= 3 ? b.main.corridor : checkpoint === 2 ? b.gateInside : b.gateOutside;
    game.player.place(at.x, at.z, at.yaw, at.y); game.follow.snapBehind(at.yaw);
    crew(game, game.player.pos, at.yaw);
    postGuards(game, b, ALL); armCrew(game); game.paint.reset();
    const done = checkpoint >= 2 ? [...YARD] : [];
    if (checkpoint >= 3) done.push(...GROUND);
    for (const g of game.paint.guards) if (done.some(([id]) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore');
    if (checkpoint >= 2) { b.gate.unlock(); b.gate.setOpen(true); } else b.gate.lock();
    m.s = { ...m.s, gateOpen: checkpoint >= 2, lockAt: null, shut: [false, false, false], yardSaid: checkpoint >= 2, groundSaid: checkpoint >= 3, inControl: false };
  },
  cleanup(m, game) {
    const b = B(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); clock(game, null);
    m.job?.cancel(); m.job = null; for (const x of m.live || []) x.cancel(); m.live = [];
    m.stopSiren?.(); m.stopSiren = null;
    game.paint.dispose(); hideGuards(game, ids(ALL));
    openAll(b);
    if (!m.done) { b.gate.lock(); endCrew(game); }
  },

  steps: [
    { // 0: at the gate
      objective: 'בסיס הברזל',
      enter(m, game) {
        const b = B(game);
        game.cutscene = true; game.hud.setCinematic(true);
        arriveCrew(game, b.gateOutside);
        postGuards(game, b, ALL);
        game.follow.shot({ x: b.gateOutside.x + 9, y: b.y + 4.5, z: b.gateOutside.z + 12 }, { x: b.x, y: b.y + 4, z: b.z }, 9999);
        game.hud.banner('בסיס הברזל', '05:40', 'שלוש קומות · שני מגדלים · חדר הבקרה למעלה', 3200);
        game.dialogue.play(GATE).then(() => { m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); armCrew(game); game.hud.toast(HINT, 4200); },
    },
    { // 1: the gate and the yard
      objective: 'השער · עידו פותח · ואז החצר', checkpoint: true,
      enter(m, game) {
        const b = B(game);
        m.s.shut = [false, false, false];
        if (!m.s.gateOpen) {
          game.dialogue.play(GATE_JOB);
          m.job = new Job(game, { who: 'ido', at: { x: b.gateOutside.x + 1.8, z: b.gateOutside.z - 2.2, yaw: Math.PI }, seconds: 4, near: 14, pill: 'עידו פותח את השער', onDone: () => { b.gate.unlock(); b.gate.setOpen(true); m.s.gateOpen = true; game.hud.toast('השער פתוח', 1400); } });
        }
        m.s.boomT = m.t + 10;
      },
      target(m, game) { const b = B(game); return !m.s.gateOpen ? { ...b.gateOutside, r: 3 } : nearestGuard(game, ids(YARD)) || { ...b.main.door, r: 2 }; },
      update(m, game, dt) {
        const b = B(game);
        m.job?.update(dt);
        // the yard in a fight: a drum goes up now and then (a warning first, away from him)
        if (m.s.gateOpen && m.t > m.s.boomT) { m.s.boomT = m.t + 12 + Math.random() * 6; const me = game.player.pos, a = Math.random() * Math.PI * 2; m.live.push(new Blast(game, { at: { x: me.x + Math.cos(a) * 14, y: b.y, z: me.z + Math.sin(a) * 14 }, size: 1.4, warn: 1.6, radius: 3, fire: 15 })); }
        for (const x of m.live) x.update(dt);
        const n = left(game, ids(YARD));
        say(m, game, !m.s.gateOpen ? 'השער · עידו פותח · לחפות עליו' : n ? `החצר: לסמן את השומרים והמגדלים (${YARD.length - n}/${YARD.length}) · סומנת ${game.paint.hits}/3` : 'החצר נקייה · לדלת הבניין');
        if (!n && !m.s.yardSaid) { m.s.yardSaid = true; game.dialogue.play(YARD_CLEAR); }
        return m.s.gateOpen && !n && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 2: the ground floor
      objective: 'קומת הקרקע', checkpoint: true,
      target(m, game) { const b = B(game); return inBuilding(game) ? (nearestGuard(game, ids(GROUND)) || { ...b.main.s1.bottom, y: b.y, r: 1.6 }) : { ...b.main.door, r: 2 }; },
      update(m, game, dt) {
        for (const x of m.live) x.update(dt);
        const n = left(game, ids(GROUND));
        say(m, game, n ? `קומת הקרקע: לסמן את השומרים (${GROUND.length - n}/${GROUND.length}) · סומנת ${game.paint.hits}/3` : 'נקי · המדרגות המזרחיות לקומה הראשונה');
        if (!n && !m.s.groundSaid) { m.s.groundSaid = true; game.dialogue.play(GROUND_CLEAR); }
        return !n ? 'next' : null;
      },
    },
    { // 3: up the stairs; the lockdown and the clock to the control room
      objective: 'לקומה הראשונה במדרגות המזרחיות', checkpoint: true,
      target(m, game) {
        const b = B(game), f = floorOf(game);
        if (m.s.lockAt == null) return { ...b.main.s1.top, r: 1.6 };
        if (f === 0) return { ...b.main.s1.bottom, y: b.y, r: 1.6 };
        if (f === 1) return past(game, 1) ? { ...b.main.s2.bottom, y: b.y + b.F1, r: 1.4 } : { ...b.shutterAt[1], r: 1.6 };
        return { ...b.control.inside, r: 2 };
      },
      update(m, game, dt) {
        const b = B(game), f = floorOf(game);
        for (const x of m.live) x.update(dt);
        if (m.s.lockAt == null && f >= 1 && inBuilding(game)) {
          m.s.lockAt = m.t;
          m.stopSiren = game.sound?.siren?.(LOCK + 4) || null;
          game.hud.banner('נעילה!', 'השערים נסגרים', 'שעון של דקה וחצי לחדר הבקרה', 2600);
          game.dialogue.play(ALARM);
          game.follow.shake(0.4);
        }
        if (m.s.lockAt != null && !m.s.inControl) {
          const t = m.t - m.s.lockAt, rest = LOCK - t;
          clock(game, rest, 'נעילה');
          for (let k = 0; k < 2; k++) if (t >= SHUT[k] && !m.s.shut[k] && past(game, k)) { m.s.shut[k] = true; b.shutters[k].lock(); game.sound?.hit?.('crash', 0.6); game.hud.toast(`תריס ${k + 1} ירד`, 1600); regroup(game); }
          say(m, game, f < 2 ? `נעילה! לחדר הבקרה בקומה העליונה · ${Math.ceil(rest)} שניות · ${f === 1 && !past(game, 1) ? 'חדר המדרגות המערבי' : 'למעלה'}` : `חדר הבקרה · הדלת בצד המערבי · ${Math.ceil(rest)} שניות`);
          if (b.inControl(game.player.pos.x, game.player.pos.z, game.player.pos.y)) {
            m.s.inControl = true;
            clock(game, null); m.stopSiren?.(); m.stopSiren = null;
            regroup(game);
            game.dialogue.play(IN_CONTROL).then(() => { m.s.inSaid = true; });
          }
        } else if (m.s.lockAt == null) say(m, game, `לקומה הראשונה במדרגות המזרחיות · שומרים למעלה (${UPSTAIRS.length - left(game, ids(UPSTAIRS))}/${UPSTAIRS.length})`);
        return m.s.inControl && m.s.inSaid ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
