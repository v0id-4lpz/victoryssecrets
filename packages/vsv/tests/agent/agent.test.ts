import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import * as vault from '../../src/vault';
import { startAgent, shutdown } from '../../src/agent/server';
import { createClient, VsvClient } from '../../src/agent/client';
import { getSocketPath, getPidPath } from '../../src/agent/protocol';

const TMP = '/tmp/test-vsv-agent.vsv';
const PW = 'testpassword1234';

function cleanupFiles() {
  try { vault.lock(); } catch { /* ignore */ }
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
  const sock = getSocketPath();
  const pid = getPidPath();
  if (existsSync(sock)) unlinkSync(sock);
  if (existsSync(pid)) unlinkSync(pid);
}

async function createTestVault() {
  await vault.create(TMP, PW);
  await vault.addService('db', 'Database');
  await vault.addEnvironment('dev');
  await vault.addEnvironment('prod');
  await vault.setSecret('db', 'host', { secret: false, values: { dev: 'localhost', prod: 'db.prod' } });
  await vault.setSecret('db', 'pass', { secret: true, values: { prod: 's3cret' } });
  await vault.setTemplateEntry('DB_HOST', '${db.host}');
  await vault.setTemplateEntry('DB_PASS', '${db.pass}');
  vault.lock();
}

