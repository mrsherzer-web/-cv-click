// Chapter ten, mission 7 (53): סוד החורשה. Over there, in the olive grove's other dimension, at the first wall of
// energy where mission 52 left them. The walkie-talkie: static, DIMENSION UNKNOWN – CONNECTION LOST, the lines. Then
// the grove gives up its secret in three parts. a. three glowing symbols, each a small task that opens the next wall
// of energy: the first by the white boulder (find it, switch it on); the second in the playground, lit only while
// both swings move (Erez takes one — his job — Nehorai the other); the third by the football goal, ringed by drifting
// disturbances to slip past. b. the broken-reality path over the rift: stones that come and go in a wave, a field
// that stops time (it stops the disturbances too), a leap, a switch that steadies the quick stones, the ledge where
// Erez needs a hand, a switch that raises the bridge, more disturbances; falling in puts him back on the last stone.
// c. the Threshold Keeper in his clearing, in three modes, twice round: warned energy to dodge; copies of himself
// (mark the real one; Erez spots the tell: the real one casts a shadow); his weak point, open only while the four
// anchor stones are lit (Nehorai lights them, Erez two of them on his call, or all by Nehorai while Erez draws him
// off) — then mark it. He bursts into light; the crystal; the radio crackles back to life. 54 carries on.
// Paint, never blood: the Keeper is energy, and he goes out as light. Invented, all of it.
import * as THREE from 'three';
import { near, say } from './missions.js';
import { OUT_AT } from '../combat/paint.js';
import { L, CARDS, KEEPER } from './lines10.js';
import { attempt, endCrew, Job, pathKit, Disturbance } from './infinity.js';
import { handsTo } from './phoenix-a.js';
import { beats, later, talkOn, hush, stay, bandage, armWrap, clearAll } from './phoenix-d.js';
import { GROVE, inGrove, pairAt, groveWall, runTo, clearSpot, yawTo, shotAt, hurtLook, birds } from './infinity-b.js';

const HP = 6, HALF = 3;          // the Keeper's health: the weak point marked down to HALF in the first round, to 0 in the second
const PUMP = 0.13, MOVING = 0.28, BOTH = 2.4;   // a push on the swing, the swing that counts as moving, seconds both must move
const SWING_W = Math.sqrt(9.8 / 1.8);           // the swings' pace (1.8 m chains)
const CYAN = '#7df9ff';

// lines that are not the user's: short, in each one's voice
const TRY = [['נהוראי', 'מולר? עידו? מישהו שומע אותי?']];
const BOULDER = [['ארז', 'נהוראי, תסתכל — ליד הסלע הלבן. משהו שם זוהר.']];
const LIT0 = [['ארז', 'הקיר של גן המשחקים נעלם! זה כמו משחק מחשב, אחי.'], ['נהוראי', 'אחד מתוך שלושה. ממשיכים.']];
const SWINGS = [['ארז', 'הסמל דולק רק כשהנדנדות זזות? יקום מקביל עם חוש הומור.'], ['ארז', 'אני לוקח את הימנית. מי שעף הכי גבוה — מנצח!']];
const LIT1 = [['ארז', 'ניצחתי. אל תתווכח.'], ['נהוראי', 'תמשיך לחלום. עוד אחד — ליד שער הכדורגל.']];
const RING = [['ארז', 'הכדורים מסתובבים סביבו. מחכים לרווח — ורצים.']];
const LIT2 = [['ארז', 'השביל נפתח… אבל הוא שבור לגמרי.'], ['נהוראי', 'אז נלך על מה שנשאר ממנו.']];
const WAVE = [['ארז', 'האבנים נעלמות בגל. הולכים אחרי הגל, לא לפניו.']];
const FIELD = [['ארז', 'העמוד הכחול עוצר את הזמן. אם הכדור נכנס אליו — הוא נתקע. תשתמש בזה.']];
const LEAPED = [['ארז', 'קפיצה יפה! רגע, אני בא.']];
const STEADY = [['ארז', 'המתג עצר את האבנים המהירות. גאון.']];
const HAND = [['ארז', 'אחי, יד? הקיר הזה גבוה ממני.']];
const THANKS = [['ארז', 'תודה. אני חייב לך אחת.'], ['נהוראי', 'אתה חייב לי בערך מאה.']];
const BRIDGE = [['ארז', 'גשר מאבנים שעפות באוויר. רגיל לגמרי.']];
const FELL = [['ארז', 'לאט, אחי! אני לא יכול לסחוב אותך משם למטה.']];
const WHAT = [['ארז', 'אחי… מה זה הדבר הזה?'], ['נהוראי', 'מי שזה לא יהיה — הוא שומר על משהו. ואנחנו צריכים את זה.']];
const DODGE = [['ארז', 'הצבע לא נדבק אליו! כשטבעת נדלקת מתחתיך — זז!']];
const SPOT = [['ארז', 'תסתכל על הדשא! לאמיתי יש צל — להעתקים אין!']];
const ANCHORS = [['ארז', 'אבני העוגן! כשכולן דולקות הוא נפתח. אני מסיח אותו — או שתקרא לי לשתיים.']];
const CALL = [['נהוראי', 'ארז! שתי האבנים הרחוקות — שלך!'], ['ארז', 'רץ!']];
const WEAK = [['ארז', 'הלב שלו נפתח! עכשיו!']];
const AGAIN = [['ארז', 'הוא קם שוב. סיבוב שני — והוא כועס.']];
const BURST = [['ארז', 'הוא… התפוצץ לאור?'], ['נהוראי', 'ומשהו נשאר באוויר.']];
const WARM = [['נהוראי', 'הוא חם… והוא רוטט.']];
const CRACKLE = [['ארז', 'שמעת? הקשר! משהו עובר!'], ['נהוראי', 'מולר… אם זה אתה — אנחנו פה!']];
const LOST_B = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "הכדורים מסמנים. מחכים שיעברו — או תופסים אותם בעמוד הכחול."';
const LOST_C = 'נהוראי סומן שלוש פעמים. לפי החוקים, בחוץ. ארז: "כשטבעת נדלקת מתחתיך — זזים. ולאמיתי יש צל."';

