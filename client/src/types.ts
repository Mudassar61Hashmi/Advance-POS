export type User = {
  id: string;
  username: string;
  role: "superadmin" | "admin" | "manager" | "cashier";
  name: string;
}
export interface Customer {
  _id: string;
  name: string;
  phone: string;
}

export interface Product {
  _id: string;
  name: string;
  price: number;
  cost?: number;
  quantity: number;
  category: string;
  barcode?: string;
  lowStockThreshold?: number;
  image?: string | null;
  tax?: string | null;
}

export interface Sale {
  id: string;
  user_id: string;
  total: number;
  timestamp: string;
  cashier: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  name: string;
}
