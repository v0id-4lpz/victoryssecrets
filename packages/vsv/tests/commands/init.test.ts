import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import * as vault from '../../src/vault';

const TMP = '/tmp/test-vsv-init.vsv';
const PW = 'testpassword1234';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

describe('init command logic', () => {
  afterEach(cleanup);

  it('creates a new vault file', async () => {
    expect(existsSync(TMP)).toBe(false);
    await vault.create(TMP, PW);
    expect(existsSync(TMP)).toBe(true);
    expect(vault.isUnlocked()).toBe(true);

    const data = vault.getData();
    expect(data.version).toBe(1);
    expect(Object.keys(data.services)).toEqual([]);
    expect(Object.keys(data.environments)).toEqual([]);
    expect(Object.keys(data.secrets)).toEqual([]);
  });

  it('created vault can be reopened', async () => {
    await vault.create(TMP, PW);
    vault.lock();

    const data = await vault.open(TMP, PW);
    expect(data.version).toBe(1);
  });

  it('created vault rejects wrong password', async () => {
    await vault.create(TMP, PW);
    vault.lock();

    await expect(vault.open(TMP, 'wrongpassword')).rejects.toThrow();
  });
});
