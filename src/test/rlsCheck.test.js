// src/test/rlsCheck.test.js
//
// Prueba la regla de check-rls.mjs SIN base.
//
// Los casos verdes son policies copiadas de produccion (26/sep) tal como las
// devuelve pg_policies: si un cambio en la regla las empieza a marcar, el
// guard grita en falso y se termina ignorando. Los rojos son los errores que
// rompen el aislamiento sin fallar.

import { describe, it, expect } from 'vitest';
import {
  acotada, desenvolver, partirEnNivelCero, revisar,
  desenvolverFunciones, revisarDefiner, DEFINER_APROBADAS,
} from '../../scripts/check-rls.mjs';

const DEL_NEGOCIO = '(tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants))';

function tabla(name, policies, extra = {}) {
  return {
    name, kind: 'r', rls: true, tenant_id: true,
    anon_select: true, authenticated_select: true, security_invoker: false,
    policies: policies.map((p) => ({ permissive: 'PERMISSIVE', roles: ['public'], using: null, check: null, ...p })),
    ...extra,
  };
}

describe('acotada: policies reales de produccion', () => {
  it('el patron base', () => {
    expect(acotada(DEL_NEGOCIO)).toBe(true);
  });

  it('negocio + rol + sucursal (cash_sessions)', () => {
    expect(acotada(
      "((tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants)) AND private.tiene_rol(tenant_id, ARRAY['owner'::text, 'manager'::text, 'cashier'::text]) AND private.alcanza_branch(tenant_id, branch_id))",
    )).toBe(true);
  });

  it('solo el rol (tenant_members)', () => {
    expect(acotada("private.tiene_rol(tenant_id, ARRAY['owner'::text])")).toBe(true);
  });

  it('el comprador ve sus propios pedidos en cualquier negocio (orders)', () => {
    expect(acotada(
      '((tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants)) OR ((user_id IS NOT NULL) AND (user_id = auth.uid())))',
    )).toBe(true);
  });

  it('los items de sus pedidos, por subconsulta (order_items)', () => {
    expect(acotada(
      '((tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants)) OR (EXISTS ( SELECT 1\n   FROM orders o\n  WHERE ((o.id = order_items.order_id) AND (o.user_id IS NOT NULL) AND (o.user_id = auth.uid())))))',
    )).toBe(true);
  });

  it('un OR anidado dentro de un AND acotado (staff)', () => {
    expect(acotada(
      "((tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants)) AND (private.tiene_rol(tenant_id, ARRAY['owner'::text, 'manager'::text, 'accountant'::text]) OR (user_id = auth.uid())))",
    )).toBe(true);
  });

  it('su propia fila, tambien con (select auth.uid())', () => {
    expect(acotada('(id = auth.uid())')).toBe(true);
    expect(acotada('(user_id = ( SELECT auth.uid() AS uid))')).toBe(true);
    expect(acotada('(( SELECT auth.uid() AS uid) = user_id)')).toBe(true);
  });

  it('el staff de Divianco (consola_log)', () => {
    expect(acotada('private.es_owner_divianco()')).toBe(true);
  });
});

describe('acotada: lo que abre el edificio', () => {
  it('using (true)', () => {
    expect(acotada('true')).toBe(false);
  });

  it('cualquiera logueado', () => {
    expect(acotada('(auth.uid() IS NOT NULL)')).toBe(false);
    expect(acotada("(auth.role() = 'authenticated'::text)")).toBe(false);
  });

  it('una rama abierta en un OR abre todo, aunque la otra este bien', () => {
    expect(acotada(`(${DEL_NEGOCIO} OR true)`)).toBe(false);
    expect(acotada(`((${DEL_NEGOCIO}) OR (activo = true))`)).toBe(false);
  });

  it('comparar contra tenant_id sin mirar de quien es', () => {
    expect(acotada('(tenant_id IS NOT NULL)')).toBe(false);
    expect(acotada("(tenant_id = '00000000-0000-0000-0000-000000000000'::uuid)")).toBe(false);
  });

  it('negar un acotador no acota', () => {
    expect(acotada("(NOT private.tiene_rol(tenant_id, ARRAY['owner'::text]))")).toBe(false);
  });

  it('el rol de OTRO negocio no acota: tiene que ser tenant_id', () => {
    expect(acotada("private.tiene_rol(p_tenant, ARRAY['owner'::text])")).toBe(false);
  });

  it('vacia o nula no cuenta como acotada', () => {
    expect(acotada('')).toBe(false);
    expect(acotada(null)).toBe(false);
  });
});

