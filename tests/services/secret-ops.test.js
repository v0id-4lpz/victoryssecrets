import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import {
  getSecretsAtLevel, setSecret, deleteSecret, moveSecret,
} from '../../js/services/secret-ops.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: '' }, redis: { label: 'Redis', comment: '' } };
  data.secrets.global = {
    pg: { url: { value: 'postgres://localhost', secret: true }, password: { value: 's3cret', secret: true } },
  };
  data.secrets.envs = { prod: { redis: { host: { value: 'redis.prod', secret: false } } } };
  data.templates = { prod: { DATABASE_URL: '${pg.url}', REDIS: '${redis.host}' } };
  return data;
}

describe('secret-ops', () => {
  describe('getSecretsAtLevel', () => {
    it('returns global secrets', () => {
      const data = makeVault();
      const result = getSecretsAtLevel(data, { scope: 'global' });
      expect(result.pg.url.value).toBe('postgres://localhost');
    });
    it('returns env secrets', () => {
      const data = makeVault();
      const result = getSecretsAtLevel(data, { scope: 'env', envId: 'prod' });
      expect(result.redis.host.value).toBe('redis.prod');
    });
    it('creates env bucket if missing', () => {
      const data = makeVault();
      const result = getSecretsAtLevel(data, { scope: 'env', envId: 'staging' });
      expect(result).toEqual({});
      expect(data.secrets.envs.staging).toEqual({});
    });
    it('returns empty object for unknown scope', () => {
      expect(getSecretsAtLevel(makeVault(), { scope: 'unknown' })).toEqual({});
    });
  });

  describe('setSecret', () => {
    it('sets a global secret', () => {
      const data = makeVault();
      setSecret(data, { scope: 'global' }, 'pg', 'port', '5432', false);
      expect(data.secrets.global.pg.port).toEqual({ value: '5432', secret: false });
    });
    it('sets an env secret', () => {
      const data = makeVault();
      setSecret(data, { scope: 'env', envId: 'prod' }, 'pg', 'host', 'db.prod', true);
      expect(data.secrets.envs.prod.pg.host).toEqual({ value: 'db.prod', secret: true });
    });
    it('creates service bucket if missing', () => {
      const data = makeVault();
      setSecret(data, { scope: 'global' }, 'mongo', 'uri', 'mongodb://...', true);
      expect(data.secrets.global.mongo.uri.value).toBe('mongodb://...');
    });
  });

  describe('deleteSecret', () => {
    it('removes a field', () => {
      const data = makeVault();
      deleteSecret(data, { scope: 'global' }, 'pg', 'password');
      expect(data.secrets.global.pg.password).toBeUndefined();
      expect(data.secrets.global.pg.url).toBeDefined(); // other field preserved
    });
    it('removes the service bucket when last field deleted', () => {
      const data = makeVault();
      deleteSecret(data, { scope: 'env', envId: 'prod' }, 'redis', 'host');
      expect(data.secrets.envs.prod.redis).toBeUndefined();
    });
  });

  describe('moveSecret', () => {
    it('moves a secret to a new field name', () => {
      const data = makeVault();
      moveSecret(data, { scope: 'global' }, 'pg', 'url', 'pg', 'connection_url');
      expect(data.secrets.global.pg.url).toBeUndefined();
      expect(data.secrets.global.pg.connection_url.value).toBe('postgres://localhost');
    });
    it('moves a secret to a different service', () => {
      const data = makeVault();
      moveSecret(data, { scope: 'global' }, 'pg', 'url', 'postgres', 'url');
      expect(data.secrets.global.pg.url).toBeUndefined();
      expect(data.secrets.global.postgres.url.value).toBe('postgres://localhost');
    });
    it('refactors template references', () => {
      const data = makeVault();
      moveSecret(data, { scope: 'global' }, 'pg', 'url', 'pg', 'connection_string');
      expect(data.templates.prod.DATABASE_URL).toBe('${pg.connection_string}');
    });
    it('cleans up empty service bucket after move', () => {
      const data = makeVault();
      deleteSecret(data, { scope: 'global' }, 'pg', 'password'); // leave only url
      moveSecret(data, { scope: 'global' }, 'pg', 'url', 'postgres', 'url');
      expect(data.secrets.global.pg).toBeUndefined();
    });
    it('no-ops if source does not exist', () => {
      const data = makeVault();
      moveSecret(data, { scope: 'global' }, 'pg', 'nonexistent', 'pg', 'other');
      expect(data.secrets.global.pg.url).toBeDefined(); // unchanged
    });
  });
});
