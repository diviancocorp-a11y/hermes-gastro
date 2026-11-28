-- Test de la 0152: la plantilla `cochi` es exclusiva del tenant con slug 'cochi'.
-- Correr (DESPUES de aplicar la 0152) cada vez que se toque el trigger
-- settings_plantilla_exclusiva o la lista de plantillas.
--
-- Es UN bloque DO que termina SIEMPRE con raise exception: la transaccion se
-- deshace entera y no queda nada en la base (ni el cambio en Cochi ni el
-- tenant de prueba). Resultado en el mensaje del error:
--   PLANTILLA_EXCLUSIVA OK ...      todo bien
--   PLANTILLA_EXCLUSIVA FALLA: ...  que se esperaba y que dio
--
-- Escenario: Cochi (27881a18-...) pasa a 'cochi' y vuelve a 'pop'; un tenant de
-- prueba NO puede poner 'cochi' (42501), pero 'pop' y 'default' siguen andando.

do $test$
declare
  v_cochi constant uuid := '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
  v_otro  uuid := gen_random_uuid();
  v_valor text;
  v_bloqueado boolean := false;
  v_codigo text;
begin
  if not exists (select 1 from public.tenants where id = v_cochi and slug = 'cochi') then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: no existe el tenant cochi esperado';
  end if;

  -- Cochi: pop -> cochi -> pop
  update public.settings set catalog_template = 'cochi' where tenant_id = v_cochi;
  select catalog_template into v_valor from public.settings where tenant_id = v_cochi;
  if v_valor is distinct from 'cochi' then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: Cochi deberia quedar en cochi y quedo en %', v_valor;
  end if;
  update public.settings set catalog_template = 'pop' where tenant_id = v_cochi;
  select catalog_template into v_valor from public.settings where tenant_id = v_cochi;
  if v_valor is distinct from 'pop' then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: Cochi deberia volver a pop y quedo en %', v_valor;
  end if;

  -- Otro tenant: no puede poner cochi
  insert into public.tenants (id, slug, name, vertical)
    values (v_otro, 'test-plantilla-' || substr(v_otro::text, 1, 8), 'Test plantilla 0152', 'gastro');
  insert into public.settings (tenant_id) values (v_otro) on conflict (tenant_id) do nothing;

  begin
    update public.settings set catalog_template = 'cochi' where tenant_id = v_otro;
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    v_bloqueado := (v_codigo = '42501');
  end;
  if not v_bloqueado then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: otro tenant pudo poner cochi (o fallo con otro codigo: %)', v_codigo;
  end if;

  -- Y con el insert directo tampoco
  v_bloqueado := false;
  delete from public.settings where tenant_id = v_otro;
  begin
    insert into public.settings (tenant_id, catalog_template) values (v_otro, 'cochi');
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    v_bloqueado := (v_codigo = '42501');
  end;
  if not v_bloqueado then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: el insert de otro tenant con cochi no fue rechazado (codigo: %)', v_codigo;
  end if;

  -- pop y default siguen
  insert into public.settings (tenant_id, catalog_template) values (v_otro, 'pop');
  update public.settings set catalog_template = 'default' where tenant_id = v_otro;
  select catalog_template into v_valor from public.settings where tenant_id = v_otro;
  if v_valor is distinct from 'default' then
    raise exception 'PLANTILLA_EXCLUSIVA FALLA: default no quedo (%)', v_valor;
  end if;

  raise exception 'PLANTILLA_EXCLUSIVA OK: cochi solo en el tenant cochi; pop y default siguen';
end
$test$;
