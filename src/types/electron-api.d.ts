interface ElectronAPI {
  argon2id(password: string, salt: Uint8Array): Promise<number[]>;
  createFile(): Promise<string | null>;
  openFile(): Promise<{ filePath: string; buffer: ArrayBuffer } | null>;
  openFilePath(filePath: string): Promise<{ filePath: string; buffer: ArrayBuffer } | null>;
  saveFile(filePath: string, data: Uint8Array): Promise<void>;
  importEnv(): Promise<string | null>;
  openExternal(url: string): void;
  checkUpdate(): Promise<{ version: string; url: string } | null>;
  onWindowBlur(callback: () => void): void;
  onWindowFocus(callback: () => void): void;
}

interface Window {
  electronAPI?: ElectronAPI;
  showSaveFilePicker(opts?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  showOpenFilePicker(opts?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface OpenFilePickerOptions {
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}
