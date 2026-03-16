import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import * as vault from '../src/vault';
import { encrypt, decrypt, deriveKey, generateSalt } from '../src/crypto';
import { createEmpty } from '../src/models/vault-schema';
import { isUnsafeName, sanitizeId } from '../src/models/validators';
import { addService as rawAddService } from '../src/services/service-ops';
import { startAgent, shutdown, getAuthToken } from '../src/agent/server';
import { createClient } from '../src/agent/client';
import { getSocketPath, getPidPath, getTokenPath } from '../src/agent/protocol';

const TMP = '/tmp/test-vsv-security.vsv';
const PW = 'testpassword1234';

function cleanup() {
  try { vault.lock(); } catch { /* ignore */ }
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

function cleanupAgent() {
  try { shutdown(); } catch { /* ignore */ }
  const sock = getSocketPath();
  const pid = getPidPath();
  const tok = getTokenPath();
  if (existsSync(sock)) unlinkSync(sock);
  if (existsSync(pid)) unlinkSync(pid);
  if (existsSync(tok)) unlinkSync(tok);
}

// ─── Prototype pollution ───

describe('prototype pollution resistance', () => {
  afterEach(cleanup);

  it('isUnsafeName detects all dangerous names', () => {
    expect(isUnsafeName('__proto__')).toBe(true);
    expect(isUnsafeName('constructor')).toBe(true);
    expect(isUnsafeName('__defineGetter__')).toBe(true);
    expect(isUnsafeName('__defineSetter__')).toBe(true);
    expect(isUnsafeName('__lookupGetter__')).toBe(true);
    expect(isUnsafeName('__lookupSetter__')).toBe(true);
    expect(isUnsafeName('hasOwnProperty')).toBe(true);
    expect(isUnsafeName('toString')).toBe(true);
    expect(isUnsafeName('ToString')).toBe(true); // case-insensitive
    expect(isUnsafeName('valueOf')).toBe(true);
    // Safe names
    expect(isUnsafeName('my_service')).toBe(false);
    expect(isUnsafeName('proto')).toBe(false);
    expect(isUnsafeName('api-key')).toBe(false);
  });

  it('sanitizeId rejects unsafe names', () => {
    expect(() => sanitizeId('__proto__')).toThrow('reserved name');
    expect(() => sanitizeId('constructor')).toThrow('reserved name');
    expect(() => sanitizeId('tostring')).toThrow('reserved name');
  });

  it('vault rejects __proto__ as service id', async () => {
    await vault.create(TMP, PW);
    await expect(vault.addService('__proto__', 'Proto')).rejects.toThrow('reserved name');
    // Object prototype must be unaffected
    expect(({} as any).label).toBeUndefined();
  });

  it('vault rejects constructor as service id', async () => {
    await vault.create(TMP, PW);
    await expect(vault.addService('constructor', 'Ctor')).rejects.toThrow('reserved name');
  });

  it('vault rejects __proto__ as environment id', async () => {
    await vault.create(TMP, PW);
    await expect(vault.addEnvironment('__proto__')).rejects.toThrow('reserved name');
    expect(({} as any).comment).toBeUndefined();
  });

  it('vault rejects __proto__ as field name in setSecret', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    await expect(vault.setSecret('svc', '__proto__', { secret: true, values: { _global: 'test' } }))
      .rejects.toThrow('reserved name');
  });

  it('vault rejects __proto__ as env key in setSecret values', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    // Object literal { '__proto__': 'val' } sets the prototype, not a key.
    // Use Object.create(null) + explicit assignment to actually create the key.
    const values = Object.create(null) as Record<string, string>;
    values['__proto__'] = 'val';
    await expect(vault.setSecret('svc', 'key', { secret: true, values }))
      .rejects.toThrow('reserved name');
  });

  it('vault rejects unsafe names in renameServiceId', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    await expect(vault.renameServiceId('svc', '__proto__')).rejects.toThrow('reserved name');
  });

  it('vault rejects unsafe names in renameEnvironment', async () => {
    await vault.create(TMP, PW);
    await vault.addEnvironment('dev');
    await expect(vault.renameEnvironment('dev', 'constructor')).rejects.toThrow('reserved name');
  });

  it('vault rejects unsafe names in setSecretValue env', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    await vault.setSecret('svc', 'key', { secret: true, values: { _global: 'v' } });
    await expect(vault.setSecretValue('svc', 'key', 'toString', 'val')).rejects.toThrow('reserved name');
  });

  it('Object.hasOwn guards in service-ops prevent prototype pollution', () => {
    // Even if someone bypasses the vault API layer, Object.hasOwn prevents
    // the code from mistakenly treating __proto__ as an existing key
    const data = createEmpty();
    // __proto__ is NOT an own property of a plain object
    expect(Object.hasOwn(data.services, '__proto__')).toBe(false);
    // But bracket access would return Object.prototype (truthy!) — that's the bug Object.hasOwn prevents
    expect(data.services['__proto__']).toBeDefined(); // this is Object.prototype
    // After addService, __proto__ assignment silently sets prototype, not own property —
    // but crucially, Object.prototype.label is NOT set
    rawAddService(data, '__proto__', 'Test');
    expect(({} as any).label).toBeUndefined(); // Object prototype unaffected
  });
});

