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
  data.secrets.envs = { prod: { pg: { url: { value: 'x', secret: true } } }, dev: {} };
  data.templates = { prod: { DB: '${pg.url}' }, dev: {} };
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
    it('initializes meta, secrets, and templates', () => {
      const data = makeVault();
      addEnvironment(data, 'staging', 'Staging env');
      expect(data.environmentMeta.staging.comment).toBe('Staging env');
      expect(data.secrets.envs.staging).toEqual({});
      expect(data.templates.staging).toEqual({});
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
    it('moves secrets', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.secrets.envs.production).toBeDefined();
      expect(data.secrets.envs.prod).toBeUndefined();
    });
    it('moves templates', () => {
      const data = makeVault();
      renameEnvironment(data, 'prod', 'production');
      expect(data.templates.production).toBeDefined();
      expect(data.templates.prod).toBeUndefined();
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
    it('removes secrets, templates, and meta', () => {
      const data = makeVault();
      deleteEnvironment(data, 'prod');
      expect(data.secrets.envs.prod).toBeUndefined();
      expect(data.templates.prod).toBeUndefined();
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
