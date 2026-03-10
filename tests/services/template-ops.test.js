import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import {
  setTemplateEntry, deleteTemplateEntry, clearTemplate, getTemplate,
  parseTemplateText, serializeTemplate, replaceTemplate, mergeTemplate,
  buildServiceFieldTree,
} from '../../js/services/template-ops.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: '' } };
  data.environments = { prod: { comment: '' } };
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'x' } },
      password: { secret: true, values: { _global: 'y' } },
      host: { secret: false, values: { prod: 'db.prod' } },
    },
  };
  data.templates = { main: { DATABASE_URL: '${pg.url}' } };
  return data;
}

describe('template-ops CRUD', () => {
  describe('setTemplateEntry', () => {
    it('sets a new entry', () => {
      const data = makeVault();
      setTemplateEntry(data, 'REDIS', '${redis.host}');
      expect(data.templates.main.REDIS).toBe('${redis.host}');
    });
    it('overwrites existing entry', () => {
      const data = makeVault();
      setTemplateEntry(data, 'DATABASE_URL', '${pg.connection}');
      expect(data.templates.main.DATABASE_URL).toBe('${pg.connection}');
    });
  });

  describe('deleteTemplateEntry', () => {
    it('removes an entry', () => {
      const data = makeVault();
      deleteTemplateEntry(data, 'DATABASE_URL');
      expect(data.templates.main.DATABASE_URL).toBeUndefined();
    });
    it('does nothing for missing key', () => {
      const data = makeVault();
      deleteTemplateEntry(data, 'NONEXISTENT');
      expect(Object.keys(data.templates.main)).toHaveLength(1);
    });
  });

  describe('clearTemplate', () => {
    it('empties the template', () => {
      const data = makeVault();
      clearTemplate(data);
      expect(data.templates.main).toEqual({});
    });
  });

  describe('getTemplate', () => {
    it('returns the template object', () => {
      const data = makeVault();
      expect(getTemplate(data)).toEqual({ DATABASE_URL: '${pg.url}' });
    });
    it('returns empty object for missing template', () => {
      const data = createEmpty();
      data.templates = {};
      expect(getTemplate(data)).toEqual({});
    });
  });
});

describe('parseTemplateText', () => {
  it('parses standard .env lines with values', () => {
    const text = 'DATABASE_URL=postgres://...\nREDIS_HOST=localhost\n';
    expect(parseTemplateText(text)).toEqual({
      DATABASE_URL: 'postgres://...',
      REDIS_HOST: 'localhost',
    });
  });
  it('skips comments and empty lines', () => {
    const text = '# comment\n\nKEY=value\n  \n# another\nOTHER=x';
    expect(parseTemplateText(text)).toEqual({ KEY: 'value', OTHER: 'x' });
  });
  it('handles Windows line endings', () => {
    const text = 'A=1\r\nB=2\r\n';
    expect(parseTemplateText(text)).toEqual({ A: '1', B: '2' });
  });
  it('ignores lines without = sign', () => {
    const text = 'VALID=yes\ninvalid line\nALSO_VALID=ok';
    expect(parseTemplateText(text)).toEqual({ VALID: 'yes', ALSO_VALID: 'ok' });
  });
  it('returns empty for empty string', () => {
    expect(parseTemplateText('')).toEqual({});
  });
  it('rejects keys starting with numbers', () => {
    const text = '123BAD=x\nGOOD=y';
    expect(parseTemplateText(text)).toEqual({ GOOD: 'y' });
  });
  it('preserves values with = signs', () => {
    const text = 'URL=postgres://host:5432/db?ssl=true';
    expect(parseTemplateText(text)).toEqual({ URL: 'postgres://host:5432/db?ssl=true' });
  });
  it('keeps empty values', () => {
    const text = 'EMPTY=\nFILLED=val';
    expect(parseTemplateText(text)).toEqual({ EMPTY: '', FILLED: 'val' });
  });
  it('preserves ${ref} syntax in values', () => {
    const text = 'DB=${pg.url}\nNAME=${_ENV_NAME}';
    expect(parseTemplateText(text)).toEqual({ DB: '${pg.url}', NAME: '${_ENV_NAME}' });
  });
});

describe('serializeTemplate', () => {
  it('serializes template to KEY=value format', () => {
    const tpl = { DATABASE_URL: '${pg.url}', REDIS: 'localhost' };
    expect(serializeTemplate(tpl)).toBe('DATABASE_URL=${pg.url}\nREDIS=localhost');
  });
  it('returns empty string for empty template', () => {
    expect(serializeTemplate({})).toBe('');
  });
  it('handles empty values', () => {
    expect(serializeTemplate({ KEY: '' })).toBe('KEY=');
  });
});

describe('replaceTemplate', () => {
  it('replaces the entire template', () => {
    const data = makeVault();
    replaceTemplate(data, { NEW_KEY: 'new_val' });
    expect(data.templates.main).toEqual({ NEW_KEY: 'new_val' });
  });
});

describe('mergeTemplate', () => {
  it('adds new keys without overwriting existing', () => {
    const data = makeVault();
    mergeTemplate(data, { DATABASE_URL: 'overwrite_attempt', NEW_KEY: 'new_val' });
    expect(data.templates.main.DATABASE_URL).toBe('${pg.url}');
    expect(data.templates.main.NEW_KEY).toBe('new_val');
  });
});

describe('buildServiceFieldTree', () => {
  it('collects fields from secrets', () => {
    const data = makeVault();
    const { fieldsByService } = buildServiceFieldTree(data);
    expect([...fieldsByService.pg]).toContain('url');
    expect([...fieldsByService.pg]).toContain('password');
    expect([...fieldsByService.pg]).toContain('host');
  });
  it('includes services with no secrets', () => {
    const data = createEmpty();
    data.services = { empty: { label: 'Empty', comment: '' } };
    const { fieldsByService } = buildServiceFieldTree(data);
    expect(fieldsByService.empty).toBeDefined();
    expect([...fieldsByService.empty]).toEqual([]);
  });
  it('returns services object', () => {
    const data = makeVault();
    const { services } = buildServiceFieldTree(data);
    expect(services.pg.label).toBe('PostgreSQL');
  });
});
