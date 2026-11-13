// Chapter ten, mission 10, THE LAST STAND. The Shadow has switched on every defence the citadel has left and the
// tower is in emergency; the gang goes up it through four arenas, each its own kind of play:
//   1. the energy hall (+7): the big paint fight in three waves, shield bearers (flank them, shove them, or order the
//      gang forward to flank), heavies posted by energy cells that blow when shot (a warning ring first), runners;
//   2. the tower bridge (+14): out over bridge A and up the bridgehead, two runners met with fists on the platform,
//      then forward while segments fall (each one warned): a leap, Erez short at the broken edge and Nehorai's hand,
//      a detour on the yellow catwalk, and three emitters by the upper door that fire warned bolts, shot out;
//   3. the machine room (+14): Muller shuts the energy source down (a bar) while the friends each hold an approach
//      and Nehorai the worst one; twice Muller calls for a breaker only he can reach;
//   4. the last hall's door: a fist fight beside Erez and Ido against two heavies, then everyone walks up together
//      and the door shuts behind them. Mission 57 carries on in the last hall.
// Paint and fists only: the marked sit down, nobody is hurt; nobody of the gang betrays, nobody of the gang dies;
// every blast and bolt is warned first. Invented, all of it.
import * as THREE from 'three';
import { near, say, nearestGuard } from './missions.js';
import { Fight } from '../combat/fight.js';
import { FIGHT_AS } from '../characters/extras.js';
import { OUT_AT } from '../combat/paint.js';
import { Leap, giveHand, Switch, gone, endCrew } from './infinity.js';
import { FBlast, stay } from './phoenix-c.js';
import {
  CIT, ORDER, TEAM, armed, offBoard, Wave, beats, later, talkOn, bandage, hush, buddiesOff, wipeOff, freshMarks, inCitadel,
  citadelBack, asNehorai, become, nehoraiAway, lastDoor,
} from './infinity-c.js';

// ---------- where (the citadel's own frame: the tower is x 32..112, z -36..36; the bridges west of it) ----------
const FY = (g, k) => { const Z = CIT(g); return { hall: Z.energyHall.y, roof: Z.bridges.y, bridge: Z.towerBridge.y, machine: Z.machine.y, last: Z.lastHall.y }[k]; };
const T = (g, lx, lz, k = 'hall', yaw) => { const p = CIT(g).toWorld(lx, lz); return { x: p.x, z: p.z, y: FY(g, k), ...(yaw != null ? { yaw } : {}) }; };
const LX = (g, p) => p.x - CIT(g).x;
const W = -Math.PI / 2, E = Math.PI / 2, N = Math.PI, S = 0;
const sameFloor = (a, b, d = 1.5) => Math.abs(a.y - b.y) < d;
// where each checkpoint begins (the gang formed up behind him, every slot on the floor)
const START = [(g) => T(g, 84, -22, 'hall', W), (g) => T(g, 35.5, -24, 'hall', W), (g) => T(g, 40, -30, 'machine', E), (g) => T(g, 77, 28, 'machine', E)];

// ---------- the lines that are not the user's (the spec has none for this mission): short, each in his own voice ----------
const HALL_IN = [['מולר', 'הוא הפעיל את כל מערכות ההגנה. המצודה במצב חירום.'], ['עידו', 'אז שיפעיל. אנחנו כבר בפנים.'], ['ארז', 'נהוראי, תן פקודות. אנחנו איתך.']];
const SHIELD_TIP = [['ארז', 'יש להם מגנים! לאגף מהצד, לדחוף, או להגיד לנו "תתקדמו" ואנחנו מאגפים.']];
const HEAVY_TIP = [['מולר', 'הכבדים עומדים ליד תאי אנרגיה. ירייה בתא, וכולם אחורה מהטבעת.']];
const RUNNER_TIP = [['יונתי', 'רצים! לסמן אותם לפני שהם מגיעים. אני מצלם.']];
const WAVE_DONE = [[['דולב', 'גל אחד בחוץ. אני מתחיל להנות מזה.']], [['אברהם', 'שני גלים! רשמו את זה בספר.']]];
const HALL_CLEAR = [['ליאם', 'אחים יקרים, האולם נקי.'], ['מולר', 'פותח את הדלת לגשר. משם למעלה, אל גשר המגדל.']];
const RUNNERS_IN = [['ליאם', 'רצים על הגשר! בלי מרקרים, בידיים!'], ['הדר', 'Bro, אגרופים? סוף סוף משהו שאני מבין בו.']];
const RUNNERS_OUT = [['הדר', 'Easy. הבא בתור.']];
const SEG_WARN = [['מולר', 'נהוראי! הקטע שלפניך נופל! לעצור!']];
const EREZ_SHORT = [['ארז', 'נהוראי!!! היה לי קצת קצר פה!']];
const EREZ_UP = [['ארז', 'תודה, אחי. עכשיו אני חייב לך אחת.'], ['עידו', 'הוא חייב לו כבר מאה. מי סופר.']];
const TWO_WARN = [['מולר', 'עוד שניים נופלים! על המסלול הצהוב, בצד!']];
const EMIT_TIP = [['עידו', 'פולטים ליד הדלת! כשהכדור נאסף, לזוז הצידה ולירות בהם!']];
const DOOR_UP = [['עידו', 'פתוח! חדר המכונה, בבקשה, תיכנסו.']];
const MACHINE_IN = [['מולר', 'אני על המסוף. תנו לי דקה ואני מכבה לו את מקור האנרגיה.'], ['ארז', 'כל אחד על פתח. נהוראי, הצפוני הכי חם.']];
const BREAKER_CALL = [[['מולר', 'נהוראי! מפסק קפץ במסדרון הצפוני! רק אתה מגיע אליו!']], [['מולר', 'עוד מפסק! בקצה המזרחי של המסדרון הצפוני!']]];
const BREAKER_ON = [['מולר', 'יש! ממשיך.']];
const SOURCE_OFF = [['מולר', 'מקור האנרגיה כבוי. המכונה שלו על סוללות עכשיו.'], ['עידו', 'סוללות? אז יש לנו בערך עשר דקות לפני שהוא קונה חדשות.']];
const HEAVIES = [['עידו', 'שני כבדים בדלת. בלי מרקרים?'], ['ארז', 'בלי מרקרים. ביחד, כמו פעם.']];
const OPENS = [['ליאם', 'הדלת נפתחה לבד. אחים יקרים, זה לא סימן טוב.'], ['מולר', 'הוא מחכה לנו למעלה. שיחכה עוד שנייה.']];
const SHUT = [['ארז', 'זהו. הדלת נסגרה. רק אנחנו והוא.'], ['עידו', 'והוא לבד. אנחנו לא.']];

