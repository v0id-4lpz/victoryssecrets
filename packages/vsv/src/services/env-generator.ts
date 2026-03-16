// env-generator.ts — .env generation from templates + resolved secrets

import type { VaultData, GenerateResult, EnvEntry } from '../types/vault';
import { GLOBAL_ENV } from '../models/vault-schema';

/** Escape a value for safe .env output (prevent newline injection) */
function escapeEnvValue(value: string): string {
  if (/[\n\r]/.test(value)) return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
  return value;
}

export function resolveSecrets(vault: VaultData, envId: string): Record<string, Record<string, string>> {
  const resolved: Record<string, Record<string, string>> = {};
  for (const [serviceId, fields] of Object.entries(vault.secrets || {})) {
    resolved[serviceId] = {};
    for (const [field, entry] of Object.entries(fields)) {
      const envVal = entry.values?.[envId];
      const globalVal = entry.values?.[GLOBAL_ENV];
      const value = envVal !== undefined ? envVal : globalVal;
      if (value !== undefined) resolved[serviceId]![field] = value;
    }
  }
  return resolved;
}

function resolveWithSource(secrets: VaultData['secrets'], serviceId: string, field: string, envId: string): { value: string | undefined; source: string | null; secret: boolean } {
  const entry = secrets?.[serviceId]?.[field];
  if (!entry?.values) return { value: undefined, source: null, secret: false };
  const secret = entry.secret;
  const envVal = entry.values[envId];
  if (envVal !== undefined) return { value: envVal, source: envId, secret };
  const globalVal = entry.values[GLOBAL_ENV];
  if (globalVal !== undefined) return { value: globalVal, source: 'Global', secret };
  return { value: undefined, source: null, secret };
}

export function generateEnv(vault: VaultData, envId: string): GenerateResult {
  const template = vault.templates?.main;
  if (!template) return { output: '', warnings: [], entries: [] };

  const resolved = resolveSecrets(vault, envId);
  const warnings: string[] = [];
  const lines: string[] = [];
  const entries: EnvEntry[] = [];

  const magicVars: Record<string, string> = {
    _ENV_NAME: envId,
  };

  for (const [key, rawValue] of Object.entries(template)) {
    const refMatch = rawValue.match(/^\$\{(.+)\}$/);
    if (refMatch) {
      const ref = refMatch[1]!;
      if (magicVars[ref] !== undefined) {
        lines.push(`${key}=${escapeEnvValue(magicVars[ref]!)}`);
        entries.push({ key, value: magicVars[ref]!, source: 'auto', secret: false });
        continue;
      }
      const dotIndex = ref.indexOf('.');
      if (dotIndex === -1) {
        warnings.push(`${key}: invalid reference \${${ref}} (expected \${service.field})`);
        lines.push(`${key}=`);
        entries.push({ key, value: '', source: null, secret: false });
        continue;
      }
      const serviceId = ref.slice(0, dotIndex);
      const field = ref.slice(dotIndex + 1);
      const { value, source, secret } = resolveWithSource(vault.secrets, serviceId, field, envId);
      if (value === undefined) {
        warnings.push(`${key}: unresolved reference \${${ref}}`);
        lines.push(`${key}=`);
        entries.push({ key, value: '', source: null, secret });
      } else {
        lines.push(`${key}=${escapeEnvValue(value)}`);
        entries.push({ key, value, source, secret });
      }
    } else {
      lines.push(`${key}=${escapeEnvValue(rawValue)}`);
      entries.push({ key, value: rawValue, source: 'static', secret: false });
    }
  }

  return { output: lines.join('\n') + '\n', warnings, entries };
}
