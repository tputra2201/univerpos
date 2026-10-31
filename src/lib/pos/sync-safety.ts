import type { PosDatabase } from "./types";

export const SYNC_COLLECTIONS = ["users", "categories", "products", "modifiers", "paymentMethods", "tables", "staff", "onlineChannels", "serviceTypes", "sales", "heldOrders", "kitchenOrders", "shifts", "businessDays", "members", "memberPoints", "financeCategories", "financeEntries", "deletedFinance", "stockItems", "stockMoves"] as const;
export const PROTECTED_HISTORY = new Set<string>(["sales", "shifts", "businessDays", "stockMoves", "memberPoints", "deletedFinance"]);
export type SyncDeletion = { c: string; id: string; at: string; actor: string };

/** Only an application action may enqueue a deletion; missing local/base rows never may. */
export function trackExplicitDeletes(before: PosDatabase, after: PosDatabase, actor: string, at: string): PosDatabase {
  if (before.settings.storeCode !== after.settings.storeCode) return after;
  const pending = new Map((before.syncDeletes ?? []).map((d) => [`${d.c}:${d.id}`, d]));
  for (const c of SYNC_COLLECTIONS) {
    const present = new Set(((after[c] ?? []) as { id: string }[]).map((r) => r.id));
    for (const row of (before[c] ?? []) as { id: string }[]) {
      const key = `${c}:${row.id}`;
      if (!present.has(row.id) && !PROTECTED_HISTORY.has(c)) pending.set(key, { c, id: row.id, at, actor });
      else if (present.has(row.id)) pending.delete(key);
    }
  }
  return { ...after, syncDeletes: [...pending.values()] };
}

export function sameSyncStore(db: PosDatabase, code: string, token: string): boolean {
  return db.settings.activated && db.settings.storeCode === code && db.settings.deviceToken === token;
}

export function closedArchiveEvents(before: PosDatabase | null, after: PosDatabase): string[] {
  const events: string[] = [];
  for (const c of ["shifts", "businessDays"] as const) {
    const prior = new Map((before?.settings.storeCode === after.settings.storeCode ? before[c] ?? [] : []).map((r) => [r.id, r.closedAt]));
    for (const row of after[c] ?? []) if (row.closedAt && !prior.get(row.id)) events.push(`${c}:${row.id}`);
  }
  return events;
}