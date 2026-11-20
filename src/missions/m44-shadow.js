// Chapter nine, mission 11, "הבוס הגדול: הצל". The command room at the top of the Black Tower. The door shuts behind
// Nehorai and he is alone with the Shadow, who stands by the huge window. Their lines; then the boss in three
// phases. One: paint — the Shadow's guards, and his defences (three paint turrets whose red sensors are the way to
// stop them, and the red shield round him that drops with the last of them). Two: fists, face to face, the fist
// moves of the chapter (punch, heavy punch, shove, block, dodge) against a man whom only a big hit moves. Three:
// the door gives, Erez and Ido are in, the Shadow calls his two bodyguards out of his private lift, and the last
// fight: Nehorai puts him down. On the floor, the Shadow smiles, and his emergency elevator takes him at the last
// moment. Left behind: his computer, with what the Black Order has on other facilities — and how he knew about
// the gang: outside surveillance and what was left in Kotzi's old bases. No traitor in the gang, ever. Paint for
// the guns, a white flash for a punch; the beaten sit down. Invented, all of it.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';
import { TEAM, failOut, handsOver, endCrew } from './phoenix.js';
import {
  TW, T, ORDER, hush, armed, gangAt, freshMarks, wipeOff, stay, unarm, rearm, post, offBoard, standing, nearestOf,
  Turret, beats, later, talkOn, bandage, clearAll, assaulted, towerReset, FloorJob,
} from './phoenix-d.js';
import * as THREE from 'three';

const GUARDS = [{ id: 'og9', lx: -12.5, lz: 16.2, yaw: Math.PI }, { id: 'og10', lx: 12.5, lz: 16.2, yaw: Math.PI }];
const BODY = ['og13', 'og14'];
const GIDS = GUARDS.map((g) => g.id);
// the three turrets: two by the side walls looking into the room, one in front of the shield; each has a blind side
const TURRETS = [{ lx: -16.2, lz: 6.2, yaw: 0.75 }, { lx: 16.2, lz: 6.2, yaw: -0.75 }, { lx: 0, lz: 15.2, yaw: Math.PI }];
const SHIELD = { x0: -3.2, x1: 3.2, z0: 16.2, z1: 19.7, h: 3.4 };

// the user's lines, exactly
const MEET = [['נהוראי', 'נגמר לך המשחק.'], ['הצל', 'אתה חושב שאתה גיבור? אתה אפילו לא יודע כמה קרוב היית להפסיד.']];
const SHUT = [['ארז', 'נהוראי! הדלת ננעלה מאחוריך! עידו כבר עליה!', 'phone']];
const DEFENCES = [['הצל', 'מערכות הגנה. שומרים.'], ['עידו', 'שלושה צריחים עם חיישן אדום! שתי יריות לכל אחד — ומהצד, לא מול הקרן!', 'phone']];
const SHIELD_DOWN = [['הצל', 'צבע זה לילדים, נהוראי. בוא נראה אותך בלי הרובה.'], ['נהוראי', 'בשמחה.']];
const FISTS_TIP = 'רק מכה חזקה או סיום קומבו מזיזים אותו · דחיפה עוצרת את התנופה';
const IN = [['ארז', 'חשבת שנשאיר אותך לבד איתו?'], ['עידו', 'שלושה על אחד. ככה זה אצלנו.'], ['הצל', 'שניים? גם לי יש.']];
const DOWN = [['הצל', 'יפה, נהוראי. יפה מאוד.'], ['הצל', 'אבל לכל מגדל יש דלת אחורית.']];
const GONE = [['ארז', 'הוא בורח!'], ['נהוראי', 'לא!'], ['עידו', 'מעלית חירום. היא יורדת ישר למטה, ואין לה כפתור מבחוץ.'], ['ארז', 'הוא השאיר את המחשב שלו.']];
const DATA = [
  ['עידו', 'תראו את זה. מצלמות מעקב חיצוניות — הכבישים, הנמל, אפילו הדרך לבית המסתור. ככה הוא ידע עלינו.'],
  ['ארז', 'ופה: "גיבויים מהבסיסים הישנים של קוצי".'],
  ['עידו', 'כל מה שקוצי אסף עלינו נשאר בבסיסים הישנים שלו. הצל פשוט מצא את זה.'],
  ['נהוראי', 'ידעתי. מהחבורה שלנו שום דבר לא יוצא.'],
  ['ארז', 'אף פעם, אחי. אין בוגדים בחבורה.'],
  ['עידו', 'ויש פה עוד: מתקנים נוספים של המסדר השחור. חמישה. אני מעתיק הכול.'],
];
const COPIED = [['עידו', 'יש. הכול אצלנו.'], ['ליאם', 'אחים, אני רץ לנמל להביא את הרנו. נתראה ליד שער הרכבים.'], ['ארז', 'רוץ. אנחנו מיד אחריך.']];
const LOST = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "מההתחלה. מאחורי העמודים, והצריחים מהצד שלהם שלא רואה."';
const FIST_LOST = 'הצל הפיל אותך. ארז: "שוב, אחי. כשהוא מתנופף — דחיפה או התחמקות, ואז מכה חזקה."';
const OTHERS = TEAM.filter((id) => id !== 'erez' && id !== 'ido');

