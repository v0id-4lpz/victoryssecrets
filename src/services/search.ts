// search.ts — search index and filtering service

import type { VaultData, SearchResult } from '../types/vault';

export function buildSearchIndex(data: VaultData, getEnvComment?: (envId: string) => string): SearchResult[] {
  const results: SearchResult[] = [];

  for (const [id, s] of Object.entries(data.services || {})) {
    results.push({ type: 'service', id, label: s.label, comment: s.comment || '', section: 'services' });
  }

  for (const [envId, meta] of Object.entries(data.environments || {})) {
    const comment = getEnvComment ? getEnvComment(envId) : (meta?.comment || '');
    results.push({ type: 'env', id: envId, label: envId, comment, section: 'environments' });
  }

  for (const [serviceId, fields] of Object.entries(data.secrets || {})) {
    const svcLabel = data.services[serviceId]?.label || serviceId;
    for (const field of Object.keys(fields)) {
      results.push({
        type: 'secret',
        id: `${serviceId}:${field}`,
        label: `${svcLabel} / ${field}`,
        comment: '',
        section: 'secrets',
      });
    }
  }

  for (const [key, val] of Object.entries(data.templates?.main || {})) {
    results.push({
      type: 'template',
      id: key,
      label: `${key} = ${val}`,
      comment: '',
      section: 'templates',
    });
  }

  return results;
}

export function filterSearch(query: string, index: SearchResult[], limit = 20): SearchResult[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return index.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    item.comment.toLowerCase().includes(q)
  ).slice(0, limit);
}
