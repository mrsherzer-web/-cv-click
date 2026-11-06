// Chapter seven, mission 7, "החילוץ". The cell door is open. Nehorai sees Erez and all of them —
// "I knew you wouldn't leave me here!" — Ido reaches him first and gives him a hand; the team is
// whole again. Then Kotzi's alarm: the whole compound wakes, a clock runs, and everyone has to get
// out through the north gate (Ido opens it) to the cars before the time is up, with Kotzi's cars on
// the road behind them, to the lookout above Katzir. Nehorai thanks Erez and Ido; Erez says the
// words; the screen goes dark: MISSION COMPLETE. And a message from a number nobody knows.
import { near, say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { asErez, asNehorai, armTeam, postGuards, hideGuards, left, failOut, team, TEAM, Job } from './rescue.js';

const CELL = [
  ['נהוראי', 'ידעתי שלא תשאירו אותי פה!'],
  ['עידו', 'בוא. יד.'],
  ['נהוראי', 'עידו. ארז. כולם?!'],
  ['יונתי', 'כולם. ואני הגעתי ראשון, שיידעו.'],
  ['אברהם', 'שלושה ימים בלי שאתה מקשיב לי. סבלתי יותר ממך.'],
  ['דולב', 'חטפו אותי פעם, אתה יודע. יש לי טיפים.'],
  ['הדר', 'Bro. מחבק. אחר כך.'],
  ['מולר', 'נהוראי.'],
  ['ליאם', 'אחים יקרים, כולנו פה. עכשיו הביתה.'],
  ['ארז', 'אמרתי לך. לא משאירים אף אחד מאחור. ועכשיו — החוצה, לפני ש—'],
];
const ALARM = [['קוצי', '(מהרצפה) לחצן. יש לי לחצן. ...אזעקה.'], ['עידו', 'כל המתחם מתעורר! שתי דקות לשער הצפוני, ואז לרכבים!'], ['נהוראי', 'אני רץ. שלושה ימים חיכיתי לרוץ.']];
const GATE = [['עידו', 'השער נעול. אני עליו. חפו!'], ['ארז', 'מולר, ליאם: מימין. יונתי, הדר: משמאל. דולב, אברהם: על נהוראי.']];
const GATE_OPEN = [['עידו', 'פתוח! לרכבים! בסוף הדרך!']];
const RUN = {
  start: [['נהוראי', 'הרנו! ארז, אתה נוהג ברנו שלי?!'], ['ארז', 'שאלתי. בלב. סע!']],
  arrive: [[['עידו', 'הוואנים של קוצי מאחור. שניים.']], [['דולב', 'שלושה! הוא לא אוהב להפסיד.']], [['הדר', 'Bro, four cars! זה כבר מצעד!']]],
  close: [['נהוראי', 'הם צמודים! ארז, שמאלה, אני מכיר את הדרך!'], ['עידו', 'תחתוך פנימה, הם לא יספיקו!']],
  hit: [['נהוראי', 'הרנו שלי!'], ['ארז', 'סליחה. כן. סע.']],
  lost: [['עידו', 'איבדנו אותם. לתצפית. הביתה.']],
};
const END = [
  ['נהוראי', 'ארז. עידו. כולם. תודה. באמת. לא ידעתי אם—'],
  ['עידו', 'ידעת. אמרת את זה בעצמך בדלת.'],
  ['נהוראי', 'אמרתי כי האמנתי. ארז?'],
  ['ארז', 'אצלנו לא משאירים חברים מאחור.'],
  ['אברהם', 'ועכשיו, כמה מילים. שלוש שעות.'],
  ['כולם', 'אברהם!'],
];
const TEASER = 'הודעה ממספר לא מוכר: ״קוצי היה רק ההתחלה. נתראה, נהוראי.״';

const F = (game) => game.world.places.fort;
// the way out runs back through the main building: the doors Ido opened in the fort stay open
const halls = (f) => { for (const d of [f.main.westDoor, f.main.eastDoor]) { d.unlock(); d.setOpen(true); } };
const WAKE = [['guard1', 'yardN'], ['guard2', 'gate'], ['guard3', 'yardW'], ['guard4', 'yardE'], ['vg1', 'hallC'], ['vg2', 'tunnel']];
const ids = (l) => l.map((g) => g[0]);
const LIMIT = 120;
function clock(game, left) { game.hud.setPursuit(left == null ? null : `אזעקה · ${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, Math.ceil(left)) % 60).padStart(2, '0')}`); }

export default {
  id: 'rescue', chapter: 7, number: 7, title: 'החילוץ', requires: ['kotzi'],
  follows: true, secret: true,
  where: 'בתא, ליד נהוראי',
  startAt: (game) => { const f = F(game); return f ? { x: f.holding.keypadAt.x, z: f.holding.keypadAt.z, y: f.y } : null; },
  reward: { money: 1500, unlocks: ['chapter-7'], text: 'סוף הפרק השביעי · נהוראי בבית · 1,500 ₪' },

  setup(m, game) { m.s = {}; asErez(game); halls(F(game)); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const f = F(game); halls(f); f.holding.cellDoor.unlock(); f.holding.cellDoor.setOpen(true); game.start(f.holding.keypadAt.x, f.holding.keypadAt.z, f.holding.keypadAt.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) {
    if (m.s.timeOut) return 'הזמן נגמר: המתחם נסגר. עידו: "מהתא לשער, ישר, בלי לעצור לסמן את כולם."';
    if (m.stepIndex === 2 && game.car.disabled) return 'הרנו נפגעה יותר מדי. נהוראי: "הרנו שלי... מההתחלה."';
    return failOut(m, game, [1]);
  },
  restore(m, game, checkpoint) {
    const f = F(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; clock(game, null);
    m.pursuit?.dispose(); m.pursuit = null; m.job?.cancel(); m.job = null;
    asErez(game); game.exitCar();
    m.s = { ...m.s, timeOut: false, alarmAt: null, gateOpen: false, gateSent: false };
    f.gate.lock(); f.holding.cellDoor.unlock(); f.holding.cellDoor.setOpen(true); halls(f);
    const n = game.npc('nehorai'); n.model.setPose(null); n.idle = null;
    if (checkpoint === 1) { game.player.place(f.holding.inside.x, f.holding.inside.z, f.holding.inside.yaw); game.follow.snapBehind(f.holding.inside.yaw); game.squad.form([...TEAM, 'nehorai'], { near: game.player.pos, yaw: game.player.yaw }); postGuards(game, f, WAKE); armTeam(game); for (const g of game.paint.guards) { g.seen = 1; g.alerted = true; } m.s.alarmAt = m.t; }
    if (checkpoint === 2) { const P = game.world.places.passage; game.car.place(P.parking.x, P.parking.z, P.parking.yaw); game.enterCar(); game.squad.form([...TEAM, 'nehorai'], { near: game.car.pos, yaw: game.car.yaw }); }
  },
  cleanup(m, game) {
    const f = F(game);
    game.cutscene = false; game.follow.override = null; clock(game, null);
    m.pursuit?.dispose(); m.pursuit = null; m.job?.cancel(); m.job = null; game.chase = null; game.alert.chasing = false;
    game.paint.dispose();
    hideGuards(game, ids(WAKE));
    f.gate.lock(); f.holding.cellDoor.lock(); f.main.westDoor.lock(); f.main.eastDoor.lock();
    const k = game.npc('kotzi'); k.model.setPose(null); k.show(false);
    const n = game.npc('nehorai'); n.model.setPose(null); n.show(false);
    asNehorai(game);
    if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 4);
    game.populate({ walk: true });
  },

  steps: [
    { // 0: the cell
      objective: 'נהוראי',
      enter(m, game) {
        const f = F(game);
        game.cutscene = true;
        const n = game.npc('nehorai'), k = game.npc('kotzi');
        n.floorY = null; n.place(f.holding.nehorai.x, f.holding.nehorai.z, f.holding.nehorai.yaw); n.model.setPose('sit'); n.show(true);
        k.place(f.holding.bed.x - 1.5, f.holding.bed.z + 1.2, 0); k.model.setPose('down'); k.show(true);
        game.player.place(f.holding.keypadAt.x + 1.2, f.holding.keypadAt.z, f.holding.keypadAt.yaw);
        team(game, game.player.pos, game.player.yaw);
        game.follow.shot({ x: f.holding.cell.x - 3, y: f.y + 2.2, z: f.holding.cell.z + 4 }, { x: f.holding.nehorai.x, y: f.y + 1.0, z: f.holding.nehorai.z }, 9999);
        game.hud.banner('תא 2', '', 'נהוראי', 2600);
        // Ido first, a hand; then everyone
        game.squad.send('ido', { x: f.holding.nehorai.x - 1.0, z: f.holding.nehorai.z + 0.8, yaw: Math.PI / 2 }, { label: 'יד', onArrive: () => { n.model.setPose(null); n.idle = 'arms'; n.lookAt(game.player.pos.x, game.player.pos.z); } });
        setTimeout(() => { for (const id of TEAM) if (id !== 'ido') game.squad.send(id, { x: f.holding.cell.x - 1 + Math.random() * 3, z: f.holding.cell.z - 3 + Math.random() * 4 }, { label: 'תא' }); }, 1500);
        game.dialogue.play(CELL).then(() => { m.s.reunited = true; });
      },
      update: (m) => (m.s.reunited ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); for (const id of TEAM) game.squad.release(id); game.squad.form([...TEAM, 'nehorai'], { near: game.player.pos, yaw: game.player.yaw }); },
    },
    { // 1: the alarm: out to the cars
      objective: 'אזעקה! לשער הצפוני, ואז לרכבים · 2:00', checkpoint: true,
      enter(m, game) {
        const f = F(game);
        m.s.alarmAt = m.t;
        game.alert.raise(100);
        game.hud.banner('אזעקה', '', 'כל המתחם מתעורר · שתי דקות', 2600);
        game.sound?.hit?.('crash', 0.8);
        postGuards(game, f, WAKE); armTeam(game);
        for (const g of game.paint.guards) { g.seen = 1; g.alerted = true; }
        game.dialogue.play(ALARM);
      },
      target: (m, game) => { const f = F(game), P = game.world.places.passage; return !m.s.gateOpen ? { ...f.gateInside, y: f.y, r: 3 } : game.mode === 'car' ? null : { ...P.parking, r: 4 }; },
      update(m, game, dt) {
        const f = F(game), P = game.world.places.passage, me = game.player.pos;
        const leftS = LIMIT - (m.t - m.s.alarmAt);
        clock(game, leftS);
        if (leftS <= 0) { m.s.timeOut = true; return null; }
        if (!m.s.gateSent && near(me, f.gateInside, 9)) { m.s.gateSent = true; game.dialogue.play(GATE); m.job = new Job(game, { who: 'ido', at: { x: f.gateInside.x + 1.5, z: f.gateInside.z - 1.5, yaw: 0 }, seconds: 3.5, near: 12, pill: 'עידו פותח את השער', onDone: () => { m.s.gateOpen = true; f.gate.unlock(); f.gate.setOpen(true); game.dialogue.play(GATE_OPEN); } }); }
        m.job?.update(dt);
        say(m, game, !m.s.gateOpen ? `לשער הצפוני · עידו פותח · ${Math.ceil(leftS)} שניות` : `לרכבים בסוף הדרך · ${Math.ceil(leftS)} שניות`);
        if (m.s.gateOpen && game.mode === 'car') { clock(game, null); return 'next'; }
        return null;
      },
      exit(m, game) { clock(game, null); game.paint.disarmPlayer(); m.job?.cancel(); m.job = null; },
    },
    { // 2: the road home, Kotzi's cars behind
      objective: 'לברוח לקציר, לתצפית · הוואנים של קוצי מאחור', checkpoint: true,
      enter(m, game) { game.nehorai.setPose(null); },
      target: (m, game) => { const p = game.world.places.plaza; return { x: p.x + p.dx * -4, z: p.z + p.dz * -4, y: p.h, r: 7 }; },
      update(m, game, dt) {
        const p = game.world.places.plaza;
        if (game.mode === 'car' && !m.pursuit) m.pursuit = new Pursuit(game, { grace: 5, cars: 4, gap: 11, colors: ['#1c1f26', '#2f4a3a', '#1c1f26', '#2f4a3a'], lines: RUN, bonus: 300 });
        if (m.pursuit) m.pursuit.update(dt);
        say(m, game, game.mode === 'car' ? (m.pursuit?.active ? 'לאבד את הוואנים של קוצי ולהגיע לתצפית בקציר' : 'לנסוע לתצפית בקציר · כולם ברכב') : 'לחזור לרנו');
        return game.mode === 'car' && Math.hypot(game.car.pos.x - p.x, game.car.pos.z - p.z) < 14 && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
      exit(m, game) { m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; },
    },
    { // 3: the lookout; MISSION COMPLETE
      objective: 'התצפית',
      enter(m, game) {
        const p = game.world.places.plaza;
        game.cutscene = true;
        game.exitCar();
        const me = game.player.pos;
        game.squad.form([...TEAM, 'nehorai'], { near: me, yaw: game.player.yaw });
        const n = game.npc('nehorai'); n.place(me.x + Math.sin(game.player.yaw) * 2, me.z + Math.cos(game.player.yaw) * 2, game.player.yaw + Math.PI); n.idle = 'arms'; n.target = null; n.show(true);
        game.follow.shot({ x: me.x - 4, y: me.y + 2.4, z: me.z - 4 }, { x: me.x + 1, y: me.y + 1.2, z: me.z + 1 }, 9999);
        game.hud.banner('קציר', 'התצפית · 03:30', 'כולם בבית', 3000);
        game.dialogue.play(END).then(() => new Promise((res) => {
          game.hud.fade('MISSION COMPLETE – NAHORAI RESCUED', () => {
            asNehorai(game);
            game.start(p.x + p.dx * -4, p.z + p.dz * -4, Math.atan2(p.dx, p.dz));
            game.daylight?.set(0, 6);
          }, 5200);
          setTimeout(res, 5400);
        })).then(() => { game.hud.banner('טלפון', 'מספר לא מוכר', TEASER, 5200); m.s.done = true; });
      },
      update: (m) => (m.s.done ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
  ],
  complete(m, game) { m.done = true; },
};
