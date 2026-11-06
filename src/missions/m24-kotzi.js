// Chapter seven, mission 6, "הקרב האחרון". The holding block: Kotzi and his crew (the Porcupines,
// invented for the game) in the antechamber, Nehorai behind the door with the code. Paint flies;
// when half his people are out Kotzi runs into the cell and locks it. Erez gets pinned — two marks on
// him and a guard closing — and Ido saves him. The last of the crew go out, the code opens the
// door, and Kotzi, cornered, is marked like anyone else. No blood; the rules the crews play by.
import { near, say } from './missions.js';
import { COLORS } from '../combat/paint.js';
import { asErez, asNehorai, arriveTeam, armTeam, postGuards, hideGuards, left, radio, failOut, team } from './rescue.js';

const DOOR = [
  ['קוצי', '(מבפנים) ארז פור! שמעתי שאתה בא. הבאת את כולם? יפה. גם אני.'],
  ['ארז', 'קוצי. תפתח, ונגמור את זה בצבע.'],
  ['קוצי', 'בצבע! תמיד בצבע! בסדר. שפיץ, רולר, טוסטי, בולדוזר. וכל השאר. תראו להם.'],
  ['עידו', 'ארז, איתי. בלי מרחקים, בלי גיבורים.'],
];
const RUN = [['קוצי', 'חצי מהאנשים שלי בחוץ?! אני... אני בתא. עם האורח. בלי קוד לא נכנסים!'], ['אברהם', 'הוא ברח לתא עם נהוראי. זה כמו להינעל עם רמקול.']];
const PINNED = [['עידו', 'ארז! שניים עליך ואתה חשוף! תתכופף!'], ['עידו', 'סימנתי אותו. עוד אחת, ארז, ואתה בחוץ. מאחוריי.'], ['ארז', 'חייב לך.'], ['עידו', 'תשלם בגלידה.']];
const CLEARED = [['הדר', 'Bro, כולם בחוץ. רק קוצי.'], ['ארז', 'הקוד. ארבע, שבע, אחת, תשע.']];
const CELL = [
  ['קוצי', 'זה... זה לא מה שזה נראה. זה עסקים. נהוראי היה אורח!'],
  ['נהוראי', 'אורח?! נתת לי כריך אחד בשלושה ימים!'],
  ['קוצי', 'היית בדיאטה!'],
  ['ארז', 'קוצי. מסומן. בחוץ. כמו כולם.'],
  ['קוצי', '...טוב. אבל שיירשם שאני התייחסתי אליו יפה.'],
  ['דולב', 'נרשם. גם שהוא שקרן.'],
];
const NEHORAI_6 = 'ארז! אני שומע אתכם! קוצי פה איתי, הוא מתחבא מאחורי המיטה. תגידו לו שזה מביך.';

const F = (game) => game.world.places.fort;
const CREW = [['shpitz', 'hold1'], ['roller', 'hold2'], ['tosti', 'hold3'], ['bulldozer', 'hold1'], ['kg1', 'hold2'], ['kg2', 'hold3']];
const ids = (l) => l.map((g) => g[0]);

function placeKotzi(game, inCell) {
  const f = F(game), k = game.npc('kotzi');
  const at = inCell ? f.holding.cell : f.holding.kotzi;
  k.floorY = null; k.place(at.x, at.z, at.yaw); k.idle = 'arms'; k.target = null; k.model.setPose(null); k.show(true);
}
function placeNehorai(game) {
  const f = F(game), n = game.npc('nehorai');
  n.floorY = null; n.place(f.holding.nehorai.x, f.holding.nehorai.z, f.holding.nehorai.yaw); n.idle = null; n.target = null; n.model.setPose('sit'); n.show(true);
}

