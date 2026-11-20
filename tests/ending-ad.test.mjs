// The ad after the credits (src/ui/ending.js with game.endingAd): a short synthetic clip stands in for the user's
// film (tests/fixtures/ad-test.mp4: colour bars and a tone, six seconds). Checked:
//  - after the credits the ad comes on black, the whole frame shown, labelled 'פרסומת', the credits' own 'דלג'
//    gone, the world held, the game's music out; its own skip comes only after a few seconds;
//  - its sound: on (the button offers to mute), the button mutes and unmutes it;
//  - played to its end: THANK YOU FOR PLAYING. with the menu button and the button to watch the ad again;
//  - watched again: the ad over the thanks, its skip, and the thanks back with both buttons;
//  - 'דלג' in the middle of the credits: the ad all the same, then the thanks;
//  - the game muted: the ad starts without sound and the button offers it;
//  - a film that cannot load: the thanks a moment later, no button to watch it again;
//  - no ad at all: the thanks straight after the credits, as before.
// usage: node tests/ending-ad.test.mjs [url]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const CLIP = new URL('./fixtures/ad-test.mp4', import.meta.url).href;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
// the browser may start a film with its sound (as a page the player has already tapped would)
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 240000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state?.mode === 'foot', null, { timeout: 60000 });
await G(() => window.__game.debug.game.setPopulation?.({ traffic: 0, people: 0 }));

// the ending's state as the screen shows it
const look = () => G(() => {
  const F = window.__game.finale, E = F.ENDING, root = document.getElementById('ending');
  const q = (c) => root?.querySelector(c), op = (n) => (n ? +getComputedStyle(n).opacity : 0), shown = (n) => !!n && !n.hidden && getComputedStyle(n).display !== 'none';
  const ad = q('.ending-ad'), v = ad?.querySelector('video'), g = window.__game.debug.game;
  return {
    phase: E.phase, ad: E.ad ? { ...E.ad } : null, log: E.log.slice(-3),
    adOn: !!ad?.classList.contains('on'), adOp: op(ad), tag: q('.ending-ad-tag')?.textContent || '', fit: v ? getComputedStyle(v).objectFit : null,
    playing: !!v && !v.paused && v.currentTime > 0, t: v ? +v.currentTime.toFixed(2) : null, muted: v ? v.muted : null,
    adSkip: shown(q('.ending-ad-skip')) && !!q('.ending-ad-skip')?.classList.contains('on'), sound: shown(q('.ending-ad-sound')) ? q('.ending-ad-sound').textContent : null,
    creditsSkip: shown(q('.ending-skip:not(.ending-ad-skip)')), hold: !!g.hold, music: g.sound?.musicMode ?? null,
    thanks: !!q('.ending-thanks')?.classList.contains('on') && op(q('.ending-thanks')) > 0.5, menu: shown(q('.ending-menu')), again: shown(q('.ending-again')),
  };
});
const until = async (cond, sec, what) => {
  const t0 = Date.now();
  for (;;) { const s = await look(); if (cond(s)) return s; if (Date.now() - t0 > sec * 1000) { console.log(`  (timed out waiting for ${what}: ${JSON.stringify(s)})`); return null; } await wait(120); }
};
// a fresh ending: the cards and the credits at a test speed, with the given ad (or none)
async function run(ad, { muted = false } = {}) {
  // (an ending just closed opens nothing for a moment and a half: the chain of a mission just left stays shut)
  const open = await G(() => { const g = window.__game.debug.game, F = window.__game.finale; const was = F.endingOpen(); F.closeEnding(g); return was; });
  if (open) await wait(1700);
  await G(({ ad, muted }) => {
    const g = window.__game.debug.game, F = window.__game.finale;
    g.endingAd = ad; if (g.sound) g.sound.muted = muted;
    F.ENDING.speed = 8; window.DONE = null;
    F.endingCards(g).then(() => F.credits(g)).then((r) => { window.DONE = r; });
  }, { ad, muted });
}
const tapIn = (sel) => G((s) => { const b = document.querySelector(`#ending ${s}`); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); return !!b; }, sel);

