// The published form of the game: the page together with the asset layer (the hf/ folder with the portraits,
// the realistic models, the Renault and the voices), served over http as the published page serves it.
// That folder is not in this repository, so this test needs a served copy of the published folder:
// play.html and characters.html (from `node tools/build-single.mjs --artifact <dir>`) beside hf/.
// It walks chapter nine's moments that swap who is played (Nehorai, Ido, Nehorai again) and checks that the
// mission runs, the played body wears its realistic model, and the page reports no error.
// usage: node tests/published.test.mjs <base url, e.g. http://127.0.0.1:8791> [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.log('usage: node tests/published.test.mjs <base url of a served copy of the published folder> [screenshot dir]'); process.exit(2); }
const shots = process.argv[3] || new URL('../test-results/published/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const url = `${base}/play.html`, KEY = 'nehorai-game:save:v1';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [], warns = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning' && /\[hf\]/.test(m.text())) warns.push(m.text()); });
// a request cut off by the page itself (a reload while a film is still preloading, a media element that
// stops reading once it has what it needs) is not a failure of the page: listed apart
const aborted = [];
page.on('requestfailed', (r) => { const why = r.failure()?.errorText || ''; (/ERR_ABORTED/.test(why) ? aborted : errors).push(`request failed (${why}): ${r.url()}`); });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
check('the asset layer is loaded on the page', await page.evaluate(() => !!window.__hfAssets));
async function loadAt(id, cp) {
  await page.evaluate(({ id, cp, KEY }) => {
    const g = window.__game.debug.game, defs = g.missions.defs, ch = defs.find((d) => d.id === id).chapter, p = g.progressForChapter(ch);
    g.save = () => true; g.missions.keep = g.missions.forget = () => {};
    for (const d of defs) {
      if ((d.chapter || 1) !== ch || d.id === id) continue;
      if (defs.indexOf(d) > defs.findIndex((x) => x.id === id)) continue;
      p.done.push(d.id); for (const u of d.reward?.unlocks || []) if (!p.unlocks.includes(u)) p.unlocks.push(u);
    }
    p.resume = cp === null ? null : { id, checkpoint: cp };
    p.savedAt = Date.now();
    localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(p));
  }, { id, cp, KEY });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.__game.state, null, { timeout: 60000 });
}
const look = () => page.evaluate(() => {
  const g = window.__game.debug.game, m = g.missions.active, me = g.nehorai;
  const dressed = (model) => !!model?.hfPerson, npc = (id) => g.npcs.get(id);
  return {
    mission: m?.def.id || null, step: m?.stepIndex, obj: document.getElementById('objText').textContent, as: g.playingAs,
    body: me?.spec?.id, bodyDressed: dressed(me), bodyInScene: !!me?.root?.parent, bodyVisible: me?.root?.visible !== false,
    nehoraiNpc: npc('nehorai') ? { visible: npc('nehorai').visible, dressed: dressed(npc('nehorai').model) } : null,
    idoNpc: npc('ido') ? { visible: npc('ido').visible, dressed: dressed(npc('ido').model) } : null,
    erezNpc: npc('erez') ? { visible: npc('erez').visible, dressed: dressed(npc('erez').model) } : null,
    fail: !g.hud.el.fail.hidden, armed: !!g.paint.armed, stashed: !!g.paint.stashed,
  };
});
async function play(sec) {
  const t0 = Date.now();
  while (Date.now() - t0 < sec * 1000) {
    if (await page.evaluate(() => !!window.__game.state.dialogue)) await page.dispatchEvent('#caption', 'pointerdown').catch(() => {});
    await page.waitForTimeout(400);
  }
}
const CASES = [
  ['phoenix', 0, 'nehorai'],   // the chapter opens by itself at the safe house
  ['stolen', 1, 'nehorai'],    // the cells: fists only
  ['wounded', 3, 'ido'],       // after the blast: played as Ido, Nehorai on the floor
  ['comeback', 0, 'ido'],      // Nehorai asleep in the safe room
  ['comeback', 3, 'nehorai'],  // back as Nehorai
  ['shadow', 2, 'nehorai'],    // the boss, phase two
];
for (const [id, cp, who] of CASES) {
  const before = errors.length;
  await loadAt(id, cp);
  await play(9); // the watcher dresses a new body within a couple of seconds
  const a = await look();
  await page.screenshot({ path: `${shots}/${id}-${cp}.png` });
  check(`${id} · checkpoint ${cp}: running, played as ${who}, no fail, no page error`, !!a && a.mission === id && a.as === who && a.body === who && !a.fail && errors.length === before,
    `${JSON.stringify(a)}${errors.length > before ? ` · ${errors.slice(before).join(' | ').slice(0, 400)}` : ''}`);
  check(`${id} · checkpoint ${cp}: the played body wears its realistic model and is in the scene`, !!a && a.bodyDressed && a.bodyInScene);
}
// the switch itself, live: Nehorai -> Ido -> Nehorai, each new body dressed again
{
  const before = errors.length;
  await page.evaluate(() => window.__game.debug.game.playAs('ido'));
  await play(6);
  const a = await look();
  await page.evaluate(() => window.__game.debug.game.playAs('nehorai'));
  await play(6);
  const b = await look();
  check('a live switch to Ido and back: each new body is dressed again, no error', a.body === 'ido' && a.bodyDressed && b.body === 'nehorai' && b.bodyDressed && errors.length === before, `${a.body}:${a.bodyDressed} ${b.body}:${b.bodyDressed} ${errors.slice(before).join(' | ').slice(0, 300)}`);
}
// the characters page and its way back to the game
await page.goto(`${base}/characters.html`);
await page.waitForTimeout(4000);
const back = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
check('the characters page loads and links back to play.html', back.includes('play.html'), back.join(','));
check('no page errors in the whole probe', errors.length === 0, errors.slice(0, 5).join(' | ').slice(0, 600));
console.log('requests cut off by the page itself:', aborted.length, [...new Set(aborted)].join(' | ').slice(0, 400));
console.log('hf warnings:', warns.slice(0, 6).join(' | ').slice(0, 600) || 'none');
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
