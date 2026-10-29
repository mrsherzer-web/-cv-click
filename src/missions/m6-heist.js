// Mission 6, "the first strike": the Sharks (a crew invented for the game) still have Nissim's generator
// in their yard between the warehouses. Nehorai and Dolev take it back: slip past their lookout, lift
// it (a held button, nothing more), load it into the Renault, and get away before their cars catch up.
// The yard, the crew and the generator are fictional; nothing here shows how to break in anywhere.
import { near } from './missions.js';
import { Watcher } from '../alert/watcher.js';
import { Chase } from '../vehicle/chaser.js';
import { Fight } from '../combat/fight.js';
import { makeGenerator } from '../world/props.js';

const START = [
  ['ניסים', 'יש עוד משהו. הגנרטור של המשאית. הכרישים לקחו אותו לחצר שלהם, בין המחסנים.'],
  ['דולב', 'אז הולכים להביא אותו. בשקט. נכנסים, לוקחים, יוצאים.'],
  ['נהוראי', 'ואם יראו אותנו?'],
  ['דולב', 'אז יוצאים מהר. בגלל זה יש לך רנו.'],
];
const YARD = [
  ['דולב', 'הנה. אחד עומד על המשמרת. רואה את מה שמסומן על הרצפה? זה מה שהוא רואה.'],
  ['דולב', 'תחכה שיסתובב, תגיע לגנרטור מאחורי המכולה. אני שומר מפה.'],
];
const SPOTTED = [['זנב', 'היי! מי זה שם?! סנפיר, בוא מהר!']];
const LIFTED = [['דולב', 'יש! עכשיו לרכב. יש לנו בערך דקה עד שהם שמים לב.']];
const CHASE = [['דולב', 'הם אחרינו! תאבד אותם, אחי. הם יותר איטיים, תשתמש בזה.']];
const LOST = [['דולב', 'איבדנו אותם. לניסים, לפני שהם מוצאים אותנו שוב.']];
const END = [
  ['ניסים', 'הגנרטור! דולב, החבר שלך הזה, הוא אמיתי.'],
  ['ניסים', 'הנה, ארבע מאות. ותיקחו את הרנו למוסך הצומת, אני משלם על כוונון מנוע. מגיע לכם.'],
  ['דולב', 'המכה הראשונה. נשמע כמו שם של סרט.'],
];
const TIME = 60; // seconds from lifting the generator until the Sharks notice it is gone

const yard = (game) => game.world.places.sharksYard;

function endFight(m) { m.fight?.dispose(); m.fight = null; }
function endChase(m, game) { m.chase?.dispose(); m.chase = null; game.chase = null; }
function dropGenerator(m, game) { if (m.gen) { m.gen.removeFromParent(); m.gen = null; } game.nehorai.setPose(null); }

function startChase(m, game) {
  if (m.chase) return;
  m.chase = new Chase(game, { cars: 2 });
  game.chase = m.chase;
  game.dialogue.play(CHASE);
}

