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
});
