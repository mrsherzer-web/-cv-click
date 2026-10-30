// Chapter three, mission 2, "the main event": Hadar against Bulldozer, three rounds, Nehorai in Hadar's
// corner. Hadar fights by himself; Nehorai sees what Hadar cannot and calls it: "חסום!" while Bulldozer
// winds up (red), "עכשיו!" while he is open after a punch (yellow), and a tip in the corner between
// rounds. Then the bet from the kiosk is paid: shawarma for everyone, on Bulldozer. By agreement, with
// gloves and a referee; no blood. The lines are written for the game and do not describe the real people.
import { MainEvent, ROUND, rest, twoShot } from '../combat/bout.js';
import { setTheNight, FRIENDS, PORCUPINES } from './m12-fightnight.js';

const ROUNDS = 3;
const HADAR = { hp: 220, power: 1, guard: 0.25, sharp: 0.1, jabEvery: 3, jab: 0.7, counter: 1.25 };
const INTRO = [
  ['קוצי', 'ועכשיו, האירוע המרכזי! בפינה האדומה, מקציר, שחזר מניו יורק: הדר... בן... עמי!'],
  ['ארז', 'הדר! הדר! הדר!'],
  ['קוצי', 'ובפינה הכחולה, מהקיוסק, מאה ועשרה קילו של ביטחון עצמי: בולדוזר!'],
  ['בולדוזר', 'מאה ושמונה. אכלתי קל היום.'],
  ['מולר', 'נקי.'],
  ['הדר', 'נהוראי, מהפינה אתה רואה מה שאני לא רואה. כשהוא מסתובב לזרוק, תצעק "חסום!".'],
  ['הדר', 'וכשהוא נפתח אחרי מכה, תצעק "עכשיו!". אני סומך עליך.'],
  ['נהוראי', 'אדום: חסום. צהוב: עכשיו. הבנתי. אני לא לחוץ בכלל.'],
];
const TIPS = [
  { id: 'guard', label: 'ידיים למעלה', note: 'הדר חוסם יותר לבד', line: 'הוא מגיע עם הימנית, כל פעם. ידיים למעלה גם כשאני שותק.' },
  { id: 'jab', label: 'הג׳אב', note: 'הדר זורק יותר מכות בין ההתקפות', line: 'תעבוד על הג׳אב. תשבור לו את הקצב, הוא שונא את זה.' },
  { id: 'upper', label: 'אפרקאט', note: 'מכת הנגד של הדר חזקה יותר', line: 'אחד מלמטה, כמו שלימדת אותי. הוא לא רואה אותו מגיע.' },
];
const CORNER = ['הדר', 'מים. ...טוב. מה אתה רואה משם?'];
const WIN_KO = [
  ['מולר', 'הדר.'],
  ['בולדוזר', '...אתה מתאגרף טוב, מקציר. באמת.'],
];
const WIN_POINTS = [
  ['מולר', 'שלושה סיבובים. נקודות. הדר.'],
  ['בולדוזר', 'שלושה סיבובים ואני עוד עומד. ...אבל אתה מתאגרף טוב, מקציר.'],
];
const AFTER = [
  ['הדר', 'גם אתה. ובלי לקחת תיקים, אפילו יותר טוב.'],
  ['קוצי', 'ועל מי השווארמה? ההתערבות מהקיוסק!'],
  ['בולדוזר', '...עליי. שווארמה לכולם.'],
];
const END = [
  ['ארז', 'תכלס, הכי טוב בערב היה הבמבה. ואחריה הדר.'],
  ['יונתי', 'הסרטון כבר באוויר. בהילוך איטי. אני נראה בו מעולה, משום מה.'],
  ['אברהם', 'אני רוצה שיירשם: גם היום דיברתי. פעמיים.'],
  ['דולב', 'חבורה טובה, ושווארמה על חשבון בולדוזר. מה עוד צריך?'],
  ['מולר', 'עוד אחת.'],
  ['הדר', 'נהוראי. ניו יורק לא הייתה ככה. פה זה בית.'],
  ['נהוראי', 'יאללה. מחר בבוקר מסדרים את החדר. הפעם באמת.'],
  ['הדר', 'Bro. אמרת את זה גם בפרק השני.'],
];
const LOSE = 'בולדוזר הפיל את הדר. מהפינה רואים את זה לפני: כשהעיגול סביב בולדוזר אדום, "חסום!"; כשהוא צהוב, "עכשיו!".';
const POINTS_LOST = 'בולדוזר ניצח בנקודות. הדר צריך אותך: "חסום!" על האדום, "עכשיו!" על הצהוב, וכמה שיותר.';

const ring = (game) => game.world.places.courtRing;

