import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../../src/vault';
import { startAgent, shutdown } from '../../src/agent/server';
import { createClient } from '../../src/agent/client';
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
});
