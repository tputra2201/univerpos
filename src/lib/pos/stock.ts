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
  info: { note: string; saleCode?: string; userName: string; serviceId?: string | undefined; orderType?: string | undefined },
): Partial<Pick<PosDatabase, "stockItems" | "stockMoves">> {
  const items = stockItemsOf(db);
  if (!items.length) return {};
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const moves: StockMove[] = [];
  const svcId =
    info.serviceId ??
    (db.serviceTypes ?? []).find((s) => info.orderType && s.name === info.orderType)?.id;
  const next = items.map((it) => {
    if (it.serviceIds?.length && svcId && !it.serviceIds.includes(svcId)) return it;
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

/**
 * Hitung ulang saldo setiap bahan dari riwayat mutasi, supaya perangkat lain tidak menimpa saldo.
 * Opname = saldo fisik mutlak (reset); mutasi lain ditambahkan berurutan waktu.
 */
export function recomputeStock(db: PosDatabase): PosDatabase {
  const items = db.stockItems ?? [];
  if (!items.length) return db;
  const by = new Map<string, StockMove[]>();
  for (const m of db.stockMoves ?? []) {
    const a = by.get(m.stockId) ?? [];
    a.push(m);
    by.set(m.stockId, a);
  }
  let changed = false;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const next = items.map((it) => {
    const ms = (by.get(it.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!ms.length) return it;
    const base = it.baseQty ?? r((ms[0]!.balanceAfter ?? 0) - ms[0]!.qty);
    let run = base;
    for (const m of ms) run = m.type === "opname" && m.balanceAfter !== undefined ? m.balanceAfter : run + m.qty;
    run = r(run);
    if (run === it.qty && it.baseQty !== undefined) return it;
    changed = true;
    return { ...it, baseQty: base, qty: run };
  });
  return changed ? { ...db, stockItems: next } : db;
}
