// settings.ts — settings page (vault info, autolock, change password)

import * as vault from '../vault';
import { renderButton, setButtonLoading } from './components/button';
import { MIN_PASSWORD_LENGTH, renderStrengthBar, updateStrengthBar } from './components/password-strength';
import { showToast } from './components/toast';
import { esc, shortenPath, INPUT_CLS } from './helpers';
import { setAutolockMinutes } from '../autolock';

export function renderSettings(render: () => void): string {
  const settings = vault.getSettings();
  const data = vault.getData();
  const serviceCount = Object.keys(data.services).length;
  const envCount = Object.keys(data.environments).length;
  const secretCount = Object.values(data.secrets || {}).reduce((n, fields) => n + Object.keys(fields).length, 0);
  const templateCount = Object.keys(data.templates?.main || {}).length;

  return `
    <div class="max-w-lg space-y-8">
      <h2 class="text-lg font-semibold">Settings</h2>

      <section class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vault</h3>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <span class="text-gray-500 dark:text-gray-400">File</span>
            <span class="truncate" title="${esc(vault.getPath() || '')}">${esc(shortenPath(vault.getPath()))}</span>
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

      <section class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Security</h3>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-5">
          <div class="flex items-center justify-between">
            <label for="settings-autolock" class="text-sm">Auto-lock</label>
            <select id="settings-autolock" class="${INPUT_CLS} w-20 text-center">
              ${[1, 2, 5, 10, 15, 30, 60].map(m => `<option value="${m}"${m === settings.autolockMinutes ? ' selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>

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

export function bindSettings(render: () => void): void {
  const autolockSelect = document.getElementById('settings-autolock') as HTMLSelectElement;
  autolockSelect.onchange = async () => {
    const minutes = parseInt(autolockSelect.value, 10);
    await vault.setAutolockMinutes(minutes);
    setAutolockMinutes(minutes);
    showToast(`Auto-lock: ${minutes} min`, 'success');
  };

  const errorEl = document.getElementById('chpw-error')!;
  const successEl = document.getElementById('chpw-success')!;

  (document.getElementById('chpw-new') as HTMLInputElement).addEventListener('input', (e) => {
    updateStrengthBar((e.target as HTMLInputElement).value, 'chpw-strength');
  });

  document.getElementById('chpw-submit')!.onclick = async () => {
    const current = (document.getElementById('chpw-current') as HTMLInputElement).value;
    const newPw = (document.getElementById('chpw-new') as HTMLInputElement).value;
    const confirmPw = (document.getElementById('chpw-confirm') as HTMLInputElement).value;
    const submitBtn = document.getElementById('chpw-submit') as HTMLButtonElement;
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
    if (newPw !== confirmPw) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.classList.remove('hidden');
      return;
    }
    setButtonLoading(submitBtn, true);
    try {
      await vault.changePassword(current, newPw);
      setButtonLoading(submitBtn, false, 'Change password');
      showToast('Password changed', 'success');
      (document.getElementById('chpw-current') as HTMLInputElement).value = '';
      (document.getElementById('chpw-new') as HTMLInputElement).value = '';
      (document.getElementById('chpw-confirm') as HTMLInputElement).value = '';
      updateStrengthBar('', 'chpw-strength');
    } catch {
      setButtonLoading(submitBtn, false, 'Change password');
      errorEl.textContent = 'Current password is incorrect';
      errorEl.classList.remove('hidden');
    }
  };
}
