// Chapter ten acceptance test, group b (missions 50–53) in ONE session, carried on live from each mission to the
// next (no save placed between them): 50 "fall" — into the main hall with the stick, the Shadow on the screen, the
// hall's defence (three marks and a retry, then each control node shot with the real fire button as Muller opens
// it), the strong attack and the fall, the hurt play (crawl to the cover and to the first-aid box, the kit, Erez's
// hand, the marker picked up); 51 "rift" — the duel (three marks and a retry, then the Shadow marked with the fire
// button when his guard drops), the orb and the portal, the pull at a pillar held with the real button, the grip lost
// by script, the white; THE CROSSING to the grove's dimension, proved live (where they land, the marker, its ammo,
// the health, the bandage, the squad, the progress, the gang left in the hall); 52 "grove" — "לקום", the look at the
// sky with a real drag, a reload at the walk's checkpoint picked up in the dimension, the walk with Erez to the first
// wall; 53 "secret" — the radio, the three symbols, the broken path (three marks and a retry first), the Keeper
// (three marks and a retry first; his energy dodged with the stick, the real copy and the weak point marked with the
// fire button, the anchor stones), the crystal, the radio back; and mission 54 beginning. Every quoted line of the
// four missions is checked word for word against lines10.js, every step's goal on screen with a target for its
// arrow (or a scene playing), every leg on foot walked with the stick.
// usage: node tests/stage-v.test.mjs [first mission: 50..53 or its id]  (a later first mission begins from a placed
// save; the reload then falls in mission 52, or in 53 when the run begins there)
import { openStage } from './lib/stage.mjs';
import { L, CARDS, KEEPER } from '../src/missions/lines10.js';

const ORDER = ['fall', 'rift', 'grove', 'secret'];
const BEFORE = ['dawn', 'lastconvoy', 'citadel'];
const arg = process.argv[2] || 'fall';
const FIRST = ORDER.includes(arg) ? arg : ORDER[Number(arg) - 50];
if (!FIRST) { console.log(`unknown first mission "${arg}" (50..53 or ${ORDER.join('/')})`); process.exit(2); }
const FROM = ORDER.indexOf(FIRST);
const t = await openStage({ chapter: 10, done: [...BEFORE, ...ORDER.slice(0, FROM)], first: FIRST });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, press, hold, page, objective, holdLoop } = t;
const heardIn = (mis) => (k) => said(L[mis][k][1], L[mis][k][0]);
// every line the user wrote for a mission, heard word for word since its start
const allLines = (mis) => { const miss = Object.keys(L[mis]).filter((k) => !heardIn(mis)(k)); check(`mission ${mis}: every quoted line heard word for word (${Object.keys(L[mis]).length})`, miss.length === 0, miss.map((k) => `${k}: ${L[mis][k].join(': ')}`).join(' | ')); };
// the real fire button (the marker does not fire while the loop is held, so it is let go for the press)
const fire = async () => { await holdLoop(false); await press('btnFire'); await holdLoop(true); };
// an expression read in the page: g the game, Q the grove, m the running mission
const QQ = (expr) => G((expr) => { const g = window.__game.debug.game; return new Function('g', 'Q', 'm', `return (${expr});`)(g, window.__game.debug.world.places.grove, g.missions.active); }, expr);
const near = (a, b, r) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < r;
// a check the rest of its mission hangs on: failed, the mission's run stops there (the runner reports it and ends)
const must = (name, ok, detail = '') => { if (!check(name, ok, detail)) throw new Error(`stopped at "${name}"`); return true; };

// ---------- every step's goal on screen and a target for its arrow (or a scene playing), recorded as it plays ----------
const seen = {};
const hookGoals = () => G(() => {
  const g = window.__game.debug.game, hud = g.hud;
  window.__seen = window.__seen || {};
  const rec = (k) => (window.__seen[k] ||= { goals: [], target: false, scene: false });
  if (!hud.__goalHook) {
    const f = hud.setObjective.bind(hud);
    hud.setObjective = (text, ...rest) => { const m = g.missions.active; if (m && text) { const r = rec(`${m.def.id}:${m.stepIndex}`); if (!r.goals.includes(text)) r.goals.push(text); } return f(text, ...rest); };
    hud.__goalHook = true;
  }
  if (!window.__r.__goalHook) {
    const st = window.__r.step;
    window.__r.step = (sec) => {
      st(sec);
      const m = g.missions.active; if (!m) return;
      const r = rec(`${m.def.id}:${m.stepIndex}`), s = m.def.steps[m.stepIndex];
      let tg = null; try { tg = typeof s.target === 'function' ? s.target(m, g) : s.target; } catch (e) { tg = null; }
      if (tg) r.target = true;
      if (g.cutscene || g.dialogue.busy || (g.fight && !g.fight.over)) r.scene = true;
      const o = document.getElementById('objText')?.textContent; if (o && !r.goals.includes(o)) r.goals.push(o);
    };
    window.__r.__goalHook = true;
  }
});
const sync = async () => {
  const p = await G(() => window.__seen || {});
  for (const [k, v] of Object.entries(p)) { const r = (seen[k] ||= { goals: [], target: false, scene: false }); for (const x of v.goals) if (!r.goals.includes(x)) r.goals.push(x); r.target ||= v.target; r.scene ||= v.scene; }
};
async function goals(id) {
  await sync();
  const defs = await G((id) => window.__game.debug.game.missions.defs.find((d) => d.id === id).steps.map((s) => s.objective), id);
  const bad = defs.map((obj, i) => {
    const r = seen[`${id}:${i}`], base = obj.replace(/\s*\(0\/\d\)$/, '');
    return !r ? `${i}: never reached` : !r.goals.some((x) => x.startsWith(base)) ? `${i}: "${r.goals.join('" / "')}"` : !(r.target || r.scene) ? `${i}: no target` : null;
  }).filter(Boolean);
  check(`mission ${id}: every step's goal on screen, each with a target for the arrow or a scene playing (${defs.length} steps)`, bad.length === 0, bad.join(' | '));
}
// a reload in the middle: what was recorded kept, the page reloaded, "continue", the recorder hooked again
async function reloadHere() { await sync(); const s = await t.reload(); await hookGoals(); return s; }
await hookGoals();

