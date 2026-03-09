// environments.js — environments section

import * as vault from '../vault.js';
import { esc } from './helpers.js';

export function renderEnvironments(render) {
  const data = vault.getData();
  const envs = data.environments || [];
  return `
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">Environnements</h2>
        <button id="btn-add-env" class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">+ Ajouter</button>
      </div>
      <div id="env-form" class="hidden mb-4 flex gap-2">
        <input id="env-id" type="text" placeholder="ex: dev, staging, prod" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <button id="btn-save-env" class="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">OK</button>
      </div>
      ${envs.length === 0
        ? '<p class="text-gray-400 text-sm">Aucun environnement.</p>'
        : `<div class="space-y-2">${envs.map(env => `
          <div class="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <span class="font-medium text-sm">${esc(env)}</span>
            <button data-delete-env="${env}" class="text-red-400 hover:text-red-600 text-sm transition">Supprimer</button>
          </div>`).join('')}</div>`
      }
    </div>`;
}

export function bindEnvironments(render) {
  document.getElementById('btn-add-env').onclick = () => {
    document.getElementById('env-form').classList.toggle('hidden');
    document.getElementById('env-id').focus();
  };
  document.getElementById('btn-save-env').onclick = async () => {
    const envId = document.getElementById('env-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (envId) { await vault.addEnvironment(envId); render(); }
  };
  document.querySelectorAll('[data-delete-env]').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Supprimer l'environnement "${btn.dataset.deleteEnv}" ?`)) {
        await vault.deleteEnvironment(btn.dataset.deleteEnv);
        render();
      }
    };
  });
}
