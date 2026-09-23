import type { BusinessType, PosDatabase, Product } from "./types";
import { uid } from "./format";

function p(
  name: string,
  categoryId: string,
  price: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id: uid("prd"),
    name,
    categoryId,
    price,
    unit: "pcs",
    barcode: "",
    stock: null,
    active: true,
    variants: [],
    ...extra,
  };
}

export function emptyDatabase(): PosDatabase {
  return {
    version: 1,
    settings: {
      activated: false,
      storeCode: "",
      businessType: "kuliner",
      name: "Toko Saya",
      address: "",
      phone: "",
      taxEnabled: false,
      taxPercent: 11,
      serviceEnabled: false,
      servicePercent: 5,
    },
    printer: {
      paperWidth: 32,
      header1: "",
      header2: "",
      footer: "Terima kasih atas kunjungan Anda",
      marginTop: 0,
      marginBottom: 3,
      autoPrintOnPay: false,
      deviceName: "",
    },
    users: [],
    categories: [],
    products: [],
    paymentMethods: [
      { id: "pm_cash", name: "Tunai", isCash: true, active: true },
      { id: "pm_qris", name: "QRIS", isCash: false, active: true },
      { id: "pm_debit", name: "Kartu Debit/Kredit", isCash: false, active: true },
      { id: "pm_transfer", name: "Transfer Bank", isCash: false, active: true },
    ],
    tables: [],
    staff: [],
    onlineChannels: [
      { id: "oc_grab", name: "GrabFood", active: true },
      { id: "oc_gofood", name: "GoFood", active: true },
      { id: "oc_shopee", name: "ShopeeFood", active: true },
    ],
    sales: [],
    heldOrders: [],
    shifts: [],
  };
}

export function seedForBusiness(db: PosDatabase, type: BusinessType): PosDatabase {
  const next: PosDatabase = { ...db };
  next.settings = { ...db.settings, businessType: type };

  if (type === "kuliner") {
    const kopi = { id: uid("cat"), name: "Kopi" };
    const nonKopi = { id: uid("cat"), name: "Non-Kopi" };
    const makanan = { id: uid("cat"), name: "Makanan" };
    next.categories = [kopi, nonKopi, makanan];
    next.products = [
      p("Kopi Susu Gula Aren", kopi.id, 22000, {
        variants: [
          { id: uid("var"), name: "Hot", priceDelta: 0 },
          { id: uid("var"), name: "Iced", priceDelta: 3000 },
        ],
      }),
      p("Americano", kopi.id, 18000, {
        variants: [
          { id: uid("var"), name: "Hot", priceDelta: 0 },
          { id: uid("var"), name: "Iced", priceDelta: 2000 },
        ],
      }),
      p("Matcha Latte", nonKopi.id, 25000),
      p("Teh Lemon", nonKopi.id, 15000),
      p("Nasi Ayam Sambal Matah", makanan.id, 32000),
      p("Roti Bakar Cokelat", makanan.id, 18000),
    ];
    next.tables = Array.from({ length: 8 }, (_, i) => ({
      id: uid("tbl"),
      name: "Meja " + (i + 1),
    }));
    next.settings.serviceEnabled = true;
  }

  if (type === "retail") {
    const minuman = { id: uid("cat"), name: "Minuman" };
    const snack = { id: uid("cat"), name: "Snack" };
    const rumah = { id: uid("cat"), name: "Kebutuhan Rumah" };
    next.categories = [minuman, snack, rumah];
    next.products = [
      p("Air Mineral 600ml", minuman.id, 4000, { stock: 48, barcode: "8991002101234" }),
      p("Teh Kotak 250ml", minuman.id, 5000, { stock: 36, barcode: "8991002105678" }),
      p("Keripik Kentang 68g", snack.id, 12000, { stock: 24 }),
      p("Biskuit Cokelat", snack.id, 9500, { stock: 30 }),
      p("Sabun Cuci 800ml", rumah.id, 21000, { stock: 15 }),
      p("Beras 5kg", rumah.id, 68000, { stock: 10, unit: "sak" }),
    ];
  }

  if (type === "jasa") {
    const rambut = { id: uid("cat"), name: "Rambut" };
    const perawatan = { id: uid("cat"), name: "Perawatan" };
    next.categories = [rambut, perawatan];
    next.products = [
      p("Potong Rambut Pria", rambut.id, 45000, { unit: "layanan" }),
      p("Potong Rambut Wanita", rambut.id, 65000, { unit: "layanan" }),
      p("Cuci + Blow", rambut.id, 50000, { unit: "layanan" }),
      p("Creambath", perawatan.id, 90000, { unit: "layanan" }),
      p("Facial Basic", perawatan.id, 120000, { unit: "layanan" }),
    ];
    next.staff = [
      { id: uid("stf"), name: "Rina" },
      { id: uid("stf"), name: "Dewi" },
      { id: uid("stf"), name: "Bagus" },
    ];
  }

  return next;
}
