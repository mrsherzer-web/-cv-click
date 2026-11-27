// Renders the app icons (assets/icon-512.png, icon-192.png) from the game's own art and fonts.
// usage: node gefen2/tools/make_icon.js   (needs the local server: python3 -m http.server 8123 --bind 127.0.0.1)
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/gefen2/';
const html = `<!doctype html><html><head><base href="${BASE}"><link rel="stylesheet" href="css/fonts.css"><style>
html,body{margin:0;background:#000}
#i{position:relative;width:512px;height:512px;overflow:hidden;background:radial-gradient(circle at 50% 38%,#2a0508 0%,#0a0102 55%,#000 100%)}
#i img{position:absolute;left:-64px;top:-70px;width:640px;filter:contrast(1.15) brightness(1.05)}
#i .v{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,transparent 38%,rgba(0,0,0,.92) 78%)}
#i b{position:absolute;right:26px;bottom:-22px;font:400 250px 'Rubik Wet Paint';color:#e0102a;text-shadow:0 0 34px rgba(255,0,30,.85),0 6px 0 #000}
#i s{position:absolute;left:30px;bottom:34px;font:400 58px 'Rubik Glitch';color:#f2f2f2;text-decoration:none;letter-spacing:2px;text-shadow:0 0 14px #000,0 0 4px #000}
</style></head><body><div id="i"><img src="assets/img/face_gefen.webp"><div class="v"></div><s>GEFEN</s><b>2</b></div></body></html>`;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.goto(BASE + 'index.html?noload', { waitUntil: 'commit' }).catch(() => {});
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const el = await page.$('#i');
  const out = path.join(__dirname, '..', 'assets');
  await el.screenshot({ path: path.join(out, 'icon-512.png') });
  await page.setViewportSize({ width: 192, height: 192 });
  await page.evaluate(() => { document.body.style.zoom = 192 / 512; });
  await page.waitForTimeout(200);
  await (await page.$('#i')).screenshot({ path: path.join(out, 'icon-192.png') });
  await browser.close();
  console.log('icons written');
})();
