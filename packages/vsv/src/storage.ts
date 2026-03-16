// storage.ts — File I/O for Node.js (direct fs access)

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync, lstatSync, renameSync, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { extname, resolve, normalize } from 'node:path';

const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 30_000;
const VAULT_EXTENSION = '.vsv';

export function isRemoteUrl(filePath: string): boolean {
  try {
    const url = new URL(filePath);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateVaultPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  if (isRemoteUrl(filePath)) return filePath.endsWith(VAULT_EXTENSION);
  if (extname(filePath).toLowerCase() !== VAULT_EXTENSION) return false;
  // Reject relative path traversal: relative paths with '..' are unsafe
  const normalized = normalize(filePath);
  if (normalized.startsWith('..')) return false;
  return true;
}

export async function fetchVaultFile(url: string): Promise<ArrayBuffer> {
  // Validate URL
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are supported');

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Failed to fetch vault: ${res.status} ${res.statusText}`);

  // Check Content-Length header before buffering (defense-in-depth)
  const contentLength = res.headers.get('content-length');
  const clSize = contentLength ? parseInt(contentLength, 10) : NaN;
  if (!Number.isNaN(clSize) && clSize > MAX_VAULT_SIZE) {
    throw new Error(`Remote vault too large (Content-Length ${contentLength} > ${MAX_VAULT_SIZE} limit)`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_VAULT_SIZE) {
    throw new Error(`Remote vault too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB > ${MAX_VAULT_SIZE / 1024 / 1024}MB limit)`);
  }
  return buffer;
}

export function readVaultFile(filePath: string): ArrayBuffer {
  if (!validateVaultPath(filePath)) throw new Error(`Invalid vault path: ${filePath}`);
  if (!existsSync(filePath)) throw new Error(`Vault file not found: ${filePath}`);
  // Use fd-based read to avoid TOCTOU between stat and read
  const fd = openSync(filePath, 'r');
  try {
    const stat = fstatSync(fd);
    if (stat.size > MAX_VAULT_SIZE) {
      throw new Error(`Vault file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_VAULT_SIZE / 1024 / 1024}MB limit)`);
    }
    const buf = Buffer.alloc(stat.size);
    readSync(fd, buf, 0, stat.size, 0);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } finally {
    closeSync(fd);
  }
}

/** Check that a path is not a symlink (prevent symlink attacks on tmp/bak files) */
function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function writeVaultFile(filePath: string, data: Uint8Array): void {
  if (!validateVaultPath(filePath)) throw new Error(`Invalid vault path: ${filePath}`);
  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';

  // Prevent symlink attacks on tmp and bak paths
  if (isSymlink(tmpPath)) throw new Error('Refusing to write: tmp path is a symlink');
  if (isSymlink(bakPath)) throw new Error('Refusing to write: backup path is a symlink');

  // Write encrypted data to temp file, then atomic rename
  try {
    writeFileSync(tmpPath, Buffer.from(data), { mode: 0o600 });
  } catch (e) {
    // Cleanup partial temp file
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    throw e;
  }

  // Backup current vault before replacing
  if (existsSync(filePath)) {
    copyFileSync(filePath, bakPath);
  }

  try {
    renameSync(tmpPath, filePath);
    // Rename succeeded — remove backup
    if (existsSync(bakPath)) unlinkSync(bakPath);
  } catch (e) {
    // Rename failed — try to restore from backup
    try {
      if (existsSync(bakPath)) {
        copyFileSync(bakPath, filePath);
        unlinkSync(bakPath);
      }
    } catch {
      // Recovery failed — leave .bak intact so the user can recover manually
    }
    // Cleanup temp file
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch { /* best effort */ }
    throw e;
  }
}
