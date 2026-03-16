import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';
import { resolveValue } from '../../src/services/secret-ops';

const TMP = '/tmp/test-vsv-get.vsv';
const PW = 'testpassword1234';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

async function setupVault() {
  await vault.create(TMP, PW);
  await vault.addService('pg', 'PostgreSQL');
  await vault.addService('redis', 'Redis');
  await vault.addEnvironment('dev');
  await vault.addEnvironment('prod');
  await vault.setSecret('pg', 'url', { secret: true, values: { _global: 'postgres://localhost', prod: 'postgres://prod-db' } });
  await vault.setSecret('pg', 'password', { secret: true, values: { _global: 's3cret', dev: 'devpass', prod: 'prodpass' } });
  await vault.setSecret('redis', 'host', { secret: false, values: { _global: 'redis-local', prod: 'redis.prod' } });
  await vault.setSecret('pg', 'empty_field', { secret: false, values: { _global: 'fallback', dev: '' } });
}

describe('get command logic', () => {
  afterEach(cleanup);

  describe('vault.get(ref, env)', () => {
    it('returns env-specific value when present', async () => {
      await setupVault();
      expect(vault.get('pg.password', 'prod')).toBe('prodpass');
      expect(vault.get('pg.password', 'dev')).toBe('devpass');
    });

    it('falls back to _global when env value is missing', async () => {
      await setupVault();
      expect(vault.get('pg.url', 'dev')).toBe('postgres://localhost');
      expect(vault.get('redis.host', 'dev')).toBe('redis-local');
    });

    it('returns env-specific value over global', async () => {
      await setupVault();
      expect(vault.get('pg.url', 'prod')).toBe('postgres://prod-db');
    });

    it('returns null for non-existent service', async () => {
      await setupVault();
      expect(vault.get('mongo.url', 'dev')).toBeNull();
    });

    it('returns null for non-existent field', async () => {
      await setupVault();
      expect(vault.get('pg.nonexistent', 'dev')).toBeNull();
    });

    it('returns empty string when env value is explicitly empty', async () => {
      await setupVault();
      expect(vault.get('pg.empty_field', 'dev')).toBe('');
    });

    it('falls back to global when env value is not set (but field exists)', async () => {
      await setupVault();
      expect(vault.get('pg.empty_field', 'prod')).toBe('fallback');
    });

    it('throws for invalid ref (no dot)', async () => {
      await setupVault();
      expect(() => vault.get('nodot', 'dev')).toThrow('Invalid reference');
    });

    it('throws when vault is not open', () => {
      expect(() => vault.get('pg.url', 'dev')).toThrow('Vault is not open');
    });
  });

  describe('resolveValue', () => {
    it('returns env value when present', () => {
      const entry = { secret: true, values: { _global: 'default', prod: 'prod-val' } };
      expect(resolveValue(entry, 'prod')).toBe('prod-val');
    });

    it('falls back to global when env value is missing', () => {
      const entry = { secret: true, values: { _global: 'default' } };
      expect(resolveValue(entry, 'prod')).toBe('default');
    });

    it('returns empty string when env value is explicitly empty', () => {
      const entry = { secret: true, values: { _global: 'default', prod: '' } };
      expect(resolveValue(entry, 'prod')).toBe('');
    });

    it('returns undefined for null entry', () => {
      expect(resolveValue(null, 'prod')).toBeUndefined();
    });

    it('returns undefined when no values at all', () => {
      const entry = { secret: true, values: {} };
      expect(resolveValue(entry, 'prod')).toBeUndefined();
    });
  });

  describe('persistence', () => {
    it('get returns correct value after lock/reopen', async () => {
      await setupVault();
      vault.lock();

      await vault.open(TMP, PW);
      expect(vault.get('pg.url', 'prod')).toBe('postgres://prod-db');
      expect(vault.get('pg.url', 'dev')).toBe('postgres://localhost');
      expect(vault.get('pg.password', 'dev')).toBe('devpass');
    });
  });
});
