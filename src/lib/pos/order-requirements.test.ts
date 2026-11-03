import { describe, expect, it } from "vitest";
import { needsDiningTable } from "./order-requirements";

describe("Dine In table requirement before ordering or payment", () => {
  it("blocks a selected Dine In service without a table", () => {
    expect(needsDiningTable({ kind: "dinein" }, "Makan di tempat", "")).toBe(true);
  });
  it("blocks automatic default Dine In before the first item", () => {
    expect(needsDiningTable({ kind: "dinein" }, "", "")).toBe(true);
  });
  it("blocks restored legacy Dine In and blank table names", () => {
    expect(needsDiningTable(undefined, "Dine In", "  ")).toBe(true);
  });
  it("allows Dine In after selecting a table, including merged tables", () => {
    expect(needsDiningTable({ kind: "dinein" }, "Dine In", "Meja 1")).toBe(false);
    expect(needsDiningTable({ kind: "dinein" }, "Dine In", "Meja 1 + Meja 2")).toBe(false);
  });
  it("does not require a table for Take Out", () => {
    expect(needsDiningTable({ kind: "takeout" }, "Take Out", "")).toBe(false);
  });
});