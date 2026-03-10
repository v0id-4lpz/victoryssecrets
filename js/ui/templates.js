// templates.js — templates section + value picker

import * as vault from '../vault.js';
import { importEnvFile } from '../storage.js';
import { esc, selectedEnv, setSelectedEnv, renderEnvOptions } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { bindEditableRows } from './components/editable-row.js';
import { startInlineEdit } from './components/inline-edit.js';
import { showConfirmDialog } from './components/confirm-dialog.js';
import { icons } from './components/icon.js';
import { makeClearable } from './components/clearable-input.js';
import { parseTemplateText, serializeTemplate, buildServiceFieldTree } from '../services/template-ops.js';

let textMode = false;
let activeEditCancel = null;

function renderValuePickerDropdown() {
  const { services, fieldsByService } = buildServiceFieldTree(vault.getData());
  const serviceEntries = Object.entries(fieldsByService).sort(([a], [b]) => {
    const labelA = services[a]?.label || a;
    const labelB = services[b]?.label || b;
    return labelA.localeCompare(labelB);
  });
  return `
    <div id="tpl-picker-dropdown" class="hidden absolute z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
      <div class="p-2 border-b border-gray-200 dark:border-gray-700">
        <input id="tpl-picker-search" type="text" placeholder="Search..." class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
      </div>
      <div id="tpl-picker-list" class="p-1">
        ${serviceEntries.map(([serviceId, fields]) => `
          <div class="tpl-picker-group" data-service="${serviceId}">
            <div class="px-2 py-1 text-xs font-semibold text-indigo-400 uppercase tracking-wide">${esc(services[serviceId]?.label || serviceId)}</div>
            ${[...fields].sort((a, b) => a.localeCompare(b)).map(f => `
              <button data-pick-ref="${serviceId}.${f}" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">
                \${${serviceId}.${f}}
              </button>
            `).join('')}
            ${fields.size === 0 ? '<div class="px-3 py-1 text-xs text-gray-500 italic">No fields defined</div>' : ''}
          </div>
        `).join('')}
        <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
          <div class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Magic variables</div>
          <button data-pick-ref="_ENV_NAME" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">\${_ENV_NAME}</button>
        </div>
      </div>
    </div>`;
}

function filterPickerList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('[data-pick-ref]').forEach(btn => {
    const match = btn.dataset.pickRef.toLowerCase().includes(q);
    btn.classList.toggle('hidden', !match);
  });
  document.querySelectorAll('.tpl-picker-group').forEach(group => {
    const visibleChildren = group.querySelectorAll('[data-pick-ref]:not(.hidden)');
    group.classList.toggle('hidden', visibleChildren.length === 0);
  });
}

function renderNormalView(tpl) {
  const entries = Object.entries(tpl).sort(([a], [b]) => a.localeCompare(b));
  return `
    <div id="tpl-entry-list" class="space-y-1">
      ${entries.length === 0
        ? '<p class="text-gray-400 text-xs">No entries.</p>'
        : entries.map(([key, val]) => `
          <div class="group flex items-center gap-3 text-sm py-1 font-mono cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition ${!val ? 'border-l-2 border-amber-400' : ''}" data-edit-tpl="${esc(key)}">
            <span class="w-48 ${val ? 'text-gray-300' : 'text-amber-500 font-medium'} shrink-0 pointer-events-none">${esc(key)}</span>
            <span class="flex-1 ${val ? 'text-gray-500' : 'text-amber-400 italic'} pointer-events-none">${val ? esc(val) : 'Not assigned'}</span>
            ${renderDeleteButton('data-delete-tpl', key)}
          </div>`).join('')
      }
    </div>
    <!-- Shared picker dropdown -->
    <div class="relative">${renderValuePickerDropdown()}</div>`;
}

