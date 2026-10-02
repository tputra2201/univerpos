import { lineCommission } from "@/lib/pos/commission";
import { saleAdjust } from "@/lib/pos/service-adjust";
/** Kumpulan laporan berbasis rentang waktu (hari usaha). */
import { getServiceTypes } from "@/lib/pos/seed";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePos } from "@/lib/pos/store";
import { dateTime, rupiah } from "@/lib/pos/format";
import {
  DAY_NAMES,
  businessDate,
  dayValue,
  inRange,
  rangeLabel,
  type RangeMode,
  type ReportRange,
} from "@/lib/pos/report-range";
import { salesOfShift, summarize, financeOfShift } from "@/lib/pos/shift";
import type { FinanceKind, Sale } from "@/lib/pos/types";
import { FINANCE_KINDS, kindLabel } from "@/lib/pos/finance";
import { Button } from "@/components/ui/button";
import { FinanceForm } from "@/components/pos/finance-form";
import { hasPerm as canDo } from "@/lib/pos/permissions";
import type { FinanceEntry } from "@/lib/pos/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MODES: { value: RangeMode; label: string }[] = [
  { value: "day", label: "Harian" },
  { value: "month", label: "Bulanan" },
  { value: "year", label: "Tahunan" },
  { value: "custom", label: "Rentang" },
];

export function RangePicker({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (r: ReportRange) => void;
}) {
  const today = businessDate(Date.now(), range.openHour);
  function setMode(mode: RangeMode) {
    const d = dayValue(today);
    if (mode === "day") onChange({ ...range, mode, from: d, to: d });
    else if (mode === "month")
      onChange({ ...range, mode, from: d.slice(0, 7), to: d.slice(0, 7) });
    else if (mode === "year")
      onChange({ ...range, mode, from: d.slice(0, 4), to: d.slice(0, 4) });
    else onChange({ ...range, mode, from: d, to: d });
  }
  const type = range.mode === "month" ? "month" : range.mode === "year" ? "number" : "date";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 py-4">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {MODES.map((m) => (
            <Button
              key={m.value}
              size="sm"
              variant={range.mode === m.value ? "default" : "secondary"}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{range.mode === "custom" ? "Dari" : "Periode"}</Label>
            <Input
              type={type}
              value={range.from}
              className="h-10 w-40"
              onChange={(e) =>
                onChange({
                  ...range,
                  from: e.target.value,
                  to: range.mode === "custom" ? range.to : e.target.value,
                })
              }
            />
          </div>
          {range.mode === "custom" && (
            <div className="space-y-1">
              <Label className="text-xs">Sampai</Label>
              <Input
                type="date"
                value={range.to}
                className="h-10 w-40"
                onChange={(e) => onChange({ ...range, to: e.target.value })}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = dayValue(today);
              onChange({ ...range, mode: "day", from: d, to: d });
            }}
          >
            Hari ini
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const y = new Date(today);
              y.setDate(y.getDate() - 1);
              const d = dayValue(y);
              onChange({ ...range, mode: "day", from: d, to: d });
            }}
          >
            Kemarin
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const a = new Date(today);
              a.setDate(a.getDate() - 6);
              onChange({ ...range, mode: "custom", from: dayValue(a), to: dayValue(today) });
            }}
          >
            7 hari
          </Button>
        </div>
        <p className="min-w-0 basis-full text-xs text-muted-foreground">{rangeLabel(range)}</p>
      </CardContent>
    </Card>
  );
}

