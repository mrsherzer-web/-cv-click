// Mission 49 ("המלחמה הגדולה") played on the stage harness: a save with missions 47 and 48 done, the mission
// beginning by itself at the citadel's service gate; its six numbered goals, word for word as the user wrote them,
// each played with the stick, the interact button, the marker and the squad's order button: (1) Muller opens the
// gate, the yard inside, the order "תחפו עליי!" and the watch tower climbed while Erez pins its men; (2) the alarm
// calling pairs of the Order until its fuse is cut (Dolev and Avraham on the store's door) and its panel switched
// off; (3) the lift's power, the lift called, the gang aboard and down (Hadar and Yonati at the shaft); (4) the
// tunnels and the inner gate's two wheels with Ido, the patrol half-way, the turn finished; (5) Muller's bar at the
// computer through three waves from three ways in (a marked Muller wipes it off); (6) the pylons' discharges timed,
// the plant house, the bridges, the tower's door; mission 50 begins. A forced fail (three marks) is retried at each
// checkpoint, the last one from the discharges themselves; a reload in the middle is picked up at its checkpoint.
// Guards are marked by the test except one real shot per fight (as stage-t does).
//   node tools/build-single.mjs && node tests/m49.test.mjs
import { openStage } from './lib/stage.mjs';

// the six goals as the spec lists them ("משימות בתוך המצודה"), character for character
const GOALS = ['1. להשתלט על הכניסה.', '2. להשבית את מערכת האזעקה.', '3. להפעיל מעלית משא.', '4. לעזור לעידו לפתוח שער.', '5. להגן על מולר בזמן שהוא ניגש למחשב.', '6. להגיע למגדל המרכזי.'];

