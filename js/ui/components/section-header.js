// section-header.js — section title + action buttons

import { esc } from '../helpers.js';
import { renderButton } from './button.js';

/**
 * Renders a section header with title and optional action buttons.
 * @param {string} title - Section title
 * @param {string} [actions] - HTML for action buttons
 */
export function renderSectionHeader(title, actions = '') {
  return `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">${esc(title)}</h2>
      ${actions}
    </div>`;
}

/**
 * Renders an "Add" button.
 * @param {string} id - Button element id
 */
export function renderAddButton(id) {
  return renderButton('+ Add', { variant: 'primary', id });
}
