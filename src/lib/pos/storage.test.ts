import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { emptyDatabase } from "./seed";
import { clearDatabase, listLocalArchives, loadDatabase, saveDatabase } from "./storage";

it("close out snapshot contains sales and cash and survives application reset", async () => {
  const db = emptyDatabase(); db.settings.storeCode = "ARCHIVE-TS";
  db.sales = [{ id: "sale", total: 500000 }] as typeof db.sales;
  db.shifts = [{ id: "shift", closingCash: 500000, closedAt: "2026-10-31T11:39:00Z" }] as typeof db.shifts;
  await saveDatabase(db);
  await clearDatabase();
  expect(await loadDatabase()).toBeNull();
  const archive = (await listLocalArchives("ARCHIVE-TS"))[0];
  expect(archive?.data.sales[0]?.total).toBe(500000);
  expect(archive?.data.shifts[0]?.closingCash).toBe(500000);
  expect(await listLocalArchives("ARCHIVE-VT")).toEqual([]);
});

it("serialized writes persist the latest transaction", async () => {
  const before = emptyDatabase(); before.settings.storeCode = "QUEUE-TS";
  const after = { ...before, sales: [{ id: "latest", total: 90000 }] as typeof before.sales };
  await Promise.all([saveDatabase(before), saveDatabase(after)]);
  expect((await loadDatabase())?.sales[0]?.total).toBe(90000);
});