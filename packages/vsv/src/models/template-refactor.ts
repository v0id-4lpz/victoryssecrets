// template-refactor.ts — pure template reference refactoring

import type { Templates } from '../types/vault';

const TPL_KEY = 'main';

export function refactorTemplateRefs(templates: Templates, pattern: string, replacement: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    if (typeof val !== 'string') continue;
    result[key] = val.replaceAll(pattern, replacement);
  }
  return { [TPL_KEY]: result };
}

export function refactorServiceId(templates: Templates, oldId: string, newId: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const regex = new RegExp(`\\$\\{${escapeRegex(oldId)}\\.`, 'g');
  const replacement = `\${${newId}.`;
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    if (typeof val !== 'string') continue;
    result[key] = val.replace(regex, replacement);
  }
  return { [TPL_KEY]: result };
}

export function removeServiceRefs(templates: Templates, serviceId: string): Templates {
  const tpl = templates[TPL_KEY] || {};
  const regex = new RegExp(`\\$\\{${escapeRegex(serviceId)}\\.`);
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(tpl)) {
    if (typeof val !== 'string') continue;
    if (regex.test(val)) continue;
    result[key] = val;
  }
  return { [TPL_KEY]: result };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
