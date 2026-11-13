// Mission 53 "secret" (סוד החורשה) played on the harness from a placed save (chapter ten, 47–52 done): it begins on a
// fresh page in the grove's dimension at the first wall, Erez with him; the walkie-talkie with the real button (the
// static, the notice and the lines word for word); a. the three symbols: the first switched on by the boulder, the
// second on the swings (Erez on the other one, Nehorai pushing with the button), the third through the ring of
// disturbances; b. a reload at the path's checkpoint, a forced fail and its retry, then the broken path walked with
// the stick: the wave of stones, the leap, the switch, the ledge, Erez's hand, the bridge; c. a forced fail and its
// retry, then the Keeper: the banner with his name, his warned energy dodged with the stick, the real one of his
// copies marked with the fire button, the four anchor stones (two by Nehorai and two by Erez on his call in the first
// round, all four by Nehorai while Erez draws him off in the second), the weak point marked; the crystal taken; the
// radio back; and mission 54 beginning.
import { openStage } from './lib/stage.mjs';
import { L, CARDS, KEEPER } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove'], first: 'secret' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, page, objective, holdLoop, press } = t;
const heard = (k) => said(L.secret[k][1], L.secret[k][0]);
// an expression read in the page: g the game, Q the grove, m the running mission
const QQ = (expr) => G((expr) => { const g = window.__game.debug.game; return new Function('g', 'Q', 'm', `return (${expr});`)(g, window.__game.debug.world.places.grove, g.missions.active); }, expr);
const near = (a, b, r) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < r;
const where = () => QQ(`(() => { const p = g.player.pos, e = g.npc('erez'), w = m && m.def.id === 'secret' ? null : null;
  return { dim: g.dimensionName, layer: Q.isDimension(), x: p.x, z: p.z, y: p.y, erez: e.visible ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : null, erezY: e.pos.y,
    armed: g.paint.armed, kind: g.paint.player ? g.paint.player.kind : null, bandage: !!g.nehorai.bones.head.getObjectByName('bandage'), squad: g.squad.ids.join(','), as: g.playingAs,
    lit: Q.symbols.map((s) => s.lit), open: Q.seals.map((s) => s.isOpen), hits: g.paint.hits }; })()`);
const tgt = () => QQ('(() => { const s = m.def.steps[m.stepIndex]; const x = s.target && s.target(m, g); return x && { x: x.x, z: x.z, y: x.y }; })()');
// the fire button for real (the loop let go for the press)
const fire = async () => { await holdLoop(false); await press('btnFire'); await holdLoop(true); await step(1 / 30); };
const face = (p) => G((p) => { const g = window.__game.debug.game, me = g.player.pos, y = Math.atan2(p.x - me.x, p.z - me.z); g.player.yaw = y; g.follow.snapBehind(y); }, p);
// the stick: round and round the clearing's middle at radius R (dodging what he throws); off with null
const circle = (R) => G((R) => { const g = window.__game.debug.game, c = window.__game.debug.world.places.grove.arena.centre;
  if (R == null) { g.botInput = null; return; }
  g.botInput = (input) => {
    if (g.mode !== 'foot' || g.cutscene) return input;
    const p = g.player.pos, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1, k = (R - d) * 0.7;
    let tx = -dz / d + (dx / d) * k, tz = dx / d + (dz / d) * k;
    // a warned ring under him (or the one where he is heading): straight out of it, as a player would
    let ex = 0, ez = 0; for (const a of g.energy.attacks || []) { if (a.kind !== 'ring' || a.done || a.burst) continue; const qx = p.x - a.x, qz = p.z - a.z, q = Math.hypot(qx, qz); if (q < a.r + 1.0) { ex += q > 0.05 ? qx / q : -dz / d; ez += q > 0.05 ? qz / q : dx / d; } }
    // a bolt in flight at him: sideways off its line
    for (const a of g.energy.attacks || []) { if (a.kind !== 'bolt' || a.done || !a.flying || a.target !== g.player) continue; const qx = p.x - a.x, qz = p.z - a.z; if (Math.hypot(qx, qz) > 9 || qx * a.dx + qz * a.dz < 0) continue; let sx = -a.dz, sz = a.dx; if (qx * sx + qz * sz < 0) { sx = -sx; sz = -sz; } ex += sx * 1.5; ez += sz * 1.5; }
    if (ex || ez) { tx = ex; tz = ez; }
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const cy = g.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    return { ...input, move: { x: tx * rx + tz * rz, y: tx * fx + tz * fz }, run: true };
  };
}, R);
// the stick pushed toward a world direction (yaw) for a moment
const nudge = async (yaw, sec) => { await G((yaw) => { const g = window.__game.debug.game; g.botInput = (input) => { const cy = g.follow.yaw, tx = Math.sin(yaw), tz = Math.cos(yaw); return { ...input, move: { x: tx * Math.cos(cy) - tz * Math.sin(cy), y: -tx * Math.sin(cy) - tz * Math.cos(cy) }, run: false }; }; }, yaw); await step(sec); await G(() => { window.__game.debug.game.botInput = null; }); };
// no drifting ball within r of the way from Nehorai to `to` (balls: an expression for the list)
const clearWay = (to, balls, r = 2.0) => QQ(`(() => { const a = g.player.pos, b = ${JSON.stringify(to)}, list = ${balls};
  const seg = (p) => { const vx = b.x - a.x, vz = b.z - a.z, l = vx * vx + vz * vz || 1, k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l)); return Math.hypot(a.x + vx * k - p.x, a.z + vz * k - p.z); };
  return list.every((d) => d.frozen || seg(d.pos) > ${r}); })()`);
