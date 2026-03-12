import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveFile } from '../src/cli-utils';

describe('resolveFile', () => {
  const originalEnv = process.env['VSV_FILE'];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['VSV_FILE'] = originalEnv;
    } else {
      delete process.env['VSV_FILE'];
    }
  });

  it('returns -f option when provided', () => {
    process.env['VSV_FILE'] = '/env/path.vsv';
    expect(resolveFile({ file: '/opt/path.vsv' })).toBe('/opt/path.vsv');
  });

  it('falls back to VSV_FILE env var', () => {
    process.env['VSV_FILE'] = '/env/path.vsv';
    expect(resolveFile({})).toBe('/env/path.vsv');
  });

  it('exits when neither -f nor VSV_FILE is set', () => {
    delete process.env['VSV_FILE'];
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(() => resolveFile({})).toThrow('exit');
    expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('vault file required'));

    mockExit.mockRestore();
    mockStderr.mockRestore();
  });
});

describe('promptPassword with VSV_PASSWORD', () => {
  const originalEnv = process.env['VSV_PASSWORD'];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['VSV_PASSWORD'] = originalEnv;
    } else {
      delete process.env['VSV_PASSWORD'];
    }
  });

  it('returns VSV_PASSWORD when set', async () => {
    process.env['VSV_PASSWORD'] = 'env-password';
    const { promptPassword } = await import('../src/cli-utils');
    const result = await promptPassword();
    expect(result).toBe('env-password');
  });
});
