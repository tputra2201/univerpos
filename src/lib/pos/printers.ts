/**
 * Printer per jenis dokumen (Struk, Tagihan, Tiket Stasiun 1/2, Laporan) dan
 * pengarahan item pesanan ke printer tiket.
 */
import { printViaBluetooth, printViaDialog } from "./print";
import type { CartLine, PosDatabase, PrinterConfig, PrinterRole, PrinterSettings, Product } from "./types";

export const PRINTER_ROLES: PrinterRole[] = ["receipt", "bill", "kitchen", "bar", "report"];

export const PRINTER_ROLE_LABEL: Record<PrinterRole, string> = {
  receipt: "Struk (nota pembayaran)",
  bill: "Tagihan sementara (bill)",
  kitchen: "Tiket Stasiun 1 (mis. dapur)",
  bar: "Tiket Stasiun 2 (mis. bar)",
  report: "Laporan & shift",
};

/** Urutan cadangan bila printer untuk jenis dokumen belum diatur. */
const FALLBACK: Record<PrinterRole, PrinterRole[]> = {
  receipt: [],
  bill: ["receipt"],
  kitchen: [],
  bar: ["kitchen"],
  report: ["receipt"],
};

export function newPrinter(role: PrinterRole, base: PrinterSettings): PrinterConfig {
  return {
    id: `prt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: PRINTER_ROLE_LABEL[role].split(" (")[0] ?? "Printer",
    role,
    paperWidth: base.paperWidth,
    mode: base.printMode ?? "dialog",
    copies: 1,
    active: true,
    autoPrint: role === "receipt" ? base.autoPrintOnPay : role === "kitchen" || role === "bar",
    printTicket: true,
    printLabels: role === "bar",
  };
}

/** Printer bawaan dari pengaturan lama (satu printer untuk semua). */
function legacyPrinter(role: PrinterRole, p: PrinterSettings): PrinterConfig {
  return {
    id: "legacy",
    name: p.deviceName || "Printer utama",
    role,
    paperWidth: p.paperWidth,
    mode: p.printMode ?? "dialog",
    ...(p.deviceId ? { deviceId: p.deviceId } : {}),
    ...(p.deviceName ? { deviceName: p.deviceName } : {}),
    copies: 1,
    active: true,
    autoPrint: role === "receipt" ? p.autoPrintOnPay : true,
    printTicket: true,
    printLabels: true,
  };
}

export function printersFor(db: PosDatabase, role: PrinterRole): PrinterConfig[] {
  const list = (db.printer.printers ?? []).filter((p) => p.active);
  for (const r of [role, ...FALLBACK[role]]) {
    const found = list.filter((p) => p.role === r);
    if (found.length) return found;
  }
  return (db.printer.printers ?? []).length ? [] : [legacyPrinter(role, db.printer)];
}

export function printerFor(db: PosDatabase, role: PrinterRole): PrinterConfig {
  return printersFor(db, role)[0] ?? legacyPrinter(role, db.printer);
}

/** Pengaturan tata letak struk dengan lebar kertas milik printer tertentu. */
export function layoutFor(db: PosDatabase, cfg: PrinterConfig): PrinterSettings {
  return { ...db.printer, paperWidth: cfg.paperWidth };
}

export async function sendToPrinter(cfg: PrinterConfig, lines: string[]): Promise<void> {
  const copies = Math.max(1, Math.min(5, cfg.copies || 1));
  const all: string[] = [];
  for (let i = 0; i < copies; i++) all.push(...(i ? ["", ""] : []), ...lines);
  if (cfg.mode === "bluetooth") {
    await printViaBluetooth(all, {
      ...(cfg.deviceId ? { deviceId: cfg.deviceId } : {}),
      ...(cfg.deviceName ? { deviceName: cfg.deviceName } : {}),
    });
  } else {
    printViaDialog(all, cfg.paperWidth);
  }
}

export function productPrints(p: Product | undefined): boolean {
  return p?.printLabel !== false;
}

export function productStation(p: Product | undefined): "kitchen" | "bar" {
  return p?.labelStation === "bar" ? "bar" : "kitchen";
}

/** Kelompokkan item pesanan per tujuan printer (Kitchen / Bar) sesuai pengaturan tiap menu. */
export function splitByStation(db: PosDatabase, items: CartLine[]) {
  const out: Record<"kitchen" | "bar", CartLine[]> = { kitchen: [], bar: [] };
  for (const item of items) {
    if (item.voided) continue;
    const product = db.products.find((p) => p.id === item.productId);
    if (!productPrints(product)) continue;
    out[productStation(product)].push(item);
  }
  return out;
}