export function useRangeSales(range: ReportRange): Sale[] {
  const { db } = usePos();
  return useMemo(
    () => db.sales.filter((s) => inRange(s.createdAt, range)),
    [db.sales, range],
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div data-print-row className={`flex flex-wrap justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle data-print-title className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">{children}</CardContent>
    </Card>
  );
}

function bump(map: Map<string, { qty: number; amount: number }>, key: string, amount: number, qty = 1) {
  const cur = map.get(key) ?? { qty: 0, amount: 0 };
  cur.qty += qty;
  cur.amount += amount;
  map.set(key, cur);
}

const byAmount = (a: [string, { amount: number }], b: [string, { amount: number }]) =>
  b[1].amount - a[1].amount;

/** Ringkasan eksekutif penjualan. */
export function CompanyReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const sales = useRangeSales(range);
  const paid = sales.filter((s) => s.status === "paid");

  const subtotal = paid.reduce((a, s) => a + s.subtotal, 0);
  const discount = paid.reduce((a, s) => a + s.discount, 0);
  const tax = paid.reduce((a, s) => a + s.tax, 0);
  const service = paid.reduce((a, s) => a + s.service, 0);
  const salesTotal = paid.reduce((a, s) => a + s.total, 0);
  const adjMap = new Map<string, number>();
  paid.forEach((s) => {
    const a = saleAdjust(db, s);
    if (a && a.amount) adjMap.set(a.label, (adjMap.get(a.label) ?? 0) + a.amount);
  });
  const adjTotal = [...adjMap.values()].reduce((a, b) => a + b, 0);
  const net = salesTotal - adjTotal;
  const voided = sales.filter((s) => s.status !== "paid");

  const methods = new Map<string, { qty: number; amount: number }>();
  paid.forEach((s) => s.payments.forEach((p) => bump(methods, p.methodName, p.amount)));

  const services = new Map<string, { qty: number; amount: number }>();
  paid.forEach((s) => bump(services, s.orderType || "Tanpa layanan", s.total));

  const catName = new Map(db.categories.map((c) => [c.id, c.name]));
  const prodCat = new Map(db.products.map((p) => [p.id, catName.get(p.categoryId) ?? "Lain-lain"]));
  const categories = new Map<string, { qty: number; amount: number }>();
  paid.forEach((s) =>
    s.items.forEach((i) => {
      if (i.voided) return;
      bump(
        categories,
        prodCat.get(i.productId) ?? "Lain-lain",
        i.unitPrice * i.qty - i.discount,
        i.qty,
      );
    }),
  );

  const fin = (db.financeEntries ?? []).filter((f) => inRange(f.createdAt, range));
  const fsum = (k: FinanceKind) => fin.filter((f) => f.kind === k).reduce((a, f) => a + f.amount, 0);
  const otherIncome = fsum("income");
  const expense = fsum("expense");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Pendapatan Bersih">
        <Row label="Penjualan kotor" value={rupiah(subtotal)} />
        {[...adjMap.entries()].map(([label, v]) => (
          <Row key={label} label={label} value={"-" + rupiah(v)} />
        ))}
        <Row label="Diskon" value={"-" + rupiah(discount)} />
        <Row label="Pajak & biaya layanan" value={rupiah(tax + service)} />
        <Row label="Omzet penjualan" value={rupiah(net)} />
        <Row label="Other Income" value={"+" + rupiah(otherIncome)} />
        <Row label="Expense (biaya operasional)" value={"-" + rupiah(expense)} />
        <Row label="Laba operasional bersih" value={rupiah(net + otherIncome - expense)} bold />
        <div className="pt-2 text-xs font-semibold uppercase text-muted-foreground">
          Mutasi kas non-operasional
        </div>
        <Row label="Paid-In" value={rupiah(fsum("paidin"))} />
        <Row label="Paid-Out" value={rupiah(fsum("paidout"))} />
      </Section>
      <Section title="Ringkasan Penjualan">
        <Row label="Jumlah transaksi" value={String(paid.length)} />
        <Row label="Subtotal produk" value={rupiah(subtotal)} />
        <Row label="Diskon" value={"-" + rupiah(discount)} />
        <Row label="Pajak" value={rupiah(tax)} />
        <Row label="Biaya layanan" value={rupiah(service)} />
        <Row label="Omzet bersih" value={rupiah(net)} bold />
        <Row
          label="Rata-rata per transaksi"
          value={rupiah(paid.length ? net / paid.length : 0)}
        />
        <Row label="Transaksi dibatalkan" value={String(voided.length)} />
      </Section>

      <Section title="Metode Pembayaran">
        {methods.size === 0 && <p className="text-muted-foreground">Belum ada pembayaran.</p>}
        {[...methods.entries()].sort(byAmount).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty}x)`} value={rupiah(v.amount)} />
        ))}
      </Section>

      <Section title="Omzet per Jenis Layanan">
        {services.size === 0 && <p className="text-muted-foreground">Belum ada penjualan.</p>}
        {[...services.entries()].sort(byAmount).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty} nota)`} value={rupiah(v.amount)} />
        ))}
      </Section>

      <Section title="Omzet per Kategori Produk">
        {categories.size === 0 && <p className="text-muted-foreground">Belum ada penjualan.</p>}
        {[...categories.entries()].sort(byAmount).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty} item)`} value={rupiah(v.amount)} />
        ))}
      </Section>
    </div>
  );
}

