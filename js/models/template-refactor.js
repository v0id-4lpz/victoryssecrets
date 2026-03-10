// template-refactor.js — pure template reference refactoring

const TPL_KEY = 'main';

/**
 * Replace all occurrences of a pattern in template values.
 * @param {object} templates - { main: { key: value } }
 * @param {string} pattern - string to find
 * @param {string} replacement - string to replace with
 * @returns {object} new templates object (immutable)
 */
export function refactorTemplateRefs(templates, pattern, replacement) {
  const tpl = templates[TPL_KEY] || {};
  const result = {};
  for (const [key, val] of Object.entries(tpl)) {
    result[key] = typeof val === 'string' && val.includes(pattern)
      ? val.replace(pattern, replacement)
      : val;
  }
  return { [TPL_KEY]: result };
}

/**
 * Replace all template refs for a service rename: ${oldId.*} → ${newId.*}
 */
export function refactorServiceId(templates, oldId, newId) {
  const tpl = templates[TPL_KEY] || {};
  const regex = new RegExp(`\\$\\{${escapeRegex(oldId)}\\.`, 'g');
  const replacement = `\${${newId}.`;
  const result = {};
  for (const [key, val] of Object.entries(tpl)) {
    result[key] = typeof val === 'string' ? val.replace(regex, replacement) : val;
  }
  return { [TPL_KEY]: result };
}

/**
 * Remove template entries that reference a deleted service.
 */
export function removeServiceRefs(templates, serviceId) {
  const tpl = templates[TPL_KEY] || {};
  const result = {};
  for (const [key, val] of Object.entries(tpl)) {
    const m = typeof val === 'string' && val.match(/^\$\{(.+?)\.(.+)\}$/);
    if (m && m[1] === serviceId) continue;
    result[key] = val;
  }
  return { [TPL_KEY]: result };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