async function slipTo(to, balls, what, tries = 6) { // wait for a gap, then go; knocked back: again
  for (let k = 0; k < tries; k++) {
    await until(() => clearWay(to, balls), 12, `a gap (${what})`, 1 / 15);
    await tp(to, 0, 0, null, { near: 0.6, max: 20 });
    const me = await QQ('({ x: g.player.pos.x, z: g.player.pos.z })');
    if (near(me, to, 1.2)) return true;
  }
  return false;
}

// ---------- 0: the walkie-talkie ----------
let s = await S();
check('mission 53 begins from a placed save (47–52 done)', s.mission?.id === 'secret' && s.mission.step === 0, JSON.stringify(s.mission));
check('step 0: its goal', await objective(0, /^לנסות את מכשיר הקשר$/), s.objective);
let w = await where();
const wall = await QQ('(() => { const s = m.def.startAt(g); return { x: s.x, z: s.z }; })()');
check('staged in the grove\'s dimension at the first wall: Erez with him, his marker in hand, the bandage on', w.dim === 'grove' && w.layer && near(w, wall, 2) && w.erez != null && w.erez < 5 && w.armed && w.bandage && w.squad === 'erez' && w.as === 'nehorai' && w.open.every((o) => !o), JSON.stringify(w));
check('"לנסות את מכשיר הקשר" with the real button', await interact('לנסות את מכשיר הקשר', 6));
let notice = '';
s = await talkThrough(async (s) => { if (!notice) notice = await G(() => { const o = window.__game.debug.game.overlay; return o.noticeEl?.classList.contains('on') ? o.noticeEl.textContent : ''; }); return s.mission?.step === 1; }, 40, 'the radio');
check('static, and the notice word for word', notice === CARDS.dimension, notice);
check('the lines, word for word: "חייבים למצוא דרך לחזור", "אני איתך"', heard('mustReturn') && heard('withYou'), t.heard.slice(-3).join(' | '));

