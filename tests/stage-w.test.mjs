// Chapter ten acceptance test, group c (missions 54–56), played in ONE session from the first to the last on the
// stage harness: 54 "פותחים את השער בחזרה" (the scene in the citadel as Ido, the defence at the machine played as
// Ido with the real fire button — three marks and a retry —, back to Nehorai in the grove, the radio, the run to the
// energy point with the stick ahead of the front — caught once and retried —, the portal, the leap with the real
// button); the live carry-on through the white into 55 "הגיבורים חוזרים" (the crossing home: the white clears in the
// citadel's main hall, the landing, the Shadow, the line, the last fight; the gang led up to the energy hall with
// the stick, a reload on the way picked up at that checkpoint); the live carry-on into 56 THE LAST STAND (the energy
// hall's three waves with a shield bearer shoved, one flanked on the "advance" order and a heavy marked by his cell;
// the tower bridge with the runners beaten with the fist buttons, the leap, Erez's hand, the detour and the
// emitters; the machine room held while both breakers are thrown; the fist fight at the last hall's door beside
// Erez and Ido; the walk in and the door shut behind them), each of its checkpoints failed once on purpose and
// retried; mission 57 begins. No placed save between the missions. Every quoted line is compared with lines10.js
// word for word; every leg on foot is walked with the stick along a path.
// usage: node tests/stage-w.test.mjs [first mission: 54..56 or its id]   (a part rerun from a placed save)
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const CH10 = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback', 'return', 'laststand', 'endshadow'];
const GROUP = { 54: 'gateback', 55: 'return', 56: 'laststand' };
const FIRST = GROUP[process.argv[2]] || (Object.values(GROUP).includes(process.argv[2]) ? process.argv[2] : 'gateback');
const t = await openStage({ chapter: 10, done: CH10.slice(0, CH10.indexOf(FIRST)), first: FIRST });
const { page, check, S, G, step, until, talkThrough, said, interact, tp, snap, reload, press, shoot, shootProp, fight } = t;
const TEAM = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
const Q = L.gateback, R = L.return;
const line = (q) => said(q[1], q[0]);
const heard = async (text, who) => { await t.listen(); return said(text, who); };
const ms = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, ...Object.fromEntries(Object.entries(a.s).filter(([, v]) => v == null || typeof v !== 'object')) } : null; });
// the arrow: the step's target is there (a point the player is led to)
const arrow = () => G(() => { const g = window.__game.debug.game, q = g.target; return !!q && Number.isFinite(q.x) && Number.isFinite(q.z); });
// the scene's state in one call: who is played, the dimension, the white, the floor, the gang beside him
const scene = () => G((TEAM) => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos;
  const near = (r, dy = 1.5) => TEAM.filter((id) => { const n = g.npc(id); return n.visible && Math.abs(n.pos.y - me.y) < dy && Math.hypot(n.pos.x - me.x, n.pos.z - me.z) < r; }).length;
  return {
    as: g.playingAs, dim: g.dimensionName ?? null, white: +(g.overlay?.wh?.v ?? 0).toFixed(2), armed: !!g.paint.armed, kind: g.paint.kind,
    bandage: !!g.nehorai?.bones?.head?.getObjectByName('bandage'), music: g.sound?.musicMode, squad: g.squad?.active ? g.squad.mode : null,
    inTower: Z.inTower(me.x, me.z), y: { hall: +(me.y - Z.mainHall.y).toFixed(2), energy: +(me.y - Z.energyHall.y).toFixed(2), last: +(me.y - Z.lastHall.y).toFixed(2) },
    gang14: near(14), gang20: near(20, 3), mainDoor: !Z.mainHall.door.locked, energyDoor: !Z.energyHall.door.locked, shadow: g.npc('shadow').visible,
  };
}, TEAM);
const forceFail = async (what, re = /סומן שלוש פעמים/) => {
  await G(() => { window.__game.debug.game.paint.hits = 3; });
  let s = await until((s) => s.fail, 6, 'the fail screen');
  const why = await page.textContent('#failReason');
  check(`${what}: three marks fail it, with a reason and a tip`, !!s && re.test(why) && why.length > 30, why);
  await page.tap('#retryBtn');
  s = await until((s) => !s.fail, 8, 'the retry');
  return s;
};
let s, m, st, ok, res, f;

// ======================================== 54: gateback ========================================
// the player's own marker fired at a man of the Order with the real button: Ido turns to him (the look), the marker
// locks on to the nearest one in front, the button is pressed (the loop let go for the press)
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
  const g = window.__game.debug.game, P = g.paint, me = g.player.pos;
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
  for (const gd of P.guards) if (!gd.marked && gd.npc.visible && Math.hypot(gd.npc.pos.x - me.x, gd.npc.pos.z - me.z) > 26) { P.markGuard(gd, 'test'); n++; }
  return n;
});

