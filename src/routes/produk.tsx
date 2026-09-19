import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Search } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { usePos } from "@/lib/pos/store";
import { rupiah, uid } from "@/lib/pos/format";
import type { Product, Variant } from "@/lib/pos/types";
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
      { categories: db.categories, products: db.products },
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
      };
      update((current) => ({
        ...current,
        categories: parsed.categories?.length ? parsed.categories : current.categories,
        products: parsed.products?.length ? parsed.products : current.products,
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
        </TabsList>

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
      />
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
  onSave,
  categories,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
  categories: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState<Product | null>(product);
  const [key, setKey] = useState("");

  if (product && key !== (product.id || "new") + String(product.price)) {
    setKey((product.id || "new") + String(product.price));
    setDraft(product);
  }
  if (!product || !draft) return null;

  function setVariant(index: number, patch: Partial<Variant>) {
    setDraft({
      ...draft!,
      variants: draft!.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });
  }

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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Varian / Opsi</Label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    variants: [...draft.variants, { id: uid("var"), name: "", priceDelta: 0 }],
                  })
                }
              >
                Tambah varian
              </Button>
            </div>
            {draft.variants.map((v, i) => (
              <div key={v.id} className="flex gap-2">
                <Input
                  value={v.name}
                  placeholder="Nama varian"
                  onChange={(e) => setVariant(i, { name: e.target.value })}
                  className="h-10"
                />
                <Input
                  inputMode="numeric"
                  value={v.priceDelta ? String(v.priceDelta) : ""}
                  placeholder="+Rp"
                  onChange={(e) =>
                    setVariant(i, { priceDelta: Number(e.target.value.replace(/\D/g, "")) || 0 })
                  }
                  className="tabular h-10 w-28"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Hapus varian"
                  onClick={() =>
                    setDraft({ ...draft, variants: draft.variants.filter((x) => x.id !== v.id) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
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
