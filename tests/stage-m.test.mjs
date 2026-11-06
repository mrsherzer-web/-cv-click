// Chapter six acceptance test: Erez's call, the computer at home (the memory game on the screen: a
// wrong tap, the trace filling and the retry, then the rounds), Dolev's call cut off and the message,
// the drive to the beach with cars behind, the container yard's eight guards, the office — the
// Cipher marked, Dolev freed, the laptop — the escape to Gan Shmuel, the ice cream, the reward.
// usage: node tests/stage-m.test.mjs [url] [screenshot dir]
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
ctx.setDefaultTimeout(240000);
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
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });

// a game saved at the end of chapter five
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 4050,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves', 'fightnight', 'mainevent', 'ido', 'bank', 'pub', 'villa'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2', 'fightnight', 'chapter-3', 'ido', 'ido-crew', 'paintball', 'chapter-4', 'pub-crew', 'liam', 'kai', 'yahli', 'chapter-5a', 'turbo', 'chapter-5'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('the start screen counts eight chapters and thirty-three missions', /שמונה פרקים · שלושים ושלוש משימות/.test(await text('#startScreen')));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { desk: p.home.interior.desk, outside: p.home.interior.outside, yard: { gate: p.yard.gate, office: p.yard.office }, lot: p.beachLot.parking, ice: p.icecream }; });
check('the desk, the container yard and the ice-cream stand are in the world', !!P.desk && !!P.yard.office && !!P.ice.parking);

