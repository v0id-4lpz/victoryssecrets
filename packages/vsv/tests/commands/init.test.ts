import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
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

  it('empty vault has default settings', async () => {
    await vault.create(TMP, PW);
    const settings = vault.getSettings();
    expect(settings).toBeDefined();
    expect(settings.readOnly).toBe(false);
  });

  it('empty vault has empty template', async () => {
    await vault.create(TMP, PW);
    const tpl = vault.getTemplate();
    expect(tpl).toEqual({});
  });

  it('lock clears all state', async () => {
    await vault.create(TMP, PW);
    expect(vault.isUnlocked()).toBe(true);
    expect(vault.getPath()).toBe(TMP);

    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    expect(vault.getPath()).toBeNull();
    expect(() => vault.getData()).toThrow('Vault is not open');
  });

  it('persist rejects when vault is not open', async () => {
    await expect(vault.addService('test', 'test')).rejects.toThrow('Vault is not open');
  });

  it('changePassword works', async () => {
    await vault.create(TMP, PW);
    await vault.addService('svc', 'Service');
    await vault.changePassword(PW, 'newpassword123');
    vault.lock();

    // Old password should fail
    await expect(vault.open(TMP, PW)).rejects.toThrow();

    // New password should work
    const data = await vault.open(TMP, 'newpassword123');
    expect(data.services['svc']?.label).toBe('Service');
  }, 30_000);

  it('changePassword rejects wrong current password', async () => {
    await vault.create(TMP, PW);
    await expect(vault.changePassword('wrongpassword', 'newpassword1234')).rejects.toThrow('Wrong password');
  }, 15_000);

  it('readOnly mode blocks mutations', async () => {
    await vault.create(TMP, PW);
    await vault.setReadOnly(true);

    // Reopen to pick up the read-only flag
    vault.lock();
    await vault.open(TMP, PW);
    expect(vault.isReadOnly()).toBe(true);

    await expect(vault.addService('svc', 'Service')).rejects.toThrow('read-only');
  }, 15_000);

  it('readOnly can be toggled off', async () => {
    await vault.create(TMP, PW);
    await vault.setReadOnly(true);
    vault.lock();

    await vault.open(TMP, PW);
    expect(vault.isReadOnly()).toBe(true);

    await vault.setReadOnly(false);
    vault.lock();

    await vault.open(TMP, PW);
    expect(vault.isReadOnly()).toBe(false);
    // Should be able to mutate again
    await vault.addService('svc', 'Service');
    expect(vault.getData().services['svc']).toBeDefined();
  }, 20_000);

  it('vault file is encrypted (not readable as JSON)', async () => {
    await vault.create(TMP, PW);
    await vault.addService('secret-svc', 'Secret Service');
    vault.lock();

    const raw = readFileSync(TMP);
    // Should not contain plaintext service name
    expect(raw.toString()).not.toContain('secret-svc');
    expect(raw.toString()).not.toContain('Secret Service');
  });
});
