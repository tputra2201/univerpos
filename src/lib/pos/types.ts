export type BusinessType = "kuliner" | "retail" | "jasa";

export interface StoreSettings {
  activated: boolean;
  storeCode: string;
  businessType: BusinessType;
  /** Nama tipe usaha dari panel kontrol. */
  businessTypeName?: string;
  name: string;
  address: string;
  phone: string;
  /** Email resmi store. */
  email?: string;
  taxEnabled: boolean;
  taxPercent: number;
  serviceEnabled: boolean;
  servicePercent: number;
  /** Nomor urut berikutnya untuk nomor order (format KODE-000001). */
  orderSeq: number;
  /** Mode toko dari panel kontrol: online dicek berkala, offline hanya saat aktivasi. */
  storeMode?: "online" | "offline";
  /** Kunci aktivasi store (dipakai untuk mengelola perangkat). */
  activationKey?: string;
  /** Token unik perangkat ini. */
  deviceToken?: string;
  /** Nama perangkat ini, mis. Kasir Depan. */
  deviceName?: string;
  /** Masa berlaku store (YYYY-MM-DD) dari panel kontrol. */
  expiresAt?: string | null;
  /** Kontak developer (disimpan agar tetap tampil saat offline). */
  devEmail?: string;
  devPhone?: string;
  /** Waktu aktivasi pertama (ISO). */
  activatedAt?: string;
  /** Jam operasional, format HH:MM. */
  openTime?: string;
  closeTime?: string;
  /** Hak akses per level (selain pemilik). Kosong = setelan standar. */
  rolePermissions?: Partial<Record<"manager" | "supervisor" | "cashier", string[]>>;
  /** Program membership / loyalitas pelanggan. */
  loyalty?: LoyaltySettings;
  /** Preset tema warna store ("logo" = ikuti ikon aplikasi). */
  themeId?: string;
  /** Mode tampilan: terang, gelap, atau ikut perangkat. */
  themeMode?: "light" | "dark" | "system";
}

export interface LoyaltySettings {
  enabled: boolean;
  /** Setiap kelipatan rupiah ini menghasilkan 1 poin. */
  earnPerAmount: number;
  /** Nilai 1 poin dalam rupiah saat ditukar. */
  pointValue: number;
  /** Poin minimum agar bisa ditukar. */
  minRedeem: number;
  /** Diskon otomatis untuk member (persen dari subtotal). */
  memberDiscountPercent: number;
}


export interface PrinterSettings {
  /** Cara cetak utama pada perangkat ini. */
  printMode?: "dialog" | "bluetooth";
  paperWidth: 32 | 48;
  header1: string;
  header2: string;
  footer: string;
  marginTop: number;
  marginBottom: number;
  autoPrintOnPay: boolean;
  /** Cetak tiket/label otomatis saat pesanan dikirim ke dapur. Kosong = ya. */
  autoPrintOnSend?: boolean;
  deviceName: string;
  /** ID izin Web Bluetooth untuk menyambungkan kembali printer yang sama. */
  deviceId?: string;
  /** Daftar printer per jenis dokumen (khusus perangkat ini). */
  printers?: PrinterConfig[];
}

export type PrinterRole = "receipt" | "bill" | "kitchen" | "bar" | "report";

export interface PrinterConfig {
  id: string;
  name: string;
  role: PrinterRole;
  paperWidth: 32 | 48;
  mode: "dialog" | "bluetooth";
  deviceId?: string;
  deviceName?: string;
  copies: number;
  active: boolean;
  /** Receipt: cetak otomatis setelah bayar. Kitchen/Bar: cetak otomatis saat kirim ke dapur. */
  autoPrint: boolean;
  /** Kitchen/Bar: cetak tiket pesanan (ringkasan). */
  printTicket?: boolean;
  /** Kitchen/Bar: cetak label per item (mis. label cup). */
  printLabels?: boolean;
}

export type UserRole = "owner" | "manager" | "supervisor" | "cashier";

export interface PosUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  email?: string;
  whatsapp?: string;
  /** Wajib membuat PIN baru saat masuk berikutnya (PIN default/sementara). */
  mustChangePin?: boolean;
}

export interface Category {
  id: string;
  name: string;
  /** Layanan yang boleh menampilkan kategori ini. Kosong/undefined = semua layanan. */
  serviceIds?: string[];
}


