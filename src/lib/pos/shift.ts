/** Hitungan kas untuk prosedur check-in dan close out kasir. */
import type { FinanceEntry, PosDatabase, Sale, Shift } from "./types";

export interface ShiftSummary {
  count: number;
  omzet: number;
  cashSales: number;
  nonCashSales: number;
  expected: number;
  /** Mutasi kas tunai dari Finance (income − expense + paid-in − paid-out). */
  financeCash: number;
}

export function salesOfShift(db: PosDatabase, shift: Shift): Sale[] {
  const end = shift.closedAt ?? "9999-12-31T23:59:59.999Z";
  return db.sales.filter(
    (s) => s.status === "paid" && s.createdAt >= shift.openedAt && s.createdAt <= end,
  );
}

export function financeOfShift(db: PosDatabase, shift: Shift): FinanceEntry[] {
  const end = shift.closedAt ?? "9999-12-31T23:59:59.999Z";
  return (db.financeEntries ?? []).filter((f) =>
    f.shiftId ? f.shiftId === shift.id : f.createdAt >= shift.openedAt && f.createdAt <= end,
  );
}

export function financeSign(kind: FinanceEntry["kind"]): 1 | -1 {
  return kind === "income" || kind === "paidin" ? 1 : -1;
}

export function summarize(shift: Shift, sales: Sale[], finance: FinanceEntry[] = []): ShiftSummary {
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
  const financeCash = finance
    .filter((f) => f.isCash)
    .reduce((a, f) => a + financeSign(f.kind) * f.amount, 0);
  return {
    financeCash,
    count: sales.length,
    omzet,
    cashSales,
    nonCashSales,
    expected: shift.openingCash + cashSales + financeCash,
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
