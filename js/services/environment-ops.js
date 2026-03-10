// environment-ops.js — pure CRUD operations on environments within vault data

export function hasEnvironment(data, envId) {
  return data.environments.includes(envId);
}

export function addEnvironment(data, envId, comment = '') {
  if (data.environments.includes(envId)) throw new Error(`Environment "${envId}" already exists`);
  data.environments.push(envId);
  if (!data.environmentMeta) data.environmentMeta = {};
  if (!data.environmentMeta[envId]) data.environmentMeta[envId] = {};
  data.environmentMeta[envId].comment = comment;
  if (!data.secrets.envs[envId]) data.secrets.envs[envId] = {};
  if (!data.templates[envId]) data.templates[envId] = {};
  return data;
}

export function renameEnvironment(data, oldId, newId) {
  const idx = data.environments.indexOf(oldId);
  if (idx === -1 || data.environments.includes(newId)) return data;
  data.environments[idx] = newId;
  if (data.secrets.envs[oldId]) {
    data.secrets.envs[newId] = data.secrets.envs[oldId];
    delete data.secrets.envs[oldId];
  }
  if (data.templates[oldId]) {
    data.templates[newId] = data.templates[oldId];
    delete data.templates[oldId];
  }
  if (data.environmentMeta?.[oldId]) {
    if (!data.environmentMeta) data.environmentMeta = {};
    data.environmentMeta[newId] = data.environmentMeta[oldId];
    delete data.environmentMeta[oldId];
  }
  return data;
}

export function deleteEnvironment(data, envId) {
  const idx = data.environments.indexOf(envId);
  if (idx !== -1) data.environments.splice(idx, 1);
  delete data.secrets.envs[envId];
  delete data.templates[envId];
  delete data.environmentMeta?.[envId];
  return data;
}

export function setEnvironmentComment(data, envId, comment) {
  if (!data.environmentMeta) data.environmentMeta = {};
  if (!data.environmentMeta[envId]) data.environmentMeta[envId] = {};
  data.environmentMeta[envId].comment = comment;
  return data;
}

export function getEnvironmentComment(data, envId) {
  return data.environmentMeta?.[envId]?.comment || '';
}
