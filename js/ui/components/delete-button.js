// delete-button.js — unified delete button component

import { esc } from '../helpers.js';
import { renderButton } from './button.js';

export function renderDeleteButton(dataAttr, value) {
  return renderButton('&times;', {
    variant: 'icon',
    attrs: `${dataAttr}="${esc(value)}"`,
    cls: 'text-red-400 hover:bg-red-500/10 hover:text-red-500',
    title: 'Delete',
  });
}

export function bindDeleteButtons(selector, handler) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await handler(btn);
    };
  });
}
