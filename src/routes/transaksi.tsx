import { applyStock } from "@/lib/pos/stock";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Ban, Undo2, Search } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { usePos } from "@/lib/pos/store";
import { dateTime, rupiah } from "@/lib/pos/format";
import { buildReceipt } from "@/lib/pos/receipt";
import type { Sale } from "@/lib/pos/types";
import { hasPerm } from "@/lib/pos/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/transaksi")({
  head: () => ({
    meta: [
      { title: "Riwayat Transaksi — POS UKM" },
      {
        name: "description",
        content: "Riwayat penjualan, detail struk, cetak ulang, pembatalan, dan refund.",
      },
      { property: "og:title", content: "Riwayat Transaksi — POS UKM" },
      {
        property: "og:description",
        content: "Riwayat penjualan lengkap dengan cetak ulang struk dan refund.",
      },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <TransaksiPage />
      </AppShell>
    </PosGate>
  ),
});

function TransaksiPage() {
  const { db, update, currentUser } = usePos();
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Sale | null>(null);
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [action, setAction] = useState<{ sale: Sale; type: "void" | "refund" } | null>(null);
  const [reason, setReason] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.sales.filter(
      (s) =>
        !q ||
        s.code.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.tableName.toLowerCase().includes(q),
    );
  }, [db.sales, query]);

  function reprint(sale: Sale) {
    setPrintLines(buildReceipt("receipt", sale, db.settings, db.printer));
  }

  function applyAction() {
    if (!action) return;
    if (!reason.trim()) {
      toast.error("Alasan wajib diisi.");
      return;
    }
    const { sale, type } = action;
    update((current) => ({
      ...current,
      sales: current.sales.map((s) =>
        s.id === sale.id ? { ...s, status: type, reason: reason.trim() } : s,
      ),
      products: current.products.map((p) => {
        const qty = sale.items.filter((i) => i.productId === p.id && !i.voided).reduce((a, i) => a + i.qty, 0);
        return qty > 0 && p.stock != null ? { ...p, stock: p.stock + qty } : p;
      }),
      ...(sale.status === "paid"
        ? applyStock(current, sale.items, 1, { note: `${type === "void" ? "Void" : "Refund"} ${sale.code}`, saleCode: sale.code, userName: currentUser?.name ?? "" })
        : {}),
    }));
    setAction(null);
    setReason("");
    setDetail(null);
    toast.success(type === "void" ? "Transaksi dibatalkan." : "Refund dicatat.");
  }

  return (
    <div>
      <PageHeader
        title="Transaksi"
        description={`${db.sales.length} transaksi tersimpan di perangkat ini.`}
      />
      <div className="space-y-3 p-4 md:p-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor transaksi, meja, pelanggan"
            className="h-10 pl-9"
          />
        </div>

        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
          )}
          {list.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => setDetail(sale)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left hover:border-primary"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{sale.code}</p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(sale.createdAt)} · {sale.userName}
                  {sale.tableName && ` · ${sale.tableName}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.items.reduce((a, i) => a + i.qty, 0)} item ·{" "}
                  {sale.payments.map((p) => p.methodName).join(" + ")}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular font-bold">{rupiah(sale.total)}</p>
                {sale.status !== "paid" && (
                  <Badge variant="destructive">
                    {sale.status === "void" ? "Dibatalkan" : "Refund"}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{detail?.code}</DialogTitle>
            <DialogDescription>{detail && dateTime(detail.createdAt)}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <ul className="space-y-2">
                {detail.items.map((i) => (
                  <li key={i.lineId} className="flex justify-between gap-2">
                    <span>
                      {i.qty}× {i.name}
                      {i.variantName && ` (${i.variantName})`}
                      {i.note && <span className="block text-xs text-muted-foreground">{i.note}</span>}
                    </span>
                    <span className="tabular">{rupiah(i.qty * i.unitPrice - i.discount)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t pt-2">
                <Line label="Subtotal" value={rupiah(detail.subtotal)} />
                {detail.discount > 0 && <Line label="Diskon" value={"-" + rupiah(detail.discount)} />}
                {detail.service > 0 && <Line label="Layanan" value={rupiah(detail.service)} />}
                {detail.tax > 0 && <Line label="Pajak" value={rupiah(detail.tax)} />}
                <Line label="Total" value={rupiah(detail.total)} strong />
                {detail.payments.map((p, idx) => (
                  <Line key={idx} label={p.methodName} value={rupiah(p.amount)} />
                ))}
                <Line label="Kembalian" value={rupiah(detail.change)} />
              </div>
              {detail.status !== "paid" && (
                <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  {detail.status === "void" ? "Dibatalkan" : "Refund"}: {detail.reason}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="gap-2" onClick={() => detail && reprint(detail)}>
              <Printer className="size-4" /> Cetak ulang
            </Button>
            {detail?.status === "paid" && hasPerm(db.settings, currentUser?.role, "transaction.void") && (
              <>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setAction({ sale: detail, type: "refund" })}
                >
                  <Undo2 className="size-4" /> Refund
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setAction({ sale: detail, type: "void" })}
                >
                  <Ban className="size-4" /> Batalkan
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!action} onOpenChange={(v) => !v && setAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {action?.type === "void" ? "Batalkan Transaksi" : "Catat Refund"}
            </DialogTitle>
            <DialogDescription>
              Stok produk akan dikembalikan. Transaksi tidak dihitung dalam omzet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={applyAction}>
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintPreview
        open={printLines !== null}
        onOpenChange={(v) => !v && setPrintLines(null)}
        title="Cetak Ulang Struk"
        lines={printLines ?? []}
        role="receipt"
      />
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