// ================================================================== 50: the fall ==================================================================
async function fall() {
  const heard = heardIn('fall');
  const HP = (lx, lz) => G(([lx, lz]) => { const h = window.__game.debug.world.places.citadel.mainHall; return { x: h.centre.x + lx - 72, z: h.centre.z + lz, y: h.y }; }, [lx, lz]);
  const hallPt = (expr) => G((e) => window.__r.pt(new Function('h', `return (${e});`)(window.__game.debug.world.places.citadel.mainHall)), expr);

  // ---------- 0: into the main hall; the Shadow on the giant screen ----------
  let s = await S();
  check('mission 50 begins from a placed save (47–49 done)', s.mission?.id === 'fall' && s.mission.step === 0, JSON.stringify(s.mission));
  check('50 · step 0: its goal', await objective(0, /להיכנס לאולם המרכזי/), s.objective);
  // where 49 leaves him: at the energy hall's door on bridge A, 7 m up the tower's west face (the main door sealed from inside)
  const at0 = await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, E = Z.energyHall, p = g.player.pos, mu = g.npc('muller');
    return { d: +Math.hypot(p.x - E.doorOutside.x, p.z - E.doorOutside.z).toFixed(2), dy: +(p.y - E.doorOutside.y).toFixed(2), energy: E.door.open && !E.door.locked, sealed: Z.mainHall.door.locked && !Z.mainHall.door.open, squad: g.squad.ids.length, mullerIn: g.squad.ids.includes('muller'),
      muller: mu.visible && Math.hypot(mu.pos.x - Z.computer.at.x, mu.pos.z - Z.computer.at.z) < 1, gang: g.squad.ids.every((id) => { const n = g.npc(id); return n.visible && Math.abs(n.pos.y - p.y) < 1.5 && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 14; }) }; });
  check('begins where 49 ends: at the energy hall\'s door on bridge A at +7, that door open, the main door sealed, the seven with him on the bridge, Muller at the main computer', at0.d < 1.5 && Math.abs(at0.dy) < 0.5 && at0.energy && at0.sealed && at0.squad === 7 && !at0.mullerIn && at0.muller && at0.gang, JSON.stringify(at0));
  const way = await G(() => { const Z = window.__game.debug.world.places.citadel, E = Z.energyHall, h = Z.mainHall, q = (p) => ({ x: p.x, z: p.z, y: p.y }); return [q(E.doorInside), q(E.stairsTop), { x: h.stairsAt.x - 3.5, z: h.stairsAt.z, y: h.y }, { x: h.centre.x + 97 - 72, z: h.centre.z - 22, y: h.y }]; });
  let r0 = 'ok';
  for (const p of way) { r0 = await tp(p, 0, 0, null, { near: 0.8 }); if (r0 !== 'ok') break; }
  check('walked in with the stick: through the energy hall\'s door, across the energy hall and down its stairs into the main hall, where the screen comes on', r0 === 'a scene', r0);
  s = await talkThrough((s) => s.mission?.step === 1 && !s.cutscene, 60, 'the screen scene');
  check('the Shadow on the screen, and Nehorai\'s answer, word for word', !!s && heard('shadowStop') && heard('iKnow'), t.heard.slice(0, 4).join(' | '));
  const down = await G(() => { const g = window.__game.debug.game, h = window.__game.debug.world.places.citadel.mainHall; return g.squad.ids.map((id) => { const n = g.npc(id), lx = n.pos.x - h.centre.x + 72, lz = n.pos.z - h.centre.z; return [id, Math.abs(n.pos.y - h.y) < 1 && lx > 32.6 && lx < 111.6 && Math.abs(lz) < 35.6]; }); });
  check('the gang came in and down the stairs with him (all seven on the main hall\'s floor)', down.length === 7 && down.every(([, ok]) => ok), JSON.stringify(down));

  // ---------- 1: the hall's defence ----------
  check('50 · step 1 (cp): its goal', await objective(1, /^לפגוע בשלושת מוקדי ההגנה \(0\/3\)$/), (await S()).objective);
  s = await until((s) => /מולר פותח את מוקד 1/.test(s.pill), 4, 'Muller at work on the first node');
  check('Muller opens the nodes from the main computer (the pill counts)', !!s, s?.pill);
  check('the defence wakes and the Order opens the sealed main door from the compound', await G(() => { const d = window.__game.debug.world.places.citadel.mainHall.door; return d.open && !d.locked; }));
  s = await talkThrough(() => said('השער הראשי נפתח מבחוץ! הם באים מהחצר!', 'מולר'), 10, 'Muller on the radio');
  check('Muller on the radio: "השער הראשי נפתח מבחוץ! הם באים מהחצר!"', !!s);
  await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
  s = await until((s) => s.fail, 4, 'the fail');
  const reason = await G(() => document.getElementById('failReason')?.textContent || '');
  check('50: three marks fail the defence, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /עמוד/.test(reason), reason);
  await page.tap('#retryBtn');
  s = await until((s) => s.mission?.step === 1 && !s.fail && s.hits === 0 && s.mission.s.down === 0, 10, 'the retry');
  check('50: retry at the defence\'s checkpoint, marks cleared, no node out', !!s);
  let fails = 0, shot = false, lastSt = null;
  const locked = new Set();
  async function nodes() {
    for (let n = 0; n < 3; n++) {
      // the next node Muller opens (whichever it is): its index
      s = await until((s) => s.fail || (s.mission?.s.down === n && s.mission.s.node >= 0), 24, `node ${n + 1} open`);
      if (!s || s.fail) return false;
      const k = s.mission.s.node;
      const at = await G((k) => window.__r.pt(window.__game.debug.world.places.citadel.mainHall.defence.nodes[k].at), k);
      const r = await tp(at, 0, 0, null, { near: 0.6 });
      if (r === 'a fail') return false;
      for (let i = 0; i < 40; i++) {
        const st = await G((k) => { const g = window.__game.debug.game, r = g.missions.active?.nodes?.[k]; if (!r) return null; const me = g.player.pos; const y = Math.atan2(r.x - me.x, r.z - me.z); g.player.yaw = y; g.follow.snapBehind(y); return { done: r.done, fail: !g.hud.el.fail.hidden, attacks: g.energy.active, lock: g.paint.lock === r.t ? 'node' : g.paint.lock ? (g.paint.lock.npc?.id || 'other') : null, d: +Math.hypot(r.x - me.x, r.z - me.z).toFixed(2), on: r.t.on, open: r.open, seen: g.paint.clear(me.x, me.y + 1.3, me.z, r.t.pos.x, r.t.pos.y + r.t.aimY, r.t.pos.z, g.player), me: [+me.x.toFixed(1), +me.z.toFixed(1)] }; }, k);
        lastSt = { k, ...st };
        if (!st || st.done || st.fail) break;
        if (st.lock === 'node') locked.add(k);
        if (!shot && n === 1 && st.attacks > 0) { shot = true; await snap('v50-defence'); }
        // knocked off his spot by an attack: back to it with the stick, as a player would
        if (Math.hypot(st.me[0] - at.x, st.me[1] - at.z) > 1.2) { await tp(at, 0, 0, null, { near: 0.6, max: 10 }); continue; }
        await fire(); await step(0.3);
      }
      s = await S();
      if (s.fail || s.mission?.s.down !== n + 1) return false;
    }
    return true;
  }
  let won = false;
  for (let a = 0; a < 4 && !won; a++) {
    won = await nodes();
    if (!won && (await S()).fail) { fails++; await page.tap('#retryBtn'); await until((s) => s.mission?.step === 1 && !s.fail, 10, 'a retry'); }
    else if (!won) break;
  }
  must('the three control nodes shot out with the real fire button (the hall\'s defence beaten)', won, `retries on the way: ${fails}${won ? '' : `; last: ${JSON.stringify(lastSt)}`}`);
  check('the marker locked on to each open node it was turned to (the crosshair on it)', locked.size === 3, [...locked].join(','));
  await t.listen();
  check('Erez calls the first node as it opens (by the screen, on the left)', said('נהוראי! הראשון נפתח — ליד המסך, בצד שמאל!', 'ארז'), t.heard.filter((l) => /ארז|עידו/.test(l)).slice(-8).join(' | '));
  s = await until((s) => s.mission?.step >= 2, 6, 'the strong attack');
  check('the defence is down: on to the strong attack', s?.mission?.step >= 2, s?.objective);

  // ---------- 2: the fall ----------
  s = await until((s) => s.mission?.step === 2 && s.dialogue, 30, 'Ido\'s cry');
  const thrown = await G(() => { const g = window.__game.debug.game, h = window.__game.debug.world.places.citadel.mainHall, p = g.player.pos, d = g.paint.dropped; return { atWall: Math.hypot(p.x - h.thrownAt.x, p.z - h.thrownAt.z) < 0.8, dropped: !!d && Math.hypot(d.x - h.markerAt.x, d.z - h.markerAt.z) < 0.3, armed: g.paint.armed }; });
  check('thrown against the wall (a scripted fall, no Game Over): the marker on the floor, unarmed', thrown.atWall && thrown.dropped && !thrown.armed && !(await S()).fail, JSON.stringify(thrown));
  await snap('v50-fall');
  s = await talkThrough((s) => s.mission?.step === 3 && !s.cutscene, 90, 'the fall scene');
  check('Ido\'s cry, Erez, the Shadow in person, Erez between them — word for word', heard('idoCry') && heard('erezAnswer') && heard('shadowHero') && heard('erezStand'), t.heard.slice(0, 6).join(' | '));

  // ---------- 3–4: crawl to the cover, to the first-aid box ----------
  const hurt = async () => G(() => { const g = window.__game.debug.game, sh = g.npc('shadow'), e = g.npc('erez'), p = g.player.pos;
    const between = (e.pos.x - p.x) * (sh.pos.x - e.pos.x) + (e.pos.z - p.z) * (sh.pos.z - e.pos.z) > 0;
    return { crawling: !!g.player.crawling, pose: g.nehorai.pose, dropped: !!g.paint.dropped, armed: g.paint.armed, shadow: sh.visible, between, playing: g.playingAs }; });
  check('50 · step 3 (cp): its goal', await objective(3, /^לזחול אל המחסה$/), (await S()).objective);
  const h3 = await hurt();
  check('hurt: crawling (prone), the marker on the floor, the Shadow in person, Erez between them', h3.crawling && h3.pose === 'prone' && h3.dropped && !h3.armed && h3.shadow && h3.between && h3.playing === 'nehorai', JSON.stringify(h3));
  let r = await tp(await HP(70.8, 26.6), 0, 0, null, { near: 0.5, max: 60 });
  s = await until((s) => s.mission?.step === 4, 6, 'behind the cover');
  check('crawled behind the low cover with the stick', s?.mission?.step === 4, r);
  check('50 · step 4: its goal', await objective(4, /^להגיע לערכת העזרה הראשונה$/), (await S()).objective);
  r = await tp(await hallPt('h.medkitAt'), 0, 0, null, { near: 0.6, max: 90 });
  s = await until((s) => s.mission?.step === 5, 6, 'at the first-aid box');
  check('crawled to the first-aid box', s?.mission?.step === 5, r);

  // ---------- 5: the kit ----------
  check('50 · step 5: its goal', await objective(5, /^להשתמש בערכה$/), (await S()).objective);
  check('the kit is used with the real button', await interact('להשתמש בערכה', 6));
  s = await until((s) => s.mission?.step === 6, 10, 'the kit done');
  const band = await G(() => { const g = window.__game.debug.game, M = g.nehorai; return { head: !!M.bones.head.getObjectByName('bandage'), arm: !!(M.bones.elL || M.bones.armL || M.bones.shL)?.getObjectByName('wrap') }; });
  check('the bandage and the arm wrap go on', !!s && band.head && band.arm, JSON.stringify(band));

  // ---------- 6: helped up by Erez ----------
  check('50 · step 6: its goal', await objective(6, /^להיעזר בארז כדי לקום$/), (await S()).objective);
  s = await until(async () => (await G(() => { const g = window.__game.debug.game, e = g.npc('erez'), h = window.__game.debug.world.places.citadel.mainHall; return !e.target && Math.hypot(e.pos.x - h.medkitAt.x, e.pos.z - h.medkitAt.z) < 4; })), 8, 'Erez by him');
  r = await tp(await G(() => window.__r.pt(window.__game.debug.game.npc('erez').pos)), 0, 0, null, { near: 1.6, max: 30 });
  check('Erez helps him up (the real button)', await interact('לקום בעזרת ארז', 8));
  s = await until((s) => s.mission?.step === 7, 14, 'on his feet');
  check('on his feet again, no longer crawling', s?.mission?.step === 7 && !s.me.crawling, JSON.stringify(s?.me));

  // ---------- 7: the marker ----------
  check('50 · step 7: its goal', await objective(7, /^לאסוף את הרובה$/), (await S()).objective);
  r = await tp(await hallPt('h.markerAt'), 0, 0, null, { near: 0.8, max: 30 });
  check('the marker picked up with the real button', await interact('להרים את הרובה', 6));
  s = await until((s) => s.mission?.step === 8, 6, 'armed again');
  const arm = await G(() => { const g = window.__game.debug.game; return { armed: g.paint.armed, dropped: g.paint.dropped, kind: g.paint.player?.kind }; });
  check('armed again with his own marker (nothing left on the floor)', arm.armed && !arm.dropped, JSON.stringify(arm));

  // ---------- 8: the lines; 51 carries on ----------
  s = await talkThrough((s) => s.mission?.id !== 'fall', 60, 'the last lines');
  check('his answer to the Shadow, word for word', heard('yourProblem') && heard('shadowWhat') && heard('stopTalking'), t.heard.slice(-5).join(' | '));
  allLines('fall');
  await goals('fall');
  await step(0.5);
  s = await S();
  const hand = await G(() => { const g = window.__game.debug.game; return { prog: g.progress.done.includes('fall'), shadow: g.npc('shadow').visible, erez: g.npc('erez').visible, armed: g.paint.armed, crawling: g.player.crawling, as: g.playingAs, squad: g.squad.ids.length, resume: g.progress.resume?.id ?? null }; });
  check('carried on to mission 51 (no save placed): fall done, the Shadow before them, the gang in and armed, Nehorai on his feet', s.mission?.id === 'rift' && hand.prog && hand.shadow && hand.erez && hand.armed && !hand.crawling && hand.as === 'nehorai', JSON.stringify({ m: s.mission?.id, ...hand }));
}

