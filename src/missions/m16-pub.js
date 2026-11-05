// Chapter five, mission 1, "הפאב בקציר". A week after Kotzi's bank. Five in the afternoon, Nehorai is
// home, in the living room, when Ido calls: a pub has opened in Katzir, by the lookout, and he and
// Yonati are going for a drink tonight — Nehorai is in, for nine. Four hours pass; night falls over a
// Katzir strung with lights (pink neon by the pub); Nehorai walks over. Inside — music, a crowd, a
// bar — Kai (the new barman) and Yahli welcome him, Ido and Yonati wave from the bar, and Liam makes
// his entrance from behind with something to ask of everyone. The lines are written for the game and
// do not describe the real people; everyone here is a fictional version.
import { near, say } from './missions.js';
import { Npc } from '../friends/npc.js';
import { passerBy } from '../characters/extras.js';

// Ido's call, 17:00
const CALL = [
  ['עידו', 'נהוראי! שמע, פתחו את הפאב בקציר!', 'phone'],
  ['נהוראי', 'פאב? בקציר?'],
  ['עידו', 'ליד התצפית. אני ויונתי הולכים לשתות שם הערב. בוא איתנו.', 'phone'],
  ['נהוראי', 'בטח שאני בא!'],
  ['עידו', 'סגור. תשע בערב, בפאב. אל תאחר.', 'phone'],
  ['נהוראי', 'בתשע אני שם.'],
];
// at the bar
const BAR = [
  ['קאי', 'נהוראי! ברוך הבא לפאב. מה שותים?'],
  ['נהוראי', 'קאי! לא ידעתי שאתה ברמן.'],
  ['קאי', 'מאתמול. יהלי, תראה מי הגיע.'],
  ['יהלי', 'יואו נהוראי! אחי, איזה כיף.'],
  ['יהלי', 'יואו, גם ליאם מגיע היום לבר.'],
  ['נהוראי', 'יואו, מתי הוא פה?'],
  ['ליאם', 'אני פה מאחוריך.'],
  ['נהוראי', 'יואו ליאםםם! מה איתך אחי?'],
  ['ליאם', 'אההה יא אחים יקריםםם! שמעו רגע... אני צריך אתכם.'],
  ['ליאם', 'יש אחד, קוראים לו יניב. ניצח אותנו בקלפים בקיץ עם חפיסה מסומנת, ולקח את כל הקופה. היא אצלו בבית, בתיקים.'],
  ['ליאם', 'הבעיה: יש לו שומרים בחצר ושניים על הגג. ואנחנו משחקים לפי החוקים שלנו. צבע. מי שמסומן, בחוץ.'],
  ['עידו', 'ומולר?'],
  ['ליאם', 'מולר תופס עמדה בבניין ממול. מי שנהוראי מסמן, מולר מוריד מהגג. בלי שמולר רואה, אין סימון.'],
  ['יונתי', 'ואנחנו נכנסים חדר-חדר. כמו במשחק.'],
  ['ליאם', 'בדיוק. יש לי את הסיאט, לנהוראי יש את הרנו. שתי מכוניות, שתי יציאות.'],
  ['נהוראי', 'הלילה?'],
  ['ליאם', 'הלילה. בשלוש.'],
];
const LIAM_IN = 6; // the line after which Liam steps in from behind

const pub = (game) => game.world.places.pub;
const home = (game) => game.world.places.home?.interior;

// the crowd: two dozen passers-by at the pub's spots, dancing, standing, sitting, on the phone
function populatePub(game) {
  const P = pub(game); if (!P) return;
  if (!game.pubCrowd) {
    game.pubCrowd = P.crowd.map((c, i) => {
      const n = new Npc(game, passerBy(500 + i), { detail: 'low' });
      n.place(c.x, c.z, c.yaw);
      if (c.pose === 'sit') { n.idle = null; n.model.setPose('sit'); }
      else n.idle = c.pose === 'dance' ? 'cheer' : c.pose === 'phone' ? 'phone' : 'arms';
      n.show(true);
      return n;
    });
  } else for (const n of game.pubCrowd) n.show(true);
}
function clearPubCrowd(game) { for (const n of game.pubCrowd || []) n.show(false); }

