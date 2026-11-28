-- PENDIENTE de aplicar (la aplica el director via MCP con ok de Ricky)
-- 0153 — Cochi pasa de la plantilla `pop` a su plantilla propia `cochi`.
-- Solo datos. Se aplica DESPUES de la 0152 y DESPUES del deploy del front que
-- trae PlantillaCochi: hoy ese componente es pop con otro nombre, asi que el
-- catalogo de Cochi no cambia al aplicarla. La config
-- (catalog_template_config) no se toca.
--
-- Para volver atras: update public.settings set catalog_template = 'pop'
--   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';

do $$
declare
  v_filas integer;
begin
  update public.settings
     set catalog_template = 'cochi'
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
     and catalog_template = 'pop';
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception '0153: se esperaba actualizar 1 fila (Cochi en pop) y fueron %', v_filas;
  end if;
end $$;
