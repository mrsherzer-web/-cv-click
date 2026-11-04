// Chapter four, mission 2, "Kotzi's bank". Two in the morning: the crew drives down to the industrial
// zone, where Kotzi (invented for the game) keeps everyone's money in a "bank" of his own. Avraham and
// Erez talk at the front door, Yonati watches from the roof, Muller and Dolev wait by the Renault, and
// Nehorai, Ido and Hadar go in through the loading bay with paintball markers: by the rules the two
// crews play by, whoever is marked with paint is out and sits down, and so is Nehorai after three
// marks. The guards patrol and shoot paint back. Kotzi opens the vault himself once he is marked; the
// bags go into the Renault; his cars give chase; and at dawn, at the lookout, the money is counted and
// goes back to everyone it was taken from. No blood, no weapons that hurt, no real place, and nothing
// that shows how any real building is got into. The lines are written for the game and do not
// describe the real people.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { Chase } from '../vehicle/chaser.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { makeHatchback } from '../world/car.js';
import { OUT_AT } from '../combat/paint.js';
import { twoShot } from '../combat/bout.js';

const GUARDS = [['guard1', 'storage'], ['guard2', 'lobbyE'], ['roller', 'lobbyW'], ['guard3', 'office'], ['guard4', 'vault'], ['tosti', 'front']];
const CREW = ['erez', 'yonati', 'avraham', 'dolev', 'muller'];
const NIGHT = [
  ['עידו', 'שתיים בלילה. הרחובות ריקים, קוצי ישן, והשומרים שלו משועממים. מושלם.'],
  ['הדר', 'Bro, יש לי פרפרים בבטן.'],
  ['עידו', 'זה הפיינטבול. תנשום. ארז וכל השאר כבר שם, ברכב של ארז.'],
];
const ARRIVE = [
  ['עידו', 'הנה הבנק. השלט דולק. קוצי לא חוסך בחשמל של אחרים.'],
  ['ארז', 'כולנו פה. אברהם כבר מתחמם לדבר.'],
  ['אברהם', 'אני מוכן. יש לי שלוש שעות של דיבור בלי לנשום.'],
  ['יונתי', 'אני על הגג. אם מישהו יוצא, אני רואה. ומצלם.'],
  ['דולב', 'אני ליד הרכב. לא זז.'],
  ['מולר', 'תיקים.'],
  ['עידו', 'נהוראי, הדר, איתי. מאחור, דרך הפריקה. שומר שמסומן, בחוץ. סימנו אותך שלוש פעמים, גם אתה בחוץ. ככה החוקים.'],
  ['הדר', 'ואם רואים אותנו?'],
  ['עידו', 'אז יורים ראשונים. בצבע.'],
];
const SPOTTED = [['שומר', 'היי! מי זה שם?! יש לנו אורחים!']];
const CLEARED = [['עידו', 'כולם מסומנים. יפה, אח יקר. עכשיו הכספת, בחדר המערבי.']];
const VAULT = [
  ['קוצי', 'אברהם, למה אתה מדבר כל כך הרבה? מה קורה פה?... רגע. למה כולם יושבים?'],
  ['עידו', 'החוקים שלך, קוצי. מי שמסומן, בחוץ. כולם מסומנים.'],
  ['קוצי', 'אתה... מי אתה בכלל?'],
  ['עידו', 'עידו. חזרתי. ואתה פתחת בנק עם הכסף של החברים שלי.'],
  ['קוצי', 'זה לא בנק, זה... חיסכון! אני שומר להם!'],
  ['נהוראי', 'אז עכשיו אנחנו שומרים. תפתח.'],
  ['קוצי', 'ואם לא?'],
  ['עידו', 'מסומן. בחוץ. המפתח.'],
  ['קוצי', '...על הצוואר. ואל תיקחו את המדבקה של ארז, היא שלי עכשיו.'],
  ['ארז', 'היא לא.'],
];
const LOADED = [['עידו', 'שלושה תיקים ברנו. עכשיו תוכנית ב׳: יוצאים מהר.']];
const CHASE = [['הדר', 'יש לנו חברים מאחורה! הירוקה של הדרבנים, ועוד שתיים!'], ['עידו', 'תאבד אותם. הם לא מכירים את הדרך לקציר כמוך.']];
const LOST = [['עידו', 'איבדנו אותם. הביתה. לתצפית. יש לי משהו להגיד לכולם כשהבוקר עולה.']];
const DAWN = [
  ['עידו', 'ספרתי. ארבעים ושמונה אלף ושלוש מאות. שקל שקל, מכולם.'],
  ['ארז', 'אז... מה עושים עם זה?'],
  ['עידו', 'מחזירים. לכל מי שקוצי לקח ממנו. עד השקל.'],
  ['יונתי', 'זה הכי פחות ויראלי ששמעתי בחיים שלי. ואני בעד.'],
  ['אברהם', 'אני רוצה שיירשם: גם הלילה דיברתי. שלוש שעות.'],
  ['דולב', 'לא זזתי. גם זה נחשב.'],
  ['מולר', 'נחשב.'],
  ['הדר', 'Bro. ניו יורק אף פעם לא הייתה ככה.'],
  ['נהוראי', 'ומה נשאר לנו?'],
  ['עידו', 'ערב פיצה על חשבון הבנק. והחבורה. זה מה שנשאר.'],
  ['נהוראי', 'אח יקר. ברוך הבא הביתה.'],
];
const MARKED_OUT = 'סומנת שלוש פעמים. לפי החוקים, אתה בחוץ. בפעם הבאה: לסמן אותם לפני שהם מסמנים אותך, ולהישאר מחוץ לקונוס הצהוב שלהם.';

