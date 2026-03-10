// services.js — services section

import * as vault from '../vault.js';
import { esc } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { renderEditableRow, bindEditableRows } from './components/editable-row.js';
import { startInlineEdit } from './components/inline-edit.js';
import { renderSectionHeader, renderAddButton } from './components/section-header.js';
import { renderEmptyState } from './components/empty-state.js';

export function renderServices(render) {
  const data = vault.getData();
  const services = Object.entries(data.services || {});
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Services', renderAddButton('btn-add-service'))}
      <div id="service-form" class="hidden mb-4 flex gap-2">
        <input id="service-label" type="text" placeholder="Label (ex: PostgreSQL)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <input id="service-id" type="text" placeholder="Identifiant (ex: postgres)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        ${renderButton('OK', { id: 'btn-save-service', variant: 'success' })}
      </div>
      ${services.length === 0
        ? renderEmptyState('Aucun service.')
        : `<div class="space-y-2">${services.map(([id, s]) =>
            renderEditableRow('data-edit-service', id,
              `<span class="font-medium text-sm">${esc(s.label)}</span>
               <span class="ml-2 text-xs text-gray-400">${esc(id)}</span>`,
              renderDeleteButton('data-delete-service', id)
            )
          ).join('')}</div>`
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

  bindEditableRows('[data-edit-service]', (row) => {
    const id = row.dataset.editService;
    const current = vault.getData().services[id]?.label || '';
    startInlineEdit(row, {
      value: current,
      onSave: async (newLabel) => {
        if (newLabel && newLabel !== current) await vault.renameService(id, newLabel);
        render();
      },
      onCancel: render,
    });
  }, ['[data-delete-service]']);

  bindDeleteButtons('[data-delete-service]', async (btn) => {
    if (confirm(`Supprimer le service "${btn.dataset.deleteService}" ?`)) {
      await vault.deleteService(btn.dataset.deleteService);
      render();
    }
  });
}
