import { describe, it, expect } from 'vitest';
import { createEmpty } from '../../js/models/vault-schema.js';
import { resolveSecrets, generateEnv } from '../../js/services/env-generator.js';

function makeVault() {
  const data = createEmpty();
  data.services = { pg: { label: 'PostgreSQL', comment: '' }, redis: { label: 'Redis', comment: '' } };
  data.environments = ['prod', 'dev'];
  data.secrets = {
    pg: {
      url: { secret: true, values: { _global: 'postgres://global', prod: 'postgres://prod' } },
      password: { secret: true, values: { _global: 'globalpass' } },
    },
    redis: {
      host: { secret: false, values: { _global: 'redis-global' } },
    },
  };
  data.templates = {
    main: {
      DATABASE_URL: '${pg.url}',
      DB_PASS: '${pg.password}',
      REDIS_HOST: '${redis.host}',
      ENV_NAME: '${_ENV_NAME}',
      STATIC_VAL: 'hardcoded',
    },
  };
  return data;
}

describe('resolveSecrets', () => {
  it('resolves global secrets', () => {
    const data = makeVault();
    const resolved = resolveSecrets(data, 'dev');
    expect(resolved.pg.url).toBe('postgres://global');
    expect(resolved.redis.host).toBe('redis-global');
  });

  it('env secrets override global', () => {
    const data = makeVault();
    const resolved = resolveSecrets(data, 'prod');
    expect(resolved.pg.url).toBe('postgres://prod');
    expect(resolved.pg.password).toBe('globalpass'); // not overridden
  });

  it('returns empty for env with no secrets', () => {
    const data = createEmpty();
    expect(resolveSecrets(data, 'nope')).toEqual({});
  });
});

describe('generateEnv', () => {
  it('resolves service references', () => {
    const data = makeVault();
    const { output } = generateEnv(data, 'prod');
    expect(output).toContain('DATABASE_URL=postgres://prod');
    expect(output).toContain('DB_PASS=globalpass');
    expect(output).toContain('REDIS_HOST=redis-global');
  });

  it('resolves magic variables', () => {
    const { output } = generateEnv(makeVault(), 'prod');
    expect(output).toContain('ENV_NAME=prod');
  });

  it('passes through hardcoded values', () => {
    const { output } = generateEnv(makeVault(), 'prod');
    expect(output).toContain('STATIC_VAL=hardcoded');
  });

  it('warns on unresolved references', () => {
    const data = makeVault();
    data.templates.main.MISSING = '${mongo.uri}';
    const { output, warnings } = generateEnv(data, 'prod');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unresolved');
    expect(output).toContain('MISSING=');
  });

  it('warns on invalid reference format', () => {
    const data = makeVault();
    data.templates.main.BAD = '${noDotHere}';
    const { warnings } = generateEnv(data, 'prod');
    expect(warnings.some(w => w.includes('invalid reference'))).toBe(true);
  });

  it('returns empty for missing template', () => {
    const data = createEmpty();
    data.templates = {};
    const { output, warnings } = generateEnv(data, 'staging');
    expect(output).toBe('');
    expect(warnings).toEqual([]);
  });

  it('ends with newline', () => {
    const { output } = generateEnv(makeVault(), 'prod');
    expect(output.endsWith('\n')).toBe(true);
  });
});
