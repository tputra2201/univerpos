import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ChefHat,
  ReceiptText,
  Barcode,
  Pause,
  Play,
  X,
  ShoppingBag,
  Utensils,
  Bike,
} from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { usePos } from "@/lib/pos/store";
import { computeTotals, lineTotal } from "@/lib/pos/calc";
import { rupiah, uid } from "@/lib/pos/format";
import { buildReceipt } from "@/lib/pos/receipt";
import { printViaDialog } from "@/lib/pos/print";
import { CART_STORAGE_KEY, readLocal, writeLocal } from "@/lib/pos/storage";
import { canAuthorizeVoid, formatOrderNo, roleLabel } from "@/lib/pos/roles";
import type { CartLine, Product, Sale, SalePayment } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kasir — POS UKM Offline" },
      {
        name: "description",
        content:
          "Layar kasir cepat untuk usaha kuliner, retail, dan jasa: pilih produk, catat pesanan, terima pembayaran, cetak struk.",
      },
      { property: "og:title", content: "Kasir — POS UKM Offline" },
      {
        property: "og:description",
        content: "Layar kasir cepat dengan pembayaran tunai, QRIS, kartu, dan cetak struk thermal.",
      },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <KasirPage />
      </AppShell>
    </PosGate>
  ),
});

interface CartState {
  lines: CartLine[];
  tableName: string;
  customerName: string;
  billDiscount: number;
  /** "" = belum memilih layanan */
  orderType: string;
  /** id pesanan tersimpan yang sedang dibuka */
  heldId?: string;
  /** catatan pesanan */
  note: string;
  /** nomor order, format KODE-000001 */
  orderNo: string;
  /** sudah dikirim ke dapur */
  sentToKitchen: boolean;
}

const EMPTY_CART: CartState = {
  lines: [],
  tableName: "",
  customerName: "",
  billDiscount: 0,
  orderType: "",
  note: "",
  orderNo: "",
  sentToKitchen: false,
};

