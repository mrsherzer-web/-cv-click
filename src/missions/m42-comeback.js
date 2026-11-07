// Chapter nine, mission 9, "הקאמבק של נהוראי". The safe room, the screen black; Ido's voice. Slowly Nehorai's eyes
// open on Ido's and Erez's faces over him; their lines; he sits up on the cot, looks round, asks for his rifle.
// The player is still Ido and hands it to him; Nehorai stands, slowly, the music rising, the camera going round
// him, his line — and the controls are his again. He walks slowly at first, steadier with every step until he
// is himself (his health and his gear back), opens the security door, crosses the hangar, deals with the last
// of the Order at the great door, opens it from its panel and goes up the ramp to the surface by the Black
// Tower's plaza, the gang with him. A bandage on his head, nothing graphic; paint for everyone else. The whole
// gang stays loyal; every threat is the Black Order's. Invented, all of it.
import { near, say, nearestGuard } from './missions.js';
import { COLORS } from '../combat/paint.js';
import { TEAM, endCrew, failOut, handsOver, Work } from './phoenix.js';
import {
  FAC, L, zone, underground, hush, become, nehoraiDown, nehoraiAway, gangAt, armed, freshMarks, offBoard, Wave,
  wrecks, redLight, beats, later, talkOn, clearAll, bandage, cot, roomSpots, stool, stay,
} from './phoenix-c.js';

const ORDER = Array.from({ length: 16 }, (_, i) => `og${i + 1}`);
const OTHERS = TEAM.filter((id) => id !== 'erez' && id !== 'ido');
const EXIT = (g) => [
  { id: 'og15', post: L(g, 81, 26.5, 0, -Math.PI / 2), still: true }, { id: 'og16', post: L(g, 81, 33.5, 0, -Math.PI / 2), still: true },
  { id: 'og1', post: L(g, 77.5, 30, 0, -Math.PI / 2), still: true },
];
const STEADY = 30;   // metres walked until his legs are his own again

// the user's lines, exactly
const VOICE = [['עידו', 'נהוראי… נו כבר אחי, תקום.']];
const WAKE = [['עידו', 'ארז!!! הוא התעורר!!!'], ['ארז', 'ידעתי שתקום, יא משוגע!']];
const SLOW = [['ארז', 'לאט, אחי, אתה פצוע.']];
const RIFLE = [['נהוראי', 'איפה הרובה שלי?'], ['עידו', 'אחי, כמעט איבדנו אותך!'], ['נהוראי', 'שמעתי. עכשיו איפה הרובה?']];
const GO = [['נהוראי', 'יאללה חבר’ה. בואו נסיים את זה.']];
const OUT = [['ארז', 'הדלת הגדולה בקצה המזרחי. משם רמפה למעלה, ליד המגדל.']];
const THREE = [['עידו', 'שלושה ליד הדלת הגדולה. הפעם אתה מוביל, אחי.']];
const PANEL = [['נהוראי', 'הלוח ליד הדלת. פותחים.']];
const UP = [['עידו', 'למעלה! המגדל השחור מחכה.']];
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "רק קמת, אחי. מאחורי הרכבים, ואחד אחד."';

