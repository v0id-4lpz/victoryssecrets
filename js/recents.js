// recents.js — recently opened vaults (localStorage)

const STORAGE_KEY = 'vs-recent-vaults';
const MAX_RECENTS = 5;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getRecents() {
  return load();
}

export function addRecent(filePath) {
  if (!filePath) return;
  const list = load().filter(p => p !== filePath);
  list.unshift(filePath);
  save(list.slice(0, MAX_RECENTS));
}

export function removeRecent(filePath) {
  save(load().filter(p => p !== filePath));
}
