// src/lib/schemas/index.js
// ─────────────────────────────────────────────────────────
// Schemas Zod para validación de inputs en toda la app.
// Se usan tanto en el cliente (services) como en Edge Functions.
// ─────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Helpers reutilizables ───────────────────────────────

/** UUID v4 válido */
const uuid = z.string().uuid();

/** UUID opcional (nullable) */
const optionalUuid = z.string().uuid().nullable().optional();

/** Texto no vacío, con trim y límite */
const requiredText = (max = 500) => z.string().trim().min(1, 'Requerido').max(max);

/** Texto opcional (puede ser null, undefined o vacío) */
const optionalText = (max = 500) => z.string().trim().max(max).nullable().optional();

/** Número >= 0 */
const nonNegativeNumber = z.number().min(0, 'No puede ser negativo');

/** Teléfono: solo dígitos, 10-15 chars */
const phoneNumber = z.string().regex(/^\d{10,15}$/, 'Teléfono: 10 a 15 dígitos');

/** Email laxo (opcional) — no forzamos si el campo es vacío */
const optionalEmail = z.string().email('Email inválido').nullable().optional()
  .or(z.literal(''))
  .or(z.literal(null))
  .or(z.undefined());

/** Email requerido */
const requiredEmail = z.string().trim().email('Email inválido');

/** Fecha ISO string (YYYY-MM-DD) */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

/** Hex color */
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, 'Color hex inválido').optional();


// ═══════════════════════════════════════════════════════
// SCHEMAS PÚBLICOS (catálogo / pedidos)
// ═══════════════════════════════════════════════════════

/** Item del carrito que envía el cliente (solo recipeId + qty, SIN precio) */
export const OrderItemInputSchema = z.object({
  recipeId: uuid,
  qty: z.number().int().min(1, 'Cantidad mínima: 1').max(100, 'Cantidad máxima: 100'),
});

/** Pedido enviado desde el catálogo público */
export const OrderInputSchema = z.object({
  customer: requiredText(200),
  phone: phoneNumber,
  email: optionalEmail,
  delivery: z.enum(['retiro', 'envio']),
  // Bucket coarse: el cliente manda uno de estos; el detalle de cuenta va en
  // payment_account_id (+ snapshot server-side). Sin tipos custom.
  payment: z.enum(['efectivo', 'transferencia', 'mercadopago', 'tarjeta']),
  payment_account_id: z.string().max(60).nullable().optional(),
  note: optionalText(1000),
  items: z.array(OrderItemInputSchema).min(1, 'El pedido necesita al menos 1 producto').max(50),
  coupon_code: optionalText(30),
  is_gift: z.boolean().optional().default(false),
  gift_note: optionalText(500),
  delivery_date: dateString.nullable().optional(),
  user_id: optionalUuid,
  // Direccion de envio (incluye piso/depto y notas). Persiste en orders.delivery_address.
  // BUG #5 del patron Zod-strip: este campo se mandaba desde el checkout pero
  // el schema no lo declaraba -> se descartaba en silencio. NO sacar de aca.
  address: optionalText(500),
  // Costo de envio calculado en el cliente; el server lo clampa y lo suma al total.
  delivery_cost: z.number().min(0).max(50000).optional().default(0),
  // Propina en % — antes bypasseaba la validacion (se leia de orderData crudo).
  tip_pct: z.number().min(0).max(100).optional().default(0),
});

