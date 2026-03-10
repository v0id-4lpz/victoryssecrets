// template-ops.js — pure CRUD operations on templates + env file parsing + field tree

const TPL_KEY = 'main';

export function setTemplateEntry(data, key, value) {
  if (!data.templates[TPL_KEY]) data.templates[TPL_KEY] = {};
  data.templates[TPL_KEY][key] = value;
  return data;
}

export function deleteTemplateEntry(data, key) {
  delete data.templates?.[TPL_KEY]?.[key];
  return data;
}

export function clearTemplate(data) {
  if (data.templates?.[TPL_KEY]) {
    data.templates[TPL_KEY] = {};
  }
  return data;
}

export function getTemplate(data) {
  return data.templates?.[TPL_KEY] || {};
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

export function replaceTemplate(data, newTpl) {
  data.templates[TPL_KEY] = newTpl;
  return data;
}

export function mergeTemplate(data, incoming) {
  if (!data.templates[TPL_KEY]) data.templates[TPL_KEY] = {};
  for (const [key, val] of Object.entries(incoming)) {
    if (!(key in data.templates[TPL_KEY])) {
      data.templates[TPL_KEY][key] = val;
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