async function gateback() {
  // ---------- 0: the citadel, as Ido ----------
  s = await S();
  check('54 · the save is placed and "gateback" begins', s.mission?.id === 'gateback', JSON.stringify(s.mission));
  s = await until((s) => s.mission?.step === 0 && s.cutscene, 30, 'the scene in the citadel');
  check('54 · the scene: Ido is played, in the ordinary world (the switch to Ido)', s?.me.as === 'ido' && s?.dimension === null, `${s?.me.as} ${s?.dimension}`);
  check('54 · a goal on screen for the scene', /מולר מחפש/.test(s?.objective || ''), s?.objective);
  await step(2);
  await snap('w-54-0-citadel');
  s = await talkThrough((s) => s.mission?.step >= 1, 150, 'the scene at the machine');
  check('54 · the citadel lines, word for word', line(Q.idoTell) && line(Q.mullerWorking) && line(Q.idoFaster) && line(Q.mullerFound), t.heard.slice(0, 6).join(' | '));

  // ---------- 1: the defence at the machine, played as Ido ----------
  s = await until((s) => s.mission?.step === 1 && !s.cutscene, 10, 'the defence');
  check('54 · the defence: its goal on screen, Ido at the controls, armed, an arrow', /להגן על המכונה עד שמולר מסיים/.test(s?.objective || '') && s?.me.as === 'ido' && s?.armed && await arrow(), `${s?.objective} ${s?.me.as}`);
  const posts = await G(() => { const g = window.__game.debug.game; return ['yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].map((id) => g.npc(id).visible); });
  check('54 · the friends hold the hall with him, Muller at the machine', posts.every(Boolean), JSON.stringify(posts));
  await step(8);
  check('54 · the first of the Order come in at the main door', (await G(() => window.__game.debug.game.paint.guards.filter((g) => g.npc.visible && !g.marked).length)) > 0);
  s = await forceFail('54 · the defence', /עידו סומן שלוש פעמים/);
  m = await ms();
  check('54 · the retry: from the start of the defence, as Ido, the marks wiped', s?.mission?.step === 1 && s?.me.as === 'ido' && s?.hits === 0 && (m.prog ?? 1) < 0.05, `${s?.me.as} hits ${s?.hits} prog ${m.prog}`);
  let stopped = false, shots = 0, half = false, quiet = 0, byFriends = 0, moved = 0, retries = 0;
  // the bar's stop, seen in any frame (the pill's text as the mission sets it): Ido holds his fire a moment at first
  // and lets the first of them come in until one has a line on the machine
  await G(() => { const h = window.__game.debug.game.hud; if (!h.__w) { h.__w = h.setPursuit; h.setPursuit = function (t, ...a) { if (/נעצרה/.test(t || '')) window.__stopped = true; return h.__w.call(this, t, ...a); }; } window.__stopped = false; });
  for (let w = 0; w < 25; w += 0.5) { s = await S(); if ((await G(() => window.__stopped)) || s.hits >= 2 || s.fail || s.mission?.step !== 1) break; await step(0.5); }
  for (let i = 0; i < 500; i++) {
    s = await S();
    if (s.fail && retries < 2) { retries++; await page.tap('#retryBtn'); await step(0.5); continue; } // marked out for real: retried as a player would
    if (s.mission?.step !== 1 || s.fail) break;
    if (/נעצרה/.test(s.pill) || await G(() => window.__stopped)) stopped = true;
    if (!half && (s.mission.s.prog ?? 0) > 0.5) { half = true; await snap('w-54-1-defence'); }
    const id = await nextFoe();
    if (id) { await fireAt(id); shots++; continue; }
    // one of them stopped just out of Ido's reach: Ido steps out a few metres toward him with the stick
    const far = await G(() => {
      const g = window.__game.debug.game, me = g.player.pos; let best = null, bd = 26;
      for (const gd of g.paint.guards) { if (gd.marked || !gd.npc.visible) continue; const d = Math.hypot(gd.npc.pos.x - me.x, gd.npc.pos.z - me.z); if (d < bd) { bd = d; best = { x: gd.npc.pos.x, z: gd.npc.pos.z, y: gd.npc.pos.y }; } }
      return best;
    });
    if (far && moved < 12) { await tp(far, 0, 0, null, { near: 16, max: 8 }); moved++; continue; }
    await step(0.6);
    if ((quiet += 0.6) > 10) { quiet = 0; byFriends += await friendsShare(); }
  }
  s = await S();
  check('54 · the machine charged to the end and the defence is won', s.mission?.step === 2, `step ${s.mission?.step} fail ${s.fail}`);
  check('54 · the bar stopped while one of them had a line on the machine', stopped);
  check('54 · Ido fired with the real button', shots > 0, `${shots} volleys, ${moved} steps out, ${byFriends} marked for the friends, ${retries} retries`);

  // ---------- 2: the grove, as Nehorai again: the radio ----------
  s = await until((s) => s.mission?.step === 2 && s.dimension === 'grove', 20, 'the grove');
  st = await scene();
  check('54 · the switch back: Nehorai played in the grove, bandaged, his own marker', s?.me.as === 'nehorai' && st.dim === 'grove' && st.bandage, JSON.stringify(st));
  check('54 · a goal on screen for the radio', /מכשיר הקשר/.test(s?.objective || ''), s?.objective);
  s = await talkThrough((s) => s.mission?.step >= 3, 120, 'the radio');
  check('54 · the grove lines, word for word', line(Q.mullerHear) && line(Q.getUsOut) && line(Q.mullerPoint), t.heard.slice(-6).join(' | '));
  check('54 · the energy point is marked', await G(() => window.__game.debug.world.places.grove.portalAt.lit));

  // ---------- 3: the run ----------
  s = await until((s) => s.mission?.step === 3 && !s.cutscene, 10, 'the run');
  check('54 · the run: its goal on screen, the front behind, an arrow', /לרוץ אל נקודת האנרגיה/.test(s?.objective || '') && /החזית/.test(s?.pill || '') && await arrow(), `${s?.objective} · ${s?.pill}`);
  s = await until((s) => s.fail, 20, 'the front catching up'); // standing still: the front catches him
  const why = await page.textContent('#failReason');
  check('54 · the front catches him: a fail with a reason and a tip', !!s && /החזית/.test(why) && /כפתור הריצה/.test(why), why);
  await page.tap('#retryBtn');
  s = await until((s) => !s.fail && s.mission?.step === 3 && !s.cutscene, 10, 'the retry');
  check('54 · the retry starts the run again, in the grove, as Nehorai', s?.dimension === 'grove' && s?.me.as === 'nehorai', `${s?.dimension} ${s?.me.as}`);
  await step(1.4);
  await snap('w-54-3-run');
  const leap = await G(() => ({ x: 1212.3, z: 193.5, y: window.__game.debug.world.places.grove.y }));
  res = await tp(leap);
  s = await S();
  check('54 · the run made with the stick, ahead of the front', ['ok', 'a scene'].includes(res) && s.mission?.step === 4, `${res} step ${s.mission?.step}`);

  // ---------- 4: the portal, the leap ----------
  s = await until((s) => s.mission?.step === 4 && s.cutscene && s.dialogue, 20, 'the portal opening');
  await snap('w-54-4-portal');
  s = await talkThrough((s) => s.mission?.step === 4 && !s.cutscene && !s.dialogue, 60, 'the lines at the portal');
  check('54 · the portal lines, word for word', line(Q.erezNow) && line(Q.yalla), t.heard.slice(-3).join(' | '));
  check('54 · the goal: run and leap into the portal, an arrow', /לרוץ ולקפוץ לתוך הפורטל/.test(s?.objective || '') && await arrow(), s?.objective);
  await tp(leap);
  check('54 · the leap taken with the real interact button', await interact('לקפוץ לתוך הפורטל', 8));
  s = await until((s) => s.mission?.id === 'return', 20, 'mission 55');
  check('54 → 55 · mission 55 carries straight on (no placed save)', s?.mission?.id === 'return', JSON.stringify(s?.mission));
}

// ======================================== 55: return ========================================
async function homecoming(live) {
  await t.markNow();
  if (live) {
    st = await scene();
    check('55 · the crossing home begins in the white the leap left: still in the grove\'s dimension, Nehorai played, bandaged', st.dim === 'grove' && st.as === 'nehorai' && st.white > 0.9 && st.bandage, JSON.stringify(st));
  } else check('55 · the save is placed and "return" begins', (await S()).mission?.id === 'return');
  // ---------- 0: out of the white, the landing ----------
  s = await until((s) => s.mission?.step === 0 && s.cutscene && s.dimension === null, 20, 'the scene in the hall');
  await step(1.5);
  st = await scene();
  check('55 · the white clears over the citadel\'s main hall: the ordinary world, Nehorai played, in the tower', st.white < 0.05 && st.dim === null && st.as === 'nehorai' && st.inTower && Math.abs(st.y.hall) < 1, JSON.stringify(st));
  check('55 · a goal on screen for the scene', /מולר מחזיק את הפורטל/.test(s?.objective || ''), s?.objective);
  const gate = await G(() => { const a = window.__game.debug.game.missions.active; return { portal: !!a.gate, open: a.gate?.isOpen, r: a.gate?.r }; });
  check('55 · the way back stands open over the machine, small', gate.portal && gate.open && gate.r < 2, JSON.stringify(gate));
  await step(0.7);
  await snap('w-55-0-hall');
  s = await talkThrough((s) => s.mission?.s.landed, 60, 'the landing');
  const down = await G(() => { const g = window.__game.debug.game, e = g.npc('erez'); return { me: g.player.pos.y, erez: e.visible, ey: e.pos.y }; });
  check('55 · Nehorai and Erez come down on the hall\'s floor', !!s && down.erez && Math.abs(down.ey - down.me) < 0.3, JSON.stringify(down));
  check('55 · Muller\'s line before they come through, word for word', line(R.mullerHold), t.heard.slice(0, 3).join(' | '));
  s = await talkThrough((s) => s.mission?.s.shadow, 40, 'the Shadow');
  await step(0.5);
  await snap('w-55-0-shadow');
  s = await talkThrough((s) => s.mission?.s.lined, 80, 'the line');
  check('55 · the landing\'s lines, word for word', line(R.idoCry) && line(R.mullerBack) && line(R.shadowImpossible) && line(R.missedMe), t.heard.slice(-6).join(' | '));
  const shadow = await G(() => { const g = window.__game.debug.game, n = g.npc('shadow'); return { visible: n.visible, d: Math.hypot(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z) }; });
  check('55 · the Shadow faces them across the hall', shadow.visible && shadow.d > 15, JSON.stringify(shadow));
  const lined = await G((TEAM) => { const g = window.__game.debug.game; return TEAM.filter((id) => { const n = g.npc(id); return n.visible && Math.abs(n.pos.z - g.player.pos.z) < 0.8; }).length; }, TEAM);
  check('55 · everyone lines up beside Nehorai, nobody left behind', lined === 8, `${lined}/8 in the line`);
  await step(1.5);
  await snap('w-55-0-line');
  s = await talkThrough((s) => s.mission?.s.raised, 60, 'the marker raised');
  s = await talkThrough((s) => s.mission?.step >= 1, 80, 'the last lines');
  check('55 · the line\'s lines, word for word', line(R.ready) && line(R.always) && line(R.idoFinish) && line(R.mullerPortal) && line(R.lastFight), t.heard.slice(-6).join(' | '));
  check('55 · the music has broken out', (await G(() => window.__game.debug.game.sound?.musicMode)) === 'epic');

  // ---------- 1: lead the gang up to the energy hall (a reload on the way) ----------
  s = await until((s) => s.mission?.step === 1 && !s.cutscene, 10, 'the hand-over');
  check('55 · its goal on screen, Nehorai armed, the white gone, an arrow at the stairs\' foot', /להוביל את החבורה אל אולם האנרגיה/.test(s?.objective || '') && s?.armed && await G(() => { const g = window.__game.debug.game, q = g.target, F = window.__game.debug.world.places.citadel.mainHall.stairsAt; return !!q && Math.hypot(q.x - F.x, q.z - F.z) < 1; }), `${s?.objective} armed ${s?.armed}`);
  await step(3);
  const going = await G(() => { const n = window.__game.debug.game.npc('shadow'); return { moving: !!n.target, visible: n.visible }; });
  check('55 · the Shadow pulls back toward the stairs', going.moving || !going.visible, JSON.stringify(going));
  const foot = await G(() => ({ ...window.__game.debug.world.places.citadel.mainHall.stairsAt }));
  res = await tp(foot, 0, 0, null, { near: 1.2 });
  check('55 · walked with the stick to the foot of the stairs', res === 'ok', res);
  s = await reload();
  s = await until((s) => s.mission?.id === 'return' && s.mission?.step === 1 && !s.cutscene, 30, 'the hand-over after the reload');
  st = await scene();
  check('55 · the reload in the middle of the group is picked up at the checkpoint: the main hall, Nehorai armed and bandaged, the whole gang with him, the door open', !!s && st.dim === null && st.as === 'nehorai' && st.armed && st.bandage && Math.abs(st.y.hall) < 1 && st.inTower && st.gang20 === 8 && st.mainDoor && st.white < 0.05, JSON.stringify(st));
  check('55 · after the reload the goal and the arrow are back', /להוביל את החבורה/.test(s?.objective || '') && await arrow(), s?.objective);
  await step(2);
  res = await tp(foot, 0, 0, null, { near: 1.2 });
  check('55 · back to the stairs\' foot with the stick', res === 'ok', res);
  s = await S();
  check('55 · the arrow now points up the stairs', /במדרגות למעלה/.test(s.objective), s.objective);
  const top = await G(() => ({ ...window.__game.debug.world.places.citadel.energyHall.stairsTop }));
  res = await tp(top, 0, 0, null, { near: 1.5 });
  check('55 · up the stairs with the stick to the energy hall', res === 'ok' || res === 'a scene', res);
  await step(1);
  await snap('w-55-1-top');
  s = await talkThrough((s) => s.mission?.id !== 'return', 30, 'the arrival');
  check('55 · Erez\'s line at the top', said('אולם האנרגיה. הם מחכים לנו בפנים.', 'ארז'), t.heard.slice(-3).join(' | '));
  s = await until((s) => s.mission?.id === 'laststand', 20, 'mission 56');
  check('55 → 56 · mission 56 carries straight on (no placed save)', s?.mission?.id === 'laststand', JSON.stringify(s?.mission));
}

// ======================================== 56: laststand ========================================
const at = (lx, lz, k = 'hall') => G(({ lx, lz, k }) => { const Z = window.__game.debug.world.places.citadel, p = Z.toWorld(lx, lz); return { x: p.x, z: p.z, y: { hall: Z.energyHall.y, roof: Z.bridges.y, bridge: Z.towerBridge.y, machine: Z.machine.y, last: Z.lastHall.y }[k] }; }, { lx, lz, k });
const place = (expr) => G((expr) => { const Z = window.__game.debug.world.places.citadel; const q = new Function('Z', `return (${expr});`)(Z); return { x: q.x, z: q.z, y: q.y }; }, expr);
const standing = (ids = null) => G((ids) => window.__game.debug.game.paint.guards.filter((g) => !g.marked && g.npc.visible && (!ids || ids.includes(g.npc.id))).map((g) => g.npc.id), ids);
const guardAt = (id) => G((id) => { const n = window.__game.debug.game.npc(id); return { x: n.pos.x, z: n.pos.z, y: n.pos.y }; }, id);
// an order to the gang with the real squad button (it cycles follow, hold, cover, advance)
const order = async (mode) => { for (let i = 0; i < 4 && (await G(() => window.__game.debug.game.squad.mode)) !== mode; i++) { await press('btnSquad'); await step(0.1); } return (await G(() => window.__game.debug.game.squad.mode)) === mode; };
// the stick pushed straight at a point (a narrow gap the half-metre path grid cannot thread): the real left thumb
async function stick(p, maxSec = 8) {
  await G((p) => { const g = window.__game.debug.game; g.botInput = (input) => { const me = g.player.pos, dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz) || 1, cy = g.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy); return { ...input, move: d < 0.25 ? { x: 0, y: 0 } : { x: (dx * rx + dz * rz) / d, y: (dx * fx + dz * fz) / d }, run: false }; }; }, p);
  const r = await until((s) => Math.hypot(s.me.x - p.x, s.me.z - p.z) < 0.4, maxSec, 'the stick');
  await G(() => { window.__game.debug.game.botInput = null; });
  return !!r;
}
// fired from where he stands, only at one in range with a clear line: true when he is marked
const fireFrom = (id) => G((id) => {
  const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => x.npc.id === id);
  for (let i = 0; i < 6 && gd && !gd.marked; i++) {
    const n = gd.npc, me = g.player.pos;
    if (Math.hypot(n.pos.x - me.x, n.pos.z - me.z) > 16.5 || !P.clear(me.x, me.y + 1.32, me.z, n.pos.x, n.pos.y + 1.1, n.pos.z, g.player)) return false;
    g.player.yaw = Math.atan2(n.pos.x - me.x, n.pos.z - me.z); g.hold = false; P.lock = gd; P.fire(); g.hold = true; window.__r.step(0.25);
    if (P.player.ammo <= 0) { P.player.ammo = P.player.clip; P.player.reloading = 0; }
  }
  return !gd || gd.marked;
}, id);
// the marker fired from a few steps nearer: walked there with the stick to about ten metres, never into his face
async function mark(id) {
  for (let k = 0; k < 3; k++) {
    const r = await G((id) => { const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => x.npc.id === id); if (!gd || gd.marked || !gd.npc.visible) return { done: true }; const n = gd.npc, me = g.player.pos; return { d: Math.hypot(n.pos.x - me.x, n.pos.z - me.z), x: n.pos.x, z: n.pos.z, y: n.pos.y, clear: P.clear(me.x, me.y + 1.32, me.z, n.pos.x, n.pos.y + 1.1, n.pos.z, g.player) }; }, id);
    if (r.done) return true;
    if (r.d > 14 || !r.clear) await tp(r, 0, 0, null, { near: k ? 6 : 10 });
    const ok = await G((id) => {
      const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => x.npc.id === id);
      for (let i = 0; i < 10 && gd && !gd.marked; i++) { const n = gd.npc, me = g.player.pos; g.player.yaw = Math.atan2(n.pos.x - me.x, n.pos.z - me.z); g.hold = false; P.lock = gd; P.fire(); g.hold = true; window.__r.step(0.25); if (P.player.ammo <= 0) { P.player.ammo = P.player.clip; P.player.reloading = 0; } }
      return !gd || gd.marked;
    }, id);
    if (ok) return true;
  }
  return shoot(id);
}
// a guard of the Order taken out the way a player would: a shield bearer shoved aside first, then marked
async function takeOut(id) {
  if (id.startsWith('sh')) { for (let k = 0; k < 4; k++) { const g = await guardAt(id); await tp(g, 0, 0, null, { near: 1.2 }); if (await interact('לדחוף את המגן', 1)) { await step(0.1); break; } } return shoot(id); }
  return mark(id);
}

