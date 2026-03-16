// vault-schema.ts — vault data structure and migration

import type { VaultData, VaultSettings } from '../types/vault';

export const CURRENT_VERSION = 1;

export const GLOBAL_ENV = '_global';

export const DEFAULT_SETTINGS: VaultSettings = {
  autolockMinutes: 5,
  readOnly: false,
};

// Migration functions: each takes a vault at version N and returns version N+1.
// Key = source version. Example: { 1: (data) => { ...migrate v1→v2...; data.version = 2; return data; } }
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // When a future version 2 is needed:
  // 1: (data) => { data.newField = 'default'; data.version = 2; return data; },
};

export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  let version = (data.version as number) || 1;
  while (version < CURRENT_VERSION) {
    const fn = MIGRATIONS[version];
    if (!fn) throw new Error(`No migration path from vault version ${version} to ${version + 1}`);
    data = fn(data);
    version = (data.version as number);
  }
  if (version > CURRENT_VERSION) {
    throw new Error(`Vault version ${version} is newer than supported version ${CURRENT_VERSION}. Please update vsv.`);
  }
  return data;
}

export function createEmpty(): VaultData {
  return {
    version: CURRENT_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    services: {},
    environments: {},
    secrets: {},
    templates: { main: {} },
  };
}

export function ensureStructure(data: Partial<VaultData>): VaultData {
  // Run migrations first
  const migrated = migrate(data as Record<string, unknown>) as Partial<VaultData>;
  if (!migrated.services || typeof migrated.services !== 'object') migrated.services = {};
  if (!migrated.environments || typeof migrated.environments !== 'object' || Array.isArray(migrated.environments)) migrated.environments = {};
  if (!migrated.secrets || typeof migrated.secrets !== 'object') migrated.secrets = {};
  if (!migrated.templates) migrated.templates = { main: {} };
  if (!migrated.templates.main) migrated.templates.main = {};
  if (!migrated.settings) migrated.settings = { ...DEFAULT_SETTINGS };
  if (migrated.settings.autolockMinutes == null) migrated.settings.autolockMinutes = DEFAULT_SETTINGS.autolockMinutes;
  if (migrated.settings.readOnly == null) migrated.settings.readOnly = DEFAULT_SETTINGS.readOnly;

  // Strip malformed service entries (null, string, etc.)
  for (const [id, svc] of Object.entries(migrated.services)) {
    if (!svc || typeof svc !== 'object') { delete migrated.services[id]; continue; }
    // Normalize service fields
    if (typeof svc.label !== 'string') (svc as unknown as Record<string, unknown>).label = id;
    if (typeof svc.comment !== 'string') (svc as unknown as Record<string, unknown>).comment = '';
  }
  // Strip malformed environment entries
  for (const [id, meta] of Object.entries(migrated.environments)) {
    if (!meta || typeof meta !== 'object') { delete migrated.environments[id]; continue; }
    if (typeof meta.comment !== 'string') (meta as unknown as Record<string, unknown>).comment = '';
  }
  // Strip malformed secret entries and normalize types
  for (const [svcId, fields] of Object.entries(migrated.secrets)) {
    if (!fields || typeof fields !== 'object') { delete migrated.secrets[svcId]; continue; }
    for (const [field, entry] of Object.entries(fields)) {
      if (!entry || typeof entry !== 'object' || !entry.values || typeof entry.values !== 'object') {
        delete fields[field]; continue;
      }
      // Normalize secret flag
      if (typeof entry.secret !== 'boolean') (entry as unknown as Record<string, unknown>).secret = false;
      // Strip non-string values
      for (const [envId, val] of Object.entries(entry.values)) {
        if (typeof val !== 'string') delete entry.values[envId];
      }
    }
  }

  return migrated as VaultData;
}
