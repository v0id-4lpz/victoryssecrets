// helpers.js — shared state and utility functions

// --- Shared State ---
export let currentSection = 'services';
export let selectedEnv = null;
export let secretLevelScope = 'global';

export function setCurrentSection(v) { currentSection = v; }
export function setSelectedEnv(v) { selectedEnv = v; }
export function setSecretLevelScope(v) { secretLevelScope = v; }

// --- HTML escape ---
export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