// Hadar and Bulldozer in the ring, Nehorai outside the red corner, Shpitz in Bulldozer's
function lineUp(game) {
  const R = ring(game), a = R.at(-1.7, 1.7), b = R.at(1.7, -1.7), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const h = game.npc('hadar'), bu = game.npc('bulldozer'), me = R.at(-3.85, 3.2);
  game.exitCar();
  game.player.place(me.x, me.z, Math.atan2(R.center.x - me.x, R.center.z - me.z));
  game.follow.snapBehind(game.player.yaw);
  game.nehorai.setPose(null);
  for (const [n, p, y] of [[h, a, yaw], [bu, b, yaw + Math.PI]]) {
    if (n.inCar) n.stepOut(-1);
    n.place(p.x, p.z, y);
    n.idle = null; n.target = null; n.face = null;
    n.model.setPose(null);
    n.show(true);
  }
}

// the shot from behind Nehorai in the red corner (clear of the light pole), kept on the two of them
function tv(game) {
  const R = ring(game), C = R.center;
  game.follow.shot({ x: C.x - 4.4, y: C.y + 3.6, z: C.z + 7.6 }, { x: C.x, y: C.y + 1.1, z: C.z }, 9999);
}
function follow(game) {
  const o = game.follow.override;
  if (!o) return;
  const a = game.npc('hadar').pos, b = game.npc('bulldozer').pos;
  o.look.set((a.x + b.x) / 2, ring(game).y + 1.1, (a.z + b.z) / 2);
  o.left = 9999;
}

function board(m, game) {
  const ev = m.ev, s = m.s;
  game.hud.setBout({
    round: s.round, of: ROUNDS, clock: s.clock,
    red: { name: 'הדר', frac: ev ? ev.hadar.hpFrac : s.hp.hadar / 220 },
    blue: { name: 'בולדוזר', frac: ev ? ev.bulldozer.hpFrac : s.hp.bull / 800 },
  });
}

function endBout(m) { m.ev?.dispose(); m.ev = null; }

function startBout(m, game) {
  m.ev = new MainEvent(game, {
    // tuned so that Hadar on his own loses, with about half the calls made wins, and with all of them
    // wins inside the distance (a headless run of the same code, many bouts per setting)
    red: { npc: game.npc('hadar'), ...HADAR, name: 'הדר' },
    blue: { npc: game.npc('bulldozer'), hp: 800, power: 1.3, aggression: 0.85, windup: 0.62, moves: ['swing', 'cross', 'swing', 'jab'], name: 'בולדוזר' },
  });
}

function round(m, game) {
  const s = m.s, ev = m.ev, tip = s.tip;
  ev.stats.guard = tip === 'guard' ? 0.55 : HADAR.guard;
  ev.stats.jabEvery = tip === 'jab' ? 1.8 : HADAR.jabEvery;
  ev.stats.counter = tip === 'upper' ? 1.6 : HADAR.counter;
  ev.pause(false);
  s.clock = ROUND;
  s.phase = 'round';
  game.sound?.bell(1);
  game.hud.banner('האירוע המרכזי', `סיבוב ${s.round}`, s.round === 1 ? 'אדום: חסום! · צהוב: עכשיו!' : '', 1500);
  board(m, game);
}

