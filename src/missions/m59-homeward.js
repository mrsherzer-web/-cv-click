// Chapter ten, mission 13, "HOMEWARD BOUND" — and "הגיבורים של קציר". A few hours after the blast: sunset, the
// access road climbing to Katzir from the plain, and the gang walking home on foot, Nehorai in front, Erez and Ido
// beside him, Muller and the rest behind. No enemies, no markers out. He talks to Ido, to Erez and to Muller on the
// way (the lines; everybody laughs), and the others have a word each about the road they have come. Near the way
// in: a noise ahead. The camera rises: the people of Katzir along both sides of the road, clapping, with the signs.
// Through the cheering lane (Ido: famous; Nehorai: all here), then the gang together before the crowd, his last
// lines, the camera pulling away over Katzir and the hills as the sun goes down, black, the ending cards, the
// credits, THANK YOU FOR PLAYING. and the button back to the main menu. The game is saved as finished. Nobody of
// the gang betrays, nobody of the gang dies. Invented, all of it.
import { near, say } from './missions.js';
import { L, SIGNS } from './lines10.js';
import { TEAM, NAMES, endCrew, crew, attempt } from './infinity.js';
import { hush, beats, later, talkOn, clearAll, bandage, stay, offBoard, ORDER } from './phoenix-d.js';
import { shadowAway, armouredAway } from './infinity-d.js';
import { Crowd } from '../friends/crowd.js';
import { endingCards, credits, closeEnding, endingOpen } from '../ui/ending.js';
import { markFinished } from '../save/progress.js';

const H = L.homeward;
const ACCESS = 'כביש הגישה';   // the access road: s = 0 at Katzir's way in (172, 30), climbing from the plain
const MAIN = 'דרך הגבעה';      // Katzir's main street: s = 0 at the same way in, running west into the village
// "u" is how far there is still to go: the access road's own s on it, minus the main street's s once inside
const START_U = 250;           // the walk starts some 250 m before the way in
const NOISE_U = 92;            // a noise ahead: 40 m before the first of the crowd
const LANE_U = 74;             // where the walk through the people is picked up again (checkpoint 2)
const IDO_U = 26;              // half way through the lane: Ido sees the phones
const END_U = -37;             // the last moment: on the main street just inside, about (140, 24)
const TALK_R = 4.2;            // how near a friend is to talk to him
const OFF = 38;                // wandered this far off the road: the gang is left behind
const TALKERS = ['ido', 'erez', 'muller'];

// the user's lines are in lines10.js; these are mine, short, each in his own voice
const IDO_BACK = ['נהוראי', 'קולט, אחי. עכשיו רק הביתה.'];
const EREZ_BACK = ['נהוראי', 'עוד קצת, אחי. כבר רואים את הגבעה.'];
const TALKS = { ido: [H.idoDone, IDO_BACK], erez: [H.erezHome, EREZ_BACK], muller: [H.mullerPortal, H.iWasThere] };
const LAUGH = [{ who: '', text: 'כולם צוחקים.', ms: 2200 }];
// the others, a word each about the road they have come (when the walk reaches each mark)
const ROAD = [
  [232, 'yonati', 'צילמתי את כל הדרך. יוצא סרט, ואני בתפקיד הראשי. כמובן.'],
  [204, 'avraham', 'כשנגיע אני נואם. קצר. שעה, שעה וחצי מקסימום.'],
  [176, 'dolev', 'מצודה, גשר, פיצוץ… ואני בכלל רק יצאתי לקנות לחם.'],
  [162, 'erez', 'שם הכביש שבור, ליד המחצבה הישנה. עוקפים משמאל, על העשב.'],
  [148, 'hadar', 'Bro, הנעליים האלה עברו מצודה, גשר ופיצוץ. הן יוצאות לפנסיה.'],
  [120, 'liam', 'אחים, הגלידה עליי, כמו שהבטחתי. אחת לכל אחד, שתיים לנהוראי.'],
];
const LEFT = 'התרחקת מהחבורה. ארז: "אחי, הבית לשם! הולכים על הכביש, כולם ביחד."';
const PIT = 'ירדת לבור של המחצבה הישנה. מולר: "את הבור עוקפים, לא חוצים. השביל עובר ממערב לו, על העשב."';
const DROVE = 'נכנסת לרכב. עידו: "אחרי היום? רק ברגל. הרנו תחכה לנו בבית."';

