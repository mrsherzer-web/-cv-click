// Records the trailer shots from the running game as frame sequences.
// usage: node tools/trailer/capture.js <outDir> [baseUrl]
// (needs the game served locally, e.g. python3 -m http.server 8123)
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const OUT = process.argv[2] || 'trailer-frames';
const BASE = process.argv[3] || 'http://127.0.0.1:8123/';
const W = 1280;
const H = 720;

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  let page = null;
  const newPage = async () => {
    if (page) await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
  };

  // The page clock is frozen; we advance it one frame at a time so even a slow
  // software renderer produces smooth footage.
  const FPS = 24;
  async function seq(name, ms, between, fps = FPS) {
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    const n = Math.round((ms / 1000) * fps);
    for (let i = 0; i < n; i++) {
      if (between) await between(i);
      await page.clock.runFor(Math.round(1000 / fps));
      await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    }
    fs.writeFileSync(path.join(dir, 'fps.txt'), String(fps));
    console.log('shot', name, n, 'frames');
  }
  async function until(cond, arg, maxMs = 120000) {
    const t0 = Date.now();
    while (!(await page.evaluate(cond, arg))) {
      await page.clock.runFor(100);
      await new Promise((r) => setTimeout(r, 30));
      if (Date.now() - t0 > maxMs) throw new Error('timeout waiting for ' + cond);
    }
  }
  const sleep = async (ms) => {
    for (let t = 0; t < ms; t += 100) {
      await page.clock.runFor(100);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const open = async (qs, scene, small = true) => {
    await newPage();
    await page.setViewportSize(small ? { width: 640, height: 360 } : { width: W, height: H });
    qs += (qs ? '&' : '?') + 'capfps=24';
    await page.clock.install({ time: new Date('2026-10-06T00:00:00') });
    await page.goto(BASE + 'index.html' + qs);
    await until((s) => window.__scene === s, scene);
  };

  const ONLY = process.env.ONLY;
  // 1. Gefen's friendly intro
  await open('', 'splash', false);
  await sleep(500);
  await page.mouse.click(W / 2, H / 2);
  await until(() => window.__scene === 'menu');
  await seq('menu', 11000);
  await until(() => !!document.querySelector('.menu .start:not([hidden])'));
  await sleep(700);
  await seq('menu_start', 1500);
  await page.click('.menu .start');
  await seq('tapestop', 1000);

  // 2. "you have nowhere to run"
  await open('?scene=demon', 'demon', false);
  await seq('demon', 5000);

  // 3. the red-bottle duo get possessed
  await open('?scene=duo', 'duo');
  await sleep(1800);
  await seq('duo_calm', 2200, null, 12);
  for (let i = 0; i < 13; i++) {
    await page.keyboard.press('Space');
    await sleep(i % 2 ? 700 : 250);
  }
  await page.keyboard.press('Space');
  await seq('duo_possess', 4500, null, 12);

  // 4. the escape
  await open('?scene=escape', 'escape');
  await seq('escape_turn', 2600, null, 15);
  await seq('escape_run', 4000, async () => {
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
  }, 15);

  // 5. a night: freeze the AI and stage the shots by hand
  await open('?scene=night&night=4', 'night');
  await page.evaluate(() => {
    const c = window.__game.director.cur;
    c.gefen.update = function (dt) {
      if (this.stage === 3) this.runT += dt;
    };
    c.movers.forEach((m) => (m.update = () => {}));
    c.time = 3 * 90 + 12;
    const hud = document.querySelector('#hud .toast');
    if (hud) hud.style.display = 'none';
  });
  await sleep(2500);
  const ev = (fn) => page.evaluate(fn);
  await page.keyboard.press('Space');
  await sleep(600);
  await seq('cam_main0', 1600, null, 12);
  await ev(() => {
    const c = window.__game.director.cur;
    c.gefen.stage = 2;
    c.onMove('main', 'main');
  });
  await seq('cam_main2', 2200, null, 12);
  await ev(() => {
    const c = window.__game.director.cur;
    c.movers[0].loc = 'cornerL';
    c.selectCam('cornerL');
  });
  await seq('cam_cornerL', 1700, null, 12);
  await ev(() => {
    const c = window.__game.director.cur;
    c.movers[1].loc = 'restroom';
    c.selectCam('restroom');
  });
  await seq('cam_restroom', 1700, null, 12);
  await ev(() => {
    const c = window.__game.director.cur;
    const g = c.gefen;
    g.stage = 3;
    g.side = 'left';
    g.runT = 0;
    g.runDur = 4;
    c.selectCam('hallL');
  });
  await seq('cam_run', 2600, null, 12);
  // back in the office: who is at the left door?
  await ev(() => {
    const c = window.__game.director.cur;
    c.gefen.stage = 0;
    c.movers[0].loc = 'door';
    c.toggleCams();
    c.layoutChars();
    c.mx = 0.0;
  });
  await sleep(1500);
  await seq('door_dark', 1200, null, 12);
  await ev(() => window.__game.director.cur.toggleLight('left'));
  await seq('door_light', 2400, null, 12);
  await ev(() => window.__game.director.cur.toggleDoor('left'));
  await seq('door_close', 1400, null, 12);
  // the power runs out
  await ev(() => {
    const c = window.__game.director.cur;
    c.toggleLight('left');
    c.movers[0].loc = 'bar';
    c.layoutChars();
    c.power = 0.01;
  });
  await until(() => !!window.__game.director.cur.out);
  await ev(() => {
    const c = window.__game.director.cur;
    c.out.d0 = 0.8;
    c.out.d1 = 999;
    c.mx = 0.1;
  });
  await sleep(1800);
  await seq('outage', 4200, null, 12);
  await ev(() => window.__game.jumpscare('gefen', () => {}));
  await seq('jumpscare', 1700, null, 24);

  // 6. title cards (rendered with the game's fonts)
  const cards = {
    card_invite: ['גפן הזמין אתכם', 'לשחק במשחק שלו', 'invite'],
    card_nights: ['5 לילות', '00:00 עד 06:00', 'clock'],
    card_power: ['תשמרו על החשמל', 'הוא רואה אתכם במצלמות', 'warn'],
    card_title: ['הסנוקר של גפן', 'עכשיו בדפדפן', 'title'],
  };
  await newPage();
  await page.setViewportSize({ width: W, height: H });
  for (const [name, [a, b, kind]] of Object.entries(cards)) {
    await page.setContent(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="${BASE}css/fonts.css">
      <style>html,body{margin:0;width:${W}px;height:${H}px;background:#000;overflow:hidden}
      .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:18px}
      .a{font-family:${kind === 'clock' ? 'VT323' : "'Rubik Wet Paint'"},Heebo,sans-serif;font-size:${kind === 'title' ? 150 : kind === 'clock' ? 170 : 100}px;line-height:1;color:${kind === 'invite' ? '#ffd166' : kind === 'clock' ? '#fff' : '#e0102a'};text-shadow:0 0 40px ${kind === 'invite' ? 'rgba(255,180,0,.45)' : kind === 'clock' ? 'rgba(255,255,255,.4)' : 'rgba(255,0,30,.6)'},0 8px 0 #200}
      .b{font-family:Heebo,sans-serif;font-weight:900;font-size:${kind === 'clock' ? 54 : 44}px;color:#d8d0c4;${kind === 'clock' ? 'direction:ltr;font-family:VT323;font-weight:400;font-size:70px' : ''}}
      .ball{width:84px;height:84px;margin:0 auto 6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#555 0%,#111 35%,#000 70%);display:grid;place-items:center;box-shadow:0 0 40px rgba(255,0,30,.3)}
      .ball span{width:36px;height:36px;border-radius:50%;background:#eee;color:#000;font:900 21px Arial;display:grid;place-items:center}
      </style></head><body><div class="c">${kind === 'title' ? '<div class="ball"><span>8</span></div>' : ''}<div class="a">${a}</div><div class="b">${b}</div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    fs.mkdirSync(path.join(OUT, 'cards'), { recursive: true });
    await page.screenshot({ path: path.join(OUT, 'cards', name + '.png') });
    console.log('card', name);
  }
  await browser.close();
})();
