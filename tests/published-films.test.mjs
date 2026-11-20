// Chapter ten's twelve films in the published form: the page together with the asset layer (hf/), served over
// http as the published page serves it. The films are not in this repository (hf/c10/<id>.mp4 beside the
// published page, registered by hf/hf-assets.js), so this test needs a served copy of the published folder:
// play.html (from `node tools/build-single.mjs --artifact <dir>`) beside hf/.
// For each film: registered as game.cutscenes['c10-<id>'], its file served, it plays over the game while
// game.cutscene is set, a tap skips it, nothing is left over the game and game.cutscene comes back false.
// Also the ad after the credits (hf/end/ad.mp4): registered, served, played in the ending, skipped, the thanks after it.
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
// the ad after the credits (hf/end/ad.mp4, game.endingAd): registered, served, and in the ending itself: after the
// credits, playing (its sound on, the browser letting it), the whole frame on black, its skip after a few seconds,
// then THANK YOU FOR PLAYING. with the button to watch it again
const ad = await page.evaluate(async () => {
  const g = window.__game.debug.game, src = g.endingAd?.src || null;
  if (!src) return { src };
  const status = (await fetch(src, { method: 'HEAD' })).status;
  return { src: src.replace(/^.*\/hf\//, 'hf/'), status };
});
const adOk = ad.src === 'hf/end/ad.mp4' && ad.status === 200;
if (adOk) ok++;
console.log(`${adOk ? 'PASS' : 'FAIL'}  the ad after the credits registered and served  (${JSON.stringify(ad)})`);
let adPlay = { phase: null };
if (adOk) {
  await page.evaluate(() => { const g = window.__game.debug.game, F = window.__game.finale; F.ENDING.speed = 10; window.__adDone = null; F.credits(g).then((r) => { window.__adDone = r; }); });
  await page.waitForFunction(() => { const F = window.__game.finale, v = document.querySelector('#ending .ending-ad video'); return F.ENDING.phase === 'ad' && v && !v.paused && v.currentTime > 0.5; }, null, { timeout: 240000 }).catch(() => {});
  const playing = await page.evaluate(() => { const v = document.querySelector('#ending .ending-ad video'); return v ? { t: +v.currentTime.toFixed(1), dur: +(v.duration || 0).toFixed(1), muted: v.muted, w: v.videoWidth, h: v.videoHeight, fit: getComputedStyle(v).objectFit, tag: document.querySelector('#ending .ending-ad-tag')?.textContent } : null; });
  // (no picture here: on a busy machine a screenshot can take longer than the rest of the film, and the skip is
  // what is being timed; the picture is taken on the second viewing below)
  await page.waitForFunction(() => { const v = document.querySelector('#ending .ending-ad video'); return v && v.currentTime >= 3.1 && document.querySelector('#ending .ending-ad-skip.on'); }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('#ending .ending-ad-skip')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await page.waitForFunction(() => window.__game.finale.ENDING.phase === 'thanks' && !!window.__adDone && !document.querySelector('#ending .ending-menu')?.hidden, null, { timeout: 30000 }).catch(() => {});
  adPlay = await page.evaluate(() => ({ phase: window.__game.finale.ENDING.phase, ended: window.__game.finale.ENDING.ad?.ended, again: !document.querySelector('#ending .ending-again')?.hidden, menu: !document.querySelector('#ending .ending-menu')?.hidden }));
  // watched again, for its picture; then its skip once more, back to the thanks
  await page.evaluate(() => document.querySelector('#ending .ending-again')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await page.waitForFunction(() => { const v = document.querySelector('#ending .ending-ad video'); return window.__game.finale.ENDING.phase === 'ad' && v && !v.paused && v.currentTime > 0.5; }, null, { timeout: 30000 }).catch(() => {});
  await page.screenshot({ path: new URL('../test-results/published-ad.png', import.meta.url).pathname });
  await page.waitForFunction(() => window.__game.finale.ENDING.phase !== 'ad' || !!document.querySelector('#ending .ending-ad-skip.on'), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('#ending .ending-ad-skip')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await page.waitForFunction(() => window.__game.finale.ENDING.phase === 'thanks', null, { timeout: 30000 }).catch(() => {});
  const good = !!playing && playing.dur > 19 && playing.w === 1280 && playing.h === 720 && playing.muted === false && playing.fit === 'contain' && playing.tag === 'פרסומת'
    && adPlay.phase === 'thanks' && adPlay.ended === 'skipped' && adPlay.again && adPlay.menu;
  if (good) ok++;
  console.log(`${good ? 'PASS' : 'FAIL'}  in the ending: after the credits the ad plays (its sound on), the whole frame, labelled; its skip; then the thanks with the button to watch it again  (${JSON.stringify({ playing, after: adPlay })})`);
}
console.log(`${errors.length ? 'FAIL' : 'PASS'}  no page errors${errors.length ? `  (${errors.slice(0, 3).join(' | ')})` : ''}`);
const all = ids.length === 12 && ok === ids.length + 2 && !errors.length;
console.log(`\n${ok + (errors.length ? 0 : 1)}/${ids.length + 3} checks passed (twelve films expected, ${ids.length} registered; and the ad after the credits)`);
await browser.close();
process.exit(all ? 0 : 1);
