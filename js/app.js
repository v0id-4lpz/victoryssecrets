// app.js — main orchestrator

import * as vault from './vault.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { currentSection, setCurrentSection } from './ui/helpers.js';
import { renderWelcome, bindWelcome } from './ui/welcome.js';
import { renderServices, bindServices } from './ui/services.js';
import { renderEnvironments, bindEnvironments } from './ui/environments.js';
import { renderSecrets, bindSecrets } from './ui/secrets.js';
import { renderTemplates, bindTemplates } from './ui/templates.js';
import { renderGenerate, bindGenerate } from './ui/generate.js';

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

function renderMain() {
  return `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <!-- Header -->
      <header class="drag-region bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 class="text-xl font-bold pl-16">Victory's Secrets</h1>
        <div class="no-drag flex items-center gap-3">
          <button id="btn-theme" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition" title="Toggle theme">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </button>
          <button id="btn-lock" class="px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition">
            Verrouiller
          </button>
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
    </div>`;
}

function bindMain() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { setCurrentSection(btn.dataset.nav); render(); };
  });

  document.getElementById('btn-theme').onclick = toggleTheme;
  document.getElementById('btn-lock').onclick = () => { vault.lock(); render(); };

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
    app.innerHTML = renderWelcome();
    bindWelcome(render);
  } else {
    app.innerHTML = renderMain();
    bindMain();
  }
}

// --- Init ---
initTheme();
render();
