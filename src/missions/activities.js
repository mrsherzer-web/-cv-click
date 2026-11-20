// Things to do between and after the story missions, as many times as you like, each paid every time it
// is done and each with its best result kept: the bag challenge at the gym, a sparring rematch in the
// ring, deliveries for the boulevard kiosk, and a timed drive from the gym to the beach.
import { near } from './missions.js';
import { Fight } from '../combat/fight.js';

const records = (game) => (game.progress.records ||= {});
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// 15 punches on the bag in 12 seconds
const bag = {
  id: 'bag-challenge', title: 'אתגר השק',
  available: (game) => game.missions.done('gym'),
  startAt: (game) => { const g = game.world.places.gym, p = g.toWorld(-2.5, -3.3); return { x: p.x, z: p.z, y: g.floorY }; },
  reward: { money: 40 },
  setup(m, game) { game.exitCar(); },
  steps: [{
    objective: '15 מכות בשק ב־12 שניות',
    target: (m, game) => { const b = game.world.places.gymBags[2]; return { x: b.x, z: b.z, y: game.world.places.gym.floorY, r: 1.1 }; },
    enter(m, game) { m.s.h0 = game.bagHits; m.s.left = 12; m.s.go = false; },
    update(m, game, dt) {
      const n = game.bagHits - m.s.h0;
      if (n > 0) m.s.go = true; // the clock starts with the first punch
      if (m.s.go) m.s.left -= dt;
      const text = `אתגר השק: ${n}/15 · ${Math.max(0, m.s.left).toFixed(1)} שניות`;
      if (text !== m.s.shown) { m.s.shown = text; game.hud.setObjective(text); }
      if (n >= 15) {
        const best = records(game).bag ?? Infinity, took = 12 - m.s.left;
        if (took < best) records(game).bag = took;
        m.s.result = `+40 ₪ · ${took.toFixed(1)} שניות${took < best ? ' · שיא חדש!' : ''}`;
        return 'next';
      }
      if (m.s.left <= 0) return `fail:הזמן נגמר אחרי ${n} מכות. מכה, מכה, מכה, בלי לחכות.`;
      return null;
    },
  }],
};

// a round in the ring against Yonati or Erez, taking turns
const rematch = {
  id: 'rematch', title: 'ספרינג חוזר',
  available: (game) => game.missions.done('gym'),
  startAt: (game) => { const g = game.world.places.gym, R = g.ring, p = g.toWorld(R.x, R.z + R.half + 1.2); return { x: p.x, z: p.z, y: g.floorY }; },
  reward: { money: 50 },
  setup(m, game) {
    const g = game.world.places.gym, R = g.ring, who = (records(game).rematches || 0) % 2 ? 'erez' : 'yonati';
    m.s.who = who;
    const me = g.toWorld(R.x, R.z + 1.3), them = g.toWorld(R.x, R.z - 1.3), n = game.npc(who);
    game.exitCar();
    game.player.place(me.x, me.z, g.yaw + Math.PI);
    game.follow.snapBehind(g.yaw + Math.PI);
    n.place(them.x, them.z, g.yaw);
    n.show(true);
  },
  restore(m, game) { m.fight?.dispose(); m.fight = null; rematch.setup(m, game); },
  cleanup(m, game) { m.fight?.dispose(); m.fight = null; game.populate({ walk: true }); },
  steps: [{
    objective: 'ספרינג: להפיל את היריב',
    enter(m, game) {
      m.s.won = m.s.lost = false;
      const yon = m.s.who === 'yonati';
      m.fight = new Fight(game, {
        opponents: [{ npc: game.npc(m.s.who), hp: yon ? 70 : 85, power: yon ? 0.6 : 0.75, aggression: yon ? 0.95 : 1.05, windup: yon ? 0.7 : 0.62, moves: yon ? ['jab', 'cross', 'swing'] : ['cross', 'swing', 'jab', 'cross'] }],
        onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; },
      });
    },
    update(m, game) {
      if (m.s.lost) return 'fail:הפעם הם לקחו את הסיבוב. עוד אחד?';
      if (m.s.won) {
        m.s.wonAt ??= m.t;
        if (m.t - m.s.wonAt > 1) {
          records(game).rematches = (records(game).rematches || 0) + 1;
          m.s.result = `+50 ₪ · ניצחונות בספרינג: ${records(game).rematches}`;
          const n = game.npc(m.s.who);
          n.model.setPose(null);
          n.model.play('getup');
          return 'next';
        }
      }
      return null;
    },
    exit(m) { m.fight?.dispose(); m.fight = null; },
  }],
};

