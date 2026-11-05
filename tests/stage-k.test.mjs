// Chapter four acceptance test: Erez's call about Kotzi's "bank", the video call from Ido (the overlay,
// the second view in the corner, the first line word for word), picking him up at the promenade, the
// plan at the gym, the paintball marker on five targets with the real fire button; then the bank at
// night: the headlights, the crew behind the bank, six guards marked with paint (and the failure after
// three marks, with a retry), Kotzi and the vault, the bags, the chase, and the dawn at the lookout.
// usage: node tests/stage-k.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000); // software rendering, and the night's lights compile their shaders once
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const state = () => page.evaluate(() => window.__game.state);
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
async function until(cond, maxSec, what) {
  const t0 = (await state()).time;
  for (;;) {
    const s = await state();
    if (await cond(s)) return s;
    if (s.time - t0 > maxSec) { console.log(`  (timed out waiting for ${what})`); return null; }
    await wait(100);
  }
}
const heard = [];
let mark = 0;
const markNow = async () => { mark = await page.evaluate(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
const listen = async () => {
  const { h, said } = await page.evaluate(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said }));
  heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark))));
};
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const text = (sel) => page.textContent(sel);

// a game saved at the end of chapter three
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 2050,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves', 'fightnight', 'mainevent'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2', 'fightnight', 'chapter-3'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('the start screen counts five chapters', /חמישה פרקים · שבע עשרה משימות/.test(await text('#startScreen')));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { bank: { front: p.bank.front, yard: p.bank.yard, bay: p.bank.bay, bayInside: p.bank.bayInside, vaultFront: p.bank.vaultFront, cell: p.bank.cell }, lookout: p.lookout, gymInside: p.gymInside, gymParking: p.gymParking }; });

