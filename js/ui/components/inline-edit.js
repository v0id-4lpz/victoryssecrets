// inline-edit.js — replaces a row with an inline input for editing

import { esc } from '../helpers.js';
import { renderButton } from './button.js';

/**
 * Turns a row element into an inline edit form.
 * @param {HTMLElement} row - The row element to transform
 * @param {object} options
 * @param {string} options.value - Current value to edit
 * @param {string} [options.label] - Optional fixed label shown before the input
 * @param {function} options.onSave - async (newValue) => called on Enter/OK
 * @param {function} options.onCancel - called on Escape
 */
export function startInlineEdit(row, { value, label, onSave, onCancel }) {
  row.innerHTML = `
    ${label ? `<span class="w-40 text-gray-500 shrink-0">${esc(label)}</span>` : ''}
    <input type="text" value="${esc(value)}" class="flex-1 px-3 py-1 rounded-lg border border-indigo-500 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
    ${renderButton('OK', { variant: 'success', cls: 'ml-2 shrink-0 !px-2 !py-1 !text-xs' })}
  `;
  const input = row.querySelector('input');
  input.focus();
  input.select();

  const save = async () => {
    const newValue = input.value.trim();
    await onSave(newValue);
  };

  row.querySelector('button').onclick = (e) => { e.stopPropagation(); save(); };
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') onCancel();
  };
}
