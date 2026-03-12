// password-strength.ts — password strength meter

export const MIN_PASSWORD_LENGTH = 8;

interface StrengthResult {
  level: number;
  label: string;
  color: string;
}

export function passwordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 20) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 0, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { level: 1, label: 'Fair', color: 'bg-yellow-500' };
  if (score <= 5) return { level: 2, label: 'Strong', color: 'bg-green-500' };
  return { level: 3, label: 'Very strong', color: 'bg-emerald-500' };
}

export function renderStrengthBar(idPrefix = 'strength'): string {
  return `
    <div id="${idPrefix}-container" class="space-y-1">
      <div class="flex gap-1 h-1">
        <div id="${idPrefix}-bar-0" class="flex-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div id="${idPrefix}-bar-1" class="flex-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div id="${idPrefix}-bar-2" class="flex-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div id="${idPrefix}-bar-3" class="flex-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      </div>
      <p id="${idPrefix}-label" class="text-xs text-gray-400"></p>
    </div>`;
}

export function updateStrengthBar(password: string, idPrefix = 'strength'): void {
  const { level, label, color } = passwordStrength(password);
  const inactive = 'bg-gray-200 dark:bg-gray-700';
  for (let i = 0; i < 4; i++) {
    const bar = document.getElementById(`${idPrefix}-bar-${i}`);
    if (bar) bar.className = `flex-1 rounded-full transition-colors ${i <= level ? color : inactive}`;
  }
  const labelEl = document.getElementById(`${idPrefix}-label`);
  if (labelEl) labelEl.textContent = password ? label : '';
}