// ================================================================== 51: the rift ==================================================================
async function rift(carried) {
  await t.markNow();
  const heard = heardIn('rift');
  const scene = () => G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, h = Z.mainHall, sh = g.npc('shadow'), e = g.npc('erez'), p = g.player.pos, M = g.nehorai;
    return { shadow: sh.visible, erez: e.visible, armed: g.paint.armed, kind: g.paint.player?.kind ?? null, bandage: !!M.bones.head.getObjectByName('bandage'), inHall: Math.abs(p.y - h.y) < 1 && Math.abs(p.x - h.centre.x) < 40, squad: g.squad.ids.length, muller: g.npc('muller').visible && Math.hypot(g.npc('muller').pos.x - Z.computer.at.x, g.npc('muller').pos.z - Z.computer.at.z) < 1, dim: g.dimensionName, as: g.playingAs, door: !Z.mainHall.door.locked }; });

  // ---------- 0: the duel ----------
  let s = await S();
  check(`mission 51 begins ${carried ? 'carried on from 50' : 'from a placed save (47–50 done)'}`, s.mission?.id === 'rift' && s.mission.step === 0, JSON.stringify(s.mission));
  check('51 · step 0 (cp): its goal', await objective(0, /^לפגוע בצל יחד עם ארז/), s.objective);
  const sc = await scene();
  check('the hall as 50 left it: the Shadow before them, Erez beside him, armed, the bandage on, the gang with him, Muller at the computer, the hall\'s door open', sc.shadow && sc.erez && sc.armed && sc.bandage && sc.inHall && sc.squad >= 6 && sc.muller && !sc.dim && sc.as === 'nehorai' && sc.door, JSON.stringify(sc));
  await step(1);
  await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
  s = await until((s) => s.fail, 4, 'the fail');
  const reason = await G(() => document.getElementById('failReason')?.textContent || '');
  check('51: three marks fail the duel, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /ארז/.test(reason), reason);
  await page.tap('#retryBtn');
  s = await until((s) => s.mission?.step === 0 && !s.fail && s.hits === 0, 10, 'the retry');
  const sc2 = await scene();
  check('51: retry at the duel\'s checkpoint, marks cleared, the hall staged again (the Shadow, Erez, the marker in hand, the gang, Muller)', !!s && sc2.shadow && sc2.erez && sc2.armed && sc2.squad >= 6 && sc2.muller, JSON.stringify(sc2));
  const duel = () => G(() => { const g = window.__game.debug.game, m = g.missions.active, sh = g.npc('shadow'), p = g.player.pos; return { step: m?.stepIndex, phase: m?.D?.phase, hp: m?.foe?.hp, vul: !!m?.foe?.vulnerable, d: Math.hypot(sh.pos.x - p.x, sh.pos.z - p.z), sh: window.__r.pt(sh.pos), fail: !g.hud.el.fail.hidden }; });
  let fails = 0, opened = 0, shotPic = false;
  for (let i = 0; i < 260; i++) {
    const d = await duel();
    if (d.step !== 0) break;
    if (d.fail) { fails++; await page.tap('#retryBtn'); await until((s) => s.mission?.step === 0 && !s.fail, 10, 'a retry'); continue; }
    if (d.vul) {
      opened++;
      if (d.d > 11) { const me = await G(() => window.__r.pt(window.__game.debug.game.player.pos)), k = 7 / d.d; await tp({ x: d.sh.x + (me.x - d.sh.x) * k, z: d.sh.z + (me.z - d.sh.z) * k, y: me.y }, 0, 0, null, { near: 1.5, max: 12 }); continue; } // in to 7 m of him
      await G(() => { const g = window.__game.debug.game, sh = g.npc('shadow'), me = g.player.pos; const y = Math.atan2(sh.pos.x - me.x, sh.pos.z - me.z); g.player.yaw = y; g.follow.snapBehind(y); });
      if (!shotPic) { shotPic = true; await snap('v51-duel'); }
      await fire(); await step(0.2);
    } else await step(0.3);
  }
  s = await until((s) => s.mission?.step >= 1, 10, 'the orb');
  check('the duel won with the real fire button while his guard was down (Erez went round him)', s?.mission?.step >= 1, `windows seen ${opened}, retries ${fails}`);

  // ---------- 1: the orb, Muller on the radio, the throw, the portal ----------
  s = await until((s) => s.mission?.step === 1 && s.dialogue, 20, 'the orb\'s lines');
  await step(0.6);
  const orb = await G(() => { const m = window.__game.debug.game.missions.active; return m?.orb ? { r: m.orb.r, held: !!m.orb.held } : null; });
  check('the orb grows in the Shadow\'s hands', !!orb && orb.r > 0.3 && orb.held, JSON.stringify(orb));
  s = await talkThrough((s) => s.mission?.step === 2, 60, 'the orb scene');
  check('Muller on the radio, Nehorai, Muller, the Shadow — word for word', heard('mullerAway') && heard('whatMeans') && heard('mullerUniverse') && heard('shadowSee'), t.heard.slice(-6).join(' | '));
  const gate = await G(() => { const m = window.__game.debug.game.missions.active, p = m?.portal; return p ? { state: p.state, r: p.r } : null; });
  check('thrown: the orb became a portal, open and growing', !!gate && (gate.state === 'open' || gate.state === 'opening') && gate.r >= 1.8, JSON.stringify(gate));

  // ---------- 2: the pull; the pillar ----------
  check('51 · step 2: its goal', await objective(2, /^להחזיק בעמוד!$/), (await S()).objective);
  const dPortal = () => G(() => { const g = window.__game.debug.game, p = g.missions.active?.portal, me = g.player.pos; return p ? Math.hypot(p.pos.x - me.x, p.pos.z - me.z) : null; });
  const d0 = await dPortal(); await step(1.0); const d1 = await dPortal();
  check('the pull is real: standing still, he is dragged toward the portal', d1 < d0 - 1, `${d0?.toFixed(2)} → ${d1?.toFixed(2)} m`);
  await snap('v51-portal');
  const pil = await G(() => window.__r.pt(window.__game.debug.game.missions.active.pil.at));
  let r = await tp(pil, 0, 0, null, { near: 0.5, max: 40 });
  check('walked to the pillar with the stick, against the pull', r === 'ok', r);
  check('the prompt at the pillar', !!(await until((s) => s.prompt === 'להחזיק בעמוד', 6, 'the prompt')));
  await hold('btnInteract', true);
  await step(0.5);
  const a = await dPortal(); await step(1.2); const b = await dPortal(); await t.listen();
  check('held down with the real button: he stays where he is; Erez catches hold of him — word for word', Math.abs(b - a) < 0.05 && heard('erezHold'), `${a?.toFixed(2)} → ${b?.toFixed(2)} m; ${t.heard.slice(-2).join(' | ')}`);
  await hold('btnInteract', false);
  await step(0.6);
  const c = await dPortal();
  check('let go: the pull drags him again', c < b - 0.4, `${b?.toFixed(2)} → ${c?.toFixed(2)} m`);
  r = await tp(pil, 0, 0, null, { near: 0.5, max: 30 });
  await until((s) => s.prompt === 'להחזיק בעמוד', 6, 'the prompt again');
  await hold('btnInteract', true);
  s = await talkThrough((s) => s.mission?.id !== 'rift' || (s.cutscene && s.mission?.s.lost), 40, 'the grip giving');
  const lost = await G(() => { const g = window.__game.debug.game; return { lost: !!g.missions.active?.s.lost, fail: !g.hud.el.fail.hidden }; });
  check('the grip gives by script (no fail): both are drawn in', (lost.lost || s?.mission?.id !== 'rift') && !lost.fail, JSON.stringify(lost));
  await hold('btnInteract', false);
  s = await talkThrough((s) => (s.mission?.id === 'rift' && s.mission.s.silent) || s.mission?.id !== 'rift', 30, 'the white');
  const white = await G(() => { const g = window.__game.debug.game; return { white: g.overlay.state.white, music: g.sound?.atmosphere?.music ?? null, portals: g.rift.things.size }; });
  check('white, and silence (no music, the portal gone)', white.white > 0.98 && !white.music && white.portals === 0, JSON.stringify(white));
  check('Ido\'s cry as they go (the gang hold on at their pillars)', t.heard.some((l) => l.startsWith('עידו: נהוראי!!!')), t.heard.slice(-3).join(' | '));
  allLines('rift');
  // a hopper part used, so that the count that crosses is a telling one
  const before = await G(() => { const g = window.__game.debug.game, P = g.paint.player; if (P) { P.ammo = 5; g.hud.setAmmo(5, P.clip, false); } return { ammo: P?.ammo, kind: P?.kind, hp: g.fighter.hp, money: g.progress.money }; });

  // ---------- THE CROSSING (51 → 52), live ----------
  s = await until((s) => s.mission?.id === 'grove', 8, 'mission 52');
  await goals('rift');
  check('mission 52 begins, carried on under the white (no save placed)', s?.mission?.id === 'grove', JSON.stringify(s?.mission));
  s = await until((s) => s.dimension === 'grove' && !(s.mission?.s.p === 'white'), 30, 'the crossing');
  const over = await G(() => { const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove, Z = window.__game.debug.world.places.citadel, p = g.player.pos, e = g.npc('erez').pos, M = g.nehorai;
    const inHall = (n) => { const h = Z.mainHall; return n.visible ? Math.abs(n.pos.y - h.y) < 2.5 && Math.abs(n.pos.x - h.centre.x) < 41 && Math.abs(n.pos.z - h.centre.z) < 37 : true; };
    return { dim: g.dimensionName, layer: Q.isDimension(), me: Math.hypot(p.x - Q.landing.nehorai.x, p.z - Q.landing.nehorai.z), erez: Math.hypot(e.x - Q.landing.erez.x, e.z - Q.landing.erez.z), y: Math.abs(p.y - Q.y), ammo: g.paint.player?.ammo, kind: g.paint.player?.kind, armed: g.paint.armed, hp: g.fighter.hp, squad: g.squad.ids.join(','), done: g.progress.done.includes('rift'), money: g.progress.money,
      bandage: !!M.bones.head.getObjectByName('bandage'), wrap: !!(M.bones.elL || M.bones.armL || M.bones.shL)?.getObjectByName('wrap'), others: ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].filter((id) => g.npc(id).visible && Math.hypot(g.npc(id).pos.x - p.x, g.npc(id).pos.z - p.z) < 200), leftInHall: ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].every((id) => inHall(g.npc(id))), shadow: g.npc('shadow').visible, as: g.playingAs }; });
  check('the portal really carried them: Nehorai and Erez on the grove\'s lawn where they landed, in its dimension (the layer on)', over.dim === 'grove' && over.layer && over.me < 0.8 && over.erez < 1.2 && over.y < 0.3 && over.as === 'nehorai', JSON.stringify(over));
  check('across with them: the marker in hand, its kind and its ammo, the health, the money, the bandage and the arm wrap, Erez his squad, the progress', over.armed && over.ammo === before.ammo && over.kind === before.kind && over.hp >= before.hp && over.money >= before.money && over.bandage && over.wrap && over.squad === 'erez' && over.done, JSON.stringify({ before, over }));
  check('the rest of the gang not over here (left in the hall, nobody lost), the Shadow not with them', over.others.length === 0 && over.leftInHall && !over.shadow, JSON.stringify({ others: over.others, leftInHall: over.leftInHall, shadow: over.shadow }));
}

