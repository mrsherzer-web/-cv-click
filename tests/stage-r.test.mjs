// Chapter nine acceptance test, part two (missions 37–39), under the ground and bare-handed: the wake in the
// big cell (the eyes opening, the daze, the map covered "מתחת לאדמה", every marker gone and kept in the stash),
// the four on the floor woken one by one, the user's lines about the guns and the fists, the cell doors and the
// first fist fight (FIST COMBAT, won with the real buttons: #btnPunch, #btnHeavy, #btnShove, #btnBlock,
// #btnDodge; a loss and a retry first), the chief guard's keys and his door, the iron corridor's two fights
// (one of them covering up), the machine room's group fight among the presses and the steam, the panel, a
// reload in the middle picked up at its checkpoint, the arena and "הפטיש" (a boss: armor, two phases, Erez and
// Ido in the cage), the access card, the corridor to the armory, the card reader, the two inside, the
// clipboard's code back to front and the keypad, the wall of weapons, the lines, Nehorai's own marker and
// every friend's taken off the wall (the stash empty, the fire button back, saved), and mission 40 beginning.
// Every leg the story sends him on is walked with the stick along a path (no teleports), through the doors
// the missions open. The game loop is held and stepped at 30 frames a second for the play (the renderer runs
// at 1–2 fps here), and let go only for the screenshots. usage: node tests/stage-r.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
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
const wait = (ms) => page.waitForTimeout(ms);

