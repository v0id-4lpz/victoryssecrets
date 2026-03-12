// recents.ts — recently opened vaults (localStorage)

const STORAGE_KEY = 'vs-recent-vaults';
const MAX_RECENTS = 5;

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function save(list: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getRecents(): string[] {
  return load();
}

export function addRecent(filePath: string | null): void {
  if (!filePath) return;
  const list = load().filter(p => p !== filePath);
  list.unshift(filePath);
  save(list.slice(0, MAX_RECENTS));
}

export function removeRecent(filePath: string): void {
  save(load().filter(p => p !== filePath));
}
