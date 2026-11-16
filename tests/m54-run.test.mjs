// Mission 54's run to the energy point, played the way a phone plays it: the marker in Nehorai's hand, the run
// button on the screen (not hidden under the marker's buttons, not covered by them or by a caption), and the run
// made with the stick alone, the run toggled only by tapping the real button. The bot here never forces a run:
// it only pushes the stick toward the energy point (around a ball in its way) and lets the controls' own run
// state through.
// Checks: the run button is on screen and lit when the run begins; with it the run reaches the point well ahead
// of the front; tapped off, a walk that keeps going reaches it too; standing still, the front catches him.
// usage: node tests/m54-run.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/m54-run/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const KEY = 'nehorai-game:save:v1';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const state = () => G(() => ({ ...window.__game.state, fail: !document.getElementById('failMenu').hidden })); // the fail menu on screen
const wait = (ms) => page.waitForTimeout(ms);

// a save with 47–53 done, left at 54's checkpoint 3 (the run), and a fresh page that continues it
async function atTheRun() {
  console.log('  (a save at the run, a fresh page)');
  await G(({ KEY }) => {
    const g = window.__game.debug.game, defs = g.missions.defs, id = 'gateback', p = g.progressForChapter(10);
    g.save = () => true; g.missions.keep = g.missions.forget = () => {};
    for (const d of defs) { if (d.chapter !== 10 || d.id === id) continue; if (defs.indexOf(d) > defs.findIndex((x) => x.id === id)) continue; p.done.push(d.id); }
    p.resume = { id, checkpoint: 3 }; p.savedAt = Date.now();
    localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(p));
  }, { KEY });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state?.mission?.id === 'gateback' && window.__game.state.mission.step === 3, null, { timeout: 60000 });
  await G(() => window.__game.debug.game.setPopulation?.({ traffic: 0, people: 0 }));
  // the look back at the front first; the run is his once the front moves
  await page.waitForFunction(() => { const m = window.__game.debug.game.missions.active; return !!m?.front?.go && !window.__game.debug.game.cutscene; }, null, { timeout: 30000 });
  await wait(300);
}

// the stick toward the energy point (sideways out of a ball's way when one is about to cross the line ahead);
// the run is whatever the run button says
async function stickRun() {
  await G(() => {
    const g = window.__game.debug.game, m = g.missions.active;
    window.__lead = Infinity; window.__knocks = 0;
    g.botInput = (input) => {
      const me = g.player.pos, gate = m.def.steps[3].target(m, g), F = m.front;
      if (F) window.__lead = Math.min(window.__lead, F.lead(me));
      let dx = gate.x - me.x, dz = gate.z - me.z;
      const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      // a ball within a few metres ahead and near our line: lean away from it
      for (const b of (m.kit?.items || []).filter((t) => t.pos && t.pts)) {
        const ax = b.pos.x - me.x, az = b.pos.z - me.z, along = ax * dx + az * dz, side = -ax * dz + az * dx;
        if (along > -0.5 && along < 4 && Math.abs(side) < 2.4) { const k = side > 0 ? -1 : 1, px = -dz * k, pz = dx * k; dx += px * 1.4; dz += pz * 1.4; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
      }
      const yaw = g.follow.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      return { ...input, move: { x: dx * rx + dz * rz, y: dx * fx + dz * fz } };
    };
  });
  const t0 = (await state()).time, r0 = Date.now();
  for (;;) {
    const s = await state();
    if (s.fail || s.mission?.step !== 3 || s.time - t0 > 60 || Date.now() - r0 > 180000) break;
    await wait(100);
  }
  const r = await G(() => { const g = window.__game.debug.game; g.botInput = null; return { lead: window.__lead, speed: g.player.speed }; });
  const s = await state();
  return { ...r, step: s.mission?.step, fail: !!s.fail, secs: +(s.time - t0).toFixed(1) };
}

const runButton = () => G(() => {
  const b = document.getElementById('btnRun'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const boxes = ['btnFire', 'btnReload', 'btnInteract'].map((id) => document.getElementById(id)).filter((e) => e && e.offsetParent).map((e) => e.getBoundingClientRect());
  const cap = document.getElementById('caption'); const cr = cap && !cap.hidden ? cap.getBoundingClientRect() : null;
  const hit = (a, c) => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
  return {
    shown: cs.display !== 'none' && !b.hidden && r.width > 40 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    top: !!at && (at === b || b.contains(at)), clear: !boxes.some((c) => hit(r, c)) && !(cr && hit(r, cr)),
    pressed: b.getAttribute('aria-pressed'), armed: !!window.__game.debug.game.paint.armed,
    gunOn: document.getElementById('hud').classList.contains('gun-on'),
  };
});

await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });

// ---------- the run with the run button ----------
await atTheRun();
let b = await runButton();
check('the marker in his hand and its buttons on screen', b.armed && b.gunOn, JSON.stringify(b));
check('the run button on screen beside them, nothing over it, clear of the marker\'s buttons and the caption', b.shown && b.top && b.clear, JSON.stringify(b));
check('the run button lit as the run begins', b.pressed === 'true');
const speed = await G(() => window.__game.debug.game.missions.active.front.speed);
check('the front is slower than a run (6.2 m/s) and only a little faster than a walk (2.4 m/s)', speed > 2.4 && speed < 3.2, `${speed} m/s`);
await page.screenshot({ path: `${shots}/run-start.png` });
let r = await stickRun();
check('with the run button: at the energy point well ahead of the front', r.step === 4 && !r.fail && r.lead > 8, JSON.stringify(r));

// ---------- the same run walked: the run button tapped off for real ----------
await atTheRun();
await page.tap('#btnRun');
b = await runButton();
check('a tap on the run button turns it off', b.pressed === 'false');
r = await stickRun();
check('walked all the way (no run): still at the energy point before the front', r.step === 4 && !r.fail, JSON.stringify(r));
await page.screenshot({ path: `${shots}/walk-end.png` });

// ---------- standing still: the front catches him ----------
await atTheRun();
const t0 = (await state()).time, r0 = Date.now();
let s;
for (;;) { s = await state(); if (s.fail || s.time - t0 > 30 || Date.now() - r0 > 120000) break; await wait(150); }
console.log(`  (stood still: ${JSON.stringify({ time: +(s.time - t0).toFixed(1), fail: !!s.fail, step: s.mission?.step, lead: await G(() => window.__game.debug.game.missions.active?.front?.lead(window.__game.debug.game.player.pos)) })})`);
const why = await G(() => document.getElementById('failReason')?.textContent || '');
check('standing still, the front catches him: a fail with a reason and the run button\'s tip', !!s.fail && /החזית/.test(why) && /כפתור הריצה/.test(why), `${(s.time - t0).toFixed(1)} s · ${why}`);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`);
await browser.close();
process.exit(ok === results.length ? 0 : 1);
