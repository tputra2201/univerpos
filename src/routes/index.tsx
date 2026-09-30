import { applyStock } from "@/lib/pos/stock";
import { createFileRoute, Link } from "@tanstack/react-router";
import { activeShiftOf } from "@/lib/pos/shift";
import { OptionPicker, productHasOptions } from "@/components/pos/option-picker";
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
  Printer,
  Tags,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { usePos } from "@/lib/pos/store";
import { computeTotals, lineTotal } from "@/lib/pos/calc";
import { rupiah, uid } from "@/lib/pos/format";
import { buildReceipt } from "@/lib/pos/receipt";
import { layoutFor, printerFor, printersFor, productStation, sendToPrinter, splitByStation } from "@/lib/pos/printers";
import type { PrinterRole } from "@/lib/pos/types";
import { getServiceTypes } from "@/lib/pos/seed";
import { serviceIcon } from "@/lib/pos/service-icons";
import { categoryAllowed, servicePrice } from "@/lib/pos/pricing";
import { MemberPicker } from "@/components/pos/member-picker";
import {
  loyaltyOf,
  maxRedeemable,
  memberDiscountOf,
  memberPointsOf,
  membersOf,
  pointsFromSpend,
  pointsToRupiah,
} from "@/lib/pos/members";

import { CART_STORAGE_KEY, readLocal, writeLocal } from "@/lib/pos/storage";
import { hasPerm } from "@/lib/pos/permissions";
import { formatOrderNo, roleLabel } from "@/lib/pos/roles";
import type { CartLine, HeldOrder, MemberPoint, ServiceType, Product, Sale, SalePayment } from "@/lib/pos/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  /** id jenis layanan terpilih */
  serviceId?: string | undefined;
  /** id pesanan tersimpan yang sedang dibuka */
  heldId?: string;
  /** id pesanan dapur (Processing) terkait */
  kitchenId?: string | undefined;
  /** catatan pesanan */
  note: string;
  /** nomor order, format KODE-000001 */
  orderNo: string;
  /** sudah dikirim ke dapur */
  sentToKitchen: boolean;
  /** member terpilih */
  memberId?: string | undefined;
  memberName?: string | undefined;
  memberCode?: string | undefined;
  /** poin yang akan ditukar jadi potongan */
  redeemPoints?: number | undefined;
}

/** Judul utama kartu pesanan tertahan: nama pelanggan lebih diutamakan */
function heldTitle(h: HeldOrder) {
  const name = (h.customerName || "").trim();
  if (name) return name;
  const table = (h.tableName || "").trim();
  if (table) return table;
  return h.orderNo || h.orderType || h.label || "Pesanan";
}

/** Keterangan kecil: nomor order, layanan, dan meja */
function heldMeta(h: HeldOrder) {
  const name = (h.customerName || "").trim();
  const table = (h.tableName || "").trim();
  return [h.orderNo, h.orderType, name && table ? table : ""]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" • ");
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
  memberId: undefined,
  memberName: "",
  memberCode: "",
  redeemPoints: 0,
};


