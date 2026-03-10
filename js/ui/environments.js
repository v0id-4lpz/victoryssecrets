// environments.js — environments section

import * as vault from '../vault.js';
import { esc } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { renderEditableRow, bindEditableRows } from './components/editable-row.js';
import { startInlineEdit } from './components/inline-edit.js';
import { renderSectionHeader, renderAddButton } from './components/section-header.js';
import { renderEmptyState } from './components/empty-state.js';

export function renderEnvironments(render) {
  const data = vault.getData();
  const envs = data.environments || [];
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Environnements', renderAddButton('btn-add-env'))}
      <div id="env-form" class="hidden mb-4 flex gap-2">
        <input id="env-id" type="text" placeholder="ex: dev, staging, prod" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        ${renderButton('OK', { id: 'btn-save-env', variant: 'success' })}
      </div>
      ${envs.length === 0
        ? renderEmptyState('Aucun environnement.')
        : `<div class="space-y-2">${envs.map(env =>
            renderEditableRow('data-edit-env', env,
              `<span class="font-medium text-sm">${esc(env)}</span>`,
              renderDeleteButton('data-delete-env', env)
            )
          ).join('')}</div>`
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

  bindEditableRows('[data-edit-env]', (row) => {
    const oldId = row.dataset.editEnv;
    startInlineEdit(row, {
      value: oldId,
      onSave: async (newId) => {
        const sanitized = newId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (sanitized && sanitized !== oldId) await vault.renameEnvironment(oldId, sanitized);
        render();
      },
      onCancel: render,
    });
  }, ['[data-delete-env]']);

  bindDeleteButtons('[data-delete-env]', async (btn) => {
    if (confirm(`Supprimer l'environnement "${btn.dataset.deleteEnv}" ?`)) {
      await vault.deleteEnvironment(btn.dataset.deleteEnv);
      render();
    }
  });
}