function doors(game, cp) {
  const f = FAC(game);
  f.setDoors({ armory: true, rackGate: true, t1Corridor: true, t1Stores: true, t2Stores: true, hangarW: true, t2Hangar: true, t1Hangar: 'locked', trap: true, saferoom: cp >= 4 ? true : 'locked', exit: cp >= 5 ? true : 'locked' });
  f.snapDoors();
  f.armory.rack.all();
  f.exit.panel.light(cp >= 5);
}
// the safe room as the last mission left it: Nehorai on the cot (asleep at the start, sitting up once awake), the
// stool, Erez and Ido over him, the rest of the gang in the room, the door sealed; the player is Ido
function room(m, game, { awake = false } = {}) {
  const C = cot(game);
  become(game, 'ido');
  const me = C.by[0];
  gangAt(game, me, me.yaw, { ids: TEAM.filter((id) => id !== 'ido'), lead: 'ido' });
  const n = awake ? nehoraiDown(game, C.sit, { pose: 'sit' }) : nehoraiDown(game, C.lie, { y: C.lie.y });
  bandage(n.model, true);
  stool(game, C.stool);
  stay(game, 'erez', C.by[1], { label: 'לידו' }); game.npc('erez').lookAt(C.lie.x, C.lie.z);
  game.player.place(me.x, me.z, me.yaw, me.y);
  roomSpots(game).slice(0, OTHERS.length).forEach((p, i) => stay(game, OTHERS[i], p, { label: 'בחדר' }));
  armed(game, game.squad.ids);
}
// Nehorai at the controls again, wherever he stands now: the body his, the bandage on, his marker in his hands,
// the gang formed round him (Ido one of them again), his legs as steady as `walked` metres have made them
function back(m, game, at, walked) {
  become(game, 'nehorai');
  nehoraiAway(game);
  bandage(game.nehorai, true);
  const ido = game.npc('ido'); ido.show(true);
  gangAt(game, at, at.yaw ?? 0, { ids: TEAM, lead: 'nehorai', walk: true });
  // in the safe room nobody is left behind its walls: each of them where he stands in it
  if (zone(game) === 'saferoom') roomSpots(game).forEach((p, i) => { const n = game.npc(TEAM[i % TEAM.length]); if (FAC(game).zoneAt(n.pos.x, n.pos.z) !== 'saferoom') { n.target = null; n.place(p.x, p.z, p.yaw ?? 0, p.y); } });
  armed(game, TEAM); freshMarks(game);
  game.fighter.revive();
  m.s.walked = walked; m.s.last = { x: game.player.pos.x, z: game.player.pos.z };
  game.player.speedScale = pace(walked);
}
const pace = (walked) => Math.min(1, 0.5 + 0.5 * Math.min(1, walked / STEADY));

function stage(m, game, cp) {
  const f = FAC(game), H = f.hangar;
  const blown = H.vehicles.map((v, i) => (v.blown ? i : -1)).filter((i) => i >= 0);
  clearAll(m, game); underground(game);
  doors(game, cp);
  game.paint.dispose(); offBoard(game, ORDER);
  m.s = { cp };
  if (cp <= 1) room(m, game, { awake: cp === 1 });
  else {
    stool(game, cot(game).stool);
    const at = [null, null, null, L(game, 50.6, 62.2, 0, Math.PI), L(game, 47, 51.5, 0, Math.PI * 0.75), L(game, 83, 30, 0, Math.PI / 2)][cp];
    back(m, game, at, cp >= 5 ? STEADY : cp === 4 ? 12 : 0);
  }
  wrecks(m, game, blown.length ? blown : [2]);
  const b = H.blast; m.smoke.push(game.fx.burn(b.x, b.y + 0.1, b.z, { r: 1.2, strength: 0.9, seconds: 900 }), game.fx.smokeColumn(b.x, b.y + 0.5, b.z, { r: 1.2, seconds: 900 }));
  if (cp >= 3) redLight(game, ['hangar']);
  if (cp >= 3) game.sound?.music?.('action', { fade: 0.4 });
  m.w = {};
  if (cp === 4) m.w.exit = new Wave(game, EXIT(game), { now: true, hot: false });
  if (cp >= 5) for (const g of EXIT(game)) { const gd = new Wave(game, [g], { now: true, hot: false }).out[0]; game.paint.markGuard(gd, 'restore'); }
}

