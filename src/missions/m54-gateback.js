// Chapter ten, mission 8, "פותחים את השער בחזרה". In the citadel, in the ordinary world, Ido presses Muller to
// bring Nehorai and Erez back; Muller finds a weak signal from the other side: the Shadow's own machine can open
// a counter-portal, if it charges and nobody breaks it meanwhile. The player is Ido for that defence (the one time
// chapter ten plays as someone else): the Order's men come at the machine from the main door, down the stairs and
// along the south side; the friends hold their sides beside him; the bar fills while none of them stands at the
// machine. Then the grove, as Nehorai: the radio comes back, Muller marks the energy point, and the run with Erez
// to it while the dimension breaks behind them (the front only ever starts the run again); the portal opens
// between the two great olives and they leap into it. Mission 55 carries on from the white. Paint for everyone,
// a marked man sits down; nobody of the gang betrays, nobody dies. Invented, all of it.
import { near, nearestGuard, say } from './missions.js';
import { OUT_AT, COLORS } from '../combat/paint.js';
import { Portal } from '../fx/portal.js';
import { L } from './lines10.js';
import { Leap, Disturbance, Kit, endCrew } from './infinity.js';
import {
  CIT, GRV, ORDER, hall, CONSOLE, MULLER_AT, GATE_AT, hold, buddiesOff, onlyThese, freshMarks, clearScene, machineConsole,
  inCitadel, citadelBack, inGrove, groveBack, asNehorai, Front, wipeOff,
  attempt, become, nehoraiAway, gangAt, upAgain, offBoard, Wave, beats, later, talkOn, bandage, hush,
} from './infinity-c.js';

const G = L.gateback;
const FIGHTERS = ['yonati', 'avraham', 'dolev', 'hadar', 'liam']; // beside Ido at the machine (Muller works it)
const FILL = 44;        // seconds of charge with nobody of the Order at the machine
const AT_MACHINE = 24;  // within this of the console a man of the Order has a line on it: the charge stops
const RADIO = (line) => [...line, 'phone'];

// ---------- the main hall (the tower's own frame: x from the door in the west wall to the screen in the east) ----------
const IDO_AT = (g) => hall(g, 104.4, -0.6, -Math.PI / 2);
// where each friend holds his side: the middle (from the door), the north (the stairs), the south
const POSTS = (g) => ({
  yonati: hall(g, 100.6, -4.2, -Math.PI / 2), avraham: hall(g, 100.6, 4.2, -Math.PI / 2),
  dolev: hall(g, 104.6, -7.4, Math.PI), hadar: hall(g, 101.2, -8.2, Math.PI - 0.6), liam: hall(g, 104.2, 7.4, 0),
});
const SIDE_NAMES = { yonati: 'בשער', avraham: 'בשער', dolev: 'במדרגות', hadar: 'במדרגות', liam: 'בדרום' };
// the Order's men, side by side: the main door, the stairs from the energy hall, the south side; the last of them
// from both ends (a heavy who takes three marks, a runner who shoves)
const WAVES = (g) => [
  { at: 0, call: [['יונתי', 'מהשער! שלושה!']], list: [
    { id: 'og1', from: hall(g, 34.5, -1.2), post: hall(g, 93, -5) }, { id: 'og2', from: hall(g, 34.5, 1.2), post: hall(g, 93, 5) },
    { id: 'og3', from: hall(g, 33, 0), post: hall(g, 96, 0) },
  ] },
  { at: 0.25, call: [['דולב', 'יורדים במדרגות!']], list: [
    { id: 'og5', from: hall(g, 106.6, -33.2), post: hall(g, 104, -6) }, { id: 'og6', from: hall(g, 108.2, -32.4), post: hall(g, 107, -7) },
    { id: 'og7', from: hall(g, 106.6, -31.6), post: hall(g, 101, -5) },
  ] },
  { at: 0.5, call: [['ליאם', 'עוד מהצד הדרומי!']], list: [
    { id: 'og9', from: hall(g, 37, 30), post: hall(g, 98, 6) }, { id: 'og10', from: hall(g, 39, 32), post: hall(g, 101, 5) },
    { id: 'og11', from: hall(g, 37, 33), post: hall(g, 95, 8) },
  ] },
  { at: 0.75, call: [['הדר', 'האחרונים — ויש להם אחד גדול!']], list: [
    { id: 'hv1', from: hall(g, 34.5, 0), post: hall(g, 95, 0) }, { id: 'og13', from: hall(g, 33, 1.5), post: hall(g, 97, 4) },
    { id: 'rn1', from: hall(g, 107, -33), post: hall(g, 104, -3) }, { id: 'og14', from: hall(g, 108.6, -32), post: hall(g, 106, -6) },
  ] },
];
const WAVE_IDS = ['og1', 'og2', 'og3', 'og5', 'og6', 'og7', 'og9', 'og10', 'og11', 'hv1', 'og13', 'rn1', 'og14'];

