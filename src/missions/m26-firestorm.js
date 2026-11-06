// Chapter eight, mission 1, "השקט שלפני הסערה". A few hours after the rescue the gang sits round the table
// in the hideout; an engine outside, Ido's shout, and Kotzi's blast takes the main door. Then it is the
// player's: through the burning hall (a beam closes the ground, so up the stairs and along the
// mezzanine, a second beam, down the rubble), blasts that warn first, fires along the walls, Ido at the
// exit door and Erez covering; the wheel opens the door, everyone out, a bigger blast behind, and into
// the Renault. Paint and fire on screen, never anything worse. Invented, as the whole chapter is.
import { near, say } from './missions.js';
import { TEAM, crew, armCrew, endCrew, failOut, clock, Blast, Work, dropBeam } from './firestorm.js';

const H = (game) => game.world.places.hideout;
const OPEN = [
  ['נהוראי', 'אני נשבע לכם, קוצי עוד ישלם על מה שהוא עשה.'],
  ['ארז', 'אחי, קודם תירגע. הרגע הוצאנו אותך משם.'],
  ['דולב', 'אני עדיין לא מאמין שישנת שלושה ימים על כריך אחד.'],
  ['הדר', 'Bro, תאכל פיצה. זה הכי חשוב עכשיו.'],
];
const ENGINE = [['יונתי', 'רגע... אתם שומעים את זה? מנוע.']];
const DUCK = [['עידו', 'נהוראי! תתכופף!']];
const AFTER = [['ארז', 'כולם בסדר?! קוצי מצא אותנו!'], ['עידו', 'הדלת הראשית נעלמה. יש יציאה בצד המזרחי — אני רץ אליה!'], ['ארז', 'אני מחפה. נהוראי, אחריו!']];
const BEAM1 = [['ארז', 'הקורה נפלה! למטה סגור — למעלה, במדרגות המערביות!']];
const BEAM2 = [['עידו', 'גם למעלה סגור! דרך ההריסות, למטה, מהר!']];
const AT_DOOR = [['עידו', 'הדלת תקועה! נהוראי, תעזור לי עם הגלגל!'], ['ארז', 'יש לכם שניות. אני פה.']];
const DOOR_OPEN = [['עידו', 'פתוח! החוצה, כולם!']];
const OUTSIDE = [['ליאם', 'אחים, זה היה קרוב.'], ['נהוראי', 'לרנו. עכשיו.']];
const FIRE_LIMIT = 150;
const KIT = 'ערכת עזרה · סימון אחד נמחק';

// the mission's own things that need ticking and clearing
function clearScene(m, game) {
  for (const b of m.beams || []) b.remove();
  for (const x of m.blasts || []) x.cancel();
  for (const f of m.fires || []) f.stop();
  m.beams = []; m.blasts = []; m.fires = [];
  m.work?.cancel(); m.work = null;
  game.fx.clear();
}
function rubble(m, game, on) {
  const h = H(game), W = game.world;
  if (on && !m.rubble) m.rubble = W.cols.addBox(h.mainDoorOpening.x, h.mainDoorOpening.z - 0.6, 2.4, 1.2, 0, h.y - 1, h.y + 4);
  if (!on && m.rubble) { W.cols.remove(m.rubble); m.rubble = null; }
}
function lightFires(m, game) { const h = H(game); m.fires = h.fires.map((f, i) => game.fx.burn(f.x, f.y, f.z, { r: 0.9, strength: i < 2 ? 1.4 : 1, seconds: 600 })); m.fires.push(game.fx.smokeColumn(h.x, h.y + 4, h.z, { r: 6, strength: 1.6, seconds: 600 })); }
function placeAhead(game) { const h = H(game); for (const [id, at] of [['ido', h.exitAt], ['erez', h.coverAt]]) { const n = game.npc(id); n.target = null; n.place(at.x, at.z, at.yaw, at.y); n.show(true); game.squad.send(id, at, { label: id === 'ido' ? 'בדלת' : 'מחפה' }); n.target = null; n.lookAt(at.x + Math.sin(at.yaw) * 3, at.z + Math.cos(at.yaw) * 3); } game.npc('erez').model.setPose('aim'); }
const onMezz = (game) => game.player.pos.y > H(game).y + 2.4;
const lx = (game) => game.player.pos.x - H(game).x;