const bank = (game) => game.world.places.bank;

function endChase(m, game) { m.chase?.dispose(); m.chase = null; game.chase = null; game.alert.chasing = false; }

// the guards on their rounds, fresh
function postGuards(m, game) {
  const B = bank(game), P = game.paint;
  for (const [id, route] of GUARDS) {
    const n = game.npc(id), pts = B.patrols[route];
    n.place(pts[0].x, pts[0].z, 0);
    n.show(true);
    if (!P.guards.some((g) => g.npc === n)) P.addGuard(n, pts);
  }
  P.reset();
}

// Nehorai, Ido and Hadar armed, at the bay
function armUp(m, game) {
  const P = game.paint, B = bank(game);
  P.armPlayer();
  for (const id of ['ido', 'hadar']) { const n = game.npc(id); if (n.inCar) n.stepOut(-1); n.show(true); P.addAlly(n); }
  game.idoBuddy.held = false; game.hadarBuddy.held = false;
  if (!game.idoBuddy.active) game.idoBuddy.join({ near: B.bay });
  if (!game.hadarBuddy.active) game.hadarBuddy.join({ near: B.bay });
}

// the rest of the crew: by Erez's car behind the bank, Avraham and Erez off to the front
function crewAtTheBank(game) {
  const B = bank(game), base = B.yard;
  const spots = { yonati: [-3, -2.5], dolev: [3.2, 1.5], muller: [4.4, -0.5], avraham: [-4.5, 1.5], erez: [-6, 0] };
  for (const id of CREW) {
    const n = game.npc(id), [dx, dz] = spots[id];
    if (n.inCar) n.stepOut(-1);
    n.place(base.x + dx, base.z + dz, Math.atan2(B.bay.x - (base.x + dx), B.bay.z - (base.z + dz)));
    n.idle = null; n.target = null; n.face = null;
    n.model.setPose(null);
    n.show(true);
  }
  game.companion.held = true;
}

// a bag in someone's arms
function giveBag(game, model, bag) {
  bag.removeFromParent();
  bag.position.set(0, 0.55, 0.38);
  bag.rotation.set(0, 0, 0);
  model.root.add(bag);
  model.setPose('carry');
}

