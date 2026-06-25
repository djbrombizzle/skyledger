/* =============================================================================
   SKYLEDGER DESKTOP (Electron)
   -----------------------------------------------------------------------------
   Hybrid update model:
   - Game UI loads from GitHub Pages (auto-updates on every launch)
   - Bundled index.html is the offline fallback
   - Shell auto-updates via electron-updater + GitHub Releases (NSIS installer)

   Dev:  cd desktop && npm install && npm start
   Ship: cd desktop && npm run dist:publish
         → dist/Skyledger-Setup-<version>.exe

   Override page URL: SKYLEDGER_URL=file://... or https://...
   ============================================================================= */
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const LIVE_URL = 'https://djbrombizzle.github.io/skyledger/';
const isDev = !app.isPackaged;
let mainWindow = null;

function bundledIndexUrl() {
  const html = isDev
    ? path.join(__dirname, '..', 'index.html')
    : path.join(process.resourcesPath, 'app', 'index.html');
  return pathToFileURL(html).href;
}

async function resolveStartUrl() {
  if (process.env.SKYLEDGER_URL) return process.env.SKYLEDGER_URL;
  if (isDev) return bundledIndexUrl();
  try {
    const res = await fetch(LIVE_URL, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    if (res.ok) return LIVE_URL;
  } catch (e) { /* offline — use bundle */ }
  return bundledIndexUrl();
}

function isExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sky-update-status', payload);
  }
}

function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ state: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ state: 'current' });
  });
  autoUpdater.on('download-progress', (p) => {
    sendUpdateStatus({ state: 'downloading', percent: Math.round(p.percent || 0) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'ready', version: info.version });
  });
  autoUpdater.on('error', (err) => {
    sendUpdateStatus({ state: 'error', message: (err && err.message) || 'Update check failed' });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

function setupIpc() {
  ipcMain.handle('sky-desktop-version', () => app.getVersion());
  ipcMain.handle('sky-check-updates', async () => {
    if (isDev) return { state: 'dev' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { state: 'checking', version: result && result.updateInfo && result.updateInfo.version };
    } catch (e) {
      return { state: 'error', message: (e && e.message) || 'Update check failed' };
    }
  });
  ipcMain.handle('sky-quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (ev, url) => {
    if (isExternal(url)) {
      ev.preventDefault();
      shell.openExternal(url);
    }
  });

  const startUrl = await resolveStartUrl();
  await mainWindow.loadURL(startUrl);
}

app.whenReady().then(() => {
  setupIpc();
  setupUpdater();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
