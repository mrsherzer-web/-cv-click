// Mission 52 "grove" (איפה אנחנו?!) played on the harness from a placed save (chapter ten, 47–51 done): it begins on
// a fresh page in the citadel's hall under the portal's white, the crossing really moves Nehorai and Erez to the
// olive grove's lawn in its dimension (the violet sky, the two moons), the health, the money and the progress
// untouched; "לקום" with the real button, the lines word for word; the look at the sky with a real drag on the
// screen (the shot, the moons, the remarks); the walk with Erez with the stick to the first wall of energy, Erez's
// remarks on the way; a reload at the walk's checkpoint comes back in the grove's dimension, the two of them on the
// lawn, armed, the bandage on; then the wall's lines, and mission 53 beginning, still over there.
import { openStage } from './lib/stage.mjs';
import { L } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy', 'citadel', 'fall', 'rift'], first: 'grove' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, page, objective } = t;
const heard = (k) => said(L.grove[k][1], L.grove[k][0]);
const where = () => G(() => { const g = window.__game.debug.game, Q = window.__game.debug.world.places.grove, p = g.player.pos, e = g.npc('erez'), M = g.nehorai;
  return { dim: g.dimensionName, inGrove: p.x > Q.box.x0 && p.x < Q.box.x1 && p.z > Q.box.z0 && p.z < Q.box.z1 && Math.abs(p.y - Q.y) < 0.6, me: Math.hypot(p.x - Q.landing.nehorai.x, p.z - Q.landing.nehorai.z), erez: e.visible ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : null, erezLanding: Math.hypot(e.pos.x - Q.landing.erez.x, e.pos.z - Q.landing.erez.z),
    armed: g.paint.armed, kind: g.paint.player?.kind ?? null, ammo: g.paint.player?.ammo ?? null, hp: g.fighter.hp, money: g.progress.money, done: g.progress.done.length, squad: g.squad.ids.join(','), others: ['ido', 'yonati', 'avraham', 'dolev', 'hadar', 'liam', 'muller'].filter((id) => g.npc(id).visible), bandage: !!M.bones.head.getObjectByName('bandage'), layer: Q.isDimension(), white: g.overlay.state.white, as: g.playingAs }; });

// ---------- 0: the white, the crossing, the grove; "לקום"; the lines ----------
let s = await S();
check('mission 52 begins from a placed save (47–51 done)', s.mission?.id === 'grove' && s.mission.step === 0, JSON.stringify(s.mission));
const before = await G(() => { const g = window.__game.debug.game; return { hp: g.fighter.hp, money: g.progress.money, done: g.progress.done.length }; });
check('step 0: its goal', await objective(0, /^לקום$/), s.objective);
s = await until((s) => s.mission?.s.p === 'down' && !s.dialogue, 40, 'the landing');
let w = await where();
check('the crossing really carried them: Nehorai and Erez on the grove\'s lawn where they landed, in its dimension (the layer on, the white gone)', !!s && w.dim === 'grove' && w.layer && w.inGrove && w.me < 0.8 && w.erezLanding < 1.2 && w.white < 0.05, JSON.stringify(w));
check('the health, the money and the progress untouched; his marker in his hands, Erez his squad, the rest of the gang not over here', w.hp === before.hp && w.money === before.money && w.done === before.done && w.armed && w.squad === 'erez' && w.others.length === 0 && w.as === 'nehorai', JSON.stringify({ before, w }));
await snap('m52-0-landing');
check('"לקום" with the real button', await interact('לקום', 6));
s = await talkThrough((s) => s.mission?.step === 1, 40, 'the lines');
check('the lines, word for word: where, Erez\'s parallel universe, the grove, the sky', heard('where') && heard('erezParallel') && heard('itsTheGrove') && heard('erezSky'), t.heard.slice(-5).join(' | '));
w = await where();
check('on his feet, Erez beside him', w.erez != null && w.erez < 4 && !(await G(() => !!window.__game.debug.game.player.scripted)), JSON.stringify(w));

