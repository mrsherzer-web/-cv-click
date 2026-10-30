// Guidance check: every step of all eleven missions (both chapters) says what to do, and a step that sends the player
// somewhere shows where (an arrow and a distance under the objective). Between missions the panel names
// the next one and where it begins. Each mission is started the way a player starts it (its blue
// marker, a call from the phone, or the call that comes in by itself); then each of its steps is
// entered in turn and the objective panel is read and photographed.
// usage: node tests/guidance.test.mjs [url] [screenshot dir] [missions, e.g. 1,2,3]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/guidance/', import.meta.url).pathname;
const only = process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(120000); // software rendering on a busy machine can take a while over one frame
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const state = () => G(() => window.__game.state);
async function until(cond, sec) {
  const t0 = (await state()).time;
  for (;;) { const s = await state(); if (await cond(s)) return s; if (s.time - t0 > sec) return null; await page.waitForTimeout(80); }
}
const settle = () => until(() => false, 0.25); // a few frames of game time
const panel = () => G(() => ({
  label: document.getElementById('objLabel').textContent, text: document.getElementById('objText').textContent,
  meters: document.getElementById('objDist').hidden ? null : document.getElementById('objMeters').textContent,
}));

const ORDER = ['pickup', 'gym', 'hadera', 'crew', 'dolev', 'heist', 'home', 'morning', 'boxer', 'kiosk', 'gloves'];
// what each mission unlocks, from before the first one on
const UNLOCKS = [[], ['gym', 'friends'], ['combo', 'hadera'], ['hadera-parking'], ['speaker', 'dolev'], ['dolev-crew'], ['engine'], ['free-roam'], ['hadar'], ['uppercut'], []];
const TITLES = ['אוספים את אברהם', 'החבורה במכון', 'יורדים לחדרה', 'לא מתקפלים', 'מרימים לדולב', 'המכה הראשונה', 'חוזרים הביתה', 'בוקר אחרי', 'ניו יורק במכון', 'ביקור בקיוסק', 'מרדף אחרי הכפפות'];
// the panel's heading for mission N: its number within its chapter
const heading = (N) => (N <= 7 ? `משימה ${N} מתוך 7 · ${TITLES[N - 1]}` : `פרק 2 · משימה ${N - 7} מתוך 4 · ${TITLES[N - 1]}`);
// an objective that sends the player somewhere has to come with an arrow and a distance
const GOES = /^(ללכת|לנסוע|להגיע|להיכנס לרנו|להיכנס לרכב|להיכנס לחדר|להיכנס לזירה|לגשת|לחנות|להמשיך|לאסוף|להביא|להחזיר|להעמיס|לעצור ב)/;
const rows = [];

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
for (const N of only) {
  const id = ORDER[N - 1], done = ORDER.slice(0, N - 1), unlocks = UNLOCKS.slice(0, N).flat();
  await G(({ done, unlocks }) => {
    if (window.__game.debug?.game) window.__game.debug.game.save = () => {}; // leaving the page saves: not over this one
    localStorage.clear();
    if (done.length) localStorage.setItem('nehorai-game:save:v1', JSON.stringify({ v: 1, money: 1000, done, unlocks, car: { color: '#f3f4f6', health: 100, upgrades: [] }, records: {}, alert: 0, savedAt: Date.now() }));
  }, { done, unlocks });
  await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 300000 });
  await page.tap('#startBtn');
  await page.waitForTimeout(300);
  await G(() => window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }));
  await settle();

  if (N > 1) {
    // between missions: the next one, and how it begins
    const p = await panel(), s = await state();
    rows.push({ mission: N, step: 'next', ...p });
    await page.screenshot({ path: `${shots}/m${N}-next.png` });
    const marker = !!s.target;
    check(`before mission ${N}: "the next mission", its name and where it begins`, p.label === (N === 8 ? 'פרק 2 · המשימה הבאה' : 'המשימה הבאה') && p.text.startsWith(`${TITLES[N - 1]} · `) && p.text.length > TITLES[N - 1].length + 6, `${p.label} | ${p.text}`);
    if (id === 'dolev') check('mission 5 begins with a call from the phone: no marker needed', !marker && /להתקשר לדולב/.test(p.text));
    else if (id === 'home') check('mission 7 begins with a call that comes by itself: no marker needed', !marker && /יתקשר/.test(p.text));
    else check(`mission ${N} has a blue marker, with an arrow and a distance to it`, marker && !!p.meters, p.meters ?? 'no distance');
    // started the way a player starts it
    if (id === 'dolev') await G(() => window.__game.debug.game.call('dolev'));
    else if (s.target && id !== 'home') await G((t) => window.__game.teleport(t.x, t.z), s.target);
    check(`mission ${N} starts`, !!(await until((s) => s.mission?.id === id, 20)));
  } else check('mission 1 starts with the game', (await state()).mission?.id === 'pickup');

  await G(() => window.__game.setTimeScale(1));
  const n = await G(() => window.__game.debug.game.missions.active?.def.steps.length ?? 0);
  for (let i = 0; i < n; i++) {
    // in the car for the steps that are driven, on foot for the rest
    const drive = await G((i) => /לנסוע|לחנות|לעצור|להמשיך|מתקשר|לחכות שאברהם|לצאת מהרכב|לא לאבד/.test(window.__game.debug.game.missions.active.def.steps[i].objective), i);
    const err = await G(({ i, drive }) => {
      const g = window.__game.debug.game;
      try {
        g.dialogue.stop(); g.cutscene = false; g.follow.override = null; g.hold = false;
        if (drive && g.mode !== 'car') g.enterCar();
        if (!drive && g.mode === 'car') g.exitCar();
        g.missions.enterStep(i);
        return null;
      } catch (e) { return String(e.message || e); }
    }, { i, drive });
    await settle();
    const s = await state(), p = await panel();
    if (s.mission?.id !== id) break; // the last scene ended the mission
    rows.push({ mission: N, step: i, mode: s.mode, ...p });
    await page.screenshot({ path: `${shots}/m${N}-s${i}.png` });
    const where = GOES.test(p.text) ? (p.meters ? `, ${p.meters}` : ', NO DISTANCE') : '';
    const ok = !err && p.label === heading(N) && p.text.length > 3 && (!GOES.test(p.text) || !!p.meters);
    check(`mission ${N}, step ${i}: "${p.text}"${where}`, ok, err || (p.label === heading(N) ? '' : `heading: ${p.label}`));
  }
}
await writeFile(`${shots}/guidance.json`, JSON.stringify(rows, null, 1));
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
