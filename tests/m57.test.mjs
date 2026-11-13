// Mission 57, END OF THE SHADOW, played on a phone page from a placed save (chapter ten with 47–56 done): the
// meeting in the last hall and its four lines; phase one, the armoured Shadow — three marks and a retry, then the
// three shields, each with its own deed (the core shot while the shutters are open, the console's code as Muller
// reads it on the keypad, his own bolt let by into the rods with a step aside); phase two, the broken dimension —
// a reload in the middle picked up at its checkpoint, three marks and a retry, then the real one found among his
// copies (Muller marks him, Erez and Ido pop the copies) and marked until his system gives; phase three, the last
// fist fight with the buttons — knocked out once and a retry, then won (Erez and Ido step in); the end: the five
// lines, the portal system dead, the Shadow tied, and mission 58 beginning. Every quoted line is compared with
// lines10.js. Shortcuts, said plainly: the test zeroes the player's marks while it works a deed or shoots (his
// attacks keep coming; dodging them is not what is tested there), and aims the marker by turning the player.
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const E = L.endshadow;
const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return', 'laststand'];
const t = await openStage({ chapter: 10, done: DONE, first: 'endshadow' });
const { check, S, G, step, until, talkThrough, said, interact, tp, fight, snap, press, page, text, objective, listen, heard } = t;
const heardLine = (l) => said(l[1], l[0]);

const helpers = () => G(() => {
  const g = window.__game.debug.game, pt = (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw };
  window.__m57 = {
    hall() { const h = g.world.places.citadel.lastHall, G = h.generators; return { y: h.y, from: pt(G[0].from), core: pt(G[0]), console: pt(G[1].consoleAt), lure: pt(G[2].lureAt), gen2: pt(G[2]), duel: pt(h.duel) }; },
    m() { return g.missions.active; },
    foe() { const m = g.missions.active, f = m?.foe, sh = g.npc('shadow'); return { armor: !!sh.model.armor, visible: sh.visible, ...(f ? { x: f.pos.x, z: f.pos.z, y: f.pos.y, hp: f.hp, down: f.down, shields: f.shields.map((s) => s.up), copies: f.copies, tp: f.teleporting } : {}) }; },
    aim(p) { const me = g.player.pos, yaw = Math.atan2(p.x - me.x, p.z - me.z); g.player.yaw = yaw; g.follow.snapBehind(yaw); },
    lock() { const L = g.paint.lock, f = g.missions.active?.foe; if (!L) return null; if (!f) return 'other'; return L === f.body ? 'body' : f.shields.some((s) => s.target === L) ? 'gen' : 'other'; },
    zero() { g.paint.hits = 0; g.hud.paintClear(); },
    end() { const h = g.world.places.citadel.lastHall, sh = g.npc('shadow'); return { engine: h.engine.mode, tied: !!sh.model.bones?.chest?.getObjectByName('ropes'), shadow: sh.visible, armed: !!g.paint.armed, allies: g.paint.allies.length }; },
  };
});
await helpers();
const foe = () => G(() => window.__m57.foe());
const zero = () => G(() => window.__m57.zero());
const ms = () => G(() => { const m = window.__m57.m(); return m ? { id: m.def.id, step: m.stepIndex, ...Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) } : null; });

// ---------- 0: the meeting ----------
let s = await until((s) => s.mission?.id === 'endshadow' && s.mission.step === 0, 30, 'mission 57');
check('mission 57 begins by itself from the save (47–56 done)', !!s);
check('its first goal on screen', /הצל באולם האחרון/.test(s?.objective || ''), s?.objective);
await step(1.2);
await snap('m57-meet');
s = await talkThrough((s) => s.mission?.step === 1, 150, 'the meeting');
check('the meeting: "' + E.shadowPower[1] + '"', heardLine(E.shadowPower));
check('the meeting: "' + E.forgot[1] + '" / "' + E.shadowWhat[1] + '"', heardLine(E.forgot) && heardLine(E.shadowWhat));
check('the meeting: "' + E.notAlone[1] + '" (after a look at the gang)', heardLine(E.notAlone));
let f = await foe();
check('the suit closes over him', f.armor && f.visible, JSON.stringify(f));

