// Chapter eight, mission 2, "המרדף הגדול". Out of the hideout's yard and east on the iron road with the
// whole gang in the car: Kotzi's cars behind (rivals, never police), two helicopters overhead, things by
// the road that go up as the Renault passes, a barricade with a gap, the overpass; at the fork Kotzi's
// truck closes the straight road ("נהוראי, שמאלה! עכשיו!"), the old road bears left through a long
// tunnel, and a fall of rubble closes it behind them. The driving is the player's, all of it.
import { near, say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { TEAM, crew, endCrew, clock, Blast, attempt, handsOver } from './firestorm.js';

const R = (game) => game.world.places.ironRoad;
const COLORS = ['#121417', '#1c1f26', '#2a2d33'];
const LINES = {
  start: [['ארז', 'הם מאחורינו! שלושה רכבים!'], ['עידו', 'נהוראי, תן גז. מזרחה, בכביש הברזל.']],
  arrive: [[['ליאם', 'עוד אחד מאחור, אחים!']], [['דולב', 'עוד אחד! מאיפה הם באים?!']], [['הדר', 'Bro, שלושה! זה הרבה!']]],
  close: [['ארז', 'הוא צמוד אלינו!'], ['עידו', 'שמאלה ימינה, אל תיתן לו להיצמד!'], ['יונתי', 'אני מרגיש אותו בפגוש!']],
  hit: [['אברהם', 'הרנו! תשמור על הרנו!'], ['ארז', 'ספגנו! להמשיך!']],
  lost: [['עידו', 'איבדנו אותם. בינתיים.']],
};
const HELI = [['מולר', 'מסוק! שניים! הם רואים אותנו מלמעלה.'], ['עידו', 'שירו. הם לא יורים, הם רק מראים לאחרים איפה אנחנו.']];
const BARRICADE = [['עידו', 'מחסום! דרך הפרצה באמצע!']];
const LEFT = [['עידו', 'נהוראי, שמאלה! עכשיו!']];
const TRUCK = [['ארז', 'המשאית של קוצי חוסמת את כל הכביש! הדרך הישנה!']];
const TUNNEL = [['עידו', 'המנהרה הישנה. ישר דרכה, אל תעצור.']];
const SEALED = [['ארז', 'זהו. הם לא עוברים את זה.'], ['נהוראי', 'קדימה. הכביש ממשיך לבסיס שלהם.'], ['עידו', 'בסיס הברזל. ככה הם קוראים לו.']];

const carS = (road, game) => road.nearest(game.car.pos.x, game.car.pos.z);
function onBranch(game) { const r = R(game), q = r.branch.nearest(game.car.pos.x, game.car.pos.z); return q.d < 8 ? q.s : -1; }
function helis(m, game, on) {
  for (const h of m.helis || []) { h.dispose(); game.helis = game.helis.filter((x) => x !== h); }
  m.helis = [];
  if (!on) return;
  const me = () => ({ x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, yaw: game.car.yaw });
  for (const [ahead, h, side] of [[40, 24, 22], [-30, 30, 16]]) { const x = new game.Heli(game).shadow(me, { ahead, h, side }); m.helis.push(x); game.helis.push(x); }
}
function startChase(m, game) {
  m.pursuit?.dispose();
  m.pursuit = new Pursuit(game, { grace: 3, cars: 3, gap: 10, colors: COLORS, lines: LINES, bonus: 200, radio: true });
}
function stopChase(m, game) { m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; game.hud.setPursuit(null); }
function inCar(game, at) {
  if (game.mode === 'car') game.exitCar();
  game.car.repair();
  game.car.place(at.x, at.z, at.yaw, at.h ?? at.y);
  game.player.place(at.x + Math.cos(at.yaw) * 2, at.z - Math.sin(at.yaw) * 2, at.yaw);
  game.enterCar();
  if (!game.squad.active) crew(game, game.player.pos, at.yaw);
}

export default {
  id: 'ironroad', chapter: 8, number: 2, title: 'המרדף הגדול', requires: ['firestorm'],
  follows: true, startInCar: true,
  where: 'בחצר של מחסן המסתור, ברנו',
  startAt: (game) => { const c = game.world.places.hideout?.car; return c ? { x: c.x, z: c.z, y: c.y } : null; },
  reward: { money: 700, unlocks: ['ironroad'], text: 'נמלטתם דרך המנהרה · 700 ₪' },

  setup(m, game) {
    m.s = {}; m.live = [];
    game.daylight?.set(1, 0);
    const r = R(game);
    if (game.mode !== 'car') { const h = game.world.places.hideout; inCar(game, { x: h.car.x, z: h.car.z, yaw: h.car.yaw, h: h.y }); }
    if (!game.squad.active) crew(game, game.player.pos, game.car.yaw);
    r.collapse.open();
  },
  prepareReplay(game) { const h = game.world.places.hideout; game.daylight?.set(1, 0); inCar(game, { x: h.car.x, z: h.car.z, yaw: h.car.yaw, h: h.y }); },
  failIf(m, game) { return game.mode === 'car' && game.car.disabled ? 'הרנו נפגעה יותר מדי. ארז: "עוד פעם, ובלי להתנגש בכל דבר."' : null; },
  restore(m, game, checkpoint) {
    const r = R(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    stopChase(m, game); for (const b of m.live || []) b.cancel(); m.live = [];
    r.collapse.open();
    const s = checkpoint >= 1 ? r.fork.s - 120 : 6, p = r.main.at(s);
    inCar(game, { x: p.x - p.nx * 2, z: p.z - p.nz * 2, yaw: Math.atan2(p.tx, p.tz), h: p.h });
    m.s = { ...m.s, done: new Set(), sealed: false, leftSaid: false, truckSaid: false, tunnelSaid: false };
    if (checkpoint >= 1) { startChase(m, game); helis(m, game, true); } // the fork has no start of its own: the chase goes on
  },
  cleanup(m, game) {
    stopChase(m, game); helis(m, game, false);
    for (const b of m.live || []) b.cancel(); m.live = [];
    R(game).collapse.open();
    clock(game, null);
    if (!m.done || !handsOver(game)) endCrew(game);
  },

  steps: [
    { // 0: east on the iron road
      objective: 'לנסוע מזרחה בכביש הברזל · לאבד את הרכבים של קוצי', checkpoint: true,
      enter(m, game) { m.s.done = m.s.done || new Set(); startChase(m, game); helis(m, game, true); setTimeout(() => { if (m.stepIndex === 0) game.dialogue.play(HELI); }, 9000); },
      target(m, game) { const r = R(game), q = carS(r.main, game), p = r.main.at(Math.min(r.fork.s - 20, q.s + 70)); return { x: p.x, z: p.z, y: p.h, r: 6 }; },
      update(m, game, dt) {
        const r = R(game), q = carS(r.main, game);
        m.pursuit?.update(dt);
        // the things by the road go up as the Renault passes: cinema, beside the road, never on it
        for (const b of r.blasts) if (!m.s.done.has(b) && Math.abs(q.s - b.s) < 16) { m.s.done.add(b); m.live.push(new Blast(game, { at: b, size: b.size, warn: 0.5, radius: 0, fire: 20, hurts: false, quiet: true })); }
        for (const b of m.live) b.update(dt);
        if (!m.s.barSaid && Math.abs(q.s - r.barricade.s) < 70) { m.s.barSaid = true; game.dialogue.play(BARRICADE); }
        say(m, game, m.pursuit?.active ? 'כביש הברזל מזרחה · הם מאחוריכם · לעבור בפרצה במחסום' : 'כביש הברזל מזרחה · ליציאה מהעיר');
        return q.d < 12 && q.s > r.fork.s - 110 ? 'next' : null;
      },
    },
    { // 1: the fork: left, now
      objective: 'בצומת · שמאלה, לדרך הישנה', checkpoint: true,
      target(m, game) { const r = R(game), p = r.branch.at(48); return { x: p.x, z: p.z, y: p.h, r: 6 }; },
      update(m, game, dt) {
        const r = R(game), q = carS(r.main, game);
        m.pursuit?.update(dt);
        for (const b of m.live) b.update(dt);
        if (!m.s.leftSaid && q.s > r.fork.s - 65) { m.s.leftSaid = true; game.dialogue.play(LEFT); game.hud.banner('', 'שמאלה!', 'המשאית חוסמת את הכביש', 2200); }
        if (!m.s.truckSaid && q.s > r.fork.s + 12 && q.d < 10) { m.s.truckSaid = true; game.dialogue.play(TRUCK); }
        say(m, game, 'הצומת · שמאלה לדרך הישנה · ישר חסום');
        const b = onBranch(game);
        return b > 40 ? 'next' : null;
      },
    },
    { // 2: the tunnel, and the rubble behind
      objective: 'דרך המנהרה הישנה', checkpoint: false,
      enter(m, game) { game.dialogue.play(TUNNEL); },
      target(m, game) { const r = R(game); return m.s.sealed ? { ...r.end, r: 10 } : { x: r.tunnel.end.x, z: r.tunnel.end.z, y: r.tunnel.end.h, r: 8 }; },
      update(m, game, dt) {
        const r = R(game), b = onBranch(game);
        m.pursuit?.update(dt);
        for (const x of m.live) x.update(dt);
        if (!m.s.sealed && b > r.tunnel.out + 16) {
          m.s.sealed = true;
          const c = r.collapse;
          game.fx.explode(c.x, c.h, c.z, { size: 4.2, fire: 30 });
          setTimeout(() => game.fx.explode(c.x - c.p.tx * 8, c.h + 2, c.z - c.p.tz * 8, { size: 2.8, fire: 20, sound: false }), 380);
          c.close();
          game.carCam?.shake(1.2);
          stopChase(m, game);
          game.hud.banner('', 'נמלטתם', 'המנהרה נסגרה מאחוריכם', 2600);
          game.dialogue.play(SEALED);
          helis(m, game, false);
        }
        say(m, game, m.s.sealed ? 'להמשיך בדרך הישנה · עד הסוף' : 'דרך המנהרה · ישר');
        return m.s.sealed && near(game.car.pos, r.end, 30) ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
