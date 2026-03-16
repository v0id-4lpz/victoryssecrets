import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSocketPath, getPidPath } from '../../src/agent/protocol';

describe('protocol', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getSocketPath', () => {
    it('returns a path ending with .sock', () => {
      const path = getSocketPath();
      expect(path).toMatch(/\.sock$/);
    });

    it('includes uid in the path', () => {
      const uid = process.getuid?.() ?? 0;
      const path = getSocketPath();
      expect(path).toContain(`vsv-agent-${uid}`);
    });

    it('uses XDG_RUNTIME_DIR when set', () => {
      process.env = { ...originalEnv, XDG_RUNTIME_DIR: '/run/user/1000' };
      const path = getSocketPath();
      expect(path).toMatch(/^\/run\/user\/1000\//);
    });

    it('falls back to /tmp when XDG_RUNTIME_DIR is not set', () => {
      process.env = { ...originalEnv };
      delete process.env['XDG_RUNTIME_DIR'];
      const path = getSocketPath();
      expect(path).toMatch(/^\/tmp\//);
    });
  });

  describe('getPidPath', () => {
    it('returns a path ending with .pid', () => {
      const path = getPidPath();
      expect(path).toMatch(/\.pid$/);
    });

    it('includes uid in the path', () => {
      const uid = process.getuid?.() ?? 0;
      const path = getPidPath();
      expect(path).toContain(`vsv-agent-${uid}`);
    });

    it('uses same directory as socket path', () => {
      const sockDir = getSocketPath().split('/').slice(0, -1).join('/');
      const pidDir = getPidPath().split('/').slice(0, -1).join('/');
      expect(pidDir).toBe(sockDir);
    });
  });
});
