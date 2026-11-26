// usage: node gefen2/tools/shot.js <outDir> name=query [name=query ...]   (query is appended to dev.html?)
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const W = +(process.env.W || 960), H = +(process.env.H || 540);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  const base = process.env.BASE || 'http://127.0.0.1:8123/gefen2/';
  for (const arg of process.argv.slice(3)) {
    const i = arg.indexOf('=');
    const name = arg.slice(0, i), query = arg.slice(i + 1);
    await page.goto(base + (process.env.PAGE || 'dev.html') + '?' + query);
    try { await page.waitForFunction(() => window.__frames > 8, null, { timeout: 60000 }); } catch (e) { console.log('timeout', name); }
    await page.waitForTimeout(+(process.env.WAIT || 600));
    const st = await page.evaluate(() => JSON.stringify(window.__stats || {}));
    await page.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 80 });
    console.log(name, st);
  }
  await browser.close();
})();
