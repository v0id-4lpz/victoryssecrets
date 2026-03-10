// theme.ts — dark/light mode management

export function initTheme(): void {
  const saved = localStorage.getItem('vs-theme');
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}

export function toggleTheme(): void {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('vs-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
