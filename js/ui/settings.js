// settings.js — settings page (vault info, autolock, change password)

import * as vault from '../vault.js';
import { getFilePath } from '../storage.js';
import { renderButton, setButtonLoading } from './components/button.js';
import { MIN_PASSWORD_LENGTH, renderStrengthBar, updateStrengthBar } from './components/password-strength.js';
import { showToast } from './components/toast.js';
import { esc, shortenPath, INPUT_CLS } from './helpers.js';
import { setAutolockMinutes } from '../autolock.js';

export function renderSettings(render) {
  const settings = vault.getSettings();
  const data = vault.getData();
  const serviceCount = Object.keys(data.services).length;
  const envCount = data.environments.length;
  const secretCount = Object.values(data.secrets.global).reduce((n, svc) => n + Object.keys(svc).length, 0)
    + Object.values(data.secrets.envs).reduce((n, env) => n + Object.values(env).reduce((m, svc) => m + Object.keys(svc).length, 0), 0);
  const templateCount = Object.keys(data.templates).length;

  return `
    <div class="max-w-lg space-y-8">
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- Vault info -->
      <section class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vault</h3>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <span class="text-gray-500 dark:text-gray-400">File</span>
            <span class="truncate" title="${esc(getFilePath())}">${esc(shortenPath(getFilePath()))}</span>
            <span class="text-gray-500 dark:text-gray-400">Services</span>
            <span>${serviceCount}</span>
            <span class="text-gray-500 dark:text-gray-400">Environments</span>
            <span>${envCount}</span>
            <span class="text-gray-500 dark:text-gray-400">Secrets</span>
            <span>${secretCount}</span>
            <span class="text-gray-500 dark:text-gray-400">Templates</span>
            <span>${templateCount}</span>
          </div>
        </div>
      </section>

      <!-- Security -->
      <section class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Security</h3>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-5">
          <!-- Autolock -->
          <div class="flex items-center justify-between">
            <label for="settings-autolock" class="text-sm">Auto-lock</label>
            <select id="settings-autolock" class="${INPUT_CLS} w-20 text-center">
              ${[1, 2, 5, 10, 15, 30, 60].map(m => `<option value="${m}"${m === settings.autolockMinutes ? ' selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>

          <!-- Change password -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-5 space-y-3">
            <h4 class="text-sm font-medium">Change password</h4>
            <input id="chpw-current" type="password" placeholder="Current password" class="w-full ${INPUT_CLS}" />
            <input id="chpw-new" type="password" placeholder="New password" class="w-full ${INPUT_CLS}" />
            ${renderStrengthBar('chpw-strength')}
            <input id="chpw-confirm" type="password" placeholder="Confirm new password" class="w-full ${INPUT_CLS}" />
            <p id="chpw-error" class="text-red-500 text-sm hidden"></p>
            <p id="chpw-success" class="text-green-500 text-sm hidden"></p>
            <div class="flex justify-end">
              ${renderButton('Change password', { id: 'chpw-submit', variant: 'primary' })}
            </div>
          </div>
        </div>
      </section>
    </div>`;
}

export function bindSettings(render) {
  // Autolock
  const autolockSelect = document.getElementById('settings-autolock');
  autolockSelect.onchange = async () => {
    const minutes = parseInt(autolockSelect.value, 10);
    await vault.setAutolockMinutes(minutes);
    setAutolockMinutes(minutes);
    showToast(`Auto-lock: ${minutes} min`, 'success');
  };

  // Change password
  const errorEl = document.getElementById('chpw-error');
  const successEl = document.getElementById('chpw-success');

  document.getElementById('chpw-new').addEventListener('input', (e) => {
    updateStrengthBar(e.target.value, 'chpw-strength');
  });

  document.getElementById('chpw-submit').onclick = async () => {
    const current = document.getElementById('chpw-current').value;
    const newPw = document.getElementById('chpw-new').value;
    const confirm = document.getElementById('chpw-confirm').value;
    const submitBtn = document.getElementById('chpw-submit');
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (!current || !newPw) {
      errorEl.textContent = 'All fields are required';
      errorEl.classList.remove('hidden');
      return;
    }
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      errorEl.textContent = `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
      errorEl.classList.remove('hidden');
      return;
    }
    if (newPw !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.classList.remove('hidden');
      return;
    }
    setButtonLoading(submitBtn, true);
    try {
      await vault.changePassword(current, newPw);
      setButtonLoading(submitBtn, false, 'Change password');
      showToast('Password changed', 'success');
      document.getElementById('chpw-current').value = '';
      document.getElementById('chpw-new').value = '';
      document.getElementById('chpw-confirm').value = '';
      updateStrengthBar('', 'chpw-strength');
    } catch {
      setButtonLoading(submitBtn, false, 'Change password');
      errorEl.textContent = 'Current password is incorrect';
      errorEl.classList.remove('hidden');
    }
  };
}
