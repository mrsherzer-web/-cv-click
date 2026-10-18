const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + __dirname + '/titles.html');
  await p.evaluate(() => document.fonts.ready);
  const ids = process.argv.slice(3);
  for (const id of ids) {
    await p.evaluate((id) => { document.querySelectorAll('.layer').forEach(e => e.classList.toggle('on', e.id === id)); }, id);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: process.argv[2] + '/' + id + '.png', omitBackground: true });
  }
  await b.close();
})();
