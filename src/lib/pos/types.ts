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

export type UserRole = "owner" | "cashier";

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
}

export interface SalePayment {
  methodId: string;
  methodName: string;
  amount: number;
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
  status: SaleStatus;
  reason: string;
}

export interface HeldOrder {
  id: string;
  label: string;
  createdAt: string;
  items: CartLine[];
  tableName: string;
  customerName: string;
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
  sales: Sale[];
  heldOrders: HeldOrder[];
  shifts: Shift[];
}
