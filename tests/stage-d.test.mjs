// Stage D acceptance test: fists and mission 2 ("the crew at the gym"). The punch, block and dodge
// buttons appear only next to a bag or in a fight; health and stamina show; the bag counts real taps
// of the punch button; Erez's drills count blocks and dodges; sparring with Yonati can be lost (fail
// screen, retry from the ring) and won; the reward is the three-punch combination.
// Timing-critical defense in the drills and the sparring is played by the in-page test bot, which
// presses the same game calls as the buttons; the buttons themselves are tested directly too.
// usage: node tests/stage-d.test.mjs [url] [screenshot dir]
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
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
const state = () => page.evaluate(() => window.__game.state);
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
async function until(cond, maxSec, what) {
  const t0 = (await state()).time;
  for (;;) {
    const s = await state();
    if (await cond(s)) return s;
    if (s.time - t0 > maxSec) { console.log(`  (timed out waiting for ${what})`); return null; }
    await wait(80);
  }
}
const skipTalk = (maxSec = 60) => until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.dialogue; }, maxSec, 'the conversation to end');
const center = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
// a real finger on a button: down, a moment, up
async function tapButton(sel, id = 5) {
  const c = await center(sel);
  await touch('touchStart', [{ ...c, id }]);
  await wait(60);
  await touch('touchEnd', []);
}

// a game saved right after mission 1: the friends are at the gym
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 150, done: ['pickup'], unlocks: ['gym', 'friends'], car: { color: '#f4f4f2', health: 100, upgrades: [] }, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.setTimeScale(2));
const P = await G(() => window.__game.places);

// ---------- the HUD on foot ----------
let s = await state();
check('continuing after mission 1: no mission running, the next one is waiting', !s.mission && /החבורה במכון/.test(await page.textContent('#objText')), await page.textContent('#objText'));
check('health and stamina show on foot', await page.isVisible('#vitals') && (await page.locator('#hpFill').evaluate((e) => e.style.width)) === '100%');
check('away from bags and fights there are no fist buttons', !s.combat && !s.buttons.btnPunch && !s.buttons.btnBlock && !s.buttons.btnDodge && s.buttons.btnRun);
check('the friends hang out at the gym', s.npcs.erez?.visible && s.npcs.yonati?.visible && s.npcs.muller?.visible && s.npcs.avraham?.visible);

// ---------- the start marker between the bags ----------
await G((p) => window.__game.teleport(p.x, p.z), { x: P.gymInside.x, z: P.gymInside.z });
s = await until((s) => !!s.target, 4, 'the start marker');
check('a blue marker shows where mission 2 starts', !!s);
await G((t) => window.__game.teleport(t.x, t.z), s.target);
s = await until((s) => s.mission?.id === 'gym', 6, 'mission 2');
check('stepping on the marker starts "the crew at the gym"', !!s && (await page.textContent('#bannerTitle')) === 'החבורה במכון');

// ---------- the bag, with the real punch button ----------
await G(() => window.__game.faceBag(0));
s = await until((s) => s.combat, 4, 'the fist buttons');
check('next to a bag the punch, block and dodge buttons appear and the run button steps aside', !!s && s.buttons.btnPunch && s.buttons.btnBlock && s.buttons.btnDodge && !s.buttons.btnRun);
await page.screenshot({ path: `${shots}/d1-bag.png` });
await skipTalk();
const hits0 = (await state()).bagHits;
let lowest = 100;
for (let i = 0; i < 9 && (await state()).mission?.step === 0; i++) {
  await tapButton('#btnPunch');
  lowest = Math.min(lowest, (await state()).fighter.stamina);
  await wait(700);
}
s = await state();
check('six taps of the punch button land on the bag and move the mission on', s.bagHits - hits0 >= 6 && s.mission?.step >= 1, `${s.bagHits - hits0} hits, step ${s.mission?.step}`);
check('punches cost stamina (it comes back after a breather)', lowest < 95, `lowest ${lowest.toFixed(0)}`);

// ---------- block: the real block button, held ----------
s = await until((s) => s.fight && !s.fight.over, 6, 'Erez\'s drill');
check('Erez comes over to drill: a fight with a coach who cannot be knocked down', !!s && s.fight.opponents[0].name === 'ארז');
const bc = await center('#btnBlock');
await touch('touchStart', [{ ...bc, id: 7 }]);
s = await until((s) => s.fighter.state === 'block', 4, 'the guard');
check('holding the block button raises the guard', !!s);
s = await until((s) => s.mission?.step >= 2, 60, 'three blocks');
await touch('touchEnd', []);
check('three of Erez\'s punches blocked with the button held', !!s && s.fighter.blocks >= 3, s ? `blocks ${s.fighter.blocks}` : `blocks ${(await state()).fighter.blocks}`);
s = await until((s) => s.fighter.state !== 'block', 3, 'the guard down');
check('letting go of block lowers the guard', !!s);

