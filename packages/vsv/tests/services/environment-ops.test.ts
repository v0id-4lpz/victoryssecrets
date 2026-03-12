import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../src/models/vault-schema';
import {
  hasEnvironment, addEnvironment, renameEnvironment,
  deleteEnvironment, setEnvironmentComment, getEnvironmentComment,
  getEnvironmentIds,
} from '../../src/services/environment-ops';
import type { VaultData } from '../../src/types/vault';

function makeVault(): VaultData {
  const data = createEmpty();
  data.environments = { prod: { comment: 'Production' }, dev: { comment: '' } };
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'postgres://local', prod: 'postgres://prod', dev: 'postgres://dev' } },
    },
  };
  return data;
}

describe('environment-ops', () => {
  describe('getEnvironmentIds', () => {
    it('returns env ids', () => {
      expect(getEnvironmentIds(makeVault())).toEqual(['prod', 'dev']);
    });
  });

  describe('hasEnvironment', () => {
    it('returns true for existing env', () => {
      expect(hasEnvironment(makeVault(), 'prod')).toBe(true);
    });
    it('returns false for missing env', () => {
      expect(hasEnvironment(makeVault(), 'staging')).toBe(false);
    });
  });

  describe('addEnvironment', () => {
    it('adds the env', () => {
      const data = makeVault();
      addEnvironment(data, 'staging', 'Staging env');
      expect(data.environments.staging).toBeDefined();
    });
    it('initializes comment', () => {
      const data = makeVault();
      addEnvironment(data, 'staging', 'Staging env');
      expect(data.environments.staging!.comment).toBe('Staging env');
    });
    it('throws on duplicate', () => {
      expect(() => addEnvironment(makeVault(), 'prod')).toThrow('already exists');
    });
  });

  describe('renameEnvironment', () => {
    it('renames the env', () => {
      const data = makeVault();
      renameEnvironment(data, 'dev', 'development');
      expect(data.environments.development).toBeDefined();
      expect(data.environments.dev).toBeUndefined();
    });
    it('renames env key in secret values', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.secrets.pg!.url!.values.production).toBe('postgres://prod');
      expect(data.secrets.pg!.url!.values.prod).toBeUndefined();
    });
    it('moves comment', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.environments.production!.comment).toBe('Production');
    });
    it('no-ops if newId already exists', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'dev');
      expect(data.environments.prod).toBeDefined();
    });
  });

  describe('deleteEnvironment', () => {
    it('removes the env', () => {
      const data = makeVault();
      deleteEnvironment(data, 'prod');
      expect(data.environments.prod).toBeUndefined();
    });
    it('removes env values from secrets', () => {
      const data = makeVault();
      deleteEnvironment(data, 'prod');
      expect(data.secrets.pg!.url!.values.prod).toBeUndefined();
      expect(data.secrets.pg!.url!.values._global).toBe('postgres://local');
    });
  });

  describe('setEnvironmentComment / getEnvironmentComment', () => {
    it('sets and gets comment', () => {
      const data = makeVault();
      setEnvironmentComment(data, 'dev', 'Development');
      expect(getEnvironmentComment(data, 'dev')).toBe('Development');
    });
    it('returns empty string for missing env', () => {
      expect(getEnvironmentComment(createEmpty(), 'nope')).toBe('');
    });
    it('creates env entry if missing', () => {
      const data = createEmpty();
      setEnvironmentComment(data, 'test', 'Hello');
      expect(data.environments.test!.comment).toBe('Hello');
    });
  });
});
