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
const { pathToFileURL } = require('node:url');

const TITLE = 'חייו של נהוראי פרחי';
const DARK = '#11151c'; // the page's own background, so nothing flashes when it arrives
const GAME = path.join(__dirname, 'game.html');
const GAME_URL = pathToFileURL(GAME).href;

const at = process.argv.indexOf('--smoke');
const smoke = at > 0 ? { report: path.resolve(process.argv[at + 1] || 'smoke-report.json'), shot: path.resolve(process.argv[at + 2] || 'smoke.png') } : null;

// sound and the films start by themselves, as they do on the web page after its first tap
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// a laptop with two graphics chips gives the game the strong one; a computer with no usable graphics chip
// still gets WebGL, drawn by the processor (slow, but the game opens)
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// the check never touches the player's saves, and may run beside an open game
if (smoke) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'nehorai-smoke-')));

let win = null;

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(open);
}

// the same file, whatever follows a # or a ? (the game reloads itself for a new game)
const isGame = (url) => { try { const u = new URL(url); return u.protocol === 'file:' && u.href.split(/[?#]/)[0] === GAME_URL; } catch { return false; } };

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
  wc.on('will-navigate', (e, url) => { if (!isGame(url)) e.preventDefault(); });
  wc.on('will-redirect', (e, url) => { if (!isGame(url)) e.preventDefault(); });
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

  if (smoke) { win.show(); runSmoke(win, { toggleFull }); } else { win.maximize(); win.show(); }
  win.loadFile(GAME).catch((err) => { if (!smoke) console.error('the game did not load:', err.message); });
  win.on('closed', () => { win = null; });
}

// ---------- the check ----------
function runSmoke(w, { toggleFull }) {
  const wc = w.webContents, t0 = Date.now();
  const LIMIT = (Number(process.env.NEHORAI_SMOKE_SECONDS) || 240) * 1000; // everything, start to finish
  const report = {
    ok: false, failure: null, electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform, arch: process.arch,
    game: GAME, userData: app.getPath('userData'), title: null, windowTitle: null, webgl2: null, renderer: null, assets: null,
    nodeInPage: null, started: null, running: null, state: null, navigationBlocked: null, popupBlocked: null, fullScreenKey: null,
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
  wc.on('console-message', (e, level, message) => {
    const lvl = typeof e.level === 'string' ? e.level : ['debug', 'info', 'warning', 'error'][level];
    if (lvl === 'error') report.errors.push(String(e.message ?? message));
  });
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
          assets: !!window.__hfAssets, nodeInPage: typeof require !== 'undefined' || typeof process !== 'undefined' || typeof module !== 'undefined',
        };
      })()`));
      report.windowTitle = w.getTitle();
      if (!report.webgl2) return finish('WebGL2 is not available');

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
      // F11, sent as a key press (noted only: a bare test display has no window manager to grant full screen)
      const before = w.isFullScreen();
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'F11' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F11' });
      await sleep(800);
      report.fullScreenKey = { before, after: w.isFullScreen() };
      if (w.isFullScreen()) { toggleFull(); await sleep(300); }

      if (report.nodeInPage) return finish('the page can reach Node');
      if (!report.popupBlocked || !report.navigationBlocked) return finish('the page could leave the game');
      clearTimeout(watchdog);
      finish(null);
    } catch (err) { finish(`the check itself failed: ${err && err.message}`); }
  });
}
