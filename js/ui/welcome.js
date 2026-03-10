// welcome.js — welcome screen (create/open vault)

import * as vault from '../vault.js';
import * as storage from '../storage.js';
import { getRecents, addRecent, removeRecent } from '../recents.js';
import { toggleTheme } from './theme.js';
import { renderButton } from './components/button.js';
import { renderDeleteButton } from './components/delete-button.js';
import { icons } from './components/icon.js';

let pendingAction = null; // 'create' | 'open'
let pendingBuffer = null;

function fileName(filePath) {
  return filePath.split(/[/\\]/).pop();
}

function dirName(filePath) {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  let dir = parts.join('/');
  const home = typeof process !== 'undefined' ? '' : '';
  // Shorten home dir
  try {
    if (dir.startsWith('/Users/')) {
      const segments = dir.split('/');
      dir = '~/' + segments.slice(3).join('/');
    }
  } catch {}
  return dir;
}

function renderRecentsList() {
  const recents = getRecents();
  if (recents.length === 0) return '';
  return `
    <div class="space-y-2">
      <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold">Recents</p>
      <div class="space-y-1">
        ${recents.map(filePath => `
          <div class="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition" data-recent-path="${filePath}">
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

export function renderWelcome() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 drag-region relative overflow-hidden">
      <!-- Background icon -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] dark:opacity-[0.06]">
        ${icons.shield()}
      </div>
      <div class="no-drag max-w-md w-full space-y-8 p-8 relative z-10">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Victory's Secrets</h1>
          <p class="mt-2 text-gray-500 dark:text-gray-400">Gestionnaire de secrets local</p>
        </div>
        <div class="space-y-4">
          ${renderButton('Creer un nouveau vault', { id: 'btn-create', variant: 'primary', cls: 'w-full flex justify-center py-3 !text-sm font-medium' })}
          ${renderButton('Ouvrir un vault existant', { id: 'btn-open', variant: 'secondary', cls: 'w-full flex justify-center py-3 !text-sm font-medium' })}
        </div>
        ${renderRecentsList()}
        <div id="password-form" class="hidden space-y-4">
          <input id="password-input" type="password" placeholder="Mot de passe maitre" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <input id="password-confirm" type="password" placeholder="Confirmer le mot de passe" class="hidden w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <p id="password-error" class="text-red-500 text-sm hidden"></p>
          ${renderButton('Deverrouiller', { id: 'btn-submit-password', variant: 'primary', cls: 'w-full py-3 !text-sm font-medium' })}
        </div>
        <div class="flex justify-center">
          ${renderButton(icons.theme(), { id: 'btn-theme-welcome', variant: 'icon', title: 'Toggle theme' })}
        </div>
      </div>
    </div>`;
}

function showPasswordForm(action, label) {
  pendingAction = action;
  const form = document.getElementById('password-form');
  form.classList.remove('hidden');
  document.getElementById('password-confirm').classList.toggle('hidden', action !== 'create');
  document.getElementById('btn-submit-password').textContent = label;
  document.getElementById('password-input').value = '';
  document.getElementById('password-confirm').value = '';
  document.getElementById('password-error').classList.add('hidden');
  document.getElementById('password-input').focus();
}

export function bindWelcome(render) {
  document.getElementById('btn-theme-welcome').onclick = toggleTheme;

  document.getElementById('btn-create').onclick = async () => {
    try {
      await storage.createFile();
      pendingBuffer = null;
      showPasswordForm('create', 'Creer le vault');
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Create vault error:', e);
    }
  };

  document.getElementById('btn-open').onclick = async () => {
    try {
      const buffer = await storage.openFile();
      pendingBuffer = buffer;
      showPasswordForm('open', 'Deverrouiller');
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Open vault error:', e);
    }
  };

  // Recent vaults — open by path
  document.querySelectorAll('[data-recent-path]').forEach(row => {
    row.onclick = async (e) => {
      if (e.target.closest('[data-remove-recent]')) return;
      const filePath = row.dataset.recentPath;
      try {
        const buffer = await storage.openFilePath(filePath);
        pendingBuffer = buffer;
        showPasswordForm('open', 'Deverrouiller');
      } catch {
        removeRecent(filePath);
        render();
      }
    };
  });

  // Recent vaults — remove from list
  document.querySelectorAll('[data-remove-recent]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      removeRecent(btn.dataset.removeRecent);
      render();
    };
  });

  const submitPassword = async () => {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('password-error');
    errorEl.classList.add('hidden');

    if (!password) {
      errorEl.textContent = 'Mot de passe requis';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      if (pendingAction === 'create') {
        const confirm = document.getElementById('password-confirm').value;
        if (password !== confirm) {
          errorEl.textContent = 'Les mots de passe ne correspondent pas';
          errorEl.classList.remove('hidden');
          return;
        }
        await vault.create(password);
      } else {
        await vault.open(pendingBuffer, password);
      }
      addRecent(storage.getFilePath());
      render();
    } catch (e) {
      errorEl.textContent = 'Mot de passe incorrect ou fichier invalide';
      errorEl.classList.remove('hidden');
    }
  };

  document.getElementById('btn-submit-password').onclick = submitPassword;
  document.getElementById('password-input').onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
  document.getElementById('password-confirm').onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
}
