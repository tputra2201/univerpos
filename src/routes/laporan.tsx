import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import {
  CashierReport,
  CloseOutReport,
  CompanyReport,
  ServiceAdjustReport,
  FinanceReport,
  MethodReport,
  OnlineOrderReport,
  CommissionReport,
  ExpenseItemReport,
  RangePicker,
  StatsReport,
  VoidReport,
  DeletedReport,
} from "@/components/pos/reports";
import { usePos } from "@/lib/pos/store";
import { CategorySalesReport } from "@/components/pos/category-sales-report";
import { StockReport } from "@/components/pos/stock-report";
import { hasPerm } from "@/lib/pos/permissions";
import { FINANCE_KINDS } from "@/lib/pos/finance";
import { dateTime, rupiah } from "@/lib/pos/format";
import { buildReport, buildTabReport } from "@/lib/pos/receipt";
import { blocksFromElement } from "@/lib/pos/report-print";
import { printerFor } from "@/lib/pos/printers";
import { exportTabExcel, exportTabPdf } from "@/lib/pos/report-export";
import { defaultRange, inRange, rangeLabel, type ReportRange } from "@/lib/pos/report-range";
import { activeShiftOf, salesOfShift, summarize, financeOfShift } from "@/lib/pos/shift";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan & Shift Kasir — POS UKM" },
      {
        name: "description",
        content:
          "Check-in dan close out kasir, End of Day, serta laporan Total Sales, produk terlaku, hari ramai, QRIS, dan per kasir dengan rentang waktu.",
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
  const { db, currentUser } = usePos();
  const canFinance = hasPerm(db.settings, currentUser?.role, "finance.view");
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [printTitle, setPrintTitle] = useState("Laporan");
  const [range, setRange] = useState<ReportRange>(() => defaultRange(db.settings));

  const [tab, setTab] = useState("company");
  const tabLabel =
    TAB_LABEL[tab] ?? FINANCE_KINDS.find((k) => `fin-${k.kind}` === tab)?.label ?? "Laporan";
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
    const sum = summarize(shift, sales, financeOfShift(db, shift));
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

  function exportTab(kind: "excel" | "pdf") {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!panel) return;
    const run = kind === "excel" ? exportTabExcel : exportTabPdf;
    void run(panel, db.settings.name, tabLabel, rangeLabel(range), range)
      .then(() => toast.success(`${tabLabel} (${kind === "excel" ? "Excel" : "PDF"}) diunduh.`))
      .catch(() => toast.error("Gagal membuat file."));
  }

  function printRange() {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!panel) return;
    const width = printerFor(db, "report").paperWidth;
    show(
      `Cetak ${tabLabel}`,
      buildTabReport(tabLabel, rangeLabel(range), blocksFromElement(panel), db, width),
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
              <Printer className="size-4" /> Cetak {tabLabel}
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => exportTab("excel")}>
              <Download className="size-4" /> Excel
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => exportTab("pdf")}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1.5">
            <TabsTrigger className={TAB_CLS} value="company">Company Report</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="closeout">Close Out</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="kategori">Sales Report</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="statistik">Statistik</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="qris">QRIS</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="transfer">Transfer & Kartu</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="online">Order Online</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="transaksi">Transaksi</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="kasir">Per Kasir</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="adjust">Komisi & Diskon</TabsTrigger>
            {db.staff.length > 0 && hasPerm(db.settings, currentUser?.role, "report.commission") && (
              <TabsTrigger className={TAB_CLS} value="komisi">Komisi Staf</TabsTrigger>
            )}

            {hasPerm(db.settings, currentUser?.role, "stock.view") && <TabsTrigger className={TAB_CLS} value="stok">Stok</TabsTrigger>}
            <TabsTrigger className={TAB_CLS} value="void">VOID</TabsTrigger>
            <TabsTrigger className={TAB_CLS} value="dihapus">Dihapus & Batal</TabsTrigger>
            {canFinance && <TabsTrigger className={TAB_CLS} value="finance">Finance</TabsTrigger>}
            {canFinance &&
              FINANCE_KINDS.map((k) => (
                <TabsTrigger className={TAB_CLS} key={k.kind} value={`fin-${k.kind}`}>
                  {k.label}
                </TabsTrigger>
              ))}
          </TabsList>

          <div className="mt-4 space-y-4">
          <RangePicker range={range} onChange={setRange} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total Sales" value={rupiah(omzet)} />
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

          </div>

          <TabsContent value="adjust" className="mt-4">
            <ServiceAdjustReport range={range} />
          </TabsContent>
          <TabsContent value="company" className="mt-4">
            <CompanyReport range={range} />
          </TabsContent>
          <TabsContent value="closeout" className="mt-4">
            <CloseOutReport range={range} />
          </TabsContent>
          <TabsContent value="kategori" className="mt-4">
            <CategorySalesReport range={range} />
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
          <TabsContent value="online" className="mt-4">
            <OnlineOrderReport range={range} />
          </TabsContent>
          <TabsContent value="transaksi" className="mt-4">
            <TransactionList range={range} />
          </TabsContent>
          <TabsContent value="kasir" className="mt-4">
            <CashierReport range={range} />
          </TabsContent>
          <TabsContent value="komisi" className="mt-4">
            <CommissionReport range={range} />
          </TabsContent>
          <TabsContent value="stok" className="mt-4">
            <StockReport range={range} />
          </TabsContent>
          <TabsContent value="void" className="mt-4">
            <VoidReport range={range} />
          </TabsContent>
          <TabsContent value="dihapus" className="mt-4">
            <DeletedReport range={range} />
          </TabsContent>
          <TabsContent value="finance" className="mt-4">
            <FinanceReport range={range} />
          </TabsContent>
          {FINANCE_KINDS.map((k) => (
            <TabsContent key={k.kind} value={`fin-${k.kind}`} className="mt-4 space-y-4">
              {k.kind === "expense" && <ExpenseItemReport range={range} />}
              <FinanceReport range={range} kind={k.kind} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <PrintPreview
        open={printLines !== null}
        onOpenChange={(v) => !v && setPrintLines(null)}
        title={printTitle}
        lines={printLines ?? []}
        role="report"
      />
    </div>
  );
}

const TAB_CLS =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-md";

const TAB_LABEL: Record<string, string> = {
  company: "Company Report",
  adjust: "Komisi & Diskon",
  closeout: "Close Out",
  kategori: "Sales Report",
  statistik: "Statistik",
  qris: "QRIS",
  transfer: "Transfer & Kartu",
  online: "Order Online",
  transaksi: "Transaksi",
  kasir: "Per Kasir",
  stok: "Stok",
  void: "VOID",
  dihapus: "Dihapus & Batal",
  finance: "Finance",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TransactionList({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const rows = db.sales
    .filter((s) => inRange(s.createdAt, range))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-semibold">Daftar Transaksi ({rows.length})</div>
      {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada transaksi di periode ini.</p>}
      <div className="divide-y">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-mono font-semibold">{s.code}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(s.createdAt)} · {s.userName}
                {s.customerName && ` · ${s.customerName}`} · {s.payments.map((p) => p.methodName).join(" + ")}
              </p>
            </div>
            <div className="text-right">
              <p className={`tabular font-bold ${s.status !== "paid" ? "line-through text-muted-foreground" : ""}`}>{rupiah(s.total)}</p>
              {s.status !== "paid" && <p className="text-xs text-destructive">{s.status === "void" ? "Dibatalkan" : "Refund"}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
