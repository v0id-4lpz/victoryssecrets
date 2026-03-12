// clearable-input.ts — input with a clear (X) button inside

import { icons } from './icon';

interface ClearableOptions {
  onClear?: () => void;
  onInput?: (value: string) => void;
}

export function makeClearable(input: HTMLInputElement, { onClear, onInput }: ClearableOptions = {}): HTMLElement {
  input.classList.add('pr-8');
  const parent = input.parentNode!;
  const wrapper = document.createElement('div');
  wrapper.className = 'relative inline-flex';

  for (const cls of [...input.classList]) {
    if (cls.startsWith('flex-') || cls.startsWith('w-')) {
      input.classList.remove(cls);
      wrapper.classList.add(cls);
    }
  }
  input.classList.add('w-full');

  parent.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full hidden';
  clearBtn.innerHTML = icons.clear('w-3.5 h-3.5');
  clearBtn.querySelector('svg')!.classList.add('pointer-events-none');
  wrapper.appendChild(clearBtn);

  const update = () => { clearBtn.classList.toggle('hidden', !input.value); };

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = '';
    update();
    input.focus();
    if (onClear) onClear();
  });

  input.addEventListener('input', () => {
    update();
    if (onInput) onInput(input.value);
  });

  update();
  return wrapper;
}
