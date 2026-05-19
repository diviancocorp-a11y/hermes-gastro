// src/test/schemas.test.js
// ─────────────────────────────────────────────────────────
// Tests unitarios para todos los schemas Zod
// Cada schema tiene al menos: 1 caso válido + 1 caso inválido
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  OrderItemInputSchema, OrderInputSchema, CouponValidateSchema,
  RecipeInputSchema, IngredientInputSchema, ExpenseInputSchema,
  SaleInputSchema, CouponCreateSchema, SettingsInputSchema,
  AddressInputSchema, ProfileInputSchema, PurchaseInputSchema,
  PurchaseItemSchema, WasteInputSchema, NotifyWhatsAppSchema,
  AdminResetSchema, ComboItemSchema, RecipeIngredientSchema,
  validateInput,
} from '@hermes/core/lib/schemas';

// ─── Helper ──────────────────────────────────────────────
const valid = (schema, data) => expect(schema.safeParse(data).success).toBe(true);
const invalid = (schema, data) => expect(schema.safeParse(data).success).toBe(false);
const UUID = '550e8400-e29b-41d4-a716-446655440000';

// ═══════════════════════════════════════════════════════
// OrderItemInputSchema
// ═══════════════════════════════════════════════════════
describe('OrderItemInputSchema', () => {
  it('acepta item válido', () => {
    valid(OrderItemInputSchema, { recipeId: UUID, qty: 3 });
  });
  it('rechaza qty 0', () => {
    invalid(OrderItemInputSchema, { recipeId: UUID, qty: 0 });
  });
  it('rechaza qty > 100', () => {
    invalid(OrderItemInputSchema, { recipeId: UUID, qty: 101 });
  });
  it('rechaza UUID inválido', () => {
    invalid(OrderItemInputSchema, { recipeId: 'not-a-uuid', qty: 1 });
  });
  it('rechaza qty decimal', () => {
    invalid(OrderItemInputSchema, { recipeId: UUID, qty: 2.5 });
  });
});

// ═══════════════════════════════════════════════════════
// OrderInputSchema
// ═══════════════════════════════════════════════════════
describe('OrderInputSchema', () => {
  const baseOrder = {
    customer: 'María López',
    phone: '1155443322',
    delivery: 'retiro',
    payment: 'efectivo',
    items: [{ recipeId: UUID, qty: 2 }],
  };

  it('acepta pedido válido mínimo', () => {
    valid(OrderInputSchema, baseOrder);
  });

  it('acepta pedido completo con opcionales', () => {
    valid(OrderInputSchema, {
      ...baseOrder,
      email: 'maria@test.com',
      note: 'Sin azúcar por favor',
      coupon_code: 'NONA-ABC123',
      is_gift: true,
      gift_note: 'Feliz cumple!',
      delivery_date: '2026-04-25',
      user_id: UUID,
    });
  });

  it('rechaza sin customer', () => {
    invalid(OrderInputSchema, { ...baseOrder, customer: '' });
  });

  it('rechaza teléfono corto', () => {
    invalid(OrderInputSchema, { ...baseOrder, phone: '12345' });
  });

  it('rechaza teléfono con letras', () => {
    invalid(OrderInputSchema, { ...baseOrder, phone: '115544abc3' });
  });

  it('rechaza delivery inválido', () => {
    invalid(OrderInputSchema, { ...baseOrder, delivery: 'drone' });
  });

  it('rechaza payment inválido', () => {
    invalid(OrderInputSchema, { ...baseOrder, payment: 'bitcoin' });
  });

  it('rechaza sin items', () => {
    invalid(OrderInputSchema, { ...baseOrder, items: [] });
  });

  it('rechaza email malformado', () => {
    invalid(OrderInputSchema, { ...baseOrder, email: 'not-an-email' });
  });

  it('acepta email vacío', () => {
    valid(OrderInputSchema, { ...baseOrder, email: '' });
  });

  it('acepta email null', () => {
    valid(OrderInputSchema, { ...baseOrder, email: null });
  });

  it('rechaza delivery_date con formato incorrecto', () => {
    invalid(OrderInputSchema, { ...baseOrder, delivery_date: '25/04/2026' });
  });
});

// ═══════════════════════════════════════════════════════
// CouponValidateSchema
// ═══════════════════════════════════════════════════════
describe('CouponValidateSchema', () => {
  it('acepta código válido', () => {
    valid(CouponValidateSchema, { code: 'NONA-ABC123' });
  });
  it('rechaza código vacío', () => {
    invalid(CouponValidateSchema, { code: '' });
  });
});