// ================================================================== 52: the grove ==================================================================
async function grove(carried) {
  await t.markNow();
  const heard = heardIn('grove');
  const where = () => G(() => { const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove, p = g.player.pos, e = g.npc('erez'), M = g.nehorai;
    return { dim: g.dimensionName, inGrove: p.x > Q.box.x0 && p.x < Q.box.x1 && p.z > Q.box.z0 && p.z < Q.box.z1 && Math.abs(p.y - Q.y) < 0.6, me: Math.hypot(p.x - Q.landing.nehorai.x, p.z - Q.landing.nehorai.z), erez: e.visible ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : null, erezLanding: Math.hypot(e.pos.x - Q.landing.erez.x, e.pos.z - Q.landing.erez.z),
      armed: g.paint.armed, kind: g.paint.player?.kind ?? null, ammo: g.paint.player?.ammo ?? null, hp: g.fighter.hp, money: g.progress.money, done: g.progress.done.length, squad: g.squad.ids.join(','), others: ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].filter((id) => g.npc(id).visible && Math.hypot(g.npc(id).pos.x - p.x, g.npc(id).pos.z - p.z) < 200), bandage: !!M.bones.head.getObjectByName('bandage'), layer: Q.isDimension(), white: g.overlay.state.white, as: g.playingAs }; });

  // ---------- 0: the white, the crossing, the grove; "לקום"; the lines ----------
  let s = await S();
  if (!carried) check('mission 52 begins from a placed save (47–51 done)', s.mission?.id === 'grove' && s.mission.step === 0, JSON.stringify(s.mission));
  const before = await G(() => { const g = window.__game.debug.game; return { hp: g.fighter.hp, money: g.progress.money, done: g.progress.done.length }; });
  check('52 · step 0: its goal', await objective(0, /^לקום$/), s.objective);
  s = await until((s) => s.mission?.s.p === 'down' && !s.dialogue, 40, 'the landing');
  let w = await where();
  check('down on the grove\'s lawn where they landed, in its dimension (the white gone)', !!s && w.dim === 'grove' && w.layer && w.inGrove && w.me < 0.8 && w.erezLanding < 1.2 && w.white < 0.05, JSON.stringify(w));
  check('the health, the money and the progress untouched; his marker in his hands, Erez his squad, the rest of the gang not over here', w.hp === before.hp && w.money === before.money && w.done === before.done && w.armed && w.squad === 'erez' && w.others.length === 0 && w.as === 'nehorai', JSON.stringify({ before, w }));
  await snap('v52-landing');
  check('"לקום" with the real button', await interact('לקום', 6));
  s = await talkThrough((s) => s.mission?.step === 1, 40, 'the lines');
  check('the lines, word for word: where, Erez\'s parallel universe, the grove, the sky', heard('where') && heard('erezParallel') && heard('itsTheGrove') && heard('erezSky'), t.heard.slice(-5).join(' | '));
  w = await where();
  check('on his feet, Erez beside him', w.erez != null && w.erez < 4 && !(await G(() => !!window.__game.debug.game.player.scripted)), JSON.stringify(w));

  // ---------- 1: the look at the sky: a real drag up on the screen ----------
  check('52 · step 1: its goal', await objective(1, /^להסתכל על השמיים$/), (await S()).objective);
  await step(0.5);
  const pitch0 = await G(() => window.__game.debug.game.follow.pitch);
  await page.mouse.move(560, 270); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(560, 270 - i * 20); await step(1 / 30); }
  await page.mouse.up(); await step(0.2);
  const pitch1 = await G(() => window.__game.debug.game.follow.pitch);
  s = await until((s) => s.mission?.s.p === 'shot', 4, 'the shot of the sky');
  check('dragged up on the screen: his own look goes up to the sky, and the shot takes it', pitch1 < pitch0 - 0.3 && !!s && s.mission.s.looked === true, `${pitch0.toFixed(2)} → ${pitch1.toFixed(2)}`);
  await step(1.0);
  await snap('v52-sky');
  s = await talkThrough((s) => s.mission?.step === 2, 30, 'the moons\' lines');
  check('two moons: Nehorai and Erez remark on it', t.heard.some((l) => l.startsWith('נהוראי: שני ירחים')) && t.heard.some((l) => l.startsWith('ארז:')), t.heard.slice(-2).join(' | '));
  allLines('grove');

  // ---------- 2 (cp): the walk with Erez; THE reload of the group first ----------
  check('52 · step 2 (cp): its goal', await objective(2, /^ללכת עם ארז אל השביל$/), (await S()).objective);
  await step(0.5);
  s = await reloadHere();
  s = await until((s) => s.mission?.id === 'grove' && s.mission.step === 2 && !s.cutscene, 40, 'the checkpoint after the reload');
  w = await where();
  check('after a reload: the walk again, back in the grove\'s dimension — the two on the lawn, armed, the bandage on, Erez his squad, nobody else', !!s && w.dim === 'grove' && w.layer && w.inGrove && w.armed && w.bandage && w.erez != null && w.erez < 5 && w.squad === 'erez' && w.others.length === 0 && w.as === 'nehorai', JSON.stringify(w));
  const wall = await G(() => { const g = window.__game.debug.game, m = g.missions.active, tg = m.def.steps[2].target(m, g); return tg && { x: tg.x, z: tg.z, y: tg.y }; });
  check('the arrow points to the path at the first wall', !!wall && Math.abs(wall.x - 1216) < 3, JSON.stringify(wall));
  check('every wall of energy still stands (53 opens them)', (await G(() => window.__game.debug.world.places.grove.seals.map((x) => x.isOpen))).every((o) => !o));
  const half = await G(() => { const p = window.__game.debug.game.player.pos; return { x: p.x - 6, z: p.z - 9, y: p.y }; });
  let r = await tp(half, 0, 0, null, { near: 1.0, max: 30 });
  await step(1.5); await t.listen();
  const mid = await where();
  r = await tp(wall, 0, 0, null, { near: 1.2, max: 40 });
  check('walked to the wall with the stick, Erez with him at his own pace', (r === 'ok' || r === 'a scene') && mid.erez != null && mid.erez < 7 && mid.erezLanding > 4, `${r}; Erez ${mid.erez?.toFixed(1)} m from him half way, ${mid.erezLanding.toFixed(1)} m from where he stood`);
  s = await until((s) => s.mission?.s.p === 'wall', 6, 'the wall');
  await step(1.2);
  await snap('v52-wall');
  s = await talkThrough((s) => s.mission?.id !== 'grove', 40, 'the wall\'s lines');
  check('Erez on the way (the bulbs, the swings) and at the wall', t.heard.some((l) => l.startsWith('ארז: והנורות')) && t.heard.some((l) => l.startsWith('ארז: הנדנדות')) && t.heard.some((l) => l.startsWith('ארז: קיר של אנרגיה')), t.heard.slice(-6).join(' | '));
  s = await until((s) => s.mission?.id === 'secret', 8, 'mission 53');
  await goals('grove');
  w = await where();
  check('carried on to mission 53 (no save placed), still in the grove\'s dimension, Erez with him', s?.mission?.id === 'secret' && w.dim === 'grove' && w.inGrove && w.erez != null && w.erez < 6 && (await G(() => window.__game.debug.game.progress.done.includes('grove'))), JSON.stringify({ m: s?.mission, w }));
}

