import { describe, it, expect } from 'vitest';
import {
  sanitizeId,
  labelToId,
  validateServiceId,
  validateEnvironmentId,
  validateServiceRename,
  validateEnvironmentRename,
  validateSecretField,
} from '../../js/models/validators.js';

describe('sanitizeId', () => {
  it('lowercases and removes invalid chars', () => {
    expect(sanitizeId('  My_Service-1  ')).toBe('my_service-1');
  });

  it('strips special characters', () => {
    expect(sanitizeId('hello@world!')).toBe('helloworld');
  });

  it('returns empty for invalid input', () => {
    expect(sanitizeId('  @#$  ')).toBe('');
  });
});

describe('labelToId', () => {
  it('converts label to snake_case id', () => {
    expect(labelToId('PostgreSQL')).toBe('postgresql');
  });

  it('normalizes accents', () => {
    expect(labelToId('Éléphant DB')).toBe('elephant_db');
  });

  it('replaces non-alphanum with underscores', () => {
    expect(labelToId('My Service (v2)')).toBe('my_service_v2');
  });

  it('trims leading/trailing underscores', () => {
    expect(labelToId('  --hello--  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(labelToId('')).toBe('');
  });
});

describe('validateServiceId', () => {
  it('returns error when id is empty', () => {
    expect(validateServiceId('', {})).toBeTruthy();
  });

  it('returns error when service already exists', () => {
    expect(validateServiceId('pg', { pg: {} })).toContain('already exists');
  });

  it('returns null for valid new id', () => {
    expect(validateServiceId('redis', { pg: {} })).toBeNull();
  });
});

describe('validateEnvironmentId', () => {
  it('returns error when id is empty', () => {
    expect(validateEnvironmentId('', [])).toBeTruthy();
  });

  it('returns error when env already exists', () => {
    expect(validateEnvironmentId('prod', ['prod', 'dev'])).toContain('already exists');
  });

  it('returns null for valid new id', () => {
    expect(validateEnvironmentId('staging', ['prod'])).toBeNull();
  });
});

describe('validateServiceRename', () => {
  it('returns error when newId is empty', () => {
    expect(validateServiceRename('pg', '', {})).toBeTruthy();
  });

  it('returns null when renaming to same id', () => {
    expect(validateServiceRename('pg', 'pg', { pg: {} })).toBeNull();
  });

  it('returns error when newId conflicts', () => {
    expect(validateServiceRename('pg', 'redis', { redis: {} })).toContain('already exists');
  });

  it('returns null for valid rename', () => {
    expect(validateServiceRename('pg', 'postgres', { pg: {} })).toBeNull();
  });
});

describe('validateEnvironmentRename', () => {
  it('returns error when newId is empty', () => {
    expect(validateEnvironmentRename('prod', '', [])).toBeTruthy();
  });

  it('returns null when renaming to same id', () => {
    expect(validateEnvironmentRename('prod', 'prod', ['prod'])).toBeNull();
  });

  it('returns error when newId conflicts', () => {
    expect(validateEnvironmentRename('prod', 'dev', ['prod', 'dev'])).toContain('already exists');
  });
});

describe('validateSecretField', () => {
  it('returns error when serviceId is empty', () => {
    expect(validateSecretField('', 'password')).toBeTruthy();
  });

  it('returns error when fieldName is empty', () => {
    expect(validateSecretField('pg', '')).toBeTruthy();
  });

  it('returns null for valid inputs', () => {
    expect(validateSecretField('pg', 'password')).toBeNull();
  });
});
