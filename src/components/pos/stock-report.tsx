/** Laporan stok periodik + mutasi detail per nota dan pelaku. */
import { useMemo, useState } from "react";
import { usePos } from "@/lib/pos/store";
import { dateTime } from "@/lib/pos/format";
import { rangeBounds, type ReportRange } from "@/lib/pos/report-range";
import type { StockMove } from "@/lib/pos/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPE_LABEL: Record<StockMove["type"], string> = {
  sale: "Penjualan",
  return: "Void/Refund",
  in: "Barang masuk",
  opname: "Opname",
};
const n = (v: number) => (Math.round(v * 1000) / 1000).toLocaleString("id-ID");

export function stockSummary(
  items: { id: string; name: string; unit: string; qty: number }[],
  moves: StockMove[],
  range: ReportRange,
) {
  const { start, end } = rangeBounds(range);
  return items.map((it) => {
    const mine = moves.filter((m) => m.stockId === it.id);
    const t = (m: StockMove) => new Date(m.createdAt).getTime();
    const after = mine.filter((m) => t(m) >= end).reduce((a, m) => a + m.qty, 0);
    const inside = mine.filter((m) => t(m) >= start && t(m) < end);
    const sum = (k: StockMove["type"]) => inside.filter((m) => m.type === k).reduce((a, m) => a + m.qty, 0);
    const endBal = it.qty - after;
    const change = inside.reduce((a, m) => a + m.qty, 0);
    return {
      id: it.id,
      name: it.name,
      unit: it.unit,
      awal: endBal - change,
      masuk: sum("in"),
      terpakai: -sum("sale"),
      kembali: sum("return"),
      opname: sum("opname"),
      akhir: endBal,
    };
  });
}

export function StockReport({ range }: { range: ReportRange }) {
  const { db } = usePos();
  const [q, setQ] = useState("");
  const items = db.stockItems ?? [];
  const summary = useMemo(() => stockSummary(items, db.stockMoves ?? [], range), [items, db.stockMoves, range]);
  const moves = useMemo(() => {
    const { start, end } = rangeBounds(range);
    const s = q.trim().toLowerCase();
    return (db.stockMoves ?? [])
      .filter((m) => {
        const t = new Date(m.createdAt).getTime();
        return t >= start && t < end;
      })
      .filter(
        (m) =>
          !s ||
          [m.stockName, m.saleCode ?? "", m.userName, m.note, ...(m.products ?? []).map((p) => p.name)]
            .join(" ")
            .toLowerCase()
            .includes(s),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.stockMoves, range, q]);
  const unitOf = (id: string) => items.find((i) => i.id === id)?.unit ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle data-print-title>Saldo Stok Periode</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada bahan di Setup → Stok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bahan</TableHead>
                  <TableHead className="text-right">Awal</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Terpakai</TableHead>
                  <TableHead className="text-right">Kembali</TableHead>
                  <TableHead className="text-right">Opname</TableHead>
                  <TableHead className="text-right">Akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name} ({r.unit})</TableCell>
                    <TableCell className="tabular text-right">{n(r.awal)}</TableCell>
                    <TableCell className="tabular text-right">{n(r.masuk)}</TableCell>
                    <TableCell className="tabular text-right">{n(r.terpakai)}</TableCell>
                    <TableCell className="tabular text-right">{n(r.kembali)}</TableCell>
                    <TableCell className="tabular text-right">{n(r.opname)}</TableCell>
                    <TableCell className="tabular text-right font-bold">{n(r.akhir)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle data-print-title>Mutasi & Pemakaian Bahan</CardTitle>
          <Input
            placeholder="Cari bahan, nomor nota, produk, atau pelaku…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {moves.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada mutasi pada periode ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Bahan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Produk penyebab</TableHead>
                  <TableHead>Pelaku</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(m.createdAt)}</TableCell>
                    <TableCell>{m.stockName}</TableCell>
                    <TableCell>{TYPE_LABEL[m.type]}</TableCell>
                    <TableCell>{m.saleCode ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      {m.products?.length
                        ? m.products.map((p) => `${p.qty}x ${p.name} (${n(p.used)})`).join(", ")
                        : m.note || "-"}
                    </TableCell>
                    <TableCell>{m.userName || "-"}</TableCell>
                    <TableCell className={`tabular text-right ${m.qty < 0 ? "text-destructive" : ""}`}>
                      {m.qty > 0 ? "+" : ""}
                      {n(m.qty)} {unitOf(m.stockId)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {m.balanceAfter != null ? n(m.balanceAfter) : "-"}
                    </TableCell>
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