function renderTextView(tpl) {
  const text = serializeTemplate(tpl);
  return `
    <div>
      <textarea id="tpl-textarea" rows="14" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y" placeholder="KEY=value&#10;DATABASE_URL=\${pg.url}&#10;...">${esc(text)}</textarea>
      <p class="text-xs text-gray-400 mt-1">One entry per line: KEY=value. Use \${service.field} to reference secrets.</p>
    </div>`;
}

export function renderTemplates(render) {
  const data = vault.getData();
  const envs = data.environments || [];

  let envOptions = renderEnvOptions(envs, selectedEnv);

  let templateContent = '';
  if (selectedEnv) {
    const tpl = vault.getTemplate(selectedEnv);
    const entries = Object.entries(tpl);
    const toggleLabel = textMode ? 'Normal view' : 'Text view';

    templateContent = `
      <div class="mt-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-semibold shrink-0">Mapping</h3>
            ${!textMode ? `<input id="tpl-filter" type="text" placeholder="Filter keys..." class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-40" />` : ''}
          </div>
          <div class="flex items-center gap-3">
            ${!textMode ? renderButton('+ Add', { id: 'btn-add-tpl-entry', variant: 'ghost' }) : ''}
            ${renderButton('Import .env', { id: 'btn-import-env', variant: 'ghost' })}
            <span class="text-gray-300 dark:text-gray-600">|</span>
            ${renderButton(toggleLabel, { id: 'btn-toggle-text-mode', variant: 'ghost' })}
            ${!textMode && entries.length > 0 ? `<span class="text-gray-300 dark:text-gray-600">|</span>${renderButton('Clear', { id: 'btn-clear-tpl', variant: 'danger' })}` : ''}
          </div>
        </div>
        ${textMode ? renderTextView(tpl) : renderNormalView(tpl)}
      </div>`;
  }

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Templates .env</h2>
      <div class="flex gap-3 mb-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environment</label>
          <select id="tpl-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${envOptions}
          </select>
        </div>
      </div>
      ${templateContent}
    </div>`;
}

function startTplForm(container, render, { key, value } = {}) {
  if (activeEditCancel) activeEditCancel(false);
  const isCreate = !key;

  const originalHtml = container.innerHTML;
  const cancel = (fullRender = true) => {
    if (activeEditCancel === cancel) activeEditCancel = null;
    if (fullRender) { render(); return; }
    if (isCreate) container.remove();
    else container.innerHTML = originalHtml;
  };
  activeEditCancel = cancel;

  startInlineEdit(container, {
    focusField: isCreate ? undefined : 'value',
    rows: [
      [{ name: 'key', value: key || '', placeholder: 'ENV_VAR_NAME', cls: 'flex-1 font-mono' }],
      [{ name: 'value', value: value || '', placeholder: 'Value or ${service.field}', cls: 'flex-1 font-mono' }],
    ],
    onSave: async (values) => {
      const k = values.key.trim();
      const v = values.value.trim();
      if (!k || !selectedEnv) return;
      if (!isCreate && k !== key) {
        await vault.deleteTemplateEntry(selectedEnv, key);
      }
      await vault.setTemplateEntry(selectedEnv, k, v);
      activeEditCancel = null;
      render();
    },
    onCancel: cancel,
    onReady: (el) => {
      const valueInput = el.querySelector('input[name="value"]');
      const dropdown = document.getElementById('tpl-picker-dropdown');
      const search = document.getElementById('tpl-picker-search');

      if (valueInput && dropdown) {
        makeClearable(valueInput);

        const openDropdown = () => {
          const rect = valueInput.getBoundingClientRect();
          dropdown.style.position = 'fixed';
          dropdown.style.left = rect.left + 'px';
          dropdown.style.top = (rect.bottom + 4) + 'px';
          dropdown.classList.remove('hidden');
          if (search) { search.value = ''; filterPickerList(''); }
        };

        valueInput.addEventListener('focus', openDropdown);

        const pickValue = (val) => {
          valueInput.value = val;
          dropdown.classList.add('hidden');
          valueInput.focus();
        };

        document.querySelectorAll('[data-pick-ref]').forEach(btn => {
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pickValue(`\${${btn.dataset.pickRef}}`);
          });
        });

        if (search) {
          makeClearable(search, { onInput: filterPickerList, onClear: () => filterPickerList('') });
        }

        const closeHandler = (e) => {
          if (!dropdown.contains(e.target) && e.target !== valueInput) {
            dropdown.classList.add('hidden');
          }
        };
        document.addEventListener('click', closeHandler);

        // Open dropdown immediately in edit mode
        if (!isCreate) requestAnimationFrame(() => openDropdown());
      }
    },
  });
}