// ---------- the way home ----------
// The access road from the plain, and Katzir's main street inside. Between about u 95 and 145 the road runs over the
// old quarry of chapter seven: its pit was dug under the asphalt there (the ground under the road is the pit's floor,
// 4.5 m down, and a body that steps in cannot climb out at the road's side), so the way goes round it on the grass
// to its west, from u 152 to u 90, and is back on the road for the last stretch.
const ROUND = [[296, -21], [282, -24], [266, -18], [254, -8], [252, 6], [252, 18], [257, 27]];
const OFF_AT = 152, ON_AT = 90;
const roadOf = (game, name) => game.world.net.roads.find((r) => r.name === name);
// the way as points about every two metres, from the start to inside the village, each with its u (once per game)
const WAYS = new WeakMap();
function wayOf(game) {
  let w = WAYS.get(game);
  if (w) return w;
  w = []; const A = roadOf(game, ACCESS), M = roadOf(game, MAIN);
  for (let s = START_U + 70; s > OFF_AT; s -= 2) { const q = A.at(s); w.push({ x: q.x, z: q.z, u: s }); }
  const a = A.at(OFF_AT), b = A.at(ON_AT), pts = [[a.x, a.z], ...ROUND, [b.x, b.z]];
  let len = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], n = Math.max(1, Math.ceil((cum[i] - cum[i - 1]) / 2));
    for (let k = 0; k < n; k++) { const f = k / n, c = cum[i - 1] + (cum[i] - cum[i - 1]) * f; w.push({ x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, u: OFF_AT - (OFF_AT - ON_AT) * (c / len) }); }
  }
  for (let s = ON_AT; s > 0; s -= 2) { const q = A.at(s); w.push({ x: q.x, z: q.z, u: s }); }
  for (let s = 0; s <= 90; s += 2) { const q = M.at(s); w.push({ x: q.x, z: q.z, u: -s }); }
  WAYS.set(game, w);
  return w;
}
// a point of the way at u (and `off` metres to the side of it), facing home
function wayAt(game, u, off = 0) {
  const w = wayOf(game);
  let i = 0; while (i < w.length - 2 && w[i + 1].u > u) i++;
  const p = w[i], q = w[i + 1], f = Math.max(0, Math.min(1, (p.u - u) / ((p.u - q.u) || 1)));
  const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz);
  const x = p.x + dx * f + (dz / l) * off, z = p.z + dz * f - (dx / l) * off;
  return { x, z, y: game.world.groundHeight(x, z), yaw };
}
// where the player is on the way (u) and how far off it (d)
function where(game, p = game.player.pos) {
  let best = null, bd = Infinity;
  for (const q of wayOf(game)) { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = q; } }
  return { u: best.u, d: Math.sqrt(bd) };
}
// down in the old quarry's pit (off the way: the walls there cannot be climbed at the road's side)
function inPit(game, p = game.player.pos) { const q = game.world.places.quarry; return !!q && Math.abs(p.x - q.x) < 36 && Math.abs(p.z - q.z) < 32 && p.y < q.y + 2.2; }
// the people of Katzir line the last 50 m of the access road and the first 30 m of the main street
function crowdPath(game) {
  const pts = [];
  for (let s = 50; s > 0; s -= 5) pts.push(wayAt(game, s));
  for (let s = 0; s <= 30; s += 5) pts.push(wayAt(game, -s));
  return pts.map((p) => ({ x: p.x, z: p.z }));
}
const v3 = (p, dy = 0) => ({ x: p.x, y: p.y + dy, z: p.z });
const smooth = (k) => k * k * (3 - 2 * k);
// a moving shot: the camera from a to b over `dur` seconds, looking at `look` (moved on by tick)
function glide(m, game, a, b, look, dur) { game.follow.shot(a, look, 9999); m.cam = { a, b, t: 0, dur }; }
function camOn(m, game, dt) {
  const c = m.cam, o = game.follow.override; if (!c || !o) return;
  c.t += dt; const k = smooth(Math.min(1, c.t / c.dur));
  o.from.set(c.a.x + (c.b.x - c.a.x) * k, c.a.y + (c.b.y - c.a.y) * k, c.a.z + (c.b.z - c.a.z) * k);
}
const laugh = (game) => { for (const id of TEAM) { const n = game.npc(id); if (n.visible) n.model.play(Math.random() < 0.5 ? 'nod' : 'shrug', { speed: 1.3 + Math.random() * 0.6 }); } game.nehorai.play('nod', { speed: 1.5 }); };
const talkedOf = (m) => TALKERS.filter((id) => m.s.heard?.[id]).length;
const nextTalker = (m) => TALKERS.find((id) => !m.s.heard?.[id] && !m.s.talking?.[id]) || null;