// ---------- the page: the loop held and stepped from here ----------
async function install() {
  await installWalker();
  await G(() => {
    const D = window.__game.debug, g = D.game, W = D.world;
    g.setPopulation?.({ traffic: 0, people: 0 });
    const F = () => W.places.facility;
    window.__r = {
      step(sec) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { g.update(1 / 30); W.tick(D.camera, 1 / 30); g.daylight?.update?.(1 / 30); } },
      S() {
        const Fi = g.fight, f = g.fighter, p = g.player.pos, m = g.missions.active;
        return {
          me: { hp: f.hp, st: f.stamina, state: f.state, x: p.x, z: p.z, y: p.y, taken: f.taken, blocks: f.blocks, dodges: f.dodges, down: f.down },
          fight: Fi && !Fi.over ? { chain: Fi.chain, combos: Fi.combos, heavies: Fi.heavies, interrupts: Fi.interrupts } : null,
          opp: Fi ? Fi.opponents.map((o) => ({ id: o.npc.id, mode: o.mode, t: o.t, d: Math.hypot(o.npc.pos.x - p.x, o.npc.pos.z - p.z), atMe: o.against === f, counter: o.fighter.counter, state: o.fighter.state, down: o.fighter.down, floored: o.fighter.floored, braced: o.fighter.braced, guard: o.guard, boss: o.boss, hp: o.fighter.hp, phase: o.phase, floors: o.fighter.floors })) : [],
          allies: Fi ? Fi.allies.map((a) => ({ id: a.npc.id, landed: a.fighter.landed, taken: a.fighter.taken })) : [],
          mission: m ? { id: m.def.id, step: m.stepIndex, won: !!m.s.won, lost: !!m.s.lost } : null,
          prompt: g.prompt?.label ?? null, dialogue: g.dialogue.busy, cutscene: !!g.cutscene, hold: !!g.hold,
          objective: document.getElementById('objText')?.textContent || '',
          fail: !g.hud.el.fail.hidden,
        };
      },
      F,
      pt: (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw },
    };
  });
}
// the left thumb, for the test: a path over a half-metre grid at the walker's own height (walls, doors and
// machines are solid; people are not walls, they step aside or the walk is reported stuck), walked with the stick
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
      if (!path || g.mode !== "foot" || g.cutscene) return input;
      const me = g.player.pos;
      while (k < path.length - 1 && Math.hypot(path[k].x - me.x, path[k].z - me.z) < 0.55) k++;
      // look ahead to the furthest point still in a straight line of a few cells
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
// the lines tapped through (each still shown and logged), until `done`
const talkThrough = (done, maxSec, what) => until(async (s) => { await listen(); if (s.dialogue) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {}); return done(s); }, maxSec, what);
// the context button: wait for the label, then the real button
async function interact(label, maxSec = 6) { const s = await until((s) => s.prompt === label, maxSec, `the button "${label}"`, 1 / 15); if (!s) return false; await press('btnInteract'); await step(1 / 30); return true; }
const jump = (p, dx = 0, dz = 0, yaw = null) => G(({ p, dx, dz, yaw }) => { const g = window.__game.debug.game; g.player.place(p.x + dx, p.z + dz, yaw ?? g.player.yaw, p.y); g.follow.snapBehind(g.player.yaw); }, { p, dx, dz, yaw });
// every move on foot is walked there with the stick along a path; a fight or a scene that starts on the
// way ends the walk where it is (as it would for a player). A leg that cannot be walked is reported at the
// end and, so the rest still runs, the player is put there
const walks = [];
async function tp(p, dx = 0, dz = 0, yaw = null) {
  const to = { x: p.x + dx, z: p.z + dz, y: p.y, near: 0.7 };
  const from = await G(() => window.__r.pt(window.__game.debug.game.player.pos));
  let res = Math.hypot(from.x - to.x, from.z - to.z) < 0.9 ? 'ok' : (await G((to) => window.__w.go(to), to)) ? 'walking' : 'no path';
  let best = Infinity, still = 0, replans = 0;
  for (let t = 0; res === 'walking' && t < 90; t += 0.2) {
    const s = await S(), d = Math.hypot(s.me.x - to.x, s.me.z - to.z);
    if (d < 1.0) { res = 'ok'; break; }
    if (s.fight || s.cutscene) { res = s.fight ? 'a fight' : 'a scene'; break; }
    const left = await G(() => window.__w.left);
    if (left < best) { best = left; still = 0; } else if ((still += 0.2) > 4) {
      if (replans++ >= 2) { res = `stuck ${d.toFixed(1)} m short at ${s.me.x.toFixed(1)},${s.me.z.toFixed(1)}`; break; }
      best = Infinity; still = 0;
      if (!(await G((to) => window.__w.go(to), to))) { res = 'no path'; break; }
    }
    await step(0.2);
  }
  if (res === 'walking') res = 'too slow';
  await G(() => window.__w.stop());
  walks.push({ to, res });
  if (res !== 'ok' && res !== 'a fight' && res !== 'a scene') { console.log(`  (could not walk to ${to.x.toFixed(1)},${to.z.toFixed(1)}: ${res})`); await jump(p, dx, dz, yaw); }
  else if (yaw != null) await G((yaw) => { const g = window.__game.debug.game; g.player.yaw = yaw; g.follow.snapBehind(yaw); }, yaw);
}
const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))) } : null; });
const L = (lx, lz, ly = 0) => G(({ lx, lz, ly }) => { const f = window.__r.F(), p = f.toWorld(lx, lz); return { x: p.x, z: p.z, y: f.y + ly }; }, { lx, lz, ly });
const visible = (id) => G((id) => !!document.getElementById(id)?.offsetParent, id);
// the HUD as the game's own loop leaves it (held, the test's steps keep the buttons off the screen): a few
// frames at real speed, `fn` read in the page, then held again
async function shown(fn) {
  await G(() => { window.__game.setTimeScale(1); window.__game.debug.game.hold = false; });
  await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const v = await G(fn);
  await G(() => { window.__game.debug.game.hold = true; window.__game.setTimeScale(2); });
  return v;
}
// a picture drawn by the game's own loop (a few frames at real speed), then held again
async function snap(name) {
  await G(() => { window.__game.setTimeScale(1); window.__game.debug.game.hold = false; });
  await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await G(() => { window.__game.debug.game.hold = true; window.__game.setTimeScale(2); });
  await page.screenshot({ path: `${shots}/${name}.png` });
}

