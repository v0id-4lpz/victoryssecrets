// empty-state.js — empty list placeholder

import { esc } from '../helpers.js';

/**
 * Renders an empty state message.
 * @param {string} message - Message to display
 */
export function renderEmptyState(message) {
  return `<p class="text-gray-400 text-sm">${esc(message)}</p>`;
}
