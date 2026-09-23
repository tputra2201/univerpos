import type { UserRole } from "./types";

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Pemilik",
  manager: "Manager",
  supervisor: "Supervisor",
  cashier: "Kasir",
};

export function roleLabel(role: UserRole | undefined): string {
  return role ? ROLE_LABEL[role] : "";
}

/** Boleh membuka menu pengelolaan (produk, pengaturan, dll). */
export function canManage(role: UserRole | undefined): boolean {
  return role === "owner" || role === "manager";
}

/** Boleh memberi otorisasi void pesanan yang sudah dikirim ke dapur. */
export function canAuthorizeVoid(role: UserRole | undefined): boolean {
  return role === "owner" || role === "manager" || role === "supervisor";
}

/** Kode layanan untuk nomor order. */
export function serviceCode(orderType: string): string {
  if (orderType === "Dine In") return "DI";
  if (orderType === "Take Out") return "TO";
  return "OL";
}

export function formatOrderNo(orderType: string, seq: number): string {
  return `${serviceCode(orderType)}-${String(Math.max(1, seq)).padStart(6, "0")}`;
}
