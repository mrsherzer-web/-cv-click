// Desktop (Windows) shell for "אל תעירו את נועם".
// Opens the game in a single locked-down window: fullscreen by default,
// F11 / Alt+Enter toggles fullscreen, no browser menus, zoom or reload.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const TITLE = 'אל תעירו את נועם';

app.setAppUserModelId('il.dimona.commune.dontwakenoam');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// run even on machines whose GPU driver Chromium blocklists; fall back to software WebGL as a last resort
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
Menu.setApplicationMenu(null);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const prefsFile = () => path.join(app.getPath('userData'), 'window.json');
function loadPrefs() {
  try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch (e) { return { fullscreen: true }; }
}
function savePrefs(p) {
  try { fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch (e) { /* read-only profile: ignore */ }
}

let win = null;
const prefs = loadPrefs();

function setFullscreen(on) {
  if (!win) return;
  win.setFullScreen(on);
  prefs.fullscreen = on;
  savePrefs(prefs);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    title: TITLE,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.ico'),
    fullscreen: prefs.fullscreen !== false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));

  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setVisualZoomLevelLimits(1, 1);
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key;
    if (k === 'F11' || (input.alt && k === 'Enter')) { setFullscreen(!win.isFullScreen()); e.preventDefault(); return; }
    // no zoom / reload / print / find shortcuts inside the game
    if ((input.control || input.meta) && ['r', 'R', '=', '+', '-', '0', 'p', 'P', 'f', 'F'].includes(k)) e.preventDefault();
    if (k === 'F5') e.preventDefault();
  });
  wc.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') { try { wc.reload(); } catch (err) { /* window closing */ } }
  });

  win.loadFile(path.join(__dirname, 'game', 'index.html'));
}

ipcMain.on('app-info', (e) => { e.returnValue = { version: app.getVersion(), platform: process.platform }; });
ipcMain.handle('get-fullscreen', () => (win ? win.isFullScreen() : false));
ipcMain.handle('set-fullscreen', (_e, on) => { setFullscreen(!!on); return !!on; });
ipcMain.on('quit', () => app.quit());

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
