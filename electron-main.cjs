// Electron Desktop Main Process for ai petros (Petros Cinema / Aipetros-stream)
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#060810',
    title: 'ai petros — Petros Cinema (Aipetros-stream)',
    icon: path.join(__dirname, 'public', 'icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Load production build or dev server
  const distPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(distPath).catch(() => {
    mainWindow.loadURL('http://localhost:5173');
  });

  // Enable hardware acceleration
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');

  // Remove default menu for clean cinematic experience
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
