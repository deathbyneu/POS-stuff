export type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  active: boolean;
};
export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
};
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost?: number;
  stock: number;
  availableStock?: number;
  minStock: number;
  active: boolean;
  categoryId: string;
  category?: Category;
  emoji?: string;
  imageUrl?: string;
};
export type InventoryLot = {
  id: string;
  productId: string;
  batchCode: string;
  quantity: number;
  receivedAt: string;
  manufacturedAt?: string | null;
  expiryDate?: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: "EXPIRED" | "URGENT" | "WARNING" | "OK" | "NO_EXPIRY";
  product: { name: string; sku: string };
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  createdAt: string;
};
export type Order = {
  id: string;
  code: string;
  total: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  method: "QR" | "CASH";
  source: "KIOSK" | "CASHIER";
  createdAt: string;
  items: {
    productId: string;
    name: string;
    barcode: string;
    quantity: number;
    price: number;
  }[];
  token?: string;
  qrData?: string;
  paymentMode?: "DEMO" | "PAYOS" | "UNAVAILABLE";
  paymentLinkId?: string;
  paymentProvider?: string;
  expiresAt?: string;
  customer?: Customer;
  user?: User;
};
export type Store = {
  name: string;
  address: string;
  phone: string;
  receiptNote: string;
};
export type Dashboard = {
  revenue: number;
  grossProfit: number;
  grossMargin: number;
  ordersCount: number;
  averageOrder: number;
  productsCount: number;
  lowStock: Product[];
  expiryAlerts: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    batchCode: string;
    quantity: number;
    expiryDate: string;
    daysUntilExpiry: number;
    expiryStatus: "EXPIRED" | "URGENT" | "WARNING";
  }[];
  chart: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  recentOrders: Order[];
  paymentMode: string;
};
export const money = (value: number | string = 0) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value));
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message || "Không thể kết nối hệ thống. Vui lòng thử lại.",
    );
  return data as T;
}
export const mutate = <T>(path: string, body?: unknown, method = "POST") =>
  api<T>(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
