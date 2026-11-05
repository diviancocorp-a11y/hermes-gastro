-- Aplicada via MCP el 2026-11-04
-- La consola dice de Dante lo mismo que la landing (src/lib/planesPlataforma.js):
-- lo que lo separa de Paris es saber cuanto se gana y volver a vender.
update public.plans set
  descripcion = 'Sabé cuánto ganás y volvé a vender a los que no vuelven.',
  actualizado_at = now()
where id = 'local';
