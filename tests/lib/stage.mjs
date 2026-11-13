// The harness of the chapter-nine stage tests (stage-r/s/t), as a module for chapter ten's (stage-u…x): a phone
// page on the single-file build, a save placed at a mission, the game's loop held and stepped at 30 frames a second
// (the renderer runs at 1–2 fps here), and the hands of a player: the stick walked along a path, the real buttons
// pressed, the lines tapped through and listened to, a fist fight played with the buttons.
//
// usage:
//   import { openStage } from './lib/stage.mjs';
//   const t = await openStage({ chapter: 10, done: ['dawn', 'lastconvoy'], first: 'citadel' });
//   const { check, S, G, step, until, talkThrough, said, interact, tp, fight, snap } = t;
//   ...checks...
//   await t.finish();   // "no page errors", the count, the exit code
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
export const KEY = 'nehorai-game:save:v1';

// opts: url, shots (screenshot dir), chapter (the save is the start of this chapter), done (ids of that chapter's
// missions already done), first (the mission that must begin: it is started if it does not begin by itself),
// progress(p) (a last touch on the save, in the page: pass a function body as a string or a function with no closure),
// hold (default true: the loop held and stepped from the test)
export async function openStage({ url = new URL('../../dist/play.html', import.meta.url).href, shots = new URL('../../test-results/', import.meta.url).pathname, chapter = 10, done = [], first = null, progress = null, hold: held = true, viewport = { width: 844, height: 390 } } = {}) {
  await mkdir(shots, { recursive: true });
  const T0 = Date.now();
  const mins = () => ((Date.now() - T0) / 60000).toFixed(1);
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}  [${mins()} min]`); return !!ok; };
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  ctx.setDefaultTimeout(240000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const G = (fn, arg) => page.evaluate(fn, arg);
  const text = (sel) => page.textContent(sel);

  // ---------- the page: the loop stepped from here, the state read in one call ----------
  const install = () => G(() => {
    const D = window.__game.debug, g = D.game, W = D.world;
    g.setPopulation?.({ traffic: 0, people: 0 });
    window.__r = {
      step(sec) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { g.update(1 / 30); W.tick(D.camera, 1 / 30); g.daylight?.update?.(1 / 30); } },
      S() {
        const Fi = g.fight, f = g.fighter, p = g.player.pos, m = g.missions.active, c = g.car;
        const flat = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v == null || typeof v !== 'object'));
        return {
          me: { hp: f.hp, st: f.stamina, state: f.state, x: p.x, z: p.z, y: p.y, taken: f.taken, crawling: !!g.player.crawling, as: g.playingAs },
          car: { x: c.pos.x, z: c.pos.z, y: c.pos.y, yaw: c.yaw, speed: c.speed, health: c.health },
          fight: Fi && !Fi.over ? { chain: Fi.chain, combos: Fi.combos, heavies: Fi.heavies, interrupts: Fi.interrupts, special: Fi.special ?? null, opening: Fi.opening ?? null } : null,
          opp: Fi ? Fi.opponents.map((o) => ({ id: o.npc.id, mode: o.mode, t: o.t, d: Math.hypot(o.npc.pos.x - p.x, o.npc.pos.z - p.z), atMe: o.against === f, counter: o.fighter.counter, state: o.fighter.state, down: o.fighter.down, floored: o.fighter.floored, braced: o.fighter.braced, guard: o.guard, boss: o.boss, hp: o.fighter.hp, phase: o.phase })) : [],
          mission: m ? { id: m.def.id, step: m.stepIndex, s: flat(m.s), won: !!m.s.won, lost: !!m.s.lost } : null,
          prompt: g.prompt?.label ?? null, dialogue: g.dialogue.busy, cutscene: !!g.cutscene, hold: !!g.hold, mode: g.mode,
          objective: document.getElementById('objText')?.textContent || '',
          pill: document.getElementById('pursuit')?.textContent || '',
          fail: !g.hud.el.fail.hidden, hits: g.paint.hits, armed: !!g.paint.armed, dimension: g.dimensionName ?? null,
        };
      },
      pt: (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw },
      // the player's marker fired at a guard for real (close and facing him), the loop let go for each shot
      shoot(id) {
        const P = g.paint, gd = P.guards.find((x) => x.npc.id === id); if (!gd || gd.marked) return !!gd?.marked;
        const n = gd.npc, me = g.player.pos, dx = me.x - n.pos.x, dz = me.z - n.pos.z, d = Math.hypot(dx, dz) || 1;
        g.player.place(n.pos.x + dx / d * 5, n.pos.z + dz / d * 5, 0, n.pos.y); g.player.yaw = Math.atan2(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z);
        for (let k = 0; k < 16 && !gd.marked; k++) { g.hold = false; P.lock = gd; P.fire(); g.hold = true; window.__r.step(0.15); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
        return gd.marked;
      },
      // a thing that is not a person (a node, a core, a weak point) shot for real from `from`
      shootProp(pr, from) {
        const P = g.paint;
        g.player.place(from.x, from.z, 0, from.y); g.player.yaw = Math.atan2(pr.x - from.x, pr.z - from.z); P.lock = null;
        for (let i = 0; i < 12 && !pr.done; i++) { g.hold = false; P.lock = null; P.fire(); g.hold = true; window.__r.step(0.2); g.player.yaw = Math.atan2(pr.x - g.player.pos.x, pr.z - g.player.pos.z); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
        return pr.done;
      },
    };
    // the left thumb, for the test: a path over a half-metre grid at the walker's own height (walls, doors and
    // machines are solid), walked with the stick
    window.__w = (() => {
      const cols = W.cols, SZ = 0.5, R = 0.36;
      let path = null, k = 0, goal = null;
      const pos = { x: 0, y: 0, z: 0 };
      function plan(to, margin = 26) {
        const me = g.player.pos;
        const x0 = Math.min(me.x, to.x) - margin, z0 = Math.min(me.z, to.z) - margin, x1 = Math.max(me.x, to.x) + margin, z1 = Math.max(me.z, to.z) + margin;
        const nx = Math.round((x1 - x0) / SZ) + 1, nz = Math.round((z1 - z0) / SZ) + 1;
        const key = (i, j, y) => (i * nz + j) * 40 + Math.max(0, Math.min(39, Math.round((y + 60) / 1.25)));
        const free = new Map();
        const isFree = (i, j, y) => {
          const kk = key(i, j, y); if (free.has(kk)) return free.get(kk);
          const x = x0 + i * SZ, z = z0 + j * SZ; pos.x = x; pos.y = y; pos.z = z;
          const hit = cols.resolve(pos, R, y, g.car) && cols.hitHard && Math.hypot(pos.x - x, pos.z - z) > 0.02;
          free.set(kk, !hit); return !hit;
        };
        const si = Math.round((me.x - x0) / SZ), sj = Math.round((me.z - z0) / SZ), sy = W.groundHeight(x0 + si * SZ, z0 + sj * SZ, me.y);
        const prev = new Map(), ys = new Map(), q = [[si, sj, sy]];
        const s0 = key(si, sj, sy); prev.set(s0, -1); ys.set(s0, sy);
        const ty = to.y ?? W.groundHeight(to.x, to.z, me.y);
        let found = null;
        for (let h = 0; h < q.length; h++) {
          const [i, j, y] = q[h], kk = key(i, j, y);
          const x = x0 + i * SZ, z = z0 + j * SZ;
          if (Math.hypot(x - to.x, z - to.z) < (to.near ?? 0.6) && Math.abs(y - ty) < 1.2) { found = kk; break; }
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
            const y2 = W.groundHeight(x0 + a * SZ, z0 + b * SZ, y);
            if (Math.abs(y2 - y) > 0.9) continue;
            const k2 = key(a, b, y2); if (prev.has(k2)) continue;
            if (!isFree(a, b, y2)) continue;
            if (di && dj && (!isFree(i + di, j, y) || !isFree(i, j + dj, y))) continue;
            prev.set(k2, kk); ys.set(k2, y2); q.push([a, b, y2]);
          }
        }
        if (found === null) return null;
        const out = [];
        for (let c = found; c !== -1; c = prev.get(c)) { const ij = Math.floor(c / 40), i = Math.floor(ij / nz), j = ij % nz; out.push({ x: x0 + i * SZ, z: z0 + j * SZ, y: ys.get(c) }); }
        out.reverse();
        return out;
      }
      function stop() { g.botInput = null; path = null; }
      function go(to) {
        stop();
        goal = to; path = plan(to); k = 0;
        if (!path) return false;
        g.botInput = (input) => {
          if (!path || g.mode !== 'foot' || g.cutscene) return input;
          const me = g.player.pos;
          while (k < path.length - 1 && Math.hypot(path[k].x - me.x, path[k].z - me.z) < 0.55) k++;
          const p = path[Math.min(path.length - 1, k + 1)];
          const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz) || 1;
          const cy = g.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
          const last = Math.hypot(goal.x - me.x, goal.z - me.z) < 0.35;
          return { ...input, move: last ? { x: 0, y: 0 } : { x: (dx * rx + dz * rz) / d, y: (dx * fx + dz * fz) / d }, run: true };
        };
        return true;
      }
      return { plan, go, stop, get left() { return path ? path.length - k : 0; }, get path() { return path; } };
    })();
  });

  const S = () => G(() => window.__r.S());
  const step = (sec) => G((s) => window.__r.step(s), sec);
  const holdLoop = (on) => G((on) => { window.__game.debug.game.hold = on; }, on);
  const press = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await page.dispatchEvent(`#${id}`, 'pointerup').catch(() => {}); };
  const hold = (id, on) => page.dispatchEvent(`#${id}`, on ? 'pointerdown' : 'pointerup');
  // steps the game until cond(state) holds (cond may be async); null on a time-out
  async function until(cond, maxSec, what, dt = 0.1) {
    for (let t = 0; t <= maxSec; t += dt) {
      const s = await S();
      if (await cond(s)) return s;
      await step(dt);
    }
    console.log(`  (timed out waiting for ${what})`);
    return null;
  }
  // the lines heard since markNow(): said('text') is true for "speaker: text" or the bare text
  const heard = [];
  let mark = 0;
  const markNow = async () => { mark = await G(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
  const listen = async () => { const { h, said } = await G(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said })); heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark)))); };
  const said = (line, who = null) => heard.some((l) => (who ? l === `${who}: ${line}` : l.endsWith(`: ${line}`) || l === line));
  // taps through whatever is being said until done(state); listens once more after it (a line that starts in that frame)
  const talkThrough = async (done, maxSec, what) => { const r = await until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what); await step(0.1); await listen(); return r; };
  // waits for the prompt with this label (a string or a RegExp) and presses the real interact button
  async function interact(label, maxSec = 6) { const ok = (p) => (label instanceof RegExp ? label.test(p || '') : p === label); const s = await until((s) => ok(s.prompt), maxSec, `the button "${label}"`, 1 / 15); if (!s) return false; await press('btnInteract'); await step(1 / 30); return true; }
  const jump = (p, dx = 0, dz = 0, yaw = null) => G(({ p, dx, dz, yaw }) => { const g = window.__game.debug.game; g.player.place(p.x + dx, p.z + dz, yaw ?? g.player.yaw, p.y); g.follow.snapBehind(g.player.yaw); }, { p, dx, dz, yaw });
  // every move on foot walked there with the stick along a path; a fight, a scene or a fail that starts on the way
  // ends the walk where it is. A leg that cannot be walked is reported by finish() and the player is put there
  const walks = [];
  async function tp(p, dx = 0, dz = 0, yaw = null, { near = 0.7, max = 90 } = {}) {
    const to = { x: p.x + dx, z: p.z + dz, y: p.y, near };
    const from = await G(() => window.__r.pt(window.__game.debug.game.player.pos));
    let res = Math.hypot(from.x - to.x, from.z - to.z) < 0.9 && Math.abs((from.y ?? 0) - (to.y ?? from.y)) < 1 ? 'ok' : (await G((to) => window.__w.go(to), to)) ? 'walking' : 'no path';
    let best = Infinity, still = 0, replans = 0;
    for (let t = 0; res === 'walking' && t < max; t += 0.2) {
      const s = await S(), d = Math.hypot(s.me.x - to.x, s.me.z - to.z);
      if (d < Math.max(1.0, near) && (to.y == null || Math.abs(s.me.y - to.y) < 1.2)) { res = 'ok'; break; }
      if (s.fight || s.cutscene || s.fail) { res = s.fight ? 'a fight' : s.fail ? 'a fail' : 'a scene'; break; }
      const left = await G(() => window.__w.left);
      if (left < best) { best = left; still = 0; } else if ((still += 0.2) > 4) {
        if (replans++ >= 2) { res = `stuck ${d.toFixed(1)} m short at ${s.me.x.toFixed(1)},${s.me.z.toFixed(1)},${s.me.y.toFixed(1)}`; break; }
        best = Infinity; still = 0;
        if (!(await G((to) => window.__w.go(to), to))) { res = 'no path'; break; }
      }
      await step(0.2);
    }
    if (res === 'walking') res = 'too slow';
    await G(() => window.__w.stop());
    walks.push({ to, res });
    if (res !== 'ok' && res !== 'a fight' && res !== 'a scene' && res !== 'a fail') { console.log(`  (could not walk to ${to.x.toFixed(1)},${to.z.toFixed(1)}: ${res})`); await jump(p, dx, dz, yaw); }
    else if (yaw != null) await G((yaw) => { const g = window.__game.debug.game; g.player.yaw = yaw; g.follow.snapBehind(yaw); }, yaw);
    return res;
  }
  const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => v == null || typeof v !== 'object' || Array.isArray(v))) } : null; });
  const visible = (id) => G((id) => !!document.getElementById(id)?.offsetParent, id);
  const markAll = (ids) => G((ids) => { const g = window.__game.debug.game, P = g.paint; let n = 0; for (const x of P.guards) if (!x.marked && x.npc.visible && (!ids || ids.includes(x.npc.id))) { P.markGuard(x, 'test'); n++; } return n; }, ids);
  const shoot = (id) => G((id) => window.__r.shoot(id), id);
  // a paint prop shot for real from `from`: `find` is an expression in the page for the prop (g = the game,
  // W = the world, m = the running mission), e.g. shootProp('g.paint.props[0]', { x, z, y })
  const shootProp = (find, from) => G(({ find, from }) => { const g = window.__game.debug.game; const pr = new Function('g', 'W', 'm', `return (${find});`)(g, window.__game.debug.world, g.missions.active); return pr ? window.__r.shootProp(pr, from) : null; }, { find, from });
  // a picture drawn by the game's own loop (a few frames at real speed), then held again
  async function snap(name, { black = false } = {}) {
    if (!black) await page.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 4000 }).catch(() => {}); // a fade (real time) over first
    await G(() => { window.__game.setTimeScale(1); window.__game.debug.game.hold = false; });
    await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await G((held) => { window.__game.debug.game.hold = held; window.__game.setTimeScale(2); }, held);
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
  // a step's own objective line: waits for the step, then for its text
  const objective = async (stepIdx, re, maxSec = 6) => !!(await until((s) => s.mission?.step === stepIdx && re.test(s.objective), maxSec, `the objective ${re}`));

  // A fist fight played with the buttons: block (held) or shove a wind-up coming at Nehorai, dodge a boss's at the
  // last moment, punch on in a combination, a heavy punch through a block or when one is open, the special when it
  // is charged, an opening's counter when it is offered; the left thumb walks him in (the fight bot's approach, the
  // stick's job only). Until the mission says won or lost (m.s.won / m.s.lost), the step changes, or done(state).
  async function fight(maxSec, what, { boss = false, done = null } = {}) {
    await G(() => window.__game.fightBot({ approach: true }));
    const at = (await S()).mission;
    const over = (s) => !!s.mission && !s.fail && !s.mission.lost && (s.mission.won || s.mission.id !== at?.id || s.mission.step !== at?.step || (done && done(s)));
    let blocking = false, last = null, combos = 0, heavies = 0, interrupts = 0, phases = 0, specials = 0, counters = 0;
    const block = async (on) => { if (on !== blocking) { blocking = on; await hold('btnBlock', on); } };
    const end = async (won, s) => { await block(false); await G(() => window.__game.fightBot(null)); return { won, s, last, combos, heavies, interrupts, phases, specials, counters }; };
    for (let t = 0; t <= maxSec; t += 1 / 30) {
      const s = await S();
      if (s.fail || s.mission?.lost) return end(false, s);
      if (over(s) || (!s.fight && last && t > 1)) return end(over(s), s);
      if (s.fight) {
        last = s; combos = Math.max(combos, s.fight.combos); heavies = Math.max(heavies, s.fight.heavies); interrupts = Math.max(interrupts, s.fight.interrupts);
        for (const o of s.opp) phases = Math.max(phases, o.phase || 0);
        const me = s.me, live = s.opp.filter((o) => !o.down);
        const threat = live.filter((o) => o.mode === 'windup' && o.atMe && o.d < 2.6).sort((a, b) => a.t - b.t)[0];
        const act = me.state === 'idle' || me.state === 'block';
        if (s.fight.opening && me.state === 'idle') { await press('btnPunch'); counters++; }
        else if (threat) {
          if (boss || threat.boss) {
            await block(threat.t < 0.2 && me.st < 18 && me.state !== 'dodge');
            if (act) {
              if (!threat.braced && threat.t > 0.3 && threat.d < 1.8 && me.st >= 8) await press('btnShove');
              else if (threat.t < 0.13 && me.st >= 18) await press('btnDodge');
            }
          } else if (me.state === 'idle' && threat.t > 0.32 && threat.d < 1.8 && me.st >= 8 && !blocking) await press('btnShove');
          else await block(true);
        } else {
          await block(false);
          const o = live.filter((q) => q.d < 2.4 && !q.floored && q.mode !== 'windup').sort((a, b) => a.d - b.d)[0];
          if (o && me.state === 'idle') {
            const open = o.counter > 0 || o.state === 'hit';
            if (await visible('btnSpecial') && (await G(() => { const f = window.__game.debug.game.fight; return !!f && (f.specialReady ?? false); }))) { await press('btnSpecial'); specials++; }
            else if (o.boss) {
              if (s.fight.chain > 0 && me.st >= 12) await press('btnPunch');
              else if (open && me.st >= 44) await press('btnPunch');
              else if (open && me.st >= 26) await press('btnHeavy');
              else if (me.st >= 70) await press('btnHeavy');
            } else if (o.guard > 0.3 && me.st >= 26 && s.fight.chain === 0) await press('btnHeavy');
            else if (s.fight.chain > 0 && me.st >= 12) await press('btnPunch');
            else if (open && me.st >= 26) await press(me.st >= 40 ? 'btnPunch' : 'btnHeavy');
            else if (me.st >= 45) await press('btnPunch');
          }
        }
      }
      await step(1 / 30);
    }
    console.log(`  (timed out in ${what})`);
    return end(false, await S());
  }
  // the guards with these ids marked as soon as they are there (one of them with real paint when asked)
  async function clearGuards(ids, { real = null, wait = 4 } = {}) {
    await until(async () => (await G((ids) => window.__game.debug.game.paint.guards.filter((g) => ids.includes(g.npc.id) && g.npc.visible).length, ids)) > 0, wait, 'the guards');
    let realOk = null;
    if (real) realOk = await shoot(real);
    await markAll(ids);
    return realOk;
  }
  // a reload in the middle of a mission: the page reloaded, "continue" tapped, the harness installed again
  async function reload() {
    await holdLoop(false);
    await G(() => window.__game.debug.game.save());
    await page.reload();
    await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
    await page.tap('#startBtn');
    await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
    await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
    await install();
    await holdLoop(held);
    await markNow();
    return S();
  }

  // ---------- a game saved at the start of `chapter`, with `done` of its missions behind it ----------
  await page.goto(url);
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await G(({ KEY, chapter, done }) => { const g = window.__game.debug.game, p = g.progressForChapter(chapter); p.done.push(...done); p.stash = null; p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, { KEY, chapter, done });
  if (progress) await G(({ KEY, body }) => { const p = JSON.parse(localStorage.getItem(KEY)); new Function('p', body)(p); localStorage.setItem(KEY, JSON.stringify(p)); }, { KEY, body: typeof progress === 'string' ? progress : `(${progress})(p)` });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
  const startScreen = (await text('#startScreen')) || '';
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
  await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
  if (first) await page.waitForFunction((id) => window.__game.debug.game.missions.active?.def.id === id, first, { timeout: 240000 });
  await install();
  await holdLoop(held);
  await markNow();

  // the end of a test: the legs that could not be walked, the page's errors, the count, the exit code
  async function finish({ exit = true, walked = true } = {}) {
    const stuck = walks.filter((w) => !['ok', 'a fight', 'a scene', 'a fail'].includes(w.res));
    if (walked) check(`every leg walked with the stick (${walks.length - stuck.length}/${walks.length})`, stuck.length === 0, stuck.map((w) => `${w.to.x.toFixed(0)},${w.to.z.toFixed(0)}: ${w.res}`).join(' | '));
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed  (${mins()} min)`);
    if (exit) process.exit(failed.length ? 1 : 0);
    return failed.length === 0;
  }

  return { page, browser, ctx, errors, results, check, mins, G, text, S, step, holdLoop, press, hold, until, heard, markNow, listen, said, talkThrough, interact, jump, tp, walks, M, visible, markAll, shoot, shootProp, snap, objective, fight, clearGuards, reload, install, startScreen, finish, shots };
}