export default {
  id: 'firestorm', chapter: 8, number: 1, title: 'השקט שלפני הסערה', requires: ['rescue'],
  where: 'בתצפית בקציר · ארז מחכה',
  startAt: (game) => { const p = game.world.places.plaza; return p ? { x: p.x + p.dx * 3, z: p.z + p.dz * 3, y: p.h } : null; },
  reward: { money: 600, unlocks: ['firestorm'], text: 'יצאתם מהמחסן · 600 ₪' },

  setup(m, game) { m.s = {}; m.beams = []; m.blasts = []; m.fires = []; },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const p = game.world.places.plaza; game.start(p.x + p.dx * 3, p.z + p.dz * 3, Math.atan2(p.dx, p.dz)); },
  failIf(m, game) {
    if ((m.stepIndex === 1 || m.stepIndex === 2) && m.s.t1 != null && game.time - m.s.t1 > FIRE_LIMIT) return 'הלהבות סגרו את המחסן. ארז: "מההתחלה, אחי. והפעם בלי לעצור."';
    return failOut(m, game, [1, 2, 3]);
  },
  restore(m, game, checkpoint) {
    const h = H(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    clearScene(m, game);
    if (game.mode === 'car') game.exitCar();
    h.exitDoor.lock(); h.officeDoor.setOpen(false); h.kit.mesh.visible = true;
    const at = checkpoint >= 2 ? { ...h.exitAt, x: h.exitAt.x - 2.4 } : h.table;
    game.player.place(at.x, at.z, Math.PI / 2, h.y); game.follow.snapBehind(Math.PI / 2);
    crew(game, game.player.pos, Math.PI / 2); armCrew(game); game.paint.reset();
    placeAhead(game);
    m.s = { ...m.s, t1: game.time, beam: [false, false], blast: [false, false, false, false], beamSaid: [false, false], kit: false, doorSaid: false, open: false, out: false, bigBoom: false };
    lightFires(m, game);
    if (checkpoint >= 2) { m.s.beam = [true, true]; m.s.beamSaid = [true, true]; for (const b of h.beams) m.beams.push(Object.assign(dropBeam(game, { ...b, seconds: 0.01 }), {})); }
    game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
  },
  cleanup(m, game) {
    const h = H(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); clock(game, null);
    clearScene(m, game); rubble(m, game, false);
    m.stopSiren?.(); m.stopSiren = null;
    h.exitDoor.lock(); h.officeDoor.setOpen(false); h.kit.mesh.visible = true; h.windowMat.emissiveIntensity = 0;
    if (!m.done) { endCrew(game); for (const id of TEAM) game.npc(id).model.setPose(null); }
  },

  steps: [
    { // 0: the table, the engine, the blast
      objective: 'מחסן המסתור',
      enter(m, game) {
        const h = H(game);
        game.cutscene = true; game.hud.setCinematic(true);
        if (game.mode === 'car') game.exitCar();
        game.hud.fade('כמה שעות אחרי החילוץ · מחסן המסתור', () => {
          game.daylight?.set(1, 0);
          const s0 = h.seats[0];
          game.player.place(s0.x, s0.z, s0.yaw, h.y); game.nehorai.setPose('sit');
          TEAM.forEach((id, i) => { const s = h.seats[i + 1] || h.seats[(i % 7) + 1]; const n = game.npc(id); n.floorY = null; n.target = null; n.place(s.x, s.z, s.yaw, h.y); n.idle = null; n.model.setPose('sit'); n.show(true); });
          game.car.repair(); game.car.place(h.car.x, h.car.z, h.car.yaw, h.y);
          game.follow.shot({ x: h.table.x + 4.5, y: h.y + 2.6, z: h.table.z + 5 }, { x: h.table.x, y: h.y + 0.9, z: h.table.z }, 9999);
          game.hud.banner('פרק 8', 'מבצע סופת אש', 'מחסן המסתור · 04:10', 3200);
          game.dialogue.play(OPEN).then(() => {
            game.sound?.hit?.('crash', 0.25); game.hud.toast('...רעש מנוע מבחוץ', 1800);
            return game.dialogue.play(ENGINE);
          }).then(() => game.dialogue.play(DUCK)).then(() => {
            // the blast at the main door
            const d = h.mainDoor;
            game.fx.explode(d.x, d.y, d.z, { size: 3.2, fire: 0 });
            game.fx.explode(d.x + 3, d.y + 1, d.z - 2, { size: 1.6, sound: false });
            for (const w of h.windows) { game.fx.sparks(w.x, w.y, w.z, 10); game.fx.dust(w.x, w.y - 0.5, w.z, 0.6); }
            h.windowMat.emissiveIntensity = 1.4;
            game.follow.shake(1.4);
            rubble(m, game, true);
            m.stopSiren = game.sound?.siren?.(14) || null;
            lightFires(m, game);
            game.nehorai.setPose(null);
            TEAM.forEach((id) => game.npc(id).model.setPose(null));
            game.hud.banner('בום', 'קוצי מצא אותם', '', 2600);
            game.follow.shot({ x: h.table.x + 7, y: h.y + 3.4, z: h.table.z + 9 }, { x: d.x, y: d.y + 1.5, z: d.z }, 9999);
            return game.dialogue.play(AFTER);
          }).then(() => { m.s.opened = true; });
        }, 1600);
      },
      update: (m) => (m.s.opened ? 'next' : null),
      exit(m, game) {
        const h = H(game);
        game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null;
        game.player.place(h.table.x + 2.4, h.table.z, Math.PI / 2, h.y); game.follow.snapBehind(Math.PI / 2);
        crew(game, game.player.pos, Math.PI / 2); armCrew(game);
        placeAhead(game);
        m.s.t1 = game.time; m.s.beam = [false, false]; m.s.blast = [false, false, false, false]; m.s.beamSaid = [false, false];
      },
    },
    { // 1: through the burning hall
      objective: 'לברוח מהמחסן · לעידו בדלת המזרחית', checkpoint: true,
      target(m, game) {
        const h = H(game), x = lx(game);
        if (!onMezz(game) && x < 2 && m.s.beam[0]) return { ...h.stairsW.bottom, y: h.y, r: 1.6 };
        if (onMezz(game) && x < 8.5) return { ...h.rubble.top, r: 1.6 };
        return { ...h.exitAt, r: 2 };
      },
      interaction(m, game) {
        const h = H(game), me = game.player.pos;
        if (game.mode !== 'foot' || onMezz(game)) return null;
        if (!h.officeDoor.open && near(me, h.officeDoor.pos, 1.8)) return { label: 'לפתוח את הדלת', priority: 4, run: () => { h.officeDoor.setOpen(true); game.sound?.hit?.('block', 0.6); } };
        if (!m.s.kit && h.officeDoor.open && near(me, h.kit, 1.8)) return { label: 'לקחת ערכת עזרה', priority: 5, run: () => { m.s.kit = true; h.kit.mesh.visible = false; if (game.paint.hits > 0) { game.paint.hits--; game.hud.paintClear(); for (let k = 1; k <= game.paint.hits; k++) game.hud.paintHit('#ffb070', k); } game.hud.toast(KIT, 1800); game.sound?.chime?.(true); } };
        return null;
      },
      update(m, game, dt) {
        const h = H(game), x = lx(game), mezz = onMezz(game);
        const left = FIRE_LIMIT - (game.time - m.s.t1);
        clock(game, left, 'הלהבות');
        // the beams come down as he gets near them
        h.beams.forEach((b, i) => {
          if (m.s.beam[i]) return;
          const go = b.trigger.ground ? (!mezz && x > b.trigger.lx) : (mezz && x > b.trigger.lx);
          if (!go) return;
          m.s.beam[i] = true;
          m.beams.push(dropBeam(game, { ...b, seconds: 0.9, onLand: () => { if (!m.s.beamSaid[i]) { m.s.beamSaid[i] = true; game.dialogue.play(i ? BEAM2 : BEAM1); } } }));
        });
        // blasts, each with its warning
        h.blasts.forEach((b, i) => {
          if (m.s.blast[i]) return;
          const t = b.trigger, go = t.mezz ? (mezz && x > t.lx) : (!mezz && x > t.lx);
          if (!go) return;
          m.s.blast[i] = true;
          m.blasts.push(new Blast(game, { at: b, size: b.size, warn: 2.4, radius: 3.2, fire: 25 }));
        });
        for (const b of m.beams) b.update(dt);
        for (const b of m.blasts) b.update(dt);
        say(m, game, !m.s.beam[0] ? 'לברוח מהמחסן · לעידו בדלת המזרחית · עיגול אדום = פיצוץ' : (!mezz && x < 2) ? 'הקורה חסמה · למעלה במדרגות המערביות' : (mezz && x < 8.5) ? 'לאורך היציע · ואז למטה דרך ההריסות' : 'לעידו בדלת המזרחית');
        return !mezz && near(game.player.pos, h.exitAt, 2.4) ? 'next' : null;
      },
    },
    { // 2: the wheel
      objective: 'לסובב את הגלגל עם עידו', checkpoint: true,
      enter(m, game) {
        const h = H(game);
        game.dialogue.play(AT_DOOR);
        m.work = new Work(game, { at: h.wheel, seconds: 5, label: 'לסובב את הגלגל עם עידו', pill: 'מסובבים', near: 2.4, onDone: () => { h.exitDoor.unlock(); h.exitDoor.setOpen(true); game.sound?.hit?.('block', 0.9); game.dialogue.play(DOOR_OPEN); m.s.open = true; } });
        // something goes up across the hall while they work: a warning, and far enough
        m.blasts.push(new Blast(game, { at: { x: h.x + 6, y: h.y, z: h.z + 9 }, size: 1.4, warn: 3.0, radius: 3, fire: 20 }));
      },
      target(m, game) { const h = H(game); return m.s.open ? { ...h.outside, r: 2 } : { ...h.wheel, y: h.y, r: 1.2 }; },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      update(m, game, dt) {
        const h = H(game);
        clock(game, FIRE_LIMIT - (game.time - m.s.t1), 'הלהבות');
        m.work?.update(dt);
        for (const b of m.blasts) b.update(dt);
        for (const b of m.beams) b.update(dt);
        say(m, game, m.s.open ? 'החוצה!' : m.work?.started ? 'מסובבים · להישאר צמוד לגלגל' : 'לגשת לגלגל ליד הדלת ולסובב');
        return m.s.open ? 'next' : null;
      },
      exit(m, game) { clock(game, null); for (const id of ['ido', 'erez']) { game.npc(id).model.setPose(null); game.squad.release(id); } },
    },
    { // 3: out, the big one behind, the Renault
      objective: 'החוצה! לרנו', checkpoint: true,
      target(m, game) { return game.mode === 'car' ? null : { x: game.car.pos.x, z: game.car.pos.z, r: 2.6 }; },
      update(m, game, dt) {
        const h = H(game);
        for (const b of m.blasts) b.update(dt);
        if (!m.s.bigBoom && lx(game) > 23.5) {
          m.s.bigBoom = true;
          game.fx.explode(h.x + 2, h.y + 1, h.z, { size: 3.8, fire: 60 });
          setTimeout(() => game.fx.explode(h.x - 8, h.y + 2, h.z - 6, { size: 2.6, fire: 40 }), 450);
          game.follow.shake(1.4);
          game.hud.banner('', 'המחסן עולה באש', '', 2000);
          game.dialogue.play(OUTSIDE);
        }
        say(m, game, game.mode === 'car' ? 'בתוך הרנו' : m.s.bigBoom ? 'לרנו בחצר · להיכנס' : 'החוצה דרך הדלת המזרחית');
        return game.mode === 'car' ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; m.stopSiren?.(); m.stopSiren = null; },
};
