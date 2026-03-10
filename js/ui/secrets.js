// secrets.js — secrets section + generator modal

import * as vault from '../vault.js';
import { generatePassword, generateBase64, generateHex, generateUUID } from '../generator.js';
import { esc, selectedEnv, secretLevelScope, setSelectedEnv, setSecretLevelScope, INPUT_CLS, renderEnvOptions } from './helpers.js';
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

// Generator modal target — kept in JS, not on DOM element
let generatorTargetInput = null;

function getCurrentLevel() {
  if (secretLevelScope === 'env' && selectedEnv) return { scope: 'env', envId: selectedEnv };
  return { scope: 'global' };
}

export function renderSecrets(render) {
  const data = vault.getData();
  const envs = data.environments || [];

  const level = getCurrentLevel();
  const secrets = vault.getSecretsAtLevel(level);
  const secretEntries = Object.entries(secrets);

  // Populate in-memory store (clear previous)
  secretValueStore.clear();
  for (const [serviceId, fields] of secretEntries) {
    for (const [field, entry] of Object.entries(fields)) {
      secretValueStore.set(`${serviceId}:${field}`, entry.value);
    }
  }

  return `
    <div class="max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Secrets</h2>
        ${renderAddButton('btn-add-secret')}
      </div>

      <!-- Level selector -->
      <div class="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Niveau</label>
          <select id="secret-scope" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="global" ${secretLevelScope === 'global' ? 'selected' : ''}>Global</option>
            <option value="env" ${secretLevelScope === 'env' ? 'selected' : ''}>Environnement</option>
          </select>
        </div>
        ${secretLevelScope === 'env' ? `
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environnement</label>
          <select id="secret-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${renderEnvOptions(envs, selectedEnv)}
          </select>
        </div>` : ''}
      </div>

      ${renderGeneratorModal()}

      <!-- Secrets list -->
      <div id="secret-list">
        ${secretEntries.length === 0
          ? renderEmptyState('Aucun secret a ce niveau.')
          : `<div class="space-y-3">${secretEntries.map(([serviceId, fields]) => `
            <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <h3 class="text-sm font-semibold text-indigo-500 mb-2">${esc(data.services[serviceId]?.label || serviceId)}</h3>
              <div class="space-y-1">
                ${Object.entries(fields).map(([field, entry]) => {
                  const key = `${serviceId}:${field}`;
                  return `
                <div class="group flex items-center gap-3 text-sm py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition" data-edit-secret="${key}" data-is-secret="${entry.secret}">
                  <span class="w-40 text-gray-500 shrink-0 pointer-events-none">${esc(field)}</span>
                  <span class="flex-1 font-mono pointer-events-none" data-secret-display="${key}">
                    ${entry.secret && entry.value ? '<span class="text-gray-400">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>' : esc(entry.value)}
                  </span>
                  ${renderButton(icons.copy(), { variant: 'icon', attrs: `data-copy-secret="${key}"`, title: 'Copier' })}
                  ${entry.secret ? renderButton(icons.eye(), { variant: 'icon', attrs: `data-toggle-secret="${key}" data-visible="false"`, title: 'Afficher/Masquer' }) : ''}
                  ${renderDeleteButton('data-remove-secret', key)}
                </div>`;
                }).join('')}
              </div>
            </div>`).join('')}</div>`
        }
      </div>
    </div>`;
}

