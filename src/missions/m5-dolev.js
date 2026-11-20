// Mission 5, "picking up Dolev": Dolev heard about the court and wants in. Nehorai calls him from the
// phone, picks him up at the beach and goes with him to the beach car park, where the Sharks (a crew
// invented for the game) chased his cousin's falafel truck off its spot. Dolev fights alongside; then
// the truck is back in business. All the people and businesses here are fictional.
import { near, say } from './missions.js';
import { Fight } from '../combat/fight.js';

const SHARKS = ['gali', 'snapir', 'shen'];
const CALL = [
  ['דולב', 'נהוראי? פה דולב. שמעתי מה עשיתם במגרש. כל חדרה שמעה.', 'phone'],
  ['נהוראי', 'כל חדרה זה ארבעה אנשים ליד קיוסק.'],
  ['דולב', 'ארבעה אנשים עם הרבה חברים. תקשיב, יש לי בקשה. אני בחוף, ליד המציל. תבוא?', 'phone'],
];
const MEET = [
  ['דולב', 'הנה הוא! האיש מהמגרש. אני דולב. אני כבר מחבב אותך.'],
  ['דולב', 'הבן דוד שלי, ניסים, יש לו משאית פלאפל בחניון החוף. שלוש שנים באותו מקום.'],
  ['דולב', 'עכשיו באו הכרישים ואמרו שהחניה שלהם. בוא נלך לדבר איתם. ביחד זה נראה יותר טוב.'],
];
const RIDE = [
  ['דולב', 'אתה יודע שהרנו הזאת שלך עושה רעש כמו מקרר?'],
  ['נהוראי', 'אתה יכול ללכת ברגל.'],
  ['דולב', 'אמרתי שזה רעש נעים. מקרר טוב.'],
];
const FACE = [
  ['גלי', 'אה, דולב הביא חבר. כמה מרגש.'],
  ['דולב', 'גלי, זה המקום של ניסים. שלוש שנים. כולם יודעים.'],
  ['גלי', 'כולם ידעו. עכשיו כולם יודעים משהו אחר.'],
  ['נהוראי', 'תזיזו את עצמכם, והמשאית חוזרת. פשוט.'],
  ['גלי', 'פשוט? בוא נראה כמה פשוט.'],
];
const AFTER = [
  ['גלי', 'טוב, טוב. החניה של ניסים. היא תמיד הייתה של ניסים.'],
  ['ניסים', 'דולב! אתה והחבר שלך, פלאפל עליי. לכל החיים. או לחודש. נראה.'],
  ['דולב', 'רואה? אמרתי לך שאני מחבב אותך. מעכשיו אני בטלפון שלך. תתקשר מתי שצריך.'],
];
const LOSE = 'הכרישים לקחו את הסיבוב. דולב אומר: ״עוד פעם, והפעם תחסום כשהם מסתובבים.״';

const lot = (game) => game.world.places.beachLot;
const lifeguard = (game) => { const b = game.world.places.beach; return { x: b.x + 2, z: b.z - 18, y: b.y }; };

function sharksAtTruck(game) {
  const L = lot(game);
  SHARKS.forEach((id, i) => {
    const n = game.npc(id);
    n.place(L.x - 2 + i * 1.6, L.z - 4 + (i % 2) * 1.5, -Math.PI / 2);
    n.idle = i ? 'arms' : null;
    n.model.setPose(null);
    n.show(true);
  });
  const nis = game.npc('nissim');
  nis.place(L.x + 6, L.z + 7, -Math.PI / 2);
  nis.idle = 'phone';
  nis.show(true);
}

function lineUp(game) {
  const L = lot(game), d = game.npc('dolev');
  game.exitCar();
  game.player.place(L.x + 3, L.z + 2, -Math.PI / 2);
  game.follow.snapBehind(-Math.PI / 2);
  if (d.inCar) d.stepOut(-1);
  d.place(L.x + 3.5, L.z + 4, -Math.PI / 2);
  d.show(true);
  game.companion.active = true;
  SHARKS.forEach((id, i) => { const n = game.npc(id); n.place(L.x - 3 + i * 1.4, L.z - 3 + i * 2.2, Math.PI / 2); n.model.setPose(null); n.idle = null; n.show(true); });
}

function fight(m, game) {
  m.s.won = m.s.lost = false;
  m.fight = new Fight(game, {
    maxAttackers: 2,
    opponents: SHARKS.map((id, i) => ({ npc: game.npc(id), hp: i === 0 ? 70 : 50, power: i === 0 ? 1.0 : 0.85, aggression: 0.9 + i * 0.06, windup: 0.64, moves: [['swing', 'cross', 'swing'], ['jab', 'cross'], ['swing', 'jab']][i] })),
    allies: game.companion.ally(),
    onWin: () => { m.s.won = true; },
    onLose: () => { m.s.lost = true; },
  });
}

function endFight(m) { m.fight?.dispose(); m.fight = null; }