// fails: a reason and a tip
const HALL_LOST = 'נהוראי סומן שלוש פעמים באולם האנרגיה. ארז: "מההתחלה, אחי. ממחסה למחסה, יורים בתאים כשהם לידם, ונותנים לנו פקודות."';
const FISTS_LOST = 'הרצים הפילו אותך על הגשר. הדר: "Bro, שוב. לחסום כשהם מתנופפים, דחיפה כשהם נכנסים, ואז קומבו."';
const BRIDGE_LOST = 'נהוראי סומן שלוש פעמים על גשר המגדל. עידו: "כשהכדור מתחיל להיאסף, זזים הצידה. ויורים בפולטים מקרוב."';
const MACHINE_LOST = 'נהוראי סומן שלוש פעמים בחדר המכונה. מולר: "מההתחלה. מאחורי המחסות במסדרון, וזורקים את המפסק כשאני קורא."';
const MULLER_LOST = 'מולר סומן שלוש פעמים והכיבוי נעצר. ארז: "מההתחלה. הפעם עוצרים אותם במסדרון הצפוני, לפני שהם רואים אותו."';
const DOOR_LOST = 'הכבדים בדלת הפילו אותך. עידו: "שוב, אחי. לחסום כשהם מתנופפים, ולחכות ל׳עכשיו!׳, ואז להכניס."';

// ---------- the energy hall: three waves ----------
const g6 = (id, fx, fz, px, pz, o = {}) => ({ id, f: [fx, fz], p: [px, pz], ...o });
const HALL_WAVES = [
  { name: 'נושאי מגן · לאגף, לדחוף, או "תתקדמו!"', tip: SHIELD_TIP, list: [
    g6('og1', 40, -30, 70, -30), g6('sh1', 42, -24, 76, -26), g6('og2', 40, -14, 72, -18), g6('og3', 44, -4, 74, -10), g6('sh2', 44, 6, 78, -14), g6('og4', 40, 16, 70, -4)] },
  { name: 'כבדים ליד תאי אנרגיה · לירות בתא', tip: HEAVY_TIP, list: [
    g6('hv1', 61, -25, 61, -25, { still: true, hot: false }), g6('og5', 40, -18, 66, -16), g6('hv2', 49.5, -7, 49.5, -7, { still: true, hot: false }), g6('og6', 40, 2, 60, -6), g6('og7', 42, 12, 68, 0), g6('og8', 38, -10, 56, -18)] },
  { name: 'רצים · לסמן לפני שהם מגיעים', tip: RUNNER_TIP, list: [
    g6('rn1', 40, -28, 70, -24), g6('rn2', 40, -12, 70, -14), g6('sh3', 40, -20, 70, -20), g6('rn3', 40, 4, 70, -6), g6('og9', 38, 0, 66, -8), g6('rn4', 44, 20, 72, 0)] },
];
// (a heavy walks to his post by the cell and holds it: he is not sent at the gang, he waits to see them)
const asWave = (g, w, k = 'hall') => w.list.map((q) => ({ id: q.id, from: T(g, q.f[0], q.f[1], k, E), post: T(g, q.p[0], q.p[1], k), still: !!q.still, ...(q.hot != null ? { hot: q.hot } : {}) }));

// the energy cells: a pellet sets one off (its ring warns for a breath), and whoever of the Order stands in the ring sits
function cells(m, game) {
  const P = game.paint;
  m.cells = CIT(game).energyHall.cells.map((c) => {
    c.reset();
    const pr = P.addProp({ x: c.x, y: c.y + 1.0, z: c.z, r: 0.8, hits: 1, label: 'תא אנרגיה', onHit: () => {
      game.hud.pop('תא אנרגיה · להתרחק!', 'hit');
      m.live.push(new FBlast(game, { at: { x: c.x, y: c.y, z: c.z }, warn: 1.7, radius: 5, size: 1.6, flash: true, onBoom: () => { c.blow(); game.energy?.sparks?.(c.x, c.y + 1, c.z, '#5cc8ff', 24, 6); } }));
    } });
    return { c, pr };
  });
}
function noCells(m, game) { for (const q of m.cells || []) { game.paint.removeProp(q.pr); q.c.reset(); } m.cells = []; }

// a shield bearer shoved: his shield knocked aside for a moment (a pellet from in front marks him then)
function shoveNear(m, game) {
  const me = game.player.pos;
  for (const gd of game.paint.guards) {
    if (!gd.shield || gd.marked || !gd.npc.visible || !near(gd.npc.pos, me, 2.3) || !sameFloor(gd.npc.pos, me)) continue;
    return { label: 'לדחוף את המגן', priority: 7, run: () => {
      const n = gd.npc, dx = n.pos.x - me.x, dz = n.pos.z - me.z, d = Math.hypot(dx, dz) || 1;
      game.nehorai.play('shove'); game.sound?.hit?.('block', 0.8); game.follow.shake(0.2);
      n.target = null; n.place(n.pos.x + dx / d * 1.1, n.pos.z + dz / d * 1.1, n.yaw + 1.6, n.pos.y); n.model.flash?.(0.8);
      gd.shield = false; gd.cool = Math.max(gd.cool, 1.4); m.shoved.push({ gd, t: 2.8 });
      game.hud.pop('המגן הוסט! עכשיו!', 'counter');
      m.s.shoves = (m.s.shoves || 0) + 1;
    } };
  }
  return null;
}
function shovesOn(m, dt) { for (const q of m.shoved) if ((q.t -= dt) <= 0 && !q.gd.marked) q.gd.shield = true; m.shoved = m.shoved.filter((q) => q.t > 0); }
// "תתקדמו!": two of the gang go round a shield bearer, one to each side, and mark him from there. In the machine
// room Erez and Ido do it by themselves (`who`, after `wait` seconds of him there) and go back to their posts (`back`)
function flanking(m, game, dt, { who = null, wait = 0, back = null } = {}) {
  const q = game.squad, P = game.paint;
  if (!who && q.mode !== 'advance') return;
  for (const gd of P.guards) {
    if (!gd.shield || gd.marked || !gd.npc.visible || !gd.alerted) continue;
    if (who && ((gd.flankWait = (gd.flankWait || 0) + dt) < wait)) continue;
    let f = m.flank.get(gd);
    if (!f) {
      const free = (who || q.ids.filter((id) => !q.tasks.has(id))).filter((id) => !P.allies.find((a) => a.npc.id === id)?.marked && [...m.flank.values()].every((o) => !o.ids.includes(id)));
      const ids = free.sort((a, b) => Math.hypot(game.npc(a).pos.x - gd.npc.pos.x, game.npc(a).pos.z - gd.npc.pos.z) - Math.hypot(game.npc(b).pos.x - gd.npc.pos.x, game.npc(b).pos.z - gd.npc.pos.z)).slice(0, 2);
      if (!ids.length) continue;
      f = { ids, t: 0 };
      m.flank.set(gd, f);
      ids.forEach((id, i) => { const a = gd.npc.yaw + (i ? -1 : 1) * 1.7, sp = { x: gd.npc.pos.x + Math.sin(a) * 4.5, z: gd.npc.pos.z + Math.cos(a) * 4.5 }; q.send(id, sp, { label: 'מאגף' }); });
      later(m, game, [[f.ids[0] === 'hadar' ? 'הדר' : NAMES_HE[f.ids[0]], 'מאגף מהצד!']]);
    }
    f.t += dt; f.cool = (f.cool ?? 0) - dt;
    const side = f.ids.map((id) => game.npc(id)).find((n) => near(n.pos, gd.npc.pos, 6.5) && !n.target);
    if (side && f.t > 2.2 && f.cool <= 0) { f.cool = 0.9; P.hitGuard(gd, P.allies.find((a) => a.npc === side) || side.id, side.pos); }
    if (f.t > 9) { const n = game.npc(f.ids[0]); P.markGuard(gd, n.id); } // they always get there in the end
  }
  for (const [gd, f] of m.flank) if (gd.marked || !gd.npc.visible) { for (const id of f.ids) { if (back) back(id); else q.release(id); } m.flank.delete(gd); }
}
const NAMES_HE = { erez: 'ארז', ido: 'עידו', yonati: 'יונתי', avraham: 'אברהם', muller: 'מולר', dolev: 'דולב', hadar: 'הדר', liam: 'ליאם' };

