// Chapter ten's twelve films in the published form: the page together with the asset layer (hf/), served over
// http as the published page serves it. The films are not in this repository (hf/c10/<id>.mp4 beside the
// published page, registered by hf/hf-assets.js), so this test needs a served copy of the published folder:
// play.html (from `node tools/build-single.mjs --artifact <dir>`) beside hf/.
// For each film: registered as game.cutscenes['c10-<id>'], its file served, it plays over the game while
// game.cutscene is set, a tap skips it, nothing is left over the game and game.cutscene comes back false.
// usage: node tests/published-films.test.mjs <base url of a served copy of the published folder>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.log('usage: node tests/published-films.test.mjs <base url of a served copy of the published folder>'); process.exit(2); }
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/play.html`);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__hfChapter10 && Object.keys(window.__game.debug.game.cutscenes || {}).filter((k) => k.startsWith('c10-')).length === 12, null, { timeout: 60000 });
const can = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"'));
console.log('H.264 in this browser:', JSON.stringify(can));
const ids = await page.evaluate(() => Object.keys(window.__game.debug.game.cutscenes).filter((k) => k.startsWith('c10-')));
let ok = 0;
for (const id of ids) {
  const file = id.replace('c10-', '');
  const status = await page.evaluate(async (f) => (await fetch(`hf/c10/${f}.mp4`, { method: 'HEAD' })).status, file);
  await page.evaluate((id) => { window.__done = null; window.__fb = false; window.__game.debug.game.playCutscene(id, () => { window.__fb = true; return Promise.resolve(); }).then(() => { window.__done = 'resolved'; }, (e) => { window.__done = 'rejected ' + e; }); }, id);
  await page.waitForTimeout(1500);
  const mid = await page.evaluate(() => { const w = document.querySelector('.hf-film'); const v = w?.querySelector('video'); return { shown: !!w, ready: v?.readyState ?? null, time: v ? +v.currentTime.toFixed(2) : null, err: v?.error?.code ?? null, dur: v ? +(v.duration || 0).toFixed(1) : null, cutscene: !!window.__game.debug.game.cutscene }; });
  if (mid.shown) await page.dispatchEvent('.hf-film', 'pointerdown').catch(() => {});
  await page.waitForTimeout(900);
  const end = await page.evaluate(() => ({ done: window.__done, fallback: window.__fb, left: document.querySelectorAll('.hf-film').length, cutscene: !!window.__game.debug.game.cutscene }));
  const good = status === 200 && end.done === 'resolved' && end.left === 0 && !end.cutscene;
  if (good) ok++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${id}: file ${status}, while playing ${JSON.stringify(mid)}, after the tap ${JSON.stringify(end)}`);
}
console.log(`${errors.length ? 'FAIL' : 'PASS'}  no page errors${errors.length ? `  (${errors.slice(0, 3).join(' | ')})` : ''}`);
const all = ids.length === 12 && ok === ids.length && !errors.length;
console.log(`\n${ok + (errors.length ? 0 : 1)}/${ids.length + 1} checks passed (twelve films expected, ${ids.length} registered)`);
await browser.close();
process.exit(all ? 0 : 1);
