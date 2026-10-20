-- Ejecutar como postgres (SQL editor o MCP execute_sql), despues de 0107.
-- Siempre termina en excepcion: TODO el fixture se revierte, incluso si falla.
-- Verde: RECETARIO_POR_ROL 74/74 ok. Un error SQL inesperado aborta el test.
do $$
declare
  t uuid := gen_random_uuid();
  otro uuid := gen_random_uuid();
  p uuid := gen_random_uuid();
  secreto uuid := gen_random_uuid();
  ajeno uuid := gen_random_uuid();
  nuevo uuid := gen_random_uuid();
  u uuid;
  rol text;
  accion text;
  n int;
  total int := 0;
  fallas text[] := '{}';
  esperado boolean;
  matriz constant jsonb := '{
    "lee": ["owner","manager","kitchen"],
    "lee_secreto": ["owner"],
    "lee_otro_tenant": [],
    "edita": ["owner","manager"],
    "inserta": ["owner","manager"],
    "borra": ["owner"],
    "oculta_manager": ["owner"],
    "edita_secreto": ["owner"],
    "cambia_identidad": [],
    "sellos": ["owner","manager"]
  }';
begin
  insert into public.tenants(id,slug,name,vertical) values
    (t,'zz-recetario-'||substr(t::text,1,12),'Recetario test','gastro'),
    (otro,'zz-recetario-'||substr(otro::text,1,12),'Recetario otro','gastro');
  insert into public.products(id,tenant_id,name,type,price) values
    (p,t,'Normal','composite',1), (secreto,t,'Secreto','composite',1),
    (nuevo,t,'Nuevo','composite',1), (ajeno,otro,'Ajeno','composite',1);
  insert into public.recipe_cards(tenant_id,product_id,visible_to) values
    (t,p,array['owner','manager','kitchen']), (t,secreto,array['owner']),
    (otro,ajeno,array['owner','manager','kitchen']);

  foreach rol in array array['owner','manager','cashier','attendant','kitchen','marketer','accountant'] loop
    perform set_config('role','none',true);
    u := gen_random_uuid();
    insert into public.tenant_members(tenant_id,user_id,roles) values (t,u,array[rol]);
    perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    foreach accion in array array['lee','lee_secreto','lee_otro_tenant','edita','inserta','borra',
                                  'oculta_manager','edita_secreto','cambia_identidad','sellos'] loop
      n := 0;
      begin
        case accion
        when 'lee' then select count(*) into n from public.recipe_cards where product_id=p;
        when 'lee_secreto' then select count(*) into n from public.recipe_cards where product_id=secreto;
        when 'lee_otro_tenant' then select count(*) into n from public.recipe_cards where product_id=ajeno;
        when 'edita' then
          update public.recipe_cards set notes='Editada' where product_id=p;
          get diagnostics n = row_count;
        when 'inserta' then
          insert into public.recipe_cards(tenant_id,product_id) values(t,nuevo);
          get diagnostics n = row_count;
        when 'borra' then
          delete from public.recipe_cards where product_id=p;
          get diagnostics n = row_count;
        when 'oculta_manager' then
          update public.recipe_cards set visible_to=array['owner'] where product_id=p;
          get diagnostics n = row_count;
        when 'edita_secreto' then
          update public.recipe_cards set notes='No debe filtrar' where product_id=secreto;
          get diagnostics n = row_count;
        when 'cambia_identidad' then
          update public.recipe_cards set product_id=nuevo where product_id=p;
          get diagnostics n = row_count;
        when 'sellos' then
          update public.recipe_cards set notes='Sellada', updated_by=gen_random_uuid(),
            created_at='2000-01-01',updated_at='2000-01-01' where product_id=p;
          select count(*) into n from public.recipe_cards where product_id=p and notes='Sellada'
            and updated_by=u and created_at>'2000-01-02' and updated_at>'2000-01-02';
        end case;
        raise exception using errcode='P0002',message='__undo_recetario__';
      exception
        when no_data_found then
          if sqlerrm <> '__undo_recetario__' then raise; end if;
        when insufficient_privilege or check_violation or foreign_key_violation then n := 0;
      end;
      esperado := (matriz->accion) ? rol;
      total := total+1;
      if (n=1) is distinct from esperado then
        fallas := fallas || format('%s.%s esperado=%s filas=%s',rol,accion,esperado,n);
      end if;
    end loop;
  end loop;

  -- No miembro: usuario con owner SOLO en otro tenant no lee ni escribe t.
  perform set_config('role','none',true);
  u := gen_random_uuid();
  insert into public.tenant_members(tenant_id,user_id,roles) values(otro,u,array['owner']);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*) into n from public.recipe_cards where tenant_id=t;
  total:=total+1;
  if n<>0 then fallas:=fallas||'no_miembro.lee'; end if;
  n:=0;
  begin
    insert into public.recipe_cards(tenant_id,product_id) values(t,nuevo);
    n:=1;
    raise exception using errcode='P0002',message='__undo_recetario__';
  exception when no_data_found then
    if sqlerrm <> '__undo_recetario__' then raise; end if;
  when insufficient_privilege then n:=0;
  end;
  total:=total+1;
  if n<>0 then fallas:=fallas||'no_miembro.inserta'; end if;

  -- Ahora owner EN AMBOS: RLS deja escribir ambos; la FK debe impedir mezclar IDs.
  perform set_config('role','none',true);
  insert into public.tenant_members(tenant_id,user_id,roles) values(t,u,array['owner']);
  perform set_config('role','authenticated',true);
  n:=0;
  begin
    insert into public.recipe_cards(tenant_id,product_id) values(otro,nuevo);
    n:=1;
    raise exception using errcode='P0002',message='__undo_recetario__';
  exception when no_data_found then
    if sqlerrm <> '__undo_recetario__' then raise; end if;
  when foreign_key_violation then n:=0;
  end;
  total:=total+1;
  if n<>0 then fallas:=fallas||'owner_dos_tenants.producto_cruzado'; end if;

  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  n:=0;
  begin
    select count(*) into n from public.recipe_cards;
  exception when insufficient_privilege then n:=0;
  end;
  total:=total+1;
  if n<>0 then fallas:=fallas||'anon.lee'; end if;

  perform set_config('role','none',true);
  raise exception 'RECETARIO_POR_ROL %/% ok%',total-cardinality(fallas),total,
    case when cardinality(fallas)=0 then '' else ' | '||array_to_string(fallas,' | ') end;
end $$;
