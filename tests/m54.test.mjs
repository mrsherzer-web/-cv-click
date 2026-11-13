// Mission 54, "פותחים את השער בחזרה", played on the stage harness from a placed save (chapter ten, 47-53 done):
// the scene in the citadel as Ido; the defence at the machine played as Ido with the real fire button (a forced
// fail from three marks and its retry); the grove as Nehorai, the radio lines; the run to the energy point with the
// stick (a forced fail when the front catches him and its retry, a reload picked up at that checkpoint); the
// portal, the lines and the leap with the real interact button; mission 55 begins. Every quoted line is compared
// with lines10.js word for word.
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret'];
const t = await openStage({ chapter: 10, done: DONE, first: 'gateback' });
const { page, check, S, G, step, until, talkThrough, said, interact, tp, snap, reload, press } = t;
const Q = L.gateback;
const heard = (line) => said(line[1], line[0]);
const ms = async () => (await S()).mission?.s || {};

// the player's own marker fired at a man of the Order with the real button: Ido turns to him (the look), the
// marker locks on to the nearest one in front, the button is pressed (the loop let go for the press)
async function fireAt(id, presses = 3) {
  for (let i = 0; i < presses; i++) {
    const ok = await G((id) => {
      const g = window.__game.debug.game, gd = g.paint.guards.find((x) => x.npc.id === id);
      if (!gd || gd.marked || !gd.npc.visible) return false;
      const p = g.player.pos; g.player.yaw = Math.atan2(gd.npc.pos.x - p.x, gd.npc.pos.z - p.z); g.follow.snapBehind(g.player.yaw);
      window.__r.step(1 / 15);
      if (g.paint.player && g.paint.player.ammo <= 0) g.paint.reload();
      g.hold = false; return true;
    }, id);
    if (!ok) return;
    await press('btnFire');
    await G(() => { window.__game.debug.game.hold = true; });
    await step(0.35);
  }
}
// the man of the Order to deal with first: the nearest to the machine within the marker's reach of Ido
const nextFoe = (reach = 18) => G((reach) => {
  const g = window.__game.debug.game, m = g.missions.active, P = g.paint, me = g.player.pos;
  const Z = window.__game.debug.world.places.citadel, c = Z.toWorld(108.8, 0);
  let best = null, bd = Infinity;
  for (const gd of P.guards) {
    if (gd.marked || !gd.npc.visible) continue;
    const d = Math.hypot(gd.npc.pos.x - me.x, gd.npc.pos.z - me.z); if (d > reach) continue;
    const k = Math.hypot(gd.npc.pos.x - c.x, gd.npc.pos.z - c.z);
    if (k < bd) { bd = k; best = gd.npc.id; }
  }
  return best;
}, reach);
// the friends' share (they hold the far ends of the hall; their own AI is slow at it under the stepped loop): the
// men out of Ido's reach are marked for them now and then
const friendsShare = () => G(() => {
  const g = window.__game.debug.game, P = g.paint, me = g.player.pos; let n = 0;
  for (const gd of P.guards) if (!gd.marked && gd.npc.visible && Math.hypot(gd.npc.pos.x - me.x, gd.npc.pos.z - me.z) > 18) { P.markGuard(gd, 'test'); n++; }
  return n;
});

// ---------- 0: the citadel, as Ido ----------
let s = await S();
check('the save is placed and "gateback" begins', s.mission?.id === 'gateback', JSON.stringify(s.mission));
s = await until((s) => s.mission?.step === 0 && s.cutscene, 30, 'the scene in the citadel');
check('the scene: Ido is played, in the ordinary world', s?.me.as === 'ido' && s?.dimension === null, `${s?.me.as} ${s?.dimension}`);
check('a goal is on screen for the scene', /מולר/.test(s?.objective || ''), s?.objective);
await step(2);
await snap('m54-0-citadel');
s = await talkThrough((s) => s.mission?.step >= 1, 150, 'the scene at the machine');
check('the citadel lines, word for word', heard(Q.idoTell) && heard(Q.mullerWorking) && heard(Q.idoFaster) && heard(Q.mullerFound), t.heard.slice(0, 6).join(' | '));