export default {
  id: 'kotzi', chapter: 7, number: 6, title: 'הקרב האחרון', requires: ['fort'],
  follows: true, secret: true,
  where: 'בדלת בלוק התאים, בקצה המנהרה',
  startAt: (game) => { const f = F(game); return f ? { x: f.holding.door.x, z: f.holding.door.z, y: f.y } : null; },
  reward: { money: 600, unlocks: ['kotzi-marked'], text: 'קוצי מסומן · 600 ₪' },

  setup(m, game) { m.s = {}; asErez(game); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const f = F(game); game.start(f.holding.door.x, f.holding.door.z, f.holding.door.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3]); },
  restore(m, game, checkpoint) {
    const f = F(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.keypad?.close(false);
    asErez(game); game.exitCar();
    const at = checkpoint >= 2 ? f.holding.inside : f.holding.door;
    game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
    team(game, game.player.pos, game.player.yaw);
    postGuards(game, f, CREW); armTeam(game); placeNehorai(game);
    m.s = { ...m.s, saved: false, kotziRan: checkpoint >= 2, opened: false };
    f.holding.cellDoor.lock();
    if (checkpoint >= 2) { for (const g of game.paint.guards) game.paint.markGuard(g, 'restore'); placeKotzi(game, true); } else placeKotzi(game, false);
  },
  cleanup(m, game) {
    const f = F(game);
    game.cutscene = false; game.follow.override = null; game.keypad?.close(false);
    game.paint.dispose();
    hideGuards(game, ids(CREW));
    const k = game.npc('kotzi'); k.model.setPose(null);
    f.holding.cellDoor.lock();
    if (!m.done) { k.show(false); game.npc('nehorai').model.setPose(null); game.npc('nehorai').show(false); asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: at the door
      objective: 'בלוק התאים',
      enter(m, game) {
        const f = F(game);
        game.cutscene = true;
        arriveTeam(game, f.holding.door);
        postGuards(game, f, CREW); placeKotzi(game, false); placeNehorai(game);
        f.holding.cellDoor.lock();
        game.follow.shot({ x: f.holding.door.x - 5, y: f.y + 2.6, z: f.holding.door.z + 3 }, { x: f.holding.door.x + 3, y: f.y + 1.3, z: f.holding.door.z }, 9999);
        game.hud.banner('הקרב האחרון', '02:40', 'קוצי והדרבנים · הדלת עם הקוד', 3200);
        game.dialogue.play(DOOR).then(() => { m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); armTeam(game); for (const g of game.paint.guards) { g.seen = 1; g.alerted = true; } },
    },
    { // 1: the fight; Kotzi runs; Ido saves Erez
      objective: 'הדרבנים ואנשי קוצי (0/6) · עידו לצידך', checkpoint: true,
      update(m, game) {
        const f = F(game), P = game.paint, n = left(game, ids(CREW));
        // half of them out: Kotzi runs into the cell and locks it
        if (!m.s.kotziRan && n <= 3) { m.s.kotziRan = true; const k = game.npc('kotzi'); k.walkTo(f.holding.cell.x, f.holding.cell.z, { run: true, near: 0.8, onArrive: () => { k.lookAt(f.holding.cellDoor.pos.x, f.holding.cellDoor.pos.z); } }); game.dialogue.play(RUN); }
        // pinned: two marks on Erez and a guard still up — Ido takes the nearest one and buys him a breath
        if (!m.s.saved && P.hits >= 2 && n > 0) {
          m.s.saved = true;
          const me = game.player.pos, ido = game.npc('ido');
          let best = null, bd = Infinity;
          for (const g of P.guards) if (!g.marked) { const d = Math.hypot(g.npc.pos.x - me.x, g.npc.pos.z - me.z); if (d < bd) { bd = d; best = g; } }
          ido.place(me.x - Math.sin(game.player.yaw) * 1.2 + 0.6, me.z - Math.cos(game.player.yaw) * 1.2, game.player.yaw);
          if (best) { ido.lookAt(best.npc.pos.x, best.npc.pos.z); P.markGuard(best, 'ido'); }
          P.hits = 1; game.hud.paintClear(); game.hud.paintHit(COLORS.guard, 1);
          game.hud.banner('עידו', 'הציל אותך', 'סימון אחד נמחק · להישאר מאחוריו', 2600);
          game.sound?.chime?.(true);
          game.dialogue.play(PINNED);
        }
        say(m, game, n ? `הדרבנים ואנשי קוצי: לסמן את כולם (${6 - n}/6) · סומנת ${P.hits}/3` : 'כולם בחוץ · הדלת עם הקוד');
        if (!n && !m.s.clearSaid) { m.s.clearSaid = true; game.dialogue.play(CLEARED).then(() => radio(game, NEHORAI_6)); }
        return n === 0 && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 2: the code
      objective: 'הדלת לתא: להקיש את הקוד מהפתק', checkpoint: true,
      enter(m, game) { game.paint.disarmPlayer(); },
      target: (m, game) => { const f = F(game); return m.s.opened ? null : { ...f.holding.keypadAt, y: f.y, r: 1.5 }; },
      interaction(m, game) { const f = F(game); if (game.mode === 'foot' && !m.s.opened && near(game.player.pos, f.holding.keypadAt, 2.0)) return { label: 'להקיש את הקוד', priority: 5, run: () => { game.keypad.open(f.code, 'הקוד מהפתק בחדר הבקרה').then((ok) => { if (ok) { m.s.opened = true; f.holding.cellDoor.unlock(); f.holding.cellDoor.setOpen(true); game.hud.toast('הדלת נפתחה', 1400); } }); } }; return null; },
      update(m, game) { say(m, game, m.s.opened ? 'הדלת פתוחה · קוצי בפנים' : 'להקיש את הקוד מהפתק על לוח המקשים'); return m.s.opened ? 'next' : null; },
    },
    { // 3: Kotzi, cornered
      objective: 'קוצי בתא · לסמן אותו', checkpoint: true,
      enter(m, game) {
        const f = F(game), P = game.paint, k = game.npc('kotzi');
        armTeam(game);
        if (!P.guards.some((g) => g.npc === k)) { k.idle = null; P.addGuard(k, [{ x: f.holding.cell.x, z: f.holding.cell.z }], '#e9d27a', { quick: false, still: true }); }
        const g = P.guards.find((x) => x.npc === k); if (g) { g.seen = 1; g.alerted = true; }
      },
      target: (m, game) => { const f = F(game); return { ...f.holding.cellDoor.pos, y: f.y, r: 1.6 }; },
      update(m, game) {
        const P = game.paint, k = game.npc('kotzi'), g = P.guards.find((x) => x.npc === k);
        if (g?.marked && !m.s.kotziOut) { m.s.kotziOut = true; game.dialogue.play(CELL).then(() => { m.s.done = true; }); }
        say(m, game, m.s.kotziOut ? 'קוצי מסומן' : `להיכנס לתא ולסמן את קוצי · סומנת ${P.hits}/3`);
        return m.s.done ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
