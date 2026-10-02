import type { PosDatabase, Sale, ServiceType } from "./types";
import { getServiceTypes } from "./seed";

export interface SaleAdjust {
  service: ServiceType;
  kind: "komisi" | "diskon";
  label: string;
  gross: number;
  amount: number;
}

/** Komisi/diskon layanan pada nota: selisih harga akibat penyesuaian harga layanan (toggle "Komisi/Diskon" aktif). */
export function saleAdjust(db: PosDatabase, sale: Sale): SaleAdjust | null {
  if (sale.status !== "paid") return null;
  const service = getServiceTypes(db).find((s) => s.name === sale.orderType);
  const v = service?.priceAdjustValue ?? 0;
  if (!service || !service.adjustAsCommission || !v) return null;
  const gross = sale.total;
  let amount: number;
  if (service.priceAdjustMode === "percent") {
    amount = Math.abs(gross - gross / (1 + v / 100));
  } else {
    const qty = sale.items.filter((i) => !i.voided).reduce((a, i) => a + i.qty, 0);
    amount = Math.abs(v) * qty;
  }
  amount = Math.min(Math.round(amount), Math.max(0, gross));
  const kind = v > 0 ? "komisi" : "diskon";
  return { service, kind, label: `${kind === "komisi" ? "Komisi" : "Diskon"} ${service.name}`, gross, amount };
}