const A_GOAL = 'א. למצוא את מקור האנרגיה · סמלים';
const B_GOAL = 'ב. לעבור את שביל המציאות השבורה';
const C_GOAL = 'ג. שומר הסף';
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Kp = (game) => game.npc('keeper');

// ---------- the crystal: a cut stone of light that rises where the Keeper stood ----------
function makeCrystal(game, at) {
  const g = new THREE.Group(); g.name = 'grove crystal';
  const mat = new THREE.MeshStandardMaterial({ color: '#d6fbff', emissive: '#4fe3ff', emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.93 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), mat); gem.scale.set(1, 1.7, 1);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9ffcff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(gem, halo); g.position.set(at.x, at.y - 1.1, at.z); game.scene.add(g);
  let t = 0;
  return {
    group: g, taken: false,
    update(dt) { t += dt; const k = Math.min(1, t / 1.4); g.position.y = at.y - 1.1 * (1 - k) * (1 - k) + 0.08 * Math.sin(t * 2.2); gem.rotation.y += dt * 1.3; halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3)); },
    dispose() { g.removeFromParent(); gem.geometry.dispose(); mat.dispose(); halo.geometry.dispose(); halo.material.dispose(); },
  };
}

// ---------- a: the three symbols ----------
const lit = (game) => GROVE(game).symbols.filter((s) => s.lit).length;
function aOn(m, game) {
  m.A = { n: lit(game), ride: false, erez: 'free', sw: [{ amp: 0, ph: 0, ang: 0 }, { amp: 0, ph: 1.1, ang: 0 }], both: 0, off: 0, said: {} };
  if (m.A.n >= 2) ringOn(m, game);
}
function aOff(m, game) {
  const A = m.A; m.A = null;
  ringOff(m, game);
  m.job?.cancel(); m.job = null;
  const S = GROVE(game).playground.swingSeats || [];
  for (const s of S) s.set(0);
  if (A?.ride) { game.cutscene = false; game.follow.override = null; if (game.player.scripted === m) game.player.release(m); }
  if (A?.erez === 'on' || A?.erez === 'going') { const e = game.npc('erez'); e.floorY = null; e.model.setPose(null); }
}
function lightSymbol(m, game, i) {
  const Q = GROVE(game), s = Q.symbols[i];
  if (s.lit) return;
  s.light(true); Q.seals[i].open();
  game.sound?.chime?.(true); game.sound?.zap?.(0.4, 1.6);
  game.energy?.sparks(s.x, s.y + 0.9, s.z, CYAN, 26, 3);
  game.hud.toast(`סמל ${i + 1}/3 · קיר אנרגיה נפתח`, 2400);
  m.A.n = i + 1;
  later(m, [LIT0, LIT1, LIT2][i]);
  if (i === 1) { m.A.off = 1.4; ringOn(m, game); }
  if (i === 2) ringOff(m, game);
}
// the disturbances round the third symbol: three balls going round it, evenly apart (knocked back, never marked)
function ringOn(m, game) {
  ringOff(m, game);
  const Q = GROVE(game), s = Q.symbols[2], N = 8, R = 3.0;
  const pts = Array.from({ length: N }, (_, k) => ({ x: s.x + Math.sin(k * 2 * Math.PI / N) * R, z: s.z + Math.cos(k * 2 * Math.PI / N) * R, y: Q.y }));
  m.ring = [0, 3, 5].map((o) => new Disturbance(game, { path: [...pts.slice(o), ...pts.slice(0, o)], loop: true, speed: 2.0, r: 0.7, marks: false, label: 'הפרעה!' }));
}
function ringOff(m, game) { for (const d of m.ring || []) d.dispose(); m.ring = []; }
// a seat at an angle: where it hangs (the seat's centre, its height over the grass at rest is 0.5)
function seatAt(seat, ang) { return { x: seat.x, z: seat.z + seat.len * Math.sin(ang), lift: seat.len * (1 - Math.cos(ang)) }; }
const swingFront = (seat) => ({ x: seat.x, z: seat.z + 1.15, y: seat.y - 0.5 });
function getOn(m, game) {
  const A = m.A, Q = GROVE(game), S = Q.playground.swingSeats, P = game.player;
  if (!P.take(m)) return;
  A.ride = true; A.sw[0].amp = Math.max(A.sw[0].amp, 0.12);
  game.cutscene = true; // (seated: the marker down, the stick still; the push is the prompt)
  game.nehorai.setPose('sit'); P.yaw = 0;
  const f = S[0];
  game.follow.shot({ x: f.x + 4.4, y: Q.y + 2.3, z: f.z + 5.2 }, { x: f.x + 0.8, y: Q.y + 1.0, z: f.z }, 9999);
}
function getOff(m, game) {
  const A = m.A, Q = GROVE(game), S = Q.playground.swingSeats, P = game.player, e = game.npc('erez');
  if (A.ride) { const f = swingFront(S[0]); P.release(m, Q.y); P.place(f.x, f.z, 0, Q.y); game.nehorai.setPose(null); A.ride = false; }
  game.cutscene = false; game.follow.override = null; game.follow.snapBehind(P.yaw);
  if (A.erez === 'on') { const f = swingFront(S[1]); e.floorY = null; e.model.setPose(null); e.place(f.x + 0.4, f.z, 0, Q.y); }
  m.job?.cancel(); m.job = null;
  A.erez = 'done';
  game.squad.release('erez');
}
function swingTick(m, game, dt) {
  const A = m.A, Q = GROVE(game), S = Q.playground.swingSeats; if (!A || !S) return;
  for (let i = 0; i < 2; i++) {
    const w = A.sw[i];
    w.ph += SWING_W * dt;
    if (i === 1 && A.erez === 'on') w.amp = Math.min(0.48, w.amp + 0.3 * dt); // Erez pumps his own
    else w.amp = Math.max(0, w.amp - (i === 0 && A.ride ? 0.07 : 0.22) * dt);
    w.ang = w.amp * Math.sin(w.ph);
    S[i].set(w.ang);
  }
  if (A.ride) { // Nehorai on the left one: his body goes with the seat
    const P = game.player, p = seatAt(S[0], A.sw[0].ang);
    P.pos.x = p.x; P.pos.z = p.z; P.pos.y = P.visualY = Q.y + p.lift; P.yaw = 0; P.sync();
    if (game.nehorai.pose !== 'sit') game.nehorai.setPose('sit');
  }
  if (A.erez === 'on') { const e = game.npc('erez'), p = seatAt(S[1], A.sw[1].ang); e.floorY = Q.y + p.lift; e.target = null; e.place(p.x, p.z, 0); if (e.model.pose !== 'sit') e.model.setPose('sit'); }
  if (A.n === 1) { // both moving, for a while: the symbol lights
    A.both = A.ride && A.erez === 'on' && A.sw[0].amp > MOVING && A.sw[1].amp > MOVING ? A.both + dt : Math.max(0, A.both - dt * 2);
    if (A.both >= BOTH) lightSymbol(m, game, 1);
  }
  if (A.off > 0 && (A.off -= dt) <= 0) getOff(m, game);
}
function aTick(m, game, dt) {
  const A = m.A, Q = GROVE(game), me = game.player.pos; if (!A) return;
  swingTick(m, game, dt);
  m.job?.update(dt);
  for (const d of m.ring || []) d.update(dt);
  const S = Q.playground.swingSeats;
  // Erez's job: to the right-hand swing once Nehorai comes to the playground
  if (A.n === 1 && A.erez === 'free' && dist(me, Q.playground.swings) < 9) {
    A.erez = 'going';
    if (!A.said.sw) { A.said.sw = true; later(m, SWINGS); }
    const f = swingFront(S[1]);
    m.job = new Job(game, { who: 'erez', at: { ...f, yaw: Math.PI }, seconds: 0.6, label: 'לנדנדה', pill: 'ארז עולה על הנדנדה', onDone: () => {
      if (!m.A) return;
      m.A.erez = 'on'; m.A.sw[1].amp = 0.16;
      stay(game, 'erez', { x: S[1].x, z: S[1].z, y: Q.y, yaw: 0 }, { pose: 'sit', label: 'על הנדנדה' });
    } });
  }
  if (A.n === 2 && !A.said.ring && dist(me, Q.symbols[2]) < 10) { A.said.ring = true; later(m, RING); }
  let text = `${A_GOAL} (${A.n}/3)`;
  if (A.n === 0) text += ' · ליד הסלע הלבן';
  else if (A.n === 1) text += A.ride ? (A.erez === 'on' ? ' · לנדנד! שתי הנדנדות בתנועה' : ' · לנדנד · ארז בדרך לשנייה') : ' · בגן המשחקים · לעלות על הנדנדה';
  else if (A.n === 2) text += ' · ליד שער הכדורגל · לחכות לרווח בין הכדורים';
  say(m, game, text);
}
function aTarget(m, game) {
  const A = m.A, Q = GROVE(game); if (!A) return null;
  if (A.n === 0) return { ...Q.symbols[0].at, r: 1.0 };
  if (A.n === 1) return A.ride ? null : { ...swingFront(Q.playground.swingSeats[0]), y: Q.y, r: 0.9 };
  if (A.n === 2) return { ...Q.symbols[2].at, r: 1.0 };
  return null;
}
function aPrompt(m, game) {
  const A = m.A, Q = GROVE(game), me = game.player.pos; if (!A || game.mode !== 'foot') return null;
  if (A.ride) return A.n === 1 ? { label: 'לנדנד', priority: 8, run: () => { A.sw[0].amp = Math.min(0.62, A.sw[0].amp + PUMP); game.sound?.beep?.(1, 640); } } : null;
  if (game.player.busy) return null;
  if ((A.n === 0 || A.n === 2) && near(me, Q.symbols[A.n].at, 1.8)) { const i = A.n; return { label: 'להדליק את הסמל', priority: 7, run: () => lightSymbol(m, game, i) }; }
  if (A.n === 1 && near(me, swingFront(Q.playground.swingSeats[0]), 1.5)) return { label: 'לעלות על הנדנדה', priority: 7, run: () => getOn(m, game) };
  return null;
}

