// template-refactor.js — pure template reference refactoring

/**
 * Replace all occurrences of a pattern in template values.
 * @param {object} templates - { envId: { key: value } }
 * @param {string} pattern - string to find
 * @param {string} replacement - string to replace with
 * @returns {object} new templates object (immutable)
 */
export function refactorTemplateRefs(templates, pattern, replacement) {
  const result = {};
  for (const envId of Object.keys(templates)) {
    result[envId] = {};
    for (const [key, val] of Object.entries(templates[envId])) {
      result[envId][key] = typeof val === 'string' && val.includes(pattern)
        ? val.replace(pattern, replacement)
        : val;
    }
  }
  return result;
}

/**
 * Replace all template refs for a service rename: ${oldId.*} → ${newId.*}
 */
export function refactorServiceId(templates, oldId, newId) {
  const result = {};
  const regex = new RegExp(`\\$\\{${escapeRegex(oldId)}\\.`, 'g');
  const replacement = `\${${newId}.`;
  for (const envId of Object.keys(templates)) {
    result[envId] = {};
    for (const [key, val] of Object.entries(templates[envId])) {
      result[envId][key] = typeof val === 'string' ? val.replace(regex, replacement) : val;
    }
  }
  return result;
}

/**
 * Remove template entries that reference a deleted service.
 */
export function removeServiceRefs(templates, serviceId) {
  const result = {};
  for (const envId of Object.keys(templates)) {
    result[envId] = {};
    for (const [key, val] of Object.entries(templates[envId])) {
      const m = typeof val === 'string' && val.match(/^\$\{(.+?)\.(.+)\}$/);
      if (m && m[1] === serviceId) continue;
      result[envId][key] = val;
    }
  }
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
