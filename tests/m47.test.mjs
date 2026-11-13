// Mission 47 ("השקט לפני הסוף", chapter ten's first) played on the stage harness: a save at the start of chapter
// ten, the mission opening by itself; the scene at 05:30 (the balcony, the sunrise, the bandage, the threat map,
// every line word for word, the card); the gear from the rack; a marker off the table; the friends; into the
// Renault while the gang boards the two other cars; mission 48 begins. A forced fail at each checkpoint (Nehorai
// leaves the safe house) is retried, and a reload in the middle is picked up at its checkpoint.
//   node tests/m47.test.mjs   (after node tools/build-single.mjs)
import { openStage } from './lib/stage.mjs';
import { L, CARDS } from '../src/missions/lines10.js';

const t = await openStage({ chapter: 10, done: [], first: 'dawn' });
const { check, S, G, step, until, talkThrough, said, interact, tp, snap, text, page, holdLoop, markNow, heard } = t;
const pt = (expr) => G((expr) => { const g = window.__game.debug.game, W = window.__game.debug.world, h = W.places.safehouse; const q = new Function('g', 'W', 'h', `return (${expr});`)(g, W, h); return q && { x: q.x, z: q.z, y: q.y ?? h.y, yaw: q.yaw }; }, expr);
const look = () => G(() => {
  const g = window.__game.debug.game, h = window.__game.debug.world.places.safehouse, P = g.paint, head = g.nehorai.bones?.head;
  const npc = (id) => { const n = g.npc(id); return { x: n.pos.x, z: n.pos.z, car: n.inCar ? n.inCar.name || (n.inCar === g.car ? 'renault' : 'car') : null, vis: n.visible }; };
  return {
    preset: g.daylight?.presetName ?? null, bandage: !!head?.getObjectByName('bandage'), wrap: !!(g.nehorai.bones?.elL || g.nehorai.bones?.armL)?.getObjectByName('wrap'),
    screen: h.screen.mode, gear: h.gear.taken, allies: P.allies.length, armed: P.armed, kind: P.kind, chosen: g.progress.marker ?? null, playKind: P.player?.kind ?? null,
    table: (g.missions.active?.table?.items || []).map((i) => (i.holder.visible ? i.kind : '-')).join(','), tableOn: !!g.missions.active?.table?.group.visible,
    me: { x: g.player.pos.x, z: g.player.pos.z }, erez: npc('erez'), ido: npc('ido'), muller: npc('muller'), dolev: npc('dolev'),
    renault: { x: g.car.pos.x, z: g.car.pos.z },
  };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const line = (k) => L.dawn[k];
const heardLine = (k) => said(line(k)[1], line(k)[0]);
const H = {
  balcony: await pt('h.balcony'), gear: await pt('h.gear'), table: await pt('h.gear.table'), car: await pt('h.car'), x: 650, z: -175,
};

// ---------- 0: the scene ----------
let s = await S();
check('a save at the start of chapter ten: "השקט לפני הסוף" opens by itself', s.mission?.id === 'dawn' && s.mission.step === 0, JSON.stringify(s.mission));
s = await until(async (s) => s.cutscene && dist(s.me, H.balcony) < 0.6, 40, 'the balcony');
await snap('m47-0-sunrise');
s = await until(async () => (await G(() => window.__game.debug.game.dialogue.busy)), 40, 'the first line');
let v = await look();
check('05:30 on the balcony: the sunrise look, Nehorai at the east rail facing the hills, chapter nine\'s bandage (head and arm) still on', v.preset === 'sunrise' && dist(v.me, H.balcony) < 0.6 && v.bandage && v.wrap, JSON.stringify({ preset: v.preset, d: dist(v.me, H.balcony).toFixed(2), bandage: v.bandage, wrap: v.wrap }));
await snap('m47-1-balcony');
s = await talkThrough(() => heardLine('idoLook'), 90, 'the balcony');
check('the balcony, word for word: Erez "מה, לא ישנת כל הלילה?", Nehorai, Erez, then Ido runs in', ['erezAwake', 'cantSleep', 'today', 'idoLook'].every(heardLine), heard.slice(0, 5).join(' | '));
v = await look();
check('Erez came out to him (beside him on the balcony), Ido at the balcony', dist(v.erez, await pt('h.balconySide')) < 1.2 && v.ido.x > 634 && v.ido.z < -185.5, JSON.stringify({ erez: v.erez, ido: v.ido }));
s = await talkThrough(() => said('תסתכלו על האדום. כל כתם כזה זה מקום שהמכונה של הצל כבר נוגעת בו.'), 90, 'the threat map');
await snap('m47-2-threat');
s = await talkThrough(() => heardLine('mullerMachine'), 90, 'Muller');
v = await look();
check('inside: the threat map on the screen, Muller explains, then "אם המכונה הזאת תגיע לעוצמה מלאה..."', v.screen === 'threat' && heardLine('mullerMachine') && said('במצודה שלו הוא הפעיל מכונה ניסיונית ענקית. היא פותחת שערים בין יקומים.', 'מולר') && dist(v.me, H.balcony) > 8, `screen ${v.screen}`);
s = await talkThrough(() => heardLine('notLetting'), 60, 'Nehorai');
s = await until(async () => (await G(() => window.__game.debug.game.missions.active?.beats)) && (await G(() => !window.__game.debug.game.dialogue.busy)), 10, 'the camera over the friends');
await step(2.4);
await snap('m47-2b-pass');
s = await talkThrough(() => heardLine('everyoneHome'), 90, 'the camera over the friends');
check('"אז אנחנו לא נותנים לה להגיע לעוצמה מלאה." then the camera over every friend, then "היום אנחנו מסיימים את זה. כולם חוזרים הביתה."', heardLine('notLetting') && heardLine('everyoneHome'), heard.slice(-3).join(' | '));
check('the music swells with the line (the epic theme)', await G(() => window.__game.debug.game.sound?.musicMode === 'epic'), await G(() => window.__game.debug.game.sound?.musicMode));
let cardSeen = false;
s = await until(async (s) => { if (!cardSeen) cardSeen = (await text('#fadeText')) === CARDS.finalChapter && (await G(() => document.getElementById('fade').classList.contains('on'))); return s.mission?.step === 1 && !s.cutscene; }, 40, 'the card');
check(`the card on black: "${CARDS.finalChapter}", then control back`, cardSeen && !!s && s.mode === 'foot', `${await text('#fadeText')}`);

// ---------- 1: the gear (a forced fail first, retried at this checkpoint) ----------
check('step 1 "לאסוף את הציוד" on screen, the arrow at the rack', /לאסוף את הציוד/.test(s.objective) && !!(await G(() => window.__game.debug.game.target)), s.objective);
await G(() => window.__game.teleport(650 + 150, -175));
s = await until((s) => s.fail, 6, 'the fail');
check('leaving the safe house fails with a reason and a tip', !!s && /התרחקת מבית המסתור/.test(await text('#failReason')) && /חוזרים לחצר/.test(await text('#failReason')));
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => s.mission?.step === 1 && !s.fail, 10, 'the retry');
v = await look();
check('retry at the gear: the morning, the bandage, the gear back on the rack, nobody armed, Nehorai in the living room', !!s && v.preset === 'sunrise' && v.bandage && !v.gear && v.allies === 0 && !v.armed && dist(v.me, { x: 634.6, z: -178.4 }) < 0.8, JSON.stringify({ preset: v.preset, gear: v.gear, allies: v.allies, armed: v.armed, me: v.me }));
let r = await tp(H.gear);
check('walked to the gear room with the stick', r === 'ok', r);
check('"לאסוף את הציוד" pressed at the rack', await interact('לאסוף את הציוד', 8));
s = await until((s) => s.mission?.step === 2, 15, 'the gear handed out');
v = await look();
check('the gear handed out: every friend armed with his own marker, the three markers out on the table', !!s && v.gear && v.allies === 8 && v.tableOn && v.table === 'quick,balanced,long', JSON.stringify({ allies: v.allies, table: v.table }));

// ---------- 2: a marker ----------
check('step 2 "לבחור רובה"', /לבחור רובה/.test((await S()).objective), (await S()).objective);
r = await tp({ x: H.table.x + 0.82, z: H.table.z + 1.15, y: H.table.y }, 0, 0, Math.PI);
s = await until((s) => /ארוך ומדויק ·/.test(s.objective), 4, 'the description');
check('at the long marker: its one-line description on screen', !!s, s?.objective);
check('"לקחת · ארוך ומדויק" pressed: the kind set and the marker in his hand', await interact('לקחת · ארוך ומדויק', 6));
s = await until((s) => s.mission?.step === 3, 10, 'the friends');
v = await look();
check('the long marker in his hand (kind kept in the progress), the HUD shows it', v.armed && v.kind === 'long' && v.chosen === 'long' && v.playKind === 'long' && v.table === 'quick,balanced,-' && /ארוך/.test(await text('#markerKind').catch(() => '')), JSON.stringify({ kind: v.kind, table: v.table }));
await snap('m47-3-table');

// ---------- 3: the friends (a change of marker, an optional talk, a reload, a forced fail) ----------
check('step 3 "לדבר עם החברים (0/3)"', /לדבר עם החברים \(0\/3\)/.test(s.objective), s.objective);
r = await tp({ x: H.table.x - 0.82, z: H.table.z + 1.15, y: H.table.y }, 0, 0, Math.PI);
check('changed his mind at the table: "לקחת · מהיר"', await interact('לקחת · מהיר', 6) && (await look()).kind === 'quick');
const dolev = (await look()).dolev;
await tp(dolev, 1.2, 0, null, { near: 0.6 }); // round the table's end to him (by the table the marker's prompt is the nearer one)
await markNow();
check('the others answer too: "לדבר עם דולב"', await interact('לדבר עם דולב', 6));
s = await talkThrough(async () => !(await G(() => window.__game.debug.game.missions.active.s.talking)) && said('רכב שלוש, עם מולר וליאם. ואם מישהו שואל, אני הייתי ער ראשון.'), 30, 'Dolev');
check('Dolev\'s line heard', !!s);
// the reload in the middle
s = await t.reload();
s = await until((s) => s.mission?.id === 'dawn' && s.mission.step === 3 && !s.cutscene, 30, 'the resume');
v = await look();
check('a reload is picked up at the friends\' checkpoint: the morning, the bandage, the quick marker held, the gang at their places', !!s && v.preset === 'sunrise' && v.bandage && v.armed && v.kind === 'quick' && v.table === '-,balanced,long' && v.allies === 8 && dist(v.erez, await pt('g.car.local(-2.3, -0.4)')) < 1.0 && v.screen === 'threat', JSON.stringify({ preset: v.preset, kind: v.kind, table: v.table, allies: v.allies, erez: v.erez }));
await G(() => window.__game.teleport(650 - 160, -175));
s = await until((s) => s.fail, 6, 'the fail');
check('leaving now fails too', !!s && /התרחקת/.test(await text('#failReason')));
await page.tap('#retryBtn'); await holdLoop(true);
s = await until((s) => s.mission?.step === 3 && !s.fail, 10, 'the retry');
v = await look();
check('retry at the friends: back by the table, the marker of his choice in hand, nobody talked to yet', !!s && v.kind === 'quick' && v.armed && /\(0\/3\)/.test(s.objective) && dist(v.me, { x: 641.5, z: -179.8 }) < 0.8, s?.objective);
for (const [id, name, key] of [['muller', 'מולר', 'אני יודע. אבל נחמד לשמוע.'], ['erez', 'ארז', 'כמו תמיד. רק תנסה לא לחזור עם עוד תחבושת. נגמרו לנו.'], ['ido', 'עידו', 'אני? אני הכי זהיר שיש. כמעט תמיד.']]) {
  const n = (await look())[id];
  r = await tp(n, 0, 0, null, { near: 1.5 });
  await markNow();
  const ok = await interact(`לדבר עם ${name}`, 8);
  s = await talkThrough(async () => !(await G(() => window.__game.debug.game.missions.active?.s.talking)) && said(key), 40, name);
  check(`"לדבר עם ${name}": what he does today (walked there: ${r})`, ok && !!s, heard.slice(0, 2).join(' | '));
  if (id === 'ido') await snap('m47-4-yard');
}
s = await until((s) => s.mission?.step === 4, 6, 'the cars');
check('step 4 "לעלות לרכב המבצע"', !!s && /לעלות לרכב המבצע/.test(s.objective), s?.objective);

// ---------- 4: into the Renault; the convoy ----------
r = await tp(await pt('g.car.local(1.9, 0.3)'), 0, 0, null, { near: 1.0 });
check('"להיכנס לרכב" at the Renault', await interact('להיכנס לרכב', 8), r);
s = await until((s) => s.mission?.id === 'lastconvoy', 40, 'the next mission');
v = await look();
const crews = await G(() => { const g = window.__game.debug.game; return ['erez', 'avraham'].every((id) => g.npc(id).inCar === g.car) && ['ido', 'yonati', 'hadar', 'muller', 'dolev', 'liam'].every((id) => g.npc(id).inCar && g.npc(id).inCar !== g.car) && g.npc('ido').inCar !== g.npc('muller').inCar; });
check('everyone in the three cars (Erez with Nehorai; Ido leading car two; Muller in car three): mission 47 done, "השיירה האחרונה" begins in the car', !!s && s.mode === 'car' && crews && (await G(() => window.__game.debug.game.progress.done.includes('dawn'))), JSON.stringify(s?.mission));
check('handed over in the morning, the bandage still on, the long-or-quick marker kept', v.preset === 'sunrise' && v.bandage && v.chosen === 'quick');
await t.finish();