// ---------- the grove (world coordinates; the clearing, the run-up, the energy point between the great olives) ----------
const Q = (g) => GRV(g);
const at = (g, x, z, yaw) => ({ x, z, y: Q(g).y, ...(yaw != null ? { yaw } : {}) });
const RUN_FROM = (g) => at(g, 1171.5, 193.5, Math.PI / 2);
const ERZ_FROM = (g) => at(g, 1173, 191.6, Math.PI / 2);
const ERZ_END = (g) => at(g, 1212.6, 190.7, Math.PI / 2);
const LEAP_FROM = (g) => at(g, 1212.3, 193.5, Math.PI / 2);
const PORTAL = (g) => ({ ...Q(g).portalAt }); // the energy point between the two great olives
const FRONT_X = 1153, FRONT_Z0 = 181, FRONT_Z1 = 206, FRONT_SPEED = 4.2, FRONT_CREEP = 1.6;

// the lines that are not the user's: short, the friends' own voices
const SIGNAL = [['מולר', 'רגע… יש אות. חלש, אבל יש.']];
const PLAN = [
  ['מולר', 'המכונה של הצל פתחה להם שער — והיא יכולה לפתוח אחד גם בחזרה.'],
  ['מולר', 'רק צריך שהיא תיטען עד הסוף, ושאף אחד לא ישבור אותה בינתיים.'],
  ['עידו', 'אז אף אחד לא נוגע בה. חבר’ה, לעמדות!'],
];
const HALF = [['מולר', 'חצי דרך! תמשיכו להחזיק!']];
const FULL = [['מולר', 'המכונה טעונה! אני שולח להם אות!'], ['אברהם', 'את האחרונים עלינו.']];
const SEEN = [['ארז', 'נקודה כחולה, בין שני הזיתים הגדולים. רואה?'], ['נהוראי', 'רואה. רצים ולא עוצרים.']];
const BREAK = [['ארז', 'נהוראי, השמיים נשברים מאחורינו! רוץ!']];
const IDO_OUT = 'עידו סומן שלוש פעמים. לפי החוקים, בחוץ. מולר: "מההתחלה, עידו. תישאר ליד המכונה, מאחורי מחסה — שהם יבואו אליך."';
const RUN_OUT = 'החזית של הממד השבור השיגה אותך — מתחילים את הריצה מחדש. ארז: "אחי, זה לא טיול בחורשה! כפתור הריצה, לעקוף את ההפרעות, ולא לעצור עד הנקודה."';

// ---------- the whole scene at a checkpoint (a retry, a reload): who is played, where, the dimension, the doors ----------
function stage(m, game, cp) {
  m.gate?.dispose(); m.gate = null; m.small?.dispose(); m.small = null;
  clearScene(m, game);
  game.paint.dispose(); offBoard(game, ORDER); buddiesOff(game);
  m.s = { cp }; m.said = null;
  if (cp <= 1) {
    // the citadel, the ordinary world: Ido played, the five beside him, Muller at the machine; Nehorai and Erez
    // are on the other side
    inCitadel(game, { screen: cp === 0 ? 'static' : 'engine', progress: 0 });
    become(game, 'ido');
    nehoraiAway(game);
    const e = game.npc('erez'); game.paint.removeAlly(e); e.target = null; e.show(false);
    const me = IDO_AT(game);
    gangAt(game, me, me.yaw, { ids: FIGHTERS, lead: 'ido' });
    onlyThese(game, [...FIGHTERS, 'muller']);
    hold(game, 'muller', MULLER_AT(game));
    machineConsole(game, true).set(0);
    game.sound?.music?.(cp === 0 ? null : 'action', { fade: 0.4 });
  } else {
    // the grove's other dimension: Nehorai played again (his bandage, his own marker), Erez beside him
    machineConsole(game, false); citadelBack(game);
    inGrove(game, { point: cp >= 3 });
    asNehorai(game);
    game.squad.dismiss();
    onlyThese(game, ['erez']);
    const me = RUN_FROM(game);
    game.player.place(me.x, me.z, me.yaw, me.y); game.follow.snapBehind(me.yaw);
    const e = hold(game, 'erez', ERZ_FROM(game)); game.paint.addAlly(e, COLORS.erez);
    game.sound?.music?.(cp >= 3 ? 'epic' : null, { fade: 0.4 });
  }
  game.paint.reset(); freshMarks(game);
}