describe('partirEnNivelCero', () => {
  it('no parte adentro de parentesis ni de textos', () => {
    expect(partirEnNivelCero("(a OR b) OR c = ' OR '", 'OR')).toEqual(['(a OR b)', "c = ' OR '"]);
  });
});

describe('desenvolver', () => {
  const ok = { name: 'orders', kind: 'r', rls: true, tenant_id: true, policies: [] };

  it('acepta las tres formas en que llega el snapshot', () => {
    expect(desenvolver([ok])).toEqual([ok]); // RPC
    expect(desenvolver([{ rls_snapshot: [ok] }])).toEqual([ok]); // SQL por MCP
    expect(desenvolver({ rls_snapshot: [ok] })).toEqual([ok]);
  });

  it('la fila del SQL NO se juzga como si fuera una tabla', () => {
    // El bug de la primera version: `[{ rls_snapshot }]` es un array, se
    // tomaba entero, se juzgaba un objeto sin campos y daba verde.
    expect(desenvolver([{ rls_snapshot: [{ ...ok, rls: false }] }])[0].rls).toBe(false);
  });

  it('basura da null, no un verde', () => {
    expect(desenvolver(null)).toBeNull();
    expect(desenvolver({})).toBeNull();
    expect(desenvolver([{ foo: 1 }])).toBeNull();
    expect(desenvolver([{ ...ok, kind: 'x' }])).toBeNull();
    expect(desenvolver([{ ...ok, policies: undefined }])).toBeNull();
  });
});

describe('revisar', () => {
  it('produccion como estaba el 26/sep da verde', () => {
    const snap = [
      tabla('orders', [
        { name: 'orders_select', cmd: 'SELECT', using: '((tenant_id IN ( SELECT private.current_user_tenants() AS current_user_tenants)) OR ((user_id IS NOT NULL) AND (user_id = auth.uid())))' },
        { name: 'orders_insert', cmd: 'INSERT', check: DEL_NEGOCIO },
        { name: 'orders_update', cmd: 'UPDATE', using: DEL_NEGOCIO, check: DEL_NEGOCIO },
      ]),
      // RLS sin policies: nadie del front la toca. Es cerrada, no abierta.
      tabla('payment_integrations', []),
      // sin tenant_id: lectura publica a proposito
      tabla('plans', [{ name: 'plans_select', cmd: 'SELECT', roles: ['anon', 'authenticated'], using: 'true' }], { tenant_id: false }),
      { name: 'staff_fichas', kind: 'v', security_invoker: true, anon_select: true, authenticated_select: true, policies: [] },
    ];
    expect(revisar(snap)).toEqual([]);
  });

  it('tabla sin RLS', () => {
    const r = revisar([tabla('nueva', [], { rls: false, tenant_id: false })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ objeto: 'nueva', que: 'tabla sin RLS' });
  });

  it('policy abierta para que el catalogo lea sin login', () => {
    const r = revisar([tabla('products', [
      { name: 'products_select', cmd: 'SELECT', using: DEL_NEGOCIO },
      { name: 'products_public', cmd: 'SELECT', roles: ['anon'], using: 'true' },
    ])]);
    expect(r).toHaveLength(1);
    expect(r[0].objeto).toBe('products.products_public');
  });

  it('insert que deja escribir en otro negocio', () => {
    const r = revisar([tabla('orders', [
      { name: 'orders_insert', cmd: 'INSERT', check: '(auth.uid() IS NOT NULL)' },
    ])]);
    expect(r).toHaveLength(1);
    expect(r[0].que).toBe('policy INSERT con with check abierto');
  });

  it('las restrictivas y las de service_role no se juzgan', () => {
    const r = revisar([tabla('orders', [
      { name: 'solo_activos', cmd: 'SELECT', permissive: 'RESTRICTIVE', using: '(activo = true)' },
      { name: 'backoffice', cmd: 'ALL', roles: ['service_role'], using: 'true', check: 'true' },
    ])]);
    expect(r).toEqual([]);
  });

  it('vista sin security_invoker legible por el front', () => {
    const r = revisar([{ name: 'resumen', kind: 'v', security_invoker: false, anon_select: false, authenticated_select: true, policies: [] }]);
    expect(r).toHaveLength(1);
    expect(r[0].que).toBe('vista sin security_invoker');
  });

  it('vista sin security_invoker que el front NO puede leer: no es problema', () => {
    const r = revisar([{ name: 'interna', kind: 'v', security_invoker: false, anon_select: false, authenticated_select: false, policies: [] }]);
    expect(r).toEqual([]);
  });

  it('vista materializada legible por el front', () => {
    const r = revisar([{ name: 'ventas_mes', kind: 'm', security_invoker: false, anon_select: true, authenticated_select: true, policies: [] }]);
    expect(r).toHaveLength(1);
  });
});

