import { describe, it, expect } from 'vitest';
import { isNewerVersion } from '../../js/services/update-check.js';

describe('isNewerVersion', () => {
  it('returns false for equal versions', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns true for newer patch', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
  });

  it('returns true for newer minor', () => {
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
  });

  it('returns true for newer major', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false);
  });

  it('handles v prefix', () => {
    expect(isNewerVersion('v1.0.0', 'v1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', 'v1.0.1')).toBe(true);
  });

  it('handles missing segments', () => {
    expect(isNewerVersion('1.0', '1.0.1')).toBe(true);
  });
});
