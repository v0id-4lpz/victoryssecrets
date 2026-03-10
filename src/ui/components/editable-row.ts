// editable-row.ts — clickable row wrapper with hover state

import { esc } from '../helpers';

export function renderEditableRow(dataAttr: string, id: string, content: string, actions: string): string {
  return `
    <div class="group flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-indigo-500/50 transition" ${dataAttr}="${esc(id)}">
      <div class="pointer-events-none flex-1">${content}</div>
      ${actions}
    </div>`;
}

export function bindEditableRows(selector: string, handler: (row: HTMLElement) => void, excludeSelectors: string[] = []): void {
  document.querySelectorAll(selector).forEach(row => {
    (row as HTMLElement).onclick = (e) => {
      for (const sel of excludeSelectors) {
        if ((e.target as HTMLElement).closest(sel)) return;
      }
      handler(row as HTMLElement);
    };
  });
}
