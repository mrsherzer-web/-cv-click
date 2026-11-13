// Chapter ten, mission 1, "השקט לפני הסוף". 05:30 at the safe house: the sun coming up over the hills, Nehorai
// on the balcony with chapter nine's bandage still on, looking east. Erez comes out to him; Ido runs in: they
// have to see this. Inside, the threat map on the screen: Muller has found what the Shadow has started — a huge
// experimental machine in his citadel that opens gates between universes, to take the whole region with it.
// The camera passes over every friend; "היום אנחנו מסיימים את זה. כולם חוזרים הביתה."; the music swells; the
// card. Then it is the player's: the gear from the rack (everyone arms), one of three markers off the table (it
// can be changed until the car), a word with Erez, Ido and Muller (the others answer too), and into the Renault
// while the gang boards the two other cars: the convoy leaves (mission 48 carries on in the car).
// Nobody of the gang betrays and nobody of the gang dies. Invented, all of it.
import { near, say } from './missions.js';
import { L, CARDS } from './lines10.js';
import { KINDS } from '../combat/paint.js';
import { Work } from './firestorm.js';
import {
  TEAM, NAMES, attempt, HOME, carOf, doorOf, aboard, parkYard, dawn, hurt, holdBuddies, standAt,
  armFriends, armNehorai, markerTable, Walk, Chatter, beats, hush, unboardAll, endCrew, dropGangCars, gangCars, handsTo,
} from './infinity-a.js';

// ---------- lines of my own (the user's are in lines10.js) ----------
const MULLER_FOUND = [
  ['מולר', 'תסתכלו על האדום. כל כתם כזה זה מקום שהמכונה של הצל כבר נוגעת בו.'],
  ['מולר', 'במצודה שלו הוא הפעיל מכונה ניסיונית ענקית. היא פותחת שערים בין יקומים.'],
  ['מולר', 'והוא רוצה לפתוח אותם על כל האזור. קציר, הכבישים, הכול — שלו.'],
];
const GEAR_HINT = [['ארז', 'הציוד בחדר הציוד, אחי. אתה מחלק, אנחנו לוקחים.']];
const GEARED = [['דולב', 'כל אחד והמרקר שלו. ובשבילך שמתי שלושה על השולחן. תבחר.'], ['דולב', 'ותבחר מהר. אני כבר מתגעגע למיטה.']];
const CHOSE = {
  quick: [['דולב', 'המהיר. הרבה צבע, מעט סבלנות. מתאים לך.']],
  balanced: [['דולב', 'המאוזן. הישן והטוב. לא מחליפים מנצח.']],
  long: [['דולב', 'הארוך. מרחוק ובדיוק. הצל לא יבין מאיפה זה בא.']],
};
const SWAPPED = [['דולב', 'החלפת? בסדר. רק לא עוד פעם, הוא כבר מכיר אותך.']];
const TALK_HINT = [['ארז', 'לפני שיוצאים, תעבור על כולם. אני ליד הרנו, עידו ליד רכב שתיים, מולר מול המסך.']];
const DESC = {
  quick: 'מהיר · 6 כדורים, יורה ברצף כל עוד מחזיקים, טעינה מהירה. טווח קצר',
  balanced: 'מאוזן · 8 כדורים, כדור בכל לחיצה, טווח בינוני. המרקר שאתה מכיר',
  long: 'ארוך ומדויק · 5 כדורים, טווח ארוך, כל פגיעה שווה כפול. איטי',
};
// what each says he will do today: Erez at his side, Ido leading the second team, Muller on the Shadow's systems
const TALK = {
  erez: [['ארז', 'היום אני לידך. כל הדרך, כל דלת, כל קומה.'], ['נהוראי', 'כמו תמיד.'], ['ארז', 'כמו תמיד. רק תנסה לא לחזור עם עוד תחבושת. נגמרו לנו.']],
  ido: [['עידו', 'אני מוביל את הצוות השני. יונתי והדר איתי ברכב שתיים.'], ['עידו', 'אתם נכנסים מקדימה, אנחנו פותחים לכם את הדרך מהצד.'], ['נהוראי', 'תשמור עליהם, עידו.'], ['עידו', 'אני? אני הכי זהיר שיש. כמעט תמיד.']],
  muller: [['מולר', 'אני על המערכות של הצל. מצלמות, דלתות, קשר. מה שאפשר לפתוח מרחוק, אני פותח.'], ['מולר', 'אני נוסע ברכב שלוש עם הלפטופ. אם יש עוד דרך למצודה, אני אמצא אותה.'], ['נהוראי', 'אתה המוח של המבצע, מולר.'], ['מולר', 'אני יודע. אבל נחמד לשמוע.']],
  yonati: [['יונתי', 'אני עם עידו ברכב שתיים. מישהו צריך לוודא שהוא לא מנווט אותנו לים.']],
  avraham: [['אברהם', 'אני איתכם ברנו, מאחורה. שמתי בבגאז׳ עוד צבע, ליתר ביטחון.']],
  dolev: [['דולב', 'רכב שלוש, עם מולר וליאם. ואם מישהו שואל, אני הייתי ער ראשון.']],
  hadar: [['הדר', 'Bro, אני עם עידו. צוות שני, אבל אף פעם לא במקום השני.']],
  liam: [['ליאם', 'אחים, הקשר בדוק. שלושה רכבים, ערוץ אחד. אף אחד לא נשאר בלי קול.']],
};
const MUST = ['erez', 'ido', 'muller'];
const BOARD = [['ארז', 'כולם לרכבים! יוצאים!'], ['עידו', 'רכב שתיים, אחריי!']];
const LEFT = 'התרחקת מבית המסתור. ארז: "המבצע יוצא מכאן, אחי. חוזרים לחצר, כולם מחכים לך."';
const FAR = 110;

