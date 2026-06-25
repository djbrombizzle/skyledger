/* =============================================================================
   SKYLEDGER DESKTOP (Electron)
   -----------------------------------------------------------------------------
   Bundles index.html and exposes Node's `net` module so SkySimConnect can talk
   to MSFS over its named pipe / IPv4 port — no bridge or in-game panel needed.

   Dev:  cd desktop && npm install && npm start
   Ship: cd desktop && npm run dist
         → dist/Skyledger-<version>-portable.exe (Windows, single file)

   Override the loaded page with SKYLEDGER_URL (file:// or https://).
   ============================================================================= */
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, shell } = require('electron');

const isDev = !app.isPackaged;

function bundledIndexUrl() {
  const html = isDev
    ? path.join(__dirname, '..', 'index.html')
    : path.join(process.resourcesPath, 'app', 'index.html');
  return pathToFileURL(html).href;
}

const SITE_URL = process.env.SKYLEDGER_URL || bundledIndexUrl();

function isExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0E141C',
    title: 'Skyledger',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadURL(SITE_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (ev, url) => {
    if (isExternal(url)) {
      ev.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