// A fist fight played with the buttons: block (held) or shove a wind-up coming at Nehorai, dodge a boss's at
// the last moment, punch on in a combination, a heavy punch through a guard's block or when one is open; the
// left thumb walks him in (the fight bot's approach, the stick's job only). Until the mission says won or lost.
async function fight(maxSec, what, { boss = false } = {}) {
  await G(() => window.__game.fightBot({ approach: true }));
  const at = (await S()).mission; // a fight won can move the mission on in the same frame (the next step clears its flags)
  const over = (s) => !!s.mission && !s.fail && !s.mission.lost && (s.mission.won || s.mission.id !== at?.id || s.mission.step !== at?.step);
  let blocking = false, last = null, combos = 0, heavies = 0, interrupts = 0, phases = 0, floors = 0;
  const block = async (on) => { if (on !== blocking) { blocking = on; await hold('btnBlock', on); } };
  for (let t = 0; t <= maxSec; t += 1 / 30) {
    const s = await S();
    if (s.fail || s.mission?.lost) { await block(false); await G(() => window.__game.fightBot(null)); return { won: false, s, last, combos, heavies, interrupts, phases, floors }; }
    if (s.mission?.won || (!s.fight && last && t > 1)) { await block(false); await G(() => window.__game.fightBot(null)); return { won: over(s), s, last, combos, heavies, interrupts, phases, floors }; }
    if (s.fight) {
      last = s; combos = Math.max(combos, s.fight.combos); heavies = Math.max(heavies, s.fight.heavies); interrupts = Math.max(interrupts, s.fight.interrupts);
      for (const o of s.opp) { phases = Math.max(phases, o.phase || 0); floors = Math.max(floors, o.floors || 0); }
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
          } else if (o.guard > 0.3 && me.st >= 26 && s.fight.chain === 0) await press('btnHeavy'); // he covers up: through it
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
  return { won: false, s: await S(), last, combos, heavies, interrupts, phases, floors };
}

// ---------- a game saved after the black port (chapter nine, missions 34–36 done) ----------
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G((KEY) => { const g = window.__game.debug.game, p = g.progressForChapter(9); p.done.push('phoenix', 'deathroad', 'blackport'); p.stash = null; p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, KEY);
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
await page.waitForFunction(() => window.__game.debug.game.missions.active?.def.id === 'stolen', null, { timeout: 240000 });
await install();
await holdLoop(true);
await markNow();
const P = await G(() => {
  const f = window.__r.F(), pt = window.__r.pt;
  return {
    y: f.y, x: f.x, z: f.z,
    cells: { big: pt(f.cells.big.inside), guardIn: pt(f.cells.guardIn), guardOut: pt(f.cells.guardOut) },
    mach: { outA: pt(f.machines.outA), inA: pt(f.machines.inA), outB: pt(f.machines.outB), inB: pt(f.machines.inB), panel: pt(f.machines.panel.at), west: pt(f.machines.west), vent: pt(f.machines.vents[0]) },
    arena: { doorAt: pt(f.arena.doorAt), entry: pt(f.arena.entry), gateOut: pt(f.arena.gateOut), hammer: pt(f.arena.hammer) },
    armory: { reader: pt(f.armory.reader.at), inside: pt(f.armory.inside), clip: pt(f.armory.clipboard.at), keypad: pt(f.armory.keypad.at), behind: pt(f.armory.behind), mine: pt(f.armory.rack.of('nehorai').at) },
  };
});

// ---------- mission 37: the cell ----------
let s = await S();
const ov0 = await G(() => window.__game.debug.game.overlay.state);
check('"גנבו לנו את כל הרובים!" follows on by itself: the eyes shut, dazed, the map covered "מתחת לאדמה"', s.mission?.id === 'stolen' && s.mission.step === 0 && ov0.daze > 0.5 && ov0.mapHidden && ov0.mapText === 'מתחת לאדמה', JSON.stringify(ov0));
const st0 = await G(() => { const g = window.__game.debug.game; return { stashed: g.paint.stashed, armed: g.paint.armed, who: g.paint.stashContents, saved: JSON.parse(localStorage.getItem('nehorai-game:save:v1') || 'null')?.stash }; });
check('the markers gone: everyone\'s in the stash (saved), nobody armed', st0.stashed && !st0.armed && st0.who?.player && st0.who.allies.length === 8 && st0.saved?.allies?.length === 8, JSON.stringify(st0.who?.allies?.map((a) => a.id)));
check('in the big cell of the facility, under the ground', await G(() => { const g = window.__game.debug.game, f = window.__r.F(); return f.zoneAt(g.player.pos.x, g.player.pos.z) === 'cells' && f.cells.big.door.locked; }));
s = await until(async () => (await G(() => window.__game.debug.game.overlay.state.eyes)) < 0.3, 8, 'the eyes to open');
await snap('r1-wake');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the waking');
check('the eyes open; Erez: "נהוראי… נהוראי. אתה איתנו?"; on his feet', !!s && said('נהוראי… נהוראי. אתה איתנו?') && s.objective.includes('להעיר את החבורה'), s?.objective);
// the four out on the floor, woken one by one with the button
const counted = [];
for (const [id, name] of [['yonati', 'יונתי'], ['avraham', 'אברהם'], ['dolev', 'דולב'], ['hadar', 'הדר']]) {
  const at = await G((id) => window.__r.pt(window.__game.debug.game.npc(id).pos), id);
  await tp(at, 0.9, 0.4);
  const ok = await interact(`להעיר את ${name}`);
  const pose = await G((id) => window.__game.debug.game.npc(id).model.pose, id);
  check(`"להעיר את ${name}": up off the floor`, ok && pose !== 'floored', `pose ${pose}`);
  counted.push((await S()).objective);
}
check('the goal counts down in words: "שלושה… (1/4)", "שניים… (2/4)", "עוד אחד… (3/4)"', /שלושה עדיין על הרצפה \(1\/4\)/.test(counted[0]) && /שניים עדיין על הרצפה \(2\/4\)/.test(counted[1]) && /עוד אחד על הרצפה \(3\/4\)/.test(counted[2]), counted.slice(0, 3).join(' | '));
s = await talkThrough((s) => s.mission?.step === 2, 20, 'all of them up');
check('all four up: "כולם בחיים" — the lines about the guns', !!s);
s = await talkThrough((s) => (s.cutscene && heard.some((l) => l.includes('את אלה.'))) || s.mission?.step === 3, 60, 'the lines');
await snap('r2-fists');
s = await talkThrough((s) => s.mission?.step === 3, 30, 'the cell doors');
check('Ido: "רגע… איפה הרובה שלי?!" · Erez: "לקחו לנו את כל הציוד!"', said('רגע… איפה הרובה שלי?!') && said('לקחו לנו את כל הציוד!'));
check('Nehorai: "אז נסתדר עם מה שיש." · Erez: "ומה בדיוק יש לנו?" · Nehorai: "את אלה."', said('אז נסתדר עם מה שיש.') && said('ומה בדיוק יש לנו?') && said('את אלה.'), heard.slice(-6).join(' / '));
// a press of fire with no marker: nothing comes out
check('no gun: the fire button hidden and a press of fire does nothing', !(await visible('btnFire')) && !(await G(() => window.__game.debug.game.paint.fire())));
s = await until((s) => !!s.fight, 30, 'the guards coming in');
check('the cell doors open and the guards come in: the fight', !!s && s.opp.length === 4 && (await G(() => window.__r.F().cells.big.door.open)), s ? s.opp.map((o) => o.id).join(',') : '');
check('FIST COMBAT on the screen; punch, heavy, shove, block and dodge on screen, no fire button', /FIST COMBAT/.test(await text('#banner')) && (await visible('btnHeavy')) && (await visible('btnShove')) && (await visible('btnPunch')) && (await visible('btnBlock')) && (await visible('btnDodge')) && !(await visible('btnFire')));
const keysOn = await G(() => !!window.__game.debug.game.npc('og1').keyRing);
const shutIn = await until(() => G(() => window.__r.F().doors.guardDoor.locked), 8, 'their door to lock');
check('the guards\' door locks behind the last of them while the fight is on (and the chief guard has his keys on his belt)', !!shutIn && keysOn && (await G(() => { const f = window.__r.F(); return ['shutter', 'machA', 'machB', 't1Corridor', 'arena', 'armory', 'exit'].every((d) => !f.doors[d].open); })));
// a loss first: Nehorai worn down and left standing, the fail screen and a retry
await G(() => { window.__game.debug.game.fighter.hp = 6; window.__game.fightBot({ approach: true }); }); // worn down, walking into them with his hands down
s = await until((s) => s.fail, 90, 'the fail screen', 1 / 10);
await G(() => window.__game.fightBot(null));
check('beaten in the fight: the fail screen with a reason and a tip', !!s && /הפילו את נהוראי/.test(await text('#failReason')) && /לחסום/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
await holdLoop(true);
s = await until((s) => s.mission?.step === 3 && !s.fail && !!s.fight, 30, 'the retry');
check('retry: the guards come in again, Nehorai at full strength, still unarmed', !!s && s.me.hp === 100 && s.opp.every((o) => !o.down) && (await G(() => window.__game.debug.game.paint.stashed && !window.__game.debug.game.paint.armed)));
await snap('r3-cellfight');
let r = await fight(150, 'the cell fight');
check('the cell fight won with the buttons: the four guards sit down', r.won && (await G(() => ['og1', 'og2', 'og3', 'og4'].every((id) => window.__game.debug.game.npc(id).model.pose === 'down'))), `combos ${r.combos} · heavies ${r.heavies} · shoves ${r.interrupts}`);
check('Erez, Ido, Muller and Liam fought alongside: their punches landed', !!r.last && r.last.allies.length === 4 && r.last.allies.filter((a) => a.landed > 0).length >= 2, r.last ? r.last.allies.map((a) => `${a.id} ${a.landed}`).join(', ') : '');
check('the fists used for real: a combination finisher or heavy punches landed', r.combos + r.heavies >= 1, `combos ${r.combos}, heavies ${r.heavies}`);
const fell = await G(() => ['og1', 'og2', 'og3', 'og4'].map((id) => window.__r.pt(window.__game.debug.game.npc(id).pos)));
s = await talkThrough((s) => s.mission?.id === 'barehands', 40, 'the fifth mission');
check('mission 37 done; "הבריחה בלי הנשקים" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('stolen'))));
const sat = await G(() => ['og1', 'og2', 'og3', 'og4'].map((id) => { const n = window.__game.debug.game.npc(id); return { ...window.__r.pt(n.pos), on: n.visible && n.model.pose === 'down' }; }));
check('carried straight on: the four beaten guards still sit where they fell', sat.every((q, i) => q.on && Math.hypot(q.x - fell[i].x, q.z - fell[i].z) < 0.3), sat.map((q, i) => Math.hypot(q.x - fell[i].x, q.z - fell[i].z).toFixed(2)).join(','));

// ---------- mission 38: out bare-handed ----------
s = await S();
check('the keys: "לקחת את המפתחות מהשומר הראשי" on the objective line, the guards\' door locked', s.objective.includes('המפתחות') && (await G(() => window.__r.F().doors.guardDoor.locked)), s.objective);
await talkThrough((s) => !s.dialogue, 15, 'the start');
await tp(await G(() => window.__r.pt(window.__game.debug.game.npc('og1').pos)), 1.0, 0.3);
const ring0 = await G(() => !!window.__game.debug.game.npc('og1').keyRing);
check('"לקחת את המפתחות" from the chief guard (the ring off his belt)', ring0 && (await interact('לקחת את המפתחות')) && !(await G(() => !!window.__game.debug.game.npc('og1').keyRing)));
await tp(P.cells.guardIn, -0.8, 0);
check('"לפתוח את דלת השומרים"', await interact('לפתוח את דלת השומרים'));
s = await until((s) => s.mission?.step === 1, 5, 'the corridor');
check('the guards\' door open: the iron corridor', !!s && (await G(() => window.__r.F().doors.guardDoor.open)) && s.objective.includes('מסדרון הברזל'), s?.objective);
await tp(await L(-59, -28));
s = await until((s) => !!s.fight, 20, 'the guard room');
check('the guard room opens: two come out — a fight', !!s && s.opp.length === 2);
r = await fight(120, 'the corridor fight');
check('the corridor\'s first fight won with the buttons', r.won);
s = await until((s) => s.mission?.step === 2, 5, 'the shutter');
await tp(await L(-48, -28));
s = await until((s) => !!s.fight, 10, 'the three at the shutter');
check('three at the shutter, one covering up; no way round them (the machine room and the arena shut)', !!s && s.opp.length === 3 && s.opp.some((o) => o.guard >= 0.6) && (await G(() => { const d = window.__r.F().doors; return !d.machA.open && !d.machB.open && !d.arena.open && !d.cage.open; })));
r = await fight(150, 'the shutter fight');
check('the shutter fight won: heavy punches through the one who covers up', r.won && r.heavies >= 1, `heavies ${r.heavies}`);
s = await talkThrough((s) => /חדר המכונות/.test(s.objective), 10, 'the shutter shut');
check('the shutter locked: "לדלת המערבית של חדר המכונות", that door open now', !!s && (await G(() => window.__r.F().doors.machA.open && !window.__r.F().doors.machB.open)), s?.objective);
await tp(P.mach.outA);
s = await until((s) => s.mission?.step === 3, 5, 'the machine room');
await tp(P.mach.inA, 0, -0.6, Math.PI);
s = await until((s) => !!s.fight, 10, 'the machine room fight');
check('the machine room: four of them, a group fight', !!s && s.opp.length === 4, s?.objective);
await step(0.2);
const barred = await G(() => { const H = window.__r.F().machines; return { down: H.barsDown, west: !window.__w.plan({ ...H.stairs.west.top, near: 0.8 }), east: !window.__w.plan({ ...H.stairs.east.top, near: 0.8 }) }; });
check('the fight stays on the floor: barrier arms across both stairs, the catwalk out of reach', barred.down && barred.west && barred.east, JSON.stringify(barred));
await snap('r4-machines');
r = await fight(180, 'the machine room fight');
check('the machine room fight won with the buttons; the stairs open again', r.won && !(await G(() => window.__r.F().machines.barsDown)));
s = await until((s) => s.mission?.step === 4 && s.objective.includes('לעצור את המכונות'), 5, 'the crossing');
check('across the machine room: "לעצור את המכונות בלוח · או לעבור בתזמון"', !!s && s.objective.includes('לעצור את המכונות'), s?.objective);

// a reload here: the checkpoint is picked up on a fresh page
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
const summary = await text('#startScreen');
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
await install();
await holdLoop(true);
s = await S();
const back = await G(() => { const g = window.__game.debug.game, f = window.__r.F(); return { stashed: g.paint.stashed, armed: g.paint.armed, beaten: ['og10', 'og11', 'og12', 'og13'].filter((id) => g.npc(id).visible && g.npc(id).model.pose === 'down').length, zone: f.zoneAt(g.player.pos.x, g.player.pos.z), map: g.overlay.state.mapHidden, squad: g.squad.ids.length }; });
check('a reload: "continue" picks the mission up in the machine room, still unarmed, the four beaten there, the gang with him', /באמצע/.test(summary) && s.mission?.id === 'barehands' && s.mission.step === 4 && back.stashed && !back.armed && back.beaten === 4 && back.zone === 'machines' && back.map && back.squad === 8, JSON.stringify(back));
await markNow();
// the steam is real: standing in the west vent when it bursts
const hp0 = (await S()).me.hp;
await tp(P.mach.vent, 0, 0, Math.PI);
s = await until(async () => ((await M())?.s.hazardHits || 0) > 0, 8, 'the steam');
check('the steam vent warns, bursts and hits whoever stands in it', !!s && (await S()).me.hp < hp0, `hp ${hp0} → ${(await S()).me.hp.toFixed(0)}`);
// a press over a man: it warns and comes down, stops above him (the hit lands, nobody in the steel), and out of
// a fight it staggers him without putting him on the floor (no boxing stance after it)
const pr = await G(() => window.__r.pt(window.__r.F().machines.presses[0]));
await until(() => G(() => window.__r.F().machines.presses[0].phase === 'idle'), 6, 'the press up');
await tp(pr, 0, 0, Math.PI / 2);
await G(() => { window.__game.debug.game.fighter.hp = 50; });
const pressed = await G(() => {
  const g = window.__game.debug.game, F = window.__r.F(), p = F.machines.presses[0];
  let low = 9, floored = false, held = false, hp = g.fighter.hp, guard = false, hitAt = -1;
  for (let i = 0; i < 165 && (hitAt < 0 || i < hitAt + 36); i++) { // one slam, and the second after it
    window.__r.step(1 / 30);
    const me = g.player.pos;
    if (Math.abs(me.x - p.x) < p.hx + 0.3 && Math.abs(me.z - p.z) < p.hz + 0.3) low = Math.min(low, p.head.position.y - F.y - 0.55);
    if (g.fighter.state === 'floored' || g.nehorai.pose === 'floored') floored = true;
    if (g.nehorai.pose === 'guard') guard = true;
    held = held || p.held; hp = Math.min(hp, g.fighter.hp);
    if (hitAt < 0 && hp < 50) hitAt = i;
  }
  return { low: +low.toFixed(2), floored, held, hp, guard };
});
check('a press over Nehorai stops short of him (its safety stop) and the hit lands: a stagger, not the floor', pressed.held && pressed.low >= 2.0 && pressed.hp < 50 && !pressed.floored && !pressed.guard, JSON.stringify(pressed));
await tp(P.mach.panel);
check('"לעצור את המכונות" at the panel', await interact('לעצור את המכונות'));
s = await until(async () => (await M())?.s.stopped, 6, 'the machines to stop');
check('three seconds at the panel: the presses and the steam stop', !!s && (await G(() => window.__r.F().machines.hazards.every((h) => !h.on))));
await tp(P.mach.outB);
s = await talkThrough((s) => s.mission?.step === 5, 5, 'out of the machine room');
check('out by the east door: to the arena', !!s && s.objective.includes('זירת המעצר'), s?.objective);
await tp(P.arena.doorAt); await step(0.2);
await tp(P.arena.entry); await step(0.2);
await tp(P.arena.gateOut);
s = await until((s) => s.mission?.step === 6, 5, 'the cage');
await markNow();
s = await talkThrough((s) => !!s.fight, 60, 'the Hammer');
check('in the cage: "הפטיש" — his lines, the gate shut behind them', !!s && said('אז אתם החבורה של נהוראי. בלי הרובים אתם סתם ילדים.') && (await G(() => window.__r.F().doors.cage.locked)));
check('the boss bar with his name; Erez and Ido in the cage with Nehorai', (await visible('bossBar')) && /הפטיש/.test(await text('#bossName')) && !!s && s.allies.map((a) => a.id).join(',') === 'erez,ido' && s.opp[0].boss);
await snap('r5-hammer');
// the Hammer puts him down first: worn down and walking into him, the fail screen with his tip, a retry in the
// cage (a look at him and one line, not the whole talk again), at full strength
await G(() => { window.__game.debug.game.fighter.hp = 8; window.__game.fightBot({ approach: true }); });
s = await until((s) => s.fail, 90, 'the Hammer\'s fail screen', 1 / 10);
await G(() => window.__game.fightBot(null));
check('beaten by the Hammer: the fail screen with his tip (dodge or shove, then a heavy punch or a combination)', !!s && /הפטיש הפיל את נהוראי/.test(await text('#failReason')) && /מכה חזקה/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
await holdLoop(true);
await markNow();
s = await talkThrough((s) => s.mission?.step === 6 && !s.fail && !!s.fight, 30, 'the retry in the cage');
check('retry: back in the cage with Erez and Ido, the Hammer at full strength, Nehorai too, the talk not played again', !!s && s.me.hp === 100 && s.opp[0]?.hp >= 240 && s.allies.length === 2 && !said('אז אתם החבורה של נהוראי. בלי הרובים אתם סתם ילדים.') && (await G(() => window.__r.F().doors.cage.locked)), s ? `hp ${s.me.hp} · his ${s.opp[0]?.hp} · ${heard.join(' / ')}` : '');
r = await fight(300, 'the Hammer', { boss: true });
check('"הפטיש" beaten with the buttons: blocks, dodges, shoves, heavy punches, combinations', r.won && r.heavies >= 2, `combos ${r.combos} · heavies ${r.heavies} · shoves ${r.interrupts}`);
check('his two phases: down for a moment, up angrier', r.phases === 2, `phases ${r.phases}`);
check('Erez and Ido fought alongside for real', !!r.last && r.last.allies.every((a) => a.landed > 0), r.last ? r.last.allies.map((a) => `${a.id} ${a.landed}`).join(', ') : '');
s = await talkThrough((s) => s.mission?.step === 7, 10, 'the card');
const card = (await M())?.s;
await tp(await G(() => window.__game.debug.game.missions.active.s.cardAt), 0.8, 0);
const crowd = await G(() => ['og14', 'og15', 'og16'].map((id) => { const n = window.__game.debug.game.npc(id); return n.visible ? 1 : 0; }).join(''));
check('"לקחת את כרטיס הגישה" from the Hammer; the crowd still in sight, running off the stands', crowd === '111' && (await interact('לקחת את כרטיס הגישה')), `seen ${crowd}`);
s = await talkThrough((s) => s.mission?.id === 'armory', 40, 'the sixth mission');
check('the access card to the armory; mission 38 done; "מחזירים את הרובים!" begins', !!s && (await G(() => window.__game.debug.game.progress.done.includes('barehands'))) && !!card);

// ---------- mission 39: the armory ----------
s = await until((s) => s.objective.includes('למחסן הנשקים'), 3, 'the first goal');
s = s || await S();
check('"למחסן הנשקים" on the objective line, still unarmed', s.objective.includes('למחסן הנשקים') && (await G(() => window.__game.debug.game.paint.stashed)), s.objective);
await talkThrough((s) => !s.dialogue, 10, 'the start');
await tp(await L(9, -28), 0, 0, Math.PI / 2);
s = await until((s) => s.mission?.step === 1, 5, 'the corridor');
await tp(await L(24, -28), 0, 0, Math.PI / 2);
s = await until((s) => !!s.fight, 10, 'the two in the corridor');
check('in the corridor: two of the Order\'s men from the stands — a fight', !!s && s.opp.length === 2);
r = await fight(120, 'the corridor to the armory');
check('the corridor fight won with the buttons', r.won);
s = await until((s) => s.mission?.step === 2 && s.objective.includes('להעביר את הכרטיס'), 5, 'the door');
check('the armory\'s door: "להעביר את הכרטיס בקורא"', !!s && s.objective.includes('להעביר את הכרטיס') && (await G(() => window.__r.F().armory.door.locked)), s?.objective);
await tp(P.armory.reader);
check('"להעביר את כרטיס הגישה" at the reader', await interact('להעביר את כרטיס הגישה'));
s = await until((s) => !!s.fight, 12, 'the two inside');
check('the card opens the heavy door; the two inside come at them', !!s && (await G(() => window.__r.F().armory.door.open)) && s.opp.length === 2);
r = await fight(150, 'the armory fight');
check('the armory fight won with the buttons', r.won);
s = await talkThrough((s) => s.mission?.step === 3 && s.objective.includes('הלוח'), 10, 'the bars');
check('the bars: "הקוד לסורגים · הלוח של האחראי על הקיר"', !!s && s.objective.includes('הלוח'), s?.objective);
await tp(P.armory.keypad);
check('"להקיש את הקוד" at the keypad', await interact('להקיש את הקוד'));
await G(() => window.__game.debug.game.keypad.enter('9174'));
await wait(900); await step(0.1);
check('the code as written (9174): wrong, the bars stay shut', await G(() => window.__r.F().armory.gate.locked && !document.getElementById('keypad').hidden));
await G(() => window.__game.debug.game.keypad.close(false)); await step(0.1);
await markNow();
await tp(P.armory.clip);
check('"לקרוא את הלוח": the code back to front', await interact('לקרוא את הלוח'));
s = await talkThrough(() => said('מהסוף להתחלה. ארבע, שבע, אחת, תשע.'), 10, 'the reading');
check('Nehorai reads it: "מהסוף להתחלה. ארבע, שבע, אחת, תשע."', !!s);
await tp(P.armory.keypad);
check('"להקיש את הקוד" again', await interact('להקיש את הקוד'));
await G(() => window.__game.debug.game.keypad.enter('4719'));
await wait(900);
s = await until((s) => s.mission?.step === 4, 5, 'the gate');
check('4719: the bars slide open', !!s && (await G(() => window.__r.F().armory.gate.open)));
await markNow();
s = await talkThrough((s) => s.cutscene && said('עידו, תתאפס על עצמך.'), 40, 'the wall');
await snap('r6-wall');
s = await talkThrough((s) => s.mission?.step === 5, 20, 'his own marker');
check('the camera on the wall of weapons; Ido: "סוף סוף! מצאתי את האהבה של החיים שלי!" · Erez: "עידו, תתאפס על עצמך."', said('סוף סוף! מצאתי את האהבה של החיים שלי!') && said('עידו, תתאפס על עצמך.'));
check('the wall full: ten markers, each in its owner\'s colour', await G(() => window.__r.F().armory.rack.left() === 10));
await tp(P.armory.mine);
check('"לקחת את הרובה שלך"', await interact('לקחת את הרובה שלך'));
s = await talkThrough(() => said('עכשיו מתחילה המסיבה.'), 15, 'the line');
check('Nehorai lifts his own: "עכשיו מתחילה המסיבה." — his marker in his own colour', !!s && (await G((c) => { const g = window.__game.debug.game; return g.paint.armed && g.paint.player.color === c; }, st0.who.player.color)));
s = await talkThrough(async () => (await M())?.s.allArmed, 40, 'the gang to re-arm');
const kit = await G(() => { const g = window.__game.debug.game, P = g.paint, rack = window.__r.F().armory.rack; return { armed: P.armed, allies: P.allies.map((a) => [a.npc.id, a.color]), stash: g.progress.stash, left: rack.left(), saved: JSON.parse(localStorage.getItem('nehorai-game:save:v1') || 'null')?.stash }; });
const own = st0.who.allies.every((a) => kit.allies.some(([id, c]) => id === a.id && c === a.color));
check('every friend takes his own marker (his own colour) off the wall; the wall empty', !!s && kit.left === 0 && kit.allies.length === 8 && own, `left ${kit.left} · ${kit.allies.map((a) => a[0]).join(',')}`);
check('the stash empty and saved so; firing works again', kit.armed && kit.stash === null && (kit.saved === null || kit.saved === undefined));
// the HUD as a player sees it (no scene running): the fire button is back
const fire39 = await shown(() => ({ fire: !!document.getElementById('btnFire').offsetParent, squad: !!document.getElementById('btnSquad').offsetParent, scene: !!window.__game.debug.game.cutscene, id: window.__game.debug.game.missions.active?.def.id }));
check('the fire button on screen again (and the squad\'s order button beside it)', fire39.fire && fire39.squad && !fire39.scene, JSON.stringify(fire39));
s = await talkThrough((s) => s.mission?.id !== 'armory', 30, 'the end of mission 39');
await G(() => { window.__game.debug.game.hold = false; });
await wait(1500);
check('mission 39 done; mission 40 begins in the armory with the gang armed', await G(() => { const g = window.__game.debug.game; return g.progress.done.includes('armory') && g.missions.active?.def.id === 'portwar' && g.paint.armed && g.paint.allies.length === 8; }));
// mission 40 opens on its alarm, a scene (the HUD's buttons step aside while it plays); after it, the fire button
await holdLoop(true);
s = await talkThrough((s) => s.mission?.id === 'portwar' && s.mission.step >= 1 && !s.cutscene, 40, 'the alarm scene of mission 40');
check('after mission 40\'s alarm scene: the fire button on screen', !!s && (await shown(() => !!document.getElementById('btnFire').offsetParent)));
await snap('r7-armed');

check('every way the story sends him walked on foot (doors open, nobody in a doorway)', walks.length >= 15 && walks.every((w) => w.res === 'ok' || w.res === 'a fight' || w.res === 'a scene'), `${walks.length} walks · ${walks.filter((w) => w.res !== 'ok').map((w) => w.res).join(' | ')}`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed  (${mins()} min)`);
await browser.close();
process.exit(failed.length ? 1 : 0);