export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface Modifier {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  /** Jumlah minimum pilihan (untuk multiple). */
  minSelect?: number;
  /** Jumlah maksimum pilihan (0/kosong = tanpa batas). */
  maxSelect?: number;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  /** Harga diisi kasir saat dipilih (Open Price). */
  openPrice?: boolean;
  unit: string;
  barcode: string;
  stock: number | null;
  active: boolean;
  variants: Variant[];
  sizes?: Variant[];
  toppings?: Variant[];
  modifierIds?: string[];
  /** Harga khusus per jenis layanan. Kosong = ikut harga standar. */
  servicePrices?: Record<string, number>;
  /** Dicetak ke printer dapur/bar saat pesanan dikirim. Kosong = ya. */
  printLabel?: boolean;
  /** Tujuan cetak: printer Kitchen atau Bar. Kosong = kitchen. */
  labelStation?: "kitchen" | "bar";
  /** Komisi staf pelaksana per pekerjaan: persen dari harga atau nominal rupiah per item. */
  /** staff = ikut skema staf, custom = nilai produk ini, none = tanpa komisi. */
  commissionRule?: "staff" | "custom" | "none";
  commissionMode?: "percent" | "amount";
  commissionValue?: number;
  /** Estimasi durasi pengerjaan dalam menit (opsional, untuk bisnis jasa). */
  durationMinutes?: number | undefined;
}


export interface PaymentMethod {
  id: string;
  name: string;
  isCash: boolean;
  active: boolean;
  /** Hanya tampil untuk jenis layanan ini. Kosong = semua layanan. */
  serviceIds?: string[];
}

export interface TableRef {
  id: string;
  name: string;
}

export interface OnlineChannel {
  id: string;
  name: string;
  active: boolean;
  /** Penyesuaian harga khusus aplikasi online; kosong = ikut jenis layanan. */
  priceAdjustMode?: "amount" | "percent";
  priceAdjustValue?: number;
}

export type ServiceKind = "takeout" | "dinein" | "online";

export interface ServiceType {
  id: string;
  name: string;
  /** Kode untuk nomor order, mis. TO / DI / OL */
  code: string;
  kind: ServiceKind;
  active: boolean;
  /** Kunci ikon pilihan (lihat service-icons.ts). Kosong = ikon bawaan per kind. */
  icon?: string;
  /** Penyesuaian harga global: nominal rupiah atau persen (boleh negatif). */
  priceAdjustMode?: "amount" | "percent";
  priceAdjustValue?: number;
  /** Boleh bayar sebagian (split bill). Kosong = boleh. */
  allowSplit?: boolean;
  /** Layanan bawaan: kasir bisa langsung pilih menu tanpa memilih layanan. */
  isDefault?: boolean;
  /** Langsung cetak struk setelah konfirmasi pembayaran. */
  autoPrintReceipt?: boolean;
}




export interface Staff {
  id: string;
  name: string;
  /** Ikut skema komisi per pekerjaan. Kosong = ya. */
  commissionEnabled?: boolean;
  /** Skema komisi bawaan staf. */
  commissionMode?: "percent" | "amount";
  commissionValue?: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  variantName: string;
  unitPrice: number;
  qty: number;
  note: string;
  discount: number;
  staffName: string;
  /** Sudah dikirim ke dapur: tidak bisa dihapus, hanya bisa di-void. */
  sentToKitchen?: boolean;
  voided?: boolean;
  voidReason?: string;
  voidedBy?: string;
}

export interface SalePayment {
  methodId: string;
  methodName: string;
  /** Nilai yang benar-benar masuk ke omzet (maksimal sebesar tagihan). */
  amount: number;
  /** Uang fisik yang diterima kasir; hanya untuk pembayaran tunai. */
  tendered?: number;
}

export type SaleStatus = "paid" | "void" | "refund";

export interface Sale {
  id: string;
  code: string;
  createdAt: string;
  userName: string;
  items: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  total: number;
  payments: SalePayment[];
  paid: number;
  change: number;
  tableName: string;
  customerName: string;
  /** Jenis layanan: Take Out, Dine In, atau nama kanal online. */
  orderType?: string;
  /** Nomor order, format KODE-000001. */
  orderNo?: string;
  /** Catatan pesanan (tingkat transaksi). */
  note?: string;
  /** Member yang dipakai pada transaksi ini. */
  memberId?: string | undefined;
  memberName?: string | undefined;
  memberCode?: string | undefined;
  /** Poin yang didapat dari transaksi ini. */
  pointsEarned?: number | undefined;
  /** Poin yang ditukarkan menjadi potongan. */
  pointsUsed?: number | undefined;
  /** Nilai rupiah potongan dari penukaran poin. */
  pointDiscount?: number | undefined;
  /** Nilai rupiah diskon khusus member. */
  memberDiscount?: number | undefined;
  /** Saldo poin member setelah transaksi ini. */
  pointBalance?: number | undefined;
  status: SaleStatus;
  reason: string;
}