// ═══════════════════════════════════════════════════════
// RecipeInputSchema
// ═══════════════════════════════════════════════════════
describe('RecipeInputSchema', () => {
  it('acepta receta válida mínima', () => {
    valid(RecipeInputSchema, { name: 'Torta de Chocolate', category: 'Tortas', sale_price: 5000 });
  });

  it('acepta receta con todos los campos', () => {
    valid(RecipeInputSchema, {
      id: UUID, name: 'Combo Familiar', category: 'Combos',
      sale_price: 12000, visible: true, image_url: 'https://img.com/photo.jpg',
      description: 'Incluye 4 porciones', related_ids: [UUID],
      is_combo: true, is_archived: false,
    });
  });

  it('rechaza precio negativo', () => {
    invalid(RecipeInputSchema, { name: 'Test', category: 'Cat', sale_price: -100 });
  });

  it('rechaza nombre vacío', () => {
    invalid(RecipeInputSchema, { name: '', category: 'Cat', sale_price: 100 });
  });
});

// ═══════════════════════════════════════════════════════
// IngredientInputSchema
// ═══════════════════════════════════════════════════════
describe('IngredientInputSchema', () => {
  it('acepta ingrediente válido', () => {
    valid(IngredientInputSchema, { name: 'Harina', unit: 'kg', cost: 800, category: 'Secos' });
  });

  it('acepta ingrediente con stock y min_stock', () => {
    valid(IngredientInputSchema, { name: 'Huevos', unit: 'unidad', cost: 120, stock: 50, min_stock: 10, category: 'Frescos' });
  });

  it('rechaza costo negativo', () => {
    invalid(IngredientInputSchema, { name: 'Test', unit: 'kg', cost: -1, category: 'Secos' });
  });

  it('rechaza sin unidad', () => {
    invalid(IngredientInputSchema, { name: 'Test', unit: '', cost: 100, category: 'Secos' });
  });
});

// ═══════════════════════════════════════════════════════
// ExpenseInputSchema
// ═══════════════════════════════════════════════════════
describe('ExpenseInputSchema', () => {
  it('acepta gasto válido', () => {
    valid(ExpenseInputSchema, { date: '2026-04-20', description: 'Gas', amount: 5000, category: 'Servicios' });
  });

  it('rechaza monto 0', () => {
    invalid(ExpenseInputSchema, { date: '2026-04-20', description: 'Gas', amount: 0, category: 'Servicios' });
  });

  it('rechaza fecha inválida', () => {
    invalid(ExpenseInputSchema, { date: 'ayer', description: 'Gas', amount: 5000, category: 'Servicios' });
  });
});

// ═══════════════════════════════════════════════════════
// SaleInputSchema
// ═══════════════════════════════════════════════════════
describe('SaleInputSchema', () => {
  it('acepta venta válida', () => {
    valid(SaleInputSchema, { date: '2026-04-20', qty: 5, unit_price: 1000, total: 5000 });
  });

  it('rechaza qty 0', () => {
    invalid(SaleInputSchema, { date: '2026-04-20', qty: 0, unit_price: 1000, total: 0 });
  });
});

// ═══════════════════════════════════════════════════════
// CouponCreateSchema
// ═══════════════════════════════════════════════════════
describe('CouponCreateSchema', () => {
  it('acepta cupón válido', () => {
    valid(CouponCreateSchema, { code: 'NONA-ABCDEF', discount_pct: 15 });
  });

  it('rechaza descuento > 100', () => {
    invalid(CouponCreateSchema, { code: 'TEST', discount_pct: 150 });
  });

  it('rechaza descuento 0', () => {
    invalid(CouponCreateSchema, { code: 'TEST', discount_pct: 0 });
  });
});

// ═══════════════════════════════════════════════════════
// SettingsInputSchema
// ═══════════════════════════════════════════════════════
describe('SettingsInputSchema', () => {
  it('acepta settings parciales', () => {
    valid(SettingsInputSchema, { biz_name: 'La Nona', logo_color: '#C45D3E' });
  });

  it('acepta settings completos', () => {
    valid(SettingsInputSchema, {
      id: 1, biz_name: 'La Nona Pato', logo_letter: 'N', logo_color: '#C45D3E',
      store_open: true, hidden_cats: ['Combos'], cat_images: { Tortas: 'url' },
    });
  });

  it('rechaza color hex inválido', () => {
    invalid(SettingsInputSchema, { logo_color: 'rojo' });
  });
});

// ═══════════════════════════════════════════════════════
// AddressInputSchema
// ═══════════════════════════════════════════════════════
describe('AddressInputSchema', () => {
  it('acepta dirección válida', () => {
    valid(AddressInputSchema, { user_id: UUID, address: 'Av. Corrientes 1234' });
  });

  it('rechaza sin dirección', () => {
    invalid(AddressInputSchema, { user_id: UUID, address: '' });
  });

  it('rechaza latitud fuera de rango', () => {
    invalid(AddressInputSchema, { user_id: UUID, address: 'Test', lat: 100 });
  });
});

