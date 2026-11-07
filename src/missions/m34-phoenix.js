// Chapter nine, mission 1, "הלילה שבו הכול התחיל". A few days after the blast the whole gang rests in the safe
// house on the sofas round the TV. Nehorai: "סוף סוף קצת שקט." Ido laughs. The lights go out, and on the TV
// a figure in a black mask: the Shadow, the leader of the Black Order. He names Nehorai, says Kotzi was only
// the beginning, and plays a video of a huge industrial compound for them to come to. Erez: it is a trap.
// Nehorai: then let us see what he has prepared. Then it is the player's: the power back at the fuse box,
// the gear from the rack (everyone gets his own marker), a word with Ido at the frozen video and with Erez
// by the cars, and out to the Renault while the gang gets into the two other cars. Invented, all of it.
import { near, say } from './missions.js';
import { TEAM, armCrew, endCrew, attempt, handsOver } from './phoenix.js';
import { parkGangCars, dropGangCars, carOf, doorOf, unboardAll, Walk, Chatter, IN_RENAULT } from './phoenix-a.js';

const H = (game) => game.world.places.safehouse;
const REST = [['נהוראי', 'סוף סוף קצת שקט.']];
const LAUGH = [['עידו', 'אחי, אצלך שקט מחזיק שלוש דקות.']];
const BANTER = [['דולב', 'שתיים וחצי. אני ספרתי.'], ['הדר', 'Bro, תנו לו לנוח. הוא סגר את קוצי.']];
const DARK = [['יונתי', 'מה זה? מי כיבה את האור?'], ['ארז', 'שקט. כולם במקום.']];
const SHADOW = [['הצל', 'נהוראי פרחי. אתה ניצחת את קוצי, אבל קוצי היה רק ההתחלה.']];
const VIDEO = [['הצל', 'זה המתחם שלי. בסוף כביש המוות, מתחת לנמל השחור.'], ['הצל', 'רוצה לדעת מה מחכה לך שם? תבוא. עם כל החברים שלך. אני מחכה.']];
const AFTER = [['ארז', 'זה ברור שזו מלכודת.'], ['נהוראי', 'אז בואו נראה מה הוא הכין לנו.']];
const POWER = [['עידו', 'הוא הפיל לנו את החשמל. ארון החשמל במסדרון, ליד הדלת.']];
const LIGHTS = [['מולר', 'אור. סוף סוף.'], ['ארז', 'הציוד בחדר הציוד, נהוראי. כל אחד לוקח את שלו.']];
const GEARED = [['דולב', 'מרקר, מסכה ושלושה מילויים. אני מוכן לכלום.'], ['ארז', 'אני מוציא את הרכבים לחצר. תדבר עם עידו, הוא בודק את הסרטון.']];
const IDO = [['עידו', 'עצרתי את הסרטון. תסתכל על המנופים ועל המים — זה הנמל השחור, בסוף כביש המוות.'], ['נהוראי', 'ואיך הוא נכנס לנו לטלוויזיה?'], ['עידו', 'השידור הגיע מבחוץ, על כל הערוצים בבת אחת. יש לו ציוד רציני.'], ['עידו', 'אני איתך ברנו. אני מנווט.']];
const EREZ = [['ארז', 'שלושה רכבים. אתה נוהג ברנו, אני ועידו איתך.'], ['ארז', 'יונתי, אברהם ומולר ברכב שתיים. דולב, הדר וליאם ברכב שלוש. כולם בקשר.'], ['נהוראי', 'ואם הוא שולח אנשים לכביש?'], ['ארז', 'אז נוסעים מהר ונשארים ביחד. אף אחד לא נשאר מאחור.']];
const BOARD = [['ארז', 'כולם לרכבים!'], ['ליאם', 'אחים, יוצאים למבצע.']];
const LEFT = 'עזבת את בית המסתור בלי החבורה. ארז: "בלי הציוד ובלי כולם לא יוצאים. חוזרים, נהוראי."';
const FAR = 150;

