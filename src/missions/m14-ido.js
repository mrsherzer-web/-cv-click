// Chapter four, mission 1, "Ido joins". A week after the boxing night Erez calls: Kotzi (a character
// invented for the game) has been collecting money from everyone for years and set up a "bank" with
// it, in the industrial zone. Then, out of the blue, a video call: Ido Hidna, back after a long time
// away, heard about it from Erez and is in. Nehorai picks him up at the promenade, they drive up to the
// gym where the whole crew hears the plan, Ido hands out paintball markers (paint, by the rules the two
// crews have always played by: no blood, whoever is marked is out), and Nehorai learns to shoot one on
// five practice targets. The lines are written for the game and do not describe the real people.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { gymCrowd } from './m1-pickup.js';
import { makeMoneyBag } from '../world/bank.js';
import { twoShot } from '../combat/bout.js';

const EREZ = [
  ['ארז', 'נהוראי. יש לי חדשות, ואתה לא תאהב אותן.', 'phone'],
  ['נהוראי', 'אתה אף פעם לא מתקשר עם חדשות טובות.'],
  ['ארז', 'קוצי. כל השנים הוא "אסף" כסף: דמי כניסה למגרש, "קנסות" בקיוסק, התערבויות שהוא שכח לשלם. מכולם.', 'phone'],
  ['ארז', 'ועם הכסף הזה הוא פתח בנק. בנק קוצי. באזור התעשייה, מאחורי המוסכים. עם שלט.', 'phone'],
  ['נהוראי', 'בנק?! עם הכסף של כולם?'],
  ['ארז', 'עם הכסף של כולם. גם שלך. אני עובד על משהו. תישאר ליד הטלפון.', 'phone'],
];
// the first line as the player asked for it, word for word
const CALL = [
  ['עידו', 'שמע נהוראי, שמעתי על קוצי מארז, ואני מצטרף!'],
  ['נהוראי', 'עידו?! אח יקר! איפה היית? התגעגעתי אליך, יא מלך.'],
  ['עידו', 'גם אני, אחי. הרבה. אבל געגועים אחר כך. עכשיו לעניין.'],
  ['נהוראי', 'לעניין.'],
  ['עידו', 'אחת: אני בחדרה, בטיילת, מול הים. תאסוף אותי.'],
  ['עידו', 'שתיים: תגיד לכולם מכון בקציר, בעוד שעה. יש לי ציוד בתיק.'],
  ['נהוראי', 'ציוד?'],
  ['עידו', 'רובים. פיינטבול. צבע, לא דם. כמו שאתה אוהב, וכמו שהם מבינים.'],
  ['עידו', 'שלוש: אל תאחר. אני לא אוהב לחכות ליד הים. זה גורם לי לחשוב.'],
];
const MEET = [
  ['עידו', 'נהוראי! בוא הנה, אח יקר!'],
  ['נהוראי', 'עידו! תראה אותך. אותו עידו.'],
  ['עידו', 'אותו עידו, עם תיק חדש. תרגיש כמה הוא שוקל.'],
  ['נהוראי', 'מה יש שם, לבנים?'],
  ['עידו', 'שמונה רובי פיינטבול, אלף כדורים ושלוש תוכניות. אחת מהן טובה.'],
  ['נהוראי', 'איזו?'],
  ['עידו', 'נגלה במכון. סע.'],
];
const ROAD = [
  ['עידו', 'הרנו עדיין חיה. יפה. זה אומר שתוכנית ב׳ אפשרית.'],
  ['נהוראי', 'מה תוכנית ב׳?'],
  ['עידו', 'שיוצאים מהר. תוכנית א׳ זה שלא צריך.'],
];
const PLAN = [
  ['ארז', 'עידו! בן אדם! תגיד שהבאת במבה.'],
  ['עידו', 'הבאתי משהו טוב יותר. תיק.'],
  ['יונתי', 'אם יש שם מצלמה, אני לוקח את הצד שלי.'],
  ['עידו', 'תקשיבו. קוצי פתח בנק עם הכסף של כולנו. אנחנו לוקחים אותו בחזרה. בלילה. בשקט. ובצבע.'],
  ['הדר', 'Bro, צבע?'],
  ['עידו', 'פיינטבול. החוקים שלהם: מי שמסומן, בחוץ. הם שומרים עם רובים כאלה, אנחנו נכנסים עם רובים כאלה. בלי דם. אף אחד לא נפצע.'],
  ['אברהם', 'ואני? אני מדבר?'],
  ['עידו', 'אתה מדבר. בדלת הקדמית, עם ארז. תחזיק את קוצי בשיחה כמה שיותר זמן.'],
  ['עידו', 'יונתי על הגג, מצלם ושומר. מולר ודולב ליד הרנו עם התיקים. נהוראי, הדר ואני נכנסים מאחור, דרך הפריקה.'],
  ['מולר', 'תיקים.'],
  ['דולב', 'אני ליד הרכב? יש בזה היגיון. אני לא זז.'],
  ['עידו', 'נהוראי, קודם תלמד לירות. חמש מטרות בחניה. ואז יש לנו לילה.'],
];
const TRAIN = [['עידו', 'הכוונת ננעלת לבד על מה שמולך. לוחצים ירי. שמונה כדורים, ואז טעינה. פשוט.']];
const END = [
  ['עידו', 'חמש מחמש. אח יקר, אתה מוכן. הלילה, בשתיים.'],
  ['נהוראי', 'בשתיים? מי ער בשתיים?'],
  ['עידו', 'קוצי לא. בגלל זה.'],
];
const TARGETS = 5;

