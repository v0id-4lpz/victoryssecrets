// app.js — UI rendering and event handling

import * as vault from './vault.js';
import * as storage from './storage.js';
import { generateEnv } from './template.js';
import { generatePassword, generateBase64, generateHex, generateUUID } from './generator.js';

// --- State ---
let currentView = 'welcome'; // welcome | main
let currentSection = 'services'; // services | projects | secrets | templates
let selectedProject = null;
let selectedEnv = null;
let secretLevelScope = 'global'; // global | project | env

// --- Theme ---
function initTheme() {
  const saved = localStorage.getItem('vs-theme');
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('vs-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

// --- Render ---
function render() {
  const app = document.getElementById('app');
  if (!vault.isUnlocked()) {
    app.innerHTML = renderWelcome();
    bindWelcome();
  } else {
    app.innerHTML = renderMain();
    bindMain();
  }
}

// --- Welcome Screen ---
function renderWelcome() {
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

let pendingAction = null; // 'create' | 'open'
let pendingBuffer = null;

function bindWelcome() {
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

  document.getElementById('btn-submit-password').onclick = submitPassword;
  document.getElementById('password-input').onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
  document.getElementById('password-confirm').onkeydown = (e) => { if (e.key === 'Enter') submitPassword(); };
}

async function submitPassword() {
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
}

// --- Main Screen ---
function renderMain() {
  const data = vault.getData();
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
          ${renderNavItem('projects', 'Projets')}
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

function renderNavItem(section, label) {
  const active = currentSection === section;
  const cls = active
    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800';
  return `<button data-nav="${section}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${cls} transition">${label}</button>`;
}

function renderSection() {
  switch (currentSection) {
    case 'services': return renderServices();
    case 'projects': return renderProjects();
    case 'secrets': return renderSecrets();
    case 'templates': return renderTemplates();
    case 'generate': return renderGenerate();
    default: return '';
  }
}

// --- Services Section ---
function renderServices() {
  const data = vault.getData();
  const services = Object.entries(data.services || {});
  return `
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">Services</h2>
        <button id="btn-add-service" class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">+ Ajouter</button>
      </div>
      <div id="service-form" class="hidden mb-4 flex gap-2">
        <input id="service-label" type="text" placeholder="Label (ex: PostgreSQL)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <input id="service-id" type="text" placeholder="Identifiant (ex: postgres)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <button id="btn-save-service" class="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">OK</button>
      </div>
      ${services.length === 0
        ? '<p class="text-gray-400 text-sm">Aucun service.</p>'
        : `<div class="space-y-2">${services.map(([id, s]) => `
          <div class="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div>
              <span class="font-medium text-sm">${esc(s.label)}</span>
              <span class="ml-2 text-xs text-gray-400">${esc(id)}</span>
            </div>
            <button data-delete-service="${id}" class="text-red-400 hover:text-red-600 text-sm transition">Supprimer</button>
          </div>`).join('')}</div>`
      }
    </div>`;
}

// --- Projects Section ---
function renderProjects() {
  const data = vault.getData();
  const projects = Object.entries(data.projects || {});
  return `
    <div class="max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">Projets</h2>
        <button id="btn-add-project" class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">+ Ajouter</button>
      </div>
      <div id="project-form" class="hidden mb-4 flex gap-2">
        <input id="project-label" type="text" placeholder="Label (ex: My App)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <input id="project-id" type="text" placeholder="Identifiant (ex: my-app)" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        <button id="btn-save-project" class="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">OK</button>
      </div>
      ${projects.length === 0
        ? '<p class="text-gray-400 text-sm">Aucun projet.</p>'
        : `<div class="space-y-4">${projects.map(([id, p]) => `
          <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="font-medium">${esc(p.label)}</span>
                <span class="ml-2 text-xs text-gray-400">${esc(id)}</span>
              </div>
              <button data-delete-project="${id}" class="text-red-400 hover:text-red-600 text-sm transition">Supprimer</button>
            </div>
            <div class="ml-4">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs text-gray-500 uppercase tracking-wide">Environnements</span>
                <button data-add-env="${id}" class="text-xs text-indigo-500 hover:text-indigo-400 transition">+ Ajouter</button>
              </div>
              <div id="env-form-${id}" class="hidden mb-2 flex gap-2">
                <input data-env-input="${id}" type="text" placeholder="ex: dev, staging, prod" class="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                <button data-save-env="${id}" class="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition">OK</button>
              </div>
              ${(p.environments || []).length === 0
                ? '<p class="text-gray-400 text-xs">Aucun environnement.</p>'
                : `<div class="flex flex-wrap gap-2">${(p.environments || []).map(env => `
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">
                    ${esc(env)}
                    <button data-delete-env="${id}:${env}" class="text-red-400 hover:text-red-600 ml-1">&times;</button>
                  </span>`).join('')}</div>`
              }
            </div>
          </div>`).join('')}</div>`
      }
    </div>`;
}

// --- Secrets Section ---
function renderSecrets() {
  const data = vault.getData();
  const projects = Object.entries(data.projects || {});
  const services = Object.entries(data.services || {});

  // Build project/env options
  let projectOptions = projects.map(([id, p]) => `<option value="${id}" ${id === selectedProject ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  let envOptions = '';
  if (selectedProject && data.projects[selectedProject]) {
    envOptions = (data.projects[selectedProject].environments || [])
      .map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');
  }

  // Get secrets for current level
  let level;
  if (secretLevelScope === 'global') {
    level = { scope: 'global' };
  } else if (secretLevelScope === 'project' && selectedProject) {
    level = { scope: 'project', projectId: selectedProject };
  } else if (secretLevelScope === 'env' && selectedProject && selectedEnv) {
    level = { scope: 'env', projectId: selectedProject, envId: selectedEnv };
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
            <option value="project" ${secretLevelScope === 'project' ? 'selected' : ''}>Projet</option>
            <option value="env" ${secretLevelScope === 'env' ? 'selected' : ''}>Environnement</option>
          </select>
        </div>
        ${secretLevelScope !== 'global' ? `
        <div>
          <label class="block text-xs text-gray-500 mb-1">Projet</label>
          <select id="secret-project" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${projectOptions}
          </select>
        </div>` : ''}
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
      </div>

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
                <span class="flex-1 font-mono ${entry.secret ? '' : ''}" data-secret-display="${serviceId}:${field}">
                  ${entry.secret ? '<span class="text-gray-400">••••••••</span>' : esc(entry.value)}
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

// --- Templates Section ---
function renderTemplates() {
  const data = vault.getData();
  const projects = Object.entries(data.projects || {});

  let templateContent = '';
  if (selectedProject && selectedEnv) {
    const tpl = vault.getTemplate(selectedProject, selectedEnv);
    const entries = Object.entries(tpl);
    templateContent = `
      <div class="mt-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold">Mapping</h3>
          <button id="btn-add-tpl-entry" class="text-xs text-indigo-500 hover:text-indigo-400 transition">+ Ajouter</button>
        </div>
        <div id="tpl-entry-form" class="hidden mb-3 flex gap-2 items-start">
          <input id="tpl-key" type="text" placeholder="ENV_VAR_NAME" class="w-48 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          ${renderValuePicker()}
          <button id="btn-save-tpl-entry" class="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition shrink-0">OK</button>
        </div>
        ${entries.length === 0
          ? '<p class="text-gray-400 text-xs">Aucune entree.</p>'
          : `<div class="space-y-1">${entries.map(([key, val]) => `
            <div class="flex items-center gap-3 text-sm py-1 font-mono">
              <span class="w-48 text-gray-300 shrink-0">${esc(key)}</span>
              <span class="flex-1 text-gray-500">${esc(val)}</span>
              <button data-delete-tpl="${key}" class="text-red-400 hover:text-red-600 transition">&times;</button>
            </div>`).join('')}</div>`
        }
      </div>`;
  }

  let projectOptions = projects.map(([id, p]) => `<option value="${id}" ${id === selectedProject ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  let envOptions = '';
  if (selectedProject && data.projects[selectedProject]) {
    envOptions = (data.projects[selectedProject].environments || [])
      .map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');
  }

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Templates .env</h2>
      <div class="flex gap-3 mb-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Projet</label>
          <select id="tpl-project" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${projectOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environnement</label>
          <select id="tpl-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${envOptions}
          </select>
        </div>
      </div>
      ${templateContent}
    </div>`;
}

// --- Generate Section ---
function renderGenerate() {
  const data = vault.getData();
  const projects = Object.entries(data.projects || {});
  let projectOptions = projects.map(([id, p]) => `<option value="${id}" ${id === selectedProject ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  let envOptions = '';
  if (selectedProject && data.projects[selectedProject]) {
    envOptions = (data.projects[selectedProject].environments || [])
      .map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');
  }

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Generer .env</h2>
      <div class="flex gap-3 mb-4 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Projet</label>
          <select id="gen-project" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${projectOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environnement</label>
          <select id="gen-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${envOptions}
          </select>
        </div>
        <button id="btn-generate" class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Generer</button>
        <button id="btn-download-env" class="hidden px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">Telecharger .env</button>
      </div>
      <div id="gen-warnings" class="hidden mb-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-400"></div>
      <pre id="gen-output" class="hidden p-4 rounded-lg bg-gray-900 text-green-400 font-mono text-sm overflow-x-auto whitespace-pre border border-gray-700"></pre>
    </div>`;
}

// --- Bind Main ---
function bindMain() {
  // Nav
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { currentSection = btn.dataset.nav; render(); };
  });

  document.getElementById('btn-theme').onclick = toggleTheme;
  document.getElementById('btn-lock').onclick = () => { vault.lock(); render(); };

  // Section-specific bindings
  switch (currentSection) {
    case 'services': bindServices(); break;
    case 'projects': bindProjects(); break;
    case 'secrets': bindSecrets(); break;
    case 'templates': bindTemplates(); break;
    case 'generate': bindGenerate(); break;
  }
}

function bindServices() {
  document.getElementById('btn-add-service').onclick = () => {
    document.getElementById('service-form').classList.toggle('hidden');
    document.getElementById('service-id').focus();
  };
  document.getElementById('btn-save-service').onclick = async () => {
    const id = document.getElementById('service-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const label = document.getElementById('service-label').value.trim();
    if (id && label) { await vault.addService(id, label); render(); }
  };
  document.querySelectorAll('[data-delete-service]').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Supprimer le service "${btn.dataset.deleteService}" ?`)) {
        await vault.deleteService(btn.dataset.deleteService);
        render();
      }
    };
  });
}

function bindProjects() {
  document.getElementById('btn-add-project').onclick = () => {
    document.getElementById('project-form').classList.toggle('hidden');
    document.getElementById('project-id').focus();
  };
  document.getElementById('btn-save-project').onclick = async () => {
    const id = document.getElementById('project-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const label = document.getElementById('project-label').value.trim();
    if (id && label) { await vault.addProject(id, label); render(); }
  };
  document.querySelectorAll('[data-delete-project]').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Supprimer le projet "${btn.dataset.deleteProject}" et tous ses environnements ?`)) {
        await vault.deleteProject(btn.dataset.deleteProject);
        render();
      }
    };
  });
  document.querySelectorAll('[data-add-env]').forEach(btn => {
    btn.onclick = () => {
      document.getElementById(`env-form-${btn.dataset.addEnv}`).classList.toggle('hidden');
      document.querySelector(`[data-env-input="${btn.dataset.addEnv}"]`).focus();
    };
  });
  document.querySelectorAll('[data-save-env]').forEach(btn => {
    btn.onclick = async () => {
      const projId = btn.dataset.saveEnv;
      const input = document.querySelector(`[data-env-input="${projId}"]`);
      const envId = input.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (envId) { await vault.addEnvironment(projId, envId); render(); }
    };
  });
  document.querySelectorAll('[data-delete-env]').forEach(btn => {
    btn.onclick = async () => {
      const [projId, envId] = btn.dataset.deleteEnv.split(':');
      if (confirm(`Supprimer l'environnement "${envId}" ?`)) {
        await vault.deleteEnvironment(projId, envId);
        render();
      }
    };
  });
}

function bindSecrets() {
  // Scope changes
  document.getElementById('secret-scope').onchange = (e) => {
    secretLevelScope = e.target.value;
    render();
  };
  document.getElementById('secret-project')?.addEventListener('change', (e) => {
    selectedProject = e.target.value || null;
    selectedEnv = null;
    render();
  });
  document.getElementById('secret-env')?.addEventListener('change', (e) => {
    selectedEnv = e.target.value || null;
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
    else if (secretLevelScope === 'project' && selectedProject) level = { scope: 'project', projectId: selectedProject };
    else if (secretLevelScope === 'env' && selectedProject && selectedEnv) level = { scope: 'env', projectId: selectedProject, envId: selectedEnv };
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
      else if (secretLevelScope === 'project') level = { scope: 'project', projectId: selectedProject };
      else level = { scope: 'env', projectId: selectedProject, envId: selectedEnv };
      await vault.deleteSecret(level, serviceId, field);
      render();
    };
  });

  // Generator
  bindGenerator();
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

function bindTemplates() {
  document.getElementById('tpl-project')?.addEventListener('change', (e) => {
    selectedProject = e.target.value || null;
    selectedEnv = null;
    render();
  });
  document.getElementById('tpl-env')?.addEventListener('change', (e) => {
    selectedEnv = e.target.value || null;
    render();
  });
  document.getElementById('btn-add-tpl-entry')?.addEventListener('click', () => {
    document.getElementById('tpl-entry-form').classList.toggle('hidden');
    document.getElementById('tpl-key').focus();
  });

  // Value picker
  const pickerBtn = document.getElementById('tpl-value-btn');
  const pickerDropdown = document.getElementById('tpl-value-dropdown');
  const pickerSearch = document.getElementById('tpl-picker-search');
  const hiddenValue = document.getElementById('tpl-value');

  if (pickerBtn) {
    pickerBtn.onclick = () => {
      pickerDropdown.classList.toggle('hidden');
      if (!pickerDropdown.classList.contains('hidden')) {
        pickerSearch.value = '';
        filterPickerList('');
        pickerSearch.focus();
      }
    };
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (pickerDropdown && !pickerDropdown.contains(e.target) && e.target !== pickerBtn) {
        pickerDropdown.classList.add('hidden');
      }
    });
    // Search filter
    pickerSearch?.addEventListener('input', (e) => filterPickerList(e.target.value));
    // Pick a reference
    document.querySelectorAll('[data-pick-ref]').forEach(btn => {
      btn.onclick = () => {
        const ref = btn.dataset.pickRef;
        const val = ref.startsWith('_') ? `\${${ref}}` : `\${${ref}}`;
        hiddenValue.value = val;
        pickerBtn.textContent = val;
        pickerBtn.classList.remove('text-gray-400');
        pickerBtn.classList.add('text-white');
        pickerDropdown.classList.add('hidden');
      };
    });
    // Free value
    document.getElementById('tpl-free-value-ok')?.addEventListener('click', () => {
      const val = document.getElementById('tpl-free-value').value.trim();
      if (val) {
        hiddenValue.value = val;
        pickerBtn.textContent = val;
        pickerBtn.classList.remove('text-gray-400');
        pickerBtn.classList.add('text-white');
        pickerDropdown.classList.add('hidden');
      }
    });
  }

  document.getElementById('btn-save-tpl-entry')?.addEventListener('click', async () => {
    const key = document.getElementById('tpl-key').value.trim();
    const value = document.getElementById('tpl-value').value.trim();
    if (key && value && selectedProject && selectedEnv) {
      await vault.setTemplateEntry(selectedProject, selectedEnv, key, value);
      render();
    }
  });
  document.querySelectorAll('[data-delete-tpl]').forEach(btn => {
    btn.onclick = async () => {
      if (selectedProject && selectedEnv) {
        await vault.deleteTemplateEntry(selectedProject, selectedEnv, btn.dataset.deleteTpl);
        render();
      }
    };
  });
}