// ---------- b: the broken-reality path ----------
function bOn(m, game) {
  bOff(m, game);
  const Q = GROVE(game), bp = Q.brokenPath, e = game.npc('erez');
  m.B = { said: {}, falls: 0 };
  m.kit = pathKit(game, bp.kit, {
    friends: [e],
    onSwitch: (i, on) => { bp.thrown(i, on); later(m, i === 0 ? STEADY : BRIDGE); },
    onFall: (n) => { m.B.falls = n; if (n === 1) later(m, FELL); refuge(m, game); },
  });
  later(m, WAVE);
}
// put back after a fall right where a drifting ball passes (the last firm ground can be the bridge it crosses): on the
// nearest firm stone behind him that no ball is near, so a fall never turns into a run of marks
function refuge(m, game) {
  const bp = GROVE(game).brokenPath, P = game.player, balls = m.kit?.disturbances || [];
  const risky = (p) => balls.some((d) => !d.frozen && dist(d.pos, p) < 2.6);
  if (!risky(P.pos)) return;
  const u = bp.rect.x1 - P.pos.x;
  const firm = bp.stones.filter((st) => (st.kind === 'stone' || st.kind === 'bank') && st.u0 < u + 0.5).sort((a, b) => b.u0 - a.u0);
  for (const st of firm) if (!risky(st)) { P.place(st.x, st.z, P.yaw, st.y); return; }
}
function bOff(m, game) { m.kit?.dispose(); m.kit = null; m.B = null; }
// where to go next on the path, and the goal line's hint for it
function bPlan(m, game) {
  const Q = GROVE(game), bp = Q.brokenPath, K = m.kit, me = game.player.pos, u = bp.rect.x1 - me.x, top = me.y > Q.y + 1.0;
  const stone = (name) => bp.stones.find((s) => s.name === name);
  if (!K) return { to: bp.end, hint: '' };
  const sw0 = K.switches[0], sw1 = K.switches[1], hand = K.hand;
  // still on the lawn by the goal (not yet over the rift): first to where the path begins
  if (!bp.kit.inside(me) && me.x > bp.rect.x0 && dist(me, bp.start) > 1.6 && (me.x < bp.rect.x1 || dist(me, bp.start) > 4)) return { to: bp.start, hint: 'אל תחילת השביל · הקו התכלת מסמן את הדרך' };
  if (u < 11.2) return { to: stone('island A1'), hint: 'האבנים נעלמות בגל · לעלות כשהן מוצקות וללכת אחריו' };
  if (u < 17.4 && !top) return { to: bp.leaps[0].from, hint: 'לקפוץ לאי הבא · העמוד הכחול עוצר את הזמן, גם לכדור' };
  if (!sw0.used) return { to: sw0.at, hint: 'להפעיל את המתג שמייצב את האבנים המהירות' };
  if (u < 32.6 && !top) return { to: bp.ledge.bottom, hint: 'לעבור על האבנים ולטפס על המדרגה' };
  if (hand && !hand.done) return { to: bp.ledge.to, hint: 'לתת יד לארז' };
  if (!sw1.used) return { to: sw1.at, hint: 'להרים את הגשר' };
  return { to: bp.end, hint: 'לעבור בין הכדורים אל הצד השני' };
}
function bTick(m, game, dt) {
  const K = m.kit, B = m.B, Q = GROVE(game), bp = Q.brokenPath; if (!K || !B) return;
  if (K.switches[1]) K.switches[1].enabled = !K.hand || K.hand.done; // the bridge waits for Erez up on the ledge
  K.update(dt);
  const me = game.player.pos, u = bp.rect.x1 - me.x;
  if (!B.said.field && u > 11 && u < 16.8) { B.said.field = true; later(m, FIELD); }
  if (!B.said.leap && K.leaps[0]?.leaps > 0) { B.said.leap = true; later(m, LEAPED); }
  if (!B.said.ledge && K.climb?.climbs > 0) { B.said.ledge = true; later(m, HAND); }
  if (!B.said.hand && K.hand?.done) { B.said.hand = true; later(m, THANKS); }
  say(m, game, `${B_GOAL} · ${bPlan(m, game).hint}`);
}
const bDone = (m, game) => { const Q = GROVE(game), bp = Q.brokenPath, me = game.player.pos; return !!m.kit && bp.rect.x1 - me.x > bp.length + 0.6 && Math.abs(me.y - Q.y) < 0.5 && (!m.kit.hand || m.kit.hand.done); };

