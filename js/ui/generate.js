// generate.js — generate .env section

import * as vault from '../vault.js';
import { generateEnv } from '../template.js';
import { esc, selectedEnv, setSelectedEnv } from './helpers.js';

export function renderGenerate(render) {
  const data = vault.getData();
  const envs = data.environments || [];
  let envOptions = envs.map(e => `<option value="${e}" ${e === selectedEnv ? 'selected' : ''}>${esc(e)}</option>`).join('');

  return `
    <div class="max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">Generer .env</h2>
      <div class="flex gap-3 mb-4 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Environnement</label>
          <select id="gen-env" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">--</option>
            ${envOptions}
          </select>
        </div>
        <button id="btn-generate" class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">Generer</button>
        <button id="btn-download-env" class="hidden px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition">Telecharger .env</button>
      </div>
      <div id="gen-warnings" class="hidden mb-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-400"></div>
      <pre id="gen-output" class="hidden p-4 rounded-lg bg-gray-900 text-green-400 font-mono text-sm overflow-x-auto whitespace-pre border border-gray-700"></pre>
    </div>`;
}

export function bindGenerate(render) {
  document.getElementById('gen-env')?.addEventListener('change', (e) => {
    setSelectedEnv(e.target.value || null);
    render();
  });
  document.getElementById('btn-generate').onclick = () => {
    if (!selectedEnv) return;
    const data = vault.getData();
    const { output, warnings } = generateEnv(data, selectedEnv);
    const outputEl = document.getElementById('gen-output');
    const warningsEl = document.getElementById('gen-warnings');
    const downloadBtn = document.getElementById('btn-download-env');

    outputEl.textContent = output || '# Fichier vide — verifiez le template et les secrets';
    outputEl.classList.remove('hidden');

    if (warnings.length > 0) {
      warningsEl.innerHTML = warnings.map(w => `<div>! ${esc(w)}</div>`).join('');
      warningsEl.classList.remove('hidden');
    } else {
      warningsEl.classList.add('hidden');
    }

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
}
