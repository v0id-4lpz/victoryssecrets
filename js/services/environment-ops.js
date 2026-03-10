// environment-ops.js — pure CRUD operations on environments within vault data

export function getEnvironmentIds(data) {
  return Object.keys(data.environments || {});
}

export function hasEnvironment(data, envId) {
  return envId in (data.environments || {});
}

export function addEnvironment(data, envId, comment = '') {
  if (hasEnvironment(data, envId)) throw new Error(`Environment "${envId}" already exists`);
  data.environments[envId] = { comment };
  return data;
}

export function renameEnvironment(data, oldId, newId) {
  if (!hasEnvironment(data, oldId) || hasEnvironment(data, newId)) return data;
  data.environments[newId] = data.environments[oldId];
  delete data.environments[oldId];
  // Rename env key in all secret values
  for (const fields of Object.values(data.secrets || {})) {
    for (const entry of Object.values(fields)) {
      if (entry.values && oldId in entry.values) {
        entry.values[newId] = entry.values[oldId];
        delete entry.values[oldId];
      }
    }
  }
  return data;
}

export function deleteEnvironment(data, envId) {
  delete data.environments[envId];
  // Remove env key from all secret values
  for (const fields of Object.values(data.secrets || {})) {
    for (const entry of Object.values(fields)) {
      if (entry.values) delete entry.values[envId];
    }
  }
  return data;
}

export function setEnvironmentComment(data, envId, comment) {
  if (!data.environments[envId]) data.environments[envId] = {};
  data.environments[envId].comment = comment;
  return data;
}

export function getEnvironmentComment(data, envId) {
  return data.environments?.[envId]?.comment || '';
}