// the named friends at the bar
function placeBar(game) {
  const B = pub(game).bar;
  for (const id of ['kai', 'yahli', 'ido', 'yonati']) { const n = game.npc(id), s = B[id]; n.place(s.x, s.z, s.yaw); n.idle = 'arms'; n.target = null; n.show(true); }
  if (game.idoBuddy.active) game.idoBuddy.leave();
  game.npc('ido').place(B.ido.x, B.ido.z, B.ido.yaw); game.npc('ido').show(true);
}

export default {
  id: 'pub', chapter: 5, number: 1, title: 'הפאב בקציר', requires: ['bank'],
  incoming: true,
  where: 'בבית · עידו יתקשר עוד רגע',
  reward: { money: 300, unlocks: ['pub-crew', 'liam', 'kai', 'yahli', 'chapter-5a'], text: 'ליאם, קאי ויהלי בטלפון · הפאב פתוח · 300 ₪' },

  setup(m, game) {
    m.s = {};
    game.daylight?.set(0, 0);
    if (game.idoBuddy.active) game.idoBuddy.leave();
    if (game.companion.active) game.companion.leave();
    if (game.hadarBuddy.active) game.hadarBuddy.leave();
    const I = home(game);
    if (I) game.hud.fade('17:00 · בבית', () => { game.start(I.living.x, I.living.z, I.living.yaw); }, 1300);
  },
  prepareReplay(game) {
    game.daylight?.set(0, 0);
    if (game.mode === 'car') game.exitCar();
    clearPubCrowd(game);
    const I = home(game);
    if (I) game.start(I.outside.x, I.outside.z, I.outside.yaw);
  },
  restore(m, game, checkpoint) {
    game.dialogue.stop();
    game.cutscene = false; game.follow.override = null;
    game.hud.showCall(null);
    if (checkpoint === 1) { const I = home(game); game.daylight?.set(1, 0); game.start(I.living.x, I.living.z, I.living.yaw); }
    if (checkpoint >= 2) game.daylight?.set(1, 0);
    if (checkpoint === 4) { const P = pub(game); populatePub(game); placeBar(game); game.start(P.doorInside.x, P.doorInside.z, P.doorInside.yaw); }
  },
  cleanup(m, game) {
    game.hud.showCall(null);
    game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw);
    game.nehorai.setPose(null);
    if (m.done) return; // the night, the crowd and the music stay for the pub the chapter revolves around
    clearPubCrowd(game);
    game.radio?.stopAmbient();
    for (const id of ['kai', 'yahli', 'liam']) game.npc(id).show(false);
    if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3);
  },

  steps: [
    { // 0: at home; Ido calls
      objective: 'עידו מתקשר. לענות',
      enter(m, game) { game.daylight?.set(0, 0); },
      update(m, game) {
        if (!m.s.rang && m.t > 3.2 && !game.hud.fading) {
          m.s.rang = true;
          game.hud.showCall('עידו', () => { game.nehorai.setPose('phone'); game.dialogue.play(CALL).then(() => { m.s.talked = true; game.nehorai.setPose(null); }); });
        }
        say(m, game, m.s.rang ? 'עידו מתקשר. לענות' : 'בבית, 17:00');
        return m.s.talked ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 1: four hours later; out of the house
      objective: 'כעבור 4 שעות · 21:00 · לצאת מהבית', checkpoint: true,
      enter(m, game) {
        if (!m.s.skipped) { m.s.skipped = true; game.hud.fade('כעבור 4 שעות · 21:00', () => { game.daylight?.set(1, 0); game.hud.banner('קציר', '21:00', 'הפאב ליד התצפית', 2600); }, 1800); }
        else game.daylight?.set(1, 0);
      },
      target: (m, game) => { const I = home(game); return I && !m.s.outside ? { x: I.door.x, z: I.door.z, y: I.floorY, r: 1.6 } : null; },
      interaction(m, game) {
        const I = home(game);
        if (!I || game.mode !== 'foot' || game.hud.fading || m.s.outside) return null;
        if (near(game.player.pos, I.door, 2.6)) return { label: 'לצאת החוצה', priority: 5, run: () => { m.s.outside = true; game.hud.fade('', () => { game.start(I.outside.x, I.outside.z, I.outside.yaw); }, 700); } };
        return null;
      },
      update(m, game) { say(m, game, m.s.outside ? '21:00 · בחוץ' : '21:00 · לגשת לדלת ולצאת מהבית'); return m.s.outside && !game.hud.fading ? 'next' : null; },
    },
    { // 2: to the pub, on foot or in the Renault
      objective: 'ללכת לפאב בקציר, ליד התצפית', checkpoint: true,
      enter(m, game) { game.daylight?.set(1, 0); },
      target: (m, game) => { const P = pub(game); if (!P) return null; return game.mode === 'car' ? { ...P.parking, y: P.parkingY, r: 5 } : { ...P.entrance, y: P.floorY, r: 3 }; },
      update(m, game) {
        const P = pub(game); if (!P) return 'next';
        say(m, game, game.mode === 'car' ? 'לנסוע לפאב ליד התצפית ולחנות' : 'ללכת לפאב בקציר, ליד התצפית');
        return game.mode === 'foot' && near(game.player.pos, P.entrance, 3.4) ? 'next' : null;
      },
    },
    { // 3: in through the door: the pub, the crowd, Ido and Yonati waving from the bar
      objective: 'להיכנס לפאב',
      enter(m, game) {
        const P = pub(game);
        populatePub(game); placeBar(game);
        game.radio?.ambient('pub', { x: P.center.x, z: P.center.z }, 28);
        game.player.place(P.doorInside.x, P.doorInside.z, P.doorInside.yaw);
        const ido = game.npc('ido'), yonati = game.npc('yonati');
        const fallback = () => new Promise((res) => {
          game.cutscene = true;
          const door = P.doorInside, c = P.center, bar = P.bar.ido, y = P.floorY;
          game.follow.shot({ x: door.x, y: y + 1.6, z: door.z }, { x: c.x, y: y + 1.3, z: c.z }, 9999);
          setTimeout(() => game.follow.shot({ x: c.x + 1.5, y: y + 2.2, z: c.z + 2.5 }, { x: bar.x, y: y + 1.4, z: bar.z }, 9999), 2500);
          setTimeout(() => { ido.model.play('wave'); yonati.model.play('wave'); ido.lookAt(door.x, door.z); yonati.lookAt(door.x, door.z); game.follow.shot({ x: bar.x + 1.5, y: y + 1.7, z: bar.z + 3.2 }, { x: bar.x + 0.6, y: y + 1.4, z: bar.z }, 9999); }, 4600);
          setTimeout(res, 7400);
        });
        game.playCutscene('pub-enter', fallback).then(() => { ido.model.play('wave'); yonati.model.play('wave'); m.s.shown = true; });
      },
      update: (m) => (m.s.shown ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); },
    },
    { // 4: to the bar; Kai and Yahli, then Liam from behind
      objective: 'לגשת לבר, אל קאי ויהלי', checkpoint: true,
      target: (m, game) => { const P = pub(game); return P && !m.s.talking ? { ...P.bar.player, y: P.floorY, r: 1.8 } : null; },
      enter(m, game) { populatePub(game); placeBar(game); },
      update(m, game) {
        const P = pub(game); if (!P) return 'next';
        if (!m.s.talking && near(game.player.pos, P.bar.player, 2.3)) {
          m.s.talking = true;
          game.player.place(P.bar.player.x, P.bar.player.z, P.bar.player.yaw);
          game.follow.snapBehind(P.bar.player.yaw);
          game.npc('kai').lookAt(P.bar.player.x, P.bar.player.z);
          game.dialogue.play(BAR).then(() => { m.s.done = true; });
        }
        if (m.s.talking && !m.s.liamIn && game.dialogue.said >= LIAM_IN + 1) {
          m.s.liamIn = true;
          const liam = game.npc('liam'), s = P.liamSpot;
          liam.place(s.x, s.z, s.yaw); liam.idle = 'arms'; liam.show(true);
          for (const id of ['ido', 'yonati', 'kai', 'yahli']) game.npc(id).lookAt(s.x, s.z);
          liam.lookAt(game.player.pos.x, game.player.pos.z);
          game.player.yaw = Math.atan2(s.x - game.player.pos.x, s.z - game.player.pos.z); // Nehorai turns round
        }
        say(m, game, m.s.talking ? 'בבר' : 'לגשת לבר, אל קאי ויהלי');
        return m.s.done ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
