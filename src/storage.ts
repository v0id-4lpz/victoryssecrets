// storage.ts — File I/O (Electron native or browser File System Access API fallback)

const isElectron = typeof window.electronAPI !== 'undefined';

let currentFilePath: string | null = null;
let fileHandle: FileSystemFileHandle | null = null;

export function hasFile(): boolean {
  return isElectron ? currentFilePath !== null : fileHandle !== null;
}

export async function createFile(): Promise<string | FileSystemFileHandle> {
  if (isElectron) {
    const filePath = await window.electronAPI!.createFile();
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

export async function openFile(): Promise<ArrayBuffer> {
  if (isElectron) {
    const result = await window.electronAPI!.openFile();
    if (!result) throw new DOMException('User cancelled', 'AbortError');
    currentFilePath = result.filePath;
    return result.buffer;
  } else {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Victory's Secrets Vault", accept: { 'application/octet-stream': ['.vsv'] } }],
    });
    fileHandle = handle!;
    const file = await handle!.getFile();
    return file.arrayBuffer();
  }
}

export function getFilePath(): string | null {
  return currentFilePath;
}

export async function openFilePath(filePath: string): Promise<ArrayBuffer> {
  if (!isElectron) throw new Error('Not supported in browser');
  const result = await window.electronAPI!.openFilePath(filePath);
  if (!result) throw new Error('File not found');
  currentFilePath = result.filePath;
  return result.buffer;
}

export async function importEnvFile(): Promise<string | null> {
  if (isElectron) {
    return window.electronAPI!.importEnv();
  } else {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: '.env files', accept: { 'text/plain': ['.env'] } }],
    });
    const file = await handle!.getFile();
    return file.text();
  }
}

export async function saveFile(data: Uint8Array): Promise<void> {
  if (isElectron) {
    if (!currentFilePath) throw new Error('No file path');
    await window.electronAPI!.saveFile(currentFilePath, data);
  } else {
    if (!fileHandle) throw new Error('No file handle');
    const writable = await fileHandle.createWritable();
    await writable.write(data as unknown as BufferSource);
    await writable.close();
  }
}