// ---------- mission 14: Ido joins ----------
let s = await state();
check('after chapter three the panel says chapter four is next, and how it starts', /פרק 4 · המשימה הבאה/.test(await text('#objLabel')) && /עידו מצטרף · ארז יתקשר/.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
s = await until((s) => s.mission?.id === 'ido', 20, 'the mission');
check('a few quiet seconds later "Ido joins" begins', !!s);
s = await until(async () => page.isVisible('#callCard'), 12, 'Erez ringing');
check('Erez calls: a card with his name', !!s && (await text('#callName')) === 'ארז');
check('the panel heading is chapter four, mission 1 of 2', /פרק 4 · משימה 1 מתוך 2 · עידו מצטרף/.test(await text('#objLabel')), await text('#objLabel'));
await markNow();
await page.tap('#callAnswer');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the call');
check('Erez: Kotzi opened a bank with everyone\'s money', heard.some((t) => t.includes('ארז:') && /בנק קוצי/.test(t)) && heard.some((t) => /הכסף של כולם/.test(t)));
s = await until(async () => page.isVisible('#callCard'), 12, 'the video call ringing');
check('out of the blue, a video call: the card says it is Ido, on video', !!s && /עידו/.test(await text('#callName')) && /וידאו/.test(await text('#callName')), await text('#callName'));
await markNow();
const ido0 = await G(() => { const n = window.__game.debug.game.npc('ido'); return { x: n.pos.x, z: n.pos.z }; });
await page.tap('#callAnswer');
s = await until((s) => s.call, 6, 'the call overlay');
const pip = await G(() => { const g = window.__game.debug.game, c = g.camera.position, n = g.npc('ido'); return { pip: !!g.pip, camToIdo: Math.hypot(c.x - n.pos.x, c.z - n.pos.z), name: document.getElementById('vcallName').textContent, frame: document.getElementById('vcallSelf').getBoundingClientRect().width }; });
check('the video call fills the screen: Ido\'s name at the top, the camera right on him, Nehorai in the small frame', !!s && pip.pip && pip.camToIdo < 2 && pip.name === 'עידו הידנה' && pip.frame > 60, JSON.stringify(pip));
await wait(1500);
await page.screenshot({ path: `${shots}/k1-video-call.png` });
await G(() => window.__game.setTimeScale(1));
s = await until(async () => { await listen(); return heard.length >= 2; }, 30, 'two lines');
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => s.mission?.step === 2, 90, 'the call');
check('Ido: "שמע נהוראי, שמעתי על קוצי מארז, ואני מצטרף!"', heard.some((t) => t === 'עידו: שמע נהוראי, שמעתי על קוצי מארז, ואני מצטרף!'), heard[0]);
check('Nehorai: a dear brother, he missed him; then straight to business', heard.some((t) => t.includes('נהוראי:') && /אח יקר/.test(t) && /התגעגעתי/.test(t)) && heard.some((t) => /לעניין/.test(t)));
s = await state();
check('the call ends: the overlay is gone, the arrow points at Ido on the promenade', !s.call && !!s.target && Math.hypot(s.target.x - ido0.x, s.target.z - ido0.z) < 1.5 && /טיילת/.test(await text('#objText')), await text('#objText'));
await markNow();
await G((p) => window.__game.teleport(p.x + 2.4, p.z + 0.6), ido0);
s = await until((s) => s.mission?.step === 3, 8, 'the meeting');
check('at the promenade: Ido, introduced as a new character', !!s && (await text('#bannerTitle')) === 'עידו הידנה');
await wait(900);
await page.screenshot({ path: `${shots}/k2-ido.png` });
s = await talkThrough((s) => s.mission?.step === 4, 60, 'the meeting');
check('Ido came with a bag: eight markers and three plans', heard.some((t) => /שמונה רובי פיינטבול/.test(t)));
check('Ido joins Nehorai; next: the gym in Katzir', (await G(() => window.__game.debug.game.idoBuddy.active)) && /למכון בקציר/.test(await text('#objText')), await text('#objText'));
await markNow();
await G((p) => window.__game.teleport(p.x, p.z), P.gymInside);
s = await until((s) => s.mission?.step === 5, 10, 'the plan');
const atGym = await G(() => { const g = window.__game.debug.game, c = g.world.places.gym.c; return ['erez', 'yonati', 'muller', 'avraham', 'dolev', 'hadar', 'ido'].filter((id) => { const n = g.npc(id); return n.visible && Math.hypot(n.pos.x - c.x, n.pos.z - c.z) < 14; }); });
check('the plan at the gym: the whole crew is there', !!s && atGym.length === 7, atGym.join(','));
await wait(1200);
await page.screenshot({ path: `${shots}/k3-plan.png` });
s = await talkThrough((s) => s.mission?.step === 6, 90, 'the plan');
check('Ido: paintball, by their rules, no blood; Avraham talks at the front door', heard.some((t) => t.includes('עידו:') && /פיינטבול/.test(t) && /בלי דם/.test(t)) && heard.some((t) => /אתה מדבר/.test(t)));
s = await state();
check('after the plan Nehorai holds a marker: the fire and reload buttons instead of the fists, eight pellets', !!s.paint && s.paint.ammo === 8 && s.buttons.btnFire && s.buttons.btnReload && !s.buttons.btnPunch, JSON.stringify(s.buttons));
check('five targets in the lot, the arrow at the first', (await G(() => window.__game.debug.game.paint.boards.length)) === 5 && !!s.target);
await G(() => { const g = window.__game, b = g.debug.game.paint.boards[0]; g.teleport(b.pos.x + 0.8, b.pos.z - 5); g.setCamera(Math.atan2(-(b.pos.x - g.debug.game.player.pos.x), -(b.pos.z - g.debug.game.player.pos.z)), 0.15); });
s = await until((s) => s.paint?.lock === 'board', 6, 'the lock');
check('the crosshair locks on the target in front of him', !!s && (await G(() => document.getElementById('crosshair').classList.contains('locked'))));
await wait(300);
await page.screenshot({ path: `${shots}/k4-aim.png` });
const shots0 = await G(() => window.__game.debug.game.paint.shots);
await page.dispatchEvent('#btnFire', 'pointerdown');
await wait(400);
s = await state();
check('the real fire button: a pellet flies, one pellet fewer in the hopper', (await G(() => window.__game.debug.game.paint.shots)) === shots0 + 1 && s.paint.ammo === 7, `ammo ${s.paint?.ammo}`);
await G(() => window.__game.fireBot(true));
s = await until((s) => s.mission?.id !== 'ido', 150, 'five targets');
await G(() => window.__game.fireBot(null));
s = await state();
check('five targets hit: the mission is done, Ido in the crew and in the phone, markers unlocked, 150 ₪', !s.mission && s.progress.done.includes('ido') && s.progress.unlocks.includes('ido-crew') && s.progress.unlocks.includes('paintball') && s.progress.money === 2200, `money ${s.progress.money}`);
check('the marker is put away between missions', !s.paint && !s.buttons.btnFire, JSON.stringify({ paint: s.paint, fire: s.buttons.btnFire }));
await page.tap('#phoneBtn');
check('the phone lists Ido', await page.isVisible('#contacts button[data-id="ido"]'));
await page.tap('#phoneClose');