// ================================================================== 53: the secret ==================================================================
async function secret(carried, { reload = false } = {}) {
  await t.markNow();
  const heard = heardIn('secret');
  const fire53 = async () => { await fire(); await step(1 / 30); };
  const where = () => QQ(`(() => { const p = g.player.pos, e = g.npc('erez');
    return { dim: g.dimensionName, layer: Q.isDimension(), x: p.x, z: p.z, y: p.y, erez: e.visible ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : null, erezY: e.pos.y,
      armed: g.paint.armed, kind: g.paint.player ? g.paint.player.kind : null, bandage: !!g.nehorai.bones.head.getObjectByName('bandage'), squad: g.squad.ids.join(','), as: g.playingAs,
      lit: Q.symbols.map((s) => s.lit), open: Q.seals.map((s) => s.isOpen), hits: g.paint.hits }; })()`);
  const tgt = () => QQ('(() => { const s = m.def.steps[m.stepIndex]; const x = s.target && s.target(m, g); return x && { x: x.x, z: x.z, y: x.y }; })()');
  const face = (p) => G((p) => { const g = window.__game.debug.game, me = g.player.pos, y = Math.atan2(p.x - me.x, p.z - me.z); g.player.yaw = y; g.follow.snapBehind(y); }, p);
  // the stick: round and round the clearing's middle at radius R (out of a warned ring, sideways off a bolt's line); off with null
  const circle = (R) => G((R) => { const g = window.__game.debug.game, c = window.__game.debug.world.places.grove.arena.centre;
    if (R == null) { g.botInput = null; return; }
    g.botInput = (input) => {
      if (g.mode !== 'foot' || g.cutscene) return input;
      const p = g.player.pos, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1, k = (R - d) * 0.7;
      let tx = -dz / d + (dx / d) * k, tz = dx / d + (dz / d) * k;
      let ex = 0, ez = 0; for (const a of g.energy.attacks || []) { if (a.kind !== 'ring' || a.done || a.burst) continue; const qx = p.x - a.x, qz = p.z - a.z, q = Math.hypot(qx, qz); if (q < a.r + 1.0) { ex += q > 0.05 ? qx / q : -dz / d; ez += q > 0.05 ? qz / q : dx / d; } }
      for (const a of g.energy.attacks || []) { if (a.kind !== 'bolt' || a.done || !a.flying || a.target !== g.player) continue; const qx = p.x - a.x, qz = p.z - a.z; if (Math.hypot(qx, qz) > 9 || qx * a.dx + qz * a.dz < 0) continue; let sx = -a.dz, sz = a.dx; if (qx * sx + qz * sz < 0) { sx = -sx; sz = -sz; } ex += sx * 1.5; ez += sz * 1.5; }
      if (ex || ez) { tx = ex; tz = ez; }
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const cy = g.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
      return { ...input, move: { x: tx * rx + tz * rz, y: tx * fx + tz * fz }, run: true };
    };
  }, R);
  const nudge = async (yaw, sec) => { await G((yaw) => { const g = window.__game.debug.game; g.botInput = (input) => { const cy = g.follow.yaw, tx = Math.sin(yaw), tz = Math.cos(yaw); return { ...input, move: { x: tx * Math.cos(cy) - tz * Math.sin(cy), y: -tx * Math.sin(cy) - tz * Math.cos(cy) }, run: false }; }; }, yaw); await step(sec); await G(() => { window.__game.debug.game.botInput = null; }); };
  // the walker plans from firm ground only: at a stone's edge (or on one fading) a short push of the stick toward the
  // goal first, as a player would, so that no leg of the path is ever put down by hand
  async function walk53(to, dx, dz, yaw, opts = {}) {
    for (let k = 0; k < 5 && !(await G(({ to, near }) => !!window.__w.plan({ x: to.x, z: to.z, y: to.y, near }), { to, near: opts.near ?? 0.7 })); k++) {
      const me = await QQ('({ x: g.player.pos.x, z: g.player.pos.z })');
      await nudge(Math.atan2(to.x - me.x, to.z - me.z), 0.3);
    }
    return tp(to, dx, dz, yaw, opts);
  }
  const clearWay = (to, balls, r = 2.0) => QQ(`(() => { const a = g.player.pos, b = ${JSON.stringify(to)}, list = ${balls};
    const seg = (p) => { const vx = b.x - a.x, vz = b.z - a.z, l = vx * vx + vz * vz || 1, k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l)); return Math.hypot(a.x + vx * k - p.x, a.z + vz * k - p.z); };
    return list.every((d) => d.frozen || seg(d.pos) > ${r}); })()`);
  async function slipTo(to, balls, what, tries = 6) { // wait for a gap, then go; knocked back: again
    for (let k = 0; k < tries; k++) {
      await until(() => clearWay(to, balls), 12, `a gap (${what})`, 1 / 15);
      await walk53(to, 0, 0, null, { near: 0.6, max: 20 });
      if (near(await QQ('({ x: g.player.pos.x, z: g.player.pos.z })'), to, 1.2)) return true;
    }
    return false;
  }

  // ---------- 0: the walkie-talkie ----------
  let s = await S();
  check(`mission 53 begins ${carried ? 'carried on from 52' : 'from a placed save (47–52 done)'}`, s.mission?.id === 'secret' && s.mission.step === 0, JSON.stringify(s.mission));
  check('53 · step 0: its goal', await objective(0, /^לנסות את מכשיר הקשר$/), s.objective);
  let w = await where();
  const wallAt = await QQ('(() => { const s = m.def.startAt(g); return { x: s.x, z: s.z }; })()');
  check('in the grove\'s dimension at the first wall: Erez with him, his marker in hand, the bandage on, every wall shut', w.dim === 'grove' && w.layer && near(w, wallAt, 2.5) && w.erez != null && w.erez < 5 && w.armed && w.bandage && w.squad === 'erez' && w.as === 'nehorai' && w.open.every((o) => !o), JSON.stringify({ w, wallAt }));
  check('"לנסות את מכשיר הקשר" with the real button', await interact('לנסות את מכשיר הקשר', 6));
  let notice = '';
  s = await talkThrough(async (s) => { if (!notice) notice = await G(() => { const o = window.__game.debug.game.overlay; return o.noticeEl?.classList.contains('on') ? o.noticeEl.textContent : ''; }); return s.mission?.step === 1; }, 40, 'the radio');
  check('static, and the notice word for word', notice === CARDS.dimension, notice);
  check('the lines, word for word: "חייבים למצוא דרך לחזור", "אני איתך"', heard('mustReturn') && heard('withYou'), t.heard.slice(-3).join(' | '));
  allLines('secret');

  // ---------- 1 (cp): a. the three symbols ----------
  check('53 · step 1 (cp): its goal', await objective(1, /^א\. למצוא את מקור האנרגיה · סמלים \(0\/3\)/), (await S()).objective);
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
  await snap('v53-swings');
  w = await where();
  check('both swings moving (Nehorai pushing with the button, Erez on the other: his job): the second symbol lights, the next wall opens', w.lit[1] && w.open[1] && top.a0 > 0.28 && top.a1 > 0.28 && top.erez === 'on', JSON.stringify({ top, lit: w.lit, open: w.open }));
  s = await until(async () => (await QQ('m.A && m.A.erez')) === 'done' && !(await QQ('!!g.player.scripted')), 6, 'off the swings');
  check('both off the swings again, on their feet', !!s);
  check('the arrow points to the third symbol, by the goal', near(await tgt(), sym[2], 1.5), JSON.stringify(await tgt()));
  await tp({ x: sym[2].x + 1, z: sym[2].z + 6.5, y: sym[2].y }, 0, 0, null, { near: 1.0 });
  check('slipped through the ring of disturbances to the third symbol', await slipTo(sym[2], 'm.ring', 'the ring round the third symbol'));
  check('the third symbol switched on with the real button', await interact('להדליק את הסמל', 6));
  s = await talkThrough((s) => s.mission?.step === 2, 30, 'the lines after the symbols');
  w = await where();
  check('three symbols lit, every wall open; Erez\'s lines on the way', w.lit.every(Boolean) && w.open.every(Boolean) && t.heard.some((l) => l.startsWith('ארז: הקיר של גן המשחקים')) && t.heard.some((l) => l.startsWith('ארז: השביל נפתח')), JSON.stringify(w));

  // ---------- 2 (cp): b. the broken path: (a reload when the run began here), three marks and a retry, then the path ----------
  check('53 · step 2 (cp): its goal', await objective(2, /^ב\. לעבור את שביל המציאות השבורה/), (await S()).objective);
  const bp = await QQ('(() => { const b = Q.brokenPath, st = (n) => { const s = b.stones.find((x) => x.name === n); return { x: s.x, z: s.z, y: s.y }; }; const P = (q) => ({ x: q.x, z: q.z, y: q.y }); return { start: P(b.start), end: P(b.end), p0: st("platform 0"), a1: st("island A1"), from: P(b.leaps[0].from), sw0: P(b.switches[0].at), bottom: P(b.ledge.bottom), to: P(b.ledge.to), sw1: P(b.switches[1].at), landing: st("landing"), p6: st("platform 6"), y: Q.y }; })()');
  if (reload) {
    s = await reloadHere();
    s = await until((s) => s.mission?.id === 'secret' && s.mission.step === 2 && !s.cutscene, 40, 'the checkpoint after the reload');
    w = await where();
    check('after a reload: the path\'s checkpoint, in the dimension, on the bank where it begins, the symbols lit and the walls open, armed, the bandage on, Erez with him', !!s && w.dim === 'grove' && w.layer && near(w, bp.start, 1.5) && w.lit.every(Boolean) && w.open.every(Boolean) && w.armed && w.bandage && w.erez != null && w.erez < 5, JSON.stringify(w));
  }
  await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
  s = await until((s) => s.fail, 4, 'the fail');
  let reason = await G(() => document.getElementById('failReason')?.textContent || '');
  check('53: three marks on the path fail it, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /עמוד הכחול/.test(reason), reason);
  await page.tap('#retryBtn');
  s = await until((s) => s.mission?.step === 2 && !s.fail && s.hits === 0, 10, 'the retry');
  w = await where();
  check('53: retry on the bank at the path\'s start, marks cleared, Erez with him, the symbols still lit', !!s && near(w, bp.start, 1.5) && w.erez != null && w.erez < 5 && w.lit.every(Boolean), JSON.stringify(w));
  await step(0.5);
  await walk53(bp.p0, 0, 0, null, { near: 0.5 });
  let onA1 = false;
  for (let k = 0; k < 5 && !onA1; k++) {
    await until(() => QQ('(() => { const P = m.kit.platforms; return P[1].solid && P[2].solid && P[3].solid && P[1].left > 0.7; })()'), 8, 'the wave', 1 / 30);
    await walk53(bp.a1, 0, 0, null, { near: 0.8, max: 12 });
    const me = await where();
    onA1 = near(me, bp.a1, 2.5) && Math.abs(me.y - bp.a1.y) < 0.5;
  }
  check('over the wave of stones to the first island with the stick', onA1, `falls ${await QQ('m.kit.guard.falls')}`);
  await snap('v53-path');
  await slipTo(bp.from, 'm.kit.disturbances.slice(0, 1)', 'the ball on the islands');
  check('"לקפוץ" with the real button', await interact('לקפוץ', 6));
  s = await until(async () => { const me = await where(); return me.x < bp.from.x - 2 && Math.abs(me.y - bp.y) < 0.4 && !(await QQ('!!g.player.scripted')); }, 6, 'the landing');
  check('the leap to the second island', !!s);
  await nudge(-Math.PI / 2, 0.5);
  await slipTo(bp.sw0, 'm.kit.disturbances.slice(0, 1)', 'to the switch');
  check('"לייצב את האבנים" with the real button: the quick stones held', await interact('לייצב את האבנים', 6) && (await QQ('m.kit.platforms[4].solid && m.kit.platforms[5].solid && m.kit.platforms[4].left === Infinity')));
  r = await walk53(bp.bottom, 0, 0, -Math.PI / 2, { near: 0.5 });
  check('"לטפס" with the real button', await interact('לטפס', 6), r);
  s = await until(async () => (await where()).y > bp.y + 1.4 && !(await QQ('!!g.player.scripted')), 8, 'on the ledge');
  check('up the ledge; the bridge\'s switch waits for Erez', !!s && !(await QQ('m.kit.switches[1].enabled')));
  await walk53(bp.to, 0, 0, Math.PI / 2, { near: 0.5 });
  check('"לתת יד לארז" with the real button', await interact('לתת יד לארז', 10));
  s = await until(() => QQ('m.kit.hand.done'), 12, 'Erez up');
  const ez = await QQ('({ y: g.npc("erez").pos.y })');
  check('Erez hauled up the ledge (nobody left behind)', !!s && ez.y > bp.y + 1.3, JSON.stringify(ez));
  await walk53(bp.sw1, 0, 0, null, { near: 0.6 });
  check('"להרים את הגשר" with the real button: the bridge rises', await interact('להרים את הגשר', 6) && !!(await until(() => QQ('Q.brokenPath.bridge.k >= 1'), 4, 'the bridge')));
  await walk53(bp.landing, 0, 0, null, { near: 0.6 });
  let endOk = false;
  for (let k = 0; k < 4 && !endOk; k++) {
    if ((await S()).fail) break;
    await walk53(bp.landing, 0, 0, null, { near: 0.5 });
    await until(() => QQ('(() => { const d = m.kit.disturbances[1]; return Q.brokenPath.rect.x1 - d.pos.x > 45.0; })()'), 12, 'the ball at the far end', 1 / 30);
    await walk53({ x: bp.p6.x + 0.6, z: bp.p6.z + 1.0, y: bp.y }, 0, 0, null, { near: 0.6, max: 8 });
    await walk53(bp.end, 0, 0, null, { near: 0.6, max: 10 });
    endOk = near(await where(), bp.end, 1.5);
  }
  s = await until((s) => s.mission?.step === 3, 10, 'the far bank');
  check('over the bridge to the far bank with the stick: the path done', endOk && !!s, JSON.stringify(await where()));
  await t.listen();
  check('Erez on the path asks for a hand', t.heard.some((l) => l.startsWith('ארז: אחי, יד?')), t.heard.slice(-6).join(' | '));

  // ---------- 3 (cp): c. the Keeper: three marks and a retry, then the fight ----------
  check('53 · step 3 (cp): its goal', await objective(3, /^ג\. שומר הסף/), (await S()).objective);
  await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
  s = await until((s) => s.fail, 4, 'the fail');
  reason = await G(() => document.getElementById('failReason')?.textContent || '');
  check('53: three marks in the clearing fail it, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /צל/.test(reason), reason);
  await page.tap('#retryBtn');
  s = await until((s) => s.mission?.step === 3 && !s.fail && s.hits === 0, 10, 'the retry');
  const ar = await QQ('(() => { const A = Q.arena; return { c: { x: A.centre.x, z: A.centre.z, y: A.centre.y }, entry: { x: A.entry.x, z: A.entry.z, y: A.entry.y }, r: A.radius }; })()');
  w = await where();
  check('53: retry at the way into the clearing, Erez with him, marks cleared', !!s && near(w, ar.entry, 1.5) && w.erez < 5, JSON.stringify(w));
  const phase = () => QQ('m.K && m.K.phase');
  await tp({ x: ar.c.x - 5, z: ar.c.z + 3, y: ar.c.y }, 0, 0, null, { near: 1.0 });
  s = await until(async () => (await phase()) === 'rise', 6, 'the Keeper rising');
  const banner = await G(() => window.__game.debug.game.hud.el.bannerTitle?.textContent || '');
  check(`the Keeper rises in the clearing; the banner names him: ${KEEPER}`, !!s && banner === KEEPER, banner);
  await step(1.6);
  await snap('v53-keeper');
  s = await talkThrough(async () => (await phase()) === 'dodge', 20, 'his entrance');
  const ringNear = () => QQ('(g.energy.attacks || []).some((a) => !a.done && (a.kind === "ring" && !a.burst && Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z) < a.r + 1.0 || a.kind === "bolt" && a.target === g.player && (!a.flying || (g.player.pos.x - a.x) * a.dx + (g.player.pos.z - a.z) * a.dz > 0 && Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z) < 12)))');
  async function clearOfRings() { if (!(await ringNear())) return; await circle(4.2); await until(async () => !(await ringNear()), 5, 'out of the way of his energy', 1 / 15); await circle(null); }
  await G(() => { const P = window.__game.debug.game.paint, s0 = P.strike.bind(P); window.__hits53 = []; P.strike = (l, c) => { window.__hits53.push(l); return s0(l, c); }; });
  // the real one in his sights: faced; when a copy nearer to him has the marker's lock, a few steps toward the real
  // one first (with the stick), as a player would
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
      s = await until(async () => { await step(0.3); return QQ('m.K.spotted'); }, 12, 'Erez spotting the tell');
      const arrow = await tgt(), real = await QQ('({ x: m.foe.pos.x, z: m.foe.pos.z })');
      check('Erez spots the tell (the real one casts a shadow): the arrow on the real one', !!s && near(arrow, real, 0.5), JSON.stringify({ arrow, real }));
    } else {
      const c = await QQ('(() => { const i = m.foe.copyList.findIndex((q) => q.alive), c = m.foe.copyList[i]; return c && { x: c.pos.x, z: c.pos.z, i }; })()'), n0 = await QQ('m.foe.copies');
      if (c) { // (the marker locks on to the nearest in his sights: a few steps toward the copy first when another is nearer)
      const locked = () => QQ(`g.paint.lock === m.foe.copyList[${c.i}].target`);
      await face(c); await step(1 / 15);
      if (!(await locked())) { await tp(c, 0, 0, null, { near: 3.0, max: 6 }); await face(c); await step(1 / 15); }
      await fire53(); await step(0.3);
    }
      const n1 = await QQ('m.foe.copies');
      check('a copy marked pops (the real one answers with a warned bolt)', !!c && n1 === n0 - 1, `${n0} → ${n1}`);
    }
    let shots = 0;
    for (let k = 0; k < 20 && (await phase()) === 'copies'; k++) {
      const real = await QQ('m.foe && !m.foe.teleporting && { x: m.foe.pos.x, z: m.foe.pos.z }');
      await clearOfRings();
      if (real && (await aimReal())) { await fire53(); shots++; await step(0.4); }
      if ((await phase()) !== 'copies') break;
      await circle(4.2); await step(1.2); await circle(null);
    }
    s = await S();
    check(`round ${n}: the real one marked with the fire button (${shots} shots): the copies gone`, (await phase()) === 'anchors' && !s.fail && (await QQ('m.foe.copies')) === 0);
    if (call) check('"לקרוא לארז · שתי אבנים" with the real button', await interact('לקרוא לארז · שתי אבנים', 4));
    for (let k = 0; k < 6 && (await phase()) === 'anchors'; k++) {
      const a = await tgt();
      if (!a) break;
      if (await QQ(`Q.arena.anchors.every((x) => x.lit || ${call} && m.K.jobs.some((j) => j.a === x))`)) { await step(0.5); continue; }
      await tp(a, 0, 0, null, { near: 0.6, max: 25 });
      await clearOfRings();
      if (!(await QQ('Q.arena.anchors.some((x) => !x.lit && Math.hypot(x.at.x - g.player.pos.x, x.at.z - g.player.pos.z) < 1.7)'))) continue;
      await interact('להדליק את אבן העוגן', 4);
    }
    s = await until(async (s) => s.fail || (await phase()) === 'weak', 25, `round ${n}: every stone lit`);
    const by = await QQ('({ called: m.K.called, erezJobs: m.K.jobs.length })');
    check(`round ${n}: the four anchor stones lit (${call ? 'two by Erez on the call' : 'all by Nehorai while Erez draws him off'}): the weak point open`, !!s && !s.fail && (await QQ('m.foe.exposed')) && by.called === call, JSON.stringify(by));
    for (let k = 0; k < 20; k++) {
      if ((await phase()) !== 'weak') break;
      const at = await QQ('m.foe && { x: m.foe.pos.x, z: m.foe.pos.z }');
      await clearOfRings();
      if (at) { await face(at); await step(1 / 15); for (let i = 0; i < 3; i++) { await fire53(); await step(0.12); } }
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
  check('round 2 over: he bursts into light (no blood, no body); the crystal rises', r2 && !!s && (await QQ('!!m.crystal')));
  await step(1.0);
  s = await talkThrough((s) => s.mission?.step === 4, 20, 'the burst\'s lines');
  check('Erez on the tell; Erez and Nehorai at the burst', t.heard.some((l) => l.startsWith('ארז: תסתכל על הדשא')) && t.heard.some((l) => l.startsWith('ארז: הוא… התפוצץ לאור')), t.heard.slice(-6).join(' | '));

  // ---------- 4: the crystal; the radio back ----------
  check('53 · step 4: its goal', await objective(4, /^לאסוף את הגביש$/), (await S()).objective);
  // what 53 hands on, read as its cleanup ends (54 may restage its own scene at once)
  await G(() => { const g = window.__game.debug.game, d = g.missions.defs.find((x) => x.id === 'secret'); if (d.__handHook) return; const c0 = d.cleanup; d.__handHook = true;
    d.cleanup = function (m, game) { const r = c0.call(this, m, game); const p = g.player.pos, e = g.npc('erez'); window.__handed53 = { dim: g.dimensionName, static: !!g.rift.static, erez: e.visible ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : null, armed: g.paint.armed, as: g.playingAs, squad: g.squad.ids.join(',') }; return r; }; });
  await tp(await QQ('({ x: Q.crystalAt.x, z: Q.crystalAt.z, y: Q.y })'), 0, 0, null, { near: 1.0 });
  await snap('v53-crystal');
  check('"לאסוף את הגביש" with the real button', await interact('לאסוף את הגביש', 6));
  s = await talkThrough((s) => s.mission?.id !== 'secret', 30, 'the radio coming back');
  check('the radio crackles back to life: the lines', t.heard.some((l) => l.startsWith('ארז: שמעת? הקשר')), t.heard.slice(-4).join(' | '));
  s = await until((s) => s.mission?.id === 'gateback', 10, 'mission 54');
  await goals('secret');
  const end = await G(() => ({ done: window.__game.debug.game.progress.done.includes('secret'), handed: window.__handed53 || null }));
  check('mission 53 done; mission 54 begins, carried on: handed over in the grove\'s dimension, the radio back, Nehorai armed, Erez with him', !!s && end.done && !!end.handed && end.handed.dim === 'grove' && !end.handed.static && end.handed.armed && end.handed.as === 'nehorai' && end.handed.erez != null && end.handed.erez < 8 && end.handed.squad === 'erez', JSON.stringify({ m: s?.mission, ...end }));
}

// ================================================================== the run ==================================================================
// each mission from the first asked for, in turn. One that throws (a check it hangs on failed, so that what follows
// cannot be played) is reported and the run stops there; so does a mission that is not the one running when its
// turn comes (the one before did not hand on). Either way the run ends cleanly with the count
const RUN = [fall, rift, grove, secret];
for (let i = FROM; i < RUN.length; i++) {
  const now = (await S()).mission?.id ?? null;
  if (now !== ORDER[i]) { check(`${ORDER[i]}: begins (the run stops here)`, false, `running: ${now ?? 'no mission'}`); break; }
  const args = i === 3 ? [FROM < 3, { reload: FROM === 3 }] : [FROM < i];
  const ok = await RUN[i](...args).then(() => true, (e) => { check(`${ORDER[i]}: ran to its end`, false, e.stack?.split('\n').slice(0, 3).join(' | ')); return false; });
  if (!ok) break;
}
await t.finish();
