import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { usePos } from "@/lib/pos/store";
import { rupiah, uid } from "@/lib/pos/format";
import type { Modifier, Product, Variant } from "@/lib/pos/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/produk")({
  head: () => ({
    meta: [
      { title: "Produk & Kategori — POS UKM" },
      {
        name: "description",
        content: "Kelola kategori, produk, harga, varian, satuan, dan stok untuk kasir UKM.",
      },
      { property: "og:title", content: "Produk & Kategori — POS UKM" },
      {
        property: "og:description",
        content: "Kelola kategori, produk, harga, varian, satuan, dan stok.",
      },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <ProdukPage />
      </AppShell>
    </PosGate>
  ),
});

const emptyProduct = (categoryId: string): Product => ({
  id: "",
  name: "",
  categoryId,
  price: 0,
  unit: "pcs",
  barcode: "",
  stock: null,
  active: true,
  variants: [],
});

function ProdukPage() {
  const { db, update } = usePos();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q),
    );
  }, [db.products, query]);

  function saveProduct(product: Product) {
    if (!product.name.trim()) {
      toast.error("Nama produk wajib diisi.");
      return;
    }
    if (!product.categoryId) {
      toast.error("Pilih kategori terlebih dahulu.");
      return;
    }
    update((current) => ({
      ...current,
      products: product.id
        ? current.products.map((p) => (p.id === product.id ? product : p))
        : [...current.products, { ...product, id: uid("prd") }],
    }));
    setEditing(null);
    toast.success("Produk disimpan.");
  }

  function removeProduct(id: string) {
    update((current) => ({ ...current, products: current.products.filter((p) => p.id !== id) }));
    toast.success("Produk dihapus.");
  }

  function exportProducts() {
    const payload = JSON.stringify(
      { categories: db.categories, products: db.products, modifiers: db.modifiers ?? [] },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `produk-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importProducts(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        categories?: typeof db.categories;
        products?: Product[];
        modifiers?: Modifier[];
      };
      update((current) => ({
        ...current,
        categories: parsed.categories?.length ? parsed.categories : current.categories,
        products: parsed.products?.length ? parsed.products : current.products,
        modifiers: parsed.modifiers?.length ? parsed.modifiers : (current.modifiers ?? []),
      }));
      toast.success("Daftar produk berhasil diimpor.");
    } catch {
      toast.error("Berkas tidak dapat dibaca. Pastikan hasil ekspor dari aplikasi ini.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Produk"
        description="Kategori, produk, harga, varian, dan stok."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" className="gap-2" onClick={exportProducts}>
              <Download className="size-4" /> Ekspor
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Impor
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importProducts(file);
                e.target.value = "";
              }}
            />
            <Button
              className="gap-2"
              onClick={() => setEditing(emptyProduct(db.categories[0]?.id ?? ""))}
            >
              <Plus className="size-4" /> Produk
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="produk" className="p-4 md:p-6">
        <TabsList>
          <TabsTrigger value="produk">Item ({db.products.length})</TabsTrigger>
          <TabsTrigger value="kategori">Kategori ({db.categories.length})</TabsTrigger>
          <TabsTrigger value="modifier">Modifier ({db.modifiers?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="modifier">
          <ModifiersPanel />
        </TabsContent>

        <TabsContent value="produk" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk"
              className="h-10 pl-9"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {list.map((product) => (
              <div key={product.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {db.categories.find((c) => c.id === product.categoryId)?.name ??
                        "Tanpa kategori"}{" "}
                      · {product.unit}
                      {product.barcode && ` · ${product.barcode}`}
                    </p>
                    <p className="tabular mt-1 font-bold text-primary">{rupiah(product.price)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.stock != null && (
                        <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                          Stok {product.stock}
                        </Badge>
                      )}
                      {product.variants.length > 0 && (
                        <Badge variant="secondary">{product.variants.length} varian</Badge>
                      )}
                      {!product.active && <Badge variant="outline">Nonaktif</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Ubah"
                      onClick={() => setEditing(product)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus"
                      onClick={() => removeProduct(product.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada produk.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="kategori" className="space-y-3">
          <div className="flex max-w-md gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nama kategori baru"
              className="h-10"
            />
            <Button
              onClick={() => {
                if (!newCategory.trim()) return;
                update((current) => ({
                  ...current,
                  categories: [...current.categories, { id: uid("cat"), name: newCategory.trim() }],
                }));
                setNewCategory("");
              }}
            >
              Tambah
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {db.categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                <Input
                  value={c.name}
                  onChange={(e) =>
                    update((current) => ({
                      ...current,
                      categories: current.categories.map((x) =>
                        x.id === c.id ? { ...x, name: e.target.value } : x,
                      ),
                    }))
                  }
                  className="h-9"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Hapus kategori"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      categories: current.categories.filter((x) => x.id !== c.id),
                    }))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <ProductDialog
        product={editing}
        onClose={() => setEditing(null)}
        onSave={saveProduct}
        categories={db.categories}
        modifiers={db.modifiers ?? []}
      />
    </div>
  );
}

function ListEditor({
  title,
  placeholder,
  items,
  onChange,
}: {
  title: string;
  placeholder: string;
  items: Variant[];
  onChange: (items: Variant[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([...items, { id: uid("var"), name: "", priceDelta: 0 }])}
        >
          <Plus className="size-4" /> {title}
        </Button>
      </div>
      {items.map((v) => (
        <div key={v.id} className="flex gap-2">
          <Input
            value={v.name}
            placeholder={placeholder}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)))
            }
            className="h-10 min-w-0"
          />
          <Input
            inputMode="numeric"
            value={v.priceDelta ? String(v.priceDelta) : ""}
            placeholder="+Rp"
            onChange={(e) =>
              onChange(
                items.map((x) =>
                  x.id === v.id
                    ? { ...x, priceDelta: Number(e.target.value.replace(/\D/g, "")) || 0 }
                    : x,
                ),
              )
            }
            className="tabular h-10 w-24 shrink-0"
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Hapus ${title}`}
            onClick={() => onChange(items.filter((x) => x.id !== v.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ModifiersPanel() {
  const { db, update } = usePos();
  const modifiers = db.modifiers ?? [];
  const [editing, setEditing] = useState<Modifier | null>(null);

  function save(m: Modifier) {
    if (!m.name.trim()) { toast.error("Nama modifier wajib diisi."); return; }
    const options = m.options.filter((o) => o.name.trim());
    if (!options.length) { toast.error("Isi modifier minimal satu pilihan."); return; }
    const clean = { ...m, name: m.name.trim(), options };
    update((c) => {
      const list = c.modifiers ?? [];
      return {
        ...c,
        modifiers: m.id
          ? list.map((x) => (x.id === m.id ? clean : x))
          : [...list, { ...clean, id: uid("mod") }],
      };
    });
    setEditing(null);
    toast.success("Modifier disimpan.");
  }

  function remove(m: Modifier) {
    const used = db.products.filter((p) => p.modifierIds?.includes(m.id)).length;
    if (used && !window.confirm(`Modifier dipakai ${used} produk. Hapus dan lepas dari produk?`))
      return;
    update((c) => ({
      ...c,
      modifiers: (c.modifiers ?? []).filter((x) => x.id !== m.id),
      products: c.products.map((p) =>
        p.modifierIds?.includes(m.id)
          ? { ...p, modifierIds: p.modifierIds.filter((x) => x !== m.id) }
          : p,
      ),
    }));
    toast.success("Modifier dihapus.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Buat sekali, lalu pilih di produk mana pun (mis. Ice Doze, Sugar Doze, Condiment).
        </p>
        <Button
          className="gap-2"
          onClick={() =>
            setEditing({ id: "", name: "", required: false, multiple: false, options: [] })
          }
        >
          <Plus className="size-4" /> Modifier
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {modifiers.map((m) => {
          const used = db.products.filter((p) => p.modifierIds?.includes(m.id)).length;
          return (
            <div key={m.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.options.length} pilihan · dipakai {used} produk
                  </p>
                  <p className="mt-1 break-words text-xs">
                    {m.options
                      .map((o) => (o.price ? `${o.name} +${rupiah(o.price)}` : o.name))
                      .join(", ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">{m.required ? "Wajib" : "Opsional"}</Badge>
                    <Badge variant="secondary">{m.multiple ? "Boleh beberapa" : "Pilih satu"}</Badge>
                    {m.multiple && (m.minSelect || m.maxSelect) ? (
                      <Badge variant="secondary">
                        Min {m.minSelect || 0} · Maks {m.maxSelect || "∞"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Ubah" onClick={() => setEditing(m)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Hapus" onClick={() => remove(m)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {modifiers.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada modifier.</p>
        )}
      </div>

      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Ubah Modifier" : "Modifier Baru"}</DialogTitle>
              <DialogDescription>Isi harga tambahan 0 bila gratis.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Modifier</Label>
                <Input
                  value={editing.name}
                  placeholder="mis. Ice Doze"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Wajib dipilih</p>
                <Switch
                  checked={editing.required}
                  onCheckedChange={(v) => setEditing({ ...editing, required: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Boleh pilih lebih dari satu</p>
                <Switch
                  checked={editing.multiple}
                  onCheckedChange={(v) => setEditing({ ...editing, multiple: v })}
                />
              </div>
              {editing.multiple && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Minimum dipilih</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={editing.minSelect ?? 0}
                      onChange={(e) =>
                        setEditing({ ...editing, minSelect: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maksimum dipilih</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={editing.maxSelect ?? 0}
                      onChange={(e) =>
                        setEditing({ ...editing, maxSelect: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="h-11"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">Maksimum 0 = tanpa batas.</p>
                </div>
              )}
              <ListEditor
                title="Isi"
                placeholder="mis. Less Ice"
                items={editing.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.price }))}
                onChange={(items) =>
                  setEditing({
                    ...editing,
                    options: items.map((i) => ({ id: i.id, name: i.name, price: i.priceDelta })),
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button className="h-11 w-full" onClick={() => save(editing)}>
                Simpan Modifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
  onSave,
  categories,
  modifiers,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
  categories: { id: string; name: string }[];
  modifiers: Modifier[];
}) {
  const [draft, setDraft] = useState<Product | null>(product);
  const [key, setKey] = useState("");

  if (product && key !== (product.id || "new") + String(product.price)) {
    setKey((product.id || "new") + String(product.price));
    setDraft(product);
  }
  if (!product || !draft) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.id ? "Ubah Produk" : "Produk Baru"}</DialogTitle>
          <DialogDescription>Isi detail produk yang tampil di layar kasir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Harga</Label>
              <Input
                inputMode="numeric"
                value={draft.price ? String(draft.price) : ""}
                onChange={(e) =>
                  setDraft({ ...draft, price: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
                className="tabular h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={draft.categoryId}
                onValueChange={(v) => setDraft({ ...draft, categoryId: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Satuan</Label>
              <Input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input
                value={draft.barcode}
                onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Pantau stok</p>
              <p className="text-xs text-muted-foreground">Stok berkurang otomatis saat terjual.</p>
            </div>
            <Switch
              checked={draft.stock != null}
              onCheckedChange={(v) => setDraft({ ...draft, stock: v ? 0 : null })}
            />
          </div>
          {draft.stock != null && (
            <div className="space-y-2">
              <Label>Jumlah stok</Label>
              <Input
                inputMode="numeric"
                value={String(draft.stock)}
                onChange={(e) =>
                  setDraft({ ...draft, stock: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
                className="tabular h-11"
              />
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <p className="text-sm font-medium">Tampilkan di kasir</p>
            <Switch
              checked={draft.active}
              onCheckedChange={(v) => setDraft({ ...draft, active: v })}
            />
          </div>

          <ListEditor
            title="Varian"
            placeholder="mis. Original / Pedas"
            items={draft.variants}
            onChange={(variants) => setDraft({ ...draft, variants })}
          />
          <ListEditor
            title="Ukuran"
            placeholder="mis. Small / Large"
            items={draft.sizes ?? []}
            onChange={(sizes) => setDraft({ ...draft, sizes })}
          />
          <ListEditor
            title="Topping"
            placeholder="mis. Coklat / Keju"
            items={draft.toppings ?? []}
            onChange={(toppings) => setDraft({ ...draft, toppings })}
          />
          <div className="space-y-2">
            <Label>Modifier</Label>
            {modifiers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada modifier. Buat dulu di tab Modifier.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {modifiers.map((m) => {
                  const on = (draft.modifierIds ?? []).includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) =>
                          setDraft({
                            ...draft,
                            modifierIds: v
                              ? [...(draft.modifierIds ?? []), m.id]
                              : (draft.modifierIds ?? []).filter((x) => x !== m.id),
                          })
                        }
                      />
                      <span className="min-w-0 truncate">{m.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full h-11" onClick={() => onSave(draft)}>
            Simpan Produk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