// ---------- the scene at a checkpoint (or the start) ----------
// sunset over the plain; Nehorai on foot, himself, bandaged, no marker; the whole gang with him, nobody armed,
// nobody on an errand; the Renault home in its driveway; what the citadel left (the Shadow, the wreck) put away;
// the people of Katzir already at the way in (quiet at the start, cheering once the walk through them begins)
function stage(m, game, cp) {
  clearAll(m, game);
  m.chat?.cancel(); m.chat = null; m.cam = null;
  if (game.dimensionName) game.dimension(null);
  game.rift?.clear?.(); game.energy?.clear?.(); game.overlay?.clear?.(); game.overlay?.mapHidden?.(false);
  shadowAway(game); armouredAway(game); offBoard(game, ORDER);
  game.player.crawl?.(false);
  const cs = game.world.places.carSpot; game.car.repair(); game.car.place(cs.x, cs.z, cs.yaw);
  game.daylight?.set?.(0, 0); game.daylight?.preset?.('sunset', { seconds: 0 });
  const at = wayAt(game, cp >= 2 ? LANE_U : START_U);
  game.nehorai.setPose(null);
  game.player.place(at.x, at.z, at.yaw, at.y); game.follow.override = null; game.follow.snapBehind(at.yaw);
  game.squad.tasks.clear();
  for (const id of TEAM) { const n = game.npc(id); if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } n.posed = false; n.face = null; n.idle = null; }
  crew(game, game.player.pos, at.yaw, TEAM); // Erez and Ido at his shoulders, Muller and the rest behind
  game.paint.dispose(); // no markers out
  hush(game);
  bandage(game.nehorai, true);
  if (!m.crowd) m.crowd = new Crowd(game, { along: crowdPath(game), count: 70, signs: SIGNS, walkers: [game.player.pos, ...TEAM.map((id) => game.npc(id).pos)] });
  m.crowd.cheer(cp >= 2 ? 0.75 : 0); m.crowd.lookAt(cp >= 2 ? game.player.pos : null);
  game.sound?.music?.(cp >= 2 ? 'home' : 'calm', { fade: 1.2 });
  m.s = { cp, staged: true, heard: {}, talking: {}, road: 0 };
}

// the gang before the crowd: Nehorai at the last spot facing back the way they came, his friends round him
const ARC = [['erez', -0.45, 1.9], ['ido', 0.45, 1.9], ['muller', -1.0, 2.5], ['hadar', 1.0, 2.5], ['yonati', -1.45, 2.8], ['avraham', 1.45, 2.8], ['dolev', -0.17, 3.3], ['liam', 0.17, 3.3]];
// ...and in a row, Erez and Ido beside him, the people behind them, for the last look
const ROW = [['erez', -1.0], ['ido', 1.0], ['muller', -2.0], ['hadar', 2.0], ['yonati', -3.0], ['avraham', 3.0], ['dolev', -4.0], ['liam', 4.0]];
const facing = (n, yaw) => { n.yaw = yaw; n.lookAt(n.pos.x + Math.sin(yaw) * 5, n.pos.z + Math.cos(yaw) * 5); };

