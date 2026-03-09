// secrets.js — secrets section + generator modal

import * as vault from '../vault.js';
import { generatePassword, generateBase64, generateHex, generateUUID } from '../generator.js';
import { esc, selectedEnv, secretLevelScope, setSelectedEnv, setSecretLevelScope } from './helpers.js';

export function renderSecrets(render) {
  const data = vault.getData();
  const services = Object.entries(data.services || {});
  const envs = data.environments || [];

  let envOptions = envs.map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');

  let level;
  if (secretLevelScope === 'global') {
    level = { scope: 'global' };
  } else if (secretLevelScope === 'env' && selectedEnv) {
    level = { scope: 'env', envId: selectedEnv };
  } else {
    level = { scope: 'global' };
  }

  const secrets = vault.getSecretsAtLevel(level);
  const secretEntries = Object.entries(secrets);

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Secrets</h2>

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
            ${envOptions}
          </select>
        </div>` : ''}
      </div>

      <!-- Add secret form -->
      <div class="mb-6 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div class="flex flex-wrap gap-2 items-end">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Service</label>
            <select id="new-secret-service" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option value="">--</option>
              ${services.map(([id, s]) => `<option value="${id}">${esc(s.label)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Champ</label>
            <input id="new-secret-field" type="text" placeholder="ex: password" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs text-gray-500 mb-1">Valeur</label>
            <div class="flex gap-1">
              <input id="new-secret-value" type="text" placeholder="Valeur" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              <button id="btn-gen-secret" class="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="Generer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
            </div>
          </div>
          <div class="flex items-end gap-2">
            <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input id="new-secret-is-secret" type="checkbox" checked class="rounded border-gray-300 dark:border-gray-600" />
              Secret
            </label>
            <button id="btn-add-secret" class="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Ajouter</button>
          </div>
        </div>
      </div>

      <!-- Generator modal -->
      ${renderGeneratorModal()}

      <!-- Secrets list -->
      ${secretEntries.length === 0
        ? '<p class="text-gray-400 text-sm">Aucun secret a ce niveau.</p>'
        : `<div class="space-y-3">${secretEntries.map(([serviceId, fields]) => `
          <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <h3 class="text-sm font-semibold text-indigo-500 mb-2">${esc(data.services[serviceId]?.label || serviceId)}</h3>
            <div class="space-y-1">
              ${Object.entries(fields).map(([field, entry]) => `
              <div class="flex items-center gap-3 text-sm py-1">
                <span class="w-40 text-gray-500 shrink-0">${esc(field)}</span>
                <span class="flex-1 font-mono" data-secret-display="${serviceId}:${field}">
                  ${entry.secret ? '<span class="text-gray-400">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>' : esc(entry.value)}
                </span>
                ${entry.secret ? `<button data-toggle-secret="${serviceId}:${field}" data-value="${esc(entry.value)}" data-visible="false" class="text-gray-400 hover:text-gray-200 transition" title="Afficher/Masquer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>` : ''}
                <button data-remove-secret="${serviceId}:${field}" class="text-red-400 hover:text-red-600 transition" title="Supprimer">&times;</button>
              </div>`).join('')}
            </div>
          </div>`).join('')}</div>`
      }
    </div>`;
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
            <label class="block text-xs text-gray-500 mb-1">Longueur: <span id="gen-length-val">24</span></label>
            <input id="gen-length" type="range" min="8" max="128" value="24" class="w-full" />
            <div class="flex gap-4 mt-2 text-xs">
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-lower" checked class="rounded" /> a-z</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-upper" checked class="rounded" /> A-Z</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-digits" checked class="rounded" /> 0-9</label>
              <label class="flex items-center gap-1"><input type="checkbox" id="gen-symbols" checked class="rounded" /> !@#</label>
            </div>
          </div>
          <div id="gen-options-bytes" class="hidden">
            <label class="block text-xs text-gray-500 mb-1">Octets: <span id="gen-bytes-val">32</span> (<span id="gen-bits-val">256</span> bits)</label>
            <input id="gen-bytes" type="range" min="8" max="128" value="32" class="w-full" />
          </div>
          <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-sm break-all">
            <span id="gen-preview">-</span>
          </div>
          <div class="flex justify-end gap-2">
            <button id="gen-refresh" class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Regenerer</button>
            <button id="gen-cancel" class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Annuler</button>
            <button id="gen-use" class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Utiliser</button>
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
  document.getElementById('btn-gen-secret').onclick = () => {
    modal.classList.remove('hidden');
    updateGeneratorPreview();
  };
  document.getElementById('gen-cancel').onclick = () => modal.classList.add('hidden');
  document.getElementById('gen-use').onclick = () => {
    document.getElementById('new-secret-value').value = document.getElementById('gen-preview').textContent;
    modal.classList.add('hidden');
  };

  const typeSelect = document.getElementById('gen-type');
  const lengthRange = document.getElementById('gen-length');
  const bytesRange = document.getElementById('gen-bytes');

  typeSelect.onchange = () => {
    const type = typeSelect.value;
    document.getElementById('gen-options-password').classList.toggle('hidden', type !== 'password');
    document.getElementById('gen-options-bytes').classList.toggle('hidden', type !== 'base64' && type !== 'hex');
    updateGeneratorPreview();
  };

  lengthRange.oninput = () => {
    document.getElementById('gen-length-val').textContent = lengthRange.value;
    updateGeneratorPreview();
  };

  bytesRange.oninput = () => {
    document.getElementById('gen-bytes-val').textContent = bytesRange.value;
    document.getElementById('gen-bits-val').textContent = bytesRange.value * 8;
    updateGeneratorPreview();
  };

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
  document.getElementById('btn-add-secret').onclick = async () => {
    const serviceId = document.getElementById('new-secret-service').value;
    const field = document.getElementById('new-secret-field').value.trim();
    const value = document.getElementById('new-secret-value').value;
    const isSecret = document.getElementById('new-secret-is-secret').checked;
    if (!serviceId || !field) return;

    let level;
    if (secretLevelScope === 'global') level = { scope: 'global' };
    else if (secretLevelScope === 'env' && selectedEnv) level = { scope: 'env', envId: selectedEnv };
    else return;

    await vault.setSecret(level, serviceId, field, value, isSecret);
    render();
  };

  // Toggle secret visibility
  document.querySelectorAll('[data-toggle-secret]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.toggleSecret;
      const display = document.querySelector(`[data-secret-display="${key}"]`);
      const visible = btn.dataset.visible === 'true';
      if (visible) {
        display.innerHTML = '<span class="text-gray-400">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>';
        btn.dataset.visible = 'false';
      } else {
        display.textContent = btn.dataset.value;
        btn.dataset.visible = 'true';
      }
    };
  });

  // Delete secret
  document.querySelectorAll('[data-remove-secret]').forEach(btn => {
    btn.onclick = async () => {
      const [serviceId, field] = btn.dataset.removeSecret.split(':');
      let level;
      if (secretLevelScope === 'global') level = { scope: 'global' };
      else level = { scope: 'env', envId: selectedEnv };
      await vault.deleteSecret(level, serviceId, field);
      render();
    };
  });

  // Generator
  bindGenerator();
}
