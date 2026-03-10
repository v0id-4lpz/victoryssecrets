// search.js — search index and filtering service

/**
 * Build a search index from vault data.
 * @param {object} data - vault data
 * @param {function} getEnvComment - (envId) => string
 * @returns {Array<{type, id, label, comment, section}>}
 */
export function buildSearchIndex(data, getEnvComment) {
  const results = [];

  for (const [id, s] of Object.entries(data.services || {})) {
    results.push({ type: 'service', id, label: s.label, comment: s.comment || '', section: 'services' });
  }

  for (const env of data.environments || []) {
    const comment = getEnvComment ? getEnvComment(env) : '';
    results.push({ type: 'env', id: env, label: env, comment, section: 'environments' });
  }

  const addSecrets = (scope, envId) => {
    const secrets = scope === 'global' ? data.secrets?.global : data.secrets?.envs?.[envId];
    if (!secrets) return;
    for (const [serviceId, fields] of Object.entries(secrets)) {
      const svcLabel = data.services[serviceId]?.label || serviceId;
      for (const field of Object.keys(fields)) {
        results.push({
          type: 'secret',
          id: `${serviceId}:${field}`,
          label: `${svcLabel} / ${field}`,
          comment: envId ? `env: ${envId}` : 'global',
          section: 'secrets',
        });
      }
    }
  };
  addSecrets('global');
  for (const envId of Object.keys(data.secrets?.envs || {})) {
    addSecrets('env', envId);
  }

  for (const envId of Object.keys(data.templates || {})) {
    for (const [key, val] of Object.entries(data.templates[envId])) {
      results.push({
        type: 'template',
        id: `${envId}:${key}`,
        label: `${key} = ${val}`,
        comment: `env: ${envId}`,
        section: 'templates',
      });
    }
  }

  return results;
}

/**
 * Filter search results by query.
 */
export function filterSearch(query, index, limit = 20) {
  if (!query) return [];
  const q = query.toLowerCase();
  return index.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    item.comment.toLowerCase().includes(q)
  ).slice(0, limit);
}