// the six who ride in the two other cars
const SIX = TEAM.filter((id) => !IN_RENAULT.includes(id));
// where the friends stand when a checkpoint is staged (world spots, all clear of furniture)
const HALL = [[638.3, -175.6], [638.3, -174.2], [642.6, -174.0], [642.6, -176.2], [643.8, -174.0], [643.8, -176.2], [636.2, -174.4], [636.2, -176.4]];
const YARD = [[657, -171.5], [657, -174], [657, -176.5], [659.5, -171.5], [659.5, -176.5], [662, -174]];
// the way through the house: the gear room's door, the hallway, the opening to the living room, the front door
const TO_LIVING = [{ x: 640, z: -176.3 }, { x: 637.5, z: -175.2 }, { x: 635, z: -176 }];
const TO_YARD = [{ x: 641.5, z: -175 }, { x: 644.8, z: -175 }, { x: 647.6, z: -175 }, { x: 655, z: -172 }];
const OUT_FROM_LIVING = [{ x: 637.5, z: -175.2 }, { x: 641.5, z: -175 }, { x: 644.8, z: -175 }, { x: 647.6, z: -175 }, { x: 655, z: -172 }];

function stand(game, ids, spots, y) { ids.forEach((id, i) => { const n = game.npc(id), s = spots[i % spots.length]; if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } n.floorY = null; n.idle = null; n.posed = false; n.target = null; n.model.setPose(null); n.place(s[0] ?? s.x, s[1] ?? s.z, s.yaw ?? -Math.PI / 2, y); n.show(true); }); }
function stage(game) {
  const h = H(game);
  game.daylight?.set(1, 0);
  h.reset();
  unboardAll(game);
  game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
  parkGangCars(game, h.cars);
}
// the friends formed up round Nehorai where they stand (nobody is moved: they walk from there)
function formHere(game) {
  if (game.playingAs !== 'nehorai') game.playAs('nehorai');
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; }
  game.squad.form(TEAM, { near: game.player.pos, yaw: game.player.yaw, leader: 'nehorai', walk: true });
}
const busy = (m) => (m.walks || []).filter((w) => !w.done);
function walkTo(m, game, id, points, opts) { const w = new Walk(game, id, points, opts); m.walks.push(w); return w; }
// Ido at the frozen video, Erez by the Renault
function stations(m, game, { walk = true } = {}) {
  const h = H(game), er = game.car.local(-2.3, -0.4), back = Math.atan2(h.outside.x - er.x, h.outside.z - er.z);
  if (walk) {
    walkTo(m, game, 'ido', TO_LIVING, { face: -Math.PI / 2, label: 'ליד הטלוויזיה' });
    walkTo(m, game, 'erez', [...TO_YARD, { x: er.x, z: er.z }], { face: back, run: false, label: 'ליד הרכבים' });
  } else {
    stand(game, ['ido'], [{ x: h.living.x, z: h.living.z, yaw: -Math.PI / 2 }], h.y);
    stand(game, ['erez'], [{ x: er.x, z: er.z, yaw: back }], h.y);
    for (const id of ['ido', 'erez']) game.squad.tasks.set(id, { x: game.npc(id).pos.x, z: game.npc(id).pos.z, label: 'מחכה' });
    game.squad.refresh(true);
  }
}

