import type { PosDatabase, PrinterSettings, Sale, StoreSettings } from "./types";
import { rupiah } from "./format";

export type ReceiptKind = "receipt" | "bill" | "order" | "label" | "report";

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function center(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return " ".repeat(left) + text;
}

function twoCol(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  if (left.length + right.length + 1 > width) {
    return left.slice(0, width - right.length - 1) + " " + right;
  }
  return left + " ".repeat(space) + right;
}

function divider(width: number, char = "-"): string {
  return char.repeat(width);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + (line ? " " : "") + w).length > width) {
      if (line) lines.push(line);
      line = w.length > width ? w.slice(0, width) : w;
    } else {
      line += (line ? " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function money(value: number): string {
  return Math.round(value).toLocaleString("id-ID");
}

function headerLines(
  settings: StoreSettings,
  printer: PrinterSettings,
  width: number,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < printer.marginTop; i++) out.push("");
  out.push(center(settings.name.toUpperCase(), width));
  if (printer.header1) out.push(center(printer.header1, width));
  if (printer.header2) out.push(center(printer.header2, width));
  if (settings.address) wrap(settings.address, width).forEach((l) => out.push(center(l, width)));
  if (settings.phone) out.push(center(settings.phone, width));
  return out;
}

function itemLines(sale: Sale, width: number, withPrice: boolean): string[] {
  const out: string[] = [];
  for (const item of sale.items) {
    const title = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    wrap(title, width).forEach((l) => out.push(l));
    if (withPrice) {
      out.push(
        twoCol(
          `  ${item.qty} x ${money(item.unitPrice)}`,
          money(item.qty * item.unitPrice - item.discount),
          width,
        ),
      );
      if (item.discount > 0) out.push(twoCol("  Diskon item", "-" + money(item.discount), width));
    } else {
      out.push(`  Qty: ${item.qty}`);
    }
    if (item.note) wrap("  * " + item.note, width).forEach((l) => out.push(l));
    if (item.staffName) out.push(`  Oleh: ${item.staffName}`);
  }
  return out;
}

function footerLines(printer: PrinterSettings, width: number): string[] {
  const out: string[] = [];
  if (printer.footer) {
    out.push("");
    wrap(printer.footer, width).forEach((l) => out.push(center(l, width)));
  }
  for (let i = 0; i < printer.marginBottom; i++) out.push("");
  return out;
}

export function buildReceipt(
  kind: Exclude<ReceiptKind, "report">,
  sale: Sale,
  settings: StoreSettings,
  printer: PrinterSettings,
): string[] {
  const width = printer.paperWidth;

  if (kind === "label") {
    const out: string[] = [];
    sale.items.forEach((item, idx) => {
      if (idx > 0) out.push(divider(width, "="));
      out.push(center(sale.customerName || sale.tableName || sale.code, width));
      wrap(item.variantName ? `${item.name} - ${item.variantName}` : item.name, width).forEach(
        (l) => out.push(l),
      );
      if (item.note) wrap("Note: " + item.note, width).forEach((l) => out.push(l));
      out.push(new Date(sale.createdAt).toLocaleString("id-ID"));
      out.push("");
    });
    return out;
  }

  if (kind === "order") {
    const out: string[] = [];
    out.push(center("PESANAN DAPUR", width));
    out.push(divider(width, "="));
    out.push(twoCol(sale.tableName || sale.customerName || "Take Away", sale.code, width));
    out.push(new Date(sale.createdAt).toLocaleString("id-ID"));
    out.push(divider(width));
    itemLines(sale, width, false).forEach((l) => out.push(l));
    out.push(divider(width));
    for (let i = 0; i < printer.marginBottom; i++) out.push("");
    return out;
  }

  const out = headerLines(settings, printer, width);
  out.push(divider(width, "="));
  if (kind === "bill") {
    out.push(center("BILL / TAGIHAN SEMENTARA", width));
    out.push(divider(width, "="));
  }
  out.push(twoCol("No", sale.code, width));
  out.push(twoCol("Kasir", sale.userName, width));
  out.push(twoCol("Waktu", new Date(sale.createdAt).toLocaleString("id-ID"), width));
  if (sale.tableName) out.push(twoCol("Meja", sale.tableName, width));
  if (sale.customerName) out.push(twoCol("Pelanggan", sale.customerName, width));
  out.push(divider(width));
  itemLines(sale, width, true).forEach((l) => out.push(l));
  out.push(divider(width));
  out.push(twoCol("Subtotal", money(sale.subtotal), width));
  if (sale.discount > 0) out.push(twoCol("Diskon", "-" + money(sale.discount), width));
  if (sale.service > 0) out.push(twoCol(`Layanan`, money(sale.service), width));
  if (sale.tax > 0) out.push(twoCol(`Pajak`, money(sale.tax), width));
  out.push(twoCol("TOTAL", money(sale.total), width));

  if (kind === "receipt") {
    out.push(divider(width));
    sale.payments.forEach((p) => out.push(twoCol(p.methodName, money(p.amount), width)));
    out.push(twoCol("Kembalian", money(sale.change), width));
  }
  if (sale.status !== "paid") {
    out.push(divider(width, "="));
    out.push(center(sale.status === "void" ? "DIBATALKAN" : "REFUND", width));
    if (sale.reason) wrap(sale.reason, width).forEach((l) => out.push(center(l, width)));
  }
  footerLines(printer, width).forEach((l) => out.push(l));
  return out;
}

