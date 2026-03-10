import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import {
  hasService, addService, deleteService,
  renameServiceLabel, renameServiceId, setServiceComment,
} from '../../js/services/service-ops.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: 'Main DB' }, redis: { label: 'Redis', comment: '' } };
  data.environments = ['prod'];
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'postgres://...' } },
      password: { secret: true, values: { prod: 's3cret' } },
    },
  };
  data.templates = { main: { DATABASE_URL: '${pg.url}', REDIS: '${redis.host}' } };
  return data;
}

describe('service-ops', () => {
  describe('hasService', () => {
    it('returns true for existing service', () => {
      expect(hasService(makeVault(), 'pg')).toBe(true);
    });
    it('returns false for missing service', () => {
      expect(hasService(makeVault(), 'mongo')).toBe(false);
    });
  });

  describe('addService', () => {
    it('adds a new service', () => {
      const data = makeVault();
      addService(data, 'mongo', 'MongoDB', 'NoSQL');
      expect(data.services.mongo).toEqual({ label: 'MongoDB', comment: 'NoSQL' });
    });
    it('throws on duplicate', () => {
      expect(() => addService(makeVault(), 'pg', 'PG')).toThrow('already exists');
    });
    it('defaults comment to empty string', () => {
      const data = makeVault();
      addService(data, 'mongo', 'MongoDB');
      expect(data.services.mongo.comment).toBe('');
    });
  });

  describe('deleteService', () => {
    it('removes the service', () => {
      const data = makeVault();
      deleteService(data, 'pg');
      expect(data.services.pg).toBeUndefined();
    });
    it('cleans up secrets', () => {
      const data = makeVault();
      deleteService(data, 'pg');
      expect(data.secrets.pg).toBeUndefined();
    });
    it('removes single-ref template entries for the service', () => {
      const data = createEmpty();
      data.services = { pg: { label: 'PG', comment: '' } };
      data.secrets = { pg: { url: { secret: true, values: { _global: 'x' } } } };
      data.templates = { main: { DB: '${pg.url}', OTHER: 'static' } };
      deleteService(data, 'pg');
      expect(data.templates.main.DB).toBeUndefined();
      expect(data.templates.main.OTHER).toBe('static');
    });
  });

  describe('renameServiceLabel', () => {
    it('updates the label', () => {
      const data = makeVault();
      renameServiceLabel(data, 'pg', 'Postgres DB');
      expect(data.services.pg.label).toBe('Postgres DB');
    });
    it('does nothing for missing service', () => {
      const data = makeVault();
      renameServiceLabel(data, 'mongo', 'MongoDB');
      expect(data.services.mongo).toBeUndefined();
    });
  });

  describe('renameServiceId', () => {
    it('moves the service entry', () => {
      const data = makeVault();
      renameServiceId(data, 'pg', 'postgres');
      expect(data.services.postgres).toBeDefined();
      expect(data.services.pg).toBeUndefined();
    });
    it('moves secrets', () => {
      const data = makeVault();
      renameServiceId(data, 'pg', 'postgres');
      expect(data.secrets.postgres).toBeDefined();
      expect(data.secrets.pg).toBeUndefined();
    });
    it('refactors template references', () => {
      const data = makeVault();
      renameServiceId(data, 'pg', 'postgres');
      expect(data.templates.main.DATABASE_URL).toBe('${postgres.url}');
    });
    it('throws on conflicting newId', () => {
      expect(() => renameServiceId(makeVault(), 'pg', 'redis')).toThrow('already exists');
    });
    it('no-ops when oldId === newId', () => {
      const data = makeVault();
      renameServiceId(data, 'pg', 'pg');
      expect(data.services.pg).toBeDefined();
    });
  });

  describe('setServiceComment', () => {
    it('updates the comment', () => {
      const data = makeVault();
      setServiceComment(data, 'pg', 'Updated comment');
      expect(data.services.pg.comment).toBe('Updated comment');
    });
  });
});
