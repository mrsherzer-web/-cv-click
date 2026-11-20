// Leaving a mission in the middle of a scene, for the whole story. On a save with every mission done, each
// mission is played again as the pause menu's list does it and brought to a step:
//   chapters one to seven (scenes that are chains of lines: the next line, a camera shot, a choice, a film, a cut
//   to somewhere else, each waiting for the lines before it): every step, the steps entered in turn;
//   chapters eight to ten: its start and every checkpoint, staged the way "continue" stages one after a reload.
// The scene is left to run for a moment (early in it, and again some lines in), and then the player goes home
// with the real buttons: pause, "home". Half a minute of the open world after that has to be the open world:
//   no line is said, nothing holds the camera or the controls, no sheet is on screen (a call, a choice, the hack,
//   the keypad, a fail, the pause menu, the black), no mission is running, he is himself, standing, on foot, he
//   walks when the stick is pushed and the camera is with him, no fight, chase or marker is left on him, the
//   friends are at the gym, and the world is the one it was before: this dimension, its weather, light, fog and
//   sounds, the HUD in its plain state, no squad, no helicopters, his own strength.
// usage: node tests/quit-sweep.test.mjs [url] [first mission, 1-59] [last mission] [seconds into the scene, e.g. 1.5,9]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const FIRST = Number(process.argv[3]) || 1, LAST = Number(process.argv[4]) || 99;
const TIMES = (process.argv[5] || '1.5,9').split(',').map(Number);
const KEY = 'nehorai-game:save:v1';
const T0 = Date.now();
const mins = () => ((Date.now() - T0) / 60000).toFixed(1);
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}  [${mins()} min]`); return !!ok; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);

// ---------- a save with the whole story done, and a fresh page that continues it ----------
await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 300000 });
await G(({ KEY }) => {
  const g = window.__game.debug.game, defs = g.missions.defs.filter((d) => !d.side);
  g.save = () => true; g.missions.keep = g.missions.forget = () => {};
  const p = g.progressForChapter(10);
  for (const d of defs) { if (!p.done.includes(d.id)) p.done.push(d.id); for (const u of d.reward?.unlocks || []) if (!p.unlocks.includes(u)) p.unlocks.push(u); }
  p.savedAt = Date.now();
  localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(p));
}, { KEY });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 300000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.mode === 'foot', null, { timeout: 60000 });

// ---------- in the page: the loop held and stepped from here (promises get their turn between frames) ----------
const base = await G(() => {
  const D = window.__game.debug, g = D.game, W = D.world;
  g.save = () => true; g.missions.keep = g.missions.forget = () => {};
  g.setPopulation?.({ traffic: 0, people: 0 });
  g.hold = true;
  const shown = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
  const Q = (window.__q = {
    async run(sec, dt = 1 / 30) {
      const n = Math.max(1, Math.round(sec / dt));
      for (let i = 0; i < n; i++) { g.update(dt); W.tick(D.camera, dt); g.daylight?.update?.(dt); await null; await null; await null; }
    },
    look() {
      const p = g.player.pos, c = D.camera.position;
      return {
        said: g.dialogue.said, busy: g.dialogue.busy, cutscene: !!g.cutscene, shot: !!g.follow.override, mission: g.missions.active ? `${g.missions.active.def.id}/${g.missions.active.stepIndex}` : null,
        call: shown('callCard'), choice: shown('choice'), keypad: shown('keypad'), hack: shown('hack'), fail: shown('failMenu'), pause: shown('pauseMenu'), bout: shown('bout'), pursuit: shown('pursuit'),
        black: document.getElementById('fade').classList.contains('on'),
        mode: g.mode, as: g.playingAs ?? null, pose: g.nehorai?.pose ?? null, shownBody: !!g.nehorai?.root?.visible, crawling: !!g.player.crawling, noRun: !!g.player.noRun,
        armed: !!g.paint?.armed, fight: !!(g.fight && !g.fight.over), chase: !!g.chase, fists: !!g.fistsUp, combat: !!g.combat,
        cam: Math.hypot(c.x - p.x, c.z - p.z), night: g.daylight?.target ?? null, x: p.x, z: p.z,
        erez: !!g.npcs.get('erez')?.visible, carOff: !!g.car.disabled,
        // the world as it is between missions: compared, key by key, with what it was before any mission was played
        world: {
          dimension: g.dimensionName ?? null, rain: g.sound?.rainLevel ?? 0, heartbeat: !!g.sound?.beatWanted, static: !!g.sound?.staticWanted, crowd: !!g.sound?.crowdWanted, music: g.sound?.musicMode ?? null,
          squad: !!g.squad?.active, helicopters: g.helis?.length ?? 0, stamina: g.fighter?.maxStamina ?? null, power: g.fighter?.power ?? null, pace: g.player.speedScale ?? 1,
          fog: D.scene.fog ? `${Math.round(D.scene.fog.near ?? -1)}-${Math.round(D.scene.fog.far ?? -1)}` : null,
          hud: [...document.getElementById('hud').classList].sort().join(' '), radio: shown('radio'), minimap: shown('minimap'), phone: shown('phoneBtn'),
        },
      };
    },
    lines(n) { return g.dialogue.history.slice(-n); },
    // the mission as the pause menu's list plays it again, its steps entered in turn up to `step`
    async begin(id, step) {
      const def = g.missions.defs.find((d) => d.id === id);
      if (g.missions.active) { if (g.missions.quit) g.missions.quit(); else { g.missions.stop(); g.missions.showNext(); } } // (an older build has no quit(): the test runs on it too)
      (g.dialogue.drop || g.dialogue.stop).call(g.dialogue); g.cutscene = false; g.follow.override = null; g.botInput = null;
      if (g.mode === 'car') g.exitCar();
      g.hold = true; // (the loop stays this test's to step, whatever a sheet let go of)
      g.missions.replay(id);
      await Q.run(0.25);
      for (let i = 1; i <= step; i++) {
        if (g.missions.active?.def !== def) return `the mission ended at step ${i - 1}`;
        const drive = /לנסוע|לחנות|לעצור|להמשיך|מתקשר|לחכות שאברהם|לצאת מהרכב|לא לאבד|לצאת מחדרה|הביתה:/.test(def.steps[i].objective);
        g.dialogue.stop(); g.cutscene = false; g.follow.override = null;
        if (drive && g.mode !== 'car') g.enterCar();
        if (!drive && g.mode === 'car') g.exitCar();
        g.missions.enterStep(i);
        await Q.run(0.25);
      }
      return g.missions.active?.def === def ? null : 'the mission ended';
    },
    // chapters eight to ten: the mission's start staged as a replay's is, then the checkpoint's own restore (what
    // "continue" does after a reload)
    async stage(id, from) {
      const def = g.missions.defs.find((d) => d.id === id);
      if (g.missions.active) { if (g.missions.quit) g.missions.quit(); else { g.missions.stop(); g.missions.showNext(); } }
      (g.dialogue.drop || g.dialogue.stop).call(g.dialogue); g.cutscene = false; g.follow.override = null; g.botInput = null;
      if (g.mode === 'car') g.exitCar();
      g.hold = true;
      def.prepareReplay?.(g);
      g.missions.start(id, { replay: true, from });
      await Q.run(0.25);
      return g.missions.active?.def === def ? null : 'the mission ended';
    },
    // between two leavings: no mission, on foot, at home (a leaving that was not counted may have left him anywhere)
    async neutral() {
      if (g.missions.active) { if (g.missions.quit) g.missions.quit(); else { g.missions.stop(); g.missions.showNext(); } }
      (g.dialogue.drop || g.dialogue.stop).call(g.dialogue); g.cutscene = false; g.follow.override = null; g.botInput = null; g.hold = true;
      if (g.mode === 'car') g.exitCar();
      const h = W.start; // (where the pause menu's "home" puts him)
      if (h && Math.hypot(g.player.pos.x - h.x, g.player.pos.z - h.z) > 40) g.start(h.x, h.z, h.yaw);
      await Q.run(0.2);
    },
    // the stick pushed forward for two seconds: how far he gets
    async walk() {
      const p = g.player.pos, x0 = p.x, z0 = p.z;
      g.botInput = (input) => ({ ...input, move: { x: 0, y: 1 } });
      await Q.run(2);
      g.botInput = null;
      return Math.hypot(p.x - x0, p.z - z0);
    },
  });
  const defs = g.missions.defs.filter((d) => !d.side).map((d) => ({ id: d.id, chapter: d.chapter || 1, number: d.number, title: d.title, steps: d.steps.length, checkpoints: [0, ...d.steps.map((s, i) => (s.checkpoint && i > 0 ? i : -1)).filter((i) => i > 0)], staged: (d.chapter || 1) >= 8 && !!d.restore && !!d.prepareReplay }));
  return { defs, look: Q.look() };
});
const MISSIONS = base.defs.slice(FIRST - 1, LAST);
const stepsOf = (d) => (d.staged ? d.checkpoints : Array.from({ length: d.steps }, (_, i) => i));
console.log(`  (${MISSIONS.length} missions, ${MISSIONS.reduce((n, d) => n + stepsOf(d).length, 0)} steps and checkpoints, left ${TIMES.join(' s and ')} s into each; the open world before any of it: ${JSON.stringify(base.look)})`);
check('the save with the whole story done: the open world, no mission', base.look.mission === null && base.look.mode === 'foot' && !base.look.cutscene && !base.look.shot, JSON.stringify(base.look));

// the way out, with the real buttons: a mission that has just failed is left by its own sheet ("quit"; he then
// gets out of the car if he is in one); any other by the pause menu (Escape where a sheet covers its button) and "home"
async function goHome() {
  if (await G(() => !document.getElementById('failMenu').hidden)) {
    await page.tap('#quitMissionBtn');
    await G(() => { const g = window.__game.debug.game; if (g.mode === 'car') g.exitCar(); });
    return null;
  }
  const tappable = await G(() => { const b = document.getElementById('pauseBtn'), r = b.getBoundingClientRect(); if (!r.width) return false; const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!at && (at === b || b.contains(at)); });
  if (tappable) await page.tap('#pauseBtn'); else await page.keyboard.press('Escape');
  const open = await page.waitForFunction(() => !document.getElementById('pauseMenu').hidden, null, { timeout: 4000 }).then(() => true, () => false);
  if (!open) return tappable ? 'the pause menu did not open' : 'no way to pause here';
  await page.tap('#homeBtn');
  await page.waitForFunction(() => document.getElementById('pauseMenu').hidden, null, { timeout: 4000 }).catch(() => {});
  return null;
}

let n = 0;
for (const d of MISSIONS) {
  const N = base.defs.indexOf(d) + 1;
  for (const i of stepsOf(d)) {
    for (const t of TIMES) {
      n++;
      const name = `mission ${N} (${d.id}), ${d.staged ? 'checkpoint' : 'step'} ${i}, left ${t} s into it`;
      await G(() => window.__q.neutral());
      const pre = await G(() => window.__q.look()); // the open world just before: what is left on after it is this leaving's own
      let skip = null;
      try { skip = await G(({ id, i, staged }) => (staged ? window.__q.stage(id, i) : window.__q.begin(id, i)), { id: d.id, i, staged: d.staged }); } catch (e) { skip = `could not be staged: ${String(e.message || e).slice(0, 160)}`; }
      if (skip) { console.log(`  (${name}: ${skip}; not counted)`); continue; }
      // a moment of the scene: its first lines, its black, its shot
      await G((t) => window.__q.run(Math.min(t, 1.5)), t);
      await wait(620);
      if (t > 1.5) await G((t) => window.__q.run(t - 1.5), t);
      const before = await G(() => window.__q.look());
      if (!before.mission) { console.log(`  (${name}: the mission was over by then; not counted)`); continue; }
      const cannot = await goHome();
      if (cannot) { console.log(`  (${name}: ${cannot}, in ${JSON.stringify({ mission: before.mission, call: before.call, choice: before.choice, hack: before.hack, keypad: before.keypad, fail: before.fail, black: before.black })}; not counted)`); if (await G(() => !document.getElementById('pauseMenu').hidden)) await page.tap('#resumeBtn').catch(() => {}); continue; }
      const at = await G(() => window.__q.look());
      // half a minute of the open world: watched as it goes
      const seen = { cutscene: false, shot: false, sheet: '' };
      for (let k = 0; k < 6; k++) {
        await G(() => window.__q.run(5, 0.1));
        if (k === 0 || k === 4) await wait(700); // (timers of a scene's black, if any is still to come)
        const s = await G(() => window.__q.look());
        if (k >= 1) { seen.cutscene ||= s.cutscene; seen.shot ||= s.shot; }
        for (const key of ['call', 'choice', 'keypad', 'hack', 'fail', 'pause']) if (s[key] && !pre[key] && !seen.sheet.includes(key)) seen.sheet += `${key} `;
      }
      const after = await G(() => window.__q.look());
      const walked = after.mode === 'foot' ? await G(() => window.__q.walk()) : -1;
      // (a scene's black lifts on the clock on the wall, which this test runs far ahead of: it is given its time)
      await page.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 8000 }).catch(() => {});
      const end = await G(() => window.__q.look());
      const bad = [];
      if (after.said > at.said) bad.push(`${after.said - at.said} line(s) said after it: ${(await G((k) => window.__q.lines(k), Math.min(3, after.said - at.said))).join(' / ').slice(0, 200)}`);
      if (seen.cutscene || end.cutscene) bad.push('a scene still holds the controls');
      if (seen.shot || end.shot) bad.push('a shot still holds the camera');
      if (seen.sheet) bad.push(`on screen: ${seen.sheet.trim()}`);
      if (end.black) bad.push('the screen is black');
      if (end.mission) bad.push(`a mission is running: ${end.mission}`);
      if (end.as !== pre.as) bad.push(`played as ${end.as}`);
      if (end.pose !== pre.pose) bad.push(`his pose: ${end.pose}`);
      if (!end.shownBody) bad.push('his body is hidden');
      if (end.mode !== 'foot') bad.push(`in the ${end.mode}`);
      else if (walked < 1.5) bad.push(`he does not walk (${walked.toFixed(2)} m in 2 s)`);
      if (end.cam > 25) bad.push(`the camera is ${end.cam.toFixed(0)} m from him`);
      if (end.crawling || end.noRun) bad.push('held to a crawl or a walk');
      if (end.armed || end.fight || end.chase || end.fists || end.combat) bad.push(`left on him: ${['armed', 'fight', 'chase', 'fists', 'combat'].filter((k) => end[k]).join(' ')}`);
      if (end.bout && !pre.bout) bad.push('a bout\'s scoreboard on screen');
      if (end.night !== pre.night) bad.push(`the light: ${end.night} (was ${pre.night})`);
      if (pre.erez && !end.erez) bad.push('the friends are not at the gym');
      for (const [key, was] of Object.entries(pre.world)) if (end.world[key] !== was) bad.push(`${key}: ${end.world[key]} (was ${was})`);
      check(name, bad.length === 0, bad.join('; '));
    }
  }
}
// and after all of it: the open world of the beginning
const last = await G(() => window.__q.look());
const drift = [];
for (const key of ['cutscene', 'shot', 'mission', 'call', 'choice', 'keypad', 'hack', 'fail', 'pause', 'bout', 'mode', 'as', 'pose', 'shownBody', 'crawling', 'noRun', 'armed', 'fight', 'chase', 'fists', 'combat', 'night', 'erez', 'carOff']) if (last[key] !== base.look[key]) drift.push(`${key}: ${last[key]} (was ${base.look[key]})`);
for (const [key, was] of Object.entries(base.look.world)) if (last.world[key] !== was) drift.push(`${key}: ${last.world[key]} (was ${was})`);
check('after all of them the open world is as it was before the first', drift.length === 0, drift.join('; '));
check('no page errors', errors.length === 0, [...new Set(errors)].slice(0, 4).join(' | '));
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed  (${n} leavings tried, ${mins()} min)`);
await browser.close();
process.exit(ok === results.length ? 0 : 1);