function KasirPage() {
  const { db, update, currentUser } = usePos();
  const { settings } = db;
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [editLine, setEditLine] = useState<CartLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [printTitle, setPrintTitle] = useState("Struk");

  useEffect(() => {
    const saved = readLocal<CartState>(CART_STORAGE_KEY);
    if (saved) setCart({ ...EMPTY_CART, ...saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeLocal(CART_STORAGE_KEY, cart);
  }, [cart, hydrated]);

  const totals = useMemo(
    () => computeTotals(cart.lines, settings, cart.billDiscount),
    [cart, settings],
  );

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.products.filter((p) => {
      if (!p.active) return false;
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.barcode.includes(q);
    });
  }, [db.products, query, categoryId]);

  function addProduct(product: Product, variantName = "", priceDelta = 0) {
    setCart((prev) => {
      const existing = prev.lines.find(
        (l) => l.productId === product.id && l.variantName === variantName && !l.note,
      );
      if (existing) {
        return {
          ...prev,
          lines: prev.lines.map((l) =>
            l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      const line: CartLine = {
        lineId: uid("ln"),
        productId: product.id,
        name: product.name,
        variantName,
        unitPrice: product.price + priceDelta,
        qty: 1,
        note: "",
        discount: 0,
        staffName: "",
      };
      return { ...prev, lines: [...prev.lines, line] };
    });
  }

  function onProductClick(product: Product) {
    if (product.variants.length > 0) {
      setVariantProduct(product);
      return;
    }
    addProduct(product);
  }

  function changeQty(lineId: string, delta: number) {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    }));
  }

  function removeLine(lineId: string) {
    setCart((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.lineId !== lineId) }));
  }

  function saveLine(updated: CartLine) {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.lineId === updated.lineId ? updated : l)),
    }));
    setEditLine(null);
  }

  /** Ambil nomor order yang sudah ada, atau buat baru dari nomor urut toko. */
  function ensureOrderNo(): string {
    if (cart.orderNo) return cart.orderNo;
    const seq = Math.max(1, settings.orderSeq || 1);
    const no = formatOrderNo(cart.orderType, seq);
    update((current) => ({
      ...current,
      settings: { ...current.settings, orderSeq: Math.max(1, current.settings.orderSeq || 1) + 1 },
    }));
    setCart((prev) => ({ ...prev, orderNo: no }));
    return no;
  }

  function draftSale(
    status: Sale["status"] = "paid",
    override: { lines?: CartLine[]; orderNo?: string } = {},
  ): Sale {
    return {
      id: uid("sale"),
      code: "TRX" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" +
        String(db.sales.length + 1).padStart(4, "0"),
      createdAt: new Date().toISOString(),
      userName: currentUser?.name ?? "Kasir",
      items: override.lines ?? cart.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      service: totals.service,
      total: totals.total,
      payments: [],
      paid: 0,
      change: 0,
      tableName: cart.tableName,
      customerName: cart.customerName,
      orderType: cart.orderType,
      orderNo: override.orderNo ?? cart.orderNo,
      note: cart.note,
      status,
      reason: "",
    };
  }

  function showPrint(title: string, lines: string[]) {
    setPrintTitle(title);
    setPrintLines(lines);
  }

  function printBill() {
    if (cart.lines.length === 0) return;
    const orderNo = ensureOrderNo();
    showPrint("Bill Sementara", buildReceipt("bill", draftSale("paid", { orderNo }), settings, db.printer));
  }

  function sendToKitchen() {
    if (cart.lines.filter((l) => !l.voided).length === 0) return;
    const orderNo = ensureOrderNo();
    const lines = cart.lines.map((l) => ({ ...l, sentToKitchen: true }));
    const sale = draftSale("paid", { lines, orderNo });
    saveHeld({ lines, orderNo, sentToKitchen: true });
    const order = buildReceipt("order", sale, settings, db.printer);
    const label = buildReceipt("label", sale, settings, db.printer);
    printViaDialog([...order, "", ...label], db.printer.paperWidth);
    setCart((prev) => ({ ...prev, lines, orderNo, sentToKitchen: true }));
    toast.success(`Pesanan ${orderNo} dikirim ke dapur.`);
  }

  function saveHeld(
    override: { lines?: CartLine[]; orderNo?: string; sentToKitchen?: boolean } = {},
  ) {
    const id = cart.heldId ?? uid("hold");
    const orderNo = override.orderNo ?? cart.orderNo;
    const entry = {
      id,
      label:
        [orderNo, cart.orderType, cart.tableName || cart.customerName].filter(Boolean).join(" • ") ||
        "Pesanan",
      createdAt: db.heldOrders.find((h) => h.id === id)?.createdAt ?? new Date().toISOString(),
      items: override.lines ?? cart.lines,
      tableName: cart.tableName,
      customerName: cart.customerName,
      orderType: cart.orderType,
      orderNo,
      note: cart.note,
      sentToKitchen: override.sentToKitchen ?? cart.sentToKitchen,
    };
    update((current) => ({
      ...current,
      heldOrders: current.heldOrders.some((h) => h.id === id)
        ? current.heldOrders.map((h) => (h.id === id ? entry : h))
        : [entry, ...current.heldOrders],
    }));
    return id;
  }

  function holdOrder() {
    if (cart.lines.length === 0) return;
    ensureOrderNo();
    saveHeld();
    setCart(EMPTY_CART);
    setCartOpen(false);
    toast.success("Pesanan ditahan. Silakan buka pesanan baru.");
  }

  function voidLine(lineId: string, reason: string, byName: string) {
    setCart((prev) => {
      const lines = prev.lines.map((l) =>
        l.lineId === lineId ? { ...l, voided: true, voidReason: reason, voidedBy: byName } : l,
      );
      if (prev.heldId) {
        update((current) => ({
          ...current,
          heldOrders: current.heldOrders.map((h) => (h.id === prev.heldId ? { ...h, items: lines } : h)),
        }));
      }
      return { ...prev, lines };
    });
    setVoidLine(null);
    toast.success("Item di-void dengan otorisasi " + byName + ".");
  }

  function recallOrder(id: string) {
    const held = db.heldOrders.find((h) => h.id === id);
    if (!held) return;
    setCart({
      lines: held.items,
      tableName: held.tableName,
      customerName: held.customerName,
      billDiscount: 0,
      orderType: held.orderType || "Take Out",
      heldId: held.id,
      note: held.note ?? "",
      orderNo: held.orderNo ?? "",
      sentToKitchen: held.sentToKitchen ?? held.items.some((i) => i.sentToKitchen),
    });
    setHeldOpen(false);
    setCartOpen(true);
  }

  function completeSale(payments: SalePayment[]) {
    const paid = payments.reduce((sum, p) => sum + (p.tendered ?? p.amount), 0);
    const sale: Sale = {
      ...draftSale(),
      payments,
      paid,
      change: Math.max(0, paid - totals.total),
    };
    update((current) => ({
      ...current,
      sales: [sale, ...current.sales],
      heldOrders: cart.heldId
        ? current.heldOrders.filter((h) => h.id !== cart.heldId)
        : current.heldOrders,
      products: current.products.map((p) => {
        const sold = sale.items
          .filter((i) => i.productId === p.id)
          .reduce((sum, i) => sum + i.qty, 0);
        return sold > 0 && p.stock != null ? { ...p, stock: p.stock - sold } : p;
      }),
    }));
    setCart(EMPTY_CART);
    setPayOpen(false);
    setCartOpen(false);
    const lines = buildReceipt("receipt", sale, settings, db.printer);
    if (db.printer.autoPrintOnPay) {
      printViaDialog(lines, db.printer.paperWidth);
      toast.success(`Pembayaran ${rupiah(sale.total)} tersimpan. Struk dicetak.`);
    } else {
      showPrint("Struk Penjualan", lines);
      toast.success(`Pembayaran ${rupiah(sale.total)} tersimpan.`);
    }
  }

  const itemCount = cart.lines.reduce((sum, l) => sum + l.qty, 0);

  if (hydrated && !cart.orderType) {
    return (
      <ServicePicker
        onPick={(orderType, tableName) => setCart((prev) => ({ ...prev, orderType, tableName }))}
        onOpenHeld={(id) => recallOrder(id)}
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:h-screen lg:flex-row">
      {/* Daftar produk */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <span className="text-sm font-semibold text-primary">
              {cart.orderType}
              {cart.tableName && ` • ${cart.tableName}`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setCart((prev) => ({ ...prev, orderType: "", tableName: "" }))}
            >
              Ganti layanan
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  settings.businessType === "retail"
                    ? "Cari produk atau scan barcode"
                    : "Cari produk"
                }
                className="h-11 pl-9"
              />
              {settings.businessType === "retail" && (
                <Barcode className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            <Button variant="secondary" className="h-11 gap-2" onClick={() => setHeldOpen(true)}>
              <Play className="size-4" />
              <span className="hidden sm:inline">Tertahan</span>
              {db.heldOrders.length > 0 && <Badge variant="default">{db.heldOrders.length}</Badge>}
            </Button>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              <CategoryChip
                active={categoryId === "all"}
                label="Semua"
                onClick={() => setCategoryId("all")}
              />
              {db.categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={categoryId === c.id}
                  label={c.name}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-4">
          {products.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Belum ada produk yang cocok. Tambahkan di halaman Produk.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onProductClick(product)}
                  className="flex min-h-24 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
                >
                  <span className="line-clamp-2 text-sm font-semibold">{product.name}</span>
                  <span className="mt-2 block">
                    <span className="tabular block font-bold text-primary">
                      {rupiah(product.price)}
                    </span>
                    {product.stock != null && (
                      <span
                        className={`text-xs ${product.stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        Stok {product.stock}
                      </span>
                    )}
                    {product.variants.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {product.variants.length} varian
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Keranjang desktop */}
      <aside className="hidden w-96 shrink-0 flex-col border-l bg-card lg:flex">
        <CartPanel
          cart={cart}
          setCart={setCart}
          totals={totals}
          onEditLine={setEditLine}
          onChangeQty={changeQty}
          onRemoveLine={removeLine}
          onPay={() => setPayOpen(true)}
          onBill={printBill}
          onKitchen={sendToKitchen}
          onHold={holdOrder}
        />
      </aside>

      {/* Bar keranjang mobile */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card p-3 lg:hidden">
        <Button
          className="h-12 w-full justify-between text-base"
          disabled={cart.lines.length === 0}
          onClick={() => setCartOpen(true)}
        >
          <span>
            {itemCount} item {cart.tableName && `• ${cart.tableName}`}
          </span>
          <span className="tabular font-bold">{rupiah(totals.total)}</span>
        </Button>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[92vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Keranjang</SheetTitle>
          </SheetHeader>
          <CartPanel
            cart={cart}
            setCart={setCart}
            totals={totals}
            onEditLine={setEditLine}
            onChangeQty={changeQty}
            onRemoveLine={removeLine}
            onPay={() => setPayOpen(true)}
            onBill={printBill}
            onKitchen={sendToKitchen}
            onHold={holdOrder}
          />
        </SheetContent>
      </Sheet>

      {/* Pilih varian */}
      <Dialog open={!!variantProduct} onOpenChange={(v) => !v && setVariantProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{variantProduct?.name}</DialogTitle>
            <DialogDescription>Pilih varian yang dipesan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {variantProduct?.variants.map((v) => (
              <Button
                key={v.id}
                variant="secondary"
                className="h-12 justify-between"
                onClick={() => {
                  addProduct(variantProduct, v.name, v.priceDelta);
                  setVariantProduct(null);
                }}
              >
                <span>{v.name}</span>
                <span className="tabular">{rupiah(variantProduct.price + v.priceDelta)}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <LineEditor
        line={editLine}
        onClose={() => setEditLine(null)}
        onSave={saveLine}
        staffNames={db.staff.map((s) => s.name)}
        showStaff={settings.businessType === "jasa"}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={totals.total}
        onComplete={completeSale}
      />

      <Sheet open={heldOpen} onOpenChange={setHeldOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Pesanan Tertahan</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 overflow-auto px-4 pb-6">
            {db.heldOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada pesanan tertahan.</p>
            )}
            {db.heldOrders.map((h) => (
              <div key={h.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{h.label}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Hapus"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        heldOrders: current.heldOrders.filter((x) => x.id !== h.id),
                      }))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {h.items.reduce((s, i) => s + i.qty, 0)} item •{" "}
                  {new Date(h.createdAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <Button size="sm" className="mt-2 w-full" onClick={() => recallOrder(h.id)}>
                  Buka Pesanan
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <PrintPreview
        open={printLines !== null}
        onOpenChange={(v) => !v && setPrintLines(null)}
        title={printTitle}
        lines={printLines ?? []}
      />
    </div>
  );
}

function ServicePicker({
  onPick,
  onOpenHeld,
}: {
  onPick: (orderType: string, tableName: string) => void;
  onOpenHeld: (id: string) => void;
}) {
  const { db } = usePos();
  const [mode, setMode] = useState<"" | "dinein" | "online">("");
  const channels = (db.onlineChannels ?? []).filter((c) => c.active);

  const big =
    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card p-5 text-center transition-colors hover:border-primary hover:bg-primary/5";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-3xl flex-col justify-center gap-6 p-4 lg:min-h-screen">
      <div>
        <h1 className="text-2xl font-bold">
          {mode === "dinein" ? "Pilih Meja / Room" : mode === "online" ? "Pilih Online Order" : "Pilih Jenis Layanan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "" ? "Tentukan layanan sebelum memilih menu." : "Ketuk salah satu untuk lanjut ke menu."}
        </p>
      </div>

      {mode === "" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" className={big} onClick={() => onPick("Take Out", "")}>
            <ShoppingBag className="size-8 text-primary" />
            <span className="text-lg font-semibold">Take Out</span>
          </button>
          <button type="button" className={big} onClick={() => setMode("dinein")}>
            <Utensils className="size-8 text-primary" />
            <span className="text-lg font-semibold">Dine In</span>
            <span className="text-xs text-muted-foreground">Pilih no. meja/room</span>
          </button>
          <button type="button" className={big} onClick={() => setMode("online")}>
            <Bike className="size-8 text-primary" />
            <span className="text-lg font-semibold">Online Order</span>
            <span className="text-xs text-muted-foreground">GrabFood, GoFood, dll.</span>
          </button>
        </div>
      )}

      {mode === "dinein" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {db.tables.map((t) => {
            const held = db.heldOrders.find((h) => h.orderType === "Dine In" && h.tableName === t.name);
            return (
              <button
                key={t.id}
                type="button"
                className={
                  big +
                  " min-h-20" +
                  (held ? " border-accent bg-accent text-accent-foreground hover:bg-accent/80" : "")
                }
                onClick={() => (held ? onOpenHeld(held.id) : onPick("Dine In", t.name))}
              >
                <span className="text-lg font-semibold">{t.name}</span>
                {held && (
                  <span className="text-xs font-medium">
                    Terisi • {held.items.reduce((s, i) => s + i.qty, 0)} item
                  </span>
                )}
              </button>
            );
          })}
          {db.tables.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Belum ada meja. Tambahkan di Pengaturan → Meja & Staf.
            </p>
          )}
        </div>
      )}

      {mode === "online" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {channels.map((c) => (
            <button key={c.id} type="button" className={big + " min-h-20"} onClick={() => onPick(c.name, "")}>
              <span className="text-lg font-semibold">{c.name}</span>
            </button>
          ))}
          {channels.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Belum ada aplikasi online aktif. Atur di Pengaturan → Online Order.
            </p>
          )}
        </div>
      )}

      {mode !== "" && (
        <Button variant="ghost" className="h-11 self-start" onClick={() => setMode("")}>
          ← Kembali
        </Button>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function CartPanel({
  cart,
  setCart,
  totals,
  onEditLine,
  onChangeQty,
  onRemoveLine,
  onPay,
  onBill,
  onKitchen,
  onHold,
}: {
  cart: CartState;
  setCart: React.Dispatch<React.SetStateAction<CartState>>;
  totals: ReturnType<typeof computeTotals>;
  onEditLine: (line: CartLine) => void;
  onChangeQty: (lineId: string, delta: number) => void;
  onRemoveLine: (lineId: string) => void;
  onPay: () => void;
  onBill: () => void;
  onKitchen: () => void;
  onHold: () => void;
}) {
  const { db } = usePos();
  const type = db.settings.businessType;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b px-4 py-3">
        {cart.orderType === "Dine In" && (
          <div className="flex flex-wrap gap-2">
            {db.tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setCart((prev) => ({
                    ...prev,
                    tableName: t.name,
                  }))
                }
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  cart.tableName === t.name
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <Input
          value={cart.customerName}
          onChange={(e) => setCart((prev) => ({ ...prev, customerName: e.target.value }))}
          placeholder={type === "jasa" ? "Nama pelanggan" : "Nama pelanggan (opsional)"}
          className="h-10"
        />
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {cart.lines.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Keranjang kosong. Pilih produk untuk mulai transaksi.
          </p>
        ) : (
          <ul className="space-y-1">
            {cart.lines.map((line) => (
              <li key={line.lineId} className="rounded-lg p-2 hover:bg-muted/60">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onEditLine(line)}
                  >
                    <p className="truncate text-sm font-semibold">
                      {line.name}
                      {line.variantName && (
                        <span className="text-muted-foreground"> · {line.variantName}</span>
                      )}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {rupiah(line.unitPrice)}
                      {line.discount > 0 && ` · diskon ${rupiah(line.discount)}`}
                    </p>
                    {line.note && <p className="text-xs text-accent-foreground">* {line.note}</p>}
                    {line.staffName && (
                      <p className="text-xs text-muted-foreground">Oleh {line.staffName}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8"
                      aria-label="Kurangi"
                      onClick={() => onChangeQty(line.lineId, -1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="tabular w-7 text-center text-sm font-bold">{line.qty}</span>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8"
                      aria-label="Tambah"
                      onClick={() => onChangeQty(line.lineId, 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground"
                      aria-label="Hapus"
                      onClick={() => onRemoveLine(line.lineId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="tabular mt-1 text-right text-sm font-semibold">
                  {rupiah(lineTotal(line))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t px-4 py-3">
        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={rupiah(totals.subtotal)} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Diskon transaksi</span>
            <Input
              inputMode="numeric"
              value={cart.billDiscount ? String(cart.billDiscount) : ""}
              onChange={(e) =>
                setCart((prev) => ({
                  ...prev,
                  billDiscount: Number(e.target.value.replace(/\D/g, "")) || 0,
                }))
              }
              placeholder="0"
              className="tabular h-8 w-28 text-right"
            />
          </div>
          {totals.service > 0 && (
            <Row
              label={`Layanan ${db.settings.servicePercent}%`}
              value={rupiah(totals.service)}
            />
          )}
          {totals.tax > 0 && (
            <Row label={`Pajak ${db.settings.taxPercent}%`} value={rupiah(totals.tax)} />
          )}
        </div>
        <div className="flex items-baseline justify-between border-t pt-2">
          <span className="font-semibold">Total</span>
          <span className="tabular text-2xl font-extrabold text-primary">
            {rupiah(totals.total)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="h-11 gap-2"
            disabled={cart.lines.length === 0}
            onClick={onBill}
          >
            <ReceiptText className="size-4" /> Bill
          </Button>
          {type === "kuliner" ? (
            <Button
              variant="secondary"
              className="h-11 gap-2"
              disabled={cart.lines.length === 0}
              onClick={onKitchen}
            >
              <ChefHat className="size-4" /> Ke Dapur
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="h-11 gap-2"
              disabled={cart.lines.length === 0}
              onClick={onHold}
            >
              <Pause className="size-4" /> Tahan
            </Button>
          )}
        </div>
        <Button
          className="h-14 w-full text-lg font-bold"
          disabled={cart.lines.length === 0}
          onClick={onPay}
        >
          Bayar {rupiah(totals.total)}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function LineEditor({
  line,
  onClose,
  onSave,
  staffNames,
  showStaff,
}: {
  line: CartLine | null;
  onClose: () => void;
  onSave: (line: CartLine) => void;
  staffNames: string[];
  showStaff: boolean;
}) {
  const [draft, setDraft] = useState<CartLine | null>(line);

  useEffect(() => setDraft(line), [line]);
  if (!draft) return null;

  return (
    <Dialog open={!!line} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{draft.name}</DialogTitle>
          <DialogDescription>Ubah jumlah, catatan, diskon, atau pelaksana.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input
                inputMode="numeric"
                value={String(draft.qty)}
                onChange={(e) =>
                  setDraft({ ...draft, qty: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })
                }
                className="tabular h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Diskon item (Rp)</Label>
              <Input
                inputMode="numeric"
                value={draft.discount ? String(draft.discount) : ""}
                onChange={(e) =>
                  setDraft({ ...draft, discount: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
                placeholder="0"
                className="tabular h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Contoh: tanpa es, pedas"
              rows={2}
            />
          </div>
          {showStaff && staffNames.length > 0 && (
            <div className="space-y-2">
              <Label>Dikerjakan oleh</Label>
              <div className="flex flex-wrap gap-2">
                {staffNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, staffName: draft.staffName === name ? "" : name })
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      draft.staffName === name
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={() => onSave(draft)}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  total,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  onComplete: (payments: SalePayment[]) => void;
}) {
  const { db } = usePos();
  const methods = db.paymentMethods.filter((m) => m.active);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState<SalePayment[]>([]);

  useEffect(() => {
    if (open) {
      setMethodId(methods[0]?.id ?? "");
      setAmount("");
      setSplit([]);
    }
  }, [open]);

  const method = methods.find((m) => m.id === methodId);
  const paidSplit = split.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paidSplit);
  const entered = Number(amount.replace(/\D/g, "")) || 0;
  const cashValue = method?.isCash ? entered : remaining;
  const change = Math.max(0, paidSplit + cashValue - total);

  const quick = [remaining, 50000, 100000, 150000, 200000].filter(
    (v, i, arr) => v > 0 && arr.indexOf(v) === i,
  );

  function addSplit() {
    if (!method || cashValue <= 0) return;
    setSplit((prev) => [
      ...prev,
      { methodId: method.id, methodName: method.name, amount: Math.min(cashValue, remaining) },
    ]);
    setAmount("");
  }

  function finish() {
    if (!method) return;
    if (method.isCash && entered < remaining) {
      toast.error("Uang tunai belum cukup untuk melunasi transaksi.");
      return;
    }
    onComplete([
      ...split,
      {
        methodId: method.id,
        methodName: method.name,
        amount: remaining,
        ...(method.isCash ? { tendered: entered } : {}),
      },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
          <DialogDescription className="tabular">
            Total tagihan {rupiah(total)}
            {split.length > 0 && ` · sisa ${rupiah(remaining)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <Button
                key={m.id}
                variant={methodId === m.id ? "default" : "secondary"}
                className="h-12"
                onClick={() => setMethodId(m.id)}
              >
                {m.name}
              </Button>
            ))}
          </div>

          {method?.isCash && (
            <div className="space-y-2">
              <Label htmlFor="cash-received">Uang diterima</Label>
              <Input
                id="cash-received"
                inputMode="numeric"
                autoFocus
                value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="tabular h-14 text-right text-2xl font-bold"
              />
              <div className="flex flex-wrap gap-2">
                {quick.map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="secondary"
                    className="tabular"
                    onClick={() => setAmount(String(v))}
                  >
                    {rupiah(v)}
                  </Button>
                ))}
              </div>
              <p className="tabular text-sm text-muted-foreground">
                Kembalian: <span className="font-semibold text-foreground">{rupiah(change)}</span>
              </p>
            </div>
          )}

          {split.length > 0 && (
            <ul className="space-y-1 rounded-lg border p-2 text-sm">
              {split.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.methodName}</span>
                  <span className="tabular">{rupiah(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="secondary" onClick={addSplit} disabled={remaining <= 0}>
            Bayar sebagian
          </Button>
          <Button className="h-12 text-base font-bold" onClick={finish}>
            Selesaikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
