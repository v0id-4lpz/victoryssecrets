// helpers.ts — shared state and utility functions

// --- Shared State ---
export let currentSection = 'services';
export let selectedEnv: string | null = null;
export let updateInfo: { version: string; url: string } | null = null;

export function setCurrentSection(v: string): void { currentSection = v; }
export function setSelectedEnv(v: string | null): void { selectedEnv = v; }
export function setUpdateInfo(v: { version: string; url: string } | null): void { updateInfo = v; }

// --- HTML escape ---
export function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Shared CSS classes ---
export const INPUT_CLS = 'px-3 py-1 rounded-lg border border-indigo-500 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none';

// --- Path formatting ---
export function fileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop()!;
}

export function dirName(filePath: string): string {
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

export function shortenPath(filePath: string | null): string {
  if (!filePath) return '';
  try {
    if (filePath.startsWith('/Users/')) {
      return '~/' + filePath.split('/').slice(3).join('/');
    }
  } catch {}
  return filePath;
}
