// app.ts — main orchestrator

import * as vault from './vault';
import { getFilePath } from './storage';
import { initTheme, toggleTheme } from './ui/theme';
import { renderButton } from './ui/components/button';
import { icons } from './ui/components/icon';
import { showToast } from './ui/components/toast';
import { currentSection, setCurrentSection, esc, shortenPath, updateInfo, setUpdateInfo } from './ui/helpers';
import { renderWelcome, bindWelcome } from './ui/welcome';
import { renderServices, bindServices } from './ui/services';
import { renderEnvironments, bindEnvironments } from './ui/environments';
import { renderSecrets, bindSecrets, clearSecretStore } from './ui/secrets';
import { renderTemplates, bindTemplates } from './ui/templates';
import { renderGenerate, bindGenerate } from './ui/generate';
import { renderSettings, bindSettings } from './ui/settings';
import { startAutoLock, stopAutoLock, setAutolockMinutes } from './autolock';
import { buildSearchIndex as buildIndex, filterSearch as searchFilter } from './services/search';
import { getEnvironmentComment } from './services/environment-ops';
import type { SearchResult } from './types/vault';

function renderNavItem(section: string, label: string): string {
  const active = currentSection === section;
  const cls = active
    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800';
  return `<button data-nav="${section}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${cls} transition">${label}</button>`;
}

function renderSection(): string {
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

function renderSearchModal(): string {
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

function buildSearchIndex(): SearchResult[] {
  const data = vault.getData();
  return buildIndex(data, (envId) => getEnvironmentComment(data, envId));
}

function filterSearch(query: string, index: SearchResult[]): SearchResult[] {
  return searchFilter(query, index);
}

const SEARCH_TYPE_LABELS: Record<string, string> = { service: 'Service', env: 'Env', secret: 'Secret', template: 'Template' };
const SEARCH_TYPE_COLORS: Record<string, string> = {
  service: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
  env: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300',
  secret: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
  template: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300',
};

function renderSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '<p class="text-gray-400 text-xs px-3 py-4 text-center">No results</p>';
  return results.map(r => `
    <button data-search-nav="${r.section}" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition">
      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEARCH_TYPE_COLORS[r.type] || ''}">${SEARCH_TYPE_LABELS[r.type] || ''}</span>
      <span class="text-sm truncate flex-1">${esc(r.label)}</span>
      <span class="text-xs text-gray-400 truncate max-w-[120px]">${esc(r.comment)}</span>
    </button>
  `).join('');
}

function bindSearch(): void {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const resultsEl = document.getElementById('search-results');
  if (!modal || !input || !resultsEl) return;

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
    resultsEl.querySelectorAll('[data-search-nav]').forEach(btn => {
      (btn as HTMLElement).onclick = () => {
        setCurrentSection((btn as HTMLElement).dataset.searchNav!);
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

function renderMain(): string {
  return `
    <div class="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <header class="drag-region bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <div class="pl-16 flex items-baseline gap-3 min-w-0">
          <h1 class="text-xl font-bold shrink-0">Victory's Secrets</h1>
          <span class="text-xs text-gray-400 truncate">${shortenPath(getFilePath())}</span>
          ${updateInfo ? `<a id="update-link-header" href="#" class="shrink-0 no-drag inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition">${icons.arrowUp('w-3 h-3')} v${esc(updateInfo.version)}</a>` : ''}
        </div>
        <div class="no-drag flex items-center gap-3">
          ${renderButton(icons.search(), { id: 'btn-search', variant: 'icon', title: 'Search (Ctrl+K)' })}
          ${renderButton(icons.theme(), { id: 'btn-theme', variant: 'icon', title: 'Toggle theme' })}
          ${renderButton('Lock', { id: 'btn-lock', cls: 'px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' })}
        </div>
      </header>

      <div class="flex h-[calc(100vh-57px)]">
        <nav class="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 space-y-1 shrink-0">
          ${renderNavItem('services', 'Services')}
          ${renderNavItem('environments', 'Environments')}
          ${renderNavItem('secrets', 'Secrets')}
          <div class="!mt-4 border-t border-gray-200 dark:border-gray-700 pt-3"></div>
          ${renderNavItem('templates', '.env template')}
          ${renderNavItem('generate', '.env generate')}
          <div class="!mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            ${renderNavItem('settings', 'Settings')}
          </div>
        </nav>

        <main class="flex-1 p-6 overflow-y-auto">
          ${renderSection()}
        </main>
      </div>

      ${renderSearchModal()}
      <div id="privacy-overlay" class="hidden fixed inset-0 z-[100] bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-lg flex items-center justify-center">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-400 dark:text-gray-600">Victory's Secrets</h2>
          <p class="text-sm text-gray-400 dark:text-gray-600 mt-1">Click to return</p>
        </div>
      </div>
    </div>`;
}

function bindMain(): void {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    (btn as HTMLElement).onclick = () => { setCurrentSection((btn as HTMLElement).dataset.nav!); render(); };
  });

  document.getElementById('btn-theme')!.onclick = toggleTheme;
  document.getElementById('btn-lock')!.onclick = () => {
    clearSecretStore();
    vault.lock();
    stopAutoLock();
    render();
  };

  if (window.electronAPI?.onWindowBlur) {
    window.electronAPI.onWindowBlur(() => {
      document.getElementById('privacy-overlay')?.classList.remove('hidden');
    });
    window.electronAPI.onWindowFocus(() => {
      document.getElementById('privacy-overlay')?.classList.add('hidden');
    });
  }
  const updateLink = document.getElementById('update-link-header');
  if (updateLink) updateLink.onclick = (e) => { e.preventDefault(); window.electronAPI?.openExternal(updateInfo!.url); };

  document.getElementById('btn-search')!.onclick = () => {
    const modal = document.getElementById('search-modal')!;
    modal.classList.remove('hidden');
    document.getElementById('search-input')!.focus();
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

function render(): void {
  const app = document.getElementById('app')!;
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

if (window.electronAPI?.checkUpdate) {
  window.electronAPI.checkUpdate().then(info => {
    if (info) { setUpdateInfo(info); render(); }
  });
}
