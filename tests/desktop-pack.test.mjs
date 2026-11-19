// The game as one file for a computer (tools/pack-desktop.mjs): packed to a file under out/, opened from
// file:// in Chromium as a desktop (1280x720, a mouse, no touch) and once as the touch phone of the other tests.
//
// With --hf <folder that contains hf/> (the asset layer is not in this repository): not one failed request and
// not one request for a file://.../hf/ path, no console or page error; the asset layer is up from the pack (the
// asset script byte for byte and last, the start picture, the opening film, the played body in its realistic
// model, a chapter-ten film, the ad after the credits, the radio's music, a voiced line, a portrait) and every
// packed file is read back and compared with the folder. Without --hf: the basics only.
// Both ways: the how-to names the keys on the desktop and the thumbs on the phone, the full-screen button is on
// the desktop only, Enter starts the game, the keyboard walks and runs him, a mouse drag turns the camera from
// either half of the view, a save survives a reload of the file, and the studio ident (forced on, once) plays
// before the game.
// usage: node tests/desktop-pack.test.mjs [--hf <folder that contains hf/>]   (run `npm run build` first)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const hfAt = process.argv.indexOf('--hf');
const hfArg = hfAt > 0 ? process.argv[hfAt + 1] : null;
const shots = `${root}test-results/desktop-pack/`;
const packed = `${root}out/test/desktop-pack${hfArg ? '-hf' : ''}.html`;
const KEY = 'nehorai-game:save:v1';
await mkdir(shots, { recursive: true });

const T0 = Date.now();
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}  [${((Date.now() - T0) / 60000).toFixed(1)} min]`); return !!ok; };
const fnv = (bytes) => { let h = 0x811c9dc5; for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); } return h >>> 0; };

// ---------- pack ----------
const log = execFileSync('node', [`${root}tools/pack-desktop.mjs`, ...(hfArg ? ['--hf', hfArg] : []), '--out', packed], { encoding: 'utf8' });
console.log(log.trim().split('\n').map((l) => `  ${l}`).join('\n'));
const size = (await stat(packed)).size;
check('the tool packs the game into one file under out/', size > 2e6 && (!hfArg || size < 80e6), `${(size / 1048576).toFixed(1)} MB`);

// what the folder holds, for the walk through the pack
const disk = new Map();
let hfDir = null;
if (hfArg) {
  hfDir = await stat(`${hfArg}/hf/hf-assets.js`).then(() => `${hfArg}/hf`, () => hfArg);
  const walk = async (dir, prefix = '') => {
    for (const name of (await readdir(dir)).sort()) {
      if (name.startsWith('.')) continue;
      const st = await stat(`${dir}/${name}`);
      if (st.isDirectory()) await walk(`${dir}/${name}`, `${prefix}${name}/`);
      else { const b = await readFile(`${dir}/${name}`); disk.set(`${prefix}${name}`, { size: b.length, hash: fnv(b) }); }
    }
  };
  await walk(hfDir);
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

// a page on a file, with everything it asks for and every complaint collected
async function open(file, context, { ident = false } = {}) {
  const ctx = await browser.newContext(context);
  ctx.setDefaultTimeout(240000);
  const page = await ctx.newPage();
  const seen = { errors: [], requests: [], failed: [], aborted: [] };
  page.on('pageerror', (e) => seen.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') seen.errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!/^(blob|data):/.test(u)) seen.requests.push(u); });
  // a blob: read that the page itself cut off (a film taken away while it loads) is not a failure
  page.on('requestfailed', (r) => { const why = r.failure()?.errorText || ''; (/ERR_ABORTED/.test(why) && /^blob:/.test(r.url()) ? seen.aborted : seen.failed).push(`${why} ${r.url().slice(0, 140)}`); });
  // when the start button was first enabled, on the page's own clock
  await page.addInitScript(() => {
    const iv = setInterval(() => { const b = document.getElementById('startBtn'); if (b && !b.disabled) { window.__enabledAt = Math.round(performance.now()); clearInterval(iv); } }, 20);
  });
  if (ident) await page.addInitScript(() => { window.__identForce = true; });
  const ready = async () => {
    await page.waitForFunction(() => window.__game && window.__enabledAt, null, { timeout: 240000 });
    return page.evaluate(() => window.__enabledAt);
  };
  await page.goto(`file://${file}`, { waitUntil: 'commit' });
  const enabledAt = await ready();
  const S = () => page.evaluate(() => { const s = window.__game.state; return { started: s.started, t: s.time, x: s.player.x, z: s.player.z, yaw: s.camera.yaw, running: s.player.running, mode: s.mode }; });
  // a wait in the game's own time, with a real-time limit (frames come slowly in software rendering)
  const gameTime = async (sec, limit = 90000) => { const t0 = (await S()).t, end = Date.now() + limit; while (Date.now() < end && (await S()).t - t0 < sec) await page.waitForTimeout(150); };
  const until = (fn, arg, limit = 60000) => page.waitForFunction(fn, arg, { timeout: limit }).then(() => true, () => false);
  return { ctx, page, seen, enabledAt, ready, S, gameTime, until };
}
const startScreen = (page) => page.evaluate(() => {
  const list = document.querySelector('#startScreen .howto'), link = document.querySelector('#startScreen a.linkbtn');
  return {
    desktop: document.documentElement.classList.contains('desktop'), howto: list.innerText, howtoShown: getComputedStyle(list).visibility === 'visible',
    fullscreen: !!document.getElementById('startFullscreenBtn'), note: document.getElementById('startNote').textContent,
    link: link ? getComputedStyle(link).display : null, start: document.getElementById('startBtn').textContent.trim(),
    anew: !document.getElementById('newGameBtn').hidden, assets: !!window.__hfAssets, pack: window.__hfPack ? window.__hfPack.files.length : null,
  };
});

