// app.js — main orchestrator

import * as vault from './vault.js';
import { getFilePath } from './storage.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { renderButton, setButtonLoading } from './ui/components/button.js';
import { icons } from './ui/components/icon.js';
import { MIN_PASSWORD_LENGTH, renderStrengthBar, updateStrengthBar } from './ui/components/password-strength.js';
import { showToast } from './ui/components/toast.js';
import { currentSection, setCurrentSection, esc, shortenPath } from './ui/helpers.js';
import { renderWelcome, bindWelcome } from './ui/welcome.js';
import { renderServices, bindServices } from './ui/services.js';
import { renderEnvironments, bindEnvironments } from './ui/environments.js';
import { renderSecrets, bindSecrets } from './ui/secrets.js';
import { renderTemplates, bindTemplates } from './ui/templates.js';
import { renderGenerate, bindGenerate } from './ui/generate.js';
import { startAutoLock, stopAutoLock } from './autolock.js';
import { buildSearchIndex as buildIndex, filterSearch as searchFilter } from './services/search.js';
import { getEnvironmentComment } from './services/environment-ops.js';

function renderNavItem(section, label) {
  const active = currentSection === section;
  const cls = active
    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800';
  return `<button data-nav="${section}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${cls} transition">${label}</button>`;
}

function renderSection() {
  switch (currentSection) {
    case 'services': return renderServices(render);
    case 'environments': return renderEnvironments(render);
    case 'secrets': return renderSecrets(render);
    case 'templates': return renderTemplates(render);
    case 'generate': return renderGenerate(render);
    default: return '';
  }
}

function renderChangePasswordModal() {
  return `
    <div id="change-password-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-200 dark:border-gray-700 shadow-xl space-y-4">
        <h3 class="text-sm font-semibold">Changer le mot de passe</h3>
        <div class="space-y-3">
          <input id="chpw-current" type="password" placeholder="Mot de passe actuel" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <input id="chpw-new" type="password" placeholder="Nouveau mot de passe" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          ${renderStrengthBar('chpw-strength')}
          <input id="chpw-confirm" type="password" placeholder="Confirmer le nouveau mot de passe" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <p id="chpw-error" class="text-red-500 text-sm hidden"></p>
          <p id="chpw-success" class="text-green-500 text-sm hidden"></p>
        </div>
        <div class="flex justify-end gap-2">
          ${renderButton('Annuler', { id: 'chpw-cancel', variant: 'secondary' })}
          ${renderButton('Changer', { id: 'chpw-submit', variant: 'primary' })}
        </div>
      </div>
    </div>`;
}

function renderSearchModal() {
  return `
    <div id="search-modal" class="hidden fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          ${icons.search()}
          <input id="search-input" type="text" placeholder="Rechercher services, secrets, templates..." class="flex-1 bg-transparent text-sm focus:outline-none" />
          <kbd class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div id="search-results" class="max-h-80 overflow-y-auto p-2"></div>
      </div>
    </div>`;
}

function buildSearchIndex() {
  const data = vault.getData();
  return buildIndex(data, (envId) => getEnvironmentComment(data, envId));
}

function filterSearch(query, index) {
  return searchFilter(query, index);
}

const SEARCH_TYPE_LABELS = { service: 'Service', env: 'Env', secret: 'Secret', template: 'Template' };
const SEARCH_TYPE_COLORS = {
  service: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
  env: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300',
  secret: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
  template: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300',
};

function renderSearchResults(results) {
  if (results.length === 0) return '<p class="text-gray-400 text-xs px-3 py-4 text-center">Aucun resultat</p>';
  return results.map(r => `
    <button data-search-nav="${r.section}" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEARCH_TYPE_COLORS[r.type]}">${SEARCH_TYPE_LABELS[r.type]}</span>
      <span class="text-sm truncate flex-1">${esc(r.label)}</span>
      <span class="text-xs text-gray-400 truncate max-w-[120px]">${esc(r.comment)}</span>
    </button>
  `).join('');
}

function bindSearch() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  if (!modal) return;

  const index = buildSearchIndex();

  const openSearch = () => {
    modal.classList.remove('hidden');
    input.value = '';
    resultsEl.innerHTML = '';
    input.focus();
  };

  const closeSearch = () => {
    modal.classList.add('hidden');
  };

  // Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modal.classList.contains('hidden')) openSearch();
      else closeSearch();
    }
  });

  input.addEventListener('input', () => {
    const results = filterSearch(input.value, index);
    resultsEl.innerHTML = renderSearchResults(results);
    // Bind navigation
    resultsEl.querySelectorAll('[data-search-nav]').forEach(btn => {
      btn.onclick = () => {
        setCurrentSection(btn.dataset.searchNav);
        closeSearch();
        render();
      };
    });
  });

  input.onkeydown = (e) => {
    if (e.key === 'Escape') closeSearch();
  };
  modal.onclick = (e) => {
    if (e.target === modal) closeSearch();
  };
}

