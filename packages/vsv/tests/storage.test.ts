import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { readVaultFile, writeVaultFile, validateVaultPath, isRemoteUrl } from '../src/storage';

const TMP = '/tmp/test-vsv-storage';

function cleanup(...files: string[]) {
  for (const f of files) {
    if (existsSync(f)) unlinkSync(f);
  }
}

describe('storage (Node.js pure)', () => {
  describe('isRemoteUrl', () => {
    it('returns true for https URLs', () => {
      expect(isRemoteUrl('https://example.com/vault.vsv')).toBe(true);
      expect(isRemoteUrl('https://127.0.0.1:8080/path/vault.vsv')).toBe(true);
    });

    it('returns false for local paths', () => {
      expect(isRemoteUrl('/tmp/vault.vsv')).toBe(false);
      expect(isRemoteUrl('./vault.vsv')).toBe(false);
      expect(isRemoteUrl('vault.vsv')).toBe(false);
    });

    it('returns false for http (non-TLS)', () => {
      expect(isRemoteUrl('http://example.com/vault.vsv')).toBe(false);
    });

    it('returns false for ftp or other protocols', () => {
      expect(isRemoteUrl('ftp://example.com/vault.vsv')).toBe(false);
    });
  });

  describe('validateVaultPath', () => {
    it('accepts valid .vsv paths', () => {
      expect(validateVaultPath('/tmp/secrets.vsv')).toBe(true);
    });

    it('rejects non-.vsv extensions', () => {
      expect(validateVaultPath('/tmp/secrets.json')).toBe(false);
      expect(validateVaultPath('/tmp/secrets')).toBe(false);
    });

    it('rejects empty or non-string input', () => {
      expect(validateVaultPath('')).toBe(false);
      expect(validateVaultPath(null as any)).toBe(false);
    });

    it('accepts remote https URLs with .vsv extension', () => {
      expect(validateVaultPath('https://cdn.example.com/vault.vsv')).toBe(true);
    });

    it('rejects remote URLs without .vsv extension', () => {
      expect(validateVaultPath('https://cdn.example.com/vault.json')).toBe(false);
    });

    it('rejects relative paths that differ from their resolved form', () => {
      // Relative paths resolve differently from their literal form
      expect(validateVaultPath('../../../etc/passwd.vsv')).toBe(false);
      // But absolute paths with .. normalize cleanly (resolve === normalize)
      expect(validateVaultPath('/tmp/../etc/secrets.vsv')).toBe(true);
    });

    it('accepts case-insensitive .VSV extension', () => {
      expect(validateVaultPath('/tmp/vault.VSV')).toBe(true);
      expect(validateVaultPath('/tmp/vault.Vsv')).toBe(true);
    });
  });

  describe('readVaultFile', () => {
    const path = `${TMP}-read.vsv`;

    afterEach(() => cleanup(path));

    it('reads a vault file as ArrayBuffer', () => {
      const content = Buffer.from([1, 2, 3, 4, 5]);
      writeFileSync(path, content);
      const result = readVaultFile(path);
      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('throws on non-existent file', () => {
      expect(() => readVaultFile('/tmp/nonexistent.vsv')).toThrow('not found');
    });

    it('reads empty file', () => {
      writeFileSync(path, Buffer.alloc(0));
      const result = readVaultFile(path);
      expect(new Uint8Array(result).length).toBe(0);
    });

    it('reads binary data correctly', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) bytes[i] = i;
      writeFileSync(path, Buffer.from(bytes));
      const result = readVaultFile(path);
      expect(new Uint8Array(result)).toEqual(bytes);
    });
  });

  describe('writeVaultFile', () => {
    const path = `${TMP}-write.vsv`;
    const bakPath = `${path}.bak`;
    const tmpPath = `${path}.tmp`;

    afterEach(() => cleanup(path, bakPath, tmpPath));

    it('writes data to file', () => {
      const data = new Uint8Array([10, 20, 30]);
      writeVaultFile(path, data);
      const result = readVaultFile(path);
      expect(new Uint8Array(result)).toEqual(data);
    });

    it('creates backup before overwriting', () => {
      const original = new Uint8Array([1, 2, 3]);
      const updated = new Uint8Array([4, 5, 6]);
      writeVaultFile(path, original);
      writeVaultFile(path, updated);
      // Backup should be cleaned up after successful write
      expect(existsSync(bakPath)).toBe(false);
      expect(new Uint8Array(readVaultFile(path))).toEqual(updated);
    });

    it('creates new file if it does not exist', () => {
      cleanup(path);
      const data = new Uint8Array([7, 8, 9]);
      writeVaultFile(path, data);
      expect(existsSync(path)).toBe(true);
    });

    it('write and read round-trips binary data', () => {
      const data = new Uint8Array(1024);
      for (let i = 0; i < data.length; i++) data[i] = i % 256;
      writeVaultFile(path, data);
      const result = new Uint8Array(readVaultFile(path));
      expect(result).toEqual(data);
    });

    it('no temp file remains after successful write', () => {
      const data = new Uint8Array([1, 2, 3]);
      writeVaultFile(path, data);
      expect(existsSync(tmpPath)).toBe(false);
      expect(existsSync(bakPath)).toBe(false);
    });

    it('no temp file remains after overwrite', () => {
      writeVaultFile(path, new Uint8Array([1]));
      writeVaultFile(path, new Uint8Array([2]));
      expect(existsSync(tmpPath)).toBe(false);
      expect(existsSync(bakPath)).toBe(false);
    });
  });
});
