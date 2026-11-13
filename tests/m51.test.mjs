// Mission 51 "rift" (הקרע במציאות) played on the harness from a placed save (chapter ten, 47–50 done): the hall
// staged as 50 leaves it, three marks and a retry, a reload at the duel's checkpoint, the duel won with the real
// fire button (walked in with the stick when the Shadow's guard drops), the orb and Muller's lines, the throw and
// the portal, the pull at a pillar (walked against it with the stick, the prompt held down with the real button,
// let go for a moment and caught again), Erez's line, the grip lost by script, the white and the silence, and
// mission 52 beginning — the crossing carrying Nehorai and Erez to the grove's dimension with the marker, the ammo,
// the squad and the progress. Every quoted line is checked word for word against lines10.js.
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy', 'citadel', 'fall'], first: 'rift' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, press, hold, page, objective, holdLoop } = t;
const fire = async () => { await holdLoop(false); await press('btnFire'); await holdLoop(true); };
const heard = (k) => said(L.rift[k][1], L.rift[k][0]);
const scene = () => G(() => { const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, h = Z.mainHall, sh = g.npc('shadow'), e = g.npc('erez'), p = g.player.pos, M = g.nehorai;
  return { shadow: sh.visible, erez: e.visible, armed: g.paint.armed, kind: g.paint.player?.kind ?? null, bandage: !!M.bones.head.getObjectByName('bandage'), inHall: Math.abs(p.y - h.y) < 1 && Math.abs(p.x - h.centre.x) < 40, squad: g.squad.ids.length, muller: g.npc('muller').visible && Math.hypot(g.npc('muller').pos.x - Z.computer.at.x, g.npc('muller').pos.z - Z.computer.at.z) < 1, dim: g.dimensionName, as: g.playingAs }; });

// ---------- 0: the duel ----------
let s = await S();
check('mission 51 begins from a placed save (47–50 done)', s.mission?.id === 'rift' && s.mission.step === 0, JSON.stringify(s.mission));
check('step 0 (cp): its goal', await objective(0, /^לפגוע בצל יחד עם ארז/), s.objective);
let sc = await scene();
check('the hall as 50 leaves it: the Shadow before them, Erez beside him, armed, the bandage on, the gang with him, Muller at the computer', sc.shadow && sc.erez && sc.armed && sc.bandage && sc.inHall && sc.squad >= 6 && sc.muller && !sc.dim && sc.as === 'nehorai', JSON.stringify(sc));
// a fail first: three marks
await step(1);
await G(() => { const P = window.__game.debug.game.paint; P.strike('test'); P.strike('test'); P.strike('test'); });
s = await until((s) => s.fail, 4, 'the fail');
const reason = await G(() => document.getElementById('failReason')?.textContent || '');
check('three marks fail the duel, with a reason and a tip', !!s?.fail && /שלוש פעמים/.test(reason) && /ארז/.test(reason), reason);
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 0 && !s.fail && s.hits === 0, 10, 'the retry');
check('retry: back at the duel\'s checkpoint, marks cleared', !!s);
// a reload at the checkpoint
await step(1);
s = await t.reload();
s = await until((s) => s.mission?.id === 'rift' && s.mission.step === 0 && !s.cutscene, 40, 'the checkpoint after the reload');
sc = await scene();
check('after a reload: the duel again, the hall staged (the Shadow, Erez, the marker in hand, the bandage, the gang, Muller)', !!s && sc.shadow && sc.erez && sc.armed && sc.bandage && sc.squad >= 6 && sc.muller, JSON.stringify(sc));

// the duel with the real buttons: walked in with the stick when his guard drops, the fire button pressed
const duel = () => G(() => { const g = window.__game.debug.game, m = g.missions.active, sh = g.npc('shadow'), p = g.player.pos; return { step: m?.stepIndex, phase: m?.D?.phase, hp: m?.foe?.hp, vul: !!m?.foe?.vulnerable, d: Math.hypot(sh.pos.x - p.x, sh.pos.z - p.z), sh: window.__r.pt(sh.pos), fail: !g.hud.el.fail.hidden }; });
let fails = 0, opened = 0, shotPic = false, hp0 = null;
for (let i = 0; i < 260; i++) {
  const d = await duel();
  if (d.step !== 0) break;
  if (d.fail) { fails++; await page.tap('#retryBtn'); await until((s) => s.mission?.step === 0 && !s.fail, 10, 'a retry'); continue; }
  if (hp0 == null) hp0 = d.hp;
  if (d.vul) {
    opened++;
    if (d.d > 11) { await tp(d.sh, 0, 0, null, { near: 8, max: 6 }); continue; }
    await G(() => { const g = window.__game.debug.game, sh = g.npc('shadow'), me = g.player.pos; g.player.yaw = Math.atan2(sh.pos.x - me.x, sh.pos.z - me.z); });
    if (!shotPic) { shotPic = true; await snap('m51-0-duel'); }
    await fire(); await step(0.2);
  } else await step(0.3);
}
s = await until((s) => s.mission?.step >= 1, 10, 'the orb');
check('the duel won with the real fire button while his guard was down (Erez went round him)', s?.mission?.step >= 1, `windows seen ${opened}, retries ${fails}`);

