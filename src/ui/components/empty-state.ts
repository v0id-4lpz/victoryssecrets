// empty-state.ts — empty list placeholder

import { esc } from '../helpers';

export function renderEmptyState(message: string): string {
  return `<p class="text-gray-400 text-sm">${esc(message)}</p>`;
}
