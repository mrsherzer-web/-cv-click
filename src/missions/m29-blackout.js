// Chapter eight, mission 4, "הבגידה הגדולה". The control room was the trap: Kotzi on every screen, the
// lights go out, an alarm, the doors lock and the team is split up — Erez with Nehorai, three of them shut
// in a store room downstairs, Ido somewhere below on the radio. The note on the desk has the generator's
// code; a shelf hides a door (Erez moves it), the back stairs go down to the first floor where breaker B
// lifts the ground-floor shutter; out through the dark yard to the generator room, the keypad, three
// levers in the order on the sign, and the generator: the lights, the doors, everyone together again.
// Every switch, door and code here exists in the base and does what it says. Invented, as always.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { TEAM, crew, armCrew, endCrew, failOut, radio, Job, Work, postGuards, hideGuards, attempt, handsOver } from './firestorm.js';

const B = (game) => game.world.places.ironBase;
const LOCKED_IN = ['yonati', 'dolev', 'hadar'], OUTSIDE = ['avraham', 'muller', 'liam'];
const DARK = [['kg5', 'f1walk'], ['kg6', 'f1office'], ['kg7', 'yardN'], ['kg8', 'yardMid']];
const ORDER = [0, 2, 1]; // green, blue, red — as the sign by the door says

const SCREENS = [['קוצי', 'נהוראי פרחי… באמת חשבת שתוכל להיכנס לבסיס שלי ולצאת חי?'], ['נהוראי', 'קוצי. איפה אתה?'], ['קוצי', 'במקום שאתה לא תגיע אליו. לילה טוב.']];
const DARK_LINES = [['ארז', 'חושך מוחלט. רק האור האדום.'], ['יונתי', '(בקשר) נהוראי! נעלו אותנו במחסן למטה! אני, דולב והדר!']];
const IDO = 'נהוראי, אני בקומה התחתונה. אני יכול לפתוח לך את הדרך, אבל אתה חייב להפעיל את הגנרטור!';
const NOTE = [['נהוראי', '2-5-8-0. הגנרטור.'], ['ארז', 'פתק על השולחן. קוצי והפתקים שלו.']];
const SHELF = [['ארז', 'נהוראי, יש פה פתח מאחורי המדף. תן לי שנייה.']];
const SHELF_OPEN = [['ארז', 'הנה. מדרגות אחוריות, למטה.']];
const BREAKER = 'אני רואה את הדרך. התריס בקומת הקרקע עלה. הגנרטור בפינה הצפון־מזרחית של החצר.';
const AT_GEN = [['עידו', 'פה! אני איתך. תפעיל.']];
const POWER = [['דולב', 'חשבתי שנגור במחסן הזה לנצח.'], ['הדר', 'Bro, היה חושך. לא פחדתי. קצת.'], ['יונתי', 'אני ידעתי שתבואו. אמרתי לדולב.'], ['ארז', 'כולם פה? יוצאים.']];
const GEN_HINT = 'הקוד מהפתק בחדר הבקרה';

function lights(m, game, on) {
  const b = B(game), d = game.daylight;
  if (on) { d?.dimNear(b.x, b.z, 90, 1); d?.set(0.45, 2); if (m.red) { game.scene.remove(m.red); m.red = null; } }
  else {
    d?.set(1, 0); d?.dimNear(b.x, b.z, 90, 0.04);
    if (!m.red) { m.red = new THREE.PointLight('#ff3030', 9, 16, 1.6); m.red.position.set(b.control.inside.x, b.y + b.F2 + 2.8, b.control.inside.z); game.scene.add(m.red); }
  }
}
function shelf(game, moved) {
  const b = B(game), h = b.hidden, W = game.world;
  if (moved) { if (h.shelfBody) { W.cols.remove(h.shelfBody); h.shelfBody = null; } h.shelf.position.z = b.z - 21 + 1.6; h.door.unlock(); h.door.setOpen(true); }
  else { if (!h.shelfBody) h.shelfBody = W.cols.addBox(b.x + 3.4, b.z - 21, 0.3, 1.0, 0, b.y + b.F2 - 0.3, b.y + b.F2 + 2.2); h.shelf.position.z = b.z - 21; h.door.lock(); }
}
function levers(game, down) { for (const l of B(game).generator.levers) { l.mesh.rotation.x = down.includes(l.i) ? 0.9 : 0; } }
const floorOf = (game) => { const b = B(game), dy = game.player.pos.y - b.y; return dy > b.F2 - 0.8 ? 2 : dy > b.F1 - 0.8 ? 1 : 0; };
function scatter(game) {
  const b = B(game);
  LOCKED_IN.forEach((id, i) => { const n = game.npc(id), s = b.lockRoom.spots[i]; n.target = null; n.floorY = null; n.place(s.x, s.z, 0, b.y); n.idle = 'arms'; n.model.setPose(null); n.show(true); });
  OUTSIDE.forEach((id, i) => { const n = game.npc(id), g = b.gateOutside; n.target = null; n.floorY = null; n.place(g.x - 6 - i * 1.4, g.z + 2 + (i % 2), Math.PI, b.y); n.idle = 'phone'; n.show(true); });
  const ido = game.npc('ido'); ido.target = null; ido.show(false);
}

