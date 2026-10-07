// Desktop wrapper: opens the single-file game in its own window (no browser).
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    backgroundColor: '#000000',
    title: 'הסנוקר של גפן',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  // F11 = full screen, Ctrl+R = reload
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.control && input.key.toLowerCase() === 'r') win.reload();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