// ---------- c: the Threshold Keeper ----------
function arenaPost(game, ang, r = 8.6) { const A = GROVE(game).arena; return clearSpot(game, { x: A.centre.x + Math.sin(ang) * r, z: A.centre.z + Math.cos(ang) * r, y: GROVE(game).y }); }
const angOf = (game, p) => { const A = GROVE(game).arena; return Math.atan2(p.x - A.centre.x, p.z - A.centre.z); };
function cOn(m, game) {
  m.K = { phase: 'walk', round: 0, t: 0, atk: 1.2, left: 0, i: 0, shot: 0.8, spotT: 0, spotted: false, called: false, jobs: [], hop: 0 };
}
function cOff(m, game) {
  m.foe?.dispose(); m.foe = null;
  game.energy?.clear();
  game.hud.setBoss?.(null);
  for (const j of m.K?.jobs || []) j.job?.cancel?.();
  m.K = null;
  const kp = Kp(game); kp.model.setPose(null); kp.show(false);
}
// he rises in the middle of the clearing: a short look at him, the banner, his name on the bar
function rise(m, game) {
  const Q = GROVE(game), A = Q.arena, kp = Kp(game), me = game.player.pos, K = m.K;
  K.phase = 'rise';
  kp.floorY = null; kp.target = null; kp.idle = null; kp.posed = false; kp.model.setPose(null);
  kp.place(A.centre.x, A.centre.z, yawTo(A.centre, me), Q.y); kp.show(true);
  m.foe = game.energy.foe({
    npc: kp, hp: HP, name: KEEPER, hint: 'הצבע לא נדבק · לחשוף את נקודת התורפה', downPose: 'down',
    onHurt: (f) => hurt(m, game, f), onDown: () => burst(m, game),
    onFound: () => anchorsOn(m, game), onCopy: () => copyShot(m, game),
  });
  m.foe.fade(0); m.foe.show(false);
  m.foe.teleport({ x: A.centre.x, z: A.centre.z, y: Q.y, yaw: yawTo(A.centre, me) }, { out: 0.01, wait: 1.0, into: 0.9 });
  game.sound?.thunder?.(0.5); game.follow.shake(0.25);
  game.sound?.music?.('action', { fade: 0.8 });
  game.hud.banner('הקרחת', KEEPER, 'להתחמק · למצוא את האמיתי · להדליק את אבני העוגן', 3200);
  game.cutscene = true;
  say(m, game, C_GOAL);
  // the look at him from inside the clearing (the anchor stones stand farther out; no crown in the way)
  const c = A.centre, a = angOf(game, me) + 0.45, cam = { x: c.x + Math.sin(a) * 7.2, y: Q.y + 1.9, z: c.z + Math.cos(a) * 7.2 };
  m.beats = beats(game, [
    ['do', () => game.follow.shot(cam, { x: c.x, y: Q.y + 2.1, z: c.z }, 9999)],
    ['wait', 2.0],
    ['say', WHAT],
    ['do', () => { game.follow.override = null; game.follow.snapBehind(yawTo(game.player.pos, c)); game.player.yaw = yawTo(game.player.pos, c); game.cutscene = false; dodgeOn(m, game); later(m, DODGE); }],
  ]);
}
function dodgeOn(m, game) {
  const K = m.K, e = game.npc('erez');
  K.phase = 'dodge'; K.left = K.round ? 5 : 4; K.atk = 1.0; K.i = 0;
  if (m.foe) { m.foe.vulnerable = false; m.foe.hideWeak(); }
  runTo(game, 'erez', arenaPost(game, angOf(game, game.player.pos) + 1.2), { label: 'מכסה', face: GROVE(game).arena.centre });
  e.model.setPose(null);
}
function attack(m, game, kind) {
  const foe = m.foe, Q = GROVE(game), me = game.player.pos; if (!foe || foe.down || foe.teleporting) return;
  if (kind === 'ring') foe.ring({ at: { x: me.x, z: me.z, y: Q.y }, r: 2.2, warn: 1.4 });
  else if (kind === 'bolt') foe.shoot({ speed: 6.5, warn: 0.9, r: 0.42 });
  else if (kind === 'double') { // one where he stands, one where he is heading
    const v = game.player.vel || { x: 0, z: 0 }, s = Math.hypot(v.x, v.z) || 1;
    foe.ring({ at: { x: me.x, z: me.z, y: Q.y }, r: 2.0, warn: 1.5 });
    foe.ring({ at: { x: me.x + (v.x / s) * 3.4, z: me.z + (v.z / s) * 3.4, y: Q.y }, r: 1.8, warn: 1.7 });
  }
}
// at Erez while he draws him off: nothing that can reach Nehorai unless he stands right there
function atErez(m, game, k) {
  const foe = m.foe, e = game.npc('erez'), Q = GROVE(game); if (!foe || foe.down || foe.teleporting) return;
  if (k % 2) foe.ring({ at: { x: e.pos.x, z: e.pos.z, y: Q.y }, r: 1.5, warn: 1.2 });
  else game.energy.bolt({ from: { x: foe.pos.x, y: foe.pos.y + foe.core, z: foe.pos.z }, target: e, speed: 7.5, warn: 0.5, hit: 'call', color: foe.color });
}
function hop(m, game) { // away to another of the clearing's spots, the one farthest from where he is
  const A = GROVE(game).arena, foe = m.foe; if (!foe || foe.teleporting) return;
  const s = A.spots.filter((p) => dist(p, foe.pos) > 3).sort((a, b) => dist(b, foe.pos) - dist(a, foe.pos))[Math.floor(Math.random() * 2)];
  if (s) foe.teleport({ x: s.x, z: s.z, y: GROVE(game).y });
}
function copiesOn(m, game) {
  const K = m.K, foe = m.foe, A = GROVE(game).arena, me = game.player.pos;
  K.phase = 'copies'; K.spotT = 0; K.spotted = false; K.atk = 2.5;
  const n = K.round ? 3 : 2;
  const spots = A.spots.filter((p) => dist(p, foe.pos) > 2.5 && dist(p, me) > 4).sort(() => Math.random() - 0.5).slice(0, n + 1);
  foe.spawnCopies(n, spots);
  game.sound?.zap?.(0.5, 0.7);
}
function copyShot(m, game) { // a copy popped: the real one answers with a bolt (warned), and Erez has seen enough
  const K = m.K; if (!K) return;
  K.spotT = Math.max(K.spotT, 9);
  m.foe?.shoot({ speed: 6.5, warn: 0.75, r: 0.42 });
}
function anchorsOn(m, game) {
  const K = m.K, Q = GROVE(game); if (!K || K.phase !== 'copies') return;
  K.phase = 'anchors'; K.called = false; K.jobs = []; K.atk = 1.6;
  for (const a of Q.arena.anchors) a.light(false);
  later(m, ANCHORS);
  drawOff(m, game);
}
function drawOff(m, game) { // Erez goes round to the far side and takes his attention
  const foe = m.foe; if (!foe) return;
  runTo(game, 'erez', arenaPost(game, angOf(game, game.player.pos) + Math.PI, 7.8), { label: 'מסיח אותו', face: foe.pos });
}
function callErez(m, game) { // the two unlit stones farthest from Nehorai are Erez's, one after the other
  const K = m.K, Q = GROVE(game), me = game.player.pos;
  K.called = true; K.atk = 1.5;
  later(m, CALL);
  const mine = Q.arena.anchors.filter((a) => !a.lit).sort((a, b) => dist(b, me) - dist(a, me)).slice(0, 2);
  K.jobs = mine.map((a) => ({ a, job: null }));
  nextJob(m, game);
}
function nextJob(m, game) {
  const K = m.K; if (!K) return;
  const j = K.jobs.find((x) => !x.job && !x.a.lit); if (!j) return;
  const a = j.a;
  j.job = new Job(game, { who: 'erez', at: { ...a.at }, seconds: 1.4, label: 'אבן עוגן', pill: 'ארז מדליק אבן', onDone: () => { if (!m.K) return; lightAnchor(m, game, a); nextJob(m, game); } });
}
function lightAnchor(m, game, a) {
  if (a.lit) return;
  a.light(true);
  game.sound?.chime?.(true); game.energy?.sparks(a.x, (a.y ?? GROVE(game).y) + 1.4, a.z, CYAN, 20, 3);
  const n = GROVE(game).arena.anchors.filter((x) => x.lit).length;
  game.hud.toast(`אבני עוגן · ${n}/4`, 1600);
  if (n === 4) weakOn(m, game);
}
function weakOn(m, game) {
  const K = m.K; if (!K || !m.foe) return;
  for (const j of K.jobs) j.job?.cancel?.(); K.jobs = [];
  K.phase = 'weak'; K.atk = 2.6;
  m.foe.clearCopies();
  m.foe.exposeWeak(600);
  later(m, WEAK);
  runTo(game, 'erez', arenaPost(game, angOf(game, game.player.pos) + 1.4, 7.6), { label: 'יורה', face: m.foe.pos });
}
function hurt(m, game, f) {
  const K = m.K; if (!K) return;
  if (K.round === 0 && f.hp <= HALF && !f.down) { // the first round is over: the stones go out, and he starts again
    f.hideWeak();
    for (const a of GROVE(game).arena.anchors) a.light(false);
    K.round = 1;
    game.follow.shake(0.3); game.sound?.thunder?.(0.4);
    later(m, AGAIN);
    hop(m, game);
    dodgeOn(m, game);
  }
}
// he goes out as light: a flash, the sparks, a crack of thunder; the crystal rises where he stood
function burst(m, game) {
  const K = m.K, Q = GROVE(game), kp = Kp(game), at = { x: kp.pos.x, z: kp.pos.z }; if (!K) return;
  K.phase = 'burst'; K.down = true;
  game.energy.clear();
  for (const a of Q.arena.anchors) a.light(true);
  game.cutscene = true;
  m.beats = beats(game, [
    ['do', () => {
      game.follow.shot({ x: at.x + 5.5, y: Q.y + 2.6, z: at.z + 5.5 }, { x: at.x, y: Q.y + 1.8, z: at.z }, 9999);
      game.energy.sparks(at.x, Q.y + 2.0, at.z, '#ffffff', 40, 8); game.energy.sparks(at.x, Q.y + 1.4, at.z, CYAN, 30, 6);
      game.overlay?.flash?.('#eafcff', 900, 1); game.sound?.thunder?.(0.9); game.follow.shake(0.45);
    }],
    ['wait', 0.35],
    ['do', () => { m.foe?.dispose(); m.foe = null; kp.model.setPose(null); kp.show(false); game.hud.setBoss?.(null); game.sound?.music?.(null, { fade: 2.5 }); }],
    ['wait', 0.6],
    ['do', () => { m.crystal = makeCrystal(game, Q.crystalAt); game.sound?.chime?.(true); }],
    ['wait', 1.4],
    ['say', BURST],
    ['do', () => { game.follow.override = null; game.follow.snapBehind(game.player.yaw); game.cutscene = false; K.phase = 'over'; }],
  ]);
}
function cTick(m, game, dt) {
  const K = m.K, Q = GROVE(game), A = Q.arena, me = game.player.pos, e = game.npc('erez'), foe = m.foe; if (!K) return;
  m.beats?.update(dt);
  if (K.phase === 'walk') {
    if (dist(me, A.centre) < A.radius + 1.5) { rise(m, game); return; }
    say(m, game, `${C_GOAL} · להיכנס לקרחת`);
    return;
  }
  if (!foe || foe.down || game.cutscene || K.phase === 'rise') return;
  const kp = Kp(game), r2 = K.round ? ' · סיבוב שני' : '';
  const busyErez = K.phase === 'anchors' && !K.called;
  if (!foe.teleporting) { const t = busyErez ? e.pos : me; kp.lookAt(t.x, t.z); }
  K.atk -= dt; K.shot -= dt;
  // Erez puts paint on him from where he stands: it does not stick (the sparks show it), but it is his
  if (K.shot <= 0 && e.visible && !e.target && K.phase !== 'weak' && !(K.called && K.jobs.some((j) => j.job && !j.job.done))) {
    K.shot = busyErez ? 1.0 : 1.7;
    shotAt(game, e, { x: kp.pos.x, y: kp.pos.y + 1.6, z: kp.pos.z }, { spread: 0.04 });
    game.energy.sparks(kp.pos.x, kp.pos.y + 1.6, kp.pos.z, foe.color, 4, 2);
  }
  if (K.phase === 'dodge') {
    if (K.atk <= 0 && K.left > 0) {
      const seq = K.round ? ['double', 'bolt', 'ring', 'double', 'bolt'] : ['ring', 'bolt', 'ring', 'bolt'];
      attack(m, game, seq[K.i % seq.length]); K.i++; K.left--; K.atk = K.round ? 2.5 : 2.7;
      if (K.i % 2 === 0 && K.left > 0) K.hop = 1.6;
    }
    if (K.hop > 0 && (K.hop -= dt) <= 0) hop(m, game);
    if (K.left <= 0 && K.atk <= -0.6 && game.energy.active === 0 && !foe.teleporting) copiesOn(m, game);
    say(m, game, `${C_GOAL}${r2} · להתחמק מהאנרגיה (${K.left + (game.energy.active ? 1 : 0)})`);
  } else if (K.phase === 'copies') {
    K.spotT += dt;
    if (!K.spotted && K.spotT > 5) { K.spotted = true; later(m, SPOT); if (e.visible) shotAt(game, e, { x: kp.pos.x, y: kp.pos.y + 1.6, z: kp.pos.z }, { spread: 0 }); }
    if (K.atk <= 0) { K.atk = 3.6; if (!foe.teleporting) foe.shoot({ speed: 6.5, warn: 0.75, r: 0.42 }); }
    say(m, game, `${C_GOAL}${r2} · מי האמיתי? לסמן אותו${K.spotted ? ' · לאמיתי יש צל' : ''}`);
  } else if (K.phase === 'anchors') {
    for (const j of K.jobs) { if (j.job && !j.job.done) { if (j.a.lit) { j.job.cancel(); nextJob(m, game); } else j.job.update(dt); } }
    if (K.atk <= 0) {
      if (busyErez) { K.atk = 2.2; atErez(m, game, K.i++); }
      else { K.atk = 3.0; attack(m, game, K.i++ % 2 ? 'bolt' : 'ring'); }
    }
    const n = A.anchors.filter((a) => a.lit).length;
    say(m, game, `${C_GOAL}${r2} · להדליק את אבני העוגן (${n}/4)${K.called ? ' · ארז על שתיים' : ' · ארז מסיח אותו · אפשר לקרוא לו'}`);
  } else if (K.phase === 'weak') {
    if (K.atk <= 0) { K.atk = 3.4; attack(m, game, 'ring'); }
    say(m, game, `${C_GOAL}${r2} · לסמן את נקודת התורפה!`);
  }
}
function cTarget(m, game) {
  const K = m.K, Q = GROVE(game), A = Q.arena, me = game.player.pos, foe = m.foe; if (!K) return null;
  if (K.phase === 'walk') return dist(me, A.entry) > 3 && dist(me, A.centre) > A.radius + 2 ? { ...A.entry, r: 1.2 } : { ...A.centre, r: 1.2 };
  if (K.phase === 'over' || K.phase === 'burst') return m.crystal ? { ...Q.crystalAt, y: Q.y, r: 1.0 } : null;
  if (!foe) return null;
  const at = { x: foe.pos.x, z: foe.pos.z, y: Q.y, r: 1.2 };
  if (K.phase === 'copies') return K.spotted ? at : { ...A.centre, r: 1.2 };
  // in plain sight he needs no marker (its column would stand over him): the arrow only from farther off
  if (K.phase !== 'anchors' && dist(me, foe.pos) < 9) return null;
  if (K.phase === 'anchors') {
    const theirs = K.called ? K.jobs.map((j) => j.a) : [];
    const a = A.anchors.filter((x) => !x.lit && !theirs.includes(x)).sort((p, q) => dist(p.at, me) - dist(q.at, me))[0] || A.anchors.find((x) => !x.lit);
    return a ? { ...a.at, r: 0.9 } : at;
  }
  return at;
}
function cPrompt(m, game) {
  const K = m.K, Q = GROVE(game), me = game.player.pos; if (!K || game.mode !== 'foot' || game.player.busy) return null;
  if (K.phase === 'anchors') {
    const a = Q.arena.anchors.find((x) => !x.lit && near(me, x.at, 1.7));
    if (a) return { label: 'להדליק את אבן העוגן', priority: 7, run: () => lightAnchor(m, game, a) };
    if (!K.called && Q.arena.anchors.filter((x) => !x.lit).length >= 2) return { label: 'לקרוא לארז · שתי אבנים', priority: 3, run: () => callErez(m, game) };
  }
  return null;
}