export default {
  id: 'dolev', number: 5, title: 'מרימים לדולב',
  requires: ['crew'],
  startByCall: 'dolev',
  where: 'להתקשר לדולב מהטלפון (הכפתור למעלה משמאל)',
  reward: { money: 150, unlocks: ['dolev-crew'], text: 'דולב בחבורה: אפשר לקרוא לו מהטלפון בכל זמן, והוא עוזר במשימות' },

  setup(m, game) {
    const d = game.npc('dolev'), at = lifeguard(game);
    d.place(at.x, at.z, Math.PI / 2);
    d.idle = 'arms';
    d.show(true);
    sharksAtTruck(game);
  },

  prepareReplay(game) {
    const p = game.world.places.safeParking;
    game.companion.leave();
    game.exitCar();
    game.car.place(p.x, p.z, p.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, p.yaw);
  },

  restore(m, game, checkpoint) {
    endFight(m);
    game.cutscene = false;
    game.dialogue.stop();
    game.follow.override = null;
    if (checkpoint === 3) { lineUp(game); m.restored = 3; }
  },

  cleanup(m, game) {
    endFight(m);
    game.cutscene = false;
    for (const id of SHARKS) { const n = game.npc(id); n.model.setPose(null); }
  },

  steps: [
    { // 0: the call
      objective: 'דולב על הקו',
      enter(m, game) { game.dialogue.play(CALL).then(() => { m.s.called = true; }); },
      update: (m) => (m.s.called ? 'next' : null),
    },
    { // 1: to the beach
      objective: 'לאסוף את דולב בחוף, ליד סוכת המציל',
      target: (m, game) => ({ ...lifeguard(game), r: 2.5 }),
      update(m, game) {
        const d = game.npc('dolev'), p = game.pos;
        if (!m.s.met && near(p, d.pos, game.mode === 'car' ? 30 : 12)) {
          m.s.met = true;
          d.idle = null;
          d.model.play('wave');
          game.companion.join({ near: d.pos });
          game.dialogue.play(MEET);
        }
        if (!m.s.met) return null;
        const close = game.mode === 'car' ? d.inCar : near(game.player.pos, d.pos, 5);
        return close && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 2: to the beach car park
      objective: 'לנסוע עם דולב לחניון החוף בקצה הטיילת',
      target: (m, game) => ({ ...lot(game).parking, y: lot(game).y, r: 3 }),
      enter(m, game) { if (game.mode === 'car') game.dialogue.play(RIDE); },
      update(m, game) {
        const L = lot(game), p = game.player.pos, inLot = Math.abs(p.x - L.x) < L.hx + 4 && Math.abs(p.z - L.z) < L.hz + 4;
        say(m, game, game.mode === 'car' && inLot ? 'לעצור ולצאת מהרכב' : 'לנסוע עם דולב לחניון החוף בקצה הטיילת');
        return game.mode === 'foot' && inLot ? 'next' : null;
      },
    },
    { // 3: the Sharks
      objective: 'הכרישים בחניה של ניסים', checkpoint: true,
      enter(m, game) {
        const retry = m.restored === 3;
        m.restored = null;
        if (!game.companion.npc.visible || game.companion.npc.inCar) game.companion.join();
        if (retry) { fight(m, game); return; }
        game.cutscene = true;
        const L = lot(game), g = game.npc('gali');
        g.idle = null;
        g.walkTo(game.player.pos.x - 2.2, game.player.pos.z, { onArrive: () => g.lookAt(game.player.pos.x, game.player.pos.z) });
        game.follow.shot({ x: L.x + 9, y: L.y + 2.4, z: L.z + 7 }, { x: L.x - 1, y: L.y + 1.2, z: L.z - 1 }, 60);
        game.dialogue.play(FACE).then(() => {
          if (game.missions.active !== m || m.stepIndex !== 3 || m.fight) return; // the mission moved on meanwhile
          game.cutscene = false;
          game.follow.override = null;
          game.follow.snapBehind(game.player.yaw);
          game.hud.banner('מרימים לדולב', 'נהוראי ודולב מול הכרישים', '', 1800);
          fight(m, game);
        });
      },
      update(m, game) {
        if (m.s.lost) return `fail:${LOSE}`;
        if (m.fight && m.s.shown !== m.fight.standing.length) { m.s.shown = m.fight.standing.length; game.hud.setObjective(`הכרישים: עוד ${m.s.shown} על הרגליים`); }
        if (m.s.won) { m.s.wonAt ??= m.t; if (m.t - m.s.wonAt > 1.2) return 'next'; }
        return null;
      },
      exit: endFight,
    },
    { // 4: the truck is back
      objective: 'ניסים חוזר לעבוד',
      enter(m, game) {
        game.cutscene = true;
        for (const id of SHARKS) { const n = game.npc(id); if (n.model.pose === 'down') { n.model.setPose(null); n.model.play('getup'); } }
        const nis = game.npc('nissim'), t = lot(game).truck;
        nis.idle = null;
        nis.walkTo(t.x, t.z, { onArrive: () => { nis.lookAt(game.player.pos.x, game.player.pos.z); nis.model.play('wave'); } });
        game.dialogue.play(AFTER).then(() => { m.s.done = true; });
      },
      update: (m) => (m.s.done ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        for (const id of SHARKS) { const n = game.npc(id), L = lot(game); n.walkTo(L.x - 30, L.z - 60, { onArrive: () => n.show(false) }); }
      },
    },
  ],
};
