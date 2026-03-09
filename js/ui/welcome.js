// welcome.js — welcome screen (create/open vault)

import * as vault from '../vault.js';
import * as storage from '../storage.js';
import { toggleTheme } from './theme.js';

let pendingAction = null; // 'create' | 'open'
let pendingBuffer = null;

export function renderWelcome() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 drag-region relative overflow-hidden">
      <!-- Background icon -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] dark:opacity-[0.06]">
        <svg viewBox="0 0 1024 1024" class="w-[600px] h-[600px]">
          <path d="M512 100 L820 240 C820 240 850 600 512 920 C174 600 204 240 204 240 Z" fill="currentColor"/>
          <g transform="translate(512, 500)">
            <rect x="-80" y="-20" width="160" height="120" rx="20" fill="white" class="text-gray-50 dark:text-gray-950"/>
            <path d="M-48,-20 L-48,-70 A48,48 0 0,1 48,-70 L48,-20" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
      <div class="no-drag max-w-md w-full space-y-8 p-8 relative z-10">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Victory's Secrets</h1>
          <p class="mt-2 text-gray-500 dark:text-gray-400">Gestionnaire de secrets local</p>
        </div>
        <div class="space-y-4">
          <button id="btn-create" class="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition">
            Creer un nouveau vault
          </button>
          <button id="btn-open" class="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            Ouvrir un vault existant
          </button>
        </div>
        <div id="password-form" class="hidden space-y-4">
          <input id="password-input" type="password" placeholder="Mot de passe maitre" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <input id="password-confirm" type="password" placeholder="Confirmer le mot de passe" class="hidden w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <p id="password-error" class="text-red-500 text-sm hidden"></p>
          <button id="btn-submit-password" class="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition">
            Deverrouiller
          </button>
        </div>
        <div class="flex justify-center">
          <button id="btn-theme-welcome" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition" title="Toggle theme">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </button>
        </div>
      </div>
    </div>`;
}

export function bindWelcome(render) {
  document.getElementById('btn-theme-welcome').onclick = toggleTheme;

  document.getElementById('btn-create').onclick = async () => {
    try {
      await storage.createFile();
      pendingAction = 'create';
      pendingBuffer = null;
      const form = document.getElementById('password-form');
      form.classList.remove('hidden');
      document.getElementById('password-confirm').classList.remove('hidden');
      document.getElementById('btn-submit-password').textContent = 'Creer le vault';
      document.getElementById('password-input').focus();
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Create vault error:', e);
    }
  };

  document.getElementById('btn-open').onclick = async () => {
    try {
      const buffer = await storage.openFile();
      pendingAction = 'open';
      pendingBuffer = buffer;
      const form = document.getElementById('password-form');
      form.classList.remove('hidden');
      document.getElementById('password-confirm').classList.add('hidden');
      document.getElementById('btn-submit-password').textContent = 'Deverrouiller';
      document.getElementById('password-input').focus();
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Open vault error:', e);
    }
  };

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
