// storage.js — File I/O (Electron native or browser File System Access API fallback)

const isElectron = typeof window.electronAPI !== 'undefined';

let currentFilePath = null; // Electron: file path string
let fileHandle = null;      // Browser: FileSystemFileHandle

export function hasFile() {
  return isElectron ? currentFilePath !== null : fileHandle !== null;
}

export async function createFile() {
  if (isElectron) {
    const filePath = await window.electronAPI.createFile();
    if (!filePath) throw new DOMException('User cancelled', 'AbortError');
    currentFilePath = filePath;
    return filePath;
  } else {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'secrets.vsv',
      types: [{ description: "Victory's Secrets Vault", accept: { 'application/octet-stream': ['.vsv'] } }],
    });
    fileHandle = handle;
    return handle;
  }
}

export async function openFile() {
  if (isElectron) {
    const result = await window.electronAPI.openFile();
    if (!result) throw new DOMException('User cancelled', 'AbortError');
    currentFilePath = result.filePath;
    return result.buffer;
  } else {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Victory's Secrets Vault", accept: { 'application/octet-stream': ['.vsv'] } }],
    });
    fileHandle = handle;
    const file = await handle.getFile();
    return file.arrayBuffer();
  }
}

export async function saveFile(data) {
  if (isElectron) {
    if (!currentFilePath) throw new Error('No file path');
    await window.electronAPI.saveFile(currentFilePath, data);
  } else {
    if (!fileHandle) throw new Error('No file handle');
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}