// ---------- 1 (cp): a. the three symbols ----------
check('step 1 (cp): its goal', await objective(1, /^א\. למצוא את מקור האנרגיה · סמלים \(0\/3\)/), (await S()).objective);
const sym = await QQ('Q.symbols.map((s) => ({ x: s.at.x, z: s.at.z, y: s.at.y }))');
check('the arrow points to the first symbol, by the boulder', near(await tgt(), sym[0], 1.5), JSON.stringify(await tgt()));
await tp(sym[0], 0, 0, null, { near: 0.8 });
check('the first symbol switched on with the real button', await interact('להדליק את הסמל', 6));
w = await where();
check('symbol 1/3: the playground\'s wall opens, the next still stands', w.lit[0] && w.open[0] && !w.open[1] && /\(1\/3\)/.test((await S()).objective), JSON.stringify(w));
const seat = await QQ('Q.playground.swingSeats.map((s) => ({ x: s.x, z: s.z + 1.15, y: Q.y }))');
check('the arrow points to the swings', near(await tgt(), seat[0], 1.5), JSON.stringify(await tgt()));
let r = await tp(seat[0], 0, 0, 0, { near: 0.5 });
check('"לעלות על הנדנדה" with the real button', await interact('לעלות על הנדנדה', 8), r);
let top = { a0: 0, a1: 0, erez: null };
for (let i = 0; i < 40; i++) {
  if (await QQ('Q.symbols[1].lit')) break;
  await interact('לנדנד', 3);
  await step(0.5);
  const a = await QQ('m.A && { a0: m.A.sw[0].amp, a1: m.A.sw[1].amp, erez: m.A.erez }');
  if (a) top = { a0: Math.max(top.a0, a.a0), a1: Math.max(top.a1, a.a1), erez: a.erez };
}
await snap('m53-1-swings');
w = await where();
check('both swings moving (Nehorai pushing with the button, Erez on the other: his job): the second symbol lights, the next wall opens', w.lit[1] && w.open[1] && top.a0 > 0.28 && top.a1 > 0.28 && top.erez === 'on', JSON.stringify({ top, lit: w.lit, open: w.open }));
s = await until(async () => (await QQ('m.A && m.A.erez')) === 'done' && !(await QQ('!!g.player.scripted')), 6, 'off the swings');
check('both off the swings again, on their feet', !!s);
check('the arrow points to the third symbol, by the goal', near(await tgt(), sym[2], 1.5), JSON.stringify(await tgt()));
await tp({ x: sym[2].x + 1, z: sym[2].z + 6.5, y: sym[2].y }, 0, 0, null, { near: 1.0 });
const ringOk = await slipTo(sym[2], 'm.ring', 'the ring round the third symbol');
check('slipped through the ring of disturbances to the third symbol', ringOk);
check('the third symbol switched on with the real button', await interact('להדליק את הסמל', 6));
s = await talkThrough((s) => s.mission?.step === 2, 30, 'the lines after the symbols');
w = await where();
check('three symbols lit, every wall open; Erez\'s lines on the way', w.lit.every(Boolean) && w.open.every(Boolean) && t.heard.some((l) => l.startsWith('ארז: הקיר של גן המשחקים')) && t.heard.some((l) => l.startsWith('ארז: השביל נפתח')), JSON.stringify(w));

