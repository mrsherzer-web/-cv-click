// Stage F acceptance test: the phone and Dolev. The phone button appears with someone to call and shows
// a dot when a mission is waiting for a call; calling a friend plays a short call; calling Dolev starts
// mission 5. Dolev comes over, follows on foot, catches up when stuck, gets into the Renault, fights
// alongside against the mission's rivals only, and never holds the mission up. Mission 5 to the end.
// usage: node tests/stage-f.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

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
const talkThrough = (done, maxSec, what) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const dolev = () => G(() => { const g = window.__game.debug.game, n = g.npc('dolev'); return { x: n.pos.x, z: n.pos.z, visible: n.visible, inCar: !!n.inCar, active: g.companion.active, rescued: g.companion.rescued, gap: Math.hypot(n.pos.x - g.pos.x, n.pos.z - g.pos.z) }; });

// a game saved after mission 4
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 350, done: ['pickup', 'gym', 'hadera', 'crew'], unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev'], car: { color: '#f4f4f2', health: 100, upgrades: [] }, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));

// ---------- the phone ----------
check('the next mission says to call Dolev from the phone', /להתקשר לדולב מהטלפון/.test(await page.textContent('#objText')), await page.textContent('#objText'));
check('the phone button is there, with a dot: someone is waiting for a call', (await page.isVisible('#phoneBtn')) && (await page.isVisible('#phoneBadge')));
await page.tap('#pauseBtn');
await page.tap('#travelBtn'); // to Hadera first, where Dolev is
await until((s) => !s.paused, 3, 'the trip');
await page.dispatchEvent('#phoneBtn', 'pointerdown');
await wait(300);
const names = await page.$$eval('.contact-name', (els) => els.map((e) => e.textContent));
check('the phone lists the friends met so far', names.length === 5 && names.some((n) => n.includes('דולב')) && names.some((n) => n.includes('מולר')), names.join(' · '));
check('Dolev is marked as the one to call', await page.isVisible('.contact button.wanted[data-id="dolev"]'));
const frozen = (await state()).time;
await wait(500);
check('the game waits while the phone is open', Math.abs((await state()).time - frozen) < 0.05);
await page.tap('.contact button[data-id="avraham"]');
await wait(300);
const chat = await page.textContent('#caption');
check('calling Avraham: a short call in his own words', /📞 אברהם:/.test(chat), chat);
await talkThrough((s) => !s.dialogue, 30, 'the chat');
await page.dispatchEvent('#phoneBtn', 'pointerdown');
await wait(200);
await page.tap('.contact button[data-id="dolev"]');
let s = await until((s) => s.mission?.id === 'dolev', 4, 'mission 5');
check('calling Dolev starts mission 5 with his call', !!s && /דולב:/.test(await page.textContent('#caption')));
s = await talkThrough((s) => s.mission?.step === 1, 40, 'the call to end');
check('then: pick him up at the beach', !!s && /דולב/.test(s.mission.objective), s?.mission?.objective);
check('no dot on the phone while nobody is waiting for a call', !(await page.isVisible('#phoneBadge')));

// ---------- meeting Dolev; he follows ----------
let d = await dolev();
await G((d) => window.__game.teleport(d.x + 7, d.z), d);
s = await until(async () => (await dolev()).active, 6, 'Dolev to join');
check('walking up to Dolev: he joins', !!s);
await page.screenshot({ path: `${shots}/f1-dolev.png` });
s = await talkThrough((s) => s.mission?.step === 2, 60, 'the next step');
check('he comes to Nehorai and the mission moves on', !!s);
await G(() => { const g = window.__game, p = g.state.player; g.teleport(p.x + 9, p.z + 14); });
await until(async () => (await dolev()).gap < 4, 20, 'Dolev to follow');
d = await dolev();
check('he follows on foot', d.gap < 4, `${d.gap.toFixed(1)} m behind`);
// stuck: a wall between them that he cannot walk around in time
await G(() => {
  const g = window.__game.debug.game, H = g.world.places.hadera, b = H.blocks.find((q) => q.i === 2 && q.j === 0);
  // Nehorai on one side of a long apartment block, Dolev on the other, close to its middle
  window.__game.teleport(b.x0 + 2, b.cz);
  g.npc('dolev').place(b.x0 + 26, b.cz, 0);
  g.companion.best = Infinity;
});
const r0 = (await dolev()).rescued;
s = await until(async () => { const q = await dolev(); return q.rescued > r0 || q.gap < 4; }, 20, 'Dolev to catch up');
d = await dolev();
check('stuck behind a building, he catches up out of sight', d.gap < 15, `${d.gap.toFixed(1)} m, caught up ${d.rescued - r0} time(s)`);

