const { app, BrowserWindow, ipcMain, dialog, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10 MB
const APP_VERSION = require('./package.json').version;
const VERSION_GIST_URL = 'https://gist.githubusercontent.com/v0id-4lpz/d3714c345c34713e084fde36be1ad2ab/raw/vs-version';
const RELEASES_URL = 'https://github.com/v0id-4lpz/victoryssecrets/releases';
const VAULT_EXTENSION = '.vsv';

let mainWindow;

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

  // Notify renderer of window blur/focus for privacy overlay
  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window:blur');
  });
  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window:focus');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- Helpers ---

function validateVaultPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  if (path.extname(filePath).toLowerCase() !== VAULT_EXTENSION) return false;
  // Block path traversal
  const resolved = path.resolve(filePath);
  if (resolved !== filePath && resolved !== path.normalize(filePath)) return false;
  return true;
}

function readVaultFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_VAULT_SIZE) throw new Error(`Vault file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_VAULT_SIZE / 1024 / 1024}MB limit)`);
  const data = fs.readFileSync(filePath);
  return { filePath, buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
}

// --- IPC: File operations ---

ipcMain.handle('file:create', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Create a vault',
      defaultPath: 'secrets.vsv',
      filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
    });
    if (canceled || !filePath) return null;
    return filePath;
  } catch (e) {
    throw new Error(`Failed to create vault: ${e.message}`);
  }
});

ipcMain.handle('file:open', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a vault',
      filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    return readVaultFile(filePaths[0]);
  } catch (e) {
    throw new Error(`Failed to open vault: ${e.message}`);
  }
});

ipcMain.handle('file:save', async (_event, { filePath, data }) => {
  try {
    if (!validateVaultPath(filePath)) throw new Error('Invalid vault path');
    const bakPath = filePath + '.bak';
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, bakPath);
    }
    try {
      fs.writeFileSync(filePath, Buffer.from(data));
      if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
      return true;
    } catch (e) {
      if (fs.existsSync(bakPath)) {
        fs.copyFileSync(bakPath, filePath);
        fs.unlinkSync(bakPath);
      }
      throw e;
    }
  } catch (e) {
    throw new Error(`Failed to save vault: ${e.message}`);
  }
});

ipcMain.handle('file:open-path', async (_event, filePath) => {
  try {
    if (!validateVaultPath(filePath)) throw new Error('Invalid vault path');
    return readVaultFile(filePath);
  } catch (e) {
    throw new Error(`Failed to open vault: ${e.message}`);
  }
});

ipcMain.handle('crypto:argon2id', async (_event, { password, salt }) => {
  try {
    const { argon2id } = require('hash-wasm');
    const hash = await argon2id({
      password,
      salt: new Uint8Array(salt),
      parallelism: 4,
      iterations: 3,
      memorySize: 262144, // 256 MB
      hashLength: 32,
      outputType: 'binary',
    });
    return Array.from(hash);
  } catch (e) {
    throw new Error(`Key derivation failed: ${e.message}`);
  }
});

ipcMain.handle('file:import-env', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import a .env file',
      filters: [{ name: 'All files', extensions: ['*'] }],
      properties: ['openFile', 'showHiddenFiles'],
    });
    if (canceled || filePaths.length === 0) return null;
    return fs.readFileSync(filePaths[0], 'utf-8');
  } catch (e) {
    throw new Error(`Failed to import env file: ${e.message}`);
  }
});

// --- IPC: Update check ---

ipcMain.handle('app:check-update', async () => {
  try {
    const response = await net.fetch(VERSION_GIST_URL);
    if (!response.ok) return null;
    const remoteVersion = (await response.text()).trim();
    const local = APP_VERSION.replace(/^v/, '').split('.').map(Number);
    const remote = remoteVersion.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((remote[i] || 0) > (local[i] || 0)) return { version: remoteVersion, url: `${RELEASES_URL}/tag/v${remoteVersion}` };
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
