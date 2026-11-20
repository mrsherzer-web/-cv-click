// Chapter nine acceptance test, part four (missions 43–46): the Black Tower floor by floor — Erez's charge and the
// gate blown, the plaza and a jerrycan shot, three marks and a retry, Dolev running in, the lobby's shutter and the
// brawl (FIST COMBAT, won with the real buttons), the alarm turned off and the lockdown lifted, the monitors, the
// card, the server floor's breach with Ido covered, the terminal and the emergency gate, Dolev let out, the stairs on
// fire and the elevator, the corridors and the card reader, the roof's landing lights shot out and the helicopter
// gone, the door that opens; the Shadow (the user's lines, phase one with his guards and the three turrets shot with
// real paint — a turret's mark and a retry —, phase two fists against him alone, phase three with Erez and Ido, his
// escape in the emergency elevator, the computer and how he knew: outside surveillance and Kotzi's old bases, no
// traitor); the escape (05:00 – ESCAPE!, the green route, the beam and the way round, the emergency gate, Avraham
// under a beam, the exit switch, a reload in the middle picked up at its checkpoint, the Renault, the drive and the
// tower going up); and the safe house (the user's lines, the Shadow on the screen, the map, Nehorai up, Erez and Ido
// beside him, the last line, the two cards, chapter nine done). Every leg on foot is walked with the stick along a
// path. The loop is held and stepped at 30 frames a second (the renderer runs at 1–2 fps here), let go only for the
// screenshots. usage: node tests/stage-t.test.mjs [url] [screenshot dir] [first mission: 43..46]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
const FROM = Number(process.argv[4]) || 43;
await mkdir(shots, { recursive: true });
const KEY = 'nehorai-game:save:v1';
const T0 = Date.now();
const mins = () => ((Date.now() - T0) / 60000).toFixed(1);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}  [${mins()} min]`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const text = (sel) => page.textContent(sel);

// ---------- the page: the loop held and stepped from here ----------
async function install() {
  await installWalker();
  await G(() => {
    const D = window.__game.debug, g = D.game, W = D.world;
    g.setPopulation?.({ traffic: 0, people: 0 });
    window.__r = {
      step(sec) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { g.update(1 / 30); W.tick(D.camera, 1 / 30); g.daylight?.update?.(1 / 30); } },
      S() {
        const Fi = g.fight, f = g.fighter, p = g.player.pos, m = g.missions.active;
        const flat = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v == null || typeof v !== 'object'));
        return {
          me: { hp: f.hp, st: f.stamina, state: f.state, x: p.x, z: p.z, y: p.y, taken: f.taken },
          fight: Fi && !Fi.over ? { chain: Fi.chain, combos: Fi.combos, heavies: Fi.heavies, interrupts: Fi.interrupts } : null,
          opp: Fi ? Fi.opponents.map((o) => ({ id: o.npc.id, mode: o.mode, t: o.t, d: Math.hypot(o.npc.pos.x - p.x, o.npc.pos.z - p.z), atMe: o.against === f, counter: o.fighter.counter, state: o.fighter.state, down: o.fighter.down, floored: o.fighter.floored, braced: o.fighter.braced, guard: o.guard, boss: o.boss, hp: o.fighter.hp, phase: o.phase })) : [],
          mission: m ? { id: m.def.id, step: m.stepIndex, s: flat(m.s), won: !!m.s.won, lost: !!m.s.lost } : null,
          prompt: g.prompt?.label ?? null, dialogue: g.dialogue.busy, cutscene: !!g.cutscene, hold: !!g.hold, mode: g.mode,
          objective: document.getElementById('objText')?.textContent || '',
          pill: document.getElementById('pursuit')?.textContent || '',
          fail: !g.hud.el.fail.hidden, hits: g.paint.hits,
        };
      },
      pt: (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw },
      T: (lx, lz, k = 0) => { const t = W.places.tower, p = t.toWorld(lx, lz); return { x: p.x, z: p.z, y: t.floorY(k) }; },
      // the player's marker fired at a guard for real (Nehorai close and facing him), the loop let go for each shot
      shoot(id) {
        const P = g.paint, gd = P.guards.find((x) => x.npc.id === id); if (!gd || gd.marked) return !!gd?.marked;
        const n = gd.npc, me = g.player.pos, dx = me.x - n.pos.x, dz = me.z - n.pos.z, d = Math.hypot(dx, dz) || 1;
        g.player.place(n.pos.x + dx / d * 5, n.pos.z + dz / d * 5, 0, n.pos.y); g.player.yaw = Math.atan2(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z);
        for (let k = 0; k < 16 && !gd.marked; k++) { g.hold = false; P.lock = gd; P.fire(); g.hold = true; window.__r.step(0.15); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
        return gd.marked;
      },
      // a thing that is not a person (a sensor, a jerrycan, a landing light) shot for real from `from`
      shootProp(pr, from) {
        const P = g.paint;
        g.player.place(from.x, from.z, 0, from.y); g.player.yaw = Math.atan2(pr.x - from.x, pr.z - from.z); P.lock = null;
        for (let i = 0; i < 10 && !pr.done; i++) { g.hold = false; P.lock = null; P.fire(); g.hold = true; window.__r.step(0.2); g.player.yaw = Math.atan2(pr.x - g.player.pos.x, pr.z - g.player.pos.z); if (P.player.ammo <= 0) { P.player.ammo = 8; P.player.reloading = 0; } }
        return pr.done;
      },
    };
  });
}
// the left thumb, for the test: a path over a half-metre grid at the walker's own height (walls, doors and
// machines are solid), walked with the stick
const installWalker = () => G(() => { window.__w = (() => {
  const g = window.__game.debug.game, W = window.__game.debug.world, cols = W.cols, S = 0.5, R = 0.36;
  let path = null, k = 0, goal = null;
  const pos = { x: 0, y: 0, z: 0 };
  function plan(to, margin = 26) {
    const me = g.player.pos;
    const x0 = Math.min(me.x, to.x) - margin, z0 = Math.min(me.z, to.z) - margin, x1 = Math.max(me.x, to.x) + margin, z1 = Math.max(me.z, to.z) + margin;
    const nx = Math.round((x1 - x0) / S) + 1, nz = Math.round((z1 - z0) / S) + 1;
    const key = (i, j, y) => (i * nz + j) * 40 + Math.max(0, Math.min(39, Math.round((y + 60) / 1.25)));
    const free = new Map();
    const isFree = (i, j, y) => {
      const kk = key(i, j, y); if (free.has(kk)) return free.get(kk);
      const x = x0 + i * S, z = z0 + j * S; pos.x = x; pos.y = y; pos.z = z;
      const hit = cols.resolve(pos, R, y, g.car) && cols.hitHard && Math.hypot(pos.x - x, pos.z - z) > 0.02;
      free.set(kk, !hit); return !hit;
    };
    const si = Math.round((me.x - x0) / S), sj = Math.round((me.z - z0) / S), sy = W.groundHeight(x0 + si * S, z0 + sj * S, me.y);
    const prev = new Map(), ys = new Map(), q = [[si, sj, sy]];
    const s0 = key(si, sj, sy); prev.set(s0, -1); ys.set(s0, sy);
    const ty = to.y ?? W.groundHeight(to.x, to.z, me.y);
    let found = null;
    for (let h = 0; h < q.length; h++) {
      const [i, j, y] = q[h], kk = key(i, j, y);
      const x = x0 + i * S, z = z0 + j * S;
      if (Math.hypot(x - to.x, z - to.z) < (to.near ?? 0.6) && Math.abs(y - ty) < 1.2) { found = kk; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const y2 = W.groundHeight(x0 + a * S, z0 + b * S, y);
        if (Math.abs(y2 - y) > 0.9) continue;
        const k2 = key(a, b, y2); if (prev.has(k2)) continue;
        if (!isFree(a, b, y2)) continue;
        if (di && dj && (!isFree(i + di, j, y) || !isFree(i, j + dj, y))) continue;
        prev.set(k2, kk); ys.set(k2, y2); q.push([a, b, y2]);
      }
    }
    if (found === null) return null;
    const out = [];
    for (let c = found; c !== -1; c = prev.get(c)) { const ij = Math.floor(c / 40), i = Math.floor(ij / nz), j = ij % nz; out.push({ x: x0 + i * S, z: z0 + j * S, y: ys.get(c) }); }
    out.reverse();
    return out;
  }
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
  function stop() { g.botInput = null; path = null; }
  return { plan, go, stop, get left() { return path ? path.length - k : 0; }, get path() { return path; } };
})(); });
const S = () => G(() => window.__r.S());
const step = (sec) => G((s) => window.__r.step(s), sec);
const holdLoop = (on) => G((on) => { window.__game.debug.game.hold = on; }, on);
const press = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await page.dispatchEvent(`#${id}`, 'pointerup').catch(() => {}); };
const hold = (id, on) => page.dispatchEvent(`#${id}`, on ? 'pointerdown' : 'pointerup');
async function until(cond, maxSec, what, dt = 0.1) {
  for (let t = 0; t <= maxSec; t += dt) {
    const s = await S();
    if (await cond(s)) return s;
    await step(dt);
  }
  console.log(`  (timed out waiting for ${what})`);
  return null;
}
const heard = [];
let mark = 0;
const markNow = async () => { mark = await G(() => window.__game.debug.game.dialogue.said); heard.length = 0; };
const listen = async () => { const { h, said } = await G(() => ({ h: window.__game.debug.game.dialogue.history, said: window.__game.debug.game.dialogue.said })); heard.splice(0, heard.length, ...h.slice(Math.max(0, h.length - (said - mark)))); };
const said = (line) => heard.some((l) => l.endsWith(`: ${line}`) || l === line);
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
async function interact(label, maxSec = 6) { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`, 1 / 15); if (!s) return false; await press('btnInteract'); await step(1 / 30); return true; }
const jump = (p, dx = 0, dz = 0, yaw = null) => G(({ p, dx, dz, yaw }) => { const g = window.__game.debug.game; g.player.place(p.x + dx, p.z + dz, yaw ?? g.player.yaw, p.y); g.follow.snapBehind(g.player.yaw); }, { p, dx, dz, yaw });
// every move on foot walked there with the stick along a path; a fight or a scene that starts on the way ends the
// walk where it is. A leg that cannot be walked is reported at the end and the player is put there
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
const T = (lx, lz, k = 0) => G(({ lx, lz, k }) => window.__r.T(lx, lz, k), { lx, lz, k });
const visible = (id) => G((id) => !!document.getElementById(id)?.offsetParent, id);
const markAll = (ids) => G((ids) => { const g = window.__game.debug.game, P = g.paint; let n = 0; for (const x of P.guards) if (!x.marked && x.npc.visible && (!ids || ids.includes(x.npc.id))) { P.markGuard(x, 'test'); n++; } return n; }, ids);
const shoot = (id) => G((id) => window.__r.shoot(id), id);
// a picture drawn by the game's own loop (a few frames at real speed), then held again
async function snap(name, { black = false } = {}) {
  if (!black) await page.waitForFunction(() => !document.getElementById('fade').classList.contains('on'), null, { timeout: 4000 }).catch(() => {}); // a fade (real time) over first
  await G(() => { window.__game.setTimeScale(1); window.__game.debug.game.hold = false; });
  await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await G(() => { window.__game.debug.game.hold = true; window.__game.setTimeScale(2); });
  await page.screenshot({ path: `${shots}/${name}.png` });
}
// a step's own objective line: waits for the step, then for its text
const objective = async (stepIdx, re, maxSec = 6) => !!(await until((s) => s.mission?.step === stepIdx && re.test(s.objective), maxSec, `the objective ${re}`));

// A fist fight played with the buttons (as stage-r): block (held) or shove a wind-up coming at Nehorai, dodge a
// boss's at the last moment, punch on in a combination, a heavy punch through a guard's block or when one is open;
// the left thumb walks him in (the fight bot's approach, the stick's job only). Until the mission says won or lost.
async function fight(maxSec, what, { boss = false, done = null } = {}) {
  await G(() => window.__game.fightBot({ approach: true }));
  const at = (await S()).mission;
  const over = (s) => !!s.mission && !s.fail && !s.mission.lost && (s.mission.won || s.mission.id !== at?.id || s.mission.step !== at?.step || (done && done(s)));
  let blocking = false, last = null, combos = 0, heavies = 0, interrupts = 0, phases = 0;
  const block = async (on) => { if (on !== blocking) { blocking = on; await hold('btnBlock', on); } };
  for (let t = 0; t <= maxSec; t += 1 / 30) {
    const s = await S();
    if (s.fail || s.mission?.lost) { await block(false); await G(() => window.__game.fightBot(null)); return { won: false, s, last, combos, heavies, interrupts, phases }; }
    if (over(s) || (!s.fight && last && t > 1)) { await block(false); await G(() => window.__game.fightBot(null)); return { won: over(s), s, last, combos, heavies, interrupts, phases }; }
    if (s.fight) {
      last = s; combos = Math.max(combos, s.fight.combos); heavies = Math.max(heavies, s.fight.heavies); interrupts = Math.max(interrupts, s.fight.interrupts);
      for (const o of s.opp) phases = Math.max(phases, o.phase || 0);
      const me = s.me, live = s.opp.filter((o) => !o.down);
      const threat = live.filter((o) => o.mode === 'windup' && o.atMe && o.d < 2.6).sort((a, b) => a.t - b.t)[0];
      const act = me.state === 'idle' || me.state === 'block';
      if (threat) {
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
          if (o.boss) {
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
  await block(false); await G(() => window.__game.fightBot(null));
  console.log(`  (timed out in ${what})`);
  return { won: false, s: await S(), last, combos, heavies, interrupts, phases };
}
// the guards of a floor marked as soon as they are on it (one of them with real paint when asked)
async function clearFloor(ids, { real = null, wait = 4 } = {}) {
  await until(async () => (await G((ids) => window.__game.debug.game.paint.guards.filter((g) => ids.includes(g.npc.id) && g.npc.visible).length, ids)) > 0, wait, 'the guards');
  let realOk = null;
  if (real) realOk = await shoot(real);
  await markAll(ids);
  return realOk;
}

// ---------- a game saved after mission 42 (or later, from the argument) ----------
const CH9 = ['phoenix', 'deathroad', 'blackport', 'stolen', 'barehands', 'armory', 'portwar', 'wounded', 'comeback', 'blacktower', 'shadow', 'meltdown', 'together'];
const FIRST = { 43: 'blacktower', 44: 'shadow', 45: 'meltdown', 46: 'together' }[FROM];
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(({ KEY, done }) => { const g = window.__game.debug.game, p = g.progressForChapter(9); p.done.push(...done); p.stash = null; p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, { KEY, done: CH9.slice(0, CH9.indexOf(FIRST)) });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
await page.waitForFunction((id) => window.__game.debug.game.missions.active?.def.id === id, FIRST, { timeout: 240000 });
await install();
await holdLoop(true);
await markNow();
const P = await G(() => {
  const t = window.__game.debug.world.places.tower, f = window.__game.debug.world.places.facility, h = window.__game.debug.world.places.safehouse, pt = window.__r.pt, T = window.__r.T;
  return {
    t: { x: t.x, z: t.z, y: t.y, approach: pt(t.approach), gateOutside: pt(t.gateOutside), gateInside: pt(t.gateInside), lobbyIn: pt(t.lobby.inside), lobbyOut: pt(t.lobby.outside), stairs: t.stairs.map((s) => ({ bottom: pt(s.bottom), top: pt(s.top), foot: pt(s.foot) })), alarmAt: pt(t.alarmAt), card: pt(t.card.pickAt), cover: pt(t.breach.cover), terminal: T(12, -6.6, 2), trappedAt: pt(t.trapped.at), front: t.elevator.front.map(pt), readerAt: pt(t.command.readerAt), roofAt: pt(t.roof.at), deck: T(6, 2, 5), doorAt: pt(t.command.doorAt), inside: pt(t.command.inside), computer: pt(t.command.computer), escapeAt: pt(t.command.escapeAt), route: t.escape.route.map(pt), gateAt: pt(t.escape.gateAt), fallenAt: pt(t.escape.fallenAt), switch: pt(t.escape.switch), car: pt(t.escape.car), drive: t.escape.drive.map(pt) },
    exit: pt(f.exit.outside),
    h: { x: h.x, z: h.z, y: h.y, stand: pt(h.seats[0].stand), outside: pt(h.outside) },
  };
});
let s, r;

// ===================================================== mission 43 =====================================================
if (FROM <= 43) {
  s = await S();
  check('"ההסתערות על המגדל השחור" follows on by itself, by the facility\'s exit, the gang armed round Nehorai', s.mission?.id === 'blacktower' && (await G(() => { const g = window.__game.debug.game; return g.squad.active && g.squad.ids.length === 8 && g.paint.armed && g.paint.allies.length === 8 && !g.paint.stashed; })));
  check('Nehorai\'s bandage on his head', await G(() => !!window.__game.debug.game.nehorai.bones.head.getObjectByName('bandage')));
  s = await talkThrough((s) => s.mission?.step === 1, 40, 'the intro');
  check('the tower over them: "קומה אחרי קומה"', !!s && said('אז עולים קומה אחרי קומה. ביחד.'));
  await snap('t1-tower');
  check('step 1 on the objective line: the gate, Erez\'s charge', await objective(1, /השער/));
  // ---- the gate: two of the Order along the outside of the fence at Erez; his charge, back out of the ring, the blast
  const gate = await G(() => { const g = window.__game.debug.game, t = window.__game.debug.world.places.tower, ids = ['og13', 'og14']; return g.paint.guards.filter((x) => ids.includes(x.npc.id) && x.npc.visible && (x.marked || x.alerted) && x.npc.pos.x < t.gate.pos.x).length; });
  await tp(P.t.gateOutside, -1.2, -2);
  const realGate = await clearFloor(['og13', 'og14'], { real: 'og13' });
  check('cover Erez: two of the Order come at him along the outside of the fence, marked (one with real paint)', gate === 2 && realGate === true, `${gate} coming`);
  s = await until(async () => (await M())?.s.phase === 'back', 40, 'Erez\'s charge');
  check('Erez puts a charge on the gate (a job), then "כולם אחורה!": a ring and beeps', !!s && (await G(() => window.__game.debug.game.missions.active.live.some((b) => b.ring && !b.done))));
  await tp(P.t.approach, -8, 0);
  s = await until((s) => s.mission?.step === 2, 15, 'the blast');
  check('the blast: the gate blown out of its rails, Nehorai outside the ring unmarked', !!s && (await G(() => { const t = window.__game.debug.world.places.tower; return t.gate.open && !t.gate.visible && window.__game.debug.game.paint.hits === 0; })));
  check('step 2: the plaza, mark the Order', await objective(2, /הרחבה/));
  // ---- the plaza: a guard marked with real paint, a jerrycan shot, three marks and a retry
  await tp(P.t.gateInside, -1, 0);
  const real = await clearFloor(['og1'], { real: 'og1' });
  check('a guard marked with real paint (aim, fire)', real === true);
  const can = await G(() => { const g = window.__game.debug.game, m = g.missions.active, c = m.cans?.[0]; if (!c) return null; const v = c.v, from = { x: v.x - Math.cos(v.yaw) * -6, z: v.z + Math.sin(v.yaw) * -6, y: v.y }; return { ok: window.__r.shootProp(c.prop, { x: c.prop.x + Math.cos(v.yaw) * 6, z: c.prop.z - Math.sin(v.yaw) * 6, y: v.y }), from }; });
  s = await until(async () => G(() => window.__game.debug.world.places.tower.cars[0].wrecked), 6, 'the car going up');
  check('a jerrycan on a car shot twice: the warning, the car goes up', !!can?.ok && !!s);
  await G(() => { window.__game.debug.game.paint.hits = 3; });
  s = await until((s) => s.fail, 5, 'the fail screen');
  check('three marks: the fail screen, with the reason and a tip', !!s && /סומן שלוש פעמים/.test(await text('#failReason')) && /מאחורי/.test(await text('#failReason')));
  await page.tap('#retryBtn');
  await holdLoop(true);
  s = await until((s) => s.mission?.step === 2 && s.hits === 0, 10, 'the retry');
  check('retry: back at the plaza\'s checkpoint, marks cleared, the guards up again', !!s && (await G(() => window.__game.debug.game.paint.guards.filter((g) => !g.marked && g.npc.visible).length)) === 8);
  await clearFloor(['og1', 'og2', 'og3', 'og4', 'og5', 'og6', 'og7', 'og8']);
  await markNow();
  s = await talkThrough((s) => s.mission?.step === 3, 20, 'the lobby');
  check('the plaza clear: "הלובי · אחרי דולב" — Dolev runs into the tower', !!s && (await objective(3, /הלובי/)));
  s = await talkThrough(() => said('דולב! חכה לנו!'), 15, 'Dolev');
  check('Dolev: "אחד בורח לתוך המגדל! אני אחריו!"', !!s && said('אחד בורח לתוך המגדל! אני אחריו!'));
  // ---- the lobby: the shutter, the brawl
  await tp(P.t.lobbyIn);
  s = await talkThrough((s) => !!s.fight, 40, 'the brawl');
  check('in the lobby: the shutter comes down, four of them without markers — "אז בידיים"', !!s && said('נעילה כללית. כל הדלתות ננעלות.') && said('ולפי החוקים, לא יורים במי שאין לו מרקר.') && (await G(() => window.__game.debug.world.places.tower.lobby.door.locked)));
  check('FIST COMBAT: punch, heavy, shove, block and dodge on screen, no fire button', /FIST COMBAT/.test(await text('#banner')) && (await visible('btnHeavy')) && (await visible('btnShove')) && (await visible('btnPunch')) && (await visible('btnBlock')) && (await visible('btnDodge')) && !(await visible('btnFire')));
  await snap('t2-brawl');
  r = await fight(180, 'the brawl');
  check('the brawl won with the buttons (Erez and Ido punching too)', r.won, `combos ${r.combos} · heavies ${r.heavies} · shoves ${r.interrupts}`);
  s = await until((s) => s.mission?.step === 4, 10, 'the security floor');
  check('the four beaten sit where they went down, in nobody\'s way', await G(() => ['og9', 'og10', 'og11', 'og12'].every((id) => !window.__game.debug.game.npc(id).body.enabled)));
  s = await until((s) => s.mission?.step === 4, 10, 'the security floor');
  check('the marker back in his hands; step 4: the security floor, the alarm', !!s && (await G(() => window.__game.debug.game.paint.armed)) && (await objective(4, /האבטחה|האזעקה/)));
  // ---- the security floor: the alarm
  await tp(P.t.stairs[0].bottom);
  await tp(P.t.stairs[0].top, 0, -1.2);
  s = await until(async () => (await M())?.s.posted, 6, 'the floor');
  check('up the east stairs: the security floor in red light, the siren, its guards', !!s && (await G(() => window.__game.debug.game.fx.redAlertOn)));
  await clearFloor(['og13', 'og14', 'og15', 'og16'], { real: 'og13' });
  await tp(P.t.alarmAt);
  check('"לנטרל את האזעקה"', await interact('לנטרל את האזעקה'));
  await markNow();
  s = await until((s) => s.mission?.step === 5, 12, 'the alarm off');
  check('the alarm off: the red light gone, the lobby\'s shutter up again', !!s && (await G(() => { const t = window.__game.debug.world.places.tower; return !t.alarm.on && t.lobby.door.open && !t.lobby.door.locked; })));
  s = await talkThrough((s) => !s.cutscene && s.mission?.step === 5, 40, 'the monitors');
  check('the monitors: "זה דולב! סגור במחסן, בקומה השלישית."', !!s && said('רגע… מצלמה שבע. זה דולב! סגור במחסן, בקומה השלישית.'));
  await clearFloor(['og1']);
  await tp(P.t.card);
  check('the card in the security office: "לקחת את הכרטיס"', await interact('לקחת את הכרטיס'));
  s = await until((s) => s.mission?.step === 6, 8, 'the server floor');
  check('the card taken; step 6: the server floor, cover Ido', !!s && (await G(() => window.__game.debug.world.places.tower.card.taken)) && (await objective(6, /השרתים/)));
  // ---- the server floor: the breach
  await tp(P.t.stairs[1].bottom);
  await tp(P.t.stairs[1].top, 0, -1.2);
  await clearFloor(['og3', 'og4', 'og5']);
  await tp(P.t.cover);
  s = await until(async () => (await M())?.s.wave >= 1, 40, 'the first wave');
  check('the emergency gate shut; Ido at server room C\'s door (a job), the Order up the corridor', !!s && (await G(() => window.__game.debug.world.places.tower.escape.gate.locked)));
  // the waves marked as they come (the player defending)
  s = await until(async () => { await markAll(['og6', 'og7', 'og8', 'og9']); return (await M())?.s.breached; }, 40, 'the breach');
  check('the breach done with Ido covered: room C open', !!s && (await G(() => window.__game.debug.world.places.tower.breach.door.open)));
  s = await until(async (s) => { await markAll(['og6', 'og7', 'og8', 'og9']); return s.mission?.step === 7; }, 6, 'the terminal');
  check('step 7 only with the last of them marked: nobody of the second wave marked by the script', !!s && (await G(() => window.__game.debug.game.paint.guards.filter((g) => ['og6', 'og7', 'og8', 'og9'].includes(g.npc.id)).every((g) => g.marked && g.markedBy !== 'restore'))));
  await tp(P.t.terminal);
  check('the terminal: "לפתוח את שער החירום"', await interact('לפתוח את שער החירום'));
  s = await until(() => G(() => window.__game.debug.world.places.tower.escape.gate.open), 6, 'the gate');
  check('the emergency gate opens', !!s);
  await tp(P.t.stairs[2].bottom);
  await tp(P.t.stairs[2].top, 0, -1.2);
  s = await until((s) => s.mission?.step === 8, 6, 'the storage floor');
  check('up the east stairs: step 8, the storage floor, Dolev', !!s && (await objective(8, /המחסנים|דולב/)));
  // ---- the storage floor: Dolev
  await clearFloor(['og10', 'og11', 'og12', 'og13', 'og14']);
  await markNow();
  await tp(P.t.trappedAt);
  check('"לפרוץ את דלת המחסן"', await interact('לפרוץ את דלת המחסן'));
  s = await talkThrough(() => said('למה זה תמיד אני?!'), 20, 'Dolev out');
  check('Dolev out: "למה זה תמיד אני?!" — back with the gang', !!s && (await G(() => window.__game.debug.game.squad.ids.includes('dolev'))));
  s = await talkThrough((s) => s.mission?.step === 9, 20, 'the next step');
  // ---- the stairs on fire, the elevator
  s = await talkThrough((s) => s.mission?.s.phase === 'lift' && !s.cutscene, 30, 'the fire');
  check('the stairs to the command floor go up in a blast: "המדרגות בוערות" — to the elevator', !!s && said('המדרגות לקומת הפיקוד בוערות!'));
  await tp(P.t.front[3]);
  check('"להזעיק את המעלית"', await interact('להזעיק את המעלית'));
  s = await until(async () => (await M())?.s.phase === 'ambush', 8, 'the ambush');
  check('the doors open: two of them inside', !!s);
  await clearFloor(['og15', 'og16']);
  check('"לעלות לקומת הפיקוד"', await interact('לעלות לקומת הפיקוד'));
  s = await until((s) => s.mission?.step === 10, 20, 'the command floor');
  check('the elevator up: on the command floor with the gang, every one of them on that floor inside the tower', !!s && (await G((y) => { const g = window.__game.debug.game, t = window.__game.debug.world.places.tower; return Math.abs(g.player.pos.y - y) < 0.5 && g.squad.ids.every((id) => { const n = g.npc(id); return Math.abs(n.pos.y - y) < 0.6 && t.inTower(n.pos.x, n.pos.z); }); }, P.t.front[4].y)));
  // ---- the corridors, the reader
  await clearFloor(['og1', 'og2', 'og3', 'og4']);
  await markNow();
  await tp(P.t.readerAt);
  check('"להעביר את הכרטיס"', await interact('להעביר את הכרטיס'));
  s = await talkThrough((s) => s.mission?.step === 11, 40, 'the roof');
  check('the reader green, the door shut: the Shadow on the speaker, a helicopter — "אז ניקח לו את הגג."', !!s && said('אז ניקח לו את הגג.') && (await G(() => !!window.__game.debug.game.missions.active.heli)));
  // ---- the roof
  await markNow();
  await tp(P.t.stairs[4].bottom);
  await tp(P.t.roofAt);
  await clearFloor(['og5', 'og6', 'og7', 'og8']);
  for (let k = 0; k < 4; k++) {
    const ok = await G((k) => { const g = window.__game.debug.game, m = g.missions.active, L = m.lights?.[k]; if (!L) return false; const pad = window.__game.debug.world.places.tower.roof.helipad, dx = L.prop.x - pad.x, dz = L.prop.z - pad.z, l = Math.hypot(dx, dz) || 1; g.paint.hits = 0; return window.__r.shootProp(L.prop, { x: L.prop.x - dx / l * 5, z: L.prop.z - dz / l * 5, y: L.prop.y - 0.55 }); }, k);
    check(`landing light ${k + 1} shot out with paint`, ok);
  }
  await snap('t3-roof');
  s = await talkThrough((s) => s.mission?.step === 12, 40, 'the helicopter away');
  check('the lights out: the helicopter turns away — "אין לך יותר מסוק, צל."', !!s && said('אין לך יותר מסוק, צל.'), `step ${s?.mission?.step} · ${heard.slice(-5).join(' / ')}`);
  // ---- back to the door
  await tp(P.t.stairs[4].top, 0, 1);
  await tp(P.t.doorAt);
  await markNow();
  s = await talkThrough((s) => s.mission?.id === 'shadow', 40, 'the Shadow');
  check('the command room\'s door opens by itself: "אז בוא, נהוראי. אני מחכה לך." — mission 43 done, 44 begins', !!s && said('אז בוא, נהוראי. אני מחכה לך.') && (await G(() => window.__game.debug.game.progress.done.includes('blacktower'))));
}

// ===================================================== mission 44 =====================================================
if (FROM <= 44) {
  s = await talkThrough((s) => s.mission?.id === 'shadow' && s.mission.step === 1, 60, 'the meeting');
  check('the door shuts behind him; the Shadow by the window: "נגמר לך המשחק." / "אתה חושב שאתה גיבור? אתה אפילו לא יודע כמה קרוב היית להפסיד."', !!s && said('נגמר לך המשחק.') && said('אתה חושב שאתה גיבור? אתה אפילו לא יודע כמה קרוב היית להפסיד.') && (await G(() => window.__game.debug.world.places.tower.command.door.locked)));
  check('phase 1 on the objective line: his guards and the defences', await objective(1, /שלב 1/));
  await snap('t4-phase1');
  // a turret: in its line long enough, it marks
  const marked = await G(() => {
    const g = window.__game.debug.game, m = g.missions.active, tu = m.turrets[2];
    for (const gd of g.paint.guards) if (!gd.marked && ['og9', 'og10'].includes(gd.npc.id)) g.paint.markGuard(gd, 'test'); // (the turrets alone at him: their guards are back on the retry)
    g.player.place(tu.at.x, tu.at.z - 8, 0, tu.at.y); g.paint.hits = 0;
    // online first (it boots for a few seconds), then a whole sweep of its line each way and the aim; its first
    // shots can miss
    for (let i = 0; i < 30 * 8 && tu.boot > 0; i++) window.__r.step(1 / 30);
    for (let i = 0; i < 30 * 24 && g.paint.hits === 0; i++) { g.player.place(tu.at.x, tu.at.z - 8, 0, tu.at.y); window.__r.step(1 / 30); }
    return { hits: g.paint.hits, shots: m.turrets.reduce((a, t) => a + t.shots, 0), boot: +tu.boot.toFixed(2) };
  });
  check('a turret\'s red line on him: it follows, then fires — a mark', marked.hits >= 1 && marked.shots >= 1, JSON.stringify(marked));
  await G(() => { window.__game.debug.game.paint.hits = 3; });
  s = await until((s) => s.fail, 5, 'the fail');
  check('three marks in phase 1: the fail screen with a tip', !!s && /סומן שלוש פעמים/.test(await text('#failReason')));
  await page.tap('#retryBtn');
  await holdLoop(true);
  s = await until((s) => s.mission?.step === 1 && s.hits === 0, 10, 'the retry');
  check('retry: phase 1 again, three turrets live, the shield up', !!s && (await G(() => { const m = window.__game.debug.game.missions.active; return m.turrets.length === 3 && m.turrets.every((t) => !t.dead) && !!m.shield; })));
  await clearFloor(['og9', 'og10']);
  // each turret's sensor shot from its blind side
  for (let k = 0; k < 3; k++) {
    const ok = await G((k) => {
      const g = window.__game.debug.game, m = g.missions.active, tu = m.turrets[k], T = window.__r.T;
      const from = [T(-12.5, 1.6, 4), T(12.5, 1.6, 4), T(-11.5, 17.2, 4)][k];
      g.paint.hits = 0;
      return window.__r.shootProp(tu.prop, from);
    }, k);
    check(`turret ${k + 1}: its sensor shot twice from the side it cannot see`, ok);
  }
  s = await until((s) => s.mission?.step === 2, 8, 'phase 2');
  check('guards down and turrets dead: the shield drops — phase 2', !!s);
  await markNow();
  s = await talkThrough((s) => !!s.fight, 40, 'the fists');
  check('"צבע זה לילדים, נהוראי. בוא נראה אותך בלי הרובה." — fists, face to face, the boss bar', !!s && said('צבע זה לילדים, נהוראי. בוא נראה אותך בלי הרובה.') && (await G(() => !document.getElementById('bossBar')?.hidden)) && !(await G(() => window.__game.debug.game.paint.armed)));
  await snap('t5-phase2');
  r = await fight(300, 'phase 2', { boss: true, done: (s) => s.mission?.s?.half });
  check('phase 2 won with the buttons: half his strength gone (heavy punches, shoves)', r.won, `combos ${r.combos} · heavies ${r.heavies} · shoves ${r.interrupts}`);
  await markNow();
  s = await talkThrough((s) => s.mission?.step === 3 && !!s.fight, 60, 'phase 3');
  check('phase 3: the door gives, "חשבת שנשאיר אותך לבד איתו?", two bodyguards out of his lift', !!s && said('חשבת שנשאיר אותך לבד איתו?') && s.opp.length === 3);
  await snap('t6-phase3');
  r = await fight(360, 'phase 3', { boss: true });
  check('the last fight won with the buttons, Erez and Ido beside him: the Shadow down', r.won, `combos ${r.combos} · heavies ${r.heavies} · shoves ${r.interrupts}`);
  await markNow();
  s = await talkThrough((s) => s.mission?.step === 5, 60, 'the escape');
  check('he gets away in the emergency elevator: "אבל לכל מגדל יש דלת אחורית." — the door shut and locked, he is gone', !!s && said('אבל לכל מגדל יש דלת אחורית.') && (await G(() => { const g = window.__game.debug.game; return !g.npc('shadow').visible && window.__game.debug.world.places.tower.command.escapeDoor.locked; })));
  check('step 5: the computer he left', await objective(5, /המחשב/));
  await tp(P.t.computer);
  await markNow();
  check('"לבדוק את המחשב"', await interact('לבדוק את המחשב'));
  s = await talkThrough((s) => s.mission?.id === 'meltdown', 80, 'the data');
  check('how he knew: outside surveillance, Kotzi\'s old bases — "אין בוגדים בחבורה."', said('תראו את זה. מצלמות מעקב חיצוניות — הכבישים, הנמל, אפילו הדרך לבית המסתור. ככה הוא ידע עלינו.') && said('כל מה שקוצי אסף עלינו נשאר בבסיסים הישנים שלו. הצל פשוט מצא את זה.') && said('אף פעם, אחי. אין בוגדים בחבורה.'));
  check('the data on the Order\'s other facilities copied; mission 44 done, 45 begins', !!s && said('ויש פה עוד: מתקנים נוספים של המסדר השחור. חמישה. אני מעתיק הכול.') && (await G(() => window.__game.debug.game.progress.done.includes('shadow'))));
}

// ===================================================== mission 45 =====================================================
if (FROM <= 45) {
  await markNow();
  s = await talkThrough((s) => s.mission?.id === 'meltdown' && s.mission.step === 1, 40, 'the self-destruct');
  check('the self-destruct: "05:00 – ESCAPE!" on the screen, the clock on the pill', !!s && /05:00 – ESCAPE!/.test(await text('#banner')) && /\d\d:\d\d – ESCAPE!/.test(s.pill), s?.pill);
  check('the route marked in green, red light on every floor', await G(() => window.__game.debug.world.places.tower.escape.marked && window.__game.debug.game.fx.redAlertOn));
  await snap('t7-escape');
  const R = P.t.route;
  // floor 4 down to 3
  for (const i of [3, 4, 5, 6, 7]) await tp(R[i]);
  s = await until((s) => s.mission?.step === 2, 6, 'the storage floor');
  check('down the west stairs: step 2, the storage floor', !!s && (await objective(2, /המחסנים/)));
  await tp(R[8]); await tp(R[9]);
  await tp(await T(-8, -13.6, 3));
  s = await until(async () => (await M())?.s.beam, 8, 'the beam');
  check('a beam comes down across the hall (after its ring): "המסדרון חסום! דרך המדפים!" — the way round marked', !!s && (await G(() => !!window.__game.debug.game.missions.active.detour)));
  for (const [lx, lz] of [[-3, -13.4], [-3, -10.2], [3, -10.2], [3, -13.4]]) await tp(await T(lx, lz, 3));
  check('round the beam through the shelves', (await M())?.s.round === true);
  await tp(R[10]); await tp(R[11]); await tp(R[12]);
  s = await until((s) => s.mission?.step === 3, 6, 'the server floor');
  check('step 3: the server floor', !!s);
  await tp(R[13]); await tp(R[14], -4, 0);
  s = await until(async () => (await M())?.s.gateShut === 'shut', 6, 'the gate');
  check('the emergency gate slams shut ahead of them', !!s && (await G(() => window.__game.debug.world.places.tower.escape.gate.locked)));
  // a reload here: the save is at this checkpoint, "continue" picks it up
  {
    const before = await G(() => JSON.parse(localStorage.getItem('nehorai-game:save:v1') || 'null')?.resume);
    await page.reload();
    await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
    await page.tap('#startBtn');
    await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
    await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
    await install(); await holdLoop(true);
    s = await S();
    check('a reload at the server floor: "continue" picks it up at the checkpoint, the clock still running', before?.id === 'meltdown' && before?.checkpoint === 3 && s.mission?.id === 'meltdown' && s.mission.step === 3 && /ESCAPE/.test(s.pill), `${JSON.stringify(before)} · ${s.pill}`);
    await tp(R[13]); await tp(R[14], -4, 0);
    s = await until(async () => (await M())?.s.gateShut === 'shut', 6, 'the gate');
  }
  await tp(P.t.gateAt);
  await markNow();
  check('"לפתוח את שער החירום" (the manual release)', await interact('לפתוח את שער החירום'));
  s = await until(() => G(() => window.__game.debug.world.places.tower.escape.gate.open), 8, 'the gate open');
  check('the gate open again', !!s);
  for (const i of [15, 16, 17, 18]) await tp(R[i]);
  s = await until((s) => s.mission?.step === 4, 6, 'the security floor');
  check('step 4: the security floor', !!s);
  await tp(R[19]); await tp(R[20]);
  await markNow();
  s = await talkThrough(async () => !!(await G(() => window.__game.debug.game.missions.active?.pinned)), 10, 'Avraham');
  check('a beam down on Avraham: "רגע! אני רוצה להגיד משהו… תרימו את זה ממני!"', !!s && (await G(() => window.__game.debug.game.npc('avraham').model.pose === 'down')));
  await tp(P.t.fallenAt);
  check('"להרים את הקורה מאברהם"', await interact('להרים את הקורה מאברהם'));
  s = await until(async () => (await M())?.s.freed, 8, 'Avraham up');
  check('Avraham up and with the gang', !!s);
  for (const i of [21, 22, 23]) await tp(R[i]);
  s = await until((s) => s.mission?.step === 5, 6, 'the lobby');
  check('step 5: the lobby, the shutter locked, the exit switch', !!s && (await G(() => window.__game.debug.world.places.tower.lobby.door.locked)));
  await clearFloor(['og15', 'og16']);
  await tp(R[24]);
  await tp(P.t.switch, 0, -1.0);
  check('"להפעיל את מתג היציאה"', await interact('להפעיל את מתג היציאה'));
  s = await until(() => G(() => { const t = window.__game.debug.world.places.tower; return t.lobby.door.open && t.exitGate.open; }), 6, 'the shutter');
  check('the switch: the shutter up and the plaza\'s vehicle gate open', !!s);
  await tp(R[26]); await tp(R[27]);
  s = await until((s) => s.mission?.step === 6, 6, 'the plaza');
  check('step 6: the getaway vehicle — the Renault, Liam beside it', !!s && (await G(() => window.__game.debug.game.npc('liam').visible)));
  await tp(P.t.car, -2.2, 0.6);
  check('"לעלות לרנו · כולם בפנים"', await interact('לעלות לרנו · כולם בפנים'));
  s = await until((s) => s.mode === 'car', 4, 'in the car');
  check('everyone in the Renault, Nehorai at the wheel', !!s && (await G(() => ['erez', 'ido', 'liam', 'avraham', 'dolev'].every((id) => window.__game.debug.game.npc(id).inCar))));
  await G((pts) => window.__game.drivePath([['points', pts]], 12), P.t.drive);
  await markNow();
  s = await until((s) => s.mission?.step === 7, 90, 'far enough');
  await G(() => window.__game.stopDriving());
  check('out through the vehicle gate and away: 150 m from the tower', !!s);
  s = await talkThrough(() => said('תעצור. תסתכלו אחורה.'), 20, 'out on the road');
  const b0 = await G(() => window.__game.debug.game.fx.booms);
  await until(async () => (await G(() => window.__game.debug.game.fx.booms)) >= b0 + 6, 15, 'the blasts up the tower');
  await snap('t8a-booms');
  s = await talkThrough(() => said('וזה… היה המגדל השחור.'), 40, 'the blast');
  check('out on the road they watch the tower go up: "וזה… היה המגדל השחור."', !!s);
  await snap('t8-blast');
  s = await talkThrough((s) => s.mission?.id === 'together', 40, 'the safe house');
  check('mission 45 done; "סוף השלב" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('meltdown'))));
}

// ===================================================== mission 46 =====================================================
{
  s = await until(async () => (await M())?.s.staged, 20, 'the safe house');
  check('back at the safe house, the gang on the sofas, Nehorai with a bandage', !!s && (await G(() => { const g = window.__game.debug.game; return g.npc('erez').model.pose === 'sit' && g.npc('ido').model.pose === 'sit' && !!g.nehorai.bones.head.getObjectByName('bandage'); })));
  check('step 0: in, and sit with the gang', await objective(0, /לשבת/));
  await tp(P.h.stand);
  await markNow();
  check('"לשבת עם החבורה"', await interact('לשבת עם החבורה'));
  s = await talkThrough((s) => s.mission?.step === 2, 80, 'the lines');
  check('Erez: "אחי, חשבתי שלא נראה אותך יותר." · Nehorai: "אתם לא נפטרים ממני כל כך מהר." · Ido: "בפעם הבאה שאתה מתפוצץ, תודיע לי מראש!"', said('אחי, חשבתי שלא נראה אותך יותר.') && said('אתם לא נפטרים ממני כל כך מהר.') && said('בפעם הבאה שאתה מתפוצץ, תודיע לי מראש!'));
  check('everyone laughs', said('כולם צוחקים.'));
  check('the screen on: the Shadow — "אתם חושבים שזה נגמר? מה שהרסתם היה רק מתקן אחד." · "עכשיו אני בא אליכם."', said('אתם חושבים שזה נגמר? מה שהרסתם היה רק מתקן אחד.') && said('עכשיו אני בא אליכם.'));
  check('the map of the bases on the screen', await G(() => window.__game.debug.world.places.safehouse.screen.mode === 'map'));
  await snap('t9-map');
  check('step 2 on the objective line: get up', await objective(2, /לקום/));
  await markNow();
  check('"לקום מהספה"', await interact('לקום מהספה'));
  s = await talkThrough(() => said('אז תבוא. אנחנו מחכים לך.'), 30, 'the last line');
  const sides = await G(() => { const g = window.__game.debug.game, me = g.player.pos; return ['erez', 'ido'].map((id) => Math.hypot(g.npc(id).pos.x - me.x, g.npc(id).pos.z - me.z)); });
  check('Nehorai up; Erez and Ido at his side; the gang with them: "אז תבוא. אנחנו מחכים לך."', !!s && sides.every((d) => d < 2.2) && (await G(() => window.__game.debug.game.nehorai.pose !== 'sit')), sides.map((d) => d.toFixed(1)).join(','));
  await snap('t10-together');
  s = await until(() => G(() => /STAGE 9 COMPLETE – OPERATION PHOENIX/.test(document.getElementById('fadeText').textContent) && document.getElementById('fade').classList.contains('on')), 20, 'the first card');
  check('the screen dark: "STAGE 9 COMPLETE – OPERATION PHOENIX"', !!s);
  await page.waitForTimeout(3000);
  check('...still on the black three seconds later', await G(() => /STAGE 9 COMPLETE/.test(document.getElementById('fadeText').textContent) && document.getElementById('fade').classList.contains('on')));
  // (the cards keep real time, as a fade does: waited for on the clock, not in game steps)
  s = await page.waitForFunction(() => /STAGE 10 – THE FINAL HUNT/.test(document.getElementById('fadeText').textContent) && document.getElementById('fade').classList.contains('on'), null, { timeout: 15000 }).then(() => true, () => false);
  check('then "STAGE 10 – THE FINAL HUNT" on the black', !!s);
  await page.waitForTimeout(3000);
  check('...still on the black three seconds later, no banner over it', await G(() => /STAGE 10/.test(document.getElementById('fadeText').textContent) && document.getElementById('fade').classList.contains('on') && window.__game.debug.game.hud.el.banner.hidden));
  for (let i = 0; i < 60 && (await S()).mission; i++) { await page.waitForTimeout(400); await step(0.2); }
  s = await until((s) => !s.mission, 5, 'the end of the chapter');
  check('chapter nine done: "chapter-9" unlocked and saved', !!s && (await G(() => { const p = JSON.parse(localStorage.getItem('nehorai-game:save:v1') || 'null'); return p.done.includes('together') && p.unlocks.includes('chapter-9'); })));
}

const stuck = walks.filter((w) => !['ok', 'a fight', 'a scene', 'a fail'].includes(w.res));
check(`every leg walked with the stick (${walks.length - stuck.length}/${walks.length})`, stuck.length === 0, stuck.map((w) => `${w.to.x.toFixed(0)},${w.to.z.toFixed(0)}: ${w.res}`).join(' | '));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
