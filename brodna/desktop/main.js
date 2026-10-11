// The PC version of Operation Brodna: one game window around the same game the browser runs.
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const SELFTEST = process.env.BRODNA_SELFTEST; // path of a PNG to write, for automated checks

app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (SELFTEST) app.commandLine.appendSwitch('enable-unsafe-swiftshader');
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    show: false,
    backgroundColor: '#07090f',
    title: 'מבצע ברודנה',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.once('ready-to-show', () => {
    if (!SELFTEST) win.maximize();
    win.show();
  });

  // F11 or Alt+Enter: fullscreen, like most PC games
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  // the game never navigates away; outside links open in the player's browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  if (SELFTEST) selfTest(win);
}

// Boot the game, open the first chapter, save a screenshot and the console, then quit.
function selfTest(win) {
  const log = [];
  win.webContents.on('console-message', (...args) => {
    const e = args[0] && typeof args[0] === 'object' && 'message' in args[0] ? args[0] : { level: args[1], message: args[2] };
    log.push(`[${e.level}] ${e.message}`);
  });
  win.webContents.on('did-finish-load', async () => {
    const run = (js) => win.webContents.executeJavaScript(js, true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await wait(8000);
      const boot = await run(`JSON.stringify({ menu: !document.getElementById('menu').hidden, faces: Object.keys(window.__brodna.assets.faces).length, quality: document.getElementById('qualityBtn').textContent, desktop: document.body.classList.contains('desktop-app') })`);
      log.push('boot ' + boot);
      fs.writeFileSync(SELFTEST.replace(/\.png$/, '-menu.png'), (await win.webContents.capturePage()).toPNG());
      await run(`document.getElementById('playBtn').click(); setInterval(() => { const g = window.__brodna; if (g.ui.dlg) g.ui._advance = true; }, 500); 1`);
      for (let i = 0; i < 90; i++) {
        await wait(1000);
        if (await run(`window.__brodna.story.mode === 'walk'`)) break;
      }
      await wait(4000);
      log.push('play ' + (await run(`JSON.stringify({ mode: window.__brodna.story.mode, objective: document.getElementById('objText').textContent })`)));
      fs.writeFileSync(SELFTEST, (await win.webContents.capturePage()).toPNG());
    } catch (err) {
      log.push('selftest error ' + (err && err.stack));
    }
    fs.writeFileSync(SELFTEST.replace(/\.png$/, '.log'), log.join('\n'));
    app.quit();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
