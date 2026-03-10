// vault-schema.js — vault data structure and migration

export const CURRENT_VERSION = 1;

export const GLOBAL_ENV = '_global';

export const DEFAULT_SETTINGS = {
  autolockMinutes: 5,
};

export function createEmpty() {
  return {
    version: CURRENT_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    services: {},
    environments: {},
    secrets: {},
    templates: { main: {} },
  };
}

export function ensureStructure(data) {
  if (!data.services) data.services = {};
  if (!data.environments || Array.isArray(data.environments)) data.environments = {};
  if (!data.secrets) data.secrets = {};
  if (!data.templates) data.templates = { main: {} };
  if (!data.templates.main) data.templates.main = {};
  if (!data.settings) data.settings = { ...DEFAULT_SETTINGS };
  if (data.settings.autolockMinutes == null) data.settings.autolockMinutes = DEFAULT_SETTINGS.autolockMinutes;
  return data;
}
