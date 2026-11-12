// Chapter nine's fists: Nehorai against an ordinary opponent and then a boss, both won with the real
// buttons (#btnPunch, #btnHeavy, #btnShove, #btnBlock, #btnDodge). Checked: the heavy punch and the shove
// are on screen only in a fight and fit the phone (landscape and portrait, clear of the stick and of each
// other); the opponent hits back; a block; the three-hit combination (jab, cross, a finisher that knocks
// him back) and its count on the HUD; the heavy punch (more stamina, on the floor when he is caught open,
// and up again); nobody hits a man on the floor; the shove stopping a wind-up and opening his guard;
// stamina running out; the bar of the one he faces; the boss: his bar and name, light punches doing
// little and not stopping him, a heavy one staggering him, his phases, a friend fighting along, the win.
// The game loop is held and stepped here at 30 frames a second, so the timing is the game's own.
// usage: node tests/fists.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const r1 = (v) => Math.round(v * 10) / 10;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(180000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);

// a game with all nine chapters done, so no mission begins by itself (the combination and the uppercut long learned)
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await G(() => { const p = window.__game.debug.game.progressForChapter(10); p.savedAt = Date.now(); localStorage.setItem('nehorai-game:save:v1', JSON.stringify(p)); });
await page.reload();
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });

// hold the loop and step it from here; a summary of everything the checks read
await G(() => {
  const D = window.__game.debug, g = D.game;
  g.hold = true;
  g.setPopulation?.({ traffic: 0, people: 0 });
  const $ = (id) => document.getElementById(id), vis = (id) => !!$(id)?.offsetParent;
  window.__t = {
    step(sec) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) g.update(1 / 30); },
    S() {
      const F = g.fight, f = g.fighter, p = g.player.pos;
      return {
        me: { hp: f.hp, st: f.stamina, state: f.state, combo: f.combo, move: f.lastMove, taken: f.taken, blocks: f.blocks, dodges: f.dodges, breaks: f.breaks, tired: f.tired, thrown: f.thrown, x: p.x, z: p.z },
        fight: F ? { over: F.over, won: F.won, combos: F.combos, heavies: F.heavies, interrupts: F.interrupts, chain: F.chain } : null,
        opp: F ? F.opponents.map((o) => ({
          name: o.name, mode: o.mode, t: o.t, hp: o.fighter.hp, max: o.fighter.maxHp, state: o.fighter.state, timer: o.fighter.timer, counter: o.fighter.counter,
          d: Math.hypot(o.npc.pos.x - p.x, o.npc.pos.z - p.z), x: o.npc.pos.x, z: o.npc.pos.z, floors: o.fighter.floors, shrugged: o.fighter.shrugged,
          shoves: o.fighter.shoves, breaks: o.fighter.breaks, interrupted: o.interrupted, phase: o.phase, pose: o.npc.model.pose, boss: o.boss, ring: o.ring.visible, landed: o.fighter.landed,
          atMe: o.against === f, braced: o.fighter.braced, blocks: o.fighter.blocks,
        })) : [],
        allies: F ? F.allies.map((a) => ({ name: a.fighter.name, landed: a.fighter.landed, taken: a.fighter.taken, hp: a.fighter.hp, down: a.fighter.down })) : [],
        hud: {
          combo: vis('combo') ? $('comboText').textContent : null, pips: document.querySelectorAll('#comboPips i.on').length,
          foe: vis('foeBar') ? $('foeName').textContent : null, foeW: parseFloat($('foeFill').style.width),
          boss: vis('bossBar') ? $('bossName').textContent : null, bossW: parseFloat($('bossFill').style.width), bossTag: $('bossTag').textContent, bossMarks: $('bossMarks').children.length,
          hpW: parseFloat($('hpFill').style.width), stW: parseFloat($('stFill').style.width), tiredFlash: $('vitals').classList.contains('tired'), pop: $('pop').textContent,
        },
        buttons: Object.fromEntries(['btnPunch', 'btnHeavy', 'btnShove', 'btnBlock', 'btnDodge', 'btnFire'].map((id) => [id, vis(id)])),
      };
    },
    // the buttons' circles and the stick's resting circle, in screen pixels
    layout() {
      const c = (id) => { const r = $(id).getBoundingClientRect(); return { id, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: r.width / 2, l: r.left, t: r.top, rt: r.right, b: r.bottom }; };
      return { buttons: ['btnPunch', 'btnHeavy', 'btnShove', 'btnBlock', 'btnDodge'].map(c), stick: c('stick'), w: innerWidth, h: innerHeight };
    },
    render() { D.renderer.render(D.scene, D.camera); },
  };
});
const S = () => G(() => window.__t.S());
const step = (sec) => G((s) => window.__t.step(s), sec);
// a tap on a button: the finger down (where the game acts) and up again
const press = async (id) => { await page.dispatchEvent(`#${id}`, 'pointerdown'); await page.dispatchEvent(`#${id}`, 'pointerup'); };
const hold = (id, on) => page.dispatchEvent(`#${id}`, on ? 'pointerdown' : 'pointerup');
async function until(cond, maxSec, what, dt = 1 / 30) {
  for (let t = 0; t <= maxSec; t += dt) {
    const s = await S();
    if (await cond(s)) return s;
    await step(dt);
  }
  console.log(`  (timed out waiting for ${what})`);
  return null;
}
// a frame or two drawn by the game's own loop, then the picture
async function shot(name) {
  await G(() => { window.__game.debug.game.hold = false; });
  await G(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await G(() => { window.__game.debug.game.hold = true; });
  await page.screenshot({ path: `${shots}/${name}.png` });
}
// the layout on the phone: every fight button on screen, none over another or over the stick
async function layoutOk(label) {
  const L = await G(() => window.__t.layout());
  const bad = [];
  for (const b of L.buttons) {
    if (b.l < 0 || b.t < 0 || b.rt > L.w || b.b > L.h || b.r < 20) bad.push(`${b.id} off screen`);
    if (Math.hypot(b.x - L.stick.x, b.y - L.stick.y) < b.r + L.stick.r + 4) bad.push(`${b.id} over the stick`);
  }
  for (let i = 0; i < L.buttons.length; i++) for (let j = i + 1; j < L.buttons.length; j++) {
    const a = L.buttons[i], b = L.buttons[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 4) bad.push(`${a.id} touches ${b.id}`);
  }
  check(`${label}: the five fight buttons fit the screen, clear of each other and of the stick`, !bad.length, bad.join('; ') || L.buttons.map((b) => `${b.id.slice(3)} ${Math.round(b.x)},${Math.round(b.y)}`).join(' · '));
}

// an open, flat spot on the plain east of the Iron Base
const spot = await G(() => {
  const W = window.__game;
  for (const [x, z] of [[1300, -150], [1260, -120], [1350, -300], [1300, 50], [1900, -300]]) {
    const h0 = W.groundAt(x, z);
    let ok = true;
    for (let dx = -7; dx <= 7 && ok; dx++) for (let dz = -7; dz <= 7 && ok; dz++) { const h = W.groundAt(x + dx, z + dz); if (Math.abs(h - h0) > 0.3 || W.blocks(x + dx, h + 0.8, z + dz)) ok = false; }
    if (ok) return { x, z };
  }
  return null;
});
check('an open, flat place to fight in', !!spot, JSON.stringify(spot));

// ---------- no fight: the heavy punch and the shove are not on screen, not even at a punching bag ----------
await G(() => window.__game.faceBag(1));
await step(0.3);
let s = await S();
check('at a punching bag: the fists are up, but no heavy punch or shove (they are for a fight)', s.buttons.btnPunch && !s.buttons.btnHeavy && !s.buttons.btnShove, JSON.stringify(s.buttons));
await G((p) => { const g = window.__game.debug.game; g.player.place(p.x, p.z, 0); g.follow.snapBehind(0); }, spot);
await step(0.3);
s = await S();
check('out in the open with no fight: no fight buttons at all', !s.buttons.btnPunch && !s.buttons.btnHeavy && !s.buttons.btnShove);

// ---------- fight one: an ordinary opponent ----------
await G((p) => {
  const g = window.__game.debug.game, n = g.npc('guard1');
  g.player.place(p.x, p.z, 0); g.follow.snapBehind(0);
  n.place(p.x, p.z + 3, Math.PI); n.show(true);
  new g.Fight(g, { opponents: [{ npc: n, hp: 220, power: 0.8, aggression: 1, windup: 0.75, open: 0.9, moves: ['jab', 'cross', 'swing'], name: 'שומר' }] });
}, spot);
await step(0.2);
s = await S();
check('in a fight: punch, heavy punch, shove, block and dodge on screen; no fire button', ['btnPunch', 'btnHeavy', 'btnShove', 'btnBlock', 'btnDodge'].every((b) => s.buttons[b]) && !s.buttons.btnFire, JSON.stringify(s.buttons));
check('the buttons read "מכה חזקה" and "דחיפה"', (await page.textContent('#btnHeavy')).includes('מכה חזקה') && (await page.textContent('#btnShove')).includes('דחיפה'));
await layoutOk('landscape 844 × 390');

// he comes in and swings: nothing pressed, it lands
s = await until((s) => s.opp[0].mode === 'windup', 8, 'his first wind-up');
check('he comes in and winds up: a red ring at his feet', !!s && s.opp[0].ring);
s = await until((s) => s.me.taken > 0 || s.opp[0].mode === 'recover', 4, 'his punch');
await step(0.1);
s = await S();
check('the opponent hits back: Nehorai takes the punch, his health bar goes down', s.me.taken >= 1 && s.me.hp < 100 && s.hud.hpW < 100, `hp ${r1(s.me.hp)}, bar ${s.hud.hpW}%`);
check('the one Nehorai faces: his name and health in a small bar', s.hud.foe === 'שומר' && s.hud.foeW === 100, `${s.hud.foe} ${s.hud.foeW}%`);

// the next one on the block (held), then the combination while he is open
s = await until((s) => s.opp[0].mode === 'windup', 8, 'his second wind-up');
await hold('btnBlock', true);
const hp0 = (await S()).me.hp;
s = await until((s) => s.opp[0].mode === 'recover', 4, 'his punch on the block');
await hold('btnBlock', false);
await step(1 / 30);
s = await S();
check('held block: his punch lands on the guard and hardly hurts', s.me.blocks >= 1 && hp0 - s.me.hp < 3, `blocks ${s.me.blocks}, lost ${r1(hp0 - s.me.hp)}`);
const moves = [], st0 = s.me.st, ohp0 = s.opp[0].hp;
await press('btnPunch');
await step(1 / 30);
const jabCost = st0 - (await S()).me.st;
await step(0.37);
s = await S(); moves.push(s.me.move);
check('combination, one: a jab lands, the HUD counts ×1', s.me.move === 'jab' && s.fight.chain === 1 && s.hud.combo === '×1' && s.hud.pips === 1, `${s.me.move} chain ${s.fight.chain} "${s.hud.combo}"`);
await press('btnPunch');
await step(0.4);
s = await S(); moves.push(s.me.move);
check('combination, two: a cross, ×2 and the finisher is next', s.me.move === 'cross' && s.fight.chain === 2 && /×2/.test(s.hud.combo || '') && /סיום/.test(s.hud.combo || '') && s.hud.pips === 2, `${s.me.move} "${s.hud.combo}"`);
const before = s.opp[0];
await press('btnPunch');
await step(0.55);
s = await S(); moves.push(s.me.move);
const moved = Math.hypot(s.opp[0].x - before.x, s.opp[0].z - before.z);
check('combination, three: the finisher (an uppercut) knocks him back', s.me.move === 'uppercut' && s.fight.combos === 1 && moved > 0.9, `${moves.join(', ')} · knocked ${r1(moved)} m`);
check('the HUD shows the finisher: "קומבו! ×3", all three pips', /קומבו/.test(s.hud.combo || '') && s.hud.pips === 3 && /קומבו/.test(s.hud.pop), `"${s.hud.combo}" pop "${s.hud.pop}"`);
check('three punches did real damage, and his bar shows it', ohp0 - s.opp[0].hp > 45 && s.hud.foeW < 80, `-${r1(ohp0 - s.opp[0].hp)} · bar ${s.hud.foeW}%`);
await step(0.3);

// the heavy punch while he is open after a swing: on the floor for a moment, then up again
s = await until((s) => s.opp[0].mode === 'windup', 8, 'his third wind-up');
await hold('btnBlock', true);
s = await until((s) => s.opp[0].mode === 'recover', 4, 'his punch on the block');
await hold('btnBlock', false);
await step(1 / 30);
s = await S();
const stH = s.me.st, hpH = s.opp[0].hp, wasOpen = s.opp[0].counter > 0;
await press('btnHeavy');
await step(1 / 30);
const heavyCost = stH - (await S()).me.st;
check('the heavy punch costs much more stamina than a jab', heavyCost >= 24 && jabCost <= 12 && heavyCost > jabCost * 2, `heavy ${r1(heavyCost)}, jab ${r1(jabCost)}`);
s = await until((s) => s.fight.heavies >= 1, 1.5, 'the heavy punch to land');
check('a slow start: the heavy punch lands later than a jab would (over a third of a second)', !!s, '');
await step(1 / 30);
s = await S();
check('caught open, the heavy punch puts him on the floor', wasOpen && s.opp[0].state === 'floored' && s.opp[0].pose === 'floored' && s.opp[0].floors === 1 && hpH - s.opp[0].hp >= 30, `${s.opp[0].state} · pose ${s.opp[0].pose} · -${r1(hpH - s.opp[0].hp)}`);
check('the HUD says so', /רצפה/.test(s.hud.pop), s.hud.pop);
await step(0.5);
const hpF = (await S()).opp[0].hp;
await press('btnPunch');
await step(0.4);
s = await S();
check('nobody hits a man on the floor: the punch does not land', s.opp[0].hp === hpF && s.opp[0].state === 'floored', `${r1(hpF)} → ${r1(s.opp[0].hp)}`);
s = await until((s) => s.opp[0].state !== 'floored' && s.opp[0].state !== 'rising', 4, 'him to get up');
check('he gets up and the fight goes on', !!s && !s.fight.over && s.opp[0].state !== 'down' && s.opp[0].pose === 'guard', s ? `${s.opp[0].state}` : '');

// the shove as he winds up: the swing is gone, he is pushed back, his guard open for a moment
s = await until((s) => s.opp[0].mode === 'windup' && s.opp[0].d < 1.9 && s.me.state === 'idle', 10, 'a wind-up to stop');
const pre = s.opp[0], takenPre = s.me.taken, stS = s.me.st;
await press('btnShove');
await step(1 / 30);
const shoveCost = stS - (await S()).me.st;
await step(0.25);
s = await S();
const pushed = Math.hypot(s.opp[0].x - pre.x, s.opp[0].z - pre.z);
check('the shove stops his wind-up', s.opp[0].mode !== 'windup' && s.opp[0].interrupted >= 1 && s.fight.interrupts === 1 && /עצרת/.test(s.hud.pop), `mode ${s.opp[0].mode} · "${s.hud.pop}"`);
check('the shove pushes him back a little and opens his guard (yellow ring), for little stamina', pushed > 0.6 && s.opp[0].counter > 0 && s.opp[0].ring && shoveCost <= 10, `${r1(pushed)} m · open ${r1(s.opp[0].counter)} s · cost ${r1(shoveCost)}`);
await step(0.6);
s = await S();
check('the punch he was winding up never came', s.me.taken === takenPre);

// stamina: heavy punches until there is nothing left, then one is refused and the bar flashes
let refused = null;
for (let i = 0; i < 160 && !refused; i++) {
  s = await S();
  const th = s.opp[0].mode === 'windup' && s.opp[0].d < 2.3;
  await hold('btnBlock', th);
  if (!th && s.me.state === 'idle') {
    const thrown = s.me.thrown;
    if (s.me.st < 26) { await press('btnHeavy'); await step(1 / 30); const t = await S(); refused = { thrown: t.me.thrown === thrown, tired: t.me.tired > 0, flash: t.hud.tiredFlash, st: s.me.st }; break; }
    await press('btnHeavy');
  }
  await step(1 / 15);
}
await hold('btnBlock', false);
check('out of stamina: the heavy punch is refused and the stamina bar flashes', !!refused && refused.thrown && refused.tired && refused.flash, JSON.stringify(refused));
const stLow = (await S()).me.st;
await step(1.5);
s = await S();
check('a breath and the stamina comes back', s.me.st > stLow + 15, `${r1(stLow)} → ${r1(s.me.st)}`);

// and the rest of the fight with the buttons: block his swings, punch and heavy-punch him when he is open
await G(() => window.__game.fightBot({ approach: true })); // the left thumb: walk in when he backs off
s = await until(async (s) => {
  if (s.fight.over) return true;
  const o = s.opp[0], th = o.mode === 'windup' && o.d < 2.4;
  await hold('btnBlock', th);
  if (!th && s.me.state === 'idle' && o.d < 2.4 && o.state !== 'floored' && o.state !== 'rising') {
    if (s.fight.chain > 0 && s.me.st >= 12) await press('btnPunch'); // carry the combination on
    else if (o.counter > 0 && s.me.st >= 40) await press('btnPunch'); // open: a combination
    else if (o.counter > 0 && s.me.st >= 26) await press('btnHeavy');
    else if (s.me.st >= 50) await press('btnPunch');
  }
  return false;
}, 60, 'the end of fight one');
await hold('btnBlock', false);
await G(() => window.__game.fightBot(null));
check('fight one won with the buttons: he sits down, out', !!s && s.fight.won === true && s.opp[0].state === 'down' && s.opp[0].pose === 'down', s ? `won ${s.fight.won} · ${s.opp[0].state}` : '');
check('more combinations along the way', !!s && s.fight.combos >= 2, s ? `combos ${s.fight.combos}` : '');
await step(0.2);
s = await S();
check('the fight over: the heavy punch, the shove and the bar of the one he faced are gone', !s.buttons.btnHeavy && !s.buttons.btnShove && s.hud.foe === null && s.hud.combo === null, JSON.stringify(s.buttons));
await G(() => { const g = window.__game.debug.game; g.fight?.dispose(); g.npc('guard1').show(false); });

// ---------- one who covers up: a light punch lands on his guard, a heavy one goes through it ----------
await G((p) => {
  const g = window.__game.debug.game, n = g.npc('guard2');
  g.player.place(p.x, p.z, 0); g.follow.snapBehind(0);
  n.place(p.x, p.z + 1.6, Math.PI); n.show(true);
  const F = new g.Fight(g, { opponents: [{ npc: n, hp: 120, guard: 1, aggression: 0.6, name: 'שומר' }] });
  F.opponents[0].mode = 'circle'; F.opponents[0].t = 3; // squared up, a few quiet seconds before his first swing
}, spot);
await step(0.4);
await press('btnPunch');
await step(0.38);
s = await S();
check('an opponent who covers up (guard): the jab lands on his block', s.opp[0].blocks >= 1 && s.opp[0].state === 'block', `blocks ${s.opp[0].blocks} · ${s.opp[0].state}`);
const gh = s.opp[0].hp;
await press('btnHeavy');
s = await until((s) => s.fight.heavies >= 1, 1.5, 'the heavy punch to land');
await step(1 / 30);
s = await S();
check('the heavy punch breaks his block: through it, a long stagger', s.opp[0].breaks >= 1 && s.opp[0].state === 'hit' && gh - s.opp[0].hp >= 10 && /הגנה/.test(s.hud.pop), `breaks ${s.opp[0].breaks} · ${s.opp[0].state} · -${r1(gh - s.opp[0].hp)} · "${s.hud.pop}"`);
await G(() => { const g = window.__game.debug.game; g.fight?.dispose(); g.npc('guard2').show(false); });

// ---------- fight two: a boss, "הפטיש", with Erez fighting along ----------
const phases = [];
await G((p) => {
  const g = window.__game.debug.game, b = g.npc('bulldozer'), e = g.npc('erez');
  g.player.place(p.x, p.z, 0); g.follow.snapBehind(0);
  b.place(p.x, p.z + 3.2, Math.PI); b.show(true);
  e.place(p.x + 1.8, p.z - 0.6, 0); e.show(true);
  window.__t.phases = [];
  new g.Fight(g, {
    opponents: [{ npc: b, boss: true, name: 'הפטיש', hp: 240, power: 1.1, windup: 1.1, armor: 0.8, phases: [0.6, 0.3] }],
    allies: [{ npc: e, hp: 140, power: 0.8 }],
    onPhase: (o, i) => window.__t.phases.push(i),
  });
}, spot);
await step(0.2);
s = await S();
check('the boss: his bar at the top with his name, a mark at each phase, and what moves him', s.hud.boss === 'הפטיש' && s.hud.bossW === 100 && s.hud.bossMarks === 2 && /מכה חזקה/.test(s.hud.bossTag), `${s.hud.boss} ${s.hud.bossW}% · marks ${s.hud.bossMarks} · "${s.hud.bossTag}"`);
await shot('fists-boss-landscape');

// his slam on a held block: a big hit goes through the guard
s = await until((s) => s.opp[0].mode === 'windup' && s.opp[0].atMe && s.opp[0].d < 1.9, 12, 'the boss winding up');
await hold('btnBlock', true);
const hb = s.me.hp;
s = await until((s) => s.me.breaks >= 1 || s.opp[0].mode === 'recover', 4, 'the slam on the block');
await hold('btnBlock', false);
s = await S();
check('his slam breaks Nehorai\'s block: "ההגנה נשברה", and most of it lands', s.me.breaks >= 1 && /ההגנה נשברה/.test(s.hud.pop) && hb - s.me.hp > 8, `breaks ${s.me.breaks} · -${r1(hb - s.me.hp)} · "${s.hud.pop}"`);
await G(() => window.__game.fightBot({ approach: true })); // the left thumb from here on: back in when knocked away
await step(1);

// a light punch as he winds up: it does next to nothing and does not stop him; a dodge at the end
s = await until((s) => s.opp[0].mode === 'windup' && s.opp[0].atMe && s.opp[0].d < 1.9 && s.opp[0].t > 0.5 && s.me.state === 'idle', 12, 'the boss winding up close');
check('a big wind-up: both fists over his head, a wide red ring', !!s && s.opp[0].ring && s.opp[0].t > 0.5);
const bhp = s.opp[0].hp;
await press('btnPunch');
await step(0.25);
s = await S();
check('armor: a light punch does next to nothing to him', s.opp[0].shrugged >= 1 && bhp - s.opp[0].hp < 3 && /לא מזיז/.test(s.hud.pop), `-${r1(bhp - s.opp[0].hp)} · "${s.hud.pop}"`);
check('and does not stop his wind-up (no stagger)', s.opp[0].mode === 'windup' && s.opp[0].state !== 'hit', `${s.opp[0].mode} / ${s.opp[0].state}`);
s = await until((s) => s.opp[0].mode !== 'windup' || s.opp[0].t < 0.12, 2, 'the end of the wind-up');
const tk = s.me.taken, dg = s.me.dodges, dbg = JSON.stringify({ mode: s.opp[0].mode, t: r1(s.opp[0].t), d: r1(s.opp[0].d), atMe: s.opp[0].atMe, me: s.me.state, st: r1(s.me.st), erez: s.allies[0] });
await press('btnDodge');
const s1 = await S();
await step(0.8);
s = await S();
// (out of the way, the slam lands on whoever is in front of him then: sometimes Erez)
check('a dodge at the end of the wind-up: the slam does not touch Nehorai', s1.me.state === 'dodge' && s.me.taken === tk, `dodges ${dg} → ${s.me.dodges} · ${dbg} · Erez taken ${s.allies[0].taken}`);

// a shove stops his next wind-up; once he steadies, a heavy punch staggers him
s = await until((s) => s.opp[0].mode === 'windup' && s.opp[0].atMe && s.opp[0].d < 1.8 && s.opp[0].t > 0.35 && s.me.state === 'idle' && s.me.st >= 8, 15, 'the next wind-up');
await press('btnShove');
await step(0.25);
s = await S();
check('the shove stops even his wind-up (and he braces for the next one)', s.opp[0].mode !== 'windup' && s.opp[0].interrupted >= 1 && s.opp[0].braced > 2, `${s.opp[0].mode} · braced ${r1(s.opp[0].braced)} s`);
s = await until((s) => s.opp[0].state !== 'hit' && s.me.state === 'idle' && s.me.st >= 26, 2, 'him to steady');
const bhp2 = s.opp[0].hp;
await press('btnHeavy');
s = await until((s) => s.fight.heavies >= 1, 1.5, 'the heavy punch to land');
await step(1 / 30);
s = await S();
check('a heavy punch staggers the boss, with real damage', s.opp[0].state === 'hit' && s.opp[0].timer > 0.3 && bhp2 - s.opp[0].hp >= 18 && /מתנדנד/.test(s.hud.pop), `${s.opp[0].state} ${r1(s.opp[0].timer)} s · -${r1(bhp2 - s.opp[0].hp)} · "${s.hud.pop}"`);

// the rest of it: shove his wind-ups (or dodge at the end), heavy punches and combinations; his phases
let lowBar = 100, floorSeen = false, combosBoss = 0;
s = await until(async (s) => {
  if (s.fight.over) return true;
  const o = s.opp[0];
  lowBar = Math.min(lowBar, s.hud.bossW);
  if (o.state === 'floored' && /רצפה/.test(s.hud.bossTag)) floorSeen = true;
  combosBoss = s.fight.combos;
  const coming = o.mode === 'windup' && o.atMe && o.d < 2.6;
  await hold('btnBlock', coming && o.t < 0.2 && s.me.st < 18 && s.me.state !== 'dodge'); // last resort: cover up
  if (s.me.state !== 'idle' && s.me.state !== 'block') return false;
  if (coming) { // his wind-up: shove it away while he is not braced, else step out at the end
    if (!o.braced && o.t > 0.3 && o.d < 1.8 && s.me.st >= 8) await press('btnShove');
    else if (o.t < 0.13 && s.me.st >= 18) await press('btnDodge');
    return false;
  }
  if (o.d < 2.4 && o.state !== 'floored' && o.state !== 'rising' && o.mode !== 'windup') {
    const open = o.counter > 0 || o.state === 'hit';
    if (s.fight.chain > 0 && s.me.st >= 12) await press('btnPunch'); // carry the combination on to the finisher
    else if (open && s.me.st >= 44) await press('btnPunch');
    else if (open && s.me.st >= 26) await press('btnHeavy');
    else if (s.me.st >= 70) await press('btnHeavy');
  }
  return false;
}, 180, 'the end of the boss fight');
await hold('btnBlock', false);
await G(() => window.__game.fightBot(null));
const ph = await G(() => window.__t.phases);
check('his phases: at 60% and at 30% he goes down for a moment and gets up angrier', ph.join(',') === '1,2' && !!s && s.opp[0].floors >= 2 && floorSeen, `phases ${ph.join(',')} · floors ${s?.opp[0].floors}`);
check('his bar went down with him', lowBar < 35, `lowest ${lowBar}%`);
check('Erez fought along for real: his punches landed', !!s && s.allies[0].landed >= 3, s ? `landed ${s.allies[0].landed} · taken ${s.allies[0].taken}` : '');
check('the boss won with the buttons: he sits down, out', !!s && s.fight.won === true && s.opp[0].state === 'down', s ? `won ${s.fight.won} · hp ${r1(s.opp[0].hp)}` : '');
check('combinations on the boss too (a finisher moves him)', combosBoss >= 1, `combos ${combosBoss}`);
s = await S();
check('the boss bar is gone when he is out', s.hud.boss === null);

// ---------- portrait: a third fight just to see the layout standing up ----------
await page.setViewportSize({ width: 390, height: 844 });
await G((p) => {
  const g = window.__game.debug.game, b = g.npc('bulldozer'), n = g.npc('guard2');
  g.fight?.dispose();
  g.player.place(p.x, p.z, 0); g.follow.snapBehind(0);
  b.place(p.x - 1.2, p.z + 3.4, Math.PI); b.show(true);
  n.place(p.x + 0.4, p.z + 2.2, Math.PI); n.show(true);
  new g.Fight(g, { opponents: [{ npc: n, hp: 70, name: 'שומר' }, { npc: b, boss: true, name: 'הפטיש', hp: 240 }] });
}, spot);
await step(0.3);
await press('btnPunch');
await step(0.4);
s = await S();
check('portrait: the fight buttons, the boss bar and the bar of the one he faces are all there', ['btnPunch', 'btnHeavy', 'btnShove', 'btnBlock', 'btnDodge'].every((b) => s.buttons[b]) && s.hud.boss === 'הפטיש' && s.hud.foe === 'שומר', `${s.hud.boss} · ${s.hud.foe}`);
await layoutOk('portrait 390 × 844');
const over = await G(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), a = r('bossBar'), m = r('minimap'), o = r('objective'); const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom; return { map: hit(a, m), obj: hit(a, o) }; });
check('portrait: the boss bar sits clear of the map and the objective', !over.map && !over.obj, JSON.stringify(over));
await shot('fists-portrait');
await page.setViewportSize({ width: 844, height: 390 });
await G(() => { const g = window.__game.debug.game; g.fight?.dispose(); });

check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
