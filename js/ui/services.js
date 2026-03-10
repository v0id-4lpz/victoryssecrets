// services.js — services section

import * as vault from '../vault.js';
import { esc } from './helpers.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { renderEditableRow, bindEditableRows } from './components/editable-row.js';
import { startInlineEdit, insertNewRow } from './components/inline-edit.js';
import { renderSectionHeader, renderAddButton } from './components/section-header.js';
import { renderEmptyState } from './components/empty-state.js';
import { showToast } from './components/toast.js';
import { sanitizeId, labelToId } from '../models/validators.js';

export function renderServices(render) {
  const data = vault.getData();
  const services = Object.entries(data.services || {});
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Services', renderAddButton('btn-add-service'))}
      <div id="service-list" class="space-y-2">
        ${services.length === 0
          ? renderEmptyState('Aucun service.')
          : services.map(([id, s]) =>
              renderEditableRow('data-edit-service', id,
                `<div class="min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span class="font-medium text-sm">${esc(s.label)}</span>
                    <span class="text-xs text-gray-400">${esc(id)}</span>
                  </div>
                  ${s.comment ? `<div class="text-xs text-gray-400 truncate">${esc(s.comment)}</div>` : ''}
                </div>`,
                renderDeleteButton('data-delete-service', id)
              )
            ).join('')
        }
      </div>
    </div>`;
}

function startServiceForm(container, render, { id, label, comment } = {}) {
  const isCreate = !id;

  startInlineEdit(container, {
    rows: [
      [
        { name: 'label', value: label || '', placeholder: 'Label (ex: PostgreSQL)' },
        { name: 'id', value: id || '', placeholder: 'Cle (ex: postgres)' },
      ],
      [
        { name: 'comment', value: comment || '', placeholder: 'Commentaire (optionnel)' },
      ],
    ],
    onInput: (name, value, getValues) => {
      if (isCreate && name === 'label') {
        const idInput = container.querySelector('input[name="id"]');
        if (idInput && !idInput._manuallyEdited) {
          idInput.value = labelToId(value);
        }
      }
      if (name === 'id') {
        container.querySelector('input[name="id"]')._manuallyEdited = true;
      }
    },
    onSave: async (values) => {
      const newId = sanitizeId(values.id);
      if (!values.label || !newId) return;
      try {
        if (isCreate) {
          await vault.addService(newId, values.label, values.comment);
          showToast('Service ajoute', 'success');
        } else {
          if (newId !== id) await vault.renameServiceId(id, newId);
          const targetId = newId !== id ? newId : id;
          if (values.label !== label) await vault.renameService(targetId, values.label);
          if (values.comment !== (comment || '')) await vault.setServiceComment(targetId, values.comment);
          showToast('Service modifie', 'success');
        }
        render();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    onCancel: render,
  });
}

export function bindServices(render) {
  document.getElementById('btn-add-service').onclick = () => {
    const list = document.getElementById('service-list');
    const row = insertNewRow(list);
    startServiceForm(row, render);
  };

  bindEditableRows('[data-edit-service]', (row) => {
    const id = row.dataset.editService;
    const service = vault.getData().services[id];
    startServiceForm(row, render, { id, label: service?.label, comment: service?.comment });
  }, ['[data-delete-service]']);

  bindDeleteButtons('[data-delete-service]', async (btn) => {
    if (confirm(`Supprimer le service "${btn.dataset.deleteService}" ?`)) {
      await vault.deleteService(btn.dataset.deleteService);
      render();
    }
  });
}
