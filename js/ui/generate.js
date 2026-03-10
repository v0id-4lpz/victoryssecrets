// generate.js — generate .env section

import * as vault from '../vault.js';
import { generateEnv } from '../services/env-generator.js';
import { esc, selectedEnv, setSelectedEnv } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderEnvPills, bindEnvPills } from './components/env-pills.js';

let viewMode = 'table'; // 'table' | 'raw'

function sourceBadge(source) {
  if (!source) return '<span class="text-xs text-red-400">unresolved</span>';
  if (source === 'static') return '<span class="text-xs text-gray-400">static</span>';
  if (source === 'auto') return '<span class="text-xs text-gray-400">auto</span>';
  if (source === 'Global') return '<span class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Global</span>';
  return `<span class="px-1.5 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">${esc(source)}</span>`;
}

function renderTable(entries) {
  if (entries.length === 0) return '<p class="text-gray-500 text-sm">Empty — check your template and secrets.</p>';
  return `
    <table class="w-full text-sm border-collapse table-fixed">
      <thead>
        <tr class="text-left text-xs text-gray-400 uppercase tracking-wide">
          <th class="pb-2 pr-4 font-medium w-2/5">Key</th>
          <th class="pb-2 pr-4 font-medium w-2/5">Value</th>
          <th class="pb-2 font-medium w-1/5">Source</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        ${entries.map(({ key, value, source }) => `
        <tr class="group">
          <td class="py-1.5 pr-4 font-mono text-indigo-400 whitespace-nowrap">${esc(key)}</td>
          <td class="py-1.5 pr-4 font-mono max-w-xs truncate">${value
            ? `<span class="text-gray-500 group-hover:hidden select-none">••••••••</span><span class="text-green-400 hidden group-hover:inline" title="${esc(value)}">${esc(value)}</span>`
            : '<span class="text-gray-500">—</span>'}</td>
          <td class="py-1.5">${sourceBadge(source)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderRaw(output) {
  if (!output) return '<span class="text-gray-500"># Empty — check your template and secrets</span>';
  return output.split('\n').map(line => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(=)(.*)/);
    if (m) return `<span class="text-indigo-400">${esc(m[1])}</span><span class="text-gray-500">=</span><span class="text-green-400">${esc(m[3])}</span>`;
    return esc(line);
  }).join('\n');
}

export function renderGenerate(render) {
  const data = vault.getData();
  const envs = Object.keys(data.environments || {});
  const tpl = vault.getTemplate();
  const hasTemplate = Object.keys(tpl).length > 0;

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">.env generate</h2>
      ${!hasTemplate ? '<p class="text-gray-400 text-sm mb-4">No template defined. Add entries in .env template first.</p>' : `
      ${renderEnvPills(envs, selectedEnv, { showGlobal: false, id: 'gen-env-pills' })}
      <div class="flex gap-3 mb-4">
        ${renderButton('Generate', { id: 'btn-generate', variant: 'primary' })}
        ${renderButton('Download .env', { id: 'btn-download-env', variant: 'success', cls: 'hidden' })}
      </div>`}
      <div id="gen-result" class="hidden">
        <div class="flex gap-2 mb-3">
          ${renderButton('Table', { id: 'btn-view-table', variant: viewMode === 'table' ? 'secondary' : 'ghost' })}
          ${renderButton('.env', { id: 'btn-view-raw', variant: viewMode === 'raw' ? 'secondary' : 'ghost' })}
        </div>
        <div id="gen-table-view"></div>
        <pre id="gen-raw-view" class="p-4 rounded-lg bg-gray-900 font-mono text-sm overflow-x-auto whitespace-pre border border-gray-700"></pre>
      </div>
    </div>`;
}

export function bindGenerate(render) {
  bindEnvPills((envId) => {
    setSelectedEnv(envId);
    render();
  }, 'gen-env-pills');
  const genBtn = document.getElementById('btn-generate');
  if (!genBtn) return;

  let lastOutput = '';
  let lastEntries = [];

  function showResult() {
    const resultEl = document.getElementById('gen-result');
    const tableView = document.getElementById('gen-table-view');
    const rawView = document.getElementById('gen-raw-view');
    const btnTable = document.getElementById('btn-view-table');
    const btnRaw = document.getElementById('btn-view-raw');

    resultEl.classList.remove('hidden');
    tableView.innerHTML = renderTable(lastEntries);
    rawView.innerHTML = renderRaw(lastOutput);

    const isTable = viewMode === 'table';
    tableView.classList.toggle('hidden', !isTable);
    rawView.classList.toggle('hidden', isTable);

    // Update toggle button styles
    btnTable.className = btnTable.className.replace(/bg-\S+|text-\S+|border\S*/g, '').trim();
    btnRaw.className = btnRaw.className.replace(/bg-\S+|text-\S+|border\S*/g, '').trim();
    // Re-apply proper classes by re-rendering would be complex, so just toggle visual
    if (isTable) {
      btnTable.classList.add('border', 'border-gray-300', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
      btnRaw.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
    } else {
      btnRaw.classList.add('border', 'border-gray-300', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
      btnTable.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
    }
  }

  genBtn.onclick = () => {
    if (!selectedEnv) return;
    const data = vault.getData();
    const { output, entries } = generateEnv(data, selectedEnv);
    lastOutput = output;
    lastEntries = entries;

    showResult();

    const downloadBtn = document.getElementById('btn-download-env');
    downloadBtn.classList.remove('hidden');
    downloadBtn.onclick = () => {
      const blob = new Blob([output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `.env.${selectedEnv}`;
      a.click();
      URL.revokeObjectURL(url);
    };
  };

  // View toggle
  document.getElementById('btn-view-table')?.addEventListener('click', () => {
    viewMode = 'table';
    if (lastEntries.length) showResult();
  });
  document.getElementById('btn-view-raw')?.addEventListener('click', () => {
    viewMode = 'raw';
    if (lastEntries.length) showResult();
  });
}
