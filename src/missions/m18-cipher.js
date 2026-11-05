// Chapter six, "הצופן". A rival invented for the game — "the Cipher" — sold half of Katzir fake
// tickets, Dolev among them. Erez brings the lead to Nehorai's computer, where the two trace the
// Cipher's server in a game on the screen (a memory game and nothing more: no real technique is shown
// or implied). The trace points at the container yard at the south end of Hadera's beach — and then
// Dolev's call is cut off mid-sentence: the Cipher's people have taken him, and a message says to
// come alone. Nehorai and Erez drive down with the Cipher's cars on their tail, fight through the
// yard with paint (whoever is marked is out, as ever), find Dolev in the office container, mark the
// Cipher, take his laptop, and get out with his crew behind them — to the ice-cream stand by the
// Gan Shmuel gate, where the night ends over three cones. The lines are written for the game and do
// not describe the real people.
import { near, say } from './missions.js';
import { Pursuit } from './pursuit.js';
import { OUT_AT } from '../combat/paint.js';

const CALL = [
  ['ארז', 'נהוראי. יש לנו בעיה חדשה. אחד שקורא לעצמו "הצופן".', 'phone'],
  ['נהוראי', 'הצופן?'],
  ['ארז', 'מכר לחצי קציר כרטיסים מזויפים למשחק. גם לדולב. שילמו, הגיעו, אין כרטיס.', 'phone'],
  ['ארז', 'יש לי את האתר שלו. אני צריך מחשב ואת הראש שלך. אני בדרך אליך.', 'phone'],
  ['נהוראי', 'המחשב בסלון. בוא.'],
];
const AT_PC = [['ארז', 'הנה. זה משחק זיכרון, לא יותר: הוא מסתיר את השרת מאחורי נתיב של תחנות. רואים את הנתיב פעם אחת, וחוזרים עליו.'], ['ארז', 'ויש לו איתור נגדי. אם הפס מתמלא, הוא רואה אותנו. בלי טעויות.']];
const ROUND = [['ארז', 'יפה. עוד שניים.'], ['ארז', 'הוא מהיר יותר עכשיו. תתרכז.'], ['ארז', 'זהו. יש לנו אותו.']];
const FOUND = [['ארז', 'מגרש המכולות. בקצה הדרומי של החוף בחדרה. הוא יושב שם.'], ['נהוראי', 'אז נוסעים.']];
const DOLEV = [
  ['דולב', 'נהוראי! אני ליד הקיוסק בחדרה, שמע, הכרטיס הזה...', 'phone'],
  ['דולב', 'רגע. מי אתם? ...היי! עזבו את ה—', 'phone'],
];
const CUT = [['ארז', 'דולב? דולב!'], ['נהוראי', 'השיחה נותקה.']];
const MESSAGE = [['הצופן', 'הודעה על המסך: "רוצים את דולב? מגרש המכולות, חוף חדרה. ובואו לבד."'], ['ארז', 'לבד? לא בחיים. יש לנו צבע.'], ['נהוראי', 'ויש לנו את דולב להחזיר. סע.']];
const ROAD = {
  start: [['ארז', 'סע, סע! הם עוד לא ראו לאן פנינו. יש לנו כמה שניות.']],
  arrive: [[['ארז', 'הנה הם. השחורה מאחור, זאת של הצופן.'], ['נהוראי', 'שינסו.']], [['ארז', 'ועוד אחת, הכחולה. הוא שלח את כולם.']]],
  close: [['ארז', 'הם צמודים! ימינה, ימינה!'], ['ארז', 'אל תיתן להם לעקוף!'], ['ארז', 'הם מנסים לדחוף אותנו. תחזיק את ההגה.']],
  hit: [['ארז', 'אוף! הרנו ספגה. תתרחק מהם.'], ['ארז', 'מכה! ארבע עיניים על הכביש.']],
  lost: [['ארז', 'איבדנו אותם. יפה. עכשיו לחוף, לפני שהם מבינים.']],
};
const ESCAPE = {
  start: [['דולב', 'הם מתניעים! סע, סע!'], ['ארז', 'ישר לכביש, ואז צפונה. יש לנו כמה שניות.']],
  arrive: [[['דולב', 'שלושה פנסים מאחור. זה הם.']], [['ארז', 'עוד אחד הצטרף. אל תעצור.']], [['דולב', 'ושלישי! הצופן באמת לא אהב את המחשב הנייד.']]],
  close: [['דולב', 'הוא עלינו! גז, גז!'], ['ארז', 'שמאלה בצומת, הם לא יספיקו.'], ['דולב', 'אני רואה את הפרצוף שלו במראה!']],
  hit: [['דולב', 'איי! הרנו!'], ['ארז', 'מכה. תתרחק מהם.']],
};
const ARRIVE = [['ארז', 'הנה המגרש. שומרים בין המכולות, והמכולה המוארת באמצע. דולב שם.'], ['ארז', 'אותם חוקים כמו תמיד: צבע. מי שמסומן, בחוץ. סימנו אותך שלוש פעמים, גם אתה.']];
const SPOTTED = [['שומר', 'הם פה! הצופן, הם פה!']];
const CLEARED = [['ארז', 'המגרש נקי. המכולה.']];
const CIPHER = [
  ['הצופן', 'הגעתם מהר. חשבתי שהמשחק שלי יעכב אתכם.'],
  ['נהוראי', 'משחק זיכרון. ארז זוכר הכול.'],
  ['הצופן', 'הכרטיסים... זה היה רק עסק. ואתם, עם הצבע הזה.'],
  ['ארז', 'מסומן. בחוץ. והמחשב הנייד שלך בא איתנו: כל מי ששילם מקבל בחזרה.'],
];
const FREE = [['דולב', 'נהוראי! ארז! לקח לכם שעה. ישבתי פה בלי טלפון.'], ['נהוראי', 'אתה בסדר?'], ['דולב', 'בסדר ורעב. חטפו אותי לפני הפלאפל.']];
const OUT = [['ארז', 'יש לו עוד אנשים בחוץ, ברכבים. לרנו, עכשיו!'], ['דולב', 'אני לא זז לבד. אני בא.']];
ESCAPE.lost = [['דולב', 'איבדנו אותם. ועכשיו, ברצינות: אני רעב.'], ['ארז', 'גלידה. בגן שמואל. על חשבון הצופן.']];
const ICE = [
  ['דולב', 'פיסטוק ושוקולד. ואל תשאלו למה.'],
  ['ארז', 'וניל. אחד. אני באמצע תוכנית.'],
  ['נהוראי', 'לימון. ושלושת הכדורים על חשבון המחשב הנייד.'],
  ['דולב', 'חטפו אותי ואני עדיין רעב. זה אומר משהו על החיים.'],
  ['ארז', 'זה אומר שאתה דולב.'],
];
const END = [['נהוראי', 'כל מי ששילם לצופן מקבל בחזרה מחר. ועד אז: גלידה.'], ['דולב', 'לחיי זה.']];
const TRACED = 'הצופן איתר אתכם. ארז: "הפס התמלא. מתחילים מההתחלה, ובלי טעויות הפעם."';
const MARKED_OUT = 'סומנת שלוש פעמים. לפי החוקים, אתה בחוץ. בפעם הבאה: המכולות הן מחסה — לסמן אותם מהצד ולא מהמעבר הפתוח.';

