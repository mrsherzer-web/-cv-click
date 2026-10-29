// Character room test in headless Chromium with phone emulation and real touch events.
// usage: node tests/characters.test.mjs [url] [screenshot dir]
// default url: the single-file build (run `npm run build` first)
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/characters.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(120000); // software rendering on a busy machine can take a while over one frame
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const state = () => page.evaluate(() => window.__viewer.state);
const wait = (ms) => page.waitForTimeout(ms);
const rect = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, sel);
// taps go through dispatchEvent: a real tap waits for the button's press animation, which is slow headless
const tap = async (sel) => { await page.dispatchEvent(sel, 'click'); await wait(250); };

await page.goto(url);
await page.waitForFunction(() => window.__viewer, null, { timeout: 90000 });
await wait(500);
check('page boots without errors', errors.length === 0, errors[0] || '');

const chips = await page.$$eval('#cast button', (bs) => bs.map((b) => ({ id: b.dataset.id, label: b.textContent })));
check('a button for each of the six characters and one for all of them', chips.length === 7 && chips.at(-1).id === 'all', chips.map((c) => c.label).join(', '));

// each character on its own: only that character shows, its card matches, and nothing covers it
const covered = [];
for (const chip of chips.filter((c) => c.id !== 'all')) {
  await tap(`#cast button[data-id="${chip.id}"]`);
  const st = await state();
  const name = await page.textContent('#cvName');
  const card = await rect('#card'), controls = await rect('.cv-controls');
  if (st.selected !== chip.id || st.visible.join() !== chip.id || !name.startsWith(chip.label)) covered.push(`${chip.id}: shows ${st.visible.join()} as "${name}"`);
  else if (st.bounds.top < card.bottom - 2 || st.bounds.bottom > controls.top + 2) covered.push(`${chip.id}: ${Math.round(st.bounds.top)}–${Math.round(st.bounds.bottom)} px, free ${Math.round(card.bottom)}–${Math.round(controls.top)}`);
  if (chip.id === 'dolev') await page.screenshot({ path: `${shots}/c1-dolev.png` });
}
check('each button shows that character alone, named on the card and clear of the card and buttons', covered.length === 0, covered.join('; ') || 'six of six');

await tap('#cast button[data-id="all"]');
let st = await state();
check('"all" shows the whole group', st.visible.length === 6, `${st.visible.length} visible`);
await page.screenshot({ path: `${shots}/c2-all.png` });

await tap('#cast button[data-id="nehorai"]');
await tap('#zoomBtn');
st = await state();
check('the close-up button zooms in on the face', st.zoom && (await page.getAttribute('#zoomBtn', 'aria-pressed')) === 'true');
await page.screenshot({ path: `${shots}/c3-closeup.png` });
await tap('#cast button[data-id="all"]');
st = await state();
check('choosing "all" turns the close-up off', !st.zoom && (await page.getAttribute('#zoomBtn', 'aria-pressed')) === 'false' && st.visible.length === 6);

const speeds = [];
for (const v of ['2.4', '6.2', '0']) { await tap(`[data-move="${v}"]`); speeds.push((await state()).speed); }
check('stand, walk and run buttons set the movement', speeds.join() === '2.4,6.2,0', speeds.join(' → '));

await tap('#cast button[data-id="avraham"]');
const y0 = (await state()).yaw;
await touch('touchStart', [{ x: 120, y: 420 }]);
for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 120 + i * 20, y: 420 }]);
await touch('touchEnd', []);
const y1 = (await state()).yaw;
check('dragging on the stage turns the character', Math.abs(y1 - y0) > 0.5, `yaw ${y0.toFixed(2)} → ${y1.toFixed(2)}`);

const link = await page.getAttribute('#playLink', 'href');
check('the link leads back to the game', /^(play|index)\.html$/.test(link), link);

const scroll = await page.evaluate(() => ({ y: scrollY, h: document.scrollingElement.scrollHeight, vh: innerHeight }));
check('the page never scrolls', scroll.y === 0 && scroll.h <= scroll.vh, `scrollHeight ${scroll.h}, viewport ${scroll.vh}`);

// landscape: the character stays between the header and the controls
await page.setViewportSize({ width: 844, height: 390 });
await wait(600);
await tap('#cast button[data-id="muller"]');
st = await state();
const top = await rect('.cv-top'), note = await rect('.cv-note'), side = await rect('.cv-controls');
const fits = st.bounds.top >= top.bottom - 2 && st.bounds.bottom <= note.top + 2 && st.bounds.bottom - st.bounds.top > 390 * 0.5;
check('landscape: the buttons move aside and the character gets the height', side.right < 844 / 2 - 60 && fits, `${Math.round(st.bounds.top)}–${Math.round(st.bounds.bottom)} px of 390, buttons end at x=${Math.round(side.right)}`);
await page.screenshot({ path: `${shots}/c4-landscape.png` });

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