// ═══════════════════════════════════════════════════════
// ProfileInputSchema
// ═══════════════════════════════════════════════════════
describe('ProfileInputSchema', () => {
  it('acepta perfil válido', () => {
    valid(ProfileInputSchema, { id: UUID, name: 'María', phone: '1155443322' });
  });

  it('acepta perfil con email', () => {
    valid(ProfileInputSchema, { id: UUID, email: 'maria@test.com' });
  });

  it('rechaza sin id', () => {
    invalid(ProfileInputSchema, { name: 'María' });
  });
});

// ═══════════════════════════════════════════════════════
// PurchaseInputSchema + PurchaseItemSchema
// ═══════════════════════════════════════════════════════
describe('PurchaseInputSchema', () => {
  it('acepta compra válida', () => {
    valid(PurchaseInputSchema, { date: '2026-04-20', total: 15000 });
  });

  it('acepta compra con proveedor', () => {
    valid(PurchaseInputSchema, { date: '2026-04-20', supplier: 'Distribuidora Norte', total: 15000 });
  });
});

describe('PurchaseItemSchema', () => {
  it('acepta item válido', () => {
    valid(PurchaseItemSchema, { ingredient_id: UUID, quantity: 10, unit_price: 500, subtotal: 5000 });
  });

  it('rechaza cantidad 0', () => {
    invalid(PurchaseItemSchema, { ingredient_id: UUID, quantity: 0, unit_price: 500, subtotal: 0 });
  });
});

// ═══════════════════════════════════════════════════════
// WasteInputSchema
// ═══════════════════════════════════════════════════════
describe('WasteInputSchema', () => {
  it('acepta merma válida', () => {
    valid(WasteInputSchema, { ingredient_id: UUID, qty: 2, reason: 'vencimiento' });
  });

  it('acepta merma con nota', () => {
    valid(WasteInputSchema, { ingredient_id: UUID, qty: 0.5, reason: 'rotura', note: 'Se cayó' });
  });

  it('rechaza razón inválida', () => {
    invalid(WasteInputSchema, { ingredient_id: UUID, qty: 1, reason: 'pereza' });
  });

  it('rechaza qty negativa', () => {
    invalid(WasteInputSchema, { ingredient_id: UUID, qty: -1, reason: 'otro' });
  });
});

// ═══════════════════════════════════════════════════════
// NotifyWhatsAppSchema
// ═══════════════════════════════════════════════════════
describe('NotifyWhatsAppSchema', () => {
  it('acepta notificación válida', () => {
    valid(NotifyWhatsAppSchema, { orderId: UUID, status: 'preparing' });
  });

  it('acepta todos los estados válidos', () => {
    ['new', 'preparing', 'active', 'completed', 'cancelled'].forEach(s => {
      valid(NotifyWhatsAppSchema, { orderId: UUID, status: s });
    });
  });

  it('rechaza estado inválido', () => {
    invalid(NotifyWhatsAppSchema, { orderId: UUID, status: 'enviando' });
  });
});

// ═══════════════════════════════════════════════════════
// AdminResetSchema
// ═══════════════════════════════════════════════════════
describe('AdminResetSchema', () => {
  it('acepta contraseña válida', () => {
    valid(AdminResetSchema, { password: 'miPassword123' });
  });

  it('rechaza contraseña corta', () => {
    invalid(AdminResetSchema, { password: '12345' });
  });
});

// ═══════════════════════════════════════════════════════
// ComboItemSchema
// ═══════════════════════════════════════════════════════
describe('ComboItemSchema', () => {
  it('acepta combo item válido', () => {
    valid(ComboItemSchema, { sub_recipe_id: UUID, qty: 2 });
  });

  it('rechaza qty 0', () => {
    invalid(ComboItemSchema, { sub_recipe_id: UUID, qty: 0 });
  });
});

// ═══════════════════════════════════════════════════════
// RecipeIngredientSchema
// ═══════════════════════════════════════════════════════
describe('RecipeIngredientSchema', () => {
  it('acepta relación válida', () => {
    valid(RecipeIngredientSchema, { ingredient_id: UUID, qty: 0.5 });
  });

  it('rechaza qty negativa', () => {
    invalid(RecipeIngredientSchema, { ingredient_id: UUID, qty: -1 });
  });
});

// ═══════════════════════════════════════════════════════
// validateInput helper
// ═══════════════════════════════════════════════════════
describe('validateInput', () => {
  it('retorna ok: true con datos válidos', () => {
    const result = validateInput(AdminResetSchema, { password: 'segura123' }, 'test');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ password: 'segura123' });
    expect(result.errors).toBeNull();
  });

  it('retorna ok: false con datos inválidos', () => {
    const result = validateInput(AdminResetSchema, { password: '1' }, 'test');
    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('retorna errores descriptivos con path', () => {
    const result = validateInput(OrderInputSchema, { customer: '', phone: '123', delivery: 'xxx', payment: 'xxx', items: [] }, 'test');
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('customer'))).toBe(true);
  });
});