// where Ido waits: on the promenade, facing the city, the sea behind him
function callSpot(game) {
  const b = game.world.places.beach, x = b.x + 24, z = b.z + 6;
  return { x, z, y: game.world.groundHeight(x, z), yaw: Math.PI / 2 };
}

// a practice target: a plank on a stand with a porcupine silhouette painted on it (Yonati's work)
function makeTarget() {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const d = c.getContext('2d');
  d.fillStyle = '#d9d6cf'; d.fillRect(0, 0, 128, 192);
  d.fillStyle = '#2f4a3a';
  d.beginPath(); d.ellipse(64, 120, 38, 50, 0, 0, Math.PI * 2); d.fill();
  d.beginPath(); d.arc(64, 52, 22, 0, Math.PI * 2); d.fill();
  d.strokeStyle = '#e9d27a'; d.lineWidth = 5; d.lineCap = 'round';
  for (let i = 0; i < 7; i++) { d.beginPath(); d.moveTo(34 + i * 10, 96); d.lineTo(28 + i * 10, 70 + (i % 2) * 8); d.stroke(); }
  d.strokeStyle = '#c8352d'; d.lineWidth = 3; d.beginPath(); d.arc(64, 118, 16, 0, Math.PI * 2); d.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.06), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#b9a688', roughness: 0.9 })),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: '#b9a688', roughness: 0.9 }),
  ]);
  plank.position.y = 1.25;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), new THREE.MeshStandardMaterial({ color: '#5d636b', roughness: 0.7 }));
  stand.position.y = 0.75;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: '#5d636b', roughness: 0.7 }));
  foot.position.y = 0.03;
  g.add(plank, stand, foot);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function placeTargets(m, game) {
  const L = game.world.places.gymLot, P = game.paint;
  m.targets = [];
  for (let i = 0; i < TARGETS; i++) {
    const p = L.at(-11 - i * 2.4, 4.4), t = makeTarget();
    t.position.set(p.x, L.y, p.z);
    t.rotation.y = Math.atan2(-L.along.nx, -L.along.nz); // facing the road, where Nehorai stands
    game.scene.add(t);
    const board = { pos: { x: p.x, y: L.y, z: p.z }, board: t, done: false, onHit: () => { t.rotation.x = -0.35; } };
    P.boards.push(board);
    m.targets.push(t);
  }
  m.s.landed0 = P.landed;
}

function clearTargets(m, game) {
  for (const t of m.targets || []) game.scene.remove(t);
  m.targets = [];
  game.paint.boards = [];
}

function endCall(game) {
  game.hud.endVideoCall();
  game.pip = null;
  game.follow.override = null;
}