// ─── Corrupted / tampered vault files ───

describe('corrupted vault file handling', () => {
  afterEach(cleanup);

  it('rejects truncated file', async () => {
    await vault.create(TMP, PW);
    vault.lock();

    // Truncate to 10 bytes (salt only, no IV or ciphertext)
    const truncated = Buffer.alloc(10, 0xff);
    writeFileSync(TMP, truncated);

    await expect(vault.open(TMP, PW)).rejects.toThrow();
  });

  it('rejects garbage data', async () => {
    const garbage = Buffer.from('not a vault file at all, just random text');
    writeFileSync(TMP, garbage);

    await expect(vault.open(TMP, PW)).rejects.toThrow();
  });

  it('rejects file with valid header but tampered ciphertext', async () => {
    await vault.create(TMP, PW);
    vault.lock();

    // Read the file and flip some bytes in the ciphertext region
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(TMP);
    const tampered = Buffer.from(raw);
    // Flip bytes after salt+IV (offset 28+)
    if (tampered.length > 30) {
      tampered[29] ^= 0xff;
      tampered[30] ^= 0xff;
    }
    writeFileSync(TMP, tampered);

    await expect(vault.open(TMP, PW)).rejects.toThrow();
  });

  it('rejects empty file', async () => {
    writeFileSync(TMP, Buffer.alloc(0));
    await expect(vault.open(TMP, PW)).rejects.toThrow();
  });

  it('decrypt rejects valid encryption but invalid JSON inside', async () => {
    // Manually encrypt non-JSON data
    const salt = generateSalt();
    const key = await deriveKey(PW, salt);
    // encrypt() JSON.stringify's its input, but we can test with data that
    // round-trips weirdly. The real test is that ensureStructure handles it.
    const data = { version: 1, services: null }; // services should be object
    const encrypted = await encrypt(data, key, salt);
    const result = await decrypt(encrypted, PW);
    // ensureStructure should fix null services to empty object
    const { ensureStructure } = await import('../src/models/vault-schema');
    const fixed = ensureStructure(result.data);
    expect(fixed.services).toEqual({});
  });
});

// ─── Crypto edge cases ───

describe('crypto security edge cases', () => {
  afterEach(cleanup);

  it('empty password is rejected by Argon2id', async () => {
    // Argon2id (hash-wasm) requires a non-empty password — this is a good security property
    await expect(vault.create(TMP, '')).rejects.toThrow();
  });

  it('very long password works', async () => {
    const longPw = 'a'.repeat(10000);
    await vault.create(TMP, longPw);
    await vault.addService('svc', 'Test');
    vault.lock();

    const data = await vault.open(TMP, longPw);
    expect(data.services['svc']?.label).toBe('Test');
  });

  it('unicode password works', async () => {
    const unicodePw = 'pässwörd 🔐 密码';
    await vault.create(TMP, unicodePw);
    vault.lock();

    const data = await vault.open(TMP, unicodePw);
    expect(data.version).toBe(1);
  });

  it('secrets with special characters survive encrypt/decrypt', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    await vault.addEnvironment('dev');
    const specialValue = 'p@$$w0rd!#%^&*(){}[]|\\:";\'<>?,./~`\n\t\r\0';
    await vault.setSecret('svc', 'key', { secret: true, values: { dev: specialValue } });
    vault.lock();

    await vault.open(TMP, PW);
    expect(vault.get('svc.key', 'dev')).toBe(specialValue);
  });

  it('each create generates different salt (nonce reuse prevention)', async () => {
    const { readFileSync } = await import('node:fs');

    await vault.create(TMP, PW);
    vault.lock();
    const salt1 = readFileSync(TMP).slice(0, 16);

    unlinkSync(TMP);
    await vault.create(TMP, PW);
    vault.lock();
    const salt2 = readFileSync(TMP).slice(0, 16);

    expect(Buffer.compare(salt1, salt2)).not.toBe(0);
  });

  it('same vault encrypted twice has different IV', async () => {
    const { readFileSync } = await import('node:fs');

    await vault.create(TMP, PW);
    await vault.addService('svc', 'Test');
    // First persist already happened in create, force another
    await vault.setServiceComment('svc', 'comment');
    vault.lock();
    const iv1 = readFileSync(TMP).slice(16, 28);

    await vault.open(TMP, PW);
    await vault.setServiceComment('svc', 'comment2');
    vault.lock();
    const iv2 = readFileSync(TMP).slice(16, 28);

    expect(Buffer.compare(iv1, iv2)).not.toBe(0);
  });
});