// ---------- the plain build, for the time to its start button (told, not judged: the machine is shared) ----------
{
  const plain = await open(`${root}dist/play.html`, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  console.log(`time to the enabled start button, the plain build (dist/play.html): ${plain.enabledAt} ms`);
  await plain.ctx.close();
}

// ---------- the desktop ----------
const d = await open(packed, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
{
  const { page, seen, S, gameTime, until } = d;
  console.log(`time to the enabled start button, the packed file (${(size / 1048576).toFixed(1)} MB): ${d.enabledAt} ms`);
  let a = await startScreen(page);
  check('desktop: the packed file opens from file:// and its start button is enabled', a.start === 'להתחיל', `${d.enabledAt} ms on the page's clock; ${a.start}`);
  check('desktop: the how-to names the keys and the mouse', a.desktop && a.howtoShown && /W/.test(a.howto) && /Shift/.test(a.howto) && /עכבר/.test(a.howto) && /Esc/.test(a.howto) && !/אגודל/.test(a.howto) && !/טלפון לרוחב/.test(a.note), a.howto.replace(/\s+/g, ' ').slice(0, 90));
  check('desktop: the link to the characters page (a second file) is there and hidden', a.link === 'none', `display ${a.link}`);

  if (hfArg) {
    check('desktop: the asset layer is up from the pack', a.assets && a.pack === disk.size, `window.__hfAssets ${a.assets}, ${a.pack} packed files, ${disk.size} in the folder`);
    const script = await page.evaluate(() => { const all = [...document.querySelectorAll('script')], s = document.querySelector('script[data-packed]'); return { text: s?.textContent ?? null, last: all[all.length - 1] === s, inline: s ? !s.src : null }; });
    const onDisk = await readFile(`${hfDir}/hf-assets.js`, 'utf8');
    check('desktop: the asset script is the last script of the page, inline, byte for byte the folder\'s', script.text === onDisk && script.last && script.inline, `${script.text?.length} characters, ${onDisk.length} in the folder; last ${script.last}`);
    const art = await until(() => document.getElementById('startScreen').classList.contains('hf-art'), null, 60000)
      && await page.evaluate(async () => {
        const bg = getComputedStyle(document.getElementById('startScreen')).backgroundImage, m = bg.match(/url\("(blob:[^"]+)"\)/);
        if (!m) return { bg: bg.slice(0, 120) };
        const img = new Image(); img.src = m[1]; await img.decode().catch(() => {});
        return { blob: true, w: img.naturalWidth, h: img.naturalHeight };
      });
    check('desktop: the start screen wears its picture, from the pack', art && art.blob && art.w > 400, JSON.stringify(art));
  }
  await page.screenshot({ path: `${shots}desktop-start${hfArg ? '-hf' : ''}.png` });

  // full screen from the start screen's own button, and back
  check('desktop: the start screen has a full-screen button', a.fullscreen);
  if (a.fullscreen) {
    await page.click('#startFullscreenBtn');
    const on = await until(() => !!document.fullscreenElement && document.getElementById('startFullscreenBtn').textContent === 'יציאה ממסך מלא', null, 30000);
    await page.click('#startFullscreenBtn');
    const off = await until(() => !document.fullscreenElement && document.getElementById('startFullscreenBtn').textContent === 'מסך מלא', null, 30000);
    check('desktop: the button takes the page to full screen and back, its words following', on && off, `on ${on}, off ${off}`);
  }

  // Enter starts the game; on a first visit with the asset layer the opening film comes first, from the pack
  await page.keyboard.press('Enter');
  if (hfArg) {
    const film = await until(() => { const s = window.__hfIntro?.state; return s && s.playing && s.phase === 'film' && s.time > 0.4; }, null, 90000);
    const v = await page.evaluate(() => { const v = document.querySelector('#hfIntro video'); return v ? { src: v.src.slice(0, 5), w: v.videoWidth, t: +v.currentTime.toFixed(2), poster: v.poster.slice(0, 5), started: window.__game.state.started } : null; });
    await page.screenshot({ path: `${shots}desktop-intro.png` });
    check('desktop: Enter presses start: the opening film plays from the pack, the game waiting under it', film && v && v.src === 'blob:' && v.poster === 'blob:' && v.w > 0 && !v.started, JSON.stringify(v));
    await page.click('#hfIntro .hfi-skip');
  }
  check('desktop: Enter starts the game', await until(() => window.__game.state.started && document.getElementById('startScreen').hidden, null, 60000));

  // the keyboard and the mouse, on the street by the house
  await page.evaluate(() => { const g = window.__game; g.teleport(g.home.x + Math.sin(g.home.yaw) * 9, g.home.z + Math.cos(g.home.yaw) * 9); });
  const aim = () => page.evaluate(() => { const g = window.__game, st = g.state; g.setCamera(Math.atan2(-(g.lookout.x - st.player.x), -(g.lookout.z - st.player.z)), 0.2); });
  await aim();
  await gameTime(0.2);
  const turns = [];
  for (const x of [200, 1000]) {
    const y0 = (await S()).yaw;
    await page.mouse.move(x, 420); await page.mouse.down(); await page.mouse.move(x + 240, 420, { steps: 8 }); await gameTime(0.15); await page.mouse.up();
    turns.push(Math.abs((await S()).yaw - y0));
  }
  check('desktop: a mouse drag turns the camera, from the left half of the view and from the right', turns[0] > 0.5 && turns[1] > 0.5, `left ${turns[0].toFixed(2)} rad, right ${turns[1].toFixed(2)} rad`);
  await aim();
  const speed = async (sec) => { const p = await S(); await gameTime(sec); const q = await S(); return { v: Math.hypot(q.x - p.x, q.z - p.z) / Math.max(1e-3, q.t - p.t), running: q.running }; };
  await page.keyboard.down('w');
  await gameTime(0.3);
  const walk = await speed(0.8);
  await page.keyboard.down('Shift');
  await gameTime(0.5);
  const run = await speed(0.8);
  await page.keyboard.up('Shift'); await page.keyboard.up('w');
  check('desktop: W walks him and Shift makes him run', walk.v > 1 && !walk.running && run.running && run.v > walk.v * 1.5, `walking ${walk.v.toFixed(1)} m/s, running ${run.v.toFixed(1)} m/s`);
  await page.keyboard.press('p');
  const paused = await until(() => window.__game.state.paused, null, 20000);
  const menu = await page.evaluate(() => { const f = document.getElementById('fullscreenBtn'); return { shown: !f.hidden, underResume: f.previousElementSibling?.id === 'resumeBtn' }; });
  await page.screenshot({ path: `${shots}desktop-pause.png` });
  check('desktop: P pauses; the pause menu has its full-screen button, right under "continue"', paused && menu.shown && menu.underResume, JSON.stringify(menu));
  await page.keyboard.press('p');
  await until(() => !window.__game.state.paused, null, 20000);

  if (hfArg) {
    // the played body in its realistic model, the Renault in its own, the road in its photograph
    const worn = await until(() => { const g = window.__game.debug.game; return !!g.nehorai?.hfPerson && !!g.car.model.userData.hfCar; }, null, 120000);
    const road = await page.evaluate(() => { const m = window.__game.debug.world.materials.asphalt?.map; return String(m?.image?.src || '').slice(0, 5); });
    await gameTime(0.3);
    await page.screenshot({ path: `${shots}desktop-game-hf.png` });
    check('desktop: the played body wears its realistic model, the Renault and the road theirs', worn && road === 'blob:', `body and car ${worn}, the road's picture from ${road}`);

    // a chapter-ten film
    const can = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"'));
    await page.evaluate(() => { window.__film = null; window.__fallback = false; window.__game.debug.game.playCutscene('c10-dawn', () => { window.__fallback = true; return Promise.resolve(); }).then(() => { window.__film = 'resolved'; }, (e) => { window.__film = `rejected ${e}`; }); });
    const playing = await until(() => { const v = document.querySelector('.hf-film video'); return v && v.currentTime > 0.3 && v.videoWidth > 0; }, null, 60000);
    const mid = await page.evaluate(() => { const v = document.querySelector('.hf-film video'); return v ? { src: v.src.slice(0, 5), t: +v.currentTime.toFixed(2), dur: +(v.duration || 0).toFixed(1), w: v.videoWidth, cutscene: !!window.__game.debug.game.cutscene } : null; });
    await page.screenshot({ path: `${shots}desktop-film.png` });
    if (mid) await page.dispatchEvent('.hf-film', 'pointerdown').catch(() => {});
    await until(() => window.__film !== null, null, 30000);
    const after = await page.evaluate(() => ({ done: window.__film, fallback: window.__fallback, left: document.querySelectorAll('.hf-film').length, cutscene: !!window.__game.debug.game.cutscene }));
    check('desktop: a chapter-ten film plays from the pack over the game, a press ends it, nothing is left', playing && mid?.src === 'blob:' && mid.cutscene && after.done === 'resolved' && !after.fallback && after.left === 0 && !after.cutscene, `H.264 here: ${can || 'no'}; ${JSON.stringify(mid)} then ${JSON.stringify(after)}`);

    // the ad after the credits: its address as the asset layer gives it, in a film element as the ending makes one
    const ad = await page.evaluate(async () => {
      const src = window.__game.debug.game.endingAd?.src || null;
      if (!src) return { src };
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
      v.style.cssText = 'position:fixed;left:0;top:0;width:160px;opacity:.01;pointer-events:none';
      document.body.append(v);
      await v.play().catch(() => {});
      await new Promise((done) => { const t0 = performance.now(); const iv = setInterval(() => { if (v.currentTime > 0.3 || performance.now() - t0 > 60000) { clearInterval(iv); done(); } }, 100); });
      const out = { src, from: v.src.slice(0, 5), t: +v.currentTime.toFixed(2), dur: +(v.duration || 0).toFixed(1), w: v.videoWidth, h: v.videoHeight, err: v.error?.code ?? null };
      v.pause(); v.remove();
      return out;
    });
    check('desktop: the ad after the credits is registered, its address resolves into the pack and it plays', ad.src === 'hf/end/ad.mp4' && ad.from === 'blob:' && ad.t > 0.3 && ad.dur > 19 && ad.w === 1280 && ad.h === 720, JSON.stringify(ad));

    // the radio's music (new Audio(address), as the game plays it) and a voiced line (fetched and decoded, as the layer does)
    const music = await page.evaluate(async () => {
      const r = window.__game.debug.game.radio;
      r.play(0);
      const el = r.audio;
      if (!el) return { audio: false, tracks: Object.keys(r.tracks) };
      await new Promise((done) => { const t0 = performance.now(); const iv = setInterval(() => { if (el.currentTime > 0.2 || performance.now() - t0 > 60000) { clearInterval(iv); done(); } }, 100); });
      const out = { audio: true, from: el.src.slice(0, 5), t: +el.currentTime.toFixed(2), dur: +(el.duration || 0).toFixed(1), err: el.error?.code ?? null };
      r.stop();
      return out;
    });
    check('desktop: a music track plays on the car radio from the pack', music.audio && music.from === 'blob:' && music.t > 0.2 && music.dur > 5, JSON.stringify(music));
    const voice = await page.evaluate(async () => {
      const g = window.__game.debug.game, asked = [...window.__hfPack.asked].filter((p) => p.startsWith('v/')).length;
      const res = await fetch('hf/v/c1.mp3'), buf = await res.arrayBuffer(), bytes = buf.byteLength;
      const clip = await g.sound.ctx.decodeAudioData(buf).catch((e) => ({ error: String(e) }));
      return { asked, status: res.status, type: res.headers.get('Content-Type'), bytes, seconds: clip.duration ? +clip.duration.toFixed(2) : 0, error: clip.error };
    });
    check('desktop: the voiced lines are read from the pack and one decodes into sound', voice.asked === [...disk.keys()].filter((p) => p.startsWith('v/')).length && voice.status === 200 && voice.type === 'audio/mpeg' && voice.seconds > 0.3, JSON.stringify(voice));

    // a portrait, set the two ways the layer sets one on a face: on an element made first and put in after
    // (the captions, the chat of the opening film), and on one that is already in the page (the call card)
    const face = await page.evaluate(async () => {
      const make = () => { const el = document.createElement('span'); el.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;opacity:.01;pointer-events:none'; return el; };
      const first = make(), after = make();
      first.style.backgroundImage = 'url("hf/p/erez.jpg")';
      document.body.append(first, after);
      after.style.backgroundImage = 'url("hf/p/yonati.jpg")';
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 50)));
      const out = [];
      for (const el of [first, after]) {
        const bg = getComputedStyle(el).backgroundImage, m = bg.match(/url\("(blob:[^"]+)"\)/);
        const img = new Image();
        if (m) { img.src = m[1]; await img.decode().catch(() => {}); }
        out.push({ from: bg.slice(0, 10), w: img.naturalWidth });
        el.remove();
      }
      return out;
    });
    check('desktop: a portrait set as a face\'s background shows from the pack, on a face made first and on one already in the page', face.every((f) => /^url\("blob:/.test(f.from) && f.w > 50), JSON.stringify(face));

    // every packed file, read back through fetch and compared with the folder
    const read = await page.evaluate(async () => {
      const out = {};
      for (const p of window.__hfPack.files) {
        try {
          const res = await fetch(`hf/${p}`), b = new Uint8Array(await res.arrayBuffer());
          let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
          out[p] = { status: res.status, size: b.length, hash: h >>> 0 };
        } catch (e) { out[p] = { error: String(e) }; }
      }
      return out;
    });
    const wrong = [...disk].filter(([p, f]) => !read[p] || read[p].status !== 200 || read[p].size !== f.size || read[p].hash !== f.hash).map(([p]) => p);
    check('desktop: every packed file is reachable and is the folder\'s file, byte for byte', Object.keys(read).length === disk.size && wrong.length === 0, `${Object.keys(read).length} read, ${disk.size} in the folder${wrong.length ? `; wrong: ${wrong.slice(0, 6).join(', ')}` : ''}`);
    const pack = await page.evaluate(async () => {
      const missing = [...window.__hfPack.missing], inert = window.__hfPack.inert();
      const res = await fetch('hf/no-such-file.jpg');
      return { missing, inert, unknown: res.status };
    });
    check('desktop: nothing was asked of the pack that it does not hold; an unknown hf/ address answers 404 by itself', pack.missing.length === 0 && pack.unknown === 404 && pack.inert === 0, JSON.stringify(pack));
  }

  // a save, then the file loaded again: "continue" is offered. The second load runs with the studio ident forced on
  const saved = await page.evaluate((KEY) => { const ok = window.__game.debug.game.save(); return { ok, stored: !!localStorage.getItem(KEY) }; }, KEY);
  await page.addInitScript(() => { window.__identForce = true; });
  await page.reload({ waitUntil: 'commit' });
  await d.ready();
  if (hfArg) await until(() => document.getElementById('startScreen').classList.contains('hf-art') && document.getElementById('hfIntroBtn'), null, 60000);
  a = await startScreen(page);
  await page.screenshot({ path: `${shots}desktop-continue${hfArg ? '-hf' : ''}.png` });
  check('desktop: progress survives a reload of the file: a save, then "להמשיך" and "משחק חדש" are offered', saved.ok !== false && saved.stored && a.start === 'להמשיך' && a.anew, `saved ${JSON.stringify(saved)}; the button says ${a.start}`);
  await page.click('#startBtn');
  const ident = await until(() => window.__ident?.state === 'playing', null, 30000);
  const under = await page.evaluate(() => ({ started: window.__game.state.started, canvas: !!document.querySelector('canvas:not(#view)') }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}desktop-ident.png` });
  const over = await until(() => window.__ident?.state === 'done' && window.__game.state.started && document.getElementById('startScreen').hidden, null, 120000);
  check('desktop: the studio ident (forced on) plays on the press, then the game starts', ident && !under.started && over, `playing ${ident}, the game held meanwhile ${!under.started}, over and started ${over}`);

  if (hfArg) {
    const hf = seen.requests.filter((u) => /\/hf\//.test(u));
    check('desktop: not one request for a file under hf/, not one failed request', hf.length === 0 && seen.failed.length === 0, `${seen.requests.length} requests in all (the file itself, twice with the reload); failed: ${seen.failed.slice(0, 3).join(' | ') || 'none'}; cut off by the page itself: ${seen.aborted.length}`);
  } else check('desktop: nothing is asked for but the file itself, not one failed request', seen.requests.every((u) => u === `file://${packed}`) && seen.failed.length === 0, `${seen.requests.length} requests; failed: ${seen.failed.slice(0, 3).join(' | ') || 'none'}`);
  check('desktop: no console or page error', seen.errors.length === 0, seen.errors.slice(0, 4).join(' | ').slice(0, 500));
  await d.ctx.close();
}

// ---------- the touch phone of the other tests ----------
{
  const p = await open(packed, { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const { page, seen, until } = p;
  if (hfArg) await until(() => document.getElementById('startScreen').classList.contains('hf-art'), null, 60000);
  const a = await startScreen(page);
  await page.screenshot({ path: `${shots}phone-start${hfArg ? '-hf' : ''}.png` });
  check('phone: the how-to speaks of thumbs, as it did; no full-screen button on the start screen, nothing marked as a computer', !a.desktop && a.howtoShown && /אגודל/.test(a.howto) && !/Shift/.test(a.howto) && !a.fullscreen && /טלפון לרוחב/.test(a.note), a.howto.replace(/\s+/g, ' ').slice(0, 70));
  if (hfArg) check('phone: the asset layer is up from the pack', a.assets && a.pack === disk.size && a.link === 'none');
  await page.tap('#startBtn');
  if (hfArg) {
    const film = await until(() => { const s = window.__hfIntro?.state; return s && s.playing && s.time > 0.2; }, null, 90000);
    check('phone: the opening film plays from the pack on the first start', film);
    await page.tap('#hfIntro .hfi-skip');
  }
  const started = await until(() => window.__game.state.started && document.getElementById('startScreen').hidden, null, 60000);
  await page.waitForTimeout(1500);
  check('phone: the game starts; no failed request, no console or page error', started && seen.failed.length === 0 && seen.errors.length === 0 && !seen.requests.some((u) => /\/hf\//.test(u)), `${seen.requests.length} request(s); ${[...seen.failed, ...seen.errors].slice(0, 3).join(' | ').slice(0, 300) || 'clean'}`);
  await p.ctx.close();
}

await browser.close();
console.log(`\n${packed}: ${(size / 1048576).toFixed(1)} MB (${size} bytes)`);
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
