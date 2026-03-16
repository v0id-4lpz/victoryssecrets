import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';
import { generateEnv, resolveSecrets } from '../../src/services/env-generator';

const TMP = '/tmp/test-vsv-env.vsv';
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
  await vault.setSecret('pg', 'password', { secret: true, values: { _global: 's3cret' } });
  await vault.setSecret('redis', 'host', { secret: false, values: { _global: 'redis-local', prod: 'redis.prod' } });
  await vault.setTemplateEntry('DATABASE_URL', '${pg.url}');
  await vault.setTemplateEntry('DB_PASSWORD', '${pg.password}');
  await vault.setTemplateEntry('REDIS_HOST', '${redis.host}');
}

describe('env command logic', () => {
  afterEach(cleanup);

  describe('generateEnv', () => {
    it('produces correct .env output for dev', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.output).toContain('DATABASE_URL=postgres://localhost');
      expect(result.output).toContain('DB_PASSWORD=s3cret');
      expect(result.output).toContain('REDIS_HOST=redis-local');
      expect(result.warnings).toEqual([]);
    });

    it('produces correct .env output for prod', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'prod');
      expect(result.output).toContain('DATABASE_URL=postgres://prod-db');
      expect(result.output).toContain('DB_PASSWORD=s3cret'); // falls back to global
      expect(result.output).toContain('REDIS_HOST=redis.prod');
      expect(result.warnings).toEqual([]);
    });

    it('returns entries array with key/value pairs', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'prod');
      const dbEntry = result.entries.find(e => e.key === 'DATABASE_URL');
      expect(dbEntry).toBeDefined();
      expect(dbEntry!.value).toBe('postgres://prod-db');
      expect(dbEntry!.source).toBe('prod');
      expect(dbEntry!.secret).toBe(true);
    });

    it('entries show source as Global for fallback values', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'dev');
      const dbEntry = result.entries.find(e => e.key === 'DATABASE_URL');
      expect(dbEntry!.source).toBe('Global');
    });

    it('warns on unresolved reference', async () => {
      await setupVault();
      await vault.setTemplateEntry('MISSING_KEY', '${nonexist.field}');
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('unresolved reference');
      const missingEntry = result.entries.find(e => e.key === 'MISSING_KEY');
      expect(missingEntry!.value).toBe('');
    });

    it('warns on invalid ref format (no dot)', async () => {
      await setupVault();
      await vault.setTemplateEntry('BAD_REF', '${nodot}');
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('invalid reference');
    });

    it('handles static (non-ref) values in template', async () => {
      await setupVault();
      await vault.setTemplateEntry('APP_NAME', 'my-app');
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.output).toContain('APP_NAME=my-app');
      const appEntry = result.entries.find(e => e.key === 'APP_NAME');
      expect(appEntry!.source).toBe('static');
      expect(appEntry!.secret).toBe(false);
    });

    it('handles _ENV_NAME magic variable', async () => {
      await setupVault();
      await vault.setTemplateEntry('ENV', '${_ENV_NAME}');
      const result = generateEnv(vault.getData(), 'prod');
      expect(result.output).toContain('ENV=prod');
      const envEntry = result.entries.find(e => e.key === 'ENV');
      expect(envEntry!.value).toBe('prod');
      expect(envEntry!.source).toBe('auto');
    });

    it('returns minimal output when template is empty', async () => {
      await vault.create(TMP, PW);
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.output).toBe('\n'); // empty template produces just a trailing newline
      expect(result.warnings).toEqual([]);
      expect(result.entries).toEqual([]);
    });

    it('handles empty string secret values correctly', async () => {
      await setupVault();
      await vault.setSecret('pg', 'optional', { secret: false, values: { _global: 'default', prod: '' } });
      await vault.setTemplateEntry('PG_OPTIONAL', '${pg.optional}');
      const result = generateEnv(vault.getData(), 'prod');
      const entry = result.entries.find(e => e.key === 'PG_OPTIONAL');
      expect(entry!.value).toBe('');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('resolveSecrets', () => {
    it('resolves all secrets for a given env', async () => {
      await setupVault();
      const resolved = resolveSecrets(vault.getData(), 'prod');
      expect(resolved['pg']!['url']).toBe('postgres://prod-db');
      expect(resolved['pg']!['password']).toBe('s3cret'); // global fallback
      expect(resolved['redis']!['host']).toBe('redis.prod');
    });

    it('omits secrets with no value for env or global', async () => {
      await vault.create(TMP, PW);
      await vault.addService('svc', 'svc');
      await vault.addEnvironment('dev');
      await vault.addEnvironment('prod');
      await vault.setSecret('svc', 'key', { secret: true, values: { dev: 'only-dev' } });
      const resolved = resolveSecrets(vault.getData(), 'prod');
      expect(resolved['svc']!['key']).toBeUndefined();
    });
  });

  describe('persistence', () => {
    it('env output matches after lock/reopen', async () => {
      await setupVault();
      const before = generateEnv(vault.getData(), 'prod');
      vault.lock();

      await vault.open(TMP, PW);
      const after = generateEnv(vault.getData(), 'prod');
      expect(after.output).toBe(before.output);
      expect(after.entries).toEqual(before.entries);
    });
  });
});
