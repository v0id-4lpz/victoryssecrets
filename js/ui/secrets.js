// secrets.js — secrets section + generator modal

import * as vault from '../vault.js';
import { GLOBAL_ENV } from '../models/vault-schema.js';
import { generatePassword, generateBase64, generateHex, generateUUID } from '../generator.js';
import { esc, INPUT_CLS } from './helpers.js';
import { renderButton } from './components/button.js';
import { icons } from './components/icon.js';
import { renderDeleteButton, bindDeleteButtons } from './components/delete-button.js';
import { bindEditableRows } from './components/editable-row.js';
import { renderEmptyState } from './components/empty-state.js';
import { renderAddButton } from './components/section-header.js';
import { startInlineEdit } from './components/inline-edit.js';
import { showToast } from './components/toast.js';

const CLIPBOARD_CLEAR_DELAY = 10_000;

// In-memory store for secret values — never stored in DOM attributes
const secretValueStore = new Map();

// Last copied value — tracked for clipboard cleanup
let lastCopiedValue = null;

/**
 * Clear clipboard if it still contains a copied secret, and wipe the store.
 */
export function clearSecretStore() {
  if (lastCopiedValue) {
    navigator.clipboard.readText().then(current => {
      if (current === lastCopiedValue) navigator.clipboard.writeText('');
    }).catch(() => {});
    lastCopiedValue = null;
  }
  secretValueStore.clear();
}

// Generator modal target — kept in JS, not on DOM element
let generatorTargetInput = null;

function envPillCls(hasValue) {
  return hasValue
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
}

function renderEnvCoveragePills(entry, envs, key) {
  const allEnvs = [GLOBAL_ENV, ...envs];
  return allEnvs.map(envId => {
    const val = entry.values?.[envId];
    const hasValue = val !== undefined && val !== '';
    const label = envId === GLOBAL_ENV ? 'Global' : esc(envId);
    return `<button data-copy-env="${key}:${envId}" class="px-2 py-0.5 text-xs rounded-full cursor-pointer transition ${envPillCls(hasValue)}" title="${hasValue ? 'Click to copy' : 'No value'}">${label}</button>`;
  }).join('');
}

export function renderSecrets(render) {
  const data = vault.getData();
  const envs = Object.keys(data.environments || {}).sort((a, b) => a.localeCompare(b));
  const secrets = vault.getAllSecrets();
  const secretEntries = Object.entries(secrets).sort(([a], [b]) => {
    const labelA = data.services[a]?.label || a;
    const labelB = data.services[b]?.label || b;
    return labelA.localeCompare(labelB);
  });

  // Populate in-memory store (clear previous)
  secretValueStore.clear();
  for (const [serviceId, fields] of secretEntries) {
    for (const [field, entry] of Object.entries(fields)) {
      for (const [envId, val] of Object.entries(entry.values || {})) {
        secretValueStore.set(`${serviceId}:${field}:${envId}`, val);
      }
    }
  }

  return `
    <div class="max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Secrets</h2>
        ${renderAddButton('btn-add-secret')}
      </div>

      ${renderGeneratorModal()}

      <!-- Secrets list -->
      <div id="secret-list">
        ${secretEntries.length === 0
          ? renderEmptyState('No secrets yet.')
          : `<div class="space-y-3">${secretEntries.map(([serviceId, fields]) => `
            <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <h3 class="text-sm font-semibold text-indigo-500 mb-2">${esc(data.services[serviceId]?.label || serviceId)}</h3>
              <div class="space-y-1">
                ${Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([field, entry]) => {
                  const key = `${serviceId}:${field}`;
                  return `
                <div class="group flex items-center gap-3 text-sm py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition" data-edit-secret="${key}" data-is-secret="${entry.secret}">
                  <span class="w-36 text-gray-500 shrink-0 pointer-events-none">${esc(field)}</span>
                  <div class="flex-1 flex items-center gap-1 pointer-events-none">
                    ${renderEnvCoveragePills(entry, envs, key)}
                  </div>
                  ${renderDeleteButton('data-remove-secret', key)}
                </div>`;
                }).join('')}
              </div>
            </div>`).join('')}</div>`
        }
      </div>
    </div>`;
}