export default {
  id: 'comeback', chapter: 9, number: 9, title: 'הקאמבק של נהוראי', requires: ['wounded'], follows: true, secret: true,
  where: 'בחדר הבטוח',
  startAt: (game) => { const R = FAC(game)?.saferoom; return R ? { ...R.inside, r: 2 } : null; },
  reward: { money: 1200, unlocks: ['comeback'], text: 'נהוראי חזר · 1,200 ₪' },

  setup(m, game) { m.s = {}; m.w = {}; m.live = []; m.beams = []; m.smoke = []; m.talk = []; underground(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const p = FAC(game).saferoom.inside; game.player.place(p.x, p.z, 0, p.y); game.follow.snapBehind(0); underground(game); },
  failIf(m, game) { return m.stepIndex === 4 && game.playingAs === 'nehorai' ? (failOut(m, game, [4]) && LOST) : null; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live || []) x.update(dt);
    // his legs come back with every metre he walks
    if (game.playingAs === 'nehorai' && m.s.walked != null && game.mode === 'foot' && !game.cutscene) {
      const p = game.player.pos, l = m.s.last || { x: p.x, z: p.z }, d = Math.hypot(p.x - l.x, p.z - l.z);
      if (d < 3) m.s.walked += d; // (a jump of the camera or a placement is not walking)
      m.s.last = { x: p.x, z: p.z };
      const k = pace(m.s.walked);
      if (Math.abs(game.player.speedScale - k) > 0.001) game.player.speedScale = k;
      if (k >= 1 && !m.s.steady) { m.s.steady = true; game.hud.toast('נהוראי חזר לעצמו', 2200); }
    }
    // the map comes back once he is out from under the lid
    const f = FAC(game), p = game.player.pos, under = f.inside(p.x, p.z);
    if (m.stepIndex >= 5 && m.s.under !== under) { m.s.under = under; game.overlay?.mapHidden(under, 'מתחת לאדמה'); }
  },
  cleanup(m, game) {
    const f = FAC(game);
    clearAll(m, game);
    stool(game, null);
    if (game.playingAs !== 'nehorai') become(game, 'nehorai');
    nehoraiAway(game);
    for (const id of TEAM) { const n = game.npc(id); n.model.setPose(null); game.squad.release(id); }
    if (m.done && handsOver(game)) { // up on the surface, armed, the gang with him: the tower's mission takes it from here
      game.paint.dispose(); offBoard(game, ORDER); armed(game, TEAM);
      return;
    }
    bandage(game.nehorai, false);
    game.paint.dispose(); offBoard(game, ORDER);
    f.reset(); f.snapDoors(); f.armory.rack.all();
    endCrew(game);
  },

  steps: [
    { // 0: black; Ido's voice; the eyes open on their faces; he sits up; the rifle
      objective: 'נהוראי…',
      enter(m, game) {
        stage(m, game, 0);
        const C = cot(game), n = game.npc('nehorai'), e = game.npc('erez');
        game.cutscene = true; game.hud.setCinematic(true);
        game.overlay?.eyes(1, 0); game.overlay?.daze(0.7, 0);
        game.sound?.music?.(null, { fade: 0.1 }); game.sound?.heartbeat?.(true, { bpm: 56, level: 0.45 });
        const faces = { x: (C.by[0].x + C.by[1].x) / 2, y: C.lie.y + 1.15, z: (C.by[0].z + C.by[1].z) / 2 };
        game.follow.shot(C.pov, faces, 9999);
        m.beats = beats(game, [
          ['wait', 1.5],
          ['say', VOICE],
          // slowly the eyes open: Ido and Erez over him
          ['do', () => { game.overlay?.eyes(0.55, 1.6); game.overlay?.daze(0.5, 1.6); }],
          ['wait', 1.4],
          ['do', () => { game.overlay?.eyes(0.8, 0.5); }],
          ['wait', 0.6],
          ['do', () => { game.overlay?.eyes(0, 2.0); game.overlay?.daze(0.2, 2.4); game.sound?.heartbeat?.(false); }],
          ['wait', 1.6],
          ['say', WAKE],
          // he sits up on the edge of the cot
          ['do', () => {
            game.overlay?.daze(0, 1.5);
            nehoraiDown(game, C.sit, { pose: 'sit' }); bandage(n.model, true);
            e.lookAt(C.sit.x, C.sit.z);
            game.follow.shot({ x: C.sit.x - 2.4, y: C.sit.y + 1.35, z: C.sit.z - 1.6 }, { x: C.sit.x, y: C.sit.y + 0.95, z: C.sit.z }, 9999);
          }],
          ['say', SLOW],
          // he looks round the room
          ['do', () => { n.model.play('shrug', { speed: 0.6 }); game.follow.shot({ x: C.sit.x - 1.6, y: C.sit.y + 1.2, z: C.sit.z + 1.2 }, { x: C.sit.x, y: C.sit.y + 1.0, z: C.sit.z }, 9999); }],
          ['wait', 0.8],
          ['say', RIFLE],
          ['wait', 0.2],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); game.overlay?.daze(0, 0.4); game.overlay?.eyes(0, 0.2); },
    },
    { // 1: Ido gives him the rifle (the player is still Ido)
      objective: 'לתת לנהוראי את הרובה', checkpoint: true,
      enter(m, game) { m.s.given = false; },
      target: (m, game) => ({ ...cot(game).sit, r: 1.0 }),
      interaction(m, game) {
        const n = game.npc('nehorai');
        if (m.s.given || game.mode !== 'foot' || !near(game.player.pos, n.pos, 2.4)) return null;
        return { label: 'לתת לנהוראי את הרובה', priority: 6, run: () => {
          m.s.given = true;
          game.paint.addAlly(n, COLORS.nehorai); // his own marker, in his own colour, in his hands
          game.nehorai.play('nod'); game.sound?.chime?.(true);
          game.hud.toast('נהוראי חמוש', 1500);
        } };
      },
      update(m, game) { say(m, game, m.s.given ? 'הרובה אצלו' : 'לתת לנהוראי את הרובה · הוא על המיטה'); return m.s.given ? 'next' : null; },
    },
    { // 2: he stands, slowly; the music rises; the camera goes round him; his line; the controls his again
      objective: 'נהוראי קם',
      enter(m, game) {
        const C = cot(game), n = game.npc('nehorai');
        game.cutscene = true; game.hud.setCinematic(true);
        m.s.orbit = null;
        m.beats = beats(game, [
          ['do', () => {
            n.model.setPose(null); n.floorY = null;
            n.place(C.sit.x - 0.35, C.sit.z, C.sit.yaw, C.sit.y);
            n.model.play('getup', { speed: 0.45 });
            game.follow.shot({ x: C.sit.x - 2.2, y: C.sit.y + 1.1, z: C.sit.z - 1.4 }, { x: C.sit.x - 0.35, y: C.sit.y + 1.2, z: C.sit.z }, 9999);
            game.sound?.music?.('action', { fade: 6 });
          }],
          ['wait', 2.4],
          // round him, slowly, while the music comes up
          ['do', () => { m.s.orbit = { a: Math.PI * 1.1, at: { x: C.sit.x - 0.35, y: C.sit.y, z: C.sit.z } }; }],
          ['wait', 3.4],
          ['say', GO],
          ['wait', 0.4],
          // back to Nehorai: his body, his rifle, slow on his feet at first
          ['do', () => {
            const at = { x: n.pos.x, z: n.pos.z, y: C.sit.y, yaw: Math.PI };
            const ido = game.player.pos, idoAt = { x: ido.x, z: ido.z, yaw: game.player.yaw, y: ido.y };
            m.s.orbit = null;
            back(m, game, at, 0);
            const i = game.npc('ido'); i.target = null; i.place(idoAt.x, idoAt.z, idoAt.yaw, idoAt.y);
            game.follow.override = null; game.follow.snapBehind(Math.PI);
            game.cutscene = false; game.hud.setCinematic(false);
            game.hud.banner('', 'נהוראי חוזר', 'בהתחלה לאט · כל צעד מחזיר לו כוח', 2800);
          }],
        ]);
      },
      update(m, game, dt) {
        m.beats?.update(dt);
        const o = m.s.orbit;
        if (o && game.follow.override) { o.a += dt * 0.62; const r = 1.75; game.follow.override.from.set(o.at.x + Math.cos(o.a) * r, o.at.y + 1.55, o.at.z + Math.sin(o.a) * r); game.follow.override.look.set(o.at.x, o.at.y + 1.25, o.at.z); }
        return m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; m.s.orbit = null; game.cutscene = false; game.hud.setCinematic(false); },
    },
    { // 3: out of the safe room, slowly
      objective: 'לצאת מהחדר הבטוח', checkpoint: true,
      enter(m, game) {
        const R = FAC(game).saferoom;
        if (m.s.walked == null) back(m, game, { ...L(game, 50.6, 62.2), yaw: Math.PI }, 0);
        m.s.open = R.door.open;
        later(m, game, OUT);
        if (!m.s.open) m.work = new Work(game, { at: R.wheel, seconds: 2, label: 'לפתוח את דלת הביטחון', pill: 'מסובב את הגלגל', near: 1.9, onDone: () => { R.door.unlock(); R.door.setOpen(true); m.s.open = true; game.sound?.hit?.('crash', 0.5); redLight(game, ['hangar']); } });
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) { const R = FAC(game).saferoom; return !m.s.open ? { ...R.wheel, r: 1.0 } : { ...R.doorAt, r: 1.4 }; },
      update(m, game, dt) {
        m.work?.update(dt);
        const k = Math.round(game.player.speedScale * 100);
        say(m, game, !m.s.open ? `לפתוח את דלת הביטחון · הגלגל ליד הדלת · כוח ${k}%` : `לצאת להאנגר · לאט · כוח ${k}%`);
        return m.s.open && zone(game) === 'hangar' ? 'next' : null;
      },
      exit(m, game) { m.work = null; },
    },
    { // 4: the last of the Order at the great door; its panel
      objective: 'הדלת הגדולה', checkpoint: true,
      enter(m, game) {
        freshMarks(game);
        if (!m.w.exit) m.w.exit = new Wave(game, EXIT(game), { now: true, hot: false });
        m.s.panel = false;
        later(m, game, THREE);
        game.sound?.music?.('action', { fade: 1 });
      },
      interaction(m, game) {
        if (m.w.exit?.left) return null;
        return m.work?.interaction(game) || null;
      },
      target(m, game) { const X = FAC(game).exit; return nearestGuard(game, m.w.exit?.ids) || (m.s.panel ? null : { ...X.panel.at, r: 1.0 }); },
      update(m, game, dt) {
        const X = FAC(game).exit, w = m.w.exit;
        if (!w.left && !m.work && !m.s.panel) { later(m, game, PANEL); m.work = new Work(game, { at: X.panel.at, seconds: 2.5, label: 'לפתוח את דלת היציאה', pill: 'פותח את הדלת הגדולה', near: 1.9, onDone: () => { m.s.panel = true; X.panel.light(true); X.door.unlock(); X.door.setOpen(true); game.sound?.hit?.('crash', 0.6); game.hud.banner('', 'היציאה פתוחה', 'למעלה, אל פני השטח', 2200); } }); }
        m.work?.update(dt);
        const k = Math.round(game.player.speedScale * 100);
        say(m, game, w.left ? `הדלת הגדולה: לסמן אותם (${w.total - w.left}/${w.total}) · סומנת ${game.paint.hits}/3 · כוח ${k}%` : m.s.panel ? 'היציאה פתוחה' : 'לפתוח את דלת היציאה · הלוח ליד הדלת');
        return m.s.panel ? 'next' : null;
      },
      exit(m, game) { m.work = null; later(m, game, UP); },
    },
    { // 5: up the ramp to the surface
      objective: 'אל פני השטח', checkpoint: true,
      target: (m, game) => ({ ...FAC(game).exit.outside, r: 2.4 }),
      update(m, game) {
        const X = FAC(game).exit;
        say(m, game, 'במעלה הרמפה · אל פני השטח, ליד המגדל השחור');
        return near(game.player.pos, X.outside, 3) && Math.abs(game.player.pos.y - X.outside.y) < 1.5 ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; game.player.speedScale = 1; },
};
