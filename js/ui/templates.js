// templates.js — templates section + value picker

import * as vault from '../vault.js';
import { importEnvFile } from '../storage.js';
import { esc, selectedEnv, setSelectedEnv } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { bindEditableRows } from './components/editable-row.js';
import { renderEmptyState } from './components/empty-state.js';

function parseEnvFile(text) {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function buildServiceFieldTree() {
  const data = vault.getData();
  const services = data.services || {};
  const allSecrets = data.secrets || {};
  const fieldsByService = {};
  const collectFields = (obj) => {
    for (const [serviceId, fields] of Object.entries(obj || {})) {
      if (typeof fields !== 'object') continue;
      if (!fieldsByService[serviceId]) fieldsByService[serviceId] = new Set();
      for (const f of Object.keys(fields)) {
        fieldsByService[serviceId].add(f);
      }
    }
  };
  collectFields(allSecrets.global);
  for (const envId of Object.keys(allSecrets.envs || {})) {
    collectFields(allSecrets.envs[envId]);
  }
  for (const sId of Object.keys(services)) {
    if (!fieldsByService[sId]) fieldsByService[sId] = new Set();
  }
  return { services, fieldsByService };
}

function renderValuePicker() {
  const { services, fieldsByService } = buildServiceFieldTree();
  const serviceEntries = Object.entries(fieldsByService);
  return `
    <div class="relative w-72">
      <button id="tpl-value-btn" type="button" class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-left text-gray-400 truncate focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        Choisir une valeur...
      </button>
      <div id="tpl-value-dropdown" class="hidden absolute z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div class="p-2 border-b border-gray-200 dark:border-gray-700">
          <input id="tpl-picker-search" type="text" placeholder="Rechercher..." class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
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
              ${fields.size === 0 ? '<div class="px-3 py-1 text-xs text-gray-500 italic">Aucun champ defini</div>' : ''}
            </div>
          `).join('')}
          <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <div class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Variables magiques</div>
            <button data-pick-ref="_ENV_NAME" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">\${_ENV_NAME}</button>
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 p-2">
            <div class="px-0 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valeur libre</div>
            <div class="flex gap-1">
              <input id="tpl-free-value" type="text" placeholder="Saisir une valeur..." class="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              ${renderButton('OK', { id: 'tpl-free-value-ok', variant: 'success', cls: '!px-2 !py-1 !text-xs' })}
            </div>
          </div>
        </div>
      </div>
      <input id="tpl-value" type="hidden" />
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

  let envOptions = envs.map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');

  let templateContent = '';
  if (selectedEnv) {
    const tpl = vault.getTemplate(selectedEnv);
    const entries = Object.entries(tpl);
    templateContent = `
      <div class="mt-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold">Mapping</h3>
          <div class="flex gap-3">
            ${renderButton('Importer .env', { id: 'btn-import-env', variant: 'ghost' })}
            ${renderButton('+ Ajouter', { id: 'btn-add-tpl-entry', variant: 'ghost' })}
            ${entries.length > 0 ? renderButton('Vider', { id: 'btn-clear-tpl', variant: 'danger' }) : ''}
          </div>
        </div>
        <div id="tpl-entry-form" class="hidden mb-3 flex gap-2 items-start">
          <input id="tpl-key" type="text" placeholder="ENV_VAR_NAME" class="w-48 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          ${renderValuePicker()}
          ${renderButton('OK', { id: 'btn-save-tpl-entry', variant: 'success', cls: 'shrink-0 !px-2 !py-1 !text-xs' })}
        </div>
        ${entries.length === 0
          ? '<p class="text-gray-400 text-xs">Aucune entree.</p>'
          : `<div class="space-y-1">${entries.map(([key, val]) => `
            <div class="group flex items-center gap-3 text-sm py-1 font-mono cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition" data-edit-tpl="${esc(key)}">
              <span class="w-48 text-gray-300 shrink-0 pointer-events-none">${esc(key)}</span>
              <span class="flex-1 ${val ? 'text-gray-500' : 'text-gray-600 italic'} pointer-events-none">${val ? esc(val) : 'Non défini'}</span>
              ${renderDeleteButton('data-delete-tpl', key)}
            </div>`).join('')}</div>`
        }
      </div>`;
  }

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Templates .env</h2>
      <div class="flex gap-3 mb-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environnement</label>
          <select id="tpl-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${envOptions}
          </select>
        </div>
      </div>
      ${templateContent}
    </div>`;
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
    if (selectedEnv && confirm('Vider tout le template ?')) {
      await vault.clearTemplate(selectedEnv);
      render();
    }
  });
  document.getElementById('btn-add-tpl-entry')?.addEventListener('click', () => {
    document.getElementById('tpl-entry-form').classList.toggle('hidden');
    document.getElementById('tpl-key').focus();
  });

  // Value picker
  const pickerBtn = document.getElementById('tpl-value-btn');
  const pickerDropdown = document.getElementById('tpl-value-dropdown');
  const pickerSearch = document.getElementById('tpl-picker-search');
  const hiddenValue = document.getElementById('tpl-value');

  if (pickerBtn) {
    pickerBtn.onclick = () => {
      pickerDropdown.classList.toggle('hidden');
      if (!pickerDropdown.classList.contains('hidden')) {
        pickerSearch.value = '';
        filterPickerList('');
        pickerSearch.focus();
      }
    };
    document.addEventListener('click', (e) => {
      if (pickerDropdown && !pickerDropdown.contains(e.target) && e.target !== pickerBtn) {
        pickerDropdown.classList.add('hidden');
      }
    });
    pickerSearch?.addEventListener('input', (e) => filterPickerList(e.target.value));
    document.querySelectorAll('[data-pick-ref]').forEach(btn => {
      btn.onclick = () => {
        const ref = btn.dataset.pickRef;
        const val = `\${${ref}}`;
        hiddenValue.value = val;
        pickerBtn.textContent = val;
        pickerBtn.classList.remove('text-gray-400');
        pickerBtn.classList.add('text-white');
        pickerDropdown.classList.add('hidden');
      };
    });
    document.getElementById('tpl-free-value-ok')?.addEventListener('click', () => {
      const val = document.getElementById('tpl-free-value').value.trim();
      if (val) {
        hiddenValue.value = val;
        pickerBtn.textContent = val;
        pickerBtn.classList.remove('text-gray-400');
        pickerBtn.classList.add('text-white');
        pickerDropdown.classList.add('hidden');
      }
    });
  }

  document.getElementById('btn-save-tpl-entry')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('tpl-key');
    const key = keyInput.value.trim();
    const value = document.getElementById('tpl-value').value.trim();
    if (key && value && selectedEnv) {
      await vault.setTemplateEntry(selectedEnv, key, value);
      keyInput.readOnly = false;
      keyInput.classList.remove('opacity-50');
      render();
    }
  });

  // Edit template entry value — whole row clickable
  bindEditableRows('[data-edit-tpl]', (row) => {
    const key = row.dataset.editTpl;
    const form = document.getElementById('tpl-entry-form');
    form.classList.remove('hidden');
    const keyInput = document.getElementById('tpl-key');
    keyInput.value = key;
    keyInput.readOnly = true;
    keyInput.classList.add('opacity-50');
    const pickerBtnEl = document.getElementById('tpl-value-btn');
    if (pickerBtnEl) {
      pickerBtnEl.textContent = 'Choisir une valeur...';
      pickerBtnEl.classList.add('text-gray-400');
      pickerBtnEl.classList.remove('text-white');
    }
    document.getElementById('tpl-value').value = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, ['[data-delete-tpl]']);

  bindDeleteButtons('[data-delete-tpl]', async (btn) => {
    if (selectedEnv) {
      await vault.deleteTemplateEntry(selectedEnv, btn.dataset.deleteTpl);
      render();
    }
  });
}
