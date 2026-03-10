// icon.js — centralized SVG icons

const svg = (paths, size = 'w-4 h-4') =>
  `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${paths}</svg>`;

export const icons = {
  theme: (size) => svg(
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>',
    size || 'w-5 h-5'
  ),
  refresh: (size) => svg(
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>',
    size
  ),
  eye: (size) => svg(
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>',
    size
  ),
  shield: (size) => `<svg viewBox="0 0 1024 1024" class="${size || 'w-[600px] h-[600px]'}">
    <path d="M512 100 L820 240 C820 240 850 600 512 920 C174 600 204 240 204 240 Z" fill="currentColor"/>
    <g transform="translate(512, 500)">
      <rect x="-80" y="-20" width="160" height="120" rx="20" fill="white" class="text-gray-50 dark:text-gray-950"/>
      <path d="M-48,-20 L-48,-70 A48,48 0 0,1 48,-70 L48,-20" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>
    </g>
  </svg>`,
};
