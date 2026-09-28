/**
 * Pilihan ikon untuk jenis layanan agar cocok untuk semua jenis usaha
 * (kuliner, jasa, retail). Kunci disimpan di ServiceType.icon.
 */
import {
  Armchair,
  Bike,
  Car,
  Coffee,
  Home,
  Package,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Truck,
  User,
  Utensils,
  Wrench,
} from "lucide-react";
import type { ServiceKind } from "./types";

export const SERVICE_ICONS = {
  utensils: { label: "Sendok & garpu", Icon: Utensils },
  coffee: { label: "Minuman", Icon: Coffee },
  bag: { label: "Tas bawa pulang", Icon: ShoppingBag },
  cart: { label: "Keranjang belanja", Icon: ShoppingCart },
  bike: { label: "Ojek / antar", Icon: Bike },
  truck: { label: "Pengiriman", Icon: Truck },
  car: { label: "Mobil / cuci mobil", Icon: Car },
  scissors: { label: "Gunting / barbershop", Icon: Scissors },
  armchair: { label: "Kursi / bilik layanan", Icon: Armchair },
  user: { label: "Staf / personal", Icon: User },
  home: { label: "Home service", Icon: Home },
  wrench: { label: "Bengkel / perbaikan", Icon: Wrench },
  sparkles: { label: "Perawatan / spa", Icon: Sparkles },
  package: { label: "Paket", Icon: Package },
  store: { label: "Toko", Icon: Store },
  tag: { label: "Umum / label", Icon: Tag },
} as const;

export type ServiceIconKey = keyof typeof SERVICE_ICONS;

export const SERVICE_ICON_KEYS = Object.keys(SERVICE_ICONS) as ServiceIconKey[];

const DEFAULT_BY_KIND: Record<ServiceKind, ServiceIconKey> = {
  takeout: "bag",
  dinein: "utensils",
  online: "bike",
};

export function serviceIconKey(svc: { icon?: string; kind: ServiceKind }): ServiceIconKey {
  const key = svc.icon as ServiceIconKey | undefined;
  if (key && key in SERVICE_ICONS) return key;
  return DEFAULT_BY_KIND[svc.kind] ?? "tag";
}

export function serviceIcon(svc: { icon?: string; kind: ServiceKind }) {
  return SERVICE_ICONS[serviceIconKey(svc)].Icon;
}
