import { describe, it, expect } from 'vitest';
import {
  refactorTemplateRefs,
  refactorServiceId,
  removeServiceRefs,
} from '../../src/models/template-refactor';

import type { Templates } from '../../src/types/vault';

const templates: Templates = {
  main: {
    DB_URL: '${pg.url}/mydb',
    REDIS: '${redis.host}:6379',
    STATIC: 'some-value',
    API_KEY: '${stripe.key}',
  },
};

describe('refactorTemplateRefs', () => {
  it('replaces pattern in template values', () => {
    const result = refactorTemplateRefs(templates, '${pg.url}', '${postgres.connection_url}');
    expect(result.main.DB_URL).toBe('${postgres.connection_url}/mydb');
  });

  it('does not modify values without the pattern', () => {
    const result = refactorTemplateRefs(templates, '${pg.url}', '${postgres.url}');
    expect(result.main.REDIS).toBe('${redis.host}:6379');
    expect(result.main.STATIC).toBe('some-value');
  });

  it('returns a new object (immutable)', () => {
    const result = refactorTemplateRefs(templates, '${pg.url}', '${pg.uri}');
    expect(result).not.toBe(templates);
    expect(result.main).not.toBe(templates.main);
  });

  it('handles empty templates', () => {
    expect(refactorTemplateRefs({ main: {} }, 'a', 'b')).toEqual({ main: {} });
  });
});

describe('refactorServiceId', () => {
  it('renames service references in ${oldId.*} patterns', () => {
    const result = refactorServiceId(templates, 'pg', 'postgres');
    expect(result.main.DB_URL).toBe('${postgres.url}/mydb');
  });

  it('does not touch other service references', () => {
    const result = refactorServiceId(templates, 'pg', 'postgres');
    expect(result.main.REDIS).toBe('${redis.host}:6379');
    expect(result.main.API_KEY).toBe('${stripe.key}');
  });

  it('does not touch static values', () => {
    const result = refactorServiceId(templates, 'pg', 'postgres');
    expect(result.main.STATIC).toBe('some-value');
  });

  it('handles regex special chars in service id', () => {
    const t: Templates = { main: { KEY: '${my.app.field}' } };
    const result = refactorServiceId(t, 'my.app', 'myapp');
    expect(result.main.KEY).toBe('${myapp.field}');
  });
});

describe('removeServiceRefs', () => {
  it('removes entries that are a single reference to the deleted service', () => {
    const t: Templates = {
      main: { DB_URL: '${pg.url}', REDIS: '${redis.host}' },
    };
    const result = removeServiceRefs(t, 'pg');
    expect(result.main.DB_URL).toBeUndefined();
    expect(result.main.REDIS).toBe('${redis.host}');
  });

  it('keeps entries with composite values (not single ref)', () => {
    const result = removeServiceRefs(templates, 'pg');
    // '${pg.url}/mydb' is not a single ref (has /mydb suffix), so it's kept
    expect(result.main.DB_URL).toBe('${pg.url}/mydb');
  });

  it('handles empty templates', () => {
    expect(removeServiceRefs({ main: {} }, 'pg')).toEqual({ main: {} });
  });

  it('returns a new object', () => {
    const result = removeServiceRefs(templates, 'pg');
    expect(result).not.toBe(templates);
  });
});
