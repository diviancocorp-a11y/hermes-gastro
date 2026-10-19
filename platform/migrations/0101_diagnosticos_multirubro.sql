-- 0101_diagnosticos_multirubro.sql
-- SIN APLICAR: la aplica Ricky desde el editor SQL del panel (toca restricciones).
--
-- contraer: diagnosticos se creo el 19/oct/2026 (0100) y esta vacia; ningun
-- codigo desplegado la lee ni la escribe todavia. La landing pasa a hablarle a
-- todos los rubros (pedido de Ricky del 19/oct), asi que el tipo de negocio deja
-- de ser solo gastronomico y el desafio suma stock y turnos.
--
-- Lo que cambia:
--   establecimiento: suma los tipos de comercio y de servicios, y ya no exige
--     vertical = gastronomia (cada tipo tiene que corresponder a su vertical).
--   desafio: suma 'stock' (comercio y servicios) y 'turnos' (servicios; la
--     agenda de turnos esta en desarrollo y el resultado lo dice).

alter table public.diagnosticos
  drop constraint if exists diagnosticos_establecimiento_solo_gastro;

alter table public.diagnosticos
  drop constraint if exists diagnosticos_establecimiento_check;

alter table public.diagnosticos
  add constraint diagnosticos_establecimiento_check
  check (establecimiento in (
    -- gastronomia
    'restaurante', 'parrilla', 'cafeteria', 'panaderia_pasteleria',
    'bar_cerveceria', 'dark_kitchen',
    -- comercio
    'indumentaria', 'almacen_kiosco', 'bebidas', 'otro_comercio',
    -- servicios
    'barberia_peluqueria', 'estetica', 'otro_servicio'
  ));

alter table public.diagnosticos
  add constraint diagnosticos_establecimiento_de_su_vertical
  check (
    establecimiento is null
    or (vertical = 'gastronomia' and establecimiento in ('restaurante', 'parrilla',
          'cafeteria', 'panaderia_pasteleria', 'bar_cerveceria', 'dark_kitchen'))
    or (vertical = 'comercio' and establecimiento in ('indumentaria',
          'almacen_kiosco', 'bebidas', 'otro_comercio'))
    or (vertical = 'servicios' and establecimiento in ('barberia_peluqueria',
          'estetica', 'otro_servicio'))
  );

alter table public.diagnosticos
  drop constraint if exists diagnosticos_desafio_check;

alter table public.diagnosticos
  add constraint diagnosticos_desafio_check
  check (desafio in ('rentabilidad', 'costos', 'costo_laboral', 'mermas_caja',
    'pedidos', 'stock', 'turnos'));

-- Verificacion (correr despues, debe dar 3 filas con los nombres nuevos):
-- select conname from pg_constraint
--  where conrelid = 'public.diagnosticos'::regclass
--    and conname in ('diagnosticos_establecimiento_check',
--      'diagnosticos_establecimiento_de_su_vertical', 'diagnosticos_desafio_check');
