// confirm-dialog.js — modal dialog with custom buttons

/**
 * Show a modal dialog with custom choices.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {Array<{label: string, value: string, variant?: string}>} opts.buttons
 * @returns {Promise<string|null>} the chosen button's value, or null if dismissed
 */
export function showConfirmDialog({ title, message, buttons }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/50';

    const variantClasses = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      secondary: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700',
    };

    const buttonsHtml = buttons.map(b => {
      const cls = variantClasses[b.variant || 'secondary'] || variantClasses.secondary;
      return `<button data-dialog-value="${b.value}" class="px-4 py-2 text-sm rounded-lg transition focus:outline-none ${cls}">${b.label}</button>`;
    }).join('');

    backdrop.innerHTML = `
      <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
        <h3 class="text-base font-semibold mb-2">${title}</h3>
        ${message ? `<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${message}</p>` : ''}
        <div class="flex justify-end gap-2">${buttonsHtml}</div>
      </div>`;

    const cleanup = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(null);
      const btn = e.target.closest('[data-dialog-value]');
      if (btn) cleanup(btn.dataset.dialogValue);
    });

    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cleanup(null);
    });

    document.body.appendChild(backdrop);
    backdrop.querySelector('button')?.focus();
  });
}