// ---------- where everyone stands (world spots in the safe house: the house x 626..646, z -185..-166; the TV on
// the living room's west wall at x 626.2; the gear room x 637..646, z -185..-177, its door at (640, -177); the
// hallway z -177..-173 out to the front door at (646, -175); the balcony an L round the north-east corner, its
// door in the living room's north wall at (635.6, -185)) ----------
const W = -Math.PI / 2, E = Math.PI / 2, N = Math.PI;
// inside, in front of the screen behind the main sofa, for the scene (all facing the screen)
const SCENE = {
  nehorai: [634.5, -178.3], ido: [634.5, -177.0], erez: [634.5, -179.6], liam: [634.5, -180.9],
  hadar: [635.9, -177.6], yonati: [635.9, -178.9], avraham: [635.9, -180.2], dolev: [635.9, -181.5],
};
const MULLER_TV = { x: 627.1, z: -180.5, yaw: E };
// after the card: waiting for their markers in the north half of the living room (clear of the way out)
const WAIT = {
  erez: [636.1, -180.6, W], ido: [634.7, -181.3, E], yonati: [636.1, -182.0, W], avraham: [634.7, -182.6, E], hadar: [633.6, -183.6, E], liam: [636.7, -183.0, W],
};
const ME_PLAY = { x: 634.6, z: -178.4, yaw: E };
const DOLEV_TABLE = { x: 643.6, z: -181.0, yaw: W };   // at the gear table's east end: he lays the markers out
const ME_TABLE = { x: 641.5, z: -179.8, yaw: N };      // on the table's south side, facing it
// the ways out of the house to the yard
const FROM_LIVING = [{ x: 636.4, z: -176.0 }, { x: 637.5, z: -175.2 }, { x: 641.5, z: -175 }, { x: 644.8, z: -175 }, { x: 647.6, z: -175 }, { x: 655, z: -172 }];
const FROM_GEAR = [{ x: 641.5, z: -179.4 }, { x: 640, z: -177.8 }, { x: 640, z: -176.3 }, { x: 641.5, z: -175 }, { x: 644.8, z: -175 }, { x: 647.6, z: -175 }, { x: 655, z: -172 }];

