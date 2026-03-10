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
    let confirming = false;
    const originalHtml = btn.innerHTML;

    const reset = () => {
      confirming = false;
      btn.innerHTML = originalHtml;
    };

    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirming) {
        confirming = true;
        btn.innerHTML = '<span class="text-xs">Confirm?</span>';
        const outsideClick = (ev) => {
          if (!btn.contains(ev.target)) {
            reset();
            document.removeEventListener('click', outsideClick, true);
          }
        };
        document.addEventListener('click', outsideClick, true);
        return;
      }
      await handler(btn);
    };
  });
}
