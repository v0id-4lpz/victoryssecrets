const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createFile: () => ipcRenderer.invoke('file:create'),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath, data) => ipcRenderer.invoke('file:save', { filePath, data }),
  openFilePath: (filePath) => ipcRenderer.invoke('file:open-path', filePath),
  importEnv: () => ipcRenderer.invoke('file:import-env'),
  argon2id: (password, salt) => ipcRenderer.invoke('crypto:argon2id', { password, salt: Array.from(salt) }),
  onWindowBlur: (callback) => ipcRenderer.on('window:blur', callback),
  onWindowFocus: (callback) => ipcRenderer.on('window:focus', callback),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
});
