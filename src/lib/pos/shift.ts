/** Hitungan kas untuk prosedur check-in dan close out kasir. */
import type { PosDatabase, Sale, Shift } from "./types";

export interface ShiftSummary {
  count: number;
  omzet: number;
  cashSales: number;
  nonCashSales: number;
  expected: number;
}

export function salesOfShift(db: PosDatabase, shift: Shift): Sale[] {
  const end = shift.closedAt ?? new Date(8640000000000000).toISOString();
  return db.sales.filter(
    (s) => s.status === "paid" && s.createdAt >= shift.openedAt && s.createdAt <= end,
  );
}

export function summarize(shift: Shift, sales: Sale[]): ShiftSummary {
  let cashSales = 0;
  let nonCashSales = 0;
  let omzet = 0;
  for (const s of sales) {
    omzet += s.total;
    for (const p of s.payments) {
      if (/tunai|cash/i.test(p.methodName)) cashSales += p.amount;
      else nonCashSales += p.amount;
    }
  }
  return {
    count: sales.length,
    omzet,
    cashSales,
    nonCashSales,
    expected: shift.openingCash + cashSales,
  };
}

/** Kas yang seharusnya ada di laci saat check-in berikutnya. */
export function suggestedStartCash(shifts: Shift[]): number {
  const closed = shifts.filter((s) => s.closedAt);
  if (closed.length === 0) return 0;
  const last = closed.reduce((best, s) =>
    (s.closedAt ?? "") > (best.closedAt ?? "") ? s : best,
  );
  return last.nextStartCash ?? last.closingCash ?? 0;
}

export function activeShiftOf(db: PosDatabase): Shift | null {
  return db.shifts.find((s) => !s.closedAt) ?? null;
}

export function activeBusinessDayOf(db: PosDatabase) {
  return (db.businessDays ?? []).find((d) => !d.closedAt) ?? null;
}
