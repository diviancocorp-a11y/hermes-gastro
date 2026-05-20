// ─── Core Domain Types for Hermes Gastro ───────────────

export type OrderStatusType = 'new' | 'preparing' | 'active' | 'completed' | 'cancelled';
export type DeliveryMethod = 'retiro' | 'envio';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercadopago';
export type WasteReason = 'vencimiento' | 'rotura' | 'produccion' | 'otro';

// ─── Database Row Types ─────────────────────────────────

export interface Recipe {
  id: string;
  name: string;
  category: string;
  sale_price: number;
  visible: boolean;
  image_url: string | null;
  description: string | null;
  related_ids: string[];
  is_combo: boolean;
  is_archived: boolean;
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id?: string;
  recipe_id: string;
  ingredient_id: string;
  qty: number;
  quantity: number; // alias
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost: number;
  stock: number;
  min_stock: number;
  category: string;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  email: string | null;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  note: string | null;
  status: OrderStatusType;
  total: number;
  date: string;
  created_at: string;
  delivery_date: string | null;
  user_id: string | null;
  is_gift: boolean;
  gift_note: string | null;
  receipt_path: string | null;
  receipt_verified: boolean;
  completedAt?: string;
  address?: string;
  order_items?: OrderItem[];
  items?: OrderItem[]; // alias used in some contexts
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  recipe_id: string;
  qty?: number;
  quantity?: number;
  unit_price: number;
  unit_cost?: number;
  subtotal?: number;
  recipes?: { name: string; sale_price?: number };
}

export interface Sale {
  id: string;
  date: string;
  recipe_id: string | null;
  qty: number;
  unit_price: number;
  unit_cost?: number;
  total: number;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  supplier: string | null;
}

export interface Purchase {
  id: string;
  date: string;
  supplier: string | null;
  total: number;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  ingredient_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  ingredients?: { name: string; unit: string };
}

export interface WasteEntry {
  id: string;
  ingredient_id: string;
  qty: number;
  reason: WasteReason;
  note: string;
  date: string;
  created_at: string;
  ingredients?: { name: string; unit: string };
}

export interface Coupon {
  id: string;
  code: string;
  discount_pct: number;
  email: string | null;
  order_id: string | null;
  used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Settings {
  id?: number;
  biz_name: string;
  logo_letter: string;
  logo_color: string;
  logo_url?: string | null;
  cover_url?: string | null;
  cat_images?: Record<string, string> | null;
  hidden_cats?: string[] | null;
  cat_names?: Record<string, string> | null;
  banner_text?: string | null;
  banner_color?: string | null;
  store_open?: boolean | null;
  store_hours?: Record<string, unknown> | null;
  exp_cats?: string[];
  ing_cats?: string[];
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  orders: number;
  total: number;
  last_order: string;
}

// ─── Service Return Types ───────────────────────────────

export interface ValidationResult<T = unknown> {
  ok: boolean;
  data: T | null;
  errors: string[] | null;
}

export interface ServiceError {
  __error: string;
  message?: string;
}

export interface DashboardStats {
  newOrders: number;
  monthRevenue: number;
  profit: number;
  margin: number;
  costOfGoods: number;
  monthExpenses: number;
  topProducts: TopProduct[];
  inventoryValue: number;
  allOrders: Order[];
}

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
  margin: number;
}

// ─── Component Prop Types ───────────────────────────────

export interface StockDeficit {
  name: string;
  current: string;
  needed: string;
  unit: string;
  after: string;
}
