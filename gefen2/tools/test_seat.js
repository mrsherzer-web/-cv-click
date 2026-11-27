// Security office on a phone: look drag, hold-to-light, tablet, camera map, mask.
// usage: node gefen2/tools/test_seat.js [url of index.html]
const { chromium, devices } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:8123/gefen2/index.html';
  const out = process.argv[3] || require('os').tmpdir();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  let fail = 0;
  for (const [label, opts] of [['upright phone', { ...devices['iPhone 13'], deviceScaleFactor: 1 }], ['sideways phone', { ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    await page.goto(base + '?night=3&stage=1&dev&god&mute&speed=3');
    await page.waitForFunction(() => window.__frames > 5 && window.__g2 && window.__g2.player.mode === 'seat' && !window.__g2.busy, null, { timeout: 120000 });
    await page.evaluate(() => { const S = window.__g2; S.officeAI({ gefen: false, ido: false, dolev: false }); S.clockRun = false; });
    await page.waitForTimeout(1000);
    const V = await page.evaluate(() => ({ W: innerWidth, H: innerHeight, rot: document.documentElement.classList.contains('vland') }));
    const gw = V.rot ? V.H : V.W, gh = V.rot ? V.W : V.H;
    const g = (x, y) => (V.rot ? [V.W - y, x] : [x, y]);
    const st = () => page.evaluate(() => { const S = window.__g2, P = S.player; return { yawT: P.yawT, light: P.flash.on, tab: S.office.tablet.open, cam: S.office.tablet.cam, mask: P.mask.on }; });
    const a = await st();
    await touch('touchStart', [g(gw * 0.5, gh * 0.4)]);
    await touch('touchMove', [g(gw * 0.5 + 50, gh * 0.4)]);
    await touch('touchMove', [g(gw * 0.5 + 110, gh * 0.4)]);
    await page.waitForTimeout(900);
    await touch('touchEnd', []);
    const b = await st();
    // hold the flashlight button
    const lb = await page.locator('.btns.seat .hb.light').boundingBox();
    const lc = [lb.x + lb.width / 2, lb.y + lb.height / 2];
    await touch('touchStart', [lc]);
    await page.waitForTimeout(1300);
    const c = await st();
    await touch('touchEnd', []);
    await page.waitForTimeout(900);
    const d = await st();
    await page.locator('.btns.seat .hb.tabbar').tap();
    await page.waitForTimeout(1300);
    const e = await st();
    await page.locator('.tablet .cam[data-cam="5"]').tap();
    await page.waitForTimeout(1300);
    const f = await st();
    await page.screenshot({ path: `${out}/seat_${label.replace(/ /g, '_')}_tablet.jpg`, type: 'jpeg', quality: 80 });
    await page.locator('.tablet .tb-close').tap();
    await page.waitForTimeout(1000);
    const h = await st();
    await page.locator('.btns.seat .hb.mask').tap();
    await page.waitForTimeout(1000);
    const i = await st();
    await page.screenshot({ path: `${out}/seat_${label.replace(/ /g, '_')}_mask.jpg`, type: 'jpeg', quality: 80 });
    const res = {
      'drag looks around': Math.abs(b.yawT - a.yawT) > 0.1 && b.yawT < a.yawT,
      'hold light': c.light && !d.light,
      'open tablet': e.tab,
      'pick camera 5': f.cam === 5,
      'close tablet': !h.tab,
      'mask': i.mask,
      'no errors': errs.length === 0,
    };
    for (const k in res) if (!res[k]) fail++;
    console.log(label.padEnd(15), 'turned:', V.rot, Object.entries(res).map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`).join(' | '), errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