// ---------- 2 (cp): b. the broken path: a reload, a forced fail, then the path ----------
check('step 2 (cp): its goal', await objective(2, /^ב\. לעבור את שביל המציאות השבורה/), (await S()).objective);
s = await t.reload();
s = await until((s) => s.mission?.id === 'secret' && s.mission.step === 2 && !s.cutscene, 40, 'the checkpoint after the reload');
w = await where();
const bp = await QQ('(() => { const b = Q.brokenPath, st = (n) => { const s = b.stones.find((x) => x.name === n); return { x: s.x, z: s.z, y: s.y }; }; const P = (q) => ({ x: q.x, z: q.z, y: q.y }); return { start: P(b.start), end: P(b.end), p0: st("platform 0"), a1: st("island A1"), a1mid: { x: b.fields[0].x, z: b.fields[0].z, y: b.fields[0].y }, from: P(b.leaps[0].from), sw0: P(b.switches[0].at), bottom: P(b.ledge.bottom), to: P(b.ledge.to), sw1: P(b.switches[1].at), landing: st("landing"), p6: st("platform 6"), y: Q.y }; })()');
check('after a reload: the path\'s checkpoint, in the dimension, on the bank where it begins, the symbols lit and the walls open, armed, the bandage on, Erez with him', !!s && w.dim === 'grove' && w.layer && near(w, bp.start, 1.5) && w.lit.every(Boolean) && w.open.every(Boolean) && w.armed && w.bandage && w.erez != null && w.erez < 5, JSON.stringify(w));
await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
s = await until((s) => s.fail, 4, 'the fail');
let reason = await G(() => document.getElementById('failReason')?.textContent || '');
check('three marks on the path fail it, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /עמוד הכחול/.test(reason), reason);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 2 && !s.fail && s.hits === 0, 10, 'the retry');
w = await where();
check('retry: back on the bank at the path\'s start, marks cleared', !!s && near(w, bp.start, 1.5), JSON.stringify(w));
await step(0.5);
// the wave: on the first (fixed) stone, wait for the three to stand together, then over to the first island
await tp(bp.p0, 0, 0, null, { near: 0.5 });
let onA1 = false;
for (let k = 0; k < 5 && !onA1; k++) {
  await until(() => QQ('(() => { const P = m.kit.platforms; return P[1].solid && P[2].solid && P[3].solid && P[1].left > 0.7; })()'), 8, 'the wave', 1 / 30);
  await tp(bp.a1, 0, 0, null, { near: 0.8, max: 12 });
  const me = await where();
  onA1 = near(me, bp.a1, 2.5) && Math.abs(me.y - bp.a1.y) < 0.5;
}
const falls0 = await QQ('m.kit.guard.falls');
check('over the wave of stones to the first island with the stick', onA1, `falls ${falls0}`);
await snap('m53-2-path');
await slipTo(bp.from, 'm.kit.disturbances.slice(0, 1)', 'the ball on the islands');
check('"לקפוץ" with the real button', await interact('לקפוץ', 6));
s = await until(async () => { const me = await where(); return me.x < bp.from.x - 2 && Math.abs(me.y - bp.y) < 0.4 && !(await QQ('!!g.player.scripted')); }, 6, 'the landing');
check('the leap to the second island', !!s);
await nudge(-Math.PI / 2, 0.5); // a step on from the edge where he landed
await slipTo(bp.sw0, 'm.kit.disturbances.slice(0, 1)', 'to the switch');
check('"לייצב את האבנים" with the real button: the quick stones held', await interact('לייצב את האבנים', 6) && (await QQ('m.kit.platforms[4].solid && m.kit.platforms[5].solid && m.kit.platforms[4].left === Infinity')));
r = await tp(bp.bottom, 0, 0, -Math.PI / 2, { near: 0.5 });
check('"לטפס" with the real button', await interact('לטפס', 6), r);
s = await until(async () => (await where()).y > bp.y + 1.4 && !(await QQ('!!g.player.scripted')), 8, 'on the ledge');
check('up the ledge; the bridge\'s switch waits for Erez', !!s && !(await QQ('m.kit.switches[1].enabled')));
await tp(bp.to, 0, 0, Math.PI / 2, { near: 0.5 });
check('"לתת יד לארז" with the real button', await interact('לתת יד לארז', 10));
s = await until(() => QQ('m.kit.hand.done'), 12, 'Erez up');
const ez = await QQ('(() => { const e = g.npc("erez"); return { y: e.pos.y }; })()');
check('Erez hauled up the ledge', !!s && ez.y > bp.y + 1.3, JSON.stringify(ez));
await tp(bp.sw1, 0, 0, null, { near: 0.6 });
check('"להרים את הגשר" with the real button: the bridge rises', await interact('להרים את הגשר', 6) && !!(await until(() => QQ('Q.brokenPath.bridge.k >= 1'), 4, 'the bridge')));
await tp(bp.landing, 0, 0, null, { near: 0.6 });
// the ball on the bridge goes to and fro along it, from the south side at this end to the north side at the far end:
// go as it reaches the far end, along the south side, and pass it head on as it comes back
let endOk = false;
for (let k = 0; k < 4 && !endOk; k++) {
  if ((await S()).fail) break;
  await tp(bp.landing, 0, 0, null, { near: 0.5 });
  await until(() => QQ('(() => { const d = m.kit.disturbances[1]; return Q.brokenPath.rect.x1 - d.pos.x > 45.0; })()'), 12, 'the ball at the far end', 1 / 30);
  await tp({ x: bp.p6.x + 0.6, z: bp.p6.z + 1.0, y: bp.y }, 0, 0, null, { near: 0.6, max: 8 });
  await tp(bp.end, 0, 0, null, { near: 0.6, max: 10 });
  endOk = near(await where(), bp.end, 1.5);
}
s = await until((s) => s.mission?.step === 3, 10, 'the far bank');
check('over the bridge to the far bank with the stick: the path done', endOk && !!s, JSON.stringify(await where()));
await t.listen();
check('Erez on the path asks for a hand', t.heard.some((l) => l.startsWith('ארז: אחי, יד?')), t.heard.slice(-6).join(' | '));

// ---------- 3 (cp): c. the Keeper: a forced fail, then the fight ----------
check('step 3 (cp): its goal', await objective(3, /^ג\. שומר הסף/), (await S()).objective);
await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
s = await until((s) => s.fail, 4, 'the fail');
reason = await G(() => document.getElementById('failReason')?.textContent || '');
check('three marks in the clearing fail it, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /צל/.test(reason), reason);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 3 && !s.fail && s.hits === 0, 10, 'the retry');
const ar = await QQ('(() => { const A = Q.arena; return { c: { x: A.centre.x, z: A.centre.z, y: A.centre.y }, entry: { x: A.entry.x, z: A.entry.z, y: A.entry.y }, r: A.radius }; })()');
w = await where();
check('retry: at the way into the clearing, Erez with him, marks cleared', !!s && near(w, ar.entry, 1.5) && w.erez < 5, JSON.stringify(w));
const phase = () => QQ('m.K && m.K.phase');
await tp({ x: ar.c.x - 5, z: ar.c.z + 3, y: ar.c.y }, 0, 0, null, { near: 1.0 });
s = await until(async () => (await phase()) === 'rise', 6, 'the Keeper rising');
const banner = await G(() => window.__game.debug.game.hud.el.bannerTitle?.textContent || '');
check(`the Keeper rises in the clearing; the banner names him: ${KEEPER}`, !!s && banner === KEEPER, banner);
await step(1.6);
await snap('m53-3-keeper');
s = await talkThrough(async () => (await phase()) === 'dodge', 20, 'his entrance');
// a warned ring under him: out of it with the stick first (as a player would, before he stops to aim or to light a stone)
// (and a bolt gathering or flying at him: keep moving until it has gone by, as a player would)
const ringNear = () => QQ('(g.energy.attacks || []).some((a) => !a.done && (a.kind === "ring" && !a.burst && Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z) < a.r + 1.0 || a.kind === "bolt" && a.target === g.player && (!a.flying || (g.player.pos.x - a.x) * a.dx + (g.player.pos.z - a.z) * a.dz > 0 && Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z) < 12)))');
async function clearOfRings() { if (!(await ringNear())) return; await circle(4.2); await until(async () => !(await ringNear()), 5, 'out of the way of his energy', 1 / 15); await circle(null); }
// what marked him (the HUD word of each hit), for the record
await G(() => { const P = window.__game.debug.game.paint, s0 = P.strike.bind(P); window.__hits53 = []; P.strike = (l, c) => { window.__hits53.push(l); return s0(l, c); }; });
// one round: dodge with the stick; the real one of the copies marked; the stones; the weak point
// the real one in his sights: faced; when a copy nearer to him has the marker's lock, a few steps toward the real one
// first (with the stick), as a player would
async function aimReal() {
  const at = () => QQ('m.foe && !m.foe.teleporting && m.K.phase === "copies" && { x: m.foe.pos.x, z: m.foe.pos.z }');
  let real = await at(); if (!real) return false;
  await face(real); await step(1 / 15);
  if (await QQ('!!m.foe && g.paint.lock === m.foe.body')) return true;
  await tp(real, 0, 0, null, { near: 3.2, max: 6 });
  await clearOfRings();
  real = await at(); if (!real) return false;
  await face(real); await step(1 / 15);
  return true;
}
async function round(n, { call }) {
  await circle(4.2);
  s = await until(async (s) => s.fail || (await phase()) === 'copies', 40, `round ${n}: the energy dodged`);
  await circle(null);
  const dodged = await QQ('({ hits: g.paint.hits, struck: g.energy.struck, what: window.__hits53.join(",") })');
  check(`round ${n}: his warned energy dodged with the stick`, !!s && !s.fail, JSON.stringify(dodged));
  if (n === 1) {
    await snap('m53-3-copies');
    s = await until(async () => { await step(0.3); return QQ('m.K.spotted'); }, 12, 'Erez spotting the tell');
    const arrow = await tgt(), real = await QQ('({ x: m.foe.pos.x, z: m.foe.pos.z })');
    check('Erez spots the tell (the real one casts a shadow): the arrow on the real one', !!s && near(arrow, real, 0.5), JSON.stringify({ arrow, real }));
  } else {
    const c = await QQ('(() => { const i = m.foe.copyList.findIndex((q) => q.alive), c = m.foe.copyList[i]; return c && { x: c.pos.x, z: c.pos.z, i }; })()'), n0 = await QQ('m.foe.copies');
    if (c) { // (the marker locks on to the nearest in his sights: a few steps toward the copy first when another is nearer)
      const locked = () => QQ(`g.paint.lock === m.foe.copyList[${c.i}].target`);
      await face(c); await step(1 / 15);
      if (!(await locked())) { await tp(c, 0, 0, null, { near: 3.0, max: 6 }); await face(c); await step(1 / 15); }
      await fire(); await step(0.3);
    }
    const n1 = await QQ('m.foe.copies');
    check('a copy marked pops (the real one answers with a warned bolt)', !!c && n1 === n0 - 1, `${n0} → ${n1}`);
  }
  let shots = 0;
  for (let k = 0; k < 20 && (await phase()) === 'copies'; k++) {
    const real = await QQ('m.foe && !m.foe.teleporting && { x: m.foe.pos.x, z: m.foe.pos.z }');
    await clearOfRings();
    if (real && (await aimReal())) { await fire(); shots++; await step(0.4); }
    if ((await phase()) !== 'copies') break;
    await circle(4.2); await step(1.2); await circle(null);
  }
  s = await S();
  check(`round ${n}: the real one marked with the fire button (${shots} shots): the copies gone`, (await phase()) === 'anchors' && !s.fail && (await QQ('m.foe.copies')) === 0);
  const anchors = await QQ('Q.arena.anchors.map((a) => ({ x: a.at.x, z: a.at.z, y: a.at.y }))');
  if (call) check('"לקרוא לארז · שתי אבנים" with the real button', await interact('לקרוא לארז · שתי אבנים', 4));
  for (let k = 0; k < 6 && (await phase()) === 'anchors'; k++) {
    const a = await tgt();
    if (!a) break;
    if (await QQ(`Q.arena.anchors.every((x) => x.lit || ${call} && m.K.jobs.some((j) => j.a === x))`)) { await step(0.5); continue; }
    await tp(a, 0, 0, null, { near: 0.6, max: 25 });
    await clearOfRings();
    if (!(await QQ(`Q.arena.anchors.some((x) => !x.lit && Math.hypot(x.at.x - g.player.pos.x, x.at.z - g.player.pos.z) < 1.7)`))) continue;
    await interact('להדליק את אבן העוגן', 4);
  }
  s = await until(async (s) => s.fail || (await phase()) === 'weak', 25, `round ${n}: every stone lit`);
  const by = await QQ('({ called: m.K.called, erezJobs: m.K.jobs.length })');
  check(`round ${n}: the four anchor stones lit (${call ? 'two by Erez on the call' : 'all by Nehorai while Erez draws him off'}): the weak point open`, !!s && !s.fail && (await QQ('m.foe.exposed')) && by.called === call, JSON.stringify(by));
  for (let k = 0; k < 20; k++) {
    const ph = await phase();
    if (ph !== 'weak') break;
    const at = await QQ('m.foe && { x: m.foe.pos.x, z: m.foe.pos.z }');
    await clearOfRings();
    if (at) { await face(at); await step(1 / 15); for (let i = 0; i < 3; i++) { await fire(); await step(0.12); } }
    if ((await phase()) !== 'weak') break;
    await circle(4.2); await step(1.4); await circle(null);
  }
  s = await S();
  console.log(`  (marks so far: ${await QQ('window.__hits53.join(",") || "none"')})`);
  return !s.fail;
}
const r1 = await round(1, { call: true });
check('round 1 over: the weak point marked down to half; he starts again', r1 && (await QQ('m.K.round')) === 1 && (await phase()) === 'dodge', JSON.stringify(await QQ('m.foe && { hp: m.foe.hp }')));
const r2 = await round(2, { call: false });
s = await until(() => QQ('!!m.crystal'), 8, 'the burst');
check('round 2 over: he bursts into light; the crystal rises', r2 && !!s && (await QQ('!!m.crystal')));
await step(1.0);
s = await talkThrough((s) => s.mission?.step === 4, 20, 'the burst\'s lines');
check('Erez on the tell; Erez and Nehorai at the burst', t.heard.some((l) => l.startsWith('ארז: תסתכל על הדשא')) && t.heard.some((l) => l.startsWith('ארז: הוא… התפוצץ לאור')), t.heard.slice(-6).join(' | '));

// ---------- 4: the crystal; the radio back ----------
check('step 4: its goal', await objective(4, /^לאסוף את הגביש$/), (await S()).objective);
const cr = await QQ('({ x: Q.crystalAt.x, z: Q.crystalAt.z, y: Q.y })');
await tp(cr, 0, 0, null, { near: 1.0 });
await snap('m53-4-crystal');
check('"לאסוף את הגביש" with the real button', await interact('לאסוף את הגביש', 6));
s = await talkThrough((s) => s.mission?.id !== 'secret', 30, 'the radio coming back');
check('the radio crackles back to life: the lines', t.heard.some((l) => l.startsWith('ארז: שמעת? הקשר')), t.heard.slice(-4).join(' | '));

// ---------- 54 begins ----------
s = await until((s) => s.mission?.id === 'gateback', 10, 'mission 54');
check('mission 53 done; mission 54 begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('secret'))), JSON.stringify(s?.mission));
await t.finish();
