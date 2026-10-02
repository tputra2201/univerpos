import type { CartLine, Category, PosDatabase, Product, ServiceType } from "./types";

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

/** Harga opsi/modifier untuk layanan: ikut penyesuaian persen layanan (nominal tetap hanya untuk harga produk). */
export function serviceOptionPrice(price: number, service?: ServiceType | undefined): number {
  if (!service || !price || service.priceAdjustMode !== "percent") return price;
  const value = service.priceAdjustValue ?? 0;
  if (!value) return price;
  return Math.max(0, price + Math.round((price * value) / 100));
}

/** Item perlu dikirim ke dapur? Setelan kategori menang atas setelan jenis layanan. */
export function lineNeedsKitchen(db: PosDatabase, line: CartLine, service?: ServiceType | undefined): boolean {
  const product = db.products.find((p) => p.id === line.productId);
  const cat = product ? db.categories.find((c) => c.id === product.categoryId) : undefined;
  if (cat?.sendToKitchen != null) return cat.sendToKitchen;
  return service?.sendToKitchen !== false;
}

/** Layanan ini memberi diskon global (penyesuaian harga negatif)? Diskon manual di kasir dikunci. */
export function isDiscountService(service?: ServiceType | undefined): boolean {
  return !!service && (service.priceAdjustValue ?? 0) < 0;
}

/** Produk boleh tampil untuk layanan diskon? Setelan produk menang atas kategori; kosong = boleh. */
export function productAllowsServiceDiscount(db: PosDatabase, product: Product): boolean {
  if (product.serviceDiscount != null) return product.serviceDiscount;
  const cat = db.categories.find((c) => c.id === product.categoryId);
  return cat?.serviceDiscount !== false;
}
