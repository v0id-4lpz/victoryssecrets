import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolveFile, isAgentRunning, warn, setQuiet, promptPassword } from '../src/cli-utils';
import { getSocketPath } from '../src/agent/protocol';

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

describe('isAgentRunning', () => {
  it('returns false when socket does not exist', () => {
    const socketPath = getSocketPath();
    if (existsSync(socketPath)) unlinkSync(socketPath);
    expect(isAgentRunning()).toBe(false);
  });

  it('returns true when socket file exists', () => {
    const socketPath = getSocketPath();
    const existed = existsSync(socketPath);
    if (!existed) writeFileSync(socketPath, '');
    try {
      expect(isAgentRunning()).toBe(true);
    } finally {
      if (!existed) unlinkSync(socketPath);
    }
  });
});

describe('warn / setQuiet', () => {
  afterEach(() => setQuiet(false));

  it('warn writes to stderr by default', () => {
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    warn('test warning');
    expect(mockStderr).toHaveBeenCalledWith('test warning');
    mockStderr.mockRestore();
  });

  it('warn is suppressed in quiet mode', () => {
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    setQuiet(true);
    warn('should not appear');
    expect(mockStderr).not.toHaveBeenCalled();
    mockStderr.mockRestore();
  });

  it('setQuiet can be toggled off', () => {
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    setQuiet(true);
    setQuiet(false);
    warn('visible again');
    expect(mockStderr).toHaveBeenCalledWith('visible again');
    mockStderr.mockRestore();
  });
});

describe('promptPassword', () => {
  const savedPassword = process.env['VSV_PASSWORD'];
  const savedPasswordFile = process.env['VSV_PASSWORD_FILE'];
  const TMP_PW = '/tmp/test-vsv-password.txt';

  afterEach(() => {
    if (savedPassword !== undefined) process.env['VSV_PASSWORD'] = savedPassword;
    else delete process.env['VSV_PASSWORD'];
    if (savedPasswordFile !== undefined) process.env['VSV_PASSWORD_FILE'] = savedPasswordFile;
    else delete process.env['VSV_PASSWORD_FILE'];
    if (existsSync(TMP_PW)) unlinkSync(TMP_PW);
  });

  it('returns VSV_PASSWORD when set', async () => {
    process.env['VSV_PASSWORD'] = 'env-password';
    delete process.env['VSV_PASSWORD_FILE'];
    const result = await promptPassword();
    expect(result).toBe('env-password');
  });

  it('VSV_PASSWORD takes priority over VSV_PASSWORD_FILE', async () => {
    process.env['VSV_PASSWORD'] = 'from-env';
    writeFileSync(TMP_PW, 'from-file\n');
    process.env['VSV_PASSWORD_FILE'] = TMP_PW;
    const result = await promptPassword();
    expect(result).toBe('from-env');
  });

  it('reads from VSV_PASSWORD_FILE when VSV_PASSWORD is not set', async () => {
    delete process.env['VSV_PASSWORD'];
    writeFileSync(TMP_PW, 'file-password\n');
    process.env['VSV_PASSWORD_FILE'] = TMP_PW;
    const result = await promptPassword();
    expect(result).toBe('file-password');
  });

  it('trims whitespace from password file', async () => {
    delete process.env['VSV_PASSWORD'];
    writeFileSync(TMP_PW, '  spaced-password  \n');
    process.env['VSV_PASSWORD_FILE'] = TMP_PW;
    const result = await promptPassword();
    expect(result).toBe('spaced-password');
  });

  it('exits when password file does not exist', async () => {
    delete process.env['VSV_PASSWORD'];
    process.env['VSV_PASSWORD_FILE'] = '/tmp/nonexistent-vsv-pw.txt';
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(promptPassword()).rejects.toThrow('exit');
    expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('password file not found'));

    mockExit.mockRestore();
    mockStderr.mockRestore();
  });
});
