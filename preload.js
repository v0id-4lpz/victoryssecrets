const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createFile: () => ipcRenderer.invoke('file:create'),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath, data) => ipcRenderer.invoke('file:save', { filePath, data }),
});
