// secret-fd.ts — read secrets from a file descriptor (secure secret passing)

import { readFileSync } from 'node:fs';

const DEFAULT_FD = 3;
const MAX_SECRET_SIZE = 10_000_000; // 10 MB

/**
 * Read secrets passed via a file descriptor (default fd 3).
 * Used by `vsv run --secure` to pass secrets without env vars.
 *
 * Format is JSON: { "KEY": "value", ... }
 *
 * Usage in child process:
 *   import { readSecretsFromFd } from 'vsv';
 *   const secrets = readSecretsFromFd();
 */
export function readSecretsFromFd(fd?: number): Record<string, string> {
  const targetFd = fd ?? parseInt(process.env['VSV_SECRET_FD'] ?? String(DEFAULT_FD), 10);
  if (!Number.isInteger(targetFd) || targetFd < 0) {
    throw new Error(`Invalid secret fd: ${targetFd}`);
  }

  let raw: Buffer;
  try {
    raw = readFileSync(targetFd);
  } catch (err) {
    throw new Error(`Failed to read secrets from fd ${targetFd}: ${(err as Error).message}`);
  }

  if (raw.length > MAX_SECRET_SIZE) {
    raw.fill(0);
    throw new Error(`Secret data exceeds maximum size (${MAX_SECRET_SIZE} bytes)`);
  }

  let secrets: Record<string, string>;
  try {
    const text = raw.toString('utf-8');
    raw.fill(0);
    secrets = JSON.parse(text);
  } catch {
    raw.fill(0);
    throw new Error('Failed to parse secrets from fd: invalid JSON');
  }

  if (typeof secrets !== 'object' || secrets === null || Array.isArray(secrets)) {
    throw new Error('Secrets must be a JSON object');
  }

  // Validate all values are strings
  for (const [key, val] of Object.entries(secrets)) {
    if (typeof val !== 'string') {
      throw new Error(`Secret "${key}" has non-string value`);
    }
  }

  return secrets;
}