function startSecretForm(container, render, { serviceId, field, entry } = {}) {
  const isCreate = !field;
  const data = vault.getData();
  const envs = Object.keys(data.environments || {}).sort((a, b) => a.localeCompare(b));
  const services = Object.entries(data.services || {}).sort(([, a], [, b]) => a.label.localeCompare(b.label));

  const serviceSelectHtml = `<select name="serviceId" class="${INPUT_CLS} flex-1">
      <option value="">Service...</option>
      ${services.map(([id, s]) => `<option value="${id}" ${id === serviceId ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
     </select>`;

  const isSecret = entry ? entry.secret : true;
  const checkboxHtml = `<label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
    <input type="checkbox" name="isSecret" ${isSecret ? 'checked' : ''} class="rounded border-gray-300 dark:border-gray-600" />
    Secret
  </label>`;

  const row1 = [{ html: serviceSelectHtml }, { name: 'field', value: field || '', placeholder: 'Field (e.g. password)' }, { html: checkboxHtml }];

  // One value row per env
  const allEnvs = [{ id: GLOBAL_ENV, label: 'Global' }, ...envs.map(e => ({ id: e, label: e }))];
  const valueRows = allEnvs.map(env => {
    const val = entry?.values?.[env.id] || '';
    const genBtnHtml = renderButton(icons.refresh(), { variant: 'secondary', cls: '!px-2 !py-1 shrink-0', attrs: `data-inline-gen="${env.id}"`, title: 'Generate' });
    return [
      { html: `<span class="text-xs text-gray-400 w-16 shrink-0">${esc(env.label)}</span>` },
      { name: `val_${env.id}`, value: val, placeholder: `Value for ${env.label}`, type: isSecret ? 'password' : 'text', cls: 'flex-1 font-mono' },
      { html: genBtnHtml },
    ];
  });

  startInlineEdit(container, {
    rows: [row1, ...valueRows],
    onSave: async (values) => {
      const svcId = container.querySelector('select[name="serviceId"]')?.value;
      const newField = values.field;
      const newIsSecret = values.isSecret;
      if (!svcId || !newField) return;

      // Collect env values
      const newValues = {};
      for (const env of allEnvs) {
        const v = values[`val_${env.id}`];
        if (v) newValues[env.id] = v;
      }

      if (!isCreate && (svcId !== serviceId || newField !== field)) {
        await vault.moveSecret(serviceId, field, svcId, newField);
      }
      await vault.setSecret(svcId, newField, { secret: newIsSecret, values: newValues });
      showToast(isCreate ? 'Secret added' : 'Secret updated', 'success');
      render();
    },
    onCancel: render,
    onReady: (el) => {
      // Secret checkbox toggles all value input types
      const secretCb = el.querySelector('input[name="isSecret"]');
      const valueInputs = el.querySelectorAll('input[name^="val_"]');
      if (secretCb) {
        secretCb.onchange = () => {
          const type = secretCb.checked ? 'password' : 'text';
          valueInputs.forEach(inp => { inp.type = type; });
        };
      }
      // Generator buttons
      el.querySelectorAll('[data-inline-gen]').forEach(genBtn => {
        genBtn.onclick = (e) => {
          e.stopPropagation();
          const envId = genBtn.dataset.inlineGen;
          const targetInput = el.querySelector(`input[name="val_${envId}"]`);
          const modal = document.getElementById('generator-modal');
          modal.classList.remove('hidden');
          generatorTargetInput = targetInput;
          updateGeneratorPreview();
        };
      });
    },
  });
}

function renderGeneratorModal() {
  return `
    <div id="generator-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl">
        <h3 class="text-sm font-semibold mb-4">Secret generator</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Type</label>
            <select id="gen-type" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
              <option value="password">Password</option>
              <option value="base64">Base64 token (openssl rand -base64)</option>
              <option value="hex">Hex</option>
              <option value="uuid">UUID v4</option>
            </select>
          </div>
          <div id="gen-options-password">
            <label class="block text-xs text-gray-500 mb-1">Length</label>
            <div class="flex gap-2 items-center">
              <div class="flex gap-1">${[32, 64, 128, 256, 512].map(n => `<button data-gen-length="${n}" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-500 transition cursor-pointer">${n}</button>`).join('')}</div>
              <input id="gen-length" type="number" min="1" max="1024" value="24" class="w-20 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div class="flex gap-4 mt-2 text-xs">
              <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" id="gen-lower" checked class="rounded" /> a-z</label>
              <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" id="gen-upper" checked class="rounded" /> A-Z</label>
              <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" id="gen-digits" checked class="rounded" /> 0-9</label>
              <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" id="gen-symbols" checked class="rounded" /> !@#</label>
            </div>
          </div>
          <div id="gen-options-bytes" class="hidden">
            <label class="block text-xs text-gray-500 mb-1">Bytes</label>
            <div class="flex gap-2 items-center">
              <div class="flex gap-1">${[32, 64, 128, 256, 512].map(n => `<button data-gen-bytes="${n}" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-500 transition cursor-pointer">${n}</button>`).join('')}</div>
              <input id="gen-bytes" type="number" min="1" max="1024" value="32" class="w-20 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-sm break-all">
            <span id="gen-preview">-</span>
          </div>
          <div class="flex justify-end gap-2">
            ${renderButton('Regenerate', { id: 'gen-refresh', variant: 'secondary' })}
            ${renderButton('Cancel', { id: 'gen-cancel', variant: 'secondary' })}
            ${renderButton('Use', { id: 'gen-use', variant: 'primary' })}
          </div>
        </div>
      </div>
    </div>`;
}

function updateGeneratorPreview() {
  const type = document.getElementById('gen-type').value;
  let result;
  switch (type) {
    case 'password':
      result = generatePassword(parseInt(document.getElementById('gen-length').value), {
        lowercase: document.getElementById('gen-lower').checked,
        uppercase: document.getElementById('gen-upper').checked,
        digits: document.getElementById('gen-digits').checked,
        symbols: document.getElementById('gen-symbols').checked,
      });
      break;
    case 'base64':
      result = generateBase64(parseInt(document.getElementById('gen-bytes').value));
      break;
    case 'hex':
      result = generateHex(parseInt(document.getElementById('gen-bytes').value));
      break;
    case 'uuid':
      result = generateUUID();
      break;
  }
  document.getElementById('gen-preview').textContent = result;
}

function bindGenerator() {
  const modal = document.getElementById('generator-modal');
  document.getElementById('gen-cancel').onclick = () => modal.classList.add('hidden');
  document.getElementById('gen-use').onclick = () => {
    if (generatorTargetInput) generatorTargetInput.value = document.getElementById('gen-preview').textContent;
    generatorTargetInput = null;
    modal.classList.add('hidden');
  };

  const typeSelect = document.getElementById('gen-type');
  const lengthInput = document.getElementById('gen-length');
  const bytesInput = document.getElementById('gen-bytes');

  typeSelect.onchange = () => {
    const type = typeSelect.value;
    document.getElementById('gen-options-password').classList.toggle('hidden', type !== 'password');
    document.getElementById('gen-options-bytes').classList.toggle('hidden', type !== 'base64' && type !== 'hex');
    updateGeneratorPreview();
  };

  lengthInput.oninput = () => updateGeneratorPreview();
  bytesInput.oninput = () => updateGeneratorPreview();

  document.querySelectorAll('[data-gen-length]').forEach(btn => {
    btn.onclick = () => {
      lengthInput.value = btn.dataset.genLength;
      updateGeneratorPreview();
    };
  });
  document.querySelectorAll('[data-gen-bytes]').forEach(btn => {
    btn.onclick = () => {
      bytesInput.value = btn.dataset.genBytes;
      updateGeneratorPreview();
    };
  });

  document.getElementById('gen-refresh').onclick = updateGeneratorPreview;
  ['gen-lower', 'gen-upper', 'gen-digits', 'gen-symbols'].forEach(id => {
    document.getElementById(id).onchange = updateGeneratorPreview;
  });
}

export function bindSecrets(render) {
  // Add secret
  document.getElementById('btn-add-secret').onclick = () => {
    const list = document.getElementById('secret-list');
    const row = document.createElement('div');
    row.className = 'group flex items-center justify-between p-4 mb-3 rounded-lg bg-white dark:bg-gray-900 border border-indigo-500/50 transition';
    list.prepend(row);
    startSecretForm(row, render);
  };

  // Copy env value from pill click
  document.querySelectorAll('[data-copy-env]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const val = secretValueStore.get(btn.dataset.copyEnv);
      if (!val) return;
      lastCopiedValue = val;
      navigator.clipboard.writeText(val);
      showToast('Copied to clipboard (cleared in 10s)', 'success');
      setTimeout(() => {
        navigator.clipboard.readText().then(current => {
          if (current === val) navigator.clipboard.writeText('');
        }).catch(() => {});
      }, CLIPBOARD_CLEAR_DELAY);
    };
  });

  // Edit secret
  bindEditableRows('[data-edit-secret]', (row) => {
    const [serviceId, field] = row.dataset.editSecret.split(':');
    const entry = vault.getSecret(serviceId, field);
    startSecretForm(row, render, { serviceId, field, entry });
  }, ['[data-remove-secret]', '[data-copy-env]']);

  // Delete secret
  bindDeleteButtons('[data-remove-secret]', async (btn) => {
    const [serviceId, field] = btn.dataset.removeSecret.split(':');
    await vault.deleteSecret(serviceId, field);
    render();
  });

  // Generator
  bindGenerator();
}
