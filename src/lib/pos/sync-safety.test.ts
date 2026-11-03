import { describe, expect, it } from "vitest";
import { emptyDatabase } from "./seed";
import { closedArchiveEvents, sameSyncStore, trackExplicitDeletes } from "./sync-safety";

describe("POS data protection", () => {
  it("refreshing with empty local data never creates deletion instructions", () => {
    const db = emptyDatabase();
    expect(trackExplicitDeletes(db, db, "System", "2026-10-31T11:39:00Z").syncDeletes).toEqual([]);
  });
  it("explicit product removal queues only that product", () => {
    const before = emptyDatabase();
    before.settings.storeCode = "TS";
    before.products = [{ id: "product-ts" }] as typeof before.products;
    const result = trackExplicitDeletes(before, { ...before, products: [] }, "cashier", "2026-10-31T11:39:00Z");
    expect(result.syncDeletes).toEqual([{ c: "products", id: "product-ts", actor: "cashier", at: "2026-10-31T11:39:00Z" }]);
  });
  it("cannot send deletion of sales, cash shifts or business days", () => {
    const before = emptyDatabase();
    before.sales = [{ id: "sale-1" }] as typeof before.sales;
    before.shifts = [{ id: "shift-1" }] as typeof before.shifts;
    before.businessDays = [{ id: "day-1" }] as NonNullable<typeof before.businessDays>;
    expect(trackExplicitDeletes(before, { ...before, sales: [], shifts: [], businessDays: [] }, "System", "now").syncDeletes).toEqual([]);
  });
  it("switching TS to VT never queues TS deletions", () => {
    const before = emptyDatabase(); before.settings.storeCode = "TS";
    before.products = [{ id: "ts-product" }] as typeof before.products;
    const after = { ...emptyDatabase(), settings: { ...before.settings, storeCode: "VT" } };
    expect(trackExplicitDeletes(before, after, "developer", "now").syncDeletes ?? []).toEqual([]);
    expect(sameSyncStore(after, "TS", "token")).toBe(false);
  });
  it("archives close out and EOD once on their closing transition", () => {
    const before = emptyDatabase(); before.settings.storeCode = "TS";
    before.shifts = [{ id: "shift-1", closedAt: null }] as typeof before.shifts;
    before.businessDays = [{ id: "day-1", closedAt: null }] as NonNullable<typeof before.businessDays>;
    const after = { ...before, shifts: [{ ...before.shifts[0], closedAt: "2026-10-31T11:39:00Z" }], businessDays: [{ ...before.businessDays?.[0], closedAt: "2026-10-31T11:39:00Z" }] } as typeof before;
    expect(closedArchiveEvents(before, after)).toEqual(["shifts:shift-1", "businessDays:day-1"]);
    expect(closedArchiveEvents(after, after)).toEqual([]);
  });
});
import { trackActionChanges } from "./sync-safety";
describe("only real actions are uploaded", () => {
  it("opening/refreshing with cached default commission marks nothing", () => {
    const db = emptyDatabase(); db.settings.storeCode = "TS";
    expect(trackActionChanges(db, { ...db }).syncDirty).toBeUndefined();
  });
  it("changing Grab commission to 25 marks only GrabFood", () => {
    const db = emptyDatabase(); db.settings.storeCode = "TS";
    const after = { ...db, serviceTypes: db.serviceTypes!.map((s) => s.id === "svc_grab" ? { ...s, priceAdjustValue: 25 } : s) };
    expect(Object.keys(trackActionChanges(db, after).syncDirty ?? {})).toEqual(["serviceTypes:svc_grab"]);
  });
  it("a settings edit marks only the edited field", () => {
    const db = emptyDatabase(); db.settings.storeCode = "TS";
    const after = { ...db, settings: { ...db.settings, name: "FRUITBOX TS" } };
    expect(trackActionChanges(db, after).syncDirty).toEqual({ "settings:main": ["name"] });
  });
});
