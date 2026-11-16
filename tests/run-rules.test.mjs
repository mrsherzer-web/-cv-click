// When the run is a run, with the run button pressed for real on a phone-sized page:
//  - with the marker in hand and nothing to aim at: a full run;
//  - with the marker pointed at someone: a run toward him (or up to 60 degrees off), a walk when backing away
//    (the run button dimmed while it is held to a walk), a run again once the lock is gone;
//  - held to a walk (game.player.noRun, the hurt Nehorai of mission 42): a walk, the button dimmed.
// usage: node tests/run-rules.test.mjs [url]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.mode === 'foot' && !window.__game.debug.game.cutscene, null, { timeout: 60000 });
await G(() => { const g = window.__game.debug.game; g.setPopulation?.({ traffic: 0, people: 0 }); g.missions.active && g.missions.stop?.(); });
await wait(500);

// the start: where he stands, facing the camera's way; a target 15 m ahead of the camera
const start = await G(() => {
  const g = window.__game.debug.game, p = g.player.pos, yaw = g.follow.yaw;
  window.__start = { x: p.x, z: p.z, y: p.y, yaw: g.player.yaw };
  g.paint.armPlayer();
  const pos = { x: p.x - Math.sin(yaw) * 15, y: p.y, z: p.z - Math.cos(yaw) * 15 };
  window.__target = g.paint.addTarget({ pos, r: 0.5 });
  return { armed: !!g.paint.armed, pos };
});
check('the marker in his hand, a target ahead', start.armed);
await page.tap('#btnRun');
check('the run button pressed for real', (await page.getAttribute('#btnRun', 'aria-pressed')) === 'true');

// push the stick (in the camera's frame) from the start for a second and a half of game time (frames come slowly
// here), noting each frame: the speed, the run, the button, the lock. The verdict is on the last frames that still
// had (or had not) the lock, once he is up to speed (after 0.5 s)
async function push(move, setup = '') {
  return G(async ({ move, setup }) => {
    const g = window.__game.debug.game, s = window.__start;
    g.player.place(s.x, s.z, s.yaw, s.y); g.follow.snapBehind(s.yaw);
    if (setup) new Function('g', setup)(g);
    g.botInput = (input) => ({ ...input, move });
    const t0 = g.time, rows = [];
    let last = -1;
    while (g.time - t0 < 1.5) {
      await new Promise((r) => setTimeout(r, 15));
      if (g.time === last) continue;
      last = g.time;
      rows.push({ t: g.time - t0, speed: g.player.speed, running: !!g.player.running, held: document.getElementById('btnRun').classList.contains('held'), lock: !!g.paint.lock });
    }
    g.botInput = null;
    return rows;
  }, { move, setup });
}
// of the frames after 0.5 s with the lock as asked: the fastest, and whether every one ran / was held
function verdict(rows, locked) {
  const r = rows.filter((x) => x.t > 0.5 && x.lock === locked);
  return { frames: r.length, top: r.length ? +Math.max(...r.map((x) => x.speed)).toFixed(2) : null, ran: r.some((x) => x.running), held: r.length > 0 && r.every((x) => x.held) };
}

let v = verdict(await push({ x: 0, y: 1 }), true);
check('toward what the marker points at: a run', v.frames > 0 && v.ran && v.top > 5 && !v.held, JSON.stringify(v));
v = verdict(await push({ x: 0, y: -1 }), true);
check('backing away from it: a walk, the run button dimmed', v.frames > 0 && !v.ran && v.top < 2.7 && v.held, JSON.stringify(v));
v = verdict(await push({ x: 0.7, y: 0.7 }), true);
check('toward it at 45 degrees (inside the 60): the run allowed (a wall may stand that way from here)', v.frames > 0 && v.ran && !v.held, JSON.stringify(v));
v = verdict(await push({ x: 0.7, y: -0.7 }), true);
check('away from it at 135 degrees: a walk, the run button dimmed', v.frames > 0 && !v.ran && v.top < 2.7 && v.held, JSON.stringify(v));
v = verdict(await push({ x: 1, y: 0 }, 'window.__target.on = false;'), false);
check('nothing to aim at (the lock gone): sideways is a run', v.frames > 0 && v.ran && v.top > 5 && !v.held, JSON.stringify(v));
v = verdict(await push({ x: 0, y: 1 }, 'g.player.noRun = true;'), false);
check('held to a walk (hurt): a walk, the run button dimmed', v.frames > 0 && !v.ran && v.top < 2.7 && v.held, JSON.stringify(v));
v = verdict(await push({ x: 0, y: 1 }, 'g.player.noRun = false;'), false);
check('the hold lifted: a run again, the button bright', v.frames > 0 && v.ran && v.top > 5 && !v.held, JSON.stringify(v));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`);
await browser.close();
process.exit(ok === results.length ? 0 : 1);
