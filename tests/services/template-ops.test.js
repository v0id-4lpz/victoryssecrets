import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import {
  setTemplateEntry, deleteTemplateEntry, clearTemplate, getTemplate,
  parseEnvFile, buildServiceFieldTree,
} from '../../js/services/template-ops.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: '' } };
  data.environments = ['prod'];
  data.secrets.global = { pg: { url: { value: 'x', secret: true }, password: { value: 'y', secret: true } } };
  data.secrets.envs = { prod: { pg: { host: { value: 'db.prod', secret: false } } } };
  data.templates = { prod: { DATABASE_URL: '${pg.url}' } };
  return data;
}

describe('template-ops CRUD', () => {
  describe('setTemplateEntry', () => {
    it('sets a new entry', () => {
      const data = makeVault();
      setTemplateEntry(data, 'prod', 'REDIS', '${redis.host}');
      expect(data.templates.prod.REDIS).toBe('${redis.host}');
    });
    it('creates env bucket if missing', () => {
      const data = makeVault();
      setTemplateEntry(data, 'dev', 'KEY', 'value');
      expect(data.templates.dev.KEY).toBe('value');
    });
    it('overwrites existing entry', () => {
      const data = makeVault();
      setTemplateEntry(data, 'prod', 'DATABASE_URL', '${pg.connection}');
      expect(data.templates.prod.DATABASE_URL).toBe('${pg.connection}');
    });
  });

  describe('deleteTemplateEntry', () => {
    it('removes an entry', () => {
      const data = makeVault();
      deleteTemplateEntry(data, 'prod', 'DATABASE_URL');
      expect(data.templates.prod.DATABASE_URL).toBeUndefined();
    });
    it('does nothing for missing key', () => {
      const data = makeVault();
      deleteTemplateEntry(data, 'prod', 'NONEXISTENT');
      expect(Object.keys(data.templates.prod)).toHaveLength(1);
    });
  });

  describe('clearTemplate', () => {
    it('empties the template', () => {
      const data = makeVault();
      clearTemplate(data, 'prod');
      expect(data.templates.prod).toEqual({});
    });
    it('does nothing for missing env', () => {
      const data = makeVault();
      clearTemplate(data, 'staging');
      expect(data.templates.staging).toBeUndefined();
    });
  });

  describe('getTemplate', () => {
    it('returns the template object', () => {
      const data = makeVault();
      expect(getTemplate(data, 'prod')).toEqual({ DATABASE_URL: '${pg.url}' });
    });
    it('returns empty object for missing env', () => {
      expect(getTemplate(makeVault(), 'staging')).toEqual({});
    });
  });
});

describe('parseEnvFile', () => {
  it('parses standard .env lines', () => {
    const text = 'DATABASE_URL=postgres://...\nREDIS_HOST=localhost\n';
    expect(parseEnvFile(text)).toEqual(['DATABASE_URL', 'REDIS_HOST']);
  });
  it('skips comments and empty lines', () => {
    const text = '# comment\n\nKEY=value\n  \n# another\nOTHER=x';
    expect(parseEnvFile(text)).toEqual(['KEY', 'OTHER']);
  });
  it('handles Windows line endings', () => {
    const text = 'A=1\r\nB=2\r\n';
    expect(parseEnvFile(text)).toEqual(['A', 'B']);
  });
  it('ignores lines without = sign', () => {
    const text = 'VALID=yes\ninvalid line\nALSO_VALID=ok';
    expect(parseEnvFile(text)).toEqual(['VALID', 'ALSO_VALID']);
  });
  it('returns empty for empty string', () => {
    expect(parseEnvFile('')).toEqual([]);
  });
  it('rejects keys starting with numbers', () => {
    const text = '123BAD=x\nGOOD=y';
    expect(parseEnvFile(text)).toEqual(['GOOD']);
  });
});

describe('buildServiceFieldTree', () => {
  it('collects fields from global and env secrets', () => {
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
