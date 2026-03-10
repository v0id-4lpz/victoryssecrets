// helpers.js — shared state and utility functions

// --- Shared State ---
export let currentSection = 'services';
export let selectedEnv = null;
export let secretLevelScope = 'global';
export let updateInfo = null;

export function setCurrentSection(v) { currentSection = v; }
export function setSelectedEnv(v) { selectedEnv = v; }
export function setSecretLevelScope(v) { secretLevelScope = v; }
export function setUpdateInfo(v) { updateInfo = v; }

// --- HTML escape ---
export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Shared CSS classes ---
export const INPUT_CLS = 'px-3 py-1 rounded-lg border border-indigo-500 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';

// --- Shared UI helpers ---
export function renderEnvOptions(envs, selected) {
  return envs.map(e => `<option value="${e}" ${e === selected ? 'selected' : ''}>${esc(e)}</option>`).join('');
}

// --- Path formatting ---
export function fileName(filePath) {
  return filePath.split(/[/\\]/).pop();
}

export function dirName(filePath) {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  let dir = parts.join('/');
  try {
    if (dir.startsWith('/Users/')) {
      dir = '~/' + dir.split('/').slice(3).join('/');
    }
  } catch {}
  return dir;
}

export function shortenPath(filePath) {
  if (!filePath) return '';
  try {
    if (filePath.startsWith('/Users/')) {
      return '~/' + filePath.split('/').slice(3).join('/');
    }
  } catch {}
  return filePath;
}
