// environments.js — environments section

import * as vault from '../vault.js';
import { esc } from './helpers.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { renderEditableRow, bindEditableRows } from './components/editable-row.js';
import { startInlineEdit, insertNewRow } from './components/inline-edit.js';
import { renderSectionHeader, renderAddButton } from './components/section-header.js';
import { renderEmptyState } from './components/empty-state.js';
import { showToast } from './components/toast.js';
import { sanitizeId } from '../models/validators.js';

export function renderEnvironments(render) {
  const data = vault.getData();
  const envs = data.environments || [];
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Environnements', renderAddButton('btn-add-env'))}
      <div id="env-list" class="space-y-2">
        ${envs.length === 0
          ? renderEmptyState('Aucun environnement.')
          : envs.map(env => {
              const comment = vault.getEnvironmentComment(env);
              return renderEditableRow('data-edit-env', env,
                `<div class="min-w-0">
                  <span class="font-medium text-sm">${esc(env)}</span>
                  ${comment ? `<div class="text-xs text-gray-400 truncate">${esc(comment)}</div>` : ''}
                </div>`,
                renderDeleteButton('data-delete-env', env)
              );
            }).join('')
        }
      </div>
    </div>`;
}

function startEnvForm(container, render, { id, comment } = {}) {
  const isCreate = !id;
  startInlineEdit(container, {
    rows: [
      [
        { name: 'id', value: id || '', placeholder: 'ex: dev, staging, prod' },
      ],
      [
        { name: 'comment', value: comment || '', placeholder: 'Commentaire (optionnel)' },
      ],
    ],
    onSave: async (values) => {
      const newId = sanitizeId(values.id);
      if (!newId) return;
      try {
        if (isCreate) {
          await vault.addEnvironment(newId, values.comment);
          showToast('Environnement ajoute', 'success');
        } else {
          if (newId !== id) await vault.renameEnvironment(id, newId);
          const targetId = newId !== id ? newId : id;
          if (values.comment !== (comment || '')) await vault.setEnvironmentComment(targetId, values.comment);
          showToast('Environnement modifie', 'success');
        }
        render();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    onCancel: render,
  });
}

export function bindEnvironments(render) {
  document.getElementById('btn-add-env').onclick = () => {
    const list = document.getElementById('env-list');
    const row = insertNewRow(list);
    startEnvForm(row, render);
  };

  bindEditableRows('[data-edit-env]', (row) => {
    const id = row.dataset.editEnv;
    const comment = vault.getEnvironmentComment(id);
    startEnvForm(row, render, { id, comment });
  }, ['[data-delete-env]']);

  bindDeleteButtons('[data-delete-env]', async (btn) => {
    if (confirm(`Supprimer l'environnement "${btn.dataset.deleteEnv}" ?`)) {
      await vault.deleteEnvironment(btn.dataset.deleteEnv);
      render();
    }
  });
}
