// The main process of the desktop version (Electron): one window that shows the game's single HTML file, which
// tools/make-windows-app.mjs puts beside this file as game.html. Plain CommonJS with no dependencies.
//
//   the window     at least 1280x720, opens maximized, dark while the page loads, no menu bar
//   full screen    F11 and Alt+Enter; the game's own button (it asks the page for full screen) works as well.
//                  Esc is not bound here: it reaches the game, which pauses
//   the page       no Node in it (context isolation and the sandbox are on), sound and films may start without
//                  a press, and it can go nowhere else: navigation and new windows are refused
//   saves          the page's localStorage, kept in the app's own data folder (on Windows
//                  %APPDATA%\Nehorai Farhi, that is C:\Users\<name>\AppData\Roaming\Nehorai Farhi)
//   one instance   a second start brings the first window to the front
//   the characters room   the game's second page, when the build was given it (characters.html beside
//                  game.html): the start screen's link opens it and its link back returns to the game.
//                  Without it the link is hidden, so the start screen has no dead button
//
// A check for the people who build it:   <exe> --smoke <report.json> <shot.png>
// loads the game with a throwaway data folder, waits (bounded) for the start button, notes what the page has
// (WebGL2, the renderer, the asset layer, the title, any page error), presses the button, waits until the game's
// clock runs, saves a picture of the window, writes the report and exits 0 (all good) or 1.
'use strict';

const { app, BrowserWindow, Menu, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const TITLE = 'חייו של נהוראי פרחי';
const DARK = '#11151c'; // the page's own background, so nothing flashes when it arrives
const GAME = path.join(__dirname, 'game.html');
const ROOM = path.join(__dirname, 'characters.html'), hasRoom = fs.existsSync(ROOM);

const at = process.argv.indexOf('--smoke');
const smoke = at > 0 ? { report: path.resolve(process.argv[at + 1] || 'smoke-report.json'), shot: path.resolve(process.argv[at + 2] || 'smoke.png') } : null;

// sound and the films start by themselves, as they do on the web page after its first tap
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// a laptop with two graphics chips gives the game the strong one; a computer with no usable graphics chip
// still gets WebGL, drawn by the processor (slow, but the game opens)
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// the check never touches the player's saves, and may run beside an open game
if (smoke) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nehorai-smoke-'));
  app.setPath('userData', dir);
  app.on('quit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still held by a process that is on its way out */ } });
}

let win = null;

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(open);
}

// Where an address leads: 'game' (the game's file, whatever follows a # or a ?: it reloads itself for a new
// game), 'room' (the characters room, when it is in the app), 'back' (the room's link back, which names the
// game by its web names), or null for anywhere else
function place(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return null;
    const file = fileURLToPath(u.href.split(/[?#]/)[0]), name = path.basename(file);
    if (path.dirname(file) !== __dirname) return null;
    return name === 'game.html' ? 'game' : name === 'characters.html' && hasRoom ? 'room' : hasRoom && (name === 'play.html' || name === 'index.html') ? 'back' : null;
  } catch { return null; }
}
const isGame = (url) => place(url) === 'game';

function open() {
  Menu.setApplicationMenu(null);
  // the page may ask for full screen and to hold the pointer or the Esc key; nothing else (camera, location...)
  const ALLOWED = ['fullscreen', 'pointerLock', 'keyboardLock'];
  session.defaultSession.setPermissionRequestHandler((wc, permission, done) => done(ALLOWED.includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED.includes(permission));

  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540, useContentSize: true,
    show: false, backgroundColor: DARK, title: TITLE, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, devTools: !!smoke },
  });
  win.removeMenu();
  const wc = win.webContents;

  // nowhere else: links, redirects, pop-ups and dropped files stay out
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  const guard = (e, url) => {
    const to = place(url);
    if (to === 'game' || to === 'room') return;
    e.preventDefault();
    if (to === 'back') win.loadFile(GAME).catch(() => {});
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  if (!hasRoom) wc.on('dom-ready', () => { wc.insertCSS('a[href="characters.html"] { display: none !important; }').catch(() => {}); });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  // the title bar keeps the game's name
  win.on('page-title-updated', (e) => e.preventDefault());

  // full screen. F11 and Alt+Enter switch the window; when the game's own button has put the page in full
  // screen, the same keys leave it the page's way, so the button's label stays right. In the page's full screen
  // Esc is asked for the game as well (without that the browser engine takes Esc to leave full screen).
  let pageFull = false;
  wc.on('enter-html-full-screen', () => { pageFull = true; wc.executeJavaScript('navigator.keyboard && navigator.keyboard.lock(["Escape"]).catch(() => {}); 0', true).catch(() => {}); });
  wc.on('leave-html-full-screen', () => { pageFull = false; });
  const toggleFull = () => {
    if (pageFull) wc.executeJavaScript('document.fullscreenElement && document.exitFullscreen().catch(() => {}); 0', true).catch(() => {});
    else win.setFullScreen(!win.isFullScreen());
  };
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    if (key === 'f11' || (key === 'enter' && input.alt)) { e.preventDefault(); if (!input.isAutoRepeat) toggleFull(); }
  });

  if (smoke) { win.show(); runSmoke(win); } else { win.maximize(); win.show(); }
  win.loadFile(GAME).catch((err) => { if (!smoke) console.error('the game did not load:', err.message); });
  win.on('closed', () => { win = null; });
}

