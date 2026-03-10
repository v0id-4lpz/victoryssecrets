// generate.js — generate .env section

import * as vault from '../vault.js';
import { generateEnv } from '../services/env-generator.js';
import { esc, selectedEnv, setSelectedEnv } from './helpers.js';
import { renderButton } from './components/button.js';
import { renderEnvPills, bindEnvPills } from './components/env-pills.js';

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
      <pre id="gen-output" class="hidden p-4 rounded-lg bg-gray-900 font-mono text-sm overflow-x-auto whitespace-pre border border-gray-700"></pre>
    </div>`;
}

export function bindGenerate(render) {
  bindEnvPills((envId) => {
    setSelectedEnv(envId);
    render();
  }, 'gen-env-pills');
  const genBtn = document.getElementById('btn-generate');
  if (!genBtn) return;
  genBtn.onclick = () => {
    if (!selectedEnv) return;
    const data = vault.getData();
    const { output } = generateEnv(data, selectedEnv);
    const outputEl = document.getElementById('gen-output');
    const downloadBtn = document.getElementById('btn-download-env');

    if (!output) {
      outputEl.innerHTML = '<span class="text-gray-500"># Empty file — check your template and secrets</span>';
    } else {
      outputEl.innerHTML = output.split('\n').map(line => {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(=)(.*)/);
        if (m) return `<span class="text-indigo-400">${esc(m[1])}</span><span class="text-gray-500">=</span><span class="text-green-400">${esc(m[3])}</span>`;
        return esc(line);
      }).join('\n');
    }
    outputEl.classList.remove('hidden');

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