export default {
  id: 'ido', chapter: 4, number: 1, title: 'עידו מצטרף',
  requires: ['mainevent'],
  incoming: true,
  where: 'ארז יתקשר עוד רגע',
  reward: { money: 150, unlocks: ['ido', 'ido-crew', 'paintball'], text: 'עידו הידנה בחבורה ובטלפון · רובי פיינטבול · 150 ₪ שארז הוציא מהקופה של המכון' },

  setup(m, game) {
    game.idoBuddy.held = true;
    const n = game.npc('ido');
    n.show(false);
  },

  prepareReplay(game) {
    const p = game.world.places.safeParking;
    game.exitCar();
    game.car.repair();
    game.car.place(p.x, p.z, p.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, p.yaw);
    game.idoBuddy.leave();
  },

  failIf(m, game) {
    if (m.stepIndex === 4 && game.car.disabled) return 'הרנו נפגעה יותר מדי. עידו אומר שתוכנית ב׳ דורשת רכב שנוסע.';
    return null;
  },

  restore(m, game, checkpoint) {
    endCall(game);
    game.hud.showCall(null);
    game.dialogue.stop();
    game.cutscene = false;
    game.car.repair();
    if (checkpoint === 4) { game.enterCar(); game.idoBuddy.join(); }
  },

  cleanup(m, game) {
    endCall(game);
    game.hud.showCall(null);
    game.cutscene = false;
    clearTargets(m, game);
    game.paint.disarmPlayer();
    if (m.bag) { m.bag.removeFromParent(); m.bag = null; }
    game.idoBuddy.held = false;
    game.hadarBuddy.held = false;
    game.companion.held = false;
    game.nehorai.setPose(null);
  },

  steps: [
    { // 0: Erez calls
      objective: 'ארז מתקשר. לענות',
      update(m, game) {
        if (!m.s.rang && m.t > 2.7) { m.s.rang = true; game.hud.showCall('ארז', () => { game.dialogue.play(EREZ).then(() => { m.s.talked = true; }); }); }
        return m.s.talked ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 1: out of the blue, a video call from Ido
      objective: 'שיחת וידאו נכנסת',
      enter(m, game) {
        const n = game.npc('ido'), p = callSpot(game);
        n.place(p.x, p.z, p.yaw);
        n.idle = null; n.target = null;
        n.model.setPose(null);
        n.show(true);
      },
      update(m, game) {
        if (!m.s.video && m.t > 2.2) {
          m.s.video = true;
          game.hud.showCall('עידו (וידאו)', () => {
            // the call: Ido fills the screen, the sea behind him; Nehorai in the small frame
            const n = game.npc('ido'), p = n.pos, me = game.player.pos, yaw = game.player.yaw;
            game.cutscene = true;
            game.exitCar();
            game.nehorai.setPose(null);
            n.model.play('wave');
            game.hud.videoCall('עידו הידנה');
            game.follow.shot({ x: p.x + Math.sin(n.yaw) * 0.82, y: p.y + 1.6, z: p.z + Math.cos(n.yaw) * 0.82 + 0.1 }, { x: p.x, y: p.y + 1.52, z: p.z }, 9999); // head and shoulders, as a phone holds you
            game.pip = {
              from: new THREE.Vector3(me.x + Math.sin(yaw) * 0.95, me.y + 1.6, me.z + Math.cos(yaw) * 0.95),
              look: new THREE.Vector3(me.x, me.y + 1.5, me.z),
              rect: () => game.hud.frameRect(),
            };
            game.dialogue.play(CALL).then(() => { m.s.videoDone = true; });
          });
        }
        return m.s.videoDone ? 'next' : null;
      },
      exit(m, game) {
        endCall(game);
        game.hud.showCall(null);
        game.cutscene = false;
        game.follow.snapBehind(game.player.yaw);
        game.npc('ido').idle = 'phone';
      },
    },
    { // 2: to the promenade
      objective: 'לאסוף את עידו בטיילת, מול הים', checkpoint: true,
      target: (m, game) => { const n = game.npc('ido'); return { x: n.pos.x, z: n.pos.z, y: n.pos.y, r: 2 }; },
      update(m, game) {
        const n = game.npc('ido');
        say(m, game, game.mode === 'car' && near(game.car.pos, n.pos, 40) ? 'לצאת מהרכב ולגשת לעידו' : 'לאסוף את עידו בטיילת, מול הים');
        return game.mode === 'foot' && near(game.player.pos, n.pos, 3.5) ? 'next' : null;
      },
    },
    { // 3: Ido
      objective: 'עידו חזר',
      enter(m, game) {
        const n = game.npc('ido'), p = game.player.pos;
        game.cutscene = true;
        n.idle = null;
        n.lookAt(p.x, p.z);
        n.model.play('wave');
        game.player.yaw = Math.atan2(n.pos.x - p.x, n.pos.z - p.z);
        twoShot(game, p, n.pos, { x: p.x - 30, z: p.z }, { dist: 3.4, height: 1.9 }); // from the city side, the sea behind them
        game.hud.banner('דמות חדשה', 'עידו הידנה', 'חזר אחרי הרבה זמן · גר בקציר · מתכנן', 3200);
        game.dialogue.play(MEET).then(() => { m.s.met = true; });
      },
      update: (m) => (m.s.met ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.idoBuddy.held = false;
        game.idoBuddy.join({ near: game.npc('ido').pos });
      },
    },
    { // 4: up to the gym
      objective: 'לנסוע למכון בקציר, עידו איתך', checkpoint: true,
      target: (m, game) => (game.mode === 'car' ? { ...game.world.places.gymParking, r: 4 } : { ...game.world.places.gymInside, r: 3 }),
      update(m, game) {
        if (!m.s.road && game.mode === 'car' && m.t > 6 && !game.dialogue.busy) { m.s.road = true; game.dialogue.play(ROAD); }
        say(m, game, game.mode === 'car' ? 'לנסוע למכון בקציר, עידו איתך' : 'להיכנס למכון');
        return game.mode === 'foot' && near(game.player.pos, game.world.places.gymInside, 3.8) ? 'next' : null;
      },
    },
    { // 5: the plan
      objective: 'התוכנית',
      enter(m, game) {
        const g = game.world.places.gym, ido = game.npc('ido');
        game.cutscene = true;
        game.idoBuddy.held = true;
        gymCrowd(game);
        // everyone in a half circle in the middle of the hall, Ido in front with his bag
        const spots = { ido: [1.6, 0.6, Math.PI + 0.3], hadar: [-0.4, 3.2, Math.PI - 0.4], dolev: [2.8, 3.4, Math.PI + 0.5], avraham: [4.4, 1.8, -Math.PI / 2 - 0.2] };
        for (const [id, [lx, lz, ry]] of Object.entries(spots)) {
          const n = game.npc(id), p = g.toWorld(lx, lz);
          if (n.inCar) n.stepOut(-1);
          n.place(p.x, p.z, g.yaw + ry);
          n.idle = null; n.target = null; n.face = null;
          n.model.setPose(null);
          n.show(true);
        }
        for (const id of ['erez', 'yonati', 'muller']) { const n = game.npc(id), p = g.toWorld(id === 'erez' ? -2.2 : id === 'yonati' ? -3.4 : 0.9, id === 'muller' ? 4.6 : 2.6); n.idle = null; n.walkTo(p.x, p.z, { onArrive: () => n.lookAt(ido.pos.x, ido.pos.z) }); }
        const me = g.toWorld(1.2, 3.0);
        game.player.place(me.x, me.z, g.yaw + Math.PI - 0.1);
        m.bag = makeMoneyBag();
        const bp = g.toWorld(1.6, 1.5);
        m.bag.position.set(bp.x, g.floorY, bp.z);
        game.scene.add(m.bag);
        const from = g.toWorld(-3.6, 5.2), look = g.toWorld(1.2, 1.6);
        game.follow.shot({ x: from.x, y: g.floorY + 2.3, z: from.z }, { x: look.x, y: g.floorY + 1.2, z: look.z }, 9999);
        game.dialogue.play(PLAN).then(() => { m.s.planned = true; });
      },
      update: (m) => (m.s.planned ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        if (m.bag) { m.bag.removeFromParent(); m.bag = null; }
        // the marker in Nehorai's hands, the targets up in the lot
        game.paint.armPlayer();
        placeTargets(m, game);
        const ido = game.npc('ido'), L = game.world.places.gymLot, q = L.at(-6, 1.6);
        ido.walkTo(q.x, q.z, { run: true, onArrive: () => { ido.lookAt(L.at(-14, 4.4).x, L.at(-14, 4.4).z); ido.idle = 'arms'; } });
        game.dialogue.play(TRAIN);
      },
    },
    { // 6: five targets
      objective: `אימון: לסמן חמש מטרות בחניה (0/${TARGETS})`,
      target(m, game) {
        const b = game.paint.boards.find((q) => !q.done);
        return b ? { x: b.pos.x, z: b.pos.z, y: b.pos.y, r: 1.2 } : null;
      },
      update(m, game) {
        const done = game.paint.boards.filter((b) => b.done).length;
        say(m, game, `אימון: לסמן חמש מטרות בחניה (${Math.min(done, TARGETS)}/${TARGETS}) · הכוונת ננעלת לבד, כפתור הירי מימין`);
        if (done >= TARGETS && !m.s.ended) { m.s.ended = true; game.dialogue.play(END).then(() => { m.s.over = true; }); }
        return m.s.over ? 'next' : null;
      },
      exit(m, game) {
        game.paint.disarmPlayer();
        clearTargets(m, game);
      },
    },
  ],

  complete(m, game) {
    game.idoBuddy.held = false;
    game.idoBuddy.join({ near: game.npc('ido').pos });
  },
};
