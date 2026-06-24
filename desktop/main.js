/* =============================================================================
   SKYLEDGER DESKTOP SHELL (Electron)
   -----------------------------------------------------------------------------
   Runs the Skyledger web app in a window that has local-socket access, so the
   page's built-in SimConnect client (SkySimConnect) can talk to MSFS directly
   over its named pipe / IPv4 port. No companion bridge process is required.

   How it works:
   - nodeIntegration + contextIsolation:false expose Node's `net` module to the
     page, which is exactly what SkySimConnect.getNet() looks for.
   - By default it loads the live GitHub Pages build (always up to date). Point it
     somewhere else with the SKYLEDGER_URL env var, e.g. a local file for testing:
       Windows:  set SKYLEDGER_URL=file:///C:/path/to/index.html && npm start
       macOS/Linux: SKYLEDGER_URL=file:///path/to/index.html npm start

   Usage:
     1. Install Node.js 18+ from https://nodejs.org
     2. In this `desktop/` folder:  npm install   (downloads Electron)
     3. Start MSFS and load a flight.
     4. Run:  npm start
     5. In the app: Active Trip (or Type Ratings) -> Sim Link ->
        "Built-in SimConnect" -> Connect to MSFS.

   Security note: nodeIntegration is enabled, so only load a site you trust
   (your own Skyledger build). That's the trade-off for giving the page the
   raw socket it needs to reach SimConnect.
   ============================================================================= */
const { app, BrowserWindow, shell } = require('electron');

const SITE_URL = process.env.SKYLEDGER_URL || 'https://djbrombizzle.github.io/skyledger/';

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
      backgroundThrottling: false // keep telemetry flowing when the window isn't focused
    }
  });

  win.setMenuBarVisibility(false);
  win.loadURL(SITE_URL);

  // Open external links (SimBrief, VATSIM, etc.) in the system browser instead of a Node-enabled window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
