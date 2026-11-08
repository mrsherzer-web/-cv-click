// Chapter nine acceptance test, part three (missions 40–42), under the ground with the markers back: the alarm
// (the red emergency light, the siren, the Shadow on the speakers, the action music), the Order's men down the
// iron corridor from both ends (one marked with real paint, the squad's order button pressed), the tunnel and
// the charge that shuts the hangar's door in fire, the stores (three marks: the fail screen and a retry), the
// ceiling beam, Ido working the sealed west door open, the giant hangar ("נהוראי! יש עוד מלא אויבים!" /
// "יופי, שלא יהיה משעמם!"), a fuel tank shot through and the truck going up after its warning, the great door
// opening on more of them, the tanker, the truss, Erez shut in the side room; then Nehorai frees him, the blast
// (warned) throws him down — the daze, the dull sound, the try to get up, the user's lines, the eyes closing —
// and no mark ever fails it; the player is Ido: SAVE NAHORAI and the seven goals for real (reach him, hold them
// off him, the first-aid kit, the treatment, the carry with Erez walked to the safe room, the wheel of the
// security door, the doorway held until the treatment is done: three marks and a retry there), a reload in the
// middle picked up as Ido with Nehorai on the floor, the quiet scene and the music fading; then the wake (black,
// Ido's voice, the eyes opening on their faces, every line), the rifle handed over by the player as Ido, the
// camera round him, back to Nehorai (slow at first, steadier with each step, his health and gear back), the
// security door, the last three at the great door, its panel, the ramp, and mission 43 beginning at the surface.
// Every leg is walked with the stick along a path. The loop is held and stepped at 30 frames a second (the
// renderer runs at 1–2 fps here) and let go only for the screenshots.
// usage: node tests/stage-s.test.mjs [url] [screenshot dir]
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
    window.__r = {
      step(sec) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { g.update(1 / 30); W.tick(D.camera, 1 / 30); g.daylight?.update?.(1 / 30); } },
      S() {
        const p = g.player.pos, m = g.missions.active;
        return {
          me: { x: p.x, z: p.z, y: p.y, as: g.playingAs, speed: g.player.speedScale, hp: g.fighter.hp },
          mission: m ? { id: m.def.id, step: m.stepIndex } : null,
          prompt: g.prompt?.label ?? null, dialogue: g.dialogue.busy, cutscene: !!g.cutscene, hold: !!g.hold,
          objective: document.getElementById('objText')?.textContent || '',
          fail: !g.hud.el.fail.hidden, hits: g.paint.hits, armed: g.paint.armed,
        };
      },
      F: () => W.places.facility,
      pt: (q) => q && { x: q.x, z: q.z, y: q.y, yaw: q.yaw },
    };
  });
}
// the left thumb, for the test: a path over a half-metre grid at the walker's own height (walls, doors, vehicles
// and fallen beams are solid; people are not walls), walked with the stick
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
  return { plan, go, stop, get left() { return path ? path.length - k : 0; } };
})(); });
const S = () => G(() => window.__r.S());
const step = (sec) => G((s) => window.__r.step(s), sec);
const holdLoop = (on) => G((on) => { window.__game.debug.game.hold = on; }, on);
const press = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await page.dispatchEvent(`#${id}`, 'pointerup').catch(() => {}); };
// a fail screen nobody asked for (the deliberate ones set `expectFail`) is noted, and reported at the end
let expectFail = false;
const unexpected = [];
async function until(cond, maxSec, what, dt = 0.1) {
  for (let t = 0; t <= maxSec; t += dt) {
    const s = await S();
    if (s.fail && !expectFail && !unexpected.includes(what)) { unexpected.push(what); console.log(`  (an unexpected fail screen while waiting for ${what}: ${await page.textContent('#failReason')})`); }
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
// every move on foot is walked there with the stick along a path; a scene that starts on the way ends the walk
// where it is. A leg that cannot be walked is reported at the end and, so the rest still runs, the player is put there
const walks = [];
async function tp(p, dx = 0, dz = 0, yaw = null, maxSec = 90) {
  const to = { x: p.x + dx, z: p.z + dz, y: p.y, near: 0.7 };
  const from = await G(() => window.__r.pt(window.__game.debug.game.player.pos));
  let res = Math.hypot(from.x - to.x, from.z - to.z) < 0.9 ? 'ok' : (await G((to) => window.__w.go(to), to)) ? 'walking' : 'no path';
  let best = Infinity, still = 0, replans = 0;
  for (let t = 0; res === 'walking' && t < maxSec; t += 0.2) {
    const s = await S(), d = Math.hypot(s.me.x - to.x, s.me.z - to.z);
    if (d < 1.0) { res = 'ok'; break; }
    if (s.cutscene) { res = 'a scene'; break; }
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
  if (res !== 'ok' && res !== 'a scene') { console.log(`  (could not walk to ${to.x.toFixed(1)},${to.z.toFixed(1)}: ${res})`); await jump(p, dx, dz, yaw); }
  else if (yaw != null) await G((yaw) => { const g = window.__game.debug.game; g.player.yaw = yaw; g.follow.snapBehind(yaw); }, yaw);
  return res;
}
const M = () => G(() => { const a = window.__game.debug.game.missions.active; return a ? { id: a.def.id, step: a.stepIndex, s: Object.fromEntries(Object.entries(a.s).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))) } : null; });
const L = (lx, lz, ly = 0) => G(({ lx, lz, ly }) => { const f = window.__r.F(), p = f.toWorld(lx, lz); return { x: p.x, z: p.z, y: f.y + ly }; }, { lx, lz, ly });
// on screen as a player has it (the held loop hides the HUD's buttons as a pause does: let go for the look)
const visible = (id) => G((id) => { const g = window.__game.debug.game, was = g.hold; g.hold = false; g.updateCombat(0); const e = document.getElementById(id); let on = !!e && e.getClientRects().length > 0; for (let p = e; on && p; p = p.parentElement) if (p.hidden || getComputedStyle(p).display === 'none' || getComputedStyle(p).visibility === 'hidden') on = false; g.hold = was; return on; }, id);
// the Order's men of these ids marked (a gunfight's paint, as the earlier tests do); the count marked
const markAll = (ids) => G((ids) => { const P = window.__game.debug.game.paint; let n = 0; for (const x of P.guards) if (!x.marked && x.npc.visible && (!ids || ids.includes(x.npc.id))) { P.markGuard(x, 'test'); n++; } return n; }, ids);
const onBoard = () => G(() => window.__game.debug.game.paint.guards.filter((g) => !g.marked && g.npc.visible).map((g) => g.npc.id));
// a real pellet: the player six metres from him on a clear line, facing him, the trigger pulled (the loop let go
// for just the shot, so the marker fires)
const shoot = (ids) => G(async (ids) => {
  const g = window.__game.debug.game, P = g.paint, gd = P.guards.find((x) => ids.includes(x.npc.id) && !x.marked && x.npc.visible);
  if (!gd) return false;
  const n = gd.npc, back = { x: g.player.pos.x, z: g.player.pos.z, y: g.player.pos.y, yaw: g.player.yaw };
  for (let a = 0; a < 16 && !gd.marked; a++) {
    const t = a * Math.PI / 8, fx = n.pos.x + Math.sin(t) * 5, fz = n.pos.z + Math.cos(t) * 5;
    if (Math.abs(window.__game.debug.world.groundHeight(fx, fz, n.pos.y) - n.pos.y) > 0.3 || !P.clear(fx, n.pos.y + 1.3, fz, n.pos.x, n.pos.y + 1.1, n.pos.z, null) || window.__game.debug.world.cols.blocks(fx, n.pos.y + 1, fz)) continue;
    g.player.place(fx, fz, Math.atan2(n.pos.x - fx, n.pos.z - fz), n.pos.y);
    // the pellets fly at once (a hit marks him on the spot); no frame runs between them, so nothing else moves on meanwhile
    for (let k = 0; k < 6 && !gd.marked; k++) { g.hold = false; P.lock = gd; P.fire(); g.hold = true; P.player.reloading = 0; if (P.player.ammo <= 1) P.player.ammo = 8; }
  }
  g.player.place(back.x, back.z, back.yaw, back.y); g.follow.snapBehind(back.yaw); // back where he stood
  return gd.marked && gd.markedBy === 'player';
}, ids);
// of a wave still up, all but one marked (paint, as above), and that last one shot with real paint
const shootLast = async (ids) => {
  const up = await G((ids) => window.__game.debug.game.paint.guards.filter((x) => ids.includes(x.npc.id) && !x.marked && x.npc.visible).map((x) => x.npc.id), ids);
  if (!up.length) return false;
  await markAll(up.slice(1));
  return shoot([up[0]]);
};
// a picture drawn by the game's own loop (a few frames at real speed), then held again
async function snap(name) {
  await G(() => { window.__game.setTimeScale(1); window.__game.debug.game.hold = false; });
  await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await G(() => { window.__game.debug.game.hold = true; window.__game.setTimeScale(2); });
  await page.screenshot({ path: `${shots}/${name}.png` });
}
async function boot() {
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state?.started, null, { timeout: 60000 });
  await G(() => { window.__game.debug.game.setPopulation({ traffic: 0, people: 0 }); window.__game.setTimeScale(2); });
}

