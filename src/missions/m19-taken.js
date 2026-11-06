// Chapter seven, mission 1, "נהוראי נחטף". An evening walk to the lookout ends with a dark car,
// two of Kotzi's people, and Nehorai gone. From here the chapter is played as Erez: at the gym the
// friends come in one by one, Erez says the words — nobody gets left behind — and the team drives
// out to the only lead, the abandoned quarry. Kotzi and his people are invented for the game; the
// lines are written for it and describe nobody real. Paint, never blood, as always.
import { near, say } from './missions.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot, roadPath } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';
import { asErez, asNehorai, team, TEAM, NAMES } from './rescue.js';

const TAKEN = [
  ['נהוראי', 'ערב יפה. שקט.'],
  ['שומר', 'נהוראי פרחי? קוצי מוסר דרישת שלום.'],
  ['נהוראי', 'היי, רגע, מה— ארז! עידו!'],
  ['שומר', 'בלי טלפון. ברכב, עכשיו.'],
];
const GYM = [
  ['עידו', 'ארז. נהוראי לא עונה שעתיים. והרנו שלו בתצפית, פתוחה.'],
  ['ארז', 'קוצי.'],
  ['עידו', 'קוצי. מישהו ראה את הוואן השחור שלו נוסע מזרחה.'],
];
const ARRIVALS = [
  ['יונתי', 'הגעתי. אם זה מסוכן, אני רוצה שיידעו שבאתי ראשון.'],
  ['אברהם', 'באתי ישר. דיברתי כל הדרך, אין לי עם מי.'],
  ['מולר', 'פה.'],
  ['דולב', 'חטפו את נהוראי? אני מומחה בלהיחטף. אני בא.'],
  ['הדר', 'Bro. ניו יורק לימדה אותי דבר אחד: לא מחכים.'],
  ['ליאם', 'אחים יקרים. הסיאט בחוץ, מלאה בצבע.'],
];
const SPEECH = [
  ['ארז', 'תקשיבו. קוצי לקח את נהוראי. יש לו מקומות מזרחה, מעבר למחצבה.'],
  ['ארז', 'אנחנו לא משאירים אף אחד מאחור. יוצאים להחזיר את נהוראי.'],
  ['עידו', 'אני איתך בכל צעד. ציוד, דלתות, מלכודות — שלי.'],
  ['אברהם', 'ואני אדבר עם השומרים עד שהם יתחננו שנסמן אותם.'],
  ['ארז', 'לוקחים את הרנו של נהוראי. הוא יבין. סע.'],
];