// ---------- the ad after the credits, played to its end ----------
await run({ src: CLIP });
let s = await until((s) => s.phase === 'ad' && s.playing, 120, 'the ad');
const first = s; // as it starts: no skip yet
s = (await until((s) => s.adOp > 0.9, 5, 'its fade in')) || (await look());
check('after the credits: the ad, on black, the whole frame, labelled as an ad', !!s && s.adOn && s.adOp > 0.9 && s.tag === 'פרסומת' && s.fit === 'contain' && s.log.includes('ad'), JSON.stringify(s));
check('the credits\' own skip gone, the world held, the game\'s music out', !!s && !s.creditsSkip && s.hold && !s.music, JSON.stringify(s && { creditsSkip: s.creditsSkip, hold: s.hold, music: s.music }));
check('its skip not yet in the first seconds', !!first && first.t < 2.5 && !first.adSkip, JSON.stringify(first && { t: first.t, adSkip: first.adSkip }));
check('it plays with its sound, and the button offers to mute it', !!s && s.muted === false && /להשתיק/.test(s.sound || ''), JSON.stringify(s && { muted: s.muted, sound: s.sound }));
await tapIn('.ending-ad-sound');
let m = await look();
check('the sound button mutes it (and offers the sound back)', m.muted === true && /להפעיל קול/.test(m.sound || ''), JSON.stringify({ muted: m.muted, sound: m.sound }));
await tapIn('.ending-ad-sound');
m = await look();
check('and unmutes it', m.muted === false && /להשתיק/.test(m.sound || ''), JSON.stringify({ muted: m.muted, sound: m.sound }));
s = await until((s) => s.adSkip, 6, 'its skip');
check('after a few seconds its skip comes', !!s && s.t >= 2.5, JSON.stringify(s && { t: s.t }));
s = await until((s) => s.thanks && s.menu, 20, 'the thanks');
check('played to its end: THANK YOU FOR PLAYING. with the menu button and the one to watch the ad again', !!s && s.ad?.ended === 'ended' && s.again && !s.adOn && s.phase === 'thanks', JSON.stringify(s));
check('the game\'s music back with the thanks', !!s && s.music === 'home', String(s?.music));
check('credits() resolved once the thanks were up', await G(() => !!window.DONE && !window.DONE.closed));
await page.screenshot({ path: new URL('../test-results/ending-ad-thanks.png', import.meta.url).pathname });

// ---------- watched again, skipped ----------
await tapIn('.ending-again');
s = await until((s) => s.phase === 'ad' && s.playing, 15, 'the ad again');
check('"לצפות שוב בפרסומת": the ad again over the thanks', !!s && s.ad?.times === 2 && s.adOn && !s.thanks, JSON.stringify(s));
s = await until((s) => s.adSkip, 6, 'its skip');
await tapIn('.ending-ad-skip');
s = await until((s) => s.thanks && s.menu && s.again, 10, 'the thanks back');
check('its skip: back to the thanks, both buttons there', !!s && s.ad?.ended === 'skipped' && !s.adOn, JSON.stringify(s));

// ---------- 'דלג' in the middle of the credits ----------
await run({ src: CLIP });
await until((s) => s.phase === 'credits', 60, 'the credits');
await tapIn('.ending-skip:not(.ending-ad-skip)');
s = await until((s) => s.phase === 'ad' && s.playing, 20, 'the ad after the skip');
check('"דלג" in the middle of the credits: the ad all the same', !!s && s.adOn, JSON.stringify(s));
await until((s) => s.adSkip, 6, 'its skip');
await tapIn('.ending-ad-skip');
s = await until((s) => s.thanks && s.menu, 10, 'the thanks');
check('then the thanks', !!s && s.ad?.ended === 'skipped', JSON.stringify(s));

// ---------- the game muted ----------
await run({ src: CLIP }, { muted: true });
s = await until((s) => s.phase === 'ad' && s.playing, 120, 'the ad');
check('the game muted: the ad starts without sound and the button offers it', !!s && s.muted === true && /להפעיל קול/.test(s.sound || ''), JSON.stringify(s && { muted: s.muted, sound: s.sound }));
await until((s) => s.adSkip, 6, 'its skip');
await tapIn('.ending-ad-skip');
await until((s) => s.thanks, 10, 'the thanks');
await G(() => { const g = window.__game.debug.game; if (g.sound) g.sound.muted = false; });

// ---------- a film that cannot load ----------
await run({ src: CLIP.replace('ad-test.mp4', 'no-such-film.mp4') });
s = await until((s) => s.thanks && s.menu, 120, 'the thanks');
check('a film that cannot load: the thanks a moment later, no button to watch it again', !!s && !s.again && ['error', 'stall'].includes(s.ad?.ended), JSON.stringify(s));

// ---------- no ad ----------
await run(null);
s = await until((s) => s.thanks && s.menu, 120, 'the thanks');
check('no ad: the thanks straight after the credits, as before', !!s && !s.ad && !s.again && !(await G(() => window.__game.finale.ENDING.log.includes('ad'))), JSON.stringify(s));

// the menu button still takes the player home
await tapIn('.ending-menu');
await wait(800);
check('the menu button: the start screen', await G(() => !document.getElementById('startScreen').hidden && !document.getElementById('ending')));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`);
await browser.close();
process.exit(ok === results.length ? 0 : 1);
