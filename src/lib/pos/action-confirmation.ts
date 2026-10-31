/** Confirm before any user-action side effect; never gate background synchronization. */
export function confirmAction(message: string): boolean {
  return window.confirm(`${message}\n\nPilih OK untuk melanjutkan atau Batal untuk mempertahankan data sebelumnya.`);
}
let confirmationDepth = 0;
export function confirmedAction<T>(message: string, action: () => T): T | undefined {
  if (confirmationDepth === 0 && !confirmAction(message)) return undefined;
  confirmationDepth += 1;
  try { return action(); } finally { confirmationDepth -= 1; }
}