// ---------- mission 15: Kotzi's bank ----------
s = await until((s) => !!s.target, 4, 'the next marker');
check('next: the Renault, at night', /בנק קוצי · לסימון הכחול ליד הרנו/.test(await text('#objText')) && !!s && Math.hypot(s.target.x - s.car.x, s.target.z - s.car.z) < 3, await text('#objText'));
await G(() => window.__game.enterCar());
s = await until((s) => s.mission?.id === 'bank', 6, 'mission 15');
check('getting into the Renault starts "Kotzi\'s bank"', !!s);
s = await until((s) => s.night >= 0.99, 12, 'the night');
const lights = await G(() => { const g = window.__game.debug.game; return { head: g.car.model.userData.headMat.emissiveIntensity, lamps: g.daylight.lampsIn, exposure: window.__game.debug.renderer.toneMappingExposure }; });
check('it is night: the sky goes dark, the exposure drops, the Renault\'s headlights come on', !!s && lights.head > 1 && lights.lamps && lights.exposure < 1, JSON.stringify(lights));
s = await until((s) => s.mission?.step === 1, 30, 'Ido and Hadar in the car');
check('Ido and Hadar get in; next: drive to the bank', !!s && s.npcs.ido?.inCar && s.npcs.hadar?.inCar && /לבנק קוצי/.test(await text('#objText')) && !!s.target && Math.hypot(s.target.x - P.bank.yard.x, s.target.z - P.bank.yard.z) < 2);
await wait(1500);
await page.screenshot({ path: `${shots}/k5-night-drive.png` });
await markNow();
await G((y) => { const g = window.__game; g.placeCar(y.x, y.z, y.yaw); }, P.bank.yard);
s = await until((s) => s.mission?.step === 2, 10, 'the yard');
const crew = await G(() => { const g = window.__game.debug.game, y = g.world.places.bank.yard; return ['erez', 'yonati', 'avraham', 'dolev', 'muller', 'ido', 'hadar'].filter((id) => { const n = g.npc(id); return n.visible && Math.hypot(n.pos.x - y.x, n.pos.z - y.z) < 14; }); });
check('behind the bank: the whole crew by the cars, the sign glowing', !!s && crew.length === 7 && (await G(() => window.__game.debug.world.places.bank.signMat.emissiveIntensity)) > 1, crew.join(','));
await wait(1200);
await page.screenshot({ path: `${shots}/k6-briefing.png` });
s = await talkThrough((s) => s.mission?.step === 3, 90, 'the briefing');
check('Ido: whoever is marked is out, three marks and you are out too', heard.some((t) => t.includes('עידו:') && /מסומן, בחוץ/.test(t) && /שלוש פעמים/.test(t)));
s = await state();
check('six guards on their rounds, markers for Nehorai, Ido and Hadar', !!s.paint && s.paint.guards === 6 && s.paint.marked === 0 && s.paint.allies.includes('ido') && s.paint.allies.includes('hadar'), JSON.stringify(s.paint));
check('the arrow points through the bay', !!s.target && Math.hypot(s.target.x - P.bank.bayInside.x, s.target.z - P.bank.bayInside.z) < 1.5 && /הפריקה/.test(await text('#objText')), await text('#objText'));
// three marks on Nehorai: out, with advice, and a retry that puts everyone back
await G(() => { const P = window.__game.debug.game.paint; for (let i = 0; i < 3; i++) P.markPlayer(null, '#7bd88f'); });
s = await until((s) => !!s.hold, 6, 'the fail screen');
check('marked three times: the mission fails, with the rules in the reason', !!s && /שלוש פעמים/.test(await text('#failReason')) && /בחוץ/.test(await text('#failReason')), await text('#failReason'));
check('three splats of paint on the lens', (await G(() => document.querySelectorAll('#paintHits .splat').length)) === 3);
await page.tap('#retryBtn');
s = await until((s) => !s.hold && s.mission?.step === 3 && s.paint?.hits === 0, 8, 'the retry');
check('retry: the paint is gone, the guards are back on their rounds, Nehorai at the bay', !!s && s.paint.marked === 0 && s.paint.guards === 6 && Math.hypot(s.player.x - P.bank.bay.x, s.player.z - P.bank.bay.z) < 3 && (await G(() => document.querySelectorAll('#paintHits .splat').length)) === 0);
// in through the bay; the guards one by one, with the real marker: the first one from the front, inside
// his cone (he spots Nehorai and calls out before the marker is raised), the others from outside
// their cones, as the rules advise
await G(() => window.__game.setTimeScale(1));
let spotted = false;
const approached = [];
for (let i = 0; i < 12; i++) {
  const g = await G((first) => {
    const g = window.__game.debug.game, P = g.paint, cols = g.world.cols, me = g.player.pos;
    const byDist = [...P.standing].sort((a, b) => Math.hypot(a.npc.pos.x - me.x, a.npc.pos.z - me.z) - Math.hypot(b.npc.pos.x - me.x, b.npc.pos.z - me.z));
    if (!byDist.length) return null;
    // a spot a few metres from him with nothing solid at it and a clear line to him (not through a wall)
    const spot = (q, round) => {
      const n = q.npc, y = n.pos.y;
      for (const [a, d] of round) {
        const x = n.pos.x + Math.sin(n.yaw + a) * d, z = n.pos.z + Math.cos(n.yaw + a) * d;
        if (cols.blocks(x, y + 0.9, z) || cols.blocks(x, y + 1.6, z)) continue;
        if (!P.clear(x, y + 1.3, z, n.pos.x, y + 1.1, n.pos.z, null)) continue;
        return { id: n.id, x, z, gx: n.pos.x, gz: n.pos.z, a };
      }
      return null;
    };
    const FRONT = [[0, 4], [0, 2.8], [0.45, 3.5], [-0.45, 3.5]];
    const ROUND = [[Math.PI, 3.5], [Math.PI, 2.5], [2.2, 3.5], [-2.2, 3.5], [1.6, 3], [-1.6, 3], [0, 4]];
    if (first) for (const q of byDist) { const s = spot(q, FRONT); if (s) return s; }
    const q = byDist[0];
    return spot(q, ROUND) || { id: q.npc.id, x: q.npc.pos.x + Math.sin(q.npc.yaw) * 4, z: q.npc.pos.z + Math.cos(q.npc.yaw) * 4, gx: q.npc.pos.x, gz: q.npc.pos.z, a: null };
  }, i === 0);
  if (!g) break;
  approached.push(`${g.id}${g.a === null ? '?' : g.a === 0 || Math.abs(g.a) === 0.45 ? '(front)' : ''}`);
  await G(() => window.__game.fireBot(null));
  await G((g) => { const G0 = window.__game; G0.teleport(g.x, g.z); G0.setCamera(Math.atan2(-(g.gx - g.x), -(g.gz - g.z)), 0.15); }, g);
  if (i === 0) { // let him see Nehorai first
    s = await until(async (s) => s.hold || (await G(() => !!window.__game.debug.game.missions.active?.s.spotted)), 5, 'the callout');
    if (s?.hold) break;
  }
  await G(() => window.__game.fireBot(true));
  const before = await G(() => window.__game.debug.game.paint.marked);
  // the camera stays on him while he moves (an alerted guard comes looking), as a player would hold it
  const t0 = (await state()).time;
  for (;;) {
    s = await G((id) => { const G0 = window.__game, g = G0.debug.game, q = g.paint.guards.find((q) => q.npc.id === id), me = g.player.pos; if (q && !q.marked) G0.setCamera(Math.atan2(-(q.npc.pos.x - me.x), -(q.npc.pos.z - me.z)), 0.15); return G0.state; }, g.id);
    if (s.hold || (s.paint && s.paint.marked > before)) break;
    if (s.time - t0 > 14) { console.log(`  (timed out waiting for guard ${i + 1} (${g.id}))`); s = null; break; }
    await wait(150);
  }
  if (await G(() => window.__game.debug.game.missions.active?.s.spotted)) spotted = true;
  if (!s || s.hold) break;
}
await G(() => window.__game.fireBot(null));
s = await state();
check('every guard marked with the marker: paint on them, sitting out', !!s.paint && s.paint.marked === 6, `${s.paint?.marked} of 6 · ${approached.join(' ')} · hits ${s.paint?.hits} · hold ${s.hold}`);
check('a guard who saw someone called out', spotted || (await G(() => window.__game.debug.game.missions.active?.s.spotted)) === true);
await page.screenshot({ path: `${shots}/k7-guards.png` });
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => s.mission?.step === 4, 30, 'cleared');
check('all marked: Ido sends him to the vault room', !!s && /לכספת/.test(await text('#objText')));
await markNow();
await G((v) => window.__game.teleport(v.x, v.z), P.bank.vaultFront);
s = await until((s) => s.mission?.step === 5, 8, 'Kotzi');
check('at the vault: Kotzi comes in with Avraham', !!s && (await G(() => window.__game.debug.game.npc('kotzi').visible)));
s = await talkThrough((s) => s.mission?.step === 6, 90, 'the key');
check('Kotzi marked by Ido, the vault swings open, the key from round his neck', heard.some((t) => t.includes('קוצי:') && /על הצוואר/.test(t)) && (await G(() => window.__game.debug.world.places.bank.vaultDoor.open)));
await wait(1200);
await page.screenshot({ path: `${shots}/k8-vault.png` });
await G((c) => window.__game.teleport(c.x, c.z + 1.4), P.bank.cell);
s = await until((s) => s.prompt === 'לקחת תיק', 6, 'the bag button');
check('in the vault: a button to take a bag', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until(() => G(() => window.__game.debug.game.nehorai.pose === 'carry'), 4, 'carrying');
check('Nehorai carries a bag, Ido and Hadar the other two', !!s && (await G(() => ['ido', 'hadar'].every((id) => window.__game.debug.game.npc(id).model.pose === 'carry'))));
await G(() => { const g = window.__game, c = g.debug.game.car, q = c.local(1.8, 0.3); g.teleport(q.x, q.z); });
s = await until((s) => s.prompt === 'להעמיס את התיקים', 6, 'the load button');
check('by the Renault: a button to load them', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await until((s) => s.mission?.step === 7, 6, 'loaded');
check('loaded: out of the city, with them behind', !!s && /לצאת מחדרה/.test(await text('#objText')));
await G(() => window.__game.enterCar());
s = await until(async (s) => !!s.hold || (await G(() => !!window.__game.debug.game.chase)), 20, 'the chase');
const chase = await G(() => { const c = window.__game.debug.game.chase; return c ? { cars: c.chasers.length, colors: c.chasers.map((ch) => ch.car.model.userData.color) } : null; });
check('Kotzi\'s cars give chase: three of them, the Porcupines\' green among them, no police', !!chase && chase.cars === 3 && chase.colors.includes('#2f5d3a'), JSON.stringify(chase));
await G(() => { const g = window.__game, p = g.roadAt('דרך גן שמואל', 200, 1.9); g.placeCar(p.x, p.z, p.yaw + Math.PI); });
s = await until((s) => s.mission?.step === 8, 40, 'losing them');
check('far from them for a few seconds: lost them; home to the lookout', !!s && /לתצפית/.test(await text('#objText')) && !!s.target && Math.hypot(s.target.x - P.lookout.x, s.target.z - P.lookout.z) < 2);
await markNow();
await G((L) => { const g = window.__game; g.placeCar(L.x + 4, L.z + 4, 0); }, P.lookout);
s = await until((s) => s.mission?.step === 9, 10, 'the dawn');
const dawn = await G(() => { const g = window.__game.debug.game, L = g.world.places.lookout; return { there: ['erez', 'yonati', 'avraham', 'dolev', 'muller', 'ido', 'hadar'].filter((id) => { const n = g.npc(id); return n.visible && Math.hypot(n.pos.x - L.x, n.pos.z - L.z) < 16; }).length, target: g.daylight.target }; });
check('dawn at the lookout: everyone along the railing, the night lifting', !!s && dawn.there === 7 && dawn.target === 0, JSON.stringify(dawn));
await wait(1500);
await page.screenshot({ path: `${shots}/k9-dawn.png` });
s = await talkThrough((s) => !s.mission, 120, 'the end');
check('Ido counted it all; it goes back to everyone it was taken from', heard.some((t) => t.includes('עידו:') && /מחזירים/.test(t)) && heard.some((t) => /ברוך הבא הביתה/.test(t)));
s = await until((s) => !s.mission && !s.cutscene, 10, 'the end of the chapter');
check('mission 15 complete: the chapter\'s end, 500 more, Ido along', !!s && s.progress.done.includes('bank') && s.progress.unlocks.includes('chapter-4') && s.progress.money === 2700 && (await G(() => window.__game.debug.game.idoBuddy.active)), `money ${s?.progress.money}`);
s = await until((s) => s.night < 0.05, 60, 'daylight');
check('day is back', !!s, `night ${(await state()).night.toFixed(2)}`);
check('the panel: chapter four done, free roam', (await text('#objLabel')) === 'הפרק הרביעי הושלם', await text('#objLabel'));
await page.tap('#pauseBtn');
const rows = await page.$$eval('#missionRows .mission-row', (r) => r.map((x) => x.textContent));
check('the pause menu lists all fifteen missions, chapter four\'s two among them', rows.length === 15 && rows.some((t) => /פרק 4 · 1\. עידו מצטרף/.test(t)) && rows.some((t) => /פרק 4 · 2\. בנק קוצי/.test(t)), `${rows.length} rows`);
await page.tap('#resumeBtn');
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await writeFile(`${shots}/stage-k-results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
