// inline-edit.js — inline form for create/edit with row-based layout

import { esc, INPUT_CLS } from '../helpers.js';
import { renderButton } from './button.js';

/**
 * Renders an inline form inside a container.
 * @param {HTMLElement} container
 * @param {object} options
 * @param {Array<Array<{name, value?, placeholder?, type?, readonly?, cls?, html?}>>} options.rows
 *   Each row is an array of field objects. Fields are laid out horizontally within a row.
 *   Use { html: '...' } for custom HTML snippets (checkboxes, buttons, etc.)
 * @param {function} options.onSave - async (values: Record<string, string>) =>
 * @param {function} options.onCancel
 * @param {function} [options.onInput] - (name, value, getValues) =>
 * @param {function} [options.onReady] - (container) => called after DOM is built, for extra bindings
 */
export function startInlineEdit(container, { rows, onSave, onCancel, onInput, onReady }) {
  const lastRowIdx = rows.length - 1;

  container.innerHTML = `
    <div class="flex-1 space-y-1">
      ${rows.map((row, rowIdx) => `
        <div class="flex gap-2 items-center">
          ${row.map(f => {
            if (f.html) return f.html;
            return `<input type="${f.type || 'text'}" name="${esc(f.name)}" value="${esc(f.value || '')}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.readonly ? 'readonly tabindex="-1"' : ''} class="${INPUT_CLS} ${f.cls || 'flex-1'} ${f.readonly ? 'opacity-50 cursor-default' : ''}" />`;
          }).join('')}
          ${rowIdx === lastRowIdx ? `
            ${renderButton('OK', { variant: 'success', cls: '!px-2 !py-1 !text-xs shrink-0', attrs: 'data-inline-save' })}
            ${renderButton('Annuler', { variant: 'secondary', cls: '!px-2 !py-1 !text-xs shrink-0', attrs: 'data-inline-cancel' })}
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  const inputs = container.querySelectorAll('input:not([readonly])');
  if (inputs.length) { inputs[0].focus(); inputs[0].select(); }

  const getValues = () => {
    const values = {};
    container.querySelectorAll('input[name]').forEach(input => {
      if (input.type === 'checkbox') {
        values[input.name] = input.checked;
      } else {
        values[input.name] = input.value.trim();
      }
    });
    return values;
  };

  const save = async () => { await onSave(getValues()); };

  container.querySelector('[data-inline-save]').onclick = (e) => { e.stopPropagation(); save(); };
  container.querySelector('[data-inline-cancel]').onclick = (e) => { e.stopPropagation(); onCancel(); };
  container.querySelectorAll('input[name]').forEach(input => {
    input.onclick = (e) => e.stopPropagation();
    if (!input.readOnly) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') onCancel();
      };
      if (onInput) {
        input.addEventListener('input', () => onInput(input.name, input.value, getValues));
      }
    }
  });

  if (onReady) onReady(container);
}

/**
 * Creates an empty editable row at the top of a container for "create" mode.
 */
export function insertNewRow(listContainer) {
  const row = document.createElement('div');
  row.className = 'group flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-indigo-500/50 transition';
  listContainer.prepend(row);
  return row;
}