// ---------- 1: phase one ----------
check('phase one: its goal with the shield count', await objective(1, /שלב 1 · הצל המשוריין · מגנים \(0\/3\)/));
check('phase one is a checkpoint (saved)', (await G(() => window.__game.debug.game.progress.resume)).checkpoint === 1);
f = await foe();
check('three shields up, his bubble on', f.shields?.length === 3 && f.shields.every(Boolean), JSON.stringify(f.shields));
// a forced fail: two marks already, then standing still in his attacks (each warned) until the third
await G(() => { window.__game.debug.game.paint.hits = 2; });
s = await until((s) => s.fail, 40, 'the third mark');
const why1 = s ? await text('#failReason') : '';
check('three marks fail phase one, with a reason and a tip', !!s && /שלוש פעמים/.test(why1) && /טבעת/.test(why1), why1);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 1 && !s.fail && s.hits === 0, 15, 'the retry');
check('the retry starts phase one again at its checkpoint', !!s);
const Hh = await G(() => window.__m57.hall());

// (a) the core: from its spot, shot while the shutters are up
await tp(Hh.from);
let shots = 0, sawShut = false, sawOpen = false;
for (let i = 0; i < 80; i++) {
  await zero();
  const st = await G(() => { const m = window.__m57.m(); return { open: !!m.s.shutter, up: m.foe.shields[0].up }; });
  if (!st.up) break;
  if (st.open) sawOpen = true; else sawShut = true;
  await G((p) => window.__m57.aim(p), Hh.core);
  await step(0.1);
  if (st.open && (await G(() => window.__m57.lock())) === 'gen') { if (!shots) await snap('m57-core'); await press('btnFire'); shots++; }
  await step(0.25);
}
f = await foe();
check(`shield 1/3: the core shot while its shutters were open (${shots} pellets; shutters seen shut and open)`, f.shields && !f.shields[0] && sawShut && sawOpen, JSON.stringify({ shields: f.shields, me: (await S()).me, core: Hh.core }));
check('the goal counts it', /מגנים \(1\/3\)/.test((await S()).objective), (await S()).objective);

// (b) the console: Muller reads the code over the radio, typed on the keypad
await zero();
await tp(Hh.console);
check('"לעבוד על הקונסולה" at the console', await interact('לעבוד על הקונסולה'));
const code = (await ms()).code;
await step(0.3); await listen();
check(`Muller reads the code (${code}) over the radio`, !!code && heard.some((l) => l.startsWith('מולר: ') && l.includes(code.split('').join(', '))), heard.slice(-2).join(' | '));
for (const d of code || '') { await page.dispatchEvent(`#keypad button[data-d="${d}"]`, 'pointerdown'); await step(0.05); }
await page.waitForTimeout(900); await step(0.3);
f = await foe();
check('shield 2/3: the caged generator off with the keypad', f.shields && !f.shields[1], JSON.stringify(f.shields));

// (c) the rods: on the plate, his bolt lined up through Nehorai — a step aside lets it into the rods
await zero();
await tp(Hh.lure);
const lined = await until(async () => (await ms())?.lure === 'bolt', 20, 'his bolt lined up');
check('on the plate he comes round and gathers a bolt (warned: its lane on the floor)', !!lined);
await tp(Hh.lure, 2.8, 0);
await zero();
const rods = await until(async () => { const q = await foe(); return !q.shields || !q.shields[2]; }, 10, 'the rods');
check('shield 3/3: his own bolt into the conductor rods', !!rods);
s = await talkThrough((s) => s.mission?.step === 2, 30, 'phase two');
check('the friends had their say in phase one (Erez, Ido, Muller)', said('הליבה למעלה נפתחת כל כמה שניות. כשהתריסים עולים — לירות!', 'ארז') && said('המחולל השני בכלוב, והקונסולה נעולה בקוד. מולר, תן לו ספרות!', 'עידו'));