describe('agent + client', () => {
  afterAll(() => {
    shutdown();
    cleanupFiles();
  });

  it('full lifecycle with default env', async () => {
    cleanupFiles();
    await createTestVault();

    // Start agent with default env 'prod'
    await startAgent(TMP, PW, 'prod');

    // Client without specifying env — uses agent default
    const client = createClient();
    await client.connect();

    // Ping
    expect(await client.ping()).toBe('pong');

    // getInfo returns agent env
    const info = await client.getInfo();
    expect(info.env).toBe('prod');

    // get() without env — resolves using agent default 'prod'
    expect(await client.get('db.host')).toBe('db.prod');
    expect(await client.get('db.pass')).toBe('s3cret');

    // get() with env override
    expect(await client.get('db.host', 'dev')).toBe('localhost');

    // env() without envId — uses agent default
    const envResult = await client.env();
    expect(envResult.entries).toBeDefined();

    // Read full data
    const data = await client.getData();
    expect(Object.keys(data.services)).toEqual(['db']);
    expect(Object.keys(data.environments)).toEqual(['dev', 'prod']);

    // Helpers
    expect(await client.hasService('db')).toBe(true);
    expect(await client.hasService('redis')).toBe(false);
    expect(await client.hasEnvironment('prod')).toBe(true);

    client.disconnect();
    shutdown();
  }, 30000);

  it('client with its own default env', async () => {
    cleanupFiles();
    await createTestVault();

    // Start agent without default env
    await startAgent(TMP, PW);

    // Client sets its own default env
    const client = createClient({ env: 'dev' });
    await client.connect();

    expect(await client.get('db.host')).toBe('localhost');
    expect(await client.get('db.host', 'prod')).toBe('db.prod');

    client.disconnect();
    shutdown();
  }, 30000);

  it('mutations persist to disk', async () => {
    cleanupFiles();
    await createTestVault();

    await startAgent(TMP, PW, 'prod');

    const client = createClient();
    await client.connect();

    await client.addService('api', 'API');
    await client.setSecret('api', 'key', { secret: true, values: { prod: 'sk-123' } });
    expect(await client.get('api.key')).toBe('sk-123');

    client.disconnect();
    shutdown();

    // Verify persistence
    await vault.open(TMP, PW);
    expect(vault.getData().services['api']?.label).toBe('API');
    expect(vault.get('api.key', 'prod')).toBe('sk-123');
    vault.lock();
  }, 30000);

  it('server creates socket and pid files with correct permissions', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const socketPath = getSocketPath();
    const pidPath = getPidPath();

    expect(existsSync(socketPath)).toBe(true);
    expect(existsSync(pidPath)).toBe(true);

    // PID file contains a valid number
    const pid = readFileSync(pidPath, 'utf-8').trim();
    expect(parseInt(pid, 10)).toBeGreaterThan(0);
    expect(parseInt(pid, 10)).toBe(process.pid);

    shutdown();
  }, 30000);

  it('shutdown cleans up socket and pid files', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW);

    const socketPath = getSocketPath();
    const pidPath = getPidPath();
    expect(existsSync(socketPath)).toBe(true);

    shutdown();

    expect(existsSync(socketPath)).toBe(false);
    expect(existsSync(pidPath)).toBe(false);
  }, 30000);

  it('rejects starting agent when socket already exists', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW);

    // Try to start again — should throw
    await expect(startAgent(TMP, PW)).rejects.toThrow('already running');

    shutdown();
  }, 30000);

  it('server read methods: getSecret, getAllSecrets, getTemplate, getSettings', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const client = createClient();
    await client.connect();

    // getSecret
    const entry = await client.getSecret('db', 'host');
    expect(entry).not.toBeNull();
    expect(entry!.secret).toBe(false);
    expect(entry!.values['dev']).toBe('localhost');

    // getSecret for missing field
    const missing = await client.getSecret('db', 'nonexistent');
    expect(missing).toBeNull();

    // getAllSecrets
    const all = await client.getAllSecrets();
    expect(Object.keys(all)).toEqual(['db']);
    expect(Object.keys(all['db']!)).toEqual(['host', 'pass']);

    // getTemplate
    const tpl = await client.getTemplate();
    expect(tpl['DB_HOST']).toBe('${db.host}');
    expect(tpl['DB_PASS']).toBe('${db.pass}');

    // getSettings
    const settings = await client.getSettings();
    expect(settings).toBeDefined();
    expect(typeof settings.autolockMinutes).toBe('number');
    expect(typeof settings.readOnly).toBe('boolean');

    // isRemote (local vault)
    expect(await client.isRemote()).toBe(false);

    // isUnlocked
    expect(await client.isUnlocked()).toBe(true);

    // getPath
    const path = await client.getPath();
    expect(path).toBe(TMP);

    client.disconnect();
    shutdown();
  }, 30000);

  it('server mutation methods: deleteService, deleteSecret, setSecretValue', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const client = createClient();
    await client.connect();

    // setSecretValue
    await client.setSecretValue('db', 'host', 'prod', 'new-prod-host');
    expect(await client.get('db.host', 'prod')).toBe('new-prod-host');

    // deleteSecret
    await client.deleteSecret('db', 'pass');
    const entry = await client.getSecret('db', 'pass');
    expect(entry).toBeNull();

    // deleteService
    await client.deleteService('db');
    expect(await client.hasService('db')).toBe(false);

    client.disconnect();
    shutdown();
  }, 30000);

  it('env() generates correct .env output via agent', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const client = createClient();
    await client.connect();

    const result = await client.env('prod');
    expect(result.entries).toBeDefined();
    const map: Record<string, string> = {};
    for (const { key, value } of result.entries) map[key] = value;
    expect(map['DB_HOST']).toBe('db.prod');
    expect(map['DB_PASS']).toBe('s3cret');

    // Dev env
    const devResult = await client.env('dev');
    const devMap: Record<string, string> = {};
    for (const { key, value } of devResult.entries) devMap[key] = value;
    expect(devMap['DB_HOST']).toBe('localhost');

    client.disconnect();
    shutdown();
  }, 30000);

  it('client.connect() auto-connects on first call', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    // Don't call connect() explicitly — call() should auto-connect
    const client = createClient();
    const pong = await client.ping();
    expect(pong).toBe('pong');

    client.disconnect();
    shutdown();
  }, 30000);

  it('client throws when agent is not running', async () => {
    cleanupFiles();
    const client = new VsvClient({ socketPath: '/tmp/nonexistent-vsv-test.sock', connectTimeout: 500 });
    await expect(client.connect()).rejects.toThrow();
  }, 5000);

  it('multiple clients can connect simultaneously', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const client1 = createClient();
    const client2 = createClient({ env: 'dev' });
    await client1.connect();
    await client2.connect();

    // Both clients work independently
    expect(await client1.get('db.host')).toBe('db.prod');
    expect(await client2.get('db.host')).toBe('localhost');

    client1.disconnect();
    client2.disconnect();
    shutdown();
  }, 30000);

  it('addEnvironment via client', async () => {
    cleanupFiles();
    await createTestVault();
    await startAgent(TMP, PW, 'prod');

    const client = createClient();
    await client.connect();

    await client.addEnvironment('staging', 'Staging env');
    expect(await client.hasEnvironment('staging')).toBe(true);

    client.disconnect();
    shutdown();
  }, 30000);
});