// ---------- the whole scene of a checkpoint ----------
// everything this mission made, put away (a restore, a cleanup)
function putAway(m, game) {
  m.beats?.cancel(); m.beats = null;
  aOff(m, game); bOff(m, game); cOff(m, game);
  m.crystal?.dispose(); m.crystal = null;
  if (game.player.scripted === m) game.player.release(m);
  game.nehorai?.setPose?.(null);
  const e = game.npc('erez'); e.floorY = null; e.model.setPose(null);
  game.sound?.radioStatic?.(false);
  game.overlay?.notice?.(null);
}
// cp 1: the two by the first wall where 52 left them; cp 2: on the bank where the broken path begins, the three
// symbols lit and the walls open; cp 3: at the way into the Keeper's clearing, the bridge up behind them
function stage(m, game, cp) {
  const Q = GROVE(game), bp = Q.brokenPath;
  putAway(m, game);
  clearAll(m, game);
  inGrove(game, { open: cp >= 2 ? 3 : 0 });
  if (cp >= 3) bp.bridge.set(true, true);
  const at = cp >= 3 ? { ...Q.arena.entry, yaw: yawTo(Q.arena.entry, Q.arena.centre) } : cp >= 2 ? { ...bp.start, yaw: -Math.PI / 2 } : groveWall(game);
  pairAt(game, at);
  game.squad.release('erez');
  game.player.crawl(false);
  hurtLook(game, 0, 0);
  game.paint.reset(); game.hud.paintClear();
  game.sound?.music?.(null, { fade: 0.3 });
  m.s = { cp, staged: true };
}
// a live hand-over from mission 52: in the grove's dimension, the two of them at the first wall, his marker in hand
const carriedIn = (game) => game.dimensionName === 'grove' && GROVE(game).isDimension() && game.mode === 'foot' && game.paint.armed && game.npc('erez').visible && near(game.player.pos, groveWall(game), 10);

