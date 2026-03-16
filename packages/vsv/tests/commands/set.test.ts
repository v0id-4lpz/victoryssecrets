import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';

const TMP = '/tmp/test-vsv-set.vsv';
const PW = 'testpassword1234';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

describe('set command logic', () => {
  afterEach(cleanup);

  it('sets a value on an existing secret', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.setSecret('db', 'host');

    await vault.setSecretValue('db', 'host', 'dev', 'localhost');

    const data = vault.getData();
    expect(data.secrets['db']?.['host']?.values['dev']).toBe('localhost');
  });

  it('--create flow: creates service, env, and secret if missing', async () => {
    await vault.create(TMP, PW);

    // Simulate --create: add service if missing
    const data = vault.getData();
    expect(data.services['redis']).toBeUndefined();

    await vault.addService('redis', 'redis');
    await vault.addEnvironment('staging');
    await vault.setSecret('redis', 'url');
    await vault.setSecretValue('redis', 'url', 'staging', 'redis://staging:6379');

    const updated = vault.getData();
    expect(updated.services['redis']?.label).toBe('redis');
    expect(updated.environments['staging']).toBeDefined();
    expect(updated.secrets['redis']?.['url']?.values['staging']).toBe('redis://staging:6379');
  });

  it('overwrites existing value', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.setSecret('db', 'host', { values: { dev: 'old-host' } });

    await vault.setSecretValue('db', 'host', 'dev', 'new-host');

    expect(vault.getData().secrets['db']?.['host']?.values['dev']).toBe('new-host');
  });

  it('persists after set and survives lock/reopen', async () => {
    await vault.create(TMP, PW);
    await vault.addService('api', 'API');
    await vault.addEnvironment('prod');
    await vault.setSecret('api', 'key');
    await vault.setSecretValue('api', 'key', 'prod', 'sk-prod-secret');
    vault.lock();

    await vault.open(TMP, PW);
    expect(vault.getData().secrets['api']?.['key']?.values['prod']).toBe('sk-prod-secret');
  });

  it('sets value for new env on existing secret', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.addEnvironment('prod');
    await vault.setSecret('db', 'host', { values: { dev: 'localhost' } });

    await vault.setSecretValue('db', 'host', 'prod', 'db.prod.internal');

    const values = vault.getData().secrets['db']?.['host']?.values;
    expect(values?.['dev']).toBe('localhost');
    expect(values?.['prod']).toBe('db.prod.internal');
  });

  it('rejects setting value for non-existent secret', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');

    await expect(vault.setSecretValue('db', 'nonexistent', 'dev', 'value'))
      .rejects.toThrow('not found');
  });

  it('rejects setting value for non-existent environment', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'host');

    await expect(vault.setSecretValue('db', 'host', 'staging', 'value'))
      .rejects.toThrow('Environment "staging" not found');
  });

  it('allows setting value for _global env', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'host');

    await vault.setSecretValue('db', 'host', '_global', 'localhost');
    expect(vault.getData().secrets['db']?.['host']?.values['_global']).toBe('localhost');
  });

  it('sets empty string value', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.setSecret('db', 'optional');

    await vault.setSecretValue('db', 'optional', 'dev', '');
    expect(vault.getData().secrets['db']?.['optional']?.values['dev']).toBe('');
  });

  it('sets value with special characters', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.setSecret('db', 'url');

    const url = 'postgres://user:p@ss!w0rd@host:5432/db?ssl=true&timeout=30';
    await vault.setSecretValue('db', 'url', 'dev', url);
    expect(vault.getData().secrets['db']?.['url']?.values['dev']).toBe(url);

    // Verify it survives lock/reopen
    vault.lock();
    await vault.open(TMP, PW);
    expect(vault.getData().secrets['db']?.['url']?.values['dev']).toBe(url);
  });

  it('secret flag can be toggled', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'host', { secret: false });

    expect(vault.getData().secrets['db']?.['host']?.secret).toBe(false);
    await vault.setSecretFlag('db', 'host', true);
    expect(vault.getData().secrets['db']?.['host']?.secret).toBe(true);
  });

  it('delete secret removes field', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'host');
    await vault.setSecret('db', 'password');

    await vault.deleteSecret('db', 'host');
    expect(vault.getData().secrets['db']?.['host']).toBeUndefined();
    expect(vault.getData().secrets['db']?.['password']).toBeDefined();
  });

  it('delete last secret removes service bucket', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'host');

    await vault.deleteSecret('db', 'host');
    expect(vault.getData().secrets['db']).toBeUndefined();
  });

  it('deleteSecretValue removes single env value', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('dev');
    await vault.addEnvironment('prod');
    await vault.setSecret('db', 'host', { values: { _global: 'localhost', dev: 'dev-host', prod: 'prod-host' } });

    await vault.deleteSecretValue('db', 'host', 'dev');
    const values = vault.getData().secrets['db']?.['host']?.values;
    expect(values?.['dev']).toBeUndefined();
    expect(values?.['prod']).toBe('prod-host');
    expect(values?.['_global']).toBe('localhost');
  });

  it('moveSecret renames field and updates templates', async () => {
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.setSecret('db', 'url', { secret: true, values: { _global: 'postgres://localhost' } });
    await vault.setTemplateEntry('DATABASE_URL', '${db.url}');

    await vault.moveSecret('db', 'url', 'db', 'connection_string');

    expect(vault.getData().secrets['db']?.['url']).toBeUndefined();
    expect(vault.getData().secrets['db']?.['connection_string']?.values['_global']).toBe('postgres://localhost');
    expect(vault.getTemplate()['DATABASE_URL']).toBe('${db.connection_string}');
  });
});
