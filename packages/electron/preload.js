const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  createVaultDialog: () => ipcRenderer.invoke('dialog:create-vault'),
  openVaultDialog: () => ipcRenderer.invoke('dialog:open-vault'),
  importEnv: () => ipcRenderer.invoke('dialog:import-env'),

  // Vault lifecycle
  vaultCreate: (filePath, password) => ipcRenderer.invoke('vault:create', filePath, password),
  vaultOpen: (filePath, password) => ipcRenderer.invoke('vault:open', filePath, password),
  vaultLock: () => ipcRenderer.invoke('vault:lock'),
  vaultChangePassword: (current, newPw) => ipcRenderer.invoke('vault:change-password', current, newPw),
  vaultGetData: () => ipcRenderer.invoke('vault:get-data'),
  vaultIsUnlocked: () => ipcRenderer.invoke('vault:is-unlocked'),
  vaultGetPath: () => ipcRenderer.invoke('vault:get-path'),
  vaultIsReadOnly: () => ipcRenderer.invoke('vault:is-read-only'),

  // Generic vault mutation (method name + args array)
  vaultCall: (method, args) => ipcRenderer.invoke('vault:call', method, args),

  // Window events
  onWindowBlur: (callback) => ipcRenderer.on('window:blur', callback),
  onWindowFocus: (callback) => ipcRenderer.on('window:focus', callback),

  // App
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
});
