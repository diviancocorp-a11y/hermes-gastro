-- 0118 — Familias del catalogo: agrupar productos en una sola tarjeta.
-- Aplicada via MCP el 31/oct/2026. Solo expandir.
-- Suma dos claves a catalog_attributes: `family` (nombre de la familia, ej.
-- "Empanadas") y `family_pack` (unidades por pack/docena, solo digitos). Es la
-- misma funcion con la misma firma y mas permisiva: los datos existentes y el
-- deploy anterior siguen siendo validos.

create or replace function private.valid_catalog_attributes(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare entry record; feature jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' or length(value::text) > 4096 then return false; end if;
  for entry in select * from jsonb_each(value) loop
    if entry.key not in ('category','brand','line','varietal','presentation','features','family','family_pack') then return false; end if;
    if entry.key = 'features' then
      if jsonb_typeof(entry.value) <> 'array' then return false; end if;
      if jsonb_array_length(entry.value) > 3 then return false; end if;
      for feature in select * from jsonb_array_elements(entry.value) loop
        if jsonb_typeof(feature) <> 'string' or feature #>> '{}' not in ('vegetarian','vegan','gluten_free') then return false; end if;
      end loop;
      if (select count(distinct item) from jsonb_array_elements(entry.value) item) <> jsonb_array_length(entry.value) then return false; end if;
    elsif jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 120 then
      return false;
    elsif entry.key = 'family_pack' and (entry.value #>> '{}') !~ '^[0-9]{1,3}$' then
      return false;
    end if;
  end loop;
  return true;
end $valid$;
