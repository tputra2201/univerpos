import type { Category, Product, ServiceType } from "./types";

/** Harga produk untuk layanan tertentu: harga khusus layanan, atau harga standar + penyesuaian global layanan. */
export function servicePrice(product: Product, service?: ServiceType | undefined): number {
  const custom = service ? product.servicePrices?.[service.id] : undefined;
  if (custom != null && custom > 0) return custom;
  const base = product.price;
  if (!service) return base;
  const value = service.priceAdjustValue ?? 0;
  if (!value) return base;
  const delta =
    service.priceAdjustMode === "percent" ? Math.round((base * value) / 100) : Math.round(value);
  return Math.max(0, base + delta);
}

/** Kategori tersedia untuk layanan ini? Daftar kosong = tersedia untuk semua layanan. */
export function categoryAllowed(category: Category, serviceId?: string | undefined): boolean {
  const ids = category.serviceIds;
  if (!ids || ids.length === 0) return true;
  if (!serviceId) return true;
  return ids.includes(serviceId);
}

/** Label singkat penyesuaian harga layanan, mis. "+5.000" atau "+25%". */
export function adjustLabel(service: ServiceType): string {
  const value = service.priceAdjustValue ?? 0;
  if (!value) return "Harga standar";
  const sign = value > 0 ? "+" : "−";
  const abs = Math.abs(value);
  return service.priceAdjustMode === "percent"
    ? `${sign}${abs}%`
    : `${sign}${abs.toLocaleString("id-ID")}`;
}
