import { describe, it, expect } from 'vitest';
import { CURRENT_VERSION, DEFAULT_SETTINGS, createEmpty, ensureStructure, migrate } from '../../src/models/vault-schema';

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
      const data = ensureStructure({ settings: {} as any });
      expect(data.settings.autolockMinutes).toBe(DEFAULT_SETTINGS.autolockMinutes);
    });

    it('migrates vault without readOnly setting', () => {
      const data = ensureStructure({ settings: { autolockMinutes: 10 } as any });
      expect(data.settings.readOnly).toBe(false);
    });

    it('preserves existing data', () => {
      const data = ensureStructure({
        services: { pg: { label: 'Postgres', comment: '' } },
        environments: { prod: { comment: '' } },
        secrets: { pg: { url: { secret: true, values: { _global: 'x' } } } },
        templates: { main: { DB: '${pg.url}' } },
      });
      expect(data.services.pg!.label).toBe('Postgres');
      expect(data.environments.prod).toBeDefined();
      expect(data.secrets.pg!.url!.values._global).toBe('x');
      expect(data.templates.main.DB).toBe('${pg.url}');
    });

    it('mutates and returns the same object', () => {
      const obj = {};
      const result = ensureStructure(obj);
      expect(result).toBe(obj);
    });
  });

  describe('migrate', () => {
    it('passes through current version data unchanged', () => {
      const data = { version: CURRENT_VERSION, services: { pg: true } };
      const result = migrate(data);
      expect(result.version).toBe(CURRENT_VERSION);
      expect(result.services).toEqual({ pg: true });
    });

    it('defaults missing version to 1', () => {
      const data = { services: {} };
      const result = migrate(data);
      expect(result).toBeDefined();
    });

    it('rejects vault version newer than supported', () => {
      const data = { version: CURRENT_VERSION + 1 };
      expect(() => migrate(data)).toThrow('newer than supported');
    });

    it('rejects vault version far in the future', () => {
      const data = { version: 999 };
      expect(() => migrate(data)).toThrow('newer than supported');
    });

    it('ensureStructure calls migrate on old data', () => {
      // version 1 with missing fields should still work
      const data = ensureStructure({ version: 1 });
      expect(data.version).toBe(CURRENT_VERSION);
      expect(data.services).toEqual({});
    });

    it('ensureStructure rejects future versions', () => {
      expect(() => ensureStructure({ version: CURRENT_VERSION + 1 } as any)).toThrow('newer than supported');
    });
  });
});
