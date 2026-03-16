// server.ts — vsv agent daemon (Unix socket server)

import { createServer, type Server, type Socket } from 'node:net';
import { writeFileSync, unlinkSync, existsSync, chmodSync, lstatSync, readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';
import { resolveValue } from '../services/secret-ops';
import type { AgentRequest, AgentResponse } from './protocol';
import { getSocketPath, getPidPath, getTokenPath } from './protocol';

const MAX_BUFFER_SIZE = 1_000_000; // 1 MB — prevent memory exhaustion from malicious clients
const AUTH_TOKEN_BYTES = 32;

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] ${msg}\n`);
}

// Explicit dispatch map for mutations — no dynamic bracket access on vault module
const MUTATIONS: Record<string, (...args: unknown[]) => Promise<void>> = {
  addService: (...a) => vault.addService(a[0] as string, a[1] as string, a[2] as string),
  deleteService: (...a) => vault.deleteService(a[0] as string),
  renameService: (...a) => vault.renameService(a[0] as string, a[1] as string),
  renameServiceId: (...a) => vault.renameServiceId(a[0] as string, a[1] as string),
  setServiceComment: (...a) => vault.setServiceComment(a[0] as string, a[1] as string),
  addEnvironment: (...a) => vault.addEnvironment(a[0] as string, a[1] as string),
  renameEnvironment: (...a) => vault.renameEnvironment(a[0] as string, a[1] as string),
  deleteEnvironment: (...a) => vault.deleteEnvironment(a[0] as string),
  setEnvironmentComment: (...a) => vault.setEnvironmentComment(a[0] as string, a[1] as string),
  setSecret: (...a) => vault.setSecret(a[0] as string, a[1] as string, a[2] as { secret?: boolean; values?: Record<string, string> }),
  setSecretValue: (...a) => vault.setSecretValue(a[0] as string, a[1] as string, a[2] as string, a[3] as string),
  setSecretFlag: (...a) => vault.setSecretFlag(a[0] as string, a[1] as string, a[2] as boolean),
  deleteSecret: (...a) => vault.deleteSecret(a[0] as string, a[1] as string),
  deleteSecretValue: (...a) => vault.deleteSecretValue(a[0] as string, a[1] as string, a[2] as string),
  moveSecret: (...a) => vault.moveSecret(a[0] as string, a[1] as string, a[2] as string, a[3] as string),
  setTemplateEntry: (...a) => vault.setTemplateEntry(a[0] as string, a[1] as string),
  deleteTemplateEntry: (...a) => vault.deleteTemplateEntry(a[0] as string),
  clearTemplate: () => vault.clearTemplate(),
  replaceTemplate: (...a) => vault.replaceTemplate(a[0] as Record<string, string>),
  mergeTemplate: (...a) => vault.mergeTemplate(a[0] as Record<string, string>),
  setAutolockMinutes: (...a) => vault.setAutolockMinutes(a[0] as number),
  setReadOnly: (...a) => vault.setReadOnly(a[0] as boolean),
};

let authToken: Buffer | null = null;
let defaultEnv: string | null = null;
let server: Server | null = null;
let autolockTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let signalHandlers: { sig: NodeJS.Signals; handler: () => void }[] = [];

// Per-connection auth state tracked via WeakSet
const authenticatedConns = new WeakSet<Socket>();

function requireEnv(envId: unknown): string {
  const env = (envId as string) || defaultEnv;
  if (!env) throw new Error('No environment specified and no default env on agent (start with -e)');
  return env;
}

const READS: Record<string, (...args: unknown[]) => unknown> = {
  ping: () => 'pong',
  getInfo: () => ({ env: defaultEnv }),
  getData: () => vault.getData(),
  getPath: () => vault.getPath(),
  isUnlocked: () => vault.isUnlocked(),
  getSecret: (serviceId: unknown, field: unknown) =>
    vault.getSecret(serviceId as string, field as string),
  getSecretValue: (serviceId: unknown, field: unknown, envId: unknown) => {
    const entry = vault.getSecret(serviceId as string, field as string);
    return resolveValue(entry, requireEnv(envId)) ?? null;
  },
  get: (ref: unknown, envId: unknown) => {
    const r = ref as string;
    const dotIndex = r.indexOf('.');
    if (dotIndex === -1) throw new Error(`Invalid reference "${r}" (expected service.field)`);
    const entry = vault.getSecret(r.slice(0, dotIndex), r.slice(dotIndex + 1));
    return resolveValue(entry, requireEnv(envId)) ?? null;
  },
  getAllSecrets: () => vault.getAllSecrets(),
  getTemplate: () => vault.getTemplate(),
  getSettings: () => vault.getSettings(),
  hasService: (id: unknown) => vault.hasService(id as string),
  hasEnvironment: (envId: unknown) => vault.hasEnvironment(envId as string),
  getEnvironmentComment: (envId: unknown) => vault.getEnvironmentComment(envId as string),
  env: (envId: unknown) => generateEnv(vault.getData(), requireEnv(envId)),
  isRemote: () => vault.isRemote(),
};

function resetAutolock(minutes: number): void {
  if (autolockTimer) clearTimeout(autolockTimer);
  if (minutes <= 0) return;
  autolockTimer = setTimeout(() => {
    log('Auto-lock: shutting down agent');
    shutdown();
  }, minutes * 60_000);
}

function validateArgs(args: unknown[]): boolean {
  for (const arg of args) {
    if (arg === null || arg === undefined) continue;
    const t = typeof arg;
    if (t === 'string' || t === 'number' || t === 'boolean') continue;
    if (t === 'object' && !Array.isArray(arg)) continue; // allow plain objects (for setSecret opts, replaceTemplate)
    return false;
  }
  return true;
}

function handleAuth(token: string): boolean {
  if (!authToken) return false;
  const clientBuf = Buffer.from(token, 'hex');
  if (clientBuf.length !== authToken.length) return false;
  return timingSafeEqual(clientBuf, authToken);
}

async function handleRequest(req: AgentRequest, conn: Socket): Promise<AgentResponse> {
  const { id, method, args } = req;

  // Auth handshake must be the first message on a new connection
  if (method === 'auth') {
    if (!Array.isArray(args) || typeof args[0] !== 'string') {
      return { id, ok: false, error: 'auth requires a token argument' };
    }
    if (handleAuth(args[0] as string)) {
      authenticatedConns.add(conn);
      return { id, ok: true };
    }
    return { id, ok: false, error: 'Authentication failed' };
  }

  // All other methods require authentication
  if (!authenticatedConns.has(conn)) {
    return { id, ok: false, error: 'Not authenticated — send auth handshake first' };
  }

  if (!Array.isArray(args)) return { id, ok: false, error: 'args must be an array' };
  if (!validateArgs(args)) return { id, ok: false, error: 'Invalid argument types' };

  try {
    if (!vault.isUnlocked() && method !== 'ping') {
      return { id, ok: false, error: 'Vault is locked' };
    }

    // Reset autolock on every request
    const settings = vault.isUnlocked() ? vault.getSettings() : null;
    if (settings) resetAutolock(settings.autolockMinutes);

    // Special methods
    if (method === 'lock') {
      setTimeout(() => shutdown(), 50);
      return { id, ok: true };
    }

    if (method === 'refresh') {
      if (!vault.isRemote()) return { id, ok: false, error: 'Refresh is only supported for remote vaults' };
      await vault.refresh();
      return { id, ok: true, data: vault.getData() };
    }

    // Read methods
    if (Object.hasOwn(READS, method)) {
      const result = READS[method]!(...args);
      return { id, ok: true, data: result };
    }

    // Mutation methods
    if (Object.hasOwn(MUTATIONS, method)) {
      if (vault.isRemote()) return { id, ok: false, error: 'Cannot mutate a remote vault (read-only)' };
      await MUTATIONS[method]!(...args);
      return { id, ok: true, data: vault.getData() };
    }

    return { id, ok: false, error: `Unknown method: ${method}` };
  } catch (err) {
    return { id, ok: false, error: (err as Error).message };
  }
}

function cleanup(): void {
  const socketPath = getSocketPath();
  const pidPath = getPidPath();
  const tokenPath = getTokenPath();
  if (existsSync(socketPath)) unlinkSync(socketPath);
  if (existsSync(pidPath)) unlinkSync(pidPath);
  if (existsSync(tokenPath)) unlinkSync(tokenPath);
}

export function shutdown(): void {
  vault.lock();
  if (autolockTimer) clearTimeout(autolockTimer);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (server) { server.close(); server = null; }
  for (const { sig, handler } of signalHandlers) process.removeListener(sig, handler);
  signalHandlers = [];
  if (authToken) { authToken.fill(0); authToken = null; }
  cleanup();
}

function shutdownAndExit(): void {
  shutdown();
  process.exit(0);
}

export function getAuthToken(): string | null {
  return authToken ? authToken.toString('hex') : null;
}

export async function startAgent(filePath: string, password: string, env?: string, pollMinutes?: number): Promise<void> {
  const socketPath = getSocketPath();
  const pidPath = getPidPath();
  const tokenPath = getTokenPath();

  if (existsSync(socketPath)) {
    throw new Error('Agent already running (socket exists). Run "vsv agent stop" first.');
  }
  // Prevent symlink attacks on socket/pid/token paths
  try { if (lstatSync(socketPath).isSymbolicLink()) throw new Error('Socket path is a symlink — refusing to start'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  try { if (lstatSync(pidPath).isSymbolicLink()) throw new Error('PID path is a symlink — refusing to start'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  try { if (lstatSync(tokenPath).isSymbolicLink()) throw new Error('Token path is a symlink — refusing to start'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }

  defaultEnv = env ?? null;

  // Generate auth token
  authToken = randomBytes(AUTH_TOKEN_BYTES);

  await vault.open(filePath, password);
  const settings = vault.getSettings();
  resetAutolock(settings.autolockMinutes);

  // Periodic refresh for remote vaults
  if (pollMinutes && pollMinutes > 0 && vault.isRemote()) {
    pollTimer = setInterval(async () => {
      try {
        await vault.refresh();
        log('Poll: remote vault refreshed');
      } catch (err) {
        log(`Poll: refresh failed — ${(err as Error).message}`);
      }
    }, pollMinutes * 60_000);
  }

  const onSighup = () => { log('Received SIGHUP, ignoring (daemon mode)'); };
  process.on('SIGINT', shutdownAndExit);
  process.on('SIGTERM', shutdownAndExit);
  // Ignore SIGHUP so daemon survives when parent terminal exits
  process.on('SIGHUP', onSighup);
  signalHandlers = [
    { sig: 'SIGINT', handler: shutdownAndExit },
    { sig: 'SIGTERM', handler: shutdownAndExit },
    { sig: 'SIGHUP', handler: onSighup },
  ];

  server = createServer((conn) => {
    let buffer = '';
    let destroyed = false;

    function safeWrite(data: string): void {
      if (!destroyed && conn.writable) conn.write(data);
    }

    conn.on('data', (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > MAX_BUFFER_SIZE) {
        log('Connection buffer exceeded limit, dropping connection');
        conn.destroy();
        destroyed = true;
        buffer = '';
        return;
      }
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.trim()) continue;

        let req: AgentRequest;
        try {
          req = JSON.parse(line);
        } catch {
          safeWrite(JSON.stringify({ id: 0, ok: false, error: 'Invalid JSON' }) + '\n');
          continue;
        }

        handleRequest(req, conn)
          .then((res) => safeWrite(JSON.stringify(res) + '\n'))
          .catch((err) => {
            log(`Unhandled error in handleRequest: ${(err as Error).message}`);
            safeWrite(JSON.stringify({ id: req.id ?? 0, ok: false, error: 'Internal server error' }) + '\n');
          });
      }
    });

    conn.on('error', (err) => {
      log(`Connection error: ${err.message}`);
      destroyed = true;
      buffer = '';
    });

    conn.on('close', () => {
      destroyed = true;
      buffer = '';
    });
  });

  const envLabel = defaultEnv ? `, env ${defaultEnv}` : '';
  await new Promise<void>((resolve) => {
    server!.listen(socketPath, () => {
      // Restrict socket, pid, and token files to owner only
      // Token must be written BEFORE pid — daemon start polls for pid as "ready" signal
      chmodSync(socketPath, 0o600);
      writeFileSync(tokenPath, authToken!.toString('hex'), { mode: 0o600 });
      writeFileSync(pidPath, String(process.pid), { mode: 0o600 });
      log(`Agent started (pid ${process.pid}${envLabel}, socket ${socketPath})`);
      resolve();
    });
  });
}
