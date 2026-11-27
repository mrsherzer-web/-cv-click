// Real finger and mouse input in first person: joystick, look drag and buttons,
// on a phone held upright (page turned), a phone held sideways, and a desktop mouse.
// usage: node gefen2/tools/test_touch.js [url of index.html]   (default: the local server on port 8123)
const { chromium, devices } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:8123/gefen2/index.html';
  const out = process.argv[3] || require('os').tmpdir();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  let fail = 0;
  const cases = [
    ['upright phone', { ...devices['iPhone 13'], deviceScaleFactor: 1 }, true],
    ['sideways phone', { ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 }, true],
    ['desktop mouse', { viewport: { width: 1280, height: 720 } }, false],
  ];
  for (const [label, opts, isTouch] of cases) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text().slice(0, 160)));
    if (!isTouch) await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; }); // the drag fallback, as in a frame that refuses pointer lock
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    await page.goto(base + (base.includes('?') ? '&' : '?') + 'night=4&stage=1&dev&god&mute&speed=3');
    await page.waitForFunction(() => window.__frames > 5 && window.__g2 && window.__g2.player.mode === 'walk' && !window.__g2.busy, null, { timeout: 120000 });
    await page.evaluate(() => { const S = window.__g2; for (const e of Object.values(S.enemies)) e.hold = true; S.playerSafe = true; S.player.stand(0, -6, 0); });
    await page.waitForTimeout(1200);
    const V = await page.evaluate(() => ({ W: innerWidth, H: innerHeight, rot: document.documentElement.classList.contains('vland') }));
    const gw = V.rot ? V.H : V.W, gh = V.rot ? V.W : V.H;
    const g = (x, y) => (V.rot ? [V.W - y, x] : [x, y]); // game position -> screen position
    const st = () => page.evaluate(() => { const P = window.__g2.player; return { x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch, light: P.flash.on }; });
    const a = await st();
    let b, c, d, e2;
    if (isTouch) {
      // joystick: lower left quarter, push up = forward
      await touch('touchStart', [g(gw * 0.16, gh * 0.72)]);
      await touch('touchMove', [g(gw * 0.16, gh * 0.72 - 70)]);
      await page.waitForTimeout(2200);
      await touch('touchEnd', []);
      b = await st();
      // look: right side, drag right then down
      await touch('touchStart', [g(gw * 0.7, gh * 0.4)]);
      await touch('touchMove', [g(gw * 0.7 + 40, gh * 0.4)]);
      await touch('touchMove', [g(gw * 0.7 + 90, gh * 0.4)]);
      await page.waitForTimeout(1200);
      c = await st();
      await touch('touchMove', [g(gw * 0.7 + 90, gh * 0.4 + 60)]);
      await page.waitForTimeout(1200);
      await touch('touchEnd', []);
      d = await st();
      await page.locator('.btns.walk .hb.light').tap();
      await page.waitForTimeout(1200);
      e2 = await st();
    } else {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(2200);
      await page.keyboard.up('KeyW');
      b = await st();
      await page.mouse.move(640, 300);
      await page.mouse.down();
      await page.mouse.move(690, 300, { steps: 4 });
      await page.mouse.move(740, 300, { steps: 4 });
      await page.waitForTimeout(1200);
      c = await st();
      await page.mouse.move(740, 370, { steps: 4 });
      await page.waitForTimeout(1200);
      await page.mouse.up();
      d = await st();
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(1200);
      e2 = await st();
    }
    await page.screenshot({ path: `${out}/touch_${label.replace(/ /g, '_')}.jpg`, type: 'jpeg', quality: 80 });
    const res = {
      'walks forward': b.z < a.z - 0.3 && Math.abs(b.x - a.x) < 0.6,
      'drag right turns right': c.yaw < b.yaw - 0.05,
      'drag down looks down': d.pitch < c.pitch - 0.03,
      'flashlight button': e2.light !== d.light,
      'no errors': errs.length === 0,
    };
    for (const k in res) if (!res[k]) fail++;
    console.log(label.padEnd(15), 'turned:', V.rot, Object.entries(res).map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`).join(' | '), `(z ${a.z.toFixed(1)}->${b.z.toFixed(1)}, yaw ${b.yaw.toFixed(2)}->${c.yaw.toFixed(2)}, pitch ${c.pitch.toFixed(2)}->${d.pitch.toFixed(2)})`, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