// a package from the kiosk to a door somewhere in Hadera, against the clock
const delivery = {
  id: 'delivery', title: 'משלוח מהקיוסק',
  available: (game) => game.missions.done('crew'),
  startAt: (game) => { const k = game.world.places.kiosk; return { x: k.x - 3, z: k.z + 3.4, y: k.y }; },
  reward: { money: 60 },
  setup(m, game) {
    const k = game.world.places.kiosk, spots = game.world.places.sidewalkSpots || [];
    const far = spots.filter((p) => { const d = Math.hypot(p.x - k.x, p.z - k.z); return d > 140 && d < 380; });
    const dest = far[Math.floor(Math.random() * far.length)] || spots[0];
    m.s.dest = { x: dest.x, z: dest.z, y: game.world.places.hadera.y + 0.16, r: 2.2 };
    m.s.left = Math.round(25 + Math.hypot(dest.x - k.x, dest.z - k.z) / 7);
  },
  steps: [{
    objective: 'להביא את המשלוח לפני שהזמן נגמר',
    target: (m) => m.s.dest,
    update(m, game, dt) {
      m.s.left -= dt;
      const text = `משלוח מהקיוסק · ${clock(Math.max(0, m.s.left))}`;
      if (text !== m.s.shown) { m.s.shown = text; game.hud.setObjective(text); }
      if (near(game.pos, m.s.dest, game.mode === 'car' ? 6 : 2.6)) {
        const done = (records(game).deliveries || 0) + 1;
        records(game).deliveries = done;
        m.s.result = `+60 ₪ · משלוחים: ${done}`;
        return 'next';
      }
      if (m.s.left <= 0) return 'fail:המשלוח התקרר. בקיוסק מחכה עוד אחד.';
      return null;
    },
  }],
};

// from the gym's car park to the beach car park, as fast as the Renault goes
const trial = {
  id: 'time-trial', title: 'סיבוב שעון: מהמכון לחוף',
  available: (game) => game.missions.done('hadera'),
  startAt: (game) => { const p = game.world.places.gymParking; return { x: p.x - 7, z: p.z + 3, y: p.y }; },
  reward: { money: 80 },
  setup(m, game) {
    const p = game.world.places.gymParking, av = game.npc('avraham');
    if (av.inCar) av.stepOut(-1);
    game.exitCar();
    game.car.place(p.x, p.z, p.yaw);
    game.enterCar();
    m.s.limit = 150;
  },
  failIf: (m, game) => (game.car.disabled ? 'הרנו לא שרדה את הסיבוב. המוסך בחדרה מחכה.' : null),
  steps: [{
    objective: 'לנסוע לחניון החוף בחדרה',
    target: (m, game) => ({ ...game.world.places.beachLot.parking, y: game.world.places.beachLot.y, r: 4 }),
    enter(m) { m.s.t = 0; },
    update(m, game, dt) {
      m.s.t += dt;
      const best = records(game).trial;
      const text = `סיבוב שעון · ${clock(m.s.t)}${best ? ` · שיא ${clock(best)}` : ''}`;
      if (text !== m.s.shown) { m.s.shown = text; game.hud.setObjective(text); }
      if (game.mode === 'car' && near(game.car.pos, game.world.places.beachLot.parking, 8)) {
        if (!best || m.s.t < best) records(game).trial = m.s.t;
        m.s.result = `+80 ₪ · ${clock(m.s.t)}${!best || m.s.t < best ? ' · שיא חדש!' : ''}`;
        return 'next';
      }
      if (m.s.t > m.s.limit) return 'fail:שתי דקות וחצי עברו. הכביש לא יברח, נסו שוב.';
      return null;
    },
  }],
};

export const ACTIVITIES = [bag, rematch, delivery, trial];