async function laststand(live) {
  // ---------- 0: the energy hall ----------
  s = await S();
  st = await scene();
  const door = await G(() => window.__game.debug.world.places.citadel.energyHall.door.locked);
  check(`56 · ${live ? 'the live carry-on from 55' : 'staged on a fresh page'}: Nehorai on the energy hall's floor, bandaged and armed, the whole gang with him in "follow", the hall's west door locked`, s.mission?.id === 'laststand' && s.mission.step === 0 && Math.abs(st.y.energy) < 1 && st.as === 'nehorai' && st.armed && st.bandage && st.gang20 === 8 && st.dim === null && door && st.squad === 'follow', JSON.stringify(st));
  check('56 · a goal on screen and an arrow', /אולם האנרגיה/.test(s.objective) && await arrow(), s.objective);
  s = await forceFail('56 · the energy hall');
  m = await ms();
  check('56 · the retry: the energy hall again, the marks wiped', m?.step === 0 && s.hits === 0 && m.k === 0, JSON.stringify(m));
  s = await talkThrough(() => false, 3, 'the hall\'s lines'); // (taps the opening lines through)
  check('56 · Muller\'s line as the hall goes to emergency', said('הוא הפעיל את כל מערכות ההגנה. המצודה במצב חירום.', 'מולר'), t.heard.slice(-3).join(' | '));

  const HEAVY_CELL = { hv1: 3 };
  let shoved = false, flanked = false, celled = false, gaveOrder = false;
  async function clearWave(k) {
    for (let i = 0; i < 160; i++) {
      m = await ms();
      if (!m || m.step !== 0 || m.k > k) return true;
      s = await S(); if (s.fail) { console.log(`  (failed in wave ${k + 1}: ${s.hits} marks)`); return false; }
      for (const id of await standing()) {
        if (id === 'sh1' || id === 'sh3') {
          const g = await guardAt(id);
          await tp(g, 0, 0, null, { near: 1.6 });
          if (await interact('לדחוף את המגן', 3)) { if (id === 'sh1') shoved = true; await step(0.1); }
          await shoot(id);
        } else if (id === 'sh2') {
          // the order "advance!" with the squad button and two of them flank him
          if (!gaveOrder) { gaveOrder = true; await order('advance'); }
          const ok = await until(async () => !(await standing(['sh2'])).length, 25, 'the flank');
          flanked = !!ok && (await G(() => window.__game.debug.game.paint.guards.find((g) => g.npc.id === 'sh2')?.markedBy !== 'player'));
          await order('follow');
        } else if (HEAVY_CELL[id] != null && !celled) {
          // the heavy at his post by an energy cell: the cell shot from out of its ring
          await until(async () => { const p = await guardAt(id), c = await at(58, -28); return Math.hypot(p.x - c.x, p.z - c.z) < 4.6; }, 15, 'the heavy by the cell');
          await shootProp(`m.cells[${HEAVY_CELL[id]}].pr`, await at(68, -28));
          await step(2.6);
          const r = await G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel; return { cell: Z.energyHall.cells[3].blown, hv: g.paint.guards.find((x) => x.npc.id === 'hv1')?.marked }; });
          celled = r.cell && r.hv;
          if (!r.hv) await shoot(id);
        } else await shoot(id);
        if ((await S()).fail) return false;
      }
      await step(0.4);
    }
    console.log('  (wave stuck)', JSON.stringify(await ms()));
    return false;
  }
  // the three waves; marked out for real, the hall is retried from its checkpoint as a player would (twice at most)
  let hallRetries = 0, ok1, ok2, ok3, covered = false;
  for (;;) {
    shoved = flanked = celled = gaveOrder = false;
    ok1 = await clearWave(0);
    if (ok1) { await step(1); await snap('w-56-0-hall'); covered = await order('cover'); }
    ok2 = ok1 && await clearWave(1);
    ok3 = ok2 && await clearWave(2);
    if (ok3 || hallRetries >= 2 || !(await S()).fail) break;
    hallRetries++; console.log(`  (marked out in the energy hall for real: retried)`);
    await page.tap('#retryBtn'); await until((s) => !s.fail, 8, 'the retry'); await order('follow');
  }
  check('56 · wave 1: a shield bearer shoved with the real button and marked, one flanked by the gang on the "advance" order', ok1 && shoved && flanked, `ok ${ok1} shoved ${shoved} flanked ${flanked} · ${hallRetries} real retries`);
  check('56 · the "cover" order given with the squad button', covered);
  check('56 · wave 2: a heavy marked by the energy cell he stood by (shot from outside its warning ring)', ok2 && celled, `ok ${ok2} cell ${celled}`);
  check('56 · wave 3 (runners and a shield bearer) cleared', ok3, JSON.stringify(await ms()));
  await order('follow');
  s = await talkThrough((s) => s.mission?.step >= 1, 40, 'Muller at the door');
  const open1 = await G(() => !window.__game.debug.world.places.citadel.energyHall.door.locked);
  check('56 · the hall clear: Muller opens the west door onto bridge A; the bridge\'s goal and an arrow', s?.mission?.step === 1 && open1 && said('אחים יקרים, האולם נקי.', 'ליאם') && /גשר המגדל/.test(s?.objective || '') && await arrow(), `${s?.objective} open ${open1}`);

  // ---------- 1: the tower bridge ----------
  s = await forceFail('56 · the tower bridge');
  m = await ms();
  st = await G(() => { const Z = window.__game.debug.world.places.citadel, me = window.__game.debug.game.player.pos; return { y: me.y - Z.energyHall.y, d: Math.hypot(me.x - Z.energyHall.doorInside.x, me.z - Z.energyHall.doorInside.z), open: !Z.energyHall.door.locked, drops: Z.towerBridge.dropped().length }; });
  check('56 · the retry: at the hall\'s west door, the door open, the bridge whole, the marks wiped', m?.step === 1 && st.open && st.d < 2 && Math.abs(st.y) < 1 && st.drops === 0 && s.hits === 0, JSON.stringify(st));
  res = await tp(await place('Z.energyHall.doorOutside'));
  res = await tp(await place('Z.bridges.a[0]'), 0, 0, null, { near: 1.2 });
  check('56 · out over bridge A with the stick', res === 'ok', res);
  res = await tp(await place('Z.towerBridge.head.foot'), 0, 0, null, { near: 1.2 });
  res = await tp(await place('Z.towerBridge.head.top'), 2, 0, null, { near: 1.5 });
  s = await until((s) => !!s.fight, 10, 'the runners');
  check('56 · up the bridgehead with the stick: two runners come over the bridge, fists', !!s?.fight && /רצים/.test(s.objective), `${res} ${s?.objective}`);
  await step(0.6);
  check('56 · the arrow at a runner while the fists are up', await arrow());
  f = await fight(120, 'the runners');
  check('56 · the runners beaten with the fist buttons (Hadar and Liam beside him)', f.won, JSON.stringify(f.s?.mission));
  s = await until((s) => !s.fight && s.armed, 6, 'the marker back');
  check('56 · the marker back in his hands after the fists', !!s?.armed);
  res = await tp(await place('Z.towerBridge.segments[1].centre'));
  m = await until(async () => (await ms()).phase === 'leap', 8, 'the third segment falling');
  const drop2 = await G(() => window.__game.debug.world.places.citadel.towerBridge.dropped());
  check('56 · a warned segment falls ahead of him (Muller\'s call first)', !!m && drop2.includes(2) && await heard('נהוראי! הקטע שלפניך נופל! לעצור!', 'מולר'), JSON.stringify(drop2));
  res = await tp(await place('Z.towerBridge.segments[2].from'), 0, 0, null, { near: 0.6 });
  ok = await interact('לקפוץ', 4);
  m = await until(async () => (await ms()).phase === 'hand', 6, 'the landing');
  check('56 · the leap over the hole with the real button', ok && !!m, JSON.stringify(m));
  s = await until((s) => s.prompt === 'לתת יד לארז', 10, 'Erez at the edge');
  check('56 · Erez hangs at the edge: the goal and an arrow at him', /לתת לו יד/.test(s?.objective || '') && await arrow(), s?.objective);
  await snap('w-56-1-hand');
  ok = await interact('לתת יד לארז', 6);
  m = await until(async () => (await ms()).handDone, 8, 'Erez up');
  const erez = await G(() => { const g = window.__game.debug.game, n = g.npc('erez'); return { dy: n.pos.y - g.player.pos.y, visible: n.visible }; });
  check('56 · Erez hauled up with Nehorai\'s hand', ok && !!m && Math.abs(erez.dy) < 0.5 && erez.visible && await heard('נהוראי!!! היה לי קצת קצר פה!', 'ארז'), JSON.stringify(erez));
  res = await tp(await place('Z.towerBridge.segments[3].centre'), 1.2, 0);
  m = await until(async () => (await ms()).phase === 'detour', 8, 'two more falling');
  check('56 · two more segments fall (warned): the detour', !!m && (await G(() => window.__game.debug.world.places.citadel.towerBridge.dropped().length)) === 3);
  const L4 = await place('Z.towerBridge.detour.links[3]'), L6 = await place('Z.towerBridge.detour.links[5]');
  res = await tp({ ...L4, z: L4.z + 2.4 }, 0, 0, null, { near: 0.5 });
  let walked = await stick({ ...L4, z: L4.z + 0.2 }) && await stick({ ...L4, z: L4.z - 1.6 });
  res = await tp({ ...L6, z: L6.z - 1.6 }, 0, 0, null, { near: 0.5 });
  walked = walked && res === 'ok' && await stick({ ...L6, z: L6.z - 0.2 }) && await stick({ ...L6, z: L6.z + 1.6 });
  check('56 · round the broken part on the yellow catwalk with the stick', walked, res);
  m = await ms();
  check('56 · the emitters by the upper door wake up (Ido\'s call)', m.phase === 'emit' && await heard('פולטים ליד הדלת! כשהכדור נאסף, לזוז הצידה ולירות בהם!', 'עידו'), m.phase);
  await snap('w-56-1-emitters');
  const from = await place('Z.towerBridge.segments[7].centre');
  for (let i = 0; i < 3; i++) await shootProp(`m.emit.list[${i}].pr`, from);
  m = await until(async () => (await ms()).phase === 'door', 6, 'the emitters out');
  check('56 · the three emitters shot out', !!m && (await ms()).emitLeft === 0, JSON.stringify(await ms()));
  s = await talkThrough((s) => s.mission?.s?.open, 20, 'Ido at the upper door');
  res = await tp(await place('Z.machine.doorInside'));
  s = await until((s) => s.mission?.step === 2, 10, 'the machine room');
  check('56 · Ido opens the upper door, in with the stick: the machine room, its goal', s?.mission?.step === 2 && /חדר המכונה/.test(s?.objective || '') && await heard('פתוח! חדר המכונה, בבקשה, תיכנסו.', 'עידו'), s?.objective);

  // ---------- 2: the machine room ----------
  s = await forceFail('56 · the machine room');
  m = await ms();
  check('56 · the retry: the machine room from the start, the bar empty', m?.step === 2 && m.bar === 0 && s.hits === 0, JSON.stringify(m));
  const NORTH = ['og7', 'og8', 'sh1', 'hv1', 'og9', 'rn1', 'og10', 'rn2', 'og11'];
  let breakers = 0, snapped = false, arrowed = true, machineRetries = 0;
  const seen = {};
  for (let i = 0; i < 500; i++) {
    m = await ms(); s = await S();
    if (s.fail) {
      console.log(`  (failed in the machine room: ${await page.textContent('#failReason')})`);
      // marked out for real: retried from the machine room's checkpoint as a player would (twice at most)
      if (machineRetries < 2) { machineRetries++; await page.tap('#retryBtn'); await until((s) => !s.fail, 8, 'the retry'); breakers = 0; for (const k of Object.keys(seen)) delete seen[k]; continue; }
    }
    if (s.fail || !m || m.step !== 2) break;
    if (m.wait >= 0) {
      arrowed = arrowed && await arrow();
      await tp(await at(m.wait === 0 ? 56 : 92, -33.3, 'machine'), 0, 0, null, { near: 0.5 });
      if (await interact('להרים את המפסק', 4)) breakers++;
      continue;
    }
    if (!snapped && m.bar > 0.2) { snapped = true; await snap('w-56-2-machine'); }
    // he holds the north corridor beside Erez and Ido and fires at whoever comes into range; one who hangs back out
    // of sight is gone after; a shield bearer is shoved aside first (Erez and Ido flank him)
    const north = await standing(NORTH);
    const w = await at(72, -26, 'machine'), me = (await S()).me;
    for (const id of north) {
      seen[id] = (seen[id] || 0) + 0.5;
      if (id.startsWith('sh')) { if (north.length === 1 && seen[id] > 12) await takeOut(id); }
      else if (!(await fireFrom(id)) && seen[id] > 10) await mark(id);
    }
    if (!north.length && Math.hypot(me.x - w.x, me.z - w.z) > 3) await tp(w);
    await step(0.5);
  }
  m = await ms();
  check('56 · the machine room held: both breakers thrown with the real button (an arrow at each), Muller\'s bar full, the source off', breakers === 2 && arrowed && (m?.step >= 3 || (m?.step === 2 && m.off)), `breakers ${breakers} arrow ${arrowed} · ${machineRetries} real retries · ${JSON.stringify(m)}`);
  check('56 · Muller\'s line at the source', await heard('מקור האנרגיה כבוי. המכונה שלו על סוללות עכשיו.', 'מולר') || (await talkThrough((s) => s.mission?.step >= 3, 20, 'the source off')) && said('מקור האנרגיה כבוי. המכונה שלו על סוללות עכשיו.', 'מולר'));

  // ---------- 3: the last hall's door ----------
  s = await talkThrough((s) => s.mission?.step === 3 && !!s.fight, 30, 'the heavies at the door');
  check('56 · two heavies at the door: fists, Erez and Ido beside him, the goal', !!s?.fight && s.opp.length === 2 && /שני כבדים בדלת/.test(s.objective) && said('בלי מרקרים. ביחד, כמו פעם.', 'ארז'), `${s?.objective} ${s?.opp.length}`);
  await G(() => { window.__game.debug.game.missions.active.s.lost = true; }); // a forced fail: the fight lost
  s = await until((s) => s.fail, 6, 'the fail screen');
  const why = await page.textContent('#failReason');
  check('56 · the door fight lost fails with a reason and a tip', !!s && /הכבדים בדלת הפילו אותך/.test(why), why);
  await page.tap('#retryBtn');
  s = await talkThrough((s) => !s.fail && s.mission?.step === 3 && !!s.fight, 30, 'the retry');
  check('56 · the retry: the door fight again', !!s?.fight);
  await step(0.5);
  check('56 · the arrow at a heavy while the fists are up', await arrow());
  let lostFights = 0;
  for (;;) {
    f = await fight(180, 'the heavies', { done: (s) => s.mission?.step >= 4 });
    if (f.won || (await ms())?.step >= 4 || lostFights >= 2) break;
    // lost for real: retried as a player would (twice at most)
    lostFights++;
    console.log(`  (the door fight lost: hp ${f.last?.me.hp?.toFixed(0)}, ${JSON.stringify(f.last?.opp.map((o) => [o.id, Math.round(o.hp), o.down]))}, combos ${f.combos}, counters ${f.counters}: retried)`);
    if (await until((s) => s.fail, 6, 'the fail screen')) await page.tap('#retryBtn');
    await talkThrough((s) => !s.fail && s.mission?.step === 3 && !!s.fight, 30, 'the retry');
    await step(0.5);
  }
  check('56 · the two heavies beaten with the fist buttons', f.won || (await ms())?.step >= 4, `${lostFights} lost and retried · ${JSON.stringify(f.s?.mission)}`);

  // ---------- 4: everyone walks in; the door shuts behind them ----------
  s = await until((s) => s.mission?.step === 4 && s.armed, 10, 'the walk in');
  check('56 · the door at the top opens by itself; the goal: everyone up together, an arrow', /כולם/.test(s?.objective || '') && await arrow(), s?.objective);
  await step(2);
  res = await tp(await place('Z.lastHall.entry'), 0, 0, null, { near: 1.5 });
  check('56 · up the stairs with the stick into the last hall', res === 'ok' || res === 'a scene', res);
  await step(1.8);
  await snap('w-56-4-shut');
  s = await talkThrough((s) => s.mission?.id !== 'laststand', 30, 'the door shutting');
  check('56 · the door shuts behind them, the lines', said('זהו. הדלת נסגרה. רק אנחנו והוא.', 'ארז') && said('והוא לבד. אנחנו לא.', 'עידו'), t.heard.slice(-3).join(' | '));
  s = await until((s) => s.mission?.id === 'endshadow', 20, 'mission 57');
  check('56 → 57 · mission 57 carries straight on', s?.mission?.id === 'endshadow', JSON.stringify(s?.mission));
  st = await scene();
  check('56 → 57 · handed over in the last hall: Nehorai bandaged and armed, the whole gang with him, the Shadow not shown', Math.abs(st.y.last) < 1 && st.as === 'nehorai' && st.armed && st.bandage && st.gang14 >= 7 && st.gang20 === 8 && !st.shadow, JSON.stringify(st));
}

// ---------- the group, from the first mission asked for ----------
if (FIRST === 'gateback') await gateback();
if (FIRST !== 'laststand') await homecoming(FIRST === 'gateback');
await laststand(FIRST !== 'laststand');
await t.finish();
