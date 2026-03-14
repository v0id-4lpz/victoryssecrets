// environments.ts — environments section

import * as vault from '../vault';
import { guardReadOnly } from '../vault';
import { esc } from './helpers';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button';
import { renderEditableRow, bindEditableRows } from './components/editable-row';
import { startInlineEdit, insertNewRow } from './components/inline-edit';
import { renderSectionHeader, renderAddButton } from './components/section-header';
import { renderEmptyState } from './components/empty-state';
import { showToast } from './components/toast';
import { sanitizeId } from 'vsv/models/validators';

export function renderEnvironments(render: () => void): string {
  const data = vault.getData();
  const envs = Object.keys(data.environments || {}).sort((a, b) => a.localeCompare(b));
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Environments', renderAddButton('btn-add-env'))}
      <div id="env-list" class="space-y-2">
        ${envs.length === 0
          ? renderEmptyState('No environments.')
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

function startEnvForm(container: HTMLElement, render: () => void, { id, comment }: { id?: string; comment?: string } = {}): void {
  const isCreate = !id;
  startInlineEdit(container, {
    rows: [
      [
        { name: 'id', value: id || '', placeholder: 'ex: dev, staging, prod' },
      ],
      [
        { name: 'comment', value: comment || '', placeholder: 'Comment (optional)' },
      ],
    ],
    onSave: async (values) => {
      const newId = sanitizeId(values.id as string);
      if (!newId) return;
      try {
        if (isCreate) {
          await vault.addEnvironment(newId, values.comment as string);
          showToast('Environment added', 'success');
        } else {
          if (newId !== id) await vault.renameEnvironment(id!, newId);
          const targetId = newId !== id ? newId : id!;
          if (values.comment !== (comment || '')) await vault.setEnvironmentComment(targetId, values.comment as string);
          showToast('Environment updated', 'success');
        }
        render();
      } catch (e: any) {
        showToast(e.message, 'error');
      }
    },
    onCancel: render,
  });
}

export function bindEnvironments(render: () => void): void {
  document.getElementById('btn-add-env')!.onclick = () => {
    if (guardReadOnly()) return;
    const list = document.getElementById('env-list')!;
    const row = insertNewRow(list);
    startEnvForm(row, render);
  };

  bindEditableRows('[data-edit-env]', (row) => {
    if (guardReadOnly()) return;
    const id = row.dataset.editEnv!;
    const comment = vault.getEnvironmentComment(id);
    startEnvForm(row, render, { id, comment });
  }, ['[data-delete-env]']);

  bindDeleteButtons('[data-delete-env]', async (btn) => {
    if (guardReadOnly()) return;
    if (confirm(`Delete environment "${btn.dataset.deleteEnv}"?`)) {
      await vault.deleteEnvironment(btn.dataset.deleteEnv!);
      render();
    }
  });
}
