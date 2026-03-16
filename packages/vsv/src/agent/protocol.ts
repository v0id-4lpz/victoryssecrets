// protocol.ts — shared types for agent socket communication

export interface AgentRequest {
  id: number;
  method: string;
  args: unknown[];
}

export interface AgentResponse {
  id: number;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentInfo {
  env: string | null;
}

function getRunDir(): string {
  // Prefer XDG_RUNTIME_DIR (Linux: /run/user/<uid>/, mode 0700)
  // Falls back to /tmp/ (macOS, other)
  return process.env['XDG_RUNTIME_DIR'] ?? '/tmp';
}

function getUserId(): number | string {
  // On POSIX systems, use real uid. On Windows, fall back to username to avoid shared paths.
  if (process.getuid) return process.getuid();
  return process.env['USERNAME'] || process.env['USER'] || process.pid;
}

export function getSocketPath(): string {
  return `${getRunDir()}/vsv-agent-${getUserId()}.sock`;
}

export function getPidPath(): string {
  return `${getRunDir()}/vsv-agent-${getUserId()}.pid`;
}

export function getTokenPath(): string {
  return `${getRunDir()}/vsv-agent-${getUserId()}.token`;
}
