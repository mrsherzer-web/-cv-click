// Chapter seven, mission 5, "המצודה". Kotzi's main compound: a way in to choose (the quiet hatch the
// passage ends at, or the north gate with everyone awake), the yard under two watchtowers and three
// cameras (the generator shed cuts their power), the control room up on the mound where the cell's
// code is written on a note, the long main building hall by hall with its locked doors, and the
// covered tunnel east to the holding block. Nehorai on the radio, the team at Erez's side. Invented.
import { near, say, nearestGuard } from './missions.js';
import { asErez, asNehorai, arriveTeam, armTeam, postGuards, hideGuards, left, radio, failOut, team, Job } from './rescue.js';

const HATCH = [['עידו', 'החצר של קוצי. שני מגדלים, שלוש מצלמות, גנרטור בצד, והבניין הגדול באמצע. חדר הבקרה על הגבעה מאחור.'], ['ארז', 'איך נכנסים? בשקט מפה, או בקול מהשער.']];
const QUIET = [['ארז', 'בשקט. המצלמות דולקות — אברהם, הגנרטור. מולר, אתה מכסה.'], ['אברהם', 'סוף סוף משימה שמתאימה לי: ללכת ולדבר עם מכונה.']];
const LOUD = [['ארז', 'בקול. מולר, ליאם: השער.'], ['מולר', 'שער.'], ['ליאם', 'אחים, זה הולך להיות רועש.'], ['שומר', 'השער! כולם לחצר!']];
const GEN_OFF = [['אברהם', 'הגנרטור כבוי. המצלמות עיוורות. אמרתי לו משהו לפני, הוא לא ענה.'], ['עידו', 'יפה, אברהם.']];
const YARD_CLEAR = [['עידו', 'החצר נקייה. חדר הבקרה על הגבעה: שם הקוד לתא.'], ['דולב', 'גבעה. יופי. חיכיתי לעלייה.']];
const NOTE = [['עידו', 'פתק על השולחן: "תא 2: 4-7-1-9". קוצי כותב סיסמאות על פתקים. אוהב אותו.'], ['ארז', 'ארבע, שבע, אחת, תשע. הבניין הגדול, ואז המנהרה.']];
const HALLS = [['עידו', 'שלושה אולמות. הדלתות ביניהם נעולות. אני פותח, אתם מנקים.'], ['הדר', 'Bro, תעבוד מהר, אני לא אוהב מחסנים.']];
const HALL_CLEAR = [['ארז', 'נקי. המנהרה בקצה המזרחי. נהוראי בצד השני שלה.'], ['ליאם', 'אחים יקרים, הולכים להחזיר אותו.']];
const TUNNEL = [['שומר', 'עצור! מי— ארז?! קוצי! הם פה!'], ['ארז', 'כן. אנחנו פה.']];
const NEHORAI_4 = 'אני שומע אתכם ליד הבניין. קוצי פה איתי, בדלת של התא. הוא עצבני. זה טוב, לא?';
const NEHORAI_5 = 'הקוד! שמעתי אותם: "ארבע שבע משהו". אל תנחשו, תמצאו את הפתק.';

const F = (game) => game.world.places.fort;
const YARD = [['guard1', 't1'], ['guard2', 't2'], ['guard3', 'yardW'], ['guard4', 'yardE'], ['vg1', 'yardN'], ['vg2', 'gate'], ['vg3', 'gen']];
const CONTROL = [['vg4', 'yardS'], ['vg5', 'yardS']];
const HALL = [['vg6', 'hallW'], ['vg7', 'hallC'], ['vg8', 'hallE']];
const TUN = [['vg9', 'tunnel']];
const ALL = [...YARD, ...CONTROL, ...HALL, ...TUN];
const ids = (list) => list.map((g) => g[0]);

function cameras(game, m, dt) {
  if (m.s.genOff) return;
  const f = F(game), p = game.player.pos;
  for (const c of f.cameras) if (c.sees(game.world, p.x, p.z)) { game.alert.raise(dt * 22); if (!m.s.camWarn || m.t - m.s.camWarn > 10) { m.s.camWarn = m.t; game.hud.toast('מצלמה! הקונוס האדום', 1600); } if (game.alert.level >= 70) for (const g of game.paint.guards) if (!g.marked && YARD.some(([id]) => game.npc(id) === g.npc)) { g.seen = 1; g.alerted = true; } }
}