// ---------- the tower bridge ----------
const JX = (g, k) => CIT(g).towerBridge.segments[Math.min(k, 7)].x0 - CIT(g).x + (k > 7 ? 5.125 : 0);
const segAt = (g) => CIT(g).towerBridge.segmentAt(g.player.pos);
// segments that fall: a red pulse over them and beeps for `seconds`, then down they go
function warnSegs(m, game, idx, seconds, onDrop) {
  const B = CIT(game).towerBridge;
  const meshes = idx.map((i) => {
    const s = B.segments[i], mesh = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 - 0.2, 0.04, 2.9), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.4, depthWrite: false }));
    mesh.position.set(s.centre.x, s.centre.y + 0.05, s.centre.z); game.scene.add(mesh); return mesh;
  });
  game.follow.shake(0.15); game.sound?.hit?.('crash', 0.4);
  let t = 0, beep = -1;
  const w = {
    done: false,
    update(dt) {
      if (w.done) return;
      t += dt;
      const k = t / seconds;
      for (const me of meshes) me.material.opacity = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * (8 + 20 * k)));
      const tick = Math.floor(t * (k > 0.6 ? 6 : 2));
      if (tick !== beep) { beep = tick; game.sound?.beep?.(1, k > 0.6 ? 1200 : 880); }
      if (t < seconds) return;
      w.dispose();
      // whoever still stands on them is pulled back to the near side (a mark for Nehorai: he was warned)
      const near0 = B.segments[idx[0]].from, me = game.player.pos, on = idx.includes(B.segmentAt(me));
      for (const i of idx) { B.drop(i); const c = B.segments[i].centre; game.fx.dust(c.x, c.y, c.z, 1.6); }
      game.sound?.hit?.('crash', 1); game.follow.shake(0.5);
      for (const id of game.squad.ids) { const n = game.npc(id); if (idx.includes(B.segmentAt(n.pos))) { n.target = null; n.place(near0.x - 1.2, near0.z + (Math.random() - 0.5) * 1.6, E, near0.y); } }
      if (on && !game.player.busy) { game.player.place(near0.x, near0.z, E, near0.y); game.hud.pop('כמעט נפלת!', 'hit'); game.follow.shake(0.4); }
      onDrop?.();
    },
    dispose() { w.done = true; for (const me of meshes) gone(me); meshes.length = 0; },
  };
  return w;
}
// Erez a body thrown short of the far edge: carried there by the mission (no gravity for friends)
function fling(m, game, n, a, b, { seconds = 0.8, arc = 0.9, pose = 'hang' } = {}) {
  m.fly = { n, a, b, T: seconds, H: arc, t: 0, pose, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}
function flyOn(m, game, dt) {
  const f = m.fly; if (!f || f.done) return;
  f.t += dt;
  const k = Math.min(1, f.t / f.T), x = f.a.x + (f.b.x - f.a.x) * k, z = f.a.z + (f.b.z - f.a.z) * k, y = f.a.y + (f.b.y - f.a.y) * k + f.H * 4 * k * (1 - k);
  const n = f.n; n.target = null; n.floorY = y; n.place(x, z, f.yaw, y); n.model.setPose(k < 1 ? 'tuck' : f.pose);
  if (k >= 1) { f.done = true; game.sound?.hit?.('block', 0.7); game.follow.shake(0.15); }
}
// the emitters on the tower's west face by the upper door: each fires a warned bolt down the bridge, three hits put one out
function emitters(m, game) {
  const Z = CIT(game), y = Z.towerBridge.y;
  const list = [[31.1, -36.4, 3.3, 0], [31.1, -27.6, 3.3, 1.2], [31.1, -32, 3.9, 2.3]].map(([lx, lz, h, t0]) => {
    const p = Z.toWorld(lx, lz), g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.5, metalness: 0.6 }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshBasicMaterial({ color: '#b48cff' }));
    eye.position.x = -0.32; g.add(body, eye); g.position.set(p.x, y + h, p.z); game.scene.add(g);
    const e = { x: p.x, y: y + h, z: p.z, g, eye, t: t0 + 1.5, live: true };
    e.pr = game.paint.addProp({ x: p.x - 0.2, y: y + h, z: p.z, r: 0.55, hits: 3, label: 'פולט', onHit: (pr) => {
      game.energy?.sparks?.(e.x - 0.3, e.y, e.z, '#b48cff', 8, 3);
      if (!pr.done || !e.live) return;
      e.live = false; eye.material.color.set('#202024'); game.fx.explode(e.x - 0.3, e.y, e.z, { size: 0.5, shake: false, debris: false });
    } });
    return e;
  });
  return {
    list, on: false,
    get left() { return list.filter((e) => e.live).length; },
    update(dt) {
      if (!this.on) return;
      const me = game.player.pos;
      for (const e of list) {
        if (!e.live || (e.t -= dt) > 0) continue;
        e.t = 4.4;
        if (game.player.busy || game.cutscene || Math.abs(me.y - y) > 2 || Math.hypot(me.x - e.x, me.z - e.z) > 26) continue;
        game.energy?.bolt({ from: { x: e.x - 0.7, y: e.y, z: e.z }, target: 'player', speed: 8, warn: 1.0, label: 'ברק מהפולט!' });
      }
    },
    dispose() { for (const e of list) { game.paint.removeProp(e.pr); e.g.removeFromParent(); e.g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } list.length = 0; },
  };
}

// ---------- the machine room ----------
const POSTS = { west: [[59.4, 3.6, W], [59.4, -3.6, W]], south: [[68.4, 12.4, S], [75.6, 12.4, S], [72, 11.6, S]], north: [[67.5, -22.6, E], [67.5, -31.4, E]] }; // (Erez and Ido out in the north corridor with him)
const HOLDS = { west: ['dolev', 'liam'], south: ['yonati', 'avraham', 'hadar'], north: ['erez', 'ido'] };
const FROM = { west: [36, 22], south: [40, 30], north: [104, -28] };
const TO = { west: [48.5, 0], south: [72, 24], north: [72, -24] };
const INSIDE = [70.5, -8.5]; // where a guard who got past the north corridor makes for (Muller's console is 8.6 m on)
const MACHINE_WAVES = [
  { at: 3, list: [['og1', 'west'], ['og4', 'south'], ['og7', 'north'], ['og8', 'north']] },
  { at: 17, list: [['og2', 'west'], ['og5', 'south'], ['sh1', 'north']] },
  { at: 30, list: [['og3', 'west'], ['og6', 'south'], ['hv1', 'north'], ['og9', 'north']] },
  { at: 44, list: [['rn1', 'north'], ['og10', 'north']] },
  { at: 56, list: [['rn2', 'north'], ['og11', 'north']] },
];
const BAR_TIME = 60, BREAKS = [1 / 3, 2 / 3];
const BREAKERS = [[56, -34.0], [92, -34.0]];
const MULLER_AT = (g) => ({ ...CIT(g).machine.consoleAt });
const WORST = (g) => T(g, 72, -26, 'machine', N);

