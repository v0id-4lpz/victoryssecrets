import type { VaultData } from 'vsv/types/vault';

interface VaultResult {
  data: VaultData;
  path: string;
}

interface ElectronAPI {
  // Dialogs
  createVaultDialog(): Promise<string | null>;
  openVaultDialog(): Promise<string | null>;
  importEnv(): Promise<string | null>;

  // Vault lifecycle
  vaultCreate(filePath: string, password: string): Promise<VaultResult>;
  vaultOpen(filePath: string, password: string): Promise<VaultResult>;
  vaultLock(): Promise<void>;
  vaultChangePassword(currentPassword: string, newPassword: string): Promise<void>;
  vaultGetData(): Promise<VaultData | null>;
  vaultIsUnlocked(): Promise<boolean>;
  vaultGetPath(): Promise<string | null>;

  // Generic vault mutation
  vaultCall(method: string, args: unknown[]): Promise<VaultData>;

  // Window events
  onWindowBlur(callback: () => void): void;
  onWindowFocus(callback: () => void): void;

  // App
  checkUpdate(): Promise<{ version: string; url: string } | null>;
  openExternal(url: string): void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