function bindGenerate() {
  document.getElementById('gen-project')?.addEventListener('change', (e) => {
    selectedProject = e.target.value || null;
    selectedEnv = null;
    render();
  });
  document.getElementById('gen-env')?.addEventListener('change', (e) => {
    selectedEnv = e.target.value || null;
    render();
  });
  document.getElementById('btn-generate').onclick = () => {
    if (!selectedProject || !selectedEnv) return;
    const data = vault.getData();
    const { output, warnings } = generateEnv(data, selectedProject, selectedEnv);
    const outputEl = document.getElementById('gen-output');
    const warningsEl = document.getElementById('gen-warnings');
    const downloadBtn = document.getElementById('btn-download-env');

    outputEl.textContent = output || '# Fichier vide — verifiez le template et les secrets';
    outputEl.classList.remove('hidden');

    if (warnings.length > 0) {
      warningsEl.innerHTML = warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join('');
      warningsEl.classList.remove('hidden');
    } else {
      warningsEl.classList.add('hidden');
    }

    downloadBtn.classList.remove('hidden');
    downloadBtn.onclick = () => {
      const blob = new Blob([output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `.env.${selectedEnv}`;
      a.click();
      URL.revokeObjectURL(url);
    };
  };
}

// --- Template Value Picker ---
function buildServiceFieldTree() {
  const data = vault.getData();
  const services = data.services || {};
  const allSecrets = data.secrets || {};
  // Collect all known fields per service across all levels
  const fieldsByService = {};
  const collectFields = (obj) => {
    for (const [serviceId, fields] of Object.entries(obj || {})) {
      if (serviceId === '_project') {
        collectFields(fields);
        return;
      }
      if (typeof fields !== 'object') continue;
      if (!fieldsByService[serviceId]) fieldsByService[serviceId] = new Set();
      for (const f of Object.keys(fields)) {
        fieldsByService[serviceId].add(f);
      }
    }
  };
  collectFields(allSecrets.global);
  for (const projId of Object.keys(allSecrets.projects || {})) {
    const proj = allSecrets.projects[projId];
    collectFields(proj._project ? { _project: proj._project } : {});
    for (const envId of Object.keys(proj)) {
      if (envId !== '_project') collectFields({ [envId]: proj[envId] });
    }
  }
  // Also include services with no fields yet
  for (const sId of Object.keys(services)) {
    if (!fieldsByService[sId]) fieldsByService[sId] = new Set();
  }
  return { services, fieldsByService };
}

function renderValuePicker() {
  const { services, fieldsByService } = buildServiceFieldTree();
  const serviceEntries = Object.entries(fieldsByService);
  return `
    <div class="relative w-72">
      <button id="tpl-value-btn" type="button" class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-left text-gray-400 truncate focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        Choisir une valeur...
      </button>
      <div id="tpl-value-dropdown" class="hidden absolute z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div class="p-2 border-b border-gray-200 dark:border-gray-700">
          <input id="tpl-picker-search" type="text" placeholder="Rechercher..." class="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div id="tpl-picker-list" class="p-1">
          ${serviceEntries.map(([serviceId, fields]) => `
            <div class="tpl-picker-group" data-service="${serviceId}">
              <div class="px-2 py-1 text-xs font-semibold text-indigo-400 uppercase tracking-wide">${esc(services[serviceId]?.label || serviceId)}</div>
              ${[...fields].map(f => `
                <button data-pick-ref="${serviceId}.${f}" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">
                  \${${serviceId}.${f}}
                </button>
              `).join('')}
              ${fields.size === 0 ? '<div class="px-3 py-1 text-xs text-gray-500 italic">Aucun champ defini</div>' : ''}
            </div>
          `).join('')}
          <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <div class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Variables magiques</div>
            <button data-pick-ref="_ENV_NAME" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">\${_ENV_NAME}</button>
            <button data-pick-ref="_PROJECT_NAME" class="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition font-mono">\${_PROJECT_NAME}</button>
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 p-2">
            <div class="px-0 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valeur libre</div>
            <div class="flex gap-1">
              <input id="tpl-free-value" type="text" placeholder="Saisir une valeur..." class="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              <button id="tpl-free-value-ok" class="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition">OK</button>
            </div>
          </div>
        </div>
      </div>
      <input id="tpl-value" type="hidden" />
    </div>`;
}

function filterPickerList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('[data-pick-ref]').forEach(btn => {
    const match = btn.dataset.pickRef.toLowerCase().includes(q);
    btn.classList.toggle('hidden', !match);
  });
  document.querySelectorAll('.tpl-picker-group').forEach(group => {
    const visibleChildren = group.querySelectorAll('[data-pick-ref]:not(.hidden)');
    group.classList.toggle('hidden', visibleChildren.length === 0);
  });
}

// --- Helpers ---
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Init ---
initTheme();
render();
