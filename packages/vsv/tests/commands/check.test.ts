import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';
import { GLOBAL_ENV } from '../../src/models/vault-schema';
import type { VaultData } from '../../src/types/vault';

const TMP = '/tmp/test-vsv-check.vsv';
const PW = 'testpassword1234';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

// Replicates the checkEnv logic from commands/check.ts
function checkEnv(data: VaultData, envId: string): { missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const [serviceId, fields] of Object.entries(data.secrets)) {
    for (const [field, entry] of Object.entries(fields)) {
      const ref = `${serviceId}.${field}`;
      const envVal = entry.values[envId];
      const globalVal = entry.values[GLOBAL_ENV];

      if (envVal === undefined && globalVal === undefined) {
        missing.push(ref);
      } else if (envVal === '' && globalVal === undefined) {
        empty.push(ref);
      }
    }
  }

  return { missing, empty };
}

async function setupVault() {
  await vault.create(TMP, PW);
  await vault.addService('pg', 'PostgreSQL');
  await vault.addService('redis', 'Redis');
  await vault.addEnvironment('dev');
  await vault.addEnvironment('prod');
  await vault.addEnvironment('staging');
}

describe('check command logic', () => {
  afterEach(cleanup);

  describe('all secrets have values', () => {
    it('reports ok when all secrets have env-specific values', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { dev: 'postgres://dev', prod: 'postgres://prod' } });
      await vault.setSecret('redis', 'host', { secret: false, values: { dev: 'localhost', prod: 'redis.prod' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toEqual([]);
      expect(result.empty).toEqual([]);
    });

    it('reports ok when secrets use global fallback', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { _global: 'postgres://localhost' } });
      await vault.setSecret('redis', 'host', { secret: false, values: { _global: 'redis-local' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toEqual([]);
      expect(result.empty).toEqual([]);
    });

    it('reports ok when mix of global and env-specific', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { _global: 'postgres://localhost', prod: 'postgres://prod' } });

      const resultDev = checkEnv(vault.getData(), 'dev');
      expect(resultDev.missing).toEqual([]);

      const resultProd = checkEnv(vault.getData(), 'prod');
      expect(resultProd.missing).toEqual([]);
    });
  });

  describe('missing values', () => {
    it('detects secrets with no value for env and no global', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { prod: 'postgres://prod' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toContain('pg.url');
    });

    it('detects multiple missing secrets', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { prod: 'postgres://prod' } });
      await vault.setSecret('pg', 'password', { secret: true, values: {} });
      await vault.setSecret('redis', 'host', { secret: false, values: { dev: 'localhost' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toContain('pg.url');
      expect(result.missing).toContain('pg.password');
      expect(result.missing).not.toContain('redis.host');
    });

    it('secret with empty values object is missing', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: {} });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toContain('pg.url');
    });
  });

  describe('empty values', () => {
    it('detects explicitly empty env value with no global fallback', async () => {
      await setupVault();
      await vault.setSecret('pg', 'optional', { secret: false, values: { dev: '' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.empty).toContain('pg.optional');
      expect(result.missing).not.toContain('pg.optional');
    });

    it('does NOT flag empty env value when global exists', async () => {
      await setupVault();
      await vault.setSecret('pg', 'optional', { secret: false, values: { _global: 'fallback', dev: '' } });

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.empty).toEqual([]);
      expect(result.missing).toEqual([]);
    });
  });

  describe('mixed scenarios', () => {
    it('detects both missing and empty in one pass', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { prod: 'postgres://prod' } }); // missing for dev
      await vault.setSecret('pg', 'optional', { secret: false, values: { dev: '' } }); // empty for dev
      await vault.setSecret('redis', 'host', { secret: false, values: { _global: 'ok' } }); // ok

      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toEqual(['pg.url']);
      expect(result.empty).toEqual(['pg.optional']);
    });

    it('check passes for one env, fails for another', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { prod: 'postgres://prod' } });

      const prodResult = checkEnv(vault.getData(), 'prod');
      expect(prodResult.missing).toEqual([]);

      const devResult = checkEnv(vault.getData(), 'dev');
      expect(devResult.missing).toContain('pg.url');
    });
  });

  describe('edge cases', () => {
    it('empty vault has no missing or empty', async () => {
      await vault.create(TMP, PW);
      await vault.addEnvironment('dev');
      const result = checkEnv(vault.getData(), 'dev');
      expect(result.missing).toEqual([]);
      expect(result.empty).toEqual([]);
    });

    it('secrets with only global values pass for any env', async () => {
      await setupVault();
      await vault.setSecret('pg', 'url', { secret: true, values: { _global: 'postgres://default' } });

      for (const env of ['dev', 'prod', 'staging']) {
        const result = checkEnv(vault.getData(), env);
        expect(result.missing).toEqual([]);
      }
    });
  });
});
