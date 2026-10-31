import type { CartLine, HeldOrder } from "./types";
export interface PaymentOrder {
  lines: CartLine[]; tableName: string; customerName: string; orderType: string;
  serviceId?: string; heldId?: string; kitchenId?: string; orderNo: string;
  note: string; sentToKitchen: boolean;
}
/** Selection is a view only; held orders change atomically with a paid sale. */
export function selectPaymentItems<T extends PaymentOrder>(order: T, lineIds: string[]): T | null {
  const ids = new Set(lineIds);
  const lines = order.lines.filter((line) => ids.has(line.lineId) && !line.voided);
  return lines.length ? { ...order, lines } : null;
}
export function heldAfterSelectedPayment(held: HeldOrder[], original: PaymentOrder, paidIds: string[], remainderId: string, at: string): HeldOrder[] {
  const ids = new Set(paidIds);
  const existing = held.find((order) => order.id === original.heldId);
  const items = (existing?.items ?? original.lines).filter((line) => !ids.has(line.lineId));
  const others = held.filter((order) => order.id !== original.heldId);
  if (!items.length) return others;
  return [{
    id: original.heldId ?? remainderId,
    label: [original.orderNo, original.orderType, original.tableName || original.customerName].filter(Boolean).join(" • "),
    createdAt: at, tableName: original.tableName, customerName: original.customerName,
    orderType: original.orderType, serviceId: original.serviceId, orderNo: original.orderNo,
    note: original.note, sentToKitchen: original.sentToKitchen, kitchenId: original.kitchenId,
    ...existing, items,
  }, ...others];
}
