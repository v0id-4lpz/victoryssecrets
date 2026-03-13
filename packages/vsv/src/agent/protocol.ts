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

export function getSocketPath(): string {
  const uid = process.getuid?.() ?? 0;
  return `${getRunDir()}/vsv-agent-${uid}.sock`;
}

export function getPidPath(): string {
  const uid = process.getuid?.() ?? 0;
  return `${getRunDir()}/vsv-agent-${uid}.pid`;
}