export interface ReportInput {
  title: string;
  from: string;
  to: string;
  sales: Sale[];
  openingCash?: number | null;
  closingCash?: number | null;
}

export function buildReport(
  input: ReportInput,
  db: PosDatabase,
): string[] {
  const width = db.printer.paperWidth;
  const out = headerLines(db.settings, db.printer, width);
  out.push(divider(width, "="));
  out.push(center(input.title, width));
  out.push(center(`${input.from} s/d ${input.to}`, width));
  out.push(divider(width));

  const valid = input.sales.filter((s) => s.status === "paid");
  const omzet = valid.reduce((sum, s) => sum + s.total, 0);
  out.push(twoCol("Total Transaksi", String(valid.length), width));
  out.push(twoCol("Total Omzet", money(omzet), width));
  out.push(divider(width));
  out.push("Metode Pembayaran");
  const byMethod = new Map<string, number>();
  valid.forEach((s) =>
    s.payments.forEach((p) => byMethod.set(p.methodName, (byMethod.get(p.methodName) ?? 0) + p.amount)),
  );
  byMethod.forEach((amount, name) => out.push(twoCol("  " + name, money(amount), width)));
  out.push(divider(width));
  out.push("Produk Terlaris");
  const byProduct = new Map<string, { qty: number; total: number }>();
  valid.forEach((s) =>
    s.items.forEach((i) => {
      const prev = byProduct.get(i.name) ?? { qty: 0, total: 0 };
      byProduct.set(i.name, {
        qty: prev.qty + i.qty,
        total: prev.total + i.qty * i.unitPrice - i.discount,
      });
    }),
  );
  [...byProduct.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)
    .forEach(([name, v]) => out.push(twoCol(`  ${v.qty}x ${pad(name, width - 12).trim()}`, money(v.total), width)));

  if (input.openingCash != null) {
    out.push(divider(width));
    out.push(twoCol("Kas Awal", money(input.openingCash), width));
    if (input.closingCash != null) {
      const cashSales = valid.reduce(
        (sum, s) => sum + s.payments.filter((p) => p.methodName === "Tunai").reduce((a, p) => a + p.amount, 0),
        0,
      );
      const expected = input.openingCash + cashSales - valid.reduce((a, s) => a + s.change, 0);
      out.push(twoCol("Kas Akhir", money(input.closingCash), width));
      out.push(twoCol("Selisih", money(input.closingCash - expected), width));
    }
  }

  footerLines(db.printer, width).forEach((l) => out.push(l));
  return out;
}

export function receiptTotalsPreview(sale: Sale): string {
  return rupiah(sale.total);
}
