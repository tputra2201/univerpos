/** Ekspor laporan ke file Excel siap pakai. */
import type { PosDatabase, Sale } from "./types";
import { dateTime } from "./format";
import { kindLabel } from "./finance";
import { DAY_NAMES, businessDate, inRange, rangeLabel, type ReportRange } from "./report-range";
import { stockSummary } from "@/components/pos/stock-report";
import { salesOfShift, summarize, financeOfShift } from "./shift";

const isCash = (name: string) => /tunai|cash/i.test(name);

export async function exportReportExcel(db: PosDatabase, range: ReportRange) {
  const XLSX = await import("xlsx");
  const sales: Sale[] = db.sales.filter((s) => inRange(s.createdAt, range));
  const paid = sales.filter((s) => s.status === "paid");

  const ringkasan = [
    { Keterangan: "Periode", Nilai: rangeLabel(range) },
    { Keterangan: "Store", Nilai: db.settings.name },
    { Keterangan: "Jumlah transaksi", Nilai: paid.length },
    { Keterangan: "Subtotal", Nilai: paid.reduce((a, s) => a + s.subtotal, 0) },
    { Keterangan: "Diskon", Nilai: paid.reduce((a, s) => a + s.discount, 0) },
    { Keterangan: "Pajak", Nilai: paid.reduce((a, s) => a + s.tax, 0) },
    { Keterangan: "Biaya layanan", Nilai: paid.reduce((a, s) => a + s.service, 0) },
    { Keterangan: "Omzet bersih", Nilai: paid.reduce((a, s) => a + s.total, 0) },
  ];

  const transaksi = paid.map((s) => ({
    Waktu: dateTime(s.createdAt),
    Nomor: s.orderNo || s.code,
    Layanan: s.orderType ?? "",
    Meja: s.tableName,
    Pelanggan: s.customerName,
    Kasir: s.userName,
    Subtotal: s.subtotal,
    Diskon: s.discount,
    Pajak: s.tax,
    Layanan_Biaya: s.service,
    Total: s.total,
    Pembayaran: s.payments.map((p) => `${p.methodName}=${p.amount}`).join("; "),
  }));

  const prod = new Map<string, { qty: number; amount: number }>();
  paid.forEach((s) =>
    s.items.forEach((i) => {
      if (i.voided) return;
      const cur = prod.get(i.name) ?? { qty: 0, amount: 0 };
      cur.qty += i.qty;
      cur.amount += i.unitPrice * i.qty - i.discount;
      prod.set(i.name, cur);
    }),
  );
  const produk = [...prod.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([Nama, v]) => ({ Nama, Terjual: v.qty, Omzet: v.amount }));

  const kasirMap = new Map<string, { count: number; cash: number; nonCash: number; total: number }>();
  paid.forEach((s) => {
    const r = kasirMap.get(s.userName) ?? { count: 0, cash: 0, nonCash: 0, total: 0 };
    r.count += 1;
    r.total += s.total;
    s.payments.forEach((p) => (isCash(p.methodName) ? (r.cash += p.amount) : (r.nonCash += p.amount)));
    kasirMap.set(s.userName, r);
  });
  const kasir = [...kasirMap.entries()].map(([Kasir, v]) => ({
    Kasir,
    Nota: v.count,
    Tunai: v.cash,
    Non_Tunai: v.nonCash,
    Omzet: v.total,
  }));

  const metodeMap = new Map<string, number>();
  paid.forEach((s) =>
    s.payments.forEach((p) => metodeMap.set(p.methodName, (metodeMap.get(p.methodName) ?? 0) + p.amount)),
  );
  const metode = [...metodeMap.entries()].map(([Metode, Nilai]) => ({ Metode, Nilai }));

  const hariMap = new Map<string, { qty: number; amount: number }>();
  const jamMap = new Map<string, { qty: number; amount: number }>();
  paid.forEach((s) => {
    const at = new Date(s.createdAt);
    const dayName = DAY_NAMES[businessDate(at, range.openHour).getDay()] ?? "-";
    const d = hariMap.get(dayName) ?? { qty: 0, amount: 0 };
    d.qty += 1;
    d.amount += s.total;
    hariMap.set(dayName, d);
    const hourKey = `${String(at.getHours()).padStart(2, "0")}:00`;
    const h = jamMap.get(hourKey) ?? { qty: 0, amount: 0 };
    h.qty += 1;
    h.amount += s.total;
    jamMap.set(hourKey, h);
  });
  const statistik = [
    ...[...hariMap.entries()].map(([Nama, v]) => ({ Jenis: "Hari", Nama, Nota: v.qty, Omzet: v.amount })),
    ...[...jamMap.entries()].map(([Nama, v]) => ({ Jenis: "Jam", Nama, Nota: v.qty, Omzet: v.amount })),
  ];

  const closeOut = db.shifts
    .filter((s) => inRange(s.openedAt, range))
    .map((s) => {
      const expected = s.expectedCash ?? summarize(s, salesOfShift(db, s), financeOfShift(db, s)).expected;
      return {
        Kasir: s.userName,
        Buka: dateTime(s.openedAt),
        Tutup: s.closedAt ? dateTime(s.closedAt) : "Berjalan",
        Kas_Awal: s.openingCash,
        Kas_Sistem: expected,
        Kas_Fisik: s.closingCash ?? "",
        Selisih: s.closedAt ? (s.closingCash ?? 0) - expected : "",
        Modal_Berikutnya: s.nextStartCash ?? "",
        Catatan: s.balanceNote ?? "",
      };
    });

  const voidRows = sales.flatMap((s) =>
    s.status !== "paid"
      ? [
          {
            Waktu: dateTime(s.createdAt),
            Keterangan: `${s.status === "refund" ? "Refund" : "Void"} nota ${s.orderNo || s.code}`,
            Alasan: s.reason,
            Oleh: s.userName,
            Nilai: s.total,
          },
        ]
      : s.items
          .filter((i) => i.voided)
          .map((i) => ({
            Waktu: dateTime(s.createdAt),
            Keterangan: `${i.qty}x ${i.name} — ${s.orderNo || s.code}`,
            Alasan: i.voidReason ?? "",
            Oleh: i.voidedBy ?? s.userName,
            Nilai: i.unitPrice * i.qty - i.discount,
          })),
  );

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: object[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
  add("Ringkasan", ringkasan);
  add("Transaksi", transaksi);
  add("Produk Terlaku", produk);
  add("Metode Pembayaran", metode);
  add("Per Kasir", kasir);
  add("Statistik", statistik);
  add("Close Out", closeOut);
  add("VOID", voidRows);
  add(
    "Finance",
    (db.financeEntries ?? [])
      .filter((f) => inRange(f.createdAt, range))
      .map((f) => ({
        Waktu: dateTime(f.createdAt),
        Nomor: f.code,
        Jenis: kindLabel(f.kind),
        Kategori: f.categoryName,
        Item: f.itemName,
        Kasir: f.userName,
        Metode: f.methodName,
        Keterangan: f.note,
        Nominal: f.amount,
      })),
  );

  const stockMoves = db.stockMoves ?? [];
  add(
    "Stok",
    stockSummary(db.stockItems ?? [], stockMoves, range).map((r) => ({
      Bahan: r.name, Satuan: r.unit, Awal: r.awal, Masuk: r.masuk, Terpakai: r.terpakai,
      Kembali: r.kembali, Opname: r.opname, Akhir: r.akhir,
    })),
  );
  add(
    "Mutasi Stok",
    stockMoves
      .filter((m) => inRange(m.createdAt, range))
      .map((m) => ({
        Waktu: dateTime(m.createdAt),
        Bahan: m.stockName,
        Jenis: m.type,
        Nota: m.saleCode ?? "",
        Produk: (m.products ?? []).map((p) => `${p.qty}x ${p.name} (${p.used})`).join("; "),
        Keterangan: m.note,
        Pelaku: m.userName,
        Jumlah: m.qty,
        Saldo: m.balanceAfter ?? "",
      })),
  );

  const label = `${range.from}${range.from === range.to ? "" : "_" + range.to}`;
  XLSX.writeFile(wb, `laporan-${label}.xlsx`);
}
