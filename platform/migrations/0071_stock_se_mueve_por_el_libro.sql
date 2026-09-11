-- 0071 - El stock se mueve por el libro, y reponer deja de no existir.
--
-- LO QUE ESTABA ROTO Y NADIE VEIA
-- Habia DOS numeros de "disponible" y ninguna operacion que los moviera juntos:
--
--   ingredients.stock        lo que muestra el panel
--   inventory_balances.qty   el saldo del libro, que mueve un trigger
--
-- `register_stock_movement` asienta en el libro y el trigger actualiza el
-- saldo, pero NADIE toca `ingredients.stock`. Al reves, `adjustStock` del
-- servicio escribe `ingredients.stock` y no asienta nada. Las dos funciones
-- existen en el repo y no las llama nadie: reponer y ajustar simplemente no
-- son operaciones del edificio todavia.
--
-- La unica que esta bien hecha es `register_waste`: baja `ingredients.stock`
-- Y asienta en el libro, en la misma transaccion. Esta migracion generaliza
-- ese patron para que lo use cualquier movimiento hecho a mano.
--
-- POR QUE UNA RPC Y NO UN UPDATE DESDE EL CLIENTE
-- El `adjustStock` del servicio lee y escribe en dos pasos: dos ajustes
-- simultaneos del mismo insumo se pisan. Con `for update` dentro de la funcion
-- el segundo espera al primero. Ademas el cliente no puede olvidarse de
-- asentar en el libro, porque no tiene forma de mover el stock sin hacerlo.
--
-- PERMISOS: MEMBRESIA, IGUAL QUE LA MERMA
-- Mover stock exige ser miembro del negocio, ni mas ni menos que registrar una
-- merma, que descuenta stock Y plata. Poner roles solo aca dejaria el modelo
-- incoherente: quien puede tirar un kilo a la basura puede contarlo.

-- ── 1. El insumo sabe a quien se le compra ─────────────────────────────
--
-- La ficha del insumo muestra el proveedor, y hasta ahora la unica relacion
-- con `suppliers` era desde `expenses`: se sabia a quien se le pago, no a
-- quien se le compra habitualmente. SET NULL y no CASCADE: dar de baja un
-- proveedor no puede borrar el insumo.

alter table public.ingredients
  add column if not exists supplier_id uuid
    references public.suppliers(id) on delete set null;

create index if not exists ingredients_supplier_idx
  on public.ingredients (supplier_id) where supplier_id is not null;


-- ── 2. Mover el stock de un insumo, por el libro ───────────────────────
--
-- `p_qty` va FIRMADA: positiva agrega, negativa saca. El libro guarda el
-- signo y no lo deriva del tipo, asi que un ajuste por conteo que da menos
-- que lo registrado entra como negativo y se lee tal cual.

create or replace function public.mover_stock_de_insumo(
  p_tenant_id         uuid,
  p_ingredient_id     uuid,
  p_kind              text,
  p_qty               numeric,
  p_note              text default null,
  p_client_request_id uuid default null
)
returns public.ingredients
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_ing   public.ingredients;
  v_ya    public.inventory_movements;
  v_nuevo numeric;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if coalesce(p_qty, 0) = 0 then
    raise exception 'cantidad_invalida';
  end if;
  -- Solo los movimientos que nacen de una persona. `sale` lo asienta el
  -- pedido, `waste` lo asienta register_waste: si entraran por aca, el stock
  -- se descontaria dos veces.
  if p_kind not in ('purchase', 'adjustment', 'initial', 'return') then
    raise exception 'movimiento_no_manual';
  end if;

  -- La idempotencia se chequea ANTES de tocar el stock. Si se chequeara
  -- despues, un reintento por red caida sumaria de nuevo al stock y recien
  -- entonces encontraria el movimiento repetido y no lo asentaria: el numero
  -- quedaria arriba del libro para siempre.
  if p_client_request_id is not null then
    select * into v_ya from public.inventory_movements m
     where m.tenant_id = p_tenant_id
       and m.client_request_id = p_client_request_id
       and m.kind = p_kind
       and m.ingredient_id = p_ingredient_id;
    if found then
      select * into v_ing from public.ingredients i where i.id = p_ingredient_id;
      return v_ing;
    end if;
  end if;

  -- `for update` serializa dos conteos simultaneos del mismo insumo.
  select * into v_ing from public.ingredients i
   where i.id = p_ingredient_id and i.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'insumo_de_otro_negocio';
  end if;

  v_nuevo := greatest(0, coalesce(v_ing.stock, 0) + p_qty);

  update public.ingredients
     set stock = v_nuevo
   where id = v_ing.id
  returning * into v_ing;

  perform public.register_stock_movement(
    p_tenant_id, p_kind, p_qty, v_ing.id, null, null,
    case when p_kind = 'purchase' then v_ing.cost else null end,
    'manual', null, nullif(btrim(coalesce(p_note, '')), ''), p_client_request_id);

  return v_ing;