/* ══════════════════ Funciones SECURITY DEFINER ══════════════════ */

function fn(name, body, extra = {}) {
  return { name, args: '', body, secdef: true, anon_exec: true, auth_exec: true, ...extra };
}

// El comienzo real de complete_order en produccion (26/sep).
const COMPLETE_ORDER = `declare v_order public.orders; begin
  select * into v_order from public.orders where id = p_order_id for update;
  -- Antes lo hacia la RLS. Ahora que la funcion es definer, se dice a mano.
  if v_order.tenant_id not in (select private.current_user_tenants()) then
    raise exception 'pedido_no_encontrado' using errcode = 'P0002';
  end if;`;

describe('desenvolverFunciones', () => {
  const f = fn('get_catalog', 'select 1');

  it('acepta el mapa del RPC y la fila del SQL', () => {
    expect(desenvolverFunciones({ 'get_catalog(p_tenant_slug text)': f })).toEqual([f]);
    expect(desenvolverFunciones([{ function_snapshot: { 'get_catalog()': f } }])).toEqual([f]);
  });

  it('sin permisos (base sin la 0077) es null, no un verde', () => {
    const sinPermisos = { name: 'x', args: '', body: 'select 1', secdef: true };
    expect(desenvolverFunciones({ 'x()': sinPermisos })).toBeNull();
  });

  it('basura da null', () => {
    expect(desenvolverFunciones(null)).toBeNull();
    expect(desenvolverFunciones([1, 2])).toBeNull();
    expect(desenvolverFunciones({ 'x()': { foo: 1 } })).toBeNull();
  });
});

describe('revisarDefiner', () => {
  const aprobadas = {
    complete_order: { tipo: 'se_cuida', porque: 'valida pertenencia' },
    get_catalog: { tipo: 'abierta', porque: 'catalogo publico' },
  };

  it('las aprobadas, con su validacion, dan verde', () => {
    const r = revisarDefiner([fn('complete_order', COMPLETE_ORDER), fn('get_catalog', 'select 1')], aprobadas);
    expect(r.problemas).toEqual([]);
  });

  it('una nueva que el front puede llamar y nadie aprobo', () => {
    const r = revisarDefiner([fn('exportar_clientes', 'select * from public.profiles')], aprobadas);
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0].que).toMatch(/nadie aprobo/);
  });

  it('una reescritura que se lleva la validacion', () => {
    const r = revisarDefiner([fn('complete_order', 'begin update public.orders set status = 1; end;')], aprobadas);
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0].que).toMatch(/ya no valida/);
  });

  it('la validacion en un comentario no cuenta', () => {
    const body = '-- if not private.tiene_rol(...) then raise\nbegin delete from public.orders; end;';
    const r = revisarDefiner([fn('complete_order', body)], aprobadas);
    expect(r.problemas).toHaveLength(1);
  });

  it('las que el front no puede llamar, o que no son definer, no se juzgan', () => {
    const r = revisarDefiner([
      fn('interna', 'delete from public.orders', { anon_exec: false, auth_exec: false }),
      fn('invoker', 'select * from public.orders', { secdef: false }),
    ], aprobadas);
    expect(r.problemas).toEqual([]);
  });

  it('solo authenticated tambien cuenta: cualquiera se registra', () => {
    const r = revisarDefiner([fn('nueva', 'select 1', { anon_exec: false })], aprobadas);
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0].que).toMatch(/authenticated/);
  });

  it('avisa las aprobadas que ya no aparecen, para podar la lista', () => {
    const r = revisarDefiner([fn('get_catalog', 'select 1')], aprobadas);
    expect(r.sobran).toEqual(['complete_order']);
  });

  it('la lista real: cada entrada tiene tipo valido y motivo', () => {
    for (const [nombre, a] of Object.entries(DEFINER_APROBADAS)) {
      expect(['se_cuida', 'abierta'], nombre).toContain(a.tipo);
      expect(a.porque.length, nombre).toBeGreaterThan(10);
    }
  });
});
