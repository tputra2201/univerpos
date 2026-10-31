import type { Product } from "./types";

/** Urutan tampil menu item: A-Z bila diaktifkan, selain itu urutan manual. */
export function sortProductsForDisplay<T extends Pick<Product, "name">>(items: T[], alphabetical: boolean): T[] {
  if (!alphabetical) return items;
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, "id", { sensitivity: "base", numeric: true }),
  );
}
