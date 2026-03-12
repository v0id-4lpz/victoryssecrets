// button.ts — unified button component

import { esc } from '../helpers';

const base = 'cursor-pointer transition focus:outline-none no-drag';

const variants: Record<string, string> = {
  primary:   `${base} px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700`,
  success:   `${base} px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700`,
  secondary: `${base} px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700`,
  outline:   `${base} px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`,
  ghost:     `${base} px-3 py-2 text-sm rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`,
  link:      `${base} text-xs text-indigo-500 hover:text-indigo-400`,
  danger:    `${base} text-xs text-red-400 hover:text-red-600`,
  icon:      `${base} rounded px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-500/10 hover:text-gray-700 dark:hover:text-gray-200 pointer-events-auto`,
};

const spinner = `<svg class="animate-spin h-4 w-4 inline-block" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`;

export function setButtonLoading(btn: HTMLButtonElement, loading: boolean, label?: string): void {
  btn.disabled = loading;
  btn.innerHTML = loading ? spinner : (label || btn.innerHTML);
  btn.classList.toggle('opacity-60', loading);
  btn.classList.toggle('pointer-events-none', loading);
}

export interface ButtonOptions {
  variant?: string;
  id?: string;
  attrs?: string;
  cls?: string;
  title?: string;
  type?: string;
}

export function renderButton(label: string, opts: ButtonOptions = {}): string {
  const { variant = 'primary', id, attrs = '', cls = '', title, type } = opts;
  const classes = `${variants[variant] || variants.primary} ${cls}`.trim();
  const idAttr = id ? `id="${id}"` : '';
  const titleAttr = title ? `title="${esc(title)}"` : '';
  const typeAttr = type ? `type="${type}"` : '';
  return `<button ${idAttr} ${typeAttr} class="${classes}" ${titleAttr} ${attrs}>${label}</button>`;
}
