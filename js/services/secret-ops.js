// secret-ops.js — pure CRUD operations on secrets within vault data
// New model: secrets[serviceId][field] = { secret: bool, values: { _global: '', prod: '', ... } }

import { GLOBAL_ENV } from '../models/vault-schema.js';
import { refactorTemplateRefs } from '../models/template-refactor.js';

export function getAllSecrets(data) {
  return data.secrets || {};
}

export function getSecret(data, serviceId, field) {
  return data.secrets?.[serviceId]?.[field] || null;
}

export function setSecret(data, serviceId, field, { secret = true, values = {} } = {}) {
  if (!data.secrets[serviceId]) data.secrets[serviceId] = {};
  data.secrets[serviceId][field] = { secret, values };
  return data;
}

export function setSecretValue(data, serviceId, field, envId, value) {
  if (!data.secrets[serviceId]?.[field]) return data;
  data.secrets[serviceId][field].values[envId] = value;
  return data;
}

export function setSecretFlag(data, serviceId, field, secret) {
  if (!data.secrets[serviceId]?.[field]) return data;
  data.secrets[serviceId][field].secret = secret;
  return data;
}

export function deleteSecret(data, serviceId, field) {
  if (data.secrets[serviceId]) {
    delete data.secrets[serviceId][field];
    if (Object.keys(data.secrets[serviceId]).length === 0) delete data.secrets[serviceId];
  }
  return data;
}

export function deleteSecretValue(data, serviceId, field, envId) {
  if (data.secrets[serviceId]?.[field]?.values) {
    delete data.secrets[serviceId][field].values[envId];
  }
  return data;
}

export function moveSecret(data, oldServiceId, oldField, newServiceId, newField) {
  if (!data.secrets[oldServiceId]?.[oldField]) return data;
  const entry = data.secrets[oldServiceId][oldField];
  delete data.secrets[oldServiceId][oldField];
  if (Object.keys(data.secrets[oldServiceId]).length === 0) delete data.secrets[oldServiceId];
  if (!data.secrets[newServiceId]) data.secrets[newServiceId] = {};
  data.secrets[newServiceId][newField] = entry;
  data.templates = refactorTemplateRefs(
    data.templates,
    `\${${oldServiceId}.${oldField}}`,
    `\${${newServiceId}.${newField}}`
  );
  return data;
}

/**
 * Resolve secret values for a given env: env value wins over _global.
 */
export function resolveValue(entry, envId) {
  if (!entry?.values) return undefined;
  const envVal = entry.values[envId];
  if (envVal !== undefined && envVal !== '') return envVal;
  return entry.values[GLOBAL_ENV];
}
