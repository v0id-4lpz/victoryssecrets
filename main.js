const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC: File operations ---

ipcMain.handle('file:create', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Creer un vault',
    defaultPath: 'secrets.vsv',
    filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
  });
  if (canceled || !filePath) return null;
  return filePath;
});

ipcMain.handle('file:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un vault',
    filters: [{ name: "Victory's Secrets Vault", extensions: ['vsv'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const data = fs.readFileSync(filePath);
  return { filePath, buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
});

ipcMain.handle('file:save', async (_event, { filePath, data }) => {
  fs.writeFileSync(filePath, Buffer.from(data));
  return true;
});

ipcMain.handle('file:open-path', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath);
  return { filePath, buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
});

ipcMain.handle('crypto:argon2id', async (_event, { password, salt }) => {
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
});

ipcMain.handle('file:import-env', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un fichier .env',
    filters: [{ name: 'Tous les fichiers', extensions: ['*'] }],
    properties: ['openFile', 'showHiddenFiles'],
  });
  if (canceled || filePaths.length === 0) return null;
  return fs.readFileSync(filePaths[0], 'utf-8');
});
