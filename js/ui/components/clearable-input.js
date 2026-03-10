// clearable-input.js — input with a clear (X) button inside

import { icons } from './icon.js';

/**
 * Enhance an input element with a clear button.
 * Wraps the input in a relative container and adds an X button on the right.
 * @param {HTMLInputElement} input
 * @param {object} [opts]
 * @param {function} [opts.onClear] - called after clearing
 * @param {function} [opts.onInput] - called on input event
 */
export function makeClearable(input, { onClear, onInput } = {}) {
  // Use the input itself as the positioning context
  input.classList.add('pr-8');
  const parent = input.parentNode;
  const wrapper = document.createElement('div');
  wrapper.className = 'relative inline-flex';

  // Transfer sizing classes from input to wrapper
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
  clearBtn.querySelector('svg').classList.add('pointer-events-none');
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
