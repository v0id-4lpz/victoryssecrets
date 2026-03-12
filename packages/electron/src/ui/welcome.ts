// welcome.ts — welcome screen (create/open vault)

import * as vault from '../vault';
import { getRecents, addRecent, removeRecent } from '../recents';
import { toggleTheme } from './theme';
import { renderButton, setButtonLoading } from './components/button';
import { renderDeleteButton } from './components/delete-button';
import { icons } from './components/icon';
import { MIN_PASSWORD_LENGTH, renderStrengthBar, updateStrengthBar } from './components/password-strength';
import { fileName, dirName, shortenPath, esc, updateInfo } from './helpers';

let pendingAction: 'create' | 'open' | null = null;
let pendingFilePath: string | null = null;

function renderRecentsList(): string {
  const recents = getRecents();
  if (recents.length === 0) return '';
  return `
    <div class="mt-14">
      <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold">Recents</p>
      <div class="mt-2">
        ${recents.map(filePath => `
          <div class="no-drag group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition" data-recent-path="${filePath}">
            <div class="flex-1 min-w-0 pointer-events-none">
              <div class="text-sm font-medium truncate">${fileName(filePath)}</div>
              <div class="text-xs text-gray-400 truncate">${dirName(filePath)}</div>
            </div>
            ${renderDeleteButton('data-remove-recent', filePath)}
          </div>
        `).join('')}
      </div>
    </div>`;
}

export function renderWelcome(): string {
  return `
    <div class="min-h-screen flex justify-center bg-gray-100 dark:bg-gray-950 drag-region">
      <div class="w-140 min-h-screen bg-white dark:bg-gray-900 px-16 py-8 flex flex-col justify-center">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Victory's Secrets</h1>
          <p class="mt-2 text-gray-500 dark:text-gray-400">Local secrets manager</p>
          ${updateInfo ? `<a id="update-link-welcome" href="#" class="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-500 hover:text-indigo-400 transition">${icons.arrowUp('w-3.5 h-3.5')} v${esc(updateInfo.version)} available</a>` : ''}
        </div>
        <div class="mt-10 flex justify-center">
          ${renderButton(icons.theme(), { id: 'btn-theme-welcome', variant: 'icon', title: 'Toggle theme' })}
        </div>
        <div id="welcome-actions" class="mt-10">
          ${renderButton('Create a new vault', { id: 'btn-create', variant: 'primary', cls: 'w-full flex justify-center py-3 !text-sm font-medium' })}
          <div class="mt-4">${renderButton('Open an existing vault', { id: 'btn-open', variant: 'secondary', cls: 'w-full flex justify-center py-3 !text-sm font-medium' })}</div>
        </div>
        <div id="welcome-recents">${renderRecentsList()}</div>
        <div id="password-form" class="hidden mt-14">
          <p id="vault-path" class="text-xs text-gray-400 truncate text-center mb-4"></p>
          <input id="password-input" type="password" placeholder="Master password" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <div id="password-strength" class="hidden mt-4">
            ${renderStrengthBar('strength')}
          </div>
          <input id="password-confirm" type="password" placeholder="Confirm password" class="hidden w-full mt-4 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <p id="password-error" class="text-red-500 text-sm hidden mt-4"></p>
          <div class="mt-4">${renderButton('Unlock', { id: 'btn-submit-password', variant: 'primary', cls: 'w-full py-3 !text-sm font-medium' })}</div>
          <div class="mt-3">${renderButton('Back', { id: 'btn-cancel-password', variant: 'ghost', cls: 'w-full flex justify-center py-3 !text-sm font-medium' })}</div>
        </div>
      </div>
    </div>`;
}

function showPasswordForm(action: 'create' | 'open', label: string): void {
  pendingAction = action;
  document.getElementById('welcome-actions')!.classList.add('hidden');
  document.getElementById('welcome-recents')!.classList.add('hidden');
  const form = document.getElementById('password-form')!;
  form.classList.remove('hidden');
  const isCreate = action === 'create';
  document.getElementById('password-confirm')!.classList.toggle('hidden', !isCreate);
  document.getElementById('password-strength')!.classList.toggle('hidden', !isCreate);
  document.getElementById('btn-submit-password')!.textContent = label;
  (document.getElementById('password-input') as HTMLInputElement).value = '';
  (document.getElementById('password-confirm') as HTMLInputElement).value = '';
  document.getElementById('password-error')!.classList.add('hidden');
  document.getElementById('vault-path')!.textContent = shortenPath(pendingFilePath);
  if (isCreate) updateStrengthBar('', 'strength');
  document.getElementById('password-input')!.focus();
}

export function bindWelcome(render: () => void): void {
  document.getElementById('btn-theme-welcome')!.onclick = toggleTheme;
  const updateLink = document.getElementById('update-link-welcome');
  if (updateLink) updateLink.onclick = (e) => { e.preventDefault(); window.electronAPI?.openExternal(updateInfo!.url); };

  document.getElementById('btn-create')!.onclick = async () => {
    const filePath = await window.electronAPI!.createVaultDialog();
    if (!filePath) return;
    pendingFilePath = filePath;
    showPasswordForm('create', 'Create vault');
  };

  document.getElementById('btn-open')!.onclick = async () => {
    const filePath = await window.electronAPI!.openVaultDialog();
    if (!filePath) return;
    pendingFilePath = filePath;
    showPasswordForm('open', 'Unlock');
  };

  document.querySelectorAll('[data-recent-path]').forEach(row => {
    (row as HTMLElement).onclick = async (e) => {
      if ((e.target as HTMLElement).closest('[data-remove-recent]')) return;
      const filePath = (row as HTMLElement).dataset.recentPath!;
      pendingFilePath = filePath;
      showPasswordForm('open', 'Unlock');
    };
  });

  document.querySelectorAll('[data-remove-recent]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      removeRecent((btn as HTMLElement).dataset.removeRecent!);
      render();
    };
  });

  document.getElementById('password-input')!.addEventListener('input', (e) => {
    if (pendingAction === 'create') updateStrengthBar((e.target as HTMLInputElement).value, 'strength');
  });

  const submitPassword = async () => {
    const password = (document.getElementById('password-input') as HTMLInputElement).value;
    const errorEl = document.getElementById('password-error')!;
    const submitBtn = document.getElementById('btn-submit-password') as HTMLButtonElement;
    const submitLabel = submitBtn.textContent!;
    errorEl.classList.add('hidden');

    if (!password) {
      errorEl.textContent = 'Password required';
      errorEl.classList.remove('hidden');
      return;
    }

    if (pendingAction === 'create') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        errorEl.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        errorEl.classList.remove('hidden');
        return;
      }
      const confirm = (document.getElementById('password-confirm') as HTMLInputElement).value;
      if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
        return;
      }
    }

    setButtonLoading(submitBtn, true);
    try {
      if (pendingAction === 'create') {
        await vault.create(pendingFilePath!, password);
      } else {
        await vault.open(pendingFilePath!, password);
      }
      addRecent(vault.getPath());
      render();
    } catch {
      setButtonLoading(submitBtn, false, submitLabel);
      errorEl.textContent = 'Incorrect password or invalid file';
      errorEl.classList.remove('hidden');
    }
  };

  document.getElementById('btn-submit-password')!.onclick = submitPassword;
  document.getElementById('btn-cancel-password')!.onclick = () => { pendingAction = null; pendingFilePath = null; render(); };
  (document.getElementById('password-input') as HTMLInputElement).onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
  (document.getElementById('password-confirm') as HTMLInputElement).onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
}
