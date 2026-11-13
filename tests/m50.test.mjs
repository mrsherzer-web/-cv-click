// Mission 50 "fall" (הנפילה של הגיבור) played on the harness from a placed save (chapter ten, 47–49 done): into
// the main hall with the stick, the Shadow on the screen, the hall's defence as a first boss (three marks and a
// retry first; then each control node shot with the real fire button as Muller opens it), the strong attack and
// the fall (the marker on the floor), the hurt play — crawl to the cover, a reload in the middle picked up at its
// checkpoint, crawl to the first-aid box, use it, helped up by Erez, the marker picked up — the last lines, and
// mission 51 beginning. Every quoted line of the mission is checked word for word against lines10.js.
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy', 'citadel'], first: 'fall' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, press, page, objective, holdLoop } = t;
// the real fire button (the marker does not fire while the loop is held, so it is let go for the press)
const fire = async () => { await holdLoop(false); await press('btnFire'); await holdLoop(true); };
const heard = (k) => said(L.fall[k][1], L.fall[k][0]);
const HP = (lx, lz) => G(([lx, lz]) => { const h = window.__game.debug.world.places.citadel.mainHall; return { x: h.centre.x + lx - 72, z: h.centre.z + lz, y: h.y }; }, [lx, lz]);
const hallPt = (expr) => G((e) => window.__r.pt(new Function('h', `return (${e});`)(window.__game.debug.world.places.citadel.mainHall)), expr);

// ---------- 0: into the main hall; the Shadow on the giant screen ----------
let s = await S();
check('mission 50 begins from a placed save (47–49 done)', s.mission?.id === 'fall' && s.mission.step === 0, JSON.stringify(s.mission));
check('step 0: a goal on screen', await objective(0, /להיכנס לאולם המרכזי/), s.objective);
check('the tower door is open and the gang is formed (Muller at the main computer)', await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel; return !Z.mainHall.door.locked && g.squad.ids.length === 7 && !g.squad.ids.includes('muller') && g.npc('muller').visible && Math.hypot(g.npc('muller').pos.x - Z.computer.at.x, g.npc('muller').pos.z - Z.computer.at.z) < 1; }));
const r0 = await tp(await HP(47, 0), 0, 0, null, { near: 0.8 });
check('walked into the hall with the stick', r0 === 'ok' || r0 === 'a scene', r0);
s = await talkThrough((s) => s.mission?.step === 1 && !s.cutscene, 60, 'the screen scene');
check('the Shadow on the screen, and Nehorai\'s answer, word for word', !!s && heard('shadowStop') && heard('iKnow'), t.heard.slice(0, 4).join(' | '));

