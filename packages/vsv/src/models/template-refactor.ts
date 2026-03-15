// template-refactor.ts — pure template reference refactoring

import type { Templates } from '../types/vault';

const TPL_KEY = 'main';

export function refactorTemplateRefs(templates: Templates, pattern: string, replacement: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    result[key] = typeof val === 'string' && val.includes(pattern)
      ? val.replace(pattern, replacement)
      : val;
  }
  return { [TPL_KEY]: result };
}

export function refactorServiceId(templates: Templates, oldId: string, newId: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const regex = new RegExp(`\\$\\{${escapeRegex(oldId)}\\.`, 'g');
  const replacement = `\${${newId}.`;
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    result[key] = typeof val === 'string' ? val.replace(regex, replacement) : val;
  }
  return { [TPL_KEY]: result };
}

export function removeServiceRefs(templates: Templates, serviceId: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const regex = new RegExp(`\\$\\{${escapeRegex(serviceId)}\\.`);
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    if (typeof val === 'string' && regex.test(val)) continue;
    result[key] = val;
  }
  return { [TPL_KEY]: result };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
