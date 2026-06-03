const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleMiniPlayer: (isMini) => ipcRenderer.send('toggle-mini-player', isMini)
});
