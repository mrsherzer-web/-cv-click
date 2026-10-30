// Chapter three acceptance test: the boxing night at the court. Hadar's call a week after the chase,
// the court set up as a ring, Nehorai's opening bout against Shpitz (round one on the block, the corner
// and Hadar's tip with a real tap, round two to the finish), and the main event: Hadar against
// Bulldozer with Nehorai's calls from the corner, lost once on purpose without them and won with them,
// a tip between rounds, and the shawarma at the kiosk that closes the chapter.
// usage: node tests/stage-j.test.mjs [url] [screenshot dir]
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
ctx.setDefaultTimeout(120000); // software rendering on a busy machine can take a while over one frame
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
// every line said since markNow(), from the game's own record of the conversation
const heard = [];
let mark = 0;
const markNow = async () => { mark = await page.evaluate(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
const listen = async () => {
  const { h, said } = await page.evaluate(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said }));
  heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark))));
};
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
const text = (sel) => page.textContent(sel);
const ringUp = () => G(() => window.__game.debug.world.places.courtRing.up);
const ropeBlocks = () => G(() => { const R = window.__game.debug.world.places.courtRing, C = R.center; return window.__game.blocks(C.x - R.half, C.y + 0.6, C.z); });

// a game saved at the end of chapter two
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => localStorage.setItem('nehorai-game:save:v1', JSON.stringify({
  v: 1, money: 1550,
  done: ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves'],
  unlocks: ['gym', 'friends', 'combo', 'hadera', 'hadera-parking', 'speaker', 'dolev', 'dolev-crew', 'engine', 'free-roam', 'hadar', 'uppercut', 'hadar-crew', 'chapter-2'],
  car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now(),
})));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
check('the start screen counts three chapters', /שלושה פרקים · שלוש עשרה משימות/.test(await text('#startScreen')));
check('the boxing ring is not up at the court before the boxing night', !(await ringUp()) && !(await ropeBlocks()));
await page.tap('#startBtn');
await wait(500);
await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
await G(() => window.__game.setTimeScale(2));
const P = await G(() => { const p = window.__game.debug.world.places; return { court: p.court, ring: { center: p.courtRing.center, half: p.courtRing.half, red: p.courtRing.corners.red }, kiosk: p.kiosk.front }; });

