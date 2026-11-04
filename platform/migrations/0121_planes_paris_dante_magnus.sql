-- Aplicada via MCP el 2026-11-04
-- Los planes se venden como Paris, Dante y Magnus (Ricky, 4/nov/2026). Los ids
-- no cambian: los guardan tenants.plan_id y los diagnosticos. La consola queda
-- igual a la oferta publica de src/lib/planesPlataforma.js: Paris a $14.999,
-- solo con pago mensual (Ricky, 23 y 25/oct).
update public.plans set
  nombre = 'Paris',
  descripcion = 'Tu negocio online y la operación en un solo lugar.',
  precio_mensual = 14999,
  precio_anual_por_mes = null,
  actualizado_at = now()
where id = 'digital';

update public.plans set
  nombre = 'Dante',
  descripcion = 'La base de Paris, con soporte para tu operación.',
  actualizado_at = now()
where id = 'local';

update public.plans set
  nombre = 'Magnus',
  descripcion = 'Cada local con su operación. Todos con una misma mirada.',
  actualizado_at = now()
where id = 'cadena';