// ---------- a game saved after the armory (chapter nine, missions 34–39 done, everyone armed) ----------
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G((KEY) => { const g = window.__game.debug.game, p = g.progressForChapter(9); p.done.push('phoenix', 'deathroad', 'blackport', 'stolen', 'barehands', 'armory'); p.stash = null; p.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(p)); }, KEY);
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
// the facility as mission 39 leaves it when 40 follows on: guard room 2's door shut, the guard rooms' back doors locked
await G(() => window.__game.debug.world.places.facility.setDoors({ guardRoom2: false, guardRoom2Back: 'locked', guardRoom1Back: 'locked' }));
await boot();
await page.waitForFunction(() => window.__game.debug.game.missions.active?.def.id === 'portwar', null, { timeout: 240000 });
await install();
await holdLoop(true);
await markNow();
const P = await G(() => {
  const f = window.__r.F(), pt = window.__r.pt;
  return {
    y: f.y, armory: pt(f.armory.inside), trapAt: pt(f.hangar.trap.at), kit: pt(f.medkit.at), doorAt: pt(f.saferoom.doorAt), doorIn: pt(f.saferoom.doorIn), wheel: pt(f.saferoom.wheel),
    panel: pt(f.exit.panel.at), outside: pt(f.exit.outside), bed: pt(f.saferoom.bed),
  };
});

