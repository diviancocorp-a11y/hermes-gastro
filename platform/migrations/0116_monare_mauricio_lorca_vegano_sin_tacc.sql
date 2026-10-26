-- 0116 — Declaraciones confirmadas para productos Mauricio Lorca de Monare.
-- Aplicada via MCP el 26/oct/2026.
-- Ricky confirmo que todos los productos de la bodega son veganos y sin TACC.

do $$
declare
  v_updated integer;
begin
  update public.products p
  set catalog_attributes = jsonb_set(
    coalesce(p.catalog_attributes, '{}'::jsonb),
    '{features}',
    '["vegan", "gluten_free"]'::jsonb,
    true
  )
  from public.tenants t
  where t.id = p.tenant_id
    and t.slug = 'monare'
    and p.catalog_attributes->>'brand' = 'Mauricio Lorca';

  get diagnostics v_updated = row_count;
  if v_updated <> 42 then
    raise exception 'Se esperaban 42 productos Mauricio Lorca; se actualizaron %', v_updated;
  end if;
end;
$$;