/** Produk terlaku, hari ramai/sepi, dan jam sibuk. */
export function StatsReport({ range }: { range: ReportRange }) {
  const sales = useRangeSales(range).filter((s) => s.status === "paid");

  const data = useMemo(() => {
    const products = new Map<string, { qty: number; amount: number }>();
    const days = new Map<string, { qty: number; amount: number }>();
    const hours = new Map<string, { qty: number; amount: number }>();
    const dates = new Map<string, { qty: number; amount: number }>();

    for (const s of sales) {
      const at = new Date(s.createdAt);
      const bd = businessDate(at, range.openHour);
      bump(days, DAY_NAMES[bd.getDay()] ?? "-", s.total);
      bump(hours, `${String(at.getHours()).padStart(2, "0")}:00`, s.total);
      bump(
        dates,
        bd.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        s.total,
      );
      for (const i of s.items) {
        if (i.voided) continue;
        bump(products, i.name, i.unitPrice * i.qty - i.discount, i.qty);
      }
    }
    const list = (m: Map<string, { qty: number; amount: number }>) => [...m.entries()];
    return {
      products: list(products).sort((a, b) => b[1].qty - a[1].qty || b[1].amount - a[1].amount),
      days: list(days).sort(byAmount),
      hours: list(hours).sort(byAmount),
      dates: list(dates).sort(byAmount),
    };
  }, [sales, range.openHour]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle data-print-title className="text-base">Produk Terlaku</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada produk terjual.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Terjual</TableHead>
                  <TableHead className="text-right">Omzet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.slice(0, 25).map(([name, v]) => (
                  <TableRow key={name}>
                    <TableCell className="max-w-48 truncate">{name}</TableCell>
                    <TableCell className="tabular text-right">{v.qty}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(v.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Section title="Hari Ramai & Sepi">
        {data.days.length === 0 && <p className="text-muted-foreground">Belum ada data.</p>}
        {data.days.map(([name, v], idx) => (
          <Row
            key={name}
            label={`${name} (${v.qty} nota)${idx === 0 ? " · paling ramai" : idx === data.days.length - 1 && data.days.length > 1 ? " · paling sepi" : ""}`}
            value={rupiah(v.amount)}
          />
        ))}
      </Section>

      <Section title="Jam Sibuk">
        {data.hours.length === 0 && <p className="text-muted-foreground">Belum ada data.</p>}
        {data.hours.map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty} nota)`} value={rupiah(v.amount)} />
        ))}
      </Section>

      <Section title="Tanggal Teromzet">
        {data.dates.length === 0 && <p className="text-muted-foreground">Belum ada data.</p>}
        {data.dates.slice(0, 20).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty} nota)`} value={rupiah(v.amount)} />
        ))}
      </Section>
    </div>
  );
}