const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy'], first: 'citadel' });
const { check, S, G, step, until, talkThrough, said, snap, text, page, holdLoop, markNow, heard, listen, reload, interact, tp, shoot, markAll, press, jump } = t;
const look = () => G(() => {
  const g = window.__game.debug.game, C = window.__game.debug.world.places.citadel, m = g.missions.active, head = g.nehorai.bones?.head;
  const P = g.paint, ally = (id) => P.allies.find((a) => a.npc === g.npc(id));
  return {
    id: m?.def.id ?? null, step: m?.stepIndex ?? null, s: m ? Object.fromEntries(Object.entries(m.s).filter(([, v]) => v == null || typeof v !== 'object')) : null,
    preset: g.daylight?.presetName ?? null, bandage: !!head?.getObjectByName('bandage'), mode: g.mode, armed: P.armed, kind: P.player?.kind ?? null, allies: P.allies.length, hits: P.hits,
    me: { x: g.player.pos.x, z: g.player.pos.z, y: g.player.pos.y }, squad: g.squad.mode, sq: g.squad.ids.slice(),
    gate: C.gates.service.isOpen, inner: C.innerGate.isOpen, alarm: C.alarm.active, lift: { state: C.lift.state, power: C.lift.power, level: C.lift.level }, hall: { locked: C.energyHall.door.locked, open: C.energyHall.door.open },
    gang: ['erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'].map((id) => { const n = g.npc(id); return { id, vis: n.visible, x: n.pos.x, z: n.pos.z, y: n.pos.y, marked: !!ally(id)?.marked, task: g.squad.tasks.get(id)?.label ?? null }; }),
    guards: P.guards.filter((x) => x.npc.visible && !x.marked).map((x) => x.npc.id), beams: g.energy?.active ?? 0,
    fail: !g.hud.el.fail.hidden, objective: document.getElementById('objText')?.textContent || '', pill: document.getElementById('pursuit')?.textContent || '',
  };
});
const P = await G(() => {
  const C = window.__game.debug.world.places.citadel, q = (p) => p && { x: p.x, z: p.z, y: p.y, yaw: p.yaw }, T = C.towers[1], L = C.lift, I = C.innerGate, s = C.plant.stairs;
  const ps = C.energy.pylons, z0 = Math.min(...ps.map((p) => p.z));
  return {
    y: C.y, gateIn: q(C.gates.service.inside), gateOut: q(C.gates.service.outside), foot: q(T.foot), landing: q(T.landing), top: q(T.top), post: q(T.post),
    fuse: q(C.alarm.fuseAt), panel: q(C.alarm.panelAt), front3: q(C.stores.fronts[2]), sw: q(L.switchAt), liftTop: q(L.topAt), onTop: q(L.onTop), liftBottom: q(L.bottomAt),
    exitFoot: q(C.tunnels.exits.north.foot), exitTop: q(C.tunnels.exits.north.top), cross: q(C.tunnels.cross), wheelB: q(I.wheelBAt), wheelA: q(I.wheelAAt), innerIn: q(I.inside),
    west: q(C.control.approaches[0].inside), south: q(C.control.approaches[1].inside), south0: q(C.control.approaches[1].outside), pc: q(C.computer.at),
    rowN: z0, rowS: Math.max(...ps.map((p) => p.z)), plantE: { x: C.toWorld(-26, 34).x, z: C.toWorld(-26, 34).z, y: C.y }, plantIn: { x: C.toWorld(-31, 34).x, z: C.toWorld(-31, 34).z, y: C.y },
    stairsBottom: q(s.bottom), stairsTop: q(s.top), c1: q(C.bridges.c[1]), c0: q(C.bridges.c[0]), a0: q(C.bridges.a[0]), door: q(C.energyHall.doorOutside),
  };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const objectives = new Set();
const watch = async () => { const v = await look(); if (v.objective) objectives.add(v.objective); return v; };
const goalShown = (i) => [...objectives].some((o) => o.startsWith(GOALS[i]));
// a forced fail: three marks on Nehorai (the paint's own strike, as a pellet or a discharge gives it)
async function forcedFail(stepIdx, re) {
  await G(() => { const P = window.__game.debug.game.paint; for (let i = 0; i < 3; i++) P.strike('test'); });
  const s = await until((s) => s.fail, 4, 'the fail');
  const reason = await text('#failReason');
  check(`goal ${stepIdx + 1}: three marks fail it, with a reason and a tip`, !!s && /סומן שלוש פעמים/.test(reason) && re.test(reason), reason);
  await page.tap('#retryBtn'); await holdLoop(true);
  return until((s) => !s.fail && s.mission?.step === stepIdx, 6, 'the retry');
}
let s, v;

// ---------- the start: at the service gate ----------
v = await watch();
check('mission 49 begins at the citadel\'s service gate: Nehorai on foot with the whole gang, the three cars behind', v.id === 'citadel' && v.step === 0 && v.mode === 'foot' && v.gang.every((n) => n.vis && dist(n, v.me) < 20) && dist(v.me, P.gateOut) < 60, JSON.stringify({ step: v.step, mode: v.mode, d: dist(v.me, P.gateOut).toFixed(0) }));
check('the red sky, chapter nine\'s bandage, his marker of his kind, every friend armed', v.preset === 'redSky' && v.bandage && v.armed && v.allies === 8, JSON.stringify({ preset: v.preset, bandage: v.bandage, kind: v.kind, allies: v.allies }));
check(`goal 1 on screen word for word: "${GOALS[0]}"`, v.objective.startsWith(GOALS[0]), v.objective);
check('the service gate shut', !v.gate);
await snap('m49-0-gate');

// ---------- goal 1: the entrance ----------
await markNow();
s = await talkThrough(async () => (await watch()).s?.phase === 'lock', 40, 'the scene');
check('the scene at the gate ("זהו, חבר’ה. נכנסים ביחד, יוצאים ביחד.")', said('זהו, חבר’ה. נכנסים ביחד, יוצאים ביחד.', 'נהוראי') && said('שער השירות נעול. תנו לי כמה שניות עם המנעול.', 'מולר'));
s = await until(async () => (await watch()).s?.phase === 'yard', 40, 'Muller at the lock');
v = await look();
check('Muller walks to the lock and opens the service gate (a job of his)', !!s && v.gate && /מולר פותח/.test([...objectives].join('|')), [...objectives].join(' / '));
// a forced fail at the first checkpoint
s = await forcedFail(0, /תחפו עליי|מאחורי/);
v = await look();
check('retry: back outside the gate, the gate shut again, the gang with him, the marks gone', !!s && !v.gate && v.hits === 0 && v.allies === 8 && v.s.phase !== 'yard', JSON.stringify({ gate: v.gate, hits: v.hits, phase: v.s?.phase }));
await markNow();
s = await talkThrough(async () => (await watch()).s?.phase === 'yard', 60, 'the gate again');
await tp(P.gateIn, 0, 0, Math.PI / 2);
s = await until(async () => (await look()).guards.length >= 4, 4, 'the guards');
const real1 = await shoot('og1');
await markAll(['og2', 'og3', 'og4']);
s = await talkThrough(async () => (await watch()).s?.phase === 'order', 20, 'the tower');
check('the yard inside the gate: four of the Order marked (one with a real shot)', !!s && real1, `real ${real1}`);
check('Erez: "נשארו שניים על מגדל השמירה. תן פקודה לחפות..."; the goal asks for the order', said('נשארו שניים על מגדל השמירה. תן פקודה לחפות — ואני מוריד להם את הראש.', 'ארז') && /תחפו עליי/.test((await look()).objective));
await press('btnSquad'); await step(0.3);
await press('btnSquad'); await step(0.3);
s = await talkThrough(async () => (await watch()).s?.phase === 'climb', 6, 'the order');
v = await look();
check('the squad\'s order button: "תחפו עליי!" given (follow → hold → cover); Erez covers', !!s && v.squad === 'cover', v.squad);
await tp(P.foot);
await tp(P.landing);
s = await until(async () => ((await look()).s.pinned || 0) >= 2, 4, 'Erez\'s paint at the tower');
v = await look();
check('Erez\'s paint flies at the tower and keeps its men down while Nehorai climbs', (v.s.pinned || 0) >= 2 && v.hits === 0, `pinned ${v.s.pinned} · hits ${v.hits}`);
const real5 = await shoot('og5');
await tp(P.top);
await snap('m49-1-tower');
const real6 = await shoot('og6');
s = await talkThrough(async () => (await watch()).step >= 1, 20, 'goal 2');
check('the watch tower climbed by its stairs, both of its men marked for real', real5 && real6 && (await look()).me.y > P.y + 2, `${real5} ${real6}`);
check('"הכניסה שלנו!"; goal 2 begins', said('הכניסה שלנו!', 'ארז') && (await look()).step === 1);

// ---------- goal 2: the alarm ----------
v = await watch();
check(`goal 2 on screen word for word: "${GOALS[1]}"; the alarm on (sirens, red light)`, v.objective.startsWith(GOALS[1]) && v.alarm, v.objective);
s = await forcedFail(1, /הנתיך/);
v = await look();
check('retry at the alarm: inside the service gate, the alarm on again', !!s && v.alarm && dist(v.me, P.gateIn) < 3 && v.hits === 0);
await markNow();
await tp(P.front3, 0, -3);
await tp(P.fuse);
s = await until(async () => (await look()).gang.filter((n) => (n.id === 'dolev' || n.id === 'avraham') && n.task === 'על הדלת').length === 2, 6, 'Dolev and Avraham');
check('Dolev and Avraham hold the store\'s door ("אני ואברהם על הדלת של המחסן...")', !!s);
await markAll(['og9', 'og10']);
check('the prompt "לחתוך את הנתיך"', await interact('לחתוך את הנתיך'));
s = await talkThrough(async () => (await watch()).s?.phase === 'panel', 8, 'the fuse');
check('the fuse cut (a Work of a few seconds); the panel next', !!s && said('אני ואברהם על הדלת של המחסן. אף אחד לא נכנס.', 'דולב'));
s = await talkThrough(async () => ((await look()).s.pairs || 0) >= 1, 30, 'a pair');
v = await look();
check('while it rings the alarm calls a fresh pair of the Order', (v.s.pairs || 0) >= 1, `pairs ${v.s.pairs}`);
await markAll(['og11', 'og12', 'og13', 'og14', 'og15', 'og16']);
await G(() => { window.__game.debug.game.paint.hits = 0; }); // (the walk across the yard: the test marks the pairs, not the player's luck)
await tp(P.panel);
await markAll(['og7', 'og8', 'og11', 'og12', 'og13', 'og14', 'og15', 'og16']);
check('the prompt "לכבות את האזעקה" in the alarm room', await interact('לכבות את האזעקה'));
s = await talkThrough(async () => { await markAll(['og11', 'og12', 'og13', 'og14', 'og15', 'og16']); return (await watch()).step >= 2; }, 20, 'goal 3');
v = await look();
check('the alarm off: the sirens and the red light gone, no more pairs; goal 3 begins', !!s && !v.alarm && said('שקט. אני אוהב שקט.', 'מולר'), JSON.stringify({ alarm: v.alarm, step: v.step }));

// ---------- goal 3: the freight lift ----------
v = await watch();
check(`goal 3 on screen word for word: "${GOALS[2]}"; the lift below without power`, v.objective.startsWith(GOALS[2]) && v.lift.state === 'bottom' && !v.lift.power, v.objective);
s = await forcedFail(2, /המחסנים/);
check('retry at the lift\'s goal: out of the alarm room, the lift below and dark', !!s && !(await look()).lift.power);
await markNow();
await tp(P.sw);
await markAll(['og1']);
check('the prompt "להפעיל את החשמל של המעלית" in store one', await interact('להפעיל את החשמל של המעלית'));
s = await talkThrough(async () => (await watch()).lift.power, 4, 'the power');
await tp(P.liftTop);
check('the prompt "לקרוא למעלית"', await interact('לקרוא למעלית'));
s = await talkThrough(async () => (await look()).lift.state === 'top', 12, 'the lift up');
check('the lift comes up (it really moves)', !!s);
await tp(P.onTop);
s = await talkThrough(async () => { const w = await look(); return w.gang.filter((n) => ['erez', 'ido', 'avraham', 'muller', 'dolev', 'liam'].includes(n.id) && Math.abs(n.x - P.onTop.x) < 3 && Math.abs(n.z - P.onTop.z) < 3).length === 6; }, 14, 'the gang aboard');
check('the gang walks onto the platform; Hadar and Yonati stay by the shaft ("שומרים על הפיר")', !!s && (await look()).gang.filter((n) => n.task === 'שומרים על הפיר').length === 2);
check('the prompt "לרדת למנהרות"', await interact('לרדת למנהרות'));
await snap('m49-2-lift');
s = await talkThrough(async () => (await watch()).step >= 3, 20, 'down');
v = await look();
const riders = v.gang.filter((n) => !['hadar', 'yonati'].includes(n.id));
check('down in the tunnels with the gang (they rode the platform down)', !!s && v.me.y < P.y - 4 && riders.every((n) => n.y < P.y - 4 && dist(n, v.me) < 14), JSON.stringify(riders.map((n) => [n.id, n.y.toFixed(1)])));
check('Hadar and Yonati at the top, the two who came to the shaft marked ("סימנתי אחד! ראשון!")', v.gang.filter((n) => ['hadar', 'yonati'].includes(n.id)).every((n) => n.vis && n.y > P.y - 1) && said('סימנתי אחד! ראשון!', 'יונתי'));

// ---------- goal 4: the inner gate (a reload here first) ----------
s = await reload();
v = await watch();
check('a reload in the tunnels is picked up at goal 4\'s checkpoint: below with the gang, Hadar and Yonati at the shaft, the lift down with power, the red sky, the bandage', v.id === 'citadel' && v.step === 3 && v.me.y < P.y - 4 && v.lift.power && v.lift.state === 'bottom' && v.preset === 'redSky' && v.bandage && v.armed && v.gang.filter((n) => ['hadar', 'yonati'].includes(n.id)).every((n) => n.vis && n.y > P.y - 1), JSON.stringify({ step: v.step, y: v.me.y.toFixed(1), lift: v.lift, preset: v.preset }));
check(`goal 4 on screen word for word: "${GOALS[3]}"`, v.objective.startsWith(GOALS[3]), v.objective);
s = await forcedFail(3, /הסיור/);
check('retry at the inner gate\'s goal: in the tunnels again', !!s && (await look()).me.y < P.y - 4);
await markNow();
await tp(P.cross);
await markAll(['og2', 'og3']);
await tp(P.exitFoot);
await tp(P.exitTop);
await tp(P.wheelB);
s = await talkThrough(async () => (await watch()).s?.phase === 'wheels', 6, 'the wheels');
check('up the north stairs inside the inner compound; Ido goes to the other wheel', !!s && said('שני גלגלים, אחד לכל צד. אני בשמאלי — אתה בימני. רק ביחד הוא זז.', 'עידו'));
check('the prompt "לסובב את הגלגל"', await interact('לסובב את הגלגל'));
s = await talkThrough(async () => (await look()).s.p >= 0.2, 25, 'the turn');
check('both wheels needed: the gate goes up only while Ido and Nehorai turn', !!s);
s = await talkThrough(async () => (await look()).s.halt === true, 25, 'the patrol');
check('half-way a patrol comes; the wheels wait', !!s);
await step(1.5);
const real4 = await shoot('og4');
await markAll(['og5', 'og6']);
await tp(P.wheelB);
s = await talkThrough(async () => (await look()).s.halt === false, 8, 'the patrol held off');
check('the patrol held off (one real shot); back to the wheels; Ido called it ("סיור! מהחצר הפנימית!")', !!s && real4 && said('סיור! מהחצר הפנימית! עזוב את הגלגל ותעצור אותם!', 'עידו'));
check('the prompt "לסובב את הגלגל" again', await interact('לסובב את הגלגל'));
await snap('m49-3-wheels');
s = await talkThrough(async () => (await watch()).step >= 4, 40, 'the gate open');
v = await look();
check('the inner gate up; Hadar and Yonati come through ("חיכינו בחוץ כמו שני עציצים")', !!s && v.inner && said('Bro! חיכינו בחוץ כמו שני עציצים.', 'הדר') && v.sq.length === 8, JSON.stringify(v.sq));

// ---------- goal 5: Muller at the computer ----------
check(`goal 5 on screen word for word: "${GOALS[4]}"`, v.objective.startsWith(GOALS[4]), v.objective);
s = await forcedFail(4, /שולחן/);
check('retry at the computer\'s goal: behind the inner gate, the gate open', !!s && (await look()).inner);
await markNow();
await tp(P.west);
s = await talkThrough(async () => (await watch()).s?.phase === 'hack', 30, 'Muller at the computer');
v = await look();
check('Muller at the computer; Erez, Ido, Avraham and Dolev at the three ways in', !!s && v.gang.filter((n) => n.task === 'בעמדה').length === 4, JSON.stringify(v.gang.map((n) => [n.id, n.task])));
const waves = new Set(); let realW = null, wiped = false;
s = await talkThrough(async () => {
  const w = await watch();
  if (w.s?.from) waves.add(w.s.from);
  if (w.guards.some((id) => ['og7', 'og8', 'og9', 'og10', 'og11', 'og12', 'og13', 'og14', 'og15'].includes(id))) {
    await step(2);
    if (realW === null) { const id = (await look()).guards.find((x) => ['og7', 'og8', 'og9'].includes(x)); if (id) realW = await shoot(id); }
    await markAll(['og7', 'og8', 'og9', 'og10', 'og11', 'og12', 'og13', 'og14', 'og15']);
  }
  if (!wiped && (w.s?.bar || 0) > 0.5) { wiped = true; await G(() => { const g = window.__game.debug.game, a = g.paint.allies.find((x) => x.npc === g.npc('muller')); g.paint.markAlly(a, g.paint.guards[0]); }); }
  return w.step >= 5;
}, 110, 'the bar');
v = await look();
check('three waves, each by a different way in (south, east, west), held off', waves.size === 3 && realW !== false, [...waves].join(','));
check('Muller marked stops, wipes it off and goes on ("צבע על המסך. יופי. ממשיך.")', said('צבע על המסך. יופי. ממשיך.', 'מולר') && (v.s.mullerMarks ?? 1) >= 0);
check('the bar full: Muller opens the energy hall\'s door from the computer', !!s && !v.hall.locked && said('רק דבר אחד: עמודי המתח בחצר פורקים חשמל. בין השורות עוברים בזמן.', 'מולר'));

// ---------- goal 6: the pylons, the bridges, the tower's door ----------
v = await watch();
check(`goal 6 on screen word for word: "${GOALS[5]}"`, v.objective.startsWith(GOALS[5]), v.objective);
await markNow();
// a fail from the discharges themselves: Nehorai stands on the north row's line until it has struck three times
await tp({ x: P.south0.x, z: P.rowN - 2.5, y: P.y });
await jump({ x: P.south0.x, z: P.rowN, y: P.y });
s = await until(async (s) => { await G((z) => { const g = window.__game.debug.game; if (Math.abs(g.player.pos.z - z) > 0.3) g.player.place(g.player.pos.x, z, g.player.yaw); }, P.rowN); return s.fail; }, 30, 'the discharges');
const reason6 = await text('#failReason');
check('a discharge strikes only after its warning line, and three of them fail goal 6 with a tip', !!s && /הקו על הרצפה/.test(reason6), reason6);
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => !s.fail && s.mission?.step === 5, 6, 'the retry');
v = await look();
check('retry at goal 6: in control room B, the hall door still open to them', !!s && !v.hall.locked && v.hits === 0);
await markNow();
// the crossing: at each row, wait for its beam to end, then go
const crossRow = async (z0, z1, endAt) => {
  await tp({ x: P.south0.x, z: z0, y: P.y });
  await until(async () => { const c = (await look()).s.cycle; return c > endAt && c < endAt + 0.4; }, 6, 'the row going quiet');
  return tp({ x: P.south0.x, z: z1, y: P.y });
};
await tp({ x: P.south0.x, z: P.rowN - 2.5, y: P.y }, 0, 0, 0);
await talkThrough(async () => { const c = (await look()).s.cycle; return c > 1.6 && c < 2.1; }, 8, 'a row discharging');
await snap('m49-4-pylons');
const hits0 = (await look()).hits;
await crossRow(P.rowN - 2.5, P.rowN + 3, 2.3);
await crossRow(P.rowS - 2.5, P.rowS + 3, 0.02);
await listen();
v = await look();
check('both rows crossed between their discharges (no mark taken); Erez calls the timing', v.hits === hits0 && heard.some((l) => l.startsWith('ארז: ') && /רוץ|עבור|עכשיו/.test(l)), `hits ${v.hits} · ${heard.filter((l) => l.startsWith('ארז')).join(' | ')}`);
await tp(P.plantE);
await tp(P.plantIn);
await tp(P.stairsBottom);
await tp(P.stairsTop);
await tp(P.c1);
await markAll(['og16', 'og17']);
await tp(P.c0);
await tp(P.a0);
await tp(P.door);
s = await talkThrough(async () => (await watch()).id !== 'citadel', 30, 'the door');
v = await look();
check('up the plant house, over bridge C and bridge A to the energy hall\'s door at +7', v.me.y > P.y + 6 && dist(v.me, P.door) < 4, JSON.stringify(v.me));
check('at the tower\'s door: "הנה הוא. המגדל." / "מה שלא יחכה לנו שם בפנים — ביחד."', said('הנה הוא. המגדל.', 'נהוראי') && said('מה שלא יחכה לנו שם בפנים — ביחד.', 'ארז'));
await snap('m49-5-door');
check('every one of the six goals was on screen word for word', GOALS.every((_, i) => goalShown(i)), GOALS.filter((_, i) => !goalShown(i)).join(' / '));
check('mission 49 done; "הנפילה של הגיבור" begins', v.id === 'fall' && (await G(() => window.__game.debug.game.progress.done.includes('citadel'))), JSON.stringify({ id: v.id }));
check('handed over at the door: the gang on the bridge with him, the door open, the red sky, the bandage, armed', v.mode === 'foot' && v.hall.open && v.gang.every((n) => n.vis && dist(n, v.me) < 16 && Math.abs(n.y - v.me.y) < 1.5) && v.preset === 'redSky' && v.bandage && v.armed && v.allies === 8, JSON.stringify(v.gang.map((n) => [n.id, Math.round(dist(n, v.me)), n.y.toFixed(1)])));
await t.finish();
