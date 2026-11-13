// Mission 55, "הגיבורים חוזרים", played on the stage harness from a placed save (chapter ten, 47-54 done): the white
// clears in the citadel's main hall, Muller holds the way back, it widens, Nehorai and Erez come down on the floor;
// the Shadow across the hall; the line (the camera along it); "the last fight"; then the hand-over with the stick:
// the Shadow's men pull back up the stairs and Nehorai leads the gang up after them to the energy hall (a reload on
// the way is picked up at that checkpoint); mission 56 begins. Every quoted line is compared with lines10.js word
// for word. The mission has no fail of its own (nothing in the script can go wrong there).
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const DONE = ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift', 'grove', 'secret', 'gateback'];
const t = await openStage({ chapter: 10, done: DONE, first: 'return' });
const { check, S, G, step, until, talkThrough, said, tp, snap, reload } = t;
const R = L.return;
const heard = (line) => said(line[1], line[0]);

// ---------- 0: out of the white, the landing ----------
let s = await S();
check('the save is placed and "return" begins', s.mission?.id === 'return', JSON.stringify(s.mission));
// the scene as mission 54 hands it on (a live carry-on): all white, still in the grove's dimension, Nehorai at the
// grove's portal, bandaged and armed, Erez beside him; then 55 begins from there
await G(() => {
  const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove;
  g.missions.stop(); // (the run the save began is put away first: its cleanup leaves the dimension)
  g.dimension('grove'); g.overlay.white(1);
  g.player.place(1216.5, 193.5, Math.PI / 2, Q.y);
  const e = g.npc('erez'); e.place(1215, 191.5, Math.PI / 2, Q.y); e.show(true);
  g.missions.start('return');
});
await step(0.2);
const held = await G(() => { const g = window.__game.debug.game; return { dim: g.dimensionName, white: g.overlay.wh.v, id: g.missions.active?.def.id }; });
check('on a carry-on from 54 the white holds a breath, still in the grove', held.id === 'return' && held.dim === 'grove' && held.white === 1, JSON.stringify(held));
s = await until((s) => s.mission?.step === 0 && s.cutscene && s.dimension === null, 20, 'the scene in the hall');
await step(1.5);
const clear = await G(() => window.__game.debug.game.overlay.wh.v);
check('the white clears over the citadel\'s main hall', clear < 0.05, String(clear));
check('the scene: in the ordinary world, Nehorai played', s?.dimension === null && s?.me.as === 'nehorai', `${s?.dimension} ${s?.me.as}`);
check('a goal is on screen for the scene', /מולר מחזיק את הפורטל/.test(s?.objective || ''), s?.objective);
const gate = await G(() => { const a = window.__game.debug.game.missions.active; return { portal: !!a.gate, open: a.gate?.isOpen, r: a.gate?.r }; });
check('the way back stands open over the machine, small', gate.portal && gate.open && gate.r < 2, JSON.stringify(gate));
await step(0.7);
await snap('m55-0-hall');
s = await talkThrough((s) => s.mission?.s.landed, 60, 'the landing');
const down = await G(() => { const g = window.__game.debug.game, e = g.npc('erez'); return { me: g.player.pos.y, erez: e.visible, ey: e.pos.y, pose: e.model.pose }; });
check('Nehorai and Erez come down on the hall\'s floor', !!s && down.erez && Math.abs(down.ey - down.me) < 0.3, JSON.stringify(down));
check('Muller\'s line before they come through, word for word', heard(R.mullerHold), t.heard.slice(0, 3).join(' | '));
await step(0.4);
await snap('m55-0-landing');

