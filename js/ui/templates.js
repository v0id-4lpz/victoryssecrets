// templates.js — templates section + value picker

import * as vault from '../vault.js';
import { importEnvFile } from '../storage.js';
import { esc, selectedEnv, setSelectedEnv, renderEnvOptions } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { bindEditableRows } from './components/editable-row.js';
import { renderEmptyState } from './components/empty-state.js';
import { startInlineEdit } from './components/inline-edit.js';
import { parseEnvFile, buildServiceFieldTree } from '../services/template-ops.js';

function renderValuePickerDropdown() {
  const { services, fieldsByService } = buildServiceFieldTree(vault.getData());
  const serviceEntries = Object.entries(fieldsByService);
  return `
    <div id="tpl-picker-dropdown" class="hidden absolute z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
      <div class="p-2 border-b border-gray-200 dark:border-gray-700">
        <input id="tpl-picker-search" type="text" placeholder="Search..." class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
      </div>
      <div id="tpl-picker-list" class="p-1">
        ${serviceEntries.map(([serviceId, fields]) => `
          <div class="tpl-picker-group" data-service="${serviceId}">
            <div class="px-2 py-1 text-xs font-semibold text-indigo-400 uppercase tracking-wide">${esc(services[serviceId]?.label || serviceId)}</div>
            ${[...fields].map(f => `
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
        <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 p-2">
          <div class="px-0 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Custom value</div>
          <div class="flex gap-1">
            <input id="tpl-free-value" type="text" placeholder="Enter a value..." class="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            ${renderButton('OK', { id: 'tpl-free-value-ok', variant: 'success', cls: '!px-2 !py-1 !text-xs' })}
          </div>
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

export function renderTemplates(render) {
  const data = vault.getData();
  const envs = data.environments || [];

  let envOptions = renderEnvOptions(envs, selectedEnv);

  let templateContent = '';
  if (selectedEnv) {
    const tpl = vault.getTemplate(selectedEnv);
    const entries = Object.entries(tpl);
    templateContent = `
      <div class="mt-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold">Mapping</h3>
          <div class="flex gap-3">
            ${renderButton('Import .env', { id: 'btn-import-env', variant: 'ghost' })}
            ${renderButton('+ Add', { id: 'btn-add-tpl-entry', variant: 'ghost' })}
            ${entries.length > 0 ? renderButton('Clear', { id: 'btn-clear-tpl', variant: 'danger' }) : ''}
          </div>
        </div>
        <div id="tpl-entry-list" class="space-y-1">
          ${entries.length === 0
            ? '<p class="text-gray-400 text-xs">No entries.</p>'
            : entries.map(([key, val]) => `
              <div class="group flex items-center gap-3 text-sm py-1 font-mono cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition" data-edit-tpl="${esc(key)}">
                <span class="w-48 text-gray-300 shrink-0 pointer-events-none">${esc(key)}</span>
                <span class="flex-1 ${val ? 'text-gray-500' : 'text-gray-600 italic'} pointer-events-none">${val ? esc(val) : 'Not defined'}</span>
                ${renderDeleteButton('data-delete-tpl', key)}
              </div>`).join('')
          }
        </div>
        <!-- Shared picker dropdown -->
        <div class="relative">${renderValuePickerDropdown()}</div>
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
  const isCreate = !key;

  const pickerBtnHtml = `<button type="button" data-tpl-picker-btn class="flex-1 px-3 py-1 rounded-lg border border-indigo-500 bg-white dark:bg-gray-800 text-sm font-mono text-left truncate focus:ring-2 focus:ring-indigo-500 focus:outline-none ${value ? 'text-white' : 'text-gray-400'}">
    ${value ? esc(value) : 'Choose a value...'}
  </button>`;

  startInlineEdit(container, {
    rows: [
      [{ name: 'key', value: key || '', placeholder: 'ENV_VAR_NAME', cls: 'flex-1 font-mono' }],
      [{ html: pickerBtnHtml }, { html: '<input type="hidden" name="value" value="' + esc(value || '') + '" />' }],
    ],
    onSave: async (values) => {
      const k = values.key.trim();
      const v = values.value.trim();
      if (!k || !v || !selectedEnv) return;
      if (!isCreate && k !== key) {
        await vault.deleteTemplateEntry(selectedEnv, key);
      }
      await vault.setTemplateEntry(selectedEnv, k, v);
      render();
    },
    onCancel: render,
    onReady: (el) => {
      const pickerBtn = el.querySelector('[data-tpl-picker-btn]');
      const hiddenInput = el.querySelector('input[name="value"]');
      const dropdown = document.getElementById('tpl-picker-dropdown');
      const search = document.getElementById('tpl-picker-search');

      if (pickerBtn && dropdown) {
        pickerBtn.onclick = (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('hidden');
          if (!dropdown.classList.contains('hidden')) {
            // Position dropdown near the button
            const rect = pickerBtn.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = (rect.bottom + 4) + 'px';
            if (search) { search.value = ''; filterPickerList(''); search.focus(); }
          }
        };

        const pickValue = (val) => {
          hiddenInput.value = val;
          pickerBtn.textContent = val;
          pickerBtn.classList.remove('text-gray-400');
          pickerBtn.classList.add('text-white');
          dropdown.classList.add('hidden');
        };

        document.querySelectorAll('[data-pick-ref]').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            pickValue(`\${${btn.dataset.pickRef}}`);
          };
        });

        document.getElementById('tpl-free-value-ok')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = document.getElementById('tpl-free-value').value.trim();
          if (val) pickValue(val);
        });

        if (search) search.addEventListener('input', (e) => filterPickerList(e.target.value));

        // Close on outside click
        const closeHandler = (e) => {
          if (dropdown && !dropdown.contains(e.target) && e.target !== pickerBtn) {
            dropdown.classList.add('hidden');
          }
        };
        document.addEventListener('click', closeHandler);
      }
    },
  });
}

export function bindTemplates(render) {
  document.getElementById('tpl-env')?.addEventListener('change', (e) => {
    setSelectedEnv(e.target.value || null);
    render();
  });

  document.getElementById('btn-import-env')?.addEventListener('click', async () => {
    try {
      const text = await importEnvFile();
      if (!text) return;
      const keys = parseEnvFile(text);
      const existing = vault.getTemplate(selectedEnv);
      let added = 0;
      for (const key of keys) {
        if (!existing[key]) {
          await vault.setTemplateEntry(selectedEnv, key, '');
          added++;
        }
      }
      if (added > 0) render();
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Import .env failed:', e);
    }
  });

  document.getElementById('btn-clear-tpl')?.addEventListener('click', async () => {
    if (selectedEnv && confirm('Clear the entire template?')) {
      await vault.clearTemplate(selectedEnv);
      render();
    }
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