// ---------- mission 12: boxing night ----------
let s = await state();
check('after chapter two the panel says chapter three is next, and how it starts', /פרק 3/.test(await text('#objLabel')) && /ערב אגרוף · הדר יתקשר/.test(await text('#objText')), `${await text('#objLabel')} | ${await text('#objText')}`);
s = await until((s) => s.mission?.id === 'fightnight', 20, 'the call');
check('a few quiet seconds later "boxing night" begins, a week on', !!s && /שבוע אחרי/.test(await text('#fadeText')));
s = await until(async () => page.isVisible('#callCard'), 12, 'the phone ringing');
check('Hadar calls: a card with his name', !!s && /הדר/.test(await text('#callName')));
check('the panel heading is chapter three, mission 1 of 2', /פרק 3 · משימה 1 מתוך 2 · ערב אגרוף/.test(await text('#objLabel')), await text('#objLabel'));
await markNow();
await page.tap('#callAnswer');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the call');
check('Hadar: Nehorai opens the evening, against Shpitz, two rounds', heard.some((t) => t.includes('הדר:') && /אתה פותח את הערב/.test(t)) && heard.some((t) => /מול שפיץ, שני סיבובים/.test(t)));
check('then: drive to the court, and the arrow points at its gate', !!s?.target && Math.hypot(s.target.x - P.court.gate.x, s.target.z - P.court.gate.z) < 2 && /למגרש בחדרה/.test(await text('#objText')));
check('the ring is up at the court tonight, its ropes solid', (await ringUp()) && (await ropeBlocks()));
const crowd = await G(() => { const g = window.__game.debug.game, C = g.world.places.courtRing.center; return ['erez', 'yonati', 'avraham', 'dolev', 'kotzi', 'roller', 'tosti', 'muller', 'bulldozer', 'hadar', 'shpitz'].filter((id) => { const n = g.npc(id); return n.visible && Math.hypot(n.pos.x - C.x, n.pos.z - C.z) < 9; }); });
check('both crews are there around the ring, Muller and Kotzi too', crowd.length === 11, crowd.join(','));
await markNow();
await G((c) => window.__game.teleport(c.x - 6, c.z + 7), P.court);
s = await until((s) => s.mission?.step === 2, 8, 'the court');
check('into the court on foot: the evening begins with a title card', !!s && (await text('#bannerKicker')) === 'ערב אגרוף');
await wait(900);
await page.screenshot({ path: `${shots}/j1-evening.png` });
s = await talkThrough((s) => s.mission?.step === 3, 80, 'the evening');
check('Kotzi opens the evening; Muller is the referee, in one word', heard.some((t) => t.includes('קוצי:') && /ערב האגרוף הראשון/.test(t)) && heard.some((t) => t === 'מולר: שופט.' || (t.includes('מולר:') && /שופט/.test(t))));
s = await until(async () => page.isVisible('#bout'), 3, 'the round board');
check('round one: Nehorai and Shpitz in the ring, the round board on screen', !!s?.fight && s.fight.opponents[0].name === 'שפיץ' && (await page.isVisible('#bout')) && /סיבוב 1 מתוך 2/.test(await text('#boutRound')), await text('#boutRound'));
const inRing = await G(() => { const g = window.__game.debug.game, R = g.world.places.courtRing; return R.inside(g.player.pos.x, g.player.pos.z, 0) && R.inside(g.npc('shpitz').pos.x, g.npc('shpitz').pos.z, 0); });
check('both inside the ropes', inRing);
const clock0 = await text('#boutClock');
await G(() => window.__game.setTimeScale(1));
// round one on the block only, so it goes to the bell and the corner
await G(() => window.__game.fightBot({ block: true }));
await until(() => false, 2.5, 'two seconds of the round');
check('the round clock runs', (await text('#boutClock')) !== clock0, `${clock0} → ${await text('#boutClock')}`);
s = await until(async () => page.isVisible('#choice'), 70, 'the bell and the corner');
await G(() => window.__game.fightBot(null));
check('the bell: Nehorai on the stool in his corner, Hadar asks what he needs', !!s && /בפינה/.test(await text('#choiceTitle')));
const tips = await page.$$eval('#choice button', (b) => b.map((x) => x.dataset.id));
check('three tips to choose from, each one tap', tips.join(',') === 'air,wait,heavy', tips.join(','));
await page.screenshot({ path: `${shots}/j2-corner.png` });
await markNow();
await page.tap('#choice button[data-id="heavy"]');
s = await until((s) => s.mission?.step === 3 && !!s.fight && !s.fight.over && !s.cutscene, 30, 'round two');
await listen();
check('"heavy hand": Hadar says to put weight on it, and every punch is stronger', heard.some((t) => /שים משקל/.test(t)) && (await G(() => window.__game.debug.game.fighter.power)) > 1.2);
check('round two on the board', /סיבוב 2 מתוך 2/.test(await text('#boutRound')));
await markNow(); // from here on: the result, and the main event's announcement straight after it
await G(() => window.__game.fightBot({ block: true, punch: true, approach: true }));
s = await until((s) => s.mission?.step === 4 || !!s.hold, 80, 'round two');
await G(() => window.__game.fightBot(null));
check('round two: Nehorai wins the opening bout', !!s && !s.hold, s?.hold ? await text('#failReason') : '');
await G(() => window.__game.setTimeScale(2));
s = await talkThrough((s) => s.mission?.id === 'mainevent', 60, 'the result');
check('Muller raises Nehorai\'s hand; Hadar: now it is his turn, Nehorai in his corner', heard.some((t) => t.includes('מולר:') && /נהוראי/.test(t)) && heard.some((t) => t.includes('הדר:') && /אתה בפינה שלי/.test(t)));
s = await state();
check('mission 12 complete: 200 prize, and the main event follows straight on', s.progress.done.includes('fightnight') && s.progress.money === 1750 && !!s.mission, `money ${s.progress.money}`);
check('the ring stays up for the main event', await ringUp());