// ---------- 1: the defence at the machine, played as Ido ----------
s = await until((s) => s.mission?.step === 1 && !s.cutscene, 10, 'the defence');
check('the defence: the goal on screen, Ido at the controls, armed', /להגן על המכונה עד שמולר מסיים/.test(s?.objective || '') && s?.me.as === 'ido' && s?.armed, `${s?.objective} ${s?.me.as}`);
const posts = await G(() => { const g = window.__game.debug.game; return ['yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].map((id) => g.npc(id).visible); });
check('the friends are there with him and Muller at the machine', posts.every(Boolean), JSON.stringify(posts));
await step(8);
check('the first of the Order come in at the main door', (await G(() => window.__game.debug.game.paint.guards.filter((g) => g.npc.visible && !g.marked).length)) > 0);
// a forced fail: Ido marked three times
await G(() => { window.__game.debug.game.paint.hits = 3; });
s = await until((s) => s.fail, 6, 'the fail screen');
const why = await page.textContent('#failReason');
check('three marks on Ido fail the defence, with a reason and a tip', !!s && /עידו סומן שלוש פעמים/.test(why) && /מאחורי מחסה/.test(why), why);
await page.tap('#retryBtn');
s = await until((s) => !s.fail && s.mission?.step === 1, 8, 'the retry');
let m = await ms();
check('the retry: from the start of the defence, as Ido, the marks wiped', s?.me.as === 'ido' && s?.hits === 0 && (m.prog ?? 1) < 0.05, `${s?.me.as} hits ${s?.hits} prog ${m.prog}`);
let stopped = false, shots = 0, half = false, quiet = 0, byFriends = 0;
for (let i = 0; i < 500; i++) {
  s = await S();
  if (s.mission?.step !== 1 || s.fail) break;
  if (/נעצרה/.test(s.pill)) stopped = true;
  if (!half && (s.mission.s.prog ?? 0) > 0.5) { half = true; await snap('m54-1-defence'); }
  const id = await nextFoe();
  if (id) { await fireAt(id); shots++; continue; }
  await step(0.6);
  if ((quiet += 0.6) > 6) { quiet = 0; byFriends += await friendsShare(); }
}
m = await ms();
check('the machine charged to the end and the defence is won', s?.mission?.step === 2 || (await S()).mission?.step === 2, `step ${s?.mission?.step} prog ${m.prog} fail ${s?.fail}`);
check('the bar stopped while one of them had a line on the machine', stopped);
check('Ido fired with the real button', shots > 0, `${shots} volleys, ${byFriends} marked for the friends`);

// ---------- 2: the grove, as Nehorai: the radio ----------
s = await until((s) => s.mission?.step === 2 && s.dimension === 'grove', 20, 'the grove');
check('back in the grove: Nehorai played, the other dimension on', s?.me.as === 'nehorai' && s?.dimension === 'grove', `${s?.me.as} ${s?.dimension}`);
s = await talkThrough((s) => s.mission?.step >= 3, 120, 'the radio');
check('the grove lines, word for word', heard(Q.mullerHear) && heard(Q.getUsOut) && heard(Q.mullerPoint), t.heard.slice(-6).join(' | '));
const marked = await G(() => window.__game.debug.world.places.grove.portalAt.lit);
check('the energy point is marked', marked);

// ---------- 3: the run ----------
s = await until((s) => s.mission?.step === 3 && !s.cutscene, 10, 'the run');
check('the run: its goal on screen and the front behind', /לרוץ אל נקודת האנרגיה/.test(s?.objective || '') && /החזית/.test(s?.pill || ''), `${s?.objective} · ${s?.pill}`);
// a forced fail: standing still, the front catches him
s = await until((s) => s.fail, 20, 'the front catching up');
const why2 = await page.textContent('#failReason');
check('the front catches him: a fail with a reason and a tip', !!s && /החזית/.test(why2) && /כפתור הריצה/.test(why2), why2);
await page.tap('#retryBtn');
s = await until((s) => !s.fail && s.mission?.step === 3, 8, 'the retry');
check('the retry starts the run again, in the grove', s?.dimension === 'grove' && s?.me.as === 'nehorai', `${s?.dimension} ${s?.me.as}`);
// a reload in the middle of the run
s = await reload();
s = await until((s) => s.mission?.id === 'gateback' && s.mission?.step === 3, 30, 'the run picked up after the reload');
check('a reload is picked up at the run\'s checkpoint: in the grove, as Nehorai, the front behind', s?.dimension === 'grove' && s?.me.as === 'nehorai' && /החזית/.test(s?.pill || ''), `${s?.mission?.step} ${s?.dimension} ${s?.me.as} ${s?.pill}`);
await step(1.4);
await snap('m54-3-run');
const leap = await G(() => { const q = window.__game.debug.world.places.grove; return { x: 1212.3, z: 193.5, y: q.y }; });
const res = await tp(leap);
s = await S();
check('the run is made with the stick, ahead of the front', ['ok', 'a scene'].includes(res) && s.mission?.step === 4, `${res} step ${s.mission?.step}`);

// ---------- 4: the portal, the leap ----------
s = await until((s) => s.mission?.step === 4 && s.cutscene && s.dialogue, 20, 'the portal opening');
await snap('m54-4-portal');
s = await talkThrough((s) => s.mission?.step === 4 && !s.cutscene && !s.dialogue, 60, 'the lines at the portal');
check('the portal lines, word for word', heard(Q.erezNow) && heard(Q.yalla), t.heard.slice(-3).join(' | '));
check('the goal: run and leap into the portal', /לרוץ ולקפוץ לתוך הפורטל/.test(s?.objective || ''), s?.objective);
await tp(leap);
check('the leap is taken with the real interact button', await interact('לקפוץ לתוך הפורטל', 8));
s = await until((s) => s.mission?.id === 'return', 20, 'mission 55');
check('mission 55 begins', s?.mission?.id === 'return', JSON.stringify(s?.mission));
const handed = await G(() => { const g = window.__game.debug.game; return { dim: g.dimensionName, as: g.playingAs }; });
check('handed over in the white: still in the grove\'s dimension, Nehorai played', handed.dim === 'grove' && handed.as === 'nehorai', JSON.stringify(handed));
await t.finish();