// ---------- 1: the hall's defence ----------
check('step 1 (cp): its goal', await objective(1, /^לפגוע בשלושת מוקדי ההגנה \(0\/3\)$/), (await S()).objective);
s = await until((s) => /מולר פותח את מוקד 1/.test(s.pill), 4, 'Muller at work on the first node');
check('Muller opens the nodes from the main computer (the pill counts)', !!s, s?.pill);
// a fail first: three marks
await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
s = await until((s) => s.fail, 4, 'the fail');
const reason = await G(() => document.getElementById('failReason')?.textContent || '');
check('three marks fail the fight, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /עמוד/.test(reason), reason);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 1 && !s.fail && s.hits === 0 && s.mission.s.down === 0, 10, 'the retry');
check('retry: back at the defence\'s checkpoint, marks cleared, no node out', !!s);

let fails = 0, shot = false;
async function nodes() {
  for (let k = 0; k < 3; k++) {
    s = await until((s) => s.fail || s.mission?.s.node === k, 24, `node ${k + 1} open`);
    if (!s || s.fail) return false;
    const at = await G((k) => window.__r.pt(window.__game.debug.world.places.citadel.mainHall.defence.nodes[k].at), k);
    const r = await tp(at, 0, 0, null, { near: 0.6 });
    if (r === 'a fail') return false;
    for (let i = 0; i < 40; i++) {
      const st = await G((k) => { const g = window.__game.debug.game, r = g.missions.active?.nodes?.[k]; if (!r) return null; const me = g.player.pos; g.player.yaw = Math.atan2(r.x - me.x, r.z - me.z); return { done: r.done, fail: !g.hud.el.fail.hidden, attacks: g.energy.active }; }, k);
      if (!st || st.done || st.fail) break;
      if (!shot && k === 1 && st.attacks > 0) { shot = true; await snap('m50-1-defence'); }
      await fire(); await step(0.3);
    }
    s = await S();
    if (s.fail) return false;
    if (s.mission?.s.down !== k + 1) return false;
  }
  return true;
}
let won = false;
for (let a = 0; a < 4 && !won; a++) {
  won = await nodes();
  if (!won && (await S()).fail) { fails++; await page.tap('#retryBtn'); await until((s) => s.mission?.step === 1 && !s.fail, 10, 'a retry'); }
  else if (!won) break;
}
check('the three control nodes shot out with the real fire button (the boss beaten)', won, `retries on the way: ${fails}`);
s = await until((s) => s.mission?.step >= 2, 6, 'the strong attack');
check('the defence is down: on to the strong attack', s?.mission?.step >= 2, s?.objective);

// ---------- 2: the fall ----------
s = await until((s) => s.mission?.step === 2 && s.dialogue, 30, 'Ido\'s cry');
const thrown = await G(() => { const g = window.__game.debug.game, h = window.__game.debug.world.places.citadel.mainHall, p = g.player.pos, d = g.paint.dropped; return { atWall: Math.hypot(p.x - h.thrownAt.x, p.z - h.thrownAt.z) < 0.8, dropped: !!d && Math.hypot(d.x - h.markerAt.x, d.z - h.markerAt.z) < 0.3, armed: g.paint.armed }; });
check('thrown against the wall, the marker on the floor where it fell, unarmed', thrown.atWall && thrown.dropped && !thrown.armed, JSON.stringify(thrown));
await snap('m50-2-fall');
s = await talkThrough((s) => s.mission?.step === 3 && !s.cutscene, 90, 'the fall scene');
check('Ido\'s cry, Erez, the Shadow in person, Erez between them — word for word', heard('idoCry') && heard('erezAnswer') && heard('shadowHero') && heard('erezStand'), t.heard.slice(0, 6).join(' | '));

// ---------- 3: crawl to the cover ----------
const hurt = async () => G(() => { const g = window.__game.debug.game, h = window.__game.debug.world.places.citadel.mainHall, sh = g.npc('shadow'), e = g.npc('erez'), p = g.player.pos;
  const between = (e.pos.x - p.x) * (sh.pos.x - e.pos.x) + (e.pos.z - p.z) * (sh.pos.z - e.pos.z) > 0;
  return { crawling: !!g.player.crawling, pose: g.nehorai.pose, dropped: !!g.paint.dropped, armed: g.paint.armed, shadow: sh.visible, between, playing: g.playingAs }; });
check('step 3 (cp): its goal', await objective(3, /^לזחול אל המחסה$/), (await S()).objective);
let h3 = await hurt();
check('hurt: crawling (prone), the marker on the floor, the Shadow in person, Erez between them', h3.crawling && h3.pose === 'prone' && h3.dropped && !h3.armed && h3.shadow && h3.between && h3.playing === 'nehorai', JSON.stringify(h3));
await snap('m50-3-crawl');
const cover = await HP(70.8, 26.6);
let r = await tp(cover, 0, 0, null, { near: 0.5, max: 60 });
s = await until((s) => s.mission?.step === 4, 6, 'behind the cover');
check('crawled behind the low cover with the stick', s?.mission?.step === 4, r);
check('step 4: its goal', await objective(4, /^להגיע לערכת העזרה הראשונה$/), (await S()).objective);

// ---------- a reload in the middle: picked up at the hurt play's checkpoint ----------
await step(1.0);
s = await t.reload();
s = await until((s) => s.mission?.id === 'fall' && s.mission.step === 3 && !s.cutscene, 40, 'the checkpoint after the reload');
h3 = await hurt();
check('after a reload: back at the checkpoint (step 3), still hurt — crawling, the marker on the floor, the Shadow and Erez there', !!s && h3.crawling && h3.dropped && h3.shadow && h3.between, JSON.stringify(h3));
r = await tp(cover, 0, 0, null, { near: 0.5, max: 60 });
s = await until((s) => s.mission?.step === 4, 6, 'behind the cover again');
check('crawled to the cover again', s?.mission?.step === 4, r);
r = await tp(await hallPt('h.medkitAt'), 0, 0, null, { near: 0.6, max: 90 });
s = await until((s) => s.mission?.step === 5, 6, 'at the first-aid box');
check('crawled to the first-aid box', s?.mission?.step === 5, r);

// ---------- 5: the kit ----------
check('step 5: its goal', await objective(5, /^להשתמש בערכה$/), (await S()).objective);
check('the kit is used with the real button', await interact('להשתמש בערכה', 6));
s = await until((s) => s.mission?.step === 6, 10, 'the kit done');
const band = await G(() => { const g = window.__game.debug.game, M = g.nehorai; return { head: !!M.bones.head.getObjectByName('bandage'), arm: !!(M.bones.elL || M.bones.armL || M.bones.shL)?.getObjectByName('wrap') }; });
check('the bandage goes on (and the blur eases)', !!s && band.head && band.arm, JSON.stringify(band));

// ---------- 6: helped up by Erez ----------
check('step 6: its goal', await objective(6, /^להיעזר בארז כדי לקום$/), (await S()).objective);
s = await until(async () => (await G(() => { const g = window.__game.debug.game, e = g.npc('erez'), h = window.__game.debug.world.places.citadel.mainHall; return !e.target && Math.hypot(e.pos.x - h.medkitAt.x, e.pos.z - h.medkitAt.z) < 4; })), 8, 'Erez by him');
const ez = await G(() => window.__r.pt(window.__game.debug.game.npc('erez').pos));
r = await tp(ez, 0, 0, null, { near: 1.6, max: 30 });
check('Erez helps him up (the real button)', await interact('לקום בעזרת ארז', 8));
await step(1.6);
await snap('m50-6-helpup');
s = await until((s) => s.mission?.step === 7, 12, 'on his feet');
check('on his feet again, no longer crawling', s?.mission?.step === 7 && !s.me.crawling, JSON.stringify(s?.me));

// ---------- 7: the marker ----------
check('step 7: its goal', await objective(7, /^לאסוף את הרובה$/), (await S()).objective);
r = await tp(await hallPt('h.markerAt'), 0, 0, null, { near: 0.8, max: 30 });
check('the marker picked up with the real button', await interact('להרים את הרובה', 6));
s = await until((s) => s.mission?.step === 8, 6, 'armed again');
const arm = await G(() => { const g = window.__game.debug.game; return { armed: g.paint.armed, dropped: g.paint.dropped, kind: g.paint.player?.kind }; });
check('armed again with his own marker (nothing left on the floor)', arm.armed && !arm.dropped, JSON.stringify(arm));

// ---------- 8: the lines; mission 51 begins ----------
s = await talkThrough((s) => s.mission?.id !== 'fall', 60, 'the last lines');
check('his answer to the Shadow, word for word', heard('yourProblem') && heard('shadowWhat') && heard('stopTalking'), t.heard.slice(-5).join(' | '));
await step(0.5);
s = await S();
const hand = await G(() => { const g = window.__game.debug.game; return { prog: g.progress.done.includes('fall'), shadow: g.npc('shadow').visible, erez: g.npc('erez').visible, armed: g.paint.armed, crawling: g.player.crawling, as: g.playingAs, squad: g.squad.ids.length }; });
check('mission 51 begins (carried on): fall done, the Shadow before them, the gang in and armed, Nehorai on his feet', s.mission?.id === 'rift' && hand.prog && hand.shadow && hand.erez && hand.armed && !hand.crawling && hand.as === 'nehorai', JSON.stringify({ m: s.mission?.id, ...hand }));
await snap('m50-8-handover');
await t.finish();
