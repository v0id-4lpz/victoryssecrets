import { describe, it, expect } from 'vitest';
import { CURRENT_VERSION, createEmpty, ensureStructure } from '../../js/models/vault-schema.js';

describe('vault-schema', () => {
  describe('createEmpty', () => {
    it('returns a vault with current version', () => {
      const v = createEmpty();
      expect(v.version).toBe(CURRENT_VERSION);
    });

    it('has empty services object', () => {
      expect(createEmpty().services).toEqual({});
    });

    it('has empty environments array', () => {
      expect(createEmpty().environments).toEqual([]);
    });

    it('has empty environmentMeta', () => {
      expect(createEmpty().environmentMeta).toEqual({});
    });

    it('has secrets with global and envs', () => {
      const v = createEmpty();
      expect(v.secrets).toEqual({ global: {}, envs: {} });
    });

    it('has empty templates', () => {
      expect(createEmpty().templates).toEqual({});
    });
  });

  describe('ensureStructure', () => {
    it('fills missing fields on empty object', () => {
      const data = ensureStructure({});
      expect(data.services).toEqual({});
      expect(data.environments).toEqual([]);
      expect(data.environmentMeta).toEqual({});
      expect(data.secrets).toEqual({ global: {}, envs: {} });
      expect(data.templates).toEqual({});
    });

    it('preserves existing data', () => {
      const data = ensureStructure({
        services: { pg: { label: 'Postgres' } },
        environments: ['prod'],
        secrets: { global: { pg: { url: { value: 'x', secret: true } } }, envs: {} },
        templates: { prod: { DB: '${pg.url}' } },
      });
      expect(data.services.pg.label).toBe('Postgres');
      expect(data.environments).toEqual(['prod']);
      expect(data.secrets.global.pg.url.value).toBe('x');
      expect(data.templates.prod.DB).toBe('${pg.url}');
    });

    it('fills missing secrets sub-fields', () => {
      const data = ensureStructure({ secrets: {} });
      expect(data.secrets.global).toEqual({});
      expect(data.secrets.envs).toEqual({});
    });

    it('mutates and returns the same object', () => {
      const obj = {};
      const result = ensureStructure(obj);
      expect(result).toBe(obj);
    });
  });
});
