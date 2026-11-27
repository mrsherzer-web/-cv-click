// Plays story moments with the autopilot and takes a series of screenshots of each.
// The software renderer in CI is slow, so the game is fast-forwarded and shots are taken by GAME time.
// usage: node gefen2/tools/shots_story.js <outDir> [only,names]
const { chromium, devices } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2];
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8123/gefen2/';
const RUNS = [
  { name: 'op', q: 'night=1&stage=0', speed: 5, every: 3, count: 12 },
  { name: 'n2rescue', q: 'night=2&stage=3', every: 10, count: 9 },
  { name: 'n3reveal', q: 'night=3&stage=0', speed: 10, every: 6, count: 9 },
  { name: 'n3stare', q: 'night=3&stage=2', every: 15, count: 12 },
  { name: 'n4ido', q: 'night=4&stage=2', every: 10, count: 10 },
  { name: 'n5a', q: 'night=5&stage=0', every: 8, count: 8 },
  { name: 'n5dolev', q: 'night=5&stage=3', every: 8, count: 8 },
  { name: 'n6end', q: 'night=6&stage=6', every: 10, count: 14 },
  { name: 'ending', q: 'scene=ending', real: 3000, count: 14, nobot: true },
  { name: 'phone_n3', q: 'night=3&stage=1', device: 'iPhone 13 landscape', every: 15, count: 5 },
  { name: 'n2call', q: 'night=2&stage=0', speed: 5, every: 4, count: 9 },
  { name: 'n3cine', q: 'night=3&stage=2&speed=8', nobot: true, js: '__g2.clock = 5.74', real: 2500, count: 6 },
];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const r of RUNS) {
    if (only && !only.split(',').includes(r.name)) continue;
    const ctx = await browser.newContext(r.device ? { ...devices[r.device], deviceScaleFactor: 1 } : { viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', r.name, e.message));
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', r.name, m.text().slice(0, 200)));
    await page.goto(BASE + 'index.html?' + r.q + '&dev&mute&god&q=1' + (r.q.includes('speed=') ? '' : '&speed=' + (r.speed || 20)) + (r.nobot ? '' : '&bot'));
    try {
      await page.waitForFunction((night) => window.__frames > 5 && (!night || window.__g2), r.q.includes('night='), { timeout: 90000 });
      if (r.js) await page.evaluate(r.js);
      for (let i = 1; i <= r.count; i++) {
        if (r.real) await page.waitForTimeout(r.real);
        else {
          const t0 = await page.evaluate(() => window.__g2?.time ?? -1);
          if (t0 < 0) break; // the night is over (next scene)
          await page.waitForFunction((t) => !window.__g2 || window.__g2.won || window.__g2.time >= t, t0 + r.every, { timeout: 120000, polling: 120 });
          if (await page.evaluate(() => !!window.__g2?.won) && i > 1) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(out, `${r.name}_${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 78 }); break; }
        }
        const info = await page.evaluate(() => (window.__g2 ? `t=${window.__g2.time.toFixed(0)} stage=${window.__g2.stageIdx}` : 'scene=' + window.__scene));
        await page.screenshot({ path: path.join(out, `${r.name}_${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 78 });
        console.log(r.name, i, info);
      }
    } catch (e) { console.log('ERR', r.name, e.message.slice(0, 200)); }
    console.log('done', r.name);
    await ctx.close();
  }
  await browser.close();
})();