// ---------- 2: phase two ----------
check('phase two: its goal', await objective(2, /שלב 2 · הממד השבור/));
let st2 = await G(() => { const m = window.__m57.m(); return { portals: m.portals.length, fields: m.fields.length, engine: window.__game.debug.game.world.places.citadel.lastHall.engine.mode }; });
check('rifts torn in the hall, the floor changing (fields that stop time), the engine overloaded', st2.portals === 4 && st2.fields === 2 && st2.engine === 'overload', JSON.stringify(st2));
// a reload in the middle: picked up at this checkpoint on a fresh page
s = await t.reload();
await helpers();
s = await until((s) => s.mission?.id === 'endshadow' && s.mission.step === 2, 30, 'the pick-up');
f = await foe();
check('a reload in phase two picks up at its checkpoint (the dimension broken again, the suit on)', !!s && f.armor && (await G(() => window.__m57.m().portals.length)) === 4, JSON.stringify(f));
await until(async () => (await foe()).copies > 0, 12, 'his copies');
await step(1.0);
await G(async () => { const f = window.__m57.foe(); if (f.x) window.__m57.aim(f); });
await step(0.1);
await snap('m57-copies');
// a forced fail: three marks
await G(() => { window.__game.debug.game.paint.hits = 2; });
s = await until((s) => s.fail, 40, 'the third mark');
const why2 = s ? await text('#failReason') : '';
check('three marks fail phase two, with a reason and a tip', !!s && /צל/.test(why2) && /מולר/.test(why2), why2);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 2 && !s.fail && s.hits === 0, 15, 'the retry');
check('the retry starts phase two again at its checkpoint', !!s);
let fired = 0;
for (let i = 0; i < 400; i++) {
  await zero();
  const m = await ms(); if (!m || m.step !== 2 || m.p !== 'fight') break;
  const q = await foe(); if (!q.x || q.down) break;
  if (q.tp) { await step(0.2); continue; }
  const me = (await S()).me, d = Math.hypot(q.x - me.x, q.z - me.z);
  if (d > 13) { await tp({ x: q.x + (me.x - q.x) / d * 8, z: q.z + (me.z - q.z) / d * 8, y: q.y }, 0, 0, null, { max: 12 }); continue; }
  await G((p) => window.__m57.aim(p), q);
  await step(0.1);
  if ((await G(() => window.__m57.lock())) === 'body') { await press('btnFire'); fired++; }
  await step(0.3);
}
s = await talkThrough((s) => s.mission?.step === 3, 30, 'phase three');
check(`phase two: the real one marked until his system gave (${fired} pellets)`, !!s);
await listen();
check('Muller marked the real one over the radio; Erez and Ido flanked and popped copies', said('האמיתי — זה שסימנתי לכם! החתימה שלו לא משקרת.', 'מולר') && (said('מזויף! הבא בתור.', 'ארז') || said('גם זה מזויף. כמה הוא צריך?', 'עידו')));

// ---------- 3: phase three ----------
check('phase three: its goal', await objective(3, /שלב 3 · פנים אל פנים/));
s = await until((s) => !!s.fight, 30, 'the fight');
f = await foe();
check('the suit broken off, fists up (no marker in hand)', !f.armor && !(await S()).armed);
await step(0.6);
await snap('m57-fight');
// a forced fail: one hit from the end, and no guard up
await G(() => { window.__game.debug.game.fighter.hp = 1; });
s = await until((s) => s.fail, 40, 'his punch');
const why3 = s ? await text('#failReason') : '';
check('knocked out: the fight fails with a reason and a tip', !!s && /הצל הפיל אותך/.test(why3), why3);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 3 && !!s.fight && !s.fail, 30, 'the retry');
check('the retry starts the fist fight again at its checkpoint', !!s);
const r = await fight(420, 'the last fight', { boss: true });
check(`the last fist fight won with the buttons (combos ${r.combos}, heavies ${r.heavies}, specials ${r.specials}, counters ${r.counters})`, r.won, JSON.stringify(r.s?.mission));
check('the special attack and the timed openings in it', r.specials > 0 || r.counters > 0, `specials ${r.specials}, counters ${r.counters}`);
await listen();
check('Erez and Ido stepped in for a moment each', said('תפסתי לו את היד — עכשיו!', 'ארז') && said('סליחה שאני מפריע. תמשיך!', 'עידו'));

// ---------- 4: the end ----------
s = await until((s) => s.mission?.step === 4 || s.mission?.id !== 'endshadow', 20, 'the end');
check('he goes down: the last scene', s?.mission?.step === 4 && /הצל על הרצפה/.test(s.objective), s?.objective);
s = await talkThrough((s) => s.mission?.id !== 'endshadow' || heard.some((l) => l.startsWith('אברהם: ')), 120, 'the tying');
await step(0.4);
await snap('m57-tied');
s = await talkThrough((s) => s.mission?.id !== 'endshadow', 60, 'the hand-over');
for (const k of ['shadowHow', 'separate', 'didntWork', 'badEnemies', 'over']) check(`the end: ${E[k][0]}: "${E[k][1]}"`, heardLine(E[k]));
check('Muller kills the portal system; Avraham and Dolev tie him', said('מערכת הפורטלים — מושבתת. אין לו לאן לברוח.', 'מולר') && said('קשור. הוא לא הולך לשום מקום.', 'אברהם'));
const end = await G(() => window.__m57.end());
check('beaten for good: tied, the portal engine dead, the gang armed again', end.tied && end.engine === 'dead' && end.shadow && end.armed && end.allies >= 6, JSON.stringify(end));
s = await until((s) => s.mission?.id === 'zerohour', 20, 'mission 58');
check('mission 58 (zerohour) begins: the hand-over', !!s, s?.mission?.id);
check('57 is saved as done', await G(() => window.__game.debug.game.progress.done.includes('endshadow')));

await t.finish();
