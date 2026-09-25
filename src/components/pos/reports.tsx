/** Kumpulan laporan berbasis rentang waktu (hari usaha). */
import { useMemo } from "react";
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
import { salesOfShift, summarize } from "@/lib/pos/shift";
import type { Sale } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
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
    <div className={`flex flex-wrap justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
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
  const net = paid.reduce((a, s) => a + s.total, 0);
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
          <CardTitle className="text-base">Produk Terlaku</CardTitle>
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
        <CardTitle className="text-base">
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
        <CardTitle className="text-base">Transaksi per Kasir</CardTitle>
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
          <CardTitle className="text-base">Cash Close Out</CardTitle>
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
                    const expected = s.expectedCash ?? summarize(s, salesOfShift(db, s)).expected;
                    const diff = s.closedAt ? (s.closingCash ?? 0) - expected : 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.userName}</TableCell>
                        <TableCell className="whitespace-nowrap">{dateTime(s.openedAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.closedAt ? dateTime(s.closedAt) : "Berjalan"}
                        </TableCell>
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
        <CardTitle className="text-base">
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