export default {
  id: 'homeward', chapter: 10, number: 13, title: 'HOMEWARD BOUND', requires: ['zerohour'], follows: true,
  where: 'בדרך לקציר',
  startAt: (game) => (roadOf(game, ACCESS) ? wayAt(game, START_U) : null),
  reward: { money: 5000, unlocks: ['chapter-10'], text: 'הגיבורים של קציר · 5,000 ₪' },

  setup(m, game) { m.s = {}; m.talk = []; },
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.dimensionName) game.dimension(null);
    const at = wayAt(game, START_U); game.player.place(at.x, at.z, at.yaw, at.y); game.follow.snapBehind(at.yaw);
  },
  failIf(m, game) {
    if (!m.s.staged || game.cutscene || (m.stepIndex !== 0 && m.stepIndex !== 2)) return null;
    if (game.mode === 'car') return DROVE;
    if (inPit(game)) return PIT;
    const w = where(game);
    return w.d > OFF || w.u > START_U + 40 ? LEFT : null;
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game);
    m.chat?.update(dt);
    if (!m.chat || m.chat.done) talkOn(m, game);
    camOn(m, game, dt);
  },
  cleanup(m, game) {
    // at its end the thanks are still up over Katzir: the gang and the crowd stay under them, and go when the
    // ending's overlay goes (the button back to the main menu)
    if (m.done && endingOpen()) { game.squad.tasks.clear(); m.after = () => afterward(m, game, true); return; }
    if (endingOpen()) closeEnding(game); // left half way: the ending goes with it
    afterward(m, game, false);
  },

  steps: [
    { // 0: a few hours later; the road home at sunset; talk to Ido, Erez and Muller on the way
      objective: 'ללכת הביתה · לדבר עם החברים (0/3)', checkpoint: true,
      enter(m, game) {
        const live = attempt(game, m);
        m.s.staged = false;
        game.cutscene = true; game.hud.setCinematic(true);
        game.hud.fade('כמה שעות אחר כך · הדרך לקציר', () => {
          if (!live()) return;
          stage(m, game, 0);
          game.cutscene = false; game.hud.setCinematic(false);
          game.hud.banner('הדרך לקציר', 'HOMEWARD BOUND', 'שקיעה · הולכים הביתה', 2600);
        }, 1800);
      },
      interaction(m, game) {
        if (!m.s.staged || game.cutscene || game.mode !== 'foot' || game.dialogue.busy || (m.chat && !m.chat.done)) return null;
        const me = game.player.pos;
        let best = null, bd = TALK_R;
        for (const id of TALKERS) { if (m.s.heard[id] || m.s.talking[id]) continue; const n = game.npc(id), d = Math.hypot(n.pos.x - me.x, n.pos.z - me.z); if (n.visible && d < bd) { bd = d; best = id; } }
        if (!best) return null;
        return { label: `לדבר עם ${NAMES[best]}`, priority: 6, run: () => talk(m, game, best) };
      },
      target(m, game) {
        if (!m.s.staged) return null;
        const id = nextTalker(m);
        if (id) { const n = game.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 1.0 }; }
        const u = Math.max(NOISE_U - 4, where(game).u - 25), p = wayAt(game, u);
        return { x: p.x, z: p.z, y: p.y, r: 2.2 };
      },
      update(m, game) {
        if (!m.s.staged) return null;
        const w = where(game), n = talkedOf(m);
        // the others' word each, as the walk reaches each mark (they wait for any talk going on)
        while (m.s.road < ROAD.length && w.u <= ROAD[m.s.road][0]) { const [, id, text] = ROAD[m.s.road++]; later(m, [[NAMES[id], text]]); }
        if (n < 3) say(m, game, w.u <= NOISE_U ? `לדבר עם החברים לפני הכניסה (${n}/3)` : `ללכת הביתה · לדבר עם החברים (${n}/3)`);
        else say(m, game, 'ללכת הביתה · אל הכניסה לקציר');
        return n === 3 && w.u <= NOISE_U && !game.dialogue.busy && !m.talk?.length && (!m.chat || m.chat.done) ? 'next' : null;
      },
    },
    { // 1: a noise ahead; the camera rises over the people of Katzir, clapping, with the signs
      objective: 'רעש מלפנים',
      enter(m, game) {
        const live = attempt(game, m), me = game.player.pos, yaw = game.player.yaw;
        m.talk = []; game.dialogue.stop?.();
        game.cutscene = true; game.hud.setCinematic(true);
        m.crowd.cheer(0.3); // the noise: clapping and calling, far ahead
        const fx = Math.sin(yaw), fz = Math.cos(yaw), mid = wayAt(game, 22);
        game.follow.shot({ x: me.x - fx * 4.5 + fz * 1.2, y: me.y + 2.1, z: me.z - fz * 4.5 - fx * 1.2 }, v3(wayAt(game, 40), 1.6), 9999);
        m.beats = beats(game, [
          ['wait', 0.8],
          ['say', [H.noise]],
          ['do', () => { for (const id of TEAM) { const n = game.npc(id); n.target = null; n.lookAt(mid.x, mid.z); } }],
          ['say', [H.erezLook]],
          ['do', () => game.playCutscene('c10-home', () => Promise.resolve()).then(() => { if (!live()) return; m.s.film = true; game.cutscene = true; game.hud.setCinematic(true); })],
          ['until', () => m.s.film],
          ['do', () => { // the camera rises: the people of Katzir along both sides of the road, clapping, the signs up
            m.crowd.cheer(0.55).lookAt(game.player.pos);
            game.sound?.music?.('home', { fade: 2 });
            const up = wayAt(game, 58); glide(m, game, { x: me.x - fx * 5, y: me.y + 2.4, z: me.z - fz * 5 }, { x: up.x, y: up.y + 7.5, z: up.z }, v3(mid, 1.2), 5.5);
          }],
          ['wait', 5.6],
          ['do', () => { // the signs, close: down the lane at head height
            const a = wayAt(game, 40, -1.2), b = wayAt(game, 14, 4.4);
            m.cam = null; game.follow.shot(v3(a, 1.9), v3(b, 2.2), 9999);
          }],
          ['wait', 3.4],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; m.cam = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 2: through the cheering lane; Ido: famous; Nehorai: all here
      objective: 'ללכת בין האנשים', checkpoint: true,
      enter(m, game) {
        m.s.ido = false; m.s.said = false; m.s.wave = 0;
        m.crowd.cheer(0.8).lookAt(game.player.pos);
        game.sound?.music?.('home', { fade: 1.5 });
      },
      target(m, game) { const p = wayAt(game, END_U); return { x: p.x, z: p.z, y: p.y, r: 1.6 }; },
      update(m, game, dt) {
        const w = where(game), end = wayAt(game, END_U);
        if (!m.s.ido && w.u <= IDO_U) {
          m.s.ido = true;
          m.chat = beats(game, [['say', [H.idoFamous]], ['say', [H.allHere]], ['do', () => { m.s.said = true; }]]);
        }
        // the friends wave back at the people as they walk
        if ((m.s.wave += dt) > 1.6) { m.s.wave = 0; const n = game.npc(TEAM[Math.floor(Math.random() * TEAM.length)]); if (n.visible && !n.model.action) n.model.play('wave', { speed: 1.2 }); }
        const there = near(game.player.pos, end, 2.2);
        say(m, game, there && !m.s.said ? 'ללכת בין האנשים · רגע, כולם פה' : 'ללכת בין האנשים · אל סוף השורה');
        return there && m.s.said && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 3: the gang together before the crowd; the last lines; the camera pulls away as the sun goes down
      objective: 'הרגע האחרון',
      enter(m, game) {
        const live = attempt(game, m), end = wayAt(game, END_U), back = end.yaw + Math.PI;
        game.cutscene = true; game.hud.setCinematic(true);
        m.chat?.cancel(); m.chat = null; m.talk = [];
        const bx = Math.sin(back), bz = Math.cos(back), rx = Math.cos(back), rz = -Math.sin(back);
        // Nehorai turns back to them; the friends round him (each on an errand of the squad's: nobody follows now)
        game.player.place(end.x, end.z, back, end.y); game.nehorai.setPose(null);
        for (const [id, a, r] of ARC) {
          const x = end.x + Math.sin(back + a) * r, z = end.z + Math.cos(back + a) * r;
          const n = stay(game, id, { x, z, y: game.world.groundHeight(x, z, end.y + 1) }, { label: 'בבית' });
          n.lookAt(end.x, end.z);
        }
        m.crowd.cheer(0.6).lookAt({ x: end.x + bx * 2, z: end.z + bz * 2 });
        const over = () => game.follow.shot({ x: end.x - bx * 3 + rx * 1.1, y: end.y + 2.2, z: end.z - bz * 3 + rz * 1.1 }, { x: end.x + bx * 4, y: end.y + 1.3, z: end.z + bz * 4 }, 9999);
        const onErez = () => { const e = game.npc('erez'); game.follow.shot({ x: end.x + rx * 2.6 + bx * 0.4, y: end.y + 1.7, z: end.z + rz * 2.6 + bz * 0.4 }, { x: e.pos.x, y: e.pos.y + 1.55, z: e.pos.z }, 9999); };
        const onHim = () => game.follow.shot({ x: end.x + bx * 3.4 + rx * 0.6, y: end.y + 1.65, z: end.z + bz * 3.4 + rz * 0.6 }, { x: end.x, y: end.y + 1.5, z: end.z }, 9999);
        over();
        m.beats = beats(game, [
          ['wait', 0.9],
          ['say', [H.bestThing]],
          ['do', onErez],
          ['say', [H.erezWhat]],
          ['do', onHim],
          ['say', [H.notWon]],
          ['wait', 0.4],
          ['say', [H.together]],
          ['do', () => laugh(game)],
          ['wait', 1.4],
          ['do', () => { // side by side, the people of Katzir behind them, facing home (west, into the setting sun)
            game.player.place(end.x, end.z, end.yaw, end.y);
            ROW.forEach(([id, side]) => { const n = game.npc(id), x = end.x + rx * side, z = end.z + rz * side; n.target = null; n.walkTo(x, z, { near: 0.25, onArrive: () => facing(n, end.yaw) }); });
            game.follow.shot({ x: end.x - bx * 7, y: end.y + 1.9, z: end.z - bz * 7 }, { x: end.x, y: end.y + 1.4, z: end.z }, 9999);
          }],
          ['wait', 2.0],
          ['do', () => game.playCutscene('c10-end', () => Promise.resolve()).then(() => { if (!live()) return; m.s.film = true; game.cutscene = true; game.hud.setCinematic(true); })],
          ['until', () => m.s.film],
          ['do', () => { // the camera pulls away over Katzir's roofs, the gang and the people below it, the hills beyond; the sun goes down
            ROW.forEach(([id, side]) => { const n = game.npc(id); n.target = null; n.place(end.x + rx * side, end.z + rz * side, end.yaw, end.y); facing(n, end.yaw); n.model.setPose(Math.abs(side) <= 2 ? 'cheer' : null); if (Math.abs(side) > 2) n.model.play('wave', { speed: 0.9 }); });
            game.nehorai.play('wave', { speed: 0.9 });
            m.crowd.cheer(1).lookAt(game.player.pos);
            game.daylight?.set?.(0.55, 10);
            glide(m, game, { x: end.x - bx * 6, y: end.y + 2.0, z: end.z - bz * 6 }, { x: end.x - bx * 46, y: end.y + 24, z: end.z - bz * 46 }, { x: end.x + bx * 10, y: end.y + 1, z: end.z + bz * 10 }, 11);
          }],
          ['wait', 9.5],
          ['do', () => { m.s.last = true; }],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.s.last ? 'next' : null; },
      exit(m) { m.beats = null; }, // the shot goes on pulling away into the black
    },
    { // 4: black; NAHORAI FARHI / THE END / LEGENDS NEVER FIGHT ALONE; the credits; THANK YOU FOR PLAYING.
      objective: 'סוף',
      enter(m, game) {
        const live = attempt(game, m);
        game.cutscene = true; game.hud.setCinematic(true);
        markFinished(game); // the game is finished: saved for good, before the cards
        endingCards(game, { onClose: () => { m.crowd?.dispose(); m.crowd = null; const a = m.after; m.after = null; a?.(); } })
          .then(() => credits(game))
          .then(() => { if (live()) m.s.fin = true; });
      },
      update(m) { return m.s.fin ? 'next' : null; }, // completes behind the thanks; the button is the ending's
    },
  ],
  complete(m) { m.done = true; },
  way: wayAt, onWay: where, // the way home as the mission measures it (its tests walk it)
};

// a talk on the way: the friend's line and Nehorai's answer (Muller's ends with everybody laughing)
function talk(m, game, id) {
  const n = game.npc(id), me = game.player.pos;
  m.s.talking[id] = true;
  n.lookAt(me.x, me.z);
  const list = [['say', TALKS[id]]];
  if (id === 'muller') list.push(['do', () => laugh(game)], ['say', LAUGH], ['do', () => laugh(game)]);
  list.push(['do', () => { m.s.heard[id] = true; m.s.talking[id] = false; }]);
  m.chat = beats(game, list);
}

// everything the mission put up, taken down: the crowd, the gang, the bandage, the golden hour. `home`: after the
// ending, the friends back at their places of the free roam
function afterward(m, game, home) {
  clearAll(m, game);
  m.chat?.cancel(); m.chat = null; m.cam = null;
  m.crowd?.dispose(); m.crowd = null;
  game.sound?.crowd?.(false, { seconds: 0.8 });
  game.nehorai.setPose(null);
  for (const id of TEAM) { const n = game.npc(id); n.model.setPose(null); n.posed = false; n.face = null; }
  bandage(game.nehorai, false);
  game.daylight?.preset?.(null, { seconds: 0 }); game.daylight?.set?.(0, 0);
  endCrew(game);
  if (home) game.populate?.({ walk: false });
  else game.sound?.music?.(null, { fade: 0.8 });
}
