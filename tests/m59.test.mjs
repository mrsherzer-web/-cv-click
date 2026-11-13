// Mission 59, HOMEWARD BOUND, played on a phone page from a placed save (chapter ten with 47–58 done): sunset on the
// access road some 250 m before Katzir's way in, on foot, no markers out, the whole gang along; a forced fail
// (walking off from the gang) and its retry at the first checkpoint; the talks with Ido, Erez and Muller with the real
// interact button (and everybody laughing), the others' word each on the way, walked with the stick; the noise ahead,
// the camera rising over the people of Katzir with the three signs; a reload in the middle of the walk through the
// people, picked up at its checkpoint, and a forced fail and retry there; through the cheering lane to the last spot
// (Ido: famous; Nehorai: all here); the last lines; the camera pulling away as the sun goes down; black; the three
// ending cards, the credits, THANK YOU FOR PLAYING.; the game saved as finished (chapter-10, the mark); no mission
// begins after it; the button back to the main menu, and the free roam from there. Every quoted line is compared
// with lines10.js. Shortcuts, said plainly: the ending's clock runs faster here (ENDING.speed), as in finale.test.
import { openStage, KEY } from './lib/stage.mjs';
import { L, CARDS, SIGNS } from '../src/missions/lines10.js';

const H = L.homeward;
const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return', 'laststand', 'endshadow', 'zerohour'];
const t = await openStage({ chapter: 10, done: DONE, first: 'homeward' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, page, text, objective, listen, heard, holdLoop, reload, jump, press } = t;
const retry = async () => { await page.tap('#retryBtn'); await holdLoop(true); };
const heardLine = (l) => said(l[1], l[0]);

const helpers = () => G(() => {
  const W = window.__game, g = W.debug.game;
  const TEAM = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  // the way home as the mission measures it: u = metres still to go on the access road, minus the main street's s inside
  const way = (u, off = 0) => { const q = u < 0 ? W.roadAt('דרך הגבעה', -u) : W.roadAt('כביש הגישה', u), b = u < 0 ? W.roadAt('דרך הגבעה', -u + 1) : W.roadAt('כביש הגישה', Math.max(0, u - 1)); const tx = b.x - q.x, tz = b.z - q.z, l = Math.hypot(tx, tz) || 1, x = q.x - tz / l * off, z = q.z + tx / l * off; return { x, z, y: W.groundAt(x, z), yaw: Math.atan2(tx, tz) }; };
  window.__m59 = {
    way,
    m() { return g.missions.active; },
    ms() { const m = g.missions.active; return m ? { id: m.def.id, step: m.stepIndex, ...Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')), heard: Object.keys(m.s.heard || {}).filter((k) => m.s.heard[k]) } : null; },
    where() { const p = g.player.pos; let best = null; for (let u = -80; u <= 330; u += 1) { const q = way(u), d = Math.hypot(q.x - p.x, q.z - p.z); if (!best || d < best.d) best = { u, d }; } return best; },
    scene() {
      const m = g.missions.active, c = m?.crowd, sh = g.npcs.get('shadow');
      return {
        as: g.playingAs, mode: g.mode, armed: !!g.paint.player, allies: g.paint.allies.length, guards: g.paint.guards.filter((x) => x.npc.visible && !x.marked).length,
        gang: TEAM.filter((id) => g.npc(id).visible && !g.npc(id).inCar).length, squad: g.squad.active ? g.squad.ids.length : 0, errands: g.squad.tasks.size,
        bandage: !!g.nehorai.bones?.head?.getObjectByName('bandage'), preset: g.daylight?.presetName ?? null, dim: g.dimensionName ?? null,
        shadow: !!sh?.visible, armoured: g.vehicles.some((v) => v.name === 'armoured') || !!g.scene.getObjectByName('armoured'), car: g.car.name,
        carHome: Math.hypot(g.car.pos.x - g.world.places.carSpot.x, g.car.pos.z - g.world.places.carSpot.z),
        crowd: c ? { size: c.people.length, level: +(c.target ?? c.level ?? 0).toFixed(2), signs: c.signs, painted: JSON.parse(c.canvas?.dataset?.signs || '[]'), holders: c.people.filter((p) => p.style === 'sign').length } : null,
        crowdMesh: !!g.scene.getObjectByName('crowd'),
      };
    },
    near(id) { const n = g.npc(id), p = g.player.pos; return Math.hypot(n.pos.x - p.x, n.pos.z - p.z); },
    pos(id) { const n = g.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y }; },
    cam() { const m = g.missions.active; return m?.cam ? { t: m.cam.t, dur: m.cam.dur } : null; },
    end() { const E = window.__game.finale.ENDING; return { phase: E.phase, log: E.log.slice(), skipped: E.skipped }; },
  };
});
await helpers();
const ms = () => G(() => window.__m59.ms());
const way = (u, off = 0) => G(({ u, off }) => window.__m59.way(u, off), { u, off });
const where = () => G(() => window.__m59.where());
const scene = () => G(() => window.__m59.scene());
const staged = (cp, max = 20) => until(async () => { const m = await ms(); return m?.id === 'homeward' && m.staged && m.cp === cp; }, max, `the scene at checkpoint ${cp}`);
// walked home with the stick, leg by leg along the road
async function walkTo(us, { stop = null } = {}) {
  for (const u of us) {
    const r = await tp(await way(u));
    if (r !== 'ok') return r;
    if (stop && (await stop())) return 'stopped';
  }
  return 'ok';
}
// a fail forced by walking off from the gang: 60 m off the road
async function walkOff(cp) {
  const w = await where(), p = await way(w.u, 60);
  await jump(p);
  const s = await until((s) => s.fail, 6, 'the fail');
  const why = s ? await text('#failReason') : '';
  check(`checkpoint ${cp}: walking off from the gang fails, with a reason and a tip`, !!s && /התרחקת מהחבורה/.test(why) && /ארז/.test(why), why);
  await retry();
  const ok = await staged(cp, 25);
  const w2 = await where(), sc = await scene();
  check(`checkpoint ${cp}: the retry stages it again (on the road, the gang with him, no markers)`, !!ok && w2.d < 4 && sc.gang === 8 && !sc.armed && sc.allies === 0, JSON.stringify({ w2, gang: sc.gang, armed: sc.armed }));
}

// ---------- 0: the road home at sunset ----------
check('the start screen offered to continue (a save at chapter ten)', /להמשיך|המשך/.test(t.startScreen), t.startScreen.slice(0, 60));
let s = await staged(0, 30);
check('59 begins by itself from the placed save, staged after its fade', !!s);
check('step 0: its goal "ללכת הביתה · לדבר עם החברים (0/3)"', await objective(0, /ללכת הביתה · לדבר עם החברים \(0\/3\)/));
let w = await where(), sc = await scene();
check('on the access road, some 250 m before the way in', Math.abs(w.u - 250) < 4 && w.d < 3, JSON.stringify(w));
check('sunset; the normal world; Nehorai on foot, himself, bandaged', sc.preset === 'sunset' && !sc.dim && sc.as === 'nehorai' && sc.mode === 'foot' && sc.bandage, JSON.stringify(sc));
check('the whole gang with him, nobody on an errand; no markers out, nobody to fight', sc.gang === 8 && sc.squad === 8 && sc.errands === 0 && !sc.armed && sc.allies === 0 && sc.guards === 0, JSON.stringify(sc));
check('what the citadel left is put away: no Shadow, no armoured wreck; the Renault home in its driveway', !sc.shadow && !sc.armoured && sc.car === 'renault' && sc.carHome < 3, JSON.stringify(sc));
check('the people of Katzir already at the way in (quiet), the three signs painted', sc.crowd && sc.crowd.size >= 60 && sc.crowd.level === 0 && JSON.stringify(sc.crowd.painted) === JSON.stringify(SIGNS) && sc.crowd.holders >= 9, JSON.stringify(sc.crowd));
const sides = await G(() => { const g = window.__game.debug.game, p = g.player.pos, y = g.player.yaw, rx = Math.cos(y), rz = -Math.sin(y), fx = Math.sin(y), fz = Math.cos(y); const at = (id) => { const n = g.npc(id); return { side: +((n.pos.x - p.x) * rx + (n.pos.z - p.z) * rz).toFixed(1), ahead: +((n.pos.x - p.x) * fx + (n.pos.z - p.z) * fz).toFixed(1) }; }; return { erez: at('erez'), ido: at('ido'), muller: at('muller') }; });
check('Erez and Ido at his shoulders, Muller behind', Math.abs(sides.erez.side) > 1 && Math.abs(sides.ido.side) > 1 && Math.sign(sides.erez.side) !== Math.sign(sides.ido.side) && sides.muller.ahead < -2.5, JSON.stringify(sides));
await snap('m59-road');
check('the arrow points at a friend to talk to', await G(() => { const g = window.__game.debug.game, tg = g.target; return !!tg && ['ido', 'erez', 'muller'].some((id) => Math.hypot(g.npc(id).pos.x - tg.x, g.npc(id).pos.z - tg.z) < 0.5); }));

await walkOff(0);

// the talks: whoever is nearest first, with the real button
const order = [];
for (let k = 0; k < 3; k++) {
  let ok = await interact(/^לדבר עם /, 6);
  if (!ok) { // step back to whoever is still waiting for a word
    const left = ['ido', 'erez', 'muller'].filter((id) => !order.includes(id));
    const near = await G((ids) => ids.map((id) => window.__m59.near(id)), left);
    await tp(await G((id) => window.__m59.pos(id), left[near.indexOf(Math.min(...near))]), 0, 0, null, { near: 1.5 });
    ok = await interact(/^לדבר עם /, 6);
  }
  const before = (await ms()).heard;
  s = await talkThrough(async () => (await ms()).heard.length > before.length, 30, `talk ${k + 1}`);
  const now = (await ms()).heard, who = now.find((id) => !before.includes(id));
  order.push(who);
  check(`talk ${k + 1}: "לדבר עם …" pressed, ${who} talked to`, ok && !!s && !!who, JSON.stringify(now));
  check(`the goal counts it: (${k + 1}/3)`, new RegExp(`\\(${k + 1}/3\\)|אל הכניסה לקציר`).test((await S()).objective), (await S()).objective);
}
for (const k of ['idoDone', 'erezHome', 'mullerPortal', 'iWasThere']) check(`the way home: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
check('everybody laughs (after Muller and Nehorai)', said('כולם צוחקים.'));
check('step 0 now says "ללכת הביתה · אל הכניסה לקציר"', /אל הכניסה לקציר/.test((await S()).objective), (await S()).objective);
check('the arrow now points down the road home', await G(() => { const g = window.__game.debug.game, tg = g.target; return !!tg && Math.hypot(tg.x - g.player.pos.x, tg.z - g.player.pos.z) > 10; }));

// the walk, with the stick; the others have a word each on the way
let r = await walkTo([228, 205, 182, 160, 140, 120, 100, 86], { stop: async () => (await S()).mission?.step !== 0 });
check(`walked home along the road with the stick (${r})`, r === 'ok' || r === 'a scene', r);
s = await talkThrough((s) => s.mission?.step === 1 || s.cutscene, 40, 'the noise ahead');
if (!s) { r = await tp(await way(86)); s = await talkThrough((s) => s.mission?.step === 1 || s.cutscene, 30, 'the noise ahead'); }
for (const [who, re] of [['יונתי', /צילמתי/], ['אברהם', /נואם/], ['דולב', /לקנות לחם/], ['הדר', /פנסיה/], ['ליאם', /הגלידה עליי/]]) check(`on the way: ${who} has his word about the road`, heard.some((l) => l.startsWith(`${who}: `) && re.test(l)));

// ---------- 1: a noise ahead; the people of Katzir ----------
check('step 1 begins near the way in (a noise ahead)', (await S()).mission?.step === 1 && (await where()).u <= 92, JSON.stringify(await where()));
s = await talkThrough(async (s) => s.mission?.step !== 1 || ((await G(() => window.__m59.cam()))?.t ?? 0) > 2.6, 40, 'the camera rising');
await snap('m59-crowd');
sc = await scene();
check('the people of Katzir clapping, the signs up (level ≥ 0.5, at least 60 people)', sc.crowd && sc.crowd.level >= 0.5 && sc.crowd.size >= 60, JSON.stringify(sc.crowd));
check('the signs say exactly what the spec says', JSON.stringify(sc.crowd.signs) === JSON.stringify(SIGNS) && JSON.stringify(sc.crowd.painted) === JSON.stringify(SIGNS), JSON.stringify(sc.crowd.painted));
s = await talkThrough((s) => s.mission?.step === 2, 40, 'step 2');
for (const k of ['noise', 'erezLook']) check(`the noise: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));

// ---------- 2: through the people (a reload in the middle, a fail and its retry) ----------
check('step 2: its goal "ללכת בין האנשים"', await objective(2, /ללכת בין האנשים/));
r = await tp(await way(62));
await reload();
await helpers();
s = await staged(2, 40);
w = await where(); sc = await scene();
check('the reload is picked up at checkpoint 2: before the lane, the gang along, the people cheering, sunset, the bandage, no markers', !!s && (await S()).mission?.step === 2 && Math.abs(w.u - 74) < 4 && sc.gang === 8 && sc.crowd?.level >= 0.7 && sc.preset === 'sunset' && sc.bandage && !sc.armed, JSON.stringify({ w, sc }));
await walkOff(2);
r = await walkTo([56, 40, 26, 12, 0, -12, -24]);
check(`through the cheering lane with the stick (${r})`, r === 'ok', r);
await snap('m59-lane');
r = await tp(await way(-37));
s = await talkThrough((s) => s.mission?.step === 3, 30, 'the end of the lane');
check('at the end of the lane, the last moment begins', !!s, JSON.stringify(await ms()));
for (const k of ['idoFamous', 'allHere']) check(`the lane: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));

// ---------- 3: the last moment ----------
s = await talkThrough(async (s) => s.mission?.step !== 3 || (heard.some((l) => l === `${H.together[0]}: ${H.together[1]}`) && ((await G(() => window.__m59.cam()))?.t ?? 0) > 4.5), 60, 'the pull-away');
await snap('m59-last');
const ring = await G(() => { const g = window.__game.debug.game, p = g.player.pos; return ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'].map((id) => Math.hypot(g.npc(id).pos.x - p.x, g.npc(id).pos.z - p.z)); });
check('the gang together round Nehorai before the crowd', ring.every((d) => d < 5.5), JSON.stringify(ring.map((d) => d.toFixed(1))));
for (const k of ['bestThing', 'erezWhat', 'notWon', 'together']) check(`the last moment: ${H[k][0]}: "${H[k][1]}"`, heardLine(H[k]));
check('the sun going down', await G(() => (window.__game.debug.game.daylight.target ?? 0) > 0.3));

// ---------- 4: the end ----------
s = await until((s) => s.mission?.step === 4 || s.mission == null, 30, 'black');
await G(() => { window.__game.finale.ENDING.speed = 8; });
check('the game is saved as finished before the cards', await G((k) => window.__game.debug.game.progress.finished === true && JSON.parse(localStorage.getItem(k) || 'null')?.finished === true, KEY));
await page.waitForFunction((c) => window.__game.finale.ENDING.log.includes(c), CARDS.legends, { timeout: 240000 });
let E = await G(() => window.__m59.end());
const iN = E.log.indexOf(CARDS.nahorai), iE = E.log.indexOf(CARDS.theEnd), iL = E.log.indexOf(CARDS.legends);
check('the cards on black, in order: NAHORAI FARHI, THE END, LEGENDS NEVER FIGHT ALONE', iN >= 0 && iE > iN && iL > iE, JSON.stringify(E.log));
await page.waitForFunction(() => window.__game.finale.ENDING.log.some((l) => /^moment:/.test(l)), null, { timeout: 240000 });
await snap('m59-credits');
await G(() => { window.__game.finale.ENDING.speed = 14; });
await page.waitForFunction(() => window.__game.finale.ENDING.phase === 'thanks', null, { timeout: 600000 });
E = await G(() => window.__m59.end());
check('the credits: live moments of the chapters, the cast, then the thanks', E.log.filter((l) => /^moment:/.test(l)).length >= 5 && E.log.includes('cast') && E.log.at(-1) === CARDS.thanks && !E.skipped, JSON.stringify(E.log));
check(`"${CARDS.thanks}" on the screen`, (await text('.ending-thanks-text')) === CARDS.thanks, await text('.ending-thanks-text'));
s = await until((s) => s.mission == null, 20, 'the mission completing behind the thanks');
const prog = await G((k) => { const g = window.__game.debug.game, p = g.progress, saved = JSON.parse(localStorage.getItem(k) || 'null'); return { done: p.done.includes('homeward'), unl: p.unlocks.includes('chapter-10'), fin: p.finished, saved: saved?.finished === true && saved.done.includes('homeward') && saved.unlocks.includes('chapter-10'), resume: p.resume }; }, KEY);
check('59 completes behind the thanks: done, chapter-10 unlocked, the finished mark saved', !!s && prog.done && prog.unl && prog.fin && prog.saved && !prog.resume, JSON.stringify(prog));
sc = await scene();
await step(4);
check('no mission begins after it (the free roam)', (await S()).mission == null, JSON.stringify({ m: (await S()).mission, next: await G(() => window.__game.debug.game.missions.next?.()?.id ?? null) }));
await snap('m59-thanks', { black: true });
await page.waitForSelector('.ending-menu:not([hidden])', { timeout: 120000 });
check('the button back to the main menu', (await text('.ending-menu')) === 'חזרה לתפריט הראשי', await text('.ending-menu'));
await page.tap('.ending-menu');
await page.waitForFunction(() => !document.getElementById('startScreen').hidden && !document.getElementById('ending'), null, { timeout: 30000 });
check('the main menu says the game is finished', /המשחק הושלם/.test((await text('#finishedLine')) || ''), await text('#finishedLine'));
sc = await G(() => { const g = window.__game.debug.game; return { crowd: !!g.scene.getObjectByName('crowd'), squad: g.squad.active, bandage: !!g.nehorai.bones?.head?.getObjectByName('bandage'), preset: g.daylight?.presetName ?? null, night: g.daylight?.target ?? 0 }; });
check('the ending gone: the crowd let go, the gang off duty, the bandage off, the light of the day back', !sc.crowd && !sc.squad && !sc.bandage && !sc.preset && sc.night === 0, JSON.stringify(sc));
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.started && document.getElementById('startScreen').hidden, null, { timeout: 30000 });
await holdLoop(true);
await step(4);
s = await S();
check('"להמשיך": the free roam, on foot, no mission running', s.mission == null && s.mode === 'foot' && !s.cutscene, JSON.stringify({ m: s.mission, mode: s.mode, cut: s.cutscene }));
void press;

await t.finish();