export default {
  id: 'heist', number: 6, title: 'המכה הראשונה',
  requires: ['dolev'],
  reward: { money: 400, unlocks: ['engine'], text: 'הגנרטור חזר לניסים · 400 ₪ · כוונון מנוע ברנו, על חשבון ניסים' },

  startAt: (game) => { const t = game.world.places.beachLot.truck; return { x: t.x + 1.5, z: t.z, y: game.world.places.beachLot.y }; },

  setup(m, game) {
    const nis = game.npc('nissim'), t = game.world.places.beachLot.truck;
    nis.place(t.x, t.z, Math.PI / 2);
    nis.show(true);
    if (!game.companion.active) game.companion.join();
  },

  prepareReplay(game) {
    const L = game.world.places.beachLot;
    game.exitCar();
    game.car.repair();
    game.car.place(L.parking.x, L.parking.z, L.parking.yaw);
    game.start(L.truck.x + 3, L.truck.z, Math.PI / 2);
    game.alert.level = 0;
  },

  failIf(m, game) {
    if (game.car.disabled) return 'הרנו נפגעה יותר מדי במרדף. בפעם הבאה, פחות מגע עם הכרישים.';
    return null;
  },

  restore(m, game) {
    endFight(m);
    endChase(m, game);
    dropGenerator(m, game);
    m.watch?.dispose(); m.watch = null;
    game.dialogue.stop();
    game.cutscene = false;
    game.alert.level = 0;
    game.alert.chasing = false;
    game.car.repair();
    const Y = yard(game);
    game.exitCar();
    // back on the street by the yard, the Renault parked there, Dolev along
    game.car.place(Y.street.x, Y.street.z, Math.PI);
    const q = game.car.local(1.8, 0.3);
    game.player.place(q.x, q.z, -Math.PI / 2);
    game.follow.snapBehind(-Math.PI / 2);
    game.companion.join();
    m.s = {};
  },

  cleanup(m, game) {
    endFight(m);
    endChase(m, game);
    dropGenerator(m, game);
    m.watch?.dispose(); m.watch = null;
    game.npc('zanav').show(false);
    game.npc('snapir').show(false);
  },

  steps: [
    { // 0: Nissim's request
      objective: 'לשמוע את ניסים',
      enter(m, game) { game.dialogue.play(START).then(() => { m.s.heard = true; }); },
      update: (m) => (m.s.heard ? 'next' : null),
    },
    { // 1: to the yard
      objective: 'לנסוע לחצר של הכרישים באזור התעשייה', checkpoint: true,
      target: (m, game) => ({ ...yard(game).entry, y: yard(game).y, r: 3 }),
      enter(m, game) {
        const Y = yard(game), z = game.npc('zanav');
        z.place(Y.patrol[0].x, Y.patrol[0].z, Math.PI / 2);
        z.show(true);
        m.watch?.dispose();
        m.watch = new Watcher(game, z, Y.patrol);
      },
      update(m, game, dt) {
        m.watch?.update(dt);
        return game.mode === 'foot' && near(game.player.pos, yard(game).entry, 9) ? 'next' : null;
      },
    },
    { // 2: past the lookout to the generator
      objective: 'להגיע לגנרטור בלי שהשומר יראה אותך',
      enter(m, game) { game.dialogue.play(YARD); m.s.lift = 0; },
      target: (m, game) => ({ ...yard(game).crate, y: yard(game).y, r: 1.2 }),
      interaction(m, game) {
        if (m.fight || game.mode !== 'foot' || !near(game.player.pos, yard(game).crate, 1.9)) return null;
        return { label: m.s.lifting ? 'מרימים…' : 'להרים את הגנרטור', priority: 5, run: () => { m.s.lifting = true; } };
      },
      update(m, game, dt) {
        const w = m.watch;
        if (!m.fight) w?.update(dt); // once it is a fight, the fight moves him
        if (w?.seeing && !m.fight) game.alert.raise(dt * 70);
        // seen for too long: the lookout calls a friend and it becomes a fight
        if (!m.fight && !m.s.fought && game.alert.level >= 100) {
          m.s.fought = true;
          game.dialogue.play(SPOTTED);
          const sn = game.npc('snapir'), Y = yard(game);
          sn.place(Y.patrol[1].x, Y.patrol[1].z, -Math.PI / 2);
          sn.show(true);
          w.npc.target = null;
          m.fight = new Fight(game, {
            opponents: [{ npc: w.npc, hp: 50, power: 0.85, windup: 0.66, moves: ['swing', 'cross'] }, { npc: sn, hp: 50, power: 0.85, windup: 0.7, moves: ['jab', 'swing'] }],
            allies: game.companion.ally(), maxAttackers: 2,
            onWin: () => { m.s.cleared = true; }, onLose: () => { m.s.lost = true; },
          });
          w.cone.visible = false;
        }
        if (m.s.lost) return 'fail:הכרישים תפסו אתכם בחצר. בפעם הבאה, להישאר מחוץ לשטח שהשומר רואה.';
        if (m.fight && m.s.cleared) { endFight(m); }
        // lifting: hold still next to it for a moment
        if (m.s.lifting) {
          if (!near(game.player.pos, yard(game).crate, 2.2)) m.s.lifting = false;
          else if ((m.s.lift += dt) >= 1.5) return 'next';
          game.hud.setObjective(`מרימים את הגנרטור… ${Math.round((m.s.lift / 1.5) * 100)}%`);
        }
        return null;
      },
      exit(m, game) {
        // the generator in Nehorai's arms: heavy, so no running
        const gen = makeGenerator();
        gen.position.set(0, 0.62, 0.42);
        game.nehorai.root.add(gen);
        game.nehorai.setPose('carry');
        m.gen = gen;
        m.s.clock = TIME;
        game.dialogue.play(LIFTED);
      },
    },
    { // 3: into the car, against the clock
      objective: 'להעמיס את הגנרטור לרנו',
      enter(m, game) { tick(m, game, 0); },
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      interaction(m, game) {
        if (game.mode !== 'foot' || game.car.doorDistance(game.player.pos.x, game.player.pos.z) > 2.2) return null;
        return { label: 'להעמיס את הגנרטור', priority: 5, run: () => { m.s.loaded = true; } };
      },
      update(m, game, dt) {
        if (!m.fight) m.watch?.update(dt);
        tick(m, game, dt);
        game.controls.setRun(false);
        if (!m.s.loaded) { if (game.nehorai.pose !== 'carry' && !game.combat) game.nehorai.setPose('carry'); return null; }
        dropGenerator(m, game);
        return 'next';
      },
    },
    { // 4: away, before they notice; if they do, lose them
      objective: 'להתרחק מהחצר',
      update(m, game, dt) {
        if (!m.fight) m.watch?.update(dt);
        const far = Math.hypot(game.car.pos.x - yard(game).x, game.car.pos.z - yard(game).z);
        if (!m.chase) {
          tick(m, game, dt);
          if (m.s.clock <= 0 || game.alert.level >= 100) {
            if (far > 320 && game.alert.level < 100) return 'next'; // gone before they even looked
            startChase(m, game);
          } else if (far > 420) return 'next';
          return null;
        }
        game.hud.setObjective(`לאבד את הכרישים · הכי קרוב: ${Math.round(Math.min(999, m.chase.nearest))} מ׳`);
        if (m.chase.over && m.chase.escaped) { game.dialogue.play(LOST); endChase(m, game); return 'next'; }
        return null;
      },
    },
    { // 5: to Nissim
      objective: 'להביא את הגנרטור לניסים, בחניון החוף',
      target: (m, game) => ({ ...game.world.places.beachLot.parking, y: game.world.places.beachLot.y, r: 3.5 }),
      enter(m, game) { m.watch?.dispose(); m.watch = null; game.npc('zanav').show(false); },
      update(m, game) {
        const L = game.world.places.beachLot;
        if (!m.s.parked && near(game.car.pos, L.parking, 6) && Math.abs(game.car.speed) < 0.8) {
          m.s.parked = true;
          game.dialogue.play(END).then(() => { m.s.done = true; });
        }
        return m.s.done ? 'next' : null;
      },
    },
  ],
};

// the clock from lifting the generator: in the objective while it runs
function tick(m, game, dt) {
  if (m.s.clock === undefined || m.chase) return;
  m.s.clock -= dt;
  const left = Math.max(0, Math.ceil(m.s.clock));
  if (left !== m.s.shown) { m.s.shown = left; game.hud.setObjective(`${m.s.loaded ? 'להתרחק מהחצר' : 'להעמיס את הגנרטור לרנו'} · עוד ${left} שניות עד שהם שמים לב`); }
}