// ---------- the check ----------
function runSmoke(w) {
  const wc = w.webContents, t0 = Date.now();
  const LIMIT = (Number(process.env.NEHORAI_SMOKE_SECONDS) || 240) * 1000; // everything, start to finish
  const report = {
    ok: false, failure: null, electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform, arch: process.arch,
    game: GAME, room: hasRoom, roomLink: null, userData: app.getPath('userData'), title: null, windowTitle: null, webgl2: null, renderer: null, assets: null,
    nodeInPage: null, started: null, running: null, state: null, navigationBlocked: null, popupBlocked: null, keys: null,
    errors: [], ms: {}, screenshot: null,
  };
  let finished = false;
  const finish = async (failure) => {
    if (finished) return; finished = true;
    report.failure = failure || null;
    report.ok = !failure && report.errors.length === 0;
    if (!failure && !report.ok) report.failure = 'the page reported errors';
    report.ms.total = Date.now() - t0;
    try { fs.mkdirSync(path.dirname(smoke.report), { recursive: true }); fs.writeFileSync(smoke.report, JSON.stringify(report, null, 2)); } catch (err) { console.error('the report could not be written:', err.message); }
    console.log(`smoke: ${report.ok ? 'ok' : `FAILED (${report.failure})`}  ${smoke.report}`);
    app.exit(report.ok ? 0 : 1);
  };
  const watchdog = setTimeout(() => finish(`not done within ${LIMIT / 1000} s`), LIMIT);
  const left = () => LIMIT - (Date.now() - t0) - 5000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = (code) => wc.executeJavaScript(code, true);
  // asks the page until it answers something truthy, or the time is up (then null)
  const until = async (code, limit, every = 400) => {
    const end = Date.now() + Math.min(limit, Math.max(0, left()));
    for (;;) {
      const v = await page(code).catch(() => null);
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(every);
    }
  };

  // what counts as a page error: an uncaught exception or anything the page logs as an error, a page that
  // did not load, a renderer that went away
  wc.on('console-message', (e) => { if (e.level === 'error') report.errors.push(String(e.message)); });
  wc.on('did-fail-load', (e, code, text, url, isMainFrame) => { if (isMainFrame) finish(`the page did not load (${code} ${text})`); });
  wc.on('render-process-gone', (e, d) => finish(`the page's process is gone (${d.reason})`));

  wc.once('did-finish-load', async () => {
    try {
      report.ms.loaded = Date.now() - t0;
      const ready = await until('!!(window.__game && document.getElementById("startBtn") && !document.getElementById("startBtn").disabled)', 150000);
      if (!ready) return finish('window.__game and an enabled start button did not come');
      report.ms.ready = Date.now() - t0;
      Object.assign(report, await page(`(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
        return {
          title: document.title, webgl2: !!gl, renderer: gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null,
          assets: !!window.__hfAssets, roomLink: (() => { const a = document.querySelector('a[href="characters.html"]'); return !a ? 'none' : a.offsetParent ? 'shown' : 'hidden'; })(), nodeInPage: typeof require !== 'undefined' || typeof process !== 'undefined' || typeof module !== 'undefined',
        };
      })()`));
      report.windowTitle = w.getTitle();
      if (!report.webgl2) return finish('WebGL2 is not available');
      if (report.roomLink === 'shown' && !hasRoom) return finish('the start screen shows a link to a characters room the app does not have');

      await page('document.getElementById("startBtn").click(); 0');
      const clock = '(() => { const s = window.__game.state; return s.started ? { started: s.started, paused: s.paused, time: s.time, fps: s.fps, mode: s.mode, quality: s.quality } : null; })()';
      const first = await until(clock, 60000);
      report.started = !!first;
      if (!first) return finish('the game did not start after the start button');
      report.ms.started = Date.now() - t0;
      // running: the game's own clock moves on (two seconds of it, so the picture shows the game itself)
      const later = await until(`(() => { const s = ${clock}; return s && s.time >= ${first.time} + 2 ? s : null; })()`, 90000);
      report.running = !!later; report.state = later || first;
      if (!later) return finish("the game's clock does not run");
      report.ms.running = Date.now() - t0;

      const shot = await wc.capturePage();
      fs.mkdirSync(path.dirname(smoke.shot), { recursive: true });
      fs.writeFileSync(smoke.shot, shot.toPNG());
      report.screenshot = { file: smoke.shot, ...shot.getSize() };

      // the walls of the page: a pop-up is refused, going elsewhere is refused
      report.popupBlocked = await page('(() => { try { return window.open("https://example.com/") === null; } catch { return true; } })()');
      await page('location.href = "https://example.com/"; 0');
      await sleep(600);
      report.navigationBlocked = isGame(wc.getURL()) && !!(await page('!!window.__game').catch(() => false));
      // the keys, pressed for real. Esc belongs to the game (it pauses, and again resumes), in the window and in
      // full screen; F11 and Alt+Enter switch full screen and do not reach the game; the game's own full-screen
      // button works, keeps Esc for the game, and F11 leaves it
      wc.focus();
      await page('window.__keys = []; addEventListener("keydown", (e) => window.__keys.push(e.key), true); 0');
      const press = async (keyCode, modifiers = []) => { wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); await sleep(120); };
      const comes = async (test, limit = 5000) => { for (const end = Date.now() + limit; ;) { if (await test()) return true; if (Date.now() > end) return false; await sleep(120); } };
      const paused = (want) => comes(async () => (await page('window.__game.state.paused')) === want);
      const full = (want) => comes(() => w.isFullScreen() === want);
      const pageFullNow = (want) => comes(async () => (await page('!!document.fullscreenElement')) === want);
      const k = report.keys = {};
      await press('Escape'); k.escPauses = await paused(true);
      await press('Escape'); k.escResumes = await paused(false);
      await press('F11'); k.f11Enters = await full(true);
      await press('Escape'); k.escInFullScreenPauses = await paused(true) && w.isFullScreen();
      await press('Escape'); await paused(false);
      await press('F11'); k.f11Leaves = await full(false);
      await press('Enter', ['alt']); k.altEnterEnters = await full(true);
      await press('Enter', ['alt']); k.altEnterLeaves = await full(false);
      const seen = await page('window.__keys.slice()');
      k.keptFromTheGame = !seen.includes('F11') && !seen.includes('Enter');
      await page('document.getElementById("fullscreenBtn").click(); 0');
      k.gameButtonEnters = await pageFullNow(true);
      k.gameButtonLabel = await page('document.getElementById("fullscreenBtn").textContent');
      await sleep(300); // the hold on Esc is asked for as the page enters full screen
      await press('Escape'); k.escInGameFullScreenPauses = await paused(true) && await page('!!document.fullscreenElement');
      await press('Escape'); await paused(false);
      await press('F11'); k.f11LeavesGameFullScreen = await pageFullNow(false);
      await sleep(300);
      k.windowBack = !w.isFullScreen();
      k.seen = await page('window.__keys.slice()');

      if (report.nodeInPage) return finish('the page can reach Node');
      if (!report.popupBlocked || !report.navigationBlocked) return finish('the page could leave the game');
      const missed = Object.entries(k).filter(([, v]) => v === false).map(([name]) => name);
      if (missed.length) return finish(`keys: ${missed.join(', ')}`);
      clearTimeout(watchdog);
      finish(null);
    } catch (err) { finish(`the check itself failed: ${err && err.message}`); }
  });
}