// ---------- 1: the look at the sky: a real drag up on the screen ----------
check('step 1: its goal', await objective(1, /^להסתכל על השמיים$/), (await S()).objective);
await step(0.5);
const pitch0 = await G(() => window.__game.debug.game.follow.pitch);
await page.mouse.move(560, 270); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(560, 270 - i * 20); await step(1 / 30); }
await page.mouse.up(); await step(0.2);
const pitch1 = await G(() => window.__game.debug.game.follow.pitch);
s = await until((s) => s.mission?.s.p === 'shot', 4, 'the shot of the sky');
check('dragged up: his own look goes up to the sky, and the shot takes it', pitch1 < pitch0 - 0.3 && !!s && s.mission.s.looked === true, `${pitch0.toFixed(2)} → ${pitch1.toFixed(2)}`);
await step(1.0);
await snap('m52-1-sky');
const sky = await G(() => { const g = window.__game.debug.game, cam = window.__game.debug.camera, d = new cam.position.constructor(); cam.getWorldDirection(d); const mp = g.rift.moonPoint(0, 300), v = { x: mp.x - cam.position.x, y: mp.y - cam.position.y, z: mp.z - cam.position.z }, l = Math.hypot(v.x, v.y, v.z); return { up: d.y, toMoon: (d.x * v.x + d.y * v.y + d.z * v.z) / l }; });
check('the camera looks up toward the two moons', sky.up > 0.1 && sky.toMoon > 0.9, JSON.stringify(sky));
s = await talkThrough((s) => s.mission?.step === 2, 30, 'the moons\' lines');
check('two moons: Nehorai and Erez remark on it', t.heard.some((l) => l.startsWith('נהוראי: שני ירחים')) && t.heard.some((l) => l.startsWith('ארז:')), t.heard.slice(-2).join(' | '));

// ---------- 2 (cp): the walk with Erez; a reload first ----------
check('step 2 (cp): its goal', await objective(2, /^ללכת עם ארז אל השביל$/), (await S()).objective);
await step(0.5);
s = await t.reload();
s = await until((s) => s.mission?.id === 'grove' && s.mission.step === 2 && !s.cutscene, 40, 'the checkpoint after the reload');
w = await where();
check('after a reload: the walk again, back in the grove\'s dimension — the two on the lawn, armed, the bandage on, Erez his squad', !!s && w.dim === 'grove' && w.layer && w.inGrove && w.armed && w.bandage && w.erez != null && w.erez < 5 && w.squad === 'erez' && w.others.length === 0 && w.as === 'nehorai', JSON.stringify(w));
const wall = await G(() => { const g = window.__game.debug.game, m = g.missions.active, tg = m.def.steps[2].target(m, g); return tg && { x: tg.x, z: tg.z, y: tg.y }; });
check('the arrow points to the path at the first wall', !!wall && Math.abs(wall.x - 1216) < 3, JSON.stringify(wall));
const shut = await G(() => { const Q = window.__game.debug.world.places.grove; return Q.seals.map((x) => x.isOpen); });
check('every wall of energy still stands (53 opens them)', shut.every((o) => !o), JSON.stringify(shut));
const half = await G(() => { const g = window.__game.debug.game, p = g.player.pos; return { x: p.x - 6, z: p.z - 9, y: p.y }; });
let r = await tp(half, 0, 0, null, { near: 1.0, max: 30 });
await step(1.5); await t.listen();
const mid = await where(); // (a breath after the leg: he follows at his own pace)
await snap('m52-2-walk');
r = await tp(wall, 0, 0, null, { near: 1.2, max: 40 });
check('walked to the wall with the stick, Erez with him', (r === 'ok' || r === 'a scene') && mid.erez != null && mid.erez < 7 && mid.erezLanding > 4, `${r}; Erez ${mid.erez?.toFixed(1)} m from him half way, ${mid.erezLanding.toFixed(1)} m from where he stood`);
s = await until((s) => s.mission?.s.p === 'wall', 6, 'the wall');
await step(1.2);
await snap('m52-2-wall');
s = await talkThrough((s) => s.mission?.id !== 'grove', 40, 'the wall\'s lines');
check('Erez on the way (the bulbs, the swings) and at the wall', t.heard.some((l) => l.startsWith('ארז: והנורות')) && t.heard.some((l) => l.startsWith('ארז: הנדנדות')) && t.heard.some((l) => l.startsWith('ארז: קיר של אנרגיה')), t.heard.slice(-6).join(' | '));

// ---------- 53 begins, still over there ----------
s = await until((s) => s.mission?.id === 'secret', 8, 'mission 53');
w = await where();
check('mission 52 done; mission 53 begins in the grove\'s dimension, Erez with him', s?.mission?.id === 'secret' && w.dim === 'grove' && w.inGrove && w.erez != null && w.erez < 6 && (await G(() => window.__game.debug.game.progress.done.includes('grove'))), JSON.stringify({ m: s?.mission, w }));
await t.finish();
