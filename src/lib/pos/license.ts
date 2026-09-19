/**
 * Kode aktivasi toko. Di versi offline, kode diperiksa di perangkat:
 * format WO-XXXX-NNN, dengan NNN = digit pemeriksa dari bagian tengah.
 * Beberapa kode bawaan disediakan agar toko bisa langsung dipakai.
 */
const BUILTIN_CODES = ["WO-UKM-2026", "WO-KULINER-01", "WO-RETAIL-01", "WO-JASA-01"];

function checksum(text: string): number {
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum = (sum * 31 + text.charCodeAt(i)) % 997;
  return sum;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidStoreCode(input: string): boolean {
  const code = normalizeCode(input);
  if (BUILTIN_CODES.includes(code)) return true;
  const parts = code.split("-");
  if (parts.length !== 3) return false;
  if (parts[0] !== "WO") return false;
  const digits = parts[2];
  if (!/^\d{3}$/.test(digits)) return false;
  return checksum(parts[1]) % 1000 === Number(digits);
}

export function generateStoreCode(name: string): string {
  const base =
    normalizeCode(name)
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "STORE";
  const digits = String(checksum(base) % 1000).padStart(3, "0");
  return `WO-${base}-${digits}`;
}
