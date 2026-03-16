import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { deriveKey, encrypt, decrypt, generateSalt } from '../src/crypto';

describe('crypto (Node.js pure)', () => {
  describe('generateSalt', () => {
    it('returns a 16-byte Uint8Array', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('generates unique salts', () => {
      const a = generateSalt();
      const b = generateSalt();
      expect(a).not.toEqual(b);
    });
  });

  describe('deriveKey', () => {
    it('returns a non-extractable CryptoKey', { timeout: 10000 }, async () => {
      const salt = generateSalt();
      const key = await deriveKey('password123', salt);
      expect(key.extractable).toBe(false);
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('same password + salt produces same key behavior', { timeout: 15000 }, async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('test', salt);
      const key2 = await deriveKey('test', salt);
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode('hello');
      const enc = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, data);
      const dec = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, enc);
      expect(new TextDecoder().decode(dec)).toBe('hello');
    });

    it('different passwords produce different keys', { timeout: 15000 }, async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('password1', salt);
      const key2 = await deriveKey('password2', salt);
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode('hello');
      const enc = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, data);
      await expect(webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, enc)).rejects.toThrow();
    });

    it('different salts produce different keys', { timeout: 15000 }, async () => {
      const key1 = await deriveKey('same', generateSalt());
      const key2 = await deriveKey('same', generateSalt());
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode('hello');
      const enc = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, data);
      await expect(webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, enc)).rejects.toThrow();
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips vault data', { timeout: 15000 }, async () => {
      const vaultData = { services: { pg: { label: 'PostgreSQL' } }, version: 2 };
      const salt = generateSalt();
      const key = await deriveKey('mypassword', salt);
      const encrypted = await encrypt(vaultData, key, salt);
      const result = await decrypt(encrypted, 'mypassword');
      expect(result.data).toEqual(vaultData);
    });

    it('returns key and salt on decrypt', { timeout: 15000 }, async () => {
      const salt = generateSalt();
      const key = await deriveKey('pw', salt);
      const encrypted = await encrypt({ test: true }, key, salt);
      const result = await decrypt(encrypted, 'pw');
      expect(result.key.extractable).toBe(false);
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(result.salt.length).toBe(16);
    });

    it('decrypt fails with wrong password', { timeout: 15000 }, async () => {
      const salt = generateSalt();
      const key = await deriveKey('correct', salt);
      const encrypted = await encrypt({ secret: 'data' }, key, salt);
      await expect(decrypt(encrypted, 'wrong')).rejects.toThrow();
    });

    it('each encryption produces different output (random IV)', { timeout: 15000 }, async () => {
      const data = { same: 'data' };
      const salt = generateSalt();
      const key = await deriveKey('pw', salt);
      const enc1 = await encrypt(data, key, salt);
      const enc2 = await encrypt(data, key, salt);
      const iv1 = enc1.slice(16, 28);
      const iv2 = enc2.slice(16, 28);
      expect(iv1).not.toEqual(iv2);
    });

    it('handles complex vault data', { timeout: 15000 }, async () => {
      const vaultData = {
        version: 2,
        services: { pg: { label: 'PostgreSQL', comment: 'Main DB' } },
        environments: { prod: { comment: '' }, dev: { comment: '' } },
        secrets: {
          pg: {
            url: { secret: true, values: { _global: 'postgres://localhost' } },
            password: { secret: true, values: { prod: 'p@$$w0rd!' } },
          },
        },
        templates: { main: { DATABASE_URL: '${pg.url}' } },
      };
      const salt = generateSalt();
      const key = await deriveKey('strongpassword', salt);
      const encrypted = await encrypt(vaultData, key, salt);
      const result = await decrypt(encrypted, 'strongpassword');
      expect(result.data).toEqual(vaultData);
    });

    it('handles unicode content', { timeout: 15000 }, async () => {
      const data = { label: 'Éléphant 🐘 中文' };
      const salt = generateSalt();
      const key = await deriveKey('pw', salt);
      const encrypted = await encrypt(data, key, salt);
      const result = await decrypt(encrypted, 'pw');
      expect(result.data.label).toBe('Éléphant 🐘 中文');
    });

    it('preserved salt matches in output', { timeout: 15000 }, async () => {
      const salt = generateSalt();
      const key = await deriveKey('pw', salt);
      const encrypted = await encrypt({}, key, salt);
      const embeddedSalt = encrypted.slice(0, 16);
      expect(embeddedSalt).toEqual(salt);
    });

    it('returned key can be reused for subsequent encryptions', { timeout: 20000 }, async () => {
      const salt = generateSalt();
      const key = await deriveKey('pw', salt);
      const encrypted1 = await encrypt({ v: 1 }, key, salt);
      const result1 = await decrypt(encrypted1, 'pw');
      const encrypted2 = await encrypt({ v: 2 }, result1.key, result1.salt);
      const result2 = await decrypt(encrypted2, 'pw');
      expect(result2.data).toEqual({ v: 2 });
    });
  });
});