const C = (game) => TW(game).command;
const F4 = (game, lx, lz, yaw) => T(game, lx, lz, 4, yaw);

// ---------- the room as each phase has it ----------
function shield(m, game, on) {
  const W = game.world;
  if (m.shield) { m.shield.mesh.removeFromParent(); m.shield.mesh.geometry.dispose(); m.shield.mesh.material.dispose(); W.cols.remove(m.shield.body); m.shield = null; }
  if (!on) return;
  const a = F4(game, (SHIELD.x0 + SHIELD.x1) / 2, (SHIELD.z0 + SHIELD.z1) / 2), w = SHIELD.x1 - SHIELD.x0, d = SHIELD.z1 - SHIELD.z0;
  const mat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, SHIELD.h, d), mat); mesh.position.set(a.x, a.y + SHIELD.h / 2, a.z); mesh.renderOrder = 3; game.scene.add(mesh);
  m.shield = { mesh, mat, body: W.cols.addBox(a.x, a.z, w / 2, d / 2, 0, a.y - 0.3, a.y + SHIELD.h) };
}
function turrets(m, game) {
  for (const t of m.turrets || []) t.dispose();
  m.turrets = TURRETS.map((q, i) => new Turret(game, { at: F4(game, q.lx, q.lz), yaw: q.yaw, boot: 3 + i * 1.2, label: 'חיישן' })); // online one by one
}
// the gang out in the anteroom while the door is shut: Ido at the door, Erez by him, the rest waiting
function outside(game) {
  const c = C(game);
  stay(game, 'ido', { ...c.doorAt, yaw: Math.PI }, { label: 'פורץ את הדלת', pose: 'carry' });
  stay(game, 'erez', F4(game, 1.6, -2.4, Math.PI), { label: 'בדלת' });
  OTHERS.forEach((id, i) => stay(game, id, F4(game, -4.5 + (i % 3) * 4.5, -5 - Math.floor(i / 3) * 3, Math.PI), { label: 'מחכה' }));
}
function shadowAt(game, at, yaw) { const n = game.npc('shadow'); n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null); n.place(at.x, at.z, yaw ?? at.yaw ?? 0, at.y); n.show(true); return n; }
function stage(m, game, cp) {
  clearAll(m, game);
  shield(m, game, false);
  const c = TW(game).command;
  game.daylight?.set(1, 0);
  game.paint.dispose(); offBoard(game, ORDER);
  assaulted(game);
  c.escapeDoor.lock(); c.screen.show('map');
  if (cp <= 2) c.door.lock(); else { c.door.unlock(); c.door.setOpen(true); }
  // Nehorai, in the room; the gang outside the door until it gives (phase three), then in with him
  const at = [c.inside, c.inside, F4(game, 0, 5.5, 0), F4(game, 0, 5.5, 0), F4(game, -6, 4.5, -Math.PI / 2), F4(game, 0, 10.5, 0)][cp];
  gangAt(game, { ...at, yaw: at.yaw ?? 0 }, { ids: TEAM });
  if (cp <= 3) outside(game);
  bandage(game.nehorai, true);
  if (cp >= 2) game.paint.disarmPlayer();
  if (cp >= 2 && cp <= 3) { unarm(game, 'erez'); unarm(game, 'ido'); }
  game.sound?.music?.(cp >= 1 && cp <= 4 ? 'action' : null, { fade: 0.4 });
  m.s = { cp };
}

