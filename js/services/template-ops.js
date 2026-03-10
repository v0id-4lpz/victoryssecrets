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

export function serializeTemplate(tpl) {
  return Object.entries(tpl)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
}

export function parseTemplateText(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

export function replaceTemplate(data, envId, newTpl) {
  data.templates[envId] = newTpl;
  return data;
}

export function mergeTemplate(data, envId, incoming) {
  if (!data.templates[envId]) data.templates[envId] = {};
  for (const [key, val] of Object.entries(incoming)) {
    if (!(key in data.templates[envId])) {
      data.templates[envId][key] = val;
    }
  }
  return data;
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
