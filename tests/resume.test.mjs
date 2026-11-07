// Chapters eight and nine: checkpoints are saved and picked up after a reload. For the start and every
// checkpoint of every mission of those chapters: a save left at that checkpoint, a fresh page, "continue" on the start
// screen, and the mission is back at that step with its objective, a target, the player on a floor, no
// page error and no instant fail; then a few seconds of play. Also: reaching a checkpoint writes the
// save, and quitting the mission (the pause menu's home) forgets it.
// usage: node tests/resume.test.mjs [url] [chapter]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const KEY = 'nehorai-game:save:v1';

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
const saved = () => G((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);

// the missions of chapters eight and nine (only those resume after a reload) and the checkpoints of each
// (pass a chapter as the third argument to walk only that one)
const ONLY = Number(process.argv[3]) || 0;
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
const plan = await G((only) => window.__game.debug.game.missions.defs
  .filter((d) => (d.chapter || 1) >= 8 && (!only || d.chapter === only))
  .map((d) => ({ id: d.id, chapter: d.chapter, number: d.number, cps: d.steps.map((s, i) => (i === 0 || s.checkpoint ? i : null)).filter((i) => i !== null) })), ONLY);
const per = (c) => plan.filter((p) => p.chapter === c).length;
check('chapter eight has eight missions and chapter nine thirteen; each can be picked up at its start and at its checkpoints', (ONLY ? true : per(8) === 8 && per(9) === 13) && plan.every((p) => p.cps[0] === 0), plan.map((p) => `${p.id}:${p.cps.join('/')}`).join(' '));

// a save at the start of `id`'s chapter, that chapter's missions before `id` done, left at `cp` of `id`
async function loadAt(id, cp) {
  await G(({ id, cp, KEY }) => {
    const g = window.__game.debug.game, defs = g.missions.defs, ch = defs.find((d) => d.id === id).chapter, p = g.progressForChapter(ch);
    g.save = () => true; // the page saves as it goes away: it must not write over the save set here
    g.missions.keep = g.missions.forget = () => {};
    for (const d of defs) {
      if ((d.chapter || 1) !== ch || d.id === id) continue;
      if (defs.indexOf(d) > defs.findIndex((x) => x.id === id)) continue;
      p.done.push(d.id); p.money += d.reward?.money || 0; for (const u of d.reward?.unlocks || []) if (!p.unlocks.includes(u)) p.unlocks.push(u);
    }
    p.resume = cp === null ? null : { id, checkpoint: cp };
    p.savedAt = Date.now();
    localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(p));
  }, { id, cp, KEY });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
}
const look = () => G(() => {
  const g = window.__game.debug.game, m = g.missions.active, p = g.player.pos;
  if (!m) return null;
  const st = m.def.steps[m.stepIndex], cutscene = !!g.cutscene, fighting = !!(m.fight || (g.fight && !g.fight.over)); // a fight needs no marker: they stand in front of you
  let target = null;
  try { const t = typeof st.target === 'function' ? st.target(m, g) : st.target; target = t ? { x: t.x, z: t.z } : null; } catch (e) { target = { error: String(e) }; }
  const ground = g.mode === 'car' ? g.world.groundHeight(g.car.pos.x, g.car.pos.z, g.car.pos.y) : g.world.groundHeight(p.x, p.z, p.y);
  const y = g.mode === 'car' ? g.car.pos.y : p.y;
  return {
    id: m.def.id, step: m.stepIndex, objective: document.getElementById('objText')?.textContent || '',
    target, mode: g.mode, onFloor: Number.isFinite(y) && Math.abs(y - ground) < 1.2, y, ground,
    failed: !g.hud.el.fail.hidden, toast: g.hud.el.toast.textContent, cutscene, fighting,
  };
});

for (const { id, number, cps } of plan) {
  for (const cp of cps) {
    const before = errors.length;
    await loadAt(id, cp);
    const summary = (await page.textContent('#startScreen')) || '';
    await page.tap('#startBtn');
    await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
    await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
    const a = await look();
    const back = !!a && a.id === id && (a.step === cp || (cp === 0 && a.step <= 1)); // a start may roll straight on
    check(`mission ${number} (${id}) · checkpoint ${cp}: "continue" picks it up there`, back && /ממשיכים מנקודת השמירה/.test(a.toast) && /באמצע/.test(summary), a ? `${a.id} step ${a.step} · "${a.toast}"` : 'no mission');
    // a few seconds of play, the dialogue tapped through
    await until(async (s) => { if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return false; }, 5, 'a few seconds');
    const b = await look();
    const fine = !!b && b.id === id && !b.failed && !!b.objective && b.onFloor && (!!b.target || b.cutscene || b.fighting) && !b.target?.error;
    check(`mission ${number} (${id}) · checkpoint ${cp}: playable after the reload (objective, a target or a fight, on a floor, no fail, no error)`, fine && errors.length === before,
      b ? `step ${b.step} · "${b.objective}" · target ${b.target ? (b.target.error || `${b.target.x?.toFixed(1)},${b.target.z?.toFixed(1)}`) : 'none'} · ${b.mode} y ${b.y?.toFixed(2)} ground ${b.ground?.toFixed(2)} · failed ${b.failed}${errors.length > before ? ` · ${errors.slice(before).join(' | ').slice(0, 300)}` : ''}` : 'the mission is gone');
  }
}

// reaching a checkpoint writes the save; the pause menu's home forgets it
{
  const { id, cps } = plan[2];
  await loadAt(id, null);
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
  await G((id) => { const g = window.__game.debug.game; g.missions.start(id); const m = g.missions.active; m.def.restore?.(m, g, m.def.steps.findIndex((s, i) => i > 0 && s.checkpoint)); }, id);
  await G((cp) => { const g = window.__game.debug.game; g.missions.enterStep(cp); }, cps[1]);
  const w = await saved();
  check('reaching a checkpoint saves it at once', w?.resume?.id === id && w?.resume?.checkpoint === cps[1], JSON.stringify(w?.resume));
  await page.tap('#pauseBtn');
  await wait(400);
  await page.tap('#homeBtn');
  await wait(800);
  const q = await saved();
  check('leaving the mission (home) forgets it: a reload begins as usual', !q?.resume && !(await G(() => window.__game.debug.game.missions.active)), JSON.stringify(q?.resume));
}
check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
