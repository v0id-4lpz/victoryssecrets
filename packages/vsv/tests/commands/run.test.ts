import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';
import { generateEnv } from '../../src/services/env-generator';

const TMP = '/tmp/test-vsv-run.vsv';
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
  await vault.setSecret('pg', 'password', { secret: true, values: { _global: 's3cret', dev: 'devpass' } });
  await vault.setSecret('redis', 'host', { secret: false, values: { _global: 'redis-local', prod: 'redis.prod' } });
  await vault.setTemplateEntry('DATABASE_URL', '${pg.url}');
  await vault.setTemplateEntry('DB_PASSWORD', '${pg.password}');
  await vault.setTemplateEntry('REDIS_HOST', '${redis.host}');
}

describe('run command logic', () => {
  afterEach(cleanup);

  describe('env generation for process injection', () => {
    it('produces correct entries for dev', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'dev');
      const envMap: Record<string, string> = {};
      for (const { key, value } of result.entries) envMap[key] = value;

      expect(envMap['DATABASE_URL']).toBe('postgres://localhost');
      expect(envMap['DB_PASSWORD']).toBe('devpass');
      expect(envMap['REDIS_HOST']).toBe('redis-local');
    });

    it('produces correct entries for prod', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'prod');
      const envMap: Record<string, string> = {};
      for (const { key, value } of result.entries) envMap[key] = value;

      expect(envMap['DATABASE_URL']).toBe('postgres://prod-db');
      expect(envMap['DB_PASSWORD']).toBe('s3cret'); // global fallback
      expect(envMap['REDIS_HOST']).toBe('redis.prod');
    });

    it('warns about unresolved refs but still produces partial entries', async () => {
      await setupVault();
      await vault.setTemplateEntry('MISSING', '${nonexist.field}');

      const result = generateEnv(vault.getData(), 'dev');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('unresolved');

      // Other entries still generated
      const envMap: Record<string, string> = {};
      for (const { key, value } of result.entries) envMap[key] = value;
      expect(envMap['DATABASE_URL']).toBe('postgres://localhost');
      expect(envMap['MISSING']).toBe('');
    });

    it('vault is usable after lock for run (simulate lock after gen)', async () => {
      await setupVault();
      const result = generateEnv(vault.getData(), 'prod');
      vault.lock();

      // Entries should still be usable after vault is locked
      expect(result.entries.length).toBeGreaterThan(0);
      const envMap: Record<string, string> = {};
      for (const { key, value } of result.entries) envMap[key] = value;
      expect(envMap['DATABASE_URL']).toBe('postgres://prod-db');
    });

    it('handles empty template (no env vars to inject)', async () => {
      await vault.create(TMP, PW);
      await vault.addEnvironment('dev');
      const result = generateEnv(vault.getData(), 'dev');
      expect(result.entries).toEqual([]);
      expect(result.output).toBe('\n'); // empty template produces just a trailing newline
    });

    it('merges static and dynamic entries', async () => {
      await setupVault();
      await vault.setTemplateEntry('APP_NAME', 'my-app');
      await vault.setTemplateEntry('ENV', '${_ENV_NAME}');

      const result = generateEnv(vault.getData(), 'prod');
      const envMap: Record<string, string> = {};
      for (const { key, value } of result.entries) envMap[key] = value;

      expect(envMap['APP_NAME']).toBe('my-app');
      expect(envMap['ENV']).toBe('prod');
      expect(envMap['DATABASE_URL']).toBe('postgres://prod-db');
    });
  });
});
