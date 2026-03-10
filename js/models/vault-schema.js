// vault-schema.js — vault data structure and migration

export const CURRENT_VERSION = 1;

export function createEmpty() {
  return {
    version: CURRENT_VERSION,
    services: {},
    environments: [],
    environmentMeta: {},
    secrets: {
      global: {},
      envs: {},
    },
    templates: {},
  };
}

export function ensureStructure(data) {
  if (!data.services) data.services = {};
  if (!data.environments) data.environments = [];
  if (!data.environmentMeta) data.environmentMeta = {};
  if (!data.secrets) data.secrets = { global: {}, envs: {} };
  if (!data.secrets.global) data.secrets.global = {};
  if (!data.secrets.envs) data.secrets.envs = {};
  if (!data.templates) data.templates = {};
  return data;
}