export default {
  id: 'phoenix', chapter: 9, number: 1, title: 'הלילה שבו הכול התחיל', requires: ['inferno'],
  opens: true, // a save at the end of chapter eight begins chapter nine with it
  where: 'בתצפית בקציר · החבורה מחכה',
  startAt: (game) => { const p = game.world.places.plaza; return p ? { x: p.x + p.dx * 3, z: p.z + p.dz * 3, y: p.h } : null; },
  reward: { money: 500, unlocks: ['phoenix'], text: 'יוצאים למבצע · 500 ₪' },

  setup(m, game) { m.s = {}; m.walks = []; m.chat = new Chatter(game); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const h = H(game); game.start(h.living.x, h.living.z, h.living.yaw); },
  failIf(m, game) {
    if (m.stepIndex === 0) return null;
    const h = H(game), p = game.pos;
    return Math.hypot(p.x - h.x, p.z - h.z) > FAR ? LEFT : null;
  },
  restore(m, game, checkpoint) {
    const h = H(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    for (const w of m.walks || []) w.cancel(); m.walks = []; m.chat?.clear();
    if (game.mode === 'car') game.exitCar();
    game.fx.resetAtmosphere(); game.fx.clear();
    game.nehorai.setPose(null);
    stage(game);
    h.lights(checkpoint >= 2);
    if (checkpoint >= 3) h.gear.take();
    const at = checkpoint === 1 ? h.seats[0].stand : checkpoint === 2 ? { x: 640.5, z: -175, yaw: Math.PI / 2 } : checkpoint === 3 ? { x: 640, z: -176.2, yaw: -Math.PI / 2 } : h.outside;
    game.player.place(at.x, at.z, at.yaw, h.y); game.follow.snapBehind(at.yaw);
    game.paint.dispose(); // the markers are still on the rack until the gear is taken
    if (checkpoint <= 2) stand(game, TEAM, h.seats.slice(1).map((s) => s.stand), h.y);
    else if (checkpoint === 3) stand(game, SIX, HALL, h.y);
    else stand(game, SIX, YARD, h.y);
    formHere(game);
    if (checkpoint >= 3) { armCrew(game); stations(m, game, { walk: false }); }
    if (checkpoint >= 4) { for (const id of IN_RENAULT) { const d = doorOf(game, id); stand(game, [id], [{ x: d.x, z: d.z, yaw: game.car.yaw }], h.y); game.squad.tasks.set(id, { ...d, label: 'ברנו' }); } }
    m.s = { opened: true, talked: { ido: false, erez: false }, talking: false, boarding: false, inCarT: 0 };
  },
  cleanup(m, game) {
    const h = H(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    for (const w of m.walks || []) w.cancel(); m.walks = []; m.chat?.clear();
    if (game.nehorai.pose === 'sit') game.nehorai.setPose(null);
    for (const id of TEAM) { const n = game.npc(id); if (n.model.pose === 'sit') { n.model.setPose(null); n.posed = false; } }
    if (!m.done || !handsOver(game)) { game.fx.resetAtmosphere(); unboardAll(game); endCrew(game); dropGangCars(game); h.reset(); }
    else { h.lights(true); h.screen.show('off'); }
  },

  steps: [
    { // 0: the sofas, the quiet, the lights out, the Shadow on the TV
      objective: 'בית המסתור',
      enter(m, game) {
        const h = H(game);
        game.cutscene = true; game.hud.setCinematic(true);
        if (game.mode === 'car') game.exitCar();
        const live = attempt(game, m), wait = (ms) => new Promise((r) => setTimeout(r, ms));
        game.hud.fade('כמה ימים אחרי הפיצוץ · בית המסתור', () => {
          if (!live()) return;
          game.fx.resetAtmosphere();
          stage(game);
          game.paint.dispose(); game.squad.dismiss();
          // nine seats round the TV, one each: Nehorai on the main sofa between Erez and Ido
          const s0 = h.seats[0];
          game.player.place(s0.x, s0.z, s0.yaw, s0.y); game.nehorai.setPose('sit');
          TEAM.forEach((id) => { const s = h.seatFor(id), n = game.npc(id); if (n.inCar) { n.inCar.occupants.delete(id); n.inCar = null; } n.floorY = null; n.target = null; n.idle = null; n.posed = false; n.place(s.x, s.z, s.yaw, s.y); n.model.setPose('sit'); n.show(true); });
          const tv = h.tv, sofa = h.sofa;
          game.follow.shot({ x: tv.x + 1.4, y: tv.y + 0.3, z: tv.z + 2.6 }, { x: sofa.x, y: sofa.y + 0.5, z: sofa.z }, 9999);
          game.hud.banner('פרק 9', 'מבצע אלמוות', 'בית המסתור · 23:40', 3200);
          game.sound?.music?.('calm');
          game.dialogue.play(REST).then(() => {
            if (!live()) return null;
            game.hud.toast('עידו צוחק', 1600);
            return game.dialogue.play(LAUGH);
          }).then(() => (live() ? game.dialogue.play(BANTER) : null)).then(() => {
            if (!live()) return null;
            // the lights go out: every lamp of the house, the windows; a clunk, then quiet
            h.lights(false);
            game.sound?.music?.(null, { fade: 0.4 });
            game.sound?.hit?.('block', 0.9);
            game.hud.toast('...החשמל נפל', 1800);
            return wait(1400);
          }).then(() => (live() ? game.dialogue.play(DARK) : null)).then(() => {
            if (!live()) return null;
            // the TV comes on by itself: the Shadow
            h.screen.show('shadow', { caption: 'המסדר השחור' });
            game.sound?.beep?.(2, 330, 0.3);
            game.follow.shot({ x: sofa.x + 2.6, y: sofa.y + 1.8, z: sofa.z + 1.5 }, { x: tv.x, y: tv.y, z: tv.z }, 9999);
            game.hud.banner('המסדר השחור', 'הצל', 'שידור חי', 3000);
            return wait(900);
          }).then(() => (live() ? game.dialogue.play(SHADOW) : null)).then(() => {
            if (!live()) return null;
            h.screen.show('video', { caption: 'הנמל השחור · מצלמה 3', time: '00:47' });
            game.hud.toast('הצל מראה סרטון: מתחם תעשייתי ענק', 2200);
            return game.dialogue.play(VIDEO);
          }).then(() => {
            if (!live()) return null;
            h.screen.show('off'); // the signal gone: the room dark again
            game.sound?.beep?.(1, 220, 0.3);
            game.follow.shot({ x: tv.x + 1.4, y: tv.y + 0.3, z: tv.z + 2.6 }, { x: sofa.x, y: sofa.y + 0.5, z: sofa.z }, 9999);
            return game.dialogue.play(AFTER);
          }).then(() => { if (live()) m.s.opened = true; });
        }, 1600);
      },
      update: (m) => (m.s.opened ? 'next' : null),
      exit(m, game) {
        const h = H(game);
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        // everyone up: Nehorai in front of his seat, the friends in front of theirs
        game.nehorai.setPose(null);
        const st = h.seats[0].stand; game.player.place(st.x, st.z, Math.PI / 2, h.y); game.follow.snapBehind(Math.PI / 2);
        stand(game, TEAM, TEAM.map((id) => h.seatFor(id).stand), h.y);
        formHere(game);
        m.s = { ...m.s, talked: { ido: false, erez: false }, talking: false, boarding: false, inCarT: 0 };
        game.dialogue.play(POWER);
      },
    },
    { // 1: the power back at the fuse box
      objective: 'להחזיר את החשמל · ארון החשמל במסדרון', checkpoint: true,
      target(m, game) { const b = H(game).breaker.at; return { ...b, r: 1.2 }; },
      interaction(m, game) {
        const h = H(game);
        if (game.mode !== 'foot' || h.lightsOn || !near(game.player.pos, h.breaker.at, 1.5)) return null;
        return { label: 'להרים את המפסקים', priority: 6, run: () => { h.lights(true); game.sound?.hit?.('block', 0.7); game.sound?.chime?.(true); game.hud.toast('החשמל חזר', 1600); } };
      },
      update(m, game, dt) {
        m.chat.update(dt);
        return H(game).lightsOn ? 'next' : null;
      },
    },
    { // 2: the gear
      objective: 'לקחת את הציוד · חדר הציוד, הקיר הצפוני', checkpoint: true,
      enter(m, game) { m.chat.add(LIGHTS); },
      target(m, game) { const g = H(game).gear; return { x: g.x, z: g.z, y: g.y, r: 1.2 }; },
      interaction(m, game) {
        const h = H(game);
        if (game.mode !== 'foot' || h.gear.taken || !near(game.player.pos, h.gear, 1.6)) return null;
        return { label: 'לקחת את הציוד', priority: 6, run: () => {
          h.gear.take();
          armCrew(game); // every one of them his own marker, in his own colour
          game.sound?.chime?.(true);
          game.hud.toast('הציוד אצלכם · כל אחד והמרקר שלו', 2200);
          game.dialogue.play(GEARED);
          stations(m, game);
        } };
      },
      update(m, game, dt) { m.chat.update(dt); return H(game).gear.taken ? 'next' : null; },
    },
    { // 3: a word with Ido at the frozen video and with Erez by the cars
      objective: 'לדבר עם עידו ועם ארז', checkpoint: true,
      target(m, game) {
        const t = m.s.talked, who = !t.ido ? 'ido' : !t.erez ? 'erez' : null;
        if (!who || m.s.talking) return null;
        const n = game.npc(who); return { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 1.6 };
      },
      interaction(m, game) {
        if (game.mode !== 'foot' || m.s.talking) return null;
        const h = H(game), live = attempt(game, m);
        for (const id of ['ido', 'erez']) {
          if (m.s.talked[id] || !near(game.player.pos, game.npc(id).pos, 2.2)) continue;
          return { label: id === 'ido' ? 'לדבר עם עידו' : 'לדבר עם ארז', priority: 6, run: () => {
            m.s.talking = true;
            const n = game.npc(id); n.lookAt(game.player.pos.x, game.player.pos.z);
            if (id === 'ido') h.screen.show('video', { caption: 'עצירה · הנמל השחור', time: '00:47' });
            game.dialogue.play(id === 'ido' ? IDO : EREZ).then(() => {
              if (!live()) return;
              m.s.talked[id] = true; m.s.talking = false;
              if (id === 'ido') { h.screen.show('off'); walkTo(m, game, 'ido', [...OUT_FROM_LIVING, doorOf(game, 'ido')], { face: game.car.yaw, label: 'ברנו' }); }
            });
          } };
        }
        return null;
      },
      update(m, game, dt) {
        for (const w of m.walks) w.update(dt);
        m.chat.update(dt);
        const t = m.s.talked;
        say(m, game, m.s.talking ? (t.ido ? 'מדברים עם ארז' : 'מדברים עם עידו') : !t.ido && !t.erez ? 'לדבר עם עידו (בסלון) ועם ארז (בחצר, ליד הרכבים)' : !t.ido ? 'לדבר עם עידו · בסלון, מול הסרטון' : 'לדבר עם ארז · בחצר, ליד הרכבים');
        return t.ido && t.erez && !m.s.talking ? 'next' : null;
      },
    },
    { // 4: everyone into the cars; Nehorai into the Renault
      objective: 'לרנו · כולם לרכבים', checkpoint: true,
      enter(m, game) { game.dialogue.play(BOARD); },
      target(m, game) { return game.mode === 'car' ? null : { x: game.car.pos.x, z: game.car.pos.z, y: game.car.pos.y, r: 2.4 }; },
      update(m, game, dt) {
        const h = H(game);
        // whoever is out of the house goes to his own car's door and gets in (the Renault's two go to it too)
        for (const id of TEAM) {
          const n = game.npc(id);
          if (n.inCar || busy(m).some((w) => w.id === id)) continue;
          if (h.inside(n.pos.x, n.pos.z) && !IN_RENAULT.includes(id)) continue; // still following him out through the door
          const d = doorOf(game, id), car = carOf(game, id);
          walkTo(m, game, id, [{ x: d.x, z: d.z }], { run: true, near: 0.8, label: 'לרכב', onDone: () => { if (!n.inCar) { n.model.setPose(null); n.enter(car); game.squad.release(id); } } });
        }
        for (const w of m.walks) w.update(dt);
        m.walks = busy(m);
        // in the Renault with some still on the way: they run in within a few seconds
        m.s.inCarT = game.mode === 'car' ? m.s.inCarT + dt : 0;
        if (m.s.inCarT > 4) for (const id of TEAM) { const n = game.npc(id); if (!n.inCar) { n.target = null; n.model.setPose(null); n.enter(carOf(game, id)); } }
        const aboard = TEAM.filter((id) => game.npc(id).inCar).length;
        say(m, game, game.mode === 'car' ? (aboard < TEAM.length ? `ברנו · עולים לרכבים (${aboard}/${TEAM.length})` : 'כולם ברכבים · יוצאים') : `לרנו · כולם לרכבים (${aboard}/${TEAM.length})`);
        return game.mode === 'car' && aboard === TEAM.length ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