export default {
  id: 'shadow', chapter: 9, number: 11, title: 'הבוס הגדול: הצל', requires: ['blacktower'], follows: true, secret: true,
  where: 'בחדר הפיקוד',
  startAt: (game) => { const c = TW(game)?.command; return c ? { x: c.doorAt.x, z: c.doorAt.z, y: c.doorAt.y } : null; },
  reward: { money: 2000, unlocks: ['shadow'], text: 'הצל הובס — וברח · 2,000 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.turrets = []; m.talk = []; game.overlay?.mapHidden(false); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const c = TW(game).command; game.player.place(c.doorAt.x, c.doorAt.z, 0, c.doorAt.y); game.follow.snapBehind(0); },
  failIf(m, game) { return failOut(m, game, [1]) ? LOST : null; },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) {
    hush(game); talkOn(m, game); wipeOff(m, game, dt);
    for (const x of m.live || []) x.update(dt);
    if (m.shield) m.shield.mat.opacity = 0.14 + 0.08 * Math.sin(game.time * 5);
  },
  cleanup(m, game) {
    clearAll(m, game); shield(m, game, false);
    const sh = game.npc('shadow'); sh.model.setPose(null); sh.show(false);
    for (const id of BODY) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
    if (m.done && handsOver(game)) { // the gang round the desk, armed: the self-destruct (mission 45) takes it from here
      game.paint.dispose(); offBoard(game, ORDER); armed(game, game.squad.ids);
      return;
    }
    game.paint.dispose(); offBoard(game, ORDER);
    towerReset(game);
    bandage(game.nehorai, false);
    endCrew(game);
  },

  steps: [
    { // 0: in; the door shuts behind him; the Shadow by the window; the lines
      objective: 'חדר הפיקוד',
      enter(m, game) {
        const c = C(game);
        stage(m, game, 0);
        const sh = shadowAt(game, F4(game, 0.4, 18.4), 0);
        sh.lookAt(sh.pos.x, sh.pos.z + 5); // to the glass, his back to the door
        game.cutscene = true; game.hud.setCinematic(true);
        const w = c.window.at;
        game.follow.shot({ x: c.inside.x - 2.2, y: c.inside.y + 1.8, z: c.inside.z - 1.6 }, { x: w.x, y: w.y + 1.6, z: w.z }, 9999);
        game.sound?.music?.(null, { fade: 0.6 });
        m.beats = beats(game, [
          ['do', () => { game.sound?.hit?.('crash', 0.8); game.follow.shake(0.3); }],
          ['wait', 0.8],
          ['say', SHUT],
          ['do', () => { sh.lookAt(game.player.pos.x, game.player.pos.z); game.follow.shot({ x: w.x + 3.4, y: w.y + 2.0, z: w.z - 3.5 }, { x: game.player.pos.x, y: game.player.pos.y + 1.4, z: game.player.pos.z }, 9999); }],
          ['wait', 0.6],
          ['say', [MEET[0]]],
          ['do', () => { game.follow.shot({ x: c.inside.x + 1.2, y: c.inside.y + 1.7, z: c.inside.z + 1.5 }, { x: sh.pos.x, y: sh.pos.y + 1.6, z: sh.pos.z }, 9999); }],
          ['say', [MEET[1]]],
          ['wait', 0.3],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(0); },
    },
    { // 1: phase one — paint: his guards and his defences
      objective: 'שלב 1 · שומרי הצל ומערכות ההגנה', checkpoint: true,
      enter(m, game) {
        const sh = shadowAt(game, F4(game, 0.4, 18.4), Math.PI);
        sh.lookAt(game.player.pos.x, game.player.pos.z);
        shield(m, game, true); turrets(m, game);
        freshMarks(game);
        post(game, GUARDS.map((g) => ({ id: g.id, at: g.to ? [F4(game, g.lx, g.lz), F4(game, g.to[0], g.to[1])] : [F4(game, g.lx, g.lz)], yaw: g.yaw })));
        game.hud.banner('הצל · שלב 1 מתוך 3', 'קרב יריות', 'שומרי הצל · שלושה צריחים · המגן', 2800);
        game.sound?.music?.('action', { fade: 0.4 });
        later(m, DEFENCES);
      },
      target(m, game) {
        const live = (m.turrets || []).filter((t) => !t.dead), me = game.player.pos;
        const tu = live.sort((a, b) => Math.hypot(a.at.x - me.x, a.at.z - me.z) - Math.hypot(b.at.x - me.x, b.at.z - me.z))[0];
        return nearestOf(game, GIDS) || (tu ? { x: tu.at.x, z: tu.at.z, y: tu.at.y, r: 1.2 } : null);
      },
      update(m, game, dt) {
        for (const t of m.turrets || []) t.update(dt);
        const n = standing(game, GIDS), k = (m.turrets || []).filter((t) => t.dead).length;
        say(m, game, `שלב 1 · שומרי הצל (${GUARDS.length - n}/${GUARDS.length}) · צריחים (${k}/3) · סומנת ${game.paint.hits}/3`);
        return !n && k === 3 ? 'next' : null;
      },
    },
    { // 2: phase two — fists, face to face
      objective: 'שלב 2 · פנים אל פנים', checkpoint: true,
      enter(m, game) {
        const c = C(game);
        for (const t of m.turrets || []) t.dispose(); m.turrets = [];
        if (m.s.cp === 2) for (const gd of post(game, GUARDS.map((g) => ({ id: g.id, at: [F4(game, g.lx, g.lz)] })))) game.paint.markGuard(gd, 'restore');
        const sh = shadowAt(game, F4(game, 0.4, 18.4), Math.PI);
        game.cutscene = true; game.hud.setCinematic(true);
        game.follow.shot({ x: c.arena.x - 3.5, y: c.arena.y + 2.2, z: c.arena.z - 2.5 }, { x: sh.pos.x, y: sh.pos.y + 1.4, z: sh.pos.z }, 9999);
        m.s.p = 'talk';
        m.beats = beats(game, [
          ['do', () => { shield(m, game, false); game.sound?.hit?.('block', 0.8); game.fx.sparks(sh.pos.x, sh.pos.y + 1.6, sh.pos.z - 2, 30); }],
          ['wait', 0.5],
          ['do', () => { const q = F4(game, 3.3, 14.6); sh.walkTo(q.x, q.z, { near: 0.5 }); }], // round the end of his desk
          ['say', SHIELD_DOWN],
          ['do', () => {
            game.paint.disarmPlayer();
            const a = c.arena; sh.target = null; sh.place(a.x, a.z + 2.4, Math.PI, a.y);
            game.player.place(a.x, a.z - 0.4, 0, a.y);
            game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(0);
            m.fight = new Fight(game, {
              opponents: [{ npc: sh, boss: true, name: 'הצל', hp: 240, power: 1.1, windup: 1.0, open: 1.05, armor: 0.75, aggression: 1.0, moves: ['slam', 'swing', 'cross', 'swing'], phases: [{ at: 0.5 }] }],
              onPhase: () => { m.s.half = true; }, onWin: () => { m.s.half = true; }, onLose: () => { m.s.lost = true; },
            });
            game.hud.banner('הצל · שלב 2 מתוך 3', 'FIST COMBAT', 'אגרוף · מכה חזקה · דחיפה · חסימה · התחמקות', 2800);
            game.hud.toast(FISTS_TIP, 3200);
            m.s.p = 'fight';
          }],
        ]);
      },
      update(m, game, dt) {
        m.beats?.update(dt);
        if (m.s.p === 'fight') {
          if (m.s.lost) return `fail:${FIST_LOST}`;
          say(m, game, 'שלב 2 · הצל · פנים אל פנים');
          if (m.s.half) return 'next';
        }
        return null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.fight?.dispose(); m.fight = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 3: phase three — the door gives, Erez and Ido are in, his two bodyguards, the last fight
      objective: 'שלב 3 · הקרב האחרון', checkpoint: true,
      enter(m, game) {
        const c = C(game), a = c.arena;
        game.paint.disarmPlayer();
        const sh = game.npc('shadow');
        if (m.s.cp === 3 || !sh.visible) shadowAt(game, F4(game, 0, 9.4), Math.PI);
        sh.model.setPose('floored');
        game.cutscene = true; game.hud.setCinematic(true);
        const d = c.door.pos;
        game.follow.shot({ x: d.x + 3.2, y: d.y + 2.4, z: d.z + 6 }, { x: d.x, y: d.y + 1.3, z: d.z }, 9999);
        m.s.p = 'in';
        m.beats = beats(game, [
          ['do', () => { c.door.unlock(); c.door.setOpen(true); game.sound?.hit?.('crash', 0.9); game.follow.shake(0.4); }],
          ['do', () => {
            for (const [id, dx] of [['erez', -1.6], ['ido', 1.6]]) {
              const n = game.npc(id); unarm(game, id); game.squad.send(id, { x: a.x + dx, z: a.z - 1 }, { label: 'בקרב' });
              n.target = null; n.idle = null; n.posed = false; n.model.setPose(null); n.place(d.x + dx * 0.6, d.z + 1.2, 0, d.y); n.walkTo(a.x + dx, a.z - 1.2, { run: true, near: 0.6 });
            }
          }],
          ['wait', 1.6],
          ['say', IN.slice(0, 2)],
          ['do', () => {
            sh.model.setPose(null); sh.model.play('getup', { speed: 0.9 });
            c.escapeDoor.unlock(); c.escapeDoor.setOpen(true);
            BODY.forEach((id, i) => { const n = game.npc(id); n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null); n.place(c.escapeAt.x + 0.8, c.escapeAt.z + (i ? 1.0 : -0.8), Math.PI / 2, c.escapeAt.y); n.show(true); const q = F4(game, i ? -3.2 : -4.5, i ? 3.6 : 2.4); n.walkTo(q.x, q.z, { run: true, near: 0.6 }); }); // north of the console, clear of it
            game.follow.shot({ x: a.x + 4, y: a.y + 2.6, z: a.z - 3.5 }, { x: c.escapeAt.x, y: a.y + 1.3, z: c.escapeAt.z + 2 }, 9999);
          }],
          ['say', [IN[2]]],
          ['do', () => {
            c.escapeDoor.lock();
            game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(0);
            game.player.place(a.x, a.z - 2, 0, a.y);
            m.fight = new Fight(game, {
              opponents: [
                { npc: sh, boss: true, name: 'הצל', hp: 125, power: 1.15, windup: 0.95, open: 1.0, armor: 0.75, aggression: 1.1, moves: ['slam', 'swing', 'cross', 'slam'], phases: [{ at: 0.45, aggression: 1.3, windup: 0.85 }] },
                { npc: game.npc(BODY[0]), hp: 65, power: 0.9, guard: 0.35, moves: ['jab', 'cross', 'swing'], name: 'שומר ראש' },
                { npc: game.npc(BODY[1]), hp: 65, power: 0.9, guard: 0.35, moves: ['cross', 'swing'], name: 'שומר ראש' },
              ],
              allies: [{ npc: game.npc('erez'), hp: 95, power: 0.8 }, { npc: game.npc('ido'), hp: 95, power: 0.8 }],
              maxAttackers: 2,
              onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; },
            });
            game.hud.banner('הצל · שלב 3 מתוך 3', 'הקרב האחרון', 'ארז ועידו איתך · רק נהוראי מפיל אותו', 2800);
            m.s.p = 'fight';
          }],
        ]);
      },
      update(m, game, dt) {
        m.beats?.update(dt);
        if (m.s.p === 'fight') {
          if (m.s.lost) return `fail:${FIST_LOST}`;
          const left = m.fight ? m.fight.standing.length : 0;
          say(m, game, m.s.won ? 'הצל על הרצפה' : `שלב 3 · הצל ושני שומרי הראש (${3 - left}/3) · ארז ועידו איתך`);
          if (m.s.won) return 'next';
        }
        return null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.fight?.dispose(); m.fight = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
    { // 4: on the floor, he smiles; his emergency elevator; gone
      objective: 'הצל על הרצפה', checkpoint: true,
      enter(m, game) {
        const c = C(game), sh = game.npc('shadow');
        shadowAt(game, F4(game, -9.5, 3.0), -Math.PI / 2); // (where the last blow left him: the cut hides the step)
        sh.target = null; sh.model.setPose('down');
        for (const id of BODY) { const n = game.npc(id); if (n.visible) n.model.setPose('down'); }
        game.cutscene = true; game.hud.setCinematic(true);
        const e = c.escapeAt;
        game.follow.shot({ x: e.x + 7, y: e.y + 2.2, z: e.z + 5 }, { x: (e.x + sh.pos.x) / 2, y: e.y + 1, z: (e.z + sh.pos.z) / 2 }, 9999);
        m.beats = beats(game, [
          ['wait', 0.6],
          ['say', DOWN],
          ['do', () => { c.escapeDoor.unlock(); c.escapeDoor.setOpen(true); game.sound?.beep?.(2, 520); sh.model.setPose(null); sh.model.play('getup', { speed: 1.2 }); }],
          ['wait', 0.7],
          ['do', () => { m.s.goT = game.time; sh.walkTo(c.escapeInside.x, c.escapeInside.z, { run: true, near: 0.4 }); }],
          ['until', () => !sh.target || game.time - m.s.goT > 3.5],
          ['do', () => { c.escapeDoor.lock(); sh.show(false); game.sound?.hit?.('block', 0.8); game.follow.shake(0.25); game.player.place(e.x + 1.2, e.z, -Math.PI / 2, e.y); game.follow.shot({ x: e.x + 3.6, y: e.y + 1.9, z: e.z + 2.4 }, { x: c.escapeDoor.pos.x, y: e.y + 1.3, z: c.escapeDoor.pos.z }, 9999); }],
          ['say', GONE],
        ]);
      },
      update(m, game, dt) { m.beats?.update(dt); return m.beats?.done ? 'next' : null; },
      exit(m, game) {
        m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        // the whole gang in now, every marker in its owner's hands again
        const c = C(game);
        for (const id of TEAM) { game.squad.tasks.delete(id); const n = game.npc(id); n.idle = null; n.model.setPose(null); }
        OTHERS.forEach((id, i) => { const n = game.npc(id); n.target = null; n.place(c.inside.x - 3 + (i % 3) * 3, c.inside.z + 1 + Math.floor(i / 3) * 1.5, 0, c.inside.y); });
        game.squad.refresh(true);
        armed(game, game.squad.ids); rearm(game, 'erez'); rearm(game, 'ido');
      },
    },
    { // 5: the computer he left behind: what the Order has, and how he knew
      objective: 'המחשב של הצל', checkpoint: true,
      enter(m, game) {
        const c = C(game);
        c.escapeDoor.lock(); game.npc('shadow').show(false);
        for (const id of BODY) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
        offBoard(game, GIDS);
        if (m.s.cp === 5) armed(game, game.squad.ids);
        m.s.p = 'go'; c.screen.show('map');
      },
      interaction(m, game) {
        const c = C(game);
        if (m.s.p !== 'go' || game.mode !== 'foot' || !near(game.player.pos, c.computer, 1.8)) return null;
        return { label: 'לבדוק את המחשב', priority: 6, run: () => {
          m.s.p = 'read'; c.screen.show('data');
          game.sound?.beep?.(1, 880);
          // Ido at the keyboard beside him, behind the desk on the command floor (the cut to the screen hides the
          // walk round the desk; the spot has the floor's height, so a Job that puts him there keeps it)
          const side = game.player.pos.x > c.computer.x + 0.3 ? -1 : 1, at = { x: c.computer.x + side * 1.0, z: c.computer.z + 0.3, y: c.computer.y, yaw: Math.PI };
          const ido = game.npc('ido'); ido.target = null; ido.idle = null; ido.posed = false; ido.model.setPose(null); ido.place(at.x, at.z, at.yaw, at.y);
          m.job = new FloorJob(game, { who: 'ido', at, seconds: 7, near: 12, pill: 'עידו מעתיק את הנתונים', onDone: () => { m.s.copied = true; c.screen.show('data', { progress: 1 }); } });
          game.cutscene = true; game.hud.setCinematic(true);
          game.follow.shot({ x: c.computer.x - 1.6, y: c.computer.y + 1.7, z: c.computer.z + 1.4 }, { x: c.computer.x, y: c.computer.y + 1.2, z: c.computer.z - 1.7 }, 9999);
          m.beats = beats(game, [['say', DATA], ['until', () => m.s.copied], ['say', COPIED.slice(0, 1)], ['do', () => {
            game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
            // Liam off to the port for the Renault (he waits with it by the plaza's vehicle gate)
            const L = game.npc('liam'); game.paint.removeAlly(L); game.squad.ids = game.squad.ids.filter((id) => id !== 'liam'); game.squad.tasks.delete('liam'); game.squad.refresh(true);
            L.target = null; L.walkTo(c.doorAt.x, c.doorAt.z - 2, { run: true, near: 0.8, onArrive: () => L.show(false) });
          }], ['say', COPIED.slice(1)], ['do', () => { const L = game.npc('liam'); L.target = null; L.show(false); m.s.p = 'done'; }]]);
        } };
      },
      target(m, game) { const c = C(game); return m.s.p === 'go' ? { ...c.computer, r: 1.1 } : null; },
      update(m, game, dt) {
        const c = C(game);
        m.beats?.update(dt);
        if (m.job && !m.s.copied) { m.job.update(dt); if (m.job.phase === 'work') c.screen.show('data', { progress: Math.min(0.99, m.job.t / 7) }); }
        say(m, game, m.s.p === 'go' ? 'המחשב על השולחן של הצל' : m.s.p === 'read' ? 'מה יש לצל על המסדר — ועלינו' : 'הנתונים אצלנו');
        return m.s.p === 'done' ? 'next' : null;
      },
      exit(m, game) { m.beats?.cancel(); m.beats = null; m.job?.cancel(); m.job = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