const standingAt = (game, list) => list.filter((gd) => !gd.marked && gd.npc.visible);
const nearMachine = (game, gd) => near(gd.npc.pos, CONSOLE(game), AT_MACHINE);

// the run's pieces: the front behind them, two disturbances crossing the run-up, the sky starting to crack
function setRun(m, game) {
  const me = RUN_FROM(game), p = game.player.pos;
  if (!near(p, me, 3)) { game.player.place(me.x, me.z, me.yaw, me.y); game.follow.snapBehind(me.yaw); }
  m.front?.dispose();
  m.front = new Front(game, { x: FRONT_X, z0: FRONT_Z0, z1: FRONT_Z1, y: Q(game).y, speed: FRONT_SPEED, height: 15 });
  m.kit?.dispose(); m.kit = new Kit();
  m.kit.add(
    new Disturbance(game, { path: [{ x: 1193.5, z: 185.5 }, { x: 1193.5, z: 201.5 }], speed: 2.8, r: 0.8, marks: false, knock: 2.2 }),
    new Disturbance(game, { path: [{ x: 1204.5, z: 201.5 }, { x: 1204.5, z: 185.5 }], speed: 3.3, r: 0.8, marks: false, knock: 2.2 }),
  );
  Q(game).portalAt.mark(true);
  game.rift?.crack(0.45, 1.5);
}