async function saveTextMode() {
  const textarea = document.getElementById('tpl-textarea');
  if (!textarea || !selectedEnv) return;
  const parsed = parseTemplateText(textarea.value);
  await vault.replaceTemplate(selectedEnv, parsed);
}

async function handleImportEnv(render) {
  try {
    const text = await importEnvFile();
    if (!text) return;
    const incoming = parseTemplateText(text);
    if (Object.keys(incoming).length === 0) return;

    const existing = vault.getTemplate(selectedEnv);
    const hasEntries = Object.keys(existing).length > 0;

    if (hasEntries) {
      const choice = await showConfirmDialog({
        title: 'Import .env',
        message: 'The template already has entries. How do you want to import?',
        buttons: [
          { label: 'Replace', value: 'replace', variant: 'danger' },
          { label: 'Append', value: 'append', variant: 'primary' },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (!choice || choice === 'cancel') return;
      if (choice === 'replace') {
        await vault.replaceTemplate(selectedEnv, incoming);
      } else {
        await vault.mergeTemplate(selectedEnv, incoming);
      }
    } else {
      await vault.replaceTemplate(selectedEnv, incoming);
    }
    render();
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Import .env failed:', e);
  }
}

export function bindTemplates(render) {
  document.getElementById('tpl-env')?.addEventListener('change', (e) => {
    setSelectedEnv(e.target.value || null);
    textMode = false;
    render();
  });

  document.getElementById('btn-import-env')?.addEventListener('click', () => handleImportEnv(render));

  const filterInput = document.getElementById('tpl-filter');
  if (filterInput) {
    const filterRows = (val) => {
      const q = val.toLowerCase();
      document.querySelectorAll('[data-edit-tpl]').forEach(row => {
        row.classList.toggle('hidden', !row.dataset.editTpl.toLowerCase().includes(q));
      });
    };
    makeClearable(filterInput, { onInput: filterRows, onClear: () => filterRows('') });
  }

  document.getElementById('btn-clear-tpl')?.addEventListener('click', async () => {
    if (selectedEnv && confirm('Clear the entire template?')) {
      await vault.clearTemplate(selectedEnv);
      render();
    }
  });

  document.getElementById('btn-toggle-text-mode')?.addEventListener('click', async () => {
    if (textMode) {
      await saveTextMode();
    }
    textMode = !textMode;
    render();
  });

  document.getElementById('btn-add-tpl-entry')?.addEventListener('click', () => {
    const list = document.getElementById('tpl-entry-list');
    const row = document.createElement('div');
    row.className = 'group flex items-center justify-between p-2 -mx-2 rounded-lg border border-indigo-500/50 transition';
    list.prepend(row);
    startTplForm(row, render);
  });

  // Edit template entry — same form
  bindEditableRows('[data-edit-tpl]', (row) => {
    const key = row.dataset.editTpl;
    const tpl = vault.getTemplate(selectedEnv);
    startTplForm(row, render, { key, value: tpl[key] || '' });
  }, ['[data-delete-tpl]']);

  bindDeleteButtons('[data-delete-tpl]', async (btn) => {
    if (selectedEnv) {
      await vault.deleteTemplateEntry(selectedEnv, btn.dataset.deleteTpl);
      render();
    }
  });
}
