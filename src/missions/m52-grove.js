// Chapter ten, mission 6 (52): איפה אנחנו?! The white after the portal; the crossing — the two of them really
// carried out of the citadel's hall and set down on the lawn of the olive grove, in its other dimension (the
// violet sky, two moons low over the trees, motes drifting between the olives, the bulbs glowing oddly; the radio
// dead). Birds. Nehorai and Erez on the ground; "לקום"; the lines; "תסתכל על השמיים": the player looks up himself
// (a shot helps); then the first walk with Erez through what is familiar and wrong — the bulbs, the swings — to
// the first wall of energy across the path. 53 carries on. The marker, the ammo, the health, the squad (Erez with
// him; the others stay behind in the citadel) and the progress cross with him. Invented, all of it.
import { near } from './missions.js';
import { L } from './lines10.js';
import { attempt, endCrew } from './infinity.js';
import { handsTo } from './phoenix-a.js';
import { beats, later, talkOn, hush, stay, bandage, armWrap, clearAll } from './phoenix-d.js';
import { HALL, GROVE, inGrove, pairAt, birds, hurtLook } from './infinity-b.js';

// lines that are not the user's: short, in each one's voice
const MOONS = [['נהוראי', 'שני ירחים?!'], ['ארז', 'ואתה עוד אמרת שאני רואה יותר מדי סרטים.']];
const LOOK_TIP = 'לגרור את המסך למעלה · להסתכל לשמיים';
const BULBS = [['ארז', 'והנורות… מי מחליף להן צבעים? אין פה אף אחד.']];
const SWINGS = [['ארז', 'הנדנדות. פה עשינו תחרות מי עף הכי רחוק, זוכר? אותו דבר — רק עקום.']];
const SAME = [['נהוראי', 'אותם ספסלים, אותם עצים… ומשהו פה לא בסדר.']];
const WALL = [['ארז', 'קיר של אנרגיה. ברור. למה שיהיה קל?'], ['נהוראי', 'אז נמצא איך מכבים אותו. ביחד.']];

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
// on the path, just short of the first wall of energy where it crosses the paving (seal 1, x ≈ 1214)
function wallPoint(game) {
  const Q = GROVE(game), east = Q.path.filter((p) => p.x > 1215.6).sort((a, b) => a.x - b.x)[0] || Q.pathStart;
  return { x: east.x, z: east.z, y: Q.y };
}
// the moons' way from where he stands (a point toward the great moon, low over the trees)
function moonYaw(game) { const me = game.player.pos, p = game.rift.moonPoint(0, 300); return Math.atan2(p.x - me.x, p.z - me.z); }

// the two on the ground where they landed: Nehorai held down (he gets up on the prompt), Erez lying beside him
function lying(m, game) {
  const Q = GROVE(game), n = Q.landing.nehorai, e = Q.landing.erez;
  inGrove(game);
  pairAt(game, n);
  game.player.place(n.x, n.z, n.yaw, n.y);
  game.player.take(m); game.nehorai.setPose('floored');
  stay(game, 'erez', e, { pose: 'floored', label: 'שוכב' });
  hurtLook(game, 0, 0);
  game.sound?.quiet?.();
  game.follow.shot({ x: n.x + 1.6, y: n.y + 5.2, z: n.z + 3.4 }, { x: (n.x + e.x) / 2, y: n.y + 0.2, z: (n.z + e.z) / 2 }, 9999);
}
// the start, from anywhere: the white of the portal, then the crossing to the grove (the bodies moved under it)
function arrive(m, game) {
  const Q = GROVE(game), live = attempt(game, m);
  m.s.p = 'white';
  game.cutscene = true;
  if ((game.overlay?.state.white ?? 0) < 0.99) game.overlay?.white(1);
  game.sound?.quiet?.();
  game.playCutscene('c10-grove', () => Promise.resolve()).then(() => {
    if (!live()) return;
    game.cutscene = true;
    m.cross = game.rift.crossing({
      to: Q.landing.nehorai, also: [{ npc: 'erez', at: Q.landing.erez }], seconds: 3.2, cutscene: true,
      onMid: () => { if (live()) lying(m, game); },
      // (still a scene: lying there he does not raise his marker; the prompt shows all the same)
      onArrive: () => { if (!live()) return; m.s.p = 'down'; game.cutscene = true; birds(game, 5); },
    });
  });
}
// up on his feet (the prompt): the get-up, Erez too, then the lines
function getUp(m, game) {
  const Q = GROVE(game), n = Q.landing.nehorai, e = game.npc('erez');
  m.s.p = 'up';
  game.cutscene = true;
  m.beats = beats(game, [
    ['do', () => { game.nehorai.setPose(null); game.nehorai.play?.('getup'); birds(game, 3); }],
    ['wait', 1.0],
    ['do', () => {
      game.player.release(m, n.y); game.follow.override = null;
      e.model.setPose(null); e.model.play?.('getup');
      game.follow.shot({ x: n.x - 2.6, y: n.y + 1.8, z: n.z + 1.6 }, { x: n.x, y: n.y + 1.5, z: n.z }, 9999);
    }],
    ['wait', 0.6],
    ['say', [L.grove.where]],
    ['do', () => { game.follow.shot({ x: e.pos.x - 2.2, y: e.pos.y + 1.7, z: e.pos.z - 1.4 }, { x: e.pos.x, y: e.pos.y + 1.5, z: e.pos.z }, 9999); e.lookAt(game.player.pos.x, game.player.pos.z); }],
    ['say', [L.grove.erezParallel]],
    ['do', () => { const me = game.player.pos; game.follow.shot({ x: me.x + 2.4, y: me.y + 2.2, z: me.z - 2.2 }, { x: me.x - 8, y: me.y + 1.2, z: me.z - 3 }, 9999); }],
    ['say', [L.grove.itsTheGrove]],
    ['say', [L.grove.erezSky]],
  ]);
}