export default {
  id: 'fort', chapter: 7, number: 5, title: 'המצודה', requires: ['passage'],
  follows: true, secret: true,
  where: 'בפתח המנהרה, בחומת המצודה',
  startAt: (game) => { const f = F(game); return f ? { x: f.hatch.x, z: f.hatch.z, y: f.y } : null; },
  reward: { money: 500, unlocks: ['cell-code'], text: 'הקוד לתא · 500 ₪' },

  setup(m, game) { m.s = {}; asErez(game); },
  prepareReplay(game) { asErez(game); if (game.mode === 'car') game.exitCar(); const f = F(game); game.start(f.hatch.x, f.hatch.z, f.hatch.yaw); team(game, game.player.pos, game.player.yaw); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3, 4]); },
  restore(m, game, checkpoint) {
    const f = F(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    m.job?.cancel(); m.job = null;
    asErez(game); game.exitCar();
    const at = checkpoint >= 4 ? f.main.tunnelMouth : checkpoint === 3 ? f.main.door : checkpoint === 2 ? f.control.foot : f.hatch;
    game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
    team(game, game.player.pos, game.player.yaw);
    postGuards(game, f, ALL); armTeam(game);
    const done = checkpoint >= 2 ? [...YARD] : [];
    if (checkpoint >= 3) done.push(...CONTROL);
    if (checkpoint >= 4) done.push(...HALL);
    for (const g of game.paint.guards) if (done.some(([id]) => game.npc(id) === g.npc)) game.paint.markGuard(g, 'restore');
    if (checkpoint >= 2) { m.s.genOff = true; for (const c of f.cameras) c.setOn(false); }
    if (checkpoint >= 4) { f.main.westDoor.unlock(); f.main.westDoor.setOpen(true); f.main.eastDoor.unlock(); f.main.eastDoor.setOpen(true); }
  },
  cleanup(m, game) {
    const f = F(game);
    m.job?.cancel(); m.job = null;
    game.cutscene = false; game.follow.override = null;
    game.paint.dispose();
    hideGuards(game, ids(ALL));
    for (const c of f.cameras) c.setOn(true);
    f.gate.lock(); if (!m.done) { f.main.westDoor.lock(); f.main.eastDoor.lock(); } f.generator.lamp.material = game.world.places.fort.generator.lamp.material;
    if (!m.done) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: the way in
      objective: 'המצודה · איך נכנסים?',
      enter(m, game) {
        const f = F(game);
        game.cutscene = true;
        arriveTeam(game, f.hatch);
        postGuards(game, f, ALL);
        game.follow.shot({ x: f.hatch.x + 4, y: f.y + 5, z: f.hatch.z - 8 }, { x: f.x, y: f.y + 1.5, z: f.z - 10 }, 9999);
        game.hud.banner('המצודה', '02:05', 'שני מגדלים · שלוש מצלמות · הבניין הגדול', 3200);
        game.dialogue.play(HATCH).then(() => game.hud.choose('איך נכנסים למצודה?', [
          { id: 'quiet', label: 'בשקט · מהפתח במערב', note: 'המצלמות דולקות עד שמכבים את הגנרטור · השומרים בסיור' },
          { id: 'loud', label: 'בקול · מהשער הצפוני', note: 'מולר וליאם פותחים את השער · כולם מתעוררים, אבל הם באים אליכם' },
        ])).then((pick) => {
          m.s.way = pick;
          if (pick === 'loud') {
            game.exitCar();
            arriveTeam(game, f.gateOutside);
            f.gate.unlock(); f.gate.setOpen(true);
            for (const g of game.paint.guards) if (YARD.some(([id]) => game.npc(id) === g.npc)) { g.seen = 1; g.alerted = true; }
            game.follow.shot({ x: f.gateOutside.x - 6, y: f.y + 4, z: f.gateOutside.z - 6 }, { x: f.x, y: f.y + 1.5, z: f.z - 30 }, 9999);
            return game.dialogue.play(LOUD);
          }
          return game.dialogue.play(QUIET);
        }).then(() => { m.s.chosen = true; });
      },
      update: (m) => (m.s.chosen ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); armTeam(game); },
    },
    { // 1: the yard, and the generator
      objective: 'החצר: המגדלים והסיורים (0/7) · הגנרטור מכבה את המצלמות', checkpoint: true,
      target: (m, game) => { const f = F(game); return !m.s.genOff && m.s.way !== 'loud' ? { ...f.generator.breaker, r: 1.5 } : nearestGuard(game, ids(YARD)); },
      interaction(m, game) { const f = F(game); if (game.mode === 'foot' && !m.s.genOff && near(game.player.pos, f.generator.breaker, 2.2)) return { label: 'לנתק את החשמל למצלמות', priority: 5, run: () => { m.s.genOff = true; for (const c of f.cameras) c.setOn(false); f.generator.lamp.material = game.paint ? f.generator.lamp.material : null; game.hud.toast('המצלמות כבויות', 1500); game.dialogue.play(GEN_OFF); } }; return null; },
      update(m, game, dt) {
        cameras(game, m, dt);
        const n = left(game, ids(YARD));
        say(m, game, n ? `החצר: לסמן את השומרים והמגדלים (${7 - n}/7)${m.s.genOff ? '' : ' · הגנרטור מכבה את המצלמות'} · סומנת ${game.paint.hits}/3` : 'החצר נקייה · חדר הבקרה על הגבעה');
        if (!n && !m.s.yardSaid) { m.s.yardSaid = true; game.dialogue.play(YARD_CLEAR).then(() => radio(game, NEHORAI_5)); }
        return n === 0 && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 2: the control room and the code
      objective: 'חדר הבקרה על הגבעה · הפתק עם הקוד', checkpoint: true,
      target: (m, game) => { const f = F(game); return left(game, ids(CONTROL)) ? (nearestGuard(game, ids(CONTROL)) || { ...f.control.door, y: f.control.y, r: 2 }) : { ...f.control.note, r: 1.4 }; },
      interaction(m, game) { const f = F(game); if (game.mode === 'foot' && !m.s.note && !left(game, ids(CONTROL)) && near(game.player.pos, f.control.note, 2.2)) return { label: 'לקרוא את הפתק', priority: 5, run: () => { m.s.note = true; game.hud.toast(`הקוד לתא 2: ${f.code.split('').join('-')}`, 4000); game.dialogue.play(NOTE).then(() => { m.s.noted = true; }); } }; return null; },
      update(m, game) { const n = left(game, ids(CONTROL)); say(m, game, n ? `חדר הבקרה: שני שומרים על הגבעה (${2 - n}/2) · סומנת ${game.paint.hits}/3` : !m.s.note ? 'הפתק על שולחן הבקרה' : 'הקוד אצלך'); return m.s.noted ? 'next' : null; },
    },
    { // 3: the main building, hall by hall
      objective: 'הבניין הגדול: שלושה אולמות (0/3) · עידו פותח את הדלתות', checkpoint: true,
      enter(m, game) { game.dialogue.play(HALLS).then(() => radio(game, NEHORAI_4)); },
      target: (m, game) => { const f = F(game); const me = game.player.pos; const inside = Math.abs(me.x - f.x) < 22 && me.z - f.z > -6 && me.z - f.z < 16; return inside ? (nearestGuard(game, ids(HALL)) || { ...f.main.tunnelMouth, y: f.y, r: 2 }) : { ...f.main.door, y: f.y, r: 2 }; },
      update(m, game, dt) {
        const f = F(game), me = game.player.pos;
        // Ido opens the doors between the halls as Erez reaches the centre: the west one, then the east one
        if (!m.s.westSent && near(me, f.main.centre, 9)) {
          m.s.westSent = true;
          m.job = new Job(game, { who: 'ido', at: f.main.westDoorAt, seconds: 2.5, near: 14, pill: 'עידו פורץ את הדלת המערבית', onDone: () => {
            f.main.westDoor.unlock(); f.main.westDoor.setOpen(true); game.hud.toast('הדלת המערבית פתוחה', 1200);
            m.job = new Job(game, { who: 'ido', at: f.main.eastDoorAt, seconds: 2.5, near: 14, pill: 'עידו פורץ את הדלת המזרחית', onDone: () => { f.main.eastDoor.unlock(); f.main.eastDoor.setOpen(true); game.hud.toast('הדלת המזרחית פתוחה', 1200); } });
          } });
        }
        m.job?.update(dt);
        const n = left(game, ids(HALL));
        say(m, game, n ? `הבניין: לסמן את השומרים באולמות (${3 - n}/3) · סומנת ${game.paint.hits}/3` : 'הבניין נקי · המנהרה בקצה המזרחי');
        if (!n && !m.s.hallSaid) { m.s.hallSaid = true; game.dialogue.play(HALL_CLEAR); }
        return n === 0 && f.main.eastDoor.open && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 4: the tunnel
      objective: 'המנהרה מזרחה · אל בלוק התאים', checkpoint: true,
      target: (m, game) => { const f = F(game); return left(game, ids(TUN)) ? (nearestGuard(game, ids(TUN)) || { ...f.tunnel.start, y: f.y, r: 2 }) : { ...f.holding.door, y: f.y, r: 2 }; },
      update(m, game) {
        const f = F(game);
        if (!m.s.tunSaid && near(game.player.pos, f.tunnel.start, 4)) { m.s.tunSaid = true; game.dialogue.play(TUNNEL); }
        const n = left(game, ids(TUN));
        say(m, game, n ? `המנהרה: השומר בקצה (${1 - n}/1) · סומנת ${game.paint.hits}/3` : 'בלוק התאים בקצה המנהרה · נהוראי שם');
        return n === 0 && near(game.player.pos, f.holding.door, 2.5) ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
