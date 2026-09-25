import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { ShiftPanel } from "@/components/pos/shift-panel";
import {
  CashierReport,
  CloseOutReport,
  CompanyReport,
  MethodReport,
  RangePicker,
  StatsReport,
  VoidReport,
} from "@/components/pos/reports";
import { usePos } from "@/lib/pos/store";
import { dateTime, rupiah } from "@/lib/pos/format";
import { buildReport } from "@/lib/pos/receipt";
import { exportReportExcel } from "@/lib/pos/report-excel";
import { defaultRange, inRange, rangeLabel, type ReportRange } from "@/lib/pos/report-range";
import { activeShiftOf, salesOfShift, summarize } from "@/lib/pos/shift";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan & Shift Kasir — POS UKM" },
      {
        name: "description",
        content:
          "Check-in dan close out kasir, End of Day, serta laporan omzet, produk terlaku, hari ramai, QRIS, dan per kasir dengan rentang waktu.",
      },
      { property: "og:title", content: "Laporan & Shift Kasir — POS UKM" },
      {
        property: "og:description",
        content: "Close out kasir, End of Day, dan laporan lengkap berbasis rentang waktu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { db } = usePos();
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [printTitle, setPrintTitle] = useState("Laporan");
  const [range, setRange] = useState<ReportRange>(() => defaultRange(db.settings));

  const shift = activeShiftOf(db);
  const rangeSales = useMemo(
    () => db.sales.filter((s) => inRange(s.createdAt, range) && s.status === "paid"),
    [db.sales, range],
  );
  const omzet = rangeSales.reduce((a, s) => a + s.total, 0);

  function show(title: string, lines: string[]) {
    setPrintTitle(title);
    setPrintLines(lines);
  }

  function printX() {
    if (!shift) {
      toast.error("Belum ada kasir yang check-in.");
      return;
    }
    const sales = salesOfShift(db, shift);
    const sum = summarize(shift, sales);
    show(
      "Laporan Sementara (X)",
      buildReport(
        {
          title: "LAPORAN X (SEMENTARA)",
          from: dateTime(shift.openedAt),
          to: dateTime(new Date().toISOString()),
          sales,
          openingCash: shift.openingCash,
          extra: [
            { label: "Kasir", value: shift.userName },
            { label: "Penjualan Tunai", value: rupiah(sum.cashSales) },
            { label: "Non-Tunai", value: rupiah(sum.nonCashSales) },
            { label: "Kas Seharusnya", value: rupiah(sum.expected) },
          ],
        },
        db,
      ),
    );
  }

  function printRange() {
    show(
      "Laporan Periode",
      buildReport(
        { title: "LAPORAN PERIODE", from: rangeLabel(range), to: "", sales: rangeSales },
        db,
      ),
    );
  }

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={rangeLabel(range)}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2" onClick={printX}>
              <Printer className="size-4" /> Laporan X
            </Button>
            <Button variant="secondary" className="gap-2" onClick={printRange}>
              <Printer className="size-4" /> Cetak Periode
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => {
                void exportReportExcel(db, range)
                  .then(() => toast.success("Laporan Excel diunduh."))
                  .catch(() => toast.error("Gagal membuat file Excel."));
              }}
            >
              <Download className="size-4" /> Excel
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <RangePicker range={range} onChange={setRange} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Omzet periode" value={rupiah(omzet)} />
          <Stat label="Jumlah transaksi" value={String(rangeSales.length)} />
          <Stat
            label="Rata-rata per transaksi"
            value={rupiah(rangeSales.length ? omzet / rangeSales.length : 0)}
          />
          <Stat
            label="Status kasir"
            value={shift ? `Terbuka · ${shift.userName}` : "Tertutup"}
            hint={shift ? `Kas awal ${rupiah(shift.openingCash)}` : "Lakukan check-in dulu"}
          />
        </div>

        <Tabs defaultValue="shift">
          <TabsList>
            <TabsTrigger value="shift">Shift Kasir</TabsTrigger>
            <TabsTrigger value="company">Company Report</TabsTrigger>
            <TabsTrigger value="closeout">Close Out</TabsTrigger>
            <TabsTrigger value="statistik">Statistik</TabsTrigger>
            <TabsTrigger value="qris">QRIS</TabsTrigger>
            <TabsTrigger value="transfer">Transfer & Kartu</TabsTrigger>
            <TabsTrigger value="kasir">Per Kasir</TabsTrigger>
            <TabsTrigger value="void">VOID</TabsTrigger>
          </TabsList>

          <TabsContent value="shift" className="mt-4">
            <ShiftPanel onPrint={show} />
          </TabsContent>
          <TabsContent value="company" className="mt-4">
            <CompanyReport range={range} />
          </TabsContent>
          <TabsContent value="closeout" className="mt-4">
            <CloseOutReport range={range} />
          </TabsContent>
          <TabsContent value="statistik" className="mt-4">
            <StatsReport range={range} />
          </TabsContent>
          <TabsContent value="qris" className="mt-4">
            <MethodReport
              range={range}
              title="Pembayaran QRIS"
              match={(m) => /qris|qr/i.test(m)}
            />
          </TabsContent>
          <TabsContent value="transfer" className="mt-4">
            <div className="space-y-4">
              <MethodReport
                range={range}
                title="Transfer Bank"
                match={(m) => /transfer|bank/i.test(m)}
              />
              <MethodReport
                range={range}
                title="Kartu / EDC"
                match={(m) => /kartu|card|edc|debit|kredit/i.test(m)}
              />
            </div>
          </TabsContent>
          <TabsContent value="kasir" className="mt-4">
            <CashierReport range={range} />
          </TabsContent>
          <TabsContent value="void" className="mt-4">
            <VoidReport range={range} />
          </TabsContent>
        </Tabs>
      </div>

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
