/** Sisa hari sampai tanggal kedaluwarsa (YYYY-MM-DD). null bila tidak ada batas. */
export function daysLeft(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const [y, m, d] = expiresAt.split("-").map(Number);
  const end = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function formatExpiry(expiresAt?: string | null): string {
  if (!expiresAt) return "Tanpa batas";
  const [y, m, d] = expiresAt.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