/** Validación de cupón público */
export const CouponValidateSchema = z.object({
  code: requiredText(30),
  email: optionalEmail,
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Recetas
// ═══════════════════════════════════════════════════════

export const RecipeInputSchema = z.object({
  id: optionalUuid,
  name: requiredText(200),
  category: requiredText(100),
  sale_price: nonNegativeNumber,
  visible: z.boolean().optional().default(true),
  image_url: optionalText(2000),
  description: optionalText(2000),
  related_ids: z.array(uuid).optional().default([]),
  is_combo: z.boolean().optional().default(false),
  is_vegetarian: z.boolean().optional().default(false),
  requires_age_gate: z.boolean().optional().default(false),
  is_archived: z.boolean().optional().default(false),
  // Descuento % propio del producto (switch "Tiene descuento"). NULL/0 = sin
  // descuento. Pisa el deal del dia por categoria; valida tambien submit-order.
  discount_pct: z.number().min(0).max(90).nullable().optional(),
  // Rendimiento por tanda (migration recipes_add_batch_yield).
  // NULL = receta normal por unidad. Si tiene valor, indica que los
  // ingredientes se ingresaron pensando en la tanda y se dividieron por
  // este número antes de persistir.
  batch_yield: z.number().int().positive().nullable().optional(),
  // Tamaños/presentaciones de venta (migration recipes_add_sizes).
  // NULL = vende solo por unidad (sale_price). Si tiene items: el cliente
  // elige uno en el detail del catalogo y el precio sale del tamaño.
  sizes: z.array(z.object({
    label: z.string().trim().min(1).max(50),
    qty:   z.number().int().positive(),
    price: z.number().nonnegative(),
    hint:  z.string().trim().max(100).optional().nullable(),
  })).nullable().optional(),
});

export const RecipeIngredientSchema = z.object({
  ingredient_id: uuid,
  qty: z.number().positive('Cantidad debe ser mayor a 0'),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Ingredientes
// ═══════════════════════════════════════════════════════

export const IngredientInputSchema = z.object({
  id: optionalUuid,
  name: requiredText(200),
  unit: requiredText(50),
  cost: nonNegativeNumber,
  stock: nonNegativeNumber.optional().default(0),
  min_stock: nonNegativeNumber.optional().default(0),
  category: requiredText(100),
  // USAR Dark Kitchen — categoría contable (protein|dairy|vegetable|dry|beverage|packaging)
  food_category: z.enum(['protein', 'dairy', 'vegetable', 'dry', 'beverage', 'packaging']).optional(),
  is_archived: z.boolean().optional(),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Gastos
// ═══════════════════════════════════════════════════════

export const ExpenseInputSchema = z.object({
  date: dateString,
  description: requiredText(500),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  category: requiredText(100),
  supplier: optionalText(200),
  // BUG Zod-strip #6 (jun 2026): el form SIEMPRE mando estos campos pero el
  // schema no los declaraba -> se descartaban en silencio. Resultado: todos
  // los gastos caian en usar_category default 'other_opex' y expense_type
  // default 'variable' (el P&L USAR nunca recibio datos clasificados).
  // Enums espejados de los CHECK constraints de la tabla expenses.
  expense_type: z.enum(['variable', 'fixed', 'installment']).optional(),
  usar_category: z.enum([
    'food_protein', 'food_dairy', 'food_vegetable', 'food_dry', 'food_beverage',
    'packaging', 'labor_boh', 'marketing', 'commission_delivery',
    'rent', 'utilities', 'other_opex',
  ]).optional(),
  supplier_id: optionalUuid,
  receipt_url: optionalText(2000),
  no_receipt: z.boolean().optional(),
  payment_method: optionalText(40),
  items: z.json().nullable().optional(),
  notes: optionalText(1000),
  created_by: optionalUuid,
  installment_current: z.number().int().min(1).optional(),
  installment_total: z.number().int().min(1).optional(),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Ventas manuales
// ═══════════════════════════════════════════════════════

export const SaleInputSchema = z.object({
  date: dateString,
  recipe_id: optionalUuid,
  qty: z.number().int().min(1, 'Cantidad mínima: 1'),
  unit_price: nonNegativeNumber,
  total: nonNegativeNumber,
  unit_cost: nonNegativeNumber.optional().default(0),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Cupones
// ═══════════════════════════════════════════════════════

export const CouponCreateSchema = z.object({
  code: requiredText(30),
  discount_pct: z.number().int().min(1).max(100),
  email: optionalEmail,
  order_id: optionalUuid,
  expires_at: z.string().datetime().nullable().optional(),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS ADMIN — Settings
// ═══════════════════════════════════════════════════════

// Cuenta de pago configurable (settings.payment_accounts) = unica fuente de verdad.
// Sin tipos: el banco/billetera ya dice que es. Efectivo es IMPLICITO.
// looseObject: si agregamos un campo nuevo no se descarta en silencio.
export const PaymentAccountSchema = z.looseObject({
  id: z.string().max(60),
  label: z.string().max(60).optional().default(''),   // nombre INTERNO (diferencia cuentas del mismo banco)
  banco: z.string().max(80).optional().default(''),   // nombre VISIBLE (lo ve el cliente)
  titular: z.string().max(120).optional().default(''),
  alias: z.string().max(120).optional().default(''),
  cbu: z.string().max(40).optional().default(''),     // CBU o CVU
  active: z.boolean().optional().default(true),
  sort: z.number().optional().default(0),
});

export const SettingsInputSchema = z.object({
  id: z.number().int().optional(),
  biz_name: optionalText(200),
  logo_letter: optionalText(5),
  logo_color: hexColor.nullable(),
  logo_url: optionalText(2000),
  cat_images: z.json().nullable().optional(),
  hidden_cats: z.array(z.string()).nullable().optional(),
  cat_names: z.json().nullable().optional(),
  banner_text: optionalText(500),
  banner_color: hexColor.nullable(),
  store_open: z.boolean().nullable().optional(),
  store_hours: z.json().nullable().optional(),
  exp_cats: z.array(z.string()).nullable().optional(),
  ing_cats: z.array(z.string()).nullable().optional(),
  // Costos proyectados (Configuración → Finanzas → Costos proyectados)
  waste_pct: z.number().min(0).max(100).nullable().optional(),
  expense_pct: z.number().min(0).max(100).nullable().optional(),
  // Medios de pago admin + subset visible en catálogo
  payment_methods: z.array(z.string()).nullable().optional(),
  catalog_payment_methods: z.array(z.string()).nullable().optional(),
  // Cuentas de pago con datos (banco visible, alias/cbu, titular)
  payment_accounts: z.array(PaymentAccountSchema).nullable().optional(),
  // Tema visual: ambar (default) | noche | carbon
  catalog_theme: z.enum(['ambar', 'noche', 'carbon']).nullable().optional(),
  // Identidad social / SEO
  slogan: optionalText(300),
  whatsapp: optionalText(50),
  instagram: optionalText(100),
  facebook: optionalText(200),
  tiktok: optionalText(100),
  youtube: optionalText(200),
  twitter: optionalText(100),
  linkedin: optionalText(200),
  favicon_url: optionalText(2000),
  cover_url: optionalText(2000),
  og_image_url: optionalText(2000),
  // Local fisico (toggle + direccion para retiro en el local)
  has_physical_store: z.boolean().nullable().optional(),
  store_address: optionalText(300),
  // Catálogo público
  min_order_amount: z.number().min(0).nullable().optional(),
  // Escalones de costo de envio [{max_km, cost}] — max_km null = "resto" (Sprint 2)
  delivery_pricing: z.array(z.object({
    max_km: z.number().positive().nullable(),
    cost: z.number().min(0),
  })).max(12).nullable().optional(),
  // Descuento % default de cupones post-pedido (Sprint 2)
  coupon_default_pct: z.number().min(0).max(100).nullable().optional(),
  // Descuento % del cupon de cumpleanos, 0 = desactivado (se gestiona desde CRM)
  birthday_coupon_pct: z.number().min(0).max(100).nullable().optional(),
  // Grupos de cat / daily deals
  cat_groups: z.json().nullable().optional(),
  daily_deals: z.json().nullable().optional(),
  deal_pct: z.number().min(0).max(100).nullable().optional(),
  // Multi-tenant edge functions
  store_name: optionalText(200),
  app_url: optionalText(2000),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — QRs dinámicos (short URLs editables)
// ═══════════════════════════════════════════════════════

export const DynamicQrInputSchema = z.object({
  id: optionalUuid,
  // slug: 3-50 chars alfanumericos/guiones/underscore. Es lo que va impreso.
  slug: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, numeros, guion y underscore'),
  name: requiredText(120),
  target_url: z.string().trim().min(4).max(2000).url('URL invalida'),
  description: optionalText(500),
  is_active: z.boolean().optional().default(true),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Direcciones
// ═══════════════════════════════════════════════════════

export const AddressInputSchema = z.object({
  id: optionalUuid,
  user_id: uuid,
  label: requiredText(50).optional().default('Casa'),
  address: requiredText(500),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  notes: optionalText(500),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Perfiles de usuario
// ═══════════════════════════════════════════════════════

export const ProfileInputSchema = z.object({
  id: uuid,
  name: optionalText(200),
  phone: phoneNumber.nullable().optional().or(z.literal('')),
  email: optionalEmail,
  default_address_id: optionalUuid,
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Compras / Purchases
// ═══════════════════════════════════════════════════════

export const PurchaseItemSchema = z.object({
  ingredient_id: uuid,
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
  unit_price: nonNegativeNumber,
  subtotal: nonNegativeNumber,
});

export const PurchaseInputSchema = z.object({
  date: dateString,
  supplier: optionalText(200),
  total: nonNegativeNumber,
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Mermas / Waste
// ═══════════════════════════════════════════════════════

export const WasteInputSchema = z.object({
  ingredient_id: uuid,
  qty: z.number().positive('Cantidad debe ser mayor a 0'),
  reason: z.enum(['vencimiento', 'rotura', 'produccion', 'otro']).optional().default('otro'),
  note: optionalText(500),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — WhatsApp notification (Edge Function)
// ═══════════════════════════════════════════════════════

export const NotifyWhatsAppSchema = z.object({
  orderId: uuid,
  // Status values match exactly what the DB stores and what notify-whatsapp
  // edge function expects. See OrderStatus in src/lib/utils.jsx — never use
  // shortened aliases like 'prep' or 'done' here.
  status: z.enum(['new', 'preparing', 'active', 'completed', 'cancelled']),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Admin Reset (Edge Function)
// ═══════════════════════════════════════════════════════

export const AdminResetSchema = z.object({
  password: z.string().min(6, 'Contraseña mínima: 6 caracteres'),
});


// ═══════════════════════════════════════════════════════
// SCHEMAS — Combo Items
// ═══════════════════════════════════════════════════════

export const ComboItemSchema = z.object({
  sub_recipe_id: uuid,
  qty: z.number().positive('Cantidad debe ser mayor a 0'),
});


// ═══════════════════════════════════════════════════════
// Helper: safe parse con log
// ═══════════════════════════════════════════════════════

/**
 * Valida datos contra un schema Zod. Retorna { ok, data, errors }.
 * Si falla, loguea los errores para debugging.
 *
 * @param {z.ZodSchema} schema - El schema Zod a aplicar
 * @param {unknown} data - Los datos a validar
 * @param {string} context - Nombre del contexto (para logs)
 * @returns {{ ok: boolean, data: any, errors: string[] | null }}
 */
export function validateInput(schema, data, context = 'unknown') {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data, errors: null };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  );
  console.warn(`[Validación] ${context}:`, errors);
  return { ok: false, data: null, errors };
}