const busy = (m) => (m.walks || []).filter((w) => !w.done);
function walkTo(m, game, id, points, opts) { const w = new Walk(game, id, points, opts); m.walks.push(w); return w; }
const face = (n, x, z) => n.lookAt(x, z);
// a fixed camera, cut to at once (follow.shot alone eases over from where the camera was, which on a balcony
// or between the gang would sweep it through somebody's head)
function cut(game, from, look) {
  game.follow.shot(from, look, 9999);
  game.camera.position.set(from.x, from.y, from.z); game.camera.lookAt(look.x, look.y, look.z);
}
// a camera on someone's face from `d` in front of him (a little to his right), looking at his head; `pan`: eased
// over from the shot before (the camera passing from one friend to the next)
function faceShot(game, n, { d = 1.5, side = 0.35, h = 1.66, pan = false } = {}) {
  const p = n.pos ?? n, yaw = n.yaw ?? 0, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), y = p.y;
  const from = { x: p.x + fx * d + rx * side, y: y + h, z: p.z + fz * d + rz * side }, look = { x: p.x, y: y + h - 0.12, z: p.z };
  if (pan) game.follow.shot(from, look, 9999); else cut(game, from, look);
}

// ---------- the scene's stages ----------
// what every checkpoint starts from: the morning, the house as built, the three vehicles in the yard, nobody in a
// car, the gang out of the squad and unarmed, Nehorai himself with chapter nine's bandage, the marker table ready
function base(m, game) {
  const h = HOME(game);
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  m.beats?.cancel(); m.beats = null; m.work?.cancel(); m.work = null;
  for (const w of m.walks || []) w.cancel(); m.walks = []; m.chat?.clear();
  if (game.mode === 'car') game.exitCar();
  game.fx.resetAtmosphere(); game.fx.clear?.();
  dawn(game);
  h.reset(); h.screen.show('threat');
  unboardAll(game);
  game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
  parkYard(game);
  game.squad.dismiss(); game.paint.dispose();
  holdBuddies(game, true);
  if (game.playingAs !== 'nehorai') game.playAs('nehorai');
  game.nehorai.setPose(null); hurt(game, true);
  m.table?.dispose();
  const t = h.gear.table; m.table = markerTable(game, { x: t.x, y: t.y + 0.02, z: t.z }); m.table.show(false);
}
const me = (game, at) => { game.player.place(at.x, at.z, at.yaw, HOME(game).y); game.follow.snapBehind(at.yaw); };

