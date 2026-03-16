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

  it('service labels and comments are preserved', async () => {
    await setupVault();
    const data = vault.getData();
    expect(data.services['db']?.label).toBe('Database');
    expect(data.services['db']?.comment).toBe('Main DB');
    expect(data.services['api']?.label).toBe('API');
    expect(data.services['api']?.comment).toBe('');
  });

  it('environment comments are preserved', async () => {
    await setupVault();
    expect(vault.getEnvironmentComment('dev')).toBe('Development');
    expect(vault.getEnvironmentComment('prod')).toBe('Production');
  });

  it('hasService returns correct values', async () => {
    await setupVault();
    expect(vault.hasService('db')).toBe(true);
    expect(vault.hasService('api')).toBe(true);
    expect(vault.hasService('nonexistent')).toBe(false);
  });

  it('hasEnvironment returns correct values', async () => {
    await setupVault();
    expect(vault.hasEnvironment('dev')).toBe(true);
    expect(vault.hasEnvironment('prod')).toBe(true);
    expect(vault.hasEnvironment('staging')).toBe(false);
  });

  it('getAllSecrets returns full structure', async () => {
    await setupVault();
    const all = vault.getAllSecrets();
    expect(Object.keys(all)).toEqual(['db', 'api']);
    expect(Object.keys(all['db']!)).toEqual(['host', 'password']);
    expect(Object.keys(all['api']!)).toEqual(['key']);
  });

  it('getSecret returns entry details', async () => {
    await setupVault();
    const entry = vault.getSecret('db', 'host');
    expect(entry).not.toBeNull();
    expect(entry!.secret).toBe(false);
    expect(entry!.values['dev']).toBe('localhost');
    expect(entry!.values['prod']).toBe('db.prod.internal');
  });

  it('getSecret returns null for missing entry', async () => {
    await setupVault();
    expect(vault.getSecret('db', 'nonexistent')).toBeNull();
    expect(vault.getSecret('nonexistent', 'field')).toBeNull();
  });

  it('deleteService removes service and its secrets', async () => {
    await setupVault();
    await vault.deleteService('db');
    const data = vault.getData();
    expect(data.services['db']).toBeUndefined();
    expect(data.secrets['db']).toBeUndefined();
    expect(data.services['api']).toBeDefined();
  });

  it('renameService updates label', async () => {
    await setupVault();
    await vault.renameService('db', 'Main Database');
    expect(vault.getData().services['db']?.label).toBe('Main Database');
  });

  it('renameServiceId updates service id', async () => {
    await setupVault();
    await vault.renameServiceId('db', 'database');
    const data = vault.getData();
    expect(data.services['db']).toBeUndefined();
    expect(data.services['database']?.label).toBe('Database');
    expect(data.secrets['database']).toBeDefined();
    expect(data.secrets['db']).toBeUndefined();
  });

  it('renameEnvironment updates env id across secrets', async () => {
    await setupVault();
    await vault.renameEnvironment('dev', 'development');
    const data = vault.getData();
    expect(data.environments['dev']).toBeUndefined();
    expect(data.environments['development']).toBeDefined();
    expect(data.secrets['db']?.['host']?.values['development']).toBe('localhost');
    expect(data.secrets['db']?.['host']?.values['dev']).toBeUndefined();
  });

  it('deleteEnvironment removes env and its secret values', async () => {
    await setupVault();
    await vault.deleteEnvironment('dev');
    const data = vault.getData();
    expect(data.environments['dev']).toBeUndefined();
    expect(data.secrets['db']?.['host']?.values['dev']).toBeUndefined();
    expect(data.secrets['db']?.['host']?.values['prod']).toBe('db.prod.internal');
  });

  it('setServiceComment updates comment', async () => {
    await setupVault();
    await vault.setServiceComment('api', 'REST API service');
    expect(vault.getData().services['api']?.comment).toBe('REST API service');
  });

  it('setEnvironmentComment updates comment', async () => {
    await setupVault();
    await vault.setEnvironmentComment('dev', 'Local development');
    expect(vault.getEnvironmentComment('dev')).toBe('Local development');
  });

  it('template CRUD works', async () => {
    await setupVault();
    await vault.setTemplateEntry('DB_HOST', '${db.host}');
    await vault.setTemplateEntry('DB_PASS', '${db.password}');

    const tpl = vault.getTemplate();
    expect(tpl['DB_HOST']).toBe('${db.host}');
    expect(tpl['DB_PASS']).toBe('${db.password}');

    await vault.deleteTemplateEntry('DB_PASS');
    expect(vault.getTemplate()['DB_PASS']).toBeUndefined();
    expect(vault.getTemplate()['DB_HOST']).toBe('${db.host}');
  });
});
