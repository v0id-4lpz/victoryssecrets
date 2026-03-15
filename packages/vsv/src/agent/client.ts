// client.ts — vsv agent client SDK

import { connect, type Socket } from 'node:net';
import { existsSync } from 'node:fs';
import type { VaultData, VaultSettings, SecretEntry, GenerateResult } from '../types/vault';
import type { AgentRequest, AgentResponse, AgentInfo } from './protocol';
import { getSocketPath } from './protocol';

const DEFAULT_CONNECT_TIMEOUT = 5_000;
const DEFAULT_REQUEST_TIMEOUT = 30_000;

export interface ClientOptions {
  socketPath?: string;
  env?: string;
  connectTimeout?: number;
  requestTimeout?: number;
}

export class VsvClient {
  private socket: Socket | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: AgentResponse) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private socketPath: string;
  private defaultEnv: string | undefined;
  private connectTimeout: number;
  private requestTimeout: number;

  constructor(opts?: ClientOptions) {
    this.socketPath = opts?.socketPath ?? getSocketPath();
    this.defaultEnv = opts?.env;
    this.connectTimeout = opts?.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.requestTimeout = opts?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
  }

  async connect(): Promise<void> {
    if (this.socket) return;
    if (!existsSync(this.socketPath)) {
      throw new Error('Agent not running. Start it with "vsv agent start -f <vault>"');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`Agent connection timeout (${this.connectTimeout}ms). Is the agent running?`));
      }, this.connectTimeout);

      const sock = connect(this.socketPath, () => {
        clearTimeout(timer);
        this.socket = sock;
        resolve();
      });

      sock.on('data', (chunk) => {
        this.buffer += chunk.toString();
        let idx: number;
        while ((idx = this.buffer.indexOf('\n')) !== -1) {
          const line = this.buffer.slice(0, idx);
          this.buffer = this.buffer.slice(idx + 1);
          if (!line.trim()) continue;
          try {
            const res: AgentResponse = JSON.parse(line);
            const p = this.pending.get(res.id);
            if (p) {
              this.pending.delete(res.id);
              p.resolve(res);
            }
          } catch { /* ignore malformed responses */ }
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timer);
        for (const [, p] of this.pending) p.reject(err);
        this.pending.clear();
        this.socket = null;
        reject(err);
      });

      sock.on('close', () => {
        for (const [, p] of this.pending) p.reject(new Error('Connection closed'));
        this.pending.clear();
        this.socket = null;
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }

  private async call(method: string, ...args: unknown[]): Promise<unknown> {
    if (!this.socket) await this.connect();

    // Trim trailing undefined args — JSON serializes them as null, which
    // breaks destructuring defaults on the server side.
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();

    const id = ++this.requestId;
    const req: AgentRequest = { id, method, args };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Agent request timeout (${this.requestTimeout}ms) for method "${method}"`));
      }, this.requestTimeout);

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          if (res.ok) resolve(res.data);
          else reject(new Error(res.error ?? 'Unknown error'));
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }

  // Resolve env: client override > client default > agent default (empty string → agent decides)
  private resolveEnv(envId?: string): string {
    return envId ?? this.defaultEnv ?? '';
  }

  // --- Read methods ---

  async ping(): Promise<string> {
    return this.call('ping') as Promise<string>;
  }

  async getInfo(): Promise<AgentInfo> {
    return this.call('getInfo') as Promise<AgentInfo>;
  }

  async getData(): Promise<VaultData> {
    return this.call('getData') as Promise<VaultData>;
  }

  async getPath(): Promise<string | null> {
    return this.call('getPath') as Promise<string | null>;
  }

  async isUnlocked(): Promise<boolean> {
    return this.call('isUnlocked') as Promise<boolean>;
  }

  async getSecret(serviceId: string, field: string): Promise<SecretEntry | null> {
    return this.call('getSecret', serviceId, field) as Promise<SecretEntry | null>;
  }

  /**
   * Get a secret value. Ref format: "service.field".
   * Env resolution: envId param > client default env > agent default env.
   */
  async get(ref: string, envId?: string): Promise<string | null> {
    return this.call('get', ref, this.resolveEnv(envId)) as Promise<string | null>;
  }

  async getAllSecrets(): Promise<Record<string, Record<string, SecretEntry>>> {
    return this.call('getAllSecrets') as Promise<Record<string, Record<string, SecretEntry>>>;
  }

  async getTemplate(): Promise<Record<string, string>> {
    return this.call('getTemplate') as Promise<Record<string, string>>;
  }

  async getSettings(): Promise<VaultSettings> {
    return this.call('getSettings') as Promise<VaultSettings>;
  }

  async hasService(id: string): Promise<boolean> {
    return this.call('hasService', id) as Promise<boolean>;
  }

  async hasEnvironment(envId: string): Promise<boolean> {
    return this.call('hasEnvironment', envId) as Promise<boolean>;
  }

  async env(envId?: string): Promise<GenerateResult> {
    return this.call('env', this.resolveEnv(envId)) as Promise<GenerateResult>;
  }

  async isRemote(): Promise<boolean> {
    return this.call('isRemote') as Promise<boolean>;
  }

  async refresh(): Promise<VaultData> {
    return this.call('refresh') as Promise<VaultData>;
  }

  // --- Mutations ---

  async addService(id: string, label: string, comment = ''): Promise<VaultData> {
    return this.call('addService', id, label, comment) as Promise<VaultData>;
  }

  async deleteService(id: string): Promise<VaultData> {
    return this.call('deleteService', id) as Promise<VaultData>;
  }

  async addEnvironment(envId: string, comment = ''): Promise<VaultData> {
    return this.call('addEnvironment', envId, comment) as Promise<VaultData>;
  }

  async setSecret(serviceId: string, field: string, opts?: { secret?: boolean; values?: Record<string, string> }): Promise<VaultData> {
    return this.call('setSecret', serviceId, field, opts) as Promise<VaultData>;
  }

  async setSecretValue(serviceId: string, field: string, envId: string, value: string): Promise<VaultData> {
    return this.call('setSecretValue', serviceId, field, envId, value) as Promise<VaultData>;
  }

  async deleteSecret(serviceId: string, field: string): Promise<VaultData> {
    return this.call('deleteSecret', serviceId, field) as Promise<VaultData>;
  }

  async lock(): Promise<void> {
    await this.call('lock');
    this.disconnect();
  }
}

export function createClient(opts?: ClientOptions): VsvClient {
  return new VsvClient(opts);
}
