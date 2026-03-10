// editable-row.js — clickable row wrapper with hover state

import { esc } from '../helpers.js';

/**
 * Renders a clickable row with consistent styling.
 * @param {string} dataAttr - data attribute name (e.g. "data-edit-service")
 * @param {string} id - value for the data attribute
 * @param {string} content - inner HTML (children should use pointer-events-none)
 * @param {string} actions - HTML for action buttons (delete, etc.)
 */
export function renderEditableRow(dataAttr, id, content, actions) {
  return `
    <div class="group flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-indigo-500/50 transition" ${dataAttr}="${esc(id)}">
      <div class="pointer-events-none flex-1">${content}</div>
      ${actions}
    </div>`;
}

/**
 * Binds click handlers on editable rows, ignoring clicks on excluded selectors.
 * @param {string} selector - row selector (e.g. "[data-edit-service]")
 * @param {function} handler - (row) => called on row click
 * @param {string[]} [excludeSelectors] - child selectors to ignore clicks on
 */
export function bindEditableRows(selector, handler, excludeSelectors = []) {
  document.querySelectorAll(selector).forEach(row => {
    row.onclick = (e) => {
      for (const sel of excludeSelectors) {
        if (e.target.closest(sel)) return;
      }
      handler(row);
    };
  });
}
