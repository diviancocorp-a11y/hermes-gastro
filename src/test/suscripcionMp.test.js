// Cobro recurrente de Dico con Mercado Pago: la logica pura de
// suscripcion-alta y suscripcion-webhook (docs/plataforma/COBRO-SUSCRIPCION.md).
import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  eleccionDelAlta, cobroDelCiclo, primerDebito, datosVisiblesDeTarjeta, armarPreapproval,
} from '../../platform/functions/suscripcion-alta/calculo.ts';
import {
  leerEvento, firmaValida, sumarMeses, nuevoPagaHasta, estadoDelDebito, planTrasRechazo,
} from '../../platform/functions/suscripcion-webhook/logica.ts';

const DANTE = { id: 'local', nombre: 'Dante', precio_mensual: '59000.00', precio_anual_por_mes: '47200.00', disponible: true };
const PARIS = { id: 'digital', nombre: 'Paris', precio_mensual: '14999.00', precio_anual_por_mes: null, disponible: true };
const AHORA = new Date('2026-11-06T12:00:00Z');

describe('eleccionDelAlta: el plan sale del metadata, no del body', () => {
  it('lee plan y ciclo del registro', () => {
    expect(eleccionDelAlta({ requested_plan: 'local', requested_billing_period: 'anual' }))
      .toEqual({ planId: 'local', ciclo: 'anual' });
  });
  it('Paris no tiene anual', () => {
    expect(eleccionDelAlta({ requested_plan: 'digital', requested_billing_period: 'anual' }))
      .toEqual({ planId: 'digital', ciclo: 'mensual' });
  });
  it('sin plan valido no hay cobro', () => {
    expect(eleccionDelAlta({ requested_plan: 'total' })).toBeNull();
    expect(eleccionDelAlta({})).toBeNull();
    expect(eleccionDelAlta(null)).toBeNull();
  });
});

describe('cobroDelCiclo', () => {
  it('mensual: el precio del mes, cada mes', () => {
    expect(cobroDelCiclo(DANTE, 'mensual')).toEqual({ monto: 59000, frecuencia: 1 });
  });
  it('anual: los 12 meses por adelantado, cada 12 meses', () => {
    expect(cobroDelCiclo(DANTE, 'anual')).toEqual({ monto: 566400, frecuencia: 12 });
  });
  it('sin precio anual o plan no disponible: no se cobra', () => {
    expect(cobroDelCiclo(PARIS, 'anual')).toBeNull();
    expect(cobroDelCiclo({ ...DANTE, disponible: false }, 'mensual')).toBeNull();
    expect(cobroDelCiclo({ ...DANTE, precio_mensual: 0 }, 'mensual')).toBeNull();
  });
});

