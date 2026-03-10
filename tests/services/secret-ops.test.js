import { describe, it, expect } from 'vitest';
import { createEmpty, GLOBAL_ENV } from '../../js/models/vault-schema.js';
import {
  getAllSecrets, getSecret, setSecret, setSecretValue, setSecretFlag,
  deleteSecret, deleteSecretValue, moveSecret, resolveValue,
} from '../../js/services/secret-ops.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: '' }, redis: { label: 'Redis', comment: '' } };
  data.environments = { prod: { comment: '' } };
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'postgres://localhost', prod: 'postgres://prod' } },
      password: { secret: true, values: { _global: 's3cret' } },
    },
    redis: {
      host: { secret: false, values: { _global: 'redis-local', prod: 'redis.prod' } },
    },
  };
  data.templates = { main: { DATABASE_URL: '${pg.url}', REDIS: '${redis.host}' } };
  return data;
}

describe('secret-ops', () => {
  describe('getAllSecrets', () => {
    it('returns all secrets', () => {
      const data = makeVault();
      const all = getAllSecrets(data);
      expect(all.pg.url.secret).toBe(true);
      expect(all.redis.host.secret).toBe(false);
    });
  });

  describe('getSecret', () => {
    it('returns a specific secret entry', () => {
      const data = makeVault();
      const entry = getSecret(data, 'pg', 'url');
      expect(entry.secret).toBe(true);
      expect(entry.values._global).toBe('postgres://localhost');
    });
    it('returns null for missing secret', () => {
      expect(getSecret(makeVault(), 'pg', 'nonexistent')).toBeNull();
    });
  });

  describe('setSecret', () => {
    it('creates a new secret', () => {
      const data = makeVault();
      setSecret(data, 'pg', 'port', { secret: false, values: { _global: '5432' } });
      expect(data.secrets.pg.port).toEqual({ secret: false, values: { _global: '5432' } });
    });
    it('creates service bucket if missing', () => {
      const data = makeVault();
      setSecret(data, 'mongo', 'uri', { secret: true, values: { _global: 'mongodb://...' } });
      expect(data.secrets.mongo.uri.values._global).toBe('mongodb://...');
    });
    it('overwrites existing', () => {
      const data = makeVault();
      setSecret(data, 'pg', 'url', { secret: false, values: { _global: 'new' } });
      expect(data.secrets.pg.url.secret).toBe(false);
      expect(data.secrets.pg.url.values._global).toBe('new');
    });
  });

  describe('setSecretValue', () => {
    it('sets value for a specific env', () => {
      const data = makeVault();
      setSecretValue(data, 'pg', 'url', 'dev', 'postgres://dev');
      expect(data.secrets.pg.url.values.dev).toBe('postgres://dev');
    });
    it('does nothing for missing secret', () => {
      const data = makeVault();
      setSecretValue(data, 'pg', 'nonexistent', 'dev', 'x');
      expect(data.secrets.pg.nonexistent).toBeUndefined();
    });
  });

  describe('setSecretFlag', () => {
    it('updates the secret flag', () => {
      const data = makeVault();
      setSecretFlag(data, 'pg', 'url', false);
      expect(data.secrets.pg.url.secret).toBe(false);
    });
  });

  describe('deleteSecret', () => {
    it('removes a field', () => {
      const data = makeVault();
      deleteSecret(data, 'pg', 'password');
      expect(data.secrets.pg.password).toBeUndefined();
      expect(data.secrets.pg.url).toBeDefined();
    });
    it('removes the service bucket when last field deleted', () => {
      const data = makeVault();
      deleteSecret(data, 'redis', 'host');
      expect(data.secrets.redis).toBeUndefined();
    });
  });

  describe('deleteSecretValue', () => {
    it('removes value for a specific env', () => {
      const data = makeVault();
      deleteSecretValue(data, 'pg', 'url', 'prod');
      expect(data.secrets.pg.url.values.prod).toBeUndefined();
      expect(data.secrets.pg.url.values._global).toBe('postgres://localhost');
    });
  });

  describe('moveSecret', () => {
    it('moves a secret to a new field name', () => {
      const data = makeVault();
      moveSecret(data, 'pg', 'url', 'pg', 'connection_url');
      expect(data.secrets.pg.url).toBeUndefined();
      expect(data.secrets.pg.connection_url.values._global).toBe('postgres://localhost');
    });
    it('moves a secret to a different service', () => {
      const data = makeVault();
      moveSecret(data, 'pg', 'url', 'postgres', 'url');
      expect(data.secrets.pg.url).toBeUndefined();
      expect(data.secrets.postgres.url.values._global).toBe('postgres://localhost');
    });
    it('refactors template references', () => {
      const data = makeVault();
      moveSecret(data, 'pg', 'url', 'pg', 'connection_string');
      expect(data.templates.main.DATABASE_URL).toBe('${pg.connection_string}');
    });
    it('cleans up empty service bucket after move', () => {
      const data = makeVault();
      deleteSecret(data, 'redis', 'host'); // already tested
      // Now only pg remains — move last pg field
      deleteSecret(data, 'pg', 'password');
      moveSecret(data, 'pg', 'url', 'postgres', 'url');
      expect(data.secrets.pg).toBeUndefined();
    });
    it('no-ops if source does not exist', () => {
      const data = makeVault();
      moveSecret(data, 'pg', 'nonexistent', 'pg', 'other');
      expect(data.secrets.pg.url).toBeDefined();
    });
  });

  describe('resolveValue', () => {
    it('returns env value when present', () => {
      const entry = { secret: true, values: { _global: 'default', prod: 'prod-val' } };
      expect(resolveValue(entry, 'prod')).toBe('prod-val');
    });
    it('falls back to global when env value missing', () => {
      const entry = { secret: true, values: { _global: 'default' } };
      expect(resolveValue(entry, 'prod')).toBe('default');
    });
    it('falls back to global when env value is empty string', () => {
      const entry = { secret: true, values: { _global: 'default', prod: '' } };
      expect(resolveValue(entry, 'prod')).toBe('default');
    });
    it('returns undefined when no values', () => {
      expect(resolveValue(null, 'prod')).toBeUndefined();
    });
  });
});
