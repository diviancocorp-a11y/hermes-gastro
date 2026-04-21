// src/test/plugins.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Payment plugins', () => {
  let payments;

  beforeEach(async () => {
    vi.resetModules();
    payments = await import('../config/payments');
  });

  it('getPaymentMethods returns only enabled methods', () => {
    const methods = payments.getPaymentMethods();
    expect(methods.every(m => m.enabled)).toBe(true);
    // By default, efectivo and transferencia enabled, mercadopago disabled
    expect(methods.length).toBe(2);
    expect(methods.map(m => m.id)).toContain('efectivo');
    expect(methods.map(m => m.id)).toContain('transferencia');
  });

  it('getPaymentMethod returns specific method by id', () => {
    const cash = payments.getPaymentMethod('efectivo');
    expect(cash).toBeTruthy();
    expect(cash.type).toBe('cash');
  });

  it('requiresReceipt returns correct value', () => {
    expect(payments.requiresReceipt('efectivo')).toBe(false);
    expect(payments.requiresReceipt('transferencia')).toBe(true);
  });

  it('isDigitalPayment returns correct value', () => {
    expect(payments.isDigitalPayment('efectivo')).toBe(false);
    expect(payments.isDigitalPayment('transferencia')).toBe(true);
  });

  it('askForChange returns correct value', () => {
    expect(payments.askForChange('efectivo')).toBe(true);
    expect(payments.askForChange('transferencia')).toBeFalsy();
  });

  it('registerPaymentMethod adds new method', () => {
    payments.registerPaymentMethod({
      id: 'stripe',
      label: 'Stripe',
      icon: '💳',
      type: 'gateway',
      enabled: true,
      requiresReceipt: false,
    });
    const stripe = payments.getPaymentMethod('stripe');
    expect(stripe).toBeTruthy();
    expect(stripe.type).toBe('gateway');
    expect(payments.getPaymentMethods().map(m => m.id)).toContain('stripe');
  });

  it('setPaymentEnabled toggles method', () => {
    payments.setPaymentEnabled('mercadopago', true);
    expect(payments.getPaymentMethods().map(m => m.id)).toContain('mercadopago');
    payments.setPaymentEnabled('mercadopago', false);
    expect(payments.getPaymentMethods().map(m => m.id)).not.toContain('mercadopago');
  });
});

describe('Delivery plugins', () => {
  let delivery;

  beforeEach(async () => {
    vi.resetModules();
    delivery = await import('../config/delivery');
  });

  it('getDeliveryMethods returns only enabled methods', () => {
    const methods = delivery.getDeliveryMethods();
    expect(methods.every(m => m.enabled)).toBe(true);
    expect(methods.length).toBe(2);
  });

  it('requiresAddress returns false for pickup', () => {
    expect(delivery.requiresAddress('retiro')).toBe(false);
    expect(delivery.requiresAddress('envio')).toBe(true);
  });

  it('getDeliveryCost returns 0 for pickup', () => {
    expect(delivery.getDeliveryCost('retiro', 5, 10000)).toBe(0);
  });

  it('getDeliveryCost calculates delivery cost', () => {
    const cost = delivery.getDeliveryCost('envio', 3, 0);
    // baseCost(500) + ceil(3)*perKmCost(200) = 500 + 600 = 1100
    expect(cost).toBe(1100);
  });

  it('isWithinRange checks max distance', () => {
    expect(delivery.isWithinRange('envio', 10)).toBe(true);
    expect(delivery.isWithinRange('envio', 20)).toBe(false); // max 15
  });

  it('registerDeliveryMethod adds new method', () => {
    delivery.registerDeliveryMethod({
      id: 'pedidosya',
      label: 'PedidosYa',
      icon: '🏍️',
      type: 'delivery',
      enabled: true,
      config: { requiresAddress: true, baseCost: 0, perKmCost: 0, maxDistanceKm: 50 },
    });
    expect(delivery.getDeliveryMethod('pedidosya')).toBeTruthy();
    expect(delivery.getDeliveryMethods().length).toBe(3);
  });
});
