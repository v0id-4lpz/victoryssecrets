import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import {
  hasEnvironment, addEnvironment, renameEnvironment,
  deleteEnvironment, setEnvironmentComment, getEnvironmentComment,
} from '../../js/services/environment-ops.js';

function makeVault() {
  const data = createEmpty();
  data.environments = ['prod', 'dev'];
  data.environmentMeta = { prod: { comment: 'Production' }, dev: { comment: '' } };
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'postgres://local', prod: 'postgres://prod', dev: 'postgres://dev' } },
    },
  };
  return data;
}

describe('environment-ops', () => {
  describe('hasEnvironment', () => {
    it('returns true for existing env', () => {
      expect(hasEnvironment(makeVault(), 'prod')).toBe(true);
    });
    it('returns false for missing env', () => {
      expect(hasEnvironment(makeVault(), 'staging')).toBe(false);
    });
  });

  describe('addEnvironment', () => {
    it('adds the env to the list', () => {
      const data = makeVault();
      addEnvironment(data, 'staging', 'Staging env');
      expect(data.environments).toContain('staging');
    });
    it('initializes meta', () => {
      const data = makeVault();
      addEnvironment(data, 'staging', 'Staging env');
      expect(data.environmentMeta.staging.comment).toBe('Staging env');
    });
    it('throws on duplicate', () => {
      expect(() => addEnvironment(makeVault(), 'prod')).toThrow('already exists');
    });
  });

  describe('renameEnvironment', () => {
    it('renames the env in the array', () => {
      const data = makeVault();
      renameEnvironment(data, 'dev', 'development');
      expect(data.environments).toContain('development');
      expect(data.environments).not.toContain('dev');
    });
    it('renames env key in secret values', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.secrets.pg.url.values.production).toBe('postgres://prod');
      expect(data.secrets.pg.url.values.prod).toBeUndefined();
    });
    it('moves meta', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.environmentMeta.production.comment).toBe('Production');
    });
    it('no-ops if newId already exists', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'dev');
      expect(data.environments).toContain('prod');
    });
  });

  describe('deleteEnvironment', () => {
    it('removes from array', () => {
      const data = makeVault();
      deleteEnvironment(data, 'prod');
      expect(data.environments).not.toContain('prod');
    });
    it('removes env values from secrets', () => {
      const data = makeVault();
      deleteEnvironment(data, 'prod');
      expect(data.secrets.pg.url.values.prod).toBeUndefined();
      expect(data.secrets.pg.url.values._global).toBe('postgres://local');
    });
  });

  describe('setEnvironmentComment / getEnvironmentComment', () => {
    it('sets and gets comment', () => {
      const data = makeVault();
      setEnvironmentComment(data, 'dev', 'Development');
      expect(getEnvironmentComment(data, 'dev')).toBe('Development');
    });
    it('returns empty string for missing meta', () => {
      expect(getEnvironmentComment(createEmpty(), 'nope')).toBe('');
    });
    it('creates meta structure if missing', () => {
      const data = createEmpty();
      delete data.environmentMeta;
      setEnvironmentComment(data, 'test', 'Hello');
      expect(data.environmentMeta.test.comment).toBe('Hello');
    });
  });
});
