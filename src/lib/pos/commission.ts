import type { CartLine, Product, Staff } from "./types";

export type CommissionRule = "staff" | "custom" | "none";

/** Aturan komisi produk. Data lama dengan nilai komisi > 0 dianggap kustom. */
export function productRule(p?: Product): CommissionRule {
  if (!p) return "staff";
  if (p.commissionRule) return p.commissionRule;
  return (p.commissionValue ?? 0) > 0 ? "custom" : "staff";
}

/** Komisi satu baris: staf nonaktif → 0; produk kustom/tanpa komisi menang; selain itu ikut skema staf. */
export function lineCommission(l: CartLine, p: Product | undefined, s: Staff | undefined): number {
  if (!s || s.commissionEnabled === false) return 0;
  const net = Math.max(0, l.unitPrice * l.qty - (l.discount || 0));
  const rule = productRule(p);
  if (rule === "none") return 0;
  const mode = rule === "custom" ? p?.commissionMode : s.commissionMode;
  const val = (rule === "custom" ? p?.commissionValue : s.commissionValue) ?? 0;
  return mode === "amount" ? Math.round(val * l.qty) : Math.round((net * val) / 100);
}