// ---------- mission 13: the main event ----------
check('the panel heading is chapter three, mission 2 of 2', /פרק 3 · משימה 2 מתוך 2 · האירוע המרכזי/.test(await text('#objLabel')), await text('#objLabel'));
s = await talkThrough((s) => s.mission?.step === 1, 80, 'the announcement');
check('Kotzi announces Hadar and Bulldozer; Hadar explains the calls', heard.some((t) => /הדר... בן... עמי/.test(t)) && heard.some((t) => t.includes('הדר:') && /תצעק "חסום!"/.test(t)) && heard.some((t) => t.includes('הדר:') && /תצעק "עכשיו!"/.test(t)));
s = await state();
const spot = await G(() => { const g = window.__game.debug.game, R = g.world.places.courtRing; return { me: !R.inside(g.player.pos.x, g.player.pos.z, -0.2), h: R.inside(g.npc('hadar').pos.x, g.npc('hadar').pos.z, 0), b: R.inside(g.npc('bulldozer').pos.x, g.npc('bulldozer').pos.z, 0) }; });
check('Hadar and Bulldozer in the ring, Nehorai outside the ropes in the red corner', spot.me && spot.h && spot.b);
check('round one on the board: הדר against בולדוזר, three rounds', !!s.bout && /סיבוב 1 מתוך 3/.test(await text('#boutRound')) && (await text('#boutRedName')) === 'הדר' && (await text('#boutBlueName')) === 'בולדוזר');
check('Nehorai\'s own fight buttons are not on screen: this is Hadar\'s fight', !s.buttons.btnPunch && !s.buttons.btnBlock);
// the button: red to cover up while Bulldozer winds up, yellow to go in while he is open
const seen = { block: false, counter: false };
await G(() => window.__game.setTimeScale(1));
await until(async () => {
  const b = await G(() => { const el = document.getElementById('btnInteract'); return el.hidden ? null : { label: el.textContent.trim(), red: el.classList.contains('tone-red'), yellow: el.classList.contains('tone-yellow') }; });
  if (b?.label === 'חסום!' && b.red) seen.block = true;
  if (b?.label === 'עכשיו!' && b.yellow) seen.counter = true;
  return seen.block && seen.counter;
}, 25, 'both calls on the button');
check('the button reads "חסום!" in red while Bulldozer winds up', seen.block);
check('...and "עכשיו!" in yellow while he is open after a punch', seen.counter);
await page.screenshot({ path: `${shots}/j3-main-event.png` });
// no calls at all: Hadar on his own loses
await G(() => window.__game.setTimeScale(3));
await G(() => window.__game.shoutBot(0));
s = await until(async (s) => { if (await page.isVisible('#choice')) await page.tap('#choice button[data-id="jab"]'); return !!s.hold; }, 260, 'Hadar on his own');
check('without Nehorai\'s calls Hadar loses the main event: the mission fails, with advice in the reason', !!s && /"חסום!"/.test(await text('#failReason')) && /"עכשיו!"/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
s = await until((s) => s.mission?.step === 1 && s.bout?.round === 1 && s.bout?.phase === 'round', 10, 'the retry');
check('retry: round one again, both fresh', !!s && s.bout.hadar === 220 && s.bout.bulldozer === 800);
// every call made: Hadar wins
await G(() => window.__game.setTimeScale(2));
await G(() => window.__game.shoutBot(1));
s = await until(async () => page.isVisible('#choice'), 120, 'the corner');
const corner = await state();
check('the bell after round one: the corner, three tips for Hadar', !!s && (await page.$$eval('#choice button', (b) => b.length)) === 3 && /מה הדר צריך לסיבוב 2/.test(await text('#choiceTitle')), await text('#choiceTitle'));
check('the calls worked in round one: Bulldozer has taken far more than Hadar', !!corner.bout && corner.bout.calls.block > 3 && corner.bout.calls.counter > 3 && (800 - corner.bout.bulldozer) > 2 * (220 - corner.bout.hadar), corner.bout ? `calls ${JSON.stringify(corner.bout.calls)}, hadar ${corner.bout.hadar.toFixed(0)}, bulldozer ${corner.bout.bulldozer.toFixed(0)}` : '');
await markNow();
await page.tap('#choice button[data-id="upper"]');
s = await until((s) => s.bout?.round === 2 && s.bout?.phase === 'round', 30, 'round two');
await listen();
check('"uppercut": Nehorai says it from the corner, and Hadar\'s counter is stronger in round two', heard.some((t) => t.includes('נהוראי:') && /אחד מלמטה/.test(t)) && (await G(() => window.__game.debug.game.missions.active.ev.stats.counter)) > 1.5);
s = await until((s) => s.mission?.step === 2 || !!s.hold, 200, 'the main event');
await G(() => window.__game.shoutBot(null));
check('with the calls from the corner, Hadar wins', !!s && !s.hold, s?.hold ? await text('#failReason') : '');
await markNow();
s = await talkThrough((s) => s.mission?.step === 3, 60, 'the result');
check('Bulldozer: "...you box well, from Katzir"; the bet is paid, shawarma on him', heard.some((t) => t.includes('בולדוזר:') && /מתאגרף טוב, מקציר/.test(t)) && heard.some((t) => t.includes('בולדוזר:') && /שווארמה לכולם/.test(t)));
await markNow(); // the kiosk's conversation starts as the picture comes back
s = await until(async () => G(() => { const g = window.__game.debug.game, K = g.world.places.kiosk; return Math.hypot(g.player.pos.x - K.front.x, g.player.pos.z - K.front.z) < 4 && !g.hud.fading; }), 12, 'the kiosk');
check('after the fight, at the kiosk, the ring taken down', !!s && !(await ringUp()) && !(await ropeBlocks()));
await wait(500);
await page.screenshot({ path: `${shots}/j4-kiosk.png` });
s = await talkThrough((s) => !s.mission, 90, 'the shawarma');
check('everyone gets a last line at the kiosk', ['ארז', 'יונתי', 'אברהם', 'דולב', 'מולר', 'הדר', 'נהוראי'].every((n) => heard.some((t) => t.startsWith(`${n}:`))), heard.map((t) => t.split(':')[0]).join(','));
s = await until((s) => !s.mission && !s.cutscene, 10, 'the end of the chapter');
check('mission 13 complete: the chapter\'s end, 300 more, Hadar along', !!s && s.progress.done.includes('mainevent') && s.progress.unlocks.includes('chapter-3') && s.progress.money === 2050 && (await G(() => window.__game.debug.game.hadarBuddy.active)), `money ${s?.progress.money}`);
check('the panel: chapter three done, free roam', (await text('#objLabel')) === 'הפרק השלישי הושלם', await text('#objLabel'));
await page.tap('#pauseBtn');
const rows = await page.$$eval('#missionRows .mission-row', (r) => r.map((x) => x.textContent));
check('the pause menu lists both chapter three missions as done', rows.some((t) => /פרק 3 · 1\. ערב אגרוף/.test(t)) && rows.some((t) => /פרק 3 · 2\. האירוע המרכזי/.test(t)), `${rows.length} rows`);
await page.tap('#resumeBtn');
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await writeFile(`${shots}/stage-j-results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