// the balcony: Nehorai at the east rail facing the sunrise, the gang inside (Erez and Ido on their way out)
function balcony(m, game) {
  const h = HOME(game), b = h.balcony;
  base(m, game);
  game.cutscene = true; game.hud.setCinematic(true); // (base let any scene go: this one is just beginning)
  me(game, b);
  for (const id of TEAM) { const [x, z] = SCENE[id] || [MULLER_TV.x, MULLER_TV.z]; standAt(game, id, { x, z, yaw: W, y: h.y }); }
  standAt(game, 'muller', { ...MULLER_TV, y: h.y }, { idle: 'phone' });
  standAt(game, 'erez', { x: 643.2, z: -186.6, yaw: E, y: h.y });   // round the corner of the balcony, coming
  standAt(game, 'ido', { ...h.balconyDoor.inside, y: h.y });
  h.screen.show('off');
  cut(game, { x: b.x - 2.3, y: h.y + 1.85, z: b.z + 0.55 }, b.look); // over his shoulder, into the sun
  game.sound?.music?.('calm', { fade: 2 });
}
// inside, in front of the threat map: everyone behind the main sofa, Muller at the screen
function inside(m, game) {
  const h = HOME(game);
  for (const w of m.walks) w.cancel(); m.walks = [];
  const [x, z] = SCENE.nehorai; me(game, { x, z, yaw: W });
  for (const id of TEAM) if (SCENE[id]) standAt(game, id, { x: SCENE[id][0], z: SCENE[id][1], yaw: W, y: h.y });
  standAt(game, 'muller', { ...MULLER_TV, y: h.y }, { idle: null, pose: null });
  h.screen.show('threat');
  cut(game, { x: 630.9, y: h.y + 1.7, z: -177.5 }, { x: h.tv.x, y: h.tv.y - 0.15, z: h.tv.z - 0.5 }); // the map, Muller beside it
}
// control back: Nehorai in the living room, the gang waiting for their markers, Muller at the screen, Dolev at
// the gear table; the gear still on the rack
function play(m, game) {
  const h = HOME(game);
  for (const w of m.walks) w.cancel(); m.walks = [];
  me(game, ME_PLAY);
  for (const [id, [x, z, yaw]] of Object.entries(WAIT)) standAt(game, id, { x, z, yaw, y: h.y }, { idle: 'arms' });
  standAt(game, 'muller', { ...MULLER_TV, y: h.y }, { idle: 'phone' });
  standAt(game, 'dolev', { ...DOLEV_TABLE, y: h.y });
  h.screen.show('threat');
  game.follow.override = null;
  game.sound?.music?.('calm', { fade: 1.5 });
  m.s.play = true;
}
// where the friends do their own things once armed: Erez at the Renault, Avraham at its boot; Ido briefing Yonati
// and Hadar at car two; Liam on the radios at car three; Muller at the screen on the Shadow's systems; Dolev at the
// gear table (he laid the markers out)
function spots(game) {
  const [two, three] = gangCars(game), r = game.car;
  const at = (car, x, z) => { const p = car.local(x, z); return { x: p.x, z: p.z }; };
  return {
    erez: { ...at(r, -2.3, -0.4), idle: 'arms', face: HOME(game).outside },
    avraham: { ...at(r, 0.3, -3.1), pose: 'carry', face: r.pos },
    ido: { ...at(two, -2.3, 0.7), face: at(two, -3.4, -0.8) },
    yonati: { ...at(two, -3.4, -0.8), idle: 'arms', face: at(two, -2.3, 0.7) },
    hadar: { ...at(two, -2.2, -1.9), face: at(two, -2.3, 0.7) },
    liam: { ...at(three, -2.2, 0.8), idle: 'phone', face: three.pos },
    muller: { ...MULLER_TV, idle: 'phone' },
    dolev: { ...DOLEV_TABLE },
  };
}
function stations(m, game, { walk = true } = {}) {
  const h = HOME(game), S = spots(game);
  for (const id of TEAM) {
    const s = S[id], settle = (n) => { n.idle = s.idle ?? null; n.posed = false; if (s.pose) n.model.setPose(s.pose); if (s.face) face(n, s.face.x, s.face.z); else n.yaw = s.yaw ?? n.yaw; };
    if (id === 'muller' || id === 'dolev') { const n = game.npc(id); if (!walk || near(n.pos, s, 0.6)) { standAt(game, id, { ...s, y: h.y }); settle(n); } continue; }
    if (!walk) { const n = standAt(game, id, { ...s, y: h.y }); settle(n); continue; }
    walkTo(m, game, id, [...FROM_LIVING, { x: s.x, z: s.z }], { run: false, hurry: true, onDone: settle });
  }
}

// ---------- the choice of marker (step 2, and again until the car) ----------
function pick(m, game) {
  const t = m.table;
  if (!t?.group.visible || game.mode !== 'foot' || game.cutscene) return null;
  const it = t.nearest(game.player.pos, 1.3);
  if (!it) return null;
  return { label: `לקחת · ${KINDS[it.kind].name}`, priority: 7, run: () => take(m, game, it.kind) };
}
function take(m, game, kind) {
  const P = game.paint, again = !!m.s.kind;
  P.setKind(kind); armNehorai(game);
  m.table.take(kind);
  m.s.kind = kind;
  game.sound?.chime?.(true);
  game.hud.toast(`המרקר שלך: ${KINDS[kind].name}`, 1800);
  m.chat.now(again ? SWAPPED : CHOSE[kind]);
}
// the one-line description of the marker he stands at
function describe(m, game) { const it = m.table?.group.visible && game.mode === 'foot' ? m.table.nearest(game.player.pos, 1.3) : null; return it ? DESC[it.kind] : null; }

// ---------- talking to the friends (step 3) ----------
function talkPrompt(m, game) {
  if (game.mode !== 'foot' || m.s.talking || game.cutscene) return null;
  let best = null, bd = 2.2;
  for (const id of TEAM) {
    const n = game.npc(id); if (!n.visible || n.inCar || m.s.talked[id]) continue;
    const d = Math.hypot(game.player.pos.x - n.pos.x, game.player.pos.z - n.pos.z);
    if (d < bd) { bd = d; best = id; }
  }
  if (!best) return null;
  return { label: `לדבר עם ${NAMES[best]}`, priority: 6, run: () => talk(m, game, best) };
}
function talk(m, game, id) {
  const live = attempt(game, m), n = game.npc(id);
  m.s.talking = id; m.chat.clear();
  n.lookAt(game.player.pos.x, game.player.pos.z);
  game.dialogue.play(TALK[id]).then(() => { if (!live()) return; m.s.talked[id] = true; m.s.talking = false; const S = spots(game)[id]; if (S?.face) face(n, S.face.x, S.face.z); });
}
const told = (m) => MUST.filter((id) => m.s.talked[id]).length;