// ---------- dodge: the button works; the timing is the bot's ----------
await G(() => window.__game.setTimeScale(1)); // fights at real speed: a dodge has a third of a second
await skipTalk();
await until((s) => s.fighter.stamina > 60 && !s.fight?.opponents?.some((o) => o.mode === 'windup' || o.mode === 'strike'), 8, 'a quiet moment');
const st0 = (await state()).fighter.stamina;
await tapButton('#btnDodge');
s = await until((s) => s.fighter.state === 'dodge' || s.fighter.stamina <= st0 - 15, 3, 'the dodge');
check('the dodge button makes Nehorai step out', !!s);
await G(() => window.__game.fightBot({ dodge: true }));
s = await until((s) => s.mission?.step >= 3, 90, 'three dodges');
await G(() => window.__game.fightBot(null));
check('three wide punches dodged (timed by the bot through the same dodge call)', !!s && s.fighter.dodges >= 3, `dodges ${(await state()).fighter.dodges}`);

// ---------- the ring ----------
s = await state();
check('the drill is over and the ring is next', s.mission?.step === 3 && !s.fight, s.mission?.objective);
await G(() => { const g = window.__game, p = g.debug.world.places.gymSpots.ring; g.teleport(p.x + 0.1, p.z + 0.1); });
s = await until((s) => s.mission?.step === 4 && s.fight, 6, 'the sparring');
check('stepping into the ring starts the sparring round with Yonati', !!s && s.fight.opponents[0].name === 'יונתי');
await wait(1200);
await page.screenshot({ path: `${shots}/d2-sparring.png` });
s = await state();
check('Yonati\'s name and health float over him', s.fight && await page.locator('.enemy-bar:not([hidden])').count() >= 1);

// losing is allowed: the failure screen offers another round
await G(() => window.__game.hurtPlayer(500));
s = await until((s) => s.hold, 4, 'the failure screen');
check('knocked down in sparring: the mission fails with a reason', !!s && (await page.isVisible('#failMenu')) && /יונתי/.test(await page.textContent('#failReason')));
await page.tap('#retryBtn');
s = await until((s) => !s.hold && s.fight && !s.fight.over, 5, 'the retry');
check('retry: back in the ring, both fresh', !!s && s.fighter.hp === 100 && s.fight.opponents[0].hp === 60 && s.fighter.state !== 'down');

// win it (the bot blocks wind-ups, steps in and punches, and counters when Yonati is open)
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
s = await until((s) => s.fight?.over || s.mission?.step >= 5, 150, 'the end of the round');
await G(() => window.__game.fightBot(null));
check('Nehorai wins the sparring round', !!s && (s.fight?.won === true || s.mission?.step >= 5), s ? JSON.stringify(s.fight?.opponents?.[0] ?? {}) : '');
s = await until((s) => s.mission?.step === 5, 6, 'the talk');
check('Yonati is beaten fair and square, then everyone gathers to talk', !!s && s.cutscene);
await wait(1500);
await page.screenshot({ path: `${shots}/d3-talk.png` });
const voices = new Set();
await until(async (s) => { const t = await page.textContent('#caption'); for (const n of ['מולר', 'ארז', 'יונתי', 'אברהם']) if (t.includes(`${n}:`)) voices.add(n); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return !s.mission; }, 120, 'the mission to end');
s = await state();
check('the talk about the speaker: Muller, Erez, Yonati and Avraham speak', voices.size === 4, [...voices].join(', '));
check('mission 2 complete: the combination is learned and Hadera is next', !s.mission && s.progress.done.includes('gym') && s.progress.unlocks.includes('combo') && s.progress.unlocks.includes('hadera'), s.progress.unlocks.join(','));
check('the reward names the new skill', /קומבינציה/.test(await page.textContent('#bannerSub')));

// ---------- the combination on the bag ----------
await wait(1500);
await G(() => window.__game.faceBag(1));
await until((s) => s.combat && s.fighter.stamina > 60, 6, 'the fist buttons');
const moves = [];
for (let i = 0; i < 3; i++) {
  await tapButton('#btnPunch');
  await until((s) => s.fighter.state === 'attack' || s.fighter.combo > i, 2, 'the punch');
  moves.push((await state()).fighter.lastMove);
  await until((s) => s.fighter.state !== 'attack', 2, 'the punch to finish');
}
check('with the skill, the third punch in a row is a hook', moves[2] === 'hook', moves.join(', '));

// ---------- no punching people outside a fight ----------
await G(() => { const g = window.__game, p = g.debug.world.places.gymSpots.muller; g.teleport(p.x + 1.0, p.z + 0.4); });
s = await until((s) => !s.combat, 4, 'the buttons to go');
check('next to a friend (no bag, no fight) the fist buttons are gone', !!s && !s.buttons.btnPunch);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
// every objective line the run showed, and the distance when an arrow went with it
await writeFile(`${shots}/guide-log.json`, JSON.stringify(await page.evaluate(() => window.__game.guideLog), null, 1));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