// ---------- mission 40: the war under the ground ----------
let s = await S();
check('"מלחמת הנמל" follows on in the armory, the gang armed (eight friends, each his marker)', s.mission?.id === 'portwar' && s.armed && (await G(() => window.__game.debug.game.paint.allies.length)) === 8 && (await G(() => window.__r.F().zoneAt(window.__game.debug.game.player.pos.x, window.__game.debug.game.player.pos.z))) === 'armory');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the alarm');
const atmo = await G(() => { const g = window.__game.debug.game; return { red: g.fx.redAlertOn, lamps: window.__r.F().alarmOn, music: g.sound?.musicMode, map: g.overlay.state.mapHidden }; });
check('the alarm: red emergency light, the facility\'s red lamps flashing, action music, the map covered', atmo.red && atmo.lamps && atmo.music === 'action' && atmo.map, JSON.stringify(atmo));
check('the Shadow on the speakers sends all of the facility\'s security after them', heard.some((l) => l.startsWith('הצל: ') && l.includes('כל הכוחות של המתקן')), heard.slice(0, 3).join(' / '));
s = (await until((s) => s.objective.includes('לצאת למסדרון הברזל'), 2, 'the first goal')) || s;
check('goal: "לצאת למסדרון הברזל · הם באים משני הצדדים"', s?.objective.includes('לצאת למסדרון הברזל'), s?.objective);
await snap('s1-alarm');
await tp(await L(56, -29.5), 0, 0, Math.PI / 2);
s = await until(async () => (await onBoard()).length === 5, 15, 'the first wave');
const w1 = await G(() => window.__game.debug.game.paint.guards.filter((g) => !g.marked).map((g) => g.npc.pos.x - window.__r.F().x));
check('the Order comes down the iron corridor from both ends (five of them)', !!s && w1.some((x) => x > 60) && w1.some((x) => x < 30), w1.map((x) => x.toFixed(0)).join(','));
check('goal: "המסדרון: לסמן אותם (0/5) · מחסה במפרצים"', (await S()).objective.includes('המסדרון: לסמן אותם'), (await S()).objective);
// the two who start in guard room 2 come out of it (mission 39 left its door shut; 40 opens it)
const outOfRoom = () => G(() => { const g = window.__game.debug.game, f = window.__r.F(); return ['og8', 'og9'].map((id) => { const gd = g.paint.guards.find((q) => q.npc.id === id); return gd && (gd.marked || f.zoneAt(gd.npc.pos.x, gd.npc.pos.z) === 'corridor') ? '' : f.zoneAt(g.npc(id).pos.x, g.npc(id).pos.z); }); });
s = await until(async () => (await outOfRoom()).every((z) => !z), 14, 'og8 and og9 out of the guard room');
check('the two in guard room 2 come out into the corridor (its door opened)', !!s && (await G(() => window.__r.F().doors.guardRoom2.open)), (await outOfRoom()).join(','));
// the squad's order button: "תחפו עליי!" (cover)
let order = await G(() => window.__game.debug.game.squad.mode);
for (let k = 0; k < 4 && order !== 'cover'; k++) { await press('btnSquad'); await step(0.1); order = await G(() => window.__game.debug.game.squad.mode); }
check('the squad button: "תחפו עליי!" — the friends cover him', order === 'cover' && (await visible('btnSquad')), `${order} · ${await visible('btnSquad')}`);
await snap('s2-corridor');
check('a guard of the Order marked with real paint (aim, fire)', await shootLast(['og5', 'og6', 'og7', 'og8', 'og9']));
for (let k = 0; k < 4 && order !== 'follow'; k++) { await press('btnSquad'); await step(0.1); order = await G(() => window.__game.debug.game.squad.mode); }
s = await until((s) => s.objective.includes('המסדרון נקי'), 8, 'the corridor clear');
check('the corridor clear: "המסדרון נקי · למנהרה בקצה המזרחי"; the friends follow again', !!s && order === 'follow', `${s?.objective ?? (await S()).objective} · ${(await onBoard()).join(',')} · ${JSON.stringify(await M())}`);
await tp(await L(77, -24));
s = await until((s) => s.mission?.step === 2, 6, 'the tunnel');
check('goal: "דרומה במנהרה"', !!s && s.objective.includes('דרומה במנהרה'), s?.objective);
await markNow();
await markAll(['og10', 'og11', 'og12']); // the three waiting in the tunnel
await tp(await L(77, -15.5), 0, 0, 0);
s = await until(async () => !!(await G(() => window.__game.debug.game.missions.active.live.some((b) => b.ring))), 8, 'the warning ring');
check('the Order\'s charge at the tunnel\'s far end warns first (a red ring, beeps)', !!s);
s = await talkThrough(async () => (await M())?.s.shut, 10, 'the charge');
await talkThrough(() => said('הדלת להאנגר נחסמה! מערבה, דרך המחסנים!'), 10, 'the line');
check('the blast shuts the hangar\'s door in fire; Ido: "הדלת להאנגר נחסמה! מערבה, דרך המחסנים!"', !!s && (await G(() => window.__r.F().doors.t1Hangar.locked)) && said('הדלת להאנגר נחסמה! מערבה, דרך המחסנים!'));
check('the way changes: "המנהרה: לסמן אותם · ואז מערבה למחסנים"', (await S()).objective.includes('מערבה'), (await S()).objective);
await snap('s3-tunnel');
await markAll(['og10', 'og11', 'og12']);
await tp(await L(23.5, -8));
s = await until((s) => s.mission?.step === 3, 8, 'the stores');
check('goal: "המחסנים: לסמן אותם · בין המדפים"', !!s && s.objective.includes('המחסנים: לסמן אותם'), s?.objective);
// three marks: the fail screen; a retry from the stores
await G(() => { const P = window.__game.debug.game.paint; P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); });
expectFail = true;
s = await until((s) => s.fail, 5, 'the fail screen');
check('marked three times: the fail screen, with the reason and a tip', !!s && /סומן שלוש פעמים/.test(await text('#failReason')) && /מאחורי/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
await holdLoop(true);
expectFail = false;
s = await until((s) => s.mission?.step === 3 && !s.fail, 10, 'the retry');
check('retry: back at the stores\' door, the marks wiped, the gang armed, the hangar\'s door still shut', !!s && s.hits === 0 && s.armed && (await G(() => window.__r.F().doors.t1Hangar.locked && window.__game.debug.game.paint.allies.length === 8)));
await markAll(['og1', 'og2', 'og4']); // the men among the racks
s = await until(async () => (await G(() => window.__game.debug.game.missions.active.beams.some((b) => b.done))), 20, 'the beam');
check('a beam comes down across the east lane after its warning, and blocks it', !!s && (await G(() => !!window.__game.debug.game.missions.active.beams.find((b) => b.done)?.beam?.box)));
await snap('s4-stores');
s = await until(async () => (await G(() => window.__game.debug.game.missions.active.w.w3b.done)), 20, 'the men from store A');
await markAll(['og1', 'og2', 'og4', 'og13', 'og10']);
s = await until((s) => s.objective.includes('להאנגר'), 6, 'the stores clear');
check('the stores clear: "להאנגר · הדלת המערבית ... · או המנהרה הדרומית"', !!s && s.objective.includes('המנהרה הדרומית'), s?.objective);
await markNow();
await tp(await L(24, 22), 0, 0, Math.PI / 2);
s = await talkThrough(async () => (await G(() => window.__r.F().doors.hangarW.open)), 30, 'Ido at the west door');
check('the hangar\'s west door sealed: Ido works it open while they cover him', !!s && said('הדלת להאנגר נעולה. תן לי ארבע שניות איתה — ותחפו עליי.'));
await markNow();
await tp(await L(33, 20), 0, 0, Math.PI / 2);
s = await talkThrough((s) => s.mission?.step === 4 && said('יופי, שלא יהיה משעמם!'), 20, 'the hangar');
check('the giant hangar: Ido "נהוראי! יש עוד מלא אויבים!" · Nehorai "יופי, שלא יהיה משעמם!"', !!s && said('נהוראי! יש עוד מלא אויבים!') && said('יופי, שלא יהיה משעמם!'));
check('goal: "ההאנגר: לסמן אותם · מאחורי הרכבים · מיכלי הדלק"', (await S()).objective.includes('מיכלי הדלק'), (await S()).objective);
await markAll(['og14', 'og15', 'og16', 'og5', 'og6']); // all but one of them, before the fuel tank
// a fuel tank shot through with real paint: its warning, and the truck goes up on whoever of the Order is by it
const tank = await G(() => {
  const g = window.__game.debug.game, P = g.paint, e = g.missions.active.tanks.find((t) => t.v.kind === 'truck'), pr = e.props[0];
  const dx = pr.x - e.v.x, dz = pr.z - e.v.z, l = Math.hypot(dx, dz) || 1, from = { x: pr.x + (dx / l) * 7, z: pr.z + (dz / l) * 7 };
  g.player.place(from.x, from.z, Math.atan2(pr.x - from.x, pr.z - from.z), e.v.y);
  for (let i = 0; i < 12 && !pr.done; i++) { g.player.yaw = Math.atan2(pr.x - g.player.pos.x, pr.z - g.player.pos.z); g.hold = false; P.lock = null; P.fire(); g.hold = true; window.__r.step(0.1); if (P.player.ammo <= 1) { P.player.ammo = 8; P.player.reloading = 0; } }
  // one of the Order who is still up, by the truck as it warns
  const og = P.guards.find((q) => !q.marked && q.npc.visible); if (og) { og.npc.place(e.v.x + 2.4, e.v.z - 1.6, 0, e.v.y); P.setRoute(og, [{ x: e.v.x + 2.4, z: e.v.z - 1.6 }], { still: true }); }
  return { done: pr.done, ring: !!e.blast?.ring, warn: e.blast?.warn, by: og?.npc.id ?? null };
});
check('a red fuel tank on the truck shot three times with paint: the warning ring (time to get clear of it)', tank.done && tank.ring && tank.warn >= 2, JSON.stringify(tank));
await G(() => { const g = window.__game.debug.game, f = window.__r.F(), p = f.toWorld(36, 31); g.player.place(p.x, p.z, Math.PI / 2, f.y); });
s = await until(async () => (await G(() => window.__r.F().hangar.vehicles[0].blown)), 6, 'the truck');
const byTruck = await G((id) => window.__game.debug.game.paint.guards.find((q) => q.npc.id === id)?.markedBy ?? null, tank.by);
check('the truck goes up (fire, smoke, the shake) and the Order\'s man beside it sits down marked', !!s && !!byTruck, `${tank.by}: ${byTruck}`);
await step(0.4);
await snap('s5-truck');
const W4 = ['og3', 'og14', 'og15', 'og16', 'og5', 'og6'], W4B = ['og7', 'og8', 'og9', 'og10', 'og11', 'og12'];
await markAll(W4);
s = await until(async () => (await G(() => window.__r.F().doors.exit.open)), 10, 'the great door');
check('the second wave: the great door to the surface rises and more of them come in', !!s);
let ev = null;
const shutOut = new Set(), cameIn = new Set();
for (let k = 0; k < 20; k++) {
  await step(1);
  if (k === 5) await snap('s6-hangar');
  // each of the second wave is in the hangar itself (through the great door, out of the side room's doorway)
  for (const q of await G((ids) => { const f = window.__r.F(); return window.__game.debug.game.paint.guards.filter((g) => ids.includes(g.npc.id) && g.npc.visible && !g.marked).map((g) => ({ id: g.npc.id, zone: f.zoneAt(g.npc.pos.x, g.npc.pos.z) })); }, W4B)) (q.zone === 'hangar' ? cameIn : shutOut).add(`${q.id}:${q.zone}`);
  await markAll(W4B);
  ev = await G(() => { const m = window.__game.debug.game.missions.active, f = window.__r.F(); return { tanker: f.hangar.vehicles[2].blown, truss: !!m?.beams?.some((b) => b.done), shut: f.doors.exit.locked, step: m?.stepIndex }; });
  if (ev.tanker && ev.truss && ev.shut) break;
}
check('the tanker goes up (the Order\'s charge, warned), the crane\'s truss comes down, the great door shuts again', ev.tanker && ev.truss && ev.shut, JSON.stringify(ev));
check('every man of the second wave comes into the hangar (none left on the ramp, none behind the side room\'s wall)', cameIn.size >= 4 && shutOut.size === 0, `${[...cameIn].join(',')} | ${[...shutOut].join(',')}`);
await markAll(W4B);
await markNow();
s = await talkThrough((s) => s.mission?.step === 5, 15, 'the side room');
s = await talkThrough(() => said('נהוראי! הדלת נתקעה! אני לכוד פה!'), 30, 'Erez trapped');
check('Erez checks the side room; the Order\'s charge jams its door with him behind it', !!s && (await G(() => { const f = window.__r.F(), e = window.__game.debug.game.npc('erez'); return f.doors.trap.locked && f.zoneAt(e.pos.x, e.pos.z) === 'trap'; })));
await snap('s7-trapped');
// the crane's truss lies where it came down (a solid block across the middle of the hangar)
const truss = () => G(() => { const D = window.__game.debug, f = window.__r.F(); return [28.5, 32, 35.5].every((lz) => D.world.cols.blocks(f.x + 62, f.y + 0.5, f.z + lz)) && D.scene.children.some((o) => o.isMesh && o.geometry?.parameters?.depth === 14 && Math.abs(o.position.x - (f.x + 62)) < 0.6 && Math.abs(o.position.z - (f.z + 32)) < 0.6); });
let between = null; // (in the moment between mission 40's end and 41's start too)
s = await talkThrough(async (s) => { if (!s.mission && between === null && (await G(() => window.__game.debug.game.progress.done.includes('portwar')))) between = await truss(); return s.mission?.id === 'wounded'; }, 30, 'mission 41');
check('mission 40 done; "נהוראי נפצע!" follows on in the hangar', !!s && (await G(() => window.__game.debug.game.progress.done.includes('portwar'))));
check('the crane\'s truss still lies across the hangar as mission 40 left it (between the two missions too)', between === true && (await truss()), `between: ${between}`);

// ---------- mission 41: Nehorai hurt; Ido saves him ----------
s = await talkThrough((s) => s.mission?.step === 1, 30, 'the door');
check('goal: "לחלץ את ארז · הדלת הפגועה"', !!s && s.objective.includes('לחלץ את ארז'), s?.objective);
// three marks at the door: the fail screen with this mission's own tip; a retry there
await G(() => { const P = window.__game.debug.game.paint; P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); });
expectFail = true;
s = await until((s) => s.fail, 5, 'the fail screen at the door');
const doorTip = await text('#failReason');
check('marked three times at the damaged door: the fail screen, its tip about the door (not chapter eight\'s)', !!s && /סומן שלוש פעמים/.test(doorTip) && /לדלת/.test(doorTip) && !/נשאר מאחורי/.test(doorTip), doorTip);
await page.tap('#retryBtn');
await holdLoop(true);
expectFail = false;
s = await until((s) => s.mission?.step === 1 && !s.fail, 10, 'the retry at the door');
check('retry: back by the side room, the marks wiped, Erez still shut in behind the damaged door', !!s && s.hits === 0 && (await G(() => { const f = window.__r.F(), e = window.__game.debug.game.npc('erez'); return f.doors.trap.locked && f.zoneAt(e.pos.x, e.pos.z) === 'trap'; })));
await tp(P.trapAt);
await until(async () => (await G(() => !!window.__game.debug.game.missions.active?.w?.door?.done)), 10, 'the three at the side room'); await markAll(['og1', 'og2', 'og4']); // down before the work
check('"לשחרר את הדלת הפגועה"', await interact('לשחרר את הדלת הפגועה'));
await markNow();
s = await talkThrough((s) => s.mission?.step === 2, 20, 'Erez out');
check('four seconds at the door: Erez out — "אחי… חשבתי שאני נשאר שם."', !!s && said('אחי… חשבתי שאני נשאר שם.') && (await G(() => window.__r.F().doors.trap.open)));
// the blast: a warning, then the throw, the daze, the dull sound; no mark fails it
s = await until(async () => (await G(() => window.__game.debug.game.missions.active.live.some((b) => b.ring && !b.done))), 4, 'the warning');
check('the blast warns first (the ring, the beeps; he shoves Erez clear)', !!s);
await G(() => { const P = window.__game.debug.game.paint; P.hits = 3; }); // whatever marks he has, none of it counts now
s = await until(async () => (await G(() => window.__game.debug.game.overlay.state.daze)) > 0.5, 6, 'the daze');
const hurt = await G(() => { const g = window.__game.debug.game; return { pose: g.nehorai.pose, music: g.sound?.musicMode, beat: !!(g.sound?.atmosphere?.heartbeat || g.sound?.beatWanted), as: g.playingAs, fail: !g.hud.el.fail.hidden }; });
check('the blast throws Nehorai to the floor: the picture blurred, the music cut, a muffled heartbeat', !!s && hurt.pose === 'floored' && hurt.music === null && hurt.beat && hurt.as === 'nehorai' && !hurt.fail, JSON.stringify(hurt));
await snap('s8-blast');
let tried = false, fail = false, idoShout = null;
s = await talkThrough(async (s) => { if ((await G(() => window.__game.debug.game.nehorai.pose)) === 'down') tried = true; if (s.fail) fail = true; if (!idoShout && said('נהוראיייי!!!')) idoShout = await G(() => window.__r.pt(window.__game.debug.game.npc('ido').pos)); return said('תוציאו… את כולם…'); }, 30, 'the lines');
check('he tries to get up and falls back', tried);
check('Ido: "נהוראיייי!!!" · Erez: "אחי, תסתכל עליי! אל תעצום עיניים!" · Nehorai: "תוציאו… את כולם…"', said('נהוראיייי!!!') && said('אחי, תסתכל עליי! אל תעצום עיניים!') && said('תוציאו… את כולם…'), heard.slice(-5).join(' / '));
s = await until(async (s) => { if (s.fail) fail = true; return (await G(() => window.__game.debug.game.overlay.state.eyes)) > 0.95; }, 8, 'the eyes to close');
check('the eyes close; the screen goes black', !!s);
s = await until(async (s) => { if (s.fail) fail = true; return s.mission?.step === 3; }, 12, 'Ido');
const ban = await text('#banner');
check('no Game Over: no fail screen through all of it, three marks or not', !fail && !(await S()).fail);
check('the player is Ido now; on the screen: "SAVE NAHORAI – הצילו את נהוראי!"', !!s && s.me.as === 'ido' && ban.includes('SAVE NAHORAI – הצילו את נהוראי!') && s.armed, ban.replace(/\s+/g, ' '));
check('Nehorai on the floor where the blast threw him (no marker, nobody\'s obstacle); Erez over him', await G(() => { const g = window.__game.debug.game, n = g.npc('nehorai'), e = g.npc('erez'); return n.visible && n.model.pose === 'floored' && !n.body.enabled && Math.hypot(e.pos.x - n.pos.x, e.pos.z - n.pos.z) < 2.5 && !g.paint.allies.some((a) => a.npc === n); }));
check('goal 1: "1. להגיע לנהוראי"', s?.objective.startsWith('1. להגיע לנהוראי'), s?.objective);
check('the controls come to Ido where he shouted from (across the hangar, facing him)', !!s && !!idoShout && Math.hypot(s.me.x - idoShout.x, s.me.z - idoShout.z) < 1.0, JSON.stringify({ idoShout, me: s?.me }));
await snap('s9-ido');
const nd = await G(() => window.__r.pt(window.__game.debug.game.npc('nehorai').pos));
await tp(nd, -1.4, 1.2);
s = await until((s) => s.mission?.step === 4, 5, 'goal 2');
check('reached him; goal 2: "2. להגן עליו"', !!s && s.objective.startsWith('2. להגן עליו'), s?.objective);
s = await until(async () => (await onBoard()).length >= 4, 15, 'the men who come for him');
check('the Order\'s men come for him (through the great door and the west doors)', !!s, (await onBoard()).join(','));
// a reload here: picked up as Ido, Nehorai on the floor, Erez by him
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
const summary = await text('#startScreen');
await boot();
await install();
await holdLoop(true);
s = await S();
const back = await G(() => { const g = window.__game.debug.game, n = g.npc('nehorai'), e = g.npc('erez'); return { as: g.playingAs, pose: n.model.pose, vis: n.visible, erez: Math.hypot(e.pos.x - n.pos.x, e.pos.z - n.pos.z), armed: g.paint.armed, color: g.paint.player?.color, squad: g.squad.ids.length, lead: g.squad.leaderId, map: g.overlay.state.mapHidden }; });
check('a reload: "continue" picks it up at goal 2, as Ido (his own marker), Nehorai on the floor, Erez by him, the gang with Ido', /באמצע/.test(summary) && s.mission?.id === 'wounded' && s.mission.step === 4 && back.as === 'ido' && back.pose === 'floored' && back.vis && back.erez < 2.5 && back.armed && back.color === '#36c3ff' && back.squad === 7 && back.lead === 'ido' && back.map, JSON.stringify(back));
s = await until(async () => { await markAll(await G(() => { const w = window.__game.debug.game.missions.active.w.him; return w.out.filter((g) => !g.marked).slice(1).map((g) => g.npc.id); })); return G(() => window.__game.debug.game.missions.active.w.him.done); }, 15, 'the wave in');
const cameFor = await G(() => { const g = window.__game.debug.game, f = window.__r.F(); return g.missions.active.w.him.out.map((gd) => `${gd.npc.id}:${f.zoneAt(gd.npc.pos.x, gd.npc.pos.z)}`); });
check('every one of them who came for him is in the hangar itself (none left out by the great door)', cameFor.length === 5 && cameFor.every((q) => q.endsWith(':hangar')), cameFor.join(','));
check('Ido\'s own marker: one of them marked with real paint', await shootLast(['og13', 'og5', 'og6', 'og3', 'og14']));
await markAll(['og13', 'og5', 'og6', 'og3', 'og14']);
s = await talkThrough((s) => s.mission?.step === 5, 15, 'goal 3');
check('goal 3: "3. למצוא ערכת עזרה ראשונה · על הקיר המערבי של ההאנגר"', !!s && s.objective.startsWith('3. למצוא ערכת עזרה ראשונה'), s?.objective);
await tp(P.kit);
check('the great door down again behind them, nobody left out on the ramp', await G(() => window.__r.F().doors.exit.locked));
check('"לקחת את ערכת העזרה הראשונה"', await interact('לקחת את ערכת העזרה הראשונה'));
s = await until((s) => s.mission?.step === 6, 5, 'goal 4');
check('the kit off the wall; goal 4: "4. לבצע טיפול"', !!s && s.objective.includes('4.') && (await G(() => window.__r.F().medkit.taken)), s?.objective);
await tp(nd, -1.3, 1.0);
check('"לטפל בנהוראי" — the treatment', await interact('לטפל בנהוראי'));
s = await until((s) => s.mission?.step === 7, 8, 'goal 5');
check('four seconds by him: a bandage on his head; goal 5: "5. להעביר את נהוראי לחדר הבטוח"', !!s && s.objective.startsWith('5. להעביר את נהוראי') && (await G(() => !!window.__game.debug.game.npc('nehorai').model.bones.head.getObjectByName('bandage'))), s?.objective);
check('"להרים את נהוראי עם ארז"', await interact('להרים את נהוראי עם ארז'));
await step(0.5);
const carry = await G(() => { const g = window.__game.debug.game, n = g.npc('nehorai'), e = g.npc('erez'), me = g.player.pos; return { slow: g.player.speedScale, up: n.pos.y - me.y, dn: Math.hypot(n.pos.x - me.x, n.pos.z - me.z), de: Math.hypot(e.pos.x - me.x, e.pos.z - me.z), erez: e.model.pose, ido: g.nehorai.pose }; });
check('Ido and Erez lift him between them (both carrying); slowly', carry.slow < 0.7 && carry.up > 0.4 && carry.dn > 0.6 && carry.dn < 1.6 && carry.de > 1.2 && carry.de < 2.6 && carry.erez === 'carry' && carry.ido === 'carry', JSON.stringify(carry));
await snap('s10-carry');
const t0 = (await G(() => window.__game.debug.game.time));
await tp(P.doorAt, 0, -0.6, Math.PI, 150);
const bed = await G(() => { const b = window.__r.F().saferoom.bed; return { x: b.x - 1.05, z: b.z + 0.1, y: window.__r.F().y }; });
await tp(bed, 0, 0, null, 60);
s = await until((s) => s.mission?.step === 8, 5, 'goal 6');
const walked = (await G(() => window.__game.debug.game.time)) - t0;
check('the carry walked to the safe room (Erez and Nehorai with him all the way); he is laid on the cot', !!s && walked > 8 && (await G(() => { const n = window.__game.debug.game.npc('nehorai'); return window.__r.F().zoneAt(n.pos.x, n.pos.z) === 'saferoom' && n.model.pose === 'floored'; })), `${walked.toFixed(0)} s`);
check('goal 6: "6. להפעיל את דלת הביטחון"', !!s && s.objective.startsWith('6. להפעיל את דלת הביטחון'), s?.objective);
await tp(P.wheel);
check('"לסובב את גלגל הדלת"', await interact('לסובב את גלגל הדלת'));
s = await until((s) => s.mission?.step === 9, 6, 'goal 7');
check('goal 7: "7. להחזיק את הכניסה · הטיפול: 35 שנ׳"', !!s && s.objective.startsWith('7. להחזיק את הכניסה') && /הטיפול/.test(await text('#pursuit')), s?.objective);
await step(1.5);
const leaf = await G(() => { const d = window.__r.F().saferoom.door; return { lamp: d.lamp.state, open: d.open, swung: +(d.pivot.rotation.y - (d.yaw - Math.PI / 2 * 0.9)).toFixed(3) }; });
check('the wheel turned: the security door starts closing (its leaf partway in, its lamp amber)', leaf.lamp === 'amber' && leaf.open && leaf.swung > 0.05, JSON.stringify(leaf));
// Ido marked three times at the door: the fail screen (his own), a retry at the doorway, still as Ido
await G(() => { const P = window.__game.debug.game.paint; P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); P.markPlayer(null, '#7bd88f'); });
expectFail = true;
s = await until((s) => s.fail, 5, 'the fail screen');
check('Ido marked three times: the fail screen (a reason and a tip)', !!s && /עידו סומן שלוש פעמים/.test(await text('#failReason')), await text('#failReason'));
await page.tap('#retryBtn');
await holdLoop(true);
expectFail = false;
s = await until((s) => s.mission?.step === 9 && !s.fail, 10, 'the retry');
check('retry: back at the doorway as Ido, Nehorai on the cot with his bandage, the friends at the door', !!s && s.me.as === 'ido' && s.hits === 0 && (await G(() => { const g = window.__game.debug.game, n = g.npc('nehorai'), f = window.__r.F(); return f.zoneAt(n.pos.x, n.pos.z) === 'saferoom' && !!n.model.bones.head.getObjectByName('bandage') && f.saferoom.door.open; })));
// Ido back from the doorway's line, inside; the friends hold the hangar side of the door
await tp(await L(43.6, 62), 0, 0, 0);
let paused = false;
s = await until(async () => (await onBoard()).length > 0, 10, 'the last of them');
// one of them reaches the doorway: the treatment waits
await G((at) => { const P = window.__game.debug.game.paint, gd = P.guards.find((q) => !q.marked && q.npc.visible); if (gd) { for (const a of P.allies) a.cool = 3; // (the friends between two shots: only the treatment's clock is watched here)
  gd.npc.place(at.x + 1.5, at.z - 4, 0, at.y); P.setRoute(gd, [{ x: at.x + 1.5, z: at.z - 4 }], { still: true }); } }, P.doorAt);
