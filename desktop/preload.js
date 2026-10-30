// Minimal, safe bridge between the game page and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('app-info');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  version: info.version,
  platform: info.platform,
  quit: () => ipcRenderer.send('quit'),
  isFullscreen: () => ipcRenderer.invoke('get-fullscreen'),
  setFullscreen: (on) => ipcRenderer.invoke('set-fullscreen', !!on),
  onFullscreen: (cb) => { ipcRenderer.on('fullscreen', (_e, on) => cb(!!on)); },
});
