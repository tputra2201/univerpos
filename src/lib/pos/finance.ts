/** Finance: Other Income, Expense, Paid-In, Paid-Out. */
import type { FinanceCategory, FinanceEntry, FinanceKind, PosDatabase } from "./types";
import { dateTime, rupiah } from "./format";

export const FINANCE_KINDS: { kind: FinanceKind; label: string; hint: string; code: string }[] = [
  { kind: "income", label: "Other Income", hint: "Menambah pendapatan", code: "OI" },
  { kind: "expense", label: "Expense", hint: "Mengurangi pendapatan", code: "EX" },
  { kind: "paidin", label: "Paid-In", hint: "Uang masuk, tidak mempengaruhi pendapatan", code: "PI" },
  { kind: "paidout", label: "Paid-Out", hint: "Uang keluar, tidak mempengaruhi pendapatan", code: "PO" },
];

export function kindLabel(kind: FinanceKind): string {
  return FINANCE_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

const cat = (id: string, kind: FinanceKind, name: string, items: string[]): FinanceCategory => ({
  id,
  kind,
  name,
  items: items.map((n, i) => ({ id: `${id}_${i}`, name: n })),
});

export function defaultFinanceCategories(): FinanceCategory[] {
  return [
    cat("fc_inc_lain", "income", "Pendapatan Lain", ["Jual kardus/minyak bekas", "Komisi", "Sewa tempat"]),
    cat("fc_exp_ops", "expense", "Operasional", ["Es batu", "Gas LPG", "Air galon", "Kantong plastik"]),
    cat("fc_exp_trans", "expense", "Transportasi", ["Bensin kurir", "Parkir"]),
    cat("fc_pi_modal", "paidin", "Tambah Modal", ["Tambah kas kasir", "Tukar uang kecil"]),
    cat("fc_po_setor", "paidout", "Setoran", ["Setor ke brankas", "Setor ke pemilik"]),
  ];
}

export function financeCategoriesOf(db: PosDatabase): FinanceCategory[] {
  return db.financeCategories ?? defaultFinanceCategories();
}

/** Pengaruh terhadap laba: income +, expense −, paid-in/out 0. */
export function profitEffect(e: FinanceEntry): number {
  return e.kind === "income" ? e.amount : e.kind === "expense" ? -e.amount : 0;
}

export function buildFinanceSlip(e: FinanceEntry, db: PosDatabase): string[] {
  const w = db.printer.paperWidth;
  const line = (l: string, r: string) => {
    const space = Math.max(1, w - l.length - r.length);
    return (l + " ".repeat(space) + r).slice(0, Math.max(w, l.length + r.length + 1));
  };
  const center = (t: string) => " ".repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t;
  return [
    center(db.settings.name),
    center(kindLabel(e.kind).toUpperCase()),
    "=".repeat(w),
    line("No", e.code),
    line("Waktu", dateTime(e.createdAt)),
    line("Kasir", e.userName),
    "-".repeat(w),
    line("Kategori", e.categoryName),
    line("Item", e.itemName),
    line("Metode", e.methodName),
    ...(e.note ? [`Ket: ${e.note}`] : []),
    "-".repeat(w),
    line("NOMINAL", rupiah(e.amount)),
    "=".repeat(w),
    "",
    center("Tanda tangan"),
    "",
    "",
  ];
}