let s = await state();
check('after chapter five the panel says chapter six is next, and that Erez will call', /פרק 6 · המשימה הבאה/.test(await text('#objLabel')) && /הצופן · ארז יתקשר/.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
s = await until((s) => s.mission?.id === 'cipher', 25, 'the mission');
check('a few quiet seconds later "the Cipher" begins', !!s);
check('the panel heading is chapter six, mission 1 of 1', /פרק 6 · משימה 1 מתוך 1 · הצופן/.test(await text('#objLabel')), await text('#objLabel'));
s = await until(async () => page.isVisible('#callCard'), 15, 'Erez ringing');
check('Erez calls: a card with his name', !!s && (await text('#callName')) === 'ארז');
await markNow();
await page.tap('#callAnswer');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the call');
check('the call: a new rival, the Cipher, fake tickets, Dolev too', heard.some((l) => l.includes('הצופן')) && heard.some((l) => l.includes('כרטיסים מזויפים')), heard.join(' / ').slice(0, 140));
s = await until((s) => !s.fading && s.night > 0.9, 15, 'home at night');
await wait(1500);
const home = await G(() => { const g = window.__game, I = g.debug.world.places.home.interior; return { inside: I.inside(g.debug.game.player.pos.x, g.debug.game.player.pos.z), erez: g.debug.game.npc('erez').visible }; });
check('at home, at night, with Erez by the computer', home.inside && home.erez, JSON.stringify(home));
await snap('m1-home');
await G((d) => window.__game.teleport(d.x, d.z), P.desk);
s = await until((s) => s.prompt === 'לפתוח את המחשב', 8, 'the computer button');
check('at the desk: a button to open the computer', !!s);
await markNow();
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await talkThrough(async () => G(() => window.__game.debug.game.hack.active), 30, 'the game on the screen');
check('Erez explains, and the game opens on the screen: a route of stations to repeat', !!s && !(await page.getAttribute('#hack', 'hidden') !== null) && heard.some((l) => l.includes('משחק זיכרון')), heard.join(' / ').slice(0, 120));
await wait(800);
await snap('m2-hack');
const h0 = await G(() => { const h = window.__game.debug.game.hack; return { round: h.round, state: h.state, routeLen: h.route.length, hint: document.getElementById('hackHint').textContent, head: document.getElementById('hackRound').textContent }; });
check('round one: a route of four nodes is shown', h0.round === 0 && h0.routeLen === 4 && /שלב 1\/3/.test(h0.head), JSON.stringify(h0));
// a wrong tap once it is our turn: the trace jumps and the route is shown again
await page.waitForFunction(() => window.__game.debug.game.hack.state === 'play', null, { timeout: 15000 }).catch(() => {});
const wrong = await G(() => { const h = window.__game.debug.game.hack; const t0 = h.trace; const i = [...Array(12).keys()].find((k) => !h.route.includes(k)); h.tap(i); return { t0, t1: h.trace, hint: document.getElementById('hackHint').textContent }; });
check('a wrong tap: the trace bar jumps and the route blinks again', wrong.t1 > wrong.t0 + 10 && /חסימה/.test(wrong.hint), JSON.stringify(wrong));
// the trace fills: the Cipher found us; the mission fails and the retry puts us back at the desk
await G(() => { window.__game.debug.game.hack.trace = 100; });
s = await until(async () => page.isVisible('#failMenu'), 10, 'the fail screen');
check('the trace fills: "the Cipher traced you" and a retry', !!s && /איתר/.test(await text('#failReason')), (await text('#failReason')).slice(0, 80));
await page.tap('#retryBtn');
s = await until((s) => !s.hold && s.mission?.step === 1 && !s.cutscene, 10, 'the retry');
check('after the retry: back at the computer, the game closed', !!s && (await page.getAttribute('#hack', 'hidden')) !== null);
await G((d) => window.__game.teleport(d.x, d.z), P.desk);
s = await until((s) => s.prompt === 'לפתוח את המחשב', 8, 'the computer button again');
await markNow();
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await talkThrough(async () => G(() => window.__game.debug.game.hack.active), 30, 'the game again');
await G(() => window.__game.debug.game.hack.solve());
s = await talkThrough((s) => s.mission?.step === 2, 40, 'the rounds');
check('the three rounds done (Erez: "we have him"): the server is found', !!s && heard.some((l) => l.includes('יש לנו אותו')), heard.join(' / ').slice(0, 120));
await markNow();
s = await talkThrough(async () => page.isVisible('#callCard'), 30, 'Dolev ringing');
check('then Dolev calls', !!s && (await text('#callName')) === 'דולב');
await page.tap('#callAnswer');
s = await talkThrough((s) => s.mission?.step === 3, 90, 'the cut-off call and the message');
check('the call is cut off mid-sentence; the message on the screen: come alone; Erez: no way', heard.some((l) => l.includes('עזבו את')) && heard.some((l) => l.includes('בואו לבד')) && heard.some((l) => l.includes('לא בחיים')), heard.join(' / ').slice(0, 160));
s = await until((s) => !s.fading, 8, 'outside');
check('the goal: drive to the beach with Erez', /לחוף חדרה|לרנו/.test(await text('#objText')), await text('#objText'));
await G((o) => { const g = window.__game; g.teleport(o.x, o.z); }, P.outside);
await G(() => { const g = window.__game; g.placeCar(g.debug.game.player.pos.x + 3, g.debug.game.player.pos.z + 3, 0); });
await G(() => window.__game.enterCar());
s = await until(() => G(() => !document.getElementById('pursuit').hidden), 10, 'the grace pill');
const grace = await G(() => ({ pill: document.getElementById('pursuit').hidden ? null : document.getElementById('pursuit').textContent, chase: !!window.__game.debug.game.chase }));
check('in the Renault: a few seconds of grace first, counted down on a pill, no cars yet', !!grace.pill && /מחפשים אתכם/.test(grace.pill) && !grace.chase, JSON.stringify(grace));
s = await until(() => G(() => !!window.__game.debug.game.chase), 14, 'the Cipher\'s cars');
check("then the Cipher's cars come after you", !!s);
await wait(800);
const on = await G(() => ({ pill: document.getElementById('pursuit').hidden ? null : document.getElementById('pursuit').textContent, cars: window.__game.debug.game.chase?.chasers.length }));
check('the pill shows the chase: one car first, and how close it is', !!on.pill && /מרדף/.test(on.pill) && on.cars === 1, JSON.stringify(on));
s = await until(() => G(() => !!window.__game.debug.game.npc('erez').inCar), 20, 'Erez in the car');
check('Erez is in the car', !!s);
await snap('m3-road');
await markNow();
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); }, P.lot);
s = await until((s) => s.mission?.step === 4, 12, 'the yard');
check('at the beach car park: the yard scene', !!s);
await wait(1500);
await snap('m4-yard');
s = await talkThrough((s) => s.mission?.step === 5, 60, 'the arrival');
check('Erez: guards between the containers, Dolev in the lit container, the rules', heard.some((l) => l.includes('המכולה המוארת')), heard.join(' / ').slice(0, 120));
const yard = await G(() => { const g = window.__game.debug.game, P = g.paint; return { guards: P.guards.length, armed: P.armed, allies: P.allies.length, dolev: g.npc('dolev').model.pose, cipher: g.npc('cipher').visible }; });
check('eight guards on their rounds, Nehorai and Erez with markers, Dolev sitting inside, the Cipher there', yard.guards === 8 && yard.armed && yard.allies >= 1 && yard.dolev === 'sit' && yard.cipher, JSON.stringify(yard));
check('the yard is the goal, with the count', /בין המכולות \(0\/8\)/.test(await text('#objText')), await text('#objText'));
await G(() => { const g = window.__game.debug.game, P = g.paint; for (const x of P.guards) if (!x.marked) P.markGuard(x, 'test'); });
s = await until((s) => s.mission?.step === 6, 8, 'the office');
check('the yard is clear: into the office', !!s && /מכולה/.test(await text('#objText')), await text('#objText'));
await markNow();
await G((d) => { const g = window.__game; g.teleport(d.x, d.z); }, P.yard.office.door);
await wait(600);
const cipherGuard = await G(() => { const g = window.__game.debug.game, P = g.paint; const c = P.guards.find((x) => x.npc === g.npc('cipher')); return !!c; });
check('the Cipher stands behind his table as the last one to mark', cipherGuard);
await G(() => { const g = window.__game.debug.game, P = g.paint; const c = P.guards.find((x) => x.npc === g.npc('cipher')); if (c) P.markGuard(c, 'test'); });
s = await talkThrough(async () => heard.some((l) => l.includes('המחשב הנייד שלך')), 40, 'the Cipher\'s lines');
check('the Cipher, marked, talks: "it was only business"; the laptop comes with us', !!s && heard.some((l) => l.includes('רק עסק')), heard.join(' / ').slice(0, 120));
await snap('m5-office');
await G((d) => { const g = window.__game; g.teleport(d.x - 1.0, d.z); }, P.yard.office.dolev);
s = await until((s) => s.prompt === 'לשחרר את דולב', 8, 'the free-Dolev button');
check('by Dolev: a button to free him', !!s);
await markNow();
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await talkThrough(async () => heard.some((l) => l.includes('רעב')), 30, 'Dolev freed');
check('Dolev, freed: "took you an hour", and hungry', !!s && (await G(() => window.__game.debug.game.npc('dolev').model.pose !== 'sit')), heard.join(' / ').slice(0, 100));
await G((l) => { const g = window.__game; g.teleport(l.x + 0.8, l.z + 0.8); }, P.yard.office.laptop);
s = await until((s) => s.prompt === 'לקחת את המחשב הנייד', 8, 'the laptop button');
check('by the table: a button to take the laptop', !!s);
await page.dispatchEvent('#btnInteract', 'pointerdown');
s = await talkThrough((s) => s.mission?.step === 7, 20, 'out');
check('laptop taken: out to the Renault with Dolev and Erez', !!s && /לרנו/.test(await text('#objText')), await text('#objText'));
await G(() => { const g = window.__game; const c = g.debug.game.car.pos; g.teleport(c.x + 2, c.z); });
await G(() => window.__game.enterCar());
s = await until(() => G(() => !!window.__game.debug.game.chase), 14, 'the second chase');
check("the Cipher's crew gives chase, after a moment", !!s);
s = await until(() => G(() => !!window.__game.debug.game.npc('dolev').inCar && !!window.__game.debug.game.npc('erez').inCar), 20, 'Dolev and Erez in the car');
check('Dolev and Erez ride along', !!s);
await markNow();
await G((p) => { const g = window.__game; g.placeCar(p.x, p.z, p.yaw); }, P.ice.parking);
s = await until((s) => s.mission?.step === 8, 12, 'Gan Shmuel');
check('at the Gan Shmuel gate: the ice-cream scene', !!s);
await wait(1500);
await snap('m6-icecream');
s = await talkThrough((s) => s.mission === null, 120, 'the ice cream');
check('three cones, Dolev still hungry, the tickets go back tomorrow', heard.some((l) => l.includes('פיסטוק')) && heard.some((l) => l.includes('עדיין רעב')) && heard.some((l) => l.includes('מקבל בחזרה')), heard.join(' / ').slice(0, 160));
s = await state();
check('mission 18 done: chapter six complete, 900 shekels', s.progress.done.includes('cipher') && s.progress.unlocks.includes('chapter-6') && s.progress.money === 4950, `${s.progress.money}`);
check('the panel says the sixth chapter is complete (or that chapter seven is next)', /הפרק השישי הושלם|פרק 7 · המשימה הבאה/.test(await text('#objLabel')), await text('#objLabel'));
s = await until((s) => s.night < 0.2, 20, 'day');
check('day comes back', !!s);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
await writeFile(`${shots}/stage-m.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(passed === results.length ? 0 : 1);
