import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { readVaultFile, writeVaultFile, validateVaultPath } from '../src/storage';

const TMP = '/tmp/test-vsv-storage';

function cleanup(...files: string[]) {
  for (const f of files) {
    if (existsSync(f)) unlinkSync(f);
  }
}

describe('storage (Node.js pure)', () => {
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
  });

  describe('writeVaultFile', () => {
    const path = `${TMP}-write.vsv`;
    const bakPath = `${path}.bak`;

    afterEach(() => cleanup(path, bakPath));

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
  });
});
