import { describe, it, expect } from 'vitest';
import { CURRENT_VERSION, DEFAULT_SETTINGS, createEmpty, ensureStructure } from '../../js/models/vault-schema.js';

describe('vault-schema', () => {
  describe('createEmpty', () => {
    it('returns a vault with current version', () => {
      const v = createEmpty();
      expect(v.version).toBe(CURRENT_VERSION);
    });

    it('has empty services object', () => {
      expect(createEmpty().services).toEqual({});
    });

    it('has empty environments object', () => {
      expect(createEmpty().environments).toEqual({});
    });

    it('has empty secrets object', () => {
      expect(createEmpty().secrets).toEqual({});
    });

    it('has templates with empty main', () => {
      expect(createEmpty().templates).toEqual({ main: {} });
    });

    it('has default settings', () => {
      const v = createEmpty();
      expect(v.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('ensureStructure', () => {
    it('fills missing fields on empty object', () => {
      const data = ensureStructure({});
      expect(data.services).toEqual({});
      expect(data.environments).toEqual({});
      expect(data.secrets).toEqual({});
      expect(data.templates).toEqual({ main: {} });
      expect(data.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('fills missing settings fields on partial settings', () => {
      const data = ensureStructure({ settings: {} });
      expect(data.settings.autolockMinutes).toBe(DEFAULT_SETTINGS.autolockMinutes);
    });

    it('preserves existing data', () => {
      const data = ensureStructure({
        services: { pg: { label: 'Postgres' } },
        environments: { prod: { comment: '' } },
        secrets: { pg: { url: { secret: true, values: { _global: 'x' } } } },
        templates: { main: { DB: '${pg.url}' } },
      });
      expect(data.services.pg.label).toBe('Postgres');
      expect(data.environments.prod).toBeDefined();
      expect(data.secrets.pg.url.values._global).toBe('x');
      expect(data.templates.main.DB).toBe('${pg.url}');
    });

    it('mutates and returns the same object', () => {
      const obj = {};
      const result = ensureStructure(obj);
      expect(result).toBe(obj);
    });
  });
});