/** Rincian pembayaran untuk satu kelompok metode (QRIS, transfer, kartu). */
export function MethodReport({
  range,
  title,
  match,
}: {
  range: ReportRange;
  title: string;
  match: (method: string) => boolean;
}) {
  const sales = useRangeSales(range).filter((s) => s.status === "paid");
  const rows = sales.flatMap((s) =>
    s.payments
      .filter((p) => match(p.methodName))
      .map((p, i) => ({
        key: `${s.id}-${i}`,
        at: s.createdAt,
        order: s.orderNo || s.code,
        method: p.methodName,
        cashier: s.userName,
        type: s.orderType || "-",
        amount: p.amount,
      })),
  );
  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle data-print-title className="text-base">
          {title} · {rows.length} transaksi · {rupiah(total)}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran pada periode ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Nomor</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Layanan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .sort((a, b) => (a.at < b.at ? 1 : -1))
                .map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="whitespace-nowrap">{dateTime(r.at)}</TableCell>
                    <TableCell>{r.order}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell>{r.cashier}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(r.amount)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Rekap transaksi per kasir. */
export function CashierReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const sales = useRangeSales(range).filter((s) => s.status === "paid");

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; total: number; cash: number; nonCash: number; discount: number }
    >();
    const bucket = (name: string) => {
      const key = name || "Tanpa nama";
      let row = map.get(key);
      if (!row) {
        row = { name: key, count: 0, total: 0, cash: 0, nonCash: 0, discount: 0 };
        map.set(key, row);
      }
      return row;
    };
    for (const s of db.shifts) if (inRange(s.openedAt, range)) bucket(s.userName);
    for (const s of sales) {
      const row = bucket(s.userName);
      row.count += 1;
      row.total += s.total;
      row.discount += s.discount;
      for (const p of s.payments) {
        if (/tunai|cash/i.test(p.methodName)) row.cash += p.amount;
        else row.nonCash += p.amount;
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sales, db.shifts, range]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle data-print-title className="text-base">Transaksi per Kasir</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kasir</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                <TableHead className="text-right">Tunai</TableHead>
                <TableHead className="text-right">Non-tunai</TableHead>
                <TableHead className="text-right">Diskon</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="tabular text-right">{r.count}</TableCell>
                  <TableCell className="tabular text-right">{rupiah(r.cash)}</TableCell>
                  <TableCell className="tabular text-right">{rupiah(r.nonCash)}</TableCell>
                  <TableCell className="tabular text-right">{rupiah(r.discount)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">
                    {rupiah(r.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Laporan close out kasir pada rentang waktu. */
export function CloseOutReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const shifts = db.shifts.filter((s) => inRange(s.openedAt, range));
  const days = (db.businessDays ?? []).filter((d) => inRange(d.openedAt, range));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle data-print-title className="text-base">Cash Close Out</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada shift pada periode ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Buka</TableHead>
                  <TableHead>Tutup</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                  <TableHead className="text-right">Tunai</TableHead>
                  <TableHead className="text-right">Non-tunai</TableHead>
                  <TableHead className="text-right">Finance kas</TableHead>
                  <TableHead className="text-right">Kas awal</TableHead>
                  <TableHead className="text-right">Sistem</TableHead>
                  <TableHead className="text-right">Fisik</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts
                  .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
                  .map((s) => {
                    const sm = summarize(s, salesOfShift(db, s), financeOfShift(db, s));
                    const expected = s.expectedCash ?? sm.expected;
                    const diff = s.closedAt ? (s.closingCash ?? 0) - expected : 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.userName}</TableCell>
                        <TableCell className="whitespace-nowrap">{dateTime(s.openedAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.closedAt ? dateTime(s.closedAt) : "Berjalan"}
                        </TableCell>
                        <TableCell className="tabular text-right">{sm.count}</TableCell>
                        <TableCell className="tabular text-right">{rupiah(sm.omzet)}</TableCell>
                        <TableCell className="tabular text-right">{rupiah(sm.cashSales)}</TableCell>
                        <TableCell className="tabular text-right">{rupiah(sm.nonCashSales)}</TableCell>
                        <TableCell className="tabular text-right">{rupiah(sm.financeCash)}</TableCell>
                        <TableCell className="tabular text-right">
                          {rupiah(s.openingCash)}
                        </TableCell>
                        <TableCell className="tabular text-right">{rupiah(expected)}</TableCell>
                        <TableCell className="tabular text-right">
                          {s.closedAt ? rupiah(s.closingCash ?? 0) : "-"}
                        </TableCell>
                        <TableCell
                          className={`tabular text-right ${
                            !s.closedAt
                              ? ""
                              : diff === 0
                                ? ""
                                : diff > 0
                                  ? "font-semibold text-emerald-600"
                                  : "font-semibold text-destructive"
                          }`}
                        >
                          {s.closedAt ? rupiah(diff) : "-"}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">{s.balanceNote || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Section title="Hari Usaha (End of Day)">
        {days.length === 0 && <p className="text-muted-foreground">Belum ada hari usaha tercatat.</p>}
        {days.map((d) => (
          <div key={d.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
            <div className="min-w-0">
              <p className="font-semibold">{dateTime(d.openedAt)}</p>
              <p className="break-words text-xs text-muted-foreground">
                {d.closedAt ? `Ditutup ${dateTime(d.closedAt)} oleh ${d.closedBy ?? "-"}` : "Masih berjalan"}
                {d.note ? ` · ${d.note}` : ""}
              </p>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

/** Audit: nota dibatalkan/refund dan catatan Finance yang dihapus. */
export function DeletedReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const sales = db.sales
    .filter((s) => (s.status === "void" || s.status === "refund") && inRange(s.cancelledAt ?? s.createdAt, range))
    .sort((a, b) => ((b.cancelledAt ?? b.createdAt) < (a.cancelledAt ?? a.createdAt) ? -1 : 1));
  const fins = (db.deletedFinance ?? [])
    .filter((f) => inRange(f.deletedAt, range))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  const saleTotal = sales.reduce((a, s) => a + s.total, 0);
  const finTotal = fins.reduce((a, f) => a + f.amount, 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle data-print-title className="text-base">
            Transaksi Dibatalkan / Refund · {sales.length} nota · {rupiah(saleTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada transaksi dibatalkan pada periode ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu batal</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kasir nota</TableHead>
                  <TableHead>Dibatalkan oleh</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(s.cancelledAt ?? s.createdAt)}</TableCell>
                    <TableCell className="font-mono">{s.orderNo || s.code}</TableCell>
                    <TableCell>{s.status === "void" ? "Void" : "Refund"}</TableCell>
                    <TableCell>{s.userName}</TableCell>
                    <TableCell>{s.cancelledBy || "-"}</TableCell>
                    <TableCell>{s.reason || "-"}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle data-print-title className="text-base">
            Finance Dihapus · {fins.length} catatan · {rupiah(finTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {fins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada catatan Finance dihapus pada periode ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu hapus</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Dicatat</TableHead>
                  <TableHead>Dihapus oleh</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fins.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(f.deletedAt)}</TableCell>
                    <TableCell className="font-mono">{f.code}</TableCell>
                    <TableCell>{kindLabel(f.kind)}</TableCell>
                    <TableCell>{f.categoryName} · {f.itemName} · {f.methodName}</TableCell>
                    <TableCell className="whitespace-nowrap">{f.userName} · {dateTime(f.createdAt)}</TableCell>
                    <TableCell>{f.deletedBy}</TableCell>
                    <TableCell>{f.deleteReason}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(f.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Laporan pembatalan nota dan item. */
export function VoidReport({ range }: { range: ReportRange }) {
  const sales = useRangeSales(range);
  const rows = sales.flatMap((s) => {
    if (s.status === "void" || s.status === "refund")
      return [
        {
          key: s.id,
          at: s.createdAt,
          title: `${s.status === "refund" ? "Refund" : "Void"} nota ${s.orderNo || s.code}`,
          reason: s.reason || "-",
          by: s.userName,
          amount: s.total,
        },
      ];
    return s.items
      .filter((i) => i.voided)
      .map((i) => ({
        key: s.id + i.lineId,
        at: s.createdAt,
        title: `${i.qty}× ${i.name} — ${s.orderNo || s.code}`,
        reason: i.voidReason ?? "-",
        by: i.voidedBy ?? s.userName,
        amount: i.unitPrice * i.qty - i.discount,
      }));
  });
  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle data-print-title className="text-base">
          Laporan VOID · {rows.length} kejadian · {rupiah(total)}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada pembatalan pada periode ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .sort((a, b) => (a.at < b.at ? 1 : -1))
                .map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="whitespace-nowrap">{dateTime(r.at)}</TableCell>
                    <TableCell className="max-w-56 truncate">{r.title}</TableCell>
                    <TableCell className="max-w-40 truncate">{r.reason}</TableCell>
                    <TableCell>{r.by}</TableCell>
                    <TableCell className="tabular text-right text-destructive">
                      {rupiah(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Laporan Finance: ringkasan 4 jenis + detail per jenis. */
export function FinanceReport({ range, kind }: { range: ReportRange; kind?: FinanceKind }) {
  const { db, currentUser } = usePos();
  const canEdit = canDo(db.settings, currentUser?.role, "finance.manage");
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const all = (db.financeEntries ?? []).filter((f) => inRange(f.createdAt, range)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = kind ? all.filter((f) => f.kind === kind) : all;
  const total = (k: FinanceKind) => all.filter((f) => f.kind === k).reduce((a, f) => a + f.amount, 0);
  const net = total("income") - total("expense") + total("paidin") - total("paidout");
  const byCat = new Map<string, { qty: number; amount: number }>();
  rows.forEach((f) => bump(byCat, `${kindLabel(f.kind)} · ${f.categoryName}`, f.amount));
  return (
    <div className="space-y-4">
      {!kind && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {FINANCE_KINDS.map((k) => (
            <div key={k.kind} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="tabular mt-1 text-xl font-extrabold">{rupiah(total(k.kind))}</p>
            </div>
          ))}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Cash Flow</p>
            <p className="tabular mt-1 text-xl font-extrabold text-primary">{rupiah(net)}</p>
          </div>
        </div>
      )}
      <Section title="Per Kategori">
        {byCat.size === 0 && <p className="text-muted-foreground">Belum ada catatan.</p>}
        {[...byCat.entries()].sort(byAmount).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty}x)`} value={rupiah(v.amount)} />
        ))}
      </Section>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal/Jam</TableHead>
                <TableHead>Nomor</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                {canEdit && <TableHead data-noprint />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Belum ada catatan pada periode ini.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap">{dateTime(f.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{f.code}</TableCell>
                  <TableCell>{kindLabel(f.kind)}</TableCell>
                  <TableCell>{f.categoryName}</TableCell>
                  <TableCell>{f.itemName}</TableCell>
                  <TableCell>{f.userName}</TableCell>
                  <TableCell>{f.methodName}</TableCell>
                  <TableCell>{f.note}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{rupiah(f.amount)}</TableCell>
                  {canEdit && (
                    <TableCell data-noprint>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(f)}>Ubah</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {canEdit && (
        <FinanceForm open={editing !== null} kind={editing?.kind ?? "expense"} entry={editing} onOpenChange={(v) => !v && setEditing(null)} />
      )}
    </div>
  );
}

/** Laporan order online per aplikasi (Grab, Shopee, GoFood, dll). */
export function OnlineOrderReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const names = new Set([
    ...(db.onlineChannels ?? []).map((c) => c.name),
    ...getServiceTypes(db).filter((s) => s.kind === "online").map((s) => s.name),
  ]);
  const sales = useRangeSales(range).filter(
    (s) => s.status === "paid" && !!s.orderType && names.has(s.orderType),
  );
  const byCh = new Map<string, { qty: number; amount: number }>();
  sales.forEach((s) => bump(byCh, s.orderType!, s.total));
  const total = sales.reduce((a, s) => a + s.total, 0);
  return (
    <div className="space-y-4">
      <Section title={`Order Online · ${sales.length} transaksi · ${rupiah(total)}`}>
        {byCh.size === 0 && <p className="text-muted-foreground">Belum ada order online pada periode ini.</p>}
        {[...byCh.entries()].sort(byAmount).map(([name, v]) => (
          <Row key={name} label={`${name} (${v.qty} nota)`} value={rupiah(v.amount)} />
        ))}
      </Section>
      {sales.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Aplikasi</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...sales].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(s.createdAt)}</TableCell>
                    <TableCell>{s.orderNo || s.code}</TableCell>
                    <TableCell>{s.orderType}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>{s.userName}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type CommissionJob = {
  key: string;
  createdAt: string;
  code: string;
  customer: string;
  name: string;
  amount: number;
  commission: number;
  duration?: number | undefined;
};

/** Komisi staf pelaksana: dihitung dari setelan komisi produk, hanya untuk staf yang komisinya aktif. */
export function CommissionReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const sales = useRangeSales(range).filter((s) => s.status === "paid");
  const [detail, setDetail] = useState<string | null>(null);
  const off = new Set(db.staff.filter((s) => s.commissionEnabled === false).map((s) => s.name));
  const staffBy = new Map(db.staff.map((s) => [s.name, s]));
  const products = new Map(db.products.map((p) => [p.id, p]));
  const byStaff = new Map<string, { jobs: number; sales: number; commission: number; list: CommissionJob[] }>();
  for (const s of sales) {
    for (const l of s.items) {
      if (!l.staffName || l.voided || off.has(l.staffName)) continue;
      const p = products.get(l.productId);
      const net = Math.max(0, l.unitPrice * l.qty - (l.discount || 0));
      const c = lineCommission(l, p, staffBy.get(l.staffName));
      const cur = byStaff.get(l.staffName) ?? { jobs: 0, sales: 0, commission: 0, list: [] };
      cur.jobs += l.qty;
      cur.sales += net;
      cur.commission += c;
      cur.list.push({
        key: `${s.id}-${l.lineId}`,
        createdAt: s.createdAt,
        code: s.orderNo || s.code,
        customer: s.customerName || s.tableName || "-",
        name: `${l.name}${l.variantName ? ` (${l.variantName})` : ""}${l.qty > 1 ? ` ×${l.qty}` : ""}`,
        amount: net,
        commission: c,
        duration: p?.durationMinutes ? p.durationMinutes * l.qty : undefined,
      });
      byStaff.set(l.staffName, cur);
    }
  }
  const rows = [...byStaff.entries()].sort((a, b) => b[1].commission - a[1].commission);
  const total = rows.reduce((a, [, v]) => a + v.commission, 0);
  const active = detail ? byStaff.get(detail) : undefined;
  const jobs = [...(active?.list ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-4">
      <Section title={`Komisi Staf · ${rupiah(total)}`}>
        {rows.length === 0 && <p className="text-muted-foreground">Belum ada pekerjaan berkomisi pada periode ini.</p>}
        {rows.map(([name, v]) => (
          <button
            key={name}
            type="button"
            onClick={() => setDetail(name)}
            className="w-full space-y-1 border-b pb-2 text-left last:border-0 hover:opacity-80"
          >
            <Row label={name} value={rupiah(v.commission)} bold />
            <Row label={`${v.jobs} pekerjaan · nilai layanan`} value={rupiah(v.sales)} />
            <p className="text-xs text-primary">Lihat rincian pekerjaan</p>
          </button>
        ))}
        {off.size > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">Tanpa komisi: {[...off].join(", ")}</p>
        )}
      </Section>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rincian Pekerjaan · {detail}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Pekerjaan</p>
                <p className="tabular font-bold">{active.jobs}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nilai layanan</p>
                <p className="tabular font-bold">{rupiah(active.sales)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total komisi</p>
                <p className="tabular font-bold text-primary">{rupiah(active.commission)}</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal/Jam</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Layanan / Produk</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Komisi</TableHead>
                  <TableHead className="text-right">Durasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Belum ada pekerjaan.
                    </TableCell>
                  </TableRow>
                )}
                {jobs.map((j) => (
                  <TableRow key={j.key}>
                    <TableCell className="whitespace-nowrap">{dateTime(j.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{j.code}</TableCell>
                    <TableCell>{j.customer}</TableCell>
                    <TableCell>{j.name}</TableCell>
                    <TableCell className="tabular text-right">{rupiah(j.amount)}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{rupiah(j.commission)}</TableCell>
                    <TableCell className="tabular text-right">{j.duration ? `${j.duration} mnt` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Item expense diurutkan dari nominal terbesar. */
export function ExpenseItemReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const rows = (db.financeEntries ?? []).filter((f) => f.kind === "expense" && inRange(f.createdAt, range));
  const map = new Map<string, { qty: number; amount: number }>();
  rows.forEach((f) => bump(map, `${f.itemName} · ${f.categoryName}`, f.amount));
  const total = rows.reduce((a, f) => a + f.amount, 0);
  const sorted = [...map.entries()].sort(byAmount);
  return (
    <Section title={`Item Expense Terbesar · ${rupiah(total)}`}>
      {sorted.length === 0 && <p className="text-muted-foreground">Belum ada expense pada periode ini.</p>}
      {sorted.map(([name, v], i) => (
        <Row
          key={name}
          label={`${i + 1}. ${name} (${v.qty}x · ${total ? ((v.amount / total) * 100).toFixed(1) : 0}%)`}
          value={rupiah(v.amount)}
        />
      ))}
    </Section>
  );
}
