// section-header.ts — section title + action buttons

import { esc } from '../helpers';
import { renderButton } from './button';

export function renderSectionHeader(title: string, actions = ''): string {
  return `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">${esc(title)}</h2>
      ${actions}
    </div>`;
}

export function renderAddButton(id: string): string {
  return renderButton('+ Add', { variant: 'primary', id });
}
