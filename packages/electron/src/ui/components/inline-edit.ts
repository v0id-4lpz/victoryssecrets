// inline-edit.ts — inline form for create/edit with row-based layout

import { esc, INPUT_CLS, setEditing } from '../helpers';
import { renderButton } from './button';

interface InlineEditField {
  name?: string;
  value?: string;
  placeholder?: string;
  type?: string;
  readonly?: boolean;
  cls?: string;
  html?: string;
}

interface InlineEditOptions {
  rows: InlineEditField[][];
  onSave: (values: Record<string, string | boolean>) => Promise<void> | void;
  onCancel: () => void;
  onInput?: (name: string, value: string, getValues: () => Record<string, string | boolean>) => void;
  onReady?: (container: HTMLElement) => void;
  focusField?: string;
}

export function startInlineEdit(container: HTMLElement, { rows, onSave, onCancel, onInput, onReady, focusField }: InlineEditOptions): void {
  const lastRowIdx = rows.length - 1;

  container.innerHTML = `
    <div class="flex-1 space-y-1">
      ${rows.map((row, rowIdx) => `
        <div class="flex gap-2 items-center">
          ${row.map(f => {
            if (f.html) return f.html;
            return `<input type="${f.type || 'text'}" name="${esc(f.name || '')}" value="${esc(f.value || '')}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.readonly ? 'readonly tabindex="-1"' : ''} class="${INPUT_CLS} ${f.cls || 'flex-1'} ${f.readonly ? 'opacity-50 cursor-default' : ''}" />`;
          }).join('')}
          ${rowIdx === lastRowIdx ? `
            ${renderButton('OK', { variant: 'success', cls: '!px-2 !py-1 !text-xs shrink-0', attrs: 'data-inline-save' })}
            ${renderButton('Cancel', { variant: 'secondary', cls: '!px-2 !py-1 !text-xs shrink-0', attrs: 'data-inline-cancel' })}
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  const focusTarget = focusField
    ? container.querySelector(`input[name="${focusField}"]`) as HTMLInputElement | null
    : container.querySelector('input:not([readonly])') as HTMLInputElement | null;
  if (focusTarget) { focusTarget.focus(); focusTarget.select(); }

  const getValues = (): Record<string, string | boolean> => {
    const values: Record<string, string | boolean> = {};
    container.querySelectorAll('input[name]').forEach(el => {
      const input = el as HTMLInputElement;
      if (input.type === 'checkbox') {
        values[input.name] = input.checked;
      } else {
        values[input.name] = input.value.trim();
      }
    });
    return values;
  };

  setEditing(true);
  const save = async () => { setEditing(false); await onSave(getValues()); };
  const cancelEdit = () => { setEditing(false); onCancel(); };

  (container.querySelector('[data-inline-save]') as HTMLElement).onclick = (e) => { e.stopPropagation(); save(); };
  (container.querySelector('[data-inline-cancel]') as HTMLElement).onclick = (e) => { e.stopPropagation(); cancelEdit(); };
  container.querySelectorAll('input[name]').forEach(el => {
    const input = el as HTMLInputElement;
    input.onclick = (e) => e.stopPropagation();
    if (!input.readOnly) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancelEdit();
      };
      if (onInput) {
        input.addEventListener('input', () => onInput(input.name, input.value, getValues));
      }
    }
  });

  if (onReady) onReady(container);
}

export function insertNewRow(listContainer: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'group flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-indigo-500/50 transition';
  listContainer.prepend(row);
  return row;
}