end $function$;

revoke all on function public.mover_stock_de_insumo(uuid, uuid, text, numeric, text, uuid) from anon;


-- ── 3. El conteo de deposito, entero o nada ────────────────────────────
--
-- La vista de conteo guarda por LOTE, no fila por fila: quien cuenta el
-- deposito recorre todo y guarda una vez. Si se guardara de a uno, cortar a
-- la mitad dejaria medio deposito contado y medio no, sin forma de saber
-- cual mitad.
--
-- `p_conteos` es [{"ingredient_id": uuid, "contado": numeric}, ...] y lo que
-- se asienta es la DIFERENCIA contra lo registrado, no el numero contado: el
-- libro guarda movimientos, no fotos. Los insumos cuyo conteo coincide con lo
-- registrado no generan movimiento — un ajuste de cero ensucia el libro y
-- ademas lo rechaza el check `qty <> 0`.

create or replace function public.guardar_conteo_de_deposito(
  p_tenant_id         uuid,
  p_conteos           jsonb,
  p_note              text default null,
  p_client_request_id uuid default null
)
returns setof public.ingredients
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_fila    jsonb;
  v_ing_id  uuid;
  v_contado numeric;
  v_actual  numeric;
  v_delta   numeric;
  v_ing     public.ingredients;
  v_nota    text;
begin
  if p_tenant_id is null then
    raise exception 'falta_tenant';
  end if;
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if p_conteos is null or jsonb_typeof(p_conteos) <> 'array' then
    raise exception 'conteo_invalido';
  end if;

  v_nota := coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'conteo de deposito');

  for v_fila in select * from jsonb_array_elements(p_conteos)
  loop
    v_ing_id  := (v_fila ->> 'ingredient_id')::uuid;
    v_contado := (v_fila ->> 'contado')::numeric;
    if v_ing_id is null or v_contado is null then
      raise exception 'conteo_invalido';
    end if;
    if v_contado < 0 then
      raise exception 'cantidad_invalida';
    end if;

    select coalesce(i.stock, 0) into v_actual from public.ingredients i
     where i.id = v_ing_id and i.tenant_id = p_tenant_id
     for update;
    if not found then
      raise exception 'insumo_de_otro_negocio';
    end if;

    v_delta := v_contado - v_actual;
    if v_delta <> 0 then
      -- La clave de idempotencia del lote se combina con el insumo: el lote
      -- entero se reintenta con la misma clave y ningun insumo se ajusta dos
      -- veces, pero cada uno conserva su propio movimiento en el libro.
      -- md5 sobre las dos claves da un uuid estable sin depender de pgcrypto
      -- ni de la extension uuid-ossp, que este proyecto no tiene instaladas.
      v_ing := public.mover_stock_de_insumo(
        p_tenant_id, v_ing_id, 'adjustment', v_delta, v_nota,
        case when p_client_request_id is null then null
             else md5(p_client_request_id::text || ':' || v_ing_id::text)::uuid end);
    else
      select * into v_ing from public.ingredients i where i.id = v_ing_id;
    end if;

    return next v_ing;
  end loop;

  return;
end $function$;

revoke all on function public.guardar_conteo_de_deposito(uuid, jsonb, text, uuid) from anon;


-- ── 4. Cuanto se consume por dia ───────────────────────────────────────
--
-- "Alcanza para 0.4 dias" es la frase que convierte una lista de numeros en
-- una advertencia. Sale del libro y no de una columna cargada a mano, que
-- quedaria vieja al dia siguiente.
--
-- Se promedia sobre los dias que el insumo tuvo movimiento, no sobre la
-- ventana entera: un insumo que solo se usa los findes tiene un consumo
-- diario real alto y dividirlo por 14 lo haria parecer inofensivo.
--
-- Se cuentan las salidas reales (venta y merma). Los ajustes quedan afuera a
-- proposito: un ajuste por conteo corrige un error de registro, no es
-- consumo, y contarlo inflaria la unica cifra que decide si hay que reponer.

create or replace function public.consumo_diario_de_insumos(
  p_tenant_id uuid,
  p_dias      integer default 14
)
returns table (ingredient_id uuid, consumo_diario numeric, dias_con_movimiento integer)
language sql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
  select
    m.ingredient_id,
    round(sum(-m.qty) / greatest(count(distinct m.created_at::date), 1), 3) as consumo_diario,
    count(distinct m.created_at::date)::integer                            as dias_con_movimiento
  from public.inventory_movements m
  where m.tenant_id = p_tenant_id
    and p_tenant_id in (select private.current_user_tenants())
    and m.ingredient_id is not null
    and m.kind in ('sale', 'waste')
    and m.qty < 0
    and m.created_at >= now() - make_interval(days => greatest(coalesce(p_dias, 14), 1))
  group by m.ingredient_id;
$function$;

revoke all on function public.consumo_diario_de_insumos(uuid, integer) from anon;
