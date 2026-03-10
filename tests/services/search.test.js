import { describe, it, expect } from 'vitest';
import { buildSearchIndex, filterSearch } from '../../js/services/search.js';

const vaultData = {
  services: {
    pg: { label: 'PostgreSQL', comment: 'Main database' },
    redis: { label: 'Redis', comment: '' },
  },
  environments: { prod: { comment: 'Production' }, dev: { comment: '' } },
  secrets: {
    pg: {
      url: { secret: true, values: { _global: 'postgres://...' } },
      password: { secret: true, values: { _global: 'secret' } },
    },
    redis: {
      host: { secret: false, values: { _global: 'redis-local', prod: 'redis.prod' } },
    },
  },
  templates: {
    main: {
      DATABASE_URL: '${pg.url}',
      REDIS_HOST: '${redis.host}',
    },
  },
};

const getEnvComment = (envId) => envId === 'prod' ? 'Production' : '';

describe('buildSearchIndex', () => {
  const index = buildSearchIndex(vaultData, getEnvComment);

  it('includes services', () => {
    const services = index.filter(i => i.type === 'service');
    expect(services).toHaveLength(2);
    expect(services.find(s => s.id === 'pg').label).toBe('PostgreSQL');
    expect(services.find(s => s.id === 'pg').comment).toBe('Main database');
  });

  it('includes environments', () => {
    const envs = index.filter(i => i.type === 'env');
    expect(envs).toHaveLength(2);
    expect(envs.find(e => e.id === 'prod').comment).toBe('Production');
  });

  it('includes secrets', () => {
    const secrets = index.filter(i => i.type === 'secret');
    expect(secrets).toHaveLength(3);
    expect(secrets.find(s => s.id === 'pg:url')).toBeTruthy();
    expect(secrets.find(s => s.id === 'pg:password')).toBeTruthy();
    expect(secrets.find(s => s.id === 'redis:host')).toBeTruthy();
  });

  it('uses service label in secret display', () => {
    const s = index.find(i => i.id === 'pg:url');
    expect(s.label).toBe('PostgreSQL / url');
  });

  it('includes templates', () => {
    const tpls = index.filter(i => i.type === 'template');
    expect(tpls).toHaveLength(2);
    expect(tpls.find(t => t.id === 'DATABASE_URL')).toBeTruthy();
  });

  it('handles empty vault data', () => {
    const idx = buildSearchIndex({ services: {}, environments: {}, secrets: {}, templates: { main: {} } });
    expect(idx).toEqual([]);
  });
});

describe('filterSearch', () => {
  const index = buildSearchIndex(vaultData, getEnvComment);

  it('returns empty for empty query', () => {
    expect(filterSearch('', index)).toEqual([]);
  });

  it('matches by label', () => {
    const results = filterSearch('postgres', index);
    expect(results.some(r => r.id === 'pg')).toBe(true);
  });

  it('matches by id', () => {
    const results = filterSearch('redis', index);
    expect(results.some(r => r.type === 'service' && r.id === 'redis')).toBe(true);
  });

  it('matches by comment', () => {
    const results = filterSearch('Main database', index);
    expect(results.some(r => r.id === 'pg')).toBe(true);
  });

  it('is case insensitive', () => {
    const results = filterSearch('POSTGRESQL', index);
    expect(results.some(r => r.id === 'pg')).toBe(true);
  });

  it('respects limit', () => {
    const results = filterSearch('p', index, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});