// ---------- 1: the orb, Muller on the radio, the throw, the portal ----------
await step(1.6); await snap('m51-1-orb-hands');
s = await until((s) => s.mission?.step === 1 && s.dialogue, 20, 'the orb\'s lines');
await step(0.6);
await snap('m51-1-orb');
const orb = await G(() => { const m = window.__game.debug.game.missions.active; return m?.orb ? { r: m.orb.r, held: !!m.orb.held } : null; });
check('the orb grows in his hands', !!orb && orb.r > 0.3 && orb.held, JSON.stringify(orb));
s = await talkThrough((s) => s.mission?.step === 2, 60, 'the orb scene');
check('Muller on the radio, Nehorai, Muller, the Shadow — word for word', heard('mullerAway') && heard('whatMeans') && heard('mullerUniverse') && heard('shadowSee'), t.heard.slice(-6).join(' | '));
const gate = await G(() => { const m = window.__game.debug.game.missions.active, p = m?.portal; return p ? { state: p.state, r: p.r, x: p.pos.x, z: p.pos.z } : null; });
check('thrown: the orb became a portal, open and growing', !!gate && (gate.state === 'open' || gate.state === 'opening') && gate.r >= 1.8, JSON.stringify(gate));

// ---------- 2: the pull; the pillar ----------
check('step 2: its goal', await objective(2, /^להחזיק בעמוד!$/), (await S()).objective);
const dPortal = () => G(() => { const g = window.__game.debug.game, p = g.missions.active?.portal, me = g.player.pos; return p ? Math.hypot(p.pos.x - me.x, p.pos.z - me.z) : null; });
const d0 = await dPortal(); await step(1.0); const d1 = await dPortal();
check('the pull is real: standing still, he is dragged toward the portal', d1 < d0 - 1, `${d0?.toFixed(2)} → ${d1?.toFixed(2)} m`);
await snap('m51-2-portal');
const pil = await G(() => window.__r.pt(window.__game.debug.game.missions.active.pil.at));
let r = await tp(pil, 0, 0, null, { near: 0.5, max: 40 });
check('walked to the pillar with the stick, against the pull', r === 'ok', r);
check('the prompt at the pillar', !!(await until((s) => s.prompt === 'להחזיק בעמוד', 6, 'the prompt')));
await hold('btnInteract', true);
await step(0.5);
const a = await dPortal(); await step(1.2); const b = await dPortal(); await t.listen();
check('held down: he stays where he is; Erez catches hold of him — word for word', Math.abs(b - a) < 0.05 && heard('erezHold'), `${a?.toFixed(2)} → ${b?.toFixed(2)} m; ${t.heard.slice(-2).join(' | ')}`);
await snap('m51-2-hold');
// let go for a moment: the pull takes him; then caught again
await hold('btnInteract', false);
await step(0.6);
const c = await dPortal(); await t.listen();
check('let go: the pull drags him again', c < b - 0.4, `${b?.toFixed(2)} → ${c?.toFixed(2)} m`);
r = await tp(pil, 0, 0, null, { near: 0.5, max: 30 });
await until((s) => s.prompt === 'להחזיק בעמוד', 6, 'the prompt again');
await hold('btnInteract', true);
s = await talkThrough((s) => s.mission?.id !== 'rift' || (s.cutscene && s.mission?.s.lost), 40, 'the grip giving');
const lost = await G(() => { const g = window.__game.debug.game; return { lost: !!g.missions.active?.s.lost, cut: g.cutscene }; });
check('the grip gives by script (no fail): both are drawn in', lost.lost || s?.mission?.id !== 'rift', JSON.stringify(lost));
await hold('btnInteract', false);
s = await talkThrough((s) => (s.mission?.id === 'rift' && s.mission.s.silent) || s.mission?.id !== 'rift', 30, 'the white');
const white = await G(() => { const g = window.__game.debug.game; return { white: g.overlay.state.white, music: g.sound?.atmosphere?.music ?? null, portals: g.rift.things.size }; });
check('white, and silence (no music, the portal gone)', white.white > 0.98 && !white.music && white.portals === 0, JSON.stringify(white));
check('Ido\'s cry as they go (the gang hold on at their pillars)', t.heard.some((l) => l.startsWith('עידו: נהוראי!!!')), t.heard.slice(-3).join(' | '));
// a hopper part used (as after the duel's shots), so that the count that crosses is a telling one
const before = await G(() => { const g = window.__game.debug.game, P = g.paint.player; if (P) { P.ammo = 5; g.hud.setAmmo(5, P.clip, false); } return { ammo: P?.ammo, kind: P?.kind, hp: g.fighter.hp, money: g.progress.money }; });

// ---------- mission 52 begins: the crossing ----------
s = await until((s) => s.mission?.id === 'grove', 8, 'mission 52');
check('mission 52 begins (carried on, under the white)', s?.mission?.id === 'grove', JSON.stringify(s?.mission));
s = await until((s) => s.dimension === 'grove' && !(s.mission?.s.p === 'white'), 20, 'the crossing');
const over = await G(() => { const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove, p = g.player.pos, e = g.npc('erez').pos;
  return { dim: g.dimensionName, me: Math.hypot(p.x - Q.landing.nehorai.x, p.z - Q.landing.nehorai.z), erez: Math.hypot(e.x - Q.landing.erez.x, e.z - Q.landing.erez.z), y: Math.abs(p.y - Q.y), ammo: g.paint.player?.ammo, kind: g.paint.player?.kind, hp: g.fighter.hp, squad: g.squad.ids.join(','), done: g.progress.done.includes('rift'), money: g.progress.money, ido: g.npc('ido').visible }; });
check('the portal really carried them: Nehorai and Erez on the grove\'s lawn, in its dimension', over.dim === 'grove' && over.me < 0.8 && over.erez < 1.2 && over.y < 0.3, JSON.stringify(over));
check('the marker, its kind and ammo, the health, the squad (Erez) and the progress came along', over.ammo === before.ammo && over.kind === before.kind && over.hp >= before.hp && over.squad === 'erez' && over.done && over.money >= before.money && !over.ido, JSON.stringify({ before, over }));
await t.finish();
