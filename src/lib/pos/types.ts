export type BusinessType = "kuliner" | "retail" | "jasa";

export interface StoreSettings {
  activated: boolean;
  storeCode: string;
  businessType: BusinessType;
  name: string;
  address: string;
  phone: string;
  taxEnabled: boolean;
  taxPercent: number;
  serviceEnabled: boolean;
  servicePercent: number;
  /** Nomor urut berikutnya untuk nomor order (format KODE-000001). */
  orderSeq: number;
  /** Mode toko dari panel kontrol: online dicek berkala, offline hanya saat aktivasi. */
  storeMode?: "online" | "offline";
}

export interface PrinterSettings {
  paperWidth: 32 | 48;
  header1: string;
  header2: string;
  footer: string;
  marginTop: number;
  marginBottom: number;
  autoPrintOnPay: boolean;
  deviceName: string;
}

export type UserRole = "owner" | "manager" | "supervisor" | "cashier";

export interface PosUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  unit: string;
  barcode: string;
  stock: number | null;
  active: boolean;
  variants: Variant[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  isCash: boolean;
  active: boolean;
}

export interface TableRef {
  id: string;
  name: string;
}

export interface OnlineChannel {
  id: string;
  name: string;
  active: boolean;
}

export type ServiceKind = "takeout" | "dinein" | "online";

export interface ServiceType {
  id: string;
  name: string;
  /** Kode untuk nomor order, mis. TO / DI / OL */
  code: string;
  kind: ServiceKind;
  active: boolean;
}

export interface Staff {
  id: string;
  name: string;
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
  status: SaleStatus;
  reason: string;
}

export interface HeldOrder {
  serviceId?: string;
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
  openingCash: number;
  closingCash: number | null;
  userName: string;
}

export interface PosDatabase {
  version: number;
  settings: StoreSettings;
  printer: PrinterSettings;
  users: PosUser[];
  categories: Category[];
  products: Product[];
  paymentMethods: PaymentMethod[];
  tables: TableRef[];
  staff: Staff[];
  onlineChannels: OnlineChannel[];
  serviceTypes?: ServiceType[];
  sales: Sale[];
  heldOrders: HeldOrder[];
  kitchenOrders?: KitchenOrder[];
  shifts: Shift[];
}