const GUARDS = [['guard1', 'lane1'], ['guard2', 'lane2'], ['guard3', 'north'], ['guard4', 'mid'], ['vg1', 'south'], ['vg2', 'west'], ['vg3', 'east'], ['vg4', 'door']];
const yard = (game) => game.world.places.yard;
const home = (game) => game.world.places.home?.interior;
const stand = (game) => game.world.places.icecream;

function endChase(m, game) { m.pursuit?.dispose(); m.pursuit = null; game.chase = null; game.alert.chasing = false; }
function postGuards(game) {
  const Yd = yard(game), P = game.paint;
  for (const [id, route] of GUARDS) {
    const n = game.npc(id), pts = Yd.patrols[route];
    n.floorY = null; n.place(pts[0].x, pts[0].z, 0); n.show(true);
    if (!P.guards.some((g) => g.npc === n)) P.addGuard(n, pts, undefined, { quick: true });
  }
  // the Cipher behind his table, Dolev on the chair
  const c = game.npc('cipher'), o = Yd.office;
  c.place(o.cipher.x, o.cipher.z, o.cipher.yaw); c.idle = 'arms'; c.target = null; c.model.setPose(null); c.show(true);
  const d = game.npc('dolev');
  d.place(o.dolev.x, o.dolev.z, o.dolev.yaw); d.idle = null; d.target = null; d.model.setPose('sit'); d.show(true);
  P.reset();
}
function armUp(game) {
  const P = game.paint;
  P.armPlayer();
  const e = game.npc('erez'); if (e.inCar) e.stepOut(-1); e.show(true);
  if (!P.allies.some((a) => a.npc === e)) P.addAlly(e);
  game.erezBuddy.held = false;
  if (!game.erezBuddy.active) game.erezBuddy.join({ near: yard(game).gate });
}
const guardsLeft = (game) => game.paint.guards.filter((g) => GUARDS.some(([id]) => game.npc(id) === g.npc) && !g.marked).length;