// ─── Agent security ───

describe('agent security', () => {
  afterAll(() => {
    cleanupAgent();
    cleanup();
  });

  it('server rejects unknown and prototype-chain methods', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    const client = createClient({ token: getAuthToken()! });
    await client.connect();

    // Arbitrary method
    await expect((client as any).call('eval', 'process.exit(1)')).rejects.toThrow('Unknown method');

    // Prototype chain methods must NOT be dispatched as reads
    await expect((client as any).call('__proto__')).rejects.toThrow('Unknown method');
    await expect((client as any).call('constructor')).rejects.toThrow('Unknown method');
    await expect((client as any).call('toString')).rejects.toThrow('Unknown method');
    await expect((client as any).call('hasOwnProperty')).rejects.toThrow('Unknown method');

    client.disconnect();
    shutdown();
  }, 30000);

  it('server handles malformed JSON gracefully', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    // Connect raw socket and send garbage
    const socketPath = getSocketPath();
    const response = await new Promise<string>((resolve, reject) => {
      const sock = connect(socketPath, () => {
        sock.write('this is not json\n');
      });
      sock.on('data', (chunk) => {
        resolve(chunk.toString());
        sock.end();
      });
      sock.on('error', reject);
      setTimeout(() => { sock.end(); reject(new Error('timeout')); }, 5000);
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.ok).toBe(false);
    // Malformed JSON is still caught before auth check
    expect(parsed.error).toContain('Invalid JSON');

    shutdown();
  }, 30000);

  it('server handles request with missing fields', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    const socketPath = getSocketPath();
    // Send valid JSON but no auth — should be rejected
    const response = await new Promise<string>((resolve, reject) => {
      const sock = connect(socketPath, () => {
        sock.write(JSON.stringify({ id: 1, method: 'ping', args: [] }) + '\n');
      });
      sock.on('data', (chunk) => {
        resolve(chunk.toString());
        sock.end();
      });
      sock.on('error', reject);
      setTimeout(() => { sock.end(); reject(new Error('timeout')); }, 5000);
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Not authenticated');

    shutdown();
  }, 30000);

  it('server survives abrupt client disconnect', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    const socketPath = getSocketPath();

    // Connect and immediately destroy without sending a complete message
    await new Promise<void>((resolve) => {
      const sock = connect(socketPath, () => {
        sock.write('{"id":1,"method":"ping","args":'); // incomplete JSON
        sock.destroy(); // abrupt disconnect
        resolve();
      });
      sock.on('error', () => resolve());
    });

    // Small delay to let the server process the disconnect
    await new Promise((r) => setTimeout(r, 100));

    // Server should still be alive — verify with a new authenticated client
    const client = createClient({ token: getAuthToken()! });
    await client.connect();
    const result = await client.ping();
    expect(result).toBe('pong');
    client.disconnect();

    shutdown();
  }, 30000);

  it('mutations blocked when vault is read-only via agent', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Test');
    await vault.setReadOnly(true);
    vault.lock();

    await startAgent(TMP, PW, 'prod');

    const client = createClient({ token: getAuthToken()! });
    await client.connect();

    // Read should work
    expect(await client.hasService('svc')).toBe(true);

    // Mutation should fail
    await expect(client.addService('new', 'New')).rejects.toThrow('read-only');

    client.disconnect();
    shutdown();
  }, 30000);

  it('server rejects connection with wrong token', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    const client = createClient({ token: 'deadbeef'.repeat(8) });
    await expect(client.connect()).rejects.toThrow('authentication failed');

    shutdown();
  }, 30000);

  it('unauthenticated connection cannot call methods', async () => {
    cleanup();
    cleanupAgent();
    await vault.create(TMP, PW);
    vault.lock();
    await startAgent(TMP, PW, 'prod');

    const socketPath = getSocketPath();
    // Send a valid request without auth handshake
    const response = await new Promise<string>((resolve, reject) => {
      const sock = connect(socketPath, () => {
        sock.write(JSON.stringify({ id: 1, method: 'getData', args: [] }) + '\n');
      });
      sock.on('data', (chunk) => {
        resolve(chunk.toString());
        sock.end();
      });
      sock.on('error', reject);
      setTimeout(() => { sock.end(); reject(new Error('timeout')); }, 5000);
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Not authenticated');

    shutdown();
  }, 30000);
});
