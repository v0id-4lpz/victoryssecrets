// storage.ts — File I/O for Node.js (direct fs access)

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { extname, resolve, normalize } from 'node:path';

const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10 MB
const VAULT_EXTENSION = '.vsv';

export function isRemoteUrl(filePath: string): boolean {
  return filePath.startsWith('http://') || filePath.startsWith('https://');
}

export function validateVaultPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  if (isRemoteUrl(filePath)) return filePath.endsWith(VAULT_EXTENSION);
  if (extname(filePath).toLowerCase() !== VAULT_EXTENSION) return false;
  const resolved = resolve(filePath);
  if (resolved !== filePath && resolved !== normalize(filePath)) return false;
  return true;
}

export async function fetchVaultFile(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch vault: ${res.status} ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_VAULT_SIZE) {
    throw new Error(`Remote vault too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB > ${MAX_VAULT_SIZE / 1024 / 1024}MB limit)`);
  }
  return buffer;
}

export function readVaultFile(filePath: string): ArrayBuffer {
  if (!existsSync(filePath)) throw new Error(`Vault file not found: ${filePath}`);
  const stat = statSync(filePath);
  if (stat.size > MAX_VAULT_SIZE) {
    throw new Error(`Vault file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_VAULT_SIZE / 1024 / 1024}MB limit)`);
  }
  const data = readFileSync(filePath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

export function writeVaultFile(filePath: string, data: Uint8Array): void {
  const bakPath = filePath + '.bak';
  if (existsSync(filePath)) {
    copyFileSync(filePath, bakPath);
  }
  try {
    writeFileSync(filePath, Buffer.from(data));
    if (existsSync(bakPath)) unlinkSync(bakPath);
  } catch (e) {
    if (existsSync(bakPath)) {
      copyFileSync(bakPath, filePath);
      unlinkSync(bakPath);
    }
    throw e;
  }
}
