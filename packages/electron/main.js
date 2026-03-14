const { app, BrowserWindow, ipcMain, dialog, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_VERSION = require('./package.json').version;
const RELEASES_API_URL = 'https://api.github.com/repositories/1177216392/releases/latest';

let mainWindow;
let vault;

// Whitelist of vault mutation methods callable via vault:call
const VAULT_MUTATIONS = new Set([
  'addService', 'deleteService', 'renameService', 'renameServiceId', 'setServiceComment',
  'addEnvironment', 'renameEnvironment', 'deleteEnvironment', 'setEnvironmentComment',
  'setSecret', 'setSecretValue', 'setSecretFlag', 'deleteSecret', 'deleteSecretValue', 'moveSecret',
  'setTemplateEntry', 'deleteTemplateEntry', 'clearTemplate', 'replaceTemplate', 'mergeTemplate',
  'setAutolockMinutes',
  'setReadOnly',
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: "Victory's Secrets",
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window:blur');
  });
  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window:focus');
  });
}

function setupIPC() {
  // --- Dialogs ---

  ipcMain.handle('dialog:create-vault', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Create a vault',
      defaultPath: 'secrets.vsv',
      filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
    });
    return canceled || !filePath ? null : filePath;
  });

  ipcMain.handle('dialog:open-vault', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a vault',
      filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
      properties: ['openFile'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });

  ipcMain.handle('dialog:import-env', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import a .env file',
      filters: [{ name: 'All files', extensions: ['*'] }],
      properties: ['openFile', 'showHiddenFiles'],
    });
    if (canceled || filePaths.length === 0) return null;
    return fs.readFileSync(filePaths[0], 'utf-8');
  });

  // --- Vault lifecycle ---

  ipcMain.handle('vault:create', async (_event, filePath, password) => {
    await vault.create(filePath, password);
    return { data: vault.getData(), path: vault.getPath() };
  });

  ipcMain.handle('vault:open', async (_event, filePath, password) => {
    await vault.open(filePath, password);
    return { data: vault.getData(), path: vault.getPath() };
  });

  ipcMain.handle('vault:lock', () => {
    vault.lock();
  });

  ipcMain.handle('vault:change-password', async (_event, currentPassword, newPassword) => {
    await vault.changePassword(currentPassword, newPassword);
  });

  ipcMain.handle('vault:get-data', () => vault.isUnlocked() ? vault.getData() : null);
  ipcMain.handle('vault:is-unlocked', () => vault.isUnlocked());
  ipcMain.handle('vault:get-path', () => vault.getPath());
  ipcMain.handle('vault:is-read-only', () => vault.isReadOnly());

  // --- Generic vault mutation dispatcher ---

  ipcMain.handle('vault:call', async (_event, method, args) => {
    if (!VAULT_MUTATIONS.has(method)) throw new Error(`Unknown vault method: ${method}`);
    const fn = vault[method];
    if (typeof fn !== 'function') throw new Error(`Vault method not found: ${method}`);
    await fn.call(vault, ...args);
    return vault.getData();
  });

  // --- App ---

  ipcMain.handle('app:check-update', async () => {
    try {
      const response = await net.fetch(RELEASES_API_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const remoteVersion = data.tag_name.replace(/^v/, '');
      const local = APP_VERSION.replace(/^v/, '').split('.').map(Number);
      const remote = remoteVersion.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((remote[i] || 0) > (local[i] || 0)) return { version: remoteVersion, url: data.html_url };
        if ((remote[i] || 0) < (local[i] || 0)) return null;
      }
      return null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('app:open-external', async (_event, url) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) return false;
    await shell.openExternal(url);
    return true;
  });
}

app.whenReady().then(async () => {
  const vsv = await import('vsv');
  vault = vsv.vault;
  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