// ---------- into the Renault ----------
await G(() => { const g = window.__game, c = g.debug.game.car, q = c.local(1.8, 0.3); g.teleport(q.x, q.z); g.debug.game.npc('dolev').place(q.x + 3, q.z + 2, 0); });
await G(() => window.__game.enterCar());
s = await until(async () => (await dolev()).inCar, 20, 'Dolev in the car');
check('Nehorai drives: Dolev gets into the passenger seat', !!s);
const L = await G(() => window.__game.debug.world.places.beachLot);
await G((L) => { const g = window.__game; g.placeCar(L.parking.x, L.parking.z, L.parking.yaw); }, L);
await G(() => window.__game.exitCar());
s = await until((s) => s.mode === 'foot', 5, 'out of the car');
s = await until(async () => { const q = await dolev(); return !q.inCar && q.visible; }, 5, 'Dolev out too');
check('getting out at the beach car park: Dolev gets out too', !!s);

// ---------- the Sharks ----------
s = await talkThrough((s) => s.fight && !s.fight.over, 60, 'the fight');
check('the Sharks: three of them, and Dolev fights alongside', !!s && s.fight.opponents.length === 3 && (await G(() => window.__game.debug.game.fight.allies.some((a) => a.npc.id === 'dolev'))));
await G(() => window.__game.setTimeScale(1));
await wait(1200);
await page.screenshot({ path: `${shots}/f2-sharks.png` });
const nobodyElse = await G(() => { const g = window.__game.debug.game; return g.fight.enemies.every((e) => g.fight.opponents.some((o) => o.fighter === e && ['gali', 'snapir', 'shen'].includes(o.npc.id))); });
check('only the mission\'s rivals are fought', nobodyElse);
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
let dolevHits = 0;
s = await until(async (s) => { const n = await G(() => window.__game.debug.game.fight?.allies?.find((a) => a.npc.id === 'dolev')?.fighter.landed ?? -1); dolevHits = Math.max(dolevHits, n); return s.mission?.step >= 4; }, 240, 'the fight to end');
await G(() => window.__game.fightBot(null));
check('the Sharks are beaten', !!s);
check('Dolev lands punches of his own', dolevHits > 0, `${dolevHits}`);
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => !s.mission, 80, 'mission 5 to end');
s = await state();
check('mission 5 complete: Dolev is in the crew', !s.mission && s.progress.done.includes('dolev') && s.progress.unlocks.includes('dolev-crew') && s.progress.money === 500, `money ${s.progress.money}`);
d = await dolev();
check('he stays with Nehorai afterwards', d.active && d.gap < 15);

// ---------- after: left behind, he rejoins ----------
await G(() => window.__game.enterCar());
await until(async () => (await dolev()).inCar, 15, 'Dolev in again');
await G(() => { const g = window.__game, d = g.debug.game.npc('dolev'); if (d.inCar) d.stepOut(-1); d.place(d.pos.x + 25, d.pos.z, 0); }); // he stepped away; Nehorai drives off
await G(() => window.__game.placeCar(-1100, -124.6, -Math.PI / 2));
await until(() => false, 30, 'time to pass');
d = await dolev();
check('left behind for long, he goes off on his own', !d.visible);
await G(() => window.__game.exitCar());
s = await until(async () => { const q = await dolev(); return q.visible && q.gap < 15; }, 10, 'Dolev to rejoin');
check('back on foot: he turns up again', !!s);
await page.dispatchEvent('#phoneBtn', 'pointerdown');
await wait(200);
await page.tap('.contact button[data-id="dolev"]');
await wait(300);
check('calling Dolev now: he is already here', /מאחוריך/.test(await page.textContent('#caption')));

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