export default {
  id: 'secret', chapter: 10, number: 7, title: 'סוד החורשה', requires: ['grove'], follows: true, secret: true,
  where: 'בחורשת הזיתים',
  startAt: (game) => (game.world.places.grove ? { ...groveWall(game) } : null),
  reward: { money: 1200, text: 'הגביש בידיים · הקשר חוזר · 1,200 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.talk = []; },
  // the start, from anywhere: on the path at the first wall of energy (step 0 brings the grove's dimension round it)
  prepareReplay(game) {
    if (game.mode === 'car') game.exitCar();
    if (game.playingAs !== 'nehorai') game.playAs('nehorai');
    const p = groveWall(game); game.player.place(p.x, p.z, p.yaw, p.y); game.follow.snapBehind(p.yaw);
  },
  failIf(m, game) {
    if (m.stepIndex === 2 && game.paint.hits >= OUT_AT) return LOST_B;
    if (m.stepIndex === 3 && !m.K?.down && game.paint.hits >= OUT_AT) return LOST_C;
    return null;
  },
  restore(m, game, cp) { stage(m, game, cp); },
  tick(m, game, dt) { hush(game); talkOn(m, game); m.crystal?.update(dt); },
  cleanup(m, game) {
    if (m.done && handsTo(game, 'gateback')) { // 54 takes it from here: the two in the grove, the dimension on, the radio back
      m.beats?.cancel(); m.beats = null; m.talk = [];
      aOff(m, game); bOff(m, game); cOff(m, game);
      m.crystal?.dispose(); m.crystal = null;
      if (game.player.scripted === m) game.player.release(m);
      game.sound?.radioStatic?.(false);
      game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
      return;
    }
    putAway(m, game);
    clearAll(m, game);
    game.dimension(null); game.rift.clear(); GROVE(game).reset(); game.rift.static = false;
    bandage(game.nehorai, false); armWrap(game.nehorai, false);
    game.sound?.music?.(null, { fade: 0.6 });
    endCrew(game);
  },
  complete(m, game) { m.done = true; },

  steps: [
    { // 0: the walkie-talkie: static; the notice; the lines
      objective: 'לנסות את מכשיר הקשר',
      enter(m, game) {
        if (!m.s.staged && !carriedIn(game)) stage(m, game, 1);
        game.rift.static = true;
        game.squad.release('erez');
        m.s.p = 'ready';
      },
      target(m, game) { return m.s.p === 'ready' ? { ...game.player.pos, r: 0.8 } : null; },
      interaction(m, game) {
        if (m.s.p !== 'ready') return null;
        return { label: 'לנסות את מכשיר הקשר', priority: 8, run: () => {
          const live = attempt(game, m);
          m.s.p = 'static';
          game.cutscene = true;
          game.nehorai.setPose('phone');
          game.sound?.radioStatic?.(true, { level: 0.16 });
          game.hud.toast('קשר · אין קליטה', 2200);
          m.beats = beats(game, [
            ['say', TRY],
            ['do', () => { if (!live()) return; m.s.notice = CARDS.dimension; game.overlay?.notice?.(CARDS.dimension, 3.6); }],
            ['wait', 2.6],
            ['do', () => { game.sound?.radioStatic?.(false, { seconds: 1.2 }); game.nehorai.setPose(null); }],
            ['wait', 1.2],
            ['say', [L.secret.mustReturn, L.secret.withYou]],
          ]);
        } };
      },
      update(m, game, dt) { m.beats?.update(dt); return m.s.p === 'static' && m.beats?.done && !game.dialogue.busy ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.nehorai.setPose(null); game.sound?.radioStatic?.(false); },
    },
    { // 1 (cp): a. the three symbols, each opening the next part of the map
      objective: `${A_GOAL} (0/3)`, checkpoint: true,
      enter(m, game) {
        aOn(m, game);
        game.paint.hits = 0; game.hud.paintClear();
        if (m.A.n === 0) later(m, BOULDER);
        birds(game, 2);
      },
      target(m, game) { return aTarget(m, game); },
      interaction(m, game) { return aPrompt(m, game); },
      update(m, game, dt) {
        aTick(m, game, dt);
        return m.A?.n >= 3 && !m.talk.length && !game.dialogue.busy ? 'next' : null;
      },
      exit(m, game) { aOff(m, game); },
    },
    { // 2 (cp): b. the broken-reality path
      objective: B_GOAL, checkpoint: true,
      enter(m, game) {
        const Q = GROVE(game);
        for (let i = 0; i < 3; i++) { Q.symbols[i].light(true); Q.seals[i].open(true); }
        game.paint.hits = 0; game.hud.paintClear();
        bOn(m, game);
      },
      target(m, game) { const p = bPlan(m, game).to; return p ? { x: p.x, z: p.z, y: p.y, r: 0.9 } : null; },
      interaction(m, game) { return m.kit?.interaction(game) || null; },
      update(m, game, dt) { bTick(m, game, dt); return bDone(m, game) ? 'next' : null; },
      exit(m, game) { bOff(m, game); },
    },
    { // 3 (cp): c. the Threshold Keeper, three modes, twice round; he bursts into light, the crystal appears
      objective: C_GOAL, checkpoint: true,
      enter(m, game) {
        const Q = GROVE(game), e = game.npc('erez'), me = game.player.pos;
        game.paint.hits = 0; game.hud.paintClear();
        for (const a of Q.arena.anchors) a.light(false);
        // Erez with him (a friend left on a stone that went is brought over)
        if (!e.visible || dist(e.pos, me) > 5 || Math.abs(e.pos.y - me.y) > 1) { const p = clearSpot(game, { x: me.x + 1.2, z: me.z + 0.8, y: Q.y }); e.place(p.x, p.z, game.player.yaw, Q.y); e.show(true); }
        game.squad.release('erez');
        cOn(m, game);
      },
      target(m, game) { return cTarget(m, game); },
      interaction(m, game) { return cPrompt(m, game); },
      update(m, game, dt) { cTick(m, game, dt); return m.K?.phase === 'over' && !game.dialogue.busy ? 'next' : null; },
      exit(m, game) { m.beats = null; game.cutscene = false; game.follow.override = null; },
    },
    { // 4: the crystal; the radio crackles back to life. 54 carries on
      objective: 'לאסוף את הגביש',
      enter(m, game) {
        const Q = GROVE(game);
        if (!m.crystal) m.crystal = makeCrystal(game, Q.crystalAt);
        m.K = null; m.s.p = 'crystal';
        game.squad.release('erez');
      },
      // (the marker's column would hide the crystal close up: within reach the prompt takes over)
      target(m, game) { const c = GROVE(game).crystalAt; return m.s.p === 'crystal' && !near(game.player.pos, c, 2.6) ? { x: c.x, z: c.z, y: GROVE(game).y, r: 1.0 } : null; },
      interaction(m, game) {
        const c = GROVE(game).crystalAt;
        if (m.s.p !== 'crystal' || game.mode !== 'foot' || !near(game.player.pos, c, 1.8)) return null;
        return { label: 'לאסוף את הגביש', priority: 8, run: () => {
          m.s.p = 'taken';
          game.cutscene = true;
          game.player.yaw = yawTo(game.player.pos, c);
          game.nehorai.setPose('reach');
          game.sound?.chime?.(true);
          m.beats = beats(game, [
            ['wait', 0.4],
            ['do', () => { game.nehorai.setPose(null); m.crystal?.dispose(); m.crystal = null; game.energy?.sparks(c.x, c.y, c.z, CYAN, 18, 2); game.hud.pop('הגביש', 'counter'); }],
            ['say', WARM],
            ['do', () => { game.sound?.radioStatic?.(true, { level: 0.2 }); game.hud.toast('קשר · …קליטה!', 2600); game.rift.static = false; m.s.crackled = true; }],
            ['wait', 1.4],
            ['say', CRACKLE],
            ['do', () => game.sound?.radioStatic?.(false, { seconds: 1.5 })],
          ]);
        } };
      },
      update(m, game, dt) { m.beats?.update(dt); return m.s.p === 'taken' && m.beats?.done && !game.dialogue.busy ? 'next' : null; },
    },
  ],
};
