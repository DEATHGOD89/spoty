const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Spoty',
    icon: path.join(__dirname, 'public/logo512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
  });

  // Load the built dist/index.html
  win.loadFile(path.join(__dirname, 'dist/index.html'));

  // Remove default menu bar for a clean, premium desktop app appearance
  win.setMenuBarVisibility(false);
}

// Handle IPC messages for compact Mini-Player window resizing & positioning
ipcMain.on('toggle-mini-player', (event, isMini) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (isMini) {
    win.setSize(340, 390); // Perfect size to fit the vertical mini-card and window decorations
    win.setAlwaysOnTop(true);
    win.setResizable(false);
    win.setMaximizable(false);
  } else {
    win.setAlwaysOnTop(false);
    win.setResizable(true);
    win.setMaximizable(true);
    win.setSize(1280, 720);
    win.center();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
