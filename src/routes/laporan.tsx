import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, PlayCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { usePos } from "@/lib/pos/store";
import { dateTime, isSameDay, rupiah, uid } from "@/lib/pos/format";
import { buildReport } from "@/lib/pos/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan Harian & Shift — POS UKM" },
      {
        name: "description",
        content:
          "Ringkasan omzet harian, rincian metode pembayaran, produk terlaris, serta buka dan tutup kasir.",
      },
      { property: "og:title", content: "Laporan Harian & Shift — POS UKM" },
      {
        property: "og:description",
        content: "Omzet harian, metode pembayaran, produk terlaris, dan tutup kasir.",
      },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <LaporanPage />
      </AppShell>
    </PosGate>
  ),
});

function LaporanPage() {
  const { db, update, currentUser } = usePos();
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [printTitle, setPrintTitle] = useState("Laporan");
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [cashInput, setCashInput] = useState("");

  const today = new Date();
  const todaySales = useMemo(
    () => db.sales.filter((s) => isSameDay(s.createdAt, today) && s.status === "paid"),
    [db.sales],
  );
  const activeShift = db.shifts.find((s) => !s.closedAt) ?? null;
  const shiftSales = useMemo(
    () =>
      activeShift
        ? db.sales.filter((s) => s.status === "paid" && s.createdAt >= activeShift.openedAt)
        : [],
    [db.sales, activeShift],
  );

  const omzet = todaySales.reduce((a, s) => a + s.total, 0);
  const byMethod = new Map<string, number>();
  todaySales.forEach((s) =>
    s.payments.forEach((p) => byMethod.set(p.methodName, (byMethod.get(p.methodName) ?? 0) + p.amount)),
  );
  const topItems = (() => {
    const map = new Map<string, number>();
    todaySales.forEach((s) => s.items.forEach((i) => map.set(i.name, (map.get(i.name) ?? 0) + i.qty)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  })();

  function printX() {
    setPrintTitle("Laporan Sementara (X)");
    setPrintLines(
      buildReport(
        {
          title: "LAPORAN X (SEMENTARA)",
          from: activeShift ? dateTime(activeShift.openedAt) : dateTime(today.toISOString()),
          to: dateTime(new Date().toISOString()),
          sales: activeShift ? shiftSales : todaySales,
          openingCash: activeShift?.openingCash ?? null,
        },
        db,
      ),
    );
  }

  function printDaily() {
    setPrintTitle("Laporan Harian");
    setPrintLines(
      buildReport(
        {
          title: "LAPORAN HARIAN",
          from: today.toLocaleDateString("id-ID"),
          to: today.toLocaleDateString("id-ID"),
          sales: todaySales,
        },
        db,
      ),
    );
  }

  function openShift() {
    const cash = Number(cashInput.replace(/\D/g, "")) || 0;
    update((current) => ({
      ...current,
      shifts: [
        {
          id: uid("shf"),
          openedAt: new Date().toISOString(),
          closedAt: null,
          openingCash: cash,
          closingCash: null,
          userName: currentUser?.name ?? "Kasir",
        },
        ...current.shifts,
      ],
    }));
    setCashInput("");
    setOpenShiftDialog(false);
    toast.success("Kasir dibuka.");
  }

  function closeShift() {
    if (!activeShift) return;
    const cash = Number(cashInput.replace(/\D/g, "")) || 0;
    const closedAt = new Date().toISOString();
    update((current) => ({
      ...current,
      shifts: current.shifts.map((s) =>
        s.id === activeShift.id ? { ...s, closedAt, closingCash: cash } : s,
      ),
    }));
    setPrintTitle("Laporan Tutup Kasir (Z)");
    setPrintLines(
      buildReport(
        {
          title: "LAPORAN Z (TUTUP KASIR)",
          from: dateTime(activeShift.openedAt),
          to: dateTime(closedAt),
          sales: shiftSales,
          openingCash: activeShift.openingCash,
          closingCash: cash,
        },
        db,
      ),
    );
    setCashInput("");
    setCloseShiftDialog(false);
    toast.success("Kasir ditutup.");
  }

  const voidRows = db.sales
    .filter((s) => isSameDay(s.createdAt, today))
    .flatMap((s) => {
      if (s.status === "void")
        return [{ key: s.id, title: `Pesanan ${s.orderNo || s.code} (seluruhnya)`, at: s.createdAt, reason: s.reason || "-", amount: s.total }];
      return s.items
        .filter((i) => i.voided)
        .map((i) => ({
          key: s.id + i.lineId,
          title: `${i.qty}× ${i.name} — ${s.orderNo || s.code}`,
          at: s.createdAt,
          reason: `${i.voidReason ?? "-"} — ${i.voidedBy ?? ""}`,
          amount: i.unitPrice * i.qty - i.discount,
        }));
    });

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={today.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2" onClick={printX}>
              <Printer className="size-4" /> Laporan X
            </Button>
            <Button variant="secondary" className="gap-2" onClick={printDaily}>
              <Printer className="size-4" /> Laporan Harian
            </Button>
            {activeShift ? (
              <Button className="gap-2" onClick={() => setCloseShiftDialog(true)}>
                <StopCircle className="size-4" /> Tutup Kasir
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => setOpenShiftDialog(true)}>
                <PlayCircle className="size-4" /> Buka Kasir
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Omzet hari ini" value={rupiah(omzet)} />
          <Stat label="Jumlah transaksi" value={String(todaySales.length)} />
          <Stat
            label="Rata-rata per transaksi"
            value={rupiah(todaySales.length ? omzet / todaySales.length : 0)}
          />
          <Stat
            label="Status kasir"
            value={activeShift ? "Terbuka" : "Tertutup"}
            hint={activeShift ? `Kas awal ${rupiah(activeShift.openingCash)}` : undefined}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Laporan Void Hari Ini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {voidRows.length === 0 && <p className="text-muted-foreground">Belum ada void hari ini.</p>}
            {voidRows.map((v) => (
              <div key={v.key} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                <div>
                  <p className="font-semibold">{v.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(v.at)} • {v.reason}
                  </p>
                </div>
                <span className="tabular font-semibold text-destructive">{rupiah(v.amount)}</span>
              </div>
            ))}
            {voidRows.length > 0 && (
              <div className="flex justify-between pt-1 font-semibold">
                <span>Total void</span>
                <span className="tabular">{rupiah(voidRows.reduce((a, v) => a + v.amount, 0))}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {byMethod.size === 0 && (
                <p className="text-muted-foreground">Belum ada penjualan hari ini.</p>
              )}
              {[...byMethod.entries()].map(([name, amount]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="tabular font-semibold">{rupiah(amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {topItems.length === 0 && (
                <p className="text-muted-foreground">Belum ada produk terjual hari ini.</p>
              )}
              {topItems.map(([name, qty]) => (
                <div key={name} className="flex justify-between">
                  <span className="truncate text-muted-foreground">{name}</span>
                  <span className="tabular font-semibold">{qty}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {db.shifts.length === 0 && (
              <p className="text-muted-foreground">Belum ada shift tercatat.</p>
            )}
            {db.shifts.slice(0, 10).map((s) => (
              <div key={s.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  {s.userName} · {dateTime(s.openedAt)}
                  {s.closedAt ? ` → ${dateTime(s.closedAt)}` : " → berjalan"}
                </span>
                <span className="tabular text-muted-foreground">
                  Kas awal {rupiah(s.openingCash)}
                  {s.closingCash != null && ` · akhir ${rupiah(s.closingCash)}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ShiftDialog
        open={openShiftDialog}
        onOpenChange={setOpenShiftDialog}
        title="Buka Kasir"
        description="Catat uang tunai awal di kotak kasir."
        label="Kas awal"
        value={cashInput}
        onChange={setCashInput}
        onSubmit={openShift}
      />
      <ShiftDialog
        open={closeShiftDialog}
        onOpenChange={setCloseShiftDialog}
        title="Tutup Kasir"
        description="Hitung uang tunai di kotak kasir, lalu cetak laporan Z."
        label="Kas akhir"
        value={cashInput}
        onChange={setCashInput}
        onSubmit={closeShift}
      />

      <PrintPreview
        open={printLines !== null}
        onOpenChange={(v) => !v && setPrintLines(null)}
        title={printTitle}
        lines={printLines ?? []}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ShiftDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  value,
  onChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{label}</Label>
          <Input
            inputMode="numeric"
            value={value ? Number(value.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
            className="tabular h-12 text-right text-xl font-bold"
          />
        </div>
        <DialogFooter>
          <Button className="w-full h-11" onClick={onSubmit}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
