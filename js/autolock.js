// autolock.js — auto-lock vault after inactivity

let autolockMinutes = 10;
let timer = null;
let onLockCallback = null;

function resetTimer() {
  if (timer) clearTimeout(timer);
  if (onLockCallback) {
    timer = setTimeout(() => {
      onLockCallback();
    }, autolockMinutes * 60 * 1000);
  }
}

export function setAutolockMinutes(minutes) {
  autolockMinutes = minutes;
  if (onLockCallback) resetTimer();
}

export function startAutoLock(onLock) {
  onLockCallback = onLock;
  const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
  events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
  resetTimer();
}

export function stopAutoLock() {
  if (timer) { clearTimeout(timer); timer = null; }
  onLockCallback = null;
}
