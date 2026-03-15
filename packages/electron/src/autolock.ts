// autolock.ts — auto-lock vault after inactivity

let autolockMinutes = 10;
let timer: ReturnType<typeof setTimeout> | null = null;
let onLockCallback: (() => void) | null = null;
let listenersAttached = false;

const ACTIVITY_EVENTS: string[] = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];

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
  if (!listenersAttached) {
    ACTIVITY_EVENTS.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    listenersAttached = true;
  }
  resetTimer();
}

export function stopAutoLock(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (listenersAttached) {
    ACTIVITY_EVENTS.forEach(e => document.removeEventListener(e, resetTimer));
    listenersAttached = false;
  }
  onLockCallback = null;
}