// ---------- the last hall's door ----------
const DOOR_FIGHT = { erez: [77, 25.8], ido: [77, 30.2], hv1: [85, 26.6], hv2: [85, 30.4] };
const CHEER = [[71.5, 24, 'yonati'], [71, 26.6, 'avraham'], [70.6, 29.2, 'muller'], [71, 31.8, 'dolev'], [72.6, 33.6, 'hadar'], [72.4, 22.4, 'liam']];
const IN_SPOTS = [[109, 27], [110.5, 29.4], [105.6, 26.4], [108, 24.6], [110.5, 25], [106.6, 22.8], [109.5, 22.4], [104.8, 29.2]];

// ---------- people ----------
function standAt(game, id, at, { yaw = null, show = true } = {}) {
  const n = game.npc(id);
  n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.face = null; n.model.setPose(null);
  n.place(at.x, at.z, yaw ?? at.yaw ?? n.yaw, at.y ?? null); n.show(show);
  return n;
}
const faceTo = (n, p) => { n.yaw = Math.atan2(p.x - n.pos.x, p.z - n.pos.z); n.lookAt(p.x, p.z); };
function fistsUp(m, game, { opp, allies, name, onWin, onLose, extra = {} }) {
  game.paint.disarmPlayer();
  for (const id of allies) { game.paint.removeAlly(game.npc(id)); const n = game.npc(id); game.squad.send(id, { x: n.pos.x, z: n.pos.z }, { label: 'בקרב' }); n.target = null; }
  game.squad.command('hold', { quiet: true });
  m.fight = new Fight(game, {
    // (the heavies a little lighter than chapter ten's standard: two of them, and Erez and Ido keep one busy)
    opponents: opp.map((id) => ({ npc: game.npc(id), ...(id.startsWith('hv') ? { ...FIGHT_AS.heavy, hp: 90 } : FIGHT_AS.runner), name })),
    allies: allies.map((id) => ({ npc: game.npc(id), hp: 95, power: 0.9 })),
    maxAttackers: 2, onWin, onLose, ...extra,
  });
  game.hud.banner('FIST COMBAT', name, 'אגרוף · מכה חזקה · דחיפה · חסימה · התחמקות', 2400);
}
function fistsDown(m, game, opp, allies) {
  m.fight?.dispose(); m.fight = null;
  // the beaten sit where they went down, out of everyone's way
  if (m.s.won) for (const id of opp) { const n = game.npc(id); n.body.enabled = false; n.target = null; n.model.setPose('down'); }
  for (const id of allies) game.squad.release(id);
  game.squad.command('follow', { quiet: true });
  armed(game, game.squad.ids);
}

// ---------- the whole scene at a checkpoint (a retry, a reload; a live carry-on from 55 keeps who stands where) ----------
function clearMine(m, game) {
  const P = game.player;
  if (P.scripted) P.release(P.scripted, P.pos.y);
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
  m.beats?.cancel(); m.beats = null; m.talk = [];
  for (const x of m.live || []) { if (x.cancel) x.cancel(); else x.dispose?.(); } m.live = [];
  m.fight?.dispose(); m.fight = null;
  for (const k of ['leap', 'hand', 'breaker', 'emit', 'warn']) { m[k]?.dispose?.(); m[k] = null; }
  noCells(m, game);
  if (m.fly?.n) { m.fly.n.floorY = null; m.fly.n.model.setPose(null); } m.fly = null;
  m.wave = null; m.waves = []; m.shoved = []; m.flank = new Map(); m.spawned = new Map();
  game.energy?.clear?.();
  game.hud.setBoss(null); game.hud.setPursuit(null);
  game.paint.onShield = null;
  if (game.mode === 'car') game.exitCar();
  P.crawl?.(false);
}
function stage(m, game, cp, { carry = false } = {}) {
  clearMine(m, game);
  const Z = CIT(game), EH = Z.energyHall, MR = Z.machine, B = Z.towerBridge;
  if (!carry) game.fx.resetAtmosphere();
  game.fx.redAlert(false, { id: 'm56' });
  inCitadel(game, { screen: 'alert' });
  Z.alarm?.on?.(true);
  B.restore();
  if (cp >= 2) for (const i of [2, 4, 5]) B.drop(i, true);
  const door = (d, open) => { if (open) { d.unlock(); d.setOpen(true); } else d.lock(); };
  door(EH.door, cp >= 1); door(MR.upperDoor, cp >= 2);
  lastDoor(game, 'shut');
  game.paint.dispose(); offBoard(game, ORDER); buddiesOff(game);
  if (game.playingAs !== 'nehorai') become(game, 'nehorai');
  asNehorai(game); game.nehorai.setPose(null);
  if (!carry) { const a = START[cp](game); game.player.place(a.x, a.z, a.yaw, a.y); game.follow.snapBehind(a.yaw); }
  game.squad.form(TEAM, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: carry });
  for (const id of TEAM) { const n = game.npc(id); n.show(true); n.model.setPose(null); n.floorY = null; }
  armed(game, TEAM);
  // the tower's emergency light on the floor the fight is on (outside on the bridge the yard's sirens do)
  const fl = cp === 0 ? EH : cp >= 2 ? MR : null;
  if (fl) game.fx.redAlert(true, { id: 'm56', at: { x: Z.x + 72, z: Z.z, y: fl.y }, r: 60, h: 3, intensity: 45, points: [[52, -18], [92, 18], [72, -30]].map(([lx, lz]) => ({ ...Z.toWorld(lx, lz), y: fl.y + 5.4 })) });
  game.sound?.music?.('epic', { fade: 0.4 });
  game.paint.reset(); freshMarks(game);
  m.s = { cp, t: 0, phase: null };
  m.said = null;
}
// came straight up from mission 55: on the energy hall's floor near the stairs' top, the gang with him
function liveFrom55(game) {
  const Z = CIT(game), p = game.player.pos, q = game.squad;
  return game.playingAs === 'nehorai' && q.active && q.ids.length >= 6 && Math.abs(p.y - Z.energyHall.y) < 1.3 && near(p, Z.energyHall.stairsTop, 14);
}
const failOn = (m, game, steps, reason) => (steps.includes(m.stepIndex) && game.paint.hits >= OUT_AT ? reason : null);