const left0 = (await M())?.s.left;
await step(0.4);
const q0 = await M();
paused = !!q0?.s.under && Math.abs(q0.s.left - left0) < 0.05 && (await S()).objective.includes('ארז לא יכול לטפל');
for (let k = 0; k < 120; k++) {
  await step(0.5);
  const q = await M();
  if (k % 4 === 0) await markAll(['og7', 'og8', 'og9', 'og10', 'og11', 'og12']);
  if ((q?.s.left ?? 1) <= 0) break;
}
check('the treatment stops while the Order is at the doorway; runs on once they are marked', paused && ((await M())?.s.left ?? 1) <= 0, JSON.stringify({ left0, q0: q0?.s }));
await tp(P.doorIn, 0, 1.6);
await markNow();
s = await talkThrough((s) => s.mission?.step === 10, 20, 'the door sealed');
check('everyone in; the security door seals', !!s && (await G(() => { const f = window.__r.F(), g = window.__game.debug.game; return f.saferoom.door.locked && g.squad.ids.every((id) => f.zoneAt(g.npc(id).pos.x, g.npc(id).pos.z) === 'saferoom'); })));
s = await talkThrough(() => said('הוא לא עוזב אותנו. אני מכיר אותו.'), 30, 'the quiet');
const calm = await G(() => window.__game.debug.game.sound?.musicMode);
check('the quiet: Erez sits by him — "נהוראי, אחי… אתה לא יכול לעזוב אותנו עכשיו." · Ido "הוא לא עוזב אותנו. אני מכיר אותו."', !!s && said('נהוראי, אחי… אתה לא יכול לעזוב אותנו עכשיו.') && (await G(() => window.__game.debug.game.npc('erez').model.pose === 'sit')));
await snap('s11-quiet');
s = await talkThrough(async () => (await G(() => window.__game.debug.game.sound?.musicMode)) === null, 6, 'the music');
check('the music goes quiet (calm, then nothing)', !!s && calm === 'calm');
const tq = await G(() => window.__game.debug.game.time);
s = await talkThrough((s) => s.mission?.id === 'comeback', 30, 'mission 42');
const quietFor = (await G(() => window.__game.debug.game.time)) - tq;
check('a few seconds where nothing happens; mission 41 done; "הקאמבק של נהוראי" follows on', !!s && quietFor > 3.5 && (await G(() => window.__game.debug.game.progress.done.includes('wounded'))), `${quietFor.toFixed(1)} s`);

