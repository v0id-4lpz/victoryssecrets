// secret-ops.ts — pure CRUD operations on secrets within vault data

import type { VaultData, SecretEntry } from '../types/vault';
import { GLOBAL_ENV } from '../models/vault-schema';
import { refactorTemplateRefs } from '../models/template-refactor';

export function getAllSecrets(data: VaultData): Record<string, Record<string, SecretEntry>> {
  return data.secrets || {};
}

export function getSecret(data: VaultData, serviceId: string, field: string): SecretEntry | null {
  return data.secrets?.[serviceId]?.[field] || null;
}

export function setSecret(data: VaultData, serviceId: string, field: string, { secret = true, values = {} }: { secret?: boolean; values?: Record<string, string> } = {}): VaultData {
  if (!data.secrets[serviceId]) data.secrets[serviceId] = {};
  data.secrets[serviceId]![field] = { secret, values };
  return data;
}

export function setSecretValue(data: VaultData, serviceId: string, field: string, envId: string, value: string): VaultData {
  if (!data.secrets[serviceId]?.[field]) return data;
  data.secrets[serviceId]![field]!.values[envId] = value;
  return data;
}

export function setSecretFlag(data: VaultData, serviceId: string, field: string, secret: boolean): VaultData {
  if (!data.secrets[serviceId]?.[field]) return data;
  data.secrets[serviceId]![field]!.secret = secret;
  return data;
}

export function deleteSecret(data: VaultData, serviceId: string, field: string): VaultData {
  if (data.secrets[serviceId]) {
    delete data.secrets[serviceId]![field];
    if (Object.keys(data.secrets[serviceId]!).length === 0) delete data.secrets[serviceId];
  }
  return data;
}

export function deleteSecretValue(data: VaultData, serviceId: string, field: string, envId: string): VaultData {
  if (data.secrets[serviceId]?.[field]?.values) {
    delete data.secrets[serviceId]![field]!.values[envId];
  }
  return data;
}

export function moveSecret(data: VaultData, oldServiceId: string, oldField: string, newServiceId: string, newField: string): VaultData {
  if (!data.secrets[oldServiceId]?.[oldField]) return data;
  const entry = data.secrets[oldServiceId]![oldField]!;
  delete data.secrets[oldServiceId]![oldField];
  if (Object.keys(data.secrets[oldServiceId]!).length === 0) delete data.secrets[oldServiceId];
  if (!data.secrets[newServiceId]) data.secrets[newServiceId] = {};
  data.secrets[newServiceId]![newField] = entry;
  data.templates = refactorTemplateRefs(
    data.templates,
    `\${${oldServiceId}.${oldField}}`,
    `\${${newServiceId}.${newField}}`
  );
  return data;
}

export function resolveValue(entry: SecretEntry | null | undefined, envId: string): string | undefined {
  if (!entry?.values) return undefined;
  const envVal = entry.values[envId];
  if (envVal !== undefined && envVal !== '') return envVal;
  return entry.values[GLOBAL_ENV];
}
