// vault-schema.ts — vault data structure and migration

import type { VaultData, VaultSettings } from '../types/vault';

export const CURRENT_VERSION = 1;

export const GLOBAL_ENV = '_global';

export const DEFAULT_SETTINGS: VaultSettings = {
  autolockMinutes: 5,
};

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
  if (!data.services) data.services = {};
  if (!data.environments || Array.isArray(data.environments)) data.environments = {};
  if (!data.secrets) data.secrets = {};
  if (!data.templates) data.templates = { main: {} };
  if (!data.templates.main) data.templates.main = {};
  if (!data.settings) data.settings = { ...DEFAULT_SETTINGS };
  if (data.settings.autolockMinutes == null) data.settings.autolockMinutes = DEFAULT_SETTINGS.autolockMinutes;
  return data as VaultData;
}