// ---------- mission 42: the comeback ----------
await markNow();
s = await S();
check('black: the eyes shut', (await G(() => window.__game.debug.game.overlay.state.eyes)) > 0.95);
s = await talkThrough(() => said('נהוראי… נו כבר אחי, תקום.'), 15, 'Ido\'s voice');
check('Ido\'s voice in the black: "נהוראי… נו כבר אחי, תקום."', !!s && (await G(() => window.__game.debug.game.overlay.state.eyes)) > 0.5);
s = await talkThrough(async () => (await G(() => window.__game.debug.game.overlay.state.eyes)) < 0.1, 15, 'the eyes to open');
const pov = await G(() => { const g = window.__game.debug.game, c = g.camera.position, i = g.nehorai.root.position, e = g.npc('erez').pos; return { di: Math.hypot(c.x - i.x, c.z - i.z), de: Math.hypot(c.x - e.x, c.z - e.z), low: c.y - window.__r.F().y }; });
check('slowly the eyes open: the camera on Ido\'s and Erez\'s faces over him', !!s && pov.di < 2 && pov.de < 2 && pov.low < 1.6, JSON.stringify(pov));
await snap('s12-faces');
s = await talkThrough((s) => s.mission?.step === 1, 60, 'the lines');
check('"ארז!!! הוא התעורר!!!" · "ידעתי שתקום, יא משוגע!" · "לאט, אחי, אתה פצוע."', said('ארז!!! הוא התעורר!!!') && said('ידעתי שתקום, יא משוגע!') && said('לאט, אחי, אתה פצוע.'));
check('"איפה הרובה שלי?" · "אחי, כמעט איבדנו אותך!" · "שמעתי. עכשיו איפה הרובה?"', said('איפה הרובה שלי?') && said('אחי, כמעט איבדנו אותך!') && said('שמעתי. עכשיו איפה הרובה?'));
check('he sits up on the cot; goal: "לתת לנהוראי את הרובה" (the player still Ido)', !!s && s.me.as === 'ido' && s.objective.startsWith('לתת לנהוראי את הרובה') && (await G(() => window.__game.debug.game.npc('nehorai').model.pose === 'sit')), s?.objective);
check('"לתת לנהוראי את הרובה"', await interact('לתת לנהוראי את הרובה'));
await markNow();
s = await until((s) => s.mission?.step === 2, 4, 'he stands');
check('Ido gives him the rifle: his own marker in his own colour in his hands', !!s && (await G(() => { const g = window.__game.debug.game, a = g.paint.allies.find((q) => q.npc.id === 'nehorai'); return !!a && a.color === '#ff5c8a'; })));
const cam0 = await G(() => ({ ...window.__game.debug.game.camera.position }));
s = await talkThrough(async () => (await G(() => !!window.__game.debug.game.missions.active?.s?.orbit)), 8, 'the orbit');
await step(1.5);
const cam1 = await G(() => ({ ...window.__game.debug.game.camera.position }));
check('he stands, slowly; the music rises; the camera goes round him', !!s && Math.hypot(cam1.x - cam0.x, cam1.z - cam0.z) > 0.8 && (await G(() => window.__game.debug.game.sound?.musicMode)) === 'action');
await snap('s13-round');
s = await talkThrough((s) => s.mission?.step === 3, 20, 'back to Nehorai');
check('Nehorai: "יאללה חבר’ה. בואו נסיים את זה."', said('יאללה חבר’ה. בואו נסיים את זה.'));
const me = await G(() => { const g = window.__game.debug.game; return { as: g.playingAs, speed: g.player.speedScale, hp: g.fighter.hp, armed: g.paint.armed, color: g.paint.player?.color, hits: g.paint.hits, ammo: g.paint.player?.ammo, band: !!g.nehorai.bones.head.getObjectByName('bandage'), npc: g.npc('nehorai').visible, ido: g.npc('ido').visible && g.paint.allies.some((a) => a.npc.id === 'ido'), squad: g.squad.ids.length, lead: g.squad.leaderId }; });
check('back to Nehorai: slow at first, full health, his own marker and a full hopper, the bandage on, Ido one of the gang again', !!s && me.as === 'nehorai' && me.speed <= 0.55 && me.hp === 100 && me.armed && me.color === '#ff5c8a' && me.hits === 0 && me.ammo === 8 && me.band && !me.npc && me.ido && me.squad === 8 && me.lead === 'nehorai', JSON.stringify(me));
check('goal: "לפתוח את דלת הביטחון · הגלגל ליד הדלת · כוח 50%"', !!s && s.objective.includes('לפתוח את דלת הביטחון') && s.objective.includes('כוח 50%'), s?.objective);
await tp(P.wheel);
check('"לפתוח את דלת הביטחון"', await interact('לפתוח את דלת הביטחון'));
s = await until(async () => (await G(() => window.__r.F().saferoom.door.open)), 6, 'the door');
await tp(P.doorAt, 0, -2);
s = await until((s) => s.mission?.step === 4, 5, 'the great door');
const sp1 = (await S()).me.speed;
check('out into the hangar: steadier with each step; goal "הדלת הגדולה: לסמן אותם (0/3)"', !!s && sp1 > 0.55 && sp1 < 1 && s.objective.includes('הדלת הגדולה'), `${sp1.toFixed(2)} · ${s?.objective}`);
await tp(await L(66, 27), 0, 0, Math.PI / 2);
const sp2 = (await S()).me.speed;
check('his legs his own again (the walk back to full speed)', sp2 === 1, sp2.toFixed(2));
// the gang came with him: nobody kept in the safe room by the places they had there, all of them about him
const gangOut = () => G(() => { const g = window.__game.debug.game, f = window.__r.F(), me = g.player.pos; return { tasks: g.squad.tasks.size, squad: g.squad.ids.length, room: g.squad.ids.filter((id) => f.zoneAt(g.npc(id).pos.x, g.npc(id).pos.z) === 'saferoom').length, by: g.squad.ids.filter((id) => { const n = g.npc(id); return n.visible && Math.hypot(n.pos.x - me.x, n.pos.z - me.z) < 16; }).length }; });
s = await until(async () => { const q = await gangOut(); return q.tasks === 0 && q.room === 0 && q.by >= 6; }, 10, 'the gang with him');
check('the whole gang follows him out of the safe room and across the hangar (not only Ido)', !!s, JSON.stringify(await gangOut()));
check('the crane\'s truss still lies across the hangar', await truss());
check('the last three at the great door: one marked with his own paint', await shootLast(['og15', 'og16', 'og1']));
await markAll(['og16', 'og1']);
s = await talkThrough((s) => s.objective.includes('לפתוח את דלת היציאה'), 10, 'the panel');
await tp(P.panel);
check('"לפתוח את דלת היציאה" at the panel', await interact('לפתוח את דלת היציאה'));
s = await until((s) => s.mission?.step === 5, 6, 'the ramp');
check('the great door rises; goal: "במעלה הרמפה · אל פני השטח"', !!s && (await G(() => window.__r.F().doors.exit.open)) && s.objective.includes('אל פני השטח'), s?.objective);
await tp(P.outside, 0, 0, null, 60);
s = await until((s) => s.mission?.id !== 'comeback', 8, 'the surface');
await step(2);
const end = await G(() => { const g = window.__game.debug.game, f = window.__r.F(), p = g.player.pos; return { done: g.progress.done.includes('comeback'), next: g.missions.active?.def.id, d: Math.hypot(p.x - f.exit.outside.x, p.z - f.exit.outside.z), armed: g.paint.armed, squad: g.squad.ids.length, as: g.playingAs, map: g.overlay.state.mapHidden, speed: g.player.speedScale }; });
check('mission 42 done; mission 43 begins at the facility\'s exit to the surface, Nehorai armed and the gang with him', !!s && end.done && end.next === 'blacktower' && end.d < 6 && end.armed && end.squad === 8 && end.as === 'nehorai' && !end.map && end.speed === 1, JSON.stringify(end));
await snap('s14-surface');

check('every way the story sends him walked on foot (doors open, nobody in a doorway)', walks.length >= 20 && walks.every((w) => w.res === 'ok' || w.res === 'a scene'), `${walks.length} walks · ${walks.filter((w) => w.res !== 'ok').map((w) => w.res).join(' | ')}`);
check('no fail screen nobody asked for (every stretch played through)', unexpected.length === 0, unexpected.join(' | '));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed  (${mins()} min)`);
await browser.close();
process.exit(failed.length ? 1 : 0);