// everything this mission made, put away (a restore, a cleanup)
function putAway(m, game) {
  m.cross?.cancel?.(); m.cross = null;
  m.beats?.cancel(); m.beats = null;
  if (game.player.scripted === m) game.player.release(m);
  game.nehorai?.setPose?.(null);
}

export default {
  id: 'grove', chapter: 10, number: 6, title: 'איפה אנחנו?!', requires: ['rift'], follows: true, secret: true,
  where: 'מעבר לשער',
  startAt: (game) => { const Q = game.world.places.grove; return Q ? { ...Q.landing.nehorai } : null; },
  reward: { money: 800, text: 'חורשת הזיתים — מהצד השני · 800 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; },
  // the start, from anywhere: where the portal took them, in the citadel's main hall (the crossing moves them)
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.playingAs !== 'nehorai') game.playAs('nehorai');
    const h = HALL(game), p = h.portalAt;
    game.player.place(p.x - 6, p.z, -Math.PI / 2, h.y); game.follow.snapBehind(game.player.yaw);
  },
  restore(m, game, cp) { // the walk (cp 2): on their feet on the lawn where they landed, in the dimension
    putAway(m, game);
    clearAll(m, game);
    const Q = GROVE(game);
    inGrove(game);
    pairAt(game, Q.landing.nehorai);
    game.squad.release('erez');
    hurtLook(game, 0, 0);
    game.sound?.music?.(null, { fade: 0.3 });
    m.s = { cp, staged: true };
  },
  tick(m, game, dt) { hush(game); talkOn(m, game); },
  cleanup(m, game) {
    if (m.done && handsTo(game, 'secret')) { // 53 takes it from here: the two in the grove, the dimension on
      m.beats?.cancel(); m.beats = null; m.cross = null; m.talk = [];
      if (game.player.scripted === m) game.player.release(m);
      game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
      return;
    }
    putAway(m, game);
    clearAll(m, game);
    game.dimension(null); game.rift.clear(); GROVE(game).reset(); game.rift.static = false;
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    endCrew(game);
  },
  complete(m, game) { m.done = true; },

  steps: [
    { // 0: the white, the crossing, the grove; up on his feet; the lines
      objective: 'לקום',
      enter(m, game) { arrive(m, game); },
      interaction(m, game) { return m.s.p === 'down' ? { label: 'לקום', priority: 8, run: () => getUp(m, game) } : null; },
      update(m, game, dt) { m.beats?.update(dt); return m.s.p === 'up' && m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.follow.override = null; },
    },
    { // 1: look at the sky — the player's own look (drag up), a shot to help
      objective: 'להסתכל על השמיים',
      enter(m, game) {
        const y = moonYaw(game);
        game.player.yaw = y; game.player.sync?.(); game.follow.snapBehind(y);
        game.npc('erez').lookAt(game.player.pos.x + Math.sin(y) * 20, game.player.pos.z + Math.cos(y) * 20);
        m.s.p = 'look'; m.s.t = 0;
      },
      // the arrow points the way to the great moon (its mark stands far past the fog, out of sight)
      target(m, game) { const p = game.rift.moonPoint(0, 300); return { x: p.x, z: p.z, y: game.player.pos.y, r: 1.2 }; },
      update(m, game, dt) {
        m.s.t += dt;
        if (m.s.p === 'look') {
          if (m.s.t > 8 && !m.s.tip) { m.s.tip = true; game.hud.toast(LOOK_TIP, 3200); }
          if (game.follow.pitch <= -0.1 || m.s.t > 16) { // he looks up (or, after a while, the shot shows it for him)
            m.s.p = 'shot'; m.s.looked = game.follow.pitch <= -0.1;
            game.cutscene = true;
            const me = game.player.pos, y = moonYaw(game), mp = game.rift.moonPoint(0, 300);
            game.follow.shot({ x: me.x - Math.sin(y) * 2.2 + Math.cos(y) * 0.8, y: me.y + 0.9, z: me.z - Math.cos(y) * 2.2 - Math.sin(y) * 0.8 }, { x: me.x + (mp.x - me.x) * 0.2, y: me.y + 0.9 + (mp.y - me.y) * 0.2 + 4, z: me.z + (mp.z - me.z) * 0.2 }, 9999);
            m.beats = beats(game, [['wait', 1.6], ['say', MOONS], ['wait', 0.4]]);
          }
        }
        m.beats?.update(dt);
        return m.s.p === 'shot' && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 2: the first walk with Erez, to the first wall of energy across the path. 53 carries on
      objective: 'ללכת עם ארז אל השביל', checkpoint: true,
      enter(m, game) {
        game.squad.release('erez');
        game.squad.form(['erez'], { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
        const w = wallPoint(game), me = game.player.pos;
        m.s.p = 'walk'; m.s.d0 = Math.max(4, dist(me, w)); m.s.said = 0;
      },
      target(m, game) { return m.s.p === 'walk' ? { ...wallPoint(game), r: 1.3 } : null; },
      update(m, game, dt) {
        const w = wallPoint(game), me = game.player.pos, Q = GROVE(game);
        if (m.s.p === 'walk') {
          const k = 1 - dist(me, w) / m.s.d0;
          if (m.s.said === 0 && k > 0.2) { m.s.said = 1; later(m, BULBS); }
          if (m.s.said === 1 && k > 0.5) { m.s.said = 2; later(m, SWINGS); later(m, SAME); }
          if (near(me, w, 1.6)) { // the wall: it hums, it sparks at a touch; nobody gets through
            m.s.p = 'wall';
            game.cutscene = true;
            const e = game.npc('erez'), wx = 1214, at = { x: wx, y: Q.y + 1.2, z: w.z };
            game.player.yaw = yawTo(me, at);
            game.squad.send('erez', { x: w.x + 0.6, z: w.z + 1.6 }, { label: 'מול הקיר' }); e.target = null;
            e.place(w.x + 0.6, w.z + 1.6, yawTo({ x: w.x + 0.6, z: w.z + 1.6 }, at), Q.y);
            game.energy?.sparks(at.x, at.y, at.z, '#8a6bff', 22, 3); game.sound?.zap?.(0.5, 1.3);
            game.follow.shot({ x: w.x + 3.2, y: Q.y + 2.0, z: w.z - 2.6 }, { x: wx, y: Q.y + 1.3, z: w.z }, 9999);
            // what Erez had still to say on the way (a quick walk outruns him) comes first, then the wall's lines
            const rest = [...(m.s.said < 1 ? [BULBS] : []), ...(m.s.said < 2 ? [SWINGS, SAME] : []), ...(m.talk || [])].flat(); m.talk = [];
            m.beats = beats(game, [['wait', 0.8], ...(rest.length ? [['say', rest]] : []), ['say', WALL], ['wait', 0.3]]);
          }
        }
        m.beats?.update(dt);
        return m.s.p === 'wall' && m.beats?.done && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { m.beats = null; game.cutscene = false; game.follow.override = null; game.squad.release('erez'); game.follow.snapBehind(game.player.yaw); },
    },
  ],
};
