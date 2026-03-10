// template-ops.js — pure CRUD operations on templates + env file parsing + field tree

export function setTemplateEntry(data, envId, key, value) {
  if (!data.templates[envId]) data.templates[envId] = {};
  data.templates[envId][key] = value;
  return data;
}

export function deleteTemplateEntry(data, envId, key) {
  delete data.templates?.[envId]?.[key];
  return data;
}

export function clearTemplate(data, envId) {
  if (data.templates?.[envId]) {
    data.templates[envId] = {};
  }
  return data;
}

export function getTemplate(data, envId) {
  return data.templates?.[envId] || {};
}

export function parseEnvFile(text) {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

export function buildServiceFieldTree(data) {
  const services = data.services || {};
  const allSecrets = data.secrets || {};
  const fieldsByService = {};
  const collectFields = (obj) => {
    for (const [serviceId, fields] of Object.entries(obj || {})) {
      if (typeof fields !== 'object') continue;
      if (!fieldsByService[serviceId]) fieldsByService[serviceId] = new Set();
      for (const f of Object.keys(fields)) {
        fieldsByService[serviceId].add(f);
      }
    }
  };
  collectFields(allSecrets.global);
  for (const envId of Object.keys(allSecrets.envs || {})) {
    collectFields(allSecrets.envs[envId]);
  }
  for (const sId of Object.keys(services)) {
    if (!fieldsByService[sId]) fieldsByService[sId] = new Set();
  }
  return { services, fieldsByService };
}
