// app.js — main orchestrator

import * as vault from './vault.js';
import { getFilePath } from './storage.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { renderButton } from './ui/components/button.js';
import { icons } from './ui/components/icon.js';
import { showToast } from './ui/components/toast.js';
import { currentSection, setCurrentSection, esc, shortenPath } from './ui/helpers.js';
import { renderWelcome, bindWelcome } from './ui/welcome.js';
import { renderServices, bindServices } from './ui/services.js';
import { renderEnvironments, bindEnvironments } from './ui/environments.js';
import { renderSecrets, bindSecrets, clearSecretStore } from './ui/secrets.js';
import { renderTemplates, bindTemplates } from './ui/templates.js';
import { renderGenerate, bindGenerate } from './ui/generate.js';
import { renderSettings, bindSettings } from './ui/settings.js';
import { startAutoLock, stopAutoLock, setAutolockMinutes } from './autolock.js';
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
    case 'settings': return renderSettings(render);
    default: return '';
  }
}

function renderSearchModal() {
  return `
    <div id="search-modal" class="hidden fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          ${icons.search()}
          <input id="search-input" type="text" placeholder="Search services, secrets, templates..." class="flex-1 bg-transparent text-sm focus:outline-none" />
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
  if (results.length === 0) return '<p class="text-gray-400 text-xs px-3 py-4 text-center">No results</p>';
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
    <div class="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <!-- Header -->
      <header class="drag-region bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <div class="pl-16 flex items-baseline gap-3 min-w-0">
          <h1 class="text-xl font-bold shrink-0">Victory's Secrets</h1>
          <span class="text-xs text-gray-400 truncate">${shortenPath(getFilePath())}</span>
        </div>
        <div class="no-drag flex items-center gap-3">
          ${renderButton(icons.search(), { id: 'btn-search', variant: 'icon', title: 'Search (Ctrl+K)' })}
          ${renderButton(icons.theme(), { id: 'btn-theme', variant: 'icon', title: 'Toggle theme' })}
          ${renderButton('Lock', { id: 'btn-lock', cls: 'px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' })}
        </div>
      </header>

      <div class="flex h-[calc(100vh-57px)]">
        <!-- Sidebar -->
        <nav class="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 space-y-1 shrink-0">
          ${renderNavItem('services', 'Services')}
          ${renderNavItem('environments', 'Environments')}
          ${renderNavItem('secrets', 'Secrets')}
          <div class="!mt-4 border-t border-gray-200 dark:border-gray-700 pt-3"></div>
          ${renderNavItem('templates', 'Templates')}
          ${renderNavItem('generate', 'Generate .env')}
          <div class="!mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            ${renderNavItem('settings', 'Settings')}
          </div>
        </nav>

        <!-- Content -->
        <main class="flex-1 p-6 overflow-y-auto">
          ${renderSection()}
        </main>
      </div>

      ${renderSearchModal()}
      <!-- Privacy overlay on window blur -->
      <div id="privacy-overlay" class="hidden fixed inset-0 z-[100] bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-lg flex items-center justify-center">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-400 dark:text-gray-600">Victory's Secrets</h2>
          <p class="text-sm text-gray-400 dark:text-gray-600 mt-1">Click to return</p>
        </div>
      </div>
    </div>`;
}

function bindMain() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { setCurrentSection(btn.dataset.nav); render(); };
  });

  document.getElementById('btn-theme').onclick = toggleTheme;
  document.getElementById('btn-lock').onclick = () => {
    clearSecretStore();
    vault.lock();
    stopAutoLock();
    render();
  };

  // Privacy overlay on window blur/focus
  if (window.electronAPI?.onWindowBlur) {
    window.electronAPI.onWindowBlur(() => {
      document.getElementById('privacy-overlay')?.classList.remove('hidden');
    });
    window.electronAPI.onWindowFocus(() => {
      document.getElementById('privacy-overlay')?.classList.add('hidden');
    });
  }
  document.getElementById('btn-search').onclick = () => {
    const modal = document.getElementById('search-modal');
    modal.classList.remove('hidden');
    document.getElementById('search-input').focus();
  };

  bindSearch();

  switch (currentSection) {
    case 'services': bindServices(render); break;
    case 'environments': bindEnvironments(render); break;
    case 'secrets': bindSecrets(render); break;
    case 'templates': bindTemplates(render); break;
    case 'generate': bindGenerate(render); break;
    case 'settings': bindSettings(render); break;
  }
}

function render() {
  const app = document.getElementById('app');
  if (!vault.isUnlocked()) {
    stopAutoLock();
    app.innerHTML = renderWelcome();
    bindWelcome(render);
  } else {
    const settings = vault.getSettings();
    setAutolockMinutes(settings.autolockMinutes);
    startAutoLock(() => { clearSecretStore(); vault.lock(); render(); showToast('Vault locked (inactivity)', 'info'); });
    app.innerHTML = renderMain();
    bindMain();
  }
}

// --- Init ---
initTheme();
render();