export default {
  id: 'blackout', chapter: 8, number: 4, title: 'הבגידה הגדולה', requires: ['ironbase'],
  follows: true, secret: true,
  where: 'בחדר הבקרה של בסיס הברזל',
  startAt: (game) => { const b = B(game); return b ? { x: b.control.inside.x, z: b.control.inside.z, y: b.control.inside.y } : null; },
  reward: { money: 800, unlocks: ['blackout'], text: 'החשמל חזר והצוות יחד · 800 ₪' },

  setup(m, game) { m.s = { down: [] }; },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const c = B(game).control.inside; game.player.place(c.x, c.z, c.yaw, c.y); game.follow.snapBehind(c.yaw); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3, 4]); },
  restore(m, game, checkpoint) {
    const b = B(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
    m.job?.cancel(); m.job = null; m.work?.cancel(); m.work = null;
    if (game.mode === 'car') game.exitCar();
    lights(m, game, false);
    b.control.door.lock(); b.lockRoom.door.lock(); b.shutters[1].lock();
    if (checkpoint >= 3) { b.shutters[0].unlock(); b.shutters[0].setOpen(true); } else b.shutters[0].lock();
    shelf(game, checkpoint >= 2);
    if (checkpoint >= 4) { b.generator.door.unlock(); b.generator.door.setOpen(true); } else b.generator.door.lock();
    levers(game, []);
    const at = checkpoint >= 4 ? b.generator.inside : checkpoint === 3 ? b.main.lobby : checkpoint === 2 ? b.hidden.out : b.control.inside;
    game.player.place(at.x, at.z, at.yaw ?? 0, at.y); game.follow.snapBehind(at.yaw ?? 0);
    scatter(game);
    crew(game, game.player.pos, game.player.yaw, ['erez']);
    postGuards(game, b, DARK); armCrew(game); game.paint.reset();
    if (checkpoint >= 4) { const ido = game.npc('ido'); ido.show(true); ido.place(b.generator.keypadAt.x + 1.6, b.generator.keypadAt.z, Math.PI, b.y); }
    m.s = { ...m.s, note: checkpoint >= 2, shelfSaid: checkpoint >= 2, open: checkpoint >= 2, breaker: checkpoint >= 3, genOpen: checkpoint >= 4, down: [], ready: true, power: false };
  },
  cleanup(m, game) {
    const b = B(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
    m.job?.cancel(); m.job = null; m.work?.cancel(); m.work = null;
    m.stopSiren?.(); m.stopSiren = null;
    lights(m, game, true);
    for (const d of [...b.shutters, b.lockRoom.door]) { d.unlock(); d.setOpen(true); }
    shelf(game, false); b.generator.door.lock(); levers(game, []); b.generator.lampOn(false);
    b.control.screenMat.emissive.set('#59c7ff'); b.control.screenMat.emissiveIntensity = 0.15;
    game.paint.dispose(); hideGuards(game, DARK.map((g) => g[0]));
    for (const id of TEAM) { const n = game.npc(id); n.idle = null; }
    if (!m.done || !handsOver(game)) endCrew(game);
  },

  steps: [
    { // 0: Kotzi on the screens; the lights go out
      objective: 'חדר הבקרה',
      enter(m, game) {
        const b = B(game), c = b.control;
        game.cutscene = true; game.hud.setCinematic(true);
        if (game.mode === 'car') game.exitCar();
        if (!b.inControl(game.player.pos.x, game.player.pos.z, game.player.pos.y)) game.player.place(c.inside.x, c.inside.z, c.inside.yaw, c.inside.y);
        crew(game, game.player.pos, game.player.yaw, ['erez']);
        const live = attempt(game, m);
        c.screenMat.emissive.set('#ff4a4a'); c.screenMat.emissiveIntensity = 1.6;
        game.follow.shot({ x: c.inside.x + 3, y: c.inside.y + 2, z: c.inside.z + 2 }, { x: c.consoles.x, y: c.inside.y + 2.2, z: c.consoles.z - 1.5 }, 9999);
        game.hud.banner('על המסכים', 'קוצי', '', 2600);
        game.dialogue.play(SCREENS).then(() => {
          if (!live()) return null;
          lights(m, game, false);
          c.screenMat.emissiveIntensity = 0.05;
          m.stopSiren = game.sound?.siren?.(10) || null;
          c.door.lock(); b.lockRoom.door.lock(); b.shutters[0].lock(); b.shutters[1].lock();
          scatter(game);
          game.sound?.hit?.('crash', 0.7); game.follow.shake(0.6);
          game.hud.banner('', 'הצוות הופרד', 'הדלתות ננעלו · החשמל נותק', 2600);
          return game.dialogue.play(DARK_LINES);
        }).then(() => (live() ? radio(game, 'עידו', IDO) : null)).then(() => { if (live()) m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) {
        const b = B(game);
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw);
        postGuards(game, b, DARK); armCrew(game);
      },
    },
    { // 1: the note, the shelf, the hidden door
      objective: 'הדלת נעולה · למצוא דרך אחרת החוצה', checkpoint: true,
      target(m, game) { const b = B(game); return !m.s.note ? { ...b.control.note, r: 1.2 } : !m.s.open ? { ...b.hidden.at, r: 1.6 } : { ...b.hidden.out, r: 1.6 }; },
      interaction(m, game) {
        const b = B(game);
        if (game.mode !== 'foot' || m.s.note || !near(game.player.pos, b.control.note, 2.2) || floorOf(game) !== 2) return null;
        return { label: 'לקרוא את הפתק', priority: 5, run: () => {
          m.s.note = true;
          game.hud.toast(`הקוד לגנרטור: ${b.generator.code.split('').join('-')}`, 4200);
          const live = attempt(game, m);
          game.dialogue.play(NOTE).then(() => (live() ? game.dialogue.play(SHELF) : null)).then(() => {
            if (!live() || m.job) return;
            m.job = new Job(game, { who: 'erez', at: b.hidden.at, seconds: 3, near: 12, pill: 'ארז מזיז את המדף', onDone: () => { shelf(game, true); m.s.open = true; game.hud.toast('הדלת הנסתרת פתוחה', 1500); game.dialogue.play(SHELF_OPEN); } });
          });
        } };
      },
      update(m, game, dt) {
        const b = B(game);
        m.job?.update(dt);
        say(m, game, !m.s.note ? 'הפתק על השולחן · לקרוא' : !m.s.open ? 'ארז מזיז את המדף · לחכות לידו' : 'דרך הדלת הנסתרת · המדרגות האחוריות');
        return m.s.open && near(game.player.pos, b.hidden.out, 2.2) && floorOf(game) === 2 ? 'next' : null;
      },
      exit(m, game) { m.job?.cancel(); m.job = null; },
    },
    { // 2: down the back stairs; breaker B in the first-floor office
      objective: 'המדרגות האחוריות · המפסק במשרד בקומה הראשונה', checkpoint: true,
      enter(m, game) { const b = B(game); m.work = new Work(game, { at: b.main.breakerB, seconds: 3, label: 'להרים את המפסק', pill: 'מרים את המפסק', near: 2.2, onDone: () => { b.shutters[0].unlock(); b.shutters[0].setOpen(true); m.s.breaker = true; game.sound?.hit?.('block', 0.8); game.hud.toast('התריס בקומת הקרקע עלה', 1800); radio(game, 'עידו', BREAKER); } }); },
      target(m, game) { const b = B(game), f = floorOf(game); return f === 2 ? { ...b.main.s3.top, r: 1.6 } : { ...b.main.breakerB, y: b.y + b.F1, r: 1.2 }; },
      interaction(m, game) { return floorOf(game) === 1 ? m.work?.interaction(game) || null : null; },
      update(m, game, dt) {
        m.work?.update(dt);
        say(m, game, m.s.breaker ? 'התריס עלה · למטה לקומת הקרקע' : floorOf(game) === 2 ? 'המדרגות האחוריות למטה' : 'המפסק במשרד · להרים');
        return m.s.breaker ? 'next' : null;
      },
      exit(m, game) { m.work?.cancel(); m.work = null; },
    },
    { // 3: out through the dark yard to the generator room; the keypad
      objective: 'לחצר · חדר הגנרטור בפינה הצפון־מזרחית', checkpoint: true,
      target(m, game) {
        const b = B(game), f = floorOf(game);
        if (f === 1) return { ...b.main.s1.top, r: 1.6 };
        const p = game.player.pos;
        if (b.insideBuilding(p.x, p.z)) return { ...b.main.door, r: 2 };
        return { ...b.generator.keypadAt, r: 1.4 };
      },
      interaction(m, game) {
        const b = B(game);
        if (game.mode !== 'foot' || m.s.genOpen || !near(game.player.pos, b.generator.keypadAt, 2.0)) return null;
        return { label: 'להקיש את הקוד', priority: 5, run: () => { game.keypad.open(b.generator.code, GEN_HINT).then((ok) => { if (!ok) return; m.s.genOpen = true; b.generator.door.unlock(); b.generator.door.setOpen(true); game.hud.toast('הדלת נפתחה', 1400); const ido = game.npc('ido'); ido.floorY = null; ido.place(b.generator.keypadAt.x + 1.6, b.generator.keypadAt.z, Math.PI, b.y); ido.show(true); game.dialogue.play(AT_GEN); }); } };
      },
      update(m, game) {
        const n = ['kg7', 'kg8'].filter((id) => game.paint.guards.some((g) => g.npc === game.npc(id) && !g.marked)).length;
        say(m, game, m.s.genOpen ? 'בתוך חדר הגנרטור' : `חדר הגנרטור בפינה הצפון־מזרחית · לוח מקשים בדלת${n ? ` · שומרים בחצר (${2 - n}/2)` : ''}`);
        return m.s.genOpen ? 'next' : null;
      },
    },
    { // 4: three levers in order, then the generator
      objective: 'הידיות לפי השלט, ואז להפעיל', checkpoint: true,
      target(m, game) { const g = B(game).generator; if (m.s.down.length < 3) { const want = ORDER[m.s.down.length], l = g.levers[want]; return { ...l, r: 1.0 }; } return { ...g.machine, r: 1.4 }; },
      interaction(m, game) {
        const g = B(game).generator, me = game.player.pos;
        if (game.mode !== 'foot') return null;
        if (m.s.down.length < 3) {
          for (const l of g.levers) if (!m.s.down.includes(l.i) && near(me, l, 1.4)) return { label: `להוריד את הידית (${l.color})`, priority: 5, run: () => {
            const want = ORDER[m.s.down.length];
            if (l.i !== want) { m.s.down = []; levers(game, []); game.sound?.chime?.(false); game.hud.toast('לא הסדר שעל השלט · מההתחלה', 1800); return; }
            m.s.down.push(l.i); levers(game, m.s.down); game.sound?.hit?.('block', 0.6);
            if (m.s.down.length === 3) { game.hud.toast('הידיות במקום · עכשיו להפעיל את הגנרטור', 2000); m.work = new Work(game, { at: g.machine, seconds: 4, label: 'להפעיל את הגנרטור', pill: 'מתניע', near: 2.4, onDone: () => { m.s.power = true; } }); }
          } };
          return null;
        }
        return m.work?.interaction(game) || null;
      },
      update(m, game, dt) {
        m.work?.update(dt);
        say(m, game, m.s.down.length < 3 ? `הסדר על השלט: ירוק · כחול · אדום (${m.s.down.length}/3)` : 'להפעיל את הגנרטור');
        return m.s.power ? 'next' : null;
      },
      exit(m, game) { m.work?.cancel(); m.work = null; },
    },
    { // 5: the lights, the doors, the gang together, out
      objective: 'החשמל חזר · כולם לשער',
      enter(m, game) {
        const b = B(game);
        lights(m, game, true);
        m.stopSiren?.(); m.stopSiren = null;
        for (const d of [...b.shutters, b.lockRoom.door, b.gate]) { d.unlock(); d.setOpen(true); } // the power opens every door, the gate too
        b.generator.lampOn(true);
        game.sound?.chime?.(true);
        game.hud.banner('', 'החשמל חזר', 'הצוות מתאחד', 2600);
        for (const id of [...LOCKED_IN, ...OUTSIDE, 'ido']) { const n = game.npc(id); n.idle = null; }
        crew(game, game.player.pos, game.player.yaw);
        armCrew(game);
        game.dialogue.play(POWER);
      },
      target(m, game) { return { ...B(game).gateOutside, r: 4 }; },
      update(m, game) { say(m, game, 'כולם לשער · יוצאים מבסיס הברזל'); return near(game.player.pos, B(game).gateOutside, 5) ? 'next' : null; },
    },
  ],
  complete(m, game) { m.done = true; },
};