export default {
  id: 'laststand', chapter: 10, number: 10, title: 'THE LAST STAND', requires: ['return'], follows: true,
  where: 'במגדל המרכזי',
  startAt: (game) => { const Z = CIT(game); return Z ? { ...Z.mainHall.outside, r: 2 } : null; },
  reward: { money: 2000, text: 'ארבע זירות, חבורה אחת · 2,000 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; m.shoved = []; m.flank = new Map(); m.spawned = new Map(); m.cells = []; },
  // the start from anywhere: on foot, in the ordinary world, at the top of the stairs on the energy hall's floor
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    game.player.crawl?.(false);
    game.rift?.clear(); if (game.dimensionName) game.dimension(null);
    const a = START[0](game); game.player.place(a.x, a.z, a.yaw, a.y); game.follow.snapBehind(a.yaw);
  },
  failIf(m, game) {
    if (m.s.mullerMarks >= 3) return MULLER_LOST;
    return failOn(m, game, [0], HALL_LOST) || (m.s.phase !== 'fists' && failOn(m, game, [1], BRIDGE_LOST)) || failOn(m, game, [2], MACHINE_LOST);
  },
  restore(m, game, cp) { stage(m, game, cp); m.s.staged = true; },
  tick(m, game, dt) {
    hush(game); talkOn(m, game);
    for (const x of m.live) x.update?.(dt);
    m.live = m.live.filter((x) => !x.done);
    m.emit?.update(dt); m.warn?.update(dt); m.leap?.update?.(dt); m.hand?.update?.(dt); m.breaker?.update?.(dt);
    flyOn(m, game, dt);
    shovesOn(m, dt);
    wipeOff(game, dt, 6);
  },
  cleanup(m, game) {
    const carry = !!m.done && handsTo(game, 'endshadow');
    clearMine(m, game);
    offBoard(game, ORDER);
    game.fx.redAlert(false, { id: 'm56' });
    const Z = CIT(game);
    Z.alarm?.on?.(false);
    if (carry) {
      // mission 57 carries on in the last hall: Nehorai at its entry, bandaged and armed, the gang formed up and
      // armed round him, the door shut behind them, the music on; the bridge stays broken, the source off
      game.nehorai.setPose(null);
      return;
    }
    game.fx.resetAtmosphere();
    Z.towerBridge.restore();
    for (const c of Z.energyHall.cells) c.reset();
    Z.energyHall.door.lock(); Z.machine.upperDoor.lock();
    lastDoor(game, null);
    citadelBack(game);
    if (game.playingAs !== 'nehorai') become(game, 'nehorai');
    game.nehorai.setPose(null);
    bandage(game.nehorai, false);
    nehoraiAway(game);
    for (const id of TEAM) game.npc(id).model.setPose(null);
    endCrew(game);
  },

  steps: [
    { // 0: the energy hall
      objective: 'אולם האנרגיה', checkpoint: true,
      enter(m, game) {
        if (!m.s.staged) stage(m, game, 0, { carry: liveFrom55(game) });
        const s = m.s; s.staged = false; s.phase = 'fight'; s.k = 0; s.next = 2.5; s.t = 0; s.cleared = 0;
        cells(m, game);
        game.paint.onShield = (gd, by) => { if (by === 'player' && !s.shieldTip) { s.shieldTip = true; game.hud.toast('נושא מגן · לאגף, לדחוף (כפתור הפעולה), או פקודה "תתקדמו!"', 3600); } };
        game.hud.banner('אולם האנרגיה', 'המצודה במצב חירום', 'מחסות · תאי אנרגיה שמתפוצצים · פקודות לחבורה', 2600);
        later(m, game, HALL_IN);
      },
      target(m, game) {
        const s = m.s;
        if (s.phase === 'door') return { ...CIT(game).energyHall.doorInside, r: 2 };
        return nearestGuard(game, m.wave ? m.wave.ids : null);
      },
      interaction(m, game) { return shoveNear(m, game); },
      update(m, game, dt) {
        const s = m.s, Z = CIT(game);
        s.t += dt;
        if (s.phase === 'fight') {
          flanking(m, game, dt);
          if (!m.wave && s.t >= s.next) {
            const w = HALL_WAVES[s.k];
            m.wave = new Wave(game, asWave(game, w), { gap: 1.2 });
            later(m, game, w.tip);
          }
          const w = m.wave;
          if (w) {
            w.update(dt);
            say(m, game, `אולם האנרגיה · גל ${s.k + 1}/3 · נותרו ${w.left} · ${HALL_WAVES[s.k].name}`);
            if (w.done && w.left === 0) {
              m.wave = null; s.k++; s.cleared = s.k; s.next = s.t + 3;
              // a breather between two waves: the paint wiped off (a new stretch of the fight), friends up again
              freshMarks(game);
              if (s.k < 3) { later(m, game, WAVE_DONE[s.k - 1]); game.hud.toast('נשימה · הצבע נוקה · הגל הבא בדרך', 2200); }
              else {
                s.phase = 'door';
                game.squad.command('follow', { quiet: true });
                for (const [, f] of m.flank) for (const id of f.ids) game.squad.release(id);
                m.flank.clear();
                const d = Z.energyHall.doorInside, mu = game.npc('muller');
                game.squad.send('muller', { x: d.x + 1.2, z: d.z + 1.4 }, { label: 'בדלת' });
                s.doorT = 0;
                m.beats = beats(game, [
                  ['say', HALL_CLEAR],
                  ['until', () => near(mu.pos, d, 3.2) || s.doorT > 9],
                  ['do', () => { if (!near(mu.pos, d, 3.2)) { mu.target = null; mu.place(d.x + 1.2, d.z + 1.4, W, d.y); } mu.lookAt(d.x - 2, d.z); game.hud.toast('מולר פותח את הדלת · 2', 1200); }],
                  ['wait', 2],
                  ['do', () => { Z.energyHall.door.unlock(); Z.energyHall.door.setOpen(true); game.sound?.chime?.(true); game.squad.release('muller'); s.open = true; }],
                ]);
              }
            }
          } else say(m, game, `אולם האנרגיה · גל ${Math.min(3, s.k + 1)}/3 מגיע`);
          return null;
        }
        // the hall is clear: Muller opens the door onto bridge A
        s.doorT += dt;
        say(m, game, s.open ? 'אולם האנרגיה נקי · אל הדלת המערבית' : 'אולם האנרגיה נקי · מולר פותח את הדלת לגשר');
        m.beats?.update(dt);
        return s.open && m.beats?.done ? 'next' : null;
      },
      exit(m, game) { m.beats = null; noCells(m, game); game.paint.onShield = null; game.fx.redAlert(false, { id: 'm56' }); },
    },
    { // 1: the tower bridge
      objective: 'גשר המגדל', checkpoint: true,
      enter(m, game) {
        const s = m.s;
        if (s.staged) s.staged = false;
        s.phase = 'out'; s.t = 0; s.drops = 0; s.leapt = false; s.handDone = false; s.detour = 0; s.emitLeft = 3; s.open = false; s.won = false; s.lost = false; s.runnersDown = false;
        offBoard(game, ORDER); freshMarks(game);
        m.emit = emitters(m, game);
        game.hud.toast('גשר המגדל · דרך גשר א׳, ובמדרגות אל הגשר העליון', 3000);
      },
      target(m, game) {
        const s = m.s, Z = CIT(game), B = Z.towerBridge, p = game.player.pos, lx = LX(game, p);
        if (s.phase === 'out') {
          if (p.y > Z.bridges.y + 4) return { ...B.head.top, r: 2 };
          if (lx < -10) return { ...B.head.foot, r: 1.6 };
          if (lx < 31) return { ...T(game, -11, -24, 'roof'), r: 2 };
          return { ...Z.energyHall.doorOutside, r: 1.6 };
        }
        if (s.phase === 'fists') return null;
        if (s.phase === 'leap') return { ...B.segments[2].from, r: 1.2 };
        if (s.phase === 'hand') return { ...T(game, JX(game, 3) - 0.2, -32, 'bridge'), r: 0.8 }; // the edge Erez hangs from
        if (s.phase === 'detour') {
          if (lx < JX(game, 4) + 0.3 && p.z > Z.z - 34) return { ...B.detour.links[3], r: 1 };
          if (lx < JX(game, 6) - 0.4) return { ...T(game, JX(game, 6), -36.9, 'bridge'), r: 1 };
          return { ...B.detour.links[5], r: 1 };
        }
        if (s.phase === 'emit') { const e = m.emit.list.find((q) => q.live); return e ? { x: e.x, y: e.y - 3.3, z: e.z, r: 1.2 } : null; }
        if (s.phase === 'door') return { ...Z.machine.doorOutside, r: 1.6 };
        return null;
      },
      interaction(m, game) { return m.hand?.interaction(game) || m.leap?.interaction(game) || null; },
      update(m, game, dt) {
        const s = m.s, Z = CIT(game), B = Z.towerBridge, P = game.player, p = P.pos, lx = LX(game, p);
        s.t += dt;
        m.beats?.update(dt);
        if (s.phase === 'out') {
          say(m, game, p.y > Z.bridges.y + 2 ? 'גשר המגדל · במדרגות למעלה, אל הרציף' : lx < -10 ? 'גשר המגדל · על גג חדר הבקרה, אל המדרגות' : 'גשר המגדל · דרך הדלת המערבית וגשר א׳');
          // up on the bridgehead's platform: two runners come over the bridge at them
          if (sameFloor(p, { y: B.y }) && lx > -28.5 && lx < -12.3) {
            s.phase = 'fists';
            const a = T(game, -15, -32.6, 'bridge', W), b = T(game, -15.5, -34.6, 'bridge', W);
            standAt(game, 'rn1', a); standAt(game, 'rn2', b);
            later(m, game, RUNNERS_IN);
            fistsUp(m, game, { opp: ['rn1', 'rn2'], allies: ['hadar', 'liam'], name: 'רצים על הגשר', onWin: () => { s.won = true; }, onLose: () => { s.lost = true; } });
          }
          return null;
        }
        if (s.phase === 'fists') {
          say(m, game, 'FIST COMBAT · שני רצים · הדר וליאם איתך');
          if (s.lost) return `fail:${FISTS_LOST}`;
          if (s.won) {
            fistsDown(m, game, ['rn1', 'rn2'], ['hadar', 'liam']);
            s.runnersDown = true; s.phase = 'bridge';
            later(m, game, RUNNERS_OUT);
          }
          return null;
        }
        if (s.phase === 'bridge') {
          say(m, game, 'גשר המגדל · קדימה, אל הדלת העליונה');
          // the third segment goes as he comes onto the second
          if (!m.warn && segAt(game) >= 1) {
            game.dialogue.play(SEG_WARN);
            m.warn = warnSegs(m, game, [2], 2.2, () => {
              s.drops = 1; s.phase = 'leap'; m.warn = null;
              const seg = B.segments[2], others = game.squad.ids.filter((id) => id !== 'erez' && game.npc(id).visible);
              // the others land a few steps on, out of the way of the hand at the edge
              const spots = others.map((id, i) => T(game, JX(game, 3) + 2.6 + (i % 3) * 1.1, -32 + (i % 2 ? 0.8 : -0.8), 'bridge'));
              m.leap = new Leap(game, { from: seg.from, to: seg.to, label: 'לקפוץ', friendsFollow: others.map((id) => game.npc(id)), friendSpots: spots,
                onStart: () => { const n = game.npc('erez'); game.squad.send('erez', { x: seg.from.x - 1, z: seg.from.z }, { label: 'קופץ' }); if (!near(n.pos, seg.from, 4)) { n.target = null; n.place(seg.from.x - 1.2, seg.from.z + 0.6, E, seg.from.y); } },
                onLand: () => {
                  s.leapt = true; s.phase = 'hand';
                  game.player.yaw = W; game.follow.snapBehind(W); // turned round to the edge he came over
                  const n = game.npc('erez'), hang = T(game, JX(game, 3) - 0.35, -32, 'bridge'); hang.y -= 1.45;
                  m.beats = beats(game, [
                    ['wait', 0.5],
                    ['do', () => { const a = { x: n.pos.x, y: n.pos.y, z: n.pos.z }; fling(m, game, n, a, hang); }],
                    ['until', () => m.fly?.done],
                    ['do', () => {
                      n.floorY = hang.y; n.model.setPose('hang');
                      m.hand = giveHand(game, n, { from: hang, to: T(game, JX(game, 3) + 0.9, -31.2, 'bridge'), label: 'לתת יד לארז', onDone: () => {
                        n.floorY = null; n.model.setPose(null); game.squad.release('erez'); m.fly = null;
                        s.handDone = true; s.phase = 'detour2'; later(m, game, EREZ_UP);
                      } });
                    }],
                    ['say', EREZ_SHORT],
                  ]);
                } });
            });
          }
          return null;
        }
        if (s.phase === 'leap') { say(m, game, 'גשר המגדל · הקטע נפל · לקפוץ מעל הפרצה'); return null; }
        if (s.phase === 'hand') { say(m, game, 'ארז נתלה בקצה · לתת לו יד'); return null; }
        if (s.phase === 'detour2') {
          say(m, game, 'גשר המגדל · קדימה');
          // two more go together as he comes into the fourth: too wide to leap, the yellow catwalk beside them
          if (!m.warn && segAt(game) >= 3 && lx > JX(game, 3) + 2) {
            game.dialogue.play(TWO_WARN);
            m.warn = warnSegs(m, game, [4, 5], 2.4, () => { s.drops = 3; s.phase = 'detour'; m.warn = null; m.leap?.dispose?.(); m.leap = null; });
          }
          return null;
        }
        if (s.phase === 'detour') {
          say(m, game, 'גשר המגדל · שני קטעים קרסו · לעקוף במסלול הצהוב');
          if (lx > JX(game, 5)) { s.phase = 'emit'; m.emit.on = true; game.dialogue.play(EMIT_TIP); }
          return null;
        }
        if (s.phase === 'emit') {
          s.emitLeft = m.emit.left;
          say(m, game, `גשר המגדל · לירות בפולטים שליד הדלת העליונה (${3 - s.emitLeft}/3)`);
          if (s.emitLeft === 0) {
            s.phase = 'door'; m.emit.on = false; game.energy?.clear?.();
            const d = Z.machine.doorOutside, ido = game.npc('ido');
            game.squad.send('ido', { x: d.x - 1.2, z: d.z - 0.9 }, { label: 'בדלת' }); s.doorT = 0;
            m.beats = beats(game, [
              ['until', () => near(ido.pos, d, 3) || s.doorT > 8],
              ['do', () => { if (!near(ido.pos, d, 3)) { ido.target = null; ido.place(d.x - 1.2, d.z - 0.9, E, d.y); } ido.lookAt(d.x + 2, d.z); game.hud.toast('עידו על הלוח של הדלת · 2', 1200); }],
              ['wait', 2],
              ['do', () => { Z.machine.upperDoor.unlock(); Z.machine.upperDoor.setOpen(true); game.sound?.chime?.(true); game.squad.release('ido'); s.open = true; }],
              ['say', DOOR_UP],
            ]);
          }
          return null;
        }
        if (s.phase === 'door') {
          s.doorT += dt;
          say(m, game, s.open ? 'גשר המגדל · פנימה, בדלת העליונה' : 'עידו פותח את הדלת העליונה');
          if (s.open && m.beats?.done && (near(p, Z.machine.doorOutside, 2.2) || LX(game, p) > 33)) return 'next';
        }
        return null;
      },
      exit(m, game) { m.beats = null; m.emit?.dispose(); m.emit = null; m.leap?.dispose?.(); m.leap = null; m.hand?.dispose?.(); m.hand = null; game.energy?.clear?.(); },
    },
    { // 2: the machine room
      objective: 'חדר המכונה', checkpoint: true,
      enter(m, game) {
        const s = m.s;
        if (s.staged) s.staged = false;
        else game.fx.redAlert(true, { id: 'm56', at: { ...CIT(game).machine.centre }, r: 60, h: 3, intensity: 45 });
        Object.assign(s, { phase: 'defend', t: 0, bar: 0, wait: -1, breakers: 0, mullerMarks: 0, threat: 0, k: 0, atConsole: false, off: false });
        offBoard(game, ORDER); freshMarks(game); m.spawned = new Map();
        // Muller to his console; each of the others to his approach; Nehorai to the north corridor, the worst
        const mu = MULLER_AT(game);
        game.squad.send('muller', { x: mu.x, z: mu.z, yaw: E }, { label: 'במסוף' });
        for (const [side, ids] of Object.entries(HOLDS)) ids.forEach((id, i) => { const [lx, lz, yaw] = POSTS[side][i]; game.squad.send(id, { ...T(game, lx, lz, 'machine'), yaw }, { label: 'בפתח' }); });
        later(m, game, MACHINE_IN);
        game.hud.banner('חדר המכונה', 'מולר מכבה את מקור האנרגיה', 'כל אחד על פתח · נהוראי במסדרון הצפוני', 2600);
      },
      target(m, game) {
        const s = m.s;
        if (s.wait >= 0) { const [lx, lz] = BREAKERS[s.wait]; return { ...T(game, lx, lz + 0.6, 'machine'), r: 1.2 }; }
        const g = nearestGuard(game, MACHINE_WAVES.flatMap((w) => w.list.filter((q) => q[1] === 'north').map((q) => q[0])));
        return g || { ...WORST(game), r: 2 };
      },
      interaction(m, game) { return m.breaker?.interaction(game) || shoveNear(m, game); },
      update(m, game, dt) {
        const s = m.s, P = game.paint, Z = CIT(game), mu = game.npc('muller'), muAt = MULLER_AT(game);
        s.t += dt;
        m.beats?.update(dt);
        if (s.phase === 'done') return m.beats?.done ? 'next' : null;
        // Muller at the console, working (put there if the way took too long)
        if (!s.atConsole && (near(mu.pos, muAt, 1.2) || s.t > 9)) {
          s.atConsole = true; mu.target = null; mu.place(muAt.x, muAt.z, E, muAt.y);
        }
        if (s.atConsole && !mu.target) mu.lookAt(muAt.x + 3, muAt.z);
        // the guards come in on the clock, each to his approach
        while (s.k < MACHINE_WAVES.length && s.t >= MACHINE_WAVES[s.k].at) {
          for (const [id, side] of MACHINE_WAVES[s.k].list) {
            const [fx, fz] = FROM[side], [tx, tz] = TO[side], j = (m.spawned.size % 3) - 1;
            const gd = new Wave(game, [{ id, from: T(game, fx + j * 1.2, fz + j, 'machine'), post: T(game, tx + j * 1.5, tz, 'machine') }], { now: true, hot: false }).out[0];
            m.spawned.set(id, { gd, side, t: 0, inside: false });
          }
          s.k++;
        }
        flanking(m, game, dt, { who: HOLDS.north, wait: 5, back: (id) => { const i = HOLDS.north.indexOf(id), [lx, lz, yaw] = POSTS.north[i]; game.squad.send(id, { ...T(game, lx, lz, 'machine'), yaw }, { label: 'בפתח' }); } });
        // the friends always deal with their own approach; a guard of the north that gets past makes for Muller
        let threat = false;
        for (const [id, q] of m.spawned) {
          const gd = q.gd; q.t += dt;
          if (gd.marked || !gd.npc.visible) continue;
          if (q.side !== 'north' && q.t > 11) P.markGuard(gd, HOLDS[q.side][0]);
          if (q.side === 'north' && !q.inside && near(gd.npc.pos, T(game, ...TO.north, 'machine'), 2.5) && !gd.alerted) { q.inside = true; P.setRoute(gd, [{ x: T(game, ...INSIDE, 'machine').x, z: T(game, ...INSIDE, 'machine').z }], { still: true }); }
          if (near(gd.npc.pos, muAt, 10) && sameFloor(gd.npc.pos, muAt)) threat = true;
        }
        if (threat) {
          if ((s.threat += dt) > 2.5) { s.threat = 0; s.mullerMarks++; game.hud.toast(`מולר סומן! (${s.mullerMarks}/3) · לעצור אותם לפני שהם מגיעים אליו`, 2200); game.sound?.splat?.(); s.bar = Math.max(0, s.bar - 0.05); }
        } else s.threat = Math.max(0, s.threat - dt);
        // the bar: Muller's work, stopped at each breaker until Nehorai throws it
        const allIn = s.k >= MACHINE_WAVES.length, standing = [...m.spawned.values()].filter((q) => !q.gd.marked && q.gd.npc.visible).length;
        if (s.atConsole && s.wait < 0) {
          s.bar = Math.min(1, s.bar + dt / BAR_TIME);
          const b = BREAKS[s.breakers];
          if (b != null && s.bar >= b) {
            s.wait = s.breakers; s.bar = b;
            later(m, game, BREAKER_CALL[s.wait]);
            const [lx, lz] = BREAKERS[s.wait];
            m.breaker = new Switch(game, { at: T(game, lx, lz + 0.7, 'machine', N), label: 'להרים את המפסק', onUse: () => {
              s.breakers++; s.wait = -1; later(m, game, BREAKER_ON); game.sound?.chime?.(true);
              freshMarks(game); game.hud.toast('המפסק למעלה · נשימה, הצבע נוקה', 2000); // a new stretch of the defence
              const sw = m.breaker; m.breaker = null; m.live.push({ t: 4, done: false, update(dt2) { if ((this.t -= dt2) <= 0) { sw.dispose(); this.done = true; } }, cancel() { sw.dispose(); } });
            } });
          }
        }
        const pct = Math.round(s.bar * 100);
        game.hud.setBoss({ name: 'מולר מכבה את מקור האנרגיה', frac: s.bar, marks: BREAKS, tag: s.wait >= 0 ? 'מפסק קפץ · רק נהוראי מגיע!' : `מולר סומן ${s.mullerMarks}/3` });
        say(m, game, s.wait >= 0 ? `חדר המכונה · להרים את המפסק במסדרון הצפוני (${pct}%)` : s.bar >= 1 ? 'חדר המכונה · כמעט · לנקות את המסדרון' : `חדר המכונה · להחזיק את הגישה הצפונית · מולר מכבה (${pct}%)`);
        if (s.bar >= 1 && allIn && standing === 0) {
          s.phase = 'done'; game.hud.setBoss(null);
          const src = Z.machine.source;
          for (const id of TEAM) game.squad.release(id);
          m.beats = beats(game, [
            ['do', () => { game.fx.explode(src.x, src.y, src.z, { size: 1.2, shake: true, debris: false }); game.energy?.sparks?.(src.x, src.y, src.z, '#b48cff', 40, 7); game.fx.redAlert(false, { id: 'm56' }); game.sound?.thunder?.(0.5); s.off = true; }],
            ['wait', 0.6],
            ['say', SOURCE_OFF],
          ]);
        }
        return null;
      },
      exit(m, game) { m.beats = null; m.breaker?.dispose(); m.breaker = null; game.hud.setBoss(null); game.npc('muller').model.setPose(null); for (const id of TEAM) game.squad.release(id); },
    },
    { // 3: the last hall's door: two heavies, fists, beside Erez and Ido
      objective: 'האולם האחרון', checkpoint: true,
      enter(m, game) {
        const s = m.s;
        if (s.staged) s.staged = false; else game.hud.fade('', null, 900); // (from the machine room: a cut to the south corridor)
        Object.assign(s, { phase: 'scene', t: 0, won: false, lost: false });
        offBoard(game, ORDER);
        game.fx.redAlert(false, { id: 'm56' });
        // Nehorai with Erez and Ido in the south corridor, the two at the foot of the stairs, the others behind
        const me = START[3](game);
        game.player.place(me.x, me.z, E, me.y); game.follow.snapBehind(E);
        for (const id of ['erez', 'ido']) { const [lx, lz] = DOOR_FIGHT[id], a = T(game, lx, lz, 'machine', E); standAt(game, id, a); game.squad.send(id, { x: a.x, z: a.z, yaw: E }, { label: 'בקרב' }); game.npc(id).target = null; }
        for (const id of ['hv1', 'hv2']) { const [lx, lz] = DOOR_FIGHT[id]; standAt(game, id, T(game, lx, lz, 'machine', W)); }
        for (const [lx, lz, id] of CHEER) { const n = stay(game, id, T(game, lx, lz, 'machine', E), { label: 'מעודד' }); n.idle = 'cheer'; }
        game.cutscene = true; game.hud.setCinematic(true);
        const h = T(game, 85, 28.5, 'machine');
        game.follow.shot({ x: me.x - 3.5, y: me.y + 2.4, z: me.z - 2.5 }, { x: h.x, y: h.y + 1.4, z: h.z }, 9999);
        m.beats = beats(game, [['say', HEAVIES], ['wait', 0.3]]);
      },
      target(m, game) { return null; },
      update(m, game, dt) {
        const s = m.s;
        if (s.phase === 'scene') {
          say(m, game, 'האולם האחרון · שני כבדים בדלת');
          m.beats?.update(dt);
          if (!m.beats?.done) return null;
          game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(E);
          s.phase = 'fight';
          fistsUp(m, game, { opp: ['hv1', 'hv2'], allies: ['erez', 'ido'], name: 'הכבדים בדלת', onWin: () => { s.won = true; }, onLose: () => { s.lost = true; }, extra: { openings: true, impact: true, maxAttackers: 1 } });
          return null;
        }
        say(m, game, 'FIST COMBAT · שני כבדים בדלת · ארז ועידו איתך');
        if (s.lost) return `fail:${DOOR_LOST}`;
        return s.won ? 'next' : null;
      },
      exit(m, game) {
        m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        fistsDown(m, game, ['hv1', 'hv2'], ['erez', 'ido']);
        for (const [, , id] of CHEER) { const n = game.npc(id); n.idle = null; n.model.setPose(null); game.squad.release(id); }
      },
    },
    { // 4: everyone walks up together; the door shuts behind them
      objective: 'האולם האחרון · כולם עולים ביחד',
      enter(m, game) {
        const s = m.s;
        Object.assign(s, { phase: 'up', t: 0 });
        game.squad.form(TEAM, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
        armed(game, TEAM);
        lastDoor(game, 'open', { seconds: 1.6 });
        game.sound?.thunder?.(0.3);
        later(m, game, OPENS);
      },
      target(m, game) { return m.s.phase === 'up' ? { ...CIT(game).lastHall.entry, r: 2 } : null; },
      update(m, game, dt) {
        const s = m.s, Z = CIT(game), p = game.player.pos, en = Z.lastHall.entry;
        s.t += dt;
        if (s.phase === 'up') {
          say(m, game, p.y > Z.machine.y + 3 ? 'האולם האחרון · פנימה, כולם ביחד' : 'האולם האחרון · במדרגות למעלה, כולם ביחד');
          if (near(p, en, 2.6) && sameFloor(p, en)) {
            s.phase = 'in';
            // anyone still on the stairs is up beside him (nobody stands in the doorway when it shuts)
            game.squad.ids.forEach((id, i) => {
              const n = game.npc(id), [lx, lz] = IN_SPOTS[i % IN_SPOTS.length], a = T(game, lx, lz, 'last');
              if (sameFloor(n.pos, en) && LX(game, n.pos) > 105 && near(n.pos, en, 10)) return;
              n.target = null; n.place(a.x, a.z, W, a.y); n.show(true);
            });
            game.cutscene = true; game.hud.setCinematic(true);
            const dpt = T(game, 104.4, 33.7, 'last');
            game.follow.shot({ x: en.x + 4, y: en.y + 2.6, z: en.z - 2.5 }, { x: dpt.x, y: dpt.y + 1.4, z: dpt.z }, 9999);
            m.beats = beats(game, [
              ['wait', 0.4],
              ['do', () => lastDoor(game, 'shut', { seconds: 1.1 })],
              ['wait', 1.4],
              ['say', SHUT],
              ['wait', 0.3],
            ]);
          }
          return null;
        }
        say(m, game, 'האולם האחרון · הדלת נסגרה מאחוריהם');
        m.beats?.update(dt);
        return m.beats?.done ? 'next' : null;
      },
      exit(m, game) {
        m.beats = null; game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        const Z = CIT(game); game.player.yaw = W; game.follow.snapBehind(W);
        if (Z) lastDoor(game, 'shut');
      },
    },
  ],
  complete(m, game) { m.done = true; },
};

// on completion the scene is left only for mission 57, which carries straight on (never after a replay)
function handsTo(game, id) { const M = game.missions, n = M.next(); return !!M.carrying && n?.id === id && !!n.follows && M.ready(n); }