function KasirPage() {
  const { db, update, currentUser } = usePos();
  const { settings } = db;
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [openPriceProduct, setOpenPriceProduct] = useState<Product | null>(null);
  const [openPriceValue, setOpenPriceValue] = useState("");
  const [optionLine, setOptionLine] = useState<CartLine | null>(null);
  const [editLine, setEditLine] = useState<CartLine | null>(null);
  const [voidTarget, setVoidTarget] = useState<CartLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [voidHeld, setVoidHeld] = useState<HeldOrder | null>(null);
  const kitchenOrders = db.kitchenOrders ?? [];
  const processingCount = kitchenOrders.filter((k) => k.status === "processing").length;
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const [printTitle, setPrintTitle] = useState("Struk");
  const [printRole, setPrintRole] = useState<PrinterRole>("receipt");

  useEffect(() => {
    const saved = readLocal<CartState>(CART_STORAGE_KEY);
    if (saved) setCart({ ...EMPTY_CART, ...saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeLocal(CART_STORAGE_KEY, cart);
  }, [cart, hydrated]);

  const loyalty = useMemo(() => loyaltyOf(settings), [settings]);
  const member = useMemo(
    () => membersOf(db).find((m) => m.id === cart.memberId) ?? null,
    [db, cart.memberId],
  );

  const baseTotals = useMemo(
    () => computeTotals(cart.lines, settings, cart.billDiscount),
    [cart.lines, cart.billDiscount, settings],
  );

  const memberDisc = useMemo(
    () => (member ? memberDiscountOf(baseTotals.subtotal - baseTotals.discount, loyalty) : 0),
    [member, baseTotals, loyalty],
  );

  const pointDisc = useMemo(() => {
    if (!member) return 0;
    const billable = Math.max(0, baseTotals.subtotal - baseTotals.discount - memberDisc);
    const points = Math.min(Math.max(0, cart.redeemPoints ?? 0), member.points);
    return Math.min(billable, pointsToRupiah(points, loyalty));
  }, [member, baseTotals, memberDisc, cart.redeemPoints, loyalty]);

  const totals = useMemo(
    () => computeTotals(cart.lines, settings, cart.billDiscount + memberDisc + pointDisc),
    [cart.lines, cart.billDiscount, settings, memberDisc, pointDisc],
  );


  const activeService = useMemo(
    () => getServiceTypes(db).find((s) => s.id === cart.serviceId),
    [db, cart.serviceId],
  );

  const visibleCategories = useMemo(
    () => db.categories.filter((c) => categoryAllowed(c, cart.serviceId)),
    [db.categories, cart.serviceId],
  );

  // Kategori yang dipilih bisa tidak tersedia lagi setelah layanan berganti.
  useEffect(() => {
    if (categoryId !== "all" && !visibleCategories.some((c) => c.id === categoryId))
      setCategoryId("all");
  }, [categoryId, visibleCategories]);



  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allowed = new Set(visibleCategories.map((c) => c.id));
    return db.products.filter((p) => {
      if (!p.active) return false;
      if (p.categoryId && db.categories.some((c) => c.id === p.categoryId) && !allowed.has(p.categoryId))
        return false;
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.barcode.includes(q);
    });
  }, [db.products, db.categories, visibleCategories, query, categoryId]);

  const shiftOpen = !!activeShiftOf(db);

  function requireShift(): boolean {
    if (shiftOpen) return true;
    toast.error("Shift kasir belum dibuka. Buka shift dulu di menu Shift.");
    return false;
  }

  /**
   * Pastikan ada jenis layanan aktif di keranjang. Kalau belum, pakai layanan
   * bawaan (Express Service) supaya kasir bisa langsung memilih menu.
   * Mengembalikan undefined bila kasir masih harus memilih layanan.
   */
  function ensureService() {
    if (cart.orderType) return activeService ?? null;
    const svc = getServiceTypes(db).find((s) => s.active && s.isDefault);
    if (!svc) return undefined;
    setCart((prev) =>
      prev.orderType
        ? prev
        : {
            ...prev,
            orderType: svc.name,
            serviceId: svc.id,
            customerName: prev.customerName || (svc.kind === "dinein" ? "" : svc.name),
          },
    );
    return svc;
  }

  function addProduct(product: Product, variantName = "", priceDelta = 0, fixedPrice?: number) {
    if (!requireShift()) return;
    const svc = ensureService();
    if (svc === undefined) {
      toast.error("Pilih jenis layanan dulu.");
      setPickerOpen(true);
      return;
    }
    setCart((prev) => {
      const existing = fixedPrice != null ? undefined : prev.lines.find(
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
        unitPrice: (fixedPrice ?? servicePrice(product, activeService)) + priceDelta,
        qty: 1,
        note: "",
        discount: 0,
        staffName: "",
      };
      return { ...prev, lines: [...prev.lines, line] };
    });
  }

  function onProductClick(product: Product) {
    if (!requireShift()) return;
    if (!cart.orderType) {
      toast.error("Pilih jenis layanan dulu.");
      setPickerOpen(true);
      return;
    }
    if (product.openPrice) {
      setOpenPriceProduct(product);
      setOpenPriceValue("");
      return;
    }
    if (productHasOptions(product, db.modifiers ?? [])) {
      setVariantProduct(product);
      return;
    }
    addProduct(product);
  }


  function changeQty(lineId: string, delta: number) {
    const target = cart.lines.find((l) => l.lineId === lineId);
    if (!target || target.voided) return;
    if (target.sentToKitchen && delta < 0) {
      toast.error("Item sudah dikirim ke dapur. Gunakan Void untuk membatalkan.");
      return;
    }
    setCart((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    }));
  }

  function removeLine(lineId: string) {
    const target = cart.lines.find((l) => l.lineId === lineId);
    if (!target) return;
    if (target.sentToKitchen) {
      if (target.voided) return;
      setVoidTarget(target);
      return;
    }
    setCart((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.lineId !== lineId) }));
  }

  function saveLine(updated: CartLine) {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.lineId === updated.lineId ? updated : l)),
    }));
    setEditLine(null);
  }

  /** Ambil nomor order yang sudah ada, atau buat baru dari nomor urut store. */
  function ensureOrderNo(): string {
    if (cart.orderNo) return cart.orderNo;
    const seq = Math.max(1, settings.orderSeq || 1);
    const svc = getServiceTypes(db).find((x) => x.id === cart.serviceId);
    const no = svc ? `${svc.code}-${String(seq).padStart(6, "0")}` : formatOrderNo(cart.orderType, seq);
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
      memberId: member?.id,
      memberName: member?.name ?? "",
      memberCode: member?.code ?? "",
      memberDiscount: memberDisc,
      pointsUsed: pointDisc > 0 && loyalty.pointValue > 0 ? Math.round(pointDisc / loyalty.pointValue) : 0,
      pointDiscount: pointDisc,
      pointsEarned: member ? pointsFromSpend(totals.total, loyalty) : 0,
      pointBalance: member
        ? Math.max(
            0,
            member.points -
              (pointDisc > 0 && loyalty.pointValue > 0 ? Math.round(pointDisc / loyalty.pointValue) : 0),
          ) + pointsFromSpend(totals.total, loyalty)
        : undefined,
      status,
      reason: "",

    };
  }

  function showPrint(title: string, lines: string[], role: PrinterRole = "receipt") {
    setPrintTitle(title);
    setPrintRole(role);
    setPrintLines(lines);
  }

  function printBill() {
    if (cart.lines.length === 0) return;
    const orderNo = ensureOrderNo();
    const cfg = printerFor(db, "bill");
    const lines = buildReceipt("bill", draftSale("paid", { orderNo }), settings, layoutFor(db, cfg));
    if (cfg.autoPrint && cfg.id !== "legacy") {
      sendToPrinter(cfg, lines).catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Bill gagal dicetak."),
      );
    } else showPrint("Bill Sementara", lines, "bill");
  }

  function sendToKitchen() {
    if (cart.lines.filter((l) => !l.voided).length === 0) return;
    const orderNo = ensureOrderNo();
    const lines = cart.lines.map((l) => ({ ...l, sentToKitchen: true }));
    const sale = draftSale("paid", { lines, orderNo });
    const kitchenId = cart.kitchenId ?? uid("kit");
    const kEntry = {
      id: kitchenId,
      orderNo,
      label: [orderNo, cart.orderType, cart.tableName || cart.customerName].filter(Boolean).join(" • "),
      createdAt: new Date().toISOString(),
      items: lines.filter((l) => !l.voided),
      note: cart.note,
      status: "processing" as const,
    };
    update((current) => {
      const list = current.kitchenOrders ?? [];
      return {
        ...current,
        kitchenOrders: list.some((k) => k.id === kitchenId)
          ? list.map((k) => (k.id === kitchenId ? { ...kEntry, createdAt: k.createdAt } : k))
          : [kEntry, ...list],
      };
    });
    // Kalau pesanan ini memang sudah tertahan, perbarui isinya (tanpa membuat duplikat).
    if (cart.heldId) saveHeld({ lines, orderNo, sentToKitchen: true });
    setCart((prev) => ({ ...prev, lines, orderNo, sentToKitchen: true, kitchenId }));
    toast.success(`Pesanan ${orderNo} dikirim ke dapur.`);
    if (db.printer.autoPrintOnSend !== false) printStations(sale);
  }

  /** Cetak label manual dari keranjang (satu menu atau semua), ke printer Kitchen/Bar sesuai menu. */
  function printLabels(target: CartLine[]) {
    if (!requireShift()) return;
    const items = target.filter((l) => !l.voided);
    if (items.length === 0) {
      toast.error("Tidak ada item untuk dicetak.");
      return;
    }
    const orderNo = ensureOrderNo();
    const sale = draftSale("paid", { orderNo });
    const groups: Record<"kitchen" | "bar", CartLine[]> = { kitchen: [], bar: [] };
    for (const l of items) groups[productStation(db.products.find((p) => p.id === l.productId))].push(l);
    for (const station of ["kitchen", "bar"] as const) {
      if (groups[station].length === 0) continue;
      const cfg = printerFor(db, station);
      const out = buildReceipt("label", { ...sale, items: groups[station] }, settings, layoutFor(db, cfg));
      sendToPrinter(cfg, out)
        .then(() => toast.success(`Label dikirim ke ${cfg.name}.`))
        .catch((error: unknown) =>
          toast.error(`${cfg.name}: ${error instanceof Error ? error.message : "gagal mencetak."}`),
        );
    }
  }

  /** Cetak tiket/label ke printer Kitchen dan Bar sesuai pengaturan tiap menu. */
  function printStations(sale: Sale) {
    const groups = splitByStation(db, sale.items);
    const preview: string[] = [];
    for (const station of ["kitchen", "bar"] as const) {
      const items = groups[station];
      if (items.length === 0) continue;
      const part = { ...sale, items };
      for (const cfg of printersFor(db, station)) {
        const layout = layoutFor(db, cfg);
        const out: string[] = [];
        if (cfg.printTicket !== false) out.push(...buildReceipt("order", part, settings, layout));
        if (cfg.printLabels) out.push(...(out.length ? [""] : []), ...buildReceipt("label", part, settings, layout));
        if (out.length === 0) continue;
        if (station === "bar") out[0] = out[0]?.replace("PESANAN DAPUR", "PESANAN BAR ") ?? "";
        if (cfg.autoPrint) {
          sendToPrinter(cfg, out).catch((error: unknown) =>
            toast.error(`${cfg.name}: ${error instanceof Error ? error.message : "gagal mencetak."}`),
          );
        } else {
          preview.push(...(preview.length ? ["", ""] : []), ...out);
        }
      }
    }
    if (preview.length) showPrint("Tiket Dapur / Bar", preview, "kitchen");
  }

  function saveHeld(
    override: { lines?: CartLine[]; orderNo?: string; sentToKitchen?: boolean } = {},
  ) {
    const kitchenId = cart.kitchenId;
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
      serviceId: cart.serviceId,
      orderNo,
      note: cart.note,
      sentToKitchen: override.sentToKitchen ?? cart.sentToKitchen,
      kitchenId,
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
    const lines = cart.lines.map((l) =>
      l.lineId === lineId ? { ...l, voided: true, voidReason: reason, voidedBy: byName } : l,
    );
    setCart((prev) => ({ ...prev, lines }));
    if (cart.heldId) {
      const heldId = cart.heldId;
      update((current) => ({
        ...current,
        heldOrders: current.heldOrders.map((h) => (h.id === heldId ? { ...h, items: lines } : h)),
      }));
    }
    setVoidTarget(null);
    toast.success("Item di-void dengan otorisasi " + byName + ".");
  }

  function voidHeldOrder(id: string, reason: string, byName: string) {
    const held = db.heldOrders.find((h) => h.id === id);
    if (!held) return;
    const t = computeTotals(held.items, settings, 0);
    const sale: Sale = {
      id: uid("sale"),
      code: "VOID" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" +
        String(db.sales.length + 1).padStart(4, "0"),
      createdAt: new Date().toISOString(),
      userName: currentUser?.name ?? "Kasir",
      items: held.items,
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      service: t.service,
      total: t.total,
      payments: [],
      paid: 0,
      change: 0,
      tableName: held.tableName,
      customerName: held.customerName,
      orderType: held.orderType ?? "",
      orderNo: held.orderNo ?? "",
      note: held.note ?? "",
      status: "void",
      reason: `${reason} — disetujui ${byName}`,
    };
    update((current) => ({
      ...current,
      sales: [sale, ...current.sales],
      heldOrders: current.heldOrders.filter((h) => h.id !== id),
      kitchenOrders: (current.kitchenOrders ?? []).filter((k) => k.id !== held.kitchenId),
    }));
    if (cart.heldId === id) setCart(EMPTY_CART);
    setVoidHeld(null);
    toast.success(`Pesanan ${held.orderNo || held.label} di-void oleh ${byName}.`);
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
      serviceId: held.serviceId,
      heldId: held.id,
      note: held.note ?? "",
      orderNo: held.orderNo ?? "",
      sentToKitchen: held.sentToKitchen ?? held.items.some((i) => i.sentToKitchen),
      kitchenId: held.kitchenId,
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
    const used = sale.pointsUsed ?? 0;
    const earned = sale.pointsEarned ?? 0;
    const now = new Date().toISOString();
    const ledger: MemberPoint[] = [];
    if (sale.memberId && used > 0)
      ledger.push({
        id: uid("mpt"),
        memberId: sale.memberId,
        createdAt: now,
        type: "redeem",
        points: -used,
        note: `Potongan ${rupiah(sale.pointDiscount ?? 0)}`,
        saleId: sale.id,
        saleCode: sale.code,
        userName: sale.userName,
      });
    if (sale.memberId && earned > 0)
      ledger.push({
        id: uid("mpt"),
        memberId: sale.memberId,
        createdAt: now,
        type: "earn",
        points: earned,
        note: `Belanja ${rupiah(sale.total)}`,
        saleId: sale.id,
        saleCode: sale.code,
        userName: sale.userName,
      });

    update((current) => ({
      ...current,
      ...applyStock(current, sale.items, -1, { note: `Penjualan ${sale.code}`, saleCode: sale.code, userName: sale.userName }),
      sales: [sale, ...current.sales],
      heldOrders: cart.heldId
        ? current.heldOrders.filter((h) => h.id !== cart.heldId)
        : current.heldOrders,
      members: sale.memberId
        ? membersOf(current).map((m) =>
            m.id === sale.memberId
              ? {
                  ...m,
                  points: Math.max(0, m.points - used) + earned,
                  totalSpend: m.totalSpend + sale.total,
                  visits: m.visits + 1,
                }
              : m,
          )
        : membersOf(current),
      memberPoints: ledger.length ? [...memberPointsOf(current), ...ledger] : memberPointsOf(current),
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
    const receiptPrinter = printerFor(db, "receipt");
    const lines = buildReceipt("receipt", sale, settings, layoutFor(db, receiptPrinter));
    if (receiptPrinter.autoPrint) {
      sendToPrinter(receiptPrinter, lines)
        .then(() => toast.success(`Pembayaran ${rupiah(sale.total)} tersimpan. Struk dicetak.`))
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : "Struk gagal dicetak."),
        );
    } else {
      showPrint("Struk Penjualan", lines, "receipt");
      toast.success(`Pembayaran ${rupiah(sale.total)} tersimpan.`);
    }
  }

  const itemCount = cart.lines.filter((l) => !l.voided).reduce((sum, l) => sum + l.qty, 0);


  function newOrder() {
    if (!requireShift()) return;
    if (cart.lines.length > 0) holdOrder();
    else setCart(EMPTY_CART);
    setPickerOpen(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:h-screen lg:flex-row">
      {/* Daftar produk */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b bg-card px-4 py-3">
          {!shiftOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <span className="font-semibold text-destructive">
                Shift kasir belum dibuka — transaksi tidak bisa dimulai.
              </span>
              <Button asChild size="sm" className="h-8">
                <Link to="/shift">Buka Shift</Link>
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <span className="text-sm font-semibold text-primary">
              {cart.orderNo && <span className="tabular mr-2 font-mono">{cart.orderNo}</span>}
              {cart.orderType || "Belum pilih layanan"}
              {cart.tableName && ` • ${cart.tableName}`}
              {cart.sentToKitchen && <span className="ml-2 text-xs">• sudah di dapur</span>}
            </span>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 gap-1" onClick={newOrder}>
                <Plus className="size-4" /> New Order
              </Button>
            </div>
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
            <Button variant="secondary" className="h-11 gap-2" onClick={() => setKitchenOpen(true)}>
              <ChefHat className="size-4" />
              <span className="hidden sm:inline">Diproses</span>
              {processingCount > 0 && <Badge variant="default">{processingCount}</Badge>}
            </Button>
            <Button variant="secondary" className="h-11 gap-2" onClick={() => requireShift() && setHeldOpen(true)}>
              <Play className="size-4" />
              <span className="hidden sm:inline">Tertahan</span>
              {db.heldOrders.length > 0 && <Badge variant="default">{db.heldOrders.length}</Badge>}
            </Button>
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 pb-1">
              <CategoryChip
                active={categoryId === "all"}
                label="Semua"
                onClick={() => setCategoryId("all")}
              />
              {visibleCategories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={categoryId === c.id}
                  label={c.name}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
          </div>
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
                  aria-disabled={!shiftOpen || !cart.orderType}
                  className="flex min-h-24 aria-disabled:opacity-50 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
                >
                  <span className="line-clamp-2 text-sm font-semibold">{product.name}</span>
                  <span className="mt-2 block">
                    <span className="tabular block font-bold text-primary">
                      {product.openPrice ? "Harga bebas" : rupiah(servicePrice(product, activeService))}
                    </span>
                    {product.stock != null && (
                      <span
                        className={`text-xs ${product.stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        Stok {product.stock}
                      </span>
                    )}
                    {productHasOptions(product, db.modifiers ?? []) && (
                      <span className="text-xs text-muted-foreground">Ada pilihan</span>
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
          onPay={() => requireShift() && setPayOpen(true)}
          onBill={printBill}
          onKitchen={sendToKitchen}
          onHold={holdOrder}
          onPrintLabels={printLabels}
          memberDiscount={memberDisc}
          pointDiscount={pointDisc}

        />
      </aside>

      {/* Bar keranjang mobile */}
      <div className={`fixed inset-x-0 bottom-16 z-30 border-t bg-card p-3 md:bottom-0 md:left-60 lg:hidden ${cart.lines.length === 0 ? "hidden" : ""}`}>
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
        <SheetContent
          side="bottom"
          className="flex h-[88dvh] max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 pt-12 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-muted [&>button]:p-1.5 [&>button]:opacity-100"
        >
          <SheetHeader className="absolute left-4 top-3.5 p-0">
            <SheetTitle className="text-base">Keranjang</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
          <CartPanel
            split
            cart={cart}
            setCart={setCart}
            totals={totals}
            onEditLine={setEditLine}
            onChangeQty={changeQty}
            onRemoveLine={removeLine}
            onPay={() => requireShift() && setPayOpen(true)}
            onBill={printBill}
            onKitchen={sendToKitchen}
            onHold={holdOrder}
            onPrintLabels={printLabels}
            memberDiscount={memberDisc}
            pointDiscount={pointDisc}

          />
          </div>
        </SheetContent>
      </Sheet>

      {/* Open Price */}
      <Dialog open={!!openPriceProduct} onOpenChange={(v) => !v && setOpenPriceProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{openPriceProduct?.name}</DialogTitle>
            <DialogDescription>Masukkan harga untuk item ini.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const val = Math.round(Number(openPriceValue));
              if (!openPriceProduct || !(val > 0)) {
                toast.error("Isi harga lebih dari 0.");
                return;
              }
              addProduct(openPriceProduct, "", 0, val);
              setOpenPriceProduct(null);
            }}
          >
            <Input
              autoFocus
              inputMode="numeric"
              className="tabular h-14 text-center text-2xl font-bold"
              placeholder="0"
              value={openPriceValue ? Number(openPriceValue).toLocaleString("id-ID") : ""}
              onChange={(e) => setOpenPriceValue(e.target.value.replace(/\D/g, "").slice(0, 12))}
            />
            <div className="grid grid-cols-3 gap-2">
              {[10000, 20000, 50000, 100000, 150000, 200000].map((n) => (
                <Button key={n} type="button" variant="outline" onClick={() => setOpenPriceValue(String(n))}>
                  {n.toLocaleString("id-ID")}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12 w-full">Tambah ke keranjang</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pilih varian / ukuran / topping / modifier */}
      <OptionPicker
        product={variantProduct}
        basePrice={variantProduct ? servicePrice(variantProduct, activeService) : undefined}
        service={activeService}
        modifiers={db.modifiers ?? []}
        onClose={() => {
          setVariantProduct(null);
          setOptionLine(null);
        }}
        onAdd={(label, extra) => {
          if (variantProduct && optionLine) {
            const base = {
              ...optionLine,
              variantName: label,
              unitPrice: servicePrice(variantProduct, activeService) + extra,
            };

            setCart((prev) => ({
              ...prev,
              lines: prev.lines.map((l) => (l.lineId === base.lineId ? base : l)),
            }));
            setOptionLine(null);
          } else if (variantProduct) addProduct(variantProduct, label, extra);
          setVariantProduct(null);
        }}
      />

      <LineEditor
        line={editLine}
        onClose={() => setEditLine(null)}
        onSave={saveLine}
        onChangeOptions={(() => {
          const p = editLine && db.products.find((x) => x.id === editLine.productId);
          if (!p || !productHasOptions(p, db.modifiers ?? [])) return undefined;
          return (draft: CartLine) => {
            setOptionLine(draft);
            setEditLine(null);
            setVariantProduct(p);
          };
        })()}
        staffNames={db.staff.map((s) => s.name)}
        showStaff={settings.businessType === "jasa"}
      />

      <VoidDialog
        line={voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={voidLine}
      />

      <VoidDialog
        whole
        line={voidHeld ? { lineId: voidHeld.id, name: voidHeld.orderNo || voidHeld.label } : null}
        onClose={() => setVoidHeld(null)}
        onConfirm={voidHeldOrder}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={totals.total}
        serviceId={cart.serviceId}
        onComplete={completeSale}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
          </DialogHeader>
          <ServicePicker
            onPick={(orderType, tableName, serviceId) => {
              setCart((prev) => ({
                ...EMPTY_CART,
                ...(prev.lines.length ? prev : {}),
                orderType,
                tableName,
                serviceId,
                customerName: prev.lines.length && prev.customerName ? prev.customerName : tableName ? "" : orderType,
              }));
              setPickerOpen(false);
            }}
            onOpenHeld={(id) => {
              recallOrder(id);
              setPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={heldOpen} onOpenChange={setHeldOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 sm:max-w-xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>Pesanan Tertahan ({db.heldOrders.length})</SheetTitle>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-4 pb-6 sm:grid-cols-2">
            {db.heldOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada pesanan tertahan.</p>
            )}
            {db.heldOrders.map((h) => (
              <div key={h.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{heldTitle(h)}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Void pesanan"
                    onClick={() => setVoidHeld(h)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {heldMeta(h) && (
                  <p className="text-xs text-muted-foreground">{heldMeta(h)}</p>
                )}
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

      <Sheet open={kitchenOpen} onOpenChange={setKitchenOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Pesanan Dapur</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 overflow-auto px-4 pb-6">
            {kitchenOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada pesanan di dapur.</p>
            )}
            {[...kitchenOrders]
              .sort((a, b) => (a.status === b.status ? 0 : a.status === "processing" ? -1 : 1))
              .slice(0, 50)
              .map((k) => (
                <div key={k.id} className={"rounded-lg border p-3 " + (k.status === "done" ? "opacity-60" : "")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{k.label || k.orderNo}</p>
                    <Badge variant={k.status === "processing" ? "default" : "secondary"}>
                      {k.status === "processing" ? "Diproses" : "Done"}
                    </Badge>
                  </div>
                  <ul className="mt-1 text-sm">
                    {k.items.map((i) => (
                      <li key={i.lineId}>
                        {i.qty}× {i.name}
                        {i.variantName && ` (${i.variantName})`}
                        {i.note && <span className="text-muted-foreground"> — {i.note}</span>}
                      </li>
                    ))}
                  </ul>
                  {k.note && <p className="mt-1 text-xs text-muted-foreground">Catatan: {k.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(k.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <Button
                    size="sm"
                    variant={k.status === "processing" ? "default" : "outline"}
                    className="mt-2 w-full"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        kitchenOrders: (current.kitchenOrders ?? []).map((x) =>
                          x.id === k.id
                            ? { ...x, status: x.status === "processing" ? "done" : "processing" }
                            : x,
                        ),
                      }))
                    }
                  >
                    {k.status === "processing" ? "Tandai Done" : "Kembalikan ke Diproses"}
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
        role={printRole}
      />
    </div>
  );
}

function ServicePicker({
  onPick,
  onOpenHeld,
}: {
  onPick: (orderType: string, tableName: string, serviceId: string) => void;
  onOpenHeld: (id: string) => void;
}) {
  const { db } = usePos();
  const [picked, setPicked] = useState<ServiceType | null>(null);
  const mode = picked?.kind === "dinein" ? "dinein" : "";
  const services = getServiceTypes(db).filter((x) => x.active);

  const big =
    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card p-5 text-center transition-colors hover:border-primary hover:bg-primary/5";

  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold">
          {mode === "dinein" ? `${picked?.name} — Pilih Meja / Room` : "Pilih Jenis Layanan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "" ? "Tentukan layanan sebelum memilih menu." : "Ketuk salah satu untuk lanjut ke menu."}
        </p>
        {mode !== "" && (
          <Button variant="link" className="h-auto px-0" onClick={() => setPicked(null)}>
            ← Kembali ke jenis layanan
          </Button>
        )}
      </div>

      {mode === "" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {services.map((svc) => {
            const Icon = serviceIcon(svc);
            return (
              <button
                key={svc.id}
                type="button"
                className={big}
                onClick={() => (svc.kind === "dinein" ? setPicked(svc) : onPick(svc.name, "", svc.id))}
              >
                <Icon className="size-8 text-primary" />
                <span className="text-lg font-semibold">{svc.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{svc.code}</span>
              </button>
            );
          })}
          {services.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Belum ada jenis layanan aktif. Atur di Pengaturan → Jenis Layanan.
            </p>
          )}
        </div>
      )}

      {mode === "dinein" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {db.tables.map((t) => {
            const held = db.heldOrders.find((h) => !!h.tableName && h.tableName === t.name);
            return (
              <button
                key={t.id}
                type="button"
                className={
                  big +
                  " min-h-20" +
                  (held ? " border-accent bg-accent text-accent-foreground hover:bg-accent/80" : "")
                }
                onClick={() => (held ? onOpenHeld(held.id) : onPick(picked!.name, t.name, picked!.id))}
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


      {mode === "" && db.heldOrders.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Pesanan Tertahan</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {db.heldOrders.map((h) => (
              <button
                key={h.id}
                type="button"
                className="rounded-lg border-2 border-accent bg-accent/10 p-3 text-left hover:bg-accent/20"
                onClick={() => onOpenHeld(h.id)}
              >
                <p className="font-semibold">{heldTitle(h)}</p>
                {heldMeta(h) && (
                  <p className="text-xs text-muted-foreground">{heldMeta(h)}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {h.items.filter((i) => !i.voided).reduce((s, i) => s + i.qty, 0)} item • Buka pesanan
                </p>
              </button>
            ))}
          </div>
        </div>
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
  onPrintLabels,
  memberDiscount = 0,
  pointDiscount = 0,
  split = false,
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
  onPrintLabels: (lines: CartLine[]) => void;
  memberDiscount?: number;
  pointDiscount?: number;
  split?: boolean;
}) {
  const { db } = usePos();
  const type = db.settings.businessType;
  const loyalty = loyaltyOf(db.settings);
  const member = membersOf(db).find((m) => m.id === cart.memberId) ?? null;
  const [memberOpen, setMemberOpen] = useState(false);


  return (
    <div
      className={
        "flex h-full min-h-0 flex-col " +
        (split ? "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-[minmax(0,1fr)]" : "")
      }
    >
      <div
        className={
          "max-h-[32%] shrink-0 space-y-2 overflow-y-auto border-b px-4 py-3 " +
          (split ? "md:max-h-none md:border-b-0" : "")
        }
      >
        {split && (
          <p className="hidden text-sm font-semibold md:block">
            {cart.orderType || "Pesanan"}
            {cart.tableName ? ` • ${cart.tableName}` : ""}
          </p>
        )}
        {(getServiceTypes(db).find((x) => x.id === cart.serviceId)?.kind === "dinein" ||
          (!cart.serviceId && cart.orderType === "Dine In")) && (
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
        {cart.orderNo && (
          <p className="tabular font-mono text-xs font-semibold text-primary">
            Nomor order {cart.orderNo}
          </p>
        )}
        <Input
          value={cart.customerName}
          onChange={(e) => setCart((prev) => ({ ...prev, customerName: e.target.value }))}
          placeholder={type === "jasa" ? "Nama pelanggan" : "Nama pelanggan (opsional)"}
          className="h-10"
        />
        {loyalty.enabled && (
          <div className="rounded-lg border p-2">
            {member ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {member.code} • {member.points} poin
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" className="h-8" onClick={() => setMemberOpen(true)}>
                    Ganti
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() =>
                      setCart((prev) => ({
                        ...prev,
                        memberId: undefined,
                        memberName: "",
                        memberCode: "",
                        redeemPoints: 0,
                      }))
                    }
                  >
                    Lepas
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="h-9 w-full gap-2 text-sm"
                onClick={() => setMemberOpen(true)}
              >
                <Users className="size-4" /> Pilih / daftar member
              </Button>
            )}
          </div>
        )}
        <MemberPicker
          open={memberOpen}
          onOpenChange={setMemberOpen}
          onPick={(m) =>
            setCart((prev) => ({
              ...prev,
              memberId: m.id,
              memberName: m.name,
              memberCode: m.code,
              redeemPoints: 0,
              customerName: prev.customerName || m.name,
            }))
          }
        />

        <Textarea
          id="order-note"
          value={cart.note}
          onChange={(e) => setCart((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="Catatan pesanan (opsional)"
          className="min-h-9"
          rows={2}
        />
      </div>

      <div className={"flex min-h-0 flex-1 flex-col " + (split ? "md:border-l" : "")}>
      <div className="min-h-[35%] flex-1 overflow-auto px-2 py-2">
        {cart.lines.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Keranjang kosong. Pilih produk untuk mulai transaksi.
          </p>
        ) : (
          <ul className="space-y-1">
            <li className="flex justify-end px-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={cart.lines.every((l) => l.voided)}
                onClick={() => onPrintLabels(cart.lines)}
              >
                <Tags className="size-3.5" /> Cetak semua label
              </Button>
            </li>
            {cart.lines.map((line) => (
              <li
                key={line.lineId}
                className={`rounded-lg p-2 hover:bg-muted/60 ${line.voided ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    disabled={line.voided}
                    onClick={() => onEditLine(line)}
                  >
                    <p
                      className={`truncate text-sm font-semibold ${line.voided ? "line-through" : ""}`}
                    >
                      {line.name}
                    </p>
                    {line.variantName && (
                      <p className="break-words text-xs text-muted-foreground">{line.variantName}</p>
                    )}
                    {line.voided ? (
                      <p className="text-xs font-medium text-destructive">
                        VOID{line.voidReason ? ` · ${line.voidReason}` : ""}
                        {line.voidedBy ? ` · oleh ${line.voidedBy}` : ""}
                      </p>
                    ) : (
                      line.sentToKitchen && (
                        <p className="text-xs font-medium text-primary">Sudah di dapur</p>
                      )
                    )}
                    <p className="tabular text-xs text-muted-foreground">
                      {rupiah(line.unitPrice)}
                      {line.discount > 0 && ` · diskon ${rupiah(line.discount)}`}
                      {!line.voided && <span className="ml-1 font-medium text-primary">· Ubah</span>}
                    </p>
                    {line.note && <p className="text-xs text-accent-foreground">* {line.note}</p>}
                    {line.staffName && (
                      <p className="text-xs text-muted-foreground">Oleh {line.staffName}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground"
                      aria-label="Cetak label"
                      title="Cetak label menu ini"
                      disabled={line.voided}
                      onClick={() => onPrintLabels([line])}
                    >
                      <Printer className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8"
                      aria-label="Kurangi"
                      disabled={line.voided || line.sentToKitchen}
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
                      disabled={line.voided}
                      onClick={() => onChangeQty(line.lineId, 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    {line.sentToKitchen ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs font-semibold text-destructive"
                        disabled={line.voided}
                        onClick={() => onRemoveLine(line.lineId)}
                      >
                        Void
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground"
                        aria-label="Hapus"
                        onClick={() => onRemoveLine(line.lineId)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="tabular mt-1 text-right text-sm font-semibold">
                  {line.voided ? "—" : rupiah(lineTotal(line))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={"shrink-0 space-y-3 overflow-y-auto border-t px-4 py-3 " + (split ? "max-h-[45%] md:max-h-[55%]" : "max-h-[45%]")}>
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
          {memberDiscount > 0 && (
            <Row
              label={`Diskon member ${loyalty.memberDiscountPercent}%`}
              value={"−" + rupiah(memberDiscount)}
            />
          )}
          {member && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Tukar poin{" "}
                <span className="tabular text-xs">
                  (maks {maxRedeemable(member, Math.max(0, totals.subtotal - totals.discount + memberDiscount + pointDiscount), loyalty)})
                </span>
              </span>
              <Input
                inputMode="numeric"
                value={cart.redeemPoints ? String(cart.redeemPoints) : ""}
                onChange={(e) => {
                  const wanted = Number(e.target.value.replace(/\D/g, "")) || 0;
                  const cap = maxRedeemable(
                    member,
                    Math.max(0, totals.subtotal - totals.discount + memberDiscount + pointDiscount),
                    loyalty,
                  );
                  setCart((prev) => ({ ...prev, redeemPoints: Math.min(wanted, cap) }));
                }}
                placeholder="0"
                className="tabular h-8 w-28 text-right"
              />
            </div>
          )}
          {pointDiscount > 0 && (
            <Row label="Potongan poin" value={"−" + rupiah(pointDiscount)} />
          )}

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
          {type === "kuliner" && cart.lines.some((l) => !l.sentToKitchen && !l.voided) ? (
            <Button
              variant="secondary"
              className="h-11 gap-2"
              disabled={cart.lines.length === 0}
              onClick={onKitchen}
            >
              <ChefHat className="size-4" /> Sent to Kitchen
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="h-11 gap-2"
              disabled={cart.lines.length === 0}
              onClick={onHold}
            >
              <Pause className="size-4" /> Hold
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
  onChangeOptions,
}: {
  line: CartLine | null;
  onClose: () => void;
  onSave: (line: CartLine) => void;
  staffNames: string[];
  showStaff: boolean;
  onChangeOptions?: ((line: CartLine) => void) | undefined;
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
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {onChangeOptions && !draft.sentToKitchen && (
            <Button variant="outline" className="w-full" onClick={() => onChangeOptions(draft)}>
              Ubah pilihan (varian / ukuran / topping / modifier)
            </Button>
          )}
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
  serviceId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  serviceId?: string | undefined;
  onComplete: (payments: SalePayment[]) => void;
}) {
  const { db } = usePos();
  const allowSplit = (db.serviceTypes ?? []).find((s) => s.id === serviceId)?.allowSplit !== false;
  const methods = db.paymentMethods.filter(
    (m) =>
      m.active &&
      (!m.serviceIds || m.serviceIds.length === 0 || !serviceId || m.serviceIds.includes(serviceId)),
  );
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
  const cashValue = method?.isCash ? entered : amount ? Math.min(entered, remaining) : remaining;
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

  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (!open) setConfirming(false); }, [open]);

  function validate() {
    if (!method) return false;
    if (method.isCash && entered < remaining) {
      toast.error("Uang tunai belum cukup untuk melunasi transaksi.");
      return false;
    }
    if (!method.isCash && amount && entered < remaining) {
      toast.error(allowSplit ? "Nominal belum melunasi. Tekan \"Bayar sebagian\" atau kosongkan nominal." : "Layanan ini harus dibayar lunas sekaligus.");
      return false;
    }
    return true;
  }

  function finish() {
    if (!method || !validate()) return;
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
                type="button"
                onClick={() => {
                  setMethodId(m.id);
                  setAmount("");
                }}
              >
                {m.name}
              </Button>
            ))}
          </div>

          {method && (
            <div className="space-y-2">
              <Label htmlFor="cash-received">
                {method.isCash ? "Uang diterima" : `Nominal ${method.name} (kosong = sisa tagihan)`}
              </Label>
              <Input
                id="cash-received"
                inputMode="numeric"
                autoFocus
                value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={method.isCash ? "0" : remaining.toLocaleString("id-ID")}
                className="tabular h-14 text-right text-2xl font-bold"
              />
              <div className="flex flex-wrap gap-2">
                {(method.isCash ? quick : [remaining].filter((v) => v > 0)).map((v) => (
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
              {method.isCash && <p className="tabular text-sm text-muted-foreground">
                Kembalian: <span className="font-semibold text-foreground">{rupiah(change)}</span>
              </p>}
            </div>
          )}

          {split.length > 0 && (
            <ul className="space-y-1 rounded-lg border p-2 text-sm">
              {split.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.methodName}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{rupiah(p.amount)}</span>
                    <button
                      type="button"
                      aria-label="Hapus pembayaran"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setSplit((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {confirming && method ? (
          <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="font-semibold">Selesaikan pembayaran?</p>
            <div className="tabular space-y-1 text-sm">
              {split.map((p, i) => (
                <div key={i} className="flex justify-between"><span>{p.methodName}</span><span>{rupiah(p.amount)}</span></div>
              ))}
              <div className="flex justify-between"><span>{method.name}</span><span>{rupiah(method.isCash ? entered : remaining)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{rupiah(total)}</span></div>
              {method.isCash && <div className="flex justify-between"><span>Kembalian</span><span className="font-semibold">{rupiah(change)}</span></div>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-12 flex-1" onClick={() => setConfirming(false)}>Batal</Button>
              <Button className="h-12 flex-1 text-base font-bold" autoFocus onClick={() => { setConfirming(false); finish(); }}>Ya, selesaikan</Button>
            </div>
          </div>
        ) : (
        <DialogFooter className="gap-2 sm:justify-between">
          {allowSplit ? (
            <Button variant="secondary" onClick={addSplit} disabled={remaining <= 0}>
              Bayar sebagian
            </Button>
          ) : <span />}
          <Button className="h-12 text-base font-bold" onClick={() => { if (validate()) setConfirming(true); }}>
            Selesaikan
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({
  line,
  whole = false,
  onClose,
  onConfirm,
}: {
  line: { lineId: string; name: string } | null;
  whole?: boolean;
  onClose: () => void;
  onConfirm: (lineId: string, reason: string, byName: string) => void;
}) {
  const { db } = usePos();
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (line) {
      setPin("");
      setReason("");
    }
  }, [line]);

  function submit() {
    if (!line) return;
    const approver = db.users.find((u) => u.pin === pin && hasPerm(db.settings, u.role, "order.void"));
    if (!approver) {
      toast.error("PIN tidak valid atau peran tidak berwenang. Perlu pengguna dengan izin void.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Alasan void wajib diisi.");
      return;
    }
    onConfirm(line.lineId, reason.trim(), `${approver.name} (${roleLabel(approver.role)})`);
  }

  return (
    <Dialog open={!!line} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{whole ? "VOID pesanan" : "Void item"}</DialogTitle>
          <DialogDescription>
            {whole
              ? `Seluruh pesanan ${line?.name ?? ""} akan di-void dan tercatat di laporan void.`
              : `${line?.name ?? ""} sudah dikirim ke dapur, jadi tidak bisa dihapus.`}{" "}
            Void memerlukan otorisasi supervisor atau manager.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="void-reason">Alasan</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: salah input"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="void-pin">PIN supervisor/manager</Label>
            <Input
              id="void-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant={whole ? "destructive" : "default"} onClick={submit}>
            {whole ? "VOID pesanan" : "Void item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