export default {
  id: 'taken', chapter: 7, number: 1, title: 'נהוראי נחטף', requires: ['cipher'],
  where: 'בתצפית בקציר · ערב',
  startAt: (game) => { const p = game.world.places.plaza; return p ? { x: p.x + p.dx * -3, z: p.z + p.dz * -3, y: p.h } : null; },
  reward: { money: 0, unlocks: ['rescue'], text: 'צוות החילוץ יוצא לדרך · משחקים בתור ארז' },

  setup(m, game) { m.s = {}; game.daylight?.set(1, 0); },
  prepareReplay(game) { asNehorai(game); game.daylight?.set(1, 0); if (game.mode === 'car') game.exitCar(); const p = game.world.places.plaza; game.start(p.x + p.dx * -8, p.z + p.dz * -8, Math.atan2(p.dx, p.dz)); },
  restore(m, game, checkpoint) {
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null;
    if (checkpoint === 2) { asErez(game); const G = game.world.places; game.exitCar(); game.car.place(G.gymParking.x, G.gymParking.z, G.gymParking.yaw); game.start(G.gymInside.x, G.gymInside.z, G.gymInside.yaw); team(game, game.player.pos, game.player.yaw); }
  },
  cleanup(m, game) {
    game.cutscene = false; game.follow.override = null;
    game.nehorai.root.visible = true;
    if (m.van) { game.scene.remove(m.van.model); game.world.cols.dynamic.delete(m.van.box); m.van = null; }
    for (const id of ['kg1', 'kg2']) game.npc(id).show(false);
    if (!m.done) { asNehorai(game); if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); }
  },

  steps: [
    { // 0: the kidnapping, filmed by the game's camera
      objective: 'ערב בתצפית',
      enter(m, game) {
        const W = game.world, P = W.places, road = P.mainRoad, L = road.length;
        game.cutscene = true;
        const me = game.player.pos;
        // Nehorai as a figure in the scene: the player's body steps aside for his double
        game.nehorai.root.visible = false;
        const n = game.npc('nehorai'); n.floorY = null; n.place(me.x, me.z, game.player.yaw); n.idle = 'phone'; n.show(true);
        // the van comes up the main street and stops short of the lookout
        m.van = new Vehicle(W, makeHatchback({ color: '#1c1f26' }), { name: 'van', maxSpeed: 22, accel: 7 });
        game.scene.add(m.van.model);
        const path = roadPath(road, Math.max(0, L - 150), L - 16, 1.8);
        const s0 = road.at(Math.max(0, L - 150));
        m.van.place(s0.x + s0.nx * 1.8, s0.z + s0.nz * 1.8, Math.atan2(s0.tx, s0.tz), s0.h + 0.05);
        m.ap = new Autopilot(path, { cruise: 12 });
        game.chaseCars.push(m.van);
        game.follow.shot({ x: me.x + 6, y: me.y + 3, z: me.z + 6 }, { x: me.x, y: me.y + 1.3, z: me.z }, 9999);
        game.hud.banner('קציר', 'התצפית · 21:40', 'נהוראי יוצא להליכת ערב', 2800);
        m.s.phase = 'drive';
      },
      update(m, game, dt) {
        const n = game.npc('nehorai'), me = n.pos;
        if (m.van && m.ap && m.s.phase === 'drive') {
          m.van.update(dt, m.ap.drive(m.van));
          const d = Math.hypot(m.van.pos.x - me.x, m.van.pos.z - me.z);
          if (m.ap.done || Math.abs(m.van.speed) < 0.5 && m.t > 4 || d < 9) {
            m.s.phase = 'out'; m.van.update(dt, { throttle: 0, brake: 1, steer: 0 });
            const a = m.van.local(-1.5, 0.3), b = m.van.local(1.5, 0.3);
            const g1 = game.npc('kg1'), g2 = game.npc('kg2');
            g1.place(a.x, a.z, 0); g1.show(true); g1.walkTo(me.x - 1, me.z, { run: true, near: 1.2 });
            g2.place(b.x, b.z, 0); g2.show(true); g2.walkTo(me.x + 1, me.z, { run: true, near: 1.2 });
            n.idle = null; n.lookAt(m.van.pos.x, m.van.pos.z);
            game.follow.shot({ x: me.x - 5, y: me.y + 2.2, z: me.z + 4 }, { x: (me.x + m.van.pos.x) / 2, y: me.y + 1.2, z: (me.z + m.van.pos.z) / 2 }, 9999);
            game.dialogue.play(TAKEN).then(() => { m.s.phase = 'in'; n.walkTo(m.van.local(-1.5, 0.3).x, m.van.local(-1.5, 0.3).z, { run: false, near: 0.9, onArrive: () => { n.enter(m.van); for (const id of ['kg1', 'kg2']) { const g = game.npc(id); g.target = null; g.enter(m.van); } m.s.phase = 'away'; const L = game.world.places.mainRoad.length; m.ap = new Autopilot(roadPath(game.world.places.mainRoad, L - 16, Math.max(0, L - 170), 1.8), { cruise: 15 }); game.follow.shot({ x: me.x + 4, y: me.y + 2.4, z: me.z - 3 }, { x: m.van.pos.x, y: me.y + 1.0, z: m.van.pos.z }, 9999); m.s.awayAt = m.t; } }); });
          }
        } else if (m.s.phase === 'away' && m.van && m.ap) {
          m.van.update(dt, m.ap.drive(m.van));
          if (m.t - m.s.awayAt > 5 && !m.s.faded) {
            m.s.faded = true;
            game.hud.fade('באותו ערב · המכון של ארז', () => {
              for (const id of ['nehorai', 'kg1', 'kg2']) { const q = game.npc(id); if (q.inCar) q.stepOut(-1); q.show(false); }
              game.scene.remove(m.van.model); game.world.cols.dynamic.delete(m.van.box); game.chaseCars = game.chaseCars.filter((c) => c !== m.van); m.van = null;
              asErez(game);
              const G = game.world.places;
              game.car.place(G.gymParking.x, G.gymParking.z, G.gymParking.yaw);
              game.start(G.gymInside.x, G.gymInside.z, G.gymInside.yaw);
              game.nehorai.root.visible = true;
              m.s.phase = 'gym';
            }, 1600);
          }
        }
        say(m, game, m.s.phase === 'gym' ? 'במכון' : 'ערב בתצפית');
        return m.s.phase === 'gym' && !game.hud.fading ? 'next' : null;
      },
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 1: the team comes in, one by one; Erez's words
      objective: 'המכון: החבורה מתכנסת',
      enter(m, game) {
        const G = game.world.places, me = game.player.pos;
        game.cutscene = true;
        game.hud.banner('ארז', 'המכון · 23:10', 'משחקים בתור ארז', 3000);
        // Ido is already there; the rest come in through the door, one per line
        const ido = game.npc('ido'); ido.floorY = null; ido.place(me.x + 1.6, me.z + 1.2, Math.atan2(me.x - (me.x + 1.6), me.z - (me.z + 1.2))); ido.idle = 'arms'; ido.show(true);
        game.follow.shot({ x: me.x - 3, y: me.y + 2.2, z: me.z + 4 }, { x: me.x + 0.8, y: me.y + 1.2, z: me.z + 0.6 }, 9999);
        const door = G.gymDoor || { x: me.x, z: me.z + 9 };
        game.dialogue.play(GYM).then(async () => {
          const others = TEAM.filter((id) => id !== 'ido');
          for (const [i, id] of others.entries()) {
            const n = game.npc(id), slot = game.squad.slot(i + 1, me, game.player.yaw);
            n.floorY = null; n.place(door.x + (i % 2 ? 1 : -1), door.z, 0); n.idle = null; n.show(true);
            n.walkTo(slot.x, slot.z, { run: true, near: 0.8, onArrive: () => { n.target = null; n.lookAt(me.x, me.z); n.idle = 'arms'; } });
            await game.dialogue.play([ARRIVALS[i]]);
          }
          game.follow.shot({ x: me.x + 4, y: me.y + 2.0, z: me.z - 4 }, { x: me.x, y: me.y + 1.3, z: me.z }, 9999);
          await game.dialogue.play(SPEECH);
          m.s.spoke = true;
        });
      },
      update: (m) => (m.s.spoke ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); team(game, game.player.pos, game.player.yaw); },
    },
    { // 2: out to the quarry
      objective: 'לנסוע למחצבה הנטושה, מזרחה, עם כולם', checkpoint: true,
      target: (m, game) => { const Q = game.world.places.quarry; return game.mode === 'car' ? { ...Q.parking, r: 6 } : { ...game.car.pos, r: 2.6 }; },
      update(m, game) {
        const Q = game.world.places.quarry;
        say(m, game, game.mode === 'car' ? 'לנסוע למחצבה: דרך הכרמים ואז דרך המחצבה, מזרחה' : 'להיכנס לרנו · החבורה מאחוריך');
        return game.mode === 'car' && near(game.car.pos, Q.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
