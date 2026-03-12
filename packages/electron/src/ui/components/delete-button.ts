// delete-button.ts — unified delete button component

import { esc } from '../helpers';
import { renderButton } from './button';

export function renderDeleteButton(dataAttr: string, value: string): string {
  return renderButton('&times;', {
    variant: 'icon',
    attrs: `${dataAttr}="${esc(value)}"`,
    cls: 'text-red-400 hover:bg-red-500/10 hover:text-red-500',
    title: 'Delete',
  });
}

export function bindDeleteButtons(selector: string, handler: (btn: HTMLElement) => Promise<void> | void): void {
  document.querySelectorAll(selector).forEach(btn => {
    let confirming = false;
    const originalHtml = (btn as HTMLElement).innerHTML;

    const reset = () => {
      confirming = false;
      (btn as HTMLElement).innerHTML = originalHtml;
    };

    (btn as HTMLElement).onclick = async (e) => {
      e.stopPropagation();
      if (!confirming) {
        confirming = true;
        (btn as HTMLElement).innerHTML = '<span class="text-xs">Confirm?</span>';
        const outsideClick = (ev: Event) => {
          if (!btn.contains(ev.target as Node)) {
            reset();
            document.removeEventListener('click', outsideClick, true);
          }
        };
        document.addEventListener('click', outsideClick, true);
        return;
      }
      await handler(btn as HTMLElement);
    };
  });
}
