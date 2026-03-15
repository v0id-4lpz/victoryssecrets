// environment-ops.ts — pure CRUD operations on environments within vault data

import type { VaultData } from '../types/vault';

export function getEnvironmentIds(data: VaultData): string[] {
  return Object.keys(data.environments || {});
}

export function hasEnvironment(data: VaultData, envId: string): boolean {
  return envId in (data.environments || {});
}

export function addEnvironment(data: VaultData, envId: string, comment = ''): VaultData {
  if (hasEnvironment(data, envId)) throw new Error(`Environment "${envId}" already exists`);
  data.environments[envId] = { comment };
  return data;
}

export function renameEnvironment(data: VaultData, oldId: string, newId: string): VaultData {
  if (!hasEnvironment(data, oldId)) throw new Error(`Environment "${oldId}" not found`);
  if (hasEnvironment(data, newId)) throw new Error(`Environment "${newId}" already exists`);
  data.environments[newId] = data.environments[oldId]!;
  delete data.environments[oldId];
  // Rename env key in all secret values
  for (const fields of Object.values(data.secrets || {})) {
    for (const entry of Object.values(fields)) {
      if (entry.values && oldId in entry.values) {
        entry.values[newId] = entry.values[oldId]!;
        delete entry.values[oldId];
      }
    }
  }
  return data;
}

export function deleteEnvironment(data: VaultData, envId: string): VaultData {
  delete data.environments[envId];
  // Remove env key from all secret values
  for (const fields of Object.values(data.secrets || {})) {
    for (const entry of Object.values(fields)) {
      if (entry.values) delete entry.values[envId];
    }
  }
  return data;
}

export function setEnvironmentComment(data: VaultData, envId: string, comment: string): VaultData {
  if (!data.environments[envId]) throw new Error(`Environment "${envId}" not found`);
  data.environments[envId]!.comment = comment;
  return data;
}

export function getEnvironmentComment(data: VaultData, envId: string): string {
  return data.environments?.[envId]?.comment || '';
}
