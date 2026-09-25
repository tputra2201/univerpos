import type { Category, Modifier, PosDatabase, Product, Variant } from "./types";
import { uid } from "./format";

const fmtList = (list: { name: string; priceDelta?: number; price?: number }[] = []) =>
  list.map((v) => `${v.name}=${v.priceDelta ?? v.price ?? 0}`).join("; ");

function parseList(raw: unknown): { name: string; price: number }[] {
  return String(raw ?? "")
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [n, p] = s.split("=");
      return { name: (n ?? "").trim(), price: Number(String(p ?? "0").replace(/[^\d-]/g, "")) || 0 };
    })
    .filter((x) => x.name);
}

const yes = (v: unknown) => /^(ya|y|yes|true|1|aktif)$/i.test(String(v ?? "").trim());
const str = (v: unknown) => String(v ?? "").trim();

export async function exportProductsExcel(db: PosDatabase) {
  const XLSX = await import("xlsx");
  const cat = new Map(db.categories.map((c) => [c.id, c.name]));
  const mods = new Map((db.modifiers ?? []).map((m) => [m.id, m.name]));
  const rows = db.products.map((p) => ({
    Nama: p.name,
    Kategori: cat.get(p.categoryId) ?? "",
    Harga: p.price,
    Satuan: p.unit,
    Barcode: p.barcode,
    Stok: p.stock ?? "",
    Aktif: p.active ? "Ya" : "Tidak",
    Varian: fmtList(p.variants),
    Ukuran: fmtList(p.sizes),
    Topping: fmtList(p.toppings),
    Modifier: (p.modifierIds ?? []).map((id) => mods.get(id)).filter(Boolean).join("; "),
  }));
  const modRows = (db.modifiers ?? []).map((m) => ({
    Nama: m.name,
    Wajib: m.required ? "Ya" : "Tidak",
    "Boleh Lebih dari Satu": m.multiple ? "Ya" : "Tidak",
    Minimum: m.minSelect ?? 0,
    Maksimum: m.maxSelect ?? 0,
    Isi: fmtList(m.options),
  }));
  const help = [
    ["Petunjuk"],
    ["Sheet Produk: satu baris satu produk. Kategori baru otomatis dibuat."],
    ["Varian/Ukuran/Topping: format Nama=HargaTambahan dipisah titik koma, mis. Hot=0; Iced=3000"],
    ["Modifier: nama modifier dari sheet Modifier, dipisah titik koma."],
    ["Stok kosong = tidak dihitung stoknya. Aktif: Ya / Tidak."],
    ["Produk dengan nama yang sama akan diperbarui, nama baru akan ditambahkan."],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nama: "", Kategori: "", Harga: "", Satuan: "", Barcode: "", Stok: "", Aktif: "", Varian: "", Ukuran: "", Topping: "", Modifier: "" }]);
  ws["!cols"] = [28, 16, 12, 10, 16, 8, 8, 30, 30, 30, 30].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, "Produk");
  const wm = XLSX.utils.json_to_sheet(modRows.length ? modRows : [{ Nama: "", Wajib: "", "Boleh Lebih dari Satu": "", Minimum: "", Maksimum: "", Isi: "" }]);
  wm["!cols"] = [22, 8, 20, 10, 10, 50].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wm, "Modifier");
  const wh = XLSX.utils.aoa_to_sheet(help);
  wh["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wh, "Petunjuk");
  XLSX.writeFile(wb, `produk-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function importProductsExcel(file: File, db: PosDatabase): Promise<{ next: PosDatabase; count: number }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = (name: string) => {
    const ws = wb.Sheets[name] ?? wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase()) ?? ""];
    return ws ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }) : [];
  };
  const prodRows = sheet("Produk").length ? sheet("Produk") : sheet(wb.SheetNames[0] ?? "");
  const categories: Category[] = [...db.categories];
  const modifiers: Modifier[] = [...(db.modifiers ?? [])];
  const products: Product[] = [...db.products];
  const key = (s: string) => s.trim().toLowerCase();

  for (const r of sheet("Modifier")) {
    const name = str(r["Nama"]);
    if (!name) continue;
    const opts = parseList(r["Isi"]);
    const idx = modifiers.findIndex((m) => key(m.name) === key(name));
    const prev = idx >= 0 ? modifiers[idx] : undefined;
    const m: Modifier = {
      id: prev?.id ?? uid("mod"),
      name,
      required: yes(r["Wajib"]),
      multiple: yes(r["Boleh Lebih dari Satu"]),
      minSelect: Number(r["Minimum"]) || 0,
      maxSelect: Number(r["Maksimum"]) || 0,
      options: opts.map((o) => ({
        id: prev?.options.find((x) => key(x.name) === key(o.name))?.id ?? uid("opt"),
        name: o.name,
        price: o.price,
      })),
    };
    if (idx >= 0) modifiers[idx] = m;
    else modifiers.push(m);
  }

  let count = 0;
  for (const r of prodRows) {
    const name = str(r["Nama"]);
    if (!name) continue;
    const catName = str(r["Kategori"]) || "Lainnya";
    let c = categories.find((x) => key(x.name) === key(catName));
    if (!c) {
      c = { id: uid("cat"), name: catName };
      categories.push(c);
    }
    const idx = products.findIndex((p) => key(p.name) === key(name));
    const prev = idx >= 0 ? products[idx] : undefined;
    const toVariants = (raw: unknown, old: Variant[] = []): Variant[] =>
      parseList(raw).map((o) => ({
        id: old.find((x) => key(x.name) === key(o.name))?.id ?? uid("var"),
        name: o.name,
        priceDelta: o.price,
      }));
    const stockRaw = str(r["Stok"]);
    const p: Product = {
      ...(prev ?? {}),
      id: prev?.id ?? uid("prd"),
      name,
      categoryId: c.id,
      price: Number(String(r["Harga"]).replace(/[^\d.-]/g, "")) || 0,
      unit: str(r["Satuan"]) || "pcs",
      barcode: str(r["Barcode"]),
      stock: stockRaw === "" ? null : Number(stockRaw) || 0,
      active: str(r["Aktif"]) === "" ? true : yes(r["Aktif"]),
      variants: toVariants(r["Varian"], prev?.variants),
      sizes: toVariants(r["Ukuran"], prev?.sizes),
      toppings: toVariants(r["Topping"], prev?.toppings),
      modifierIds: str(r["Modifier"])
        .split(/[;\n]/)
        .map((s) => modifiers.find((m) => key(m.name) === key(s))?.id)
        .filter((x): x is string => !!x),
    };
    if (idx >= 0) products[idx] = p;
    else products.push(p);
    count++;
  }
  if (!count) throw new Error("empty");
  return { next: { ...db, categories, products, modifiers }, count };
}