export default {
  id: 'mainevent', chapter: 3, number: 2, title: 'האירוע המרכזי',
  requires: ['fightnight'],
  follows: true, // straight on from the opening bout; after a reload or a retreat, from the court's gate
  where: 'לסימון הכחול בשער של המגרש בחדרה. הדר מחכה בפינה האדומה',
  startAt: (game) => (game.mode === 'car' ? null : { ...game.world.places.court.gate, y: game.world.places.court.y }),
  reward: { money: 300, unlocks: ['chapter-3'], text: 'סוף הפרק השלישי · הדר ניצח את בולדוזר · שווארמה לכל הקיוסק, על חשבון בולדוזר' },

  setup(m, game) {
    game.hadarBuddy.held = true;
    if (game.hadarBuddy.active) game.hadarBuddy.leave();
    if (game.companion.active) game.companion.leave();
    setTheNight(game, { bout: 'main' });
  },

  prepareReplay(game) {
    const c = game.world.places.court, s = game.world.roadSpot(c.gate.x + 8, c.gate.z + 12);
    game.exitCar();
    game.car.repair();
    if (s) game.car.place(s.x, s.z, s.yaw);
    game.start(c.gate.x, c.gate.z, Math.PI);
  },

  restore(m, game, checkpoint) {
    endBout(m);
    game.dialogue.stop();
    game.hud.hideChoice();
    game.hud.setBout(null);
    if (checkpoint === 1) {
      setTheNight(game, { bout: 'main' });
      lineUp(game);
      m.s = {};
    }
  },

  cleanup(m, game) {
    endBout(m);
    game.cutscene = false;
    game.follow.override = null;
    game.hud.hideChoice();
    game.hud.setBout(null);
    game.hadarBuddy.held = false;
    ring(game).show(false);
    for (const id of ['hadar', 'bulldozer', 'shpitz', ...FRIENDS, ...PORCUPINES, 'muller']) {
      const n = game.npc(id);
      if (n.model.pose === 'down' || n.model.pose === 'guard') n.model.setPose(null);
      if (n.idle === 'cheer') n.idle = null;
    }
  },

  steps: [
    { // 0: the announcement
      objective: 'האירוע המרכזי: הדר מול בולדוזר',
      enter(m, game) {
        const R = ring(game), C = R.center;
        game.cutscene = true;
        lineUp(game);
        game.follow.shot({ x: C.x + 1.5, y: C.y + 3, z: C.z + 7.5 }, { x: C.x, y: C.y + 1.2, z: C.z }, 90);
        game.hud.banner('האירוע המרכזי', 'הדר בן עמי מול בולדוזר', 'שלושה סיבובים · נהוראי בפינה של הדר', 3000);
        game.sound?.cheer(1);
        game.dialogue.play(INTRO).then(() => { m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
    },
    { // 1: three rounds, calls from the corner, a tip between rounds
      objective: `סיבוב 1 מתוך ${ROUNDS} · אדום: חסום! · צהוב: עכשיו!`, checkpoint: true,
      enter(m, game) {
        game.cutscene = true; // Nehorai stays in the corner: the button is his voice
        lineUp(game);
        tv(game);
        m.s = { round: 1, hp: { hadar: 220, bull: 800 } };
        startBout(m, game);
        round(m, game);
      },
      interaction(m, game) {
        const ev = m.ev, call = m.s.phase === 'round' ? ev?.call : null;
        if (!call) return null;
        const run = (kind, word) => () => { game.hud.pop(ev.shout(kind) ? word : 'מאוחר מדי', kind === 'block' ? 'block' : 'counter'); };
        return call === 'block'
          ? { label: 'חסום!', tone: 'red', priority: 9, run: run('block', 'חסום!') }
          : { label: 'עכשיו!', tone: 'yellow', priority: 9, run: run('counter', 'עכשיו!') };
      },
      update(m, game, dt) {
        const s = m.s, ev = m.ev;
        if (s.phase === 'round') follow(game); // in the corner the shot stays on Nehorai and Hadar
        board(m, game);
        if (s.phase === 'round') {
          ev.update(dt);
          if (ev.over) {
            if (!ev.won) return `fail:${LOSE}`;
            s.wonAt ??= m.t;
            if (!s.bellRung) { s.bellRung = true; game.sound?.bell(3); game.sound?.cheer(1.2); for (const id of FRIENDS) game.npc(id).idle = 'cheer'; }
            if (m.t - s.wonAt > 1.6) { s.result = 'ko'; return 'next'; }
            return null;
          }
          s.clock -= dt;
          if (s.clock > 0) return null;
          game.sound?.bell(2);
          if (s.round >= ROUNDS) { // the distance: who has more left
            ev.pause(true);
            if (ev.hadar.hpFrac >= ev.bulldozer.hpFrac) { s.result = 'points'; return 'next'; }
            return `fail:${POINTS_LOST}`;
          }
          // the corner: both back, water, and what Nehorai saw
          ev.pause(true);
          s.phase = 'corner';
          const R = ring(game), h = game.npc('hadar'), bu = game.npc('bulldozer'), a = R.at(-2.3, 2.3), b = R.at(2.3, -2.3);
          h.place(a.x, a.z, Math.PI * 0.75 + Math.PI);
          bu.place(b.x, b.z, -Math.PI * 0.25 + Math.PI);
          h.model.setPose(null); bu.model.setPose(null);
          rest(ev.hadar, 0.15);
          rest(ev.bulldozer, 0.05);
          twoShot(game, game.player.pos, h.pos, R.at(0, 4.7));
          // (a conversation that is cut short still resolves: only the corner that is still on goes on)
          const still = () => game.missions.active === m && m.s === s && s.phase === 'corner';
          game.dialogue.play([CORNER]).then(() => {
            if (!still()) return;
            game.hud.choose(`בפינה · מה הדר צריך לסיבוב ${s.round + 1}?`, TIPS).then((id) => {
              if (!still()) return;
              s.tip = id;
              game.dialogue.play([['נהוראי', TIPS.find((t) => t.id === id).line]]).then(() => { s.cornerDone = true; });
            });
          });
          return null;
        }
        if (s.phase === 'corner' && s.cornerDone) {
          s.cornerDone = false;
          s.round++;
          tv(game);
          const R = ring(game), a = R.at(-1.7, 1.7), b = R.at(1.7, -1.7), yaw = Math.atan2(b.x - a.x, b.z - a.z);
          game.npc('hadar').place(a.x, a.z, yaw);
          game.npc('bulldozer').place(b.x, b.z, yaw + Math.PI);
          ev.hadar.body.model.setPose('guard');
          ev.opp.npc.model.setPose('guard');
          round(m, game);
          game.hud.setObjective(`סיבוב ${s.round} מתוך ${ROUNDS} · אדום: חסום! · צהוב: עכשיו!`, game.missions.label);
          m.said = null;
        }
        return null;
      },
      exit(m, game) {
        const ev = m.ev;
        m.s.calls = ev ? { ...ev.calls } : null;
        endBout(m);
        game.hud.setBout(null);
      },
    },
    { // 2: Muller raises Hadar's hand, and the bet is paid
      objective: 'הדר מנצח',
      enter(m, game) {
        const R = ring(game), C = R.center, h = game.npc('hadar'), bu = game.npc('bulldozer'), mu = game.npc('muller');
        if (bu.model.pose === 'down') { bu.model.setPose(null); bu.model.play('getup'); }
        h.model.setPose('cheer');
        mu.place(h.pos.x + 0.8, h.pos.z + 0.4, Math.atan2(h.pos.x - mu.pos.x, h.pos.z - mu.pos.z));
        mu.idle = null;
        for (const id of FRIENDS) game.npc(id).idle = 'cheer';
        game.nehorai.setPose('cheer');
        game.follow.shot({ x: C.x - 1.5, y: C.y + 2.6, z: C.z + 6.5 }, { x: h.pos.x, y: C.y + 1.3, z: h.pos.z }, 9999);
        game.dialogue.play([...(m.s.result === 'ko' ? WIN_KO : WIN_POINTS), ...AFTER]).then(() => { m.s.paid = true; });
      },
      update(m, game) {
        if (m.t > 2.6 && !m.s.calm) { m.s.calm = true; game.npc('hadar').model.setPose(null); game.nehorai.setPose(null); }
        return m.s.paid ? 'next' : null;
      },
    },
    { // 3: shawarma at the kiosk, the chapter's end
      objective: 'שווארמה בקיוסק, על חשבון בולדוזר',
      enter(m, game) {
        game.hud.fade('אחרי הקרב · בקיוסק', () => {
          const K = game.world.places.kiosk, f = K.front;
          ring(game).show(false);
          // the Porcupines at their tables, everyone else standing round
          ['kotzi', 'shpitz', 'roller', 'tosti'].forEach((id, i) => {
            const n = game.npc(id), st = K.seats[[0, 1, 3, 4][i]];
            n.place(st.x, st.z, st.yaw); n.idle = null; n.model.setPose('sit'); n.show(true);
          });
          const around = [['bulldozer', -1.6, -1.8], ['hadar', 0.4, -0.6], ['erez', 1.6, -0.2], ['yonati', 2.6, -1.0], ['avraham', -0.6, 0.6], ['dolev', 1.0, 0.9], ['muller', 2.4, 0.4]];
          for (const [id, dx, dz] of around) {
            const n = game.npc(id);
            n.place(f.x + dx, f.z + dz, Math.atan2(K.x - (f.x + dx), K.z - (f.z + dz)));
            n.idle = id === 'yonati' ? 'phone' : null; n.target = null;
            n.model.setPose(null);
            n.show(true);
          }
          game.exitCar();
          game.player.place(f.x - 0.8, f.z + 1.4, Math.atan2(K.x - f.x, K.z - f.z));
          const park = game.world.places.safeParking; // the Renault, brought round from the court's street
          if (Math.hypot(game.car.pos.x - f.x, game.car.pos.z - f.z) > 80) game.car.place(park.x, park.z, park.yaw);
          game.follow.shot({ x: f.x + 4.5, y: K.y + 2.4, z: f.z + 4 }, { x: f.x - 0.5, y: K.y + 1.1, z: f.z - 1.5 }, 9999);
          m.s.there = true;
        }, 1200);
      },
      update(m, game) {
        if (m.s.there && !m.s.talking && !game.hud.fading) { m.s.talking = true; game.dialogue.play(END).then(() => { m.s.ate = true; }); }
        // the last line, then to black: the chapter's end
        if (m.s.ate && !m.s.closing) { m.s.closing = true; game.hud.fade('סוף הפרק השלישי', () => { m.s.closed = true; }, 1600); }
        return m.s.closed ? 'next' : null;
      },
      exit(m, game) {
        game.cutscene = false;
        game.follow.override = null;
        game.follow.snapBehind(game.player.yaw);
      },
    },
  ],

  complete(m, game) {
    game.hadarBuddy.held = false;
    game.hadarBuddy.join({ near: game.npc('hadar').pos });
  },
};
