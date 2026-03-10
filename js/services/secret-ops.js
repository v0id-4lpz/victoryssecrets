// secret-ops.js — pure CRUD operations on secrets within vault data

import { refactorTemplateRefs } from '../models/template-refactor.js';

export function getSecretsAtLevel(data, level) {
  if (level.scope === 'global') {
    return data.secrets.global;
  } else if (level.scope === 'env') {
    if (!data.secrets.envs[level.envId]) {
      data.secrets.envs[level.envId] = {};
    }
    return data.secrets.envs[level.envId];
  }
  return {};
}

export function setSecret(data, level, serviceId, fieldName, value, isSecret = true) {
  const target = getSecretsAtLevel(data, level);
  if (!target[serviceId]) target[serviceId] = {};
  target[serviceId][fieldName] = { value, secret: isSecret };
  return data;
}

export function deleteSecret(data, level, serviceId, fieldName) {
  const target = getSecretsAtLevel(data, level);
  if (target[serviceId]) {
    delete target[serviceId][fieldName];
    if (Object.keys(target[serviceId]).length === 0) delete target[serviceId];
  }
  return data;
}

export function moveSecret(data, level, oldServiceId, oldField, newServiceId, newField) {
  const target = getSecretsAtLevel(data, level);
  if (!target[oldServiceId]?.[oldField]) return data;
  const entry = target[oldServiceId][oldField];
  delete target[oldServiceId][oldField];
  if (Object.keys(target[oldServiceId]).length === 0) delete target[oldServiceId];
  if (!target[newServiceId]) target[newServiceId] = {};
  target[newServiceId][newField] = entry;
  data.templates = refactorTemplateRefs(
    data.templates,
    `\${${oldServiceId}.${oldField}}`,
    `\${${newServiceId}.${newField}}`
  );
  return data;
}