export interface HeldOrder {
  serviceId?: string | undefined;
  id: string;
  label: string;
  createdAt: string;
  items: CartLine[];
  tableName: string;
  customerName: string;
  orderType?: string;
  orderNo?: string;
  note?: string;
  sentToKitchen?: boolean;
  kitchenId?: string | undefined;
}

export interface KitchenOrder {
  id: string;
  orderNo: string;
  label: string;
  createdAt: string;
  items: CartLine[];
  note?: string;
  status: "processing" | "done";
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  /** Kas awal di laci saat check-in. */
  openingCash: number;
  /** Kas fisik yang dihitung saat close out (cash actual). */
  closingCash: number | null;
  userName: string;
  /** Kas yang seharusnya ada menurut sistem saat close out. */
  expectedCash?: number;
  /** Alasan selisih kas (wajib bila selisih tidak nol). */
  balanceNote?: string;
  /** Kas yang ditinggalkan untuk shift berikutnya. */
  nextStartCash?: number;
  /** Nama yang melakukan close out. */
  closedBy?: string;
  /** Hari usaha tempat shift ini berjalan. */
  businessDayId?: string;
}

/** Satu hari usaha, ditutup lewat prosedur End of Day. */
export interface BusinessDay {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy?: string;
  note?: string;
}

export type FinanceKind = "income" | "expense" | "paidin" | "paidout";

export interface FinanceItem {
  id: string;
  name: string;
}

/** Kategori Finance beserta itemnya, per jenis transaksi. */
export interface FinanceCategory {
  id: string;
  kind: FinanceKind;
  name: string;
  items: FinanceItem[];
}

export interface FinanceEntry {
  id: string;
  code: string;
  kind: FinanceKind;
  createdAt: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  methodId: string;
  methodName: string;
  isCash: boolean;
  amount: number;
  note: string;
  userName: string;
  shiftId?: string;
}

/** Pelanggan terdaftar (member) untuk program loyalitas. */
export interface Member {
  id: string;
  /** Kode member, mis. MBR-000001. */
  code: string;
  name: string;
  /** Nomor WhatsApp / telepon, dipakai untuk pencarian. */
  phone: string;
  email?: string;
  note?: string;
  /** Saldo poin saat ini. */
  points: number;
  /** Total akumulasi belanja. */
  totalSpend: number;
  /** Jumlah transaksi. */
  visits: number;
  joinedAt: string;
  active: boolean;
}

/** Riwayat poin member. */
export interface MemberPoint {
  id: string;
  memberId: string;
  createdAt: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  note: string;
  saleId?: string;
  saleCode?: string;
  userName: string;
}

export interface StockItem {
  id: string;
  name: string;
  unit: string;
  qty: number;
  /** Batas peringatan stok menipis. */
  minQty: number;
  /** Kategori yang otomatis memakai bahan ini. */
  categoryIds: string[];
  /** Pemakaian per 1 produk dari kategori tersebut. */
  categoryQty: number;
  /** Aturan khusus produk (menang atas kategori). qty 0 = tidak memakai. */
  productUses: { productId: string; qty: number }[];
}

export interface StockMove {
  id: string;
  stockId: string;
  stockName: string;
  createdAt: string;
  type: "sale" | "return" | "in" | "opname";
  qty: number;
  note: string;
  saleCode?: string;
  userName: string;
  /** Saldo setelah mutasi. */
  balanceAfter?: number;
  /** Rincian produk penyebab pemakaian. */
  products?: { name: string; qty: number; used: number }[];
}

export interface PosDatabase {

  version: number;
  settings: StoreSettings;
  printer: PrinterSettings;
  users: PosUser[];
  categories: Category[];
  products: Product[];
  modifiers?: Modifier[];
  paymentMethods: PaymentMethod[];
  tables: TableRef[];
  staff: Staff[];
  onlineChannels: OnlineChannel[];
  serviceTypes?: ServiceType[];
  sales: Sale[];
  heldOrders: HeldOrder[];
  kitchenOrders?: KitchenOrder[];
  shifts: Shift[];
  businessDays?: BusinessDay[];
  members?: Member[] | undefined;
  memberPoints?: MemberPoint[] | undefined;
  financeCategories?: FinanceCategory[];

  financeEntries?: FinanceEntry[];
  stockItems?: StockItem[];
  stockMoves?: StockMove[];
}