describe('primerDebito', () => {
  it('alta nueva: a los 14 dias', () => {
    expect(primerDebito(AHORA, null).toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });
  it('negocio con la prueba vigente: el dia que termina', () => {
    expect(primerDebito(AHORA, { prueba_hasta: '2026-11-10T00:00:00Z' }).toISOString())
      .toBe('2026-11-10T00:00:00.000Z');
  });
  it('negocio sin prueba: enseguida', () => {
    const d = primerDebito(AHORA, { prueba_hasta: '2026-10-01T00:00:00Z' });
    expect(d.getTime() - AHORA.getTime()).toBe(5 * 60 * 1000);
  });
});

describe('datosVisiblesDeTarjeta', () => {
  it('guarda marca y ultimos 4', () => {
    expect(datosVisiblesDeTarjeta({ ultimos4: '4242', marca: 'visa' }))
      .toEqual({ tarjeta_ultimos4: '4242', tarjeta_marca: 'visa' });
  });
  it('un numero entero o basura no se guarda', () => {
    expect(datosVisiblesDeTarjeta({ ultimos4: '4509953566233704', marca: '<script>' }))
      .toEqual({ tarjeta_ultimos4: null, tarjeta_marca: null });
  });
});

describe('armarPreapproval', () => {
  it('suscripcion autorizada con el debito pendiente al fin de la prueba', () => {
    const p = armarPreapproval({
      planNombre: 'Dante', ciclo: 'anual', monto: 566400, frecuencia: 12,
      inicio: new Date('2026-11-20T12:00:00Z'), email: 'a@b.com', userId: 'u1',
      cardTokenId: 'tok', notificationUrl: 'https://x/fn', backUrl: 'https://divianco.app/bienvenido',
    });
    expect(p.status).toBe('authorized');
    expect(p.card_token_id).toBe('tok');
    expect(p.external_reference).toBe('u1');
    expect(p.auto_recurring).toEqual({
      frequency: 12, frequency_type: 'months', start_date: '2026-11-20T12:00:00.000Z',
      transaction_amount: 566400, currency_id: 'ARS',
    });
  });
});

describe('leerEvento', () => {
  const u = (q = '') => new URL(`https://x/functions/v1/suscripcion-webhook${q}`);
  it('debito y suscripcion, por body o por query', () => {
    expect(leerEvento(u(), { type: 'subscription_authorized_payment', data: { id: '123' } }))
      .toEqual({ tipo: 'debito', id: '123' });
    expect(leerEvento(u('?type=subscription_preapproval&data.id=2c93'), null))
      .toEqual({ tipo: 'suscripcion', id: '2c93' });
  });
  it('otros topics o ids raros se ignoran', () => {
    expect(leerEvento(u(), { type: 'payment', data: { id: '1' } })).toBeNull();
    expect(leerEvento(u(), { type: 'subscription_preapproval', data: { id: '1;drop' } })).toBeNull();
  });
});

describe('firmaValida', () => {
  const SECRETO = 'secreto';
  const firmar = (id, req, ts, s = SECRETO) =>
    `ts=${ts},v1=${createHmac('sha256', s).update(`id:${id};request-id:${req};ts:${ts};`).digest('hex')}`;
  it('acepta la firma de MP (id en minusculas)', async () => {
    expect(await firmaValida(firmar('abc1', 'r1', '100'), 'r1', 'ABC1', SECRETO)).toBe(true);
  });
  it('rechaza otro secreto, otro id o sin firma', async () => {
    expect(await firmaValida(firmar('abc1', 'r1', '100', 'otro'), 'r1', 'abc1', SECRETO)).toBe(false);
    expect(await firmaValida(firmar('abc1', 'r1', '100'), 'r1', 'abc2', SECRETO)).toBe(false);
    expect(await firmaValida(null, 'r1', 'abc1', SECRETO)).toBe(false);
    expect(await firmaValida(firmar('abc1', 'r1', '100'), 'r1', 'abc1', '')).toBe(false);
  });
});

describe('sumarMeses y nuevoPagaHasta', () => {
  it('31/ene + 1 mes = fin de febrero, no marzo', () => {
    expect(sumarMeses(new Date('2027-01-31T10:00:00Z'), 1).toISOString()).toBe('2027-02-28T10:00:00.000Z');
  });
  it('pagar antes de vencer no hace perder dias', () => {
    expect(nuevoPagaHasta(AHORA, '2026-11-20T12:00:00Z', 'mensual').toISOString())
      .toBe('2026-12-20T12:00:00.000Z');
  });
  it('vencido o sin fecha: cuenta desde hoy; anual suma 12', () => {
    expect(nuevoPagaHasta(AHORA, '2026-01-01T00:00:00Z', 'mensual').toISOString())
      .toBe('2026-12-06T12:00:00.000Z');
    expect(nuevoPagaHasta(AHORA, null, 'anual').toISOString()).toBe('2027-11-06T12:00:00.000Z');
  });
});

describe('estadoDelDebito', () => {
  it('aprobado, rechazado o pendiente', () => {
    expect(estadoDelDebito({ status: 'processed', payment: { status: 'approved' } })).toBe('aprobado');
    expect(estadoDelDebito({ status: 'processed', payment: { status: 'rejected' } })).toBe('rechazado');
    expect(estadoDelDebito({ status: 'cancelled' })).toBe('rechazado');
    expect(estadoDelDebito({ status: 'recycling', payment: { status: 'rejected' } })).toBe('pendiente');
    expect(estadoDelDebito({ status: 'scheduled' })).toBe('pendiente');
  });
});

describe('planTrasRechazo', () => {
  it('Dante o Magnus sin nada pago bajan a Paris', () => {
    expect(planTrasRechazo(AHORA, 'local', null)).toBe('digital');
    expect(planTrasRechazo(AHORA, 'cadena', '2026-11-01T00:00:00Z')).toBe('digital');
  });
  it('con dias pagos o en Paris, no cambia', () => {
    expect(planTrasRechazo(AHORA, 'local', '2026-12-01T00:00:00Z')).toBeNull();
    expect(planTrasRechazo(AHORA, 'digital', null)).toBeNull();
  });
});
