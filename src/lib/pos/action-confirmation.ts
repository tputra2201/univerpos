/** Confirm before any user-action side effect; never gate background synchronization. */
export function confirmAction(message: string): boolean {
  return window.confirm(`${message}\n\nPilih OK untuk melanjutkan atau Batal untuk mempertahankan data sebelumnya.`);
}
export function confirmedAction<T>(message: string, action: () => T): T | undefined {
  if (!confirmAction(message)) return undefined;
  return action();
}