// ---------- 0: the Shadow, the line ----------
s = await talkThrough((s) => s.mission?.s.lined, 80, 'the line');
check('the landing\'s lines, word for word', heard(R.idoCry) && heard(R.mullerBack) && heard(R.shadowImpossible) && heard(R.missedMe), t.heard.slice(-6).join(' | '));
const shadow = await G(() => { const g = window.__game.debug.game, n = g.npc('shadow'); return { visible: n.visible, d: Math.hypot(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z) }; });
check('the Shadow faces them across the hall', shadow.visible && shadow.d > 15, JSON.stringify(shadow));
const line = await G(() => { const g = window.__game.debug.game, ids = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam']; return ids.filter((id) => { const n = g.npc(id); return n.visible && Math.abs(n.pos.z - g.player.pos.z) < 0.8; }).length; });
check('everyone lines up beside Nehorai', line === 8, `${line}/8 in the line`);
await step(1.5);
await snap('m55-0-line');
s = await talkThrough((s) => s.mission?.step >= 1, 80, 'the last lines');
check('the line\'s lines, word for word', heard(R.ready) && heard(R.always) && heard(R.idoFinish) && heard(R.mullerPortal) && heard(R.lastFight), t.heard.slice(-6).join(' | '));
check('the music has broken out', (await G(() => window.__game.debug.game.sound?.musicMode)) === 'epic');

// ---------- 1: the hand-over: lead the gang up to the energy hall ----------
s = await until((s) => s.mission?.step === 1 && !s.cutscene, 10, 'the hand-over');
check('the hand-over: its goal on screen, Nehorai armed, the white gone', /להוביל את החבורה אל אולם האנרגיה/.test(s?.objective || '') && s?.armed, `${s?.objective} armed ${s?.armed}`);
const tgt = await G(() => { const g = window.__game.debug.game, t = g.target, F = window.__game.debug.world.places.citadel.mainHall.stairsAt; return t ? Math.hypot(t.x - F.x, t.z - F.z) : null; });
check('the arrow points at the stairs\' foot', tgt !== null && tgt < 1, String(tgt));
await step(3);
const going = await G(() => { const g = window.__game.debug.game, n = g.npc('shadow'); return { moving: !!n.target, visible: n.visible }; });
check('the Shadow pulls back toward the stairs', going.moving || !going.visible, JSON.stringify(going));
const foot = await G(() => ({ ...window.__game.debug.world.places.citadel.mainHall.stairsAt }));
let res = await tp(foot, 0, 0, null, { near: 1.2 });
check('walked with the stick to the foot of the stairs', res === 'ok', res);
// a reload on the way up
s = await reload();
s = await until((s) => s.mission?.id === 'return' && s.mission?.step === 1 && !s.cutscene, 30, 'the hand-over after the reload');
const back = await G(() => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos;
  const ids = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  return { dim: g.dimensionName, as: g.playingAs, armed: !!g.paint.armed, hall: Math.abs(me.y - Z.mainHall.y) < 1 && Z.inTower(me.x, me.z), gang: ids.filter((id) => g.npc(id).visible && Math.hypot(g.npc(id).pos.x - me.x, g.npc(id).pos.z - me.z) < 20).length, door: Z.mainHall.door.locked };
});
check('a reload is picked up at the checkpoint: the main hall, Nehorai armed, the whole gang with him', s && back.dim === null && back.as === 'nehorai' && back.armed && back.hall && back.gang === 8, JSON.stringify(back));
await step(2);
res = await tp(foot, 0, 0, null, { near: 1.2 });
check('back to the stairs\' foot with the stick', res === 'ok', res);
s = await S();
check('the arrow now points up the stairs', /במדרגות למעלה/.test(s.objective), s.objective);
const top = await G(() => ({ ...window.__game.debug.world.places.citadel.energyHall.stairsTop }));
res = await tp(top, 0, 0, null, { near: 1.5 });
check('up the stairs with the stick to the energy hall', res === 'ok' || res === 'a scene', res);
await step(1);
await snap('m55-1-top');
s = await talkThrough((s) => s.mission?.id !== 'return', 30, 'the arrival');
check('the friends\' lines at the top', said('אולם האנרגיה. הם מחכים לנו בפנים.', 'ארז'), t.heard.slice(-3).join(' | '));
s = await until((s) => s.mission?.id === 'laststand', 20, 'mission 56');
check('mission 56 begins', s?.mission?.id === 'laststand', JSON.stringify(s?.mission));
const handed = await G(() => {
  const g = window.__game.debug.game, Z = window.__game.debug.world.places.citadel, me = g.player.pos;
  const ids = ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
  return { y: me.y - Z.energyHall.y, as: g.playingAs, armed: !!g.paint.armed, gang: ids.filter((id) => g.npc(id).visible && Math.abs(g.npc(id).pos.y - me.y) < 1.5 && Math.hypot(g.npc(id).pos.x - me.x, g.npc(id).pos.z - me.z) < 14).length, shadow: g.npc('shadow').visible };
});
check('handed over on the energy hall\'s floor, armed, the gang beside him, the Shadow gone ahead', Math.abs(handed.y) < 1 && handed.as === 'nehorai' && handed.armed && handed.gang >= 7 && !handed.shadow, JSON.stringify(handed));
await t.finish();
