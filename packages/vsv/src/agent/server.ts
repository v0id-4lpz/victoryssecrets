// server.ts — vsv agent daemon (Unix socket server)

import { createServer, type Server } from 'node:net';
import { writeFileSync, unlinkSync, existsSync, chmodSync } from 'node:fs';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';
import { resolveValue } from '../services/secret-ops';
import type { AgentRequest, AgentResponse } from './protocol';
import { getSocketPath, getPidPath } from './protocol';

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] ${msg}\n`);
}

const MUTATIONS = new Set([
  'addService', 'deleteService', 'renameService', 'renameServiceId', 'setServiceComment',
  'addEnvironment', 'renameEnvironment', 'deleteEnvironment', 'setEnvironmentComment',
  'setSecret', 'setSecretValue', 'setSecretFlag', 'deleteSecret', 'deleteSecretValue', 'moveSecret',
  'setTemplateEntry', 'deleteTemplateEntry', 'clearTemplate', 'replaceTemplate', 'mergeTemplate',
  'setAutolockMinutes',
]);

let defaultEnv: string | null = null;
let server: Server | null = null;
let autolockTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function requireEnv(envId: unknown): string {
  const env = (envId as string) || defaultEnv;
  if (!env) throw new Error('No environment specified and no default env on agent (start with -e)');
  return env;
}

function buildReads(): Record<string, (...args: unknown[]) => unknown> {
  return {
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
}

function resetAutolock(minutes: number): void {
  if (autolockTimer) clearTimeout(autolockTimer);
  if (minutes <= 0) return;
  autolockTimer = setTimeout(() => {
    log('Auto-lock: shutting down agent');
    shutdown();
  }, minutes * 60_000);
}

async function handleRequest(req: AgentRequest): Promise<AgentResponse> {
  const { id, method, args } = req;
  const reads = buildReads();

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
    if (reads[method]) {
      const result = reads[method]!(...args);
      return { id, ok: true, data: result };
    }

    // Mutation methods
    if (MUTATIONS.has(method)) {
      if (vault.isRemote()) return { id, ok: false, error: 'Cannot mutate a remote vault (read-only)' };
      const fn = (vault as Record<string, (...args: unknown[]) => unknown>)[method];
      if (typeof fn !== 'function') return { id, ok: false, error: `Method not found: ${method}` };
      await fn.call(vault, ...args);
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
  if (existsSync(socketPath)) unlinkSync(socketPath);
  if (existsSync(pidPath)) unlinkSync(pidPath);
}

export function shutdown(): void {
  vault.lock();
  if (autolockTimer) clearTimeout(autolockTimer);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (server) { server.close(); server = null; }
  cleanup();
}

function shutdownAndExit(): void {
  shutdown();
  process.exit(0);
}

export async function startAgent(filePath: string, password: string, env?: string, pollMinutes?: number): Promise<void> {
  const socketPath = getSocketPath();
  const pidPath = getPidPath();

  if (existsSync(socketPath)) {
    throw new Error('Agent already running (socket exists). Run "vsv agent stop" first.');
  }

  defaultEnv = env ?? null;

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

  process.on('SIGINT', shutdownAndExit);
  process.on('SIGTERM', shutdownAndExit);
  // Ignore SIGHUP so daemon survives when parent terminal exits
  process.on('SIGHUP', () => { log('Received SIGHUP, ignoring (daemon mode)'); });

  server = createServer((conn) => {
    let buffer = '';

    conn.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.trim()) continue;

        let req: AgentRequest;
        try {
          req = JSON.parse(line);
        } catch {
          conn.write(JSON.stringify({ id: 0, ok: false, error: 'Invalid JSON' }) + '\n');
          continue;
        }

        handleRequest(req).then((res) => {
          conn.write(JSON.stringify(res) + '\n');
        });
      }
    });
  });

  const envLabel = defaultEnv ? `, env ${defaultEnv}` : '';
  await new Promise<void>((resolve) => {
    server!.listen(socketPath, () => {
      // Restrict socket and pid file to owner only
      chmodSync(socketPath, 0o600);
      writeFileSync(pidPath, String(process.pid), { mode: 0o600 });
      log(`Agent started (pid ${process.pid}${envLabel}, socket ${socketPath})`);
      resolve();
    });
  });
}
