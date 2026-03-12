// env-pills.ts — environment pill selector component

import { esc } from '../helpers';

const activeCls = 'bg-indigo-600 text-white';
const inactiveCls = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700';

export function renderEnvPills(envs: string[], selected: string | null, { showGlobal = false, id = 'env-pills' } = {}): string {
  const sorted = [...envs].sort((a, b) => a.localeCompare(b));
  const pills: string[] = [];

  if (showGlobal) {
    const cls = selected === null ? activeCls : inactiveCls;
    pills.push(`<button data-env-pill="" class="px-3 py-1 text-sm rounded-full cursor-pointer transition ${cls}">Global</button>`);
  }

  for (const env of sorted) {
    const cls = env === selected ? activeCls : inactiveCls;
    pills.push(`<button data-env-pill="${esc(env)}" class="px-3 py-1 text-sm rounded-full cursor-pointer transition ${cls}">${esc(env)}</button>`);
  }

  return `<div id="${id}" class="flex flex-wrap gap-2 mb-6">${pills.join('')}</div>`;
}

export function bindEnvPills(onChange: (envId: string | null) => void, id = 'env-pills'): void {
  document.getElementById(id)?.querySelectorAll('[data-env-pill]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const val = (btn as HTMLElement).dataset.envPill || null;
      onChange(val);
    };
  });
}
