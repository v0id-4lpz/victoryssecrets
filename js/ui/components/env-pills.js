// env-pills.js — environment pill selector component

import { esc } from '../helpers.js';

const activeCls = 'bg-indigo-600 text-white';
const inactiveCls = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700';

/**
 * Render environment pills.
 * @param {string[]} envs - list of environment ids
 * @param {string|null} selected - currently selected env (null = Global)
 * @param {object} [opts]
 * @param {boolean} [opts.showGlobal=false] - show a "Global" pill
 * @param {string} [opts.id='env-pills'] - container id
 */
export function renderEnvPills(envs, selected, { showGlobal = false, id = 'env-pills' } = {}) {
  const sorted = [...envs].sort((a, b) => a.localeCompare(b));
  const pills = [];

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

/**
 * Bind pill click handlers.
 * @param {function} onChange - called with envId (string) or null (Global)
 * @param {string} [id='env-pills'] - container id
 */
export function bindEnvPills(onChange, id = 'env-pills') {
  document.getElementById(id)?.querySelectorAll('[data-env-pill]').forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.envPill || null;
      onChange(val);
    };
  });
}
