import { describe, expect, it } from "vitest";
import { heldAfterSelectedPayment, selectPaymentItems, type PaymentOrder } from "./selected-payment";
import type { CartLine, HeldOrder } from "./types";
const line = (id: string, tableName: string): CartLine => ({ lineId: id, productId: id, name: id, variantName: "", unitPrice: 10000, qty: 1, note: "", discount: 0, staffName: "", tableName });
const original: PaymentOrder = { lines: [line("a", "Meja 1"), line("b", "Meja 2")], tableName: "Meja 1 + Meja 2", heldId: "hold-1", kitchenId: "kit-1", customerName: "Pelanggan", orderType: "Dine In", serviceId: "dine", orderNo: "DI-001", note: "catatan", sentToKitchen: true };
const heldOrder: HeldOrder = { id: "hold-1", label: "DI-001", createdAt: "2026-10-31T10:00:00Z", items: original.lines, tableName: original.tableName, kitchenId: original.kitchenId, customerName: original.customerName };
const held = [heldOrder];
describe("pembayaran item terpisah", () => {
 it("pemilihan/batal tidak mengubah item atau meja pesanan asal", () => {
  const before = structuredClone({ original, held });
  const selected = selectPaymentItems(original, ["a"]);
  expect(selected?.lines.map(l => l.lineId)).toEqual(["a"]);
  expect({ original, held }).toEqual(before);
  expect(original.lines.map(l => l.tableName)).toEqual(["Meja 1", "Meja 2"]);
 });
 it("lunas hanya mengeluarkan item dibayar dan mempertahankan identitas sisa", () => {
  const after = heldAfterSelectedPayment(held, original, ["a"], "new", "now");
  expect(after[0]?.id).toBe("hold-1");
  expect(after[0]?.items.map(l => l.lineId)).toEqual(["b"]);
  expect(after[0]?.items[0]?.tableName).toBe("Meja 2");
  expect(after[0]?.kitchenId).toBe("kit-1");
 });
 it("keranjang baru menyimpan sisa hanya saat lunas", () => {
  const after = heldAfterSelectedPayment([], { ...original, heldId: undefined }, ["a"], "new", "now");
  expect(after[0]?.id).toBe("new");
  expect(after[0]?.items.map(l => l.lineId)).toEqual(["b"]);
  expect(after[0]?.orderNo).toBe("DI-001");
 });
 it("item baru hasil sinkron tidak hilang saat melunasi item pilihan", () => {
  const after = heldAfterSelectedPayment([{ ...heldOrder, items: [...original.lines, line("c", "Meja 2")] }], original, ["a"], "new", "now");
  expect(after[0]?.items.map(l => l.lineId)).toEqual(["b", "c"]);
 });
});
