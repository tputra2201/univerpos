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
    const products: { name: string; qty: number; used: number }[] = [];
    for (const l of lines) {
      if (l.voided) continue;
      const u = usagePerUnit(it, byId.get(l.productId)) * l.qty;
      if (!u) continue;
      used += u;
      const ex = products.find((p) => p.name === l.name);
      if (ex) {
        ex.qty += l.qty;
        ex.used += u;
      } else products.push({ name: l.name, qty: l.qty, used: u });
    }
    if (!used) return it;
    const qty = sign * used;
    const balanceAfter = Math.round((it.qty + qty) * 1000) / 1000;
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
      balanceAfter,
      products,
    });
    return { ...it, qty: balanceAfter };
  });
  return { stockItems: next, stockMoves: [...moves, ...(db.stockMoves ?? [])] };
}

/** Hitung ulang saldo setiap bahan dari mutasi (agar data antar perangkat tidak saling menimpa). */
export function recomputeStock(db: PosDatabase): PosDatabase {
  const items = db.stockItems ?? [];
  if (!items.length) return db;
  const sum = new Map<string, number>();
  for (const m of db.stockMoves ?? []) sum.set(m.stockId, (sum.get(m.stockId) ?? 0) + m.qty);
  let changed = false;
  const next = items.map((it) => {
    if (it.baseQty === undefined && !sum.has(it.id)) return it;
    const qty = Math.round(((it.baseQty ?? 0) + (sum.get(it.id) ?? 0)) * 1000) / 1000;
    if (qty === it.qty && it.baseQty !== undefined) return it;
    changed = true;
    return { ...it, baseQty: it.baseQty ?? Math.round((it.qty - (sum.get(it.id) ?? 0)) * 1000) / 1000, qty: it.baseQty === undefined ? it.qty : qty };
  });
  return changed ? { ...db, stockItems: next } : db;
}