export default {
  id: 'gateback', chapter: 10, number: 8, title: 'פותחים את השער בחזרה', requires: ['secret'], follows: true,
  where: 'במצודה ובחורשה',
  startAt: (game) => { const Z = CIT(game); return Z ? { ...Z.mainHall.inside, r: 2 } : null; },
  reward: { money: 1000, text: 'הדרך חזרה נפתחה · 1,000 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; m.waves = []; },
  // the start, from anywhere: on foot, out of the other dimension and its white, in the main hall
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    game.player.crawl?.(false);
    game.rift?.clear(); if (game.dimensionName) game.dimension(null); game.overlay?.white?.(0);
    const p = IDO_AT(game); game.player.place(p.x, p.z, p.yaw, p.y); game.follow.snapBehind(p.yaw);
  },
  // Ido marked three times at the machine: again from the start of the defence
  failIf(m, game) {
    if (m.stepIndex === 1 && !m.s.full && game.playingAs === 'ido' && game.paint.hits >= OUT_AT) return IDO_OUT;
    return null;
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    m.front?.update(dt);
    m.kit?.update(dt);
    // Muller stays at the console while the machine is his (nobody walks him off it)
    if (m.stepIndex <= 1) { const n = game.npcs.get('muller'), c = CONSOLE(game); if (n?.visible) { n.target = null; n.lookAt(c.x + 2, c.z); } }
  },
  cleanup(m, game) {
    const carry = !!m.done && handsTo(game, 'return');
    m.small?.dispose(); m.small = null;
    clearScene(m, game);
    machineConsole(game, false);
    offBoard(game, ORDER);
    if (carry) {
      // mission 55 carries on: still in the grove's dimension, all white, Nehorai and Erez where the portal took
      // them (55's crossing brings them out on the citadel's floor). The grove's portal goes under the white
      m.gate?.dispose(); m.gate = null;
      game.overlay?.white?.(1);
      game.rift?.crack(0, 0.1);
      citadelBack(game);
      return;
    }
    m.gate?.dispose(); m.gate = null;
    groveBack(game);
    citadelBack(game);
    if (game.playingAs !== 'nehorai') become(game, 'nehorai');
    bandage(game.nehorai, false);
    nehoraiAway(game);
    for (const id of FIGHTERS.concat('muller', 'erez')) game.npc(id).model.setPose(null);
    endCrew(game);
    game.hud.setPursuit(null);
  },

  steps: [
    { // 0: the citadel, the ordinary world: where are they, and the weak signal
      objective: 'במצודה · מולר מחפש את נהוראי וארז',
      enter(m, game) {
        stage(m, game, 0);
        game.cutscene = true; game.hud.setCinematic(true);
        const c = CONSOLE(game), y = c.y;
        game.follow.shot({ ...hall(game, 101.5, 6.5), y: y + 2.3 }, { x: c.x, y: y + 1.5, z: c.z }, 9999);
        const Z = CIT(game);
        m.beats = beats(game, [
          ['wait', 0.6],
          ['say', [G.idoTell]],
          ['say', [G.mullerWorking]],
          ['say', [G.idoFaster]],
          ['do', () => { Z.mainHall.screen.show('data', { progress: 0.2 }); game.sound?.radioStatic?.(true, { level: 0.08 }); game.hud.toast('אות חלש מהצד השני', 1800); }],
          ['say', SIGNAL],
          ['do', () => { game.sound?.radioStatic?.(false); Z.mainHall.screen.show('portal'); game.sound?.beep?.(); }],
          ['say', [G.mullerFound]],
          ['do', () => { const p = game.player.pos; game.follow.shot({ x: p.x - 3.4, y: p.y + 2, z: p.z + 2.6 }, { x: c.x, y: y + 1.6, z: c.z }, 9999); }],
          ['say', PLAN],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the defence at the machine, played as Ido
      objective: 'להגן על המכונה עד שמולר מסיים', checkpoint: true,
      enter(m, game) {
        freshMarks(game); upAgain(game);
        const P = POSTS(game);
        for (const id of FIGHTERS) game.squad.send(id, P[id], { label: SIDE_NAMES[id] });
        CIT(game).mainHall.screen.show('engine', { progress: 0 });
        game.sound?.music?.('action', { fade: 0.6 });
        m.waves = []; m.s.prog = 0; m.s.next = 0; m.s.shown = -1; m.s.under = false; m.s.full = false; m.s.half = false; m.s.wait = 2.5;
      },
      target(m, game) {
        if (m.s.full) return null;
        const live = m.waves.flatMap((w) => standingAt(game, w.out));
        const close = live.filter((gd) => nearMachine(game, gd)).map((gd) => gd.npc.id);
        return nearestGuard(game, close.length ? close : WAVE_IDS) || { ...CONSOLE(game), r: 1.6 };
      },
      update(m, game, dt) {
        const s = m.s, Z = CIT(game), W = WAVES(game);
        for (const w of m.waves) w.update(dt);
        if (!s.full) wipeOff(game, dt, 7);
        // the hall is long: they run in to their places (and stop where they first see one of the gang)
        for (const w of m.waves) for (const gd of w.out) if (!gd.marked && gd.npc.target && !gd.alerted) gd.npc.target.run = true;
        // the next side comes in as the charge passes its mark (the first after a breath)
        if ((s.wait -= dt) <= 0 && s.next < W.length && s.prog >= W[s.next].at) {
          const w = W[s.next++];
          upAgain(game); // the friends who sat down wipe it off and are back in it
          m.waves.push(new Wave(game, w.list, { gap: 1.8, hot: false }));
          later(m, game, w.call);
        }
        const live = m.waves.flatMap((w) => standingAt(game, w.out));
        s.under = live.some((gd) => nearMachine(game, gd));
        if (!s.full) {
          if (!s.under && s.wait <= 0) s.prog = Math.min(1, s.prog + dt / FILL);
          const pct = Math.floor(s.prog * 100);
          if (pct !== s.shown) {
            s.shown = pct; Z.mainHall.screen.show('engine', { progress: s.prog }); machineConsole(game, true).set(s.prog);
            // the way back starts to show at the anchor, small, growing with the charge
            if (s.prog >= 0.08 && !m.small) { m.small = new Portal(game, { at: GATE_AT(game), r: 0.5, yaw: -Math.PI / 2, rumble: 0.2, sound: false }); m.small.open(1); }
            if (m.small && pct % 5 === 0) m.small.grow(0.5 + s.prog * 1.1, 0.6);
          }
          if (s.prog >= 0.5 && !s.half) { s.half = true; later(m, game, HALF); }
          game.hud.setPursuit(`המכונה · ${pct}%${s.under ? ' · נעצרה' : ''}`);
          say(m, game, s.under ? `להגן על המכונה · יש להם קו אש עליה — לסמן אותם! · ${pct}% · סומנת ${game.paint.hits}/3`
            : `להגן על המכונה עד שמולר מסיים · ${pct}% · סומנת ${game.paint.hits}/3`);
          if (s.prog >= 1 && s.next >= W.length) {
            s.full = true;
            game.hud.setPursuit('המכונה · 100%');
            const P = game.paint;
            m.beats = beats(game, [
              ['say', FULL],
              ['do', () => { for (const gd of m.waves.flatMap((w) => standingAt(game, w.out))) P.markGuard(gd, 'friends'); game.sound?.chime?.(true); }],
              ['wait', 1.2],
            ]);
            say(m, game, 'המכונה טעונה · מולר שולח להם אות');
          }
        }
        if (s.full) { m.beats?.update(dt); if (m.beats?.done) return 'next'; }
        return null;
      },
      exit(m, game) { m.beats = null; game.hud.setPursuit(null); },
    },
    { // 2: back in the grove, as Nehorai: the radio, the energy point marked
      objective: 'בחורשה · מכשיר הקשר חוזר לחיים',
      enter(m, game) {
        game.cutscene = true; game.hud.setCinematic(true);
        const live = attempt(game, m);
        m.s.there = false;
        game.hud.fade('ובינתיים, בחורשת הזיתים', () => {
          if (!live()) return;
          stage(m, game, 2);
          m.s.there = true;
          game.cutscene = true; game.hud.setCinematic(true);
          const p = RUN_FROM(game), gate = PORTAL(game);
          game.follow.shot({ x: p.x + 3.2, y: p.y + 1.7, z: p.z + 2.4 }, { x: p.x, y: p.y + 1.4, z: p.z - 0.4 }, 9999);
          m.beats = beats(game, [
            ['wait', 0.8],
            ['do', () => { game.sound?.radioStatic?.(true, { level: 0.12 }); game.hud.toast('קשר · רעש… ואז קול', 1800); }],
            ['wait', 0.8],
            ['do', () => game.sound?.radioStatic?.(false)],
            ['say', [RADIO(G.mullerHear)]],
            ['say', [G.getUsOut]],
            ['say', [RADIO(G.mullerPoint)]],
            ['do', () => {
              Q(game).portalAt.mark(true); game.hud.toast('נקודת האנרגיה מסומנת', 2200); game.sound?.chime?.(true);
              game.follow.shot({ x: p.x - 2.5, y: p.y + 2.6, z: p.z + 1.2 }, { x: gate.x, y: gate.y + 2.5, z: gate.z }, 9999);
            }],
            ['wait', 1.2],
            ['say', SEEN],
          ]);
        }, 1200);
      },
      target: (m, game) => ({ ...PORTAL(game), r: 2 }),
      update(m, game, dt) { if (!m.s.there) return null; m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 3: the run to the energy point, the dimension breaking behind them
      objective: 'לרוץ אל נקודת האנרגיה', checkpoint: true,
      enter(m, game) {
        setRun(m, game);
        m.s.go = 1.6; m.s.near = false;
        // a look back first: the wall of broken light rising at the far side of the clearing (then the run is his)
        const me = game.player.pos;
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: me.x + 7, y: me.y + 4.4, z: me.z + 3.2 }, { x: FRONT_X, y: me.y + 4.5, z: (FRONT_Z0 + FRONT_Z1) / 2 }, 9999);
        game.sound?.music?.('epic', { fade: 0.6 });
        const e = game.npc('erez'), to = ERZ_END(game);
        e.target = null; e.model.setPose(null);
        m.s.erezGo = 0.5; m.s.erezTo = to;
        later(m, game, BREAK);
      },
      target: (m, game) => ({ ...PORTAL(game), r: 2.2 }),
      update(m, game, dt) {
        const s = m.s, F = m.front, me = game.player.pos, e = game.npc('erez');
        if (s.go > 0) {
          if ((s.go -= dt) > 0) return null;
          F.go = true;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        }
        if (s.erezGo > 0 && (s.erezGo -= dt) <= 0) e.walkTo(s.erezTo.x, s.erezTo.z, { run: true, near: 0.6, onArrive: () => e.lookAt(PORTAL(game).x, PORTAL(game).z) });
        // the front never takes Erez: he runs ahead of it (and is put ahead of it if anything held him)
        if (F.caught(e.pos, 2)) { e.place(F.x + 4, e.pos.z, Math.PI / 2, null); e.walkTo(s.erezTo.x, s.erezTo.z, { run: true, near: 0.6 }); }
        const lead = F.lead(me), gate = PORTAL(game), left = Math.hypot(gate.x - me.x, gate.z - me.z);
        game.rift?.crack(Math.min(1, 0.45 + 0.55 * Math.max(0, 1 - left / 45)), 0.6);
        game.hud.setPursuit(`החזית · ${Math.max(0, Math.round(lead))} מ׳ מאחוריך`);
        say(m, game, `לרוץ אל נקודת האנרגיה · עוד ${Math.round(left)} מ׳`);
        if (F.caught(me)) return `fail:${RUN_OUT}`;
        return left < 4.6 ? 'next' : null;
      },
      exit(m, game) { game.hud.setPursuit(null); game.cutscene = false; game.hud.setCinematic(false); },
    },
    { // 4: the portal opens between the olive trees; run and leap into it
      objective: 'לרוץ ולקפוץ לתוך הפורטל',
      enter(m, game) {
        const F = m.front, e = game.npc('erez'), end = ERZ_END(game), gate = PORTAL(game);
        if (F) F.go = false;
        if (!near(e.pos, end, 2.5)) { e.target = null; e.place(end.x, end.z, end.yaw, end.y); }
        e.lookAt(gate.x, gate.z);
        game.cutscene = true; game.hud.setCinematic(true);
        m.s.scene = true; m.s.in = false; m.s.white = false;
        const live = attempt(game, m);
        game.playCutscene('c10-gate', () => Promise.resolve()).then(() => {
          if (!live()) return;
          game.cutscene = true; game.hud.setCinematic(true);
          const me = game.player.pos;
          game.follow.shot({ x: me.x - 5.5, y: me.y + 2.4, z: me.z + 3.2 }, { x: gate.x, y: gate.y + 2.2, z: gate.z }, 9999);
          m.gate = new Portal(game, { at: gate, r: 2.5, yaw: -Math.PI / 2, rumble: 0.6 });
          m.gate.open(1.4);
          m.beats = beats(game, [['wait', 1.8], ['say', [G.erezNow]], ['say', [G.yalla]]]);
        });
      },
      target(m, game) { return m.s.scene || m.s.in ? null : { ...LEAP_FROM(game), r: 1.2 }; },
      interaction(m, game) { return m.s.scene || m.s.in ? null : m.kit?.interaction(game) || null; },
      update(m, game, dt) {
        const s = m.s, F = m.front, me = game.player.pos;
        if (s.scene) {
          m.beats?.update(dt);
          if (!m.beats?.done) return null;
          s.scene = false; m.beats = null;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
          if (F) { F.speed = FRONT_CREEP; F.go = true; }
          // the leap: from the run-up into the middle of the gate (Erez goes with him, side by side)
          const gate = PORTAL(game);
          m.kit.add(new Leap(game, {
            from: LEAP_FROM(game), to: { x: gate.x + 0.1, z: gate.z, y: gate.y }, label: 'לקפוץ לתוך הפורטל', near: 2.6, arc: 1.3, seconds: 0.85,
            onStart: () => { const e = game.npc('erez'); s.jump = { t: 0, a: { x: e.pos.x, z: e.pos.z, y: e.pos.y }, b: { x: gate.x - 0.3, z: gate.z - 1.1, y: gate.y } }; },
            onLand: () => { s.in = true; },
          }));
        }
        // Erez's leap beside him
        if (s.jump) {
          const j = s.jump, e = game.npc('erez'), k = Math.min(1, (j.t += dt) / 0.85);
          e.target = null;
          e.place(j.a.x + (j.b.x - j.a.x) * k, j.a.z + (j.b.z - j.a.z) * k, Math.PI / 2, j.a.y + (j.b.y - j.a.y) * k + 4 * k * (1 - k) * 1.3);
          e.model.setPose(k < 1 ? 'tuck' : null);
          if (k >= 1) s.jump = null;
        }
        // running straight into it counts as the leap
        if (!s.in && m.gate?.contains(me)) s.in = true;
        if (s.in && !s.whiteOn) {
          s.whiteOn = true;
          game.sound?.thunder?.(0.7); game.follow.shake?.(0.5);
          const live = attempt(game, m);
          (game.overlay?.whiteOut(0.6) || Promise.resolve()).then(() => { if (live()) s.white = true; });
        }
        if (!s.in && F?.caught(me)) return `fail:${RUN_OUT}`;
        return s.white ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};

// on completion the scene is left only for mission 55, which carries straight on (never after a replay)
function handsTo(game, id) { const M = game.missions, n = M.next(); return !!M.carrying && n?.id === id && !!n.follows && M.ready(n); }