export default {
  id: 'bank', chapter: 4, number: 2, title: 'בנק קוצי',
  requires: ['ido'],
  where: 'לסימון הכחול ליד הרנו (או להיכנס אליה). יוצאים בלילה',
  startAt: (game) => (game.mode === 'car' ? null : { ...game.car.local(1.6, 0.3), y: game.car.pos.y }),
  startInCar: true,
  reward: { money: 500, unlocks: ['chapter-4'], text: 'סוף הפרק הרביעי · הכסף חזר לכולם · 500 ₪: מה שקוצי לקח מנהוראי, בחזרה · ערב פיצה על חשבון הבנק' },

  setup(m, game) {
    game.idoBuddy.held = false; game.hadarBuddy.held = false;
    if (!game.idoBuddy.active) game.idoBuddy.join();
    if (!game.hadarBuddy.active) game.hadarBuddy.join();
    if (game.companion.active) game.companion.leave();
    const B = bank(game);
    B.setVault(false);
    for (const [bag, i] of B.bags.map((b, i) => [b, i])) { bag.removeFromParent(); game.scene.add(bag); const [x, z] = [[-14.4, -11.4], [-12.5, -11.9], [-13.4, -10.3]][i]; const w = B.toWorld(x, z); bag.position.set(w.x, B.y, w.z); bag.rotation.set(0, 0, 0); }
    // Erez's car, waiting behind the bank
    m.erezCar = new Vehicle(game.world, makeHatchback({ color: '#55595f' }), { name: 'erez' });
    game.scene.add(m.erezCar.model);
    m.erezCar.place(B.yard.x - 5.5, B.yard.z + 1, B.yard.yaw, game.world.groundHeight(B.yard.x - 5.5, B.yard.z + 1) + 0.05);
    m.erezCar.model.updateMatrixWorld(true);
  },

  prepareReplay(game) {
    const P = game.world.places, spot = P.gymParking;
    game.exitCar();
    game.car.repair();
    game.car.place(spot.x, spot.z, spot.yaw);
    const q = game.car.local(1.8, 0.3);
    game.start(q.x, q.z, spot.yaw);
    game.idoBuddy.join();
    game.hadarBuddy.join();
  },

  failIf(m, game) {
    if ([1, 7, 8].includes(m.stepIndex) && game.car.disabled) return 'הרנו נפגעה יותר מדי. עידו: "תוכנית ב׳ דורשת רכב. יש לנו רק תוכנית ב׳."';
    if (m.stepIndex === 3 && game.paint.hits >= OUT_AT) return MARKED_OUT;
    return null;
  },

  restore(m, game, checkpoint) {
    const B = bank(game);
    endChase(m, game);
    game.dialogue.stop();
    game.cutscene = false;
    game.follow.override = null;
    game.car.repair();
    if (checkpoint === 1) { game.enterCar(); game.idoBuddy.join(); game.hadarBuddy.join(); }
    if (checkpoint === 3) {
      game.exitCar();
      game.car.place(B.yard.x, B.yard.z, B.yard.yaw);
      game.player.place(B.bay.x, B.bay.z, B.bay.yaw);
      game.follow.snapBehind(B.bay.yaw);
      postGuards(m, game);
      armUp(m, game);
      m.s = { ...m.s, spotted: false };
    }
    if (checkpoint === 7) {
      game.exitCar();
      game.car.place(B.yard.x, B.yard.z, B.yard.yaw);
      game.enterCar();
      game.idoBuddy.join(); game.hadarBuddy.join();
    }
  },

  cleanup(m, game) {
    const B = bank(game);
    endChase(m, game);
    game.paint.dispose();
    game.cutscene = false;
    game.follow.override = null;
    game.hud.setBout(null);
    game.nehorai.setPose(null);
    for (const [id] of GUARDS) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
    game.npc('kotzi').model.setPose(null);
    for (const bag of B.bags) { bag.removeFromParent(); game.scene.add(bag); }
    B.setVault(false);
    if (m.erezCar) { game.scene.remove(m.erezCar.model); game.world.cols.dynamic.delete(m.erezCar.box); m.erezCar = null; }
    game.idoBuddy.held = false; game.hadarBuddy.held = false; game.companion.held = false;
    for (const id of CREW) { const n = game.npc(id); if (n.model.pose === 'carry') n.model.setPose(null); }
    if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3); // day comes back whenever it ends
    game.populate({ walk: true });
  },

  steps: [
    { // 0: that night, in the Renault
      objective: 'להיכנס לרנו, עידו והדר איתך',
      target: (m, game) => (game.mode === 'car' ? null : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        const both = game.npc('ido').inCar && game.npc('hadar').inCar;
        if (game.mode === 'car' && !m.s.night) {
          m.s.night = true;
          game.hud.fade('באותו לילה · 01:50', () => { game.daylight?.set(1, 0); for (const id of ['ido', 'hadar']) { const n = game.npc(id); if (!n.inCar) n.enter(game.car); } }, 1500);
        }
        if (m.s.night && !m.s.said && !game.hud.fading) { m.s.said = true; game.dialogue.play(NIGHT); }
        say(m, game, game.mode === 'car' ? 'לחכות שעידו והדר ייכנסו' : 'להיכנס לרנו, עידו והדר איתך');
        return game.mode === 'car' && both && m.s.said ? 'next' : null;
      },
    },
    { // 1: down to the bank
      objective: 'לנסוע לבנק קוצי באזור התעשייה בחדרה, לחצר שמאחור', checkpoint: true,
      enter(m, game) { if (!m.s.night) { m.s.night = true; game.daylight?.set(1, 0); } },
      target: (m, game) => ({ ...bank(game).yard, y: bank(game).y, r: 4 }),
      update(m, game) {
        const B = bank(game);
        say(m, game, game.mode === 'car' ? 'לנסוע לבנק קוצי באזור התעשייה בחדרה, לחצר שמאחור' : 'להיכנס לרנו ולנסוע לבנק קוצי');
        return game.mode === 'car' && near(game.car.pos, B.yard, 7) && Math.abs(game.car.speed) < 1.5 ? 'next' : null;
      },
    },
    { // 2: everyone behind the bank
      objective: 'החבורה מאחורי הבנק',
      enter(m, game) {
        const B = bank(game);
        game.cutscene = true;
        game.exitCar();
        crewAtTheBank(game);
        for (const id of ['ido', 'hadar']) { const n = game.npc(id); if (n.inCar) n.stepOut(id === 'ido' ? 1 : -1); n.show(true); }
        game.idoBuddy.held = true; game.hadarBuddy.held = true;
        const me = game.player.pos;
        game.follow.shot({ x: B.yard.x + 7, y: B.y + 3.2, z: B.yard.z + 6 }, { x: B.yard.x - 1, y: B.y + 1.2, z: B.yard.z - 2 }, 9999);
        game.player.yaw = Math.atan2(B.bay.x - me.x, B.bay.z - me.z);
        game.hud.banner('בנק קוצי', '02:00', 'הכניסה מאחור · צבע, לא דם', 3000);
        game.dialogue.play(ARRIVE).then(() => { m.s.briefed = true; });
      },
      update: (m) => (m.s.briefed ? 'next' : null),
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        // Avraham and Erez round to the front, Yonati up (out of sight), the markers out
        const B = bank(game);
        for (const id of ['avraham', 'erez']) game.npc(id).walkTo(B.front.x + (id === 'erez' ? -1.5 : 1.5), B.front.z + 1, { run: true });
        game.npc('yonati').show(false);
        postGuards(m, game);
        armUp(m, game);
      },
    },
    { // 3: through the bay, marking the guards
      objective: `לסמן את ששת השומרים בצבע (0/6) · סומנת 0/${OUT_AT}`, checkpoint: true,
      enter(m, game) {
        const P = game.paint;
        m.s.spotted = false;
        P.onSpot = () => { if (!m.s.spotted) { m.s.spotted = true; game.dialogue.play(SPOTTED); game.alert.raise(30); } };
        P.onMarked = () => game.alert.raise(6);
      },
      target(m, game) {
        const P = game.paint, B = bank(game), me = game.player.pos;
        if (!B.inside(me.x, me.z)) return { ...B.bayInside, y: B.y, r: 1.5 };
        let best = null, bd = Infinity;
        for (const g of P.standing) { const d = Math.hypot(g.npc.pos.x - me.x, g.npc.pos.z - me.z); if (d < bd) { bd = d; best = g; } }
        return best ? { x: best.npc.pos.x, z: best.npc.pos.z, y: best.npc.pos.y, r: 1 } : null;
      },
      update(m, game) {
        const P = game.paint, B = bank(game), me = game.player.pos;
        const inside = B.inside(me.x, me.z);
        say(m, game, `${inside ? 'לסמן את ששת השומרים בצבע' : 'להיכנס דרך הפריקה מאחור, ולסמן את ששת השומרים'} (${P.marked}/${GUARDS.length}) · סומנת ${P.hits}/${OUT_AT}`);
        if (P.marked >= GUARDS.length && !m.s.cleared) { m.s.cleared = true; game.dialogue.play(CLEARED).then(() => { m.s.go = true; }); }
        return m.s.go ? 'next' : null;
      },
      exit(m, game) { game.paint.onSpot = null; game.paint.onMarked = null; },
    },
    { // 4: to the vault room
      objective: 'לכספת, בחדר המערבי',
      target: (m, game) => ({ ...bank(game).vaultFront, y: bank(game).y, r: 1.6 }),
      update: (m, game) => (near(game.player.pos, bank(game).vaultFront, 2.4) ? 'next' : null),
    },
    { // 5: Kotzi, and the key
      objective: 'קוצי',
      enter(m, game) {
        const B = bank(game), k = game.npc('kotzi'), av = game.npc('avraham'), er = game.npc('erez'), ido = game.npc('ido'), vf = B.vaultFront;
        game.cutscene = true;
        game.idoBuddy.held = true; game.hadarBuddy.held = true;
        game.paint.disarmPlayer();
        game.player.place(vf.x + 1.4, vf.z + 0.6, -Math.PI / 2);
        ido.place(vf.x - 1.2, vf.z + 0.9, -Math.PI / 2);
        ido.idle = null; ido.target = null; ido.model.setPose(null);
        const h = game.npc('hadar'); h.place(vf.x + 0.6, vf.z + 2.2, Math.PI); h.idle = null; h.target = null; h.model.setPose(null);
        // Kotzi in from the lobby with Avraham talking, Erez behind them
        const door = B.toWorld(-6, -2);
        for (const [n, off, ry] of [[k, 0, Math.PI / 2], [av, 1.6, Math.PI / 2], [er, 3.0, Math.PI / 2]]) {
          n.place(door.x + 3 + off, door.z, ry);
          n.idle = null; n.target = null; n.face = null;
          n.model.setPose(null);
          n.show(true);
          n.walkTo(vf.x - 3.4 + off * 0.5, vf.z + 2.4 + off * 0.9, { near: 0.5, onArrive: () => n.lookAt(game.player.pos.x, game.player.pos.z) });
        }
        game.follow.shot({ x: vf.x + 3.8, y: B.y + 2.4, z: vf.z + 4.2 }, { x: vf.x - 1, y: B.y + 1.2, z: vf.z + 0.5 }, 9999);
        game.dialogue.play(VAULT).then(() => { m.s.opened = true; });
      },
      update(m, game) {
        // Ido's pellet lands on Kotzi as he asks "and if not?", and the door swings open on the last line
        const said = game.dialogue.said - (m.s.said0 ?? (m.s.said0 = game.dialogue.said));
        if (said >= 8 && !m.s.shot) {
          m.s.shot = true;
          const ido = game.npc('ido'), k = game.npc('kotzi'), P = game.paint;
          const from = new THREE.Vector3(ido.pos.x + Math.sin(ido.yaw) * 0.45, ido.pos.y + 1.32, ido.pos.z + Math.cos(ido.yaw) * 0.45);
          P.pellet(from, new THREE.Vector3(k.pos.x, k.pos.y + 1.1, k.pos.z), ido, { color: '#36c3ff', targets: [{ pos: k.pos, yaw: k.yaw, model: k.model }] });
          k.model.play('hit');
          game.sound?.splat();
        }
        if (said >= 9 && !m.s.vault) { m.s.vault = true; bank(game).setVault(true); game.sound?.bell(1); }
        return m.s.opened ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        const B = bank(game);
        for (const id of ['kotzi', 'avraham', 'erez']) game.npc(id).lookAt(B.cell.x, B.cell.z);
        game.npc('kotzi').model.setPose('arms_crossed');
      },
    },
    { // 6: the bags, into the Renault
      objective: 'לקחת תיק מהכספת ולהעמיס לרנו · עידו והדר לוקחים את השניים האחרים',
      enter(m, game) { bank(game).setVault(true); m.s.bags = 0; },
      target(m, game) {
        const B = bank(game);
        if (!m.s.carrying) return { ...B.cell, y: B.y, r: 1.2 };
        return { ...game.car.pos, r: 2.6 };
      },
      interaction(m, game) {
        const B = bank(game), me = game.player.pos;
        if (game.mode !== 'foot') return null;
        if (!m.s.carrying && near(me, B.cell, 2.2)) {
          return { label: 'לקחת תיק', priority: 5, run: () => {
            m.s.carrying = true;
            giveBag(game, game.nehorai, B.bags[0]);
            giveBag(game, game.npc('ido').model, B.bags[1]);
            giveBag(game, game.npc('hadar').model, B.bags[2]);
            game.idoBuddy.held = false; game.hadarBuddy.held = false;
            game.controls.setRun(false);
            say(m, game, 'להעמיס את התיקים לרנו, בחצר מאחור');
          } };
        }
        if (m.s.carrying && game.car.doorDistance(me.x, me.z) < 2.4) {
          return { label: 'להעמיס את התיקים', priority: 5, run: () => {
            m.s.loaded = true;
            for (const [who, bag] of [[game.nehorai, B.bags[0]], [game.npc('ido').model, B.bags[1]], [game.npc('hadar').model, B.bags[2]]]) { bag.removeFromParent(); who.setPose(null); }
            game.dialogue.play(LOADED);
          } };
        }
        return null;
      },
      update(m, game) {
        if (m.s.carrying && !m.s.loaded) {
          game.controls.setRun(false);
          if (game.nehorai.pose !== 'carry') game.nehorai.setPose('carry');
          for (const id of ['ido', 'hadar']) { const n = game.npc(id); if (n.model.pose !== 'carry') n.model.setPose('carry'); }
        }
        return m.s.loaded ? 'next' : null;
      },
    },
    { // 7: out of the city, with Kotzi's cars behind (the arrow points home, the way out)
      objective: 'להיכנס לרנו ולצאת מחדרה. הם אחריכם', checkpoint: true,
      target: (m, game) => (game.mode === 'car' ? { ...game.world.places.lookout, r: 6 } : { ...game.car.pos, r: 2.4 }),
      update(m, game) {
        if (game.mode !== 'car') { say(m, game, 'להיכנס לרנו, מהר'); return null; }
        if (!m.chase && m.t > 1) {
          m.chase = new Chase(game, { cars: 3, after: 20, colors: ['#2f5d3a', '#1b2a4a', '#2f5d3a'] });
          game.chase = m.chase;
          game.dialogue.play(CHASE);
        }
        if (m.chase) say(m, game, `לאבד את המכוניות של קוצי · הכי קרוב: ${Math.round(Math.min(999, m.chase.nearest))} מ׳`);
        if (m.chase?.over && m.chase.escaped) { game.dialogue.play(LOST); endChase(m, game); return 'next'; }
        return null;
      },
    },
    { // 8: home, to the lookout
      objective: 'הביתה: לתצפית בקציר, לפני שהבוקר עולה',
      enter(m, game) { game.alert.level = 0; },
      target: (m, game) => ({ ...game.world.places.lookout, r: 6 }),
      update(m, game) {
        say(m, game, game.mode === 'car' ? 'הביתה: לתצפית בקציר, לפני שהבוקר עולה' : 'להיכנס לרנו ולנסוע לתצפית בקציר');
        const L = game.world.places.lookout;
        return near(game.pos, L, 11) && (game.mode === 'foot' || Math.abs(game.car.speed) < 1.5) ? 'next' : null;
      },
    },
    { // 9: dawn
      objective: 'הבוקר עולה',
      enter(m, game) {
        const W = game.world.places, L = W.lookout, pl = W.plaza, B = bank(game);
        game.cutscene = true;
        game.exitCar();
        game.idoBuddy.held = true; game.hadarBuddy.held = true; game.companion.held = true;
        // everyone along the railing, looking out over the plain; Ido in the middle with the bags at his feet
        const order = ['muller', 'dolev', 'hadar', 'ido', 'nehorai', 'avraham', 'erez', 'yonati'];
        const side = { x: -pl.dz, z: pl.dx };
        order.forEach((id, i) => {
          const off = (i - 3.5) * 1.3, x = L.x + pl.dx * 6 + side.x * off, z = L.z + pl.dz * 6 + side.z * off, yaw = Math.atan2(pl.dx, pl.dz);
          if (id === 'nehorai') { game.player.place(x, z, yaw); return; }
          const n = game.npc(id);
          if (n.inCar) n.stepOut(-1);
          n.place(x, z, yaw);
          n.idle = null; n.target = null; n.face = null;
          n.model.setPose(null);
          n.show(true);
        });
        const ido = game.npc('ido');
        B.bags.forEach((bag, i) => { bag.removeFromParent(); game.scene.add(bag); bag.position.set(ido.pos.x + side.x * (i - 1) * 0.5, L.y, ido.pos.z + side.z * (i - 1) * 0.5 - pl.dz * 0.6); });
        game.follow.shot({ x: L.x + pl.dx * 9.5, y: L.y + 2.6, z: L.z + pl.dz * 9.5 }, { x: L.x + pl.dx * 6, y: L.y + 1.3, z: L.z + pl.dz * 6 }, 9999);
        game.daylight?.set(0, 45); // the night lifts as they talk
        game.dialogue.play(DAWN).then(() => { m.s.done = true; });
      },
      update(m, game) {
        if (m.s.done && !m.s.closing) { m.s.closing = true; game.hud.fade('סוף הפרק הרביעי', () => { m.s.closed = true; }, 1700); }
        return m.s.closed ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
        game.daylight?.set(0, 1.5);
        for (const bag of bank(game).bags) bag.removeFromParent();
      },
    },
  ],

  complete(m, game) {
    game.idoBuddy.held = false;
    game.hadarBuddy.held = false;
    game.idoBuddy.join({ near: game.npc('ido').pos });
  },
};
