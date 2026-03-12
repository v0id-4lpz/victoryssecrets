import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';

const TMP = '/tmp/test-vsv-list.vsv';
const PW = 'testpassword1234';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

async function setupVault() {
  await vault.create(TMP, PW);
  await vault.addService('db', 'Database', 'Main DB');
  await vault.addService('api', 'API');
  await vault.addEnvironment('dev', 'Development');
  await vault.addEnvironment('prod', 'Production');
  await vault.setSecret('db', 'host', { secret: false, values: { dev: 'localhost', prod: 'db.prod.internal' } });
  await vault.setSecret('db', 'password', { secret: true, values: { dev: 'devpass', prod: 'prodpass' } });
  await vault.setSecret('api', 'key', { secret: true, values: { dev: 'sk-dev-123' } });
}

describe('list command logic', () => {
  afterEach(cleanup);

  it('vault has correct services after setup', async () => {
    await setupVault();
    const data = vault.getData();
    expect(Object.keys(data.services)).toEqual(['db', 'api']);
    expect(data.services['db']?.label).toBe('Database');
    expect(data.services['db']?.comment).toBe('Main DB');
  });

  it('vault has correct environments after setup', async () => {
    await setupVault();
    const data = vault.getData();
    expect(Object.keys(data.environments)).toEqual(['dev', 'prod']);
  });

  it('vault has correct secrets after setup', async () => {
    await setupVault();
    const data = vault.getData();

    expect(Object.keys(data.secrets['db'] || {})).toEqual(['host', 'password']);
    expect(Object.keys(data.secrets['api'] || {})).toEqual(['key']);

    expect(data.secrets['db']?.['host']?.secret).toBe(false);
    expect(data.secrets['db']?.['password']?.secret).toBe(true);
    expect(data.secrets['db']?.['host']?.values['dev']).toBe('localhost');
    expect(data.secrets['db']?.['host']?.values['prod']).toBe('db.prod.internal');
  });

  it('secrets count envs correctly', async () => {
    await setupVault();
    const data = vault.getData();

    const hostEnvCount = Object.keys(data.secrets['db']?.['host']?.values || {}).length;
    expect(hostEnvCount).toBe(2);

    const keyEnvCount = Object.keys(data.secrets['api']?.['key']?.values || {}).length;
    expect(keyEnvCount).toBe(1);
  });

  it('data persists after lock and reopen', async () => {
    await setupVault();
    vault.lock();

    await vault.open(TMP, PW);
    const data = vault.getData();
    expect(Object.keys(data.services)).toEqual(['db', 'api']);
    expect(Object.keys(data.secrets['db'] || {})).toEqual(['host', 'password']);
  });
});
