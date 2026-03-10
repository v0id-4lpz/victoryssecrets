// button.js — unified button component

import { esc } from '../helpers.js';

const base = 'transition focus:outline-none';

const variants = {
  primary:   `${base} px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700`,
  success:   `${base} px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700`,
  secondary: `${base} px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700`,
  ghost:     `${base} text-xs text-indigo-500 hover:text-indigo-400`,
  danger:    `${base} text-xs text-red-400 hover:text-red-600`,
  icon:      `${base} rounded px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-500/10 hover:text-gray-700 dark:hover:text-gray-200 pointer-events-auto`,
};

/**
 * Renders a button with a consistent style.
 * @param {string} label - Button text/HTML content
 * @param {object} [opts]
 * @param {string} [opts.variant='primary'] - primary | success | secondary | ghost | danger | icon
 * @param {string} [opts.id] - Element id
 * @param {string} [opts.attrs] - Extra attributes string (e.g. 'data-foo="bar"')
 * @param {string} [opts.cls] - Extra classes to append
 * @param {string} [opts.title] - Tooltip
 * @param {string} [opts.type] - Button type attribute
 */
export function renderButton(label, opts = {}) {
  const { variant = 'primary', id, attrs = '', cls = '', title, type } = opts;
  const classes = `${variants[variant] || variants.primary} ${cls}`.trim();
  const idAttr = id ? `id="${id}"` : '';
  const titleAttr = title ? `title="${esc(title)}"` : '';
  const typeAttr = type ? `type="${type}"` : '';
  return `<button ${idAttr} ${typeAttr} class="${classes}" ${titleAttr} ${attrs}>${label}</button>`;
}
