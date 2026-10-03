import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { dateTime, rupiah } from "@/lib/pos/format";
import { inRange, type ReportRange } from "@/lib/pos/report-range";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Row = { saleId: string; code: string; at: string; customer: string; user: string; name: string; qty: number; amount: number };
type Prod = { key: string; name: string; qty: number; amount: number; rows: Row[] };
type Cat = { id: string; name: string; qty: number; amount: number; products: Prod[]; rows: Row[] };

export function CategorySalesReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<{ title: string; rows: Row[] } | null>(null);

  const { cats, total, qty } = useMemo(() => {
    const prodCat = new Map(db.products.map((p) => [p.id, p.categoryId]));
    const catName = new Map(db.categories.map((c) => [c.id, c.name]));
    const order = new Map(db.categories.map((c, i) => [c.id, i]));
    const map = new Map<string, Cat>();
    for (const s of db.sales) {
      if (s.status !== "paid" || !inRange(s.createdAt, range)) continue;
      for (const l of s.items) {
        if (l.voided) continue;
        const cid = prodCat.get(l.productId) ?? "";
        const cat = map.get(cid) ?? { id: cid, name: catName.get(cid) ?? "Tanpa kategori", qty: 0, amount: 0, products: [], rows: [] };
        map.set(cid, cat);
        const amount = l.unitPrice * l.qty - l.discount;
        const row: Row = { saleId: s.id, code: s.orderNo || s.code, at: s.createdAt, customer: s.customerName, user: s.userName, name: l.name, qty: l.qty, amount };
        let p = cat.products.find((x) => x.key === l.productId);
        if (!p) { p = { key: l.productId, name: l.name, qty: 0, amount: 0, rows: [] }; cat.products.push(p); }
        p.qty += l.qty; p.amount += amount; p.rows.push(row);
        cat.qty += l.qty; cat.amount += amount; cat.rows.push(row);
      }
    }
    const cats = [...map.values()].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    cats.forEach((c) => {
      c.products.sort((a, b) => b.amount - a.amount);
      c.rows.sort((a, b) => b.at.localeCompare(a.at));
      c.products.forEach((p) => p.rows.sort((a, b) => b.at.localeCompare(a.at)));
    });
    return { cats, total: cats.reduce((a, c) => a + c.amount, 0), qty: cats.reduce((a, c) => a + c.qty, 0) };
  }, [db, range]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-semibold">Sales Report</div>
      {!cats.length && <p className="p-4 text-sm text-muted-foreground">Tidak ada penjualan di periode ini.</p>}
      <div className="divide-y">
        {cats.map((c) => {
          const isOpen = open[c.id] ?? true;
          return (
            <div key={c.id}>
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-sm font-semibold">
                <button type="button" aria-label="Buka/tutup" onClick={() => setOpen({ ...open, [c.id]: !isOpen })}>
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                <button type="button" className="flex-1 text-left hover:underline" onClick={() => setDetail({ title: `Kategori ${c.name}`, rows: c.rows })}>
                  {c.name}
                </button>
                <span className="tabular w-16 text-right">{c.qty}</span>
                <span className="tabular w-32 text-right">{rupiah(c.amount)}</span>
              </div>
              {isOpen && c.products.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 pl-10 text-left text-sm hover:bg-muted"
                  onClick={() => setDetail({ title: p.name, rows: p.rows })}
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="tabular w-16 text-right">{p.qty}</span>
                  <span className="tabular w-32 text-right">{rupiah(p.amount)}</span>
                </button>
              ))}
              {isOpen && (
                <div className="flex gap-2 border-t border-dashed px-4 py-2 pl-10 text-sm font-semibold">
                  <span className="flex-1">Subtotal {c.name}</span>
                  <span className="tabular w-16 text-right">{c.qty}</span>
                  <span className="tabular w-32 text-right">{rupiah(c.amount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {cats.length > 0 && (
        <div className="flex gap-2 border-t-2 px-4 py-3 font-extrabold">
          <span className="flex-1">Total Sales</span>
          <span className="tabular w-16 text-right">{qty}</span>
          <span className="tabular w-32 text-right">{rupiah(total)}</span>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Transaksi · {detail?.title}</DialogTitle>
          </DialogHeader>
          <div className="divide-y text-sm">
            {detail?.rows.map((r, i) => (
              <div key={r.saleId + i} className="flex justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono font-semibold">{r.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(r.at)} · {r.user}{r.customer && ` · ${r.customer}`}
                  </p>
                  <p className="truncate text-xs">{r.qty}x {r.name}</p>
                </div>
                <span className="tabular font-semibold">{rupiah(r.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Total ({detail?.rows.reduce((a, r) => a + r.qty, 0)} item)</span>
            <span className="tabular">{rupiah(detail?.rows.reduce((a, r) => a + r.amount, 0) ?? 0)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
