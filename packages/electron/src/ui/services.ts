// services.ts — services section

import * as vault from '../vault';
import { guardReadOnly } from '../vault';
import { esc } from './helpers';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button';
import { renderEditableRow, bindEditableRows } from './components/editable-row';
import { startInlineEdit, insertNewRow } from './components/inline-edit';
import { renderSectionHeader, renderAddButton } from './components/section-header';
import { renderEmptyState } from './components/empty-state';
import { showToast } from './components/toast';
import { sanitizeId, labelToId } from 'vsv/models/validators';

export function renderServices(render: () => void): string {
  const data = vault.getData();
  const services = Object.entries(data.services || {}).sort(([, a], [, b]) => a.label.localeCompare(b.label));
  return `
    <div class="max-w-3xl">
      ${renderSectionHeader('Services', renderAddButton('btn-add-service'))}
      <div id="service-list" class="space-y-2">
        ${services.length === 0
          ? renderEmptyState('No services.')
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

function startServiceForm(container: HTMLElement, render: () => void, { id, label, comment }: { id?: string; label?: string; comment?: string } = {}): void {
  const isCreate = !id;

  startInlineEdit(container, {
    rows: [
      [
        { name: 'label', value: label || '', placeholder: 'Label (e.g. PostgreSQL)' },
        { name: 'id', value: id || '', placeholder: 'Key (e.g. postgres)' },
      ],
      [
        { name: 'comment', value: comment || '', placeholder: 'Comment (optional)' },
      ],
    ],
    onInput: (name, value, _getValues) => {
      if (isCreate && name === 'label') {
        const idInput = container.querySelector('input[name="id"]') as HTMLInputElement & { _manuallyEdited?: boolean } | null;
        if (idInput && !idInput._manuallyEdited) {
          idInput.value = labelToId(value);
        }
      }
      if (name === 'id') {
        const idInput = container.querySelector('input[name="id"]') as HTMLInputElement & { _manuallyEdited?: boolean } | null;
        if (idInput) idInput._manuallyEdited = true;
      }
    },
    onSave: async (values) => {
      const newId = sanitizeId(values.id as string);
      if (!values.label || !newId) return;
      try {
        if (isCreate) {
          await vault.addService(newId, values.label as string, values.comment as string);
          showToast('Service added', 'success');
        } else {
          if (newId !== id) await vault.renameServiceId(id!, newId);
          const targetId = newId !== id ? newId : id!;
          if (values.label !== label) await vault.renameService(targetId, values.label as string);
          if (values.comment !== (comment || '')) await vault.setServiceComment(targetId, values.comment as string);
          showToast('Service updated', 'success');
        }
        render();
      } catch (e: any) {
        showToast(e.message, 'error');
      }
    },
    onCancel: render,
  });
}

export function bindServices(render: () => void): void {
  document.getElementById('btn-add-service')!.onclick = () => {
    if (guardReadOnly()) return;
    const list = document.getElementById('service-list')!;
    const row = insertNewRow(list);
    startServiceForm(row, render);
  };

  bindEditableRows('[data-edit-service]', (row) => {
    if (guardReadOnly()) return;
    const id = row.dataset.editService!;
    const service = vault.getData().services[id];
    startServiceForm(row, render, { id, label: service?.label, comment: service?.comment });
  }, ['[data-delete-service]']);

  bindDeleteButtons('[data-delete-service]', async (btn) => {
    if (guardReadOnly()) return;
    if (confirm(`Delete service "${btn.dataset.deleteService}"?`)) {
      await vault.deleteService(btn.dataset.deleteService!);
      render();
    }
  });
}
