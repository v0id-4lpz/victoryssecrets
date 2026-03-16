// template-ops.ts — pure CRUD operations on templates + env file parsing + field tree

import type { VaultData, Service } from '../types/vault';

const TPL_KEY = 'main';

export function setTemplateEntry(data: VaultData, key: string, value: string): VaultData {
  if (!data.templates[TPL_KEY]) data.templates[TPL_KEY] = {};
  data.templates[TPL_KEY][key] = value;
  return data;
}

export function deleteTemplateEntry(data: VaultData, key: string): VaultData {
  delete data.templates?.[TPL_KEY]?.[key];
  return data;
}

export function clearTemplate(data: VaultData): VaultData {
  if (data.templates?.[TPL_KEY]) {
    data.templates[TPL_KEY] = {};
  }
  return data;
}

export function getTemplate(data: VaultData): Record<string, string> {
  return data.templates?.[TPL_KEY] || {};
}

export function serializeTemplate(tpl: Record<string, string>): string {
  return Object.entries(tpl)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
}

export function parseTemplateText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
    if (match) result[match[1]!] = match[2]!;
  }
  return result;
}

export function replaceTemplate(data: VaultData, newTpl: Record<string, string>): VaultData {
  data.templates[TPL_KEY] = newTpl;
  return data;
}

export function mergeTemplate(data: VaultData, incoming: Record<string, string>): VaultData {
  if (!data.templates[TPL_KEY]) data.templates[TPL_KEY] = {};
  for (const [key, val] of Object.entries(incoming)) {
    if (!Object.hasOwn(data.templates[TPL_KEY], key)) {
      data.templates[TPL_KEY][key] = val;
    }
  }
  return data;
}

export function buildServiceFieldTree(data: VaultData): { services: Record<string, Service>; fieldsByService: Record<string, Set<string>> } {
  const services = data.services || {};
  const fieldsByService: Record<string, Set<string>> = {};
  for (const [serviceId, fields] of Object.entries(data.secrets || {})) {
    if (!fieldsByService[serviceId]) fieldsByService[serviceId] = new Set();
    for (const f of Object.keys(fields)) {
      fieldsByService[serviceId]!.add(f);
    }
  }
  for (const sId of Object.keys(services)) {
    if (!fieldsByService[sId]) fieldsByService[sId] = new Set();
  }
  return { services, fieldsByService };
}
