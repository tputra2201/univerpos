import type { CartLine, StoreSettings } from "./types";

export interface Totals {
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
}

export function lineTotal(line: CartLine): number {
  return Math.max(0, line.unitPrice * line.qty - line.discount);
}

export function computeTotals(
  allLines: CartLine[],
  settings: StoreSettings,
  billDiscount: number,
): Totals {
  const lines = allLines.filter((l) => !l.voided);
  const gross = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const itemDiscount = lines.reduce((sum, l) => sum + l.discount, 0);
  const discount = Math.min(gross, itemDiscount + Math.max(0, billDiscount));
  const subtotal = gross;
  const base = gross - discount;
  const service = settings.serviceEnabled ? Math.round((base * settings.servicePercent) / 100) : 0;
  const tax = settings.taxEnabled ? Math.round(((base + service) * settings.taxPercent) / 100) : 0;
  return { subtotal, discount, service, tax, total: base + service + tax };
}
