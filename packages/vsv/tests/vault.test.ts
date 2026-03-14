import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import * as vault from '../src/vault';

const TMP = '/tmp/test-vsv-vault.vsv';

function cleanup() {
  vault.lock();
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

describe('vault (Node.js pure)', () => {
  afterEach(cleanup);

  describe('create', () => {
    it('creates a new vault file', async () => {
      const data = await vault.create(TMP, 'password');
      expect(data.version).toBe(1);
      expect(data.services).toEqual({});
      expect(data.secrets).toEqual({});
      expect(existsSync(TMP)).toBe(true);
    });

    it('vault is unlocked after create', async () => {
      await vault.create(TMP, 'password');
      expect(vault.isUnlocked()).toBe(true);
      expect(vault.getPath()).toBe(TMP);
    });
  });

  describe('open', () => {
    it('opens an existing vault', async () => {
      await vault.create(TMP, 'mypassword');
      vault.lock();
      expect(vault.isUnlocked()).toBe(false);

      const data = await vault.open(TMP, 'mypassword');
      expect(vault.isUnlocked()).toBe(true);
      expect(data.version).toBe(1);
    });

    it('fails with wrong password', async () => {
      await vault.create(TMP, 'correct');
      vault.lock();
      await expect(vault.open(TMP, 'wrong')).rejects.toThrow();
    });
  });

  describe('persist', () => {
    it('saves modifications to disk', async () => {
      await vault.create(TMP, 'pw');
      const data = vault.getData();
      data.services['api'] = { label: 'API', comment: '' };
      data.secrets['api'] = {
        key: { secret: true, values: { prod: 'secret-value' } },
      };
      await vault.persist();
      vault.lock();

      const reopened = await vault.open(TMP, 'pw');
      expect(reopened.services['api']?.label).toBe('API');
      expect(reopened.secrets['api']?.['key']?.values['prod']).toBe('secret-value');
    });
  });

  describe('lock', () => {
    it('clears all state', async () => {
      await vault.create(TMP, 'pw');
      vault.lock();
      expect(vault.isUnlocked()).toBe(false);
      expect(vault.getPath()).toBeNull();
    });

    it('getData throws after lock', async () => {
      await vault.create(TMP, 'pw');
      vault.lock();
      expect(() => vault.getData()).toThrow('not open');
    });
  });

  describe('read-only', () => {
    it('persist throws when vault is read-only', async () => {
      await vault.create(TMP, 'pw');
      await vault.setReadOnly(true);
      vault.lock();

      await vault.open(TMP, 'pw');
      expect(vault.isReadOnly()).toBe(true);
      await expect(vault.addService('api', 'API')).rejects.toThrow('read-only');
    });

    it('setReadOnly can toggle off', async () => {
      await vault.create(TMP, 'pw');
      await vault.setReadOnly(true);
      await vault.setReadOnly(false);
      expect(vault.isReadOnly()).toBe(false);
      await vault.addService('api', 'API');
      expect(vault.hasService('api')).toBe(true);
    });

    it('isReadOnly returns false for fresh vault', async () => {
      await vault.create(TMP, 'pw');
      expect(vault.isReadOnly()).toBe(false);
    });

    it('changePassword throws when vault is read-only', { timeout: 30000 }, async () => {
      await vault.create(TMP, 'pw');
      await vault.setReadOnly(true);
      vault.lock();

      await vault.open(TMP, 'pw');
      await expect(vault.changePassword('pw', 'newpw')).rejects.toThrow('read-only');
    });

    it('read-only persists across lock/reopen', { timeout: 15000 }, async () => {
      await vault.create(TMP, 'pw');
      await vault.setReadOnly(true);
      vault.lock();

      await vault.open(TMP, 'pw');
      expect(vault.getData().settings.readOnly).toBe(true);
      expect(vault.isReadOnly()).toBe(true);
    });
  });

  describe('cross-compatibility', () => {
    it('vault created by CLI can be re-opened', async () => {
      // Create, modify, persist, lock, re-open — full lifecycle
      await vault.create(TMP, 'lifecycle');
      const data = vault.getData();
      data.environments['staging'] = { comment: 'Staging env' };
      data.services['db'] = { label: 'Database', comment: '' };
      data.secrets['db'] = {
        url: { secret: true, values: { staging: 'postgres://staging', _global: 'postgres://localhost' } },
      };
      data.templates.main = { DATABASE_URL: '${db.url}' };
      await vault.persist();
      vault.lock();

      const reopened = await vault.open(TMP, 'lifecycle');
      expect(reopened.environments['staging']?.comment).toBe('Staging env');
      expect(reopened.secrets['db']?.['url']?.values['staging']).toBe('postgres://staging');
      expect(reopened.templates.main['DATABASE_URL']).toBe('${db.url}');
    });
  });
});