function renderMain() {
  return `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <!-- Header -->
      <header class="drag-region bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <div class="pl-16 flex items-baseline gap-3 min-w-0">
          <h1 class="text-xl font-bold shrink-0">Victory's Secrets</h1>
          <span class="text-xs text-gray-400 truncate">${shortenPath(getFilePath())}</span>
        </div>
        <div class="no-drag flex items-center gap-3">
          ${renderButton(icons.search(), { id: 'btn-search', variant: 'icon', title: 'Rechercher (Ctrl+K)' })}
          ${renderButton(icons.theme(), { id: 'btn-theme', variant: 'icon', title: 'Toggle theme' })}
          ${renderButton('Mot de passe', { id: 'btn-change-password', variant: 'ghost' })}
          ${renderButton('Verrouiller', { id: 'btn-lock', cls: 'px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' })}
        </div>
      </header>

      <div class="flex h-[calc(100vh-57px)]">
        <!-- Sidebar -->
        <nav class="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 space-y-1 shrink-0">
          ${renderNavItem('services', 'Services')}
          ${renderNavItem('environments', 'Environnements')}
          ${renderNavItem('secrets', 'Secrets')}
          ${renderNavItem('templates', 'Templates')}
          ${renderNavItem('generate', 'Generer .env')}
        </nav>

        <!-- Content -->
        <main class="flex-1 p-6 overflow-y-auto">
          ${renderSection()}
        </main>
      </div>

      ${renderChangePasswordModal()}
      ${renderSearchModal()}
    </div>`;
}

function bindChangePassword() {
  const modal = document.getElementById('change-password-modal');
  const errorEl = document.getElementById('chpw-error');
  const successEl = document.getElementById('chpw-success');

  document.getElementById('btn-change-password').onclick = () => {
    modal.classList.remove('hidden');
    document.getElementById('chpw-current').value = '';
    document.getElementById('chpw-new').value = '';
    document.getElementById('chpw-confirm').value = '';
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    updateStrengthBar('', 'chpw-strength');
    document.getElementById('chpw-current').focus();
  };

  document.getElementById('chpw-cancel').onclick = () => modal.classList.add('hidden');

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
      errorEl.textContent = 'Tous les champs sont requis';
      errorEl.classList.remove('hidden');
      return;
    }
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      errorEl.textContent = `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caracteres`;
      errorEl.classList.remove('hidden');
      return;
    }
    if (newPw !== confirm) {
      errorEl.textContent = 'Les mots de passe ne correspondent pas';
      errorEl.classList.remove('hidden');
      return;
    }
    setButtonLoading(submitBtn, true);
    try {
      await vault.changePassword(current, newPw);
      setButtonLoading(submitBtn, false, 'Changer');
      showToast('Mot de passe modifie', 'success');
      setTimeout(() => modal.classList.add('hidden'), 800);
    } catch {
      setButtonLoading(submitBtn, false, 'Changer');
      errorEl.textContent = 'Mot de passe actuel incorrect';
      errorEl.classList.remove('hidden');
    }
  };
}

function bindMain() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { setCurrentSection(btn.dataset.nav); render(); };
  });

  document.getElementById('btn-theme').onclick = toggleTheme;
  document.getElementById('btn-lock').onclick = () => {
    vault.lock();
    stopAutoLock();
    render();
  };
  document.getElementById('btn-search').onclick = () => {
    const modal = document.getElementById('search-modal');
    modal.classList.remove('hidden');
    document.getElementById('search-input').focus();
  };

  bindChangePassword();
  bindSearch();

  switch (currentSection) {
    case 'services': bindServices(render); break;
    case 'environments': bindEnvironments(render); break;
    case 'secrets': bindSecrets(render); break;
    case 'templates': bindTemplates(render); break;
    case 'generate': bindGenerate(render); break;
  }
}

function render() {
  const app = document.getElementById('app');
  if (!vault.isUnlocked()) {
    stopAutoLock();
    app.innerHTML = renderWelcome();
    bindWelcome(render);
  } else {
    startAutoLock(() => { vault.lock(); render(); showToast('Vault verrouille (inactivite)', 'info'); });
    app.innerHTML = renderMain();
    bindMain();
  }
}

// --- Init ---
initTheme();
render();
