// services.js — services section

import * as vault from '../vault.js';
import { esc } from './helpers.js';

export function renderServices(render) {
  const data = vault.getData();
  const services = Object.entries(data.services || {});
  return `
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">Services</h2>
        <button id="btn-add-service" class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">+ Ajouter</button>
      </div>
      <div id="service-form" class="hidden mb-4 flex gap-2">
        <input id="service-label" type="text" placeholder="Label (ex: PostgreSQL)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <input id="service-id" type="text" placeholder="Identifiant (ex: postgres)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <button id="btn-save-service" class="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">OK</button>
      </div>
      ${services.length === 0
        ? '<p class="text-gray-400 text-sm">Aucun service.</p>'
        : `<div class="space-y-2">${services.map(([id, s]) => `
          <div class="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div>
              <span class="font-medium text-sm">${esc(s.label)}</span>
              <span class="ml-2 text-xs text-gray-400">${esc(id)}</span>
            </div>
            <button data-delete-service="${id}" class="text-red-400 hover:text-red-600 text-sm transition">Supprimer</button>
          </div>`).join('')}</div>`
      }
    </div>`;
}

export function bindServices(render) {
  document.getElementById('btn-add-service').onclick = () => {
    document.getElementById('service-form').classList.toggle('hidden');
    document.getElementById('service-label').focus();
  };
  document.getElementById('btn-save-service').onclick = async () => {
    const id = document.getElementById('service-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const label = document.getElementById('service-label').value.trim();
    if (id && label) { await vault.addService(id, label); render(); }
  };
  document.querySelectorAll('[data-delete-service]').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Supprimer le service "${btn.dataset.deleteService}" ?`)) {
        await vault.deleteService(btn.dataset.deleteService);
        render();
      }
    };
  });
}
