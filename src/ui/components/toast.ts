// toast.ts — lightweight toast notification system

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-16 right-4 pt-4 z-[100] flex flex-col gap-2 pointer-events-none';
  document.body.appendChild(container);
  return container;
}

const styles: Record<string, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white',
};

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 2500): void {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `pointer-events-auto px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 opacity-0 -translate-y-2 ${styles[type] || styles.info}`;
  el.textContent = message;
  c.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.remove('opacity-0', '-translate-y-2');
  });

  setTimeout(() => {
    el.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => el.remove(), 300);
  }, duration);
}
