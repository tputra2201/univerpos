import type { StoreSettings, UserRole } from "./types";

export type PermKey =
  | "pos.access"
  | "order.void"
  | "product.manage"
  | "transaction.view"
  | "transaction.void"
  | "report.view"
  | "report.commission"
  | "shift.manage"
  | "eod.close"
  | "finance.manage"
  | "finance.view"
  | "member.manage"
  | "stock.view"
  | "stock.in"
  | "stock.adjust"
  | "stock.manage"
  | "data.reset"
  | "settings.manage"
  | "users.manage";

export const PERM_GROUPS: { title: string; items: { key: PermKey; label: string }[] }[] = [
  {
    title: "Kasir",
    items: [
      { key: "pos.access", label: "Membuka halaman kasir" },
      { key: "order.void", label: "Otorisasi void pesanan (PIN)" },
      { key: "shift.manage", label: "Check-in & close out kasir" },
      { key: "eod.close", label: "Tutup hari usaha (End of Day)" },
    ],
  },
  {
    title: "Produk",
    items: [{ key: "product.manage", label: "Kelola produk, kategori & modifier" }],
  },
  {
    title: "Transaksi & Laporan",
    items: [
      { key: "transaction.view", label: "Melihat riwayat transaksi" },
      { key: "transaction.void", label: "Void / refund transaksi lunas" },
      { key: "report.view", label: "Melihat laporan" },
      { key: "report.commission", label: "Melihat laporan komisi staf" },
    ],
  },
  {
    title: "Stok",
    items: [
      { key: "stock.view", label: "Melihat stok & riwayat mutasi" },
      { key: "stock.in", label: "Mencatat barang masuk" },
      { key: "stock.adjust", label: "Stok opname / penyesuaian" },
      { key: "stock.manage", label: "Tambah, ubah & hapus data bahan" },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "finance.manage", label: "Mencatat income, expense, paid-in & paid-out" },
      { key: "finance.view", label: "Melihat laporan Finance" },
    ],
  },
  {
    title: "Member",
    items: [{ key: "member.manage", label: "Kelola member & poin loyalitas" }],
  },

  {
    title: "Pengaturan",
    items: [
      { key: "settings.manage", label: "Membuka pengaturan store" },
      { key: "users.manage", label: "Kelola pengguna & hak akses" },
      { key: "data.reset", label: "Reset transaksi & reset sistem" },
    ],
  },
];


export const ALL_PERMS: PermKey[] = PERM_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export type LimitedRole = Exclude<UserRole, "owner">;
export const LIMITED_ROLES: LimitedRole[] = ["manager", "supervisor", "cashier"];

export const DEFAULT_PERMS: Record<LimitedRole, PermKey[]> = {
  manager: [...ALL_PERMS],
  supervisor: [
    "pos.access",
    "order.void",
    "transaction.view",
    "transaction.void",
    "report.view",
    "shift.manage",
    "finance.manage",
    "finance.view",
    "member.manage",
  ],
  cashier: ["pos.access", "transaction.view", "shift.manage", "finance.manage", "member.manage"],

};

export function permsFor(settings: StoreSettings, role: LimitedRole): PermKey[] {
  return (settings.rolePermissions?.[role] as PermKey[] | undefined) ?? DEFAULT_PERMS[role];
}

/** Pemilik selalu punya akses penuh. */
export function hasPerm(settings: StoreSettings, role: UserRole | undefined, key: PermKey): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return permsFor(settings, role).includes(key);
}
