import { uid } from "./format";
import type { CartLine, PosDatabase, Product, StockItem, StockMove } from "./types";

export function stockItemsOf(db: PosDatabase): StockItem[] {
  return db.stockItems ?? [];
}

/** Pemakaian satu bahan untuk 1 unit produk: aturan produk menang, lalu kategori. */
export function usagePerUnit(item: StockItem, product: Product | undefined): number {
  if (!product) return 0;
  const own = item.productUses.find((u) => u.productId === product.id);
  if (own) return own.qty;
  return item.categoryIds.includes(product.categoryId) ? item.categoryQty : 0;
}

/** Hitung perubahan stok untuk baris penjualan. sign -1 = kurangi, +1 = kembalikan. */
export function applyStock(
  db: PosDatabase,
  lines: CartLine[],
  sign: 1 | -1,
  info: { note: string; saleCode?: string; userName: string },
): Partial<Pick<PosDatabase, "stockItems" | "stockMoves">> {
  const items = stockItemsOf(db);
  if (!items.length) return {};
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const moves: StockMove[] = [];
  const next = items.map((it) => {
    let used = 0;
    for (const l of lines) if (!l.voided) used += usagePerUnit(it, byId.get(l.productId)) * l.qty;
    if (!used) return it;
    const qty = sign * used;
    moves.push({
      id: uid("stm"),
      stockId: it.id,
      stockName: it.name,
      createdAt: now,
      type: sign < 0 ? "sale" : "return",
      qty,
      note: info.note,
      ...(info.saleCode ? { saleCode: info.saleCode } : {}),
      userName: info.userName,
    });
    return { ...it, qty: Math.round((it.qty + qty) * 1000) / 1000 };
  });
  return { stockItems: next, stockMoves: [...moves, ...(db.stockMoves ?? [])].slice(0, 5000) };
}