function startSecretForm(container, render, { serviceId, field, value, isSecret } = {}) {
  const isCreate = !field;
  const data = vault.getData();
  const services = Object.entries(data.services || {});

  const serviceSelectHtml = `<select name="serviceId" class="${INPUT_CLS} flex-1">
      <option value="">Service...</option>
      ${services.map(([id, s]) => `<option value="${id}" ${id === serviceId ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
     </select>`;

  const checkboxHtml = `<label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
    <input type="checkbox" name="isSecret" ${isSecret !== false ? 'checked' : ''} class="rounded border-gray-300 dark:border-gray-600" />
    Secret
  </label>`;

  const genBtnHtml = renderButton(icons.refresh(), { variant: 'secondary', cls: '!px-2 !py-1 shrink-0', attrs: 'data-inline-gen', title: 'Generer' });

  const row1 = [{ html: serviceSelectHtml }, { name: 'field', value: field || '', placeholder: 'Champ (ex: password)' }, { html: checkboxHtml }];

  const row2 = [
    { name: 'value', value: value || '', placeholder: 'Valeur', type: isSecret !== false ? 'password' : 'text' },
    { html: genBtnHtml },
  ];

  startInlineEdit(container, {
    rows: [row1, row2],
    onSave: async (values) => {
      const svcId = container.querySelector('select[name="serviceId"]')?.value;
      const newField = values.field;
      const newValue = values.value;
      const newIsSecret = values.isSecret;
      if (!svcId || !newField) return;

      const level = getCurrentLevel();
      if (secretLevelScope === 'env' && !selectedEnv) return;

      if (!isCreate && (svcId !== serviceId || newField !== field)) {
        await vault.moveSecret(level, serviceId, field, svcId, newField);
      }
      await vault.setSecret(level, svcId, newField, newValue, newIsSecret);
      showToast(isCreate ? 'Secret ajoute' : 'Secret modifie', 'success');
      render();
    },
    onCancel: render,
    onReady: (el) => {
      // Secret checkbox toggles value input type
      const secretCb = el.querySelector('input[name="isSecret"]');
      const valueInput = el.querySelector('input[name="value"]');
      if (secretCb && valueInput) {
        secretCb.onchange = () => { valueInput.type = secretCb.checked ? 'password' : 'text'; };
      }
      // Generator button
      const genBtn = el.querySelector('[data-inline-gen]');
      if (genBtn) {
        genBtn.onclick = (e) => {
          e.stopPropagation();
          const modal = document.getElementById('generator-modal');
          modal.classList.remove('hidden');
          generatorTargetInput = valueInput;
          updateGeneratorPreview();
        };
      }
    },
  });
}

function renderGeneratorModal() {
  return `
    <div id="generator-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl">
        <h3 class="text-sm font-semibold mb-4">Generateur de secrets</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Type</label>
            <select id="gen-type" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
              <option value="password">Mot de passe</option>
              <option value="base64">Token base64 (openssl rand -base64)</option>
              <option value="hex">Hex</option>
              <option value="uuid">UUID v4</option>
            </select>
          </div>
          <div id="gen-options-password">
            <label class="block text-xs text-gray-500 mb-1">Longueur</label>
            <div class="flex gap-2 items-center">
              <div class="flex gap-1">${[32, 64, 128, 256, 512].map(n => `<button data-gen-length="${n}" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-500 transition">${n}</button>`).join('')}</div>
              <input id="gen-length" type="number" min="1" max="1024" value="24" class="w-20 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div class="flex gap-4 mt-2 text-xs">
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-lower" checked class="rounded" /> a-z</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-upper" checked class="rounded" /> A-Z</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-digits" checked class="rounded" /> 0-9</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-symbols" checked class="rounded" /> !@#</label>
            </div>
          </div>
          <div id="gen-options-bytes" class="hidden">
            <label class="block text-xs text-gray-500 mb-1">Octets</label>
            <div class="flex gap-2 items-center">
              <div class="flex gap-1">${[32, 64, 128, 256, 512].map(n => `<button data-gen-bytes="${n}" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-500 transition">${n}</button>`).join('')}</div>
              <input id="gen-bytes" type="number" min="1" max="1024" value="32" class="w-20 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-sm break-all">
            <span id="gen-preview">-</span>
          </div>
          <div class="flex justify-end gap-2">
            ${renderButton('Regenerer', { id: 'gen-refresh', variant: 'secondary' })}
            ${renderButton('Annuler', { id: 'gen-cancel', variant: 'secondary' })}
            ${renderButton('Utiliser', { id: 'gen-use', variant: 'primary' })}
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
  document.getElementById('secret-scope').onchange = (e) => {
    setSecretLevelScope(e.target.value);
    render();
  };
  document.getElementById('secret-env')?.addEventListener('change', (e) => {
    setSelectedEnv(e.target.value || null);
    render();
  });

  // Add secret
  document.getElementById('btn-add-secret').onclick = () => {
    const list = document.getElementById('secret-list');
    const row = document.createElement('div');
    row.className = 'group flex items-center justify-between p-4 mb-3 rounded-lg bg-white dark:bg-gray-900 border border-indigo-500/50 transition';
    list.prepend(row);
    startSecretForm(row, render);
  };

  // Copy secret value (from in-memory store, not DOM)
  document.querySelectorAll('[data-copy-secret]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const val = secretValueStore.get(btn.dataset.copySecret);
      if (!val) return;
      navigator.clipboard.writeText(val);
      showToast('Copie dans le presse-papier (efface dans 10s)', 'success');
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
    const isSecret = row.dataset.isSecret === 'true';
    const level = getCurrentLevel();
    const secrets = vault.getSecretsAtLevel(level);
    const currentValue = secrets[serviceId]?.[field]?.value || '';
    startSecretForm(row, render, { serviceId, field, value: currentValue, isSecret });
  }, ['[data-copy-secret]', '[data-toggle-secret]', '[data-remove-secret]']);

  // Toggle secret visibility (from in-memory store, not DOM)
  document.querySelectorAll('[data-toggle-secret]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.toggleSecret;
      const display = document.querySelector(`[data-secret-display="${key}"]`);
      const visible = btn.dataset.visible === 'true';
      if (visible) {
        display.innerHTML = '<span class="text-gray-400">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>';
        btn.dataset.visible = 'false';
      } else {
        display.textContent = secretValueStore.get(key) || '';
        btn.dataset.visible = 'true';
      }
    };
  });

  // Delete secret
  bindDeleteButtons('[data-remove-secret]', async (btn) => {
    const [serviceId, field] = btn.dataset.removeSecret.split(':');
    const level = getCurrentLevel();
    await vault.deleteSecret(level, serviceId, field);
    render();
  });

  // Generator
  bindGenerator();
}
