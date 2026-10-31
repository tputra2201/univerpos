import { describe, expect, it } from "vitest";
import { sortProductsForDisplay } from "./product-sort";

const items = [{ name: "Mango" }, { name: "apel" }, { name: "Jeruk" }];

describe("sortProductsForDisplay", () => {
  it("urut A-Z saat toggle aktif", () => {
    expect(sortProductsForDisplay(items, true).map((p) => p.name)).toEqual(["apel", "Jeruk", "Mango"]);
  });
  it("tetap urutan manual saat toggle mati", () => {
    expect(sortProductsForDisplay(items, false).map((p) => p.name)).toEqual(["Mango", "apel", "Jeruk"]);
  });
});
