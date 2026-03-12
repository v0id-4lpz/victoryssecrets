// autolock.ts — auto-lock vault after inactivity

let autolockMinutes = 10;
let timer: ReturnType<typeof setTimeout> | null = null;
let onLockCallback: (() => void) | null = null;

function resetTimer(): void {
  if (timer) clearTimeout(timer);
  if (onLockCallback) {
    timer = setTimeout(() => {
      onLockCallback!();
    }, autolockMinutes * 60 * 1000);
  }
}

export function setAutolockMinutes(minutes: number): void {
  autolockMinutes = minutes;
  if (onLockCallback) resetTimer();
}

export function startAutoLock(onLock: () => void): void {
  onLockCallback = onLock;
  const events: string[] = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
  events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
  resetTimer();
}

export function stopAutoLock(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  onLockCallback = null;
}
