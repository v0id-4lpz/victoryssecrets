// update-check.ts — pure version comparison

export function isNewerVersion(localVersion: string, remoteVersion: string): boolean {
  const local = localVersion.replace(/^v/, '').split('.').map(Number);
  const remote = remoteVersion.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((remote[i] || 0) > (local[i] || 0)) return true;
    if ((remote[i] || 0) < (local[i] || 0)) return false;
  }
  return false;
}
