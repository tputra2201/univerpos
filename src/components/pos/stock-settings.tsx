import { useState } from "react";
import { Plus, Pencil, Trash2, PackagePlus, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { stockItemsOf } from "@/lib/pos/stock";
import { hasPerm } from "@/lib/pos/permissions";

import type { StockItem, StockMove } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")) || 0);
const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

function blank(): StockItem {
  return { id: uid("stk"), name: "", unit: "pcs", qty: 0, minQty: 0, categoryIds: [], categoryQty: 1, productUses: [] };
}

export function StockSettings() {
  const { db, update, currentUser } = usePos();
  const can = (k: Parameters<typeof hasPerm>[2]) => hasPerm(db.settings, currentUser?.role, k);
  const canManage = can("stock.manage");
  const canIn = can("stock.in");
  const canAdjust = can("stock.adjust");
  const items = stockItemsOf(db);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [adjust, setAdjust] = useState<{ item: StockItem; mode: "in" | "opname" } | null>(null);
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const moves = (db.stockMoves ?? []).slice(0, 30);

  if (!can("stock.view"))
    return <p className="text-sm text-muted-foreground">Akun Anda tidak berhak melihat data stok.</p>;


  function save(item: StockItem) {
    if (!canManage) { toast.error("Akun Anda tidak berhak mengubah data bahan."); return; }
    if (!item.name.trim()) { toast.error("Nama bahan wajib diisi."); return; }
    update((cur) => {
      const list = cur.stockItems ?? [];
      const exists = list.some((x) => x.id === item.id);
      if (!exists) item = { ...item, baseQty: item.qty };
      return { ...cur, stockItems: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
    });
    setEditing(null);
    toast.success("Bahan stok disimpan.");
  }

  function remove(id: string) {
    if (!canManage) { toast.error("Akun Anda tidak berhak menghapus data bahan."); return; }
    if (!window.confirm("Hapus bahan stok ini?")) return;
    update((cur) => ({ ...cur, stockItems: (cur.stockItems ?? []).filter((x) => x.id !== id) }));
  }

  function applyAdjust() {
    if (!adjust) return;
    if (adjust.mode === "in" ? !canIn : !canAdjust) { toast.error("Akun Anda tidak berhak melakukan ini."); return; }
    const v = num(adjQty);
    const { item, mode } = adjust;
    const delta = mode === "in" ? v : v - item.qty;

    if (mode === "in" && v <= 0) { toast.error("Isi jumlah barang masuk."); return; }
    const move: StockMove = {
      id: uid("stm"),
      stockId: item.id,
      stockName: item.name,
      createdAt: new Date().toISOString(),
      type: mode,
      qty: delta,
      note: adjNote.trim() || (mode === "in" ? "Barang masuk" : "Stok opname"),
      userName: currentUser?.name ?? "",
      balanceAfter: Math.round((item.qty + delta) * 1000) / 1000,
    };
    update((cur) => ({
      ...cur,
      stockItems: (cur.stockItems ?? []).map((x) => (x.id === item.id ? { ...x, qty: x.qty + delta } : x)),
      stockMoves: [move, ...(cur.stockMoves ?? [])],
    }));
    setAdjust(null);
    toast.success("Stok diperbarui.");
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Stok Bahan & Kemasan</CardTitle>
            <CardDescription>
              Stok berkurang otomatis setiap penjualan produk yang memakai bahan ini, dan kembali saat nota di-void/refund.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setEditing(blank())}>
              <Plus className="mr-1 h-4 w-4" /> Tambah
            </Button>
          )}

        </CardHeader>
        <CardContent className="space-y-2">
          {!items.length && <p className="text-sm text-muted-foreground">Belum ada bahan. Contoh: Cup 16oz, Sedotan, Air Mineral Botol.</p>}
          {stockGroups(items).map(([g, list]) => (
            <div key={g} className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{g} · {list.length}</p>
          {list.map((it) => {
            const low = it.qty <= it.minQty;
            const cats = db.categories.filter((c) => it.categoryIds.includes(c.id)).map((c) => c.name);
            return (
              <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {it.name}
                    {low && <Badge variant="destructive">Menipis</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {cats.length ? `Kategori: ${cats.join(", ")} (${fmt(it.categoryQty)}/produk)` : "Tanpa kategori"}
                    {it.productUses.length ? ` • ${it.productUses.length} aturan produk` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{fmt(it.qty)}</div>
                  <div className="text-xs text-muted-foreground">{it.unit}</div>
                </div>
                <div className="flex gap-1">
                  {canIn && (
                    <Button size="icon" variant="outline" title="Barang masuk" onClick={() => { setAdjust({ item: it, mode: "in" }); setAdjQty(""); setAdjNote(""); }}>
                      <PackagePlus className="h-4 w-4" />
                    </Button>
                  )}
                  {canAdjust && (
                    <Button size="icon" variant="outline" title="Stok opname" onClick={() => { setAdjust({ item: it, mode: "opname" }); setAdjQty(String(it.qty)); setAdjNote(""); }}>
                      <ClipboardCheck className="h-4 w-4" />
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button size="icon" variant="outline" title="Ubah" onClick={() => setEditing(structuredClone(it))}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" title="Hapus" onClick={() => remove(it.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Mutasi Stok</CardTitle>
          <CardDescription>30 mutasi terakhir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {!moves.length && <p className="text-muted-foreground">Belum ada mutasi.</p>}
          {moves.map((m) => (
            <div key={m.id} className="flex justify-between gap-2 border-b py-1 last:border-0">
              <span className="min-w-0 truncate">
                {new Date(m.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })} • {m.stockName} • {m.note}
              </span>
              <span className={m.qty < 0 ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                {m.qty > 0 ? "+" : ""}{fmt(m.qty)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjust?.mode === "in" ? "Barang masuk" : "Stok opname"} — {adjust?.item.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Stok sistem saat ini: {fmt(adjust?.item.qty ?? 0)} {adjust?.item.unit}</p>
            <div>
              <Label>{adjust?.mode === "in" ? "Jumlah masuk" : "Jumlah fisik hasil hitung"}</Label>
              <Input inputMode="decimal" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Catatan</Label>
              <Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Opsional" />
            </div>
            <Button className="w-full" onClick={applyAdjust}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bahan stok</DialogTitle>
          </DialogHeader>
          {editing && <StockForm value={editing} onChange={setEditing} onSave={() => save(editing)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StockForm({ value, onChange, onSave }: { value: StockItem; onChange: (v: StockItem) => void; onSave: () => void }) {
  const { db } = usePos();
  const isNew = !(db.stockItems ?? []).some((x) => x.id === value.id);
  const [q, setQ] = useState("");
  const set = (patch: Partial<StockItem>) => onChange({ ...value, ...patch });
  const products = db.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nama bahan / kemasan</Label>
          <Input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Cup 16oz" />
        </div>
        <div className="col-span-2">
          <Label>Kategori stok</Label>
          <Input list="stock-groups" value={value.group ?? ""} onChange={(e) => set({ group: e.target.value })} placeholder="Kemasan, Bahan Minuman, ..." />
          <datalist id="stock-groups">
            {[...new Set((db.stockItems ?? []).map((x) => x.group?.trim()).filter(Boolean))].map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>
        <div>
          <Label>Satuan</Label>
          <Input value={value.unit} onChange={(e) => set({ unit: e.target.value })} />
        </div>
        <div>
          <Label>Batas menipis</Label>
          <Input inputMode="decimal" defaultValue={value.minQty || ""} onChange={(e) => set({ minQty: num(e.target.value) })} />
        </div>
        {isNew && (
          <div className="col-span-2">
            <Label>Stok awal</Label>
            <Input inputMode="decimal" defaultValue={value.qty || ""} onChange={(e) => set({ qty: num(e.target.value) })} />
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="font-semibold">Dipakai oleh kategori (aturan umum)</div>
        <div className="grid grid-cols-2 gap-2">
          {db.categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.categoryIds.includes(c.id)}
                onCheckedChange={(v) =>
                  set({ categoryIds: v ? [...value.categoryIds, c.id] : value.categoryIds.filter((x) => x !== c.id) })
                }
              />
              {c.name}
            </label>
          ))}
        </div>
        <div>
          <Label>Pemakaian per 1 produk</Label>
          <Input inputMode="decimal" defaultValue={value.categoryQty} onChange={(e) => set({ categoryQty: num(e.target.value) })} />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="font-semibold">Aturan khusus produk</div>
        <p className="text-xs text-muted-foreground">
          Menang atas aturan kategori. Isi 0 agar produk tertentu (mis. minuman panas) tidak memakai bahan ini.
        </p>
        {value.productUses.map((u) => {
          const p = db.products.find((x) => x.id === u.productId);
          return (
            <div key={u.productId} className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm">{p?.name ?? "(produk dihapus)"}</span>
              <Input
                className="w-24"
                inputMode="decimal"
                defaultValue={u.qty}
                onChange={(e) =>
                  set({ productUses: value.productUses.map((x) => (x.productId === u.productId ? { ...x, qty: num(e.target.value) } : x)) })
                }
              />
              <Button size="icon" variant="ghost" onClick={() => set({ productUses: value.productUses.filter((x) => x.productId !== u.productId) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk untuk ditambahkan…" />
        {q && (
          <div className="max-h-40 overflow-y-auto rounded border">
            {products
              .filter((p) => !value.productUses.some((u) => u.productId === p.id))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => { set({ productUses: [...value.productUses, { productId: p.id, qty: 1 }] }); setQ(""); }}
                >
                  {p.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onSave}>Simpan</Button>
    </div>
  );
}