export default {
  id: 'cipher', chapter: 6, number: 1, title: 'הצופן', requires: ['villa'],
  incoming: true,
  where: 'ארז יתקשר עוד רגע',
  reward: { money: 900, unlocks: ['chapter-6', 'cipher-laptop'], text: 'סוף הפרק השישי · הכרטיסים חוזרים לכולם · 900 ₪ · גלידה בגן שמואל' },

  setup(m, game) {
    m.s = {};
    game.daylight?.set(1, 0);
    for (const b of ['idoBuddy', 'hadarBuddy', 'liamBuddy']) { if (game[b].active) game[b].leave(); game[b].held = true; }
    if (game.companion.active) game.companion.leave();
    game.companion.held = true; game.erezBuddy.held = true;
    game.radio?.stopAmbient();
    for (const n of game.pubCrowd || []) n.show(false);
  },
  prepareReplay(game) {
    game.daylight?.set(1, 0);
    if (game.mode === 'car') game.exitCar();
    game.car.repair();
    const I = home(game);
    if (I) { game.start(I.outside.x, I.outside.z, I.outside.yaw); }
  },
  failIf(m, game) {
    if (m.s.traced) return TRACED;
    if ([3, 7].includes(m.stepIndex) && game.car.disabled) return 'הרנו נפגעה יותר מדי. ארז: "בלי רכב לא מגיעים לחוף. ולא לגלידה."';
    if ([5, 6].includes(m.stepIndex) && game.paint.hits >= OUT_AT) return MARKED_OUT;
    return null;
  },
  restore(m, game, checkpoint) {
    const Yd = yard(game), I = home(game);
    endChase(m, game);
    game.dialogue.stop();
    game.hack?.close();
    game.cutscene = false; game.follow.override = null;
    game.car.repair();
    game.hud.showCall(null);
    m.s = { ...m.s, traced: false, spotted: false, playing: false, hacked: false };
    if (checkpoint === 1 && I) { game.start(I.living.x, I.living.z, I.living.yaw); game.npc('erez').place(I.desk.x + 0.9, I.desk.z + 0.3, I.desk.yaw); game.npc('erez').show(true); }
    if (checkpoint === 3) { game.exitCar(); game.enterCar(); game.erezBuddy.held = false; game.erezBuddy.join(); }
    if (checkpoint >= 4 && checkpoint <= 6) {
      game.exitCar();
      const B = game.world.places.beachLot;
      game.car.place(B.parking.x, B.parking.z, B.parking.yaw);
      const at = checkpoint === 6 ? Yd.office.door : Yd.gateInside;
      game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw);
      postGuards(game); armUp(game);
      if (checkpoint === 6) for (const g of game.paint.guards) game.paint.markGuard(g, 'restore');
    }
    if (checkpoint === 7) { game.exitCar(); const B = game.world.places.beachLot; game.car.place(B.parking.x, B.parking.z, B.parking.yaw); game.player.place(Yd.gate.x, Yd.gate.z, Math.PI); game.paint.disarmPlayer(); game.companion.held = false; game.erezBuddy.held = false; }
  },
  cleanup(m, game) {
    endChase(m, game);
    game.paint.dispose();
    game.hack?.close();
    game.cutscene = false; game.follow.override = null;
    game.hud.showCall(null);
    game.nehorai.setPose(null);
    const I = home(game); if (I?.screenMat) I.screenMat.emissiveIntensity = 0;
    for (const [id] of GUARDS) { const n = game.npc(id); n.model.setPose(null); n.show(false); }
    const c = game.npc('cipher'); c.model.setPose(null); c.show(false);
    const d = game.npc('dolev'); if (d.model.pose === 'sit') d.model.setPose(null);
    for (const b of ['idoBuddy', 'hadarBuddy', 'liamBuddy', 'companion', 'erezBuddy']) game[b].held = false;
    if (game.erezBuddy.active) game.erezBuddy.leave();
    if (game.daylight && game.daylight.target > 0) game.daylight.set(0, 3);
    game.populate({ walk: true });
  },

  steps: [
    { // 0: Erez calls; home, at the computer
      objective: 'ארז מתקשר. לענות',
      enter(m, game) { game.daylight?.set(1, 0); },
      update(m, game) {
        if (!m.s.rang && m.t > 3.0 && !game.hud.fading) {
          m.s.rang = true;
          game.hud.showCall('ארז', () => { game.nehorai.setPose('phone'); game.dialogue.play(CALL).then(() => { game.nehorai.setPose(null); m.s.talked = true; }); });
        }
        say(m, game, m.s.rang ? 'ארז מתקשר. לענות' : 'ערב בקציר');
        return m.s.talked ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); },
    },
    { // 1: the computer
      objective: 'בבית: לפתוח את המחשב עם ארז', checkpoint: true,
      enter(m, game) {
        const I = home(game); if (!I) return;
        if (!m.s.home) {
          m.s.home = true;
          game.hud.fade('בבית · 20:30', () => {
            game.start(I.living.x, I.living.z, I.living.yaw);
            const e = game.npc('erez'); e.place(I.desk.x + 0.9, I.desk.z + 0.3, I.desk.yaw); e.idle = 'arms'; e.target = null; e.show(true);
            game.hud.banner('הצופן', '20:30', 'המחשב בסלון · ארז הגיע', 2600);
          }, 1300);
        }
      },
      target: (m, game) => { const I = home(game); return I && !m.s.playing ? { x: I.desk.x, z: I.desk.z, y: I.floorY, r: 1.6 } : null; },
      interaction(m, game) {
        const I = home(game);
        if (!I || m.s.playing || game.mode !== 'foot' || game.hud.fading) return null;
        if (near(game.player.pos, I.desk, 2.2)) return { label: 'לפתוח את המחשב', priority: 5, run: () => {
          m.s.playing = true;
          game.player.place(I.desk.x, I.desk.z, I.desk.yaw);
          game.cutscene = true;
          if (I.screenMat) I.screenMat.emissiveIntensity = 1.2;
          game.dialogue.play(AT_PC).then(() => game.hack.start({
            onRound: (r) => { game.dialogue.play([ROUND[r]]); },
            onFail: () => { m.s.traced = true; },
          })).then((ok) => { if (ok) { m.s.hacked = true; } game.cutscene = false; });
        } };
        return null;
      },
      update(m, game) { say(m, game, m.s.playing ? 'לחזור על הנתיב באותו סדר · לפני שפס האיתור מתמלא' : 'לגשת למחשב בסלון ולפתוח אותו'); return m.s.hacked ? 'next' : null; },
      exit(m, game) { game.cutscene = false; game.follow.override = null; },
    },
    { // 2: found him — and Dolev's call
      objective: 'השרת אותר',
      enter(m, game) {
        game.dialogue.play(FOUND).then(() => { m.s.foundSaid = true; });
      },
      update(m, game) {
        if (m.s.foundSaid && !m.s.rang2 && !game.dialogue.busy) {
          m.s.rang2 = true;
          game.hud.showCall('דולב', () => { game.nehorai.setPose('phone'); game.dialogue.play(DOLEV).then(() => { game.nehorai.setPose(null); game.hud.showCall(null); return game.dialogue.play(CUT); }).then(() => { game.hud.banner('הודעה', 'הצופן', 'מגרש המכולות · חוף חדרה · "בואו לבד"', 3200); return game.dialogue.play(MESSAGE); }).then(() => { m.s.go = true; }); });
        }
        say(m, game, m.s.rang2 ? 'דולב מתקשר. לענות' : 'השרת אותר: מגרש המכולות בחוף חדרה');
        return m.s.go ? 'next' : null;
      },
      exit(m, game) { game.hud.showCall(null); const I = home(game); if (I?.screenMat) I.screenMat.emissiveIntensity = 0.4; },
    },
    { // 3: down to the beach, the Cipher's cars on the way
      objective: 'לנסוע לחוף חדרה, למגרש המכולות. ארז איתך', checkpoint: true,
      enter(m, game) {
        const I = home(game);
        if (I && game.mode === 'foot' && I.inside(game.player.pos.x, game.player.pos.z)) game.hud.fade('', () => { game.start(I.outside.x, I.outside.z, I.outside.yaw); }, 700);
        game.erezBuddy.held = false;
        if (!game.erezBuddy.active) game.erezBuddy.join({ near: I ? { x: I.outside.x + 1.6, z: I.outside.z + 1.2 } : null });
      },
      target: (m, game) => { const B = game.world.places.beachLot; return game.mode === 'car' ? { ...B.parking, y: B.y, r: 6 } : { ...game.car.pos, r: 2.4 }; },
      update(m, game, dt) {
        const B = game.world.places.beachLot;
        if (game.mode === 'car') { const e = game.npc('erez'); if (!e.inCar) e.enter(game.car); } // Erez jumps in as the Renault leaves
        if (game.mode === 'car' && !m.pursuit) m.pursuit = new Pursuit(game, { grace: 7, cars: 2, gap: 16, colors: ['#1c1f26', '#2a8fb8'], lines: ROAD, bonus: 150 });
        if (m.pursuit) m.pursuit.update(dt);
        say(m, game, game.mode === 'car' ? (m.pursuit?.active ? 'לחוף חדרה · הרכבים של הצופן מאחור' : 'לנסוע לחוף חדרה, לחניון שבקצה הדרומי') : 'להיכנס לרנו, ארז איתך');
        return game.mode === 'car' && near(game.car.pos, B.parking, 9) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
      exit(m, game) { endChase(m, game); },
    },
    { // 4: the yard gate
      objective: 'מגרש המכולות',
      enter(m, game) {
        const Yd = yard(game);
        game.cutscene = true;
        game.exitCar();
        const e = game.npc('erez'); if (e.inCar) e.stepOut(1);
        game.erezBuddy.held = true;
        game.player.place(Yd.gate.x, Yd.gate.z, Yd.gate.yaw);
        e.place(Yd.gate.x + 1.6, Yd.gate.z + 0.4, Yd.gate.yaw); e.idle = null; e.target = null; e.show(true);
        postGuards(game);
        game.follow.shot({ x: Yd.gate.x + 6, y: Yd.y + 3.5, z: Yd.gate.z - 7 }, { x: Yd.x, y: Yd.y + 1.5, z: Yd.z }, 9999);
        game.hud.banner('מגרש המכולות', 'חוף חדרה', 'צבע, לא דם · דולב במכולה המוארת', 3000);
        if (!m.s.arrived) game.dialogue.play(ARRIVE).then(() => { m.s.arrived = true; });
      },
      update: (m) => (m.s.arrived ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); armUp(game); },
    },
    { // 5: through the yard
      objective: `לסמן את שמונת השומרים בין המכולות (0/8) · סומנת 0/${OUT_AT}`, checkpoint: true,
      enter(m, game) {
        const P = game.paint; m.s.spotted = false;
        P.onSpot = () => { if (!m.s.spotted) { m.s.spotted = true; game.dialogue.play(SPOTTED); } };
      },
      update(m, game) {
        const left = guardsLeft(game);
        say(m, game, left ? `לסמן את השומרים בין המכולות (${8 - left}/8) · סומנת ${game.paint.hits}/${OUT_AT}` : 'המגרש נקי · למכולה המוארת');
        if (!left && !m.s.cleared) { m.s.cleared = true; game.dialogue.play(CLEARED); }
        return left === 0 ? 'next' : null;
      },
      exit(m, game) { game.paint.onSpot = null; },
    },
    { // 6: the office: the Cipher, Dolev, the laptop
      objective: 'להיכנס למכולה: לסמן את הצופן, לשחרר את דולב, לקחת את המחשב הנייד', checkpoint: true,
      enter(m, game) {
        const Yd = yard(game), P = game.paint, c = game.npc('cipher');
        if (!P.guards.some((g) => g.npc === c)) { c.idle = null; P.addGuard(c, [Yd.office.cipher], '#59c7ff', { quick: true, still: true }); }
      },
      target: (m, game) => { const Yd = yard(game); if (!m.s.cipherOut) return { ...Yd.office.door, y: Yd.y, r: 1.8 }; if (!m.s.freed) return { ...Yd.office.dolev, y: Yd.y, r: 1.4 }; if (!m.s.laptop) return { ...Yd.office.laptop, r: 1.2 }; return null; },
      interaction(m, game) {
        const Yd = yard(game), O = Yd.office;
        if (game.mode !== 'foot' || !m.s.cipherOut) return null;
        if (!m.s.freed && near(game.player.pos, O.dolev, 2.2)) return { label: 'לשחרר את דולב', priority: 5, run: () => {
          m.s.freed = true;
          const d = game.npc('dolev'); d.model.setPose(null); d.idle = 'arms'; d.lookAt(game.player.pos.x, game.player.pos.z);
          game.dialogue.play(FREE);
        } };
        if (m.s.freed && !m.s.laptop && near(game.player.pos, O.laptop, 2.0)) return { label: 'לקחת את המחשב הנייד', priority: 5, run: () => { m.s.laptop = true; game.hud.toast('המחשב הנייד של הצופן אצלך', 1800); game.addMoney?.(0); } };
        return null;
      },
      update(m, game) {
        const P = game.paint, c = game.npc('cipher');
        const cg = P.guards.find((g) => g.npc === c);
        if (cg?.marked && !m.s.cipherOut) { m.s.cipherOut = true; game.dialogue.play(CIPHER); }
        say(m, game, !m.s.cipherOut ? `להיכנס למכולה ולסמן את הצופן · סומנת ${game.paint.hits}/${OUT_AT}` : !m.s.freed ? 'לשחרר את דולב' : !m.s.laptop ? 'לקחת את המחשב הנייד מהשולחן' : 'לצאת');
        return m.s.laptop && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 7: out, with Dolev and Erez; the Cipher's crew behind
      objective: 'לרוץ לרנו עם דולב וארז · לברוח לגן שמואל', checkpoint: true,
      enter(m, game) {
        game.paint.disarmPlayer();
        if (!m.s.outLine) { m.s.outLine = true; game.dialogue.play(OUT); }
        game.companion.held = false; game.erezBuddy.held = false;
        if (!game.companion.active) game.companion.join({ near: yard(game).office.door });
        if (!game.erezBuddy.active) game.erezBuddy.join({ near: yard(game).office.door });
      },
      target: (m, game) => { const S = stand(game); return game.mode === 'car' ? { ...S.parking, y: S.parking.y, r: 6 } : { ...game.car.pos, r: 2.6 }; },
      update(m, game, dt) {
        const S = stand(game);
        if (game.mode === 'car') for (const id of ['dolev', 'erez']) { const n = game.npc(id); if (!n.inCar) n.enter(game.car); } // they jump in
        if (game.mode === 'car' && !m.pursuit) m.pursuit = new Pursuit(game, { grace: 6, cars: 3, gap: 12, colors: ['#1c1f26', '#2a8fb8', '#3a3f47'], lines: ESCAPE, bonus: 200 });
        if (m.pursuit) m.pursuit.update(dt);
        say(m, game, game.mode === 'car' ? (m.pursuit?.active ? 'לאבד את הרכבים של הצופן ולנסוע לגן שמואל' : 'לנסוע לשער גן שמואל, לדוכן הגלידה') : 'לרוץ לרנו עם דולב וארז');
        return game.mode === 'car' && near(game.car.pos, S.parking, 8) && Math.abs(game.car.speed) < 2 ? 'next' : null;
      },
      exit(m, game) { endChase(m, game); },
    },
    { // 8: ice cream by the gate
      objective: 'גלידה בגן שמואל',
      enter(m, game) {
        const S = stand(game);
        game.cutscene = true;
        game.exitCar();
        for (const [id, b] of [['dolev', 'companion'], ['erez', 'erezBuddy']]) { const n = game.npc(id); if (n.inCar) n.stepOut(id === 'erez' ? 1 : -1); game[b].held = true; n.show(true); }
        game.player.place(S.spots[0].x, S.spots[0].z, S.spots[0].yaw);
        game.npc('erez').place(S.spots[1].x, S.spots[1].z, S.spots[1].yaw); game.npc('erez').idle = 'arms'; game.npc('erez').target = null;
        game.npc('dolev').place(S.spots[2].x, S.spots[2].z, S.spots[2].yaw); game.npc('dolev').idle = 'arms'; game.npc('dolev').target = null;
        game.follow.shot({ x: S.table.x + 3.5, y: S.y + 2.2, z: S.table.z + 3.5 }, { x: S.table.x, y: S.y + 1.1, z: S.table.z }, 9999);
        game.hud.banner('גן שמואל', 'גלידה', 'שלושה כדורים על חשבון המחשב הנייד', 3000);
        const fallback = () => new Promise((res) => { game.follow.shot({ x: S.table.x - 2.2, y: S.y + 1.6, z: S.table.z + 2.6 }, { x: S.table.x, y: S.y + 1.0, z: S.table.z }, 9999); setTimeout(res, 5000); });
        game.dialogue.play(ICE).then(() => game.playCutscene('icecream', fallback)).then(() => game.dialogue.play(END)).then(() => { m.s.done = true; });
      },
      update: (m) => (m.s.done ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.follow.override = null; game.follow.snapBehind(game.player.yaw); for (const id of ['erez', 'dolev']) game.npc(id).idle = null; },
    },
  ],
};