export default {
  id: 'dawn', chapter: 10, number: 1, title: 'השקט לפני הסוף', requires: ['together'], opens: true,
  where: 'בבית המסתור',
  startAt: (game) => { const h = HOME(game); return h ? { x: h.balconyDoor.inside.x, z: h.balconyDoor.inside.z, y: h.y } : null; },
  reward: { money: 600, text: 'יוצאים למבצע האחרון · 600 ₪' },

  setup(m, game) { m.s = {}; m.walks = []; m.chat = new Chatter(game); m.table = null; },
  tick(m, game) { hush(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const h = HOME(game), d = h.balconyDoor.inside; game.player.place(d.x, d.z, d.yaw, h.y); game.follow.snapBehind(d.yaw); },
  failIf(m, game) {
    if (!m.s.play) return null;
    const h = HOME(game), p = game.pos; // on foot or in the Renault: the operation leaves together or not at all
    return Math.hypot(p.x - h.x, p.z - h.z) > FAR ? LEFT : null;
  },
  restore(m, game, cp) {
    const h = HOME(game);
    base(m, game);
    m.s = { talked: {}, talking: false, kind: null, play: false };
    if (cp === 0) return; // the scene stages itself
    play(m, game);
    if (cp >= 3) {
      // the gear handed out, the markers on the table, his own in his hand (the kind he chose is in the progress)
      h.gear.take();
      armFriends(game);
      m.table.show(true);
      if (game.progress.marker && KINDS[game.progress.marker]) { m.s.kind = game.progress.marker; m.table.take(m.s.kind); }
      armNehorai(game);
      stations(m, game, { walk: false });
      me(game, ME_TABLE);
    }
  },
  cleanup(m, game) {
    const h = HOME(game), carry = !!m.done && handsTo(game, 'lastconvoy');
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    m.beats?.cancel(); m.beats = null; m.work?.cancel(); m.work = null;
    for (const w of m.walks || []) w.cancel(); m.walks = []; m.chat?.clear();
    m.table?.dispose(); m.table = null;
    for (const id of TEAM) { const n = game.npc(id); n.idle = null; n.posed = false; n.model.setPose(null); }
    if (carry) {
      // the convoy leaves: the gang in the three cars, the morning and the bandage kept; the house as it was
      h.screen.show('off'); h.gear.reset();
      return;
    }
    game.fx.resetAtmosphere();
    if (game.mode === 'car') game.exitCar();
    unboardAll(game); endCrew(game); dropGangCars(game);
    h.reset(); hurt(game, false); holdBuddies(game, false);
    game.sound?.music?.(null, { fade: 1 });
  },

  steps: [
    { // 0: 05:30 on the balcony; inside, the threat map; the camera over every friend; the card
      objective: 'השקט לפני הסוף',
      enter(m, game) {
        const live = attempt(game, m);
        if (game.mode === 'car') game.exitCar();
        game.cutscene = true; game.hud.setCinematic(true);
        game.playCutscene('c10-dawn', () => Promise.resolve()).then(() => {
          if (!live()) return;
          game.cutscene = true; game.hud.setCinematic(true);
          game.hud.fade('05:30 · בית המסתור', () => { if (!live()) return; balcony(m, game); m.beats = beats(game, scene(m, game, live)); }, 1600);
        });
      },
      update(m, game, dt) {
        for (const w of m.walks) w.update(dt);
        m.beats?.update(dt);
        return m.beats?.done ? 'next' : null;
      },
      exit(m, game) {
        m.beats = null;
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        if (!m.s.play) play(m, game);
        game.follow.snapBehind(game.player.yaw);
        m.chat.add(GEAR_HINT);
      },
    },
    { // 1: the gear from the rack; everyone arms
      objective: 'לאסוף את הציוד · חדר הציוד', checkpoint: true,
      enter(m, game) {
        const h = HOME(game), live = attempt(game, m);
        m.work = new Work(game, { at: h.gear, seconds: 2.5, label: 'לאסוף את הציוד', pill: 'מחלקים ציוד', near: 1.6, onDone: () => {
          if (!live()) return;
          h.gear.take();
          armFriends(game);
          m.table.show(true);
          game.hud.toast('הציוד אצלכם · כל אחד והמרקר שלו', 2200);
          m.chat.now(GEARED);
          stations(m, game);
        } });
      },
      target(m, game) { const g = HOME(game).gear; return { x: g.x, z: g.z, y: g.y, r: 1.2 }; },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      update(m, game, dt) { m.work?.update(dt); m.chat.update(dt); return m.work?.done ? 'next' : null; },
    },
    { // 2: one of the three markers off the table
      objective: 'לבחור רובה · שלושה מרקרים על השולחן',
      target(m, game) { const t = HOME(game).gear.table; return { x: t.x, z: t.z + 1.1, y: HOME(game).y, r: 1.0 }; },
      interaction: (m, game) => pick(m, game),
      update(m, game, dt) {
        for (const w of m.walks) w.update(dt);
        m.chat.update(dt);
        say(m, game, describe(m, game) || 'לבחור רובה · שלושה מרקרים על השולחן');
        return m.s.kind ? 'next' : null;
      },
    },
    { // 3: a word with Erez, Ido and Muller (the others answer too)
      objective: 'לדבר עם החברים (0/3)', checkpoint: true,
      enter(m, game) { m.s.talked ||= {}; m.s.talking = false; m.chat.add(TALK_HINT); },
      target(m, game) {
        if (m.s.talking) return null;
        const id = MUST.find((k) => !m.s.talked[k]); if (!id) return null;
        const n = game.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 1.4 };
      },
      interaction: (m, game) => talkPrompt(m, game) || pick(m, game),
      update(m, game, dt) {
        for (const w of m.walks) w.update(dt);
        m.chat.update(dt);
        const k = told(m), next = MUST.find((id) => !m.s.talked[id]);
        const where = { erez: 'ארז ליד הרנו', ido: 'עידו ליד רכב שתיים', muller: 'מולר מול המסך בסלון' };
        say(m, game, m.s.talking ? `מדברים עם ${NAMES[m.s.talking]}` : `לדבר עם החברים (${k}/3)${next ? ` · ${where[next]}` : ''}`);
        return k === MUST.length && !m.s.talking ? 'next' : null;
      },
    },
    { // 4: into the Renault; the others into the two other cars
      objective: 'לעלות לרכב המבצע · הרנו בחצר',
      enter(m, game) { m.s.goT = 0; m.s.inCarT = 0; m.chat.now(BOARD); },
      target(m, game) { return game.mode === 'car' ? null : { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 }; },
      interaction: (m, game) => pick(m, game),
      update(m, game, dt) {
        const h = HOME(game);
        m.chat.update(dt);
        // each to his own car's door and in: from the house through the hallway and the front door, a few at a
        // time; from the yard straight there
        m.s.goT += dt;
        TEAM.forEach((id, k) => {
          const n = game.npc(id);
          if (n.inCar || busy(m).some((w) => w.id === id) || m.s.goT < 0.4 + k * 0.4) return;
          const d = doorOf(game, id), car = carOf(game, id), inHouse = h.inside(n.pos.x, n.pos.z);
          const via = !inHouse ? [] : n.pos.x < 637.2 ? FROM_LIVING : FROM_GEAR;
          n.idle = null; n.posed = false; n.model.setPose(null);
          walkTo(m, game, id, [...via, { x: d.x, z: d.z }], { run: true, near: 0.8, hurry: true, label: 'לרכב', onDone: () => { if (!n.inCar) { n.model.setPose(null); n.enter(car); } } });
        });
        for (const w of m.walks) w.update(dt);
        m.walks = busy(m);
        // in the Renault with some still on the way: they run in within a few seconds
        m.s.inCarT = game.mode === 'car' ? m.s.inCarT + dt : 0;
        if (m.s.inCarT > 4) for (const id of TEAM) { const n = game.npc(id); if (!n.inCar) { n.target = null; n.model.setPose(null); n.enter(carOf(game, id)); } }
        const on = TEAM.filter((id) => game.npc(id).inCar).length;
        say(m, game, game.mode === 'car' ? (on < TEAM.length ? `ברנו · החבורה עולה לרכבים (${on}/${TEAM.length})` : 'כולם ברכבים · יוצאים') : `לעלות לרכב המבצע · הרנו בחצר (${on}/${TEAM.length} ברכבים)`);
        return aboard(game) ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};

// the scene, as beats: the balcony, Erez, Ido; inside: the map, Muller, the camera over every friend, the line,
// the music, the card (under its black the gameplay is staged)
function scene(m, game, live) {
  const h = HOME(game), b = h.balcony, side = h.balconySide;
  let t0 = 0;
  const erez = () => game.npc('erez'), ido = () => game.npc('ido');
  const pass = [];
  // the front row from over the sofa, the back row from between the front row's shoulders; Muller at the screen
  const ROW_B = ['hadar', 'yonati', 'avraham', 'dolev'];
  ['ido', 'erez', 'liam', 'dolev', 'avraham', 'yonati', 'hadar', 'muller'].forEach((id, k) => {
    const opts = ROW_B.includes(id) ? { d: 0.95, side: 0 } : { d: 1.5, side: 0 };
    pass.push(['do', () => { const n = game.npc(id); n.model.play?.('nod', { speed: 1.1 }); faceShot(game, n, { ...opts, pan: k > 0 && id !== 'muller' }); }], ['wait', 1.0]);
  });
  return [
    ['do', () => game.hud.banner('פרק 10 · סוף העולם', 'בית המסתור', '05:30 · הזריחה', 2600)],
    ['wait', 2.4],
    ['do', () => { t0 = game.time; walkTo(m, game, 'erez', [{ x: side.x - 0.6, z: side.z - 0.7 }, { x: side.x, z: side.z }], { face: E }); }],
    ['until', () => !busy(m).length || game.time - t0 > 6],
    ['do', () => { const n = erez(); n.target = null; n.place(side.x, side.z, E, h.y); cut(game, { x: b.x + 2.6, y: h.y + 1.7, z: b.z - 0.2 }, { x: b.x - 0.2, y: h.y + 1.5, z: (b.z + side.z) / 2 }); n.lookAt(b.x, b.z); }],
    ['say', [L.dawn.erezAwake, L.dawn.cantSleep, L.dawn.today]],
    ['do', () => { t0 = game.time; walkTo(m, game, 'ido', [{ x: 635.6, z: -186.5 }, { x: 640.5, z: -186.6 }], { run: true, face: E }); cut(game, { x: b.x - 0.6, y: h.y + 1.7, z: b.z - 1.9 }, { x: 637.5, y: h.y + 1.3, z: -186.4 }); }],
    ['until', () => !busy(m).length || game.time - t0 > 4],
    ['say', [L.dawn.idoLook]],
    ['do', () => { m.s.inside = false; game.hud.fade('', () => { if (live()) { inside(m, game); m.s.inside = true; } }, 900); }],
    ['until', () => m.s.inside],
    ['wait', 0.9],
    ['say', MULLER_FOUND],
    ['do', () => faceShot(game, game.npc('muller'), { d: 1.7 })],
    ['say', [L.dawn.mullerMachine]],
    ['do', () => faceShot(game, { pos: game.player.pos, yaw: game.player.yaw })],
    ['say', [L.dawn.notLetting]],
    ...pass,
    ['do', () => { faceShot(game, { pos: game.player.pos, yaw: game.player.yaw }, { d: 1.7, side: -0.3 }); game.sound?.music?.('epic', { fade: 1.2 }); }],
    ['say', [L.dawn.everyoneHome]],
    // the card on black (its timers are real time): the scene goes on after it in game time too, so a page
    // whose timers lag (a slow phone, a busy test) is not held behind the black; the gameplay is staged under it
    ['do', () => { m.s.carded = false; game.overlay.card(CARDS.finalChapter, 3.6, { then: () => { if (live()) play(m, game); } }).then(() => { if (live()) m.s.carded = true; }); }],
    ['wait', 4.3],
    ['do', () => { if (!m.s.carded && game.overlay.titled) game.overlay.card(null); m.s.carded = true; }],
  ];
}
